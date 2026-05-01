import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, ArrowUpCircle, ArrowDownCircle, RefreshCw, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type AuditEntry = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  target_user_id: string;
  target_email: string | null;
  operation: 'add' | 'remove';
  amount: number;
  balance_before: number;
  balance_after: number;
  reason: string | null;
  created_at: string;
};

export const CreditAuditTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState<'all' | 'add' | 'remove'>('all');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('credit_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: 'Erro ao carregar log', description: error.message, variant: 'destructive' });
    } else {
      setEntries((data || []) as AuditEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    if (opFilter !== 'all' && e.operation !== opFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.target_email?.toLowerCase().includes(q) ||
      e.actor_email?.toLowerCase().includes(q) ||
      e.reason?.toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    const header = ['Data', 'Operação', 'Quantidade', 'Admin', 'Usuário', 'Saldo antes', 'Saldo depois', 'Motivo'];
    const rows = filtered.map(e => [
      new Date(e.created_at).toLocaleString('pt-BR'),
      e.operation === 'add' ? 'Adição' : 'Remoção',
      String(e.amount),
      e.actor_email || e.actor_user_id || '—',
      e.target_email || e.target_user_id,
      String(e.balance_before),
      String(e.balance_after),
      (e.reason || '').replace(/[\n\r,]+/g, ' '),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-creditos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalAdded = filtered.filter(e => e.operation === 'add').reduce((s, e) => s + e.amount, 0);
  const totalRemoved = filtered.filter(e => e.operation === 'remove').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Operações</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ArrowUpCircle size={12} className="text-green-500" /> Total adicionado
          </p>
          <p className="text-2xl font-bold text-green-500">+{totalAdded}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ArrowDownCircle size={12} className="text-destructive" /> Total removido
          </p>
          <p className="text-2xl font-bold text-destructive">-{totalRemoved}</p>
        </Card>
      </div>

      <Card className="glass p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por email do usuário, admin ou motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={opFilter === 'all' ? 'default' : 'outline'} onClick={() => setOpFilter('all')}>Todas</Button>
            <Button size="sm" variant={opFilter === 'add' ? 'default' : 'outline'} onClick={() => setOpFilter('add')}>Adições</Button>
            <Button size="sm" variant={opFilter === 'remove' ? 'default' : 'outline'} onClick={() => setOpFilter('remove')}>Remoções</Button>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download size={14} className="mr-1" /> CSV
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">
            Nenhuma operação encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left p-2 font-medium">Data</th>
                  <th className="text-left p-2 font-medium">Operação</th>
                  <th className="text-right p-2 font-medium">Qtd.</th>
                  <th className="text-left p-2 font-medium">Admin</th>
                  <th className="text-left p-2 font-medium">Usuário</th>
                  <th className="text-right p-2 font-medium">Saldo (antes → depois)</th>
                  <th className="text-left p-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-2 text-xs whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-2">
                      {e.operation === 'add' ? (
                        <Badge variant="outline" className="border-green-500/40 text-green-500">
                          <ArrowUpCircle size={11} className="mr-1" /> Adição
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          <ArrowDownCircle size={11} className="mr-1" /> Remoção
                        </Badge>
                      )}
                    </td>
                    <td className={`p-2 text-right font-mono font-semibold ${e.operation === 'add' ? 'text-green-500' : 'text-destructive'}`}>
                      {e.operation === 'add' ? '+' : '-'}{e.amount}
                    </td>
                    <td className="p-2 text-xs">{e.actor_email || <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2 text-xs">{e.target_email || e.target_user_id.slice(0, 8)}</td>
                    <td className="p-2 text-right text-xs font-mono text-muted-foreground">
                      {e.balance_before} → <span className="text-foreground font-semibold">{e.balance_after}</span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground max-w-[260px] truncate" title={e.reason || ''}>
                      {e.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
