
-- 1. email_templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  send_email BOOLEAN NOT NULL DEFAULT true,
  send_inapp BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read enabled templates" ON public.email_templates
  FOR SELECT TO authenticated USING (enabled OR public.has_role(auth.uid(), 'admin'));

-- 2. system_notifications (in-app)
CREATE TABLE public.system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_notifications_user_unread ON public.system_notifications(user_id, read, created_at DESC);

ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.system_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON public.system_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications" ON public.system_notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all notifications" ON public.system_notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. email_send_log
CREATE TABLE public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT,
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_send_log_recipient ON public.email_send_log(recipient_user_id, created_at DESC);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view email log" ON public.email_send_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_notifications;

-- 5. Templates default
INSERT INTO public.email_templates (key, name, subject, body_html, variables, send_email, send_inapp) VALUES
('welcome',
 'Boas-vindas',
 'Bem-vindo(a) ao {{site_name}}, {{user_name}}!',
 '<h2>Olá {{user_name}}, seja bem-vindo(a)!</h2><p>Sua conta no <b>{{site_name}}</b> foi criada com sucesso. Você começa com <b>{{free_credits}}</b> créditos no plano Free.</p><p>Comece a extrair comentários e gerar conteúdo agora mesmo.</p><p><a href="{{app_url}}">Acessar o painel</a></p>',
 ARRAY['user_name','site_name','free_credits','app_url'], true, true),
('package_purchase',
 'Compra de pacote de créditos',
 'Pagamento aprovado: {{package_name}}',
 '<h2>Olá {{user_name}}, seu pagamento foi aprovado!</h2><p>Você adquiriu o pacote <b>{{package_name}}</b> com <b>{{credits}}</b> créditos por R$ {{amount}}.</p><p>Os créditos já estão disponíveis no seu painel.</p>',
 ARRAY['user_name','package_name','credits','amount'], true, true),
('addon_purchase',
 'Compra de recurso adicional',
 'Add-on ativado: {{addon_name}}',
 '<h2>Pronto, {{user_name}}!</h2><p>O recurso <b>{{addon_name}}</b> foi ativado na sua conta.</p><p>{{addon_description}}</p><p>Validade: {{expires_at}}</p>',
 ARRAY['user_name','addon_name','addon_description','expires_at'], true, true),
('plan_upgrade',
 'Upgrade de plano',
 'Plano {{plan_name}} ativado',
 '<h2>Parabéns, {{user_name}}!</h2><p>Seu plano agora é <b>{{plan_name}}</b>, com <b>{{monthly_credits}}</b> créditos mensais.</p><p>{{plan_description}}</p>',
 ARRAY['user_name','plan_name','monthly_credits','plan_description'], true, true),
('plan_renewal',
 'Aviso de renovação de plano',
 'Seu plano {{plan_name}} renova em {{days_left}} dias',
 '<h2>Olá {{user_name}}</h2><p>Seu plano <b>{{plan_name}}</b> será renovado em <b>{{days_left}} dias</b> ({{renewal_date}}).</p><p>Para continuar com seus créditos mensais e recursos, mantenha seu pagamento ativo.</p>',
 ARRAY['user_name','plan_name','days_left','renewal_date'], true, true);

-- 6. SMTP defaults em app_settings (apenas chaves, valores ficam vazios)
INSERT INTO public.app_settings (key, value) VALUES
  ('smtp_host', ''),
  ('smtp_port', '587'),
  ('smtp_user', ''),
  ('smtp_password', ''),
  ('smtp_from_email', ''),
  ('smtp_from_name', 'YCaptura'),
  ('smtp_secure', 'tls')
ON CONFLICT (key) DO NOTHING;
