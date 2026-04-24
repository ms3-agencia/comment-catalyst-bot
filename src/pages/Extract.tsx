import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Youtube, Plus, X, Loader2, MessageSquare, ThumbsUp, Sparkles } from 'lucide-react';
import { AiProfileCard } from '@/components/AiProfileCard';
import { useCredits } from '@/hooks/useCredits';

// Parse Supabase Edge Function errors. When status != 2xx, supabase-js throws a
// FunctionsHttpError whose body is in `error.context` (a Response). We read it
// to surface "insufficient credits" (402) and other structured errors.
const parseFnError = async (
  error: unknown,
  data: { error?: string; insufficient_credits?: boolean } | null
): Promise<{ message: string; insufficient: boolean }> => {
  if (data?.error) {
    return { message: data.error, insufficient: !!data.insufficient_credits };
  }
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.clone().json();
      if (body?.insufficient_credits || ctx.status === 402) {
        return {
          message: body?.error || 'Você está sem créditos. Compre mais para continuar.',
          insufficient: true,
        };
      }
      if (body?.error) return { message: body.error, insufficient: false };
    } catch {
      // body wasn't JSON
    }
    if (ctx.status === 402) {
      return { message: 'Você está sem créditos. Compre mais para continuar.', insufficient: true };
    }
  }
  return {
    message: (error as { message?: string } | null)?.message || 'Erro desconhecido',
    insufficient: false,
  };
};

type Comment = {
  author: string;
  author_avatar: string;
  content: string;
  likes: number;
  published_at: string;
  video_url: string;
  sentiment?: string;
};

