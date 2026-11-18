/*
 * Co-Cher 3: the teacher's own entries
 * ====================================
 * Things a teacher adds by hand to Now, Week and Term: a lesson to develop, a
 * paper to set, an admin task, anything else. Each entry can carry a date and
 * can be linked to what it is about (a class, a lesson, a screen), so the
 * entry is also the way in: "Plan it" opens the Lesson Planner with the title
 * ready, and once a lesson exists the entry follows that lesson's stage.
 *
 * Stored with the teacher's other work (Store key `agenda`), so it travels in
 * Settings, Data, Export.
 */

import { Store, generateId } from '../state.js';
import { openModal } from '../components/modals.js';
import { lessonStage, LIFECYCLE_STAGES } from '../views/lessons.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const KINDS = {
  lesson: { label: 'Lesson to develop', go: 'Plan it', route: '/lesson-planner' },
  assess: { label: 'Assessment to set or mark', go: 'Open Assess', route: '/assessment/aol' },
  admin: { label: 'Admin task', go: 'Open Admin', route: '/admin' },
  student: { label: 'Student follow up', go: 'Open class', route: '/classes' },
  other: { label: 'Something else', go: '', route: '' },
};

export const allEntries = () => (Store.get('agenda') || []).slice();
const save = (list) => Store.set('agenda', list);

/** Add an entry from elsewhere in Co-Cher (a free slot, say). */
export function addEntry(e) {
  save([...allEntries(), { kind: 'other', title: '', date: '', classId: '', lessonId: '', goalId: '', ...e, id: generateId(), done: false, createdAt: Date.now() }]);
}

export function entriesBetween(from, to) {          // inclusive 'YYYY-MM-DD' strings
  return allEntries().filter(e => e.date && e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}
/** For Now: due today, overdue and not done, and undated and not done. */
export function entriesForNow(today = ymd(new Date())) {
  return allEntries().filter(e => (e.date === today) || (!e.done && (!e.date || e.date < today)))
    .sort((a, b) => (a.done - b.done) || (a.date || '9').localeCompare(b.date || '9'));
}

function linkedLesson(e) { return e.lessonId ? Store.getLesson(e.lessonId) : null; }
function linkedClass(e) { return e.classId ? Store.getClass(e.classId) : null; }

/** Where an entry leads, and what the button says. */
function action(e) {
  const l = linkedLesson(e);
  if (l) {
    const stage = (LIFECYCLE_STAGES.find(s => s.key === lessonStage(l)) || {}).label || '';
    return { href: `#/lessons/${l.id}`, label: 'Open lesson', note: `${l.title}${stage ? ', at ' + stage.toLowerCase() : ''}` };
  }
  const c = linkedClass(e);
  if (e.kind === 'student' && c) return { href: `#/classes/${c.id}`, label: 'Open class', note: c.name };
  const k = KINDS[e.kind] || KINDS.other;
  if (e.kind === 'lesson') return { plan: true, label: k.go, note: c ? `For ${c.name}` : '' };
  return k.route ? { href: `#${k.route}`, label: k.go, note: c ? c.name : '' } : { note: c ? c.name : '' };
}

const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });

/** One entry as a row. `compact` is for the narrow day columns of Week. */
export function entryHTML(e, { compact = false, today = ymd(new Date()) } = {}) {
  const a = action(e);
  const late = !e.done && e.date && e.date < today;
  const meta = [compact ? '' : (KINDS[e.kind] || KINDS.other).label, !compact && e.date ? (late ? `Was due ${fmtDate(e.date)}` : fmtDate(e.date)) : '', a.note].filter(Boolean).join(' · ');
  return `<div class="v3-entry${e.done ? ' done' : ''}${compact ? ' compact' : ''}" data-entry="${esc(e.id)}">
    <button class="tick" data-entry-act="toggle" aria-pressed="${!!e.done}" aria-label="${e.done ? 'Mark as not done' : 'Mark as done'}: ${esc(e.title)}"></button>
    <button class="body" data-entry-act="edit" title="Edit this entry"><span class="t">${esc(e.title)}</span>${meta ? `<span class="s${late ? ' late' : ''}">${esc(meta)}</span>` : ''}</button>
    ${a.label && !e.done ? (a.plan
      ? `<button class="go" data-entry-act="plan">${esc(a.label)} →</button>`
      : `<a class="go" href="${a.href}">${esc(a.label)} →</a>`) : ''}
  </div>`;
}

