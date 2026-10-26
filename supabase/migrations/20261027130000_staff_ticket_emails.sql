-- Staff email notifications via the send-staff-ticket-email edge function:
--   new ticket          -> owners + admins ("new"), assignee ("assigned")
--   ticket (re)assigned -> the new assignee, unless they assigned it to themselves
-- Uses the same Vault secrets as the GHL webhook; missing secrets = silently skip.

CREATE OR REPLACE FUNCTION public.call_staff_ticket_email(_event TEXT, _ticket_id UUID)
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
    url := rtrim(_url, '/') || '/functions/v1/send-staff-ticket-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', _secret),
    body := jsonb_build_object('event', _event, 'ticket_id', _ticket_id)
  );
EXCEPTION WHEN OTHERS THEN
  -- Never block a ticket write because email plumbing failed.
  RAISE WARNING 'call_staff_ticket_email failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_staff_new_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.call_staff_ticket_email('new_ticket', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_staff_new_ticket
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_staff_new_ticket();

CREATE OR REPLACE FUNCTION public.notify_staff_ticket_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- No email when someone takes the ticket themselves.
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.assigned_to_user_id THEN
    RETURN NEW;
  END IF;
  PERFORM public.call_staff_ticket_email('assigned', NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_staff_ticket_assigned
  AFTER UPDATE OF assigned_to_user_id ON public.tickets
  FOR EACH ROW WHEN (NEW.assigned_to_user_id IS NOT NULL AND NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id)
  EXECUTE FUNCTION public.notify_staff_ticket_assigned();

REVOKE ALL ON FUNCTION public.call_staff_ticket_email(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_staff_new_ticket() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_staff_ticket_assigned() FROM PUBLIC, anon, authenticated;
