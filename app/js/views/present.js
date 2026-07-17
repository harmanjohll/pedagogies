/*
 * Co-Cher Class Screen (Present Mode)
 * ===================================
 * Student-facing projector view for a staged lesson (`lesson.runOfShow`).
 * The teacher walks in, opens Present, and the day is on the wall:
 * current segment, countdown, student instructions, groups.
 *
 * SAFETY RULE: nothing teacher-facing is ever rendered here — no lesson.plan,
 * no chatHistory, no teacher notes. Only runOfShow.studentInstructions,
 * objectives, and the LISC component (student-facing by design).
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';
import { escapeHtml, md } from '../utils/markdown.js';
import { layoutToSVG } from './spatial-designer.js';

let _timerId = null;
let _remaining = 0;      // seconds left in the running segment
let _running = false;
let _segIdx = 0;
let _keyHandler = null;

function fmtClock(totalSec) {
  const m = Math.floor(Math.abs(totalSec) / 60);
  const s = Math.abs(totalSec) % 60;
  return `${totalSec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

/* Student names for a grouping assignment. Accepts studentIds that are ids
 * OR names (import/AI compat) and resolves against the class roster. */
function resolveMembers(group, cls) {
  const ids = group.studentIds || group.members || [];
  return ids.map(idOrName => {
    const byId = cls?.students?.find(s => s.id === idOrName);
    return byId ? byId.name : String(idOrName);
  });
}

const GROUP_LABEL = {
  individual: 'Work on your own',
  pairs: 'Work in pairs',
  groups: 'Work in your groups',
  'whole-class': 'Whole class together',
};

