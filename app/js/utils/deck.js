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
 * ('cocher_decks' / 'cocher_audio_clips'); the bulky payloads (deck HTML
 * strings, audio WAV Blobs) live in the IndexedDB 'media' store keyed by
 * material id. attachedResources entries {type:'deck'|'audio', id, title}
 * point at those ids.
 */

import { idbPut, idbGet, idbRemove } from './storage.js';

const DECKS_KEY = 'cocher_decks';
const AUDIO_KEY = 'cocher_audio_clips';
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

/* ── Inline SVG icon set (offline, currentColor-stroked) ── */
const DECK_ICONS = {
  idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  warning: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>',
  group: '<circle cx="8" cy="9" r="3"/><path d="M2.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.5a3 3 0 0 1 0 5.8M17 19a5.5 5.5 0 0 0-2-4.3"/>',
  experiment: '<path d="M9 3h6M10 3v6l-4.5 8A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-3L14 9V3"/><path d="M7.5 15h9"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2V5Z"/><path d="M20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2V5Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/>',
  chart: '<path d="M4 20V4M4 20h16"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="5" width="3" height="12"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  rocket: '<path d="M5 15c-1 2-1 4-1 4s2 0 4-1M9 15l-3-3a9 9 0 0 1 9-9c2 0 3 1 3 3a9 9 0 0 1-9 9l-3-3Z"/><circle cx="14.5" cy="8.5" r="1.3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/>',
};
function svgIcon(key, cls = 'deck-ic') {
  const p = DECK_ICONS[key];
  if (!p) return '';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

/* ── Inline SVG chart (offline) — bar | line | donut from {label,value} data ── */
function svgChart(chart, pal) {
  const type = (chart && chart.type) || 'bar';
  const rows = (chart && Array.isArray(chart.data) ? chart.data : [])
    .filter(d => d && d.label != null && isFinite(Number(d.value)))
    .slice(0, 8).map(d => ({ label: String(d.label), value: Number(d.value) }));
  if (!rows.length) return '';
  const colors = [pal.accent, pal.accent2, '#0ea5e9', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];
  const W = 920, H = 500, P = 64, txt = pal.muted, line = pal.line;
  const fmt = v => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : String(v));

  if (type === 'donut') {
    const sum = rows.reduce((a, d) => a + Math.max(0, d.value), 0) || 1;
    const cx = 300, cy = H / 2, r = 150, sw = 54, C = 2 * Math.PI * r;
    let acc = 0;
    const segs = rows.map((d, i) => {
      const frac = Math.max(0, d.value) / sum, dash = frac * C;
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${(C - dash).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      acc += dash; return el;
    }).join('');
    const legend = rows.map((d, i) => {
      const y = cy - (rows.length * 34) / 2 + i * 34 + 12;
      const pct = Math.round((Math.max(0, d.value) / sum) * 100);
      return `<rect x="560" y="${y - 12}" width="16" height="16" rx="4" fill="${colors[i % colors.length]}"/>` +
        `<text x="586" y="${y}" font-size="22" fill="${pal.ink}" dominant-baseline="middle">${esc(d.label)} — ${pct}%</text>`;
    }).join('');
    return `<svg class="deck-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">` +
      segs + `<circle cx="${cx}" cy="${cy}" r="${r - sw / 2 - 2}" fill="${pal.bg}"/>` + legend + `</svg>`;
  }

  const max = Math.max(...rows.map(d => d.value), 0) || 1;
  const x0 = P + 30, x1 = W - P, y0 = H - P, y1 = P;
  const plotW = x1 - x0, plotH = y0 - y1;
  const grid = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const y = y0 - t * plotH;
    return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${line}" stroke-width="1"/>` +
      `<text x="${x0 - 12}" y="${y + 6}" font-size="18" fill="${txt}" text-anchor="end">${fmt(Math.round(max * t))}</text>`;
  }).join('');
  const n = rows.length;

  if (type === 'line') {
    const step = n > 1 ? plotW / (n - 1) : 0;
    const pts = rows.map((d, i) => [x0 + i * step, y0 - (d.value / max) * plotH]);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = `M ${x0} ${y0} ` + pts.map(p => 'L ' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ` L ${x0 + (n - 1) * step} ${y0} Z`;
    const dots = pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6" fill="${pal.accent}"/>` +
      `<text x="${p[0].toFixed(1)}" y="${(p[1] - 16).toFixed(1)}" font-size="18" fill="${pal.ink}" text-anchor="middle" font-weight="700">${fmt(rows[i].value)}</text>`).join('');
    const labels = rows.map((d, i) => `<text x="${(x0 + i * step).toFixed(1)}" y="${y0 + 30}" font-size="18" fill="${txt}" text-anchor="middle">${esc(d.label)}</text>`).join('');
    return `<svg class="deck-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">` +
      grid + `<path d="${area}" fill="${pal.accent}" opacity="0.12"/>` +
      `<path d="${path}" fill="none" stroke="${pal.accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
      dots + labels + `</svg>`;
  }

  // bar (default)
  const band = plotW / n, bw = Math.min(120, band * 0.6);
  const bars = rows.map((d, i) => {
    const h = (d.value / max) * plotH, x = x0 + i * band + (band - bw) / 2, y = y0 - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${colors[i % colors.length]}"/>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 12).toFixed(1)}" font-size="20" fill="${pal.ink}" text-anchor="middle" font-weight="700">${fmt(d.value)}</text>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${y0 + 30}" font-size="18" fill="${txt}" text-anchor="middle">${esc(d.label)}</text>`;
  }).join('');
  return `<svg class="deck-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">` +
    grid + `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="${txt}" stroke-width="2"/>` + bars + `</svg>`;
}

