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
import { Loader2, BookOpen, Sparkles, MessageSquare, Crown, Send, Lock, FileText, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserAddons } from '@/hooks/useUserAddons';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { EbookConfigPanel, EbookConfig } from '@/components/ebook/EbookConfigPanel';
import { EbookGenerationOverlay } from '@/components/ebook/EbookGenerationOverlay';

type Project = { id: string; name: string; ai_profile?: string | null };

export default function EbooksPage() {
  const { hasAddon, loading: addonsLoading } = useUserAddons();
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();

  const hasBasic = hasAddon('ebook-generator');
  const hasPremium = hasAddon('ebook-premium');
  const anyAccess = hasBasic || hasPremium;

  const [projects, setProjects] = useState<Project[]>([]);
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<EbookConfig | null>(null);

  // Avatar tab
  const [topic, setTopic] = useState('');
  const [projectId, setProjectId] = useState<string>('none');
  const [generating, setGenerating] = useState(false);
  const [genDone, setGenDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('projects').select('id, name, ai_profile').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setProjects((data || []) as any));
    supabase.from('ebooks').select('id, title, subtitle, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => setEbooks(data || []));
  }, [user]);

  const refreshEbooks = async () => {
    const { data } = await supabase.from('ebooks').select('id, title, subtitle, status, created_at').order('created_at', { ascending: false });
    setEbooks(data || []);
  };

  const generateFromAvatar = async () => {
    if (!topic.trim()) { toast({ title: 'Informe o tema', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ebook-generate-outline', {
        body: { topic, project_id: projectId && projectId !== 'none' ? projectId : null, config_id: selectedConfig?.id || null, premium_product_mode: selectedConfig?.premium_product_mode },
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
        stage="outline"
        title="Estruturando seu eBook"
        subtitle={topic}
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
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="mine">Meus eBooks ({ebooks.length})</TabsTrigger>
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
                <p className="text-xs text-muted-foreground">
                  Usando: <strong>{selectedConfig?.name || 'Padrão'}</strong> · {selectedConfig?.num_chapters || 8} capítulos · {selectedConfig?.depth_level || 'intermediario'}
                  {selectedConfig?.premium_product_mode && ' · 💎 Modo Produto'}
                </p>
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

          <TabsContent value="config" className="mt-4">
            <EbookConfigPanel onSelect={setSelectedConfig} />
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
          onCreated((outline as any).ebook_id);
        }
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setStreaming(false);
      setCreating(false);
    }
  };

  return (
    <>
      <EbookGenerationOverlay visible={creating} stage="outline" title="Criando seu eBook a partir do chat" />
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
