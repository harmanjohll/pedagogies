/*
 * Co-Cher — Chat attachments (images + PDFs)
 * ==========================================
 * Turns a teacher-selected image or PDF into something the Gemini chat can
 * actually *see*. Everything stays client-side (no backend, no upload server):
 *
 *   • Images are downscaled to a sane edge length and base64-encoded, then
 *     passed to Gemini as inline multimodal input — so the model reads the
 *     worksheet, diagram, marking rubric or photo of student work directly.
 *   • PDFs are sent inline when small (Gemini 2.5 accepts application/pdf
 *     natively); when a PDF is too large for a single request, we fall back to
 *     pdf.js text extraction and hand the model the text instead.
 *
 * The rest of the app keeps treating a chat message's `content` as a plain
 * string — attachments live on an additive `message.attachments` array that
 * only the API layer expands (see `toMultimodalMessage`). Base64 bytes are
 * stripped before anything is persisted to localStorage (`stripAttachmentData`)
 * so a few screenshots can never blow the storage quota.
 */

// accept= string for the hidden <input type="file"> — images + PDF.
export const ATTACH_ACCEPT =
  'image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf,.png,.jpg,.jpeg,.webp,.gif,.pdf';

const MAX_INLINE_BYTES = 6 * 1024 * 1024; // ~6MB raw → ~8MB base64, safely under Gemini's ~20MB request ceiling
const IMAGE_MAX_EDGE = 1600;              // longest-side px after downscale — keeps worksheets legible but light
const PDF_TEXT_PAGE_CAP = 20;             // when falling back to text, cap pages so the context stays bounded

function isImageFile(file) {
  return /^image\//.test(file.type || '') || /\.(png|jpe?g|webp|gif)$/i.test(file.name || '');
}
function isPdfFile(file) {
  return (file.type || '') === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

/** True when this file is something we know how to attach (image or PDF). */
export function isAcceptedAttachment(file) {
  return !!file && (isImageFile(file) || isPdfFile(file));
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(file);
  });
}
function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsArrayBuffer(file);
  });
}

function dataUrlToBase64(dataUrl) {
  const i = String(dataUrl).indexOf(',');
  return i >= 0 ? String(dataUrl).slice(i + 1) : '';
}
/** Approximate decoded byte length of a base64 string (for size guards). */
function base64Bytes(b64) {
  return Math.floor((String(b64).length * 3) / 4);
}

/**
 * Downscale an image to <= IMAGE_MAX_EDGE on its longest side and re-encode as
 * JPEG. Small images that already fit inline are passed through untouched so we
 * keep their original fidelity (and transparency, for PNGs).
 */
async function buildImageAttachment(file) {
  const dataUrl = await readAsDataURL(file);
  const originalB64 = dataUrlToBase64(dataUrl);

  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('Could not decode the image.'));
    im.src = dataUrl;
  });

  const longest = Math.max(img.width || 0, img.height || 0);
  const scale = longest > 0 ? Math.min(1, IMAGE_MAX_EDGE / longest) : 1;

  // Already small enough on both axes and under the inline cap → keep as-is.
  if (scale >= 1 && base64Bytes(originalB64) <= MAX_INLINE_BYTES) {
    return {
      name: file.name, kind: 'image',
      mimeType: file.type || 'image/png', data: originalB64,
      previewUrl: dataUrl,
    };
  }

  const w = Math.max(1, Math.round((img.width || 1) * scale));
  const h = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL('image/jpeg', 0.85);
  return {
    name: file.name, kind: 'image',
    mimeType: 'image/jpeg', data: dataUrlToBase64(out),
    previewUrl: out,
  };
}

/** Extract text from the first `pageCap` pages of a PDF via pdf.js. */
async function extractPdfTextCapped(arrayBuffer, pageCap) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error('PDF reader not ready — please refresh and try again.');
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const end = Math.min(pageCap, pdf.numPages);
  const pages = [];
  for (let i = 1; i <= end; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map(it => it.str).join(' '));
  }
  let text = pages.join('\n\n').trim();
  if (pdf.numPages > end) text += `\n\n[…${pdf.numPages - end} further page(s) not included]`;
  return text;
}

/**
 * Small PDFs go inline (Gemini reads them natively); large ones fall back to
 * text extraction so we never bust the request-size ceiling.
 */
async function buildPdfAttachment(file) {
  if (file.size <= MAX_INLINE_BYTES) {
    const dataUrl = await readAsDataURL(file);
    return { name: file.name, kind: 'pdf', mimeType: 'application/pdf', data: dataUrlToBase64(dataUrl) };
  }
  const buf = await readAsArrayBuffer(file);
  const text = await extractPdfTextCapped(buf, PDF_TEXT_PAGE_CAP);
  if (!text) {
    throw new Error('That PDF is too large to attach and has no extractable text (it may be scanned). Try a smaller file or fewer pages.');
  }
  return { name: file.name, kind: 'pdf-text', text };
}

/**
 * Turn a File into a Co-Cher attachment record. Returns one of:
 *   { name, kind:'image', mimeType, data, previewUrl }
 *   { name, kind:'pdf',   mimeType:'application/pdf', data }
 *   { name, kind:'pdf-text', text }               // large-PDF fallback
 * Throws on unsupported types or unreadable files.
 */
export async function buildAttachment(file) {
  if (isImageFile(file)) return buildImageAttachment(file);
  if (isPdfFile(file)) return buildPdfAttachment(file);
  throw new Error('Only images (PNG/JPG/WebP/GIF) and PDFs can be attached.');
}

/**
 * Expand a stored message into the multimodal shape `sendChat` understands.
 * Text-only messages pass straight through (content stays a string). PDF-text
 * fallbacks are folded into the text part; images and inline PDFs become
 * Gemini `inlineData` parts.
 */
export function toMultimodalMessage(m) {
  const attachments = Array.isArray(m.attachments) ? m.attachments : [];
  const inlineParts = attachments.filter(a => a && a.data && (a.kind === 'image' || a.kind === 'pdf'));
  const textFallbacks = attachments.filter(a => a && a.kind === 'pdf-text' && a.text);
  if (!inlineParts.length && !textFallbacks.length) {
    return { role: m.role, content: m.content };
  }
  let text = typeof m.content === 'string' ? m.content : '';
  textFallbacks.forEach(a => { text += `\n\n[Attached PDF "${a.name}" — extracted text]:\n${a.text}`; });
  const parts = [{ text }];
  inlineParts.forEach(a => parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } }));
  return { role: m.role, content: parts };
}

/**
 * A short, human/AI-readable note naming the attached files. Injected into the
 * message text so the reference survives persistence (base64 does not) and the
 * model is told to treat the files as source material.
 */
export function attachmentContextNote(attachments) {
  if (!attachments || !attachments.length) return '';
  const names = attachments.map(a => a.name).filter(Boolean);
  const list = names.length ? names.join(', ') : `${attachments.length} file(s)`;
  return `[The teacher attached ${attachments.length} file(s): ${list}. Use them as primary source material for this lesson — read them carefully before responding.]`;
}

/**
 * Strip heavy base64 (and preview URLs) from message attachments before
 * persisting to localStorage. Keeps light metadata so the chip still renders on
 * reload — the bytes are only needed for the live request.
 */
export function stripAttachmentData(messages) {
  return (messages || []).map(m => {
    if (!Array.isArray(m.attachments) || !m.attachments.length) return m;
    return {
      ...m,
      attachments: m.attachments.map(a => ({ name: a.name, kind: a.kind, mimeType: a.mimeType })),
    };
  });
}
