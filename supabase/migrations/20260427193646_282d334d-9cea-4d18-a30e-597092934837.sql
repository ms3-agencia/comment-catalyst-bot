-- Seed/Update credit actions for TTS and music
INSERT INTO public.credit_action_costs (action_key, display_name, cost, description) VALUES
  ('tts_browser', 'Narração - Voz do navegador (grátis)', 0, 'Web Speech API local, sem custo'),
  ('tts_elevenlabs', 'Narração - ElevenLabs (por 100 caracteres)', 3, 'TTS premium ElevenLabs'),
  ('tts_openai', 'Narração - OpenAI TTS (por 100 caracteres)', 2, 'TTS OpenAI'),
  ('music_library', 'Música - Biblioteca royalty-free', 0, 'Trilha sonora da biblioteca')
ON CONFLICT (action_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

-- Map each provider to its cost action key (stored inside config jsonb)
UPDATE public.video_providers
SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('cost_action_key',
  CASE
    WHEN kind = 'video_ai' AND provider = 'browser_canvas' THEN 'video_render_basic'
    WHEN kind = 'video_ai' THEN 'video_render_ai'
    WHEN kind = 'tts' AND provider = 'browser_tts' THEN 'tts_browser'
    WHEN kind = 'tts' AND provider = 'elevenlabs' THEN 'tts_elevenlabs'
    WHEN kind = 'tts' AND provider = 'openai_tts' THEN 'tts_openai'
    WHEN kind = 'tts' AND provider = 'none' THEN 'tts_browser'
    WHEN kind = 'music' AND provider = 'library' THEN 'music_library'
    WHEN kind = 'music' AND provider = 'none' THEN 'music_library'
    ELSE 'video_render_basic'
  END
)
WHERE NOT (config ? 'cost_action_key');

-- Add unique constraint on action_key if missing (safe-guard for ON CONFLICT)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_action_costs_action_key_key'
  ) THEN
    ALTER TABLE public.credit_action_costs ADD CONSTRAINT credit_action_costs_action_key_key UNIQUE (action_key);
  END IF;
END $$;