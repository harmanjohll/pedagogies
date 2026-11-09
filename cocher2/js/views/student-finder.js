/*
 * Student Finder (Admin One-Stop section)
 * =======================================
 * Find a student, see who teaches them, see a teacher's groups, and commit a
 * teaching group or form class to My Classes. Data comes from a timetable file
 * loaded on this device (see utils/student-finder.js for what is kept, where,
 * and why). Nothing here is invented: empty states say what is missing.
 */

import { Store, schoolKey } from '../state.js';
import { escapeHtml as esc } from '../utils/markdown.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modals.js';
import { getCurrentUser, getPreferredName } from '../components/login.js';
import {
  FIELDS, readFile, loadDataset, addFile, removeFile, clearDataset, buildIndex,
  searchStudents, subjectsOf, lessonsOn, lessonsNow, linkedClass, commitGroup,
  demoRows, rowsToCSV, normName,
} from '../utils/student-finder.js';

const ME_KEY = () => schoolKey('cocher2_sf_me');
const DEMO_FILE = 'Demo timetable (made up students)';

function getMe() { try { return localStorage.getItem(ME_KEY()) || ''; } catch { return ''; } }
function setMe(v) { try { v ? localStorage.setItem(ME_KEY(), v) : localStorage.removeItem(ME_KEY()); } catch { /* private mode */ } }

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : /(s|sh|ch|x)$/.test(w) ? 'es' : 's'}`;
const fmtDate = ts => new Date(ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
const slotText = g => g.slots.slice(0, 4).map(s => `${s.day.slice(0, 3)}${s.week ? ' (' + s.week + ')' : ''} ${s.start}`).join(', ') + (g.slots.length > 4 ? ` +${g.slots.length - 4}` : '');

function injectStyles() {
  if (document.getElementById('sf-styles')) return;
  const st = document.createElement('style');
  st.id = 'sf-styles';
  st.textContent = `
    .sf-lead { font-size:0.8125rem; color:var(--ink-muted); margin:0 0 var(--sp-3); line-height:1.6; }
    .sf-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
    .sf-summary { display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:var(--sp-3); }
    .sf-stats { font-weight:700; font-size:0.875rem; color:var(--ink); }
    .sf-files { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
    .sf-chip { display:inline-flex; gap:6px; align-items:center; padding:2px 4px 2px 10px; border-radius:999px; background:var(--bg-subtle, #f3f4f6); font-size:0.75rem; color:var(--ink-secondary); }
    .sf-chip button { border:0; background:transparent; cursor:pointer; color:var(--ink-faint); font-size:0.875rem; padding:0 4px; }
    .sf-note { font-size:0.75rem; color:var(--ink-faint); margin-top:4px; }
    .sf-tabs { display:flex; gap:4px; border-bottom:1px solid var(--border-light, #e5e7eb); margin:var(--sp-3) 0; }
    .sf-tab { padding:8px 12px; border:0; background:transparent; font:inherit; font-size:0.8125rem; font-weight:600; color:var(--ink-secondary); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
    .sf-tab.active { color:var(--accent); border-bottom-color:var(--accent); }
    .sf-label { display:block; font-size:0.6875rem; font-weight:600; color:var(--ink-secondary); margin-bottom:3px; text-transform:uppercase; letter-spacing:0.03em; }
    .sf-results { display:flex; flex-direction:column; gap:2px; margin-top:8px; max-height:280px; overflow:auto; }
    .sf-result { text-align:left; padding:6px 10px; border:0; border-radius:8px; background:transparent; font:inherit; font-size:0.8125rem; cursor:pointer; color:var(--ink); }
    .sf-result:hover, .sf-result.active { background:var(--accent-light, rgba(67,97,238,0.08)); }
    .sf-result span { color:var(--ink-muted); }
    .sf-panel { border:1px solid var(--border); border-radius:10px; padding:var(--sp-3) var(--sp-4); margin-top:var(--sp-3); background:var(--bg-card); }
    .sf-panel h4 { margin:0 0 2px; font-size:0.9375rem; }
    .sf-sub { font-size:0.6875rem; font-weight:600; text-transform:uppercase; letter-spacing:0.03em; color:var(--ink-faint); margin:10px 0 4px; }
    .sf-table { width:100%; border-collapse:collapse; font-size:0.8125rem; }
    .sf-table td { padding:4px 6px; border-top:1px solid var(--border-light, #eee); vertical-align:top; }
    .sf-group { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center; padding:10px 0; border-top:1px solid var(--border-light, #eee); }
    .sf-group:first-child { border-top:0; }
    .sf-meta { font-size:0.75rem; color:var(--ink-muted); margin-top:2px; }
    .sf-linked { font-size:0.75rem; color:var(--success, #16a34a); font-weight:600; }
    .sf-names { font-size:0.75rem; color:var(--ink-secondary); line-height:1.6; width:100%; }
    .sf-now { font-weight:700; color:var(--ink); }
  `;
  document.head.appendChild(st);
}

export function renderStudentFinder(host) {
  injectStyles();
  let dataset = null, index = null;
  let tab = 'students';
  let query = '', selectedKey = '', teacherSel = '', formSel = '';
  const open = new Set();          // group keys whose student list is shown

  host.innerHTML = `
    <div class="section-header">
      <span class="section-title">Student Finder</span>
      <span class="badge badge-gray">On this device</span>
    </div>
    <div class="card" style="padding:var(--sp-4);">
      <input type="file" id="sf-file" accept=".csv,.xlsx,.xls" multiple hidden>
      <div id="sf-body"><p class="sf-lead">Loading&hellip;</p></div>
    </div>`;
  const body = host.querySelector('#sf-body');
  const fileInput = host.querySelector('#sf-file');

  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = '';
    for (const f of files) {
      try {
        const { rows, ignored } = await readFile(f);
        dataset = await addFile(f.name, rows, ignored);
        showToast(`${f.name}: ${plural(rows.length, 'row')} loaded${ignored.length ? `, ${ignored.length} column${ignored.length === 1 ? '' : 's'} left out` : ''}.`, 'success', 3500);
      } catch (e) {
        showToast(`${f.name}: ${e.message}`, 'error', 5000);
      }
    }
    refresh();
  });

  async function start() {
    dataset = await loadDataset();
    refresh();
  }

  function refresh() {
    index = dataset ? buildIndex(dataset) : null;
    draw();
  }

  /* ── Empty state ── */
  function drawEmpty() {
    const keep = Object.values(FIELDS);
    body.innerHTML = `
      <p class="sf-lead">Load your school's student timetable (one row per student per lesson) to find a student, see who teaches whom, and commit classes to My Classes.</p>
      <p class="sf-lead"><strong>The file stays on this device.</strong> It is never uploaded and is not part of Settings exports. Only these columns are kept: ${keep.filter(f => f.required).map(f => f.label).join(', ')}; and, if present, ${keep.filter(f => !f.required).map(f => f.label).join(', ')}. Anything else in the file, such as remarks, is left out.</p>
      <div class="sf-actions">
        <button class="btn btn-primary btn-sm" data-act="load">Load timetable file</button>
        <button class="btn btn-ghost btn-sm" data-act="demo">Try with demo data</button>
        <button class="btn btn-ghost btn-sm" data-act="template">Download demo file</button>
      </div>`;
  }

  /* ── Loaded ── */
  function draw() {
    if (!index) { drawEmpty(); return wire(); }
    const ignored = [...new Set(dataset.files.flatMap(f => f.ignored || []))];
    body.innerHTML = `
      <div class="sf-summary">
        <div>
          <div class="sf-stats">${plural(index.students.size, 'student')} · ${plural(index.teachers.size, 'teacher')} · ${plural(index.groups.length, 'teaching group')} · ${plural(index.formClasses.size, 'form class')}</div>
          <div class="sf-files">${dataset.files.map(f => `<span class="sf-chip">${esc(f.name)} · ${plural(f.rows.length, 'row')} · ${fmtDate(f.at)}<button data-remove="${esc(f.name)}" title="Remove this file from this device" aria-label="Remove ${esc(f.name)}">&times;</button></span>`).join('')}</div>
          ${ignored.length ? `<div class="sf-note">Left out, as the file was read: ${ignored.map(esc).join(', ')}.</div>` : ''}
          ${!index.hasIndex ? `<div class="sf-note">No register numbers in the file, so students are matched by form class and name.</div>` : ''}
        </div>
        <div class="sf-actions">
          <button class="btn btn-ghost btn-sm" data-act="load">Add file</button>
          <button class="btn btn-ghost btn-sm" data-act="clear" style="color:var(--danger);">Clear from this device</button>
        </div>
      </div>
      <div class="sf-tabs" role="tablist">
        ${[['students', 'Students'], ['teachers', 'Teachers'], ['commit', 'Commit classes']].map(([id, l]) => `<button class="sf-tab${tab === id ? ' active' : ''}" data-tab="${id}" role="tab" aria-selected="${tab === id}">${l}</button>`).join('')}
      </div>
      <div id="sf-tab-body">${tab === 'students' ? studentsTab() : tab === 'teachers' ? teachersTab() : commitTab()}</div>`;
    wire();
  }

  /* Students: search, then who teaches them and where they are */
  function studentsTab() {
    const results = searchStudents(index, query);
    const sel = selectedKey ? index.students.get(selectedKey) : null;
    return `
      <label class="sf-label" for="sf-q">Find a student</label>
      <input id="sf-q" class="input" type="search" placeholder="Name, form class, or class/register number (3E2/14)" value="${esc(query)}" style="width:100%;box-sizing:border-box;" autocomplete="off">
      ${query && !results.length ? `<p class="sf-note">No student matches &ldquo;${esc(query)}&rdquo;.</p>` : ''}
      ${results.length ? `<div class="sf-results">${results.map(s => `<button class="sf-result${s.key === selectedKey ? ' active' : ''}" data-student="${esc(s.key)}">${esc(s.name)} <span>${esc(s.formClass)}${s.index ? ' / ' + esc(s.index) : ''}</span></button>`).join('')}</div>` : ''}
      ${sel ? studentPanel(sel) : ''}`;
  }

  function studentPanel(s) {
    const subs = subjectsOf(s);
    const now = lessonsNow(s);
    const today = lessonsOn(s);
    const inClasses = Store.getClasses().filter(c => (c.students || []).some(x => x.sfKey === s.key || (!x.sfKey && normName(x.name) === normName(s.name) && (!x.formClass || x.formClass === s.formClass))));
    return `
      <div class="sf-panel">
        <h4>${esc(s.name)}</h4>
        <div class="sf-meta">${esc(s.formClass)}${s.index ? ' · Register no. ' + esc(s.index) : ''}${s.level ? ' · ' + esc(s.level) : ''}</div>
        ${index.hasTimes ? `<div class="sf-sub">Now</div>
          <div class="sf-now">${now.length ? now.map(l => `${esc(l.subject)} with ${esc(l.teacher)}${l.venue ? ' · ' + esc(l.venue) : ''}${l.week ? ' (' + esc(l.week) + ' week)' : ''}`).join('<br>') : 'No lesson in the timetable right now.'}</div>` : ''}
        <div class="sf-sub">Subjects and teachers</div>
        <table class="sf-table">${subs.map(x => `<tr><td>${esc(x.subject)}${x.stream ? ' <span class="sf-meta">' + esc(x.stream) + '</span>' : ''}</td><td>${esc(x.teacher)}</td></tr>`).join('')}</table>
        ${index.hasTimes ? `<div class="sf-sub">Today</div>
          ${today.length ? `<table class="sf-table">${today.map(l => `<tr><td>${esc(l.start)}&ndash;${esc(l.end)}${l.week ? ' <span class="sf-meta">' + esc(l.week) + '</span>' : ''}</td><td>${esc(l.subject)}</td><td>${esc(l.teacher)}</td><td>${esc(l.venue || '')}</td></tr>`).join('')}</table>` : '<div class="sf-meta">No lessons today.</div>'}` : ''}
        <div class="sf-sub">In My Classes</div>
        <div class="sf-meta">${inClasses.length ? inClasses.map(c => `<a href="#/classes/${esc(c.id)}">${esc(c.name)}</a>`).join(', ') : 'Not in any of your classes yet. Commit a class to add them.'}</div>
      </div>`;
  }

  /* Teachers: pick one, see their groups */
  function teachersTab() {
    const names = [...index.teachers.keys()].sort((a, b) => a.localeCompare(b));
    const t = index.teachers.get(teacherSel);
    return `
      <label class="sf-label" for="sf-teacher">Teacher</label>
      <select id="sf-teacher" class="input" style="width:100%;box-sizing:border-box;">
        <option value="">Choose a teacher (${names.length})</option>
        ${names.map(n => `<option value="${esc(n)}"${n === teacherSel ? ' selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      ${t ? `<div class="sf-panel">${t.groups.map(groupRow).join('')}</div>` : ''}`;
  }

  /* Commit classes: your teaching groups, and form classes */
  function commitTab() {
    const me = getMe();
    const names = [...index.teachers.keys()].sort((a, b) => a.localeCompare(b));
    const mine = index.teachers.get(me);
    const fcs = [...index.formClasses.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const fc = index.formClasses.get(formSel);
    return `
      <p class="sf-lead">A committed class is an ordinary My Classes class: seating, E21CC tracking, lessons and assessment use it straight away. Committing again updates the same class. Nobody is doubled, and what you already hold on a student is kept.</p>
      <label class="sf-label" for="sf-me">Who are you in this timetable?</label>
      <select id="sf-me" class="input" style="width:100%;box-sizing:border-box;">
        <option value="">Choose your name as the timetable writes it</option>
        ${names.map(n => `<option value="${esc(n)}"${n === me ? ' selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      ${me && !mine ? `<p class="sf-note">${esc(me)} is not in the loaded file.</p>` : ''}
      ${mine ? `<div class="sf-sub">Your teaching groups</div><div class="sf-panel">${mine.groups.map(groupRow).join('')}</div>` : ''}
      <div class="sf-sub" style="margin-top:var(--sp-4);">Form classes</div>
      <select id="sf-form" class="input" style="width:100%;box-sizing:border-box;">
        <option value="">Choose a form class (${fcs.length})</option>
        ${fcs.map(n => `<option value="${esc(n)}"${n === formSel ? ' selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      ${fc ? `<div class="sf-panel">${groupRow(fc)}</div>` : ''}`;
  }

  function groupRow(g) {
    const cls = linkedClass(g);
    const isLinked = cls && cls.sf?.key === g.key;
    const status = isLinked
      ? `<span class="sf-linked">In My Classes: <a href="#/classes/${esc(cls.id)}">${esc(cls.name)}</a></span>`
      : cls ? `<span class="sf-meta">Will update your class &ldquo;${esc(cls.name)}&rdquo;</span>` : '';
    const meta = g.kind === 'teaching'
      ? `${esc(g.teacher)} · ${plural(g.students.length, 'student')}${g.slots.length ? ' · ' + esc(slotText(g)) : ''}`
      : `Form class · ${plural(g.students.length, 'student')}`;
    return `
      <div class="sf-group">
        <div>
          <strong>${esc(g.name)}</strong>
          <div class="sf-meta">${meta}</div>
          ${status}
        </div>
        <div class="sf-actions">
          <button class="btn btn-ghost btn-sm" data-toggle="${esc(g.key)}">${open.has(g.key) ? 'Hide students' : 'Students'}</button>
          <button class="btn btn-primary btn-sm" data-commit="${esc(g.key)}">${isLinked || cls ? 'Update class' : 'Commit class'}</button>
        </div>
        ${open.has(g.key) ? `<div class="sf-names">${g.students.map(s => `${esc(s.name)} <span class="sf-meta">${esc(s.formClass)}${s.index ? '/' + esc(s.index) : ''}</span>`).join(' · ')}</div>` : ''}
      </div>`;
  }

  const findGroup = key => index.groups.find(g => g.key === key) || [...index.formClasses.values()].find(f => f.key === key);

  /* ── Events ── */
  function wire() {
    body.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
    body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', async () => {
      dataset = await removeFile(b.dataset.remove);
      selectedKey = '';
      refresh();
    }));
    body.querySelectorAll('.sf-tab').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));

    const q = body.querySelector('#sf-q');
    if (q) {
      q.addEventListener('input', () => {
        query = q.value;
        const pos = q.selectionStart;
        draw();
        const again = body.querySelector('#sf-q');
        again.focus();
        try { again.setSelectionRange(pos, pos); } catch { /* search inputs in some browsers */ }
      });
    }
    body.querySelectorAll('[data-student]').forEach(b => b.addEventListener('click', () => { selectedKey = b.dataset.student; draw(); }));

    const ts = body.querySelector('#sf-teacher');
    if (ts) ts.addEventListener('change', () => { teacherSel = ts.value; draw(); });
    const me = body.querySelector('#sf-me');
    if (me) me.addEventListener('change', () => { setMe(me.value); draw(); });
    const fs = body.querySelector('#sf-form');
    if (fs) fs.addEventListener('change', () => { formSel = fs.value; draw(); });

    body.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.toggle;
      open.has(k) ? open.delete(k) : open.add(k);
      draw();
    }));
    body.querySelectorAll('[data-commit]').forEach(b => b.addEventListener('click', () => {
      const g = findGroup(b.dataset.commit);
      if (!g) return;
      const r = commitGroup(g);
      const parts = [`${r.created ? 'Committed' : 'Updated'} ${r.cls.name}`, plural(r.added, 'student') + ' added'];
      if (r.kept) parts.push(`${r.kept} already there, kept as they were`);
      if (r.notInGroup) parts.push(`${r.notInGroup} in the class not in this group (left in)`);
      showToast(parts.join(' · '), 'success', 5000);
      draw();
    }));
  }

  async function act(what) {
    if (what === 'load') return fileInput.click();
    if (what === 'demo') {
      const me = getPreferredName() || getCurrentUser()?.name || 'Demo Teacher';
      dataset = await addFile(DEMO_FILE, demoRows(me), [], { demo: true });
      setMe(me);
      tab = 'commit';
      showToast('Demo timetable loaded: made up students only.', 'success');
      return refresh();
    }
    if (what === 'template') {
      const csv = rowsToCSV(demoRows('Demo Teacher'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'student-finder-demo.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return;
    }
    if (what === 'clear') {
      const ok = await confirmDialog({
        title: 'Clear Student Finder from this device?',
        message: 'This removes the loaded timetable from this browser. Classes you have committed stay in My Classes.',
        confirmLabel: 'Clear',
      });
      if (!ok) return;
      await clearDataset();
      dataset = null; selectedKey = ''; query = '';
      refresh();
    }
  }

  start();
}
