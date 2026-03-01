/*
 * Co-Cher Application
 * ===================
 * Main entry point. Wires sidebar, router, and views together.
 */

import { Store } from './state.js';
import { registerRoute, initRouter } from './router.js';
import { renderSidebar } from './components/sidebar.js';
import { renderWelcome, shouldShowWelcome } from './components/welcome.js';
import { seedIfNeeded } from './seed-data.js';

/* ── Views ── */
import { render as renderDashboard } from './views/dashboard.js';
import { renderList as renderClassesList, renderDetail as renderClassDetail } from './views/classes.js';
import { render as renderLessonPlanner, renderForLesson } from './views/lesson-planner.js';
import { render as renderSpatialDesigner } from './views/spatial-designer.js';
import { renderList as renderLessonsList, renderDetail as renderLessonDetail } from './views/lessons.js';
import { render as renderKnowledgeBase } from './views/knowledge-base.js';
import { render as renderAdmin } from './views/admin.js';
import { render as renderSettings } from './views/settings.js';

function init() {
  const app = document.getElementById('app');
  if (!app) return;

  // Seed sample classes on first run
  seedIfNeeded();

  app.innerHTML = `
    <aside class="sidebar" id="sidebar"></aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <main class="main-content">
      <div class="mobile-header" id="mobile-header">
        <button class="hamburger-btn" id="hamburger-btn" aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div class="mobile-brand">
          <span class="mobile-brand-icon">C</span>
          <span class="mobile-brand-name">Co-Cher</span>
        </div>
        <div style="width:36px;"></div>
      </div>
      <div id="main-view" style="height: 100%; display: flex; flex-direction: column;"></div>
    </main>
  `;

  // Render sidebar
  const sidebarEl = document.getElementById('sidebar');
  renderSidebar(sidebarEl);

  // Re-render sidebar on state changes (badges, theme)
  Store.subscribe(() => renderSidebar(sidebarEl));

  // Mobile sidebar toggle
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger-btn');

  function openSidebar() {
    sidebarEl.classList.add('open');
    overlay.classList.add('visible');
  }
  function closeSidebar() {
    sidebarEl.classList.remove('open');
    overlay.classList.remove('visible');
  }

  hamburger.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Close sidebar on navigation (mobile)
  window.addEventListener('hashchange', closeSidebar);

  // Register routes
  registerRoute('/', renderDashboard);
  registerRoute('/lesson-planner', renderLessonPlanner);
  registerRoute('/lesson-planner/:id', renderForLesson);
  registerRoute('/spatial', renderSpatialDesigner);
  registerRoute('/classes', renderClassesList);
  registerRoute('/classes/:id', renderClassDetail);
  registerRoute('/lessons', renderLessonsList);
  registerRoute('/lessons/:id', renderLessonDetail);
  registerRoute('/knowledge', renderKnowledgeBase);
  registerRoute('/admin', renderAdmin);
  registerRoute('/settings', renderSettings);

  // Start router
  initRouter();
}

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
  if (shouldShowWelcome()) {
    renderWelcome(() => init());
  } else {
    init();
  }
});
