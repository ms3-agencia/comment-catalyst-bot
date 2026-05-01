-- 1) Estender email_templates
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text;

-- Marcar built-ins como sistema
UPDATE public.email_templates SET is_system = true
  WHERE key IN ('welcome','package_purchase','addon_purchase','plan_upgrade','plan_renewal');

UPDATE public.email_templates SET trigger_type = 'event', category = 'lifecycle' WHERE key = 'welcome';
UPDATE public.email_templates SET trigger_type = 'event', category = 'transactional' WHERE key IN ('package_purchase','addon_purchase','plan_upgrade');
UPDATE public.email_templates SET trigger_type = 'scheduled', category = 'billing' WHERE key = 'plan_renewal';

-- 2) Tabela de regras de timing
CREATE TABLE IF NOT EXISTS public.email_template_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  -- gatilho: 'plan_renewal' | 'low_credits' | 'after_signup'
  trigger_event text NOT NULL,
  -- offset em dias (negativo = antes, 0 = no dia, positivo = depois)
  offset_days integer NOT NULL DEFAULT 0,
  send_hour integer NOT NULL DEFAULT 9 CHECK (send_hour BETWEEN 0 AND 23),
  send_minute integer NOT NULL DEFAULT 0 CHECK (send_minute BETWEEN 0 AND 59),
  -- condições extras (ex: low_credits threshold)
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etr_template ON public.email_template_rules(template_id);
CREATE INDEX IF NOT EXISTS idx_etr_event ON public.email_template_rules(trigger_event) WHERE enabled = true;

ALTER TABLE public.email_template_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email rules"
  ON public.email_template_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated read enabled rules"
  ON public.email_template_rules FOR SELECT TO authenticated
  USING (enabled OR public.has_role(auth.uid(),'admin'));

-- 3) Idempotência de execuções
CREATE TABLE IF NOT EXISTS public.email_rule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.email_template_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  run_date date NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, user_id, run_date)
);

CREATE INDEX IF NOT EXISTS idx_err_rule_user ON public.email_rule_runs(rule_id, user_id);

ALTER TABLE public.email_rule_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view rule runs"
  ON public.email_rule_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 4) Broadcasts manuais
CREATE TABLE IF NOT EXISTS public.email_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'all', -- 'all' | 'plan:free' | 'plan:pro' | 'plan:enterprise' | 'user:<uuid>'
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  variables_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_recipients integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.email_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage broadcasts"
  ON public.email_broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5) Trigger updated_at
DROP TRIGGER IF EXISTS trg_etr_updated ON public.email_template_rules;
CREATE TRIGGER trg_etr_updated
  BEFORE UPDATE ON public.email_template_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Adicionar variáveis novas no plan_renewal: payment_link e plans_url
UPDATE public.email_templates
   SET variables = ARRAY['user_name','plan_name','days_left','renewal_date','payment_link','plans_url','site_name','app_url']::text[]
 WHERE key = 'plan_renewal';

-- 7) Template novo: low_credits
INSERT INTO public.email_templates (key, name, subject, body_html, variables, enabled, send_email, send_inapp, category, trigger_type, is_system, description)
VALUES (
  'low_credits',
  'Saldo de créditos baixo',
  'Seus créditos estão acabando, {{user_name}}',
  '<h2>Olá, {{user_name}}!</h2><p>Você está com apenas <b>{{credits_balance}} créditos</b> restantes em {{site_name}}.</p><p>Para continuar criando, recarregue agora:</p><p><a href="{{credits_url}}" style="background:#06b6d4;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Comprar créditos</a></p>',
  ARRAY['user_name','credits_balance','site_name','app_url','credits_url']::text[],
  true, true, true, 'billing', 'scheduled', true,
  'Disparado automaticamente quando o saldo do usuário fica abaixo do limite configurado na regra.'
) ON CONFLICT (key) DO UPDATE
  SET variables = EXCLUDED.variables, category = EXCLUDED.category, trigger_type = EXCLUDED.trigger_type, is_system = true;

-- 8) Regras padrão para plan_renewal (5d, 3d, 0d antes às 9h)
DO $$
DECLARE _tpl_id uuid;
BEGIN
  SELECT id INTO _tpl_id FROM public.email_templates WHERE key = 'plan_renewal';
  IF _tpl_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.email_template_rules WHERE template_id = _tpl_id) THEN
    INSERT INTO public.email_template_rules (template_id, trigger_event, offset_days, send_hour) VALUES
      (_tpl_id, 'plan_renewal', -5, 9),
      (_tpl_id, 'plan_renewal', -3, 9),
      (_tpl_id, 'plan_renewal',  0, 9);
  END IF;

  SELECT id INTO _tpl_id FROM public.email_templates WHERE key = 'low_credits';
  IF _tpl_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.email_template_rules WHERE template_id = _tpl_id) THEN
    INSERT INTO public.email_template_rules (template_id, trigger_event, offset_days, send_hour, conditions) VALUES
      (_tpl_id, 'low_credits', 0, 10, '{"threshold": 10}'::jsonb);
  END IF;
END$$;
