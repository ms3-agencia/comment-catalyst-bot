// EPUB 3 exporter — gera um arquivo .epub pronto para Amazon KDP a partir
// dos dados de um ebook. Estrutura interna:
//   mimetype                (não compactado)
//   META-INF/container.xml
//   OEBPS/content.opf       (metadados + manifest + spine)
//   OEBPS/nav.xhtml         (sumário navegável EPUB 3)
//   OEBPS/toc.ncx           (sumário NCX para retro-compatibilidade Kindle)
//   OEBPS/styles.css        (CSS responsivo)
//   OEBPS/cover.xhtml       (página de capa)
//   OEBPS/cover.jpg | .png  (imagem da capa, se houver)
//   OEBPS/title.xhtml       (página de rosto)
//   OEBPS/intro.xhtml
//   OEBPS/chapter-N.xhtml   (um por capítulo)
//   OEBPS/conclusion.xhtml
//
// Compatibilidade KDP: os metadados em content.opf cobrem language,
// identifier (ISBN/ASIN ou UUID), creator, description, subject (palavras-
// chave) e rights. O reader do KDP aceita EPUB 3 com nav.xhtml.

import JSZip from 'jszip';
import type { EbookFull } from './ebookExport';

export type KdpMetadata = {
  /** Autor (obrigatório para KDP) */
  author?: string;
  /** Idioma BCP47 (pt, pt-BR, en, en-US, es...) */
  language?: string;
  /** ISBN ou ASIN. Se vazio, usamos UUID gerado. */
  identifier?: string;
  /** Tipo do identificador: ISBN, ASIN ou UUID (default UUID) */
  identifierType?: 'ISBN' | 'ASIN' | 'UUID';
  /** Editora */
  publisher?: string;
  /** Descrição/sinopse para a página do livro na Amazon */
  description?: string;
  /** Palavras-chave de busca KDP (até 7 recomendado) */
  keywords?: string[];
  /** Categorias BISAC (opcional, livre — KDP escolhe na ferramenta deles) */
  categories?: string[];
  /** Direitos autorais. Ex: "© 2026 Fulano. Todos os direitos reservados." */
  rights?: string;
  /** Data de publicação ISO (YYYY-MM-DD). Default = hoje. */
  publicationDate?: string;
  /** Tradutor, opcional */
  contributor?: string;
};

const xmlEscape = (s: string) =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const slugify = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'ebook';

const uuidv4 = () => {
  // Crypto-grade UUID v4
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10, 16).join('')}`;
};

/** Sanitiza HTML do editor para XHTML válido (EPUB exige XML well-formed). */
const sanitizeXhtml = (html: string): string => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  // Tags permitidas no corpo dos capítulos. Tudo o que não for permitido
  // vira <p>texto</p> ou é descartado.
  const ALLOWED = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI', 'BLOCKQUOTE',
    'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
    'A', 'IMG', 'HR',
  ]);
  // Atributos permitidos por tag
  const ATTRS: Record<string, string[]> = {
    A: ['href', 'title'],
    IMG: ['src', 'alt', 'width', 'height'],
    TH: ['colspan', 'rowspan', 'scope'],
    TD: ['colspan', 'rowspan'],
  };

  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return xmlEscape(node.textContent || '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    const inner = Array.from(el.childNodes).map(serialize).join('');

    if (!ALLOWED.has(tag)) {
      // Containers viram <div> "pass-through"
      if (['DIV', 'SECTION', 'ARTICLE', 'SPAN'].includes(tag)) return inner;
      return inner;
    }

    // Tags vazias EPUB precisam ser fechadas <br/>, <hr/>, <img/>
    const VOID = new Set(['BR', 'HR', 'IMG']);
    const tagLower = tag.toLowerCase();
    const attrList = (ATTRS[tag] || [])
      .map((a) => {
        const v = el.getAttribute(a);
        if (!v) return '';
        return ` ${a}="${xmlEscape(v)}"`;
      })
      .join('');

    if (VOID.has(tag)) {
      return `<${tagLower}${attrList}/>`;
    }
    return `<${tagLower}${attrList}>${inner}</${tagLower}>`;
  };

  return Array.from(tmp.childNodes).map(serialize).join('').trim();
};

const xhtmlPage = (title: string, bodyXhtml: string, lang = 'pt-BR') =>
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xmlEscape(lang)}" lang="${xmlEscape(lang)}">
<head>
  <meta charset="UTF-8"/>
  <title>${xmlEscape(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
${bodyXhtml}
</body>
</html>`;

