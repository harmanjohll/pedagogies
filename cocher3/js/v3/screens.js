/*
 * Co-Cher 3: the screens that are new
 * ===================================
 * Now, Week and Term (a teacher's time), and the hub pages. Everything shown
 * is read from what Co-Cher already holds: the timetable, lessons, classes
 * and evidence. Nothing is invented; an empty part says what would fill it.
 */

import { Store } from '../state.js';
import { getPrefs } from './prefs.js';
import { PLACES, ICONS, visible, screensIn } from './places.js';
import { currentSchoolId, getCurrentUser, getPreferredName, guessFirstName } from '../components/login.js';
import { getMyTimetable, entriesForDate, rangeLabel } from '../utils/timetable.js';
import { loadPack, cycleForDate } from '../utils/school.js';
import { lessonStage } from '../views/lessons.js';
import { competencyLabel } from '../utils/evidence.js';
import { openSearch } from '../components/unified-search.js';
import { mountEmbed, GENAPP } from '../components/app-embed.js';
import { ymd, entriesForNow, entriesBetween, entryHTML, wireEntries } from './agenda.js';
import { goalsHTML, wireGoals, allGoals } from './goals.js';
import { getDailyQuote, pickMilestone, markMilestoneSeen } from '../views/dashboard.js';
import { getIdentity } from '../utils/identity.js';

/* The shell's build label, read late to avoid an import cycle. */
const BUILD_LABEL = () => window.__cocherShell?.build || '';

/* After an entry changes, draw the current screen again (the router does it). */
const redraw = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toMin = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const clock = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : /(s|sh|ch|x)$/.test(w) ? 'es' : 's'}`;
const DAY = 86400000;
const dateLine = (d) => d.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' });

/* ── What Co-Cher knows, gathered once per screen ── */

const STAGE = {
  taught: { rank: 0, verb: 'Reflect on', go: 'Reflect' },
  ready: { rank: 1, verb: 'Ready to teach', go: 'Present' },
  rehearsed: { rank: 1, verb: 'Rehearsed and ready', go: 'Present' },
  draft: { rank: 2, verb: 'Finish designing', go: 'Open' },
};

function pipeline() {
  const classes = Store.getClasses();
  return Store.getLessons()
    .map(l => ({ l, stage: lessonStage(l), cls: classes.find(c => c.id === l.classId) || null }))
    .filter(x => STAGE[x.stage])
    .sort((a, b) => STAGE[a.stage].rank - STAGE[b.stage].rank || (b.l.updatedAt || 0) - (a.l.updatedAt || 0));
}

const lessonHref = (x) => (STAGE[x.stage].go === 'Present' && (x.l.runOfShow?.segments || []).length
  ? `#/present/${x.l.id}` : `#/lessons/${x.l.id}`);

/** The class in My Classes a timetable code points to, when its name carries the code. */
function classForCode(code) {
  const c = String(code || '').toLowerCase().replace(/\s+/g, '');
  if (!c) return null;
  return Store.getClasses().find(k => String(k.name || '').toLowerCase().replace(/\s+/g, '').includes(c)) || null;
}

/** Things worth a teacher's attention, each drawn from real records. */
function insights() {
  const out = [];
  const since = Date.now() - 14 * DAY;
  Store.getClasses().forEach(cls => {
    const byComp = {};
    (cls.students || []).forEach(s => (s.observations || []).forEach(o => {
      if (!o.competency || (o.ts || 0) < since) return;
      const k = byComp[o.competency] = byComp[o.competency] || { towards: new Set(), showed: new Set() };
      (o.verdict === 'towards' ? k.towards : k.showed).add(s.id);
    }));
    Object.entries(byComp).forEach(([comp, k]) => {
      if (k.towards.size >= 2) out.push({ w: 3 + k.towards.size, href: `#/classes/${cls.id}`,
        t: `${plural(k.towards.size, 'student')} in ${cls.name} are working towards ${competencyLabel(comp)}`,
        s: 'Group them, or build it into the next lesson' });
      else if (k.showed.size >= 3) out.push({ w: 1 + k.showed.size, href: `#/classes/${cls.id}`,
        t: `${plural(k.showed.size, 'student')} in ${cls.name} showed ${competencyLabel(comp)}`,
        s: 'Enough evidence to move a level? Check their profiles' });
    });
  });
  const taught = pipeline().filter(x => x.stage === 'taught');
  if (taught.length >= 2) out.push({ w: 4, href: '#/lessons', t: `${plural(taught.length, 'lesson')} taught, not yet reflected on`, s: 'Two minutes each, while they are fresh' });
  const noEvidence = Store.getClasses().filter(c => (c.students || []).length && !(c.students || []).some(s => (s.observations || []).length));
  if (noEvidence.length && Store.getClasses().length) out.push({ w: 1, href: '#/lessons',
    t: `No evidence yet for ${noEvidence.length === 1 ? noEvidence[0].name : plural(noEvidence.length, 'class')}`,
    s: 'In Present, press O and tap who showed what' });
  return out.sort((a, b) => b.w - a.w).slice(0, 4);
}

