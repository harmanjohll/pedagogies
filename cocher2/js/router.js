/*
 * Co-Cher Router
 * ==============
 * Simple hash-based router for single-page navigation.
 */

import { trackEvent } from './utils/analytics.js';
import { abortAllDictations } from './utils/voice.js';

const routes = new Map();
let currentRoute = null;
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes.set(path, handler);
}

export function navigate(path) {
  if (window.location.hash === '#' + path) {
    // Force re-render if same route
    handleRoute();
  } else {
    window.location.hash = path;
  }
}

export function getCurrentRoute() {
  return currentRoute;
}

function parseHash() {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  return { full: hash, parts };
}

/* Error boundary: one crashing view must not blank the whole app. */
function safeRender(handler, container, params) {
  try {
    return handler(container, params) || null;
  } catch (err) {
    console.error('Co-Cher: view crashed on', currentRoute, err);
    trackEvent('error', 'view_crash', currentRoute, String(err && err.message || err).slice(0, 140));
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;">
        <div class="card" style="max-width:440px;text-align:center;padding:32px;">
          <div style="font-size:2rem;margin-bottom:8px;">&#128295;</div>
          <h2 style="font-size:1.125rem;font-weight:700;margin:0 0 8px;color:var(--ink);">This page hit a snag</h2>
          <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin:0 0 16px;">
            Something went wrong while loading this view. Your data is safe.
            If it keeps happening, a screenshot of the browser console (F12) helps a lot.
          </p>
          <div style="display:flex;gap:8px;justify-content:center;">
            <a href="#/" class="btn btn-primary" style="text-decoration:none;">Back to Dashboard</a>
            <button class="btn btn-secondary" onclick="location.reload()">Reload App</button>
          </div>
        </div>
      </div>`;
    return null;
  }
}

function handleRoute() {
  const { full, parts } = parseHash();
  const container = document.getElementById('main-view');
  if (!container) return;

  // Cleanup previous view — a failing cleanup must not block navigation
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { console.warn('Co-Cher: view cleanup failed', e); }
    currentCleanup = null;
  }

  // No dictation survives navigation: a mic left "Listening…" in the outgoing
  // view would otherwise stay hot against a torn-down DOM (and make the next
  // start() race). Views don't need their own teardown for this.
  abortAllDictations();

  // Try exact match first
  if (routes.has(full)) {
    currentRoute = full;
    trackEvent('navigation', 'page_view', full);
    currentCleanup = safeRender(routes.get(full), container, {});
    updateSidebarActive(full);
    return;
  }

  // Try parameterized routes: /classes/:id → /classes/*
  for (const [pattern, handler] of routes) {
    const patternParts = pattern.split('/').filter(Boolean);
    if (patternParts.length !== parts.length) continue;

    const params = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = parts[i];
      } else if (patternParts[i] !== parts[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      currentRoute = full;
      trackEvent('navigation', 'page_view', full);
      currentCleanup = safeRender(handler, container, params);
      updateSidebarActive(pattern);
      return;
    }
  }

  // Fallback: dashboard
  currentRoute = '/';
  if (routes.has('/')) {
    currentCleanup = safeRender(routes.get('/'), container, {});
  }
  updateSidebarActive('/');
}

function updateSidebarActive(route) {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    const href = el.dataset.route;
    if (!href) return;
    // Match /classes for /classes/:id too
    const isActive = route === href || (route.startsWith(href + '/') && href !== '/');
    el.classList.toggle('active', isActive);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
