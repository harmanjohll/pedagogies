/*
 * Co-Cher Lessons Library
 * =======================
 * List all saved lessons, view details, add reflections.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { showToast, showActionToast } from '../components/toast.js';
import { processLatex } from '../utils/latex.js';
import { md as mdFull } from '../utils/markdown.js';
import { exportPack, importPack } from '../utils/share-pack.js';
import { getCurrentUser } from '../components/login.js';
import { loadTT, findTeacherRow, buildMyTimetable } from './dashboard.js';
import { renderWorkflowBreadcrumb, bindWorkflowClicks } from '../components/workflow-breadcrumb.js';
import { applyJourneyMinimal, toggleJourneyMinimal } from '../components/keyboard-shortcuts.js';
import { openDeckById, getMediaContent } from '../utils/deck.js';
import { isVoiceInputSupported, createDictation } from '../utils/voice.js';
import { isTouch } from '../utils/viewport.js';

const STATUS_MAP = {
  draft: { label: 'Draft', badge: 'badge-gray' },
  ready: { label: 'Ready', badge: 'badge-green' },
  completed: { label: 'Completed', badge: 'badge-blue' }
};

const E21CC_LABELS = {
  // Legacy 3-domain keys
  cait: 'CAIT', cci: 'CCI', cgc: 'CGC',
  // Current 6-dimension keys
  criticalThinking: 'Critical Thinking', creativeThinking: 'Creative Thinking',
  communication: 'Communication', collaboration: 'Collaboration',
  socialConnectedness: 'Social Connectedness', selfRegulation: 'Self-Regulation'
};
const E21CC_BADGE = {
  cait: 'badge-blue', cci: 'badge-green', cgc: 'badge-amber',
  criticalThinking: 'badge-blue', creativeThinking: 'badge-violet',
  communication: 'badge-green', collaboration: 'badge-amber',
  socialConnectedness: 'badge-rose', selfRegulation: 'badge-gray'
};
const e21Label = (f) => E21CC_LABELS[f] || f;
const e21Badge = (f) => E21CC_BADGE[f] || 'badge-gray';

/* Linked-resource chip styling per type. Unknown/legacy types keep the
 * historical Source styling so old lessons render unchanged. WS-4 adds
 * 'deck' (compiled HTML slide decks) and 'audio' (AI-voiced clips). */
const RESOURCE_CHIP = {
  stimulus:   { badge: 'badge-blue',   label: 'Stimulus' },
  simulation: { badge: 'badge-green',  label: 'Simulation' },
  source:     { badge: 'badge-amber',  label: 'Source' },
  deck:       { badge: 'badge-violet', label: 'Deck' },
  audio:      { badge: 'badge-rose',   label: 'Audio' }
};
const chipMeta = (t) => RESOURCE_CHIP[t] || { badge: 'badge-amber', label: 'Source' };

/* Inline playback for an attached audio clip (WS-4). The WAV Blob lives in
 * the IndexedDB 'media' store; playback is fully offline via an object URL. */
async function showAudioClipModal(id, title) {
  const blob = await getMediaContent(id);
  if (!(blob instanceof Blob)) {
    showToast('Audio content not found on this device.', 'danger');
    return;
  }
  const url = URL.createObjectURL(blob);
  const { backdrop, close } = openModal({
    title: `&#127911; ${esc(title || 'Audio clip')}`,
    width: 420,
    onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000),
    body: `
      <audio controls src="${url}" style="width:100%;"></audio>
      <p style="font-size:0.75rem;color:var(--ink-muted);margin-top:var(--sp-2);">AI voices only &mdash; no music or sound effects.</p>`,
    footer: `<button class="btn btn-secondary" data-action="close">Close</button>`
  });
  backdrop.querySelector('[data-action="close"]').addEventListener('click', close);
}

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

function normalizeReflection(ref) {
  if (!ref) return { whatWorked: '', whatToAdjust: '', engagement: 0, e21ccObservations: '', freeform: '' };
  if (typeof ref === 'string') return { whatWorked: '', whatToAdjust: '', engagement: 0, e21ccObservations: '', freeform: ref };
  return { whatWorked: ref.whatWorked || '', whatToAdjust: ref.whatToAdjust || '', engagement: ref.engagement || 0, e21ccObservations: ref.e21ccObservations || '', freeform: ref.freeform || '' };
}

function hasReflection(ref) {
  const r = normalizeReflection(ref);
  return !!(r.whatWorked || r.whatToAdjust || r.engagement || r.e21ccObservations || r.freeform);
}

/* ── WS-G Growth loop: low-friction reflection capture ──
 * Teacher LEADS. Quick-template chips only DROP a starter sentence into a field
 * (the teacher then edits or deletes it); mics only SURFACE dictated text into a
 * field. Neither ever saves, advances, or writes a reflection on its own — the
 * teacher's "Save Reflection" click remains the only thing that persists. */
const REFLECTION_QUICK_TEMPLATES = [
  { label: 'Went well', target: 'ref-what-worked', text: 'The lesson went well overall.' },
  { label: 'High engagement', target: 'ref-what-worked', text: 'Students were highly engaged and on task.' },
  { label: 'Ran short on time', target: 'ref-what-adjust', text: 'Ran short on time — adjust the pacing next lesson.' },
  { label: 'Re-teach next lesson', target: 'ref-what-adjust', text: 'Re-teach this next lesson to consolidate the key idea.' },
];

const MIC_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

/** Mic button markup for a reflection field. Only rendered when voice is
 * supported — see isVoiceInputSupported() gating in renderDetail. */
function micButtonHTML(targetId) {
  return `<button type="button" class="btn btn-ghost btn-sm ref-mic-btn" data-mic-target="${targetId}" aria-pressed="false" title="Dictate — tap to talk, tap again to stop" style="padding:2px 6px;flex-shrink:0;color:var(--ink-muted);">${MIC_SVG}</button>`;
}

/** Append a sentence into a textarea without saving. Fires an input event so
 * any listeners see the change; leaves the caret at the end for editing. */
function appendToField(el, text) {
  if (!el || !text) return;
  const cur = el.value.replace(/\s+$/, '');
  el.value = cur ? `${cur} ${text}` : text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
  try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) { /* non-text field */ }
}

/** Wire a press-to-talk mic to its reflection field. Tap to start listening,
 * tap again to stop. Interim text shows live; each final segment lands in the
 * box and stays editable. NEVER auto-saves or auto-advances. */
function wireMic(btn, container) {
  const field = container.querySelector('#' + btn.dataset.micTarget);
  if (!field) return;
  let listening = false;
  let base = '';        // committed text: field value at start, then + each final
  let dictation = null;

  const setActive = (on) => {
    listening = on;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.style.color = on ? 'var(--danger)' : 'var(--ink-muted)';
    btn.title = on ? 'Listening — tap to stop' : 'Dictate — tap to talk, tap again to stop';
  };

  btn.addEventListener('click', () => {
    if (listening) { if (dictation) dictation.stop(); return; }
    base = field.value.replace(/\s+$/, '');
    dictation = createDictation({
      lang: 'en-SG',
      onInterim: (txt) => { field.value = base ? `${base} ${txt}` : txt; },
      onResult: (txt) => {
        const clean = String(txt || '').trim();
        if (!clean) return;
        base = base ? `${base} ${clean}` : clean;
        field.value = base;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      },
      onError: () => { showToast('Could not capture audio — check mic permissions.', 'danger'); },
      onEnd: () => { setActive(false); dictation = null; },
    });
    if (dictation.start()) setActive(true);
    else dictation = null;
  });
}

/* ── Lesson lifecycle: Design → Ready → Rehearse → Teach → Reflect ──
 * The lesson object carries the flow; each stage surfaces ONE next step
 * so the interface guides the teacher through the cycle. */
export const LIFECYCLE_STAGES = [
  { key: 'draft', label: 'Design' },
  { key: 'ready', label: 'Ready' },
  { key: 'rehearsed', label: 'Rehearse' },
  { key: 'taught', label: 'Teach' },
  { key: 'reflected', label: 'Reflect' },
];

