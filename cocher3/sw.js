/*
 * Co-Cher 3: service worker
 * =========================
 * One job: let Co-Cher 3 open when there is no wifi.
 *
 * Network first, always. Online, every file comes fresh from the network and a
 * copy is kept. Only when the network fails, or takes longer than 4 seconds,
 * is the kept copy used. So a teacher online can never be shown an old file
 * (the fault an earlier, cache first worker caused).
 *
 * Kept: this folder's own files, and the libraries and fonts the page loads.
 * Not kept: videos (large, and played in ranges), AI calls, other apps.
 * Scope is this folder only; Co-Cher 1 and 2 have their own workers.
 */
const CACHE = 'cocher3-v7';
const KEEP_HOSTS = ['cdn.jsdelivr.net', 'cdn.sheetjs.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('cocher3-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin && url.pathname.startsWith(new URL('./', self.location).pathname);
  if (!ours && !KEEP_HOSTS.includes(url.hostname)) return;
  if (/\.(mp4|webm)$/i.test(url.pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const kept = () => cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    try {
      const res = await Promise.race([
        fetch(req),
        new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000)),
      ]);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = await kept();
      if (hit) return hit;
      if (err && err.message === 'slow') return fetch(req);      // nothing kept: wait for the network after all
      throw err;
    }
  })());
});
