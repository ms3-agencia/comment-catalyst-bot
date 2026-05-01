import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Trash2, Save, Star, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export type EbookConfig = {
  id?: string;
  name: string;
  is_default: boolean;
  num_chapters: number;
  min_pages_per_chapter: number;
  writing_style: string;
  custom_style?: string | null;
  target_audience?: string | null;
  depth_level: string;
  include_exercises: boolean;
  include_summary: boolean;
  include_checklist: boolean;
  include_case_studies: boolean;
  include_examples: boolean;
  include_metaphors: boolean;
  base_prompt?: string | null;
  premium_product_mode: boolean;
  ai_model: string;
  structure?: any;
};

const DEFAULT_CFG: EbookConfig = {
  name: 'Meu template',
  is_default: true,
  num_chapters: 8,
  min_pages_per_chapter: 10,
  writing_style: 'didatico',
  target_audience: '',
  depth_level: 'intermediario',
  include_exercises: false,
  include_summary: true,
  include_checklist: false,
  include_case_studies: false,
  include_examples: true,
  include_metaphors: false,
  base_prompt: '',
  premium_product_mode: false,
  ai_model: 'google/gemini-2.5-pro',
};

type Mode = 'admin' | 'user';

export function EbookConfigPanel({ onSelect, mode = 'admin', canEdit = true }: { onSelect?: (cfg: EbookConfig) => void; mode?: Mode; canEdit?: boolean }) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<EbookConfig[]>([]);
  const [current, setCurrent] = useState<EbookConfig>(DEFAULT_CFG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    let query = supabase.from('ebook_configs').select('*').order('created_at', { ascending: false });
    if (mode === 'user' && u.user) {
      // Em modo user, lista os templates dele + globais (admins). RLS permite ler ambos.
      query = query;
    }
    const { data } = await query;
    const list = (data || []) as EbookConfig[];
    setConfigs(list);
    const def = list.find(c => c.is_default) || list[0];
    if (def) {
      setCurrent(def);
      onSelect?.(def);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mode]);

  const save = async () => {
    if (!canEdit) {
      toast({ title: 'Add-on necessário', description: 'Você precisa do add-on eBooks Premium para criar/editar templates.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Não autenticado');
      const payload: any = { ...current, user_id: u.user.id };
      if (current.is_default) {
        await supabase.from('ebook_configs').update({ is_default: false }).eq('user_id', u.user.id);
      }
      let result;
      if (current.id) {
        result = await supabase.from('ebook_configs').update(payload).eq('id', current.id).select().single();
      } else {
        delete payload.id;
        result = await supabase.from('ebook_configs').insert(payload).select().single();
      }
      if (result.error) throw result.error;
      toast({ title: current.id ? 'Template atualizado!' : 'Template criado!' });
      setCurrent(result.data as any);
      onSelect?.(result.data as any);
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const newTemplate = async () => {
    if (!canEdit) {
      toast({ title: 'Add-on necessário', description: 'Você precisa do add-on eBooks Premium para criar templates.', variant: 'destructive' });
      return;
    }
    // Cria de fato no banco com nome padrão e seleciona para edição
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Não autenticado');
      const payload: any = { ...DEFAULT_CFG, name: `Novo template ${configs.length + 1}`, is_default: false, user_id: u.user.id };
      delete payload.id;
      const { data, error } = await supabase.from('ebook_configs').insert(payload).select().single();
      if (error) throw error;
      toast({ title: 'Template criado!', description: 'Edite os campos e clique em "Salvar template".' });
      setCurrent(data as any);
      onSelect?.(data as any);
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao criar template', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id?: string) => {
    if (!id) return;
    if (!confirm('Excluir este template?')) return;
    await supabase.from('ebook_configs').delete().eq('id', id);
    if (current.id === id) setCurrent(DEFAULT_CFG);
    load();
  };

  const setField = <K extends keyof EbookConfig>(k: K, v: EbookConfig[K]) => setCurrent(p => ({ ...p, [k]: v }));

  const toggle = (k: keyof EbookConfig) => setField(k, !current[k] as any);

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="p-3 space-y-1.5 max-h-[600px] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Templates</span>
          <Button size="sm" variant="outline" onClick={newTemplate}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        {configs.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum template ainda. Crie o primeiro.</p>}
        {configs.map(c => (
          <button
            key={c.id}
            onClick={() => { setCurrent(c); onSelect?.(c); }}
            className={`w-full text-left px-2.5 py-2 rounded-md text-sm hover:bg-accent flex items-center justify-between gap-2 ${current.id === c.id ? 'bg-accent' : ''}`}
          >
            <span className="truncate flex items-center gap-1.5">
              {c.is_default && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
              {c.name}
            </span>
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); remove(c.id); }} />
          </button>
        ))}
      </Card>

      <Card className="p-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome do template</Label>
            <Input value={current.name} onChange={e => setField('name', e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={current.is_default} onCheckedChange={v => setField('is_default', v)} />
            <Label>Definir como padrão</Label>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">📌 Estrutura</h4>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nº de capítulos</Label>
              <Input type="number" min={3} max={30} value={current.num_chapters} onChange={e => setField('num_chapters', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Mín. páginas/cap.</Label>
              <Input type="number" min={3} max={30} value={current.min_pages_per_chapter} onChange={e => setField('min_pages_per_chapter', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo de IA</Label>
              <Select value={current.ai_model} onValueChange={v => setField('ai_model', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-2.5-pro">Lovable AI Pro (alta qualidade)</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash">Lovable AI Flash (rápido)</SelectItem>
                  <SelectItem value="openai/gpt-5">GPT-5 (premium)</SelectItem>
                  <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">✍️ Estilo de escrita</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Estilo</Label>
              <Select value={current.writing_style} onValueChange={v => setField('writing_style', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="didatico">Didático</SelectItem>
                  <SelectItem value="persuasivo">Persuasivo</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                  <SelectItem value="motivacional">Motivacional</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Profundidade</Label>
              <Select value={current.depth_level} onValueChange={v => setField('depth_level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {current.writing_style === 'custom' && (
            <div className="mt-3 space-y-1.5">
              <Label>Descrição do estilo customizado</Label>
              <Textarea value={current.custom_style || ''} onChange={e => setField('custom_style', e.target.value)} placeholder="Ex.: Tom irreverente, com humor sutil e referências de cultura pop" />
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">🎯 Público-alvo</h4>
          <Textarea value={current.target_audience || ''} onChange={e => setField('target_audience', e.target.value)}
            placeholder="Ex.: Empreendedores iniciantes, 25-40 anos, querendo lançar seu primeiro infoproduto..." rows={2} />
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">🧪 Elementos opcionais</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['include_exercises', 'Exercícios práticos'],
              ['include_summary', 'Resumo por capítulo'],
              ['include_checklist', 'Checklist acionável'],
              ['include_case_studies', 'Estudos de caso'],
              ['include_examples', 'Exemplos práticos'],
              ['include_metaphors', 'Metáforas e analogias'],
            ].map(([k, label]) => (
              <div key={k} className="flex items-center gap-2 p-2 rounded-md border">
                <Switch checked={(current as any)[k]} onCheckedChange={() => toggle(k as any)} />
                <Label className="cursor-pointer flex-1" onClick={() => toggle(k as any)}>{label}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
            <Switch checked={current.premium_product_mode} onCheckedChange={v => setField('premium_product_mode', v)} />
            <div>
              <Label className="cursor-pointer">💎 Modo Produto Premium</Label>
              <p className="text-xs text-muted-foreground">A IA criará nome de método exclusivo, promessa forte e posicionamento de mercado.</p>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">🧾 Prompt base (opcional)</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Variáveis: <code>{'{{tema}}'}</code>, <code>{'{{publico}}'}</code>, <code>{'{{nivel}}'}</code>, <code>{'{{estilo}}'}</code>, <code>{'{{capitulos}}'}</code>. Deixe vazio para usar o prompt padrão otimizado.
          </p>
          <Textarea value={current.base_prompt || ''} onChange={e => setField('base_prompt', e.target.value)} rows={5} />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar template
          </Button>
        </div>
      </Card>
    </div>
  );
}
