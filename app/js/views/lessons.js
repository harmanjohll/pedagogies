/*
 * Co-Cher Lessons Library
 * =======================
 * List all saved lessons, view details, add reflections.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { confirmDialog } from '../components/modals.js';
import { showToast } from '../components/toast.js';

const STATUS_MAP = {
  draft: { label: 'Draft', badge: 'badge-gray' },
  ready: { label: 'Ready', badge: 'badge-green' },
  completed: { label: 'Completed', badge: 'badge-blue' }
};

const E21CC_LABELS = { cait: 'CAIT', cci: 'CCI', cgc: 'CGC' };
const E21CC_BADGE = { cait: 'badge-blue', cci: 'badge-green', cgc: 'badge-amber' };

function timeAgo(ts) {
  const d = Date.now() - ts, m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function mdBasic(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.06);padding:8px 12px;border-radius:8px;font-size:0.8rem;overflow-x:auto;margin:6px 0;"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:0.9rem;font-weight:600;margin:8px 0 4px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:10px 0 4px;">$1</h3>')
    .replace(/^[-*] (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul style="padding-left:1.25rem;margin:4px 0;">${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/\n{2,}/g, '</p><p style="margin:4px 0;">')
    .replace(/\n/g, '<br>');
}

/* ══════════ Lessons List ══════════ */

export function renderList(container) {
  const lessons = Store.getLessons().sort((a, b) => b.updatedAt - a.updatedAt);
  const classes = Store.getClasses();
  const classMap = Object.fromEntries(classes.map(c => [c.id, c.name]));

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header">
          <div>
            <h1 class="page-title">Lessons</h1>
            <p class="page-subtitle">Your saved lesson plans and conversations with Co-Cher.</p>
          </div>
          <button class="btn btn-primary" id="new-lesson-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Lesson
          </button>
        </div>

        ${lessons.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3 class="empty-state-title">No lessons yet</h3>
            <p class="empty-state-text">Open the Lesson Planner, chat with Co-Cher, then save your lesson to see it here.</p>
            <button class="btn btn-primary" id="new-lesson-empty">Start Planning</button>
          </div>
        ` : `
          <div class="tab-group" style="margin-bottom:var(--sp-6);">
            <button class="tab active" data-filter="all">All (${lessons.length})</button>
            <button class="tab" data-filter="draft">Draft (${lessons.filter(l => l.status === 'draft').length})</button>
            <button class="tab" data-filter="ready">Ready (${lessons.filter(l => l.status === 'ready').length})</button>
            <button class="tab" data-filter="completed">Done (${lessons.filter(l => l.status === 'completed').length})</button>
          </div>
          <div id="lessons-grid" class="stagger" style="display:flex;flex-direction:column;gap:var(--sp-4);"></div>
        `}
      </div>
    </div>
  `;

  const grid = container.querySelector('#lessons-grid');
  if (grid) renderCards(grid, lessons, classMap);

  container.querySelectorAll('[data-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('[data-filter]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const f = tab.dataset.filter;
      renderCards(grid, f === 'all' ? lessons : lessons.filter(l => l.status === f), classMap);
    });
  });

  (container.querySelector('#new-lesson-btn') || container.querySelector('#new-lesson-empty'))
    ?.addEventListener('click', () => navigate('/lesson-planner'));
}

