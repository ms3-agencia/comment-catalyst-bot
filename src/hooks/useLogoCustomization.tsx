import { useEffect, useState, useCallback } from 'react';
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

export const useLogoCustomization = () => {
  const { user } = useAuth();
  const { hasAddon } = useUserAddons();
  const enabled = hasAddon('custom-logo');
  const [data, setData] = useState<LogoCustomization>(DEFAULT_LOGO);
  const [loading, setLoading] = useState(true);

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

  const save = useCallback(async (patch: Partial<LogoCustomization>) => {
    if (!user) return;
    const merged = { ...data, ...patch };
    setData(merged);
    await supabase.from('logo_customizations').upsert({
      user_id: user.id,
      logo_url: merged.logo_url,
      default_size_percent: merged.default_size_percent,
      default_opacity: merged.default_opacity,
      positions: merged.positions as any,
      apply_on_images: merged.apply_on_images,
      apply_on_videos: merged.apply_on_videos,
    }, { onConflict: 'user_id' });
  }, [user, data]);

  const getPosition = useCallback((key: LogoFormatKey): LogoPosition => {
    return data.positions[key] || { ...defaultPositionFor(key), size: data.default_size_percent, opacity: data.default_opacity };
  }, [data]);

  return { enabled, data, loading, save, refresh, getPosition };
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
