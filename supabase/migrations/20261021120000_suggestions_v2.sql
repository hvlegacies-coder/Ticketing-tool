-- Suggestions v2: official responses, merge duplicates, similar-idea search,
-- and status-change emails to the author.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.suggestions
  ADD COLUMN staff_response TEXT CHECK (length(staff_response) <= 2000),
  ADD COLUMN responded_at TIMESTAMPTZ,
  ADD COLUMN merged_into UUID REFERENCES public.suggestions(id) ON DELETE SET NULL;

CREATE INDEX suggestions_title_trgm_idx ON public.suggestions USING gin (title gin_trgm_ops);

-- Moderators may also write the official response (still never the post itself).
GRANT UPDATE (staff_response) ON public.suggestions TO authenticated;

CREATE OR REPLACE FUNCTION public.stamp_suggestion_response()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.staff_response IS DISTINCT FROM OLD.staff_response THEN
    NEW.staff_response := NULLIF(trim(NEW.staff_response), '');
    NEW.responded_at := CASE WHEN NEW.staff_response IS NULL THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_suggestion_response
  BEFORE UPDATE OF staff_response ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_suggestion_response();

-- ============================================================================
-- Public list now carries the official response.
-- ============================================================================

DROP FUNCTION public.get_public_suggestions(TEXT, TEXT);
CREATE FUNCTION public.get_public_suggestions(_slug TEXT, _sort TEXT DEFAULT 'top')
RETURNS TABLE(
  id UUID, title TEXT, description TEXT, category TEXT, status TEXT,
  vote_count INTEGER, author_name TEXT, created_at TIMESTAMPTZ,
  staff_response TEXT, responded_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.title, s.description, s.category, s.status, s.vote_count, s.author_name, s.created_at,
         s.staff_response, s.responded_at
  FROM public.suggestions s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE o.slug = _slug AND NOT s.is_hidden
  ORDER BY
    CASE WHEN _sort = 'new' THEN NULL ELSE s.vote_count END DESC NULLS LAST,
    s.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.get_public_suggestions(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_suggestions(TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- Similar-idea search (public, no emails)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_similar_suggestions(_slug TEXT, _query TEXT)
RETURNS TABLE(id UUID, title TEXT, status TEXT, vote_count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.title, s.status, s.vote_count
  FROM public.suggestions s
  JOIN public.organizations o ON o.id = s.organization_id
  WHERE o.slug = _slug
    AND NOT s.is_hidden
    AND length(trim(_query)) >= 3
    AND (similarity(s.title, _query) > 0.2 OR s.title ILIKE '%' || trim(_query) || '%')
  ORDER BY similarity(s.title, _query) DESC, s.vote_count DESC
  LIMIT 3;
$$;

REVOKE ALL ON FUNCTION public.find_similar_suggestions(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_similar_suggestions(TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- Merge duplicates (owner/admin): move votes without double-counting a voter.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.merge_suggestion(_from UUID, _into UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _org UUID;
  _into_org UUID;
  _count INTEGER;
BEGIN
  IF _from = _into THEN
    RAISE EXCEPTION 'cannot_merge_into_self';
  END IF;
  SELECT organization_id INTO _org FROM public.suggestions WHERE id = _from;
  SELECT organization_id INTO _into_org FROM public.suggestions WHERE id = _into;
  IF _org IS NULL OR _into_org IS NULL OR _org <> _into_org THEN
    RAISE EXCEPTION 'suggestion_not_found';
  END IF;
  IF NOT public.has_org_role(_org, ARRAY['owner', 'admin']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- suggestion_vote_count fires only for rows actually inserted.
  INSERT INTO public.suggestion_votes (suggestion_id, voter_email)
  SELECT _into, voter_email FROM public.suggestion_votes WHERE suggestion_id = _from
  ON CONFLICT DO NOTHING;

  UPDATE public.suggestions SET is_hidden = true, merged_into = _into WHERE id = _from;

  SELECT vote_count INTO _count FROM public.suggestions WHERE id = _into;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_suggestion(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_suggestion(UUID, UUID) TO authenticated;

-- ============================================================================
-- Status-change email -> send-suggestion-status-email edge function (pg_net)
-- Reuses the project_url / notify_webhook_secret Vault secrets.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_suggestion_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _url TEXT;
  _secret TEXT;
BEGIN
  SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO _secret FROM vault.decrypted_secrets WHERE name = 'notify_webhook_secret';
  IF _url IS NULL OR _secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := rtrim(_url, '/') || '/functions/v1/send-suggestion-status-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', _secret),
    body := jsonb_build_object('suggestion_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a status change because the email plumbing failed.
  RAISE WARNING 'notify_suggestion_status failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_suggestion_status
  AFTER UPDATE OF status ON public.suggestions
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_suggestion_status();

REVOKE ALL ON FUNCTION public.notify_suggestion_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_suggestion_response() FROM PUBLIC, anon, authenticated;
