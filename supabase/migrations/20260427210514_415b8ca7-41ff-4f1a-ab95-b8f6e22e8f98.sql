-- Enable required extensions for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cleanup function: removes stale drafts and old versions
CREATE OR REPLACE FUNCTION public.cleanup_video_editor_drafts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _drafts_deleted INTEGER := 0;
  _versions_deleted INTEGER := 0;
  _idem_deleted INTEGER := 0;
BEGIN
  -- 1. Delete drafts not updated in 90 days
  WITH d AS (
    DELETE FROM public.video_editor_drafts
    WHERE updated_at < now() - interval '90 days'
    RETURNING id
  )
  SELECT count(*) INTO _drafts_deleted FROM d;

  -- 2. Delete draft versions older than 60 days
  WITH v AS (
    DELETE FROM public.video_editor_draft_versions
    WHERE created_at < now() - interval '60 days'
    RETURNING id
  )
  SELECT count(*) INTO _versions_deleted FROM v;

  -- 3. Keep only the latest 20 versions per (user_id, content_id) pair
  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY user_id, content_id
             ORDER BY created_at DESC
           ) AS rn
    FROM public.video_editor_draft_versions
  ),
  pruned AS (
    DELETE FROM public.video_editor_draft_versions
    WHERE id IN (SELECT id FROM ranked WHERE rn > 20)
    RETURNING id
  )
  SELECT _versions_deleted + count(*) INTO _versions_deleted FROM pruned;

  -- 4. Cleanup expired idempotency keys (housekeeping)
  WITH i AS (
    DELETE FROM public.idempotency_keys
    WHERE expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO _idem_deleted FROM i;

  RETURN jsonb_build_object(
    'success', true,
    'drafts_deleted', _drafts_deleted,
    'versions_deleted', _versions_deleted,
    'idempotency_keys_deleted', _idem_deleted,
    'ran_at', now()
  );
END;
$$;

-- Allow admins to trigger cleanup manually
CREATE OR REPLACE FUNCTION public.admin_run_draft_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can run cleanup';
  END IF;
  RETURN public.cleanup_video_editor_drafts();
END;
$$;

-- Schedule daily cleanup at 03:30 UTC (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-video-editor-drafts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-video-editor-drafts',
  '30 3 * * *',
  $$ SELECT public.cleanup_video_editor_drafts(); $$
);

-- Helpful indexes for cleanup performance
CREATE INDEX IF NOT EXISTS idx_video_editor_drafts_updated_at
  ON public.video_editor_drafts (updated_at);

CREATE INDEX IF NOT EXISTS idx_video_editor_draft_versions_created_at
  ON public.video_editor_draft_versions (created_at);

CREATE INDEX IF NOT EXISTS idx_video_editor_draft_versions_user_content_created
  ON public.video_editor_draft_versions (user_id, content_id, created_at DESC);