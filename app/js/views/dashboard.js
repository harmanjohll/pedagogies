/*
 * Co-Cher Dashboard
 * =================
 * Context-aware landing page: "What would you like to do?"
 * Surfaces smart suggestions, admin tasks, and recent lessons.
 * Customisable widget system with show/hide, collapse, reorder, and pinned links.
 *
 * Two layouts, chosen by prefs.layoutStyle (written by Settings, read here):
 *  - 'calm' (default): serif greeting, quiet Up-Next card, day ribbon,
 *    lessons/insights panels, and a "More" toggle hiding the widget grid.
 *  - 'classic': the original greeting card + full widget grid.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { getCurrentUser, getPreferredName, guessFirstName } from '../components/login.js';
import { loadCalendarReference, getWeekType } from '../utils/calendar.js';
import { escapeHtml } from '../utils/markdown.js';
import { lessonStage, lessonNextStep, LIFECYCLE_STAGES } from './lessons.js';
import { getIdentity } from '../utils/identity.js';
import { levelMeta, getPreset } from '../utils/tracking.js';
import { isTouch } from '../utils/viewport.js';

/* ── Visual identity helpers (A3) ──
 * The teacher's monogram + colour. Initials come from the chosen identity, else
 * are derived from the preferred/account name; colour comes from a chosen avatar
 * colour, else the same hash palette as the student avatars (classes.js) so the
 * monogram sits in the same visual family. */
function stringToColor(str) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < String(str).length; i++) hash = String(str).charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function teacherInitials() {
  const id = getIdentity();
  if (id.avatar && id.avatar.initials) return String(id.avatar.initials).slice(0, 3).toUpperCase();
  const user = getCurrentUser();
  const full = (user && user.name) || getFirstName() || 'Cher';
  const salutations = new Set(['MR', 'MS', 'MDM', 'MRS', 'DR', 'PROF', 'MISS']);
  let words = String(full).trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && salutations.has(words[0].toUpperCase())) words = words.slice(1);
  const letters = words.slice(0, 2).map(w => w[0]).join('') || (getFirstName() || 'C')[0];
  return letters.toUpperCase();
}

function teacherAvatarColor() {
  const id = getIdentity();
  if (id.avatar && id.avatar.color) return id.avatar.color;
  const user = getCurrentUser();
  return stringToColor((user && user.name) || getFirstName() || 'Cher');
}

/** Teacher monogram markup (reuses the .avatar component). */
function teacherMonogramHTML(sizeClass = '') {
  return `<div class="avatar ${sizeClass}" style="background:${teacherAvatarColor()};" aria-hidden="true">${escapeHtml(teacherInitials())}</div>`;
}

/* Any E21CC field shares the same level set, so it's a fine source for level
 * colours — this routes dashboard student widgets through the centralised
 * tracking colours instead of hardcoding hex. */
const E21CC_LEVEL_FIELD = getPreset('e21cc').fields[0];
function e21ccLevelColor(levelKey) {
  return levelMeta(E21CC_LEVEL_FIELD, levelKey).color;
}

/* Count lessons whose loop has closed (reached `reflected`) in the last 14 days
 * — deliberate practice, framed as cadence rather than points. */
function loopClosedFortnight(lessons) {
  const cutoff = Date.now() - 14 * 86400000;
  return (lessons || []).filter(l => lessonStage(l) === 'reflected' && (l.updatedAt || 0) >= cutoff).length;
}

/*
 * Admin / tester accounts, present in the CSV (so they can log in and see
 * their own timetable) but excluded from operational pools such as relief.
 * Add email prefixes here as needed.
 */
export const ADMIN_PREFIXES = new Set(['harman_johll', 'sum_kar_mun']);
export function isAdminUser(email) {
  if (!email) return false;
  return ADMIN_PREFIXES.has(email.toLowerCase().split('@')[0]);
}

/* ── Dashboard Preferences (per-user, stored in localStorage) ── */
const DASH_PREFS_KEY = 'cocher_dashboard_prefs';

const DEFAULT_WIDGET_ORDER = [
  'schedule', 'activityFeed', 'notifications', 'weeklyOverview', 'suggestions',
  'quickActions', 'stats', 'studentSpotlight', 'prepChecklist', 'insights',
  'reflections', 'recentGrid', 'timetable', 'classes'
];

const WIDGET_LABELS = {
  schedule:      "Today's Schedule",
  activityFeed:  'Recent Work',
  notifications: 'Notifications & Reminders',
  weeklyOverview:'Weekly Overview',
  suggestions:   'Suggested for You',
  quickActions:  'Quick Actions',
  stats:         'Stats',
  prepChecklist: 'Lesson Prep Checklist',
  insights:      'Teaching Insights',
  reflections:   'Reflection Analytics',
  recentGrid:    'Recent Lessons / Events / Activity',
  studentSpotlight: 'Student Spotlight',
  timetable:     'My Timetable',
  classes:       'Your Classes'
};

function getDashPrefs() {
  try {
    const raw = localStorage.getItem(DASH_PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        widgetOrder: p.widgetOrder || [...DEFAULT_WIDGET_ORDER],
        hiddenWidgets: p.hiddenWidgets || [],
        collapsedWidgets: p.collapsedWidgets || [],
        pinnedLinks: p.pinnedLinks || [],
        defaultView: p.defaultView || 'full',
        widgetNames: p.widgetNames || {},
        widgetSizes: p.widgetSizes || {},
        /* Layout style is WRITTEN by the Settings view; the dashboard only
         * reads it. 'calm' is the default when unset. */
        layoutStyle: p.layoutStyle || 'calm',
        calmMoreOpen: !!p.calmMoreOpen,
        calmPanelSwap: !!p.calmPanelSwap
      };
    }
  } catch {}
  return {
    widgetOrder: [...DEFAULT_WIDGET_ORDER],
    hiddenWidgets: [],
    collapsedWidgets: [],
    pinnedLinks: [],
    defaultView: 'full',
    widgetNames: {},
    widgetSizes: {},
    layoutStyle: 'calm',
    calmMoreOpen: false,
    calmPanelSwap: false
  };
}

function getWidgetLabel(wId, prefs) {
  return (prefs.widgetNames && prefs.widgetNames[wId]) || WIDGET_LABELS[wId] || wId;
}

