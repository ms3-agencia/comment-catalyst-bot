import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_ID = 'cf-turnstile-script';

function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    if (window.turnstile) return resolve();
    if (document.getElementById(SCRIPT_ID)) {
      const check = setInterval(() => {
        if (window.turnstile) { clearInterval(check); resolve(); }
      }, 50);
      return;
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

let cachedSiteKey: string | null | undefined;
async function fetchSiteKey(): Promise<string | null> {
  if (cachedSiteKey !== undefined) return cachedSiteKey ?? null;
  try {
    const { data } = await supabase.rpc('get_turnstile_site_key');
    cachedSiteKey = (data as string | null) || null;
  } catch {
    cachedSiteKey = null;
  }
  return cachedSiteKey;
}

interface Props {
  onToken: (token: string | null) => void;
  /** Quando false, o componente não é exibido — útil enquanto carrega config. */
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Cloudflare Turnstile invisível/managed.
 * Se o admin não configurou a site_key, o componente não aparece e
 * o callback dispara com `null` (caller deve tratar como "captcha desativado").
 */
export const TurnstileWidget = ({ onToken, theme = 'dark' }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [siteKey, setSiteKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetchSiteKey().then((k) => {
      setSiteKey(k);
      if (!k) onToken(null);
    });
    // Registra hostname para monitoramento (admin) — não bloqueia render
    if (typeof window !== 'undefined') {
      try {
        supabase.rpc('register_turnstile_hostname', { _hostname: window.location.hostname }).then(() => {});
      } catch { /* noop */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;
    loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: (token: string) => onToken(token),
        'error-callback': (code?: string) => {
          onToken(null);
          try {
            supabase.rpc('register_turnstile_hostname', {
              _hostname: window.location.hostname,
              _error: `turnstile_error_${code || 'unknown'}`,
            }).then(() => {});
          } catch { /* noop */ }
        },
        'expired-callback': () => onToken(null),
        'timeout-callback': () => onToken(null),
      });
    });
    return () => {
      cancelled = true;
      try {
        if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      } catch { /* noop */ }
      widgetIdRef.current = null;
    };
  }, [siteKey, theme, onToken]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center" />;
};

export const isTurnstileConfigured = async (): Promise<boolean> => {
  const k = await fetchSiteKey();
  return !!k;
};
