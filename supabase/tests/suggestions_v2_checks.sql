-- Verification for 20261021120000_suggestions_v2.sql.
-- Run against a NON-production project after `supabase db push`:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/suggestions_v2_checks.sql
-- Everything runs in one transaction and is rolled back.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test.local');
INSERT INTO public.organizations (id, name, slug, owner_id) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Org A', 'v2-org-a', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000b', 'Org B', 'v2-org-b', '00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE ids AS
SELECT public.create_suggestion('v2-org-a', 'Ann', 'ann@x.com', 'Dark mode please', 'd', 'App') AS keep_id,
       public.create_suggestion('v2-org-a', 'Bob', 'bob@x.com', 'Add dark mode', 'd', 'App') AS dup_id;
GRANT SELECT ON ids TO authenticated, anon;

SELECT public.vote_suggestion(keep_id, 'shared@x.com') FROM ids;
SELECT public.vote_suggestion(dup_id, 'shared@x.com') FROM ids;
SELECT public.vote_suggestion(dup_id, 'only-dup@x.com') FROM ids;

-- 1. anon cannot merge or trigger emails; similar search exposes no email.
DO $$
DECLARE _cols TEXT;
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.merge_suggestion(uuid,uuid)', 'EXECUTE'),
    'anon can execute merge_suggestion';
  ASSERT NOT has_function_privilege('anon', 'public.notify_suggestion_status()', 'EXECUTE'),
    'anon can execute notify_suggestion_status';
  SELECT string_agg(parameter_name, ',') INTO _cols
    FROM information_schema.parameters
   WHERE specific_name LIKE 'find_similar_suggestions%' AND parameter_mode = 'OUT';
  ASSERT _cols NOT LIKE '%email%', 'find_similar_suggestions exposes an email column';
END $$;

-- 2. Similar search finds the near-duplicate title.
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.find_similar_suggestions('v2-org-a', 'dark mode')) >= 2,
    'similar search missed dark-mode suggestions';
  ASSERT (SELECT count(*) FROM public.find_similar_suggestions('v2-org-a', 'da')) = 0,
    'similar search should ignore queries shorter than 3 chars';
END $$;

-- 3. Org B owner cannot merge Org A suggestions.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
DO $$
DECLARE _denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.merge_suggestion(dup_id, keep_id) FROM ids;
  EXCEPTION WHEN raise_exception THEN
    _denied := SQLERRM = 'Not authorized';
  END;
  ASSERT _denied, 'org B owner merged org A suggestions';
END $$;

-- 4. Merge moves votes without double-counting a shared voter, hides the duplicate.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
DO $$
DECLARE _count INTEGER;
BEGIN
  SELECT public.merge_suggestion(dup_id, keep_id) INTO _count FROM ids;
  ASSERT _count = 2, format('expected 2 votes after merge (shared voter once), got %s', _count);
END $$;

-- 5. Staff response is stamped; moderators still cannot edit the title.
DO $$
DECLARE _at TIMESTAMPTZ; _denied BOOLEAN := false;
BEGIN
  UPDATE public.suggestions SET staff_response = 'Shipping next month' WHERE id = (SELECT keep_id FROM ids);
  SELECT responded_at INTO _at FROM public.suggestions WHERE id = (SELECT keep_id FROM ids);
  ASSERT _at IS NOT NULL, 'responded_at not stamped';
  BEGIN
    UPDATE public.suggestions SET title = 'edited' WHERE id = (SELECT keep_id FROM ids);
  EXCEPTION WHEN insufficient_privilege THEN
    _denied := true;
  END;
  ASSERT _denied, 'moderator could edit title';
END $$;
RESET ROLE;

DO $$
BEGIN
  ASSERT (SELECT is_hidden AND merged_into = (SELECT keep_id FROM ids) FROM public.suggestions WHERE id = (SELECT dup_id FROM ids)),
    'duplicate not hidden / merged_into not set';
  ASSERT NOT EXISTS (SELECT 1 FROM public.get_public_suggestions('v2-org-a', 'top') WHERE id = (SELECT dup_id FROM ids)),
    'merged duplicate still public';
END $$;

\echo 'suggestions_v2_checks: all assertions passed'
ROLLBACK;
