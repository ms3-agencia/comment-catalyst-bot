import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserAddons } from './useUserAddons';

export type LogoFormatKey =
  | 'instagram-feed'
  | 'instagram-story'
  | 'instagram-reels'
  | 'tiktok'
  | 'youtube-short'
  | 'youtube-thumb';

export type LogoPosition = {
  x: number; // 0..1 (fração da largura, canto sup-esq do logo)
  y: number; // 0..1
  size: number; // % da largura do canvas (5..50)
  opacity: number; // 0..1
};

export type LogoCustomization = {
  id?: string;
  logo_url: string | null;
  default_size_percent: number;
  default_opacity: number;
  positions: Partial<Record<LogoFormatKey, LogoPosition>>;
  apply_on_images: boolean;
  apply_on_videos: boolean;
};

export const FORMATS: { key: LogoFormatKey; label: string; ratio: string; w: number; h: number; network: string }[] = [
  { key: 'instagram-feed', label: 'Instagram Feed', ratio: '1:1', w: 1080, h: 1080, network: 'Instagram' },
  { key: 'instagram-story', label: 'Instagram Story', ratio: '9:16', w: 1080, h: 1920, network: 'Instagram' },
  { key: 'instagram-reels', label: 'Instagram Reels', ratio: '9:16', w: 1080, h: 1920, network: 'Instagram' },
  { key: 'tiktok', label: 'TikTok', ratio: '9:16', w: 1080, h: 1920, network: 'TikTok' },
  { key: 'youtube-short', label: 'YouTube Short', ratio: '9:16', w: 1080, h: 1920, network: 'YouTube' },
  { key: 'youtube-thumb', label: 'YouTube Thumb', ratio: '16:9', w: 1280, h: 720, network: 'YouTube' },
];

export const DEFAULT_LOGO: LogoCustomization = {
  logo_url: null,
  default_size_percent: 15,
  default_opacity: 1,
  positions: {},
  apply_on_images: true,
  apply_on_videos: true,
};

export const defaultPositionFor = (key: LogoFormatKey): LogoPosition => ({
  x: 0.04, y: 0.04, size: 15, opacity: 1,
});

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const useLogoCustomization = () => {
  const { user } = useAuth();
  const { hasAddon } = useUserAddons();
  const enabled = hasAddon('custom-logo');
  const [data, setData] = useState<LogoCustomization>(DEFAULT_LOGO);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs para debounce
  const pendingRef = useRef<LogoCustomization | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: row } = await supabase
      .from('logo_customizations')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (row) {
      setData({
        id: row.id,
        logo_url: row.logo_url,
        default_size_percent: Number(row.default_size_percent ?? 15),
        default_opacity: Number(row.default_opacity ?? 1),
        positions: (row.positions as any) || {},
        apply_on_images: row.apply_on_images,
        apply_on_videos: row.apply_on_videos,
      });
    } else {
      setData(DEFAULT_LOGO);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realiza o flush no banco usando o último estado pendente
  const flush = useCallback(async () => {
    if (!user || !pendingRef.current) return;
    const snapshot = pendingRef.current;
    pendingRef.current = null;
    setSaveStatus('saving');
    const { error } = await supabase.from('logo_customizations').upsert({
      user_id: user.id,
      logo_url: snapshot.logo_url,
      default_size_percent: snapshot.default_size_percent,
      default_opacity: snapshot.default_opacity,
      positions: snapshot.positions as any,
      apply_on_images: snapshot.apply_on_images,
      apply_on_videos: snapshot.apply_on_videos,
    }, { onConflict: 'user_id' });
    if (error) {
      setSaveStatus('error');
      console.error('Erro ao salvar logo customization:', error);
      return;
    }
    setSaveStatus('saved');
    setLastSavedAt(new Date());
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1800);
  }, [user]);

  /**
   * save(patch, opts):
   *  - Atualiza o estado local imediatamente (UI otimista).
   *  - Agenda gravação debounced no banco (default 600ms).
   *  - opts.immediate: força gravação imediata (ex.: upload de logo, toggle).
   */
  const save = useCallback((patch: Partial<LogoCustomization>, opts?: { immediate?: boolean; debounceMs?: number }) => {
    setData(prev => {
      const merged = { ...prev, ...patch };
      pendingRef.current = merged;
      return merged;
    });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (opts?.immediate) {
      void flush();
    } else {
      debounceRef.current = setTimeout(() => { void flush(); }, opts?.debounceMs ?? 600);
    }
  }, [flush]);

  // Garante flush ao desmontar / sair da página
  useEffect(() => {
    const handleUnload = () => { void flush(); };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void flush();
    };
  }, [flush]);

  const getPosition = useCallback((key: LogoFormatKey): LogoPosition => {
    return data.positions[key] || { ...defaultPositionFor(key), size: data.default_size_percent, opacity: data.default_opacity };
  }, [data]);

  return { enabled, data, loading, save, refresh, getPosition, saveStatus, lastSavedAt, flush };
};

/**
 * Aplica overlay do logo numa imagem (URL ou data URL) e retorna data URL PNG.
 */
export async function applyLogoOverlay(
  imageUrl: string,
  logoUrl: string,
  pos: LogoPosition,
): Promise<string> {
  const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const [base, logo] = await Promise.all([loadImg(imageUrl), loadImg(logoUrl)]);
  const canvas = document.createElement('canvas');
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(base, 0, 0);
  const targetW = (pos.size / 100) * canvas.width;
  const ratio = logo.naturalHeight / logo.naturalWidth;
  const targetH = targetW * ratio;
  const x = pos.x * canvas.width;
  const y = pos.y * canvas.height;
  ctx.globalAlpha = pos.opacity;
  ctx.drawImage(logo, x, y, targetW, targetH);
  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/png');
}
