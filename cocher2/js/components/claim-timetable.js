/*
 * Co-Cher 2 — "Which of these is you?"
 * ====================================
 * The step that turns ONE staff file into onboarding for a whole school.
 *
 * A school publishes staff.json once (admin drops it in their Drive folder).
 * Every teacher on that domain signs in, and the only thing they have to do is
 * tap their own name — because an email address will not match a timetable's
 * name column ("LIM HUI SHAN", "SEGARAN PRIYA"), and guessing that mapping is
 * exactly the kind of silent wrongness that would put a teacher in someone
 * else's week.
 *
 * Matching is on the TEACHER'S NAME, which is stable. Never on class codes,
 * which are not: 6R3, 25S22-CEM and 3SP2B2 mean nothing across schools.
 *
 * Once claimed, the choice is remembered and this never appears again.
 */

import { getCurrentUser, setCurrentUser } from './login.js';
import { openModal } from './modals.js';
import { escapeHtml } from '../utils/markdown.js';
import { fetchSchoolStaff, findTeacherInStaff, staffNames } from '../utils/backend.js';
import { fetchBundledRoster } from '../utils/directory.js';
import { getMyTimetable, saveMyTimetable } from '../utils/timetable.js';
import { loadPack } from '../utils/school.js';

/**
 * If this teacher has no timetable but their school published one, offer it.
 * Silent no-op when they already have a timetable, have no school, or the
 * school has published nothing — onboarding should never nag.
 * Resolves true when a timetable was claimed.
 */
export async function maybeClaimTimetable() {
  const user = getCurrentUser();
  if (!user?.schoolId || user.timetableClaimed) return false;
  if (await getMyTimetable()) return false;

  const pack = await loadPack(user.schoolId);
  const staff = await fetchSchoolStaff(user.schoolId, pack?.joinCode);

  // Exact email match needs no question — that is unambiguous.
  const direct = findTeacherInStaff(staff, { email: user.email });
  if (direct) return adopt(direct, staff, user);

  // No live feed yet, but the school may have published its roster WITH the
  // app. An exact email match there is just as unambiguous, and it is the
  // difference between "every teacher signs in and their week is there" and
  // "every teacher must first be told to import a file". Only an exact match
  // is taken: a near-miss would put someone in a colleague's week, so anyone
  // unmatched falls through to the picker below, or to importing their own.
  const bundled = await fetchBundledRoster(user.schoolId);
  const mine = findTeacherInStaff(bundled, { email: user.email });
  if (mine) return adopt(mine, bundled, user);

  const people = staffNames(staff);
  if (!people.length) return false;

  return new Promise(resolve => {
    const { backdrop, close } = openModal({
      title: 'Which of these is you?',
      width: 460,
      body: `
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.55;">
          ${escapeHtml(pack?.name || user.schoolName || 'Your school')} has published its timetable.
          Pick your name and Co-Cher will set up your week &mdash; you only do this once.
        </p>
        <input id="claim-search" class="input" type="search" placeholder="Search your name&hellip;"
               style="width:100%;box-sizing:border-box;min-height:44px;margin-bottom:8px;" />
        <div id="claim-list" style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>`,
      footer: `<button class="btn btn-ghost" data-action="skip">Not listed &mdash; I'll import my own</button>`,
    });

    const listEl = backdrop.querySelector('#claim-list');
    const paint = (q = '') => {
      const rows = people.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
      listEl.innerHTML = rows.length ? rows.map(p => `
        <button class="btn btn-secondary claim-opt" data-i="${p.i}"
          style="justify-content:flex-start;text-align:left;min-height:46px;">
          <span style="font-weight:600;">${escapeHtml(p.name)}</span>
          <span style="margin-left:auto;font-size:0.6875rem;color:var(--ink-muted);">${p.entries} entries</span>
        </button>`).join('')
        : `<p style="font-size:0.8125rem;color:var(--ink-muted);padding:12px 2px;">No match. You can import your own timetable instead.</p>`;
      listEl.querySelectorAll('.claim-opt').forEach(b => b.addEventListener('click', async () => {
        const person = (staff.teachers || [])[Number(b.dataset.i)];
        close();
        resolve(await adopt(person, staff, user));
      }));
    };
    paint();
    backdrop.querySelector('#claim-search').addEventListener('input', e => paint(e.target.value));
    backdrop.querySelector('[data-action="skip"]').addEventListener('click', () => {
      // Remember the decline so a teacher who imports their own is never asked again.
      setCurrentUser({ ...user, timetableClaimed: 'declined' });
      close();
      resolve(false);
    });
  });
}

async function adopt(person, staff, user) {
  if (!person?.entries?.length) return false;
  const saved = await saveMyTimetable({
    teacher: { name: person.name, email: person.email || user.email },
    source: { file: person.source || 'school timetable', note: `Published by ${staff.schoolId || 'school'}` },
    entries: person.entries,
  }, user.email);
  if (!saved) return false;
  setCurrentUser({ ...user, timetableClaimed: person.name, name: user.name || person.name });
  return true;
}