export function lessonStage(l) {
  if (!l) return 'draft';
  if (l.status === 'completed') return hasReflection(l.reflection) ? 'reflected' : 'taught';
  if (l.rehearsedAt) return 'rehearsed';
  if (l.status === 'ready') return 'ready';
  return 'draft';
}

export function lessonNextStep(l) {
  switch (lessonStage(l)) {
    case 'draft': return { action: 'mark-ready', label: 'Mark ready to teach &rarr;' };
    case 'ready': return { action: 'rehearse', label: 'Rehearse this lesson &rarr;' };
    case 'rehearsed': return { action: 'taught', label: 'Mark as taught' };
    case 'taught': return { action: 'reflect', label: 'Add your reflection' };
    case 'reflected': return { action: 'next-lesson', label: 'Plan next lesson with these insights &rarr;' };
    default: return { action: 'mark-ready', label: 'Mark ready to teach &rarr;' };
  }
}

function lifecycleStepperHTML(lesson) {
  const stage = lessonStage(lesson);
  const next = lessonNextStep(lesson);
  // The stage strip is the shared workflow-breadcrumb component in lifecycle
  // mode, driven by this lesson's REAL stage (unifies the two workflow models).
  const strip = renderWorkflowBreadcrumb(null, { lifecycle: { stages: LIFECYCLE_STAGES, currentKey: stage } });
  // Optional secondary action: at the "ready" stage, offer the rehearsal studio
  // alongside the in-place advance so the studio feature isn't lost.
  const studioLink = stage === 'ready'
    ? `<button class="btn btn-ghost btn-sm" id="lifecycle-studio" style="font-size:0.75rem;">Practise in studio &rarr;</button>`
    : '';
  return `
    <div class="card lifecycle-stepper" style="margin-bottom:var(--sp-5);padding:var(--sp-4) var(--sp-5);">
      <div style="display:flex;align-items:center;flex-wrap:wrap;row-gap:10px;gap:var(--sp-2);">
        <div class="lifecycle-stages" style="flex:1;min-width:0;">${strip}</div>
        <button class="btn btn-ghost btn-sm lifecycle-min-toggle" id="journey-minimal-toggle" title="Collapse the journey to just the next action" aria-pressed="false" style="padding:4px 8px;font-size:0.6875rem;color:var(--ink-muted);white-space:nowrap;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          <span class="journey-min-label">Next action only</span>
        </button>
        ${studioLink}
        <button class="btn btn-primary btn-sm" id="lifecycle-cta" data-action="${next.action}">${next.label}</button>
      </div>
    </div>`;
}

/* Growth-green loop-close celebration: a lesson has just reached `reflected`.
 * Restrained by design (matches showActionToast / the "done for the day" banner
 * tone): a gentle scale-in on the journey's final dot plus one growth-green
 * toast — no confetti. The motion is pure CSS and is suppressed for
 * reduced-motion users by the guard in components.css. */
function celebrateLoopClose(container, id) {
  // Re-render so the stepper shows the new `reflected` stage, then pop the final
  // dot on the next frame (once the fresh DOM is in place).
  renderDetail(container, { id });
  requestAnimationFrame(() => {
    const dot = container.querySelector('.lifecycle-dot-final');
    if (dot) {
      dot.classList.add('celebrate-loop-close');
      dot.addEventListener('animationend', () => dot.classList.remove('celebrate-loop-close'), { once: true });
    }
  });
  showToast('Loop closed — that’s the full cycle for this lesson. ✓', 'growth', 3200);
}

const ROUND_ITEMS = new Set(['desk_round', 'vr_station', 'group_table', 'beanbag', 'plant']);
const ITEM_COLORS = {
  desk_rect: '#e5e7eb', desk_round: '#d1fae5', desk_trap: '#fee2e2', desk_tri: '#e0f2fe',
  chair: '#e5e7eb', stand_table: '#fde68a', teacher_desk: '#bfdbfe',
  writable_tv: '#e5e7eb', vr_station: '#dbeafe', tablet_cart: '#e0e7ff', printer_3d: '#d1d5db',
  whiteboard: '#93c5fd', tool_cabinet: '#e5e7eb',
  group_table: '#a7f3d0', partition: '#34d399',
  couch: '#fdba74', beanbag: '#fde68a', plant: '#bbf7d0',
  desk_blue: '#bfdbfe', desk_green: '#bbf7d0', desk_orange: '#fed7aa'
};

