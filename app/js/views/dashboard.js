/*
 * Co-Cher Dashboard
 * =================
 * Context-aware landing page — "What would you like to do?"
 * Surfaces smart suggestions, admin tasks, and recent lessons.
 * Customisable widget system with show/hide, collapse, reorder, and pinned links.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { getCurrentUser } from '../components/login.js';

/* ── Dashboard Preferences (per-user, stored in localStorage) ── */
const DASH_PREFS_KEY = 'cocher_dashboard_prefs';

const DEFAULT_WIDGET_ORDER = [
  'schedule', 'notifications', 'weeklyOverview', 'suggestions',
  'quickActions', 'stats', 'prepChecklist', 'insights',
  'reflections', 'recentGrid', 'timetable', 'classes'
];

const WIDGET_LABELS = {
  schedule:      "Today's Schedule",
  notifications: 'Notifications & Reminders',
  weeklyOverview:'Weekly Overview',
  suggestions:   'Suggested for You',
  quickActions:  'Quick Actions',
  stats:         'Stats',
  prepChecklist: 'Lesson Prep Checklist',
  insights:      'Teaching Insights',
  reflections:   'Reflection Analytics',
  recentGrid:    'Recent Lessons / Events / Activity',
  timetable:     'My Timetable',
  classes:       'Your Classes'
};

function getDashPrefs() {
  try {
    const raw = localStorage.getItem(DASH_PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    widgetOrder: [...DEFAULT_WIDGET_ORDER],
    hiddenWidgets: [],
    collapsedWidgets: [],
    pinnedLinks: []
  };
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
  const user = getCurrentUser();
  if (!user || !user.name) return null;
  return user.name.split(' ')[0];
}

/* ── Curated quotes — one per day, rotated by period ── */
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
  { text: 'You don\'t have to be perfect to be a great teacher — just present.', attr: '' },
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
  { text: 'Rest is not a reward — it is a requirement.', attr: '' },
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
  { text: 'The impact you made today may not be visible yet — but it is real.', attr: '' },
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
    const res = await fetch('./btyrelief/BTYTT_2026Sem1_v1.csv');
    const text = await res.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { _ttCache = []; return _ttCache; }
    const headers = lines[0].split(',');
    _ttCache = lines.slice(1).map(line => {
      const cols = line.split(',');
      const row = {};
      headers.forEach((h, i) => row[h.trim()] = (cols[i] || '').trim());
      return row;
    });
  } catch { _ttCache = []; }
  return _ttCache;
}

export function getTTPeriodKey() {
  const now = new Date();
  const day = now.getDay();
  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (day < 1 || day > 5) return null;
  const dayStr = dayNames[day];
  const start = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  const weekType = weekNum % 2 === 1 ? 'Odd' : 'Even';
  const h = now.getHours(), m = now.getMinutes(), mins = h * 60 + m;
  const periods = [
    { p: 1, start: 450 }, { p: 2, start: 490 }, { p: 3, start: 530 },
    { p: 4, start: 570 }, { p: 5, start: 620 }, { p: 6, start: 660 },
    { p: 7, start: 700 }, { p: 8, start: 740 }, { p: 9, start: 790 },
    { p: 10, start: 830 }, { p: 11, start: 870 }
  ];
  let period = null;
  for (let i = periods.length - 1; i >= 0; i--) {
    if (mins >= periods[i].start) { period = periods[i].p; break; }
  }
  return { dayStr, period, weekType, mins };
}

/* ── Demo role-play mapping: login email → TT teacher email prefix ── */
const DEMO_ROLE_MAP = {
  'harman_johll': 'nurain_hamzah'   // Harman uses Ms Ain's timetable for demo
};

/* ── Display name overrides: when role-playing, show the real user's name ── */
const DEMO_DISPLAY_NAME = {
  'harman_johll': { name: 'Mr Johll', dept: null }   // null dept = keep timetable dept
};

/* ── Flexible teacher lookup: match exact email or prefix (cross-domain) ── */
export function findTeacherRow(ttData, email) {
  if (!ttData || !email) return null;
  const emailLower = email.toLowerCase();
  const prefix = emailLower.split('@')[0];

  // Check if this user has a demo role-play mapping
  const lookupPrefix = DEMO_ROLE_MAP[prefix] || prefix;

  // 1. Exact match on Teacher's Email
  let row = ttData.find(r => (r["Teacher's Email"] || '').toLowerCase() === emailLower);
  if (row) return row;
  // 2. Prefix match on Teacher's Email (handles cross-domain + role-play)
  row = ttData.find(r => (r["Teacher's Email"] || '').toLowerCase().split('@')[0] === lookupPrefix);
  if (row) return row;
  return null;
}

