/*
 * Co-Cher Settings
 * ================
 * API key, model selection, theme, and data management.
 */

import { Store } from '../state.js';
import { validateApiKey, AVAILABLE_MODELS } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modals.js';
import { getCurrentUser, clearCurrentUser } from '../components/login.js';
import { EEE_REGISTRY, getEEESelections, saveEEESelections, getEEESidebarSelections, saveEEESidebarSelections } from './lesson-planner.js';

/* ── Dashboard Layout Prefs ── */
const DASH_PREFS_KEY = 'cocher_dashboard_prefs';

const DEFAULT_WIDGET_ORDER = [
  'schedule', 'notifications', 'weeklyOverview', 'suggestions',
  'quickActions', 'stats', 'prepChecklist', 'insights',
  'reflections', 'recentGrid', 'timetable', 'classes'
];

const DEFAULT_WIDGET_LABELS = {
  schedule:       "Today's Schedule",
  notifications:  'Notifications & Reminders',
  weeklyOverview: 'Weekly Overview',
  suggestions:    'Suggested for You',
  quickActions:   'Quick Actions',
  stats:          'Stats',
  prepChecklist:  'Lesson Prep Checklist',
  insights:       'Teaching Insights',
  reflections:    'Reflection Analytics',
  recentGrid:     'Recent Lessons / Events / Activity',
  timetable:      'My Timetable',
  classes:        'Your Classes'
};

const ROLE_PRESETS = {
  teacher: {
    hiddenWidgets: [],
    description: 'All teaching-focused widgets'
  },
  hod: {
    hiddenWidgets: ['prepChecklist', 'timetable'],
    description: 'Focus on insights, stats, and classes'
  },
  admin: {
    hiddenWidgets: ['prepChecklist', 'suggestions', 'reflections', 'timetable'],
    description: 'Focus on stats, notifications, and admin'
  },
  all: {
    hiddenWidgets: [],
    description: 'Show everything'
  }
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
        widgetNames: p.widgetNames || {}
      };
    }
  } catch {}
  return {
    widgetOrder: [...DEFAULT_WIDGET_ORDER],
    hiddenWidgets: [],
    collapsedWidgets: [],
    pinnedLinks: [],
    defaultView: 'full',
    widgetNames: {}
  };
}