export function renderPresent(container, params) {
  const lesson = Store.getLesson(params.id);
  if (!lesson) {
    container.innerHTML = `<div style="padding:48px;text-align:center;">
      <h2>Lesson not found</h2>
      <a href="#/lessons" class="btn btn-primary" style="text-decoration:none;">Back to Lessons</a></div>`;
    return null;
  }

  const cls = (Store.get('classes') || []).find(c => c.id === lesson.classId) || null;
  const segments = lesson.runOfShow?.segments || [];
  const layout = lesson.spatialLayout
    ? (Store.getSavedLayouts().find(l => l.id === lesson.spatialLayout) || null) : null;

  /* Room map for a segment: its linked scene's arrangement, else the layout
   * itself — but only shown when there's something meaningful (an explicit
   * scene, or seat assignments to display). */
  function segmentMap(seg) {
    if (!layout) return '';
    const scene = seg.layoutSceneId
      ? (layout.scenes || []).find(s => s.id === seg.layoutSceneId) : null;
    const items = (scene?.items?.length ? scene.items : layout.items) || [];
    const seatLabels = {};
    (seg.grouping?.groups || []).forEach(g =>
      (g.itemIds || []).forEach(iid => { seatLabels[iid] = g.name || 'Group'; }));
    if (!scene && !Object.keys(seatLabels).length) return '';
    if (!items.length) return '';
    let svg = '';
    try { svg = layoutToSVG(items, { width: 640, seatLabels, title: scene?.name || 'Room setup' }); }
    catch { return ''; }
    return `<div class="present-map">
      <div class="present-meta" style="font-weight:700;margin-bottom:6px;">${Object.keys(seatLabels).length ? 'Find your seat' : 'How the room is set up'}${scene ? ' &middot; ' + escapeHtml(scene.name) : ''}</div>
      ${svg}
    </div>`;
  }
  _segIdx = 0;
  _running = false;

  document.body.classList.add('present-mode');

  const liscContent = lesson.components?.lisc?.content || '';
  const objectives = lesson.objectives || '';

  container.innerHTML = `
    <style>
      body.present-mode .sidebar, body.present-mode .mobile-header { display: none !important; }
      /* A projector screen must never show teacher chrome (key banner, toasts, quota nudges) */
      body.present-mode #api-key-banner, body.present-mode .storage-banner,
      body.present-mode .toast-container, body.present-mode #vigilance-nudge { display: none !important; }
      body.present-mode .main-content, body.present-mode main { margin-left: 0 !important; max-width: none !important; }
      .present-root { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg, #fff); }
      .present-top { display:flex; align-items:center; justify-content:space-between; padding: 14px 22px; border-bottom: 1px solid var(--border-light); }
      .present-title { font-size: clamp(1.1rem, 2.2vw, 1.6rem); font-weight: 800; color: var(--ink); }
      .present-meta { font-size: clamp(0.8rem, 1.4vw, 1rem); color: var(--ink-muted); }
      .present-stage { flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 4vh 6vw; text-align:center; gap: 2.5vh; }
      .present-seg-name { font-size: clamp(2rem, 5.5vw, 4.2rem); font-weight: 800; color: var(--ink); line-height: 1.1; }
      .present-instructions { font-size: clamp(1.15rem, 2.8vw, 2rem); color: var(--ink); line-height: 1.5; max-width: 90vw; white-space: pre-wrap; }
      .present-clock { font-variant-numeric: tabular-nums; font-size: clamp(2.4rem, 7vw, 5.5rem); font-weight: 800; letter-spacing: 0.02em; color: var(--accent, #4361ee); }
      .present-clock.overrun { color: var(--danger, #dc2626); }
      .present-groupmode { display:inline-block; padding: 6px 18px; border-radius: 999px; background: var(--accent-light, #eef); color: var(--accent, #4361ee); font-weight: 700; font-size: clamp(0.9rem, 1.8vw, 1.25rem); }
      .present-groups { display:flex; flex-wrap:wrap; gap: 14px; justify-content:center; max-width: 92vw; }
      .present-group-card { border: 2px solid var(--border); border-radius: 14px; padding: 12px 18px; min-width: 160px; background: var(--surface, #fff); }
      .present-group-card h4 { margin: 0 0 6px; font-size: clamp(0.95rem, 1.8vw, 1.3rem); color: var(--accent, #4361ee); }
      .present-group-card div { font-size: clamp(0.85rem, 1.5vw, 1.1rem); color: var(--ink); line-height: 1.45; }
      .present-bottom { display:flex; align-items:center; justify-content:space-between; gap: 16px; padding: 12px 22px; border-top: 1px solid var(--border-light); }
      .present-dots { display:flex; gap: 8px; align-items:center; flex-wrap:wrap; }
      .present-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--border); cursor: pointer; border: none; padding: 0; }
      .present-dot.done { background: var(--growth, #16a34a); }
      .present-dot.now { width: 16px; height: 16px; background: var(--accent, #4361ee); }
      .present-ctrl { display:flex; gap: 8px; }
      .present-lisc { text-align: left; font-size: clamp(1rem, 2vw, 1.4rem); line-height: 1.6; max-width: 80vw; }
      .present-lisc h1, .present-lisc h2, .present-lisc h3 { font-size: 1.2em; }
      .present-map svg { max-width: min(88vw, 760px); height: auto; border: 1px solid var(--border-light); border-radius: 12px; background: #fff; }
      @media print { .present-bottom, .present-top .present-ctrl { display: none; } }
    </style>
    <div class="present-root">
      <div class="present-top">
        <div>
          <div class="present-title">${escapeHtml(lesson.title)}</div>
          <div class="present-meta">${cls ? escapeHtml(cls.name) + ' &middot; ' : ''}${segments.length ? segments.length + ' parts &middot; ' + segments.reduce((a, s) => a + (Number(s.duration) || 0), 0) + ' min' : ''}</div>
        </div>
        <div class="present-ctrl">
          <button class="btn btn-secondary btn-sm" id="present-fullscreen" title="Fullscreen (F)">&#x26F6; Fullscreen</button>
          <button class="btn btn-secondary btn-sm" id="present-exit" title="Exit (Esc)">&times; Exit</button>
        </div>
      </div>
      <div class="present-stage" id="present-stage"></div>
      <div class="present-bottom">
        <div class="present-dots" id="present-dots"></div>
        <div class="present-ctrl">
          <button class="btn btn-secondary" id="present-prev" title="Previous (&larr;)">&larr; Back</button>
          <button class="btn btn-primary" id="present-timer" title="Start/pause timer (Space)">&#9654; Start timer</button>
          <button class="btn btn-primary" id="present-next" title="Next (&rarr;)">Next &rarr;</button>
        </div>
      </div>
    </div>`;

  const stage = container.querySelector('#present-stage');
  const dots = container.querySelector('#present-dots');
  const timerBtn = container.querySelector('#present-timer');

  /* Screens: index 0 = welcome (LI/SC), 1..n = segments. */
  const screenCount = 1 + segments.length;

  function stopTimer() {
    if (_timerId) { clearInterval(_timerId); _timerId = null; }
    _running = false;
    timerBtn.innerHTML = '&#9654; Start timer';
  }

  function tick() {
    _remaining -= 1;
    const clock = stage.querySelector('.present-clock');
    if (clock) {
      clock.textContent = fmtClock(_remaining);
      clock.classList.toggle('overrun', _remaining < 0);
    }
  }

  function startTimer() {
    if (_timerId || _segIdx === 0) return;
    _running = true;
    timerBtn.innerHTML = '&#10074;&#10074; Pause';
    _timerId = setInterval(tick, 1000);
  }

  function renderDots() {
    dots.innerHTML = Array.from({ length: screenCount }, (_, i) => {
      const cl = i === _segIdx ? 'now' : (i < _segIdx ? 'done' : '');
      const label = i === 0 ? 'Welcome' : (segments[i - 1]?.name || `Part ${i}`);
      return `<button class="present-dot ${cl}" data-idx="${i}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></button>`;
    }).join('');
    dots.querySelectorAll('.present-dot').forEach(d =>
      d.addEventListener('click', () => showScreen(Number(d.dataset.idx))));
  }

  function showScreen(idx) {
    stopTimer();
    _segIdx = Math.max(0, Math.min(screenCount - 1, idx));

    if (_segIdx === 0) {
      // Welcome screen: title + LI/SC or objectives (both student-facing)
      stage.innerHTML = `
        <div class="present-seg-name">Today&rsquo;s Lesson</div>
        ${objectives ? `<div class="present-instructions">${escapeHtml(objectives)}</div>` : ''}
        ${liscContent ? `<div class="present-lisc">${md(liscContent)}</div>` : ''}
        ${!objectives && !liscContent && !segments.length ? `
          <div class="present-instructions" style="color:var(--ink-muted);">This lesson hasn&rsquo;t been staged yet.<br>
          <span style="font-size:0.8em;">(Teacher: open it in the Lesson Planner and use &ldquo;Stage lesson&rdquo;.)</span></div>` : ''}
        ${segments.length ? `<div class="present-meta" style="font-size:clamp(1rem,2vw,1.4rem);">Ready? &rarr;</div>` : ''}`;
      timerBtn.style.visibility = 'hidden';
    } else {
      const seg = segments[_segIdx - 1];
      _remaining = (Number(seg.duration) || 5) * 60;
      timerBtn.style.visibility = 'visible';

      const groups = seg.grouping?.groups || [];
      const groupCards = groups.length ? `
        <div class="present-groups">
          ${groups.map(g => `
            <div class="present-group-card">
              <h4>${escapeHtml(g.name || 'Group')}</h4>
              <div>${resolveMembers(g, cls).map(escapeHtml).join('<br>')}</div>
            </div>`).join('')}
        </div>` : '';

      const modeLabel = GROUP_LABEL[seg.grouping?.mode || seg.groupingMode] || '';

      stage.innerHTML = `
        <div class="present-meta" style="font-weight:700;">Part ${_segIdx} of ${segments.length}</div>
        <div class="present-seg-name">${escapeHtml(seg.name || 'Activity')}</div>
        <div class="present-clock">${fmtClock(_remaining)}</div>
        ${modeLabel ? `<span class="present-groupmode">${escapeHtml(modeLabel)}</span>` : ''}
        ${seg.studentInstructions ? `<div class="present-instructions">${escapeHtml(seg.studentInstructions)}</div>` : ''}
        ${groupCards}
        ${segmentMap(seg)}`;
    }
    renderDots();
  }

  container.querySelector('#present-exit').addEventListener('click', () => navigate(`/lessons/${lesson.id}`));
  container.querySelector('#present-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  container.querySelector('#present-prev').addEventListener('click', () => showScreen(_segIdx - 1));
  container.querySelector('#present-next').addEventListener('click', () => showScreen(_segIdx + 1));
  timerBtn.addEventListener('click', () => { _running ? stopTimer() : startTimer(); });

  _keyHandler = (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowRight') showScreen(_segIdx + 1);
    else if (e.key === 'ArrowLeft') showScreen(_segIdx - 1);
    else if (e.key === ' ') { e.preventDefault(); _running ? stopTimer() : startTimer(); }
    else if (e.key === 'f' || e.key === 'F') container.querySelector('#present-fullscreen')?.click();
    else if (e.key === 'Escape' && !document.fullscreenElement) navigate(`/lessons/${lesson.id}`);
  };
  window.addEventListener('keydown', _keyHandler);

  showScreen(0);

  /* Router cleanup: leave no timer, key handler, or body class behind. */
  return () => {
    stopTimer();
    if (_keyHandler) { window.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    document.body.classList.remove('present-mode');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}
