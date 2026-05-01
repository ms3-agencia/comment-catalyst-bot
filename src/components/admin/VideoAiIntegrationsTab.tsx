import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, AlertCircle, ExternalLink, Save, Loader2, BookOpen, Copy, Film, Wand2, Image as ImageIcon, Video, Power } from 'lucide-react';

type IntegrationStatus = 'connected' | 'disconnected';

type VideoProviderConfig = {
  id: string;
  name: string;
  description: string;
  icon: typeof Film;
  websiteUrl: string;
  apiKeyField: { key: string; label: string; placeholder: string; helper?: string };
  manual: { title: string; steps: { title: string; description: string }[] };
};

const VIDEO_AI_PROVIDERS: VideoProviderConfig[] = [
  {
    id: 'freesoragenerator',
    name: 'Free Sora Generator',
    description: 'Geração de vídeos via Sora API. Use para clipes curtos com prompt em texto.',
    icon: Wand2,
    websiteUrl: 'https://freesoragenerator.com/',
    apiKeyField: {
      key: 'video_ai_freesoragenerator_key',
      label: 'API Key',
      placeholder: 'sk-...',
      helper: 'Disponível no painel da conta em freesoragenerator.com.',
    },
    manual: {
      title: 'Como obter a chave do Free Sora Generator',
      steps: [
        { title: '1. Crie uma conta', description: 'Acesse freesoragenerator.com e cadastre-se.' },
        { title: '2. Acesse o painel de API', description: 'Vá em Settings → API Keys e gere uma nova chave.' },
        { title: '3. Cole abaixo e salve', description: 'A chave fica armazenada com segurança no servidor.' },
      ],
    },
  },
  {
    id: 'replicate',
    name: 'Replicate',
    description: 'Plataforma com diversos modelos de geração de vídeo (Zeroscope, AnimateDiff, etc.).',
    icon: Video,
    websiteUrl: 'https://replicate.com/',
    apiKeyField: {
      key: 'video_ai_replicate_key',
      label: 'API Token',
      placeholder: 'r8_...',
      helper: 'Token pessoal disponível em replicate.com/account/api-tokens.',
    },
    manual: {
      title: 'Como obter o token do Replicate',
      steps: [
        { title: '1. Crie a conta', description: 'Cadastre-se em replicate.com.' },
        { title: '2. Acesse API Tokens', description: 'replicate.com/account/api-tokens — copie o token (começa com r8_).' },
        { title: '3. Adicione créditos', description: 'Modelos pagos exigem saldo na sua conta.' },
      ],
    },
  },
  {
    id: 'stability',
    name: 'Stability AI',
    description: 'Stable Video Diffusion e modelos da Stability para vídeo e imagem.',
    icon: ImageIcon,
    websiteUrl: 'https://platform.stability.ai/',
    apiKeyField: {
      key: 'video_ai_stability_key',
      label: 'API Key',
      placeholder: 'sk-...',
      helper: 'Disponível em platform.stability.ai/account/keys.',
    },
    manual: {
      title: 'Como obter a chave da Stability AI',
      steps: [
        { title: '1. Conta e plano', description: 'Crie a conta em platform.stability.ai e ative os créditos.' },
        { title: '2. Gere a chave', description: 'Em Account → API Keys, clique em Create new key.' },
        { title: '3. Cole abaixo', description: 'Salve a chave no campo abaixo.' },
      ],
    },
  },
  {
    id: 'runway',
    name: 'Runway ML',
    description: 'Runway Gen-3 — geração de vídeo de alta qualidade via API oficial.',
    icon: Film,
    websiteUrl: 'https://dev.runwayml.com',
    apiKeyField: {
      key: 'video_ai_runway_key',
      label: 'API Key',
      placeholder: 'key_...',
      helper: 'Disponível em dev.runwayml.com (Developer Portal).',
    },
    manual: {
      title: 'Como obter a chave do Runway',
      steps: [
        { title: '1. Acesse o portal', description: 'Entre em dev.runwayml.com com sua conta Runway.' },
        { title: '2. Crie uma API Key', description: 'Em API Keys → Create new key.' },
        { title: '3. Cole abaixo', description: 'A chave começa com "key_".' },
      ],
    },
  },
];

