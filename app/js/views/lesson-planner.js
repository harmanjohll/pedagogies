/*
 * Co-Cher Lesson Planner
 * ======================
 * AI chat + plan canvas with save / link-to-class / export.
 * Phase 3: Subject-aware prompts, status badge, undo, mobile toggle, improved markdown.
 */

import { Store } from '../state.js';
import { sendChat, reviewLesson, generateRubric, suggestGrouping, generateExitTicket, suggestDifferentiation, generateTimeline, suggestSeatAssignment, suggestYouTubeVideos, suggestSimulations, generateWorksheet, generateDiscussionPrompts, suggestExternalResources, generateLISC, generateStimulusMaterial, generateVocabulary, generateModelResponse, generateSourceAnalysis, generateCCEDiscussion } from '../api.js';
import { showToast } from '../components/toast.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { navigate } from '../router.js';
import { renderWorkflowBreadcrumb, bindWorkflowClicks } from '../components/workflow-breadcrumb.js';
import { getCurrentUser } from '../components/login.js';
import { loadTT, findTeacherRow } from './dashboard.js';

let chatMessages = [];
let isGenerating = false;
let currentLessonId = null;  // if editing a saved lesson
let planClassContext = null;  // class context from "Plan from Class"
let attachedKBContext = [];   // attached knowledge base resources
let lessonDateTime = null;    // { date, period, room, classCode } from timetable or manual
let selectedIdeology = '';    // optional curriculum ideology lens

/* ── Lesson Components: persistent AI tool results integrated into the plan ── */
let lessonComponents = {};    // { review, rubric, grouping, timeline, exitTicket, differentiation, seatPlan }

