import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Download, Loader2, Target, Users, Heart, MessageCircle, Lightbulb, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AiProfileCardProps {
  profile: string;
  projectName?: string;
}

const sectionIcons: Record<string, React.ReactNode> = {
  'perfil do avatar': <Target className="h-5 w-5 text-primary" />,
  'dados demográficos': <Users className="h-5 w-5 text-primary" />,
  'comportamento': <BarChart3 className="h-5 w-5 text-primary" />,
  'engajamento': <BarChart3 className="h-5 w-5 text-primary" />,
  'interesses': <Heart className="h-5 w-5 text-primary" />,
  'temas': <Heart className="h-5 w-5 text-primary" />,
  'dores': <Lightbulb className="h-5 w-5 text-warning" />,
  'necessidades': <Lightbulb className="h-5 w-5 text-warning" />,
  'linguagem': <MessageCircle className="h-5 w-5 text-primary" />,
  'tom': <MessageCircle className="h-5 w-5 text-primary" />,
  'recomendações': <Sparkles className="h-5 w-5 text-warning" />,
  'estratégicas': <Sparkles className="h-5 w-5 text-warning" />,
};

const getIconForHeading = (text: string) => {
  const lower = text.toLowerCase();
  for (const [key, icon] of Object.entries(sectionIcons)) {
    if (lower.includes(key)) return icon;
  }
  return <Sparkles className="h-5 w-5 text-primary" />;
};

// Emoji mapping for PDF sections (since lucide icons won't render in pdf clone)
const getSectionEmoji = (text: string): string => {
  const lower = text.toLowerCase();
  if (lower.includes('perfil do avatar') || lower.includes('perfil')) return '🎯';
  if (lower.includes('demográficos')) return '👥';
  if (lower.includes('comportamento') || lower.includes('engajamento')) return '📊';
  if (lower.includes('interesses') || lower.includes('temas')) return '❤️';
  if (lower.includes('dores') || lower.includes('necessidades')) return '💡';
  if (lower.includes('linguagem') || lower.includes('tom')) return '💬';
  if (lower.includes('insights') || lower.includes('criação de produtos')) return '💼';
  if (lower.includes('top produtos') || lower.includes('potencial de venda')) return '🚀';
  if (lower.includes('recomendações') || lower.includes('estratégicas')) return '✨';
  return '📌';
};

