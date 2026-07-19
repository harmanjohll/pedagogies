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
  { icon: '&#9889;', title: 'Auto-stage: one click, whole lesson ready',
    text: 'Confirm your class, room and duration — Co-Cher stages the plan into segments, forms the groups, links the room, and seats everyone on the actual furniture. Nothing is random unless you tick "let Co-Cher choose." The step-by-step way still works too.' },
  { icon: '&#127908;', title: 'Decks and audio, made in the planner',
    text: 'Ask for a slide deck and get a clean, self-contained one you can present or print to PDF. Ask for a podcast clip or sound bite and Co-Cher writes the script, then voices it with AI voices (your API key; voice only — no music or effects). Both attach to the lesson and launch from the Class Screen.' },
  { icon: '&#10084;&#65039;', title: 'CCE lessons, full power',
    text: 'Plan a CCE lesson from the CCE hub and it flows through the full planner — staging, grouping, named seats, Present, GROW built in — with CCE2021 framing for your chosen content area.' },
  { icon: '&#128269;', title: 'Two deep flow audits, fixed',
    text: 'Named seats now survive reloads on the bundled layouts (the big one), saving a lesson keeps you on it, weekend dashboards explain themselves instead of going blank, frameworks are editable, layout deletion asks first — plus a dozen smaller smoothings.' },
  { icon: '&#128250;', title: 'Everything fits on the projector',
    text: 'The Class Screen now scrolls safely, compacts busy segments, caps the seat map, and shows a "more" cue when something\'s below the fold — even at 1366×768.' },
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
