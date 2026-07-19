/*
 * Co-Cher Storage Adapter (IndexedDB)
 * ===================================
 * Holds bulky Knowledge Base upload content (extracted PDF/pasted text)
 * outside the ~5MB localStorage budget. Only upload *content* lives here,
 * keyed by upload id; all metadata stays in the reactive Store snapshot.
 *
 * Every function resolves gracefully when IndexedDB is unavailable
 * (private browsing, old browsers) — callers fall back to keeping
 * content in localStorage as before.
 */

const DB_NAME = 'cocher';
const DB_VERSION = 3;
const STORE = 'kb_content';
// v2 adds: custom_sims (generated simulation HTML), images (AI-generated
// visuals keyed by owner id) — all bulky payloads that must stay out of
// the ~5MB localStorage budget
// v3 adds: media (WS-4 materials — compiled deck HTML strings and audio-clip
// WAV Blobs, keyed by material id; metadata stays in localStorage)
const ALL_STORES = ['kb_content', 'custom_sims', 'images', 'media'];

let _dbPromise = null;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      ALL_STORES.forEach(name => {
        if (!req.result.objectStoreNames.contains(name)) {
          req.result.createObjectStore(name);
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return _dbPromise;
}

function tx(db, mode, store = STORE) {
  return db.transaction(store, mode).objectStore(store);
}

/* ── Generic per-store helpers ── */

export async function idbPut(store, id, value) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const req = tx(db, 'readwrite', store).put(value, id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

export async function idbGet(store, id) {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const req = tx(db, 'readonly', store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
}

export async function idbRemove(store, id) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const req = tx(db, 'readwrite', store).delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

/** Returns a Map of id -> value for every entry in the store. */
export async function idbGetAllFrom(store) {
  const db = await openDb();
  if (!db) return new Map();
  return new Promise((resolve) => {
    const s = tx(db, 'readonly', store);
    const keysReq = s.getAllKeys();
    const valsReq = s.getAll();
    let keys = null, vals = null;
    const done = () => {
      if (keys && vals) resolve(new Map(keys.map((k, i) => [k, vals[i]])));
    };
    keysReq.onsuccess = () => { keys = keysReq.result; done(); };
    valsReq.onsuccess = () => { vals = valsReq.result; done(); };
    keysReq.onerror = valsReq.onerror = () => resolve(new Map());
  });
}

export async function idbSetContent(id, text) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const req = tx(db, 'readwrite').put(text, id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

export async function idbDeleteContent(id) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

/** Returns a Map of id -> content for all stored uploads. */
export async function idbGetAllContent() {
  const db = await openDb();
  if (!db) return new Map();
  return new Promise((resolve) => {
    const store = tx(db, 'readonly');
    const keysReq = store.getAllKeys();
    const valsReq = store.getAll();
    let keys = null, vals = null;
    const done = () => {
      if (keys && vals) resolve(new Map(keys.map((k, i) => [k, vals[i]])));
    };
    keysReq.onsuccess = () => { keys = keysReq.result; done(); };
    valsReq.onsuccess = () => { vals = valsReq.result; done(); };
    keysReq.onerror = valsReq.onerror = () => resolve(new Map());
  });
}

export async function idbClearContent() {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const req = tx(db, 'readwrite').clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}
