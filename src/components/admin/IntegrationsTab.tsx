import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, AlertCircle, ExternalLink, Save, Loader2, HardDrive, BookOpen, Copy } from 'lucide-react';

type IntegrationStatus = 'connected' | 'partial' | 'disconnected';

type IntegrationConfig = {
  id: string;
  name: string;
  description: string;
  icon: typeof HardDrive;
  fields: { key: string; label: string; type: 'text' | 'password'; placeholder?: string; helper?: string }[];
  manual: { title: string; steps: { title: string; description: string }[]; docsUrl?: string };
};

const INTEGRATIONS: IntegrationConfig[] = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    description:
      'Fallback de download: vídeos renderizados são enviados para uma conta única do Drive da plataforma e organizados por usuário. Usado quando o download direto pelo navegador falha.',
    icon: HardDrive,
    fields: [
      {
        key: 'gdrive_root_folder_id',
        label: 'ID da pasta raiz no Drive',
        type: 'text',
        placeholder: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ',
        helper: 'Subpastas serão criadas automaticamente por usuário dentro desta pasta.',
      },
      {
        key: 'gdrive_share_default',
        label: 'Visibilidade padrão dos arquivos',
        type: 'text',
        placeholder: 'private | anyone_with_link',
        helper: 'Use "anyone_with_link" para gerar URL pública. "private" mantém só para a conta da plataforma.',
      },
    ],
    manual: {
      title: 'Como conectar o Google Drive da plataforma',
      docsUrl: 'https://drive.google.com',
      steps: [
        {
          title: '1. Conectar a conta Google da plataforma',
          description:
            'Vá em Conectores → Google Drive e autentique com a conta Google que servirá como repositório central. Recomendado: usar uma conta de serviço da empresa, não pessoal.',
        },
        {
          title: '2. Criar a pasta raiz no Drive',
          description:
            'No drive.google.com, crie uma pasta (ex.: "Renders YCaptura"). Abra a pasta e copie o ID da URL: https://drive.google.com/drive/folders/[ESTE_ID].',
        },
        {
          title: '3. Colar o ID e salvar',
          description: 'Cole o ID no campo "ID da pasta raiz" abaixo e clique em Salvar. Subpastas por usuário serão criadas automaticamente no primeiro upload.',
        },
        {
          title: '4. Definir a visibilidade',
          description:
            'Escolha entre "private" (só conta da plataforma) ou "anyone_with_link" (URL pública para o usuário baixar). Para máxima segurança use "private" + URL assinada temporária.',
        },
        {
          title: '5. Testar o fallback',
          description:
            'Renderize um vídeo no editor. Se o download direto falhar, o sistema fará upload para o Drive e devolverá o link. Verifique se o arquivo apareceu na pasta.',
        },
      ],
    },
  },
  {
    id: 'youtube',
    name: 'YouTube Data API v3',
    description: 'Extração de comentários públicos de vídeos do YouTube. Usado pela funcionalidade de análise de avatar.',
    icon: BookOpen,
    fields: [
      { key: 'youtube_api_key', label: 'API Key', type: 'password', placeholder: 'AIza...', helper: 'Chave gerada no Google Cloud Console.' },
    ],
    manual: {
      title: 'Como obter a chave da YouTube Data API',
      docsUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
      steps: [
        { title: '1. Acessar o Google Cloud Console', description: 'Entre em console.cloud.google.com e crie (ou selecione) um projeto.' },
        { title: '2. Ativar a YouTube Data API v3', description: 'Em "APIs e serviços → Biblioteca", busque por "YouTube Data API v3" e clique em Ativar.' },
        { title: '3. Criar credencial', description: 'Vá em "APIs e serviços → Credenciais → Criar credenciais → Chave de API". Copie a chave gerada.' },
        { title: '4. Restringir a chave (recomendado)', description: 'Em "Restrições de aplicativo" deixe "Nenhuma" ou restrinja por IP do servidor. Em "Restrições de API" selecione apenas "YouTube Data API v3".' },
        { title: '5. Colar e salvar abaixo', description: 'Cole a chave no campo API Key e clique em Salvar.' },
      ],
    },
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    description: 'Processamento de pagamentos para compra de créditos e assinaturas dos planos.',
    icon: BookOpen,
    fields: [
      { key: 'mercadopago_access_token', label: 'Access Token', type: 'password', placeholder: 'APP_USR-...' },
      { key: 'mercadopago_public_key', label: 'Public Key', type: 'text', placeholder: 'APP_USR-...' },
      { key: 'app_base_url', label: 'URL base do app', type: 'text', placeholder: 'https://seudominio.com', helper: 'Usada para gerar URLs de retorno após pagamento.' },
    ],
    manual: {
      title: 'Como obter as credenciais do Mercado Pago',
      docsUrl: 'https://www.mercadopago.com.br/developers/panel/app',
      steps: [
        { title: '1. Criar uma aplicação', description: 'Acesse o painel de desenvolvedores do Mercado Pago e crie uma aplicação do tipo "Pagamentos online".' },
        { title: '2. Copiar credenciais de produção', description: 'Em "Credenciais de produção", copie o Access Token e a Public Key.' },
        { title: '3. Configurar URL de retorno', description: 'Informe abaixo a URL pública do seu app (ex.: https://comment-catalyst-bot.lovable.app).' },
        { title: '4. Salvar', description: 'Cole os três valores nos campos correspondentes e clique em Salvar.' },
      ],
    },
  },
];