const STYLES_CSS = `/* Estilo base — pensado para Kindle, iBooks, Kobo e leitores web */
@namespace epub "http://www.idpf.org/2007/ops";
html, body { margin: 0; padding: 0; }
body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.55;
  color: #1a1a1a;
  padding: 0 4%;
  text-align: justify;
  hyphens: auto;
}
h1, h2, h3, h4 {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  line-height: 1.25;
  color: #0f172a;
  page-break-after: avoid;
  text-align: left;
}
h1 { font-size: 1.8em; margin: 1.2em 0 0.6em; }
h2 { font-size: 1.4em; margin: 1.4em 0 0.5em; }
h3 { font-size: 1.15em; margin: 1.2em 0 0.4em; }
p  { margin: 0 0 0.85em; text-indent: 1.2em; }
p.first, h1 + p, h2 + p, h3 + p { text-indent: 0; }
ul, ol { margin: 0 0 1em 1.4em; }
li { margin-bottom: 0.3em; }
blockquote {
  margin: 1em 0;
  padding: 0.6em 1em;
  border-left: 3px solid #0891b2;
  background: #ecfeff;
  color: #155e75;
  font-style: italic;
}
hr { border: 0; border-top: 1px solid #cbd5e1; margin: 1.5em 20%; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.95em; }
th, td { border: 1px solid #cbd5e1; padding: 0.4em 0.6em; text-align: left; }
th { background: #0891b2; color: #fff; }
img { max-width: 100%; height: auto; }
.cover-page {
  margin: 0; padding: 0; text-align: center; page-break-after: always;
}
.cover-page img { width: 100%; height: auto; max-height: 100vh; }
.title-page {
  text-align: center;
  page-break-after: always;
  padding-top: 25%;
}
.title-page .book-title { font-size: 2em; font-weight: bold; }
.title-page .book-subtitle { font-size: 1.2em; color: #475569; margin-top: 0.5em; font-style: italic; }
.title-page .book-author { margin-top: 3em; font-size: 1.1em; }
.chapter { page-break-before: always; }
nav[epub|type="toc"] ol { list-style: none; padding-left: 0; }
nav[epub|type="toc"] li { margin: 0.3em 0; }
`;

type ChapterFile = {
  href: string;
  id: string;
  title: string;
  type: 'cover' | 'title' | 'intro' | 'chapter' | 'conclusion';
};

