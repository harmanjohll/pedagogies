/*
 * Co-Cher 2 — The school directory
 * ================================
 * Who else works here, and when are they free?
 *
 * Co-Cher 1 answered that by parsing Beatty's staff timetable CSV. Everything
 * downstream — the staff picker on admin notifications, Find a Teacher — was
 * therefore Beatty-only, and a Park View teacher opening Find a Teacher saw a
 * dropdown that said "Loading…" forever. Nothing was broken; there was simply
 * nothing there, and no honest account of why.
 *
 * This module is the one place that answers "who is in this school", from
 * whichever source that school actually has:
 *
 *   backend  — the school published staff.json into its Drive folder. Canonical
 *              entries with real clock times, so availability works properly.
 *   bty-csv  — Beatty's existing timetable CSV, unchanged, still exact.
 *   none     — nothing published yet. Say so, and say what would fix it.
 *
 * The `reason` on an empty directory is the point. "No staff found" is a dead
 * end; "your school hasn't published a staff timetable yet" is something an
 * admin can act on.
 */

import { getCurrentUser } from '../components/login.js';
import { fetchSchoolStaff } from './backend.js';
import { loadPack, schoolName, cycleForDate } from './school.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BTY_CSV_URL = './btyrelief/BTYTT_2026Sem2_v1.csv';

let _cache = null;      // { schoolId, dir }

const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fmtClock = (mins) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;

/**
 * The signed-in teacher's school directory.
 * → { source, schoolId, schoolName, reason, teachers: [{name, email, department, entries}] }
 *
 * Never throws and never leaks across schools: the cache is keyed on school id,
 * so switching accounts cannot show one school's roster to another's teacher.
 */
export async function loadDirectory({ force = false } = {}) {
  const user = getCurrentUser();
  const schoolId = user?.schoolId || '';
  if (!force && _cache && _cache.schoolId === schoolId) return _cache.dir;

  const dir = await buildDirectory(schoolId);
  _cache = { schoolId, dir };
  return dir;
}

/** Drop the cached directory — sign-out, school switch, manual refresh. */
export function resetDirectory() { _cache = null; }

