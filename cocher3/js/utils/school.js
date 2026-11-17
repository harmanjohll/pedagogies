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

import { fetchSchoolIndex, fetchSchoolConfig, isBackendConfigured } from './backend.js';

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

/**
 * Every school Co-Cher knows about: the packs bundled with this build, PLUS
 * whatever the backend lists. Backend entries win on id, so a school can update
 * its own details without a code change — which is the whole point of putting
 * schools in Drive rather than in the repo.
 *
 * Bundled packs remain the floor: with no backend configured, or with it
 * unreachable, the committed schools still resolve.
 */
export async function listSchools() {
  const bundled = (await loadRegistry()).schools;
  if (!isBackendConfigured()) return bundled;
  const remote = await fetchSchoolIndex();
  if (!remote.length) return bundled;
  const byId = new Map(bundled.map(s => [s.id, s]));
  remote.forEach(r => byId.set(r.id, { ...(byId.get(r.id) || {}), ...r, remote: true }));
  return [...byId.values()];
}

/**
 * Which school does this email belong to? Matches the domain, then any parent
 * domain (so `name@sajc.moe.edu.sg` still resolves if a school registered
 * `moe.edu.sg`). Returns null when nothing matches — the caller then asks.
 */
/**
 * Who is allowed in.
 *
 * `open`       — anyone signs in. An unknown domain picks a school, or carries
 *                on without one. This is Co-Cher 2's default, and it is a
 *                deliberate reaction to Co-Cher 1, where a failed fetch of one
 *                CSV locked every teacher out of the app.
 * `restricted` — only addresses at a registered school. A school may narrow
 *                further with `allowEmails`, and an empty list means the whole
 *                domain is welcome.
 *
 * Worth being plain about what this is: the check runs in the browser, on a
 * public page, so it is a front door, not a lock. It keeps a stray visitor from
 * wandering into a school's Co-Cher; it does not protect anything served at a
 * public URL. Data that needs protecting has to move behind the backend.
 */
export async function accessMode() {
  const reg = await loadRegistry();
  return reg?.access === 'restricted' ? 'restricted' : 'open';
}

/**
 * → { ok } | { ok: false, reason }. Never throws: a registry that fails to load
 * must not become a lockout, so an unreadable registry falls back to open.
 */
export async function mayAccess(email) {
  const addr = String(email || '').toLowerCase().trim();
  const at = addr.split('@')[1];
  if (!at) return { ok: false, reason: 'That does not look like an email address.' };

  const school = await schoolForEmail(addr);

  // A CLOSED school is one running a beta: only its own people get in as it.
  // The list is the school's to keep — an admin decides who is on it.
  if (school?.closed) {
    const named = Array.isArray(school.allowEmails) ? school.allowEmails.map(e => String(e).toLowerCase()) : [];
    if (named.length && !named.includes(addr)) {
      return { ok: false, reason: `${school.name} is in beta and ${addr} is not on its list yet. Ask whoever set up Co-Cher at your school to add you.` };
    }
    return { ok: true, school };
  }

  if (await accessMode() === 'open') return { ok: true, school };

  if (!school) {
    return { ok: false, reason: `Co-Cher is not open to ${at} yet. Sign in with your school email, or ask for your school to be added.` };
  }
  const named = Array.isArray(school.allowEmails) ? school.allowEmails.map(e => String(e).toLowerCase()) : [];
  if (named.length && !named.includes(addr)) {
    return { ok: false, reason: `${school.name} keeps a named list of Co-Cher users, and ${addr} is not on it yet. Ask whoever set it up to add you.` };
  }
  return { ok: true, school };
}

/** Schools an unrecognised address may pick from — a closed school is not one,
 *  or anybody could select their way into a school they do not work at. */
export async function pickableSchools() {
  return (await listSchools()).filter(s => !s.closed);
}

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
  if (!entry && !isBackendConfigured()) { _packs.set(id, null); return null; }
  let pack = null;
  try {
    const res = await fetch(PACK_URL(entry?.pack || `${id}.json`));
    pack = await res.json();
  } catch { pack = null; }
  // The backend's copy is authoritative when reachable — an admin who edits
  // their school.json in Drive should see it take effect without a deploy.
  const remote = await fetchSchoolConfig(id);
  if (remote && !remote.error) pack = { ...(pack || {}), ...remote };
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

