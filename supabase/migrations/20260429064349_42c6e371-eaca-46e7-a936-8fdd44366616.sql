-- Create custom-logo addon
INSERT INTO public.addons (slug, name, description, icon, price_brl, credits_cost, billing_type, features, is_active, sort_order)
VALUES (
  'custom-logo',
  'Logo Personalizado',
  'Adicione seu logo automaticamente em todas as imagens e vídeos gerados pela IA, com posicionamento customizado por formato.',
  'Sparkles',
  19.90,
  200,
  'monthly',
  ARRAY['Logo automático em imagens geradas', 'Logo em vídeos do editor', 'Posicionamento drag & drop', 'Configuração por rede social (Instagram, TikTok, YouTube)', 'Controle de tamanho e opacidade'],
  true,
  20
)
ON CONFLICT (slug) DO NOTHING;

-- Logo customization per user, with positions per format
CREATE TABLE IF NOT EXISTS public.logo_customizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  logo_url TEXT,
  default_size_percent NUMERIC NOT NULL DEFAULT 15,
  default_opacity NUMERIC NOT NULL DEFAULT 1,
  -- positions: { "instagram-feed": { x: 0.05, y: 0.05, size: 15, opacity: 1 }, ... }
  positions JSONB NOT NULL DEFAULT '{}'::jsonb,
  apply_on_images BOOLEAN NOT NULL DEFAULT true,
  apply_on_videos BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.logo_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own logo customization"
ON public.logo_customizations FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all logo customizations"
ON public.logo_customizations FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_logo_customizations_updated_at
BEFORE UPDATE ON public.logo_customizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();