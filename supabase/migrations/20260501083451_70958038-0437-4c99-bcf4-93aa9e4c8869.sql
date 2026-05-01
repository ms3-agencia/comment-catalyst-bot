ALTER TABLE public.payment_orders
ADD COLUMN IF NOT EXISTS target_plan public.app_plan;