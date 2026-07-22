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
  { icon: '&#128206;', title: 'Attach images & PDFs to your planning chat',
    text: 'In the Lesson Planner, tap "Add file" (or just drag a file onto the chat) to attach an image or PDF — a worksheet, a textbook page, a diagram, a marking rubric, even a photo of student work. Co-Cher reads it directly and designs around it. Images are shrunk automatically to stay fast, and large PDFs fall back to their text so a scheme of work still comes through. Attach up to six files per message.' },
  { icon: '&#127919;', title: 'Focus areas that actually upskill you',
    text: 'The teaching focus areas you pick at sign-up now have a home in Settings — toggle any on or off, or add your own. They feed into every lesson Co-Cher helps you plan: where it genuinely fits, Co-Cher designs for those areas and names the move it\'s making, so you build the habit over the year — not just tick a box.' },
  { icon: '&#129517;', title: 'A cleaner lesson journey',
    text: 'The lesson lifecycle strip — Design, Prepare, Rehearse, Teach, Reflect — now sits on a single tidy row with its next-step button below, and reads as one clear arc (Design stays front and centre, as it should).' },
  { icon: '&#127891;', title: 'Three ready-made showcase lessons',
    text: 'Open the Lessons page to find three fully-staged demos — Chemistry (Acids, Bases & Salts), Geography (Volcanoes & Earthquakes) and a CCE Cyber Wellness lesson. Each is built end-to-end: an STP-tagged run of show, a class seated in discussion pods you can rearrange, and a polished slide deck already attached. A quick tour of everything the planner can now do.' },
  { icon: '&#128202;', title: 'Sharper decks & movable students',
    text: 'Two big lifts. The slide deck is reborn — professional, varied layouts (big-idea statements, quotes, compare columns, an exit-ticket slide) with inline charts, concept diagrams and signpost icons, smooth transitions and a progress bar; it still works offline, and where a picture or diagram helps, Co-Cher draws one in. And in the Spatial Designer you can now drag every student pill to arrange seating exactly how you want, then tap Save — the same seating flows into Present.' },
  { icon: '&#129517;', title: 'Lesson plans, the STP way',
    text: 'Your Run of Show now speaks the Singapore Teaching Practice: tag each segment with a Teaching Area and pick a Teaching Action — See-Think-Wonder, Predict-Observe-Explain, Hot Seat and more, with an "Other" for your own. The plan reads as STP with a "Details" button, and each action\'s student-facing framing now shows on the Present screen, so teacher-facing flows straight to student-facing. Older lessons? Tap "Map to STP" and Co-Cher suggests an area for each segment for you to review before saving. Every AI tool stays exactly where it was.' },
  { icon: '&#129001;', title: 'Rearrange the room, live',
    text: 'The "Find your seat" chart in Present is now a big, interactive board that fills the screen — drag any student pill anywhere (it stays exactly where you drop it) and move the furniture too. Nothing changes your saved seating until you tap "Save arrangement" (or Reset). "Open" on a linked layout now carries your room and seated students straight into the designer. Also new: Find a Teacher takes a date, so you can check a colleague\'s availability on any school day.' },
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
