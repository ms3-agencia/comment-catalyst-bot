import jsPDF from 'jspdf';
import 'jspdf/dist/polyfills.es.js';
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export type EbookFull = {
  id: string;
  title: string;
  subtitle?: string | null;
  cover_url?: string | null;
  introduction?: string | null;
  conclusion?: string | null;
  cta?: string | null;
  method_name?: string | null;
  promise?: string | null;
  chapters: { chapter_number: number; title: string; content_html: string }[];
};

const stripHtml = (html: string) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  return tmp.innerText;
};

const htmlToPlainParagraphs = (html: string): string[] => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  const out: string[] = [];
  tmp.querySelectorAll('h2,h3,p,li,blockquote').forEach((el) => {
    const t = (el.textContent || '').trim();
    if (t) out.push(t);
  });
  if (out.length === 0 && tmp.innerText.trim()) out.push(tmp.innerText.trim());
  return out;
};

export async function exportEbookTxt(ebook: EbookFull) {
  const lines: string[] = [];
  lines.push(ebook.title.toUpperCase());
  if (ebook.subtitle) lines.push(ebook.subtitle);
  if (ebook.method_name) lines.push(`\nMétodo: ${ebook.method_name}`);
  if (ebook.promise) lines.push(`Promessa: ${ebook.promise}`);
  lines.push('\n' + '='.repeat(60) + '\n');
  if (ebook.introduction) {
    lines.push('INTRODUÇÃO\n');
    lines.push(stripHtml(ebook.introduction));
    lines.push('\n' + '-'.repeat(60) + '\n');
  }
  ebook.chapters.sort((a, b) => a.chapter_number - b.chapter_number).forEach((c) => {
    lines.push(`CAPÍTULO ${c.chapter_number} — ${c.title}\n`);
    lines.push(stripHtml(c.content_html));
    lines.push('\n' + '-'.repeat(60) + '\n');
  });
  if (ebook.conclusion) {
    lines.push('CONCLUSÃO\n');
    lines.push(stripHtml(ebook.conclusion));
  }
  if (ebook.cta) lines.push('\n' + ebook.cta);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, `${ebook.title.replace(/[^\w\s-]/g, '').slice(0, 80)}.txt`);
}

export async function exportEbookMarkdown(ebook: EbookFull) {
  const md: string[] = [];
  md.push(`# ${ebook.title}`);
  if (ebook.subtitle) md.push(`### ${ebook.subtitle}\n`);
  if (ebook.method_name) md.push(`> **Método:** ${ebook.method_name}`);
  if (ebook.promise) md.push(`> **Promessa:** ${ebook.promise}\n`);
  if (ebook.introduction) {
    md.push(`\n## Introdução\n`);
    md.push(htmlToMarkdown(ebook.introduction));
  }
  ebook.chapters.sort((a, b) => a.chapter_number - b.chapter_number).forEach((c) => {
    md.push(`\n## Capítulo ${c.chapter_number} — ${c.title}\n`);
    md.push(htmlToMarkdown(c.content_html));
  });
  if (ebook.conclusion) {
    md.push(`\n## Conclusão\n`);
    md.push(htmlToMarkdown(ebook.conclusion));
  }
  if (ebook.cta) md.push(`\n---\n\n**${ebook.cta}**\n`);
  const blob = new Blob([md.join('\n')], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, `${ebook.title.replace(/[^\w\s-]/g, '').slice(0, 80)}.md`);
}

function htmlToMarkdown(html: string): string {
  let s = html || '';
  s = s.replace(/<h2[^>]*>(.*?)<\/h2>/gis, '\n### $1\n');
  s = s.replace(/<h3[^>]*>(.*?)<\/h3>/gis, '\n#### $1\n');
  s = s.replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**');
  s = s.replace(/<b[^>]*>(.*?)<\/b>/gis, '**$1**');
  s = s.replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*');
  s = s.replace(/<i[^>]*>(.*?)<\/i>/gis, '*$1*');
  s = s.replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n');
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  s = s.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n');
  s = s.replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

export async function exportEbookDocx(ebook: EbookFull) {
  const children: Paragraph[] = [];
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: ebook.title, bold: true })] }));
  if (ebook.subtitle) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: ebook.subtitle, italics: true, size: 28 })] }));
  if (ebook.method_name) children.push(new Paragraph({ children: [new TextRun({ text: `Método: ${ebook.method_name}`, bold: true })] }));
  if (ebook.promise) children.push(new Paragraph({ children: [new TextRun({ text: `Promessa: ${ebook.promise}`, italics: true })] }));
  children.push(new Paragraph({ text: '' }));

  const pushHtml = (html: string) => {
    htmlToPlainParagraphs(html).forEach((line) => children.push(new Paragraph({ children: [new TextRun(line)] })));
  };

  if (ebook.introduction) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Introdução')] }));
    pushHtml(ebook.introduction);
  }
  ebook.chapters.sort((a, b) => a.chapter_number - b.chapter_number).forEach((c) => {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Capítulo ${c.chapter_number} — ${c.title}`)] }));
    pushHtml(c.content_html);
  });
  if (ebook.conclusion) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Conclusão')] }));
    pushHtml(ebook.conclusion);
  }
  if (ebook.cta) {
    children.push(new Paragraph({ children: [new TextRun({ text: ebook.cta, bold: true })] }));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${ebook.title.replace(/[^\w\s-]/g, '').slice(0, 80)}.docx`);
}

/**
 * Opções de personalização do sumário (TOC) no PDF.
 * - `truncate`: corta títulos longos e adiciona o sufixo (default '…').
 *               Pode ser por caracteres (`maxChars`) e/ou ajustado para caber
 *               em uma única linha do TOC (`fitToLine`, default true).
 * - `showSubchapters`: liga/desliga o nível 2 (h2/h3 dentro do conteúdo).
 * - `showSubtitle`: mostra o subtítulo "Toque em qualquer item…".
 * - `title`: título exibido no topo do sumário.
 * - `labels`: permite renomear/transformar rótulos (ex.: traduzir "Capítulo").
 *             Recebe a entrada e devolve a string a desenhar. Retornar null
 *             oculta a entrada — o link continua válido para as outras.
 */
