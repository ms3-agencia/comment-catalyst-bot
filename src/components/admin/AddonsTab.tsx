import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, Sparkles, Settings, BookOpen } from 'lucide-react';
import { EbookConfigPanel } from '@/components/ebook/EbookConfigPanel';
import { EbookItemCostsPanel } from '@/components/admin/EbookItemCostsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Addon = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  price_brl: number;
  credits_cost: number;
  billing_type: 'one_time' | 'monthly';
  features: string[];
  is_active: boolean;
  sort_order: number;
};

type PlanAddon = { plan: string; addon_id: string; discount_percent: number; included_free: boolean };

const PLANS = ['free', 'pro', 'enterprise'] as const;
const ICONS = ['Sparkles', 'FileText', 'Palette', 'Zap', 'Crown'];

export const AddonsTab = () => {
  const { toast } = useToast();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [planAddons, setPlanAddons] = useState<PlanAddon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Addon> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [configuringSlug, setConfiguringSlug] = useState<string | null>(null);

  // Slugs that have a custom in-place configuration panel
  const CONFIGURABLE: Record<string, { label: string; icon: any; render: () => JSX.Element }> = {
    'ebook-generator': {
      label: 'Configurar templates de eBooks',
      icon: BookOpen,
      render: () => <EbookConfigPanel />,
    },
    'ebook-premium': {
      label: 'Configurar templates de eBooks',
      icon: BookOpen,
      render: () => <EbookConfigPanel />,
    },
  };

  const refresh = async () => {
    setLoading(true);
    const [{ data: a }, { data: pa }] = await Promise.all([
      supabase.from('addons').select('*').order('sort_order'),
      supabase.from('plan_addons').select('*'),
    ]);
    setAddons((a as Addon[]) || []);
    setPlanAddons((pa as PlanAddon[]) || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.slug) {
      toast({ title: 'Nome e slug são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        slug: editing.slug,
        name: editing.name,
        description: editing.description || null,
        icon: editing.icon || 'Sparkles',
        price_brl: Number(editing.price_brl) || 0,
        credits_cost: Number(editing.credits_cost) || 0,
        billing_type: editing.billing_type || 'one_time',
        features: editing.features || [],
        is_active: editing.is_active ?? true,
        sort_order: Number(editing.sort_order) || 0,
      };
      if (editing.id) {
        const { error } = await supabase.from('addons').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('addons').insert(payload);
        if (error) throw error;
      }
      toast({ title: 'Add-on salvo!' });
      setEditing(null);
      await refresh();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('addons').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Add-on removido' }); await refresh(); }
    setDeleteId(null);
  };

  const updatePlanAddon = async (plan: string, addonId: string, patch: Partial<PlanAddon>) => {
    const existing = planAddons.find(p => p.plan === plan && p.addon_id === addonId);
    if (existing) {
      await supabase.from('plan_addons').update(patch as any).eq('plan', plan as any).eq('addon_id', addonId);
    } else {
      await supabase.from('plan_addons').insert({ plan: plan as any, addon_id: addonId, discount_percent: 0, included_free: false, ...patch } as any);
    }
    await refresh();
  };

  const removePlanAddon = async (plan: string, addonId: string) => {
    await supabase.from('plan_addons').delete().eq('plan', plan as any).eq('addon_id', addonId);
    await refresh();
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Add-ons</h2>
          <p className="text-sm text-muted-foreground">Crie, edite e vincule add-ons a planos.</p>
        </div>
        <Button onClick={() => setEditing({ billing_type: 'one_time', is_active: true, features: [], icon: 'Sparkles' })}>
          <Plus className="h-4 w-4" /> Novo Add-on
        </Button>
      </div>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Cobrança</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {addons.map(a => {
              const cfg = CONFIGURABLE[a.slug];
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{a.slug}</TableCell>
                  <TableCell><Badge variant={a.billing_type === 'monthly' ? 'default' : 'secondary'}>{a.billing_type === 'monthly' ? 'Mensal' : 'Taxa única'}</Badge></TableCell>
                  <TableCell>R$ {Number(a.price_brl).toFixed(2)}</TableCell>
                  <TableCell>{a.credits_cost || '—'}</TableCell>
                  <TableCell>{a.is_active ? <Badge className="bg-green-600">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {cfg && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setConfiguringSlug(a.slug)}
                                aria-label={cfg.label}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">{cfg.label}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setEditing(a)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {addons.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum add-on criado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {/* In-place add-on configuration panel */}
      {configuringSlug && CONFIGURABLE[configuringSlug] && (
        <Card className="p-6 space-y-4 border-primary/30">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = CONFIGURABLE[configuringSlug].icon;
                return <Icon className="h-5 w-5 text-primary mt-0.5" />;
              })()}
              <div>
                <h3 className="font-heading font-semibold">{CONFIGURABLE[configuringSlug].label}</h3>
                <p className="text-sm text-muted-foreground">
                  Configurações do add-on <strong>{addons.find(a => a.slug === configuringSlug)?.name}</strong>. Templates globais disponíveis para todos os usuários com o add-on ativo.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConfiguringSlug(null)}>Fechar</Button>
          </div>
          <div className="pt-2 border-t">
            {CONFIGURABLE[configuringSlug].render()}
          </div>
        </Card>
      )}

      {/* Plan-Addon Linkage */}
      {addons.length > 0 && (
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-bold">Vínculo com Planos</h3>
            <p className="text-sm text-muted-foreground">Marque add-ons como inclusos ou aplique descontos por plano.</p>
          </div>
          <div className="space-y-4">
            {PLANS.map(plan => (
              <div key={plan} className="border rounded-lg p-4">
                <h4 className="font-semibold uppercase mb-3">{plan}</h4>
                <div className="grid gap-2">
                  {addons.map(a => {
                    const link = planAddons.find(p => p.plan === plan && p.addon_id === a.id);
                    return (
                      <div key={a.id} className="flex items-center gap-3 flex-wrap">
                        <span className="flex-1 text-sm">{a.name}</span>
                        <label className="flex items-center gap-2 text-sm">
                          <Switch checked={!!link?.included_free} onCheckedChange={(v) => updatePlanAddon(plan, a.id, { included_free: v, discount_percent: v ? 0 : (link?.discount_percent || 0) })} />
                          Grátis
                        </label>
                        <div className="flex items-center gap-1">
                          <Input type="number" min={0} max={100} value={link?.discount_percent || 0} onChange={(e) => updatePlanAddon(plan, a.id, { discount_percent: Number(e.target.value), included_free: false })} className="w-20" disabled={link?.included_free} />
                          <span className="text-xs text-muted-foreground">% off</span>
                        </div>
                        {link && <Button size="icon" variant="ghost" onClick={() => removePlanAddon(plan, a.id)}><Trash2 className="h-3 w-3" /></Button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Novo'} Add-on</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label>Slug (único)</Label>
                  <Input value={editing.slug || ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="ex: pdf-customization" />
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ícone</Label>
                  <Select value={editing.icon || 'Sparkles'} onValueChange={(v) => setEditing({ ...editing, icon: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ICONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de cobrança</Label>
                  <Select value={editing.billing_type || 'one_time'} onValueChange={(v: any) => setEditing({ ...editing, billing_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">Taxa única</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" value={editing.price_brl || 0} onChange={(e) => setEditing({ ...editing, price_brl: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Custo em créditos</Label>
                  <Input type="number" value={editing.credits_cost || 0} onChange={(e) => setEditing({ ...editing, credits_cost: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Ordem</Label>
                  <Input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Recursos (um por linha)</Label>
                <Textarea
                  value={(editing.features || []).join('\n')}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value.split('\n').filter(Boolean) })}
                  rows={4}
                  placeholder="Logo personalizado&#10;Cores customizadas&#10;Templates ilimitados"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remover add-on?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Isso também removerá vínculos com planos e ativações de usuários.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && remove(deleteId)}>Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
