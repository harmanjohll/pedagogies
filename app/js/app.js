/*
 * Co-Cher Application
 * ===================
 * Main entry point. Wires sidebar, router, and views together.
 */

import { registerRoute, initRouter } from './router.js';
import { renderCardView } from './utils/takehome-card.js';
import { renderSidebar } from './components/sidebar.js';
import { renderWelcome, shouldShowWelcome, isApiKeyMissing } from './components/welcome.js';
import { renderLogin, isLoggedIn } from './components/login.js';
import { seedIfNeeded, seedPdIfNeeded, seedLessonsIfNeeded, seedCCAIfNeeded, seedExemplarsIfNeeded, seedPortalDemosIfNeeded, seedShowcaseLessonsIfNeeded } from './seed-data.js';

/* ── Views ── */
import { render as renderDashboard } from './views/dashboard.js';
import { renderList as renderClassesList, renderDetail as renderClassDetail } from './views/classes.js';
import { renderNew as renderLessonPlanner, renderForLesson } from './views/lesson-planner.js';
import { render as renderSpatialDesigner } from './views/spatial-designer.js';
import { renderList as renderLessonsList, renderDetail as renderLessonDetail } from './views/lessons.js';
import { render as renderKnowledgeBase } from './views/knowledge-base.js';
import { render as renderPdPortfolio, renderDetail as renderPdFolderDetail } from './views/pd-portfolio.js';
import { render as renderLibrary } from './views/library.js';
import { render as renderAdmin } from './views/admin.js';
import { render as renderSimulations } from './views/simulations.js';
import { render as renderLessonRehearsal } from './views/lesson-rehearsal.js';
import { renderAoL, renderAaL, renderAfL } from './views/assessment.js';
import { render as renderSettings } from './views/settings.js';
import { render as renderStimulusMaterial } from './views/stimulus-material.js';
import { render as renderSourceAnalysis } from './views/source-analysis.js';
import { render as renderCCE } from './views/cce.js';
import { render as renderMyCCA } from './views/my-cca.js';
import { render as renderAutopilot } from './views/autopilot.js';
import { render as renderMathSandbox } from './views/math-sandbox.js';
import { render as renderRhythmTool } from './views/rhythm-tool.js';
import { render as renderArtCritique } from './views/art-critique.js';
import { render as renderStaveNotation } from './views/stave-notation.js';
import { render as renderDesignProcess } from './views/design-process.js';
import { render as renderKitchenLayout } from './views/kitchen-layout.js';
import { render as renderSubjectTools } from './views/subject-tools.js';
import { render as renderReportComments } from './views/report-comments.js';
import { render as renderQuestionBank } from './views/question-bank.js';
import { render as renderReliefKit } from './views/relief-kit.js';
import { renderPresent } from './views/present.js';
import { renderDeckViewer } from './views/deck-viewer.js';
import { renderLivePresent, renderLiveJoin } from './views/live.js';
import { initGlobalSearch, openSearch } from './components/unified-search.js';
import { initOnboarding } from './components/onboarding.js';
import { startTour, isTourComplete } from './components/spotlight-tour.js';
import { maybeShowWhatsNew } from './components/whats-new.js';
import { initKeyboardShortcuts } from './components/keyboard-shortcuts.js';

