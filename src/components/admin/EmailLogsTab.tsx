import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Search, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type LogRow = {
  id: string;
  template_key: string | null;
  recipient_email: string;
  recipient_user_id: string | null;
  subject: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any; className?: string }> = {
  sent: { label: 'Enviado', variant: 'default', icon: CheckCircle2, className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  failed: { label: 'Falhou', variant: 'destructive', icon: XCircle },
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  skipped: { label: 'Ignorado', variant: 'outline', icon: AlertCircle },
};

const PAGE_SIZE = 50;

export function EmailLogsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [templateOptions, setTemplateOptions] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0, skipped: 0 });
  const [selected, setSelected] = useState<LogRow | null>(null);

  const loadStats = useCallback(async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from('email_send_log')
      .select('status')
      .gte('created_at', sevenDaysAgo);
    const counts = { total: 0, sent: 0, failed: 0, pending: 0, skipped: 0 };
    (data || []).forEach((r: any) => {
      counts.total++;
      if (r.status in counts) (counts as any)[r.status]++;
    });
    setStats(counts);
  }, []);

  const loadTemplateOptions = useCallback(async () => {
    const { data } = await supabase
      .from('email_send_log')
      .select('template_key')
      .not('template_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);
    const unique = Array.from(new Set((data || []).map((r: any) => r.template_key).filter(Boolean)));
    setTemplateOptions(unique as string[]);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('email_send_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    if (templateFilter !== 'all') q = q.eq('template_key', templateFilter);
    if (search.trim()) q = q.ilike('recipient_email', `%${search.trim()}%`);
    const { data, count, error } = await q;
    if (error) {
      toast({ title: 'Erro ao carregar logs', description: error.message, variant: 'destructive' });
    } else {
      setLogs((data || []) as LogRow[]);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, statusFilter, templateFilter, search, toast]);

  useEffect(() => { loadStats(); loadTemplateOptions(); }, [loadStats, loadTemplateOptions]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const refresh = () => { loadStats(); loadTemplateOptions(); loadLogs(); };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const meta = STATUS_META[status] || { label: status, variant: 'outline' as const, icon: AlertCircle };
    const Icon = meta.icon;
    return (
      <Badge variant={meta.variant} className={`gap-1 ${meta.className || ''}`}>
        <Icon size={12} />
        {meta.label}
      </Badge>
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total (7d)</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Enviados</div>
          <div className="text-2xl font-bold text-emerald-400">{stats.sent}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Falharam</div>
          <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pendentes</div>
          <div className="text-2xl font-bold text-muted-foreground">{stats.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Ignorados</div>
          <div className="text-2xl font-bold text-muted-foreground">{stats.skipped}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="failed">Falharam</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="skipped">Ignorados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={templateFilter} onValueChange={(v) => { setTemplateFilter(v); setPage(0); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os templates</SelectItem>
              {templateOptions.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" size={14} /> : <RefreshCw className="mr-2" size={14} />}
            Atualizar
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="animate-spin inline" size={18} /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum log encontrado</TableCell></TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelected(log)}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                  <TableCell className="text-xs"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.template_key || '-'}</code></TableCell>
                  <TableCell className="text-xs">{log.recipient_email}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{log.subject || '-'}</TableCell>
                  <TableCell><StatusBadge status={log.status} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8"><Eye size={14} /></Button></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {total > 0 && (
          <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
            <span>{total} registros · página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do envio</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">Data</div><div>{formatDate(selected.created_at)}</div></div>
                <div><div className="text-xs text-muted-foreground">Status</div><StatusBadge status={selected.status} /></div>
                <div><div className="text-xs text-muted-foreground">Template</div><code className="text-xs">{selected.template_key || '-'}</code></div>
                <div><div className="text-xs text-muted-foreground">Destinatário</div><div className="break-all">{selected.recipient_email}</div></div>
              </div>
              <div><div className="text-xs text-muted-foreground">Assunto</div><div>{selected.subject || '-'}</div></div>
              {selected.error_message && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Mensagem de erro</div>
                  <pre className="text-xs bg-destructive/10 text-destructive border border-destructive/30 p-3 rounded whitespace-pre-wrap break-all">{selected.error_message}</pre>
                </div>
              )}
              {selected.recipient_user_id && (
                <div><div className="text-xs text-muted-foreground">User ID</div><code className="text-xs">{selected.recipient_user_id}</code></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
