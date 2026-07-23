-- ============================================================================
-- Tags, SLA policies, canned responses, internal notes, and an automatic
-- ticket activity/audit log. All scoped per-organization.
-- ============================================================================

CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.ticket_tags (
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, tag_id)
);

CREATE TABLE public.sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  priority TEXT NOT NULL,
  first_response_minutes INTEGER NOT NULL CHECK (first_response_minutes > 0),
  resolution_minutes INTEGER NOT NULL CHECK (resolution_minutes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, priority)
);

CREATE TRIGGER update_sla_policies_updated_at
  BEFORE UPDATE ON public.sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_canned_responses_updated_at
  BEFORE UPDATE ON public.canned_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ticket_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_tags_tag ON public.ticket_tags(tag_id);
CREATE INDEX idx_sla_policies_org ON public.sla_policies(organization_id);
CREATE INDEX idx_canned_responses_org ON public.canned_responses(organization_id);
CREATE INDEX idx_ticket_notes_ticket ON public.ticket_notes(ticket_id, created_at);
CREATE INDEX idx_ticket_activity_ticket ON public.ticket_activity(ticket_id, created_at);

ALTER TABLE public.tickets ADD COLUMN sla_policy_id UUID REFERENCES public.sla_policies(id) ON DELETE SET NULL;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view tags" ON public.tags FOR SELECT
  TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "Agents+ can manage tags" ON public.tags FOR INSERT
  TO authenticated WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']));
CREATE POLICY "Agents+ can update tags" ON public.tags FOR UPDATE
  TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']));
CREATE POLICY "Agents+ can delete tags" ON public.tags FOR DELETE
  TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']));

ALTER TABLE public.ticket_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view ticket tags" ON public.ticket_tags FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_tags.ticket_id AND public.is_org_member(t.organization_id)
  ));
CREATE POLICY "Agents+ can tag tickets" ON public.ticket_tags FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_tags.ticket_id
      AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin', 'agent'])
  ));
CREATE POLICY "Agents+ can untag tickets" ON public.ticket_tags FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_tags.ticket_id
      AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin', 'agent'])
  ));

ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view SLA policies" ON public.sla_policies FOR SELECT
  TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "Owners and admins can manage SLA policies" ON public.sla_policies FOR ALL
  TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view canned responses" ON public.canned_responses FOR SELECT
  TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "Agents+ can manage canned responses" ON public.canned_responses FOR ALL
  TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']));

ALTER TABLE public.ticket_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view internal notes" ON public.ticket_notes FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_notes.ticket_id AND public.is_org_member(t.organization_id)
  ));
CREATE POLICY "Agents+ can add internal notes" ON public.ticket_notes FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_notes.ticket_id
      AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin', 'agent'])
  ));

ALTER TABLE public.ticket_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view ticket activity" ON public.ticket_activity FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = ticket_activity.ticket_id AND public.is_org_member(t.organization_id)
  ));
-- No client-facing INSERT policy: all rows are written by the SECURITY
-- DEFINER trigger functions below, which bypass RLS as the table owner.

