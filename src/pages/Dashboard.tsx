import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Youtube, MessageSquare, FolderOpen, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Dashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ projects: 0, comments: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const { count: pCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
      const { data: projects } = await supabase.from('projects').select('id');
      let cCount = 0;
      if (projects && projects.length > 0) {
        const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).in('project_id', projects.map(p => p.id));
        cCount = count ?? 0;
      }
      setStats({ projects: pCount ?? 0, comments: cCount });
    };
    fetchStats();
  }, []);

  const planLimits: Record<string, number> = { free: 3, pro: 25, enterprise: 999 };
  const limit = planLimits[profile?.plan || 'free'];

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold">Olá, {profile?.full_name || 'Usuário'} 👋</h1>
          <p className="text-muted-foreground mt-1">Veja o resumo da sua conta</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="glass p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><FolderOpen className="text-primary" size={24} /></div>
              <div>
                <p className="text-sm text-muted-foreground">Projetos</p>
                <p className="text-2xl font-bold font-heading">{stats.projects}<span className="text-sm text-muted-foreground font-normal">/{limit}</span></p>
              </div>
            </div>
          </Card>
          <Card className="glass p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10"><MessageSquare className="text-info" size={24} /></div>
              <div>
                <p className="text-sm text-muted-foreground">Comentários Extraídos</p>
                <p className="text-2xl font-bold font-heading">{stats.comments}</p>
              </div>
            </div>
          </Card>
          <Card className="glass p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10"><Sparkles className="text-warning" size={24} /></div>
              <div>
                <p className="text-sm text-muted-foreground">Plano</p>
                <p className="text-2xl font-bold font-heading capitalize">{profile?.plan || 'free'}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="glass p-8 text-center">
          <Youtube className="mx-auto text-destructive" size={48} />
          <h2 className="mt-4 font-heading text-xl font-bold">Extraia Comentários do YouTube</h2>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">Cole links de vídeos e obtenha análises detalhadas dos comentários com IA.</p>
          <Link to="/dashboard/extract">
            <Button className="mt-6 glow-primary">Começar Extração</Button>
          </Link>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
