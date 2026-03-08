/*
 * Co-Cher Onboarding Flow
 * =======================
 * Guided walkthrough for first-time users.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';

const STEPS = [
  {
    title: 'Welcome to Co-Cher!',
    body: 'Your AI-powered lesson design assistant, built for Singapore educators. Let\u2019s get you set up in 3 quick steps.',
    icon: '\u{1F44B}',
    action: null
  },
  {
    title: 'Step 1: Set Up Your Classes',
    body: 'Create your classes with subject, level, and student names. This helps Co-Cher personalise lesson suggestions and track student progress.',
    icon: '\u{1F393}',
    action: { label: 'Go to Classes', route: '/classes' }
  },
  {
    title: 'Step 2: Upload Your Scheme of Work',
    body: 'Upload your SoW to the Knowledge Base. Co-Cher will use it to suggest lesson ideas, pacing, and content aligned to your teaching plan.',
    icon: '\u{1F4DA}',
    action: { label: 'Go to Knowledge Base', route: '/knowledge' }
  },
  {
    title: 'Step 3: Design Your First Lesson',
    body: 'Head to the Lesson Planner, pick a class, and start designing. Co-Cher will guide you through objectives, activities, and E21CC integration.',
    icon: '\u{270F}\u{FE0F}',
    action: { label: 'Go to Lesson Planner', route: '/lesson-planner' }
  }
];

export function initOnboarding() {
  // Only show for first-time users
  if (Store.get('onboardingComplete')) return;

  // Don't show if user already has data (returning user who upgraded)
  const hasData = (Store.get('classes') || []).length > 0 ||
                  (Store.get('lessons') || []).length > 0;
  if (hasData) {
    Store.set('onboardingComplete', true);
    return;
  }

  // Delay slightly to let the dashboard render first
  setTimeout(() => showOnboarding(), 600);
}

function showOnboarding() {
  let step = 0;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';

  function renderStep() {
    const s = STEPS[step];
    const isLast = step === STEPS.length - 1;
    const isFirst = step === 0;

    overlay.innerHTML = `
      <style>
        #onboarding-overlay {
          position:fixed;inset:0;z-index:10000;
          background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);
          display:flex;align-items:center;justify-content:center;
          animation:obFadeIn 0.2s ease;
        }
        @keyframes obFadeIn { from{opacity:0}to{opacity:1} }
        .ob-card {
          background:var(--bg-card,#fff);border-radius:16px;
          padding:32px;max-width:440px;width:92vw;
          box-shadow:0 25px 60px rgba(0,0,0,0.3);
          animation:obSlide 0.25s ease;text-align:center;
        }
        @keyframes obSlide { from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1} }
        .dark .ob-card { background:var(--bg-card,#1e1e2e); }
        .ob-dots { display:flex;justify-content:center;gap:6px;margin-bottom:20px; }
        .ob-dot { width:8px;height:8px;border-radius:50%;background:var(--border,#e2e8f0); }
        .ob-dot.active { background:var(--accent,#3b82f6); }
      </style>
      <div class="ob-card">
        <div class="ob-dots">
          ${STEPS.map((_, i) => `<div class="ob-dot ${i === step ? 'active' : ''}"></div>`).join('')}
        </div>
        <div style="font-size:2rem;margin-bottom:12px;">${s.icon}</div>
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink);margin-bottom:8px;">${s.title}</h2>
        <p style="font-size:0.875rem;color:var(--ink-muted);line-height:1.6;margin-bottom:20px;">${s.body}</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
          ${!isFirst ? '<button class="btn btn-ghost btn-sm" id="ob-back">Back</button>' : ''}
          ${s.action ? `<button class="btn btn-secondary btn-sm" id="ob-action">${s.action.label}</button>` : ''}
          ${isLast
            ? '<button class="btn btn-primary btn-sm" id="ob-finish">Get Started!</button>'
            : '<button class="btn btn-primary btn-sm" id="ob-next">Next</button>'}
          ${isFirst ? '<button class="btn btn-ghost btn-sm" id="ob-skip" style="color:var(--ink-faint);">Skip tour</button>' : ''}
        </div>
      </div>
    `;

    overlay.querySelector('#ob-next')?.addEventListener('click', () => { step++; renderStep(); });
    overlay.querySelector('#ob-back')?.addEventListener('click', () => { step--; renderStep(); });
    overlay.querySelector('#ob-skip')?.addEventListener('click', dismiss);
    overlay.querySelector('#ob-finish')?.addEventListener('click', dismiss);
    overlay.querySelector('#ob-action')?.addEventListener('click', () => {
      dismiss();
      navigate(s.action.route);
    });
  }

  function dismiss() {
    Store.set('onboardingComplete', true);
    overlay.remove();
  }

  renderStep();
  document.body.appendChild(overlay);
}
