/*
 * Co-Cher — Live session launcher (shared)
 * ========================================
 * One entry point that turns a deck MODEL into a running Live session: it
 * compiles the presenter surface (with the QR-join screen baked in), opens it
 * in a new tab for the projector, and shows the teacher the join link + room
 * code. Used from the deck-preview flow (a freshly generated deck) AND from
 * attached decks on a lesson (the demo lessons' "Go Live"), so the behaviour
 * can never drift between the two.
 *
 * Sync is entirely client-side (MQTT room + BroadcastChannel fallback); nothing
 * is stored server-side. Students open the generic hosted page `live/join.html`.
 */

import { openModal } from './modals.js';
import { showToast } from './toast.js';
import { escapeHtml } from '../utils/markdown.js';
import { compileLivePresenterHTML, normRoom } from '../utils/live-deck.js';

const esc = escapeHtml;

/** Deterministic-ish room code from a deck title + a couple of digits. */
function roomForDeck(deck) {
  const stem = String(deck?.title || '').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'ROOM';
  return normRoom(stem + (10 + Math.floor(Math.random() * 90)));
}

/**
 * Launch a Live session for a deck model.
 * @param {object} deck  the deck slide model ({title, slides:[…]})
 * @returns {boolean} true when the presenter tab was opened
 */
export function openLiveSession(deck) {
  if (!deck || !Array.isArray(deck.slides)) {
    showToast('This deck can’t be run live — no slide data was stored.', 'danger');
    return false;
  }
  const base = new URL('../live/', location.href).href;          // → …/pedagogies/live/
  const joinUrl = base + 'join.html';
  const room = roomForDeck(deck);
  let html;
  try {
    html = compileLivePresenterHTML(deck, {
      room, joinUrl,
      mqttSrc: base + 'mqtt.min.js',
      qrSrc: base + 'qrcode.min.js',
    });
  } catch (e) {
    showToast('Could not build the live session: ' + e.message, 'danger');
    return false;
  }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const win = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);

  const { backdrop, close } = openModal({
    title: '&#9654; Live session started',
    width: 440,
    body: `
      <p style="font-size:0.875rem;line-height:1.6;color:var(--ink);margin-bottom:var(--sp-3);">The presenter opened in a new tab &mdash; put it on the projector. Students scan the on-screen <strong>QR code</strong> to join instantly, or type the room code.</p>
      <div style="background:var(--bg-subtle);border-radius:var(--radius-lg);padding:var(--sp-4);text-align:center;margin-bottom:var(--sp-3);">
        <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-faint);">Students join at</div>
        <div style="font-weight:700;word-break:break-all;margin:4px 0 10px;">${esc(joinUrl)}</div>
        <div style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-faint);">Room code</div>
        <div style="font-size:2rem;font-weight:800;letter-spacing:0.1em;color:var(--accent);">${esc(room)}</div>
      </div>
      <p style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Everything is live and in the moment &mdash; nothing is saved, so export the room&rsquo;s input from the presenter before closing it. A live session needs an internet connection${win ? '' : '. Your browser blocked the pop-up &mdash; allow pop-ups and try again'}.</p>`,
    footer: `<button class="btn btn-primary" data-action="ok">Got it</button>`
  });
  backdrop.querySelector('[data-action="ok"]').addEventListener('click', close);
  return !!win;
}
