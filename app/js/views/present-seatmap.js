/*
 * Co-Cher — Interactive Present Seat Map (v7.2)
 * =============================================
 * A live, draggable "find your seat" chart for Present mode (the class screen).
 * During a lesson the teacher can drag student name-pills ANYWHERE (free
 * placement — a pill stays exactly where you drop it) and move the furniture
 * itself. Nothing persists until they tap "Save arrangement" (teacher leads the
 * loop); "Reset" reverts to the saved seating.
 *
 * Data model: `seats` (iid → [studentId]) tracks which table a student belongs
 * to (kept coherent by re-homing a pill to the table it's dropped over); `pos`
 * (studentId → {x,y}) is the free pixel position of each pill. Both persist —
 * furniture + seats to the layout scene / lesson run-of-show, positions to
 * grouping.seatPos. It reuses the SHARED geometry from spatial-designer.js and
 * does NOT depend on the Spatial Designer's (un-importable) editor closures.
 */

import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/markdown.js';
import { getItemDef, itemBodySVG, seatRingLayout, VB_W, VB_H, UNIT } from './spatial-designer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARGIN = UNIT * 0.5;                       // keep furniture inside the room border
const PILL_MARGIN = 30;                          // keep pill centres just inside the room
const DRAG_THRESHOLD = 4;                        // viewBox units before a press becomes a drag
const PILL_FS = 12;
const pillWidth = t => Math.max(24, Math.round(String(t).length * PILL_FS * 0.6) + 14);

/* Per-Present-session working copies, keyed by "<lessonId>::<segmentIndex>", so
 * un-saved drags survive showScreen's innerHTML rebuilds within a session. */
const _working = new Map();
export function clearSeatMapSessions() { _working.clear(); }

/* True while a pointer drag is in progress — Present's global keydown checks
 * this so Arrow/Space don't change screen or toggle the timer mid-drag. */
let _dragActive = false;
export function isSeatDragActive() { return _dragActive; }

