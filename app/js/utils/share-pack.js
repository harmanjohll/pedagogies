/*
 * Co-Cher Department Packs
 * ========================
 * File-based collegial sharing. Teachers pass a single .json pack around on
 * the school drive or WhatsApp — the app has no backend by design, so the
 * file IS the transport. exportPack() bundles lessons + library resources;
 * importPack() validates a pack and merges it into the local Store with
 * fresh ids, stamping provenance (sharedBy / remixedFrom) on every item.
 */

import { Store, generateId } from '../state.js';
import { getCurrentUser, getPreferredName } from '../components/login.js';
import { idbGet, idbPut } from './storage.js';

const ITEM_KEYS = ['lessons', 'stimulus', 'sources', 'layouts', 'uploads', 'simulations', 'frameworks'];
const ITEM_LABELS = {
  lessons: ['lesson', 'lessons'],
  stimulus: ['stimulus material', 'stimulus materials'],
  sources: ['source', 'sources'],
  layouts: ['layout', 'layouts'],
  uploads: ['resource upload', 'resource uploads'],
  simulations: ['simulation', 'simulations'],
  frameworks: ['pedagogy framework', 'pedagogy frameworks']
};

/* ── Custom simulations travel with their lessons ──
 * Same storage contract as views/simulations.js: sim metadata (title, spec,
 * subject/level/type, model) lives in localStorage 'cocher_custom_sims';
 * the heavy HTML payload lives in IndexedDB store 'custom_sims' (legacy
 * records may still carry .html inline). Packs bundle the FULL record —
 * html + spec — so a colleague's import runs with no regeneration. */