/* ── Toolbar display preference ── */
const LP_PREFS_KEY = 'cocher_lp_prefs';
function getLPPrefs() {
  try { const r = localStorage.getItem(LP_PREFS_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function saveLPPrefs(p) {
  try { localStorage.setItem(LP_PREFS_KEY, JSON.stringify(p)); } catch {}
}

/* ── EEE: Enactment Enhancements for Engagement ── */
const EEE_KEY = 'cocher_eee_selections';
const EEE_SIDEBAR_KEY = 'cocher_eee_sidebar';

// All available EEEs: core tools (always visible) and optional enhancements
export const EEE_REGISTRY = {
  // === CORE (always enabled, not toggleable) ===
  lisc:           { label: 'LI / SC',           cat: 'core', desc: 'Learning Intentions & Success Criteria with E21CC alignment' },
  review:         { label: 'Lesson Review',      cat: 'core', desc: 'AI analysis of your lesson plan against STP & E21CC' },
  timeline:       { label: 'Timeline',           cat: 'core', desc: 'Lesson pacing with phase-by-phase suggestions' },
  grouping:       { label: 'Student Groups',     cat: 'core', desc: 'Group formation using class roster & E21CC profiles' },
  differentiation:{ label: 'Differentiation',    cat: 'core', desc: 'Scaffolding & extension strategies for diverse learners' },
  exitTicket:     { label: 'Exit Ticket',        cat: 'core', desc: 'Formative check questions for lesson closure' },
  discussionPrompts:{ label: 'Discussion Prompts', cat: 'core', desc: 'Structured questions for classroom discourse' },
  rubric:         { label: 'Rubric',             cat: 'core', desc: 'Assessment rubrics with criteria & levels' },
  // === ENACTMENT ENHANCEMENTS (teacher chooses) ===
  youtubeVideos:  { label: 'YouTube Curation',   cat: 'enactment', desc: 'Curated video recommendations with preview tiles', subjects: ['all'] },
  simulations:    { label: 'Simulations & Models', cat: 'enactment', desc: 'Interactive sims: PhET, GeoGebra, built-in practicals', subjects: ['Science', 'Chemistry', 'Physics', 'Biology', 'Mathematics', 'Geography'] },
  worksheet:      { label: 'Worksheet / Handout', cat: 'enactment', desc: 'Print-ready student worksheets with mixed question types', subjects: ['all'] },
  externalLinks:  { label: 'External Resources', cat: 'enactment', desc: 'Curated links to SLS, MOE resources, and open platforms', subjects: ['all'] },
  stimulus:       { label: 'Stimulus Material',  cat: 'enactment', desc: 'Comprehension passages, source texts, scenario briefs', subjects: ['English', 'Chinese', 'Malay', 'Tamil', 'History', 'Social Studies', 'Geography', 'General Paper'] },
  vocabulary:     { label: 'Vocabulary Builder', cat: 'enactment', desc: 'Word walls, sentence frames, cloze passages, academic language', subjects: ['English', 'Chinese', 'Malay', 'Tamil', 'all'] },
  modelResponse:  { label: 'Model Response',     cat: 'enactment', desc: 'Annotated model answers showing structure & techniques', subjects: ['English', 'Chinese', 'Malay', 'Tamil', 'History', 'Social Studies', 'General Paper', 'Geography'] },
  sourceAnalysis: { label: 'Source Analysis',     cat: 'enactment', desc: 'Structured SBQ/SEQ-style source-based questions', subjects: ['History', 'Social Studies', 'General Paper', 'Geography'] },
  seatPlan:       { label: 'Seating Plan',        cat: 'enactment', desc: 'AI seat assignments with visual classroom map', subjects: ['all'] },
  cceDiscussion:  { label: 'CCE Discussion',      cat: 'enactment', desc: 'Structured values-based discussion with CCE2021 framework', subjects: ['CCE', 'Social Studies', 'all'] },
};

const DEFAULT_PLANNER = ['youtubeVideos', 'worksheet', 'externalLinks', 'seatPlan', 'simulations', 'stimulus', 'vocabulary', 'modelResponse', 'sourceAnalysis', 'cceDiscussion'];
const DEFAULT_SIDEBAR = ['simulations'];

export function getEEESelections() {
  try {
    const stored = localStorage.getItem(EEE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Backward compat: old format was a flat array
      if (Array.isArray(parsed)) return parsed;
      return parsed;
    }
  } catch {}
  return [...DEFAULT_PLANNER];
}

export function getEEESidebarSelections() {
  try {
    const stored = localStorage.getItem(EEE_SIDEBAR_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...DEFAULT_SIDEBAR];
}

export function saveEEESelections(selections) {
  try { localStorage.setItem(EEE_KEY, JSON.stringify(selections)); } catch {}
}

export function saveEEESidebarSelections(selections) {
  try { localStorage.setItem(EEE_SIDEBAR_KEY, JSON.stringify(selections)); } catch {}
}

function isEEEEnabled(toolKey) {
  const entry = EEE_REGISTRY[toolKey];
  if (!entry) return false;
  if (entry.cat === 'core') return true;
  return getEEESelections().includes(toolKey);
}

/* ── Active component tab ── */
let activeComponentTab = null;  // null = show all (auto-select first)

const COMPONENT_META = {
  lisc:            { label: 'LI / SC',                 color: 'var(--brand-navy, #000c53)', icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>', order: 0 },
  timeline:        { label: 'Timeline / Pacing',       color: 'var(--accent)',      icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', order: 1 },
  grouping:        { label: 'Student Groups',          color: 'var(--e21cc-cci)',   icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', order: 2 },
  seatPlan:        { label: 'Seating Plan',            color: 'var(--e21cc-cgc)',   icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>', order: 3 },
  differentiation: { label: 'Differentiation',         color: 'var(--e21cc-cait)',  icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>', order: 4 },
  rubric:          { label: 'Assessment Rubric',       color: 'var(--success)',     icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>', order: 5 },
  exitTicket:      { label: 'Exit Ticket',             color: 'var(--e21cc-cait)',  icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', order: 6 },
  review:          { label: 'Lesson Review',           color: 'var(--accent)',      icon: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M8 11l2 2 4-4"/>', order: 7 },
  youtubeVideos:   { label: 'YouTube Videos',          color: '#ff0000',            icon: '<polygon points="5 3 19 12 5 21 5 3"/>', order: 8 },
  simulations:     { label: 'Simulation Models',        color: '#8b5cf6',            icon: '<path d="M9 3h6v3H9z"/><path d="M7 6h10l2 4-4 3 4 3-2 5H7l-2-5 4-3-4-3z"/>', order: 9 },
  worksheet:       { label: 'Worksheet / Handout',      color: 'var(--info, #3b82f6)',icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/><path d="M7 13h0.01"/>', order: 10 },
  discussionPrompts: { label: 'Discussion Prompts',     color: 'var(--warning, #f59e0b)', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>', order: 11 },
  externalLinks:   { label: 'External Resources',       color: 'var(--success, #22c55e)', icon: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>', order: 12 },
  stimulus:        { label: 'Stimulus Material',        color: '#0ea5e9',              icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>', order: 13 },
  vocabulary:      { label: 'Vocabulary Builder',        color: '#06b6d4',              icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', order: 14 },
  modelResponse:   { label: 'Model Response',            color: '#d946ef',              icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>', order: 15 },
  sourceAnalysis:  { label: 'Source Analysis',           color: '#f97316',              icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>', order: 16 },
  cceDiscussion:   { label: 'CCE Discussion',            color: '#e11d48',              icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>', order: 17 },
};

function setComponent(key, content, meta = '') {
  lessonComponents[key] = { content, meta, updatedAt: Date.now() };
  autoSaveComponents();
}

function removeComponent(key) {
  delete lessonComponents[key];
  autoSaveComponents();
}

function autoSaveComponents() {
  if (currentLessonId) {
    Store.updateLesson(currentLessonId, { components: { ...lessonComponents } });
  }
}

function renderComponents(container) {
  const el = container.querySelector('#lesson-components');
  if (!el) return;

  const keys = Object.keys(lessonComponents)
    .filter(k => lessonComponents[k]?.content)
    .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));

  if (keys.length === 0) {
    el.innerHTML = '';
    activeComponentTab = null;
    return;
  }

  // Auto-select first tab if none active or current tab removed
  if (!activeComponentTab || !keys.includes(activeComponentTab)) {
    activeComponentTab = keys[0];
  }

  const activeComp = lessonComponents[activeComponentTab];
  const activeMeta = COMPONENT_META[activeComponentTab] || { label: activeComponentTab, color: 'var(--ink-muted)', icon: '', order: 99 };

  el.innerHTML = `
    <div style="margin-top:var(--sp-5);">
      <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
        <span class="text-overline" style="color:var(--ink-faint);">Lesson Components</span>
        <span class="badge badge-blue" style="font-size:0.6875rem;">${keys.length}</span>
      </div>

      <!-- Component Tabs -->
      <div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:var(--sp-3);border-bottom:2px solid var(--border-light);padding-bottom:0;">
        ${keys.map(key => {
          const m = COMPONENT_META[key] || { label: key, color: 'var(--ink-muted)', icon: '' };
          const isActive = key === activeComponentTab;
          return `<button class="component-tab" data-tab="${key}" style="
            display:inline-flex;align-items:center;gap:4px;padding:6px 10px;font-size:0.75rem;font-weight:${isActive ? '600' : '400'};
            color:${isActive ? 'var(--accent)' : 'var(--ink-muted)'};background:${isActive ? 'var(--accent-light)' : 'transparent'};
            border:none;border-bottom:2px solid ${isActive ? 'var(--accent)' : 'transparent'};margin-bottom:-2px;
            border-radius:var(--radius-md) var(--radius-md) 0 0;cursor:pointer;transition:all 0.15s;white-space:nowrap;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isActive ? m.color : 'currentColor'}" stroke-width="2">${m.icon}</svg>
            ${m.label}
          </button>`;
        }).join('')}
      </div>

      <!-- Active Component Content -->
      <div class="card" style="border-top:3px solid ${activeMeta.color};overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${activeMeta.color}" stroke-width="2">${activeMeta.icon}</svg>
            <span style="font-size:0.875rem;font-weight:600;color:var(--ink);">${activeMeta.label}</span>
            ${activeComp.meta ? `<span style="font-size:0.6875rem;color:var(--ink-faint);">${esc(activeComp.meta)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-1);">
            ${['worksheet','stimulus','vocabulary','modelResponse','sourceAnalysis','exitTicket','cceDiscussion'].includes(activeComponentTab) ? `
            <button class="btn btn-ghost btn-sm component-preview" data-key="${activeComponentTab}" title="Student Preview — see how students will see this" style="padding:2px 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>` : ''}
            <button class="btn btn-ghost btn-sm component-refresh" data-key="${activeComponentTab}" title="Regenerate" style="padding:2px 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm component-remove" data-key="${activeComponentTab}" title="Remove" style="padding:2px 4px;color:var(--danger);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        ${activeComponentTab === 'seatPlan' ? buildSeatPlanVisual(activeComp.content) : ''}
        <div style="padding:var(--sp-4);font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);max-height:600px;overflow-y:auto;">
          ${md(activeComp.content)}
        </div>
      </div>
    </div>`;

  // Wire remove buttons
  el.querySelectorAll('.component-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.key;
      removeComponent(key);
      renderComponents(container);
    });
  });

  // Wire refresh buttons
  el.querySelectorAll('.component-refresh').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.key;
      // Trigger the corresponding tool
      const toolBtnMap = {
        lisc: '#ai-lisc-btn',
        review: '#ai-review-btn',
        rubric: '#ai-rubric-btn',
        grouping: '#ai-group-btn',
        timeline: '#ai-timeline-btn',
        exitTicket: '#ai-exit-ticket-btn',
        differentiation: '#ai-differentiation-btn',
        youtubeVideos: '#ai-youtube-btn',
        simulations: '#ai-simulations-btn',
        worksheet: '#ai-worksheet-btn',
        discussionPrompts: '#ai-discussion-btn',
        externalLinks: '#ai-external-btn',
        stimulus: '#ai-stimulus-btn',
        vocabulary: '#ai-vocabulary-btn',
        modelResponse: '#ai-model-response-btn',
        sourceAnalysis: '#ai-source-analysis-btn',
        cceDiscussion: '#ai-cce-btn',
        seatPlan: '#spatial-layout-btn',
      };
      if (toolBtnMap[key]) container.querySelector(toolBtnMap[key])?.click();
    });
  });

  // Wire tab clicks
  el.querySelectorAll('.component-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeComponentTab = tab.dataset.tab;
      renderComponents(container);
    });
  });

  // Student preview — opens a clean print-friendly window showing what students would see
  el.querySelectorAll('.component-preview').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const comp = lessonComponents[key];
      if (!comp?.content) return;
      const meta = COMPONENT_META[key] || { label: key };
      // Strip teacher notes, mark schemes, teacher-only annotations
      let studentContent = comp.content
        .replace(/###?\s*Teacher Notes[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*Mark Scheme[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*Facilitation[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*How to Use[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*Differentiation[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*Common Pitfalls[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/\*E21CC:.*?\*/g, '')
        .replace(/— \*[^*]+\*/g, '')
        .trim();
      const previewWin = window.open('', '_blank');
      previewWin.document.write(`<!DOCTYPE html><html><head><title>${esc(meta.label)} — Student View</title>
        <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.8;font-size:15px}
        h1{font-size:18px;border-bottom:2px solid #4361ee;padding-bottom:8px;color:#4361ee}
        h2,h3,h4{margin:16px 0 8px}strong{font-weight:600}ul,ol{padding-left:20px}
        table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:8px 12px;border:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #e2e8f0}
        .name-line{display:flex;gap:24px;font-size:13px;color:#64748b;margin-bottom:16px}
        .name-line span{border-bottom:1px solid #94a3b8;min-width:120px;display:inline-block}
        @media print{body{margin:0;padding:16px}}</style></head>
        <body>
          <div class="header"><h1>${esc(meta.label)}</h1><span style="font-size:12px;color:#94a3b8;">Co-Cher</span></div>
          <div class="name-line">Name: <span>&nbsp;</span> Class: <span>&nbsp;</span> Date: <span>&nbsp;</span></div>
          ${md(studentContent)}
        </body></html>`);
      previewWin.document.close();
    });
  });
}

/* ── Visual Seating Plan: parse AI text to render an SVG classroom view ── */
function buildSeatPlanVisual(text) {
  // Parse groups and positions from the AI seating plan text
  const groups = [];
  const groupRegex = /###?\s*Group\s*(\d+)[^]*?(?:\*\*Position:\*\*|Position:)\s*([^\n]+)[^]*?(?:\*\*Members?:\*\*|Members?:)\s*([^\n]+)/gi;
  let m;
  while ((m = groupRegex.exec(text)) !== null) {
    const num = parseInt(m[1]);
    const position = m[2].trim();
    const members = m[3].replace(/\*\*/g, '').split(/,\s*/).map(n => n.trim()).filter(Boolean);
    if (members.length > 0) groups.push({ num, position, members });
  }

  // Fallback: try simpler patterns if structured parsing didn't work
  if (groups.length === 0) {
    const simpleGroups = [];
    const lines = text.split('\n');
    let currentGroup = null;
    for (const line of lines) {
      const gm = line.match(/Group\s*(\d+)/i);
      if (gm) {
        if (currentGroup && currentGroup.members.length > 0) simpleGroups.push(currentGroup);
        currentGroup = { num: parseInt(gm[1]), position: '', members: [] };
      }
      if (currentGroup) {
        const posMatch = line.match(/Position:\s*(.+)/i);
        if (posMatch) currentGroup.position = posMatch[1].replace(/\*\*/g, '').trim();
        const memMatch = line.match(/Members?:\s*(.+)/i);
        if (memMatch) {
          currentGroup.members = memMatch[1].replace(/\*\*/g, '').split(/,\s*/).map(n => n.trim()).filter(Boolean);
        }
      }
    }
    if (currentGroup && currentGroup.members.length > 0) simpleGroups.push(currentGroup);
    groups.push(...simpleGroups);
  }

  if (groups.length === 0) return '';

  // Layout configuration
  const W = 600, H = 320;
  const DESK_W = 80, DESK_H = 50;
  const colors = ['#4361ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

  // Position groups in a grid
  const totalGroups = groups.length;
  const cols = Math.min(totalGroups, 4);
  const rows = Math.ceil(totalGroups / cols);
  const cellW = W / cols;
  const cellH = (H - 40) / rows; // reserve 40px for teacher area

  let desks = '';
  groups.forEach((g, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = cellW * col + cellW / 2;
    const cy = 40 + cellH * row + cellH / 2;
    const color = colors[idx % colors.length];

    // Draw desk rectangle
    desks += `<rect x="${cx - DESK_W / 2}" y="${cy - DESK_H / 2}" width="${DESK_W}" height="${DESK_H}" rx="6" fill="${color}15" stroke="${color}" stroke-width="1.5"/>`;

    // Group label
    desks += `<text x="${cx}" y="${cy - DESK_H / 2 - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="${color}">Group ${g.num}</text>`;

    // Student names inside/around the desk
    const maxShow = Math.min(g.members.length, 5);
    const nameStart = cy - (maxShow - 1) * 7;
    for (let i = 0; i < maxShow; i++) {
      const name = g.members[i].length > 14 ? g.members[i].slice(0, 12) + '..' : g.members[i];
      desks += `<text x="${cx}" y="${nameStart + i * 14}" text-anchor="middle" font-size="8" fill="var(--ink,#334155)">${esc(name)}</text>`;
    }
    if (g.members.length > maxShow) {
      desks += `<text x="${cx}" y="${nameStart + maxShow * 14}" text-anchor="middle" font-size="7" fill="var(--ink-faint,#94a3b8)">+${g.members.length - maxShow} more</text>`;
    }
  });

  // Teacher position at top
  const teacherArea = `
    <rect x="${W / 2 - 40}" y="4" width="80" height="22" rx="4" fill="var(--accent,#4361ee)" opacity="0.15" stroke="var(--accent,#4361ee)" stroke-width="1"/>
    <text x="${W / 2}" y="19" text-anchor="middle" font-size="9" font-weight="600" fill="var(--accent,#4361ee)">Teacher</text>
  `;

  return `
    <div style="padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-bottom:1px solid var(--border-light);">
      <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);margin-bottom:var(--sp-2);">Classroom View</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;background:var(--bg,#fff);border-radius:8px;border:1px solid var(--border-light);">
        ${teacherArea}
        ${desks}
      </svg>
    </div>`;
}

/* ── Markdown renderer (improved — supports tables, links, YouTube embeds) ── */
function md(text) {
  // Normalize: collapse line breaks inside markdown link syntax [label](url)
  // The AI often wraps long links across lines, breaking the regex
  text = text.replace(/\]\s*\n\s*\(/g, '](');  // fix ]\n(
  text = text.replace(/\[([^\]]*)\n([^\]]*)\]/g, '[$1 $2]');  // fix newline inside [label]

  // Preserve markdown links before HTML-escaping by extracting them first
  // Matches both http(s) URLs and local paths like simulations/...
  const linkPlaceholders = [];
  text = text.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (m, label, url) => {
    const idx = linkPlaceholders.length;
    linkPlaceholders.push({ label: label.trim(), url: url.trim() });
    return `%%MDLINK_${idx}%%`;
  });

  // Preserve bare URLs before escaping
  const bareUrlPlaceholders = [];
  text = text.replace(/(?<!["\(=\[])(https?:\/\/[^\s<)"]+)/g, (url) => {
    const idx = bareUrlPlaceholders.length;
    bareUrlPlaceholders.push(url);
    return `%%BAREURL_${idx}%%`;
  });

  let result = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-subtle,rgba(0,0,0,0.06));padding:8px 12px;border-radius:8px;font-size:0.8rem;overflow-x:auto;margin:6px 0;font-family:var(--font-mono);"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold, italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h5 style="font-size:0.85rem;font-weight:600;margin:6px 0 3px;">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:0.9rem;font-weight:600;margin:8px 0 4px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:10px 0 4px;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h3 style="font-size:1.05rem;font-weight:700;margin:12px 0 4px;">$1</h3>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-light);margin:12px 0;">')
    // Tables
    .replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/gm, (match, headerRow, sepRow, bodyRows) => {
      const headers = headerRow.split('|').filter(c => c.trim());
      const alignments = sepRow.split('|').filter(c => c.trim()).map(c => {
        c = c.trim();
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      const rows = bodyRows.trim().split('\n').map(r => r.split('|').filter(c => c.trim()));
      return `<div style="overflow-x:auto;margin:8px 0;"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem;color:var(--ink-secondary);">
        <thead><tr>${headers.map((h, i) => `<th style="text-align:${alignments[i] || 'left'};padding:6px 10px;border-bottom:2px solid var(--border);font-weight:600;color:var(--ink);background:var(--bg-subtle);">${h.trim()}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td style="text-align:${alignments[i] || 'left'};padding:5px 10px;border-bottom:1px solid var(--border-light);">${cell.trim()}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    })
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => {
      if (m.match(/^\d+\./m)) return m;
      return `<ul style="padding-left:1.25rem;margin:4px 0;">${m}</ul>`;
    })
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/(<li style="margin:2px 0;">[^<]*<\/li>\n?){2,}/g, m => {
      if (m.includes('<ul') || m.includes('<ol')) return m;
      return `<ol style="padding-left:1.25rem;margin:4px 0;">${m}</ol>`;
    })
    // Blockquotes (for "copy this prompt" sections)
    .replace(/&gt; (.+)/g, '<blockquote style="border-left:3px solid var(--accent);padding:8px 12px;margin:6px 0;background:var(--accent-light,rgba(67,97,238,0.06));border-radius:0 6px 6px 0;font-size:0.8125rem;color:var(--ink-secondary);">$1</blockquote>')
    // Paragraphs
    .replace(/\n{2,}/g, '</p><p style="margin:4px 0;">')
    .replace(/\n/g, '<br>');

  // Restore markdown links with rich rendering
  result = result.replace(/%%MDLINK_(\d+)%%/g, (_, idx) => {
    const { label, url } = linkPlaceholders[parseInt(idx)];
    // YouTube video URL → inline embed preview
    const ytWatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (ytWatch) {
      return `<div style="margin:8px 0;">
        <a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff0000" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="white"/></svg>
          ${label}
        </a>
        <div style="margin-top:6px;border-radius:8px;overflow:hidden;max-width:480px;aspect-ratio:16/9;background:#000;">
          <iframe src="https://www.youtube-nocookie.com/embed/${ytWatch[1]}" style="width:100%;height:100%;border:none;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>`;
    }
    // YouTube search URL → thumbnail preview tile
    if (url.includes('youtube.com/results?search_query=')) {
      const query = decodeURIComponent(url.split('search_query=')[1] || '').replace(/\+/g, ' ');
      return `<a href="${url}" target="_blank" rel="noopener" class="yt-tile" style="display:inline-flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-subtle,#fafafa);border:1px solid var(--border-light,#e5e5e5);border-radius:10px;text-decoration:none;margin:4px 0;max-width:400px;transition:box-shadow 0.15s,border-color 0.15s;" onmouseenter="this.style.boxShadow='0 2px 12px rgba(0,0,0,0.15)';this.style.borderColor='#ff0000';" onmouseleave="this.style.boxShadow='none';this.style.borderColor='';">
        <div style="width:80px;height:45px;flex-shrink:0;background:var(--surface,#1a1a1a);border-radius:6px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff0000" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="white"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink,#1a1a1a);line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${label}</div>
          <div style="font-size:0.6875rem;color:#ff0000;font-weight:500;margin-top:2px;">Search on YouTube →</div>
        </div>
      </a>`;
    }
    // Simulation platform links → styled accent button
    if (/phet\.colorado\.edu|geogebra\.org|desmos\.com|falstad\.com|labxchange\.org|chemcollective\.org/.test(url)) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:var(--accent,#4361ee);color:var(--bg,#fff);border-radius:6px;font-size:0.75rem;font-weight:500;text-decoration:none;margin:2px 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${label}
      </a>`;
    }
    // Co-Cher built-in simulation launch link
    if (url.startsWith('simulations/') && url.endsWith('.html')) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border-radius:8px;font-size:0.8125rem;font-weight:600;text-decoration:none;margin:4px 0;box-shadow:0 2px 8px rgba(139,92,246,0.3);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${label}
      </a>`;
    }
    // General link
    return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">${label}</a>`;
  });

  // Restore bare URLs
  result = result.replace(/%%BAREURL_(\d+)%%/g, (_, idx) => {
    const url = bareUrlPlaceholders[parseInt(idx)];
    if (url.includes('youtube.com/results?search_query=')) {
      const q = decodeURIComponent(url.split('search_query=')[1] || '').replace(/\+/g, ' ');
      return `<a href="${url}" target="_blank" rel="noopener" class="yt-tile" style="display:inline-flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-subtle,#fafafa);border:1px solid var(--border-light,#e5e5e5);border-radius:10px;text-decoration:none;margin:4px 0;max-width:400px;" onmouseenter="this.style.boxShadow='0 2px 12px rgba(0,0,0,0.15)';this.style.borderColor='#ff0000';" onmouseleave="this.style.boxShadow='none';this.style.borderColor='';">
        <div style="width:60px;height:34px;flex-shrink:0;background:var(--surface,#1a1a1a);border-radius:5px;display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff0000" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="white"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink,#1a1a1a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(q.slice(0, 50))}</div>
          <div style="font-size:0.625rem;color:#ff0000;font-weight:500;">Search on YouTube →</div>
        </div>
      </a>`;
    }
    if (/phet\.colorado\.edu|geogebra\.org|desmos\.com|falstad\.com/.test(url)) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:var(--accent,#4361ee);color:#fff;border-radius:6px;font-size:0.75rem;font-weight:500;text-decoration:none;margin:2px 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Open: ${url.split('/').pop() || url}
      </a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">${url}</a>`;
  });

  return result;
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ── Build follow-up prompts based on conversation context ── */
function buildFollowUpPrompts(messages) {
  const lastAI = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const subj = planClassContext?.subject || '';
  const followUps = [];
  const eeeSelections = getEEESelections();
  const componentKeys = Object.keys(lessonComponents);

  // Context-aware follow-ups based on what AI just discussed
  if (lastAI.includes('lesson') && !componentKeys.includes('lisc')) {
    followUps.push({ label: 'Generate LI & SC for this', prompt: 'Based on the lesson plan above, generate the Learning Intentions and Success Criteria.' });
  }
  if (lastAI.includes('activit') || lastAI.includes('group')) {
    followUps.push({ label: 'How should I group students?', prompt: 'What grouping strategies would work best for the activities described above?' });
  }
  if (lastAI.includes('lesson') && !componentKeys.includes('timeline')) {
    followUps.push({ label: 'Create a timeline', prompt: 'Create a pacing timeline for this lesson. I have [40/60] minutes.' });
  }
  if ((lastAI.includes('differentiat') || lastAI.includes('scaffold')) && !componentKeys.includes('differentiation')) {
    followUps.push({ label: 'Differentiation strategies', prompt: 'Suggest differentiation strategies for this lesson — both scaffolding for weaker students and extension for stronger learners.' });
  }
  if (lastAI.includes('assess') || lastAI.includes('check for understanding')) {
    followUps.push({ label: 'Design an exit ticket', prompt: 'Design 3 exit ticket questions for this lesson that check for understanding at different levels.' });
  }

  // EEE-aware follow-ups
  if (eeeSelections.includes('youtubeVideos') && !componentKeys.includes('youtubeVideos') && (lastAI.includes('video') || lastAI.includes('visual') || followUps.length < 2)) {
    followUps.push({ label: 'Find YouTube videos', prompt: 'Find relevant YouTube videos I could use as a hook or to reinforce key concepts in this lesson.' });
  }
  if (eeeSelections.includes('stimulus') && !componentKeys.includes('stimulus') && (lastAI.includes('text') || lastAI.includes('passage') || lastAI.includes('source'))) {
    followUps.push({ label: 'Create stimulus material', prompt: `Create a stimulus passage or source text for this lesson, suitable for ${subj || 'the subject'} students.` });
  }
  if (eeeSelections.includes('worksheet') && !componentKeys.includes('worksheet') && followUps.length < 3) {
    followUps.push({ label: 'Generate a worksheet', prompt: 'Generate a student worksheet for this lesson with mixed question types and clear instructions.' });
  }
  if (eeeSelections.includes('vocabulary') && !componentKeys.includes('vocabulary') && (lastAI.includes('vocab') || lastAI.includes('key term') || lastAI.includes('word'))) {
    followUps.push({ label: 'Build vocabulary list', prompt: 'Create a vocabulary word wall with key terms, definitions, and sentence frames for this lesson.' });
  }

  // General follow-ups if we have few
  if (followUps.length < 2) {
    followUps.push({ label: 'How can I make this more engaging?', prompt: 'How can I make this lesson more engaging and student-centred? Suggest concrete improvements.' });
  }
  if (followUps.length < 3) {
    followUps.push({ label: 'Add an E21CC focus', prompt: 'Which E21CC domain (CAIT, CCI, or CGC) could I intentionally develop in this lesson, and how?' });
  }

  return followUps.slice(0, 3);
}

/* ── Build quick prompts based on classes/subjects ── */
function buildQuickPrompts(classes) {
  const prompts = [];

  // Use planClassContext first if available
  const subjects = planClassContext?.subject
    ? [planClassContext.subject]
    : [...new Set(classes.map(c => c.subject).filter(Boolean))];
  const levels = planClassContext?.level
    ? [planClassContext.level]
    : [...new Set(classes.map(c => c.level).filter(Boolean))];

  const subj = subjects[0] || '[subject]';
  const level = levels[0] || '[level e.g. Sec 3]';
  const hasSub = subjects.length > 0;

  // Subject-specific prompts — each with label, desc (card hint), and prompt (full editable text)
  const subjectBank = {
    'Mathematics': [
      { label: 'Plan a Maths lesson', desc: 'Hands-on activities, real-world applications, collaborative problem-solving', prompt: `Plan a ${level} Mathematics lesson on [topic e.g. Quadratic Equations]. Include hands-on activities, real-world applications, and opportunities for collaborative problem-solving. The lesson is [40/60] minutes.` },
      { label: 'Maths with E21CC focus', desc: 'Intentional CAIT development with formative checks', prompt: `Design a ${level} Mathematics lesson on [topic] that intentionally develops CAIT through [open-ended problem solving / pattern recognition]. Include a formative check and an EdTech-enhanced activity.` },
    ],
    'Science': [
      { label: 'Plan a Science lesson', desc: 'Inquiry-based learning with investigation and real-world links', prompt: `Plan a ${level} Science lesson on [topic e.g. Chemical Bonding]. Use inquiry-based learning with a hands-on investigation and a clear link to real-world phenomena. The lesson is [40/60] minutes.` },
      { label: 'Design a practical lesson', desc: 'Pre-lab discussion, guided investigation, POE framework', prompt: `Design a ${level} Science practical lesson on [topic]. Include pre-lab discussion, safety briefing, guided investigation with prediction-observation-explanation, and a debrief.` },
    ],
    'Chemistry': [
      { label: 'Plan a Chemistry lesson', desc: 'Concept-to-application with molecular visualisation', prompt: `Plan a ${level} Chemistry lesson on [topic e.g. Organic Chemistry]. Connect concepts to real-world applications and include opportunities for molecular visualisation. The lesson is [40/60] minutes.` },
      { label: 'Chemistry with simulations', desc: 'PhET/virtual labs with scaffolded inquiry', prompt: `Design a ${level} Chemistry lesson on [topic] incorporating interactive simulations (PhET/virtual labs). Include scaffolded inquiry questions and an E21CC focus on CAIT.` },
    ],
    'Physics': [
      { label: 'Plan a Physics lesson', desc: 'Demonstrations, problem-solving, and data analysis', prompt: `Plan a ${level} Physics lesson on [topic e.g. Forces & Motion]. Include demonstrations, collaborative problem-solving, and data analysis activities. The lesson is [40/60] minutes.` },
    ],
    'Biology': [
      { label: 'Plan a Biology lesson', desc: 'Visual models, investigation, real-world health/ecology links', prompt: `Plan a ${level} Biology lesson on [topic e.g. Cell Division]. Include visual models, collaborative investigation, and real-world applications in health or ecology. The lesson is [40/60] minutes.` },
    ],
    'English': [
      { label: 'Plan an English lesson', desc: 'Model texts, peer feedback, differentiated scaffolding', prompt: `Plan a ${level} English Language lesson on [topic e.g. Persuasive Writing / Comprehension]. Include model texts, collaborative peer feedback, and differentiated scaffolding. The lesson is [40/60] minutes.` },
      { label: 'English with structured discussion', desc: 'Socratic seminar, think-pair-share, sentence frames', prompt: `Design a ${level} English lesson on [text/theme] that develops CCI through structured academic discussion (e.g. Socratic seminar, think-pair-share). Include sentence frames for different ability levels.` },
    ],
    'History': [
      { label: 'Plan a History lesson', desc: 'Source-based inquiry, multiple perspectives, SBQ practice', prompt: `Plan a ${level} History lesson on [topic e.g. Fall of Singapore]. Use source-based inquiry, structured discussion, and multiple perspectives. Include an SBQ-style activity. The lesson is [40/60] minutes.` },
    ],
    'Geography': [
      { label: 'Plan a Geography lesson', desc: 'Data analysis, fieldwork skills, sustainability links', prompt: `Plan a ${level} Geography lesson on [topic e.g. Plate Tectonics / Tourism]. Include data analysis, fieldwork skills, and connections to sustainability (CGC). The lesson is [40/60] minutes.` },
    ],
    'Social Studies': [
      { label: 'Plan a Social Studies lesson', desc: 'Structured inquiry, source analysis, perspective-taking', prompt: `Plan a ${level} Social Studies lesson on [issue e.g. Governance / Diversity]. Use structured inquiry, source analysis, and develop CGC through perspective-taking activities. The lesson is [40/60] minutes.` },
    ],
    'Chinese': [
      { label: 'Plan a Chinese lesson', desc: 'Vocabulary building, model texts, peer interaction', prompt: `Plan a ${level} Chinese Language lesson on [topic e.g. 口语交际 / 阅读理解]. Include vocabulary building, model texts, and peer interaction activities. The lesson is [40/60] minutes.` },
    ],
    'Malay': [
      { label: 'Plan a Malay lesson', desc: 'Vocabulary enrichment, collaborative writing, cultural links', prompt: `Plan a ${level} Malay Language lesson on [topic e.g. Karangan / Kefahaman]. Include vocabulary enrichment, collaborative writing, and cultural connections. The lesson is [40/60] minutes.` },
    ],
    'Tamil': [
      { label: 'Plan a Tamil lesson', desc: 'Vocabulary strategies, model responses, peer review', prompt: `Plan a ${level} Tamil Language lesson on [topic e.g. கட்டுரை / படிப்புணர்வு]. Include vocabulary strategies, model responses, and peer review activities. The lesson is [40/60] minutes.` },
    ],
    'CCE': [
      { label: 'Plan a CCE lesson', desc: 'Values discussion, contemporary issues, SEL, CCE2021 Big Ideas', prompt: `Plan a ${level} CCE lesson on [topic e.g. Cyber Wellness / Responsible Decision-Making / National Identity]. Use the CCE2021 framework (Big Ideas: Identity, Relationships, Choices). Include a values-based discussion with facilitation strategies and an SEL component. The lesson is [40/60] minutes.` },
      { label: 'CCE contemporary issues discussion', desc: 'Structured discussion on a real-world issue with multiple perspectives', prompt: `Design a ${level} CCE discussion on [contemporary issue e.g. AI & Ethics / Social Media & Mental Health / Climate Change]. Use Structured Academic Controversy or Four Corners. Connect to R3ICH values and NE dispositions. Include a scenario set in Singapore.` },
      { label: 'CCE with NE focus', desc: 'National Education — Sense of Belonging, Hope, Reality, Will to Act', prompt: `Plan a ${level} CCE lesson with a National Education focus for [NE Commemorative Day e.g. Total Defence Day / Racial Harmony Day / International Friendship Day / National Day]. Develop NE dispositions: Sense of Belonging, Sense of Hope, Sense of Reality, and The Will to Act. The lesson is [40/60] minutes.` },
      { label: 'CCE Cyber Wellness lesson', desc: 'Digital citizenship, online safety, responsible tech use', prompt: `Plan a ${level} CCE Cyber Wellness lesson on [topic e.g. Digital Footprint / Cyberbullying / Screen Time Management / Online Scams]. Address the Sense & Think, Feel & Relate dimensions. Include a realistic scenario involving social media or online interactions in a Singapore school context. Connect to R3ICH values (Responsibility, Respect) and E21CC (CGC). The lesson is [40/60] minutes.` },
      { label: 'CCE Mental Health & SEL', desc: 'Resilience, peer support, help-seeking, emotional regulation', prompt: `Plan a ${level} CCE Mental Health lesson on [topic e.g. Managing Exam Stress / Peer Support / Help-Seeking / Building Resilience]. Develop SEL competencies: Self-Awareness and Self-Management. Include a mindfulness or reflective activity, a scenario-based discussion, and strategies students can apply. Connect to R3ICH value of Resilience. The lesson is [40/60] minutes.` },
      { label: 'CCE Education & Career Guidance', desc: 'Self-discovery, career exploration, MySkillsFuture', prompt: `Plan a ${level} CCE ECG lesson on [topic e.g. Discovering My Strengths / Exploring Career Pathways / Work Values / Post-Secondary Options]. Help students develop self-awareness of interests, abilities, and values. Include a reflective activity (e.g. strengths inventory or values card sort) and connect to MySkillsFuture portal. The lesson is [40/60] minutes.` },
    ],
  };

  // Match subject-specific prompts
  if (hasSub) {
    for (const [key, bank] of Object.entries(subjectBank)) {
      if (subj.toLowerCase().includes(key.toLowerCase())) {
        prompts.push(...bank);
        break;
      }
    }
  }

  // Default subject prompt if no match
  if (prompts.length === 0) {
    prompts.push({ label: 'Plan a lesson', desc: 'Engaging activities, clear outcomes, E21CC development', prompt: `Plan a ${level} ${subj} lesson on [topic]. Include engaging activities, clear learning outcomes, and opportunities for student collaboration and E21CC development. The lesson is [40/60] minutes.` });
  }

  // Universal prompts (always available)
  prompts.push({ label: 'Develop CAIT in my lesson', desc: 'Critical & Inventive Thinking with concrete activities', prompt: `How can I intentionally develop Critical, Adaptive & Inventive Thinking (CAIT) in a ${level} ${subj} lesson on [topic]? Suggest 2-3 concrete activities with EdTech integration.` });
  prompts.push({ label: 'Differentiate for my class', desc: 'Scaffolding for weaker + extension for stronger learners', prompt: `Suggest differentiation strategies for a ${level} ${subj} lesson on [topic]. I have students who [need more scaffolding / are advanced / have specific learning needs]. Include both support and extension options.` });
  prompts.push({ label: 'E21CC across all domains', desc: 'Activities that build CAIT, CCI, and CGC together', prompt: `Suggest classroom activities for ${level} ${subj} that build all three E21CC domains: CAIT, CCI, and CGC. The topic is [topic]. Make activities practical for a [40/60]-minute lesson.` });
  prompts.push({ label: 'Lesson starter hooks', desc: '3 motivating openers that connect to students\' lives', prompt: `Suggest 3 lesson starter hooks for ${level} ${subj} on [topic] that are motivating and connect to students' lives. Include at least one EdTech-enhanced option.` });

  // EEE-aware prompts
  const eeeSelections = getEEESelections();
  if (eeeSelections.includes('stimulus')) {
    prompts.push({ label: 'Create stimulus material', desc: 'Comprehension passage or source with guided questions', prompt: `Create a comprehension passage or source text for ${level} ${subj} on [topic]. The passage should be [200-400] words, suitable for [ability level], and include 3-4 guided questions.` });
  }
  if (eeeSelections.includes('vocabulary')) {
    prompts.push({ label: 'Build a word wall', desc: 'Key terms, definitions, sentence frames, cloze passage', prompt: `Create a vocabulary word wall for ${level} ${subj} on [topic]. Include key terms with definitions, sentence frames, and one cloze passage for practice.` });
  }
  if (eeeSelections.includes('cceDiscussion')) {
    prompts.push({ label: 'CCE values discussion', desc: 'Structured CCE discussion with R3ICH values and scenario', prompt: `Create a CCE values discussion for ${level} students on [topic/issue]. Include a Singapore-context scenario, guiding questions linked to R3ICH values, and a facilitation strategy (Four Corners / Hot Seat / Circle Structure).` });
  }

  return prompts.slice(0, 6);
}

/* ══════════ Load existing lesson ══════════ */
export function renderForLesson(container, { id }) {
  const lesson = Store.getLesson(id);
  if (!lesson) { navigate('/lessons'); return; }
  currentLessonId = id;
  chatMessages = [...(lesson.chatHistory || [])];
  render(container);
}

/* ── AI Tool definitions for compact toolbar ── */
const AI_TOOLS = [
  // Core tools (always visible)
  { id: 'ai-lisc-btn', label: 'LI / SC', icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>', color: 'var(--brand-navy, #000c53)', cat: 'planning', eee: 'lisc' },
  { id: 'ai-review-btn', label: 'Review', icon: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M8 11l2 2 4-4"/>', color: '', cat: 'planning', eee: 'review' },
  { id: 'ai-rubric-btn', label: 'Rubric', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>', color: '', cat: 'assess', eee: 'rubric' },
  { id: 'ai-group-btn', label: 'Grouping', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', color: '', cat: 'planning', eee: 'grouping' },
  { id: 'ai-timeline-btn', label: 'Timeline', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', color: '', cat: 'planning', eee: 'timeline' },
  { id: 'ai-exit-ticket-btn', label: 'Exit Ticket', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', color: '', cat: 'assess', eee: 'exitTicket' },
  { id: 'ai-differentiation-btn', label: 'Differentiate', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>', color: '', cat: 'planning', eee: 'differentiation' },
  { id: 'ai-discussion-btn', label: 'Discussion', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>', color: '', cat: 'planning', eee: 'discussionPrompts' },
  // Enactment Enhancements (filtered by EEE selection)
  { id: 'ai-youtube-btn', label: 'YouTube', icon: '<polygon points="5 3 19 12 5 21 5 3"/>', color: '#ff0000', cat: 'enactment', eee: 'youtubeVideos' },
  { id: 'ai-simulations-btn', label: 'Simulations', icon: '<path d="M9 3h6v3H9z"/><path d="M7 6h10l2 4-4 3 4 3-2 5H7l-2-5 4-3-4-3z"/>', color: '#8b5cf6', cat: 'enactment', eee: 'simulations' },
  { id: 'ai-worksheet-btn', label: 'Worksheet', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>', color: '', cat: 'enactment', eee: 'worksheet' },
  { id: 'ai-external-btn', label: 'Resources', icon: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>', color: '', cat: 'enactment', eee: 'externalLinks' },
  { id: 'ai-stimulus-btn', label: 'Stimulus', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>', color: '#0ea5e9', cat: 'enactment', eee: 'stimulus' },
  { id: 'ai-vocabulary-btn', label: 'Vocabulary', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', color: '#06b6d4', cat: 'enactment', eee: 'vocabulary' },
  { id: 'ai-model-response-btn', label: 'Model Resp.', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>', color: '#d946ef', cat: 'enactment', eee: 'modelResponse' },
  { id: 'ai-source-analysis-btn', label: 'Source Analysis', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>', color: '#f97316', cat: 'enactment', eee: 'sourceAnalysis' },
  { id: 'ai-cce-btn', label: 'CCE Discussion', icon: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>', color: '#e11d48', cat: 'enactment', eee: 'cceDiscussion' },
  { id: 'spatial-layout-btn', label: 'Spatial Layout', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>', color: '', cat: 'planning', eee: 'seatPlan' }
];

function buildToolbarHTML(mode) {
  // Filter tools based on EEE selections
  const visibleTools = AI_TOOLS.filter(t => isEEEEnabled(t.eee));

  if (mode === 'dropdown') {
    const cats = { planning: 'Planning', assess: 'Assessment', enactment: 'Enactment' };
    return Object.entries(cats).map(([cat, label]) => {
      const tools = visibleTools.filter(t => t.cat === cat);
      if (tools.length === 0) return '';
      return `<div style="margin-bottom:var(--sp-2);">
        <div style="font-size:0.625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);margin-bottom:2px;">${label}</div>
        ${tools.map(t => `<button class="btn btn-ghost btn-sm" id="${t.id}" title="${t.label}" style="width:100%;text-align:left;justify-content:flex-start;gap:var(--sp-2);${t.color ? 'color:' + t.color + ';' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.icon}</svg>
          <span style="font-size:0.8125rem;">${t.label}</span>
        </button>`).join('')}
      </div>`;
    }).join('');
  }
  // Icon mode — compact buttons with tooltip on hover, filtered by EEE
  return visibleTools.map(t =>
    `<button class="btn btn-ghost btn-sm lp-tool-icon" id="${t.id}" title="${t.label}" style="padding:6px;${t.color ? 'color:' + t.color + ';' : ''}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.icon}</svg>
    </button>`
  ).join('');
}

/* ══════════ Main render ══════════ */
export function render(container) {
  const classes = Store.getClasses();
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;

  // Pick up "Plan from Class" context from sessionStorage
  const planClassId = sessionStorage.getItem('cocher_plan_class_id');
  if (planClassId && !currentLessonId && chatMessages.length === 0) {
    planClassContext = {
      id: planClassId,
      name: sessionStorage.getItem('cocher_plan_class_name') || '',
      subject: sessionStorage.getItem('cocher_plan_class_subject') || '',
      level: sessionStorage.getItem('cocher_plan_class_level') || ''
    };
    sessionStorage.removeItem('cocher_plan_class_id');
    sessionStorage.removeItem('cocher_plan_class_name');
    sessionStorage.removeItem('cocher_plan_class_subject');
    sessionStorage.removeItem('cocher_plan_class_level');
  }

  // Pick up reflection insights from previous lesson
  const reflectionInsightsRaw = sessionStorage.getItem('cocher_reflection_insights');
  let reflectionInsights = null;
  if (reflectionInsightsRaw && !currentLessonId && chatMessages.length === 0) {
    try {
      reflectionInsights = JSON.parse(reflectionInsightsRaw);
      sessionStorage.removeItem('cocher_reflection_insights');
    } catch {}
  } else {
    sessionStorage.removeItem('cocher_reflection_insights');
  }

  // Pick up spatial layout link from Spatial Designer
  const incomingSpatialId = sessionStorage.getItem('cocher_link_spatial_layout');
  if (incomingSpatialId) {
    sessionStorage.removeItem('cocher_link_spatial_layout');
    // If we have an existing lesson, link it; otherwise store for linking on save
    if (currentLessonId) {
      Store.updateLesson(currentLessonId, { spatialLayout: incomingSpatialId });
    }
    // Store so the spatial section renders the link
    if (!currentLessonId) {
      sessionStorage.setItem('cocher_pending_spatial_layout', incomingSpatialId);
    }
  }

  // Status badge for current lesson
  const statusBadgeHTML = currentLesson ? (() => {
    const colors = { draft: 'badge-gray', ready: 'badge-blue', completed: 'badge-green' };
    const labels = { draft: 'Draft', ready: 'Ready', completed: 'Done' };
    return `<span class="badge ${colors[currentLesson.status] || 'badge-gray'} badge-dot">${labels[currentLesson.status] || 'Draft'}</span>`;
  })() : '';

  container.innerHTML = `
    <div style="padding:var(--sp-2) var(--sp-3) 0;">
      ${renderWorkflowBreadcrumb('plan')}
    </div>
    <div class="lp-layout" id="lp-layout" style="height:calc(100% - 44px);overflow:hidden;">
      <!-- Chat Column -->
      <div class="lp-chat-col" style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;">
        <div class="chat-header" style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <div>
              <div class="chat-header-title">Co-Cher Assistant</div>
              <div class="chat-header-subtitle">Lesson experience, design & planning</div>
            </div>
            ${statusBadgeHTML}
          </div>
          <div style="display:flex;gap:var(--sp-2);align-items:center;">
            <button class="lp-panel-toggle" id="show-plan-btn" title="View plan canvas">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Canvas
            </button>
            ${chatMessages.length >= 2 ? `
              <button class="btn btn-ghost btn-sm" id="undo-btn" title="Undo last exchange">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm" id="new-chat-btn" title="New conversation">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>
          </div>
        </div>

        ${planClassContext ? `
          <div class="chat-context-banner" id="class-context-banner" style="flex-shrink:0;padding:var(--sp-2) var(--sp-4);background:var(--accent-light);border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:0.8125rem;color:var(--accent-dark);">
              <strong>Planning for:</strong> ${planClassContext.name}${planClassContext.subject ? ' · ' + planClassContext.subject : ''}${planClassContext.level ? ' · ' + planClassContext.level : ''}
            </span>
            <button class="btn btn-ghost btn-sm" id="clear-class-context" style="padding:2px 6px;font-size:0.75rem;">Clear</button>
          </div>
        ` : ''}

        ${reflectionInsights ? `
          <div id="reflection-insights-banner" style="flex-shrink:0;padding:var(--sp-2) var(--sp-4);background:linear-gradient(90deg, rgba(99,102,241,0.08), rgba(236,72,153,0.06));border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.4;">
              <strong style="color:var(--accent);">Reflection insights loaded</strong> from "${esc(reflectionInsights.fromLesson)}" — Co-Cher will use these to inform your next lesson.
            </span>
            <button class="btn btn-ghost btn-sm" id="clear-reflection-insights" style="padding:2px 6px;font-size:0.75rem;">Dismiss</button>
          </div>
        ` : ''}

        <!-- KB Context Attachments -->
        <div id="kb-context-bar" style="flex-shrink:0;${attachedKBContext.length > 0 ? '' : 'display:none;'}padding:var(--sp-2) var(--sp-4);background:var(--bg-subtle);border-bottom:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;">
            <span style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);">Context:</span>
            <div id="kb-chips" style="display:flex;gap:var(--sp-1);flex-wrap:wrap;"></div>
          </div>
        </div>

        <div class="chat-messages" id="chat-messages" style="flex:1;min-height:0;overflow-y:auto;"></div>

        <div class="chat-input-row" style="flex-shrink:0;">
          <div class="chat-composer">
            <div class="chat-composer-toolbar">
              <button class="btn btn-ghost btn-sm" id="attach-kb-btn" title="Attach Knowledge Base resource as context">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Attach Context
              </button>
              <select id="ideology-lens" class="input" title="Optional: frame lesson through a curriculum ideology" style="width:auto;padding:2px 8px;font-size:0.6875rem;color:var(--ink-muted);border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-card);height:28px;">
                <option value="">Ideology lens (optional)</option>
                <option value="learner-centred" ${selectedIdeology === 'learner-centred' ? 'selected' : ''}>Learner-Centred</option>
                <option value="scholar-academic" ${selectedIdeology === 'scholar-academic' ? 'selected' : ''}>Scholar-Academic</option>
                <option value="social-efficiency" ${selectedIdeology === 'social-efficiency' ? 'selected' : ''}>Social Efficiency</option>
                <option value="social-reconstructivist" ${selectedIdeology === 'social-reconstructivist' ? 'selected' : ''}>Social Reconstructivist</option>
              </select>
            </div>
            <textarea class="chat-input" id="chat-input" placeholder="${planClassContext ? `Plan a lesson for ${planClassContext.name}...` : 'Describe your lesson idea, ask about spatial design, or explore frameworks...'}" rows="3"></textarea>
            <div class="chat-composer-footer">
              <span style="font-size:0.6875rem;color:var(--ink-faint);">Shift+Enter for new line</span>
              <button class="chat-send" id="chat-send" ${isGenerating ? 'disabled' : ''}>Send</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Resize Handle -->
      <div class="resize-handle" id="lp-resize-handle"></div>

      <!-- Plan Column -->
      <div class="lp-plan-col" style="background:var(--bg);">
        <div style="flex:1;overflow-y:auto;padding:var(--sp-6);">
          <div style="max-width:680px;margin:0 auto;width:100%;box-sizing:border-box;">
            <!-- Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-6);flex-wrap:wrap;gap:var(--sp-2);">
              <div style="display:flex;align-items:center;gap:var(--sp-2);">
                <button class="lp-panel-toggle" id="show-chat-btn" title="Back to chat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                  Chat
                </button>
                <div>
                  <h2 style="font-size:1.125rem;font-weight:600;color:var(--ink);">Lesson Canvas</h2>
                  <p style="font-size:0.8125rem;color:var(--ink-muted);">
                    ${currentLessonId ? `Editing: ${currentLesson?.title || 'Lesson'}` : 'New lesson — save when ready'}
                  </p>
                </div>
              </div>
              <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" id="save-lesson-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save
                </button>
                <button class="btn btn-ghost btn-sm" id="export-pdf-btn" title="Export as printable page">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
                <button class="btn btn-ghost btn-sm" id="export-word-btn" title="Export as Word document (.doc)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Word
                </button>
                <button class="btn btn-ghost btn-sm" id="snapshot-btn" title="Lesson snapshot — compact printable summary card">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="8" y1="8" x2="8" y2="21"/></svg>
                  Snapshot
                </button>
                <button class="btn btn-ghost btn-sm" id="share-lesson-btn" title="Share lesson with a colleague (export/import JSON)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
                <div style="position:relative;display:inline-block;">
                  <button class="btn btn-ghost btn-sm" id="templates-btn" title="Start from a lesson template">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    Templates
                  </button>
                </div>
              </div>
            </div>

            <!-- Lesson Date/Time -->
            <div id="lesson-datetime-bar" style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-4);padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);flex-wrap:wrap;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input type="date" id="lesson-date" class="input" style="width:auto;padding:4px 8px;font-size:0.8125rem;" />
              <select id="lesson-period" class="input" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
                <option value="">Period</option>
                <option value="1">P1 (7:30)</option><option value="2">P2 (8:10)</option>
                <option value="3">P3 (8:50)</option><option value="4">P4 (9:30)</option>
                <option value="5">P5 (10:20)</option><option value="6">P6 (11:00)</option>
                <option value="7">P7 (11:40)</option><option value="8">P8 (12:20)</option>
                <option value="9">P9 (1:10)</option><option value="10">P10 (1:50)</option>
                <option value="11">P11 (2:30)</option>
              </select>
              <div id="lesson-tt-hint" style="font-size:0.75rem;color:var(--ink-muted);flex:1;min-width:120px;"></div>
            </div>

            <!-- AI Tools Bar (compact icons with tooltips, toggleable to dropdown) -->
            <div id="ai-tools-bar" style="margin-bottom:var(--sp-4);">
              <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2);">
                <span style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);">AI Tools</span>
                <button class="btn btn-ghost btn-sm" id="toggle-toolbar-mode" title="Switch between icon bar and dropdown" style="padding:2px 6px;font-size:0.625rem;color:var(--ink-faint);">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>
              <div id="ai-tools-icons" style="display:flex;flex-wrap:wrap;gap:4px;">
                ${buildToolbarHTML(getLPPrefs().toolbarMode || 'icons')}
              </div>
            </div>

            <!-- Spatial Context Bar (when layout linked) -->
            <div id="spatial-context-bar" style="display:none;margin-bottom:var(--sp-4);"></div>

            <!-- Plan Content -->
            <div id="plan-content"></div>

            <!-- Integrated Lesson Components (persistent AI tool results) -->
            <div id="lesson-components"></div>

            <!-- Spatial Layout Section -->
            <div id="spatial-section" style="margin-top:var(--sp-4);"></div>

            <!-- Linked Resources Section -->
            <div id="linked-resources-section" style="margin-top:var(--sp-4);"></div>

            <!-- Temporary loading/status area -->
            <div id="ai-result" style="margin-top:var(--sp-4);"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const messagesEl = container.querySelector('#chat-messages');
  const chatInput = container.querySelector('#chat-input');
  const chatSend = container.querySelector('#chat-send');
  const layoutEl = container.querySelector('#lp-layout');

  // Load components from existing lesson
  if (currentLessonId) {
    const existingLesson = Store.getLesson(currentLessonId);
    if (existingLesson?.components) {
      lessonComponents = { ...existingLesson.components };
    }
  }

  // Render initial messages
  renderMessages(messagesEl, classes);
  renderPlanContent(container.querySelector('#plan-content'));
  renderComponents(container);

  // Mobile panel toggle
  const showPlanBtn = container.querySelector('#show-plan-btn');
  const showChatBtn = container.querySelector('#show-chat-btn');
  if (showPlanBtn) {
    showPlanBtn.addEventListener('click', () => layoutEl.classList.add('show-plan'));
  }
  if (showChatBtn) {
    showChatBtn.addEventListener('click', () => layoutEl.classList.remove('show-plan'));
  }

  // Resizable panels
  initResizeHandle(
    container.querySelector('#lp-resize-handle'),
    container.querySelector('.lp-chat-col'),
    container.querySelector('.lp-plan-col'),
    layoutEl
  );

  // Workflow breadcrumb clicks
  bindWorkflowClicks(container);

  // New chat
  container.querySelector('#new-chat-btn').addEventListener('click', () => {
    chatMessages = [];
    currentLessonId = null;
    isGenerating = false;
    lessonComponents = {};
    render(container);
  });

  // Undo last exchange
  const undoBtn = container.querySelector('#undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Undo Last Exchange',
        message: 'Remove the last user message and AI response?',
        confirmLabel: 'Undo',
        cancelLabel: 'Cancel'
      });
      if (!confirmed) return;

      // Remove last AI message and last user message
      if (chatMessages.length >= 2) {
        const lastAi = chatMessages.length - 1;
        const lastUser = chatMessages.length - 2;
        if (chatMessages[lastAi]?.role === 'assistant' && chatMessages[lastUser]?.role === 'user') {
          chatMessages.splice(lastUser, 2);
        } else {
          chatMessages.pop();
        }
      } else if (chatMessages.length === 1) {
        chatMessages.pop();
      }
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { chatHistory: [...chatMessages] });
      }
      render(container);
      showToast('Last exchange removed.', 'success');
    });
  }

  // Send message
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isGenerating) return;
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    // Build context-enriched message
    let contextParts = [];
    if (planClassContext && chatMessages.length === 0) {
      contextParts.push(`[Class Context: ${planClassContext.name}, ${planClassContext.level} ${planClassContext.subject}]`);
    }
    // Inject spatial layout context if linked
    if (chatMessages.length === 0) {
      const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
      const linkedLayoutId = currentLesson?.spatialLayout;
      if (linkedLayoutId) {
        const layout = (Store.getSavedLayouts() || []).find(l => l.id === linkedLayoutId);
        if (layout) {
          const presetLabel = PRESET_NAMES[layout.preset] || 'Custom';
          contextParts.push(`[Spatial Layout: ${presetLabel} arrangement, ${layout.studentCount || '?'} students, ${layout.items?.length || 0} furniture items]`);
        }
      }
    }
    // KB context — attach on every message where KB is attached
    if (attachedKBContext.length > 0) {
      contextParts.push(...attachedKBContext.map(kb =>
        `[Reference — ${kb.title}]:\n${kb.content.slice(0, 2000)}`
      ));
    }
    // Auto-attach SoW if available and first message (background context)
    if (chatMessages.length === 0) {
      const sowUploads = (Store.get('knowledgeUploads') || []).filter(u => u.category === 'Scheme of Work');
      sowUploads.forEach(sow => {
        if (!attachedKBContext.some(kb => kb.id === sow.id)) {
          contextParts.push(`[Scheme of Work — ${sow.title}]:\n${sow.content.slice(0, 3000)}`);
        }
      });
      // Inject reflection insights from previous lesson
      if (reflectionInsights) {
        contextParts.push(`[Post-Lesson Reflection from "${reflectionInsights.fromLesson}"]:\n${reflectionInsights.insights}\n\nPlease use these insights to inform the lesson plan — build on what worked and address what needs adjustment.`);
      }
      // Inject pedagogical priorities
      const pedPriorities = Store.get('pedagogicalPriorities');
      if (pedPriorities && pedPriorities.length > 0) {
        const priorityLabels = {
          differentiation: 'Differentiation', assessment: 'Assessment Literacy',
          engagement: 'Student Engagement', e21cc: 'E21CC Development',
          edtech: 'EdTech Integration', inquiry: 'Inquiry-Based Learning',
          sel: 'SEL & Well-being', cce: 'CCE & Values'
        };
        contextParts.push(`[Teacher's pedagogical priorities this year: ${pedPriorities.map(p => priorityLabels[p] || p).join(', ')}]`);
      }
    }
    // Ideology lens
    if (selectedIdeology) {
      const ideologyLabels = {
        'learner-centred': 'Learner-Centred (student needs, interests, and agency at the centre)',
        'scholar-academic': 'Scholar-Academic (disciplinary knowledge, rigour, and intellectual traditions)',
        'social-efficiency': 'Social Efficiency (skills for workforce readiness and societal function)',
        'social-reconstructivist': 'Social Reconstructivist (critical consciousness, social justice, and transformative action)',
      };
      contextParts.push(`[Curriculum Ideology Lens: ${ideologyLabels[selectedIdeology] || selectedIdeology}. Frame the lesson design, activity choices, and assessment approach through this orientation where it naturally fits.]`);
    }

    const enrichedContent = contextParts.length > 0
      ? `${contextParts.join('\n\n')}\n\n${text}`
      : text;

    chatMessages.push({ role: 'user', content: enrichedContent });
    chatInput.value = '';
    chatInput.style.height = 'auto';
    isGenerating = true;
    renderMessages(messagesEl, classes);

    try {
      const response = await sendChat(chatMessages);
      chatMessages.push({ role: 'assistant', content: response });
    } catch (err) {
      chatMessages.push({ role: 'assistant', content: `I encountered an error: ${err.message}` });
      showToast(err.message, 'danger');
    } finally {
      isGenerating = false;
      renderMessages(messagesEl, classes);
      renderPlanContent(container.querySelector('#plan-content'));
      // Auto-save if editing existing lesson
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { chatHistory: [...chatMessages] });
      }
    }
  }

  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
  });

  // Class context banner
  container.querySelector('#clear-class-context')?.addEventListener('click', () => {
    planClassContext = null;
    container.querySelector('#class-context-banner')?.remove();
    chatInput.placeholder = 'Describe your lesson idea, ask about spatial design, or explore frameworks...';
  });

  // Dismiss reflection insights
  container.querySelector('#clear-reflection-insights')?.addEventListener('click', () => {
    reflectionInsights = null;
    container.querySelector('#reflection-insights-banner')?.remove();
  });

  // Ideology lens
  container.querySelector('#ideology-lens')?.addEventListener('change', (e) => {
    selectedIdeology = e.target.value;
  });

  // KB context chips
  renderKBChips(container);

  // Attach KB context
  container.querySelector('#attach-kb-btn')?.addEventListener('click', () => {
    showAttachKBModal(container);
  });

  // Quick prompts
  messagesEl.addEventListener('click', e => {
    const btn = e.target.closest('.quick-prompt');
    if (btn) {
      chatInput.value = btn.dataset.prompt;
      chatInput.focus();
      // Select the first [placeholder] for easy editing
      const match = btn.dataset.prompt.match(/\[([^\]]+)\]/);
      if (match) {
        const idx = btn.dataset.prompt.indexOf(match[0]);
        chatInput.setSelectionRange(idx, idx + match[0].length);
      }
    }
  });

  // Save lesson
  container.querySelector('#save-lesson-btn').addEventListener('click', () => showSaveModal(classes));

  // Print / Export (includes all components)
  container.querySelector('#export-pdf-btn').addEventListener('click', () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
      showToast('No lesson content to print yet.', 'danger'); return;
    }
    const printWin = window.open('', '_blank');
    const planHtml = aiMsgs.map(m => md(m.content)).join('<hr style="margin:24px 0;">');

    // Build components HTML for print
    const compKeys = Object.keys(lessonComponents)
      .filter(k => lessonComponents[k]?.content)
      .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));
    const componentsHtml = compKeys.length > 0
      ? `<hr style="margin:32px 0;border-top:2px solid #000c53;"><h2>Lesson Components</h2>` +
        compKeys.map(key => {
          const m = COMPONENT_META[key] || { label: key };
          return `<h3>${m.label}</h3>${md(lessonComponents[key].content)}`;
        }).join('<hr style="margin:24px 0;">')
      : '';

    printWin.document.write(`<!DOCTYPE html><html><head><title>Lesson Plan — Co-Cher</title>
      <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.7;font-size:14px}
      h1{font-size:18px;border-bottom:2px solid #000c53;padding-bottom:8px;color:#000c53}
      h2,h3,h4{margin:16px 0 8px}strong{font-weight:600}ul,ol{padding-left:20px}
      hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
      pre{background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto}
      @media print{body{margin:0;padding:16px}}</style></head>
      <body><h1>Lesson Plan</h1><p style="color:#64748b;font-size:12px;">Exported from Co-Cher · ${new Date().toLocaleDateString('en-SG')}</p>${planHtml}${componentsHtml}</body></html>`);
    printWin.document.close();
    printWin.print();
  });

  // Lesson Snapshot — compact printable summary card
  container.querySelector('#snapshot-btn')?.addEventListener('click', () => {
    const compKeys = Object.keys(lessonComponents)
      .filter(k => lessonComponents[k]?.content)
      .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));

    if (compKeys.length === 0 && chatMessages.filter(m => m.role === 'assistant').length === 0) {
      showToast('No lesson content to snapshot yet.', 'danger'); return;
    }

    const printWin = window.open('', '_blank');
    const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
    const title = currentLesson?.title || 'Lesson Plan';
    const dateStr = new Date().toLocaleDateString('en-SG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const cls = planClassContext || {};
    const contextLine = [cls.name, cls.subject, cls.level].filter(Boolean).join(' · ') || '';

    // Build compact sections from components
    const sections = [];

    // LI/SC first (most important)
    if (lessonComponents.lisc?.content) {
      sections.push(`<div class="snap-section snap-lisc"><h3>Learning Intentions & Success Criteria</h3>${md(lessonComponents.lisc.content)}</div>`);
    }

    // Timeline
    if (lessonComponents.timeline?.content) {
      sections.push(`<div class="snap-section"><h3>Timeline / Pacing</h3>${md(lessonComponents.timeline.content)}</div>`);
    }

    // Groups
    if (lessonComponents.grouping?.content) {
      sections.push(`<div class="snap-section"><h3>Student Groups</h3>${md(lessonComponents.grouping.content)}</div>`);
    }

    // Seat Plan
    if (lessonComponents.seatPlan?.content) {
      sections.push(`<div class="snap-section"><h3>Seating Plan</h3>${md(lessonComponents.seatPlan.content)}</div>`);
    }

    // Exit Ticket
    if (lessonComponents.exitTicket?.content) {
      sections.push(`<div class="snap-section"><h3>Exit Ticket</h3>${md(lessonComponents.exitTicket.content)}</div>`);
    }

    // Resources (YouTube + Simulations + External — compact)
    const resourceKeys = ['youtubeVideos', 'simulations', 'externalLinks'].filter(k => lessonComponents[k]?.content);
    if (resourceKeys.length > 0) {
      sections.push(`<div class="snap-section"><h3>Resources</h3>${resourceKeys.map(k => md(lessonComponents[k].content)).join('<br>')}</div>`);
    }

    // Differentiation
    if (lessonComponents.differentiation?.content) {
      sections.push(`<div class="snap-section"><h3>Differentiation</h3>${md(lessonComponents.differentiation.content)}</div>`);
    }

    // Key points from chat (first assistant message only, as overview)
    const firstAiMsg = chatMessages.find(m => m.role === 'assistant');
    if (firstAiMsg && !lessonComponents.lisc?.content && !lessonComponents.timeline?.content) {
      const preview = firstAiMsg.content.length > 800 ? firstAiMsg.content.slice(0, 800) + '...' : firstAiMsg.content;
      sections.push(`<div class="snap-section"><h3>Lesson Overview</h3>${md(preview)}</div>`);
    }

    printWin.document.write(`<!DOCTYPE html><html><head><title>Lesson Snapshot — ${esc(title)}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:system-ui,-apple-system,sans-serif;max-width:750px;margin:0 auto;padding:20px 24px;color:#1e293b;line-height:1.6;font-size:13px}
        .snap-header{border-bottom:3px solid #000c53;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end}
        .snap-header h1{font-size:17px;color:#000c53;margin:0}
        .snap-header .meta{font-size:11px;color:#64748b;text-align:right}
        .snap-section{margin-bottom:14px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;break-inside:avoid}
        .snap-section h3{font-size:12px;text-transform:uppercase;letter-spacing:0.03em;color:#000c53;margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
        .snap-lisc{background:#f0f4ff;border-color:#000c53}
        table{width:100%;border-collapse:collapse;margin:6px 0;font-size:12px}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f8fafc}
        strong{font-weight:600}ul,ol{padding-left:18px;margin:4px 0}li{margin:2px 0}
        a{color:#4361ee;text-decoration:none}
        blockquote{border-left:3px solid #4361ee;padding:6px 10px;margin:6px 0;background:#f0f4ff;font-size:12px}
        pre{background:#f1f5f9;padding:8px;border-radius:4px;font-size:11px;overflow-x:auto}
        .snap-footer{margin-top:16px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
        @media print{body{margin:0;padding:12px}.snap-section{page-break-inside:avoid}}
      </style></head>
      <body>
        <div class="snap-header">
          <div><h1>${esc(title)}</h1>${contextLine ? `<div style="font-size:12px;color:#475569;margin-top:2px;">${esc(contextLine)}</div>` : ''}</div>
          <div class="meta">${dateStr}<br>Co-Cher Snapshot</div>
        </div>
        ${sections.join('')}
        <div class="snap-footer">Generated by Co-Cher · Teacher-reviewed and approved</div>
      </body></html>`);
    printWin.document.close();
    printWin.print();
  });

  // LI / SC Generator
  container.querySelector('#ai-lisc-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating Learning Intentions & Success Criteria...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await generateLISC(planText, cls.subject, cls.level);
      setComponent('lisc', result, cls.subject || 'LI/SC');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Learning Intentions & Success Criteria generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // AI Review
  container.querySelector('#ai-review-btn')?.addEventListener('click', async () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Reviewing your lesson plan...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = aiMsgs.map(m => m.content).join('\n\n');
      const review = await reviewLesson(planText);
      setComponent('review', review);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Lesson review added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Review failed: ${err.message}</div>`;
    }
  });

  // AI Rubric
  container.querySelector('#ai-rubric-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const topic = chatMessages.find(m => m.role === 'user')?.content || 'General lesson';
    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Generating rubric...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const rubric = await generateRubric(topic);
      setComponent('rubric', rubric);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Rubric added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Rubric generation failed: ${err.message}</div>`;
    }
  });

  // AI Grouping
  container.querySelector('#ai-group-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const allClasses = Store.getClasses();
    if (allClasses.length === 0 || allClasses.every(c => !c.students?.length)) {
      showToast('No students found. Add students to a class first.', 'danger');
      return;
    }
    showGroupingModal(container, allClasses);
  });

  // AI Timeline
  container.querySelector('#ai-timeline-btn')?.addEventListener('click', () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    showTimelineModal(container);
  });

  // AI Exit Ticket
  container.querySelector('#ai-exit-ticket-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Generating exit ticket questions...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = aiMsgs.map(m => m.content).join('\n\n');
      const subject = planClassContext?.subject || '';
      const level = planClassContext?.level || '';
      const ticket = await generateExitTicket(planText, subject, level);
      setComponent('exitTicket', ticket);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Exit ticket added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Exit ticket generation failed: ${err.message}</div>`;
    }
  });

  // AI Differentiation
  container.querySelector('#ai-differentiation-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    // Need a class with students for differentiation
    const allClasses = Store.getClasses().filter(c => c.students?.length > 0);
    if (allClasses.length === 0) { showToast('No students found. Add students to a class first.', 'danger'); return; }

    showDifferentiationModal(container, allClasses);
  });

  // YouTube recommendations
  container.querySelector('#ai-youtube-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Finding YouTube recommendations...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await suggestYouTubeVideos(planText, cls.subject, cls.level);
      setComponent('youtubeVideos', result, cls.subject || 'Videos');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('YouTube recommendations added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Simulation Models
  container.querySelector('#ai-simulations-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Finding simulation models...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await suggestSimulations(planText, cls.subject, cls.level);
      setComponent('simulations', result, cls.subject || 'Simulations');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Simulation suggestions added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Worksheet Generator
  container.querySelector('#ai-worksheet-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating worksheet...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateWorksheet(planText, cls.subject, cls.level);
      setComponent('worksheet', result, cls.subject || 'Worksheet');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Worksheet generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Discussion Prompts
  container.querySelector('#ai-discussion-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating discussion prompts...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateDiscussionPrompts(planText, cls.subject, cls.level);
      setComponent('discussionPrompts', result, cls.subject || 'Discussion');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Discussion prompts generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // External Resources
  container.querySelector('#ai-external-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Finding external resources...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await suggestExternalResources(planText, cls.subject, cls.level);
      setComponent('externalLinks', result, cls.subject || 'Resources');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('External resources added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // EEE: Stimulus Material
  container.querySelector('#ai-stimulus-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating stimulus material...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateStimulusMaterial(planText, cls.subject, cls.level);
      setComponent('stimulus', result, cls.subject || 'Stimulus');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Stimulus material generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // EEE: Vocabulary Builder (structured form modal)
  container.querySelector('#ai-vocabulary-btn')?.addEventListener('click', () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const cls = planClassContext || {};
    const { backdrop, close } = openModal({
      title: 'Vocabulary Builder',
      body: `
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">Configure your vocabulary materials. Fill in the fields, then generate.</p>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Topic / Theme</label>
          <input class="input" id="vocab-topic" placeholder="e.g. Persuasive Writing Techniques, Chemical Bonding, Globalisation" value="" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-3);">
          <div class="input-group">
            <label class="input-label">Subject</label>
            <select class="input" id="vocab-subject">
              <option value="${cls.subject || ''}">${cls.subject || 'General'}</option>
              ${['English','Chinese','Malay','Tamil','History','Social Studies','Geography','Science','Mathematics','CCE','General Paper'].filter(s => s !== cls.subject).map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">Level</label>
            <select class="input" id="vocab-level">
              <option value="${cls.level || 'Secondary'}">${cls.level || 'Secondary'}</option>
              ${['Sec 1','Sec 2','Sec 3','Sec 4','Sec 5','JC 1','JC 2'].filter(l => l !== cls.level).map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Vocabulary Tier Focus</label>
          <select class="input" id="vocab-tier">
            <option value="mixed">Mixed (Tier 2 Academic + Tier 3 Technical)</option>
            <option value="tier2">Tier 2 — General Academic Vocabulary</option>
            <option value="tier3">Tier 3 — Subject-Specific Technical Terms</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Number of Terms</label>
          <select class="input" id="vocab-count">
            <option value="8-10">8-10 terms</option>
            <option value="10-15" selected>10-15 terms</option>
            <option value="15-20">15-20 terms</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Include (optional)</label>
          <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="sentence-frames" checked /> Sentence Frames</label>
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="cloze" checked /> Cloze Passage</label>
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="word-relationships" /> Word Relationships</label>
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="frayer-model" /> Frayer Models</label>
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">Additional Notes (optional)</label>
          <textarea class="input" id="vocab-notes" rows="2" placeholder="e.g. Focus on words students confuse, include L1 hints for ELL students..."></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="generate">Generate Vocabulary</button>
      `
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
    backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
      const topic = backdrop.querySelector('#vocab-topic').value.trim();
      if (!topic) { showToast('Please enter a topic.', 'danger'); return; }
      const subject = backdrop.querySelector('#vocab-subject').value;
      const level = backdrop.querySelector('#vocab-level').value;
      const tier = backdrop.querySelector('#vocab-tier').value;
      const count = backdrop.querySelector('#vocab-count').value;
      const includes = [...backdrop.querySelectorAll('.vocab-include:checked')].map(c => c.value);
      const notes = backdrop.querySelector('#vocab-notes').value.trim();
      const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
      const planContext = aiMsgs.length > 0 ? `\n\nLesson context:\n${aiMsgs[aiMsgs.length - 1].content.slice(0, 2000)}` : '';
      close();
      const resultEl = container.querySelector('#ai-result');
      resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Building vocabulary materials...</div>';
      resultEl.scrollIntoView({ behavior: 'smooth' });
      try {
        const prompt = `Generate vocabulary materials for: ${topic}\nSubject: ${subject}\nLevel: ${level}\nTier focus: ${tier}\nNumber of terms: ${count}\nInclude: ${includes.join(', ') || 'word wall only'}\n${notes ? `Teacher notes: ${notes}` : ''}${planContext}`;
        const result = await generateVocabulary(prompt, subject, level);
        setComponent('vocabulary', result, subject || 'Vocabulary');
        resultEl.innerHTML = '';
        renderComponents(container);
        showToast('Vocabulary materials generated!', 'success');
      } catch (err) {
        resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
      }
    });
  });

  // EEE: Model Response (structured form modal)
  container.querySelector('#ai-model-response-btn')?.addEventListener('click', () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const cls = planClassContext || {};
    const { backdrop, close } = openModal({
      title: 'Model Response Generator',
      body: `
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">Specify the question and criteria to generate an annotated model answer.</p>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Question / Task</label>
          <textarea class="input" id="mr-question" rows="3" placeholder="e.g. 'Explain how the author uses imagery to convey...' or 'Describe the effects of urbanisation on...'"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-3);">
          <div class="input-group">
            <label class="input-label">Subject</label>
            <select class="input" id="mr-subject">
              <option value="${cls.subject || ''}">${cls.subject || 'General'}</option>
              ${['English','Chinese','Malay','Tamil','History','Social Studies','Geography','Science','Mathematics','CCE','General Paper'].filter(s => s !== cls.subject).map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">Level</label>
            <select class="input" id="mr-level">
              <option value="${cls.level || 'Secondary'}">${cls.level || 'Secondary'}</option>
              ${['Sec 1','Sec 2','Sec 3','Sec 4','Sec 5','JC 1','JC 2'].filter(l => l !== cls.level).map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Response Type</label>
          <select class="input" id="mr-type">
            <option value="essay">Essay / Structured Response</option>
            <option value="short-answer">Short Answer (1-2 paragraphs)</option>
            <option value="worked-solution">Worked Solution (Maths/Science)</option>
            <option value="source-based">Source-Based Response (SBQ/SEQ)</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Band / Grade Target</label>
          <select class="input" id="mr-band">
            <option value="top-band">Top Band / A grade</option>
            <option value="mid-band">Mid Band / B-C grade</option>
            <option value="both">Show both (with comparison)</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Rubric / Mark Scheme (optional)</label>
          <textarea class="input" id="mr-rubric" rows="2" placeholder="Paste band descriptors or success criteria here..."></textarea>
        </div>
        <div class="input-group">
          <label class="input-label">Additional Instructions (optional)</label>
          <textarea class="input" id="mr-notes" rows="2" placeholder="e.g. Focus on PEEL structure, include counter-argument..."></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="generate">Generate Model Response</button>
      `
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
    backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
      const question = backdrop.querySelector('#mr-question').value.trim();
      if (!question) { showToast('Please enter a question or task.', 'danger'); return; }
      const subject = backdrop.querySelector('#mr-subject').value;
      const level = backdrop.querySelector('#mr-level').value;
      const type = backdrop.querySelector('#mr-type').value;
      const band = backdrop.querySelector('#mr-band').value;
      const rubric = backdrop.querySelector('#mr-rubric').value.trim();
      const notes = backdrop.querySelector('#mr-notes').value.trim();
      const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
      const planContext = aiMsgs.length > 0 ? `\n\nLesson context:\n${aiMsgs[aiMsgs.length - 1].content.slice(0, 2000)}` : '';
      close();
      const resultEl = container.querySelector('#ai-result');
      resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Creating model response...</div>';
      resultEl.scrollIntoView({ behavior: 'smooth' });
      try {
        const prompt = `Generate a model response for:\nQuestion: ${question}\nSubject: ${subject}\nLevel: ${level}\nResponse type: ${type}\nTarget band: ${band}\n${rubric ? `Rubric/Mark scheme:\n${rubric}` : ''}\n${notes ? `Additional: ${notes}` : ''}${planContext}`;
        const result = await generateModelResponse(prompt, subject, level);
        setComponent('modelResponse', result, subject || 'Model Response');
        resultEl.innerHTML = '';
        renderComponents(container);
        showToast('Model response generated!', 'success');
      } catch (err) {
        resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
      }
    });
  });

  // EEE: Source Analysis
  container.querySelector('#ai-source-analysis-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating source-based questions...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateSourceAnalysis(planText, cls.subject, cls.level);
      setComponent('sourceAnalysis', result, cls.subject || 'Source Analysis');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Source analysis generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // CCE Discussion
  container.querySelector('#ai-cce-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    const planText = aiMsgs.length > 0 ? aiMsgs.map(m => m.content).join('\n\n') : 'General CCE lesson';
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating CCE discussion plan...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateCCEDiscussion(planText, cls.level, cls.subject === 'CCE' ? '' : cls.subject);
      setComponent('cceDiscussion', result, 'CCE2021');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('CCE discussion generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Share Lesson (export/import JSON)
  // Word export
  container.querySelector('#export-word-btn')?.addEventListener('click', exportToWord);

  container.querySelector('#share-lesson-btn')?.addEventListener('click', () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
      showToast('No lesson content to share yet.', 'danger'); return;
    }
    showShareModal(container);
  });

  // Lesson Templates
  container.querySelector('#templates-btn')?.addEventListener('click', () => {
    showTemplateModal(container);
  });

  // Spatial Layout
  renderSpatialSection(container);
  renderSpatialContextBar(container);

  // Linked Resources
  renderLinkedResourcesSection(container);
  container.querySelector('#spatial-layout-btn')?.addEventListener('click', () => {
    const spatialSection = container.querySelector('#spatial-section');
    spatialSection.scrollIntoView({ behavior: 'smooth' });
    renderSpatialSection(container, true);
  });

  // Toolbar mode toggle (icons ↔ dropdown) — full re-render to re-wire handlers
  container.querySelector('#toggle-toolbar-mode')?.addEventListener('click', () => {
    const prefs = getLPPrefs();
    const newMode = (prefs.toolbarMode || 'icons') === 'icons' ? 'dropdown' : 'icons';
    prefs.toolbarMode = newMode;
    saveLPPrefs(prefs);
    render(container);
  });

  // Date/time setup — populate with today and show timetable hints
  const dateInput = container.querySelector('#lesson-date');
  const periodSelect = container.querySelector('#lesson-period');
  if (dateInput) {
    const today = new Date();
    dateInput.value = lessonDateTime?.date || today.toISOString().split('T')[0];
    if (lessonDateTime?.period) periodSelect.value = lessonDateTime.period;
  }
  setupTimetableHints(container);
}

/* ── Messages render ── */
function renderMessages(el, classes) {
  if (!el) return;
  if (chatMessages.length === 0) {
    const prompts = buildQuickPrompts(classes || Store.getClasses());
    el.innerHTML = `
      <div style="padding:var(--sp-6) var(--sp-4);">
        <div style="max-width:520px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:var(--sp-5);">
            <div style="width:48px;height:48px;margin:0 auto var(--sp-3);background:var(--accent-light);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;color:var(--accent);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 style="font-size:1.0625rem;font-weight:600;margin-bottom:var(--sp-1);color:var(--ink);">What would you like to plan?</h3>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Click a starter below to load it — edit the <span style="background:var(--accent-light);color:var(--accent);padding:0 4px;border-radius:3px;font-size:0.75rem;font-weight:500;">[placeholders]</span> before sending.
            </p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2);">
            ${prompts.map((p, i) => {
              const desc = p.desc || (p.prompt.length > 70 ? p.prompt.slice(0, 68).replace(/\s\S*$/, '') + '...' : p.prompt);
              const icons = ['<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
                '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>',
                '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
                '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
                '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
                '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/>'];
              return `<button class="quick-prompt" data-prompt="${esc(p.prompt)}" style="
                display:flex;flex-direction:column;align-items:flex-start;gap:4px;
                padding:var(--sp-3);border:1px solid var(--border-light);border-radius:var(--radius);
                background:var(--bg-card);cursor:pointer;text-align:left;transition:all 0.15s;
                min-height:60px;"
                onmouseenter="this.style.borderColor='var(--accent)';this.style.background='var(--accent-light)'"
                onmouseleave="this.style.borderColor='var(--border-light)';this.style.background='var(--bg-card)'">
                <div style="display:flex;align-items:center;gap:6px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="flex-shrink:0;">${icons[i % icons.length]}</svg>
                  <span style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${p.label}</span>
                </div>
                <span style="font-size:0.6875rem;color:var(--ink-muted);line-height:1.4;">${desc}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  } else {
    el.innerHTML = chatMessages.map(m => `
      <div class="chat-msg ${m.role === 'user' ? 'user' : 'ai'}">
        ${m.role === 'user' ? esc(m.content) : md(m.content)}
      </div>
    `).join('');

    // Follow-up prompts after last AI response (only if not currently generating)
    if (!isGenerating && chatMessages.length >= 2 && chatMessages[chatMessages.length - 1].role === 'assistant') {
      // Pedagogical nudges — subtle coaching indicators
      const lastAI = chatMessages[chatMessages.length - 1].content.toLowerCase();
      const nudges = [];

      // Check for teacher-talk heavy plans (3+ consecutive "teacher explains/presents/tells")
      const teacherTalkCount = (lastAI.match(/teacher (explains|presents|tells|lectures|demonstrates|shows)/gi) || []).length;
      const studentActivityCount = (lastAI.match(/students? (discuss|explore|investigate|create|collaborate|present|practise)/gi) || []).length;
      if (teacherTalkCount >= 3 && studentActivityCount < 2) {
        nudges.push({ icon: '&#9729;', text: 'This plan has several teacher-led segments in a row. Consider adding a student activity to increase engagement.', color: '#f59e0b' });
      }

      // Check for no assessment checkpoint
      const hasAssessment = /exit ticket|formative|check for understanding|quiz|assessment|checkpoint/i.test(lastAI);
      const componentKeys = Object.keys(lessonComponents);
      if (!hasAssessment && !componentKeys.includes('exitTicket') && chatMessages.length >= 4) {
        nudges.push({ icon: '&#9998;', text: 'No assessment checkpoint detected. Consider adding a formative check to monitor understanding.', color: '#3b82f6' });
      }

      // Check for estimated time (if plan mentions minutes)
      const timeMatches = lastAI.match(/(\d+)\s*min/gi) || [];
      if (timeMatches.length >= 2) {
        const totalMin = timeMatches.reduce((sum, m) => sum + parseInt(m), 0);
        if (totalMin > 0) {
          nudges.push({ icon: '&#9200;', text: `Estimated lesson time: ~${totalMin} minutes`, color: '#8b5cf6' });
        }
      }

      if (nudges.length > 0) {
        el.insertAdjacentHTML('beforeend', `
          <div style="padding:var(--sp-1) var(--sp-4) var(--sp-2);">
            ${nudges.map(n => `<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 10px;font-size:0.6875rem;color:${n.color};line-height:1.4;border-left:2px solid ${n.color};margin-bottom:4px;">
              <span style="flex-shrink:0;">${n.icon}</span> ${n.text}
            </div>`).join('')}
          </div>`);
      }

      const followUps = buildFollowUpPrompts(chatMessages);
      if (followUps.length > 0) {
        el.insertAdjacentHTML('beforeend', `
          <div style="padding:var(--sp-2) var(--sp-4) var(--sp-3);display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;">
            ${followUps.map(f => `<button class="quick-prompt" data-prompt="${esc(f.prompt)}" style="
              font-size:0.75rem;padding:5px 12px;border-radius:16px;border:1px solid var(--border-light);
              background:var(--bg-card);color:var(--ink-secondary);cursor:pointer;transition:all 0.15s;
              white-space:nowrap;line-height:1.3;">${f.label}</button>`).join('')}
          </div>`);
      }
    }
  }
  if (isGenerating) el.insertAdjacentHTML('beforeend', `<div class="chat-typing">Co-Cher is thinking...</div>`);
  el.scrollTop = el.scrollHeight;
}

/* ── Plan content (right panel) ── */
function renderPlanContent(el) {
  if (!el) return;
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');

  if (aiMsgs.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding:var(--sp-10);">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <h3 class="empty-state-title">Your lesson plan</h3>
        <p class="empty-state-text">Start chatting with Co-Cher to collaboratively design your lesson.</p>
      </div>`;
    return;
  }

  // Show the latest AI response as the working plan
  const latest = aiMsgs[aiMsgs.length - 1].content;
  el.innerHTML = `
    <div class="card" style="padding:var(--sp-6);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
        <span class="text-overline" style="color:var(--ink-faint);">Latest from Co-Cher</span>
        <span class="badge badge-blue badge-dot">${aiMsgs.length} exchange${aiMsgs.length > 1 ? 's' : ''}</span>
      </div>
      <div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);">${md(latest)}</div>
    </div>
    ${aiMsgs.length > 1 ? `
      <details style="margin-top:var(--sp-4);">
        <summary style="cursor:pointer;font-size:0.8125rem;font-weight:500;color:var(--ink-muted);padding:var(--sp-2) 0;">
          View earlier responses (${aiMsgs.length - 1})
        </summary>
        <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3);">
          ${aiMsgs.slice(0, -1).reverse().map((m, i) => `
            <div class="card" style="padding:var(--sp-4);opacity:${0.9 - i * 0.1};">
              <div style="font-size:0.8125rem;line-height:1.6;color:var(--ink-muted);">${md(m.content)}</div>
            </div>
          `).join('')}
        </div>
      </details>
    ` : ''}
  `;
}

/* ── Save lesson modal ── */
function showSaveModal(classes) {
  if (chatMessages.length === 0) {
    showToast('Chat with Co-Cher first before saving.', 'danger');
    return;
  }

  const existing = currentLessonId ? Store.getLesson(currentLessonId) : null;

  // Auto-suggest class linkage if there's context
  const suggestedClassId = existing?.classId || planClassContext?.id || '';

  const { backdrop, close } = openModal({
    title: existing ? 'Update Lesson' : 'Save Lesson',
    body: `
      <div class="input-group">
        <label class="input-label">Lesson Title</label>
        <input class="input" id="save-title" value="${escAttr(existing?.title || suggestTitle())}" placeholder="e.g. Exploring Fractions — P4 Maths" />
      </div>
      <div class="input-group">
        <label class="input-label">Link to Class (optional)</label>
        <select class="input" id="save-class">
          <option value="">No class</option>
          ${classes.map(c => `<option value="${c.id}" ${suggestedClassId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Status</label>
        <select class="input" id="save-status">
          <option value="draft" ${(!existing || existing.status === 'draft') ? 'selected' : ''}>Draft</option>
          <option value="ready" ${existing?.status === 'ready' ? 'selected' : ''}>Ready to Teach</option>
          <option value="completed" ${existing?.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">E21CC Focus</label>
        <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cait" class="e21cc-check" ${existing?.e21ccFocus?.includes('cait') ? 'checked' : ''} /> CAIT
          </label>
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cci" class="e21cc-check" ${existing?.e21ccFocus?.includes('cci') ? 'checked' : ''} /> CCI
          </label>
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cgc" class="e21cc-check" ${existing?.e21ccFocus?.includes('cgc') ? 'checked' : ''} /> CGC
          </label>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">${existing ? 'Update' : 'Save Lesson'}</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const title = backdrop.querySelector('#save-title').value.trim() || 'Untitled Lesson';
    const classId = backdrop.querySelector('#save-class').value || null;
    const status = backdrop.querySelector('#save-status').value;
    const e21ccFocus = [...backdrop.querySelectorAll('.e21cc-check:checked')].map(cb => cb.value);

    const data = {
      title,
      classId,
      status,
      e21ccFocus,
      components: { ...lessonComponents },
      chatHistory: [...chatMessages],
      plan: chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n---\n\n')
    };

    if (existing) {
      Store.updateLesson(currentLessonId, data);
      showToast('Lesson updated!', 'success');
    } else {
      const lesson = Store.addLesson(data);
      currentLessonId = lesson.id;
      showToast('Lesson saved!', 'success');
    }
    close();
  });

  setTimeout(() => backdrop.querySelector('#save-title')?.focus(), 100);
}

function suggestTitle() {
  const firstUser = chatMessages.find(m => m.role === 'user');
  if (!firstUser) return '';
  return firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '...' : '');
}

function escAttr(s) { return (s || '').replace(/"/g, '&quot;'); }

/* ── Last grouping result for seat assignment ── */
let lastGroupingResult = null;
let lastGroupingMeta = null;

/* ── AI Grouping Modal ── */
function showGroupingModal(container, classes) {
  const classesWithStudents = classes.filter(c => c.students?.length > 0);

  // Auto-select class from context
  const contextClassId = planClassContext?.id || '';

  const { backdrop, close } = openModal({
    title: 'AI Student Grouping',
    body: `
      <div class="input-group">
        <label class="input-label">Select Class</label>
        <select class="input" id="group-class">
          ${classesWithStudents.map(c => `<option value="${c.id}" ${c.id === contextClassId ? 'selected' : ''}>${c.name} (${c.students.length} students)</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Activity Type</label>
        <select class="input" id="group-activity">
          <option value="Collaborative group work">Collaborative group work</option>
          <option value="Peer tutoring">Peer tutoring</option>
          <option value="Jigsaw activity">Jigsaw activity</option>
          <option value="Debate or discussion">Debate / discussion</option>
          <option value="Project-based learning">Project-based learning</option>
          <option value="Competition">Competition</option>
          <option value="Lab work">Lab / practical work</option>
          <option value="Circuit training">PE — Circuit training</option>
          <option value="Team game">PE — Team game</option>
          <option value="Warmup drill">PE — Warm-up / drill</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Preferred Group Size</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="group-size" min="2" max="6" value="4" style="flex:1;" />
          <span id="group-size-label" style="font-size:0.875rem;font-weight:600;color:var(--ink);min-width:80px;text-align:center;">4 students</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6875rem;color:var(--ink-faint);margin-top:2px;">
          <span>Pairs</span><span>Trios</span><span>Quads</span><span>Fives</span><span>Sixes</span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Grouping Considerations <span style="font-weight:400;color:var(--ink-faint);">(optional)</span></label>
        <textarea class="input" id="group-considerations" rows="3" placeholder="E.g. 'Keep Ahmad and Wei Lin in separate groups', 'Priya needs a confident English speaker in her group', 'Balance genders where possible', 'Seat students with vision needs near the front'..." style="resize:vertical;font-size:0.8125rem;"></textarea>
        <div style="font-size:0.6875rem;color:var(--ink-faint);margin-top:4px;">Share any seating preferences, student dynamics, or special needs the AI should factor in.</div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="generate">Generate Groups</button>
    `
  });

  // Group size slider label
  const sizeSlider = backdrop.querySelector('#group-size');
  const sizeLabel = backdrop.querySelector('#group-size-label');
  sizeSlider.addEventListener('input', () => {
    sizeLabel.textContent = `${sizeSlider.value} students`;
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
    const classId = backdrop.querySelector('#group-class').value;
    const activityType = backdrop.querySelector('#group-activity').value;
    const groupSize = parseInt(sizeSlider.value);
    const considerations = backdrop.querySelector('#group-considerations').value.trim();
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Analysing E21CC profiles and creating groups for ${cls.students.length} students...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const grouping = await suggestGrouping(cls.students, activityType, { groupSize, considerations });

      // Store for seat assignment feature
      lastGroupingResult = grouping;
      lastGroupingMeta = { classId, className: cls.name, activityType, groupSize, studentCount: cls.students.length };

      // Save as persistent component
      setComponent('grouping', grouping, `${cls.name} · ${activityType} · groups of ${groupSize}`);
      renderComponents(container);

      // Show action buttons in status area
      statusEl.innerHTML = `
        <div class="card" style="padding:var(--sp-4);background:var(--bg-subtle);border:1px dashed var(--border);">
          <div style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Groups saved to lesson components. Next steps:</div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="seat-assignment-btn" title="Get AI suggestions for where each group should sit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              Who Sits Where
            </button>
            <button class="btn btn-secondary btn-sm" id="arrange-classroom-btn" title="Open spatial designer with a layout suited for this activity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              Arrange Classroom
            </button>
            <button class="btn btn-ghost btn-sm" id="dismiss-actions" style="margin-left:auto;">Dismiss</button>
          </div>
        </div>`;

      statusEl.querySelector('#dismiss-actions')?.addEventListener('click', () => { statusEl.innerHTML = ''; });

      // Who Sits Where button
      statusEl.querySelector('#seat-assignment-btn')?.addEventListener('click', () => {
        showSeatAssignmentModal(container, lastGroupingResult, lastGroupingMeta);
      });

      // Arrange Classroom button — navigate to spatial with context
      statusEl.querySelector('#arrange-classroom-btn')?.addEventListener('click', () => {
        const presetMap = {
          'Collaborative group work': 'pods',
          'Peer tutoring': 'pods',
          'Jigsaw activity': 'stations',
          'Debate or discussion': 'fishbowl',
          'Project-based learning': 'pods',
          'Competition': 'pods',
          'Lab work': 'stations',
          'Circuit training': 'circuit',
          'Team game': 'team_game',
          'Warmup drill': 'warmup'
        };
        sessionStorage.setItem('cocher_spatial_preset', presetMap[activityType] || 'pods');
        sessionStorage.setItem('cocher_spatial_student_count', cls.students.length.toString());
        sessionStorage.setItem('cocher_spatial_activity', activityType);
        navigate('/spatial');
      });
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Grouping failed: ${err.message}</div>`;
    }
  });
}

/* ── Seat Assignment Modal ── */
function showSeatAssignmentModal(container, groupingText, meta) {
  if (!groupingText || !meta) {
    showToast('Generate groups first before assigning seats.', 'danger');
    return;
  }

  const savedLayouts = Store.getSavedLayouts() || [];
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;

  const { backdrop, close } = openModal({
    title: 'Who Sits Where',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-4);">
        Choose a classroom layout and the AI will suggest where each group should sit.
      </p>
      <div class="input-group">
        <label class="input-label">Classroom Layout</label>
        <select class="input" id="seat-layout">
          <option value="direct">Direct Instruction (Rows)</option>
          <option value="pods" selected>Collaborative Pods</option>
          <option value="stations">Stations</option>
          <option value="ushape">U-Shape / Circle</option>
          <option value="quiet">Quiet Work (Individual)</option>
          <option value="gallery">Gallery Walk</option>
          <option value="fishbowl">Fishbowl / Socratic</option>
          <option value="maker">Makerspace</option>
        </select>
      </div>
      ${savedLayouts.length > 0 ? `
        <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:-8px;margin-bottom:var(--sp-3);">
          ${linkedLayoutId ? 'Using your linked layout\'s preset.' : 'Or choose based on your saved layouts.'}
        </div>
      ` : ''}
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="assign">Assign Seats</button>
    `
  });

  // Pre-select based on linked layout or activity type
  const layoutSelect = backdrop.querySelector('#seat-layout');
  if (linkedLayoutId) {
    const linkedLayout = savedLayouts.find(l => l.id === linkedLayoutId);
    if (linkedLayout?.preset) layoutSelect.value = linkedLayout.preset;
  } else {
    const presetMap = {
      'Collaborative group work': 'pods', 'Peer tutoring': 'pods',
      'Jigsaw activity': 'stations', 'Debate or discussion': 'fishbowl',
      'Project-based learning': 'pods', 'Competition': 'pods', 'Lab work': 'stations',
      'Circuit training': 'circuit', 'Team game': 'team_game', 'Warmup drill': 'warmup'
    };
    layoutSelect.value = presetMap[meta.activityType] || 'pods';
  }

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="assign"]').addEventListener('click', async () => {
    const layoutPreset = layoutSelect.value;
    close();

    // Parse groups from grouping text
    const groups = parseGroupsFromText(groupingText);

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Assigning seats for ${groups.length} groups in ${PRESET_NAMES[layoutPreset] || layoutPreset} layout...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

    try {
      const seatPlan = await suggestSeatAssignment(groups, layoutPreset, meta.studentCount);
      setComponent('seatPlan', seatPlan, PRESET_NAMES[layoutPreset] || layoutPreset);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Seating plan added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Seat assignment failed: ${err.message}</div>`;
    }
  });
}

/* ── Parse groups from AI grouping text ── */
function parseGroupsFromText(text) {
  const groups = [];
  // Match "### Group N:" or "Group N:" patterns followed by members
  const groupPattern = /(?:###?\s*)?Group\s*\d+[^]*?(?:\*\*Members?:\*\*|Members?:)\s*([^\n]+)/gi;
  let match;
  while ((match = groupPattern.exec(text)) !== null) {
    const membersLine = match[1].trim();
    const members = membersLine.split(/,\s*/).map(n => n.replace(/\*\*/g, '').trim()).filter(Boolean);
    if (members.length > 0) {
      groups.push({ members });
    }
  }
  // Fallback: if parsing didn't find structured groups, try simpler patterns
  if (groups.length === 0) {
    const lines = text.split('\n');
    let currentMembers = [];
    for (const line of lines) {
      const groupMatch = line.match(/Group\s*\d+\s*:/i);
      if (groupMatch) {
        if (currentMembers.length > 0) groups.push({ members: currentMembers });
        currentMembers = [];
        // Try to extract names from the same line
        const namesAfterColon = line.split(':').slice(1).join(':').trim();
        if (namesAfterColon) {
          currentMembers = namesAfterColon.split(/,\s*/).map(n => n.replace(/\*\*/g, '').replace(/—.*$/, '').trim()).filter(Boolean);
        }
      }
    }
    if (currentMembers.length > 0) groups.push({ members: currentMembers });
  }
  return groups;
}

/* ══════════ Timeline Modal ══════════ */
function showTimelineModal(container) {
  const { backdrop, close } = openModal({
    title: 'Lesson Timeline / Pacing Guide',
    body: `
      <div class="input-group">
        <label class="input-label">Total Lesson Duration</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="timeline-duration" min="15" max="120" value="45" step="5" style="flex:1;" />
          <span id="timeline-duration-label" style="font-size:0.875rem;font-weight:600;color:var(--ink);min-width:60px;text-align:center;">45 min</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6875rem;color:var(--ink-faint);margin-top:2px;">
          <span>15 min</span><span>45 min</span><span>60 min</span><span>90 min</span><span>120 min</span>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="generate">Generate Timeline</button>
    `
  });

  const durationSlider = backdrop.querySelector('#timeline-duration');
  const durationLabel = backdrop.querySelector('#timeline-duration-label');
  durationSlider.addEventListener('input', () => {
    durationLabel.textContent = `${durationSlider.value} min`;
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
    const totalMinutes = parseInt(durationSlider.value);
    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Creating ${totalMinutes}-minute lesson timeline...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
      const subject = planClassContext?.subject || '';
      const timeline = await generateTimeline(planText, totalMinutes, subject);
      setComponent('timeline', timeline, `${totalMinutes} minutes`);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Timeline added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Timeline generation failed: ${err.message}</div>`;
    }
  });
}

/* ══════════ Differentiation Modal ══════════ */
function showDifferentiationModal(container, classes) {
  const contextClassId = planClassContext?.id || '';

  const { backdrop, close } = openModal({
    title: 'Differentiation Suggestions',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-4);">
        Analyse student E21CC profiles against your lesson plan to identify who needs scaffolding and who is ready for extension.
      </p>
      <div class="input-group">
        <label class="input-label">Select Class</label>
        <select class="input" id="diff-class">
          ${classes.map(c => `<option value="${c.id}" ${c.id === contextClassId ? 'selected' : ''}>${c.name} (${c.students.length} students)</option>`).join('')}
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="analyse">Analyse & Suggest</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="analyse"]').addEventListener('click', async () => {
    const classId = backdrop.querySelector('#diff-class').value;
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Analysing ${cls.students.length} student profiles for differentiation opportunities...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
      const diff = await suggestDifferentiation(cls.students, planText);
      setComponent('differentiation', diff, cls.name);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Differentiation suggestions added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Differentiation analysis failed: ${err.message}</div>`;
    }
  });
}

/* ══════════ Spatial Context Bar (coupling) ══════════ */
function renderSpatialContextBar(container) {
  const barEl = container.querySelector('#spatial-context-bar');
  if (!barEl) return;

  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;
  if (!linkedLayoutId) { barEl.style.display = 'none'; return; }

  const savedLayouts = Store.getSavedLayouts() || [];
  const layout = savedLayouts.find(l => l.id === linkedLayoutId);
  if (!layout) { barEl.style.display = 'none'; return; }

  barEl.style.display = '';
  barEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:linear-gradient(135deg, rgba(0,12,83,0.04), rgba(167,243,208,0.08));border:1px solid var(--border-light);border-radius:var(--radius-lg);">
      <div style="font-size:1.25rem;">${PRESET_ICONS[layout.preset] || '📐'}</div>
      <div style="flex:1;">
        <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">
          ${PRESET_NAMES[layout.preset] || 'Custom'} Layout Linked
        </div>
        <div style="font-size:0.6875rem;color:var(--ink-muted);">
          ${layout.name} · ${layout.studentCount || '?'} students · ${layout.items?.length || 0} items
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="spatial-context-open" style="font-size:0.75rem;">Open</button>
    </div>`;

  barEl.querySelector('#spatial-context-open')?.addEventListener('click', () => navigate('/spatial'));
}

/* ══════════ KB Context Attachment ══════════ */

const FRAMEWORK_SUMMARIES = [
  { id: 'e21cc', title: 'E21CC Framework', content: 'Enhanced 21st Century Competencies:\n\nCAIT — Critical, Adaptive & Inventive Thinking:\n- Sound Reasoning: Examine issues logically, draw well-reasoned conclusions\n- Creative Problem-Solving: Generate novel ideas, explore innovative solutions\n- Managing Complexity & Ambiguity: Navigate uncertain, complex problems\n- Metacognition: Monitor own thinking, self-regulate, transfer learning\n\nCCI — Communication, Collaboration & Information:\n- Communicative Competence: Express ideas clearly across modes and contexts\n- Collaborative Skills: Work effectively in teams, co-create meaning\n- Information Literacy: Find, evaluate, use information critically and ethically\n\nCGC — Civic, Global & Cross-cultural Literacy:\n- Active Citizenship: Contribute responsibly to community and nation\n- Global Awareness: Appreciate interconnectedness and global challenges\n- Cross-cultural Sensitivity: Respect diversity, bridge cultural divides' },
  { id: 'stp', title: 'Singapore Teaching Practice', content: 'Singapore Teaching Practice (STP) — 4 Areas:\n\nArea 1: Lesson Preparation — Understanding learners, clear objectives, resource planning\nArea 2: Lesson Enactment — Teaching actions, interaction patterns, classroom discourse\nArea 3: Monitoring & Feedback — Formative assessment, effective feedback, differentiated support\nArea 4: Positive Learning Culture — Safe environment, routines, student agency' },
  { id: 'edtech', title: 'EdTech Masterplan 2030', content: 'EdTech Masterplan 2030 — 3 Thrusts:\n\nThrust 1: Digital Literacy — Data literacy, information & media literacy, digital communication\nThrust 2: Digital Creation — Computational thinking, digital design, AI literacy\nThrust 3: Digital Citizenship — Online safety, digital ethics, digital wellbeing\n\nIntegration: TPACK model, blended learning (SLS), AI-enhanced pedagogy' }
];

function renderKBChips(container) {
  const chipsEl = container.querySelector('#kb-chips');
  const barEl = container.querySelector('#kb-context-bar');
  if (!chipsEl || !barEl) return;

  if (attachedKBContext.length === 0) {
    barEl.style.display = 'none';
    return;
  }

  barEl.style.display = '';
  chipsEl.innerHTML = attachedKBContext.map((kb, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--accent-light);color:var(--accent-dark);border-radius:var(--radius-full);font-size:0.75rem;font-weight:500;">
      ${esc(kb.title.slice(0, 30))}
      <button class="kb-remove-chip" data-idx="${i}" style="background:none;border:none;cursor:pointer;color:var(--accent-dark);padding:0;font-size:0.875rem;line-height:1;">&times;</button>
    </span>
  `).join('');

  chipsEl.querySelectorAll('.kb-remove-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      attachedKBContext.splice(parseInt(btn.dataset.idx), 1);
      renderKBChips(container);
    });
  });
}

function showAttachKBModal(container) {
  const uploads = Store.get('knowledgeUploads') || [];
  const pdFolders = Store.get('pdFolders') || [];
  const allItems = [
    ...FRAMEWORK_SUMMARIES.map(f => ({ ...f, type: 'framework' })),
    ...uploads.map(u => ({ id: u.id, title: u.title, content: u.content, type: 'upload' })),
    ...pdFolders.map(f => ({
      id: 'pd_' + f.id,
      title: f.name + ' (PD Folder)',
      content: (f.materials || []).map(m => `## ${m.title}\n${m.content}`).join('\n\n---\n\n'),
      type: 'pd-folder'
    })).filter(f => f.content.length > 0)
  ];

  const alreadyAttached = new Set(attachedKBContext.map(k => k.id));

  const { backdrop, close } = openModal({
    title: 'Attach Knowledge Base Context',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Select resources to include as context in your conversation. Co-Cher will reference these when planning your lesson.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
        ${allItems.map(item => `
          <label style="display:flex;align-items:flex-start;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-md);cursor:pointer;transition:background 0.15s;">
            <input type="checkbox" value="${item.id}" class="kb-attach-check" ${alreadyAttached.has(item.id) ? 'checked' : ''} style="margin-top:3px;" />
            <div>
              <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${esc(item.title)}</div>
              <div style="font-size:0.6875rem;color:var(--ink-muted);">
                ${item.type === 'framework' ? 'Built-in Framework' : item.type === 'pd-folder' ? 'PD Portfolio Folder' : 'Uploaded Resource'} · ${(item.content?.length || 0) > 1000 ? Math.round(item.content.length / 1000) + 'K chars' : item.content?.length + ' chars'}
              </div>
            </div>
          </label>
        `).join('')}
      </div>
      ${allItems.length === 0 ? '<p style="text-align:center;color:var(--ink-muted);padding:var(--sp-6);font-size:0.875rem;">No resources available. Upload documents in the Knowledge Base.</p>' : ''}
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="attach">Attach Selected</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="attach"]').addEventListener('click', () => {
    const checked = [...backdrop.querySelectorAll('.kb-attach-check:checked')].map(cb => cb.value);
    attachedKBContext = allItems.filter(item => checked.includes(item.id));
    renderKBChips(container);
    close();
    if (attachedKBContext.length > 0) {
      showToast(`${attachedKBContext.length} resource${attachedKBContext.length > 1 ? 's' : ''} attached as context`, 'success');
    }
  });
}

/* ══════════ Spatial Layout Section ══════════ */

const PRESET_ICONS = {
  direct: '📣', pods: '🤝', stations: '🔄', ushape: '🗣️',
  quiet: '📝', gallery: '🖼️', fishbowl: '🐟', maker: '🛠️'
};
const PRESET_NAMES = {
  direct: 'Direct Instruction', pods: 'Collaborative Pods', stations: 'Stations',
  ushape: 'U-Shape / Circle', quiet: 'Quiet Work', gallery: 'Gallery Walk',
  fishbowl: 'Fishbowl / Socratic', maker: 'Makerspace'
};

function renderSpatialSection(container, forceShow = false) {
  const el = container.querySelector('#spatial-section');
  if (!el) return;

  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;
  const linkedLayout = linkedLayoutId ? Store.getSavedLayouts()?.find(l => l.id === linkedLayoutId) : null;
  const savedLayouts = Store.getSavedLayouts() || [];

  // If no layout linked and not forced open, show nothing or minimal prompt
  if (!linkedLayout && !forceShow && savedLayouts.length === 0) {
    el.innerHTML = '';
    return;
  }

  if (linkedLayout) {
    // Show linked layout summary
    el.innerHTML = `
      <div class="card" style="padding:var(--sp-5);border-top:3px solid var(--e21cc-cci);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--e21cc-cci)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);">Spatial Layout</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);">
            <button class="btn btn-ghost btn-sm" id="open-spatial-editor">Open in Designer</button>
            <button class="btn btn-ghost btn-sm" id="unlink-spatial" style="color:var(--danger);">Unlink</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-md);">
          <div style="font-size:2rem;">${PRESET_ICONS[linkedLayout.preset] || '📐'}</div>
          <div>
            <div style="font-weight:600;font-size:0.875rem;color:var(--ink);">${esc(linkedLayout.name)}</div>
            <div style="font-size:0.75rem;color:var(--ink-muted);">
              ${linkedLayout.studentCount || '?'} students · ${linkedLayout.items?.length || 0} items · ${PRESET_NAMES[linkedLayout.preset] || 'Custom'}
            </div>
          </div>
        </div>
      </div>`;

    el.querySelector('#open-spatial-editor')?.addEventListener('click', () => {
      navigate('/spatial');
    });
    el.querySelector('#unlink-spatial')?.addEventListener('click', () => {
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { spatialLayout: null });
        showToast('Spatial layout unlinked', 'success');
        renderSpatialSection(container);
      }
    });
  } else {
    // Show option to link an existing layout or go design one
    el.innerHTML = `
      <div class="card" style="padding:var(--sp-5);border:2px dashed var(--border);background:transparent;box-shadow:none;">
        <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);">Spatial Layout</span>
        </div>
        <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-3);">
          Link a classroom layout to this lesson to plan how students will be arranged physically.
        </p>
        ${savedLayouts.length > 0 ? `
          <div style="margin-bottom:var(--sp-3);">
            <label class="input-label" style="font-size:0.75rem;">Link existing layout</label>
            <select class="input" id="link-layout-select" style="font-size:0.8125rem;">
              <option value="">Choose a saved layout...</option>
              ${savedLayouts.map(l => `<option value="${l.id}">${l.name} (${l.studentCount || '?'} students)</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div style="display:flex;gap:var(--sp-2);">
          ${savedLayouts.length > 0 ? `<button class="btn btn-primary btn-sm" id="link-layout-btn">Link Layout</button>` : ''}
          <button class="btn btn-secondary btn-sm" id="design-new-spatial">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Design New in Spatial Designer
          </button>
        </div>
      </div>`;

    el.querySelector('#link-layout-btn')?.addEventListener('click', () => {
      const layoutId = container.querySelector('#link-layout-select')?.value;
      if (!layoutId) { showToast('Select a layout to link.', 'danger'); return; }
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { spatialLayout: layoutId });
        showToast('Spatial layout linked!', 'success');
        renderSpatialSection(container);
      } else {
        showToast('Save the lesson first, then link a layout.', 'danger');
      }
    });
    el.querySelector('#design-new-spatial')?.addEventListener('click', () => {
      navigate('/spatial');
    });
  }
}

