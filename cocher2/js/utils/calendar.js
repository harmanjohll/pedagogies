/*
 * Calendar Reference — Authoritative Odd/Even Week Lookup
 * ========================================================
 * Loads CalendarReference.csv and provides the canonical week type
 * for any given date, replacing the fragile math-based calculation.
 */

import { getCurrentUser } from '../components/login.js';

let _calCache = null;
let _calCacheSchool = null;

/**
 * Load and parse CalendarReference.csv.
 * Returns array of { monday: Date, type: 'Odd'|'Even'|'N.A.' }
 *
 * This file IS Beatty's calendar — its Odd/Even weeks, its term breaks. Every
 * other school's week cycle comes from its own pack (school.js cycleForDate),
 * so this is scoped rather than fetched for everyone: a 404 that silently
 * yields "no week type" is indistinguishable from a real answer, and cached
 * across a school switch it would be someone else's calendar.
 */
export async function loadCalendarReference() {
  const schoolId = getCurrentUser()?.schoolId ?? 'bty';   // legacy users have no schoolId
  if (_calCache && _calCacheSchool === schoolId) return _calCache;
  _calCacheSchool = schoolId;
  if (schoolId !== 'bty') { _calCache = []; return _calCache; }
  try {
    const res = await fetch('./btyrelief/CalendarReference.csv');
    const text = await res.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { _calCache = []; return _calCache; }

    _calCache = lines.slice(1).map(line => {
      const [dateStr, type] = line.split(',').map(s => s.trim());
      // Parse "5-Jan-26" → Date
      const parts = dateStr.match(/^(\d{1,2})-(\w{3})-(\d{2})$/);
      if (!parts) return null;
      const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
      const day = parseInt(parts[1], 10);
      const mon = months[parts[2]];
      const year = 2000 + parseInt(parts[3], 10);
      if (mon === undefined) return null;
      return { monday: new Date(year, mon, day), type: type || 'N.A.' };
    }).filter(Boolean);
  } catch {
    _calCache = [];
  }
  return _calCache;
}

/**
 * Get Monday of the week containing `date`.
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Look up week type for a given date.
 * Returns 'Odd', 'Even', or 'N.A.' (non-teaching week).
 * Falls back to null if calendar data unavailable.
 */
export function getWeekType(calData, date) {
  if (!calData || calData.length === 0) return null;

  const monday = getMondayOfWeek(date);
  const mondayTime = monday.getTime();

  // Exact match (comparing date only, not time)
  for (const entry of calData) {
    const entryTime = new Date(entry.monday).setHours(0, 0, 0, 0);
    if (Math.abs(entryTime - mondayTime) < 86400000) {
      return entry.type;
    }
  }

  return null; // date not in calendar range
}
