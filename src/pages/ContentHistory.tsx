import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CopyIconButton } from '@/components/CopyIconButton';
import { VideoEditor } from '@/components/VideoEditor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  History, Loader2, ArrowLeft, Instagram, Youtube, Facebook, Linkedin,
  Music2, Twitter, Pin, MessageCircle, Sparkles, FileText, TrendingUp,
  Copy, Check, Download, Wand2, ImageIcon, X, Clapperboard, Trash2,
  Calendar as CalendarIcon, Search, CheckSquare, Square,
} from 'lucide-react';
import { useLogoCustomization, applyLogoOverlay, LogoFormatKey } from '@/hooks/useLogoCustomization';

// Mapeia network + ratio para a chave de formato do logo (best-effort)
const pickLogoFormatKey = (network: string, ratio?: string): LogoFormatKey => {
  const n = network.toLowerCase();
  if (n === 'tiktok') return 'tiktok';
  if (n === 'youtube') return ratio === '16:9' ? 'youtube-thumb' : 'youtube-short';
  if (n === 'instagram') {
    if (ratio === '9:16') return 'instagram-reels';
    return 'instagram-feed';
  }
  return 'instagram-feed';
};

const NETWORKS = [
  { key: 'instagram', label: 'Instagram', icon: Instagram },
  { key: 'tiktok', label: 'TikTok', icon: Music2 },
  { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'facebook', label: 'Facebook', icon: Facebook },
  { key: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { key: 'x', label: 'X / Twitter', icon: Twitter },
  { key: 'pinterest', label: 'Pinterest', icon: Pin },
  { key: 'threads', label: 'Threads', icon: MessageCircle },
];

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

const getFormats = (net: string, type: string): ImgFormat[] =>
  FORMATS[`${net}:${type}`] || [{ ratio: '1:1', w: 1080, h: 1080, label: 'Quadrado' }];

const imageCreditCost = (w: number, h: number): number => {
  const mp = (w * h) / 1_000_000;
  if (mp <= 1.2) return 3;
  if (mp <= 1.6) return 4;
  return 5;
};

type HistoryItem = {
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
  created_at?: string;
};

export default function ContentHistory() {
  const { toast } = useToast();
  const { enabled: logoEnabled, data: logoData, getPosition: getLogoPos } = useLogoCustomization();
  const [loading, setLoading] = useState(true);
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [activeNetwork, setActiveNetwork] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<HistoryItem | null>(null);
  const [videoEditorPost, setVideoEditorPost] = useState<HistoryItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [genPanelOpen, setGenPanelOpen] = useState(false);
  const [genFormat, setGenFormat] = useState<ImgFormat | null>(null);
  const [genQuantity, setGenQuantity] = useState(1);
  const [genLoading, setGenLoading] = useState(false);
  const [genResults, setGenResults] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkDelete = async (ids: string[], label: string) => {
    if (ids.length === 0) return;
    if (!confirm(`Excluir ${ids.length} conteúdo(s) ${label}? Esta ação não pode ser desfeita.`)) return;
    setBulkDeleting(true);
    try {
      const { error } = await supabase.from('generated_contents').delete().in('id', ids);
      if (error) throw error;
      const idSet = new Set(ids);
      setAllHistory(prev => prev.filter(x => !idSet.has(x.id)));
      setSelected(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      if (activePost && idSet.has(activePost.id)) setActivePost(null);
      toast({ title: `${ids.length} conteúdo(s) excluído(s)` });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const deleteContent = async (h: HistoryItem) => {
    if (!confirm(`Excluir "${h.title || h.caption || 'este conteúdo'}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(h.id);
    try {
      const { error } = await supabase.from('generated_contents').delete().eq('id', h.id);
      if (error) throw error;
      setAllHistory(prev => prev.filter(x => x.id !== h.id));
      if (activePost?.id === h.id) setActivePost(null);
      toast({ title: 'Conteúdo excluído' });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('generated_contents')
          .select('id, title, caption, hashtags, cta, script, visual_idea, engagement_score, social_network, content_type, image_url, image_prompt, created_at')
          .order('created_at', { ascending: false })
          .limit(500);
        setAllHistory((data as HistoryItem[]) || []);
      } catch (e) {
        console.error('Error loading history:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = NETWORKS.map(n => ({
    ...n,
    count: allHistory.filter(h => h.social_network === n.key).length,
  }));

  const filtered = useMemo(() => {
    if (!activeNetwork) return [];
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : null;
    const toTs = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999).getTime() : null;
    return allHistory.filter(h => {
      if (h.social_network !== activeNetwork) return false;
      if (q) {
        const hay = `${h.title || ''} ${h.caption || ''} ${h.content_type || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fromTs || toTs) {
        const ts = h.created_at ? new Date(h.created_at).getTime() : 0;
        if (fromTs && ts < fromTs) return false;
        if (toTs && ts > toTs) return false;
      }
      return true;
    });
  }, [allHistory, activeNetwork, search, dateFrom, dateTo]);

  const filteredIds = useMemo(() => filtered.map(h => h.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const someFilteredSelected = filteredIds.some(id => selected.has(id));
  const selectedFilteredIds = filteredIds.filter(id => selected.has(id));

  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach(id => next.delete(id));
      } else {
        filteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };
  const activeNetMeta = NETWORKS.find(n => n.key === activeNetwork);

  const buildText = (c: HistoryItem) => [
    c.title && `🎯 ${c.title}`,
    c.caption,
    c.hashtags?.length ? c.hashtags.map(h => `#${h}`).join(' ') : '',
    c.cta && `👉 ${c.cta}`,
    c.script && `\n📜 Roteiro:\n${c.script}`,
    c.visual_idea && `\n🎨 Ideia visual:\n${c.visual_idea}`,
  ].filter(Boolean).join('\n\n');

  const copyContent = (c: HistoryItem) => {
    navigator.clipboard.writeText(buildText(c));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: 'Conteúdo copiado!' });
  };

  const downloadImage = async (url: string, filename: string) => {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      toast({ title: 'Erro ao baixar', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const openGenPanel = (c: HistoryItem) => {
    const fmts = getFormats(c.social_network, c.content_type);
    setGenFormat(fmts[0]);
    setGenQuantity(1);
    setGenResults([]);
    setGenPanelOpen(true);
  };

  const generateImagesForPost = async () => {
    if (!activePost || !genFormat) return;
    setGenLoading(true);
    const generated: string[] = [];
    try {
      for (let i = 0; i < genQuantity; i++) {
        const { data, error } = await supabase.functions.invoke('generate-content-image', {
          body: {
            content_id: activePost.id,
            image_format: genFormat.ratio,
            width: genFormat.w,
            height: genFormat.h,
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        const url = (data as any).image_url as string;
        generated.push(url);
        setGenResults([...generated]);
      }
      const latest = generated[generated.length - 1];
      setActivePost({ ...activePost, image_url: latest });
      setAllHistory(prev => prev.map(h => h.id === activePost.id ? { ...h, image_url: latest } : h));
      toast({ title: `${generated.length} imagem(ns) gerada(s)!` });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar imagem', description: e.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <History className="h-4 w-4 text-primary" />
            Histórico de conteúdos gerados
          </div>
          <h1 className="font-heading text-3xl font-bold flex items-center gap-2">
            {activePost ? 'Detalhe do conteúdo' : activeNetwork ? `Histórico — ${activeNetMeta?.label}` : 'Histórico de Conteúdos'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Reveja, copie e gere novas imagens a partir dos conteúdos que você já criou.
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : activePost ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => { setActivePost(null); setGenPanelOpen(false); setGenResults([]); }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>

            {activePost.image_url && (
              <div className="rounded-xl overflow-hidden border border-border bg-muted">
                <img src={activePost.image_url} alt="" className="w-full max-h-[400px] object-contain bg-black/40" />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {activePost.image_url && (
                <Button
                  onClick={() => downloadImage(activePost.image_url!, `${activePost.title || 'conteudo'}-${activePost.id.slice(0, 8)}.png`)}
                  disabled={downloading}
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Baixar imagem
                </Button>
              )}
              <Button variant="outline" onClick={() => copyContent(activePost)}>
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado!' : 'Copiar conteúdo'}
              </Button>
              {!activePost.image_url && !genPanelOpen && (
                <Button variant="default" onClick={() => openGenPanel(activePost)}>
                  <Wand2 className="h-4 w-4" /> Gerar imagem
                </Button>
              )}
              {activePost.script && activePost.script.trim() && (
                <Button
                  variant="outline"
                  className="border-primary/40 hover:bg-primary/10"
                  onClick={() => setVideoEditorPost(activePost)}
                >
                  <Clapperboard className="h-4 w-4 text-primary" /> Gerar vídeo
                </Button>
              )}
            </div>

            {genPanelOpen && activePost && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" /> Gerar imagem com IA
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => setGenPanelOpen(false)} disabled={genLoading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Formato da imagem</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {getFormats(activePost.social_network, activePost.content_type).map(f => {
                      const active = genFormat?.ratio === f.ratio;
                      const ratio = f.w / f.h;
                      const maxBox = 36;
                      const bw = ratio >= 1 ? maxBox : Math.round(maxBox * ratio);
                      const bh = ratio >= 1 ? Math.round(maxBox / ratio) : maxBox;
                      const cost = imageCreditCost(f.w, f.h);
                      return (
                        <button
                          key={f.ratio}
                          type="button"
                          disabled={genLoading}
                          onClick={() => setGenFormat(f)}
                          className={`relative p-2 rounded-lg border-2 transition-all text-left disabled:opacity-50 ${
                            active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 bg-card'
                          }`}
                        >
                          <span className="absolute top-1 right-1 text-[9px] font-bold px-1 py-0.5 rounded bg-primary/15 text-primary">
                            {cost}c
                          </span>
                          <div className="flex items-center gap-2">
                            <div
                              className={`shrink-0 rounded border-2 ${active ? 'border-primary bg-primary/20' : 'border-muted-foreground/40 bg-muted'}`}
                              style={{ width: bw, height: bh }}
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold">{f.ratio}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{f.w}×{f.h}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Quantidade (1-4)</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(n => (
                      <button
                        key={n}
                        type="button"
                        disabled={genLoading}
                        onClick={() => setGenQuantity(n)}
                        className={`flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all disabled:opacity-50 ${
                          genQuantity === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-primary/20">
                  <span className="text-sm">Total estimado</span>
                  <span className="font-heading text-xl font-bold gradient-text">
                    {genFormat ? imageCreditCost(genFormat.w, genFormat.h) * genQuantity : 0}c
                  </span>
                </div>

                <Button onClick={generateImagesForPost} disabled={genLoading || !genFormat} className="w-full">
                  {genLoading ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando {genResults.length}/{genQuantity}...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-1" /> Gerar {genQuantity} imagem{genQuantity > 1 ? 'ns' : ''}</>
                  )}
                </Button>

                {genResults.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Imagens geradas:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {genResults.map((url, idx) => (
                        <div key={idx} className="rounded-lg overflow-hidden border border-border bg-muted relative group">
                          <img src={url} alt={`Geração ${idx + 1}`} className="w-full h-auto object-cover" />
                          <button
                            onClick={() => downloadImage(url, `${activePost.title || 'conteudo'}-${idx + 1}.png`)}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/90 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Baixar"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {genQuantity > 1 && (
                      <p className="text-[11px] text-muted-foreground">
                        A última imagem é salva no histórico. Baixe as outras antes de fechar.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-border bg-card p-5">
              {activePost.title && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Título</p>
                    <CopyIconButton value={activePost.title} label="Título" />
                  </div>
                  <h3 className="font-heading text-lg font-semibold">{activePost.title}</h3>
                </div>
              )}
              {activePost.caption && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Legenda</p>
                    <CopyIconButton value={activePost.caption} label="Conteúdo" />
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{activePost.caption}</p>
                </div>
              )}
              {activePost.hashtags && activePost.hashtags.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Hashtags</p>
                    <CopyIconButton value={activePost.hashtags.map(h => `#${h}`).join(' ')} label="Hashtags" />
                  </div>
                  <p className="text-sm text-primary">{activePost.hashtags.map(h => `#${h}`).join(' ')}</p>
                </div>
              )}
              {activePost.cta && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">CTA</p>
                    <CopyIconButton value={activePost.cta} label="CTA" />
                  </div>
                  <p className="text-sm">👉 {activePost.cta}</p>
                </div>
              )}
              {activePost.script && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Roteiro</p>
                    <CopyIconButton value={activePost.script} label="Roteiro" />
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{activePost.script}</p>
                </div>
              )}
              {activePost.visual_idea && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Ideia visual</p>
                    <CopyIconButton value={activePost.visual_idea} label="Ideia visual" />
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{activePost.visual_idea}</p>
                </div>
              )}
            </div>
          </div>
        ) : activeNetwork ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setActiveNetwork(null); setSelected(new Set()); setSearch(''); setDateFrom(undefined); setDateTo(undefined); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Todas as redes
              </Button>
              <p className="text-xs text-muted-foreground">
                {filtered.length} de {allHistory.filter(h => h.social_network === activeNetwork).length} conteúdo(s)
              </p>
            </div>

            {/* Filtros */}
            <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, legenda, tipo…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-9 gap-1.5', !dateFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-9 gap-1.5', !dateTo && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>

              {(search || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(''); setDateFrom(undefined); setDateTo(undefined); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Limpar
                </Button>
              )}
            </div>

            {/* Barra de seleção em massa */}
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                >
                  {allFilteredSelected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                  {allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  {someFilteredSelected && (
                    <span className="text-xs text-muted-foreground">
                      ({selectedFilteredIds.length} selecionado{selectedFilteredIds.length > 1 ? 's' : ''})
                    </span>
                  )}
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {someFilteredSelected && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => bulkDelete(selectedFilteredIds, 'selecionado(s)')}
                      disabled={bulkDeleting}
                    >
                      {bulkDeleting
                        ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                      Excluir selecionados ({selectedFilteredIds.length})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => bulkDelete(filteredIds, 'filtrado(s)')}
                    disabled={bulkDeleting}
                  >
                    {bulkDeleting
                      ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                    Excluir todos filtrados ({filteredIds.length})
                  </Button>
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Nenhum conteúdo encontrado com os filtros aplicados.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(h => (
                  <div
                    key={h.id}
                    className={cn(
                      'relative text-left group rounded-xl border bg-card p-3 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all',
                      selected.has(h.id) ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-2 left-2 z-10 rounded-md bg-background/90 border border-border p-1 transition-opacity',
                        selected.has(h.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selected.has(h.id)}
                        onCheckedChange={() => toggleSelected(h.id)}
                        aria-label="Selecionar conteúdo"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteContent(h); }}
                      disabled={deletingId === h.id}
                      title="Excluir conteúdo"
                      aria-label="Excluir conteúdo"
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-background/90 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground border border-border opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    >
                      {deletingId === h.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePost(h)}
                      className="text-left w-full"
                    >
                      {h.image_url ? (
                        <div className="mb-2 rounded-lg overflow-hidden border border-border aspect-video bg-muted">
                          <img src={h.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ) : (
                        <div className="mb-2 rounded-lg border border-dashed border-border aspect-video bg-muted/30 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {h.content_type}
                        </span>
                        {h.engagement_score != null && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                            <TrendingUp className="h-3 w-3" />{h.engagement_score}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold line-clamp-2 leading-snug">
                        {h.title || h.caption || 'Sem título'}
                      </p>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {allHistory.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhum conteúdo gerado ainda.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">Selecione uma rede social para ver os conteúdos:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {counts.map(n => {
                    const Icon = n.icon;
                    const disabled = n.count === 0;
                    return (
                      <button
                        key={n.key}
                        disabled={disabled}
                        onClick={() => { setActiveNetwork(n.key); setSelected(new Set()); setSearch(''); setDateFrom(undefined); setDateTo(undefined); }}
                        className={`group relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border transition-all ${
                          disabled
                            ? 'border-border/50 bg-muted/20 opacity-40 cursor-not-allowed'
                            : 'border-border bg-card hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5'
                        }`}
                      >
                        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors ${disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary group-hover:bg-primary group-hover:text-primary-foreground'}`}>
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="text-sm font-medium">{n.label}</span>
                        {n.count > 0 && (
                          <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[1.25rem] text-center">
                            {n.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {videoEditorPost && (
        <VideoEditor
          open={!!videoEditorPost}
          onClose={() => setVideoEditorPost(null)}
          content={videoEditorPost as any}
          onImageRegen={async (_idx, prompt, editorFormat) => {
            try {
              const fallback = getFormats(videoEditorPost.social_network, videoEditorPost.content_type)[0];
              const fmt = editorFormat || { ratio: fallback.ratio, w: fallback.w, h: fallback.h };
              const { data, error } = await supabase.functions.invoke('generate-content-image', {
                body: {
                  content_id: videoEditorPost.id,
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
}
