-- 1) Add max_projects column to plan_configs (NULL = unlimited)
ALTER TABLE public.plan_configs
  ADD COLUMN IF NOT EXISTS max_projects integer;

-- Defaults: Free=3, Pro=25, Enterprise=NULL (unlimited)
UPDATE public.plan_configs SET max_projects = 3   WHERE plan = 'free'       AND max_projects IS NULL;
UPDATE public.plan_configs SET max_projects = 25  WHERE plan = 'pro'        AND max_projects IS NULL;
UPDATE public.plan_configs SET max_projects = NULL WHERE plan = 'enterprise';

-- 2) Helper to compute project usage + plan limit for a user
CREATE OR REPLACE FUNCTION public.get_user_plan_usage(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan app_plan;
  _max_projects integer;
  _used_projects integer;
  _balance integer;
  _allocation integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE user_id = _user_id;
  IF _plan IS NULL THEN _plan := 'free'::app_plan; END IF;

  SELECT max_projects INTO _max_projects FROM public.plan_configs WHERE plan = _plan;

  SELECT count(*) INTO _used_projects FROM public.projects WHERE user_id = _user_id;

  SELECT balance, monthly_allocation INTO _balance, _allocation
  FROM public.user_credits WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'success', true,
    'plan', _plan,
    'projects_used', COALESCE(_used_projects, 0),
    'projects_limit', _max_projects,                         -- null = unlimited
    'projects_remaining', CASE WHEN _max_projects IS NULL THEN NULL
                              ELSE GREATEST(_max_projects - COALESCE(_used_projects, 0), 0) END,
    'credits_balance', COALESCE(_balance, 0),
    'credits_monthly_allocation', COALESCE(_allocation, 0)
  );
END;
$$;

-- 3) Server-side enforcement of project limit on INSERT via trigger
CREATE OR REPLACE FUNCTION public.enforce_project_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan app_plan;
  _max_projects integer;
  _used integer;
BEGIN
  -- Admins bypass plan limits
  IF public.has_role(NEW.user_id, 'admin') THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO _plan FROM public.profiles WHERE user_id = NEW.user_id;
  IF _plan IS NULL THEN _plan := 'free'::app_plan; END IF;

  SELECT max_projects INTO _max_projects FROM public.plan_configs WHERE plan = _plan;

  -- NULL = unlimited
  IF _max_projects IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _used FROM public.projects WHERE user_id = NEW.user_id;

  IF _used >= _max_projects THEN
    RAISE EXCEPTION 'plan_project_limit_reached: Seu plano (%) permite no máximo % projetos. Faça upgrade para criar mais.', _plan, _max_projects
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_plan_limit ON public.projects;
CREATE TRIGGER trg_enforce_project_plan_limit
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_project_plan_limit();

-- 4) Pre-check helper for credit-based actions (UX: check before invoking edge function)
CREATE OR REPLACE FUNCTION public.check_action_affordable(_action_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cost integer;
  _balance integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('affordable', false, 'error', 'not_authenticated');
  END IF;

  SELECT cost INTO _cost FROM public.credit_action_costs WHERE action_key = _action_key;
  IF _cost IS NULL THEN
    RETURN jsonb_build_object('affordable', false, 'error', 'unknown_action');
  END IF;

  SELECT balance INTO _balance FROM public.user_credits WHERE user_id = _uid;
  _balance := COALESCE(_balance, 0);

  RETURN jsonb_build_object(
    'affordable', _balance >= _cost,
    'balance', _balance,
    'cost', _cost,
    'action_key', _action_key
  );
END;
$$;