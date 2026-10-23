-- Verification for 20261024120000_track_ticket.sql (runs in a transaction, rolled back).
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/track_ticket_checks.sql

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'tt-owner-a@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'tt-owner-b@test.local');
INSERT INTO public.organizations (id, name, slug, owner_id) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'TT Org A', 'tt-org-a', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000b', 'TT Org B', 'tt-org-b', '00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.tickets (id, organization_id, client_full_name, company_name, email, issue_title,
                            issue_category, issue_description, client_access_token, status)
VALUES ('1a2b3c4d-0000-4000-8000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Ann', '—', 'ann@x.com',
        'Secret title', 'Other', 'secret', encode(extensions.gen_random_bytes(20), 'hex'), 'In Progress');

-- 1. Finds the ticket by its number, tolerant of #, spaces and case.
DO $$
BEGIN
  ASSERT (SELECT status FROM public.track_ticket('tt-org-a', ' #1a2B 3c4D ')) = 'In Progress', 'lookup by number failed';
  ASSERT (SELECT ticket_ref FROM public.track_ticket('tt-org-a', '1A2B3C4D')) = '1A2B3C4D', 'ticket_ref not normalized';
  ASSERT (SELECT NOT team_replied FROM public.track_ticket('tt-org-a', '1A2B3C4D')), 'team_replied should be false';
END $$;

-- 2. Team reply is reflected.
INSERT INTO public.chat_messages (ticket_id, sender_type, sender_name, message)
VALUES ('1a2b3c4d-0000-4000-8000-000000000001', 'support', 'Agent', 'On it');
DO $$
BEGIN
  ASSERT (SELECT team_replied FROM public.track_ticket('tt-org-a', '1A2B3C4D')), 'team_replied should be true';
END $$;

-- 3. Another org's portal can't find it; malformed numbers return nothing.
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.track_ticket('tt-org-b', '1A2B3C4D')), 'cross-org lookup leaked';
  ASSERT NOT EXISTS (SELECT 1 FROM public.track_ticket('tt-org-a', '1A2B')), 'short ref matched';
  ASSERT NOT EXISTS (SELECT 1 FROM public.track_ticket('tt-org-a', '%')), 'wildcard matched';
END $$;

-- 4. No title, name, or email columns are exposed.
DO $$
DECLARE _cols TEXT;
BEGIN
  SELECT string_agg(parameter_name, ',') INTO _cols
    FROM information_schema.parameters
   WHERE specific_name LIKE 'track_ticket%' AND parameter_mode = 'OUT';
  ASSERT _cols !~ '(title|name|email|description|token)', 'track_ticket exposes sensitive columns: ' || _cols;
END $$;

\echo 'track_ticket_checks: all assertions passed'
ROLLBACK;