function saveDashPrefs(prefs) {
  try { localStorage.setItem(DASH_PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

/* ── Pinned Links ── */
const PINNABLE_ACTIONS = [
  { id: 'lesson-planner', label: 'Lesson Planner', icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', route: '/lesson-planner' },
  { id: 'spatial', label: 'Spatial Designer', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>', route: '/spatial' },
  { id: 'classes', label: 'Manage Classes', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', route: '/classes' },
  { id: 'admin', label: 'Admin', icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>', route: '/admin' },
  { id: 'lessons', label: 'Lessons Library', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>', route: '/lessons' },
  { id: 'simulations', label: 'Simulations', icon: '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5"/><circle cx="12" cy="12" r="10"/>', route: '/simulations' },
  { id: 'knowledge', label: 'Knowledge Base', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', route: '/knowledge' },
  { id: 'assessment-afl', label: 'Assessment (AfL)', icon: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', route: '/assessment/afl' },
  { id: 'my-growth', label: 'PD Portfolio', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>', route: '/my-growth' },
  { id: 'settings', label: 'Settings', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>', route: '/settings' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getFirstName() {
  // Prefer user-chosen preferred name, fall back to guessing from full name
  const preferred = getPreferredName();
  if (preferred) return preferred;
  const user = getCurrentUser();
  if (!user || !user.name) return null;
  return guessFirstName(user.name);
}

/* ── Curated quotes, one per day, rotated by period ── */
const QUOTES_MORNING = [
  { text: 'The art of teaching is the art of assisting discovery.', attr: 'Mark Van Doren' },
  { text: 'Every day is a chance to begin again.', attr: '' },
  { text: 'Start where you are. Use what you have. Do what you can.', attr: 'Arthur Ashe' },
  { text: 'What we learn with pleasure we never forget.', attr: 'Alfred Mercier' },
  { text: 'A good teacher can inspire hope, ignite the imagination, and instil a love of learning.', attr: 'Brad Henry' },
  { text: 'Small steps every day lead to big results.', attr: '' },
  { text: 'The beautiful thing about learning is that no one can take it away from you.', attr: 'B.B. King' },
  { text: 'Be the teacher you needed when you were younger.', attr: '' },
  { text: 'Education is not preparation for life; education is life itself.', attr: 'John Dewey' },
  { text: 'You are making more of a difference than you know.', attr: '' },
  { text: 'The best way to predict the future is to create it.', attr: 'Peter Drucker' },
  { text: 'What teachers know and can do is the most important influence on what students learn.', attr: 'Linda Darling-Hammond' },
  { text: 'The seed you plant today determines the harvest of tomorrow.', attr: '' },
  { text: 'Tell me and I forget. Teach me and I remember. Involve me and I learn.', attr: 'Benjamin Franklin' },
  { text: 'Teaching is not about filling a pail but lighting a fire.', attr: 'W.B. Yeats' },
];

const QUOTES_AFTERNOON = [
  { text: 'Rest when you need to, but don\'t quit.', attr: '' },
  { text: 'You don\'t have to be perfect to be a great teacher, just present.', attr: '' },
  { text: 'Progress, not perfection.', attr: '' },
  { text: 'Take a breath. You\'re doing important work.', attr: '' },
  { text: 'The afternoon knows what the morning never suspected.', attr: 'Robert Frost' },
  { text: 'Your patience is shaping someone\'s future.', attr: '' },
  { text: 'Even the smallest act of caring can turn a life around.', attr: '' },
  { text: 'A moment of pause makes the rest of the day possible.', attr: '' },
  { text: 'Not everything that counts can be counted.', attr: 'William Bruce Cameron' },
  { text: 'Stay curious. Stay kind.', attr: '' },
  { text: 'Half the day is done. You\'ve already made a difference.', attr: '' },
  { text: 'Energy and persistence conquer all things.', attr: 'Benjamin Franklin' },
  { text: 'In the middle of difficulty lies opportunity.', attr: 'Albert Einstein' },
  { text: 'You are allowed to take it one class at a time.', attr: '' },
  { text: 'Teaching is a work of heart.', attr: '' },
];

const QUOTES_EVENING = [
  { text: 'You showed up. That matters more than you think.', attr: '' },
  { text: 'Rest is not a reward; it is a requirement.', attr: '' },
  { text: 'Let it be enough for today.', attr: '' },
  { text: 'Well done is better than well said.', attr: 'Benjamin Franklin' },
  { text: 'The work you did today will ripple forward.', attr: '' },
  { text: 'Take care of yourself. You can\'t pour from an empty cup.', attr: '' },
  { text: 'Reflect, recover, return stronger.', attr: '' },
  { text: 'Your best is always enough.', attr: '' },
  { text: 'Tomorrow is another chance to make a difference.', attr: '' },
  { text: 'The teachers who get "burned out" are the ones who cared the most.', attr: '' },
  { text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', attr: 'Ralph Waldo Emerson' },
  { text: 'Be proud of how hard you are trying.', attr: '' },
  { text: 'A day of learning is never wasted.', attr: '' },
  { text: 'Switch off. Recharge. You\'ve earned it.', attr: '' },
  { text: 'The impact you made today may not be visible yet, but it is real.', attr: '' },
];

function getDailyQuote() {
  const now = new Date();
  const h = now.getHours();
  const pool = h < 12 ? QUOTES_MORNING : h < 17 ? QUOTES_AFTERNOON : QUOTES_EVENING;
  // Deterministic pick based on day-of-year
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return pool[dayOfYear % pool.length];
}

/* ── Timetable (TT) Awareness ── */
let _ttCache = null;

export async function loadTT() {
  if (_ttCache) return _ttCache;
  try {
    const res = await fetch('./btyrelief/BTYTT_2026Sem2_v1.csv');
    const text = await res.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { _ttCache = []; return _ttCache; }
    const headers = lines[0].replace(/^﻿/, '').split(',');
    _ttCache = lines.slice(1).map(line => {
      const cols = line.split(',');
      const row = {};
      headers.forEach((h, i) => row[h.trim()] = (cols[i] || '').trim());
      return row;
    });
  } catch { _ttCache = []; }
  return _ttCache;
}

/* ── Beatty Semester 2 bell schedule ──────────────────────────────
 * Day starts 07:30. P0 (form/assembly, 25 min) and P12 are not taught and
 * never appear in the timetable grid. All teaching periods are 35 min. P13 &
 * P14 run on Wed/Thu afternoons only. CSV columns are keyed {Odd|Even}{Day}P{nn}
 * (zero-padded), e.g. OddMonP01, EvenThuP14. Which periods a given day/week
 * actually has is read from the row's own columns (periodsForDay), so late-start
 * days and the Wed/Thu afternoons are handled without hardcoding day lists. */
export const TEACHING_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14];
const PERIOD_START_MIN = {
  1: 475, 2: 510, 3: 545, 4: 580, 5: 615, 6: 650, 7: 685,
  8: 720, 9: 755, 10: 790, 11: 825, 13: 895, 14: 930,
};
const PERIOD_LEN_MIN = 35;
const DAY_START_MIN = 450; // 07:30 — first bell (P0 form/assembly)

/** Timetable CSV column key, e.g. periodCol('Odd','Mon',1) → 'OddMonP01'. */
export function periodCol(weekType, dayStr, p) {
  return `${weekType}${dayStr}P${String(p).padStart(2, '0')}`;
}
/** Periods that actually exist for this day/week, read from the row's own columns. */
function periodsForDay(teacherRow, weekType, dayStr) {
  return TEACHING_PERIODS.filter(p => periodCol(weekType, dayStr, p) in teacherRow);
}
function periodStartMin(p) { return PERIOD_START_MIN[p] ?? null; }
function periodEndMin(p) { const s = PERIOD_START_MIN[p]; return s == null ? null : s + PERIOD_LEN_MIN; }
/** minutes-from-midnight → "7:55" (12-hour clock, no meridian). */
function fmtClockShort(mins) {
  if (mins == null) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')}`;
}

let _calRef = null;

export async function ensureCalendar() {
  if (!_calRef) {
    _calRef = await loadCalendarReference();
  }
  return _calRef;
}

/**
 * Get week type for a given date using CalendarReference.csv.
 * Exported so other views can reuse without re-loading the CSV.
 */
export function getWeekTypeForDate(date) {
  return _calRef ? getWeekType(_calRef, date) : null;
}

export function getTTPeriodKey() {
  const now = new Date();
  const day = now.getDay();
  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (day < 1 || day > 5) return null;
  const dayStr = dayNames[day];

  // Use CalendarReference for authoritative week type
  let weekType = _calRef ? getWeekType(_calRef, now) : null;
  if (weekType === 'N.A.') return null; // non-teaching week; no timetable

  // Fallback: math-based (only if calendar data unavailable)
  if (!weekType) {
    const start = new Date(now.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
    weekType = weekNum % 2 === 1 ? 'Odd' : 'Even';
  }

  const h = now.getHours(), m = now.getMinutes(), mins = h * 60 + m;
  let period = null;
  for (let i = TEACHING_PERIODS.length - 1; i >= 0; i--) {
    const p = TEACHING_PERIODS[i];
    if (mins >= PERIOD_START_MIN[p]) { period = p; break; }
  }
  return { dayStr, period, weekType, mins };
}

/* ── Flexible teacher lookup: match exact email or prefix (cross-domain) ── */
export function findTeacherRow(ttData, email) {
  if (!ttData || !email) return null;
  const emailLower = email.toLowerCase();
  const prefix = emailLower.split('@')[0];

  // 1. Exact match on Teacher's Email
  let row = ttData.find(r => (r["Teacher's Email"] || '').toLowerCase() === emailLower);
  if (row) return row;
  // 2. Prefix match (handles cross-domain logins)
  row = ttData.find(r => (r["Teacher's Email"] || '').toLowerCase().split('@')[0] === prefix);
  if (row) return row;
  return null;
}

/* ── S1: weekend / non-teaching-week widget filler ──
 * Timetable widgets keep their slot with a slim friendly card instead of
 * rendering an empty div, so the Customise toggles stay truthful. */
function noSchoolCard(message) {
  return `<div class="card" style="padding:var(--sp-3) var(--sp-4);display:flex;align-items:center;gap:var(--sp-3);">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
    <span style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">${message}</span>
  </div>`;
}
/** Why is there no timetable today? Weekend vs a non-teaching (N.A.) week. */
function isWeekendToday() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

/* ── Top-of-dashboard status banner: next lesson or done for the day ── */
function buildStatusBanner(teacherRow) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  if (!pk) return ''; // Weekend

  const { dayStr, period, weekType, mins } = pk;
  const firstName = getFirstName() || 'Cher';

  // Build today's full schedule
  const allPeriods = [];
  for (const p of periodsForDay(teacherRow, weekType, dayStr)) {
    const col = periodCol(weekType, dayStr, p);
    const val = teacherRow[col];
    if (val && val !== '0') {
      const parts = val.split(' / ');
      allPeriods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
    }
  }

  const lastPeriod = allPeriods.length > 0 ? allPeriods[allPeriods.length - 1].p : 0;
  const beforeSchool = mins < DAY_START_MIN;

  // Find the next upcoming lesson (current or future)
  const nextLesson = allPeriods.find(s => period === null ? true : s.p >= period);
  const doneForDay = (period !== null && period > lastPeriod && allPeriods.length > 0) ||
                     (allPeriods.length === 0) ||
                     (!beforeSchool && !nextLesson);

  const formatTime = (m) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  if (beforeSchool && nextLesson) {
    // Before school: show first lesson
    const startTime = formatTime(periodStartMin(nextLesson.p));
    return `
      <div style="padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--accent,#4361ee),#6366f1);color:#fff;display:flex;align-items:center;gap:var(--sp-4);">
        <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <div style="font-size:0.8125rem;opacity:0.85;">First lesson today</div>
          <div style="font-size:1.125rem;font-weight:700;">P${nextLesson.p} | ${nextLesson.classCode} in ${nextLesson.room} at ${startTime}</div>
        </div>
      </div>`;
  }

  if (doneForDay) {
    return `
      <div style="padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--success,#22c55e),#16a34a);color:#fff;display:flex;align-items:center;gap:var(--sp-4);">
        <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div>
          <div style="font-size:1.125rem;font-weight:700;">You are done with lessons for the day!</div>
          <div style="font-size:0.875rem;opacity:0.9;">Take a break before you continue with marking or prep. Thank you, ${firstName}!</div>
        </div>
      </div>`;
  }

  if (nextLesson) {
    const isCurrent = nextLesson.p === period;
    const upNext = allPeriods.find(s => s.p > period);
    if (isCurrent) {
      const label = upNext
        ? `Up next: P${upNext.p} | ${upNext.classCode} in ${upNext.room} at ${formatTime(periodStartMin(upNext.p))}`
        : 'This is your last lesson today';
      return `
        <div style="padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);border-radius:var(--radius-lg);background:var(--accent-light);border-left:4px solid var(--accent);display:flex;align-items:center;gap:var(--sp-4);">
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div style="font-size:0.8125rem;color:var(--ink-muted);">Now teaching</div>
            <div style="font-size:1.125rem;font-weight:700;color:var(--ink);">P${nextLesson.p} | ${nextLesson.classCode} in ${nextLesson.room}</div>
            <div style="font-size:0.8125rem;color:var(--ink-muted);margin-top:2px;">${label}</div>
          </div>
        </div>`;
    } else {
      const startTime = formatTime(periodStartMin(nextLesson.p));
      return `
        <div style="padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);border-radius:var(--radius-lg);background:var(--warning-light, rgba(245,158,11,0.1));border-left:4px solid var(--warning);display:flex;align-items:center;gap:var(--sp-4);">
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div style="font-size:0.8125rem;color:var(--ink-muted);">Next lesson</div>
            <div style="font-size:1.125rem;font-weight:700;color:var(--ink);">P${nextLesson.p} | ${nextLesson.classCode} in ${nextLesson.room} at ${startTime}</div>
          </div>
        </div>`;
    }
  }

  return '';
}

function buildTTScheduleCard(teacherRow) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  if (!pk) {
    return noSchoolCard(isWeekendToday()
      ? 'No school day today &mdash; enjoy the breather.'
      : 'Non-teaching week &mdash; no classes scheduled today.');
  }

  const name = teacherRow['NAME'] || '';
  const dept = teacherRow['DEPARTMENT'] || '';
  const { dayStr, period, weekType, mins } = pk;

  // Build today's full schedule
  const allPeriods = [];
  for (const p of periodsForDay(teacherRow, weekType, dayStr)) {
    const col = periodCol(weekType, dayStr, p);
    const val = teacherRow[col];
    if (val && val !== '0') {
      const parts = val.split(' / ');
      allPeriods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
    }
  }

  // Find last teaching period
  const lastPeriod = allPeriods.length > 0 ? allPeriods[allPeriods.length - 1].p : 0;
  const doneForDay = period !== null && period > lastPeriod && allPeriods.length > 0;
  // School day hasn't started
  const beforeSchool = mins < DAY_START_MIN;

  // Current slot
  let currentLabel = '';
  if (beforeSchool) {
    currentLabel = '<span style="color:var(--ink-muted);">School hasn\u2019t started yet</span>';
  } else if (doneForDay) {
    currentLabel = '<span style="color:var(--success,#22c55e);font-weight:600;">Done for the day</span>';
  } else if (period) {
    const currentSlot = allPeriods.find(s => s.p === period);
    if (currentSlot) {
      currentLabel = `<strong>${currentSlot.classCode}</strong> in <strong>${currentSlot.room}</strong>`;
    } else {
      currentLabel = '<span style="color:var(--success,#22c55e);">Free period</span>';
    }
  } else {
    currentLabel = '<span style="color:var(--ink-muted);">After school hours</span>';
  }

  // Build period pills
  const nextPeriod = period !== null ? allPeriods.find(s => s.p > period) : null;
  const periodPills = allPeriods.map(s => {
    const isCurrent = period === s.p;
    const isNext = nextPeriod && s.p === nextPeriod.p;
    const isPast = period !== null && s.p < period;
    const bg = isCurrent ? 'var(--accent)' : isPast ? 'var(--bg-subtle)' : 'var(--surface)';
    const color = isCurrent ? '#fff' : isPast ? 'var(--ink-faint)' : 'var(--ink)';
    const borderStyle = isCurrent ? '1px solid var(--accent)' : isNext ? '1.5px solid var(--accent)' : '1px solid var(--border)';
    const textDec = isPast ? 'line-through' : 'none';
    const anim = isNext ? 'animation:pulse-soft 2s ease-in-out infinite;' : '';
    return `<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:${borderStyle};background:${bg};color:${color};font-size:0.75rem;text-decoration:${textDec};${anim}">
      <span style="font-weight:700;">P${s.p}</span>
      <span>${s.classCode}</span>
    </div>`;
  }).join('');

  return `
    <div class="card" style="padding:var(--sp-5) var(--sp-6);margin-bottom:var(--sp-6);border-left:4px solid var(--accent,#4361ee);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
        <div>
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.03em;">Today\u2019s Schedule</div>
          <div style="font-size:0.875rem;color:var(--ink);margin-top:2px;">
            <strong>${name}</strong> &middot; ${dept} &middot; ${weekType} Week ${dayStr}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem;color:var(--ink-muted);">${period ? `Period ${period}` : ''}</div>
          <div style="font-size:0.875rem;">${currentLabel}</div>
        </div>
      </div>
      ${allPeriods.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${periodPills}
        </div>
        ${doneForDay ? '<div style="margin-top:8px;font-size:0.8125rem;color:var(--success,#22c55e);font-weight:500;">All classes done. Time to plan, reflect, or rest.</div>' : ''}
      ` : '<div style="font-size:0.8125rem;color:var(--ink-muted);">No classes scheduled today.</div>'}
    </div>
  `;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Build smart suggestions based on app state ── */
function buildSuggestions(classes, lessons, events) {
  const suggestions = [];

  // Draft lessons to finish
  const drafts = lessons.filter(l => l.status === 'draft');
  if (drafts.length > 0) {
    const latest = drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      color: 'var(--accent)',
      bg: 'var(--accent-light)',
      title: `Continue "${latest.title || 'Untitled'}"`,
      desc: `Draft lesson, ${latest.chatHistory?.length || 0} exchanges so far`,
      action: () => navigate(`/lesson-planner/${latest.id}`)
    });
  }

  // Classes without lessons
  const classesWithoutLessons = classes.filter(cls =>
    !lessons.some(l => l.classId === cls.id)
  );
  if (classesWithoutLessons.length > 0) {
    const cls = classesWithoutLessons[0];
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
      color: 'var(--warning)',
      bg: 'var(--warning-light)',
      title: `Plan a lesson for ${cls.name}`,
      desc: `${cls.students?.length || 0} students, no lessons linked yet`,
      action: () => navigate('/lesson-planner')
    });
  }

  // Lessons ready for reflection (taught but no reflection written)
  const needsReflection = lessons.filter(l =>
    (l.status === 'ready' || l.status === 'completed') && !l.reflection
  );
  if (needsReflection.length > 0) {
    const lr = needsReflection[0];
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      color: 'var(--success)',
      bg: 'var(--success-light)',
      title: `Reflect on "${lr.title || 'Untitled'}"`,
      desc: 'How did it go? Capture what worked and what to adjust.',
      action: () => navigate(`/lessons/${lr.id}`)
    });
  }

  // Upcoming/incomplete admin events
  const pendingEvents = events.filter(e => e.status !== 'completed');
  if (pendingEvents.length > 0) {
    const ev = pendingEvents[0];
    const enabled = ev.tasks.filter(t => t.enabled);
    const done = enabled.filter(t => t.status === 'completed').length;
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      color: 'var(--info)',
      bg: 'var(--info-light)',
      title: `${ev.name}, ${done}/${enabled.length} tasks done`,
      desc: `${ev.eventType || 'Event'}${ev.date ? ' · ' + ev.date : ''}`,
      action: () => navigate('/admin')
    });
  }

  // E21CC weak area to focus on
  const DASH_DIMS = [
    { key: 'criticalThinking', label: 'Critical Thinking' },
    { key: 'creativeThinking', label: 'Creative Thinking' },
    { key: 'communication', label: 'Communication' },
    { key: 'collaboration', label: 'Collaboration' },
    { key: 'socialConnectedness', label: 'Social Connectedness' },
    { key: 'selfRegulation', label: 'Self-Regulation' },
  ];
  const _lvVal = (lv) => ({ developing: 1, applying: 2, extending: 3, leading: 4 }[lv] || 1);
  if (classes.length > 0) {
    const totals = {}; DASH_DIMS.forEach(d => { totals[d.key] = 0; }); let count = 0;
    classes.forEach(cls => (cls.students || []).forEach(s => {
      if (s.e21cc) {
        DASH_DIMS.forEach(d => { totals[d.key] += _lvVal(s.e21cc[d.key]); });
        count++;
      }
    }));
    if (count > 0) {
      const avgs = {}; DASH_DIMS.forEach(d => { avgs[d.key] = totals[d.key] / count; });
      const weakest = Object.entries(avgs).sort((a, b) => a[1] - b[1])[0];
      const dimLabel = DASH_DIMS.find(d => d.key === weakest[0])?.label || weakest[0];
      if (weakest[1] < 2.5) {
        suggestions.push({
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`,
          color: 'var(--success)',
          bg: 'var(--success-light)',
          title: `Boost ${dimLabel} across your classes`,
          desc: `${dimLabel}, mostly Developing/Applying`,
          action: () => navigate('/lesson-planner')
        });
      }
    }
  }

  // No classes yet
  if (classes.length === 0) {
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      color: 'var(--warning)',
      bg: 'var(--warning-light)',
      title: 'Create your first class',
      desc: 'Add a class with students to unlock E21CC tracking',
      action: () => navigate('/classes')
    });
  }

  // No lessons at all
  if (lessons.length === 0 && classes.length > 0) {
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      color: 'var(--accent)',
      bg: 'var(--accent-light)',
      title: 'Design your first lesson',
      desc: 'Chat with Co-Cher to create an E21CC-aligned lesson plan',
      action: () => navigate('/lesson-planner')
    });
  }

  return suggestions.slice(0, 4);
}

/* ── Student Spotlight Widget ── */
function buildStudentSpotlight(classes) {
  if (classes.length === 0) return '';

  const SPOT_DIMS = [
    { key: 'criticalThinking', short: 'CT', color: '#6366f1' },
    { key: 'creativeThinking', short: 'CrT', color: '#8b5cf6' },
    { key: 'communication', short: 'Com', color: '#0ea5e9' },
    { key: 'collaboration', short: 'Col', color: '#06b6d4' },
    { key: 'socialConnectedness', short: 'SC', color: '#10b981' },
    { key: 'selfRegulation', short: 'SR', color: '#f59e0b' },
  ];
  const _spotLvVal = (lv) => ({ developing: 1, applying: 2, extending: 3, leading: 4 }[lv] || 1);
  // Level colours are sourced from the centralised tracking accessor
  // (levelMeta) rather than hardcoded hex; the short labels remain local.
  const _spotShort = { developing: 'Dev', applying: 'App', extending: 'Ext', leading: 'Lead' };
  const _spotLvMeta = (lv) => ({ short: _spotShort[lv] || 'Dev', color: e21ccLevelColor(lv) });
  const flagged = [];
  classes.forEach(cls => {
    if (!cls.students?.length) return;
    cls.students.forEach(st => {
      const levels = SPOT_DIMS.map(d => st.e21cc?.[d.key] || 'developing');
      const values = levels.map(l => _spotLvVal(l));
      const avgVal = Math.round(values.reduce((a, b) => a + b, 0) * 10 / values.length) / 10;
      const lowestVal = Math.min(...values);
      const lowestIdx = values.indexOf(lowestVal);
      const lowestLabel = SPOT_DIMS[lowestIdx]?.short || '?';
      const lowestLevel = levels[lowestIdx];
      // Flag students with avg below Applying (2) or any dimension at Developing
      if (avgVal < 2 || lowestVal <= 1) {
        flagged.push({
          name: st.name,
          className: cls.name,
          classId: cls.id,
          avgVal,
          levels,
          lowestVal, lowestLabel, lowestLevel,
          suggestion: lowestVal <= 1
            ? `Needs support in ${lowestLabel} (Developing). Consider scaffolding or differentiated tasks.`
            : `Overall E21CC mostly at Developing level. Review across all competencies.`
        });
      }
    });
  });

  if (flagged.length === 0) {
    return `<div style="text-align:center;padding:var(--sp-4);">
      <div style="font-size:2rem;margin-bottom:var(--sp-2);">&#x2728;</div>
      <p style="color:var(--ink-muted);font-size:0.8125rem;">All students are above the E21CC threshold. Great work!</p>
    </div>`;
  }

  // Sort by avgVal ascending (most needy first), take top 5
  flagged.sort((a, b) => a.avgVal - b.avgVal);
  const shown = flagged.slice(0, 5);

  return `
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
      ${shown.map(st => {
        const avgColor = st.avgVal < 1.5 ? 'var(--danger,#ef4444)' : st.avgVal < 2.5 ? 'var(--warning,#f59e0b)' : 'var(--success,#22c55e)';
        return `
          <div class="card card-hover card-interactive spotlight-student" data-class-id="${st.classId}" style="padding:var(--sp-3) var(--sp-4);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-2);">
              <div>
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);">${st.name}</div>
                <div style="font-size:0.6875rem;color:var(--ink-muted);">${st.className}</div>
              </div>
            </div>
            <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-2);">
              ${SPOT_DIMS.map((d, i) => {
                const meta = _spotLvMeta(st.levels[i]);
                return `<div style="flex:1;text-align:center;">
                  <div style="font-size:0.5625rem;font-weight:600;color:var(--ink-faint);text-transform:uppercase;">${d.short}</div>
                  <span style="display:inline-block;margin-top:2px;padding:1px 4px;border-radius:3px;font-size:0.5625rem;font-weight:600;background:${meta.color}15;color:${meta.color};">${meta.short}</span>
                </div>`;
              }).join('')}
            </div>
            <div style="font-size:0.75rem;color:var(--ink-secondary);background:var(--bg-subtle);padding:var(--sp-2) var(--sp-3);border-radius:var(--radius-md);line-height:1.4;">
              ${st.suggestion}
            </div>
          </div>`;
      }).join('')}
      ${flagged.length > 5 ? `<p style="font-size:0.75rem;color:var(--ink-muted);text-align:center;">+${flagged.length - 5} more students need attention</p>` : ''}
    </div>`;
}

