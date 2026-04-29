import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type Addon = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  price_brl: number;
  credits_cost: number;
  billing_type: 'one_time' | 'monthly';
  features: string[];
  is_active: boolean;
  sort_order: number;
};

export type UserAddon = {
  id: string;
  addon_id: string;
  status: 'active' | 'expired' | 'cancelled';
  billing_type: string;
  activated_at: string;
  expires_at: string | null;
  payment_method: string | null;
};

export const useUserAddons = () => {
  const { user } = useAuth();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [userAddons, setUserAddons] = useState<UserAddon[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: ua }] = await Promise.all([
      supabase.from('addons').select('*').eq('is_active', true).order('sort_order'),
      user ? supabase.from('user_addons').select('*').eq('user_id', user.id) : Promise.resolve({ data: [] as any }),
    ]);
    setAddons((a as Addon[]) || []);
    setUserAddons((ua as UserAddon[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Sync entre instâncias do hook (DashboardLayout, Addons page, etc.)
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('user-addons:refresh', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('user-addons:refresh', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refresh]);

  const refreshAll = useCallback(async () => {
    await refresh();
    window.dispatchEvent(new Event('user-addons:refresh'));
  }, [refresh]);

  const hasAddon = useCallback((slug: string) => {
    const addon = addons.find(a => a.slug === slug);
    if (!addon) return false;
    const ua = userAddons.find(x => x.addon_id === addon.id && x.status === 'active');
    if (!ua) return false;
    if (ua.expires_at && new Date(ua.expires_at) < new Date()) return false;
    return true;
  }, [addons, userAddons]);

  return { addons, userAddons, loading, refresh, hasAddon };
};
