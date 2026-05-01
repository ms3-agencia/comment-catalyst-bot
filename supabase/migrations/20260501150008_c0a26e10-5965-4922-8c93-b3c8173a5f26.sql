-- Padroniza mensagens de erro do consume_credits
CREATE OR REPLACE FUNCTION public.consume_credits(
  _amount INTEGER,
  _action_key TEXT,
  _description TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _current INTEGER;
  _err_msg TEXT;
  _err_detail TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'not_authenticated',
      'message', 'Você precisa estar autenticado para consumir créditos.'
    );
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'invalid_amount',
      'message', 'Quantidade de créditos inválida.'
    );
  END IF;

  IF _action_key IS NULL OR length(trim(_action_key)) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'invalid_action',
      'message', 'Ação de consumo de créditos não informada.'
    );
  END IF;

  SELECT balance INTO _current FROM public.user_credits WHERE user_id = _uid FOR UPDATE;
  IF _current IS NULL THEN
    INSERT INTO public.user_credits (user_id, balance) VALUES (_uid, 0);
    _current := 0;
  END IF;

  IF _current < _amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'insufficient_credits',
      'message', format('Créditos insuficientes. Saldo atual: %s, necessário: %s.', _current, _amount),
      'balance', _current,
      'required', _amount
    );
  END IF;

  UPDATE public.user_credits SET balance = balance - _amount WHERE user_id = _uid;

  INSERT INTO public.credit_transactions (user_id, amount, type, action_key, description, reference_id)
  VALUES (_uid, -_amount, 'consumption', _action_key, _description, _reference_id);

  RETURN jsonb_build_object(
    'success', true,
    'balance', _current - _amount,
    'consumed', _amount
  );

EXCEPTION
  WHEN insufficient_privilege THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'permission_denied',
      'message', 'Permissão negada para consumir créditos.'
    );
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'duplicate_transaction',
      'message', 'Esta operação já foi registrada anteriormente.'
    );
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'invalid_reference',
      'message', 'Referência inválida ao registrar o consumo de créditos.'
    );
  WHEN check_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'constraint_violation',
      'message', 'Os dados de consumo não atendem às regras do sistema.'
    );
  WHEN not_null_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'missing_field',
      'message', 'Campo obrigatório ausente ao consumir créditos.'
    );
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _err_msg = MESSAGE_TEXT, _err_detail = PG_EXCEPTION_DETAIL;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'internal_error',
      'message', 'Erro inesperado ao consumir créditos. Tente novamente em instantes.',
      'detail', _err_msg
    );
END;
$$;

-- Padroniza admin_add_credits
CREATE OR REPLACE FUNCTION public.admin_add_credits(
  _user_id UUID,
  _amount INTEGER,
  _description TEXT DEFAULT 'Ajuste manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_balance INTEGER;
  _err_msg TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'permission_denied',
      'message', 'Apenas administradores podem adicionar créditos.'
    );
  END IF;

  IF _user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'invalid_user',
      'message', 'Usuário de destino não informado.'
    );
  END IF;

  IF _amount IS NULL OR _amount = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'invalid_amount',
      'message', 'Quantidade de créditos inválida.'
    );
  END IF;

  INSERT INTO public.user_credits (user_id, balance) VALUES (_user_id, _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.user_credits.balance + _amount
  RETURNING balance INTO _new_balance;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (_user_id, _amount, 'admin_adjustment', _description);

  RETURN jsonb_build_object(
    'success', true,
    'balance', _new_balance,
    'message', 'Créditos atualizados com sucesso.'
  );

EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'invalid_reference',
      'message', 'Usuário informado não existe.'
    );
  WHEN check_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'constraint_violation',
      'message', 'Os dados não atendem às regras do sistema (saldo negativo?).'
    );
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _err_msg = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'internal_error',
      'message', 'Erro inesperado ao ajustar créditos. Tente novamente.',
      'detail', _err_msg
    );
END;
$$;