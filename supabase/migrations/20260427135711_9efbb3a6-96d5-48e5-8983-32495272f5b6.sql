
ALTER TABLE public.generated_contents
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_prompt TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-images', 'content-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view content images" ON storage.objects;
CREATE POLICY "Anyone can view content images"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-images');

DROP POLICY IF EXISTS "Authenticated users can upload content images" ON storage.objects;
CREATE POLICY "Authenticated users can upload content images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-images');

DROP POLICY IF EXISTS "Users can delete own content images" ON storage.objects;
CREATE POLICY "Users can delete own content images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'content-images' AND auth.uid()::text = (storage.foldername(name))[1]);

INSERT INTO public.credit_action_costs (action_key, display_name, cost, description)
VALUES ('generate_content_image', 'Gerar imagem do conteúdo', 3, 'Gera uma imagem com IA para um conteúdo')
ON CONFLICT (action_key) DO NOTHING;
