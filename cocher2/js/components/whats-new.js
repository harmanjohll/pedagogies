/*
 * Co-Cher "What's New" — version-aware changelog
 * ==============================================
 * Shows once per version bump so returning teachers see what changed —
 * SUMMARISED across the versions they actually missed, not an ever-growing
 * list. If a teacher last saw v7.3 and opens v7.8, they get the highlights of
 * v7.4–v7.8 (newest first), each release trimmed to a few concise lines.
 *
 * Keyed to APP_VERSION; dismissing records the seen version.
 */

import { APP_VERSION } from '../version.js';
import { openModal } from './modals.js';

const SEEN_KEY = 'cocher2_whatsnew_seen';

// Newest first. Each release: a few concise highlights (not paragraphs).
// Keep entries SHORT — this is a "since you were away" digest, not release notes.
const RELEASES = [
  { version: 'v1.5', items: [
    { icon: '\u{1F393}', title: 'Co-Cher knows what level you teach', text: 'Every level picker, sample class and AI prompt now uses YOUR school\u2019s levels. A primary teacher is offered Primary 1\u20136, not Sec 1\u2013JC 2, and the sample lessons that come with Co-Cher are primary lessons \u2014 bar models, the celery experiment, personal recount \u2014 not O-Level chemistry.' },
    { icon: '\u{1F465}', title: 'Find a Teacher works at any school', text: 'Looking up a colleague\u2019s free periods no longer needs one particular school\u2019s timetable file. It reads whatever your school has published, using real clock times \u2014 and if your school hasn\u2019t published anything yet, it says so plainly instead of loading forever.' },
  ] },
  { version: 'v1.4', items: [
    { icon: '\u{1F3AF}', title: 'Co-Cher speaks your school\u2019s language', text: 'Lesson design now draws on your school\u2019s OWN teaching approaches, quoted word-for-word from what your school has published \u2014 its vision, values, named subject approaches and frameworks. Where your school hasn\u2019t defined something, Co-Cher says so rather than inventing it.' },
  ] },
  { version: 'v1.3', items: [
    { icon: '\u{1F3EB}', title: 'Your school can set you up in one tap', text: 'When your school publishes its timetable, Co-Cher offers it to you on sign-in \u2014 find your name in the list, tap once, and your whole week is there. No file to hunt for, no retyping. If your school hasn\u2019t published one, nothing changes and you import your own.' },
  ] },
  { version: 'v1.2', items: [
    { icon: '\u{1F3A8}', title: 'A look of its own \u2014 and of your school', text: 'Co-Cher 2 has its own identity now, deliberately neutral rather than any one school\u2019s colours. Your school\u2019s own accent colour tints the app, and its name sits under the Co-Cher 2 wordmark, so you can see at a glance whose setup you\u2019re running.' },
  ] },
  { version: 'v1.1', items: [
    { icon: '\u{1F511}', title: 'Sign in from any school', text: 'Co-Cher no longer checks you against one school\u2019s staff list. Your email address tells it which school you\u2019re at, and if your school isn\u2019t set up yet you simply pick it from a list \u2014 or carry on without one. Colleague lists (Find a Teacher, the staff picker) now only ever show people from your own school.' },
  ] },
  { version: 'v1.0', items: [
    { icon: '\u{1F3EB}', title: 'Co-Cher 2 — built for any school', text: 'This is a new line of Co-Cher. Everything from Co-Cher 1 is here, and the work from now on makes it usable beyond one school: your own timetable, your own calendar and bell schedule, your own frameworks. Co-Cher 1 is still running and untouched — bring your lessons across with Settings → Data → Export there, then Import here.' },
  ] },
];

/* ── version compare: 'v7.10' > 'v7.8', 'v7' treated as 'v7.0' ── */
function parseVer(v) { return String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0); }
function cmpVer(a, b) {
  const A = parseVer(a), B = parseVer(b), n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; }
  return 0;
}

// Cap how many missed versions we spell out, so a long absence still reads as a
// tidy digest rather than a wall.
const MAX_RELEASES_SHOWN = 5;

export function maybeShowWhatsNew() {
  let seen = '';
  try { seen = localStorage.getItem(SEEN_KEY) || ''; } catch { /* ignore */ }
  if (seen === APP_VERSION) return;
  // First-ever run (no version recorded): onboarding covers new users — record
  // the current version silently so what's-new only surfaces for RETURNING
  // users after a real version bump.
  if (!seen) {
    try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch {}
    return;
  }

  // Only the releases newer than what the teacher last saw, newest first.
  const missed = RELEASES.filter(r => cmpVer(r.version, seen) > 0);
  const releases = missed.length ? missed : RELEASES.slice(0, 1); // fallback: at least the latest
  const shown = releases.slice(0, MAX_RELEASES_SHOWN);
  const trimmed = releases.length - shown.length;

  const intro = shown.length > 1
    ? `A quick digest of what changed since you were last here (you were on ${seenLabel(seen)}):`
    : `Here's what's new in Co-Cher ${APP_VERSION}:`;

  const body = `
    <p style="font-size:0.8125rem;color:var(--ink-muted);margin:0 0 var(--sp-4);line-height:1.5;">${intro}</p>
    <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
      ${shown.map(rel => `
        <div>
          <div style="display:inline-block;font-size:0.6875rem;font-weight:700;letter-spacing:0.04em;color:var(--accent);background:var(--accent-light,rgba(67,97,238,0.1));border-radius:999px;padding:2px 10px;margin-bottom:var(--sp-2);">${rel.version}</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
            ${rel.items.map(c => `
              <div style="display:flex;gap:var(--sp-3);align-items:flex-start;">
                <span style="font-size:1.15rem;line-height:1.2;flex-shrink:0;">${c.icon}</span>
                <div>
                  <div style="font-weight:600;font-size:0.875rem;color:var(--ink);">${c.title}</div>
                  <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">${c.text}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
      ${trimmed > 0 ? `<p style="font-size:0.75rem;color:var(--ink-faint);margin:0;">…and ${trimmed} earlier update${trimmed > 1 ? 's' : ''}.</p>` : ''}
    </div>`;

  const { backdrop, close } = openModal({
    title: `What's new in Co-Cher ${APP_VERSION}`,
    body,
    width: 520,
    footer: `<button class="btn btn-primary" data-action="got-it">Got it</button>`,
    // Record the seen version on ANY close (Got it, X, Esc, backdrop) so the
    // digest never re-appears on the next launch just because it wasn't
    // dismissed via the primary button.
    onClose: () => { try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch {} },
  });
  backdrop.querySelector('[data-action="got-it"]').addEventListener('click', close);
}

/* A tidy label for the last-seen version (falls back to the raw value). */
function seenLabel(seen) {
  return /^v/i.test(seen) ? seen : `v${seen}`;
}
