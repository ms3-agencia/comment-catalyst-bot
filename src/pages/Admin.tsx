import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Users, FolderOpen, MessageSquare, Shield, Search, Save, Loader2, Key, ExternalLink, CheckCircle2, Bot, ArrowUp, ArrowDown, Power, MoreHorizontal, KeyRound, ShieldCheck, ShieldOff, UserX, UserCheck, Trash2, CreditCard } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: string;
  status: string;
  created_at: string;
  is_admin?: boolean;
};

type AiProvider = {
  id: string;
  provider: string;
  model: string;
  priority: number;
  enabled: boolean;
};

const PROVIDER_META: Record<string, { label: string; secretName: string; docsUrl: string; defaultModels: string[] }> = {
  lovable: {
    label: 'Lovable AI Gateway',
    secretName: 'LOVABLE_API_KEY',
    docsUrl: 'https://docs.lovable.dev/features/ai',
    defaultModels: ['google/gemini-3-flash-preview', 'google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'openai/gpt-5-mini', 'openai/gpt-5'],
  },
  openai: {
    label: 'OpenAI',
    secretName: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/api-keys',
    defaultModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
  },
  openrouter: {
    label: 'OpenRouter',
    secretName: 'OPENROUTER_API_KEY',
    docsUrl: 'https://openrouter.ai/keys',
    defaultModels: ['google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.3-70b-instruct:free', 'anthropic/claude-3.5-sonnet'],
  },
  gemini: {
    label: 'Google Gemini',
    secretName: 'GEMINI_API_KEY',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    defaultModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  },
};

const Admin = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState({ users: 0, projects: 0, comments: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [saving, setSaving] = useState(false);

  // Password change
  const [pwdUser, setPwdUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // Delete confirmation
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // API Key state
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  // AI Providers state
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [providerKeySaved, setProviderKeySaved] = useState<Record<string, boolean>>({});
  const [providerKeySaving, setProviderKeySaving] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').eq('role', 'admin');
    const adminIds = new Set((roles || []).map(r => r.user_id));
    const { count: pCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const { count: cCount } = await supabase.from('comments').select('*', { count: 'exact', head: true });
    const enriched = ((profiles as any[]) || []).map(p => ({ ...p, is_admin: adminIds.has(p.user_id) })) as UserProfile[];
    setUsers(enriched);
    setStats({ users: profiles?.length ?? 0, projects: pCount ?? 0, comments: cCount ?? 0 });

    // Fetch YouTube API key
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'youtube_api_key').maybeSingle();
    if (setting?.value) {
      setYoutubeApiKey(setting.value);
      setApiKeySaved(true);
    }

    // Fetch AI providers
    const { data: provs } = await supabase.from('ai_providers').select('*').order('priority', { ascending: true });
    setProviders((provs as AiProvider[]) || []);

    // Fetch provider API keys stored in app_settings
    const providerKeyNames = Object.keys(PROVIDER_META).map(k => `provider_key_${k}`);
    const { data: keySettings } = await supabase.from('app_settings').select('key, value').in('key', providerKeyNames);
    const keysMap: Record<string, string> = {};
    const savedMap: Record<string, boolean> = {};
    (keySettings || []).forEach(s => {
      const provKey = s.key.replace('provider_key_', '');
      keysMap[provKey] = s.value;
      savedMap[provKey] = !!s.value;
    });
    // Lovable AI Gateway uses LOVABLE_API_KEY auto-provisioned by the platform
    savedMap['lovable'] = true;
    setProviderKeys(keysMap);
    setProviderKeySaved(savedMap);

    setLoading(false);
  };

  const saveProviderKey = async (providerId: string) => {
    const value = (providerKeys[providerId] || '').trim();
    if (!value) {
      toast({ title: 'Informe a chave da API', variant: 'destructive' });
      return;
    }
    setProviderKeySaving(prev => ({ ...prev, [providerId]: true }));
    const key = `provider_key_${providerId}`;
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).maybeSingle();
    let error;
    if (existing) {
      ({ error } = await supabase.from('app_settings').update({ value }).eq('key', key));
    } else {
      ({ error } = await supabase.from('app_settings').insert({ key, value }));
    }
    setProviderKeySaving(prev => ({ ...prev, [providerId]: false }));
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Chave do ${PROVIDER_META[providerId]?.label || providerId} salva!` });
      setProviderKeySaved(prev => ({ ...prev, [providerId]: true }));
    }
  };

  const clearProviderKey = async (providerId: string) => {
    setProviderKeySaving(prev => ({ ...prev, [providerId]: true }));
    const key = `provider_key_${providerId}`;
    const { error } = await supabase.from('app_settings').delete().eq('key', key);
    setProviderKeySaving(prev => ({ ...prev, [providerId]: false }));
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Chave removida' });
      setProviderKeys(prev => ({ ...prev, [providerId]: '' }));
      setProviderKeySaved(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const updateProvider = async (id: string, updates: Partial<AiProvider>) => {
    setProviders(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
    const { error } = await supabase.from('ai_providers').update(updates).eq('id', id);
    if (error) toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
  };

  const moveProvider = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...providers].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex(p => p.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    setProvidersLoading(true);
    await Promise.all([
      supabase.from('ai_providers').update({ priority: b.priority }).eq('id', a.id),
      supabase.from('ai_providers').update({ priority: a.priority }).eq('id', b.id),
    ]);
    const { data: provs } = await supabase.from('ai_providers').select('*').order('priority', { ascending: true });
    setProviders((provs as AiProvider[]) || []);
    setProvidersLoading(false);
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

  const toggleStatus = async (u: UserProfile) => {
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', u.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: next } : x));
      toast({ title: next === 'suspended' ? 'Usuário suspenso' : 'Usuário ativado' });
    }
  };

  const toggleAdmin = async (u: UserProfile) => {
    if (u.is_admin) {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', u.user_id).eq('role', 'admin');
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Permissão de admin removida' });
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: u.user_id, role: 'admin' });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Usuário promovido a admin' });
    }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_admin: !u.is_admin } : x));
  };

  const handleChangePassword = async () => {
    if (!pwdUser || newPassword.length < 6) {
      toast({ title: 'Senha precisa ter ao menos 6 caracteres', variant: 'destructive' });
      return;
    }
    setPwdSaving(true);
    const { error } = await supabase.rpc('admin_update_user_password', {
      _user_id: pwdUser.user_id,
      _new_password: newPassword,
    });
    setPwdSaving(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha alterada com sucesso' });
      setPwdUser(null);
      setNewPassword('');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    const { error } = await supabase.rpc('admin_delete_user', { _user_id: deleteUser.user_id });
    setDeleting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário excluído' });
      setUsers(prev => prev.filter(x => x.id !== deleteUser.id));
      setDeleteUser(null);
    }
  };

  const handleSaveApiKey = async () => {
    if (!youtubeApiKey.trim()) {
      toast({ title: 'Informe a chave da API', variant: 'destructive' });
      return;
    }
    setApiKeyLoading(true);

    // Upsert the API key
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', 'youtube_api_key').single();

    let error;
    if (existing) {
      ({ error } = await supabase.from('app_settings').update({ value: youtubeApiKey }).eq('key', 'youtube_api_key'));
    } else {
      ({ error } = await supabase.from('app_settings').insert({ key: 'youtube_api_key', value: youtubeApiKey }));
    }

    setApiKeyLoading(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Chave da API salva com sucesso!' });
      setApiKeySaved(true);
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
          <p className="text-muted-foreground mt-1">Gerencie usuários, planos, configurações e estatísticas</p>
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

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
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
                      <TableHead>Status</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(u => {
                      const isSelf = currentUser?.id === u.user_id;
                      const suspended = u.status === 'suspended';
                      return (
                        <TableRow key={u.id} className={suspended ? 'opacity-60' : ''}>
                          <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>{planBadge(u.plan)}</TableCell>
                          <TableCell>
                            {suspended ? (
                              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase bg-destructive/20 text-destructive">Suspenso</span>
                            ) : (
                              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase bg-success/20 text-success">Ativo</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.is_admin ? (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase bg-primary/20 text-primary">
                                <ShieldCheck size={12} /> Admin
                              </span>
                            ) : (
                              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase bg-muted text-muted-foreground">Usuário</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 bg-popover">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openEdit(u)}>
                                  <Save className="mr-2 h-4 w-4" /> Editar dados
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setPwdUser(u); setNewPassword(''); }}>
                                  <KeyRound className="mr-2 h-4 w-4" /> Mudar senha
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => toggleAdmin(u)} disabled={isSelf}>
                                  {u.is_admin ? (
                                    <><ShieldOff className="mr-2 h-4 w-4" /> Remover admin</>
                                  ) : (
                                    <><ShieldCheck className="mr-2 h-4 w-4" /> Tornar admin</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleStatus(u)} disabled={isSelf}>
                                  {suspended ? (
                                    <><UserCheck className="mr-2 h-4 w-4" /> Ativar</>
                                  ) : (
                                    <><UserX className="mr-2 h-4 w-4" /> Suspender</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteUser(u)}
                                  disabled={isSelf}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir usuário
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!filtered.length && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </Card>

            {/* Edit user dialog */}
            <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
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

            {/* Change password dialog */}
            <Dialog open={!!pwdUser} onOpenChange={(open) => !open && setPwdUser(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mudar senha</DialogTitle>
                  <DialogDescription>
                    Defina uma nova senha para <strong>{pwdUser?.email}</strong>. Mínimo de 6 caracteres.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Nova senha</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoFocus
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPwdUser(null)}>Cancelar</Button>
                  <Button onClick={handleChangePassword} disabled={pwdSaving} className="glow-primary">
                    {pwdSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Alterar senha
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. <strong>{deleteUser?.email}</strong> e todos os dados relacionados serão removidos permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); handleDeleteUser(); }}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <Card className="glass p-6 space-y-6">
              <div>
                <h3 className="font-heading text-lg font-bold flex items-center gap-2">
                  <Key size={20} className="text-primary" /> YouTube Data API v3
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Configure a chave de API para extração real de comentários do YouTube</p>
              </div>

              {/* Tutorial */}
              <Card className="bg-muted/30 border-primary/20 p-5 space-y-3">
                <h4 className="font-semibold text-sm">📖 Como obter a chave da API do YouTube</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink size={12} /></a></li>
                  <li>Crie um novo projeto ou selecione um existente</li>
                  <li>Vá em <strong>"APIs e Serviços" → "Biblioteca"</strong></li>
                  <li>Pesquise por <strong>"YouTube Data API v3"</strong> e clique em <strong>"Ativar"</strong></li>
                  <li>Vá em <strong>"APIs e Serviços" → "Credenciais"</strong></li>
                  <li>Clique em <strong>"Criar credenciais" → "Chave de API"</strong></li>
                  <li>Copie a chave gerada e cole no campo abaixo</li>
                </ol>
                <p className="text-xs text-muted-foreground/70">💡 Dica: Restrinja a chave apenas para a YouTube Data API v3 para maior segurança.</p>
              </Card>

              {/* API Key input */}
              <div className="space-y-3">
                <Label htmlFor="yt-api-key">Chave da API do YouTube</Label>
                <div className="flex gap-3">
                  <Input
                    id="yt-api-key"
                    type="password"
                    placeholder="AIza..."
                    value={youtubeApiKey}
                    onChange={e => { setYoutubeApiKey(e.target.value); setApiKeySaved(false); }}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveApiKey} disabled={apiKeyLoading} className="glow-primary">
                    {apiKeyLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : apiKeySaved ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> Salvo</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" /> Salvar</>
                    )}
                  </Button>
                </div>
                {apiKeySaved && (
                  <p className="text-xs text-success flex items-center gap-1">
                    <CheckCircle2 size={12} /> Chave da API configurada e ativa
                  </p>
                )}
              </div>
            </Card>

            {/* AI Providers */}
            <Card className="glass p-6 space-y-6 mt-6">
              <div>
                <h3 className="font-heading text-lg font-bold flex items-center gap-2">
                  <Bot size={20} className="text-primary" /> Provedores de IA
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure os provedores, modelo e ordem de prioridade. O sistema tentará o de maior prioridade primeiro com fallback automático em caso de falha.
                </p>
              </div>

              <Card className="bg-muted/30 border-primary/20 p-4">
                <p className="text-sm">
                  🔐 As chaves são armazenadas com segurança no banco e acessíveis apenas por administradores. Use os links abaixo para obtê-las em cada provedor.
                </p>
              </Card>

              <div className="space-y-3">
                {[...providers].sort((a, b) => a.priority - b.priority).map((p, idx, arr) => {
                  const meta = PROVIDER_META[p.provider] || { label: p.provider, secretName: '', docsUrl: '#', defaultModels: [] };
                  const keyValue = providerKeys[p.provider] || '';
                  const keySaved = providerKeySaved[p.provider];
                  const keySaving = providerKeySaving[p.provider];
                  return (
                    <Card key={p.id} className="p-4 border border-border bg-card/50">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" disabled={idx === 0 || providersLoading} onClick={() => moveProvider(p.id, 'up')}>
                            <ArrowUp size={14} />
                          </Button>
                          <div className="text-center text-xs font-bold text-muted-foreground">#{idx + 1}</div>
                          <Button size="icon" variant="outline" className="h-7 w-7" disabled={idx === arr.length - 1 || providersLoading} onClick={() => moveProvider(p.id, 'down')}>
                            <ArrowDown size={14} />
                          </Button>
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{meta.label}</h4>
                              {p.enabled ? (
                                <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">Ativo</span>
                              ) : (
                                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Desativado</span>
                              )}
                              {keySaved && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <CheckCircle2 size={10} /> Chave configurada
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Power size={14} className="text-muted-foreground" />
                              <Switch checked={p.enabled} onCheckedChange={(v) => updateProvider(p.id, { enabled: v })} />
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Modelo</Label>
                              <Select value={p.model} onValueChange={(v) => updateProvider(p.id, { model: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {meta.defaultModels.map(m => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                  ))}
                                  {!meta.defaultModels.includes(p.model) && (
                                    <SelectItem value={p.model}>{p.model} (atual)</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Chave da API</Label>
                                {p.provider !== 'lovable' && (
                                  <a href={meta.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                                    <ExternalLink size={10} /> Obter chave
                                  </a>
                                )}
                              </div>
                              {p.provider === 'lovable' ? (
                                <div className="flex gap-2 items-center">
                                  <Input
                                    type="password"
                                    value="••••••••••••••••••••••••"
                                    readOnly
                                    disabled
                                    className="flex-1 font-mono text-xs bg-muted/40"
                                  />
                                  <span className="text-xs text-success inline-flex items-center gap-1 whitespace-nowrap">
                                    <CheckCircle2 size={12} /> Auto
                                  </span>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    type="password"
                                    placeholder={keySaved ? '••••••••••••' : 'Cole a chave aqui'}
                                    value={keyValue}
                                    onChange={(e) => {
                                      setProviderKeys(prev => ({ ...prev, [p.provider]: e.target.value }));
                                      setProviderKeySaved(prev => ({ ...prev, [p.provider]: false }));
                                    }}
                                    className="flex-1 font-mono text-xs"
                                  />
                                  <Button size="sm" onClick={() => saveProviderKey(p.provider)} disabled={keySaving} className="glow-primary">
                                    {keySaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save size={14} />}
                                  </Button>
                                  {keySaved && (
                                    <Button size="sm" variant="outline" onClick={() => clearProviderKey(p.provider)} disabled={keySaving} title="Remover chave">
                                      <Trash2 size={14} />
                                    </Button>
                                  )}
                                </div>
                              )}
                              {p.provider === 'lovable' && (
                                <p className="text-[11px] text-muted-foreground">
                                  Gerenciada automaticamente pelo Lovable Cloud — nenhuma ação necessária.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}

                {providers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum provedor configurado.</p>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Admin;
