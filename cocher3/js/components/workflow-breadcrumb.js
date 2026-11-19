/*
 * Co-Cher Workflow Breadcrumb
 * ===========================
 * Shows where the teacher is in the Singapore Teaching Practice:
 * Lesson Preparation → Lesson Enactment → Assessment and Feedback → Reflect
 * Highlights the current step and makes other steps clickable.
 */

import { navigate } from '../router.js';
import { STP_TRAIL } from '../utils/stp.js';

/* The trail is the STP's own: its Teaching Processes, in the order a lesson is
 * usually worked on, then Reflect (utils/stp.js `STP_TRAIL`). Older callers
 * still pass the ids of the first trail; they map onto the processes. */
const ICON = {
  preparation: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  enactment: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.500 3.500z"/>',
  assessment: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  reflect: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
};
const OLD_ID = { sow: 'preparation', plan: 'preparation', enactment: 'enactment', assess: 'assessment', reflect: 'reflect' };
const WORKFLOW_STEPS = STP_TRAIL.map(t => ({ id: t.key, label: t.label, route: t.route, hint: t.hint, icon: ICON[t.key] }));

/**
 * Escape helper for lesson-supplied labels (lifecycle mode is data-driven).
 */
function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

/**
 * Render a workflow breadcrumb bar.
 *
 * Two modes, unifying the app's two "workflow" models into one component:
 *  1. Navigation mode (default): the SoW → Plan → Enactment → Assess → Reflect
 *     path, clickable, with `currentStepId` highlighted. Used where there is no
 *     single lesson in scope (e.g. the Lessons library).
 *  2. Lifecycle mode: pass `opts.lifecycle = { stages, currentKey }` and the bar
 *     reflects the REAL lifecycle stage of the current lesson — completed stages
 *     get a check, the current stage is highlighted, upcoming stages are dimmed.
 *     Non-navigational (it's a status display, not links), so `bindWorkflowClicks`
 *     is a safe no-op over it.
 *
 * @param {string} currentStepId — one of: 'sow', 'plan', 'enactment', 'assess', 'reflect'
 * @param {{ lifecycle?: { stages: {key:string,label:string}[], currentKey: string } }} [opts]
 * @returns {string} HTML string
 */
export function renderWorkflowBreadcrumb(currentStepId, opts = {}) {
  if (opts && opts.lifecycle && Array.isArray(opts.lifecycle.stages)) {
    return renderLifecycleBreadcrumb(opts.lifecycle);
  }
  const here = OLD_ID[currentStepId] || currentStepId;
  const stepsHTML = WORKFLOW_STEPS.map((step, i) => {
    const isCurrent = step.id === here;
    const arrow = i < WORKFLOW_STEPS.length - 1
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;margin:0 2px;"><polyline points="9 18 15 12 9 6"/></svg>`
      : '';

    return `
      <button class="workflow-step${isCurrent ? ' workflow-step-active' : ''}" data-workflow-route="${step.route}" title="${step.hint || ''}"${isCurrent ? ' aria-current="step"' : ''} style="
        display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:var(--radius-full,999px);
        font-size:0.75rem;font-weight:${isCurrent ? '600' : '500'};white-space:nowrap;border:none;cursor:pointer;
        background:${isCurrent ? 'var(--accent-light)' : 'transparent'};
        color:${isCurrent ? 'var(--accent)' : 'var(--ink-muted)'};
        transition:background 0.15s,color 0.15s;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${step.icon}</svg>
        <span>${step.label}</span>
      </button>
      ${arrow}`;
  }).join('');

  return `
    <div class="workflow-breadcrumb" style="display:flex;align-items:center;gap:2px;padding:var(--sp-2) var(--sp-3);margin-bottom:var(--sp-4);overflow-x:auto;border:1px solid var(--border-light);border-radius:var(--radius-lg);background:var(--bg-subtle);">
      <span style="font-size:0.625rem;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.05em;margin-right:var(--sp-2);flex-shrink:0;">Singapore Teaching Practice</span>
      ${stepsHTML}
      <span class="stp-culture" title="Positive Classroom Culture is not a step: it runs through every lesson" style="margin-left:auto;padding-left:var(--sp-3);font-size:0.6875rem;color:var(--ink-muted);white-space:nowrap;flex-shrink:0;">Positive Classroom Culture, throughout</span>
    </div>`;
}

/**
 * Lifecycle mode renderer — a data-driven progress strip for one lesson.
 * Mirrors the Staffroom stepper dots (growth-green when done, navy/yellow when
 * current) so the two workflow models read as one. The final dot carries a
 * `.lifecycle-dot-final` hook so the loop-close celebration can target it.
 */
function renderLifecycleBreadcrumb({ stages, currentKey }) {
  const idx = Math.max(0, stages.findIndex(s => s.key === currentKey));
  const dots = stages.map((s, i) => {
    const isDone = i < idx;
    const isCurrent = i === idx;
    const isLast = i === stages.length - 1;
    const dotStyle = isDone
      ? 'background:var(--growth,#2c7a4b);color:#fff;'
      : isCurrent
        ? 'background:var(--brand-navy,#16323A);color:var(--brand-yellow,#F2B441);box-shadow:0 0 0 3px rgba(0,12,83,0.12);'
        : 'background:var(--bg-subtle);color:var(--ink-faint);';
    const connector = i < stages.length - 1
      ? `<span style="width:20px;height:2px;background:${i < idx ? 'var(--growth,#2c7a4b)' : 'var(--border-light)'};margin:0 8px;border-radius:2px;"></span>`
      : '';
    return `
      <div class="lifecycle-step" style="display:flex;align-items:center;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="lifecycle-dot${isLast ? ' lifecycle-dot-final' : ''}" style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.6875rem;font-weight:700;${dotStyle}">${isDone ? '&#10003;' : i + 1}</span>
          <span style="font-size:0.75rem;font-weight:${isCurrent ? 700 : 500};color:${i <= idx ? 'var(--ink)' : 'var(--ink-faint)'};">${esc(s.label)}</span>
        </div>
        ${connector}
      </div>`;
  }).join('');
  return `<div class="workflow-breadcrumb lifecycle-breadcrumb" role="img" aria-label="Lesson progress: ${esc((stages[idx] || {}).label || '')}" style="display:flex;align-items:center;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;">${dots}</div>`;
}

/**
 * Bind click events on workflow breadcrumb buttons.
 * Call after inserting the breadcrumb HTML into the DOM.
 * @param {HTMLElement} container — parent element containing the breadcrumb
 */
export function bindWorkflowClicks(container) {
  container.querySelectorAll('.workflow-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.workflowRoute;
      if (route) navigate(route);
    });
  });
}