/**
 * The school's learning-practice model: an outer ring of named practices and an
 * inner ring of learner behaviours. Beatty's is GROW / ACT / MAP / ASK; the
 * shape is common, the four names are not. A school that publishes none gets
 * the national frame — Assessment FOR and AS Learning — which is genuinely
 * everyone's, rather than someone else's acronyms.
 */
export const NATIONAL_LEARNING_PRACTICE = {
  title: 'The Learning Practice',
  blurb: 'Assessment FOR Learning and Assessment AS Learning run together, in and out of lessons. '
       + 'They are not stages: the teacher is gathering evidence while the pupil is judging their own work.',
  centre: ['Proactive', 'Learner'],
  practices: [
    { key: 'AfL', label: 'Assess FOR learning', blurb: 'Evidence gathered while learning, acted on now', colour: '#3b82f6' },
    { key: 'AaL', label: 'Assess AS learning', blurb: 'The pupil judges their own work and decides next', colour: '#10b981' },
  ],
  behaviours: [
    { label: 'Prepare', blurb: 'Get ready for learning before the lesson', colour: '#6366f1' },
    { label: 'Participate', blurb: 'Engage actively during the lesson', colour: '#ec4899' },
    { label: 'Process', blurb: 'Make sense of it afterwards', colour: '#14b8a6' },
  ],
};

export async function learningPracticeFor(id) {
  const p = await loadPack(id);
  const lp = p?.learningPractice;
  if (!lp || !Array.isArray(lp.practices) || !lp.practices.length) return NATIONAL_LEARNING_PRACTICE;
  return {
    title: lp.title || NATIONAL_LEARNING_PRACTICE.title,
    blurb: lp.blurb || '',
    centre: Array.isArray(lp.centre) && lp.centre.length ? lp.centre : NATIONAL_LEARNING_PRACTICE.centre,
    practices: lp.practices,
    behaviours: Array.isArray(lp.behaviours) && lp.behaviours.length ? lp.behaviours : NATIONAL_LEARNING_PRACTICE.behaviours,
  };
}

/** Reset caches — used when switching accounts so nothing leaks across. */
export function resetSchoolCache() {
  _registry = null;
  _packs = new Map();
}

/**
 * The school's OWN teaching-and-learning language, formatted for injection into
 * AI prompts. Quoted VERBATIM from the school's published material rather than
 * paraphrased — a lesson designed against a summary of a school's pedagogy is
 * not designed against that school's pedagogy.
 *
 * Anything the school has not published stays absent. Where an acronym's
 * expansion is unknown (PVPS's STAR and ASK, for instance), the model is told
 * so explicitly, so it uses the name without inventing the letters.
 */
