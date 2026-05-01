
CREATE TABLE IF NOT EXISTS public.video_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  content_id uuid,
  provider text NOT NULL,
  model text,
  script text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  video_url text,
  external_job_id text,
  credits_spent integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_generation_log_user ON public.video_generation_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_generation_log_provider ON public.video_generation_log(provider, created_at DESC);

ALTER TABLE public.video_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own video logs"
  ON public.video_generation_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all video logs"
  ON public.video_generation_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage video logs"
  ON public.video_generation_log FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_video_generation_log_updated_at
  BEFORE UPDATE ON public.video_generation_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add credit cost for AI video generation
INSERT INTO public.credit_action_costs (action_key, display_name, cost, description)
VALUES ('generate_ai_video', 'Geração de vídeo por IA', 25, 'Geração automática de vídeo a partir do roteiro usando provedores de IA.')
ON CONFLICT (action_key) DO NOTHING;
