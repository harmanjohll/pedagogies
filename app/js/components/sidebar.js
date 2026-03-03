/*
 * Co-Cher Sidebar
 * ===============
 * Main navigation sidebar with icons and labels.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';

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
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
};

const NAV_ITEMS = [
  { id: '/', icon: 'dashboard', label: 'Dashboard' },
  { id: '/classes', icon: 'classes', label: 'Classes', section: 'Culture' },
  { id: '/lesson-planner', icon: 'lessonPlanner', label: 'Lesson Planner', section: 'Design' },
  { id: '/spatial', icon: 'spatial', label: 'Spatial Designer' },
  { id: '/lessons', icon: 'lessons', label: 'Lessons' },
  { id: '/simulations', icon: 'simulations', label: 'Simulations', section: 'Enactment' },
  { id: '/lesson-rehearsal', icon: 'rehearsal', label: 'Lesson Rehearsal' },
  { id: '/assessment/aal', icon: 'aal', label: 'AaL', section: 'Assessment' },
  { id: '/assessment/afl', icon: 'afl', label: 'AfL' },
  { id: '/assessment/aol', icon: 'aol', label: 'AoL' },
  { id: '/knowledge', icon: 'knowledge', label: 'Knowledge Bases', section: 'Growth' },
  { id: '/my-growth', icon: 'myGrowth', label: 'My Learning' },
  { id: '/admin', icon: 'admin', label: 'Admin One-Stop', section: 'Operations' }
];

export function renderSidebar(container) {
  const classCount = Store.getClasses().length;
  const lessonCount = Store.getLessons().length;

  let currentSection = null;
  let navHTML = '';

  NAV_ITEMS.forEach(item => {
    if (item.section && item.section !== currentSection) {
      currentSection = item.section;
      navHTML += `<div class="sidebar-section-label">${item.section}</div>`;
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

  container.innerHTML = `
    <a class="sidebar-brand" href="#/" style="text-decoration:none;cursor:pointer;">
      <div class="sidebar-brand-icon">C</div>
      <div class="sidebar-brand-text">
        <div class="sidebar-brand-name">Co-Cher</div>
        <div class="sidebar-brand-tagline">Lesson Design Assistant</div>
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
      <div style="text-align:center;padding:6px 0 2px;margin-top:4px;font-size:0.625rem;color:var(--ink-faint);opacity:0.5;letter-spacing:0.02em;">by Harman Johll</div>
    </div>
  `;

  // Navigation click handlers
  container.querySelectorAll('.sidebar-item[data-route]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
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

  // Subscribe to state changes to update badges
  return Store.subscribe(() => {
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
