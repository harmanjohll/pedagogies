/*
 * Co-Cher — My Professional Growth
 * =================================
 * Personal PD portfolio: folders for courses, workshops, reflections.
 * Materials can be selected as context when designing lessons.
 */

import { Store, generateId } from '../state.js';
import { navigate } from '../router.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { showToast } from '../components/toast.js';

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }); }
function timeAgo(ts) {
  const d = Date.now() - ts, m = Math.floor(d / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`;
}

const FOLDER_ICONS = {
  course: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  workshop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  conference: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  selfstudy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  pedagogy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
  other: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
};

const FOLDER_COLORS = {
  course: 'var(--accent)',
  workshop: 'var(--success)',
  conference: 'var(--info)',
  selfstudy: 'var(--warning)',
  pedagogy: '#8b5cf6',
  other: 'var(--ink-muted)'
};

const CATEGORY_LABELS = {
  course: 'Course / Module',
  workshop: 'Workshop',
  conference: 'Conference / Seminar',
  selfstudy: 'Self-Study',
  pedagogy: 'Pedagogy',
  other: 'Other'
};

/* ══════════ Main View ══════════ */

export function render(container) {
  const folders = Store.get('pdFolders') || [];
  const lessonReflections = getReflectionsFromLessons();

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header">
          <div>
            <h1 class="page-title">My Professional Growth</h1>
            <p class="page-subtitle">Your PD portfolio — courses, workshops, reflections, and learning resources. Select folders as context when planning lessons.</p>
          </div>
          <button class="btn btn-primary" id="new-folder-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Folder
          </button>
        </div>

        ${lessonReflections.length > 0 ? `
          <div class="card" style="margin-bottom:var(--sp-6);border-left:3px solid var(--accent);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
              <h3 style="font-size:0.9375rem;font-weight:600;color:var(--ink);">Lesson Reflections</h3>
              <span class="badge badge-blue">${lessonReflections.length} reflections</span>
            </div>
            <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Your post-lesson reflections are automatically collected here for reference.</p>
            <div style="display:flex;flex-direction:column;gap:var(--sp-2);max-height:200px;overflow-y:auto;">
              ${lessonReflections.slice(0, 5).map(lr => `
                <div class="card" style="padding:var(--sp-3) var(--sp-4);border:1px solid var(--border-light);cursor:pointer;" data-lesson-ref="${lr.id}">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:500;font-size:0.8125rem;color:var(--ink);">${esc(lr.title)}</span>
                    <span style="font-size:0.6875rem;color:var(--ink-faint);">${fmtDate(lr.updatedAt)}</span>
                  </div>
                  ${lr.snippet ? `<div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(lr.snippet)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${folders.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 class="empty-state-title">No PD folders yet</h3>
            <p class="empty-state-text">Create folders to organise your professional development materials — courses, workshops, reading notes, pedagogy explorations. These can be selected as context when planning lessons.</p>
            <button class="btn btn-primary" id="new-folder-empty">Create Your First Folder</button>
          </div>
        ` : `
          <div style="margin-bottom:var(--sp-3);display:flex;align-items:center;justify-content:space-between;">
            <input class="input" id="pd-search" placeholder="Search folders and materials..." style="max-width:320px;font-size:0.8125rem;" />
          </div>
          <div class="grid-3 stagger" id="folders-grid">
            ${folders.map(f => renderFolderCard(f)).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Handlers
  (container.querySelector('#new-folder-btn') || container.querySelector('#new-folder-empty'))
    ?.addEventListener('click', () => showNewFolderModal(container));

  container.querySelectorAll('[data-folder-id]').forEach(el => {
    el.addEventListener('click', () => navigate(`/my-growth/${el.dataset.folderId}`));
  });

  container.querySelectorAll('[data-lesson-ref]').forEach(el => {
    el.addEventListener('click', () => navigate(`/lessons/${el.dataset.lessonRef}`));
  });

  // Search
  container.querySelector('#pd-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    const grid = container.querySelector('#folders-grid');
    if (!grid) return;
    if (!q) {
      grid.innerHTML = folders.map(f => renderFolderCard(f)).join('');
    } else {
      const filtered = folders.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (f.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (f.materials || []).some(m => m.title.toLowerCase().includes(q))
      );
      grid.innerHTML = filtered.length > 0 ? filtered.map(f => renderFolderCard(f)).join('')
        : '<div style="grid-column:1/-1;text-align:center;padding:var(--sp-8);color:var(--ink-muted);font-size:0.875rem;">No folders match your search.</div>';
    }
    grid.querySelectorAll('[data-folder-id]').forEach(el => {
      el.addEventListener('click', () => navigate(`/my-growth/${el.dataset.folderId}`));
    });
  });
}

function renderFolderCard(f) {
  const icon = FOLDER_ICONS[f.category] || FOLDER_ICONS.other;
  const color = FOLDER_COLORS[f.category] || FOLDER_COLORS.other;
  const materialCount = (f.materials || []).length;
  return `
    <div class="card card-hover card-interactive" data-folder-id="${f.id}" style="border-top:3px solid ${color};">
      <div class="card-header" style="padding-bottom:var(--sp-2);">
        <div style="display:flex;align-items:center;gap:var(--sp-2);">
          <span style="color:${color};">${icon}</span>
          <div class="card-title" style="font-size:0.9375rem;">${esc(f.name)}</div>
        </div>
      </div>
      <div class="card-body">
        ${f.description ? `<p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-2);line-height:1.5;">${esc(f.description).slice(0, 80)}${f.description.length > 80 ? '...' : ''}</p>` : ''}
        <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-2);">
          <span class="badge badge-gray">${materialCount} item${materialCount !== 1 ? 's' : ''}</span>
          <span class="badge" style="background:${color}20;color:${color};">${CATEGORY_LABELS[f.category] || f.category}</span>
        </div>
        ${(f.tags || []).length > 0 ? `
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${f.tags.slice(0, 4).map(t => `<span style="font-size:0.625rem;background:var(--bg-subtle);padding:1px 6px;border-radius:var(--radius-full);color:var(--ink-muted);">#${esc(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>`;
}

function getReflectionsFromLessons() {
  return Store.getLessons()
    .filter(l => {
      const r = l.reflection;
      if (!r) return false;
      if (typeof r === 'string') return r.trim().length > 0;
      return !!(r.whatWorked || r.whatToAdjust || r.engagement || r.e21ccObservations || r.freeform);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(l => {
      const r = typeof l.reflection === 'object' ? l.reflection : { freeform: l.reflection };
      return {
        id: l.id,
        title: l.title,
        updatedAt: l.updatedAt,
        snippet: r.whatWorked || r.freeform || r.whatToAdjust || ''
      };
    });
}

function showNewFolderModal(pageContainer) {
  const { backdrop, close } = openModal({
    title: 'New PD Folder',
    body: `
      <div class="input-group">
        <label class="input-label">Folder Name</label>
        <input class="input" id="pd-name" placeholder="e.g. Team Based Learning" autofocus />
      </div>
      <div class="input-group">
        <label class="input-label">Category</label>
        <select class="input" id="pd-category">
          ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Description</label>
        <textarea class="input" id="pd-desc" rows="2" placeholder="Brief description of this PD area..."></textarea>
      </div>
      <div class="input-group">
        <label class="input-label">Tags (comma-separated)</label>
        <input class="input" id="pd-tags" placeholder="e.g. pedagogy, groupwork, active learning" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="create">Create Folder</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="create"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#pd-name').value.trim();
    if (!name) { backdrop.querySelector('#pd-name').style.borderColor = 'var(--danger)'; return; }
    const folder = {
      id: generateId(),
      name,
      category: backdrop.querySelector('#pd-category').value,
      description: backdrop.querySelector('#pd-desc').value.trim(),
      tags: backdrop.querySelector('#pd-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      materials: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const folders = [...(Store.get('pdFolders') || []), folder];
    Store.set('pdFolders', folders);
    showToast(`Folder "${name}" created!`, 'success');
    close();
    navigate('/my-growth');
  });

  setTimeout(() => backdrop.querySelector('#pd-name')?.focus(), 100);
}

/* ══════════ Folder Detail ══════════ */

export function renderDetail(container, { id }) {
  const folders = Store.get('pdFolders') || [];
  const folder = folders.find(f => f.id === id);
  if (!folder) {
    container.innerHTML = `<div class="main-scroll"><div class="page-container"><div class="empty-state"><h3 class="empty-state-title">Folder not found</h3><button class="btn btn-primary" id="back-btn">Back</button></div></div></div>`;
    container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/my-growth'));
    return;
  }

  const materials = folder.materials || [];
  const color = FOLDER_COLORS[folder.category] || FOLDER_COLORS.other;
  const icon = FOLDER_ICONS[folder.category] || FOLDER_ICONS.other;

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <button class="btn btn-ghost btn-sm" id="back-btn" style="margin-bottom:var(--sp-4);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to My Growth
        </button>

        <div style="margin-bottom:var(--sp-6);">
          <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2);">
            <span style="color:${color};">${icon}</span>
            <h1 class="page-title">${esc(folder.name)}</h1>
          </div>
          ${folder.description ? `<p class="page-subtitle">${esc(folder.description)}</p>` : ''}
          <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-2);flex-wrap:wrap;">
            <span class="badge" style="background:${color}20;color:${color};">${CATEGORY_LABELS[folder.category] || folder.category}</span>
            ${(folder.tags || []).map(t => `<span class="badge badge-gray">#${esc(t)}</span>`).join('')}
            <span class="badge badge-gray">${materials.length} item${materials.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-6);flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="add-material-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Material
          </button>
          <button class="btn btn-secondary btn-sm" id="add-note-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Add Note
          </button>
          <button class="btn btn-ghost btn-sm" id="edit-folder-btn">Edit Folder</button>
          <button class="btn btn-ghost btn-sm" id="delete-folder-btn" style="color:var(--danger);">Delete Folder</button>
        </div>

        ${materials.length === 0 ? `
          <div class="empty-state" style="padding:var(--sp-8);">
            <div class="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3 class="empty-state-title">No materials yet</h3>
            <p class="empty-state-text">Upload slides, paste notes, or add reflections from your PD sessions.</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
            ${materials.map(m => `
              <div class="card" style="padding:var(--sp-4) var(--sp-5);">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;">
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-1);">
                      <span class="badge ${m.type === 'file' ? 'badge-blue' : m.type === 'note' ? 'badge-green' : 'badge-gray'}">${m.type === 'file' ? 'File' : m.type === 'note' ? 'Note' : 'Link'}</span>
                      <span style="font-size:0.6875rem;color:var(--ink-faint);">${fmtDate(m.createdAt)}</span>
                    </div>
                    <h4 style="font-weight:600;font-size:0.9375rem;color:var(--ink);margin-bottom:4px;">${esc(m.title)}</h4>
                    <div style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.6;max-height:120px;overflow:hidden;white-space:pre-wrap;">${esc((m.content || '').slice(0, 400))}${(m.content || '').length > 400 ? '...' : ''}</div>
                  </div>
                  <div style="display:flex;gap:var(--sp-1);flex-shrink:0;margin-left:var(--sp-3);">
                    <button class="btn btn-ghost btn-sm expand-material-btn" data-mid="${m.id}" title="View full content">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-sm del-material-btn" data-mid="${m.id}" title="Delete" style="color:var(--danger);">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}

        <div class="card" style="margin-top:var(--sp-6);background:var(--bg-subtle);border:1px dashed var(--border);">
          <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
            <strong>Use in Lesson Planning:</strong> When designing a lesson in the Lesson Planner, click "Attach Context" and select this folder.
            Its materials will be included as context for Co-Cher's suggestions.
          </p>
        </div>
      </div>
    </div>
  `;

  // Handlers
  container.querySelector('#back-btn').addEventListener('click', () => navigate('/my-growth'));

  container.querySelector('#add-material-btn')?.addEventListener('click', () => {
    showAddMaterialModal(folder.id, 'file', () => renderDetail(container, { id }));
  });

  container.querySelector('#add-note-btn')?.addEventListener('click', () => {
    showAddMaterialModal(folder.id, 'note', () => renderDetail(container, { id }));
  });

  container.querySelector('#edit-folder-btn')?.addEventListener('click', () => {
    showEditFolderModal(folder, () => renderDetail(container, { id }));
  });

  container.querySelector('#delete-folder-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete Folder',
      message: `Delete "${folder.name}" and all its materials? This cannot be undone.`
    });
    if (ok) {
      Store.set('pdFolders', (Store.get('pdFolders') || []).filter(f => f.id !== id));
      showToast(`Deleted "${folder.name}"`);
      navigate('/my-growth');
    }
  });

  container.querySelectorAll('.expand-material-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = materials.find(x => x.id === btn.dataset.mid);
      if (!m) return;
      openModal({
        title: m.title,
        width: 640,
        body: `<div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);white-space:pre-wrap;max-height:60vh;overflow-y:auto;">${esc(m.content || 'No content')}</div>`,
        footer: `<button class="btn btn-primary" data-action="cancel">Close</button>`
      });
    });
  });

  container.querySelectorAll('.del-material-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = materials.find(x => x.id === btn.dataset.mid);
      if (!m) return;
      const ok = await confirmDialog({ title: 'Delete Material', message: `Delete "${m.title}"?` });
      if (ok) {
        const folders = Store.get('pdFolders') || [];
        const updated = folders.map(f => {
          if (f.id !== id) return f;
          return { ...f, materials: (f.materials || []).filter(x => x.id !== btn.dataset.mid), updatedAt: Date.now() };
        });
        Store.set('pdFolders', updated);
        showToast('Material deleted');
        renderDetail(container, { id });
      }
    });
  });
}

