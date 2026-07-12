/*
 * Co-Cher "What's New" — one-time changelog
 * =========================================
 * Shows once per version bump so returning teachers see what changed.
 * Keyed to APP_VERSION; dismissing records the seen version.
 */

import { APP_VERSION } from '../version.js';
import { openModal } from './modals.js';

const SEEN_KEY = 'cocher_v4_whatsnew_seen';

const CHANGES = [
  { icon: '&#127968;', title: 'A new look: the Staffroom Desk',
    text: 'Warm paper, serif titles, and your highlighter — yellow now marks what\'s happening NOW. Prefer the old look? Settings → Appearance → Classic restores it exactly, one click.' },
  { icon: '&#128100;', title: 'Co-Cher now knows your class',
    text: 'Attach a class and the AI designs for the learners you actually have — their E21CC spread, your observations, engagement trends. Each class page has a living Class Portrait.' },
  { icon: '&#9986;&#65039;', title: 'Your call, Cher',
    text: 'Real design decisions now come back to you as one-tap choices inside the plan, and a 🖊 Critical Friend reads your plan with a red pen through the curriculum lens you choose.' },
  { icon: '&#127793;', title: 'My Practice: reflection becomes practice',
    text: 'Your reflections and rehearsals now build a practice profile with ONE micro-goal at a time — and Co-Cher quietly shapes lessons to give you practice at it.' },
  { icon: '&#129309;', title: 'Department Packs',
    text: 'Export a pack of lessons and resources, drop it in the staffroom chat, and colleagues import with attribution — remix chains included.' },
  { icon: '&#9974;', title: 'Focus mode & a calmer morning',
    text: 'Ctrl+. hides everything but your plan. The dashboard now opens with one decision, your day as a ribbon, and everything else tucked under More.' },
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
