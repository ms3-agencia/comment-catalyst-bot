ALTER TABLE public.pdf_customizations
ADD COLUMN IF NOT EXISTS brand_position text NOT NULL DEFAULT 'footer',
ADD COLUMN IF NOT EXISTS logo_alignment text NOT NULL DEFAULT 'left',
ADD COLUMN IF NOT EXISTS logo_size integer NOT NULL DEFAULT 48;