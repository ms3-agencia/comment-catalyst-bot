import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Youtube, Shield, LogOut, Menu, X, ChevronDown, FolderOpen, Coins, UserCircle, Sparkles, History, Instagram, Music2, Facebook, Linkedin, Twitter, Pin, MessageCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreditsWidget } from '@/components/CreditsWidget';
import { supabase } from '@/integrations/supabase/client';

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

const NETWORK_ICONS: Record<string, any> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  facebook: Facebook,
  linkedin: Linkedin,
  x: Twitter,
  pinterest: Pin,
  threads: MessageCircle,
};

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCounts, setHistoryCounts] = useState<Record<string, number>>({});

  const allItems = [...navItems, ...(isAdmin ? adminItems : [])];

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    pro: 'bg-primary/20 text-primary',
    enterprise: 'bg-warning/20 text-warning',
  };

  const isGeneratePage = location.pathname === '/dashboard/generate';

  const loadHistoryCounts = async () => {
    try {
      const { data } = await supabase
        .from('generated_contents')
        .select('social_network');
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((item: any) => {
          counts[item.social_network] = (counts[item.social_network] || 0) + 1;
        });
        setHistoryCounts(counts);
      }
    } catch (e) {
      console.error('Error loading history counts:', e);
    }
  };

  const toggleHistory = () => {
    if (!historyOpen) {
      loadHistoryCounts();
    }
    setHistoryOpen(!historyOpen);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
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
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${location.pathname === item.to ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <item.icon size={18} />
                {item.label}
              </Link>
            ))}
            
            {/* History button below Generate Content */}
            {isGeneratePage && (
              <div className="mt-2 pt-2 border-t border-border">
                <button
                  onClick={toggleHistory}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${historyOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                >
                  <History size={18} />
                  <span>Histórico</span>
                  <ChevronDown size={14} className={`ml-auto transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {historyOpen && (
                  <div className="mt-1 space-y-1 px-2">
                    {Object.entries(historyCounts).map(([network, count]) => {
                      const Icon = NETWORK_ICONS[network] || Sparkles;
                      return (
                        <Link
                          key={network}
                          to={`/dashboard/generate?network=${network}`}
                          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <Icon size={14} className="text-primary" />
                          <span className="capitalize">{network}</span>
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                            {count}
                          </span>
                        </Link>
                      );
                    })}
                    {Object.keys(historyCounts).length === 0 && (
                      <p className="text-xs text-muted-foreground px-3 py-2">Nenhum conteúdo gerado ainda.</p>
                    )}
                  </div>
                )}
              </div>
            )}
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

      {/* Main */}
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
