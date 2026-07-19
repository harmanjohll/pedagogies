/*
 * Co-Cher Workflow Modes
 * ======================
 * One-tap "modes" that reconfigure the app for the job at hand. A mode is a
 * declarative bundle that COMPOSES existing dashboard/sidebar prefs — it does
 * NOT replace the role-presets or the EEE marketplace, it complements them.
 *
 * Reversibility model — SNAPSHOT + RESTORE
 * ----------------------------------------
 * The teacher's hand-customisations must never be lost. When the FIRST mode is
 * applied we snapshot the teacher's own baseline (dashboard hiddenWidgets,
 * pinnedLinks, layoutStyle + sidebar collapsed-sections) into a backup key.
 * Applying a mode then composes the mode ONTO that baseline. Switching between
 * modes always restores the baseline first, so modes never stack destructively.
 * Clearing the mode restores the baseline verbatim and deletes the backup.
 *
 *   apply(first)  : snapshot baseline → compose mode
 *   apply(switch) : restore baseline (keep backup) → compose new mode
 *   clear         : restore baseline → delete backup + active-mode keys
 *
 * We read/write the raw dashboard-prefs object directly (preserving every other
 * key: widgetOrder, widgetNames, widgetSizes, …) rather than importing the
 * dashboard view — the dashboard owns its own getDashPrefs/saveDashPrefs and we
 * must not couple to (or edit) it. Both readers default any missing key, so a
 * partial write is safe.
 */

const DASH_PREFS_KEY = 'cocher_v6_1_dashboard_prefs';
const COLLAPSED_KEY  = 'cocher_v6_1_sidebar_collapsed';
const MODE_KEY       = 'cocher_v6_1_workflow_mode';
const BACKUP_KEY     = 'cocher_v6_1_workflow_mode_backup';

/* ── Declarative mode definitions ──
 * emphasizeWidgets : ensure these dashboard widgets are visible (un-hidden)
 * hideWidgets      : hide these dashboard widgets
 * pinnedLinks      : surface these dashboard quick-links (union with existing)
 * layoutStyle      : optional dashboard layout ('calm' | 'classic')
 * sidebarGroups    : sidebar section labels to foreground (expanded + highlighted)
 */
const MODES = [
  {
    id: 'planning',
    label: 'Planning',
    hint: 'Design & prep — schemes, lessons, resources',
    icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    emphasizeWidgets: ['weeklyOverview', 'suggestions', 'prepChecklist', 'schedule'],
    hideWidgets: ['studentData', 'reflections', 'studentSpotlight'],
    pinnedLinks: ['lesson-planner', 'knowledge', 'classes'],
    layoutStyle: 'classic',
    sidebarGroups: ['Design', 'Enactment'],
  },
  {
    id: 'teaching',
    label: 'Teaching Day',
    hint: 'In front of the class — today, tools, spaces',
    icon: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
    emphasizeWidgets: ['schedule', 'timetable', 'quickActions', 'notifications'],
    hideWidgets: ['reflections', 'insights', 'stats', 'studentData'],
    pinnedLinks: ['spatial', 'simulations', 'lessons'],
    layoutStyle: 'calm',
    sidebarGroups: ['Design', 'Enactment', 'Culture'],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    hint: 'Marking & feedback — data, students, AfL',
    icon: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>',
    emphasizeWidgets: ['studentData', 'studentSpotlight', 'stats', 'notifications'],
    hideWidgets: ['suggestions', 'prepChecklist', 'timetable'],
    pinnedLinks: ['assessment-afl', 'classes', 'knowledge'],
    layoutStyle: 'classic',
    sidebarGroups: ['Assessment', 'Culture'],
  },
  {
    id: 'reflection',
    label: 'Reflection',
    hint: 'Look back & grow — insights, portfolio',
    icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    emphasizeWidgets: ['reflections', 'insights', 'activityFeed'],
    hideWidgets: ['quickActions', 'timetable', 'prepChecklist', 'notifications'],
    pinnedLinks: ['my-growth', 'lessons'],
    layoutStyle: 'calm',
    sidebarGroups: ['Growth'],
  },
];

/* ── Low-level localStorage helpers (all defensive) ── */
function readDash() {
  try {
    const p = JSON.parse(localStorage.getItem(DASH_PREFS_KEY) || '{}');
    return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
  } catch { return {}; }
}
function writeDash(p) {
  try { localStorage.setItem(DASH_PREFS_KEY, JSON.stringify(p)); } catch { /* quota */ }
}
function readCollapsed() {
  try {
    const a = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch { return []; }
}
function writeCollapsed(a) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(a)); } catch { /* quota */ }
}

