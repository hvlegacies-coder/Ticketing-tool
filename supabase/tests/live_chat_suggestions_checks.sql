-- Verification for 20261020120000_live_chat_suggestions.sql.
-- Run against a NON-production project after `supabase db push`:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/live_chat_suggestions_checks.sql
-- Everything runs in one transaction and is rolled back.

BEGIN;

-- Fixtures: two orgs, one member each.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test.local');
INSERT INTO public.organizations (id, name, slug, owner_id) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Org A', 'check-org-a', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000b', 'Org B', 'check-org-b', '00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner')
ON CONFLICT DO NOTHING;

-- 1. Vote twice with the same email (different case) -> count 1.
DO $$
DECLARE _id UUID; _n INTEGER;
BEGIN
  _id := public.create_suggestion('check-org-a', 'Ann', 'ann@x.com', 'Dark mode', 'Please', 'App');
  PERFORM public.vote_suggestion(_id, 'voter@x.com');
  _n := public.vote_suggestion(_id, 'VOTER@x.com');
  ASSERT _n = 1, format('expected vote_count 1, got %s', _n);
END $$;

-- 2. Sixth suggestion within 24h from the same email -> rate_limited.
DO $$
DECLARE _raised BOOLEAN := false;
BEGIN
  FOR i IN 1..4 LOOP
    PERFORM public.create_suggestion('check-org-a', 'Ann', 'ann@x.com', 'Idea ' || i, 'd', 'Other');
  END LOOP;
  BEGIN
    PERFORM public.create_suggestion('check-org-a', 'Ann', 'ANN@x.com', 'Idea 6', 'd', 'Other');
  EXCEPTION WHEN raise_exception THEN
    _raised := SQLERRM = 'rate_limited';
  END;
  ASSERT _raised, 'expected rate_limited on 6th suggestion';
END $$;

-- 3. Public list excludes hidden rows and has no author_email column.
DO $$
DECLARE _hidden UUID; _cols TEXT;
BEGIN
  _hidden := public.create_suggestion('check-org-a', 'Bob', 'bob@x.com', 'Hidden one', 'd', 'App');
  UPDATE public.suggestions SET is_hidden = true WHERE id = _hidden;
  ASSERT NOT EXISTS (SELECT 1 FROM public.get_public_suggestions('check-org-a', 'top') WHERE id = _hidden),
    'hidden suggestion leaked into public list';
  SELECT string_agg(parameter_name, ',') INTO _cols
    FROM information_schema.parameters
   WHERE specific_name LIKE 'get_public_suggestions%' AND parameter_mode = 'OUT';
  ASSERT _cols NOT LIKE '%author_email%', 'public list exposes author_email';
END $$;

-- 4. A support reply clears agent_requested_at.
DO $$
DECLARE _t UUID := gen_random_uuid(); _v TIMESTAMPTZ;
BEGIN
  INSERT INTO public.tickets (id, organization_id, client_full_name, company_name, email, issue_title,
                              issue_category, issue_description, client_access_token, agent_requested_at)
  VALUES (_t, '00000000-0000-0000-0000-00000000000a', 'Cat', '—', 'cat@x.com', 'Live chat request',
          'Live Chat', 'transcript', encode(gen_random_bytes(20), 'hex'), now());
  INSERT INTO public.chat_messages (ticket_id, sender_type, sender_name, message)
  VALUES (_t, 'support', 'Agent', 'Hi!');
  SELECT agent_requested_at INTO _v FROM public.tickets WHERE id = _t;
  ASSERT _v IS NULL, 'agent_requested_at not cleared by support reply';
END $$;

-- 5. anon has no direct access to suggestions.
SET LOCAL ROLE anon;
DO $$
DECLARE _denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM 1 FROM public.suggestions LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN
    _denied := true;
  END;
  ASSERT _denied, 'anon can select from suggestions';
END $$;
RESET ROLE;

-- 6. Org B member cannot see Org A suggestions; moderators cannot edit content.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.suggestions WHERE organization_id = '00000000-0000-0000-0000-00000000000a'),
    'org B member can read org A suggestions';
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
DO $$
DECLARE _denied BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE public.suggestions SET title = 'edited' WHERE organization_id = '00000000-0000-0000-0000-00000000000a';
  EXCEPTION WHEN insufficient_privilege THEN
    _denied := true;
  END;
  ASSERT _denied, 'moderator could edit suggestion title';
END $$;
RESET ROLE;

\echo 'live_chat_suggestions_checks: all assertions passed'
ROLLBACK;
