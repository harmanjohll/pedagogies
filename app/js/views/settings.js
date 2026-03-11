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
import { EEE_REGISTRY, PEDAGOGY_APPROACHES, getEEESelections, saveEEESelections, getEEESidebarSelections, saveEEESidebarSelections } from './lesson-planner.js';
import { startTour, resetTour } from '../components/spotlight-tour.js';

/* ── Dashboard Layout Prefs ── */
const DASH_PREFS_KEY = 'cocher_dashboard_prefs';

const DEFAULT_WIDGET_ORDER = [
  'schedule', 'activityFeed', 'notifications', 'weeklyOverview', 'suggestions',
  'quickActions', 'stats', 'studentSpotlight', 'prepChecklist', 'insights',
  'reflections', 'recentGrid', 'timetable', 'classes', 'studentData'
];

const DEFAULT_WIDGET_LABELS = {
  schedule:       "Today's Schedule",
  activityFeed:   'Recent Work',
  notifications:  'Notifications & Reminders',
  weeklyOverview: 'Weekly Overview',
  suggestions:    'Suggested for You',
  quickActions:   'Quick Actions',
  stats:          'Stats',
  studentSpotlight: 'Student Spotlight',
  prepChecklist:  'Lesson Prep Checklist',
  insights:       'Teaching Insights',
  reflections:    'Reflection Analytics',
  recentGrid:     'Recent Lessons / Events / Activity',
  timetable:      'My Timetable',
  classes:        'Your Classes',
  studentData:    'Student Learning Data'
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

/* ── Subject categories for marketplace grouping ── */
const EEE_SUBJECT_GROUPS = [
  { id: 'all', label: 'All Tools' },
  { id: 'sciences', label: 'Sciences', match: ['Science', 'Chemistry', 'Physics', 'Biology', 'Geography'] },
  { id: 'math', label: 'Mathematics', match: ['Mathematics'] },
  { id: 'languages', label: 'Languages', match: ['English', 'Chinese', 'Malay', 'Tamil'] },
  { id: 'humanities', label: 'Humanities', match: ['History', 'Social Studies', 'General Paper', 'Geography'] },
  { id: 'arts', label: 'Arts & Music', match: ['Art', 'Music'] },
  { id: 'applied', label: 'Applied', match: ['D&T', 'Design & Technology', 'NFS', 'Food & Nutrition', 'FCE'] },
  { id: 'cce', label: 'CCE & Values', match: ['CCE', 'Social Studies'] },
];

function getToolSubjectGroup(entry) {
  if (!entry.subjects || entry.subjects.includes('all')) return 'universal';
  return 'subject-specific';
}

function toolMatchesGroup(entry, groupId) {
  if (groupId === 'all') return true;
  const group = EEE_SUBJECT_GROUPS.find(g => g.id === groupId);
  if (!group || !group.match) return false;
  if (!entry.subjects) return false;
  if (entry.subjects.includes('all')) return true;
  return entry.subjects.some(s => group.match.includes(s));
}

/* ── Pedagogy signpost text ── */
const PEDAGOGY_SIGNPOSTS = {
  differentiation: 'Try for differentiated practice',
  inquiry: 'Great for inquiry-based lessons',
  collaborative: 'Supports collaborative learning',
  direct: 'Useful for direct instruction',
  assessment: 'Supports assessment for learning',
  e21cc: 'Develops 21st century competencies',
  sel: 'Supports SEL & well-being',
  edtech: 'Enhances EdTech integration',
  engagement: 'Boosts student engagement',
  cce: 'Supports CCE & values education',
};

// Build rgba tint from hex — used for card backgrounds
function _hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildEEEListHTML(filterGroup = 'all', pedFilter = '') {
  const plannerSel = getEEESelections();
  const sidebarSel = getEEESidebarSelections();
  const entries = Object.entries(EEE_REGISTRY).filter(([, v]) => v.cat === 'enactment');

  // Apply subject filter (for discovery, all tools still shown)
  let filtered = filterGroup === 'all' ? entries : entries.filter(([, v]) => toolMatchesGroup(v, filterGroup));

  // Apply pedagogy filter — highlight matching, but show all
  const pedMatches = new Set();
  if (pedFilter) {
    filtered.forEach(([key, v]) => {
      if (v.pedagogy && v.pedagogy.includes(pedFilter)) pedMatches.add(key);
    });
    // Sort: matching tools first
    filtered = [...filtered].sort((a, b) => {
      const aMatch = pedMatches.has(a[0]) ? 0 : 1;
      const bMatch = pedMatches.has(b[0]) ? 0 : 1;
      return aMatch - bMatch;
    });
  }

  // Subject filter tabs — refined pill style
  let html = `<div style="margin-bottom:14px;">
    <div style="font-size:0.625rem;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Browse by Subject</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;">
      ${EEE_SUBJECT_GROUPS.map(g => {
        const isAct = filterGroup === g.id;
        return `<button class="eee-filter-btn" data-filter="${g.id}" style="
          font-size:0.6875rem;font-weight:${isAct ? '600' : '500'};font-family:inherit;
          padding:5px 14px;border-radius:999px;cursor:pointer;
          border:1px solid ${isAct ? 'var(--accent)' : 'var(--border-light, #d1d5db)'};
          background:${isAct ? 'var(--accent)' : 'var(--bg, #fff)'};
          color:${isAct ? '#fff' : 'var(--ink-secondary, #555)'};
          transition:all 0.15s;
        ">${g.label}</button>`;
      }).join('')}
    </div>
  </div>`;

  // Pedagogy filter row — refined pill style
  html += `<div style="margin-bottom:14px;">
    <div style="font-size:0.625rem;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Filter by Pedagogical Approach</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;">
      <button class="eee-ped-btn" data-ped="" style="
        font-size:0.6875rem;font-weight:${!pedFilter ? '600' : '500'};font-family:inherit;
        padding:5px 14px;border-radius:999px;cursor:pointer;
        border:1px solid ${!pedFilter ? '#6366f1' : 'var(--border-light, #d1d5db)'};
        background:${!pedFilter ? '#6366f1' : 'var(--bg, #fff)'};
        color:${!pedFilter ? '#fff' : 'var(--ink-secondary, #555)'};
        transition:all 0.15s;
      ">All</button>
      ${PEDAGOGY_APPROACHES.map(p => {
        const isAct = pedFilter === p.id;
        return `<button class="eee-ped-btn" data-ped="${p.id}" style="
          font-size:0.6875rem;font-weight:${isAct ? '600' : '500'};font-family:inherit;
          padding:5px 14px;border-radius:999px;cursor:pointer;
          border:1px solid ${isAct ? '#6366f1' : 'var(--border-light, #d1d5db)'};
          background:${isAct ? '#6366f1' : 'var(--bg, #fff)'};
          color:${isAct ? '#fff' : 'var(--ink-secondary, #555)'};
          transition:all 0.15s;
        ">${p.label}</button>`;
      }).join('')}
    </div>
  </div>`;

  // Select/deselect all row
  html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;margin-bottom:10px;background:var(--bg-subtle, #f8f9fa);border-radius:10px;border:1px solid var(--border-light, #e5e7eb);">
    <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);">Select / Deselect All</div>
    <div style="display:flex;gap:16px;">
      <label style="font-size:0.6875rem;font-weight:500;color:var(--ink-secondary);display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" id="eee-sidebar-all" ${sidebarSel.length === entries.length ? 'checked' : ''} /> Sidebar</label>
      <label style="font-size:0.6875rem;font-weight:500;color:var(--ink-secondary);display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" id="eee-planner-all" ${plannerSel.length >= entries.length ? 'checked' : ''} /> Planner</label>
    </div>
  </div>`;

  // Marketplace card grid — 3-4 columns
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">`;
  filtered.forEach(([key, v]) => {
    const inPlanner = plannerSel.includes(key);
    const inSidebar = sidebarSel.includes(key);
    const isActive = inPlanner || inSidebar;
    const meta = COMPONENT_META_SETTINGS[key];
    const color = meta?.color || 'var(--accent)';
    const isPedMatch = pedFilter && pedMatches.has(key);
    const dimmed = pedFilter && !pedMatches.has(key);

    // Sub-type badge — mode-safe using CSS vars for text, tinted bg
    const typeBadge = v.type === 'tool'
      ? `<span style="font-size:0.5625rem;font-weight:600;padding:2px 8px;border-radius:6px;background:${_hexToRGBA('#0d9488', 0.14)};color:var(--ink-secondary);border:1px solid ${_hexToRGBA('#0d9488', 0.3)};white-space:nowrap;letter-spacing:0.02em;">Teaching Tool</span>`
      : `<span style="font-size:0.5625rem;font-weight:600;padding:2px 8px;border-radius:6px;background:${_hexToRGBA('#d97706', 0.12)};color:var(--ink-secondary);border:1px solid ${_hexToRGBA('#d97706', 0.28)};white-space:nowrap;letter-spacing:0.02em;">Lesson Resource</span>`;

    // Subject tags — readable in both modes
    const subjectTags = (v.subjects || [])
      .filter(s => s !== 'all')
      .slice(0, 4)
      .map(s => `<span style="font-size:0.5625rem;font-weight:500;padding:1px 7px;border-radius:6px;background:var(--bg-subtle, #f1f5f9);color:var(--ink-secondary);border:1px solid var(--border-light, #e2e8f0);white-space:nowrap;">${s}</span>`)
      .join('');
    const allTag = (v.subjects || []).includes('all')
      ? `<span style="font-size:0.5625rem;font-weight:600;padding:2px 8px;border-radius:6px;background:${_hexToRGBA('#059669', 0.12)};color:var(--ink-secondary);border:1px solid ${_hexToRGBA('#059669', 0.28)};white-space:nowrap;">All Subjects</span>`
      : '';

    // Pedagogy signpost — uses CSS var for readability across modes
    let signpost = '';
    if (v.pedagogy && v.pedagogy.length > 0) {
      const signpostKey = pedFilter && v.pedagogy.includes(pedFilter) ? pedFilter : v.pedagogy[0];
      signpost = `<div style="font-size:0.625rem;font-style:italic;color:var(--ink-faint);margin-top:4px;line-height:1.3;">${PEDAGOGY_SIGNPOSTS[signpostKey] || ''}</div>`;
    }

    // Card styling — refined, elevated with left accent bar
    const cardBg = isActive ? _hexToRGBA(color, 0.06) : 'var(--bg-card, #fff)';
    const cardBorder = isActive ? _hexToRGBA(color, 0.5) : 'var(--border-light, #e5e7eb)';
    const activeLeftBar = isActive ? `border-left:3px solid ${color};` : 'border-left:3px solid transparent;';
    const pedGlow = isPedMatch ? `box-shadow:0 0 0 2px ${_hexToRGBA('#6366f1', 0.22)};` : '';

    html += `
    <div class="eee-marketplace-card" data-eee="${key}" style="
      padding:14px 14px 10px;border-radius:12px;
      border:1px solid ${cardBorder};${activeLeftBar}
      background:${cardBg};
      transition:all 0.15s;cursor:default;position:relative;
      box-shadow:0 1px 4px rgba(0,0,0,0.04);
      ${dimmed ? 'opacity:0.4;' : ''}
      ${pedGlow}
    ">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;">
        <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
          background:${isActive ? color : _hexToRGBA(color, 0.1)};
          color:${isActive ? '#fff' : color};font-size:1rem;
          transition:all 0.15s;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${meta?.icon || '<circle cx="12" cy="12" r="10"/>'}</svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.8125rem;font-weight:700;color:var(--ink);margin-bottom:2px;line-height:1.3;">${v.label}</div>
          <div style="font-size:0.6875rem;color:var(--ink-muted);line-height:1.4;">${v.desc}</div>
          ${signpost}
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${typeBadge}${allTag}${subjectTags}</div>
      <div style="display:flex;gap:14px;border-top:1px solid var(--border-light, #e5e7eb);padding-top:8px;">
        <label style="font-size:0.6875rem;font-weight:500;color:var(--ink-secondary);display:flex;align-items:center;gap:5px;cursor:pointer;">
          <input type="checkbox" class="eee-planner-toggle" data-eee="${key}" ${inPlanner ? 'checked' : ''} /> Planner
        </label>
        <label style="font-size:0.6875rem;font-weight:500;color:var(--ink-secondary);display:flex;align-items:center;gap:5px;cursor:pointer;">
          <input type="checkbox" class="eee-sidebar-toggle" data-eee="${key}" ${inSidebar ? 'checked' : ''} /> Sidebar
        </label>
      </div>
    </div>`;
  });
  html += `</div>`;

  return html;
}

