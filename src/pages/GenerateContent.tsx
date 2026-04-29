import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CopyIconButton } from '@/components/CopyIconButton';
import { VideoEditor } from '@/components/VideoEditor';
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
  Twitter, Hash, Copy, Check, TrendingUp, Wand2, Download, RefreshCw, History, ChevronDown, Pencil, Send, X, Clapperboard,
} from 'lucide-react';

type Project = {
  id: string;
  name: string;
  ai_profile: string | null;
  total_comments: number | null;
};

type Slide = {
  index: number;
  text: string;
  visual?: string | null;
  image_url?: string | null;
  image_prompt?: string | null;
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
  slides?: Slide[] | null;
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

// Image formats per network+type. First option = recommended/default.
type ImgFormat = { ratio: string; w: number; h: number; label: string };
const FORMATS: Record<string, ImgFormat[]> = {
  'instagram:post': [
    { ratio: '4:5', w: 1080, h: 1350, label: 'Vertical (recomendado)' },
    { ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' },
  ],
  'instagram:carrossel': [
    { ratio: '4:5', w: 1080, h: 1350, label: 'Vertical (recomendado)' },
    { ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' },
  ],
  'instagram:reels': [{ ratio: '9:16', w: 1080, h: 1920, label: 'Vertical' }],
  'instagram:story': [{ ratio: '9:16', w: 1080, h: 1920, label: 'Vertical' }],
  'tiktok:video': [{ ratio: '9:16', w: 1080, h: 1920, label: 'Vertical' }],
  'youtube:video': [{ ratio: '16:9', w: 1920, h: 1080, label: 'Horizontal HD' }],
  'youtube:shorts': [{ ratio: '9:16', w: 1080, h: 1920, label: 'Vertical' }],
  'facebook:post': [
    { ratio: '1.91:1', w: 1200, h: 630, label: 'Link/Imagem' },
    { ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' },
  ],
  'facebook:video': [
    { ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' },
    { ratio: '16:9', w: 1920, h: 1080, label: 'Horizontal' },
  ],
  'facebook:reels': [{ ratio: '9:16', w: 1080, h: 1920, label: 'Vertical' }],
  'linkedin:post': [
    { ratio: '1.91:1', w: 1200, h: 627, label: 'Horizontal' },
    { ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' },
  ],
  'linkedin:carrossel': [{ ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' }],
  'linkedin:video': [
    { ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' },
    { ratio: '16:9', w: 1920, h: 1080, label: 'Horizontal' },
  ],
  'x:post': [{ ratio: '16:9', w: 1600, h: 900, label: 'Horizontal' }],
  'x:thread': [{ ratio: '16:9', w: 1600, h: 900, label: 'Horizontal' }],
  'pinterest:pin': [{ ratio: '2:3', w: 1000, h: 1500, label: 'Vertical' }],
  'pinterest:idea_pin': [{ ratio: '9:16', w: 1080, h: 1920, label: 'Vertical' }],
  'threads:post': [{ ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' }],
  'threads:thread': [{ ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' }],
};

const getFormats = (net: string | null, type: string | null): ImgFormat[] => {
  if (!net || !type) return [{ ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' }];
  return FORMATS[`${net}:${type}`] || [{ ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' }];
};

// Custo por imagem baseado em megapixels totais.
// Mantenha sincronizado com supabase/functions/generate-content-image/index.ts
export const imageCreditCost = (w: number, h: number): number => {
  const mp = (w * h) / 1_000_000;
  if (mp <= 1.2) return 3;       // ex: 1080x1080, 1200x630
  if (mp <= 1.6) return 4;       // ex: 1080x1350, 1000x1500
  return 5;                       // HD: 1080x1920, 1920x1080, 1600x900+
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
  const [selectedFormat, setSelectedFormat] = useState<ImgFormat | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [videoEditorContent, setVideoEditorContent] = useState<GeneratedContent | null>(null);

  const EDIT_SUGGESTIONS = [
    'Arrumar a escrita',
    'Tirar o texto',
    'Cores mais vibrantes',
    'Estilo mais minimalista',
    'Adicionar fundo desfocado',
    'Tom mais profissional',
  ];

  const editImage = async (content: GeneratedContent, prompt: string) => {
    if (!prompt.trim()) return;
    setEditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('edit-content-image', {
        body: { content_id: content.id, edit_prompt: prompt.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const updated = { image_url: (data as any).image_url, image_prompt: (data as any).image_prompt };
      setResults(prev => prev.map(r => r.id === content.id ? { ...r, ...updated } : r));
      setHistory(prev => prev.map(r => r.id === content.id ? { ...r, ...updated } : r));
      refreshCredits();
      setEditPrompt('');
      toast({ title: 'Imagem editada!', description: 'Modificação aplicada com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro ao editar', description: e.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  };

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

  const generateImage = async (content: GeneratedContent, format?: ImgFormat) => {
    setImagingId(content.id);
    try {
      const fmt = format || selectedFormat || getFormats(content.social_network, content.content_type)[0];
      const { data, error } = await supabase.functions.invoke('generate-content-image', {
        body: {
          content_id: content.id,
          image_format: fmt.ratio,
          width: fmt.w,
          height: fmt.h,
        },
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
    setHistoryOpen(false); setHistoryNetwork(null); setSelectedFormat(null);
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
                  <button key={t} onClick={() => {
                    setContentType(t);
                    setSelectedFormat(getFormats(network, t)[0]);
                    setStep('quantity');
                  }}>
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
          <div className="space-y-4 max-w-2xl">
            <h2 className="font-heading text-xl font-semibold">4. Formato e quantidade</h2>
            <Card className="p-6 space-y-5">
              {/* Format picker */}
              <div className="space-y-2">
                <Label>Formato da imagem</Label>
                <p className="text-xs text-muted-foreground">
                  Tamanho otimizado para {networkMeta?.label} {contentType ? `(${TYPE_META[contentType]?.label || contentType})` : ''}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  {getFormats(network, contentType).map(f => {
                    const active = selectedFormat?.ratio === f.ratio;
                    const maxBox = 56;
                    const ratio = f.w / f.h;
                    const bw = ratio >= 1 ? maxBox : Math.round(maxBox * ratio);
                    const bh = ratio >= 1 ? Math.round(maxBox / ratio) : maxBox;
                    const cost = imageCreditCost(f.w, f.h);
                    return (
                      <button
                        key={f.ratio}
                        type="button"
                        onClick={() => setSelectedFormat(f)}
                        className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                          active
                            ? 'border-primary bg-primary/10 shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]'
                            : 'border-border hover:border-primary/50 bg-card'
                        }`}
                      >
                        <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                          {cost}c
                        </span>
                        <div className="flex items-center gap-3">
                          <div
                            className={`shrink-0 rounded border-2 ${active ? 'border-primary bg-primary/20' : 'border-muted-foreground/40 bg-muted'}`}
                            style={{ width: bw, height: bh }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{f.ratio}</div>
                            <div className="text-[11px] text-muted-foreground">{f.w}×{f.h}</div>
                            <div className="text-[10px] text-muted-foreground line-clamp-1">{f.label}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  Custo por imagem: <strong>3c</strong> até 1.2MP · <strong>4c</strong> até 1.6MP · <strong>5c</strong> em HD (1080p+)
                </p>
              </div>

              <div>
                <Label>Quantidade (1-10)</Label>
                <Input
                  type="number" min={1} max={10} value={quantity}
                  onChange={e => setQuantity(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                />
              </div>

              {/* Resumo de custo em tempo real */}
              {(() => {
                const textCost = quantity * 2;
                const imgUnit = selectedFormat ? imageCreditCost(selectedFormat.w, selectedFormat.h) : 0;
                const imgTotal = imgUnit * quantity;
                const total = textCost + imgTotal;
                return (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Texto ({quantity} × 2c)</span>
                      <span className="font-semibold">{textCost}c</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Imagens {selectedFormat ? `(${quantity} × ${imgUnit}c · ${selectedFormat.ratio})` : '(selecione um formato)'}
                      </span>
                      <span className="font-semibold">{selectedFormat ? `${imgTotal}c` : '—'}</span>
                    </div>
                    <div className="border-t border-primary/20 pt-2 flex justify-between items-baseline">
                      <span className="text-sm font-semibold">Total estimado</span>
                      <span className="font-heading text-2xl font-bold gradient-text">{total}c</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Texto é cobrado ao gerar. Imagens só cobram quando você clica em gerar imagem em cada conteúdo.
                    </p>
                  </div>
                );
              })()}
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <h3 className="font-semibold flex-1">{c.title}</h3>
                        {c.title && <CopyIconButton value={c.title} label="Título" />}
                      </div>
                      {c.engagement_score != null && (
                        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/15 text-primary shrink-0">
                          <TrendingUp className="h-3 w-3" /> {c.engagement_score}
                        </span>
                      )}
                    </div>
                    {c.caption && (
                      <div className="flex items-start gap-1.5">
                        <p className="text-sm whitespace-pre-wrap text-foreground/90 flex-1">{c.caption}</p>
                        <CopyIconButton value={c.caption} label="Conteúdo" />
                      </div>
                    )}
                    {c.hashtags && c.hashtags.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <div className="flex flex-wrap gap-1 flex-1">
                          {c.hashtags.map((h, i) => (
                            <span key={i} className="text-xs text-primary inline-flex items-center">
                              <Hash className="h-3 w-3" />{h}
                            </span>
                          ))}
                        </div>
                        <CopyIconButton value={c.hashtags.map(h => `#${h}`).join(' ')} label="Hashtags" />
                      </div>
                    )}
                    {c.cta && (
                      <div className="flex items-start gap-1.5">
                        <div className="text-sm border-l-2 border-primary pl-3 flex-1">
                          <span className="text-xs uppercase text-muted-foreground">CTA</span>
                          <p>{c.cta}</p>
                        </div>
                        <CopyIconButton value={c.cta} label="CTA" />
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
                              variant={editingId === c.id ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1"
                              onClick={() => {
                                setEditingId(editingId === c.id ? null : c.id);
                                setEditPrompt('');
                              }}
                              disabled={imagingId === c.id || editLoading}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                            </Button>
                            <Button
                              variant="outline" size="sm" className="flex-1"
                              onClick={() => generateImage(c)}
                              disabled={imagingId === c.id || editLoading}
                            >
                              {imagingId === c.id ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Gerando...</>
                              ) : (
                                <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer</>
                              )}
                            </Button>
                          </div>

                          {/* Mini chat de edição */}
                          {editingId === c.id && (
                            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 animate-fade-in">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold flex items-center gap-1.5">
                                  <Wand2 className="h-3.5 w-3.5 text-primary" /> Como deseja modificar?
                                </p>
                                <button
                                  type="button"
                                  onClick={() => { setEditingId(null); setEditPrompt(''); }}
                                  className="text-muted-foreground hover:text-foreground"
                                  disabled={editLoading}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {EDIT_SUGGESTIONS.map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setEditPrompt(s)}
                                    disabled={editLoading}
                                    className="text-[11px] px-2 py-1 rounded-full border border-border bg-card hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  value={editPrompt}
                                  onChange={(e) => setEditPrompt(e.target.value)}
                                  placeholder="Ex: tirar o texto, mudar cor para azul..."
                                  className="h-9 text-sm"
                                  disabled={editLoading}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !editLoading && editPrompt.trim()) {
                                      e.preventDefault();
                                      editImage(c, editPrompt);
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  onClick={() => editImage(c, editPrompt)}
                                  disabled={editLoading || !editPrompt.trim()}
                                >
                                  {editLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                Cada edição consome créditos como uma nova geração.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => generateImage(c)}
                          disabled={imagingId === c.id}
                        >
                          {imagingId === c.id ? (
                            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Gerando imagem...</>
                          ) : (
                            <><Wand2 className="h-3.5 w-3.5 mr-1" /> Gerar imagem</>
                          )}
                        </Button>
                      )}
                    </div>
                    {/* Botão de vídeo (apenas se houver roteiro) */}
                    {c.script && c.script.trim() && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-primary/40 hover:bg-primary/10"
                        onClick={() => setVideoEditorContent(c)}
                      >
                        <Clapperboard className="h-4 w-4 mr-1 text-primary" /> Gerar vídeo (até 60s)
                      </Button>
                    )}
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
      {videoEditorContent && (
        <VideoEditor
          open={!!videoEditorContent}
          onClose={() => setVideoEditorContent(null)}
          content={videoEditorContent as any}
          onImageRegen={async (_idx, prompt) => {
            try {
              const fmt = getFormats(videoEditorContent.social_network, videoEditorContent.content_type)[0];
              const { data, error } = await supabase.functions.invoke('generate-content-image', {
                body: {
                  content_id: videoEditorContent.id,
                  image_format: fmt.ratio,
                  width: fmt.w,
                  height: fmt.h,
                  custom_prompt: prompt,
                  skip_persist: true,
                },
              });
              if (error) throw error;
              if ((data as any)?.error) throw new Error((data as any).error);
              return (data as any).image_url || null;
            } catch (e: any) {
              toast({ title: 'Erro ao gerar imagem', description: e.message, variant: 'destructive' });
              return null;
            }
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default GenerateContent;