/* ══════════ Linked Resources Section ══════════ */
function renderLinkedResourcesSection(container) {
  const el = container.querySelector('#linked-resources-section');
  if (!el) return;

  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const attachedResources = currentLesson?.attachedResources || [];
  const stimulusLib = Store.getStimulusLibrary();
  const sourceLib = Store.getSourceLibrary();
  const hasLibrary = stimulusLib.length > 0 || sourceLib.length > 0;

  if (attachedResources.length === 0 && !hasLibrary) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <div class="card" style="padding:var(--sp-5);border-top:3px solid #0ea5e9;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
        <div style="display:flex;align-items:center;gap:var(--sp-2);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);">Linked Resources</span>
          ${attachedResources.length > 0 ? `<span class="badge badge-blue" style="font-size:0.6875rem;">${attachedResources.length}</span>` : ''}
        </div>
        ${currentLessonId && hasLibrary ? `<button class="btn btn-secondary btn-sm" id="link-resources-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Link Resources
        </button>` : ''}
      </div>
      ${!currentLessonId ? `<p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Save the lesson first, then link Stimulus Material or Source Analysis sets.</p>` : ''}
      ${currentLessonId && attachedResources.length === 0 && hasLibrary ? `<p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-2);">Attach Stimulus Material or Source Analysis sets to this lesson.</p>` : ''}
      ${attachedResources.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
          ${attachedResources.map((r, idx) => `
            <div style="display:flex;align-items:center;gap:var(--sp-1);padding:var(--sp-1) var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-lg);font-size:0.8125rem;border:1px solid var(--border-light);">
              <span class="badge ${r.type === 'stimulus' ? 'badge-blue' : 'badge-amber'}" style="font-size:0.625rem;">${r.type === 'stimulus' ? 'Stimulus' : 'Source'}</span>
              <span style="color:var(--ink);">${esc(r.title)}</span>
              <button class="btn btn-ghost btn-sm unlink-resource-btn" data-idx="${idx}" title="Remove" style="padding:1px 3px;color:var(--danger);margin-left:2px;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`;

  // Wire link resources button
  el.querySelector('#link-resources-btn')?.addEventListener('click', () => {
    showLinkResourcesModal(container);
  });

  // Wire unlink buttons
  el.querySelectorAll('.unlink-resource-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const updated = [...attachedResources];
      updated.splice(idx, 1);
      Store.updateLesson(currentLessonId, { attachedResources: updated });
      showToast('Resource unlinked', 'success');
      renderLinkedResourcesSection(container);
    });
  });
}

