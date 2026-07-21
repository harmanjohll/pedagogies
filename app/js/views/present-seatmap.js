/*
 * Co-Cher — Interactive Present Seat Map (v7.2)
 * =============================================
 * A live, draggable "find your seat" chart for Present mode (the class screen).
 * During a lesson the teacher can drag student name-pills between tables and
 * move the furniture itself. Nothing persists until they tap "Save arrangement"
 * (teacher leads the loop); "Reset" reverts to the saved seating.
 *
 * It reuses the SHARED geometry from spatial-designer.js (getItemDef,
 * itemBodySVG, seatRingLayout, VB_W/VB_H/UNIT) and the seatMap data contract —
 * it does NOT depend on the Spatial Designer's (un-importable) editor closures.
 * Furniture moves persist to the linked layout's scene/items; student moves
 * persist to the segment's grouping.seatMap on the lesson's run-of-show.
 */

import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/markdown.js';
import { getItemDef, itemBodySVG, seatRingLayout, VB_W, VB_H, UNIT } from './spatial-designer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = UNIT * 0.5;                       // keep items inside the room border
const DRAG_THRESHOLD = 4;                        // px (viewBox units) before a press becomes a drag

/* Per-Present-session working copies, keyed by "<lessonId>::<segmentIndex>", so
 * un-saved drags survive showScreen's innerHTML rebuilds within a session.
 * Cleared on Present teardown via clearSeatMapSessions(). */
const _working = new Map();
export function clearSeatMapSessions() { _working.clear(); }

/* True while a pointer drag is in progress — Present's global keydown checks
 * this so Arrow/Space don't change screen or toggle the timer mid-drag. */
let _dragActive = false;
export function isSeatDragActive() { return _dragActive; }

