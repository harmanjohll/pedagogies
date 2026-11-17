/*
 * Student Finder: data
 * ====================
 * Rebuilt in Co-Cher from a colleague's Student Finder (koominsg), with
 * their agreement. A school's student timetable, one row per student per
 * lesson, tells Co-Cher which teacher teaches which student. Co-Cher owns
 * these teacher and student links; other apps (the E21CC Log) read from here
 * later rather than keeping lists of their own.
 *
 * Student data never enters the repo and never leaves the device:
 *   - The file is read in the browser and kept in IndexedDB ('media' store,
 *     one entry per school), not in localStorage and not in exports.
 *   - Only the columns below are kept. Anything else in the file (remarks,
 *     contacts, support notes) is dropped as it is read, and the teacher is
 *     told which columns were left out. To keep another column, add it to
 *     FIELDS deliberately.
 *   - There is no "bake into the page" option, unlike the original.
 *
 * Commit class turns a teaching group or a form class into an ordinary
 * My Classes class, so seating, E21CC tracking, lessons and assessment all
 * pick it up. Committing again updates the same class and never doubles a
 * student: students are matched by Student Finder key, then form class and
 * register number, then name, and everything Co-Cher already holds on them
 * (E21CC levels, observations) is kept.
 */

import { Store, newStudentRecord, currentSchoolId } from '../state.js';
import { idbGet, idbPut, idbRemove } from './storage.js';
import { levels, sampleClasses, isPrimary, isJC } from './vocabulary.js';
import { NAMES } from '../seed-data.js';

const IDB_STORE = 'media';
const idbKey = () => `studentfinder__${currentSchoolId() || 'default'}`;

/* Columns kept, each with the header spellings accepted (compared with case,
 * spaces and punctuation removed). Everything else is dropped on reading. */
export const FIELDS = {
  name:      { label: 'Student name',   required: true,  aliases: ['studentname', 'name', 'student', 'fullname', 'nameofstudent'] },
  formClass: { label: 'Form class',     required: true,  aliases: ['formclass', 'class', 'registerclass', 'form'] },
  subject:   { label: 'Subject',        required: true,  aliases: ['subject', 'subjectname'] },
  teacher:   { label: 'Subject teacher', required: true, aliases: ['subjectteacher', 'teacher', 'teachername', 'teacherincharge'] },
  index:     { label: 'Register number', required: false, aliases: ['index', 'indexno', 'indexnumber', 'registerno', 'registernumber', 'regno', 'regnumber', 'classindex', 'classno'] },
  level:     { label: 'Level',          required: false, aliases: ['level', 'seclevel', 'year'] },
  stream:    { label: 'Stream / G level', required: false, aliases: ['stream', 'glevel', 'subjectlevel', 'band'] },
  day:       { label: 'Day',            required: false, aliases: ['day'] },
  week:      { label: 'Week',           required: false, aliases: ['week', 'weektype', 'oddeven'] },
  start:     { label: 'Start time',     required: false, aliases: ['starttime', 'start', 'from', 'timestart'] },
  end:       { label: 'End time',       required: false, aliases: ['endtime', 'end', 'to', 'timeend'] },
  venue:     { label: 'Venue',          required: false, aliases: ['venue', 'room', 'location'] },
};

const FIELD_KEYS = Object.keys(FIELDS);
const normHeader = h => String(h || '').replace(/^﻿/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const normName = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/* ══════════ Reading a file ══════════ */

/** Full-text CSV parser: quoted fields, escaped quotes, newlines in quotes. */
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** Excel stores a time as a fraction of a day. */
function asTime(v) {
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const m = Math.round(v * 1440), h = Math.floor(m / 60) % 24, mn = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2})[:.](\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  const hhmm = s.match(/^(\d{3,4})$/);      // 0800, 930
  if (hhmm) { const p = hhmm[1].padStart(4, '0'); return `${p.slice(0, 2)}:${p.slice(2)}`; }
  return s;
}