/* ── Flat UI NL Palette for marketplace cards ──
 * Source: flatuicolors.com/palette/nl (Dutch Palette by Jeroen van Eerden)
 * Assigned per-tool for harmonious, light-touch colour coding.
 */
const COMPONENT_META_SETTINGS = {
  youtubeVideos:   { color: '#EA2027', icon: '<polygon points="5 3 19 12 5 21 5 3"/>' },                    // Red Pigment
  simulations:     { color: '#12CBC4', icon: '<path d="M9 3h6v3H9z"/><path d="M7 6h10l2 4-4 3 4 3-2 5H7l-2-5 4-3-4-3z"/>' }, // Blue Martina
  worksheet:       { color: '#0652DD', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/>' }, // Merchant Marine Blue
  externalLinks:   { color: '#A3CB38', icon: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>' }, // Android Green
  stimulus:        { color: '#1289A7', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>' }, // Mediterranean Sea
  vocabulary:      { color: '#F79F1F', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>' }, // Radiant Yellow
  modelResponse:   { color: '#B53471', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>' }, // Very Berry
  sourceAnalysis:  { color: '#5758BB', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>' }, // Circumorbital Ring
  seatPlan:        { color: '#006266', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>' }, // Turkish Aqua
  cceDiscussion:   { color: '#ED4C67', icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' }, // Bara Red
  discussionPrompts: { color: '#FFC312', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' }, // Sunflower
  staveNotation:   { color: '#9980FA', icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' }, // Forgotten Purple
  rhythmTool:      { color: '#D980FA', icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/>' }, // Lavender Tea
  artCritique:     { color: '#FDA7DF', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' }, // Lavender Rose
  designProcess:   { color: '#1289A7', icon: '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>' }, // Mediterranean Sea
  recipeBuilder:   { color: '#EE5A24', icon: '<path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10H5a7 7 0 0 0 14 0z"/>' }, // Puffins Bill
  kitchenLayout:   { color: '#009432', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>' }, // Pixelated Grass
};

export function render(container) {
  const apiKey = Store.get('apiKey') || '';
  const model = Store.get('model') || 'gemini-2.5-flash';
  const darkMode = Store.get('darkMode');
  const dashPrefs = getDashPrefs();

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width: 960px;">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Enactment
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
          <button class="settings-tab" data-tab="help" style="
            display:inline-flex;align-items:center;gap:6px;padding:8px 16px;font-size:0.8125rem;font-weight:400;
            color:var(--ink-muted);background:transparent;
            border:none;border-bottom:2px solid transparent;margin-bottom:-2px;
            border-radius:var(--radius-md) var(--radius-md) 0 0;cursor:pointer;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Help & Guides
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

        <!-- EEE: Enactment Enhancement Marketplace -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
            <div style="width:36px;height:36px;border-radius:10px;background:var(--accent-light, rgba(67,97,238,0.08));display:flex;align-items:center;justify-content:center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div>
              <h3 style="font-size: 1.0625rem; font-weight: 700; margin: 0; color: var(--ink);">Enactment &mdash; Tools &amp; Resources</h3>
            </div>
          </div>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: 16px; line-height: 1.6;">
            Browse <strong style="color:var(--ink-secondary);">Teaching Tools</strong> (interactive, run in class) and <strong style="color:var(--ink-secondary);">Lesson Resources</strong> (display or distribute).
            Filter by subject or pedagogical approach. Toggle <strong style="color:var(--ink-secondary);">Planner</strong> to add to the toolbar,
            or <strong style="color:var(--ink-secondary);">Sidebar</strong> to pin to navigation.
          </p>

          <!-- Core tools (always on, shown for reference) -->
          <div style="margin-bottom: 16px;padding:10px 14px;background:var(--bg-subtle, #f8f9fa);border-radius:10px;border:1px solid var(--border-light, #e5e7eb);">
            <div style="font-size: 0.625rem; font-weight: 700; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">Core Tools (always available)</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${Object.entries(EEE_REGISTRY).filter(([,v]) => v.cat === 'core').map(([, v]) =>
                `<span style="font-size:0.6875rem;font-weight:500;padding:3px 10px;border-radius:6px;background:var(--bg, #fff);color:var(--ink-secondary);border:1px solid var(--border-light, #e2e8f0);">${v.label}</span>`
              ).join('')}
            </div>
          </div>

          <!-- Marketplace tools grid -->
          <div id="eee-tool-list">
            ${buildEEEListHTML()}
          </div>
          <button class="btn btn-primary btn-sm" id="eee-save-btn" style="margin-top:12px;">Save Enactment Tools</button>
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

        <!-- TAB: Help & Guides -->
        <div class="settings-panel" data-panel="help" style="display:none;">

          <div style="margin-bottom:var(--sp-5);padding:var(--sp-4);border:1px solid var(--border-light,#e5e7eb);border-radius:var(--radius,8px);background:var(--bg-card,#fff);">
            <h3 style="font-size:1rem;font-weight:600;margin-bottom:var(--sp-1);color:var(--ink);">Guided Tour</h3>
            <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">
              Take a guided walkthrough of Co-Cher's main features. The tour highlights key areas of the interface with explanations.
            </p>
            <button class="btn btn-primary btn-sm" id="replay-tour-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Guided Tour
            </button>
          </div>

          <div style="margin-bottom:var(--sp-5);">
            <h3 style="font-size:1rem;font-weight:600;margin-bottom:var(--sp-3);color:var(--ink);">Module Quick Reference</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--sp-3);">

              <div style="padding:var(--sp-3);border:1px solid var(--border-light,#e5e7eb);border-radius:var(--radius,8px);border-left:3px solid #4361ee;">
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:4px;">Lesson Planner</div>
                <div style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Design lessons with AI assistance. Select a class, set objectives, and Co-Cher generates activities aligned to E21CC and your SoW. Use enactment tools for YouTube, worksheets, and more.</div>
              </div>

              <div style="padding:var(--sp-3);border:1px solid var(--border-light,#e5e7eb);border-radius:var(--radius,8px);border-left:3px solid #22c55e;">
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:4px;">My Classes</div>
                <div style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Set up classes with subject, level, and student names. Class info feeds into the lesson planner for personalised suggestions and seating plans.</div>
              </div>

              <div style="padding:var(--sp-3);border:1px solid var(--border-light,#e5e7eb);border-radius:var(--radius,8px);border-left:3px solid #f59e0b;">
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:4px;">Knowledge Base</div>
                <div style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Upload your Scheme of Work and reference materials. Co-Cher uses these as context when generating lesson content, ensuring alignment with your teaching plan.</div>
              </div>

              <div style="padding:var(--sp-3);border:1px solid var(--border-light,#e5e7eb);border-radius:var(--radius,8px);border-left:3px solid #8b5cf6;">
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:4px;">Assessment (AaL / AfL / AoL)</div>
                <div style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Three assessment modes: AaL for metacognitive reflections, AfL for formative exit tickets, and AoL for summative tests with Table of Specifications and Bloom's taxonomy alignment.</div>
              </div>

              <div style="padding:var(--sp-3);border:1px solid var(--border-light,#e5e7eb);border-radius:var(--radius,8px);border-left:3px solid #ec4899;">
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:4px;">Spatial Designer</div>
                <div style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Plan classroom layouts for PE circuits, group work, or lab setups. Drag equipment and student positions on a grid. Includes preset templates and E21CC alignment.</div>
              </div>

              <div style="padding:var(--sp-3);border:1px solid var(--border-light,#e5e7eb);border-radius:var(--radius,8px);border-left:3px solid #06b6d4;">
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:4px;">Simulations</div>
                <div style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Browse and launch science simulations and interactives covering Biology, Chemistry, and Physics. Includes molecular builders, particle dynamics, and more.</div>
              </div>

            </div>
          </div>

          <div style="padding:var(--sp-4);border:1px solid var(--border-light,#e5e7eb);border-radius:var(--radius,8px);background:var(--bg-card,#fff);">
            <h3 style="font-size:1rem;font-weight:600;margin-bottom:var(--sp-1);color:var(--ink);">How Preferences Work</h3>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-2);">
              Your <strong>pedagogical priorities</strong> (set during onboarding or in General settings) directly influence how Co-Cher generates lesson content:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.7;padding-left:20px;margin:0;">
              <li><strong>Differentiated Instruction</strong> — AI generates tiered activities and scaffolded content for diverse learners</li>
              <li><strong>Collaborative Learning</strong> — Suggestions emphasise group work, discussion protocols, and peer activities</li>
              <li><strong>Critical Thinking</strong> — Higher-order questions and analysis tasks are prioritised</li>
              <li><strong>Student-Centred</strong> — Activities shift focus from teacher-led to student-driven exploration</li>
              <li><strong>Assessment for Learning</strong> — Formative check-ins and exit tickets are woven into lesson plans</li>
              <li><strong>ICT Integration</strong> — Digital tools and simulations are recommended where appropriate</li>
            </ul>
            <p style="font-size:0.75rem;color:var(--ink-faint);margin-top:var(--sp-2);margin-bottom:0;">
              These priorities are injected into AI prompts as context. You can update them anytime in the General tab above.
            </p>
          </div>

        </div><!-- end help panel -->

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

  // EEE marketplace — save, filter, card visual updates
  let currentEEEFilter = 'all';

  // Helper: convert hex color to rgba with alpha
  function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const saveEEE = () => {
    const plannerChecked = [...container.querySelectorAll('.eee-planner-toggle:checked')].map(cb => cb.dataset.eee);
    const sidebarChecked = [...container.querySelectorAll('.eee-sidebar-toggle:checked')].map(cb => cb.dataset.eee);
    saveEEESelections(plannerChecked);
    saveEEESidebarSelections(sidebarChecked);
    Store.set('_eeeUpdated', Date.now());
    // Update card visual states
    container.querySelectorAll('.eee-marketplace-card').forEach(card => {
      const key = card.dataset.eee;
      const meta = COMPONENT_META_SETTINGS[key];
      const color = meta?.color || '#4361ee';
      const inP = plannerChecked.includes(key);
      const inS = sidebarChecked.includes(key);
      const active = inP || inS;
      card.style.borderColor = active ? color : 'var(--border-light, #e5e7eb)';
      card.style.background = active ? hexToRGBA(color, 0.08) : 'var(--bg-card, #fff)';
      const iconBox = card.querySelector('div > div > div:first-child');
      if (iconBox && iconBox.style) {
        iconBox.style.background = active ? color : 'var(--bg-subtle)';
        iconBox.style.color = active ? '#fff' : 'var(--ink-muted)';
      }
    });
    return { planner: plannerChecked, sidebar: sidebarChecked };
  };

  // Default pedagogy filter from onboarding priorities
  const savedPriorities = Store.get('pedagogicalPriorities') || [];
  let currentPedFilter = savedPriorities.length > 0 ? savedPriorities[0] : '';

  const rerenderEEEList = () => {
    const listEl = container.querySelector('#eee-tool-list');
    if (listEl) listEl.innerHTML = buildEEEListHTML(currentEEEFilter, currentPedFilter);
  };

  // ── Event delegation: ONE listener on #eee-tool-list, never re-attached ──
  const eeeListContainer = container.querySelector('#eee-tool-list');
  if (eeeListContainer) {
    // Click delegation for filter buttons
    eeeListContainer.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.eee-filter-btn');
      if (filterBtn) {
        currentEEEFilter = filterBtn.dataset.filter;
        rerenderEEEList();
        return;
      }
      const pedBtn = e.target.closest('.eee-ped-btn');
      if (pedBtn) {
        currentPedFilter = pedBtn.dataset.ped;
        rerenderEEEList();
        return;
      }
    });

    // Change delegation for checkboxes
    eeeListContainer.addEventListener('change', (e) => {
      const target = e.target;
      // Individual planner/sidebar toggle
      if (target.classList.contains('eee-planner-toggle') || target.classList.contains('eee-sidebar-toggle')) {
        saveEEE();
        return;
      }
      // Select/deselect ALL sidebar
      if (target.id === 'eee-sidebar-all') {
        container.querySelectorAll('.eee-sidebar-toggle').forEach(cb => { cb.checked = target.checked; });
        saveEEE();
        return;
      }
      // Select/deselect ALL planner
      if (target.id === 'eee-planner-all') {
        container.querySelectorAll('.eee-planner-toggle').forEach(cb => { cb.checked = target.checked; });
        saveEEE();
        return;
      }
    });
  }

  // Apply default pedagogy filter from onboarding priorities (initial render)
  if (currentPedFilter) {
    rerenderEEEList();
  }

  container.querySelector('#eee-save-btn')?.addEventListener('click', () => {
    const { planner, sidebar } = saveEEE();
    showToast(`Tools updated — ${planner.length} in Planner, ${sidebar.length} in Sidebar.`, 'success');
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
          if (eeeList) eeeList.innerHTML = buildEEEListHTML(currentEEEFilter, currentPedFilter);
        }
      }
    }
  });

  // ── Replay Tour ──
  container.querySelector('#replay-tour-btn')?.addEventListener('click', () => {
    resetTour('main');
    startTour('main');
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