const escAttr = s => String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
const cloneSeats = seats => { const o = {}; for (const k in seats) o[k] = [...(seats[k] || [])]; return o; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Mount the interactive seat map into `mountEl`.
 * ctx = {
 *   sessionKey,            // "<lessonId>::<idx>" — stable per segment in a session
 *   lessonId, layoutId, sceneId, segIndex,
 *   savedItems: [{id,iid,x,y,r}],   // the scene/layout items (positions as saved)
 *   savedSeats: { iid: [studentId] },
 *   seatableIids: Set<iid>,         // tables that can hold students
 *   resolveName: (sid) => name
 * }
 */
export function mountSeatMap(mountEl, ctx) {
  if (!mountEl) return;

  let work = _working.get(ctx.sessionKey);
  if (!work) {
    work = {
      items: (ctx.savedItems || []).map(it => ({ ...it })),
      seats: cloneSeats(ctx.savedSeats || {}),
      dirty: false,
    };
    _working.set(ctx.sessionKey, work);
  }
  // Keep a mutable "saved baseline" for Reset; updated on Save.
  let baseItems = (ctx.savedItems || []).map(it => ({ ...it }));
  let baseSeats = cloneSeats(ctx.savedSeats || {});

  render();

  /* ── Render ── */
  function render() {
    mountEl.innerHTML = buildHTML();
    wire();
  }

  function buildHTML() {
    const itemsSVG = work.items.map(it => {
      const def = getItemDef(it.id);
      if (!def) return '';
      const seatable = ctx.seatableIids.has(it.iid);
      return `<g class="psm-item${seatable ? ' psm-seatable' : ''}" data-iid="${escAttr(it.iid)}" ` +
        `transform="translate(${it.x},${it.y}) rotate(${it.r || 0})">${itemBodySVG(def)}</g>`;
    }).join('');

    const pillsSVG = work.items.map(it => {
      const sids = work.seats[it.iid];
      if (!sids || !sids.length) return '';
      const def = getItemDef(it.id);
      if (!def) return '';
      const names = sids.map(sid => ctx.resolveName(sid) || sid);
      return seatRingLayout(def, names).map((p, k) => {
        const sid = sids[k];
        const px = Math.round(it.x + p.dx), py = Math.round(it.y + p.dy);
        return `<g class="psm-pill" data-sid="${escAttr(sid)}" data-iid="${escAttr(it.iid)}" transform="translate(${px},${py})">` +
          `<rect x="${-p.w / 2}" y="-11" width="${p.w}" height="22" rx="11" fill="#1e293b" opacity="0.95"/>` +
          `<text x="0" y="4" text-anchor="middle" font-size="12" fill="#fff" font-weight="700" ` +
          `font-family="system-ui,-apple-system,sans-serif">${escapeHtml(p.text)}</text></g>`;
      }).join('');
    }).join('');

    const svg = `<svg class="psm-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" xmlns="${SVG_NS}">` +
      `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#ffffff" stroke="#94a3b8" stroke-width="4" rx="2"/>` +
      itemsSVG + pillsSVG + `</svg>`;

    const controls = `<div class="psm-controls">
        <span class="psm-hint">Drag a student or a table to rearrange${work.dirty ? ' &middot; <b>unsaved changes</b>' : ''}</span>
        <span class="psm-actions">
          <button class="btn btn-ghost btn-sm psm-reset" ${work.dirty ? '' : 'disabled'}>Reset</button>
          <button class="btn btn-primary btn-sm psm-save" ${work.dirty ? '' : 'disabled'}>Save arrangement</button>
        </span>
      </div>`;

    return STYLE + `<div class="psm-wrap">${svg}${controls}</div>`;
  }

  /* ── Wire pointer drag + buttons ── */
  function wire() {
    const svg = mountEl.querySelector('.psm-svg');
    if (!svg) return;

    const toSVG = (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    };
    const parseXY = (el) => {
      const m = /translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(el.getAttribute('transform') || '');
      return { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 };
    };

    let drag = null;

    svg.addEventListener('pointerdown', (e) => {
      const pill = e.target.closest('.psm-pill');
      const item = e.target.closest('.psm-item');
      const el = pill || item;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const p = toSVG(e);
      const base = parseXY(el);
      drag = {
        type: pill ? 'pill' : 'item', el,
        iid: el.dataset.iid, sid: el.dataset.sid,
        grabX: p.x, grabY: p.y, baseX: base.x, baseY: base.y,
        lastX: base.x, lastY: base.y, moved: false,
      };
      if (drag.type === 'item') {
        const it = work.items.find(i => i.iid === drag.iid);
        drag.rot = it ? (it.r || 0) : 0;
      }
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      el.classList.add('psm-dragging');
      _dragActive = true;
    });

    svg.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = toSVG(e);
      let nx = drag.baseX + (p.x - drag.grabX);
      let ny = drag.baseY + (p.y - drag.grabY);
      if (Math.abs(p.x - drag.grabX) + Math.abs(p.y - drag.grabY) > DRAG_THRESHOLD) drag.moved = true;
      if (drag.type === 'item') {
        nx = clamp(nx, MARGIN, VB_W - MARGIN);
        ny = clamp(ny, MARGIN, VB_H - MARGIN);
        drag.el.setAttribute('transform', `translate(${Math.round(nx)},${Math.round(ny)}) rotate(${drag.rot})`);
      } else {
        drag.el.setAttribute('transform', `translate(${Math.round(nx)},${Math.round(ny)})`);
      }
      drag.lastX = nx; drag.lastY = ny;
    });

    const endDrag = (e) => {
      if (!drag) return;
      try { drag.el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      drag.el.classList.remove('psm-dragging');
      const d = drag; drag = null; _dragActive = false;
      if (!d.moved) return;                       // a tap is not a drag → nothing moves
      if (d.type === 'item') {
        const it = work.items.find(i => i.iid === d.iid);
        if (it) { it.x = Math.round(clamp(d.lastX, MARGIN, VB_W - MARGIN)); it.y = Math.round(clamp(d.lastY, MARGIN, VB_H - MARGIN)); markDirty(); }
        render();
      } else {
        const target = hitTestTable(d.lastX, d.lastY);
        if (target && target !== d.iid) { moveStudent(d.sid, d.iid, target); markDirty(); }
        render();                                 // re-lay rings (snaps pill back if no valid target)
      }
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    mountEl.querySelector('.psm-save')?.addEventListener('click', save);
    mountEl.querySelector('.psm-reset')?.addEventListener('click', reset);
  }

  /* Which seatable table is the drop point over? Nearest centre within a
   * generous radius. */
  function hitTestTable(x, y) {
    let best = null, bestD = Infinity;
    for (const it of work.items) {
      if (!ctx.seatableIids.has(it.iid)) continue;
      const def = getItemDef(it.id);
      if (!def) continue;
      const rr = Math.max(def.w, def.h || def.w) / 2 + 44;
      const d = Math.hypot(x - it.x, y - it.y);
      if (d < rr && d < bestD) { bestD = d; best = it.iid; }
    }
    return best;
  }

  function moveStudent(sid, fromIid, toIid) {
    if (work.seats[fromIid]) work.seats[fromIid] = work.seats[fromIid].filter(s => s !== sid);
    if (!work.seats[toIid]) work.seats[toIid] = [];
    if (!work.seats[toIid].includes(sid)) work.seats[toIid].push(sid);
  }

  function markDirty() { work.dirty = true; }

  /* ── Persist (only on Save) ── */
  function save() {
    // 1) Furniture → the linked layout's scene items (or layout.items).
    const layout = Store.getSavedLayouts().find(l => l.id === ctx.layoutId);
    if (layout) {
      const newItems = work.items.map(it => ({ ...it }));
      if (ctx.sceneId && Array.isArray(layout.scenes)) {
        Store.updateLayout(ctx.layoutId, {
          scenes: layout.scenes.map(s => s.id === ctx.sceneId ? { ...s, items: newItems } : s),
        });
      } else {
        Store.updateLayout(ctx.layoutId, { items: newItems });
      }
    }

    // 2) Seats → the segment's grouping.seatMap on the lesson run-of-show.
    const lesson = Store.getLesson(ctx.lessonId);
    const ros = lesson && lesson.runOfShow;
    if (ros && Array.isArray(ros.segments)) {
      const segments = ros.segments.map((sg, i) => {
        if (i !== ctx.segIndex) return sg;
        const groups = ((sg.grouping && sg.grouping.groups) || []).map(g => {
          const itemIds = (g.itemIds && g.itemIds.length) ? g.itemIds : Object.keys(g.seatMap || {});
          const seatMap = {};
          const studentIds = [];
          itemIds.forEach(iid => {
            const sids = work.seats[iid] || [];
            seatMap[iid] = [...sids];
            studentIds.push(...sids);
          });
          return { ...g, itemIds, seatMap, studentIds };
        });
        return { ...sg, grouping: { ...(sg.grouping || {}), groups } };
      });
      Store.updateLesson(ctx.lessonId, { runOfShow: { ...ros, generatedAt: Date.now(), segments } });
    }

    baseItems = work.items.map(it => ({ ...it }));
    baseSeats = cloneSeats(work.seats);
    work.dirty = false;
    showToast('Seating saved.', 'success');
    render();
  }

  function reset() {
    work.items = baseItems.map(it => ({ ...it }));
    work.seats = cloneSeats(baseSeats);
    work.dirty = false;
    render();
  }
}

const STYLE = `<style>
  .psm-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .psm-svg { max-width: min(94vw, 1180px); max-height: 56vh; width: auto; height: auto;
    border: 1px solid var(--border-light, #e2e8f0); border-radius: 12px; background: #fff; touch-action: none; }
  @media (max-height: 799px) { .psm-svg { max-height: 46vh; } }
  .psm-item, .psm-pill { cursor: grab; }
  .psm-item.psm-dragging, .psm-pill.psm-dragging { cursor: grabbing; }
  .psm-pill { transition: none; }
  .psm-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .psm-hint { font-size: 0.8125rem; color: var(--ink-muted, #64748b); }
  .psm-actions { display: inline-flex; gap: 8px; }
</style>`;
