/*
 * Co-Cher Library — unified store for Lab-generated artifacts
 * ===========================================================
 * The knowledge-management backbone for the Labs: everything a Lab generates
 * becomes a TYPED, REOPENABLE artifact instead of vanishing on navigation.
 * Auto-Lesson runs, Relief Kits and Question Banks save here; each Lab lists
 * its own saved artifacts, and Ctrl+K search finds them all.
 *
 * Follows the proven Materials discipline (utils/deck.js): a small metadata
 * list in localStorage ('cocher_library') and the bulky structured payload in
 * the IndexedDB 'media' store — payload written FIRST, metadata only after
 * the payload write confirms, so the list never points at missing content.
 *
 * Artifact kinds: 'autolesson' | 'reliefkit' | 'questionbank' (extensible —
 * unknown kinds are listed with a generic badge, never dropped).
 */

import { idbPut, idbGet, idbRemove } from './storage.js';
import { md, escapeHtml } from './markdown.js';

const LIST_KEY = 'cocher_library';
const MEDIA_STORE = 'media';

export const ARTIFACT_KINDS = {
  autolesson:   { label: 'Auto-Lesson run', icon: '⚡', color: '#8b5cf6' },
  reliefkit:    { label: 'Relief Kit',      icon: '\u{1F9F0}', color: '#f59e0b' },
  questionbank: { label: 'Question Bank',   icon: '❓', color: '#0ea5e9' },
};
export const artifactKind = (k) => ARTIFACT_KINDS[k] || { label: 'Artifact', icon: '\u{1F4C4}', color: '#64748b' };

