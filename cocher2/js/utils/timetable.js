/*
 * Co-Cher 2 — The teacher's own timetable
 * =======================================
 * Co-Cher 1 read one school's staff CSV and worked in PERIOD NUMBERS: a column
 * key like `OddMonP03`, a hardcoded bell schedule, and a fixed set of teaching
 * periods. Decoding three real timetables killed that model outright —
 *
 *   Beatty            35-min slots, 07:55–16:05, Odd/Even, no P12, P13/P14 Wed-Thu only
 *   Park View Primary 30-min slots, 07:00–14:30, no week cycle
 *   St Andrew's JC    30-min slots, 07:35–18:00, Odd/Even
 *
 * — no period-grid schema covers all three, while real CLOCK TIMES cover all
 * three for free. So a timetable here is just a flat list of things that happen:
 *
 *   { cycle: 'Odd'|'Even'|null, day: 'Mon', start: '08:30', end: '09:30',
 *     title, class, room, kind }
 *
 * Late starts, short Fridays, doubles, 1.5-hour JC tutorials and 30- vs 35-min
 * schools all fall out of the times themselves. `kind` distinguishes teaching
 * from the rest — duty, PD and school blocks occupy the day just as much as
 * lessons do, and hiding them would make the timetable lie.
 *
 * Storage follows the app's payload-first discipline: entries live in IndexedDB
 * (`media` store, keyed per teacher) and only a small descriptor sits in
 * localStorage, so a big timetable can never blow the snapshot quota.
 */

import { idbPut, idbGet, idbRemove } from './storage.js';
import { getCurrentUser } from '../components/login.js';
import { cycleForDate } from './school.js';

const META_KEY = 'cocher2_timetable_meta';
const STORE = 'media';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const keyFor = (email) => 'tt_' + String(email || 'anon').toLowerCase().replace(/[^a-z0-9]/g, '_');
const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmt = (mins) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;

function readMeta() {
  try {
    const raw = JSON.parse(localStorage.getItem(META_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}
function writeMeta(m) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); return true; } catch { return false; }
}

/** Normalise + sort entries; drops anything without a usable time. */
export function normaliseEntries(entries) {
  const order = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return (Array.isArray(entries) ? entries : [])
    .map(e => ({
      cycle: e?.cycle === 'Odd' || e?.cycle === 'Even' ? e.cycle : null,
      day: order[e?.day] ? e.day : null,
      start: e?.start, end: e?.end,
      title: String(e?.title || '').trim(),
      class: e?.class || null, room: e?.room || null,
      kind: ['lesson', 'duty', 'pd', 'school'].includes(e?.kind) ? e.kind : 'lesson',
    }))
    .filter(e => e.day && toMin(e.start) != null && toMin(e.end) != null && e.title)
    .sort((a, b) => (a.cycle || '').localeCompare(b.cycle || '')
      || order[a.day] - order[b.day] || toMin(a.start) - toMin(b.start));
}

/**
 * Save this teacher's timetable. `doc` is { teacher?, source?, entries }.
 * Payload first, descriptor after — the descriptor never points at nothing.
 */
export async function saveMyTimetable(doc, email = getCurrentUser()?.email) {
  const entries = normaliseEntries(doc?.entries);
  if (!entries.length) return null;
  const id = keyFor(email);
  const ok = await idbPut(STORE, id, JSON.stringify({ ...doc, entries }));
  if (!ok) return null;
  const meta = readMeta();
  meta[id] = {
    email: String(email || ''),
    count: entries.length,
    source: doc?.source?.file || doc?.source || '',
    cycles: [...new Set(entries.map(e => e.cycle).filter(Boolean))],
    updatedAt: Date.now(),
  };
  writeMeta(meta);
  return meta[id];
}

/** This teacher's stored timetable, or null. */
export async function getMyTimetable(email = getCurrentUser()?.email) {
  const raw = await idbGet(STORE, keyFor(email));
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const doc = JSON.parse(raw);
    doc.entries = normaliseEntries(doc.entries);
    return doc.entries.length ? doc : null;
  } catch { return null; }
}

/** Descriptor without touching IndexedDB — cheap enough for render paths. */
export function hasTimetable(email = getCurrentUser()?.email) {
  return !!readMeta()[keyFor(email)];
}

export async function clearMyTimetable(email = getCurrentUser()?.email) {
  const id = keyFor(email);
  try { await idbRemove(STORE, id); } catch { /* best-effort */ }
  const meta = readMeta(); delete meta[id]; writeMeta(meta);
}

/* ── Resolution against a real date ─────────────────────────────────────── */

/**
 * The entries that apply on `date`, in time order. Entries with a cycle only
 * apply in that cycle's weeks; entries with cycle null apply every week (which
 * is how a school with no Odd/Even model works — every entry is null).
 */
export async function entriesForDate(date = new Date(), email = getCurrentUser()?.email) {
  const doc = await getMyTimetable(email);
  if (!doc) return [];
  const day = DAYS[date.getDay()];
  const schoolId = getCurrentUser()?.schoolId;
  const cycle = schoolId ? await cycleForDate(schoolId, date) : null;
  return doc.entries.filter(e => e.day === day && (e.cycle == null || e.cycle === cycle));
}

/**
 * What's happening right now and what's next, from the same day's entries.
 * `current` is the entry spanning `date`; `next` is the first starting after
 * it. Both null outside school hours — the caller shows its own empty state.
 */
export async function nowNext(date = new Date(), email = getCurrentUser()?.email) {
  const list = await entriesForDate(date, email);
  const mins = date.getHours() * 60 + date.getMinutes();
  const current = list.find(e => toMin(e.start) <= mins && mins < toMin(e.end)) || null;
  const next = list.find(e => toMin(e.start) > mins) || null;
  return { current, next, all: list, minutesLeft: current ? toMin(current.end) - mins : null };
}

/** Teaching entries only — what a teacher means by "my lessons today". */
export const lessonsOnly = (entries) => entries.filter(e => e.kind === 'lesson');

/** "8:30–9:30" for display; keeps 24h input, avoids a second format helper. */
export const rangeLabel = (e) => `${fmt(toMin(e.start))}–${fmt(toMin(e.end))}`;

/** Distinct class codes across the timetable — the seed for class matching. */
export async function myClassCodes(email = getCurrentUser()?.email) {
  const doc = await getMyTimetable(email);
  if (!doc) return [];
  return [...new Set(doc.entries.filter(e => e.kind === 'lesson' && e.class)
    .flatMap(e => String(e.class).split(/[,/]/).map(s => s.trim()).filter(Boolean)))];
}
