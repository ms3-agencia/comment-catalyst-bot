-- Substitui a policy de DELETE para impedir que usuários removam templates de admins
DROP POLICY IF EXISTS "Customizers delete own ebook configs" ON public.ebook_configs;

CREATE POLICY "Customizers delete own ebook configs"
ON public.ebook_configs
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND NOT has_role(user_id, 'admin'::app_role)
  AND (
    user_has_addon(auth.uid(), 'ebook-premium'::text)
    OR user_has_addon(auth.uid(), 'ebook-template-customization'::text)
  )
);