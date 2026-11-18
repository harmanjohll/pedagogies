/*
 * Co-Cher 3: working with colleagues
 * ==================================
 * Three screens that need no server.
 *
 * Common free time (/free-time): pick colleagues and see when everyone,
 * including you, is free. Read from the staff timetable the school published
 * with the app, and your own timetable. "Free" means free of everything in the
 * timetable: lessons, duty, PD, school events.
 *
 * Student handover (/handover): one teacher downloads their evidence on a
 * class as a file and passes it on (Teams, OneDrive); the other loads it and
 * the observations join the same students in their own records. Matched by
 * Student Finder key, else by name within the same form class. Nothing is
 * doubled: an observation already held is skipped. The file holds student
 * names, so it travels by the school's own channels and never into this repo.
 *
 * Send to a colleague (/send): the teacher ticks what to send (lessons, room
 * layouts, entries, term goals) and gets one file. Lessons and layouts ride in
 * a Department Pack (cocher2/js/utils/share-pack.js), so everything a lesson
 * needs comes along and the receiver's copy is a draft that names its author.
 * No student data is in this file: lessons lose their class link on the way.
 */

import { Store } from '../state.js';
import { getCurrentUser, getPreferredName, currentSchoolId } from '../components/login.js';
import { fetchBundledRoster } from '../utils/directory.js';
import { getMyTimetable } from '../utils/timetable.js';
import { cycleForDate } from '../utils/school.js';
import { showToast } from '../components/toast.js';
import { classCode } from '../utils/evidence.js';
import { ymd, addEntry, allEntries, KINDS } from './agenda.js';
import { allGoals } from './goals.js';
import { exportPack, importPack } from '../utils/share-pack.js';
import { generateId } from '../state.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toMin = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const clock = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const DAY = 86400000, DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MIN_GAP = 30;

/* ══════════ Common free time ══════════ */

