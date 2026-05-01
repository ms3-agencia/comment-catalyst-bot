
-- Drop existing policies on ebook_configs
DROP POLICY IF EXISTS "Admins manage ebook configs" ON public.ebook_configs;
DROP POLICY IF EXISTS "Authenticated read admin ebook configs" ON public.ebook_configs;

-- Admins manage all ebook_configs (theirs + global templates)
CREATE POLICY "Admins manage all ebook configs"
ON public.ebook_configs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Anyone authenticated can read templates created by admins (global) or their own
CREATE POLICY "Read global or own ebook configs"
ON public.ebook_configs
FOR SELECT
TO authenticated
USING (
  public.has_role(user_id, 'admin'::app_role)
  OR auth.uid() = user_id
);

-- Users with ebook-premium add-on can manage (insert/update/delete) their own templates
CREATE POLICY "Premium users insert own ebook configs"
ON public.ebook_configs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.user_has_addon(auth.uid(), 'ebook-premium')
);

CREATE POLICY "Premium users update own ebook configs"
ON public.ebook_configs
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.user_has_addon(auth.uid(), 'ebook-premium')
)
WITH CHECK (
  auth.uid() = user_id
  AND public.user_has_addon(auth.uid(), 'ebook-premium')
);

CREATE POLICY "Premium users delete own ebook configs"
ON public.ebook_configs
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.user_has_addon(auth.uid(), 'ebook-premium')
);
