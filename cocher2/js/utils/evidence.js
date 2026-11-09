/*
 * Evidence: one student's competency evidence, wherever it was captured
 * ======================================================================
 * Observations live on the student record (`observations: [{ id, text, tags,
 * ts, ... }]`, appended by Store.updateStudent). This module gives them a
 * shape that links back to where they came from, and finds the same child
 * across the teacher's classes, so a profile can read as one person.
 *
 * Shape of an observation captured in a lesson:
 *   { id, ts, text, tags: [competency, verdict, 'lesson'],
 *     competency, verdict: 'showed' | 'towards', note,
 *     lessonId, lessonTitle, segment, classId, source: 'present' }
 * Older observations ({ id, text, tags, ts }) still read correctly.
 *
 * Pathways: a teacher can paste a student's Paths share link onto the
 * profile. The link carries only a year, subject levels and a goal, never a
 * name (genapp pathways/assets/js/engine/packet.js). Co-Cher decodes it to
 * show a summary and opens it in Paths for the full picture. It never reads
 * Paths' own storage.
 */

import { Store, generateId } from '../state.js';
import { SCHEMA_PRESETS } from './tracking.js';

export const COMPETENCIES = SCHEMA_PRESETS.e21cc.fields.map(f => ({ key: f.key, label: f.label }));
export const competencyLabel = key => (COMPETENCIES.find(c => c.key === key) || {}).label || key || '';

export const VERDICTS = {
  showed: { label: 'Showed it', short: 'Showed', icon: '✓', color: '#2c7a4b' },
  towards: { label: 'Working towards it', short: 'Towards', icon: '↗', color: '#b7791f' },
};

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Build one lesson observation. */
export function lessonObservation({ competency, verdict, note = '', lesson, segment = '', classId = '' }) {
  const v = VERDICTS[verdict] || VERDICTS.showed;
  const where = segment ? `“${segment}”` : (lesson?.title ? `“${lesson.title}”` : 'class');
  const text = `${v.label}: ${competencyLabel(competency)}, in ${where}${note ? `. ${note}` : ''}`;
  return {
    id: generateId(), ts: Date.now(), text,
    tags: [competency, verdict, 'lesson'].filter(Boolean),
    competency, verdict, note: note || '',
    lessonId: lesson?.id || '', lessonTitle: lesson?.title || '', segment,
    classId, source: 'present',
  };
}

/** Save one observation for each student. Returns the number saved. */
export function recordObservations(classId, studentIds, data) {
  let n = 0;
  studentIds.forEach(sid => {
    Store.updateStudent(classId, sid, { observations: [lessonObservation({ ...data, classId })] });
    n++;
  });
  return n;
}

/**
 * The same child in every class the teacher holds. Matched by Student Finder
 * key first, then by name (and form class where both records carry one).
 * Returns [{ cls, student }], the given record first.
 */
export function sameChild(cls, student) {
  const out = [{ cls, student }];
  const myForm = student.formClass || classCode(cls?.name);
  (Store.getClasses() || []).forEach(c => {
    (c.students || []).forEach(s => {
      if (s === student || s.id === student.id) return;
      if (student.sfKey && s.sfKey) { if (s.sfKey === student.sfKey) out.push({ cls: c, student: s }); return; }
      if (norm(s.name) !== norm(student.name)) return;
      // A name alone is not a person: two children can share one. Only accept
      // a name match when both sit in the same form class, read from the
      // record (Student Finder) or from the class code that starts the class
      // name ("3E Chemistry" and "3E Geography" are both 3E; "4A" is not).
      const theirForm = s.formClass || classCode(c.name);
      if (myForm && theirForm && myForm === theirForm) out.push({ cls: c, student: s });
    });
  });
  return out;
}

/** "3E" from "3E Chemistry", "4A" from "4A (form class)"; '' when the name does not start with a class code. */
export function classCode(name) {
  const t = String(name || '').trim().split(/\s+/)[0] || '';
  return /^\d[A-Za-z0-9-]*$/.test(t) ? t : '';
}

/** Every observation for this child, across classes, newest first. */
export function evidenceFor(records) {
  return records
    .flatMap(({ cls, student }) => (student.observations || []).map(o => ({ ...o, _class: cls })))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

/** Observations captured in one lesson, across the lesson's class. */
export function evidenceForLesson(lesson) {
  const cls = Store.getClass(lesson?.classId);
  if (!cls) return [];
  return (cls.students || [])
    .flatMap(s => (s.observations || []).filter(o => o.lessonId === lesson.id).map(o => ({ ...o, _student: s })))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

/* ══════════ Pathways share links ══════════ */

const YEARS = { sec1: 'Sec 1', sec2: 'Sec 2', sec3: 'Sec 3', sec4: 'Sec 4', sec5: 'Sec 5' };
const DESTS = {
  jc: 'Junior College', mi: 'Millennia Institute', poly: 'Polytechnic', pfp: 'Polytechnic Foundation Programme',
  hnitec: 'ITE Higher Nitec', nitec: 'ITE Nitec', arts: 'Arts institution', uni: 'University', ite: 'ITE',
};
const pretty = s => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Decode a Paths share link (or its `d` value). Null if it is not one. */
export function decodePathsLink(input) {
  try {
    const raw = String(input || '').trim();
    let d = raw;
    if (/^https?:|^\//.test(raw)) d = new URL(raw, location.href).searchParams.get('d') || '';
    if (!d) return null;
    const s = d.replace(/-/g, '+').replace(/_/g, '/');
    const o = JSON.parse(decodeURIComponent(escape(atob(s + '==='.slice((s.length + 3) % 4)))));
    if (!o || !YEARS[o.y]) return null;
    const levels = {};
    String(o.p || '').split('~').forEach(t => { const m = t.match(/^([a-z_0-9]+?)([123])$/); if (m) levels[m[1]] = `G${m[2]}`; });
    return { d, year: o.y, levels, goal: o.g && o.g.dest ? o.g : null };
  } catch { return null; }
}

/** Plain words for a decoded Paths plan. */
export function describePaths(p) {
  if (!p) return null;
  const counts = Object.values(p.levels).reduce((a, g) => ((a[g] = (a[g] || 0) + 1), a), {});
  const n = Object.keys(p.levels).length;
  return {
    year: YEARS[p.year],
    subjects: n ? `${n} subject${n === 1 ? '' : 's'}${Object.keys(counts).length ? ': ' + ['G3', 'G2', 'G1'].filter(g => counts[g]).map(g => `${counts[g]} at ${g}`).join(', ') : ''}` : 'No subjects chosen yet',
    goal: p.goal ? [p.goal.role ? pretty(p.goal.role) : '', DESTS[p.goal.dest] || pretty(p.goal.dest)].filter(Boolean).join(', via ') : '',
    sector: p.goal?.sector ? pretty(p.goal.sector) : '',
  };
}

/** The Paths address that opens a shared plan, read only. */
export const pathsOpenUrl = d => `/genapp/pathways/index.html?s=shared&d=${encodeURIComponent(d)}&for=teacher`;
