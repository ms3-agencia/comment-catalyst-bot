import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Youtube, Settings, Shield, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/dashboard/extract', icon: Youtube, label: 'Extrair Comentários' },
  { to: '/dashboard/settings', icon: Settings, label: 'Configurações' },
];

const adminItems = [
  { to: '/admin', icon: Shield, label: 'Painel Admin' },
];

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const { profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allItems = [...navItems, ...(isAdmin ? adminItems : [])];

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    pro: 'bg-primary/20 text-primary',
    enterprise: 'bg-warning/20 text-warning',
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform lg:translate-x-0 lg:static ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-6 border-b border-border">
            <Link to="/dashboard" className="font-heading text-xl font-bold gradient-text">CommentIQ</Link>
            <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {allItems.map(item => (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${location.pathname === item.to ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <item.icon size={18} />
                {item.label}
              </Link>
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
