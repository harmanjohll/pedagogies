/*
 * Co-Cher — Live Session routes (#/live presenter · #/join student)
 * =================================================================
 * Live runs INSIDE Co-Cher since v8.2 — same tab, fullscreen takeover:
 *
 *  - #/live       the presenter (projector). Reads the deck stashed by
 *                 openLiveSession() (sessionStorage, so a refresh keeps the
 *                 same room). Esc / "End session" returns to where the
 *                 teacher was.
 *  - #/join(/:room) the student surface. The QR on the projector encodes
 *                 this route; ?room-less visits get a room-code landing.
 *                 Students are NOT teachers: app.js boots this route
 *                 directly, before (and without) the login/onboarding flow.
 *
 * mqtt.js + qrcode.js are loaded on demand from the hosted live/ folder —
 * only these routes ever pay for them. If mqtt can't load (no network), the
 * engine still runs same-device over BroadcastChannel and shows "no network".
 */

import { mountLive, loadScriptOnce } from '../utils/live-engine.js';
import { liveSlidesFromDeck, readLiveSession, clearLiveSession } from '../utils/live-deck.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';

/* …/pedagogies/live/ regardless of which page we're on. */
const liveAssetBase = () => new URL('../live/', location.href).href;
/* The student join link: this very app, #/join/<ROOM>. The QR encodes the
 * direct cocher.html URL; the on-screen TYPABLE fallback shows the short site
 * root (…/pedagogies/#/join), whose index.html forwards the hash into the app
 * — every character a student types must resolve. */
const joinHref = () => `${location.origin}${location.pathname}#/join/`;
const joinLabel = () => `${location.host}${location.pathname.replace(/app\/cocher\.html$/, '')}#/join`;

function goBack(fallback) {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback || '/lessons');
}

/** Presenter route (#/live): same-tab fullscreen, driven by the stash. */
export function renderLivePresent(container) {
  const stash = readLiveSession();
  if (!stash) {
    showToast('No live session is staged — hit “Go Live” on a deck first.', 'warning');
    navigate('/lessons');
    return;
  }
  container.innerHTML = '';
  let mounted = null;
  let cancelled = false;

  (async () => {
    // mqtt is required for cross-device sync; qrcode only draws the join QR.
    // Both are best-effort: the engine degrades (BroadcastChannel / text link).
    await Promise.allSettled([
      loadScriptOnce(liveAssetBase() + 'mqtt.min.js'),
      loadScriptOnce(liveAssetBase() + 'qrcode.min.js'),
    ]);
    if (cancelled) return;
    mounted = mountLive(container, {
      role: 'presenter',
      room: stash.room,
      slides: liveSlidesFromDeck(stash.deck),
      joinHref: joinHref(),
      joinLabel: joinLabel(),
      // Clean exit invalidates the stash: back-button / bookmark can't
      // resurrect this room. (Refresh doesn't exit, so it keeps the room.)
      onExit: () => { clearLiveSession(); goBack('/lessons'); },
    });
  })();

  return () => { cancelled = true; if (mounted) mounted.destroy(); };
}

/** Student route (#/join/:room?). Also bootable standalone (no login). */
export function renderLiveJoin(container, params = {}) {
  // Accept the room from the route param or a ?room= query (the old hosted
  // live/join.html redirects here with either form).
  let room = params.room || '';
  if (!room) {
    const m = location.search.match(/[?&]room=([^&]+)/) || location.hash.match(/[?&]room=([^&]+)/);
    if (m) room = decodeURIComponent(m[1]);
  }
  container.innerHTML = '';
  let mounted = null;
  let cancelled = false;

  (async () => {
    await Promise.allSettled([loadScriptOnce(liveAssetBase() + 'mqtt.min.js')]);
    if (cancelled) return;
    mounted = mountLive(container, {
      role: 'audience',
      room,
      onExit: () => {
        // A student "Leave" reloads to the landing — simplest clean slate.
        location.hash = '#/join';
        location.reload();
      },
    });
  })();

  return () => { cancelled = true; if (mounted) mounted.destroy(); };
}