-- ============================================================================
-- Automatic audit trail
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_ticket_activity(_ticket_id UUID, _action TEXT, _meta JSONB DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _actor_name TEXT;
BEGIN
  SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO _actor_name
  FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.ticket_activity (ticket_id, actor_id, actor_name, action, meta)
  VALUES (_ticket_id, auth.uid(), _actor_name, _action, _meta);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_ticket_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.log_ticket_activity(NEW.id, 'created', jsonb_build_object('priority', NEW.priority, 'category', NEW.issue_category));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_created_activity
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_created();

CREATE OR REPLACE FUNCTION public.trg_ticket_updated_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_ticket_activity(NEW.id, 'status_changed', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id THEN
    PERFORM public.log_ticket_activity(NEW.id, 'assigned', jsonb_build_object('from', OLD.assigned_to_user_id, 'to', NEW.assigned_to_user_id));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    PERFORM public.log_ticket_activity(NEW.id, 'priority_changed', jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
  END IF;
  IF NEW.sla_breached = true AND OLD.sla_breached = false THEN
    PERFORM public.log_ticket_activity(NEW.id, 'sla_breached', '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_updated_activity
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_updated_activity();

CREATE OR REPLACE FUNCTION public.trg_note_added_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.log_ticket_activity(NEW.ticket_id, 'note_added', jsonb_build_object('author_name', NEW.author_name));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_note_added
  AFTER INSERT ON public.ticket_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_note_added_activity();

CREATE OR REPLACE FUNCTION public.trg_message_added_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ticket_activity (ticket_id, actor_name, action, meta)
  VALUES (NEW.ticket_id, NEW.sender_name, 'message_sent', jsonb_build_object('sender_type', NEW.sender_type));
  IF NEW.sender_type = 'support' THEN
    UPDATE public.tickets SET first_responded_at = COALESCE(first_responded_at, now()) WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_chat_message_added
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_message_added_activity();

CREATE OR REPLACE FUNCTION public.trg_tag_added_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tag_name TEXT;
BEGIN
  SELECT name INTO _tag_name FROM public.tags WHERE id = NEW.tag_id;
  PERFORM public.log_ticket_activity(NEW.ticket_id, 'tag_added', jsonb_build_object('tag', _tag_name));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_tag_added
  AFTER INSERT ON public.ticket_tags
  FOR EACH ROW EXECUTE FUNCTION public.trg_tag_added_activity();

CREATE OR REPLACE FUNCTION public.trg_tag_removed_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tag_name TEXT;
BEGIN
  SELECT name INTO _tag_name FROM public.tags WHERE id = OLD.tag_id;
  PERFORM public.log_ticket_activity(OLD.ticket_id, 'tag_removed', jsonb_build_object('tag', _tag_name));
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_ticket_tag_removed
  AFTER DELETE ON public.ticket_tags
  FOR EACH ROW EXECUTE FUNCTION public.trg_tag_removed_activity();

-- ============================================================================
-- SLA: seed sensible defaults per organization and stamp due-dates on new
-- tickets based on the org's configured policy for that priority.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_default_sla_policies()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sla_policies (organization_id, priority, first_response_minutes, resolution_minutes) VALUES
    (NEW.id, 'High impact & high urgency (critical outage or many users blocked)', 30, 240),
    (NEW.id, 'High impact or high urgency (major function degraded or deadline risk)', 60, 480),
    (NEW.id, 'Moderate (single user or workaround available)', 240, 1440),
    (NEW.id, 'Low (minor issue or general inquiry)', 480, 4320)
  ON CONFLICT (organization_id, priority) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_created_seed_sla
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_sla_policies();

CREATE OR REPLACE FUNCTION public.trg_ticket_apply_sla()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _policy public.sla_policies%ROWTYPE;
BEGIN
  SELECT * INTO _policy FROM public.sla_policies
  WHERE organization_id = NEW.organization_id AND priority = NEW.priority;

  IF FOUND THEN
    NEW.sla_policy_id := _policy.id;
    NEW.first_response_due_at := NEW.created_at + make_interval(mins => _policy.first_response_minutes);
    NEW.resolution_due_at := NEW.created_at + make_interval(mins => _policy.resolution_minutes);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_apply_sla
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_apply_sla();

-- Mark tickets breached once their resolution due-date has passed without
-- being resolved/closed. Invoked on a schedule by pg_cron (see next migration).
CREATE OR REPLACE FUNCTION public.check_sla_breaches()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  UPDATE public.tickets
  SET sla_breached = true
  WHERE sla_breached = false
    AND resolution_due_at IS NOT NULL
    AND resolution_due_at < now()
    AND status NOT IN ('Resolved', 'Closed');

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.check_sla_breaches() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_sla_breaches() TO service_role;

-- ----------------------------------------------------------------------------
-- Backfill: seed SLA policies for organizations created before this
-- migration (the default org from the tickets migration), then stamp due
-- dates onto their existing tickets.
-- ----------------------------------------------------------------------------
INSERT INTO public.sla_policies (organization_id, priority, first_response_minutes, resolution_minutes)
SELECT o.id, p.priority, p.first_response_minutes, p.resolution_minutes
FROM public.organizations o
CROSS JOIN (VALUES
  ('High impact & high urgency (critical outage or many users blocked)', 30, 240),
  ('High impact or high urgency (major function degraded or deadline risk)', 60, 480),
  ('Moderate (single user or workaround available)', 240, 1440),
  ('Low (minor issue or general inquiry)', 480, 4320)
) AS p(priority, first_response_minutes, resolution_minutes)
ON CONFLICT (organization_id, priority) DO NOTHING;

UPDATE public.tickets t
SET sla_policy_id = sp.id,
    first_response_due_at = t.created_at + make_interval(mins => sp.first_response_minutes),
    resolution_due_at = t.created_at + make_interval(mins => sp.resolution_minutes)
FROM public.sla_policies sp
WHERE sp.organization_id = t.organization_id
  AND sp.priority = t.priority
  AND t.sla_policy_id IS NULL;
