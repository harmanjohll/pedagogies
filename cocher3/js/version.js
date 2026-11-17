/*
 * Co-Cher 3: the version the engine reports
 * =========================================
 * Co-Cher 3 keeps one number, in js/v3/version.js. This file hands it to the
 * engine's own screens (Settings, About), so they never show another.
 *
 * The three lines, each in its own folder and each frozen except this one:
 *   Co-Cher 1 (v8.9)  app/       its own saved data (keys `cocher_`, database `cocher`)
 *   Co-Cher 2 (v2.7)  cocher2/   frozen when Co-Cher 3 took its own copy of the engine
 *   Co-Cher 3         cocher3/   the main line
 *
 * Co-Cher 2 and 3 share saved work ON PURPOSE: both read and write the keys
 * prefixed `cocher2_` and the database `cocher2`, so a teacher finds the same
 * classes and lessons in either, and Co-Cher 2 stays a working fallback.
 * Because of that, change saved data here only by ADDING to it; a renamed or
 * reshaped field would break Co-Cher 2 for the same teacher. Teachers move
 * work from Co-Cher 1 with its Settings, Data, Export, then Import here.
 */

import { VERSION } from './v3/version.js';

export const APP_VERSION = 'v' + VERSION;

/* The earlier lines, still live. */
export const PREVIOUS_VERSIONS = [
  { version: 'Co-Cher 2 (v2.7, the same saved work)', url: '../cocher2/cocher2.html' },
  { version: 'Co-Cher 1 (v8.9, its own saved work)', url: '../app/cocher.html' },
];
