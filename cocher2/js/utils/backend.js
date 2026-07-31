/*
 * Co-Cher 2 — school backend client
 * =================================
 * Talks to the Apps Script Web App that fronts the Drive folder-per-school
 * backend (see backend/README.md). Read-only: an admin publishes by dropping a
 * file into their school's Drive folder, so there is no write path to secure.
 *
 * Three principles hold this together:
 *
 * 1. CACHE-FIRST-ON-FAILURE. Every fetch is mirrored locally. School wifi that
 *    blocks script.google.com, a flat network, or a plain offline morning must
 *    never leave a teacher without their timetable. The network is an upgrade
 *    path, not a dependency.
 *
 * 2. THE BUNDLED FILES ARE THE FLOOR. With no backend configured at all, the
 *    packs committed under cocher2/schools/ still work. Configuring a backend
 *    only ever adds schools and freshness.
 *
 * 3. NOTHING HERE CAN BLOCK SIGN-IN. Co-Cher 1's fatal flaw was that a failed
 *    fetch of one CSV locked every teacher out. Every function below resolves
 *    to null or a cached value; none of them throw.
 */

const BACKEND_URL = '';   // ← paste the Apps Script /exec URL here to go live
const CACHE_KEY = 'cocher2_backend_cache';
const FRESH_MS = 6 * 60 * 60 * 1000;   // re-fetch at most every 6h per key

export const isBackendConfigured = () => !!BACKEND_URL;

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}
function writeCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* quota — cache is optional */ }
}
function cacheGet(key) {
  const e = readCache()[key];
  return e && e.doc !== undefined ? e : null;
}
function cachePut(key, doc) {
  const c = readCache();
  c[key] = { doc, at: Date.now() };
  writeCache(c);
}

/**
 * Fetch a backend part, falling back to cache then to null. `force` re-fetches
 * even when the cached copy is still fresh.
 *
 * Deliberately swallows every error: a caller asking "what's my school?" must
 * get an answer or a null, never an exception that breaks a render path.
 */
async function get(key, params, { force = false } = {}) {
  const hit = cacheGet(key);
  if (!BACKEND_URL) return hit ? hit.doc : null;
  if (hit && !force && Date.now() - hit.at < FRESH_MS) return hit.doc;

  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${BACKEND_URL}?${qs}`, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = await res.json();
    if (doc && doc.error) throw new Error(doc.error);
    cachePut(key, doc);
    return doc;
  } catch {
    return hit ? hit.doc : null;   // stale beats nothing, and nothing beats a crash
  }
}

/** Schools the backend knows about: [{id, name, domains}]. */
export async function fetchSchoolIndex({ force = false } = {}) {
  const doc = await get('index', { part: 'index' }, { force });
  return Array.isArray(doc?.schools) ? doc.schools : [];
}

/** One school's config (school.json) — non-personal, no code needed. */
export async function fetchSchoolConfig(schoolId, { force = false } = {}) {
  if (!schoolId) return null;
  return get(`config:${schoolId}`, { school: schoolId, part: 'config' }, { force });
}

/**
 * One school's roster (staff.json). Requires the school's join code when the
 * pack sets one. Returns null when the code is missing or wrong — the caller
 * should then ask the teacher for it rather than treating it as an outage.
 */
export async function fetchSchoolStaff(schoolId, joinCode, { force = false } = {}) {
  if (!schoolId) return null;
  const params = { school: schoolId, part: 'staff' };
  if (joinCode) params.code = joinCode;
  return get(`staff:${schoolId}`, params, { force });
}

/** Find a teacher's own row in a roster, by email then by name. */
export function findTeacherInStaff(staff, { email, name } = {}) {
  const list = Array.isArray(staff?.teachers) ? staff.teachers : [];
  const e = String(email || '').toLowerCase();
  const n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return list.find(t => String(t.email || '').toLowerCase() === e)
    || (n ? list.find(t => String(t.name || '').toLowerCase().replace(/\s+/g, ' ').trim() === n) : null)
    || null;
}

/** Everyone in the roster, for the "which of these is you?" picker. */
export function staffNames(staff) {
  return (Array.isArray(staff?.teachers) ? staff.teachers : [])
    .map((t, i) => ({ i, name: t.name || '(unnamed)', email: t.email || '', entries: (t.entries || []).length }))
    .filter(t => t.name !== '(unnamed)' || t.entries)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Drop cached backend documents — used on sign-out and by a manual refresh. */
export function clearBackendCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

/** What the UI should tell a teacher about where their school data came from. */
export function backendStatus() {
  const c = readCache();
  const keys = Object.keys(c);
  return {
    configured: isBackendConfigured(),
    cachedKeys: keys.length,
    lastFetch: keys.reduce((max, k) => Math.max(max, c[k]?.at || 0), 0) || null,
  };
}
