import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, Trash2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Rule = {
  id: string;
  template_id: string;
  trigger_event: string;
  offset_days: number;
  send_hour: number;
  send_minute: number;
  conditions: Record<string, any>;
  enabled: boolean;
};

const TRIGGER_EVENTS = [
  { value: 'plan_renewal', label: 'Renovação de plano (offset relativo à data de renovação)' },
  { value: 'low_credits', label: 'Saldo de créditos baixo (verificação diária)' },
];

export function TemplateRulesEditor({ templateId }: { templateId: string }) {
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('email_template_rules').select('*').eq('template_id', templateId).order('offset_days');
    setRules((data || []) as Rule[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [templateId]);

  const addRule = async () => {
    const { error } = await supabase.from('email_template_rules').insert({
      template_id: templateId, trigger_event: 'plan_renewal', offset_days: -3, send_hour: 9, send_minute: 0, enabled: true,
    });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  const updateRule = async (id: string, patch: Partial<Rule>) => {
    setSaving(id);
    const { error } = await supabase.from('email_template_rules').update(patch).eq('id', id);
    setSaving(null);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Remover esta regra?')) return;
    const { error } = await supabase.from('email_template_rules').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={18} /></div>;

  return (
    <Card className="glass p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2"><Clock size={14} className="text-primary" /> Regras de envio automático</h4>
          <p className="text-[11px] text-muted-foreground">Cada regra define quando este template é enviado. O processador roda a cada 30 minutos.</p>
        </div>
        <Button size="sm" variant="outline" onClick={addRule}><Plus size={14} className="mr-1" /> Nova regra</Button>
      </div>

      {rules.length === 0 && (
        <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-md">
          Nenhuma regra. Adicione uma para que este template seja enviado automaticamente.
        </div>
      )}

      <div className="space-y-2">
        {rules.map(rule => (
          <div key={rule.id} className="rounded-md border border-border bg-background/40 p-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.6fr_0.6fr_auto] items-end">
              <div className="space-y-1">
                <Label className="text-[10px]">Evento</Label>
                <Select value={rule.trigger_event} onValueChange={v => updateRule(rule.id, { trigger_event: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_EVENTS.map(e => <SelectItem key={e.value} value={e.value} className="text-xs">{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Offset (dias)</Label>
                <Input type="number" className="h-8 text-xs" value={rule.offset_days}
                  onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, offset_days: parseInt(e.target.value) || 0 } : r))}
                  onBlur={e => updateRule(rule.id, { offset_days: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Hora</Label>
                <Input type="number" min={0} max={23} className="h-8 text-xs" value={rule.send_hour}
                  onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, send_hour: parseInt(e.target.value) || 0 } : r))}
                  onBlur={e => updateRule(rule.id, { send_hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Min</Label>
                <Input type="number" min={0} max={59} className="h-8 text-xs" value={rule.send_minute}
                  onChange={e => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, send_minute: parseInt(e.target.value) || 0 } : r))}
                  onBlur={e => updateRule(rule.id, { send_minute: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })} />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch checked={rule.enabled} onCheckedChange={v => updateRule(rule.id, { enabled: v })} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule(rule.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>

            {rule.trigger_event === 'low_credits' && (
              <div className="grid grid-cols-[160px_1fr] items-center gap-2">
                <Label className="text-[10px]">Limite (créditos)</Label>
                <Input type="number" className="h-8 text-xs w-32" defaultValue={(rule.conditions as any)?.threshold ?? 10}
                  onBlur={e => updateRule(rule.id, { conditions: { ...rule.conditions, threshold: parseInt(e.target.value) || 10 } })} />
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              {rule.trigger_event === 'plan_renewal' && (
                rule.offset_days === 0
                  ? `Envia no dia da renovação às ${String(rule.send_hour).padStart(2,'0')}:${String(rule.send_minute).padStart(2,'0')}.`
                  : rule.offset_days < 0
                    ? `Envia ${Math.abs(rule.offset_days)} dia(s) ANTES da renovação às ${String(rule.send_hour).padStart(2,'0')}:${String(rule.send_minute).padStart(2,'0')}.`
                    : `Envia ${rule.offset_days} dia(s) DEPOIS da renovação às ${String(rule.send_hour).padStart(2,'0')}:${String(rule.send_minute).padStart(2,'0')}.`
              )}
              {rule.trigger_event === 'low_credits' && ` Quando o saldo cair abaixo de ${(rule.conditions as any)?.threshold ?? 10} créditos.`}
              {saving === rule.id && ' • salvando…'}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
