
-- Tabela de configurações/templates de eBook por usuário
CREATE TABLE public.ebook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Meu template',
  is_default boolean NOT NULL DEFAULT false,
  -- Estrutura
  num_chapters integer NOT NULL DEFAULT 8,
  min_pages_per_chapter integer NOT NULL DEFAULT 10,
  structure jsonb NOT NULL DEFAULT '{"intro":true,"development":true,"conclusion":true,"cta":true}'::jsonb,
  -- Estilo
  writing_style text NOT NULL DEFAULT 'didatico',
  custom_style text,
  -- Público
  target_audience text,
  -- Profundidade
  depth_level text NOT NULL DEFAULT 'intermediario',
  -- Elementos opcionais
  include_exercises boolean NOT NULL DEFAULT false,
  include_summary boolean NOT NULL DEFAULT true,
  include_checklist boolean NOT NULL DEFAULT false,
  include_case_studies boolean NOT NULL DEFAULT false,
  include_examples boolean NOT NULL DEFAULT true,
  include_metaphors boolean NOT NULL DEFAULT false,
  -- Prompt customizado
  base_prompt text,
  -- Modo Produto Premium
  premium_product_mode boolean NOT NULL DEFAULT false,
  ai_model text NOT NULL DEFAULT 'google/gemini-2.5-pro',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ebook_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ebook configs" ON public.ebook_configs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ebook configs" ON public.ebook_configs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_ebook_configs_user ON public.ebook_configs(user_id);

-- eBooks gerados
CREATE TABLE public.ebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid,
  config_id uuid,
  title text NOT NULL DEFAULT 'eBook sem título',
  subtitle text,
  topic text,
  cover_url text,
  outline jsonb NOT NULL DEFAULT '[]'::jsonb,
  introduction text,
  conclusion text,
  cta text,
  method_name text,
  promise text,
  status text NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT 'avatar',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ebooks" ON public.ebooks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ebooks" ON public.ebooks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_ebooks_user ON public.ebooks(user_id);

-- Capítulos
CREATE TABLE public.ebook_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ebook_id uuid NOT NULL REFERENCES public.ebooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  chapter_number integer NOT NULL,
  title text NOT NULL,
  summary text,
  content_html text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  word_count integer NOT NULL DEFAULT 0,
  cache_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ebook_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ebook chapters" ON public.ebook_chapters FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all ebook chapters" ON public.ebook_chapters FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_ebook_chapters_ebook ON public.ebook_chapters(ebook_id);
CREATE UNIQUE INDEX idx_ebook_chapters_unique ON public.ebook_chapters(ebook_id, chapter_number);

-- Sessões de chat (premium)
CREATE TABLE public.ebook_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ebook_id uuid REFERENCES public.ebooks(id) ON DELETE CASCADE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ebook_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ebook chat" ON public.ebook_chat_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers de updated_at
CREATE TRIGGER tg_ebook_configs_updated BEFORE UPDATE ON public.ebook_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_ebooks_updated BEFORE UPDATE ON public.ebooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_ebook_chapters_updated BEFORE UPDATE ON public.ebook_chapters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_ebook_chat_updated BEFORE UPDATE ON public.ebook_chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Action keys de crédito (admin ajusta o cost depois)
INSERT INTO public.credit_action_costs (action_key, display_name, description, cost) VALUES
  ('ebook_outline', 'eBook: gerar estrutura/sumário', 'Geração de outline com título, subtítulo, capítulos e plano', 5),
  ('ebook_chapter', 'eBook: gerar capítulo', 'Geração de um capítulo completo (~10 páginas)', 8),
  ('ebook_chat_message', 'eBook: mensagem no chat IA', 'Mensagem no chat de criação assistida (Premium)', 1)
ON CONFLICT (action_key) DO NOTHING;

-- Add-ons (básico e premium)
INSERT INTO public.addons (slug, name, description, icon, price_brl, credits_cost, billing_type, features, is_active, sort_order) VALUES
  ('ebook-generator', 'Gerador de eBooks', 'Gere eBooks profundos e personalizados a partir do seu avatar de público. Painel completo de configuração, templates reutilizáveis e exportação em PDF/DOCX/MD/TXT.', 'BookOpen', 49.90, 200, 'monthly',
   ARRAY['Geração baseada no avatar do projeto','Painel de configurações completo','Templates reutilizáveis','Exportação PDF, DOCX, Markdown e TXT','Geração em etapas com retomada automática','Histórico de eBooks ilimitado'], true, 50),
  ('ebook-premium', 'eBooks Premium (Chat + Editor)', 'Tudo do Gerador de eBooks + criação por chat conversacional com IA + editor visual tipo Word + Modo Produto Premium (estrutura como infoproduto vendável).', 'Crown', 97.00, 400, 'monthly',
   ARRAY['Tudo do Gerador de eBooks','Criação por chat conversacional com IA','Editor visual tipo Word (TipTap)','Modo Produto Premium (método exclusivo + posicionamento)','Edição capítulo a capítulo','Versões e cache inteligente'], true, 51)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, features = EXCLUDED.features,
  icon = EXCLUDED.icon, price_brl = EXCLUDED.price_brl, credits_cost = EXCLUDED.credits_cost,
  billing_type = EXCLUDED.billing_type, is_active = EXCLUDED.is_active;
