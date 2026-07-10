/*
 * Co-Cher Spotlight Tour
 * ======================
 * Guided orientation with dimmed background and positioned tooltip boxes
 * highlighting specific UI elements. Inspired by Shepherd.js / Intro.js.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';

/* ── Tour definitions ── */
const TOURS = {
  main: [
    {
      target: '.sidebar-brand',
      title: 'Welcome to Co-Cher',
      text: 'Your AI-powered co-teaching assistant. This sidebar is your main navigation hub — everything you need is organised by section.',
      position: 'right'
    },
    {
      target: '[data-route="/"]',
      title: 'Dashboard',
      text: 'Your home screen. See an overview of your classes, recent lessons, and quick actions to get started.',
      position: 'right'
    },
    {
      target: '[data-route="/classes"]',
      title: 'My Classes',
      text: 'Set up your classes with subject, level, and student names. Co-Cher uses this to personalise lesson suggestions.',
      position: 'right'
    },
    {
      target: '[data-route="/lesson-planner"]',
      title: 'Lesson Planner',
      text: 'The heart of Co-Cher. Design lessons with AI assistance, E21CC integration, and differentiated activities — all aligned to your Scheme of Work.',
      position: 'right'
    },
    {
      target: '[data-route="/spatial"]',
      title: 'Spatial Designer',
      text: 'Plan your classroom layout for different activities — PE circuits, group work, lab setups, and more. Drag equipment and student positions.',
      position: 'right'
    },
    {
      target: '[data-section="Assessment"]',
      title: 'Assessment Suite',
      text: 'Three modes aligned to Singapore\'s assessment framework: Assessment as Learning (AaL), for Learning (AfL), and of Learning (AoL) with Table of Specifications.',
      position: 'right'
    },
    {
      target: '[data-route="/knowledge"]',
      title: 'Knowledge Base',
      text: 'Upload your Scheme of Work, department resources, or reference materials. Co-Cher draws on these when generating lesson content.',
      position: 'right'
    },
    {
      target: '[data-route="/settings"]',
      title: 'Settings',
      text: 'Configure your API key, pedagogical preferences, and display options. Your preferences influence how Co-Cher generates suggestions.',
      position: 'right'
    }
  ]
};

/* ── CSS (injected once) ── */
const TOUR_STYLES = `
  .spotlight-overlay {
    position: fixed; inset: 0; z-index: 99998;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  .spotlight-backdrop {
    position: fixed; inset: 0; z-index: 99997;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: auto;
    transition: opacity 0.3s;
  }
  .spotlight-cutout {
    position: fixed; z-index: 99999;
    border-radius: 8px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
    pointer-events: none;
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .spotlight-tooltip {
    position: fixed; z-index: 100000;
    background: var(--bg-card, #fff);
    border-radius: 12px;
    padding: 20px;
    max-width: 320px;
    width: max-content;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1);
    pointer-events: auto;
    animation: spotlightFadeIn 0.25s ease;
    font-family: inherit;
  }
  .dark .spotlight-tooltip {
    background: var(--bg-card, #1e1e2e);
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  }
  @keyframes spotlightFadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .spotlight-tooltip-title {
    font-size: 0.9375rem; font-weight: 700;
    color: var(--ink, #1e1e2e);
    margin-bottom: 6px;
  }
  .spotlight-tooltip-text {
    font-size: 0.8125rem;
    color: var(--ink-muted, #64748b);
    line-height: 1.55;
    margin-bottom: 16px;
  }
  .spotlight-tooltip-footer {
    display: flex; align-items: center;
    justify-content: space-between; gap: 8px;
  }
  .spotlight-dots {
    display: flex; gap: 5px;
  }
  .spotlight-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--border, #e2e8f0);
    transition: background 0.2s;
  }
  .spotlight-dot.active {
    background: var(--accent, #4361ee);
  }
  .spotlight-btns {
    display: flex; gap: 6px;
  }
  .spotlight-btn {
    padding: 6px 14px; border-radius: 8px;
    font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; border: none;
    font-family: inherit;
    transition: all 0.15s;
  }
  .spotlight-btn-ghost {
    background: transparent;
    color: var(--ink-muted, #94a3b8);
  }
  .spotlight-btn-ghost:hover { color: var(--ink, #1e1e2e); }
  .spotlight-btn-primary {
    background: var(--accent, #4361ee);
    color: #fff;
  }
  .spotlight-btn-primary:hover { filter: brightness(1.1); }
  .spotlight-arrow {
    position: absolute;
    width: 12px; height: 12px;
    background: var(--bg-card, #fff);
    transform: rotate(45deg);
  }
  .dark .spotlight-arrow { background: var(--bg-card, #1e1e2e); }
`;

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = TOUR_STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}

