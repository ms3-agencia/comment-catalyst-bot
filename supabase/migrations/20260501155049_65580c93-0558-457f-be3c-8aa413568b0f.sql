-- Tabela de rate limiting para fluxos de autenticação
CREATE TABLE public.auth_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_auth_rate_limits_lookup
  ON public.auth_rate_limits (identifier, action, attempted_at DESC);

CREATE INDEX idx_auth_rate_limits_cleanup
  ON public.auth_rate_limits (attempted_at);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view auth rate limits"
  ON public.auth_rate_limits FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Função para checar e registrar tentativa atomicamente
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(
  _identifier TEXT,
  _action TEXT,
  _max_attempts INTEGER,
  _window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
  _oldest TIMESTAMPTZ;
  _retry_after INTEGER;
BEGIN
  IF _identifier IS NULL OR length(trim(_identifier)) = 0 THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  SELECT count(*), min(attempted_at)
    INTO _count, _oldest
  FROM public.auth_rate_limits
  WHERE identifier = lower(_identifier)
    AND action = _action
    AND attempted_at > now() - make_interval(secs => _window_seconds);

  IF _count >= _max_attempts THEN
    _retry_after := GREATEST(
      EXTRACT(EPOCH FROM (_oldest + make_interval(secs => _window_seconds) - now()))::INTEGER,
      1
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'error_code', 'rate_limit_exceeded',
      'message', format('Muitas tentativas. Aguarde %s segundos antes de tentar novamente.', _retry_after),
      'retry_after_seconds', _retry_after,
      'attempts', _count,
      'limit', _max_attempts
    );
  END IF;

  -- Registra tentativa
  INSERT INTO public.auth_rate_limits (identifier, action)
  VALUES (lower(_identifier), _action);

  RETURN jsonb_build_object(
    'allowed', true,
    'attempts', _count + 1,
    'limit', _max_attempts
  );
END;
$$;

-- Função de limpeza (registros > 24h)
CREATE OR REPLACE FUNCTION public.cleanup_auth_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  WITH d AS (
    DELETE FROM public.auth_rate_limits
    WHERE attempted_at < now() - interval '24 hours'
    RETURNING id
  )
  SELECT count(*) INTO _deleted FROM d;
  RETURN _deleted;
END;
$$;