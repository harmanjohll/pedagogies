/*
 * Co-Cher My CCA
 * ==============
 * CCA management hub — CCA List and LEAPS 2.0 Development Framework tracker.
 */

import { Store, generateId } from '../state.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modals.js';
import { sendChat } from '../api.js';

/* ── LEAPS 2.0 Domains ── */
const LEAPS_DOMAINS = [
  {
    key: 'participation',
    label: 'Participation',
    color: '#3b82f6',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    desc: 'Sustained engagement in one school-based CCA (Clubs & Societies, Physical Sports, Uniformed Groups, or Visual & Performing Arts) across years.',
    levels: [
      'Participated in any CCA for at least 2 years',
      'Participated in any CCA for at least 3 years',
      'Participated in any CCA for at least 4 years, with at least 75% attendance',
      'Participated in the same CCA for 4–5 years, with at least 75% attendance'
    ]
  },
  {
    key: 'leadership',
    label: 'Leadership',
    color: '#f59e0b',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    desc: 'Leadership development — taking charge of personal development, working in a team, and assuming responsibilities in service of others.',
    levels: [
      'Completed 1 student leadership module/workshop',
      'Completed 2 modules OR held a sectional/committee leadership role',
      'Held a CCA leadership role (e.g. Vice-Captain) or completed NYAA Silver',
      'Held a CCA captaincy/chairperson role, led student-initiated projects, or NYAA Gold'
    ]
  },
  {
    key: 'service',
    label: 'Service',
    color: '#10b981',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    desc: 'Social responsibility through Values-In-Action (VIA) projects. Minimum 6 hours of community service per year.',
    levels: [
      'Completed at least 24 hours of VIA over 4 years',
      'Completed at least 30 hours, with reflection on service learning',
      'Completed at least 36 hours, with some role in planning/organising',
      'Led or initiated VIA projects, completed 40+ hours with deep reflection'
    ]
  },
  {
    key: 'achievement',
    label: 'Achievement',
    color: '#8b5cf6',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
    desc: 'Representation and accomplishment in CCA at various levels — school, zone, national, and international.',
    levels: [
      'Represented class/CCA at internal school events',
      'Represented school at zone/cluster-level competitions or events',
      'Represented school at national-level events or achieved top 4 at zone level',
      'Represented school at national/international level, or won national-level awards'
    ]
  }
];

/* ── CCA Categories ── */
const CCA_CATEGORIES = [
  { key: 'sports', label: 'Physical Sports', color: '#ef4444' },
  { key: 'performing', label: 'Visual & Performing Arts', color: '#8b5cf6' },
  { key: 'uniformed', label: 'Uniformed Groups', color: '#059669' },
  { key: 'clubs', label: 'Clubs & Societies', color: '#3b82f6' },
];

const DEFAULT_E21CC_MAPPING = {
  sports: ['collaboration', 'selfRegulation', 'criticalThinking'],
  performing: ['creativeThinking', 'communication', 'collaboration'],
  uniformed: ['selfRegulation', 'socialConnectedness', 'collaboration'],
  clubs: ['criticalThinking', 'communication', 'creativeThinking'],
};

const E21CC_DIM_META = {
  criticalThinking: { label: 'Critical Thinking', color: '#6366f1' },
  creativeThinking: { label: 'Creative Thinking', color: '#8b5cf6' },
  communication: { label: 'Communication', color: '#0ea5e9' },
  collaboration: { label: 'Collaboration', color: '#06b6d4' },
  socialConnectedness: { label: 'Social Connectedness', color: '#10b981' },
  selfRegulation: { label: 'Self-Regulation', color: '#f59e0b' },
};

const DEFAULT_SAFETY = {
  sports: ['Hydration check', 'Warm-up / cool-down', 'Weather check (haze/rain/lightning)', 'First aid kit ready', 'Emergency contacts available'],
  performing: ['Equipment inspection', 'Proper warm-up (vocal/physical)', 'Volume levels safe', 'Ventilation adequate'],
  uniformed: ['Parade ground safety', 'Equipment check', 'Weather check for outdoor activities', 'Buddy system for field exercises', 'First aid kit ready'],
  clubs: ['Lab/equipment safety briefing', 'Electrical safety (robotics/infocomm)', 'Supervision ratio adequate'],
};

