CREATE OR REPLACE FUNCTION public.admin_add_credits(_user_id uuid, _amount integer, _description text DEFAULT 'Ajuste manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_balance INTEGER;
  _current_balance INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
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

  RETURN jsonb_build_object('success', true, 'balance', _new_balance);
END;
$function$;