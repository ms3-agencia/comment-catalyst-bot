CREATE POLICY "Anyone can read active packages public"
ON public.credit_packages FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "Anyone can read plan_configs public"
ON public.plan_configs FOR SELECT
TO anon
USING (true);