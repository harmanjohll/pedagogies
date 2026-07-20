/*
 * Co-Cher Tracking Schema Registry
 * ================================
 * Single source of truth for student progress-tracking schemas. Every reader
 * (views, portrait, report-comments) imports the presets + accessors from here
 * so that field labels, level keys AND colours are centralised — readers stop
 * hardcoding hex values.
 *
 * PURE module: NO import from state.js (would create a circular dependency).
 * Store-derived data (teacher-level custom schemas) is passed in as an argument.
 *
 * Data model
 * ----------
 * E21CC (the default) continues to store levels in `student.e21cc` +
 * `student.e21ccHistory` — byte-for-byte unchanged. Every OTHER schema stores
 * values in a parallel `student.tracked` map + `student.trackedHistory`.
 *
 * Field shape: { key, label, type:'scale'|'band'|'rag'|'number'|'text',
 *                levels?: [{ key, label, color, value }] }
 * Schema shape: { id, name, fields: [field, ...] }
 */

/* ── Level sets (colour is centralised here) ── */

// Mirrors state.js E21CC_LEVEL_KEYS + the level colours used by views/classes.js
// and views/report-comments.js (E21CC_LEVELS). Keep in sync with those.
const E21CC_LEVELS = [
  { key: 'developing', label: 'Developing', color: '#f59e0b', value: 1 },
  { key: 'applying',   label: 'Applying',   color: '#3b82f6', value: 2 },
  { key: 'extending',  label: 'Extending',  color: '#10b981', value: 3 },
  { key: 'leading',    label: 'Leading',    color: '#8b5cf6', value: 4 }
];

// Mirrors state.js E21CC_DIM_LABELS / E21CC_DIM_KEYS exactly.
const E21CC_DIM_LABELS = {
  criticalThinking: 'Critical Thinking',
  creativeThinking: 'Creative Thinking',
  communication: 'Communication',
  collaboration: 'Collaboration',
  socialConnectedness: 'Social Connectedness',
  selfRegulation: 'Self-Regulation'
};
const E21CC_DIM_KEYS = Object.keys(E21CC_DIM_LABELS);

const RAG_LEVELS = [
  { key: 'red',   label: 'Red',   color: '#C94F4F', value: 1 },
  { key: 'amber', label: 'Amber', color: '#E8A33D', value: 2 },
  { key: 'green', label: 'Green', color: '#2c7a4b', value: 3 }
];

const MASTERY_LEVELS = [
  { key: 'emerging',   label: 'Emerging',   color: '#C94F4F', value: 1 },
  { key: 'developing', label: 'Developing', color: '#E8A33D', value: 2 },
  { key: 'secure',     label: 'Secure',     color: '#3b82f6', value: 3 },
  { key: 'mastered',   label: 'Mastered',   color: '#2c7a4b', value: 4 }
];

const PARTICIPATION_LEVELS = [
  { key: '1', label: '1 — Low',  color: '#C94F4F', value: 1 },
  { key: '2', label: '2',        color: '#E8A33D', value: 2 },
  { key: '3', label: '3',        color: '#f59e0b', value: 3 },
  { key: '4', label: '4',        color: '#3b82f6', value: 4 },
  { key: '5', label: '5 — High', color: '#2c7a4b', value: 5 }
];

/* ── Built-in presets ── */

const e21ccPreset = {
  id: 'e21cc',
  name: 'E21CC (21st Century Competencies)',
  fields: E21CC_DIM_KEYS.map(key => ({
    key,
    label: E21CC_DIM_LABELS[key],
    type: 'scale',
    levels: E21CC_LEVELS
  }))
};

const ragPreset = {
  id: 'rag',
  name: 'RAG (Red / Amber / Green)',
  fields: [
    { key: 'understanding', label: 'Understanding', type: 'rag', levels: RAG_LEVELS },
    { key: 'effort',        label: 'Effort',        type: 'rag', levels: RAG_LEVELS },
    { key: 'behaviour',     label: 'Behaviour',     type: 'rag', levels: RAG_LEVELS }
  ]
};

const masteryPreset = {
  id: 'mastery',
  name: 'Mastery',
  fields: [
    { key: 'mastery', label: 'Mastery', type: 'band', levels: MASTERY_LEVELS }
  ]
};