const Extract = () => {
  const { user, profile } = useAuth();
  const { refresh: refreshCredits } = useCredits();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleInsufficient = (msg: string) => {
    toast({
      title: 'Créditos insuficientes',
      description: `${msg} Redirecionando para a compra…`,
      variant: 'destructive',
    });
    setTimeout(() => navigate('/dashboard/credits'), 1200);
  };
  const [urls, setUrls] = useState<string[]>(['']);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [aiProfile, setAiProfile] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const addUrl = () => setUrls([...urls, '']);
  const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, val: string) => { const u = [...urls]; u[i] = val; setUrls(u); };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    const validUrls = urls.filter(u => u.trim());
    if (!validUrls.length || !projectName.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setLoading(true);

    // Stable idempotency key per (project name + urls). Persists across retries
    // so reenvios after network failure return the cached response without re-charging.
    const stableSeed = `extract:${projectName.trim()}|${validUrls.join('|')}`;
    const storageKey = `idem:${stableSeed}`;
    let idempotencyKey = localStorage.getItem(storageKey);
    if (!idempotencyKey) {
      idempotencyKey = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
      localStorage.setItem(storageKey, idempotencyKey);
    }

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('youtube-comments', {
        body: { videoUrls: validUrls, idempotencyKey },
      });

      if (fnError || fnData?.error) {
        const parsed = await parseFnError(fnError, fnData);
        if (parsed.insufficient) {
          handleInsufficient(parsed.message);
        } else {
          toast({ title: 'Erro na extração', description: parsed.message, variant: 'destructive' });
        }
        setLoading(false);
        return;
      }

      const extractedComments: Comment[] = fnData.comments || [];

      if (extractedComments.length === 0) {
        toast({ title: 'Nenhum comentário encontrado', description: 'Verifique os links ou se os vídeos têm comentários habilitados.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Create project
      const { data: project, error } = await supabase.from('projects').insert({
        user_id: user!.id,
        name: projectName,
        video_urls: validUrls,
        status: 'completed',
        total_comments: extractedComments.length,
      }).select().single();

      if (error) {
        toast({ title: 'Erro ao criar projeto', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Insert comments in batches of 50
      const commentsToInsert = extractedComments.map(c => ({
        project_id: project.id,
        video_url: c.video_url,
        author: c.author,
        author_avatar: c.author_avatar,
        content: c.content,
        likes: c.likes,
        published_at: c.published_at,
      }));

      for (let i = 0; i < commentsToInsert.length; i += 50) {
        await supabase.from('comments').insert(commentsToInsert.slice(i, i + 50));
      }

      setProjectId(project.id);
      setComments(extractedComments);
      refreshCredits();
      toast({ title: 'Extração concluída!', description: `${extractedComments.length} comentários extraídos.${fnData.credits_charged ? ` ${fnData.credits_charged} créditos consumidos.` : ''}` });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleGenerateAI = async () => {
    setAiLoading(true);

    // Idempotency: stable per project so a retry doesn't burn credits twice.
    const storageKey = `idem:ai_profile:${projectId ?? 'no-project'}`;
    let idempotencyKey = localStorage.getItem(storageKey);
    if (!idempotencyKey) {
      idempotencyKey = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
      localStorage.setItem(storageKey, idempotencyKey);
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-profile', {
        body: { comments: comments.map(c => ({ author: c.author, content: c.content, likes: c.likes })), idempotencyKey },
      });

      if (error || data?.error) {
        toast({ title: data?.insufficient_credits ? 'Créditos insuficientes' : 'Erro ao gerar perfil', description: data?.error || error?.message, variant: 'destructive' });
        setAiLoading(false);
        return;
      }

      setAiProfile(data.profile);
      refreshCredits();
      if (data.credits_charged) {
        toast({ title: 'Perfil gerado!', description: `${data.credits_charged} créditos consumidos.` });
      }
      if (projectId) {
        await supabase.from('projects').update({ ai_profile: data.profile }).eq('id', projectId);
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setAiLoading(false);
  };

  const sentimentColor = (s?: string) => {
    if (s === 'positivo') return 'text-success';
    if (s === 'negativo') return 'text-destructive';
    return 'text-muted-foreground';
  };

  // Count sentiments (basic heuristic from content)
  const positiveCount = comments.filter(c => c.likes >= 10).length;
  const negativeCount = comments.filter(c => c.likes === 0 && c.content.length > 50).length;
  const neutralCount = comments.length - positiveCount - negativeCount;

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-8 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Youtube className="text-destructive" /> Extrair Comentários</h1>
          <p className="text-muted-foreground mt-1">Cole os links dos vídeos para extrair e analisar comentários via YouTube API</p>
        </div>

        {!comments.length ? (
          <Card className="glass p-6">
            <form onSubmit={handleExtract} className="space-y-5">
              <div className="space-y-2">
                <Label>Nome do Projeto</Label>
                <Input placeholder="Ex: Análise Canal XYZ" value={projectName} onChange={e => setProjectName(e.target.value)} required />
              </div>
              <div className="space-y-3">
                <Label>URLs dos Vídeos</Label>
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="https://youtube.com/watch?v=..." value={url} onChange={e => updateUrl(i, e.target.value)} />
                    {urls.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeUrl(i)}><X size={16} /></Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addUrl}><Plus className="mr-1" size={14} /> Adicionar URL</Button>
              </div>
              <Button type="submit" className="w-full glow-primary" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extraindo via YouTube API...</> : 'Extrair Comentários'}
              </Button>
            </form>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="glass p-4 text-center">
                <p className="text-2xl font-bold font-heading text-success">{positiveCount}</p>
                <p className="text-sm text-muted-foreground">Engajados (10+ likes)</p>
              </Card>
              <Card className="glass p-4 text-center">
                <p className="text-2xl font-bold font-heading text-muted-foreground">{neutralCount}</p>
                <p className="text-sm text-muted-foreground">Regulares</p>
              </Card>
              <Card className="glass p-4 text-center">
                <p className="text-2xl font-bold font-heading text-primary">{comments.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </Card>
            </div>

            {/* Comments list */}
            <Card className="glass divide-y divide-border max-h-[500px] overflow-y-auto">
              {comments.map((c, i) => (
                <div key={i} className="p-4 flex gap-4">
                  {c.author_avatar ? (
                    <img src={c.author_avatar} alt={c.author} className="h-10 w-10 shrink-0 rounded-full" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {c.author?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{c.author}</span>
                    <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: c.content }} />
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ThumbsUp size={12} /> {c.likes}</span>
                      <span>{new Date(c.published_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </Card>

            {/* AI Profile */}
            <Card className="glass p-6">
              {!aiProfile ? (
                <div className="text-center">
                  <Sparkles className="mx-auto text-warning" size={32} />
                  <h3 className="font-heading text-lg font-bold mt-3">Gerar Perfil de Avatar com IA</h3>
                  <p className="text-sm text-muted-foreground mt-1">Análise inteligente real do perfil da sua audiência</p>
                  <Button onClick={handleGenerateAI} className="mt-4 glow-primary" disabled={aiLoading}>
                    {aiLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando com IA...</> : <><Sparkles className="mr-2 h-4 w-4" /> Gerar com IA</>}
                  </Button>
                </div>
              ) : (
                <AiProfileCard profile={aiProfile} projectName={projectName} />
              )}
            </Card>

            <Button variant="outline" onClick={() => { setComments([]); setProjectId(null); setAiProfile(null); setProjectName(''); setUrls(['']); }}>
              Nova Extração
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Extract;
