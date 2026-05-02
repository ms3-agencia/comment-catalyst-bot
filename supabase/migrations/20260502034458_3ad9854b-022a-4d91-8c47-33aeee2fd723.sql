ALTER TABLE public.generated_contents
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS video_provider TEXT,
  ADD COLUMN IF NOT EXISTS video_status TEXT;

CREATE INDEX IF NOT EXISTS idx_generated_contents_video_url
  ON public.generated_contents(user_id)
  WHERE video_url IS NOT NULL;