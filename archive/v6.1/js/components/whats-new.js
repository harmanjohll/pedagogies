/*
 * Co-Cher "What's New" — one-time changelog
 * =========================================
 * Shows once per version bump so returning teachers see what changed.
 * Keyed to APP_VERSION; dismissing records the seen version.
 */

import { APP_VERSION } from '../version.js';
import { openModal } from './modals.js';

const SEEN_KEY = 'cocher_v6_1_whatsnew_seen';

const CHANGES = [
  { icon: '&#129517;', title: 'Your planner is now a cockpit',
    text: 'A journey bar walks you Plan → Components → Stage → Place → Present, and your staged Run of Show now lives right in the planner — with each segment carrying the E21CC competency it grows, shown to students on the Class Screen.' },
  { icon: '&#128100;', title: 'Names on the seats',
    text: 'Placing groups now puts actual student names on the actual furniture — in the planner\'s room map and on the Class Screen. "Find your seat" means YOUR seat.' },
  { icon: '&#10024;', title: 'Sharp plans that expand on demand',
    text: 'Plans and components now generate lean — the key moves, nothing padded. Tap ✨ Details, Exemplar or Model answer on any section and Co-Cher expands just that part, then remembers it with the lesson.' },
  { icon: '&#129504;', title: 'Your school\'s pedagogy, everywhere',
    text: 'ACT (feedback) and GROW (metacognition) are now first-class frameworks — woven into planning context, lesson segments, the Class Screen, and report comments. Upload your own school\'s framework and it joins them.' },
  { icon: '&#129514;', title: 'Simulations that teach harder',
    text: 'AI-built sims gain a Challenge mode with self-checking tasks, a printable predict-observe-explain inquiry sheet, an under-the-hood Model panel — and the quality gate now checks the controls actually drive the model.' },
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
