/*
 * Co-Cher Classes
 * ===============
 * Classes list + class detail with students and notes.
 */

import { Store, generateId } from '../state.js';
import { navigate } from '../router.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { showToast } from '../components/toast.js';
import { summarizeNotes, suggestGrouping, sendChat } from '../api.js';
import { renderMd } from '../utils/latex.js';
import { escapeHtml } from '../utils/markdown.js';
import { createStudentUploadZone } from '../components/student-upload.js';
import {
  SCHEMA_PRESETS, getSchemaForClass, getFieldValue, applyFieldUpdate,
  levelMeta as fieldLevelMeta
} from '../utils/tracking.js';

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

/* ═══════════ Schema-aware display helpers ═══════════
 * The tracking-schema registry (utils/tracking.js) centralises field labels,
 * level keys and colours, but its E21CC preset intentionally omits the decorative
 * short-codes (CT, Dev…) and per-dimension header colours that this view has
 * always shown. These helpers re-attach that presentation for E21CC (so an
 * E21CC class renders byte-for-byte as before) and derive sensible equivalents
 * for every other schema. */

const FIELD_PALETTE = ['#6366f1', '#8b5cf6', '#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#14b8a6'];

/** The class's active tracking schema (unset ⇒ e21cc). */
function schemaFor(cls) { return getSchemaForClass(cls, Store.getTrackingSchemas()); }

/** Header accent colour for a field column. */
function dimColor(schema, field, idx = 0) {
  if (schema.id === 'e21cc') return E21CC_DIMS.find(d => d.key === field.key)?.color || FIELD_PALETTE[idx % FIELD_PALETTE.length];
  return FIELD_PALETTE[idx % FIELD_PALETTE.length];
}

/** Compact column label for a field (CT, CrT… for E21CC; derived otherwise). */
function dimShort(schema, field) {
  if (schema.id === 'e21cc') return E21CC_DIMS.find(d => d.key === field.key)?.short || field.label;
  const words = String(field.label).trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map(w => w[0]).slice(0, 3).join('').toUpperCase();
  return field.label.slice(0, 4);
}

/** Level metadata for a field value: { label, color, short, value }. */
function valueMeta(schema, field, value) {
  const m = fieldLevelMeta(field, value); // { label, color, value }
  let short;
  if (schema.id === 'e21cc') {
    short = E21CC_LEVELS.find(l => l.key === value)?.short || m.label;
  } else {
    const first = String(m.label).split(/[\s—–\-]+/).filter(Boolean)[0] || m.label;
    short = first.length > 5 ? first.slice(0, 4) : first;
  }
  return { ...m, short };
}

/** The history array for this schema (e21ccHistory for e21cc, else trackedHistory). */
function historyOf(student, schema) {
  return (schema.id === 'e21cc' ? student.e21ccHistory : student.trackedHistory) || [];
}

/** Numeric value of a stored (key or number) reading for a field. */
function valueToNum(field, raw) {
  const lv = (field.levels || []).find(l => l.key === raw);
  if (lv) return lv.value;
  return typeof raw === 'number' ? raw : (field.levels?.[0]?.value ?? 1);
}

