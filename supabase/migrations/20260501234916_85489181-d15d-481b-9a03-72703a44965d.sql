ALTER TABLE public.ebook_configs
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_ebook_configs_category ON public.ebook_configs(category);
CREATE INDEX IF NOT EXISTS idx_ebook_configs_tags ON public.ebook_configs USING GIN(tags);

UPDATE public.ebook_configs
SET category = 'pratico', tags = ARRAY['didatico','passo-a-passo','iniciantes']
WHERE id = '7c8745ae-88d8-4994-b9f6-ac553948a2bd';

UPDATE public.ebook_configs
SET category = 'autoridade', tags = ARRAY['premium','especialistas','infoproduto']
WHERE id = '725c7167-81b0-406b-9975-97d848b55a45';