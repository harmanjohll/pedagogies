/*
 * Co-Cher Router
 * ==============
 * Simple hash-based router for single-page navigation.
 */

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

function handleRoute() {
  const { full, parts } = parseHash();
  const container = document.getElementById('main-view');
  if (!container) return;

  // Cleanup previous view
  if (typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  // Try exact match first
  if (routes.has(full)) {
    currentRoute = full;
    currentCleanup = routes.get(full)(container, {}) || null;
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
      currentCleanup = handler(container, params) || null;
      updateSidebarActive(pattern);
      return;
    }
  }

  // Fallback: dashboard
  currentRoute = '/';
  if (routes.has('/')) {
    currentCleanup = routes.get('/')(container, {}) || null;
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
