-- Branding settings table (single row per context)
CREATE TABLE public.branding_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context TEXT NOT NULL UNIQUE CHECK (context IN ('landing', 'pdf')),
  site_name TEXT NOT NULL DEFAULT 'CommentIQ',
  tagline TEXT,
  footer_text TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read branding"
ON public.branding_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage branding"
ON public.branding_settings FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_branding_settings_updated_at
BEFORE UPDATE ON public.branding_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.branding_settings (context, site_name, tagline, footer_text) VALUES
('landing', 'CommentIQ', 'Análise de Audiência com IA', '© 2026 CommentIQ. Todos os direitos reservados.'),
('pdf', 'CommentIQ', 'Análise de Audiência com IA', 'Gerado por CommentIQ — Análise inteligente de audiência');

-- Public storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, admin write
CREATE POLICY "Public can view branding assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'branding');

CREATE POLICY "Admins can upload branding assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update branding assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete branding assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'branding' AND public.has_role(auth.uid(), 'admin'));