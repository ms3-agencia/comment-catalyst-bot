ALTER TABLE public.plan_configs ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.credit_packages ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}';