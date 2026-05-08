-- Fix email_confirmation_tokens: only store token_hash; allow null/duplicate plaintext
ALTER TABLE public.email_confirmation_tokens
  ALTER COLUMN token DROP NOT NULL;

ALTER TABLE public.email_confirmation_tokens
  DROP CONSTRAINT IF EXISTS email_confirmation_tokens_token_key;

DROP INDEX IF EXISTS public.idx_email_confirmation_tokens_token;

-- Admin RPC: confirma email do usuário direto pelo painel
CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can confirm user emails';
  END IF;

  UPDATE auth.users
     SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
         confirmed_at = COALESCE(confirmed_at, now()),
         updated_at = now()
   WHERE id = _user_id;
END;
$$;