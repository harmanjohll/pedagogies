/*
 * Co-Cher — Takehome Card
 * =======================
 * An audience-facing, one-page "takehome card" generated from a lesson: the big
 * idea, a few key takeaways, and a next step. Built for assembly / open-house /
 * AIC style sessions — the audience watches the projected presentation and
 * leaves with a card that reinforces the learning (filing is up to them).
 *
 * Three outputs, all client-side / offline:
 *   • compileCardHTML() → a self-contained page: one big card on screen, laid
 *     out N-per-A4 for handout printing, downloadable.
 *   • pack/unpackCardModel() + renderCardView() → a shareable digital copy: the
 *     card model rides inside a `#/card/<packed>` URL (no backend — the app is
 *     on GitHub Pages), so a link opens the card on any device.
 *   • saveCardMaterial() → store the compiled card as a lesson material (IDB),
 *     so Present can offer it and it survives offline.
 *
 * Deterministic by default (works with no API key), mirroring the showcase decks.
 */

import { idbPut } from './storage.js';
import { Store } from '../state.js';
import { resolveTeachingAction } from './stp.js';

const CARDS_KEY = 'cocher_cards';
const MEDIA_STORE = 'media';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function clean(s, max = 140) {
  return String(s ?? '').replace(/\s+/g, ' ').replace(/\[[^\]]*\]/g, '').trim().slice(0, max).trim();
}
function firstSentence(s) {
  const t = clean(s, 400);
  const m = t.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : t).trim();
}

/* Pull the "I can…" success criteria out of a LISC block, if present. */
function successCriteria(lisc) {
  const lines = String(lisc || '').split('\n');
  const out = [];
  for (const ln of lines) {
    const m = ln.match(/^\s*[-*•]?\s*(I can .+)$/i);
    if (m) out.push(clean(m[1], 120));
  }
  return out;
}

/**
 * Build a compact card model from a lesson — deterministic, offline.
 * → { title, bigIdea, takeaways[3–5], nextStep, footer }
 */
export function buildCardModel(lesson) {
  const l = lesson || {};
  const title = clean(l.title, 90) || 'Today’s learning';
  const bigIdea = clean(l.lessonHook, 160) || firstSentence(l.objectives) || '';

  // Takeaways: prefer LISC success criteria, then objective sentences, then the
  // student-facing framing / instructions of each staged segment.
  let takeaways = successCriteria(l.components?.lisc?.content);
  if (takeaways.length < 3) {
    const objBits = String(l.objectives || '').split(/[.;\n]/).map(s => clean(s, 120)).filter(Boolean);
    takeaways = takeaways.concat(objBits);
  }
  if (takeaways.length < 3) {
    (l.runOfShow?.segments || []).forEach(seg => {
      const a = resolveTeachingAction(seg);
      const bit = clean(a?.studentFraming || seg.studentInstructions || seg.name, 120);
      if (bit) takeaways.push(bit);
    });
  }
  // de-dupe + cap
  const seen = new Set();
  takeaways = takeaways.filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 5);

  const nextStep = clean(
    (String(l.components?.exitTicket?.content || '').split('\n').find(x => /\?$/.test(x.trim())) || '').replace(/^[-*•\s]+/, ''),
    160
  ) || 'One thing I’ll remember — and one thing I’ll try.';

  const school = (Store.getSchoolProfile?.() || {}).name || '';
  return { title, bigIdea, takeaways, nextStep, footer: school };
}

/* Compact pack/unpack for the shareable URL (unicode-safe base64). */
export function packCardModel(model) {
  const compact = { t: model.title, b: model.bigIdea, k: model.takeaways, n: model.nextStep, f: model.footer };
  const json = JSON.stringify(compact);
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}
export function unpackCardModel(packed) {
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(String(packed)))));
    const c = JSON.parse(json);
    return { title: c.t || '', bigIdea: c.b || '', takeaways: Array.isArray(c.k) ? c.k : [], nextStep: c.n || '', footer: c.f || '' };
  } catch { return null; }
}

/** A shareable URL that opens this card on any device (data rides in the hash). */
export function cardShareUrl(model) {
  const base = location.origin + location.pathname;
  return `${base}#/card/${packCardModel(model)}`;
}

/* The card body markup, shared by the screen card, the print copies, and the
 * digital viewer. `qrSVG` is an optional inline SVG string (kept generic so the
 * QR can be dropped in later without touching this file). */
