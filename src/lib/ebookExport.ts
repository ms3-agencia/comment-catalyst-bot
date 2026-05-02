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

export async function exportEbookPdf(
  ebook: EbookFull,
  onProgress?: (info: { current: number; total: number; label: string }) => void,
  tocOptions?: TocOptions,
) {
  // Estratégia bloco-a-bloco: cada elemento (h2, p, li, blockquote, img...) é
  // renderizado individualmente em um canvas. Se o bloco não couber no espaço
  // restante da página, criamos nova página. Isso garante margens, espaçamento
  // e quebras consistentes para qualquer tamanho de texto.
  const html2canvas = (await import('html2canvas')).default;

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

  // Largura fixa do "papel" virtual em px (proporcional ao contentW em pt: 1pt ≈ 1.333px)
  const RENDER_W = Math.round(contentW * 1.6); // ~760px → boa nitidez
  const PX_TO_PT = contentW / RENDER_W;

  // Sandbox onde montaremos os blocos para captura
  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.left = '-99999px';
  sandbox.style.top = '0';
  sandbox.style.width = `${RENDER_W}px`;
  sandbox.style.background = '#ffffff';
  sandbox.style.color = '#0f172a';
  sandbox.style.fontFamily = 'Inter, Arial, sans-serif';
  sandbox.style.fontSize = '11pt';
  sandbox.style.lineHeight = '1.7';
  sandbox.innerHTML = `
    <style id="ebook-pdf-styles">
      .ebk, .ebk * {
        color: #1e293b !important;
        background-color: transparent;
        box-shadow: none !important;
        text-shadow: none !important;
        font-family: Inter, Arial, sans-serif;
      }
      .ebk { background:#ffffff !important; box-sizing: border-box; width: ${RENDER_W}px; }
      .ebk h1 { color:#0f172a !important; font-size: 28pt; font-weight: 800; line-height:1.25; margin: 0 0 14px; }
      .ebk h2 { color:#0891b2 !important; font-size: 18pt; font-weight: 700; line-height:1.3; margin: 0 0 12px; padding-bottom:6px; border-bottom:2px solid #0891b2; }
      .ebk h3 { color:#0e7490 !important; font-size: 14pt; font-weight: 700; line-height:1.35; margin: 0 0 10px; }
      .ebk p  { color:#1e293b !important; font-size: 11pt; line-height:1.7; margin: 0 0 10px; text-align: justify; hyphens: auto; }
      .ebk ul, .ebk ol { margin: 0 0 10px 22px; padding: 0; color:#1e293b !important; }
      .ebk li { font-size: 11pt; line-height:1.7; margin: 0 0 6px; color:#1e293b !important; }
      .ebk blockquote { border-left: 3px solid #0891b2; background:#ecfeff !important; color:#155e75 !important; padding: 10px 14px; margin: 0 0 12px; border-radius: 4px; }
      .ebk blockquote * { color:#155e75 !important; }
      .ebk strong, .ebk b { color:#0f172a !important; font-weight: 700; }
      .ebk em, .ebk i { font-style: italic; }
      .ebk a { color:#0891b2 !important; text-decoration: underline; }
      .ebk img { max-width: 100%; height: auto; display: block; margin: 8px 0; }
      .ebk code { background:#f1f5f9 !important; color:#0f172a !important; padding:1px 4px; border-radius:3px; font-family: monospace; font-size: 10pt; }
      .ebk pre { background:#f1f5f9 !important; color:#0f172a !important; padding: 12px; border-radius: 6px; margin: 0 0 12px; white-space: pre-wrap; word-break: break-word; font-size: 10pt; }
      .ebk pre * { color:#0f172a !important; }
      .ebk table { border-collapse: collapse; width: 100%; margin: 0 0 12px; font-size: 10pt; }
      .ebk th, .ebk td { border: 1px solid #cbd5e1; padding: 6px 8px; color:#0f172a !important; }
      .ebk th { background:#f1f5f9 !important; font-weight: 700; }
      .ebk .cover { text-align:center; padding: 80px 20px 40px; }
      .ebk .cover h1 { font-size: 32pt; margin-bottom: 14px; }
      .ebk .cover .subtitle { font-size: 16pt; color:#475569 !important; margin: 0 0 32px; }
      .ebk .cover .meta { font-size: 12pt; margin: 8px 0; }
      .ebk .cta { background:#0891b2 !important; color:#ffffff !important; padding: 18px 22px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 13pt; }
      .ebk .cta * { color:#ffffff !important; }
      .ebk .spacer-sm { height: 8px; }
      .ebk .spacer-md { height: 16px; }
      .ebk .spacer-lg { height: 28px; }
    </style>
    <div class="ebk" id="ebk-root"></div>
  `;
  document.body.appendChild(sandbox);
  const root = sandbox.querySelector('#ebk-root') as HTMLElement;

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

  const renderElementToCanvas = async (el: HTMLElement) => {
    return await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: RENDER_W,
    });
  };

  // Renderiza um elemento isolado em canvas e devolve dimensões
  const measureAndRender = async (el: HTMLElement) => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const canvas = await renderElementToCanvas(el);
    const ratio = contentW / canvas.width;
    return { canvas, ratio, h: canvas.height * ratio };
  };

  // Desenha um canvas inteiro na posição atual (assume que cabe)
  const drawCanvasAt = (canvas: HTMLCanvasElement, h: number) => {
    const data = canvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(data, 'JPEG', marginX, cursorY, contentW, h, undefined, 'FAST');
    cursorY += h;
  };

  // Último recurso: fatia uma imagem grande (bloco atômico maior que uma página)
  // entre páginas. Usado apenas para imagens/tabelas/pre que não podem ser
  // quebrados em sub-elementos textuais.
  const sliceCanvasAcrossPages = (canvas: HTMLCanvasElement) => {
    const ratio = contentW / canvas.width;
    const pageCanvasH = Math.floor(contentH / ratio);
    let offsetY = 0;
    if (cursorY > contentTop) newPage();
    while (offsetY < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - offsetY);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const data = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const drawH = sliceH * ratio;
      pdf.addImage(data, 'JPEG', marginX, cursorY, contentW, drawH, undefined, 'FAST');
      cursorY += drawH;
      offsetY += sliceH;
      if (offsetY < canvas.height) newPage();
    }
  };

  const isAtomicTag = (tag: string) =>
    tag === 'IMG' || tag === 'TABLE' || tag === 'PRE' || tag === 'FIGURE' || tag === 'HR' || tag === 'CANVAS' || tag === 'VIDEO';

  // Quebra um parágrafo em pedaços menores agrupando sentenças, para evitar
  // cortar linha no meio. Cada pedaço vira um <p> próprio respeitando o estilo.
  const splitParagraphIntoChunks = (p: HTMLElement): HTMLElement[] => {
    const text = p.textContent || '';
    if (!text.trim()) return [p];
    // Quebra por sentenças (pt/en) — mantém pontuação
    const sentences = text.match(/[^.!?…]+[.!?…]+\s*|[^.!?…]+$/g) || [text];
    if (sentences.length <= 1) return [p];
    // Agrupa em ~3 sentenças por chunk para manter parágrafos coerentes
    const groupSize = 3;
    const chunks: HTMLElement[] = [];
    for (let i = 0; i < sentences.length; i += groupSize) {
      const part = sentences.slice(i, i + groupSize).join('').trim();
      if (!part) continue;
      const np = document.createElement(p.tagName.toLowerCase());
      // copia className/style básicos
      if (p.className) np.className = p.className;
      np.textContent = part;
      chunks.push(np);
    }
    return chunks.length > 1 ? chunks : [p];
  };

  // Coloca um elemento na página, recursivamente quebrando se necessário.
  const placeBlock = async (el: HTMLElement) => {
    // Renderiza o elemento isolado no root
    root.innerHTML = '';
    root.appendChild(el);
    const { canvas, h } = await measureAndRender(el);
    const remaining = contentBottom - cursorY;

    // Cabe na página atual: desenha
    if (h <= remaining) {
      drawCanvasAt(canvas, h);
      return;
    }

    const tag = el.tagName.toUpperCase();

    // Bloco não cabe E ainda há conteúdo na página → tenta nova página primeiro
    // (talvez caiba inteiro na próxima página)
    if (cursorY > contentTop && h <= contentH) {
      newPage();
      // Recoloca na nova página (cabe)
      root.innerHTML = '';
      root.appendChild(el);
      const re = await measureAndRender(el);
      drawCanvasAt(re.canvas, re.h);
      return;
    }

    // Bloco maior que uma página inteira: precisa quebrar
    // 1) Listas: quebra item-a-item
    if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(el.children) as HTMLElement[];
      if (items.length > 1) {
        for (const li of items) {
          // Cria uma lista nova com um único item para preservar marcador/estilo
          const wrapper = document.createElement(tag.toLowerCase()) as HTMLElement;
          if (el.className) wrapper.className = el.className;
          if (tag === 'OL') {
            // Mantém numeração contínua aproximadamente — não perfeito, mas legível
            const idx = items.indexOf(li) + 1;
            (wrapper as HTMLOListElement).start = idx;
          }
          wrapper.appendChild(li.cloneNode(true) as HTMLElement);
          await placeBlock(wrapper);
        }
        return;
      }
    }

    // 2) Containers genéricos com filhos: quebra filho-a-filho
    if ((tag === 'DIV' || tag === 'BLOCKQUOTE' || tag === 'SECTION' || tag === 'ARTICLE') && el.children.length > 1) {
      const children = Array.from(el.children) as HTMLElement[];
      for (const child of children) {
        await placeBlock(child.cloneNode(true) as HTMLElement);
      }
      return;
    }

    // 3) Parágrafo/cabeçalho longo: quebra por sentenças
    if (tag === 'P' || tag === 'BLOCKQUOTE') {
      const chunks = splitParagraphIntoChunks(el);
      if (chunks.length > 1) {
        for (const c of chunks) {
          await placeBlock(c);
        }
        return;
      }
    }

    // 4) Atômico (imagem/tabela/pre) ou indivisível: fatia o canvas como último recurso
    if (isAtomicTag(tag) || h > contentH) {
      sliceCanvasAcrossPages(canvas);
      return;
    }

    // Fallback: desenha o que sobrou (não deveria chegar aqui)
    if (cursorY > contentTop) newPage();
    drawCanvasAt(canvas, Math.min(h, contentBottom - cursorY));
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
    const showChip = userStyle.showChip ?? true;
    const chipText = userStyle.chipText ?? (isFocus ? '◉ VOCÊ ESTÁ AQUI' : '↳ alvo do sumário');

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

  // Renderiza um bloco isolado: cria div temporário com o HTML, mede e desenha
  const renderHtmlBlock = async (html: string, wrapperClass = '') => {
    const wrap = document.createElement('div');
    if (wrapperClass) wrap.className = wrapperClass;
    wrap.innerHTML = html;
    await placeBlock(wrap);
  };

  // Renderiza HTML rico desmembrando os filhos diretos para permitir quebras
  const renderRichHtml = async (html: string, registerSubheadings = false) => {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    const children = Array.from(holder.children) as HTMLElement[];
    if (children.length === 0) {
      const p = document.createElement('p');
      p.textContent = holder.textContent || '';
      await placeBlock(p);
      return;
    }
    for (const child of children) {
      // Registra h2/h3 como subentradas do sumário (nível 2)
      if (registerSubheadings) {
        const tag = child.tagName.toUpperCase();
        if (tag === 'H2' || tag === 'H3') {
          const text = (child.textContent || '').trim();
          if (text) {
            // Garante que o cabeçalho não vá partir entre páginas: se não
            // couber, força nova página antes de ancorar.
            const subAnchorY = drawSectionAnchor(2);
            const subAnchorPage = pageNum;
            await placeBlock(child.cloneNode(true) as HTMLElement);
            // Subcapítulo herda o agrupamento do capítulo pai ativo.
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
      }
      await placeBlock(child.cloneNode(true) as HTMLElement);
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
  let tocPageNum = 0; // primeira página reservada para o sumário

  // Capa — sempre ocupa página inteira (A4). Se houver cover_url, usa como
  // background com gradiente; senão, layout centralizado limpo.
  steps.push({
    label: 'Capa',
    run: async () => {
      // Pré-carrega imagem (se houver) para evitar capa em branco
      let coverDataUrl: string | null = null;
      if (ebook.cover_url) {
        coverDataUrl = await loadImageAsDataUrl(ebook.cover_url).catch(() => null);
      }

      const titleSafe = escapeHtml(ebook.title);
      const subtitleSafe = ebook.subtitle ? escapeHtml(ebook.subtitle) : '';
      const methodSafe = ebook.method_name ? escapeHtml(ebook.method_name) : '';
      const promiseSafe = ebook.promise ? escapeHtml(ebook.promise) : '';

      // Calcula altura "página inteira" no nó (em px) para preencher A4
      // Proporção: pageH/pageW * RENDER_W
      const fullPageH = Math.round((pageH / pageW) * RENDER_W);

      let html = '';
      if (coverDataUrl) {
        html = `
          <div style="
            position: relative;
            width: ${RENDER_W}px;
            height: ${fullPageH}px;
            overflow: hidden;
            background: #0f172a;
            font-family: Inter, Arial, sans-serif;
          ">
            <img src="${coverDataUrl}" style="
              position:absolute; inset:0; width:100%; height:100%;
              object-fit: cover; display:block;
            " />
            <div style="
              position:absolute; inset:0;
              background: linear-gradient(to bottom, rgba(15,23,42,0.10) 0%, rgba(15,23,42,0.55) 60%, rgba(15,23,42,0.92) 100%);
            "></div>
            <div style="
              position:absolute; left:0; right:0; bottom:0;
              padding: 60px 56px 80px;
              color:#ffffff;
              text-align:left;
            ">
              <h1 style="
                color:#ffffff !important;
                font-size: 38pt; font-weight: 800; line-height:1.15;
                margin: 0 0 14px; text-shadow: 0 2px 18px rgba(0,0,0,0.45);
              ">${titleSafe}</h1>
              ${subtitleSafe ? `<div style="
                color:#e2e8f0 !important;
                font-size: 18pt; font-weight: 500; line-height:1.35;
                margin: 0 0 24px; text-shadow: 0 1px 10px rgba(0,0,0,0.5);
              ">${subtitleSafe}</div>` : ''}
              ${methodSafe ? `<div style="color:#cffafe !important; font-size: 12pt; margin: 6px 0;"><strong style="color:#ffffff !important;">Método:</strong> ${methodSafe}</div>` : ''}
              ${promiseSafe ? `<div style="color:#e2e8f0 !important; font-size: 12pt; font-style:italic; margin: 6px 0;">${promiseSafe}</div>` : ''}
            </div>
          </div>
        `;
      } else {
        html = `
          <div style="
            width: ${RENDER_W}px;
            height: ${fullPageH}px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; padding: 80px 60px;
            background: linear-gradient(180deg, #ffffff 0%, #ecfeff 70%, #cffafe 100%);
            box-sizing: border-box;
          ">
            <h1 style="color:#0f172a !important; font-size: 38pt; font-weight: 800; line-height:1.15; margin: 0 0 18px;">${titleSafe}</h1>
            ${subtitleSafe ? `<div style="color:#475569 !important; font-size: 18pt; margin: 0 0 36px;">${subtitleSafe}</div>` : ''}
            <div style="height:2px; width:120px; background:#0891b2; margin: 12px 0 28px;"></div>
            ${methodSafe ? `<div style="font-size:12pt; color:#0f172a !important; margin: 6px 0;"><strong>Método:</strong> ${methodSafe}</div>` : ''}
            ${promiseSafe ? `<div style="font-size:12pt; color:#334155 !important; font-style:italic; margin: 6px 0;">${promiseSafe}</div>` : ''}
          </div>
        `;
      }

      // Renderiza diretamente em página inteira (margem zero)
      root.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      const coverEl = wrap.firstElementChild as HTMLElement;
      root.appendChild(coverEl);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const canvas = await renderElementToCanvas(coverEl);
      const data = canvas.toDataURL('image/jpeg', 0.94);
      // Preenche A4 inteiro (sem margens)
      pdf.addImage(data, 'JPEG', 0, 0, pageW, pageH, undefined, 'FAST');
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
    if (sandbox.parentNode) document.body.removeChild(sandbox);
  }

  const filename = `${(ebook.title || 'ebook').replace(/[^\w\s-]/g, '').slice(0, 80) || 'ebook'}.pdf`;
  pdf.save(filename);
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