export function VideoAiIntegrationsTab() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const allKeys = VIDEO_AI_PROVIDERS.map((p) => p.apiKeyField.key);
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

  const saveProvider = async (provider: VideoProviderConfig) => {
    const value = (values[provider.apiKeyField.key] || '').trim();
    if (!value) {
      toast({ title: 'Informe a chave da API', variant: 'destructive' });
      return;
    }
    setSaving((p) => ({ ...p, [provider.id]: true }));
    const result = await upsert(provider.apiKeyField.key, value);
    setSaving((p) => ({ ...p, [provider.id]: false }));
    if ((result as any)?.error) {
      toast({ title: 'Erro ao salvar', description: (result as any).error.message, variant: 'destructive' });
      return;
    }
    setSaved((p) => ({ ...p, [provider.apiKeyField.key]: true }));
    toast({ title: `${provider.name} salvo com sucesso` });
  };

  const statusBadge = (key: string) => {
    if (saved[key]) {
      return (
        <Badge className="bg-green-500/15 text-green-400 border-green-500/30">
          <CheckCircle2 size={12} className="mr-1" />Conectado
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <AlertCircle size={12} className="mr-1" />Não configurado
      </Badge>
    );
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
        <Film className="h-4 w-4" />
        <AlertTitle>IA de Vídeos — Integrações externas</AlertTitle>
        <AlertDescription>
          Configure as chaves dos provedores de geração de vídeo via IA. Cada provedor pode ser usado pelo sistema de roteamento em "Vídeo → Geração de vídeo". Credenciais são armazenadas com segurança e usadas apenas pelo servidor.
        </AlertDescription>
      </Alert>

      {VIDEO_AI_PROVIDERS.map((provider) => {
        const Icon = provider.icon;
        const fieldKey = provider.apiKeyField.key;
        const value = values[fieldKey] || '';
        return (
          <Card key={provider.id} className="glass p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Icon className="text-primary" size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base">{provider.name}</h3>
                    {statusBadge(fieldKey)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{provider.description}</p>
                </div>
              </div>
              <a
                href={provider.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                Site oficial <ExternalLink size={12} />
              </a>
            </div>

            <div className="space-y-1.5 mb-4">
              <Label htmlFor={fieldKey} className="text-xs flex items-center gap-2">
                {provider.apiKeyField.label}
                {saved[fieldKey] && <CheckCircle2 size={12} className="text-green-400" />}
              </Label>
              <div className="flex gap-2">
                <Input
                  id={fieldKey}
                  type="password"
                  placeholder={provider.apiKeyField.placeholder}
                  value={value}
                  onChange={(e) => {
                    setValues((p) => ({ ...p, [fieldKey]: e.target.value }));
                    setSaved((p) => ({ ...p, [fieldKey]: false }));
                  }}
                  className="font-mono text-xs"
                />
                {value && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(value);
                      toast({ title: 'Copiado' });
                    }}
                  >
                    <Copy size={14} />
                  </Button>
                )}
              </div>
              {provider.apiKeyField.helper && (
                <p className="text-[11px] text-muted-foreground">{provider.apiKeyField.helper}</p>
              )}
            </div>

            <div className="flex justify-end mb-2">
              <Button onClick={() => saveProvider(provider)} disabled={saving[provider.id]} size="sm">
                {saving[provider.id] ? (
                  <Loader2 className="animate-spin mr-2" size={14} />
                ) : (
                  <Save className="mr-2" size={14} />
                )}
                Salvar {provider.name}
              </Button>
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="manual" className="border-b-0">
                <AccordionTrigger className="text-sm hover:no-underline py-2">
                  <span className="flex items-center gap-2">
                    <BookOpen size={14} />
                    {provider.manual.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-3 pl-1">
                    {provider.manual.steps.map((step, idx) => (
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
