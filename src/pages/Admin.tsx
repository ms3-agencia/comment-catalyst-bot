import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Users, FolderOpen, MessageSquare, Shield, Search, Save, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: string;
  created_at: string;
};

const Admin = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState({ users: 0, projects: 0, comments: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { count: pCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const { count: cCount } = await supabase.from('comments').select('*', { count: 'exact', head: true });
    setUsers((profiles as UserProfile[]) || []);
    setStats({ users: profiles?.length ?? 0, projects: pCount ?? 0, comments: cCount ?? 0 });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setEditName(u.full_name || '');
    setEditPlan(u.plan);
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: editName,
      plan: editPlan as 'free' | 'pro' | 'enterprise',
    }).eq('id', editUser.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário atualizado!' });
      setEditUser(null);
      fetchData();
    }
  };

  const filtered = users.filter(u =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'bg-muted text-muted-foreground',
      pro: 'bg-primary/20 text-primary',
      enterprise: 'bg-warning/20 text-warning',
    };
    return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${colors[plan] || colors.free}`}>{plan}</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Shield size={24} /> Painel Administrativo</h1>
          <p className="text-muted-foreground mt-1">Gerencie usuários, planos e estatísticas</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="glass p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><Users className="text-primary" size={24} /></div>
              <div>
                <p className="text-sm text-muted-foreground">Usuários</p>
                <p className="text-2xl font-bold font-heading">{stats.users}</p>
              </div>
            </div>
          </Card>
          <Card className="glass p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10"><FolderOpen className="text-info" size={24} /></div>
              <div>
                <p className="text-sm text-muted-foreground">Projetos</p>
                <p className="text-2xl font-bold font-heading">{stats.projects}</p>
              </div>
            </div>
          </Card>
          <Card className="glass p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10"><MessageSquare className="text-success" size={24} /></div>
              <div>
                <p className="text-sm text-muted-foreground">Comentários</p>
                <p className="text-2xl font-bold font-heading">{stats.comments}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Users table */}
        <Card className="glass overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Search size={18} className="text-muted-foreground" />
            <Input placeholder="Buscar usuários..." value={search} onChange={e => setSearch(e.target.value)} className="border-0 bg-transparent focus-visible:ring-0 p-0" />
          </div>
          {loading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{planBadge(u.plan)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => openEdit(u)}>Editar</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Nome</Label>
                              <Input value={editName} onChange={e => setEditName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>Plano</Label>
                              <Select value={editPlan} onValueChange={setEditPlan}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="free">Free</SelectItem>
                                  <SelectItem value="pro">Pro</SelectItem>
                                  <SelectItem value="enterprise">Enterprise</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={handleSave} className="w-full glow-primary" disabled={saving}>
                              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Admin;