/** Wire the rows inside `root`. `redraw` runs after any change. */
export function wireEntries(root, redraw) {
  root.querySelectorAll('[data-entry-act]').forEach(b => b.addEventListener('click', () => {
    const id = b.closest('[data-entry]').dataset.entry;
    const list = allEntries();
    const e = list.find(x => x.id === id);
    if (!e) return;
    if (b.dataset.entryAct === 'toggle') { e.done = !e.done; save(list); redraw(); }
    if (b.dataset.entryAct === 'edit') openEntry(e, redraw);
    if (b.dataset.entryAct === 'plan') planFrom(e);
  }));
  root.querySelectorAll('[data-add-entry]').forEach(b => b.addEventListener('click', () => openEntry({ date: b.dataset.addEntry || '' }, redraw)));
}

/* Open the Lesson Planner with the entry's title ready in the box. The teacher
 * still presses send; when the lesson is saved, link it from the entry. */
function planFrom(e) {
  const c = linkedClass(e);
  location.hash = '#/lesson-planner';
  let tries = 0;
  const fill = () => {
    const box = document.getElementById('chat-input');
    if (box) { if (!box.value) { box.value = `Plan a lesson on ${e.title}${c ? ` for ${c.name}` : ''}`; box.dispatchEvent(new Event('input', { bubbles: true })); box.focus(); } return; }
    if (tries++ < 40) setTimeout(fill, 100);
  };
  setTimeout(fill, 150);
}

/** Add or edit an entry. */
export function openEntry(entry, redraw) {
  const isNew = !entry.id;
  const e = { kind: 'lesson', title: '', date: '', classId: '', lessonId: '', goalId: '', ...entry };
  const goals = (Store.get('goals') || []).filter(g => !g.done || g.id === e.goalId);
  const classes = Store.getClasses();
  const lessons = Store.getLessons();
  const { backdrop, close } = openModal({
    title: isNew ? 'Add an Entry' : 'Edit Entry',
    width: 480,
    body: `
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div><label class="input-label" for="ag-title">What needs doing</label>
          <input class="input" id="ag-title" maxlength="140" value="${esc(e.title)}" placeholder="Topic or task, and the class" autocomplete="off"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div><label class="input-label" for="ag-kind">Kind</label>
            <select class="input" id="ag-kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}"${k === e.kind ? ' selected' : ''}>${v.label}</option>`).join('')}</select></div>
          <div><label class="input-label" for="ag-date">Day (optional)</label>
            <input class="input" id="ag-date" type="date" value="${esc(e.date)}"></div>
        </div>
        <div><label class="input-label" for="ag-class">Class (optional)</label>
          <select class="input" id="ag-class"><option value="">None</option>${classes.map(c => `<option value="${esc(c.id)}"${c.id === e.classId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        ${goals.length ? `<div><label class="input-label" for="ag-goal">Towards a goal (optional)</label>
          <select class="input" id="ag-goal"><option value="">None</option>${goals.map(g => `<option value="${esc(g.id)}"${g.id === e.goalId ? ' selected' : ''}>${esc(g.title)}</option>`).join('')}</select></div>` : ''}
        <div id="ag-lesson-wrap"><label class="input-label" for="ag-lesson">Lesson (once it exists)</label>
          <select class="input" id="ag-lesson"><option value="">Not linked yet</option>${lessons.map(l => `<option value="${esc(l.id)}"${l.id === e.lessonId ? ' selected' : ''}>${esc(l.title)}</option>`).join('')}</select></div>
      </div>`,
    footer: `${isNew ? '' : '<button class="btn btn-ghost" data-act="del" style="margin-right:auto;color:var(--danger);">Delete</button>'}
      <button class="btn btn-secondary" data-act="cancel">Cancel</button>
      <button class="btn btn-primary" data-act="save">${isNew ? 'Add' : 'Save'}</button>`,
  });
  const q = (s) => backdrop.querySelector(s);
  const syncKind = () => { q('#ag-lesson-wrap').hidden = q('#ag-kind').value !== 'lesson'; };
  q('#ag-kind').addEventListener('change', syncKind); syncKind();
  setTimeout(() => q('#ag-title').focus(), 50);
  const commit = () => {
    const title = q('#ag-title').value.trim();
    if (!title) { q('#ag-title').focus(); return; }
    const kind = q('#ag-kind').value;
    const next = { ...e, title, kind, date: q('#ag-date').value || '', classId: q('#ag-class').value || '',
      lessonId: kind === 'lesson' ? (q('#ag-lesson').value || '') : '', goalId: q('#ag-goal')?.value || '' };
    const list = allEntries();
    if (isNew) list.push({ ...next, id: generateId(), done: false, createdAt: Date.now() });
    else { const i = list.findIndex(x => x.id === e.id); if (i >= 0) list[i] = next; }
    save(list); close(); redraw();
  };
  q('[data-act="save"]').addEventListener('click', commit);
  q('#ag-title').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') commit(); });
  q('[data-act="cancel"]').addEventListener('click', close);
  q('[data-act="del"]')?.addEventListener('click', () => { save(allEntries().filter(x => x.id !== e.id)); close(); redraw(); });
}
