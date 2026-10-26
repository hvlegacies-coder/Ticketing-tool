-- Verification for 20261027130000_staff_ticket_emails.sql (one transaction, rolled back).
-- Vault secrets are hidden inside the transaction so no real HTTP call is queued;
-- call_staff_ticket_email is swapped for a recorder to see what would be sent.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/staff_ticket_emails_checks.sql

BEGIN;

CREATE TEMP TABLE sent (event text, ticket_id uuid);
GRANT ALL ON sent TO authenticated;
CREATE OR REPLACE FUNCTION public.call_staff_ticket_email(_event TEXT, _ticket_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$ INSERT INTO pg_temp.sent VALUES (_event, _ticket_id); $$;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'se-owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'se-agent@test.local');
INSERT INTO public.organizations (id, name, slug, owner_id) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'SE Org', 'se-org', '00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'agent')
ON CONFLICT DO NOTHING;

INSERT INTO public.tickets (id, organization_id, client_full_name, company_name, email, issue_title,
                            issue_category, issue_description, client_access_token)
VALUES ('5e000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-00000000000a', 'C', '-', 'c@x.com',
        't', 'Other', 'd', encode(extensions.gen_random_bytes(20), 'hex'));

-- 1. A new ticket queues exactly one new_ticket email job.
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pg_temp.sent WHERE event = 'new_ticket') = 1, 'new ticket did not queue one email';
  ASSERT (SELECT count(*) FROM pg_temp.sent WHERE event = 'assigned') = 0, 'insert queued an assigned email';
END $$;

-- 2. Owner assigns it to the agent -> one assigned email.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
UPDATE public.tickets SET assigned_to_user_id = '00000000-0000-0000-0000-0000000000a2'
 WHERE id = '5e000000-0000-4000-8000-000000000001';
-- 3. Re-saving the same assignee doesn't email again.
UPDATE public.tickets SET assigned_to_user_id = '00000000-0000-0000-0000-0000000000a2', status = 'Open'
 WHERE id = '5e000000-0000-4000-8000-000000000001';
-- 4. Owner takes the ticket themselves -> no email.
UPDATE public.tickets SET assigned_to_user_id = '00000000-0000-0000-0000-0000000000a1'
 WHERE id = '5e000000-0000-4000-8000-000000000001';
RESET ROLE;

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pg_temp.sent WHERE event = 'assigned') = 1,
    format('expected 1 assigned email, got %s', (SELECT count(*) FROM pg_temp.sent WHERE event = 'assigned'));
  ASSERT NOT has_function_privilege('anon', 'public.call_staff_ticket_email(text,uuid)', 'EXECUTE'), 'anon can trigger staff emails';
END $$;

\echo 'staff_ticket_emails_checks: all assertions passed'
ROLLBACK;
