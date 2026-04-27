import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, RotateCcw, Trash2, Save, Download, Upload } from 'lucide-react';
import {
  listDraftVersions,
  createDraftVersion,
  deleteDraftVersion,
  type DraftVersion,
  type EditorDraftState,
} from '@/lib/videoEditorDraft';
import { useToast } from '@/hooks/use-toast';

const DRAFT_FILE_KIND = 'commentiq.video-editor-draft';
const DRAFT_FILE_VERSION = 1;

interface DraftVersionsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentId: string;
  /** Current editor state — used when the user clicks "Save current as version" */
  currentState: EditorDraftState;
  /** Called when the user restores a version. */
  onRestore: (state: EditorDraftState) => void;
}

export function DraftVersionsDialog({
  open,
  onOpenChange,
  contentId,
  currentState,
  onRestore,
}: DraftVersionsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const v = await listDraftVersions(contentId);
    setVersions(v);
    setLoading(false);
  };

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contentId]);

  const handleSaveCurrent = async () => {
    setSaving(true);
    const v = await createDraftVersion(contentId, currentState, label.trim() || undefined);
    setSaving(false);
    if (v) {
      setLabel('');
      toast({ title: 'Versão salva', description: `v${v.version} criada.` });
      refresh();
    } else {
      toast({ title: 'Erro ao salvar versão', variant: 'destructive' });
    }
  };

  const handleRestore = (v: DraftVersion) => {
    onRestore(v.state);
    toast({ title: 'Versão restaurada', description: `v${v.version}${v.label ? ` — ${v.label}` : ''}` });
    onOpenChange(false);
  };

  const handleDelete = async (v: DraftVersion) => {
    const ok = await deleteDraftVersion(v.id);
    if (ok) {
      setVersions(prev => prev.filter(x => x.id !== v.id));
    } else {
      toast({ title: 'Erro ao excluir versão', variant: 'destructive' });
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const payload = {
      kind: DRAFT_FILE_KIND,
      fileVersion: DRAFT_FILE_VERSION,
      contentId,
      exportedAt: new Date().toISOString(),
      state: currentState,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `editor-draft-${contentId.slice(0, 6)}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast({ title: 'Rascunho exportado', description: 'Salve o arquivo .json e importe em outro dispositivo.' });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const state: EditorDraftState | undefined =
        parsed?.kind === DRAFT_FILE_KIND ? parsed.state : (parsed?.scenes ? parsed : undefined);
      if (!state || !Array.isArray((state as any).scenes)) {
        throw new Error('Arquivo inválido: estrutura não reconhecida.');
      }
      if (parsed?.contentId && parsed.contentId !== contentId) {
        const ok = window.confirm(
          'Este rascunho foi exportado de outro conteúdo. Deseja importar mesmo assim? As cenas serão aplicadas ao conteúdo atual.'
        );
        if (!ok) return;
      }
      onRestore(state);
      // Also keep an automatic version checkpoint of the import.
      await createDraftVersion(contentId, state, `Importado ${new Date().toLocaleString()}`).catch(() => {});
      toast({ title: 'Rascunho importado', description: 'Edição carregada e salva como nova versão.' });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Falha ao importar',
        description: err?.message || 'Arquivo .json inválido.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico de versões
          </DialogTitle>
          <DialogDescription>
            Restaure uma versão anterior do editor. Mantemos as 20 versões mais recentes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Rótulo opcional (ex: 'antes do corte final')"
            value={label}
            onChange={e => setLabel(e.target.value)}
            disabled={saving}
            maxLength={80}
          />
          <Button onClick={handleSaveCurrent} disabled={saving} className="shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Salvar atual</>}
          </Button>
        </div>

        <ScrollArea className="h-[340px] pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhuma versão salva ainda. Clique em "Salvar atual" para criar uma.
            </p>
          ) : (
            <ul className="space-y-2">
              {versions.map(v => {
                const scenesCount = Array.isArray((v.state as any)?.scenes) ? (v.state as any).scenes.length : 0;
                const ratio = (v.state as any)?.format?.ratio || '—';
                return (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-2 rounded-md border p-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="font-mono">v{v.version}</Badge>
                        {v.label && <span className="text-sm font-medium truncate">{v.label}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(v.created_at).toLocaleString()} · {scenesCount} cena(s) · {ratio}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleRestore(v)} title="Restaurar">
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(v)}
                        title="Excluir versão"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
