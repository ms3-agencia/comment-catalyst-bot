import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Download, Sparkles, ChevronLeft, FileText, CheckCircle2, Clock, AlertCircle, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserAddons } from '@/hooks/useUserAddons';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { exportEbookPdf, exportEbookDocx, exportEbookMarkdown, exportEbookTxt, EbookFull } from '@/lib/ebookExport';
import { EbookGenerationOverlay, EbookGenStage } from '@/components/ebook/EbookGenerationOverlay';

export default function EbookEditor() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { hasAddon } = useUserAddons();
  const hasPremium = hasAddon('ebook-premium');

  const [ebook, setEbook] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [overlay, setOverlay] = useState<{ stage: EbookGenStage; title: string; subtitle?: string; current?: number; total?: number } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: eb }, { data: chs }] = await Promise.all([
      supabase.from('ebooks').select('*').eq('id', id).maybeSingle(),
      supabase.from('ebook_chapters').select('*').eq('ebook_id', id).order('chapter_number'),
    ]);
    setEbook(eb);
    setChapters(chs || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const generateSection = async (section: 'introduction' | 'conclusion') => {
    setBusy(section);
    try {
      const { data, error } = await supabase.functions.invoke('ebook-generate-chapter', {
        body: { ebook_id: id, section },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: section === 'introduction' ? 'Introdução gerada!' : 'Conclusão gerada!' });
      await load();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const generateChapter = async (n: number) => {
    setBusy(`ch-${n}`);
    try {
      const { data, error } = await supabase.functions.invoke('ebook-generate-chapter', {
        body: { ebook_id: id, chapter_number: n },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: `Capítulo ${n} gerado!` });
      await load();
      setActiveChapter(n);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const generateAll = async () => {
    const pending = chapters.filter(c => c.status !== 'completed');
    for (const c of pending) {
      await generateChapter(c.chapter_number);
    }
    if (!ebook?.introduction) await generateSection('introduction');
    if (!ebook?.conclusion) await generateSection('conclusion');
  };

  const saveField = async (patch: any) => {
    await supabase.from('ebooks').update(patch).eq('id', id);
    setEbook((p: any) => ({ ...p, ...patch }));
  };

  const saveChapter = async (chId: string, html: string) => {
    await supabase.from('ebook_chapters').update({ content_html: html, word_count: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length }).eq('id', chId);
    setChapters(p => p.map(c => c.id === chId ? { ...c, content_html: html } : c));
  };

  const buildFull = (): EbookFull => ({
    id: ebook.id,
    title: ebook.title,
    subtitle: ebook.subtitle,
    introduction: ebook.introduction,
    conclusion: ebook.conclusion,
    cta: ebook.cta,
    method_name: ebook.method_name,
    promise: ebook.promise,
    chapters: chapters.map(c => ({ chapter_number: c.chapter_number, title: c.title, content_html: c.content_html || '' })),
  });

  const doExport = async (fmt: 'pdf' | 'docx' | 'md' | 'txt') => {
    setExporting(true);
    try {
      const full = buildFull();
      if (fmt === 'pdf') await exportEbookPdf(full);
      else if (fmt === 'docx') await exportEbookDocx(full);
      else if (fmt === 'md') await exportEbookMarkdown(full);
      else await exportEbookTxt(full);
      toast({ title: 'Export pronto!' });
    } catch (e: any) {
      toast({ title: 'Erro ao exportar', description: e.message, variant: 'destructive' });
    } finally { setExporting(false); }
  };

  if (loading) return <DashboardLayout><div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;
  if (!ebook) return <DashboardLayout><Card className="p-12 text-center">eBook não encontrado.</Card></DashboardLayout>;

  const completed = chapters.filter(c => c.status === 'completed').length;
  const total = chapters.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard/ebooks"><ChevronLeft className="h-4 w-4" />Voltar</Link></Button>
            <div>
              <h1 className="font-heading text-2xl font-bold">{ebook.title}</h1>
              {ebook.subtitle && <p className="text-sm text-muted-foreground">{ebook.subtitle}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={generateAll} disabled={!!busy} variant="outline">
              <Sparkles className="h-4 w-4" />Gerar tudo que falta
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={exporting}><Download className="h-4 w-4" />Exportar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => doExport('pdf')}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport('docx')}>DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport('md')}>Markdown</DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport('txt')}>TXT</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progresso */}
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>Progresso: {completed}/{total} capítulos</span>
            <span className="text-primary font-semibold">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          {ebook.method_name && (
            <div className="mt-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-1"><Crown className="h-3 w-3 mr-1" />Modo Produto Premium</Badge>
              <p className="text-sm"><strong>Método:</strong> {ebook.method_name}</p>
              {ebook.promise && <p className="text-sm mt-1"><strong>Promessa:</strong> {ebook.promise}</p>}
            </div>
          )}
        </Card>

        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          {/* Sidebar capítulos */}
          <Card className="p-3 space-y-1 max-h-[700px] overflow-y-auto">
            <SidebarItem
              active={activeChapter === -1}
              onClick={() => setActiveChapter(-1)}
              status={ebook.introduction ? 'completed' : 'pending'}
              label="Introdução"
            />
            {chapters.map(c => (
              <SidebarItem
                key={c.id}
                active={activeChapter === c.chapter_number}
                onClick={() => setActiveChapter(c.chapter_number)}
                status={c.status}
                label={`Cap. ${c.chapter_number}: ${c.title}`}
              />
            ))}
            <SidebarItem
              active={activeChapter === -2}
              onClick={() => setActiveChapter(-2)}
              status={ebook.conclusion ? 'completed' : 'pending'}
              label="Conclusão"
            />
          </Card>

          {/* Editor */}
          <Card className="p-5 min-h-[600px]">
            {activeChapter === -1 && (
              <SectionEditor
                title="Introdução"
                html={ebook.introduction || ''}
                onChange={(html) => saveField({ introduction: html })}
                premiumLocked={!hasPremium && !!ebook.introduction}
                onGenerate={() => generateSection('introduction')}
                generating={busy === 'introduction'}
                hasContent={!!ebook.introduction}
              />
            )}
            {activeChapter === -2 && (
              <SectionEditor
                title="Conclusão"
                html={ebook.conclusion || ''}
                onChange={(html) => saveField({ conclusion: html })}
                premiumLocked={!hasPremium && !!ebook.conclusion}
                onGenerate={() => generateSection('conclusion')}
                generating={busy === 'conclusion'}
                hasContent={!!ebook.conclusion}
              />
            )}
            {activeChapter !== null && activeChapter > 0 && (() => {
              const ch = chapters.find(c => c.chapter_number === activeChapter);
              if (!ch) return null;
              return (
                <SectionEditor
                  title={`Capítulo ${ch.chapter_number}: ${ch.title}`}
                  subtitle={ch.summary}
                  html={ch.content_html || ''}
                  onChange={(html) => saveChapter(ch.id, html)}
                  premiumLocked={!hasPremium && ch.status === 'completed'}
                  onGenerate={() => generateChapter(ch.chapter_number)}
                  generating={busy === `ch-${ch.chapter_number}`}
                  hasContent={ch.status === 'completed'}
                  wordCount={ch.word_count}
                />
              );
            })()}
            {activeChapter === null && (
              <div className="h-full flex items-center justify-center text-muted-foreground text-center p-12">
                <div>
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Selecione uma seção à esquerda para editar.</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SidebarItem({ active, onClick, status, label }: any) {
  const Icon = status === 'completed' ? CheckCircle2 : status === 'generating' ? Loader2 : status === 'error' ? AlertCircle : Clock;
  const color = status === 'completed' ? 'text-emerald-500' : status === 'error' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <button onClick={onClick} className={`w-full text-left px-2.5 py-2 rounded-md text-sm hover:bg-accent flex items-start gap-2 ${active ? 'bg-accent' : ''}`}>
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color} ${status === 'generating' ? 'animate-spin' : ''}`} />
      <span className="line-clamp-2">{label}</span>
    </button>
  );
}

function SectionEditor({ title, subtitle, html, onChange, onGenerate, generating, hasContent, premiumLocked, wordCount }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          {wordCount > 0 && <p className="text-xs text-muted-foreground mt-1">{wordCount} palavras</p>}
        </div>
        <Button onClick={onGenerate} disabled={generating} variant={hasContent ? 'outline' : 'default'} size="sm">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {hasContent ? 'Regenerar' : 'Gerar com IA'}
        </Button>
      </div>
      {premiumLocked ? (
        <div className="prose prose-sm prose-invert max-w-none p-4 border rounded-md" dangerouslySetInnerHTML={{ __html: html }} />
      ) : hasContent ? (
        <RichTextEditor value={html} onChange={onChange} />
      ) : (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-md">
          <p className="mb-4">Conteúdo ainda não gerado.</p>
          <Button onClick={onGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar com IA
          </Button>
        </div>
      )}
      {premiumLocked && (
        <p className="text-xs text-amber-400">
          <Crown className="h-3 w-3 inline mr-1" />A edição visual pós-geração é exclusiva do <Link to="/dashboard/addons" className="underline">eBooks Premium</Link>.
        </p>
      )}
    </div>
  );
}