const escAttr = s => String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
const cloneSeats = seats => { const o = {}; for (const k in seats) o[k] = [...(seats[k] || [])]; return o; };
const clonePos = pos => { const o = {}; for (const k in pos) o[k] = { x: pos[k].x, y: pos[k].y }; return o; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Mount the interactive seat map into `mountEl`.
 * ctx = { sessionKey, lessonId, layoutId, sceneId, segIndex,
 *         savedItems:[{id,iid,x,y,r}], savedSeats:{iid:[sid]},
 *         savedPos:{sid:{x,y}}, seatableIids:Set<iid>, resolveName:(sid)=>name }
 */
export function mountSeatMap(mountEl, ctx) {
  if (!mountEl) return;

  // Initial free positions: saved position if present, else the tidy seat-ring
  // around the student's table (so the very first view is neat).
  const initialPos = (items, seats) => {
    const pos = {};
    items.forEach(it => {
      const sids = seats[it.iid];
      if (!sids || !sids.length) return;
      const def = getItemDef(it.id);
      if (!def) return;
      const names = sids.map(sid => ctx.resolveName(sid) || sid);
      seatRingLayout(def, names).forEach((p, k) => {
        const sid = sids[k];
        pos[sid] = (ctx.savedPos && ctx.savedPos[sid])
          ? { x: ctx.savedPos[sid].x, y: ctx.savedPos[sid].y }
          : { x: Math.round(it.x + p.dx), y: Math.round(it.y + p.dy) };
      });
    });
    return pos;
  };

  let work = _working.get(ctx.sessionKey);
  if (!work) {
    const items = (ctx.savedItems || []).map(it => ({ ...it }));
    const seats = cloneSeats(ctx.savedSeats || {});
    work = { items, seats, pos: initialPos(items, seats), dirty: false };
    _working.set(ctx.sessionKey, work);
  }
  // Mutable "saved baseline" for Reset; updated on Save.
  let baseItems = (ctx.savedItems || []).map(it => ({ ...it }));
  let baseSeats = cloneSeats(ctx.savedSeats || {});
  let basePos = clonePos(work.pos);

  render();

  function render() { mountEl.innerHTML = buildHTML(); wire(); }

  function buildHTML() {
    const itemsSVG = work.items.map(it => {
      const def = getItemDef(it.id);
      if (!def) return '';
      const seatable = ctx.seatableIids.has(it.iid);
      return `<g class="psm-item${seatable ? ' psm-seatable' : ''}" data-iid="${escAttr(it.iid)}" ` +
        `transform="translate(${it.x},${it.y}) rotate(${it.r || 0})">${itemBodySVG(def)}</g>`;
    }).join('');

    // Pills render at their FREE position (no ring re-lay), one per seated student.
    const pillsSVG = work.items.flatMap(it => (work.seats[it.iid] || []).map(sid => ({ sid, iid: it.iid })))
      .map(({ sid, iid }) => {
        const text = ctx.resolveName(sid) || sid;
        const w = pillWidth(text);
        const pp = work.pos[sid] || { x: VB_W / 2, y: VB_H / 2 };
        return `<g class="psm-pill" data-sid="${escAttr(sid)}" data-iid="${escAttr(iid)}" transform="translate(${Math.round(pp.x)},${Math.round(pp.y)})">` +
          `<rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11" fill="#1e293b" opacity="0.95"/>` +
          `<text x="0" y="4" text-anchor="middle" font-size="${PILL_FS}" fill="#fff" font-weight="700" ` +
          `font-family="system-ui,-apple-system,sans-serif">${escapeHtml(text)}</text></g>`;
      }).join('');

    const svg = `<svg class="psm-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" xmlns="${SVG_NS}">` +
      `<rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="#ffffff" stroke="#94a3b8" stroke-width="4" rx="2"/>` +
      itemsSVG + pillsSVG + `</svg>`;

    const controls = `<div class="psm-controls">
        <span class="psm-hint">Drag any student or table to rearrange${work.dirty ? ' &middot; <b>unsaved changes</b>' : ''}</span>
        <span class="psm-actions">
          <button class="btn btn-ghost btn-sm psm-reset" ${work.dirty ? '' : 'disabled'}>Reset</button>
          <button class="btn btn-primary btn-sm psm-save" ${work.dirty ? '' : 'disabled'}>Save arrangement</button>
        </span>
      </div>`;

    return STYLE + `<div class="psm-wrap">${svg}${controls}</div>`;
  }

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
      const el = e.target.closest('.psm-pill') || e.target.closest('.psm-item');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const p = toSVG(e);
      const base = parseXY(el);
      drag = {
        type: el.classList.contains('psm-pill') ? 'pill' : 'item', el,
        iid: el.dataset.iid, sid: el.dataset.sid,
        grabX: p.x, grabY: p.y, baseX: base.x, baseY: base.y,
        lastX: base.x, lastY: base.y, moved: false,
      };
      if (drag.type === 'item') { const it = work.items.find(i => i.iid === drag.iid); drag.rot = it ? (it.r || 0) : 0; }
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      // Dragged element renders on top of its siblings.
      el.parentNode.appendChild(el);
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
        nx = clamp(nx, MARGIN, VB_W - MARGIN); ny = clamp(ny, MARGIN, VB_H - MARGIN);
        drag.el.setAttribute('transform', `translate(${Math.round(nx)},${Math.round(ny)}) rotate(${drag.rot})`);
      } else {
        nx = clamp(nx, PILL_MARGIN, VB_W - PILL_MARGIN); ny = clamp(ny, PILL_MARGIN, VB_H - PILL_MARGIN);
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
        // FREE placement: the pill stays exactly where it was dropped.
        const nx = Math.round(clamp(d.lastX, PILL_MARGIN, VB_W - PILL_MARGIN));
        const ny = Math.round(clamp(d.lastY, PILL_MARGIN, VB_H - PILL_MARGIN));
        work.pos[d.sid] = { x: nx, y: ny };
        // Keep table membership coherent: if dropped over a different table, re-home it.
        const target = hitTestTable(nx, ny);
        if (target && target !== d.iid) moveStudent(d.sid, d.iid, target);
        markDirty();
        render();
      }
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);

    mountEl.querySelector('.psm-save')?.addEventListener('click', save);
    mountEl.querySelector('.psm-reset')?.addEventListener('click', reset);
  }

  /* Nearest seatable table whose radius contains the point (or null). */
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
        Store.updateLayout(ctx.layoutId, { scenes: layout.scenes.map(s => s.id === ctx.sceneId ? { ...s, items: newItems } : s) });
      } else {
        Store.updateLayout(ctx.layoutId, { items: newItems });
      }
    }

    // 2) Seats + free positions → the segment's grouping on the lesson run-of-show.
    const lesson = Store.getLesson(ctx.lessonId);
    const ros = lesson && lesson.runOfShow;
    if (ros && Array.isArray(ros.segments)) {
      const seatPos = clonePos(work.pos);
      const segments = ros.segments.map((sg, i) => {
        if (i !== ctx.segIndex) return sg;
        const groups = ((sg.grouping && sg.grouping.groups) || []).map(g => {
          const itemIds = (g.itemIds && g.itemIds.length) ? g.itemIds : Object.keys(g.seatMap || {});
          const seatMap = {};
          const studentIds = [];
          itemIds.forEach(iid => { const sids = work.seats[iid] || []; seatMap[iid] = [...sids]; studentIds.push(...sids); });
          return { ...g, itemIds, seatMap, studentIds };
        });
        return { ...sg, grouping: { ...(sg.grouping || {}), groups, seatPos } };
      });
      Store.updateLesson(ctx.lessonId, { runOfShow: { ...ros, generatedAt: Date.now(), segments } });
    }

    baseItems = work.items.map(it => ({ ...it }));
    baseSeats = cloneSeats(work.seats);
    basePos = clonePos(work.pos);
    work.dirty = false;
    showToast('Seating saved.', 'success');
    render();
  }

  function reset() {
    work.items = baseItems.map(it => ({ ...it }));
    work.seats = cloneSeats(baseSeats);
    work.pos = clonePos(basePos);
    work.dirty = false;
    render();
  }
}

const STYLE = `<style>
  .psm-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
  .psm-svg { width: 100%; max-width: min(96vw, 1400px); max-height: 70vh; height: auto;
    border: 1px solid var(--border-light, #e2e8f0); border-radius: 12px; background: #fff; touch-action: none; }
  @media (max-height: 799px) { .psm-svg { max-height: 58vh; } }
  .psm-item, .psm-pill { cursor: grab; }
  .psm-item.psm-dragging, .psm-pill.psm-dragging { cursor: grabbing; }
  .psm-controls { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .psm-hint { font-size: 0.8125rem; color: var(--ink-muted, #64748b); }
  .psm-actions { display: inline-flex; gap: 8px; }
</style>`;