/** Faz fetch da capa e retorna {data, mime, ext}. Retorna null em falha. */
async function loadCover(url: string): Promise<{ data: ArrayBuffer; mime: string; ext: string } | null> {
  try {
    const resp = await fetch(url, { mode: 'cors', cache: 'no-cache' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    let mime = blob.type || 'image/jpeg';
    let ext = 'jpg';
    if (mime.includes('png')) ext = 'png';
    else if (mime.includes('webp')) {
      // EPUB aceita webp em readers modernos, mas KDP prefere JPEG/PNG.
      // Mantemos webp; se houver problema na conversão, o usuário troca.
      ext = 'webp';
    } else {
      mime = 'image/jpeg';
      ext = 'jpg';
    }
    return { data: await blob.arrayBuffer(), mime, ext };
  } catch {
    return null;
  }
}

export async function exportEbookEpub(
  ebook: EbookFull,
  meta: KdpMetadata,
  onProgress?: (p: { current: number; total: number; label: string }) => void,
): Promise<void> {
  const lang = (meta.language || 'pt-BR').trim();
  const author = (meta.author || '').trim() || 'Autor Desconhecido';
  const idType = meta.identifierType || (meta.identifier ? 'ISBN' : 'UUID');
  const idValue = (meta.identifier || '').trim() || `urn:uuid:${uuidv4()}`;
  const idScheme =
    idType === 'ISBN' ? 'ISBN' : idType === 'ASIN' ? 'ASIN' : 'UUID';
  const pubDate = (meta.publicationDate || new Date().toISOString().slice(0, 10)).trim();
  const description = (meta.description || '').trim();
  const publisher = (meta.publisher || '').trim();
  const rights = (meta.rights || '').trim();
  const keywords = (meta.keywords || []).map((k) => k.trim()).filter(Boolean);
  const categories = (meta.categories || []).map((c) => c.trim()).filter(Boolean);
  const contributor = (meta.contributor || '').trim();

  const total = 5 + (ebook.chapters?.length || 0);
  let step = 0;
  const tick = (label: string) => {
    step += 1;
    onProgress?.({ current: step, total, label });
  };

  tick('Preparando estrutura EPUB');
  const zip = new JSZip();

  // 1) mimetype (sem compressão, primeiro arquivo)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2) container.xml
  zip.folder('META-INF')!.file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const oebps = zip.folder('OEBPS')!;
  oebps.file('styles.css', STYLES_CSS);

  // 3) Capa
  tick('Processando capa');
  let coverFile: { href: string; mime: string; id: string } | null = null;
  if (ebook.cover_url) {
    const cover = await loadCover(ebook.cover_url);
    if (cover) {
      const filename = `cover.${cover.ext}`;
      oebps.file(filename, cover.data);
      coverFile = { href: filename, mime: cover.mime, id: 'cover-image' };
    }
  }

  const files: ChapterFile[] = [];

  // cover.xhtml
  if (coverFile) {
    const body = `<section epub:type="cover" class="cover-page">
  <img src="${xmlEscape(coverFile.href)}" alt="${xmlEscape(ebook.title || 'Capa')}"/>
</section>`;
    oebps.file('cover.xhtml', xhtmlPage('Capa', body, lang));
    files.push({ href: 'cover.xhtml', id: 'cover', title: 'Capa', type: 'cover' });
  }

  // 4) Página de título
  tick('Gerando página de título');
  const titlePageBody = `<section epub:type="titlepage" class="title-page">
  <p class="book-title">${xmlEscape(ebook.title || 'Sem título')}</p>
  ${ebook.subtitle ? `<p class="book-subtitle">${xmlEscape(ebook.subtitle)}</p>` : ''}
  <p class="book-author">${xmlEscape(author)}</p>
  ${publisher ? `<p>${xmlEscape(publisher)}</p>` : ''}
</section>`;
  oebps.file('title.xhtml', xhtmlPage('Página de Título', titlePageBody, lang));
  files.push({ href: 'title.xhtml', id: 'titlepage', title: 'Página de Título', type: 'title' });

  // 5) Introdução
  if (ebook.introduction && ebook.introduction.trim()) {
    tick('Convertendo introdução');
    const inner = sanitizeXhtml(ebook.introduction) || `<p>${xmlEscape(ebook.introduction)}</p>`;
    const body = `<section epub:type="preface" class="chapter">
  <h1>Introdução</h1>
  ${inner}
</section>`;
    oebps.file('intro.xhtml', xhtmlPage('Introdução', body, lang));
    files.push({ href: 'intro.xhtml', id: 'intro', title: 'Introdução', type: 'intro' });
  }

  // 6) Capítulos
  for (const ch of ebook.chapters || []) {
    tick(`Capítulo ${ch.chapter_number}: ${ch.title}`);
    const inner = sanitizeXhtml(ch.content_html) || `<p>${xmlEscape(ch.content_html || '')}</p>`;
    const body = `<section epub:type="chapter" class="chapter">
  <h1>${xmlEscape(ch.title || `Capítulo ${ch.chapter_number}`)}</h1>
  ${inner}
</section>`;
    const href = `chapter-${ch.chapter_number}.xhtml`;
    oebps.file(href, xhtmlPage(ch.title || `Capítulo ${ch.chapter_number}`, body, lang));
    files.push({ href, id: `chapter-${ch.chapter_number}`, title: ch.title || `Capítulo ${ch.chapter_number}`, type: 'chapter' });
  }

  // 7) Conclusão
  if (ebook.conclusion && ebook.conclusion.trim()) {
    tick('Convertendo conclusão');
    const inner = sanitizeXhtml(ebook.conclusion) || `<p>${xmlEscape(ebook.conclusion)}</p>`;
    let extra = '';
    if (ebook.cta && ebook.cta.trim()) {
      extra = `<hr/><p><strong>${xmlEscape(ebook.cta)}</strong></p>`;
    }
    const body = `<section epub:type="afterword" class="chapter">
  <h1>Conclusão</h1>
  ${inner}
  ${extra}
</section>`;
    oebps.file('conclusion.xhtml', xhtmlPage('Conclusão', body, lang));
    files.push({ href: 'conclusion.xhtml', id: 'conclusion', title: 'Conclusão', type: 'conclusion' });
  }

  // 8) nav.xhtml — sumário EPUB 3
  tick('Montando sumário navegável');
  const navItems = files
    .filter((f) => f.type !== 'cover')
    .map((f) => `      <li><a href="${xmlEscape(f.href)}">${xmlEscape(f.title)}</a></li>`)
    .join('\n');
  const navBody = `<nav epub:type="toc" id="toc">
  <h1>Sumário</h1>
  <ol>
${navItems}
  </ol>
</nav>
<nav epub:type="landmarks" id="landmarks" hidden="">
  <ol>
    ${coverFile ? `<li><a epub:type="cover" href="cover.xhtml">Capa</a></li>` : ''}
    <li><a epub:type="bodymatter" href="${files.find((f) => f.type === 'intro' || f.type === 'chapter')?.href || 'title.xhtml'}">Início</a></li>
    <li><a epub:type="toc" href="nav.xhtml">Sumário</a></li>
  </ol>
</nav>`;
  oebps.file('nav.xhtml', xhtmlPage('Sumário', navBody, lang));

  // 9) toc.ncx — para retro-compatibilidade Kindle (KDP recomenda)
  const ncxNavPoints = files
    .filter((f) => f.type !== 'cover')
    .map(
      (f, i) => `    <navPoint id="${xmlEscape(f.id)}" playOrder="${i + 1}">
      <navLabel><text>${xmlEscape(f.title)}</text></navLabel>
      <content src="${xmlEscape(f.href)}"/>
    </navPoint>`,
    )
    .join('\n');
  const ncxIdentifier = idValue.startsWith('urn:uuid:') ? idValue : `urn:${idScheme.toLowerCase()}:${idValue}`;
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${xmlEscape(lang)}">
  <head>
    <meta name="dtb:uid" content="${xmlEscape(ncxIdentifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${xmlEscape(ebook.title || 'Ebook')}</text></docTitle>
  <docAuthor><text>${xmlEscape(author)}</text></docAuthor>
  <navMap>
${ncxNavPoints}
  </navMap>
</ncx>`;
  oebps.file('toc.ncx', ncx);

  // 10) content.opf — manifesto + spine + metadata
  tick('Gerando metadados (OPF)');
  const manifestItems: string[] = [
    `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `    <item id="css" href="styles.css" media-type="text/css"/>`,
  ];
  if (coverFile) {
    manifestItems.push(
      `    <item id="${coverFile.id}" href="${xmlEscape(coverFile.href)}" media-type="${coverFile.mime}" properties="cover-image"/>`,
    );
  }
  for (const f of files) {
    manifestItems.push(
      `    <item id="${xmlEscape(f.id)}" href="${xmlEscape(f.href)}" media-type="application/xhtml+xml"/>`,
    );
  }

  const spineItems = files
    .map((f) => `    <itemref idref="${xmlEscape(f.id)}"${f.type === 'cover' ? ' linear="yes"' : ''}/>`)
    .join('\n');

  const subjectTags = [...keywords, ...categories]
    .map((s) => `    <dc:subject>${xmlEscape(s)}</dc:subject>`)
    .join('\n');

  const opfIdentifier = idValue.startsWith('urn:') ? idValue : (idScheme === 'UUID' ? `urn:uuid:${idValue}` : idValue);

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${xmlEscape(lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="bookid">${xmlEscape(opfIdentifier)}</dc:identifier>
    <dc:title>${xmlEscape(ebook.title || 'Ebook')}</dc:title>
    <dc:language>${xmlEscape(lang)}</dc:language>
    <dc:creator id="creator">${xmlEscape(author)}</dc:creator>
    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
    <meta refines="#creator" property="file-as">${xmlEscape(author)}</meta>
    ${contributor ? `<dc:contributor>${xmlEscape(contributor)}</dc:contributor>` : ''}
    ${publisher ? `<dc:publisher>${xmlEscape(publisher)}</dc:publisher>` : ''}
    ${description ? `<dc:description>${xmlEscape(description)}</dc:description>` : ''}
    ${rights ? `<dc:rights>${xmlEscape(rights)}</dc:rights>` : ''}
    <dc:date>${xmlEscape(pubDate)}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
${subjectTags}
    ${coverFile ? `<meta name="cover" content="${coverFile.id}"/>` : ''}
  </metadata>
  <manifest>
${manifestItems.join('\n')}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
  oebps.file('content.opf', opf);

  tick('Compactando arquivo .epub');
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(ebook.title || 'ebook')}.epub`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
