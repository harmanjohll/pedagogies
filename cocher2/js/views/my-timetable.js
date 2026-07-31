/*
 * Co-Cher 2 — My Timetable (#/my-timetable)
 * =========================================
 * The teacher's own week, rendered from canonical entries (real clock times),
 * so it works identically for a primary school with 30-minute slots and no week
 * cycle, a secondary with 35-minute slots and Odd/Even, and a JC running to 6pm.
 *
 * Non-teaching blocks are shown, not hidden: duty, PD and school-wide items
 * occupy the day as much as lessons do, and a timetable that omitted them would
 * mislead. They are tinted differently so the teaching load still reads at a
 * glance.
 */

import { getCurrentUser } from '../components/login.js';
import { escapeHtml } from '../utils/markdown.js';
import { getMyTimetable, nowNext, rangeLabel, myClassCodes } from '../utils/timetable.js';
import { weekCycle, cycleForDate, schoolName } from '../utils/school.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const KIND = {
  lesson: { label: 'Lesson', bg: 'var(--accent-light,#eef2ff)', fg: 'var(--accent-dark,#4338ca)', bd: 'var(--accent,#4361ee)' },
  duty:   { label: 'Duty',   bg: '#fef3c7', fg: '#92400e', bd: '#f59e0b' },
  pd:     { label: 'PD',     bg: '#ecfdf5', fg: '#065f46', bd: '#10b981' },
  school: { label: 'School', bg: '#f1f5f9', fg: '#334155', bd: '#94a3b8' },
};

export function render(container) {
  container.innerHTML = `<div class="main-scroll"><div class="page-container"><p style="color:var(--ink-muted);font-size:0.875rem;padding:24px 0;">Loading your timetable&hellip;</p></div></div>`;
  paintTimetable(container);
}

async function paintTimetable(container) {
  const user = getCurrentUser() || {};
  const doc = await getMyTimetable();
  const school = user.schoolId ? await schoolName(user.schoolId) : '';
  const cycleMode = user.schoolId ? await weekCycle(user.schoolId) : 'none';
  const todayCycle = user.schoolId ? await cycleForDate(user.schoolId, new Date()) : null;
  const cycles = cycleMode === 'oddEven' ? ['Odd', 'Even'] : [null];
  let view = todayCycle || cycles[0];

  if (!doc) {
    container.innerHTML = `
      <div class="main-scroll"><div class="page-container" style="max-width:760px;">
        <h1 style="font-size:1.5rem;font-weight:800;margin:0 0 4px;color:var(--ink);">My Timetable</h1>
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin:0 0 20px;">
          ${school ? escapeHtml(school) : 'Your school'} &middot; nothing imported yet
        </p>
        <div style="text-align:center;padding:44px 24px;border:2px dashed var(--border);border-radius:14px;">
          <div style="font-size:2rem;margin-bottom:10px;" aria-hidden="true">&#128197;</div>
          <p style="font-weight:600;color:var(--ink);margin:0 0 6px;">No timetable yet</p>
          <p style="font-size:0.875rem;color:var(--ink-muted);margin:0 auto;max-width:44ch;line-height:1.6;">
            Once your timetable is imported, Co-Cher knows what you're teaching and when &mdash;
            so it can line lessons up with the right class and period without you retyping anything.
          </p>
        </div>
      </div></div>`;
    return;
  }

  const { current, next } = await nowNext();
  const codes = await myClassCodes();

  function paint() {
    const rows = DAYS.map(day => {
      const items = doc.entries
        .filter(e => e.day === day && (e.cycle == null || e.cycle === view))
        .sort((a, b) => a.start.localeCompare(b.start));
      return `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--border-light);">
          <div style="flex:0 0 46px;font-weight:800;font-size:0.8125rem;color:var(--ink-muted);padding-top:4px;">${day}</div>
          <div style="flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:6px;">
            ${items.length ? items.map(e => {
              const k = KIND[e.kind] || KIND.lesson;
              const isNow = current && current.day === e.day && current.start === e.start && current.title === e.title;
              return `<div style="flex:0 1 auto;max-width:100%;background:${k.bg};color:${k.fg};
                border-left:3px solid ${k.bd};border-radius:8px;padding:6px 10px;font-size:0.75rem;
                ${isNow ? 'box-shadow:0 0 0 2px var(--accent);' : ''}">
                <div style="font-weight:700;font-variant-numeric:tabular-nums;">${escapeHtml(rangeLabel(e))}${isNow ? ' &middot; now' : ''}</div>
                <div style="font-weight:600;overflow-wrap:anywhere;">${escapeHtml(e.title)}</div>
                ${e.class || e.room ? `<div style="opacity:0.75;overflow-wrap:anywhere;">${escapeHtml([e.class, e.room].filter(Boolean).join(' · '))}</div>` : ''}
              </div>`;
            }).join('') : '<span style="font-size:0.75rem;color:var(--ink-faint);padding-top:6px;">&mdash;</span>'}
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="main-scroll"><div class="page-container" style="max-width:860px;">
        <h1 style="font-size:1.5rem;font-weight:800;margin:0 0 4px;color:var(--ink);">My Timetable</h1>
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin:0 0 14px;">
          ${school ? escapeHtml(school) + ' &middot; ' : ''}${doc.entries.length} entries${doc.source?.file ? ' &middot; from ' + escapeHtml(doc.source.file) : ''}
        </p>

        ${current || next ? `<div class="card" style="padding:12px 14px;margin-bottom:14px;border-left:3px solid var(--accent);">
          ${current ? `<div style="font-size:0.875rem;"><strong>Now:</strong> ${escapeHtml(current.title)}
            ${current.class ? '&middot; ' + escapeHtml(current.class) : ''} <span style="color:var(--ink-muted);">(${escapeHtml(rangeLabel(current))})</span></div>` : ''}
          ${next ? `<div style="font-size:0.875rem;${current ? 'margin-top:4px;' : ''}"><strong>Next:</strong> ${escapeHtml(next.title)}
            ${next.class ? '&middot; ' + escapeHtml(next.class) : ''} <span style="color:var(--ink-muted);">(${escapeHtml(rangeLabel(next))})</span></div>` : ''}
        </div>` : ''}

        ${cycleMode === 'oddEven' ? `<div style="display:flex;gap:6px;margin-bottom:8px;">
          ${cycles.map(c => `<button class="tt-cyc btn btn-sm ${c === view ? 'btn-primary' : 'btn-secondary'}"
            data-cycle="${c}" style="min-height:38px;">${c} week${c === todayCycle ? ' · this week' : ''}</button>`).join('')}
        </div>` : ''}

        <div class="card" style="padding:4px 14px 12px;">${rows}</div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:0.6875rem;color:var(--ink-muted);">
          ${Object.entries(KIND).map(([, k]) =>
            `<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:10px;height:10px;border-radius:3px;background:${k.bd};"></span>${k.label}</span>`).join('')}
        </div>

        ${codes.length ? `<p style="font-size:0.75rem;color:var(--ink-muted);margin-top:14px;line-height:1.6;">
          <strong>Classes found:</strong> ${codes.map(escapeHtml).join(', ')}
        </p>` : ''}
      </div></div>`;

    container.querySelectorAll('.tt-cyc').forEach(b => b.addEventListener('click', () => {
      view = b.dataset.cycle === 'null' ? null : b.dataset.cycle;
      paint();
    }));
  }
  paint();
}
