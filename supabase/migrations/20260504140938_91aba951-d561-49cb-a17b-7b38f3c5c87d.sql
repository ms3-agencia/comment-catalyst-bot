-- Função pública para buscar a site_key do Cloudflare Turnstile (não-secreta)
-- Retorna NULL se não estiver configurada (Turnstile fica desabilitado nesse caso).
CREATE OR REPLACE FUNCTION public.get_turnstile_site_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_settings
  WHERE key = 'turnstile_site_key'
    AND value IS NOT NULL
    AND length(trim(value)) > 0
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_turnstile_site_key() TO anon, authenticated;