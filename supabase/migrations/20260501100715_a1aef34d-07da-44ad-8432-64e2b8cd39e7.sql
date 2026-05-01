-- 1) Audit log table
CREATE TABLE IF NOT EXISTS public.credit_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  actor_email TEXT,
  target_user_id UUID NOT NULL,
  target_email TEXT,
  operation TEXT NOT NULL CHECK (operation IN ('add','remove')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_audit_log_target ON public.credit_audit_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_actor ON public.credit_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_audit_log_created ON public.credit_audit_log(created_at DESC);

ALTER TABLE public.credit_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view credit audit log"
  ON public.credit_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies → only SECURITY DEFINER functions can write

-- 2) Update admin_add_credits to record audit entries
CREATE OR REPLACE FUNCTION public.admin_add_credits(_user_id uuid, _amount integer, _description text DEFAULT 'Ajuste manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_balance INTEGER;
  _current_balance INTEGER;
  _actor UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
BEGIN
  IF NOT public.has_role(_actor, 'admin') THEN
    RAISE EXCEPTION 'Only admins can add credits' USING ERRCODE = '42501';
  END IF;

  IF _amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount', 'message', 'O valor deve ser diferente de zero.');
  END IF;

  -- Lock the row (or create if missing) to compute the projected balance safely
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO _current_balance
  FROM public.user_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  -- Server-side guard: prevent negative balance on removal
  IF _amount < 0 AND (_current_balance + _amount) < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'message', 'Saldo insuficiente. O usuário possui apenas ' || _current_balance || ' créditos.',
      'balance', _current_balance,
      'requested', abs(_amount)
    );
  END IF;

  UPDATE public.user_credits
  SET balance = balance + _amount
  WHERE user_id = _user_id
  RETURNING balance INTO _new_balance;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (_user_id, _amount, CASE WHEN _amount > 0 THEN 'admin_adjustment' ELSE 'admin_debit' END, _description);

  -- Resolve emails for audit (best-effort)
  SELECT email INTO _actor_email FROM public.profiles WHERE user_id = _actor;
  SELECT email INTO _target_email FROM public.profiles WHERE user_id = _user_id;

  -- Audit entry
  INSERT INTO public.credit_audit_log (
    actor_user_id, actor_email, target_user_id, target_email,
    operation, amount, balance_before, balance_after, reason
  ) VALUES (
    _actor, _actor_email, _user_id, _target_email,
    CASE WHEN _amount > 0 THEN 'add' ELSE 'remove' END,
    abs(_amount), _current_balance, _new_balance, _description
  );

  RETURN jsonb_build_object('success', true, 'balance', _new_balance);
END;
$function$;