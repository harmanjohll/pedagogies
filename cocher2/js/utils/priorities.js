/*
 * Co-Cher — Teaching focus areas (pedagogical priorities)
 * =======================================================
 * The focus areas a teacher chooses to work on for the year. Picked at
 * onboarding, editable any time in Settings, and injected into every
 * lesson-design conversation so Co-Cher shapes its suggestions to give the
 * teacher deliberate practice in the areas they care about — a quiet,
 * always-on upskilling loop.
 *
 * Stored at `Store.get('pedagogicalPriorities')` as an array of strings: preset
 * ids from PEDAGOGICAL_PRIORITIES below, plus any free-text areas the teacher
 * adds themselves. `priorityLabel()` resolves an id to its human label and
 * passes custom strings straight through, so the whole app can treat the list
 * uniformly.
 */

export const PEDAGOGICAL_PRIORITIES = [
  { id: 'differentiation', label: 'Differentiation', icon: '&#9879;' },
  { id: 'assessment', label: 'Assessment for Learning', icon: '&#9733;' },
  { id: 'engagement', label: 'Student Engagement', icon: '&#9829;' },
  { id: 'e21cc', label: 'E21CC Development', icon: '&#9883;' },
  { id: 'edtech', label: 'EdTech Integration', icon: '&#9000;' },
  { id: 'inquiry', label: 'Inquiry-Based Learning', icon: '?' },
  { id: 'collaborative', label: 'Collaborative Learning', icon: '&#9733;' },
  { id: 'sel', label: 'SEL & Well-being', icon: '&#9786;' },
  { id: 'cce', label: 'CCE & Values', icon: '&#9825;' },
  { id: 'direct', label: 'Direct Instruction', icon: '&#9654;' },
];

const LABEL_BY_ID = Object.fromEntries(PEDAGOGICAL_PRIORITIES.map(p => [p.id, p.label]));

/** Human label for a stored priority — preset id → label, custom string → itself. */
export function priorityLabel(idOrText) {
  return LABEL_BY_ID[idOrText] || String(idOrText || '').trim();
}

/** True when this stored value is one of the presets (vs a custom free-text area). */
export function isPresetPriority(idOrText) {
  return Object.prototype.hasOwnProperty.call(LABEL_BY_ID, idOrText);
}

/** The teacher's saved focus areas as a clean string[] (never null). */
export function getPriorities(Store) {
  const raw = Store.get('pedagogicalPriorities');
  return Array.isArray(raw) ? raw.filter(x => typeof x === 'string' && x.trim()) : [];
}
