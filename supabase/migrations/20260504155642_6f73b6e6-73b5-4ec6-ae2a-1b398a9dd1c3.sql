-- Tabela para registrar hostnames vistos pelo app (preview, produção, custom domain)
CREATE TABLE IF NOT EXISTS public.turnstile_hostnames (
  hostname text PRIMARY KEY,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  hits int NOT NULL DEFAULT 1,
  configured boolean NOT NULL DEFAULT false,
  last_error text,
  last_error_at timestamptz
);

ALTER TABLE public.turnstile_hostnames ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver/editar
CREATE POLICY "Admins manage turnstile hostnames"
ON public.turnstile_hostnames
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RPC pública para registrar hostname (qualquer visitante, mesmo anônimo)
CREATE OR REPLACE FUNCTION public.register_turnstile_hostname(_hostname text, _error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _hostname IS NULL OR length(trim(_hostname)) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.turnstile_hostnames (hostname, last_error, last_error_at)
  VALUES (
    lower(trim(_hostname)),
    _error,
    CASE WHEN _error IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (hostname) DO UPDATE SET
    last_seen = now(),
    hits = public.turnstile_hostnames.hits + 1,
    last_error = COALESCE(EXCLUDED.last_error, public.turnstile_hostnames.last_error),
    last_error_at = CASE WHEN EXCLUDED.last_error IS NOT NULL THEN now() ELSE public.turnstile_hostnames.last_error_at END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_turnstile_hostname(text, text) TO anon, authenticated;