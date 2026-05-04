
-- 1) Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  actor_id UUID,
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id   ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action    ON public.audit_log(action);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log"     ON public.audit_log;
DROP POLICY IF EXISTS "System inserts audit log"  ON public.audit_log;

CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT só via SECURITY DEFINER function (sem policy de INSERT direto)

-- 2) Tabela de eventos de login
CREATE TABLE IF NOT EXISTS public.login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_fingerprint TEXT,
  is_new_device BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_id    ON public.login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON public.login_events(created_at DESC);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own login events" ON public.login_events;
DROP POLICY IF EXISTS "Admins read all login events" ON public.login_events;

CREATE POLICY "Users read own login events"
  ON public.login_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all login events"
  ON public.login_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Função: verificar lockout (5 falhas em 15 min => bloqueio de 30 min)
CREATE OR REPLACE FUNCTION public.check_login_lockout(_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _failed_count INTEGER;
  _last_attempt TIMESTAMPTZ;
  _lockout_until TIMESTAMPTZ;
  _retry_after INTEGER;
BEGIN
  IF _identifier IS NULL OR length(trim(_identifier)) = 0 THEN
    RETURN jsonb_build_object('locked', false);
  END IF;

  SELECT count(*), max(attempted_at)
    INTO _failed_count, _last_attempt
  FROM public.auth_rate_limits
  WHERE identifier = lower(_identifier)
    AND action = 'login_failed'
    AND attempted_at > now() - interval '15 minutes';

  IF _failed_count >= 5 THEN
    _lockout_until := _last_attempt + interval '30 minutes';
    IF now() < _lockout_until THEN
      _retry_after := GREATEST(EXTRACT(EPOCH FROM (_lockout_until - now()))::INTEGER, 1);
      RETURN jsonb_build_object(
        'locked', true,
        'retry_after_seconds', _retry_after,
        'failed_attempts', _failed_count,
        'message', format('Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em %s minutos.',
                          GREATEST(1, ROUND(_retry_after::numeric / 60)))
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('locked', false, 'failed_attempts', COALESCE(_failed_count, 0));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_login_lockout(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_login_lockout(TEXT) TO authenticated;

-- 4) Função: registrar tentativa falha (consome rate limit)
CREATE OR REPLACE FUNCTION public.record_login_failure(_identifier TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _identifier IS NULL OR length(trim(_identifier)) = 0 THEN RETURN; END IF;
  INSERT INTO public.auth_rate_limits (identifier, action)
  VALUES (lower(_identifier), 'login_failed');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_login_failure(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_login_failure(TEXT) TO authenticated, anon;

-- 5) Função: registrar evento de login (sucesso/falha) e detectar novo dispositivo
CREATE OR REPLACE FUNCTION public.record_login_event(
  _user_id UUID,
  _email   TEXT,
  _success BOOLEAN,
  _ip      TEXT,
  _ua      TEXT,
  _fingerprint TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_new BOOLEAN := false;
  _seen   INTEGER := 0;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_user');
  END IF;

  IF _success AND _fingerprint IS NOT NULL THEN
    SELECT count(*) INTO _seen
    FROM public.login_events
    WHERE user_id = _user_id
      AND success = true
      AND device_fingerprint = _fingerprint
      AND created_at > now() - interval '180 days';

    IF _seen = 0 THEN _is_new := true; END IF;
  END IF;

  INSERT INTO public.login_events (
    user_id, email, success, ip_address, user_agent, device_fingerprint, is_new_device
  ) VALUES (
    _user_id, lower(coalesce(_email,'')), _success, _ip, _ua, _fingerprint, _is_new
  );

  RETURN jsonb_build_object('success', true, 'is_new_device', _is_new);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_login_event(UUID, TEXT, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_login_event(UUID, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

-- 6) Função: log de auditoria (qualquer usuário autenticado pode registrar suas próprias ações)
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action      TEXT,
  _resource    TEXT DEFAULT NULL,
  _resource_id TEXT DEFAULT NULL,
  _metadata    JSONB DEFAULT '{}'::jsonb,
  _ip          TEXT DEFAULT NULL,
  _ua          TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF _action IS NULL OR length(trim(_action)) = 0 THEN
    RAISE EXCEPTION 'audit action is required';
  END IF;

  INSERT INTO public.audit_log (user_id, actor_id, action, resource, resource_id, metadata, ip_address, user_agent)
  VALUES (_uid, _uid, _action, _resource, _resource_id, COALESCE(_metadata, '{}'::jsonb), _ip, _ua)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_audit_event(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;
