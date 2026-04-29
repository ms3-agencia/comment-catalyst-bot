
-- 1. Catálogo de Add-ons
CREATE TABLE public.addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'Sparkles',
  price_brl NUMERIC NOT NULL DEFAULT 0,
  credits_cost INTEGER NOT NULL DEFAULT 0,
  billing_type TEXT NOT NULL DEFAULT 'one_time' CHECK (billing_type IN ('one_time','monthly')),
  features TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active addons"
  ON public.addons FOR SELECT
  TO anon, authenticated
  USING (is_active OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage addons"
  ON public.addons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_addons_updated
  BEFORE UPDATE ON public.addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Vínculo Add-on <-> Plano (com desconto)
CREATE TABLE public.plan_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan app_plan NOT NULL,
  addon_id UUID NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  included_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan, addon_id)
);

ALTER TABLE public.plan_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan_addons"
  ON public.plan_addons FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "Admins manage plan_addons"
  ON public.plan_addons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. Add-ons comprados/ativos por usuário
CREATE TABLE public.user_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  addon_id UUID NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  billing_type TEXT NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, addon_id)
);

ALTER TABLE public.user_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own addons"
  ON public.user_addons FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all user_addons"
  ON public.user_addons FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage user_addons"
  ON public.user_addons FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_user_addons_updated
  BEFORE UPDATE ON public.user_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Personalização de PDF (config do add-on PDF)
CREATE TABLE public.pdf_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#06b6d4',
  secondary_color TEXT DEFAULT '#0f172a',
  accent_color TEXT DEFAULT '#22d3ee',
  font_family TEXT DEFAULT 'Inter',
  cover_title TEXT,
  cover_subtitle TEXT,
  cover_image_url TEXT,
  header_text TEXT,
  footer_text TEXT,
  watermark_text TEXT,
  watermark_opacity NUMERIC DEFAULT 0.1,
  templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_template_id TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pdf_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pdf customization"
  ON public.pdf_customizations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all pdf customizations"
  ON public.pdf_customizations FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_pdf_cust_updated
  BEFORE UPDATE ON public.pdf_customizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Coluna addon_id em payment_orders
ALTER TABLE public.payment_orders
  ADD COLUMN addon_id UUID REFERENCES public.addons(id) ON DELETE SET NULL,
  ADD COLUMN order_type TEXT NOT NULL DEFAULT 'credits' CHECK (order_type IN ('credits','addon'));

-- 6. Bucket para assets de personalização
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-assets','pdf-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own pdf assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pdf-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own pdf assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'pdf-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own pdf assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pdf-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read pdf assets"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'pdf-assets');

-- 7. Função para verificar se usuário tem add-on ativo
CREATE OR REPLACE FUNCTION public.user_has_addon(_user_id UUID, _addon_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_addons ua
    JOIN public.addons a ON a.id = ua.addon_id
    WHERE ua.user_id = _user_id
      AND a.slug = _addon_slug
      AND ua.status = 'active'
      AND (ua.expires_at IS NULL OR ua.expires_at > now())
  );
$$;

-- 8. Função para ativar add-on (chamada por edge function ou via créditos)
CREATE OR REPLACE FUNCTION public.activate_addon_with_credits(_addon_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _addon RECORD;
  _consume JSONB;
  _expires TIMESTAMPTZ;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _addon FROM public.addons WHERE id = _addon_id AND is_active = true;
  IF _addon IS NULL THEN RAISE EXCEPTION 'Add-on not found'; END IF;
  IF _addon.credits_cost <= 0 THEN RAISE EXCEPTION 'This add-on cannot be purchased with credits'; END IF;

  _consume := public.consume_credits(_addon.credits_cost, 'addon_activation', 'Ativação de add-on: ' || _addon.name, _addon_id);
  IF NOT (_consume->>'success')::boolean THEN RETURN _consume; END IF;

  IF _addon.billing_type = 'monthly' THEN
    _expires := now() + interval '30 days';
  END IF;

  INSERT INTO public.user_addons (user_id, addon_id, billing_type, expires_at, payment_method, status)
  VALUES (_uid, _addon_id, _addon.billing_type, _expires, 'credits', 'active')
  ON CONFLICT (user_id, addon_id) DO UPDATE
    SET status = 'active', activated_at = now(), expires_at = _expires,
        billing_type = _addon.billing_type, payment_method = 'credits';

  RETURN jsonb_build_object('success', true, 'addon_id', _addon_id, 'expires_at', _expires);
END;
$$;
