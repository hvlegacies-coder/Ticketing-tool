-- ============================================================================
-- Tickets: multi-tenant columns, agent assignment, SLA timestamps, secure
-- client access token. Then backfill existing rows into a default org and
-- rewrite RLS so tickets are strictly scoped to organization membership.
-- ============================================================================

ALTER TABLE public.tickets
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN client_access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  ADD COLUMN first_response_due_at TIMESTAMPTZ,
  ADD COLUMN resolution_due_at TIMESTAMPTZ,
  ADD COLUMN first_responded_at TIMESTAMPTZ,
  ADD COLUMN resolved_at TIMESTAMPTZ,
  ADD COLUMN closed_at TIMESTAMPTZ,
  ADD COLUMN sla_breached BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tickets.assigned_to IS 'Legacy free-text assignee, superseded by assigned_to_user_id. Kept for display fallback on rows created before the multi-tenant migration.';

CREATE INDEX idx_tickets_organization ON public.tickets(organization_id);
CREATE INDEX idx_tickets_assigned_to_user ON public.tickets(assigned_to_user_id);

-- Second FK (see organization_members_user_id_profiles_fkey for why): lets
-- PostgREST auto-embed `assignee:profiles(full_name,email)` on ticket queries.
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_assigned_to_user_id_profiles_fkey
  FOREIGN KEY (assigned_to_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_tickets_client_access_token ON public.tickets(client_access_token);
CREATE INDEX idx_tickets_sla_breached ON public.tickets(sla_breached) WHERE sla_breached = true;

-- ----------------------------------------------------------------------------
-- Backfill: create a default organization owned by the earliest existing
-- support-staff profile (if any) and attach all pre-existing tickets to it,
-- so the current HigherView Legacies deployment keeps working unmodified.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  _default_owner UUID;
  _default_org UUID;
BEGIN
  SELECT id INTO _default_owner FROM public.profiles ORDER BY created_at ASC LIMIT 1;

  IF _default_owner IS NOT NULL THEN
    INSERT INTO public.organizations (name, slug, owner_id, support_email)
    VALUES ('HigherView Legacies', 'higherview', _default_owner, 'support@higherviewtaxesllc.com')
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO _default_org;

    IF _default_org IS NULL THEN
      SELECT id INTO _default_org FROM public.organizations WHERE slug = 'higherview';
    END IF;

    UPDATE public.tickets SET organization_id = _default_org WHERE organization_id IS NULL;

    -- Backfill every other existing profile as an admin of the default org
    -- so no current support-staff account loses dashboard access.
    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT _default_org, p.id, 'admin'
    FROM public.profiles p
    WHERE p.id <> _default_owner
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- RLS: tickets — replace the old "any authenticated user sees everything"
-- policies with organization-membership scoping.
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can submit tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON public.tickets;

-- The organizations table has no anon SELECT policy (by design — see
-- migration 1), so a plain EXISTS subquery against it here would always be
-- empty for the anon role and this check would silently reject every public
-- ticket submission. Route it through a SECURITY DEFINER function instead,
-- same pattern as is_org_member()/has_org_role().
CREATE OR REPLACE FUNCTION public.organization_exists(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id);
$$;

REVOKE ALL ON FUNCTION public.organization_exists(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.organization_exists(UUID) TO anon, authenticated;

CREATE POLICY "Anyone can submit tickets to a real organization"
  ON public.tickets FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.organization_exists(organization_id)
  );

CREATE POLICY "Org members can view their organization's tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Agents, admins and owners can update tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']));

CREATE POLICY "Owners and admins can delete tickets"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- Client (unauthenticated) access to a single ticket is now handled through
-- the get_ticket_by_token()/send_client_message() RPCs added in a later
-- migration — there is intentionally no anon SELECT policy on this table.

-- ----------------------------------------------------------------------------
-- Track resolved_at/closed_at automatically when status changes, and stamp
-- first_responded_at the first time an agent replies (used by SLA reporting).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'Closed' AND OLD.status <> 'Closed' THEN
      NEW.resolved_at := COALESCE(NEW.resolved_at, now());
      NEW.closed_at := now();
    ELSIF NEW.status = 'Resolved' AND OLD.status <> 'Resolved' THEN
      NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_ticket_status_change
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_status_change();
