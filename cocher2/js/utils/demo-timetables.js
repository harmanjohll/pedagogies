/*
 * Co-Cher 2 — Demo timetable seeding (test accounts only)
 * =======================================================
 * The three dummy accounts used to exercise multi-school onboarding get their
 * timetable loaded automatically on first sign-in, so the app is immediately
 * testable without anyone having to run an import first.
 *
 * This is ONLY for the demo accounts listed below. A real teacher signing in
 * gets nothing here and imports their own timetable — which is the path that
 * actually matters, and the one this seeding must never paper over.
 */

import { getMyTimetable, saveMyTimetable } from './timetable.js';

const DEMO = {
  'jamie_lie@pvps.moe.edu.sg': 'pvps-jamie-lie.json',
  'joan_sng@sajc.moe.edu.sg': 'sajc-joan-sng.json',
  'tham_kine_thong@sajc.moe.edu.sg': 'sajc-tham-kine-thong.json',
};

/** True when this email is one of the demo accounts. */
export const isDemoAccount = (email) => !!DEMO[String(email || '').toLowerCase()];

/**
 * Load the demo timetable for this account if it has none yet. No-op for real
 * teachers, and for demo accounts that already imported (or edited) their own.
 * Never throws — a missing file just means no timetable, same as a new teacher.
 */
export async function seedDemoTimetable(email) {
  const file = DEMO[String(email || '').toLowerCase()];
  if (!file) return false;
  if (await getMyTimetable(email)) return false;      // already has one — leave it alone
  try {
    const res = await fetch(`./schools/demo-timetables/${file}`);
    const doc = await res.json();
    return !!(await saveMyTimetable(doc, email));
  } catch {
    return false;
  }
}
