/*
 * Co-Cher 3: where everything lives
 * =================================
 * One list. The menu, the strip of sibling screens, the hub pages, Board and
 * the demo slots are all drawn from it, so a screen is added in one place.
 * Every Co-Cher 2 screen is here; nothing was removed, only regrouped around
 * a teacher's time (Now, Week, Term) and the things they work on.
 */

import { learningLogOpen } from '../js/views/learning-log.js';

const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const ICONS = {
  now: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  week: I('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>'),
  term: I('<path d="M4 19V9M9 19V5M14 19v-7M19 19V8"/>'),
  classes: I('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 5.6a3.2 3.2 0 0 1 0 5.8M18 14.4c1.7.7 2.7 2.3 3 4.6"/>'),
  lessons: I('<path d="M4 5.5c2.6-1 5.4-1 8 .5v13c-2.6-1.5-5.4-1.5-8-.5zM20 5.5c-2.6-1-5.4-1-8 .5v13c2.6-1.5 5.4-1.5 8-.5z"/>'),
  assess: I('<path d="M5 4h14v16H5zM8.5 9h7M8.5 13h7M8.5 17h4"/>'),
  resources: I('<path d="M4 7.5 12 4l8 3.5-8 3.5zM4 12l8 3.5 8-3.5M4 16.5 12 20l8-3.5"/>'),
  personal: I('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.8 3.6-5.5 7-5.5s6.2 1.7 7 5.5"/>'),
  school: I('<path d="M3 10 12 4l9 6M5 10v9h14v-9M10 19v-5h4v5"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  look: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 12h8.5"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>'),
  play: I('<circle cx="12" cy="12" r="8.5"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>'),
};

/* `match` lists route prefixes that belong to the place (first hit wins).
 * `demo` names a slot in v3/demos.js. `tag` marks beta tools, as v2 did. */
export const PLACES = [
  { id: 'now', group: 'Time', label: 'Now', route: '/now', match: ['/now', '/dashboard'], screens: [
    { route: '/now', label: 'Now', desc: 'What is on, what is next, what needs you' },
    { route: '/dashboard', label: 'Classic dashboard', desc: 'The Co-Cher 2 dashboard, with its widgets' },
  ] },
  { id: 'week', group: 'Time', label: 'Week', route: '/week', match: ['/week'], screens: [
    { route: '/week', label: 'This week', desc: 'Your week, with your entries and the lessons in progress' },
  ] },
  { id: 'term', group: 'Time', label: 'Term', route: '/term', match: ['/term'], screens: [
    { route: '/term', label: 'This term', desc: 'Where the term is, and what you have built' },
  ] },
  { id: 'classes', group: 'Work', label: 'Classes', route: '/classes', match: ['/classes', '/learning-log', '/paths', '/my-cca', '/report-comments'], screens: [
    { route: '/classes', label: 'My classes', desc: 'Students, E21CC profiles, evidence and pathways', demo: 'classes' },
    { route: '/learning-log', label: 'Learning Log', desc: 'Students’ own evidence for the competencies you track', when: learningLogOpen, demo: 'learning-log' },
    { route: '/paths', label: 'Paths', desc: 'Education and career pathways, for students', demo: 'paths' },
    { route: '/my-cca', label: 'My CCA', desc: 'Co-curricular activities and LEAPS 2.0' },
    { route: '/report-comments', label: 'Report comments', desc: 'Draft holistic comments from levels and evidence', tag: 'beta' },
  ] },
  { id: 'lessons', group: 'Work', label: 'Lessons', route: '/lessons', match: ['/lessons', '/lesson-planner', '/spatial', '/lesson-rehearsal', '/cce', '/autopilot', '/relief-kit', '/present', '/deck', '/live'], screens: [
    { route: '/lessons', label: 'All lessons', desc: 'Every lesson, and where it is in the cycle', demo: 'lesson-cycle' },
    { route: '/lesson-planner', label: 'Plan', desc: 'Design a lesson with Co-Cher', demo: 'plan' },
    { route: '/spatial', label: 'Room', desc: 'Lay out the room for the learning', demo: 'room' },
    { route: '/lesson-rehearsal', label: 'Rehearse', desc: 'Practise delivery with student personas' },
    { route: '/cce', label: 'CCE2021', desc: 'Six content areas, discussions, and Paths in ECG', demo: 'paths' },
    { route: '/autopilot', label: 'Auto-Lesson', desc: 'Scheme of work to reflection in one pass', tag: 'beta' },
    { route: '/relief-kit', label: 'Relief kit', desc: 'A one period lesson any relief teacher can run', tag: 'beta' },
  ] },
  { id: 'assess', group: 'Work', label: 'Assess', route: '/assessment/afl', match: ['/assessment', '/question-bank'], screens: [
    { route: '/assessment/afl', label: 'For learning', desc: 'Formative strategies, from intentions and success criteria' },
    { route: '/assessment/aal', label: 'As learning', desc: 'Metacognition and self regulated learning' },
    { route: '/assessment/aol', label: 'Of learning', desc: 'Summative design: Table of Specifications' },
    { route: '/question-bank', label: 'Question bank', desc: 'Question sets across Bloom’s levels', tag: 'beta' },
  ] },
  { id: 'resources', group: 'Work', label: 'Resources', route: '/resources', match: ['/resources', '/simulations', '/subject-tools', '/stimulus-material', '/source-analysis', '/library', '/knowledge', '/math-sandbox', '/rhythm-tool', '/stave-notation', '/art-critique', '/design-process', '/kitchen-layout'], screens: [
    { route: '/resources', label: 'All resources', desc: 'Everything you can bring into a lesson' },
    { route: '/simulations', label: 'Simulations', desc: 'Interactive practicals for the sciences and more' },
    { route: '/subject-tools', label: 'Subject tools', desc: 'Music, Art, D&T and NFS' },
    { route: '/stimulus-material', label: 'Stimulus', desc: 'Passages, scenarios and texts' },
    { route: '/source-analysis', label: 'Sources', desc: 'Source based question sets' },
    { route: '/library', label: 'Library', desc: 'Everything you have saved' },
    { route: '/knowledge', label: 'Knowledge bases', desc: 'Frameworks, references and your uploads' },
    { route: '/math-sandbox', label: 'Formula Lab', desc: 'Typeset STEM lessons', tag: 'beta' },
  ] },
  { id: 'school', group: 'Work', label: 'School', route: '/school', match: ['/school', '/admin', '/demos'], screens: [
    { route: '/school', label: 'My School', desc: 'Every place in Co-Cher, from one page' },
    { route: '/admin', label: 'Admin', desc: 'Find a teacher, Student Finder, forms and events', demo: 'student-finder' },
    { route: '/demos', label: 'How it works', desc: 'Short demos of what Co-Cher can do' },
  ] },
  { id: 'personal', group: 'You', label: 'Personal', route: '/personal', match: ['/personal', '/my-timetable', '/my-growth', '/settings'], screens: [
    { route: '/personal', label: 'Personal', desc: 'What is yours' },
    { route: '/my-timetable', label: 'My timetable', desc: 'Odd and even weeks, as the school published them' },
    { route: '/my-growth', label: 'My learning', desc: 'Your PD portfolio and practice story' },
    { route: '/settings', label: 'Settings', desc: 'Your key, your data, your preferences' },
  ] },
];

