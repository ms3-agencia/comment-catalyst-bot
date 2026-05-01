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
import { Loader2, Save, Mail, Bell, Send, Server, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GmailAppPasswordTutorial } from './GmailAppPasswordTutorial';

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
};

const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'smtp_secure'];

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

  useEffect(() => {
    (async () => {
      const [{ data: tpls }, { data: settings }] = await Promise.all([
        supabase.from('email_templates').select('*').order('key'),
        supabase.from('app_settings').select('key, value').in('key', SMTP_KEYS),
      ]);
      setTemplates((tpls || []) as EmailTemplate[]);
      const s: Record<string, string> = {};
      (settings || []).forEach(r => { s[r.key] = r.value; });
      setSmtp(s);
      if (tpls && tpls.length > 0) setActiveKey(tpls[0].key);
      setLoading(false);
    })();
  }, []);

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
    }).eq('id', tpl.id);
    setSaving(false);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else toast({ title: 'Template salvo' });
  };

  const testSmtpConnection = async () => {
    setTestingConn(true);
    const { data, error } = await supabase.functions.invoke('send-system-email', {
      body: { action: 'test_connection' },
    });
    setTestingConn(false);
    if (error) toast({ title: 'Falha ao testar', description: error.message, variant: 'destructive' });
    else if ((data as any)?.ok) toast({ title: 'Conexão OK', description: (data as any).message });
    else toast({ title: 'Conexão falhou', description: (data as any)?.error || 'Erro desconhecido', variant: 'destructive' });
  };

  const sendSmtpTestEmail = async () => {
    if (!smtpTestEmail) {
      toast({ title: 'Informe um email para teste', variant: 'destructive' });
      return;
    }
    setTestingSend(true);
    const { data, error } = await supabase.functions.invoke('send-system-email', {
      body: { action: 'test_send', recipientEmail: smtpTestEmail },
    });
    setTestingSend(false);
    if (error) toast({ title: 'Falha no envio', description: error.message, variant: 'destructive' });
    else if ((data as any)?.ok) toast({ title: 'Email enviado', description: (data as any).message });
    else toast({ title: 'Envio falhou', description: (data as any)?.error || 'Erro desconhecido', variant: 'destructive' });
  };

  const sendTestEmail = async (tpl: EmailTemplate) => {
    if (!testEmail) {
      toast({ title: 'Informe um email para teste', variant: 'destructive' });
      return;
    }
    setSendingTest(true);
    const sampleVars: Record<string, any> = {
      user_name: 'João Teste',
      site_name: 'YCaptura',
      free_credits: 50,
      app_url: window.location.origin,
      package_name: 'Pacote Plus 500',
      credits: 500,
      amount: '49,90',
      addon_name: 'PDF Custom',
      addon_description: 'Personalize todos os PDFs gerados.',
      expires_at: '31/12/2026',
      plan_name: 'Pro',
      monthly_credits: 1000,
      plan_description: 'Acesso completo aos recursos profissionais.',
      days_left: 3,
      renewal_date: '15/05/2026',
    };
    const { data, error } = await supabase.functions.invoke('send-system-email', {
      body: {
        templateKey: tpl.key,
        recipientEmail: testEmail,
        variables: sampleVars,
      },
    });
    setSendingTest(false);
    if (error) toast({ title: 'Falha no envio', description: error.message, variant: 'destructive' });
    else if ((data as any)?.email === 'failed') toast({ title: 'SMTP falhou', description: 'Verifique credenciais. Veja logs no Supabase.', variant: 'destructive' });
    else if ((data as any)?.email === 'skipped') toast({ title: 'SMTP não configurado', description: 'Preencha as credenciais SMTP primeiro.', variant: 'destructive' });
    else toast({ title: 'Email de teste enviado', description: `Confira a caixa de entrada de ${testEmail}.` });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  const active = templates.find(t => t.key === activeKey);

  return (
    <div className="space-y-4">
      <Alert>
        <Bell className="h-4 w-4" />
        <AlertTitle>Avisos & Emails do sistema</AlertTitle>
        <AlertDescription>
          Configure o servidor de email (SMTP) e personalize cada template. Variáveis no formato <code className="text-primary">{'{{user_name}}'}</code> são substituídas automaticamente. Cada template pode ser entregue por email, in-app ou ambos.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="smtp" className="w-full">
        <TabsList>
          <TabsTrigger value="smtp"><Server size={14} className="mr-1.5" />Servidor SMTP</TabsTrigger>
          <TabsTrigger value="templates"><Mail size={14} className="mr-1.5" />Templates</TabsTrigger>
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
                <p>
                  Para Gmail use Host: <b>smtp.gmail.com</b>, Porta: <b>587</b>, criptografia <b>tls</b>, e gere uma <b>senha de app</b> (a senha normal do Gmail não funciona).
                </p>
                <GmailAppPasswordTutorial />
              </AlertDescription>
            </Alert>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Host SMTP</Label>
                <Input value={smtp.smtp_host || ''} onChange={e => setSmtp(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Porta</Label>
                <Input value={smtp.smtp_port || ''} onChange={e => setSmtp(p => ({ ...p, smtp_port: e.target.value }))} placeholder="587" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Usuário (email completo)</Label>
                <Input value={smtp.smtp_user || ''} onChange={e => setSmtp(p => ({ ...p, smtp_user: e.target.value }))} placeholder="seuemail@gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Senha (senha de app)</Label>
                <Input type="password" value={smtp.smtp_password || ''} onChange={e => setSmtp(p => ({ ...p, smtp_password: e.target.value }))} placeholder="xxxx xxxx xxxx xxxx" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email remetente (From)</Label>
                <Input value={smtp.smtp_from_email || ''} onChange={e => setSmtp(p => ({ ...p, smtp_from_email: e.target.value }))} placeholder="noreply@seudominio.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome remetente</Label>
                <Input value={smtp.smtp_from_name || ''} onChange={e => setSmtp(p => ({ ...p, smtp_from_name: e.target.value }))} placeholder="YCaptura" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Criptografia</Label>
                <Input value={smtp.smtp_secure || 'tls'} onChange={e => setSmtp(p => ({ ...p, smtp_secure: e.target.value }))} placeholder="tls ou ssl" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={testSmtpConnection} disabled={testingConn}>
                  {testingConn ? <Loader2 className="animate-spin mr-2" size={14} /> : <Server className="mr-2" size={14} />}
                  Testar conexão
                </Button>
                <Input
                  placeholder="email@para.teste"
                  className="w-56"
                  value={smtpTestEmail}
                  onChange={e => setSmtpTestEmail(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={sendSmtpTestEmail} disabled={testingSend}>
                  {testingSend ? <Loader2 className="animate-spin mr-2" size={14} /> : <Send className="mr-2" size={14} />}
                  Enviar teste
                </Button>
              </div>
              <Button onClick={saveSmtp} disabled={saving} size="sm">
                {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />} Salvar SMTP
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Salve as configurações antes de testar. "Testar conexão" valida host/porta/usuário/senha. "Enviar teste" envia um email simples para confirmar entrega.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <Card className="glass p-2 h-fit">
              <div className="space-y-1">
                {templates.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setActiveKey(t.key)}
                    className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${activeKey === t.key ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{t.name}</span>
                      {t.enabled
                        ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                        : <span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />}
                    </div>
                    <code className="text-[10px] text-muted-foreground">{t.key}</code>
                  </button>
                ))}
              </div>
            </Card>

            {active && (
              <Card className="glass p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{active.name}</h3>
                    <code className="text-xs text-muted-foreground">{active.key}</code>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={active.enabled} onCheckedChange={v => updateTemplate(active.key, { enabled: v })} />
                      Ativo
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={active.send_email} onCheckedChange={v => updateTemplate(active.key, { send_email: v })} />
                      <Mail size={12} /> Email
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={active.send_inapp} onCheckedChange={v => updateTemplate(active.key, { send_inapp: v })} />
                      <Bell size={12} /> In-app
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Nome interno</Label>
                  <Input value={active.name} onChange={e => updateTemplate(active.key, { name: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Assunto do email</Label>
                  <Input value={active.subject} onChange={e => updateTemplate(active.key, { subject: e.target.value })} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="text-xs">Corpo (HTML)</Label>
                    <div className="flex flex-wrap gap-1">
                      {active.variables.map(v => (
                        <Badge
                          key={v}
                          variant="outline"
                          className="cursor-pointer text-[10px] hover:bg-primary/10"
                          onClick={() => {
                            navigator.clipboard.writeText(`{{${v}}}`);
                            toast({ title: `Copiado: {{${v}}}` });
                          }}
                        >
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    rows={10}
                    className="font-mono text-xs"
                    value={active.body_html}
                    onChange={e => updateTemplate(active.key, { body_html: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground">Clique em uma variável acima para copiar. Use HTML simples (h2, p, b, a, ul/li).</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Pré-visualização</Label>
                  <div className="rounded-lg border border-border bg-background/50 p-4 text-sm" dangerouslySetInnerHTML={{ __html: active.body_html }} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="email@para.teste"
                      className="w-56"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                    />
                    <Button variant="outline" size="sm" onClick={() => sendTestEmail(active)} disabled={sendingTest}>
                      {sendingTest ? <Loader2 className="animate-spin mr-2" size={14} /> : <Send className="mr-2" size={14} />}
                      Enviar teste
                    </Button>
                  </div>
                  <Button onClick={() => saveTemplate(active)} disabled={saving} size="sm">
                    {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />}
                    Salvar template
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
