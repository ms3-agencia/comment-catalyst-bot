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
  // Estratégia robusta: renderizar CADA seção (capa, intro, capítulos, conclusão, CTA)
  // como um nó HTML offscreen, capturar com html2canvas e adicionar páginas A4 ao jsPDF
  // fatiando a imagem alta em múltiplas páginas. Evita o PDF em branco do jsPDF.html()
  // com autoPaging em conteúdos longos.
  const html2canvas = (await import('html2canvas')).default;

  const sortedChapters = [...ebook.chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  type Section = { label: string; html: string; isCover?: boolean };
  const sections: Section[] = [];

  sections.push({
    label: 'Capa',
    isCover: true,
    html: `
      <div style="text-align:center; padding:160px 32px 60px; min-height:1000px;">
        <h1 style="font-size:36pt; margin:0 0 16px; color:#0f172a; line-height:1.2; font-weight:800;">${escapeHtml(ebook.title)}</h1>
        ${ebook.subtitle ? `<p style="font-size:18pt; color:#475569; margin:0 0 40px;">${escapeHtml(ebook.subtitle)}</p>` : ''}
        ${ebook.method_name ? `<p style="margin-top:32px; font-size:13pt;"><strong>Método:</strong> ${escapeHtml(ebook.method_name)}</p>` : ''}
        ${ebook.promise ? `<p style="font-style:italic; font-size:13pt; color:#334155;">${escapeHtml(ebook.promise)}</p>` : ''}
      </div>
    `,
  });

  if (ebook.introduction) {
    sections.push({
      label: 'Introdução',
      html: `
        <h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px; font-size:22pt; margin:0 0 16px;">Introdução</h2>
        <div class="ebook-prose">${ebook.introduction}</div>
      `,
    });
  }

  sortedChapters.forEach((c) => {
    sections.push({
      label: `Capítulo ${c.chapter_number}`,
      html: `
        <h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px; font-size:22pt; margin:0 0 16px;">Capítulo ${c.chapter_number} — ${escapeHtml(c.title)}</h2>
        <div class="ebook-prose">${c.content_html || '<p><em>Capítulo ainda não gerado.</em></p>'}</div>
      `,
    });
  });

  if (ebook.conclusion) {
    sections.push({
      label: 'Conclusão',
      html: `
        <h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px; font-size:22pt; margin:0 0 16px;">Conclusão</h2>
        <div class="ebook-prose">${ebook.conclusion}</div>
      `,
    });
  }

  if (ebook.cta) {
    sections.push({
      label: 'Chamada Final',
      html: `
        <div style="margin-top:24px; padding:20px; background:#0891b2; color:#fff; text-align:center; font-weight:bold; border-radius:8px; font-size:14pt;">${escapeHtml(ebook.cta)}</div>
      `,
    });
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = pdf.internal.pageSize.getWidth();   // 595.28
  const pageH = pdf.internal.pageSize.getHeight();  // 841.89
  const margin = 36;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  const total = sections.length;
  let firstPage = true;

  for (let i = 0; i < total; i++) {
    const sec = sections[i];
    onProgress?.({ current: i + 1, total, label: sec.label });

    // Nó offscreen com largura fixa (A4-like) para captura
    const node = document.createElement('div');
    node.style.position = 'fixed';
    node.style.left = '-99999px';
    node.style.top = '0';
    node.style.width = '794px';
    node.style.padding = '40px';
    node.style.background = '#ffffff';
    node.style.color = '#0f172a';
    node.style.fontFamily = 'Inter, Arial, sans-serif';
    node.style.fontSize = '12pt';
    node.style.lineHeight = '1.65';
    node.innerHTML = `
      <style>
        .ebook-prose h2 { color:#0891b2; font-size:18pt; margin:18px 0 10px; }
        .ebook-prose h3 { color:#0e7490; font-size:14pt; margin:14px 0 8px; }
        .ebook-prose p { margin:0 0 12px; text-align:justify; }
        .ebook-prose ul, .ebook-prose ol { margin:0 0 12px 22px; }
        .ebook-prose li { margin-bottom:6px; }
        .ebook-prose blockquote { border-left:3px solid #0891b2; padding:6px 12px; margin:12px 0; background:#ecfeff; color:#155e75; }
        .ebook-prose strong { color:#0f172a; }
        .ebook-prose img { max-width:100%; height:auto; }
      </style>
      ${sec.html}
    `;
    document.body.appendChild(node);

    try {
      // Aguarda fontes/imagens
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
      });

      const imgW = contentW;
      const ratio = imgW / canvas.width;
      const imgFullH = canvas.height * ratio;

      if (!firstPage) pdf.addPage();
      firstPage = false;

      // Se a imagem cabe em uma página, adiciona direto
      if (imgFullH <= contentH) {
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(imgData, 'JPEG', margin, margin, imgW, imgFullH, undefined, 'FAST');
      } else {
        // Fatiar: cada página recebe um pedaço do canvas correspondente a contentH
        const pageCanvasH = Math.floor(contentH / ratio); // altura em px do canvas que cabe numa página
        let offsetY = 0;
        let isFirstSlice = true;
        while (offsetY < canvas.height) {
          const sliceH = Math.min(pageCanvasH, canvas.height - offsetY);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH;
          const ctx = sliceCanvas.getContext('2d')!;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
          if (!isFirstSlice) pdf.addPage();
          pdf.addImage(sliceData, 'JPEG', margin, margin, imgW, sliceH * ratio, undefined, 'FAST');
          offsetY += sliceH;
          isFirstSlice = false;
        }
      }
    } finally {
      if (node.parentNode) document.body.removeChild(node);
    }
  }

  const filename = `${(ebook.title || 'ebook').replace(/[^\w\s-]/g, '').slice(0, 80) || 'ebook'}.pdf`;
  pdf.save(filename);
}

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
