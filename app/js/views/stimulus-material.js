/*
 * Co-Cher Stimulus Material Library
 * ==================================
 * Library page for teachers to curate and adapt stimulus materials
 * (comprehension passages, source texts, scenarios, visual descriptions).
 */

import { Store } from '../state.js';
import { sendChat } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modals.js';
import { createFileUploadZone } from '../components/pdf-upload.js';

/* ── Constants ── */
const STORAGE_KEY = 'cocher_stimulus_library';

const SUBJECTS = [
  'English', 'Chinese', 'Malay', 'Tamil',
  'History', 'Social Studies', 'Geography',
  'GP', 'CCE', 'Other'
];

const LEVELS = [
  'Sec 1', 'Sec 2', 'Sec 3', 'Sec 4', 'Sec 5',
  'JC 1', 'JC 2'
];

const TYPES = [
  'Comprehension Passage',
  'Source Text',
  'Case Study',
  'Scenario',
  'Visual Description'
];

const WORD_COUNTS = [
  { label: '150\u2013250 words', value: '150-250' },
  { label: '250\u2013400 words', value: '250-400' },
  { label: '400+ words', value: '400+' }
];

/* ── Helpers ── */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLibrary(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function subjectColor(subject) {
  const colors = {
    'English': '#4361ee',
    'Chinese': '#e63946',
    'Malay': '#2a9d8f',
    'Tamil': '#e9c46a',
    'History': '#8b5cf6',
    'Social Studies': '#f77f00',
    'Geography': '#06d6a0',
    'GP': '#3a86a8',
    'CCE': '#ef476f',
    'Other': '#6c757d'
  };
  return colors[subject] || '#6c757d';
}

function typeColor(type) {
  const colors = {
    'Comprehension Passage': { bg: '#dbeafe', fg: '#1e40af' },
    'Source Text': { bg: '#fce7f3', fg: '#9d174d' },
    'Case Study': { bg: '#d1fae5', fg: '#065f46' },
    'Scenario': { bg: '#fef3c7', fg: '#92400e' },
    'Visual Description': { bg: '#ede9fe', fg: '#5b21b6' }
  };
  return colors[type] || { bg: '#f3f4f6', fg: '#374151' };
}

function typeBadgeLabel(type) {
  const labels = {
    'Comprehension Passage': 'Passage',
    'Source Text': 'Source',
    'Case Study': 'Case Study',
    'Scenario': 'Scenario',
    'Visual Description': 'Visual'
  };
  return labels[type] || type;
}

function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ── Main render ── */
export function render(container) {
  let activeTab = 'browse';
  let expandedItemId = null;
  let generatedResult = null;
  let isGenerating = false;
  let manualFileMeta = null;

  function renderView() {
    const library = getLibrary();

    container.innerHTML = `
      <style>
        @keyframes smFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .sm-tabs {
          display: flex; gap: 4px; margin-bottom: 24px;
          padding: 4px; border-radius: 10px;
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          width: fit-content;
        }
        .dark .sm-tabs { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .sm-tab {
          padding: 8px 20px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
          cursor: pointer; border: none; background: transparent;
          color: var(--ink-muted, #777); transition: all 0.15s;
        }
        .sm-tab:hover { color: var(--ink, #1a1a2e); }
        .dark .sm-tab:hover { color: var(--ink, #e8e8f0); }
        .sm-tab.active { background: #4361ee; color: #fff; }

        .sm-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .sm-card {
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px;
          overflow: hidden;
          display: flex; flex-direction: column;
          transition: box-shadow 0.2s, transform 0.15s;
          cursor: pointer;
        }
        .sm-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .dark .sm-card {
          background: var(--bg-card, #1e1e2e);
          border-color: var(--border, #2e2e3e);
        }
        .dark .sm-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .sm-card-body { padding: 20px; flex: 1; display: flex; flex-direction: column; }
        .sm-card-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .sm-subject-tag {
          display: inline-block; font-size: 0.6875rem; font-weight: 600; color: #fff;
          padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em;
        }
        .sm-type-badge {
          display: inline-block; font-size: 0.6875rem; font-weight: 600;
          padding: 2px 10px; border-radius: 20px;
        }
        .sm-level-badge {
          display: inline-block; font-size: 0.625rem; font-weight: 600;
          padding: 2px 8px; border-radius: 12px;
          background: var(--bg-subtle, #f0f0f4); color: var(--ink-muted, #777);
        }
        .dark .sm-level-badge { background: var(--bg-subtle, #252540); color: var(--ink-muted, #999); }
        .sm-card-title {
          font-size: 1.0625rem; font-weight: 700; color: var(--ink, #1a1a2e);
          margin-bottom: 8px; line-height: 1.3;
        }
        .dark .sm-card-title { color: var(--ink, #e8e8f0); }
        .sm-card-snippet {
          font-size: 0.8125rem; color: var(--ink-secondary, #555);
          line-height: 1.55; flex: 1;
        }
        .dark .sm-card-snippet { color: var(--ink-secondary, #aaa); }
        .sm-card-footer {
          padding: 14px 20px;
          border-top: 1px solid var(--border-light, #f0f0f4);
          display: flex; align-items: center; justify-content: space-between;
        }
        .dark .sm-card-footer { border-top-color: var(--border, #2e2e3e); }
        .sm-card-meta {
          font-size: 0.75rem; color: var(--ink-muted, #888);
          display: flex; align-items: center; gap: 12px;
        }
        .sm-delete-btn {
          background: none; border: 1px solid var(--border, #e2e5ea); color: var(--ink-muted, #888);
          padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .sm-delete-btn:hover { color: #dc3545; border-color: #dc3545; }
        .dark .sm-delete-btn { border-color: var(--border, #3e3e4e); }

        /* Expanded view */
        .sm-expanded {
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px; padding: 28px; margin-bottom: 20px;
          animation: smFadeIn 0.2s ease;
        }
        .dark .sm-expanded { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .sm-expanded-title {
          font-size: 1.25rem; font-weight: 700; color: var(--ink, #1a1a2e); margin-bottom: 16px;
        }
        .dark .sm-expanded-title { color: var(--ink, #e8e8f0); }
        .sm-expanded-content {
          font-size: 0.875rem; color: var(--ink, #1a1a2e); line-height: 1.7;
          white-space: pre-wrap; margin-bottom: 20px;
          padding: 20px; border-radius: 8px;
          background: var(--bg-subtle, #f8f9fa); border: 1px solid var(--border-light, #f0f0f4);
        }
        .dark .sm-expanded-content {
          color: var(--ink, #e8e8f0);
          background: var(--bg-subtle, #16161e); border-color: var(--border, #2e2e3e);
        }
        .sm-expanded-section {
          margin-bottom: 16px;
        }
        .sm-expanded-section-title {
          font-size: 0.8125rem; font-weight: 700; color: var(--ink-secondary, #555);
          text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;
        }
        .dark .sm-expanded-section-title { color: var(--ink-secondary, #aaa); }
        .sm-expanded-section-body {
          font-size: 0.8125rem; color: var(--ink, #1a1a2e); line-height: 1.6; white-space: pre-wrap;
        }
        .dark .sm-expanded-section-body { color: var(--ink, #e8e8f0); }
        .sm-close-btn {
          background: none; border: 1px solid var(--border, #e2e5ea); color: var(--ink-muted, #777);
          padding: 6px 16px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .sm-close-btn:hover { border-color: #4361ee; color: #4361ee; }
        .dark .sm-close-btn { border-color: var(--border, #3e3e4e); }

        /* Create form */
        .sm-form-card {
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px; padding: 28px; margin-bottom: 24px;
        }
        .dark .sm-form-card { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .sm-form-title {
          font-size: 1.125rem; font-weight: 700; color: var(--ink, #1a1a2e); margin-bottom: 6px;
          display: flex; align-items: center; gap: 10px;
        }
        .dark .sm-form-title { color: var(--ink, #e8e8f0); }
        .sm-form-desc {
          font-size: 0.8125rem; color: var(--ink-muted, #777); margin-bottom: 20px; line-height: 1.5;
        }
        .dark .sm-form-desc { color: var(--ink-muted, #999); }
        .sm-field {
          display: flex; flex-direction: column; gap: 4px;
        }
        .sm-label {
          font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary, #555);
          text-transform: uppercase; letter-spacing: 0.03em;
        }
        .dark .sm-label { color: var(--ink-secondary, #aaa); }
        .sm-select, .sm-input, .sm-textarea {
          padding: 8px 12px; border: 1px solid var(--border, #e2e5ea); border-radius: 8px;
          font-size: 0.8125rem; font-family: inherit;
          background: var(--bg, #fff); color: var(--ink, #1a1a2e); transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .sm-select:focus, .sm-input:focus, .sm-textarea:focus {
          outline: none; border-color: #4361ee;
          box-shadow: 0 0 0 3px rgba(67,97,238,0.12);
        }
        .dark .sm-select, .dark .sm-input, .dark .sm-textarea {
          background: var(--bg-subtle, #16161e); color: var(--ink, #e8e8f0);
          border-color: var(--border, #3e3e4e);
        }
        .sm-textarea { resize: vertical; line-height: 1.5; width: 100%; }

        .sm-generate-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #4361ee; color: #fff; border: none;
          padding: 10px 24px; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
          cursor: pointer; margin-top: 16px; transition: background 0.15s, transform 0.1s;
        }
        .sm-generate-btn:hover { background: #3a56d4; }
        .sm-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .sm-save-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #06d6a0; color: #fff; border: none;
          padding: 10px 24px; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
        }
        .sm-save-btn:hover { background: #05b588; }
        .sm-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .sm-loading {
          display: flex; align-items: center; gap: 10px;
          margin-top: 12px; font-size: 0.875rem; color: var(--ink-muted, #777);
        }
        .sm-spinner {
          width: 20px; height: 20px;
          border: 2.5px solid var(--border, #e2e5ea);
          border-top-color: #4361ee; border-radius: 50%;
          animation: smSpin 0.7s linear infinite;
        }
        @keyframes smSpin { to { transform: rotate(360deg); } }

        .sm-divider {
          margin: 32px 0 24px; border: none;
          border-top: 1px solid var(--border-light, #f0f0f4);
        }
        .dark .sm-divider { border-top-color: var(--border, #2e2e3e); }

        .sm-preview-card {
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px; padding: 24px; margin-top: 20px; animation: smFadeIn 0.2s ease;
        }
        .dark .sm-preview-card { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .sm-preview-title {
          font-size: 1rem; font-weight: 700; color: var(--ink, #1a1a2e); margin-bottom: 12px;
        }
        .dark .sm-preview-title { color: var(--ink, #e8e8f0); }

        .sm-empty {
          text-align: center; padding: 60px 20px;
          color: var(--ink-muted, #888); font-size: 0.9375rem;
        }
        .sm-empty-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.4; }
        .sm-source-badge {
          display: inline-block; font-size: 0.5625rem; font-weight: 600;
          padding: 1px 6px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.04em;
          background: var(--bg-subtle, #f0f0f4); color: var(--ink-muted, #888); margin-left: 4px;
        }
        .dark .sm-source-badge { background: var(--bg-subtle, #252540); color: var(--ink-muted, #999); }
        .sm-btn-row {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px;
        }
      </style>

      <div class="main-scroll">
        <div class="page-container">

          <!-- Header -->
          <div class="page-header" style="margin-bottom: 20px;">
            <div>
              <h1 class="page-title" style="font-size:1.625rem;font-weight:700;color:var(--ink, #1a1a2e);margin:0 0 4px;">Stimulus Materials</h1>
              <p class="page-subtitle" style="font-size:0.9375rem;color:var(--ink-muted, #777);margin:0;">Curate and adapt comprehension passages, source texts, scenarios, and visual descriptions</p>
            </div>
          </div>

          <!-- Tab group -->
          <div class="sm-tabs">
            <button class="sm-tab ${activeTab === 'browse' ? 'active' : ''}" data-tab="browse">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:4px;"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Browse Library (${library.length})
            </button>
            <button class="sm-tab ${activeTab === 'create' ? 'active' : ''}" data-tab="create">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:-2px;margin-right:4px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create New
            </button>
          </div>

          <!-- Browse Tab -->
          <div id="sm-browse-panel" style="${activeTab === 'browse' ? '' : 'display:none;'}">
            ${expandedItemId ? renderExpandedView(library.find(i => i.id === expandedItemId)) : ''}
            ${library.length === 0 ? `
              <div class="sm-empty">
                <div class="sm-empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div style="font-weight:600;margin-bottom:4px;">No stimulus materials yet</div>
                <div style="font-size:0.8125rem;">Switch to the Create tab to generate or add your first material.</div>
              </div>
            ` : `
              <div class="sm-grid" id="sm-library-grid">
                ${library.map(item => {
                  const sc = subjectColor(item.subject);
                  const tc = typeColor(item.type);
                  const snippet = item.content
                    ? escapeHtml(item.content.substring(0, 100)) + (item.content.length > 100 ? '...' : '')
                    : '';
                  return `
                    <div class="sm-card" data-item-id="${item.id}">
                      <div class="sm-card-body">
                        <div class="sm-card-tags">
                          <span class="sm-subject-tag" style="background:${sc};">${escapeHtml(item.subject)}</span>
                          <span class="sm-type-badge" style="background:${tc.bg};color:${tc.fg};">${typeBadgeLabel(item.type)}</span>
                          ${item.level ? `<span class="sm-level-badge">${escapeHtml(item.level)}</span>` : ''}
                        </div>
                        <div class="sm-card-title">${escapeHtml(item.title)}</div>
                        <div class="sm-card-snippet">${snippet}</div>
                      </div>
                      <div class="sm-card-footer">
                        <div class="sm-card-meta">
                          <span>${item.wordCount || countWords(item.content)} words</span>
                          <span class="sm-source-badge">${item.source === 'ai' ? 'AI' : 'Manual'}</span>
                          <span>${formatDate(item.createdAt)}</span>
                        </div>
                        <button class="sm-delete-btn" data-delete-id="${item.id}">Delete</button>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Create Tab -->
          <div id="sm-create-panel" style="${activeTab === 'create' ? '' : 'display:none;'}">

            <!-- AI Generation Form -->
            <div class="sm-form-card">
              <div class="sm-form-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Generate with AI
              </div>
              <div class="sm-form-desc">Fill in the parameters below and let AI create a stimulus material tailored to your lesson needs.</div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <div class="sm-field">
                  <label class="sm-label">Subject</label>
                  <select id="sm-subject" class="sm-select">
                    <option value="">Select subject...</option>
                    ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
                  </select>
                </div>
                <div class="sm-field">
                  <label class="sm-label">Level</label>
                  <select id="sm-level" class="sm-select">
                    <option value="">Select level...</option>
                    ${LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <div class="sm-field">
                  <label class="sm-label">Type</label>
                  <select id="sm-type" class="sm-select">
                    <option value="">Select type...</option>
                    ${TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                  </select>
                </div>
                <div class="sm-field">
                  <label class="sm-label">Word Count Range</label>
                  <select id="sm-wordcount" class="sm-select">
                    ${WORD_COUNTS.map(w => `<option value="${w.value}">${w.label}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="sm-field" style="margin-bottom:14px;">
                <label class="sm-label">Topic / Theme</label>
                <input type="text" id="sm-topic" class="sm-input" placeholder="e.g. The impact of urbanisation on local communities" />
              </div>

              <div class="sm-field" style="margin-bottom:14px;">
                <label class="sm-label">Additional Instructions <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
                <textarea id="sm-instructions" class="sm-textarea" rows="3" placeholder="e.g. Include vocabulary suitable for EL learners, focus on cause-and-effect reasoning, include a twist ending..."></textarea>
              </div>

              <button class="sm-generate-btn" id="sm-generate-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Generate with AI
              </button>
              <div id="sm-loading" style="display:none;" class="sm-loading">
                <div class="sm-spinner"></div>
                <span>Generating stimulus material... This may take a moment.</span>
              </div>

              <!-- AI Result Preview -->
              <div id="sm-ai-result" style="display:none;"></div>
            </div>

            <!-- Manual Entry -->
            <div class="sm-form-card">
              <div class="sm-form-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06d6a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Manual Entry
              </div>
              <div class="sm-form-desc">Paste or type your own stimulus material and save it to your library.</div>

              <div class="sm-field" style="margin-bottom:14px;">
                <label class="sm-label">Title</label>
                <input type="text" id="sm-manual-title" class="sm-input" placeholder="e.g. The River's Journey - Comprehension Passage" />
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">
                <div class="sm-field">
                  <label class="sm-label">Subject</label>
                  <select id="sm-manual-subject" class="sm-select">
                    <option value="">Select...</option>
                    ${SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('')}
                  </select>
                </div>
                <div class="sm-field">
                  <label class="sm-label">Level</label>
                  <select id="sm-manual-level" class="sm-select">
                    <option value="">Select...</option>
                    ${LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}
                  </select>
                </div>
                <div class="sm-field">
                  <label class="sm-label">Type</label>
                  <select id="sm-manual-type" class="sm-select">
                    <option value="">Select...</option>
                    ${TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="sm-field" style="margin-bottom:14px;">
                <label class="sm-label">Upload File (.txt, .md, .csv, .pdf)</label>
                <div id="sm-manual-upload-mount"></div>
              </div>

              <div id="sm-manual-source-ref" style="display:none;"></div>

              <div class="sm-field" style="margin-bottom:14px;">
                <label class="sm-label">Content</label>
                <textarea id="sm-manual-content" class="sm-textarea" rows="10" placeholder="Paste or type your stimulus material here, or upload a file above..."></textarea>
              </div>

              <div class="sm-field" style="margin-bottom:14px;">
                <label class="sm-label">Suggested Questions <span style="font-weight:400;opacity:0.6;">(optional, one per line)</span></label>
                <textarea id="sm-manual-questions" class="sm-textarea" rows="4" placeholder="1. What is the main idea of the passage?\n2. How does the author convey..."></textarea>
              </div>

              <div class="sm-field" style="margin-bottom:14px;">
                <label class="sm-label">Teacher Notes <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
                <textarea id="sm-manual-notes" class="sm-textarea" rows="3" placeholder="Key teaching points, vocabulary to pre-teach, differentiation ideas..."></textarea>
              </div>

              <button class="sm-save-btn" id="sm-manual-save-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save to Library
              </button>
            </div>

          </div>

        </div>
      </div>
    `;

    /* ── Wire event listeners ── */

    // Tab switching
    container.querySelectorAll('.sm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        expandedItemId = null;
        renderView();
      });
    });

    // Card click to expand
    container.querySelectorAll('.sm-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.sm-delete-btn')) return;
        expandedItemId = card.dataset.itemId;
        renderView();
        const expandedEl = container.querySelector('.sm-expanded');
        if (expandedEl) expandedEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Close expanded view
    const closeExpandedBtn = container.querySelector('#sm-close-expanded');
    if (closeExpandedBtn) {
      closeExpandedBtn.addEventListener('click', () => {
        expandedItemId = null;
        renderView();
      });
    }

    // Delete items
    container.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.deleteId;
        const item = library.find(i => i.id === id);
        const confirmed = await confirmDialog({
          title: 'Delete Stimulus Material',
          message: `Are you sure you want to delete "<strong>${escapeHtml(item?.title || 'this item')}</strong>"? This action cannot be undone.`,
          confirmLabel: 'Delete',
          confirmClass: 'btn btn-danger'
        });
        if (confirmed) {
          const updated = getLibrary().filter(i => i.id !== id);
          saveLibrary(updated);
          if (expandedItemId === id) expandedItemId = null;
          showToast('Stimulus material deleted', 'default');
          renderView();
        }
      });
    });

    // AI Generation
    const generateBtn = container.querySelector('#sm-generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', handleGenerate);
    }

    // If there's a pending AI result, render it
    if (generatedResult && activeTab === 'create') {
      renderAiResult();
    }

    // Mount file upload zone for manual entry
    const manualUploadMount = container.querySelector('#sm-manual-upload-mount');
    if (manualUploadMount) {
      const uploadZone = createFileUploadZone({
        compact: true,
        onContent: (text, meta) => {
          const contentArea = container.querySelector('#sm-manual-content');
          if (contentArea) contentArea.value = text;
          manualFileMeta = meta;

          // Auto-fill title from filename if empty
          const titleInput = container.querySelector('#sm-manual-title');
          if (titleInput && !titleInput.value.trim() && meta.filename) {
            titleInput.value = meta.filename.replace(/\.[^.]+$/, '');
          }

          // Show source reference for PDFs
          const sourceRefEl = container.querySelector('#sm-manual-source-ref');
          if (sourceRefEl && meta.isPdf && meta.pageRange) {
            sourceRefEl.style.display = 'block';
            sourceRefEl.innerHTML = `
              <div style="background:rgba(67,97,238,0.06);border:1px solid rgba(67,97,238,0.15);border-radius:8px;padding:8px 14px;margin-bottom:14px;">
                <div style="font-size:0.75rem;font-weight:600;color:#4361ee;margin-bottom:2px;">Source Reference</div>
                <div style="font-size:0.8125rem;color:var(--ink-secondary,#555);">
                  ${escapeHtml(meta.filename)} — pp ${meta.pageRange.from}–${meta.pageRange.to} (${meta.extractedPages} of ${meta.totalPages} pages)
                </div>
              </div>
            `;
          }
        }
      });
      manualUploadMount.appendChild(uploadZone.el);
    }

    // Manual save
    const manualSaveBtn = container.querySelector('#sm-manual-save-btn');
    if (manualSaveBtn) {
      manualSaveBtn.addEventListener('click', handleManualSave);
    }
  }

  function renderExpandedView(item) {
    if (!item) {
      expandedItemId = null;
      return '';
    }
    const sc = subjectColor(item.subject);
    const tc = typeColor(item.type);
    return `
      <div class="sm-expanded">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div class="sm-card-tags" style="margin-bottom:8px;">
              <span class="sm-subject-tag" style="background:${sc};">${escapeHtml(item.subject)}</span>
              <span class="sm-type-badge" style="background:${tc.bg};color:${tc.fg};">${typeBadgeLabel(item.type)}</span>
              ${item.level ? `<span class="sm-level-badge">${escapeHtml(item.level)}</span>` : ''}
              <span class="sm-source-badge">${item.source === 'ai' ? 'AI Generated' : 'Manual'}</span>
            </div>
            <div class="sm-expanded-title">${escapeHtml(item.title)}</div>
            <div style="font-size:0.75rem;color:var(--ink-muted,#888);">${item.wordCount || countWords(item.content)} words &middot; Created ${formatDate(item.createdAt)}</div>
          </div>
          <button class="sm-close-btn" id="sm-close-expanded">Close</button>
        </div>
        ${item.sourceRef ? `
          <div style="background:rgba(67,97,238,0.06);border:1px solid rgba(67,97,238,0.15);border-radius:8px;padding:8px 14px;margin-bottom:12px;">
            <span style="font-size:0.75rem;font-weight:600;color:#4361ee;">Source:</span>
            <span style="font-size:0.8125rem;color:var(--ink-secondary,#555);">
              ${escapeHtml(item.sourceRef.filename)}${item.sourceRef.isPdf && item.sourceRef.pageRange ? ` — pp ${item.sourceRef.pageRange.from}–${item.sourceRef.pageRange.to} (${item.sourceRef.extractedPages} of ${item.sourceRef.totalPages} pages)` : ''}
            </span>
          </div>
        ` : ''}
        <div class="sm-expanded-content">${escapeHtml(item.content)}</div>
        ${item.questions ? `
          <div class="sm-expanded-section">
            <div class="sm-expanded-section-title">Suggested Questions</div>
            <div class="sm-expanded-section-body">${escapeHtml(item.questions)}</div>
          </div>
        ` : ''}
        ${item.teacherNotes ? `
          <div class="sm-expanded-section">
            <div class="sm-expanded-section-title">Teacher Notes</div>
            <div class="sm-expanded-section-body">${escapeHtml(item.teacherNotes)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderAiResult() {
    const resultContainer = container.querySelector('#sm-ai-result');
    if (!resultContainer || !generatedResult) return;
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div class="sm-preview-card">
        <div class="sm-preview-title">Generated Stimulus Material</div>
        <div class="sm-field" style="margin-bottom:14px;">
          <label class="sm-label">Title</label>
          <input type="text" id="sm-ai-title" class="sm-input" value="${escapeHtml(generatedResult.title)}" />
        </div>
        <div class="sm-field" style="margin-bottom:14px;">
          <label class="sm-label">Content <span style="font-weight:400;opacity:0.6;">(${countWords(generatedResult.content)} words \u2014 edit as needed)</span></label>
          <textarea id="sm-ai-content" class="sm-textarea" rows="12">${escapeHtml(generatedResult.content)}</textarea>
        </div>
        ${generatedResult.questions ? `
        <div class="sm-field" style="margin-bottom:14px;">
          <label class="sm-label">Suggested Questions</label>
          <textarea id="sm-ai-questions" class="sm-textarea" rows="5">${escapeHtml(generatedResult.questions)}</textarea>
        </div>
        ` : ''}
        ${generatedResult.teacherNotes ? `
        <div class="sm-field" style="margin-bottom:14px;">
          <label class="sm-label">Teacher Notes</label>
          <textarea id="sm-ai-notes" class="sm-textarea" rows="4">${escapeHtml(generatedResult.teacherNotes)}</textarea>
        </div>
        ` : ''}
        <div class="sm-btn-row">
          <button class="sm-save-btn" id="sm-ai-save-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save to Library
          </button>
          <button class="sm-close-btn" id="sm-ai-discard-btn">Discard</button>
        </div>
      </div>
    `;

    // Wire save button for AI result
    const aiSaveBtn = resultContainer.querySelector('#sm-ai-save-btn');
    aiSaveBtn.addEventListener('click', () => {
      const title = resultContainer.querySelector('#sm-ai-title').value.trim();
      const content = resultContainer.querySelector('#sm-ai-content').value.trim();
      const questions = resultContainer.querySelector('#sm-ai-questions')?.value.trim() || '';
      const teacherNotes = resultContainer.querySelector('#sm-ai-notes')?.value.trim() || '';

      if (!title || !content) {
        showToast('Title and content are required.', 'danger');
        return;
      }

      const newItem = {
        id: generateId(),
        title,
        subject: generatedResult.subject,
        level: generatedResult.level,
        type: generatedResult.type,
        content,
        questions,
        teacherNotes,
        wordCount: countWords(content),
        createdAt: Date.now(),
        source: 'ai'
      };

      const lib = getLibrary();
      lib.unshift(newItem);
      saveLibrary(lib);

      generatedResult = null;
      showToast('Stimulus material saved to library!', 'success');
      activeTab = 'browse';
      renderView();
    });

    // Wire discard button
    const discardBtn = resultContainer.querySelector('#sm-ai-discard-btn');
    discardBtn.addEventListener('click', () => {
      generatedResult = null;
      resultContainer.style.display = 'none';
      resultContainer.innerHTML = '';
    });
  }

  async function handleGenerate() {
    const subject = container.querySelector('#sm-subject')?.value || '';
    const level = container.querySelector('#sm-level')?.value || '';
    const type = container.querySelector('#sm-type')?.value || '';
    const wordCount = container.querySelector('#sm-wordcount')?.value || '150-250';
    const topic = container.querySelector('#sm-topic')?.value.trim() || '';
    const instructions = container.querySelector('#sm-instructions')?.value.trim() || '';

    if (!subject) {
      showToast('Please select a subject.', 'danger');
      container.querySelector('#sm-subject')?.focus();
      return;
    }
    if (!type) {
      showToast('Please select a material type.', 'danger');
      container.querySelector('#sm-type')?.focus();
      return;
    }
    if (!topic) {
      showToast('Please enter a topic or theme.', 'danger');
      container.querySelector('#sm-topic')?.focus();
      return;
    }

    const generateBtn = container.querySelector('#sm-generate-btn');
    const loadingEl = container.querySelector('#sm-loading');
    const resultContainer = container.querySelector('#sm-ai-result');

    generateBtn.disabled = true;
    isGenerating = true;
    loadingEl.style.display = 'flex';
    resultContainer.style.display = 'none';
    resultContainer.innerHTML = '';

    const wordCountDesc = wordCount === '400+' ? 'at least 400 words' : `${wordCount} words`;

    const userPrompt = `Generate a ${type} for ${subject} (${level || 'secondary level'}) on the topic: "${topic}".

Requirements:
- Word count: ${wordCountDesc}
- The material should be appropriate for Singapore students at the ${level || 'secondary'} level.
- Include rich, engaging content that provokes thinking and discussion.
${instructions ? `- Additional instructions: ${instructions}` : ''}

Please respond in EXACTLY this format with these section headers:

TITLE: [A concise, descriptive title]

CONTENT:
[The full stimulus material text]

QUESTIONS:
[5-6 suggested comprehension/discussion questions, numbered]

TEACHER_NOTES:
[2-3 paragraphs of teacher notes including: key teaching points, suggested vocabulary to pre-teach, possible discussion angles, differentiation suggestions]`;

    try {
      const systemPrompt = `You are a Stimulus Material Specialist for Singapore schools. You create high-quality, curriculum-aligned reading passages, source texts, case studies, scenarios, and visual descriptions for classroom use.

Your materials should:
- Be age-appropriate and culturally relevant to Singapore students
- Use clear, accessible language appropriate to the specified level
- Include rich content that supports higher-order thinking (analysis, evaluation, synthesis)
- Align with Singapore MOE curriculum frameworks and E21CC competencies
- Be engaging and thought-provoking for students
- Support various pedagogical approaches (discussion, close reading, source analysis)

For Comprehension Passages: Write narrative or expository texts with clear structure, varied sentence types, and vocabulary appropriate to the level.
For Source Texts: Create historically or socially grounded primary/secondary source materials with attributions and context.
For Case Studies: Develop realistic, detailed scenarios that present a problem or situation requiring analysis.
For Scenarios: Write concise situational descriptions that prompt decision-making or ethical reasoning.
For Visual Descriptions: Create detailed ekphrastic or descriptive texts that paint vivid mental images for analysis.

Always respond with well-structured content using the exact format requested. Do not use markdown formatting within the content itself.`;

      const text = await sendChat(
        [{ role: 'user', content: userPrompt }],
        { systemPrompt, temperature: 0.7, maxTokens: 4096 }
      );

      const parsed = parseAiResponse(text, subject, level, type, topic);
      generatedResult = parsed;
      renderAiResult();

    } catch (err) {
      console.error('Stimulus generation error:', err);
      showToast(`Generation failed: ${err.message}`, 'danger');
    } finally {
      generateBtn.disabled = false;
      isGenerating = false;
      loadingEl.style.display = 'none';
    }
  }

  function parseAiResponse(text, subject, level, type, topic) {
    let title = '';
    let content = '';
    let questions = '';
    let teacherNotes = '';

    // Try to extract TITLE
    const titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/);
    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      title = `${type}: ${topic}`;
    }

    // Try to extract CONTENT
    const contentMatch = text.match(/CONTENT:\s*\n([\s\S]*?)(?=\nQUESTIONS:|\nTEACHER_NOTES:|$)/);
    if (contentMatch) {
      content = contentMatch[1].trim();
    } else {
      // Fallback: use everything after title as content
      const afterTitle = text.replace(/TITLE:.*\n?/, '').trim();
      content = afterTitle;
    }

    // Try to extract QUESTIONS
    const questionsMatch = text.match(/QUESTIONS:\s*\n([\s\S]*?)(?=\nTEACHER_NOTES:|$)/);
    if (questionsMatch) {
      questions = questionsMatch[1].trim();
    }

    // Try to extract TEACHER_NOTES
    const notesMatch = text.match(/TEACHER_NOTES:\s*\n([\s\S]*?)$/);
    if (notesMatch) {
      teacherNotes = notesMatch[1].trim();
    }

    return {
      title,
      subject,
      level,
      type,
      content,
      questions,
      teacherNotes,
      wordCount: countWords(content)
    };
  }

  function handleManualSave() {
    const title = container.querySelector('#sm-manual-title')?.value.trim() || '';
    const subject = container.querySelector('#sm-manual-subject')?.value || '';
    const level = container.querySelector('#sm-manual-level')?.value || '';
    const type = container.querySelector('#sm-manual-type')?.value || '';
    const content = container.querySelector('#sm-manual-content')?.value.trim() || '';
    const questions = container.querySelector('#sm-manual-questions')?.value.trim() || '';
    const teacherNotes = container.querySelector('#sm-manual-notes')?.value.trim() || '';

    if (!title) {
      showToast('Please enter a title.', 'danger');
      container.querySelector('#sm-manual-title')?.focus();
      return;
    }
    if (!subject) {
      showToast('Please select a subject.', 'danger');
      container.querySelector('#sm-manual-subject')?.focus();
      return;
    }
    if (!type) {
      showToast('Please select a material type.', 'danger');
      container.querySelector('#sm-manual-type')?.focus();
      return;
    }
    if (!content) {
      showToast('Please enter the stimulus material content.', 'danger');
      container.querySelector('#sm-manual-content')?.focus();
      return;
    }

    const newItem = {
      id: generateId(),
      title,
      subject,
      level,
      type,
      content,
      questions,
      teacherNotes,
      wordCount: countWords(content),
      createdAt: Date.now(),
      source: 'manual'
    };

    // Attach source reference if uploaded from file
    if (manualFileMeta) {
      newItem.sourceRef = {
        filename: manualFileMeta.filename,
        isPdf: manualFileMeta.isPdf,
        totalPages: manualFileMeta.totalPages,
        pageRange: manualFileMeta.pageRange,
        extractedPages: manualFileMeta.extractedPages
      };
    }

    const lib = getLibrary();
    lib.unshift(newItem);
    saveLibrary(lib);

    showToast('Stimulus material saved to library!', 'success');
    generatedResult = null;
    manualFileMeta = null;
    activeTab = 'browse';
    renderView();
  }

  renderView();
}
