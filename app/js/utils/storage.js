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
const DB_VERSION = 1;
const STORE = 'kb_content';

let _dbPromise = null;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return _dbPromise;
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
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
