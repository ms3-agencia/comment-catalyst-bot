import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Download, Loader2, Target, Users, Heart, MessageCircle, Lightbulb, BarChart3, Briefcase, Rocket, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchBranding } from '@/hooks/useBranding';

interface AiProfileCardProps {
  profile: string;
  projectName?: string;
  onDelete?: () => void;
  deleting?: boolean;
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
  'insights': <Briefcase className="h-5 w-5 text-warning" />,
  'criação de produtos': <Briefcase className="h-5 w-5 text-warning" />,
  'top produtos': <Rocket className="h-5 w-5 text-warning" />,
  'potencial de venda': <Rocket className="h-5 w-5 text-warning" />,
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

// ----- Markdown → HTML for PDF (light theme, print-friendly) -----
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const renderInline = (text: string): string => {
  let t = escapeHtml(text);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f172a;font-weight:700;">$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-family:\'SFMono-Regular\',Consolas,monospace;font-size:11px;color:#0f172a;">$1</code>');
  return t;
};

const isTableSeparator = (line: string) =>
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

const splitTableRow = (line: string): string[] => {
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|')) l = l.slice(0, -1);
  return l.split('|').map((c) => c.trim());
};

const renderTable = (header: string[], rows: string[][]): string => {
  const ths = header
    .map(
      (h) =>
        `<th style="background:linear-gradient(135deg,#0ea5e9,#3b82f6);color:#fff;padding:10px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;border:1px solid #0284c7;">${renderInline(h)}</th>`
    )
    .join('');
  const trs = rows
    .map(
      (r, i) =>
        `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">${r
          .map(
            (c) =>
              `<td style="padding:9px 12px;font-size:12px;color:#334155;border:1px solid #e2e8f0;vertical-align:top;line-height:1.5;">${renderInline(c)}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0 16px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
};

const renderProductCard = (num: string, content: string): string => {
  // Try to extract product name from first **bold** segment
  const nameMatch = content.match(/\*\*(.+?)\*\*/);
  const productName = nameMatch ? nameMatch[1] : `Item ${num}`;
  const body = renderInline(content.replace(/^\*\*.+?\*\*\s*[—\-:]?\s*/, ''));
  return `<div style="display:flex;gap:14px;background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #0ea5e9;border-radius:10px;padding:14px 16px;margin:10px 0;box-shadow:0 1px 2px rgba(0,0,0,0.04);page-break-inside:avoid;">
    <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#3b82f6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">${num}</div>
    <div style="flex:1;">
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">${escapeHtml(productName)}</div>
      <div style="font-size:12px;color:#475569;line-height:1.6;">${body}</div>
    </div>
  </div>`;
};

const markdownToPdfHtml = (md: string): string => {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  let inList = false;
  let inOrdered = false;
  let isProductSection = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    if (inOrdered) {
      out.push('</ol>');
      inOrdered = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty
    if (!trimmed) {
      closeList();
      i++;
      continue;
    }

    // H2
    if (/^##\s+/.test(trimmed)) {
      closeList();
      const text = trimmed.replace(/^##\s+/, '').replace(/[🎯👥📊❤️💡💬✨📌💼🚀]/g, '').trim();
      const emoji = getSectionEmoji(text);
      isProductSection = /top\s+produtos|potencial\s+de\s+venda/i.test(text);
      out.push(
        `<div style="display:flex;align-items:center;gap:12px;margin:28px 0 14px;padding:14px 18px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:10px;border-left:4px solid #0ea5e9;page-break-after:avoid;">
          <span style="font-size:22px;">${emoji}</span>
          <h2 style="margin:0;font-family:'Space Grotesk','Inter',sans-serif;font-size:18px;font-weight:700;color:#0c4a6e;letter-spacing:-0.2px;">${escapeHtml(text)}</h2>
        </div>`
      );
      i++;
      continue;
    }

    // H3
    if (/^###\s+/.test(trimmed)) {
      closeList();
      const text = trimmed.replace(/^###\s+/, '').replace(/[🎯👥📊❤️💡💬✨📌💼🚀]/g, '').trim();
      const emoji = getSectionEmoji(text);
      isProductSection = /top\s+produtos|potencial\s+de\s+venda/i.test(text);
      out.push(
        `<div style="display:flex;align-items:center;gap:8px;margin:18px 0 8px;padding-bottom:6px;border-bottom:2px solid #e0f2fe;page-break-after:avoid;">
          <span style="font-size:15px;">${emoji}</span>
          <h3 style="margin:0;font-family:'Space Grotesk','Inter',sans-serif;font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(text)}</h3>
        </div>`
      );
      i++;
      continue;
    }

    // Table
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeList();
      const header = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && !isTableSeparator(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(renderTable(header, rows));
      continue;
    }

    // Ordered list (1. 2. 3.) — render as product cards in product section
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      const num = orderedMatch[1];
      let content = orderedMatch[2];
      // Collect continuation lines (indented or sub-bullets)
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (!next.trim()) break;
        if (/^(\d+)\.\s+/.test(next.trim()) || /^##/.test(next.trim()) || /^-\s+/.test(next.trim())) break;
        content += ' ' + next.trim();
        j++;
      }
      if (isProductSection) {
        out.push(renderProductCard(num, content));
      } else {
        if (!inOrdered) {
          out.push('<ol style="margin:8px 0 12px 4px;padding-left:24px;">');
          inOrdered = true;
        }
        out.push(
          `<li style="font-size:12px;line-height:1.7;color:#334155;margin:4px 0;">${renderInline(content)}</li>`
        );
      }
      i = j;
      continue;
    }

    // Bullet list
    if (/^-\s+/.test(trimmed)) {
      if (inOrdered) {
        out.push('</ol>');
        inOrdered = false;
      }
      if (!inList) {
        out.push('<ul style="list-style:none;margin:6px 0 12px;padding:0;">');
        inList = true;
      }
      const content = trimmed.replace(/^-\s+/, '');
      out.push(
        `<li style="display:flex;align-items:flex-start;gap:10px;padding:5px 0 5px 4px;font-size:12px;line-height:1.65;color:#334155;">
          <span style="margin-top:7px;width:6px;height:6px;min-width:6px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#3b82f6);display:inline-block;"></span>
          <span style="flex:1;">${renderInline(content)}</span>
        </li>`
      );
      i++;
      continue;
    }

    // Paragraph
    closeList();
    out.push(
      `<p style="font-size:12px;line-height:1.7;color:#475569;margin:6px 4px;">${renderInline(trimmed)}</p>`
    );
    i++;
  }

  closeList();
  return out.join('');
};

type PdfBranding = {
  site_name: string;
  tagline: string | null;
  footer_text: string | null;
  logo_url: string | null;
};

const buildPdfHtml = (profile: string, projectName: string | undefined, branding: PdfBranding): string => {
  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const contentHtml = markdownToPdfHtml(profile);
  const siteName = escapeHtml(branding.site_name || 'YCaptura');
  const tagline = escapeHtml(branding.tagline || 'Análise de Audiência com IA');
  const footerText = escapeHtml(branding.footer_text || 'Gerado por YCaptura — Análise inteligente de audiência');
  const logoMark = branding.logo_url
    ? `<img src="${escapeHtml(branding.logo_url)}" alt="" crossorigin="anonymous" style="max-width:48px;max-height:48px;object-fit:contain;display:block;" />`
    : `<span style="font-size:24px;">🧠</span>`;

  return `
<div style="font-family:'Inter','Segoe UI',Arial,sans-serif;background:#ffffff;color:#0f172a;width:794px;">
  <!-- Header (section) -->
  <div data-pdf-section style="background:linear-gradient(135deg,#0c4a6e 0%,#1e3a8a 100%);padding:28px 40px;color:#fff;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.2);overflow:hidden;">
          ${logoMark}
        </div>
        <div>
          <h1 style="margin:0;font-family:'Space Grotesk','Inter',sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.5px;color:#fff;">${siteName}</h1>
          <p style="margin:3px 0 0;font-size:11px;color:#bae6fd;letter-spacing:0.6px;text-transform:uppercase;font-weight:500;">${tagline}</p>
        </div>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:10px;color:#bae6fd;text-transform:uppercase;letter-spacing:0.5px;">Gerado em</p>
        <p style="margin:3px 0 0;font-size:13px;color:#fff;font-weight:600;">${date}</p>
      </div>
    </div>
  </div>

  <!-- Project Title Bar (section) -->
  <div data-pdf-section style="background:#f8fafc;padding:14px 40px;border-bottom:1px solid #e2e8f0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:14px;">📁</span>
      <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Projeto</span>
      <span style="color:#cbd5e1;">›</span>
      <span style="font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(projectName || 'Análise de Avatar')}</span>
    </div>
  </div>

  <!-- Content (each top-level child becomes a section) -->
  <div data-pdf-content style="padding:24px 40px 40px;">
    ${contentHtml}
  </div>

  <!-- Footer (section) -->
  <div data-pdf-section style="background:#0c4a6e;padding:16px 40px;display:flex;align-items:center;justify-content:space-between;color:#bae6fd;">
    <p style="margin:0;font-size:10px;">${footerText}</p>
    <p style="margin:0;font-size:10px;">${siteName}</p>
  </div>
</div>`;
};

export const AiProfileCard = ({ profile, projectName, onDelete, deleting }: AiProfileCardProps) => {
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    const container = document.createElement('div');
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.background = '#ffffff';
      const branding = await fetchBranding('pdf');
      container.innerHTML = buildPdfHtml(profile, projectName, branding);
      document.body.appendChild(container);

      // Wait a tick for layout
      await new Promise((r) => setTimeout(r, 120));

      // Build the ordered list of sections: structural sections + each top-level
      // child of the content block (so paragraphs/tables/cards/headings are
      // their own atomic units, never sliced mid-element).
      const structural = Array.from(
        container.querySelectorAll('[data-pdf-section]')
      ) as HTMLElement[];
      const contentBlock = container.querySelector('[data-pdf-content]') as HTMLElement | null;
      const contentChildren = contentBlock
        ? (Array.from(contentBlock.children) as HTMLElement[])
        : [];

      // Order: header, project bar, ...content children..., footer.
      const [headerEl, projectBarEl, footerEl] = structural;
      const sections: HTMLElement[] = [
        headerEl,
        projectBarEl,
        ...contentChildren,
        footerEl,
      ].filter(Boolean);

      // PDF layout (A4 portrait, mm)
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const PAGE_W = pdf.internal.pageSize.getWidth();   // 210
      const PAGE_H = pdf.internal.pageSize.getHeight();  // 297
      const MARGIN_TOP = 15;
      const MARGIN_BOTTOM = 18; // extra room for page number
      const MARGIN_X = 12;
      const CONTENT_W = PAGE_W - MARGIN_X * 2;
      const SECTION_GAP = 3;
      const USABLE_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;

      let cursorY = MARGIN_TOP;
      let isFirstOnPage = true;

      const renderSection = async (el: HTMLElement) => {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: 794,
        });
        const ratio = CONTENT_W / (canvas.width / 2); // canvas captured at 2x
        const widthMm = CONTENT_W;
        const fullHeightMm = (canvas.height / 2) * ratio;
        const imgData = canvas.toDataURL('image/jpeg', 0.92);

        // If the section is taller than a full page, slice it across pages.
        if (fullHeightMm > USABLE_H) {
          // start fresh page if not already at top
          if (!isFirstOnPage) {
            pdf.addPage();
            cursorY = MARGIN_TOP;
            isFirstOnPage = true;
          }

          const pxPerMm = canvas.width / widthMm;
          const pageSlicePx = USABLE_H * pxPerMm;
          let renderedPx = 0;

          while (renderedPx < canvas.height) {
            const sliceHeightPx = Math.min(pageSlicePx, canvas.height - renderedPx);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = sliceHeightPx;
            const ctx = sliceCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
              ctx.drawImage(
                canvas,
                0, renderedPx, canvas.width, sliceHeightPx,
                0, 0, canvas.width, sliceHeightPx
              );
            }
            const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
            const sliceMm = sliceHeightPx / pxPerMm;
            pdf.addImage(sliceData, 'JPEG', MARGIN_X, MARGIN_TOP, widthMm, sliceMm);
            renderedPx += sliceHeightPx;
            if (renderedPx < canvas.height) {
              pdf.addPage();
              cursorY = MARGIN_TOP;
              isFirstOnPage = true;
            } else {
              cursorY = MARGIN_TOP + sliceMm + SECTION_GAP;
              isFirstOnPage = false;
            }
          }
          return;
        }

        // Normal section: page-break if it doesn't fit
        const remaining = PAGE_H - MARGIN_BOTTOM - cursorY;
        if (fullHeightMm > remaining && !isFirstOnPage) {
          pdf.addPage();
          cursorY = MARGIN_TOP;
          isFirstOnPage = true;
        }

        pdf.addImage(imgData, 'JPEG', MARGIN_X, cursorY, widthMm, fullHeightMm);
        cursorY += fullHeightMm + SECTION_GAP;
        isFirstOnPage = false;
      };

