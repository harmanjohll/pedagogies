/*
 * Co-Cher Source Analysis Library
 * ================================
 * Library for teachers to curate and create source-based question sets
 * for History, Social Studies, Geography, and General Paper.
 */

import { Store, generateId } from '../state.js';
import { sendChat } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modals.js';
import { createFileUploadZone } from '../components/pdf-upload.js';
import { printSourceAnalysis } from '../components/print-export.js';
import { renderWorkflowBreadcrumb, bindWorkflowClicks } from '../components/workflow-breadcrumb.js';

/* ── Storage helpers ── */
const STORAGE_KEY = 'cocher_source_library';

function getLibrary() {
  const storeLib = Store.get('sourceLibrary');
  if (storeLib && storeLib.length) return storeLib;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLibrary(lib) {
  Store.set('sourceLibrary', lib);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lib));
}

/* ── Colour helpers ── */
function subjectColor(subject) {
  if (subject === 'History') return '#e63946';
  if (subject === 'Social Studies') return '#457b9d';
  if (subject === 'Geography') return '#2a9d8f';
  if (subject === 'General Paper') return '#6a4c93';
  if (subject === 'CCE') return '#e9c46a';
  return '#4361ee';
}

function questionTypeColor(type) {
  if (type === 'Inference') return { bg: '#dbeafe', fg: '#1e40af' };
  if (type === 'Comparison') return { bg: '#fce7f3', fg: '#9d174d' };
  if (type === 'Reliability/Usefulness') return { bg: '#d1fae5', fg: '#065f46' };
  if (type === 'Cross-referencing') return { bg: '#fef3c7', fg: '#92400e' };
  if (type === 'Assertion/Judgement') return { bg: '#ede9fe', fg: '#5b21b6' };
  return { bg: '#f3f4f6', fg: '#374151' };
}

function frameworkLabel(fw) {
  const map = { 'SBQ': 'SBQ', 'SEQ': 'SEQ', 'OPCVL': 'OPCVL', 'CRR': 'CRR' };
  return map[fw] || fw;
}

function sourceTypeIcon(type) {
  if (type === 'Written') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
  if (type === 'Visual') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  if (type === 'Statistical') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
  if (type === 'Cartographic') return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>';
  return '';
}

/* ── Escape HTML ── */
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

/* ── Related Reflections helper ── */
function findRelatedReflections(keywords) {
  if (!keywords || !keywords.trim()) return [];
  const lessons = Store.getLessons();
  const tokens = keywords.toLowerCase().split(/[\s,;]+/).filter(w => w.length > 2);
  if (!tokens.length) return [];
  const results = [];
  for (const lesson of lessons) {
    if (!lesson.reflection) continue;
    const refLower = lesson.reflection.toLowerCase();
    const matched = tokens.filter(t => refLower.includes(t));
    if (matched.length > 0) {
      results.push({
        lessonTitle: lesson.title || 'Untitled Lesson',
        subject: lesson.subject || '',
        reflection: lesson.reflection,
        matchCount: matched.length,
        matchedTerms: matched,
      });
    }
  }
  results.sort((a, b) => b.matchCount - a.matchCount);
  return results.slice(0, 5);
}

function renderRelatedReflections(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const keywords = el.dataset.keywords || '';
  const matches = findRelatedReflections(keywords);
  if (!matches.length) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="padding:14px;border:1px solid rgba(139,92,246,0.25);border-radius:10px;background:rgba(139,92,246,0.04);margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span style="font-size:0.8125rem;font-weight:700;color:#7c3aed;">Related Past Reflections</span>
        <span style="font-size:0.6875rem;color:var(--ink-muted);">(${matches.length} found)</span>
      </div>
      ${matches.map((m, i) => `
        <div class="sa-reflection-card" data-ref-idx="${i}" style="padding:10px 12px;background:var(--bg-card,#fff);border:1px solid var(--border,#e2e5ea);border-radius:8px;margin-bottom:6px;position:relative;">
          <button class="sa-dismiss-ref" data-dismiss-ref="${i}" style="position:absolute;top:6px;right:8px;background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:0.875rem;line-height:1;" title="Dismiss">&times;</button>
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink);margin-bottom:3px;">${esc(m.lessonTitle)}${m.subject ? ` <span style="font-size:0.625rem;color:var(--ink-muted);">(${esc(m.subject)})</span>` : ''}</div>
          <div style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.5;font-style:italic;">"${esc(m.reflection.length > 200 ? m.reflection.slice(0, 200) + '...' : m.reflection)}"</div>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">
            ${m.matchedTerms.map(t => `<span style="font-size:0.5625rem;padding:1px 6px;border-radius:8px;background:rgba(139,92,246,0.12);color:#7c3aed;font-weight:600;">${esc(t)}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  // Wire dismiss buttons
  el.querySelectorAll('.sa-dismiss-ref').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const card = btn.closest('.sa-reflection-card');
      if (card) card.remove();
      // Hide container if no cards left
      if (!el.querySelectorAll('.sa-reflection-card').length) {
        el.style.display = 'none';
      }
    });
  });
}

function triggerReflectionSearch(containerId, ...inputValues) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const combined = inputValues.filter(Boolean).join(' ');
  el.dataset.keywords = combined;
  renderRelatedReflections(containerId);
}