export const visible = (screens) => screens.filter(s => !s.when || s.when());

/** The place a route belongs to. */
export function placeFor(route) {
  const r = route || '/';
  if (r === '/') return PLACES.find(p => p.id === 'school');
  let best = null, len = -1;
  PLACES.forEach(p => p.match.forEach(m => {
    if ((r === m || r.startsWith(m + '/') || r.startsWith(m)) && m.length > len) { best = p; len = m.length; }
  }));
  return best;
}

/* ── Links a teacher adds: "also show this screen under that place" ──
 * A screen has one home, and a teacher may tag it into other places where it
 * is useful to them: the Learning Log under Assess, Paths under Lessons. Kept
 * on this device (cocher3_links). The defaults keep two personal screens
 * within reach of the time they belong to. */

const LINK_KEY = 'cocher3_links';
const DEFAULT_LINKS = { '/my-timetable': ['week'], '/my-growth': ['term'] };

export function getLinks() {
  try { const v = JSON.parse(localStorage.getItem(LINK_KEY) || 'null'); return v && typeof v === 'object' ? v : { ...DEFAULT_LINKS }; }
  catch { return { ...DEFAULT_LINKS }; }
}
export function setLinks(route, placeIds) {
  const all = getLinks();
  if (placeIds.length) all[route] = placeIds; else delete all[route];
  try { localStorage.setItem(LINK_KEY, JSON.stringify(all)); } catch { /* private mode */ }
}
export const ALL_SCREENS = () => PLACES.flatMap(p => visible(p.screens).map(s => ({ ...s, home: p })));
/** A place's own screens, then the ones the teacher linked into it. */
export function screensIn(place) {
  const own = visible(place.screens);
  const links = getLinks();
  const linked = ALL_SCREENS().filter(s => s.home.id !== place.id && (links[s.route] || []).includes(place.id) && !own.some(o => o.route === s.route))
    .map(s => ({ ...s, linked: true }));
  return [...own, ...linked];
}
