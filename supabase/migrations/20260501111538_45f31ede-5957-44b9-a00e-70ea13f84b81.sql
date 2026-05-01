
CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_token ON public.email_confirmation_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_user ON public.email_confirmation_tokens(user_id);

ALTER TABLE public.email_confirmation_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view confirmation tokens"
ON public.email_confirmation_tokens
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.email_templates (key, name, subject, body_html, variables, category, trigger_type, is_system, enabled, send_email, send_inapp, description)
VALUES (
  'email_confirmation',
  'Confirmação de email',
  'Confirme seu email no {{site_name}}',
  '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#0f172a;">
    <h1 style="font-family:''Space Grotesk'',Arial,sans-serif;font-size:24px;margin:0 0 16px;">Olá, {{user_name}}!</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Bem-vindo(a) ao <strong>{{site_name}}</strong>. Para ativar sua conta, confirme seu email clicando no botão abaixo:</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="{{confirmation_url}}" style="display:inline-block;background:#06b6d4;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;">Confirmar email</a>
    </p>
    <p style="font-size:13px;color:#64748b;line-height:1.5;margin:0 0 8px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
    <p style="font-size:13px;word-break:break-all;color:#0891b2;margin:0 0 24px;">{{confirmation_url}}</p>
    <p style="font-size:12px;color:#94a3b8;margin:24px 0 0;">Este link expira em 24 horas. Se você não criou esta conta, ignore este email.</p>
  </div>',
  ARRAY['user_name','site_name','confirmation_url'],
  'transactional',
  'manual',
  true,
  true,
  true,
  false,
  'Email enviado quando o usuário se cadastra para confirmar a propriedade do endereço.'
)
ON CONFLICT (key) DO NOTHING;