function renderLayoutThumbnail(items) {
  if (!items || items.length === 0) return '<p style="color:var(--ink-muted);font-size:0.8125rem;">No items in this layout.</p>';
  const VB_W = 1440, VB_H = 720;
  const shapes = items.map(item => {
    const color = ITEM_COLORS[item.id] || '#d1d5db';
    if (ROUND_ITEMS.has(item.id)) {
      return `<circle cx="${item.x}" cy="${item.y}" r="22" fill="${color}" stroke="#94a3b8" stroke-width="2"/>`;
    }
    return `<rect x="${item.x - 22}" y="${item.y - 15}" width="44" height="30" rx="3" fill="${color}" stroke="#94a3b8" stroke-width="1.5" transform="rotate(${item.r || 0} ${item.x} ${item.y})"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${VB_W} ${VB_H}" style="width:100%;height:auto;background:#fafbfc;border:1px solid var(--border);border-radius:var(--radius-lg);" xmlns="http://www.w3.org/2000/svg">
    <rect width="${VB_W}" height="${VB_H}" fill="#fafbfc" stroke="#94a3b8" stroke-width="3" rx="2"/>
    <line x1="720" y1="0" x2="720" y2="${VB_H}" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4"/>
    <line x1="1080" y1="0" x2="1080" y2="${VB_H}" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.4"/>
    ${shapes}
  </svg>`;
}

function mdBasic(text) {
  // The detail page (and its print view) has no [EXPAND:] click handler —
  // strip the markers so plans never show dead chips here. Expanding lives
  // in the Lesson Planner; cached expansions stay on the lesson object.
  return String(text ?? '')
    .replace(/\[EXPAND:[^\]]*\]/g, '')
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
          <div style="display:flex;gap:var(--sp-2);">
            <button class="btn btn-secondary btn-sm" id="dept-pack-btn" title="Share or import a Department Pack">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              Department Pack
            </button>
            <button class="btn btn-secondary btn-sm" id="import-lesson-btn" title="Import a shared lesson">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import
            </button>
            <button class="btn btn-primary" id="new-lesson-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Lesson
            </button>
          </div>
        </div>

        <!-- Workflow Breadcrumb -->
        ${renderWorkflowBreadcrumb('reflect')}

        <!-- Term Filter -->
        ${lessons.length > 0 ? `
        <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-4);">
          <label style="font-size:0.75rem;font-weight:600;color:var(--ink-muted);white-space:nowrap;">Filter by Term:</label>
          <select id="term-filter" class="input" style="width:auto;padding:4px 10px;font-size:0.8125rem;">
            <option value="all">All Terms</option>
            <option value="1">Term 1 (Jan–Mar)</option>
            <option value="2">Term 2 (Mar–May)</option>
            <option value="3">Term 3 (Jun–Sep)</option>
            <option value="4">Term 4 (Sep–Nov)</option>
          </select>
        </div>` : ''}

        <!-- My Timetable (populated async) -->
        <div id="lessons-tt-timetable"></div>

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
            ${lessons.some(l => l.isExemplar) ? `<button class="tab" data-filter="exemplar">&#9733; Exemplars (${lessons.filter(l => l.isExemplar).length})</button>` : ''}
          </div>
          <div id="lessons-grid" class="stagger" style="display:flex;flex-direction:column;gap:var(--sp-4);"></div>
        `}
      </div>
    </div>
  `;

  // Bind workflow breadcrumb navigation
  bindWorkflowClicks(container);

  const grid = container.querySelector('#lessons-grid');
  if (grid) renderCards(grid, lessons, classMap);

  // Term filter
  const termFilter = container.querySelector('#term-filter');
  if (termFilter) {
    termFilter.addEventListener('change', () => {
      const term = termFilter.value;
      if (term === 'all') {
        renderCards(grid, lessons, classMap);
        return;
      }
      const termRanges = {
        '1': [0, 2],   // Jan-Mar
        '2': [2, 4],   // Mar-May
        '3': [5, 8],   // Jun-Sep
        '4': [8, 10]   // Sep-Nov
      };
      const [startMonth, endMonth] = termRanges[term];
      const filtered = lessons.filter(l => {
        const d = new Date(l.createdAt || 0);
        return d.getMonth() >= startMonth && d.getMonth() <= endMonth;
      });
      renderCards(grid, filtered, classMap);
    });
  }

  container.querySelectorAll('[data-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('[data-filter]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const f = tab.dataset.filter;
      const subset = f === 'all' ? lessons
        : f === 'exemplar' ? lessons.filter(l => l.isExemplar)
        : lessons.filter(l => l.status === f);
      renderCards(grid, subset, classMap);
    });
  });

  (container.querySelector('#new-lesson-btn') || container.querySelector('#new-lesson-empty'))
    ?.addEventListener('click', () => navigate('/lesson-planner'));

  // Department Pack — share/import a bundle with the department
  container.querySelector('#dept-pack-btn')?.addEventListener('click', () => showDeptPackModal(container));

  // Import lesson — file or paste JSON
  container.querySelector('#import-lesson-btn')?.addEventListener('click', () => {
    import('../components/modals.js').then(({ openModal }) => {
      const { backdrop, close } = openModal({
        title: 'Import Lesson',
        body: `
          <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
            Import a lesson from a <strong>.json</strong> file or paste JSON directly.
          </p>
          <div style="display:flex;gap:var(--sp-3);margin-bottom:var(--sp-4);">
            <button class="btn btn-secondary btn-sm" id="import-file-btn" style="flex:1;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Choose File
            </button>
          </div>
          <div class="input-group">
            <label class="input-label">Or paste JSON</label>
            <textarea class="input" id="import-json-paste" rows="6" placeholder='{"_cocher_lesson": true, "title": "...", ...}'></textarea>
          </div>
        `,
        footer: `
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-primary" data-action="import">Import from Paste</button>
        `
      });

      function processImport(data) {
        if (!data._cocher_lesson || !data.title) throw new Error('Invalid');
        // Re-create the embedded spatial layout (if any) so the link survives
        // across browsers — a bare ID from someone else's storage is useless.
        let layoutId = null;
        if (data.spatialLayoutData && Array.isArray(data.spatialLayoutData.items)) {
          const saved = Store.saveLayout({
            name: (data.spatialLayoutData.name || data.title) + ' (imported)',
            items: data.spatialLayoutData.items,
            preset: data.spatialLayoutData.preset || null,
            venue: data.spatialLayoutData.venue || 'classroom',
            wallState: data.spatialLayoutData.wallState || 'closed',
            studentCount: data.spatialLayoutData.studentCount || 30,
            scenes: data.spatialLayoutData.scenes || []
          });
          layoutId = saved.id;
        }
        const lesson = Store.addLesson({
          title: data.title + ' (imported)',
          classId: null,
          status: 'draft',
          chatHistory: data.chatHistory || [],
          plan: data.plan || '',
          e21ccFocus: data.e21ccFocus || [],
          reflection: data.reflection || '',
          objectives: data.objectives || '',
          lessonHook: data.lessonHook || '',
          components: (data.components && typeof data.components === 'object') ? data.components : {},
          spatialLayout: layoutId,
          runOfShow: data.runOfShow || null
        });
        // Cached [EXPAND:] expansions ride along. addLesson whitelists its
        // fields, so unknown keys drop — merge them back via updateLesson.
        if (data.expansions && typeof data.expansions === 'object' && !Array.isArray(data.expansions)
            && Object.keys(data.expansions).length > 0) {
          Store.updateLesson(lesson.id, { expansions: { ...data.expansions } });
        }
        return lesson;
      }

      backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);

      backdrop.querySelector('#import-file-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', () => {
          const file = input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const lesson = processImport(JSON.parse(reader.result));
              showToast(`Imported "${lesson.title}"!`, 'success');
              close();
              navigate(`/lessons/${lesson.id}`);
            } catch {
              showToast('Invalid lesson file.', 'danger');
            }
          };
          reader.readAsText(file);
        });
        input.click();
      });

      backdrop.querySelector('[data-action="import"]').addEventListener('click', () => {
        const json = backdrop.querySelector('#import-json-paste').value.trim();
        if (!json) { showToast('Please paste JSON data.', 'danger'); return; }
        try {
          const lesson = processImport(JSON.parse(json));
          showToast(`Imported "${lesson.title}"!`, 'success');
          close();
          navigate(`/lessons/${lesson.id}`);
        } catch {
          showToast('Invalid JSON. Must be a Co-Cher exported lesson.', 'danger');
        }
      });
    });
  });

  // Async My Timetable
  (async () => {
    try {
      const user = getCurrentUser();
      if (!user?.email) return;
      const ttData = await loadTT();
      const teacherRow = findTeacherRow(ttData, user.email);
      const el = container.querySelector('#lessons-tt-timetable');
      if (!el) return;
      if (teacherRow) {
        el.innerHTML = buildMyTimetable(teacherRow);
      }
    } catch { /* TT is optional */ }
  })();
}

