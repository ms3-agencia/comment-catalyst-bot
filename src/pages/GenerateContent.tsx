import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCredits } from '@/hooks/useCredits';
import {
  Sparkles, Loader2, ArrowLeft, FolderOpen, Instagram, Youtube, Facebook, Linkedin,
  Music2, MessageCircle, Image as ImageIcon, Video, Film, Layers, FileText, Pin,
  Twitter, Hash, Copy, Check, TrendingUp, Wand2, Download, RefreshCw, History, ChevronDown,
} from 'lucide-react';

type Project = {
  id: string;
  name: string;
  ai_profile: string | null;
  total_comments: number | null;
};

type GeneratedContent = {
  id: string;
  title: string | null;
  caption: string | null;
  hashtags: string[] | null;
  cta: string | null;
  script: string | null;
  visual_idea: string | null;
  engagement_score: number | null;
  social_network: string;
  content_type: string;
  image_url?: string | null;
  image_prompt?: string | null;
};

const NETWORKS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram, types: ['post', 'reels', 'carrossel', 'story'] },
  { key: 'tiktok', label: 'TikTok', icon: Music2, types: ['video'] },
  { key: 'youtube', label: 'YouTube', icon: Youtube, types: ['video', 'shorts'] },
  { key: 'facebook', label: 'Facebook', icon: Facebook, types: ['post', 'video', 'reels'] },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, types: ['post', 'carrossel', 'video'] },
  { key: 'x', label: 'X / Twitter', icon: Twitter, types: ['post', 'thread'] },
  { key: 'pinterest', label: 'Pinterest', icon: Pin, types: ['pin', 'idea_pin'] },
  { key: 'threads', label: 'Threads', icon: MessageCircle, types: ['post', 'thread'] },
];

const TYPE_META: Record<string, { label: string; icon: any }> = {
  post: { label: 'Post', icon: ImageIcon },
  reels: { label: 'Reels', icon: Film },
  video: { label: 'Vídeo', icon: Video },
  shorts: { label: 'Shorts', icon: Film },
  carrossel: { label: 'Carrossel', icon: Layers },
  story: { label: 'Story', icon: ImageIcon },
  thread: { label: 'Thread', icon: FileText },
  pin: { label: 'Pin', icon: Pin },
  idea_pin: { label: 'Idea Pin', icon: Pin },
};

type Step = 'project' | 'network' | 'type' | 'quantity' | 'results';

