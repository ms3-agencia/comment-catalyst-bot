import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
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
  const currentUserRef = useRef<User | null>(null);
  const explicitSignOutRef = useRef(false);
  const recoveringSessionRef = useRef(false);
  const recoveryTimerRef = useRef<number | null>(null);

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

  const clearAuthState = () => {
    currentUserRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const applyAuthSession = (nextSession: Session | null, event?: string) => {
    currentUserRef.current = nextSession?.user ?? null;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession?.user) {
      setTimeout(() => fetchProfile(nextSession.user.id), 0);
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setTimeout(() => startSessionLog(nextSession.user.id), 0);
      }
    } else {
      setProfile(null);
      setIsAdmin(false);
    }

    setLoading(false);
  };

  const scheduleSessionRecovery = () => {
    if (typeof window === 'undefined' || recoveryTimerRef.current) return;
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null;
      void recoverSession();
    }, 5000);
  };

  const recoverSession = async () => {
    if (recoveringSessionRef.current) return;
    recoveringSessionRef.current = true;

    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session) {
        applyAuthSession(refreshData.session, 'INITIAL_SESSION');
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && sessionData.session) {
        applyAuthSession(sessionData.session, 'INITIAL_SESSION');
        return;
      }

      if (explicitSignOutRef.current || !currentUserRef.current) {
        clearAuthState();
        setLoading(false);
        return;
      }

      setLoading(false);
      scheduleSessionRecovery();
    } catch {
      if (explicitSignOutRef.current || !currentUserRef.current) {
        clearAuthState();
      }
      setLoading(false);
      if (!explicitSignOutRef.current && currentUserRef.current) scheduleSessionRecovery();
    } finally {
      recoveringSessionRef.current = false;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && !session) {
        setTimeout(() => { void recoverSession(); }, 0);
        return;
      }

      if (event === 'SIGNED_OUT') {
        if (explicitSignOutRef.current) {
          setTimeout(() => { closeSessionLog(); }, 0);
          clearAuthState();
          setLoading(false);
        } else {
          setTimeout(() => { void recoverSession(); }, 0);
        }
        return;
      }

      explicitSignOutRef.current = false;
      applyAuthSession(session, event);
    });

    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          await recoverSession();
          return;
        }

        if (!session) {
          setLoading(false);
          return;
        }

        if (session.expires_at && session.expires_at * 1000 < Date.now()) {
          await recoverSession();
          return;
        }

        applyAuthSession(session, 'INITIAL_SESSION');
      } catch {
        await recoverSession();
      }
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
      if (recoveryTimerRef.current) {
        window.clearTimeout(recoveryTimerRef.current);
      }
    };
  }, []);

  const forceLogoutAndRedirect = async (reason: string) => {
    if (explicitSignOutRef.current) return;
    explicitSignOutRef.current = true;
    try { await closeSessionLog(); } catch { /* noop */ }
    try { await supabase.auth.signOut({ scope: 'local' } as any); } catch { /* noop */ }
    clearAuthState();
    setLoading(false);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?reason=${encodeURIComponent(reason)}&next=${next}`);
    }
  };

  // Detecta JWT inválido / sessão removida em respostas Supabase e força logout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalFetch = window.fetch.bind(window);
    let supaHost = '';
    try { supaHost = new URL((import.meta as any).env?.VITE_SUPABASE_URL || '').host; } catch { /* noop */ }

    const isAuthInvalidResponse = async (res: Response): Promise<boolean> => {
      if (res.status !== 401 && res.status !== 403) return false;
      try {
        const text = await res.clone().text();
        const lower = text.toLowerCase();
        return (
          lower.includes('session_not_found') ||
          lower.includes('jwt expired') ||
          lower.includes('invalid jwt') ||
          lower.includes('invalid_token') ||
          lower.includes('bad_jwt') ||
          lower.includes('does not exist')
        );
      } catch { return false; }
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input as any, init);
      try {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
        if (supaHost && url && url.includes(supaHost) && currentUserRef.current) {
          if (await isAuthInvalidResponse(res)) {
            void forceLogoutAndRedirect('session_expired');
          }
        }
      } catch { /* noop */ }
      return res;
    };

    return () => { window.fetch = originalFetch; };
  }, []);

  const signOut = async () => {
    explicitSignOutRef.current = true;
    await closeSessionLog();
    await supabase.auth.signOut();
    clearAuthState();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
