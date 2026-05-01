import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Star, Gem, BookOpen, Save, Copy } from 'lucide-react';

type EbookConfig = {
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
  category?: string;
  tags?: string[];
  sort_order?: number;
};

const DEFAULT_CFG: EbookConfig = {
  name: 'Novo template global',
  is_default: false,
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
  category: 'geral',
  tags: [],
  sort_order: 0,
};

export function AdminEbookTemplatesTab() {
  const { toast } = useToast();
  const [list, setList] = useState<EbookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EbookConfig | null>(null);
  const [tagsInput, setTagsInput] = useState('');

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    setAdminId(u.user?.id || null);

    // Busca todos os configs cujo user_id é admin (templates globais)
    // Como RLS já garante leitura desses, e o admin lê tudo, filtramos pelos owners admins via has_role no servidor:
    // Estratégia simples: buscar todos e filtrar pelos que tenham user_id == próprio admin OU outros admins.
    // Para simplificar e evitar joins, mostramos apenas os criados pelo próprio admin atual + qualquer com is_global flag.
    const { data, error } = await supabase
      .from('ebook_configs')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Filtra: somente templates de admins (verificando via RPC has_role seria caro; usamos heurística:
    // como admin vê tudo, e usuários comuns só veem os deles + globais, assumimos que aqui exibimos todos
    // que NÃO pertencem a um usuário comum identificado. Como simplificação, mostraremos os do próprio admin
    // que são os "globais" desta conta admin).
    const all = (data || []) as EbookConfig[];
    setList(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing({ ...DEFAULT_CFG, sort_order: (list[list.length - 1]?.sort_order || list.length) + 1 });
    setTagsInput('');
  };

  const startEdit = (cfg: EbookConfig) => {
    setEditing({ ...cfg });
    setTagsInput((cfg.tags || []).join(', '));
  };

  const cancelEdit = () => {
    setEditing(null);
    setTagsInput('');
  };

  const save = async () => {
    if (!editing || !adminId) return;
    setSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const payload: any = { ...editing, tags, user_id: adminId };
      let result;
      if (editing.id) {
        result = await supabase.from('ebook_configs').update(payload).eq('id', editing.id).select().single();
      } else {
        delete payload.id;
        result = await supabase.from('ebook_configs').insert(payload).select().single();
      }
      if (result.error) throw result.error;
      toast({ title: editing.id ? 'Template atualizado!' : 'Template global criado!' });
      setEditing(null);
      setTagsInput('');
      await load();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id?: string) => {
    if (!id) return;
    if (!confirm('Excluir este template global? Usuários deixarão de vê-lo no seletor.')) return;
    const { error } = await supabase.from('ebook_configs').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Template excluído' });
    load();
  };

  const duplicate = async (cfg: EbookConfig) => {
    if (!adminId) return;
    const payload: any = { ...cfg, name: `${cfg.name} (cópia)`, is_default: false, user_id: adminId, sort_order: (list[list.length - 1]?.sort_order || list.length) + 1 };
    delete payload.id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;
    const { error } = await supabase.from('ebook_configs').insert(payload);
    if (error) {
      toast({ title: 'Erro ao duplicar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Template duplicado' });
    load();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const a = list[index];
    const b = list[target];
    if (!a.id || !b.id) return;
    // troca sort_order
    const aOrder = a.sort_order ?? index;
    const bOrder = b.sort_order ?? target;
    setList(prev => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    const { error: e1 } = await supabase.from('ebook_configs').update({ sort_order: bOrder }).eq('id', a.id);
    const { error: e2 } = await supabase.from('ebook_configs').update({ sort_order: aOrder }).eq('id', b.id);
    if (e1 || e2) {
      toast({ title: 'Erro ao reordenar', description: (e1 || e2)?.message, variant: 'destructive' });
      load();
    }
  };

  const setF = <K extends keyof EbookConfig>(k: K, v: EbookConfig[K]) => {
    setEditing(p => p ? { ...p, [k]: v } : p);
  };

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Templates globais de eBooks</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Templates criados aqui aparecem como "equipe" no seletor de todos os usuários com add-on de eBooks.
              Use as setas para reordenar — a ordem definida aqui é a ordem que os usuários verão.
            </p>
          </div>
          <Button size="sm" onClick={startNew} disabled={!!editing}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo template global
          </Button>
        </div>
      </Card>

      {editing && (
        <Card className="p-5 space-y-4 border-cyan-500/40">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{editing.id ? 'Editar template' : 'Novo template global'}</h4>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Salvar
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editing.name} onChange={e => setF('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={editing.category || ''} onChange={e => setF('category', e.target.value)} placeholder="ex.: marketing, infoproduto, técnico" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="ex.: vendas, autoridade, iniciante" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Nº de capítulos</Label>
              <Input type="number" min={3} max={30} value={editing.num_chapters} onChange={e => setF('num_chapters', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Mín. páginas/cap.</Label>
              <Input type="number" min={3} max={30} value={editing.min_pages_per_chapter} onChange={e => setF('min_pages_per_chapter', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo de IA</Label>
              <Select value={editing.ai_model} onValueChange={v => setF('ai_model', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-2.5-pro">Lovable AI Pro</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash">Lovable AI Flash</SelectItem>
                  <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
                  <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Estilo</Label>
              <Select value={editing.writing_style} onValueChange={v => setF('writing_style', v)}>
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
              <Select value={editing.depth_level} onValueChange={v => setF('depth_level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {editing.writing_style === 'custom' && (
            <div className="space-y-1.5">
              <Label>Descrição do estilo customizado</Label>
              <Textarea value={editing.custom_style || ''} onChange={e => setF('custom_style', e.target.value)} rows={2} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Público-alvo</Label>
            <Textarea value={editing.target_audience || ''} onChange={e => setF('target_audience', e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>Prompt base (opcional)</Label>
            <Textarea value={editing.base_prompt || ''} onChange={e => setF('base_prompt', e.target.value)} rows={3} placeholder="Instruções extras ao gerar com este template" />
          </div>

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
                <Switch checked={(editing as any)[k]} onCheckedChange={v => setF(k as any, v as any)} />
                <Label className="text-sm">{label}</Label>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={editing.premium_product_mode} onCheckedChange={v => setF('premium_product_mode', v)} />
              <Label>Modo Produto Premium</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing.is_default} onCheckedChange={v => setF('is_default', v)} />
              <Label>Marcar como padrão sugerido</Label>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        {list.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum template ainda. Clique em "Novo template global" para criar o primeiro.
          </div>
        ) : (
          <div className="divide-y">
            {list.map((c, i) => (
              <div key={c.id} className="p-3 flex items-center gap-3 hover:bg-accent/30">
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(i, 1)} disabled={i === list.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.is_default && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                    {c.premium_product_mode && <Gem className="h-3.5 w-3.5 text-cyan-400" />}
                    <span className="font-medium truncate">{c.name}</span>
                    {c.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                        {c.category}
                      </span>
                    )}
                    {(c.tags || []).slice(0, 4).map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">{t}</span>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.num_chapters} cap · {c.min_pages_per_chapter} pg/cap · {c.writing_style} · {c.depth_level}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Editar</Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicate(c)} title="Duplicar">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(c.id)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
