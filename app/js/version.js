/*
 * Co-Cher Version
 * ===============
 * Single source of truth for the app version shown in the UI.
 * Bump when a version is frozen into archive/ — see VERSIONS.md for the
 * lineage and the freeze procedure (storage keys must be namespaced).
 */

export const APP_VERSION = 'v8.2';

/* Relative to app/cocher.html */
export const PREVIOUS_VERSIONS = [
  { version: 'v7', url: '../archive/v7/cocher.html' },
  { version: 'v6.2', url: '../archive/v6.2/cocher.html' },
  { version: 'v6.1', url: '../archive/v6.1/cocher.html' },
  { version: 'v6', url: '../archive/v6/cocher.html' },
  { version: 'v5.1', url: '../archive/v5.1/cocher.html' },
  { version: 'v4.1', url: '../archive/v4.1/cocher.html' },
  { version: 'v4', url: '../archive/v4/cocher.html' },
  { version: 'v3', url: '../archive/v3/cocher.html' },
  { version: 'v2', url: '../archive/v2/cocher.html' },
  { version: 'v1', url: '../archive/cocher-v1.html' },
];