const buildPdfHtml = (profile: string, projectName?: string): string => {
  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Parse markdown into simple HTML with inline styles
  const contentHtml = profile
    // h2
    .replace(/^## (.+)$/gm, (_m, t) => {
      const emoji = getSectionEmoji(t);
      return `<div style="display:flex;align-items:center;gap:10px;margin-top:28px;margin-bottom:8px;">
        <span style="font-size:20px;">${emoji}</span>
        <h2 style="margin:0;font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:#e8ecf0;">${t.replace(/[🎯👥📊❤️💡💬✨📌]/g, '').trim()}</h2>
      </div>`;
    })
    // h3
    .replace(/^### (.+)$/gm, (_m, t) => {
      const emoji = getSectionEmoji(t);
      return `<div style="display:flex;align-items:center;gap:8px;margin-top:20px;padding-bottom:6px;border-bottom:1px solid #1e2433;margin-bottom:8px;">
        <span style="font-size:16px;">${emoji}</span>
        <h3 style="margin:0;font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:600;color:#d0d6e0;">${t.replace(/[🎯👥📊❤️💡💬✨📌]/g, '').trim()}</h3>
      </div>`;
    })
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#e8ecf0;font-weight:600;">$1</strong>')
    // bullet lists
    .replace(/^- (.+)$/gm, (_m, t) =>
      `<div style="display:flex;align-items:flex-start;gap:8px;padding:3px 0 3px 8px;">
        <span style="margin-top:6px;width:6px;height:6px;min-width:6px;border-radius:50%;background:#17c5e8;display:inline-block;"></span>
        <span style="font-size:13px;line-height:1.6;color:#8b95a8;">${t}</span>
      </div>`)
    // paragraphs (lines that aren't already wrapped)
    .replace(/^(?!<)((?!<div|<h[23]).+)$/gm, '<p style="font-size:13px;line-height:1.7;color:#8b95a8;margin:4px 0 4px 4px;">$1</p>');

  return `
<div style="font-family:'Inter','Segoe UI',sans-serif;background:#0a0c10;color:#e8ecf0;min-height:100%;padding:0;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0d1117 0%,#111827 100%);padding:32px 40px;border-bottom:2px solid #17c5e8;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#17c5e8,#3b82f6);display:flex;align-items:center;justify-content:center;">
          <span style="font-size:22px;">🧠</span>
        </div>
        <div>
          <h1 style="margin:0;font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
            <span style="background:linear-gradient(135deg,#17c5e8,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">CommentIQ</span>
          </h1>
          <p style="margin:2px 0 0;font-size:11px;color:#8b95a8;letter-spacing:0.5px;text-transform:uppercase;">Análise de Audiência com Inteligência Artificial</p>
        </div>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:11px;color:#6b7280;">Relatório gerado em</p>
        <p style="margin:2px 0 0;font-size:13px;color:#d0d6e0;font-weight:500;">${date}</p>
      </div>
    </div>
  </div>

  <!-- Project Title Bar -->
  <div style="background:#111827;padding:16px 40px;border-bottom:1px solid #1e2433;">
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="font-size:14px;">📁</span>
      <span style="font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Projeto:</span>
      <span style="font-size:14px;color:#e8ecf0;font-weight:600;">${projectName || 'Análise de Avatar'}</span>
    </div>
  </div>

  <!-- Content -->
  <div style="padding:24px 40px 40px;">
    ${contentHtml}
  </div>

  <!-- Footer -->
  <div style="background:#111827;padding:20px 40px;border-top:1px solid #1e2433;display:flex;align-items:center;justify-content:space-between;">
    <p style="margin:0;font-size:11px;color:#6b7280;">Gerado por <strong style="color:#17c5e8;">CommentIQ</strong> — Análise inteligente de audiência</p>
    <p style="margin:0;font-size:11px;color:#6b7280;">commentiq.com</p>
  </div>
</div>`;
};

export const AiProfileCard = ({ profile, projectName }: AiProfileCardProps) => {
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');

      // Create a temporary off-screen container with the PDF-specific layout
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.innerHTML = buildPdfHtml(profile, projectName);
      document.body.appendChild(container);

      const opt = {
        margin: [0, 0, 0, 0] as [number, number, number, number],
        filename: `${projectName || 'perfil-avatar'}-commentiq.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0a0c10', width: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      };

      await html2pdf().set(opt).from(container).save();
      document.body.removeChild(container);
    } catch (err) {
      console.error('PDF export error:', err);
    }
    setExporting(false);
  };

  return (
    <Card className="overflow-hidden border-primary/20 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">Perfil de Avatar IA</h3>
            {projectName && <p className="text-xs text-muted-foreground">{projectName}</p>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={exporting}
          className="border-primary/30 hover:bg-primary/10"
        >
          {exporting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exportando...</>
          ) : (
            <><Download className="mr-2 h-4 w-4" /> Exportar PDF</>
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="ai-profile-content p-6 space-y-1">
        <ReactMarkdown
          components={{
            h2: ({ children }) => (
              <div className="flex items-center gap-3 pt-4 pb-2 first:pt-0">
                {getIconForHeading(String(children))}
                <h2 className="font-heading text-xl font-bold text-foreground">{children}</h2>
              </div>
            ),
            h3: ({ children }) => (
              <div className="flex items-center gap-2 pt-4 pb-1 border-b border-border/50 mb-2">
                {getIconForHeading(String(children))}
                <h3 className="font-heading text-base font-semibold text-foreground">{children}</h3>
              </div>
            ),
            p: ({ children }) => (
              <p className="text-sm leading-relaxed text-muted-foreground pl-1 py-1">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="space-y-1.5 pl-2 py-1">{children}</ul>
            ),
            li: ({ children }) => (
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="leading-relaxed">{children}</span>
              </li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
          }}
        >
          {profile}
        </ReactMarkdown>
      </div>
    </Card>
  );
};
