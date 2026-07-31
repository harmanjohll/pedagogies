/*
 * Co-Cher 2 — school vocabulary
 * =============================
 * Levels, streams and subjects, spoken in the SCHOOL'S words.
 *
 * Co-Cher 1 hardcoded `['Sec 1' … 'JC 2']` in a dozen places. For a
 * secondary school that was invisible; for a primary teacher it is nonsense —
 * every picker, every AI prompt and every seeded example offers levels their
 * school does not run. A primary teacher planning "Sec 3 Chemistry" is being
 * handed someone else's school.
 *
 * The pack is the source of truth. This module primes it ONCE at boot and then
 * answers synchronously, so render paths that were written against a constant
 * array can keep their shape instead of every picker becoming async.
 *
 * With no school, or a pack that lists no levels, the national defaults stand
 * in — Co-Cher must never render an empty level picker.
 */

import { loadPack } from './school.js';
import { getCurrentUser } from '../components/login.js';

/* Sensible national fallbacks, used only when a school says nothing. */
const DEFAULT_LEVELS = ['Sec 1', 'Sec 2', 'Sec 3', 'Sec 4', 'Sec 5', 'JC 1', 'JC 2'];
const DEFAULT_SUBJECTS = [
  'English', 'Mathematics', 'Science', 'Chinese Language', 'Malay Language', 'Tamil Language',
  'Social Studies', 'Art', 'Music', 'Physical Education', 'Character & Citizenship Education',
];

let _vocab = { levels: null, subjects: null, streams: [], bands: null, stage: null, sample: null, ready: false };

/**
 * Load the signed-in teacher's school vocabulary. Safe to call repeatedly, and
 * TIME-BOXED by the caller: this sits in front of first paint, so a slow or
 * hostile network must degrade to the defaults rather than hold the app.
 */
export async function primeVocabulary() {
  const id = getCurrentUser()?.schoolId;
  if (!id) { _vocab = { ...emptyVocab(), ready: true }; return _vocab; }
  const p = await loadPack(id);
  _vocab = {
    levels: Array.isArray(p?.levels) && p.levels.length ? p.levels : null,
    subjects: Array.isArray(p?.subjects) && p.subjects.length ? p.subjects : null,
    streams: Array.isArray(p?.streams) ? p.streams : [],
    bands: p?.levelBands || null,
    stage: inferStage(p),
    sample: Array.isArray(p?.sampleClasses) && p.sampleClasses.length ? p.sampleClasses : null,
    ready: true,
  };
  return _vocab;
}
const emptyVocab = () => ({ levels: null, subjects: null, streams: [], bands: null, stage: null, sample: null });

/** True once primeVocabulary has run — pickers can paint before this. */
export const vocabularyReady = () => _vocab.ready;

/** Forget the current school's vocabulary — used when the account changes, so
 *  the next teacher never sees the last one's levels. */
export function resetVocabulary() { _vocab = { ...emptyVocab(), ready: false }; }

/**
 * primary | secondary | junior-college | null — inferred from the pack's own
 * level names rather than a field schools would have to remember to set.
 */
function inferStage(pack) {
  const levels = (pack?.levels || []).join(' ').toLowerCase();
  if (!levels) return null;
  if (/primary|^p[1-6]\b/.test(levels)) return 'primary';
  if (/jc|junior college|pre-u/.test(levels)) return 'junior-college';
  if (/sec|secondary/.test(levels)) return 'secondary';
  return null;
}

/** The school's levels, or the national default. Synchronous after priming. */
export const levels = () => _vocab.levels || DEFAULT_LEVELS;
export const subjects = () => _vocab.subjects || DEFAULT_SUBJECTS;
export const streams = () => _vocab.streams || [];
export const schoolStage = () => _vocab.stage;
export const isPrimary = () => _vocab.stage === 'primary';
export const isJC = () => _vocab.stage === 'junior-college';

/** 'lower' | 'upper' | null — several schools plan explicitly by band. */
export function bandOf(level) {
  const b = _vocab.bands;
  if (!b) return null;
  if ((b.lower || []).includes(level)) return 'lower';
  if ((b.upper || []).includes(level)) return 'upper';
  return null;
}

