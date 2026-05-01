DROP POLICY IF EXISTS "Premium users insert own ebook configs" ON public.ebook_configs;
DROP POLICY IF EXISTS "Premium users update own ebook configs" ON public.ebook_configs;
DROP POLICY IF EXISTS "Premium users delete own ebook configs" ON public.ebook_configs;

CREATE POLICY "Customizers insert own ebook configs"
ON public.ebook_configs FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.user_has_addon(auth.uid(), 'ebook-premium')
    OR public.user_has_addon(auth.uid(), 'ebook-template-customization')
  )
);

CREATE POLICY "Customizers update own ebook configs"
ON public.ebook_configs FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  AND (
    public.user_has_addon(auth.uid(), 'ebook-premium')
    OR public.user_has_addon(auth.uid(), 'ebook-template-customization')
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.user_has_addon(auth.uid(), 'ebook-premium')
    OR public.user_has_addon(auth.uid(), 'ebook-template-customization')
  )
);

CREATE POLICY "Customizers delete own ebook configs"
ON public.ebook_configs FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND (
    public.user_has_addon(auth.uid(), 'ebook-premium')
    OR public.user_has_addon(auth.uid(), 'ebook-template-customization')
  )
);