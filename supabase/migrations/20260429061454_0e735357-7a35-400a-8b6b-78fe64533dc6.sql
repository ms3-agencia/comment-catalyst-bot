ALTER TABLE public.pdf_customizations
  ADD COLUMN IF NOT EXISTS header_alignment text NOT NULL DEFAULT 'left',
  ADD COLUMN IF NOT EXISTS header_show_date boolean NOT NULL DEFAULT true;