/*
 * Co-Cher 2 — seeding a school's own pedagogy frameworks
 * ======================================================
 * GROW by Reflecting and ACT on Feedback were hardcoded into state.js and
 * seeded into every install. They are Beatty's. A Park View teacher opening
 * Assessment as Learning met another school's routines, undeletable, while
 * their own — the ASK approach, Sense-Think-Act — were in the pack and never
 * surfaced.
 *
 * This module closes that gap in both directions: it seeds the signed-in
 * teacher's OWN routines from their pack, and it retires the two old hardcoded
 * ids from installs that already carry them — but only when the teacher has not
 * edited them, because an edited framework is the teacher's work, not ours.
 */

import { Store } from '../state.js';
import { getCurrentUser } from '../components/login.js';
import { frameworksFor } from './school.js';

/* The ids state.js used to seed for everyone. Kept only so they can be removed. */
const RETIRED_BEATTY_IDS = ['fw_builtin_grow', 'fw_builtin_act'];

/** Beatty's own pack ids, so a Beatty install is never stripped of them. */
const isBeatty = () => getCurrentUser()?.schoolId === 'bty';

/**
 * Seed the school's frameworks, once per school, and clear out the retired
 * builtins. Safe to call on every sign-in: seeding is keyed on framework id, so
 * a second run adds nothing and a teacher's edits survive.
 */
export async function seedSchoolFrameworks() {
  const schoolId = getCurrentUser()?.schoolId;
  if (!schoolId) return { added: 0, removed: 0 };

  const existing = Store.getFrameworks?.() || [];
  let list = existing;

  // 1. Retire Beatty's old hardcoded pair — unless this IS Beatty, or the
  //    teacher has edited them (`builtin` cleared means it became their copy).
  let removed = 0;
  if (!isBeatty()) {
    const keep = list.filter(f => !(RETIRED_BEATTY_IDS.includes(f.id) && f.builtin));
    removed = list.length - keep.length;
    list = keep;
  }

  // 2. Add the school's own, by id, leaving anything already present alone.
  let added = 0;
  try {
    const own = await frameworksFor(schoolId);
    const missing = own.filter(f => f?.id && !list.some(x => x.id === f.id))
      .map(f => ({ ...f, school: schoolId, createdAt: Date.now() }));
    added = missing.length;
    if (missing.length) list = [...list, ...missing];
  } catch { /* no pack, or offline — the national frame still stands */ }

  if (added || removed) Store.setFrameworks?.(list);
  return { added, removed };
}
