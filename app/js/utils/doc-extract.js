/*
 * Co-Cher Document Text Extraction
 * ================================
 * Turns an uploaded File into plain text for the References library (B7) and
 * anywhere else a teacher's document becomes AI context. Dispatches by file
 * extension.
 *
 * Implemented here: .txt / .md / .csv / .text (read as text) and .xlsx / .xls
 * (via the already-loaded SheetJS, window.XLSX — same path student-upload.js uses).
 * PDFs are handled by components/pdf-upload.js (pdf.js page-range extraction) —
 * this module intentionally does NOT duplicate that; callers route .pdf there.
 *
 * TODO(WS3): .docx (dependency-free unzip + word/document.xml) and .pptx
 * (small CDN lib) branches — see the throw stubs below.
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

    // TODO(WS3): implement these two branches + load their libs in app/cocher.html.
    case 'docx':
      throw new Error('DOCX support is being wired up.');
    case 'pptx':
      throw new Error('PPTX support is being wired up.');

    default:
      throw new Error(`Unsupported file type ".${ext}". Try .txt, .md, .csv, .xlsx, .docx, .pptx or .pdf.`);
  }
}
