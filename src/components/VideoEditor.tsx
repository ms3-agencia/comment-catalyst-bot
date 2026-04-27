import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCredits } from '@/hooks/useCredits';
import { supabase } from '@/integrations/supabase/client';
import {
  Loader2, Download, Play, Pause, X, Wand2, ImagePlus, Type, Coins,
  ZoomIn, ZoomOut, MoveRight, MoveLeft, Sparkles, RefreshCw, Plus, Trash2,
  Settings2, Film,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { AudioPanel } from './video/AudioPanel';
import { defaultSceneAudio, type SceneAudio, type GlobalAudio } from './video/audioTypes';
import { buildMixedAudioTrack } from './video/audioMixer';
import { RenderHistoryDialog } from './video/RenderHistoryDialog';
import { Progress } from '@/components/ui/progress';
import { History } from 'lucide-react';
import {
  loadProvidersAndCosts, selectWeightedProvider, computeRenderCost, chargeRenderCredits,
  type ProviderRow as PSRow, type ResolvedProvider, type CostMap,
} from '@/lib/providerSelector';

// =================== Tipos ===================
type ImageEffect = 'none' | 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'pan_up' | 'pan_down';
type TextEffect = 'fade' | 'typewriter' | 'slide_up' | 'slide_left' | 'bounce' | 'pop' | 'wave' | 'none';
type TextPosition = 'top' | 'center' | 'bottom';
type FontFamily = 'sans' | 'serif' | 'mono' | 'display';

const FONT_MAP: Record<FontFamily, string> = {
  sans: 'Inter, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "Courier New", monospace',
  display: '"Space Grotesk", system-ui, sans-serif',
};

export type Scene = {
  id: string;
  text: string;
  imageUrl: string | null;
  imagePrompt?: string;
  duration: number; // seconds
  imageEffect: ImageEffect;
  textEffect: TextEffect;
  textPosition: TextPosition;
  textColor: string;
  textBg: string; // 'none' | hex (with alpha as rgba)
  fontFamily: FontFamily;
  fontSize: number; // 0.5..1.5 multiplier
  audio: SceneAudio;
};

type SourceContent = {
  id: string;
  title: string | null;
  caption: string | null;
  cta: string | null;
  script: string | null;
  hashtags: string[] | null;
  image_url?: string | null;
  social_network: string;
  content_type: string;
};

type VideoFormat = { ratio: string; w: number; h: number; label: string };

const VIDEO_FORMATS: VideoFormat[] = [
  { ratio: '9:16', w: 1080, h: 1920, label: 'Vertical 9:16 (Reels/Shorts/TikTok)' },
  { ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado 1:1' },
  { ratio: '16:9', w: 1920, h: 1080, label: 'Horizontal 16:9 (YouTube)' },
  { ratio: '4:5', w: 1080, h: 1350, label: 'Vertical 4:5 (Feed)' },
];

const IMAGE_EFFECTS: { key: ImageEffect; label: string }[] = [
  { key: 'zoom_in', label: 'Zoom In' },
  { key: 'zoom_out', label: 'Zoom Out' },
  { key: 'pan_left', label: 'Pan ←' },
  { key: 'pan_right', label: 'Pan →' },
  { key: 'pan_up', label: 'Pan ↑' },
  { key: 'pan_down', label: 'Pan ↓' },
  { key: 'none', label: 'Sem efeito' },
];

const TEXT_EFFECTS: { key: TextEffect; label: string }[] = [
  { key: 'fade', label: 'Fade' },
  { key: 'typewriter', label: 'Typewriter' },
  { key: 'slide_up', label: 'Slide ↑' },
  { key: 'slide_left', label: 'Slide ←' },
  { key: 'bounce', label: 'Bounce' },
  { key: 'pop', label: 'Pop' },
  { key: 'wave', label: 'Wave' },
  { key: 'none', label: 'Sem efeito' },
];

// =================== Helpers ===================
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeBounce = (t: number) => {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
};

function splitScriptIntoScenes(c: SourceContent): string[] {
  const out: string[] = [];
  if (c.title) out.push(c.title.trim());
  const body = (c.script || c.caption || '').trim();
  if (body) {
    // split by paragraphs / sentences
    const parts = body
      .split(/\n\n+|(?<=[.!?])\s+(?=[A-ZÀ-Ý])/)
      .map(s => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      // chunk long parts into ~140 chars
      if (p.length <= 160) out.push(p);
      else {
        const words = p.split(/\s+/);
        let buf = '';
        for (const w of words) {
          if ((buf + ' ' + w).trim().length > 140) {
            out.push(buf.trim());
            buf = w;
          } else buf = (buf + ' ' + w).trim();
        }
        if (buf) out.push(buf);
      }
    }
  }
  if (c.cta) out.push(c.cta.trim());
  return out.slice(0, 12); // safety cap
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export type StylePreset = {
  imageEffects: ImageEffect[];
  textEffects: TextEffect[];
  fonts: FontFamily[];
  textColors: string[];
  textBg: string;
  fontSize: number;
  textPosition: TextPosition;
};

const DEFAULT_PRESET: StylePreset = {
  imageEffects: ['zoom_in', 'pan_right', 'zoom_out', 'pan_left', 'pan_up'],
  textEffects: ['fade', 'slide_up', 'typewriter', 'pop', 'slide_left', 'bounce'],
  fonts: ['display', 'sans'],
  textColors: ['#ffffff'],
  textBg: 'rgba(0,0,0,0.45)',
  fontSize: 1.0,
  textPosition: 'bottom',
};

function buildInitialScenes(content: SourceContent, preset: StylePreset = DEFAULT_PRESET): Scene[] {
  const texts = splitScriptIntoScenes(content);
  const fallbackImg = content.image_url || null;
  const imgFx = preset.imageEffects.length ? preset.imageEffects : DEFAULT_PRESET.imageEffects;
  const txtFx = preset.textEffects.length ? preset.textEffects : DEFAULT_PRESET.textEffects;
  const fonts = preset.fonts.length ? preset.fonts : DEFAULT_PRESET.fonts;
  const colors = preset.textColors.length ? preset.textColors : DEFAULT_PRESET.textColors;
  return texts.map((t, i) => ({
    id: uid(),
    text: t,
    imageUrl: fallbackImg,
    duration: Math.min(8, Math.max(3, Math.ceil(t.length / 18))),
    imageEffect: imgFx[i % imgFx.length],
    textEffect: txtFx[i % txtFx.length],
    textPosition: i === 0 ? 'center' : preset.textPosition,
    textColor: colors[i % colors.length],
    textBg: preset.textBg,
    fontFamily: i === 0 ? (fonts.includes('display') ? 'display' : fonts[0]) : fonts[i % fonts.length],
    fontSize: i === 0 ? Math.min(1.5, preset.fontSize * 1.15) : preset.fontSize,
    audio: defaultSceneAudio(),
  }));
}

// =================== Render Engine ===================
function drawImageWithEffect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number, H: number,
  effect: ImageEffect,
  progress: number, // 0..1 within scene
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  // cover scaling
  const baseScale = Math.max(W / iw, H / ih);
  let scale = baseScale;
  let offsetX = 0, offsetY = 0;
  const t = easeInOut(progress);
  switch (effect) {
    case 'zoom_in': scale = baseScale * (1 + 0.18 * t); break;
    case 'zoom_out': scale = baseScale * (1.18 - 0.18 * t); break;
    case 'pan_left': scale = baseScale * 1.1; offsetX = (1 - 2 * t) * (iw * scale * 0.05); break;
    case 'pan_right': scale = baseScale * 1.1; offsetX = (-1 + 2 * t) * (iw * scale * 0.05); break;
    case 'pan_up': scale = baseScale * 1.1; offsetY = (1 - 2 * t) * (ih * scale * 0.05); break;
    case 'pan_down': scale = baseScale * 1.1; offsetY = (-1 + 2 * t) * (ih * scale * 0.05); break;
  }
  const dw = iw * scale, dh = ih * scale;
  const dx = (W - dw) / 2 + offsetX;
  const dy = (H - dh) / 2 + offsetY;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawTextWithEffect(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  W: number, H: number,
  progress: number,
) {
  const baseFs = Math.round(W * 0.055 * scene.fontSize);
  ctx.font = `700 ${baseFs}px ${FONT_MAP[scene.fontFamily]}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const padding = W * 0.08;
  const maxWidth = W - padding * 2;
  const lines = wrapText(ctx, scene.text, maxWidth);
  const lineHeight = baseFs * 1.18;
  const totalH = lines.length * lineHeight;

  // animation duration ~ first 35% of scene
  const animEnd = 0.35;
  const tRaw = Math.min(1, progress / animEnd);
  let alpha = 1, dx = 0, dy = 0, scale = 1, charCutoff = 1;

  switch (scene.textEffect) {
    case 'fade':
      alpha = easeOut(tRaw);
      break;
    case 'slide_up':
      alpha = easeOut(tRaw);
      dy = (1 - easeOut(tRaw)) * H * 0.12;
      break;
    case 'slide_left':
      alpha = easeOut(tRaw);
      dx = (1 - easeOut(tRaw)) * W * 0.18;
      break;
    case 'pop':
      alpha = easeOut(tRaw);
      scale = 0.6 + 0.4 * easeOut(tRaw);
      break;
    case 'bounce':
      alpha = easeOut(tRaw);
      dy = (1 - easeBounce(tRaw)) * H * 0.1;
      break;
    case 'typewriter':
      charCutoff = tRaw;
      break;
    case 'wave':
      // animated continuously throughout scene
      break;
    case 'none':
      break;
  }

  // exit fade in last 10%
  if (progress > 0.9 && scene.textEffect !== 'none') {
    alpha *= 1 - (progress - 0.9) / 0.1;
  }

  let yCenter: number;
  if (scene.textPosition === 'top') yCenter = H * 0.18 + totalH / 2;
  else if (scene.textPosition === 'bottom') yCenter = H * 0.82 - totalH / 2;
  else yCenter = H / 2;

  // background
  if (scene.textBg && scene.textBg !== 'none') {
    const bgPadX = W * 0.04, bgPadY = baseFs * 0.4;
    const widest = Math.max(...lines.map(l => ctx.measureText(l).width));
    const bgW = Math.min(maxWidth + bgPadX * 2, widest + bgPadX * 2);
    const bgH = totalH + bgPadY * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = scene.textBg;
    const bgX = (W - bgW) / 2 + dx;
    const bgY = yCenter - totalH / 2 - bgPadY + dy;
    const r = 18;
    ctx.beginPath();
    ctx.moveTo(bgX + r, bgY);
    ctx.arcTo(bgX + bgW, bgY, bgX + bgW, bgY + bgH, r);
    ctx.arcTo(bgX + bgW, bgY + bgH, bgX, bgY + bgH, r);
    ctx.arcTo(bgX, bgY + bgH, bgX, bgY, r);
    ctx.arcTo(bgX, bgY, bgX + bgW, bgY, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = scene.textColor;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = baseFs * 0.18;

  const cx = W / 2 + dx;
  const startY = yCenter - totalH / 2 + lineHeight / 2 + dy;

  if (scene.textEffect === 'pop') {
    ctx.translate(cx, yCenter + dy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -(yCenter + dy));
  }

  if (scene.textEffect === 'typewriter') {
    const totalChars = scene.text.length;
    const visible = Math.max(0, Math.floor(totalChars * charCutoff));
    let consumed = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const remaining = visible - consumed;
      if (remaining <= 0) break;
      const slice = line.slice(0, remaining);
      ctx.fillText(slice, cx, startY + i * lineHeight);
      consumed += line.length + 1; // +1 for space
    }
  } else if (scene.textEffect === 'wave') {
    // letter-by-letter sine offset
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const totalLineWidth = ctx.measureText(line).width;
      let cursorX = cx - totalLineWidth / 2;
      ctx.textAlign = 'left';
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        const wOffset = Math.sin((progress * Math.PI * 4) + j * 0.4) * baseFs * 0.12;
        ctx.fillText(ch, cursorX, startY + i * lineHeight + wOffset);
        cursorX += ctx.measureText(ch).width;
      }
      ctx.textAlign = 'center';
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, startY + i * lineHeight);
    }
  }
  ctx.restore();
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function preloadAll(scenes: Scene[]): Promise<Map<string, HTMLImageElement>> {
  const cache = new Map<string, HTMLImageElement>();
  for (const s of scenes) {
    if (s.imageUrl && !cache.has(s.imageUrl)) {
      try { cache.set(s.imageUrl, await loadImage(s.imageUrl)); } catch { /* ignore */ }
    }
  }
  return cache;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  cache: Map<string, HTMLImageElement>,
  W: number, H: number,
  progress: number,
) {
  // background gradient fallback
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0b1220');
  grad.addColorStop(1, '#1a2540');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (scene.imageUrl) {
    const img = cache.get(scene.imageUrl);
    if (img) drawImageWithEffect(ctx, img, W, H, scene.imageEffect, progress);
  }
  // subtle vignette for legibility
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  if (scene.text) drawTextWithEffect(ctx, scene, W, H, progress);
}

// =================== Component ===================
type Props = {
  open: boolean;
  onClose: () => void;
  content: SourceContent;
  onImageRegen: (sceneIdx: number, prompt: string) => Promise<string | null>;
};

type GenKind = 'basic' | 'ai';
type ProviderRow = { provider: string; weight: number; config: any };

type Container = 'webm' | 'mp4';
type CodecKey = 'vp9' | 'vp8' | 'av1' | 'h264' | 'auto';
type QualityKey = 'low' | 'medium' | 'high' | 'ultra' | 'custom';
type ResolutionScale = 0.5 | 0.75 | 1 | 1.5;

const QUALITY_BITRATES: Record<Exclude<QualityKey, 'custom'>, number> = {
  low: 2_000,        // kbps
  medium: 4_000,
  high: 8_000,
  ultra: 14_000,
};

const CODEC_MIME: Record<CodecKey, string[]> = {
  vp9: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9'],
  vp8: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8'],
  av1: ['video/webm;codecs=av01,opus', 'video/webm;codecs=av01'],
  h264: ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1,mp4a', 'video/mp4'],
  auto: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'],
};

function pickSupportedMime(codec: CodecKey, container: Container): string {
  const candidates = container === 'mp4'
    ? ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', ...CODEC_MIME[codec]]
    : [...CODEC_MIME[codec], 'video/webm'];
  for (const m of candidates) {
    if ((window as any).MediaRecorder?.isTypeSupported?.(m)) return m;
  }
  return container === 'mp4' ? 'video/mp4' : 'video/webm';
}
export const VideoEditor = ({ open, onClose, content, onImageRegen }: Props) => {
  const { toast } = useToast();
  const { credits, refresh: refreshCredits } = useCredits();
  const isMobile = useIsMobile();

  const [format, setFormat] = useState<VideoFormat>(VIDEO_FORMATS[0]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0); // 0..total
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [costBasic, setCostBasic] = useState<number>(1); // per second
  const [costAi, setCostAi] = useState<number>(50); // per scene
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'preview' | 'edit'>('preview');

  const [genKind, setGenKind] = useState<GenKind>('basic');
  const [providersBasic, setProvidersBasic] = useState<ProviderRow[]>([]);
  const [providersAi, setProvidersAi] = useState<ProviderRow[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('browser_canvas');
  const [globalAudio, setGlobalAudio] = useState<GlobalAudio>({ musicUrl: null, musicVolume: 0.6 });
  const [presets, setPresets] = useState<Array<{ id: string; name: string; is_default: boolean; config: StylePreset }>>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Providers + costs (weighted selection)
  const [allProviders, setAllProviders] = useState<PSRow[]>([]);
  const [costsMap, setCostsMap] = useState<CostMap>({});
  const [resolvedVideo, setResolvedVideo] = useState<ResolvedProvider | null>(null);
  const [resolvedTts, setResolvedTts] = useState<ResolvedProvider | null>(null);
  const [resolvedMusic, setResolvedMusic] = useState<ResolvedProvider | null>(null);

  // ===== Export options =====
  const [container, setContainer] = useState<Container>('webm');
  const [codec, setCodec] = useState<CodecKey>('vp9');
  const [quality, setQuality] = useState<QualityKey>('high');
  const [customBitrate, setCustomBitrate] = useState<number>(6000); // kbps
  const [resolutionScale, setResolutionScale] = useState<ResolutionScale>(1);
  const [renderPhase, setRenderPhase] = useState<string>('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const renderStartRef = useRef<number>(0);
  const [renderEta, setRenderEta] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const playStartRef = useRef<number>(0);

  // init scenes when opened (uses default preset if loaded)
  useEffect(() => {
    if (open) {
      const def = presets.find(p => p.is_default) || presets[0];
      setScenes(buildInitialScenes(content, def?.config || DEFAULT_PRESET));
      setSelectedPresetId(def?.id || '');
      setActiveIdx(0);
      setPreviewProgress(0);
      setPlaying(false);
      const t = content.content_type;
      if (['reels', 'shorts', 'story', 'video'].includes(t) && content.social_network !== 'youtube') {
        setFormat(VIDEO_FORMATS[0]);
      } else if (t === 'video' && content.social_network === 'youtube') {
        setFormat(VIDEO_FORMATS[2]);
      } else {
        setFormat(VIDEO_FORMATS[1]);
      }
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, content, presets.length]);

  // load style presets
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('video_style_presets' as any)
        .select('id, name, is_default, config')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      setPresets(((data as any[]) || []).map(p => ({
        id: p.id, name: p.name, is_default: p.is_default,
        config: { ...DEFAULT_PRESET, ...(p.config || {}) },
      })));
    })();
  }, [open]);

  // load costs + providers (full set, used for weighted selection of all kinds)
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { providers, costs } = await loadProvidersAndCosts();
      setAllProviders(providers);
      setCostsMap(costs);

      // Keep legacy cost states for the existing UI labels
      if (costs.video_render_basic != null) setCostBasic(costs.video_render_basic);
      if (costs.video_render_ai != null) setCostAi(costs.video_render_ai);

      // Legacy basic/ai split (UI radio)
      const basics = providers.filter(p => p.kind === 'video_ai' && p.provider === 'browser_canvas')
        .map(p => ({ provider: p.provider, weight: p.weight, config: p.config }));
      const ais = providers.filter(p => p.kind === 'video_ai' && p.provider !== 'browser_canvas')
        .map(p => ({ provider: p.provider, weight: p.weight, config: p.config }));
      setProvidersBasic(basics);
      setProvidersAi(ais);
      if (basics.length) {
        setGenKind('basic');
        setSelectedProvider(basics[0].provider);
      } else if (ais.length) {
        setGenKind('ai');
        setSelectedProvider(ais[0].provider);
      }
    })();
  }, [open]);

  // Re-select weighted providers whenever the pool changes or genKind toggles
  useEffect(() => {
    if (!allProviders.length) return;
    const videoFilter = genKind === 'ai'
      ? (p: PSRow) => p.provider !== 'browser_canvas'
      : (p: PSRow) => p.provider === 'browser_canvas';
    setResolvedVideo(selectWeightedProvider(allProviders, 'video_ai', costsMap, videoFilter));
    setResolvedTts(selectWeightedProvider(allProviders, 'tts', costsMap, p => p.provider !== 'none'));
    setResolvedMusic(selectWeightedProvider(allProviders, 'music', costsMap, p => p.provider !== 'none'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProviders, costsMap, genKind]);

  const totalDuration = useMemo(() => scenes.reduce((s, x) => s + x.duration, 0), [scenes]);

  // narration character total (only counts scenes with narration enabled)
  const ttsCharsTotal = useMemo(() => scenes.reduce((s, sc) => {
    if (!sc.audio?.narrationEnabled) return s;
    if (sc.audio.narrationProvider === 'upload') return s; // uploads don't consume TTS
    const txt = (sc.audio.narrationText || sc.text || '').trim();
    return s + txt.length;
  }, 0), [scenes]);

  const hasMusic = !!globalAudio.musicUrl || scenes.some(s => s.audio?.musicUrl);

  const costBreakdown = useMemo(() => computeRenderCost({
    videoProvider: resolvedVideo,
    ttsProvider: resolvedTts,
    musicProvider: resolvedMusic,
    totalDurationSec: totalDuration,
    scenesCount: scenes.length,
    ttsCharsTotal,
    hasMusic,
  }), [resolvedVideo, resolvedTts, resolvedMusic, totalDuration, scenes.length, ttsCharsTotal, hasMusic]);

  const totalCost = costBreakdown.total || 1;
  const balance = credits?.balance ?? 0;
  const insufficient = balance < totalCost;
  const activeProviders = genKind === 'basic' ? providersBasic : providersAi;

  // preload images on scene change
  useEffect(() => {
    (async () => {
      cacheRef.current = await preloadAll(scenes);
      drawAt(previewProgress);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  const drawAt = (timeSec: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let acc = 0;
    let scene = scenes[0];
    let inSceneT = 0;
    for (const s of scenes) {
      if (timeSec < acc + s.duration) {
        scene = s;
        inSceneT = (timeSec - acc) / s.duration;
        break;
      }
      acc += s.duration;
    }
    if (!scene) return;
    const idx = scenes.indexOf(scene);
    if (idx !== activeIdx && playing) setActiveIdx(idx);
    drawScene(ctx, scene, cacheRef.current, c.width, c.height, Math.max(0, Math.min(1, inSceneT)));
  };

  // when activeIdx changes (manual selection), render that scene's start
  useEffect(() => {
    if (!playing) {
      let acc = 0;
      for (let i = 0; i < activeIdx; i++) acc += scenes[i]?.duration || 0;
      setPreviewProgress(acc);
      drawAt(acc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, format, scenes.length]);

  // play loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    playStartRef.current = performance.now() - previewProgress * 1000;
    const tick = () => {
      const elapsed = (performance.now() - playStartRef.current) / 1000;
      if (elapsed >= totalDuration) {
        setPlaying(false);
        setPreviewProgress(totalDuration);
        drawAt(totalDuration - 0.01);
        return;
      }
      setPreviewProgress(elapsed);
      drawAt(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const updateScene = (idx: number, patch: Partial<Scene>) => {
    setScenes(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeScene = (idx: number) => {
    setScenes(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(0);
  };

  const addScene = () => {
    const fallbackImg = scenes[0]?.imageUrl || content.image_url || null;
    setScenes(prev => [...prev, {
      id: uid(), text: 'Nova cena', imageUrl: fallbackImg, duration: 4,
      imageEffect: 'zoom_in', textEffect: 'fade', textPosition: 'center',
      textColor: '#ffffff', textBg: 'rgba(0,0,0,0.45)', fontFamily: 'sans', fontSize: 1.0,
      audio: defaultSceneAudio(),
    }]);
    setActiveIdx(scenes.length);
  };

  const handleRegen = async (idx: number) => {
    const sc = scenes[idx];
    if (!sc) return;
    setRegenIdx(idx);
    try {
      const url = await onImageRegen(idx, sc.text);
      if (url) {
        updateScene(idx, { imageUrl: url });
        cacheRef.current.set(url, await loadImage(url));
        drawAt(previewProgress);
        refreshCredits();
      }
    } finally {
      setRegenIdx(null);
    }
  };

  // ============= Render to MP4/WebM =============
  const exportVideo = async () => {
    if (!scenes.length) return;
    if (insufficient) {
      toast({
        title: 'Créditos insuficientes',
        description: `Necessário: ${totalCost}, disponível: ${balance}`,
        variant: 'destructive',
      });
      return;
    }
    if (genKind === 'ai') {
      toast({
        title: 'Geração por IA em breve',
        description: `Provedor "${selectedProvider}" ainda não está disponível para renderização. Use o modo Básico (Canvas).`,
        variant: 'destructive',
      });
      return;
    }
    setRendering(true);
    setRenderProgress(0);
    setRenderPhase('Iniciando…');
    setRenderEta('');
    renderStartRef.current = performance.now();

    // Compute output settings
    const W = Math.round(format.w * resolutionScale);
    const H = Math.round(format.h * resolutionScale);
    const bitrateKbps = quality === 'custom' ? customBitrate : QUALITY_BITRATES[quality];
    const mime = pickSupportedMime(codec, container);
    const finalContainer: Container = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const finalCodec = mime.includes('vp9') ? 'vp9'
      : mime.includes('vp8') ? 'vp8'
      : mime.includes('av01') ? 'av1'
      : mime.includes('h264') || mime.includes('avc1') ? 'h264'
      : codec;
    const presetName = presets.find(p => p.id === selectedPresetId)?.name || null;

    // Create history record
    let historyId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        const { data: rec } = await supabase
          .from('video_render_history' as any)
          .insert({
            user_id: uid,
            content_id: content.id,
            format_ratio: format.ratio,
            width: W,
            height: H,
            codec: finalCodec,
            container: finalContainer,
            bitrate_kbps: bitrateKbps,
            duration_seconds: totalDuration,
            scenes_count: scenes.length,
            credits_spent: 0,
            status: 'rendering',
            progress: 0,
            phase: 'Iniciando',
            preset_name: presetName,
          } as any)
          .select('id')
          .single();
        historyId = (rec as any)?.id || null;
      }
    } catch {}

    const updateHistory = async (patch: any) => {
      if (!historyId) return;
      await supabase.from('video_render_history' as any).update(patch as any).eq('id', historyId);
    };

    try {
      setRenderPhase('Cobrando créditos…');
      // Charge each component (video + tts + music) using weighted-selected providers
      const charge = await chargeRenderCredits({
        breakdown: costBreakdown.breakdown,
        referenceId: content.id,
      });
      if (!charge.success) {
        await updateHistory({ status: 'error', message: charge.error || 'Erro de cobrança', phase: 'Cobrança' });
        toast({
          title: charge.error === 'insufficient_credits' ? 'Créditos insuficientes' : 'Erro ao cobrar créditos',
          description: charge.error === 'insufficient_credits'
            ? `Necessário: ${totalCost}, disponível: ${charge.finalBalance ?? balance}`
            : (charge.error || 'Tente novamente'),
          variant: 'destructive',
        });
        setRendering(false);
        return;
      }
      await updateHistory({ credits_spent: totalCost });

      setRenderPhase('Carregando imagens…');
      await updateHistory({ phase: 'Carregando imagens', progress: 2 });
      cacheRef.current = await preloadAll(scenes);

      setRenderPhase('Preparando áudio…');
      await updateHistory({ phase: 'Preparando áudio', progress: 5 });

      const fps = 30;
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const ctx = off.getContext('2d')!;
      const stream = (off as any).captureStream(fps) as MediaStream;

      const audioSpecs = scenes.map(s => ({ duration: s.duration, text: s.text, audio: s.audio }));
      const mix = await buildMixedAudioTrack(globalAudio, audioSpecs).catch(() => null);
      if (mix?.track) stream.addTrack(mix.track);

      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: bitrateKbps * 1000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      const stopped = new Promise<void>(res => {
        recorder.onstop = async () => { await mix?.cleanup?.(); res(); };
      });
      recorder.start(100);

      setRenderPhase('Renderizando frames…');
      const totalFrames = Math.ceil(totalDuration * fps);
      const frameMs = 1000 / fps;
      let sceneStart = 0;
      let sIdx = 0;
      let lastHistoryUpdate = 0;
      for (let f = 0; f < totalFrames; f++) {
        const tSec = f / fps;
        while (sIdx < scenes.length && tSec >= sceneStart + scenes[sIdx].duration) {
          sceneStart += scenes[sIdx].duration;
          sIdx++;
        }
        const scene = scenes[Math.min(sIdx, scenes.length - 1)];
        const inSceneT = (tSec - sceneStart) / scene.duration;
        drawScene(ctx, scene, cacheRef.current, W, H, Math.max(0, Math.min(1, inSceneT)));
        await new Promise(r => setTimeout(r, frameMs * 0.5));
        if (f % 5 === 0) {
          const pct = Math.round((f / totalFrames) * 95);
          setRenderProgress(pct);
          // ETA
          const elapsed = (performance.now() - renderStartRef.current) / 1000;
          if (f > 10) {
            const remaining = Math.max(0, (elapsed / f) * (totalFrames - f));
            setRenderEta(`~${Math.ceil(remaining)}s restantes`);
          }
          // Persist history every ~3s
          const now = performance.now();
          if (historyId && now - lastHistoryUpdate > 3000) {
            lastHistoryUpdate = now;
            updateHistory({ progress: pct, phase: `Renderizando cena ${Math.min(sIdx + 1, scenes.length)}/${scenes.length}` });
          }
        }
      }
      setRenderPhase('Finalizando arquivo…');
      setRenderProgress(98);
      await updateHistory({ progress: 98, phase: 'Finalizando arquivo' });
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mime });
      const ext = finalContainer;
      const url = URL.createObjectURL(blob);
      const fileName = `video-${content.id.slice(0, 6)}-${format.ratio.replace(':', 'x')}-${W}x${H}.${ext}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Keep URL alive longer so the toast action can re-trigger the download
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);

      setRenderProgress(100);
      setRenderPhase('Concluído');
      const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
      await updateHistory({
        status: 'done',
        progress: 100,
        phase: 'Concluído',
        file_size_bytes: blob.size,
        message: `Arquivo .${ext} (${sizeMb} MB)`,
      });

      refreshCredits();

      // Rich success notification with link to re-download the file
      const { toast: sonnerToast } = await import('sonner');
      sonnerToast.success('Render concluído com sucesso', {
        description: `${fileName} • ${ext.toUpperCase()} • ${sizeMb} MB`,
        duration: 15000,
        action: {
          label: 'Baixar novamente',
          onClick: () => {
            const a2 = document.createElement('a');
            a2.href = url;
            a2.download = fileName;
            document.body.appendChild(a2);
            a2.click();
            a2.remove();
          },
        },
      });
    } catch (e: any) {
      await updateHistory({ status: 'error', message: e?.message || 'Erro desconhecido', phase: 'Erro' });
      const { toast: sonnerToast } = await import('sonner');
      sonnerToast.error('Falha ao renderizar vídeo', {
        description: e?.message || 'Erro desconhecido. Tente novamente.',
        duration: 15000,
        action: {
          label: 'Tentar novamente',
          onClick: () => exportVideo(),
        },
      });
    } finally {
      setRendering(false);
      setRenderEta('');
    }
  };

  if (!open) return null;

  const activeScene = scenes[activeIdx];

  const applyPresetAndRegenerate = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = presets.find(x => x.id === presetId);
    setScenes(buildInitialScenes(content, p?.config || DEFAULT_PRESET));
    setActiveIdx(0);
    setPreviewProgress(0);
    setPlaying(false);
    toast({ title: 'Cenas geradas', description: p ? `Estilo: ${p.name}` : 'Estilo padrão aplicado' });
  };

  // ============= Reusable Blocks =============
  const PreviewBlock = (
    <Card className="p-2 sm:p-3 bg-card">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {VIDEO_FORMATS.map(f => (
            <Button
              key={f.ratio}
              variant={format.ratio === f.ratio ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormat(f)}
              disabled={rendering}
              className="h-8 px-2 sm:px-3 text-xs"
            >
              {f.ratio}
            </Button>
          ))}
        </div>
        <Badge variant={insufficient ? 'destructive' : 'outline'} className="gap-1 text-xs">
          <Coins className="h-3 w-3" /> {totalCost} créd · saldo {balance} · {totalDuration}s
        </Badge>
      </div>

      {presets.length > 0 && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs whitespace-nowrap">Estilo:</Label>
          <select
            className="h-8 rounded-md border bg-background px-2 text-xs flex-1 min-w-[120px]"
            value={selectedPresetId}
            onChange={e => setSelectedPresetId(e.target.value)}
            disabled={rendering}
          >
            {presets.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' ★' : ''}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => applyPresetAndRegenerate(selectedPresetId)}
            disabled={rendering || !selectedPresetId}
            className="h-8 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Gerar cenas
          </Button>
        </div>
      )}

      <div
        className="relative bg-black rounded-lg overflow-hidden mx-auto"
        style={{
          aspectRatio: `${format.w}/${format.h}`,
          maxHeight: isMobile ? '50vh' : '58vh',
          width: format.w >= format.h ? '100%' : 'auto',
          maxWidth: '100%',
        }}
      >
        <canvas
          ref={canvasRef}
          width={format.w}
          height={format.h}
          className="w-full h-full block"
        />
      </div>

      {/* Timeline / controls */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 shrink-0"
            onClick={() => {
              if (previewProgress >= totalDuration - 0.05) setPreviewProgress(0);
              setPlaying(p => !p);
            }}
            disabled={rendering || scenes.length === 0}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Slider
            value={[Math.min(previewProgress, totalDuration)]}
            max={Math.max(0.1, totalDuration)}
            step={0.05}
            onValueChange={(v) => {
              setPlaying(false);
              setPreviewProgress(v[0]);
              drawAt(v[0]);
            }}
            disabled={rendering || scenes.length === 0}
          />
          <span className="text-[11px] sm:text-xs text-muted-foreground tabular-nums w-14 sm:w-20 text-right shrink-0">
            {previewProgress.toFixed(1)}/{totalDuration}s
          </span>
        </div>

        {/* Scene strip */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              onClick={() => {
                setPlaying(false);
                setActiveIdx(i);
                if (isMobile) setMobileTab('edit');
              }}
              disabled={rendering}
              className={`shrink-0 px-2 py-1.5 rounded border text-[11px] min-w-[90px] max-w-[120px] text-left transition-colors ${
                i === activeIdx
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/40'
              }`}
            >
              <div className="font-semibold">Cena {i + 1}</div>
              <div className="truncate opacity-70">{s.text || '—'}</div>
              <div className="opacity-60">{s.duration}s</div>
            </button>
          ))}
          <button
            onClick={addScene}
            disabled={rendering}
            className="shrink-0 px-3 py-1.5 rounded border border-dashed border-border text-[11px] hover:border-primary hover:text-primary"
          >
            <Plus className="h-3 w-3 inline mr-1" /> Cena
          </button>
        </div>

        {/* Tipo de geração + provedor */}
        <div className="rounded-lg border border-border bg-background/50 p-2 space-y-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setGenKind('basic');
                if (providersBasic[0]) setSelectedProvider(providersBasic[0].provider);
              }}
              disabled={rendering || providersBasic.length === 0}
              className={`flex-1 text-[11px] sm:text-xs px-2 py-2 rounded border transition-colors ${
                genKind === 'basic'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40'
              } disabled:opacity-40`}
            >
              <div className="font-semibold">Básico (Canvas)</div>
              <div className="opacity-70">{costBasic} créd/s</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setGenKind('ai');
                if (providersAi[0]) setSelectedProvider(providersAi[0].provider);
              }}
              disabled={rendering || providersAi.length === 0}
              className={`flex-1 text-[11px] sm:text-xs px-2 py-2 rounded border transition-colors ${
                genKind === 'ai'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40'
              } disabled:opacity-40`}
              title={providersAi.length === 0 ? 'Nenhum provedor de IA ativo' : ''}
            >
              <div className="font-semibold">IA (vídeo real)</div>
              <div className="opacity-70">{costAi} créd/cena</div>
            </button>
          </div>

          {activeProviders.length > 0 && (
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Provedor</Label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                disabled={rendering || activeProviders.length <= 1}
                className="w-full mt-1 h-8 text-xs rounded border border-border bg-background px-2"
              >
                {activeProviders.map(p => (
                  <option key={p.provider} value={p.provider}>
                    {p.provider} · peso {p.weight}
                  </option>
                ))}
              </select>
              {activeProviders[0]?.config?.description && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {(activeProviders.find(p => p.provider === selectedProvider)?.config?.description) || ''}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ===== Detalhamento de créditos (provedores escolhidos por peso) ===== */}
        {costBreakdown.breakdown.length > 0 && (
          <div className="rounded-lg border border-border bg-background/50 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Cobrança detalhada</Label>
              <span className="text-[10px] text-muted-foreground">selecionado por peso %</span>
            </div>
            {costBreakdown.breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="truncate text-muted-foreground" title={b.detail}>{b.label}</span>
                <span className="font-medium">{b.amount} créd</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
              <span className="font-semibold">Total</span>
              <span className="font-semibold">{totalCost} créd</span>
            </div>
          </div>
        )}

        {/* ===== Opções de exportação ===== */}
        <div className="rounded-lg border border-border bg-background/50 p-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Exportação</Label>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setHistoryOpen(true)}>
              <History className="h-3 w-3 mr-1" /> Histórico
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Formato</Label>
              <select
                value={container}
                onChange={(e) => {
                  const v = e.target.value as Container;
                  setContainer(v);
                  if (v === 'mp4') setCodec('h264');
                  else if (codec === 'h264') setCodec('vp9');
                }}
                disabled={rendering}
                className="w-full mt-1 h-8 text-xs rounded border border-border bg-background px-2"
              >
                <option value="webm">WebM</option>
                <option value="mp4">MP4 (se suportado)</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Codec</Label>
              <select
                value={codec}
                onChange={(e) => setCodec(e.target.value as CodecKey)}
                disabled={rendering}
                className="w-full mt-1 h-8 text-xs rounded border border-border bg-background px-2"
              >
                {container === 'webm' ? (
                  <>
                    <option value="vp9">VP9 (recomendado)</option>
                    <option value="vp8">VP8 (compat.)</option>
                    <option value="av1">AV1 (moderno)</option>
                    <option value="auto">Auto</option>
                  </>
                ) : (
                  <option value="h264">H.264</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Qualidade</Label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as QualityKey)}
                disabled={rendering}
                className="w-full mt-1 h-8 text-xs rounded border border-border bg-background px-2"
              >
                <option value="low">Baixa (2 Mbps)</option>
                <option value="medium">Média (4 Mbps)</option>
                <option value="high">Alta (8 Mbps)</option>
                <option value="ultra">Ultra (14 Mbps)</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Resolução</Label>
              <select
                value={resolutionScale}
                onChange={(e) => setResolutionScale(parseFloat(e.target.value) as ResolutionScale)}
                disabled={rendering}
                className="w-full mt-1 h-8 text-xs rounded border border-border bg-background px-2"
              >
                <option value={0.5}>50% ({Math.round(format.w * 0.5)}×{Math.round(format.h * 0.5)})</option>
                <option value={0.75}>75% ({Math.round(format.w * 0.75)}×{Math.round(format.h * 0.75)})</option>
                <option value={1}>100% ({format.w}×{format.h})</option>
                <option value={1.5}>150% ({Math.round(format.w * 1.5)}×{Math.round(format.h * 1.5)})</option>
              </select>
            </div>
          </div>

          {quality === 'custom' && (
            <div>
              <Label className="text-[10px] text-muted-foreground">Bitrate (kbps): {customBitrate}</Label>
              <input
                type="range"
                min={500}
                max={20000}
                step={500}
                value={customBitrate}
                onChange={(e) => setCustomBitrate(parseInt(e.target.value))}
                disabled={rendering}
                className="w-full mt-1"
              />
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            {container.toUpperCase()} · {Math.round(format.w * resolutionScale)}×{Math.round(format.h * resolutionScale)} ·{' '}
            {quality === 'custom' ? customBitrate : QUALITY_BITRATES[quality]} kbps
          </p>
        </div>

        <Button
          className="w-full h-11"
          onClick={exportVideo}
          disabled={rendering || scenes.length === 0 || totalDuration > 60 || insufficient}
        >
          {rendering ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Renderizando... {renderProgress}%</>
          ) : insufficient ? (
            <><Coins className="h-4 w-4 mr-2" /> <span className="truncate">Créditos insuficientes ({balance}/{totalCost})</span></>
          ) : (
            <><Download className="h-4 w-4 mr-2" /> <span className="truncate">Gerar e baixar ({totalCost} créd.)</span></>
          )}
        </Button>

        {rendering && (
          <div className="space-y-1">
            <Progress value={renderProgress} />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">{renderPhase}</span>
              <span>{renderEta}</span>
            </div>
          </div>
        )}

        {totalDuration > 60 && (
          <p className="text-xs text-destructive text-center">
            Duração máxima: 60s. Atual: {totalDuration}s. Reduza a duração das cenas.
          </p>
        )}
        {insufficient && totalDuration <= 60 && (
          <p className="text-xs text-destructive text-center">
            Você tem {balance} créditos. Precisa de {totalCost}. Reduza cenas/duração ou adquira mais créditos.
          </p>
        )}
      </div>
    </Card>
  );

  const EditorBlock = activeScene ? (
    <Card className="p-3 sm:p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
          <Type className="h-4 w-4 text-primary" /> Cena {activeIdx + 1}
        </h3>
        {scenes.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeScene(activeIdx)}
            disabled={rendering}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      <div>
        <Label className="text-xs">Texto</Label>
        <Textarea
          value={activeScene.text}
          onChange={(e) => updateScene(activeIdx, { text: e.target.value })}
          rows={3}
          disabled={rendering}
          className="text-sm"
        />
      </div>

      <div>
        <Label className="text-xs">Duração: {activeScene.duration}s</Label>
        <Slider
          value={[activeScene.duration]}
          min={2} max={10} step={1}
          onValueChange={(v) => updateScene(activeIdx, { duration: v[0] })}
          disabled={rendering}
          className="mt-2"
        />
      </div>

      <div>
        <Label className="text-xs">Efeito de imagem</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {IMAGE_EFFECTS.map(e => (
            <button
              key={e.key}
              onClick={() => updateScene(activeIdx, { imageEffect: e.key })}
              disabled={rendering}
              className={`text-[11px] px-2 py-1.5 rounded border ${
                activeScene.imageEffect === e.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >{e.label}</button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">Efeito de texto</Label>
        <div className="flex flex-wrap gap-1 mt-1">
          {TEXT_EFFECTS.map(e => (
            <button
              key={e.key}
              onClick={() => updateScene(activeIdx, { textEffect: e.key })}
              disabled={rendering}
              className={`text-[11px] px-2 py-1.5 rounded border ${
                activeScene.textEffect === e.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >{e.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Posição</Label>
          <div className="flex gap-1 mt-1">
            {(['top', 'center', 'bottom'] as TextPosition[]).map(p => (
              <button
                key={p}
                onClick={() => updateScene(activeIdx, { textPosition: p })}
                disabled={rendering}
                className={`text-[11px] px-2 py-1.5 rounded border flex-1 ${
                  activeScene.textPosition === p
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border'
                }`}
              >{p === 'top' ? 'Topo' : p === 'center' ? 'Meio' : 'Base'}</button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Tipografia</Label>
          <select
            value={activeScene.fontFamily}
            onChange={(e) => updateScene(activeIdx, { fontFamily: e.target.value as FontFamily })}
            disabled={rendering}
            className="w-full mt-1 h-9 text-xs rounded border border-border bg-background px-2"
          >
            <option value="sans">Sans (Inter)</option>
            <option value="display">Display (Space Grotesk)</option>
            <option value="serif">Serif (Georgia)</option>
            <option value="mono">Mono (Courier)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Cor do texto</Label>
          <Input
            type="color"
            value={activeScene.textColor}
            onChange={(e) => updateScene(activeIdx, { textColor: e.target.value })}
            disabled={rendering}
            className="h-9 p-1"
          />
        </div>
        <div>
          <Label className="text-xs">Fundo do texto</Label>
          <select
            value={activeScene.textBg}
            onChange={(e) => updateScene(activeIdx, { textBg: e.target.value })}
            disabled={rendering}
            className="w-full mt-1 h-9 text-xs rounded border border-border bg-background px-2"
          >
            <option value="none">Sem fundo</option>
            <option value="rgba(0,0,0,0.45)">Preto translúcido</option>
            <option value="rgba(0,0,0,0.75)">Preto sólido</option>
            <option value="rgba(255,255,255,0.85)">Branco</option>
            <option value="rgba(8,145,178,0.75)">Cyan (marca)</option>
          </select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Tamanho do texto: {activeScene.fontSize.toFixed(2)}x</Label>
        <Slider
          value={[activeScene.fontSize]}
          min={0.5} max={1.6} step={0.05}
          onValueChange={(v) => updateScene(activeIdx, { fontSize: v[0] })}
          disabled={rendering}
          className="mt-2"
        />
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <Label className="text-xs flex items-center gap-1">
          <ImagePlus className="h-3.5 w-3.5" /> Imagem da cena
        </Label>
        {activeScene.imageUrl ? (
          <img
            src={activeScene.imageUrl}
            alt="cena"
            className="w-full h-28 object-cover rounded border border-border"
          />
        ) : (
          <div className="w-full h-28 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
            Sem imagem
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => handleRegen(activeIdx)}
          disabled={rendering || regenIdx === activeIdx}
        >
          {regenIdx === activeIdx ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Gerando...</>
          ) : (
            <><Wand2 className="h-3.5 w-3.5 mr-1" /> Gerar imagem desta cena (3 créd.)</>
          )}
        </Button>
      </div>

      {/* Áudio da cena */}
      <div className="border-t border-border pt-3">
        <AudioPanel
          globalAudio={globalAudio}
          onGlobalAudioChange={setGlobalAudio}
          sceneAudio={activeScene.audio}
          onSceneAudioChange={(a) => updateScene(activeIdx, { audio: a })}
          sceneText={activeScene.text}
          sceneDuration={activeScene.duration}
          rendering={rendering}
        />
      </div>
    </Card>
  ) : (
    <Card className="p-4 text-sm text-muted-foreground">
      Adicione uma cena para começar.
    </Card>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="container mx-auto py-3 sm:py-6 px-3 sm:px-4 max-w-7xl">
        {/* Header (sticky) */}
        <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 sm:py-3 mb-3 sm:mb-4 bg-background/85 backdrop-blur-md border-b border-border flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
              <span className="truncate">Editor de Vídeo</span>
            </h2>
            <p className="hidden sm:block text-sm text-muted-foreground">
              Edite cenas, efeitos e textos. Renderização local no navegador.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={rendering} className="shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile: tabs. Desktop: side-by-side */}
        {isMobile ? (
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as 'preview' | 'edit')}>
            <TabsList className="grid grid-cols-2 w-full mb-3">
              <TabsTrigger value="preview" className="gap-1">
                <Film className="h-4 w-4" /> Preview
              </TabsTrigger>
              <TabsTrigger value="edit" className="gap-1">
                <Settings2 className="h-4 w-4" /> Editar cena
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-0">{PreviewBlock}</TabsContent>
            <TabsContent value="edit" className="mt-0">{EditorBlock}</TabsContent>
          </Tabs>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
            <div className="space-y-3 min-w-0">{PreviewBlock}</div>
            <div className="space-y-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
              {EditorBlock}
            </div>
          </div>
        )}
      </div>

      <RenderHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        contentId={content.id}
        activeRender={rendering ? { progress: renderProgress, phase: renderPhase, eta: renderEta } : null}
      />
    </div>
  );
};