function cardInner(model, { qrSVG } = {}) {
  const takeaways = (model.takeaways || []).filter(Boolean);
  return `
    <div class="thc-band"></div>
    <div class="thc-body">
      <div class="thc-kicker">Take this home</div>
      <h1 class="thc-title">${esc(model.title)}</h1>
      ${model.bigIdea ? `<p class="thc-big">${esc(model.bigIdea)}</p>` : ''}
      ${takeaways.length ? `<div class="thc-sec">What to take away</div><ul class="thc-list">${takeaways.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="thc-next"><span class="thc-next-ic">➜</span><div><div class="thc-sec">Your next step</div><div>${esc(model.nextStep)}</div></div></div>
      ${qrSVG ? `<div class="thc-qr">${qrSVG}<span>Scan to keep this card</span></div>` : ''}
      <div class="thc-foot">${esc(model.footer || 'Co-Cher')}</div>
    </div>`;
}

const CARD_CSS = `
  :root { --navy:#000C53; --yellow:#FFE200; --red:#e11d48; --ink:#0f172a; --muted:#475569; --line:#e2e8f0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, "Times New Roman", serif; background:#eef1f6; color:var(--ink); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .thc-card { position:relative; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 12px 40px rgba(2,6,23,.16); border:1px solid var(--line); }
  .thc-band { height:12px; background:linear-gradient(90deg,var(--navy) 0 70%, var(--yellow) 70% 100%); }
  .thc-body { padding:26px 28px 22px; }
  .thc-kicker { font-family: Calibri, system-ui, sans-serif; font-size:.72rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--red); margin-bottom:8px; }
  .thc-title { font-size:1.7rem; line-height:1.15; color:var(--navy); margin-bottom:10px; }
  .thc-big { font-size:1.02rem; line-height:1.5; color:var(--muted); font-style:italic; margin-bottom:16px; }
  .thc-sec { font-family: Calibri, system-ui, sans-serif; font-size:.72rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--navy); margin-bottom:6px; }
  .thc-list { list-style:none; display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
  .thc-list li { position:relative; padding-left:22px; font-size:1rem; line-height:1.4; }
  .thc-list li::before { content:"✓"; position:absolute; left:0; top:0; color:var(--red); font-weight:700; }
  .thc-next { display:flex; gap:12px; align-items:flex-start; background:#f8fafc; border-left:4px solid var(--yellow); border-radius:10px; padding:12px 14px; }
  .thc-next-ic { color:var(--navy); font-size:1.2rem; line-height:1.2; }
  .thc-qr { display:flex; flex-direction:column; align-items:center; gap:6px; margin-top:16px; }
  .thc-qr svg { width:132px; height:132px; }
  .thc-qr span { font-family: Calibri, system-ui, sans-serif; font-size:.72rem; color:var(--muted); }
  .thc-foot { margin-top:16px; padding-top:12px; border-top:1px solid var(--line); font-family: Calibri, system-ui, sans-serif; font-size:.8rem; color:var(--muted); text-align:center; }
`;

/**
 * A self-contained card page: one card centred on screen; on print, `perPage`
 * identical copies laid out on A4 for cutting into handouts.
 * opts: { theme, qrSVG, perPage=2 }
 */
export function compileCardHTML(model, opts = {}) {
  const perPage = Math.max(1, Math.min(4, opts.perPage || 2));
  const card = `<div class="thc-card">${cardInner(model, opts)}</div>`;
  const copies = Array.from({ length: perPage }, () => `<div class="thc-print-cell">${card}</div>`).join('');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(model.title)} — takehome card</title>
<style>
  ${CARD_CSS}
  .thc-screen { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:24px; }
  .thc-screen .thc-card { width:min(440px, 92vw); }
  .thc-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  .thc-actions button { font:inherit; font-family:Calibri,system-ui,sans-serif; font-size:.9rem; font-weight:700; cursor:pointer; border:1px solid var(--navy); background:var(--navy); color:#fff; border-radius:999px; padding:9px 18px; }
  .thc-actions button.ghost { background:#fff; color:var(--navy); }
  .thc-print { display:none; }
  @media print {
    body { background:#fff; }
    .thc-screen, .thc-actions { display:none !important; }
    .thc-print { display:grid; grid-template-columns:1fr; gap:10mm; padding:8mm; }
    .thc-print-cell { break-inside:avoid; }
    .thc-print-cell .thc-card { box-shadow:none; }
  }
</style></head>
<body>
  <div class="thc-screen">
    <div class="thc-card">${cardInner(model, opts)}</div>
    <div class="thc-actions">
      <button onclick="window.print()">Print cards</button>
      <button class="ghost" onclick="window.close()">Close</button>
    </div>
  </div>
  <div class="thc-print">${copies}</div>
</body></html>`;
}

/** Inline preview markup (card + scoped styles) for embedding, e.g. the
 * Present takehome screen. */
export function cardPreviewHTML(model) {
  return `<style>${CARD_CSS}</style><div class="thc-card" style="max-width:420px;margin:0 auto;text-align:left;">${cardInner(model)}</div>`;
}

/** Open the printable/downloadable card in a new tab (self-contained blob). */
export function openCardWindow(model, opts = {}) {
  const html = compileCardHTML(model, opts);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ── Materials store (parallel to decks) ── */
function readList() { try { const r = localStorage.getItem(CARDS_KEY); const p = r ? JSON.parse(r) : []; return Array.isArray(p) ? p : []; } catch { return []; } }
function writeList(list) { try { localStorage.setItem(CARDS_KEY, JSON.stringify(list)); return true; } catch { return false; } }
export function listCardMeta() { return readList(); }

/** Persist a compiled card (HTML → IDB media, metadata → localStorage). */
export async function saveCardMaterial({ lessonId, title, html } = {}) {
  if (typeof html !== 'string' || !html) return null;
  const meta = { id: 'card_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), lessonId: lessonId || null, title: String(title || 'Takehome card').slice(0, 140), createdAt: Date.now() };
  const ok = await idbPut(MEDIA_STORE, meta.id, html);
  if (!ok) return null;
  writeList([...readList(), meta]);
  return meta;
}

/**
 * Render the shareable digital card into a container (the `#/card/:data` route).
 * Decodes the packed model from the URL; shows a friendly message if malformed.
 */
export function renderCardView(container, packed) {
  const model = unpackCardModel(packed);
  if (!model) {
    container.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif;color:#475569;">This takehome-card link looks incomplete or damaged.</div>`;
    return null;
  }
  document.body.classList.add('present-mode'); // hide app chrome; this is a standalone card
  container.innerHTML = `<style>${CARD_CSS}
    .thc-view { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:#eef1f6; }
    .thc-view .thc-card { width:min(440px, 94vw); }</style>
    <div class="thc-view"><div class="thc-card">${cardInner(model)}</div></div>`;
  return () => { document.body.classList.remove('present-mode'); };
}
