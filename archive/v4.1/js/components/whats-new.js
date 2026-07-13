/*
 * Co-Cher "What's New" — one-time changelog
 * =========================================
 * Shows once per version bump so returning teachers see what changed.
 * Keyed to APP_VERSION; dismissing records the seen version.
 */

import { APP_VERSION } from '../version.js';
import { openModal } from './modals.js';

const SEEN_KEY = 'cocher_v4_1_whatsnew_seen';

const CHANGES = [
  { icon: '&#128300;', title: 'A rebuilt Simulation Builder',
    text: 'Every generated sim is now test-run before you see it — broken ones get an automatic repair pass instead of shipping silently. New sims come with a reviewable spec (equations, targeted variable ranges), a predict-first gate, guiding questions, and real controls: pause, step, speed, and a live graph.' },
  { icon: '&#128295;', title: 'A deep accuracy sweep',
    text: 'Fixed TOS mark allocation, spatial/kitchen presets that no longer fit real classrooms, an Admin One-Stop click that silently failed, a crashing Parent Digest, and corrected MOE terminology (STP, Cyber Wellness, E21CC) across the app.' },
  { icon: '&#127891;', title: 'New CCE lessons for Sec 1 & 2',
    text: 'Total Defence’s six pillars for Sec 1, plus two new Sec 2 discussions — digital footprint and naming stress signals — join the CCE library.' },
  { icon: '&#127936;', title: 'CCA training exemplars',
    text: 'Basketball and Scouts now have a ready-to-run example session plan one click away, no API key needed to see what a good one looks like. Scouts also joins the CCA list.' },
  { icon: '&#128197;', title: 'Two new demo activities',
    text: 'An Inter-School Basketball Championship (fresh, nothing filled in yet) and a Sec 2 VIA Beach Cleanup (partway through) join Admin One-Stop to show the full range of the event workflow.' },
];

export function maybeShowWhatsNew() {
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch { /* ignore */ }
  if (seen === APP_VERSION) return;
  // First-ever run (no version recorded): onboarding covers new users —
  // record the current version silently so what's-new only ever surfaces
  // for RETURNING users after a real version bump.
  if (!seen) {
    try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch {}
    return;
  }

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