async function today(date = new Date()) {
  const tt = await getMyTimetable().catch(() => null);
  const list = tt ? await entriesForDate(date).catch(() => []) : [];
  const cycle = await cycleForDate(currentSchoolId(), date).catch(() => null);
  const mins = date.getHours() * 60 + date.getMinutes();
  const current = list.find(e => toMin(e.start) <= mins && mins < toMin(e.end)) || null;
  const next = list.find(e => toMin(e.start) > mins) || null;
  return { has: !!tt, list, cycle, mins, current, next };
}

/* ── Shared pieces ── */

function dayLine(t) {
  if (!t.list.length) return '';
  const from = Math.min(450, ...t.list.map(e => toMin(e.start)));
  const to = Math.max(900, ...t.list.map(e => toMin(e.end)));
  const pct = (m) => ((m - from) / (to - from) * 100).toFixed(2);
  const ticks = [];
  for (let m = Math.ceil(from / 60) * 60; m <= to; m += 60) ticks.push(m);
  return `<div class="v3-day" role="img" aria-label="Today: ${t.list.length} on your timetable">
    <div class="rule"></div>
    ${t.list.map(e => { const s = toMin(e.start), en = toMin(e.end);
      const cls = e.kind === 'lesson' ? '' : ' other';
      const st = t.mins >= en ? ' past' : (t.mins >= s ? ' now' : '');
      return `<div class="blk${cls}${st}" style="left:${pct(s)}%;width:calc(${(pct(en) - pct(s)).toFixed(2)}% - 3px);" title="${esc(rangeLabel(e))} ${esc(e.title)}${e.room ? ', ' + esc(e.room) : ''}">${esc(e.class || e.title)}</div>`; }).join('')}
    ${ticks.filter(m => m < to).map(m => `<span class="tick" style="left:${pct(m)}%;">${Math.floor(m / 60)}</span>`).join('')}
    ${t.mins > from && t.mins < to ? `<div class="hand" style="left:${pct(t.mins)}%;" title="Now"></div>` : ''}
  </div>`;
}

function nowCard(t) {
  const e = t.current || t.next;
  if (!e) return '';
  const cls = e.kind === 'lesson' ? classForCode(e.class) : null;
  const ready = cls ? pipeline().find(x => x.cls?.id === cls.id && (x.stage === 'ready' || x.stage === 'rehearsed')) : null;
  const k = t.current ? `Now, until ${clock(toMin(e.end))}` : `Next, at ${clock(toMin(e.start))}`;
  const acts = e.kind !== 'lesson' ? '' : [
    ready ? `<a class="btn btn-primary" href="${lessonHref(ready)}">Present “${esc(ready.l.title.length > 34 ? ready.l.title.slice(0, 32) + '…' : ready.l.title)}”</a>` : '',
    cls ? `<a class="btn btn-secondary" href="#/classes/${cls.id}">Open ${esc(cls.name)}</a>` : '',
    !ready ? `<a class="btn ${cls ? 'btn-ghost' : 'btn-primary'}" href="#/lesson-planner">Plan this lesson</a>` : '',
  ].join('');
  return `<div class="v3-now">
    <div><div class="k">${k}</div>
      <div class="t">${esc(e.class || e.title)}</div>
      <div class="m">${esc(rangeLabel(e))}${e.room ? ' · ' + esc(e.room) : ''}${e.kind !== 'lesson' ? ' · ' + esc(e.title) : ''}${e.kind === 'lesson' && !cls ? ' · not linked to one of your classes yet' : ''}</div></div>
    <div class="acts">${acts}</div>
  </div>`;
}

const rowsHTML = (rows, empty) => rows.length ? rows.join('') : `<p class="v3-empty">${empty}</p>`;

/* ── Now ── */

/* The landing page follows the teacher's chosen way to start. */
export function renderHome(container) {
  const mode = getPrefs().home;
  if (mode === 'board') return renderBoard(container);
  if (mode === 'ask') return renderAsk(container);
  if (mode === 'flow') return renderNow(container);
  return renderSchool(container);
}

/* The greeting Co-Cher has always opened with, in the same words. */
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const firstName = () => getPreferredName() || guessFirstName(getCurrentUser()?.name || '');

/* The teacher's own mantra if they have set one, else the day's line: the
 * same words, from the same list, as Co-Cher 2's dashboard. */
