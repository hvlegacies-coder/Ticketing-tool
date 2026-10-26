-- Fix: in accept_my_pending_invitations the OUT column organization_id clashed with the
-- table column in ON CONFLICT (organization_id, user_id). Resolve names to columns.

CREATE OR REPLACE FUNCTION public.accept_my_pending_invitations()
RETURNS TABLE(organization_id UUID, slug TEXT, role TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  _email TEXT;
  _inv RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  -- Only confirmed emails can claim invitations addressed to them.
  SELECT u.email INTO _email FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
  IF _email IS NULL THEN
    RETURN;
  END IF;

  FOR _inv IN
    SELECT i.id, i.organization_id, i.role
      FROM public.organization_invitations i
     WHERE lower(i.email) = lower(_email) AND i.accepted_at IS NULL AND i.expires_at > now()
     ORDER BY i.created_at
  LOOP
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (_inv.organization_id, auth.uid(), _inv.role)
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    UPDATE public.organization_invitations SET accepted_at = now() WHERE id = _inv.id;

    organization_id := _inv.organization_id;
    role := _inv.role;
    SELECT o.slug INTO slug FROM public.organizations o WHERE o.id = _inv.organization_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_my_pending_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_my_pending_invitations() TO authenticated;
