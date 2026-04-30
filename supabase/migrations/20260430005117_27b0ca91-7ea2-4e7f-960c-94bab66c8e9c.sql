-- Permitir que usuários autenticados façam upload na PRÓPRIA pasta do bucket "branding"
-- (mantém políticas de admin existentes, que cobrem outros caminhos)

CREATE POLICY "Users upload own branding folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own branding folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own branding folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
