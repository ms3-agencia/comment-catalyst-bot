import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { VideoEditor } from '@/components/VideoEditor';
import { VideoEditorErrorBoundary } from '@/components/VideoEditorErrorBoundary';
import {
  History as HistoryIcon, FileText, Clapperboard, Search, Trash2, RefreshCw, ArrowRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { deleteDraft } from '@/lib/videoEditorDraft';

type DraftRow = {
  id: string;
  content_id: string;
  updated_at: string;
  state: any;
  versions: number;
  content?: {
    id: string;
    title: string | null;
    caption: string | null;
    social_network: string;
    content_type: string;
    image_url: string | null;
    script: string | null;
    visual_idea: string | null;
  } | null;
};

export default function Drafts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [search, setSearch] = useState('');
  const [activePost, setActivePost] = useState<any | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // 1. drafts
    const { data: draftRows } = await supabase
      .from('video_editor_drafts' as any)
      .select('id, content_id, updated_at, state')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    const rows = (draftRows as any[]) || [];
    if (rows.length === 0) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    const contentIds = rows.map(r => r.content_id);

    // 2. content metadata
    const { data: contents } = await supabase
      .from('generated_contents')
      .select('id, title, caption, social_network, content_type, image_url, script, visual_idea')
      .in('id', contentIds);
    const byId = new Map((contents || []).map(c => [c.id, c]));

    // 3. version counts
    const { data: vers } = await supabase
      .from('video_editor_draft_versions' as any)
      .select('content_id')
      .eq('user_id', user.id)
      .in('content_id', contentIds);
    const versionCount = new Map<string, number>();
    ((vers as any[]) || []).forEach(v => {
      versionCount.set(v.content_id, (versionCount.get(v.content_id) || 0) + 1);
    });

    setDrafts(
      rows.map(r => ({
        id: r.id,
        content_id: r.content_id,
        updated_at: r.updated_at,
        state: r.state,
        versions: versionCount.get(r.content_id) || 0,
        content: (byId.get(r.content_id) as any) || null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const handleReopen = (d: DraftRow) => {
    if (!d.content) {
      toast({
        title: 'Conteúdo não encontrado',
        description: 'O conteúdo associado a este rascunho foi removido.',
        variant: 'destructive',
      });
      return;
    }
    setActivePost(d.content);
  };

  const handleDelete = async (d: DraftRow) => {
    if (!confirm('Excluir este rascunho? As versões salvas serão mantidas.')) return;
    await deleteDraft(d.content_id);
    setDrafts(prev => prev.filter(x => x.id !== d.id));
    toast({ title: 'Rascunho excluído' });
  };

  const filtered = drafts.filter(d => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.content?.title?.toLowerCase().includes(q) ||
      d.content?.caption?.toLowerCase().includes(q) ||
      d.content?.social_network?.toLowerCase().includes(q) ||
      d.content?.content_type?.toLowerCase().includes(q)
    );
  });

  const mostRecent = drafts[0];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold flex items-center gap-2">
              <HistoryIcon className="h-6 w-6 text-primary" /> Histórico de edições
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Rascunhos salvos automaticamente do editor de vídeo. Reabra de onde parou.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            {mostRecent && (
              <Button onClick={() => handleReopen(mostRecent)} className="gap-1.5">
                <Clapperboard className="h-4 w-4" /> Reabrir mais recente
              </Button>
            )}
          </div>
        </div>

        {/* Most recent highlight */}
        {!loading && mostRecent && (
          <Card className="p-4 border-primary/40 bg-primary/5">
            <div className="flex items-center gap-4 flex-wrap">
              {mostRecent.content?.image_url ? (
                <img
                  src={mostRecent.content.image_url}
                  alt=""
                  className="w-20 h-20 rounded-md object-cover bg-muted shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Badge variant="secondary" className="mb-1">Mais recente</Badge>
                <p className="font-semibold truncate">
                  {mostRecent.content?.title || 'Conteúdo sem título'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mostRecent.content?.social_network} · {mostRecent.content?.content_type} ·{' '}
                  Editado {new Date(mostRecent.updated_at).toLocaleString()}
                </p>
              </div>
              <Button onClick={() => handleReopen(mostRecent)} className="gap-1.5">
                Continuar edição <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, rede, tipo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            {drafts.length === 0 ? (
              <>
                Nenhum rascunho ainda. Vá para{' '}
                <Link to="/dashboard/generate" className="text-primary underline">Gerar Conteúdo</Link>{' '}
                e abra o editor de vídeo de algum conteúdo para começar.
              </>
            ) : (
              'Nenhum rascunho corresponde à sua busca.'
            )}
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(d => {
              const scenesCount = Array.isArray(d.state?.scenes) ? d.state.scenes.length : 0;
              const ratio = d.state?.format?.ratio || '—';
              return (
                <Card key={d.id} className="p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                  <div className="flex gap-3 min-w-0">
                    {d.content?.image_url ? (
                      <img src={d.content.image_url} alt="" className="w-14 h-14 rounded object-cover bg-muted shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{d.content?.title || 'Sem título'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.content?.social_network || '—'} · {d.content?.content_type || '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(d.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{scenesCount} cena(s)</Badge>
                    <Badge variant="outline" className="text-[10px]">{ratio}</Badge>
                    {d.versions > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{d.versions} versão(ões)</Badge>
                    )}
                    {!d.content && <Badge variant="destructive" className="text-[10px]">Conteúdo removido</Badge>}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Button
                      size="sm"
                      onClick={() => handleReopen(d)}
                      disabled={!d.content}
                      className="flex-1 gap-1.5"
                    >
                      <Clapperboard className="h-3.5 w-3.5" /> Reabrir
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(d)}
                      title="Excluir rascunho"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {activePost && (
        <VideoEditor
          open={!!activePost}
          onClose={() => { setActivePost(null); load(); }}
          content={activePost}
          onImageRegen={async () => ''}
        />
      )}
    </DashboardLayout>
  );
}
