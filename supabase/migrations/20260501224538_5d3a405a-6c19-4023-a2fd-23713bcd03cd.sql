
-- 1. Tabela de custos por item de template
CREATE TABLE IF NOT EXISTS public.ebook_item_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  cost_per_chapter integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ebook_item_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ebook item costs"
ON public.ebook_item_costs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read enabled ebook item costs"
ON public.ebook_item_costs FOR SELECT TO authenticated
USING (enabled OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ebook_item_costs_updated_at
BEFORE UPDATE ON public.ebook_item_costs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Multiplicador por plano em plan_configs
ALTER TABLE public.plan_configs
ADD COLUMN IF NOT EXISTS ebook_cost_multiplier numeric NOT NULL DEFAULT 1.0;

-- Defaults sugeridos
UPDATE public.plan_configs SET ebook_cost_multiplier = 1.0  WHERE plan = 'free'       AND ebook_cost_multiplier = 1.0;
UPDATE public.plan_configs SET ebook_cost_multiplier = 0.5  WHERE plan = 'pro'        AND ebook_cost_multiplier = 1.0;
UPDATE public.plan_configs SET ebook_cost_multiplier = 0.2  WHERE plan = 'enterprise' AND ebook_cost_multiplier = 1.0;

-- 3. Função para calcular custo dinâmico do capítulo
CREATE OR REPLACE FUNCTION public.compute_ebook_chapter_cost(_user_id uuid, _config_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg public.ebook_configs%ROWTYPE;
  _plan app_plan;
  _mult numeric := 1.0;
  _base integer := 8;  -- custo base do capítulo
  _items_total integer := 0;
  _final integer;
BEGIN
  SELECT plan INTO _plan FROM public.profiles WHERE user_id = _user_id;
  IF _plan IS NULL THEN _plan := 'free'::app_plan; END IF;
  SELECT ebook_cost_multiplier INTO _mult FROM public.plan_configs WHERE plan = _plan;
  IF _mult IS NULL OR _mult <= 0 THEN _mult := 1.0; END IF;

  IF _config_id IS NOT NULL THEN
    SELECT * INTO _cfg FROM public.ebook_configs WHERE id = _config_id;
  END IF;

  -- Soma os custos dos itens ativos no template
  SELECT COALESCE(SUM(c.cost_per_chapter), 0) INTO _items_total
  FROM public.ebook_item_costs c
  WHERE c.enabled = true
    AND (
      (c.item_key = 'include_exercises'    AND COALESCE(_cfg.include_exercises,    false))
   OR (c.item_key = 'include_summary'      AND COALESCE(_cfg.include_summary,      false))
   OR (c.item_key = 'include_checklist'    AND COALESCE(_cfg.include_checklist,    false))
   OR (c.item_key = 'include_case_studies' AND COALESCE(_cfg.include_case_studies, false))
   OR (c.item_key = 'include_examples'     AND COALESCE(_cfg.include_examples,     false))
   OR (c.item_key = 'include_metaphors'    AND COALESCE(_cfg.include_metaphors,    false))
   OR (c.item_key = 'premium_product_mode' AND COALESCE(_cfg.premium_product_mode, false))
   OR (c.item_key = 'depth_avancado'       AND _cfg.depth_level   = 'avancado')
   OR (c.item_key = 'depth_intermediario'  AND _cfg.depth_level   = 'intermediario')
   OR (c.item_key = 'style_storytelling'   AND _cfg.writing_style = 'storytelling')
   OR (c.item_key = 'style_tecnico'        AND _cfg.writing_style = 'tecnico')
   OR (c.item_key = 'style_persuasivo'     AND _cfg.writing_style = 'persuasivo')
   OR (c.item_key = 'custom_style'         AND _cfg.writing_style = 'custom')
    );

  _final := GREATEST(1, ROUND((_base + _items_total) * _mult)::integer);
  RETURN _final;
END;
$$;

-- 4. Pré-popula itens padrão
INSERT INTO public.ebook_item_costs (item_key, display_name, description, cost_per_chapter, sort_order) VALUES
  ('include_exercises',    'Exercícios práticos',  'Inclui 3 exercícios numerados ao final de cada capítulo', 2, 10),
  ('include_summary',      'Resumo executivo',     'Resumo de 4-6 bullets ao final do capítulo',              1, 20),
  ('include_checklist',    'Checklist acionável',  '5-8 itens práticos por capítulo',                         1, 30),
  ('include_case_studies', 'Estudos de caso',      'Estudo de caso realista de 300-500 palavras',             3, 40),
  ('include_examples',     'Exemplos práticos',    '3+ exemplos espalhados pelo capítulo',                    1, 50),
  ('include_metaphors',    'Metáforas e analogias','Recursos para fixar conceitos centrais',                  1, 60),
  ('premium_product_mode', 'Modo Produto Premium', 'IA cria método exclusivo, promessa forte e posicionamento', 4, 70),
  ('depth_avancado',       'Profundidade avançada','Conteúdo técnico aprofundado por capítulo',               2, 80),
  ('depth_intermediario',  'Profundidade intermediária','Nível padrão de profundidade',                       0, 81),
  ('style_storytelling',   'Estilo storytelling',  'Narrativas envolventes',                                  1, 90),
  ('style_tecnico',        'Estilo técnico',       'Linguagem técnica e precisa',                             1, 91),
  ('style_persuasivo',     'Estilo persuasivo',    'Tom envolvente e persuasivo',                             1, 92),
  ('custom_style',         'Estilo personalizado', 'Estilo customizado escrito pelo usuário',                 2, 95)
ON CONFLICT (item_key) DO NOTHING;
