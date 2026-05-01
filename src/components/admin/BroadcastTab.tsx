import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Megaphone, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

type Tpl = { id: string; key: string; name: string };
type BC = { id: string; template_id: string; audience: string; total_recipients: number; sent_count: number; failed_count: number; status: string; created_at: string };

export function BroadcastTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [history, setHistory] = useState<BC[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    const { data } = await supabase.from('email_broadcasts').select('*').order('created_at', { ascending: false }).limit(20);
    setHistory((data || []) as BC[]);
  };

  useEffect(() => {
    (async () => {
      const { data: tpls } = await supabase.from('email_templates').select('id, key, name').eq('enabled', true).order('name');
      setTemplates((tpls || []) as Tpl[]);
      if (tpls && tpls.length > 0) setTemplateId(tpls[0].id);
      await loadHistory();
      setLoading(false);
    })();
  }, []);

  const send = async () => {
    if (!templateId) return;
    if (!confirm(`Enviar broadcast para o público "${audience}"? Esta ação não pode ser desfeita.`)) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-broadcast-email', {
      body: { templateId, audience },
    });
    setSending(false);
    if (error || !(data as any)?.ok) {
      toast({ title: 'Falha', description: error?.message || (data as any)?.error || 'Erro', variant: 'destructive' });
    } else {
      toast({ title: 'Broadcast enviado', description: `${(data as any).sent}/${(data as any).total} enviados.` });
      loadHistory();
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  const tpl = templates.find(t => t.id === templateId);

  return (
    <div className="space-y-4">
      <Card className="glass p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="text-primary" size={20} />
          <h3 className="font-semibold">Enviar broadcast manual</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Público</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                <SelectItem value="plan:free">Apenas plano Free</SelectItem>
                <SelectItem value="plan:pro">Apenas plano Pro</SelectItem>
                <SelectItem value="plan:enterprise">Apenas plano Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {tpl && <p className="text-[11px] text-muted-foreground">Template selecionado: <code className="text-primary">{tpl.key}</code></p>}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button onClick={send} disabled={sending || !templateId}>
            {sending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Send className="mr-2" size={14} />}
            Enviar agora
          </Button>
        </div>
      </Card>

      <Card className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <History className="text-primary" size={18} />
          <h3 className="font-semibold text-sm">Histórico de broadcasts</h3>
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum broadcast enviado ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {history.map(h => {
              const t = templates.find(x => x.id === h.template_id);
              return (
                <div key={h.id} className="flex items-center justify-between gap-2 text-xs rounded-md bg-background/40 px-3 py-2">
                  <div>
                    <div className="font-medium">{t?.name || h.template_id.slice(0, 8)}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString('pt-BR')} • {h.audience}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">{h.sent_count} enviados</Badge>
                    {h.failed_count > 0 && <Badge variant="outline" className="text-destructive border-destructive/30">{h.failed_count} falhas</Badge>}
                    <Badge variant={h.status === 'completed' ? 'default' : 'secondary'}>{h.status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
