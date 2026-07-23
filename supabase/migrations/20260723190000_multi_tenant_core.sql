-- ============================================================================
-- Multi-tenant core: organizations, membership, invitations, RBAC helpers
-- ============================================================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  brand_color TEXT NOT NULL DEFAULT '#B8860B',
  support_email TEXT,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON public.organizations(slug);

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);

-- Second FK on the same column, pointing at profiles(id) instead of
-- auth.users(id). profiles.id is always == auth.users.id (see
-- handle_new_user()), so this is always consistent — it exists purely so
-- PostgREST can auto-embed `profiles(full_name, email)` off of
-- organization_members for team/assignee UI without a manual join.
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- profiles was created single-tenant (only self-select). Org co-members
-- need to see each other's display name for assignment pickers, the team
-- page, etc.
CREATE POLICY "Org co-members can view each other's profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m1
      JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
    )
  );

-- ----------------------------------------------------------------------------
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'viewer')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX idx_org_invitations_email ON public.organization_invitations(lower(email));

-- ============================================================================
-- RBAC helper functions (security definer so RLS policies can call them
-- without recursive-RLS issues on organization_members itself)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_org_role(_org_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = _org_id AND user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id UUID, _roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = auth.uid() AND role = ANY(_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.get_org_role(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_role(UUID, UUID) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, anon;
REVOKE ALL ON FUNCTION public.has_org_role(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, TEXT[]) TO authenticated, anon;

-- ============================================================================
-- RLS: organizations
-- ============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Note: there is deliberately no anon/blanket SELECT policy here. Exposing
-- the whole organizations table to anon would let anyone enumerate every
-- tenant on the platform. The public support portal instead looks up a
-- single org's non-sensitive branding fields via get_org_public_profile()
-- (SECURITY DEFINER, added in a later migration), scoped to one slug at a time.
-- owner_id is checked directly (not just is_org_member) so the creator can
-- read back their own org row immediately on INSERT ... RETURNING, without
-- depending on the AFTER INSERT trigger that creates their membership row
-- having already been visible to that same RETURNING projection.
CREATE POLICY "Org members can view their organization"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR public.is_org_member(id));

CREATE POLICY "Authenticated users can create an organization"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins can update their organization"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.has_org_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_org_role(id, ARRAY['owner', 'admin']));

CREATE POLICY "Owners can delete their organization"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (public.has_org_role(id, ARRAY['owner']));

-- ============================================================================
-- RLS: organization_members
-- ============================================================================

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view fellow members of their orgs"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

-- Bootstrap: the org creator becomes owner (handled by trigger below), and
-- owners/admins can add members afterwards (e.g. when accepting an invite,
-- via the accept_invitation() RPC which runs as SECURITY DEFINER).
CREATE POLICY "Owners and admins can add members"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Owners and admins can change member roles"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Owners and admins can remove members"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- Auto-create the owner membership whenever a new organization is created.
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- ============================================================================
-- RLS: organization_invitations
-- ============================================================================

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view invitations"
  ON public.organization_invitations FOR SELECT
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Owners and admins can create invitations"
  ON public.organization_invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Owners and admins can revoke invitations"
  ON public.organization_invitations FOR DELETE
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

-- Accepting an invitation: looks up the invite by token (bypasses RLS via
-- SECURITY DEFINER since the invitee is not yet a member of the org) and
-- creates the membership atomically. Safe because it only trusts the token,
-- checks expiry/acceptance, and matches on the caller's own auth.uid().
CREATE OR REPLACE FUNCTION public.accept_invitation(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _invite public.organization_invitations%ROWTYPE;
  _caller_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to accept an invitation';
  END IF;

  SELECT * INTO _invite FROM public.organization_invitations WHERE token = _token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF _invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already used';
  END IF;
  IF _invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  SELECT email INTO _caller_email FROM auth.users WHERE id = auth.uid();
  IF _caller_email IS NULL OR lower(_caller_email) <> lower(_invite.email) THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_invite.organization_id, auth.uid(), _invite.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.organization_invitations SET accepted_at = now() WHERE id = _invite.id;

  RETURN _invite.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;

-- Public (unauthenticated) read of a single invitation by token, so the
-- invite-accept page can show "You've been invited to join X" before login.
CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token TEXT)
RETURNS TABLE(organization_name TEXT, email TEXT, role TEXT, expires_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.name, i.email, i.role, i.expires_at, i.accepted_at
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = _token;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(TEXT) TO authenticated, anon;
