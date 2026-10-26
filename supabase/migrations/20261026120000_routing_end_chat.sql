-- 1) Customer ends the chat -> ends for the agent too.
-- 2) Routing teams: the AI picks a team per ticket; the least-busy team member
--    is auto-assigned (org owner as fallback while a team has no members).

-- ============================================================================
-- End chat
-- ============================================================================

ALTER TABLE public.tickets ADD COLUMN chat_ended_at TIMESTAMPTZ;

-- Token-gated like the other client RPCs: knowing the unguessable
-- client_access_token is the authorization.
CREATE OR REPLACE FUNCTION public.end_chat_by_token(_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.tickets
     SET chat_ended_at = now(), agent_requested_at = NULL
   WHERE client_access_token = _token AND chat_ended_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.end_chat_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_chat_by_token(TEXT) TO anon, authenticated;

-- A new customer message reopens an ended chat.
CREATE OR REPLACE FUNCTION public.reopen_chat_on_client_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.tickets SET chat_ended_at = NULL WHERE id = NEW.ticket_id AND chat_ended_at IS NOT NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reopen_chat_on_client_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW WHEN (NEW.sender_type = 'client')
  EXECUTE FUNCTION public.reopen_chat_on_client_message();

CREATE OR REPLACE FUNCTION public.notify_ghl_chat_ended()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.call_notify_webhook('chat_ended', NEW.id, NULL);
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_ghl_chat_ended
  AFTER UPDATE OF chat_ended_at ON public.tickets
  FOR EACH ROW WHEN (OLD.chat_ended_at IS NULL AND NEW.chat_ended_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_ghl_chat_ended();

-- ============================================================================
-- Routing teams
-- ============================================================================

CREATE TABLE public.routing_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE TABLE public.routing_team_members (
  team_id UUID NOT NULL REFERENCES public.routing_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE public.routing_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_team_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.routing_teams, public.routing_team_members FROM anon;

CREATE POLICY "Org members can view routing teams" ON public.routing_teams FOR SELECT
  TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent', 'viewer']));
CREATE POLICY "Admins manage routing teams" ON public.routing_teams FOR ALL
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Org members can view team members" ON public.routing_team_members FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.routing_teams t
     WHERE t.id = routing_team_members.team_id
       AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin', 'agent', 'viewer'])
  ));
-- Only staff of the same org (owner/admin/agent) can be put on a team.
CREATE POLICY "Admins manage team members" ON public.routing_team_members FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.routing_teams t
     WHERE t.id = routing_team_members.team_id AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.routing_teams t
      JOIN public.organization_members m ON m.organization_id = t.organization_id
     WHERE t.id = routing_team_members.team_id
       AND m.user_id = routing_team_members.user_id
       AND m.role IN ('owner', 'admin', 'agent')
       AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin'])
  ));

-- Default teams for every org (existing and new).
CREATE OR REPLACE FUNCTION public.seed_default_routing_teams(_org_id UUID)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.routing_teams (organization_id, key, name, description, sort) VALUES
    (_org_id, 'ghl', 'GoHighLevel', 'Anything about GoHighLevel (GHL): CRM, workflows, calendars, funnels, automations, integrations.', 1),
    (_org_id, 'apps', 'Apps', 'Our apps: TaxPractice, Referral Circle, Payroll, the support portal and other software.', 2),
    (_org_id, 'internal', 'Internal', 'Leads, clients and business owners: account, billing, partnership and client-relationship matters.', 3),
    (_org_id, 'appointments', 'Appointment setting', 'Booking, rescheduling, missed or double-booked appointments and calendar problems.', 4)
  ON CONFLICT (organization_id, key) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_routing_teams_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_routing_teams(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_default_routing_teams
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_routing_teams_trigger();

SELECT public.seed_default_routing_teams(id) FROM public.organizations;

-- ============================================================================
-- Ticket team + auto-assign
-- ============================================================================

ALTER TABLE public.tickets ADD COLUMN team_key TEXT;
CREATE INDEX idx_tickets_team_key ON public.tickets(organization_id, team_key);

-- Least-busy member of the ticket's team (open tickets), ties -> least
-- recently assigned. No members -> org owner. Unknown/absent team -> untouched.
CREATE OR REPLACE FUNCTION public.assign_ticket_to_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _team_id UUID;
  _pick UUID;
BEGIN
  -- Public (anon) inserts may not choose their own assignee.
  IF coalesce(auth.role(), 'anon') = 'anon' THEN
    NEW.assigned_to_user_id := NULL;
  END IF;

  IF NEW.team_key IS NULL OR NEW.assigned_to_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO _team_id FROM public.routing_teams
   WHERE organization_id = NEW.organization_id AND key = NEW.team_key;
  IF _team_id IS NULL THEN
    NEW.team_key := NULL;
    RETURN NEW;
  END IF;

  SELECT m.user_id INTO _pick
    FROM public.routing_team_members m
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE t.status NOT IN ('Resolved', 'Closed')) AS open_count,
             max(t.created_at) AS last_assigned
        FROM public.tickets t
       WHERE t.organization_id = NEW.organization_id AND t.assigned_to_user_id = m.user_id
    ) load ON true
   WHERE m.team_id = _team_id
   ORDER BY coalesce(load.open_count, 0), load.last_assigned NULLS FIRST, m.user_id
   LIMIT 1;

  IF _pick IS NULL THEN
    SELECT owner_id INTO _pick FROM public.organizations WHERE id = NEW.organization_id;
  END IF;

  NEW.assigned_to_user_id := _pick;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_ticket_to_team
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.assign_ticket_to_team();

REVOKE ALL ON FUNCTION public.end_chat_by_token(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_chat_by_token(TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.reopen_chat_on_client_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_ghl_chat_ended() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_default_routing_teams(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_default_routing_teams_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_ticket_to_team() FROM PUBLIC, anon, authenticated;
