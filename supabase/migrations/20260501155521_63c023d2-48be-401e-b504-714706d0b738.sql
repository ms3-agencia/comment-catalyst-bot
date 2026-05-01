-- 1) Coluna de hash + unicidade
ALTER TABLE public.email_confirmation_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Backfill: token_hash a partir do token atual (em texto)
UPDATE public.email_confirmation_tokens
   SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL AND token IS NOT NULL;

-- Zera o token em claro existente (não é mais necessário guardar)
UPDATE public.email_confirmation_tokens
   SET token = ''
 WHERE token <> '';

-- token_hash agora é obrigatório e único
ALTER TABLE public.email_confirmation_tokens
  ALTER COLUMN token_hash SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND indexname='email_confirmation_tokens_token_hash_key'
  ) THEN
    CREATE UNIQUE INDEX email_confirmation_tokens_token_hash_key
      ON public.email_confirmation_tokens (token_hash);
  END IF;
END $$;

-- Índice de housekeeping
CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_cleanup
  ON public.email_confirmation_tokens (expires_at, used_at);

-- 2) Bloqueio explícito de qualquer escrita via API (anon/authenticated).
--    Sem políticas INSERT/UPDATE/DELETE => RLS já barra; reforçamos com policies "false".
DROP POLICY IF EXISTS "No client inserts on email tokens" ON public.email_confirmation_tokens;
CREATE POLICY "No client inserts on email tokens"
  ON public.email_confirmation_tokens FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No client updates on email tokens" ON public.email_confirmation_tokens;
CREATE POLICY "No client updates on email tokens"
  ON public.email_confirmation_tokens FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on email tokens" ON public.email_confirmation_tokens;
CREATE POLICY "No client deletes on email tokens"
  ON public.email_confirmation_tokens FOR DELETE
  TO anon, authenticated
  USING (false);

-- Garante que anon NÃO veja nada (a policy de SELECT existente é só para admin).
-- (Mantida a policy "Admins can view confirmation tokens".)

-- 3) Consumo atômico: única chamada que valida + marca used_at
CREATE OR REPLACE FUNCTION public.confirm_email_token_consume(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash TEXT;
  _row RECORD;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'invalid_token');
  END IF;

  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  -- UPDATE atômico: só consome se ainda não foi usado e não expirou.
  UPDATE public.email_confirmation_tokens
     SET used_at = now()
   WHERE token_hash = _hash
     AND used_at IS NULL
     AND expires_at > now()
   RETURNING id, user_id, email
     INTO _row;

  IF _row.id IS NULL THEN
    -- Não diferencia "não existe" / "já usado" / "expirado" para o cliente,
    -- mas internamente conseguimos checar para retornar expired_token quando útil.
    IF EXISTS (
      SELECT 1 FROM public.email_confirmation_tokens
       WHERE token_hash = _hash AND expires_at <= now() AND used_at IS NULL
    ) THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'expired_token');
    END IF;
    RETURN jsonb_build_object('success', false, 'error_code', 'invalid_token');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _row.user_id,
    'email', _row.email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_email_token_consume(TEXT) FROM PUBLIC, anon, authenticated;
-- Apenas service_role poderá executar via edge function.
GRANT EXECUTE ON FUNCTION public.confirm_email_token_consume(TEXT) TO service_role;

-- 4) Limpeza periódica
CREATE OR REPLACE FUNCTION public.cleanup_email_confirmation_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _deleted INTEGER;
BEGIN
  WITH d AS (
    DELETE FROM public.email_confirmation_tokens
     WHERE (used_at IS NOT NULL AND used_at < now() - interval '7 days')
        OR (expires_at < now() - interval '30 days')
    RETURNING id
  )
  SELECT count(*) INTO _deleted FROM d;
  RETURN _deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_email_confirmation_tokens() FROM PUBLIC, anon, authenticated;