function showLinkResourcesModal(container) {
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  if (!currentLesson) return;

  const attachedResources = currentLesson.attachedResources || [];
  const attachedIds = new Set(attachedResources.map(r => r.id));
  const stimulusLib = Store.getStimulusLibrary();
  const sourceLib = Store.getSourceLibrary();

  const allResources = [
    ...stimulusLib.map(s => ({ type: 'stimulus', id: s.id, title: s.title || s.topic || 'Untitled Stimulus' })),
    ...sourceLib.map(s => ({ type: 'source', id: s.id, title: s.title || s.topic || 'Untitled Source' }))
  ];

  const available = allResources.filter(r => !attachedIds.has(r.id));

  if (available.length === 0) {
    showToast('No additional resources available to link.', 'danger');
    return;
  }

  const { backdrop, close } = openModal({
    title: 'Link Resources to Lesson',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Select Stimulus Material or Source Analysis sets to attach to this lesson.
      </p>
      <div style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:var(--sp-2);">
        ${available.map(r => `
          <label style="display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2) var(--sp-3);border:1px solid var(--border-light);border-radius:var(--radius-md);cursor:pointer;transition:background 0.15s;" class="resource-option">
            <input type="checkbox" class="resource-check" data-type="${r.type}" data-id="${r.id}" data-title="${escAttr(r.title)}" />
            <span class="badge ${r.type === 'stimulus' ? 'badge-blue' : 'badge-amber'}" style="font-size:0.625rem;flex-shrink:0;">${r.type === 'stimulus' ? 'Stimulus' : 'Source'}</span>
            <span style="font-size:0.8125rem;color:var(--ink);">${esc(r.title)}</span>
          </label>
        `).join('')}
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="link">Link Selected</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="link"]').addEventListener('click', () => {
    const checked = [...backdrop.querySelectorAll('.resource-check:checked')];
    if (checked.length === 0) {
      showToast('Select at least one resource.', 'danger');
      return;
    }
    const newResources = checked.map(cb => ({
      type: cb.dataset.type,
      id: cb.dataset.id,
      title: cb.dataset.title
    }));
    const updated = [...attachedResources, ...newResources];
    Store.updateLesson(currentLessonId, { attachedResources: updated });
    showToast(`Linked ${newResources.length} resource${newResources.length > 1 ? 's' : ''}!`, 'success');
    close();
    renderLinkedResourcesSection(container);
  });
}

