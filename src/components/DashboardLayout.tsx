import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Youtube, Shield, LogOut, Menu, X, ChevronDown, FolderOpen, Coins, UserCircle, Sparkles, History, Instagram, Music2, Facebook, Linkedin, Twitter, Pin, MessageCircle, ArrowLeft, Copy, Check, Download, Loader2, TrendingUp, FileText, Wand2, ImageIcon, Clapperboard } from 'lucide-react';
import { VideoEditor } from '@/components/VideoEditor';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditsWidget } from '@/components/CreditsWidget';
import { CopyIconButton } from '@/components/CopyIconButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserAddons } from '@/hooks/useUserAddons';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/extract', icon: Youtube, label: 'Extrair Comentários' },
  { to: '/dashboard/projects', icon: FolderOpen, label: 'Meus Projetos' },
  { to: '/dashboard/generate', icon: Sparkles, label: 'Gerar Conteúdo' },
  { to: '/dashboard/drafts', icon: Clapperboard, label: 'Rascunhos do Editor' },
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

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { profile, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const { hasAddon } = useUserAddons();
  const pdfAddonActive = hasAddon('pdf-customization');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [activeNetwork, setActiveNetwork] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<HistoryItem | null>(null);
  const [videoEditorPost, setVideoEditorPost] = useState<HistoryItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Inline image generation in history detail
  const [genPanelOpen, setGenPanelOpen] = useState(false);
  const [genFormat, setGenFormat] = useState<ImgFormat | null>(null);
  const [genQuantity, setGenQuantity] = useState(1);
  const [genLoading, setGenLoading] = useState(false);
  const [genResults, setGenResults] = useState<string[]>([]);

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
      // Update local state with the latest image (which is what's saved on the row)
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
            {allItems.map(item => {
              const hasSubmenu =
                item.to === '/dashboard/generate' || item.to === '/dashboard/credits';
              const isActive = location.pathname === item.to;
              return (
                <div key={item.to} className="group/menu relative">
                  <Link
                    to={item.to}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="flex-1">{item.label}</span>
                    {hasSubmenu && (
                      <ChevronDown
                        size={14}
                        className="text-muted-foreground/70 transition-transform duration-200 group-hover/menu:rotate-180 group-hover/menu:text-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                  {hasSubmenu && (
                    <div
                      className="grid grid-rows-[0fr] opacity-0 transition-all duration-200 ease-out group-hover/menu:grid-rows-[1fr] group-hover/menu:opacity-100"
                    >
                      <div className="overflow-hidden">
                        <div className="pt-1 space-y-1">
                          {item.to === '/dashboard/generate' && (
                            <Link
                              to="/dashboard/generate/history"
                              className={`ml-6 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                location.pathname === '/dashboard/generate/history'
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                              }`}
                            >
                              <History size={16} />
                              <span>Histórico</span>
                            </Link>
                          )}
                          {item.to === '/dashboard/credits' && (
                            <Link
                              to="/dashboard/credits/history"
                              className={`ml-6 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                location.pathname === '/dashboard/credits/history'
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                              }`}
                            >
                              <History size={16} />
                              <span>Histórico de Créditos</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Separador + Add-ons (afastado dos demais menus) */}
            <div className="pt-6 mt-4 border-t border-border space-y-1">
              <Link
                to="/dashboard/addons"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  location.pathname === '/dashboard/addons'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Sparkles size={18} />
                <span className="flex-1">Recursos Adicionais</span>
              </Link>
              <Link
                to="/dashboard/pdf-customization"
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  location.pathname === '/dashboard/pdf-customization'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <FileText size={18} />
                <span className="flex-1">PDF Custom</span>
                {pdfAddonActive && (
                  <Badge className="h-5 px-1.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20">
                    ATIVO
                  </Badge>
                )}
              </Link>
            </div>
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

    </div>
  );
};
