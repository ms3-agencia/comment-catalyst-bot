import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Youtube, Shield, LogOut, Menu, X, ChevronDown, FolderOpen, Coins, UserCircle, Sparkles, History, Instagram, Music2, Facebook, Linkedin, Twitter, Pin, MessageCircle, ArrowLeft, Copy, Check, Download, Loader2, TrendingUp, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditsWidget } from '@/components/CreditsWidget';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/extract', icon: Youtube, label: 'Extrair Comentários' },
  { to: '/dashboard/projects', icon: FolderOpen, label: 'Meus Projetos' },
  { to: '/dashboard/generate', icon: Sparkles, label: 'Gerar Conteúdo' },
  { to: '/dashboard/credits', icon: Coins, label: 'Créditos & Planos' },
];

const adminItems = [
  { to: '/admin', icon: Shield, label: 'Painel Admin' },
];

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

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { profile, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [activeNetwork, setActiveNetwork] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<HistoryItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const allItems = [...navItems, ...(isAdmin ? adminItems : [])];

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    pro: 'bg-primary/20 text-primary',
    enterprise: 'bg-warning/20 text-warning',
  };

  const openHistory = async () => {
    setHistoryDialogOpen(true);
    setActiveNetwork(null);
    setActivePost(null);
    setHistoryLoading(true);
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
      setHistoryLoading(false);
    }
  };

  const counts = NETWORKS.map(n => ({
    ...n,
    count: allHistory.filter(h => h.social_network === n.key).length,
  }));

  const filtered = activeNetwork ? allHistory.filter(h => h.social_network === activeNetwork) : [];
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

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-6 border-b border-border">
            <Link to="/dashboard" className="font-heading text-xl font-bold gradient-text">YCaptura</Link>
            <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
          </div>
          <div className="px-4 pt-4">
            <CreditsWidget />
          </div>
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {allItems.map(item => (
              <div key={item.to}>
                <Link to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${location.pathname === item.to ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <item.icon size={18} />
                  {item.label}
                </Link>
                {/* History button right below "Gerar Conteúdo" */}
                {item.to === '/dashboard/generate' && (
                  <button
                    onClick={openHistory}
                    className="mt-1 ml-6 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <History size={16} />
                    <span>Histórico</span>
                  </button>
                )}
              </div>
            ))}
          </nav>
          <div className="border-t border-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-secondary transition-colors">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-foreground truncate">{profile?.full_name || 'Usuário'}</p>
                    <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${planColors[profile?.plan || 'free']}`}>
                      {profile?.plan || 'free'}
                    </span>
                  </div>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/dashboard/settings">
                    <UserCircle className="mr-2 h-4 w-4" /> Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="flex h-16 items-center gap-4 border-b border-border px-6 lg:px-8">
          <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="flex-1" />
        </header>
        <div className="p-6 lg:p-8">{children}</div>
      </main>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={(o) => { setHistoryDialogOpen(o); if (!o) { setActiveNetwork(null); setActivePost(null); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <History className="h-5 w-5 text-primary" />
              {activePost ? 'Detalhe do conteúdo' : activeNetwork ? `Histórico - ${activeNetMeta?.label}` : 'Histórico de conteúdos'}
            </DialogTitle>
          </DialogHeader>

          {historyLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activePost ? (
            // POST DETAIL VIEW
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setActivePost(null)}>
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
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                {activePost.title && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Título</p>
                    <h3 className="font-heading text-lg font-semibold">{activePost.title}</h3>
                  </div>
                )}
                {activePost.caption && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Legenda</p>
                    <p className="text-sm whitespace-pre-wrap">{activePost.caption}</p>
                  </div>
                )}
                {activePost.hashtags && activePost.hashtags.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Hashtags</p>
                    <p className="text-sm text-primary">{activePost.hashtags.map(h => `#${h}`).join(' ')}</p>
                  </div>
                )}
                {activePost.cta && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">CTA</p>
                    <p className="text-sm">👉 {activePost.cta}</p>
                  </div>
                )}
                {activePost.script && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Roteiro</p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{activePost.script}</p>
                  </div>
                )}
                {activePost.visual_idea && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Ideia visual</p>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{activePost.visual_idea}</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeNetwork ? (
            // POSTS LIST FOR A NETWORK
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setActiveNetwork(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Todas as redes
              </Button>
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Nenhum conteúdo nesta rede.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map(h => (
                    <button
                      key={h.id}
                      onClick={() => setActivePost(h)}
                      className="text-left group rounded-xl border border-border bg-card p-3 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all"
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
                  ))}
                </div>
              )}
            </div>
          ) : (
            // NETWORK GRID
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
                          onClick={() => setActiveNetwork(n.key)}
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
        </DialogContent>
      </Dialog>
    </div>
  );
};
