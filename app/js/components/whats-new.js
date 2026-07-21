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
  { icon: '&#129001;', title: 'Rearrange the room, live',
    text: 'The "Find your seat" chart in Present is now a big, interactive board — drag any student pill anywhere (it stays exactly where you drop it) and move the furniture too. Nothing changes your saved seating until you tap "Save arrangement" (or Reset). Also new: Find a Teacher takes a date, so you can check a colleague\'s availability on any school day.' },
  { icon: '&#127919;', title: 'Find your tools faster',
    text: 'The lesson-planner tool bar now shows labels by default (tap the chevron for compact icons), the Labs tools say what they do ("Auto-Lesson", "Math Sandbox"), and the workflow modes now show what they change — with a one-tap way to clear them.' },
  { icon: '&#128190;', title: 'Your work stays put',
    text: 'Report comments and assessment exit-tickets/LISC now save as you go, so they survive leaving the page. And when a school network blocks a library, Co-Cher says so plainly instead of quietly coming up empty.' },
  { icon: '&#128101;', title: 'Find a Teacher, in Admin',
    text: 'In Admin One-Stop, pick a department then a teacher to see — from the timetable — whether they\'re free to meet right now, which periods are still open today, and how heavy their day has been, so you can offer a short break before meeting.' },
  { icon: '&#128736;', title: 'Relief & admin, fixed',
    text: 'The Relief Kit now finds your real timetable periods (no more retyping), deleting an event asks first so a mis-tap can\'t wipe it, and the admin timetable/org-chart tools keep working offline.' },
  { icon: '&#9855;', title: 'Smoother & more reachable',
    text: 'The classroom canvas and reflection ratings now work with a keyboard and screen reader, the Present timer announces the time politely, and the calm dashboard\'s customise button is finally where the tip says it is.' },
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