/** Min/max numeric range for a field's levels (defaults 1–4). */
function fieldRange(field) {
  const vals = (field.levels || []).map(l => l.value).filter(v => typeof v === 'number');
  return { min: vals.length ? Math.min(...vals) : 1, max: vals.length ? Math.max(...vals) : 4 };
}

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
              const schema = schemaFor(cls);
              const dimModes = schema.fields.map((field, idx) => {
                const base = { field, idx, short: dimShort(schema, field), color: dimColor(schema, field, idx) };
                if (studentCount === 0) return { ...base, mode: null };
                const counts = {};
                cls.students.forEach(st => {
                  const lv = getFieldValue(st, schema, field);
                  counts[lv] = (counts[lv] || 0) + 1;
                });
                const mode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                return { ...base, mode };
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
                          const meta = valueMeta(schema, d.field, d.mode);
                          return `<div style="display:flex;align-items:center;gap:4px;">
                            <span style="font-size:0.6875rem;font-weight:600;color:${d.color};">${escapeHtml(d.short)}</span>
                            <span style="padding:2px 6px;border-radius:4px;font-size:0.6875rem;font-weight:600;background:${meta.color}15;color:${meta.color};">${escapeHtml(meta.short)}</span>
                          </div>`;
                        }).join('')}
                      </div>
                    ` : `
                      <p style="font-size: 0.8125rem; color: var(--ink-faint); font-style: italic;">Add students to see ${escapeHtml(schema.id === 'e21cc' ? 'E21CC' : schema.name)} overview</p>
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

  // Quick Capture state — survives re-renders within this detail view
  let qcOpen = false;
  let qcDim = null;
  let qcLevels = {}; // studentId -> tapped level (only levels the teacher touched)

  function renderInner() {
    const freshCls = Store.getClass(id);
    if (!freshCls) return;
    const students = freshCls.students || [];
    const notes = freshCls.notes || [];
    const schema = schemaFor(freshCls);
    const isE21cc = schema.id === 'e21cc';
    // A stored qcDim from a previous schema is no longer valid after a switch.
    if (qcDim && !schema.fields.some(f => f.key === qcDim)) { qcDim = null; qcLevels = {}; }

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
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-3);flex-wrap:wrap;">
              <span style="font-size:0.75rem;color:var(--ink-muted);">Tracking schema:</span>
              <span class="badge badge-blue" style="font-size:0.75rem;">${escapeHtml(isE21cc ? 'E21CC (default)' : schema.name)}</span>
              <button class="btn btn-ghost btn-sm" id="schema-picker-btn" style="font-size:0.75rem;">Change</button>
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

          <!-- Class Portrait -->
          ${renderPortraitCard(Store.getClassPortrait(id))}

          <!-- Quick Capture -->
          ${students.length > 0 ? renderQuickCaptureCard(students, schema, qcOpen, qcDim, qcLevels) : ''}

          <!-- Quick Actions for this class -->
          <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-6);flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="plan-from-class-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Plan a Lesson
            </button>
            ${students.length > 0 ? `
              <button class="btn btn-secondary btn-sm" id="batch-e21cc-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                ${isE21cc ? 'Batch Update E21CC' : 'Batch Update'}
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
            ${activeTab === 'students' ? renderStudentsTab(freshCls, schema) : activeTab === 'trends' ? renderTrendsTab(freshCls, schema) : renderNotesTab(freshCls)}
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

    // Class Portrait CTA — same handoff keys the lesson planner reads
    container.querySelector('#portrait-plan-btn')?.addEventListener('click', () => {
      sessionStorage.setItem('cocher_plan_class_id', freshCls.id);
      sessionStorage.setItem('cocher_plan_class_name', freshCls.name);
      sessionStorage.setItem('cocher_plan_class_subject', freshCls.subject || '');
      sessionStorage.setItem('cocher_plan_class_level', freshCls.level || '');
      navigate('/lesson-planner');
    });

    // Quick Capture
    container.querySelector('#qc-toggle')?.addEventListener('click', () => {
      qcOpen = !qcOpen;
      if (!qcOpen) { qcDim = null; qcLevels = {}; }
      renderInner();
    });

    container.querySelectorAll('.qc-dim-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        qcDim = chip.dataset.dim;
        qcLevels = {};
        renderInner();
      });
    });

    container.querySelectorAll('.qc-student-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!qcDim) return;
        const field = schema.fields.find(f => f.key === qcDim);
        if (!field || !field.levels?.length) return;
        const s = students.find(x => x.id === btn.dataset.studentId);
        if (!s) return;
        const saved = getFieldValue(s, schema, field);
        const current = qcLevels[s.id] || saved;
        const order = field.levels.map(l => l.key);
        const idx = order.indexOf(current);
        const next = order[(idx + 1) % order.length];
        qcLevels[s.id] = next;
        // Update the tapped button in place — no full re-render per tap
        const meta = valueMeta(schema, field, next);
        const changed = next !== saved;
        btn.style.borderColor = changed ? meta.color : 'var(--border)';
        btn.style.background = changed ? 'var(--marker-wash, #FFF9C9)' : 'transparent';
        const badge = btn.querySelector('.qc-level-badge');
        if (badge) {
          badge.textContent = meta.short;
          badge.style.background = meta.color + '15';
          badge.style.color = meta.color;
        }
      });
    });

    container.querySelector('#qc-save-btn')?.addEventListener('click', () => {
      if (!qcDim) return;
      const field = schema.fields.find(f => f.key === qcDim);
      if (!field) return;
      const fresh = Store.getClass(id);
      if (!fresh) return;
      let changedCount = 0;
      const updatedStudents = (fresh.students || []).map(s => {
        const next = qcLevels[s.id];
        const saved = getFieldValue(s, schema, field);
        if (!next || next === saved) return s;
        changedCount++;
        // applyFieldUpdate builds the correct {e21cc,e21ccHistory} or
        // {tracked,trackedHistory} patch, with the 20-capped history snapshot.
        const patch = applyFieldUpdate(s, schema, qcDim, next);
        // One observation per changed student per save
        const observations = [...(s.observations || []), {
          id: generateId(),
          text: `Quick capture: ${field.label} updated`,
          tags: [qcDim],
          ts: Date.now()
        }];
        return { ...s, ...patch, observations };
      });
      if (changedCount === 0) {
        showToast('No level changes to save.', 'danger');
        return;
      }
      Store.updateClass(id, { students: updatedStudents });
      showToast(`Quick capture saved — ${changedCount} student${changedCount !== 1 ? 's' : ''} updated`, 'success');
      qcDim = null;
      qcLevels = {};
      renderInner();
    });

    // Batch update (schema-aware)
    container.querySelector('#batch-e21cc-btn')?.addEventListener('click', () => {
      showBatchUpdateModal(id, renderInner);
    });

    // Tracking schema picker + custom schema builder
    container.querySelector('#schema-picker-btn')?.addEventListener('click', () => {
      showSchemaPickerModal(id, renderInner);
    });

    // Bulk student upload (CSV/XLSX)
    container.querySelector('#bulk-upload-btn')?.addEventListener('click', () => {
      showBulkUploadModal(id, renderInner);
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

      // Edit student tracking levels (schema-aware)
      container.querySelectorAll('.student-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const sid = btn.dataset.studentId;
          const student = students.find(s => s.id === sid);
          if (student) showEditStudentModal(id, student, schema, renderInner);
        });
      });

      // Free-text remark (B6) — writes a tagged observation
      container.querySelectorAll('.remark-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const sid = btn.dataset.studentId;
          const student = students.find(s => s.id === sid);
          if (student) showRemarkModal(id, student, renderInner);
        });
      });

      // Bulk upload from the empty-state (mirrors the toolbar button)
      container.querySelector('#bulk-upload-empty-btn')?.addEventListener('click', () => {
        showBulkUploadModal(id, renderInner);
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
        const fields = schema.fields;
        const title = isE21cc ? 'E21CC' : escapeHtml(schema.name);
        const rows = sts.filter(s => historyOf(s, schema).length >= 2).map(s => {
          const h = historyOf(s, schema), latest = h[h.length - 1], first = h[0];
          return `<tr>
            <td>${escapeHtml(s.name)}</td>
            ${fields.map(field => {
              const latestMeta = valueMeta(schema, field, latest[field.key]);
              const diff = valueToNum(field, latest[field.key]) - valueToNum(field, first[field.key]);
              return `<td>${escapeHtml(latestMeta.short)} (${diff >= 0 ? '+' : ''}${diff})</td>`;
            }).join('')}
            <td>${h.length}</td>
          </tr>`;
        }).join('');
        const pw = window.open('', '_blank');
        if (!pw) { showToast('Pop-up blocked — allow pop-ups for this site to print.', 'danger'); return; }
        pw.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(fc.name)} — ${title} Trends</title>
          <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.7;font-size:14px}
          h1{font-size:18px;border-bottom:2px solid #000c53;padding-bottom:8px;color:#000c53}
          table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
          @media print{body{margin:0;padding:16px}}</style></head>
          <body>
            <h1>${escapeHtml(fc.name)} — ${title} Trends Report</h1>
            <p style="font-size:12px;color:#64748b;">${escapeHtml(fc.level || '')} ${escapeHtml(fc.subject || '')} &middot; ${sts.length} students &middot; ${new Date().toLocaleDateString('en-SG')}</p>
            <table><thead><tr><th>Student</th>${fields.map(field => `<th>${escapeHtml(dimShort(schema, field))}</th>`).join('')}<th>Updates</th></tr></thead><tbody>${rows || `<tr><td colspan="${fields.length + 2}">No trend data</td></tr>`}</tbody></table>
            <p style="color:#94a3b8;font-size:11px;margin-top:32px;">Exported from Co-Cher</p>
          </body></html>`);
        pw.document.close();
        pw.print();
      });
    }
  }

  renderInner();
}