function getCustomSims() {
  try {
    const raw = localStorage.getItem('cocher_custom_sims');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomSims(sims) {
  localStorage.setItem('cocher_custom_sims', JSON.stringify(sims));
}

async function loadSimHtml(sim) {
  const rec = await idbGet('custom_sims', sim.id);
  if (rec && typeof rec.html === 'string') return rec.html;
  return typeof sim.html === 'string' ? sim.html : null; // legacy inline fallback
}

/** The sharing author, resolved from the signed-in teacher. */
function packAuthor() {
  const user = getCurrentUser();
  return {
    name: getPreferredName() || user?.name || 'A colleague',
    email: user?.email || ''
  };
}

/* ── Travel hygiene ──
 * Fields that reference local data (classId) or are personal (reflections,
 * exemplar stars, earlier provenance stamps) don't travel. Item ids are
 * KEPT in the file so the remix chain can point back at the original —
 * they are regenerated on import, never trusted. */
function travelLesson(l) {
  const { classId, reflection, rehearsedAt, isExemplar, sharedBy, remixedFrom, isShared, ...rest } = l;
  return rest;
}

function travelItem(item) {
  const { classId, sharedBy, remixedFrom, isShared, ...rest } = item;
  return rest;
}

/** "3 lessons, 2 stimulus materials" — human list of the non-zero counts. */
function describeCounts(counts) {
  return ITEM_KEYS
    .filter(k => counts[k] > 0)
    .map(k => `${counts[k]} ${ITEM_LABELS[k][counts[k] === 1 ? 0 : 1]}`)
    .join(', ');
}

/** Dedupe key: the same display title from the same author = same item. */
function dedupeKey(title, author) {
  return `${String(title || '').trim().toLowerCase()}::${String(author || '').trim().toLowerCase()}`;
}

/**
 * Bundle selected content into a Department Pack and trigger a .json
 * download. Every argument except `title` is an array (default empty).
 * Simulations attached to the selected lessons are bundled automatically
 * (full record incl. html + spec, pulled from IndexedDB — hence async).
 * Returns the pack object so callers can preview or test it.
 */
export async function exportPack({ title, lessons = [], stimulus = [], sources = [], layouts = [], uploads = [] }) {
  const simIds = new Set();
  lessons.forEach(l => (l.attachedResources || []).forEach(r => {
    if (r.type === 'simulation' && r.id) simIds.add(r.id);
  }));

  /* Pedagogy frameworks travel with the lessons whose staged segments
   * reference them (segment.frameworkId). Builtins (GROW / ACT) are seeded
   * with the same fixed ids on every install, so only custom frameworks are
   * bundled — the reference resolves either way. Ids are kept verbatim so
   * segment links survive import. */
  const fwIds = new Set();
  lessons.forEach(l => (l.runOfShow?.segments || []).forEach(s => {
    if (s && typeof s.frameworkId === 'string' && s.frameworkId) fwIds.add(s.frameworkId);
  }));
  const frameworks = (Store.getFrameworks?.() || [])
    .filter(f => fwIds.has(f.id) && !f.builtin);
  const allSims = getCustomSims();
  const simulations = [];
  for (const id of simIds) {
    const sim = allSims.find(s => s.id === id);
    if (!sim) continue; // built-in or deleted sim — the chip still names it
    const html = await loadSimHtml(sim);
    if (typeof html !== 'string' || !html) continue;
    const { html: _inline, ...meta } = travelItem(sim);
    simulations.push({ ...meta, html });
  }

  const pack = {
    deptpack: 1,
    version: 1,
    title: (title || '').trim() || 'Department Pack',
    sharedBy: packAuthor(),
    sharedAt: Date.now(),
    items: {
      lessons: lessons.map(travelLesson),
      stimulus: stimulus.map(travelItem),
      sources: sources.map(travelItem),
      layouts: layouts.map(travelItem),
      uploads: uploads.map(travelItem),
      simulations,
      frameworks
    }
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pack.title.replace(/[^a-zA-Z0-9]/g, '_')}.deptpack.json`;
  a.click();
  URL.revokeObjectURL(url);
  return pack;
}

/**
 * Validate a Department Pack (parsed object or raw JSON string) and prepare
 * a merge. Throws a teacher-readable Error when the shape is wrong.
 * Returns { summary, apply }:
 *  - summary: { title, sharedBy, sharedAt, counts, total, breakdown }
 *  - apply(): merges every item into the Store with NEW generateId() ids,
 *    stamping sharedBy / remixedFrom / isShared on each. Lessons come in as
 *    drafts with reflections cleared and exemplar stars removed. Duplicates
 *    (same title from the same author) are skipped. Returns
 *    { added, addedTotal, skipped, total, breakdown }.
 */
export function importPack(json) {
  let data = json;
  if (typeof json === 'string') {
    try { data = JSON.parse(json); } catch { throw new Error('This file is not valid JSON.'); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.deptpack) {
    throw new Error('This file is not a Co-Cher Department Pack.');
  }
  const items = data.items;
  if (!items || typeof items !== 'object' || Array.isArray(items)) {
    throw new Error('This pack has no items.');
  }
  const malformed = ITEM_KEYS.filter(k => items[k] !== undefined && !Array.isArray(items[k]));
  if (malformed.length) {
    throw new Error(`Malformed pack fields: ${malformed.join(', ')}.`);
  }

  const author = (typeof data.sharedBy?.name === 'string' && data.sharedBy.name.trim()) || 'A colleague';
  const counts = {};
  ITEM_KEYS.forEach(k => { counts[k] = (items[k] || []).length; });
  const total = ITEM_KEYS.reduce((n, k) => n + counts[k], 0);
  if (total === 0) throw new Error('This pack is empty.');

  const summary = {
    title: (typeof data.title === 'string' && data.title.trim()) || 'Department Pack',
    sharedBy: author,
    sharedAt: typeof data.sharedAt === 'number' ? data.sharedAt : null,
    counts,
    total,
    breakdown: describeCounts(counts)
  };

  function apply() {
    const added = Object.fromEntries(ITEM_KEYS.map(k => [k, 0]));
    let skipped = 0;

    /** Provenance stamp every merged item carries. */
    const stamp = (originalId) => ({
      sharedBy: author,
      remixedFrom: { id: originalId || null, author },
      isShared: true
    });

    /* Layouts first — lessons may reference them via spatialLayout, so
     * build an old→new id map to keep those links alive after the merge. */
    const layoutIdMap = {};
    const existingLayouts = Store.get('savedLayouts') || [];
    const layoutKeys = new Set(existingLayouts.map(l => dedupeKey(l.name, l.sharedBy)));
    const newLayouts = [];
    (items.layouts || []).forEach(raw => {
      const key = dedupeKey(raw.name || raw.title, author);
      if (layoutKeys.has(key)) {
        skipped++;
        const match = existingLayouts.find(l => dedupeKey(l.name, l.sharedBy) === key);
        if (raw.id && match) layoutIdMap[raw.id] = match.id; // relink, don't duplicate
        return;
      }
      layoutKeys.add(key);
      const layout = { ...travelItem(raw), ...stamp(raw.id), id: generateId(), createdAt: Date.now() };
      if (raw.id) layoutIdMap[raw.id] = layout.id;
      newLayouts.push(layout);
      added.layouts++;
    });
    if (newLayouts.length) Store.set('savedLayouts', [...existingLayouts, ...newLayouts]);

    /* Simple list merges: stimulus, sources, knowledge uploads. Uploads go
     * through the normal Store.set('knowledgeUploads') path so any
     * content they carry auto-migrates to IndexedDB. */
    const mergeList = (storeKey, incoming, countKey) => {
      const existing = Store.get(storeKey) || [];
      const keys = new Set(existing.map(i => dedupeKey(i.title || i.name, i.sharedBy)));
      const fresh = [];
      (incoming || []).forEach(raw => {
        const key = dedupeKey(raw.title || raw.name, author);
        if (keys.has(key)) { skipped++; return; }
        keys.add(key);
        fresh.push({ ...travelItem(raw), ...stamp(raw.id), id: generateId(), createdAt: Date.now() });
        added[countKey]++;
      });
      if (fresh.length) Store.set(storeKey, [...existing, ...fresh]);
    };
    mergeList('stimulusLibrary', items.stimulus, 'stimulus');
    mergeList('sourceLibrary', items.sources, 'sources');
    mergeList('knowledgeUploads', items.uploads, 'uploads');

    /* Pedagogy frameworks before lessons — staged segments reference them by
     * id, and those ids are kept VERBATIM (unlike other items) so the links
     * resolve without remapping. Add only what's missing; builtins and any
     * framework whose id already exists locally are skipped. */
    (items.frameworks || []).forEach(raw => {
      if (!raw || typeof raw !== 'object' || !raw.id) { skipped++; return; }
      if (raw.builtin || Store.getFramework?.(raw.id)) { skipped++; return; }
      Store.addFramework(raw); // addFramework whitelists fields and keeps raw.id
      added.frameworks++;
    });

    /* Simulations before lessons — lessons reference them through
     * attachedResources, so build an old→new id map (like layouts). The
     * html payload goes to IndexedDB ('custom_sims'); when IDB is
     * unavailable it stays inline in localStorage, mirroring the
     * fallback in views/simulations.js. */
    const simIdMap = {};
    const existingSims = getCustomSims();
    const simKeys = new Set(existingSims.map(s => dedupeKey(s.title, s.sharedBy)));
    const newSims = [];
    (items.simulations || []).forEach(raw => {
      const key = dedupeKey(raw.title, author);
      if (simKeys.has(key)) {
        skipped++;
        const match = existingSims.find(s => dedupeKey(s.title, s.sharedBy) === key);
        if (raw.id && match) simIdMap[raw.id] = match.id; // relink, don't duplicate
        return;
      }
      const { html, ...meta } = travelItem(raw);
      if (typeof html !== 'string' || !html) { skipped++; return; }
      simKeys.add(key);
      const sim = { ...meta, ...stamp(raw.id), id: generateId(), createdAt: Date.now(), updatedAt: Date.now() };
      if (raw.id) simIdMap[raw.id] = sim.id;
      idbPut('custom_sims', sim.id, { html, versions: [] }).then(ok => {
        if (!ok) {
          const sims = getCustomSims();
          const target = sims.find(s => s.id === sim.id);
          if (target) { target.html = html; saveCustomSims(sims); }
        }
      }).catch(() => {});
      newSims.push(sim);
      added.simulations++;
    });
    if (newSims.length) saveCustomSims([...existingSims, ...newSims]);

    /* Lessons last: Store.addLesson mints the fresh id, forces status
     * 'draft', clears the reflection and drops isExemplar; then stamp.
     * Attached simulation ids are remapped to their freshly minted ids. */
    const lessonKeys = new Set(Store.getLessons().map(l => dedupeKey(l.title, l.sharedBy)));
    (items.lessons || []).forEach(raw => {
      const key = dedupeKey(raw.title, author);
      if (lessonKeys.has(key)) { skipped++; return; }
      lessonKeys.add(key);
      const clean = travelLesson(raw);
      const attached = (clean.attachedResources || []).map(r =>
        (r && r.type === 'simulation' && r.id && simIdMap[r.id]) ? { ...r, id: simIdMap[r.id] } : r
      );
      const lesson = Store.addLesson({
        title: clean.title,
        classId: null,
        chatHistory: clean.chatHistory || [],
        plan: clean.plan || '',
        spatialLayout: clean.spatialLayout ? (layoutIdMap[clean.spatialLayout] || null) : null,
        objectives: clean.objectives || '',
        lessonHook: clean.lessonHook || '',
        e21ccFocus: clean.e21ccFocus || [],
        attachedResources: attached,
        components: clean.components || {},
        // Staged segments travel too — their frameworkId links resolve
        // because pack frameworks are merged with ids kept verbatim above.
        runOfShow: clean.runOfShow || null
      });
      Store.updateLesson(lesson.id, stamp(raw.id));
      added.lessons++;
    });

    const addedTotal = ITEM_KEYS.reduce((n, k) => n + added[k], 0);
    return { added, addedTotal, skipped, total, breakdown: describeCounts(added) };
  }

  return { summary, apply };
}
