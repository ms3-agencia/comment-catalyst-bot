import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Download, Loader2, Target, Users, Heart, MessageCircle, Lightbulb, BarChart3, Briefcase, Rocket, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchBranding } from '@/hooks/useBranding';
import { fetchPdfCustomization, DEFAULT_PDF_CUSTOMIZATION, type PdfCustomization } from '@/hooks/usePdfCustomization';
import { supabase } from '@/integrations/supabase/client';

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

// ----- Avatar chart: extract section sizes from markdown to draw a bar chart -----
type ChartItem = { label: string; value: number; color: string };

const buildAvatarChartData = (md: string): ChartItem[] => {
  const lines = md.split('\n');
  const buckets: Record<string, { count: number; color: string; emoji: string }> = {
    'Demográficos': { count: 0, color: '#6366f1', emoji: '👥' },
    'Comportamento': { count: 0, color: '#0ea5e9', emoji: '📊' },
    'Interesses': { count: 0, color: '#ec4899', emoji: '❤️' },
    'Dores & Necessidades': { count: 0, color: '#f59e0b', emoji: '💡' },
    'Linguagem & Tom': { count: 0, color: '#10b981', emoji: '💬' },
    'Insights de Produto': { count: 0, color: '#8b5cf6', emoji: '💼' },
  };
  const matchBucket = (heading: string): string | null => {
    const l = heading.toLowerCase();
    if (l.includes('demográfic')) return 'Demográficos';
    if (l.includes('comportamento') || l.includes('engajamento')) return 'Comportamento';
    if (l.includes('interesse') || l.includes('tema')) return 'Interesses';
    if (l.includes('dor') || l.includes('necessidade')) return 'Dores & Necessidades';
    if (l.includes('linguagem') || l.includes('tom')) return 'Linguagem & Tom';
    if (l.includes('insight') || l.includes('produto') || l.includes('venda') || l.includes('recomenda')) return 'Insights de Produto';
    return null;
  };
  let current: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^#{2,3}\s+(.+)$/);
    if (h) {
      current = matchBucket(h[1]);
      continue;
    }
    if (!current) continue;
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      buckets[current].count += 1;
    } else if (line.length > 30 && !/^\|/.test(line)) {
      // long paragraph counts as half an insight
      buckets[current].count += 0.5;
    }
  }
  return Object.entries(buckets)
    .map(([label, v]) => ({ label: `${v.emoji} ${label}`, value: Math.round(v.count), color: v.color }))
    .filter((x) => x.value > 0);
};

const renderAvatarChartHtml = (data: ChartItem[]): string => {
  if (data.length === 0) return '';
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const rows = data
    .map((d) => {
      const pct = (d.value / max) * 100;
      const share = total > 0 ? Math.round((d.value / total) * 100) : 0;
      return `
        <div style="display:flex;align-items:center;gap:12px;margin:8px 0;">
          <div style="width:180px;font-size:12px;color:#0f172a;font-weight:600;">${escapeHtml(d.label)}</div>
          <div style="flex:1;background:#f1f5f9;border-radius:6px;height:22px;position:relative;overflow:hidden;">
            <div style="width:${pct.toFixed(1)}%;height:100%;background:linear-gradient(90deg,${d.color},${d.color}cc);border-radius:6px;"></div>
            <div style="position:absolute;right:8px;top:0;bottom:0;display:flex;align-items:center;font-size:11px;color:#0f172a;font-weight:700;">${d.value} · ${share}%</div>
          </div>
        </div>`;
    })
    .join('');
  return `
    <div data-pdf-section style="margin:20px 40px;padding:18px 20px;background:linear-gradient(135deg,#f0f9ff,#eef2ff);border-radius:12px;border:1px solid #e0e7ff;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="font-size:18px;">📈</span>
        <h2 style="margin:0;font-family:'Space Grotesk','Inter',sans-serif;font-size:16px;font-weight:700;color:#0c4a6e;">Mapa de Insights do Avatar</h2>
      </div>
      <p style="margin:0 0 10px;font-size:11px;color:#475569;">Distribuição de informações coletadas por dimensão do perfil.</p>
      ${rows}
    </div>`;
};

