-- Verification for 20261027120000_accept_pending_invitations.sql (one transaction, rolled back).
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/accept_pending_invitations_checks.sql

BEGIN;

INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'api-owner@test.local', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'API-Agent@test.local', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'api-unconfirmed@test.local', NULL),
  ('00000000-0000-0000-0000-0000000000a4', 'api-stranger@test.local', now());
INSERT INTO public.organizations (id, name, slug, owner_id) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'API Org', 'api-org', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.organization_invitations (organization_id, email, role, expires_at) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'api-agent@test.local', 'agent', now() + interval '7 days'),
  ('00000000-0000-0000-0000-00000000000a', 'api-unconfirmed@test.local', 'agent', now() + interval '7 days');

SET LOCAL ROLE authenticated;

-- 1. Invited, confirmed user (email case differs) joins with the invited role.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
DO $$
DECLARE _n INT;
BEGIN
  SELECT count(*) INTO _n FROM public.accept_my_pending_invitations() WHERE slug = 'api-org' AND role = 'agent';
  ASSERT _n = 1, 'invited agent did not join';
  ASSERT (SELECT count(*) FROM public.accept_my_pending_invitations()) = 0, 'second call should accept nothing';
END $$;

-- 2. Unconfirmed email can't claim its invitation.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.accept_my_pending_invitations()) = 0, 'unconfirmed user joined';
END $$;

-- 3. A user with no invitation joins nothing.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.accept_my_pending_invitations()) = 0, 'stranger joined';
END $$;
RESET ROLE;

DO $$
BEGIN
  ASSERT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = '00000000-0000-0000-0000-0000000000a2'
                 AND organization_id = '00000000-0000-0000-0000-00000000000a' AND role = 'agent'), 'membership missing';
  ASSERT (SELECT accepted_at IS NOT NULL FROM public.organization_invitations WHERE email = 'api-agent@test.local'), 'invite not marked accepted';
  ASSERT NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id IN ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4')),
    'uninvited/unconfirmed user became a member';
  ASSERT NOT has_function_privilege('anon', 'public.accept_my_pending_invitations()', 'EXECUTE'), 'anon can call it';
END $$;

\echo 'accept_pending_invitations_checks: all assertions passed'
ROLLBACK;
