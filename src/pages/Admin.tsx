import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Users, FolderOpen, MessageSquare, Shield, Search, Save, Loader2, Key, ExternalLink, CheckCircle2, Bot, ArrowUp, ArrowDown, Power, MoreHorizontal, KeyRound, ShieldCheck, ShieldOff, UserX, UserCheck, Trash2, CreditCard, Package, Coins, Wallet, Plus, Pencil, Palette } from 'lucide-react';
import { BrandingTab } from '@/components/admin/BrandingTab';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

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

type PlanConfig = { id: string; plan: 'free' | 'pro' | 'enterprise'; display_name: string; monthly_credits: number; price_brl: number; description: string | null; features: string[] | null };
type CreditPackage = { id: string; name: string; credits: number; price_brl: number; is_active: boolean; sort_order: number; features: string[] | null };
type ActionCost = { id: string; action_key: string; display_name: string; cost: number; description: string | null };

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
  const [editEmail, setEditEmail] = useState('');
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

  // Plans
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  // Packages
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [editPkg, setEditPkg] = useState<CreditPackage | null>(null);
  const [newPkg, setNewPkg] = useState(false);
  const [pkgForm, setPkgForm] = useState<{ name: string; credits: number; price_brl: number; is_active: boolean; sort_order: number; features: string }>({ name: '', credits: 100, price_brl: 0, is_active: true, sort_order: 0, features: '' });
  // Action costs
  const [actionCosts, setActionCosts] = useState<ActionCost[]>([]);
  // Mercado Pago
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpBaseUrl, setMpBaseUrl] = useState('');
  const [mpSaved, setMpSaved] = useState({ token: false, pub: false, url: false });
  const [mpSaving, setMpSaving] = useState(false);

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

    // Plans, packages, action costs
    const [plansRes, pkgsRes, costsRes] = await Promise.all([
      supabase.from('plan_configs').select('*').order('price_brl'),
      supabase.from('credit_packages').select('*').order('sort_order'),
      supabase.from('credit_action_costs').select('*').order('display_name'),
    ]);
    setPlans((plansRes.data as PlanConfig[]) || []);
    setPackages((pkgsRes.data as CreditPackage[]) || []);
    setActionCosts((costsRes.data as ActionCost[]) || []);

    // Mercado Pago settings
    const mpKeys = ['mercadopago_access_token', 'mercadopago_public_key', 'app_base_url'];
    const { data: mpSettings } = await supabase.from('app_settings').select('key, value').in('key', mpKeys);
    (mpSettings || []).forEach(s => {
      if (s.key === 'mercadopago_access_token') { setMpAccessToken(s.value); setMpSaved(p => ({ ...p, token: !!s.value })); }
      if (s.key === 'mercadopago_public_key') { setMpPublicKey(s.value); setMpSaved(p => ({ ...p, pub: !!s.value })); }
      if (s.key === 'app_base_url') { setMpBaseUrl(s.value); setMpSaved(p => ({ ...p, url: !!s.value })); }
    });

    setLoading(false);
  };

  const upsertSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).maybeSingle();
    if (existing) {
      return supabase.from('app_settings').update({ value }).eq('key', key);
    }
    return supabase.from('app_settings').insert({ key, value });
  };

  const updatePlan = async (id: string, updates: Partial<PlanConfig>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    const { error } = await supabase.from('plan_configs').update(updates).eq('id', id);
    if (error) toast({ title: 'Erro ao salvar plano', description: error.message, variant: 'destructive' });
  };

  const savePackage = async () => {
    const featuresArr = pkgForm.features.split('\n').map(s => s.trim()).filter(Boolean);
    const payload = {
      name: pkgForm.name,
      credits: Number(pkgForm.credits),
      price_brl: Number(pkgForm.price_brl),
      is_active: pkgForm.is_active,
      sort_order: Number(pkgForm.sort_order),
      features: featuresArr,
    };
    if (!payload.name || payload.credits <= 0 || payload.price_brl < 0) {
      toast({ title: 'Preencha todos os campos válidos', variant: 'destructive' });
      return;
    }
    const { error } = editPkg
      ? await supabase.from('credit_packages').update(payload).eq('id', editPkg.id)
      : await supabase.from('credit_packages').insert(payload);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editPkg ? 'Pacote atualizado' : 'Pacote criado' });
      setEditPkg(null); setNewPkg(false);
      fetchData();
    }
  };

  const openNewPkg = () => {
    setEditPkg(null);
    setPkgForm({ name: '', credits: 100, price_brl: 0, is_active: true, sort_order: packages.length, features: '' });
    setNewPkg(true);
  };

  const openEditPkg = (p: CreditPackage) => {
    setEditPkg(p);
    setPkgForm({ name: p.name, credits: p.credits, price_brl: Number(p.price_brl), is_active: p.is_active, sort_order: p.sort_order, features: (p.features || []).join('\n') });
    setNewPkg(true);
  };

  const deletePkg = async (id: string) => {
    const { error } = await supabase.from('credit_packages').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Pacote removido' }); fetchData(); }
  };

  const updateCost = async (id: string, cost: number) => {
    setActionCosts(prev => prev.map(c => c.id === id ? { ...c, cost } : c));
    const { error } = await supabase.from('credit_action_costs').update({ cost }).eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
  };

  const saveMercadoPago = async () => {
    setMpSaving(true);
    const tasks = [];
    if (mpAccessToken.trim()) tasks.push(upsertSetting('mercadopago_access_token', mpAccessToken.trim()));
    if (mpPublicKey.trim()) tasks.push(upsertSetting('mercadopago_public_key', mpPublicKey.trim()));
    if (mpBaseUrl.trim()) tasks.push(upsertSetting('app_base_url', mpBaseUrl.trim()));
    const results = await Promise.all(tasks);
    setMpSaving(false);
    const err = results.find((r: any) => r?.error)?.error;
    if (err) toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    else {
      toast({ title: 'Configurações do Mercado Pago salvas' });
      setMpSaved({ token: !!mpAccessToken, pub: !!mpPublicKey, url: !!mpBaseUrl });
    }
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
    setEditEmail(u.email || '');
    setEditPlan(u.plan);
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);

    const trimmedEmail = editEmail.trim().toLowerCase();
    const emailChanged = trimmedEmail && trimmedEmail !== (editUser.email || '').toLowerCase();

    if (emailChanged) {
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        setSaving(false);
        toast({ title: 'Email inválido', variant: 'destructive' });
        return;
      }
      const { error: emailErr } = await supabase.rpc('admin_update_user_email', {
        _user_id: editUser.user_id,
        _new_email: trimmedEmail,
      });
      if (emailErr) {
        setSaving(false);
        toast({ title: 'Erro ao alterar email', description: emailErr.message, variant: 'destructive' });
        return;
      }
    }

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

  const changePlan = async (u: UserProfile, plan: 'free' | 'pro' | 'enterprise') => {
    if (u.plan === plan) return;
    const { error } = await supabase.from('profiles').update({ plan }).eq('id', u.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, plan } : x));
      toast({ title: `Plano alterado para ${plan.toUpperCase()}` });
    }
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
          <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 h-auto">
            <TabsTrigger value="users"><Users size={14} className="mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="plans"><ShieldCheck size={14} className="mr-1.5" />Planos</TabsTrigger>
            <TabsTrigger value="packages"><Package size={14} className="mr-1.5" />Pacotes</TabsTrigger>
            <TabsTrigger value="costs"><Coins size={14} className="mr-1.5" />Custos</TabsTrigger>
            <TabsTrigger value="payments"><Wallet size={14} className="mr-1.5" />Mercado Pago</TabsTrigger>
            <TabsTrigger value="branding"><Palette size={14} className="mr-1.5" />Personalização</TabsTrigger>
            <TabsTrigger value="settings"><Key size={14} className="mr-1.5" />APIs & IA</TabsTrigger>
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
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <CreditCard className="mr-2 h-4 w-4" /> Mudar plano
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="bg-popover">
                                      <DropdownMenuRadioGroup value={u.plan} onValueChange={(v) => changePlan(u, v as 'free' | 'pro' | 'enterprise')}>
                                        <DropdownMenuRadioItem value="free">Free</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="pro">Pro</DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="enterprise">Enterprise</DropdownMenuRadioItem>
                                      </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuPortal>
                                </DropdownMenuSub>
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
                    <Label>Email</Label>
                    <Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="usuario@exemplo.com" />
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

          {/* PLANOS */}
          <TabsContent value="plans" className="mt-4 space-y-4">
            <Card className="glass p-6">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={20} className="text-primary" />
                <h3 className="font-heading text-lg font-bold">Planos de assinatura</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-5">Configure créditos mensais e preço de cada plano. Alterações entram em vigor imediatamente.</p>
              <div className="grid gap-4 md:grid-cols-3">
                {plans.map(p => (
                  <Card key={p.id} className="p-4 border border-border bg-card/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="uppercase">{p.plan}</Badge>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Nome de exibição</Label>
                      <Input value={p.display_name} onChange={e => updatePlan(p.id, { display_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Créditos por mês</Label>
                      <Input type="number" value={p.monthly_credits} onChange={e => updatePlan(p.id, { monthly_credits: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Preço (R$)</Label>
                      <Input type="number" step="0.01" value={p.price_brl} onChange={e => updatePlan(p.id, { price_brl: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Descrição</Label>
                      <Input value={p.description || ''} onChange={e => updatePlan(p.id, { description: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Recursos (1 por linha)</Label>
                      <Textarea
                        rows={6}
                        placeholder={'Ex.:\nPerfil de avatar com IA\nRelatórios em PDF\nSuporte prioritário'}
                        value={(p.features || []).join('\n')}
                        onChange={e => updatePlan(p.id, { features: e.target.value.split('\n') as any })}
                        onBlur={e => updatePlan(p.id, { features: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) as any })}
                      />
                      <p className="text-[11px] text-muted-foreground">Aparecem na landing page como benefícios do plano.</p>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* PACOTES */}
          <TabsContent value="packages" className="mt-4 space-y-4">
            <Card className="glass p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-heading text-lg font-bold flex items-center gap-2"><Package size={20} className="text-primary" /> Pacotes de créditos</h3>
                  <p className="text-sm text-muted-foreground mt-1">Pacotes avulsos disponíveis para os usuários comprarem via Mercado Pago.</p>
                </div>
                <Button onClick={openNewPkg} className="glow-primary"><Plus size={16} className="mr-1.5" />Novo pacote</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Créditos</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>R$/crédito</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.credits.toLocaleString('pt-BR')}</TableCell>
                      <TableCell>R$ {Number(p.price_brl).toFixed(2)}</TableCell>
                      <TableCell className="text-muted-foreground">R$ {(Number(p.price_brl) / p.credits).toFixed(3)}</TableCell>
                      <TableCell>{p.sort_order}</TableCell>
                      <TableCell>
                        <Switch checked={p.is_active} onCheckedChange={async (v) => {
                          await supabase.from('credit_packages').update({ is_active: v }).eq('id', p.id);
                          setPackages(prev => prev.map(x => x.id === p.id ? { ...x, is_active: v } : x));
                        }} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEditPkg(p)}><Pencil size={14} /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePkg(p.id)}><Trash2 size={14} /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!packages.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum pacote cadastrado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>

            <Dialog open={newPkg} onOpenChange={(o) => { if (!o) { setNewPkg(false); setEditPkg(null); } }}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editPkg ? 'Editar pacote' : 'Novo pacote'}</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5"><Label>Nome</Label><Input value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Créditos</Label><Input type="number" value={pkgForm.credits} onChange={e => setPkgForm({ ...pkgForm, credits: Number(e.target.value) })} /></div>
                    <div className="space-y-1.5"><Label>Preço (R$)</Label><Input type="number" step="0.01" value={pkgForm.price_brl} onChange={e => setPkgForm({ ...pkgForm, price_brl: Number(e.target.value) })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Ordem</Label><Input type="number" value={pkgForm.sort_order} onChange={e => setPkgForm({ ...pkgForm, sort_order: Number(e.target.value) })} /></div>
                    <div className="space-y-1.5 flex flex-col"><Label>Ativo</Label><div className="pt-2"><Switch checked={pkgForm.is_active} onCheckedChange={v => setPkgForm({ ...pkgForm, is_active: v })} /></div></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recursos (1 por linha)</Label>
                    <Textarea
                      rows={5}
                      placeholder={'Ex.:\nCréditos não expiram\nLiberação imediata após pagamento\nPagamento via Pix, cartão ou boleto'}
                      value={pkgForm.features}
                      onChange={e => setPkgForm({ ...pkgForm, features: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">Aparecem como benefícios no card do pacote na landing page.</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setNewPkg(false); setEditPkg(null); }}>Cancelar</Button>
                  <Button onClick={savePackage} className="glow-primary"><Save size={14} className="mr-1.5" />Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* CUSTOS POR AÇÃO */}
          <TabsContent value="costs" className="mt-4 space-y-4">
            <Card className="glass p-6">
              <h3 className="font-heading text-lg font-bold flex items-center gap-2"><Coins size={20} className="text-primary" /> Custos por ação</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">Defina quantos créditos cada operação consome do usuário.</p>
              <div className="space-y-3">
                {actionCosts.map(c => (
                  <div key={c.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card/50">
                    <div className="flex-1">
                      <p className="font-semibold">{c.display_name}</p>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                      <code className="text-[10px] text-muted-foreground/70">{c.action_key}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} value={c.cost} onChange={e => updateCost(c.id, Number(e.target.value))} className="w-24 text-right font-bold" />
                      <span className="text-sm text-muted-foreground">créditos</span>
                    </div>
                  </div>
                ))}
                {!actionCosts.length && <p className="text-sm text-muted-foreground text-center py-6">Nenhum custo configurado</p>}
              </div>
            </Card>
          </TabsContent>

          {/* MERCADO PAGO */}
          <TabsContent value="payments" className="mt-4 space-y-4">
            <Card className="glass p-6 space-y-5">
              <div>
                <h3 className="font-heading text-lg font-bold flex items-center gap-2"><Wallet size={20} className="text-primary" /> Integração Mercado Pago</h3>
                <p className="text-sm text-muted-foreground mt-1">Configure as credenciais para processar pagamentos de pacotes de créditos.</p>
              </div>
              <Card className="bg-muted/30 border-primary/20 p-5 space-y-2">
                <h4 className="font-semibold text-sm">📖 Como obter as credenciais</h4>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Acesse o <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Painel de Desenvolvedores <ExternalLink size={12} /></a></li>
                  <li>Crie uma aplicação (ou selecione uma existente)</li>
                  <li>Em <strong>"Credenciais de produção"</strong>, copie o <strong>Access Token</strong> e a <strong>Public Key</strong></li>
                  <li>Cole abaixo, salve e configure o webhook no painel do Mercado Pago.</li>
                </ol>
              </Card>
              <div className="space-y-3">
                <Label>Access Token (privado — server-side)</Label>
                <div className="flex gap-2">
                  <Input type="password" placeholder="APP_USR-..." value={mpAccessToken} onChange={e => { setMpAccessToken(e.target.value); setMpSaved(p => ({ ...p, token: false })); }} className="font-mono text-xs" />
                  {mpSaved.token && <Badge variant="outline" className="border-success text-success self-center"><CheckCircle2 size={12} className="mr-1" />Configurado</Badge>}
                </div>
              </div>
              <div className="space-y-3">
                <Label>Public Key (frontend)</Label>
                <div className="flex gap-2">
                  <Input type="text" placeholder="APP_USR-..." value={mpPublicKey} onChange={e => { setMpPublicKey(e.target.value); setMpSaved(p => ({ ...p, pub: false })); }} className="font-mono text-xs" />
                  {mpSaved.pub && <Badge variant="outline" className="border-success text-success self-center"><CheckCircle2 size={12} className="mr-1" />Configurado</Badge>}
                </div>
              </div>
              <div className="space-y-3">
                <Label>URL base da aplicação (para back_urls)</Label>
                <Input type="url" placeholder="https://seuapp.lovable.app" value={mpBaseUrl} onChange={e => { setMpBaseUrl(e.target.value); setMpSaved(p => ({ ...p, url: false })); }} />
                <p className="text-xs text-muted-foreground">Usada para redirecionar o usuário após pagamento.</p>
              </div>
              <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border">
                <Label className="text-xs">Webhook URL (configure no painel do Mercado Pago)</Label>
                <code className="block text-xs break-all text-primary">
                  {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-webhook`}
                </code>
                <p className="text-[11px] text-muted-foreground">Em "Webhooks" do Mercado Pago, adicione esta URL e marque o evento <strong>Pagamentos</strong>.</p>
              </div>
              <Button onClick={saveMercadoPago} disabled={mpSaving} className="w-full glow-primary">
                {mpSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar configurações
              </Button>
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

          {/* PERSONALIZAÇÃO */}
          <TabsContent value="branding" className="mt-4">
            <BrandingTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Admin;
