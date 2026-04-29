import { supabase } from '@/integrations/supabase/client';

export type PdfCustomization = {
  logo_url: string | null;
  brand_name: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  cover_title: string | null;
  cover_subtitle: string | null;
  cover_image_url: string | null;
  header_text: string | null;
  footer_text: string | null;
  watermark_text: string | null;
  watermark_opacity: number;
  templates: any[];
  active_template_id: string | null;
  custom_fields: Record<string, any>;
  layout: 'modern' | 'classic' | 'minimal';
};

export const DEFAULT_PDF_CUSTOMIZATION: PdfCustomization = {
  logo_url: null,
  brand_name: null,
  primary_color: '#0c4a6e',
  secondary_color: '#1e3a8a',
  accent_color: '#0ea5e9',
  font_family: 'Inter',
  cover_title: null,
  cover_subtitle: null,
  cover_image_url: null,
  header_text: null,
  footer_text: null,
  watermark_text: null,
  watermark_opacity: 0.1,
  templates: [],
  active_template_id: null,
  custom_fields: {},
  layout: 'modern',
};

export async function fetchPdfCustomization(userId: string): Promise<PdfCustomization | null> {
  try {
    // Check if user has the addon active
    const { data: hasIt } = await supabase.rpc('user_has_addon', {
      _user_id: userId,
      _addon_slug: 'pdf-customization',
    });
    if (!hasIt) return null;

    const { data } = await supabase
      .from('pdf_customizations')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) return DEFAULT_PDF_CUSTOMIZATION;

    const templates = (data.templates as any[]) || [];
    const active = templates.find((t: any) => t.id === data.active_template_id);
    const layout = (active?.layout as PdfCustomization['layout']) || 'modern';

    return {
      ...DEFAULT_PDF_CUSTOMIZATION,
      ...(data as any),
      templates,
      custom_fields: (data.custom_fields as any) || {},
      layout,
    };
  } catch {
    return null;
  }
}

/**
 * Returns hex color with alpha (e.g. #0ea5e9 + 0.1 -> rgba)
 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
