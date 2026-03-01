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
import { render as renderSettings } from './views/settings.js';

function init() {
  const app = document.getElementById('app');
  if (!app) return;

  // Seed sample classes on first run
  seedIfNeeded();

  app.innerHTML = `
    <aside class="sidebar" id="sidebar"></aside>
    <main class="main-content">
      <div id="main-view" style="height: 100%; display: flex; flex-direction: column;"></div>
    </main>
  `;

  // Render sidebar
  const sidebarEl = document.getElementById('sidebar');
  renderSidebar(sidebarEl);

  // Re-render sidebar on state changes (badges, theme)
  Store.subscribe(() => renderSidebar(sidebarEl));

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