/**
 * `<option>` markup for a level picker, optionally pre-selecting one and
 * excluding another (the pattern the planner's class editors already use).
 */
export function levelOptions({ selected = '', exclude = '' } = {}) {
  return levels().filter(l => l !== exclude)
    .map(l => `<option value="${l}"${l === selected ? ' selected' : ''}>${l}</option>`).join('');
}

/**
 * How a teacher at this school would describe their students, for AI prompts.
 * "Secondary" was the hardcoded default in Co-Cher 1 and is wrong half the time.
 */
export function studentDescriptor() {
  switch (_vocab.stage) {
    case 'primary': return 'Singapore primary school students';
    case 'junior-college': return 'Singapore junior college students';
    case 'secondary': return 'Singapore secondary school students';
    default: return 'Singapore students';
  }
}

/** A level to default pickers to — mid-range beats "the first one". */
export function defaultLevel() {
  const l = levels();
  return l[Math.min(2, l.length - 1)] || '';
}

/**
 * The nth-from-last level ("the graduating year", "the year below it"). Sample
 * content wants senior-but-not-final levels regardless of how many years the
 * school runs, and counting back is the only way that holds for P1–6, Sec 1–5
 * and JC 1–2 alike.
 */
export function levelFromTop(n = 0) {
  const l = levels();
  return l[Math.max(0, l.length - 1 - n)] || '';
}

/**
 * 'primary' | 'secondary' | 'jc' — what the Auto-Lesson school-type picker
 * should start on. Falls back to 'secondary', which is what it always assumed.
 */
export function defaultSchoolType() {
  if (_vocab.stage === 'primary') return 'primary';
  if (_vocab.stage === 'junior-college') return 'jc';
  return 'secondary';
}

/**
 * Sample classes for a first-run install: the school's own if its pack names
 * them (real class codes beat invented ones), otherwise a stage-appropriate
 * set built from the school's own level vocabulary.
 *
 * Three classes, because that is what the roster of seeded students fills.
 */
export function sampleClasses() {
  if (_vocab.sample) {
    return _vocab.sample.slice(0, 3).map(c => ({
      name: String(c.name || '').trim(),
      level: String(c.level || defaultLevel()).trim(),
      subject: String(c.subject || '').trim(),
    })).filter(c => c.name && c.subject);
  }
  const senior = levelFromTop(1) || defaultLevel();      // e.g. Primary 5, Sec 4, JC 1
  switch (_vocab.stage) {
    case 'primary':
      return [
        { name: '5A Mathematics', level: senior, subject: 'Mathematics' },
        { name: '5A Science', level: senior, subject: 'Science' },
        { name: '5A English', level: senior, subject: 'English' },
      ];
    case 'junior-college':
      return [
        { name: '25S03 H2 Chemistry', level: senior, subject: 'H2 Chemistry' },
        { name: '25S03 H2 Mathematics', level: senior, subject: 'H2 Mathematics' },
        { name: '25S03 General Paper', level: senior, subject: 'General Paper' },
      ];
    default:
      return [
        { name: '4A Pure Chemistry', level: 'GCE O Level / G3', subject: 'Pure Chemistry' },
        { name: '4B Combined Science', level: 'GCE O Level / G3', subject: 'Combined Science' },
        { name: '4C Mathematics', level: 'GCE O Level / G3', subject: 'Mathematics' },
      ];
  }
}

/**
 * `<option>` markup for a subject picker. The school's own subject list when it
 * has one — a primary school has no "General Paper", and a JC has no "Art".
 */
export function subjectOptions({ selected = '', exclude = '' } = {}) {
  return subjects().filter(s => s !== exclude)
    .map(s => `<option value="${s}"${s === selected ? ' selected' : ''}>${s}</option>`).join('');
}

/**
 * A level worth putting in placeholder text ("e.g. Primary 5"). Written out so
 * no view has to hardcode "e.g. Sec 3" again.
 */
export const exampleLevel = () => levelFromTop(1) || defaultLevel() || 'your level';

/** How the school describes a class group, for AI prompts and copy. */
export function classNoun() {
  return _vocab.stage === 'junior-college' ? 'tutorial group' : 'class';
}