function renderCards(grid, lessons, classMap) {
  if (!grid) return;
  if (lessons.length === 0) {
    grid.innerHTML = `<div style="text-align:center;padding:var(--sp-8);color:var(--ink-muted);font-size:0.875rem;">No lessons match this filter.</div>`;
    return;
  }
  // WS-G mobile: HTML5 drag is unreliable on touch, so touch devices also get
  // ▲/▼ reorder buttons that write the SAME order via the same update path.
  const touch = isTouch();
  grid.innerHTML = lessons.map((l, idx) => {
    const s = STATUS_MAP[l.status] || STATUS_MAP.draft;
    const cn = l.classId ? classMap[l.classId] : null;
    const ex = (l.chatHistory || []).filter(m => m.role === 'assistant').length;
    return `
      <div class="card card-hover card-interactive" data-lesson-id="${l.id}" draggable="true" data-order="${idx}" style="padding:var(--sp-5) var(--sp-6);cursor:grab;transition:opacity 0.15s,transform 0.15s;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-1);flex-wrap:wrap;">
              ${touch ? `<span class="ros-reorder" style="display:inline-flex;gap:2px;margin-right:4px;">
                <button type="button" class="btn btn-ghost btn-sm ros-move-btn" data-dir="up" data-idx="${idx}" title="Move up" ${idx === 0 ? 'disabled' : ''} style="padding:0 6px;font-size:0.75rem;line-height:1.4;">&#9650;</button>
                <button type="button" class="btn btn-ghost btn-sm ros-move-btn" data-dir="down" data-idx="${idx}" title="Move down" ${idx === lessons.length - 1 ? 'disabled' : ''} style="padding:0 6px;font-size:0.75rem;line-height:1.4;">&#9660;</button>
              </span>` : `<span style="color:var(--ink-faint);cursor:grab;margin-right:2px;" title="Drag to reorder">&#9776;</span>`}
              <span class="badge ${s.badge} badge-dot">${s.label}</span>
              ${l.isExemplar ? `<span class="badge badge-violet" title="Sample lesson you can explore or duplicate">&#9733; Exemplar</span>` : ''}
              ${l.sharedBy ? `<span class="badge badge-violet" title="Shared via Department Pack">From ${esc(l.sharedBy)}</span>` : ''}
              ${cn ? `<span class="badge badge-gray">${esc(cn)}</span>` : ''}
              ${(l.e21ccFocus || []).map(f => `<span class="badge ${e21Badge(f)}">${e21Label(f)}</span>`).join('')}
            </div>
            <h3 style="font-family:var(--font-serif, Georgia);font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:2px;">${esc(l.title)}</h3>
            <p style="font-size:0.8125rem;color:var(--ink-muted);">
              ${ex} exchange${ex !== 1 ? 's' : ''} &middot; ${timeAgo(l.updatedAt)}${hasReflection(l.reflection) ? ' &middot; Has reflection' : ''}
            </p>
          </div>
          <div style="display:flex;gap:var(--sp-1);flex-shrink:0;margin-left:var(--sp-4);">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${l.id}" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm dup-btn" data-id="${l.id}" title="Duplicate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm tmpl-btn" data-id="${l.id}" title="Use as Template">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
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
  grid.querySelectorAll('.dup-btn').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const original = Store.getLesson(b.dataset.id);
      if (!original) return;
      const dup = Store.addLesson({
        title: original.title + ' (copy)',
        classId: original.classId,
        status: 'draft',
        chatHistory: [...(original.chatHistory || [])],
        plan: original.plan || '',
        e21ccFocus: [...(original.e21ccFocus || [])]
      });
      // Carry the remix chain onto the copy
      Store.updateLesson(dup.id, { remixedFrom: { author: original.sharedBy || 'you', title: original.title } });
      showToast(`Duplicated "${original.title}"`, 'success');
      navigate(`/lesson-planner/${dup.id}`);
    });
  });
  grid.querySelectorAll('.del-btn').forEach(b => {
    b.addEventListener('click', async e => {
      e.stopPropagation();
      const lesson = Store.getLesson(b.dataset.id);
      const ok = await confirmDialog({ title: 'Delete Lesson', message: `Delete "${lesson?.title}"? You'll have a few seconds to undo.`, confirmLabel: 'Delete' });
      if (ok && lesson) {
        // Snapshot for undo, then delete
        const snapshot = JSON.parse(JSON.stringify(lesson));
        Store.deleteLesson(b.dataset.id);
        navigate('/lessons');
        showActionToast(`Deleted "${lesson.title}"`, 'Undo', () => {
          Store.restoreLesson(snapshot);
          showToast('Lesson restored', 'success');
          navigate('/lessons');
        });
      }
    });
  });

  // Use as Template
  grid.querySelectorAll('.tmpl-btn').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const original = Store.getLesson(b.dataset.id);
      if (!original) return;
      const tmpl = Store.addLesson({
        title: original.title + ' (template)',
        classId: null,
        status: 'draft',
        chatHistory: [...(original.chatHistory || [])],
        plan: original.plan || '',
        e21ccFocus: [...(original.e21ccFocus || [])]
      });
      showToast(`Template created from "${original.title}"`, 'success');
      navigate(`/lesson-planner/${tmpl.id}`);
    });
  });

  // Drag-and-drop reordering
  let dragSrcEl = null;
  grid.querySelectorAll('[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragSrcEl = card;
      card.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.lessonId);
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
      grid.querySelectorAll('[draggable]').forEach(c => c.style.borderTop = '');
    });
    card.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.style.borderTop = '2px solid var(--accent)';
    });
    card.addEventListener('dragleave', () => { card.style.borderTop = ''; });
    card.addEventListener('drop', e => {
      e.preventDefault();
      card.style.borderTop = '';
      if (dragSrcEl === card) return;
      const allCards = [...grid.querySelectorAll('[draggable="true"]')];
      const fromIdx = allCards.indexOf(dragSrcEl);
      const toIdx = allCards.indexOf(card);
      reorderLessonsBy(lessons, fromIdx, toIdx, grid, classMap);
    });
  });

  // WS-G touch reorder — ▲/▼ move a card one slot, persisting via the same
  // path as drag. stopPropagation keeps the card-tap navigation from firing.
  grid.querySelectorAll('.ros-move-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx, 10);
      const toIdx = btn.dataset.dir === 'up' ? idx - 1 : idx + 1;
      if (toIdx < 0 || toIdx >= lessons.length) return;
      reorderLessonsBy(lessons, idx, toIdx, grid, classMap);
    });
  });
}

/* Shared reorder for the lessons list: moves the item at `fromIdx` to `toIdx`
 * within the currently displayed order, persisting the new order by writing
 * descending updatedAt stamps (the field the list sorts on) for the displayed
 * lessons. Both HTML5 drag and the touch ▲/▼ buttons route through here so they
 * persist identically.
 *
 * NOTE: we assign the stamps with a single Store.set('lessons', ...) rather than
 * per-lesson Store.updateLesson calls — updateLesson force-stamps updatedAt to
 * Date.now(), so a tight loop of updates ties within the same millisecond and
 * the intended order is lost. One write with distinct base-i stamps is stable. */
function reorderLessonsBy(displayed, fromIdx, toIdx, grid, classMap) {
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
  const orderedIds = displayed.map(l => l.id);
  const [movedId] = orderedIds.splice(fromIdx, 1);
  orderedIds.splice(toIdx, 0, movedId);
  const base = Date.now();
  const stampById = new Map(orderedIds.map((id, i) => [id, base - i]));
  const next = Store.getLessons().map(l => stampById.has(l.id) ? { ...l, updatedAt: stampById.get(l.id) } : l);
  Store.set('lessons', next);
  showToast('Lessons reordered');
  renderCards(grid, Store.getLessons().sort((a, b) => b.updatedAt - a.updatedAt), classMap);
}

/* ══════════ Department Pack Modal ══════════
 * File-based collegiality: EXPORT bundles chosen lessons + library
 * resources into one .json for the school drive / WhatsApp; IMPORT
 * previews a colleague's pack, then merges it in with fresh ids. */