function showAddMaterialModal(folderId, defaultType, onDone) {
  const isNote = defaultType === 'note';
  const { backdrop, close } = openModal({
    title: isNote ? 'Add Note' : 'Add Material',
    width: 560,
    body: `
      <div class="input-group">
        <label class="input-label">Title</label>
        <input class="input" id="mat-title" placeholder="${isNote ? 'e.g. My reflections on TBL' : 'e.g. TBL Workshop Slides'}" autofocus />
      </div>
      ${!isNote ? `
        <div class="input-group">
          <label class="input-label">Upload File (.txt, .md, .csv) or Paste Content</label>
          <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-2);">
            <button class="btn btn-secondary btn-sm" id="mat-file-btn" style="flex:1;">Choose File</button>
          </div>
        </div>
      ` : ''}
      <div class="input-group">
        <label class="input-label">${isNote ? 'Your Notes / Reflections' : 'Content (paste or type)'}</label>
        <textarea class="input" id="mat-content" rows="8" placeholder="${isNote ? 'Write your thoughts, key takeaways, reflections...' : 'Paste slides content, notes, or key points...'}"></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save</button>
    `
  });

  backdrop.querySelector('#mat-file-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.csv,.text';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        backdrop.querySelector('#mat-content').value = reader.result;
        if (!backdrop.querySelector('#mat-title').value.trim()) {
          backdrop.querySelector('#mat-title').value = file.name.replace(/\.[^.]+$/, '');
        }
        showToast(`Loaded "${file.name}"`);
      };
      reader.readAsText(file);
    });
    input.click();
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const title = backdrop.querySelector('#mat-title').value.trim();
    const content = backdrop.querySelector('#mat-content').value.trim();
    if (!title) { backdrop.querySelector('#mat-title').style.borderColor = 'var(--danger)'; return; }
    if (!content) { showToast('Please add some content.', 'danger'); return; }

    const material = {
      id: generateId(),
      title,
      type: isNote ? 'note' : 'file',
      content,
      createdAt: Date.now()
    };

    const folders = (Store.get('pdFolders') || []).map(f => {
      if (f.id !== folderId) return f;
      return { ...f, materials: [...(f.materials || []), material], updatedAt: Date.now() };
    });
    Store.set('pdFolders', folders);
    showToast(`Added "${title}"`, 'success');
    close();
    onDone();
  });

  setTimeout(() => backdrop.querySelector('#mat-title')?.focus(), 100);
}