/* ── Main render ── */
export function render(container) {
  let activeTab = 'browse';
  let expandedId = null;
  let createMode = 'ai';
  let generatedPreview = null;
  let manualSources = [{ title: '', type: 'Written', provenance: '', content: '' }];
  let manualQuestions = [{ type: 'Inference', marks: 5, question: '', skill: '' }];
  let manualFileMeta = null;

  function renderView() {
    const library = getLibrary();

    container.innerHTML = `
      <style>
        .sa-tabs {
          display: flex; gap: 4px; margin-bottom: 24px;
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          border-radius: 10px; padding: 4px; width: fit-content;
        }
        .dark .sa-tabs { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .sa-tab {
          padding: 8px 20px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
          cursor: pointer; border: none; background: transparent; color: var(--ink-muted, #777);
          transition: all 0.15s;
        }
        .sa-tab:hover { color: var(--ink, #1a1a2e); background: var(--bg-subtle, #f8f9fa); }
        .dark .sa-tab:hover { color: var(--ink, #e8e8f0); background: var(--bg-subtle, #252540); }
        .sa-tab.active { background: #4361ee; color: #fff; }
        .sa-tab.active:hover { background: #3a56d4; color: #fff; }

        .sa-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;
        }
        .sa-card {
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px; padding: 20px; display: flex; flex-direction: column;
          transition: box-shadow 0.2s, transform 0.15s; cursor: pointer;
        }
        .sa-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); transform: translateY(-2px); }
        .dark .sa-card { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .dark .sa-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .sa-card-title {
          font-size: 1rem; font-weight: 700; color: var(--ink, #1a1a2e);
          margin-bottom: 8px; line-height: 1.3;
        }
        .dark .sa-card-title { color: var(--ink, #e8e8f0); }
        .sa-card-meta {
          font-size: 0.75rem; color: var(--ink-muted, #888); margin-bottom: 12px;
        }
        .sa-badge {
          display: inline-block; font-size: 0.625rem; font-weight: 600; padding: 2px 8px;
          border-radius: 12px; text-transform: uppercase; letter-spacing: 0.03em; margin-right: 4px; margin-bottom: 4px;
        }
        .sa-subject-tag {
          display: inline-block; font-size: 0.6875rem; font-weight: 600; color: #fff;
          padding: 3px 10px; border-radius: 20px; text-transform: uppercase;
          letter-spacing: 0.04em; margin-right: 6px; margin-bottom: 6px;
        }
        .sa-framework-tag {
          display: inline-block; font-size: 0.625rem; font-weight: 700; padding: 2px 8px;
          border-radius: 4px; background: rgba(67,97,238,0.12); color: #4361ee;
          margin-right: 4px; margin-bottom: 4px; letter-spacing: 0.03em;
        }
        .dark .sa-framework-tag { background: rgba(67,97,238,0.2); }
        .sa-card-footer {
          display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 12px;
          border-top: 1px solid var(--border-light, #f0f0f4);
        }
        .dark .sa-card-footer { border-top-color: var(--border, #2e2e3e); }
        .sa-delete-btn {
          background: none; border: 1px solid var(--border, #e2e5ea); color: var(--ink-muted, #888);
          padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .sa-delete-btn:hover { color: #dc3545; border-color: #dc3545; }
        .dark .sa-delete-btn { border-color: var(--border, #3e3e4e); }
        .sa-source-count {
          font-size: 0.75rem; color: var(--ink-secondary, #555); font-weight: 500;
        }
        .dark .sa-source-count { color: var(--ink-secondary, #aaa); }

        .sa-expanded {
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px; padding: 28px; margin-bottom: 24px;
        }
        .dark .sa-expanded { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .sa-expanded-title {
          font-size: 1.25rem; font-weight: 700; color: var(--ink, #1a1a2e); margin-bottom: 4px;
        }
        .dark .sa-expanded-title { color: var(--ink, #e8e8f0); }
        .sa-expanded-meta {
          font-size: 0.8125rem; color: var(--ink-muted, #888); margin-bottom: 20px;
        }
        .sa-source-block {
          background: var(--bg-subtle, #f8f9fa); border: 1px solid var(--border-light, #f0f0f4);
          border-radius: 10px; padding: 16px; margin-bottom: 14px;
        }
        .dark .sa-source-block { background: var(--bg-subtle, #16161e); border-color: var(--border, #2e2e3e); }
        .sa-source-header {
          display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
        }
        .sa-source-title {
          font-size: 0.875rem; font-weight: 600; color: var(--ink, #1a1a2e);
        }
        .dark .sa-source-title { color: var(--ink, #e8e8f0); }
        .sa-source-provenance {
          font-size: 0.75rem; color: var(--ink-muted, #888); font-style: italic; margin-bottom: 8px;
        }
        .sa-source-content {
          font-size: 0.8125rem; color: var(--ink-secondary, #555); line-height: 1.6;
          white-space: pre-wrap; word-break: break-word;
        }
        .dark .sa-source-content { color: var(--ink-secondary, #aaa); }
        .sa-question-block {
          padding: 14px 16px; border-left: 3px solid #4361ee;
          background: var(--bg-subtle, #f8f9fa); border-radius: 0 8px 8px 0; margin-bottom: 10px;
        }
        .dark .sa-question-block { background: var(--bg-subtle, #16161e); }
        .sa-question-text {
          font-size: 0.875rem; color: var(--ink, #1a1a2e); line-height: 1.5; margin-bottom: 6px;
        }
        .dark .sa-question-text { color: var(--ink, #e8e8f0); }
        .sa-question-meta {
          font-size: 0.6875rem; color: var(--ink-muted, #888);
        }
        .sa-back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: none; border: 1px solid var(--border, #e2e5ea); color: var(--ink-secondary, #555);
          padding: 7px 16px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
          cursor: pointer; margin-bottom: 16px; transition: all 0.15s;
        }
        .sa-back-btn:hover { border-color: #4361ee; color: #4361ee; }
        .dark .sa-back-btn { border-color: var(--border, #3e3e4e); color: var(--ink-secondary, #aaa); }

        .sa-form-section {
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px; padding: 24px; margin-bottom: 20px;
        }
        .dark .sa-form-section { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .sa-form-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;
        }
        @media (max-width: 600px) { .sa-form-grid { grid-template-columns: 1fr; } }
        .sa-field {
          display: flex; flex-direction: column; gap: 4px;
        }
        .sa-label {
          font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary, #555);
          text-transform: uppercase; letter-spacing: 0.03em;
        }
        .dark .sa-label { color: var(--ink-secondary, #aaa); }
        .sa-select, .sa-input, .sa-textarea {
          padding: 8px 12px; border: 1px solid var(--border, #e2e5ea); border-radius: 8px;
          font-size: 0.8125rem; font-family: inherit;
          background: var(--bg, #fff); color: var(--ink, #1a1a2e); transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .sa-select:focus, .sa-input:focus, .sa-textarea:focus {
          outline: none; border-color: #4361ee; box-shadow: 0 0 0 3px rgba(67,97,238,0.12);
        }
        .dark .sa-select, .dark .sa-input, .dark .sa-textarea {
          background: var(--bg-subtle, #16161e); color: var(--ink, #e8e8f0);
          border-color: var(--border, #3e3e4e);
        }
        .sa-textarea { resize: vertical; min-height: 80px; line-height: 1.5; width: 100%; }
        .sa-checkbox-group {
          display: flex; flex-wrap: wrap; gap: 10px; margin-top: 2px;
        }
        .sa-checkbox-label {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 0.8125rem; color: var(--ink, #1a1a2e); cursor: pointer;
          padding: 4px 10px; border: 1px solid var(--border, #e2e5ea); border-radius: 6px;
          transition: all 0.15s; user-select: none;
        }
        .sa-checkbox-label:hover { border-color: #4361ee; }
        .sa-checkbox-label.checked { background: rgba(67,97,238,0.08); border-color: #4361ee; color: #4361ee; }
        .dark .sa-checkbox-label { color: var(--ink, #e8e8f0); border-color: var(--border, #3e3e4e); }
        .dark .sa-checkbox-label.checked { background: rgba(67,97,238,0.15); }
        .sa-checkbox-label input { display: none; }
        .sa-generate-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #4361ee; color: #fff; border: none; padding: 10px 24px;
          border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .sa-generate-btn:hover { background: #3a56d4; }
        .sa-generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .sa-save-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #22c55e; color: #fff; border: none; padding: 10px 24px;
          border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
          transition: background 0.15s;
        }
        .sa-save-btn:hover { background: #16a34a; }
        .sa-secondary-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: none; border: 1px solid var(--border, #e2e5ea); color: var(--ink-secondary, #555);
          padding: 10px 20px; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .sa-secondary-btn:hover { border-color: #4361ee; color: #4361ee; }
        .dark .sa-secondary-btn { border-color: var(--border, #3e3e4e); color: var(--ink-secondary, #aaa); }
        .sa-loading {
          display: flex; align-items: center; gap: 10px; margin-top: 12px;
          font-size: 0.875rem; color: var(--ink-muted, #777);
        }
        .sa-spinner {
          width: 20px; height: 20px; border: 2.5px solid var(--border, #e2e5ea);
          border-top-color: #4361ee; border-radius: 50%;
          animation: saSpin 0.7s linear infinite;
        }
        @keyframes saSpin { to { transform: rotate(360deg); } }
        .sa-mode-toggle {
          display: flex; gap: 4px; margin-bottom: 16px;
          background: var(--bg-subtle, #f8f9fa); border-radius: 8px; padding: 3px; width: fit-content;
        }
        .dark .sa-mode-toggle { background: var(--bg-subtle, #16161e); }
        .sa-mode-btn {
          padding: 6px 16px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;
          cursor: pointer; border: none; background: transparent; color: var(--ink-muted, #777);
          transition: all 0.15s;
        }
        .sa-mode-btn.active { background: var(--bg-card, #fff); color: var(--ink, #1a1a2e); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .dark .sa-mode-btn.active { background: var(--bg-card, #1e1e2e); color: var(--ink, #e8e8f0); }
        .sa-manual-source {
          background: var(--bg-subtle, #f8f9fa); border: 1px solid var(--border-light, #f0f0f4);
          border-radius: 10px; padding: 16px; margin-bottom: 12px;
        }
        .dark .sa-manual-source { background: var(--bg-subtle, #16161e); border-color: var(--border, #2e2e3e); }
        .sa-manual-question {
          background: var(--bg-subtle, #f8f9fa); border: 1px solid var(--border-light, #f0f0f4);
          border-radius: 10px; padding: 16px; margin-bottom: 12px;
        }
        .dark .sa-manual-question { background: var(--bg-subtle, #16161e); border-color: var(--border, #2e2e3e); }
        .sa-remove-btn {
          background: none; border: none; color: var(--ink-muted, #888); cursor: pointer;
          font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; transition: color 0.15s;
        }
        .sa-remove-btn:hover { color: #dc3545; }
        .sa-add-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: none; border: 1px dashed var(--border, #d0d5dd); color: var(--ink-muted, #777);
          padding: 8px 16px; border-radius: 8px; font-size: 0.8125rem; cursor: pointer;
          transition: all 0.15s; width: 100%; justify-content: center;
        }
        .sa-add-btn:hover { border-color: #4361ee; color: #4361ee; }
        .sa-empty {
          text-align: center; padding: 48px 20px; color: var(--ink-muted, #888);
        }
        .sa-empty-icon { font-size: 2rem; margin-bottom: 12px; opacity: 0.4; }
        .sa-mark-scheme {
          background: var(--bg-subtle, #f8f9fa); border: 1px solid var(--border-light, #f0f0f4);
          border-radius: 10px; padding: 16px; margin-top: 16px; white-space: pre-wrap;
          font-size: 0.8125rem; color: var(--ink-secondary, #555); line-height: 1.6;
        }
        .dark .sa-mark-scheme { background: var(--bg-subtle, #16161e); border-color: var(--border, #2e2e3e); color: var(--ink-secondary, #aaa); }
        .sa-notes {
          background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px;
          padding: 14px 16px; margin-top: 12px; font-size: 0.8125rem; color: #92400e; line-height: 1.5;
          white-space: pre-wrap;
        }
        .dark .sa-notes { background: rgba(254,243,199,0.08); border-color: rgba(253,230,138,0.2); color: #fbbf24; }
        .sa-section-label {
          font-size: 0.9375rem; font-weight: 700; color: var(--ink, #1a1a2e);
          margin: 20px 0 12px; display: flex; align-items: center; gap: 8px;
        }
        .dark .sa-section-label { color: var(--ink, #e8e8f0); }
        .sa-divider {
          margin: 24px 0; border: none; border-top: 1px solid var(--border-light, #f0f0f4);
        }
        .dark .sa-divider { border-top-color: var(--border, #2e2e3e); }
        .sa-preview-actions {
          display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px;
        }
      </style>

      <div class="main-scroll">
        <div class="page-container">

          ${renderWorkflowBreadcrumb('resources')}

          <div class="page-header" style="margin-bottom: 20px;">
            <div>
              <h1 class="page-title" style="font-size:1.625rem;font-weight:700;color:var(--ink, #1a1a2e);margin:0 0 4px;">Source Analysis Library</h1>
              <p class="page-subtitle" style="font-size:0.9375rem;color:var(--ink-muted, #777);margin:0;">Curate and create source-based question sets for Humanities and GP</p>
            </div>
          </div>

          <div class="sa-tabs">
            <button class="sa-tab ${activeTab === 'browse' ? 'active' : ''}" data-tab="browse">Browse Library</button>
            <button class="sa-tab ${activeTab === 'create' ? 'active' : ''}" data-tab="create">Create New</button>
          </div>

          <div id="sa-tab-content">
            ${activeTab === 'browse' ? renderBrowseTab(library) : renderCreateTab()}
          </div>

        </div>
      </div>
    `;

    bindEvents();
  }

  /* ── Browse tab ── */
  function renderBrowseTab(library) {
    if (expandedId) {
      const item = library.find(i => i.id === expandedId);
      if (!item) { expandedId = null; return renderBrowseTab(library); }
      return renderExpandedView(item);
    }

    if (library.length === 0) {
      return `
        <div class="sa-empty">
          <div class="sa-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <div style="font-size:1rem;font-weight:600;margin-bottom:6px;color:var(--ink, #1a1a2e);">No source analysis sets yet</div>
          <div style="font-size:0.8125rem;">Switch to the <strong>Create New</strong> tab to build your first set.</div>
        </div>
      `;
    }

    return `
      <div class="sa-grid">
        ${library.map(item => {
          const qTypes = [...new Set(item.questions.map(q => q.type))];
          const srcCount = item.sources ? item.sources.length : 0;
          const qCount = item.questions ? item.questions.length : 0;
          return `
            <div class="sa-card" data-expand="${item.id}">
              <div style="margin-bottom:8px;">
                <span class="sa-subject-tag" style="background:${subjectColor(item.subject)};">${esc(item.subject)}</span>
                ${item.framework ? `<span class="sa-framework-tag">${esc(frameworkLabel(item.framework))}</span>` : ''}
              </div>
              <div class="sa-card-title">${esc(item.title)}</div>
              <div class="sa-card-meta">${esc(item.topic || '')}${item.level ? ' &middot; ' + esc(item.level) : ''}</div>
              <div style="margin-bottom:10px;">
                ${qTypes.map(t => {
                  const c = questionTypeColor(t);
                  return `<span class="sa-badge" style="background:${c.bg};color:${c.fg};">${esc(t)}</span>`;
                }).join('')}
              </div>
              <div class="sa-card-footer">
                <span class="sa-source-count">${srcCount} source${srcCount !== 1 ? 's' : ''}, ${qCount} question${qCount !== 1 ? 's' : ''}</span>
                <button class="sa-delete-btn" data-delete="${item.id}">Delete</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ── Expanded single-item view ── */
  function renderExpandedView(item) {
    const qTypes = [...new Set(item.questions.map(q => q.type))];
    return `
      <button class="sa-back-btn" id="sa-back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Library
      </button>
      <div class="sa-expanded">
        <div style="margin-bottom:8px;">
          <span class="sa-subject-tag" style="background:${subjectColor(item.subject)};">${esc(item.subject)}</span>
          ${item.framework ? `<span class="sa-framework-tag">${esc(frameworkLabel(item.framework))}</span>` : ''}
          <span class="sa-badge" style="background:#f3f4f6;color:#374151;">${item.source === 'ai' ? 'AI Generated' : 'Manual'}</span>
        </div>
        <div class="sa-expanded-title">${esc(item.title)}</div>
        <div class="sa-expanded-meta">
          ${esc(item.topic || '')}${item.level ? ' &middot; ' + esc(item.level) : ''}
          &middot; Created ${new Date(item.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        <div class="sa-section-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Sources
        </div>
        ${(item.sources || []).map((src, i) => `
          <div class="sa-source-block">
            <div class="sa-source-header">
              ${sourceTypeIcon(src.type)}
              <span class="sa-source-title">Source ${String.fromCharCode(65 + i)}: ${esc(src.title)}</span>
              <span class="sa-badge" style="background:#f3f4f6;color:#374151;">${esc(src.type)}</span>
            </div>
            ${src.provenance ? `<div class="sa-source-provenance">${esc(src.provenance)}</div>` : ''}
            <div class="sa-source-content">${esc(src.content)}</div>
          </div>
        `).join('')}

        <div class="sa-section-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Questions
        </div>
        ${(item.questions || []).map((q, i) => {
          const c = questionTypeColor(q.type);
          return `
            <div class="sa-question-block">
              <div class="sa-question-text"><strong>${i + 1}.</strong> ${esc(q.question)}</div>
              <div class="sa-question-meta">
                <span class="sa-badge" style="background:${c.bg};color:${c.fg};">${esc(q.type)}</span>
                ${q.marks ? `<span>[${q.marks} marks]</span>` : ''}
                ${q.skill ? `<span>&middot; ${esc(q.skill)}</span>` : ''}
                ${q.e21cc ? `<span>&middot; E21CC: ${esc(q.e21cc)}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}

        ${item.markScheme ? `
          <div class="sa-section-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            Mark Scheme
          </div>
          <div class="sa-mark-scheme">${esc(item.markScheme)}</div>
        ` : ''}

        ${item.teacherNotes ? `
          <div class="sa-section-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Teacher Notes
          </div>
          <div class="sa-notes">${esc(item.teacherNotes)}</div>
        ` : ''}

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid var(--border-light,#f0f0f4);">
          <button class="sa-secondary-btn" data-print="student">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Student Copy
          </button>
          <button class="sa-secondary-btn" data-print="teacher">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Teacher Copy
          </button>
          <button class="sa-secondary-btn" data-action="share-placeholder" style="opacity:0.5;cursor:default;" title="Coming soon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share with Department
          </button>
        </div>
      </div>
    `;
  }

  /* ── Create tab ── */
  function renderCreateTab() {
    return `
      <div class="sa-mode-toggle">
        <button class="sa-mode-btn ${createMode === 'ai' ? 'active' : ''}" data-mode="ai">AI Generate</button>
        <button class="sa-mode-btn ${createMode === 'manual' ? 'active' : ''}" data-mode="manual">Manual Entry</button>
      </div>

      ${createMode === 'ai' ? renderAIForm() : renderManualForm()}
    `;
  }

  /* ── AI generation form ── */
  function renderAIForm() {
    if (generatedPreview) {
      return renderPreview();
    }

    return `
      <div class="sa-form-section">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <div style="font-size:1.125rem;font-weight:700;color:var(--ink, #1a1a2e);">Generate Source Analysis Set</div>
        </div>

        <div class="sa-form-grid">
          <div class="sa-field">
            <label class="sa-label">Subject</label>
            <select class="sa-select" id="sa-subject">
              <option value="">Select...</option>
              <option value="History">History</option>
              <option value="Social Studies">Social Studies</option>
              <option value="Geography">Geography</option>
              <option value="General Paper">General Paper</option>
              <option value="CCE">CCE</option>
            </select>
          </div>
          <div class="sa-field">
            <label class="sa-label">Level</label>
            <select class="sa-select" id="sa-level">
              <option value="">Select...</option>
              <option value="Sec 1">Sec 1</option>
              <option value="Sec 2">Sec 2</option>
              <option value="Sec 3">Sec 3</option>
              <option value="Sec 4">Sec 4</option>
              <option value="Sec 5">Sec 5</option>
              <option value="JC 1">JC 1</option>
              <option value="JC 2">JC 2</option>
            </select>
          </div>
        </div>

        <div class="sa-field" style="margin-bottom:14px;">
          <label class="sa-label">Topic / Theme</label>
          <input type="text" class="sa-input" id="sa-topic" placeholder="e.g. Fall of Singapore, Globalisation, Climate Change" />
        </div>

        <div id="sa-ai-reflections" style="display:none;"></div>

        <div class="sa-field" style="margin-bottom:14px;">
          <label class="sa-label">Source Types to Include</label>
          <div class="sa-checkbox-group" id="sa-source-types">
            ${['Written', 'Visual', 'Statistical', 'Cartographic'].map(t => `
              <label class="sa-checkbox-label">
                <input type="checkbox" value="${t}" ${t === 'Written' ? 'checked' : ''} />
                ${sourceTypeIcon(t)} ${t}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="sa-form-grid">
          <div class="sa-field">
            <label class="sa-label">Number of Sources</label>
            <select class="sa-select" id="sa-num-sources">
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
            </select>
          </div>
          <div class="sa-field">
            <label class="sa-label">Analysis Framework</label>
            <select class="sa-select" id="sa-framework">
              <option value="SBQ">SBQ - Source-Based Questions</option>
              <option value="SEQ">SEQ - Structured Essay</option>
              <option value="OPCVL">OPCVL</option>
              <option value="CRR">CRR</option>
            </select>
          </div>
        </div>

        <div class="sa-field" style="margin-bottom:14px;margin-top:14px;">
          <label class="sa-label">Question Types to Include</label>
          <div class="sa-checkbox-group" id="sa-question-types">
            ${['Inference', 'Comparison', 'Reliability/Usefulness', 'Cross-referencing', 'Assertion/Judgement'].map(t => `
              <label class="sa-checkbox-label">
                <input type="checkbox" value="${t}" ${(t === 'Inference' || t === 'Comparison') ? 'checked' : ''} />
                ${t}
              </label>
            `).join('')}
          </div>
        </div>

        <div class="sa-field" style="margin-bottom:14px;">
          <label class="sa-label">Additional Context <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
          <textarea class="sa-textarea" id="sa-context" rows="3" placeholder="Any specific focus, historical period, source provenance requirements, etc."></textarea>
        </div>

        <button class="sa-generate-btn" id="sa-generate-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Generate with AI
        </button>
        <div id="sa-loading" style="display:none;" class="sa-loading">
          <div class="sa-spinner"></div>
          <span>Generating source analysis set... This may take a moment.</span>
        </div>
      </div>
    `;
  }

  /* ── Preview generated content ── */
  function renderPreview() {
    const p = generatedPreview;
    return `
      <div class="sa-form-section">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <div style="font-size:1.125rem;font-weight:700;color:var(--ink, #1a1a2e);">Preview Generated Set</div>
        </div>
        <div style="font-size:0.8125rem;color:var(--ink-muted, #777);margin-bottom:20px;">Review the content below. You can edit the title and notes before saving.</div>

        <div class="sa-field" style="margin-bottom:14px;">
          <label class="sa-label">Title</label>
          <input type="text" class="sa-input" id="sa-preview-title" value="${esc(p.title)}" />
        </div>

        <div style="margin-bottom:8px;">
          <span class="sa-subject-tag" style="background:${subjectColor(p.subject)};">${esc(p.subject)}</span>
          ${p.framework ? `<span class="sa-framework-tag">${esc(frameworkLabel(p.framework))}</span>` : ''}
          <span class="sa-badge" style="background:#f3f4f6;color:#374151;">${esc(p.level)}</span>
        </div>

        <div class="sa-section-label">Sources</div>
        ${(p.sources || []).map((src, i) => `
          <div class="sa-source-block">
            <div class="sa-source-header">
              ${sourceTypeIcon(src.type)}
              <span class="sa-source-title">Source ${String.fromCharCode(65 + i)}: ${esc(src.title)}</span>
              <span class="sa-badge" style="background:#f3f4f6;color:#374151;">${esc(src.type)}</span>
            </div>
            ${src.provenance ? `<div class="sa-source-provenance">${esc(src.provenance)}</div>` : ''}
            <div class="sa-source-content">${esc(src.content)}</div>
          </div>
        `).join('')}

        <div class="sa-section-label">Questions</div>
        ${(p.questions || []).map((q, i) => {
          const c = questionTypeColor(q.type);
          return `
            <div class="sa-question-block">
              <div class="sa-question-text"><strong>${i + 1}.</strong> ${esc(q.question)}</div>
              <div class="sa-question-meta">
                <span class="sa-badge" style="background:${c.bg};color:${c.fg};">${esc(q.type)}</span>
                ${q.marks ? `<span>[${q.marks} marks]</span>` : ''}
                ${q.skill ? `<span>&middot; ${esc(q.skill)}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}

        ${p.markScheme ? `
          <div class="sa-section-label">Mark Scheme</div>
          <div class="sa-mark-scheme">${esc(p.markScheme)}</div>
        ` : ''}

        <div class="sa-field" style="margin-top:16px;">
          <label class="sa-label">Teacher Notes <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
          <textarea class="sa-textarea" id="sa-preview-notes" rows="3" placeholder="Add any teaching notes, differentiation strategies, etc.">${esc(p.teacherNotes || '')}</textarea>
        </div>

        <div class="sa-preview-actions">
          <button class="sa-save-btn" id="sa-save-preview">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save to Library
          </button>
          <button class="sa-secondary-btn" id="sa-discard-preview">Discard</button>
          <button class="sa-generate-btn" id="sa-regenerate" style="background:#6366f1;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Regenerate
          </button>
        </div>
        <div id="sa-loading" style="display:none;" class="sa-loading">
          <div class="sa-spinner"></div>
          <span>Regenerating... This may take a moment.</span>
        </div>
      </div>
    `;
  }

  /* ── Manual entry form ── */
  function renderManualForm() {
    return `
      <div class="sa-form-section">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <div style="font-size:1.125rem;font-weight:700;color:var(--ink, #1a1a2e);">Manual Source Entry</div>
        </div>

        <div class="sa-form-grid">
          <div class="sa-field">
            <label class="sa-label">Subject</label>
            <select class="sa-select" id="sa-manual-subject">
              <option value="">Select...</option>
              <option value="History">History</option>
              <option value="Social Studies">Social Studies</option>
              <option value="Geography">Geography</option>
              <option value="General Paper">General Paper</option>
              <option value="CCE">CCE</option>
            </select>
          </div>
          <div class="sa-field">
            <label class="sa-label">Level</label>
            <select class="sa-select" id="sa-manual-level">
              <option value="">Select...</option>
              <option value="Sec 1">Sec 1</option>
              <option value="Sec 2">Sec 2</option>
              <option value="Sec 3">Sec 3</option>
              <option value="Sec 4">Sec 4</option>
              <option value="Sec 5">Sec 5</option>
              <option value="JC 1">JC 1</option>
              <option value="JC 2">JC 2</option>
            </select>
          </div>
        </div>

        <div class="sa-form-grid">
          <div class="sa-field">
            <label class="sa-label">Title</label>
            <input type="text" class="sa-input" id="sa-manual-title" placeholder="e.g. Fall of Singapore SBQ Practice" />
          </div>
          <div class="sa-field">
            <label class="sa-label">Topic / Theme</label>
            <input type="text" class="sa-input" id="sa-manual-topic" placeholder="e.g. Japanese Occupation" />
          </div>
        </div>

        <div id="sa-manual-reflections" style="display:none;"></div>

        <hr class="sa-divider" />

        <div class="sa-field" style="margin-bottom:16px;">
          <label class="sa-label">Upload Source File (.txt, .md, .csv, .pdf)</label>
          <div id="sa-manual-upload-mount"></div>
          <div id="sa-manual-source-ref" style="display:none;"></div>
        </div>

        <div class="sa-section-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Sources
        </div>
        <div id="sa-manual-sources">
          ${manualSources.map((src, i) => renderManualSourceEntry(src, i)).join('')}
        </div>
        <button class="sa-add-btn" id="sa-add-source" style="margin-bottom:20px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Source
        </button>

        <div class="sa-section-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Questions
        </div>
        <div id="sa-manual-questions">
          ${manualQuestions.map((q, i) => renderManualQuestionEntry(q, i)).join('')}
        </div>
        <button class="sa-add-btn" id="sa-add-question" style="margin-bottom:20px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Question
        </button>

        <div class="sa-field" style="margin-bottom:14px;">
          <label class="sa-label">Teacher Notes <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
          <textarea class="sa-textarea" id="sa-manual-notes" rows="3" placeholder="Add any teaching notes...">${esc('')}</textarea>
        </div>

        <button class="sa-save-btn" id="sa-save-manual">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save to Library
        </button>
      </div>
    `;
  }

  function renderManualSourceEntry(src, index) {
    return `
      <div class="sa-manual-source" data-source-index="${index}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:0.8125rem;font-weight:600;color:var(--ink, #1a1a2e);">Source ${String.fromCharCode(65 + index)}</span>
          ${index > 0 ? `<button class="sa-remove-btn" data-remove-source="${index}">Remove</button>` : ''}
        </div>
        <div class="sa-form-grid">
          <div class="sa-field">
            <label class="sa-label">Source Title</label>
            <input type="text" class="sa-input sa-src-title" data-src-idx="${index}" value="${esc(src.title)}" placeholder="e.g. Newspaper report on..." />
          </div>
          <div class="sa-field">
            <label class="sa-label">Source Type</label>
            <select class="sa-select sa-src-type" data-src-idx="${index}">
              ${['Written', 'Visual', 'Statistical', 'Cartographic'].map(t =>
                `<option value="${t}" ${src.type === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="sa-field" style="margin-top:10px;">
          <label class="sa-label">Provenance</label>
          <input type="text" class="sa-input sa-src-prov" data-src-idx="${index}" value="${esc(src.provenance)}" placeholder="e.g. Adapted from The Straits Times, 15 Feb 1942" />
        </div>
        <div class="sa-field" style="margin-top:10px;">
          <label class="sa-label">Source Content</label>
          <textarea class="sa-textarea sa-src-content" data-src-idx="${index}" rows="4" placeholder="Paste or type the source text here...">${esc(src.content)}</textarea>
        </div>
      </div>
    `;
  }

  function renderManualQuestionEntry(q, index) {
    return `
      <div class="sa-manual-question" data-question-index="${index}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:0.8125rem;font-weight:600;color:var(--ink, #1a1a2e);">Question ${index + 1}</span>
          ${index > 0 ? `<button class="sa-remove-btn" data-remove-question="${index}">Remove</button>` : ''}
        </div>
        <div class="sa-form-grid">
          <div class="sa-field">
            <label class="sa-label">Question Type</label>
            <select class="sa-select sa-q-type" data-q-idx="${index}">
              ${['Inference', 'Comparison', 'Reliability/Usefulness', 'Cross-referencing', 'Assertion/Judgement'].map(t =>
                `<option value="${t}" ${q.type === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
          </div>
          <div class="sa-field">
            <label class="sa-label">Marks</label>
            <select class="sa-select sa-q-marks" data-q-idx="${index}">
              ${[2, 3, 4, 5, 6, 7, 8, 10, 12].map(m =>
                `<option value="${m}" ${q.marks === m ? 'selected' : ''}>${m}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="sa-field" style="margin-top:10px;">
          <label class="sa-label">Question</label>
          <textarea class="sa-textarea sa-q-text" data-q-idx="${index}" rows="2" placeholder="Write your question here...">${esc(q.question)}</textarea>
        </div>
        <div class="sa-field" style="margin-top:10px;">
          <label class="sa-label">Skill Tested <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
          <input type="text" class="sa-input sa-q-skill" data-q-idx="${index}" value="${esc(q.skill)}" placeholder="e.g. Making inferences from source" />
        </div>
      </div>
    `;
  }

  /* ── Collect manual form data into state ── */
  function syncManualSourcesFromDOM() {
    const srcEls = container.querySelectorAll('.sa-manual-source');
    manualSources = Array.from(srcEls).map((el, i) => ({
      title: (el.querySelector('.sa-src-title') || {}).value || '',
      type: (el.querySelector('.sa-src-type') || {}).value || 'Written',
      provenance: (el.querySelector('.sa-src-prov') || {}).value || '',
      content: (el.querySelector('.sa-src-content') || {}).value || '',
    }));
  }

  function syncManualQuestionsFromDOM() {
    const qEls = container.querySelectorAll('.sa-manual-question');
    manualQuestions = Array.from(qEls).map((el, i) => ({
      type: (el.querySelector('.sa-q-type') || {}).value || 'Inference',
      marks: parseInt((el.querySelector('.sa-q-marks') || {}).value || '5', 10),
      question: (el.querySelector('.sa-q-text') || {}).value || '',
      skill: (el.querySelector('.sa-q-skill') || {}).value || '',
    }));
  }

  /* ── Bind all events ── */
  function bindEvents() {
    // Workflow breadcrumb clicks
    bindWorkflowClicks(container);

    // Tab switching
    container.querySelectorAll('.sa-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        expandedId = null;
        renderView();
      });
    });

    // Mode toggle (AI / Manual)
    container.querySelectorAll('.sa-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        createMode = btn.dataset.mode;
        renderView();
      });
    });

    // Checkbox label toggle styling
    container.querySelectorAll('.sa-checkbox-label').forEach(label => {
      const cb = label.querySelector('input[type="checkbox"]');
      if (cb) {
        if (cb.checked) label.classList.add('checked');
        label.addEventListener('click', (e) => {
          if (e.target === cb) return;
          cb.checked = !cb.checked;
          label.classList.toggle('checked', cb.checked);
          e.preventDefault();
        });
        cb.addEventListener('change', () => {
          label.classList.toggle('checked', cb.checked);
        });
      }
    });

    // Back button in expanded view
    const backBtn = container.querySelector('#sa-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        expandedId = null;
        renderView();
      });
    }

    // Print buttons
    container.querySelectorAll('[data-print]').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = getLibrary().find(i => i.id === expandedId);
        if (item) printSourceAnalysis(item, btn.dataset.print);
      });
    });

    // Share placeholder
    container.querySelector('[data-action="share-placeholder"]')?.addEventListener('click', () => {
      showToast('Sharing requires a connected Co-Cher workspace. Contact your school administrator to set up department sharing.', 'info');
    });

    // Card expand
    container.querySelectorAll('[data-expand]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.sa-delete-btn')) return;
        expandedId = card.dataset.expand;
        renderView();
      });
    });

    // Delete buttons
    container.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.delete;
        const confirmed = await confirmDialog({
          title: 'Delete Source Analysis Set',
          message: 'Are you sure you want to delete this set? This cannot be undone.',
          confirmLabel: 'Delete',
        });
        if (!confirmed) return;
        const lib = getLibrary().filter(item => item.id !== id);
        saveLibrary(lib);
        showToast('Source analysis set deleted', 'default');
        renderView();
      });
    });

    // AI Generate
    const generateBtn = container.querySelector('#sa-generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => handleGenerate());
    }

    // Related Reflections — AI form
    const saTopicInput = container.querySelector('#sa-topic');
    const saSubjectSelect = container.querySelector('#sa-subject');
    if (saTopicInput) {
      const debounceRef = (() => { let t; return (fn, d) => { clearTimeout(t); t = setTimeout(fn, d); }; })();
      saTopicInput.addEventListener('input', () => {
        debounceRef(() => triggerReflectionSearch('sa-ai-reflections', saTopicInput.value, saSubjectSelect?.value), 400);
      });
      if (saSubjectSelect) {
        saSubjectSelect.addEventListener('change', () => {
          triggerReflectionSearch('sa-ai-reflections', saTopicInput.value, saSubjectSelect.value);
        });
      }
    }

    // Related Reflections — Manual form
    const saManualTitle = container.querySelector('#sa-manual-title');
    const saManualTopic = container.querySelector('#sa-manual-topic');
    const saManualSubject = container.querySelector('#sa-manual-subject');
    if (saManualTitle || saManualTopic) {
      const debounceRef2 = (() => { let t; return (fn, d) => { clearTimeout(t); t = setTimeout(fn, d); }; })();
      const triggerManual = () => {
        debounceRef2(() => triggerReflectionSearch('sa-manual-reflections', saManualTitle?.value, saManualTopic?.value, saManualSubject?.value), 400);
      };
      if (saManualTitle) saManualTitle.addEventListener('input', triggerManual);
      if (saManualTopic) saManualTopic.addEventListener('input', triggerManual);
      if (saManualSubject) saManualSubject.addEventListener('change', triggerManual);
    }

    // Regenerate
    const regenBtn = container.querySelector('#sa-regenerate');
    if (regenBtn) {
      regenBtn.addEventListener('click', () => handleGenerate());
    }

    // Save preview
    const savePreviewBtn = container.querySelector('#sa-save-preview');
    if (savePreviewBtn) {
      savePreviewBtn.addEventListener('click', () => {
        const titleInput = container.querySelector('#sa-preview-title');
        const notesInput = container.querySelector('#sa-preview-notes');
        const item = {
          ...generatedPreview,
          id: generateId(),
          title: titleInput ? titleInput.value.trim() : generatedPreview.title,
          teacherNotes: notesInput ? notesInput.value.trim() : '',
          createdAt: new Date().toISOString(),
          source: 'ai',
        };
        const lib = getLibrary();
        lib.unshift(item);
        saveLibrary(lib);
        showToast('Source analysis set saved to library!', 'success');
        generatedPreview = null;
        activeTab = 'browse';
        renderView();
      });
    }

    // Discard preview
    const discardBtn = container.querySelector('#sa-discard-preview');
    if (discardBtn) {
      discardBtn.addEventListener('click', () => {
        generatedPreview = null;
        renderView();
      });
    }

    // Mount file upload zone for manual entry
    const saUploadMount = container.querySelector('#sa-manual-upload-mount');
    if (saUploadMount) {
      const uploadZone = createFileUploadZone({
        compact: true,
        placeholder: 'Upload a source document — text will populate Source A below',
        onContent: (text, meta) => {
          // Populate the first source content textarea
          const firstContent = container.querySelector('.sa-src-content[data-src-idx="0"]');
          if (firstContent) firstContent.value = text;
          manualFileMeta = meta;

          // Auto-fill title from filename if empty
          const titleInput = container.querySelector('#sa-manual-title');
          if (titleInput && !titleInput.value.trim() && meta.filename) {
            titleInput.value = meta.filename.replace(/\.[^.]+$/, '');
          }

          // Show source reference for PDFs
          const sourceRefEl = container.querySelector('#sa-manual-source-ref');
          if (sourceRefEl && meta.isPdf && meta.pageRange) {
            sourceRefEl.style.display = 'block';
            sourceRefEl.innerHTML = `
              <div style="background:rgba(67,97,238,0.06);border:1px solid rgba(67,97,238,0.15);border-radius:8px;padding:8px 14px;margin-top:8px;">
                <div style="font-size:0.75rem;font-weight:600;color:#4361ee;margin-bottom:2px;">Source Reference</div>
                <div style="font-size:0.8125rem;color:var(--ink-secondary,#555);">
                  ${esc(meta.filename)} — pp ${meta.pageRange.from}–${meta.pageRange.to} (${meta.extractedPages} of ${meta.totalPages} pages)
                </div>
              </div>
            `;
          }
        }
      });
      saUploadMount.appendChild(uploadZone.el);
    }

    // Manual: add source
    const addSourceBtn = container.querySelector('#sa-add-source');
    if (addSourceBtn) {
      addSourceBtn.addEventListener('click', () => {
        syncManualSourcesFromDOM();
        syncManualQuestionsFromDOM();
        manualSources.push({ title: '', type: 'Written', provenance: '', content: '' });
        renderView();
      });
    }

    // Manual: remove source
    container.querySelectorAll('[data-remove-source]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncManualSourcesFromDOM();
        syncManualQuestionsFromDOM();
        const idx = parseInt(btn.dataset.removeSource, 10);
        manualSources.splice(idx, 1);
        renderView();
      });
    });

    // Manual: add question
    const addQuestionBtn = container.querySelector('#sa-add-question');
    if (addQuestionBtn) {
      addQuestionBtn.addEventListener('click', () => {
        syncManualSourcesFromDOM();
        syncManualQuestionsFromDOM();
        manualQuestions.push({ type: 'Inference', marks: 5, question: '', skill: '' });
        renderView();
      });
    }

    // Manual: remove question
    container.querySelectorAll('[data-remove-question]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncManualSourcesFromDOM();
        syncManualQuestionsFromDOM();
        const idx = parseInt(btn.dataset.removeQuestion, 10);
        manualQuestions.splice(idx, 1);
        renderView();
      });
    });

    // Manual: save
    const saveManualBtn = container.querySelector('#sa-save-manual');
    if (saveManualBtn) {
      saveManualBtn.addEventListener('click', () => {
        syncManualSourcesFromDOM();
        syncManualQuestionsFromDOM();

        const subject = (container.querySelector('#sa-manual-subject') || {}).value;
        const level = (container.querySelector('#sa-manual-level') || {}).value;
        const title = (container.querySelector('#sa-manual-title') || {}).value.trim();
        const topic = (container.querySelector('#sa-manual-topic') || {}).value.trim();
        const notes = (container.querySelector('#sa-manual-notes') || {}).value.trim();

        if (!subject) {
          showToast('Please select a subject.', 'danger');
          return;
        }
        if (!title) {
          showToast('Please enter a title.', 'danger');
          return;
        }

        const hasContent = manualSources.some(s => s.content.trim()) && manualQuestions.some(q => q.question.trim());
        if (!hasContent) {
          showToast('Please add at least one source and one question.', 'danger');
          return;
        }

        const item = {
          id: generateId(),
          title,
          subject,
          level,
          topic,
          sources: manualSources.filter(s => s.content.trim()).map(s => ({
            title: s.title.trim() || 'Untitled Source',
            type: s.type,
            provenance: s.provenance.trim(),
            content: s.content.trim(),
          })),
          questions: manualQuestions.filter(q => q.question.trim()).map(q => ({
            type: q.type,
            marks: q.marks,
            question: q.question.trim(),
            skill: q.skill.trim(),
            e21cc: '',
          })),
          markScheme: '',
          teacherNotes: notes,
          createdAt: new Date().toISOString(),
          source: 'manual',
        };

        // Attach source reference if uploaded from file
        if (manualFileMeta) {
          item.sourceRef = {
            filename: manualFileMeta.filename,
            isPdf: manualFileMeta.isPdf,
            totalPages: manualFileMeta.totalPages,
            pageRange: manualFileMeta.pageRange,
            extractedPages: manualFileMeta.extractedPages
          };
        }

        const lib = getLibrary();
        lib.unshift(item);
        saveLibrary(lib);
        showToast('Source analysis set saved to library!', 'success');

        manualSources = [{ title: '', type: 'Written', provenance: '', content: '' }];
        manualQuestions = [{ type: 'Inference', marks: 5, question: '', skill: '' }];
        manualFileMeta = null;
        activeTab = 'browse';
        renderView();
      });
    }
  }

  /* ── AI generation handler ── */
  async function handleGenerate() {
    const subject = (container.querySelector('#sa-subject') || {}).value;
    const level = (container.querySelector('#sa-level') || {}).value;
    const topic = (container.querySelector('#sa-topic') || {}).value?.trim();
    const context = (container.querySelector('#sa-context') || {}).value?.trim();
    const numSources = (container.querySelector('#sa-num-sources') || {}).value || '2';
    const framework = (container.querySelector('#sa-framework') || {}).value || 'SBQ';

    const sourceTypeEls = container.querySelectorAll('#sa-source-types input[type="checkbox"]:checked');
    const sourceTypes = Array.from(sourceTypeEls).map(el => el.value);

    const qTypeEls = container.querySelectorAll('#sa-question-types input[type="checkbox"]:checked');
    const questionTypes = Array.from(qTypeEls).map(el => el.value);

    if (!subject) {
      showToast('Please select a subject.', 'danger');
      return;
    }
    if (!topic) {
      showToast('Please enter a topic or theme.', 'danger');
      container.querySelector('#sa-topic')?.focus();
      return;
    }
    if (sourceTypes.length === 0) {
      showToast('Please select at least one source type.', 'danger');
      return;
    }
    if (questionTypes.length === 0) {
      showToast('Please select at least one question type.', 'danger');
      return;
    }

    const generateBtn = container.querySelector('#sa-generate-btn') || container.querySelector('#sa-regenerate');
    const loadingEl = container.querySelector('#sa-loading');
    if (generateBtn) generateBtn.disabled = true;
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
      const systemPrompt = `You are an expert Singapore Humanities and GP teacher specialising in source-based questions. You create source analysis sets following the Singapore-Cambridge GCE examination format.

KEY REQUIREMENTS:
- Generate realistic, historically/contextually accurate sources with proper provenance
- Sources must have clear authorship, date, and publication context
- For written sources: use period-appropriate language and tone
- For visual sources: describe the image/cartoon/photograph in detail as a text description, noting key visual elements
- For statistical sources: present data in a clear tabular or descriptive format
- For cartographic sources: describe map features, legends, and key geographical data

QUESTION FORMATS:
- SBQ (Source-Based Questions): Follow Singapore O/N-Level and A-Level SBQ format
- SEQ (Structured Essay Questions): Progressive difficulty from describe to explain to evaluate
- OPCVL: Origin, Purpose, Content, Value, Limitation analysis framework
- CRR: Claim, Reason, Reasoning framework

MARK SCHEME:
- Use L1/L2/L3 level descriptors for each question
- L1: Identifies/copies from source (1 mark)
- L2: Explains with evidence from source (2-3 marks)
- L3: Evaluates/analyses with contextual knowledge and cross-referencing (4-5+ marks)
- Include sample answers for each level

E21CC COMPETENCIES (map where relevant):
- Critical and Inventive Thinking
- Communication, Collaboration and Information Skills
- Civic Literacy, Global Awareness and Cross-Cultural Skills

RESPONSE FORMAT:
You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object. Use this exact structure:
{
  "title": "string - descriptive title for this set",
  "subject": "string - the subject",
  "level": "string - the level",
  "topic": "string - the topic/theme",
  "framework": "string - SBQ/SEQ/OPCVL/CRR",
  "sources": [
    {
      "title": "string - source title",
      "type": "string - Written/Visual/Statistical/Cartographic",
      "provenance": "string - attribution, date, context",
      "content": "string - full source text or detailed description"
    }
  ],
  "questions": [
    {
      "type": "string - Inference/Comparison/Reliability\\/Usefulness/Cross-referencing/Assertion\\/Judgement",
      "marks": number,
      "question": "string - full question text with source references",
      "skill": "string - skill being tested",
      "e21cc": "string - E21CC competency if applicable"
    }
  ],
  "markScheme": "string - complete mark scheme with L1/L2/L3 descriptors and sample answers"
}`;

      const userPrompt = [
        `Generate a ${framework} source analysis set for ${subject} (${level}).`,
        `Topic/Theme: ${topic}`,
        `Number of sources: ${numSources}`,
        `Source types to include: ${sourceTypes.join(', ')}`,
        `Question types to include: ${questionTypes.join(', ')}`,
        context ? `Additional context: ${context}` : '',
        '',
        'Respond with valid JSON only.',
      ].filter(Boolean).join('\n');

      const text = await sendChat(
        [{ role: 'user', content: userPrompt }],
        { systemPrompt, temperature: 0.7, maxTokens: 8000 }
      );

      let parsed;
      try {
        const jsonStr = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse AI response as JSON. Please try again.');
        }
      }

      if (!parsed.sources || !parsed.questions) {
        throw new Error('AI response is missing sources or questions. Please try again.');
      }

      generatedPreview = {
        title: parsed.title || `${topic} - ${framework} Set`,
        subject: parsed.subject || subject,
        level: parsed.level || level,
        topic: parsed.topic || topic,
        framework: parsed.framework || framework,
        sources: (parsed.sources || []).map(s => ({
          title: s.title || 'Untitled Source',
          type: s.type || 'Written',
          provenance: s.provenance || '',
          content: s.content || '',
        })),
        questions: (parsed.questions || []).map(q => ({
          type: q.type || 'Inference',
          marks: q.marks || 5,
          question: q.question || '',
          skill: q.skill || '',
          e21cc: q.e21cc || '',
        })),
        markScheme: parsed.markScheme || '',
        teacherNotes: '',
      };

      showToast('Source analysis set generated!', 'success');
      renderView();

    } catch (err) {
      console.error('Source analysis generation error:', err);
      showToast(`Generation failed: ${err.message}`, 'danger');
    } finally {
      const btn = container.querySelector('#sa-generate-btn') || container.querySelector('#sa-regenerate');
      const loading = container.querySelector('#sa-loading');
      if (btn) btn.disabled = false;
      if (loading) loading.style.display = 'none';
    }
  }

  renderView();
}