export async function schoolTeachingContext(id, { subject } = {}) {
  const p = await loadPack(id);
  if (!p) return '';
  const lines = [];
  const idn = p.identity || {};
  if (p.name) lines.push(`School: ${p.name}${idn.motto ? ` — motto "${idn.motto}"${idn.mottoGloss ? ` (${idn.mottoGloss})` : ''}` : ''}`);
  if (idn.vision) lines.push(`Vision: ${idn.vision}`);
  if (idn.mission) lines.push(`Mission: ${idn.mission}`);
  if (Array.isArray(p.values) && p.values.length) lines.push(`Values${idn.valuesAcronym ? ` (${idn.valuesAcronym})` : ''}: ${p.values.join(' · ')}`);
  if (idn.philosophy) lines.push(`Philosophy: ${idn.philosophy}`);

  // Subject-matched approach first; otherwise every approach, so a cross-subject
  // lesson still sees the school's whole T&L stance.
  const all = Array.isArray(p.teachingApproaches) ? p.teachingApproaches : [];
  const picked = subject ? all.filter(a => String(a.subject || '').toLowerCase() === String(subject).toLowerCase()) : [];
  (picked.length ? picked : all).forEach(a => {
    lines.push(`\n[${a.subject} — ${a.name}] ${a.verbatim || ''}`);
    if (a.grounding) lines.push(`  Grounded in: ${a.grounding}`);
    if (a.inquiry) lines.push(`  Inquiry stance: ${a.inquiry}`);
    if (Array.isArray(a.processSkills)) lines.push(`  Process skills: ${a.processSkills.join(', ')}`);
    if (a.strategies) lines.push(`  Strategies: ${a.strategies}`);
    if (a.ftgp) lines.push(`  Form Teacher Guidance Period: ${a.ftgp}`);
    if (a.levelBadges) lines.push(`  Level progression: ${Object.entries(a.levelBadges).map(([k, v]) => `${k} = ${v}`).join('; ')}`);
    if (a.unresolved) lines.push(`  IMPORTANT: ${a.unresolved}`);
  });

  const haf = p.programmes?.haf;
  if (haf?.domains) lines.push(`\nRecognition (${haf.name}) spans: ${haf.domains.join(', ')}.`);

  /* The school's named programmes — its ALP, its LLP, whatever else it runs.
   * These are the things a school is KNOWN for, and they were reaching the
   * screen but not the model, so a lesson plan for a school built around
   * environmental advocacy came back with no trace of it. Driven off the data,
   * not a fixed list of keys, so a pack that names a new programme gets it
   * without a code change. */
  const HANDLED = new Set(['haf', 'assessment', 'discipline', 'aiPolicy', 'via']);
  Object.entries(p.programmes || {}).forEach(([key, prog]) => {
    if (HANDLED.has(key) || !prog || Array.isArray(prog) || typeof prog !== 'object') return;
    if (!prog.name && !prog.verbatim) return;
    lines.push(`\n[${key.toUpperCase()}${prog.name ? ` — ${prog.name}` : ''}] ${prog.verbatim || ''}`);
    if (Array.isArray(prog.prongs)) {
      lines.push(`  ${prog.prongs.map(x => `${x.key}: ${x.blurb}`).join(' · ')}`);
    }
    if (Array.isArray(prog.domains)) lines.push(`  Spans: ${prog.domains.join(', ')}.`);
    if (Array.isArray(prog.levels)) lines.push(`  Runs at: ${prog.levels.join(', ')}.`);
  });

  /* Assessment, split so a prompt can reach for the right half. AfL is what the
   * teacher does while pupils learn; AaL is what the pupils do. A lesson plan
   * that names neither is not this school's lesson plan. */
  const asmt = p.programmes?.assessment;
  if (asmt?.verbatim) lines.push(`\nAssessment stance: ${asmt.verbatim}`);
  if (Array.isArray(asmt?.afl) && asmt.afl.length) {
    lines.push(`  Assessment FOR Learning here means: ${asmt.afl.join('; ')}.`);
  }
  if (Array.isArray(asmt?.aal) && asmt.aal.length) {
    lines.push(`  Assessment AS Learning here means: ${asmt.aal.join('; ')}.`);
  }
  if (asmt?.purpose) lines.push(`  Purpose: ${asmt.purpose}.`);
  if (p.programmes?.discipline?.verbatim) lines.push(`Discipline stance: ${p.programmes.discipline.verbatim}`);

  /* The school's own learner routines, named and staged. Without these the
   * model invents a plausible reflection routine, which is worse than none —
   * the teacher then has to unpick a framework their school does not use. */
  const fws = Array.isArray(p.frameworks) ? p.frameworks : [];
  if (fws.length) {
    lines.push(`\nThe school's OWN learner routines — use these names and stages, do not substitute others:`);
    fws.forEach(f => {
      const stages = (f.stages || []).map(st => `${st.key} = ${st.label}`).join(' → ');
      lines.push(`  ${f.name}${f.purpose ? ` (${f.purpose})` : ''}${stages ? `: ${stages}` : ''}`);
      if (f.guidance) lines.push(`    ${f.guidance}`);
    });
  }

  /* The learning-practice model, when the school publishes one. */
  const lp = p.learningPractice;
  if (lp && Array.isArray(lp.practices) && lp.practices.length) {
    lines.push(`\n${lp.title || 'Learning practice'}: ${lp.practices.map(x => `${x.key} (${x.label})`).join(' · ')}`
      + `${Array.isArray(lp.behaviours) && lp.behaviours.length ? `, around learner behaviours ${lp.behaviours.map(b => b.label).join(' / ')}` : ''}.`);
  }

  if (!lines.length) return '';
  return `[The teacher's school — use ITS OWN language and approaches. The wording below is quoted from the school's published material; reproduce its terminology exactly rather than substituting generic equivalents. Do not invent expansions for acronyms the school has not defined.]\n${lines.join('\n')}`;
}