export function renderFreeTime(container) {
  container.innerHTML = `<div class="main-scroll"><div class="v3-page"><p class="v3-empty">Reading the timetable…</p></div></div>`;
  const page = container.querySelector('.v3-page');
  let alive = true;
  const picked = new Set();
  let filter = '', weekIx = 0, weeks = [], people = [], mine = [], bounds = [450, 960];

  const now = new Date();
  const monday = new Date(now); monday.setHours(12, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  Promise.all([
    fetchBundledRoster(currentSchoolId()).catch(() => null),
    getMyTimetable().catch(() => null),
    cycleForDate(currentSchoolId(), monday).catch(() => null),
    cycleForDate(currentSchoolId(), new Date(monday.getTime() + 7 * DAY)).catch(() => null),
  ]).then(([roster, tt, c0, c1]) => {
    if (!alive) return;
    const me = (getCurrentUser()?.email || '').toLowerCase();
    people = (roster?.teachers || []).filter(t => (t.entries || []).length && (t.email || '').toLowerCase() !== me)
      .map((t, i) => ({ i, name: t.name, department: t.department || '', entries: t.entries }));
    mine = tt?.entries || [];
    const all = [...people.flatMap(p => p.entries), ...mine];
    if (all.length) bounds = [Math.min(...all.map(e => toMin(e.start)).filter(Boolean)), Math.max(...all.map(e => toMin(e.end)).filter(Boolean))];
    // Dated weeks while the term runs; outside it, the two patterns of the timetable.
    weeks = [
      c0 ? { label: 'This week', cycle: c0, monday } : null,
      c1 ? { label: 'Next week', cycle: c1, monday: new Date(monday.getTime() + 7 * DAY) } : null,
    ].filter(Boolean);
    if (!weeks.length) {
      const hasCycle = all.some(e => e.cycle);
      weeks = hasCycle ? [{ label: 'An odd week', cycle: 'Odd' }, { label: 'An even week', cycle: 'Even' }] : [{ label: 'A school week', cycle: null }];
    }
    draw();
  });

  const busyOn = (entries, day, cycle) => entries.filter(e => e.day === day && (e.cycle == null || cycle == null || e.cycle === cycle))
    .map(e => [toMin(e.start), toMin(e.end)]).filter(([a, b]) => a != null && b != null);

  function gaps(day, cycle) {
    const chosen = people.filter(p => picked.has(p.i));
    const busy = [...busyOn(mine, day, cycle), ...chosen.flatMap(p => busyOn(p.entries, day, cycle))].sort((a, b) => a[0] - b[0]);
    const out = []; let t = bounds[0];
    busy.forEach(([a, b]) => { if (a - t >= MIN_GAP) out.push([t, a]); t = Math.max(t, b); });
    if (bounds[1] - t >= MIN_GAP) out.push([t, bounds[1]]);
    return out;
  }

  function draw() {
    if (!people.length) {
      page.innerHTML = head() + `<div class="v3-panel"><p class="v3-empty">Your school has not published a staff timetable with Co-Cher, so there is nothing to compare. Find a Teacher in Admin shows what is available.</p></div>`;
      return;
    }
    const w = weeks[weekIx];
    const chosen = people.filter(p => picked.has(p.i));
    const q = norm(filter);
    const list = people.filter(p => !q || norm(p.name).includes(q) || norm(p.department).includes(q)).slice(0, 60);
    page.innerHTML = head() + `
      <div class="v3-grid">
        <div class="v3-col-4"><div class="v3-panel">
          <div class="v3-h">Who needs to be there</div>
          <input class="input" id="ft2-q" type="search" placeholder="Name or department" value="${esc(filter)}" autocomplete="off" style="margin-bottom:12px;">
          ${chosen.length ? `<div class="v3-picked">${chosen.map(p => `<button class="v3-chip a" data-unpick="${p.i}" title="Remove">${esc(p.name)} ×</button>`).join('')}</div>` : ''}
          <div class="v3-people">${list.map(p => `<button class="v3-person${picked.has(p.i) ? ' on' : ''}" data-pick="${p.i}" aria-pressed="${picked.has(p.i)}"><span>${esc(p.name)}</span><small>${esc(p.department)}</small></button>`).join('') || '<p class="v3-empty">No colleague matches</p>'}</div>
        </div></div>
        <div class="v3-col-8"><div class="v3-panel">
          <div class="v3-h">When you are all free
            <span class="v3-seg">${weeks.map((x, i) => `<button data-week="${i}" aria-pressed="${i === weekIx}">${esc(x.label)}${x.monday ? '' : ''}</button>`).join('')}</span></div>
          ${!mine.length ? '<p class="v3-empty" style="margin-bottom:12px;">Your own timetable is not on this device, so only your colleagues’ lessons are counted.</p>' : ''}
          ${!chosen.length ? '<p class="v3-empty">Pick one or more colleagues. Their timetables and yours are laid over each other, and the gaps of 30 minutes or more show here.</p>'
            : DAYS.map((d, di) => { const g = gaps(d, w.cycle); const date = w.monday ? new Date(w.monday.getTime() + di * DAY) : null;
              return `<div class="v3-row" style="align-items:flex-start;"><span class="v3-time" style="width:112px;padding-top:4px;">${d}${date ? ' ' + date.getDate() + ' ' + date.toLocaleDateString('en-SG', { month: 'short' }) : ''}</span>
                <span style="display:flex;flex-wrap:wrap;gap:8px;flex:1;">${g.length ? g.map(([a, b]) => `<button class="v3-slot" data-slot="${di}|${a}|${b}" title="Add this as an entry">${clock(a)}–${clock(b)} <small>${b - a} min</small></button>`).join('') : '<span class="v3-row-s">No common gap</span>'}</span></div>`; }).join('')}
          ${chosen.length ? `<p class="v3-row-s" style="margin-top:12px;">${w.cycle ? esc(w.cycle) + ' week. ' : ''}Tap a slot to add it to your entries. Free means free of lessons, duty, PD and school events in the timetable; it cannot see meetings made elsewhere.</p>` : ''}
        </div></div>
      </div>`;
    const qEl = page.querySelector('#ft2-q');
    qEl.addEventListener('input', () => { filter = qEl.value; const pos = qEl.selectionStart; draw(); const n = page.querySelector('#ft2-q'); n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* search inputs */ } });
    page.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const i = +b.dataset.pick; picked.has(i) ? picked.delete(i) : picked.add(i); draw(); });
    page.querySelectorAll('[data-unpick]').forEach(b => b.onclick = () => { picked.delete(+b.dataset.unpick); draw(); });
    page.querySelectorAll('[data-week]').forEach(b => b.onclick = () => { weekIx = +b.dataset.week; draw(); });
    page.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
      const [di, a, bb] = b.dataset.slot.split('|').map(Number);
      const names = chosen.map(p => p.name.replace(/^(Mr|Mrs|Ms|Mdm|Miss|Dr)\s+/i, (m) => m)).join(', ');
      const date = w.monday ? ymd(new Date(w.monday.getTime() + di * DAY)) : '';
      addEntry({ title: `Meet ${names}, ${clock(a)}–${clock(bb)}`, kind: 'other', date });
      showToast(date ? 'Added to your entries for that day' : 'Added to your entries', 'success');
    });
  }

  const head = () => `<div class="v3-head"><div><div class="v3-eyebrow">With colleagues</div><h1 class="v3-title">Common free time</h1>
    <p class="v3-lede">Find when you and your colleagues are all free, from the school’s timetable</p></div></div>`;

  return () => { alive = false; };
}

