/*
 * Co-Cher Spatial Designer
 * ========================
 * Full drag-and-drop SVG classroom layout designer with
 * furniture library, presets, and effectiveness analysis.
 */

import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { openModal, confirmDialog } from '../components/modals.js';

/* ═══════════ Constants ═══════════ */
const SVG_NS = 'http://www.w3.org/2000/svg';
const VB_W = 1200, VB_H = 660;
const UNIT = 55;
const GRID_SNAP = UNIT / 2;
const COLS = Math.floor(VB_W / UNIT);
const ROWS = Math.floor(VB_H / UNIT);

/* ═══════════ Palette definition ═══════════ */
const PALETTE = [
  // Furniture
  { cat: 'Furniture', id: 'desk_rect', label: 'Desk (rect)', w: UNIT, h: UNIT * 0.65, color: '#e5e7eb' },
  { cat: 'Furniture', id: 'desk_round', label: 'Table (round)', w: UNIT, h: UNIT, color: '#d1fae5', round: true },
  { cat: 'Furniture', id: 'desk_trap', label: 'Desk (trapezoid)', w: UNIT, h: UNIT * 0.65, color: '#fef3c7', trap: true },
  { cat: 'Furniture', id: 'chair', label: 'Chair', w: UNIT * 0.4, h: UNIT * 0.4, color: '#dbeafe' },
  { cat: 'Furniture', id: 'stand_table', label: 'Standing table', w: UNIT * 2.5, h: UNIT * 0.6, color: '#fde68a' },
  { cat: 'Furniture', id: 'teacher_desk', label: 'Teacher desk', w: UNIT * 1.4, h: UNIT * 0.7, color: '#c7d2fe' },
  // Tech
  { cat: 'Tech', id: 'writable_tv', label: 'Writable TV', w: UNIT * 1.8, h: UNIT * 0.2, color: '#1e293b' },
  { cat: 'Tech', id: 'tablet_cart', label: 'Tablet Cart', w: UNIT * 0.6, h: UNIT * 0.6, color: '#a5b4fc' },
  { cat: 'Tech', id: 'printer_3d', label: '3D Printer', w: UNIT * 0.6, h: UNIT * 0.6, color: '#c084fc' },
  // Cognitive
  { cat: 'Cognitive', id: 'whiteboard', label: 'Mobile whiteboard', w: UNIT * 1.5, h: UNIT * 0.15, color: '#f1f5f9' },
  { cat: 'Cognitive', id: 'tool_cabinet', label: 'Tool cabinet', w: UNIT * 0.7, h: UNIT * 0.5, color: '#a8a29e' },
  // Social
  { cat: 'Social', id: 'group_table', label: 'Group table (6)', w: UNIT * 1.8, h: UNIT * 1.2, color: '#bbf7d0', round: true },
  { cat: 'Social', id: 'partition', label: 'Mobile partition', w: UNIT * 1.5, h: UNIT * 0.1, color: '#94a3b8' },
  // Emotional
  { cat: 'Emotional', id: 'couch', label: 'Couch', w: UNIT * 1.5, h: UNIT * 0.7, color: '#fca5a5' },
  { cat: 'Emotional', id: 'beanbag', label: 'Beanbag', w: UNIT * 0.6, h: UNIT * 0.6, color: '#f9a8d4', round: true },
  { cat: 'Emotional', id: 'plant', label: 'Plant', w: UNIT * 0.4, h: UNIT * 0.4, color: '#86efac', round: true },
  // Zones
  { cat: 'Zones', id: 'zone_cog', label: 'Zone: Cognitive', w: UNIT * 3, h: UNIT * 3, color: 'rgba(59,130,246,0.1)', zone: true, border: '#3b82f6' },
  { cat: 'Zones', id: 'zone_soc', label: 'Zone: Social', w: UNIT * 3, h: UNIT * 3, color: 'rgba(16,185,129,0.1)', zone: true, border: '#10b981' },
  { cat: 'Zones', id: 'zone_emo', label: 'Zone: Emotional', w: UNIT * 3, h: UNIT * 3, color: 'rgba(245,158,11,0.1)', zone: true, border: '#f59e0b' },
  { cat: 'Zones', id: 'text_label', label: 'Text label', w: UNIT * 2, h: UNIT * 0.6, color: 'transparent', text: true },
];

