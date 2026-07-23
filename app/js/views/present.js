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
import { mountSeatMap, clearSeatMapSessions, isSeatDragActive } from './present-seatmap.js';
import { SCHEMA_PRESETS } from '../utils/tracking.js';
import { openDeckById, getMediaContent, getDeckModel, listDeckMeta } from '../utils/deck.js';
import { openLiveSession } from '../components/live-launch.js';
import { showToast } from '../components/toast.js';
import { resolveTeachingAction, TEACHING_AREA_ICONS } from '../utils/stp.js';
import { buildCardModel, cardPreviewHTML, openCardWindow, cardShareUrl } from '../utils/takehome-card.js';

let _timerId = null;
let _remaining = 0;      // seconds left in the running segment
let _running = false;
let _segIdx = 0;
let _keyHandler = null;
let _audienceMode = false;   // assembly / open-house view: hides class-only details

/* WS-D: lessons whose Present session has already been counted this page
 * session. Guards Store.recordPresentation against double-counting when the
 * router re-invokes renderPresent for the same lesson (e.g. a re-navigation
 * that re-renders the view). A page reload clears the module, so a genuinely
 * new session counts again. */
const _presentCounted = new Set();

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

/* Student-facing labels for a segment's E21CC focus (key → label), sourced
 * from the tracking schema registry so wording stays centralised. */
const E21CC_FOCUS_LABELS = Object.fromEntries(
  SCHEMA_PRESETS.e21cc.fields.map(f => [f.key, f.label]));