function init() {
  const app = document.getElementById('app');
  if (!app) return;

  // Seed sample data on first run
  seedIfNeeded();
  seedPdIfNeeded();
  seedLessonsIfNeeded();
  seedCCAIfNeeded();
  seedExemplarsIfNeeded();
  seedPortalDemosIfNeeded();
  seedShowcaseLessonsIfNeeded();

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

  // Render sidebar — it manages its own single Store subscription internally
  // (badges, theme, EEE/custom-link changes); subscribing here as well would
  // stack a new listener on every state change.
  const sidebarEl = document.getElementById('sidebar');
  renderSidebar(sidebarEl);

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
  registerRoute('/my-growth', renderPdPortfolio);
  registerRoute('/library', renderLibrary);
  registerRoute('/my-growth/:id', renderPdFolderDetail);
  registerRoute('/admin', renderAdmin);
  registerRoute('/simulations', renderSimulations);
  registerRoute('/lesson-rehearsal', renderLessonRehearsal);
  registerRoute('/assessment/aal', renderAaL);
  registerRoute('/assessment/afl', renderAfL);
  registerRoute('/assessment/aol', renderAoL);
  registerRoute('/stimulus-material', renderStimulusMaterial);
  registerRoute('/source-analysis', renderSourceAnalysis);
  registerRoute('/cce', renderCCE);
  registerRoute('/my-cca', renderMyCCA);
  registerRoute('/autopilot', renderAutopilot);
  registerRoute('/math-sandbox', renderMathSandbox);
  registerRoute('/rhythm-tool', renderRhythmTool);
  registerRoute('/art-critique', renderArtCritique);
  registerRoute('/stave-notation', renderStaveNotation);
  registerRoute('/design-process', renderDesignProcess);
  registerRoute('/kitchen-layout', renderKitchenLayout);
  registerRoute('/subject-tools', renderSubjectTools);
  registerRoute('/report-comments', renderReportComments);
  registerRoute('/question-bank', renderQuestionBank);
  registerRoute('/relief-kit', renderReliefKit);
  registerRoute('/present/:id', renderPresent);
  registerRoute('/deck/:id', renderDeckViewer);
  registerRoute('/live', renderLivePresent);
  registerRoute('/join', renderLiveJoin);
  registerRoute('/join/:room', renderLiveJoin);
  registerRoute('/card/:data', (container, params) => renderCardView(container, params.data));
  registerRoute('/settings', renderSettings);

  // Start router
  initRouter();

  // Global search (Ctrl+K)
  initGlobalSearch();

  // Keyboard shortcuts (Ctrl+N, etc.)
  initKeyboardShortcuts();

  // Consolidated first-run flow: welcome (shown before init) → onboarding intro
  // → guided spotlight tour. The four first-run systems are sequenced here so
  // they never stack on top of each other.
  initOnboarding((res) => {
    // Genuine new user who wants the walkthrough: start the tour once.
    if (res && res.shown && !res.skipped && !isTourComplete('main')) {
      // Small gap so the onboarding overlay is fully gone before the tour dims.
      setTimeout(() => startTour('main'), 350);
    }
  });

  // One-time "what's new" for RETURNING users after a version bump. For genuine
  // first-run users this records the current version silently and shows nothing,
  // so it never stacks on top of onboarding/tour.
  maybeShowWhatsNew();

  // Show API key reminder banner if key was deferred
  if (isApiKeyMissing()) {
    const banner = document.createElement('div');
    banner.id = 'api-key-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9990;background:linear-gradient(135deg,#fef3c7,#fde68a);padding:10px 20px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:0.8125rem;color:#92400e;box-shadow:0 -2px 8px rgba(0,0,0,0.1);';
    banner.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>AI features require an API key. <a href="#/settings" style="color:#92400e;font-weight:600;text-decoration:underline;">Add one in Settings</a></span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#92400e;font-size:1.1rem;padding:0 4px;margin-left:8px;">&times;</button>
    `;
    document.body.appendChild(banner);
  }
}

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
  // Students joining a Live session open THIS app on their phones (#/join/…
  // from the projector's QR). They are not teachers: no login, no welcome, no
  // onboarding — boot the join surface directly as a fullscreen overlay.
  const joinMatch = (window.location.hash || '').match(/^#\/join(?:\/([^/?]+))?/);
  if (joinMatch) {
    renderLiveJoin(document.body, { room: joinMatch[1] ? decodeURIComponent(joinMatch[1]) : '' });
    return;
  }

  function startApp() {
    if (shouldShowWelcome()) {
      renderWelcome(() => init());
    } else {
      init();
    }
  }

  if (!isLoggedIn()) {
    renderLogin(() => startApp());
  } else {
    startApp();
  }
});
