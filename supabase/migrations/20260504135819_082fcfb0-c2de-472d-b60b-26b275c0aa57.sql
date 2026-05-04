DO $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = extensions.crypt('TVInfluencer220505!@#', extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE email = 'sac@ms3.com.br';
END $$;