function quoteHTML() {
  let mantra = ''; try { mantra = getIdentity().chosenMantra || ''; } catch { /* no identity yet */ }
  if (mantra) return `<p class="v3-quote">${esc(mantra)}</p>`;
  const q = getDailyQuote();
  return q ? `<p class="v3-quote">\u201c${esc(q.text)}\u201d${q.attr ? ` <span>${esc(q.attr)}</span>` : ''}</p>` : '';
}

/* One note when the teacher passes a mark (first lesson presented, ten
 * reflections...). Shown once; Co-Cher 2 and 3 share what has been seen. */
function milestoneHTML() {
  let m = null; try { m = pickMilestone(Store.getLifetimeStats()); } catch { /* no stats yet */ }
  if (!m) return '';
  return `<div class="v3-mile" data-key="${esc(m.key)}">
    <div><b>${m.headline}</b><span>${m.note}</span></div>
    <a class="btn btn-secondary" href="#/my-growth" data-mile="go">See my growth</a>
    <button class="btn btn-ghost" data-mile="x">Dismiss</button>
  </div>`;
}

/* ── My School: every place as a tile, Now large and live ── */

const FACT = {
  week: () => { const now = new Date(); const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7)); const fri = new Date(mon.getTime() + 4 * DAY);
    const n = entriesBetween(ymd(mon), ymd(fri)).filter(e => !e.done).length; return n ? `${plural(n, 'entry').replace('entrys', 'entries')} of yours this week` : ''; },
  classes: () => { const c = Store.getClasses(); return c.length ? `${plural(c.length, 'class')}, ${plural(c.reduce((n, k) => n + (k.students || []).length, 0), 'student record')}` : ''; },
  lessons: () => { const n = pipeline().length; return n ? `${plural(n, 'lesson')} in progress` : ''; },
};

export function renderSchool(container) {
  const tiles = PLACES.filter(p => p.id !== 'now' && p.id !== 'school');
  container.innerHTML = `<div class="main-scroll"><div class="v3-page">
    <div class="v3-head"><div>
      <div class="v3-eyebrow"><span id="v3-school-name">My School</span> · ${dateLine(new Date())}</div>
      <h1 class="v3-title">${greeting()}, Cher!</h1>
      <p class="v3-lede">What would you like to do today${firstName() ? ', ' + esc(firstName()) : ''}?</p>
      ${quoteHTML()}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-ghost" id="v3-find">Find a student</button>
      <button class="btn btn-primary" data-add-entry="${ymd(new Date())}">Add entry</button>
    </div></div>
    ${milestoneHTML()}
    <div class="v3-home">
      <a class="v3-home-tile now" href="#/now" data-place="now"><span class="k">Now</span><div id="v3-home-now"><span class="v3-row-s">Reading your day…</span></div><span class="go">Open Now →</span></a>
      ${tiles.map(p => { const f = FACT[p.id] ? FACT[p.id]() : ''; const s = visible(p.screens)[0];
        return `<a class="v3-home-tile" href="#${p.route}" data-place="${p.id}"><span class="ic">${ICONS[p.id]}</span><b>${esc(p.label)}</b><span class="d">${esc(f || s.desc)}</span></a>`; }).join('')}
    </div>
    <p class="v3-row-s" style="margin-top:32px;">Co-Cher ${BUILD_LABEL()}</p></div></div>`;
  let alive = true;
  loadPack(currentSchoolId()).then(pack => { if (alive && pack?.name) container.querySelector('#v3-school-name').textContent = pack.name; }).catch(() => {});
  today().then(t => {
    if (!alive) return;
    const e = t.current || t.next;
    const mine = entriesForNow().filter(x => !x.done).length;
    const need = pipeline().length;
    container.querySelector('#v3-home-now').innerHTML = `
      <div class="t">${e ? `${esc(e.class || e.title)} ${t.current ? 'now, until ' + clock(toMin(e.end)) : 'next, at ' + clock(toMin(e.start))}` : t.list.length ? 'Teaching is done for today' : t.has ? 'Nothing on your timetable today' : 'No timetable on this device yet'}</div>
      ${e ? `<div class="m">${esc(rangeLabel(e))}${e.room ? ' · ' + esc(e.room) : ''}</div>` : ''}
      ${dayLine(t)}
      <div class="facts"><span><b>${t.list.filter(x => x.kind === 'lesson').length}</b> lessons today</span><span><b>${mine}</b> of your entries open</span><span><b>${need}</b> lessons need a next step</span></div>`;
  });
  container.querySelector('#v3-find').addEventListener('click', openSearch);
  container.querySelector('.v3-mile')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mile]'); if (!b) return;
    const card = e.currentTarget; markMilestoneSeen(card.dataset.key);   // either answer settles it: it never comes back
    if (b.dataset.mile === 'x') card.remove();
  });
  wireEntries(container, redraw);
  wireTileFlight(container);
  tilesFromDock(container);
  return () => { alive = false; };
}

