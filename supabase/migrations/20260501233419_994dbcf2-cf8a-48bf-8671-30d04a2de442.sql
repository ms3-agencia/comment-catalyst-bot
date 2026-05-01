ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_ebook_config_id UUID NULL;