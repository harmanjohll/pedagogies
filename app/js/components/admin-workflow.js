/*
 * Admin Workflow Breadcrumb
 * =========================
 * Horizontal step indicator for Admin One-Stop event planning.
 * Modelled after Co-Cher+ teaching workflow breadcrumb.
 * Steps: Event Setup → RAMS → Bus Booking → AOR → Notifications → Student List → Review
 */

const ADMIN_WORKFLOW_STEPS = [
  { id: 'setup', label: 'Event Setup', taskKey: null, icon: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  { id: 'rams', label: 'RAMS', taskKey: 'rams', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  { id: 'bus_booking', label: 'Bus Booking', taskKey: 'bus_booking', icon: '<rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/>' },
  { id: 'aor', label: 'AOR', taskKey: 'aor', icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
  { id: 'notifications', label: 'Notify', taskKey: 'parent_notification', icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
  { id: 'student_list', label: 'Students', taskKey: 'student_list', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { id: 'review', label: 'Review', taskKey: null, icon: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' },
];

/**
 * Determine the status of each workflow step based on event tasks.
 * @param {Object} event - the event object with tasks[]
 * @returns {Object[]} steps with { id, label, icon, status: 'completed'|'current'|'pending' }
 */
function resolveStepStatuses(event) {
  const tasks = event?.tasks || [];
  let foundCurrent = false;

  return ADMIN_WORKFLOW_STEPS.map(step => {
    if (step.id === 'setup') {
      // Setup is always done once event exists
      return { ...step, status: 'completed' };
    }

    if (step.id === 'review') {
      // Review is "current" if all tasks done, otherwise pending
      const enabled = tasks.filter(t => t.enabled);
      const allDone = enabled.length > 0 && enabled.every(t => t.status === 'completed');
      return { ...step, status: allDone ? 'current' : 'pending' };
    }

    // Map to task key
    const task = tasks.find(t => t.key === step.taskKey && t.enabled);
    if (!task) {
      // Task not enabled — skip (show as completed/skipped)
      return { ...step, status: 'skipped' };
    }

    if (task.status === 'completed') {
      return { ...step, status: 'completed' };
    }

    if (!foundCurrent) {
      foundCurrent = true;
      return { ...step, status: 'current' };
    }

    return { ...step, status: 'pending' };
  });
}

/**
 * Render the admin workflow breadcrumb.
 * @param {Object} event - the event object
 * @returns {string} HTML string
 */
export function renderAdminWorkflow(event) {
  const steps = resolveStepStatuses(event);

  const stepsHTML = steps.filter(s => s.status !== 'skipped').map((step, i, arr) => {
    const isCompleted = step.status === 'completed';
    const isCurrent = step.status === 'current';

    const color = isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--ink-faint)';
    const bg = isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent-light)' : 'transparent';
    const textColor = isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--ink-faint)';

    const arrow = i < arr.length - 1
      ? `<div style="width:24px;height:2px;background:${isCompleted ? 'var(--success)' : 'var(--border)'};flex-shrink:0;"></div>`
      : '';

    return `
      <div class="admin-wf-step" data-step="${step.id}" data-task-key="${step.taskKey || ''}" style="
        display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 10px;
        border-radius:var(--radius-full);transition:background 0.15s;
        background:${isCurrent ? 'var(--accent-light)' : 'transparent'};
      ">
        <div style="
          width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;
          background:${isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent-light)' : 'var(--bg-subtle)'};
          border:2px solid ${color};
        ">
          ${isCompleted
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">${step.icon}</svg>`
          }
        </div>
        <span style="font-size:0.6875rem;font-weight:${isCurrent ? '600' : '500'};color:${textColor};white-space:nowrap;">${step.label}</span>
      </div>
      ${arrow}`;
  }).join('');

  return `
    <div class="admin-workflow-breadcrumb" style="
      display:flex;align-items:center;gap:4px;padding:var(--sp-3) var(--sp-4);
      margin-bottom:var(--sp-4);overflow-x:auto;
      border:1px solid var(--border-light);border-radius:var(--radius-lg);
      background:var(--bg-subtle);
    ">
      <span style="font-size:0.5625rem;font-weight:600;color:var(--ink-faint);text-transform:uppercase;letter-spacing:0.05em;margin-right:var(--sp-2);flex-shrink:0;">Workflow</span>
      ${stepsHTML}
    </div>`;
}

/**
 * Bind click handlers to workflow step buttons.
 * Scrolls to the corresponding task panel in the event detail view.
 * @param {HTMLElement} container
 */
export function bindAdminWorkflowClicks(container) {
  container.querySelectorAll('.admin-wf-step').forEach(step => {
    step.addEventListener('click', () => {
      const taskKey = step.dataset.taskKey;
      if (!taskKey) return;

      // Find the matching task panel and scroll to it
      const panel = container.querySelector(`[data-task-key="${taskKey}"]`);
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Auto-expand if collapsed
        const body = panel.querySelector('.task-body');
        const chevron = panel.querySelector('.task-chevron');
        if (body && body.style.display === 'none') {
          body.style.display = 'block';
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
        // Briefly highlight
        panel.style.boxShadow = '0 0 0 2px var(--accent)';
        setTimeout(() => { panel.style.boxShadow = ''; }, 1500);
      }
    });
  });
}
