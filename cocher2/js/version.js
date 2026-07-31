/*
 * Co-Cher 2 — Version
 * ===================
 * Single source of truth for the app version shown in the UI.
 *
 * This is the START OF A NEW LINE. Co-Cher 1 (v8.9) continues to live at
 * `app/cocher.html` and is FROZEN — existing teachers keep using it, undisturbed,
 * on their existing data. Co-Cher 2 is where the multi-school shift happens:
 * per-school timetables, rosters, calendars and frameworks, so a teacher from
 * any school can use it.
 *
 * The two versions are deliberately isolated (same origin, so this matters):
 *   · localStorage/sessionStorage keys are prefixed `cocher2_` (v1 uses `cocher_`)
 *   · IndexedDB database is `cocher2` (v1 uses `cocher`)
 *   · the service worker caches under `cocher2-<VERSION>` with its own scope
 * Nothing written here can reach v1's data, and vice versa. Teachers move their
 * work across with Settings → Data → Export, then Import on this side.
 *
 * Bump alongside `sw.js` VERSION (the cache name derives from it).
 */

export const APP_VERSION = 'v1.1';

/* The previous line, still live for existing users. */
export const PREVIOUS_VERSIONS = [
  { version: 'Co-Cher 1 (v8.9)', url: '../app/cocher.html' },
];
