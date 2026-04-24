import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type Credits = {
  balance: number;
  monthly_allocation: number;
  monthly_reset_at: string;
};

export const useCredits = () => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredits = useCallback(async () => {
    if (!user) {
      setCredits(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('user_credits')
      .select('balance, monthly_allocation, monthly_reset_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setCredits(data as Credits);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-credits-changes-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_credits', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new) setCredits(payload.new as Credits);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { credits, loading, refresh: fetchCredits };
};
