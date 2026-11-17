/*
 * App Embed
 * =========
 * Shows one of the apps kept in the genapp repo (Pathways, the E21CC Log)
 * inside Co-Cher, in a frame. The embed is live: every push to genapp shows
 * up here within minutes, with nothing to copy or sync.
 *
 * Rules (see HANDOVER.md, section 3):
 *   - Root-relative addresses (/genapp/...), so the app stays on the same web
 *     address as Co-Cher and the admin overlay never sends it to a new tab.
 *   - Co-Cher never reads or writes the embedded app's storage (paths6.*,
 *     e21cclog*). The app owns its own data.
 *   - A frame that fails to load shows a plain message, never a blank box.
 */

import { escapeHtml } from '../utils/markdown.js';

export const GENAPP = '/genapp';

const LOAD_TIMEOUT_MS = 15000;

function injectStyles() {
  if (document.getElementById('ae-styles')) return;
  const style = document.createElement('style');
  style.id = 'ae-styles';
  style.textContent = `
    .ae-wrap { display:flex; flex-direction:column; gap:8px; }
    .ae-bar { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; flex-wrap:wrap; }
    .ae-title { font-weight:700; font-size:0.9375rem; color:var(--ink); }
    .ae-note { display:block; font-weight:400; font-size:0.8125rem; color:var(--ink-secondary, #666); margin-top:2px; line-height:1.5; }
    .ae-actions { display:flex; gap:6px; flex-shrink:0; }
    .ae-stage { position:relative; height:max(560px, calc(100vh - 260px)); border:1px solid var(--border, #e5e7eb); border-radius:12px; overflow:hidden; background:var(--bg-card, #fff); }
    .ae-frame { position:absolute; inset:0; width:100%; height:100%; border:0; opacity:0; transition:opacity 0.2s ease; background:#fff; }
    .ae-frame.ready { opacity:1; }
    .ae-status { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:24px; text-align:center; color:var(--ink-secondary, #666); font-size:0.875rem; line-height:1.5; }
    .ae-status strong { color:var(--ink); font-size:0.9375rem; }
    .ae-status .ae-fail-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; }
    @media (max-width:600px) { .ae-stage { height:max(480px, calc(100vh - 220px)); } }
  `;
  document.head.appendChild(style);
}

/**
 * Mount a live embed of `src` into `host`. Returns a cleanup function.
 * @param {HTMLElement} host
 * @param {{ src: string, title: string, note?: string }} opts
 */
export function mountEmbed(host, opts) {
  const { src, title, note = '' } = opts;
  injectStyles();
  const fullUrl = new URL(src, location.href).href;

  host.innerHTML = `
    <div class="ae-wrap">
      <div class="ae-bar">
        <div class="ae-title">${escapeHtml(title)}${note ? `<span class="ae-note">${escapeHtml(note)}</span>` : ''}</div>
        <div class="ae-actions">
          <button type="button" class="btn btn-sm btn-ghost ae-reload" title="Load the latest version">Reload</button>
          <button type="button" class="btn btn-sm btn-primary ae-open" title="Open in a new tab">Open full screen</button>
        </div>
      </div>
      <div class="ae-stage">
        <div class="ae-status" role="status">Opening ${escapeHtml(title)}&hellip;</div>
        <iframe class="ae-frame" title="${escapeHtml(title)}" src="${escapeHtml(src)}"
                allow="clipboard-write; fullscreen; web-share"></iframe>
      </div>
    </div>`;

  const frame = host.querySelector('.ae-frame');
  const status = host.querySelector('.ae-status');
  let settled = false;
  let timer = null;

  const ok = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    frame.classList.add('ready');
    status.remove();
  };

  const fail = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    frame.remove();
    const offline = navigator.onLine === false;
    status.innerHTML = `
      <strong>${escapeHtml(title)} could not open here.</strong>
      <span>${offline
        ? 'This device looks offline. Connect, then try again.'
        : 'It may be offline or moved, or this copy of Co-Cher cannot reach it.'}</span>
      <span class="ae-fail-actions">
        <button type="button" class="btn btn-sm btn-ghost ae-retry">Try again</button>
        <a class="btn btn-sm btn-primary" href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener">Open in a new tab</a>
      </span>`;
    status.querySelector('.ae-retry').addEventListener('click', () => mountEmbed(host, opts));
  };

  frame.addEventListener('load', () => {
    // Same web address, so the document is readable. A browser error page is
    // not, which throws; a 404 page says so in its title.
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.body) return fail();
      if (/not found|error response|\b404\b/i.test(doc.title || '')) return fail();
      ok();
    } catch {
      fail();
    }
  });

  timer = setTimeout(fail, LOAD_TIMEOUT_MS);

  // A definite 404 answers faster than the frame does. Offline, the fetch
  // throws and the frame decides (the app's own offline copy may still open).
  fetch(src, { method: 'HEAD', cache: 'no-store' })
    .then(r => { if (r.status === 404) fail(); })
    .catch(() => {});

  host.querySelector('.ae-reload').addEventListener('click', () => mountEmbed(host, opts));
  host.querySelector('.ae-open').addEventListener('click', () => window.open(fullUrl, '_blank', 'noopener'));

  return () => clearTimeout(timer);
}
