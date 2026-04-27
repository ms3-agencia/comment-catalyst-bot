
CREATE TABLE IF NOT EXISTS public.audio_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'music',
  title text NOT NULL,
  author text,
  license text DEFAULT 'CC0',
  mood text,
  duration_seconds integer,
  url text NOT NULL,
  preview_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated reads active audio_library"
  ON public.audio_library FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage audio_library"
  ON public.audio_library FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-library', 'audio-library', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read audio-library"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-library');

CREATE POLICY "Auth upload audio-library own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audio-library'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Auth update audio-library own folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'audio-library'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Auth delete audio-library own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'audio-library'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
  );

INSERT INTO public.video_providers (kind, provider, display_name, enabled, weight, config)
SELECT 'tts', 'browser_tts', 'Voz do navegador (grátis)', true, 100,
  '{"description":"Usa Web Speech API do navegador. Sem custo, qualidade básica."}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.video_providers WHERE kind='tts' AND provider='browser_tts'
);
