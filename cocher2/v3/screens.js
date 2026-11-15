/*
 * Co-Cher 3: the screens that are new
 * ===================================
 * Now, Week and Term (a teacher's time), and the hub pages. Everything shown
 * is read from what Co-Cher already holds: the timetable, lessons, classes
 * and evidence. Nothing is invented; an empty part says what would fill it.
 */

import { Store } from '../js/state.js';
import { getPrefs } from './prefs.js';
import { PLACES, visible } from './places.js';
import { currentSchoolId } from '../js/components/login.js';
import { getMyTimetable, entriesForDate, rangeLabel } from '../js/utils/timetable.js';
import { loadPack, cycleForDate } from '../js/utils/school.js';
import { lessonStage } from '../js/views/lessons.js';
import { competencyLabel } from '../js/utils/evidence.js';
import { openSearch } from '../js/components/unified-search.js';

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

export function renderNow(container) {
  const mode = getPrefs().home;
  if (mode === 'board') return renderBoard(container);
  if (mode === 'ask') return renderAsk(container);

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
      </div></div>
      ${dayLine(t)}
      ${nowCard(t)}
      <div class="v3-grid" style="margin-top:var(--gap);">
        <div class="v3-col-7"><div class="v3-panel">
          <div class="v3-h">Needs you <a href="#/lessons">All lessons</a></div>
          ${rowsHTML(pipe.slice(0, 6).map(x => `<a class="v3-row" href="${lessonHref(x)}">
            <span><span class="v3-row-s">${STAGE[x.stage].verb}</span><br><span class="v3-row-t">${esc(x.l.title)}</span></span>
            ${x.cls ? `<span class="v3-chip">${esc(x.cls.name)}</span>` : ''}
            <span class="go">${STAGE[x.stage].go} →</span></a>`),
            'Nothing waiting. <a href="#/lesson-planner">Plan a lesson</a> and it will appear here, with its next step.')}
        </div></div>
        <div class="v3-col-5">
          <div class="v3-panel" style="margin-bottom:var(--gap);">
            <div class="v3-h">Worth a look</div>
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
  });
  return () => { alive = false; };
}

function renderBoard(container) {
  container.innerHTML = `<div class="main-scroll"><div class="v3-page">
    <div class="v3-head"><div>
      <div class="v3-eyebrow">${dateLine(new Date())}</div>
      <h1 class="v3-title">Everything, in its place</h1>
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
        <h1 class="v3-title">This week</h1>
        <p class="v3-lede">${tt ? `${plural(total, 'lesson')} on your timetable, ${plural(pipe.length, 'lesson')} in progress` : 'No timetable on this device yet, so the week starts from your lessons'}</p>
      </div><a class="btn btn-secondary" href="#/my-timetable">Odd and even weeks</a></div>
      ${tt ? `<div class="v3-week">${days.map((d, i) => `<div class="d${d.toDateString() === now.toDateString() ? ' today' : ''}">
        <div class="dh"><span>${d.toLocaleDateString('en-SG', { weekday: 'short' })}</span><span>${d.getDate()}</span></div>
        ${lists[i].length ? lists[i].map(e => `<div class="e${e.kind === 'lesson' ? '' : ' other'}"><b>${esc(e.class || e.title)}</b><span>${esc(rangeLabel(e))}${e.room ? ' · ' + esc(e.room) : ''}</span></div>`).join('') : '<span class="v3-row-s">Free</span>'}
      </div>`).join('')}</div>` : ''}
      <div class="v3-grid" style="margin-top:calc(var(--gap) * 1.2);">
        <div class="v3-col-7"><div class="v3-panel"><div class="v3-h">Lessons in progress <a href="#/lessons">All lessons</a></div>
          ${rowsHTML(pipe.slice(0, 8).map(x => `<a class="v3-row" href="#/lessons/${x.l.id}">
            <span><span class="v3-row-t">${esc(x.l.title)}</span><br><span class="v3-row-s">${x.cls ? esc(x.cls.name) + ' · ' : ''}${STAGE[x.stage].go === 'Present' ? 'ready to teach' : x.stage === 'taught' ? 'taught, awaiting reflection' : 'in design'}</span></span>
            <span class="go">Open →</span></a>`), 'No lessons in progress')}
        </div></div>
        <div class="v3-col-5"><div class="v3-panel"><div class="v3-h">Evidence, last 7 days</div>
          ${rowsHTML(ev.map(x => `<a class="v3-row" href="#/classes/${x.c.id}"><span class="v3-row-t">${esc(x.c.name)}</span><span class="go">${plural(x.n, 'observation')}</span></a>`),
            'None captured this week. In Present, press O to note who showed what.')}
        </div></div>
      </div>`;
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
      ${weeks.length ? `<div class="v3-panel" style="margin-bottom:var(--gap);"><div class="v3-h">The year, week by week</div>
        <div class="v3-term">${weeks.map((w, i) => `<i class="${!w.cycle ? 'hol' : i === idx ? 'now' : i < idx ? 'past' : ''}" title="Week of ${w.start.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}${w.cycle ? ', ' + w.cycle : ', no lessons'}"></i>`).join('')}</div></div>` : ''}
      <div class="v3-panel" style="margin-bottom:var(--gap);"><div class="v3-h">What you have built</div><div class="v3-stats">
        ${stat(lessons.length, 'lessons designed')}
        ${stat(stages.filter(s => s === 'taught' || s === 'reflected').length, 'taught')}
        ${stat(stages.filter(s => s === 'reflected').length, 'reflected on')}
        ${stat(obs, 'observations of students')}
        ${stat(`${withEv}<small> of ${students.length}</small>`, 'student records with evidence')}
        ${stat(withPath, 'student records with a pathway')}
      </div></div>
      <div class="v3-grid">
        <div class="v3-col-12 v3-panel"><div class="v3-h">The term’s larger jobs</div>
          <a class="v3-row" href="#/assessment/aol"><span><span class="v3-row-t">Set a paper</span><br><span class="v3-row-s">Table of Specifications, then draft questions</span></span><span class="go">Assess →</span></a>
          <a class="v3-row" href="#/report-comments"><span><span class="v3-row-t">Write report comments</span><br><span class="v3-row-s">Drafted from each student’s levels and evidence</span></span><span class="go">Classes →</span></a>
          <a class="v3-row" href="#/cce"><span><span class="v3-row-t">ECG conversations</span><br><span class="v3-row-s">Paths, inside CCE2021; add a student’s plan to their profile</span></span><span class="go">Lessons →</span></a>
          <a class="v3-row" href="#/my-growth"><span><span class="v3-row-t">Your own learning</span><br><span class="v3-row-s">Reflections and rehearsals build your practice story</span></span><span class="go">Open →</span></a>
        </div>
      </div>`;
  });
  return () => { alive = false; };
}

/* ── Hubs ── */

export function renderHub(container, placeId) {
  const p = PLACES.find(x => x.id === placeId);
  const lede = { resources: 'Everything you can bring into a lesson', school: 'Your school’s tools and people, and your own settings' }[placeId] || '';
  container.innerHTML = `<div class="main-scroll"><div class="v3-page">
    <div class="v3-head"><div><div class="v3-eyebrow">${esc(p.group)}</div><h1 class="v3-title">${esc(p.label)}</h1><p class="v3-lede">${lede}</p></div></div>
    <div class="v3-board">${visible(p.screens).filter(s => s.route !== p.route).map(tile).join('')}
      ${placeId === 'school' ? `<a class="v3-tile" href="cocher2.html"><b>Co-Cher 2</b><span>The current version, with the same classes and lessons</span></a>` : ''}
    </div></div></div>`;
}
