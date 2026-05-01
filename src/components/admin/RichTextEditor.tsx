import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Undo, Redo, Code, Quote } from 'lucide-react';

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline' } }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none min-h-[240px] p-4 focus:outline-none',
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

  const Btn = ({ active, onClick, children, title }: any) => (
    <Button type="button" variant={active ? 'secondary' : 'ghost'} size="sm" className="h-7 w-7 p-0" onClick={onClick} title={title}>
      {children}
    </Button>
  );

  return (
    <div className="rounded-md border border-border bg-background/50">
      <div className="flex flex-wrap gap-0.5 border-b border-border p-1">
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito"><Bold size={14} /></Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico"><Italic size={14} /></Btn>
        <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título 2"><Heading2 size={14} /></Btn>
        <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título 3"><Heading3 size={14} /></Btn>
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista"><List size={14} /></Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada"><ListOrdered size={14} /></Btn>
        <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação"><Quote size={14} /></Btn>
        <Btn active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} title="Código"><Code size={14} /></Btn>
        <Btn active={editor.isActive('link')} onClick={setLink} title="Link"><LinkIcon size={14} /></Btn>
        <div className="flex-1" />
        <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo size={14} /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
