
DO $$
DECLARE
  _user_id UUID;
  _existing UUID;
BEGIN
  SELECT id INTO _existing FROM auth.users WHERE email = 'admin@ycaptura.com';
  
  IF _existing IS NULL THEN
    _user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _user_id, 'authenticated', 'authenticated',
      'admin@ycaptura.com', extensions.crypt('Admin@2026!', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrador"}'::jsonb,
      false, '', '', '', ''
    );
    
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _user_id, jsonb_build_object('sub', _user_id::text, 'email', 'admin@ycaptura.com', 'email_verified', true), 'email', _user_id::text, now(), now(), now());
    
    -- Garantir role admin (handle_new_user já cria 'user', adicionamos 'admin')
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (_existing, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