export function renderPresent(container, params) {
  const lesson = Store.getLesson(params.id);
  if (!lesson) {
    container.innerHTML = `<div style="padding:48px;text-align:center;">
      <h2>Lesson not found</h2>
      <a href="#/lessons" class="btn btn-primary" style="text-decoration:none;">Back to Lessons</a></div>`;
    return null;
  }

  /* WS-D: count this lesson being presented ONCE per Present session. The
   * milestone OFFERS on the dashboard read this lifetime counter; it must
   * never inflate on a re-render, so we guard with a module-scoped seen-set
   * keyed by lesson id. Purely a side-effect — Present behaviour is unchanged. */
  if (!_presentCounted.has(lesson.id)) {
    _presentCounted.add(lesson.id);
    try { Store.recordPresentation(lesson.id); } catch { /* stats are best-effort */ }
  }

  const cls = (Store.get('classes') || []).find(c => c.id === lesson.classId) || null;
  const segments = lesson.runOfShow?.segments || [];
  const layout = lesson.spatialLayout
    ? (Store.getSavedLayouts().find(l => l.id === lesson.spatialLayout) || null) : null;

  /* Resolve one stored studentId (or raw name, import/AI compat) to a
   * display name — same resolution rule as resolveMembers, per entry. */
  const seatName = idOrName => {
    const byId = cls?.students?.find(s => s.id === idOrName);
    return byId ? byId.name : String(idOrName);
  };

  /* Room map for a segment: its linked scene's arrangement, else the layout
   * itself — but only shown when there's something meaningful (an explicit
   * scene, or seat assignments to display). */
  const segScene = seg => seg.layoutSceneId
    ? (layout.scenes || []).find(s => s.id === seg.layoutSceneId) || null : null;
  const segItems = (seg, scene) => (scene?.items?.length ? scene.items : layout.items) || [];
  const segHasSeats = seg => (seg.grouping?.groups || []).some(g =>
    g.seatMap && typeof g.seatMap === 'object'
    && Object.values(g.seatMap).some(a => Array.isArray(a) && a.length));

  /* Context for the interactive seat map — savedItems + a flattened
   * iid→[studentId] seat map + the tables that can hold students. */
  function seatCtxFor(seg, segIndex) {
    if (!layout) return null;
    const scene = segScene(seg);
    const items = segItems(seg, scene);
    if (!items.length) return null;
    const savedSeats = {};
    const seatableIids = new Set();
    (seg.grouping?.groups || []).forEach(g => {
      (g.itemIds || []).forEach(iid => seatableIids.add(iid));
      const sm = (g.seatMap && typeof g.seatMap === 'object') ? g.seatMap : {};
      Object.entries(sm).forEach(([iid, sids]) => {
        seatableIids.add(iid);
        savedSeats[iid] = (Array.isArray(sids) ? sids : []).slice();
      });
    });
    const savedPos = (seg.grouping && seg.grouping.seatPos && typeof seg.grouping.seatPos === 'object')
      ? seg.grouping.seatPos : {};
    return {
      sessionKey: `${lesson.id}::${segIndex}`,
      lessonId: lesson.id, layoutId: layout.id, sceneId: scene?.id || null, segIndex,
      savedItems: items.map(i => ({ ...i })), savedSeats, savedPos, seatableIids,
      resolveName: seatName,
    };
  }

  /* Room map for a segment. When the segment has students seated, emit a mount
   * point for the INTERACTIVE seat map (mounted in showScreen after injection);
   * otherwise render the read-only room SVG (group-name pills or plain scene). */
  function segmentMap(seg, segIndex) {
    if (!layout) return '';
    const scene = segScene(seg);
    const items = segItems(seg, scene);
    if (!items.length) return '';

    if (segHasSeats(seg)) {
      return `<div class="present-map">
        <div class="present-meta" style="font-weight:700;margin-bottom:6px;">Find your seat${scene ? ' &middot; ' + escapeHtml(scene.name) : ''}</div>
        <div class="present-seatmap-mount" data-seat-idx="${segIndex}"></div>
      </div>`;
    }

    const seatLabels = {};
    (seg.grouping?.groups || []).forEach(g => {
      const groupLabel = g.name || 'Group';
      (g.itemIds || []).forEach(iid => { seatLabels[iid] = groupLabel; });
    });
    if (!scene && !Object.keys(seatLabels).length) return '';
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
  _audienceMode = false;

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
      .present-top { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding: 14px 22px; border-bottom: 1px solid var(--border-light); }
      .present-title { font-size: clamp(1.1rem, 2.2vw, 1.6rem); font-weight: 800; color: var(--ink); }
      .present-meta { font-size: clamp(0.8rem, 1.4vw, 1rem); color: var(--ink-muted); }
      /* Scrollable stage with SAFE centering: .present-inner's margin:auto
       * centers when content fits and top-aligns (scrollable) when it
       * overflows — centered flex overflow would clip unreachably. */
      .present-stagewrap { flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0; }
      .present-stage { flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; overflow-y:auto; padding: 3vh 6vw; text-align:center; }
      /* Scroll cue: a low-res projector can push content below the fold with
       * no visible scrollbar — hint until the presenter nears the bottom. */
      .present-more-cue { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); padding: 3px 14px; border-radius: 999px; background: var(--surface, #fff); border: 1px solid var(--border, #d1d5db); box-shadow: 0 2px 10px rgba(0,0,0,0.12); color: var(--ink-muted, #64748b); font-size: 0.85rem; font-weight: 700; pointer-events: none; opacity: 0; transition: opacity 0.25s; }
      .present-more-cue.show { opacity: 1; }
      .present-inner { margin: auto; display:flex; flex-direction:column; align-items:center; gap: 2.5vh; max-width: 100%; }
      .present-inner.dense { gap: 1.2vh; }
      .present-inner.dense .present-clock { font-size: clamp(1.8rem, 5vw, 3.6rem); }
      .present-inner.dense .present-seg-name { font-size: clamp(1.5rem, 4vw, 2.8rem); }
      .present-inner.dense .present-instructions { font-size: clamp(1rem, 2.2vw, 1.5rem); }
      .present-seg-name { font-size: clamp(2rem, 5.5vw, 4.2rem); font-weight: 800; color: var(--ink); line-height: 1.1; }
      .present-instructions { font-size: clamp(1.15rem, 2.8vw, 2rem); color: var(--ink); line-height: 1.5; max-width: 90vw; white-space: pre-wrap; }
      /* The chosen STP Teaching Action's student-facing framing — a signposted
       * "what we're doing" prompt, distinct from the plain instructions. */
      .present-action { display: inline-flex; align-items: flex-start; gap: 10px; text-align: left; max-width: 85vw; font-size: clamp(1.05rem, 2.4vw, 1.7rem); line-height: 1.45; color: var(--ink); background: var(--accent-light, #eef); border-left: 4px solid var(--accent, #4361ee); border-radius: 12px; padding: 12px 18px; }
      .present-action .ic { font-size: 1.3em; line-height: 1; flex-shrink: 0; }
      .present-inner.dense .present-action { font-size: clamp(0.95rem, 2vw, 1.4rem); padding: 9px 14px; }
      .present-clock { font-variant-numeric: tabular-nums; font-size: clamp(2.4rem, 7vw, 5.5rem); font-weight: 800; letter-spacing: 0.02em; color: var(--accent, #4361ee); }
      .present-clock.overrun { color: var(--danger, #dc2626); }
      .present-groupmode { display:inline-block; padding: 6px 18px; border-radius: 999px; background: var(--accent-light, #eef); color: var(--accent, #4361ee); font-weight: 700; font-size: clamp(0.9rem, 1.8vw, 1.25rem); }
      .present-growth { background: var(--growth-light, #e2f2e8); color: var(--growth, #2c7a4b); }
      .present-groups { display:flex; flex-wrap:wrap; gap: 14px; justify-content:center; max-width: 92vw; }
      .present-group-card { border: 2px solid var(--border); border-radius: 14px; padding: 12px 18px; min-width: 160px; background: var(--surface, #fff); }
      .present-group-card h4 { margin: 0 0 6px; font-size: clamp(0.95rem, 1.8vw, 1.3rem); color: var(--accent, #4361ee); }
      .present-group-card div { font-size: clamp(0.85rem, 1.5vw, 1.1rem); color: var(--ink); line-height: 1.45; }
      .present-bottom { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap: 12px; padding: 12px 22px; border-top: 1px solid var(--border-light); }
      .present-dots { display:flex; gap: 8px; align-items:center; flex-wrap:wrap; }
      .present-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--border); cursor: pointer; border: none; padding: 0; }
      .present-dot.done { background: var(--growth, #16a34a); }
      .present-dot.now { width: 16px; height: 16px; background: var(--accent, #4361ee); }
      .present-ctrl { display:flex; gap: 8px; flex-wrap:wrap; }
      @media (max-width: 480px) { .present-bottom .present-ctrl { width:100%; } .present-bottom .present-ctrl .btn { flex:1 1 auto; } }
      .present-lisc { text-align: left; font-size: clamp(1rem, 2vw, 1.4rem); line-height: 1.6; max-width: 80vw; }
      .present-lisc h1, .present-lisc h2, .present-lisc h3 { font-size: 1.2em; }
      .present-framework { text-align: left; font-size: clamp(0.95rem, 1.8vw, 1.25rem); line-height: 1.6; max-width: 80vw; border: 2px solid var(--border); border-radius: 14px; padding: 12px 20px; background: var(--surface, #fff); }
      .present-framework-title { font-weight: 800; color: var(--accent, #4361ee); margin-bottom: 4px; }
      .present-framework-stage strong { color: var(--ink); }
      /* Fill the stage. A viewport-relative DEFINITE width is required: the
       * interactive .psm-svg carries no width attribute, and the ancestors
       * (.present-stage / .present-inner) are align-items:center, so width:auto
       * or width:100% both collapse to a tiny shrink-to-fit size. 88vw (not
       * 96) leaves room for .present-stage's 6vw side padding. */
      .present-map svg { max-width: min(88vw, 1400px); max-height: 70vh; width: min(88vw, 1400px); height: auto; border: 1px solid var(--border-light); border-radius: 12px; background: #fff; }
      /* Slim materials row (WS-4): launch attached decks/audio without leaving
       * the class screen. Student-safe — material titles only. */
      .present-resources { display:flex; flex-wrap:wrap; gap: 10px; justify-content:center; align-items:center; max-width: 92vw; }
      .present-res-btn { display:inline-flex; align-items:center; gap: 7px; padding: 7px 16px; border-radius: 999px; border: 1.5px solid var(--border, #d1d5db); background: var(--surface, #fff); color: var(--ink); font-size: clamp(0.85rem, 1.6vw, 1.1rem); font-weight: 600; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
      .present-res-btn:hover:not([disabled]) { border-color: var(--accent, #4361ee); color: var(--accent, #4361ee); }
      .present-res-btn[disabled] { opacity: 0.55; cursor: default; }
      .present-res-player:empty { display: none; }
      .present-res-player audio { width: min(70vw, 480px); }
      /* Short screens (1366x768 projectors): shrink the seat map so more of
       * the segment fits above the fold. */
      @media (max-height: 799px) { .present-map svg { max-height: 58vh; } }
      @media print { .present-bottom, .present-top .present-ctrl, .present-more-cue { display: none; } }
    </style>
    <div class="present-root">
      <div class="present-top">
        <div>
          <div class="present-title">${escapeHtml(lesson.title)}</div>
          <div class="present-meta">${cls ? escapeHtml(cls.name) + ' &middot; ' : ''}${segments.length ? segments.length + ' parts &middot; ' + segments.reduce((a, s) => a + (Number(s.duration) || 0), 0) + ' min' : ''}</div>
        </div>
        <div class="present-ctrl">
          <button class="btn btn-secondary btn-sm" id="present-golive" title="Run this lesson's deck as a live session — students scan a QR to join on their phones, vote and respond, and leave with a personal card" style="color:#e11d48;font-weight:700;">&#9654; Go Live</button>
          <button class="btn btn-secondary btn-sm" id="present-audience" title="Audience mode — hide class-only details (seating, groups) for an assembly / open house" aria-pressed="${_audienceMode}">&#128101; Audience</button>
          <button class="btn btn-secondary btn-sm" id="present-fullscreen" title="Fullscreen (F)">&#x26F6; Fullscreen</button>
          <button class="btn btn-secondary btn-sm" id="present-exit" title="Exit (Esc)">&times; Exit</button>
        </div>
      </div>
      <div class="present-stagewrap">
        <div class="present-stage" id="present-stage"></div>
        <div class="present-more-cue" id="present-more-cue" aria-hidden="true">&#8964; more</div>
      </div>
      <div class="present-bottom">
        <div class="present-dots" id="present-dots"></div>
        <div id="present-clock-sr" aria-live="polite" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;"></div>
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
  const moreCue = container.querySelector('#present-more-cue');
  const clockSR = container.querySelector('#present-clock-sr');
  let _lastClockAnnounce = null; // dedup key so we only speak on coarse (per-minute) change

  /* Screen-reader time cue. The visual .present-clock ticks every second, but
   * announcing each second would be a barrage — so this polite live region
   * updates only when the whole-minute bucket (or the "time's up" / overrun
   * state) changes, i.e. roughly once a minute. force=true announces on
   * segment entry regardless. */
  function announceClock(force) {
    if (!clockSR) return;
    let key, msg;
    if (_remaining > 0) {
      const mins = Math.ceil(_remaining / 60);
      key = 'r' + mins;
      msg = `About ${mins} minute${mins === 1 ? '' : 's'} remaining for this part.`;
    } else {
      const over = Math.floor(-_remaining / 60); // 0 during the first minute past time
      key = 'o' + over;
      msg = over >= 1
        ? `Running ${over} minute${over === 1 ? '' : 's'} over for this part.`
        : `Time is up for this part.`;
    }
    if (!force && key === _lastClockAnnounce) return;
    _lastClockAnnounce = key;
    clockSR.textContent = msg;
  }

  /* ── Attached materials (WS-4): decks + audio clips on segment screens.
   * Student-safe: titles only — no styles, notes, or teacher copy. Toasts
   * are hidden in present-mode, so failures report inline on the button. */
  const materials = (lesson.attachedResources || [])
    .filter(r => r && (r.type === 'deck' || r.type === 'audio') && r.id);
  const _audioUrls = new Map(); // material id → object URL (revoked on route cleanup)

  function materialsRow() {
    if (!materials.length) return '';
    return `<div class="present-resources">
      ${materials.map((r, i) => `
        <button class="present-res-btn" data-res-idx="${i}" type="button">
          <span aria-hidden="true">${r.type === 'deck' ? '&#128444;&#65039;' : '&#127911;'}</span>
          ${escapeHtml(r.title || (r.type === 'deck' ? 'Slides' : 'Audio clip'))}
        </button>`).join('')}
    </div>
    <div class="present-res-player" id="present-res-player"></div>`;
  }

  function markUnavailable(btn) {
    btn.disabled = true;
    btn.insertAdjacentHTML('beforeend', ' <span style="font-weight:400;">&mdash; not on this device</span>');
  }

  async function openDeckMaterial(btn, r) {
    btn.disabled = true;
    const ok = await openDeckById(r.id);
    if (ok) { btn.disabled = false; } else { markUnavailable(btn); }
  }

  async function toggleAudioMaterial(btn, r) {
    const slot = stage.querySelector('#present-res-player');
    if (!slot) return;
    if (slot.dataset.playing === r.id) { // toggle off
      slot.querySelector('audio')?.pause();
      slot.innerHTML = '';
      delete slot.dataset.playing;
      updateMoreCue();
      return;
    }
    let url = _audioUrls.get(r.id);
    if (!url) {
      btn.disabled = true;
      const blob = await getMediaContent(r.id);
      if (!(blob instanceof Blob)) { markUnavailable(btn); return; }
      url = URL.createObjectURL(blob);
      _audioUrls.set(r.id, url);
      btn.disabled = false;
    }
    slot.dataset.playing = r.id;
    slot.innerHTML = `<audio controls src="${url}"></audio>`;
    slot.querySelector('audio').play().catch(() => {}); // autoplay may be blocked — controls remain
    updateMoreCue();
  }

  function wireMaterialButtons() {
    stage.querySelectorAll('.present-res-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = materials[Number(btn.dataset.resIdx)];
        if (!r) return;
        if (r.type === 'deck') { openDeckMaterial(btn, r); } else { toggleAudioMaterial(btn, r); }
      });
    });
  }

  /* Show the "more" cue while stage content extends below the fold; hide it
   * once the presenter has scrolled to within ~40px of the bottom. */
  function updateMoreCue() {
    if (!moreCue) return;
    const overflow = stage.scrollHeight - stage.clientHeight;
    const nearBottom = stage.scrollTop >= overflow - 40;
    moreCue.classList.toggle('show', overflow > 8 && !nearBottom);
  }
  stage.addEventListener('scroll', updateMoreCue, { passive: true });
  window.addEventListener('resize', updateMoreCue);

  /* Screens: index 0 = welcome (LI/SC), 1..n = segments, last = takehome card. */
  const screenCount = 1 + segments.length + 1;

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
    announceClock(); // coarse SR cue; self-throttles to ~once a minute
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
      const label = i === 0 ? 'Welcome' : (i === screenCount - 1 ? 'Takehome card' : (segments[i - 1]?.name || `Part ${i}`));
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
      if (clockSR) { clockSR.textContent = ''; _lastClockAnnounce = null; } // no timer here
      stage.innerHTML = `<div class="present-inner">
        <div class="present-seg-name">Today&rsquo;s Lesson</div>
        ${objectives ? `<div class="present-instructions">${escapeHtml(objectives)}</div>` : ''}
        ${liscContent ? `<div class="present-lisc">${md(liscContent)}</div>` : ''}
        ${!objectives && !liscContent && !segments.length ? `
          <div class="present-instructions" style="color:var(--ink-muted);">This lesson hasn&rsquo;t been staged yet.<br>
          <span style="font-size:0.8em;">(Teacher: open it in the Lesson Planner and use &ldquo;Stage lesson&rdquo;.)</span></div>` : ''}
        ${segments.length ? `<div class="present-meta" style="font-size:clamp(1rem,2vw,1.4rem);">Ready? &rarr;</div>` : ''}
      </div>`;
      timerBtn.style.visibility = 'hidden';
    } else if (_segIdx <= segments.length) {
      const seg = segments[_segIdx - 1];
      _remaining = (Number(seg.duration) || 5) * 60;
      timerBtn.style.visibility = 'visible';
      _lastClockAnnounce = null;
      announceClock(true); // announce the starting time when a segment opens

      const groups = seg.grouping?.groups || [];
      // When the segment has an interactive seat map, that map already shows
      // every student by name in their seat — the group-roster cards would just
      // duplicate it and eat the vertical space the map needs. Suppress them.
      const groupCards = (!_audienceMode && groups.length && !segHasSeats(seg)) ? `
        <div class="present-groups">
          ${groups.map(g => `
            <div class="present-group-card">
              <h4>${escapeHtml(g.name || 'Group')}</h4>
              <div>${resolveMembers(g, cls).map(escapeHtml).join('<br>')}</div>
            </div>`).join('')}
        </div>` : '';

      // Class-only cues (grouping mode, growth focus) are hidden in Audience mode.
      const modeLabel = _audienceMode ? '' : (GROUP_LABEL[seg.grouping?.mode || seg.groupingMode] || '');
      const growthLabel = (_audienceMode || !seg.e21ccFocus) ? '' : (E21CC_FOCUS_LABELS[seg.e21ccFocus] || '');

      /* Framework moment: the segment's pedagogy framework, shown as stage
       * lines. Student-facing only — labels + studentPrompt questions; the
       * teacher-facing stage prompt is never rendered here. */
      const framework = seg.frameworkId
        ? (Store.getFrameworks?.() || []).find(f => f.id === seg.frameworkId) || null : null;
      const frameworkPanel = framework ? `
        <div class="present-framework">
          <div class="present-framework-title">${escapeHtml(framework.name)}</div>
          ${(framework.stages || []).map(s => `
            <div class="present-framework-stage"><strong>${escapeHtml(s.label || '')}</strong>${s.studentPrompt ? ` &mdash; ${escapeHtml(s.studentPrompt)}` : ''}</div>`).join('')}
        </div>` : '';

      const mapHtml = _audienceMode ? '' : segmentMap(seg, _segIdx - 1);   // seating is class-only
      // The chosen STP Teaching Action's student-facing framing (the seam:
      // teacher picks the action in the planner, students see its framing).
      // Student-safe — only the studentFraming string, never the teacher hint.
      const stpAction = resolveTeachingAction(seg);
      const stpActionIcon = seg.teachingArea ? (TEACHING_AREA_ICONS[seg.teachingArea] || '') : '';
      const actionHtml = (stpAction && stpAction.studentFraming)
        ? `<div class="present-action"><span class="ic" aria-hidden="true">${stpActionIcon || '&#128204;'}</span><span>${escapeHtml(stpAction.studentFraming)}</span></div>`
        : '';
      // Content-heavy screens compact their type/spacing so everything stays
      // reachable; the stage itself scrolls as the final safety net.
      const layers = [groupCards, frameworkPanel, mapHtml, seg.studentInstructions, growthLabel, actionHtml]
        .filter(Boolean).length;
      stage.innerHTML = `<div class="present-inner${layers >= 3 ? ' dense' : ''}">
        <div class="present-meta" style="font-weight:700;">Part ${_segIdx} of ${segments.length}</div>
        <div class="present-seg-name">${escapeHtml(seg.name || 'Activity')}</div>
        <div class="present-clock">${fmtClock(_remaining)}</div>
        ${modeLabel ? `<span class="present-groupmode">${escapeHtml(modeLabel)}</span>` : ''}
        ${growthLabel ? `<span class="present-groupmode present-growth">This activity grows: ${escapeHtml(growthLabel)}</span>` : ''}
        ${actionHtml}
        ${seg.studentInstructions ? `<div class="present-instructions">${escapeHtml(seg.studentInstructions)}</div>` : ''}
        ${frameworkPanel}
        ${groupCards}
        ${mapHtml}
        ${materialsRow()}
      </div>`;
      wireMaterialButtons();
      // Mount the interactive seat map (if this segment has seated students).
      const seatMountEl = stage.querySelector('.present-seatmap-mount');
      if (seatMountEl) {
        const sc = seatCtxFor(seg, _segIdx - 1);
        if (sc) mountSeatMap(seatMountEl, sc);
      }
    } else {
      // Takehome closing screen — the audience's card to keep.
      if (clockSR) { clockSR.textContent = ''; _lastClockAnnounce = null; }
      timerBtn.style.visibility = 'hidden';
      const model = buildCardModel(lesson);
      stage.innerHTML = `<div class="present-inner">
        <div class="present-seg-name">Take this home</div>
        <div style="margin:1vh auto 0;">${cardPreviewHTML(model)}</div>
        <div class="present-resources" style="margin-top:2vh;">
          <button class="present-res-btn" id="thc-print" type="button"><span aria-hidden="true">&#128424;&#65039;</span> Print / download cards</button>
          <button class="present-res-btn" id="thc-copy" type="button"><span aria-hidden="true">&#128279;</span> Copy card link</button>
        </div>
      </div>`;
      stage.querySelector('#thc-print')?.addEventListener('click', () => openCardWindow(model));
      stage.querySelector('#thc-copy')?.addEventListener('click', async (e) => {
        const url = cardShareUrl(model);
        const btn = e.currentTarget;
        try { await navigator.clipboard.writeText(url); btn.innerHTML = '<span aria-hidden="true">&#10003;</span> Link copied'; }
        catch { btn.innerHTML = '<span aria-hidden="true">&#128279;</span> ' + escapeHtml(url.slice(0, 36)) + '…'; }
      });
    }
    renderDots();
    stage.scrollTop = 0; // each screen starts at the top
    requestAnimationFrame(updateMoreCue); // after layout settles
  }

  // Go Live — run this lesson's attached deck as a two-device session (same
  // tab; Esc in the live view returns here). Needs a deck saved WITH its
  // slide model (v8.1+); older HTML-only decks can't be run live.
  container.querySelector('#present-golive')?.addEventListener('click', async () => {
    const deckIds = (lesson.attachedResources || []).filter(r => r.type === 'deck' && r.id).map(r => r.id);
    const withModel = new Set(listDeckMeta().filter(m => m.hasModel).map(m => m.id));
    const liveId = deckIds.find(id => withModel.has(id));
    if (!liveId) {
      showToast('No Live-ready deck on this lesson yet — generate one in the Lesson Planner (Slide Deck), then hit Go Live.', 'warning');
      return;
    }
    const model = await getDeckModel(liveId);
    if (!model) { showToast('This deck can’t be run live on this device.', 'danger'); return; }
    openLiveSession(model);
  });

  container.querySelector('#present-audience')?.addEventListener('click', (e) => {
    _audienceMode = !_audienceMode;
    const btn = e.currentTarget;
    btn.setAttribute('aria-pressed', String(_audienceMode));
    btn.style.background = _audienceMode ? 'var(--accent, #4361ee)' : '';
    btn.style.color = _audienceMode ? '#fff' : '';
    showScreen(_segIdx); // re-render the current screen with the new filter
  });
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
    if (isSeatDragActive()) return; // don't navigate/toggle the timer mid seat-drag
    if (e.key === 'ArrowRight') showScreen(_segIdx + 1);
    else if (e.key === 'ArrowLeft') showScreen(_segIdx - 1);
    else if (e.key === ' ') { e.preventDefault(); _running ? stopTimer() : startTimer(); }
    else if (e.key === 'f' || e.key === 'F') container.querySelector('#present-fullscreen')?.click();
    else if (e.key === 'Escape' && !document.fullscreenElement) navigate(`/lessons/${lesson.id}`);
  };
  window.addEventListener('keydown', _keyHandler);

  showScreen(0);

  /* Router cleanup: leave no timer, key handler, listener, or body class behind. */
  return () => {
    stopTimer();
    clearSeatMapSessions(); // drop un-saved live rearrangements when leaving Present
    window.removeEventListener('resize', updateMoreCue);
    if (_keyHandler) { window.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    _audioUrls.forEach(url => URL.revokeObjectURL(url));
    _audioUrls.clear();
    document.body.classList.remove('present-mode');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}