/* ── Backup (baseline) capture / restore ── */
function saveBackup() {
  const d = readDash();
  const backup = {
    hiddenWidgets: Array.isArray(d.hiddenWidgets) ? [...d.hiddenWidgets] : [],
    pinnedLinks: Array.isArray(d.pinnedLinks) ? [...d.pinnedLinks] : [],
    // null sentinel = layoutStyle was unset, so restore should delete the key
    layoutStyle: (typeof d.layoutStyle === 'string' && d.layoutStyle) ? d.layoutStyle : null,
    collapsed: readCollapsed(),
  };
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(backup)); } catch { /* quota */ }
}
function getBackup() {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); } catch { return null; }
}
function restoreBackup() {
  const b = getBackup();
  if (!b) return;
  const d = readDash();
  d.hiddenWidgets = Array.isArray(b.hiddenWidgets) ? [...b.hiddenWidgets] : [];
  d.pinnedLinks = Array.isArray(b.pinnedLinks) ? [...b.pinnedLinks] : [];
  if (b.layoutStyle == null) delete d.layoutStyle;
  else d.layoutStyle = b.layoutStyle;
  writeDash(d);
  writeCollapsed(Array.isArray(b.collapsed) ? b.collapsed : []);
}

/* ── Compose a mode onto whatever prefs are currently persisted (the baseline) ── */
function composeMode(mode) {
  const d = readDash();

  let hidden = Array.isArray(d.hiddenWidgets) ? [...d.hiddenWidgets] : [];
  (mode.hideWidgets || []).forEach(w => { if (!hidden.includes(w)) hidden.push(w); });
  hidden = hidden.filter(w => !(mode.emphasizeWidgets || []).includes(w));
  d.hiddenWidgets = hidden;

  const pins = Array.isArray(d.pinnedLinks) ? [...d.pinnedLinks] : [];
  (mode.pinnedLinks || []).forEach(p => { if (!pins.includes(p)) pins.push(p); });
  d.pinnedLinks = pins;

  if (mode.layoutStyle) d.layoutStyle = mode.layoutStyle;

  writeDash(d);

  // Sidebar foreground: make sure the mode's groups are expanded (visible).
  if (Array.isArray(mode.sidebarGroups) && mode.sidebarGroups.length) {
    const collapsed = readCollapsed().filter(s => !mode.sidebarGroups.includes(s));
    writeCollapsed(collapsed);
  }
}

/* ══════════ Public API ══════════ */

/** All available modes (id, label, hint, icon path, sidebarGroups). */
export function getModes() {
  return MODES.map(m => ({
    id: m.id,
    label: m.label,
    hint: m.hint,
    icon: m.icon,
    sidebarGroups: [...(m.sidebarGroups || [])],
  }));
}

/** The active mode id, or null. Unknown/stale ids resolve to null. */
export function getActiveMode() {
  let id = null;
  try { id = localStorage.getItem(MODE_KEY); } catch { id = null; }
  if (!id) return null;
  return MODES.some(m => m.id === id) ? id : null;
}

/**
 * Persist the active-mode key ONLY (low-level). Passing a falsy id clears the
 * mode and restores the baseline. Most callers should use applyMode instead.
 */
export function setActiveMode(id) {
  if (!id) { clearMode(); return; }
  try { localStorage.setItem(MODE_KEY, id); } catch { /* quota */ }
}

/** Foreground sidebar section labels for the active (or given) mode. */
export function getModeSidebarGroups(id) {
  const mode = MODES.find(m => m.id === (id || getActiveMode()));
  return mode ? [...(mode.sidebarGroups || [])] : [];
}

/**
 * Apply a mode (or clear it when id is falsy). Reversible: the teacher's own
 * prefs are snapshotted before the first mode and restored on clear/switch.
 */
export function applyMode(id) {
  if (!id) { clearMode(); return; }
  const mode = MODES.find(m => m.id === id);
  if (!mode) return;

  const active = getActiveMode();
  if (active) {
    // Switching modes: peel back to the teacher's baseline first (backup is
    // preserved), then compose the new mode onto it — never onto mode A.
    restoreBackup();
  } else {
    // First mode: capture the teacher's own prefs so we can put them back.
    saveBackup();
  }

  composeMode(mode);
  try { localStorage.setItem(MODE_KEY, id); } catch { /* quota */ }
}

/** Clear any active mode and restore the teacher's snapshotted baseline. */
export function clearMode() {
  restoreBackup();
  try {
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(MODE_KEY);
  } catch { /* ignore */ }
}
