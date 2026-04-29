import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useUserAddons } from '@/hooks/useUserAddons';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, Loader2, Coins, CreditCard, Crown, FileText, Palette, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ICONS: Record<string, any> = { Sparkles, FileText, Palette, Zap, Crown };


const AddonsPage = () => {
  const { addons, userAddons, loading, refresh, hasAddon } = useUserAddons();
  const { profile } = useAuth();
  const { credits, refresh: refreshCredits } = useCredits();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [planAddons, setPlanAddons] = useState<Record<string, { discount_percent: number; included_free: boolean }>>({});
  const [searchParams, setSearchParams] = useSearchParams();

  // Load plan-addon discounts (corrigido: useEffect ao invés de useState mal usado)
  useEffect(() => {
    if (!profile?.plan) return;
    supabase.from('plan_addons').select('addon_id, discount_percent, included_free').eq('plan', profile.plan).then(({ data }) => {
      const m: any = {};
      (data || []).forEach((r: any) => { m[r.addon_id] = r; });
      setPlanAddons(m);
    });
  }, [profile?.plan]);

  // Detecta retorno do Mercado Pago e faz polling até o webhook ativar o addon
  useEffect(() => {
    const mpStatus = searchParams.get('status') || searchParams.get('collection_status');
    if (!mpStatus) return;

    if (mpStatus === 'approved') {
      toast({ title: 'Pagamento aprovado!', description: 'Ativando seu add-on…' });
      let attempts = 0;
      const baselineActive = userAddons.filter(u => u.status === 'active').length;
      const interval = setInterval(async () => {
        attempts++;
        await refresh();
        const { data: ua } = await supabase.from('user_addons').select('id').eq('status', 'active');
        const newCount = ua?.length || 0;
        if (newCount > baselineActive || attempts >= 10) {
          clearInterval(interval);
          if (newCount > baselineActive) {
            toast({ title: 'Add-on ativado!' });
          } else {
            toast({ title: 'Processamento em andamento', description: 'Pode levar alguns minutos para refletir.' });
          }
          const sp = new URLSearchParams(searchParams);
          ['status','collection_status','payment_id','preference_id','payment_type','merchant_order_id','collection_id'].forEach(k => sp.delete(k));
          setSearchParams(sp, { replace: true });
        }
      }, 2000);
      return () => clearInterval(interval);
    } else if (mpStatus === 'pending' || mpStatus === 'in_process') {
      toast({ title: 'Pagamento em processamento', description: 'Add-on será liberado quando aprovado.' });
    } else if (mpStatus === 'rejected' || mpStatus === 'failure' || mpStatus === 'cancelled') {
      toast({ title: 'Pagamento não concluído', variant: 'destructive' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyWithMP = async (addonId: string) => {
    setBusy(addonId);
    try {
      const { data, error } = await supabase.functions.invoke('create-mp-preference', { body: { addon_id: addonId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.free) {
        toast({ title: 'Add-on ativado!', description: 'Incluído no seu plano.' });
        await refresh();
      } else if ((data as any)?.init_point) {
        window.location.href = (data as any).init_point;
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const buyWithCredits = async (addonId: string, cost: number) => {
    if ((credits?.balance ?? 0) < cost) {
      toast({ title: 'Créditos insuficientes', description: `Você precisa de ${cost} créditos.`, variant: 'destructive' });
      return;
    }
    setBusy(addonId);
    try {
      const { data, error } = await supabase.rpc('activate_addon_with_credits', { _addon_id: addonId });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || 'Falha ao ativar');
      toast({ title: 'Add-on ativado!' });
      await refresh();
      await refreshCredits();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const renderAddon = (addon: any) => {
    const Icon = ICONS[addon.icon || 'Sparkles'] || Sparkles;
    const owned = hasAddon(addon.slug);
    const ua = userAddons.find(u => u.addon_id === addon.id);
    const planMeta = planAddons[addon.id];
    const finalPrice = planMeta?.included_free ? 0 : (planMeta?.discount_percent ? addon.price_brl * (1 - planMeta.discount_percent / 100) : addon.price_brl);

    return (
      <Card key={addon.id} className="p-6 flex flex-col gap-4 border-2 hover:border-primary/40 transition">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading text-lg font-bold">{addon.name}</h3>
              {addon.billing_type === 'monthly' && <Badge variant="secondary">Mensal</Badge>}
              {addon.billing_type === 'one_time' && <Badge variant="outline">Taxa única</Badge>}
              {planMeta?.included_free && <Badge className="bg-green-600">Incluso no plano</Badge>}
              {planMeta?.discount_percent && !planMeta.included_free ? <Badge className="bg-amber-600">-{planMeta.discount_percent}%</Badge> : null}
            </div>
            {addon.description && <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>}
          </div>
        </div>

        {addon.features?.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {addon.features.map((f: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-4 border-t border-border">
          {owned ? (
            <div className="space-y-2">
              <Badge className="bg-green-600 w-full justify-center py-2">Ativo</Badge>
              {ua?.expires_at && (
                <p className="text-xs text-muted-foreground text-center">
                  Expira em {new Date(ua.expires_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  {planMeta?.discount_percent && !planMeta.included_free ? (
                    <div>
                      <span className="text-sm line-through text-muted-foreground">R$ {Number(addon.price_brl).toFixed(2)}</span>
                      <div className="text-2xl font-bold text-primary">R$ {finalPrice.toFixed(2)}</div>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold">R$ {Number(addon.price_brl).toFixed(2)}</div>
                  )}
                  {addon.billing_type === 'monthly' && <span className="text-xs text-muted-foreground">/mês</span>}
                </div>
                {addon.credits_cost > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">ou</div>
                    <div className="text-lg font-bold flex items-center gap-1"><Coins className="h-4 w-4" />{addon.credits_cost}</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => buyWithMP(addon.id)} disabled={busy === addon.id}>
                  {busy === addon.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {planMeta?.included_free ? 'Ativar grátis' : 'Comprar'}
                </Button>
                {addon.credits_cost > 0 && !planMeta?.included_free && (
                  <Button variant="outline" onClick={() => buyWithCredits(addon.id, addon.credits_cost)} disabled={busy === addon.id}>
                    <Coins className="h-4 w-4" /> Créditos
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Recursos Adicionais
          </h1>
          <p className="text-muted-foreground mt-1">Add-ons para potencializar suas criações.</p>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="mine">Meus Add-ons</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {loading ? (
              <div className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : addons.length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">Nenhum add-on disponível ainda.</Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{addons.map(renderAddon)}</div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-4">
            {userAddons.filter(u => u.status === 'active').length === 0 ? (
              <Card className="p-12 text-center text-muted-foreground">Você ainda não comprou nenhum add-on.</Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {addons.filter(a => userAddons.some(u => u.addon_id === a.id && u.status === 'active')).map(renderAddon)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AddonsPage;
