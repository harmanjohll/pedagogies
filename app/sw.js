/*
 * Co-Cher Service Worker
 * ======================
 * Offline / PWA reliability for GitHub Pages — WITHOUT the stale-cache trap
 * the app was historically wary of.
 *
 * The core safety guarantee: HTML/navigations are NETWORK-FIRST, so a fresh
 * Pages deploy always wins when the user is online. The service worker only
 * serves a cached shell when the network is unreachable. Same-origin assets
 * use stale-while-revalidate (instant, then silently refreshed); cross-origin
 * CDN libs and simulations are cache-first runtime caches. The Gemini API and
 * the analytics webhook are NEVER intercepted or cached.
 *
 * VERSION is kept in step with APP_VERSION (js/version.js). Bumping it renames
 * the cache; `activate` then deletes every older Co-Cher cache, which is what
 * kills stale content on the next visit.
 *
 * Every cache operation is wrapped so a single failure never breaks a fetch
 * and a single bad precache entry never aborts install.
 */

const VERSION = 'v7.8';                       // match APP_VERSION in js/version.js
const CACHE_PREFIX = 'cocher-';
const CACHE_NAME = CACHE_PREFIX + VERSION;  // → 'cocher-v7'

/* The app shell, relative to this worker (scope = the app/ directory). Only
 * the essentials — the rest of the module graph and assets populate at
 * runtime via stale-while-revalidate, so this list stays robust even as
 * later phases add files. */
const SHELL_URL = './cocher.html';
const SHELL_ASSETS = [
  './cocher.html',
  './manifest.webmanifest',
  './css/design-system.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/version.js',
  './btyrelief/BTYTT_2026Sem2_v1.csv',
  './btyrelief/CalendarReference.csv'
];

/* Cross-origin library/font CDNs — cache-first runtime caching. */
const CDN_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'cdn.sheetjs.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.tailwindcss.com',
  'unpkg.com'
]);

/* Live-only hosts: the Gemini API and the analytics webhook. Requests to
 * these are never intercepted, so they always hit the real network. */
const NEVER_CACHE_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'script.google.com'
]);

/* ── install: precache the shell, then take over immediately ── */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME).catch(() => null);
    if (!cache) return;
    // Precache each entry independently: one failed fetch (e.g. a renamed
    // file) must NOT abort the whole install, so avoid cache.addAll().
    await Promise.all(SHELL_ASSETS.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res && (res.ok || res.type === 'opaque')) {
          await cache.put(url, res.clone());
        }
      } catch (e) { /* skip this entry, keep installing */ }
    }));
  })());
});

/* ── activate: drop stale Co-Cher caches, then claim open pages ── */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      // Only touch our OWN caches — this origin (username.github.io) is shared
      // across the user's other Pages projects, so scope the purge by prefix.
      await Promise.all(keys.map((k) =>
        (k !== CACHE_NAME && k.startsWith(CACHE_PREFIX)) ? caches.delete(k) : Promise.resolve()
      ));
    } catch (e) { /* ignore */ }
    try { await self.clients.claim(); } catch (e) { /* ignore */ }
  })());
});

/* ── fetch: route by request type ── */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never touch non-GET (API POSTs, uploads, analytics beacons).
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Only http(s) — skip chrome-extension:, data:, blob:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Gemini API + analytics webhook → always live network, never intercept.
  if (NEVER_CACHE_HOSTS.has(url.hostname)) return;

  const isSameOrigin = url.origin === self.location.origin;
  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  // 1) Navigations / HTML → network-first (fresh deploy wins), shell fallback.
  if (isHTML) {
    event.respondWith(networkFirst(event));
    return;
  }

  // 2) Cross-origin CDNs (scripts, fonts) → cache-first runtime.
  if (!isSameOrigin) {
    if (CDN_HOSTS.has(url.hostname)) {
      event.respondWith(cacheFirst(event));
    }
    // Any other cross-origin request: leave it untouched.
    return;
  }

  // 3) Simulations (iframe pages + their shared assets) → cache-first runtime.
  if (url.pathname.includes('/simulations/')) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // 4) Same-origin static assets (js/css/csv/json/webmanifest/…) → SWR.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  // Anything else same-origin: leave to the network (don't over-cache).
});

/* ── message: update + kill-switch controls ── */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'KILL') {
    // Full uninstall: drop Co-Cher caches, unregister, reload open tabs so
    // they detach from the (now removed) worker.
    event.waitUntil((async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX)).map(k => caches.delete(k)));
      } catch (e) { /* ignore */ }
      try { await self.registration.unregister(); } catch (e) { /* ignore */ }
      try {
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(c => { try { c.navigate(c.url); } catch (e) { /* ignore */ } });
      } catch (e) { /* ignore */ }
    })());
  }
});

/* ── strategies ── */

/* Network-first: fresh copy when online (cache it for offline), fall back to
 * the cached request and finally the app shell when the network is down. */
async function networkFirst(event) {
  const req = event.request;
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  try {
    const res = await fetch(req);
    if (cache && res && res.ok && res.status === 200) {
      const copy = res.clone();
      event.waitUntil(cache.put(req, copy).catch(() => {}));
    }
    return res;
  } catch (e) {
    if (cache) {
      const hit = await cache.match(req).catch(() => null);
      if (hit) return hit;
      const shell = await cache.match(SHELL_URL).catch(() => null);
      if (shell) return shell;
    }
    return new Response('You are offline, and this page has not been cached yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

/* Cache-first: serve the cached copy if present; otherwise fetch, cache a
 * successful or opaque (cross-origin no-cors) response, and return it. */
async function cacheFirst(event) {
  const req = event.request;
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  if (cache) {
    const hit = await cache.match(req).catch(() => null);
    if (hit) return hit;
  }
  try {
    const res = await fetch(req);
    if (cache && res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      event.waitUntil(cache.put(req, copy).catch(() => {}));
    }
    return res;
  } catch (e) {
    if (cache) {
      const hit = await cache.match(req).catch(() => null);
      if (hit) return hit;
    }
    throw e;
  }
}

/* Stale-while-revalidate: serve cache immediately (if any) while refreshing
 * it in the background; on a cold cache, wait for the network. */
async function staleWhileRevalidate(event) {
  const req = event.request;
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  const cached = cache ? await cache.match(req).catch(() => null) : null;
  const networkPromise = fetch(req).then((res) => {
    if (cache && res && res.ok && res.status === 200) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }
  const res = await networkPromise;
  return res || new Response('', { status: 504, statusText: 'Offline' });
}

/* ── helpers ── */
function isStaticAsset(pathname) {
  return /\.(?:js|mjs|css|csv|json|webmanifest|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|map)$/i.test(pathname);
}
