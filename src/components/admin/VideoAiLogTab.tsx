import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Film, ExternalLink, Search, AlertCircle, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type LogRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  content_id: string | null;
  provider: string;
  model: string | null;
  script: string | null;
  status: string;
  error_message: string | null;
  video_url: string | null;
  external_job_id: string | null;
  credits_spent: number;
  metadata: any;
  created_at: string;
};

const PROVIDER_LABEL: Record<string, string> = {
  runway: 'Runway ML',
  replicate: 'Replicate',
  stability: 'Stability AI',
  freesoragenerator: 'Free Sora Generator',
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge className="bg-green-500/15 text-green-400 border-green-500/30"><CheckCircle2 size={12} className="mr-1" />Concluído</Badge>;
  if (status === 'failed') return <Badge className="bg-red-500/15 text-red-400 border-red-500/30"><AlertCircle size={12} className="mr-1" />Falhou</Badge>;
  if (status === 'queued') return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30"><Clock size={12} className="mr-1" />Em fila</Badge>;
  return <Badge variant="outline"><Clock size={12} className="mr-1" />{status}</Badge>;
}

export function VideoAiLogTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('video_generation_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: 'Erro ao carregar logs', description: error.message, variant: 'destructive' });
    } else {
      setRows((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm('Remover este registro do log?')) return;
    const { error } = await supabase.from('video_generation_log').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.user_email || '').toLowerCase().includes(q) ||
      (r.provider || '').toLowerCase().includes(q) ||
      (r.script || '').toLowerCase().includes(q) ||
      (r.external_job_id || '').toLowerCase().includes(q)
    );
  });

  const stats = {
    total: rows.length,
    completed: rows.filter((r) => r.status === 'completed').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    queued: rows.filter((r) => r.status === 'queued' || r.status === 'pending').length,
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Film className="h-4 w-4" />
        <AlertTitle>Log de Geração de Vídeos por IA</AlertTitle>
        <AlertDescription>
          Histórico de todos os vídeos solicitados pelos usuários, com a IA escolhida, roteiro enviado, status e link do vídeo gerado.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="glass p-4"><div className="text-xs text-muted-foreground">Concluídos</div><div className="text-2xl font-bold text-green-400">{stats.completed}</div></Card>
        <Card className="glass p-4"><div className="text-xs text-muted-foreground">Em fila</div><div className="text-2xl font-bold text-blue-400">{stats.queued}</div></Card>
        <Card className="glass p-4"><div className="text-xs text-muted-foreground">Falharam</div><div className="text-2xl font-bold text-red-400">{stats.failed}</div></Card>
      </div>

      <Card className="glass p-4">
        <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
          <div className="flex gap-2 items-center flex-1 min-w-[200px]">
            <Search size={14} className="text-muted-foreground" />
            <Input placeholder="Buscar por e-mail, IA, roteiro..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
          <Button onClick={load} size="sm" variant="outline" disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span className="ml-1.5">Atualizar</span>
          </Button>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="border border-border rounded-lg p-3 bg-card/40 hover:bg-card/60 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[240px] space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="border-primary/40 text-primary">
                        <Film size={11} className="mr-1" />{PROVIDER_LABEL[r.provider] || r.provider}
                      </Badge>
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}</span>
                      <span className="text-xs text-muted-foreground">• {r.credits_spent} créditos</span>
                    </div>
                    <div className="text-xs text-muted-foreground"><strong>Usuário:</strong> {r.user_email || r.user_id}</div>
                    {r.model && <div className="text-xs text-muted-foreground"><strong>Modelo:</strong> {r.model}</div>}
                    {r.external_job_id && <div className="text-xs text-muted-foreground font-mono"><strong>Job:</strong> {r.external_job_id}</div>}
                    {r.script && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver roteiro enviado</summary>
                        <pre className="mt-2 p-2 bg-muted/40 rounded text-foreground/90 whitespace-pre-wrap break-words max-h-40 overflow-auto">{r.script}</pre>
                      </details>
                    )}
                    {r.error_message && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5 mt-1">
                        <strong>Erro:</strong> {r.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {r.video_url && (
                      <a href={r.video_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline"><ExternalLink size={12} className="mr-1" />Abrir vídeo</Button>
                      </a>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 size={12} className="mr-1" />Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
