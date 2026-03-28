/*
 * Co-Cher Classes
 * ===============
 * Classes list + class detail with students and notes.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { showToast } from '../components/toast.js';
import { summarizeNotes, suggestGrouping, sendChat } from '../api.js';
import { renderMd } from '../utils/latex.js';

const E21CC_DIMS = [
  { key: 'criticalThinking',    label: 'Critical Thinking',     short: 'CT',  color: '#6366f1' },
  { key: 'creativeThinking',    label: 'Creative Thinking',     short: 'CrT', color: '#8b5cf6' },
  { key: 'communication',       label: 'Communication',         short: 'Com', color: '#0ea5e9' },
  { key: 'collaboration',       label: 'Collaboration',         short: 'Col', color: '#06b6d4' },
  { key: 'socialConnectedness', label: 'Social Connectedness',  short: 'SC',  color: '#10b981' },
  { key: 'selfRegulation',     label: 'Self-Regulation',       short: 'SR',  color: '#f59e0b' },
];

const E21CC_LEVELS = [
  { key: 'developing', label: 'Developing', short: 'Dev', color: '#f59e0b', value: 1 },
  { key: 'applying', label: 'Applying', short: 'App', color: '#3b82f6', value: 2 },
  { key: 'extending', label: 'Extending', short: 'Ext', color: '#10b981', value: 3 },
  { key: 'leading', label: 'Leading', short: 'Lead', color: '#8b5cf6', value: 4 },
];

function levelToValue(level) { return E21CC_LEVELS.find(l => l.key === level)?.value || 1; }
function levelMeta(level) { return E21CC_LEVELS.find(l => l.key === level) || E21CC_LEVELS[0]; }

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
              const dimModes = E21CC_DIMS.map(d => {
                if (studentCount === 0) return { ...d, mode: null };
                const counts = {};
                cls.students.forEach(st => {
                  const lv = st.e21cc?.[d.key] || 'developing';
                  counts[lv] = (counts[lv] || 0) + 1;
                });
                const mode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                return { ...d, mode };
              });

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
                      <div style="display:flex;flex-wrap:wrap;gap:6px;">
                        ${dimModes.map(d => {
                          const meta = levelMeta(d.mode);
                          return `<div style="display:flex;align-items:center;gap:4px;">
                            <span style="font-size:0.6875rem;font-weight:600;color:${d.color};">${d.short}</span>
                            <span style="padding:2px 6px;border-radius:4px;font-size:0.6875rem;font-weight:600;background:${meta.color}15;color:${meta.color};">${meta.short}</span>
                          </div>`;
                        }).join('')}
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
              <button class="btn btn-ghost btn-sm" id="group-students-btn" title="Auto-generate student groups">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                Groups
              </button>
              <button class="btn btn-ghost btn-sm" id="parent-digest-btn" title="Generate a weekly parent digest">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Parent Digest
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

    // Student grouping
    container.querySelector('#group-students-btn')?.addEventListener('click', () => {
      showGroupingModal(id);
    });

    // Parent digest
    container.querySelector('#parent-digest-btn')?.addEventListener('click', () => {
      showParentDigestModal(freshCls);
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

      // Radar chart toggle
      let radarChart = null;
      const barViewBtn = container.querySelector('#bar-view-btn');
      const radarViewBtn = container.querySelector('#radar-view-btn');
      const radarContainer = container.querySelector('#radar-chart-container');
      const tableWrap = container.querySelector('.table-wrap');

      if (radarViewBtn && barViewBtn) {
        radarViewBtn.addEventListener('click', () => {
          radarViewBtn.classList.remove('btn-ghost');
          radarViewBtn.style.fontWeight = '600';
          barViewBtn.classList.add('btn-ghost');
          barViewBtn.style.fontWeight = '';
          if (tableWrap) tableWrap.style.display = 'none';
          if (radarContainer) radarContainer.style.display = 'block';
          buildStudentRadar();
        });

        function buildStudentRadar() {
          const canvas = container.querySelector('#e21cc-radar-canvas');
          const select = container.querySelector('#radar-student-select');
          if (!canvas || !select || typeof Chart === 'undefined' || students.length === 0) return;
          const idx = parseInt(select.value) || 0;
          const student = students[idx];
          if (!student) return;
          if (radarChart) radarChart.destroy();
          const scores = E21CC_DIMS.map(d => levelToValue(student.e21cc?.[d.key] || 'developing'));
          radarChart = new Chart(canvas, {
            type: 'radar',
            data: {
              labels: E21CC_DIMS.map(d => d.label),
              datasets: [{
                label: student.name,
                data: scores,
                backgroundColor: 'rgba(99, 102, 241, 0.25)',
                borderColor: '#6366f1',
                borderWidth: 2,
                pointBackgroundColor: E21CC_DIMS.map(d => d.color),
                pointBorderColor: '#fff',
                pointBorderWidth: 1,
                pointRadius: 5,
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              scales: {
                r: {
                  beginAtZero: true,
                  min: 0,
                  max: 4,
                  ticks: {
                    stepSize: 1,
                    font: { size: 10 },
                    callback: (val) => ['', 'Dev', 'App', 'Ext', 'Lead'][val] || '',
                    backdropColor: 'transparent',
                  },
                  grid: {
                    color: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  },
                  angleLines: {
                    color: document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  },
                  pointLabels: { font: { size: 11, weight: '600' }, color: document.documentElement.classList.contains('dark') ? '#e2e8f0' : '#374151' }
                }
              },
              plugins: { legend: { display: false } }
            }
          });
        }

        // Wire student dropdown change
        const radarSelect = container.querySelector('#radar-student-select');
        if (radarSelect) {
          radarSelect.addEventListener('change', buildStudentRadar);
        }

        barViewBtn.addEventListener('click', () => {
          barViewBtn.classList.remove('btn-ghost');
          barViewBtn.style.fontWeight = '600';
          radarViewBtn.classList.add('btn-ghost');
          radarViewBtn.style.fontWeight = '';
          if (tableWrap) tableWrap.style.display = '';
          if (radarContainer) radarContainer.style.display = 'none';
          if (radarChart) { radarChart.destroy(); radarChart = null; }
        });
      }
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

    // Trends tab handlers
    if (activeTab === 'trends') {
      attachSparklineTips(container);

      container.querySelector('#print-trends-btn')?.addEventListener('click', () => {
        const fc = Store.getClass(id);
        if (!fc) return;
        const sts = fc.students || [];
        const rows = sts.filter(s => s.e21ccHistory && s.e21ccHistory.length >= 2).map(s => {
          const h = s.e21ccHistory, latest = h[h.length - 1], first = h[0];
          return `<tr>
            <td>${escapeHtml(s.name)}</td>
            ${E21CC_DIMS.map(d => {
              const latestVal = typeof latest[d.key] === 'string' ? latest[d.key] : 'developing';
              const firstVal = typeof first[d.key] === 'string' ? first[d.key] : 'developing';
              const latestMeta = levelMeta(latestVal);
              const firstMeta = levelMeta(firstVal);
              const diff = latestMeta.value - firstMeta.value;
              return `<td>${latestMeta.short} (${diff >= 0 ? '+' : ''}${diff})</td>`;
            }).join('')}
            <td>${h.length}</td>
          </tr>`;
        }).join('');
        const pw = window.open('', '_blank');
        pw.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(fc.name)} — E21CC Trends</title>
          <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.7;font-size:14px}
          h1{font-size:18px;border-bottom:2px solid #000c53;padding-bottom:8px;color:#000c53}
          table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
          @media print{body{margin:0;padding:16px}}</style></head>
          <body>
            <h1>${escapeHtml(fc.name)} — E21CC Trends Report</h1>
            <p style="font-size:12px;color:#64748b;">${fc.level || ''} ${fc.subject || ''} &middot; ${sts.length} students &middot; ${new Date().toLocaleDateString('en-SG')}</p>
            <table><thead><tr><th>Student</th>${E21CC_DIMS.map(d => `<th>${d.short}</th>`).join('')}<th>Updates</th></tr></thead><tbody>${rows || `<tr><td colspan="${E21CC_DIMS.length + 2}">No trend data</td></tr>`}</tbody></table>
            <p style="color:#94a3b8;font-size:11px;margin-top:32px;">Exported from Co-Cher</p>
          </body></html>`);
        pw.document.close();
        pw.print();
      });
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
            ${E21CC_DIMS.map(d => `<th>${d.short}</th>`).join('')}
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
              ${E21CC_DIMS.map(d => {
                const meta = levelMeta(s.e21cc?.[d.key] || 'developing');
                return `
              <td>
                <span style="padding:2px 6px;border-radius:4px;font-size:0.6875rem;font-weight:600;background:${meta.color}15;color:${meta.color};">${meta.short}</span>
              </td>`;
              }).join('')}
              <td style="text-align: right;">
                <button class="btn btn-ghost btn-sm e21cc-edit-btn" data-student-id="${s.id}" style="font-size: 0.75rem;">Edit E21CC</button>
                <button class="btn btn-ghost btn-sm remove-student-btn" data-student-id="${s.id}" style="color: var(--danger); font-size: 0.75rem;">Remove</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top:var(--sp-4);display:flex;align-items:center;gap:var(--sp-3);">
      <span style="font-size:0.8125rem;font-weight:500;color:var(--ink-muted);">View:</span>
      <button class="btn btn-sm" id="bar-view-btn" style="font-weight:600;">Bar view</button>
      <button class="btn btn-ghost btn-sm" id="radar-view-btn">Radar view</button>
    </div>
    <div id="radar-chart-container" style="display:none;margin-top:var(--sp-4);">
      <div style="margin-bottom:var(--sp-3);">
        <select class="input" id="radar-student-select" style="max-width:280px;">
          ${students.map((s, i) => `<option value="${i}">${escapeHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div style="max-width:400px;margin:0 auto;">
        <canvas id="e21cc-radar-canvas" width="400" height="400"></canvas>
      </div>
      <div style="display:flex;justify-content:center;gap:16px;margin-top:12px;font-size:0.75rem;">
        <span style="display:flex;align-items:center;gap:4px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span> Developing (1)
        </span>
        <span style="display:flex;align-items:center;gap:4px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;"></span> Applying (2)
        </span>
        <span style="display:flex;align-items:center;gap:4px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span> Extending (3)
        </span>
        <span style="display:flex;align-items:center;gap:4px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#8b5cf6;"></span> Leading (4)
        </span>
      </div>
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
let _sparkId = 0;
function renderSparkline(history, key, color, width = 100, height = 28) {
  if (!history || history.length < 2) return `<span style="font-size:0.6875rem;color:var(--ink-faint);">Not enough data</span>`;
  const vals = history.map(h => {
    const raw = h[key];
    return typeof raw === 'string' ? levelToValue(raw) : (raw || 1);
  });
  const timestamps = history.map(h => h.ts);
  const min = 1, max = 4;
  const range = max - min || 1;
  const step = width / (vals.length - 1);
  const points = vals.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  const last = vals[vals.length - 1];
  const first = vals[0];
  const diff = last - first;
  const arrow = diff > 0 ? '\u25B2' : diff < 0 ? '\u25BC' : '\u2500';
  const diffColor = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--ink-faint)';
  const sid = `spark-${++_sparkId}`;

  // Invisible circles for hover tooltips
  const hoverCircles = vals.map((v, i) => {
    const cx = i * step;
    const cy = height - ((v - min) / range) * (height - 4) - 2;
    const date = new Date(timestamps[i]).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
    const dimInfo = E21CC_DIMS.find(d => d.key === key);
    const tipLabel = dimInfo ? dimInfo.short : key;
    const lvLabel = (E21CC_LEVELS.find(l => l.value === v) || E21CC_LEVELS[0]).short;
    return `<circle cx="${cx}" cy="${cy}" r="6" fill="transparent" stroke="none" data-tip="${tipLabel}: ${lvLabel} (${date})"/>
            <circle cx="${cx}" cy="${cy}" r="2" fill="${color}" opacity="0" class="hover-dot"/>`;
  }).join('');

  const lastMeta = E21CC_LEVELS.find(l => l.value === last) || E21CC_LEVELS[0];
  return `
    <div style="display:flex;align-items:center;gap:var(--sp-2);position:relative;" id="${sid}">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;overflow:visible;">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${(vals.length - 1) * step}" cy="${height - ((last - min) / range) * (height - 4) - 2}" r="2.5" fill="${color}"/>
        ${hoverCircles}
      </svg>
      <span style="font-size:0.6875rem;font-weight:600;color:${diffColor};">${arrow}${Math.abs(diff)}</span>
      <div class="spark-tip" style="display:none;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;font-size:0.6875rem;padding:2px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;z-index:10;"></div>
    </div>`;
}

function attachSparklineTips(container) {
  container.querySelectorAll('[id^="spark-"]').forEach(wrapper => {
    const tip = wrapper.querySelector('.spark-tip');
    if (!tip) return;
    wrapper.querySelectorAll('[data-tip]').forEach(circle => {
      circle.addEventListener('mouseenter', () => {
        tip.textContent = circle.dataset.tip;
        tip.style.display = 'block';
        const dots = wrapper.querySelectorAll('.hover-dot');
        dots.forEach(d => d.setAttribute('opacity', '0'));
        const idx = [...wrapper.querySelectorAll('[data-tip]')].indexOf(circle);
        if (dots[idx]) dots[idx].setAttribute('opacity', '1');
      });
      circle.addEventListener('mouseleave', () => {
        tip.style.display = 'none';
        wrapper.querySelectorAll('.hover-dot').forEach(d => d.setAttribute('opacity', '0'));
      });
    });
  });
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

  // Class-level averages over time (using numeric values 1-4 for sparkline)
  const allTimestamps = [...new Set(withHistory.flatMap(s => s.e21ccHistory.map(h => h.ts)))].sort();
  const classHistory = allTimestamps.map(ts => {
    const sums = {};
    E21CC_DIMS.forEach(d => { sums[d.key] = 0; });
    let count = 0;
    students.forEach(s => {
      const snapshot = (s.e21ccHistory || []).filter(h => h.ts <= ts);
      if (snapshot.length > 0) {
        const latest = snapshot[snapshot.length - 1];
        E21CC_DIMS.forEach(d => {
          const raw = latest[d.key];
          sums[d.key] += typeof raw === 'string' ? levelToValue(raw) : (raw || 1);
        });
        count++;
      }
    });
    const entry = { ts };
    E21CC_DIMS.forEach(d => { entry[d.key] = count ? Math.round(sums[d.key] / count) : 1; });
    return entry;
  });

  return `
    <div style="display:flex;justify-content:flex-end;margin-bottom:var(--sp-4);">
      <button class="btn btn-ghost btn-sm" id="print-trends-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Print Trends Report
      </button>
    </div>
    <!-- Class Average Trends -->
    <div class="card" style="margin-bottom:var(--sp-6);">
      <h4 style="font-size:0.9375rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);">Class Average Trends</h4>
      <div style="display:flex;gap:var(--sp-6);flex-wrap:wrap;">
        ${E21CC_DIMS.map(d => `
        <div>
          <span style="font-size:0.75rem;font-weight:600;color:${d.color};">${d.short}</span>
          ${renderSparkline(classHistory, d.key, d.color, 120, 32)}
        </div>
        `).join('')}
      </div>
    </div>

    <!-- Individual Student Trends -->
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Student</th>
            ${E21CC_DIMS.map(d => `<th>${d.short} Trend</th>`).join('')}
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
              ${E21CC_DIMS.map(d => `<td>${renderSparkline(s.e21ccHistory, d.key, d.color, 80, 24)}</td>`).join('')}
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
  const currentLevels = student.e21cc || {};
  const { backdrop, close } = openModal({
    title: `E21CC — ${student.name}`,
    width: 520,
    body: `
      <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-2); line-height: 1.5;">
        Set competency levels based on your observations and assessments.
      </p>
      ${E21CC_DIMS.map(d => `
      <div class="input-group">
        <label class="input-label" style="color: ${d.color};">${d.label}</label>
        <div style="display:flex;gap:var(--sp-2);">
          ${E21CC_LEVELS.map(lv => {
            const checked = (currentLevels[d.key] || 'developing') === lv.key;
            return `<label style="flex:1;display:flex;align-items:center;justify-content:center;padding:6px 4px;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;border:2px solid ${checked ? lv.color : 'var(--border)'};background:${checked ? lv.color + '15' : 'transparent'};color:${checked ? lv.color : 'var(--ink-muted)'};transition:all 0.15s;">
              <input type="radio" name="e21cc-${d.key}" value="${lv.key}" ${checked ? 'checked' : ''} style="display:none;" />
              ${lv.short}
            </label>`;
          }).join('')}
        </div>
      </div>
      `).join('')}
      <div class="input-group" style="margin-top:var(--sp-4);">
        <label class="input-label">Observation Note (optional)</label>
        <textarea class="input" id="e21cc-observation" rows="3" placeholder="Brief note about this student's competency development..." style="resize:vertical;"></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save</button>
    `
  });

  // Style radio pills on change
  backdrop.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const group = backdrop.querySelectorAll(`input[name="${radio.name}"]`);
      group.forEach(r => {
        const label = r.closest('label');
        const lv = E21CC_LEVELS.find(l => l.key === r.value);
        if (r.checked) {
          label.style.borderColor = lv.color;
          label.style.background = lv.color + '15';
          label.style.color = lv.color;
        } else {
          label.style.borderColor = 'var(--border)';
          label.style.background = 'transparent';
          label.style.color = 'var(--ink-muted)';
        }
      });
    });
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const e21cc = {};
    E21CC_DIMS.forEach(d => {
      const checked = backdrop.querySelector(`input[name="e21cc-${d.key}"]:checked`);
      e21cc[d.key] = checked ? checked.value : (currentLevels[d.key] || 'developing');
    });
    // Build observation if note provided
    const noteText = backdrop.querySelector('#e21cc-observation').value.trim();
    const updateData = { e21cc };
    if (noteText) {
      const changedDims = E21CC_DIMS.filter(d => e21cc[d.key] !== (currentLevels[d.key] || 'developing')).map(d => d.key);
      updateData.observations = [{
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text: noteText,
        tags: changedDims.length > 0 ? changedDims : E21CC_DIMS.map(d => d.key),
        ts: Date.now()
      }];
    }
    Store.updateStudent(classId, student.id, updateData);
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
        Set a level for each dimension to apply to all students. Choose "(No change)" to skip a dimension.
      </p>
      <div class="input-group">
        <label class="input-label">Activity / Reason</label>
        <input class="input" id="batch-reason" placeholder="e.g. Group project on climate change" />
      </div>
      ${E21CC_DIMS.map(d => `
      <div class="input-group">
        <label class="input-label" style="color:${d.color};">${d.label}</label>
        <select class="input" id="batch-${d.key}">
          <option value="">(No change)</option>
          ${E21CC_LEVELS.map(lv => `<option value="${lv.key}">${lv.label}</option>`).join('')}
        </select>
      </div>
      `).join('')}
      <div style="background:var(--bg-subtle);padding:var(--sp-3) var(--sp-4);border-radius:var(--radius-md);font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">
        This will update <strong>${cls.students.length} students</strong> for any dimensions where a level is selected.
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="apply">Apply to All Students</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="apply"]').addEventListener('click', () => {
    const newLevels = {};
    E21CC_DIMS.forEach(d => {
      const val = backdrop.querySelector(`#batch-${d.key}`).value;
      if (val) newLevels[d.key] = val;
    });

    if (Object.keys(newLevels).length === 0) {
      showToast('No changes to apply.', 'danger');
      return;
    }

    const freshCls = Store.getClass(classId);
    const now = Date.now();
    const updatedStudents = (freshCls.students || []).map(s => {
      const newE21cc = { ...(s.e21cc || {}) };
      E21CC_DIMS.forEach(d => {
        if (newLevels[d.key]) newE21cc[d.key] = newLevels[d.key];
        else if (!newE21cc[d.key]) newE21cc[d.key] = 'developing';
      });
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

/* ── Student Grouping ── */
function showGroupingModal(classId) {
  const cls = Store.getClass(classId);
  if (!cls || !cls.students?.length) return;

  const { backdrop, close } = openModal({
    title: `Student Groups — ${cls.name}`,
    width: 560,
    body: `
      <div class="input-group">
        <label class="input-label">Group Size</label>
        <select class="input" id="group-size">
          <option value="2">Pairs (2)</option>
          <option value="3">Trios (3)</option>
          <option value="4" selected>Groups of 4</option>
          <option value="5">Groups of 5</option>
          <option value="6">Groups of 6</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Method</label>
        <select class="input" id="group-method">
          <option value="random">Random</option>
          <option value="mixed">Mixed Ability (by E21CC)</option>
          <option value="similar">Similar Ability</option>
          <option value="ai">AI Suggested</option>
        </select>
      </div>
      <div class="input-group" id="group-activity-row" style="display:none;">
        <label class="input-label">Activity Type (for AI)</label>
        <input class="input" id="group-activity" placeholder="e.g. debate, lab experiment, group project" />
      </div>
      <div id="group-result" style="margin-top:var(--sp-4);"></div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Close</button>
      <button class="btn btn-primary" data-action="generate">Generate Groups</button>
    `
  });

  const methodSelect = backdrop.querySelector('#group-method');
  const activityRow = backdrop.querySelector('#group-activity-row');
  methodSelect.addEventListener('change', () => {
    activityRow.style.display = methodSelect.value === 'ai' ? 'block' : 'none';
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
    const size = parseInt(backdrop.querySelector('#group-size').value);
    const method = methodSelect.value;
    const resultEl = backdrop.querySelector('#group-result');
    const students = [...cls.students];

    if (method === 'ai') {
      const activity = backdrop.querySelector('#group-activity').value.trim() || 'group activity';
      if (!Store.get('apiKey')) { showToast('API key needed for AI grouping.', 'danger'); return; }
      resultEl.innerHTML = '<p style="font-size:0.8125rem;color:var(--ink-muted);">AI is thinking...</p>';
      try {
        const result = await suggestGrouping(students, activity, { groupSize: size });
        resultEl.innerHTML = `<div style="font-size:0.8125rem;line-height:1.6;color:var(--ink-secondary);white-space:pre-wrap;">${escapeHtml(result)}</div>`;
      } catch (err) {
        resultEl.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">${escapeHtml(err.message)}</p>`;
      }
      return;
    }

    // Local grouping
    let sorted;
    if (method === 'mixed') {
      sorted = students.sort((a, b) => {
        const sa = E21CC_DIMS.reduce((sum, d) => sum + levelToValue(a.e21cc?.[d.key] || 'developing'), 0);
        const sb = E21CC_DIMS.reduce((sum, d) => sum + levelToValue(b.e21cc?.[d.key] || 'developing'), 0);
        return sb - sa;
      });
    } else if (method === 'similar') {
      sorted = students.sort((a, b) => {
        const sa = E21CC_DIMS.reduce((sum, d) => sum + levelToValue(a.e21cc?.[d.key] || 'developing'), 0);
        const sb = E21CC_DIMS.reduce((sum, d) => sum + levelToValue(b.e21cc?.[d.key] || 'developing'), 0);
        return sb - sa;
      });
    } else {
      sorted = students.sort(() => Math.random() - 0.5);
    }

    const groups = [];
    if (method === 'mixed') {
      // Zigzag distribution for mixed ability
      const numGroups = Math.ceil(sorted.length / size);
      for (let i = 0; i < numGroups; i++) groups.push([]);
      sorted.forEach((s, i) => groups[i % numGroups].push(s));
    } else {
      for (let i = 0; i < sorted.length; i += size) {
        groups.push(sorted.slice(i, i + size));
      }
    }

    resultEl.innerHTML = groups.map((g, i) => `
      <div style="margin-bottom:var(--sp-3);padding:var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-md);">
        <div style="font-weight:600;font-size:0.8125rem;color:var(--ink);margin-bottom:var(--sp-1);">Group ${i + 1}</div>
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
          ${g.map(s => `<span class="badge badge-blue" style="font-size:0.75rem;">${escapeHtml(s.name)}</span>`).join('')}
        </div>
      </div>
    `).join('');
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

/* ═══════════ Parent Digest Generator ═══════════ */

async function showParentDigestModal(cls) {
  const lessons = Store.getLessonsForClass(cls.id);
  const notes = cls.notes || [];

  // Gather recent lesson summaries (last 7 days or last 5 lessons, whichever is more)
  const recent = lessons
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
    .slice(0, 5);

  const recentNotes = notes
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 3);

  const { backdrop, close } = openModal({
    title: 'Parent Digest Generator',
    size: 'lg',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.6;">
        Generate a parent-friendly weekly summary of what <strong>${escapeHtml(cls.name)}</strong> has been learning.
        The digest pulls from recent lessons${recentNotes.length > 0 ? ' and class notes' : ''}.
      </p>
      <div style="display:flex;gap:var(--sp-3);margin-bottom:var(--sp-3);">
        <div class="input-group" style="flex:1;">
          <label class="input-label">Format</label>
          <select class="input" id="digest-format">
            <option value="whatsapp">WhatsApp / Plain Text</option>
            <option value="email">Email / HTML</option>
            <option value="pg">Parents Gateway</option>
          </select>
        </div>
        <div class="input-group" style="flex:1;">
          <label class="input-label">Tone</label>
          <select class="input" id="digest-tone">
            <option value="warm">Warm &amp; Encouraging</option>
            <option value="formal">Formal</option>
            <option value="bilingual">Bilingual (EN + Malay)</option>
          </select>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Additional notes (optional)</label>
        <textarea class="input" id="digest-notes" rows="2" placeholder="e.g. Reminder about upcoming test, field trip next week..." style="resize:vertical;"></textarea>
      </div>
      <div id="digest-output" style="display:none;margin-top:var(--sp-3);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-2);">
          <label class="input-label" style="margin:0;">Generated Digest</label>
          <button class="btn btn-ghost btn-sm" id="copy-digest-btn" style="font-size:0.75rem;">Copy</button>
        </div>
        <div id="digest-content" style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:8px;padding:var(--sp-3);font-size:0.8125rem;color:var(--ink);line-height:1.7;max-height:300px;overflow-y:auto;"></div>
      </div>
      ${recent.length === 0 ? `
        <div style="margin-top:var(--sp-3);padding:var(--sp-3);background:var(--warning-light);border-radius:8px;font-size:0.8125rem;color:var(--ink);">
          No recent lessons found for this class. The digest will be generic. Add lessons via the Lesson Planner first for richer summaries.
        </div>
      ` : ''}
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Close</button>
      <button class="btn btn-primary" data-action="generate" id="generate-digest-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        Generate Digest
      </button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);

  backdrop.querySelector('#generate-digest-btn').addEventListener('click', async () => {
    const btn = backdrop.querySelector('#generate-digest-btn');
    const format = backdrop.querySelector('#digest-format').value;
    const tone = backdrop.querySelector('#digest-tone').value;
    const extra = backdrop.querySelector('#digest-notes').value.trim();
    const outputEl = backdrop.querySelector('#digest-output');
    const contentEl = backdrop.querySelector('#digest-content');

    btn.disabled = true;
    btn.textContent = 'Generating...';

    // Build lesson context
    const lessonContext = recent.map(l =>
      `- "${l.title || 'Untitled'}" (${l.subject || cls.subject || 'General'}): ${l.learningIntentions || l.description || 'No description'}`
    ).join('\n');

    const noteContext = recentNotes.map(n =>
      `- ${n.text || ''}`
    ).join('\n');

    const toneMap = {
      warm: 'Warm, encouraging, and positive. Use phrases like "Your child has been..." and highlight effort and growth.',
      formal: 'Professional and formal. Use clear, structured language suitable for official school communication.',
      bilingual: 'Bilingual — write the digest in English first, then provide a Malay translation below. Use natural, conversational Malay (not overly formal).'
    };

    const formatMap = {
      whatsapp: 'Plain text suitable for WhatsApp or SMS. Use line breaks, emojis sparingly, and keep it under 300 words. No HTML.',
      email: 'Structured HTML email format with a greeting, sections (What We Learned, Looking Ahead, How to Help at Home), and a sign-off. Keep it professional but warm.',
      pg: 'Parents Gateway format — concise, 150 words max, no HTML, no emojis. Official MOE tone.'
    };

    try {
      const messages = [{
        role: 'user',
        content: `Generate a weekly parent digest for class ${cls.name} (${cls.level || ''} ${cls.subject || ''}).

RECENT LESSONS:
${lessonContext || 'No lessons recorded this week.'}

${noteContext ? `CLASS NOTES:\n${noteContext}\n` : ''}
${extra ? `TEACHER'S ADDITIONAL NOTES:\n${extra}\n` : ''}
STUDENT COUNT: ${(cls.students || []).length}

FORMAT: ${formatMap[format]}
TONE: ${toneMap[tone]}

Structure the digest to include:
1. A warm greeting to parents
2. Summary of what was covered this week (key topics, skills practised)
3. Positive highlights or class achievements
4. Looking ahead — what's coming next week
5. How parents can support at home (1-2 suggestions)
6. Sign-off from the teacher

Keep it concise, parent-friendly, and avoid jargon. This is a Singapore school context.`
      }];

      const response = await sendChat(messages, {
        systemPrompt: 'You are a Singapore school teacher writing a weekly update for parents. Be warm, informative, and concise. Parents are busy — respect their time. Use Singapore English where appropriate.',
        maxTokens: 1500
      });

      outputEl.style.display = 'block';
      if (format === 'email') {
        contentEl.innerHTML = renderMd(response);
      } else {
        contentEl.textContent = response;
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'danger');
    }

    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Regenerate`;
  });

  // Copy button
  backdrop.querySelector('#copy-digest-btn')?.addEventListener('click', () => {
    const contentEl = backdrop.querySelector('#digest-content');
    const text = contentEl.textContent || contentEl.innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Digest copied to clipboard!', 'success');
    }).catch(() => {
      // Fallback
      const range = document.createRange();
      range.selectNodeContents(contentEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('copy');
      showToast('Digest copied!', 'success');
    });
  });
}