      for (const section of sections) {
        await renderSection(section);
      }

      // Page numbers — added after all content so we know the total
      const total = pdf.getNumberOfPages();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      for (let p = 1; p <= total; p++) {
        pdf.setPage(p);
        const label = `Página ${p} de ${total}`;
        const textWidth = pdf.getTextWidth(label);
        pdf.text(label, (PAGE_W - textWidth) / 2, PAGE_H - 8);
      }

      pdf.save(`${projectName || 'perfil-avatar'}-ycaptura.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      if (container.parentNode) container.parentNode.removeChild(container);
      setExporting(false);
    }
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
          remarkPlugins={[remarkGfm]}
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
            ol: ({ children }) => (
              <ol className="space-y-2 pl-6 py-1 list-decimal marker:text-primary marker:font-bold">{children}</ol>
            ),
            li: ({ children, ...props }) => {
              // Ordered list items get card style
              if ((props as { ordered?: boolean }).ordered) {
                return (
                  <li className="text-sm text-muted-foreground leading-relaxed pl-2">
                    <span className="block bg-secondary/40 border-l-2 border-primary rounded-r-md px-3 py-2">
                      {children}
                    </span>
                  </li>
                );
              }
              return (
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="leading-relaxed">{children}</span>
                </li>
              );
            },
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="bg-primary/10">{children}</thead>
            ),
            th: ({ children }) => (
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground border-b border-border">{children}</th>
            ),
            td: ({ children }) => (
              <td className="px-3 py-2 text-sm text-muted-foreground border-b border-border/50 align-top">{children}</td>
            ),
            tr: ({ children }) => (
              <tr className="even:bg-muted/30">{children}</tr>
            ),
          }}
        >
          {profile}
        </ReactMarkdown>
      </div>
    </Card>
  );
};
