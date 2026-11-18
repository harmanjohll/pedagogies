/*
 * Co-Cher Document Text Extraction
 * ================================
 * Turns an uploaded File into plain text for the References library (B7) and
 * anywhere else a teacher's document becomes AI context. Dispatches by file
 * extension.
 *
 * Implemented here: .txt / .md / .csv / .text (read as text), .xlsx / .xls
 * (via the already-loaded SheetJS, window.XLSX — same path student-upload.js uses),
 * and .docx / .pptx (unzipped in-browser with JSZip, window.JSZip — a .docx/.pptx
 * is just a ZIP of XML parts; we inflate the text-bearing parts and strip markup).
 * PDFs are handled by components/pdf-upload.js (pdf.js page-range extraction) —
 * this module intentionally does NOT duplicate that; callers route .pdf there.
 */

/** Read a File as UTF-8 text. */
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsText(file);
  });
}

/** Read a File as an ArrayBuffer. */
function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsArrayBuffer(file);
  });
}

/** Lower-cased extension without the dot, e.g. 'xlsx'. */
export function fileExt(file) {
  const name = (file && file.name) || '';
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/* ── DOCX / PPTX: minimal in-browser unzip via JSZip (window.JSZip) ──
 * Both formats are ZIP archives of XML parts. We inflate the text-bearing
 * part(s) and strip the markup, preserving paragraph / slide breaks. No server
 * and no heavy Office parser — just the small JSZip lib loaded in app/cocher.html.
 * Fails with a teacher-readable Error if JSZip isn't loaded. */

/** Load a File as a JSZip archive. */
async function loadZip(file) {
  if (!window.JSZip) {
    throw new Error('Document support is still loading — please try again in a moment.');
  }
  const buf = await readAsArrayBuffer(file);
  try {
    return await window.JSZip.loadAsync(buf);
  } catch {
    throw new Error('Could not open this file — it may be corrupted or not a valid Office document.');
  }
}

/** Decode the handful of XML entities that appear in Office text runs. */
function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; } })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
    .replace(/&amp;/g, '&'); // ampersand last so decoded entities aren't re-decoded
}

/** Tidy extracted text: decode entities, trim trailing spaces, cap blank runs. */
function normalizeExtracted(s) {
  return decodeXmlEntities(s).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Word document.xml → text. Runs (<w:t>) concatenate; paragraph ends (</w:p>)
 * and breaks (<w:br/>, <w:cr/>) become newlines; tabs (<w:tab/>) become tabs.
 * Word can split a single word across several <w:t> runs, so runs join with no
 * separator (joining with spaces would corrupt words).
 */
function docxXmlToText(xml) {
  const s = String(xml)
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
  return normalizeExtracted(s);
}

/**
 * PowerPoint slideN.xml → text. Runs (<a:t>) concatenate; paragraph ends
 * (</a:p>) and breaks (<a:br/>) become newlines.
 */
function pptxXmlToText(xml) {
  const s = String(xml)
    .replace(/<a:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/a:p>/g, '\n')
    .replace(/<[^>]+>/g, '');
  return normalizeExtracted(s);
}

/** Numeric order of a ppt/slides/slideN.xml part name. */
const slideNumber = (name) => { const m = name.match(/slide(\d+)\.xml$/i); return m ? parseInt(m[1], 10) : 0; };

/**
 * Extract plain text from a File.
 * @returns {Promise<{ text: string, meta: { type: string, [k:string]: any } }>}
 * @throws  a teacher-readable Error for unsupported / not-yet-wired types.
 */
export async function extractText(file) {
  const ext = fileExt(file);

  switch (ext) {
    case 'txt':
    case 'text':
    case 'md':
    case 'markdown':
    case 'csv': {
      const text = await readAsText(file);
      return { text, meta: { type: ext } };
    }

    case 'xlsx':
    case 'xls': {
      if (!window.XLSX) throw new Error('Spreadsheet support is still loading — please try again in a moment.');
      const buf = await readAsArrayBuffer(file);
      const wb = window.XLSX.read(buf, { type: 'array' });
      // Concatenate every sheet as CSV so multi-tab workbooks are captured.
      const parts = wb.SheetNames.map(name => {
        const csv = window.XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        return wb.SheetNames.length > 1 ? `# ${name}\n${csv}` : csv;
      });
      return { text: parts.join('\n\n'), meta: { type: ext, sheets: wb.SheetNames.length } };
    }

    case 'pdf':
      // pdf.js page-range extraction lives in components/pdf-upload.js.
      throw new Error('For PDFs, use the PDF uploader (it lets you pick page ranges).');

    case 'docx': {
      const zip = await loadZip(file);
      const entry = zip.file('word/document.xml');
      if (!entry) throw new Error('This .docx has no readable body (word/document.xml is missing).');
      const text = docxXmlToText(await entry.async('string'));
      return { text, meta: { type: 'docx' } };
    }

    case 'pptx': {
      const zip = await loadZip(file);
      const slideNames = Object.keys(zip.files)
        .filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
        .sort((a, b) => slideNumber(a) - slideNumber(b));
      if (slideNames.length === 0) throw new Error('This .pptx has no readable slides.');
      const slides = [];
      for (let i = 0; i < slideNames.length; i++) {
        const t = pptxXmlToText(await zip.file(slideNames[i]).async('string'));
        slides.push(`# Slide ${i + 1}${t ? `\n${t}` : ''}`);
      }
      return { text: slides.join('\n\n'), meta: { type: 'pptx', slides: slideNames.length } };
    }

    default:
      throw new Error(`Unsupported file type ".${ext}". Try .txt, .md, .csv, .xlsx, .docx, .pptx or .pdf.`);
  }
}
