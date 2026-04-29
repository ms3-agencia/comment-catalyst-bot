import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useLogoCustomization, FORMATS, LogoFormatKey, LogoPosition, defaultPositionFor } from '@/hooks/useLogoCustomization';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, ImagePlus, Lock, RotateCcw, Instagram, Youtube, Music2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const NETWORK_ICONS: Record<string, any> = { Instagram, TikTok: Music2, YouTube: Youtube };

const LogoCustomizationPage = () => {
  const { user } = useAuth();
  const { enabled, data, loading, save, getPosition, saveStatus, lastSavedAt, flush } = useLogoCustomization();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [activeFormat, setActiveFormat] = useState<LogoFormatKey>('instagram-feed');

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('branding').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('branding').getPublicUrl(path);
      await save({ logo_url: pub.publicUrl }, { immediate: true });
      toast({ title: 'Logo atualizado!' });
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const updatePos = (key: LogoFormatKey, patch: Partial<LogoPosition>) => {
    const cur = getPosition(key);
    const next = { ...cur, ...patch };
    save({ positions: { ...data.positions, [key]: next } });
  };

  const updatePosCommit = (key: LogoFormatKey, patch: Partial<LogoPosition>) => {
    const cur = getPosition(key);
    const next = { ...cur, ...patch };
    save({ positions: { ...data.positions, [key]: next } }, { immediate: true });
  };

  const resetPos = (key: LogoFormatKey) => {
    const { [key]: _, ...rest } = data.positions;
    save({ positions: rest }, { immediate: true });
  };

  if (loading) {
    return <DashboardLayout><div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div></DashboardLayout>;
  }

  if (!enabled) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-2xl p-6">
          <Card className="p-8 text-center bg-card/60 border-border">
            <Lock className="mx-auto mb-4 text-muted-foreground" size={40} />
            <h1 className="font-heading text-2xl mb-2">Add-on não ativo</h1>
            <p className="text-muted-foreground mb-6">Ative o add-on <strong>Logo Personalizado</strong> para aplicar seu logo automaticamente em todas as imagens e vídeos gerados.</p>
            <Link to="/dashboard/addons"><Button className="bg-primary hover:bg-primary/90"><ImagePlus className="mr-2" size={16} /> Ver Add-on</Button></Link>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl flex items-center gap-3">
              <ImagePlus className="text-primary" />
              Logo Personalizado
              <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">ATIVO</Badge>
            </h1>
            <p className="text-muted-foreground mt-1">Posicione seu logo em cada formato. Aplicado automaticamente em conteúdos gerados.</p>
          </div>
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} onForceSave={() => flush()} />
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Painel lateral */}
          <div className="space-y-4">
            <Card className="p-4 bg-card/60 border-border">
              <Label className="text-sm font-semibold mb-2 block">Seu logo</Label>
              {data.logo_url ? (
                <div className="aspect-square rounded-lg bg-[conic-gradient(at_50%_50%,#222_25%,#333_0_50%,#222_0_75%,#333_0)] flex items-center justify-center mb-3 overflow-hidden">
                  <img src={data.logo_url} alt="logo" className="max-h-full max-w-full object-contain p-4" />
                </div>
              ) : (
                <div className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center mb-3 text-muted-foreground text-sm">Sem logo</div>
              )}
              <label className="block">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                <Button asChild variant="outline" className="w-full" disabled={uploading}>
                  <span>{uploading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Upload className="mr-2" size={14} />} {data.logo_url ? 'Trocar logo' : 'Enviar logo'}</span>
                </Button>
              </label>
              <p className="text-[11px] text-muted-foreground mt-2">PNG transparente recomendado.</p>
            </Card>

            <Card className="p-4 bg-card/60 border-border space-y-4">
              <h3 className="text-sm font-semibold">Aplicação automática</h3>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Em imagens</Label>
                <Switch checked={data.apply_on_images} onCheckedChange={(v) => save({ apply_on_images: v }, { immediate: true })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Em vídeos</Label>
                <Switch checked={data.apply_on_videos} onCheckedChange={(v) => save({ apply_on_videos: v }, { immediate: true })} />
              </div>
            </Card>

            <Card className="p-4 bg-card/60 border-border space-y-4">
              <h3 className="text-sm font-semibold">Padrões</h3>
              <div>
                <Label className="text-xs text-muted-foreground">Tamanho padrão: {data.default_size_percent}%</Label>
                <Slider value={[data.default_size_percent]} min={5} max={50} step={1} onValueChange={([v]) => save({ default_size_percent: v })} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Opacidade padrão: {Math.round(data.default_opacity * 100)}%</Label>
                <Slider value={[data.default_opacity * 100]} min={10} max={100} step={5} onValueChange={([v]) => save({ default_opacity: v / 100 })} />
              </div>
            </Card>
          </div>

          {/* Mockups */}
          <Card className="p-4 bg-card/60 border-border">
            <Tabs value={activeFormat} onValueChange={(v) => setActiveFormat(v as LogoFormatKey)}>
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 mb-4 h-auto">
                {FORMATS.map(f => {
                  const Icon = NETWORK_ICONS[f.network] || ImagePlus;
                  return (
                    <TabsTrigger key={f.key} value={f.key} className="flex flex-col gap-1 py-2 text-[11px]">
                      <Icon size={14} />
                      <span className="leading-tight">{f.label.replace(f.network + ' ', '')}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {FORMATS.map(f => (
                <TabsContent key={f.key} value={f.key}>
                  <MockupEditor
                    format={f}
                    logoUrl={data.logo_url}
                    position={getPosition(f.key)}
                    onChange={(p) => updatePos(f.key, p)}
                    onCommit={(p) => updatePosCommit(f.key, p)}
                    onReset={() => resetPos(f.key)}
                  />
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

// ===================== SAVE STATUS =====================
const SaveStatusIndicator: React.FC<{
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: Date | null;
  onForceSave: () => void;
}> = ({ status, lastSavedAt, onForceSave }) => {
  let label = 'Tudo salvo';
  let color = 'text-muted-foreground';
  let Icon: any = Check;
  if (status === 'saving') { label = 'Salvando…'; color = 'text-primary'; Icon = Loader2; }
  else if (status === 'saved') { label = 'Salvo'; color = 'text-emerald-500'; Icon = Check; }
  else if (status === 'error') { label = 'Erro ao salvar'; color = 'text-destructive'; Icon = X; }
  else if (lastSavedAt) { label = `Salvo às ${lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; }
  return (
    <button
      onClick={onForceSave}
      className={`flex items-center gap-2 text-xs ${color} hover:text-foreground transition-colors px-3 py-2 rounded-md border border-border bg-card/40`}
      title="Forçar salvamento"
    >
      <Icon size={14} className={status === 'saving' ? 'animate-spin' : ''} />
      <span>{label}</span>
    </button>
  );
};

// ===================== MOCKUP EDITOR =====================
const MockupEditor: React.FC<{
  format: typeof FORMATS[number];
  logoUrl: string | null;
  position: LogoPosition;
  onChange: (p: Partial<LogoPosition>) => void;
  onCommit: (p: Partial<LogoPosition>) => void;
  onReset: () => void;
}> = ({ format, logoUrl, position, onChange, onCommit, onReset }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const [drag, setDrag] = useState<{ ox: number; oy: number; lastX: number; lastY: number } | null>(null);

  const aspect = format.w / format.h;
  const maxW = 360;
  const maxH = 540;
  let w = maxW, h = maxW / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }

  const logoW = (position.size / 100) * w;

  // Pré-carrega o logo (uma vez por URL)
  useEffect(() => {
    if (!logoUrl) { logoImgRef.current = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { logoImgRef.current = img; drawPreview(); };
    img.src = logoUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoUrl]);

  // Redesenha o canvas de preview ao vivo a cada mudança
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Background gradient simulando conteúdo
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#a21caf');
    grad.addColorStop(0.5, '#6d28d9');
    grad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${Math.round(canvas.width * 0.035)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('saída final do conteúdo', canvas.width / 2, canvas.height / 2);

    const logo = logoImgRef.current;
    if (logo) {
      const targetW = (position.size / 100) * canvas.width;
      const ratio = logo.naturalHeight / logo.naturalWidth;
      const targetH = targetW * ratio;
      const x = position.x * canvas.width;
      const y = position.y * canvas.height;
      ctx.globalAlpha = position.opacity;
      ctx.drawImage(logo, x, y, targetW, targetH);
      ctx.globalAlpha = 1;
    }
  });

  useEffect(() => { drawPreview(); }, [position.x, position.y, position.size, position.opacity, format.key]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const lx = position.x * rect.width;
    const ly = position.y * rect.height;
    setDrag({ ox: px - lx, oy: py - ly, lastX: position.x, lastY: position.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    let nx = (e.clientX - rect.left - drag.ox) / rect.width;
    let ny = (e.clientY - rect.top - drag.oy) / rect.height;
    nx = Math.max(0, Math.min(1 - position.size / 100, nx));
    ny = Math.max(0, Math.min(1 - (position.size / 100) * (rect.width / rect.height), ny));
    setDrag(prev => prev ? { ...prev, lastX: nx, lastY: ny } : prev);
    onChange({ x: nx, y: ny });
  };
  const onPointerUp = () => {
    if (drag) {
      // Commit final position imediatamente no banco
      onCommit({ x: drag.lastX, y: drag.lastY });
    }
    setDrag(null);
  };

  const presets: { label: string; x: number; y: number }[] = [
    { label: '↖', x: 0.04, y: 0.04 },
    { label: '↑', x: 0.5 - position.size / 200, y: 0.04 },
    { label: '↗', x: 0.96 - position.size / 100, y: 0.04 },
    { label: '←', x: 0.04, y: 0.5 - position.size / 200 },
    { label: '•', x: 0.5 - position.size / 200, y: 0.5 - position.size / 200 },
    { label: '→', x: 0.96 - position.size / 100, y: 0.5 - position.size / 200 },
    { label: '↙', x: 0.04, y: 0.96 - position.size / 100 },
    { label: '↓', x: 0.5 - position.size / 200, y: 0.96 - position.size / 100 },
    { label: '↘', x: 0.96 - position.size / 100, y: 0.96 - position.size / 100 },
  ];

  return (
    <div className="grid md:grid-cols-[1fr_240px] gap-6 items-start">
      <div className="flex flex-col items-center">
        <p className="text-xs text-muted-foreground mb-2">{format.label} — {format.w}×{format.h} ({format.ratio}) · arraste o logo</p>
        <div
          ref={stageRef}
          className="relative rounded-xl overflow-hidden shadow-2xl border border-border bg-gradient-to-br from-fuchsia-500/40 via-purple-600/40 to-cyan-500/40 select-none"
          style={{ width: w, height: h, touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="absolute inset-0 flex items-center justify-center text-white/60 font-heading text-sm pointer-events-none">
            preview do conteúdo gerado
          </div>
          {logoUrl ? (
            <div
              onPointerDown={onPointerDown}
              className="absolute cursor-grab active:cursor-grabbing ring-2 ring-primary/0 hover:ring-primary/60 rounded"
              style={{
                left: position.x * w,
                top: position.y * h,
                width: logoW,
                opacity: position.opacity,
              }}
            >
              <img src={logoUrl} alt="logo" className="w-full h-auto pointer-events-none" draggable={false} />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/80 text-xs">Envie um logo para começar</div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Tamanho: {position.size}%</Label>
          <Slider
            value={[position.size]} min={5} max={50} step={1}
            onValueChange={([v]) => onChange({ size: v })}
            onValueCommit={([v]) => onCommit({ size: v })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Opacidade: {Math.round(position.opacity * 100)}%</Label>
          <Slider
            value={[position.opacity * 100]} min={10} max={100} step={5}
            onValueChange={([v]) => onChange({ opacity: v / 100 })}
            onValueCommit={([v]) => onCommit({ opacity: v / 100 })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Atalhos de posição</Label>
          <div className="grid grid-cols-3 gap-1">
            {presets.map((p, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="h-8 p-0"
                onClick={() => onCommit({ x: Math.max(0, p.x), y: Math.max(0, p.y) })}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>
          <RotateCcw className="mr-2" size={14} /> Resetar este formato
        </Button>
      </div>
    </div>
  );
};

export default LogoCustomizationPage;
