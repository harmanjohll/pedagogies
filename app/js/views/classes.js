/*
 * Co-Cher Classes
 * ===============
 * Classes list + class detail with students and notes.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { showToast } from '../components/toast.js';
import { summarizeNotes } from '../api.js';

/* ═══════════ Classes List ═══════════ */

export function renderList(container) {
  const classes = Store.getClasses();

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header">
          <div>
            <h1 class="page-title">Classes</h1>
            <p class="page-subtitle">Manage your classes, students, and E21CC profiles.</p>
          </div>
          <button class="btn btn-primary" id="add-class-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Class
          </button>
        </div>

        ${classes.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 class="empty-state-title">No classes yet</h3>
            <p class="empty-state-text">Create your first class to start tracking students and their E21CC competency development.</p>
            <button class="btn btn-primary" id="add-class-empty">Create Your First Class</button>
          </div>
        ` : `
          <div class="grid-3 stagger">
            ${classes.map(cls => {
              const studentCount = cls.students?.length || 0;
              const noteCount = cls.notes?.length || 0;
              const avgCait = studentCount > 0 ? Math.round(cls.students.reduce((s, st) => s + (st.e21cc?.cait || 0), 0) / studentCount) : 0;
              const avgCci = studentCount > 0 ? Math.round(cls.students.reduce((s, st) => s + (st.e21cc?.cci || 0), 0) / studentCount) : 0;
              const avgCgc = studentCount > 0 ? Math.round(cls.students.reduce((s, st) => s + (st.e21cc?.cgc || 0), 0) / studentCount) : 0;

              return `
                <div class="card card-hover card-interactive card-accent-top" data-class-id="${cls.id}">
                  <div class="card-header">
                    <div>
                      <div class="card-title">${cls.name}</div>
                      <div class="card-subtitle">${[cls.level, cls.subject].filter(Boolean).join(' · ') || 'No details'}</div>
                    </div>
                  </div>
                  <div class="card-body">
                    <div style="display: flex; gap: var(--sp-3); margin-bottom: var(--sp-4);">
                      <span class="badge badge-blue badge-dot">${studentCount} student${studentCount !== 1 ? 's' : ''}</span>
                      <span class="badge badge-gray badge-dot">${noteCount} note${noteCount !== 1 ? 's' : ''}</span>
                    </div>
                    ${studentCount > 0 ? `
                      <div class="e21cc-bars">
                        <div class="e21cc-bar">
                          <span class="e21cc-bar-label" style="color: var(--e21cc-cait);">CAIT</span>
                          <div class="e21cc-bar-track"><div class="e21cc-bar-fill" style="width:${avgCait}%; background: var(--e21cc-cait);"></div></div>
                          <span class="e21cc-bar-value">${avgCait}</span>
                        </div>
                        <div class="e21cc-bar">
                          <span class="e21cc-bar-label" style="color: var(--e21cc-cci);">CCI</span>
                          <div class="e21cc-bar-track"><div class="e21cc-bar-fill" style="width:${avgCci}%; background: var(--e21cc-cci);"></div></div>
                          <span class="e21cc-bar-value">${avgCci}</span>
                        </div>
                        <div class="e21cc-bar">
                          <span class="e21cc-bar-label" style="color: var(--e21cc-cgc);">CGC</span>
                          <div class="e21cc-bar-track"><div class="e21cc-bar-fill" style="width:${avgCgc}%; background: var(--e21cc-cgc);"></div></div>
                          <span class="e21cc-bar-value">${avgCgc}</span>
                        </div>
                      </div>
                    ` : `
                      <p style="font-size: 0.8125rem; color: var(--ink-faint); font-style: italic;">Add students to see E21CC overview</p>
                    `}
                  </div>
                </div>`;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Event handlers
  const addBtn = container.querySelector('#add-class-btn') || container.querySelector('#add-class-empty');
  if (addBtn) addBtn.addEventListener('click', () => showAddClassModal());

  container.querySelectorAll('[data-class-id]').forEach(el => {
    el.addEventListener('click', () => navigate(`/classes/${el.dataset.classId}`));
  });
}

function showAddClassModal() {
  const { backdrop, close } = openModal({
    title: 'Create New Class',
    body: `
      <div class="input-group">
        <label class="input-label">Class Name</label>
        <input class="input" id="modal-class-name" placeholder="e.g. 3A Science" autofocus />
      </div>
      <div class="input-group">
        <label class="input-label">Level</label>
        <select class="input" id="modal-class-level">
          <option value="">Select level...</option>
          <option>Primary 1</option><option>Primary 2</option><option>Primary 3</option>
          <option>Primary 4</option><option>Primary 5</option><option>Primary 6</option>
          <option>Secondary 1</option><option>Secondary 2</option><option>Secondary 3</option>
          <option>Secondary 4</option><option>Secondary 5</option>
          <option>JC 1</option><option>JC 2</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Subject</label>
        <input class="input" id="modal-class-subject" placeholder="e.g. Science, English, Math" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="create">Create Class</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="create"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#modal-class-name').value.trim();
    if (!name) {
      backdrop.querySelector('#modal-class-name').style.borderColor = 'var(--danger)';
      return;
    }
    const level = backdrop.querySelector('#modal-class-level').value;
    const subject = backdrop.querySelector('#modal-class-subject').value.trim();
    Store.addClass({ name, level, subject });
    showToast(`Class "${name}" created!`, 'success');
    close();
    navigate('/classes');
  });

  setTimeout(() => backdrop.querySelector('#modal-class-name')?.focus(), 100);
}

/* ═══════════ Class Detail ═══════════ */

export function renderDetail(container, { id }) {
  const cls = Store.getClass(id);
  if (!cls) {
    container.innerHTML = `
      <div class="main-scroll">
        <div class="page-container">
          <div class="empty-state">
            <h3 class="empty-state-title">Class not found</h3>
            <p class="empty-state-text">This class may have been deleted.</p>
            <button class="btn btn-primary" id="back-to-classes">Back to Classes</button>
          </div>
        </div>
      </div>`;
    container.querySelector('#back-to-classes')?.addEventListener('click', () => navigate('/classes'));
    return;
  }

  let activeTab = 'students';

  function renderInner() {
    const freshCls = Store.getClass(id);
    if (!freshCls) return;
    const students = freshCls.students || [];
    const notes = freshCls.notes || [];

    container.innerHTML = `
      <div class="main-scroll">
        <div class="page-container">
          <!-- Header -->
          <div style="margin-bottom: var(--sp-6);">
            <button class="btn btn-ghost btn-sm" id="back-btn" style="margin-bottom: var(--sp-4);">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to Classes
            </button>
            <div style="display: flex; align-items: flex-start; justify-content: space-between;">
              <div>
                <h1 class="page-title">${freshCls.name}</h1>
                <p class="page-subtitle">${[freshCls.level, freshCls.subject].filter(Boolean).join(' · ') || 'No details set'}</p>
              </div>
              <div style="display: flex; gap: var(--sp-2);">
                <button class="btn btn-secondary btn-sm" id="edit-class-btn">Edit</button>
                <button class="btn btn-ghost btn-sm" id="delete-class-btn" style="color: var(--danger);">Delete</button>
              </div>
            </div>
          </div>

          <!-- Stats Row -->
          <div class="grid-3" style="margin-bottom: var(--sp-6);">
            <div class="stat-card">
              <div class="stat-label">Students</div>
              <div class="stat-value">${students.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Notes</div>
              <div class="stat-value">${notes.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Lessons</div>
              <div class="stat-value">${Store.getLessonsForClass(id).length}</div>
            </div>
          </div>

          <!-- Quick Actions for this class -->
          <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-6);flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="plan-from-class-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Plan a Lesson
            </button>
            ${students.length > 0 ? `
              <button class="btn btn-secondary btn-sm" id="batch-e21cc-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Batch Update E21CC
              </button>
            ` : ''}
          </div>

          <!-- Tabs -->
          <div class="tab-group" style="margin-bottom: var(--sp-6);">
            <button class="tab ${activeTab === 'students' ? 'active' : ''}" data-tab="students">Students</button>
            <button class="tab ${activeTab === 'notes' ? 'active' : ''}" data-tab="notes">Notes</button>
            <button class="tab ${activeTab === 'trends' ? 'active' : ''}" data-tab="trends">Trends</button>
          </div>

          <!-- Tab Content -->
          <div id="tab-content">
            ${activeTab === 'students' ? renderStudentsTab(freshCls) : activeTab === 'trends' ? renderTrendsTab(freshCls) : renderNotesTab(freshCls)}
          </div>
        </div>
      </div>
    `;

    // Event bindings
    container.querySelector('#back-btn').addEventListener('click', () => navigate('/classes'));

    container.querySelector('#delete-class-btn').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete Class',
        message: `Are you sure you want to delete "${freshCls.name}"? This will also remove all students and notes. This cannot be undone.`
      });
      if (ok) {
        Store.deleteClass(id);
        showToast(`Class "${freshCls.name}" deleted`, 'danger');
        navigate('/classes');
      }
    });

    container.querySelector('#edit-class-btn').addEventListener('click', () => showEditClassModal(freshCls, renderInner));

    // Plan from Class — navigate to planner with class context
    container.querySelector('#plan-from-class-btn')?.addEventListener('click', () => {
      // Store class context so planner can pick it up
      sessionStorage.setItem('cocher_plan_class_id', id);
      sessionStorage.setItem('cocher_plan_class_name', freshCls.name);
      sessionStorage.setItem('cocher_plan_class_subject', freshCls.subject || '');
      sessionStorage.setItem('cocher_plan_class_level', freshCls.level || '');
      navigate('/lesson-planner');
    });

    // Batch E21CC update
    container.querySelector('#batch-e21cc-btn')?.addEventListener('click', () => {
      showBatchE21CCModal(id, renderInner);
    });

    container.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        renderInner();
      });
    });

    // Students tab handlers
    if (activeTab === 'students') {
      const addStudentBtn = container.querySelector('#add-student-btn');
      if (addStudentBtn) addStudentBtn.addEventListener('click', () => showAddStudentModal(id, renderInner));

      container.querySelectorAll('.remove-student-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const sid = btn.dataset.studentId;
          const student = students.find(s => s.id === sid);
          const ok = await confirmDialog({
            title: 'Remove Student',
            message: `Remove "${student?.name}" from this class?`
          });
          if (ok) {
            Store.removeStudent(id, sid);
            showToast('Student removed');
            renderInner();
          }
        });
      });

      // E21CC edit
      container.querySelectorAll('.e21cc-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const sid = btn.dataset.studentId;
          const student = students.find(s => s.id === sid);
          if (student) showEditE21CCModal(id, student, renderInner);
        });
      });
    }

    // Notes tab handlers
    if (activeTab === 'notes') {
      const addNoteBtn = container.querySelector('#add-note-btn');
      if (addNoteBtn) {
        addNoteBtn.addEventListener('click', () => {
          const textarea = container.querySelector('#note-input');
          const text = textarea?.value.trim();
          if (!text) return;
          Store.addNote(id, text);
          showToast('Note added', 'success');
          renderInner();
        });
      }

      container.querySelectorAll('.delete-note-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          Store.deleteNote(id, btn.dataset.noteId);
          showToast('Note deleted');
          renderInner();
        });
      });

      const summarizeBtn = container.querySelector('#summarize-notes-btn');
      if (summarizeBtn) {
        summarizeBtn.addEventListener('click', async () => {
          summarizeBtn.disabled = true;
          summarizeBtn.textContent = 'Summarizing...';
          try {
            const freshNotes = Store.getClass(id)?.notes || [];
            const summary = await summarizeNotes(freshNotes);
            // Show summary in a modal
            openModal({
              title: 'Notes Summary',
              body: `<div style="font-size: 0.875rem; line-height: 1.7; color: var(--ink-secondary); white-space: pre-wrap;">${summary}</div>`,
              footer: `<button class="btn btn-primary" data-action="cancel">Close</button>`,
              width: 560
            });
            const closeBtn = document.querySelector('.modal-footer [data-action="cancel"]');
            if (closeBtn) closeBtn.addEventListener('click', () => closeBtn.closest('.modal-backdrop')?.querySelector('.modal-close')?.click());
          } catch (err) {
            showToast(err.message, 'danger');
          } finally {
            summarizeBtn.disabled = false;
            summarizeBtn.textContent = 'Summarize with AI';
          }
        });
      }
    }
  }

  renderInner();
}

/* ── Student Tab ── */
function renderStudentsTab(cls) {
  const students = cls.students || [];
  if (students.length === 0) {
    return `
      <div class="empty-state" style="padding: var(--sp-8);">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <h3 class="empty-state-title">No students yet</h3>
        <p class="empty-state-text">Add students to track their E21CC competency development.</p>
        <button class="btn btn-primary btn-sm" id="add-student-btn">Add Student</button>
      </div>`;
  }

  return `
    <div style="display: flex; justify-content: flex-end; margin-bottom: var(--sp-4);">
      <button class="btn btn-primary btn-sm" id="add-student-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Student
      </button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>CAIT</th>
            <th>CCI</th>
            <th>CGC</th>
            <th style="width: 120px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: var(--sp-3);">
                  <div class="avatar avatar-sm" style="background: ${stringToColor(s.name)};">${initials(s.name)}</div>
                  <span style="font-weight: 500;">${s.name}</span>
                </div>
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: var(--sp-2);">
                  <div style="width: 48px; height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${s.e21cc?.cait || 0}%; height: 100%; background: var(--e21cc-cait); border-radius: 3px;"></div>
                  </div>
                  <span style="font-size: 0.75rem; color: var(--ink-muted); width: 24px;">${s.e21cc?.cait || 0}</span>
                </div>
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: var(--sp-2);">
                  <div style="width: 48px; height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${s.e21cc?.cci || 0}%; height: 100%; background: var(--e21cc-cci); border-radius: 3px;"></div>
                  </div>
                  <span style="font-size: 0.75rem; color: var(--ink-muted); width: 24px;">${s.e21cc?.cci || 0}</span>
                </div>
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: var(--sp-2);">
                  <div style="width: 48px; height: 6px; background: var(--bg-subtle); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${s.e21cc?.cgc || 0}%; height: 100%; background: var(--e21cc-cgc); border-radius: 3px;"></div>
                  </div>
                  <span style="font-size: 0.75rem; color: var(--ink-muted); width: 24px;">${s.e21cc?.cgc || 0}</span>
                </div>
              </td>
              <td style="text-align: right;">
                <button class="btn btn-ghost btn-sm e21cc-edit-btn" data-student-id="${s.id}" style="font-size: 0.75rem;">Edit E21CC</button>
                <button class="btn btn-ghost btn-sm remove-student-btn" data-student-id="${s.id}" style="color: var(--danger); font-size: 0.75rem;">Remove</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

/* ── Notes Tab ── */
function renderNotesTab(cls) {
  const notes = cls.notes || [];

  return `
    <div style="margin-bottom: var(--sp-6);">
      <textarea class="input" id="note-input" placeholder="Write a class note — observations, ideas, reflections..." rows="3" style="margin-bottom: var(--sp-3);"></textarea>
      <div style="display: flex; justify-content: flex-end; gap: var(--sp-2);">
        ${notes.length >= 2 ? `<button class="btn btn-secondary btn-sm" id="summarize-notes-btn">Summarize with AI</button>` : ''}
        <button class="btn btn-primary btn-sm" id="add-note-btn">Add Note</button>
      </div>
    </div>

    ${notes.length === 0 ? `
      <div class="empty-state" style="padding: var(--sp-6);">
        <h3 class="empty-state-title" style="font-size: 0.9375rem;">No notes yet</h3>
        <p class="empty-state-text" style="font-size: 0.8125rem;">Capture observations, reflections, or ideas for this class.</p>
      </div>
    ` : `
      <div>
        ${notes.map(n => `
          <div class="note-card">
            <div class="note-card-header">
              <span class="note-card-date">${new Date(n.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <button class="btn btn-ghost btn-sm delete-note-btn" data-note-id="${n.id}" style="color: var(--danger); font-size: 0.75rem; padding: 2px 8px;">Delete</button>
            </div>
            <div class="note-card-text">${escapeHtml(n.text)}</div>
            ${n.summary ? `<div class="note-card-summary">${escapeHtml(n.summary)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `}
  `;
}

/* ── Trends Tab ── */
function renderSparkline(history, key, color, width = 100, height = 28) {
  if (!history || history.length < 2) return `<span style="font-size:0.6875rem;color:var(--ink-faint);">Not enough data</span>`;
  const vals = history.map(h => h[key] || 0);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const step = width / (vals.length - 1);
  const points = vals.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  const last = vals[vals.length - 1];
  const first = vals[0];
  const diff = last - first;
  const arrow = diff > 0 ? '\u25B2' : diff < 0 ? '\u25BC' : '\u2500';
  const diffColor = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--ink-faint)';
  return `
    <div style="display:flex;align-items:center;gap:var(--sp-2);">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${(vals.length - 1) * step}" cy="${height - ((last - min) / range) * (height - 4) - 2}" r="2.5" fill="${color}"/>
      </svg>
      <span style="font-size:0.6875rem;font-weight:600;color:${diffColor};">${arrow}${Math.abs(diff)}</span>
    </div>`;
}

function renderTrendsTab(cls) {
  const students = cls.students || [];
  const withHistory = students.filter(s => s.e21ccHistory && s.e21ccHistory.length >= 2);

  if (withHistory.length === 0) {
    return `
      <div class="empty-state" style="padding: var(--sp-8);">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <h3 class="empty-state-title">No trend data yet</h3>
        <p class="empty-state-text">E21CC trends will appear after you update student scores at least twice. Use "Edit E21CC" or "Batch Update" to record changes over time.</p>
      </div>`;
  }

  // Class-level averages over time
  const allTimestamps = [...new Set(withHistory.flatMap(s => s.e21ccHistory.map(h => h.ts)))].sort();
  const classHistory = allTimestamps.map(ts => {
    let cait = 0, cci = 0, cgc = 0, count = 0;
    students.forEach(s => {
      const snapshot = (s.e21ccHistory || []).filter(h => h.ts <= ts);
      if (snapshot.length > 0) {
        const latest = snapshot[snapshot.length - 1];
        cait += latest.cait || 0;
        cci += latest.cci || 0;
        cgc += latest.cgc || 0;
        count++;
      }
    });
    return { ts, cait: count ? Math.round(cait / count) : 0, cci: count ? Math.round(cci / count) : 0, cgc: count ? Math.round(cgc / count) : 0 };
  });

  return `
    <!-- Class Average Trends -->
    <div class="card" style="margin-bottom:var(--sp-6);">
      <h4 style="font-size:0.9375rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);">Class Average Trends</h4>
      <div style="display:flex;gap:var(--sp-6);flex-wrap:wrap;">
        <div>
          <span style="font-size:0.75rem;font-weight:600;color:var(--e21cc-cait);">CAIT</span>
          ${renderSparkline(classHistory, 'cait', 'var(--e21cc-cait)', 120, 32)}
        </div>
        <div>
          <span style="font-size:0.75rem;font-weight:600;color:var(--e21cc-cci);">CCI</span>
          ${renderSparkline(classHistory, 'cci', 'var(--e21cc-cci)', 120, 32)}
        </div>
        <div>
          <span style="font-size:0.75rem;font-weight:600;color:var(--e21cc-cgc);">CGC</span>
          ${renderSparkline(classHistory, 'cgc', 'var(--e21cc-cgc)', 120, 32)}
        </div>
      </div>
    </div>

    <!-- Individual Student Trends -->
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Student</th>
            <th>CAIT Trend</th>
            <th>CCI Trend</th>
            <th>CGC Trend</th>
            <th style="width:80px;text-align:right;">Updates</th>
          </tr>
        </thead>
        <tbody>
          ${withHistory.map(s => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:var(--sp-2);">
                  <div class="avatar avatar-sm" style="background:${stringToColor(s.name)};">${initials(s.name)}</div>
                  <span style="font-weight:500;">${s.name}</span>
                </div>
              </td>
              <td>${renderSparkline(s.e21ccHistory, 'cait', 'var(--e21cc-cait)', 80, 24)}</td>
              <td>${renderSparkline(s.e21ccHistory, 'cci', 'var(--e21cc-cci)', 80, 24)}</td>
              <td>${renderSparkline(s.e21ccHistory, 'cgc', 'var(--e21cc-cgc)', 80, 24)}</td>
              <td style="text-align:right;font-size:0.75rem;color:var(--ink-muted);">${s.e21ccHistory.length}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ── Modals ── */
function showEditClassModal(cls, onUpdate) {
  const { backdrop, close } = openModal({
    title: 'Edit Class',
    body: `
      <div class="input-group">
        <label class="input-label">Class Name</label>
        <input class="input" id="edit-class-name" value="${escapeAttr(cls.name)}" />
      </div>
      <div class="input-group">
        <label class="input-label">Level</label>
        <select class="input" id="edit-class-level">
          <option value="">Select level...</option>
          ${['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6','Secondary 1','Secondary 2','Secondary 3','Secondary 4','Secondary 5','JC 1','JC 2'].map(l =>
            `<option ${cls.level === l ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Subject</label>
        <input class="input" id="edit-class-subject" value="${escapeAttr(cls.subject || '')}" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save Changes</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#edit-class-name').value.trim();
    if (!name) return;
    Store.updateClass(cls.id, {
      name,
      level: backdrop.querySelector('#edit-class-level').value,
      subject: backdrop.querySelector('#edit-class-subject').value.trim()
    });
    showToast('Class updated', 'success');
    close();
    onUpdate();
  });
}

function showAddStudentModal(classId, onUpdate) {
  const { backdrop, close } = openModal({
    title: 'Add Student',
    body: `
      <div class="input-group">
        <label class="input-label">Student Name</label>
        <input class="input" id="student-name" placeholder="Full name" autofocus />
      </div>
      <p style="font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.5;">
        E21CC competency levels can be set after adding the student.
      </p>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="add">Add Student</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="add"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#student-name').value.trim();
    if (!name) {
      backdrop.querySelector('#student-name').style.borderColor = 'var(--danger)';
      return;
    }
    Store.addStudent(classId, { name });
    showToast(`Added "${name}"`, 'success');
    close();
    onUpdate();
  });

  // Enter key
  backdrop.querySelector('#student-name')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') backdrop.querySelector('[data-action="add"]').click();
  });

  setTimeout(() => backdrop.querySelector('#student-name')?.focus(), 100);
}

function showEditE21CCModal(classId, student, onUpdate) {
  const { backdrop, close } = openModal({
    title: `E21CC — ${student.name}`,
    body: `
      <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-2); line-height: 1.5;">
        Adjust competency levels (0–100) based on your observations and assessments.
      </p>
      <div class="input-group">
        <label class="input-label" style="color: var(--e21cc-cait);">CAIT — Critical, Adaptive & Inventive Thinking</label>
        <div style="display: flex; align-items: center; gap: var(--sp-3);">
          <input type="range" id="e21cc-cait" min="0" max="100" value="${student.e21cc?.cait || 50}" style="flex:1;" />
          <span id="e21cc-cait-val" style="width: 32px; text-align: right; font-weight: 600; font-size: 0.875rem;">${student.e21cc?.cait || 50}</span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label" style="color: var(--e21cc-cci);">CCI — Communication, Collaboration & Information</label>
        <div style="display: flex; align-items: center; gap: var(--sp-3);">
          <input type="range" id="e21cc-cci" min="0" max="100" value="${student.e21cc?.cci || 50}" style="flex:1;" />
          <span id="e21cc-cci-val" style="width: 32px; text-align: right; font-weight: 600; font-size: 0.875rem;">${student.e21cc?.cci || 50}</span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label" style="color: var(--e21cc-cgc);">CGC — Civic, Global & Cross-cultural Literacy</label>
        <div style="display: flex; align-items: center; gap: var(--sp-3);">
          <input type="range" id="e21cc-cgc" min="0" max="100" value="${student.e21cc?.cgc || 50}" style="flex:1;" />
          <span id="e21cc-cgc-val" style="width: 32px; text-align: right; font-weight: 600; font-size: 0.875rem;">${student.e21cc?.cgc || 50}</span>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save</button>
    `
  });

  // Live update values
  ['cait', 'cci', 'cgc'].forEach(key => {
    const slider = backdrop.querySelector(`#e21cc-${key}`);
    const valSpan = backdrop.querySelector(`#e21cc-${key}-val`);
    slider?.addEventListener('input', () => { valSpan.textContent = slider.value; });
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    Store.updateStudent(classId, student.id, {
      e21cc: {
        cait: parseInt(backdrop.querySelector('#e21cc-cait').value),
        cci: parseInt(backdrop.querySelector('#e21cc-cci').value),
        cgc: parseInt(backdrop.querySelector('#e21cc-cgc').value)
      }
    });
    showToast('E21CC updated', 'success');
    close();
    onUpdate();
  });
}

/* ── Batch E21CC Update ── */
function showBatchE21CCModal(classId, onUpdate) {
  const cls = Store.getClass(classId);
  if (!cls || !cls.students?.length) return;

  const { backdrop, close } = openModal({
    title: `Batch Update E21CC — ${cls.name}`,
    width: 560,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Adjust all students by the same amount. Use this after a class activity to shift competency levels up or down.
      </p>
      <div class="input-group">
        <label class="input-label">Activity / Reason</label>
        <input class="input" id="batch-reason" placeholder="e.g. Group project on climate change" />
      </div>
      <div class="input-group">
        <label class="input-label" style="color:var(--e21cc-cait);">CAIT Adjustment</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="batch-cait" min="-20" max="20" value="0" style="flex:1;" />
          <span id="batch-cait-val" style="width:40px;text-align:right;font-weight:600;font-size:0.875rem;">0</span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label" style="color:var(--e21cc-cci);">CCI Adjustment</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="batch-cci" min="-20" max="20" value="0" style="flex:1;" />
          <span id="batch-cci-val" style="width:40px;text-align:right;font-weight:600;font-size:0.875rem;">0</span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label" style="color:var(--e21cc-cgc);">CGC Adjustment</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="batch-cgc" min="-20" max="20" value="0" style="flex:1;" />
          <span id="batch-cgc-val" style="width:40px;text-align:right;font-weight:600;font-size:0.875rem;">0</span>
        </div>
      </div>
      <div style="background:var(--bg-subtle);padding:var(--sp-3) var(--sp-4);border-radius:var(--radius-md);font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">
        This will adjust <strong>${cls.students.length} students</strong>. Values are clamped between 0–100.
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="apply">Apply to All Students</button>
    `
  });

  // Live update values
  ['cait', 'cci', 'cgc'].forEach(key => {
    const slider = backdrop.querySelector(`#batch-${key}`);
    const valSpan = backdrop.querySelector(`#batch-${key}-val`);
    slider?.addEventListener('input', () => {
      const v = parseInt(slider.value);
      valSpan.textContent = (v > 0 ? '+' : '') + v;
    });
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="apply"]').addEventListener('click', () => {
    const dCait = parseInt(backdrop.querySelector('#batch-cait').value);
    const dCci = parseInt(backdrop.querySelector('#batch-cci').value);
    const dCgc = parseInt(backdrop.querySelector('#batch-cgc').value);

    if (dCait === 0 && dCci === 0 && dCgc === 0) {
      showToast('No changes to apply.', 'danger');
      return;
    }

    const clamp = (v) => Math.max(0, Math.min(100, v));
    const freshCls = Store.getClass(classId);
    const now = Date.now();
    const updatedStudents = (freshCls.students || []).map(s => {
      const newE21cc = {
        cait: clamp((s.e21cc?.cait || 50) + dCait),
        cci: clamp((s.e21cc?.cci || 50) + dCci),
        cgc: clamp((s.e21cc?.cgc || 50) + dCgc)
      };
      const history = [...(s.e21ccHistory || [])];
      history.push({ ts: now, ...newE21cc });
      if (history.length > 20) history.splice(0, history.length - 20);
      return { ...s, e21cc: newE21cc, e21ccHistory: history };
    });

    Store.updateClass(classId, { students: updatedStudents });
    const reason = backdrop.querySelector('#batch-reason').value.trim();
    showToast(`Updated ${updatedStudents.length} students${reason ? ` — ${reason}` : ''}`, 'success');
    close();
    onUpdate();
  });
}

/* ── Helpers ── */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function initials(name) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function stringToColor(str) {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
