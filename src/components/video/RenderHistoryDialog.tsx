import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, Loader, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { loadLastRender, type StoredRender } from '@/lib/lastRenderStore';

type Row = {
  id: string;
  content_id: string | null;
  format_ratio: string;
  width: number;
  height: number;
  codec: string;
  container: string;
  bitrate_kbps: number;
  duration_seconds: number;
  scenes_count: number;
  credits_spent: number;
  status: string;
  progress: number;
  phase: string | null;
  message: string | null;
  file_size_bytes: number | null;
  preset_name: string | null;
  created_at: string;
  updated_at: string;
};

export const RenderHistoryDialog = ({
  open, onOpenChange, contentId, activeRender,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentId?: string;
  activeRender?: { progress: number; phase: string; eta: string } | null;
}) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [stored, setStored] = useState<StoredRender | null>(null);

  const load = async () => {
    let q = supabase.from('video_render_history' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (contentId) q = q.eq('content_id', contentId);
    const { data } = await q;
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    load();
    loadLastRender().then(setStored);

    // Realtime subscription for live progress updates
    const channel = supabase
      .channel('video_render_history_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'video_render_history' },
        (payload) => {
          setRows((prev) => {
            const newRow = (payload.new as Row) || null;
            const oldRow = (payload.old as Row) || null;
            if (payload.eventType === 'DELETE' && oldRow) {
              return prev.filter((r) => r.id !== oldRow.id);
            }
            if (!newRow) return prev;
            if (contentId && newRow.content_id !== contentId) return prev;
            const idx = prev.findIndex((r) => r.id === newRow.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = newRow;
              return next;
            }
            return [newRow, ...prev].slice(0, 30);
          });
          // Refresh stored blob when a render finishes
          if ((payload.new as Row)?.status === 'done') {
            loadLastRender().then(setStored);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, contentId]);

  const remove = async (id: string) => {
    await supabase.from('video_render_history' as any).delete().eq('id', id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const downloadStored = (row: Row) => {
    if (!stored || stored.sizeBytes !== row.file_size_bytes) return;
    const url = URL.createObjectURL(stored.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = stored.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const fmtBytes = (b: number | null) => {
    if (!b) return '—';
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };
  const fmtDate = (s: string) => new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Renderização</DialogTitle>
        </DialogHeader>

        {activeRender && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {activeRender.phase || 'Renderizando'}
              </span>
              <span className="text-xs text-muted-foreground">{activeRender.eta}</span>
            </div>
            <Progress value={activeRender.progress} />
            <div className="text-right text-xs text-muted-foreground">{activeRender.progress}%</div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma renderização ainda.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => {
              const canDownload = r.status === 'done'
                && stored
                && stored.contentId === r.content_id
                && stored.sizeBytes === r.file_size_bytes;
              return (
              <div key={r.id} className="rounded-lg border border-border p-3 bg-card space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.status === 'done' ? (
                      canDownload ? (
                        <button
                          onClick={() => downloadStored(r)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-2 py-1 text-xs font-medium transition-colors"
                          title="Baixar arquivo"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Baixar
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 text-emerald-500 px-2 py-1 text-xs font-medium" title="Arquivo não disponível mais nesta sessão">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Concluído
                        </span>
                      )
                    ) : r.status === 'error' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 text-destructive px-2 py-1 text-xs font-medium">
                        <XCircle className="h-3.5 w-3.5" />
                        Erro
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-medium">
                        <Loader className="h-3.5 w-3.5 animate-spin" />
                        Renderizando
                      </span>
                    )}
                    <span className="text-sm font-medium">{r.format_ratio} · {r.width}×{r.height}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{r.container} / {r.codec}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{r.bitrate_kbps} kbps</Badge>
                    {r.preset_name && <Badge variant="outline" className="text-[10px]">{r.preset_name}</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {r.status === 'rendering' && (
                  <div className="space-y-1">
                    <Progress value={r.progress} />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{r.phase || '—'}</span>
                      <span>{r.progress}%</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                  <div><span className="block text-foreground/60">Duração</span>{r.duration_seconds.toFixed(1)}s</div>
                  <div><span className="block text-foreground/60">Cenas</span>{r.scenes_count}</div>
                  <div><span className="block text-foreground/60">Créditos</span>{r.credits_spent}</div>
                  <div><span className="block text-foreground/60">Tamanho</span>{fmtBytes(r.file_size_bytes)}</div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border">
                  <span>{fmtDate(r.created_at)}</span>
                  {r.message && <span className="truncate max-w-[60%]" title={r.message}>{r.message}</span>}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
