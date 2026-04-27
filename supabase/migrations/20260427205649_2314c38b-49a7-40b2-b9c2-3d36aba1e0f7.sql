-- Snapshots history of the video editor draft
CREATE TABLE public.video_editor_draft_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  label TEXT,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vedv_user_content_created
  ON public.video_editor_draft_versions (user_id, content_id, created_at DESC);

ALTER TABLE public.video_editor_draft_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own draft versions"
  ON public.video_editor_draft_versions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all draft versions"
  ON public.video_editor_draft_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own draft versions"
  ON public.video_editor_draft_versions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own draft versions"
  ON public.video_editor_draft_versions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Keep only the 20 most recent versions per (user, content)
CREATE OR REPLACE FUNCTION public.prune_video_editor_draft_versions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.video_editor_draft_versions
  WHERE id IN (
    SELECT id FROM public.video_editor_draft_versions
    WHERE user_id = NEW.user_id AND content_id = NEW.content_id
    ORDER BY created_at DESC
    OFFSET 20
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prune_video_editor_draft_versions
AFTER INSERT ON public.video_editor_draft_versions
FOR EACH ROW
EXECUTE FUNCTION public.prune_video_editor_draft_versions();