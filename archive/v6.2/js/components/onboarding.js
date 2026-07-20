/*
 * Co-Cher Onboarding Flow
 * =======================
 * A short first-run INTRO that hands off to the guided spotlight tour.
 *
 * Consolidation note (v5.1): the app used to fire four independent first-run
 * overlays (welcome, onboarding, spotlight-tour, whats-new) that overlapped and
 * each re-explained the navigation. This intro is now deliberately thin — it
 * welcomes the teacher and OFFERS the interactive tour, which owns the actual
 * sidebar walkthrough. app.js sequences the pieces: welcome → onboarding → tour
 * for new users; whats-new only for returning users.
 *
 * `initOnboarding(onDone)` reports back so app.js can decide whether to launch
 * the tour:  onDone({ shown, skipped }).
 *   shown=false  → not a first-run (returning user); do nothing.
 *   shown=true, skipped=false → teacher wants the tour → app starts it.
 *   shown=true, skipped=true  → teacher opted to explore alone → no tour.
 *
 * First-run is gated on the persisted `onboardingComplete` flag ONLY. We do NOT
 * gate on "has classes" because the app seeds sample classes on first launch,
 * which would make every genuine new user look like a returning one.
 */

import { Store } from '../state.js';

const STEPS = [
  {
    icon: '\u{1F44B}',
    title: 'Welcome to Co-Cher!',
    body: 'Your AI co-teacher for planning, teaching, assessment, and growth — built for Singapore educators. A few sample classes are already set up so you can explore right away.'
  },
  {
    icon: '\u{1F9ED}',
    title: 'Want a quick tour?',
    body: 'We’ll point out the key areas in the sidebar so you know where everything lives. It takes about a minute — or you can dive straight in.'
  }
];

export function initOnboarding(onDone) {
  const done = (payload) => { try { onDone && onDone(payload); } catch { /* ignore */ } };

  // First-run only. Returning users (flag already set) skip straight through.
  if (Store.get('onboardingComplete')) {
    done({ shown: false, skipped: false });
    return;
  }

  // Delay slightly so the dashboard renders behind the overlay first.
  setTimeout(() => showOnboarding(done), 600);
}

function showOnboarding(done) {
  let step = 0;
  let settled = false;

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';

  function finish(skipped) {
    if (settled) return;
    settled = true;
    Store.set('onboardingComplete', true);
    overlay.remove();
    done({ shown: true, skipped: !!skipped });
  }

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
          ${isLast
            ? '<button class="btn btn-primary btn-sm" id="ob-tour">Show me around</button>'
            : '<button class="btn btn-primary btn-sm" id="ob-next">Next</button>'}
          ${isLast
            ? '<button class="btn btn-ghost btn-sm" id="ob-explore" style="color:var(--ink-faint);">I’ll explore on my own</button>'
            : '<button class="btn btn-ghost btn-sm" id="ob-skip" style="color:var(--ink-faint);">Skip</button>'}
        </div>
      </div>
    `;

    overlay.querySelector('#ob-next')?.addEventListener('click', () => { step++; renderStep(); });
    overlay.querySelector('#ob-back')?.addEventListener('click', () => { step--; renderStep(); });
    overlay.querySelector('#ob-skip')?.addEventListener('click', () => finish(true));
    overlay.querySelector('#ob-explore')?.addEventListener('click', () => finish(true));
    overlay.querySelector('#ob-tour')?.addEventListener('click', () => finish(false));
  }

  renderStep();
  document.body.appendChild(overlay);
}
