/*
 * Student profile
 * ===============
 * One child, read as one person: their E21CC levels in every class the
 * teacher holds, growth over time, the evidence behind it (observations from
 * lessons and remarks), who teaches them what (Student Finder, if loaded), and
 * the pathway they are working towards (a Paths share link, if pasted).
 *
 * Everything shown is already on this device. Nothing is invented: each empty
 * section says what would fill it.
 */

import { Store } from '../state.js';
import { openModal } from './modals.js';
import { escapeHtml as esc } from '../utils/markdown.js';
import { E21CC_LEVELS } from '../utils/tracking.js';
import { COMPETENCIES, VERDICTS, competencyLabel, sameChild, evidenceFor, decodePathsLink, describePaths, pathsOpenUrl } from '../utils/evidence.js';
import { loadDataset, buildIndex, studentKey, subjectsOf } from '../utils/student-finder.js';

const LV = Object.fromEntries(E21CC_LEVELS.map(l => [l.key, l]));
const fmt = ts => new Date(ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

function injectStyles() {
  if (document.getElementById('sp-styles')) return;
  const st = document.createElement('style');
  st.id = 'sp-styles';
  st.textContent = `
    .sp-meta { font-size:.82rem; color:var(--ink-muted); margin:-4px 0 12px; }
    .sp-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
    .sp-chip { padding:3px 10px; border-radius:999px; background:var(--bg-subtle, #f3f4f6); font-size:.75rem; color:var(--ink-secondary); text-decoration:none; }
    .sp-grid { display:grid; grid-template-columns:1.25fr 1fr; gap:16px; }
    @media (max-width:760px) { .sp-grid { grid-template-columns:1fr; } }
    .sp-sec { border:1px solid var(--border-light, #e5e7eb); border-radius:12px; padding:12px 14px; background:var(--bg-card, #fff); }
    .sp-sec + .sp-sec { margin-top:12px; }
    .sp-h { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-faint, #94a3b8); margin:0 0 8px; }
    .sp-row { display:grid; grid-template-columns:132px 1fr 74px 52px; align-items:center; gap:8px; padding:6px 0; border-top:1px solid var(--border-light, #f1f5f9); font-size:.82rem; }
    .sp-row:first-of-type { border-top:0; }
    .sp-pill { display:inline-block; padding:2px 8px; border-radius:6px; font-size:.72rem; font-weight:700; margin-right:4px; }
    .sp-ev { font-size:.72rem; color:var(--ink-muted); text-align:right; white-space:nowrap; }
    .sp-item { display:flex; gap:10px; padding:7px 0; border-top:1px solid var(--border-light, #f1f5f9); font-size:.8rem; line-height:1.4; }
    .sp-item:first-of-type { border-top:0; }
    .sp-item .ic { flex-shrink:0; width:22px; height:22px; border-radius:50%; color:#fff; display:flex; align-items:center; justify-content:center; font-size:.75rem; font-weight:800; }
    .sp-item .when { color:var(--ink-faint); font-size:.72rem; }
    .sp-empty { font-size:.8rem; color:var(--ink-muted); line-height:1.5; }
    .sp-table { width:100%; border-collapse:collapse; font-size:.8rem; }
    .sp-table td { padding:4px 0; border-top:1px solid var(--border-light, #f1f5f9); }
    .sp-path { font-size:.85rem; line-height:1.55; }
    .sp-path strong { color:var(--ink); }
  `;
  document.head.appendChild(st);
}

/* Tiny line of a competency's level over time (1 to 4). */
function spark(points) {
  if (points.length < 2) return '<span class="sp-ev">no trend yet</span>';
  const w = 74, h = 22, n = points.length;
  const xy = points.map((v, i) => `${(i / (n - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v - 1) / 3 * (h - 6)).toFixed(1)}`);
  const last = points[n - 1], first = points[0];
  const col = last > first ? '#2c7a4b' : last < first ? '#c2410c' : '#64748b';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="trend"><polyline points="${xy.join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${xy[n - 1].split(',')[0]}" cy="${xy[n - 1].split(',')[1]}" r="2.6" fill="${col}"/></svg>`;
}

export function openStudentProfile(classId, studentId) {
  injectStyles();
  const cls = Store.getClass(classId);
  const student = cls?.students?.find(s => s.id === studentId);
  if (!cls || !student) return;

  const { backdrop, close } = openModal({
    title: esc(student.name),
    width: 860,
    body: '<div id="sp-body"></div>',
  });
  const body = backdrop.querySelector('#sp-body');
  let finder = null;                  // Student Finder lookup, loaded once

  loadDataset().then(d => {
    if (!d) { finder = { none: true }; draw(); return; }
    const idx = buildIndex(d);
    const s = idx.students.get(student.sfKey || '') || [...idx.students.values()].find(x => norm(x.name) === norm(student.name) && (!student.formClass || x.formClass === student.formClass));
    finder = s ? { student: s } : { missing: true };
    draw();
  }).catch(() => { finder = { none: true }; draw(); });

  function draw() {
    const fresh = Store.getClass(classId)?.students?.find(s => s.id === studentId) || student;
    const records = sameChild(Store.getClass(classId), fresh);
    const evidence = evidenceFor(records);
    const history = records.flatMap(r => r.student.e21ccHistory || []).sort((a, b) => a.ts - b.ts);
    const pathsRec = records.map(r => r.student).find(s => s.pathsLink);
    const paths = pathsRec ? decodePathsLink(pathsRec.pathsLink) : null;
    const p = describePaths(paths);
    const f = finder?.student || null;
    const formClass = fresh.formClass || f?.formClass || '';
    const index = fresh.index || f?.index || '';

    body.innerHTML = `
      <div class="sp-meta">${[formClass && `Form class ${esc(formClass)}`, index && `Register no. ${esc(index)}`, `${records.length} of your class${records.length === 1 ? '' : 'es'}`].filter(Boolean).join(' &middot; ')}</div>
      <div class="sp-chips">${records.map(r => `<a class="sp-chip" href="#/classes/${esc(r.cls.id)}" data-close>${esc(r.cls.name)}</a>`).join('')}</div>
      <div class="sp-grid">
        <div>
          <div class="sp-sec">
            <div class="sp-h">E21CC now, over time, and the evidence</div>
            ${COMPETENCIES.map(c => {
              const perClass = records.map(r => ({ k: r.student.e21cc?.[c.key], cls: r.cls })).filter(x => x.k);
              const levels = [...new Set(perClass.map(x => x.k))];
              const label = (k) => { const where = perClass.filter(x => x.k === k).map(x => x.cls.name.replace(/^\S+\s+/, '') || x.cls.name); return levels.length > 1 ? ` <span style="font-weight:500;opacity:.75;">${esc(where.join(', '))}</span>` : ''; };
              const pts = history.map(h => LV[h[c.key]]?.value).filter(Boolean);
              const ev = evidence.filter(o => o.competency === c.key);
              const showed = ev.filter(o => o.verdict === 'showed').length, towards = ev.filter(o => o.verdict === 'towards').length;
              return `<div class="sp-row">
                <span>${esc(c.label)}</span>
                <span>${levels.length ? levels.map(k => `<span class="sp-pill" title="${esc(perClass.filter(x => x.k === k).map(x => x.cls.name).join(', '))}" style="background:${LV[k]?.color}1f;color:${LV[k]?.color};">${esc(LV[k]?.label || k)}${label(k)}</span>`).join('') : '<span class="sp-ev">not set</span>'}</span>
                ${spark(pts)}
                <span class="sp-ev" title="Showed it / working towards it">${showed || towards ? `${showed ? '✓' + showed : ''} ${towards ? '↗' + towards : ''}` : '&middot;'}</span>
              </div>`;
            }).join('')}
          </div>
          <div class="sp-sec">
            <div class="sp-h">Evidence (${evidence.length})</div>
            ${evidence.length ? evidence.slice(0, 10).map(o => {
              const v = VERDICTS[o.verdict];
              const lesson = o.lessonId ? Store.getLesson?.(o.lessonId) : null;
              return `<div class="sp-item">
                <span class="ic" style="background:${v ? v.color : '#64748b'};">${v ? v.icon : '✎'}</span>
                <span>${esc(o.text || '')}<br><span class="when">${o.ts ? fmt(o.ts) : ''} &middot; ${esc(o._class?.name || '')}${lesson ? ` &middot; <a href="#/lessons/${esc(lesson.id)}" data-close>${esc(lesson.title)}</a>` : ''}</span></span>
              </div>`;
            }).join('') + (evidence.length > 10 ? `<div class="sp-empty">and ${evidence.length - 10} more.</div>` : '')
            : '<div class="sp-empty">No evidence yet. Press O in Present to note what you see during a lesson, or add a Remark from the class page.</div>'}
          </div>
        </div>
        <div>
          <div class="sp-sec">
            <div class="sp-h">Pathway</div>
            ${p ? `<div class="sp-path">
                <strong>${esc(p.goal || 'No goal set yet')}</strong>${p.sector ? `<br>${esc(p.sector)}` : ''}
                <br>${esc(p.year)} plan &middot; ${esc(p.subjects)}
                <br><span class="when" style="font-size:.72rem;color:var(--ink-faint);">From the student’s Paths link${pathsRec.pathsAt ? ', added ' + fmt(pathsRec.pathsAt) : ''}</span>
              </div>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <a class="btn btn-sm btn-primary" href="${esc(pathsOpenUrl(paths.d))}" target="_blank" rel="noopener">Open in Paths</a>
                <button class="btn btn-sm btn-ghost" data-act="paths-remove">Remove</button>
              </div>`
            : `<div class="sp-empty" style="margin-bottom:8px;">Ask the student to share their plan from Paths (Share, then A teacher), and paste the link here. It carries their year, subject levels and goal, never their name.</div>
              <input class="input" id="sp-paths" placeholder="Paste the Paths link" style="width:100%;box-sizing:border-box;" autocomplete="off">
              <div class="sp-empty" id="sp-paths-msg" style="margin-top:6px;"></div>
              <button class="btn btn-sm btn-primary" data-act="paths-save" style="margin-top:6px;">Add pathway</button>`}
          </div>
          <div class="sp-sec">
            <div class="sp-h">Subjects and teachers</div>
            ${!finder ? '<div class="sp-empty">Looking&hellip;</div>'
              : f ? `<table class="sp-table">${subjectsOf(f).map(x => `<tr><td>${esc(x.subject)}${x.stream ? ` <span class="sp-ev">${esc(x.stream)}</span>` : ''}</td><td style="text-align:right;">${esc(x.teacher)}</td></tr>`).join('')}</table>`
              : finder.none ? '<div class="sp-empty">Load the school timetable in Admin, Student Finder, to see who teaches them each subject.</div>'
              : '<div class="sp-empty">Not found in the loaded timetable.</div>'}
          </div>
        </div>
      </div>`;

    body.querySelectorAll('[data-close]').forEach(a => a.addEventListener('click', () => close()));
    body.querySelector('[data-act="paths-save"]')?.addEventListener('click', () => {
      const raw = body.querySelector('#sp-paths').value;
      const decoded = decodePathsLink(raw);
      if (!decoded) { body.querySelector('#sp-paths-msg').textContent = 'That does not look like a Paths share link.'; return; }
      records.forEach(r => Store.updateStudent(r.cls.id, r.student.id, { pathsLink: decoded.d, pathsAt: Date.now() }));
      draw();
    });
    body.querySelector('[data-act="paths-remove"]')?.addEventListener('click', () => {
      records.forEach(r => Store.updateStudent(r.cls.id, r.student.id, { pathsLink: '', pathsAt: 0 }));
      draw();
    });
  }

  draw();
}

/* Exposed for Student Finder links: a Student Finder student, opened in the first class that holds them. */
export function openProfileForFinderStudent(fs) {
  for (const c of Store.getClasses() || []) {
    const s = (c.students || []).find(x => x.sfKey === studentKey(fs) || (norm(x.name) === norm(fs.name) && (!x.formClass || x.formClass === fs.formClass)));
    if (s) { openStudentProfile(c.id, s.id); return true; }
  }
  return false;
}
