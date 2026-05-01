import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Sparkles, MessageSquare, Crown, Send, Lock, FileText, ArrowRight, Save, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserAddons } from '@/hooks/useUserAddons';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { EbookConfigPanel, type EbookConfig } from '@/components/ebook/EbookConfigPanel';
import { EbookGenerationOverlay } from '@/components/ebook/EbookGenerationOverlay';

type Project = { id: string; name: string; ai_profile?: string | null };

export default function EbooksPage() {
  const { hasAddon, loading: addonsLoading } = useUserAddons();
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();

  const hasBasic = hasAddon('ebook-generator');
  const hasPremium = hasAddon('ebook-premium');
  const hasCustomization = hasPremium || hasAddon('ebook-template-customization');
  const anyAccess = hasBasic || hasPremium;

  const [projects, setProjects] = useState<Project[]>([]);
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<EbookConfig | null>(null);
  const [availableConfigs, setAvailableConfigs] = useState<EbookConfig[]>([]);

  // Avatar tab
  const [topic, setTopic] = useState('');
  const [projectId, setProjectId] = useState<string>('none');
  const [generating, setGenerating] = useState(false);
  const [genDone, setGenDone] = useState(false);
  const [savedConfigId, setSavedConfigId] = useState<string | null>(null);
  const [savingPref, setSavingPref] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');


  const loadConfigs = async (preferredId?: string | null) => {
    // RLS permite ler templates globais (admin) + do próprio usuário
    const { data } = await supabase.from('ebook_configs').select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    const list = (data || []) as EbookConfig[];
    setAvailableConfigs(list);
    const pick =
      (preferredId && list.find(c => c.id === preferredId)) ||
      list.find(c => c.is_default) ||
      list[0] ||
      null;
    setSelectedConfig(prev => prev || pick);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from('projects').select('id, name, ai_profile').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setProjects((data || []) as any));
    supabase.from('ebooks').select('id, title, subtitle, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setEbooks(data || []));
    // Carrega preferência salva do usuário (template padrão)
    supabase.from('profiles').select('preferred_ebook_config_id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        const pref = (data as any)?.preferred_ebook_config_id || null;
        setSavedConfigId(pref);
        loadConfigs(pref);
      });
  }, [user]);

  const savePreference = async () => {
    if (!user || !selectedConfig?.id) return;
    setSavingPref(true);
    try {
      const { error } = await supabase.from('profiles')
        .update({ preferred_ebook_config_id: selectedConfig.id } as any)
        .eq('user_id', user.id);
      if (error) throw error;
      setSavedConfigId(selectedConfig.id);
      toast({ title: 'Padrão definido!', description: `Template "${selectedConfig.name}" será usado em novos eBooks.` });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPref(false);
    }
  };

  const refreshEbooks = async () => {
    const { data } = await supabase.from('ebooks').select('id, title, subtitle, status, created_at').order('created_at', { ascending: false });
    setEbooks(data || []);
  };

  const generateFromAvatar = async () => {
    if (!topic.trim()) { toast({ title: 'Informe o tema', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ebook-generate-outline', {
        body: {
          topic,
          project_id: projectId && projectId !== 'none' ? projectId : null,
          config_id: selectedConfig?.id || null,
          premium_product_mode: selectedConfig?.premium_product_mode,
        },
      });
      if (error) {
        let msg = error.message;
        try { const ctx: any = (error as any).context; if (ctx?.json) { const j = await ctx.json(); msg = j.message || j.error || msg; } } catch {}
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      toast({ title: 'Estrutura gerada!', description: 'Vamos ao editor.' });
      await refreshEbooks();
      setGenDone(true);
      const ebookId = (data as any).ebook_id;
      setTimeout(() => nav(`/dashboard/ebooks/${ebookId}`), 700);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
      setGenerating(false);
      setGenDone(false);
    }
  };

  if (addonsLoading) {
    return <DashboardLayout><div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;
  }

  if (!anyAccess) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-12">
          <Card className="p-8 text-center space-y-4">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h1 className="font-heading text-2xl font-bold">Add-on necessário</h1>
            <p className="text-muted-foreground">
              Para gerar eBooks você precisa do add-on <strong>Gerador de eBooks</strong>. Para chat conversacional + editor visual, escolha o <strong>eBooks Premium</strong>.
            </p>
            <Button asChild><Link to="/dashboard/addons">Ver Add-ons disponíveis</Link></Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <EbookGenerationOverlay
        visible={generating}
        stage={genDone ? 'done' : 'outline'}
        title={genDone ? 'Estrutura pronta!' : 'Estruturando seu eBook'}
        subtitle={topic}
        progress={genDone ? 100 : undefined}
        estimatedMs={30_000}
      />
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              eBooks
            </h1>
            <p className="text-muted-foreground">Crie eBooks profundos e personalizados com IA.</p>
          </div>
          <div className="flex gap-2">
            {hasBasic && <Badge variant="secondary">Gerador Ativo</Badge>}
            {hasPremium && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Crown className="h-3 w-3 mr-1" />Premium</Badge>}
          </div>
        </div>

        <Tabs defaultValue="avatar">
          <TabsList>
            <TabsTrigger value="avatar"><Sparkles className="h-4 w-4 mr-1" />Gerar por Avatar</TabsTrigger>
            <TabsTrigger value="chat" disabled={!hasPremium}>
              <MessageSquare className="h-4 w-4 mr-1" />Chat IA {!hasPremium && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="mine">Meus eBooks ({ebooks.length})</TabsTrigger>
            {hasCustomization && (
              <TabsTrigger value="templates">
                <Crown className="h-4 w-4 mr-1 text-amber-400" />Personalizar Template
                {!hasPremium && <Badge className="ml-2 bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px]">Add-on</Badge>}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="avatar" className="mt-4">
            <Card className="p-6 space-y-4 max-w-3xl">
              <h2 className="font-semibold text-lg">Gerar baseado no avatar do projeto</h2>
              <div className="space-y-1.5">
                <Label>Tema do eBook *</Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex.: Como criar uma audiência fiel no YouTube em 90 dias" />
              </div>
              <div className="space-y-1.5">
                <Label>Projeto/Avatar (opcional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um projeto para usar o avatar dele" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem avatar (usar só o tema)</SelectItem>
                    {projects.filter(p => p.ai_profile).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Apenas projetos com avatar gerado aparecem aqui.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Template de configuração</Label>
                {(() => {
                  const categories = Array.from(new Set(availableConfigs.map(c => c.category || 'geral'))).sort();
                  const tags = Array.from(new Set(availableConfigs.flatMap(c => c.tags || []))).sort();
                  const filtered = availableConfigs.filter(c => {
                    const cat = c.category || 'geral';
                    if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
                    if (tagFilter !== 'all' && !(c.tags || []).includes(tagFilter)) return false;
                    return true;
                  });
                  return (
                    <>
                      {(categories.length > 1 || tags.length > 0) && (
                        <div className="flex flex-wrap gap-2">
                          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas categorias</SelectItem>
                              {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {tags.length > 0 && (
                            <Select value={tagFilter} onValueChange={setTagFilter}>
                              <SelectTrigger className="h-8 text-xs w-auto min-w-[140px]">
                                <SelectValue placeholder="Tag" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas tags</SelectItem>
                                {tags.map(t => (
                                  <SelectItem key={t} value={t}>#{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {(categoryFilter !== 'all' || tagFilter !== 'all') && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => { setCategoryFilter('all'); setTagFilter('all'); }}
                            >
                              Limpar
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Select
                          value={selectedConfig?.id || ''}
                          onValueChange={(v) => {
                            const cfg = availableConfigs.find(c => c.id === v);
                            if (cfg) setSelectedConfig(cfg);
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um template" />
                          </SelectTrigger>
                          <SelectContent>
                            {filtered.length === 0 && (
                              <SelectItem value="__none__" disabled>Nenhum template encontrado</SelectItem>
                            )}
                            {filtered.map(c => {
                              const mine = c.user_id && user && c.user_id === user.id;
                              const isUserDefault = savedConfigId === c.id;
                              return (
                                <SelectItem key={c.id} value={c.id!}>
                                  {c.name}
                                  {mine ? ' (meu)' : ' (equipe)'}
                                  {isUserDefault ? ' · ⭐ meu padrão' : (c.is_default ? ' · padrão' : '')}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={savePreference}
                    disabled={
                      savingPref ||
                      !selectedConfig?.id ||
                      savedConfigId === selectedConfig?.id
                    }
                    title="Definir como padrão para novos eBooks"
                  >
                    {savingPref ? <Loader2 className="h-4 w-4 animate-spin" />
                      : savedConfigId === selectedConfig?.id ? <Check className="h-4 w-4" />
                      : <Save className="h-4 w-4" />}
                    <span className="ml-1">
                      {savedConfigId === selectedConfig?.id ? 'Padrão definido' : 'Definir como padrão'}
                    </span>
                  </Button>
                </div>
                {selectedConfig && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>
                      {selectedConfig.num_chapters || 8} capítulos · {selectedConfig.depth_level || 'intermediario'}
                      {selectedConfig.premium_product_mode && ' · 💎 Modo Produto'}
                    </span>
                    {savedConfigId === selectedConfig.id && (
                      <Badge variant="secondary" className="text-[10px]">⭐ Padrão para novos eBooks</Badge>
                    )}
                  </p>
                )}
                {selectedConfig && user && selectedConfig.user_id !== user.id && (
                  <div className="text-xs rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-1">
                    <p className="font-medium text-cyan-300 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Template da equipe
                    </p>
                    <p className="text-muted-foreground">
                      Este template foi criado pelos administradores e <strong>não pode ser editado</strong>. Você pode:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      <li><strong>Usá-lo como base</strong> para suas gerações de eBook.</li>
                      <li><strong>Definir como padrão</strong> para novos eBooks.</li>
                    </ul>
                    <p className="text-muted-foreground">
                      Não é possível alterar nº de capítulos, prompt base, modelo de IA ou Modo Produto Premium do template da equipe.
                      {!hasCustomization && (
                        <> Para criar templates próprios, ative o add-on <Link to="/dashboard/addons" className="text-primary underline">Personalizar Template</Link> ou <Link to="/dashboard/addons" className="text-primary underline">eBooks Premium</Link>.</>
                      )}
                      {hasCustomization && (
                        <> Para edição completa, crie/duplique seu próprio template na aba <strong>Personalizar Template</strong>.</>
                      )}
                    </p>
                  </div>
                )}
                {selectedConfig && user && selectedConfig.user_id === user.id && (
                  <p className="text-xs text-muted-foreground">
                    Este é um template seu — edite-o livremente na aba <strong>Personalizar Template</strong>.
                  </p>
                )}
              </div>

              <Button size="lg" onClick={generateFromAvatar} disabled={generating} className="w-full">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Gerar estrutura do eBook (5 créditos)
              </Button>
              <p className="text-xs text-muted-foreground">
                A geração é em etapas: primeiro a estrutura, depois cada capítulo individualmente (8 créditos cada). Você pode pausar e retomar a qualquer momento.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            {hasPremium ? (
              <EbookChatTab onCreated={(id) => { refreshEbooks(); nav(`/dashboard/ebooks/${id}`); }} />
            ) : (
              <Card className="p-8 text-center"><Crown className="h-10 w-10 mx-auto text-amber-400" /><p className="mt-2">Recurso exclusivo do add-on <strong>eBooks Premium</strong>.</p></Card>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-4">
            {ebooks.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">Nenhum eBook ainda. Crie seu primeiro!</Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {ebooks.map(eb => (
                  <Link key={eb.id} to={`/dashboard/ebooks/${eb.id}`}>
                    <Card className="p-4 hover:border-primary/50 transition cursor-pointer h-full">
                      <FileText className="h-5 w-5 text-primary mb-2" />
                      <h3 className="font-semibold line-clamp-2">{eb.title}</h3>
                      {eb.subtitle && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{eb.subtitle}</p>}
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <Badge variant="outline">{eb.status}</Badge>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          {hasCustomization && (
            <TabsContent value="templates" className="mt-4">
              <Card className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-400" />
                  <h2 className="font-semibold text-lg">Personalizar Template</h2>
                  {!hasPremium && <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Add-on</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">Crie e edite templates personalizados para usar na geração dos seus eBooks.</p>
                <EbookConfigPanel mode="user" canEdit={true} onSelect={(c) => setSelectedConfig(c)} />
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// --- Chat Tab ---

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function EbookChatTab({ onCreated }: { onCreated: (ebookId: string) => void }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: 'Olá! Vou te ajudar a criar um eBook premium completo. Para começar: **qual é o tema central** e a transformação que você quer entregar ao leitor?' },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingDone, setCreatingDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMsg = { role: 'user', content: input };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setStreaming(true);

    let assistantText = '';
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebook-chat`;
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session?.access_token}` },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 402) throw new Error('Créditos esgotados');
        if (resp.status === 429) throw new Error('Muitas requisições. Aguarde.');
        if (resp.status === 403) throw new Error('Add-on Premium necessário');
        throw new Error('Erro no chat');
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      setMessages(p => [...p, { role: 'assistant', content: '' }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const js = line.slice(6).trim();
          if (js === '[DONE]') break;
          try {
            const p = JSON.parse(js);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              assistantText += c;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantText };
                return copy;
              });
            }
          } catch { buf = line + '\n' + buf; break; }
        }
      }

      // Detecta token de geração
      if (assistantText.includes('[[GENERATE_OUTLINE]]')) {
        const jsonPart = assistantText.split('[[GENERATE_OUTLINE]]')[1]?.trim();
        const parsed = jsonPart ? safeParseJson(jsonPart) : null;
        if (parsed?.topic) {
          setCreating(true);
          // 1. cria config temporária
          const { data: u } = await supabase.auth.getUser();
          const { data: cfg } = await supabase.from('ebook_configs').insert({
            user_id: u.user!.id,
            name: `Chat: ${parsed.topic.slice(0, 40)}`,
            num_chapters: parsed.num_chapters || 8,
            min_pages_per_chapter: 10,
            writing_style: parsed.writing_style || 'didatico',
            depth_level: parsed.depth_level || 'intermediario',
            target_audience: parsed.target_audience || null,
            include_exercises: !!parsed.include_exercises,
            include_summary: parsed.include_summary !== false,
            include_checklist: !!parsed.include_checklist,
            include_case_studies: !!parsed.include_case_studies,
            include_examples: parsed.include_examples !== false,
            include_metaphors: !!parsed.include_metaphors,
            premium_product_mode: !!parsed.premium_product_mode,
          }).select().single();

          const { data: outline, error } = await supabase.functions.invoke('ebook-generate-outline', {
            body: { topic: parsed.topic, config_id: cfg?.id, premium_product_mode: !!parsed.premium_product_mode },
          });
          if (error) throw new Error(error.message);
          toast({ title: 'eBook criado!', description: 'Indo para o editor…' });
          setCreatingDone(true);
          const ebookId = (outline as any).ebook_id;
          setTimeout(() => onCreated(ebookId), 700);
        }
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
      setCreating(false);
      setCreatingDone(false);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      <EbookGenerationOverlay
        visible={creating}
        stage={creatingDone ? 'done' : 'outline'}
        title={creatingDone ? 'Estrutura pronta!' : 'Criando seu eBook a partir do chat'}
        progress={creatingDone ? 100 : undefined}
        estimatedMs={30_000}
      />
      <Card className="flex flex-col h-[600px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {m.content.replace(/\[\[GENERATE_OUTLINE\]\][\s\S]*$/, '').trim() || (streaming && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-3 flex gap-2">
        <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Sua resposta..."
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={2} className="resize-none" disabled={streaming} />
        <Button onClick={send} disabled={streaming || !input.trim()}>
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
    </>
  );
}

function safeParseJson(s: string): any {
  try { return JSON.parse(s); } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
    return null;
  }
}
