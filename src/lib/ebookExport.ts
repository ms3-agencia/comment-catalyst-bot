import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

export async function exportEbookPdf(ebook: EbookFull) {
  // Usa jsPDF.html() (texto real, selecionável, com paginação automática).
  // Renderiza um nó offscreen com o conteúdo completo do eBook em HTML semântico
  // e deixa o jsPDF cuidar das quebras de página — sem o limite de 16k px do html2canvas
  // que estava cortando eBooks longos.
  const node = document.createElement('div');
  node.style.position = 'fixed';
  node.style.left = '-99999px';
  node.style.top = '0';
  node.style.width = '794px'; // ~A4 a 96dpi (210mm)
  node.style.background = '#ffffff';
  node.style.color = '#0f172a';
  node.style.fontFamily = 'Inter, Arial, sans-serif';
  node.style.fontSize = '12pt';
  node.style.lineHeight = '1.6';

  const sections: string[] = [];
  // Capa
  sections.push(`
    <section style="text-align:center; padding:120px 24px 60px;">
      <h1 style="font-size:32pt; margin:0 0 12px; color:#0f172a; line-height:1.2;">${escapeHtml(ebook.title)}</h1>
      ${ebook.subtitle ? `<p style="font-size:16pt; color:#475569; margin:0;">${escapeHtml(ebook.subtitle)}</p>` : ''}
      ${ebook.method_name ? `<p style="margin-top:32px; font-size:12pt;"><strong>Método:</strong> ${escapeHtml(ebook.method_name)}</p>` : ''}
      ${ebook.promise ? `<p style="font-style:italic; font-size:12pt;">${escapeHtml(ebook.promise)}</p>` : ''}
    </section>
  `);
  if (ebook.introduction) {
    sections.push(`
      <section style="padding:24px; page-break-before: always;">
        <h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px; font-size:20pt;">Introdução</h2>
        <div>${ebook.introduction}</div>
      </section>
    `);
  }
  ebook.chapters.sort((a, b) => a.chapter_number - b.chapter_number).forEach((c) => {
    sections.push(`
      <section style="padding:24px; page-break-before: always;">
        <h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px; font-size:20pt;">Capítulo ${c.chapter_number} — ${escapeHtml(c.title)}</h2>
        <div>${c.content_html || '<p><em>Capítulo ainda não gerado.</em></p>'}</div>
      </section>
    `);
  });
  if (ebook.conclusion) {
    sections.push(`
      <section style="padding:24px; page-break-before: always;">
        <h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px; font-size:20pt;">Conclusão</h2>
        <div>${ebook.conclusion}</div>
      </section>
    `);
  }
  if (ebook.cta) {
    sections.push(`
      <section style="padding:24px;">
        <p style="margin-top:24px; padding:16px; background:#0891b2; color:#fff; text-align:center; font-weight:bold; border-radius:8px;">${escapeHtml(ebook.cta)}</p>
      </section>
    `);
  }

  node.innerHTML = sections.join('');
  document.body.appendChild(node);

  try {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();   // 595.28pt
    const pageHeight = pdf.internal.pageSize.getHeight(); // 841.89pt
    const margin = 36; // ~12.7mm

    await pdf.html(node, {
      x: margin,
      y: margin,
      width: pageWidth - margin * 2,
      windowWidth: 794,
      autoPaging: 'text',
      margin: [margin, margin, margin, margin],
      html2canvas: { scale: (pageWidth - margin * 2) / 794, useCORS: true, backgroundColor: '#ffffff' },
    });

    const filename = `${(ebook.title || 'ebook').replace(/[^\w\s-]/g, '').slice(0, 80) || 'ebook'}.pdf`;
    pdf.save(filename);
  } finally {
    if (node.parentNode) document.body.removeChild(node);
  }
}

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
