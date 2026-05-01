import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type PlanUsage = {
  plan: 'free' | 'pro' | 'enterprise';
  projects_used: number;
  projects_limit: number | null; // null = ilimitado
  projects_remaining: number | null;
  credits_balance: number;
  credits_monthly_allocation: number;
};

/** Reads a user's plan limits + current usage (projects + credits) from the server. */
export const usePlanUsage = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setUsage(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase.rpc('get_user_plan_usage', { _user_id: user.id });
    const res = data as any;
    if (res?.success) {
      setUsage({
        plan: res.plan,
        projects_used: res.projects_used ?? 0,
        projects_limit: res.projects_limit ?? null,
        projects_remaining: res.projects_remaining ?? null,
        credits_balance: res.credits_balance ?? 0,
        credits_monthly_allocation: res.credits_monthly_allocation ?? 0,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-check whenever projects or credits tables change for this user
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`plan-usage-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_credits', filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  /** Check upfront whether the user can afford a credit-based action. */
  const checkAffordable = useCallback(async (actionKey: string) => {
    const { data, error } = await supabase.rpc('check_action_affordable', { _action_key: actionKey });
    if (error) return { affordable: false, balance: 0, cost: 0, error: error.message };
    return data as { affordable: boolean; balance: number; cost: number; action_key: string; error?: string };
  }, []);

  return { usage, loading, refresh, checkAffordable };
};