/* ── The tiles and the menu are the same things ──
 * My School shows no menu: its tiles are the menu, laid out large. Tap a tile
 * and each one travels to its own place in the menu; come back and each menu
 * item travels out to its tile. The eye should be able to follow any one of
 * them the whole way, so:
 *   - what travels is the icon and name, at a steady size, never squashed;
 *   - it starts exactly on the tile's icon and lands exactly on the menu
 *     item's icon (and the reverse), where the real one then stands;
 *   - the motion eases in and out evenly, and lasts long enough to watch;
 *   - the tile's card shrinks away behind it, so nothing jumps.
 * Plays unless the teacher turns Motion off in Look and Feel. */
const FLY_MS = 720, FLY_GAP = 26;
const FLY_EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';
const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
/** The tile's own icon; the Now tile has none, so its small "Now" label stands in. */
const tileMark = (tile) => tile.querySelector('.ic svg') || tile.querySelector('.k') || tile;

/** A menu item that can travel: the real one's twin when it is on screen, else one drawn from the place. */
function traveller(place, at, twin) {
  const el = twin ? twin.cloneNode(true) : document.createElement('span');
  if (!twin) { el.className = 'v3-link'; el.innerHTML = `${ICONS[place.id] || ''}<span>${esc(place.label)}</span>`; }
  el.classList.remove('on'); el.classList.add('v3-fly'); el.removeAttribute('href');
  Object.assign(el.style, { left: at.left + 'px', top: at.top + 'px', width: at.width + 'px', height: at.height + 'px' });
  document.body.appendChild(el);
  return el;
}
/** The move that puts `el`'s icon exactly on `target` (a box), as a transform. */
function ontoMark(el, target) {
  const m = box(el.querySelector('svg') || el);
  const k = m.width ? Math.max(0.8, Math.min(1.5, target.height / m.height)) : 1;
  const e = box(el);
  // scale about the element's own top left corner, then shift so the icons' centres meet
  const cx = (m.left - e.left + m.width / 2) * k, cy = (m.top - e.top + m.height / 2) * k;
  return `translate(${target.left + target.width / 2 - e.left - cx}px, ${target.top + target.height / 2 - e.top - cy}px) scale(${k})`;
}

/* The way back: arriving on My School, each menu item travels out to its tile. */
function tilesFromDock(container) {
  const rects = window.__v3DockRects; window.__v3DockRects = null;
  if (!rects || getPrefs().motion === 'off') return;
  container.querySelectorAll('.v3-home-tile[data-place]').forEach((t, i) => {
    const b = rects[t.dataset.place]; if (!b || !t.animate) return;
    const place = PLACES.find(p => p.id === t.dataset.place); if (!place) return;
    const a = box(t), delay = i * FLY_GAP;
    const fly = traveller(place, b, null);
    fly.style.transformOrigin = 'top left';
    fly.animate([
      { transform: 'none', opacity: 1, offset: 0 },
      { transform: ontoMark(fly, box(tileMark(t))), opacity: 1, offset: 0.82 },
      { transform: ontoMark(fly, box(tileMark(t))), opacity: 0, offset: 1 },
    ], { duration: FLY_MS, delay, easing: FLY_EASE, fill: 'both' }).onfinish = () => fly.remove();
    // the card grows out of the menu item behind the traveller, and is whole as it lands
    t.style.transformOrigin = 'top left';
    t.animate([
      { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})`, opacity: 0, offset: 0 },
      { opacity: 0.35, offset: 0.45 },
      { transform: 'none', opacity: 1, offset: 1 },
    ], { duration: FLY_MS, delay, easing: FLY_EASE, fill: 'backwards' });
  });
}

/* The way out: tap a tile, and every tile travels to its place in the menu. */
function wireTileFlight(container) {
  const root = document.documentElement;
  container.querySelectorAll('.v3-home-tile[data-place]').forEach(tile => tile.addEventListener('click', (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
    if (getPrefs().motion === 'off' || !tile.animate) return;
    if (root.classList.contains('v3-arriving')) { ev.preventDefault(); return; }
    ev.preventDefault();
    const tiles = [...container.querySelectorAll('.v3-home-tile[data-place]')];
    const from = tiles.map(box), marks = tiles.map(t => box(tileMark(t)));   // before the menu takes its space
    root.classList.add('v3-arriving');                                         // the menu is laid out
    const nav = document.querySelector('.v3-nav');
    nav.classList.add('v3-landing');                                           // ...its items unseen until each one lands
    nav.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    container.querySelector('.v3-home').style.visibility = 'hidden';
    const more = nav.querySelector('.v3-more');
    let last = null;
    const leftovers = [];
    tiles.forEach((t, i) => {
      const place = PLACES.find(p => p.id === t.dataset.place);
      const link = nav.querySelector(`.v3-link[data-place="${t.dataset.place}"]`);
      const shown = link && link.getBoundingClientRect().width > 0;
      const home = shown ? link : (more && more.getBoundingClientRect().width ? more : nav);   // on a phone, most places live under More
      const a = from[i], b = box(home), delay = i * FLY_GAP;

      // the card: its words go first, then it shrinks into the menu item's outline
      const card = t.cloneNode(true);
      Object.assign(card.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0, zIndex: 500, pointerEvents: 'none', transformOrigin: 'top left', overflow: 'hidden' });
      [...card.children].forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay, fill: 'both' }));
      document.body.appendChild(card);
      card.animate([
        { transform: 'none', opacity: 1, offset: 0 },
        { opacity: 0.55, offset: 0.6 },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})`, opacity: 0, offset: 1 },
      ], { duration: FLY_MS, delay, easing: FLY_EASE, fill: 'both' });

      // the icon and name: from the tile's icon to the menu item's icon, in one unbroken move
      const fly = traveller(place, b, shown ? link : null);
      fly.style.transformOrigin = 'top left';
      const start = ontoMark(fly, marks[i]);
      last = fly.animate([
        { transform: start, opacity: 0, offset: 0 },
        { transform: start, opacity: 1, offset: 0.12 },
        { transform: 'none', opacity: shown ? 1 : 0.2, offset: 1 },
      ], { duration: FLY_MS, delay, easing: FLY_EASE, fill: 'both' });
      leftovers.push(card, fly);
    });
    // items with no tile of their own (School, Search, More) come up quietly as the others land
    nav.querySelectorAll('.v3-link').forEach(l => { if (!tiles.some(t => t.dataset.place === l.dataset.place)) l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, delay: FLY_MS - 280, easing: 'ease-out', fill: 'forwards' }); });
    last.onfinish = () => {
      nav.classList.remove('v3-landing');          // the real items stand where the travellers landed
      leftovers.forEach(g => g.remove());
      location.hash = tile.getAttribute('href');
      setTimeout(() => root.classList.remove('v3-arriving'), 60);
    };
  }));
}

