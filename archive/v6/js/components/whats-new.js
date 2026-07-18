/*
 * Co-Cher "What's New" — one-time changelog
 * =========================================
 * Shows once per version bump so returning teachers see what changed.
 * Keyed to APP_VERSION; dismissing records the seen version.
 */

import { APP_VERSION } from '../version.js';
import { openModal } from './modals.js';

const SEEN_KEY = 'cocher_v6_whatsnew_seen';

const CHANGES = [
  { icon: '&#127916;', title: 'Stage your lesson, then just press play',
    text: 'One click breaks your finished plan into a runnable sequence — hook, activities, plenary — each with a duration, student-facing instructions, and its own room setup. Edit every segment before you commit.' },
  { icon: '&#128250;', title: 'Class Screen — your plan, on the wall',
    text: 'Open Present on any staged lesson: a clean, student-facing screen with the current activity, a live countdown, instructions, and who\'s in which group. Walk in, one click, and the lesson runs itself. Nothing teacher-only ever shows.' },
  { icon: '&#129681;', title: 'Rooms with scenes — and real students in them',
    text: 'A saved layout can now hold several "scenes" (a discussion setup, a stations setup…) that travel with the layout. And groups can be placed onto the actual furniture — named seats on your real classroom map, not a generic grid.' },
  { icon: '&#129513;', title: 'Simulations, properly one-stop',
    text: 'AI-built sims now share the same polished widgets as the built-in labs (notebook, export, collapsible guides), can be attached to lessons in both directions, and your sim library gets search, subject filters, and duplicate-as-template.' },
  { icon: '&#128190;', title: 'Backups now really back everything up',
    text: 'Custom simulations are included in your full export/import at last — plus shared lessons now carry their layouts, groupings and components across to colleagues intact.' },
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
