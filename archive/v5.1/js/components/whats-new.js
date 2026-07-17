/*
 * Co-Cher "What's New" — one-time changelog
 * =========================================
 * Shows once per version bump so returning teachers see what changed.
 * Keyed to APP_VERSION; dismissing records the seen version.
 */

import { APP_VERSION } from '../version.js';
import { openModal } from './modals.js';

const SEEN_KEY = 'cocher_v5_1_whatsnew_seen';

const CHANGES = [
  { icon: '&#127793;', title: 'Your lessons, as a living journey',
    text: 'Every lesson now has one clear next step at every stage — and finishing a reflection is quietly celebrated. See how many lessons you\'ve carried all the way through in the last fortnight. Press Ctrl+J to collapse everything to just the next thing to do.' },
  { icon: '&#129517;', title: 'Workflow Modes',
    text: 'One tap reshapes Co-Cher around what you\'re doing — Planning, Teaching Day, Assessment, or Reflection each surface the right tools and tuck the rest away. Clear the mode and your own setup comes straight back.' },
  { icon: '&#127912;', title: 'Make it yours',
    text: 'Pick a personal accent colour that flows through the whole app, a monogram, and your own mantra for the dashboard greeting — in Settings → Your Identity. And the guided tour now actually greets new teachers.' },
  { icon: '&#128101;', title: 'Track what matters to YOUR class',
    text: 'E21CC is powerful but heavy for everyday use — so now each class can track its own way: a simple Red/Amber/Green, a mastery band, effort, or a scheme you define yourself. Your existing E21CC data is untouched.' },
  { icon: '&#128228;', title: 'Bulk-add students & jot remarks',
    text: 'Upload a class list from CSV or Excel in one go (with duplicate-checking), and add a quick free-text remark on any student — which flows straight into your report-comment drafts.' },
  { icon: '&#128218;', title: 'My References — your own teaching library',
    text: 'Upload PDFs, Word, PowerPoint, Excel or notes into My Learning; Co-Cher summarises each one and lets you toggle it into the Lesson Planner as reference context — like giving the AI your own materials to work from.' },
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