/* ── Now ── */

export function renderNow(container) {

  container.innerHTML = `<div class="main-scroll"><div class="v3-page" id="v3-now"><p class="v3-empty">Reading your day…</p></div></div>`;
  let alive = true;

  today().then(t => {
    if (!alive) return;
    const lessonsToday = t.list.filter(e => e.kind === 'lesson');
    const others = t.list.length - lessonsToday.length;
    const lede = t.list.length
      ? `${plural(lessonsToday.length, 'lesson')}${others ? ` and ${plural(others, 'other commitment')}` : ''} today`
        + (t.current || t.next ? '' : ', all done')
      : t.has ? 'Nothing on your timetable today'
      : 'No timetable on this device yet, so this page starts from your lessons';

    const pipe = pipeline();
    const ins = insights();
    container.querySelector('#v3-now').innerHTML = `
      <div class="v3-head"><div>
        <div class="v3-eyebrow">${t.cycle ? esc(t.cycle) + ' week' : 'Today'}</div>
        <h1 class="v3-title">${dateLine(new Date())}</h1>
        <p class="v3-lede">${lede}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a class="btn btn-secondary" href="#/lesson-planner">New lesson</a>
        <button class="btn btn-ghost" id="v3-find">Find a student</button>
        <button class="btn btn-primary" data-add-entry="${ymd(new Date())}">Add entry</button>
      </div></div>
      ${dayLine(t)}
      ${nowCard(t)}
      <div class="v3-grid" style="margin-top:var(--gap);">
        <div class="v3-col-7"><div class="v3-panel">
          <div class="v3-h">Needs You <a href="#/lessons">All lessons</a></div>
          ${rowsHTML(pipe.slice(0, 6).map(x => `<a class="v3-row" href="${lessonHref(x)}">
            <span><span class="v3-row-s">${STAGE[x.stage].verb}</span><br><span class="v3-row-t">${esc(x.l.title)}</span></span>
            ${x.cls ? `<span class="v3-chip">${esc(x.cls.name)}</span>` : ''}
            <span class="go">${STAGE[x.stage].go} →</span></a>`),
            'Nothing waiting. <a href="#/lesson-planner">Plan a lesson</a> and it will appear here, with its next step.')}
        </div></div>
        <div class="v3-col-5">
          <div class="v3-panel" style="margin-bottom:var(--gap);">
            <div class="v3-h">Your Entries <a href="#/week">The week</a></div>
            ${rowsHTML(entriesForNow().slice(0, 7).map(e => entryHTML(e)),
              'Nothing added. Use Add entry for a lesson to develop, a paper to set or an admin task, and link it to a class or a lesson.')}
          </div>
          <div class="v3-panel" style="margin-bottom:var(--gap);">
            <div class="v3-h">Worth a Look</div>
            ${rowsHTML(ins.map(i => `<a class="v3-row" href="${i.href}"><span><span class="v3-row-t">${esc(i.t)}</span><br><span class="v3-row-s">${esc(i.s)}</span></span></a>`),
              'Nothing stands out yet. As you observe students in lessons, patterns show here.')}
          </div>
          <div class="v3-panel">
            <div class="v3-h">Today <a href="#/week">The week</a></div>
            ${rowsHTML(t.list.map(e => `<div class="v3-row"><span class="v3-time">${esc(rangeLabel(e))}</span>
              <span><span class="v3-row-t">${esc(e.class || e.title)}</span>${e.room ? `<br><span class="v3-row-s">${esc(e.room)}</span>` : ''}</span></div>`),
              t.has ? 'No entries today' : 'No timetable on this device. Open <a href="#/my-timetable">My timetable</a> to load yours.')}
          </div>
        </div>
      </div>`;
    container.querySelector('#v3-find')?.addEventListener('click', openSearch);
    wireEntries(container, redraw);
  });
  return () => { alive = false; };
}

