CREATE TABLE IF NOT EXISTS public.video_render_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID,
  format_ratio TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  codec TEXT NOT NULL,
  container TEXT NOT NULL,
  bitrate_kbps INTEGER NOT NULL,
  duration_seconds NUMERIC NOT NULL DEFAULT 0,
  scenes_count INTEGER NOT NULL DEFAULT 0,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rendering',
  progress INTEGER NOT NULL DEFAULT 0,
  phase TEXT,
  message TEXT,
  file_size_bytes BIGINT,
  preset_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.video_render_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own render history"
ON public.video_render_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own render history"
ON public.video_render_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own render history"
ON public.video_render_history FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own render history"
ON public.video_render_history FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all render history"
ON public.video_render_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_video_render_history_updated_at
BEFORE UPDATE ON public.video_render_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_render_history_user_created
ON public.video_render_history (user_id, created_at DESC);