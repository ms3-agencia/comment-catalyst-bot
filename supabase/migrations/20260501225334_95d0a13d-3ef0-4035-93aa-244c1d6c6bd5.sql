-- Garante unicidade de item_key (idempotência de upserts)
CREATE UNIQUE INDEX IF NOT EXISTS ebook_item_costs_item_key_uniq
  ON public.ebook_item_costs (item_key);

-- Função de seed/manutenção: insere itens padrão e preserva custos já editados pelo admin.
CREATE OR REPLACE FUNCTION public.seed_ebook_item_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted integer := 0;
  _updated  integer := 0;
  _item record;
BEGIN
  FOR _item IN
    SELECT * FROM (VALUES
      -- item_key, display_name, description, default_cost, sort_order
      ('include_summary',      'Resumo do capítulo',     'Adiciona resumo executivo ao final de cada capítulo',         1, 10),
      ('include_examples',     'Exemplos práticos',      'Inclui exemplos práticos ao longo do capítulo',                1, 20),
      ('include_exercises',    'Exercícios',             'Adiciona exercícios/atividades para o leitor',                 2, 30),
      ('include_checklist',    'Checklist',              'Inclui checklist de ações ao final do capítulo',               1, 40),
      ('include_case_studies', 'Estudos de caso',        'Adiciona estudos de caso reais ao capítulo',                   3, 50),
      ('include_metaphors',    'Metáforas e analogias',  'Enriquece o texto com metáforas e analogias',                  1, 60),
      ('premium_product_mode', 'Modo Produto Premium',   'Modo avançado com profundidade e estrutura premium',           4, 70),
      ('depth_intermediario',  'Profundidade Intermediária', 'Conteúdo de profundidade intermediária',                   1, 80),
      ('depth_avancado',       'Profundidade Avançada',  'Conteúdo de profundidade avançada',                            3, 81),
      ('style_storytelling',   'Estilo Storytelling',    'Capítulo escrito em formato de storytelling',                  2, 90),
      ('style_tecnico',        'Estilo Técnico',         'Capítulo com abordagem técnica e detalhada',                   2, 91),
      ('style_persuasivo',     'Estilo Persuasivo',      'Capítulo com tom persuasivo/copywriting',                      2, 92),
      ('custom_style',         'Estilo personalizado',   'Estilo de escrita customizado pelo usuário',                   2, 93)
    ) AS t(item_key, display_name, description, default_cost, sort_order)
  LOOP
    INSERT INTO public.ebook_item_costs
      (item_key, display_name, description, cost_per_chapter, enabled, sort_order)
    VALUES
      (_item.item_key, _item.display_name, _item.description, _item.default_cost, true, _item.sort_order)
    ON CONFLICT (item_key) DO UPDATE SET
      -- Atualiza apenas metadados (rótulos/ordem), preserva custo e enabled definidos pelo admin
      display_name = EXCLUDED.display_name,
      description  = EXCLUDED.description,
      sort_order   = EXCLUDED.sort_order,
      updated_at   = now();

    IF FOUND THEN
      IF (SELECT xmax = 0 FROM public.ebook_item_costs WHERE item_key = _item.item_key) THEN
        _inserted := _inserted + 1;
      ELSE
        _updated := _updated + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', _inserted,
    'updated', _updated,
    'ran_at', now()
  );
END;
$$;

-- Wrapper administrativo (chamável pelo painel admin para ressincronizar a qualquer momento)
CREATE OR REPLACE FUNCTION public.admin_seed_ebook_item_costs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can run this seed';
  END IF;
  RETURN public.seed_ebook_item_costs();
END;
$$;

-- Executa o seed agora para popular itens padrão
SELECT public.seed_ebook_item_costs();