/**
 * Turn a table (first row = headers) into kept rows.
 * @returns {{ rows: object[], ignored: string[], missing: string[] }}
 */
export function tableToRows(table) {
  const header = (table[0] || []).map(normHeader);
  const rawHeader = table[0] || [];
  const col = {};
  FIELD_KEYS.forEach(k => {
    const i = header.findIndex(h => FIELDS[k].aliases.includes(h));
    if (i !== -1) col[k] = i;
  });
  const missing = FIELD_KEYS.filter(k => FIELDS[k].required && col[k] === undefined).map(k => FIELDS[k].label);
  const used = new Set(Object.values(col));
  const ignored = rawHeader.map((h, i) => (used.has(i) ? null : String(h || '').trim())).filter(Boolean);
  if (missing.length) return { rows: [], ignored, missing };

  const rows = [];
  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    if (!line || line.every(v => String(v ?? '').trim() === '')) continue;
    const o = {};
    FIELD_KEYS.forEach(k => {
      if (col[k] === undefined) return;
      const v = line[col[k]];
      o[k] = (k === 'start' || k === 'end') ? asTime(v) : String(v ?? '').trim();
    });
    if (!o.name || !o.formClass) continue;
    rows.push(o);
  }
  return { rows, ignored, missing };
}

/** Read a CSV or Excel file into kept rows. Throws with a plain message. */
export async function readFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let table;
  if (ext === 'xlsx' || ext === 'xls') {
    if (!window.XLSX) throw new Error('Spreadsheet support could not load (your network may block it). Save the file as CSV and load that instead.');
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('That workbook has no sheets.');
    table = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  } else if (ext === 'csv' || ext === 'txt') {
    table = parseCSV(await file.text());
  } else {
    throw new Error('Please load a CSV or Excel file.');
  }
  const out = tableToRows(table);
  if (out.missing.length) throw new Error(`This file is missing: ${out.missing.join(', ')}.`);
  if (!out.rows.length) throw new Error('No student rows were found in that file.');
  return out;
}

/* ══════════ Storage (this device only) ══════════ */

/** @returns {Promise<{ files: Array<{ name, at, rows, ignored, demo? }> } | null>} */
export async function loadDataset() {
  const d = await idbGet(IDB_STORE, idbKey());
  return d && Array.isArray(d.files) && d.files.length ? d : null;
}

export async function addFile(name, rows, ignored = [], extra = {}) {
  const d = (await loadDataset()) || { v: 1, files: [] };
  d.files = d.files.filter(f => f.name !== name);       // same name replaces
  d.files.push({ name, at: Date.now(), rows, ignored, ...extra });
  const ok = await idbPut(IDB_STORE, idbKey(), d);
  if (!ok) throw new Error('This browser would not store the file (private browsing?).');
  return d;
}

export async function removeFile(name) {
  const d = await loadDataset();
  if (!d) return null;
  d.files = d.files.filter(f => f.name !== name);
  if (!d.files.length) { await idbRemove(IDB_STORE, idbKey()); return null; }
  await idbPut(IDB_STORE, idbKey(), d);
  return d;
}

export async function clearDataset() {
  await idbRemove(IDB_STORE, idbKey());
}

/* ══════════ The index: students, teachers, groups ══════════ */

export const studentKey = r => (r.index ? `${r.formClass}#${r.index}` : `${r.formClass}|${normName(r.name)}`);

const groupLabel = (subject, formClasses, level, stream) => (formClasses.length === 1
  ? `${formClasses[0]} ${subject}`
  : `${level ? level + ' ' : ''}${subject}${stream ? ' ' + stream : ''} (${formClasses.join(', ')})`);

/**
 * Build the lookups the view needs from every loaded file.
 * A teaching group is the students one teacher teaches together for one
 * subject: same subject, stream, level and teacher, and the same lesson slots.
 */