async function buildDirectory(schoolId) {
  const name = schoolId ? await schoolName(schoolId) : '';
  const base = { schoolId, schoolName: name, teachers: [], reason: '' };

  if (!schoolId) {
    return { ...base, source: 'none', reason: 'Co-Cher does not know which school you are in yet. Set it in Settings and your colleagues will appear here.' };
  }

  // 1. A roster the school published for itself — the path every school can use.
  try {
    const pack = await loadPack(schoolId);
    const staff = await fetchSchoolStaff(schoolId, pack?.joinCode);
    const teachers = (Array.isArray(staff?.teachers) ? staff.teachers : [])
      .map(t => ({
        name: String(t.name || '').trim(),
        email: String(t.email || '').trim().toLowerCase(),
        department: String(t.department || t.dept || '').trim(),
        entries: Array.isArray(t.entries) ? t.entries : [],
      }))
      .filter(t => t.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (teachers.length) return { ...base, source: 'backend', teachers };
  } catch { /* fall through to the next source */ }

  // 2. Beatty's own CSV, still exact for the school it was written for.
  if (schoolId === 'bty') {
    const teachers = await loadBeattyCsv();
    if (teachers.length) return { ...base, source: 'bty-csv', teachers };
  }

  // 3. Nothing published. Say what would fix it.
  return {
    ...base,
    source: 'none',
    reason: `${name || 'Your school'} has not published a staff timetable yet. Once an administrator adds one, everyone here can look up a colleague's free periods — nobody else has to do anything.`,
  };
}

/** Beatty's staff timetable CSV → directory rows, with the raw row kept. */
async function loadBeattyCsv() {
  try {
    const res = await fetch(BTY_CSV_URL);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
    const deptIdx = headers.indexOf('DEPARTMENT');
    const nameIdx = headers.indexOf('NAME');
    const emailIdx = headers.findIndex(h => h === "Teacher's Email");
    if (nameIdx < 0 || emailIdx < 0) return [];

    const seen = new Set();
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const email = (cols[emailIdx] || '').trim().toLowerCase();
      const name = (cols[nameIdx] || '').trim();
      if (!name || !email || email === '0' || seen.has(email)) continue;
      seen.add(email);
      // Keep the whole row: Find a Teacher reads Beatty's period columns from it.
      const row = {};
      headers.forEach((h, j) => { row[h] = (cols[j] || '').trim(); });
      out.push({
        name, email,
        department: deptIdx >= 0 ? (cols[deptIdx] || '').trim() : '',
        entries: [],
        row,
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/* ── Availability from canonical entries ─────────────────────────────
 * The same verdict Find a Teacher renders for Beatty, computed from clock
 * times instead of period columns — so it works for a 30-minute primary day,
 * a 90-minute JC tutorial and a school with no week cycle at all.
 *
 * "Free" means free of EVERYTHING, not free of lessons: a duty or a PD block
 * occupies a teacher exactly as much as a lesson does, and offering to meet
 * someone during their recess duty is the kind of small wrongness that stops
 * people trusting the tool.
 */
export async function availabilityFromEntries(teacher, dateObj = new Date(), schoolId) {
  const name = teacher?.name || 'This teacher';
  const now = new Date();
  const isToday = dateObj.getFullYear() === now.getFullYear()
    && dateObj.getMonth() === now.getMonth() && dateObj.getDate() === now.getDate();

  const dow = dateObj.getDay();
  if (dow < 1 || dow > 5) return { off: 'weekend', name, isToday };
  const dayStr = DAYS[dow];

  // Same rule as timetable.entriesForDate: uncycled entries apply every week;
  // cycle-tagged ones only in their own cycle, and nowhere when the date's
  // cycle is unknown (a holiday week, or a school with no week list yet).
  const cycle = await cycleForDate(schoolId, dateObj);
  const onDay = (teacher.entries || []).filter(e => e.day === dayStr && (e.cycle == null || e.cycle === cycle));

  const busy = onDay
    .map(e => ({ ...e, s: toMin(e.start), e2: toMin(e.end) }))
    .filter(e => e.s != null && e.e2 != null && e.e2 > e.s)
    .sort((a, b) => a.s - b.s);
  if (!busy.length) return { off: 'noperiods', name, isToday };

  const dayStart = busy[0].s;
  const dayEnd = Math.max(...busy.map(b => b.e2));
  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Merge overlapping/adjacent blocks, then read the gaps between them.
  const merged = [];
  busy.forEach(b => {
    const last = merged[merged.length - 1];
    if (last && b.s <= last.end) last.end = Math.max(last.end, b.e2);
    else merged.push({ start: b.s, end: b.e2 });
  });
  const gaps = [];
  for (let i = 0; i < merged.length - 1; i++) {
    const from = merged[i].end, to = merged[i + 1].start;
    if (to - from >= 15) gaps.push({ from, to });        // under 15 min is not a meeting
  }

  // On the day itself, a gap that has half gone is offered as the half that is
  // left — and its label counts the minutes actually still available, not the
  // minutes the gap started with.
  const freeSlots = (isToday ? gaps.filter(g => g.to > nowMins) : gaps)
    .map(g => {
      const from = isToday ? Math.max(g.from, nowMins) : g.from;
      return { label: `${g.to - from} min`, time: `${fmtClock(from)}–${fmtClock(g.to)}` };
    });

  let nowState = null;
  if (isToday) {
    const active = busy.find(b => nowMins >= b.s && nowMins < b.e2);
    if (nowMins < dayStart) nowState = { busy: false, note: `The school day hasn't started yet (first commitment at ${fmtClock(dayStart)}).` };
    else if (nowMins >= dayEnd) nowState = { busy: false, note: `${name}'s timetabled day is over.` };
    else if (active) nowState = { busy: true, note: `${active.kind === 'lesson' ? 'In a lesson' : 'Committed'} now${active.class ? ` (${active.class})` : ''} until ${fmtClock(active.e2)}.` };
    else nowState = { busy: false, note: 'Between commitments right now.' };
  }

  const lessons = busy.filter(b => b.kind === 'lesson');
  const taughtMin = lessons.reduce((sum, b) => sum + (b.e2 - b.s), 0);

  return {
    off: null, name, isToday, dayStr,
    weekType: cycle || '',
    nowState, freeSlots,
    taughtMin, taughtCount: lessons.length,
  };
}

/** Departments present in a directory, sorted; 'Unassigned' for the blanks. */
export function departmentsOf(dir) {
  return [...new Set((dir?.teachers || []).map(t => t.department || 'Unassigned'))]
    .sort((a, b) => a.localeCompare(b));
}
