
CREATE TABLE IF NOT EXISTS public.email_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage signatures"
ON public.email_signatures FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read enabled signatures"
ON public.email_signatures FOR SELECT TO authenticated
USING (enabled OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_signatures_updated_at
BEFORE UPDATE ON public.email_signatures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.email_templates
ADD COLUMN IF NOT EXISTS signature_id UUID REFERENCES public.email_signatures(id) ON DELETE SET NULL;

-- Garantir apenas uma assinatura default
CREATE UNIQUE INDEX IF NOT EXISTS email_signatures_only_one_default
ON public.email_signatures (is_default) WHERE is_default = true;