/* ══════════ Resizable Panel Handle ══════════ */
function initResizeHandle(handle, leftPanel, rightPanel, parentContainer) {
  if (!handle || !leftPanel || !rightPanel || !parentContainer) return;

  let isResizing = false;
  let startX = 0;
  let startLeftWidth = 0;

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startLeftWidth = leftPanel.getBoundingClientRect().width;
    handle.classList.add('active');
    document.body.classList.add('resizing-panels');
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const containerWidth = parentContainer.getBoundingClientRect().width;
    const handleWidth = 6;
    const newLeftWidth = startLeftWidth + dx;
    const minWidth = 320;
    const maxWidth = containerWidth - minWidth - handleWidth;

    if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
      const leftPct = (newLeftWidth / containerWidth) * 100;
      const rightPct = ((containerWidth - newLeftWidth - handleWidth) / containerWidth) * 100;
      leftPanel.style.flex = `0 0 ${leftPct}%`;
      rightPanel.style.flex = `0 0 ${rightPct}%`;
    }
  });

  handle.addEventListener('pointerup', () => {
    isResizing = false;
    handle.classList.remove('active');
    document.body.classList.remove('resizing-panels');
  });

  handle.addEventListener('lostpointercapture', () => {
    isResizing = false;
    handle.classList.remove('active');
    document.body.classList.remove('resizing-panels');
  });

  // Double-click to reset to 50/50
  handle.addEventListener('dblclick', () => {
    leftPanel.style.flex = '1 1 50%';
    rightPanel.style.flex = '1 1 50%';
  });
}

