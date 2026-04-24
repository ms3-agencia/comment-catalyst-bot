import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Branding = {
  site_name: string;
  tagline: string | null;
  footer_text: string | null;
  logo_url: string | null;
};

const DEFAULTS: Record<'landing' | 'pdf', Branding> = {
  landing: {
    site_name: 'CommentIQ',
    tagline: 'Análise de Audiência com IA',
    footer_text: '© 2026 CommentIQ. Todos os direitos reservados.',
    logo_url: null,
  },
  pdf: {
    site_name: 'CommentIQ',
    tagline: 'Análise de Audiência com IA',
    footer_text: 'Gerado por CommentIQ — Análise inteligente de audiência',
    logo_url: null,
  },
};

export const useBranding = (context: 'landing' | 'pdf') => {
  const [branding, setBranding] = useState<Branding>(DEFAULTS[context]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('branding_settings')
        .select('site_name, tagline, footer_text, logo_url')
        .eq('context', context)
        .maybeSingle();
      if (active && data) setBranding({ ...DEFAULTS[context], ...data });
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [context]);

  return { branding, loading };
};

// One-shot fetch for use outside React (e.g., PDF export)
export const fetchBranding = async (context: 'landing' | 'pdf'): Promise<Branding> => {
  const { data } = await supabase
    .from('branding_settings')
    .select('site_name, tagline, footer_text, logo_url')
    .eq('context', context)
    .maybeSingle();
  return { ...DEFAULTS[context], ...(data ?? {}) };
};