export type TocOptions = {
  truncate?: {
    enabled?: boolean;       // default: true
    maxChars?: number;       // default: undefined (sem limite por caracteres)
    suffix?: string;         // default: '…'
    fitToLine?: boolean;     // default: true — encurta para caber na largura
  };
  showSubchapters?: boolean; // default: true
  showSubtitle?: boolean;    // default: true
  title?: string;            // default: 'Sumário'
  formatLabel?: (entry: {
    label: string;
    level: 1 | 2;
    kind: 'intro' | 'chapter' | 'sub' | 'conclusion';
  }) => string | null;
  /**
   * Modo de "foco": deixa o marcador da seção (alvo do salto) muito mais
   * evidente para o leitor localizar rapidamente onde aterrissou após
   * clicar em um item do sumário.
   *  - 'subtle' (default): caixa cyan-50, barra fina, chip discreto.
   *  - 'focus':           caixa cyan-100 + borda, barra grossa, badge
   *                        "VOCÊ ESTÁ AQUI" e número/ícone maior.
   *  - 'off':             desliga o realce visual (mantém apenas a âncora
   *                        para o link funcionar).
   */
  focusMode?: 'subtle' | 'focus' | 'off';
  /**
   * Estilo do destaque desenhado no alvo da seção (caixa de fundo, barra
   * lateral, bullet e chip "alvo"). Cada propriedade é opcional — o que
   * não for informado herda o default do `focusMode`.
   *
   * Cores podem ser passadas como:
   *  - hex string `'#0891b2'` ou `'#0891b2cc'` (com alpha)
   *  - tupla `[r, g, b]` (0–255)
   */
  highlightStyle?: {
    /** Cor da caixa de fundo atrás do título */
    backgroundColor?: string | [number, number, number];
    /** Cor da borda da caixa (apenas em 'focus' por padrão) */
    borderColor?: string | [number, number, number];
    /** Mostrar/ocultar a borda da caixa */
    showBorder?: boolean;
    /** Cor da barra lateral à esquerda do título */
    barColor?: string | [number, number, number];
    /** Largura da barra lateral em pt (default: 3 / focus: 6) */
    barWidth?: number;
    /** Cor do(s) bullet(s) circular(es) na barra */
    bulletColor?: string | [number, number, number];
    /** Raio do bullet em pt (default: 2.6 / focus: 4) */
    bulletRadius?: number;
    /** Mostrar/ocultar o chip lateral ("↳ alvo do sumário"/"VOCÊ ESTÁ AQUI") */
    showChip?: boolean;
    /** Texto do chip — sobrescreve o default do `focusMode` */
    chipText?: string;
    /** Cor de fundo do chip */
    chipBackgroundColor?: string | [number, number, number];
    /** Cor do texto do chip */
    chipTextColor?: string | [number, number, number];
    /** Padding vertical extra do realce em pt */
    paddingY?: number;
    /** Padding horizontal extra (sangria nas margens) em pt */
    paddingX?: number;
  };
};

/**
 * Resultado da verificação automática dos links do sumário.
 *  - `ok`: true se todas as entradas apontam para páginas/coordenadas válidas.
 *  - `total`: total de entradas verificadas.
 *  - `valid`: quantas passaram em todos os checks.
 *  - `issues`: lista detalhada de problemas encontrados (uma por entrada).
 */
export type TocVerificationIssue = {
  index: number;
  label: string;
  level: 1 | 2;
  page: number;
  top?: number;
  reason:
    | 'page-out-of-range'
    | 'top-out-of-range'
    | 'missing-anchor'
    | 'duplicate-target'
    | 'page-points-to-toc'
    | 'page-points-to-cover';
  message: string;
};

export type TocVerificationReport = {
  ok: boolean;
  total: number;
  valid: number;
  totalPages: number;
  issues: TocVerificationIssue[];
};

/**
 * Converte HTML rico em uma lista linear de blocos de texto que serão
 * renderizados nativamente pelo jsPDF (texto vetorial, sem html2canvas).
 * Isso é dezenas de vezes mais rápido que rasterizar bloco a bloco e
 * gera PDFs muito menores e com texto pesquisável/copiável.
 */
type RichRun = { text: string; bold?: boolean; italic?: boolean };
type TableCell = { text: string; header?: boolean };
type TableRow = TableCell[];
type RichBlock =
  | { kind: 'h2'; runs: RichRun[] }
  | { kind: 'h3'; runs: RichRun[] }
  | { kind: 'p'; runs: RichRun[] }
  | { kind: 'li'; runs: RichRun[]; ordered: boolean; index: number }
  | { kind: 'quote'; runs: RichRun[] }
  | { kind: 'table'; head: TableRow; body: TableRow[] }
  | { kind: 'spacer'; pt: number };

const parseRichHtml = (html: string): RichBlock[] => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  const blocks: RichBlock[] = [];

  const collectRuns = (node: Node, ctx: { bold?: boolean; italic?: boolean } = {}): RichRun[] => {
    const runs: RichRun[] = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent || '').replace(/\s+/g, ' ');
        if (text) runs.push({ text, bold: ctx.bold, italic: ctx.italic });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toUpperCase();
      const next = { ...ctx };
      if (tag === 'STRONG' || tag === 'B') next.bold = true;
      if (tag === 'EM' || tag === 'I') next.italic = true;
      if (tag === 'BR') {
        runs.push({ text: '\n' });
        return;
      }
      runs.push(...collectRuns(el, next));
    });
    return runs;
  };

  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent || '').trim();
        if (text) blocks.push({ kind: 'p', runs: [{ text }] });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toUpperCase();
      switch (tag) {
        case 'H1':
        case 'H2':
          blocks.push({ kind: 'h2', runs: collectRuns(el) });
          break;
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6':
          blocks.push({ kind: 'h3', runs: collectRuns(el) });
          break;
        case 'P':
          {
            const runs = collectRuns(el);
            if (runs.some((r) => r.text.trim())) blocks.push({ kind: 'p', runs });
          }
          break;
        case 'BLOCKQUOTE':
          blocks.push({ kind: 'quote', runs: collectRuns(el) });
          break;
        case 'UL':
        case 'OL': {
          const ordered = tag === 'OL';
          const items = Array.from(el.children).filter((c) => c.tagName.toUpperCase() === 'LI');
          items.forEach((li, i) => {
            blocks.push({ kind: 'li', runs: collectRuns(li), ordered, index: i + 1 });
          });
          break;
        }
        case 'BR':
          blocks.push({ kind: 'spacer', pt: 6 });
          break;
        case 'HR':
          blocks.push({ kind: 'spacer', pt: 12 });
          break;
        default:
          // Containers genéricos: continua descendo
          walk(el);
      }
    });
  };

  walk(tmp);
  return blocks;
};