/* ══════════ Share Modal (Export / Import lesson JSON) ══════════ */
/* ══════════ Timetable Hints for Date/Time ══════════ */
async function setupTimetableHints(container) {
  const dateInput = container.querySelector('#lesson-date');
  const periodSelect = container.querySelector('#lesson-period');
  const hintEl = container.querySelector('#lesson-tt-hint');
  if (!dateInput || !hintEl) return;

  try {
    const user = getCurrentUser();
    if (!user?.email) return;
    const ttData = await loadTT();
    const teacherRow = findTeacherRow(ttData, user.email);
    if (!teacherRow) return;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const periodTimes = ['7:30', '8:10', '8:50', '9:30', '10:20', '11:00', '11:40', '12:20', '1:10', '1:50', '2:30'];

    function updateHint() {
      const dateVal = dateInput.value;
      if (!dateVal) { hintEl.innerHTML = ''; return; }
      const d = new Date(dateVal + 'T00:00:00');
      const dayIdx = d.getDay();
      if (dayIdx === 0 || dayIdx === 6) { hintEl.innerHTML = '<em>Weekend</em>'; return; }
      const dayStr = dayNames[dayIdx];

      // Determine week type (Odd/Even) — simple: week number modulo 2
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      const weekType = weekNum % 2 === 1 ? 'Odd' : 'Even';

      // Gather the day's lessons
      const lessons = [];
      for (let p = 1; p <= 11; p++) {
        const col = `${weekType}${dayStr}${p}`;
        const val = teacherRow[col];
        if (val && val !== '0') {
          const parts = val.split(' / ');
          lessons.push({ p, code: parts[0]?.trim(), room: parts[1]?.trim() || '' });
        }
      }

      if (lessons.length === 0) {
        hintEl.innerHTML = `<em>${weekType} ${dayStr} — no lessons</em>`;
        return;
      }

      hintEl.innerHTML = `<strong>${weekType} ${dayStr}:</strong> ` +
        lessons.map(l => `<span style="display:inline-block;padding:1px 6px;background:var(--accent-light);border-radius:4px;margin:1px;cursor:pointer;font-size:0.6875rem;" class="tt-period-chip" data-period="${l.p}" data-code="${l.code}" data-room="${l.room}">P${l.p} ${l.code}</span>`).join(' ');

      // Wire period chips
      hintEl.querySelectorAll('.tt-period-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          periodSelect.value = chip.dataset.period;
          lessonDateTime = {
            date: dateVal,
            period: chip.dataset.period,
            classCode: chip.dataset.code,
            room: chip.dataset.room
          };
        });
      });
    }

    dateInput.addEventListener('change', updateHint);
    periodSelect.addEventListener('change', () => {
      lessonDateTime = {
        date: dateInput.value,
        period: periodSelect.value,
        classCode: '',
        room: ''
      };
    });
    updateHint();
  } catch { /* TT is optional */ }
}

