-- Verification for 20261026120000_routing_end_chat.sql (one transaction, rolled back).
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/routing_end_chat_checks.sql

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'rt-owner@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'rt-les@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'rt-genil@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'rt-other-owner@test.local');
INSERT INTO public.organizations (id, name, slug, owner_id) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'RT Org A', 'rt-org-a', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000000b', 'RT Org B', 'rt-org-b', '00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'agent'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'agent'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE mk (n int);
CREATE OR REPLACE FUNCTION pg_temp.new_ticket(_org uuid, _team text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE _id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.tickets (id, organization_id, client_full_name, company_name, email, issue_title,
                              issue_category, issue_description, client_access_token, team_key)
  VALUES (_id, _org, 'C', '—', 'c@x.com', 't', 'Other', 'd', encode(extensions.gen_random_bytes(20), 'hex'), _team);
  RETURN _id;
END $$;

-- 1. New orgs get the 4 default teams.
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.routing_teams WHERE organization_id = '00000000-0000-0000-0000-00000000000a') = 4,
    'default teams not seeded';
END $$;

-- 2. Team with no members -> org owner.
DO $$
DECLARE _t uuid;
BEGIN
  _t := pg_temp.new_ticket('00000000-0000-0000-0000-00000000000a', 'apps');
  ASSERT (SELECT assigned_to_user_id FROM public.tickets WHERE id = _t) = '00000000-0000-0000-0000-0000000000a1',
    'empty team should fall back to owner';
END $$;

-- 3. Least-busy member wins; load alternates between Les and Genil.
INSERT INTO public.routing_team_members (team_id, user_id)
SELECT id, u FROM public.routing_teams,
  (VALUES ('00000000-0000-0000-0000-0000000000a2'::uuid), ('00000000-0000-0000-0000-0000000000a3'::uuid)) v(u)
WHERE organization_id = '00000000-0000-0000-0000-00000000000a' AND key = 'ghl';
DO $$
DECLARE _a uuid; _b uuid; _c uuid; _t uuid;
BEGIN
  -- Create first, then read: a volatile insert function in WHERE would run once per scanned row.
  _t := pg_temp.new_ticket('00000000-0000-0000-0000-00000000000a', 'ghl');
  SELECT assigned_to_user_id INTO _a FROM public.tickets WHERE id = _t;
  _t := pg_temp.new_ticket('00000000-0000-0000-0000-00000000000a', 'ghl');
  SELECT assigned_to_user_id INTO _b FROM public.tickets WHERE id = _t;
  ASSERT _a <> _b, 'two tickets went to the same agent while the other was idle';
  ASSERT _a IN ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3'), 'assigned outside team';
  -- Resolve everything of _a; the next ticket must go to _a (fewest open).
  UPDATE public.tickets SET status = 'Resolved' WHERE assigned_to_user_id = _a;
  _t := pg_temp.new_ticket('00000000-0000-0000-0000-00000000000a', 'ghl');
  SELECT assigned_to_user_id INTO _c FROM public.tickets WHERE id = _t;
  ASSERT _c = _a, 'least-busy agent not chosen';
END $$;

-- 4. Unknown team key is cleared and left unassigned; anon cannot pick an assignee.
DO $$
DECLARE _t uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.tickets (id, organization_id, client_full_name, company_name, email, issue_title,
                              issue_category, issue_description, client_access_token, team_key, assigned_to_user_id)
  VALUES (_t, '00000000-0000-0000-0000-00000000000a', 'C', '—', 'c@x.com', 't', 'Other', 'd',
          encode(extensions.gen_random_bytes(20), 'hex'), 'nope', '00000000-0000-0000-0000-0000000000b1');
  ASSERT (SELECT team_key IS NULL AND assigned_to_user_id IS NULL FROM public.tickets WHERE id = _t),
    'unknown team or anon-chosen assignee was kept';
END $$;

-- 5. Ending a chat: wrong token rejected; right token ends it and clears waiting; client message reopens.
DO $$
DECLARE _t uuid; _tok text;
BEGIN
  _t := pg_temp.new_ticket('00000000-0000-0000-0000-00000000000a', NULL);
  UPDATE public.tickets SET agent_requested_at = now() WHERE id = _t;
  SELECT client_access_token INTO _tok FROM public.tickets WHERE id = _t;
  ASSERT NOT public.end_chat_by_token('wrong-token'), 'wrong token ended a chat';
  ASSERT public.end_chat_by_token(_tok), 'valid token did not end chat';
  ASSERT (SELECT chat_ended_at IS NOT NULL AND agent_requested_at IS NULL FROM public.tickets WHERE id = _t),
    'chat not ended or still waiting';
  PERFORM public.send_client_message_by_token(_tok, 'C', 'c@x.com', 'back again');
  ASSERT (SELECT chat_ended_at IS NULL FROM public.tickets WHERE id = _t), 'client message did not reopen chat';
END $$;

-- 6. Access: anon can't read routing tables; org B owner can't see org A teams or add a non-member.
DO $$
BEGIN
  ASSERT NOT has_table_privilege('anon', 'public.routing_teams', 'SELECT'), 'anon can read routing_teams';
  ASSERT has_function_privilege('anon', 'public.end_chat_by_token(text)', 'EXECUTE'), 'anon cannot end chats';
  ASSERT NOT has_function_privilege('anon', 'public.assign_ticket_to_team()', 'EXECUTE'), 'anon can call assign trigger fn';
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
DO $$
DECLARE _denied boolean := false;
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM public.routing_teams WHERE organization_id = '00000000-0000-0000-0000-00000000000a'),
    'org B owner sees org A teams';
  BEGIN
    INSERT INTO public.routing_team_members (team_id, user_id)
    SELECT id, '00000000-0000-0000-0000-0000000000b1' FROM public.routing_teams
     WHERE organization_id = '00000000-0000-0000-0000-00000000000b' AND key = 'ghl';
    -- own org: allowed. Now try putting org A's agent on org B's team:
    INSERT INTO public.routing_team_members (team_id, user_id)
    SELECT id, '00000000-0000-0000-0000-0000000000a2' FROM public.routing_teams
     WHERE organization_id = '00000000-0000-0000-0000-00000000000b' AND key = 'apps';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    _denied := true;
  END;
  ASSERT _denied, 'non-member was added to a team';
END $$;
RESET ROLE;

\echo 'routing_end_chat_checks: all assertions passed'
ROLLBACK;
