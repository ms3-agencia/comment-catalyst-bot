import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, Check, Sparkles, Zap, Crown, Loader2, ShoppingCart, History, ArrowDownCircle, ArrowUpCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Pkg = { id: string; name: string; credits: number; price_brl: number; sort_order: number };
type Plan = { plan: 'free' | 'pro' | 'enterprise'; display_name: string; monthly_credits: number; price_brl: number; description: string | null };
type Tx = { id: string; amount: number; type: string; description: string | null; created_at: string };

const planIcon = (p: string) => p === 'enterprise' ? Crown : p === 'pro' ? Zap : Sparkles;

const Credits = () => {
  const { profile } = useAuth();
  const { credits } = useCredits();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [pkgRes, planRes, txRes] = await Promise.all([
        supabase.from('credit_packages').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('plan_configs').select('*').order('price_brl'),
        supabase.from('credit_transactions').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      setPackages((pkgRes.data as Pkg[]) || []);
      setPlans((planRes.data as Plan[]) || []);
      setTransactions((txRes.data as Tx[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const buyPackage = async (pkg: Pkg) => {
    setBuying(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-mp-preference', {
        body: { package_id: pkg.id },
      });
      let serverError: string | null = null;
      if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            serverError = body?.error || body?.message || null;
          }
        } catch { /* ignore */ }
        throw new Error(serverError || error.message || 'Falha ao iniciar pagamento');
      }
      if (data?.init_point) {
        window.location.href = data.init_point;
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (err: any) {
      const msg = err.message || '';
      const isNotConfigured = /mercado\s*pago.*n[ãa]o\s*configurado/i.test(msg);
      toast({
        title: 'Pagamento por cartão indisponível',
        description: isNotConfigured
          ? 'O Mercado Pago ainda não foi configurado pelo administrador. Por favor, contate o suporte.'
          : msg || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setBuying(null);
    }
  };

  const handleUpgrade = async (plan: Plan) => {
    setBuying(`plan:${plan.plan}`);
    try {
      const { data, error } = await supabase.functions.invoke('create-mp-preference', {
        body: { plan: plan.plan },
      });

      let serverError: string | null = null;
      if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            serverError = body?.error || body?.message || null;
          }
        } catch { /* ignore */ }
        throw new Error(serverError || error.message || 'Falha ao iniciar pagamento');
      }

      if (data?.init_point) {
        window.location.href = data.init_point;
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (err: any) {
      const msg = err.message || '';
      const isNotConfigured = /mercado\s*pago.*n[ãa]o\s*configurado/i.test(msg);
      toast({
        title: 'Pagamento por cartão indisponível',
        description: isNotConfigured
          ? 'O Mercado Pago ainda não foi configurado pelo administrador. Por favor, contate o suporte.'
          : msg || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setBuying(null);
    }
  };

  const balance = credits?.balance ?? 0;
  const allocation = credits?.monthly_allocation ?? 0;
  const resetDate = credits?.monthly_reset_at ? new Date(credits.monthly_reset_at) : null;

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Coins size={24} className="text-primary" /> Créditos & Planos</h1>
          <p className="text-muted-foreground mt-1">Acompanhe seu saldo, compre pacotes ou faça upgrade do plano</p>
        </div>

        {/* Saldo atual */}
        <Card className="glass p-6 sm:p-8 bg-gradient-to-br from-primary/10 via-card to-card border-primary/30">
          <div className="grid sm:grid-cols-3 gap-6 items-center">
            <div>
              <p className="text-sm text-muted-foreground">Saldo disponível</p>
              <p className="font-heading text-5xl font-bold mt-1 gradient-text">{balance.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-muted-foreground mt-1">de {allocation.toLocaleString('pt-BR')} mensais</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="font-heading text-2xl font-bold mt-1 capitalize">{profile?.plan}</p>
              <Badge variant="outline" className="mt-1">renovação {resetDate?.toLocaleDateString('pt-BR') || '—'}</Badge>
            </div>
            <div className="flex sm:justify-end">
              <Button size="lg" className="glow-primary" onClick={() => document.getElementById('pacotes')?.scrollIntoView({ behavior: 'smooth' })}>
                <ShoppingCart className="mr-2 h-4 w-4" /> Comprar créditos
              </Button>
            </div>
          </div>
        </Card>

        {/* Planos */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-bold flex items-center gap-2"><ShieldCheck size={20} className="text-primary" /> Planos de assinatura</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map(p => {
              const Icon = planIcon(p.plan);
              const current = profile?.plan === p.plan;
              const popular = p.plan === 'pro';
              return (
                <Card key={p.plan} className={`relative p-6 ${popular ? 'border-primary/60 glow-primary' : 'glass'}`}>
                  {popular && <Badge className="absolute -top-2 right-4 bg-primary">Mais popular</Badge>}
                  {current && <Badge variant="outline" className="absolute -top-2 left-4 border-success text-success">Plano atual</Badge>}
                  <div className="flex items-center gap-2">
                    <Icon className="text-primary" size={20} />
                    <h3 className="font-heading text-xl font-bold">{p.display_name}</h3>
                  </div>
                  <p className="mt-3 font-heading text-3xl font-bold">
                    {p.price_brl > 0 ? <>R$ {Number(p.price_brl).toFixed(2).replace('.', ',')}<span className="text-sm font-normal text-muted-foreground">/mês</span></> : 'Grátis'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" /> <strong>{p.monthly_credits.toLocaleString('pt-BR')}</strong> créditos/mês</li>
                    <li className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" /> Recargas avulsas disponíveis</li>
                    <li className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" /> Suporte e análise IA</li>
                  </ul>
                  <Button
                    className="w-full mt-5"
                    variant={current ? 'outline' : popular ? 'default' : 'outline'}
                    disabled={current || buying === `plan:${p.plan}`}
                    onClick={() => !current && handleUpgrade(p)}
                  >
                    {current
                      ? 'Plano ativo'
                      : buying === `plan:${p.plan}`
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando</>
                        : 'Fazer upgrade'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Pacotes avulsos */}
        <section id="pacotes" className="space-y-4 scroll-mt-24">
          <h2 className="font-heading text-xl font-bold flex items-center gap-2"><Coins size={20} className="text-primary" /> Pacotes de recarga</h2>
          {loading ? (
            <Card className="glass p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></Card>
          ) : packages.length === 0 ? (
            <Card className="glass p-8 text-center text-muted-foreground">Nenhum pacote disponível no momento.</Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {packages.map((pkg, idx) => {
                const featured = idx === 1;
                const pricePerCredit = pkg.price_brl / pkg.credits;
                return (
                  <Card key={pkg.id} className={`p-6 relative transition-all hover:scale-[1.02] ${featured ? 'border-primary/60 glow-primary' : 'glass'}`}>
                    {featured && <Badge className="absolute -top-2 right-4 bg-primary">Melhor valor</Badge>}
                    <h3 className="font-heading text-lg font-bold">{pkg.name}</h3>
                    <p className="font-heading text-4xl font-bold mt-2 gradient-text">
                      {pkg.credits.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground">créditos</p>
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="font-heading text-2xl font-bold">R$ {Number(pkg.price_brl).toFixed(2).replace('.', ',')}</p>
                      <p className="text-xs text-muted-foreground">≈ R$ {pricePerCredit.toFixed(3).replace('.', ',')}/crédito</p>
                    </div>
                    <Button
                      className={`w-full mt-5 ${featured ? 'glow-primary' : ''}`}
                      variant={featured ? 'default' : 'outline'}
                      onClick={() => buyPackage(pkg)}
                      disabled={buying === pkg.id}
                    >
                      {buying === pkg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                      Comprar
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Histórico */}
        <section className="space-y-4">
          <h2 className="font-heading text-xl font-bold flex items-center gap-2"><History size={20} /> Últimas transações</h2>
          <Card className="glass divide-y divide-border">
            {transactions.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Nenhuma transação ainda.</p>
            ) : transactions.map(tx => {
              const positive = tx.amount > 0;
              const Icon = tx.type === 'monthly_reset' ? RefreshCw : positive ? ArrowUpCircle : ArrowDownCircle;
              return (
                <div key={tx.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={18} className={positive ? 'text-success shrink-0' : 'text-destructive shrink-0'} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  <span className={`font-heading font-bold ${positive ? 'text-success' : 'text-destructive'}`}>
                    {positive ? '+' : ''}{tx.amount}
                  </span>
                </div>
              );
            })}
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default Credits;