/* ── Top-of-dashboard status banner: next lesson or done for the day ── */
function buildStatusBanner(teacherRow) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  if (!pk) return ''; // Weekend

  const { dayStr, period, weekType, mins } = pk;
  const periodStartTimes = [0, 450, 490, 530, 570, 620, 660, 700, 740, 790, 830, 870];
  const firstName = getFirstName() || 'Cher';

  // Build today's full schedule
  const allPeriods = [];
  for (let p = 1; p <= 11; p++) {
    const col = `${weekType}${dayStr}${p}`;
    const val = teacherRow[col];
    if (val && val !== '0') {
      const parts = val.split(' / ');
      allPeriods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
    }
  }

  const lastPeriod = allPeriods.length > 0 ? allPeriods[allPeriods.length - 1].p : 0;
  const beforeSchool = mins < 450;

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
    // Before school — show first lesson
    const startTime = formatTime(periodStartTimes[nextLesson.p]);
    return `
      <div style="padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--accent,#4361ee),#6366f1);color:#fff;display:flex;align-items:center;gap:var(--sp-4);">
        <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <div style="font-size:0.8125rem;opacity:0.85;">First lesson today</div>
          <div style="font-size:1.125rem;font-weight:700;">P${nextLesson.p} — ${nextLesson.classCode} in ${nextLesson.room} at ${startTime}</div>
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
        ? `Up next: P${upNext.p} — ${upNext.classCode} in ${upNext.room} at ${formatTime(periodStartTimes[upNext.p])}`
        : 'This is your last lesson today';
      return `
        <div style="padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--accent,#4361ee),#6366f1);color:#fff;display:flex;align-items:center;gap:var(--sp-4);">
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div style="font-size:0.8125rem;opacity:0.85;">Now teaching</div>
            <div style="font-size:1.125rem;font-weight:700;">P${nextLesson.p} — ${nextLesson.classCode} in ${nextLesson.room}</div>
            <div style="font-size:0.8125rem;opacity:0.85;margin-top:2px;">${label}</div>
          </div>
        </div>`;
    } else {
      const startTime = formatTime(periodStartTimes[nextLesson.p]);
      return `
        <div style="padding:var(--sp-4) var(--sp-5);margin-bottom:var(--sp-5);border-radius:var(--radius-lg);background:linear-gradient(135deg,var(--accent,#4361ee),#6366f1);color:#fff;display:flex;align-items:center;gap:var(--sp-4);">
          <div style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div style="font-size:0.8125rem;opacity:0.85;">Next lesson</div>
            <div style="font-size:1.125rem;font-weight:700;">P${nextLesson.p} — ${nextLesson.classCode} in ${nextLesson.room} at ${startTime}</div>
          </div>
        </div>`;
    }
  }

  return '';
}

function buildTTScheduleCard(teacherRow) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  if (!pk) return ''; // Weekend

  // Check for display name override (e.g. Harman sees "Mr Johll" not Ms Ain)
  const user = getCurrentUser();
  const loginPrefix = user?.email?.toLowerCase().split('@')[0] || '';
  const override = DEMO_DISPLAY_NAME[loginPrefix];
  const name = override?.name || teacherRow['NAME'] || '';
  const dept = override?.dept || teacherRow['DEPARTMENT'] || '';
  const { dayStr, period, weekType, mins } = pk;

  // Build today's full schedule
  const allPeriods = [];
  for (let p = 1; p <= 11; p++) {
    const col = `${weekType}${dayStr}${p}`;
    const val = teacherRow[col];
    if (val && val !== '0') {
      const parts = val.split(' / ');
      allPeriods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
    }
  }

  // Find last teaching period
  const lastPeriod = allPeriods.length > 0 ? allPeriods[allPeriods.length - 1].p : 0;
  const periodEndTimes = [0, 490, 530, 570, 610, 660, 700, 740, 780, 830, 870, 910];
  const doneForDay = period !== null && period > lastPeriod && allPeriods.length > 0;
  // School day hasn't started
  const beforeSchool = mins < 450;

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
  const periodPills = allPeriods.map(s => {
    const isCurrent = period === s.p;
    const isPast = period !== null && s.p < period;
    const bg = isCurrent ? 'var(--accent,#4361ee)' : isPast ? 'var(--bg-subtle,#f0f0f4)' : 'var(--bg-card,#fff)';
    const color = isCurrent ? '#fff' : isPast ? 'var(--ink-faint)' : 'var(--ink)';
    const border = isCurrent ? 'var(--accent,#4361ee)' : 'var(--border,#e2e5ea)';
    const textDec = isPast ? 'line-through' : 'none';
    return `<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;border:1px solid ${border};background:${bg};color:${color};font-size:0.75rem;text-decoration:${textDec};">
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
      desc: `Draft lesson — ${latest.chatHistory?.length || 0} exchanges so far`,
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
      desc: `${cls.students?.length || 0} students — no lessons linked yet`,
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
      title: `${ev.name} — ${done}/${enabled.length} tasks done`,
      desc: `${ev.eventType || 'Event'}${ev.date ? ' · ' + ev.date : ''}`,
      action: () => navigate('/admin')
    });
  }

  // E21CC weak area to focus on
  if (classes.length > 0) {
    let totals = { cait: 0, cci: 0, cgc: 0 }, count = 0;
    classes.forEach(cls => (cls.students || []).forEach(s => {
      if (s.e21cc) {
        totals.cait += s.e21cc.cait || 0;
        totals.cci += s.e21cc.cci || 0;
        totals.cgc += s.e21cc.cgc || 0;
        count++;
      }
    }));
    if (count > 0) {
      const avgs = { cait: totals.cait / count, cci: totals.cci / count, cgc: totals.cgc / count };
      const weakest = Object.entries(avgs).sort((a, b) => a[1] - b[1])[0];
      const names = { cait: 'CAIT (Critical & Inventive Thinking)', cci: 'CCI (Communication & Collaboration)', cgc: 'CGC (Civic & Global Citizenship)' };
      if (weakest[1] < 60) {
        suggestions.push({
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`,
          color: 'var(--success)',
          bg: 'var(--success-light)',
          title: `Boost ${weakest[0].toUpperCase()} across your classes`,
          desc: `${names[weakest[0]]} avg: ${Math.round(weakest[1])}/100`,
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

function renderInsights(classes, lessons) {
  let totalCait = 0, totalCci = 0, totalCgc = 0, count = 0;
  classes.forEach(cls => {
    (cls.students || []).forEach(s => {
      if (s.e21cc) {
        totalCait += s.e21cc.cait || 0;
        totalCci += s.e21cc.cci || 0;
        totalCgc += s.e21cc.cgc || 0;
        count++;
      }
    });
  });

  const avgCait = count > 0 ? Math.round(totalCait / count) : 0;
  const avgCci = count > 0 ? Math.round(totalCci / count) : 0;
  const avgCgc = count > 0 ? Math.round(totalCgc / count) : 0;

  const barColor = (val) => val >= 65 ? 'var(--success)' : val >= 45 ? 'var(--warning)' : 'var(--danger)';

  const focusCounts = { cait: 0, cci: 0, cgc: 0 };
  lessons.forEach(l => {
    (l.e21ccFocus || []).forEach(f => { if (focusCounts[f] !== undefined) focusCounts[f]++; });
  });
  const totalFocus = focusCounts.cait + focusCounts.cci + focusCounts.cgc;

  let strongest = null, weakest = null, maxAvg = -1, minAvg = 101;
  classes.forEach(cls => {
    const students = cls.students || [];
    if (students.length === 0) return;
    const avg = students.reduce((s, st) => {
      const e = st.e21cc || {};
      return s + ((e.cait || 0) + (e.cci || 0) + (e.cgc || 0)) / 3;
    }, 0) / students.length;
    if (avg > maxAvg) { maxAvg = avg; strongest = cls; }
    if (avg < minAvg) { minAvg = avg; weakest = cls; }
  });

  return `
    <div style="margin-bottom:var(--sp-8);">
      <div class="section-header">
        <h2 class="section-title" style="font-size:1.125rem;">Teaching Insights</h2>
      </div>
      <div class="grid-2 stagger">
        <!-- E21CC Overview -->
        <div class="card" style="padding:var(--sp-5) var(--sp-6);">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-4);">E21CC Averages (All Students)</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px;">
                <span style="font-weight:600;color:var(--ink);">CAIT</span>
                <span style="color:var(--ink-muted);">${avgCait}/100</span>
              </div>
              <div style="height:8px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                <div style="width:${avgCait}%;height:100%;background:${barColor(avgCait)};border-radius:var(--radius-full);transition:width 0.6s;"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px;">
                <span style="font-weight:600;color:var(--ink);">CCI</span>
                <span style="color:var(--ink-muted);">${avgCci}/100</span>
              </div>
              <div style="height:8px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                <div style="width:${avgCci}%;height:100%;background:${barColor(avgCci)};border-radius:var(--radius-full);transition:width 0.6s;"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px;">
                <span style="font-weight:600;color:var(--ink);">CGC</span>
                <span style="color:var(--ink-muted);">${avgCgc}/100</span>
              </div>
              <div style="height:8px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                <div style="width:${avgCgc}%;height:100%;background:${barColor(avgCgc)};border-radius:var(--radius-full);transition:width 0.6s;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Insights -->
        <div class="card" style="padding:var(--sp-5) var(--sp-6);">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-4);">Quick Insights</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);font-size:0.8125rem;">
            ${strongest ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--success);font-size:1rem;">&#9650;</span>
              <span style="color:var(--ink-secondary);"><strong>${strongest.name}</strong> has the highest overall E21CC average (${Math.round(maxAvg)})</span>
            </div>` : ''}
            ${weakest && weakest !== strongest ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--warning);font-size:1rem;">&#9660;</span>
              <span style="color:var(--ink-secondary);"><strong>${weakest.name}</strong> could benefit from more E21CC focus (avg: ${Math.round(minAvg)})</span>
            </div>` : ''}
            ${totalFocus > 0 ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--accent);font-size:1rem;">&#9679;</span>
              <span style="color:var(--ink-secondary);">Lesson focus: CAIT (${focusCounts.cait}), CCI (${focusCounts.cci}), CGC (${focusCounts.cgc})</span>
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
                ${snippet ? ` — ${snippet}...` : ''}
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
  if (!pk) return '';
  const { weekType } = pk;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const today = new Date().getDay(); // 0=Sun, 1=Mon...
  const todayIdx = today >= 1 && today <= 5 ? today - 1 : -1;

  const dayColumns = days.map((day, idx) => {
    const periods = [];
    for (let p = 1; p <= 11; p++) {
      const col = `${weekType}${day}${p}`;
      const val = teacherRow[col];
      if (val && val !== '0') {
        const parts = val.split(' / ');
        periods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
      }
    }
    const isToday = idx === todayIdx;
    const isPast = todayIdx >= 0 && idx < todayIdx;

    return `<div style="flex:1;min-width:0;${isToday ? 'background:var(--accent-light, #eff6ff);border-radius:var(--radius-lg);' : ''}${isPast ? 'opacity:0.5;' : ''}">
      <div style="text-align:center;font-weight:700;font-size:0.75rem;color:${isToday ? 'var(--accent, #4361ee)' : 'var(--ink-muted)'};padding:var(--sp-2);text-transform:uppercase;letter-spacing:0.05em;">
        ${day}${isToday ? ' (Today)' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;padding:0 var(--sp-1);">
        ${periods.length === 0 ? '<div style="text-align:center;font-size:0.6875rem;color:var(--ink-faint);padding:var(--sp-2);">No classes</div>' :
          periods.map(s => `<div style="font-size:0.6875rem;padding:3px 6px;background:var(--bg-card, #fff);border:1px solid var(--border-light, #e5e7eb);border-radius:4px;text-align:center;">
            <div style="font-weight:600;color:var(--ink);">P${s.p} ${s.classCode}</div>
            <div style="color:var(--ink-faint);">${s.room}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  // Count teaching periods this week
  let totalPeriods = 0;
  days.forEach(day => {
    for (let p = 1; p <= 11; p++) {
      const col = `${weekType}${day}${p}`;
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
  if (!pk) return '';
  const { dayStr, period, weekType, mins } = pk;

  // Find next upcoming lesson
  const allPeriods = [];
  for (let p = 1; p <= 11; p++) {
    const col = `${weekType}${dayStr}${p}`;
    const val = teacherRow[col];
    if (val && val !== '0') {
      const parts = val.split(' / ');
      allPeriods.push({ p, classCode: parts[0]?.trim(), room: parts[1]?.trim() || '' });
    }
  }

  const beforeSchool = mins < 450;
  const nextLesson = allPeriods.find(s => beforeSchool ? true : (period !== null ? s.p >= period : false));
  if (!nextLesson) return '<div style="font-size:0.8125rem;color:var(--ink-muted);padding:var(--sp-2);">No upcoming lessons today. You\'re all set!</div>';

  // Find matching class and lesson plan
  const matchingClass = classes.find(c => c.name === nextLesson.classCode || c.name?.includes(nextLesson.classCode));
  const linkedLesson = matchingClass ? lessons.find(l => l.classId === matchingClass.id && l.status === 'ready') : null;

  const checks = [
    { label: 'Lesson plan prepared', done: !!linkedLesson, action: linkedLesson ? `/lesson-planner/${linkedLesson.id}` : '/lesson-planner' },
    { label: `Room ${nextLesson.room} ready`, done: false, action: null },
    { label: 'Materials / handouts printed', done: false, action: null },
    { label: 'Tech / simulation tested', done: false, action: linkedLesson?.components?.simulations ? '/simulations' : null },
    { label: 'Spatial layout configured', done: !!linkedLesson?.spatialLayout, action: '/spatial' },
  ];

  return `
    <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);">
      Next: P${nextLesson.p} — ${nextLesson.classCode} in ${nextLesson.room}
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      ${checks.map(c => `<div class="prep-check-item" style="display:flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;${c.action ? 'cursor:pointer;' : ''}" ${c.action ? `data-action-route="${c.action}"` : ''}>
        <div style="width:18px;height:18px;border-radius:4px;border:2px solid ${c.done ? 'var(--success, #22c55e)' : 'var(--border, #d1d5db)'};background:${c.done ? 'var(--success, #22c55e)' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${c.done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
        <span style="color:${c.done ? 'var(--success, #22c55e)' : 'var(--ink-secondary)'};${c.done ? 'text-decoration:line-through;' : ''}">${c.label}</span>
      </div>`).join('')}
    </div>`;
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
    <div style="background:var(--bg-card, #fff);color:var(--ink);padding:var(--sp-6);border-radius:var(--radius-xl, 1rem);box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);width:90%;max-width:500px;max-height:80vh;overflow:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-5);">
        <h3 style="font-size:1.125rem;font-weight:700;margin:0;">Customise Dashboard</h3>
        <button class="btn btn-ghost btn-sm modal-close" style="padding:4px 8px;">&times;</button>
      </div>

      <div style="margin-bottom:var(--sp-5);">
        <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:var(--sp-3);">Show / Hide Widgets</h4>
        <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Toggle which sections appear on your dashboard. Drag to reorder.</p>
        <div id="widget-toggle-list" style="display:flex;flex-direction:column;gap:var(--sp-2);">
          ${widgetOrder.map(wId => {
            const visible = !prefs.hiddenWidgets.includes(wId);
            return `<div class="widget-toggle-row" data-widget="${wId}" draggable="true" style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);border:1px solid var(--border-light, #e5e7eb);border-radius:var(--radius);cursor:grab;background:var(--bg-card, #fff);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;cursor:grab;"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              <label style="flex:1;font-size:0.8125rem;font-weight:500;color:var(--ink);cursor:pointer;display:flex;align-items:center;gap:var(--sp-2);">
                <input type="checkbox" class="widget-vis-toggle" data-widget="${wId}" ${visible ? 'checked' : ''} />
                ${WIDGET_LABELS[wId] || wId}
              </label>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div style="margin-bottom:var(--sp-5);">
        <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:var(--sp-3);">Pinned Quick Links</h4>
        <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Choose shortcuts to pin at the top of your dashboard.</p>
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
          ${PINNABLE_ACTIONS.map(a => {
            const pinned = prefs.pinnedLinks.includes(a.id);
            return `<label class="pin-toggle" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid ${pinned ? 'var(--accent, #4361ee)' : 'var(--border-light, #e5e7eb)'};border-radius:var(--radius-full, 999px);font-size:0.75rem;cursor:pointer;background:${pinned ? 'var(--accent-light, #eff6ff)' : 'transparent'};">
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
        label.style.borderColor = 'var(--accent, #4361ee)';
        label.style.background = 'var(--accent-light, #eff6ff)';
      } else {
        label.style.borderColor = 'var(--border-light, #e5e7eb)';
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
      pinnedLinks: []
    });
    overlay.remove();
    render(container);
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
    saveDashPrefs({
      widgetOrder: newOrder,
      hiddenWidgets: hidden,
      collapsedWidgets: prefs.collapsedWidgets || [],
      pinnedLinks: pins
    });
    overlay.remove();
    render(container);
  });
}

/* ── Collapsible widget wrapper ── */
function widgetWrap(id, title, content, prefs, extraHeaderHtml = '') {
  if (!content) return '';
  if (prefs.hiddenWidgets.includes(id)) return '';
  const collapsed = prefs.collapsedWidgets.includes(id);
  return `<div class="dashboard-widget" data-widget-id="${id}" style="margin-bottom:var(--sp-6);">
    <details ${collapsed ? '' : 'open'}>
      <summary style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;margin-bottom:var(--sp-3);" class="widget-summary" data-widget-id="${id}">
        <h2 class="section-title" style="font-size:1.125rem;margin:0;">${title}</h2>
        <div style="display:flex;align-items:center;gap:var(--sp-2);">
          ${extraHeaderHtml}
          <svg class="widget-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </summary>
      <div class="widget-body">${content}</div>
    </details>
  </div>`;
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
                  <div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">${ev.eventType || 'Event'}${ev.date ? ' · ' + ev.date : ''}</div>
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

  // Widget content map — content for each widget that can be rendered synchronously
  const widgetContent = {
    schedule: '',       // populated async
    notifications: notificationsContent,
    weeklyOverview: '', // populated async
    suggestions: suggestionsHTML,
    quickActions: quickActionsHTML,
    stats: statsHTML,
    prepChecklist: '',  // populated async
    insights: totalStudents > 0 ? renderInsights(classes, lessons) : '',
    reflections: renderReflectionAnalytics(lessons),
    recentGrid: recentGridHTML,
    timetable: '',      // populated async
    classes: classesHTML
  };

  // Build ordered widgets HTML — insights/reflections already have their own wrapper
  const widgetOrder = (prefs.widgetOrder.length > 0 ? prefs.widgetOrder : [...DEFAULT_WIDGET_ORDER]);
  // Ensure all default widgets appear
  DEFAULT_WIDGET_ORDER.forEach(w => { if (!widgetOrder.includes(w)) widgetOrder.push(w); });

  // Some widgets are async-populated — for those, use a placeholder div
  const asyncWidgets = new Set(['schedule', 'weeklyOverview', 'prepChecklist', 'timetable']);

  const widgetsHTML = widgetOrder.map(wId => {
    if (prefs.hiddenWidgets.includes(wId)) return '';
    if (asyncWidgets.has(wId)) {
      // Async widgets get a placeholder that will be filled later
      return `<div id="widget-${wId}" class="dashboard-widget" data-widget-id="${wId}"></div>`;
    }
    // insights and reflections return their own section wrapper
    if (wId === 'insights' || wId === 'reflections') {
      return prefs.hiddenWidgets.includes(wId) ? '' : (widgetContent[wId] || '');
    }
    const content = widgetContent[wId];
    if (!content) return '';
    return widgetWrap(wId, WIDGET_LABELS[wId] || wId, content, prefs);
  }).join('');

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">

        <!-- Greeting -->
        <div class="greeting-card animate-fade-in-up">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div class="greeting-title">${getGreeting()}, Cher!</div>
              <div class="greeting-subtitle">What would you like to do today${getFirstName() ? ', ' + getFirstName() : ''}?</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="customise-dashboard-btn" title="Customise your dashboard" style="display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Customise
            </button>
          </div>
          <div style="margin-top:12px;font-size:0.875rem;font-style:italic;opacity:0.85;line-height:1.5;">
            "${getDailyQuote().text}"${getDailyQuote().attr ? `<span style="font-style:normal;opacity:0.7;margin-left:6px;">— ${getDailyQuote().attr}</span>` : ''}
          </div>
        </div>

        <!-- Status Banner (next lesson / done for day) -->
        <div id="tt-status-banner"></div>

        <!-- Pinned Links -->
        ${renderPinnedLinks(prefs.pinnedLinks)}

        <!-- Ordered Widgets -->
        ${widgetsHTML}

      </div>
    </div>
  `;

  // Customise Dashboard button
  container.querySelector('#customise-dashboard-btn')?.addEventListener('click', () => {
    showCustomiseModal(container);
  });

  // Quick action and navigation handlers
  const actions = {
    'lesson-planner': () => navigate('/lesson-planner'),
    'spatial': () => navigate('/spatial'),
    'classes': () => navigate('/classes'),
    'knowledge': () => navigate('/knowledge'),
    'admin': () => navigate('/admin'),
    'lessons': () => navigate('/lessons'),
    'add-class': () => navigate('/classes')
  };

  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (actions[action]) actions[action]();
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

  // Class card clicks
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

  // Async TT schedule card + status banner + My Timetable + Weekly Overview + Prep Checklist
  (async () => {
    try {
      const user = getCurrentUser();
      if (!user?.email) return;
      const ttData = await loadTT();
      const teacherRow = findTeacherRow(ttData, user.email);
      if (!teacherRow) return;

      // Status banner
      const banner = container.querySelector('#tt-status-banner');
      if (banner) banner.innerHTML = buildStatusBanner(teacherRow);

      // Schedule widget
      const scheduleEl = container.querySelector('#widget-schedule');
      if (scheduleEl && !prefs.hiddenWidgets.includes('schedule')) {
        scheduleEl.innerHTML = widgetWrap('schedule', "Today's Schedule", buildTTScheduleCard(teacherRow), prefs);
      }

      // Weekly overview widget
      const weeklyEl = container.querySelector('#widget-weeklyOverview');
      if (weeklyEl && !prefs.hiddenWidgets.includes('weeklyOverview')) {
        const weeklyContent = buildWeeklyOverview(teacherRow, lessons, classes);
        if (weeklyContent) {
          weeklyEl.innerHTML = widgetWrap('weeklyOverview', 'Weekly Overview', weeklyContent, prefs);
        }
      }

      // Prep checklist widget
      const prepEl = container.querySelector('#widget-prepChecklist');
      if (prepEl && !prefs.hiddenWidgets.includes('prepChecklist')) {
        const prepContent = buildPrepChecklist(teacherRow, lessons, classes);
        if (prepContent) {
          prepEl.innerHTML = widgetWrap('prepChecklist', 'Lesson Prep Checklist', prepContent, prefs);
          // Wire route clicks inside prep checklist
          prepEl.querySelectorAll('[data-action-route]').forEach(el => {
            el.addEventListener('click', () => navigate(el.dataset.actionRoute));
          });
        }
      }

      // My timetable widget
      const timetableEl = container.querySelector('#widget-timetable');
      if (timetableEl && !prefs.hiddenWidgets.includes('timetable')) {
        const ttContent = buildMyTimetable(teacherRow);
        if (ttContent) {
          timetableEl.innerHTML = widgetWrap('timetable', 'My Timetable', ttContent, prefs);
        }
      }

      // Re-wire collapse tracking for async widgets
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
    } catch { /* TT is optional */ }
  })();
}

/* Helper for notification click routing — extract action items */
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

/* ── My Timetable — full day grid ── */
export function buildMyTimetable(teacherRow) {
  if (!teacherRow) return '';
  const pk = getTTPeriodKey();
  if (!pk) return '';
  const { dayStr, period, weekType } = pk;

  const periodTimes = [
    '7:30', '8:10', '8:50', '9:30', '10:20', '11:00', '11:40', '12:20', '1:10', '1:50', '2:30'
  ];
  const periodEndTimes = [
    '8:10', '8:50', '9:30', '10:10', '11:00', '11:40', '12:20', '1:00', '1:50', '2:30', '3:10'
  ];

  const rows = [];
  for (let p = 1; p <= 11; p++) {
    const col = `${weekType}${dayStr}${p}`;
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
      <div style="width:80px;font-size:0.75rem;color:var(--ink-faint);flex-shrink:0;">${periodTimes[r.p - 1]}–${periodEndTimes[r.p - 1]}</div>
      <div style="flex:1;font-weight:${r.hasClass ? '600' : '400'};color:var(--ink);">${r.hasClass ? r.classCode : freeLabel}</div>
      ${r.room ? `<div style="font-size:0.75rem;color:var(--ink-muted);">${r.room}</div>` : ''}
      ${r.isCurrent ? '<span class="badge badge-blue" style="font-size:0.625rem;">NOW</span>' : ''}
    </div>`;
  }).join('');

  return `
    <div style="margin-bottom:var(--sp-8);">
      <div class="section-header">
        <h2 class="section-title" style="font-size:1.125rem;">My Timetable</h2>
        <span style="font-size:0.75rem;color:var(--ink-muted);">${weekType} Week &middot; ${dayStr}</span>
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        ${rowsHTML}
      </div>
    </div>`;
}
