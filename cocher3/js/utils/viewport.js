/*
 * Co-Cher Viewport Helper (v7)
 * ============================
 * Dependency-free predicates plus a change subscription for the two media
 * conditions the mobile UI cares about: is this a touch device, and is the
 * viewport narrow (<=768px, the app's mobile breakpoint).
 *
 * Pure module — no imports, no DOM writes. It only READS window.matchMedia, so
 * it is safe to import in SSR / test environments where window or matchMedia is
 * missing: every predicate returns false and onViewportChange becomes a no-op
 * that still hands back a (harmless) unsubscribe function.
 */

const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
const NARROW_QUERY = '(max-width: 768px)';

/**
 * Resolve a MediaQueryList, or null when matchMedia is unavailable.
 * @param {string} query
 * @returns {MediaQueryList|null}
 */
function mql(query) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(query);
  } catch (_) {
    return null;
  }
}

/**
 * True on a genuine touch device (coarse pointer, no hover) — the same signal
 * the CSS touch primitives are gated on. Guarded for SSR/no-matchMedia (false).
 * @returns {boolean}
 */
export function isTouch() {
  const m = mql(TOUCH_QUERY);
  return m ? m.matches : false;
}

/**
 * True when the viewport is narrow (<=768px), matching the app's mobile
 * breakpoint. Guarded for SSR/no-matchMedia (false).
 * @returns {boolean}
 */
export function isNarrow() {
  const m = mql(NARROW_QUERY);
  return m ? m.matches : false;
}

/**
 * Subscribe to changes of EITHER the touch or the narrow media condition. The
 * callback receives a snapshot `{ isTouch, isNarrow }` on every change. It is
 * NOT invoked immediately — read isTouch()/isNarrow() yourself for the initial
 * state. Returns an unsubscribe function that is always safe to call
 * (idempotent, and a harmless no-op when matchMedia is unavailable).
 *
 * @param {(state: { isTouch: boolean, isNarrow: boolean }) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onViewportChange(cb) {
  if (typeof cb !== 'function') return () => {};

  const lists = [mql(TOUCH_QUERY), mql(NARROW_QUERY)].filter(Boolean);
  if (lists.length === 0) return () => {};

  const handler = () => {
    cb({ isTouch: isTouch(), isNarrow: isNarrow() });
  };

  lists.forEach((m) => {
    if (typeof m.addEventListener === 'function') m.addEventListener('change', handler);
    else if (typeof m.addListener === 'function') m.addListener(handler); // Safari <14 / legacy
  });

  let active = true;
  return function unsubscribe() {
    if (!active) return;
    active = false;
    lists.forEach((m) => {
      if (typeof m.removeEventListener === 'function') m.removeEventListener('change', handler);
      else if (typeof m.removeListener === 'function') m.removeListener(handler);
    });
  };
}