function saveDashPrefs(prefs) {
  try { localStorage.setItem(DASH_PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

function buildWidgetListHTML(prefs) {
  const order = prefs.widgetOrder.length > 0 ? [...prefs.widgetOrder] : [...DEFAULT_WIDGET_ORDER];
  DEFAULT_WIDGET_ORDER.forEach(w => { if (!order.includes(w)) order.push(w); });

  return order.map(wId => {
    const visible = !prefs.hiddenWidgets.includes(wId);
    const customName = prefs.widgetNames?.[wId] || '';
    const displayName = customName || DEFAULT_WIDGET_LABELS[wId] || wId;
    return `<div class="dash-widget-row" data-widget="${wId}" draggable="true" style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);border:1px solid var(--border-light, #e5e7eb);border-radius:var(--radius, 8px);cursor:grab;background:var(--bg-card, #fff);transition:box-shadow 0.15s;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;cursor:grab;"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      <label style="display:flex;align-items:center;gap:var(--sp-2);flex-shrink:0;">
        <input type="checkbox" class="dash-widget-toggle" data-widget="${wId}" ${visible ? 'checked' : ''} />
      </label>
      <span class="dash-widget-name" data-widget="${wId}" style="flex:1;font-size:0.8125rem;font-weight:500;color:var(--ink);cursor:pointer;padding:2px 4px;border-radius:4px;border:1px solid transparent;" title="Click to rename">${displayName}</span>
      ${customName ? `<button class="dash-widget-reset-name btn btn-ghost" data-widget="${wId}" style="padding:2px 6px;font-size:0.625rem;color:var(--ink-faint);" title="Reset to default name">reset</button>` : ''}
    </div>`;
  }).join('');
}

/* ── Subject detection from class name / CSV ── */
const SUBJECT_KEYWORDS = {
  'Chemistry': ['chemistry', 'chem'],
  'Physics': ['physics', 'phy'],
  'Biology': ['biology', 'bio'],
  'Science': ['science', 'sci'],
  'Mathematics': ['mathematics', 'math', 'maths', 'a math', 'e math', 'a-math', 'e-math'],
  'English': ['english', 'eng lang', 'english language', 'el'],
  'Chinese': ['chinese', 'cl', 'hcl', 'higher chinese'],
  'Malay': ['malay', 'ml', 'hml'],
  'Tamil': ['tamil', 'tl', 'htl'],
  'History': ['history', 'hist'],
  'Geography': ['geography', 'geog'],
  'Social Studies': ['social studies', 'ss'],
  'General Paper': ['general paper', 'gp'],
};

function detectSubjectsFromName(name) {
  const lower = name.toLowerCase();
  const found = [];
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      found.push(subject);
    }
  }
  return found;
}

function suggestEEEsForSubjects(subjects) {
  const suggested = new Set();
  for (const [key, entry] of Object.entries(EEE_REGISTRY)) {
    if (entry.cat !== 'enactment') continue;
    if (!entry.subjects) continue;
    if (entry.subjects.includes('all')) { suggested.add(key); continue; }
    for (const subj of subjects) {
      if (entry.subjects.includes(subj)) { suggested.add(key); break; }
    }
  }
  return [...suggested];
}

function buildEEEListHTML() {
  const plannerSel = getEEESelections();
  const sidebarSel = getEEESidebarSelections();
  const entries = Object.entries(EEE_REGISTRY).filter(([, v]) => v.cat === 'enactment');

  // Header row
  let html = `<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:var(--sp-2);align-items:center;padding:0 var(--sp-3);margin-bottom:var(--sp-1);">
    <div style="font-size:0.6875rem;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;">Tool</div>
    <div style="font-size:0.6875rem;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;text-align:center;">Sidebar</div>
    <div style="font-size:0.6875rem;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.04em;text-align:center;">Planner</div>
  </div>`;

  // Select/deselect all row
  html += `<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:var(--sp-2);align-items:center;padding:var(--sp-2) var(--sp-3);border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-subtle);margin-bottom:var(--sp-2);">
    <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);">Select / Deselect All</div>
    <div style="text-align:center;"><input type="checkbox" id="eee-sidebar-all" ${sidebarSel.length === entries.length ? 'checked' : ''} /></div>
    <div style="text-align:center;"><input type="checkbox" id="eee-planner-all" ${plannerSel.length >= entries.length ? 'checked' : ''} /></div>
  </div>`;

  // Tool rows
  entries.forEach(([key, v]) => {
    const inPlanner = plannerSel.includes(key);
    const inSidebar = sidebarSel.includes(key);
    const subjectTags = (v.subjects || [])
      .filter(s => s !== 'all')
      .slice(0, 4)
      .map(s => `<span style="font-size:0.5625rem;padding:0 5px;border-radius:8px;background:var(--bg-subtle);color:var(--ink-faint);">${s}</span>`)
      .join('');
    const allTag = (v.subjects || []).includes('all')
      ? '<span style="font-size:0.5625rem;padding:0 5px;border-radius:8px;background:var(--accent-light);color:var(--accent);">All</span>'
      : '';
    const moreCount = (v.subjects || []).filter(s => s !== 'all').length - 4;

    html += `<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:var(--sp-2);align-items:center;padding:var(--sp-2) var(--sp-3);border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-card);">
      <div style="min-width:0;">
        <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);margin-bottom:1px;">${v.label}</div>
        <div style="font-size:0.6875rem;color:var(--ink-muted);line-height:1.4;margin-bottom:2px;">${v.desc}</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;">${allTag}${subjectTags}${moreCount > 0 ? `<span style="font-size:0.5625rem;color:var(--ink-faint);">+${moreCount}</span>` : ''}</div>
      </div>
      <div style="text-align:center;"><input type="checkbox" class="eee-sidebar-toggle" data-eee="${key}" ${inSidebar ? 'checked' : ''} /></div>
      <div style="text-align:center;"><input type="checkbox" class="eee-planner-toggle" data-eee="${key}" ${inPlanner ? 'checked' : ''} /></div>
    </div>`;
  });

  return html;
}

export function render(container) {
  const apiKey = Store.get('apiKey') || '';
  const model = Store.get('model') || 'gemini-2.5-flash';
  const darkMode = Store.get('darkMode');
  const dashPrefs = getDashPrefs();

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width: 640px;">
        <div class="page-header">
          <div>
            <h1 class="page-title">Settings</h1>
            <p class="page-subtitle">Configure your Co-Cher experience.</p>
          </div>
        </div>

        <!-- Settings Tabs -->
        <div id="settings-tabs" style="display:flex;gap:2px;margin-bottom:var(--sp-4);border-bottom:2px solid var(--border-light);padding-bottom:0;">
          <button class="settings-tab active" data-tab="general" style="
            display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:0.8125rem;font-weight:600;
            color:var(--accent);background:var(--accent-light);
            border:none;border-bottom:2px solid var(--accent);margin-bottom:-2px;
            border-radius:var(--radius-md) var(--radius-md) 0 0;cursor:pointer;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            General
          </button>
          <button class="settings-tab" data-tab="planner" style="
            display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:0.8125rem;font-weight:400;
            color:var(--ink-muted);background:transparent;
            border:none;border-bottom:2px solid transparent;margin-bottom:-2px;
            border-radius:var(--radius-md) var(--radius-md) 0 0;cursor:pointer;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Lesson Planner
          </button>
          <button class="settings-tab" data-tab="dashboard" style="
            display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:0.8125rem;font-weight:400;
            color:var(--ink-muted);background:transparent;
            border:none;border-bottom:2px solid transparent;margin-bottom:-2px;
            border-radius:var(--radius-md) var(--radius-md) 0 0;cursor:pointer;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            Dashboard
          </button>
          <button class="settings-tab" data-tab="data" style="
            display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:0.8125rem;font-weight:400;
            color:var(--ink-muted);background:transparent;
            border:none;border-bottom:2px solid transparent;margin-bottom:-2px;
            border-radius:var(--radius-md) var(--radius-md) 0 0;cursor:pointer;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Data
          </button>
        </div>

        <!-- TAB: General -->
        <div class="settings-panel" data-panel="general">

        <!-- API Key -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Gemini API Key</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Your API key is stored locally in your browser. It is never sent anywhere except directly to Google's Gemini API.
          </p>
          <div class="input-group" style="margin-bottom: var(--sp-4);">
            <div class="input-with-icon">
              <input class="input" type="password" id="settings-key" value="${apiKey}" placeholder="Enter your Gemini API key..." />
              <button class="input-icon-btn" id="toggle-key-visibility" type="button" style="font-size: 0.7rem;">Show</button>
            </div>
            <p class="input-hint" style="margin-top: var(--sp-2);">
              Get a free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color: var(--accent);">Google AI Studio</a>
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: var(--sp-2);">
            <div id="key-status" style="font-size: 0.8125rem;">
              ${apiKey ? `<span class="badge badge-green badge-dot">Key configured</span>` : `<span class="badge badge-amber badge-dot">No key set</span>`}
            </div>
          </div>
        </div>

        <!-- Model -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">AI Model</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Choose which Gemini model powers Co-Cher's responses.
          </p>
          <select class="input" id="settings-model">
            ${AVAILABLE_MODELS.map(m => `
              <option value="${m.id}" ${model === m.id ? 'selected' : ''}>
                ${m.label} — ${m.description}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Appearance -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Appearance</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Customize the visual theme.
          </p>
          <label class="toggle">
            <input type="checkbox" class="toggle-input" id="settings-dark" ${darkMode ? 'checked' : ''} />
            <span class="toggle-track"></span>
            <span class="toggle-label">Dark Mode</span>
          </label>
        </div>

        <!-- Account -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Account</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            ${getCurrentUser() ? `Signed in as <strong style="color: var(--ink);">${getCurrentUser().name}</strong>` : 'Not signed in'}
          </p>
          <button class="btn btn-ghost btn-sm" id="sign-out-btn" style="color: var(--danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>

        <!-- About -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">About Co-Cher</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-3); line-height: 1.6;">
            <strong style="color: var(--ink);">Co-Cher</strong> \u2014 your co-teaching assistant. Designed for Singapore educators, Co-Cher supports lesson design, classroom enactment, assessment, admin operations, and professional growth in one place.
          </p>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-3); line-height: 1.6;">
            Grounded in the <strong style="color: var(--ink);">Singapore Teaching Practice</strong>, <strong style="color: var(--ink);">E21CC</strong>, and <strong style="color: var(--ink);">EdTech Masterplan 2030</strong>. Powered by Hattie\u2019s Visible Learning, Bloom\u2019s Taxonomy, GROW coaching, and Schraw & Dennison\u2019s metacognitive frameworks.
          </p>
          <p style="font-size: 0.75rem; color: var(--ink-faint); line-height: 1.5;">
            Created by <strong style="color: var(--ink-muted);">Harman Johll</strong><br />
            Built with care for the teaching fraternity.
          </p>
        </div>

        <!-- Save Button -->
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" id="save-settings">Save Settings</button>
        </div>

        </div><!-- end general panel -->

        <!-- TAB: Lesson Planner -->
        <div class="settings-panel" data-panel="planner" style="display:none;">

        <!-- EEE: Enactment Enhancements for Engagement -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Enactment Enhancements</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Control where each tool appears. <strong>Sidebar</strong> adds it to the left navigation panel. <strong>Planner</strong> adds it to the Lesson Planner toolbar. You can enable both, either, or neither.
          </p>

          <!-- Core tools (always on, shown for reference) -->
          <div style="margin-bottom: var(--sp-4);">
            <div style="font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: var(--sp-2);">Core Tools (always in Planner)</div>
            <div style="display: flex; flex-wrap: wrap; gap: var(--sp-2);">
              ${Object.entries(EEE_REGISTRY).filter(([,v]) => v.cat === 'core').map(([, v]) =>
                `<span class="badge badge-blue" style="font-size: 0.75rem; padding: 4px 10px;">${v.label}</span>`
              ).join('')}
            </div>
          </div>

          <!-- Enactment tools (dual toggles) -->
          <div id="eee-tool-list" style="display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4);">
            ${buildEEEListHTML()}
          </div>
          <button class="btn btn-primary btn-sm" id="eee-save-btn">Save Enactment Tools</button>
        </div>

        </div><!-- end planner panel -->

        <!-- TAB: Dashboard -->
        <div class="settings-panel" data-panel="dashboard" style="display:none;">

        <!-- Dashboard Layout -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Dashboard Layout</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Choose which widgets appear on your dashboard, rename them, reorder by dragging, and set role-based defaults.
          </p>

          <!-- Default View -->
          <div style="margin-bottom: var(--sp-4);">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Default View</label>
            <select class="input" id="settings-default-view" style="width: 100%;">
              <option value="full" ${dashPrefs.defaultView === 'full' ? 'selected' : ''}>Full Dashboard (all visible widgets)</option>
              <option value="compact" ${dashPrefs.defaultView === 'compact' ? 'selected' : ''}>Compact (schedule + quick actions only)</option>
              <option value="minimal" ${dashPrefs.defaultView === 'minimal' ? 'selected' : ''}>Minimal (schedule only)</option>
            </select>
          </div>

          <!-- Role-based Defaults -->
          <div style="margin-bottom: var(--sp-4);">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Role Preset</label>
            <div style="display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-bottom: var(--sp-2);">
              <button class="btn btn-ghost btn-sm dash-role-preset" data-role="teacher" style="font-size: 0.75rem;">Classroom Teacher</button>
              <button class="btn btn-ghost btn-sm dash-role-preset" data-role="hod" style="font-size: 0.75rem;">HOD / SH</button>
              <button class="btn btn-ghost btn-sm dash-role-preset" data-role="admin" style="font-size: 0.75rem;">Admin / VP</button>
              <button class="btn btn-ghost btn-sm dash-role-preset" data-role="all" style="font-size: 0.75rem;">Show All</button>
            </div>
            <p style="font-size: 0.6875rem; color: var(--ink-faint); line-height: 1.4;">
              Presets adjust which widgets are shown by default. You can still customise individually below.
            </p>
          </div>

          <!-- Widget Toggle List -->
          <div style="margin-bottom: var(--sp-3);">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary); text-transform: uppercase; display: block; margin-bottom: 4px;">Widgets</label>
            <p style="font-size: 0.6875rem; color: var(--ink-faint); margin-bottom: var(--sp-2);">Toggle visibility, drag to reorder, click name to rename.</p>
          </div>
          <div id="settings-widget-list" style="display: flex; flex-direction: column; gap: var(--sp-2); margin-bottom: var(--sp-4);">
            ${buildWidgetListHTML(dashPrefs)}
          </div>

          <div style="display: flex; gap: var(--sp-2);">
            <button class="btn btn-ghost btn-sm" id="dash-reset-defaults" style="color: var(--warning);">Reset to Defaults</button>
            <button class="btn btn-primary btn-sm" id="dash-save-layout">Save Dashboard Layout</button>
          </div>
        </div>

        </div><!-- end dashboard panel -->

        <!-- TAB: Data -->
        <div class="settings-panel" data-panel="data" style="display:none;">

        <!-- Import Classes from CSV -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Import Classes from CSV</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Upload a .csv file to create a class with students. The CSV should have a header row. Accepted columns:
            <code style="background: var(--bg-subtle); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">Name</code> (required),
            <code style="background: var(--bg-subtle); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">CAIT</code>,
            <code style="background: var(--bg-subtle); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">CCI</code>,
            <code style="background: var(--bg-subtle); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">CGC</code> (optional E21CC scores, 0-100).
          </p>
          <div style="display: flex; gap: var(--sp-3); align-items: center; flex-wrap: wrap;">
            <input class="input" type="text" id="csv-class-name" placeholder="Class name, e.g. 4A Pure Chemistry" style="flex: 1; min-width: 200px;" />
            <button class="btn btn-secondary btn-sm" id="csv-upload-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload CSV
            </button>
          </div>
          <input type="file" id="csv-file" accept=".csv,.txt" style="display: none;" />
          <div id="csv-preview" style="margin-top: var(--sp-3); display: none;">
            <p style="font-size: 0.8125rem; color: var(--ink-secondary); margin-bottom: var(--sp-2);" id="csv-preview-text"></p>
            <button class="btn btn-primary btn-sm" id="csv-confirm-btn">Confirm Import</button>
          </div>
          <p style="font-size: 0.75rem; color: var(--ink-faint); margin-top: var(--sp-2);">
            Tip: Export from Excel as CSV (UTF-8). One student per row. Include the subject in the class name (e.g. "4A Pure Chemistry") — Co-Cher will detect it and suggest relevant tools.
          </p>
        </div>

        <!-- Clear Sample Data -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Sample Data</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Co-Cher comes with sample classes and exemplar lessons so you can explore features. When you're ready to use your own data, clear the samples below.
          </p>
          <button class="btn btn-ghost btn-sm" id="clear-samples-btn" style="color: var(--warning);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Clear Sample Data &amp; Start Fresh
          </button>
        </div>

        <!-- Data Management -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Data Management</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Export your data for backup or import from a previous export.
          </p>
          <div style="display: flex; gap: var(--sp-3); flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="export-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Data
            </button>
            <button class="btn btn-secondary btn-sm" id="import-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import Data
            </button>
            <button class="btn btn-ghost btn-sm" id="clear-btn" style="color: var(--danger);">Clear All Data</button>
          </div>
          <input type="file" id="import-file" accept=".json" style="display: none;" />
        </div>

        </div><!-- end data panel -->

      </div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      // Update tab styles
      container.querySelectorAll('.settings-tab').forEach(t => {
        const isActive = t.dataset.tab === target;
        t.style.fontWeight = isActive ? '600' : '400';
        t.style.color = isActive ? 'var(--accent)' : 'var(--ink-muted)';
        t.style.background = isActive ? 'var(--accent-light)' : 'transparent';
        t.style.borderBottomColor = isActive ? 'var(--accent)' : 'transparent';
      });
      // Show/hide panels
      container.querySelectorAll('.settings-panel').forEach(p => {
        p.style.display = p.dataset.panel === target ? '' : 'none';
      });
    });
  });

  // Toggle key visibility
  const keyInput = container.querySelector('#settings-key');
  container.querySelector('#toggle-key-visibility').addEventListener('click', () => {
    const isPass = keyInput.type === 'password';
    keyInput.type = isPass ? 'text' : 'password';
    container.querySelector('#toggle-key-visibility').textContent = isPass ? 'Hide' : 'Show';
  });

  // Dark mode toggle
  container.querySelector('#settings-dark').addEventListener('change', (e) => {
    const dark = e.target.checked;
    Store.set('darkMode', dark);
    document.documentElement.classList.toggle('dark', dark);
  });

  // EEE save — auto-save on every toggle change
  const saveEEE = () => {
    const plannerChecked = [...container.querySelectorAll('.eee-planner-toggle:checked')].map(cb => cb.dataset.eee);
    const sidebarChecked = [...container.querySelectorAll('.eee-sidebar-toggle:checked')].map(cb => cb.dataset.eee);
    saveEEESelections(plannerChecked);
    saveEEESidebarSelections(sidebarChecked);
    // Trigger Store subscribers (sidebar re-render)
    Store.set('_eeeUpdated', Date.now());
    return { planner: plannerChecked, sidebar: sidebarChecked };
  };

  container.querySelector('#eee-save-btn')?.addEventListener('click', () => {
    const { planner, sidebar } = saveEEE();
    showToast(`Tools updated — ${planner.length} in Planner, ${sidebar.length} in Sidebar.`, 'success');
  });

  // Auto-save on individual toggle
  container.querySelectorAll('.eee-planner-toggle, .eee-sidebar-toggle').forEach(cb => {
    cb.addEventListener('change', () => saveEEE());
  });

  // Select/deselect all
  const allEnactmentKeys = Object.entries(EEE_REGISTRY).filter(([,v]) => v.cat === 'enactment').map(([k]) => k);
  container.querySelector('#eee-sidebar-all')?.addEventListener('change', (e) => {
    container.querySelectorAll('.eee-sidebar-toggle').forEach(cb => { cb.checked = e.target.checked; });
    saveEEE();
  });
  container.querySelector('#eee-planner-all')?.addEventListener('change', (e) => {
    container.querySelectorAll('.eee-planner-toggle').forEach(cb => { cb.checked = e.target.checked; });
    saveEEE();
  });

  // Save
  container.querySelector('#save-settings').addEventListener('click', () => {
    const newKey = keyInput.value.trim();
    const newModel = container.querySelector('#settings-model').value;

    if (newKey && !validateApiKey(newKey)) {
      showToast('API key seems too short. Please check it.', 'danger');
      return;
    }

    Store.set('apiKey', newKey);
    Store.set('model', newModel);
    showToast('Settings saved!', 'success');

    // Update key status
    const status = container.querySelector('#key-status');
    if (status) {
      status.innerHTML = newKey
        ? `<span class="badge badge-green badge-dot">Key configured</span>`
        : `<span class="badge badge-amber badge-dot">No key set</span>`;
    }
  });

  // Export
  container.querySelector('#export-btn').addEventListener('click', () => {
    const data = Store.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cocher-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!', 'success');
  });

  // Import
  const fileInput = container.querySelector('#import-file');
  container.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = Store.importData(reader.result);
      if (ok) {
        showToast('Data imported successfully!', 'success');
      } else {
        showToast('Failed to import data. Invalid file format.', 'danger');
      }
    };
    reader.readAsText(file);
  });

  // Clear
  container.querySelector('#clear-btn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Clear All Data',
      message: 'This will permanently delete all your classes, students, notes, and lesson data. Your API key will be kept. This cannot be undone.'
    });
    if (ok) {
      Store.clearAllData();
      showToast('All data cleared.', 'danger');
      render(container);
    }
  });

  // Sign out
  container.querySelector('#sign-out-btn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Sign Out',
      message: 'You will be signed out and your API key will be cleared. Your class and lesson data will not be deleted.'
    });
    if (ok) {
      clearCurrentUser();
      window.location.reload();
    }
  });

  // ── Dashboard Layout ──
  wireDashboardLayoutEvents(container);

  // ── CSV Upload ──
  let csvParsedStudents = [];
  const csvFileInput = container.querySelector('#csv-file');
  container.querySelector('#csv-upload-btn').addEventListener('click', () => {
    const className = container.querySelector('#csv-class-name').value.trim();
    if (!className) {
      showToast('Please enter a class name first.', 'danger');
      return;
    }
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', () => {
    const file = csvFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      csvParsedStudents = parseCSV(reader.result);
      if (csvParsedStudents.length === 0) {
        showToast('No students found in CSV. Check the format.', 'danger');
        return;
      }
      const preview = container.querySelector('#csv-preview');
      const previewText = container.querySelector('#csv-preview-text');
      previewText.textContent = `Found ${csvParsedStudents.length} students: ${csvParsedStudents.slice(0, 5).map(s => s.name).join(', ')}${csvParsedStudents.length > 5 ? '...' : ''}`;
      preview.style.display = 'block';
    };
    reader.readAsText(file);
  });

  container.querySelector('#csv-confirm-btn').addEventListener('click', () => {
    const className = container.querySelector('#csv-class-name').value.trim();
    if (!className || csvParsedStudents.length === 0) return;
    const cls = Store.addClass({ name: className });
    csvParsedStudents.forEach(s => {
      Store.addStudent(cls.id, { name: s.name, e21cc: s.e21cc });
    });
    showToast(`Class "${className}" created with ${csvParsedStudents.length} students!`, 'success');
    csvParsedStudents = [];
    container.querySelector('#csv-preview').style.display = 'none';
    container.querySelector('#csv-class-name').value = '';
    csvFileInput.value = '';

    // Subject detection from class name → suggest relevant EEEs
    const detectedSubjects = detectSubjectsFromName(className);
    if (detectedSubjects.length > 0) {
      const suggested = suggestEEEsForSubjects(detectedSubjects);
      if (suggested.length > 0) {
        const current = getEEESelections();
        const newSelections = [...new Set([...current, ...suggested])];
        saveEEESelections(newSelections);
        const addedLabels = suggested
          .filter(s => !current.includes(s))
          .map(s => EEE_REGISTRY[s]?.label)
          .filter(Boolean);
        if (addedLabels.length > 0) {
          showToast(`Detected ${detectedSubjects.join(', ')}. Enabled: ${addedLabels.join(', ')}.`, 'success');
          // Re-render EEE list if it exists
          const eeeList = container.querySelector('#eee-tool-list');
          if (eeeList) eeeList.innerHTML = buildEEEListHTML();
        }
      }
    }
  });

  // ── Clear Sample Data ──
  container.querySelector('#clear-samples-btn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Clear Sample Data',
      message: 'This will remove all sample classes, students, and exemplar lessons. Your own data (if any) and API key will be kept. Ready to start fresh?'
    });
    if (ok) {
      Store.clearAllData();
      // Reset seed flags so they don't re-seed
      localStorage.setItem('cocher_seeded', '1');
      localStorage.setItem('cocher_pd_seeded', '1');
      localStorage.setItem('cocher_lessons_seeded', '1');
      showToast('Sample data cleared. You can now add your own classes!', 'success');
      render(container);
    }
  });
}

/* ── Dashboard Layout Events ── */
function wireDashboardLayoutEvents(container) {
  const list = container.querySelector('#settings-widget-list');
  if (!list) return;

  // Drag-and-drop reorder
  let dragSrc = null;
  list.querySelectorAll('.dash-widget-row').forEach(row => {
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
        const rows = [...list.children];
        const srcIdx = rows.indexOf(dragSrc);
        const tgtIdx = rows.indexOf(row);
        if (srcIdx < tgtIdx) row.after(dragSrc);
        else row.before(dragSrc);
      }
    });
  });

  // Inline rename on click
  list.querySelectorAll('.dash-widget-name').forEach(nameEl => {
    nameEl.addEventListener('click', () => {
      const wId = nameEl.dataset.widget;
      const current = nameEl.textContent.trim();
      const input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      input.className = 'input';
      input.style.cssText = 'font-size:0.8125rem;padding:2px 6px;width:100%;';
      nameEl.replaceWith(input);
      input.focus();
      input.select();

      const commit = () => {
        const val = input.value.trim();
        const prefs = getDashPrefs();
        if (val && val !== DEFAULT_WIDGET_LABELS[wId]) {
          prefs.widgetNames = { ...(prefs.widgetNames || {}), [wId]: val };
        } else {
          const names = { ...(prefs.widgetNames || {}) };
          delete names[wId];
          prefs.widgetNames = names;
        }
        saveDashPrefs(prefs);
        // Rebuild the list to reflect changes
        list.innerHTML = buildWidgetListHTML(getDashPrefs());
        wireDashboardLayoutEvents(container);
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = current; input.blur(); } });
    });
  });

  // Reset name buttons
  list.querySelectorAll('.dash-widget-reset-name').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const wId = btn.dataset.widget;
      const prefs = getDashPrefs();
      const names = { ...(prefs.widgetNames || {}) };
      delete names[wId];
      prefs.widgetNames = names;
      saveDashPrefs(prefs);
      list.innerHTML = buildWidgetListHTML(getDashPrefs());
      wireDashboardLayoutEvents(container);
    });
  });

  // Role presets
  container.querySelectorAll('.dash-role-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.dataset.role;
      const preset = ROLE_PRESETS[role];
      if (!preset) return;
      const prefs = getDashPrefs();
      prefs.hiddenWidgets = [...preset.hiddenWidgets];
      saveDashPrefs(prefs);
      list.innerHTML = buildWidgetListHTML(getDashPrefs());
      wireDashboardLayoutEvents(container);
      showToast(`Applied "${btn.textContent.trim()}" preset.`, 'success');
    });
  });

  // Reset to defaults
  container.querySelector('#dash-reset-defaults')?.addEventListener('click', () => {
    saveDashPrefs({
      widgetOrder: [...DEFAULT_WIDGET_ORDER],
      hiddenWidgets: [],
      collapsedWidgets: [],
      pinnedLinks: [],
      defaultView: 'full',
      widgetNames: {}
    });
    // Re-render the settings page
    render(container);
    showToast('Dashboard reset to defaults.', 'success');
  });

  // Save dashboard layout
  container.querySelector('#dash-save-layout')?.addEventListener('click', () => {
    const prefs = getDashPrefs();

    // Gather order from DOM
    const newOrder = [...list.querySelectorAll('.dash-widget-row')].map(r => r.dataset.widget);
    prefs.widgetOrder = newOrder;

    // Gather visibility
    const hidden = [];
    list.querySelectorAll('.dash-widget-toggle').forEach(cb => {
      if (!cb.checked) hidden.push(cb.dataset.widget);
    });
    prefs.hiddenWidgets = hidden;

    // Default view
    const viewSel = container.querySelector('#settings-default-view');
    if (viewSel) prefs.defaultView = viewSel.value;

    saveDashPrefs(prefs);
    showToast('Dashboard layout saved! Changes will appear on your dashboard.', 'success');
  });
}

/* ── CSV Parser ── */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'student name' || h === 'student');
  if (nameIdx === -1) return [];

  const caitIdx = headers.findIndex(h => h === 'cait');
  const cciIdx = headers.findIndex(h => h === 'cci');
  const cgcIdx = headers.findIndex(h => h === 'cgc');

  const students = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = (cols[nameIdx] || '').trim();
    if (!name) continue;

    const e21cc = { cait: 50, cci: 50, cgc: 50 };
    if (caitIdx !== -1 && cols[caitIdx]) e21cc.cait = clampScore(cols[caitIdx]);
    if (cciIdx !== -1 && cols[cciIdx]) e21cc.cci = clampScore(cols[cciIdx]);
    if (cgcIdx !== -1 && cols[cgcIdx]) e21cc.cgc = clampScore(cols[cgcIdx]);

    students.push({ name, e21cc });
  }
  return students;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function clampScore(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}