function renderBoard(container) {
  container.innerHTML = `<div class="main-scroll"><div class="v3-page">
    <div class="v3-head"><div>
      <div class="v3-eyebrow">${dateLine(new Date())}</div>
      <h1 class="v3-title">Everything, in Its Place</h1>
      <p class="v3-lede">Each screen in Co-Cher, grouped by what you are doing</p>
    </div></div>
    ${PLACES.map(p => `<div style="margin-bottom:calc(var(--gap) * 1.2);">
      <div class="v3-h">${p.label}</div>
      <div class="v3-board">${visible(p.screens).map(tile).join('')}</div></div>`).join('')}
  </div></div>`;
}

function renderAsk(container) {
  const pipe = pipeline();
  const next = pipe.find(x => STAGE[x.stage].go === 'Present');
  container.innerHTML = `<div class="main-scroll"><div class="v3-page v3-ask">
    <div class="v3-eyebrow">${dateLine(new Date())}</div>
    <h1 class="v3-title">Where to?</h1>
    <button class="v3-askbox" id="v3-ask"><span>A lesson, a class, a student, a tool…</span><kbd>Ctrl K</kbd></button>
    <div class="v3-quick">
      ${next ? `<a href="${lessonHref(next)}">Present “${esc(next.l.title.slice(0, 28))}${next.l.title.length > 28 ? '…' : ''}”</a>` : ''}
      <a href="#/lesson-planner">Plan a lesson</a><a href="#/classes">My classes</a><a href="#/week">This week</a><a href="#/admin">Find a teacher</a><a href="#/resources">Resources</a>
    </div></div></div>`;
  container.querySelector('#v3-ask').addEventListener('click', openSearch);
}

const tile = (s) => `<a class="v3-tile" href="#${s.route}"><b>${esc(s.label)}${s.tag ? `<em>${esc(s.tag)}</em>` : ''}</b><span>${esc(s.desc)}</span></a>`;

/* ── Week ── */