function renderCards(grid, lessons, classMap) {
  if (!grid) return;
  if (lessons.length === 0) {
    grid.innerHTML = `<div style="text-align:center;padding:var(--sp-8);color:var(--ink-muted);font-size:0.875rem;">No lessons match this filter.</div>`;
    return;
  }
  grid.innerHTML = lessons.map(l => {
    const s = STATUS_MAP[l.status] || STATUS_MAP.draft;
    const cn = l.classId ? classMap[l.classId] : null;
    const ex = (l.chatHistory || []).filter(m => m.role === 'assistant').length;
    return `
      <div class="card card-hover card-interactive" data-lesson-id="${l.id}" style="padding:var(--sp-5) var(--sp-6);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-1);flex-wrap:wrap;">
              <span class="badge ${s.badge} badge-dot">${s.label}</span>
              ${cn ? `<span class="badge badge-gray">${esc(cn)}</span>` : ''}
              ${(l.e21ccFocus || []).map(f => `<span class="badge ${E21CC_BADGE[f]}">${E21CC_LABELS[f]}</span>`).join('')}
            </div>
            <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:2px;">${esc(l.title)}</h3>
            <p style="font-size:0.8125rem;color:var(--ink-muted);">
              ${ex} exchange${ex !== 1 ? 's' : ''} &middot; ${timeAgo(l.updatedAt)}${l.reflection ? ' &middot; Has reflection' : ''}
            </p>
          </div>
          <div style="display:flex;gap:var(--sp-1);flex-shrink:0;margin-left:var(--sp-4);">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${l.id}" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm del-btn" data-id="${l.id}" title="Delete" style="color:var(--danger);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('[data-lesson-id]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.edit-btn') || e.target.closest('.del-btn')) return;
      navigate(`/lessons/${el.dataset.lessonId}`);
    });
  });
  grid.querySelectorAll('.edit-btn').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); navigate(`/lesson-planner/${b.dataset.id}`); });
  });
  grid.querySelectorAll('.del-btn').forEach(b => {
    b.addEventListener('click', async e => {
      e.stopPropagation();
      const ok = await confirmDialog({ title: 'Delete Lesson', message: `Delete "${Store.getLesson(b.dataset.id)?.title}"? This cannot be undone.` });
      if (ok) { Store.deleteLesson(b.dataset.id); showToast('Lesson deleted'); navigate('/lessons'); }
    });
  });
}

/* ══════════ Lesson Detail ══════════ */

export function renderDetail(container, { id }) {
  const lesson = Store.getLesson(id);
  if (!lesson) {
    container.innerHTML = `<div class="main-scroll"><div class="page-container"><div class="empty-state"><h3 class="empty-state-title">Lesson not found</h3><button class="btn btn-primary" id="back-btn">Back</button></div></div></div>`;
    container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/lessons'));
    return;
  }

  const cn = lesson.classId ? Store.getClass(lesson.classId)?.name : null;
  const s = STATUS_MAP[lesson.status] || STATUS_MAP.draft;
  const aiMsgs = (lesson.chatHistory || []).filter(m => m.role === 'assistant');

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <button class="btn btn-ghost btn-sm" id="back-btn" style="margin-bottom:var(--sp-4);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Lessons
        </button>

        <div style="margin-bottom:var(--sp-6);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2);flex-wrap:wrap;">
            <span class="badge ${s.badge} badge-dot">${s.label}</span>
            ${cn ? `<span class="badge badge-gray">${esc(cn)}</span>` : ''}
            ${(lesson.e21ccFocus || []).map(f => `<span class="badge ${E21CC_BADGE[f]}">${E21CC_LABELS[f]}</span>`).join('')}
          </div>
          <h1 class="page-title">${esc(lesson.title)}</h1>
          <p class="page-subtitle">Created ${fmtDate(lesson.createdAt)} &middot; Updated ${fmtDate(lesson.updatedAt)}</p>
        </div>

        <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-6);">
          <button class="btn btn-primary btn-sm" id="edit-btn">Continue in Planner</button>
          <button class="btn btn-secondary btn-sm" id="status-btn">Change Status</button>
        </div>

        <div class="card" style="margin-bottom:var(--sp-6);">
          <h3 style="font-size:1rem;font-weight:600;margin-bottom:var(--sp-4);color:var(--ink);">Lesson Plan</h3>
          ${aiMsgs.length > 0 ? `
            <div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);">${mdBasic(aiMsgs[aiMsgs.length - 1].content)}</div>
            ${aiMsgs.length > 1 ? `
              <details style="margin-top:var(--sp-4);">
                <summary style="cursor:pointer;font-size:0.8125rem;color:var(--ink-muted);padding:var(--sp-2) 0;">Earlier exchanges (${aiMsgs.length - 1})</summary>
                <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3);">
                  ${aiMsgs.slice(0, -1).reverse().map(m => `<div style="padding:var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-md);font-size:0.8125rem;line-height:1.6;color:var(--ink-muted);">${mdBasic(m.content)}</div>`).join('')}
                </div>
              </details>` : ''}
          ` : `<p style="color:var(--ink-muted);font-size:0.875rem;">No plan content yet.</p>`}
        </div>

        <div class="card">
          <h3 style="font-size:1rem;font-weight:600;margin-bottom:var(--sp-3);color:var(--ink);">Post-Lesson Reflection</h3>
          <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">After teaching, capture what went well, what you'd change, and student responses.</p>
          <textarea class="input" id="reflection" rows="4" placeholder="Write your reflection here...">${esc(lesson.reflection || '')}</textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:var(--sp-3);">
            <button class="btn btn-secondary btn-sm" id="save-ref">Save Reflection</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#back-btn').addEventListener('click', () => navigate('/lessons'));
  container.querySelector('#edit-btn').addEventListener('click', () => navigate(`/lesson-planner/${id}`));
  container.querySelector('#status-btn').addEventListener('click', () => {
    const order = ['draft', 'ready', 'completed'];
    const next = order[(order.indexOf(lesson.status) + 1) % order.length];
    Store.updateLesson(id, { status: next });
    showToast(`Status: ${STATUS_MAP[next].label}`, 'success');
    renderDetail(container, { id });
  });
  container.querySelector('#save-ref').addEventListener('click', () => {
    Store.updateLesson(id, { reflection: container.querySelector('#reflection').value });
    showToast('Reflection saved!', 'success');
  });
}
