
CREATE OR REPLACE FUNCTION public.admin_update_user_email(_user_id uuid, _new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update user emails';
  END IF;

  IF _new_email IS NULL OR _new_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = _new_email AND id <> _user_id) THEN
    RAISE EXCEPTION 'Email already in use by another user';
  END IF;

  UPDATE auth.users
  SET email = _new_email,
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', _new_email),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = _user_id;

  UPDATE public.profiles SET email = _new_email WHERE user_id = _user_id;
END;
$function$;
