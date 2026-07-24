/*
 * Co-Cher — The Library (unified knowledge view)
 * ==============================================
 * One page for everything the teacher has saved, across every store that
 * previously lived on its own shelf: Lab artifacts (Auto-Lesson runs, Relief
 * Kits, Question Banks), My References, slide decks and audio clips.
 * Filter by kind, search across titles, and act: deep-open artifacts back in
 * their Lab, view/print them, attach them to a lesson (so they surface in
 * Present), rename, delete.
 *
 * Mobile-first: single-column rows that wrap, ≥40px touch targets, and the
 * filter chips scroll/wrap on a phone.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modals.js';
import { escapeHtml } from '../utils/markdown.js';
import { listDeckMeta, listAudioMeta } from '../utils/deck.js';
import { listArtifacts, artifactKind, renameArtifact, deleteArtifact, requestOpenArtifact, openArtifactWindow } from '../utils/library.js';

const esc = escapeHtml;

const KIND_ROUTE = { autolesson: '/autopilot', reliefkit: '/relief-kit', questionbank: '/question-bank' };

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'autolesson', label: 'Auto-Lesson runs' },
  { id: 'reliefkit', label: 'Relief Kits' },
  { id: 'questionbank', label: 'Question Banks' },
  { id: 'reference', label: 'References' },
  { id: 'deck', label: 'Slide decks' },
  { id: 'audio', label: 'Audio clips' },
];

function allItems() {
  const items = [];
  listArtifacts().forEach(a => {
    const k = artifactKind(a.kind);
    items.push({
      cat: a.kind, id: a.id, title: a.title, badge: k.label, color: k.color,
      sub: [a.subject, a.level, a.summary].filter(Boolean).join(' · '),
      date: a.updatedAt || a.createdAt,
      isArtifact: true,
    });
  });
  (Store.getReferences ? Store.getReferences() : []).forEach(r => {
    items.push({
      cat: 'reference', id: r.id, title: r.name, badge: 'Reference', color: '#0d9488',
      sub: r.source?.filename || (r.summary ? r.summary.slice(0, 80) : ''),
      date: r.createdAt,
    });
  });
  listDeckMeta().forEach(d => {
    items.push({
      cat: 'deck', id: d.id, title: d.title, badge: 'Slide deck', color: '#7c3aed',
      sub: `${d.slideCount || '?'} slides${d.hasModel ? ' · Live-ready' : ''}`,
      date: d.createdAt,
    });
  });
  listAudioMeta().forEach(a => {
    items.push({
      cat: 'audio', id: a.id, title: a.title, badge: 'Audio clip', color: '#e11d48',
      sub: a.style || '', date: a.createdAt,
    });
  });
  return items.sort((a, b) => (b.date || 0) - (a.date || 0));
}

export function render(container) {
  let filter = 'all';
  let query = '';

  function renderView() {
    const items = allItems().filter(it =>
      (filter === 'all' || it.cat === filter) &&
      (!query || `${it.title} ${it.sub} ${it.badge}`.toLowerCase().includes(query.toLowerCase())));

    container.innerHTML = `
      <div class="main-scroll"><div class="page-container" style="max-width:860px;">
        <style>
          .lib-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 14px; border:1px solid var(--border-light); border-radius:12px; background:var(--bg-card); }
          .lib-row + .lib-row { margin-top:8px; }
          .lib-actions { display:flex; gap:6px; flex-wrap:wrap; margin-left:auto; }
          .lib-actions .btn { min-height:40px; }
          .lib-chips { display:flex; gap:6px; flex-wrap:wrap; margin:12px 0 16px; }
          .lib-chip { padding:8px 14px; border-radius:999px; border:1px solid var(--border); background:var(--bg-card); font-size:0.8125rem; font-weight:600; cursor:pointer; min-height:40px; }
          .lib-chip.on { background:var(--accent); border-color:var(--accent); color:#fff; }
          @media (max-width:560px) { .lib-row { align-items:flex-start; } .lib-actions { margin-left:0; width:100%; } .lib-actions .btn { flex:1 1 auto; } }
        </style>
        <h1 style="font-size:1.5rem;font-weight:800;margin:0 0 2px;color:var(--ink);">Library</h1>
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin:0 0 12px;">Everything you've saved — Lab outputs, references, decks and audio. Attach any of it to a lesson, or reopen it where it was made.</p>
        <input id="lib-search" class="input" type="search" placeholder="Search your library…" value="${esc(query)}" style="width:100%;box-sizing:border-box;min-height:44px;" />
        <div class="lib-chips">
          ${FILTERS.map(f => `<button class="lib-chip${filter === f.id ? ' on' : ''}" data-filter="${f.id}">${esc(f.label)}</button>`).join('')}
        </div>
        ${items.length ? items.map(it => `
          <div class="lib-row">
            <span class="badge" style="background:${it.color}1a;color:${it.color};font-size:0.625rem;font-weight:700;flex-shrink:0;">${esc(it.badge)}</span>
            <div style="min-width:0;">
              <div style="font-weight:600;color:var(--ink);font-size:0.875rem;overflow-wrap:anywhere;">${esc(it.title)}</div>
              <div style="font-size:0.75rem;color:var(--ink-muted);overflow-wrap:anywhere;">${esc(it.sub)}${it.date ? ` · ${new Date(it.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}` : ''}</div>
            </div>
            <div class="lib-actions">
              ${it.isArtifact ? `
                <button class="btn btn-secondary btn-sm" data-act="open" data-id="${esc(it.id)}" data-cat="${esc(it.cat)}">Open in Lab</button>
                <button class="btn btn-ghost btn-sm" data-act="view" data-id="${esc(it.id)}" title="Read-only view, printable">View</button>
                <button class="btn btn-ghost btn-sm" data-act="attach" data-id="${esc(it.id)}" data-cat="${esc(it.cat)}" data-title="${esc(it.title)}" title="Link to a lesson — it will surface in Present">Attach to lesson</button>
                <button class="btn btn-ghost btn-sm" data-act="rename" data-id="${esc(it.id)}" title="Rename">&#9998;</button>
                <button class="btn btn-ghost btn-sm" data-act="delete" data-id="${esc(it.id)}" title="Delete" style="color:var(--danger);">&times;</button>
              ` : it.cat === 'deck' ? `
                <button class="btn btn-secondary btn-sm" data-act="deck" data-id="${esc(it.id)}">Open deck</button>
              ` : it.cat === 'reference' ? `
                <button class="btn btn-secondary btn-sm" data-act="refs">Manage in My Learning</button>
              ` : `
                <button class="btn btn-secondary btn-sm" data-act="lessons">Find in Lessons</button>
              `}
            </div>
          </div>`).join('')
        : `<div style="text-align:center;padding:40px 20px;color:var(--ink-muted);border:2px dashed var(--border);border-radius:12px;font-size:0.875rem;">
             Nothing here yet${filter !== 'all' || query ? ' for this filter' : ''} — generate something in a Lab, save a deck, or add a Reference, and it lands in your Library.
           </div>`}
      </div></div>`;

    container.querySelector('#lib-search').addEventListener('input', (e) => {
      query = e.target.value;
      const pos = e.target.selectionStart;
      renderView();
      const inp = container.querySelector('#lib-search');
      inp.focus(); try { inp.setSelectionRange(pos, pos); } catch { /* ok */ }
    });
    container.querySelectorAll('.lib-chip').forEach(c => c.addEventListener('click', () => { filter = c.dataset.filter; renderView(); }));

    container.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
      const { act, id, cat, title } = btn.dataset;
      if (act === 'open') { requestOpenArtifact(id); navigate(KIND_ROUTE[cat] || '/'); }
      else if (act === 'view') { if (!(await openArtifactWindow(id))) showToast('Could not open — allow pop-ups and try again.', 'danger'); }
      else if (act === 'attach') showAttachModal(id, cat, title);
      else if (act === 'rename') {
        const meta = listArtifacts().find(a => a.id === id);
        const next = prompt('Rename:', meta?.title || '');
        if (next && next.trim()) { renameArtifact(id, next.trim()); renderView(); }
      }
      else if (act === 'delete') { await deleteArtifact(id); showToast('Deleted from the Library.', 'success'); renderView(); }
      else if (act === 'deck') navigate(`/deck/${id}`);
      else if (act === 'refs') navigate('/my-growth');
      else if (act === 'lessons') navigate('/lessons');
    }));
  }

  /* Attach an artifact to a lesson — it joins attachedResources like a deck
   * does, so it shows on the lesson page and in Present's materials row. */
  function showAttachModal(id, kind, title) {
    const lessons = (Store.get('lessons') || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 30);
    if (!lessons.length) { showToast('No lessons yet — create one in the Lesson Planner first.', 'danger'); return; }
    const { backdrop, close } = openModal({
      title: 'Attach to lesson',
      width: 440,
      body: `
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">“${esc(title)}” will be linked under the lesson's resources and appear in Present.</p>
        <div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
          ${lessons.map(l => `<button class="btn btn-secondary lib-att-lesson" data-lesson="${esc(l.id)}" style="justify-content:flex-start;text-align:left;min-height:44px;">${esc(l.title || 'Untitled lesson')}</button>`).join('')}
        </div>`,
      footer: `<button class="btn btn-ghost" data-action="cancel">Cancel</button>`,
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
    backdrop.querySelectorAll('.lib-att-lesson').forEach(b => b.addEventListener('click', () => {
      const lesson = Store.getLesson(b.dataset.lesson);
      if (!lesson) return;
      const existing = lesson.attachedResources || [];
      if (existing.some(r => r.id === id)) { showToast('Already attached to that lesson.', 'warning'); close(); return; }
      Store.updateLesson(lesson.id, { attachedResources: [...existing, { type: kind, id, title }] });
      showToast(`Attached to “${lesson.title}”.`, 'success');
      close();
    }));
  }

  renderView();
}
