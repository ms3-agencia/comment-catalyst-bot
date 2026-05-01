ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ebook_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;