function showEditFolderModal(folder, onDone) {
  const { backdrop, close } = openModal({
    title: 'Edit Folder',
    body: `
      <div class="input-group">
        <label class="input-label">Folder Name</label>
        <input class="input" id="edit-pd-name" value="${esc(folder.name)}" />
      </div>
      <div class="input-group">
        <label class="input-label">Category</label>
        <select class="input" id="edit-pd-category">
          ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}" ${folder.category === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Description</label>
        <textarea class="input" id="edit-pd-desc" rows="2">${esc(folder.description || '')}</textarea>
      </div>
      <div class="input-group">
        <label class="input-label">Tags (comma-separated)</label>
        <input class="input" id="edit-pd-tags" value="${esc((folder.tags || []).join(', '))}" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#edit-pd-name').value.trim();
    if (!name) return;
    const folders = (Store.get('pdFolders') || []).map(f => {
      if (f.id !== folder.id) return f;
      return {
        ...f,
        name,
        category: backdrop.querySelector('#edit-pd-category').value,
        description: backdrop.querySelector('#edit-pd-desc').value.trim(),
        tags: backdrop.querySelector('#edit-pd-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        updatedAt: Date.now()
      };
    });
    Store.set('pdFolders', folders);
    showToast('Folder updated', 'success');
    close();
    onDone();
  });
}
