-- Mover ativações do slug duplicado 'logo-custom' para o canônico 'custom-logo'
DO $$
DECLARE
  _old_id UUID;
  _new_id UUID;
BEGIN
  SELECT id INTO _old_id FROM public.addons WHERE slug = 'logo-custom';
  SELECT id INTO _new_id FROM public.addons WHERE slug = 'custom-logo';

  IF _old_id IS NOT NULL AND _new_id IS NOT NULL THEN
    -- Move ativações: se o usuário já tem o novo, mantém o melhor estado; senão, atualiza para o novo
    UPDATE public.user_addons ua
    SET addon_id = _new_id
    WHERE ua.addon_id = _old_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_addons ua2
        WHERE ua2.user_id = ua.user_id AND ua2.addon_id = _new_id
      );

    -- Remove duplicatas restantes (caso usuário já tivesse ambos)
    DELETE FROM public.user_addons WHERE addon_id = _old_id;

    -- Atualiza referências em payment_orders
    UPDATE public.payment_orders SET addon_id = _new_id WHERE addon_id = _old_id;

    -- Atualiza plan_addons se houver
    UPDATE public.plan_addons pa
    SET addon_id = _new_id
    WHERE pa.addon_id = _old_id
      AND NOT EXISTS (
        SELECT 1 FROM public.plan_addons pa2
        WHERE pa2.plan = pa.plan AND pa2.addon_id = _new_id
      );
    DELETE FROM public.plan_addons WHERE addon_id = _old_id;

    -- Remove o addon duplicado
    DELETE FROM public.addons WHERE id = _old_id;
  END IF;
END $$;