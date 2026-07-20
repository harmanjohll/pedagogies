/*
 * Co-Cher Materials: Deck Compiler + Materials Store (WS-4)
 * =========================================================
 * compileDeckHTML() turns a normalized deck ({title, slides:[{title,
 * bullets, notes}]}) into ONE self-contained HTML document: no external
 * resources of any kind, keyboard/click/touch navigation, slide counter,
 * and print CSS (one slide per page → PDF via the browser's print dialog).
 *
 * Also home to the shared materials store used by the Lesson Planner,
 * Lessons detail and Present views: metadata lists live in localStorage
 * ('cocher_v6_2_decks' / 'cocher_v6_2_audio_clips'); the bulky payloads (deck HTML
 * strings, audio WAV Blobs) live in the IndexedDB 'media' store keyed by
 * material id. attachedResources entries {type:'deck'|'audio', id, title}
 * point at those ids.
 */

import { idbPut, idbGet } from './storage.js';

const DECKS_KEY = 'cocher_v6_2_decks';
const AUDIO_KEY = 'cocher_v6_2_audio_clips';
const MEDIA_STORE = 'media';

/* ── Escaping — every model/teacher string that lands in the compiled
 * document goes through this (attribute-safe: quotes covered). ── */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Filename-safe slug for a material title (no extension). */