/* ═══════════ Presets ═══════════ */
const PRESETS = [
  { id: 'direct', label: 'Direct Instruction', desc: 'Rows facing front', icon: '📣' },
  { id: 'pods', label: 'Collaborative Pods', desc: '6-person clusters', icon: '🤝' },
  { id: 'stations', label: 'Stations', desc: 'Activity rotation', icon: '🔄' },
  { id: 'ushape', label: 'U-Shape', desc: 'Discussion-friendly', icon: '🗣️' },
  { id: 'quiet', label: 'Quiet Work', desc: 'Individual focus', icon: '📝' },
  { id: 'gallery', label: 'Gallery Walk', desc: 'Exhibition displays', icon: '🖼️' },
];

const METRIC_LABELS = ['Sightlines', 'Mobility', 'Flexibility', 'Density', 'Modality', 'Environment'];

/* ═══════════ Render ═══════════ */
export function render(container) {
  container.innerHTML = `
    <div class="three-col" style="height:100%;">
      <!-- Left: Palette -->
      <div class="panel" style="overflow-y:auto;padding:var(--sp-4);gap:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
          <h3 class="panel-title" style="font-size:0.9375rem;">Furniture</h3>
          <span class="text-caption" style="color:var(--ink-faint);">Drag to canvas</span>
        </div>
        <div id="palette"></div>

        <hr class="divider" />

        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-3);">Presets</h3>
        <div id="presets" style="display:flex;flex-direction:column;gap:var(--sp-2);"></div>

        <hr class="divider" />

        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-3);">Controls</h3>
        <div style="display:flex;flex-direction:column;gap:var(--sp-2);font-size:0.8125rem;">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <label class="input-label" style="min-width:70px;">Students:</label>
            <input type="number" id="student-count" class="input" style="width:70px;padding:var(--sp-1) var(--sp-2);font-size:0.8125rem;" value="30" min="1" max="60" />
          </div>
          <label class="toggle" style="font-size:0.8125rem;">
            <input type="checkbox" class="toggle-input" id="snap-toggle" checked />
            <span class="toggle-track"></span>
            <span class="toggle-label">Snap to grid</span>
          </label>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-top:var(--sp-2);">
            <button class="btn btn-ghost btn-sm" id="clear-canvas">Clear All</button>
            <button class="btn btn-ghost btn-sm" id="save-layout">Save Layout</button>
          </div>
          <p class="text-caption" style="color:var(--ink-faint);line-height:1.5;margin-top:var(--sp-1);">
            <strong>R</strong> rotate &middot; <strong>Del</strong> delete &middot; <strong>Arrows</strong> nudge &middot; <strong>Shift</strong> multi-select
          </p>
        </div>
      </div>

      <!-- Center: Canvas -->
      <div style="display:flex;flex-direction:column;overflow:hidden;border-radius:var(--radius-xl);background:var(--surface);box-shadow:var(--shadow-card);">
        <svg id="spatial-svg" viewBox="0 0 ${VB_W} ${VB_H}" style="flex:1;cursor:crosshair;display:block;background:#fff;border-radius:var(--radius-xl);" xmlns="${SVG_NS}">
          <defs>
            <pattern id="grid" width="${UNIT}" height="${UNIT}" patternUnits="userSpaceOnUse">
              <path d="M ${UNIT} 0 L 0 0 0 ${UNIT}" fill="none" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="2,4"/>
            </pattern>
            <filter id="dshadow"><feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.15"/></filter>
          </defs>
          <rect width="${VB_W}" height="${VB_H}" fill="url(#grid)"/>
          <!-- Room walls -->
          <rect x="1" y="1" width="${VB_W - 2}" height="${VB_H - 2}" fill="none" stroke="#94a3b8" stroke-width="2" rx="4"/>
          <!-- Door -->
          <rect x="${VB_W - 60}" y="${VB_H - 2}" width="50" height="3" fill="#f59e0b" rx="1"/>
          <text x="${VB_W - 35}" y="${VB_H - 6}" font-size="8" fill="#b45309" text-anchor="middle" font-family="var(--font-sans)">Door</text>
          <!-- Windows -->
          <rect x="0" y="1" width="2" height="${VB_H - 2}" fill="#60a5fa" opacity="0.3"/>
          <text x="8" y="14" font-size="8" fill="#3b82f6" font-family="var(--font-sans)">Windows</text>
          <!-- Front label -->
          <text x="${VB_W / 2}" y="14" font-size="9" fill="#94a3b8" text-anchor="middle" font-family="var(--font-sans)" font-weight="600">FRONT OF CLASSROOM</text>
          <g id="layout-root"></g>
          <g id="selection-box" style="pointer-events:none;"></g>
        </svg>
      </div>

      <!-- Right: Analysis -->
      <div class="panel" style="overflow-y:auto;padding:var(--sp-4);gap:0;">
        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-4);">Effectiveness Analysis</h3>
        <div id="metrics-bars" style="display:flex;flex-direction:column;gap:var(--sp-4);"></div>

        <hr class="divider" />

        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-3);">Insights</h3>
        <div id="insights" style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;"></div>

        <hr class="divider" />

        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-3);">Saved Layouts</h3>
        <div id="saved-layouts"></div>
      </div>
    </div>
  `;

  const svg = container.querySelector('#spatial-svg');
  const layoutRoot = svg.querySelector('#layout-root');
  const selBox = svg.querySelector('#selection-box');
  const snapToggle = container.querySelector('#snap-toggle');
  const studentCountInput = container.querySelector('#student-count');

  let selected = new Set();
  let dragging = null;
  let marquee = null;
  let currentPreset = null;

  /* ── Palette ── */
  const paletteEl = container.querySelector('#palette');
  let currentCat = null;
  PALETTE.forEach(item => {
    if (item.cat !== currentCat) {
      currentCat = item.cat;
      paletteEl.insertAdjacentHTML('beforeend', `<div class="sidebar-section-label" style="padding:var(--sp-2) 0 var(--sp-1);">${item.cat}</div>`);
    }
    const btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.style.cssText = 'padding:var(--sp-1) var(--sp-2);font-size:0.8125rem;gap:var(--sp-2);';
    btn.innerHTML = `
      <span style="width:18px;height:14px;border-radius:3px;background:${item.zone ? item.border : item.color};border:1px solid rgba(0,0,0,0.1);flex-shrink:0;${item.round ? 'border-radius:50%;' : ''}"></span>
      ${item.label}
    `;
    btn.addEventListener('click', () => {
      const g = createItem(item, VB_W / 2 - item.w / 2, VB_H / 2 - (item.h || item.w) / 2);
      layoutRoot.appendChild(g);
      clearSelection();
      selectItem(g);
      updateMetrics();
    });
    paletteEl.appendChild(btn);
  });

  /* ── Presets ── */
  const presetsEl = container.querySelector('#presets');
  PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'card card-hover card-interactive';
    btn.style.cssText = 'padding:var(--sp-2) var(--sp-3);text-align:left;';
    btn.innerHTML = `<div style="display:flex;align-items:center;gap:var(--sp-2);"><span style="font-size:1.1rem;">${p.icon}</span><div><div style="font-weight:600;font-size:0.8125rem;color:var(--ink);">${p.label}</div><div style="font-size:0.6875rem;color:var(--ink-muted);">${p.desc}</div></div></div>`;
    btn.addEventListener('click', () => applyPreset(p.id));
    presetsEl.appendChild(btn);
  });

  /* ── Saved layouts ── */
  renderSavedLayouts();

  /* ══════ SVG item creation ══════ */
  function createItem(def, x, y, rot = 0) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${x},${y}) rotate(${rot})`);
    g.setAttribute('data-id', def.id);
    g.setAttribute('data-cat', def.cat);
    g.style.cursor = 'grab';
    g.setAttribute('filter', 'url(#dshadow)');

    const w = def.w, h = def.h || def.w;

    if (def.zone) {
      const r = document.createElementNS(SVG_NS, 'rect');
      Object.entries({ x: 0, y: 0, width: w, height: h, fill: def.color, stroke: def.border, 'stroke-width': 1.5, 'stroke-dasharray': '6,3', rx: 8 }).forEach(([k, v]) => r.setAttribute(k, v));
      g.appendChild(r);
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', w / 2); t.setAttribute('y', 16);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '9'); t.setAttribute('fill', def.border);
      t.setAttribute('font-family', 'var(--font-sans)'); t.setAttribute('font-weight', '600');
      t.textContent = def.label.replace('Zone: ', '');
      g.appendChild(t);
    } else if (def.text) {
      const r = document.createElementNS(SVG_NS, 'rect');
      Object.entries({ x: 0, y: 0, width: w, height: h, fill: 'rgba(0,0,0,0.03)', stroke: '#cbd5e1', 'stroke-width': 0.5, 'stroke-dasharray': '3,3', rx: 4 }).forEach(([k, v]) => r.setAttribute(k, v));
      g.appendChild(r);
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', w / 2); t.setAttribute('y', h / 2 + 4);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-size', '10'); t.setAttribute('fill', '#64748b');
      t.setAttribute('font-family', 'var(--font-sans)');
      t.textContent = 'Label';
      g.appendChild(t);
      g.addEventListener('dblclick', () => {
        const newText = prompt('Enter label text:', t.textContent);
        if (newText !== null) t.textContent = newText;
      });
    } else if (def.round) {
      const c = document.createElementNS(SVG_NS, 'ellipse');
      const rx = w / 2, ry = h / 2;
      Object.entries({ cx: rx, cy: ry, rx, ry, fill: def.color, stroke: '#0f172a', 'stroke-width': 1 }).forEach(([k, v]) => c.setAttribute(k, v));
      g.appendChild(c);
      if (def.id === 'plant') {
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', rx); t.setAttribute('y', ry + 5); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '14');
        t.textContent = '🌿';
        g.appendChild(t);
      }
    } else if (def.trap) {
      const poly = document.createElementNS(SVG_NS, 'polygon');
      const inset = w * 0.15;
      poly.setAttribute('points', `${inset},0 ${w - inset},0 ${w},${h} 0,${h}`);
      poly.setAttribute('fill', def.color); poly.setAttribute('stroke', '#0f172a'); poly.setAttribute('stroke-width', '1');
      g.appendChild(poly);
    } else {
      // Rectangle
      const r = document.createElementNS(SVG_NS, 'rect');
      Object.entries({ x: 0, y: 0, width: w, height: h, fill: def.color, stroke: '#0f172a', 'stroke-width': 1, rx: 3 }).forEach(([k, v]) => r.setAttribute(k, v));
      g.appendChild(r);
      // Desk edge indicator (front)
      if (def.id.startsWith('desk') || def.id === 'teacher_desk' || def.id === 'stand_table') {
        const edge = document.createElementNS(SVG_NS, 'rect');
        Object.entries({ x: 2, y: 0, width: w - 4, height: 3, fill: '#0f172a', rx: 1 }).forEach(([k, v]) => edge.setAttribute(k, v));
        g.appendChild(edge);
      }
      if (def.id === 'writable_tv') {
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', w / 2); t.setAttribute('y', h + 12);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '7'); t.setAttribute('fill', '#64748b');
        t.textContent = 'TV'; g.appendChild(t);
      }
    }

    // Label
    if (!def.zone && !def.text) {
      const lbl = document.createElementNS(SVG_NS, 'text');
      lbl.setAttribute('x', w / 2); lbl.setAttribute('y', (def.round ? h / 2 + 4 : h + 10));
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('font-size', '7'); lbl.setAttribute('fill', '#94a3b8');
      lbl.setAttribute('font-family', 'var(--font-sans)');
      lbl.textContent = def.label;
      if (!def.round) g.appendChild(lbl);
    }

    makeDraggable(g);
    return g;
  }

  /* ══════ Drag & drop ══════ */
  function getMouseSVG(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM().inverse();
    const svgPt = pt.matrixTransform(ctm);
    return { x: svgPt.x, y: svgPt.y };
  }

  function getTranslate(g) {
    const t = g.getAttribute('transform') || '';
    const m = t.match(/translate\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
  }

  function getRotate(g) {
    const t = g.getAttribute('transform') || '';
    const m = t.match(/rotate\(\s*([\d.-]+)\s*\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function snap(v) { return snapToggle.checked ? Math.round(v / GRID_SNAP) * GRID_SNAP : v; }

  function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

  function makeDraggable(g) {
    let offset = { x: 0, y: 0 }, isDragging = false, groupStart = null;

    g.addEventListener('pointerdown', e => {
      e.stopPropagation();
      isDragging = true;
      g.style.cursor = 'grabbing';
      g.setPointerCapture(e.pointerId);

      if (!e.shiftKey && !selected.has(g)) { clearSelection(); selectItem(g); }
      else if (e.shiftKey) { toggleSelect(g); }

      const { x, y } = getMouseSVG(e);
      groupStart = [...selected].map(n => ({ n, t: getTranslate(n) }));
      const me = groupStart.find(s => s.n === g)?.t || getTranslate(g);
      offset = { x: x - me[0], y: y - me[1] };
    });

    g.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const { x, y } = getMouseSVG(e);
      let nx = snap(x - offset.x), ny = snap(y - offset.y);
      nx = clamp(nx, 0, VB_W - UNIT * 0.5);
      ny = clamp(ny, 0, VB_H - UNIT * 0.5);

      const me = groupStart.find(s => s.n === g)?.t || [0, 0];
      const dx = nx - me[0], dy = ny - me[1];
      groupStart.forEach(s => {
        const px = clamp(s.t[0] + dx, 0, VB_W - UNIT * 0.5);
        const py = clamp(s.t[1] + dy, 0, VB_H - UNIT * 0.5);
        s.n.setAttribute('transform', `translate(${px},${py}) rotate(${getRotate(s.n)})`);
      });
      drawSelectionBox();
    });

    g.addEventListener('pointerup', () => {
      isDragging = false;
      g.style.cursor = 'grab';
      groupStart = null;
      updateMetrics();
    });
  }

  /* ── Selection ── */
  function selectItem(g) { selected.add(g); drawSelectionBox(); }
  function toggleSelect(g) {
    if (selected.has(g)) selected.delete(g); else selected.add(g);
    drawSelectionBox();
  }
  function clearSelection() { selected.clear(); selBox.innerHTML = ''; }

  function drawSelectionBox() {
    selBox.innerHTML = '';
    selected.forEach(g => {
      const [tx, ty] = getTranslate(g);
      const bb = g.getBBox();
      const r = document.createElementNS(SVG_NS, 'rect');
      Object.entries({ x: tx + bb.x - 3, y: ty + bb.y - 3, width: bb.width + 6, height: bb.height + 6, fill: 'none', stroke: '#3b82f6', 'stroke-width': 1.5, 'stroke-dasharray': '4,3', rx: 4 }).forEach(([k, v]) => r.setAttribute(k, v));
      selBox.appendChild(r);
    });
  }

  /* ── Marquee select ── */
  svg.addEventListener('pointerdown', e => {
    if (e.target !== svg && e.target.tagName !== 'rect') return;
    const items = layoutRoot.querySelectorAll('g[data-id]');
    let hit = false;
    items.forEach(g => { if (g.contains(e.target)) hit = true; });
    if (hit) return;

    clearSelection();
    const { x, y } = getMouseSVG(e);
    marquee = { x, y, el: null };
    const r = document.createElementNS(SVG_NS, 'rect');
    Object.entries({ x, y, width: 0, height: 0, fill: 'rgba(59,130,246,0.08)', stroke: '#3b82f6', 'stroke-width': 0.8, rx: 2 }).forEach(([k, v]) => r.setAttribute(k, v));
    selBox.appendChild(r);
    marquee.el = r;

    function onMove(ev) {
      if (!marquee) return;
      const p = getMouseSVG(ev);
      const mx = Math.min(marquee.x, p.x), my = Math.min(marquee.y, p.y);
      const mw = Math.abs(p.x - marquee.x), mh = Math.abs(p.y - marquee.y);
      marquee.el.setAttribute('x', mx); marquee.el.setAttribute('y', my);
      marquee.el.setAttribute('width', mw); marquee.el.setAttribute('height', mh);
    }

    function onUp(ev) {
      if (!marquee) return;
      const p = getMouseSVG(ev);
      const mx = Math.min(marquee.x, p.x), my = Math.min(marquee.y, p.y);
      const mw = Math.abs(p.x - marquee.x), mh = Math.abs(p.y - marquee.y);
      items.forEach(g => {
        const [tx, ty] = getTranslate(g);
        if (tx >= mx && ty >= my && tx <= mx + mw && ty <= my + mh) selectItem(g);
      });
      marquee.el.remove();
      marquee = null;
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
    }

    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
  });

  /* ── Keyboard ── */
  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (selected.size === 0) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      selected.forEach(g => g.remove());
      clearSelection();
      updateMetrics();
      e.preventDefault();
    }
    if (e.key === 'r' || e.key === 'R') {
      const step = e.shiftKey ? 15 : 45;
      selected.forEach(g => {
        const [tx, ty] = getTranslate(g);
        const r = getRotate(g) + step;
        g.setAttribute('transform', `translate(${tx},${ty}) rotate(${r % 360})`);
      });
      drawSelectionBox();
      updateMetrics();
    }
    if (e.key.startsWith('Arrow')) {
      const step = e.shiftKey ? GRID_SNAP : 5;
      const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
      const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
      selected.forEach(g => {
        const [tx, ty] = getTranslate(g);
        const nx = clamp(tx + dx, 0, VB_W - UNIT * 0.5);
        const ny = clamp(ty + dy, 0, VB_H - UNIT * 0.5);
        g.setAttribute('transform', `translate(${nx},${ny}) rotate(${getRotate(g)})`);
      });
      drawSelectionBox();
      updateMetrics();
      e.preventDefault();
    }
  }
  document.addEventListener('keydown', onKey);

  /* ══════ Presets ══════ */
  function applyPreset(name) {
    layoutRoot.innerHTML = '';
    clearSelection();
    currentPreset = name;
    const count = parseInt(studentCountInput.value) || 30;

    function place(def, x, y, rot = 0) {
      layoutRoot.appendChild(createItem(def, x, y, rot));
    }
    const desk = PALETTE.find(p => p.id === 'desk_rect');
    const chair = PALETTE.find(p => p.id === 'chair');
    const tv = PALETTE.find(p => p.id === 'writable_tv');
    const wb = PALETTE.find(p => p.id === 'whiteboard');
    const td = PALETTE.find(p => p.id === 'teacher_desk');
    const gt = PALETTE.find(p => p.id === 'group_table');
    const bb = PALETTE.find(p => p.id === 'beanbag');

    if (name === 'direct') {
      place(td, VB_W / 2 - td.w / 2, 30);
      place(tv, VB_W / 2 - tv.w / 2, 10);
      const cols = Math.min(6, Math.ceil(count / 5));
      const rows = Math.ceil(count / cols);
      const startX = (VB_W - cols * (UNIT + 20)) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols && r * cols + c < count; c++) {
          place(desk, startX + c * (UNIT + 20), 120 + r * (UNIT + 15));
        }
      }
    } else if (name === 'pods') {
      place(tv, VB_W / 2 - tv.w / 2, 10);
      const pods = Math.ceil(count / 6);
      const podCols = Math.min(3, pods);
      const podRows = Math.ceil(pods / podCols);
      const gapX = VB_W / (podCols + 1), gapY = (VB_H - 80) / (podRows + 1);
      for (let i = 0; i < pods; i++) {
        const col = i % podCols, row = Math.floor(i / podCols);
        const cx = gapX * (col + 1), cy = 80 + gapY * (row + 1);
        place(gt, cx - gt.w / 2, cy - gt.h / 2);
        for (let j = 0; j < 6 && i * 6 + j < count; j++) {
          const angle = (j * 60 - 90) * Math.PI / 180;
          const radius = UNIT * 1.2;
          place(chair, cx + Math.cos(angle) * radius - chair.w / 2, cy + Math.sin(angle) * radius - chair.h / 2);
        }
      }
    } else if (name === 'stations') {
      const stationDefs = [
        { label: 'Cognitive', def: wb },
        { label: 'Tech', def: PALETTE.find(p => p.id === 'tablet_cart') },
        { label: 'Creative', def: PALETTE.find(p => p.id === 'stand_table') },
        { label: 'Discussion', def: gt }
      ];
      const cols = 2, rows = 2;
      const gapX = VB_W / (cols + 1), gapY = VB_H / (rows + 1);
      stationDefs.forEach((st, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = gapX * (col + 1), cy = gapY * (row + 1);
        const zone = PALETTE.find(p => p.id === 'zone_cog');
        place(zone, cx - zone.w / 2, cy - zone.h / 2);
        if (st.def) place(st.def, cx - st.def.w / 2, cy - st.def.h / 2);
        const perStation = Math.ceil(count / stationDefs.length);
        for (let j = 0; j < Math.min(perStation, 4); j++) {
          place(chair, cx - UNIT + j * (chair.w + 10), cy + UNIT * 0.8);
        }
      });
    } else if (name === 'ushape') {
      place(td, VB_W / 2 - td.w / 2, 30);
      place(tv, VB_W / 2 - tv.w / 2, 10);
      const sideCount = Math.floor(count / 3);
      const bottomCount = count - sideCount * 2;
      const margin = 60;
      // Left side
      for (let i = 0; i < sideCount; i++) {
        place(desk, margin, 100 + i * (UNIT + 10), 90);
      }
      // Right side
      for (let i = 0; i < sideCount; i++) {
        place(desk, VB_W - margin - desk.h, 100 + i * (UNIT + 10), 90);
      }
      // Bottom
      const bStart = (VB_W - bottomCount * (UNIT + 10)) / 2;
      for (let i = 0; i < bottomCount; i++) {
        place(desk, bStart + i * (UNIT + 10), VB_H - margin - desk.h, 180);
      }
    } else if (name === 'quiet') {
      const cols = Math.min(8, Math.ceil(Math.sqrt(count * 1.5)));
      const rows = Math.ceil(count / cols);
      const gapX = (VB_W - 120) / cols, gapY = (VB_H - 80) / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols && r * cols + c < count; c++) {
          place(desk, 60 + c * gapX, 40 + r * gapY);
        }
      }
    } else if (name === 'gallery') {
      // Whiteboards around edges
      const spacing = VB_W / 5;
      for (let i = 0; i < 4; i++) {
        place(wb, spacing * (i + 0.5), 25, 0);
      }
      place(wb, 15, VB_H / 3, 90);
      place(wb, 15, VB_H * 2 / 3, 90);
      // Central discussion area
      for (let i = 0; i < Math.min(count, 20); i++) {
        const angle = (i / Math.min(count, 20)) * Math.PI * 2;
        const cx = VB_W / 2 + Math.cos(angle) * UNIT * 3.5;
        const cy = VB_H / 2 + Math.sin(angle) * UNIT * 2.5;
        place(chair, cx - chair.w / 2, cy - chair.h / 2);
      }
    }

    updateMetrics();
    showToast(`Applied "${PRESETS.find(p => p.id === name)?.label}" preset`);
  }

  /* ══════ Metrics calculation ══════ */
  function updateMetrics() {
    const items = [...layoutRoot.querySelectorAll('g[data-id]')];
    const desks = items.filter(g => {
      const id = g.getAttribute('data-id');
      return id.startsWith('desk') || id === 'stand_table';
    });
    const roomArea = VB_W * VB_H;
    const scores = [];

    // 1. Sightlines
    let sightlines = 30;
    const teachPoints = items.filter(g => ['teacher_desk', 'writable_tv', 'whiteboard'].includes(g.getAttribute('data-id'))).map(g => getTranslate(g));
    if (teachPoints.length === 0) teachPoints.push([VB_W / 2, 20]);
    if (desks.length > 0) {
      let good = 0;
      desks.forEach(d => {
        const [dx, dy] = getTranslate(d);
        const nearest = teachPoints.reduce((best, tp) => Math.hypot(tp[0] - dx, tp[1] - dy) < Math.hypot(best[0] - dx, best[1] - dy) ? tp : best);
        const dist = Math.hypot(nearest[0] - dx, nearest[1] - dy);
        if (dist < VB_W * 0.7) good++;
      });
      sightlines = 20 + Math.round((good / desks.length) * 80);
    }
    scores.push(Math.min(100, sightlines));

    // 2. Mobility
    let occupiedArea = items.reduce((acc, g) => {
      try { const b = g.getBBox(); return acc + b.width * b.height; } catch { return acc; }
    }, 0);
    scores.push(Math.min(100, Math.max(10, Math.round((1 - occupiedArea / roomArea) * 140 - 5))));

    // 3. Flexibility
    const types = new Set(items.map(g => g.getAttribute('data-id')));
    const mobile = ['whiteboard', 'partition', 'chair', 'beanbag', 'tablet_cart'];
    const mobileCount = items.filter(g => mobile.includes(g.getAttribute('data-id'))).length;
    let flex = 25 + types.size * 4 + (items.length > 0 ? (mobileCount / items.length) * 50 : 0);
    if (items.some(g => g.getAttribute('data-id').startsWith('zone_'))) flex += 10;
    scores.push(Math.min(100, Math.round(flex)));

    // 4. Density
    const cap = desks.length;
    let density = 50;
    if (cap > 0) {
      const perStudent = roomArea / cap;
      density = 10 + Math.round(Math.min(90, ((Math.min(perStudent, 40000) - 8000) / 32000) * 90));
    }
    scores.push(Math.min(100, Math.max(10, density)));

    // 5. Modality
    let clustered = 0;
    desks.forEach((d, i) => {
      const [dx, dy] = getTranslate(d);
      for (let j = i + 1; j < desks.length; j++) {
        const [ox, oy] = getTranslate(desks[j]);
        if (Math.hypot(dx - ox, dy - oy) < UNIT * 1.8) { clustered++; break; }
      }
    });
    let modality = 15;
    if (desks.length > 0 && clustered / desks.length > 0.4) modality += 30;
    if (types.has('writable_tv') || types.has('whiteboard')) modality += 25;
    if (types.has('group_table')) modality += 15;
    if (types.has('beanbag') || types.has('couch')) modality += 10;
    scores.push(Math.min(100, Math.round(modality)));

    // 6. Environment
    let env = 20;
    const plantCount = items.filter(g => g.getAttribute('data-id') === 'plant').length;
    env += Math.min(30, plantCount * 12);
    if (desks.length > 0) {
      const nearWindow = desks.filter(d => getTranslate(d)[0] < UNIT * 2).length;
      env += Math.round((nearWindow / desks.length) * 40);
    }
    scores.push(Math.min(100, Math.round(env)));

    renderMetrics(scores);
    renderInsights(items, scores);
  }

  function renderMetrics(scores) {
    const barsEl = container.querySelector('#metrics-bars');
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    barsEl.innerHTML = scores.map((s, i) => `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
          <span style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${METRIC_LABELS[i]}</span>
          <span style="font-size:0.8125rem;font-weight:700;color:${colors[i]};">${s}</span>
        </div>
        <div style="height:8px;background:var(--bg-subtle);border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${s}%;background:${colors[i]};border-radius:99px;transition:width 0.5s var(--ease);"></div>
        </div>
      </div>
    `).join('');
  }

  function renderInsights(items, scores) {
    const el = container.querySelector('#insights');
    const tips = [];
    if (scores[0] < 50) tips.push('Add a teaching point (TV / whiteboard) and orient desks towards it.');
    if (scores[1] < 40) tips.push('Room feels crowded. Remove some items or use a wider layout.');
    if (scores[2] < 40) tips.push('Add mobile items (whiteboards, partitions) for more flexibility.');
    if (scores[4] < 40) tips.push('Cluster some desks for collaborative work, or add group tables.');
    if (scores[5] < 40) tips.push('Add plants and position desks near windows for a better environment.');
    if (items.length === 0) tips.push('Start by selecting a preset or dragging items from the palette.');

    if (currentPreset) {
      const meta = PRESETS.find(p => p.id === currentPreset);
      if (meta) tips.unshift(`<strong>${meta.icon} ${meta.label}</strong>: ${meta.desc}. Customise further by dragging items.`);
    }

    el.innerHTML = tips.length > 0
      ? `<ul style="padding-left:1rem;margin:0;display:flex;flex-direction:column;gap:var(--sp-2);">${tips.map(t => `<li>${t}</li>`).join('')}</ul>`
      : `<p style="color:var(--success);">Looking great! Your layout scores well across all metrics.</p>`;
  }

  /* ══════ Save / Load layouts ══════ */
  container.querySelector('#save-layout').addEventListener('click', () => {
    const items = serializeLayout();
    if (items.length === 0) { showToast('Nothing to save — add items first.', 'danger'); return; }

    const { backdrop, close } = openModal({
      title: 'Save Layout',
      body: `<div class="input-group"><label class="input-label">Layout Name</label><input class="input" id="layout-name" placeholder="e.g. Pods for Science" /></div>`,
      footer: `<button class="btn btn-secondary" data-action="cancel">Cancel</button><button class="btn btn-primary" data-action="save">Save</button>`
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
    backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
      const name = backdrop.querySelector('#layout-name').value.trim() || 'Untitled Layout';
      Store.saveLayout({ name, items, studentCount: parseInt(studentCountInput.value) || 30 });
      showToast('Layout saved!', 'success');
      close();
      renderSavedLayouts();
    });
    setTimeout(() => backdrop.querySelector('#layout-name')?.focus(), 100);
  });

  container.querySelector('#clear-canvas').addEventListener('click', async () => {
    if (layoutRoot.children.length === 0) return;
    const ok = await confirmDialog({ title: 'Clear Canvas', message: 'Remove all items from the canvas?' });
    if (ok) { layoutRoot.innerHTML = ''; clearSelection(); currentPreset = null; updateMetrics(); }
  });

  function serializeLayout() {
    return [...layoutRoot.querySelectorAll('g[data-id]')].map(g => ({
      id: g.getAttribute('data-id'),
      x: getTranslate(g)[0],
      y: getTranslate(g)[1],
      r: getRotate(g)
    }));
  }

  function loadLayout(items) {
    layoutRoot.innerHTML = '';
    clearSelection();
    items.forEach(item => {
      const def = PALETTE.find(p => p.id === item.id);
      if (def) layoutRoot.appendChild(createItem(def, item.x, item.y, item.r || 0));
    });
    updateMetrics();
  }

  function renderSavedLayouts() {
    const el = container.querySelector('#saved-layouts');
    const layouts = Store.getSavedLayouts();
    if (layouts.length === 0) {
      el.innerHTML = `<p style="font-size:0.8125rem;color:var(--ink-faint);">No saved layouts yet.</p>`;
      return;
    }
    el.innerHTML = layouts.map(l => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;border-bottom:1px solid var(--border-light);">
        <button class="btn btn-ghost btn-sm load-layout" data-idx="${l.id}" style="font-weight:500;font-size:0.8125rem;">${l.name}</button>
        <button class="btn btn-ghost btn-sm del-layout" data-idx="${l.id}" style="color:var(--danger);font-size:0.6875rem;">Del</button>
      </div>
    `).join('');

    el.querySelectorAll('.load-layout').forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = layouts.find(l => l.id === btn.dataset.idx);
        if (layout) { loadLayout(layout.items); showToast(`Loaded "${layout.name}"`); }
      });
    });
    el.querySelectorAll('.del-layout').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.deleteLayout(btn.dataset.idx);
        showToast('Layout deleted');
        renderSavedLayouts();
      });
    });
  }

  // Initial metrics
  updateMetrics();

  // Cleanup on route change
  return () => { document.removeEventListener('keydown', onKey); };
}
