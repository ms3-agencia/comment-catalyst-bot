import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Upload,
  Save,
  Smartphone,
  ImageIcon,
  Trash2,
  Download,
  Palette as PaletteIcon,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type PwaSettings = {
  id?: string;
  name: string;
  short_name: string;
  description: string | null;
  theme_color: string;
  background_color: string;
  display: string;
  orientation: string;
  start_url: string;
  scope: string;
  lang: string;
  categories: string[];
  icon_192_url: string | null;
  icon_512_url: string | null;
  apple_touch_icon_url: string | null;
  maskable_icon_url: string | null;
  splash_url: string | null;
  splash_dark_url: string | null;
};

const empty: PwaSettings = {
  name: 'YCaptura',
  short_name: 'YCaptura',
  description: 'Sistema de geração de avatar com base nos comentários reais do YouTube.',
  theme_color: '#0a1019',
  background_color: '#0a1019',
  display: 'standalone',
  orientation: 'portrait',
  start_url: '/dashboard',
  scope: '/',
  lang: 'pt-BR',
  categories: ['productivity', 'business', 'social'],
  icon_192_url: null,
  icon_512_url: null,
  apple_touch_icon_url: null,
  maskable_icon_url: null,
  splash_url: null,
  splash_dark_url: null,
};

type AssetField =
  | 'icon_192_url'
  | 'icon_512_url'
  | 'apple_touch_icon_url'
  | 'maskable_icon_url'
  | 'splash_url'
  | 'splash_dark_url';

const ASSET_HINTS: Record<AssetField, { label: string; hint: string; recommended: string }> = {
  icon_192_url: {
    label: 'Ícone 192×192',
    hint: 'Ícone principal do app na tela inicial Android.',
    recommended: 'PNG 192×192px (quadrado, sem transparência preferencialmente).',
  },
  icon_512_url: {
    label: 'Ícone 512×512',
    hint: 'Usado em alta resolução pelo Android e como fallback geral.',
    recommended: 'PNG 512×512px.',
  },
  apple_touch_icon_url: {
    label: 'Apple Touch Icon',
    hint: 'Ícone exibido ao adicionar à tela inicial no iOS/iPadOS.',
    recommended: 'PNG 180×180px com fundo opaco.',
  },
  maskable_icon_url: {
    label: 'Ícone Maskable',
    hint: 'Ícone adaptável para Android (cantos arredondados, formatos diferentes).',
    recommended: 'PNG 512×512px com área segura central de ~80%.',
  },
  splash_url: {
    label: 'Splash inicial (claro)',
    hint: 'Imagem exibida ao abrir o app instalado (modo claro).',
    recommended: 'PNG 1242×2688px (vertical, alta resolução).',
  },
  splash_dark_url: {
    label: 'Splash inicial (escuro)',
    hint: 'Versão escura do splash, usada quando o sistema está em dark mode.',
    recommended: 'PNG 1242×2688px (vertical, alta resolução).',
  },
};