/* ══════════ Student handover ══════════ */

const FILE_KIND = 'cocher-handover';

function buildHandover(cls) {
  const user = getCurrentUser() || {};
  return {
    kind: FILE_KIND, v: 1, at: Date.now(), school: currentSchoolId() || '',
    from: { name: getPreferredName() || user.name || user.email || 'A colleague', email: user.email || '' },
    class: { name: cls.name, subject: cls.subject || '', level: cls.level || '' },
    students: (cls.students || []).filter(s => (s.observations || []).length).map(s => ({
      name: s.name, index: s.index || '', formClass: s.formClass || classCode(cls.name), sfKey: s.sfKey || '',
      observations: s.observations,
    })),
  };
}

/** Find this student in my own records: Student Finder key, else name within the same form class. */
function findMine(hs) {
  for (const c of Store.getClasses()) {
    for (const s of c.students || []) {
      if (hs.sfKey && s.sfKey) { if (hs.sfKey === s.sfKey) return { cls: c, student: s }; continue; }
      if (norm(s.name) !== norm(hs.name)) continue;
      const theirs = hs.formClass, mineForm = s.formClass || classCode(c.name);
      if (theirs && mineForm && theirs === mineForm) return { cls: c, student: s };
    }
  }
  return null;
}

export function renderHandover(container) {
  const classes = Store.getClasses();
  let incoming = null, matches = [];
  const page = () => container.querySelector('.v3-page');

  function draw(note = '') {
    container.innerHTML = `<div class="main-scroll"><div class="v3-page">
      <div class="v3-head"><div><div class="v3-eyebrow">With colleagues</div><h1 class="v3-title">Student handover</h1>
        <p class="v3-lede">Pass your evidence on a class to a colleague, and take in theirs. It joins the same students, with nothing doubled</p></div></div>
      <div class="v3-grid">
        <div class="v3-col-6"><div class="v3-panel">
          <div class="v3-h">Send</div>
          ${classes.length ? `<label class="input-label" for="ho-class">Class</label>
            <select class="input" id="ho-class">${classes.map(c => { const n = (c.students || []).reduce((a, s) => a + (s.observations || []).length, 0);
              return `<option value="${esc(c.id)}">${esc(c.name)} · ${plural(n, 'observation')}</option>`; }).join('')}</select>
            <button class="btn btn-primary" id="ho-send" style="margin-top:12px;">Download handover file</button>
            <p class="v3-row-s" style="margin-top:12px;">The file holds student names and your observations. Send it by Teams or OneDrive, as you would a class list.</p>`
          : '<p class="v3-empty">You have no classes yet.</p>'}
        </div></div>
        <div class="v3-col-6"><div class="v3-panel">
          <div class="v3-h">Receive</div>
          <input type="file" id="ho-file" accept=".json,application/json" hidden>
          <button class="btn btn-secondary" id="ho-pick">Load a handover file</button>
          <div id="ho-in" style="margin-top:12px;">${note ? `<p class="v3-row-t">${esc(note)}</p>` : ''}${incoming ? preview() : ''}</div>
        </div></div>
      </div></div></div>`;
    container.querySelector('#ho-send')?.addEventListener('click', send);
    container.querySelector('#ho-pick').addEventListener('click', () => container.querySelector('#ho-file').click());
    container.querySelector('#ho-file').addEventListener('change', load);
    container.querySelector('#ho-add')?.addEventListener('click', take);
  }

  function send() {
    const cls = Store.getClass(container.querySelector('#ho-class').value);
    const doc = buildHandover(cls);
    if (!doc.students.length) { showToast('No observations in that class yet', 'warning'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(doc)], { type: 'application/json' }));
    a.download = `handover ${cls.name}.json`.replace(/[\\/:*?"<>|]/g, ' ');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast(`${plural(doc.students.length, 'student')} in the file`, 'success');
  }

  async function load(ev) {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const doc = JSON.parse(await f.text());
      if (doc?.kind !== FILE_KIND || !Array.isArray(doc.students)) throw new Error('not a handover');
      incoming = doc;
      matches = doc.students.map(hs => { const m = findMine(hs); const have = new Set((m?.student.observations || []).map(o => o.id));
        return { hs, m, fresh: (hs.observations || []).filter(o => o && o.id && !have.has(o.id)) }; });
      draw();
    } catch { incoming = null; draw('That file is not a Co-Cher handover.'); }
  }

  function preview() {
    const found = matches.filter(x => x.m), missing = matches.filter(x => !x.m);
    const fresh = found.reduce((n, x) => n + x.fresh.length, 0);
    return `<p class="v3-row-t">From ${esc(incoming.from?.name || 'a colleague')}: ${esc(incoming.class?.name || 'a class')}</p>
      <p class="v3-row-s">${plural(found.length, 'student')} found in your classes, ${plural(fresh, 'new observation')}${missing.length ? `. Not in your classes: ${missing.map(x => esc(x.hs.name)).join(', ')}` : ''}</p>
      ${fresh ? `<button class="btn btn-primary" id="ho-add" style="margin-top:12px;">Add to my records</button>` : '<p class="v3-row-s" style="margin-top:8px;">Nothing new to add: you already hold these.</p>'}`;
  }

  function take() {
    const from = incoming.from?.name || 'a colleague';
    let n = 0, kids = 0;
    matches.forEach(({ m, fresh }) => {
      if (!m || !fresh.length) return;
      Store.updateStudent(m.cls.id, m.student.id, { observations: fresh.map(o => ({ ...o, from, text: `${o.text || ''} (from ${from})` })) });
      n += fresh.length; kids++;
    });
    incoming = null; matches = [];
    draw(`Added ${plural(n, 'observation')} on ${plural(kids, 'student')}. They show on each student’s profile.`);
  }

  draw();
}


