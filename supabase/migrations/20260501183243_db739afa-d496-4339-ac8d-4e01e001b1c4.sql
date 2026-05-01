DROP POLICY IF EXISTS "Users manage own ebook configs" ON public.ebook_configs;
DROP POLICY IF EXISTS "Admins view all ebook configs" ON public.ebook_configs;

CREATE POLICY "Admins manage ebook configs"
ON public.ebook_configs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read admin ebook configs"
ON public.ebook_configs
FOR SELECT
TO authenticated
USING (public.has_role(user_id, 'admin'));
