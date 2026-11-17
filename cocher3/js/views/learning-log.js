/*
 * Learning Log (E21CC)
 * ====================
 * The E21CC Learning Log, embedded live from genapp. Beatty only for now: the
 * Log's school offering is Beatty's (e21cclog/school/beatty.json).
 *
 * Co-Cher shows the Log; it never copies it, and never reads or writes its
 * storage (e21cclog, e21cclog.teacher). Because both sit on the same web
 * address, the Log holds the same data whether it is opened here or on its own.
 *
 * Views: Students (the student app), Teachers (the console), and the Demo
 * (made up people; nothing saved).
 */

import { escapeHtml } from '../utils/markdown.js';
import { getCurrentUser, currentSchoolId } from '../components/login.js';
import { mountEmbed, GENAPP } from '../components/app-embed.js';

const LOG = `${GENAPP}/e21cclog`;

const VIEWS = [
  {
    id: 'student',
    label: 'Students',
    title: 'E21CC Learning Log',
    src: `${LOG}/index.html`,
    note: 'What students use. Anything written here is kept on this device, in the Log.'
  },
  {
    id: 'teacher',
    label: 'Teachers (console)',
    title: 'Teacher console',
    src: `${LOG}/teacher.html`,
    note: 'Your console: entries your students send you, sealed by your PIN.'
  },
  {
    id: 'demo',
    label: 'Demo',
    title: 'Demo',
    note: 'Made up people for showing staff, students and parents. Nothing is saved; reloading starts it fresh.',
    parts: [
      { id: 'start', label: 'Start page', src: `${LOG}/demo/` },
      { id: 'student', label: 'Student demo', src: `${LOG}/demo/student/` },
      { id: 'teacher', label: 'Teacher demo', src: `${LOG}/demo/teacher/` }
    ]
  }
];

const PREF_KEY = 'cocher2_learninglog_view';

/* Legacy users have no schoolId; they predate the other schools (dashboard.js). */
export const learningLogOpen = () => currentSchoolId() === 'bty';

function readPref() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; }
}
function writePref(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

export function render(container) {
  if (!learningLogOpen()) {
    container.innerHTML = `
      <div class="main-scroll"><div class="page-container">
        <div class="page-header"><div>
          <h1 class="page-title">Learning Log</h1>
          <p class="page-subtitle">The E21CC Learning Log is open to Beatty for now.</p>
        </div></div>
      </div></div>`;
    return;
  }

  const pref = readPref();
  let view = VIEWS.some(v => v.id === pref.view) ? pref.view : 'student';
  let demoPart = pref.demoPart || 'start';
  let stop = null;

  function draw() {
    if (stop) { stop(); stop = null; }
    const v = VIEWS.find(x => x.id === view);
    const part = v.parts ? (v.parts.find(p => p.id === demoPart) || v.parts[0]) : null;

    container.innerHTML = `
      <div class="main-scroll">
        <style>
          .ll-switch { display:flex; gap:4px; padding:3px; width:fit-content; max-width:100%; flex-wrap:wrap;
                       border:1px solid var(--border-light, #e5e7eb); border-radius:999px; background:var(--bg-card, #fff); }
          .ll-btn { padding:6px 16px; border:0; border-radius:999px; background:transparent; font:inherit;
                    font-size:0.8125rem; font-weight:600; color:var(--ink-secondary, #666); cursor:pointer; }
          .ll-btn.active { background:var(--accent, #4361ee); color:#fff; }
          .ll-parts { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
          .ll-part { padding:4px 12px; border:1px solid var(--border-light, #e5e7eb); border-radius:999px;
                     background:transparent; font:inherit; font-size:0.75rem; font-weight:600;
                     color:var(--ink-secondary, #666); cursor:pointer; }
          .ll-part.active { border-color:var(--accent, #4361ee); color:var(--accent, #4361ee); }
        </style>
        <div class="page-container">
          <div class="page-header" style="margin-bottom:var(--sp-3);">
            <div>
              <h1 class="page-title">Learning Log</h1>
              <p class="page-subtitle">Students' own evidence for the E21CC you track in My Classes.</p>
            </div>
          </div>
          <div class="ll-switch" role="tablist" aria-label="Learning Log views">
            ${VIEWS.map(x => `<button class="ll-btn${x.id === view ? ' active' : ''}" data-view="${x.id}" role="tab" aria-selected="${x.id === view}">${escapeHtml(x.label)}</button>`).join('')}
          </div>
          ${v.parts ? `<div class="ll-parts">
            ${v.parts.map(p => `<button class="ll-part${p.id === part.id ? ' active' : ''}" data-part="${p.id}">${escapeHtml(p.label)}</button>`).join('')}
          </div>` : ''}
          <div id="ll-embed" style="margin-top:var(--sp-4);"></div>
        </div>
      </div>`;

    container.querySelectorAll('.ll-btn').forEach(b => b.addEventListener('click', () => {
      if (view === b.dataset.view) return;
      view = b.dataset.view;
      writePref({ view, demoPart });
      draw();
    }));
    container.querySelectorAll('.ll-part').forEach(b => b.addEventListener('click', () => {
      if (demoPart === b.dataset.part) return;
      demoPart = b.dataset.part;
      writePref({ view, demoPart });
      draw();
    }));

    stop = mountEmbed(container.querySelector('#ll-embed'), {
      src: part ? part.src : v.src,
      title: part ? `${v.title}: ${part.label}` : v.title,
      note: v.note
    });
  }

  draw();
  return () => { if (stop) stop(); };
}
