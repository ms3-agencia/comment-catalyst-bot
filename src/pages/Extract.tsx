import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Youtube, Plus, X, Loader2, MessageSquare, ThumbsUp, Sparkles, AlertTriangle } from 'lucide-react';
import { AiProfileCard } from '@/components/AiProfileCard';
import { ExtractionAnimation } from '@/components/ExtractionAnimation';
import { GenerationAnimation } from '@/components/GenerationAnimation';
import { useCredits } from '@/hooks/useCredits';
import { usePlanUsage } from '@/hooks/usePlanUsage';

// Translates HTTP status / known error codes into user-friendly Portuguese messages.
const friendlyMessage = (raw: string | undefined, status?: number): string => {
  const msg = (raw || '').toLowerCase();
  if (status === 401 || msg.includes('unauthorized') || msg.includes('jwt'))
    return 'Sua sessão expirou. Faça login novamente para continuar.';
  if (status === 402 || msg.includes('insufficient_credits') || msg.includes('sem créditos'))
    return 'Você está sem créditos suficientes para esta operação.';
  if (status === 403 || msg.includes('forbidden') || msg.includes('quota'))
    return 'Acesso negado pela API do YouTube. Pode ser limite de cota diária — tente novamente mais tarde.';
  if (status === 404 || msg.includes('not found') || msg.includes('video not found'))
    return 'Vídeo não encontrado. Verifique se o link está correto e o vídeo é público.';
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many'))
    return 'Muitas requisições em pouco tempo. Aguarde alguns instantes e tente novamente.';
  if (msg.includes('comments_disabled') || msg.includes('comentários desabilitados'))
    return 'Os comentários deste vídeo estão desabilitados pelo autor.';
  if (msg.includes('invalid url') || msg.includes('url inválida') || msg.includes('parse'))
    return 'Uma das URLs enviadas é inválida. Use links completos do YouTube (ex: https://youtube.com/watch?v=...).';
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout'))
    return 'Falha de conexão com o servidor. Verifique sua internet e tente novamente.';
  if (msg.includes('youtube_api_key') || msg.includes('api key'))
    return 'A chave da YouTube API não está configurada. Avise o administrador.';
  if (status && status >= 500)
    return 'O serviço está temporariamente indisponível. Tente novamente em alguns instantes.';
  return raw || 'Ocorreu um erro inesperado. Tente novamente.';
};

const parseFnError = async (
  error: unknown,
  data: { error?: string; insufficient_credits?: boolean } | null
): Promise<{ message: string; insufficient: boolean }> => {
  if (data?.error) {
    return {
      message: friendlyMessage(data.error),
      insufficient: !!data.insufficient_credits,
    };
  }
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.clone().json();
      const insufficient = !!body?.insufficient_credits || ctx.status === 402;
      return {
        message: friendlyMessage(body?.error, ctx.status),
        insufficient,
      };
    } catch {
      // body wasn't JSON
    }
    return {
      message: friendlyMessage(undefined, ctx.status),
      insufficient: ctx.status === 402,
    };
  }
  return {
    message: friendlyMessage((error as { message?: string } | null)?.message),
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

// Extracts the YouTube video ID from common URL formats so duplicates are
// detected even if the user pastes slightly different URLs (e.g. with extra params).
const extractYoutubeId = (url: string): string | null => {
  const u = url.trim();
  if (!u) return null;
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{6,})/,
    /[?&]v=([A-Za-z0-9_-]{6,})/,
    /youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/,
  ];
  for (const re of patterns) {
    const m = u.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
};

