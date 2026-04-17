CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  model text NOT NULL,
  priority integer NOT NULL DEFAULT 99,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ai_providers"
ON public.ai_providers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read ai_providers"
ON public.ai_providers FOR SELECT TO authenticated
USING (true);

CREATE TRIGGER update_ai_providers_updated_at
BEFORE UPDATE ON public.ai_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_providers (provider, model, priority, enabled) VALUES
  ('lovable', 'google/gemini-3-flash-preview', 1, true),
  ('openai', 'gpt-4o-mini', 2, false),
  ('openrouter', 'google/gemini-2.0-flash-exp:free', 3, false),
  ('gemini', 'gemini-2.0-flash', 4, false)
ON CONFLICT (provider) DO NOTHING;