/*
 * Co-Cher — Live session launcher (shared)
 * ========================================
 * One entry point that turns a deck MODEL into a running Live session,
 * used from the deck-preview flow, attached decks on a lesson, and Present's
 * "Go Live" — so the behaviour can never drift between them.
 *
 * Since v8.2 the session runs INSIDE Co-Cher: the deck is stashed
 * (sessionStorage, so a refresh keeps the same room) and the app navigates to
 * the fullscreen #/live presenter route in THIS tab. Its join screen shows
 * the QR + link + room code — students scan and land on #/join. Esc / "End
 * session" brings the teacher straight back to where they were.
 */

import { showToast } from './toast.js';
import { stashLiveSession } from '../utils/live-deck.js';
import { navigate } from '../router.js';

/**
 * Launch a Live session for a deck model (same-tab fullscreen).
 * @param {object} deck  the deck slide model ({title, slides:[…]})
 * @returns {boolean} true when the session was launched
 */
export function openLiveSession(deck) {
  if (!deck || !Array.isArray(deck.slides)) {
    showToast('This deck can’t be run live — no slide data was stored.', 'danger');
    return false;
  }
  const room = stashLiveSession(deck);
  if (!room) {
    showToast('Could not stage the live session — browser storage unavailable.', 'danger');
    return false;
  }
  navigate('/live');
  return true;
}