export async function exportEbookPdf(
  ebook: EbookFull,
  onProgress?: (info: { current: number; total: number; label: string }) => void,
  tocOptions?: TocOptions,
) {
  // Estratégia: texto vetorial nativo do jsPDF (rápido, leve e pesquisável).
  // Apenas a capa usa imagem. Conteúdo é parseado de HTML para blocos e
  // renderizado com `pdf.text` + quebra de linha automática. Isso evita o
  // gargalo do html2canvas (que era O(n) em chamadas de rasterização).

  const sortedChapters = [...ebook.chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();   // 595.28
  const pageH = pdf.internal.pageSize.getHeight();  // 841.89
  const marginX = 56;
  const marginTop = 64;
  const marginBottom = 64;
  const contentW = pageW - marginX * 2;
  const contentTop = marginTop;
  const contentBottom = pageH - marginBottom;
  const contentH = contentBottom - contentTop;

  // Renderização nativa: usamos as fontes built-in do jsPDF (helvetica) e
  // desenhamos o texto vetorialmente. É ~50x mais rápido que html2canvas e
  // produz PDFs muito menores, com texto pesquisável e copiável.
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(30, 41, 59);

  let cursorY = contentTop;
  let pageNum = 1;
  // Conjunto de páginas que NÃO devem receber cabeçalho/rodapé (ex.: capa)
  const skipChromePages = new Set<number>();

  const newPage = () => {
    pdf.addPage();
    pageNum += 1;
    cursorY = contentTop;
  };

  // Desenha cabeçalho + rodapé em todas as páginas no final (exceto as marcadas)
  const drawAllChrome = () => {
    const total = pdf.getNumberOfPages();
    // Páginas numeradas para o leitor: ignoram a capa, então mostramos
    // "página X de Y" considerando apenas as páginas com chrome.
    const numberedPages: number[] = [];
    for (let p = 1; p <= total; p++) {
      if (!skipChromePages.has(p)) numberedPages.push(p);
    }
    const numberedTotal = numberedPages.length;

    for (let p = 1; p <= total; p++) {
      if (skipChromePages.has(p)) continue;
      pdf.setPage(p);

      // ===== Cabeçalho =====
      const headerY = 32; // px do topo
      const headerText = (ebook.title || '').trim();
      if (headerText) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 116, 139); // slate-500
        // Trunca se ultrapassar largura disponível (deixa espaço à direita p/ subtítulo curto)
        const maxHeaderW = pageW - marginX * 2;
        const lines = pdf.splitTextToSize(headerText, maxHeaderW);
        pdf.text(lines[0], marginX, headerY);
      }
      // Linha divisória do header
      pdf.setDrawColor(8, 145, 178); // cyan #0891b2
      pdf.setLineWidth(0.6);
      pdf.line(marginX, headerY + 6, pageW - marginX, headerY + 6);

      // ===== Rodapé =====
      const footerY = pageH - 24;
      // Linha divisória do footer
      pdf.setDrawColor(226, 232, 240); // slate-200
      pdf.setLineWidth(0.4);
      pdf.line(marginX, footerY - 12, pageW - marginX, footerY - 12);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);

      // Esquerda: título (curto)
      if (headerText) {
        const left = pdf.splitTextToSize(headerText, (pageW - marginX * 2) * 0.6)[0];
        pdf.text(left, marginX, footerY);
      }

      // Direita: paginação "Página X de Y"
      const idx = numberedPages.indexOf(p);
      if (idx !== -1) {
        const label = `Página ${idx + 1} de ${numberedTotal}`;
        pdf.text(label, pageW - marginX, footerY, { align: 'right' });
      }

      // Restaura cor padrão
      pdf.setTextColor(30, 41, 59);
    }
  };

  // Quando renderizamos blocos, queremos respeitar o espaço do header.
  // Aumentamos o "topo de conteúdo" para não colidir com a faixa do header.
  // (já configurado em contentTop = marginTop = 64 — espaço suficiente)

  // ===== Render nativo (jsPDF.text) =====
  // Estilo por tipo de bloco. Tudo em pt.
  const STYLES = {
    h2: { size: 18, font: 'helvetica' as const, weight: 'bold' as const, color: [8, 145, 178] as [number, number, number], lineH: 1.3, marginBottom: 10, underline: true },
    h3: { size: 14, font: 'helvetica' as const, weight: 'bold' as const, color: [14, 116, 144] as [number, number, number], lineH: 1.35, marginBottom: 8, underline: false },
    p:  { size: 11, font: 'helvetica' as const, weight: 'normal' as const, color: [30, 41, 59] as [number, number, number], lineH: 1.55, marginBottom: 8, underline: false },
    li: { size: 11, font: 'helvetica' as const, weight: 'normal' as const, color: [30, 41, 59] as [number, number, number], lineH: 1.55, marginBottom: 4, underline: false },
    quote: { size: 11, font: 'helvetica' as const, weight: 'normal' as const, color: [21, 94, 117] as [number, number, number], lineH: 1.55, marginBottom: 10, underline: false },
  };

  const ensureSpace = (need: number) => {
    if (cursorY + need > contentBottom) newPage();
  };

  // Concatena runs preservando bold/italic — para simplicidade, usa peso/estilo
  // dominante do bloco e quebra linhas via splitTextToSize. Marcações
  // (negrito/itálico) inline são desenhadas em uma segunda passada por palavra
  // apenas se o bloco tiver runs mistas — caso contrário usa caminho rápido.
  const runsToText = (runs: RichRun[]) =>
    runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();

  const drawWrappedText = (
    text: string,
    x: number,
    maxW: number,
    style: { size: number; font: 'helvetica'; weight: 'normal' | 'bold'; color: [number, number, number]; lineH: number; marginBottom: number },
  ) => {
    if (!text) return;
    pdf.setFont(style.font, style.weight);
    pdf.setFontSize(style.size);
    pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
    const lines = pdf.splitTextToSize(text, maxW) as string[];
    const lineHeight = style.size * style.lineH;
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, x, cursorY + style.size * 0.85);
      cursorY += lineHeight;
    }
    cursorY += style.marginBottom;
  };

  const drawBlock = (block: RichBlock) => {
    if (block.kind === 'spacer') {
      ensureSpace(block.pt);
      cursorY += block.pt;
      return;
    }
    if (block.kind === 'h2') {
      const text = runsToText(block.runs);
      if (!text) return;
      // Garante espaço para evitar título órfão no fim da página
      ensureSpace(STYLES.h2.size * 1.5 + 24);
      drawWrappedText(text, marginX, contentW, STYLES.h2);
      // Linha decorativa cyan abaixo do h2
      pdf.setDrawColor(8, 145, 178);
      pdf.setLineWidth(1.2);
      const lineY = cursorY - STYLES.h2.marginBottom + 2;
      pdf.line(marginX, lineY, marginX + Math.min(180, contentW), lineY);
      cursorY += 4;
      return;
    }
    if (block.kind === 'h3') {
      const text = runsToText(block.runs);
      if (!text) return;
      ensureSpace(STYLES.h3.size * 1.5 + 12);
      drawWrappedText(text, marginX, contentW, STYLES.h3);
      return;
    }
    if (block.kind === 'p') {
      drawWrappedText(runsToText(block.runs), marginX, contentW, STYLES.p);
      return;
    }
    if (block.kind === 'li') {
      const bullet = block.ordered ? `${block.index}.` : '•';
      const indent = 16;
      const bulletW = pdf.getTextWidth(bullet) + 4;
      const text = runsToText(block.runs);
      if (!text) return;
      // Desenha bullet primeiro
      pdf.setFont(STYLES.li.font, 'bold');
      pdf.setFontSize(STYLES.li.size);
      pdf.setTextColor(8, 145, 178);
      const lineHeight = STYLES.li.size * STYLES.li.lineH;
      ensureSpace(lineHeight);
      pdf.text(bullet, marginX + indent - bulletW, cursorY + STYLES.li.size * 0.85);
      // Texto da li (com recuo)
      drawWrappedText(text, marginX + indent, contentW - indent, STYLES.li);
      return;
    }
    if (block.kind === 'quote') {
      const text = runsToText(block.runs);
      if (!text) return;
      const padX = 12;
      const padY = 8;
      pdf.setFont(STYLES.quote.font, 'normal');
      pdf.setFontSize(STYLES.quote.size);
      const lines = pdf.splitTextToSize(text, contentW - padX * 2 - 6) as string[];
      const lineHeight = STYLES.quote.size * STYLES.quote.lineH;
      const totalH = lines.length * lineHeight + padY * 2;
      ensureSpace(totalH + 6);
      // Caixa de fundo + barra
      pdf.setFillColor(236, 254, 255); // cyan-50
      pdf.rect(marginX, cursorY, contentW, totalH, 'F');
      pdf.setFillColor(8, 145, 178);
      pdf.rect(marginX, cursorY, 3, totalH, 'F');
      pdf.setTextColor(STYLES.quote.color[0], STYLES.quote.color[1], STYLES.quote.color[2]);
      let ty = cursorY + padY;
      for (const line of lines) {
        pdf.text(line, marginX + padX + 6, ty + STYLES.quote.size * 0.85);
        ty += lineHeight;
      }
      cursorY += totalH + STYLES.quote.marginBottom;
      return;
    }
  };

  const addSpacer = (pt: number) => {
    if (cursorY + pt > contentBottom) {
      newPage();
      return;
    }
    cursorY += pt;
  };

  const startNewPageSection = () => {
    if (cursorY > contentTop + 0.5) newPage();
  };

  /**
   * Desenha um marcador visual de "destaque" no início de uma seção:
   *  - Caixa de fundo cyan-claro atrás do título (efeito :target).
   *  - Borda esquerda cyan com bullet no topo (lembra um "marcador").
   *  - Pequeno chip "↳ alvo do sumário" do lado direito (apenas nível 1)
   *    para reforçar visualmente que esse é o alvo da navegação.
   *
   * O destaque é desenhado ANTES do título: como o título é renderizado em
   * cima como uma imagem (html2canvas) com fundo transparente, o
   * sombreamento aparece "atrás" do texto sem afetar a tipografia.
   *
   * Retorna a coordenada Y do topo do destaque (em pt), para usar como
   * `top` no `pdf.link`. Os elementos extras na margem/lateral não
   * consomem espaço da coluna de texto principal.
   */
  const focusMode = tocOptions?.focusMode ?? 'subtle';
  const userStyle = tocOptions?.highlightStyle ?? {};

  // Converte hex/tupla para [r,g,b] (0–255). Aceita '#abc', '#aabbcc' e
  // '#aabbccdd' (alpha é descartado — jsPDF não suporta alpha em fill).
  const toRgb = (
    c: string | [number, number, number] | undefined,
    fallback: [number, number, number],
  ): [number, number, number] => {
    if (!c) return fallback;
    if (Array.isArray(c)) return [c[0] | 0, c[1] | 0, c[2] | 0];
    let s = c.trim().replace(/^#/, '');
    if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
    if (s.length === 8) s = s.slice(0, 6);
    if (s.length !== 6 || /[^0-9a-fA-F]/.test(s)) return fallback;
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  };

  const drawSectionAnchor = (level: 1 | 2 = 1): number => {
    const anchorY = cursorY;
    if (focusMode === 'off') return anchorY;

    const isFocus = focusMode === 'focus';

    // ===== Defaults por modo =====
    const defaults = {
      bg: isFocus ? ([207, 250, 254] as [number, number, number]) : ([236, 254, 255] as [number, number, number]),
      border: [34, 211, 238] as [number, number, number],
      bar: [8, 145, 178] as [number, number, number],
      bullet: [34, 211, 238] as [number, number, number],
      chipBg: isFocus ? ([8, 145, 178] as [number, number, number]) : ([207, 250, 254] as [number, number, number]),
      chipText: isFocus ? ([255, 255, 255] as [number, number, number]) : ([14, 116, 144] as [number, number, number]),
      chipBorder: [165, 243, 252] as [number, number, number],
    };

    // ===== Resolve estilo final (user > defaults) =====
    const bg = toRgb(userStyle.backgroundColor, defaults.bg);
    const border = toRgb(userStyle.borderColor, defaults.border);
    const bar = toRgb(userStyle.barColor, defaults.bar);
    const bullet = toRgb(userStyle.bulletColor, defaults.bullet);
    const chipBg = toRgb(userStyle.chipBackgroundColor, defaults.chipBg);
    const chipTextColor = toRgb(userStyle.chipTextColor, defaults.chipText);

    const showBorder = userStyle.showBorder ?? isFocus;
    const showChip = userStyle.showChip ?? false;
    const chipText = userStyle.chipText ?? '';

    const defaultBarW = level === 2 ? (isFocus ? 4 : 2) : (isFocus ? 6 : 3);
    const barW = Math.max(0.5, userStyle.barWidth ?? defaultBarW);
    const defaultBulletR = isFocus ? 4 : 2.6;
    const bulletR = Math.max(0, userStyle.bulletRadius ?? defaultBulletR);

    const highlightH = level === 2 ? (isFocus ? 28 : 22) : (isFocus ? 46 : 34);
    const padX = userStyle.paddingX ?? (isFocus ? 10 : 6);
    const padY = userStyle.paddingY ?? (isFocus ? 4 : 2);
    const barX = marginX - (isFocus ? 14 : 10);

    // ===== 1) Caixa de fundo =====
    pdf.setFillColor(bg[0], bg[1], bg[2]);
    pdf.rect(
      marginX - padX,
      anchorY - padY,
      contentW + padX * 2,
      highlightH,
      'F',
    );

    if (showBorder) {
      pdf.setDrawColor(border[0], border[1], border[2]);
      pdf.setLineWidth(isFocus ? 0.8 : 0.5);
      pdf.rect(
        marginX - padX,
        anchorY - padY,
        contentW + padX * 2,
        highlightH,
        'S',
      );
    }

    // ===== 2) Barra lateral + bullet =====
    if (barW > 0) {
      pdf.setFillColor(bar[0], bar[1], bar[2]);
      pdf.rect(barX, anchorY + 2, barW, highlightH - 4, 'F');
    }
    if (level === 1 && bulletR > 0) {
      pdf.setFillColor(bullet[0], bullet[1], bullet[2]);
      pdf.circle(barX + barW / 2, anchorY, bulletR, 'F');
      if (isFocus) {
        pdf.circle(barX + barW / 2, anchorY + highlightH, bulletR, 'F');
      }
    }

    // ===== 3) Chip indicador =====
    if (level === 1 && showChip && chipText) {
      pdf.setFont('helvetica', isFocus ? 'bold' : 'normal');
      pdf.setFontSize(isFocus ? 9 : 7.5);
      const chipW = pdf.getTextWidth(chipText) + (isFocus ? 16 : 10);
      const chipH = isFocus ? 16 : 11;
      const chipX = pageW - marginX - chipW;
      const chipY = anchorY + (isFocus ? 4 : 2);

      pdf.setFillColor(chipBg[0], chipBg[1], chipBg[2]);
      pdf.roundedRect(chipX, chipY, chipW, chipH, isFocus ? 4 : 3, isFocus ? 4 : 3, 'F');
      if (!isFocus) {
        pdf.setDrawColor(defaults.chipBorder[0], defaults.chipBorder[1], defaults.chipBorder[2]);
        pdf.setLineWidth(0.4);
        pdf.roundedRect(chipX, chipY, chipW, chipH, 3, 3, 'S');
      }
      pdf.setTextColor(chipTextColor[0], chipTextColor[1], chipTextColor[2]);
      pdf.text(chipText, chipX + (isFocus ? 8 : 5), chipY + (isFocus ? 11 : 7.5));
      // Restaura cor padrão
      pdf.setTextColor(30, 41, 59);
    }

    if (isFocus) cursorY += 6;
    return anchorY;
  };

  // Renderiza um HTML simples como blocos nativos (não quebra para subcapítulos).
  const renderHtmlBlock = async (html: string) => {
    const blocks = parseRichHtml(html);
    for (const b of blocks) drawBlock(b);
  };

  // Renderiza HTML rico bloco-a-bloco. Quando `registerSubheadings`, h2/h3 são
  // âncoras para o sumário (nível 2).
  const renderRichHtml = async (html: string, registerSubheadings = false) => {
    const blocks = parseRichHtml(html);
    if (blocks.length === 0) return;
    for (const b of blocks) {
      if (registerSubheadings && (b.kind === 'h2' || b.kind === 'h3')) {
        const text = runsToText(b.runs);
        if (text) {
          // Garante espaço para o subtítulo + algumas linhas
          ensureSpace(80);
          const subAnchorY = drawSectionAnchor(2);
          const subAnchorPage = pageNum;
          drawBlock(b);
          pushTocEntry({
            label: text,
            page: subAnchorPage,
            level: 2,
            kind: 'sub',
            order: activeChapterOrder,
            parentOrder: activeChapterOrder,
            subSeq: activeSubSeq++,
            anchorY: subAnchorY,
          });
          continue;
        }
      }
      drawBlock(b);
    }
  };

  // ===== Montagem das seções =====
  type Step = { label: string; tocLabel?: string; isToc?: boolean; run: () => Promise<void> };
  const steps: Step[] = [];

  // Registro do TOC: capturado durante a renderização.
  // - kind: agrupamento (intro / chapter / conclusion / sub).
  // - order: ordem canônica dentro do grupo (ex.: chapter_number).
  // - parentOrder: para subcapítulos, herda a ordem do capítulo pai para
  //   garantir que fiquem ancorados ao pai mesmo se o array sofrer pushes
  //   fora de ordem.
  // - seq: índice de inserção, usado como desempate estável.
  type TocKind = 'intro' | 'chapter' | 'conclusion' | 'sub';
  type TocEntry = {
    label: string;
    page: number;
    level: 1 | 2;
    kind: TocKind;
    order: number;
    parentOrder: number;
    subSeq: number;
    seq: number;
    /** Coordenada Y (pt) onde o destaque visual da seção foi desenhado.
     *  Permite que o link do sumário role o leitor exatamente até o badge. */
    anchorY?: number;
  };
  const toc: TocEntry[] = [];
  let tocSeqCounter = 0;
  // Contexto do capítulo "ativo" — usado para amarrar subcapítulos ao pai.
  let activeChapterKind: TocKind = 'intro';
  let activeChapterOrder = 0;
  let activeSubSeq = 0;
  const pushTocEntry = (e: Omit<TocEntry, 'seq'>) => {
    toc.push({ ...e, seq: tocSeqCounter++ });
  };
  let tocPageNum = 0;   // última página usada pelo TOC (atualizada por drawToc)
  let tocFirstPage = 0; // primeira página reservada do TOC (preservada)

  // Capa — sempre ocupa página inteira (A4). A imagem é renderizada em modo
  // "cover" (preserva proporção, corta o excesso) e o título/subtítulo são
  // desenhados sobre a imagem, espelhando o preview do editor.
  steps.push({
    label: 'Capa',
    run: async () => {
      let coverDataUrl: string | null = null;
      if (ebook.cover_url) {
        coverDataUrl = await loadImageAsDataUrl(ebook.cover_url).catch(() => null);
      }

      // Renderizamos a capa toda em um canvas offscreen no tamanho A4
      // (em pixels com escala 2x para nitidez) e adicionamos como JPEG.
      const SCALE = 2;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(pageW * SCALE);
      canvas.height = Math.round(pageH * SCALE);
      const ctx = canvas.getContext('2d')!;

      if (coverDataUrl) {
        // Carrega a imagem para descobrir dimensões reais
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = 'anonymous';
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = coverDataUrl!;
        }).catch(() => null);

        if (img) {
          // Modo cover: escala para cobrir A4 e corta o excesso (sem distorcer)
          const cw = canvas.width;
          const ch = canvas.height;
          const ir = img.width / img.height;
          const cr = cw / ch;
          let dw: number, dh: number, dx: number, dy: number;
          if (ir > cr) {
            // imagem mais larga: ajusta altura, corta laterais
            dh = ch;
            dw = ch * ir;
            dx = (cw - dw) / 2;
            dy = 0;
          } else {
            // imagem mais alta: ajusta largura, corta topo/rodapé
            dw = cw;
            dh = cw / ir;
            dx = 0;
            dy = (ch - dh) / 2;
          }
          ctx.drawImage(img, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else {
        // Sem imagem: gradiente cyan suave
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(1, '#cffafe');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Overlay gradiente (preto, transparente no topo → opaco embaixo)
      // só quando há imagem, igual ao preview.
      const hasImage = !!coverDataUrl;
      if (hasImage) {
        const overlay = ctx.createLinearGradient(0, canvas.height * 0.35, 0, canvas.height);
        overlay.addColorStop(0, 'rgba(0,0,0,0)');
        overlay.addColorStop(0.55, 'rgba(0,0,0,0.35)');
        overlay.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Título e subtítulo sobre a capa (parte inferior, igual ao preview)
      const title = (ebook.title || '').trim();
      const subtitle = (ebook.subtitle || '').trim();
      if (title || subtitle) {
        const padX = 48 * SCALE;
        const padBottom = 56 * SCALE;
        const maxTextW = canvas.width - padX * 2;
        const textColor = hasImage ? '#ffffff' : '#0f172a';
        ctx.fillStyle = textColor;
        ctx.textBaseline = 'alphabetic';

        // Helper: quebra texto em linhas usando o canvas
        const wrap = (text: string, font: string, maxW: number, maxLines: number) => {
          ctx.font = font;
          const words = text.split(/\s+/);
          const lines: string[] = [];
          let cur = '';
          for (const w of words) {
            const test = cur ? cur + ' ' + w : w;
            if (ctx.measureText(test).width <= maxW) cur = test;
            else {
              if (cur) lines.push(cur);
              cur = w;
              if (lines.length >= maxLines) break;
            }
          }
          if (cur && lines.length < maxLines) lines.push(cur);
          // Trunca última linha se necessário
          if (lines.length === maxLines && words.length) {
            let last = lines[maxLines - 1];
            while (ctx.measureText(last + '…').width > maxW && last.length > 0) {
              last = last.slice(0, -1);
            }
            // Mantém apenas se sobrou tudo (heurística simples)
          }
          return lines;
        };

        // Sombra suave para legibilidade extra quando há imagem
        if (hasImage) {
          ctx.shadowColor = 'rgba(0,0,0,0.55)';
          ctx.shadowBlur = 6 * SCALE;
          ctx.shadowOffsetY = 1 * SCALE;
        }

        // Subtítulo (desenhado primeiro para calcular posição do título acima)
        let cursorY = canvas.height - padBottom;
        if (subtitle) {
          const subSize = 16 * SCALE;
          const subFont = `400 ${subSize}px "Inter", "Helvetica", sans-serif`;
          const subLines = wrap(subtitle, subFont, maxTextW, 2);
          ctx.font = subFont;
          const lineH = subSize * 1.3;
          // desenha de baixo para cima
          for (let i = subLines.length - 1; i >= 0; i--) {
            ctx.fillText(subLines[i], padX, cursorY);
            cursorY -= lineH;
          }
          cursorY -= 8 * SCALE; // espaço entre título e subtítulo
        }

        if (title) {
          const titleSize = 36 * SCALE;
          const titleFont = `700 ${titleSize}px "Space Grotesk", "Helvetica", sans-serif`;
          const titleLines = wrap(title, titleFont, maxTextW, 4);
          ctx.font = titleFont;
          const lineH = titleSize * 1.15;
          for (let i = titleLines.length - 1; i >= 0; i--) {
            ctx.fillText(titleLines[i], padX, cursorY);
            cursorY -= lineH;
          }
        }

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');

      // Marca essa página como capa (sem cabeçalho/rodapé nem numeração)
      skipChromePages.add(pageNum);
      // Próxima seção em nova página
      newPage();
    },
  });

  // Reserva página(s) para o sumário — preenchemos depois
  steps.push({
    label: 'Sumário',
    isToc: true,
    run: async () => {
      tocPageNum = pageNum;
      tocFirstPage = pageNum;
      // Reserva: avança para próxima página deixando esta vazia para preencher no final
      newPage();
    },
  });

  if (ebook.introduction) {
    steps.push({
      label: 'Introdução',
      tocLabel: 'Introdução',
      run: async () => {
        startNewPageSection();
        activeChapterKind = 'intro';
        activeChapterOrder = 0;
        activeSubSeq = 0;
        const anchorY = drawSectionAnchor(1);
        pushTocEntry({
          label: 'Introdução',
          page: pageNum,
          level: 1,
          kind: 'intro',
          order: 0,
          parentOrder: 0,
          subSeq: 0,
          anchorY,
        });
        await renderHtmlBlock('<h2>Introdução</h2>');
        await renderRichHtml(ebook.introduction!, true);
      },
    });
  }

  sortedChapters.forEach((c) => {
    steps.push({
      label: `Capítulo ${c.chapter_number}`,
      tocLabel: `Capítulo ${c.chapter_number} — ${c.title}`,
      run: async () => {
        startNewPageSection();
        activeChapterKind = 'chapter';
        activeChapterOrder = c.chapter_number;
        activeSubSeq = 0;
        const anchorY = drawSectionAnchor(1);
        pushTocEntry({
          label: `Capítulo ${c.chapter_number} — ${c.title}`,
          page: pageNum,
          level: 1,
          kind: 'chapter',
          order: c.chapter_number,
          parentOrder: c.chapter_number,
          subSeq: 0,
          anchorY,
        });
        await renderHtmlBlock(`<h2>Capítulo ${c.chapter_number} — ${escapeHtml(c.title)}</h2>`);
        await renderRichHtml(c.content_html || '<p><em>Capítulo ainda não gerado.</em></p>', true);
      },
    });
  });

  if (ebook.conclusion) {
    steps.push({
      label: 'Conclusão',
      tocLabel: 'Conclusão',
      run: async () => {
        startNewPageSection();
        activeChapterKind = 'conclusion';
        // Ordem alta para garantir que conclusão fique sempre por último.
        activeChapterOrder = Number.MAX_SAFE_INTEGER;
        activeSubSeq = 0;
        const anchorY = drawSectionAnchor(1);
        pushTocEntry({
          label: 'Conclusão',
          page: pageNum,
          level: 1,
          kind: 'conclusion',
          order: Number.MAX_SAFE_INTEGER,
          parentOrder: Number.MAX_SAFE_INTEGER,
          subSeq: 0,
          anchorY,
        });
        await renderHtmlBlock('<h2>Conclusão</h2>');
        await renderRichHtml(ebook.conclusion!, true);
      },
    });
  }

  if (ebook.cta) {
    steps.push({
      label: 'Chamada Final',
      run: async () => {
        addSpacer(20);
        await renderHtmlBlock(`<div class="cta">${escapeHtml(ebook.cta!)}</div>`);
      },
    });
  }

  // Desenha o TOC na página reservada com links clicáveis.
  // Estratégia:
  //  1. Ordena as entradas em ordem canônica: introdução, capítulos por
  //     `chapter_number`, conclusão. Subcapítulos seguem o pai.
  //  2. Pré-calcula quantas páginas o sumário precisa medindo o layout.
  //  3. Insere as páginas extras de TOC ANTES de desenhar e desloca todos os
  //     `entry.page` posteriores na mesma quantidade — assim os números e os
  //     links permanecem corretos mesmo com inserções.
  const drawToc = () => {
    if (!tocPageNum || toc.length === 0) return;

    // ---- 0) Normaliza opções de personalização ----
    const opts = tocOptions ?? {};
    const truncEnabled = opts.truncate?.enabled ?? true;
    const truncMaxChars = opts.truncate?.maxChars;
    const truncSuffix = opts.truncate?.suffix ?? '…';
    const truncFitToLine = opts.truncate?.fitToLine ?? true;
    const showSubchapters = opts.showSubchapters ?? true;
    const showSubtitle = opts.showSubtitle ?? true;
    const tocTitle = opts.title ?? 'Sumário';

    // Aplica `formatLabel` (se houver) e truncamento por caracteres.
    // O label é só visual — `entry.page` (e portanto o link clicável) não muda.
    const computeDisplayLabel = (entry: TocEntry): string | null => {
      const raw =
        opts.formatLabel?.({
          label: entry.label,
          level: entry.level,
          kind: entry.kind,
        }) ?? entry.label;
      if (raw === null) return null;
      let s = String(raw);
      if (truncEnabled && truncMaxChars && s.length > truncMaxChars) {
        s = s.slice(0, Math.max(0, truncMaxChars - truncSuffix.length)) + truncSuffix;
      }
      return s;
    };

    // Trunca para caber em uma única linha do TOC (pixel-perfect via jsPDF).
    // Usa busca binária para preservar o máximo de texto possível.
    const fitLabelToWidth = (text: string, maxW: number, fontSize: number): string => {
      if (!truncEnabled || !truncFitToLine) {
        // Sem ajuste de largura: ainda assim corta na primeira linha
        // calculada pelo splitTextToSize para não sangrar nos números.
        return pdf.splitTextToSize(text, maxW)[0] ?? text;
      }
      pdf.setFontSize(fontSize);
      if (pdf.getTextWidth(text) <= maxW) return text;
      const suffixW = pdf.getTextWidth(truncSuffix);
      if (suffixW >= maxW) return truncSuffix;
      let lo = 0;
      let hi = text.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        const w = pdf.getTextWidth(text.slice(0, mid)) + suffixW;
        if (w <= maxW) lo = mid;
        else hi = mid - 1;
      }
      return text.slice(0, lo).trimEnd() + truncSuffix;
    };

    // ---- 1) Ordenação canônica ----
    const kindOrder: Record<TocKind, number> = {
      intro: 0,
      chapter: 1,
      sub: 1, // mesmo grupo do capítulo pai (desempate via parentOrder/subSeq)
      conclusion: 2,
    };
    const sortedToc = [...toc]
      .filter((e) => (showSubchapters ? true : e.kind !== 'sub'))
      .filter((e) => computeDisplayLabel(e) !== null)
      .sort((a, b) => {
        const ka = kindOrder[a.kind];
        const kb = kindOrder[b.kind];
        if (ka !== kb) return ka - kb;
        if (a.parentOrder !== b.parentOrder) return a.parentOrder - b.parentOrder;
        if (a.level !== b.level) return a.level - b.level;
        if (a.subSeq !== b.subSeq) return a.subSeq - b.subSeq;
        return a.seq - b.seq;
      });

    // ---- 2) Layout / paginação do sumário ----
    // Todas as medidas em pt (unidade do jsPDF). Tamanhos pensados para
    // legibilidade em tela e impressão (300dpi+) — nada depende de pixels CSS.
    const FS_KICKER = 9;     // "ÍNDICE"
    const FS_TITLE = 26;     // "Sumário"
    const FS_SUBTITLE = 10;  // subtítulo opcional
    const FS_LEVEL1 = 12;    // capítulos / introdução / conclusão
    const FS_LEVEL2 = 10.5;  // subcapítulos
    const FS_PAGE_NUM = 11;  // números de página (level 1)
    const FS_PAGE_NUM_2 = 10;// números de página (level 2)

    const LH1 = 26;          // altura de linha p/ entradas nível 1
    const LH2 = 20;          // altura de linha p/ entradas nível 2
    const GROUP_GAP = 8;     // respiro extra entre grupos (intro/cap/concl.)
    const SUB_INDENT = 24;   // recuo dos subcapítulos
    const HEADER_BLOCK_H = 78; // kicker + título + subtítulo + divisor

    // Paleta consistente (alinhada à identidade do projeto)
    const COLOR_ACCENT: [number, number, number] = [8, 145, 178];   // cyan-600
    const COLOR_TITLE: [number, number, number] = [15, 23, 42];     // slate-900
    const COLOR_BODY: [number, number, number] = [30, 41, 59];      // slate-800
    const COLOR_MUTED: [number, number, number] = [71, 85, 105];    // slate-600
    const COLOR_DOT_L1: [number, number, number] = [203, 213, 225]; // slate-300
    const COLOR_DOT_L2: [number, number, number] = [226, 232, 240]; // slate-200
    const COLOR_KICKER: [number, number, number] = [100, 116, 139]; // slate-500

    const setColor = (c: [number, number, number]) => pdf.setTextColor(c[0], c[1], c[2]);

    // Quebra entradas em "páginas" do TOC para descobrir quantas páginas
    // serão necessárias antes de inserir. Considera também o respiro entre
    // grupos para que a contagem de páginas bata com o desenho real.
    const tocPages: TocEntry[][] = [[]];
    let yProbe = contentTop + HEADER_BLOCK_H;
    let prevKindProbe: TocKind | null = null;
    for (const entry of sortedToc) {
      const lineH = entry.level === 2 ? LH2 : LH1;
      // Adiciona gap quando muda o "macro-grupo" (intro→chapter→conclusion).
      // Subs não disparam gap: pertencem ao grupo do capítulo.
      const macroKind = entry.kind === 'sub' ? 'chapter' : entry.kind;
      const prevMacro = prevKindProbe === 'sub' ? 'chapter' : prevKindProbe;
      const gap = prevMacro && prevMacro !== macroKind ? GROUP_GAP : 0;

      if (yProbe + gap + lineH > contentBottom) {
        tocPages.push([]);
        yProbe = contentTop + HEADER_BLOCK_H;
      } else {
        yProbe += gap;
      }
      tocPages[tocPages.length - 1].push(entry);
      yProbe += lineH;
      prevKindProbe = entry.kind;
    }

    // ---- 3) Insere páginas extras e desloca números de página ----
    const extraPages = tocPages.length - 1;
    if (extraPages > 0) {
      for (let i = 0; i < extraPages; i++) {
        pdf.insertPage(tocPageNum + 1 + i);
      }
      for (const e of toc) {
        if (e.page > tocPageNum) e.page += extraPages;
      }
      const shiftedSkip = new Set<number>();
      for (const p of skipChromePages) {
        shiftedSkip.add(p > tocPageNum ? p + extraPages : p);
      }
      skipChromePages.clear();
      for (const p of shiftedSkip) skipChromePages.add(p);
    }

    // ---- 4) Desenha cada página do sumário ----
    for (let pageIdx = 0; pageIdx < tocPages.length; pageIdx++) {
      const targetPage = tocPageNum + pageIdx;
      pdf.setPage(targetPage);

      // ===== Cabeçalho do sumário =====
      let y = contentTop;

      // Kicker "ÍNDICE" (letterspacing simulado por espaço entre letras)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(FS_KICKER);
      setColor(COLOR_KICKER);
      const kicker = pageIdx === 0 ? 'Í N D I C E' : 'Í N D I C E   ( c o n t . )';
      pdf.text(kicker, marginX, y + 10);

      // Título principal
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(FS_TITLE);
      setColor(COLOR_TITLE);
      pdf.text(tocTitle, marginX, y + 36);

      // Subtítulo (apenas na primeira página)
      if (pageIdx === 0 && showSubtitle) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(FS_SUBTITLE);
        setColor(COLOR_MUTED);
        pdf.text('Toque em qualquer item para abrir o capítulo correspondente.', marginX, y + 54);
      }

      // Divisor cyan
      pdf.setDrawColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]);
      pdf.setLineWidth(1.4);
      pdf.line(marginX, y + 66, pageW - marginX, y + 66);

      y += HEADER_BLOCK_H;

      // ===== Linhas =====
      let prevKind: TocKind | null = null;
      for (const entry of tocPages[pageIdx]) {
        const lineH = entry.level === 2 ? LH2 : LH1;
        const fontSize = entry.level === 2 ? FS_LEVEL2 : FS_LEVEL1;
        const numFontSize = entry.level === 2 ? FS_PAGE_NUM_2 : FS_PAGE_NUM;
        const xStart = marginX + (entry.level === 2 ? SUB_INDENT : 0);

        // Respiro entre grupos macro
        const macroKind = entry.kind === 'sub' ? 'chapter' : entry.kind;
        const prevMacro = prevKind === 'sub' ? 'chapter' : prevKind;
        if (prevMacro && prevMacro !== macroKind) y += GROUP_GAP;

        // Reserva espaço do número à direita
        const numReserve = 36;
        const labelMaxW = (pageW - marginX) - xStart - numReserve;
        // Aplica formatLabel + truncamento por caracteres e por largura.
        // Importante: o link clicável continua usando `entry.page`, então
        // alterar o texto NUNCA quebra a navegação.
        const rawDisplay = computeDisplayLabel(entry) ?? entry.label;
        const labelText = fitLabelToWidth(rawDisplay, labelMaxW, fontSize);

        // ---- Label ----
        if (entry.level === 1) {
          pdf.setFont('helvetica', 'bold');
          setColor(COLOR_TITLE);
        } else {
          pdf.setFont('helvetica', 'normal');
          setColor(COLOR_MUTED);
        }
        pdf.setFontSize(fontSize);
        // Baseline ajustada para centralizar verticalmente na "linha"
        const baseline = y + lineH * 0.65;
        pdf.text(labelText, xStart, baseline);

        // ---- Número da página ----
        pdf.setFont('helvetica', entry.level === 1 ? 'bold' : 'normal');
        pdf.setFontSize(numFontSize);
        setColor(COLOR_ACCENT);
        const pageStr = String(entry.page);
        pdf.text(pageStr, pageW - marginX, baseline, { align: 'right' });

        // ---- Pontilhado (leaders) ----
        const labelW = pdf.getTextWidth(labelText);
        const pageStrW = pdf.getTextWidth(pageStr);
        const dotsStartX = xStart + labelW + 8;
        const dotsEndX = pageW - marginX - pageStrW - 8;
        if (dotsEndX > dotsStartX) {
          pdf.setFont('helvetica', 'normal');
          setColor(entry.level === 2 ? COLOR_DOT_L2 : COLOR_DOT_L1);
          pdf.setFontSize(9);
          // Leaders compostos por '·' (ponto médio) — mais elegante e
          // consistente entre PDF readers e impressoras.
          const dotW = pdf.getTextWidth('·  ');
          const count = Math.max(3, Math.floor((dotsEndX - dotsStartX) / dotW));
          pdf.text('·  '.repeat(count), dotsStartX, baseline);
        }

        // ---- Link clicável cobrindo a linha inteira ----
        // Link clicável: aponta para a página E para a coordenada Y do
        // destaque (badge cyan), garantindo que o leitor role exatamente
        // até o marcador visual quando o usuário clica no item.
        const linkTarget: { pageNumber: number; top?: number } = { pageNumber: entry.page };
        if (typeof entry.anchorY === 'number') {
          // pequena folga acima do destaque para o usuário enxergá-lo bem
          linkTarget.top = Math.max(0, entry.anchorY - 12);
        }
        pdf.link(marginX, y, contentW, lineH, linkTarget);

        y += lineH;
        prevKind = entry.kind;
      }
    }

    // Atualiza tocPageNum para a última página efetivamente usada pelo TOC
    tocPageNum = tocPageNum + (tocPages.length - 1);

    // Restaura estilo padrão
    pdf.setFont('helvetica', 'normal');
    setColor(COLOR_BODY);
  };

  try {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      onProgress?.({ current: i + 1, total: steps.length, label: s.label });
      await s.run();
    }
    // Preenche o sumário na página reservada
    drawToc();
    // Desenha cabeçalho/rodapé em todas as páginas (exceto capa)
    drawAllChrome();
  } finally {
    /* nada para limpar — render nativo não cria DOM offscreen */
  }


  // ===== Verificação automática dos links do sumário =====
  // Percorre toda entrada do TOC e confirma:
  //  1. `page` está dentro do intervalo de páginas do PDF.
  //  2. `top` (anchorY) está dentro dos limites verticais da página.
  //  3. O destino não é a capa nem uma das próprias páginas do TOC
  //     (auto-link inválido).
  //  4. Não há entradas duplicadas com mesma (page, top) — pode indicar
  //     anchors sobrepostas em seções diferentes.
  // O relatório é logado no console como warning quando há problemas e é
  // sempre devolvido para o chamador inspecionar/exibir na UI.
  const verifyTocLinks = (): TocVerificationReport => {
    const totalPages = pdf.getNumberOfPages();
    const issues: TocVerificationIssue[] = [];
    const seenTargets = new Map<string, number>(); // key → primeiro index
    const tocPageRange = new Set<number>();
    if (tocFirstPage > 0) {
      for (let p = tocFirstPage; p <= tocPageNum; p++) tocPageRange.add(p);
    }

    toc.forEach((entry, idx) => {
      const base = {
        index: idx,
        label: entry.label,
        level: entry.level,
        page: entry.page,
        top: entry.anchorY,
      };

      // 1) Página fora do intervalo
      if (!Number.isInteger(entry.page) || entry.page < 1 || entry.page > totalPages) {
        issues.push({
          ...base,
          reason: 'page-out-of-range',
          message: `Entrada "${entry.label}" aponta para a página ${entry.page}, mas o PDF tem ${totalPages} páginas.`,
        });
        return;
      }

      // 2) `top` (anchorY) fora dos limites verticais
      if (typeof entry.anchorY === 'number') {
        if (entry.anchorY < 0 || entry.anchorY > pageH) {
          issues.push({
            ...base,
            reason: 'top-out-of-range',
            message: `Entrada "${entry.label}" tem âncora Y=${entry.anchorY.toFixed(1)}pt fora da página (0–${pageH.toFixed(1)}pt).`,
          });
          return;
        }
      } else {
        // Anchor ausente: o link funciona (cai no topo), mas avisamos.
        issues.push({
          ...base,
          reason: 'missing-anchor',
          message: `Entrada "${entry.label}" não tem coordenada Y registrada — o salto vai para o topo da página ${entry.page}.`,
        });
      }

      // 3) Aponta para capa (skipChromePages contém pages com chrome
      //    suprimido — a capa é a única na prática) ou para uma página do
      //    próprio TOC.
      if (skipChromePages.has(entry.page)) {
        issues.push({
          ...base,
          reason: 'page-points-to-cover',
          message: `Entrada "${entry.label}" aponta para a capa (página ${entry.page}).`,
        });
        return;
      }
      if (tocPageRange.has(entry.page)) {
        issues.push({
          ...base,
          reason: 'page-points-to-toc',
          message: `Entrada "${entry.label}" aponta para uma página do próprio sumário (página ${entry.page}).`,
        });
        return;
      }

      // 4) Duplicatas (mesma page+top arredondado a 1pt)
      const key = `${entry.page}:${typeof entry.anchorY === 'number' ? Math.round(entry.anchorY) : 'top'}`;
      if (seenTargets.has(key)) {
        const firstIdx = seenTargets.get(key)!;
        issues.push({
          ...base,
          reason: 'duplicate-target',
          message: `Entrada "${entry.label}" tem o mesmo destino da entrada "${toc[firstIdx].label}" (página ${entry.page}).`,
        });
      } else {
        seenTargets.set(key, idx);
      }
    });

    const report: TocVerificationReport = {
      ok: issues.length === 0,
      total: toc.length,
      valid: toc.length - issues.length,
      totalPages,
      issues,
    };

    if (!report.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ebookExport] Verificação do sumário encontrou ${issues.length} problema(s) em ${toc.length} entradas.`,
        issues,
      );
    } else if (toc.length > 0) {
      // eslint-disable-next-line no-console
      console.info(
        `[ebookExport] Sumário verificado: ${toc.length}/${toc.length} links apontam para âncoras válidas.`,
      );
    }

    return report;
  };

  const verification = verifyTocLinks();

  const filename = `${(ebook.title || 'ebook').replace(/[^\w\s-]/g, '').slice(0, 80) || 'ebook'}.pdf`;
  pdf.save(filename);

  return verification;
}

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

async function loadImageAsDataUrl(url: string): Promise<string> {
  // Carrega a imagem (com CORS) e converte para data URL para evitar problemas
  // de tainted canvas no html2canvas.
  const resp = await fetch(url, { mode: 'cors', cache: 'no-cache' });
  if (!resp.ok) throw new Error(`Falha ao carregar imagem: ${resp.status}`);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
