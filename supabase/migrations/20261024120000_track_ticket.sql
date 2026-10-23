-- Public "Track ticket": status-only lookup by the 8-character ticket number
-- shown in confirmation emails (first 8 hex chars of the ticket id).
-- Deliberately returns no title, name, email, or messages: those stay behind
-- the private /t/<token> chat link.

CREATE OR REPLACE FUNCTION public.track_ticket(_slug TEXT, _ticket_ref TEXT)
RETURNS TABLE(ticket_ref TEXT, status TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, team_replied BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ref TEXT := lower(regexp_replace(coalesce(_ticket_ref, ''), '[^0-9A-Fa-f]', '', 'g'));
BEGIN
  IF length(_ref) <> 8 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT upper(left(t.id::text, 8)),
           t.status,
           t.created_at,
           t.updated_at,
           EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.ticket_id = t.id AND m.sender_type = 'support')
    FROM public.tickets t
    JOIN public.organizations o ON o.id = t.organization_id
    WHERE o.slug = _slug AND left(t.id::text, 8) = _ref
    ORDER BY t.created_at DESC
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.track_ticket(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_ticket(TEXT, TEXT) TO anon, authenticated;
