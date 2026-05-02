import jsPDF from 'jspdf';
import 'jspdf/dist/polyfills.es.js';
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType, TextRun } from 'docx';
import { saveAs } from 'file-saver';

export type EbookFull = {
  id: string;
  title: string;
  subtitle?: string | null;
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

export async function exportEbookPdf(
  ebook: EbookFull,
  onProgress?: (info: { current: number; total: number; label: string }) => void,
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
  let totalPages = 1; // será corrigido no final

  const drawPageChrome = () => {
    // Rodapé com numeração
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(120, 130, 145);
    pdf.text(`${pageNum}`, pageW / 2, pageH - 28, { align: 'center' });
    if (ebook.title) {
      pdf.text(ebook.title.slice(0, 80), marginX, pageH - 28, { align: 'left' });
    }
    pdf.setTextColor(30, 41, 59);
  };

  const newPage = () => {
    drawPageChrome();
    pdf.addPage();
    pageNum += 1;
    cursorY = contentTop;
  };

  const renderElementToCanvas = async (el: HTMLElement) => {
    return await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: RENDER_W,
    });
  };

  const placeBlock = async (el: HTMLElement, opts?: { keepWithNext?: boolean }) => {
    // Aguarda layout
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const canvas = await renderElementToCanvas(el);
    const blockH = canvas.height * (contentW / canvas.width); // em pt
    const remaining = contentBottom - cursorY;

    // Se não cabe, vai para próxima página
    if (blockH > remaining) {
      // Se o bloco é maior que uma página inteira, fatiamos
      if (blockH > contentH) {
        // Quebra a imagem em fatias do tamanho da página
        const ratio = contentW / canvas.width;
        const pageCanvasH = Math.floor(contentH / ratio);
        let offsetY = 0;
        // Garante que começa em página nova se já houver conteúdo
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
        return;
      }
      newPage();
    }

    const data = canvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(data, 'JPEG', marginX, cursorY, contentW, blockH, undefined, 'FAST');
    cursorY += blockH;
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

  // Renderiza um bloco isolado: cria div temporário com o HTML, mede e desenha
  const renderHtmlBlock = async (html: string, wrapperClass = '') => {
    root.innerHTML = '';
    const wrap = document.createElement('div');
    if (wrapperClass) wrap.className = wrapperClass;
    wrap.innerHTML = html;
    root.appendChild(wrap);
    await placeBlock(wrap);
  };

  // Renderiza HTML rico desmembrando os filhos diretos para permitir quebras
  const renderRichHtml = async (html: string) => {
    root.innerHTML = '';
    const holder = document.createElement('div');
    holder.innerHTML = html;
    // Move cada filho para o root e renderiza um por vez
    const children = Array.from(holder.children) as HTMLElement[];
    if (children.length === 0) {
      // Sem filhos estruturais — renderiza como bloco único parágrafo
      const p = document.createElement('p');
      p.textContent = holder.textContent || '';
      root.appendChild(p);
      await placeBlock(p);
      return;
    }
    for (const child of children) {
      root.innerHTML = '';
      root.appendChild(child);
      await placeBlock(child);
      // pequeno espaçamento entre blocos já está no margin do CSS, não adicionar extra
    }
  };

  // ===== Montagem das seções =====
  type Step = { label: string; run: () => Promise<void> };
  const steps: Step[] = [];

  // Capa
  steps.push({
    label: 'Capa',
    run: async () => {
      const html = `
        <div class="cover">
          <h1>${escapeHtml(ebook.title)}</h1>
          ${ebook.subtitle ? `<div class="subtitle">${escapeHtml(ebook.subtitle)}</div>` : ''}
          ${ebook.method_name ? `<div class="meta"><strong>Método:</strong> ${escapeHtml(ebook.method_name)}</div>` : ''}
          ${ebook.promise ? `<div class="meta" style="font-style:italic; color:#334155 !important;">${escapeHtml(ebook.promise)}</div>` : ''}
        </div>
      `;
      // Capa ocupa página inteira e centralizada — adiciona padding vertical extra
      cursorY = contentTop;
      await renderHtmlBlock(html);
      // força próxima seção em nova página
      if (cursorY > contentTop) newPage();
    },
  });

  if (ebook.introduction) {
    steps.push({
      label: 'Introdução',
      run: async () => {
        startNewPageSection();
        await renderHtmlBlock('<h2>Introdução</h2>');
        await renderRichHtml(ebook.introduction!);
      },
    });
  }

  sortedChapters.forEach((c) => {
    steps.push({
      label: `Capítulo ${c.chapter_number}`,
      run: async () => {
        startNewPageSection();
        await renderHtmlBlock(`<h2>Capítulo ${c.chapter_number} — ${escapeHtml(c.title)}</h2>`);
        await renderRichHtml(c.content_html || '<p><em>Capítulo ainda não gerado.</em></p>');
      },
    });
  });

  if (ebook.conclusion) {
    steps.push({
      label: 'Conclusão',
      run: async () => {
        startNewPageSection();
        await renderHtmlBlock('<h2>Conclusão</h2>');
        await renderRichHtml(ebook.conclusion!);
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

  try {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      onProgress?.({ current: i + 1, total: steps.length, label: s.label });
      await s.run();
    }
    // Desenha rodapé na última página
    drawPageChrome();
  } finally {
    if (sandbox.parentNode) document.body.removeChild(sandbox);
  }

  const filename = `${(ebook.title || 'ebook').replace(/[^\w\s-]/g, '').slice(0, 80) || 'ebook'}.pdf`;
  pdf.save(filename);
  // suprime aviso de variável não usada
  void totalPages;
}

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