/* ── Class Portrait Card ── */
function renderPortraitCard(p) {
  if (!p) return '';
  const total = p.studentCount;
  const isE21cc = p.schemaId === 'e21cc';

  // Distribution bars + legend + weak/strong sentences differ per schema.
  // E21CC keeps its original computation byte-for-byte (regression-safe);
  // every other schema derives the same presentation from its own fields.
  let bars, legend, weakSentence, strongSentence;

  if (isE21cc) {
    const dimLabel = k => E21CC_DIMS.find(d => d.key === k)?.label || k;
    bars = total === 0 ? '' : E21CC_DIMS.map(d => {
      const counts = p.e21ccDistribution[d.key] || {};
      const segments = E21CC_LEVELS.map(lv => {
        const n = counts[lv.key] || 0;
        if (!n) return '';
        return `<div title="${lv.label}: ${n}" style="width:${(n / total) * 100}%;background:${lv.color};"></div>`;
      }).join('');
      return `
      <div style="display:flex;align-items:center;gap:var(--sp-2);">
        <span style="width:36px;flex-shrink:0;font-size:0.6875rem;font-weight:600;color:${d.color};" title="${d.label}">${d.short}</span>
        <div style="flex:1;display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--bg-subtle);">${segments}</div>
      </div>`;
    }).join('');
    legend = `
    <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-2);">
      ${E21CC_LEVELS.map(lv => `<span style="display:flex;align-items:center;gap:4px;font-size:0.6875rem;color:var(--ink-muted);"><span style="width:8px;height:8px;border-radius:2px;background:${lv.color};"></span>${lv.label}</span>`).join('')}
    </div>`;
    weakSentence = total > 0 && p.weakestDims.length
      ? `Most students are still developing in ${p.weakestDims.map(dimLabel).join(' and ')}.` : '';
    strongSentence = total > 0 && p.strongestDims.length
      ? `The class is furthest ahead in ${p.strongestDims.map(dimLabel).join(' and ')}.` : '';
  } else {
    const schema = p.schema;
    const fieldByKey = k => schema.fields.find(f => f.key === k);
    const fieldLabel = k => fieldByKey(k)?.label || k;
    // Union of level definitions for the legend (fields may share a level set).
    const legendLevels = [];
    const seen = new Set();
    schema.fields.forEach(f => (f.levels || []).forEach(lv => {
      if (!seen.has(lv.label)) { seen.add(lv.label); legendLevels.push(lv); }
    }));
    bars = total === 0 ? '' : schema.fields.map((field, idx) => {
      const counts = p.distribution[field.key] || {};
      const segments = (field.levels || []).map(lv => {
        const n = counts[lv.key] || 0;
        if (!n) return '';
        const m = fieldLevelMeta(field, lv.key);
        return `<div title="${escapeHtml(lv.label)}: ${n}" style="width:${(n / total) * 100}%;background:${m.color};"></div>`;
      }).join('');
      return `
      <div style="display:flex;align-items:center;gap:var(--sp-2);">
        <span style="width:36px;flex-shrink:0;font-size:0.6875rem;font-weight:600;color:${dimColor(schema, field, idx)};" title="${escapeHtml(field.label)}">${escapeHtml(dimShort(schema, field))}</span>
        <div style="flex:1;display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--bg-subtle);">${segments}</div>
      </div>`;
    }).join('');
    legend = `
    <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;margin-top:var(--sp-2);">
      ${legendLevels.map(lv => `<span style="display:flex;align-items:center;gap:4px;font-size:0.6875rem;color:var(--ink-muted);"><span style="width:8px;height:8px;border-radius:2px;background:${lv.color};"></span>${escapeHtml(lv.label)}</span>`).join('')}
    </div>`;
    weakSentence = total > 0 && p.weakestFields.length
      ? `The class is weakest in ${p.weakestFields.map(fieldLabel).join(' and ')}.` : '';
    strongSentence = total > 0 && p.strongestFields.length
      ? `The class is furthest ahead in ${p.strongestFields.map(fieldLabel).join(' and ')}.` : '';
  }

  const trendSentence = p.engagementTrend === 'rising' ? 'Engagement across recent lessons is rising.'
    : p.engagementTrend === 'dipping' ? 'Engagement across recent lessons is dipping — worth designing for re-engagement.'
    : p.engagementTrend === 'steady' ? 'Engagement across recent lessons is holding steady.'
    : 'Not enough lesson reflections yet to read an engagement trend.';

  return `
    <div class="card" style="margin-bottom:var(--sp-6);border-left:3px solid var(--marker, #FFE200);">
      <h3 style="font-family:var(--font-serif, Georgia, serif);font-size:1.125rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-1);">Class Portrait</h3>
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);">Who this class is right now — so every lesson starts from the learners.</p>
      ${total === 0 ? `
        <p style="font-size:0.8125rem;color:var(--ink-faint);font-style:italic;margin-bottom:var(--sp-4);">Add students to build this class's portrait.</p>
      ` : `
        <div style="display:flex;flex-direction:column;gap:6px;">${bars}</div>
        ${legend}
        <div style="font-family:var(--font-serif, Georgia, serif);font-size:0.875rem;line-height:1.7;margin:var(--sp-4) 0;">
          ${weakSentence ? `<p style="color:var(--redpen, #C94F4F);">${escapeHtml(weakSentence)}</p>` : ''}
          ${strongSentence ? `<p style="color:var(--ink-secondary);">${escapeHtml(strongSentence)}</p>` : ''}
          <p style="color:var(--ink-secondary);">${escapeHtml(trendSentence)}</p>
        </div>
      `}
      <button class="btn btn-primary" id="portrait-plan-btn">Design a lesson for this class &rarr;</button>
    </div>`;
}

