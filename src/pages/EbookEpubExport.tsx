import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserAddons } from '@/hooks/useUserAddons';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BookOpen, Download, ChevronLeft, Crown, AlertCircle, CheckCircle2, Info, Sparkles, Wand2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { exportEbookEpub, type KdpMetadata } from '@/lib/ebookEpubExport';
import type { EbookFull } from '@/lib/ebookExport';
import { EbookGenerationOverlay } from '@/components/ebook/EbookGenerationOverlay';

const LANGUAGES = [
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'pt-PT', label: 'Português (Portugal)' },
  { code: 'en-US', label: 'Inglês (EUA)' },
  { code: 'en-GB', label: 'Inglês (Reino Unido)' },
  { code: 'es-ES', label: 'Espanhol (Espanha)' },
  { code: 'es-MX', label: 'Espanhol (México)' },
  { code: 'fr-FR', label: 'Francês' },
  { code: 'de-DE', label: 'Alemão' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'ja-JP', label: 'Japonês' },
];

export default function EbookEpubExport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAddon, loading: addonsLoading } = useUserAddons();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generatingSynopsis, setGeneratingSynopsis] = useState(false);
  const [generatingKeywords, setGeneratingKeywords] = useState(false);
  const [generatingCategories, setGeneratingCategories] = useState(false);
  const [overlay, setOverlay] = useState<any>(null);
  const [ebook, setEbook] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);

  const [meta, setMeta] = useState<KdpMetadata>({
    author: '',
    language: 'pt-BR',
    identifier: '',
    identifierType: 'UUID',
    publisher: '',
    description: '',
    keywords: [],
    categories: [],
    rights: '',
    publicationDate: new Date().toISOString().slice(0, 10),
    contributor: '',
  });
  const [keywordsInput, setKeywordsInput] = useState('');
  const [categoriesInput, setCategoriesInput] = useState('');

  const hasEpubAddon = hasAddon('epub-export');

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoading(true);
      const { data: e } = await supabase.from('ebooks').select('*').eq('id', id).maybeSingle();
      if (!e) { setLoading(false); return; }
      setEbook(e);

      // Hidrata metadados a partir de metadata.kdp se já salvos antes
      const saved = (e.metadata && (e.metadata as any).kdp) as KdpMetadata | undefined;
      const fallbackAuthor = (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || '';
      setMeta({
        author: saved?.author ?? fallbackAuthor,
        language: saved?.language ?? 'pt-BR',
        identifier: saved?.identifier ?? '',
        identifierType: saved?.identifierType ?? 'UUID',
        publisher: saved?.publisher ?? '',
        description: saved?.description ?? '',
        keywords: saved?.keywords ?? [],
        categories: saved?.categories ?? [],
        rights: saved?.rights ?? `© ${new Date().getFullYear()} ${fallbackAuthor}. Todos os direitos reservados.`,
        publicationDate: saved?.publicationDate ?? new Date().toISOString().slice(0, 10),
        contributor: saved?.contributor ?? '',
      });
      setKeywordsInput((saved?.keywords ?? []).join(', '));
      setCategoriesInput((saved?.categories ?? []).join(', '));

      const { data: ch } = await supabase
        .from('ebook_chapters')
        .select('chapter_number, title, content_html, status')
        .eq('ebook_id', id)
        .order('chapter_number');
      setChapters(ch || []);
      setLoading(false);
    })();
  }, [id, user]);

  const parseList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  const buildMetaForExport = (): KdpMetadata => ({
    ...meta,
    keywords: parseList(keywordsInput),
    categories: parseList(categoriesInput),
  });

  const saveMetadata = async () => {
    if (!ebook) return;
    setSaving(true);
    try {
      const finalMeta = buildMetaForExport();
      const newMetadata = { ...(ebook.metadata || {}), kdp: finalMeta };
      const { error } = await supabase
        .from('ebooks')
        .update({ metadata: newMetadata })
        .eq('id', ebook.id);
      if (error) throw error;
      setEbook({ ...ebook, metadata: newMetadata });
      toast({ title: 'Metadados salvos!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const validate = (): string | null => {
    if (!meta.author?.trim()) return 'Informe o nome do autor.';
    if (!meta.language?.trim()) return 'Selecione um idioma.';
    if (!ebook?.title?.trim()) return 'O ebook precisa ter um título.';
    if (chapters.length === 0) return 'O ebook precisa ter pelo menos um capítulo.';
    return null;
  };

  const buildFull = (): EbookFull => ({
    id: ebook.id,
    title: ebook.title,
    subtitle: ebook.subtitle,
    cover_url: ebook.cover_url,
    introduction: ebook.introduction,
    conclusion: ebook.conclusion,
    cta: ebook.cta,
    method_name: ebook.method_name,
    promise: ebook.promise,
    chapters: chapters.map((c: any) => ({
      chapter_number: c.chapter_number,
      title: c.title,
      content_html: c.content_html || '',
    })),
  });

  const generateSynopsisAI = async () => {
    if (!ebook?.id) return;
    if (chapters.length === 0) {
      toast({ title: 'Sem conteúdo', description: 'Gere ao menos um capítulo antes de criar a sinopse.', variant: 'destructive' });
      return;
    }
    setGeneratingSynopsis(true);
    try {
      const { data, error } = await supabase.functions.invoke('ebook-generate-synopsis', {
        body: {
          ebook_id: ebook.id,
          language: meta.language || 'pt-BR',
          max_chars: 1800,
        },
      });
      if (error) {
        const status = (error as any).context?.status;
        if (status === 402) {
          toast({ title: 'Créditos de IA esgotados', description: 'Adicione saldo em Settings > Workspace > Usage.', variant: 'destructive' });
        } else if (status === 429) {
          toast({ title: 'Muitas requisições', description: 'Aguarde alguns segundos e tente de novo.', variant: 'destructive' });
        } else {
          toast({ title: 'Erro ao gerar sinopse', description: error.message, variant: 'destructive' });
        }
        return;
      }
      const synopsis = (data as any)?.synopsis as string | undefined;
      if (!synopsis) {
        toast({ title: 'Resposta vazia da IA', variant: 'destructive' });
        return;
      }
      setMeta((m) => ({ ...m, description: synopsis }));
      toast({ title: 'Sinopse gerada!', description: `${synopsis.length} caracteres` });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar sinopse', description: e?.message || 'Falha desconhecida', variant: 'destructive' });
    } finally {
      setGeneratingSynopsis(false);
    }
  };

  const generateKdpMeta = async (kind: 'keywords' | 'categories') => {
    if (!ebook?.id) return;
    if (chapters.length === 0) {
      toast({ title: 'Sem conteúdo', description: 'Gere ao menos um capítulo antes.', variant: 'destructive' });
      return;
    }
    const setLoading = kind === 'keywords' ? setGeneratingKeywords : setGeneratingCategories;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ebook-generate-kdp-meta', {
        body: { ebook_id: ebook.id, language: meta.language || 'pt-BR', kind },
      });
      if (error) {
        const status = (error as any).context?.status;
        if (status === 402) {
          toast({ title: 'Créditos de IA esgotados', description: 'Adicione saldo em Settings > Workspace > Usage.', variant: 'destructive' });
        } else if (status === 429) {
          toast({ title: 'Muitas requisições', description: 'Aguarde alguns segundos e tente de novo.', variant: 'destructive' });
        } else {
          toast({ title: `Erro ao gerar ${kind === 'keywords' ? 'palavras-chave' : 'categorias'}`, description: error.message, variant: 'destructive' });
        }
        return;
      }
      if (kind === 'keywords') {
        const list = (data as any)?.keywords as string[] | undefined;
        if (!list?.length) {
          toast({ title: 'Resposta vazia da IA', variant: 'destructive' });
          return;
        }
        setKeywordsInput(list.join(', '));
        toast({ title: 'Palavras-chave geradas!', description: `${list.length} keywords KDP estratégicas.` });
      } else {
        const list = (data as any)?.categories as string[] | undefined;
        if (!list?.length) {
          toast({ title: 'Resposta vazia da IA', variant: 'destructive' });
          return;
        }
        setCategoriesInput(list.join(', '));
        toast({ title: 'Categorias geradas!', description: `${list.length} categorias para best-seller.` });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao gerar com IA', description: e?.message || 'Falha desconhecida', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const doExport = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Não é possível exportar', description: err, variant: 'destructive' });
      return;
    }
    setExporting(true);
    setOverlay({ stage: 'section', title: 'Gerando EPUB', subtitle: 'Preparando arquivo...', progress: 5 });
    try {
      // Salva metadados antes de exportar
      await saveMetadata();
      const finalMeta = buildMetaForExport();
      const full = buildFull();
      await exportEbookEpub(full, finalMeta, ({ current, total, label }) => {
        setOverlay({
          stage: 'section',
          title: 'Gerando EPUB',
          subtitle: label,
          current,
          total,
          progress: Math.round((current / total) * 100),
        });
      });
      setOverlay({ stage: 'section', title: 'Pronto!', subtitle: 'Arquivo .epub baixado.', progress: 100 });
      toast({ title: 'EPUB exportado!', description: 'Você já pode enviar à Amazon KDP.' });
      setTimeout(() => setOverlay(null), 800);
    } catch (e: any) {
      setOverlay(null);
      toast({ title: 'Erro ao exportar EPUB', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  if (addonsLoading || loading) {
    return (
      <DashboardLayout>
        <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>
      </DashboardLayout>
    );
  }

  if (!ebook) {
    return (
      <DashboardLayout>
        <Card className="p-12 text-center">eBook não encontrado.</Card>
      </DashboardLayout>
    );
  }

  if (!hasEpubAddon) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-12">
          <Card className="p-8 text-center space-y-4">
            <BookOpen className="h-12 w-12 text-primary mx-auto" />
            <h1 className="font-heading text-2xl font-bold">Exportação EPUB (KDP)</h1>
            <p className="text-muted-foreground">
              Exporte seu ebook em formato EPUB 3 pronto para publicação na Amazon KDP, com capa,
              sumário navegável e metadados completos. Ative o add-on para liberar esta funcionalidade.
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" asChild>
                <Link to={`/dashboard/ebooks/${id}`}>Voltar ao editor</Link>
              </Button>
              <Button asChild>
                <Link to="/dashboard/addons"><Crown className="h-4 w-4" />Ativar Add-on EPUB</Link>
              </Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <EbookGenerationOverlay
        visible={!!overlay}
        stage={overlay?.stage || 'chapter'}
        title={overlay?.title}
        subtitle={overlay?.subtitle}
        current={overlay?.current}
        total={overlay?.total}
        progress={overlay?.progress}
      />
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to={`/dashboard/ebooks/${id}`}><ChevronLeft className="h-4 w-4" />Voltar ao editor</Link>
            </Button>
            <div>
              <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                Exportar EPUB (Amazon KDP)
              </h1>
              <p className="text-sm text-muted-foreground">{ebook.title}</p>
            </div>
          </div>
          <Badge className="bg-primary/15 text-primary border-primary/30">
            <Crown className="h-3 w-3 mr-1" />Add-on ativo
          </Badge>
        </div>

        <Card className="p-4 bg-amber-500/10 border-amber-500/30">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Antes de enviar para a Amazon KDP</p>
              <p className="text-muted-foreground">
                Preencha os metadados abaixo e clique em <strong>Exportar EPUB</strong>. O arquivo
                gerado segue o padrão EPUB 3 com sumário navegável e capa embutida — pronto para
                upload em <em>kdp.amazon.com</em>.
              </p>
            </div>
          </div>
        </Card>

        {/* Identidade da obra */}
        <Card className="p-5 space-y-4">
          <h2 className="font-heading text-lg font-bold">Identidade da obra</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Autor *</Label>
              <Input
                value={meta.author || ''}
                onChange={(e) => setMeta({ ...meta, author: e.target.value })}
                placeholder="Nome completo do autor"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Tradutor / Colaborador (opcional)</Label>
              <Input
                value={meta.contributor || ''}
                onChange={(e) => setMeta({ ...meta, contributor: e.target.value })}
                placeholder="Nome do tradutor ou colaborador"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Editora (opcional)</Label>
              <Input
                value={meta.publisher || ''}
                onChange={(e) => setMeta({ ...meta, publisher: e.target.value })}
                placeholder="Independente / Selo editorial"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Idioma *</Label>
              <Select
                value={meta.language}
                onValueChange={(v) => setMeta({ ...meta, language: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Identificador */}
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="font-heading text-lg font-bold">Identificador</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Se você ainda não tem ISBN nem ASIN, mantenha em <strong>UUID</strong> — o sistema gera
              um identificador único automático. Caso já tenha publicado, use ISBN/ASIN.
            </p>
          </div>
          <div className="grid md:grid-cols-[160px_1fr] gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={meta.identifierType}
                onValueChange={(v: any) => setMeta({ ...meta, identifierType: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UUID">UUID (auto)</SelectItem>
                  <SelectItem value="ISBN">ISBN</SelectItem>
                  <SelectItem value="ASIN">ASIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{meta.identifierType === 'UUID' ? 'UUID (deixe em branco para gerar)' : `Número ${meta.identifierType}`}</Label>
              <Input
                value={meta.identifier || ''}
                onChange={(e) => setMeta({ ...meta, identifier: e.target.value })}
                placeholder={meta.identifierType === 'ISBN' ? '978-XX-XXXXX-XX-X' : meta.identifierType === 'ASIN' ? 'B0XXXXXXXX' : 'auto-gerado'}
                disabled={meta.identifierType === 'UUID'}
                maxLength={50}
              />
            </div>
          </div>
        </Card>

        {/* Descrição & marketing */}
        <Card className="p-5 space-y-4">
          <h2 className="font-heading text-lg font-bold">Descrição e marketing</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Sinopse / descrição (será exibida na página da Amazon)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateSynopsisAI}
                disabled={generatingSynopsis}
                className="gap-1"
              >
                {generatingSynopsis ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 text-primary" />
                )}
                {generatingSynopsis ? 'Gerando...' : 'Gerar com IA'}
              </Button>
            </div>
            <Textarea
              value={meta.description || ''}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              placeholder="Em até 4000 caracteres, descreva o que o leitor vai ganhar com este ebook. Ou clique em 'Gerar com IA' para criar uma sinopse persuasiva baseada no conteúdo."
              rows={6}
              maxLength={4000}
            />
            <p className="text-xs text-muted-foreground">
              {(meta.description || '').length} / 4000 caracteres · A IA gera com base no conteúdo dos capítulos, com tom persuasivo e gatilhos mentais para despertar o desejo de compra.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Palavras-chave KDP (até 7, separadas por vírgula)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateKdpMeta('keywords')}
                  disabled={generatingKeywords}
                  className="gap-1"
                >
                  {generatingKeywords ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 text-primary" />
                  )}
                  {generatingKeywords ? 'Gerando...' : 'Gerar com IA'}
                </Button>
              </div>
              <Input
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="produtividade, foco, hábitos, autoajuda"
              />
              <p className="text-xs text-muted-foreground">A IA escolhe 7 termos estratégicos (long-tail + nicho) que leitores realmente buscam na Amazon.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Categorias / tópicos (separados por vírgula)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateKdpMeta('categories')}
                  disabled={generatingCategories}
                  className="gap-1"
                >
                  {generatingCategories ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 text-primary" />
                  )}
                  {generatingCategories ? 'Gerando...' : 'Gerar com IA'}
                </Button>
              </div>
              <Input
                value={categoriesInput}
                onChange={(e) => setCategoriesInput(e.target.value)}
                placeholder="Negócios, Desenvolvimento Pessoal"
              />
              <p className="text-xs text-muted-foreground">A IA sugere sub-categorias profundas com mais chance de ranquear #1 best-seller.</p>
            </div>
          </div>
        </Card>


        {/* Direitos / publicação */}
        <Card className="p-5 space-y-4">
          <h2 className="font-heading text-lg font-bold">Direitos e publicação</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de publicação</Label>
              <Input
                type="date"
                value={meta.publicationDate || ''}
                onChange={(e) => setMeta({ ...meta, publicationDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Direitos autorais</Label>
              <Input
                value={meta.rights || ''}
                onChange={(e) => setMeta({ ...meta, rights: e.target.value })}
                placeholder="© 2026 Seu Nome. Todos os direitos reservados."
                maxLength={200}
              />
            </div>
          </div>
        </Card>

        {/* Status do conteúdo */}
        <Card className="p-5 space-y-3">
          <h2 className="font-heading text-lg font-bold">Status do conteúdo</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <StatusItem label="Capa" ok={!!ebook.cover_url} hint={!ebook.cover_url ? 'Recomendado: adicione uma capa antes de enviar à KDP.' : undefined} />
            <StatusItem label="Subtítulo" ok={!!ebook.subtitle} hint={!ebook.subtitle ? 'Opcional, mas ajuda na busca.' : undefined} />
            <StatusItem label="Introdução" ok={!!ebook.introduction} />
            <StatusItem label="Conclusão" ok={!!ebook.conclusion} />
            <StatusItem
              label={`Capítulos (${chapters.length})`}
              ok={chapters.length > 0 && chapters.every((c) => (c.content_html || '').trim().length > 0)}
              hint={chapters.some((c) => !(c.content_html || '').trim()) ? 'Há capítulos vazios.' : undefined}
            />
          </div>
        </Card>

        <div className="flex gap-2 justify-end sticky bottom-2">
          <Button variant="outline" onClick={saveMetadata} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar metadados
          </Button>
          <Button onClick={doExport} disabled={exporting} size="lg">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar EPUB
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatusItem({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-md border border-border">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
      ) : (
        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
      )}
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}