export function buildIndex(dataset) {
  const rows = (dataset?.files || []).flatMap(f => f.rows);
  const students = new Map();
  const teachers = new Map();
  const formClasses = new Map();

  rows.forEach(r => {
    const k = studentKey(r);
    let s = students.get(k);
    if (!s) {
      s = { key: k, name: r.name, index: r.index || '', formClass: r.formClass, level: r.level || '', lessons: [] };
      students.set(k, s);
      if (!formClasses.has(r.formClass)) formClasses.set(r.formClass, { key: `f:${r.formClass}`, kind: 'form', name: `${r.formClass} (form class)`, formClass: r.formClass, level: r.level || '', students: [] });
      formClasses.get(r.formClass).students.push(s);
    }
    if (!s.level && r.level) s.level = r.level;
    s.lessons.push(r);
  });

  // Teaching groups: bucket by (level, subject, stream, teacher), then split
  // by each student's set of lesson slots, so two classes of the same subject
  // with the same teacher stay apart.
  const buckets = new Map();
  students.forEach(s => {
    const per = new Map();
    s.lessons.forEach(l => {
      if (!l.subject || !l.teacher) return;
      const b = [l.level || s.level, l.subject, l.stream || '', l.teacher].join('|');
      if (!per.has(b)) per.set(b, new Set());
      if (l.day || l.start) per.get(b).add(`${l.day}|${l.week || ''}|${l.start}`);
    });
    per.forEach((slots, b) => {
      if (!buckets.has(b)) buckets.set(b, new Map());
      const sig = [...slots].sort().join(';');
      const bySig = buckets.get(b);
      if (!bySig.has(sig)) bySig.set(sig, []);
      bySig.get(sig).push(s);
    });
  });

  const groups = [];
  buckets.forEach((bySig, b) => {
    const [level, subject, stream, teacher] = b.split('|');
    bySig.forEach((list, sig) => {
      const fcs = [...new Set(list.map(s => s.formClass))].sort();
      const firstSlot = sig.split(';')[0] || '';
      groups.push({
        kind: 'teaching', level, subject, stream, teacher,
        formClasses: fcs, students: list.sort(byClassThenIndex),
        slots: sig ? sig.split(';').map(x => { const [day, week, start] = x.split('|'); return { day, week, start }; }) : [],
        name: groupLabel(subject, fcs, level, stream),
        key: `t:${[level, subject, stream, teacher, fcs.join('+')].join('|')}`,
        _first: firstSlot,
      });
    });
  });

  // Two groups with the same key (same classes, different slots) get a suffix.
  const seen = new Map();
  groups.sort((a, b) => a.name.localeCompare(b.name) || a._first.localeCompare(b._first)).forEach(g => {
    const n = (seen.get(g.key) || 0) + 1;
    seen.set(g.key, n);
    if (n > 1) { g.key += `#${n}`; g.name += ` · group ${n}`; }
    if (!teachers.has(g.teacher)) teachers.set(g.teacher, { name: g.teacher, groups: [] });
    teachers.get(g.teacher).groups.push(g);
  });

  formClasses.forEach(fc => fc.students.sort(byClassThenIndex));

  return {
    rows: rows.length,
    students,
    teachers,
    groups,
    formClasses,
    hasTimes: rows.some(r => r.day && r.start),
    hasIndex: rows.some(r => r.index),
  };
}

function byClassThenIndex(a, b) {
  return a.formClass.localeCompare(b.formClass)
    || (parseInt(a.index, 10) || 0) - (parseInt(b.index, 10) || 0)
    || a.name.localeCompare(b.name);
}

/** Search students by name, form class or register number. */
export function searchStudents(index, q, limit = 40) {
  const t = normName(q);
  if (!t) return [];
  const out = [];
  for (const s of index.students.values()) {
    const hay = `${normName(s.name)} ${s.formClass.toLowerCase()} ${s.formClass.toLowerCase()}/${s.index}`;
    if (t.split(' ').every(w => hay.includes(w))) out.push(s);
    if (out.length >= limit) break;
  }
  return out.sort(byClassThenIndex);
}