export function IntegrationsTab() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const allKeys = INTEGRATIONS.flatMap((i) => i.fields.map((f) => f.key));
      const { data } = await supabase.from('app_settings').select('key, value').in('key', allKeys);
      const v: Record<string, string> = {};
      const s: Record<string, boolean> = {};
      (data || []).forEach((row) => {
        v[row.key] = row.value;
        s[row.key] = !!row.value;
      });
      setValues(v);
      setSaved(s);
      setLoading(false);
    })();
  }, []);

  const upsert = async (key: string, value: string) => {
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).maybeSingle();
    if (existing) return supabase.from('app_settings').update({ value }).eq('key', key);
    return supabase.from('app_settings').insert({ key, value });
  };

  const saveIntegration = async (integration: IntegrationConfig) => {
    setSaving((p) => ({ ...p, [integration.id]: true }));
    const tasks = integration.fields
      .filter((f) => (values[f.key] || '').trim())
      .map((f) => upsert(f.key, (values[f.key] || '').trim()));
    const results = await Promise.all(tasks);
    setSaving((p) => ({ ...p, [integration.id]: false }));
    const err = results.find((r: any) => r?.error)?.error;
    if (err) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
      return;
    }
    const newSaved = { ...saved };
    integration.fields.forEach((f) => {
      newSaved[f.key] = !!(values[f.key] || '').trim();
    });
    setSaved(newSaved);
    toast({ title: `${integration.name} salvo com sucesso` });
  };

  const statusOf = (integration: IntegrationConfig): IntegrationStatus => {
    const filled = integration.fields.filter((f) => saved[f.key]).length;
    if (filled === 0) return 'disconnected';
    if (filled === integration.fields.length) return 'connected';
    return 'partial';
  };

  const statusBadge = (status: IntegrationStatus) => {
    if (status === 'connected') return <Badge className="bg-green-500/15 text-green-400 border-green-500/30"><CheckCircle2 size={12} className="mr-1" />Conectado</Badge>;
    if (status === 'partial') return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30"><AlertCircle size={12} className="mr-1" />Parcial</Badge>;
    return <Badge variant="outline"><AlertCircle size={12} className="mr-1" />Não configurado</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertTitle>Integrações externas</AlertTitle>
        <AlertDescription>
          Configure aqui os serviços externos usados pela plataforma. Cada integração tem um manual passo-a-passo dentro do card. Credenciais são armazenadas com segurança e usadas apenas pelos serviços do servidor.
        </AlertDescription>
      </Alert>

      {INTEGRATIONS.map((integration) => {
        const status = statusOf(integration);
        const Icon = integration.icon;
        return (
          <Card key={integration.id} className="glass p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Icon className="text-primary" size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base">{integration.name}</h3>
                    {statusBadge(status)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{integration.description}</p>
                </div>
              </div>
              {integration.manual.docsUrl && (
                <a href={integration.manual.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
                  Documentação <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 mb-4">
              {integration.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key} className="text-xs flex items-center gap-2">
                    {field.label}
                    {saved[field.key] && <CheckCircle2 size={12} className="text-green-400" />}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={field.key}
                      type={field.type}
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
                    />
                    {values[field.key] && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(values[field.key]);
                          toast({ title: 'Copiado' });
                        }}
                      >
                        <Copy size={14} />
                      </Button>
                    )}
                  </div>
                  {field.helper && <p className="text-[11px] text-muted-foreground">{field.helper}</p>}
                </div>
              ))}
            </div>

            <div className="flex justify-end mb-2">
              <Button onClick={() => saveIntegration(integration)} disabled={saving[integration.id]} size="sm">
                {saving[integration.id] ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />}
                Salvar {integration.name}
              </Button>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="manual" className="border-b-0">
                <AccordionTrigger className="text-sm hover:no-underline py-2">
                  <span className="flex items-center gap-2">
                    <BookOpen size={14} />
                    {integration.manual.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-3 pl-1">
                    {integration.manual.steps.map((step, idx) => (
                      <li key={idx} className="border-l-2 border-primary/30 pl-3">
                        <div className="font-medium text-sm">{step.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{step.description}</div>
                      </li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        );
      })}
    </div>
  );
}