/* ── Core tour engine ── */
export function startTour(tourName = 'main') {
  const steps = TOURS[tourName];
  if (!steps || !steps.length) return;

  injectStyles();

  let currentStep = 0;

  // Create DOM elements
  const backdrop = document.createElement('div');
  backdrop.className = 'spotlight-backdrop';

  const cutout = document.createElement('div');
  cutout.className = 'spotlight-cutout';

  const tooltip = document.createElement('div');
  tooltip.className = 'spotlight-tooltip';

  document.body.appendChild(backdrop);
  document.body.appendChild(cutout);
  document.body.appendChild(tooltip);

  // Close on backdrop click
  backdrop.addEventListener('click', dismiss);

  // Keyboard navigation
  function onKeyDown(e) {
    if (e.key === 'Escape') dismiss();
    if (e.key === 'ArrowRight' || e.key === 'Enter') next();
    if (e.key === 'ArrowLeft') prev();
  }
  document.addEventListener('keydown', onKeyDown);

  function dismiss() {
    backdrop.remove();
    cutout.remove();
    tooltip.remove();
    document.removeEventListener('keydown', onKeyDown);
    Store.set('tourComplete_' + tourName, true);
  }

  function next() {
    if (currentStep < steps.length - 1) {
      currentStep++;
      renderStep();
    } else {
      dismiss();
    }
  }

  function prev() {
    if (currentStep > 0) {
      currentStep--;
      renderStep();
    }
  }

  function renderStep() {
    const step = steps[currentStep];
    const isLast = currentStep === steps.length - 1;
    const isFirst = currentStep === 0;

    // Find the target element
    const target = document.querySelector(step.target);

    if (!target) {
      // If target not found, skip to next or finish
      if (!isLast) { currentStep++; renderStep(); }
      else dismiss();
      return;
    }

    // Scroll target into view if needed
    target.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });

    // Position the cutout around the target
    requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      const pad = 6;
      cutout.style.top = (rect.top - pad) + 'px';
      cutout.style.left = (rect.left - pad) + 'px';
      cutout.style.width = (rect.width + pad * 2) + 'px';
      cutout.style.height = (rect.height + pad * 2) + 'px';

      // Build tooltip content
      tooltip.innerHTML = `
        <div class="spotlight-tooltip-title">${step.title}</div>
        <div class="spotlight-tooltip-text">${step.text}</div>
        <div class="spotlight-tooltip-footer">
          <div class="spotlight-dots">
            ${steps.map((_, i) => `<div class="spotlight-dot ${i === currentStep ? 'active' : ''}"></div>`).join('')}
          </div>
          <div class="spotlight-btns">
            ${isFirst
              ? '<button class="spotlight-btn spotlight-btn-ghost" id="spot-skip">Skip</button>'
              : '<button class="spotlight-btn spotlight-btn-ghost" id="spot-prev">Back</button>'
            }
            <button class="spotlight-btn spotlight-btn-primary" id="spot-next">
              ${isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      `;

      // Position tooltip
      positionTooltip(tooltip, rect, step.position || 'right');

      // Wire buttons
      tooltip.querySelector('#spot-next')?.addEventListener('click', next);
      tooltip.querySelector('#spot-prev')?.addEventListener('click', prev);
      tooltip.querySelector('#spot-skip')?.addEventListener('click', dismiss);
    });
  }

  renderStep();
}

function positionTooltip(tooltip, targetRect, preferredPos) {
  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Reset first so we can measure
  tooltip.style.top = '0';
  tooltip.style.left = '0';
  const tRect = tooltip.getBoundingClientRect();
  const tw = tRect.width;
  const th = tRect.height;

  let top, left;
  let arrowStyle = '';

  // Try preferred position, fall back if off-screen
  const positions = [preferredPos, 'right', 'bottom', 'left', 'top'];
  for (const pos of positions) {
    if (pos === 'right' && targetRect.right + gap + tw < vw) {
      top = targetRect.top + (targetRect.height / 2) - (th / 2);
      left = targetRect.right + gap;
      arrowStyle = `left: -6px; top: 50%; transform: translateY(-50%) rotate(45deg);`;
      break;
    }
    if (pos === 'bottom' && targetRect.bottom + gap + th < vh) {
      top = targetRect.bottom + gap;
      left = targetRect.left + (targetRect.width / 2) - (tw / 2);
      arrowStyle = `top: -6px; left: 50%; transform: translateX(-50%) rotate(45deg);`;
      break;
    }
    if (pos === 'left' && targetRect.left - gap - tw > 0) {
      top = targetRect.top + (targetRect.height / 2) - (th / 2);
      left = targetRect.left - gap - tw;
      arrowStyle = `right: -6px; top: 50%; transform: translateY(-50%) rotate(45deg);`;
      break;
    }
    if (pos === 'top' && targetRect.top - gap - th > 0) {
      top = targetRect.top - gap - th;
      left = targetRect.left + (targetRect.width / 2) - (tw / 2);
      arrowStyle = `bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg);`;
      break;
    }
  }

  // Clamp to viewport
  top = Math.max(8, Math.min(top, vh - th - 8));
  left = Math.max(8, Math.min(left, vw - tw - 8));

  tooltip.style.top = top + 'px';
  tooltip.style.left = left + 'px';

  // Add arrow
  const existingArrow = tooltip.querySelector('.spotlight-arrow');
  if (existingArrow) existingArrow.remove();
  if (arrowStyle) {
    const arrow = document.createElement('div');
    arrow.className = 'spotlight-arrow';
    arrow.style.cssText = arrowStyle;
    tooltip.appendChild(arrow);
  }
}

/* ── Convenience: check if tour was completed ── */
export function isTourComplete(tourName = 'main') {
  return !!Store.get('tourComplete_' + tourName);
}

/* ── Reset tour (for replay from Settings) ── */
export function resetTour(tourName = 'main') {
  Store.set('tourComplete_' + tourName, false);
}
