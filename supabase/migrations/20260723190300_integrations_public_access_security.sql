-- ============================================================================
-- Per-organization integration settings (Monday.com + AI assistant config),
-- secure token-based public access for the client ticket portal, and a
-- scheduled SLA breach sweep. This migration also closes the pre-existing
-- security hole where any anonymous visitor could read or post messages on
-- ANY ticket by guessing/copying its UUID.
-- ============================================================================

CREATE TABLE public.organization_integrations (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  monday_api_token TEXT,
  monday_board_id TEXT,
  monday_group_id TEXT,
  ai_chat_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_system_prompt_override TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_organization_integrations_updated_at
  BEFORE UPDATE ON public.organization_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS enabled with NO policies for anon/authenticated: this table holds a
-- secret API token, so it is only ever touched via the SECURITY DEFINER
-- RPCs below (which enforce owner/admin role checks themselves) or by
-- service_role from edge functions (service_role bypasses RLS entirely).
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_org_integration_settings(_org_id UUID)
RETURNS TABLE(
  monday_configured BOOLEAN,
  monday_board_id TEXT,
  monday_group_id TEXT,
  ai_chat_enabled BOOLEAN,
  ai_system_prompt_override TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_org_role(_org_id, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT (oi.monday_api_token IS NOT NULL AND oi.monday_api_token <> ''),
           oi.monday_board_id, oi.monday_group_id, oi.ai_chat_enabled, oi.ai_system_prompt_override
    FROM public.organization_integrations oi
    WHERE oi.organization_id = _org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_org_integration_settings(
  _org_id UUID,
  _monday_api_token TEXT,
  _monday_board_id TEXT,
  _monday_group_id TEXT,
  _ai_chat_enabled BOOLEAN,
  _ai_system_prompt_override TEXT
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_org_role(_org_id, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.organization_integrations
    (organization_id, monday_api_token, monday_board_id, monday_group_id, ai_chat_enabled, ai_system_prompt_override)
  VALUES
    (_org_id, NULLIF(_monday_api_token, ''), _monday_board_id, _monday_group_id, _ai_chat_enabled, _ai_system_prompt_override)
  ON CONFLICT (organization_id) DO UPDATE SET
    -- blank token in the update means "leave the stored token unchanged"
    -- so the admin UI never has to redisplay or resubmit the secret.
    monday_api_token = COALESCE(NULLIF(EXCLUDED.monday_api_token, ''), public.organization_integrations.monday_api_token),
    monday_board_id = EXCLUDED.monday_board_id,
    monday_group_id = EXCLUDED.monday_group_id,
    ai_chat_enabled = EXCLUDED.ai_chat_enabled,
    ai_system_prompt_override = EXCLUDED.ai_system_prompt_override,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_integration_settings(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_integration_settings(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.upsert_org_integration_settings(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_org_integration_settings(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- ============================================================================
-- Public org branding lookup (for the /support/:slug portal), returning only
-- non-sensitive fields for a single organization at a time.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_org_public_profile(_slug TEXT)
RETURNS TABLE(id UUID, name TEXT, slug TEXT, logo_url TEXT, brand_color TEXT, support_email TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug, o.logo_url, o.brand_color, o.support_email
  FROM public.organizations o
  WHERE o.slug = _slug;
$$;

REVOKE ALL ON FUNCTION public.get_org_public_profile(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_public_profile(TEXT) TO anon, authenticated;

-- ============================================================================
-- Secure client ticket portal: token-gated RPCs replace direct table access.
-- The client_access_token is an unguessable 40-char random string emailed/
-- linked only to the ticket's submitter, so knowing it *is* the authorization
-- check — unlike the previous design where any UUID (visible in the URL/
-- browser history/referrer) granted full read/write on that ticket's thread.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ticket_by_token(_token TEXT)
RETURNS TABLE(
  id UUID, issue_title TEXT, issue_description TEXT, issue_category TEXT, priority TEXT,
  status TEXT, department TEXT, affected_system TEXT, client_full_name TEXT, company_name TEXT,
  email TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, attachments TEXT[],
  organization_id UUID, organization_name TEXT, organization_slug TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, t.issue_title, t.issue_description, t.issue_category, t.priority, t.status,
         t.department, t.affected_system, t.client_full_name, t.company_name, t.email,
         t.created_at, t.updated_at, t.attachments, t.organization_id, o.name, o.slug
  FROM public.tickets t
  JOIN public.organizations o ON o.id = t.organization_id
  WHERE t.client_access_token = _token;
$$;

REVOKE ALL ON FUNCTION public.get_ticket_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_ticket_messages_by_token(_token TEXT)
RETURNS SETOF public.chat_messages
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cm.* FROM public.chat_messages cm
  JOIN public.tickets t ON t.id = cm.ticket_id
  WHERE t.client_access_token = _token
  ORDER BY cm.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_ticket_messages_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_messages_by_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_client_message_by_token(_token TEXT, _sender_name TEXT, _sender_email TEXT, _message TEXT)
RETURNS public.chat_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ticket_id UUID;
  _row public.chat_messages%ROWTYPE;
BEGIN
  IF length(trim(coalesce(_message, ''))) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  SELECT id INTO _ticket_id FROM public.tickets WHERE client_access_token = _token;
  IF _ticket_id IS NULL THEN
    RAISE EXCEPTION 'Invalid ticket link';
  END IF;

  INSERT INTO public.chat_messages (ticket_id, sender_type, sender_name, sender_email, message)
  VALUES (_ticket_id, 'client', COALESCE(NULLIF(trim(_sender_name), ''), 'Client'), _sender_email, trim(_message))
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.send_client_message_by_token(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_client_message_by_token(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Lock down chat_messages: drop the old blanket anon/"true" policies and
-- replace with organization-membership scoping for staff. Anonymous clients
-- no longer touch this table directly at all — only through the RPCs above.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anon can view messages by ticket" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.chat_messages;

CREATE POLICY "Org members can view ticket messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = chat_messages.ticket_id AND public.is_org_member(t.organization_id)
  ));

CREATE POLICY "Agents+ can send ticket messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = chat_messages.ticket_id
      AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin', 'agent'])
  ));

CREATE POLICY "Agents+ can mark messages read"
  ON public.chat_messages FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = chat_messages.ticket_id
      AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin', 'agent'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t WHERE t.id = chat_messages.ticket_id
      AND public.has_org_role(t.organization_id, ARRAY['owner', 'admin', 'agent'])
  ));

-- ============================================================================
-- Scheduled SLA breach sweep (every 5 minutes)
-- ============================================================================
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'check-sla-breaches';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('check-sla-breaches', '*/5 * * * *', $$SELECT public.check_sla_breaches();$$);
