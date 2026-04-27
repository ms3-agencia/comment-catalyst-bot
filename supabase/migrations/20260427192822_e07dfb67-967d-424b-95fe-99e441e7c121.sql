-- Style presets table for video editor
CREATE TABLE IF NOT EXISTS public.video_style_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Style config (effects/fonts/colors arrays + defaults)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.video_style_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage video_style_presets"
ON public.video_style_presets
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read active video_style_presets"
ON public.video_style_presets
FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_video_style_presets_updated_at
BEFORE UPDATE ON public.video_style_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default preset (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_video_style_presets_default
ON public.video_style_presets ((is_default)) WHERE is_default = true;

-- Seed default presets
INSERT INTO public.video_style_presets (name, description, is_default, sort_order, config) VALUES
('Cinemático', 'Zoom suave e tipografia display elegante', true, 1, '{
  "imageEffects": ["zoom_in","zoom_out","pan_right","pan_left"],
  "textEffects": ["fade","slide_up","pop"],
  "fonts": ["display","serif"],
  "textColors": ["#ffffff","#fde68a"],
  "textBg": "rgba(0,0,0,0.55)",
  "fontSize": 1.1,
  "textPosition": "bottom"
}'::jsonb),
('Dinâmico TikTok', 'Movimentos rápidos e cores vibrantes', false, 2, '{
  "imageEffects": ["zoom_in","pan_left","pan_right","pan_up"],
  "textEffects": ["pop","bounce","slide_left","typewriter"],
  "fonts": ["display","sans"],
  "textColors": ["#ffffff","#22d3ee","#f472b6"],
  "textBg": "rgba(0,0,0,0.4)",
  "fontSize": 1.2,
  "textPosition": "center"
}'::jsonb),
('Minimalista', 'Sem efeitos pesados, foco no texto', false, 3, '{
  "imageEffects": ["none","zoom_in"],
  "textEffects": ["fade","slide_up"],
  "fonts": ["sans"],
  "textColors": ["#ffffff"],
  "textBg": "rgba(0,0,0,0.3)",
  "fontSize": 1.0,
  "textPosition": "bottom"
}'::jsonb)
ON CONFLICT DO NOTHING;