const buildCoverHtml = (
  custom: PdfCustomization,
  branding: PdfBranding,
  projectName: string | undefined,
  date: string,
): string => {
  const brandLabel = custom.brand_name || branding.site_name || 'Relatório';
  const title = escapeHtml(custom.cover_title || brandLabel || 'Relatório de Avatar');
  const subtitle = escapeHtml(custom.cover_subtitle || branding.tagline || 'Análise de Audiência com IA');
  const bg = custom.cover_image_url
    ? `background: linear-gradient(135deg, ${custom.primary_color}dd, ${custom.secondary_color}dd), url('${escapeHtml(custom.cover_image_url)}') center/cover no-repeat;`
    : `background: linear-gradient(135deg, ${custom.primary_color}, ${custom.secondary_color});`;
  const logo = custom.logo_url || branding.logo_url;
  const logoMark = logo
    ? `<img src="${escapeHtml(logo)}" alt="" crossorigin="anonymous" style="max-width:90px;max-height:90px;object-fit:contain;" />`
    : `<span style="font-size:56px;">🧠</span>`;
  return `
<div data-pdf-section data-pdf-cover style="${bg} color:#fff; padding:120px 40px; height:1110px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between; font-family:'${custom.font_family}','Inter',sans-serif;">
  <div style="display:flex;align-items:center;gap:18px;">
    <div style="width:90px;height:90px;border-radius:18px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,0.25);overflow:hidden;">
      ${logoMark}
    </div>
    <div>
      <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">${escapeHtml(brandLabel)}</p>
    </div>
  </div>
  <div style="text-align:left;">
    <h1 style="margin:0;font-size:46px;font-weight:800;letter-spacing:-1px;line-height:1.1;">${title}</h1>
    <p style="margin:18px 0 0;font-size:18px;opacity:0.9;font-weight:300;">${subtitle}</p>
    ${projectName ? `<p style="margin:36px 0 0;font-size:14px;opacity:0.8;">Projeto: <strong>${escapeHtml(projectName)}</strong></p>` : ''}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;opacity:0.85;">
    <span>${escapeHtml(custom.header_text || '')}</span>
    <span>${escapeHtml(date)}</span>
  </div>
</div>`;
};

