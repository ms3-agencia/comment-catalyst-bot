import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Mail, Bell, Send, Server, AlertCircle, CheckCircle2, Plus, Trash2, Megaphone, Lock, PenLine } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GmailAppPasswordTutorial } from './GmailAppPasswordTutorial';
import { RichTextEditor } from './RichTextEditor';
import { TemplateRulesEditor } from './TemplateRulesEditor';
import { BroadcastTab } from './BroadcastTab';
import { SignaturesTab } from './SignaturesTab';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type EmailTemplate = {
  id: string;
  key: string;
  name: string;
  subject: string;
  body_html: string;
  variables: string[];
  enabled: boolean;
  send_email: boolean;
  send_inapp: boolean;
  category: string;
  trigger_type: string;
  is_system: boolean;
  description?: string;
};

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'smtp_secure'];

const COMMON_VARS = ['user_name', 'user_email', 'site_name', 'app_url', 'plans_url', 'payment_link', 'credits_balance', 'plan_name', 'days_left', 'renewal_date'];

export function NotificationsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [smtp, setSmtp] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const [testingConn, setTestingConn] = useState(false);
  const [testingSend, setTestingSend] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTpl, setNewTpl] = useState({ key: '', name: '', category: 'general', trigger_type: 'manual' });

  const loadAll = async () => {
    const [{ data: tpls }, { data: settings }] = await Promise.all([
      supabase.from('email_templates').select('*').order('category').order('name'),
      supabase.from('app_settings').select('key, value').in('key', SMTP_KEYS),
    ]);
    setTemplates((tpls || []) as EmailTemplate[]);
    const s: Record<string, string> = {};
    (settings || []).forEach(r => { s[r.key] = r.value; });
    setSmtp(s);
    if (tpls && tpls.length > 0 && !activeKey) setActiveKey(tpls[0].key);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const upsertSetting = async (key: string, value: string) => {
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).maybeSingle();
    if (existing) return supabase.from('app_settings').update({ value }).eq('key', key);
    return supabase.from('app_settings').insert({ key, value });
  };

  const saveSmtp = async () => {
    setSaving(true);
    const tasks = SMTP_KEYS.map(k => upsertSetting(k, smtp[k] || ''));
    const results = await Promise.all(tasks);
    setSaving(false);
    const err = results.find((r: any) => r?.error)?.error;
    if (err) toast({ title: 'Erro ao salvar SMTP', description: err.message, variant: 'destructive' });
    else toast({ title: 'Configuração SMTP salva' });
  };

  const updateTemplate = (key: string, patch: Partial<EmailTemplate>) => {
    setTemplates(prev => prev.map(t => t.key === key ? { ...t, ...patch } : t));
  };

  const saveTemplate = async (tpl: EmailTemplate) => {
    setSaving(true);
    const { error } = await supabase.from('email_templates').update({
      name: tpl.name,
      subject: tpl.subject,
      body_html: tpl.body_html,
      enabled: tpl.enabled,
      send_email: tpl.send_email,
      send_inapp: tpl.send_inapp,
      category: tpl.category,
      trigger_type: tpl.trigger_type,
      description: tpl.description,
      variables: tpl.variables,
    }).eq('id', tpl.id);
    setSaving(false);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else toast({ title: 'Template salvo' });
  };

  const createTemplate = async () => {
    if (!newTpl.key || !newTpl.name) {
      toast({ title: 'Preencha chave e nome', variant: 'destructive' }); return;
    }
    if (!/^[a-z0-9_]+$/.test(newTpl.key)) {
      toast({ title: 'Chave inválida', description: 'Use apenas letras minúsculas, números e _', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('email_templates').insert({
      key: newTpl.key,
      name: newTpl.name,
      subject: `${newTpl.name} - {{site_name}}`,
      body_html: '<h2>Olá, {{user_name}}!</h2><p>Conteúdo do email aqui.</p>',
      variables: ['user_name', 'site_name', 'app_url'],
      category: newTpl.category,
      trigger_type: newTpl.trigger_type,
      is_system: false,
      enabled: false,
    });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Template criado' });
      setCreateOpen(false);
      setNewTpl({ key: '', name: '', category: 'general', trigger_type: 'manual' });
      await loadAll();
      setActiveKey(newTpl.key);
    }
  };

  const deleteTemplate = async (tpl: EmailTemplate) => {
    if (tpl.is_system) {
      toast({ title: 'Template do sistema não pode ser removido', variant: 'destructive' }); return;
    }
    if (!confirm(`Remover o template "${tpl.name}"? Esta ação é permanente.`)) return;
    const { error } = await supabase.from('email_templates').delete().eq('id', tpl.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Template removido' });
      const remaining = templates.filter(t => t.id !== tpl.id);
      setActiveKey(remaining[0]?.key || null);
      loadAll();
    }
  };

  const testSmtpConnection = async () => {
    setTestingConn(true);
    const { data, error } = await supabase.functions.invoke('send-system-email', { body: { action: 'test_connection' } });
    setTestingConn(false);
    if (error) toast({ title: 'Falha', description: error.message, variant: 'destructive' });
    else if ((data as any)?.ok) toast({ title: 'Conexão OK', description: (data as any).message });
    else toast({ title: 'Falhou', description: (data as any)?.error || 'Erro', variant: 'destructive' });
  };

  const sendSmtpTestEmail = async () => {
    if (!smtpTestEmail) { toast({ title: 'Informe um email', variant: 'destructive' }); return; }
    setTestingSend(true);
    const { data, error } = await supabase.functions.invoke('send-system-email', { body: { action: 'test_send', recipientEmail: smtpTestEmail } });
    setTestingSend(false);
    if (error) toast({ title: 'Falha', description: error.message, variant: 'destructive' });
    else if ((data as any)?.ok) toast({ title: 'Email enviado', description: (data as any).message });
    else toast({ title: 'Falhou', description: (data as any)?.error || 'Erro', variant: 'destructive' });
  };

  const sendTestEmail = async (tpl: EmailTemplate) => {
    if (!testEmail) { toast({ title: 'Informe um email', variant: 'destructive' }); return; }
    setSendingTest(true);
    const sampleVars: Record<string, any> = {
      user_name: 'João Teste', site_name: 'YCaptura', free_credits: 50, app_url: window.location.origin,
      package_name: 'Pacote Plus 500', credits: 500, amount: '49,90',
      addon_name: 'PDF Custom', addon_description: 'Personalize seus PDFs.', expires_at: '31/12/2026',
      plan_name: 'Pro', monthly_credits: 1000, plan_description: 'Acesso completo.',
      days_left: 3, renewal_date: '15/05/2026',
      payment_link: window.location.origin + '/dashboard/credits',
      plans_url: window.location.origin + '/dashboard/credits',
      credits_balance: 8, credits_url: window.location.origin + '/dashboard/credits',
    };
    const { data, error } = await supabase.functions.invoke('send-system-email', {
      body: { templateKey: tpl.key, recipientEmail: testEmail, variables: sampleVars },
    });
    setSendingTest(false);
    if (error) toast({ title: 'Falha', description: error.message, variant: 'destructive' });
    else if ((data as any)?.email === 'failed') toast({ title: 'SMTP falhou', description: (data as any)?.error || 'Verifique credenciais', variant: 'destructive' });
    else if ((data as any)?.email === 'skipped') toast({ title: 'SMTP não configurado', variant: 'destructive' });
    else toast({ title: 'Email enviado', description: `Confira ${testEmail}` });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  const active = templates.find(t => t.key === activeKey);
  const groupedTemplates = templates.reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t); return acc;
  }, {} as Record<string, EmailTemplate[]>);

  return (
    <div className="space-y-4">
      <Alert>
        <Bell className="h-4 w-4" />
        <AlertTitle>Avisos & Emails do sistema</AlertTitle>
        <AlertDescription>
          Configure SMTP, crie templates personalizados, defina regras de envio automático e dispare broadcasts manuais.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="smtp"><Server size={14} className="mr-1.5" />SMTP</TabsTrigger>
          <TabsTrigger value="templates"><Mail size={14} className="mr-1.5" />Templates & regras</TabsTrigger>
          <TabsTrigger value="broadcast"><Megaphone size={14} className="mr-1.5" />Broadcasts</TabsTrigger>
        </TabsList>

        <TabsContent value="smtp" className="mt-4">
          <Card className="glass p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Server className="text-primary" size={20} />
              <h3 className="font-semibold">Configuração SMTP</h3>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs space-y-2">
                <p>Para Gmail use Host: <b>smtp.gmail.com</b>, Porta: <b>587</b>, criptografia <b>tls</b>, e gere uma <b>senha de app</b>.</p>
                <GmailAppPasswordTutorial />
              </AlertDescription>
            </Alert>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs">Host SMTP</Label><Input value={smtp.smtp_host || ''} onChange={e => setSmtp(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Porta</Label><Input value={smtp.smtp_port || ''} onChange={e => setSmtp(p => ({ ...p, smtp_port: e.target.value }))} placeholder="587" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Usuário</Label><Input value={smtp.smtp_user || ''} onChange={e => setSmtp(p => ({ ...p, smtp_user: e.target.value }))} placeholder="seuemail@gmail.com" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Senha (senha de app)</Label><Input type="password" value={smtp.smtp_password || ''} onChange={e => setSmtp(p => ({ ...p, smtp_password: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email remetente</Label><Input value={smtp.smtp_from_email || ''} onChange={e => setSmtp(p => ({ ...p, smtp_from_email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Nome remetente</Label><Input value={smtp.smtp_from_name || ''} onChange={e => setSmtp(p => ({ ...p, smtp_from_name: e.target.value }))} placeholder="YCaptura" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Criptografia</Label><Input value={smtp.smtp_secure || 'tls'} onChange={e => setSmtp(p => ({ ...p, smtp_secure: e.target.value }))} placeholder="tls ou ssl" /></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={testSmtpConnection} disabled={testingConn}>
                  {testingConn ? <Loader2 className="animate-spin mr-2" size={14} /> : <Server className="mr-2" size={14} />} Testar conexão
                </Button>
                <Input placeholder="email@para.teste" className="w-56" value={smtpTestEmail} onChange={e => setSmtpTestEmail(e.target.value)} />
                <Button variant="outline" size="sm" onClick={sendSmtpTestEmail} disabled={testingSend}>
                  {testingSend ? <Loader2 className="animate-spin mr-2" size={14} /> : <Send className="mr-2" size={14} />} Enviar teste
                </Button>
              </div>
              <Button onClick={saveSmtp} disabled={saving} size="sm">
                {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />} Salvar SMTP
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card className="glass p-2 h-fit">
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full mb-2"><Plus size={14} className="mr-1" /> Novo template</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo template de email</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Chave (única, sem espaços)</Label>
                      <Input value={newTpl.key} onChange={e => setNewTpl(p => ({ ...p, key: e.target.value.toLowerCase() }))} placeholder="ex: trial_ending" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome</Label>
                      <Input value={newTpl.name} onChange={e => setNewTpl(p => ({ ...p, name: e.target.value }))} placeholder="Aviso de trial expirando" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Categoria</Label>
                        <Select value={newTpl.category} onValueChange={v => setNewTpl(p => ({ ...p, category: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">Geral</SelectItem>
                            <SelectItem value="lifecycle">Ciclo de vida</SelectItem>
                            <SelectItem value="billing">Cobrança</SelectItem>
                            <SelectItem value="transactional">Transacional</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo de gatilho</Label>
                        <Select value={newTpl.trigger_type} onValueChange={v => setNewTpl(p => ({ ...p, trigger_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual / broadcast</SelectItem>
                            <SelectItem value="scheduled">Agendado (com regras)</SelectItem>
                            <SelectItem value="event">Evento do sistema</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                    <Button onClick={createTemplate}>Criar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {Object.entries(groupedTemplates).map(([cat, list]) => (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground">{cat}</div>
                    {list.map(t => (
                      <button key={t.key} onClick={() => setActiveKey(t.key)}
                        className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${activeKey === t.key ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate flex items-center gap-1.5">
                            {t.is_system && <Lock size={10} className="text-muted-foreground shrink-0" />}
                            {t.name}
                          </span>
                          {t.enabled
                            ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                            : <span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />}
                        </div>
                        <code className="text-[10px] text-muted-foreground">{t.key}</code>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </Card>

            {active && (
              <div className="space-y-4">
                <Card className="glass p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {active.is_system && <Badge variant="outline" className="text-[10px]"><Lock size={10} className="mr-1" />Sistema</Badge>}
                      <div>
                        <h3 className="font-semibold">{active.name}</h3>
                        <code className="text-xs text-muted-foreground">{active.key}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-xs"><Switch checked={active.enabled} onCheckedChange={v => updateTemplate(active.key, { enabled: v })} />Ativo</label>
                      <label className="flex items-center gap-2 text-xs"><Switch checked={active.send_email} onCheckedChange={v => updateTemplate(active.key, { send_email: v })} /><Mail size={12} /> Email</label>
                      <label className="flex items-center gap-2 text-xs"><Switch checked={active.send_inapp} onCheckedChange={v => updateTemplate(active.key, { send_inapp: v })} /><Bell size={12} /> In-app</label>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={active.name} onChange={e => updateTemplate(active.key, { name: e.target.value })} /></div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categoria</Label>
                      <Select value={active.category} onValueChange={v => updateTemplate(active.key, { category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">Geral</SelectItem>
                          <SelectItem value="lifecycle">Ciclo de vida</SelectItem>
                          <SelectItem value="billing">Cobrança</SelectItem>
                          <SelectItem value="transactional">Transacional</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Assunto</Label>
                    <Input value={active.subject} onChange={e => updateTemplate(active.key, { subject: e.target.value })} />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-xs">Corpo do email</Label>
                      <div className="flex flex-wrap gap-1">
                        {(active.variables.length > 0 ? active.variables : COMMON_VARS).map(v => (
                          <Badge key={v} variant="outline" className="cursor-pointer text-[10px] hover:bg-primary/10"
                            onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast({ title: `Copiado: {{${v}}}` }); }}>
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <RichTextEditor value={active.body_html} onChange={html => updateTemplate(active.key, { body_html: html })} />
                    <p className="text-[10px] text-muted-foreground">Clique em uma variável para copiar e cole no editor. Variáveis no formato <code>{`{{nome}}`}</code> são substituídas no envio.</p>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Variáveis aceitas (avançado)</summary>
                    <Textarea
                      className="mt-2 font-mono text-xs"
                      rows={2}
                      value={active.variables.join(', ')}
                      onChange={e => updateTemplate(active.key, { variables: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="user_name, site_name, ..."
                    />
                  </details>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Input placeholder="email@para.teste" className="w-56" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                      <Button variant="outline" size="sm" onClick={() => sendTestEmail(active)} disabled={sendingTest}>
                        {sendingTest ? <Loader2 className="animate-spin mr-2" size={14} /> : <Send className="mr-2" size={14} />} Enviar teste
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      {!active.is_system && (
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteTemplate(active)}>
                          <Trash2 size={14} className="mr-1" /> Remover
                        </Button>
                      )}
                      <Button onClick={() => saveTemplate(active)} disabled={saving} size="sm">
                        {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />} Salvar
                      </Button>
                    </div>
                  </div>
                </Card>

                {(active.trigger_type === 'scheduled' || active.key === 'plan_renewal' || active.key === 'low_credits') && (
                  <TemplateRulesEditor templateId={active.id} />
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4">
          <BroadcastTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
