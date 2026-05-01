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
import { Loader2, Plus, Trash2, Save, Star, Lock, Gem, Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserAddons } from '@/hooks/useUserAddons';

export type EbookConfig = {
  id?: string;
  user_id?: string;
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
  category?: string;
  tags?: string[];
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
  const { hasAddon } = useUserAddons();
  const isAdminMode = mode === 'admin';
  const canSeeAiModel = isAdminMode; // Modelo de IA só para admin
  const canSeePremiumMode = isAdminMode || hasAddon('ebook-premium'); // Modo Produto Premium exige add-on premium
  const [configs, setConfigs] = useState<EbookConfig[]>([]);
  const [current, setCurrent] = useState<EbookConfig>(DEFAULT_CFG);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Em modo user, templates globais (criados por admin) NÃO podem ser editados aqui.
  const isGlobalTemplate = !!current.id && !!current.user_id && !!currentUserId && current.user_id !== currentUserId;
  const editingLocked = !canEdit || (mode === 'user' && isGlobalTemplate);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    setCurrentUserId(u.user?.id || null);
    let query = supabase.from('ebook_configs').select('*').order('created_at', { ascending: false });
    if (mode === 'user' && u.user) {
      // Em modo user, lista os templates dele + globais (admins). RLS permite ler ambos.
      query = query;
    }
    const { data } = await query;
    const list = (data || []) as EbookConfig[];
    setConfigs(list);
    // Preferência: padrão do próprio usuário > primeiro próprio > qualquer padrão > primeiro
    const own = u.user ? list.filter(c => c.user_id === u.user!.id) : [];
    const def = own.find(c => c.is_default) || own[0] || list.find(c => c.is_default) || list[0];
    if (def) {
      setCurrent(def);
      onSelect?.(def);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [mode]);

  const save = async () => {
    if (!canEdit) {
      toast({ title: 'Add-on necessário', description: 'Ative o add-on Personalizar Template ou eBooks Premium para criar/editar templates.', variant: 'destructive' });
      return;
    }
    if (mode === 'user' && isGlobalTemplate) {
      toast({ title: 'Template da equipe', description: 'Templates globais não podem ser editados. Use "Duplicar" para criar uma cópia editável.', variant: 'destructive' });
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

  const duplicateTemplate = async (source?: EbookConfig) => {
    if (!canEdit) {
      toast({ title: 'Add-on necessário', description: 'Ative o add-on Personalizar Template ou eBooks Premium para duplicar templates.', variant: 'destructive' });
      return;
    }
    const src = source || current;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Não autenticado');
      const payload: any = { ...src, name: `${src.name} (cópia)`, is_default: false, user_id: u.user.id };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      const { data, error } = await supabase.from('ebook_configs').insert(payload).select().single();
      if (error) throw error;
      toast({ title: 'Template duplicado!', description: 'Agora você pode editar a sua cópia.' });
      setCurrent(data as any);
      onSelect?.(data as any);
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao duplicar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };
  const duplicateCurrent = () => duplicateTemplate(current);

  const newTemplate = async () => {
    if (!canEdit) {
      toast({ title: 'Add-on necessário', description: 'Ative o add-on Personalizar Template ou eBooks Premium para criar templates.', variant: 'destructive' });
      return;
    }
    // Cria de fato no banco com nome padrão e seleciona para edição
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Não autenticado');
      const customName = (current?.name || '').trim();
      const isDefaultName = !customName || customName === 'Meu template' || /^Novo template \d+$/.test(customName);
      const finalName = isDefaultName ? `Novo template ${configs.length + 1}` : customName;
      const payload: any = { ...DEFAULT_CFG, ...(current || {}), name: finalName, is_default: false, user_id: u.user.id };
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

  const remove = async (id?: string, ownerId?: string | null) => {
    if (!id) return;
    if (mode === 'user' && ownerId && currentUserId && ownerId !== currentUserId) {
      toast({ title: 'Template da equipe', description: 'Você não pode excluir templates globais. Apenas administradores podem.', variant: 'destructive' });
      return;
    }
    if (!confirm('Excluir este template?')) return;
    const { error } = await supabase.from('ebook_configs').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
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
          <Button size="sm" variant="outline" onClick={newTemplate} disabled={saving || !canEdit} title={canEdit ? 'Criar template' : 'Necessário add-on Personalizar Template ou eBooks Premium'}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : !canEdit ? <Lock className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {!canEdit && (
          <div className="text-xs p-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5">
            <p>Para criar seus próprios templates personalizados, ative o add-on <strong>Personalizar Template</strong> ou <strong>eBooks Premium</strong>.</p>
            <Button asChild size="sm" variant="outline" className="w-full"><Link to="/dashboard/addons">Ver add-ons</Link></Button>
          </div>
        )}
        {configs.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum template ainda. Crie o primeiro.</p>}
        {configs.map(c => {
          const isGlobal = mode === 'user' && c.user_id && currentUserId && c.user_id !== currentUserId;
          return (
            <button
              key={c.id}
              onClick={() => { setCurrent(c); onSelect?.(c); }}
              className={`w-full text-left px-2.5 py-2 rounded-md text-sm hover:bg-accent flex items-center justify-between gap-2 ${current.id === c.id ? 'bg-accent' : ''}`}
            >
              <span className="truncate flex items-center gap-1.5">
                {c.is_default && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                {c.premium_product_mode && (
                  <Gem className="h-3 w-3 text-cyan-400" aria-label="Modo Premium ativo" />
                )}
                <span className="truncate">{c.name}</span>
                {isGlobal && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">equipe</span>
                )}
              </span>
              {!isGlobal ? (
                <Trash2
                  className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={(e) => { e.stopPropagation(); remove(c.id, c.user_id); }}
                />
              ) : (
                <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-label="Template da equipe (somente leitura)" />
              )}
            </button>
          );
        })}
      </Card>

      <Card className="p-5 space-y-5">
        {mode === 'user' && isGlobalTemplate && (
          <div className="text-xs rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-1.5">
            <p className="font-medium text-cyan-300 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Template da equipe — somente leitura
            </p>
            <p className="text-muted-foreground">Este template foi criado pelos administradores. Você <strong>não pode editá-lo, renomeá-lo, defini-lo como padrão, marcá-lo como Premium nem excluí-lo</strong>.</p>
            <p className="text-muted-foreground">O que você pode fazer:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li><strong>Visualizar</strong> os campos para entender a configuração.</li>
              <li><strong>Duplicar</strong> para criar uma cópia editável vinculada à sua conta.</li>
              <li><strong>Usá-lo como padrão</strong> de geração na aba <em>Gerar por Avatar</em>.</li>
            </ul>
            <div className="pt-1">
              <Button size="sm" variant="outline" onClick={duplicateCurrent} disabled={saving || !canEdit}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Duplicar para editar
              </Button>
            </div>
          </div>
        )}
        <fieldset disabled={editingLocked} className={editingLocked ? 'space-y-5 opacity-60' : 'space-y-5'}>
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
          <div className={`grid gap-4 ${canSeeAiModel ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            <div className="space-y-1.5">
              <Label>Nº de capítulos</Label>
              <Input type="number" min={3} max={30} value={current.num_chapters} onChange={e => setField('num_chapters', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Mín. páginas/cap.</Label>
              <Input type="number" min={3} max={30} value={current.min_pages_per_chapter} onChange={e => setField('min_pages_per_chapter', Number(e.target.value))} />
            </div>
            {canSeeAiModel && (
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
            )}
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

        {canSeePremiumMode && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <Switch checked={current.premium_product_mode} onCheckedChange={v => setField('premium_product_mode', v)} />
              <div>
                <Label className="cursor-pointer">💎 Modo Produto Premium</Label>
                <p className="text-xs text-muted-foreground">A IA criará nome de método exclusivo, promessa forte e posicionamento de mercado.</p>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">🧾 Prompt base (opcional)</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Variáveis: <code>{'{{tema}}'}</code>, <code>{'{{publico}}'}</code>, <code>{'{{nivel}}'}</code>, <code>{'{{estilo}}'}</code>, <code>{'{{capitulos}}'}</code>. Deixe vazio para usar o prompt padrão otimizado.
          </p>
          <Textarea value={current.base_prompt || ''} onChange={e => setField('base_prompt', e.target.value)} rows={5} />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          {mode === 'user' && isGlobalTemplate && canEdit && (
            <Button variant="outline" onClick={duplicateCurrent} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Duplicar para editar
            </Button>
          )}
          <Button onClick={save} disabled={saving || editingLocked} title={editingLocked ? (isGlobalTemplate ? 'Templates da equipe são somente leitura — duplique para editar.' : 'Necessário add-on para editar.') : undefined}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingLocked ? <Lock className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {editingLocked ? (isGlobalTemplate ? 'Somente leitura' : 'Bloqueado') : 'Salvar template'}
          </Button>
        </div>
        </fieldset>
      </Card>
    </div>
  );
}
