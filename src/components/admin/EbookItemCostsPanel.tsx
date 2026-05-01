import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Coins, RefreshCw } from 'lucide-react';

type ItemCost = {
  id: string;
  item_key: string;
  display_name: string;
  description: string | null;
  cost_per_chapter: number;
  enabled: boolean;
  sort_order: number;
};

type PlanRow = {
  id: string;
  plan: 'free' | 'pro' | 'enterprise';
  display_name: string;
  ebook_cost_multiplier: number;
};

export function EbookItemCostsPanel() {
  const { toast } = useToast();
  const [items, setItems] = useState<ItemCost[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const reseed = async () => {
    setSeeding(true);
    const { data, error } = await supabase.rpc('admin_seed_ebook_item_costs' as any);
    if (error) toast({ title: 'Erro ao ressincronizar', description: error.message, variant: 'destructive' });
    else {
      const r: any = data;
      toast({ title: 'Itens ressincronizados', description: `Inseridos: ${r?.inserted ?? 0} • Atualizados: ${r?.updated ?? 0}` });
      await load();
    }
    setSeeding(false);
  };

  const load = async () => {
    setLoading(true);
    const [{ data: i }, { data: p }] = await Promise.all([
      supabase.from('ebook_item_costs').select('*').order('sort_order'),
      supabase.from('plan_configs').select('id, plan, display_name, ebook_cost_multiplier').order('price_brl'),
    ]);
    setItems((i || []) as any);
    setPlans((p || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateItem = async (id: string, patch: Partial<ItemCost>) => {
    setSavingId(id);
    const { error } = await supabase.from('ebook_item_costs').update(patch).eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } as ItemCost : it));
      toast({ title: 'Item atualizado' });
    }
    setSavingId(null);
  };

  const updatePlan = async (id: string, multiplier: number) => {
    setSavingPlan(id);
    const { error } = await supabase.from('plan_configs').update({ ebook_cost_multiplier: multiplier }).eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else {
      setPlans(prev => prev.map(p => p.id === id ? { ...p, ebook_cost_multiplier: multiplier } : p));
      toast({ title: 'Multiplicador salvo' });
    }
    setSavingPlan(null);
  };

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Coins className="h-5 w-5 text-amber-400" />
          <h3 className="font-semibold">Multiplicador de custo por plano</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Aplica-se ao custo total dos itens ativos do template. Ex.: Free 1.0 cobra integral, Pro 0.5 cobra metade, Enterprise 0.2 cobra 20%.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {plans.map(p => (
            <div key={p.id} className="p-3 rounded-md border space-y-2">
              <Label className="capitalize">{p.display_name || p.plan}</Label>
              <div className="flex gap-2">
                <Input
                  type="number" step="0.1" min={0} max={5}
                  value={p.ebook_cost_multiplier}
                  onChange={e => setPlans(prev => prev.map(pl => pl.id === p.id ? { ...pl, ebook_cost_multiplier: Number(e.target.value) } : pl))}
                />
                <Button size="sm" onClick={() => updatePlan(p.id, p.ebook_cost_multiplier)} disabled={savingPlan === p.id}>
                  {savingPlan === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">x{p.ebook_cost_multiplier}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-1">Custo por item (créditos / capítulo)</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Esses créditos são somados ao custo base do capítulo (8) quando o item está ativo no template, multiplicado pelo plano do usuário.
        </p>
        <div className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-md border hover:bg-accent/30">
              <div className="col-span-5">
                <p className="text-sm font-medium">{it.display_name}</p>
                {it.description && <p className="text-xs text-muted-foreground">{it.description}</p>}
                <p className="text-[10px] text-muted-foreground font-mono">{it.item_key}</p>
              </div>
              <div className="col-span-3">
                <Input
                  type="number" min={0} max={50}
                  value={it.cost_per_chapter}
                  onChange={e => setItems(prev => prev.map(x => x.id === it.id ? { ...x, cost_per_chapter: Number(e.target.value) } : x))}
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch checked={it.enabled} onCheckedChange={v => updateItem(it.id, { enabled: v })} />
                <span className="text-xs text-muted-foreground">{it.enabled ? 'Ativo' : 'Off'}</span>
              </div>
              <div className="col-span-2 flex justify-end">
                <Button size="sm" onClick={() => updateItem(it.id, { cost_per_chapter: it.cost_per_chapter })} disabled={savingId === it.id}>
                  {savingId === it.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