/* ══════════ Send to a colleague ══════════ */

const SEND_KIND = 'cocher-send';
const who = () => { const u = getCurrentUser() || {}; return getPreferredName() || u.name || u.email || 'A colleague'; };
const same = (a, b) => norm(a) === norm(b);

export function renderSend(container) {
  let incoming = null;           // { doc, pack: { summary, apply } | null, entries, goals }

  const groups = () => [
    { key: 'lessons', label: 'Lessons', items: Store.getLessons().map(l => ({ id: l.id, t: l.title || 'Untitled lesson', s: Store.getClass(l.classId)?.name || '' })) },
    { key: 'layouts', label: 'Room layouts', items: Store.getSavedLayouts().map(l => ({ id: l.id, t: l.name || 'Untitled layout', s: '' })) },
    { key: 'entries', label: 'Entries', items: allEntries().filter(e => !e.done).map(e => ({ id: e.id, t: e.title || 'Untitled entry', s: [(KINDS[e.kind] || KINDS.other).label, e.date].filter(Boolean).join(', ') })) },
    { key: 'goals', label: 'Term goals', items: allGoals().map(g => ({ id: g.id, t: g.title, s: g.note || '' })) },
  ];

  function draw(note = '') {
    const gs = groups(); const any = gs.some(g => g.items.length);
    container.innerHTML = `<div class="main-scroll"><div class="v3-page">
      <div class="v3-head"><div><div class="v3-eyebrow">With colleagues</div><h1 class="v3-title">Send to a colleague</h1>
        <p class="v3-lede">Tick what to send. You get one file to pass on; your colleague loads it here and it joins their own work</p></div></div>
      <div class="v3-grid">
        <div class="v3-col-7"><div class="v3-panel">
          <div class="v3-h">Send <span id="sd-count" class="v3-row-s"></span></div>
          ${any ? gs.filter(g => g.items.length).map((g, i) => `<details class="v3-pick"${i === 0 ? ' open' : ''}>
              <summary><b>${g.label}</b><span data-n="${g.key}">${g.items.length}</span></summary>
              ${g.items.map(x => `<label><input type="checkbox" data-g="${g.key}" value="${esc(x.id)}"><span><span class="t">${esc(x.t)}</span>${x.s ? `<span class="s">${esc(x.s)}</span>` : ''}</span></label>`).join('')}
            </details>`).join('') + `<button class="btn btn-primary" id="sd-send" style="margin-top:16px;" disabled>Download the file</button>
            <p class="v3-row-s" style="margin-top:12px;">No student data goes in this file. A lesson leaves its class behind; your reflections stay with you.</p>`
          : '<p class="v3-empty">Nothing to send yet. Lessons, room layouts, entries and term goals show here once you have some.</p>'}
        </div></div>
        <div class="v3-col-5"><div class="v3-panel">
          <div class="v3-h">Receive</div>
          <input type="file" id="sd-file" accept=".json,application/json" hidden>
          <button class="btn btn-secondary" id="sd-pick">Load a file from a colleague</button>
          <div id="sd-in" style="margin-top:12px;">${note ? `<p class="v3-row-t">${esc(note)}</p>` : ''}${incoming ? preview() : ''}</div>
        </div></div>
      </div></div></div>`;
    const picked = () => [...container.querySelectorAll('input[data-g]:checked')];
    container.querySelectorAll('input[data-g]').forEach(i => i.addEventListener('change', () => {
      const n = picked().length;
      container.querySelector('#sd-send').disabled = !n;
      container.querySelector('#sd-count').textContent = n ? `${n} chosen` : '';
    }));
    container.querySelector('#sd-send')?.addEventListener('click', () => send(picked()));
    container.querySelector('#sd-pick').addEventListener('click', () => container.querySelector('#sd-file').click());
    container.querySelector('#sd-file').addEventListener('change', load);
    container.querySelector('#sd-add')?.addEventListener('click', take);
  }

  async function send(boxes) {
    const ids = (g) => new Set(boxes.filter(b => b.dataset.g === g).map(b => b.value));
    const L = ids('lessons'), Y = ids('layouts'), E = ids('entries'), G = ids('goals');
    const lessons = Store.getLessons().filter(l => L.has(l.id)), layouts = Store.getSavedLayouts().filter(l => Y.has(l.id));
    const pack = (lessons.length || layouts.length) ? await exportPack({ title: `From ${who()}`, lessons, layouts, download: false }) : null;
    const doc = { kind: SEND_KIND, v: 1, at: Date.now(), from: { name: who() }, pack,
      // an entry's links to a class or a lesson are local, so they stay behind; its goal comes along if the goal does
      entries: allEntries().filter(e => E.has(e.id)).map(e => ({ kind: e.kind, title: e.title, date: e.date || '', goalId: G.has(e.goalId) ? e.goalId : '' })),
      goals: allGoals().filter(g => G.has(g.id)).map(g => ({ id: g.id, title: g.title, note: g.note || '' })) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(doc)], { type: 'application/json' }));
    a.download = `from ${who()} ${ymd(new Date())}.cocher.json`.replace(/[\\/:*?"<>|]/g, ' ');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast(`${plural(boxes.length, 'item')} in the file`, 'success');
  }

  async function load(ev) {
    const f = ev.target.files[0]; if (!f) return;
    try {
      let doc = JSON.parse(await f.text());
      if (doc?.deptpack) doc = { kind: SEND_KIND, from: doc.sharedBy, pack: doc, entries: [], goals: [] };   // a Department Pack is welcome too
      if (doc?.kind !== SEND_KIND) throw new Error('not ours');
      const mine = allEntries(), goals = allGoals();
      // what the pack would really add: the same title from the same author is already held
      const by = doc.pack?.sharedBy?.name || 'A colleague';
      const held = (list, name) => (x) => !list.some(m => same(m[name] || m.title, x[name] || x.title) && same(m.sharedBy, by));
      const fresh = doc.pack ? { lessons: (doc.pack.items?.lessons || []).filter(held(Store.getLessons(), 'title')).length,
        layouts: (doc.pack.items?.layouts || []).filter(held(Store.getSavedLayouts(), 'name')).length } : { lessons: 0, layouts: 0 };
      incoming = { doc, fresh, pack: doc.pack ? importPack(doc.pack) : null,
        entries: (doc.entries || []).filter(e => e && e.title && !mine.some(m => same(m.title, e.title) && (m.date || '') === (e.date || ''))),
        goals: (doc.goals || []).filter(g => g && g.title && !goals.some(m => same(m.title, g.title))) };
      draw();
    } catch { incoming = null; draw('That file is not from Co-Cher, or it is empty.'); }
  }

  function preview() {
    const { doc, fresh, entries, goals } = incoming;
    const parts = [fresh.lessons ? plural(fresh.lessons, 'lesson') : '', fresh.layouts ? plural(fresh.layouts, 'room layout') : '', entries.length ? plural(entries.length, 'entry').replace('entrys', 'entries') : '', goals.length ? plural(goals.length, 'term goal') : ''].filter(Boolean);
    return `<p class="v3-row-t">From ${esc(doc.from?.name || 'a colleague')}</p>
      ${parts.length ? `<p class="v3-row-s">${esc(parts.join(', '))}. Lessons arrive as drafts. Anything you already hold is skipped.</p>
        <button class="btn btn-primary" id="sd-add" style="margin-top:12px;">Add to my work</button>`
      : '<p class="v3-row-s">Nothing new to add: you already hold these.</p>'}`;
  }

  function take() {
    const { doc, pack, entries, goals } = incoming; const from = doc.from?.name || 'a colleague';
    const done = [];
    if (pack) { const r = pack.apply(); done.push(r.addedTotal ? r.breakdown : ''); if (r.skipped) done.push(`${r.skipped} already held`); }
    const goalIds = {};
    if (goals.length) {
      Store.set('goals', [...allGoals(), ...goals.map(g => { const id = generateId(); goalIds[g.id] = id; return { id, title: g.title, note: g.note || '', done: false, createdAt: Date.now(), from }; })]);
      done.push(plural(goals.length, 'term goal'));
    }
    // a goal the receiver already holds keeps its entries linked to it
    (doc.goals || []).forEach(g => { if (!goalIds[g.id]) { const m = allGoals().find(x => same(x.title, g.title)); if (m) goalIds[g.id] = m.id; } });
    entries.forEach(e => addEntry({ kind: KINDS[e.kind] ? e.kind : 'other', title: e.title, date: e.date || '', goalId: goalIds[e.goalId] || '', from }));
    if (entries.length) done.push(plural(entries.length, 'entry').replace('entrys', 'entries'));
    incoming = null;
    draw(`Added: ${done.filter(Boolean).join(', ') || 'nothing new'}.`);
  }

  draw();
}