const Extract = () => {
  const { user, profile } = useAuth();
  const { refresh: refreshCredits } = useCredits();
  const { usage, checkAffordable } = usePlanUsage();
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
  const [duplicateInfo, setDuplicateInfo] = useState<
    { urls: string[]; projects: { id: string; name: string }[] } | null
  >(null);

  const addUrl = () => setUrls([...urls, '']);
  const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, val: string) => { const u = [...urls]; u[i] = val; setUrls(u); };

  // Performs the actual extraction (separated so the duplicate dialog can call it).
  const runExtraction = async (validUrls: string[]) => {
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
        const isLimit = /plan_project_limit_reached/i.test(error.message || '');
        toast({
          title: isLimit ? 'Limite de projetos atingido' : 'Erro ao criar projeto',
          description: isLimit
            ? (error.message.split(':').slice(1).join(':').trim() || 'Faça upgrade para criar mais projetos.')
            : error.message,
          variant: 'destructive',
        });
        setLoading(false);
        if (isLimit) setTimeout(() => navigate('/dashboard/credits'), 1500);
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
    } catch (err: unknown) {
      const parsed = await parseFnError(err, null);
      if (parsed.insufficient) {
        handleInsufficient(parsed.message);
      } else {
        toast({ title: 'Erro na extração', description: parsed.message, variant: 'destructive' });
      }
    }
    setLoading(false);
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    const validUrls = urls.filter(u => u.trim());
    if (!validUrls.length || !projectName.trim()) {
      toast({
        title: 'Preencha todos os campos',
        description: 'Informe um nome de projeto e ao menos uma URL do YouTube.',
        variant: 'destructive',
      });
      return;
    }

    // Validate URL format quickly to give better UX before hitting the API.
    const invalid = validUrls.filter(u => !extractYoutubeId(u));
    if (invalid.length) {
      toast({
        title: 'URL inválida',
        description: `Verifique: ${invalid[0]}. Use links completos do YouTube.`,
        variant: 'destructive',
      });
      return;
    }

    // Plan limit pre-check: number of projects
    if (usage && usage.projects_limit !== null && usage.projects_used >= usage.projects_limit) {
      toast({
        title: 'Limite de projetos atingido',
        description: `Seu plano (${usage.plan}) permite no máximo ${usage.projects_limit} projetos. Faça upgrade para criar mais.`,
        variant: 'destructive',
      });
      setTimeout(() => navigate('/dashboard/credits'), 1500);
      return;
    }

    // Credit pre-check (server-side authoritative): extract_video cost vs balance
    const aff = await checkAffordable('extract_video');
    if (!aff.affordable) {
      handleInsufficient(
        `Saldo atual: ${aff.balance} créditos. Esta ação requer ${aff.cost}.`,
      );
      return;
    }

    // Check for previous extractions of the same video IDs across the user's projects.
    try {
      const ids = validUrls.map(extractYoutubeId).filter(Boolean) as string[];
      const orFilter = ids.map(id => `video_urls.cs.{${id}}`).join(',');
      // Fallback: also try matching the raw URL in case the project saved the full URL.
      const rawOr = validUrls.map(u => `video_urls.cs.{${u}}`).join(',');
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('id, name, video_urls')
        .eq('user_id', user!.id)
        .or([orFilter, rawOr].filter(Boolean).join(','));

      const matched = (existingProjects || []).filter(p =>
        (p.video_urls || []).some((vu: string) => {
          const pid = extractYoutubeId(vu);
          return ids.some(id => id === pid) || validUrls.includes(vu);
        }),
      );

      if (matched.length > 0) {
        const dupUrls = validUrls.filter(u => {
          const id = extractYoutubeId(u);
          return matched.some(p =>
            (p.video_urls || []).some((vu: string) =>
              extractYoutubeId(vu) === id || vu === u,
            ),
          );
        });
        setDuplicateInfo({
          urls: dupUrls,
          projects: matched.map(p => ({ id: p.id, name: p.name })),
        });
        return;
      }
    } catch (err) {
      // Non-blocking: if the duplicate check fails we still proceed with extraction.
      console.warn('duplicate check failed', err);
    }

    await runExtraction(validUrls);
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
        const parsed = await parseFnError(error, data);
        if (parsed.insufficient) {
          handleInsufficient(parsed.message);
        } else {
          toast({ title: 'Erro ao gerar perfil', description: parsed.message, variant: 'destructive' });
        }
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
    } catch (err: unknown) {
      const parsed = await parseFnError(err, null);
      if (parsed.insufficient) {
        handleInsufficient(parsed.message);
      } else {
        toast({ title: 'Erro ao gerar perfil', description: parsed.message, variant: 'destructive' });
      }
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

        {usage && (
          <Card className={`glass p-4 flex flex-wrap items-center gap-3 text-sm ${
            usage.projects_limit !== null && usage.projects_used >= usage.projects_limit
              ? 'border-destructive/60'
              : ''
          }`}>
            <span className="text-muted-foreground">Plano <strong className="capitalize text-foreground">{usage.plan}</strong></span>
            <span className="text-muted-foreground">·</span>
            <span>
              Projetos: <strong>{usage.projects_used}</strong>
              {usage.projects_limit !== null ? ` / ${usage.projects_limit}` : ' (ilimitado)'}
            </span>
            <span className="text-muted-foreground">·</span>
            <span>Créditos: <strong>{usage.credits_balance}</strong></span>
            {usage.projects_limit !== null && usage.projects_used >= usage.projects_limit && (
              <span className="ml-auto text-destructive flex items-center gap-1">
                <AlertTriangle size={14} /> Limite atingido —{' '}
                <Link to="/dashboard/credits" className="underline font-medium hover:text-destructive/80">
                  faça upgrade
                </Link>
              </span>
            )}
          </Card>
        )}

        {!comments.length ? (
          loading ? (
            <Card className="glass p-6">
              <ExtractionAnimation />
            </Card>
          ) : (
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
              <Button
                type="submit"
                className="w-full glow-primary"
                disabled={
                  loading ||
                  (usage?.projects_limit !== null && (usage?.projects_used ?? 0) >= (usage?.projects_limit ?? Infinity)) ||
                  (usage !== null && usage.credits_balance <= 0)
                }
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extraindo via YouTube API...</> : 'Extrair Comentários'}
              </Button>
            </form>
          </Card>
          )
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
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{c.content?.replace(/<br\s*\/?>(\n)?/gi, '\n').replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')}</p>
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
              {aiLoading ? (
                <GenerationAnimation variant="avatar" />
              ) : !aiProfile ? (
                <div className="text-center">
                  <Sparkles className="mx-auto text-warning" size={32} />
                  <h3 className="font-heading text-lg font-bold mt-3">Gerar Perfil de Avatar com IA</h3>
                  <p className="text-sm text-muted-foreground mt-1">Análise inteligente real do perfil da sua audiência</p>
                  <Button onClick={handleGenerateAI} className="mt-4 glow-primary" disabled={aiLoading}>
                    <Sparkles className="mr-2 h-4 w-4" /> Gerar com IA
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

      <AlertDialog
        open={!!duplicateInfo}
        onOpenChange={(open) => { if (!open) setDuplicateInfo(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              URL já extraída anteriormente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  {duplicateInfo?.urls.length === 1
                    ? 'Este vídeo já foi extraído em um projeto seu:'
                    : `${duplicateInfo?.urls.length} dos vídeos enviados já foram extraídos em projetos seus:`}
                </p>
                {duplicateInfo && (
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground max-h-32 overflow-y-auto">
                    {duplicateInfo.projects.map(p => (
                      <li key={p.id}><strong className="text-foreground">{p.name}</strong></li>
                    ))}
                  </ul>
                )}
                <p>
                  Extrair novamente vai consumir créditos e gerar comentários
                  duplicados. Deseja prosseguir mesmo assim?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicateInfo(null)}>
              Não, voltar e mudar a URL
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const validUrls = urls.filter(u => u.trim());
                setDuplicateInfo(null);
                runExtraction(validUrls);
              }}
            >
              Sim, extrair novamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Extract;
