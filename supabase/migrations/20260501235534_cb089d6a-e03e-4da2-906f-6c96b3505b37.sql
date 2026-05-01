ALTER TABLE public.ebook_configs
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ebook_configs_sort_order ON public.ebook_configs(sort_order);

-- Inicializa ordem para templates globais existentes (admins)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.ebook_configs
  WHERE has_role(user_id, 'admin'::app_role)
)
UPDATE public.ebook_configs ec
SET sort_order = ordered.rn
FROM ordered
WHERE ec.id = ordered.id;