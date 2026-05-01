ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_order_type_check;

ALTER TABLE public.payment_orders
ADD CONSTRAINT payment_orders_order_type_check
CHECK (order_type IN ('credits','addon','plan'));