function showDeptPackModal(container) {
  const myLessons = Store.getLessons().sort((a, b) => b.updatedAt - a.updatedAt);
  const stimulus = Store.get('stimulusLibrary') || [];
  const sources = Store.get('sourceLibrary') || [];
  const layouts = Store.get('savedLayouts') || [];
  const uploads = Store.get('knowledgeUploads') || [];

  const extraToggles = [
    { key: 'stimulus', label: 'Stimulus materials', items: stimulus },
    { key: 'sources', label: 'Source analyses', items: sources },
    { key: 'layouts', label: 'Classroom layouts', items: layouts },
    { key: 'uploads', label: 'Knowledge Base uploads', items: uploads }
  ];

  const { backdrop, close } = openModal({
    title: 'Department Pack',
    width: 560,
    body: `
      <div class="tab-group" style="margin-bottom:var(--sp-4);">
        <button class="tab active" data-pack-tab="export">Export</button>
        <button class="tab" data-pack-tab="import">Import</button>
      </div>

      <div id="pack-export-panel">
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
          Bundle lessons and resources into a single <strong>.json</strong> file to pass around on the school drive or WhatsApp.
        </p>
        <div class="input-group">
          <label class="input-label">Pack Title</label>
          <input class="input" id="pack-title" value="Department Pack — ${fmtDate(Date.now())}" />
        </div>
        <div class="input-group">
          <label class="input-label">Lessons (${myLessons.length})</label>
          ${myLessons.length === 0
            ? `<p style="font-size:0.75rem;color:var(--ink-faint);">No lessons saved yet.</p>`
            : `<div style="max-height:180px;overflow-y:auto;border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--sp-2) var(--sp-3);display:flex;flex-direction:column;gap:var(--sp-1);">
                ${myLessons.map(l => `
                  <label style="display:flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;color:var(--ink);cursor:pointer;">
                    <input type="checkbox" class="pack-lesson" value="${l.id}" checked />
                    <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(l.title)}</span>
                    <span class="badge ${(STATUS_MAP[l.status] || STATUS_MAP.draft).badge}" style="flex-shrink:0;">${(STATUS_MAP[l.status] || STATUS_MAP.draft).label}</span>
                  </label>`).join('')}
              </div>`}
        </div>
        <div class="input-group">
          <label class="input-label">Also include</label>
          <div style="display:flex;flex-direction:column;gap:var(--sp-1);">
            ${extraToggles.map(t => `
              <label style="display:flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;color:${t.items.length ? 'var(--ink)' : 'var(--ink-faint)'};cursor:pointer;">
                <input type="checkbox" class="pack-extra" value="${t.key}" ${t.items.length ? '' : 'disabled'} />
                ${t.label} (${t.items.length})
              </label>`).join('')}
          </div>
        </div>
      </div>

      <div id="pack-import-panel" style="display:none;">
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
          Choose a <strong>.json</strong> Department Pack a colleague shared with you. Everything merges in as drafts — nothing of yours is overwritten.
        </p>
        <button class="btn btn-secondary btn-sm" id="pack-file-btn" style="width:100%;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Choose Pack File
        </button>
        <div id="pack-import-summary" style="margin-top:var(--sp-4);"></div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="pack-export">Export Pack</button>
      <button class="btn btn-primary" data-action="pack-import" style="display:none;" disabled>Import Pack</button>
    `
  });

  const exportPanel = backdrop.querySelector('#pack-export-panel');
  const importPanel = backdrop.querySelector('#pack-import-panel');
  const exportBtn = backdrop.querySelector('[data-action="pack-export"]');
  const importBtn = backdrop.querySelector('[data-action="pack-import"]');
  let pendingImport = null;

  backdrop.querySelectorAll('[data-pack-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      backdrop.querySelectorAll('[data-pack-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isExport = tab.dataset.packTab === 'export';
      exportPanel.style.display = isExport ? '' : 'none';
      importPanel.style.display = isExport ? 'none' : '';
      exportBtn.style.display = isExport ? '' : 'none';
      importBtn.style.display = isExport ? 'none' : '';
    });
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);

  exportBtn.addEventListener('click', async () => {
    const ids = new Set([...backdrop.querySelectorAll('.pack-lesson:checked')].map(cb => cb.value));
    const extras = new Set([...backdrop.querySelectorAll('.pack-extra:checked')].map(cb => cb.value));
    const selection = {
      title: backdrop.querySelector('#pack-title').value.trim(),
      lessons: myLessons.filter(l => ids.has(l.id)),
      stimulus: extras.has('stimulus') ? stimulus : [],
      sources: extras.has('sources') ? sources : [],
      layouts: extras.has('layouts') ? layouts : [],
      uploads: extras.has('uploads') ? uploads : []
    };
    const count = selection.lessons.length + selection.stimulus.length + selection.sources.length
      + selection.layouts.length + selection.uploads.length;
    if (count === 0) { showToast('Select at least one lesson or resource to share.', 'danger'); return; }
    // Async: attached simulations' HTML is pulled from IndexedDB during export
    exportBtn.disabled = true;
    try {
      await exportPack(selection);
      showToast('Pack exported! Drop it on the school drive or WhatsApp it to your department.', 'success');
      close();
    } catch (err) {
      showToast(`Export failed: ${err.message}`, 'danger');
    } finally {
      exportBtn.disabled = false;
    }
  });

  // Import: choose file → preview summary → confirm merge
  backdrop.querySelector('#pack-file-btn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const summaryEl = backdrop.querySelector('#pack-import-summary');
        try {
          pendingImport = importPack(reader.result);
          const { summary } = pendingImport;
          summaryEl.innerHTML = `
            <div style="background:var(--marker-wash,#FFF6BF);border-radius:var(--radius-md);padding:var(--sp-3) var(--sp-4);font-size:0.8125rem;color:var(--ink);line-height:1.6;">
              <strong style="font-family:var(--font-serif, Georgia);">${esc(summary.title)}</strong><br>
              From ${esc(summary.sharedBy)}: ${esc(summary.breakdown)}${summary.sharedAt ? ` &middot; shared ${fmtDate(summary.sharedAt)}` : ''}
            </div>`;
          importBtn.disabled = false;
        } catch (err) {
          pendingImport = null;
          importBtn.disabled = true;
          summaryEl.innerHTML = `<p style="font-size:0.8125rem;color:var(--danger);">${esc(err.message || 'Invalid pack file.')}</p>`;
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  importBtn.addEventListener('click', () => {
    if (!pendingImport) return;
    const result = pendingImport.apply();
    if (result.addedTotal === 0) {
      showToast('Everything in this pack is already in your library.');
    } else {
      showToast(`Merged ${result.breakdown} from ${pendingImport.summary.sharedBy}${result.skipped ? ` (${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''} skipped)` : ''}`, 'success');
    }
    close();
    renderList(container);
  });
}

/* ── Student Pack ──
 * The student-facing components a lesson carries, in hand-out order.
 * Teacher-mediated by design: the teacher prints and distributes; nothing
 * here is exposed to students directly by the app. */
const STUDENT_PACK_COMPONENTS = [
  { key: 'lisc', label: 'Learning Intentions & Success Criteria' },
  { key: 'exitTicket', label: 'Exit Ticket' },
  { key: 'rubric', label: 'Rubric' }
];

function studentPackParts(lesson) {
  const comps = lesson.components || {};
  return STUDENT_PACK_COMPONENTS
    .filter(c => typeof comps[c.key]?.content === 'string' && comps[c.key].content.trim())
    .map(c => ({ label: c.label, content: comps[c.key].content }));
}

/* B7 — "Plan for the Day": the agenda page that opens the Student Pack when
 * the lesson has a run of show. STUDENT-SAFE by design: only the segment
 * name, duration and studentInstructions ever reach this page — seg.activity
 * is the teacher's summary (and plan/chatHistory stay teacher-side too). */
function studentDayPlanHTML(lesson) {
  const segments = lesson.runOfShow?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return '';
  const total = segments.reduce((n, seg) => n + (Number(seg.duration) || 0), 0);
  return `<section>
    <h2>Plan for the Day</h2>
    <table>
      <thead><tr><th style="width:40px;">Part</th><th>Activity</th><th style="width:60px;">Minutes</th><th>What you'll do</th></tr></thead>
      <tbody>
        ${segments.map((seg, i) => `<tr>
          <td>${i + 1}</td>
          <td><strong>${esc(seg.name || `Part ${i + 1}`)}</strong></td>
          <td>${Number(seg.duration) || 0}</td>
          <td>${seg.studentInstructions ? esc(seg.studentInstructions) : '&mdash;'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <p style="font-size:12px;color:#64748b;font-family:system-ui,sans-serif;">${total} minutes in total &middot; ${segments.length} part${segments.length === 1 ? '' : 's'}</p>
  </section>`;
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
  // WS-G: show mics only where the browser can actually dictate. Unsupported
  // browsers (Firefox, Safari) render no mic at all — the fields still work.
  const voiceOn = isVoiceInputSupported();

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
            ${lesson.sharedBy ? `<span class="badge badge-violet" title="Shared via Department Pack">From ${esc(lesson.sharedBy)}</span>` : ''}
            ${cn ? `<span class="badge badge-gray">${esc(cn)}</span>` : ''}
            ${(lesson.e21ccFocus || []).map(f => `<span class="badge ${e21Badge(f)}">${e21Label(f)}</span>`).join('')}
          </div>
          <h1 class="page-title" style="font-family:var(--font-serif, Georgia);">${esc(lesson.title)}</h1>
          <p class="page-subtitle">Created ${fmtDate(lesson.createdAt)} &middot; Updated ${fmtDate(lesson.updatedAt)}</p>
          ${lesson.remixedFrom?.author ? `<p style="font-size:0.75rem;color:var(--ink-muted);font-style:italic;margin-top:2px;">${lesson.remixedFrom.author === 'you' ? 'Remixed from your original' : `Remixed from ${esc(lesson.remixedFrom.author)}'s original`}</p>` : ''}
        </div>

        ${lifecycleStepperHTML(lesson)}

        <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-6);flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="edit-btn">Continue in Planner</button>
          <button class="btn btn-secondary btn-sm" id="status-btn">Change Status</button>
          <button class="btn btn-ghost btn-sm" id="dup-detail-btn" title="Duplicate this lesson">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Duplicate
          </button>
          <button class="btn btn-ghost btn-sm" id="print-lesson-btn" title="Print/export as PDF">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button class="btn btn-ghost btn-sm" id="export-btn" title="Export lesson as shareable JSON file">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>
          ${(studentPackParts(lesson).length > 0 || lesson.runOfShow?.segments?.length > 0) ? `
          <button class="btn btn-ghost btn-sm" id="student-pack-btn" title="Print every student-facing handout in one go">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
            Student Pack
          </button>` : ''}
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

        ${(() => {
          // Run of Show — read-only strip of staged segments (editing lives in
          // the Lesson Planner's "Stage lesson" editor).
          const segments = lesson.runOfShow?.segments;
          if (!Array.isArray(segments) || segments.length === 0) return '';
          const total = segments.reduce((n, seg) => n + (Number(seg.duration) || 0), 0);
          const modeLabels = { individual: 'Individual', pairs: 'Pairs', groups: 'Groups', 'whole-class': 'Whole class' };
          return `
            <div class="card" style="margin-bottom:var(--sp-6);">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);margin-bottom:var(--sp-4);flex-wrap:wrap;">
                <h3 style="font-size:1rem;font-weight:600;color:var(--ink);">Run of Show</h3>
                <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;">
                  <span class="badge badge-blue">${total} min &middot; ${segments.length} segment${segments.length === 1 ? '' : 's'}</span>
                  <button class="btn btn-primary btn-sm" id="present-lesson-btn" title="Open the Class Screen and run this lesson live">&#9654; Present</button>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;">
                ${segments.map((seg, i) => `
                  <div style="display:flex;gap:var(--sp-3);padding:var(--sp-3) 0;${i < segments.length - 1 ? 'border-bottom:1px solid var(--border-light);' : ''}">
                    <span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--accent-light,#eef1ff);color:var(--accent,#4361ee);font-size:0.6875rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${i + 1}</span>
                    <div style="flex:1;min-width:0;">
                      <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;">
                        <span style="font-size:0.875rem;font-weight:600;color:var(--ink);">${esc(seg.name || `Segment ${i + 1}`)}</span>
                        <span style="font-size:0.75rem;color:var(--ink-muted);white-space:nowrap;">${Number(seg.duration) || 0} min</span>
                        ${seg.grouping?.mode ? `<span class="badge badge-gray" style="font-size:0.625rem;">${esc(modeLabels[seg.grouping.mode] || seg.grouping.mode)}</span>` : ''}
                      </div>
                      ${seg.activity ? `<div style="font-size:0.8125rem;color:var(--ink-secondary);margin-top:2px;line-height:1.5;">${esc(seg.activity)}</div>` : ''}
                      ${seg.studentInstructions ? `<div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;line-height:1.5;font-style:italic;">${esc(seg.studentInstructions)}</div>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>`;
        })()}

        ${(() => {
          const layout = lesson.spatialLayout ? Store.getSavedLayouts().find(l => l.id === lesson.spatialLayout) : null;
          if (!layout) return '';
          return `
            <div class="card" style="margin-bottom:var(--sp-6);">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
                <h3 style="font-size:1rem;font-weight:600;color:var(--ink);">Spatial Layout</h3>
                <button class="btn btn-ghost btn-sm" id="view-spatial-btn">Open in Designer</button>
              </div>
              <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">
                ${esc(layout.name)}${layout.preset ? ` &middot; ${esc(layout.preset)} preset` : ''} &middot; ${layout.studentCount || '?'} students
              </p>
              ${renderLayoutThumbnail(layout.items)}
            </div>`;
        })()}

        ${(() => {
          const resources = lesson.attachedResources || [];
          if (resources.length === 0) return '';
          return `
            <div class="card" style="margin-bottom:var(--sp-6);">
              <h3 style="font-size:1rem;font-weight:600;margin-bottom:var(--sp-3);color:var(--ink);">Linked Resources</h3>
              <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
                ${resources.map(r => `
                  <button class="btn btn-ghost btn-sm linked-resource-chip" data-type="${r.type}" data-res-id="${esc(r.id || '')}" style="display:inline-flex;align-items:center;gap:var(--sp-1);padding:var(--sp-1) var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-lg);font-size:0.8125rem;border:1px solid var(--border-light);cursor:pointer;">
                    <span class="badge ${chipMeta(r.type).badge}" style="font-size:0.625rem;">${chipMeta(r.type).label}</span>
                    <span style="color:var(--ink);">${esc(r.title)}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="2" style="margin-left:2px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                `).join('')}
              </div>
            </div>`;
        })()}

        <div class="card">
          <h3 style="font-size:1rem;font-weight:600;margin-bottom:var(--sp-3);color:var(--ink);">Post-Lesson Reflection</h3>
          <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">After teaching, capture what went well, what you'd change, and student responses.</p>

          <div style="margin-bottom:var(--sp-4);">
            <label class="input-label" style="font-size:0.8125rem;font-weight:600;margin-bottom:var(--sp-1);display:block;">Student Engagement</label>
            <div id="engagement-rating" style="display:flex;gap:var(--sp-1);">
              ${[1,2,3,4,5].map(n => `<button class="btn btn-ghost btn-sm star-btn" data-val="${n}" style="font-size:1.25rem;padding:2px 6px;color:${n <= (normalizeReflection(lesson.reflection).engagement || 0) ? 'var(--warning)' : 'var(--ink-faint)'};">${n <= (normalizeReflection(lesson.reflection).engagement || 0) ? '\u2605' : '\u2606'}</button>`).join('')}
              <span style="font-size:0.75rem;color:var(--ink-muted);align-self:center;margin-left:var(--sp-2);" id="engagement-label">
                ${['', 'Low', 'Below Average', 'Average', 'Good', 'Excellent'][normalizeReflection(lesson.reflection).engagement] || 'Rate engagement'}
              </span>
            </div>
          </div>

          <div style="margin-bottom:var(--sp-3);">
            <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-muted);margin-bottom:var(--sp-1);">Quick add &middot; tap to drop a starter line in, then edit freely</div>
            <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
              ${REFLECTION_QUICK_TEMPLATES.map(t => `<button type="button" class="pill quick-tmpl-chip" data-target="${t.target}" data-text="${esc(t.text)}">${esc(t.label)}</button>`).join('')}
            </div>
          </div>

          <div class="input-group" style="margin-bottom:var(--sp-3);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);">
              <label class="input-label" style="font-size:0.8125rem;" for="ref-what-worked">What worked well?</label>
              ${voiceOn ? micButtonHTML('ref-what-worked') : ''}
            </div>
            <textarea class="input" id="ref-what-worked" rows="2" placeholder="Activities, strategies, or moments that went well...">${esc(normalizeReflection(lesson.reflection).whatWorked)}</textarea>
          </div>

          <div class="input-group" style="margin-bottom:var(--sp-3);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);">
              <label class="input-label" style="font-size:0.8125rem;" for="ref-what-adjust">What would you adjust?</label>
              ${voiceOn ? micButtonHTML('ref-what-adjust') : ''}
            </div>
            <textarea class="input" id="ref-what-adjust" rows="2" placeholder="What you'd change next time...">${esc(normalizeReflection(lesson.reflection).whatToAdjust)}</textarea>
          </div>

          <div class="input-group" style="margin-bottom:var(--sp-3);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);">
              <label class="input-label" style="font-size:0.8125rem;" for="ref-e21cc">E21CC Observations</label>
              ${voiceOn ? micButtonHTML('ref-e21cc') : ''}
            </div>
            <textarea class="input" id="ref-e21cc" rows="2" placeholder="How did students demonstrate CAIT, CCI, or CGC?">${esc(normalizeReflection(lesson.reflection).e21ccObservations)}</textarea>
          </div>

          <div class="input-group" style="margin-bottom:var(--sp-3);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);">
              <label class="input-label" style="font-size:0.8125rem;" for="ref-freeform">Additional Notes</label>
              ${voiceOn ? micButtonHTML('ref-freeform') : ''}
            </div>
            <textarea class="input" id="ref-freeform" rows="2" placeholder="Any other observations or reflections...">${esc(normalizeReflection(lesson.reflection).freeform)}</textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:var(--sp-2);">
            <button class="btn btn-ghost btn-sm" id="use-reflection-btn" title="Start a new lesson informed by this reflection" style="color:var(--accent);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Plan next lesson with insights
            </button>
            <button class="btn btn-secondary btn-sm" id="save-ref">Save Reflection</button>
          </div>
          <p class="reflection-disclosure" style="font-size:0.6875rem;color:var(--ink-faint);margin-top:var(--sp-2);line-height:1.5;text-align:right;">
            Saved reflections quietly build your <a href="#/my-growth" style="color:var(--accent);">practice story in My Growth</a>.
          </p>
        </div>
      </div>
    </div>
  `;

  // Render LaTeX in lesson plan content
  processLatex(container);

  container.querySelector('#back-btn').addEventListener('click', () => navigate('/lessons'));
  container.querySelector('#edit-btn').addEventListener('click', () => navigate(`/lesson-planner/${id}`));

  // Apply the persisted "Next action only" preference, then reflect it on the
  // toggle button (label + aria-pressed).
  const journeyMin = applyJourneyMinimal();
  const journeyToggle = container.querySelector('#journey-minimal-toggle');
  if (journeyToggle) {
    const syncToggle = (on) => {
      journeyToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      const lbl = journeyToggle.querySelector('.journey-min-label');
      if (lbl) lbl.textContent = on ? 'Show full journey' : 'Next action only';
    };
    syncToggle(journeyMin);
    journeyToggle.addEventListener('click', () => syncToggle(toggleJourneyMinimal()));
  }

  // Lifecycle next-step CTA — the primary, single-next-action driver. Each click
  // advances the lesson exactly one stage, so the 5-stage flow is followable
  // end-to-end here without the #status-btn bypass.
  container.querySelector('#lifecycle-cta')?.addEventListener('click', (e) => {
    const action = e.currentTarget.dataset.action;
    if (action === 'mark-ready') {
      Store.updateLesson(id, { status: 'ready' });
      showToast('Marked ready to teach — rehearse it when you can.', 'success');
      renderDetail(container, { id });
    } else if (action === 'plan') {
      navigate(`/lesson-planner/${id}`);
    } else if (action === 'rehearse') {
      // Advance in place (record the rehearsal) so the journey is followable
      // from the stepper alone; the studio stays reachable via #lifecycle-studio.
      Store.updateLesson(id, { rehearsedAt: Date.now() });
      showToast('Marked as rehearsed. Next: teach it, then reflect.', 'success');
      renderDetail(container, { id });
    } else if (action === 'taught') {
      Store.updateLesson(id, { status: 'completed' });
      showToast('Marked as taught — capture a quick reflection while it\'s fresh!', 'success');
      renderDetail(container, { id });
    } else if (action === 'reflect') {
      const ref = container.querySelector('#ref-what-worked');
      ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => ref?.focus(), 400);
    } else if (action === 'next-lesson') {
      container.querySelector('#use-reflection-btn')?.click();
    }
  });

  // Secondary: open the rehearsal studio (kept from the old flow).
  container.querySelector('#lifecycle-studio')?.addEventListener('click', () => {
    sessionStorage.setItem('cocher_rehearse_lesson_id', id);
    navigate('/lesson-rehearsal');
  });

  // Linked resource chip navigation — simulations deep-link straight into
  // the attached sim's overlay rather than dropping the teacher at the gallery.
  // WS-4 materials open in place: decks in a new tab (blob URL), audio inline.
  container.querySelectorAll('.linked-resource-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.type;
      if (type === 'deck') {
        openDeckById(chip.dataset.resId).then(ok => {
          if (!ok) showToast('Deck content not found on this device.', 'danger');
        });
        return;
      }
      if (type === 'audio') {
        const res = (lesson.attachedResources || []).find(r => r.id === chip.dataset.resId);
        showAudioClipModal(chip.dataset.resId, res?.title || 'Audio clip');
        return;
      }
      if (type === 'simulation') {
        if (chip.dataset.resId) sessionStorage.setItem('cocher_open_sim_id', chip.dataset.resId);
        navigate('/simulations');
        return;
      }
      navigate(type === 'stimulus' ? '/stimulus-material' : '/source-analysis');
    });
  });

  container.querySelector('#status-btn').addEventListener('click', () => {
    const order = ['draft', 'ready', 'completed'];
    const next = order[(order.indexOf(lesson.status) + 1) % order.length];
    Store.updateLesson(id, { status: next });
    showToast(`Status: ${STATUS_MAP[next].label}`, 'success');
    renderDetail(container, { id });
  });
  container.querySelector('#dup-detail-btn')?.addEventListener('click', () => {
    const dup = Store.addLesson({
      title: lesson.title + ' (copy)',
      classId: lesson.classId,
      status: 'draft',
      chatHistory: [...(lesson.chatHistory || [])],
      plan: lesson.plan || '',
      e21ccFocus: [...(lesson.e21ccFocus || [])]
    });
    // Carry the remix chain onto the copy
    Store.updateLesson(dup.id, { remixedFrom: { author: lesson.sharedBy || 'you', title: lesson.title } });
    showToast(`Duplicated "${lesson.title}"`, 'success');
    navigate(`/lesson-planner/${dup.id}`);
  });
  // Engagement star rating
  let engagementVal = normalizeReflection(lesson.reflection).engagement || 0;
  const engLabels = ['', 'Low', 'Below Average', 'Average', 'Good', 'Excellent'];
  container.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      engagementVal = parseInt(btn.dataset.val);
      container.querySelectorAll('.star-btn').forEach(b => {
        const v = parseInt(b.dataset.val);
        b.textContent = v <= engagementVal ? '\u2605' : '\u2606';
        b.style.color = v <= engagementVal ? 'var(--warning)' : 'var(--ink-faint)';
      });
      container.querySelector('#engagement-label').textContent = engLabels[engagementVal] || '';
    });
  });

  // WS-G quick-template chips — drop a starter sentence into a field. This only
  // fills the textbox; nothing saves until the teacher clicks Save Reflection.
  container.querySelectorAll('.quick-tmpl-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      appendToField(container.querySelector('#' + chip.dataset.target), chip.dataset.text || '');
    });
  });

  // WS-G press-to-talk mics — only when the browser can dictate. Surfaces text
  // into the field; never submits (see wireMic / voice.js).
  if (voiceOn) {
    container.querySelectorAll('.ref-mic-btn').forEach(btn => wireMic(btn, container));
  }

  container.querySelector('#save-ref').addEventListener('click', () => {
    // Snapshot the stage BEFORE saving so we can detect the taught → reflected
    // transition (the loop closing) and celebrate only on that first close.
    const wasTaught = lessonStage(Store.getLesson(id)) === 'taught';
    Store.updateLesson(id, {
      reflection: {
        whatWorked: container.querySelector('#ref-what-worked').value,
        whatToAdjust: container.querySelector('#ref-what-adjust').value,
        engagement: engagementVal,
        e21ccObservations: container.querySelector('#ref-e21cc').value,
        freeform: container.querySelector('#ref-freeform').value
      }
    });
    const nowReflected = lessonStage(Store.getLesson(id)) === 'reflected';
    if (wasTaught && nowReflected) {
      celebrateLoopClose(container, id);
    } else {
      showToast('Reflection saved!', 'success');
    }
  });

  // Plan next lesson with reflection insights
  container.querySelector('#use-reflection-btn')?.addEventListener('click', () => {
    const ref = normalizeReflection(lesson.reflection);
    const insights = [];
    if (ref.whatWorked) insights.push(`What worked previously: ${ref.whatWorked}`);
    if (ref.whatToAdjust) insights.push(`What to adjust: ${ref.whatToAdjust}`);
    if (ref.e21ccObservations) insights.push(`E21CC observations: ${ref.e21ccObservations}`);
    if (ref.engagement) {
      const engLabels = ['', 'Low', 'Below Average', 'Average', 'Good', 'Excellent'];
      insights.push(`Previous lesson engagement: ${engLabels[ref.engagement]}`);
    }
    if (insights.length === 0) {
      showToast('Save your reflection first before using insights.', 'danger');
      return;
    }
    // Store insights for lesson planner to pick up
    sessionStorage.setItem('cocher_reflection_insights', JSON.stringify({
      fromLesson: lesson.title,
      classId: lesson.classId,
      insights: insights.join('\n')
    }));
    if (lesson.classId) {
      const cls = Store.getClass(lesson.classId);
      if (cls) {
        sessionStorage.setItem('cocher_plan_class_id', cls.id);
        sessionStorage.setItem('cocher_plan_class_name', cls.name);
        sessionStorage.setItem('cocher_plan_class_subject', cls.subject || '');
        sessionStorage.setItem('cocher_plan_class_level', cls.level || '');
      }
    }
    navigate('/lesson-planner');
    showToast('Reflection insights loaded into Lesson Planner', 'success');
  });

  // Spatial layout - open in designer
  container.querySelector('#view-spatial-btn')?.addEventListener('click', () => navigate('/spatial'));

  // Present — run the staged lesson on the Class Screen
  container.querySelector('#present-lesson-btn')?.addEventListener('click', () => navigate(`/present/${id}`));

  // Print / PDF
  container.querySelector('#print-lesson-btn')?.addEventListener('click', () => {
    if (aiMsgs.length === 0) { showToast('No lesson content to print.', 'danger'); return; }
    const planHtml = aiMsgs.map(m => mdBasic(m.content)).join('<hr style="margin:24px 0;">');
    const printWin = window.open('', '_blank');
    if (!printWin) { showToast('Pop-up blocked — allow pop-ups for this site to print.', 'danger'); return; }
    printWin.document.write(`<!DOCTYPE html><html><head><title>${esc(lesson.title)} — Co-Cher</title>
      <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.7;font-size:14px}
      h1{font-size:18px;border-bottom:2px solid #000c53;padding-bottom:8px;color:#000c53}
      h2,h3,h4{margin:16px 0 8px}strong{font-weight:600}ul,ol{padding-left:20px}
      hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
      pre{background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto}
      .meta{display:flex;gap:12px;margin-bottom:16px;font-size:12px;color:#64748b}
      .reflection{margin-top:24px;padding:16px;background:#f7f8fc;border-radius:8px;border-left:3px solid #3b82f6}
      @media print{body{margin:0;padding:16px}}</style></head>
      <body>
        <h1>${esc(lesson.title)}</h1>
        <div class="meta">
          <span>${s.label}</span>
          ${cn ? `<span>${esc(cn)}</span>` : ''}
          ${(lesson.e21ccFocus || []).map(f => `<span>${e21Label(f)}</span>`).join('')}
          <span>${fmtDate(lesson.createdAt)}</span>
        </div>
        ${planHtml}
        ${hasReflection(lesson.reflection) ? (() => {
          const r = normalizeReflection(lesson.reflection);
          const engLabels = ['', 'Low', 'Below Average', 'Average', 'Good', 'Excellent'];
          return `<div class="reflection"><strong>Post-Lesson Reflection</strong>
            ${r.engagement ? `<br><strong>Engagement:</strong> ${'&#9733;'.repeat(r.engagement)}${'&#9734;'.repeat(5 - r.engagement)} (${engLabels[r.engagement]})` : ''}
            ${r.whatWorked ? `<br><strong>What worked well:</strong> ${esc(r.whatWorked)}` : ''}
            ${r.whatToAdjust ? `<br><strong>What to adjust:</strong> ${esc(r.whatToAdjust)}` : ''}
            ${r.e21ccObservations ? `<br><strong>E21CC Observations:</strong> ${esc(r.e21ccObservations)}` : ''}
            ${r.freeform ? `<br><strong>Notes:</strong> ${esc(r.freeform)}` : ''}
          </div>`;
        })() : ''}
        <p style="color:#94a3b8;font-size:11px;margin-top:32px;">Exported from Co-Cher · ${new Date().toLocaleDateString('en-SG')}</p>
      </body></html>`);
    printWin.document.close();
    printWin.print();
  });

  // Student Pack — every student-facing handout, one print job, teacher-mediated
  container.querySelector('#student-pack-btn')?.addEventListener('click', () => {
    const parts = studentPackParts(lesson);
    const dayPlan = studentDayPlanHTML(lesson);
    if (parts.length === 0 && !dayPlan) { showToast('No student-facing components yet — generate LI/SC, an exit ticket or a rubric in the Planner first.', 'danger'); return; }
    const pw = window.open('', '_blank');
    if (!pw) { showToast('Pop-up blocked — allow pop-ups for this site to print.', 'danger'); return; }
    pw.document.write(`<!DOCTYPE html><html><head><title>${esc(lesson.title)} — Student Pack</title>
      <style>:root{--ink:#1e293b;--ink-secondary:#334155;--ink-muted:#64748b;--border:#cbd5e1;--border-light:#e2e8f0;--bg-subtle:#f1f5f9;--accent:#000c53;--accent-light:#eef1ff}
      body{font-family:Georgia,'Times New Roman',serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.75;font-size:14px}
      header{border-bottom:3px solid #000c53;padding-bottom:10px;margin-bottom:24px}
      h1{font-size:20px;color:#000c53;margin:0}
      .meta{font-size:12px;color:#64748b;font-family:system-ui,sans-serif;margin-top:4px}
      section{margin-bottom:28px}
      section+section{page-break-before:always}
      h2{font-size:15px;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.05em;color:#000c53;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
      h3,h4{margin:14px 0 6px}strong{font-weight:600}ul,ol{padding-left:22px}
      table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}th,td{text-align:left;padding:6px 10px;border:1px solid #cbd5e1;vertical-align:top}th{font-weight:600;background:#f1f5f9;font-family:system-ui,sans-serif}
      .name-line{margin:16px 0 0;font-family:system-ui,sans-serif;font-size:12px;color:#475569}
      footer{color:#94a3b8;font-size:11px;margin-top:32px;font-family:system-ui,sans-serif}
      @media print{body{margin:0;padding:16px}}</style></head>
      <body>
        <header>
          <h1>${esc(lesson.title)}</h1>
          <div class="meta">${cn ? `${esc(cn)} &middot; ` : ''}${new Date().toLocaleDateString('en-SG')}</div>
          <div class="name-line">Name: ______________________________ &nbsp;&nbsp; Class: ____________ &nbsp;&nbsp; Date: ____________</div>
        </header>
        ${dayPlan}
        ${parts.map(p => `<section><h2>${esc(p.label)}</h2>${mdFull(String(p.content ?? '').replace(/\[EXPAND:[^\]]*\]/g, ''))}</section>`).join('')}
        <footer>Prepared by your teacher with Co-Cher</footer>
      </body></html>`);
    pw.document.close();
    pw.print();
  });

  // Export / Share
  container.querySelector('#export-btn')?.addEventListener('click', () => {
    const exportData = {
      _cocher_lesson: true,
      exportedAt: Date.now(),
      title: lesson.title,
      status: lesson.status,
      e21ccFocus: lesson.e21ccFocus || [],
      chatHistory: lesson.chatHistory || [],
      plan: lesson.plan || '',
      reflection: lesson.reflection || '',
      objectives: lesson.objectives || '',
      lessonHook: lesson.lessonHook || '',
      components: lesson.components || {},
      expansions: lesson.expansions || {},
      runOfShow: lesson.runOfShow || null,
      spatialLayout: lesson.spatialLayout || null,
      spatialLayoutData: lesson.spatialLayout
        ? (Store.getSavedLayouts().find(l => l.id === lesson.spatialLayout) || null)
        : null
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lesson.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'lesson'}.cocher.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Lesson exported! Share the file with colleagues.', 'success');
  });
}
