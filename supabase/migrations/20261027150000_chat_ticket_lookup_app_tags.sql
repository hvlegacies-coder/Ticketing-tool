-- 1. Booking link shown in the support chat while a looked-up ticket is still open.
-- 2. Ticket overview for the support chatbot (customer types their ticket number).
-- 3. Auto-tag new tickets with the app they're about.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS booking_url TEXT
  CHECK (booking_url IS NULL OR booking_url ~* '^https?://');

-- Called only by the support-chat edge function (service role), which is
-- rate limited per IP. Returns what the AI needs to summarize the ticket:
-- no customer email, phone, or internal notes.
CREATE OR REPLACE FUNCTION public.chat_ticket_overview(_org UUID, _ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _r TEXT := lower(regexp_replace(coalesce(_ref, ''), '[^0-9A-Fa-f]', '', 'g'));
  _t public.tickets%ROWTYPE;
BEGIN
  IF length(_r) <> 8 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _t FROM public.tickets
  WHERE organization_id = _org AND left(id::text, 8) = _r
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'ref', upper(_r),
    'status', _t.status,
    'title', _t.issue_title,
    'category', _t.issue_category,
    'description', left(_t.issue_description, 1500),
    'created_at', _t.created_at,
    'updated_at', _t.updated_at,
    'messages', coalesce((
      SELECT jsonb_agg(jsonb_build_object('from', m.sender_type, 'text', left(m.message, 500), 'at', m.created_at) ORDER BY m.created_at)
      FROM (
        SELECT sender_type, message, created_at FROM public.chat_messages
        WHERE ticket_id = _t.id
        ORDER BY created_at DESC
        LIMIT 30
      ) m
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.chat_ticket_overview(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_ticket_overview(UUID, TEXT) TO service_role;

-- Keyword match on the ticket text. The chatbot is told to name the app in
-- the ticket summary, so AI-created tickets match reliably.
-- ponytail: keyword match, move to an AI-picked app field if tags come out wrong.
CREATE OR REPLACE FUNCTION public.auto_tag_ticket_app()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _text TEXT := lower(concat_ws(' ', NEW.issue_title, NEW.issue_description, NEW.issue_category, NEW.affected_system));
  _app RECORD;
  _tag UUID;
BEGIN
  FOR _app IN
    SELECT * FROM (VALUES
      ('Referral Circle', '#10b981', _text ~ 'referral'),
      ('Contract Workspace', '#8b5cf6', _text ~ '(contract|countersign|signing link)'),
      ('TaxPractice', '#f59e0b', _text ~ 'tax ?-?practice')
    ) AS a(name, color, hit)
    WHERE hit
  LOOP
    INSERT INTO public.tags (organization_id, name, color)
    VALUES (NEW.organization_id, _app.name, _app.color)
    ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO _tag;
    INSERT INTO public.ticket_tags (ticket_id, tag_id) VALUES (NEW.id, _tag) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_tag_ticket_app() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS auto_tag_ticket_app ON public.tickets;
CREATE TRIGGER auto_tag_ticket_app
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.auto_tag_ticket_app();

-- Same booking page the chatbot already offers for demos.
UPDATE public.organizations
SET booking_url = 'https://www.mazecrm.com/booking-calendar'
WHERE name = 'Higher View Legacy' AND booking_url IS NULL;
