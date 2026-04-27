CREATE TABLE public.generated_contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  social_network TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  cta TEXT,
  script TEXT,
  visual_idea TEXT,
  engagement_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_contents_project ON public.generated_contents(project_id);
CREATE INDEX idx_generated_contents_user ON public.generated_contents(user_id);

ALTER TABLE public.generated_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own generated contents"
  ON public.generated_contents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own generated contents"
  ON public.generated_contents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own generated contents"
  ON public.generated_contents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own generated contents"
  ON public.generated_contents FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all generated contents"
  ON public.generated_contents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_generated_contents_updated_at
  BEFORE UPDATE ON public.generated_contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.credit_action_costs (action_key, display_name, cost, description)
VALUES ('generate_content', 'Gerar Conteúdo', 2, 'Geração de 1 conteúdo personalizado por IA')
ON CONFLICT (action_key) DO NOTHING;