/*
 * Co-Cher Sidebar
 * ===============
 * Main navigation sidebar with icons and labels.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { EEE_REGISTRY, getEEESidebarSelections } from '../views/lesson-planner.js';

/* ── SVG Icons (Feather-style) ── */
const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  lessonPlanner: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  spatial: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  simulations: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  rehearsal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
  classes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  lessons: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  knowledge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`,
  myGrowth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  admin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>`,
  aal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  afl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  aol: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  // EEE tool icons
  youtube: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  worksheet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  externalLinks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  stimulus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  vocabulary: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  modelResponse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/></svg>`,
  sourceAnalysis: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  seatPlan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  cceDiscussion: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  staveNotation: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  rhythmTool: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg>`,
  artCritique: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  designProcess: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>`,
  recipeBuilder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10H5a7 7 0 0 0 14 0z"/></svg>`,
  kitchenLayout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  myCca: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
  autopilot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  mathSandbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/><circle cx="19" cy="19" r="2"/></svg>`,
};

/* ── EEE-to-sidebar mapping: which EEE keys get sidebar nav items ── */
const EEE_NAV_MAP = {
  simulations:    { route: '/simulations',      icon: 'simulations',    label: 'Simulations' },
  youtubeVideos:  { route: '/lesson-planner',   icon: 'youtube',        label: 'YouTube Curation' },
  worksheet:      { route: '/lesson-planner',   icon: 'worksheet',      label: 'Worksheet' },
  externalLinks:  { route: '/lesson-planner',   icon: 'externalLinks',  label: 'External Resources' },
  stimulus:       { route: '/stimulus-material', icon: 'stimulus',       label: 'Stimulus Material' },
  vocabulary:     { route: '/lesson-planner',   icon: 'vocabulary',     label: 'Vocabulary Builder' },
  modelResponse:  { route: '/lesson-planner',   icon: 'modelResponse',  label: 'Model Response' },
  sourceAnalysis: { route: '/source-analysis',   icon: 'sourceAnalysis', label: 'Source Analysis' },
  seatPlan:       { route: '/lesson-planner',   icon: 'seatPlan',       label: 'Seating Plan' },
  cceDiscussion:  { route: '/cce',              icon: 'cceDiscussion',  label: 'CCE Discussion' },
  staveNotation:  { route: '/stave-notation',    icon: 'staveNotation',  label: 'Stave Notation' },
  rhythmTool:     { route: '/rhythm-tool',      icon: 'rhythmTool',     label: 'Rhythm & Percussion' },
  artCritique:    { route: '/art-critique',     icon: 'artCritique',    label: 'Art Critique' },
  designProcess:  { route: '/design-process',   icon: 'designProcess',  label: 'Design Process' },
  recipeBuilder:  { route: '/lesson-planner',   icon: 'recipeBuilder',  label: 'Recipe & Nutrition' },
  kitchenLayout:  { route: '/kitchen-layout',   icon: 'kitchenLayout',  label: 'Kitchen Layout' },
};

function buildNavItems() {
  const staticBefore = [
    { id: '/', icon: 'dashboard', label: 'Dashboard' },
    { id: '/classes', icon: 'classes', label: 'My Classes', section: 'Culture' },
    { id: '/my-cca', icon: 'myCca', label: 'My CCA' },
    { id: '/lesson-planner', icon: 'lessonPlanner', label: 'Lesson Planner', section: 'Design' },
    { id: '/spatial', icon: 'spatial', label: 'Spatial Designer' },
    { id: '/cce', icon: 'cceDiscussion', label: 'CCE2021' },
    { id: '/lessons', icon: 'lessons', label: 'Lessons' },
  ];

  // Build dynamic enactment items from sidebar-specific selections
  // Split into Teaching Tools and Lesson Resources sub-groups
  const selections = getEEESidebarSelections();
  const toolItems = [];
  const resourceItems = [];
  for (const key of Object.keys(EEE_NAV_MAP)) {
    if (key === 'cceDiscussion') continue;
    if (EEE_REGISTRY[key]?.cat !== 'enactment') continue;
    if (!selections.includes(key)) continue;
    const nav = EEE_NAV_MAP[key];
    const entry = EEE_REGISTRY[key];
    const item = {
      id: nav.route,
      icon: nav.icon,
      label: nav.label,
      eeeKey: key,
    };
    if (entry.type === 'resource') {
      resourceItems.push(item);
    } else {
      toolItems.push(item);
    }
  }

  // Combine with sub-section labels
  const enactmentItems = [];
  if (toolItems.length > 0 || resourceItems.length > 0) {
    // Teaching Tools sub-group
    if (toolItems.length > 0) {
      toolItems[0].section = 'Enactment';
      toolItems[0].subsection = 'Teaching Tools';
      enactmentItems.push(...toolItems);
    }
    // Lesson Resources sub-group
    if (resourceItems.length > 0) {
      if (toolItems.length === 0) {
        resourceItems[0].section = 'Enactment';
      }
      resourceItems[0].subsection = resourceItems[0].subsection || 'Lesson Resources';
      enactmentItems.push(...resourceItems);
    }
  }

  // Always include Lesson Rehearsal under Enactment
  enactmentItems.push({
    id: '/lesson-rehearsal',
    icon: 'rehearsal',
    label: 'Lesson Rehearsal',
    ...(enactmentItems.length === 0 ? { section: 'Enactment' } : {}),
  });

  const staticAfter = [
    { id: '/assessment/aal', icon: 'aal', label: 'AaL', section: 'Assessment' },
    { id: '/assessment/afl', icon: 'afl', label: 'AfL' },
    { id: '/assessment/aol', icon: 'aol', label: 'AoL' },
    { id: '/knowledge', icon: 'knowledge', label: 'Knowledge Bases', section: 'Growth' },
    { id: '/my-growth', icon: 'myGrowth', label: 'My Learning' },
    { id: '/autopilot', icon: 'autopilot', label: 'Co-Cher+ (beta)', section: 'Co-Cher+' },
    { id: '/math-sandbox', icon: 'mathSandbox', label: 'Math Sandbox' },
    { id: '/admin', icon: 'admin', label: 'Admin One-Stop', section: 'Operations' }
  ];

  return [...staticBefore, ...enactmentItems, ...staticAfter];
}

/* ── Collapsed sections persistence ── */
function getCollapsedSections() {
  try { return JSON.parse(localStorage.getItem('cocher_sidebar_collapsed') || '[]'); } catch { return []; }
}
function setCollapsedSections(arr) {
  localStorage.setItem('cocher_sidebar_collapsed', JSON.stringify(arr));
}

export function renderSidebar(container) {
  const classCount = Store.getClasses().length;
  const lessonCount = Store.getLessons().length;
  const navItems = buildNavItems();
  const collapsedSections = getCollapsedSections();

  // Group items by section
  let currentSection = null;
  let navHTML = '';

  navItems.forEach((item, idx) => {
    if (item.section && item.section !== currentSection) {
      // Close previous group if open
      if (currentSection !== null) {
        navHTML += `</div>`; // close .sidebar-section-items
      }
      currentSection = item.section;
      const isCollapsed = collapsedSections.includes(currentSection);
      navHTML += `
        <div class="sidebar-section-label" data-section="${currentSection}" style="cursor:pointer;user-select:none;display:flex;align-items:center;gap:4px;">
          <span class="sidebar-section-tri${isCollapsed ? '' : ' open'}" style="display:inline-block;width:0;height:0;border-left:5px solid var(--ink-faint);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform 0.2s ease;${isCollapsed ? '' : 'transform:rotate(90deg);'}"></span>
          ${currentSection}
        </div>
        <div class="sidebar-section-items" data-section-items="${currentSection}" style="${isCollapsed ? 'display:none;' : ''}">`;
    }

    // Sub-section divider (e.g. "Teaching Tools" / "Lesson Resources" under Enactment)
    if (item.subsection) {
      navHTML += `<div style="font-size:0.5625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-faint);padding:8px 16px 2px;opacity:0.7;">${item.subsection}</div>`;
    }

    let badge = '';
    if (item.id === '/classes' && classCount > 0) badge = `<span class="sidebar-item-badge">${classCount}</span>`;
    if (item.id === '/lessons' && lessonCount > 0) badge = `<span class="sidebar-item-badge">${lessonCount}</span>`;

    navHTML += `
      <button class="sidebar-item" data-route="${item.id}" aria-label="${item.label}">
        <span class="sidebar-item-icon">${ICONS[item.icon]}</span>
        <span class="sidebar-item-label">${item.label}</span>
        ${badge}
      </button>`;
  });

  // Close last group
  if (currentSection !== null) {
    navHTML += `</div>`;
  }

  container.innerHTML = `
    <a class="sidebar-brand" href="#/" style="text-decoration:none;cursor:pointer;">
      <div class="sidebar-brand-icon">C</div>
      <div class="sidebar-brand-text">
        <div class="sidebar-brand-name">Co-Cher <span style="font-size:0.5em;font-weight:400;color:var(--ink-faint);opacity:0.7;vertical-align:middle;">by Harman Johll</span></div>
        <div class="sidebar-brand-tagline">Your Co-Teaching Assistant</div>
      </div>
    </a>

    <nav class="sidebar-nav">
      ${navHTML}
    </nav>

    <div class="sidebar-footer">
      <button class="sidebar-item" id="theme-toggle" aria-label="Toggle theme">
        <span class="sidebar-item-icon">${Store.get('darkMode') ? ICONS.sun : ICONS.moon}</span>
        <span class="sidebar-item-label">${Store.get('darkMode') ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
      <button class="sidebar-item" data-route="/settings" aria-label="Settings">
        <span class="sidebar-item-icon">${ICONS.settings}</span>
        <span class="sidebar-item-label">Settings</span>
      </button>
    </div>
  `;

  // Navigation click handlers
  container.querySelectorAll('.sidebar-item[data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });

  // Section collapse/expand toggles
  container.querySelectorAll('.sidebar-section-label[data-section]').forEach(label => {
    label.addEventListener('click', () => {
      const section = label.dataset.section;
      const items = container.querySelector(`[data-section-items="${section}"]`);
      const tri = label.querySelector('.sidebar-section-tri');
      const collapsed = getCollapsedSections();

      if (collapsed.includes(section)) {
        // Expand
        const idx = collapsed.indexOf(section);
        collapsed.splice(idx, 1);
        if (items) items.style.display = '';
        if (tri) { tri.classList.add('open'); tri.style.transform = 'rotate(90deg)'; }
      } else {
        // Collapse
        collapsed.push(section);
        if (items) items.style.display = 'none';
        if (tri) { tri.classList.remove('open'); tri.style.transform = ''; }
      }
      setCollapsedSections(collapsed);
    });
  });

  // Theme toggle
  const themeBtn = container.querySelector('#theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const dark = !Store.get('darkMode');
      Store.set('darkMode', dark);
      document.documentElement.classList.toggle('dark', dark);
      // Re-render sidebar to update icon
      renderSidebar(container);
    });
  }

  // Subscribe to state changes to update badges & re-render on EEE changes
  let lastEEEUpdate = Store.get('_eeeUpdated') || 0;
  return Store.subscribe(() => {
    // Re-render entire sidebar when EEE sidebar selections change
    const curEEEUpdate = Store.get('_eeeUpdated') || 0;
    if (curEEEUpdate !== lastEEEUpdate) {
      lastEEEUpdate = curEEEUpdate;
      renderSidebar(container);
      return;
    }

    const newClassCount = Store.getClasses().length;
    const classBadge = container.querySelector('[data-route="/classes"] .sidebar-item-badge');
    if (classBadge) classBadge.textContent = newClassCount;
    else if (newClassCount > 0) {
      const classItem = container.querySelector('[data-route="/classes"]');
      if (classItem && !classItem.querySelector('.sidebar-item-badge')) {
        classItem.insertAdjacentHTML('beforeend', `<span class="sidebar-item-badge">${newClassCount}</span>`);
      }
    }
  });
}
