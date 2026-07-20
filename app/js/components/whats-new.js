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
  { icon: '&#128241;', title: 'Co-Cher on your phone',
    text: 'The daily loop — dashboard, lessons, planner chat, Present, quick capture — now works on a phone: bigger touch targets, ▲/▼ reorder where drag used to be, and the heavy design surfaces adapt honestly (best edited on a larger screen).' },
  { icon: '&#128246;', title: 'Works offline',
    text: 'Install Co-Cher and it keeps working without wifi — your dashboard, lessons and everything you\'ve made load straight from the device. Only AI generation needs a connection, and it now says so kindly instead of spinning.' },
  { icon: '&#128198;', title: 'Your day, waiting for you',
    text: 'The home screen reads your timetable and points to your next class and its lesson — Open plan, Present, or Plan it, one tap away. It only ever suggests; you\'re always the one who acts.' },
  { icon: '&#127793;', title: 'Your practice, growing',
    text: 'Reflect in seconds with one-tap starters or your voice, and watch a term-long Practice Story quietly take shape in My Growth. Little milestones get a warm nod — never a nag.' },
  { icon: '&#127908;', title: 'Just say it',
    text: 'A mic now sits in the lesson-planner composer and your capture fields — press, talk, and it fills the box for you to edit and send. (Needs a supported browser and a connection.)' },
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
