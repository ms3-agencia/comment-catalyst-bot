import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  History, Coins, ArrowDownCircle, ArrowUpCircle, RefreshCw, ShoppingCart,
  Wand2, CalendarClock, TrendingDown, TrendingUp, Loader2,
} from 'lucide-react';

type Tx = {
  id: string;
  amount: number;
  type: string;
  action_key: string | null;
  description: string | null;
  reference_id: string | null;
  created_at: string;
};

const typeMeta = (t: string, amount: number) => {
  if (t === 'monthly_reset') return { label: 'Renovação mensal', icon: RefreshCw, color: 'text-primary' };
  if (t === 'admin_adjustment') return { label: 'Ajuste do admin', icon: Coins, color: amount >= 0 ? 'text-success' : 'text-destructive' };
  if (t === 'purchase') return { label: 'Compra de créditos', icon: ShoppingCart, color: 'text-success' };
  if (t === 'consumption') return { label: 'Consumo', icon: Wand2, color: 'text-destructive' };
  return { label: t, icon: amount >= 0 ? ArrowUpCircle : ArrowDownCircle, color: amount >= 0 ? 'text-success' : 'text-destructive' };
};

const CreditHistory = () => {
  const { user } = useAuth();
  const { credits, loading: creditsLoading } = useCredits();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      setTransactions((data as Tx[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const balance = credits?.balance ?? 0;
  const allocation = credits?.monthly_allocation ?? 0;
  const pct = allocation > 0 ? Math.min(100, (balance / allocation) * 100) : 0;
  const resetDate = credits?.monthly_reset_at ? new Date(credits.monthly_reset_at) : null;
  const daysToReset = resetDate ? Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  const consumption = transactions.filter(t => t.amount < 0);
  const incoming = transactions.filter(t => t.amount > 0);
  const totalConsumed = consumption.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalReceived = incoming.reduce((s, t) => s + t.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <History size={24} className="text-primary" /> Histórico de Créditos
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seu saldo, consumo e quando seus créditos serão renovados
          </p>
        </div>

        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass p-5 bg-gradient-to-br from-primary/10 via-card to-card border-primary/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              <Coins size={14} className="text-primary" /> Saldo atual
            </div>
            <p className="font-heading text-3xl font-bold mt-2 gradient-text">
              {creditsLoading ? '—' : balance.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              de {allocation.toLocaleString('pt-BR')} mensais
            </p>
            <Progress value={pct} className="h-1.5 mt-3" />
          </Card>

          <Card className="glass p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              <CalendarClock size={14} className="text-primary" /> Próxima renovação
            </div>
            <p className="font-heading text-2xl font-bold mt-2">
              {resetDate ? resetDate.toLocaleDateString('pt-BR') : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {daysToReset !== null ? `em ${daysToReset} dia${daysToReset === 1 ? '' : 's'}` : '—'}
            </p>
          </Card>

          <Card className="glass p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              <TrendingDown size={14} className="text-destructive" /> Total consumido
            </div>
            <p className="font-heading text-3xl font-bold mt-2 text-destructive">
              {totalConsumed.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {consumption.length} operação(ões)
            </p>
          </Card>

          <Card className="glass p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              <TrendingUp size={14} className="text-success" /> Total recebido
            </div>
            <p className="font-heading text-3xl font-bold mt-2 text-success">
              {totalReceived.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              renovações + recargas
            </p>
          </Card>
        </div>

        {/* Histórico de consumo */}
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-bold flex items-center gap-2">
            <Wand2 size={18} className="text-destructive" /> Histórico de consumo
          </h2>
          <Card className="glass">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : consumption.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Nenhum consumo registrado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumption.slice(0, 50).map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">
                        <Badge variant="outline" className="font-mono text-xs">
                          {tx.action_key || 'consumo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                        {tx.description || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right font-heading font-bold text-destructive">
                        {tx.amount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>

        {/* Todas as transações */}
        <section className="space-y-3">
          <h2 className="font-heading text-xl font-bold flex items-center gap-2">
            <History size={18} className="text-primary" /> Todas as transações
          </h2>
          <Card className="glass divide-y divide-border">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : transactions.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">Nenhuma transação ainda.</p>
            ) : transactions.map(tx => {
              const meta = typeMeta(tx.type, tx.amount);
              const Icon = meta.icon;
              const positive = tx.amount > 0;
              return (
                <div key={tx.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary ${meta.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {meta.label}
                        {tx.action_key && (
                          <span className="ml-2 text-xs text-muted-foreground font-mono">
                            ({tx.action_key})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tx.description || '—'} · {new Date(tx.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <span className={`font-heading font-bold whitespace-nowrap ${positive ? 'text-success' : 'text-destructive'}`}>
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

export default CreditHistory;