/* ── Quick Capture Card ── */
function renderQuickCaptureCard(students, schema, open, dim, levels) {
  // Only level-based fields (scale/band/rag) can be tapped to cycle.
  const capturable = schema.fields.filter(f => (f.levels || []).length);
  const field = dim ? capturable.find(f => f.key === dim) : null;
  return `
    <div class="card" style="margin-bottom:var(--sp-6);">
      <button id="qc-toggle" style="display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;cursor:pointer;padding:0;text-align:left;">
        <span style="font-family:var(--font-serif, Georgia, serif);font-size:1rem;font-weight:600;color:var(--ink);">Quick Capture</span>
        <span style="font-size:0.75rem;color:var(--ink-muted);">${open ? 'Hide &#9652;' : 'Open &#9662;'}</span>
      </button>
      ${open ? `
        <div style="margin-top:var(--sp-4);">
          <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">Pick a ${schema.id === 'e21cc' ? 'dimension' : 'field'}, then tap a student to cycle their level. Only changed students are saved.</p>
          ${capturable.length === 0 ? `
            <p style="font-size:0.8125rem;color:var(--ink-faint);font-style:italic;">This schema has no level-based fields to capture.</p>
          ` : `
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-4);">
            ${capturable.map((f, idx) => {
              const color = dimColor(schema, f, schema.fields.indexOf(f));
              return `
              <button class="qc-dim-chip" data-dim="${escapeAttr(f.key)}" style="padding:4px 10px;border-radius:var(--radius-full, 999px);font-size:0.75rem;font-weight:600;cursor:pointer;border:2px solid ${dim === f.key ? color : 'var(--border)'};background:${dim === f.key ? color + '15' : 'transparent'};color:${dim === f.key ? color : 'var(--ink-muted)'};transition:all 0.15s;">${escapeHtml(f.label)}</button>`;
            }).join('')}
          </div>
          ${field ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--sp-2);margin-bottom:var(--sp-4);">
              ${students.map(s => {
                const saved = getFieldValue(s, schema, field);
                const current = levels[s.id] || saved;
                const meta = valueMeta(schema, field, current);
                const changed = current !== saved;
                return `
                <button class="qc-student-btn" data-student-id="${s.id}" title="Tap to cycle level" style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);padding:6px 10px;border-radius:var(--radius-md);border:1px solid ${changed ? meta.color : 'var(--border)'};background:${changed ? 'var(--marker-wash, #FFF9C9)' : 'transparent'};cursor:pointer;text-align:left;transition:all 0.15s;">
                  <span style="font-size:0.75rem;font-weight:500;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.name)}</span>
                  <span class="qc-level-badge" style="padding:2px 6px;border-radius:4px;font-size:0.6875rem;font-weight:600;background:${meta.color}15;color:${meta.color};flex-shrink:0;">${escapeHtml(meta.short)}</span>
                </button>`;
              }).join('')}
            </div>
            <div style="display:flex;justify-content:flex-end;">
              <button class="btn btn-primary btn-sm" id="qc-save-btn">Save Quick Capture</button>
            </div>
          ` : ''}
          `}
        </div>
      ` : ''}
    </div>`;
}

/* ── Student Tab ── */
function renderStudentsTab(cls, schema) {
  const students = cls.students || [];
  const isE21cc = schema.id === 'e21cc';
  if (students.length === 0) {
    return `
      <div class="empty-state" style="padding: var(--sp-8);">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <h3 class="empty-state-title">No students yet</h3>
        <p class="empty-state-text">Add students to track their progress, or upload a class list.</p>
        <div style="display:flex;gap:var(--sp-2);justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="add-student-btn">Add Student</button>
          <button class="btn btn-secondary btn-sm" id="bulk-upload-empty-btn">Upload students (CSV/XLSX)</button>
        </div>
      </div>`;
  }

  const radarBlock = isE21cc ? `
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
    </div>` : '';

  return `
    <div style="display: flex; justify-content: flex-end; gap: var(--sp-2); margin-bottom: var(--sp-4);">
      <button class="btn btn-secondary btn-sm" id="bulk-upload-btn" title="Upload a class list (CSV or Excel)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload CSV/XLSX
      </button>
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
            ${schema.fields.map(field => `<th title="${escapeAttr(field.label)}">${escapeHtml(dimShort(schema, field))}</th>`).join('')}
            <th style="width: 200px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: var(--sp-3);">
                  <div class="avatar avatar-sm" style="background: ${stringToColor(s.name)};">${initials(s.name)}</div>
                  <span style="font-weight: 500;">${escapeHtml(s.name)}</span>
                </div>
              </td>
              ${schema.fields.map(field => {
                if ((field.levels || []).length) {
                  const meta = valueMeta(schema, field, getFieldValue(s, schema, field));
                  return `
              <td>
                <span style="padding:2px 6px;border-radius:4px;font-size:0.6875rem;font-weight:600;background:${meta.color}15;color:${meta.color};">${escapeHtml(meta.short)}</span>
              </td>`;
                }
                const raw = getFieldValue(s, schema, field);
                return `<td><span style="font-size:0.75rem;color:var(--ink-secondary);">${escapeHtml(String(raw || '—'))}</span></td>`;
              }).join('')}
              <td style="text-align: right;">
                <button class="btn btn-ghost btn-sm student-edit-btn" data-student-id="${s.id}" style="font-size: 0.75rem;">${isE21cc ? 'Edit E21CC' : 'Edit'}</button>
                <button class="btn btn-ghost btn-sm remark-btn" data-student-id="${s.id}" style="font-size: 0.75rem;" title="Add a free-text remark">Remark</button>
                <button class="btn btn-ghost btn-sm remove-student-btn" data-student-id="${s.id}" style="color: var(--danger); font-size: 0.75rem;">Remove</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${radarBlock}`;
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
/**
 * Draw a sparkline for one field's numeric history. `schema`+`field` drive the
 * value range and the hover-tip labels; for E21CC this reproduces the original
 * 1–4 scale and Dev/App/Ext/Lead tip labels exactly.
 */
function renderSparkline(history, schema, field, color, width = 100, height = 28) {
  if (!history || history.length < 2) return `<span style="font-size:0.6875rem;color:var(--ink-faint);">Not enough data</span>`;
  const key = field.key;
  const vals = history.map(h => valueToNum(field, h[key]));
  const timestamps = history.map(h => h.ts);
  const { min, max } = fieldRange(field);
  const range = max - min || 1;
  const step = width / (vals.length - 1);
  const points = vals.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');
  const last = vals[vals.length - 1];
  const first = vals[0];
  const diff = last - first;
  const arrow = diff > 0 ? '\u25B2' : diff < 0 ? '\u25BC' : '\u2500';
  const diffColor = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--ink-faint)';
  const sid = `spark-${++_sparkId}`;
  const tipLabel = dimShort(schema, field);
  const shortForNum = (v) => {
    const lv = (field.levels || []).find(l => l.value === v);
    return lv ? valueMeta(schema, field, lv.key).short : String(v);
  };

  // Invisible circles for hover tooltips
  const hoverCircles = vals.map((v, i) => {
    const cx = i * step;
    const cy = height - ((v - min) / range) * (height - 4) - 2;
    const date = new Date(timestamps[i]).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
    const lvLabel = shortForNum(v);
    return `<circle cx="${cx}" cy="${cy}" r="6" fill="transparent" stroke="none" data-tip="${escapeAttr(tipLabel)}: ${escapeAttr(lvLabel)} (${date})"/>
            <circle cx="${cx}" cy="${cy}" r="2" fill="${color}" opacity="0" class="hover-dot"/>`;
  }).join('');

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

function renderTrendsTab(cls, schema) {
  const students = cls.students || [];
  const fields = schema.fields.filter(f => (f.levels || []).length);
  const withHistory = students.filter(s => historyOf(s, schema).length >= 2);
  const isE21cc = schema.id === 'e21cc';

  if (withHistory.length === 0 || fields.length === 0) {
    const noun = isE21cc ? 'E21CC' : escapeHtml(schema.name);
    return `
      <div class="empty-state" style="padding: var(--sp-8);">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <h3 class="empty-state-title">No trend data yet</h3>
        <p class="empty-state-text">${noun} trends will appear after you update student scores at least twice. Use "${isE21cc ? 'Edit E21CC' : 'Edit'}" or "Batch Update" to record changes over time.</p>
      </div>`;
  }

  // Class-level averages over time (numeric field values)
  const allTimestamps = [...new Set(withHistory.flatMap(s => historyOf(s, schema).map(h => h.ts)))].sort();
  const classHistory = allTimestamps.map(ts => {
    const sums = {};
    fields.forEach(f => { sums[f.key] = 0; });
    let count = 0;
    students.forEach(s => {
      const snapshot = historyOf(s, schema).filter(h => h.ts <= ts);
      if (snapshot.length > 0) {
        const latest = snapshot[snapshot.length - 1];
        fields.forEach(f => { sums[f.key] += valueToNum(f, latest[f.key]); });
        count++;
      }
    });
    const entry = { ts };
    fields.forEach(f => { entry[f.key] = count ? Math.round(sums[f.key] / count) : fieldRange(f).min; });
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
        ${fields.map((field, idx) => {
          const color = dimColor(schema, field, schema.fields.indexOf(field));
          return `
        <div>
          <span style="font-size:0.75rem;font-weight:600;color:${color};">${escapeHtml(dimShort(schema, field))}</span>
          ${renderSparkline(classHistory, schema, field, color, 120, 32)}
        </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Individual Student Trends -->
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Student</th>
            ${fields.map(field => `<th>${escapeHtml(dimShort(schema, field))} Trend</th>`).join('')}
            <th style="width:80px;text-align:right;">Updates</th>
          </tr>
        </thead>
        <tbody>
          ${withHistory.map(s => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:var(--sp-2);">
                  <div class="avatar avatar-sm" style="background:${stringToColor(s.name)};">${initials(s.name)}</div>
                  <span style="font-weight:500;">${escapeHtml(s.name)}</span>
                </div>
              </td>
              ${fields.map(field => {
                const color = dimColor(schema, field, schema.fields.indexOf(field));
                return `<td>${renderSparkline(historyOf(s, schema), schema, field, color, 80, 24)}</td>`;
              }).join('')}
              <td style="text-align:right;font-size:0.75rem;color:var(--ink-muted);">${historyOf(s, schema).length}</td>
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
        Tracking levels can be set after adding the student.
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

function showEditStudentModal(classId, student, schema, onUpdate) {
  const isE21cc = schema.id === 'e21cc';
  const fieldByKey = {};
  schema.fields.forEach(f => { fieldByKey[f.key] = f; });
  const curVal = (field) => getFieldValue(student, schema, field);

  const { backdrop, close } = openModal({
    title: `${isE21cc ? 'E21CC' : escapeHtml(schema.name)} — ${escapeHtml(student.name)}`,
    width: 520,
    body: `
      <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-2); line-height: 1.5;">
        Set levels based on your observations and assessments.
      </p>
      ${schema.fields.map((field, idx) => {
        const color = dimColor(schema, field, idx);
        if ((field.levels || []).length) {
          const current = curVal(field);
          return `
      <div class="input-group">
        <label class="input-label" style="color: ${color};">${escapeHtml(field.label)}</label>
        <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
          ${field.levels.map(lv => {
            const checked = current === lv.key;
            return `<label style="flex:1;min-width:60px;display:flex;align-items:center;justify-content:center;padding:6px 4px;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;border:2px solid ${checked ? lv.color : 'var(--border)'};background:${checked ? lv.color + '15' : 'transparent'};color:${checked ? lv.color : 'var(--ink-muted)'};transition:all 0.15s;">
              <input type="radio" name="field-${escapeAttr(field.key)}" value="${escapeAttr(lv.key)}" ${checked ? 'checked' : ''} style="display:none;" />
              ${escapeHtml(valueMeta(schema, field, lv.key).short)}
            </label>`;
          }).join('')}
        </div>
      </div>`;
        }
        // text / number field
        return `
      <div class="input-group">
        <label class="input-label" style="color: ${color};">${escapeHtml(field.label)}</label>
        <input class="input" type="${field.type === 'number' ? 'number' : 'text'}" data-field-key="${escapeAttr(field.key)}" value="${escapeAttr(String(curVal(field) || ''))}" />
      </div>`;
      }).join('')}
      <div class="input-group" style="margin-top:var(--sp-4);">
        <label class="input-label">Observation Note (optional)</label>
        <textarea class="input" id="student-observation" rows="3" placeholder="Brief note about this student's development..." style="resize:vertical;"></textarea>
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
      const fieldKey = radio.name.replace(/^field-/, '');
      const field = fieldByKey[fieldKey];
      const group = backdrop.querySelectorAll(`input[name="${radio.name}"]`);
      group.forEach(r => {
        const label = r.closest('label');
        const lv = (field?.levels || []).find(l => l.key === r.value);
        if (r.checked && lv) {
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
    const values = {};
    const changed = [];
    schema.fields.forEach(field => {
      const before = curVal(field);
      let next;
      if ((field.levels || []).length) {
        const checked = backdrop.querySelector(`input[name="field-${CSS.escape(field.key)}"]:checked`);
        next = checked ? checked.value : before;
      } else {
        const input = backdrop.querySelector(`[data-field-key="${CSS.escape(field.key)}"]`);
        next = input ? input.value.trim() : before;
      }
      values[field.key] = next;
      if (next !== before) changed.push(field.key);
    });

    // Build the patch. E21CC passes { e21cc } and lets Store.updateStudent
    // append the history snapshot (byte-identical to the original); other
    // schemas write { tracked, trackedHistory } with a 20-capped snapshot.
    let updateData;
    if (isE21cc) {
      updateData = { e21cc: values };
    } else {
      const history = [...(student.trackedHistory || [])];
      history.push({ ts: Date.now(), ...(student.tracked || {}), ...values });
      if (history.length > 20) history.splice(0, history.length - 20);
      updateData = { tracked: { ...(student.tracked || {}), ...values }, trackedHistory: history };
    }

    const noteText = backdrop.querySelector('#student-observation').value.trim();
    if (noteText) {
      updateData.observations = [{
        id: generateId(),
        text: noteText,
        tags: changed.length > 0 ? changed : schema.fields.map(f => f.key),
        ts: Date.now()
      }];
    }
    Store.updateStudent(classId, student.id, updateData);
    showToast(`${isE21cc ? 'E21CC' : schema.name} updated`, 'success');
    close();
    onUpdate();
  });
}

/* ── Batch Update (schema-aware) ── */
function showBatchUpdateModal(classId, onUpdate) {
  const cls = Store.getClass(classId);
  if (!cls || !cls.students?.length) return;
  const schema = schemaFor(cls);
  const isE21cc = schema.id === 'e21cc';
  const fields = schema.fields.filter(f => (f.levels || []).length);
  if (fields.length === 0) { showToast('This schema has no level-based fields to batch update.', 'danger'); return; }
  const noun = isE21cc ? 'dimension' : 'field';

  const { backdrop, close } = openModal({
    title: `${isE21cc ? 'Batch Update E21CC' : 'Batch Update'} — ${escapeHtml(cls.name)}`,
    width: 560,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Set a level for each ${noun} to apply to all students. Choose "(No change)" to skip a ${noun}.
      </p>
      <div class="input-group">
        <label class="input-label">Activity / Reason</label>
        <input class="input" id="batch-reason" placeholder="e.g. Group project on climate change" />
      </div>
      ${fields.map((field, idx) => `
      <div class="input-group">
        <label class="input-label" style="color:${dimColor(schema, field, idx)};">${escapeHtml(field.label)}</label>
        <select class="input" data-batch-field="${escapeAttr(field.key)}">
          <option value="">(No change)</option>
          ${field.levels.map(lv => `<option value="${escapeAttr(lv.key)}">${escapeHtml(lv.label)}</option>`).join('')}
        </select>
      </div>
      `).join('')}
      <div style="background:var(--bg-subtle);padding:var(--sp-3) var(--sp-4);border-radius:var(--radius-md);font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">
        This will update <strong>${cls.students.length} students</strong> for any ${noun}s where a level is selected.
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
    fields.forEach(field => {
      const val = backdrop.querySelector(`[data-batch-field="${CSS.escape(field.key)}"]`).value;
      if (val) newLevels[field.key] = val;
    });

    if (Object.keys(newLevels).length === 0) {
      showToast('No changes to apply.', 'danger');
      return;
    }

    const freshCls = Store.getClass(classId);
    if (!freshCls) { showToast('Class no longer exists.', 'danger'); close(); return; }
    const now = Date.now();
    const updatedStudents = (freshCls.students || []).map(s => {
      const store = isE21cc ? (s.e21cc || {}) : (s.tracked || {});
      const newMap = { ...store };
      fields.forEach(field => {
        if (newLevels[field.key]) newMap[field.key] = newLevels[field.key];
        else if (newMap[field.key] === undefined) newMap[field.key] = field.levels[0].key;
      });
      const histArr = isE21cc ? (s.e21ccHistory || []) : (s.trackedHistory || []);
      const history = [...histArr];
      history.push({ ts: now, ...newMap });
      if (history.length > 20) history.splice(0, history.length - 20);
      return isE21cc
        ? { ...s, e21cc: newMap, e21ccHistory: history }
        : { ...s, tracked: newMap, trackedHistory: history };
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
          <option value="mixed">Mixed Ability</option>
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

    // Local grouping — rank by total across the class's tracking schema
    const groupSchema = schemaFor(cls);
    const abilityScore = (st) => groupSchema.fields
      .filter(f => (f.levels || []).length)
      .reduce((sum, f) => sum + valueToNum(f, getFieldValue(st, groupSchema, f)), 0);
    let sorted;
    if (method === 'mixed') {
      sorted = students.sort((a, b) => abilityScore(b) - abilityScore(a));
    } else if (method === 'similar') {
      sorted = students.sort((a, b) => {
        const sa = abilityScore(a);
        const sb = abilityScore(b);
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

/* ═══════════ Tracking Schema (B5-UI) ═══════════ */

/** Pick the class's tracking schema (preset or custom) or launch the builder. */
function showSchemaPickerModal(classId, onUpdate) {
  const cls = Store.getClass(classId);
  if (!cls) return;
  const current = cls.trackingSchemaId || 'e21cc';
  const custom = Store.getTrackingSchemas();
  const presetOrder = ['e21cc', 'rag', 'mastery', 'participation'];
  const options = presetOrder
    .map(pid => ({ id: pid, name: SCHEMA_PRESETS[pid].name, fields: SCHEMA_PRESETS[pid].fields, custom: false }))
    .concat(custom.map(s => ({ id: s.id, name: s.name, fields: s.fields || [], custom: true })));

  const { backdrop, close } = openModal({
    title: `Tracking schema — ${escapeHtml(cls.name)}`,
    width: 560,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Choose how this class's progress is tracked. Switching schemas never deletes data — existing E21CC readings are preserved even while another schema is active.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
        ${options.map(o => {
          const checked = o.id === current;
          const summary = (o.fields || []).map(f => f.label).join(', ');
          return `
          <label style="display:flex;gap:var(--sp-3);align-items:flex-start;padding:var(--sp-3);border-radius:var(--radius-md);cursor:pointer;border:2px solid ${checked ? 'var(--accent)' : 'var(--border)'};background:${checked ? 'var(--accent-light, rgba(67,97,238,0.08))' : 'transparent'};">
            <input type="radio" name="schema-pick" value="${escapeAttr(o.id)}" ${checked ? 'checked' : ''} style="margin-top:3px;" />
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.875rem;font-weight:600;color:var(--ink);">${escapeHtml(o.name)}${o.id === 'e21cc' ? ' <span style="font-size:0.6875rem;font-weight:500;color:var(--ink-muted);">(default)</span>' : ''}${o.custom ? ' <span class="badge badge-gray" style="font-size:0.625rem;">custom</span>' : ''}</div>
              <div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;">${escapeHtml(summary) || 'No fields'}</div>
            </div>
          </label>`;
        }).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" id="create-custom-schema-btn" style="margin-top:var(--sp-3);">+ Create custom schema</button>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Use this schema</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('#create-custom-schema-btn').addEventListener('click', () => {
    close();
    showCustomSchemaBuilder(classId, onUpdate);
  });
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const picked = backdrop.querySelector('input[name="schema-pick"]:checked');
    if (!picked) return;
    Store.updateClass(classId, { trackingSchemaId: picked.value });
    const name = options.find(o => o.id === picked.value)?.name || picked.value;
    showToast(`Tracking schema set to ${name}`, 'success');
    close();
    onUpdate();
  });
}

/** Lightweight builder for a custom tracking schema (name + fields + levels). */
function showCustomSchemaBuilder(classId, onUpdate) {
  const DEFAULT_LEVEL_COLORS = ['#C94F4F', '#E8A33D', '#3b82f6', '#2c7a4b', '#8b5cf6'];
  const slugify = (str, fallback) => {
    const s = String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return s || fallback;
  };
  // In-memory model — the fields area is re-rendered from this on structural changes.
  let fields = [{
    label: '',
    type: 'scale',
    levels: [
      { label: 'Emerging', color: '#C94F4F' },
      { label: 'Developing', color: '#E8A33D' },
      { label: 'Secure', color: '#2c7a4b' }
    ]
  }];

  const { backdrop, close } = openModal({
    title: 'Create custom schema',
    width: 620,
    body: `
      <div class="input-group">
        <label class="input-label">Schema name</label>
        <input class="input" id="cs-name" placeholder="e.g. Reading Fluency" autofocus />
      </div>
      <div id="cs-fields"></div>
      <button class="btn btn-ghost btn-sm" id="cs-add-field" style="margin-top:var(--sp-2);">+ Add field</button>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="create">Create &amp; use</button>
    `
  });

  const fieldsEl = backdrop.querySelector('#cs-fields');

  function syncFromDOM() {
    fieldsEl.querySelectorAll('[data-field-idx]').forEach(row => {
      const fi = parseInt(row.dataset.fieldIdx, 10);
      if (!fields[fi]) return;
      fields[fi].label = row.querySelector('.cs-field-label')?.value || '';
      fields[fi].type = row.querySelector('.cs-field-type')?.value || 'scale';
      row.querySelectorAll('[data-level-idx]').forEach(lrow => {
        const li = parseInt(lrow.dataset.levelIdx, 10);
        if (!fields[fi].levels[li]) return;
        fields[fi].levels[li].label = lrow.querySelector('.cs-level-label')?.value || '';
        fields[fi].levels[li].color = lrow.querySelector('.cs-level-color')?.value || '#3b82f6';
      });
    });
  }

  function renderFields() {
    fieldsEl.innerHTML = fields.map((f, fi) => `
      <div data-field-idx="${fi}" style="border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--sp-3);margin-top:var(--sp-3);">
        <div style="display:flex;gap:var(--sp-2);align-items:flex-end;">
          <div class="input-group" style="flex:1;margin:0;">
            <label class="input-label">Field label</label>
            <input class="input cs-field-label" value="${escapeAttr(f.label)}" placeholder="e.g. Accuracy" />
          </div>
          <div class="input-group" style="width:120px;margin:0;">
            <label class="input-label">Type</label>
            <select class="input cs-field-type">
              <option value="scale" ${f.type === 'scale' ? 'selected' : ''}>Scale</option>
              <option value="band" ${f.type === 'band' ? 'selected' : ''}>Band</option>
              <option value="rag" ${f.type === 'rag' ? 'selected' : ''}>RAG</option>
            </select>
          </div>
          ${fields.length > 1 ? `<button class="btn btn-ghost btn-sm cs-remove-field" data-fi="${fi}" style="color:var(--danger);">Remove</button>` : ''}
        </div>
        <div style="margin-top:var(--sp-2);">
          <label class="input-label">Levels (low to high)</label>
          ${f.levels.map((lv, li) => `
            <div data-level-idx="${li}" style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:6px;">
              <input type="color" class="cs-level-color" value="${escapeAttr(lv.color || '#3b82f6')}" style="width:36px;height:32px;padding:2px;border:1px solid var(--border);border-radius:6px;cursor:pointer;" />
              <input class="input cs-level-label" value="${escapeAttr(lv.label)}" placeholder="Level label" style="flex:1;" />
              ${f.levels.length > 1 ? `<button class="btn btn-ghost btn-sm cs-remove-level" data-fi="${fi}" data-li="${li}" style="color:var(--danger);">&times;</button>` : ''}
            </div>
          `).join('')}
          <button class="btn btn-ghost btn-sm cs-add-level" data-fi="${fi}">+ Add level</button>
        </div>
      </div>
    `).join('');

    fieldsEl.querySelectorAll('.cs-remove-field').forEach(b => b.addEventListener('click', () => {
      syncFromDOM(); fields.splice(parseInt(b.dataset.fi, 10), 1); renderFields();
    }));
    fieldsEl.querySelectorAll('.cs-add-level').forEach(b => b.addEventListener('click', () => {
      syncFromDOM();
      const fi = parseInt(b.dataset.fi, 10);
      fields[fi].levels.push({ label: '', color: DEFAULT_LEVEL_COLORS[fields[fi].levels.length % DEFAULT_LEVEL_COLORS.length] });
      renderFields();
    }));
    fieldsEl.querySelectorAll('.cs-remove-level').forEach(b => b.addEventListener('click', () => {
      syncFromDOM();
      fields[parseInt(b.dataset.fi, 10)].levels.splice(parseInt(b.dataset.li, 10), 1);
      renderFields();
    }));
  }

  renderFields();

  backdrop.querySelector('#cs-add-field').addEventListener('click', () => {
    syncFromDOM();
    fields.push({ label: '', type: 'scale', levels: [{ label: '', color: '#C94F4F' }, { label: '', color: '#2c7a4b' }] });
    renderFields();
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="create"]').addEventListener('click', () => {
    syncFromDOM();
    const name = backdrop.querySelector('#cs-name').value.trim();
    if (!name) { backdrop.querySelector('#cs-name').style.borderColor = 'var(--danger)'; return; }
    // Validate + build.
    const usedFieldKeys = new Set();
    const built = [];
    for (let fi = 0; fi < fields.length; fi++) {
      const f = fields[fi];
      if (!f.label.trim()) { showToast(`Field ${fi + 1} needs a label.`, 'danger'); return; }
      const validLevels = f.levels.filter(lv => lv.label.trim());
      if (validLevels.length < 2) { showToast(`"${f.label}" needs at least 2 levels.`, 'danger'); return; }
      let fkey = slugify(f.label, `field_${fi + 1}`);
      while (usedFieldKeys.has(fkey)) fkey += '_';
      usedFieldKeys.add(fkey);
      const usedLevelKeys = new Set();
      const levels = validLevels.map((lv, li) => {
        let lkey = slugify(lv.label, `level_${li + 1}`);
        while (usedLevelKeys.has(lkey)) lkey += '_';
        usedLevelKeys.add(lkey);
        return { key: lkey, label: lv.label.trim(), color: lv.color || '#3b82f6', value: li + 1 };
      });
      built.push({ key: fkey, label: f.label.trim(), type: f.type, levels });
    }
    const entry = Store.addTrackingSchema({ name, fields: built });
    Store.updateClass(classId, { trackingSchemaId: entry.id });
    showToast(`Custom schema "${name}" created and applied`, 'success');
    close();
    onUpdate();
  });
}

/* ═══════════ Bulk Student Upload (B4) ═══════════ */

function showBulkUploadModal(classId, onUpdate) {
  const cls = Store.getClass(classId);
  if (!cls) return;
  let parsed = [];

  const { backdrop, close } = openModal({
    title: `Upload students — ${escapeHtml(cls.name)}`,
    width: 640,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">
        Upload a CSV or Excel class list. A <strong>Name</strong> column is required (other columns are ignored here).
        Names that already exist in this class — or repeat within the file — are skipped automatically.
      </p>
      <div id="bulk-upload-zone"></div>
      <div id="bulk-upload-summary" style="margin-top:var(--sp-3);font-size:0.8125rem;color:var(--ink-secondary);"></div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="confirm" disabled>Add students</button>
    `
  });

  const zone = backdrop.querySelector('#bulk-upload-zone');
  const summaryEl = backdrop.querySelector('#bulk-upload-summary');
  const confirmBtn = backdrop.querySelector('[data-action="confirm"]');
  const existingNames = new Set((cls.students || []).map(s => (s.name || '').trim().toLowerCase()));

  function dedupeCounts(rows) {
    const seen = new Set();
    let add = 0, dup = 0;
    rows.forEach(r => {
      const nm = String(r.name || '').trim();
      if (!nm) return;
      const key = nm.toLowerCase();
      if (existingNames.has(key) || seen.has(key)) { dup++; return; }
      seen.add(key); add++;
    });
    return { add, dup };
  }

  function recompute() {
    const { add, dup } = dedupeCounts(parsed);
    confirmBtn.disabled = add === 0;
    confirmBtn.textContent = add ? `Add ${add} student${add !== 1 ? 's' : ''}` : 'Add students';
    summaryEl.innerHTML = parsed.length
      ? `${add} new · ${dup} duplicate${dup !== 1 ? 's' : ''} skipped · ${parsed.length} row${parsed.length !== 1 ? 's' : ''} parsed.`
      : '';
  }

  const uploader = createStudentUploadZone({
    onParsed: (rows) => { parsed = rows || []; recompute(); }
  });
  zone.appendChild(uploader.el);

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  confirmBtn.addEventListener('click', () => {
    const rows = uploader.getStudents();
    const existing = new Set((Store.getClass(classId)?.students || []).map(s => (s.name || '').trim().toLowerCase()));
    const seen = new Set();
    let added = 0, skipped = 0;
    rows.forEach(r => {
      const nm = String(r.name || '').trim();
      if (!nm) { skipped++; return; }
      const key = nm.toLowerCase();
      if (existing.has(key) || seen.has(key)) { skipped++; return; }
      seen.add(key);
      Store.addStudent(classId, { name: nm });
      added++;
    });
    showToast(`Added ${added} student${added !== 1 ? 's' : ''}${skipped ? ` — ${skipped} skipped` : ''}`, added ? 'success' : 'danger');
    close();
    onUpdate();
  });
}

/* ═══════════ Free-text Remark (B6) ═══════════ */

function showRemarkModal(classId, student, onUpdate) {
  const { backdrop, close } = openModal({
    title: `Remark — ${escapeHtml(student.name)}`,
    width: 480,
    body: `
      <div class="input-group">
        <label class="input-label">Free-text remark</label>
        <textarea class="input" id="remark-text" rows="4" placeholder="A quick note — a win, a behaviour to follow up, anything worth remembering..." style="resize:vertical;"></textarea>
      </div>
      <p style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Saved as a teacher observation. Remarks feed the class portrait and the Report Comment Drafter.</p>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save Remark</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const input = backdrop.querySelector('#remark-text');
    const text = input.value.trim();
    if (!text) { input.style.borderColor = 'var(--danger)'; return; }
    // Store.updateStudent APPENDS observations — pass ONLY the new one to avoid a double-append.
    Store.updateStudent(classId, student.id, {
      observations: [{ id: generateId(), text, tags: ['remark'], ts: Date.now() }]
    });
    showToast('Remark saved', 'success');
    close();
    onUpdate();
  });

  setTimeout(() => backdrop.querySelector('#remark-text')?.focus(), 100);
}

/* ── Helpers ── */
/* escapeHtml now comes from the shared markdown util (quote-safe) */

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
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 5);

  const recentNotes = notes
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
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
      email: 'Structured email in MARKDOWN (headings, bold, lists — no HTML tags) with a greeting, sections (What We Learned, Looking Ahead, How to Help at Home), and a sign-off. Keep it professional but warm.',
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
