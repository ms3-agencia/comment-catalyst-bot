import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Save, Loader2, ExternalLink, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { TurnstileHostnamesPanel } from './TurnstileHostnamesPanel';

const KEYS = ['turnstile_enabled', 'turnstile_site_key', 'turnstile_secret_key'] as const;

export const SecurityTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [savedState, setSavedState] = useState({ site: false, secret: false });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', KEYS as unknown as string[]);
      const map = new Map((data || []).map((r: any) => [r.key, r.value]));
      setEnabled((map.get('turnstile_enabled') || '').toString().toLowerCase() === 'true');
      const sk = (map.get('turnstile_site_key') || '').toString();
      const ssk = (map.get('turnstile_secret_key') || '').toString();
      setSiteKey(sk);
      setSecretKey(ssk);
      setSavedState({ site: !!sk, secret: !!ssk });
      setLoading(false);
    })();
  }, []);

  const upsert = async (key: string, value: string) => {
    const { data: existing } = await supabase.from('app_settings').select('id').eq('key', key).maybeSingle();
    if (existing) return supabase.from('app_settings').update({ value }).eq('key', key);
    return supabase.from('app_settings').insert({ key, value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmedSite = siteKey.trim();
      const trimmedSecret = secretKey.trim();

      if (enabled && (!trimmedSite || !trimmedSecret)) {
        toast({
          title: 'Chaves obrigatórias',
          description: 'Para ativar o CAPTCHA é necessário preencher Site Key e Secret Key.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      await upsert('turnstile_site_key', trimmedSite);
      await upsert('turnstile_secret_key', trimmedSecret);
      await upsert('turnstile_enabled', enabled ? 'true' : 'false');

      setSavedState({ site: !!trimmedSite, secret: !!trimmedSecret });
      toast({
        title: 'Configuração salva',
        description: enabled
          ? 'CAPTCHA Turnstile ativo no login, registro e redefinição de senha.'
          : 'Configurações salvas. CAPTCHA está desativado.',
      });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-heading text-lg font-bold flex items-center gap-2">
              <Shield size={20} className="text-primary" /> Cloudflare Turnstile (CAPTCHA)
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Protege as telas de login, registro e recuperação de senha contra bots e ataques automatizados.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="turnstile-enabled" className="text-sm">
              {enabled ? 'Ativado' : 'Desativado'}
            </Label>
            <Switch id="turnstile-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <Alert className="bg-muted/30 border-primary/20">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertTitle>Como obter as chaves</AlertTitle>
          <AlertDescription className="text-sm space-y-1.5 mt-2">
            <p>
              1. Acesse o{' '}
              <a
                href="https://dash.cloudflare.com/?to=/:account/turnstile"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Painel da Cloudflare → Turnstile <ExternalLink size={12} />
              </a>
            </p>
            <p>2. Clique em <strong>Add Site</strong>, escolha o modo <strong>Managed</strong> (recomendado) ou <strong>Invisible</strong>.</p>
            <p>3. Adicione os domínios deste app (ex.: <code className="text-primary">ycaptura.ms3.com.br</code> e o domínio de preview).</p>
            <p>4. Copie a <strong>Site Key</strong> (pública) e a <strong>Secret Key</strong> (privada) e cole abaixo.</p>
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Site Key (pública)</Label>
            {savedState.site && (
              <Badge variant="outline" className="border-success text-success">
                <CheckCircle2 size={12} className="mr-1" /> Configurada
              </Badge>
            )}
          </div>
          <Input
            placeholder="0x4AAAAAAA..."
            value={siteKey}
            onChange={(e) => { setSiteKey(e.target.value); setSavedState((p) => ({ ...p, site: false })); }}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">Visível no frontend. Compatível com domínios cadastrados na Cloudflare.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Secret Key (privada — server-side)</Label>
            {savedState.secret && (
              <Badge variant="outline" className="border-success text-success">
                <CheckCircle2 size={12} className="mr-1" /> Configurada
              </Badge>
            )}
          </div>
          <div className="relative">
            <Input
              type={showSecret ? 'text' : 'password'}
              placeholder="0x4AAAAAAA..."
              value={secretKey}
              onChange={(e) => { setSecretKey(e.target.value); setSavedState((p) => ({ ...p, secret: false })); }}
              className="font-mono text-xs pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showSecret ? 'Ocultar' : 'Mostrar'}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Usada pelo backend para validar tokens com a Cloudflare.</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving} className="glow-primary">
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Salvar configuração</>
            )}
          </Button>
        </div>
      </Card>

      <Card className="glass p-6 space-y-3">
        <h3 className="font-heading text-base font-bold">Outras camadas de segurança ativas</h3>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>✓ Bloqueio temporário após 5 tentativas falhas em 15 minutos (30 min de lockout)</li>
          <li>✓ Validação de senha forte (mín. 8 caracteres, com maiúscula, minúscula e número)</li>
          <li>✓ Verificação de senhas vazadas (HIBP)</li>
          <li>✓ Auditoria de eventos sensíveis (audit_log)</li>
          <li>✓ Alertas por email em login de novo dispositivo</li>
          <li>✓ Headers de segurança (CSP, Referrer-Policy, X-Content-Type-Options)</li>
        </ul>
      </Card>

      <TurnstileHostnamesPanel />
    </div>
  );
};
