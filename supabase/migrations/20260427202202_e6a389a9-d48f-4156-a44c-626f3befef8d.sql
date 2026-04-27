CREATE TABLE public.video_editor_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id)
);

CREATE INDEX idx_video_editor_drafts_user ON public.video_editor_drafts(user_id);
CREATE INDEX idx_video_editor_drafts_content ON public.video_editor_drafts(content_id);

ALTER TABLE public.video_editor_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own drafts"
ON public.video_editor_drafts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own drafts"
ON public.video_editor_drafts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own drafts"
ON public.video_editor_drafts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own drafts"
ON public.video_editor_drafts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all drafts"
ON public.video_editor_drafts FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_video_editor_drafts_updated_at
BEFORE UPDATE ON public.video_editor_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();