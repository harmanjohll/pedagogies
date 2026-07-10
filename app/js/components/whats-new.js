/*
 * Co-Cher "What's New" — one-time changelog
 * =========================================
 * Shows once per version bump so returning teachers see what changed.
 * Keyed to APP_VERSION; dismissing records the seen version.
 */

import { APP_VERSION } from '../version.js';
import { openModal } from './modals.js';

const SEEN_KEY = 'cocher_whatsnew_seen';

const CHANGES = [
  { icon: '&#129504;', title: 'A design partner, not a vending machine',
    text: 'Ask for a lesson without saying who it\'s for and Co-Cher now checks in first — pick a class or tell it about your students, so plans fit your learners.' },
  { icon: '&#128218;', title: 'Lesson lifecycle & "Up next"',
    text: 'Every lesson now moves through Design → Rehearse → Teach → Reflect, with one clear next step. The dashboard leads with your most actionable lesson.' },
  { icon: '&#128302;', title: 'Simulation workbench',
    text: 'Build Your Own Simulation now previews live and lets you refine it in plain English, keep versions, attach it to a lesson, and export it.' },
  { icon: '&#9881;&#65039;', title: 'Co-Cher+ that builds real things',
    text: 'The autopilot pauses for your review between steps, saves outputs as real lessons and Knowledge Base entries, and can generate a hook visual or concept diagram.' },
  { icon: '&#127890;', title: 'New Labs & exemplars',
    text: 'Report Comment Drafter, Question Bank Builder, and Relief Lesson Kit join the Labs — plus ready-made exemplar lessons across subjects to explore.' },
];

export function maybeShowWhatsNew() {
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch { /* ignore */ }
  if (seen === APP_VERSION) return;
  // First-ever run (no data): the onboarding tour covers this — don't stack modals
  const firstRun = !seen;
  try {
    const data = JSON.parse(localStorage.getItem('cocher_app_data') || '{}');
    if (firstRun && (!data.classes || data.classes.length === 0)) {
      localStorage.setItem(SEEN_KEY, APP_VERSION);
      return;
    }
  } catch { /* ignore */ }

  const body = `
    <p style="font-size:0.8125rem;color:var(--ink-muted);margin:0 0 var(--sp-4);line-height:1.5;">
      Here's what's new in Co-Cher ${APP_VERSION}:
    </p>
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
      ${CHANGES.map(c => `
        <div style="display:flex;gap:var(--sp-3);align-items:flex-start;">
          <span style="font-size:1.25rem;line-height:1.2;flex-shrink:0;">${c.icon}</span>
          <div>
            <div style="font-weight:600;font-size:0.875rem;color:var(--ink);">${c.title}</div>
            <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">${c.text}</div>
          </div>
        </div>`).join('')}
    </div>`;

  const { backdrop, close } = openModal({
    title: `What's new in Co-Cher ${APP_VERSION}`,
    body,
    width: 520,
    footer: `<button class="btn btn-primary" data-action="got-it">Got it</button>`
  });
  const dismiss = () => { try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch {} close(); };
  backdrop.querySelector('[data-action="got-it"]').addEventListener('click', dismiss);
}