const GenerateContent = () => {
  const { toast } = useToast();
  const { refresh: refreshCredits } = useCredits();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [step, setStep] = useState<Step>('project');
  const [project, setProject] = useState<Project | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(3);
  const [results, setResults] = useState<GeneratedContent[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedContent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyNetwork, setHistoryNetwork] = useState<string | null>(null);
  const [imagingId, setImagingId] = useState<string | null>(null);

  const loadHistory = async (projectId: string) => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('generated_contents')
      .select('id, title, caption, hashtags, cta, script, visual_idea, engagement_score, social_network, content_type, image_url, image_prompt')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(200);
    setHistory((data as GeneratedContent[]) || []);
    setHistoryLoading(false);
  };

  const generateImage = async (content: GeneratedContent) => {
    setImagingId(content.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content-image', {
        body: { content_id: content.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const updated = { image_url: (data as any).image_url, image_prompt: (data as any).image_prompt };
      setResults(prev => prev.map(r => r.id === content.id ? { ...r, ...updated } : r));
      setHistory(prev => prev.map(r => r.id === content.id ? { ...r, ...updated } : r));
      refreshCredits();
      toast({ title: 'Imagem gerada!', description: 'Imagem criada com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar imagem', description: e.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setImagingId(null);
    }
  };

  const selectProject = (p: Project) => {
    setProject(p);
    setStep('network');
    loadHistory(p.id);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, ai_profile, total_comments')
        .order('created_at', { ascending: false });
      setProjects((data as Project[]) || []);
      setLoading(false);
    })();
  }, []);

  const networkMeta = useMemo(() => NETWORKS.find(n => n.key === network), [network]);

  const reset = () => {
    setStep('project'); setProject(null); setNetwork(null);
    setContentType(null); setQuantity(3); setResults([]);
    setHistoryOpen(false); setHistoryNetwork(null);
  };

  const handleGenerate = async () => {
    if (!project || !network || !contentType) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: {
          project_id: project.id,
          social_network: network,
          content_type: contentType,
          quantity,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResults((data as any).contents || []);
      setStep('results');
      refreshCredits();
      if (project) loadHistory(project.id);
      toast({ title: 'Conteúdos gerados!', description: `${(data as any).contents?.length || 0} conteúdo(s) criado(s).` });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar', description: e.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const copyContent = (c: GeneratedContent) => {
    const text = [
      c.title && `🎯 ${c.title}`,
      c.caption,
      c.hashtags?.length ? c.hashtags.map(h => `#${h}`).join(' ') : '',
      c.cta && `👉 ${c.cta}`,
    ].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Gerador de conteúdo com IA
          </div>
          <h1 className="font-heading text-3xl font-bold">Gerar Conteúdo</h1>
          <p className="text-muted-foreground mt-1">
            Conteúdos personalizados baseados no perfil real do seu público.
          </p>
        </div>

        {/* Stepper breadcrumbs */}
        {step !== 'project' && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={reset}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Recomeçar
            </Button>
            {project && <span className="px-2 py-1 rounded bg-secondary">{project.name}</span>}
            {network && <span className="px-2 py-1 rounded bg-secondary">{networkMeta?.label}</span>}
            {contentType && <span className="px-2 py-1 rounded bg-secondary">{TYPE_META[contentType]?.label || contentType}</span>}
          </div>
        )}

        {/* History bar for selected project */}
        {project && step !== 'project' && (
          <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 glow-primary">
            <div className="absolute inset-0 opacity-30 pointer-events-none"
                 style={{ backgroundImage: 'radial-gradient(circle at 20% 0%, hsl(var(--primary)/0.25), transparent 50%)' }} />
            <div className="relative flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-heading font-semibold flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  Histórico de "{project.name}"
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 ml-9">
                  Conteúdos gerados anteriormente · clique para copiar
                </p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-primary/15 text-primary font-semibold border border-primary/30">
                {history.length} {history.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            {historyLoading ? (
              <div className="relative flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
              </div>
            ) : history.length === 0 ? (
              <div className="relative text-center py-6 border border-dashed border-border rounded-lg">
                <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum conteúdo gerado ainda.</p>
                <p className="text-xs text-muted-foreground/70">Gere o primeiro abaixo 👇</p>
              </div>
            ) : (
              <div className="relative flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x scroll-smooth">
                {history.map(h => {
                  const netMeta = NETWORKS.find(n => n.key === h.social_network);
                  const NetIcon = netMeta?.icon || Sparkles;
                  const typeMeta = TYPE_META[h.content_type] || { label: h.content_type, icon: FileText };
                  return (
                    <div
                      key={h.id}
                      className="snap-start shrink-0 w-64 group relative rounded-xl border border-border bg-card/80 backdrop-blur p-4 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all cursor-pointer"
                      onClick={() => copyContent(h)}
                      title="Clique para copiar"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                            <NetIcon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-[11px] font-medium capitalize">{netMeta?.label || h.social_network}</span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {typeMeta.label}
                        </span>
                      </div>
                      {h.image_url && (
                        <div className="mb-2 -mx-1 rounded-lg overflow-hidden border border-border aspect-video bg-muted">
                          <img src={h.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      )}
                      <p className="text-sm font-semibold line-clamp-2 leading-snug min-h-[2.5rem]">
                        {h.title || h.caption || 'Sem título'}
                      </p>
                      {h.caption && h.title && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{h.caption}</p>
                      )}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        {h.engagement_score != null ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                            <TrendingUp className="h-3 w-3" />{h.engagement_score}%
                          </span>
                        ) : <span />}
                        {copiedId === h.id ? (
                          <span className="flex items-center gap-1 text-xs text-primary font-medium">
                            <Check className="h-3 w-3" /> Copiado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                            <Copy className="h-3 w-3" /> Copiar
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* STEP: Project */}
        {step === 'project' && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-semibold">1. Selecione um projeto</h2>
            {projects.length === 0 ? (
              <Card className="p-8 text-center">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold mb-2">Você ainda não tem projetos</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Para gerar conteúdo, primeiro crie um projeto extraindo comentários de vídeos.
                </p>
                <Button asChild>
                  <Link to="/dashboard/extract">Criar primeiro projeto</Link>
                </Button>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProject(p)}
                    className="text-left"
                  >
                    <Card className="p-5 hover:border-primary transition-colors h-full">
                      <FolderOpen className="h-6 w-6 text-primary mb-3" />
                      <h3 className="font-semibold mb-1 line-clamp-1">{p.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {p.total_comments || 0} comentários
                      </p>
                      {!p.ai_profile && (
                        <p className="text-xs text-warning mt-2">⚠ Sem perfil de avatar gerado</p>
                      )}
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP: Network */}
        {step === 'network' && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-semibold">2. Para qual rede social?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {NETWORKS.map(n => {
                const Icon = n.icon;
                return (
                  <button key={n.key} onClick={() => { setNetwork(n.key); setStep('type'); }}>
                    <Card className="p-5 hover:border-primary transition-colors text-center">
                      <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h3 className="font-semibold">{n.label}</h3>
                    </Card>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: Type */}
        {step === 'type' && networkMeta && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-semibold">3. Tipo de conteúdo</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {networkMeta.types.map(t => {
                const meta = TYPE_META[t] || { label: t, icon: FileText };
                const Icon = meta.icon;
                return (
                  <button key={t} onClick={() => { setContentType(t); setStep('quantity'); }}>
                    <Card className="p-5 hover:border-primary transition-colors text-center">
                      <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <h3 className="font-semibold">{meta.label}</h3>
                    </Card>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: Quantity */}
        {step === 'quantity' && (
          <div className="space-y-4 max-w-md">
            <h2 className="font-heading text-xl font-semibold">4. Quantos conteúdos?</h2>
            <Card className="p-6 space-y-4">
              <div>
                <Label>Quantidade (1-10)</Label>
                <Input
                  type="number" min={1} max={10} value={quantity}
                  onChange={e => setQuantity(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Custo: <span className="font-semibold text-foreground">{quantity * 2} créditos</span> (2 por conteúdo)
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Gerar agora</>
                )}
              </Button>
            </Card>
          </div>
        )}

        {/* STEP: Results */}
        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-heading text-xl font-semibold">Conteúdos gerados</h2>
              <Button variant="outline" onClick={reset}>Gerar mais</Button>
            </div>
            {results.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nenhum conteúdo retornado.</Card>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {results.map(c => (
                  <Card key={c.id} className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold flex-1">{c.title}</h3>
                      {c.engagement_score != null && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/15 text-primary shrink-0">
                          <TrendingUp className="h-3 w-3" /> {c.engagement_score}
                        </span>
                      )}
                    </div>
                    {c.caption && (
                      <p className="text-sm whitespace-pre-wrap text-foreground/90">{c.caption}</p>
                    )}
                    {c.hashtags && c.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {c.hashtags.map((h, i) => (
                          <span key={i} className="text-xs text-primary inline-flex items-center">
                            <Hash className="h-3 w-3" />{h}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.cta && (
                      <div className="text-sm border-l-2 border-primary pl-3">
                        <span className="text-xs uppercase text-muted-foreground">CTA</span>
                        <p>{c.cta}</p>
                      </div>
                    )}
                    {c.script && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Ver roteiro</summary>
                        <p className="whitespace-pre-wrap mt-2 text-foreground/90">{c.script}</p>
                      </details>
                    )}
                    {c.visual_idea && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Ideia visual</summary>
                        <p className="mt-2 text-foreground/90">{c.visual_idea}</p>
                      </details>
                    )}
                    {/* AI Image */}
                    <div className="border-t border-border pt-3 space-y-2">
                      {c.image_url ? (
                        <div className="space-y-2">
                          <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
                            <img
                              src={c.image_url}
                              alt={c.title || 'Imagem gerada'}
                              className="w-full h-auto object-cover"
                              loading="lazy"
                            />
                          </div>
                          {c.image_prompt && (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground flex items-center gap-1">
                                <Wand2 className="h-3 w-3" /> Prompt da imagem
                              </summary>
                              <p className="mt-1 p-2 rounded bg-muted/50 text-foreground/80 whitespace-pre-wrap">{c.image_prompt}</p>
                            </details>
                          )}
                          <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm" className="flex-1">
                              <a href={c.image_url} target="_blank" rel="noopener noreferrer" download>
                                <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                              </a>
                            </Button>
                            <Button
                              variant="outline" size="sm" className="flex-1"
                              onClick={() => generateImage(c)}
                              disabled={imagingId === c.id}
                            >
                              {imagingId === c.id ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Gerando...</>
                              ) : (
                                <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer</>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="default" size="sm" className="w-full bg-gradient-to-r from-primary to-accent"
                          onClick={() => generateImage(c)}
                          disabled={imagingId === c.id}
                        >
                          {imagingId === c.id ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando imagem...</>
                          ) : (
                            <><Wand2 className="h-4 w-4 mr-2" /> Gerar imagem com IA (3 créditos)</>
                          )}
                        </Button>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyContent(c)} className="w-full">
                      {copiedId === c.id ? <><Check className="h-4 w-4 mr-1" /> Copiado</> : <><Copy className="h-4 w-4 mr-1" /> Copiar</>}
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GenerateContent;