function readList() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIST_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function writeList(list) {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
const artifactId = () => 'art_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** All artifact metadata, newest first: [{id, kind, title, subject, level, summary, createdAt, updatedAt}] */
export function listArtifacts(kind) {
  const all = readList().sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return kind ? all.filter(a => a.kind === kind) : all;
}

/**
 * Save (or update) an artifact. Pass `id` to update an existing one in place —
 * that's how Auto-Lesson autosaves a run as it progresses. `data` is any
 * JSON-serialisable payload; it lives in IndexedDB, never in the snapshot.
 * Resolves the metadata entry, or null when the payload could not be stored.
 */
export async function saveArtifact({ id, kind, title, subject, level, summary, data } = {}) {
  if (!kind || !data) return null;
  const artId = id || artifactId();
  const ok = await idbPut(MEDIA_STORE, artId, JSON.stringify(data));
  if (!ok) return null;
  const list = readList();
  const existing = list.find(a => a.id === artId);
  const meta = {
    id: artId,
    kind,
    title: String(title || artifactKind(kind).label).slice(0, 140),
    subject: String(subject || '').slice(0, 60),
    level: String(level || '').slice(0, 40),
    summary: String(summary || '').slice(0, 200),
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
  writeList([meta, ...list.filter(a => a.id !== artId)]);
  return meta;
}

/** The stored payload for an artifact id, parsed — or null when missing. */
export async function getArtifact(id) {
  if (!id) return null;
  const raw = await idbGet(MEDIA_STORE, id);
  if (typeof raw !== 'string' || !raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function deleteArtifact(id) {
  if (!id) return;
  try { await idbRemove(MEDIA_STORE, id); } catch { /* best-effort */ }
  writeList(readList().filter(a => a.id !== id));
}

export function renameArtifact(id, title) {
  const list = readList();
  const meta = list.find(a => a.id === id);
  if (!meta) return false;
  meta.title = String(title || meta.title).slice(0, 140);
  meta.updatedAt = Date.now();
  return writeList(list);
}

/* ── Cross-view open handoff: Ctrl+K (or any view) can route to a Lab and
 * have it auto-open a saved artifact. ── */
const OPEN_KEY = 'cocher_open_artifact';
export function requestOpenArtifact(id) {
  try { sessionStorage.setItem(OPEN_KEY, id); } catch { /* ignore */ }
}
/** One-shot: the target view calls this on render to see if it should open something. */
export function consumeOpenArtifact() {
  try {
    const id = sessionStorage.getItem(OPEN_KEY);
    if (id) sessionStorage.removeItem(OPEN_KEY);
    return id || null;
  } catch { return null; }
}

/* ── Shared "saved artifacts" strip for Lab views ──
 * Renders a compact list with Open / Rename / Delete. The host view supplies
 * onOpen(id, meta); rename/delete are handled here and re-render the strip. */
export function savedArtifactsHTML(kind, esc) {
  const arts = listArtifacts(kind);
  if (!arts.length) return '';
  const k = artifactKind(kind);
  return `
    <div class="card" id="lib-strip" style="padding:14px 16px;margin-bottom:14px;border-left:3px solid ${k.color};">
      <div style="font-size:0.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-muted);margin-bottom:8px;">${k.icon} Saved ${esc(k.label)}s &middot; ${arts.length}</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${arts.map(a => `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" data-lib-open="${esc(a.id)}" style="padding:2px 8px;font-weight:600;color:var(--ink);text-align:left;">${esc(a.title)}</button>
            <span style="font-size:0.6875rem;color:var(--ink-faint);">${esc([a.subject, a.level].filter(Boolean).join(' · '))} · ${new Date(a.updatedAt || a.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span>
            <span style="flex:1;"></span>
            <button class="btn btn-ghost btn-sm" data-lib-rename="${esc(a.id)}" title="Rename" style="padding:1px 6px;color:var(--ink-muted);">&#9998;</button>
            <button class="btn btn-ghost btn-sm" data-lib-delete="${esc(a.id)}" title="Delete" style="padding:1px 6px;color:var(--danger);">&times;</button>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ── Readable renderings of an artifact payload ──
 * One text form (for AI context injection) and one printable document (for
 * viewing from a lesson / Present without navigating away). Both degrade
 * gracefully for unknown kinds. */

const AUTOLESSON_STEP_LABELS = { sow: 'Scheme of Work', lesson: 'Lesson Plan', enactment: 'Enactment Resources', assessment: 'Assessment', reflection: 'Reflection' };

export function artifactContextText(kind, data) {
  if (!data) return '';
  if (kind === 'reliefkit') return data.output || '';
  if (kind === 'questionbank') {
    return (data.items || []).map((q, i) =>
      `Q${i + 1} (${q.bloom || '?'}, ${q.marks ?? '?'} marks, ${q.difficulty || '?'}): ${q.question}\nAnswer: ${q.answer}`).join('\n\n');
  }
  if (kind === 'autolesson') {
    return Object.entries(data.outputs || {})
      .map(([step, text]) => `## ${AUTOLESSON_STEP_LABELS[step] || step}\n${text}`).join('\n\n');
  }
  try { return JSON.stringify(data).slice(0, 4000); } catch { return ''; }
}

function artifactBodyHTML(kind, data) {
  if (kind === 'reliefkit') return md(data.output || '');
  if (kind === 'questionbank') {
    return (data.items || []).map((q, i) => `
      <div style="margin:0 0 18px;padding:12px 14px;border:1px solid #e2e5ea;border-radius:10px;page-break-inside:avoid;">
        <div style="font-weight:700;margin-bottom:4px;">Q${i + 1}. ${escapeHtml(q.question || '')}</div>
        <div style="font-size:0.8rem;color:#64748b;margin-bottom:6px;">${escapeHtml([q.bloom, q.difficulty, (q.marks != null ? q.marks + ' mark' + (q.marks === 1 ? '' : 's') : '')].filter(Boolean).join(' · '))}</div>
        <div style="font-size:0.9rem;"><strong>Answer:</strong> ${escapeHtml(q.answer || '')}</div>
      </div>`).join('');
  }
  if (kind === 'autolesson') {
    return Object.entries(data.outputs || {}).map(([step, text]) =>
      `<h2 style="margin:26px 0 10px;font-size:1.15rem;border-bottom:2px solid #e2e5ea;padding-bottom:6px;">${escapeHtml(AUTOLESSON_STEP_LABELS[step] || step)}</h2>${md(text || '')}`).join('');
  }
  return `<pre style="white-space:pre-wrap;">${escapeHtml(artifactContextText(kind, data))}</pre>`;
}

/**
 * Open an artifact as a clean printable document in a new tab — usable from
 * a lesson page or mid-Present without any navigation. Returns false when
 * the artifact is missing or the pop-up was blocked.
 */
export async function openArtifactWindow(id) {
  const meta = listArtifacts().find(a => a.id === id);
  if (!meta) return false;
  // window.open must happen in the synchronous part of the click gesture —
  // mobile Safari (and strict desktop blockers) refuse pop-ups requested
  // after an await. Open the tab first, then fill it from IndexedDB.
  const w = window.open('', '_blank');
  if (!w) return false;
  const data = await getArtifact(id);
  if (!data) { try { w.close(); } catch { /* ignore */ } return false; }
  const k = artifactKind(meta.kind);
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(meta.title)}</title>
    <style>
      body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 820px; margin: 0 auto; padding: 28px 20px 60px; color: #0f172a; line-height: 1.6; }
      .hd { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; border-bottom: 3px solid #000C53; padding-bottom: 10px; margin-bottom: 18px; }
      .hd h1 { font-size: 1.4rem; margin: 0; }
      .hd .k { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${k.color}; }
      .toolbar { position: sticky; top: 0; background: #fff; padding: 8px 0; text-align: right; }
      .toolbar button { padding: 8px 18px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: 600; cursor: pointer; }
      table { border-collapse: collapse; } td, th { border: 1px solid #e2e5ea; padding: 6px 10px; }
      @media print { .toolbar { display: none; } }
    </style></head><body>
    <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
    <div class="hd"><span class="k">${k.icon} ${escapeHtml(k.label)}</span><h1>${escapeHtml(meta.title)}</h1></div>
    ${artifactBodyHTML(meta.kind, data)}
    </body></html>`);
  w.document.close();
  return true;
}

export function wireSavedArtifacts(container, { onOpen, onChanged }) {
  container.querySelectorAll('[data-lib-open]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.libOpen;
    const meta = listArtifacts().find(a => a.id === id);
    const data = await getArtifact(id);
    if (data && typeof onOpen === 'function') onOpen(id, meta, data);
  }));
  container.querySelectorAll('[data-lib-rename]').forEach(b => b.addEventListener('click', () => {
    const meta = listArtifacts().find(a => a.id === b.dataset.libRename);
    const next = prompt('Rename:', meta?.title || '');
    if (next && next.trim()) { renameArtifact(b.dataset.libRename, next.trim()); if (typeof onChanged === 'function') onChanged(); }
  }));
  container.querySelectorAll('[data-lib-delete]').forEach(b => b.addEventListener('click', async () => {
    await deleteArtifact(b.dataset.libDelete);
    if (typeof onChanged === 'function') onChanged();
  }));
}
