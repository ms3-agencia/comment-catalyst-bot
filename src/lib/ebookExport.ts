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
  // Renderiza um nó offscreen e converte por páginas com html2canvas + jsPDF
  const node = document.createElement('div');
  node.style.position = 'fixed';
  node.style.left = '-99999px';
  node.style.top = '0';
  node.style.width = '794px'; // A4 em ~96dpi
  node.style.padding = '60px 64px';
  node.style.background = '#ffffff';
  node.style.color = '#0f172a';
  node.style.fontFamily = 'Inter, Arial, sans-serif';
  node.style.fontSize = '14px';
  node.style.lineHeight = '1.65';
  node.innerHTML = `
    <div style="text-align:center; padding:120px 0 60px;">
      <h1 style="font-size:42px; margin:0 0 12px; color:#0f172a;">${escapeHtml(ebook.title)}</h1>
      ${ebook.subtitle ? `<p style="font-size:20px; color:#475569; margin:0;">${escapeHtml(ebook.subtitle)}</p>` : ''}
      ${ebook.method_name ? `<p style="margin-top:32px;"><strong>Método:</strong> ${escapeHtml(ebook.method_name)}</p>` : ''}
      ${ebook.promise ? `<p style="font-style:italic;">${escapeHtml(ebook.promise)}</p>` : ''}
    </div>
    <div style="page-break-after: always;"></div>
    ${ebook.introduction ? `<h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px;">Introdução</h2>${ebook.introduction}<div style="page-break-after: always;"></div>` : ''}
    ${ebook.chapters.sort((a,b)=>a.chapter_number-b.chapter_number).map(c => `
      <h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px;">Capítulo ${c.chapter_number} — ${escapeHtml(c.title)}</h2>
      ${c.content_html}
      <div style="page-break-after: always;"></div>
    `).join('')}
    ${ebook.conclusion ? `<h2 style="color:#0891b2; border-bottom:2px solid #0891b2; padding-bottom:6px;">Conclusão</h2>${ebook.conclusion}` : ''}
    ${ebook.cta ? `<p style="margin-top:24px; padding:16px; background:#0891b2; color:#fff; text-align:center; font-weight:bold;">${escapeHtml(ebook.cta)}</p>` : ''}
  `;
  document.body.appendChild(node);
  try {
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`${ebook.title.replace(/[^\w\s-]/g, '').slice(0, 80)}.pdf`);
  } finally {
    document.body.removeChild(node);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
