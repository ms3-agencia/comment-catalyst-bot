import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Users, FolderOpen, MessageSquare, Shield, Search, Save, Loader2, Key, ExternalLink, CheckCircle2, Bot, ArrowUp, ArrowDown, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan: string;
  created_at: string;
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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState({ users: 0, projects: 0, comments: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [saving, setSaving] = useState(false);

  // API Key state
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { count: pCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const { count: cCount } = await supabase.from('comments').select('*', { count: 'exact', head: true });
    setUsers((profiles as UserProfile[]) || []);
    setStats({ users: profiles?.length ?? 0, projects: pCount ?? 0, comments: cCount ?? 0 });

    // Fetch YouTube API key
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'youtube_api_key').single();
    if (setting?.value) {
      setYoutubeApiKey(setting.value);
      setApiKeySaved(true);
    }

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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Admin;