/* ══════════ Word (.docx) Export ══════════ */
function exportToWord() {
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
  if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
    showToast('No lesson content to export yet.', 'danger');
    return;
  }

  const title = currentLessonId ? (Store.getLesson(currentLessonId)?.title || 'Lesson Plan') : 'Lesson Plan';
  const planText = aiMsgs.map(m => m.content).join('\n\n---\n\n');

  // Build components text
  const compKeys = Object.keys(lessonComponents)
    .filter(k => lessonComponents[k]?.content)
    .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));

  let componentsText = '';
  if (compKeys.length > 0) {
    componentsText = '\n\n' + '='.repeat(60) + '\nLESSON COMPONENTS\n' + '='.repeat(60) + '\n\n';
    componentsText += compKeys.map(key => {
      const m = COMPONENT_META[key] || { label: key };
      return `--- ${m.label} ---\n\n${lessonComponents[key].content}`;
    }).join('\n\n');
  }

  // Date/time info
  let dateInfo = '';
  if (lessonDateTime?.date) {
    dateInfo = `Date: ${lessonDateTime.date}`;
    if (lessonDateTime.period) dateInfo += ` | Period ${lessonDateTime.period}`;
    if (lessonDateTime.classCode) dateInfo += ` | ${lessonDateTime.classCode}`;
    if (lessonDateTime.room) dateInfo += ` | Room: ${lessonDateTime.room}`;
    dateInfo += '\n';
  }

  // Build a .docx using the Office Open XML format (minimal)
  const fullText = `${title}\n${dateInfo}Exported from Co-Cher · ${new Date().toLocaleDateString('en-SG')}\n\n${planText}${componentsText}`;

  // Convert to simple Word-compatible HTML wrapped in .doc
  const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.6;color:#1e293b;max-width:700px;margin:0 auto;padding:24px}
