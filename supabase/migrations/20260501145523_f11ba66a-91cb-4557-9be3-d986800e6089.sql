INSERT INTO public.credit_action_costs (action_key, display_name, cost, description)
VALUES ('ebook_image', 'Imagem em eBook', 5, 'Geração de imagem com IA dentro do editor de eBook')
ON CONFLICT (action_key) DO NOTHING;