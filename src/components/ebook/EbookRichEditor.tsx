import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Heading3, Link as LinkIcon, Undo, Redo, Code, Quote,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Image as ImageIcon,
  Sparkles, Highlighter, Palette, Type, Loader2, Minus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const FONT_FAMILIES = [
  { label: 'Padrão', value: '' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, monospace' },
];

const TEXT_COLORS = [
  '#e6edf3', '#9ca3af', '#06b6d4', '#22d3ee', '#a78bfa',
  '#f472b6', '#fb7185', '#facc15', '#34d399', '#60a5fa',
];

const HIGHLIGHT_COLORS = [
  'transparent', '#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8',
  '#fef3c7', '#a5f3fc', '#ddd6fe', '#fecaca',
];

interface EbookRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  ebookId?: string;
  /** Conteúdo dos capítulos para dar contexto ao gerador de imagem */
  contextHint?: string;
}

export function EbookRichEditor({ value, onChange, ebookId, contextHint }: EbookRichEditorProps) {
  const { toast } = useToast();
  const [imageDialog, setImageDialog] = useState(false);
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgRatio, setImgRatio] = useState<'16:9' | '1:1' | '9:16' | '4:5' | '3:4' | '4:3'>('16:9');
  const [imgGenerating, setImgGenerating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg my-4 mx-auto max-w-full h-auto shadow-lg border border-border' },
        allowBase64: true,
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'ebook-prose prose prose-invert max-w-none min-h-[500px] px-10 py-10 focus:outline-none',
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL do link', prev || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertImageByUrl = () => {
    const url = window.prompt('URL da imagem');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const generateAiImage = async () => {
    if (!imgPrompt.trim()) {
      toast({ title: 'Descreva a imagem', variant: 'destructive' });
      return;
    }
    setImgGenerating(true);
    try {
      const fullPrompt = contextHint
        ? `${imgPrompt}\n\nContexto do eBook: ${contextHint.slice(0, 400)}`
        : imgPrompt;
      const { data, error } = await supabase.functions.invoke('ebook-generate-image', {
        body: { prompt: fullPrompt, aspect_ratio: imgRatio, ebook_id: ebookId },
      });
      if (error) {
        let msg = error.message;
        try { const ctx: any = (error as any).context; if (ctx?.json) { const j = await ctx.json(); msg = j.message || j.error || msg; } } catch {}
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      const url = (data as any).image_url;
      if (!url) throw new Error('Imagem não retornada');
      editor.chain().focus().setImage({ src: url, alt: imgPrompt.slice(0, 120) }).run();
      toast({ title: 'Imagem inserida!' });
      setImageDialog(false);
      setImgPrompt('');
    } catch (e: any) {
      toast({ title: 'Erro ao gerar imagem', description: e.message, variant: 'destructive' });
    } finally {
      setImgGenerating(false);
    }
  };

  const Btn = ({ active, onClick, children, title, disabled }: any) => (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="h-8 w-8 p-0 shrink-0"
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </Button>
  );

  const Sep = () => <div className="w-px self-stretch bg-border mx-0.5" />;

  return (
    <div className="ebook-page overflow-hidden">
      {/* Barra de ferramentas (sticky) */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-border bg-card/95 backdrop-blur-sm p-1.5">
        {/* Heading select */}
        <Select
          value={
            editor.isActive('heading', { level: 1 }) ? 'h1' :
            editor.isActive('heading', { level: 2 }) ? 'h2' :
            editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
          }
          onValueChange={(v) => {
            if (v === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(v.replace('h', '')) as any }).run();
          }}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Parágrafo</SelectItem>
            <SelectItem value="h1">Título 1</SelectItem>
            <SelectItem value="h2">Título 2</SelectItem>
            <SelectItem value="h3">Título 3</SelectItem>
          </SelectContent>
        </Select>

        {/* Font family */}
        <Select
          value={editor.getAttributes('textStyle').fontFamily || '__'}
          onValueChange={(v) => {
            if (!v || v === '__') editor.chain().focus().unsetFontFamily().run();
            else editor.chain().focus().setFontFamily(v).run();
          }}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs"><Type className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            {FONT_FAMILIES.map(f => <SelectItem key={f.label} value={f.value || '__'} style={{ fontFamily: f.value }}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Sep />

        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)"><Bold size={14} /></Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)"><Italic size={14} /></Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)"><UnderlineIcon size={14} /></Btn>
        <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><Strikethrough size={14} /></Btn>

        {/* Cor de texto */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" title="Cor do texto">
              <Palette size={14} style={{ color: editor.getAttributes('textStyle').color || undefined }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1">
              {TEXT_COLORS.map(c => (
                <button
                  key={c}
                  className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  onClick={() => editor.chain().focus().setColor(c).run()}
                  title={c}
                />
              ))}
              <button
                className="h-6 w-6 rounded border border-border text-[9px] font-bold col-span-5 hover:bg-accent"
                onClick={() => editor.chain().focus().unsetColor().run()}
              >Limpar</button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight */}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant={editor.isActive('highlight') ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" title="Marca-texto">
              <Highlighter size={14} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1">
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c}
                  className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c === 'transparent' ? undefined : c, backgroundImage: c === 'transparent' ? 'linear-gradient(45deg,transparent 45%,#ef4444 45%,#ef4444 55%,transparent 55%)' : undefined }}
                  onClick={() => c === 'transparent' ? editor.chain().focus().unsetHighlight().run() : editor.chain().focus().toggleHighlight({ color: c }).run()}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Sep />

        <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinhar à esquerda"><AlignLeft size={14} /></Btn>
        <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centralizar"><AlignCenter size={14} /></Btn>
        <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinhar à direita"><AlignRight size={14} /></Btn>
        <Btn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar"><AlignJustify size={14} /></Btn>

        <Sep />

        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista com marcadores"><List size={14} /></Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered size={14} /></Btn>
        <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote size={14} /></Btn>
        <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Bloco de código"><Code size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha horizontal"><Minus size={14} /></Btn>

        <Sep />

        <Btn active={editor.isActive('link')} onClick={setLink} title="Inserir link"><LinkIcon size={14} /></Btn>
        <Btn onClick={insertImageByUrl} title="Inserir imagem por URL"><ImageIcon size={14} /></Btn>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1 text-primary hover:text-primary hover:bg-primary/10"
          onClick={() => setImageDialog(true)}
          title="Gerar imagem com IA"
        >
          <Sparkles size={14} />
          <span className="text-xs font-medium hidden sm:inline">IA</span>
        </Button>

        <div className="flex-1" />

        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer"><Undo size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer"><Redo size={14} /></Btn>
      </div>

      {/* Conteúdo */}
      <div className="bg-background/40 max-h-[70vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Status bar */}
      <div className="border-t border-border bg-muted/30 px-4 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>{editor.storage.characterCount?.words?.() ?? editor.getText().split(/\s+/).filter(Boolean).length} palavras</span>
        <span className="hidden sm:inline">Use <kbd className="px-1 rounded bg-card border">Ctrl+B</kbd> · <kbd className="px-1 rounded bg-card border">Ctrl+I</kbd> · <kbd className="px-1 rounded bg-card border">Ctrl+U</kbd></span>
      </div>

      {/* Dialog: gerar imagem com IA */}
      <Dialog open={imageDialog} onOpenChange={setImageDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Gerar imagem com IA</DialogTitle>
            <DialogDescription>
              Descreva a imagem que você quer inserir no eBook. Ela será gerada e adicionada na posição atual do cursor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Descrição (prompt)</Label>
              <Textarea
                rows={4}
                value={imgPrompt}
                onChange={e => setImgPrompt(e.target.value)}
                placeholder="Ex.: Ilustração minimalista de um livro aberto com luz dourada saindo das páginas, estilo flat design, fundo escuro com detalhes em ciano"
                className="mt-1"
                disabled={imgGenerating}
              />
            </div>
            <div>
              <Label className="text-xs">Proporção</Label>
              <Select value={imgRatio} onValueChange={(v) => setImgRatio(v as any)} disabled={imgGenerating}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 — Horizontal (capa, banners)</SelectItem>
                  <SelectItem value="4:3">4:3 — Horizontal clássico</SelectItem>
                  <SelectItem value="1:1">1:1 — Quadrada</SelectItem>
                  <SelectItem value="4:5">4:5 — Retrato</SelectItem>
                  <SelectItem value="3:4">3:4 — Retrato</SelectItem>
                  <SelectItem value="9:16">9:16 — Vertical (story)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 A geração consome créditos do seu saldo. A imagem é inserida automaticamente na posição do cursor.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialog(false)} disabled={imgGenerating}>Cancelar</Button>
            <Button onClick={generateAiImage} disabled={imgGenerating || !imgPrompt.trim()}>
              {imgGenerating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Gerando…</> : <><Sparkles className="h-4 w-4 mr-1" />Gerar e inserir</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