h1{font-size:16pt;color:#000C53;border-bottom:2px solid #000C53;padding-bottom:6px}
h2{font-size:13pt;margin-top:18px}h3{font-size:11pt;margin-top:14px}
table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:10pt}
th{background:#f1f5f9;font-weight:bold}
ul,ol{padding-left:20px}
hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0}
.meta{font-size:9pt;color:#64748b}
.component-header{background:#f1f5f9;padding:8px 12px;margin:16px 0 8px;font-weight:bold;font-size:11pt;border-left:3px solid #4361ee}</style></head>
<body>
<h1>${esc(title)}</h1>
<p class="meta">${dateInfo ? esc(dateInfo) + '<br/>' : ''}Exported from Co-Cher &middot; ${new Date().toLocaleDateString('en-SG')}</p>
${md(planText)}
${compKeys.length > 0 ? '<hr/><h2>Lesson Components</h2>' + compKeys.map(key => {
    const m = COMPONENT_META[key] || { label: key };
    return `<div class="component-header">${m.label}</div>${md(lessonComponents[key].content)}`;
  }).join('') : ''}
</body></html>`;

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Word document downloaded!', 'success');
}

function showShareModal(container) {
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
  const planText = aiMsgs.map(m => m.content).join('\n\n');
  const exportData = {
    _cocherExport: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    title: currentLessonId ? (Store.getLesson(currentLessonId)?.title || 'Untitled') : 'Untitled Lesson',
    chatHistory: chatMessages,
    components: { ...lessonComponents },
    classContext: planClassContext ? { name: planClassContext.name, subject: planClassContext.subject, level: planClassContext.level } : null
  };

  let modalRef = null;
  modalRef = openModal({
    title: 'Share Lesson',
    body: `
      <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
        <!-- Export Section -->
        <div style="padding:var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style="font-weight:600;font-size:0.875rem;">Send to Colleague</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="copy-share-json">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy to Clipboard
            </button>
            <button class="btn btn-secondary btn-sm" id="download-share-json">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download .json
            </button>
          </div>
          <details style="margin-top:var(--sp-2);">
            <summary style="font-size:0.6875rem;color:var(--ink-faint);cursor:pointer;">View raw JSON</summary>
            <textarea id="share-export-json" readonly style="width:100%;height:80px;font-family:monospace;font-size:0.6875rem;resize:vertical;margin-top:4px;border-radius:var(--radius-md);">${JSON.stringify(exportData, null, 2)}</textarea>
          </details>
        </div>

        <!-- Import Section -->
        <div style="padding:var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span style="font-weight:600;font-size:0.875rem;">Import from Colleague</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-2);">
            <label class="btn btn-primary btn-sm" style="cursor:pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Upload .json File
              <input type="file" id="import-share-file" accept=".json" style="display:none;" />
            </label>
          </div>
          <details>
            <summary style="font-size:0.6875rem;color:var(--ink-faint);cursor:pointer;">Or paste JSON manually</summary>
            <textarea id="share-import-json" placeholder="Paste shared lesson JSON here..." style="width:100%;height:60px;font-family:monospace;font-size:0.6875rem;resize:vertical;margin-top:4px;border-radius:var(--radius-md);"></textarea>
            <button class="btn btn-secondary btn-sm" id="import-share-json" style="margin-top:4px;">Import</button>
          </details>
        </div>
      </div>
    `,
    onMount: (modal) => {
      modal.querySelector('#copy-share-json').addEventListener('click', () => {
        const ta = modal.querySelector('#share-export-json');
        ta.select();
        navigator.clipboard.writeText(ta.value).then(() => showToast('Copied to clipboard!', 'success'));
      });
      modal.querySelector('#download-share-json').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lesson_${exportData.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Downloaded!', 'success');
      });
      modal.querySelector('#import-share-json').addEventListener('click', () => {
        const raw = modal.querySelector('#share-import-json').value.trim();
        if (!raw) { showToast('Please paste lesson JSON first.', 'danger'); return; }
        importSharedLesson(raw, container, modalRef);
      });
      modal.querySelector('#import-share-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          importSharedLesson(reader.result, container, modalRef);
        };
        reader.readAsText(file);
      });
    }
  });
}

function importSharedLesson(jsonStr, container, modalRef) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data._cocherExport) { showToast('Not a valid Co-Cher lesson export.', 'danger'); return; }
    chatMessages = data.chatHistory || [];
    lessonComponents = data.components || {};
    planClassContext = data.classContext || null;
    currentLessonId = null;
    if (modalRef?.close) modalRef.close();
    render(container);
    showToast(`Imported "${data.title}"! Save when ready.`, 'success');
  } catch (err) {
    showToast('Invalid JSON: ' + err.message, 'danger');
  }
}

/* ══════════ Lesson Templates Modal ══════════ */
const LESSON_TEMPLATES = [
  {
    id: '5e',
    name: '5E Inquiry Model',
    desc: 'Engage, Explore, Explain, Elaborate, Evaluate — ideal for science inquiry lessons.',
    prompt: 'Design a lesson using the 5E Inquiry Model (Engage, Explore, Explain, Elaborate, Evaluate). Include activities for each phase. Make the Engage phase spark curiosity with a discrepant event or provocative question. The Explore phase should be student-driven hands-on investigation. Include formative checks.'
  },
  {
    id: 'station-rotation',
    name: 'Station Rotation',
    desc: 'Students rotate through learning stations — great for differentiation and hands-on activities.',
    prompt: 'Design a station rotation lesson with 4 stations. Each station should be 10-12 minutes. Include a mix of: teacher-led station, collaborative station, individual practice station, and a tech/simulation station. Provide clear instructions for each station and transition signals.'
  },
  {
    id: 'flipped',
    name: 'Flipped Classroom',
    desc: 'Pre-class video/reading + in-class active learning and application.',
    prompt: 'Design a flipped classroom lesson. Include: (1) Pre-class assignment (video, reading, or interactive resource ~10 min), (2) In-class warm-up check for understanding, (3) Active learning activity (problem-solving, discussion, or project work), (4) Wrap-up with exit ticket. Suggest specific resources for the pre-class component.'
  },
  {
    id: 'tbl',
    name: 'Team-Based Learning (TBL)',
    desc: 'Individual readiness test, team discussion, application activity (4S framework).',
    prompt: 'Design a Team-Based Learning (TBL) lesson with: (1) Pre-class preparation (reading/video), (2) Individual Readiness Assurance Test (iRAT, 5-8 MCQs), (3) Team Readiness Assurance Test (tRAT, same questions solved as a team), (4) Application Activity following the 4S framework (Significant problem, Same problem, Specific choice, Simultaneous report).'
  },
  {
    id: 'thinking-routine',
    name: 'Thinking Routine (VT)',
    desc: 'Visible Thinking routine — See-Think-Wonder, Connect-Extend-Challenge, etc.',
    prompt: 'Design a lesson built around Visible Thinking routines. Use at least 2 of these: See-Think-Wonder, Think-Pair-Share, Connect-Extend-Challenge, or I Used to Think...Now I Think. Show how each routine deepens understanding and makes student thinking visible. Include documentation of thinking (e.g., on mini-whiteboards or shared doc).'
  },
  {
    id: 'pbl',
    name: 'Project-Based Learning',
    desc: 'Driving question, sustained inquiry, student voice & choice, public product.',
    prompt: 'Design a project-based learning lesson segment. Include: a driving question that is open-ended and authentic, clear learning goals aligned to curriculum, scaffolded inquiry process, student voice and choice in how they investigate and present, and a public product or presentation. This can be one session of a multi-session project.'
  },
  {
    id: 'direct',
    name: 'Direct Instruction (I Do, We Do, You Do)',
    desc: 'Explicit teaching with modelling, guided practice, and independent practice.',
    prompt: 'Design a direct instruction lesson using the I Do, We Do, You Do framework. Include: (1) Hook/motivation (2 min), (2) I Do — teacher models with think-aloud (10 min), (3) We Do — guided practice with checking for understanding (10 min), (4) You Do — independent practice with differentiation for struggling and advanced learners (15 min), (5) Plenary with exit ticket.'
  },
  {
    id: 'socratic',
    name: 'Socratic Seminar',
    desc: 'Student-led discussion using open-ended questions — builds critical thinking.',
    prompt: 'Design a Socratic Seminar lesson. Include: (1) Pre-seminar preparation (text, article, or artefact for students to read/analyse), (2) Opening question, (3) Core discussion questions (3-4 open-ended questions), (4) Closing question, (5) Post-seminar reflection. Include discussion norms, roles (inner/outer circle), and how to assess participation.'
  }
];

function showTemplateModal(container) {
  let templateModalRef = null;
  templateModalRef = openModal({
    title: 'Lesson Templates',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);">Choose a pedagogical structure. Co-Cher will use it as a starting prompt for your lesson.</p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
        ${LESSON_TEMPLATES.map(t => `
          <div class="card card-hover card-interactive template-card" data-template="${t.id}" style="padding:var(--sp-3) var(--sp-4);cursor:pointer;">
            <div style="font-weight:600;color:var(--ink);font-size:0.875rem;">${t.name}</div>
            <div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;">${t.desc}</div>
          </div>
        `).join('')}
      </div>
    `,
    onMount: (modal) => {
      modal.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
          const tId = card.dataset.template;
          const template = LESSON_TEMPLATES.find(t => t.id === tId);
          if (!template) return;
          if (templateModalRef?.close) templateModalRef.close();
          // Set the template prompt as the chat input
          const chatInput = container.querySelector('#chat-input');
          if (chatInput) {
            const cls = planClassContext;
            const classContext = cls ? ` This lesson is for ${cls.name} (${cls.subject || 'General'}, ${cls.level || 'Secondary'}).` : '';
            chatInput.value = template.prompt + classContext;
            chatInput.focus();
            showToast(`Template "${template.name}" loaded. Hit Send to start!`, 'success');
          }
        });
      });
    }
  });
}