const buildPdfHtml = (
  profile: string,
  projectName: string | undefined,
  branding: PdfBranding,
  custom: PdfCustomization,
  hasCustomization: boolean,
): string => {
  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const contentHtml = markdownToPdfHtml(profile);
  const chartHtml = renderAvatarChartHtml(buildAvatarChartData(profile));
  // When the user owns the customization addon and set a brand_name, it FULLY
  // replaces the platform site_name everywhere in the PDF (cover, header, footer, filename).
  const effectiveSiteName =
    hasCustomization && custom.brand_name ? custom.brand_name : (branding.site_name || 'YCaptura');
  const siteName = escapeHtml(effectiveSiteName);
  const tagline = escapeHtml(custom.cover_subtitle || branding.tagline || 'Análise de Audiência com IA');
  const logo = custom.logo_url || branding.logo_url;
  const logoMark = logo
    ? `<img src="${escapeHtml(logo)}" alt="" crossorigin="anonymous" style="max-width:48px;max-height:48px;object-fit:contain;display:block;" />`
    : `<span style="font-size:24px;">🧠</span>`;

  // Cover only when user opted in (has customization addon AND set a cover title or image)
  const coverHtml =
    hasCustomization && (custom.cover_title || custom.cover_image_url)
      ? buildCoverHtml(custom, branding, projectName, date)
      : '';

  // Custom header text (replaces project bar info if provided)
  const headerLabel = custom.header_text
    ? escapeHtml(custom.header_text)
    : escapeHtml(projectName || 'Análise de Avatar');

  // Layout variants (modern is default)
  const layout = hasCustomization ? custom.layout : 'modern';
  const headerStyles =
    layout === 'classic'
      ? `background:#ffffff;color:${custom.primary_color};padding:24px 40px;border-bottom:3px double ${custom.primary_color};`
      : layout === 'minimal'
      ? `background:#ffffff;color:#0f172a;padding:18px 40px;border-bottom:1px solid #e2e8f0;`
      : `background:linear-gradient(135deg,${custom.primary_color} 0%,${custom.secondary_color} 100%);padding:28px 40px;color:#fff;`;

  const headerTitleColor = layout === 'modern' ? '#fff' : custom.primary_color;
  const headerSubColor = layout === 'modern' ? '#bae6fd' : '#64748b';

  return `
<div style="font-family:'${custom.font_family}','Inter','Segoe UI',Arial,sans-serif;background:#ffffff;color:#0f172a;width:794px;">
  ${coverHtml}
  <div data-pdf-section style="${headerStyles}">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:14px;">
        <div style="width:48px;height:48px;border-radius:12px;background:${layout === 'modern' ? 'rgba(255,255,255,0.15)' : custom.primary_color + '15'};display:flex;align-items:center;justify-content:center;border:1px solid ${layout === 'modern' ? 'rgba(255,255,255,0.2)' : custom.primary_color + '30'};overflow:hidden;">
          ${logoMark}
        </div>
        <div>
          <h1 style="margin:0;font-family:'${custom.font_family}','Space Grotesk','Inter',sans-serif;font-size:24px;font-weight:700;letter-spacing:-0.5px;color:${headerTitleColor};">${siteName}</h1>
          <p style="margin:3px 0 0;font-size:11px;color:${headerSubColor};letter-spacing:0.6px;text-transform:uppercase;font-weight:500;">${tagline}</p>
        </div>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:10px;color:${headerSubColor};text-transform:uppercase;letter-spacing:0.5px;">Gerado em</p>
        <p style="margin:3px 0 0;font-size:13px;color:${headerTitleColor};font-weight:600;">${date}</p>
      </div>
    </div>
  </div>

  <div data-pdf-section style="background:${layout === 'minimal' ? '#ffffff' : '#f8fafc'};padding:14px 40px;border-bottom:1px solid #e2e8f0;">
    <div style="display:flex;align-items:center;gap:10px;">
      <span style="font-size:14px;">📁</span>
      <span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;">Projeto</span>
      <span style="color:#cbd5e1;">›</span>
      <span style="font-size:14px;color:#0f172a;font-weight:600;">${headerLabel}</span>
    </div>
  </div>

  ${chartHtml}

  <div data-pdf-content style="padding:24px 40px 40px;">
    ${contentHtml}
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
      const { data: { user } } = await supabase.auth.getUser();
      const [branding, customRaw] = await Promise.all([
        fetchBranding('pdf'),
        user ? fetchPdfCustomization(user.id) : Promise.resolve(null),
      ]);
      const hasCustomization = !!customRaw;
      const custom = customRaw || DEFAULT_PDF_CUSTOMIZATION;
      container.innerHTML = buildPdfHtml(profile, projectName, branding, custom, hasCustomization);
      document.body.appendChild(container);

      // Wait for layout + fonts + images (parallel, with timeouts)
      const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
      await Promise.all([
        (document as any).fonts?.ready ?? Promise.resolve(),
        ...imgs.map(
          (img) =>
            new Promise<void>((res) => {
              if (img.complete) return res();
              const done = () => res();
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
              setTimeout(done, 1500);
            })
        ),
      ]);

      // Collect atomic break-points (px offsets, relative to container) so we
      // never slice mid-element. We rasterize the WHOLE container ONCE and then
      // cut by these markers — orders of magnitude faster than per-element render.
      const atomic: HTMLElement[] = [
        ...(Array.from(container.querySelectorAll('[data-pdf-section]')) as HTMLElement[]),
        ...((container.querySelector('[data-pdf-content]')?.children
          ? (Array.from(
              (container.querySelector('[data-pdf-content]') as HTMLElement).children
            ) as HTMLElement[])
          : []) as HTMLElement[]),
      ].filter((el) => el && el.offsetHeight >= 2);

      // PDF layout (A4 portrait, mm)
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      const PAGE_W = pdf.internal.pageSize.getWidth();
      const PAGE_H = pdf.internal.pageSize.getHeight();
      const MARGIN_TOP = 14;
      const MARGIN_BOTTOM = 22;
      const MARGIN_X = 12;
      const CONTENT_W = PAGE_W - MARGIN_X * 2;
      const USABLE_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
      const SCALE = 1.4; // good print quality, fast rasterization

      // ONE single rasterization pass for the whole document
      const fullCanvas = await html2canvas(container, {
        scale: SCALE,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        logging: false,
      });

      const pxPerMm = fullCanvas.width / CONTENT_W;
      const pageHeightPx = Math.floor(USABLE_H * pxPerMm);
      const containerRect = container.getBoundingClientRect();

      // Build sorted list of atomic boundaries in canvas px
      const breakPoints = atomic
        .map((el) => {
          const r = el.getBoundingClientRect();
          const top = (r.top - containerRect.top) * SCALE;
          const bottom = (r.bottom - containerRect.top) * SCALE;
          return { top, bottom };
        })
        .sort((a, b) => a.top - b.top);

      // If a cover exists, force a page break right after it (so the header
      // never bleeds into the same page as the cover).
      const coverEl = container.querySelector('[data-pdf-cover]') as HTMLElement | null;
      const coverBottomPx = coverEl
        ? Math.ceil((coverEl.getBoundingClientRect().bottom - containerRect.top) * SCALE)
        : 0;

      // Find the best cut Y ≤ desiredCut that doesn't fall inside an atomic block.
      const findSafeCut = (startPx: number, desiredCut: number): number => {
        let safe = desiredCut;
        for (const b of breakPoints) {
          if (b.bottom <= startPx) continue;
          if (b.top >= desiredCut) break;
          // Block straddles desired cut → push cut up to its top
          if (b.top < desiredCut && b.bottom > desiredCut) {
            if (b.top > startPx) safe = Math.min(safe, b.top);
          }
        }
        // Don't allow tiny pages (would loop). Fallback to desired cut.
        if (safe - startPx < pageHeightPx * 0.25) return desiredCut;
        return Math.floor(safe);
      };

      let renderedPx = 0;
      let firstPage = true;
      let coverDone = coverBottomPx === 0;
      while (renderedPx < fullCanvas.height) {
        let endPx: number;
        if (!coverDone) {
          // The cover is rendered as a single full page (it's sized to ~A4).
          endPx = Math.min(coverBottomPx, fullCanvas.height);
          coverDone = true;
        } else {
          const desiredEnd = Math.min(renderedPx + pageHeightPx, fullCanvas.height);
          endPx = desiredEnd >= fullCanvas.height ? desiredEnd : findSafeCut(renderedPx, desiredEnd);
        }
        const sliceH = endPx - renderedPx;

        const slice = document.createElement('canvas');
        slice.width = fullCanvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(fullCanvas, 0, renderedPx, fullCanvas.width, sliceH, 0, 0, fullCanvas.width, sliceH);
        }
        const sliceData = slice.toDataURL('image/jpeg', 0.82);
        const sliceMm = sliceH / pxPerMm;
        if (!firstPage) pdf.addPage();
        // The cover slice gets edge-to-edge placement (no margin) so the gradient fills the page.
        const isCoverSlice = firstPage && coverBottomPx > 0;
        if (isCoverSlice) {
          pdf.addImage(sliceData, 'JPEG', 0, 0, PAGE_W, PAGE_H);
        } else {
          pdf.addImage(sliceData, 'JPEG', MARGIN_X, MARGIN_TOP, CONTENT_W, sliceMm);
        }
        firstPage = false;
        renderedPx = endPx;
      }

      // Footer drawn natively on EVERY page at a fixed bottom Y
      // (so it always sits at the end of the sheet, even with white space above on the last page).
      const effectiveBrand = (hasCustomization && custom.brand_name) ? custom.brand_name : (branding.site_name || 'YCaptura');
      const defaultFooter = `Gerado por ${effectiveBrand}`;
      const footerText = custom.footer_text || branding.footer_text || defaultFooter;
      const brandLabel = effectiveBrand;
      const total = pdf.getNumberOfPages();
      // Parse primary color hex into RGB for native PDF drawing
      const hexToRgb = (hex: string): [number, number, number] => {
        const h = hex.replace('#', '');
        const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
        return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
      };
      const [pr, pg, pb] = hexToRgb(hasCustomization ? custom.primary_color : '#0c4a6e');
      const wmText = hasCustomization ? custom.watermark_text : null;
      const wmAlpha = Math.max(0.05, Math.min(0.5, custom.watermark_opacity || 0.1));

      const hasCover = coverBottomPx > 0;
      for (let p = 1; p <= total; p++) {
        pdf.setPage(p);

        // Cover page is full-bleed (its own gradient + footer info) — skip overlays.
        const isCoverPage = hasCover && p === 1;
        if (isCoverPage) continue;

        // Watermark (diagonal, behind content)
        if (wmText) {
          pdf.saveGraphicsState();
          // jsPDF: GState for opacity
          // @ts-ignore
          pdf.setGState(new (pdf as any).GState({ opacity: wmAlpha }));
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(70);
          pdf.setTextColor(pr, pg, pb);
          pdf.text(wmText, PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 45 });
          pdf.restoreGraphicsState();
        }

        // Footer band
        pdf.setFillColor(pr, pg, pb);
        pdf.rect(0, PAGE_H - 14, PAGE_W, 14, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(footerText, MARGIN_X, PAGE_H - 5.5);
        const right = `${brandLabel}  ·  Página ${p}/${total}`;
        const rightW = pdf.getTextWidth(right);
        pdf.text(right, PAGE_W - MARGIN_X - rightW, PAGE_H - 5.5);
      }

      const brandSlug = effectiveBrand.toLowerCase().replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'relatorio';
      const fileName = `${(projectName || 'perfil-avatar').replace(/[^\w\-]+/g, '_')}-${brandSlug}.pdf`;
      try {
        pdf.save(fileName);
      } catch (saveErr) {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Erro ao gerar PDF: ' + (err instanceof Error ? err.message : 'desconhecido'));
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
        <div className="flex items-center gap-2">
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
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={deleting}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Excluir projeto"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
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
