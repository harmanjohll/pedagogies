/*
 * Co-Cher — Live Session data layer
 * =================================
 * The pure, DOM-free half of Live Sessions: turning a slide deck MODEL into
 * the live slide list (join → confidence poll → deck slides with their
 * quiz/poll/wall interactions → word-wall → closing poll → personal command
 * card), room-code normalisation, and the sessionStorage stash the launcher
 * uses to hand a deck to the in-app presenter route (#/live).
 *
 * The runtime engine (rendering, MQTT + BroadcastChannel bus, QR) lives in
 * live-engine.js and runs INSIDE Co-Cher as the #/live (presenter) and
 * #/join (student) routes since v8.2 — no more compiled standalone blob
 * documents. The standalone demo live/acids-live.html keeps its own copy.
 */

export const DEFAULT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';

/** Normalise a room code the same way on presenter and phone. */
export function normRoom(s) {
  return String(s || '').replace(/[\s-]+/g, '').toUpperCase().slice(0, 12) || 'ROOM';
}

/* ── Build the live slide list from a normal deck ──
 * join → confidence poll (in) → deck slides (watch, or an interaction the deck
 * declares) → word-wall → confidence poll (out) → command card. */
export function liveSlidesFromDeck(deck) {
  const src = Array.isArray(deck?.slides) ? deck.slides : [];
  const out = [];
  out.push({ mode: 'join' });
  out.push({ mode: 'poll', id: 'confIn', q: 'Before we start — how sure are you about today’s topic?', low: 'Not yet', high: 'Very sure' });

  const quizzes = [];
  src.forEach((s, i) => {
    const it = s.interaction;
    if (it && it.type === 'quiz' && Array.isArray(it.options) && it.options.length >= 2) {
      const id = 'q' + i;
      out.push({ mode: 'quiz', id, q: it.q || s.title || 'Predict', options: it.options.slice(0, 4), answer: Math.max(0, Math.min(it.options.length - 1, it.answer | 0)), why: it.why || '' });
      quizzes.push({ id, label: it.label || it.q || s.title || 'Question', answer: out[out.length - 1].answer });
    } else if (it && it.type === 'poll') {
      out.push({ mode: 'poll', id: 'p' + i, q: it.q || s.title || 'Your view', low: it.low || 'Low', high: it.high || 'High' });
    } else if (it && it.type === 'wall') {
      out.push({ mode: 'wall', id: 'w' + i, q: it.q || s.title || 'Your answer', placeholder: it.placeholder || '' });
    } else {
      out.push(watchFromSlide(s));
    }
  });

  out.push({ mode: 'wall', id: 'wall', q: deck?.wallPrompt || 'One thing you’re taking away from today?', placeholder: 'in a few words…' });
  out.push({ mode: 'poll', id: 'confOut', q: 'And now — how sure are you?', low: 'Not yet', high: 'Very sure' });
  out.push({
    mode: 'card',
    title: deck?.title || 'Today’s learning',
    frames: (deck?.cardFrames && deck.cardFrames.length ? deck.cardFrames : deriveFrames(deck)).slice(0, 4),
    quizzes, pollIn: 'confIn', pollOut: 'confOut', wallId: 'wall',
  });
  return out;
}

function watchFromSlide(s) {
  const bullets = (Array.isArray(s.bullets) ? s.bullets : []).filter(Boolean).slice(0, 6);
  return {
    mode: 'watch',
    kicker: s.kicker || (s.layout === 'section' ? 'Section' : ''),
    title: s.title || s.statement || '',
    statement: s.statement || '',
    quote: s.quote || '', attribution: s.attribution || '',
    subtitle: s.subtitle || '',
    bullets,
  };
}

/* A few "keep these" frames if the deck doesn't supply its own. */
function deriveFrames(deck) {
  const frames = [];
  const src = Array.isArray(deck?.slides) ? deck.slides : [];
  src.forEach(s => {
    if (frames.length >= 4) return;
    if (s.statement) frames.push(String(s.statement).slice(0, 90));
    else if (s.layout === 'exit' && Array.isArray(s.bullets) && s.bullets[0]) frames.push(String(s.bullets[0]).slice(0, 90));
  });
  if (!frames.length && deck?.title) frames.push(String(deck.title).slice(0, 90));
  return frames;
}

/* ── Presenter-route handoff stash ──
 * openLiveSession() stashes the deck + a room code here and navigates to
 * #/live; the route reads it back. sessionStorage (not a router param) so a
 * mid-lesson REFRESH of the presenter keeps the SAME room — phones stay in. */
const LIVE_STASH_KEY = 'cocher_live_session';

export function stashLiveSession(deck) {
  const stem = String(deck?.title || '').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'ROOM';
  const room = normRoom(stem + (10 + Math.floor(Math.random() * 90)));
  try { sessionStorage.setItem(LIVE_STASH_KEY, JSON.stringify({ deck, room })); } catch { return null; }
  return room;
}

export function readLiveSession() {
  try {
    const raw = sessionStorage.getItem(LIVE_STASH_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return (parsed && parsed.deck && Array.isArray(parsed.deck.slides)) ? parsed : null;
  } catch { return null; }
}