const participationPreset = {
  id: 'participation',
  name: 'Participation',
  fields: [
    { key: 'participation', label: 'Participation', type: 'scale', levels: PARTICIPATION_LEVELS }
  ]
};

/** Object keyed by schema id. e21cc is the default. */
export const SCHEMA_PRESETS = {
  e21cc: e21ccPreset,
  rag: ragPreset,
  mastery: masteryPreset,
  participation: participationPreset
};

/* ── Accessors (stable interface — feature workstreams depend on these) ── */

/** Return a built-in preset by id, or null. */
export function getPreset(id) {
  return SCHEMA_PRESETS[id] || null;
}

/**
 * Resolve the tracking schema for a class. `customSchemas` is the teacher-level
 * array from Store (passed in so this module stays Store-free). An unset or
 * unknown `cls.trackingSchemaId` resolves to the e21cc preset (the default).
 */
export function getSchemaForClass(cls, customSchemas = []) {
  const id = cls && cls.trackingSchemaId;
  if (!id || id === 'e21cc') return SCHEMA_PRESETS.e21cc;
  if (SCHEMA_PRESETS[id]) return SCHEMA_PRESETS[id];
  const custom = (customSchemas || []).find(s => s && s.id === id);
  return custom || SCHEMA_PRESETS.e21cc;
}

/**
 * Read a field's current value for a student. E21CC reads `student.e21cc`;
 * every other schema reads `student.tracked`. A missing value resolves to the
 * first level's key (scale/band/rag) or '' (text/number).
 */
export function getFieldValue(student, schema, field) {
  const store = schema && schema.id === 'e21cc' ? (student && student.e21cc) : (student && student.tracked);
  const raw = store ? store[field.key] : undefined;
  if (raw !== undefined && raw !== null && raw !== '') return raw;
  if (field.type === 'text' || field.type === 'number') return '';
  return (field.levels && field.levels[0] && field.levels[0].key) || '';
}

/**
 * Build a PATCH object for Store.updateStudent that sets one field and appends
 * a history snapshot (shape `{ ts, ...values }`, capped at 20 — mirrors state.js).
 * E21CC writes `{ e21cc, e21ccHistory }`; other schemas write `{ tracked, trackedHistory }`.
 */
export function applyFieldUpdate(student, schema, fieldKey, value) {
  const isE21cc = schema && schema.id === 'e21cc';
  if (isE21cc) {
    const map = { ...((student && student.e21cc) || {}), [fieldKey]: value };
    const history = [...((student && student.e21ccHistory) || [])];
    history.push({ ts: Date.now(), ...map });
    if (history.length > 20) history.splice(0, history.length - 20);
    return { e21cc: map, e21ccHistory: history };
  }
  const map = { ...((student && student.tracked) || {}), [fieldKey]: value };
  const history = [...((student && student.trackedHistory) || [])];
  history.push({ ts: Date.now(), ...map });
  if (history.length > 20) history.splice(0, history.length - 20);
  return { tracked: map, trackedHistory: history };
}

/**
 * Return this field's value history as [{ ts, value }, ...], reading the right
 * history array (e21ccHistory for e21cc, else trackedHistory).
 */
export function getFieldHistory(student, schema, field) {
  const hist = schema && schema.id === 'e21cc'
    ? (student && student.e21ccHistory)
    : (student && student.trackedHistory);
  return (hist || [])
    .map(h => ({ ts: h.ts, value: h[field.key] }))
    .filter(e => e.value !== undefined);
}

/**
 * Metadata for a field+value, for badges/bars: { label, color, value }.
 * For a level-based field, matches by level key (unknown value → first level).
 * For non-level types (text/number) returns a sensible neutral default.
 */
export function levelMeta(field, value) {
  const levels = field && field.levels;
  if (levels && levels.length) {
    const lv = levels.find(l => l.key === value);
    const meta = lv || levels[0];
    return { label: meta.label, color: meta.color, value: meta.value };
  }
  const label = value !== undefined && value !== null && value !== '' ? String(value) : '—';
  return { label, color: 'var(--ink-muted)', value: null };
}
