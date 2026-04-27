-- Provedores de geração de vídeo (admin pode ativar/desativar e definir % de uso)
CREATE TABLE IF NOT EXISTS public.video_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- 'video_ai' | 'tts' | 'music'
  provider text NOT NULL, -- 'browser_canvas','lovable_veo','runway','elevenlabs','openai_tts','library'
  model text,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  weight integer NOT NULL DEFAULT 0, -- porcentagem para roteamento
  api_key_secret_name text, -- nome do secret no supabase (opcional)
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage video_providers" ON public.video_providers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read video_providers" ON public.video_providers
  FOR SELECT TO authenticated USING (enabled = true);

-- Custos de crédito específicos para vídeo (por segundo, por cena, por narração)
INSERT INTO public.credit_action_costs (action_key, display_name, cost, description) VALUES
  ('video_render_basic', 'Vídeo (renderização no navegador, por segundo)', 1, 'Vídeo montado no navegador com Ken Burns + textos animados'),
  ('video_render_ai', 'Vídeo IA (animação real, por cena)', 50, 'Cada cena animada por IA de vídeo (Veo/Runway)'),
  ('video_tts_narration', 'Narração IA (por 100 caracteres)', 2, 'Voz sintetizada por IA para o vídeo'),
  ('video_image_regen', 'Regerar imagem de cena', 3, 'Regerar imagem individual de uma cena do vídeo')
ON CONFLICT (action_key) DO NOTHING;

-- Provedores padrão (todos desativados exceto canvas)
INSERT INTO public.video_providers (kind, provider, display_name, enabled, weight, config) VALUES
  ('video_ai', 'browser_canvas', 'Renderização no navegador (Canvas + Ken Burns)', true, 100, '{"description":"Sem custo de IA extra. Usa as imagens já geradas com efeitos Ken Burns e texto animado."}'),
  ('video_ai', 'lovable_veo', 'Lovable AI - Veo (animação real)', false, 0, '{"description":"Cada cena vira um clipe animado real via IA. Custo alto."}'),
  ('video_ai', 'runway', 'Runway Gen-3 (animação cinematográfica)', false, 0, '{"description":"Animação premium. Requer chave API Runway."}'),
  ('tts', 'none', 'Sem narração', true, 100, '{}'),
  ('tts', 'elevenlabs', 'ElevenLabs (voz natural)', false, 0, '{}'),
  ('tts', 'openai_tts', 'OpenAI TTS', false, 0, '{}'),
  ('music', 'none', 'Sem música', true, 100, '{}'),
  ('music', 'library', 'Biblioteca de músicas livres', false, 0, '{}')
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS credit_action_costs_action_key_unique ON public.credit_action_costs(action_key);