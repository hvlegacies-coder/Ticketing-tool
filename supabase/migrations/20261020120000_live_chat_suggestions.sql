-- Live chat handoff, GoHighLevel webhook triggers, and the suggestions forum.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- Live chat handoff
-- ============================================================================

ALTER TABLE public.tickets ADD COLUMN agent_requested_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.clear_agent_requested_on_support_reply()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.tickets
     SET agent_requested_at = NULL
   WHERE id = NEW.ticket_id AND agent_requested_at IS NOT NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clear_agent_requested_on_support_reply
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW WHEN (NEW.sender_type = 'support')
  EXECUTE FUNCTION public.clear_agent_requested_on_support_reply();

-- Staff bell listens for ticket updates (agent_requested_at) in realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
  END IF;
END;
$$;

-- ============================================================================
-- GoHighLevel webhook URL (per org)
-- ============================================================================

ALTER TABLE public.organization_integrations
  ADD COLUMN ghl_webhook_url TEXT CHECK (ghl_webhook_url ~ '^https://');

DROP FUNCTION public.get_org_integration_settings(UUID);
CREATE FUNCTION public.get_org_integration_settings(_org_id UUID)
RETURNS TABLE(
  monday_configured BOOLEAN,
  monday_board_id TEXT,
  monday_group_id TEXT,
  ai_chat_enabled BOOLEAN,
  ai_system_prompt_override TEXT,
  ghl_webhook_url TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_org_role(_org_id, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT (oi.monday_api_token IS NOT NULL AND oi.monday_api_token <> ''),
           oi.monday_board_id, oi.monday_group_id, oi.ai_chat_enabled, oi.ai_system_prompt_override,
           oi.ghl_webhook_url
    FROM public.organization_integrations oi
    WHERE oi.organization_id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_integration_settings(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_integration_settings(UUID) TO authenticated;

DROP FUNCTION public.upsert_org_integration_settings(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT);
CREATE FUNCTION public.upsert_org_integration_settings(
  _org_id UUID,
  _monday_api_token TEXT,
  _monday_board_id TEXT,
  _monday_group_id TEXT,
  _ai_chat_enabled BOOLEAN,
  _ai_system_prompt_override TEXT,
  _ghl_webhook_url TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_org_role(_org_id, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.organization_integrations
    (organization_id, monday_api_token, monday_board_id, monday_group_id, ai_chat_enabled,
     ai_system_prompt_override, ghl_webhook_url)
  VALUES
    (_org_id, NULLIF(_monday_api_token, ''), _monday_board_id, _monday_group_id, _ai_chat_enabled,
     _ai_system_prompt_override, NULLIF(_ghl_webhook_url, ''))
  ON CONFLICT (organization_id) DO UPDATE SET
    -- blank token in the update means "leave the stored token unchanged"
    monday_api_token = COALESCE(NULLIF(EXCLUDED.monday_api_token, ''), public.organization_integrations.monday_api_token),
    monday_board_id = EXCLUDED.monday_board_id,
    monday_group_id = EXCLUDED.monday_group_id,
    ai_chat_enabled = EXCLUDED.ai_chat_enabled,
    ai_system_prompt_override = EXCLUDED.ai_system_prompt_override,
    ghl_webhook_url = EXCLUDED.ghl_webhook_url,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_org_integration_settings(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_org_integration_settings(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- Webhook triggers -> notify-webhook edge function (via pg_net)
-- Needs two Vault secrets: project_url, notify_webhook_secret. Missing either
-- = silently skip, so chat never breaks on webhook setup.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.call_notify_webhook(_event TEXT, _ticket_id UUID, _message_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _url TEXT;
  _secret TEXT;
BEGIN
  SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'notify_webhook_secret';
  IF _url IS NULL OR _secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(_url, '/') || '/functions/v1/notify-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', _secret),
    body := jsonb_build_object('event', _event, 'ticket_id', _ticket_id, 'message_id', _message_id)
  );
EXCEPTION WHEN OTHERS THEN
  -- Never block a ticket or message write because the webhook plumbing failed.
  RAISE WARNING 'call_notify_webhook failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.call_notify_webhook(TEXT, UUID, UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notify_ghl_agent_requested()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.call_notify_webhook('agent_requested', NEW.id, NULL);
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_ghl_agent_requested_insert
  AFTER INSERT ON public.tickets
  FOR EACH ROW WHEN (NEW.agent_requested_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_ghl_agent_requested();

CREATE TRIGGER notify_ghl_agent_requested_update
  AFTER UPDATE OF agent_requested_at ON public.tickets
  FOR EACH ROW WHEN (OLD.agent_requested_at IS NULL AND NEW.agent_requested_at IS NOT NULL)
  EXECUTE FUNCTION public.notify_ghl_agent_requested();

CREATE OR REPLACE FUNCTION public.notify_ghl_client_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.call_notify_webhook('client_message', NEW.ticket_id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_ghl_client_message
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW WHEN (NEW.sender_type = 'client')
  EXECUTE FUNCTION public.notify_ghl_client_message();

-- ============================================================================
-- Suggestions forum
-- ============================================================================

CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL CHECK (length(author_name) BETWEEN 1 AND 100),
  author_email TEXT NOT NULL CHECK (author_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 140),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 4000),
  category TEXT NOT NULL CHECK (category IN ('App', 'System', 'Service', 'Other')),
  status TEXT NOT NULL DEFAULT 'Under review'
    CHECK (status IN ('Under review', 'Planned', 'In progress', 'Done', 'Declined')),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX suggestions_org_idx ON public.suggestions (organization_id, created_at DESC);

CREATE TABLE public.suggestion_votes (
  suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  voter_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, voter_email)
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view suggestions" ON public.suggestions FOR SELECT
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent', 'viewer']));

CREATE POLICY "Agents+ can moderate suggestions" ON public.suggestions FOR UPDATE
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner', 'admin', 'agent']));

CREATE POLICY "Admins can delete suggestions" ON public.suggestions FOR DELETE
  TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner', 'admin']));

CREATE POLICY "Org members can view suggestion votes" ON public.suggestion_votes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suggestions s
     WHERE s.id = suggestion_votes.suggestion_id
       AND public.has_org_role(s.organization_id, ARRAY['owner', 'admin', 'agent', 'viewer'])
  ));

REVOKE ALL ON public.suggestions, public.suggestion_votes FROM anon;
-- Moderators may only change status and visibility, never the post content.
REVOKE UPDATE ON public.suggestions FROM authenticated;
GRANT UPDATE (status, is_hidden) ON public.suggestions TO authenticated;

CREATE OR REPLACE FUNCTION public.suggestion_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.suggestions SET vote_count = vote_count + 1 WHERE id = NEW.suggestion_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER suggestion_vote_count
  AFTER INSERT ON public.suggestion_votes
  FOR EACH ROW EXECUTE FUNCTION public.suggestion_vote_count();

CREATE OR REPLACE FUNCTION public.suggestion_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM public.suggestions
     WHERE organization_id = NEW.organization_id
       AND lower(author_email) = lower(NEW.author_email)
       AND created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER suggestion_rate_limit
  BEFORE INSERT ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.suggestion_rate_limit();

CREATE OR REPLACE FUNCTION public.get_public_suggestions(_slug TEXT, _sort TEXT DEFAULT 'top')
RETURNS TABLE(
  id UUID, title TEXT, description TEXT, category TEXT, status TEXT,
  vote_count INTEGER, author_name TEXT, created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.title, s.description, s.category, s.status, s.vote_count, s.author_name, s.created_at
  FROM public.suggestions s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE o.slug = _slug AND NOT s.is_hidden
  ORDER BY
    CASE WHEN _sort = 'new' THEN NULL ELSE s.vote_count END DESC NULLS LAST,
    s.created_at DESC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.create_suggestion(
  _slug TEXT, _name TEXT, _email TEXT, _title TEXT, _description TEXT, _category TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _id UUID;
BEGIN
  SELECT id INTO _org_id FROM public.organizations WHERE slug = _slug;
  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  INSERT INTO public.suggestions (organization_id, author_name, author_email, title, description, category)
  VALUES (_org_id, trim(_name), lower(trim(_email)), trim(_title), trim(_description), _category)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vote_suggestion(_id UUID, _email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  IF _email IS NULL OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suggestions WHERE id = _id AND NOT is_hidden) THEN
    RAISE EXCEPTION 'suggestion_not_found';
  END IF;

  INSERT INTO public.suggestion_votes (suggestion_id, voter_email)
  VALUES (_id, lower(trim(_email)))
  ON CONFLICT DO NOTHING;

  SELECT vote_count INTO _count FROM public.suggestions WHERE id = _id;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_suggestions(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_suggestions(TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.create_suggestion(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_suggestion(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.vote_suggestion(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_suggestion(UUID, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.suggestion_vote_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suggestion_rate_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_agent_requested_on_support_reply() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_ghl_agent_requested() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_ghl_client_message() FROM PUBLIC;
