/*
 * Co-Cher 2 — School resolution
 * =============================
 * The multi-school spine. Co-Cher 1 had no notion of a school at all: sign-in
 * WAS a lookup against Beatty's staff timetable CSV, so a teacher from anywhere
 * else could not get past the login screen. Here, identity and school are
 * separate things, and the school is resolved from the teacher's email DOMAIN
 * against a small published registry.
 *
 *   registry.json  →  which schools exist, which domains route to each
 *   <id>.json      →  that school's pack: calendar, levels, subjects, CCAs,
 *                     its own frameworks. Configuration only — never people.
 *
 * Domain routing means one registry line onboards a whole school: there is no
 * roster to maintain and nothing to change when staff join or leave.
 *
 * IMPORTANT — this is ROUTING, not access control. Co-Cher is a static site
 * with no server, so anyone can read these files and type any email. The
 * registry answers "which school is this person from", never "who is allowed
 * in". Real access control would need a backend.
 *
 * Everything degrades gracefully: an unknown domain still gets in (the teacher
 * picks their school, or runs school-less), and a failed registry fetch never
 * blocks sign-in — which is precisely the failure that could brick Co-Cher 1.
 */

const REGISTRY_URL = './schools/registry.json';
const PACK_URL = (file) => `./schools/${file}`;

let _registry = null;      // { schools: [...] } once loaded
let _packs = new Map();    // id → pack

/** The school registry, or an empty list if it can't be read. Never throws. */
export async function loadRegistry() {
  if (_registry) return _registry;
  try {
    const res = await fetch(REGISTRY_URL);
    const data = await res.json();
    _registry = Array.isArray(data?.schools) ? data : { schools: [] };
  } catch {
    _registry = { schools: [] };
  }
  return _registry;
}

/** Every school in the registry: [{ id, name, domains, pack }]. */
export async function listSchools() {
  return (await loadRegistry()).schools;
}

/**
 * Which school does this email belong to? Matches the domain, then any parent
 * domain (so `name@sajc.moe.edu.sg` still resolves if a school registered
 * `moe.edu.sg`). Returns null when nothing matches — the caller then asks.
 */
export async function schoolForEmail(email) {
  const at = String(email || '').toLowerCase().split('@')[1];
  if (!at) return null;
  const schools = await listSchools();
  return schools.find(s => (s.domains || []).some(d => {
    const dom = String(d).toLowerCase();
    return at === dom || at.endsWith('.' + dom);
  })) || null;
}

/** A school's pack by id, or null. Cached; never throws. */
export async function loadPack(id) {
  if (!id) return null;
  if (_packs.has(id)) return _packs.get(id);
  const entry = (await listSchools()).find(s => s.id === id);
  if (!entry) { _packs.set(id, null); return null; }
  let pack = null;
  try {
    const res = await fetch(PACK_URL(entry.pack || `${id}.json`));
    pack = await res.json();
  } catch { pack = null; }
  _packs.set(id, pack);
  return pack;
}

/* ── Convenience readers, all safe on a missing pack ── */

export async function schoolName(id) {
  const p = await loadPack(id);
  if (p?.name) return p.name;
  const e = (await listSchools()).find(s => s.id === id);
  return e?.name || '';
}

/** Minutes per timetable slot (30 for most, 35 at Beatty). Default 30. */
export async function slotMinutes(id) {
  const p = await loadPack(id);
  return Number(p?.slotMinutes) || 30;
}

/** 'oddEven' | 'none'. Schools without an alternating cycle return 'none'. */
export async function weekCycle(id) {
  const p = await loadPack(id);
  return p?.calendar?.cycle === 'oddEven' ? 'oddEven' : 'none';
}

/**
 * Which cycle ('Odd' | 'Even' | null) a given date falls in, from the pack's
 * week list. null when the school has no cycle, or the date isn't listed
 * (holiday weeks are listed with a null cycle).
 */
export async function cycleForDate(id, date = new Date()) {
  const p = await loadPack(id);
  if (p?.calendar?.cycle !== 'oddEven') return null;
  const weeks = p.calendar.weeks || [];
  // Monday of the given date's week, as YYYY-MM-DD.
  const d = new Date(date);
  const dow = (d.getDay() + 6) % 7;              // Mon = 0
  d.setDate(d.getDate() - dow);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return weeks.find(w => w.start === key)?.cycle || null;
}

/** Level vocabulary for pickers ('Secondary 3', 'JC1', 'Primary 5', …). */
export async function levelsFor(id) {
  const p = await loadPack(id);
  return Array.isArray(p?.levels) && p.levels.length ? p.levels : [];
}

export async function subjectsFor(id) {
  const p = await loadPack(id);
  return Array.isArray(p?.subjects) ? p.subjects : [];
}

/** The school's OWN pedagogy frameworks (Beatty's GROW/ACT live here now). */
export async function frameworksFor(id) {
  const p = await loadPack(id);
  return Array.isArray(p?.frameworks) ? p.frameworks : [];
}

/** Reset caches — used when switching accounts so nothing leaks across. */
export function resetSchoolCache() {
  _registry = null;
  _packs = new Map();
}