const CCA_CAT_ICONS = {
  sports: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
  performing: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  uniformed: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  clubs: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v4"/><path d="M12 18v4"/><circle cx="12" cy="12" r="4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>`,
};

function getCCAReminders() {
  try { return JSON.parse(localStorage.getItem('cocher_cca_reminders') || '[]'); } catch { return []; }
}
function saveCCAReminders(list) {
  localStorage.setItem('cocher_cca_reminders', JSON.stringify(list));
}

const CCA_STYLES = `
  .cca-card { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .dark .cca-card { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
  .cca-section-title { font-size: 1.0625rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .cca-section-desc { font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: 16px; line-height: 1.5; }

  .leaps-domain { padding: 16px; border-radius: 10px; border: 1px solid var(--border, #e2e5ea); margin-bottom: 12px; transition: all 0.15s; }
  .leaps-domain:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .dark .leaps-domain { border-color: var(--border, #2e2e3e); }
  .leaps-domain-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .leaps-domain-label { font-weight: 700; font-size: 0.9375rem; }
  .leaps-domain-desc { font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.5; margin-bottom: 12px; }
  .leaps-levels { display: flex; flex-direction: column; gap: 6px; }
  .leaps-level { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 6px; font-size: 0.8125rem; line-height: 1.5; border: 1px solid var(--border, #e2e5ea); cursor: pointer; transition: all 0.15s; }
  .leaps-level:hover { background: var(--bg-subtle, #f8f9fa); }
  .leaps-level.achieved { border-color: var(--accent, #4361ee); background: rgba(67,97,238,0.06); }
  .leaps-level-num { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6875rem; font-weight: 700; color: #fff; }

  .cca-list-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--border, #e2e5ea); margin-bottom: 8px; transition: all 0.15s; }
  .cca-list-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .dark .cca-list-item { border-color: var(--border, #2e2e3e); }
  .cca-cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .cca-list-name { font-weight: 600; font-size: 0.875rem; color: var(--ink); flex: 1; }
  .cca-list-cat { font-size: 0.75rem; color: var(--ink-muted); flex: 0 0 auto; }
  .cca-list-actions { display: flex; gap: 6px; }

  .cca-tab-bar { display: flex; border-bottom: 2px solid var(--border, #e2e5ea); margin-bottom: 20px; gap: 0; }
  .cca-tab { padding: 10px 20px; font-size: 0.875rem; font-weight: 600; color: var(--ink-muted); border: none; background: none; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; }
  .cca-tab:hover { color: var(--ink); }
  .cca-tab.active { color: var(--accent, #4361ee); border-bottom-color: var(--accent, #4361ee); }

  .leaps-summary-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .leaps-summary-chip { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; border: 1px solid var(--border, #e2e5ea); }
  .dark .leaps-summary-chip { border-color: var(--border, #2e2e3e); }

  .leaps-grade-card { padding: 16px 20px; border-radius: 10px; text-align: center; }
  .leaps-grade-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 4px; }
  .leaps-grade-value { font-size: 1.5rem; font-weight: 800; }
  .leaps-grade-desc { font-size: 0.75rem; color: var(--ink-muted); margin-top: 4px; }

  .cca-expand-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border, #e2e5ea); display: none; }
  .cca-expand-section.visible { display: block; }
  .cca-action-row { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
  .cca-action-btn { font-size: 0.6875rem; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border, #e2e5ea); background: none; color: var(--ink-muted); cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 4px; }
  .cca-action-btn:hover { background: var(--accent-light, rgba(67,97,238,0.08)); color: var(--accent, #4361ee); border-color: var(--accent, #4361ee); }
  .cca-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; margin-right: 4px; margin-bottom: 4px; }
  .cca-checklist-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 0.8125rem; color: var(--ink-muted); }
  .cca-checklist-item input[type="checkbox"] { accent-color: var(--accent); }
  .cca-reminders-bar { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
  .dark .cca-reminders-bar { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
  .cca-reminder-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 0.8125rem; border-bottom: 1px solid var(--border-light, #f0f0f4); }
  .cca-reminder-item:last-child { border-bottom: none; }
  .cca-training-output { margin-top: 10px; padding: 12px; border-radius: 8px; background: var(--bg-subtle, #f8f9fa); font-size: 0.8125rem; line-height: 1.6; color: var(--ink-muted); }
  .dark .cca-training-output { background: var(--bg-subtle, #16161e); }

  .cca-category-card { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea); border-radius: 12px; overflow: hidden; transition: box-shadow 0.2s; cursor: pointer; }
  .cca-category-card:hover { box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.06)); }
  .cca-category-card.selected { border-color: var(--accent); box-shadow: var(--shadow-md); }
  .dark .cca-category-card { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
  .dark .cca-category-card.selected { border-color: var(--accent); }
  .cca-chevron { transition: transform 0.2s; }
  .cca-chevron.open { transform: rotate(180deg); }
`;

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ── localStorage helpers ── */
function getCCAList() {
  try { return JSON.parse(localStorage.getItem('cocher_cca_list') || '[]'); } catch { return []; }
}
function saveCCAList(list) {
  localStorage.setItem('cocher_cca_list', JSON.stringify(list));
}
function getLEAPSProgress() {
  try { return JSON.parse(localStorage.getItem('cocher_leaps_progress') || '{}'); } catch { return {}; }
}
function saveLEAPSProgress(p) {
  localStorage.setItem('cocher_leaps_progress', JSON.stringify(p));
}

let currentTab = 'cca-list';

export function render(container) {
  const ccaList = getCCAList();
  const leapsProgress = getLEAPSProgress();

  container.innerHTML = `
    <style>${CCA_STYLES}</style>
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header" style="margin-bottom: 8px;">
          <div>
            <h1 class="page-title" style="font-size:1.625rem;">My CCA</h1>
            <p class="page-subtitle">Co-Curricular Activities management and LEAPS 2.0 Development Framework</p>
          </div>
        </div>

        <!-- Tab bar -->
        <div class="cca-tab-bar">
          <button class="cca-tab ${currentTab === 'cca-list' ? 'active' : ''}" data-tab="cca-list">CCA List</button>
          <button class="cca-tab ${currentTab === 'leaps' ? 'active' : ''}" data-tab="leaps">LEAPS 2.0 Framework</button>
        </div>

        <div id="cca-tab-content"></div>
      </div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('.cca-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      render(container);
    });
  });

  const content = container.querySelector('#cca-tab-content');
  if (currentTab === 'cca-list') {
    renderCCAList(content, ccaList);
  } else {
    renderLEAPS(content, leapsProgress);
  }
}

function renderCCAItem(cca, cat) {
  const e21ccKeys = cca.e21ccMapping || DEFAULT_E21CC_MAPPING[cca.category] || [];
  const safetyItems = cca.safetyChecklist || DEFAULT_SAFETY[cca.category] || [];
  return `
    <div class="cca-list-item" data-id="${cca.id}" data-cat="${cca.category}" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="cca-cat-dot" style="background:${cat.color};"></div>
        <div class="cca-list-name">${escHtml(cca.name)}</div>
        <div class="cca-list-actions">
          <button class="btn btn-secondary btn-sm cca-edit-btn" data-id="${cca.id}" style="padding:4px 8px;font-size:0.6875rem;">Edit</button>
          <button class="btn btn-secondary btn-sm cca-delete-btn" data-id="${cca.id}" style="padding:4px 8px;font-size:0.6875rem;color:var(--danger,#ef4444);">Delete</button>
        </div>
      </div>
      <!-- E21CC badges -->
      <div style="margin-top:8px;">
        ${e21ccKeys.map(k => {
          const meta = E21CC_DIM_META[k];
          return meta ? `<span class="cca-badge" style="background:${meta.color}15;color:${meta.color};">${meta.label}</span>` : '';
        }).join('')}
      </div>
      <!-- Action row -->
      <div class="cca-action-row">
        <button class="cca-action-btn" data-action="safety" data-cca="${cca.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Safety
        </button>
        <button class="cca-action-btn" data-action="training" data-cca="${cca.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Suggest Training
        </button>
        <button class="cca-action-btn" data-action="notes" data-cca="${cca.id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Notes
        </button>
      </div>
      <!-- Safety section -->
      <div class="cca-expand-section" id="safety-${cca.id}">
        <div style="font-weight:600;font-size:0.8125rem;color:var(--ink);margin-bottom:8px;">Safety Checklist</div>
        ${safetyItems.map((item, idx) => `
          <div class="cca-checklist-item">
            <input type="checkbox" class="cca-safety-cb" data-cca="${cca.id}" data-idx="${idx}" />
            <span>${escHtml(item)}</span>
          </div>
        `).join('')}
      </div>
      <!-- Training section -->
      <div class="cca-expand-section" id="training-${cca.id}">
        <div style="font-weight:600;font-size:0.8125rem;color:var(--ink);margin-bottom:8px;">Training Suggestions</div>
        <div class="cca-training-output" id="training-output-${cca.id}">Click "Suggest Training" to get AI-generated session ideas for ${escHtml(cca.name)}.</div>
      </div>
      <!-- Notes section -->
      <div class="cca-expand-section" id="notes-${cca.id}">
        <div style="font-weight:600;font-size:0.8125rem;color:var(--ink);margin-bottom:8px;">Development Notes</div>
        <textarea class="input cca-notes-area" data-cca="${cca.id}" rows="3" placeholder="Observations, milestones, areas for growth..." style="width:100%;font-size:0.8125rem;resize:vertical;">${escHtml(cca.notes || '')}</textarea>
      </div>
    </div>
  `;
}

function renderCCAList(content, ccaList) {
  content.innerHTML = `
    <div class="cca-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <div class="cca-section-title">School CCA List</div>
          <div class="cca-section-desc" style="margin-bottom:0;">Add and manage your school's Co-Curricular Activities.</div>
        </div>
        <button class="btn btn-primary btn-sm" id="add-cca-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add CCA
        </button>
      </div>

      <!-- Reminders -->
      <div class="cca-reminders-bar">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-weight:600;font-size:0.875rem;color:var(--ink);">Reminders</div>
          <button class="btn btn-ghost btn-sm" id="add-reminder-btn" style="font-size:0.75rem;">+ Add</button>
        </div>
        <div id="reminders-list">
          ${(() => {
            const reminders = getCCAReminders().filter(r => !r.completed).sort((a, b) => new Date(a.date) - new Date(b.date));
            return reminders.length === 0
              ? '<div style="font-size:0.8125rem;color:var(--ink-faint);text-align:center;padding:8px;">No reminders yet.</div>'
              : reminders.map(r => `
                <div class="cca-reminder-item">
                  <input type="checkbox" class="reminder-complete-cb" data-rid="${r.id}" style="accent-color:var(--accent);" />
                  <span style="flex:1;color:var(--ink);">${escHtml(r.text)}</span>
                  <span style="font-size:0.75rem;color:var(--ink-faint);">${r.date ? new Date(r.date).toLocaleDateString('en-SG', {day:'numeric',month:'short'}) : ''}</span>
                  <button class="btn btn-ghost btn-sm reminder-delete-btn" data-rid="${r.id}" style="padding:2px 6px;font-size:0.6875rem;color:var(--danger);">×</button>
                </div>
              `).join('');
          })()}
        </div>
      </div>
    </div>

    <!-- Category Grid (2x2) -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      ${CCA_CATEGORIES.map(cat => {
        const ccasInCategory = ccaList.filter(c => c.category === cat.key);
        const count = ccasInCategory.length;
        return `
          <div class="cca-category-card" data-cat="${cat.key}" style="border-left: 4px solid ${cat.color};">
            <div class="cca-cat-header" style="display: flex; align-items: center; gap: 12px; padding: 16px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: ${cat.color}12; color: ${cat.color}; display: flex; align-items: center; justify-content: center;">
                ${CCA_CAT_ICONS[cat.key] || ''}
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.9375rem; color: var(--ink);">${cat.label}</div>
                <div style="font-size: 0.8125rem; color: var(--ink-muted);">${count} CCA${count !== 1 ? 's' : ''}</div>
              </div>
              <svg class="cca-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
        `;
      }).join('')}
    </div>
    <div id="cca-expanded-area"></div>
  `;

  // Add CCA button (global)
  content.querySelector('#add-cca-btn')?.addEventListener('click', () => showCCAForm(content, null));

  // Category grid click — expand below the grid
  let selectedCatKey = null;
  content.querySelectorAll('.cca-category-card').forEach(card => {
    card.addEventListener('click', () => {
      const catKey = card.dataset.cat;
      const expandedArea = content.querySelector('#cca-expanded-area');
      const allCards = content.querySelectorAll('.cca-category-card');

      if (selectedCatKey === catKey) {
        // Collapse
        selectedCatKey = null;
        allCards.forEach(c => { c.classList.remove('selected'); c.querySelector('.cca-chevron')?.classList.remove('open'); });
        expandedArea.innerHTML = '';
        return;
      }

      selectedCatKey = catKey;
      allCards.forEach(c => { c.classList.remove('selected'); c.querySelector('.cca-chevron')?.classList.remove('open'); });
      card.classList.add('selected');
      card.querySelector('.cca-chevron')?.classList.add('open');

      const cat = CCA_CATEGORIES.find(c => c.key === catKey);
      const ccasInCategory = getCCAList().filter(c => c.category === catKey);
      expandedArea.innerHTML = `
        <div class="cca-card" style="border-left:4px solid ${cat.color};">
          <div style="font-weight:700;font-size:0.9375rem;color:var(--ink);margin-bottom:12px;">${cat.label}</div>
          ${ccasInCategory.length === 0
            ? '<div style="font-size:0.8125rem;color:var(--ink-faint);text-align:center;padding:12px 0;">No CCAs in this category yet.</div>'
            : ccasInCategory.map(cca => renderCCAItem(cca, cat)).join('')}
          <button class="btn btn-ghost btn-sm" data-add-to="${cat.key}" style="margin-top: 8px;">+ Add ${cat.label.split(' ')[0]} CCA</button>
        </div>
      `;

      // Re-bind expanded area event listeners
      bindExpandedAreaListeners(content, expandedArea);
    });
  });

  // Edit
  content.querySelectorAll('.cca-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const list = getCCAList();
      const cca = list.find(c => c.id === btn.dataset.id);
      if (cca) showCCAForm(content, cca);
    });
  });

  // Delete
  content.querySelectorAll('.cca-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog('Delete this CCA?', 'This action cannot be undone.');
      if (!ok) return;
      const list = getCCAList().filter(c => c.id !== btn.dataset.id);
      saveCCAList(list);
      showToast('CCA deleted');
      renderCCAList(content, list);
    });
  });

  // Toggle expandable sections
  content.querySelectorAll('.cca-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const ccaId = btn.dataset.cca;
      const section = content.querySelector(`#${action}-${ccaId}`);
      if (section) section.classList.toggle('visible');
    });
  });

  // Training suggestions (AI-powered)
  content.querySelectorAll('[data-action="training"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const ccaId = btn.dataset.cca;
      const list = getCCAList();
      const cca = list.find(c => c.id === ccaId);
      if (!cca) return;
      const cat = CCA_CATEGORIES.find(c => c.key === cca.category);
      const outputEl = content.querySelector(`#training-output-${ccaId}`);
      if (!outputEl || outputEl.dataset.loaded === 'true') return;

      outputEl.innerHTML = '<em>Generating suggestions...</em>';
      try {
        const text = await sendChat(
          [{ role: 'user', content: `Suggest a training session plan for a secondary school ${cat?.label || 'CCA'} CCA called "${cca.name}". Include: warm-up routine (5-10 min), main activity structure (30-40 min), cool-down/debrief (5-10 min), and 2-3 skill progression ideas. Keep it concise and practical.` }],
          { trackLabel: 'ccaTraining', temperature: 0.7, maxTokens: 1024 }
        );
        outputEl.innerHTML = text.replace(/\n/g, '<br/>');
        outputEl.dataset.loaded = 'true';
      } catch (err) {
        outputEl.innerHTML = `<span style="color:var(--danger);">Error: ${err.message}. Check your API key in Settings.</span>`;
      }
    });
  });

  // Save notes on blur
  content.querySelectorAll('.cca-notes-area').forEach(textarea => {
    textarea.addEventListener('blur', () => {
      const ccaId = textarea.dataset.cca;
      const list = getCCAList();
      const cca = list.find(c => c.id === ccaId);
      if (cca) {
        cca.notes = textarea.value;
        saveCCAList(list);
      }
    });
  });

  // Add reminder
  content.querySelector('#add-reminder-btn')?.addEventListener('click', () => {
    const text = prompt('Reminder text:');
    if (!text) return;
    const date = prompt('Date (YYYY-MM-DD, or leave blank):');
    const reminders = getCCAReminders();
    reminders.push({ id: generateId(), text, date: date || '', completed: false });
    saveCCAReminders(reminders);
    renderCCAList(content, getCCAList());
  });

  // Complete reminder
  content.querySelectorAll('.reminder-complete-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const reminders = getCCAReminders();
      const r = reminders.find(rem => rem.id === cb.dataset.rid);
      if (r) r.completed = true;
      saveCCAReminders(reminders);
      renderCCAList(content, getCCAList());
    });
  });

  // Delete reminder
  content.querySelectorAll('.reminder-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reminders = getCCAReminders().filter(r => r.id !== btn.dataset.rid);
      saveCCAReminders(reminders);
      renderCCAList(content, getCCAList());
    });
  });
}

function showCCAForm(content, existing, prefilledCategory) {
  const formId = 'cca-form-overlay';
  let overlay = content.querySelector('#' + formId);
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = formId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--bg-card,#fff);border-radius:12px;padding:24px;width:400px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
      <div style="font-weight:700;font-size:1rem;color:var(--ink);margin-bottom:16px;">${existing ? 'Edit CCA' : 'Add CCA'}</div>
      <div style="margin-bottom:12px;">
        <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">CCA Name</label>
        <input type="text" id="cca-name-input" class="input" placeholder="e.g. Scouts, Basketball, Band" style="width:100%;" value="${existing ? escHtml(existing.name) : ''}" />
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Category</label>
        <select id="cca-cat-input" class="input" style="width:100%;">
          ${CCA_CATEGORIES.map(cat => `<option value="${cat.key}" ${existing ? (existing.category === cat.key ? 'selected' : '') : (prefilledCategory === cat.key ? 'selected' : '')}>${cat.label}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm" id="cca-form-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="cca-form-save">${existing ? 'Save' : 'Add'}</button>
      </div>
    </div>
  `;

  content.appendChild(overlay);

  overlay.querySelector('#cca-form-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#cca-form-save').addEventListener('click', () => {
    const name = overlay.querySelector('#cca-name-input').value.trim();
    const category = overlay.querySelector('#cca-cat-input').value;
    if (!name) { showToast('Please enter a CCA name', 'warning'); return; }

    const list = getCCAList();
    if (existing) {
      const idx = list.findIndex(c => c.id === existing.id);
      if (idx >= 0) { list[idx].name = name; list[idx].category = category; }
    } else {
      list.push({ id: generateId(), name, category, createdAt: new Date().toISOString() });
    }
    saveCCAList(list);
    overlay.remove();
    showToast(existing ? 'CCA updated' : 'CCA added');
    renderCCAList(content, list);
  });

  overlay.querySelector('#cca-name-input').focus();
}

function renderLEAPS(content, leapsProgress) {
  // Calculate overall grade
  const domainLevels = {};
  LEAPS_DOMAINS.forEach(d => {
    domainLevels[d.key] = leapsProgress[d.key] || 0;
  });

  const allLevels = Object.values(domainLevels);
  const minLevel = Math.min(...allLevels);
  const maxLevel = Math.max(...allLevels);
  const hasLevel3All = allLevels.every(l => l >= 3);
  const hasLevel4Any = allLevels.some(l => l >= 4);
  const hasLevel1All = allLevels.every(l => l >= 1);
  const hasLevel2Three = allLevels.filter(l => l >= 2).length >= 3;

  let grade = 'Fair';
  let gradeColor = '#6b7280';
  let gradePoints = 0;
  let gradeDesc = 'Does not meet the threshold for bonus points.';

  if (hasLevel3All && hasLevel4Any) {
    grade = 'Excellent';
    gradeColor = '#10b981';
    gradePoints = 2;
    gradeDesc = 'Minimum Level 3 in all domains, with at least Level 4 in one.';
  } else if (hasLevel1All && hasLevel2Three) {
    grade = 'Good';
    gradeColor = '#3b82f6';
    gradePoints = 1;
    gradeDesc = 'Minimum Level 1 in all domains, with at least Level 2 in three.';
  }

  content.innerHTML = `
    <div class="cca-card">
      <div class="cca-section-title">LEAPS 2.0 Development Framework</div>
      <div class="cca-section-desc">
        The LEAPS 2.0 framework (MOE, 2014) recognises students' holistic development across four domains:
        <strong>Leadership</strong>, <strong>Enrichment</strong> (folded into other domains), <strong>Achievement</strong>,
        <strong>Participation</strong>, and <strong>Service</strong>.
        At graduation, co-curricular attainment is graded as Excellent, Good, or Fair, translating to bonus points for post-secondary admissions.
      </div>

      <!-- Summary -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
        <div class="leaps-grade-card" style="background:${gradeColor}15;border:2px solid ${gradeColor};">
          <div class="leaps-grade-label" style="color:${gradeColor};">Current Grade</div>
          <div class="leaps-grade-value" style="color:${gradeColor};">${grade}</div>
          <div class="leaps-grade-desc">${gradeDesc}</div>
        </div>
        <div class="leaps-grade-card" style="background:rgba(67,97,238,0.06);border:1px solid var(--border,#e2e5ea);">
          <div class="leaps-grade-label" style="color:var(--accent,#4361ee);">Bonus Points</div>
          <div class="leaps-grade-value" style="color:var(--accent,#4361ee);">${gradePoints}</div>
          <div class="leaps-grade-desc">For post-secondary admissions</div>
        </div>
        <div class="leaps-grade-card" style="background:rgba(245,158,11,0.06);border:1px solid var(--border,#e2e5ea);">
          <div class="leaps-grade-label" style="color:#f59e0b;">Domains Tracked</div>
          <div class="leaps-grade-value" style="color:#f59e0b;">${allLevels.filter(l => l > 0).length}/4</div>
          <div class="leaps-grade-desc">Click levels below to track</div>
        </div>
      </div>

      <!-- Domain level summary bar -->
      <div class="leaps-summary-bar">
        ${LEAPS_DOMAINS.map(d => `
          <div class="leaps-summary-chip" style="border-left:3px solid ${d.color};">
            <span style="color:${d.color};font-weight:700;">${d.label}</span>
            <span style="color:var(--ink-muted);">Level ${domainLevels[d.key]}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Individual domains -->
    ${LEAPS_DOMAINS.map(d => `
      <div class="leaps-domain" style="border-left:4px solid ${d.color};">
        <div class="leaps-domain-header">
          <span style="color:${d.color};">${d.icon}</span>
          <div class="leaps-domain-label" style="color:${d.color};">${d.label}</div>
          <span style="margin-left:auto;font-size:0.75rem;font-weight:600;padding:2px 10px;border-radius:10px;background:${d.color}15;color:${d.color};">
            Level ${domainLevels[d.key]}
          </span>
        </div>
        <div class="leaps-domain-desc">${d.desc}</div>
        <div class="leaps-levels">
          ${d.levels.map((level, i) => {
            const lvl = i + 1;
            const achieved = domainLevels[d.key] >= lvl;
            return `
              <div class="leaps-level ${achieved ? 'achieved' : ''}" data-domain="${d.key}" data-level="${lvl}">
                <div class="leaps-level-num" style="background:${achieved ? d.color : 'var(--ink-faint,#9ca3af)'};">${lvl}</div>
                <div style="color:var(--ink${achieved ? '' : '-muted'});">${level}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('')}

    <!-- Grading reference -->
    <div class="cca-card">
      <div class="cca-section-title">LEAPS 2.0 Grading Reference</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px;">
        <div style="padding:12px;border-radius:8px;border:2px solid #10b981;background:rgba(16,185,129,0.06);">
          <div style="font-weight:700;color:#10b981;margin-bottom:4px;">Excellent (2 pts)</div>
          <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Min Level 3 in all 4 domains, with at least Level 4 in one domain.</div>
        </div>
        <div style="padding:12px;border-radius:8px;border:2px solid #3b82f6;background:rgba(59,130,246,0.06);">
          <div style="font-weight:700;color:#3b82f6;margin-bottom:4px;">Good (1 pt)</div>
          <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Min Level 1 in all domains, with at least Level 2 in three domains.</div>
        </div>
        <div style="padding:12px;border-radius:8px;border:2px solid #6b7280;background:rgba(107,114,128,0.06);">
          <div style="font-weight:700;color:#6b7280;margin-bottom:4px;">Fair (0 pts)</div>
          <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Does not meet the above thresholds.</div>
        </div>
      </div>
    </div>
  `;

  // Click on levels to toggle achievement
  content.querySelectorAll('.leaps-level').forEach(el => {
    el.addEventListener('click', () => {
      const domain = el.dataset.domain;
      const level = parseInt(el.dataset.level);
      const progress = getLEAPSProgress();
      const current = progress[domain] || 0;

      // Toggle: if clicking the current level, go down one; if clicking higher, go up
      if (current === level) {
        progress[domain] = level - 1;
      } else {
        progress[domain] = level;
      }

      saveLEAPSProgress(progress);
      renderLEAPS(content, progress);
    });
  });
}
