import { supabase } from '@/integrations/supabase/client';
import { getDeviceFingerprint, getUserAgent } from '@/lib/security';

type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'password_reset_requested'
  | 'password_changed'
  | 'email_changed';

interface ReportOptions {
  email?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Reporta um evento de segurança ao backend.
 * Fire-and-forget: nunca lança erro ao chamador, falhas são silenciosas.
 */
export async function reportSecurityEvent(
  type: SecurityEventType,
  opts: ReportOptions = {}
): Promise<void> {
  try {
    await supabase.functions.invoke('security-events', {
      body: {
        type,
        email: opts.email,
        fingerprint: getDeviceFingerprint(),
        user_agent: getUserAgent(),
        metadata: opts.metadata ?? {},
      },
    });
  } catch {
    /* silencioso por design */
  }
}

/** Verifica se o e-mail está em lockout. Retorna { locked, retry_after_seconds?, message? }. */
export async function checkLoginLockout(email: string): Promise<{
  locked: boolean;
  retry_after_seconds?: number;
  message?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('check_login_lockout', {
      _identifier: email.trim().toLowerCase(),
    });
    if (error || !data) return { locked: false };
    return data as { locked: boolean; retry_after_seconds?: number; message?: string };
  } catch {
    return { locked: false };
  }
}
