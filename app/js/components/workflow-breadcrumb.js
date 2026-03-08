/*
 * Co-Cher Workflow Breadcrumb
 * ===========================
 * Shows the teaching workflow path:
 * SoW → Lesson Plan → Resources → Assessment → Reflection
 * Highlights the current step and makes other steps clickable.
 */

import { navigate } from '../router.js';

const WORKFLOW_STEPS = [
  { id: 'sow', label: 'Scheme of Work', route: '/knowledge', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
  { id: 'plan', label: 'Lesson Plan', route: '/lesson-planner', icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
  { id: 'resources', label: 'Resources', route: '/stimulus-material', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  { id: 'assess', label: 'Assessment', route: '/assessment/afl', icon: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
  { id: 'reflect', label: 'Reflect', route: '/lessons', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' }
];

/**
 * Render a workflow breadcrumb bar.
 * @param {string} currentStepId — one of: 'sow', 'plan', 'resources', 'assess', 'reflect'
 * @returns {string} HTML string
 */
export function renderWorkflowBreadcrumb(currentStepId) {
  const stepsHTML = WORKFLOW_STEPS.map((step, i) => {
    const isCurrent = step.id === currentStepId;
    const arrow = i < WORKFLOW_STEPS.length - 1
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;margin:0 2px;"><polyline points="9 18 15 12 9 6"/></svg>`
      : '';

    return `
      <button class="workflow-step${isCurrent ? ' workflow-step-active' : ''}" data-workflow-route="${step.route}" style="
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
      <span style="font-size:0.625rem;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.05em;margin-right:var(--sp-2);flex-shrink:0;">Workflow</span>
      ${stepsHTML}
    </div>`;
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
