import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Globe, RefreshCw, AlertTriangle, CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HostnameRow {
  hostname: string;
  first_seen: string;
  last_seen: string;
  hits: number;
  configured: boolean;
  last_error: string | null;
  last_error_at: string | null;
}

export const TurnstileHostnamesPanel = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<HostnameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('turnstile_hostnames')
      .select('*')
      .order('last_seen', { ascending: false });
    setRows((data as HostnameRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleConfigured = async (hostname: string, configured: boolean) => {
    setUpdating(hostname);
    const { data, error } = await supabase.rpc('admin_set_turnstile_hostname_configured', {
      _hostname: hostname,
      _configured: configured,
    });
    setUpdating(null);
    const result = data as { success?: boolean; error?: string } | null;
    if (error || !result?.success) {
      toast({
        title: 'Erro ao atualizar',
        description: result?.error || error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: configured ? 'Hostname marcado como OK' : 'Hostname desmarcado',
      description: hostname,
    });
    load();
  };

  const copyAll = async () => {
    const text = rows.map((r) => r.hostname).join('\n');
    await navigator.clipboard.writeText(text);
    toast({ title: 'Hostnames copiados', description: 'Cole na Cloudflare → Turnstile → Hostname Management.' });
  };

  const pendentes = rows.filter((r) => !r.configured);
  const comErro = rows.filter((r) => r.last_error && r.last_error.includes('110200'));

  return (
    <Card className="glass p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading text-lg font-bold flex items-center gap-2">
            <Globe size={20} className="text-primary" /> Sincronização de Hostnames (Turnstile)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cada domínio que carrega o widget é registrado aqui. Marque como configurado após adicioná-lo na Cloudflare.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyAll} disabled={rows.length === 0}>
            <Copy size={14} className="mr-2" /> Copiar lista
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>
      </div>

      {(pendentes.length > 0 || comErro.length > 0) && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {comErro.length > 0
              ? `${comErro.length} domínio(s) bloqueados pela Cloudflare (erro 110200)`
              : `${pendentes.length} hostname(s) ainda não confirmado(s)`}
          </AlertTitle>
          <AlertDescription className="text-sm mt-2 space-y-2">
            <p>Adicione os domínios abaixo no painel da Cloudflare:</p>
            <a
              href="https://dash.cloudflare.com/?to=/:account/turnstile"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Abrir Cloudflare Turnstile <ExternalLink size={12} />
            </a>
            <p className="text-xs text-muted-foreground">
              Editar widget → <strong>Hostname Management</strong> → adicionar cada domínio → Save.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum hostname registrado ainda. Acesse <code>/login</code> em cada domínio para registrar.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const erro110200 = r.last_error?.includes('110200');
            return (
              <div
                key={r.hostname}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                  erro110200 ? 'border-destructive/40 bg-destructive/5' : r.configured ? 'border-success/30 bg-success/5' : 'border-border bg-muted/20'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="font-mono text-sm break-all">{r.hostname}</code>
                    {r.configured ? (
                      <Badge variant="outline" className="border-success text-success text-xs">
                        <CheckCircle2 size={10} className="mr-1" /> OK
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-500 text-xs">Pendente</Badge>
                    )}
                    {erro110200 && <Badge variant="destructive" className="text-xs">Bloqueado (110200)</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.hits} acessos · visto {formatDistanceToNow(new Date(r.last_seen), { addSuffix: true, locale: ptBR })}
                    {r.last_error && <span className="text-destructive"> · último erro: {r.last_error}</span>}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={r.configured ? 'outline' : 'default'}
                  onClick={() => toggleConfigured(r.hostname, !r.configured)}
                  disabled={updating === r.hostname}
                >
                  {updating === r.hostname ? <Loader2 size={12} className="animate-spin" /> : r.configured ? 'Desmarcar' : 'Marcar OK'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
