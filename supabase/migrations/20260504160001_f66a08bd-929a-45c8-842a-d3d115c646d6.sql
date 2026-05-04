CREATE OR REPLACE FUNCTION public.admin_set_turnstile_hostname_configured(_hostname text, _configured boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.turnstile_hostnames%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'permission_denied');
  END IF;

  IF _hostname IS NULL OR length(trim(_hostname)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_hostname');
  END IF;

  UPDATE public.turnstile_hostnames
     SET configured = _configured,
         last_error = CASE WHEN _configured THEN NULL ELSE last_error END,
         last_error_at = CASE WHEN _configured THEN NULL ELSE last_error_at END
   WHERE hostname = lower(trim(_hostname))
   RETURNING * INTO _row;

  IF _row.hostname IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'hostname', _row.hostname, 'configured', _row.configured);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_turnstile_hostname_configured(text, boolean) TO authenticated;