export function renderWeek(container) {
  container.innerHTML = `<div class="main-scroll"><div class="v3-page" id="v3-week"><p class="v3-empty">Reading your week…</p></div></div>`;
  let alive = true;
  const now = new Date();
  const monday = new Date(now); monday.setHours(12, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = [0, 1, 2, 3, 4].map(i => new Date(monday.getTime() + i * DAY));

  Promise.all([getMyTimetable().catch(() => null), cycleForDate(currentSchoolId(), monday).catch(() => null),
    ...days.map(d => entriesForDate(d).catch(() => []))]).then(([tt, cycle, ...lists]) => {
    if (!alive) return;
    const pipe = pipeline();
    const since = Date.now() - 7 * DAY;
    const ev = Store.getClasses().map(c => ({ c, n: (c.students || []).reduce((a, s) => a + (s.observations || []).filter(o => (o.ts || 0) >= since).length, 0) })).filter(x => x.n);
    const total = lists.flat().filter(e => e.kind === 'lesson').length;
    container.querySelector('#v3-week').innerHTML = `
      <div class="v3-head"><div>
        <div class="v3-eyebrow">Week of ${monday.toLocaleDateString('en-SG', { day: 'numeric', month: 'long' })}${cycle ? ' · ' + esc(cycle) + ' week' : ''}</div>
        <h1 class="v3-title">This Week</h1>
        <p class="v3-lede">${tt ? `${plural(total, 'lesson')} on your timetable, ${plural(pipe.length, 'lesson')} in progress` : 'No timetable on this device yet, so the week starts from your lessons'}</p>
      </div><div style="display:flex;gap:8px;flex-wrap:wrap;"><a class="btn btn-secondary" href="#/my-timetable">Odd and even weeks</a><button class="btn btn-primary" data-add-entry="${ymd(now)}">Add entry</button></div></div>
      <div class="v3-week">${days.map((d, i) => { const mine = entriesBetween(ymd(d), ymd(d)); return `<div class="d${d.toDateString() === now.toDateString() ? ' today' : ''}">
        <div class="dh"><span>${d.toLocaleDateString('en-SG', { weekday: 'short' })}</span><span>${d.getDate()}</span></div>
        ${lists[i].length ? lists[i].map(e => `<div class="e${e.kind === 'lesson' ? '' : ' other'}"><b>${esc(e.class || e.title)}</b><span>${esc(rangeLabel(e))}${e.room ? ' · ' + esc(e.room) : ''}</span></div>`).join('') : (tt ? '<span class="v3-row-s">No lessons</span>' : '')}
        ${mine.map(e => entryHTML(e, { compact: true })).join('')}
        <button class="v3-add" data-add-entry="${ymd(d)}" aria-label="Add an entry on ${d.toLocaleDateString('en-SG', { weekday: 'long' })}">+ Add</button>
      </div>`; }).join('')}</div>
      <div class="v3-grid" style="margin-top:calc(var(--gap) * 1.2);">
        <div class="v3-col-7"><div class="v3-panel"><div class="v3-h">Lessons in Progress <a href="#/lessons">All lessons</a></div>
          ${rowsHTML(pipe.slice(0, 8).map(x => `<a class="v3-row" href="#/lessons/${x.l.id}">
            <span><span class="v3-row-t">${esc(x.l.title)}</span><br><span class="v3-row-s">${x.cls ? esc(x.cls.name) + ' · ' : ''}${STAGE[x.stage].go === 'Present' ? 'ready to teach' : x.stage === 'taught' ? 'taught, awaiting reflection' : 'in design'}</span></span>
            <span class="go">Open →</span></a>`), 'No lessons in progress')}
        </div></div>
        <div class="v3-col-5"><div class="v3-panel"><div class="v3-h">Evidence, Last 7 Days</div>
          ${rowsHTML(ev.map(x => `<a class="v3-row" href="#/classes/${x.c.id}"><span class="v3-row-t">${esc(x.c.name)}</span><span class="go">${plural(x.n, 'observation')}</span></a>`),
            'None captured this week. In Present, press O to note who showed what.')}
        </div></div>
      </div>`;
    wireEntries(container, redraw);
  });
  return () => { alive = false; };
}

/* ── Term ── */

export function renderTerm(container) {
  container.innerHTML = `<div class="main-scroll"><div class="v3-page" id="v3-term"><p class="v3-empty">Reading the term…</p></div></div>`;
  let alive = true;
  loadPack(currentSchoolId()).catch(() => null).then(pack => {
    if (!alive) return;
    const weeks = (pack?.calendar?.weeks || []).map(w => ({ start: new Date(w.start + 'T00:00:00'), cycle: w.cycle }));
    const now = Date.now();
    const idx = weeks.findIndex((w, i) => w.start.getTime() <= now && (i === weeks.length - 1 || weeks[i + 1].start.getTime() > now));
    // The term is the run of teaching weeks around today, bounded by holidays.
    let a = idx, b = idx;
    if (idx >= 0 && weeks[idx].cycle) { while (a > 0 && weeks[a - 1].cycle) a--; while (b < weeks.length - 1 && weeks[b + 1].cycle) b++; }
    const inTerm = idx >= 0 && weeks[idx].cycle;
    const lessons = Store.getLessons();
    const stages = lessons.map(lessonStage);
    const classes = Store.getClasses();
    const students = classes.flatMap(c => c.students || []);
    const obs = students.reduce((n, s) => n + (s.observations || []).length, 0);
    const withEv = students.filter(s => (s.observations || []).length).length;
    const withPath = students.filter(s => s.pathsLink).length;
    const stat = (n, label) => `<div><b>${n}</b><span>${label}</span></div>`;
    container.querySelector('#v3-term').innerHTML = `
      <div class="v3-head"><div>
        <div class="v3-eyebrow">${esc(pack?.name || 'Your school')}</div>
        <h1 class="v3-title">${inTerm ? `Week ${idx - a + 1} of ${b - a + 1}` : weeks.length ? 'Between terms' : 'This term'}</h1>
        <p class="v3-lede">${inTerm ? `${plural(b - idx, 'week')} left after this one` : weeks.length ? 'A good time to look back, and to plan the next stretch' : 'Your school has not published its calendar, so the term is shown by what you have built'}</p>
      </div></div>
      ${weeks.length ? `<div class="v3-panel" style="margin-bottom:var(--gap);"><div class="v3-h">The Year, Week by Week</div>
        <div class="v3-term">${weeks.map((w, i) => `<i class="${!w.cycle ? 'hol' : i === idx ? 'now' : i < idx ? 'past' : ''}" title="Week of ${w.start.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}${w.cycle ? ', ' + w.cycle : ', no lessons'}"></i>`).join('')}</div></div>` : ''}
      <div class="v3-panel" style="margin-bottom:var(--gap);"><div class="v3-h">What You Have Built</div><div class="v3-stats">
        ${stat(lessons.length, 'lessons designed')}
        ${stat(stages.filter(s => s === 'taught' || s === 'reflected').length, 'taught')}
        ${stat(stages.filter(s => s === 'reflected').length, 'reflected on')}
        ${stat(obs, 'observations of students')}
        ${stat(`${withEv}<small> of ${students.length}</small>`, 'student records with evidence')}
        ${stat(withPath, 'student records with a pathway')}
      </div></div>
      <div class="v3-panel" style="margin-bottom:var(--gap);"><div class="v3-h">Your Goals This Term <button class="btn btn-ghost btn-sm" data-add-goal>${allGoals().length ? 'Add a goal' : 'Set a goal'}</button></div>
        <div class="v3-goals">${goalsHTML()}</div></div>
      <div class="v3-grid">
        <div class="v3-col-5 v3-panel"><div class="v3-h">Your Entries Ahead <button class="btn btn-ghost btn-sm" data-add-entry="">Add entry</button></div>
          ${rowsHTML(entriesBetween(ymd(new Date()), '9999').filter(e => !e.done).slice(0, 10).map(e => entryHTML(e)),
            'Nothing dated ahead. Add the term’s deadlines here: papers to set, reports, events.')}
        </div>
        <div class="v3-col-7 v3-panel"><div class="v3-h">The Term’s Larger Jobs</div>
          <a class="v3-row" href="#/assessment/aol"><span><span class="v3-row-t">Set a paper</span><br><span class="v3-row-s">Table of Specifications, then draft questions</span></span><span class="go">Assess →</span></a>
          <a class="v3-row" href="#/report-comments"><span><span class="v3-row-t">Write report comments</span><br><span class="v3-row-s">Drafted from each student’s levels and evidence</span></span><span class="go">Classes →</span></a>
          <a class="v3-row" href="#/cce"><span><span class="v3-row-t">ECG conversations</span><br><span class="v3-row-s">Paths, inside CCE2021; add a student’s plan to their profile</span></span><span class="go">Lessons →</span></a>
          <a class="v3-row" href="#/my-growth"><span><span class="v3-row-t">Your own learning</span><br><span class="v3-row-s">Reflections and rehearsals build your practice story</span></span><span class="go">Open →</span></a>
        </div>
      </div>`;
    wireGoals(container, redraw);
    wireEntries(container, redraw);
  });
  return () => { alive = false; };
}

/* ── Hubs ── */

export function renderHub(container, placeId) {
  const p = PLACES.find(x => x.id === placeId);
  const lede = {
    resources: 'Everything you can bring into a lesson',
    school: 'Your school’s tools and people',
    personal: 'What is yours: your timetable, your learning, and how Co-Cher looks and works for you',
  }[placeId] || '';
  container.innerHTML = `<div class="main-scroll"><div class="v3-page">
    <div class="v3-head"><div><div class="v3-eyebrow">${esc(p.group)}</div><h1 class="v3-title">${esc(p.label)}</h1><p class="v3-lede">${lede}</p></div></div>
    <div class="v3-board big">${screensIn(p).filter(s => s.route !== p.route).map(tile).join('')}
      ${placeId === 'personal' ? `<button class="v3-tile" data-act="look"><b>Look and Feel</b><span>Look, day or night, type, menu, how you start, spacing</span></button>` : ''}
      ${placeId === 'school' ? `<a class="v3-tile" href="../cocher2/cocher2.html"><b>Co-Cher 2</b><span>The current version, with the same classes and lessons</span></a>` : ''}
    </div></div></div>`;
}

/* ── Paths, on its own (also inside CCE2021, ECG) ── */

export function renderPaths(container) {
  container.innerHTML = `<div class="main-scroll"><div class="v3-page">
    <div class="v3-head"><div><div class="v3-eyebrow">For Students</div><h1 class="v3-title">Paths</h1>
      <p class="v3-lede">How do I get there? The live Pathways app. A student’s shared plan can be added to their profile in My classes</p></div></div>
    <div id="v3-paths"></div></div></div>`;
  return mountEmbed(container.querySelector('#v3-paths'), { src: `${GENAPP}/pathways/index.html?s=path`, title: 'Paths', note: 'Every update to Paths shows here.' });
}
