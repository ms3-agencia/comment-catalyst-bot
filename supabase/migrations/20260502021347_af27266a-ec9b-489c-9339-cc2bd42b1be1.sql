INSERT INTO public.addons (slug, name, description, icon, price_brl, credits_cost, billing_type, features, is_active, sort_order)
VALUES (
  'epub-export',
  'Exportação EPUB (KDP)',
  'Exporte seu ebook em formato EPUB 3 pronto para publicação na Amazon KDP, com metadados, capa, sumário navegável e validação básica.',
  'BookOpen',
  19.90,
  150,
  'monthly',
  ARRAY[
    'Exportação em EPUB 3 padrão',
    'Capa embutida no arquivo',
    'Sumário navegável (NCX + Nav)',
    'Metadados completos (autor, idioma, ISBN/ASIN, descrição)',
    'Compatível com Amazon KDP',
    'Pré-formatação responsiva (Kindle/iPad/celular)'
  ],
  true,
  60
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  price_brl = EXCLUDED.price_brl,
  credits_cost = EXCLUDED.credits_cost,
  billing_type = EXCLUDED.billing_type,
  features = EXCLUDED.features,
  is_active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();