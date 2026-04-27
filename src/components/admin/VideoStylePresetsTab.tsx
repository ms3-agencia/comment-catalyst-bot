import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Save, Trash2, Star } from 'lucide-react';

const IMAGE_EFFECT_OPTIONS = ['none', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'pan_up', 'pan_down'];
const TEXT_EFFECT_OPTIONS = ['none', 'fade', 'typewriter', 'slide_up', 'slide_left', 'bounce', 'pop', 'wave'];
const FONT_OPTIONS = ['sans', 'serif', 'mono', 'display'];
const POSITION_OPTIONS = ['top', 'center', 'bottom'];

type PresetConfig = {
  imageEffects: string[];
  textEffects: string[];
  fonts: string[];
  textColors: string[];
  textBg: string;
  fontSize: number;
  textPosition: string;
};

type Preset = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  config: PresetConfig;
};

const emptyConfig: PresetConfig = {
  imageEffects: ['zoom_in', 'pan_right'],
  textEffects: ['fade', 'slide_up'],
  fonts: ['sans'],
  textColors: ['#ffffff'],
  textBg: 'rgba(0,0,0,0.45)',
  fontSize: 1.0,
  textPosition: 'bottom',
};

function ChipMulti({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; }) {
  const toggle = (k: string) => {
    onChange(value.includes(k) ? value.filter(x => x !== k) : [...value, k]);
  };
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {options.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${value.includes(o) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
          >{o}</button>
        ))}
      </div>
    </div>
  );
}

export const VideoStylePresetsTab = () => {
  const { toast } = useToast();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('video_style_presets' as any)
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else setPresets(((data as any[]) || []).map(p => ({ ...p, config: { ...emptyConfig, ...(p.config || {}) } })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (id: string, patch: Partial<Preset>) => {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  };
  const updateConfig = (id: string, patch: Partial<PresetConfig>) => {
    setPresets(prev => prev.map(p => p.id === id ? { ...p, config: { ...p.config, ...patch } } : p));
  };

  const save = async (p: Preset) => {
    setSaving(p.id);
    // unset other defaults if this is being set as default
    if (p.is_default) {
      await supabase.from('video_style_presets' as any).update({ is_default: false } as any).neq('id', p.id);
    }
    const { error } = await supabase.from('video_style_presets' as any).update({
      name: p.name,
      description: p.description,
      is_active: p.is_active,
      is_default: p.is_default,
      sort_order: p.sort_order,
      config: p.config as any,
    } as any).eq('id', p.id);
    setSaving(null);
    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Preset salvo' }); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este preset?')) return;
    const { error } = await supabase.from('video_style_presets' as any).delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Preset removido' }); load(); }
  };

  const create = async () => {
    const { error } = await supabase.from('video_style_presets' as any).insert({
      name: 'Novo Preset',
      description: '',
      is_active: true,
      is_default: false,
      sort_order: presets.length + 1,
      config: emptyConfig as any,
    } as any);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Preset criado' }); load(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Presets de Estilo de Vídeo</h3>
          <p className="text-sm text-muted-foreground">Definem os efeitos, fontes e cores aplicados automaticamente ao gerar cenas.</p>
        </div>
        <Button onClick={create} size="sm"><Plus size={14} className="mr-1.5" />Novo Preset</Button>
      </div>

      {presets.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">Nenhum preset cadastrado.</Card>
      )}

      {presets.map(p => (
        <Card key={p.id} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={p.name} onChange={e => update(p.id, { name: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Input value={p.description || ''} onChange={e => update(p.id, { description: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={p.is_active} onCheckedChange={v => update(p.id, { is_active: v })} />
              <Label className="text-xs">Ativo</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={p.is_default} onCheckedChange={v => update(p.id, { is_default: v })} />
              <Label className="text-xs flex items-center gap-1"><Star size={12} />Padrão</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Ordem</Label>
              <Input type="number" className="w-20" value={p.sort_order} onChange={e => update(p.id, { sort_order: parseInt(e.target.value) || 0 })} />
            </div>
            {p.is_default && <Badge variant="secondary">Aplicado por padrão</Badge>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChipMulti label="Efeitos de Imagem" options={IMAGE_EFFECT_OPTIONS} value={p.config.imageEffects} onChange={v => updateConfig(p.id, { imageEffects: v })} />
            <ChipMulti label="Efeitos de Texto" options={TEXT_EFFECT_OPTIONS} value={p.config.textEffects} onChange={v => updateConfig(p.id, { textEffects: v })} />
            <ChipMulti label="Fontes" options={FONT_OPTIONS} value={p.config.fonts} onChange={v => updateConfig(p.id, { fonts: v })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Cores do Texto (separadas por vírgula)</Label>
              <Input value={p.config.textColors.join(',')} onChange={e => updateConfig(p.id, { textColors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
              <div className="flex gap-1 mt-1.5">
                {p.config.textColors.map((c, i) => <span key={i} className="w-5 h-5 rounded border" style={{ background: c }} />)}
              </div>
            </div>
            <div>
              <Label className="text-xs">Fundo do Texto (CSS)</Label>
              <Input value={p.config.textBg} onChange={e => updateConfig(p.id, { textBg: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Tamanho da Fonte (0.5–1.5)</Label>
              <Input type="number" step="0.1" min="0.5" max="1.5" value={p.config.fontSize} onChange={e => updateConfig(p.id, { fontSize: parseFloat(e.target.value) || 1 })} />
            </div>
            <div>
              <Label className="text-xs">Posição padrão</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={p.config.textPosition} onChange={e => updateConfig(p.id, { textPosition: e.target.value })}>
                {POSITION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="destructive" size="sm" onClick={() => remove(p.id)}><Trash2 size={14} className="mr-1.5" />Excluir</Button>
            <Button size="sm" onClick={() => save(p)} disabled={saving === p.id}>
              {saving === p.id ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
              Salvar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
