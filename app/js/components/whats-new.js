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

const SEEN_KEY = 'cocher_whatsnew_seen';

// Newest first. Each release: a few concise highlights (not paragraphs).
// Keep entries SHORT — this is a "since you were away" digest, not release notes.
const RELEASES = [
  { version: 'v8.1', items: [
    { icon: '&#128241;', title: 'Scan-to-join QR codes', text: 'Live sessions now show a big QR code on the projector — students point their phone camera at it and they’re in, no typing. The room code and link are still there as a backup.' },
    { icon: '&#9654;&#65039;', title: 'Go Live on the demo lessons', text: 'The ready-made showcase lessons (Acids/Bases/Salts, Volcanoes & Earthquakes, Cyber Wellness) now have a one-tap “Go Live” on their decks — run a full workshop with predict-&-reveal quizzes, live polls, a word-wall and a personal command card, without building anything first.' },
    { icon: '&#128736;&#65039;', title: 'Fixes that matter in class', text: 'Slide decks now open inside Co-Cher and their YouTube videos actually play (the old pop-out tab blocked them). “Open in Designer” reliably brings the room AND your students’ seated names. Simulations (like Titration) now fit the window on any screen. Rehearsal voice input no longer gets stuck.' },
  ] },
  { version: 'v8.0', items: [
    { icon: '&#128241;', title: 'Live Sessions — students join on their phones', text: 'When you generate a deck, hit "Live" to run it as a live session: students open a link, enter a room code, and follow along — voting on predict-&-reveal quizzes, answering polls, and adding to a word-wall in real time. Everyone leaves with a personal command card built from their own answers. Nothing is stored; it just needs internet.' },
  ] },
  { version: 'v7.9', items: [
    { icon: '&#128101;', title: 'Audience mode + takehome cards', text: 'Present has an Audience mode for assemblies / open house (hides class-only seating & groups) and ends on a "take your card" screen. Generate a one-page takehome card from any lesson — print a stack, download it, or share a link.' },
    { icon: '&#128736;&#65039;', title: 'A big reliability pass', text: 'Fixed image/PDF attachments that could fail to send, autosave edge cases (no lost replies, no duplicate lessons), tidier lesson titles, and cleaner decks — plus a mobile sweep so the planner toolbar, deck controls and Present bars behave on a phone.' },
  ] },
  { version: 'v7.8', items: [
    { icon: '&#128206;', title: 'Attach images & PDFs', text: 'Drop a worksheet, textbook page, diagram or photo into the planning chat — Co-Cher reads it directly.' },
    { icon: '&#127919;', title: 'Focus areas that upskill you', text: 'Manage your teaching focus areas in Settings; they now actively shape each lesson Co-Cher designs.' },
    { icon: '&#127909;', title: 'Richer decks', text: 'Slides can embed YouTube videos and animated diagrams, and you can exit a presentation cleanly. Your work autosaves as you go.' },
  ] },
  { version: 'v7.7', items: [
    { icon: '&#127891;', title: 'Three showcase lessons', text: 'Ready-made, fully-staged demos (Chemistry, Geography, CCE) — each with a seated class and a polished deck.' },
  ] },
  { version: 'v7.6', items: [
    { icon: '&#128202;', title: 'Professional decks + movable students', text: 'Multi-layout slides with charts, diagrams and icons; drag any student to arrange seating in the Spatial Designer.' },
  ] },
  { version: 'v7.5', items: [
    { icon: '&#129517;', title: 'Lesson plans, the STP way', text: 'Tag each segment with a Teaching Area and Action (Singapore Teaching Practice); the student framing flows into Present. Every AI tool stayed.' },
  ] },
  { version: 'v7.4', items: [
    { icon: '&#129001;', title: 'Live seating + Find a Teacher', text: 'A big interactive seating chart in Present (drag students, move furniture, Save/Reset), and Find a Teacher now checks availability by date.' },
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
