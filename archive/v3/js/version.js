/*
 * Co-Cher Version
 * ===============
 * Single source of truth for the app version shown in the UI.
 * Bump when a version is frozen into archive/ — see VERSIONS.md for the
 * lineage and the freeze procedure (storage keys must be namespaced).
 */

export const APP_VERSION = 'v3';

/* Relative to app/cocher.html */
export const PREVIOUS_VERSIONS = [
  { version: 'v2', url: '../archive/v2/cocher.html' },
  { version: 'v1', url: '../archive/cocher-v1.html' },
];