export function slugify(title) {
  const slug = String(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'material';
}

/** Download filename for a compiled deck. */
export function deckFilename(title) {
  const slug = slugify(title);
  return (slug === 'material' ? 'deck' : slug) + '.html';
}

/**
 * Compile a deck into one self-contained HTML document string.
 * deck: { title, slides: [{ title, bullets: [..], notes }] }
 * options.theme: optional { accent, bg, ink } CSS color overrides.
 */
export function compileDeckHTML(deck, { theme } = {}) {
  const safeColor = (v, fallback) =>
    (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim())) ? v.trim() : fallback;
  const accent = safeColor(theme?.accent, '#4361ee');
  const bg = safeColor(theme?.bg, '#0f1226');
  const ink = safeColor(theme?.ink, '#f5f6fb');

  const title = String(deck?.title ?? 'Slide deck');
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const total = slides.length;

  const slideHTML = slides.map((s, i) => {
    const isTitle = i === 0;
    const bullets = (Array.isArray(s?.bullets) ? s.bullets : []).filter(Boolean);
    return `<section class="slide${isTitle ? ' title-slide' : ''}"${i > 0 ? ' hidden' : ''}>
  ${isTitle ? `<p class="kicker">${esc(title)}</p>` : ''}
  <${isTitle ? 'h1' : 'h2'}>${esc(s?.title || (isTitle ? title : `Slide ${i + 1}`))}</${isTitle ? 'h1' : 'h2'}>
  ${bullets.length ? `<ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
  ${s?.notes ? `<div class="notes"><strong>Teacher note:</strong> ${esc(s.notes)}</div>` : ''}
</section>`;
  }).join('\n');

  // NOTE: the inline <style> and <script> below reference nothing outside
  // this document — no fonts, no CDNs, no http(s) URLs — so the deck works
  // offline and passes the no-external-resources rule.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background: ${bg}; color: ${ink};
    overflow: hidden; cursor: default;
  }
  .slide {
    height: 100vh; padding: 6vh 8vw;
    display: flex; flex-direction: column; justify-content: center; gap: 3vh;
  }
  .slide[hidden] { display: none; }
  .kicker {
    font-size: clamp(0.8rem, 1.6vw, 1.1rem); font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase; color: ${accent};
    opacity: 0.9;
  }
  h1 { font-size: clamp(2rem, 6vw, 4.2rem); line-height: 1.08; }
  h2 { font-size: clamp(1.5rem, 4.4vw, 3rem); line-height: 1.12; }
  .title-slide h1 { color: ${ink}; }
  h2 { border-left: 10px solid ${accent}; padding-left: 0.5em; }
  ul { list-style: none; display: flex; flex-direction: column; gap: 1.6vh; max-width: 60ch; }
  li {
    font-size: clamp(1.1rem, 2.6vw, 1.9rem); line-height: 1.4; padding-left: 1.2em;
    position: relative;
  }
  li::before { content: ""; position: absolute; left: 0; top: 0.55em; width: 0.45em; height: 0.45em; border-radius: 50%; background: ${accent}; }
  .notes { display: none; font-size: clamp(0.8rem, 1.4vw, 1rem); opacity: 0.75; border-top: 1px dashed ${accent}; padding-top: 1vh; max-width: 70ch; }
  body.show-notes .notes { display: block; }
  #deck-counter {
    position: fixed; right: 18px; bottom: 14px;
    font-variant-numeric: tabular-nums; font-size: 0.9rem; opacity: 0.65;
  }
  #deck-hint {
    position: fixed; left: 18px; bottom: 14px; font-size: 0.75rem; opacity: 0.45;
  }
  @media print {
    body { background: #fff; color: #111; overflow: visible; }
    .slide, .slide[hidden] { display: flex !important; height: auto; min-height: 92vh; page-break-after: always; break-after: page; }
    .title-slide h1, h1, h2, li { color: #111; }
    .notes { display: block !important; color: #444; }
    #deck-counter, #deck-hint { display: none !important; }
  }
</style>
</head>
<body>
${slideHTML}
<div id="deck-counter">1 / ${total}</div>
<div id="deck-hint">&#8592; &#8594; / click / swipe &middot; N = notes &middot; print = PDF</div>
<script>
(function () {
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var counter = document.getElementById('deck-counter');
  var i = 0;
  function show(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, j) { if (j === i) { s.removeAttribute('hidden'); } else { s.setAttribute('hidden', ''); } });
    if (counter) counter.textContent = (i + 1) + ' / ' + slides.length;
  }
  function next() { show(i + 1); }
  function prev() { show(i - 1); }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { show(0); }
    else if (e.key === 'End') { show(slides.length - 1); }
    else if (e.key === 'n' || e.key === 'N') { document.body.classList.toggle('show-notes'); }
  });
  document.addEventListener('click', function (e) {
    if (e.clientX < window.innerWidth * 0.2) { prev(); } else { next(); }
  });
  var touchX = null;
  document.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX == null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 40) { if (dx < 0) { next(); } else { prev(); } }
  }, { passive: true });
  show(0);
})();
</script>
</body>
</html>`;
}

/* ══════════ Materials store (metadata: localStorage, payload: IDB) ══════════ */

function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch { return false; }
}

function materialId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** All saved deck metadata: [{id, lessonId, title, slideCount, createdAt}] */
export function listDeckMeta() {
  return readList(DECKS_KEY);
}

/** All saved audio-clip metadata: [{id, lessonId, title, style, createdAt}] */
export function listAudioMeta() {
  return readList(AUDIO_KEY);
}

/**
 * Persist a compiled deck: HTML into IDB 'media', metadata into
 * localStorage 'cocher_v6_2_decks'. Resolves the metadata entry, or null when
 * the payload could not be stored (metadata is only written after the
 * payload write succeeds, so lists never point at missing content).
 */
export async function saveDeckMaterial({ lessonId, title, html, slideCount } = {}) {
  if (typeof html !== 'string' || !html) return null;
  const meta = {
    id: materialId('deck'),
    lessonId: lessonId || null,
    title: String(title || 'Slide deck').slice(0, 140),
    slideCount: Number(slideCount) || 0,
    createdAt: Date.now()
  };
  const ok = await idbPut(MEDIA_STORE, meta.id, html);
  if (!ok) return null;
  writeList(DECKS_KEY, [...listDeckMeta(), meta]);
  return meta;
}

/**
 * Persist an audio clip: WAV Blob into IDB 'media', metadata into
 * localStorage 'cocher_v6_2_audio_clips'. Resolves the metadata entry or null.
 */
export async function saveAudioMaterial({ lessonId, title, style, blob } = {}) {
  if (!(blob instanceof Blob)) return null;
  const meta = {
    id: materialId('aud'),
    lessonId: lessonId || null,
    title: String(title || 'Audio clip').slice(0, 140),
    style: String(style || '').slice(0, 60),
    createdAt: Date.now()
  };
  const ok = await idbPut(MEDIA_STORE, meta.id, blob);
  if (!ok) return null;
  writeList(AUDIO_KEY, [...listAudioMeta(), meta]);
  return meta;
}

/** Raw payload for a material id: deck HTML string or audio Blob. */
export async function getMediaContent(id) {
  if (!id) return undefined;
  return idbGet(MEDIA_STORE, id);
}

/**
 * Open a stored deck in a new tab via a blob: URL (works fully offline —
 * the document is self-contained). Resolves true when opened, false when
 * the content is missing on this device.
 */
export async function openDeckById(id) {
  const html = await getMediaContent(id);
  if (typeof html !== 'string' || !html) return false;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank');
  // The new tab holds its own copy of the document once loaded; revoke
  // after a grace period so the URL doesn't pin the Blob forever.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}

/** Trigger a client-side download of a Blob (offline-safe). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
