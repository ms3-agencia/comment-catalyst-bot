import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, profile: null, isAdmin: false, loading: true,
  signOut: async () => {}, refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // ---- Session-log tracking ----
  // Persisted across reloads so we can close the row on logout.
  const SESSION_LOG_KEY = 'ycaptura_session_log_id';
  const SESSION_LOG_START_KEY = 'ycaptura_session_log_start';

  const startSessionLog = async (userId: string) => {
    try {
      if (typeof window === 'undefined') return;
      // Avoid duplicating: if we already have an open log for this user in this tab, skip
      if (sessionStorage.getItem(SESSION_LOG_KEY)) return;
      const { data, error } = await supabase
        .from('user_session_logs')
        .insert({
          user_id: userId,
          login_at: new Date().toISOString(),
          user_agent: navigator.userAgent.slice(0, 500),
        })
        .select('id')
        .single();
      if (error) return;
      sessionStorage.setItem(SESSION_LOG_KEY, data.id);
      sessionStorage.setItem(SESSION_LOG_START_KEY, Date.now().toString());
    } catch { /* noop */ }
  };

  const closeSessionLog = async () => {
    try {
      if (typeof window === 'undefined') return;
      const id = sessionStorage.getItem(SESSION_LOG_KEY);
      const startStr = sessionStorage.getItem(SESSION_LOG_START_KEY);
      if (!id) return;
      const start = startStr ? parseInt(startStr, 10) : Date.now();
      const duration = Math.max(1, Math.floor((Date.now() - start) / 1000));
      await supabase
        .from('user_session_logs')
        .update({ logout_at: new Date().toISOString(), duration_seconds: duration })
        .eq('id', id);
      sessionStorage.removeItem(SESSION_LOG_KEY);
      sessionStorage.removeItem(SESSION_LOG_START_KEY);
    } catch { /* noop */ }
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
    if (data) setProfile(data as Profile);

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    setIsAdmin(roles?.some(r => r.role === 'admin') ?? false);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // If token refresh failed or user signed out, clear local state to avoid sending expired JWTs
      if (event === 'TOKEN_REFRESHED' && !session) {
        await supabase.auth.signOut();
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
        if (event === 'SIGNED_IN') {
          setTimeout(() => startSessionLog(session.user.id), 0);
        }
      } else {
        if (event === 'SIGNED_OUT') {
          await closeSessionLog();
        }
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    (async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      // If session exists but is already expired, sign out so future requests use anon key
      if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        setSession(refreshData.session);
        setUser(refreshData.session.user);
        if (refreshData.session.user) {
          fetchProfile(refreshData.session.user.id);
          startSessionLog(refreshData.session.user.id);
        }
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        startSessionLog(session.user.id);
      }
      setLoading(false);
    })();

    // Close session log when the tab is closed / navigated away
    const handleUnload = () => {
      try {
        const id = sessionStorage.getItem(SESSION_LOG_KEY);
        const startStr = sessionStorage.getItem(SESSION_LOG_START_KEY);
        if (!id) return;
        const start = startStr ? parseInt(startStr, 10) : Date.now();
        const duration = Math.max(1, Math.floor((Date.now() - start) / 1000));
        // Fire-and-forget; we don't await on unload
        supabase
          .from('user_session_logs')
          .update({ logout_at: new Date().toISOString(), duration_seconds: duration })
          .eq('id', id);
        sessionStorage.removeItem(SESSION_LOG_KEY);
        sessionStorage.removeItem(SESSION_LOG_START_KEY);
      } catch { /* noop */ }
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const signOut = async () => {
    await closeSessionLog();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
