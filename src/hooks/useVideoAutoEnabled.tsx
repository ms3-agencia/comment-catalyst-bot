import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Reads the global "video_ai_auto_enabled" flag set by admins in
 * Admin → Integrações IA de Vídeos. When false, the "Gerar vídeo
 * automaticamente" button must be hidden across the app.
 *
 * Default: true (button visible) when the setting is missing.
 */
export function useVideoAutoEnabled() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'video_ai_auto_enabled')
        .maybeSingle();
      if (cancelled) return;
      // missing row => default ON
      setEnabled(data ? data.value === 'true' : true);
      setLoading(false);
    })();

    // Realtime: any admin toggle reflects immediately for active users
    const channel = supabase
      .channel('video-auto-enabled')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.video_ai_auto_enabled' },
        (payload) => {
          const next = (payload.new as any)?.value;
          if (payload.eventType === 'DELETE') setEnabled(true);
          else if (next !== undefined) setEnabled(next === 'true');
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { enabled, loading };
}
