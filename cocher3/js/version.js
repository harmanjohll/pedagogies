/*
 * Co-Cher 3: version
 * ==================
 * Co-Cher 3 has its own number, apart from Co-Cher 2's. Three parts:
 * product . release . fix. Raise it with every change to cocher3/, and add a
 * note at the top of NOTES when teachers should hear about it.
 * Co-Cher 2's version (cocher2/js/version.js) moves only when the shared
 * engine or Co-Cher 2 itself changes.
 */

export const VERSION = '3.2.2';

/* Newest first. Shown once to a returning teacher, in Co-Cher 3 only. */
export const NOTES = [
  { version: '3.2.0', items: [
    ['Common free time', 'In Admin: pick colleagues and see when you are all free this week or next. Add the slot as an entry.'],
    ['Student handover', 'In Classes: send a colleague your evidence on a class as a file. Theirs joins yours on the same student, with nothing doubled.'],
    ['Term goals', 'On Term: set two or three goals, link your entries to them, and watch them move.'],
    ['Its own address', 'Co-Cher 3 now lives at /pedagogies/cocher3/. Old links still work.'],
  ] },
];