/** One row per subject: who teaches this student what. */
export function subjectsOf(student) {
  const m = new Map();
  student.lessons.forEach(l => {
    if (!l.subject) return;
    const k = `${l.subject}|${l.teacher}`;
    if (!m.has(k)) m.set(k, { subject: l.subject, stream: l.stream || '', teacher: l.teacher || '' });
  });
  return [...m.values()].sort((a, b) => a.subject.localeCompare(b.subject));
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayMatches = (cell, dayIdx) => {
  const c = String(cell || '').toLowerCase();
  return c && (c === DAY_NAMES[dayIdx] || DAY_NAMES[dayIdx].startsWith(c));
};

/** The student's lessons on a given day, in time order. */
export function lessonsOn(student, date = new Date()) {
  const d = date.getDay();
  return student.lessons.filter(l => dayMatches(l.day, d)).sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

/** The lesson running now, if the file says so (both odd and even weeks shown when the week is unknown). */
export function lessonsNow(student, date = new Date()) {
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return lessonsOn(student, date).filter(l => l.start && l.end && l.start <= hm && hm < l.end);
}

/* ══════════ Commit class ══════════ */

/** The Co-Cher level closest to the file's level ("Sec 3" → "Secondary 3" if that is the school's word). */
function coCherLevel(level) {
  if (!level) return '';
  const list = levels() || [];
  const exact = list.find(l => normName(l) === normName(level));
  if (exact) return exact;
  // Only a year level ("Sec 3", "S3", "Primary 5", "P5", "JC 1") maps across;
  // "GCE O Level / G3" must not turn into Secondary 3.
  const m = String(level).trim().match(/^(sec(?:ondary)?|s|pri(?:mary)?|p|jc|j)\s*(\d)\b/i);
  if (m) {
    const stage = /^(p|pri)/i.test(m[1]) ? /pri|^p\d/i : /^(jc|j)$/i.test(m[1]) ? /jc|junior/i : /sec|^s\d/i;
    const hit = list.find(l => stage.test(l) && new RegExp(`(^|\\D)${m[2]}(\\D|$)`).test(l));
    if (hit) return hit;
  }
  return level;
}

/** The class in My Classes this group is (or would be) committed to. */
export function linkedClass(group) {
  const classes = Store.getClasses();
  return classes.find(c => c.sf?.key === group.key)
    || classes.find(c => !c.sf && normName(c.name) === normName(group.name))
    || null;
}

/**
 * Commit a teaching group or form class to My Classes.
 * @returns {{ cls, created: boolean, added: number, kept: number, notInGroup: number }}
 */
export function commitGroup(group) {
  let cls = linkedClass(group);
  const created = !cls;
  if (!cls) {
    cls = Store.addClass({
      name: group.name,
      level: coCherLevel(group.level),
      subject: group.kind === 'teaching' ? group.subject : '',
    });
  }

  const current = [...(Store.getClass(cls.id)?.students || [])];
  const used = new Set();
  const findExisting = (s) => {
    const k = studentKey(s);
    let i = current.findIndex((x, j) => !used.has(j) && x.sfKey === k);
    if (i === -1 && s.index) i = current.findIndex((x, j) => !used.has(j) && x.index === s.index && x.formClass === s.formClass);
    if (i === -1) i = current.findIndex((x, j) => !used.has(j) && !x.sfKey && normName(x.name) === normName(s.name));
    return i;
  };

  let added = 0, kept = 0;
  const additions = [];
  group.students.forEach(s => {
    const i = findExisting(s);
    const roster = { sfKey: studentKey(s), formClass: s.formClass, ...(s.index ? { index: String(s.index) } : {}) };
    if (i !== -1) {
      used.add(i);
      current[i] = { ...current[i], ...roster };       // keep E21CC, observations, everything
      kept++;
    } else {
      additions.push(newStudentRecord({ name: s.name, ...roster }));
      added++;
    }
  });
  const notInGroup = current.length - used.size;

  Store.updateClass(cls.id, {
    students: [...current, ...additions],
    sf: {
      key: group.key,
      kind: group.kind,
      teacher: group.teacher || '',
      formClasses: group.formClasses || [group.formClass],
      committedAt: Date.now(),
    },
    ...(!cls.level && group.level ? { level: coCherLevel(group.level) } : {}),
  });

  return { cls: Store.getClass(cls.id), created, added, kept, notInGroup };
}

/* ══════════ Demo timetable (made up students only) ══════════ */

/**
 * A made up timetable built from the same made up students Co-Cher seeds
 * into the sample classes, so committing a demo class links to the seeded
 * class instead of doubling it. `me` teaches the sample classes' subjects,
 * plus one mixed group, so "Your teaching groups" has something to commit.
 */
export function demoRows(me = 'Demo Teacher') {
  const samples = sampleClasses();
  const others = [
    { subject: 'English', teacher: 'Ms Lee' },
    { subject: 'Mathematics', teacher: 'Mr Lim' },
    { subject: 'Humanities', teacher: 'Ms Noor' },
    { subject: 'Physical Education', teacher: 'Mr Rahman' },
  ];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const times = [['08:00', '09:00'], ['09:00', '10:00'], ['10:30', '11:30'], ['11:30', '12:30'], ['13:00', '14:00']];
  const rows = [];

  const yearLevel = (formClass, fallback) => {
    const y = (formClass.match(/^(\d)[A-Za-z]/) || [])[1];
    if (!y) return fallback;
    return isPrimary() ? `Primary ${y}` : isJC() ? `JC ${y}` : `Sec ${y}`;
  };

  // The seeder gives each sample class its own 32 students, even when two
  // samples share a form class (5R1 Mathematics, 5R1 Science). Number them on
  // within the form class so no two students share a register number.
  const stream = isPrimary() || isJC() ? '' : 'G3';
  const usedInForm = new Map();
  const cohort = samples.map((c, ci) => {
    const formClass = c.name.split(/\s+/)[0];
    const offset = usedInForm.get(formClass) || 0;
    usedInForm.set(formClass, offset + 32);
    return { c, ci, formClass, offset, level: yearLevel(formClass, c.level), kids: NAMES.slice(ci * 32, ci * 32 + 32) };
  });

  cohort.forEach(({ c, ci, formClass, offset, level, kids }) => {
    const subjects = [{ subject: c.subject, teacher: me }, ...others.filter(o => normName(o.subject) !== normName(c.subject))];
    kids.forEach((name, k) => {
      subjects.forEach((sub, si) => {
        [0, 1].forEach(n => {
          const day = days[(si + n * 2 + ci) % 5];
          const [start, end] = times[(si + ci + n) % 5];
          rows.push({
            index: String(offset + k + 1), name, formClass, level, subject: sub.subject, stream,
            teacher: sub.teacher, day, week: '', start, end,
            venue: si === 0 ? `Lab ${ci + 1}` : `Classroom ${ci + 2}-0${si}`,
          });
        });
      });
    });
  });

  // One mixed group across two different form classes, taught by `me`.
  const distinct = cohort.filter((x, i) => cohort.findIndex(y => y.formClass === x.formClass) === i).slice(0, 2);
  if (distinct.length === 2) {
    const subj = isPrimary() ? 'Enrichment' : isJC() ? 'H3 Mathematics' : 'Additional Mathematics';
    distinct.forEach(({ formClass, offset, level, kids }) => {
      kids.slice(0, 10).forEach((name, k) => {
        rows.push({ index: String(offset + k + 1), name, formClass, level, subject: subj, stream, teacher: me, day: 'Friday', week: '', start: '14:00', end: '15:00', venue: 'Classroom 4-01' });
      });
    });
  }
  return rows;
}

/** CSV text for a set of rows, in the column order the loader reads. */
export function rowsToCSV(rows) {
  const cols = ['index', 'name', 'formClass', 'level', 'subject', 'stream', 'teacher', 'day', 'week', 'start', 'end', 'venue'];
  const head = ['index', 'studentName', 'formClass', 'level', 'subject', 'stream', 'subjectTeacher', 'day', 'week', 'startTime', 'endTime', 'venue'];
  const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [head.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
}