function renderInsights(classes, lessons) {
  const INS_DIMS = [
    { key: 'criticalThinking',    short: 'CT',  color: '#6366f1' },
    { key: 'creativeThinking',    short: 'CrT', color: '#8b5cf6' },
    { key: 'communication',       short: 'Com', color: '#0ea5e9' },
    { key: 'collaboration',       short: 'Col', color: '#06b6d4' },
    { key: 'socialConnectedness', short: 'SC',  color: '#10b981' },
    { key: 'selfRegulation',     short: 'SR',  color: '#f59e0b' },
  ];

  // Level colours via the centralised tracking accessor (see buildStudentSpotlight).
  const _insShort = { developing: 'Dev', applying: 'App', extending: 'Ext', leading: 'Lead' };
  const _insLvMeta = (lv) => ({ short: _insShort[lv] || 'Dev', color: e21ccLevelColor(lv) });
  const _insLvVal = (lv) => ({ developing: 1, applying: 2, extending: 3, leading: 4 }[lv] || 1);

  // Count level distribution per dimension
  const distributions = {};
  INS_DIMS.forEach(d => { distributions[d.key] = { developing: 0, applying: 0, extending: 0, leading: 0 }; });
  let count = 0;
  classes.forEach(cls => {
    (cls.students || []).forEach(s => {
      if (s.e21cc) {
        INS_DIMS.forEach(d => {
          const lv = s.e21cc[d.key] || 'developing';
          distributions[d.key][lv] = (distributions[d.key][lv] || 0) + 1;
        });
        count++;
      }
    });
  });

  // Find most common level per dimension
  const dimModes = INS_DIMS.map(d => {
    const dist = distributions[d.key];
    const mode = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
    return { ...d, mode: mode[0], dist };
  });

  const focusCounts = {};
  INS_DIMS.forEach(d => { focusCounts[d.key] = 0; });
  lessons.forEach(l => {
    (l.e21ccFocus || []).forEach(f => { if (focusCounts[f] !== undefined) focusCounts[f]++; });
  });
  const totalFocus = INS_DIMS.reduce((s, d) => s + focusCounts[d.key], 0);

  let strongest = null, weakest = null, maxAvg = -1, minAvg = 5;
  classes.forEach(cls => {
    const students = cls.students || [];
    if (students.length === 0) return;
    const avg = students.reduce((s, st) => {
      const e = st.e21cc || {};
      return s + INS_DIMS.reduce((sum, d) => sum + _insLvVal(e[d.key] || 'developing'), 0) / INS_DIMS.length;
    }, 0) / students.length;
    if (avg > maxAvg) { maxAvg = avg; strongest = cls; }
    if (avg < minAvg) { minAvg = avg; weakest = cls; }
  });

  const _lvLabels = { developing: 'Developing', applying: 'Applying', extending: 'Extending', leading: 'Leading' };

  return `
    <div style="margin-bottom:var(--sp-8);">
      <div class="section-header">
        <h2 class="section-title" style="font-size:1.125rem;">Teaching Insights</h2>
      </div>
      <div class="grid-2 stagger">
        <!-- E21CC Level Distribution -->
        <div class="card" style="padding:var(--sp-5) var(--sp-6);">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-4);">E21CC Levels (All Students)</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
            ${dimModes.map(d => {
              const meta = _insLvMeta(d.mode);
              const dist = d.dist;
              return `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px;">
                <span style="font-weight:600;color:var(--ink);">${d.short}</span>
                <span style="padding:1px 6px;border-radius:4px;font-size:0.6875rem;font-weight:600;background:${meta.color}15;color:${meta.color};">${meta.short}</span>
              </div>
              <div style="font-size:0.625rem;color:var(--ink-muted);">${dist.developing} Dev, ${dist.applying} App, ${dist.extending} Ext, ${dist.leading} Lead</div>
            </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Quick Insights -->
        <div class="card" style="padding:var(--sp-5) var(--sp-6);">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-4);">Quick Insights</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);font-size:0.8125rem;">
            ${strongest ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--success);font-size:1rem;">&#9650;</span>
              <span style="color:var(--ink-secondary);"><strong>${strongest.name}</strong> has the highest overall E21CC levels</span>
            </div>` : ''}
            ${weakest && weakest !== strongest ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--warning);font-size:1rem;">&#9660;</span>
              <span style="color:var(--ink-secondary);"><strong>${weakest.name}</strong> could benefit from more E21CC focus</span>
            </div>` : ''}
            ${totalFocus > 0 ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--accent);font-size:1rem;">&#9679;</span>
              <span style="color:var(--ink-secondary);">Lesson focus: ${INS_DIMS.map(d => `${d.short} (${focusCounts[d.key]})`).join(', ')}</span>
            </div>` : ''}
            <div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--ink-faint);font-size:1rem;">&#9679;</span>
              <span style="color:var(--ink-secondary);">${count} students across ${classes.length} class${classes.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderReflectionAnalytics(lessons) {
  const reflected = lessons.filter(l => {
    const r = l.reflection;
    if (!r) return false;
    if (typeof r === 'string') return r.trim().length > 0;
    return !!(r.whatWorked || r.whatToAdjust || r.engagement || r.e21ccObservations || r.freeform);
  });
  if (reflected.length === 0) return '';

  const engagements = reflected.map(l => {
    const r = typeof l.reflection === 'object' ? l.reflection : {};
    return r.engagement || 0;
  }).filter(e => e > 0);
  const avgEng = engagements.length > 0 ? (engagements.reduce((a, b) => a + b, 0) / engagements.length).toFixed(1) : null;
  const engLabels = ['', 'Low', 'Below Average', 'Average', 'Good', 'Excellent'];
  const totalLessons = lessons.length;
  const reflectedPct = totalLessons > 0 ? Math.round((reflected.length / totalLessons) * 100) : 0;

  // Count what-worked themes (simple word frequency)
  const workedTexts = reflected.map(l => (typeof l.reflection === 'object' ? l.reflection.whatWorked : '') || '').join(' ');
  const adjustTexts = reflected.map(l => (typeof l.reflection === 'object' ? l.reflection.whatToAdjust : '') || '').join(' ');

  return `
    <div style="margin-bottom:var(--sp-8);">
      <div class="section-header">
        <h2 class="section-title" style="font-size:1.125rem;">Reflection Insights</h2>
      </div>
      <div class="grid-3 stagger">
        <div class="card" style="padding:var(--sp-5) var(--sp-6);text-align:center;">
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-2);">Reflection Rate</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--accent);">${reflectedPct}%</div>
          <div style="font-size:0.75rem;color:var(--ink-muted);">${reflected.length} of ${totalLessons} lessons</div>
          <div style="height:6px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;margin-top:var(--sp-2);">
            <div style="width:${reflectedPct}%;height:100%;background:var(--accent);border-radius:var(--radius-full);"></div>
          </div>
        </div>
        <div class="card" style="padding:var(--sp-5) var(--sp-6);text-align:center;">
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-2);">Avg Engagement</div>
          ${avgEng ? `
            <div style="font-size:1.5rem;font-weight:700;color:var(--warning);">${'&#9733;'.repeat(Math.round(avgEng))}${'&#9734;'.repeat(5 - Math.round(avgEng))}</div>
            <div style="font-size:0.75rem;color:var(--ink-muted);">${avgEng}/5 (${engLabels[Math.round(avgEng)] || ''})</div>
          ` : `<div style="font-size:0.875rem;color:var(--ink-faint);">No ratings yet</div>`}
        </div>
        <div class="card" style="padding:var(--sp-5) var(--sp-6);">
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-2);">Recent Reflections</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2);font-size:0.75rem;">
            ${reflected.slice(0, 3).map(l => {
              const r = typeof l.reflection === 'object' ? l.reflection : {};
              const snippet = (r.whatWorked || r.freeform || '').slice(0, 50);
              return `<div style="color:var(--ink-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                <strong style="color:var(--ink);">${l.title?.slice(0, 20) || 'Untitled'}</strong>
                ${snippet ? `, ${snippet}...` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Notifications & Reminders ── */
function buildNotifications(classes, lessons, events) {
  const items = [];

  // Overdue reflections (taught 2+ days ago with no reflection)
  lessons.forEach(l => {
    if ((l.status === 'ready' || l.status === 'completed') && !l.reflection) {
      const age = Date.now() - (l.updatedAt || l.createdAt || 0);
      if (age > 2 * 86400000) {
        items.push({
          type: 'warning',
          icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
          text: `Reflection overdue for "${l.title || 'Untitled'}" (taught ${Math.floor(age / 86400000)}d ago)`,
          action: () => navigate(`/lessons/${l.id}`)
        });
      }
    }
  });

  // Draft lessons unfinished
  const drafts = lessons.filter(l => l.status === 'draft');
  if (drafts.length > 0) {
    items.push({
      type: 'info',
      icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
      text: `${drafts.length} draft lesson${drafts.length > 1 ? 's' : ''} unfinished`,
      action: () => navigate('/lessons')
    });
  }

  // Upcoming admin events with deadlines
  events.filter(e => e.status !== 'completed').forEach(ev => {
    const enabled = ev.tasks.filter(t => t.enabled);
    const done = enabled.filter(t => t.status === 'completed').length;
    if (enabled.length > 0 && done < enabled.length) {
      items.push({
        type: 'info',
        icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        text: `${ev.name}: ${done}/${enabled.length} tasks done${ev.date ? ' (due: ' + ev.date + ')' : ''}`,
        action: () => navigate('/admin')
      });
    }
  });

  // Classes without lessons
  const classesWithoutLessons = classes.filter(cls => !lessons.some(l => l.classId === cls.id));
  if (classesWithoutLessons.length > 0) {
    items.push({
      type: 'suggestion',
      icon: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      text: `${classesWithoutLessons.length} class${classesWithoutLessons.length > 1 ? 'es' : ''} with no linked lessons`,
      action: () => navigate('/lesson-planner')
    });
  }

  if (items.length === 0) return '';

  const typeStyles = {
    warning: { bg: 'var(--warning-light, #fef3c7)', border: 'var(--warning, #f59e0b)', color: 'var(--warning, #f59e0b)' },
    info: { bg: 'var(--info-light, #dbeafe)', border: 'var(--info, #3b82f6)', color: 'var(--info, #3b82f6)' },
    suggestion: { bg: 'var(--success-light, #d1fae5)', border: 'var(--success, #22c55e)', color: 'var(--success, #22c55e)' }
  };

  return items.slice(0, 5).map(item => {
    const s = typeStyles[item.type] || typeStyles.info;
    return `<div class="notification-item card card-hover card-interactive" style="padding:var(--sp-3) var(--sp-4);border-left:3px solid ${s.border};margin-bottom:var(--sp-2);display:flex;align-items:center;gap:var(--sp-3);cursor:pointer;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${s.color}" stroke-width="2" style="flex-shrink:0;">${item.icon}</svg>
      <span style="font-size:0.8125rem;color:var(--ink-secondary);flex:1;">${item.text}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');
}

/* ── Weekly Overview (populated async with TT data) ── */
function buildWeeklyOverview(teacherRow, lessons, classes) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  // Weekends still render the Mon–Fri grid (there is just no 'today' column);
  // only a non-teaching (N.A.) week has no timetable to draw.
  let weekType = pk?.weekType || null;
  if (!weekType) {
    const wt = getWeekTypeForDate(new Date());
    if (wt === 'Odd' || wt === 'Even') weekType = wt;
  }
  if (!weekType) {
    return noSchoolCard(isWeekendToday()
      ? 'No timetable this week &mdash; enjoy the breather.'
      : 'Non-teaching week &mdash; no timetable to preview.');
  }

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const today = new Date().getDay(); // 0=Sun, 1=Mon... (weekend → no highlight)
  const todayIdx = today >= 1 && today <= 5 ? today - 1 : -1;

  const dayColumns = days.map((day, idx) => {
    const periods = [];
    for (const p of periodsForDay(teacherRow, weekType, day)) {
      const col = periodCol(weekType, day, p);
      const val = teacherRow[col];
      if (val && val !== '0') {
        const parts = val.split(' / ');
        periods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
      }
    }
    const isToday = idx === todayIdx;
    const isPast = todayIdx >= 0 && idx < todayIdx;

    return `<div style="flex:1;min-width:0;${isToday ? 'background:var(--accent-light);border-radius:var(--radius-lg);' : ''}${isPast ? 'opacity:0.5;' : ''}">
      <div style="text-align:center;font-weight:700;font-size:0.75rem;color:${isToday ? 'var(--accent)' : 'var(--ink-muted)'};padding:var(--sp-2);text-transform:uppercase;letter-spacing:0.05em;">
        ${day}${isToday ? ' (Today)' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;padding:0 var(--sp-1);">
        ${periods.length === 0 ? '<div style="text-align:center;font-size:0.6875rem;color:var(--ink-faint);padding:var(--sp-2);">No classes</div>' :
          periods.map(s => `<div style="font-size:0.6875rem;padding:3px 6px;background:var(--surface);border:1px solid var(--border-light);border-radius:4px;text-align:center;">
            <div style="font-weight:600;color:var(--ink);">P${s.p} ${s.classCode}</div>
            <div style="color:var(--ink-faint);">${s.room}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  // Count teaching periods this week
  let totalPeriods = 0;
  days.forEach(day => {
    for (const p of periodsForDay(teacherRow, weekType, day)) {
      const col = periodCol(weekType, day, p);
      const val = teacherRow[col];
      if (val && val !== '0') totalPeriods++;
    }
  });

  return `
    <div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">${weekType} Week &middot; ${totalPeriods} teaching periods</div>
    <div style="display:flex;gap:var(--sp-2);overflow-x:auto;">
      ${dayColumns}
    </div>`;
}

/* ── Lesson Prep Checklist (for next/current lesson) ── */
function buildPrepChecklist(teacherRow, lessons, classes) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  if (!pk) {
    return noSchoolCard(isWeekendToday()
      ? 'No lessons to prep today &mdash; enjoy the breather.'
      : 'Non-teaching week &mdash; nothing on the prep list.');
  }
  const { dayStr, period, weekType, mins } = pk;

  // Find next upcoming lesson
  const allPeriods = [];
  for (const p of periodsForDay(teacherRow, weekType, dayStr)) {
    const col = periodCol(weekType, dayStr, p);
    const val = teacherRow[col];
    if (val && val !== '0') {
      const parts = val.split(' / ');
      allPeriods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
    }
  }

  const beforeSchool = mins < DAY_START_MIN;
  const nextLesson = allPeriods.find(s => beforeSchool ? true : (period !== null ? s.p >= period : false));
  if (!nextLesson) return '<div style="font-size:0.8125rem;color:var(--ink-muted);padding:var(--sp-2);">No upcoming lessons today. You\'re all set!</div>';

  // Find matching class and lesson plan
  const matchingClass = classes.find(c => c.name === nextLesson.classCode || c.name?.includes(nextLesson.classCode));
  const linkedLesson = matchingClass ? lessons.find(l => l.classId === matchingClass.id && l.status === 'ready') : null;

  // Room/materials/tech checks are only actionable once there's a linked lesson
  // to persist state onto — they toggle via `linkedLesson.prepChecks.<key>` and
  // survive reloads that day (see the data-prep-toggle click wiring in render()).
  const prepChecks = linkedLesson?.prepChecks || {};
  const checks = [
    { label: 'Lesson plan prepared', done: !!linkedLesson, action: linkedLesson ? `/lesson-planner/${linkedLesson.id}` : '/lesson-planner' },
    { label: `Room ${nextLesson.room} ready`, done: !!prepChecks.roomReady, action: null, prepKey: 'roomReady' },
    { label: 'Materials / handouts printed', done: !!prepChecks.materialsReady, action: null, prepKey: 'materialsReady' },
    { label: 'Tech / simulation tested', done: !!prepChecks.techTested, action: linkedLesson?.components?.simulations ? '/simulations' : null, prepKey: 'techTested' },
    { label: 'Spatial layout configured', done: !!linkedLesson?.spatialLayout, action: '/spatial' },
  ];

  return `
    <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);">
      Next: P${nextLesson.p} | ${nextLesson.classCode} in ${nextLesson.room}
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      ${checks.map(c => {
        if (c.prepKey && !linkedLesson) {
          // Nothing to attach state to yet — show honestly as disabled rather
          // than a fake checkbox that can never be checked.
          return `<div class="prep-check-item" style="display:flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;opacity:0.6;">
            <div style="width:18px;height:18px;border-radius:4px;border:2px solid var(--border, #d1d5db);background:transparent;flex-shrink:0;"></div>
            <span style="color:var(--ink-secondary);">${c.label} <span style="color:var(--ink-faint);font-size:0.75rem;">&mdash; link a lesson plan first</span></span>
          </div>`;
        }
        const openLink = (c.prepKey && c.action) ? `<a href="#" class="prep-check-open-link" data-action-route="${c.action}" title="Open simulations" style="margin-left:auto;flex-shrink:0;color:var(--ink-faint);display:flex;align-items:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>` : '';
        const clickable = !!(c.prepKey || c.action);
        const dataAttrs = c.prepKey
          ? `data-prep-toggle="${c.prepKey}" data-lesson-id="${linkedLesson.id}"`
          : (c.action ? `data-action-route="${c.action}"` : '');
        return `<div class="prep-check-item" style="display:flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;${clickable ? 'cursor:pointer;' : ''}" ${dataAttrs}>
        <div style="width:18px;height:18px;border-radius:4px;border:2px solid ${c.done ? 'var(--success, #22c55e)' : 'var(--border, #d1d5db)'};background:${c.done ? 'var(--success, #22c55e)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${c.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
        <span style="color:${c.done ? 'var(--success, #22c55e)' : 'var(--ink-secondary)'};${c.done ? 'text-decoration:line-through;' : ''}">${c.label}</span>
        ${openLink}
      </div>`;
      }).join('')}
    </div>`;
}

/* ══════════ WS-A: "Your next lesson" anticipatory surface ══════════
 * The first thing the teacher sees: the class they are walking into next,
 * with one-tap ways to open its plan, present it, or (when nothing is linked
 * yet) start planning it. HARD PRINCIPLE — teacher LEADS: this only ever
 * renders tappable suggestions; it NEVER calls navigate() on its own. */

/* Generalised class name-match (the same rule buildPrepChecklist uses): a
 * class whose name equals the timetable class code, or contains it. */
function matchClassByCode(classes, classCode) {
  if (!classCode) return null;
  return (classes || []).find(c => c.name === classCode || c.name?.includes(classCode)) || null;
}

/* Best lesson to surface for a class: prefer a 'ready' one (most recent),
 * else the most-recently-touched lesson that isn't completed (NOT only
 * 'ready'). Returns null when the class has no such lesson. */
function bestLessonForClass(lessons, classId) {
  if (!classId) return null;
  const byRecent = (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
  const forClass = (lessons || []).filter(l => l.classId === classId);
  const ready = forClass.filter(l => l.status === 'ready').sort(byRecent);
  if (ready.length) return ready[0];
  const active = forClass.filter(l => l.status !== 'completed').sort(byRecent);
  return active[0] || null;
}

/* A calm, non-actionable line for free periods / after school / weekends. */
function nextLessonCalmLine(message) {
  return `<div class="card next-lesson-card" style="margin-bottom:var(--sp-5);padding:var(--sp-3) var(--sp-4);display:flex;align-items:center;gap:var(--sp-3);">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    <span style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">${escapeHtml(message)}</span>
  </div>`;
}

function buildNextLessonCard(teacherRow, lessons, classes) {
  const pk = getTTPeriodKey();
  // Weekend / non-teaching week — a calm line, independent of the timetable row.
  if (!pk) {
    return nextLessonCalmLine(isWeekendToday()
      ? 'No lessons today — enjoy the breather.'
      : 'Non-teaching week — no classes scheduled today.');
  }
  if (!teacherRow) return ''; // No timetable row for this teacher — nothing to anticipate.

  const { dayStr, period, weekType } = pk;

  // Today's teaching periods (same parse as buildPrepChecklist).
  const allPeriods = [];
  for (const p of periodsForDay(teacherRow, weekType, dayStr)) {
    const val = teacherRow[periodCol(weekType, dayStr, p)];
    if (val && val !== '0') {
      const parts = val.split(' / ');
      allPeriods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
    }
  }

  // Next upcoming class today. period === null means no teaching period has
  // started yet (before school / the 07:30 form window) → first class today.
  const noPeriodYet = period === null;
  const nextLesson = allPeriods.find(s => noPeriodYet || s.p >= period);
  if (!nextLesson) {
    return nextLessonCalmLine(allPeriods.length
      ? 'No more classes today — a good window to plan or reflect.'
      : 'No classes on your timetable today.');
  }

  const matchingClass = matchClassByCode(classes, nextLesson.classCode);
  const lesson = matchingClass ? bestLessonForClass(lessons, matchingClass.id) : null;
  const canPresent = !!(lesson && lesson.runOfShow && Array.isArray(lesson.runOfShow.segments) && lesson.runOfShow.segments.length);
  const timeStr = fmtClockShort(periodStartMin(nextLesson.p));
  const whenKicker = noPeriodYet ? 'First class today' : (nextLesson.p === period ? 'On now' : 'Next class');

  // CTAs — tappable suggestions only (wired to navigate on click in render()).
  let ctas = '';
  if (lesson) {
    ctas += `<button class="btn btn-sm btn-primary next-lesson-cta" data-nl-action="open" data-nl-lesson="${escapeHtml(lesson.id)}" style="white-space:nowrap;">Open plan</button>`;
    if (canPresent) {
      ctas += `<button class="btn btn-sm btn-secondary next-lesson-cta" data-nl-action="present" data-nl-lesson="${escapeHtml(lesson.id)}" style="white-space:nowrap;">Present</button>`;
    }
  } else {
    // No lesson linked — offer to plan it (prefilling the class when we have one).
    ctas += `<button class="btn btn-sm btn-primary next-lesson-cta" data-nl-action="plan" data-nl-class="${escapeHtml(matchingClass?.id || '')}" style="white-space:nowrap;">Plan it</button>`;
  }

  const detail = lesson
    ? escapeHtml(lesson.title || 'Untitled lesson')
    : (matchingClass ? 'No plan linked to this class yet.' : 'This class isn’t set up in Co-Cher yet.');

  return `
    <div class="card next-lesson-card" style="margin-bottom:var(--sp-5);padding:var(--sp-4) var(--sp-5);border-left:4px solid var(--marker,#FFE200);background:var(--surface,#fff);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
        <div style="min-width:0;">
          <div style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-muted);margin-bottom:2px;">${whenKicker}</div>
          <div style="font-size:1.0625rem;font-weight:700;color:var(--ink);overflow-wrap:anywhere;">
            ${escapeHtml(nextLesson.classCode || 'Class')} <span style="color:var(--ink-faint);font-weight:600;">&middot; P${nextLesson.p}${timeStr ? ' at ' + timeStr : ''}${nextLesson.room ? ' &middot; ' + escapeHtml(nextLesson.room) : ''}</span>
          </div>
          <div style="font-size:0.875rem;color:${lesson ? 'var(--ink-secondary)' : 'var(--ink-faint)'};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${detail}</div>
        </div>
        <div style="display:flex;gap:var(--sp-2);flex-shrink:0;flex-wrap:wrap;">
          ${ctas}
        </div>
      </div>
    </div>`;
}

/* Wire the next-lesson card's CTAs. Navigation happens ONLY here, on an
 * explicit tap — the card never navigates on its own. */
function wireNextLessonCard(scopeEl) {
  scopeEl.querySelectorAll('.next-lesson-cta').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.nlAction;
      const lessonId = btn.dataset.nlLesson;
      if (action === 'open' && lessonId) {
        navigate(`/lesson-planner/${lessonId}`);
      } else if (action === 'present' && lessonId) {
        navigate(`/present/${lessonId}`);
      } else if (action === 'plan') {
        const clsId = btn.dataset.nlClass;
        if (clsId) {
          const cls = Store.getClasses().find(c => c.id === clsId);
          if (cls) {
            // Same handoff keys the lesson planner reads (cocher_plan_class_*).
            sessionStorage.setItem('cocher_plan_class_id', cls.id);
            sessionStorage.setItem('cocher_plan_class_name', cls.name || '');
            sessionStorage.setItem('cocher_plan_class_subject', cls.subject || '');
            sessionStorage.setItem('cocher_plan_class_level', cls.level || '');
          }
        }
        navigate('/lesson-planner');
      }
    });
  });
}

/* ══════════ WS-D: milestone OFFERS (teacher-led delight) ══════════
 * At gentle lifetime thresholds, surface ONE warm, dismissible offer to
 * revisit growth. Never auto-navigates. Dismissal (or acting on it) persists
 * per-threshold so each milestone shows at most once and never nags. Only the
 * single highest unseen, achieved milestone is shown at a time. */
const MILESTONES_SEEN_KEY = 'cocher_milestones_seen';

/* Ordered least → most significant; the highest achieved & unseen wins. */
const MILESTONES = [
  { key: 'presented-1',    stat: 'lessonsPresented', n: 1,  headline: 'You presented your first lesson on the class screen.', note: 'The first of many.' },
  { key: 'created-10',     stat: 'lessonsCreated',   n: 10, headline: 'You&rsquo;ve designed 10 lessons with Co-Cher.',        note: 'A real body of work is taking shape.' },
  { key: 'reflections-10', stat: 'reflectionsCount', n: 10, headline: 'You&rsquo;ve written 10 lesson reflections.',           note: 'Closing the loop, lesson after lesson.' },
  { key: 'presented-10',   stat: 'lessonsPresented', n: 10, headline: 'You&rsquo;ve presented 10 lessons.',                    note: 'That&rsquo;s real craft.' },
  { key: 'reflections-25', stat: 'reflectionsCount', n: 25, headline: 'You&rsquo;ve written 25 reflections.',                  note: 'Deliberate practice, made visible.' },
  { key: 'presented-25',   stat: 'lessonsPresented', n: 25, headline: 'You&rsquo;ve presented 25 lessons.',                    note: 'Your students have felt every one.' },
  { key: 'created-50',     stat: 'lessonsCreated',   n: 50, headline: 'You&rsquo;ve designed 50 lessons.',                     note: 'A remarkable library of your own making.' },
  { key: 'presented-50',   stat: 'lessonsPresented', n: 50, headline: 'You&rsquo;ve presented 50 lessons.',                    note: 'Fifty times you&rsquo;ve brought a room to life.' },
];

function getMilestonesSeen() {
  try {
    const raw = localStorage.getItem(MILESTONES_SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
function markMilestoneSeen(key) {
  if (!key) return;
  const seen = getMilestonesSeen();
  seen.add(key);
  try { localStorage.setItem(MILESTONES_SEEN_KEY, JSON.stringify([...seen])); } catch {}
}

/* The single highest unseen, achieved milestone — or null. */
function pickMilestone(stats) {
  const seen = getMilestonesSeen();
  let pick = null;
  for (const m of MILESTONES) {
    if (!seen.has(m.key) && (stats?.[m.stat] || 0) >= m.n) pick = m; // last match = highest
  }
  return pick;
}

function buildMilestoneOffer(stats) {
  const m = pickMilestone(stats);
  if (!m) return '';
  // headline/note are static, hand-authored HTML (safe entities) — not escaped.
  return `
    <div class="card milestone-offer" data-milestone-key="${escapeHtml(m.key)}" style="margin-bottom:var(--sp-5);padding:var(--sp-4) var(--sp-5);border-left:4px solid var(--growth,#2c7a4b);background:var(--growth-light,#e2f2e8);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
        <div style="min-width:0;display:flex;align-items:center;gap:var(--sp-3);">
          <span style="font-size:1.4rem;flex-shrink:0;line-height:1;" aria-hidden="true">&#127881;</span>
          <div style="min-width:0;">
            <div style="font-size:0.9375rem;font-weight:700;color:var(--growth,#2c7a4b);">${m.headline}</div>
            <div style="font-size:0.8125rem;color:var(--ink-secondary);margin-top:1px;">${m.note}</div>
          </div>
        </div>
        <div style="display:flex;gap:var(--sp-2);flex-shrink:0;">
          <button class="btn btn-sm milestone-growth" style="background:var(--growth,#2c7a4b);color:#fff;border:none;font-weight:700;white-space:nowrap;">See my growth &rarr;</button>
          <button class="btn btn-ghost btn-sm milestone-dismiss" style="color:var(--ink-muted);">Dismiss</button>
        </div>
      </div>
    </div>`;
}

/* ══════════ Mobile widget reorder (touch) ══════════
 * The HTML5 drag reorder is dead on touch, so under isTouch() each reorderable
 * widget gains ▲/▼ buttons (see widgetWrap). They move the widget within the
 * very same widgetOrder pref the drag writes, then re-render. Non-touch keeps
 * drag untouched (the buttons are simply never emitted). */
function reorderParentEl(container) {
  return container.querySelector('#calm-more-container') || container.querySelector('.page-container');
}

function moveWidget(container, wId, dir) {
  const parent = reorderParentEl(container);
  if (!parent || !wId) return;
  // Visible, top-level reorderable widgets in current DOM order (deduped —
  // async widgets nest a duplicate .dashboard-widget inside their placeholder,
  // but only the placeholder is a direct child here).
  const ids = [];
  const seen = new Set();
  [...parent.children].forEach(el => {
    if (el.matches && el.matches('.dashboard-widget[data-widget-id]')) {
      const id = el.dataset.widgetId;
      if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
    }
  });
  const idx = ids.indexOf(wId);
  if (idx < 0) return;
  const target = dir === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= ids.length) return; // already at an edge
  [ids[idx], ids[target]] = [ids[target], ids[idx]];
  const p = getDashPrefs();
  p.widgetOrder = ids;
  saveDashPrefs(p);
  render(container);
}

/* ── Pinned Links bar ── */
function renderPinnedLinks(pinnedIds) {
  if (!pinnedIds || pinnedIds.length === 0) return '';
  const links = pinnedIds.map(id => PINNABLE_ACTIONS.find(a => a.id === id)).filter(Boolean);
  if (links.length === 0) return '';

  return `
    <div style="margin-bottom:var(--sp-6);">
      <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
        <span class="text-overline" style="font-size:0.6875rem;color:var(--ink-faint);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Pinned</span>
      </div>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
        ${links.map(l => `
          <button class="btn btn-ghost btn-sm pinned-link" data-route="${l.route}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--radius-lg);font-size:0.8125rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${l.icon}</svg>
            ${l.label}
          </button>
        `).join('')}
      </div>
    </div>`;
}

/* ── Customise Dashboard Modal ── */
function showCustomiseModal(container) {
  const prefs = getDashPrefs();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:200;';

  const widgetOrder = prefs.widgetOrder.length > 0 ? prefs.widgetOrder : [...DEFAULT_WIDGET_ORDER];
  // Ensure all widgets are in the order list
  DEFAULT_WIDGET_ORDER.forEach(w => { if (!widgetOrder.includes(w)) widgetOrder.push(w); });

  overlay.innerHTML = `
    <div style="background:var(--surface, #fff);color:var(--ink);padding:var(--sp-6);border-radius:var(--radius-xl, 1rem);box-shadow:var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.1));width:90%;max-width:500px;max-height:80vh;overflow:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-5);">
        <h3 style="font-size:1.125rem;font-weight:700;margin:0;color:var(--ink);">Customise Dashboard</h3>
        <button class="btn btn-ghost btn-sm modal-close" style="padding:4px 8px;color:var(--ink-muted);">&times;</button>
      </div>

      <div style="margin-bottom:var(--sp-5);">
        <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:var(--sp-3);color:var(--ink);">Show / Hide Widgets</h4>
        <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Toggle which sections appear on your dashboard. Drag to reorder.</p>
        <div id="widget-toggle-list" style="display:flex;flex-direction:column;gap:var(--sp-2);">
          ${widgetOrder.map(wId => {
            const visible = !prefs.hiddenWidgets.includes(wId);
            return `<div class="widget-toggle-row" data-widget="${wId}" draggable="true" style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);border:1px solid var(--border-light);border-radius:var(--radius);cursor:grab;background:var(--surface-hover, rgba(0,0,0,0.02));">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;cursor:grab;"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              <label style="flex:1;font-size:0.8125rem;font-weight:500;color:var(--ink);cursor:pointer;display:flex;align-items:center;gap:var(--sp-2);">
                <input type="checkbox" class="widget-vis-toggle" data-widget="${wId}" ${visible ? 'checked' : ''} />
                ${getWidgetLabel(wId, prefs)}
              </label>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div style="margin-bottom:var(--sp-5);">
        <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:var(--sp-3);color:var(--ink);">Dashboard View Mode</h4>
        <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Choose how much to show on your dashboard.</p>
        <div style="display:flex;gap:var(--sp-2);">
          ${['full', 'compact', 'minimal'].map(v => {
            const labels = { full: 'Full', compact: 'Compact', minimal: 'Minimal' };
            const descs = { full: 'All widgets', compact: 'Key widgets only', minimal: 'Just the essentials' };
            const active = (prefs.defaultView || 'full') === v;
            return `<label style="flex:1;display:block;text-align:center;padding:var(--sp-3);border:2px solid ${active ? 'var(--accent)' : 'var(--border-light)'};border-radius:var(--radius);cursor:pointer;background:${active ? 'var(--accent-light, rgba(99,102,241,0.08))' : 'transparent'};">
              <input type="radio" name="dash-view-mode" value="${v}" ${active ? 'checked' : ''} style="display:none;" />
              <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${labels[v]}</div>
              <div style="font-size:0.6875rem;color:var(--ink-muted);margin-top:2px;">${descs[v]}</div>
            </label>`;
          }).join('')}
        </div>
      </div>

      <div style="margin-bottom:var(--sp-5);">
        <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:var(--sp-3);color:var(--ink);">Rename Widgets</h4>
        <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Give widgets custom names. Leave blank to use the default.</p>
        <div id="widget-rename-list" style="display:flex;flex-direction:column;gap:var(--sp-2);max-height:180px;overflow:auto;">
          ${widgetOrder.map(wId => {
            const customName = (prefs.widgetNames && prefs.widgetNames[wId]) || '';
            return `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="font-size:0.75rem;color:var(--ink-muted);width:130px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${WIDGET_LABELS[wId] || wId}">${WIDGET_LABELS[wId] || wId}</span>
              <input type="text" class="widget-name-input input" data-widget="${wId}" value="${customName}" placeholder="${WIDGET_LABELS[wId] || wId}" style="flex:1;font-size:0.75rem;padding:4px 8px;" />
            </div>`;
          }).join('')}
        </div>
      </div>

      <div style="margin-bottom:var(--sp-5);">
        <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:var(--sp-3);color:var(--ink);">Pinned Quick Links</h4>
        <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Choose shortcuts to pin at the top of your dashboard.</p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
          ${PINNABLE_ACTIONS.map(a => {
            const pinned = prefs.pinnedLinks.includes(a.id);
            return `<label class="pin-toggle" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid ${pinned ? 'var(--accent)' : 'var(--border-light)'};border-radius:var(--radius-full, 999px);font-size:0.75rem;cursor:pointer;color:var(--ink);background:${pinned ? 'var(--accent-light)' : 'transparent'};">
              <input type="checkbox" class="pin-cb" data-pin="${a.id}" ${pinned ? 'checked' : ''} style="display:none;" />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${a.icon}</svg>
              ${a.label}
            </label>`;
          }).join('')}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:var(--sp-2);">
        <button class="btn btn-ghost btn-sm" id="reset-dash-prefs">Reset to Default</button>
        <button class="btn btn-primary btn-sm" id="save-dash-prefs">Save & Apply</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Drag-and-drop reorder
  const list = overlay.querySelector('#widget-toggle-list');
  let dragSrc = null;
  list.querySelectorAll('.widget-toggle-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      row.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => { row.style.opacity = '1'; });
    row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc && dragSrc !== row) {
        const parent = row.parentNode;
        const rows = [...parent.children];
        const srcIdx = rows.indexOf(dragSrc);
        const tgtIdx = rows.indexOf(row);
        if (srcIdx < tgtIdx) row.after(dragSrc);
        else row.before(dragSrc);
      }
    });
  });

  // Close
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Pin toggle styling
  overlay.querySelectorAll('.pin-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const label = cb.closest('.pin-toggle');
      if (cb.checked) {
        label.style.borderColor = 'var(--accent)';
        label.style.background = 'var(--accent-light)';
      } else {
        label.style.borderColor = 'var(--border-light)';
        label.style.background = 'transparent';
      }
    });
  });

  // Reset
  overlay.querySelector('#reset-dash-prefs').addEventListener('click', () => {
    saveDashPrefs({
      widgetOrder: [...DEFAULT_WIDGET_ORDER],
      hiddenWidgets: [],
      collapsedWidgets: [],
      pinnedLinks: [],
      defaultView: 'full',
      widgetNames: {},
      widgetSizes: {},
      layoutStyle: prefs.layoutStyle, // owned by Settings; never reset here
      calmMoreOpen: false,
      calmPanelSwap: prefs.calmPanelSwap
    });
    overlay.remove();
    render(container);
  });

  // View mode radio styling
  overlay.querySelectorAll('input[name="dash-view-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      overlay.querySelectorAll('input[name="dash-view-mode"]').forEach(r => {
        const lbl = r.closest('label');
        if (r.checked) {
          lbl.style.borderColor = 'var(--accent)';
          lbl.style.background = 'var(--accent-light, rgba(99,102,241,0.08))';
        } else {
          lbl.style.borderColor = 'var(--border-light)';
          lbl.style.background = 'transparent';
        }
      });
    });
  });

  // Save
  overlay.querySelector('#save-dash-prefs').addEventListener('click', () => {
    const newOrder = [...list.querySelectorAll('.widget-toggle-row')].map(r => r.dataset.widget);
    const hidden = [];
    overlay.querySelectorAll('.widget-vis-toggle').forEach(cb => {
      if (!cb.checked) hidden.push(cb.dataset.widget);
    });
    const pins = [];
    overlay.querySelectorAll('.pin-cb').forEach(cb => {
      if (cb.checked) pins.push(cb.dataset.pin);
    });
    // Collect view mode
    const viewRadio = overlay.querySelector('input[name="dash-view-mode"]:checked');
    const viewMode = viewRadio ? viewRadio.value : 'full';
    // Collect custom widget names
    const names = {};
    overlay.querySelectorAll('.widget-name-input').forEach(inp => {
      const val = inp.value.trim();
      if (val) names[inp.dataset.widget] = val;
    });
    saveDashPrefs({
      widgetOrder: newOrder,
      hiddenWidgets: hidden,
      collapsedWidgets: prefs.collapsedWidgets || [],
      pinnedLinks: pins,
      defaultView: viewMode,
      widgetNames: names,
      widgetSizes: prefs.widgetSizes || {},
      layoutStyle: prefs.layoutStyle, // owned by Settings; pass through untouched
      calmMoreOpen: prefs.calmMoreOpen,
      calmPanelSwap: prefs.calmPanelSwap
    });
    overlay.remove();
    render(container);
  });
}

/* ── Widget size helpers ── */
const WIDGET_SIZE_STYLES = {
  small:  'max-width:400px;',
  medium: '',
  large:  ''
};

function getSizeIcon(size) {
  if (size === 'small') return '<rect x="6" y="6" width="12" height="12" rx="1" stroke-width="2" fill="none" stroke="currentColor"/>';
  if (size === 'large') return '<rect x="2" y="2" width="20" height="20" rx="1" stroke-width="2" fill="none" stroke="currentColor"/>';
  return '<rect x="4" y="4" width="16" height="16" rx="1" stroke-width="2" fill="none" stroke="currentColor"/>';
}

const SIZE_CYCLE = { small: 'medium', medium: 'large', large: 'small' };

/* ── Collapsible widget wrapper ── */
function widgetWrap(id, title, content, prefs, extraHeaderHtml = '') {
  if (!content) return '';
  if (prefs.hiddenWidgets.includes(id)) return '';
  const collapsed = prefs.collapsedWidgets.includes(id);
  const size = (prefs.widgetSizes && prefs.widgetSizes[id]) || 'medium';
  const sizeStyle = WIDGET_SIZE_STYLES[size] || '';
  return `<div class="dashboard-widget" data-widget-id="${id}" draggable="true" style="margin-bottom:var(--sp-6);${sizeStyle}">
    <details ${collapsed ? '' : 'open'}>
      <summary style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;margin-bottom:var(--sp-3);" class="widget-summary" data-widget-id="${id}">
        <h2 class="section-title" style="font-size:1.125rem;margin:0;">${title}</h2>
        <div style="display:flex;align-items:center;gap:var(--sp-2);">
          ${extraHeaderHtml}
          ${isTouch() ? `<button class="btn-widget-move" data-widget-move="up" data-widget-id="${id}" title="Move up" aria-label="Move ${escapeHtml(title)} up" style="background:none;border:none;cursor:pointer;padding:2px;opacity:0.55;line-height:0;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="btn-widget-move" data-widget-move="down" data-widget-id="${id}" title="Move down" aria-label="Move ${escapeHtml(title)} down" style="background:none;border:none;cursor:pointer;padding:2px;opacity:0.55;line-height:0;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>` : ''}
          <button class="btn-widget-resize" data-resize-widget="${id}" title="Resize: ${size}" style="background:none;border:none;cursor:pointer;padding:2px;opacity:0.5;transition:opacity 0.15s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.5'">
            <svg width="14" height="14" viewBox="0 0 24 24">${getSizeIcon(size)}</svg>
          </button>
          <svg class="widget-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </summary>
      <div class="widget-body">${content}</div>
    </details>
  </div>`;
}

/* Render raw event dates (e.g. "2026-07-11") as "11 Jul" / "11 Jul 2027" */
function fmtEventDate(raw) {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const opts = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-SG', opts);
}

/* ── Up Next hero: surface the single most actionable lesson ──
 * Priority: closest to the classroom first (ready → rehearsed → taught
 * needing reflection → drafts), most recently touched wins ties. */
const STAGE_PRIORITY = { ready: 0, rehearsed: 1, taught: 2, draft: 3 };

function buildUpNextHero(lessons, classes, calm = false) {
  /* calm=true swaps the navy gradient for a quiet white card with a
   * highlighter-yellow spine and a serif title (navy CTA, yellow text).
   * calm=false (classic) emits the original markup byte-for-byte. */
  const cardStyle = calm
    ? 'margin-bottom:var(--sp-5);padding:var(--sp-5);cursor:pointer;background:var(--surface,#fff);color:var(--ink);border:1px solid var(--border-light,#e5e7eb);border-left:4px solid var(--marker,#FFE200);'
    : 'margin-bottom:var(--sp-5);padding:var(--sp-5);cursor:pointer;background:linear-gradient(135deg,var(--brand-navy,#000C53),#1e3a8a);color:#fff;border:none;';
  const kickerStyle = calm
    ? 'font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-muted);margin-bottom:4px;'
    : 'font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;opacity:0.7;margin-bottom:4px;';
  const subStyle = calm
    ? 'font-size:0.8125rem;color:var(--ink-muted);margin-top:2px;'
    : 'font-size:0.8125rem;opacity:0.75;margin-top:2px;';
  const ctaStyle = calm
    ? 'background:var(--brand-navy,#000C53);color:var(--brand-yellow,#FFE200);font-weight:700;border:none;'
    : 'background:var(--brand-yellow,#FFE200);color:var(--brand-navy,#000C53);font-weight:700;border:none;';
  const titlePlain = calm
    ? 'font-family:var(--font-serif, Georgia, serif);font-size:1.25rem;font-weight:600;'
    : 'font-size:1rem;font-weight:600;';
  const titleTrunc = calm
    ? 'font-family:var(--font-serif, Georgia, serif);font-size:1.25rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
    : 'font-size:1rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

  const active = (lessons || []).filter(l => lessonStage(l) !== 'reflected');
  if (active.length === 0) {
    return `
      <div class="card up-next-hero" data-hero-route="/lesson-planner" style="${cardStyle}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
          <div>
            <div style="${kickerStyle}">Up next</div>
            <div style="${titlePlain}">Design your first lesson with Co-Cher</div>
            <div style="${subStyle}">Chat through an idea and the plan builds itself alongside.</div>
          </div>
          <span class="btn btn-sm" style="${ctaStyle}">Open Lesson Planner &rarr;</span>
        </div>
      </div>`;
  }
  const pick = [...active].sort((a, b) => {
    const pa = STAGE_PRIORITY[lessonStage(a)] ?? 4;
    const pb = STAGE_PRIORITY[lessonStage(b)] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  })[0];
  const stage = lessonStage(pick);
  const stageLabel = (LIFECYCLE_STAGES.find(s => s.key === stage) || {}).label || stage;
  const next = lessonNextStep(pick);
  const cls = pick.classId ? (classes || []).find(c => c.id === pick.classId) : null;
  return `
    <div class="card up-next-hero" data-hero-route="/lessons/${pick.id}" style="${cardStyle}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-4);flex-wrap:wrap;">
        <div style="min-width:0;">
          <div style="${kickerStyle}">Up next &middot; ${stageLabel}</div>
          <div style="${titleTrunc}">${escapeHtml(pick.title || 'Untitled Lesson')}</div>
          <div style="${subStyle}">${cls ? escapeHtml(cls.name) + ' &middot; ' : ''}${active.length > 1 ? `${active.length - 1} more lesson${active.length > 2 ? 's' : ''} in the pipeline` : 'Your only lesson in progress'}</div>
        </div>
        <button class="btn btn-sm" id="up-next-cta" data-lesson-id="${pick.id}" data-action="${next.action}" style="${ctaStyle}white-space:nowrap;">${next.label}</button>
      </div>
    </div>`;
}

/* ═══════════════════════ CALM LAYOUT (default) ═══════════════════════
 * A quieter, editorial dashboard: serif greeting, restyled Up-Next hero,
 * a day ribbon of periods, two panels (this week's lessons / worth a look),
 * and a "More" toggle that reveals the full classic widget grid.
 * The classic layout path below is untouched and selected via
 * prefs.layoutStyle === 'classic'. */

/* Scoped styles for the calm layout. Injected once inside the calm markup
 * (style elements added via innerHTML are applied by browsers). */
const CALM_STYLE_BLOCK = `
  <style>
    .calm-two-col { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:var(--sp-5); align-items:start; }
    @media (max-width: 760px) { .calm-two-col { grid-template-columns:minmax(0,1fr); } }
    .calm-panel-label { font-variant:small-caps; letter-spacing:0.08em; font-size:0.875rem; font-weight:700; color:var(--ink-muted); margin-bottom:var(--sp-3); }
    .calm-hl { background:linear-gradient(transparent 55%, var(--marker-wash,#FFF9C9) 55%); padding:0 2px; }
    .calm-lesson-row:hover { background:var(--bg-subtle,#f7f7f8); }
    .calm-lesson-row:last-child { border-bottom:none !important; }
    /* Shrink the shared status banner markup without touching its builder */
    .calm-status-banner > div { padding:var(--sp-3) var(--sp-4) !important; margin-bottom:var(--sp-5) !important; }
    .calm-status-banner div { font-size:0.8125rem !important; }
    .calm-status-banner > div > div:first-child { width:32px !important; height:32px !important; }
    .calm-status-banner svg { width:16px; height:16px; }
  </style>`;

/* First line of the calm greeting: day- and time-aware, e.g.
 * "Friday, before Period 3." Falls back to a plain greeting on weekends
 * or non-teaching weeks. */
function calmHeadline(firstName) {
  const pk = getTTPeriodKey();
  if (!pk) return `${getGreeting()}, ${firstName}.`;
  const dayFull = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }[pk.dayStr] || pk.dayStr;
  if (pk.mins < periodStartMin(1)) return `${dayFull}, before Period 1.`;
  // "After school" = past the end of the last teaching period. Sourced from the
  // canonical PERIOD_START_MIN table (via periodEndMin) rather than a magic cutoff.
  const lastPeriod = TEACHING_PERIODS[TEACHING_PERIODS.length - 1];
  if (pk.mins >= periodEndMin(lastPeriod)) return `${dayFull}, after school.`;
  if (pk.period) {
    // Within 10 minutes of the next period's start, phrase it as "before Pn".
    // Both the next period and its start time come from the canonical table/order
    // so the boundary matches every other period calc in the file.
    const idx = TEACHING_PERIODS.indexOf(pk.period);
    const nextP = (idx >= 0 && idx < TEACHING_PERIODS.length - 1) ? TEACHING_PERIODS[idx + 1] : null;
    const nextStart = nextP != null ? periodStartMin(nextP) : null;
    if (nextStart != null && nextStart - pk.mins > 0 && nextStart - pk.mins <= 10) {
      return `${dayFull}, before Period ${nextP}.`;
    }
    return `${dayFull}, Period ${pk.period}.`;
  }
  return `${getGreeting()}, ${firstName}.`;
}

/* One clause about lessons needing attention, derived from the lifecycle. */
function calmLessonAttentionText(lessons) {
  const active = (lessons || []).filter(l => lessonStage(l) !== 'reflected');
  const count = (stage) => active.filter(l => lessonStage(l) === stage).length;
  const ready = count('ready'), taught = count('taught'), drafts = count('draft');
  if (ready > 0) return ready === 1 ? 'one lesson still needs a rehearsal' : `${ready} lessons still need a rehearsal`;
  if (taught > 0) return taught === 1 ? 'one lesson is waiting on a reflection' : `${taught} lessons are waiting on a reflection`;
  if (drafts > 0) return drafts === 1 ? 'one draft is waiting to be finished' : `${drafts} drafts are waiting to be finished`;
  return 'your lesson pipeline is all clear';
}

/* Second line of the calm greeting: teaching load today + lesson attention.
 * Called sync with teacherRow=null for the placeholder, then again once the
 * async timetable resolves. Plain text (set via textContent). */
function calmOrientationText(teacherRow, lessons) {
  const lessonBit = calmLessonAttentionText(lessons);
  const pk = getTTPeriodKey();
  if (!pk) return `No school day today — ${lessonBit}.`;
  if (!teacherRow) return `No timetable found — ${lessonBit}.`;
  let n = 0;
  for (const p of periodsForDay(teacherRow, pk.weekType, pk.dayStr)) {
    const val = teacherRow[periodCol(pk.weekType, pk.dayStr, p)];
    if (val && val !== '0') n++;
  }
  const teachBit = n === 0 ? 'No teaching periods today'
    : n === 1 ? '1 teaching period today'
    : `${n} teaching periods today`;
  return `${teachBit} — ${lessonBit}.`;
}

/* Day ribbon: all 11 periods as small cards. Current period gets the
 * marker wash + NOW tag; past periods are dimmed. Same column parsing as
 * buildMyTimetable (periodCol → OddMonP01…). */
function buildCalmRibbon(teacherRow) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  if (!pk) return ''; // Weekend / non-teaching week
  const { dayStr, period, weekType } = pk;
  // A personal accent (when set) subtly tints teaching periods with a thin
  // underline — enough to feel personal, not garish. Validated to a hex so it's
  // safe to inline.
  const accent = getIdentity().personalAccent;
  const useAccent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(accent || '').trim());
  const cells = [];
  for (const p of periodsForDay(teacherRow, weekType, dayStr)) {
    const val = teacherRow[periodCol(weekType, dayStr, p)];
    const hasClass = val && val !== '0';
    const classCode = hasClass ? (val.split(' / ')[0] || '').trim() : '';
    const isNow = period === p;
    const isPast = period !== null && p < period;
    const nowTag = isNow
      ? '<span style="margin-left:4px;padding:0 4px;border-radius:3px;background:var(--brand-navy,#000C53);color:var(--brand-yellow,#FFE200);font-size:0.5rem;font-weight:700;vertical-align:1px;">NOW</span>'
      : '';
    // Subtle accent underline on class-bearing, non-current cells.
    const accentBar = (useAccent && hasClass && !isNow) ? `border-bottom:2px solid ${accent.trim()};` : '';
    cells.push(`<div style="flex:0 0 auto;min-width:64px;padding:6px 10px;border:1px solid ${isNow ? 'var(--marker,#FFE200)' : 'var(--border-light,#e5e7eb)'};border-radius:8px;background:${isNow ? 'var(--marker-wash,#FFF9C9)' : 'var(--surface,#fff)'};text-align:center;${accentBar}${isPast ? 'opacity:0.45;' : ''}">
      <div style="font-size:0.625rem;font-weight:700;color:var(--ink-muted);letter-spacing:0.04em;">P${p}${nowTag}</div>
      <div style="font-size:0.75rem;font-weight:${hasClass ? '600' : '400'};color:${hasClass ? 'var(--ink)' : 'var(--ink-faint)'};white-space:nowrap;">${hasClass ? escapeHtml(classCode) : 'Free'}</div>
    </div>`);
  }
  return `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">${cells.join('')}</div>`;
}

/* Left panel: up to 5 non-reflected lessons, lifecycle priority then
 * recency (same STAGE_PRIORITY ordering as the hero). */
function buildCalmWeekLessons(lessons, classes) {
  const active = (lessons || []).filter(l => lessonStage(l) !== 'reflected');
  const rows = [...active].sort((a, b) => {
    const pa = STAGE_PRIORITY[lessonStage(a)] ?? 4;
    const pb = STAGE_PRIORITY[lessonStage(b)] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  }).slice(0, 5);
  if (rows.length === 0) {
    return `<div style="font-size:0.8125rem;color:var(--ink-muted);padding:var(--sp-2) 0;">Nothing in flight. <a href="#/lesson-planner" style="color:var(--accent);">Plan a lesson &rarr;</a></div>`;
  }
  const stageColors = { draft: '#6b7280', ready: '#2563eb', rehearsed: '#7c3aed', taught: '#d97706' };
  return rows.map(l => {
    const stage = lessonStage(l);
    const stageLabel = (LIFECYCLE_STAGES.find(s => s.key === stage) || {}).label || stage;
    const cls = l.classId ? (classes || []).find(c => c.id === l.classId) : null;
    const color = stageColors[stage] || '#6b7280';
    return `<div class="calm-lesson-row" data-calm-lesson-id="${l.id}" style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) var(--sp-2);border-bottom:1px solid var(--border-light,#eee);border-radius:var(--radius,6px);cursor:pointer;">
      <div style="flex:1;min-width:0;font-weight:600;font-size:0.875rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(l.title || 'Untitled Lesson')}</div>
      ${cls ? `<span class="badge badge-blue" style="flex-shrink:0;font-size:0.625rem;">${escapeHtml(cls.name)}</span>` : ''}
      <span style="flex-shrink:0;padding:2px 8px;border-radius:999px;font-size:0.625rem;font-weight:700;background:${color}18;color:${color};">${stageLabel}</span>
    </div>`;
  }).join('');
}

/* Right panel: up to 3 short insight lines from real data — no AI calls. */
function buildCalmWorthALook(classes, lessons) {
  const items = [];

  // (a) Practice goal, if the Store method exists (may land in a parallel change)
  const goal = Store.getPracticeGoal?.();
  if (goal && goal.text) items.push(`Your focus: ${escapeHtml(goal.text)}`);

  // (b) Engagement dip: a class whose last 2 rated reflections are <= 2
  for (const cls of (classes || [])) {
    const rated = (lessons || [])
      .filter(l => l.classId === cls.id && l.reflection && typeof l.reflection === 'object' && (l.reflection.engagement || 0) > 0)
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    if (rated.length >= 2 && rated[0].reflection.engagement <= 2 && rated[1].reflection.engagement <= 2) {
      items.push(`${escapeHtml(cls.name)}&rsquo;s engagement dipped two lessons running &mdash; try a different layout?`);
      break;
    }
  }

  // (c) Draft nudge: oldest draft older than 7 days
  const staleDrafts = (lessons || [])
    .filter(l => l.status === 'draft')
    .map(l => ({ l, age: Date.now() - (l.updatedAt || l.createdAt || Date.now()) }))
    .filter(x => x.age > 7 * 86400000)
    .sort((a, b) => b.age - a.age);
  if (staleDrafts.length > 0 && items.length < 3) {
    const days = Math.floor(staleDrafts[0].age / 86400000);
    items.push(`&ldquo;${escapeHtml(staleDrafts[0].l.title || 'Untitled')}&rdquo; has been a draft for ${days} days &mdash; finish or archive?`);
  }

  // (d) Fallback tips to keep the panel from feeling empty
  const fallbacks = [
    'A quick reflection right after class captures details you’ll forget by evening.',
    'Rehearsing a lesson aloud once surfaces timing issues before the students do.',
    'Pin your most-used tools from the dashboard’s customise menu to save clicks.'
  ];
  for (const tip of fallbacks) {
    if (items.length >= 3) break;
    items.push(tip);
  }
  return items.slice(0, 3);
}

export function render(container) {
  const classes = Store.getClasses();
  const lessons = Store.getLessons();
  const activity = Store.getRecentActivity();
  const events = Store.get('adminEvents') || [];
  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0);

  const suggestions = buildSuggestions(classes, lessons, events);

  // Recent lessons (last 3 updated)
  const recentLessons = [...lessons]
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 3);

  // Admin events summary
  const pendingEvents = events.filter(e => e.status !== 'completed');
  const prefs = getDashPrefs();

  // Build notification content
  const notificationsContent = buildNotifications(classes, lessons, events);

  // Build widget content map (keyed by widget id)
  const suggestionsHTML = suggestions.length > 0 ? `
    <div class="stagger" style="display:flex;flex-direction:column;gap:var(--sp-3);">
      ${suggestions.map(s => `
        <div class="card card-hover card-interactive suggestion-card" style="padding:var(--sp-4) var(--sp-5);">
          <div style="display:flex;align-items:center;gap:var(--sp-4);">
            <div style="width:40px;height:40px;border-radius:var(--radius-lg);background:${s.bg};color:${s.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${s.icon}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;color:var(--ink);font-size:0.9375rem;">${s.title}</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);margin-top:2px;">${s.desc}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      `).join('')}
    </div>` : '';

  const quickActionsHTML = `
    <div class="grid-4 stagger">
      <div class="action-card" data-action="lesson-planner">
        <div class="action-card-icon" style="background: var(--accent-light); color: var(--accent);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </div>
        <div class="action-card-title">Lesson Planner</div>
        <div class="action-card-desc">Chat with Co-Cher to design engaging lessons</div>
      </div>
      <div class="action-card" data-action="spatial">
        <div class="action-card-icon" style="background: var(--success-light); color: var(--success);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        </div>
        <div class="action-card-title">Spatial Designer</div>
        <div class="action-card-desc">Arrange your classroom for optimal learning</div>
      </div>
      <div class="action-card" data-action="classes">
        <div class="action-card-icon" style="background: var(--warning-light); color: var(--warning);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="action-card-title">Manage Classes</div>
        <div class="action-card-desc">Add classes, students, and track E21CC growth</div>
      </div>
      <div class="action-card" data-action="admin">
        <div class="action-card-icon" style="background: var(--info-light); color: var(--info);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div class="action-card-title">Admin</div>
        <div class="action-card-desc">Events, RAMS, approvals & school operations</div>
      </div>
    </div>`;

  const statsHTML = `
    <div class="grid-4 stagger">
      <div class="stat-card">
        <div class="stat-label">Classes</div>
        <div class="stat-value">${classes.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Students</div>
        <div class="stat-value">${totalStudents}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Lessons</div>
        <div class="stat-value">${lessons.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Events</div>
        <div class="stat-value">${events.length}</div>
      </div>
    </div>`;

  const recentGridHTML = `
    <div class="grid-3">
      <!-- Recent Lessons -->
      <div>
        <div style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);">Recent Lessons
          ${lessons.length > 0 ? `<button class="btn btn-ghost btn-sm" data-action="lessons" style="float:right;">View all</button>` : ''}
        </div>
        ${recentLessons.length === 0 ? `
          <div class="card" style="text-align:center;padding:var(--sp-6);">
            <div style="opacity:0.3;margin-bottom:var(--sp-3);">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <p style="color:var(--ink-muted);font-size:0.8125rem;margin-bottom:var(--sp-3);">No lessons yet.</p>
            <button class="btn btn-primary btn-sm" data-action="lesson-planner">Start Planning</button>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
            ${recentLessons.map(l => {
              const statusBadge = l.status === 'completed' ? 'badge-green' : l.status === 'ready' ? 'badge-blue' : 'badge-gray';
              const statusLabel = l.status === 'completed' ? 'Done' : l.status === 'ready' ? 'Ready' : 'Draft';
              const linkedClass = l.classId ? classes.find(c => c.id === l.classId) : null;
              return `
                <div class="card card-hover card-interactive" data-lesson-id="${l.id}" style="padding:var(--sp-4) var(--sp-5);">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="min-width:0;flex:1;">
                      <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.title || 'Untitled'}</div>
                      <div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;">
                        ${linkedClass ? linkedClass.name + ' · ' : ''}${timeAgo(l.updatedAt || l.createdAt)}
                      </div>
                    </div>
                    <span class="badge ${statusBadge} badge-dot" style="flex-shrink:0;margin-left:var(--sp-2);">${statusLabel}</span>
                  </div>
                </div>`;
            }).join('')}
          </div>
        `}
      </div>
      <!-- Admin Events -->
      <div>
        <div style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);">Events
          <button class="btn btn-ghost btn-sm" data-action="admin" style="float:right;">Admin</button>
        </div>
        ${pendingEvents.length === 0 ? `
          <div class="card" style="text-align:center;padding:var(--sp-6);">
            <div style="opacity:0.3;margin-bottom:var(--sp-3);">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <p style="color:var(--ink-muted);font-size:0.8125rem;margin-bottom:var(--sp-3);">No upcoming events.</p>
            <button class="btn btn-primary btn-sm" data-action="admin">Plan an Event</button>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
            ${pendingEvents.slice(0, 3).map(ev => {
              const enabled = ev.tasks.filter(t => t.enabled);
              const done = enabled.filter(t => t.status === 'completed').length;
              const progress = enabled.length > 0 ? Math.round((done / enabled.length) * 100) : 0;
              return `
                <div class="card card-hover card-interactive" data-action="admin" style="padding:var(--sp-4) var(--sp-5);">
                  <div style="font-weight:600;color:var(--ink);font-size:0.875rem;margin-bottom:var(--sp-1);">${ev.name}</div>
                  <div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">${ev.eventType || 'Event'}${ev.date ? ' · ' + fmtEventDate(ev.date) : ''}</div>
                  <div style="display:flex;align-items:center;gap:var(--sp-2);">
                    <div style="flex:1;height:5px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                      <div style="width:${progress}%;height:100%;background:${progress === 100 ? 'var(--success)' : 'var(--accent)'};border-radius:var(--radius-full);transition:width 0.3s;"></div>
                    </div>
                    <span style="font-size:0.6875rem;color:var(--ink-muted);white-space:nowrap;">${done}/${enabled.length}</span>
                  </div>
                </div>`;
            }).join('')}
          </div>
        `}
      </div>
      <!-- Recent Activity -->
      <div>
        <div style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);">Activity</div>
        ${activity.length === 0 ? `
          <div class="card" style="text-align:center;padding:var(--sp-6);">
            <div style="opacity:0.3;margin-bottom:var(--sp-3);">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <p style="color:var(--ink-muted);font-size:0.8125rem;">Activity will appear here as you use Co-Cher.</p>
          </div>
        ` : `
          <div class="card" style="padding:0;">
            <div style="display:flex;flex-direction:column;">
              ${activity.slice(0, 6).map(a => `
                <div style="padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
                  <span style="font-size:0.8125rem;color:var(--ink-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${a.description}</span>
                  <span style="font-size:0.6875rem;color:var(--ink-faint);white-space:nowrap;margin-left:var(--sp-2);">${timeAgo(a.timestamp)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `}
      </div>
    </div>`;

  const classesHTML = classes.length === 0 ? `
    <div class="card" style="text-align:center;padding:var(--sp-8) var(--sp-6);">
      <div style="opacity:0.3;margin-bottom:var(--sp-3);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      </div>
      <p style="color:var(--ink-muted);font-size:0.875rem;margin-bottom:var(--sp-4);">No classes yet. Create your first class to get started.</p>
      <button class="btn btn-primary btn-sm" data-action="add-class">Create a Class</button>
    </div>
  ` : `
    <div class="grid-3 stagger">
      ${classes.slice(0, 6).map(cls => `
        <div class="card card-hover card-interactive" data-class-id="${cls.id}" style="padding:var(--sp-4) var(--sp-5);">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="font-weight:600;color:var(--ink);">${cls.name}</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);margin-top:2px;">
                ${[cls.level, cls.subject].filter(Boolean).join(' · ') || 'No details'}
              </div>
            </div>
            <span class="badge badge-blue">${cls.students?.length || 0} students</span>
          </div>
        </div>
      `).join('')}
    </div>`;

  // ── Activity Feed / Recent Work Resume Widget ──
  const activityFeedItems = [];
  // Gather recently updated lessons
  const sortedLessons = [...lessons].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  sortedLessons.slice(0, 3).forEach(l => {
    const linkedClass = l.classId ? classes.find(c => c.id === l.classId) : null;
    activityFeedItems.push({
      label: l.title || 'Untitled Lesson',
      detail: linkedClass ? linkedClass.name : (l.status === 'draft' ? 'Draft' : l.status || ''),
      ts: l.updatedAt || l.createdAt || 0,
      route: '/lesson-planner',
      routeParam: l.id,
      type: 'lesson'
    });
  });
  // Add recent activity log entries (non-lesson types)
  activity.slice(0, 5).forEach(a => {
    // Determine a sensible route based on activity type
    let route = '/';
    if (a.type === 'class_created' || a.type === 'class_deleted' || a.type === 'student_added') route = '/classes';
    else if (a.type === 'layout_saved') route = '/spatial';
    else if (a.type === 'routine_created') route = '/assessment/afl';
    else if (a.type === 'tos_saved' || a.type === 'checklist_created' || a.type === 'blueprint_created') route = '/assessment/afl';
    else if (a.type === 'stimulus_created' || a.type === 'source_created') route = '/knowledge';
    else if (a.type === 'scheme_created') route = '/knowledge';
    else if (a.type === 'lesson_created' || a.type === 'lesson_deleted') route = '/lessons';
    activityFeedItems.push({
      label: a.description || a.type,
      detail: '',
      ts: a.timestamp || 0,
      route,
      type: 'activity'
    });
  });
  // De-duplicate by label+type, sort by recency, take top 5
  const seenFeedKeys = new Set();
  const dedupedFeed = activityFeedItems
    .sort((a, b) => b.ts - a.ts)
    .filter(item => {
      const key = item.label + '|' + item.type;
      if (seenFeedKeys.has(key)) return false;
      seenFeedKeys.add(key);
      return true;
    })
    .slice(0, 5);

  const activityFeedHTML = dedupedFeed.length === 0
    ? `<div style="text-align:center;padding:var(--sp-6);color:var(--ink-muted);font-size:0.8125rem;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" style="display:block;margin:0 auto var(--sp-2);">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        No recent activity yet. Start planning a lesson or creating a class!
      </div>`
    : `<div style="display:flex;flex-direction:column;gap:2px;">
        ${dedupedFeed.map((item, i) => `
          <div class="card-hover card-interactive" data-feed-route="${item.route}" ${item.routeParam ? `data-feed-param="${item.routeParam}"` : ''} style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-3) var(--sp-4);border-radius:var(--radius);cursor:pointer;${i === 0 ? 'background:var(--accent-light);' : ''}">
            <div style="min-width:0;flex:1;">
              <div style="font-weight:${i === 0 ? '600' : '500'};color:var(--ink);font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${i === 0 ? 'You last worked on: ' : ''}${item.label}
              </div>
              <div style="font-size:0.75rem;color:var(--ink-muted);margin-top:1px;">
                ${item.detail ? item.detail + ', ' : ''}${item.ts ? timeAgo(item.ts) : ''}
              </div>
            </div>
            <span style="flex-shrink:0;margin-left:var(--sp-3);font-size:0.75rem;font-weight:600;color:var(--accent);white-space:nowrap;">
              ${i === 0 ? 'Resume &rarr;' : 'Open &rarr;'}
            </span>
          </div>
        `).join('')}
        <div style="text-align:center;margin-top:var(--sp-3);">
          <button class="btn btn-ghost btn-sm" data-action="view-all-activity" style="font-size:0.75rem;">View All Activity</button>
        </div>
      </div>`;

  // Widget content map: content for each widget that can be rendered synchronously
  const widgetContent = {
    schedule: '',       // populated async
    activityFeed: activityFeedHTML,
    notifications: notificationsContent,
    weeklyOverview: '', // populated async
    suggestions: suggestionsHTML,
    quickActions: quickActionsHTML,
    stats: statsHTML,
    prepChecklist: '',  // populated async
    studentSpotlight: totalStudents > 0 ? buildStudentSpotlight(classes) : '',
    insights: totalStudents > 0 ? renderInsights(classes, lessons) : '',
    reflections: renderReflectionAnalytics(lessons),
    recentGrid: recentGridHTML,
    timetable: '',      // populated async
    classes: classesHTML
  };

  // Build ordered widgets HTML; insights/reflections already have their own wrapper
  const widgetOrder = (prefs.widgetOrder.length > 0 ? prefs.widgetOrder : [...DEFAULT_WIDGET_ORDER]);
  // Ensure all default widgets appear
  DEFAULT_WIDGET_ORDER.forEach(w => { if (!widgetOrder.includes(w)) widgetOrder.push(w); });

  // Some widgets are async-populated; for those, use a placeholder div
  const asyncWidgets = new Set(['schedule', 'weeklyOverview', 'prepChecklist', 'timetable']);

  // Apply view mode: filter visible widgets for compact/minimal
  const appliedView = prefs.defaultView || 'full';
  const compactKeep = new Set(['schedule', 'activityFeed', 'quickActions', 'notifications', 'suggestions', 'stats']);
  const minimalKeep = new Set(['schedule', 'quickActions', 'notifications']);

  const widgetsHTML = widgetOrder.map(wId => {
    if (prefs.hiddenWidgets.includes(wId)) return '';
    // View mode filtering
    if (appliedView === 'compact' && !compactKeep.has(wId)) return '';
    if (appliedView === 'minimal' && !minimalKeep.has(wId)) return '';
    if (asyncWidgets.has(wId)) {
      // Async widgets get a placeholder that will be filled later
      return `<div id="widget-${wId}" class="dashboard-widget" data-widget-id="${wId}" draggable="true"></div>`;
    }
    // insights and reflections return their own section wrapper
    if (wId === 'insights' || wId === 'reflections') {
      return widgetContent[wId] || '';
    }
    const content = widgetContent[wId];
    if (!content) return '';
    return widgetWrap(wId, getWidgetLabel(wId, prefs), content, prefs);
  }).join('');

  // ── Layout branch: 'calm' (default) vs 'classic' (the original markup) ──
  const isCalm = prefs.layoutStyle !== 'classic';

  if (isCalm) {
    const firstName = getFirstName() || 'Cher';
    const ribbonSkeleton = Array.from({ length: 8 }).map(() =>
      '<div style="flex:0 0 auto;width:64px;height:46px;border-radius:8px;background:var(--bg-subtle,#f3f4f6);animation:pulse-soft 1.6s ease-in-out infinite;"></div>'
    ).join('');
    const worthItems = buildCalmWorthALook(classes, lessons);

    // A3.2 — a chosen mantra becomes the greeting sub-line (else the quiet
    // orientation line stands on its own).
    const calmMantra = getIdentity().chosenMantra;
    // A1.3 — fortnight cadence rollup (deliberate practice, not points).
    const loopN = loopClosedFortnight(lessons);
    const fortnightLine = loopN > 0
      ? `<div style="margin-top:var(--sp-2);font-size:0.8125rem;color:var(--growth,#2c7a4b);display:inline-flex;align-items:center;gap:6px;line-height:1.4;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="22 4 12 14.01 9 11.01"/></svg>You&rsquo;ve closed the loop on ${loopN} lesson${loopN !== 1 ? 's' : ''} in the last fortnight &mdash; steady, deliberate practice.</div>`
      : '';

    // A3.4 — the two calm panels, in a teacher-chosen order (persisted pref).
    const weekPanel = `
      <div class="card" style="padding:var(--sp-4) var(--sp-5);">
        <div class="calm-panel-label">This week&rsquo;s <span class="calm-hl">lessons</span></div>
        ${buildCalmWeekLessons(lessons, classes)}
      </div>`;
    const lookPanel = `
      <div class="card" style="padding:var(--sp-4) var(--sp-5);">
        <div class="calm-panel-label">Worth a <span class="calm-hl">look</span></div>
        ${worthItems.map(t => `
          <div style="display:flex;gap:var(--sp-2);padding:var(--sp-2) 0;font-size:0.8125rem;color:var(--ink-secondary);line-height:1.5;">
            <span style="width:7px;height:7px;border-radius:50%;background:var(--marker,#FFE200);border:1px solid var(--border,#d1d5db);margin-top:6px;flex-shrink:0;"></span>
            <span>${t}</span>
          </div>`).join('')}
      </div>`;
    const orderedPanels = prefs.calmPanelSwap ? [lookPanel, weekPanel] : [weekPanel, lookPanel];

    container.innerHTML = `
      <div class="main-scroll">
        <div class="page-container">
          ${CALM_STYLE_BLOCK}

          <!-- WS-A: anticipatory next-lesson surface (populated async; top of the fold) -->
          <div id="next-lesson-card"></div>

          <!-- Serif greeting (no card) with teacher monogram + optional mantra -->
          <div class="animate-fade-in-up" style="padding:var(--sp-2) 0 var(--sp-5);display:flex;align-items:flex-start;gap:var(--sp-3);">
            ${teacherMonogramHTML('avatar-lg')}
            <div style="min-width:0;flex:1;">
              <div style="font-family:var(--font-serif, Georgia, serif);font-size:1.5rem;font-weight:600;line-height:1.3;color:var(--ink);">${escapeHtml(calmHeadline(firstName))}</div>
              ${calmMantra ? `<div class="calm-mantra" style="margin-top:var(--sp-1);font-size:0.9375rem;font-style:italic;color:var(--ink-secondary);font-family:var(--font-serif, Georgia, serif);line-height:1.4;">${escapeHtml(calmMantra)}</div>` : ''}
              <div id="calm-orient" style="margin-top:var(--sp-2);font-size:0.875rem;color:var(--ink-muted);">Checking today&rsquo;s timetable &mdash; ${escapeHtml(calmLessonAttentionText(lessons))}.</div>
              ${fortnightLine}
            </div>
            <button class="btn btn-ghost btn-sm" id="customise-dashboard-btn" title="Customise your dashboard" style="flex-shrink:0;padding:6px;opacity:0.6;transition:opacity 0.15s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.6'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>

          <!-- WS-D: milestone offer (teacher-led delight; shown only at thresholds) -->
          ${buildMilestoneOffer(Store.getLifetimeStats())}

          <!-- Up Next hero, calm styling -->
          ${buildUpNextHero(lessons, classes, true)}

          <!-- Day ribbon (skeleton until the async timetable resolves) -->
          <div id="calm-ribbon" style="margin-bottom:var(--sp-4);">
            <div style="display:flex;gap:6px;overflow:hidden;">${ribbonSkeleton}</div>
          </div>

          <!-- Status banner (kept in calm; shrunk via .calm-status-banner) -->
          <div id="tt-status-banner" class="calm-status-banner"></div>

          <!-- Two-column: this week's lessons / worth a look (order is swappable) -->
          <div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:var(--sp-2);">
            <button class="btn btn-ghost btn-sm" id="calm-swap-panels" title="Swap the order of these two panels" style="font-size:0.6875rem;color:var(--ink-muted);padding:2px 8px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              Swap panels
            </button>
          </div>
          <div class="calm-two-col" style="margin-bottom:var(--sp-6);">
            ${orderedPanels.join('')}
          </div>

          <!-- Pinned Links (above More) -->
          ${renderPinnedLinks(prefs.pinnedLinks)}

          <!-- More: reveals the full classic widget grid below -->
          <div style="text-align:center;margin:var(--sp-4) 0 var(--sp-5);">
            <button class="btn btn-ghost btn-sm" id="calm-more-btn" style="padding:6px 18px;border:1px dashed var(--border,#d1d5db);border-radius:var(--radius-full,999px);color:var(--ink-muted);font-size:0.8125rem;">${prefs.calmMoreOpen ? 'Less &#9652;' : 'More &#9662;'}</button>
          </div>
          <div id="calm-more-container" style="${prefs.calmMoreOpen ? '' : 'display:none;'}">
            ${widgetsHTML}
          </div>

        </div>
      </div>
    `;
  } else {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">

        <!-- WS-A: anticipatory next-lesson surface (populated async; top of the fold) -->
        <div id="next-lesson-card"></div>

        <!-- Greeting -->
        <div class="greeting-card animate-fade-in-up">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);">
            <div style="display:flex;align-items:center;gap:var(--sp-3);min-width:0;">
              ${teacherMonogramHTML('avatar-lg')}
              <div style="min-width:0;">
                <div class="greeting-title">${getGreeting()}, Cher!</div>
                <div class="greeting-subtitle">What would you like to do today${getFirstName() ? ', ' + getFirstName() : ''}?</div>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" id="customise-dashboard-btn" title="Customise your dashboard" style="position:absolute;bottom:var(--sp-3);right:var(--sp-3);padding:6px;opacity:0.6;transition:opacity 0.15s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.6'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
          <div style="margin-top:12px;font-size:0.875rem;font-style:italic;opacity:0.85;line-height:1.5;">
            ${(() => {
              const mantra = getIdentity().chosenMantra;
              if (mantra) return escapeHtml(mantra);
              const q = getDailyQuote();
              return `"${escapeHtml(q.text)}"${q.attr ? `<span style="font-style:normal;opacity:0.7;margin-left:6px;">- ${escapeHtml(q.attr)}</span>` : ''}`;
            })()}
          </div>
        </div>

        <!-- WS-D: milestone offer (teacher-led delight; shown only at thresholds) -->
        ${buildMilestoneOffer(Store.getLifetimeStats())}

        <!-- Up Next: the most actionable lesson in the pipeline -->
        ${buildUpNextHero(lessons, classes)}

        <!-- Status Banner (next lesson / done for day) -->
        <div id="tt-status-banner"></div>

        <!-- Pinned Links -->
        ${renderPinnedLinks(prefs.pinnedLinks)}

        <!-- Ordered Widgets -->
        ${widgetsHTML}

      </div>
    </div>
  `;
  }

  // Customise Dashboard button
  container.querySelector('#customise-dashboard-btn')?.addEventListener('click', () => {
    showCustomiseModal(container);
  });

  // ── WS-D: milestone offer (never auto-navigates; both actions settle it) ──
  container.querySelector('.milestone-growth')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const card = e.currentTarget.closest('.milestone-offer');
    if (card) markMilestoneSeen(card.dataset.milestoneKey);
    navigate('/my-growth');
  });
  container.querySelector('.milestone-dismiss')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const card = e.currentTarget.closest('.milestone-offer');
    if (card) { markMilestoneSeen(card.dataset.milestoneKey); card.remove(); }
  });

  // ── Mobile widget reorder: one delegated listener on the (fresh-per-render)
  // page container catches ▲/▼ on both sync and async widgets without stacking
  // listeners across re-renders. Non-touch never emits the buttons. ──
  if (isTouch()) {
    const pc = container.querySelector('.page-container');
    pc?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-widget-move');
      if (!btn || !pc.contains(btn)) return;
      e.preventDefault();   // don't toggle the widget's <details>
      e.stopPropagation();
      moveWidget(container, btn.dataset.widgetId, btn.dataset.widgetMove);
    });
  }

  // ── Calm layout wiring (elements absent in classic; all guarded) ──
  const calmMoreBtn = container.querySelector('#calm-more-btn');
  const calmMoreContainer = container.querySelector('#calm-more-container');
  if (calmMoreBtn && calmMoreContainer) {
    calmMoreBtn.addEventListener('click', () => {
      const open = calmMoreContainer.style.display === 'none';
      calmMoreContainer.style.display = open ? '' : 'none';
      calmMoreBtn.innerHTML = open ? 'Less &#9652;' : 'More &#9662;';
      const p = getDashPrefs();
      p.calmMoreOpen = open;
      saveDashPrefs(p);
    });
  }
  container.querySelectorAll('[data-calm-lesson-id]').forEach(el => {
    el.addEventListener('click', () => navigate(`/lessons/${el.dataset.calmLessonId}`));
  });

  // Swap the two calm panels' order (persisted pref).
  container.querySelector('#calm-swap-panels')?.addEventListener('click', () => {
    const p = getDashPrefs();
    p.calmPanelSwap = !p.calmPanelSwap;
    saveDashPrefs(p);
    render(container);
  });

  // Up Next hero: card opens the lesson; the CTA jumps straight to the next step
  container.querySelector('#up-next-cta')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const lessonId = btn.dataset.lessonId;
    if (btn.dataset.action === 'plan') {
      navigate(`/lesson-planner/${lessonId}`);
    } else if (btn.dataset.action === 'rehearse') {
      sessionStorage.setItem('cocher_rehearse_lesson_id', lessonId);
      navigate('/lesson-rehearsal');
    } else {
      navigate(`/lessons/${lessonId}`);
    }
  });
  container.querySelector('.up-next-hero')?.addEventListener('click', (e) => {
    if (e.target.closest('#up-next-cta')) return;
    navigate(e.currentTarget.dataset.heroRoute);
  });

  // ── Widget resize buttons ──
  container.querySelectorAll('.btn-widget-resize').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wId = btn.dataset.resizeWidget;
      const p = getDashPrefs();
      const currentSize = (p.widgetSizes && p.widgetSizes[wId]) || 'medium';
      const nextSize = SIZE_CYCLE[currentSize] || 'medium';
      p.widgetSizes = { ...(p.widgetSizes || {}), [wId]: nextSize };
      saveDashPrefs(p);
      render(container);
    });
  });

  // ── Live drag-and-drop reordering ──
  let dragWidget = null;
  const pageContainer = container.querySelector('.page-container');
  container.querySelectorAll('.dashboard-widget[draggable="true"]').forEach(widget => {
    widget.addEventListener('dragstart', (e) => {
      dragWidget = widget;
      widget.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });
    widget.addEventListener('dragend', () => {
      widget.style.opacity = '1';
      dragWidget = null;
      // Remove all drag-over indicators
      container.querySelectorAll('.dashboard-widget').forEach(w => {
        w.style.borderTop = '';
        w.style.borderBottom = '';
      });
    });
    widget.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragWidget || dragWidget === widget) return;
      // Visual indicator
      const rect = widget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      container.querySelectorAll('.dashboard-widget').forEach(w => {
        w.style.borderTop = '';
        w.style.borderBottom = '';
      });
      if (e.clientY < midY) {
        widget.style.borderTop = '3px solid var(--accent, #6366f1)';
      } else {
        widget.style.borderBottom = '3px solid var(--accent, #6366f1)';
      }
    });
    widget.addEventListener('dragleave', () => {
      widget.style.borderTop = '';
      widget.style.borderBottom = '';
    });
    widget.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragWidget || dragWidget === widget) return;
      const rect = widget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        widget.parentNode.insertBefore(dragWidget, widget);
      } else {
        widget.parentNode.insertBefore(dragWidget, widget.nextSibling);
      }
      widget.style.borderTop = '';
      widget.style.borderBottom = '';
      // Persist new order
      const newOrder = [...container.querySelectorAll('.dashboard-widget[data-widget-id]')].map(w => w.dataset.widgetId);
      const p = getDashPrefs();
      p.widgetOrder = newOrder;
      saveDashPrefs(p);
    });
  });

  // Quick action and navigation handlers
  const actions = {
    'lesson-planner': () => navigate('/lesson-planner'),
    'spatial': () => navigate('/spatial'),
    'classes': () => navigate('/classes'),
    'knowledge': () => navigate('/knowledge'),
    'admin': () => navigate('/admin'),
    'lessons': () => navigate('/lessons'),
    'add-class': () => navigate('/classes'),
    'view-all-activity': () => navigate('/lessons')
  };

  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (actions[action]) actions[action]();
    });
  });

  // Activity feed item clicks
  container.querySelectorAll('[data-feed-route]').forEach(el => {
    el.addEventListener('click', () => {
      const route = el.dataset.feedRoute;
      const param = el.dataset.feedParam;
      if (param) {
        navigate(`${route}/${param}`);
      } else {
        navigate(route);
      }
    });
  });

  // Pinned link clicks
  container.querySelectorAll('.pinned-link').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.route));
  });

  // Prep checklist route navigation
  container.querySelectorAll('[data-action-route]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.actionRoute));
  });

  // Notification item clicks
  container.querySelectorAll('.notification-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      const items = buildNotificationItems(classes, lessons, events);
      if (items[i]?.action) items[i].action();
    });
  });

  // Class card clicks (including spotlight students)
  container.querySelectorAll('[data-class-id]').forEach(el => {
    el.addEventListener('click', () => navigate(`/classes/${el.dataset.classId}`));
  });

  // Lesson card clicks
  container.querySelectorAll('[data-lesson-id]').forEach(el => {
    el.addEventListener('click', () => navigate(`/lesson-planner/${el.dataset.lessonId}`));
  });

  // Smart suggestion clicks
  container.querySelectorAll('.suggestion-card').forEach((el, i) => {
    el.addEventListener('click', () => {
      if (suggestions[i]?.action) suggestions[i].action();
    });
  });

  // Track collapse state on details toggle
  container.querySelectorAll('.dashboard-widget details').forEach(det => {
    det.addEventListener('toggle', () => {
      const wId = det.closest('.dashboard-widget')?.dataset.widgetId;
      if (!wId) return;
      const p = getDashPrefs();
      if (det.open) {
        p.collapsedWidgets = (p.collapsedWidgets || []).filter(w => w !== wId);
      } else {
        if (!(p.collapsedWidgets || []).includes(wId)) {
          p.collapsedWidgets = [...(p.collapsedWidgets || []), wId];
        }
      }
      saveDashPrefs(p);
    });
  });

  // Async TT schedule card + status banner + My Timetable + Weekly Overview
  // + Prep Checklist (+ calm orientation line and day ribbon)
  (async () => {
    try {
      const user = getCurrentUser();
      let teacherRow = null;
      if (user?.email) {
        const [ttData] = await Promise.all([loadTT(), ensureCalendar()]);
        teacherRow = findTeacherRow(ttData, user.email);
      }

      // Calm-only elements (null in classic, so this is a no-op there).
      // These update even without a teacher row so placeholders resolve.
      const orientEl = container.querySelector('#calm-orient');
      if (orientEl) orientEl.textContent = calmOrientationText(teacherRow, lessons);
      const ribbonEl = container.querySelector('#calm-ribbon');
      if (ribbonEl) {
        const ribbonHTML = buildCalmRibbon(teacherRow);
        if (ribbonHTML) ribbonEl.innerHTML = ribbonHTML;
        else ribbonEl.style.display = 'none'; // weekend / no timetable row
      }

      // WS-A: anticipatory next-lesson card. Rendered even without a teacher
      // row so the weekend / no-timetable calm line resolves the placeholder.
      // It only ever renders tappable suggestions — never navigates on its own.
      const nlEl = container.querySelector('#next-lesson-card');
      if (nlEl) {
        const nlHTML = buildNextLessonCard(teacherRow, Store.getLessons(), classes);
        if (nlHTML) { nlEl.innerHTML = nlHTML; wireNextLessonCard(nlEl); }
        else nlEl.style.display = 'none';
      }

      if (!teacherRow) return;

      // Status banner
      const banner = container.querySelector('#tt-status-banner');
      if (banner) banner.innerHTML = buildStatusBanner(teacherRow);

      // Schedule widget
      const scheduleEl = container.querySelector('#widget-schedule');
      if (scheduleEl && !prefs.hiddenWidgets.includes('schedule')) {
        scheduleEl.innerHTML = widgetWrap('schedule', getWidgetLabel('schedule', prefs), buildTTScheduleCard(teacherRow), prefs);
      }

      // Weekly overview widget
      const weeklyEl = container.querySelector('#widget-weeklyOverview');
      if (weeklyEl && !prefs.hiddenWidgets.includes('weeklyOverview')) {
        const weeklyContent = buildWeeklyOverview(teacherRow, lessons, classes);
        if (weeklyContent) {
          weeklyEl.innerHTML = widgetWrap('weeklyOverview', getWidgetLabel('weeklyOverview', prefs), weeklyContent, prefs);
        }
      }

      // Prep checklist widget
      const prepEl = container.querySelector('#widget-prepChecklist');
      if (prepEl && !prefs.hiddenWidgets.includes('prepChecklist')) {
        // Re-buildable so a prep-check toggle click can refresh just this
        // widget without a full dashboard re-render.
        const renderPrepChecklist = () => {
          const prepContent = buildPrepChecklist(teacherRow, Store.getLessons(), classes);
          if (!prepContent) return;
          prepEl.innerHTML = widgetWrap('prepChecklist', getWidgetLabel('prepChecklist', prefs), prepContent, prefs);
          // Wire route clicks inside prep checklist
          prepEl.querySelectorAll('[data-action-route]').forEach(el => {
            el.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(el.dataset.actionRoute);
            });
          });
          // Wire Room ready / Materials / Tech tested toggles — persisted on
          // the linked lesson's `prepChecks` so state survives reloads that day.
          prepEl.querySelectorAll('[data-prep-toggle]').forEach(el => {
            el.addEventListener('click', () => {
              const key = el.dataset.prepToggle;
              const lessonId = el.dataset.lessonId;
              // Look up the linked lesson fresh (not the closed-over `lessons`
              // array) so we toggle against current state, not a stale copy.
              const freshLesson = Store.getLessons().find(l => l.id === lessonId);
              if (!freshLesson) return;
              const current = freshLesson.prepChecks || {};
              Store.updateLesson(freshLesson.id, { prepChecks: { ...current, [key]: !current[key] } });
              renderPrepChecklist();
            });
          });
        };
        renderPrepChecklist();
      }

      // My timetable widget
      const timetableEl = container.querySelector('#widget-timetable');
      if (timetableEl && !prefs.hiddenWidgets.includes('timetable')) {
        const ttContent = buildMyTimetable(teacherRow);
        if (ttContent) {
          timetableEl.innerHTML = widgetWrap('timetable', getWidgetLabel('timetable', prefs), ttContent, prefs);
        }
      }

      // Wire resize buttons / collapse tracking for the freshly-injected async
      // widgets only — the sync widgets were already wired above, so re-querying
      // the whole container would stack duplicate listeners on their buttons
      const asyncWidgetEls = [scheduleEl, weeklyEl, prepEl, timetableEl].filter(Boolean);

      asyncWidgetEls.forEach(widgetEl => {
        widgetEl.querySelectorAll('.btn-widget-resize').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const wId = btn.dataset.resizeWidget;
            const p = getDashPrefs();
            const currentSize = (p.widgetSizes && p.widgetSizes[wId]) || 'medium';
            const nextSize = SIZE_CYCLE[currentSize] || 'medium';
            p.widgetSizes = { ...(p.widgetSizes || {}), [wId]: nextSize };
            saveDashPrefs(p);
            render(container);
          });
        });

        widgetEl.querySelectorAll('details').forEach(det => {
          det.addEventListener('toggle', () => {
            const wId = det.closest('.dashboard-widget')?.dataset.widgetId;
            if (!wId) return;
            const p = getDashPrefs();
            if (det.open) {
              p.collapsedWidgets = (p.collapsedWidgets || []).filter(w => w !== wId);
            } else {
              if (!(p.collapsedWidgets || []).includes(wId)) {
                p.collapsedWidgets = [...(p.collapsedWidgets || []), wId];
              }
            }
            saveDashPrefs(p);
          });
        });
      });
    } catch { /* TT is optional */ }
  })();
}

/* Helper for notification click routing: extract action items */
function buildNotificationItems(classes, lessons, events) {
  const items = [];
  lessons.forEach(l => {
    if ((l.status === 'ready' || l.status === 'completed') && !l.reflection) {
      const age = Date.now() - (l.updatedAt || l.createdAt || 0);
      if (age > 2 * 86400000) {
        items.push({ action: () => navigate(`/lessons/${l.id}`) });
      }
    }
  });
  const drafts = lessons.filter(l => l.status === 'draft');
  if (drafts.length > 0) items.push({ action: () => navigate('/lessons') });
  events.filter(e => e.status !== 'completed').forEach(ev => {
    const enabled = ev.tasks.filter(t => t.enabled);
    const done = enabled.filter(t => t.status === 'completed').length;
    if (enabled.length > 0 && done < enabled.length) items.push({ action: () => navigate('/admin') });
  });
  const classesWithoutLessons = classes.filter(cls => !lessons.some(l => l.classId === cls.id));
  if (classesWithoutLessons.length > 0) items.push({ action: () => navigate('/lesson-planner') });
  return items.slice(0, 5);
}

/* ── My Timetable: full day grid ── */
export function buildMyTimetable(teacherRow) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  if (!pk) {
    return noSchoolCard(isWeekendToday()
      ? 'No school day today &mdash; your timetable resumes on the next school day.'
      : 'Non-teaching week &mdash; no periods to show.');
  }
  const { dayStr, period, weekType } = pk;

  const rows = [];
  for (const p of periodsForDay(teacherRow, weekType, dayStr)) {
    const col = periodCol(weekType, dayStr, p);
    const val = teacherRow[col];
    const hasClass = val && val !== '0';
    const parts = hasClass ? val.split(' / ') : [];
    const classCode = parts[0]?.trim() || '';
    const room = parts[1]?.trim() || '';
    const isCurrent = period === p;
    const isPast = period !== null && p < period;
    rows.push({ p, classCode, room, hasClass, isCurrent, isPast });
  }

  const rowsHTML = rows.map(r => {
    const bg = r.isCurrent ? 'background:var(--accent-light);' : r.isPast ? 'opacity:0.5;' : '';
    const leftBorder = r.isCurrent ? 'border-left:3px solid var(--accent,#4361ee);' : '';
    const freeLabel = r.isPast ? 'Free' : '<span style="color:var(--success,#22c55e);">Free</span>';
    return `<div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);border-bottom:1px solid var(--border-light);font-size:0.8125rem;${bg}${leftBorder}">
      <div style="width:36px;font-weight:700;color:var(--ink-muted);flex-shrink:0;">P${r.p}</div>
      <div style="width:80px;font-size:0.75rem;color:var(--ink-faint);flex-shrink:0;">${fmtClockShort(periodStartMin(r.p))}–${fmtClockShort(periodEndMin(r.p))}</div>
      <div style="flex:1;font-weight:${r.hasClass ? '600' : '400'};color:var(--ink);">${r.hasClass ? r.classCode : freeLabel}</div>
      ${r.room ? `<div style="font-size:0.75rem;color:var(--ink-muted);">${r.room}</div>` : ''}
      ${r.isCurrent ? '<span class="badge badge-blue" style="font-size:0.625rem;">NOW</span>' : ''}
    </div>`;
  }).join('');

  // No inner "My Timetable" heading — widgetWrap already renders the title
  return `
    <div style="margin-bottom:var(--sp-8);">
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--sp-2);">
        <span style="font-size:0.75rem;color:var(--ink-muted);">${weekType} Week &middot; ${dayStr}</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        ${rowsHTML}
      </div>
    </div>`;
}
