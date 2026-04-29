import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, Youtube, Shield, LogOut, Menu, X, ChevronDown, FolderOpen, Coins, UserCircle, Sparkles, History, FileText, Clapperboard } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreditsWidget } from '@/components/CreditsWidget';
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


export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const { hasAddon } = useUserAddons();
  const pdfAddonActive = hasAddon('pdf-customization');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allItems = [...navItems, ...(isAdmin ? adminItems : [])];

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    pro: 'bg-primary/20 text-primary',
    enterprise: 'bg-warning/20 text-warning',
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
