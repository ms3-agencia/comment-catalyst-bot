
CREATE TABLE IF NOT EXISTS public.pwa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'YCaptura',
  short_name text NOT NULL DEFAULT 'YCaptura',
  description text DEFAULT 'Sistema de geração de avatar com base nos comentários reais do YouTube.',
  theme_color text NOT NULL DEFAULT '#0a1019',
  background_color text NOT NULL DEFAULT '#0a1019',
  display text NOT NULL DEFAULT 'standalone',
  orientation text NOT NULL DEFAULT 'portrait',
  start_url text NOT NULL DEFAULT '/dashboard',
  scope text NOT NULL DEFAULT '/',
  lang text NOT NULL DEFAULT 'pt-BR',
  categories text[] NOT NULL DEFAULT ARRAY['productivity','business','social']::text[],
  icon_192_url text,
  icon_512_url text,
  apple_touch_icon_url text,
  maskable_icon_url text,
  splash_url text,
  splash_dark_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pwa_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pwa_settings" ON public.pwa_settings;
CREATE POLICY "Anyone can read pwa_settings"
  ON public.pwa_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage pwa_settings" ON public.pwa_settings;
CREATE POLICY "Admins manage pwa_settings"
  ON public.pwa_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.pwa_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.pwa_settings);

INSERT INTO storage.buckets (id, name, public)
VALUES ('pwa-assets', 'pwa-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read pwa-assets" ON storage.objects;
CREATE POLICY "Public read pwa-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pwa-assets');

DROP POLICY IF EXISTS "Admins write pwa-assets" ON storage.objects;
CREATE POLICY "Admins write pwa-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pwa-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update pwa-assets" ON storage.objects;
CREATE POLICY "Admins update pwa-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pwa-assets' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete pwa-assets" ON storage.objects;
CREATE POLICY "Admins delete pwa-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pwa-assets' AND public.has_role(auth.uid(), 'admin'::app_role));