/* ── Embedded video/sim: normalise a YouTube URL or bare 11-char id to a
 * privacy-enhanced (nocookie) embed, and recover the canonical watch URL so a
 * slide can offer a "Watch on YouTube" fallback if the embed is blocked. ── */
function youtubeId(raw) {
  const s = String(raw ?? '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  // Path forms: youtu.be/ID, /embed/ID, /shorts/ID, /live/ID, /v/ID.
  let m = s.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/|youtu\.be\/)([\w-]{11})/);
  if (m) return m[1];
  // watch URL: v may be any query param position (e.g. ?list=…&v=ID).
  m = s.match(/[?&]v=([\w-]{11})/);
  return m ? m[1] : '';
}
/** → { src, watch } for an embeddable media object, or null. */
function embedSrcFor(media) {
  const raw = (media && (media.src || media.youtube || media.id)) || '';
  const id = youtubeId(raw);
  if (id) return { src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`, watch: `https://www.youtube.com/watch?v=${id}` };
  if (/^https?:\/\//.test(String(raw))) return { src: String(raw), watch: '' };
  return null;
}

/**
 * Compile a deck into ONE self-contained, professional HTML document.
 * deck: { title, slides: [{ layout?, title, subtitle?, bullets?, notes?, icon?,
 *   columns?, statement?, quote?, attribution?, chart?, image?(dataURI),
 *   svg?(string), media?({kind:'video'|'sim', src, title}), youtube?(id|url) }] }
 * options.theme: optional { accent, accent2, bg, ink } CSS color overrides.
 * Visuals are self-contained (data:/inline SVG) EXCEPT an embedded video/sim
 * (slide.media / slide.youtube), which is external and needs a connection —
 * those slides also render a "Watch on YouTube" link as a graceful fallback.
 */
export function compileDeckHTML(deck, { theme } = {}) {
  const safeColor = (v, fb) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim())) ? v.trim() : fb;
  const pal = {
    accent: safeColor(theme?.accent, '#4361ee'),
    accent2: safeColor(theme?.accent2, '#7c3aed'),
    bg: safeColor(theme?.bg, '#ffffff'),
    ink: safeColor(theme?.ink, '#0f172a'),
    muted: '#64748b', line: '#e2e8f0', surface: '#f1f5f9',
  };
  const title = String(deck?.title ?? 'Slide deck');
  const slides = Array.isArray(deck?.slides) ? deck.slides : [];
  const total = slides.length;
  const LAYOUTS = new Set(['title', 'section', 'bullets', 'columns', 'statement', 'quote', 'visual', 'exit']);

  // The best self-contained visual for a slide (image > diagram svg > chart),
  // or an external embed (video/sim), or ''.
  const visualHTML = (s) => {
    if (typeof s?.image === 'string' && /^data:image\//.test(s.image)) return `<img class="deck-img" src="${esc(s.image)}" alt="${esc(s.imageAlt || s.title || '')}">`;
    if (typeof s?.svg === 'string' && s.svg.includes('<svg')) return `<div class="deck-svg">${s.svg}</div>`;
    if (s?.chart) { const c = svgChart(s.chart, pal); if (c) return `<div class="deck-svg">${c}</div>`; }
    const mediaObj = s?.media || (s?.youtube ? { kind: 'video', src: s.youtube, title: s.title } : null);
    const embed = mediaObj ? embedSrcFor(mediaObj) : null;
    if (embed) {
      const link = embed.watch ? `<a class="deck-embed-link" href="${esc(embed.watch)}" target="_blank" rel="noopener">Watch on YouTube &#8599;</a>` : '';
      return `<div class="deck-embed-wrap"><iframe class="deck-embed" src="${esc(embed.src)}" title="${esc(mediaObj.title || 'Embedded video')}" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>${link}</div>`;
    }
    return '';
  };
  const listHTML = (arr, icon) => `<ul>${(arr || []).filter(Boolean).map(b => `<li>${icon ? svgIcon(icon, 'deck-bic') : ''}<span>${esc(b)}</span></li>`).join('')}</ul>`;

  const slideBody = (s, i) => {
    const layout = LAYOUTS.has(s?.layout) ? s.layout : (i === 0 ? 'title' : 'bullets');
    const heading = esc(s?.title || (i === 0 ? title : `Slide ${i + 1}`));
    const sub = s?.subtitle ? `<p class="sub">${esc(s.subtitle)}</p>` : '';
    const bullets = (Array.isArray(s?.bullets) ? s.bullets : []).filter(Boolean);
    const vis = visualHTML(s);
    const ico = s?.icon && DECK_ICONS[s.icon] ? `<span class="deck-head-ic">${svgIcon(s.icon)}</span>` : '';

    if (layout === 'title') {
      return `<div class="l-title"><p class="kicker">${esc(s?.kicker || title)}</p><h1>${heading}</h1>${sub}${bullets.length ? listHTML(bullets, s?.icon) : ''}</div>`;
    }
    if (layout === 'section') {
      return `<div class="l-section"><span class="l-num">${String(i + 1).padStart(2, '0')}</span><div>${ico}<h2>${heading}</h2>${sub}</div></div>`;
    }
    if (layout === 'statement') {
      return `<div class="l-statement">${ico}<p class="statement">${esc(s?.statement || s?.title || '')}</p>${sub}</div>`;
    }
    if (layout === 'quote') {
      return `<div class="l-quote"><blockquote>&ldquo;${esc(s?.quote || s?.title || '')}&rdquo;</blockquote>${s?.attribution ? `<cite>— ${esc(s.attribution)}</cite>` : ''}</div>`;
    }
    if (layout === 'columns') {
      const cols = (Array.isArray(s?.columns) ? s.columns : []).slice(0, 3);
      return `<div class="l-head">${ico}<h2>${heading}</h2></div>${sub}<div class="l-cols">${cols.map(c => `<div class="col"><h3>${esc(c?.heading || '')}</h3>${listHTML(c?.items, s?.icon)}</div>`).join('')}</div>`;
    }
    if (layout === 'exit') {
      return `<div class="l-exit"><p class="kicker">${esc(s?.kicker || 'Exit ticket')}</p><h2>${heading}</h2>${sub}${bullets.length ? listHTML(bullets) : ''}</div>`;
    }
    if (layout === 'visual' || (!bullets.length && vis)) {
      return `<div class="l-head">${ico}<h2>${heading}</h2></div>${sub}<div class="deck-visual solo">${vis}</div>`;
    }
    // bullets — split to two columns when a visual is present
    if (vis) {
      return `<div class="l-head">${ico}<h2>${heading}</h2></div>${sub}<div class="l-two"><div class="l-two-text">${listHTML(bullets, s?.icon)}</div><div class="deck-visual">${vis}</div></div>`;
    }
    return `<div class="l-head">${ico}<h2>${heading}</h2></div>${sub}${listHTML(bullets, s?.icon)}`;
  };

  const slideHTML = slides.map((s, i) => `<section class="slide l-${LAYOUTS.has(s?.layout) ? s.layout : (i === 0 ? 'title' : 'bullets')}"${i > 0 ? ' hidden' : ''}>
  <div class="slide-inner">${slideBody(s, i)}</div>
  ${s?.notes ? `<div class="notes"><strong>Teacher note:</strong> ${esc(s.notes)}</div>` : ''}
  <div class="slide-foot"><span>${esc(title)}</span><span>${i + 1} / ${total}</span></div>
</section>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --accent:${pal.accent}; --accent2:${pal.accent2}; --bg:${pal.bg}; --ink:${pal.ink}; --muted:${pal.muted}; --line:${pal.line}; --surface:${pal.surface}; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { height:100%; }
  body { font-family: system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; background:var(--bg); color:var(--ink); overflow:hidden; -webkit-font-smoothing:antialiased; }
  #deck-prog { position:fixed; top:0; left:0; height:4px; background:var(--accent); width:0; z-index:10; transition:width .3s ease; }
  .slide { position:fixed; inset:0; padding:7vh 8vw 9vh; display:flex; flex-direction:column; justify-content:center; opacity:0; transform:translateY(14px); transition:opacity .38s ease, transform .38s ease; }
  .slide.in { opacity:1; transform:none; }
  .slide[hidden] { display:none; }
  /* In-slide build: heading, bullets (staggered) and the visual rise in as the
     slide becomes active. Re-triggered each time a slide is shown. Motion-safe. */
  @keyframes deckRise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
  @media (prefers-reduced-motion: no-preference) {
    .slide.in .kicker, .slide.in h1, .slide.in h2, .slide.in h3, .slide.in .l-num,
    .slide.in .sub, .slide.in .statement, .slide.in blockquote, .slide.in cite {
      animation: deckRise .5s cubic-bezier(.22,.61,.36,1) both;
    }
    .slide.in .sub { animation-delay:.08s; }
    .slide.in li { animation: deckRise .5s cubic-bezier(.22,.61,.36,1) both; }
    .slide.in li:nth-child(1){ animation-delay:.12s; }
    .slide.in li:nth-child(2){ animation-delay:.20s; }
    .slide.in li:nth-child(3){ animation-delay:.28s; }
    .slide.in li:nth-child(4){ animation-delay:.36s; }
    .slide.in li:nth-child(5){ animation-delay:.44s; }
    .slide.in li:nth-child(6){ animation-delay:.52s; }
    .slide.in li:nth-child(7){ animation-delay:.60s; }
    .slide.in li:nth-child(8){ animation-delay:.68s; }
    .slide.in .deck-visual { animation: deckRise .6s cubic-bezier(.22,.61,.36,1) both; animation-delay:.2s; }
  }
  .slide-inner { flex:1; display:flex; flex-direction:column; justify-content:center; gap:2.6vh; min-height:0; }
  .kicker { font-size:clamp(.8rem,1.5vw,1.05rem); font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
  h1 { font-size:clamp(2.2rem,6vw,4.4rem); line-height:1.06; letter-spacing:-.01em; font-weight:800; }
  h2 { font-size:clamp(1.6rem,4.4vw,3rem); line-height:1.12; font-weight:800; letter-spacing:-.01em; }
  h3 { font-size:clamp(1.05rem,2.2vw,1.5rem); font-weight:800; color:var(--accent); margin-bottom:.6em; }
  .sub { font-size:clamp(1rem,2.2vw,1.6rem); color:var(--muted); font-weight:500; }
  .l-head { display:flex; align-items:center; gap:.5em; }
  .deck-head-ic { color:var(--accent); display:inline-flex; }
  .deck-head-ic svg { width:clamp(28px,4vw,54px); height:clamp(28px,4vw,54px); }
  ul { list-style:none; display:flex; flex-direction:column; gap:1.5vh; max-width:64ch; }
  li { font-size:clamp(1.05rem,2.5vw,1.85rem); line-height:1.4; display:flex; gap:.6em; align-items:flex-start; }
  li::before { content:""; flex:0 0 auto; width:.5em; height:.5em; border-radius:50%; background:var(--accent); margin-top:.62em; }
  li .deck-bic + span, li:has(.deck-bic) { }
  .deck-bic { width:1.15em; height:1.15em; color:var(--accent); flex:0 0 auto; margin-top:.15em; }
  li:has(.deck-bic)::before { display:none; }
  .l-title { display:flex; flex-direction:column; gap:2.4vh; }
  .l-title h1 { max-width:20ch; }
  .l-section { display:flex; align-items:center; gap:.7em; }
  .l-num { font-size:clamp(3rem,12vw,9rem); font-weight:800; color:var(--surface); line-height:.8; -webkit-text-stroke:2px var(--line); }
  .l-statement { display:flex; flex-direction:column; align-items:flex-start; gap:2vh; }
  .l-statement .statement { font-size:clamp(2rem,5.5vw,4rem); font-weight:800; line-height:1.1; max-width:22ch; letter-spacing:-.01em; }
  .l-statement .deck-head-ic, .l-statement > svg { color:var(--accent); }
  .l-quote blockquote { font-size:clamp(1.8rem,5vw,3.4rem); font-weight:700; line-height:1.2; max-width:24ch; border-left:8px solid var(--accent); padding-left:.5em; }
  .l-quote cite { display:block; margin-top:2.5vh; font-style:normal; color:var(--muted); font-size:clamp(1rem,2vw,1.4rem); font-weight:600; }
  .l-cols { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:3vw; }
  .l-cols .col { background:var(--surface); border-radius:16px; padding:3vh 2vw; }
  .l-cols .col ul { gap:1vh; } .l-cols .col li { font-size:clamp(.95rem,2vw,1.4rem); }
  .l-two { display:grid; grid-template-columns:1fr 1fr; gap:4vw; align-items:center; }
  .l-two-text ul { max-width:none; }
  .deck-visual { display:flex; align-items:center; justify-content:center; min-height:0; }
  .deck-visual.solo { flex:1; }
  .deck-svg { width:100%; }
  .deck-svg svg, .deck-chart { width:100%; height:auto; max-height:62vh; }
  .deck-img { max-width:100%; max-height:60vh; border-radius:16px; box-shadow:0 10px 40px rgba(2,6,23,.18); object-fit:contain; }
  .deck-visual.solo .deck-img { max-height:66vh; }
  .deck-embed-wrap { width:100%; display:flex; flex-direction:column; align-items:center; gap:1.2vh; }
  .deck-embed { width:100%; aspect-ratio:16/9; max-height:60vh; border:0; border-radius:16px; box-shadow:0 10px 40px rgba(2,6,23,.18); background:#000; }
  .deck-embed-link { font-size:clamp(.8rem,1.4vw,1rem); font-weight:700; color:var(--accent); text-decoration:none; border:1px solid var(--line); border-radius:999px; padding:.4em 1em; }
  .deck-embed-link:hover { border-color:var(--accent); }
  .l-exit { background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#fff; border-radius:22px; padding:6vh 6vw; }
  .l-exit .kicker, .l-exit h2 { color:#fff; }
  .l-exit li::before { background:#fff; } .l-exit .deck-bic { color:#fff; }
  .notes { display:none; font-size:clamp(.8rem,1.3vw,1rem); color:var(--muted); border-top:1px dashed var(--line); padding-top:1.2vh; margin-top:2vh; max-width:80ch; }
  body.show-notes .notes { display:block; }
  .slide-foot { position:absolute; left:8vw; right:8vw; bottom:3.2vh; display:flex; justify-content:space-between; font-size:.8rem; color:var(--muted); font-variant-numeric:tabular-nums; letter-spacing:.02em; }
  .l-exit ~ .slide-foot, .slide.l-exit .slide-foot { color:rgba(255,255,255,.85); }
  #deck-ctrl { position:fixed; right:16px; bottom:14px; display:flex; gap:8px; z-index:10; }
  #deck-ctrl button { font:inherit; font-size:.85rem; color:var(--muted); background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:4px 10px; cursor:pointer; }
  #deck-ctrl button:hover { color:var(--accent); border-color:var(--accent); }
  #deck-ctrl .deck-exit-btn { font-weight:700; }
  #deck-ctrl .deck-exit-btn:hover { color:#fff; background:#ef4444; border-color:#ef4444; }
  #deck-hint { position:fixed; left:16px; bottom:16px; font-size:.72rem; color:var(--muted); opacity:.6; z-index:10; }
  #deck-exit-hint { position:fixed; left:0; right:0; bottom:24px; margin:0 auto; width:max-content; max-width:90vw; display:none; background:var(--ink); color:#fff; font-size:.9rem; font-weight:600; padding:10px 18px; border-radius:999px; z-index:20; box-shadow:0 8px 30px rgba(2,6,23,.3); }
  @media (max-width:720px){
    .l-two,.l-section{grid-template-columns:1fr; display:flex; flex-direction:column;} .l-num{display:none;}
    /* Bigger touch targets for the controls, and hide the keyboard hint (irrelevant on a phone). */
    #deck-ctrl { bottom:10px; right:10px; gap:10px; }
    #deck-ctrl button { padding:10px 14px; font-size:.95rem; min-height:44px; }
    #deck-hint { display:none; }
  }
  @media print {
    body { overflow:visible; } #deck-prog,#deck-ctrl,#deck-hint,#deck-exit-hint { display:none !important; }
    .slide { position:relative; inset:auto; opacity:1 !important; transform:none !important; height:auto; min-height:96vh; padding:8vh 8vw; page-break-after:always; break-after:page; display:flex !important; }
    .slide[hidden]{ display:flex !important; } .notes { display:block !important; }
    .slide *, .slide li, .slide .deck-visual { animation:none !important; opacity:1 !important; transform:none !important; }
    .deck-embed-wrap, .deck-embed { display:none !important; }
  }
</style>
</head>
<body>
<div id="deck-prog"></div>
${slideHTML}
<div id="deck-ctrl">
  <button id="deck-notes" title="Toggle teacher notes (N)">Notes</button>
  <button id="deck-full" title="Fullscreen (F)">&#x26F6;</button>
  <button id="deck-exit" class="deck-exit-btn" title="Exit presentation (Esc)">&#10005; Exit</button>
</div>
<div id="deck-hint">&#8592; &#8594; / click / swipe &middot; N notes &middot; F full &middot; Esc exit &middot; print = PDF</div>
<div id="deck-exit-hint">Presentation ended — you can close this browser tab.</div>
<script>
(function () {
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var prog = document.getElementById('deck-prog');
  var i = 0;
  function show(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach(function (s, j) {
      if (j === i) { s.removeAttribute('hidden'); requestAnimationFrame(function(){ s.classList.add('in'); }); }
      else { s.classList.remove('in'); s.setAttribute('hidden', ''); }
    });
    if (prog) prog.style.width = ((i + 1) / slides.length * 100) + '%';
  }
  function next() { show(i + 1); } function prev() { show(i - 1); }
  function toggleFull(){ try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch(e){} }
  // Exit the presentation: leave fullscreen, then close the tab (decks open via
  // window.open, so close is permitted). If the browser blocks close, show a hint.
  function exitDeck(){
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e){}
    // window.close() only works for script-opened tabs (Co-Cher opens decks via
    // window.open). For a downloaded/double-clicked file it is a no-op, so only
    // attempt it when we can, and always surface the hint.
    var canClose = false;
    try { canClose = !!window.opener || window.history.length <= 1; } catch(e){}
    if (canClose) { try { window.close(); } catch(e){} }
    setTimeout(function(){ var h = document.getElementById('deck-exit-hint'); if (h) h.style.display = 'block'; }, 250);
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { show(0); } else if (e.key === 'End') { show(slides.length - 1); }
    else if (e.key === 'n' || e.key === 'N') { document.body.classList.toggle('show-notes'); }
    else if (e.key === 'f' || e.key === 'F') { toggleFull(); }
    // Esc leaves fullscreen first (native); a second Esc, when not fullscreen, exits.
    else if (e.key === 'Escape') { if (!document.fullscreenElement) exitDeck(); }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#deck-ctrl') || e.target.closest('a') || e.target.closest('iframe')) return;
    if (e.clientX < window.innerWidth * 0.2) { prev(); } else { next(); }
  });
  var nb = document.getElementById('deck-notes'); if (nb) nb.addEventListener('click', function(e){ e.stopPropagation(); document.body.classList.toggle('show-notes'); });
  var fb = document.getElementById('deck-full'); if (fb) fb.addEventListener('click', function(e){ e.stopPropagation(); toggleFull(); });
  var xb = document.getElementById('deck-exit'); if (xb) xb.addEventListener('click', function(e){ e.stopPropagation(); exitDeck(); });
  var tx = null;
  document.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) { if (tx == null) return; var dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); } }, { passive: true });
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
 * localStorage 'cocher_decks'. Resolves the metadata entry, or null when
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
 * localStorage 'cocher_audio_clips'. Resolves the metadata entry or null.
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

/** Delete a stored deck: its IndexedDB payload AND its cocher_decks metadata
 * row. Used when a deck is replaced (e.g. re-seeding an exemplar) so old blobs
 * and dead list rows don't accumulate. Best-effort on the IDB side. */
export async function deleteDeckMaterial(id) {
  if (!id) return;
  try { await idbRemove(MEDIA_STORE, id); } catch { /* best-effort */ }
  writeList(DECKS_KEY, listDeckMeta().filter(m => m.id !== id));
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