const AssetUploader = ({
  field,
  value,
  onChange,
}: {
  field: AssetField;
  value: string | null;
  onChange: (url: string | null) => void;
}) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const meta = ASSET_HINTS[field];

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem.', variant: 'destructive' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Máximo de 4MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${field}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('pwa-assets').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('pwa-assets').getPublicUrl(path);
      onChange(data.publicUrl);
      toast({ title: 'Imagem enviada', description: 'Salve para aplicar.' });
    } catch (e) {
      toast({ title: 'Erro no upload', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const isSplash = field === 'splash_url' || field === 'splash_dark_url';

  return (
    <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-sm font-semibold">{meta.label}</Label>
          <p className="text-xs text-muted-foreground">{meta.hint}</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">{meta.recommended}</p>
        </div>
        {value && (
          <div className="flex items-center gap-1">
            <a href={value} download target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Baixar">
                <Download className="h-4 w-4" />
              </Button>
            </a>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onChange(null)}
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {value && (
        <div
          className={`mt-2 flex items-center justify-center overflow-hidden rounded-md border border-border bg-white ${
            isSplash ? 'h-40' : 'h-24 w-24'
          }`}
        >
          <img src={value} alt={meta.label} className="max-h-full max-w-full object-contain" />
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Cole uma URL ou envie um arquivo"
          className="flex-1"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

export const PwaTab = () => {
  const { toast } = useToast();
  const [form, setForm] = useState<PwaSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('pwa_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (data) {
        // Default existing icons to current public assets if missing
        setForm({
          ...empty,
          ...data,
          icon_192_url: data.icon_192_url || `${window.location.origin}/icon-192.png`,
          icon_512_url: data.icon_512_url || `${window.location.origin}/icon-512.png`,
          apple_touch_icon_url:
            data.apple_touch_icon_url || `${window.location.origin}/apple-touch-icon.png`,
        });
      }
      setLoading(false);
    })();
  }, []);

  const update = (patch: Partial<PwaSettings>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim() || 'YCaptura',
        short_name: form.short_name.trim() || 'YCaptura',
        description: form.description?.trim() || null,
        theme_color: form.theme_color,
        background_color: form.background_color,
        display: form.display,
        orientation: form.orientation,
        start_url: form.start_url || '/',
        scope: form.scope || '/',
        lang: form.lang || 'pt-BR',
        categories: form.categories,
        icon_192_url: form.icon_192_url,
        icon_512_url: form.icon_512_url,
        apple_touch_icon_url: form.apple_touch_icon_url,
        maskable_icon_url: form.maskable_icon_url,
        splash_url: form.splash_url,
        splash_dark_url: form.splash_dark_url,
        updated_at: new Date().toISOString(),
      };
      let res;
      if (form.id) {
        res = await supabase.from('pwa_settings').update(payload).eq('id', form.id);
      } else {
        res = await supabase.from('pwa_settings').insert(payload);
      }
      if (res.error) throw res.error;
      toast({
        title: 'PWA atualizado!',
        description: 'As novas configurações serão aplicadas no próximo carregamento.',
      });
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="glass p-12 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Identidade */}
      <Card className="glass p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Smartphone size={20} />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold">Identidade do PWA</h3>
            <p className="text-sm text-muted-foreground">
              Como o aplicativo aparece quando instalado pelo usuário.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="YCaptura"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome curto (tela inicial)</Label>
            <Input
              value={form.short_name}
              onChange={(e) => update({ short_name: e.target.value })}
              placeholder="YCaptura"
              maxLength={12}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea
            rows={2}
            value={form.description ?? ''}
            onChange={(e) => update({ description: e.target.value })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Idioma</Label>
            <Input value={form.lang} onChange={(e) => update({ lang: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>URL inicial</Label>
            <Input
              value={form.start_url}
              onChange={(e) => update({ start_url: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Escopo</Label>
            <Input value={form.scope} onChange={(e) => update({ scope: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Categorias (separadas por vírgula)</Label>
          <Input
            value={form.categories.join(', ')}
            onChange={(e) =>
              update({
                categories: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="productivity, business, social"
          />
        </div>
      </Card>

      {/* Aparência */}
      <Card className="glass p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <PaletteIcon size={20} />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold">Aparência e comportamento</h3>
            <p className="text-sm text-muted-foreground">
              Cores da barra de status e modo de exibição quando aberto pelo usuário.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Cor do tema (status bar)</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={form.theme_color}
                onChange={(e) => update({ theme_color: e.target.value })}
                className="h-10 w-16 p-1"
              />
              <Input
                value={form.theme_color}
                onChange={(e) => update({ theme_color: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor de fundo (splash)</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={form.background_color}
                onChange={(e) => update({ background_color: e.target.value })}
                className="h-10 w-16 p-1"
              />
              <Input
                value={form.background_color}
                onChange={(e) => update({ background_color: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Modo de exibição</Label>
            <Select value={form.display} onValueChange={(v) => update({ display: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standalone">Standalone (recomendado)</SelectItem>
                <SelectItem value="fullscreen">Tela cheia</SelectItem>
                <SelectItem value="minimal-ui">UI mínima</SelectItem>
                <SelectItem value="browser">Navegador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Orientação</Label>
            <Select value={form.orientation} onValueChange={(v) => update({ orientation: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Retrato</SelectItem>
                <SelectItem value="landscape">Paisagem</SelectItem>
                <SelectItem value="any">Qualquer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Ícones */}
      <Card className="glass p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <ImageIcon size={20} />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold">Ícones</h3>
            <p className="text-sm text-muted-foreground">
              Os ícones atuais do sistema já estão pré-carregados — você pode baixá-los, substituir
              ou enviar versões otimizadas.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <AssetUploader
            field="icon_192_url"
            value={form.icon_192_url}
            onChange={(v) => update({ icon_192_url: v })}
          />
          <AssetUploader
            field="icon_512_url"
            value={form.icon_512_url}
            onChange={(v) => update({ icon_512_url: v })}
          />
          <AssetUploader
            field="apple_touch_icon_url"
            value={form.apple_touch_icon_url}
            onChange={(v) => update({ apple_touch_icon_url: v })}
          />
          <AssetUploader
            field="maskable_icon_url"
            value={form.maskable_icon_url}
            onChange={(v) => update({ maskable_icon_url: v })}
          />
        </div>
      </Card>

      {/* Splash */}
      <Card className="glass p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold">Splash inicial</h3>
            <p className="text-sm text-muted-foreground">
              Imagem exibida na abertura do app instalado. iOS usa as imagens enviadas; Android usa
              automaticamente o ícone 512×512 + cor de fundo.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <AssetUploader
            field="splash_url"
            value={form.splash_url}
            onChange={(v) => update({ splash_url: v })}
          />
          <AssetUploader
            field="splash_dark_url"
            value={form.splash_dark_url}
            onChange={(v) => update({ splash_dark_url: v })}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar configurações do PWA
        </Button>
      </div>
    </div>
  );
};

export default PwaTab;
