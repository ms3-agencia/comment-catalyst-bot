
-- 1. Plan configs (editable by admin)
CREATE TABLE public.plan_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan app_plan NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  price_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read plan_configs"
ON public.plan_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage plan_configs"
ON public.plan_configs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_plan_configs_updated_at
BEFORE UPDATE ON public.plan_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plan_configs (plan, display_name, monthly_credits, price_brl, description) VALUES
  ('free', 'Free', 50, 0, 'Plano gratuito para começar'),
  ('pro', 'Pro', 1000, 49.90, 'Para profissionais e criadores'),
  ('enterprise', 'Enterprise', 10000, 299.90, 'Para empresas e agências');

-- 2. Credit packages (recargas avulsas)
CREATE TABLE public.credit_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_brl NUMERIC(10,2) NOT NULL CHECK (price_brl >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active packages"
ON public.credit_packages FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage packages"
ON public.credit_packages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_credit_packages_updated_at
BEFORE UPDATE ON public.credit_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.credit_packages (name, credits, price_brl, sort_order) VALUES
  ('Pacote Inicial', 100, 29.00, 1),
  ('Pacote Pro', 500, 99.00, 2),
  ('Pacote Mega', 2000, 299.00, 3);

-- 3. Action costs (custo configurável por tipo de ação)
CREATE TABLE public.credit_action_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 1 CHECK (cost >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_action_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read action costs"
ON public.credit_action_costs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage action costs"
ON public.credit_action_costs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_action_costs_updated_at
BEFORE UPDATE ON public.credit_action_costs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.credit_action_costs (action_key, display_name, cost, description) VALUES
  ('extract_video', 'Extração por vídeo', 1, 'Custo para extrair comentários de 1 vídeo do YouTube'),
  ('comments_per_100', 'Lote de 100 comentários', 1, 'Custo adicional a cada 100 comentários extraídos'),
  ('ai_profile', 'Análise de perfil IA', 5, 'Custo para gerar perfil de avatar com IA');

-- 4. User credits (saldo)
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  monthly_allocation INTEGER NOT NULL DEFAULT 0,
  monthly_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits"
ON public.user_credits FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all credits"
ON public.user_credits FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage all credits"
ON public.user_credits FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Transactions
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase','consumption','monthly_reset','admin_adjustment','refund')),
  action_key TEXT,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions"
ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all transactions"
ON public.credit_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_transactions_user_created ON public.credit_transactions(user_id, created_at DESC);

-- 6. Payment orders (Mercado Pago)
CREATE TABLE public.payment_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_id UUID REFERENCES public.credit_packages(id),
  preference_id TEXT,
  payment_id TEXT,
  amount_brl NUMERIC(10,2) NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','refunded')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders"
ON public.payment_orders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all orders"
ON public.payment_orders FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage orders"
ON public.payment_orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_payment_orders_updated_at
BEFORE UPDATE ON public.payment_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_orders_user ON public.payment_orders(user_id, created_at DESC);
CREATE INDEX idx_payment_orders_preference ON public.payment_orders(preference_id);

-- 7. Initialize user_credits on signup (extend handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  free_credits INTEGER;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  SELECT monthly_credits INTO free_credits FROM public.plan_configs WHERE plan = 'free' LIMIT 1;
  free_credits := COALESCE(free_credits, 50);

  INSERT INTO public.user_credits (user_id, balance, monthly_allocation, monthly_reset_at)
  VALUES (NEW.id, free_credits, free_credits, now() + interval '30 days');

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (NEW.id, free_credits, 'monthly_reset', 'Créditos iniciais do plano Free');

  RETURN NEW;
END;
$$;

-- Backfill: criar user_credits para usuários existentes que ainda não têm
INSERT INTO public.user_credits (user_id, balance, monthly_allocation, monthly_reset_at)
SELECT p.user_id,
       COALESCE((SELECT monthly_credits FROM public.plan_configs pc WHERE pc.plan = p.plan), 50),
       COALESCE((SELECT monthly_credits FROM public.plan_configs pc WHERE pc.plan = p.plan), 50),
       now() + interval '30 days'
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_credits uc WHERE uc.user_id = p.user_id);

-- 8. RPC: consume_credits (atomic)
CREATE OR REPLACE FUNCTION public.consume_credits(_amount INTEGER, _action_key TEXT, _description TEXT DEFAULT NULL, _reference_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _current INTEGER;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT balance INTO _current FROM public.user_credits WHERE user_id = _uid FOR UPDATE;
  IF _current IS NULL THEN
    INSERT INTO public.user_credits (user_id, balance) VALUES (_uid, 0);
    _current := 0;
  END IF;

  IF _current < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', _current, 'required', _amount);
  END IF;

  UPDATE public.user_credits SET balance = balance - _amount WHERE user_id = _uid;

  INSERT INTO public.credit_transactions (user_id, amount, type, action_key, description, reference_id)
  VALUES (_uid, -_amount, 'consumption', _action_key, _description, _reference_id);

  RETURN jsonb_build_object('success', true, 'balance', _current - _amount);
END;
$$;

-- 9. RPC: admin add credits
CREATE OR REPLACE FUNCTION public.admin_add_credits(_user_id UUID, _amount INTEGER, _description TEXT DEFAULT 'Ajuste manual')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_balance INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can add credits';
  END IF;

  INSERT INTO public.user_credits (user_id, balance) VALUES (_user_id, _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.user_credits.balance + _amount
  RETURNING balance INTO _new_balance;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (_user_id, _amount, 'admin_adjustment', _description);

  RETURN jsonb_build_object('success', true, 'balance', _new_balance);
END;
$$;
