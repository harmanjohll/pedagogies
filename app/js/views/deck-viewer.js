/*
 * Co-Cher — In-app Deck Viewer (#/deck/:id)
 * =========================================
 * Shows a stored slide deck INSIDE Co-Cher instead of a blob: tab. This is
 * load-bearing, not cosmetic: blob documents send no Referer, and YouTube's
 * embedded player refuses to play without one ("Error 153 — video player
 * configuration error"), so slide videos silently failed. Served from the
 * app's real URL, the embeds get a proper referrer and load normally.
 *
 * The compiled deck document (self-contained HTML from compileDeckHTML) runs
 * in an iframe via srcdoc. Its own Exit button/Esc posts
 * {type:'cocher-deck-exit'} to us (see exitDeck in deck.js) and we navigate
 * back. A slim app top bar carries a Close button as the always-visible way
 * out.
 */

import { getMediaContent, listDeckMeta } from '../utils/deck.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/markdown.js';

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/lessons';
}

export function renderDeckViewer(container, params) {
  const id = params?.id || '';
  const meta = listDeckMeta().find(m => m.id === id) || null;

  container.innerHTML = `
    <div id="deck-viewer" style="position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:#0b0d1a;">
      <div style="display:flex;align-items:center;gap:12px;padding:6px 14px;background:#12122a;color:#fff;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span style="font-weight:600;font-size:0.9375rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(meta?.title || 'Slide deck')}</span>
        <button id="deck-viewer-close" class="btn btn-sm" style="background:none;border:1px solid rgba(255,255,255,0.25);color:#fff;cursor:pointer;padding:4px 12px;border-radius:8px;font-size:0.8125rem;">&times; Close</button>
      </div>
      <iframe id="deck-viewer-frame" title="${escapeHtml(meta?.title || 'Slide deck')}"
        style="flex:1;min-height:0;border:none;width:100%;background:#fff;"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
    </div>`;

  const frame = container.querySelector('#deck-viewer-frame');
  container.querySelector('#deck-viewer-close').addEventListener('click', goBack);

  // The deck's own Exit/Esc inside the iframe asks us to close it.
  const onMsg = (e) => { if (e?.data?.type === 'cocher-deck-exit') goBack(); };
  window.addEventListener('message', onMsg);

  (async () => {
    const html = await getMediaContent(id);
    if (typeof html !== 'string' || !html) {
      showToast('Deck content not found on this device.', 'danger');
      goBack();
      return;
    }
    frame.srcdoc = html;
  })();

  // Router cleanup: drop the message listener when navigating away.
  return () => { window.removeEventListener('message', onMsg); };
}
