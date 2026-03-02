/*
 * Simple Circuits Simulator
 * ==========================
 * SVG-based circuit builder with drag-and-drop components,
 * wire connections, and Kirchhoff's law analysis for
 * simple series and parallel circuits.
 */

(() => {
  'use strict';

  /* ═══════════ Constants ═══════════ */

  const GRID_SIZE = 40;
  const COMPONENT_WIDTH = 80;   // px on grid
  const COMPONENT_HEIGHT = 40;
  const SNAP_THRESHOLD = 20;
  const BULB_NOMINAL_CURRENT = 0.3; // A — for brightness reference
  const BULB_RESISTANCE = 20;       // ohms — assumed resistance of bulb

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ═══════════ DOM References ═══════════ */

  const svg             = document.getElementById('circuitSVG');
  const workspaceContainer = document.getElementById('workspaceContainer');
  const toastContainer  = document.getElementById('toastContainer');
  const totalVoltageEl  = document.getElementById('totalVoltage');
  const totalResistanceEl = document.getElementById('totalResistance');
  const totalCurrentEl  = document.getElementById('totalCurrent');
  const circuitStatusEl = document.getElementById('circuitStatus');
  const btnPresetSeries = document.getElementById('btnPresetSeries');
  const btnPresetParallel = document.getElementById('btnPresetParallel');
  const btnClearAll     = document.getElementById('btnClearAll');
  const btnFullscreen   = document.getElementById('btnFullscreen');

  /* ═══════════ State ═══════════ */

  let nextId = 1;
  let components = [];  // { id, type, value, x, y, rotation, closed (switch), element }
  let wires = [];       // { id, from: {compId, terminal}, to: {compId, terminal}, element }
  let selectedComponent = null;
  let draggingComponent = null;
  let dragOffset = { x: 0, y: 0 };
  let wireDrawing = null; // { fromCompId, fromTerminal, previewLine }
  let contextMenu = null;

  /* ═══════════ Toast Helper ═══════════ */

  function showToast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  /* ═══════════ SVG Helpers ═══════════ */

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  function snapToGrid(val) {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }

  function getSVGPoint(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /* ═══════════ Draw Grid ═══════════ */

  function drawGrid() {
    // Remove existing grid
    const existing = svg.querySelector('.grid-group');
    if (existing) existing.remove();

    const g = svgEl('g', { class: 'grid-group' });
    const rect = svg.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    for (let x = 0; x <= w; x += GRID_SIZE) {
      const isMajor = x % (GRID_SIZE * 5) === 0;
      g.appendChild(svgEl('line', {
        x1: x, y1: 0, x2: x, y2: h,
        class: isMajor ? 'grid-line-major' : 'grid-line'
      }));
    }
    for (let y = 0; y <= h; y += GRID_SIZE) {
      const isMajor = y % (GRID_SIZE * 5) === 0;
      g.appendChild(svgEl('line', {
        x1: 0, y1: y, x2: w, y2: y,
        class: isMajor ? 'grid-line-major' : 'grid-line'
      }));
    }

    // Insert grid behind everything
    svg.insertBefore(g, svg.firstChild);
  }

  /* ═══════════ Terminal Positions ═══════════ */

  function getTerminalPositions(comp) {
    const cx = comp.x;
    const cy = comp.y;
    // Terminals at left and right of component
    return {
      left:  { x: cx - COMPONENT_WIDTH / 2, y: cy },
      right: { x: cx + COMPONENT_WIDTH / 2, y: cy }
    };
  }

  /* ═══════════ Render Component SVG ═══════════ */

  function renderComponent(comp) {
    const g = svgEl('g', {
      class: 'component-group',
      'data-id': comp.id,
      transform: `translate(${comp.x}, ${comp.y})`
    });

    const hw = COMPONENT_WIDTH / 2;
    const hh = COMPONENT_HEIGHT / 2;

    switch (comp.type) {
      case 'battery': {
        // Wires to terminals
        g.appendChild(svgEl('line', { x1: -hw, y1: 0, x2: -12, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        g.appendChild(svgEl('line', { x1: 12, y1: 0, x2: hw, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        // Battery symbol
        const color = comp.value <= 1.5 ? '#3b82f6' : comp.value <= 3 ? '#f59e0b' : '#f43f5e';
        // Thin line (negative)
        g.appendChild(svgEl('line', { x1: -8, y1: -10, x2: -8, y2: 10, stroke: color, 'stroke-width': 1.5 }));
        // Thick line (positive)
        g.appendChild(svgEl('line', { x1: -2, y1: -16, x2: -2, y2: 16, stroke: color, 'stroke-width': 3 }));
        g.appendChild(svgEl('line', { x1: 4, y1: -10, x2: 4, y2: 10, stroke: color, 'stroke-width': 1.5 }));
        g.appendChild(svgEl('line', { x1: 10, y1: -16, x2: 10, y2: 16, stroke: color, 'stroke-width': 3 }));
        // + / - labels
        const plus = svgEl('text', { x: hw - 4, y: -8, class: 'component-label', 'text-anchor': 'middle', fill: color });
        plus.textContent = '+';
        g.appendChild(plus);
        const minus = svgEl('text', { x: -hw + 4, y: -8, class: 'component-label', 'text-anchor': 'middle', fill: color });
        minus.textContent = '\u2013';
        g.appendChild(minus);
        // Value
        const valLabel = svgEl('text', { x: 0, y: 28, class: 'component-value-label', 'text-anchor': 'middle' });
        valLabel.textContent = comp.value + 'V';
        g.appendChild(valLabel);
        break;
      }

      case 'resistor': {
        g.appendChild(svgEl('line', { x1: -hw, y1: 0, x2: -20, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        g.appendChild(svgEl('line', { x1: 20, y1: 0, x2: hw, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        const rColor = comp.value <= 10 ? '#10b981' : comp.value <= 47 ? '#8b5cf6' : '#f43f5e';
        const fillColor = comp.value <= 10 ? 'rgba(16,185,129,0.08)' : comp.value <= 47 ? 'rgba(139,92,246,0.08)' : 'rgba(244,63,94,0.08)';
        g.appendChild(svgEl('rect', { x: -20, y: -10, width: 40, height: 20, rx: 2, stroke: rColor, 'stroke-width': 1.5, fill: fillColor }));
        const valLabel = svgEl('text', { x: 0, y: 4, class: 'component-value-label', 'text-anchor': 'middle', fill: rColor });
        valLabel.textContent = comp.value + '\u03A9';
        g.appendChild(valLabel);
        const nameLabel = svgEl('text', { x: 0, y: 26, class: 'component-label', 'text-anchor': 'middle' });
        nameLabel.textContent = 'R' + comp.id;
        g.appendChild(nameLabel);
        break;
      }

      case 'bulb': {
        g.appendChild(svgEl('line', { x1: -hw, y1: 0, x2: -14, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        g.appendChild(svgEl('line', { x1: 14, y1: 0, x2: hw, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        // Glow circle (behind)
        const glow = svgEl('circle', { cx: 0, cy: 0, r: 16, class: 'bulb-glow' });
        glow.setAttribute('data-glow', 'true');
        g.appendChild(glow);
        g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 12, class: 'bulb-circle' }));
        g.appendChild(svgEl('line', { x1: -8, y1: -8, x2: 8, y2: 8, class: 'bulb-cross' }));
        g.appendChild(svgEl('line', { x1: 8, y1: -8, x2: -8, y2: 8, class: 'bulb-cross' }));
        const nameLabel = svgEl('text', { x: 0, y: 26, class: 'component-label', 'text-anchor': 'middle' });
        nameLabel.textContent = 'Bulb';
        g.appendChild(nameLabel);
        break;
      }

      case 'ammeter': {
        g.appendChild(svgEl('line', { x1: -hw, y1: 0, x2: -14, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        g.appendChild(svgEl('line', { x1: 14, y1: 0, x2: hw, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 14, class: 'ammeter-circle' }));
        const aLabel = svgEl('text', { x: 0, y: 5, class: 'ammeter-label', 'text-anchor': 'middle' });
        aLabel.textContent = 'A';
        g.appendChild(aLabel);
        const reading = svgEl('text', { x: 0, y: 28, class: 'ammeter-reading', 'text-anchor': 'middle' });
        reading.textContent = '0.00 A';
        reading.setAttribute('data-reading', 'true');
        g.appendChild(reading);
        break;
      }

      case 'voltmeter': {
        g.appendChild(svgEl('line', { x1: -hw, y1: 0, x2: -14, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        g.appendChild(svgEl('line', { x1: 14, y1: 0, x2: hw, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 14, class: 'voltmeter-circle' }));
        const vLabel = svgEl('text', { x: 0, y: 5, class: 'voltmeter-label', 'text-anchor': 'middle' });
        vLabel.textContent = 'V';
        g.appendChild(vLabel);
        const reading = svgEl('text', { x: 0, y: 28, class: 'voltmeter-reading', 'text-anchor': 'middle' });
        reading.textContent = '0.00 V';
        reading.setAttribute('data-reading', 'true');
        g.appendChild(reading);
        break;
      }

      case 'switch': {
        g.appendChild(svgEl('line', { x1: -hw, y1: 0, x2: -12, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        g.appendChild(svgEl('line', { x1: 12, y1: 0, x2: hw, y2: 0, stroke: '#94a3b8', 'stroke-width': 2 }));
        // Terminals
        g.appendChild(svgEl('circle', { cx: -12, cy: 0, r: 4, class: 'switch-terminal' }));
        g.appendChild(svgEl('circle', { cx: 12, cy: 0, r: 4, class: 'switch-terminal' }));
        // Switch arm
        const arm = svgEl('line', {
          x1: -12, y1: 0,
          x2: comp.closed ? 12 : 8,
          y2: comp.closed ? 0 : -14,
          class: 'switch-arm' + (comp.closed ? ' closed' : '')
        });
        arm.setAttribute('data-arm', 'true');
        g.appendChild(arm);
        const nameLabel = svgEl('text', { x: 0, y: 22, class: 'component-label', 'text-anchor': 'middle' });
        nameLabel.textContent = comp.closed ? 'ON' : 'OFF';
        nameLabel.setAttribute('data-switch-label', 'true');
        g.appendChild(nameLabel);
        break;
      }

      case 'wire': {
        // Simple pass-through wire node
        g.appendChild(svgEl('line', { x1: -hw, y1: 0, x2: hw, y2: 0, stroke: '#94a3b8', 'stroke-width': 2.5 }));
        g.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 3, fill: '#64748b' }));
        break;
      }
    }

    // Terminals (left and right)
    const leftTerm = svgEl('circle', { cx: -hw, cy: 0, r: 5, class: 'terminal', 'data-terminal': 'left', 'data-comp-id': comp.id });
    const rightTerm = svgEl('circle', { cx: hw, cy: 0, r: 5, class: 'terminal', 'data-terminal': 'right', 'data-comp-id': comp.id });
    g.appendChild(leftTerm);
    g.appendChild(rightTerm);

    comp.element = g;
    svg.appendChild(g);
    return g;
  }

  /* ═══════════ Render Wire ═══════════ */

  function renderWire(wire) {
    const fromComp = components.find(c => c.id === wire.from.compId);
    const toComp = components.find(c => c.id === wire.to.compId);
    if (!fromComp || !toComp) return;

    const fromTerms = getTerminalPositions(fromComp);
    const toTerms = getTerminalPositions(toComp);
    const p1 = fromTerms[wire.from.terminal];
    const p2 = toTerms[wire.to.terminal];

    if (wire.element) wire.element.remove();

    const line = svgEl('line', {
      x1: p1.x, y1: p1.y,
      x2: p2.x, y2: p2.y,
      class: 'wire-line',
      'data-wire-id': wire.id
    });

    wire.element = line;
    // Insert wires behind components
    const gridGroup = svg.querySelector('.grid-group');
    if (gridGroup && gridGroup.nextSibling) {
      svg.insertBefore(line, gridGroup.nextSibling);
    } else {
      svg.insertBefore(line, svg.firstChild);
    }
  }

  /* ═══════════ Add Component ═══════════ */

  function addComponent(type, value, x, y) {
    const comp = {
      id: nextId++,
      type,
      value: parseFloat(value) || 0,
      x: snapToGrid(x),
      y: snapToGrid(y),
      rotation: 0,
      closed: false, // for switches
      element: null,
    };
    components.push(comp);
    renderComponent(comp);
    analyzeCircuit();
    return comp;
  }

  /* ═══════════ Remove Component ═══════════ */

  function removeComponent(compId) {
    // Remove connected wires
    wires = wires.filter(w => {
      if (w.from.compId === compId || w.to.compId === compId) {
        if (w.element) w.element.remove();
        return false;
      }
      return true;
    });

    const idx = components.findIndex(c => c.id === compId);
    if (idx !== -1) {
      if (components[idx].element) components[idx].element.remove();
      components.splice(idx, 1);
    }

    if (selectedComponent === compId) selectedComponent = null;
    analyzeCircuit();
  }

  /* ═══════════ Add Wire ═══════════ */

  function addWire(fromCompId, fromTerminal, toCompId, toTerminal) {
    // Don't wire to self
    if (fromCompId === toCompId) return null;

    // Don't duplicate
    const exists = wires.find(w =>
      (w.from.compId === fromCompId && w.from.terminal === fromTerminal &&
       w.to.compId === toCompId && w.to.terminal === toTerminal) ||
      (w.from.compId === toCompId && w.from.terminal === toTerminal &&
       w.to.compId === fromCompId && w.to.terminal === fromTerminal)
    );
    if (exists) return null;

    const wire = {
      id: nextId++,
      from: { compId: fromCompId, terminal: fromTerminal },
      to: { compId: toCompId, terminal: toTerminal },
      element: null,
    };
    wires.push(wire);
    renderWire(wire);
    analyzeCircuit();
    return wire;
  }

  /* ═══════════ Update All Positions ═══════════ */

  function updatePositions() {
    components.forEach(comp => {
      if (comp.element) {
        comp.element.setAttribute('transform', `translate(${comp.x}, ${comp.y})`);
      }
    });
    wires.forEach(w => renderWire(w));
  }

  /* ═══════════ Drag & Drop from Palette ═══════════ */

  const paletteItems = document.querySelectorAll('.palette-item');

  paletteItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: item.dataset.type,
        value: item.dataset.value
      }));
      e.dataTransfer.effectAllowed = 'copy';
    });
  });

  workspaceContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  workspaceContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const pt = getSVGPoint(e.clientX, e.clientY);
      addComponent(data.type, data.value, pt.x, pt.y);
      showToast(`Added ${data.type}`, 'success');
    } catch (err) {
      // Ignore invalid drops
    }
  });

  /* ═══════════ Mouse Interactions on SVG ═══════════ */

  svg.addEventListener('mousedown', (e) => {
    closeContextMenu();

    const target = e.target;

    // Terminal click — start wire drawing
    if (target.classList.contains('terminal')) {
      e.stopPropagation();
      const compId = parseInt(target.getAttribute('data-comp-id'), 10);
      const terminal = target.getAttribute('data-terminal');
      const comp = components.find(c => c.id === compId);
      if (!comp) return;

      const terms = getTerminalPositions(comp);
      const pt = terms[terminal];

      const preview = svgEl('line', {
        x1: pt.x, y1: pt.y,
        x2: pt.x, y2: pt.y,
        class: 'wire-preview'
      });
      svg.appendChild(preview);

      wireDrawing = {
        fromCompId: compId,
        fromTerminal: terminal,
        previewLine: preview,
        startX: pt.x,
        startY: pt.y,
      };
      return;
    }

    // Switch click — toggle
    const switchGroup = target.closest('.component-group');
    if (switchGroup) {
      const compId = parseInt(switchGroup.getAttribute('data-id'), 10);
      const comp = components.find(c => c.id === compId);

      if (comp && comp.type === 'switch' && (target.getAttribute('data-arm') || target.classList.contains('switch-terminal') || target.getAttribute('data-switch-label'))) {
        comp.closed = !comp.closed;
        // Re-render
        comp.element.remove();
        renderComponent(comp);
        updatePositions();
        analyzeCircuit();
        showToast(`Switch ${comp.closed ? 'closed' : 'opened'}`, 'info');
        return;
      }
    }

    // Component drag
    const compGroup = target.closest('.component-group');
    if (compGroup && !target.classList.contains('terminal')) {
      const compId = parseInt(compGroup.getAttribute('data-id'), 10);
      const comp = components.find(c => c.id === compId);
      if (!comp) return;

      // Select
      selectComponent(compId);

      const pt = getSVGPoint(e.clientX, e.clientY);
      dragOffset = { x: pt.x - comp.x, y: pt.y - comp.y };
      draggingComponent = compId;
      compGroup.style.cursor = 'grabbing';
    } else if (!compGroup) {
      // Deselect
      selectComponent(null);
    }
  });

  svg.addEventListener('mousemove', (e) => {
    // Wire drawing preview
    if (wireDrawing) {
      const pt = getSVGPoint(e.clientX, e.clientY);
      wireDrawing.previewLine.setAttribute('x2', pt.x);
      wireDrawing.previewLine.setAttribute('y2', pt.y);
      return;
    }

    // Component dragging
    if (draggingComponent !== null) {
      const pt = getSVGPoint(e.clientX, e.clientY);
      const comp = components.find(c => c.id === draggingComponent);
      if (!comp) return;

      comp.x = snapToGrid(pt.x - dragOffset.x);
      comp.y = snapToGrid(pt.y - dragOffset.y);
      updatePositions();
    }
  });

  svg.addEventListener('mouseup', (e) => {
    // Finish wire drawing
    if (wireDrawing) {
      const target = e.target;
      if (target.classList.contains('terminal')) {
        const toCompId = parseInt(target.getAttribute('data-comp-id'), 10);
        const toTerminal = target.getAttribute('data-terminal');
        const wire = addWire(wireDrawing.fromCompId, wireDrawing.fromTerminal, toCompId, toTerminal);
        if (wire) {
          showToast('Wire connected', 'success');
        }
      }
      wireDrawing.previewLine.remove();
      wireDrawing = null;
      return;
    }

    // Stop component drag
    if (draggingComponent !== null) {
      const comp = components.find(c => c.id === draggingComponent);
      if (comp && comp.element) {
        comp.element.style.cursor = 'move';
      }
      draggingComponent = null;
      analyzeCircuit();
    }
  });

  /* ═══════════ Context Menu ═══════════ */

  svg.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const compGroup = e.target.closest('.component-group');
    if (!compGroup) return;

    const compId = parseInt(compGroup.getAttribute('data-id'), 10);
    showContextMenu(e.clientX, e.clientY, compId);
  });

  function showContextMenu(x, y, compId) {
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item danger';
    deleteItem.textContent = 'Delete Component';
    deleteItem.addEventListener('click', () => {
      removeComponent(compId);
      closeContextMenu();
      showToast('Component removed', 'info');
    });
    menu.appendChild(deleteItem);

    document.body.appendChild(menu);
    contextMenu = menu;
  }

  function closeContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
  }

  document.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
      closeContextMenu();
    }
  });

  /* ═══════════ Selection ═══════════ */

  function selectComponent(compId) {
    // Deselect previous
    if (selectedComponent !== null) {
      const prev = components.find(c => c.id === selectedComponent);
      if (prev && prev.element) {
        prev.element.classList.remove('selected');
      }
    }

    selectedComponent = compId;

    if (compId !== null) {
      const comp = components.find(c => c.id === compId);
      if (comp && comp.element) {
        comp.element.classList.add('selected');
      }
    }
  }

  /* ═══════════ Keyboard ═══════════ */

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedComponent !== null) {
        removeComponent(selectedComponent);
        showToast('Component deleted', 'info');
      }
    }
    if (e.key === 'Escape') {
      if (wireDrawing) {
        wireDrawing.previewLine.remove();
        wireDrawing = null;
      }
      closeContextMenu();
      selectComponent(null);
    }
  });

  /* ═══════════ Circuit Analysis ═══════════ */

  function analyzeCircuit() {
    /*
     * Graph-based analysis for simple series/parallel circuits.
     *
     * Strategy:
     * 1. Build an adjacency graph from components + wires
     * 2. Find all batteries and sum their voltages
     * 3. Find all resistive elements (resistors + bulbs)
     * 4. Detect series vs parallel topology
     * 5. Calculate total resistance, current, per-component values
     */

    const batteries = components.filter(c => c.type === 'battery');
    const switches = components.filter(c => c.type === 'switch');
    const resistors = components.filter(c => c.type === 'resistor');
    const bulbs = components.filter(c => c.type === 'bulb');
    const ammeters = components.filter(c => c.type === 'ammeter');
    const voltmeters = components.filter(c => c.type === 'voltmeter');

    // Default state
    let totalV = 0;
    let totalR = 0;
    let totalI = 0;
    let circuitClosed = false;

    // Sum battery voltages
    batteries.forEach(b => { totalV += b.value; });

    // Check if any switch is open
    const allSwitchesClosed = switches.every(s => s.closed);

    // Check we have a connected circuit: need at least 1 battery and wires
    if (batteries.length === 0 || wires.length === 0) {
      updateAnalysisDisplay(totalV, 0, 0, false);
      updateComponentReadings(0, {});
      return;
    }

    // Build adjacency: terminal → set of connected terminals
    // Each terminal is identified as "compId:left" or "compId:right"
    const adj = {};

    function termKey(compId, terminal) {
      return compId + ':' + terminal;
    }

    // Wire connections
    wires.forEach(w => {
      const a = termKey(w.from.compId, w.from.terminal);
      const b = termKey(w.to.compId, w.to.terminal);
      if (!adj[a]) adj[a] = new Set();
      if (!adj[b]) adj[b] = new Set();
      adj[a].add(b);
      adj[b].add(a);
    });

    // Internal connections (left-right of each component) — except open switches
    components.forEach(c => {
      if (c.type === 'switch' && !c.closed) return; // open switch breaks connection
      const l = termKey(c.id, 'left');
      const r = termKey(c.id, 'right');
      if (!adj[l]) adj[l] = new Set();
      if (!adj[r]) adj[r] = new Set();
      adj[l].add(r);
      adj[r].add(l);
    });

    // BFS to find connected nodes from battery positive terminal
    function bfs(start) {
      const visited = new Set();
      const queue = [start];
      visited.add(start);
      while (queue.length > 0) {
        const node = queue.shift();
        const neighbors = adj[node];
        if (neighbors) {
          neighbors.forEach(n => {
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          });
        }
      }
      return visited;
    }

    // Check circuit is closed: battery right terminal reaches battery left terminal
    if (batteries.length > 0) {
      const bat = batteries[0];
      const startKey = termKey(bat.id, 'right');
      const endKey = termKey(bat.id, 'left');
      const reachable = bfs(startKey);
      circuitClosed = reachable.has(endKey);
    }

    if (!circuitClosed || !allSwitchesClosed) {
      updateAnalysisDisplay(totalV, 0, 0, false);
      updateComponentReadings(0, {});
      return;
    }

    // Collect resistive loads
    const loads = [];
    resistors.forEach(r => loads.push({ id: r.id, type: 'resistor', R: r.value }));
    bulbs.forEach(b => loads.push({ id: b.id, type: 'bulb', R: BULB_RESISTANCE }));

    if (loads.length === 0) {
      // Short circuit — no resistance
      totalR = 0.01; // minimal
      totalI = totalV / totalR;
      updateAnalysisDisplay(totalV, totalR, totalI, true);
      updateComponentReadings(totalI, {});
      return;
    }

    // Detect parallel branches:
    // Two loads are in parallel if their left terminals are in the same node group
    // AND their right terminals are in the same node group (via wires only, not through components).

    // Build wire-only adjacency (no internal component connections)
    const wireAdj = {};
    wires.forEach(w => {
      const a = termKey(w.from.compId, w.from.terminal);
      const b = termKey(w.to.compId, w.to.terminal);
      if (!wireAdj[a]) wireAdj[a] = new Set();
      if (!wireAdj[b]) wireAdj[b] = new Set();
      wireAdj[a].add(b);
      wireAdj[b].add(a);
    });

    // Also connect through wire-type components and closed switches (they are just conductors)
    components.forEach(c => {
      if (c.type === 'wire' || (c.type === 'switch' && c.closed) || c.type === 'ammeter') {
        const l = termKey(c.id, 'left');
        const r = termKey(c.id, 'right');
        if (!wireAdj[l]) wireAdj[l] = new Set();
        if (!wireAdj[r]) wireAdj[r] = new Set();
        wireAdj[l].add(r);
        wireAdj[r].add(l);
      }
    });

    function wireOnlyBfs(start) {
      const visited = new Set();
      const queue = [start];
      visited.add(start);
      while (queue.length > 0) {
        const node = queue.shift();
        const neighbors = wireAdj[node];
        if (neighbors) {
          neighbors.forEach(n => {
            if (!visited.has(n)) {
              visited.add(n);
              queue.push(n);
            }
          });
        }
      }
      return visited;
    }

    // Group loads by their node connections
    const loadNodes = loads.map(load => {
      const leftKey = termKey(load.id, 'left');
      const rightKey = termKey(load.id, 'right');
      const leftGroup = wireOnlyBfs(leftKey);
      const rightGroup = wireOnlyBfs(rightKey);
      return { ...load, leftGroup, rightGroup };
    });

    // Find parallel groups: loads sharing same left-node-group and right-node-group
    const parallelGroups = [];
    const assigned = new Set();

    for (let i = 0; i < loadNodes.length; i++) {
      if (assigned.has(i)) continue;
      const group = [loadNodes[i]];
      assigned.add(i);

      for (let j = i + 1; j < loadNodes.length; j++) {
        if (assigned.has(j)) continue;

        // Check if they share the same pair of node groups
        const sameLeft = loadNodes[i].leftGroup.has(termKey(loadNodes[j].id, 'left'));
        const sameRight = loadNodes[i].rightGroup.has(termKey(loadNodes[j].id, 'right'));
        const crossLeftRight = loadNodes[i].leftGroup.has(termKey(loadNodes[j].id, 'right'));
        const crossRightLeft = loadNodes[i].rightGroup.has(termKey(loadNodes[j].id, 'left'));

        if ((sameLeft && sameRight) || (crossLeftRight && crossRightLeft)) {
          group.push(loadNodes[j]);
          assigned.add(j);
        }
      }
      parallelGroups.push(group);
    }

    // Calculate total resistance (series of parallel groups)
    totalR = 0;
    const groupResistances = [];

    parallelGroups.forEach(group => {
      if (group.length === 1) {
        totalR += group[0].R;
        groupResistances.push({ ids: [group[0].id], R: group[0].R });
      } else {
        // Parallel combination
        let invR = 0;
        group.forEach(load => { invR += 1 / load.R; });
        const Rpar = 1 / invR;
        totalR += Rpar;
        groupResistances.push({ ids: group.map(l => l.id), R: Rpar });
      }
    });

    if (totalR <= 0) totalR = 0.01;
    totalI = totalV / totalR;

    // Per-component voltage/current
    const compData = {};

    parallelGroups.forEach(group => {
      if (group.length === 1) {
        // Series element: carries total current
        const load = group[0];
        const V = totalI * load.R;
        compData[load.id] = { V, I: totalI, R: load.R };
      } else {
        // Parallel group: voltage across group is I_total * R_parallel
        let invR = 0;
        group.forEach(load => { invR += 1 / load.R; });
        const Rpar = 1 / invR;
        const Vgroup = totalI * Rpar;

        group.forEach(load => {
          const Ibranch = Vgroup / load.R;
          compData[load.id] = { V: Vgroup, I: Ibranch, R: load.R };
        });
      }
    });

    updateAnalysisDisplay(totalV, totalR, totalI, true);
    updateComponentReadings(totalI, compData);
  }

  /* ═══════════ Update Analysis Bar ═══════════ */

  function updateAnalysisDisplay(V, R, I, closed) {
    totalVoltageEl.textContent = V.toFixed(2);
    totalResistanceEl.textContent = R.toFixed(2);
    totalCurrentEl.textContent = I.toFixed(3);

    circuitStatusEl.textContent = closed ? 'Closed' : 'Open';
    circuitStatusEl.className = 'analysis-value analysis-status' + (closed ? ' closed' : '');

    // Wire animation
    wires.forEach(w => {
      if (w.element) {
        if (closed && I > 0.001) {
          w.element.classList.add('flowing');
        } else {
          w.element.classList.remove('flowing');
        }
      }
    });
  }

  /* ═══════════ Update Component Readings ═══════════ */

  function updateComponentReadings(totalCurrent, compData) {
    // Update ammeters
    components.filter(c => c.type === 'ammeter').forEach(comp => {
      const reading = comp.element ? comp.element.querySelector('[data-reading]') : null;
      if (reading) {
        reading.textContent = totalCurrent.toFixed(3) + ' A';
      }
    });

    // Update voltmeters — show total voltage for now (simplified)
    components.filter(c => c.type === 'voltmeter').forEach(comp => {
      const reading = comp.element ? comp.element.querySelector('[data-reading]') : null;
      if (reading) {
        // Try to find what component the voltmeter is across
        // For simplicity, find the load sharing the same wire nodes
        const vLeftKey = comp.id + ':left';
        const vRightKey = comp.id + ':right';

        let measuredV = 0;

        // Check which load terminals are reachable from voltmeter terminals via wires
        for (const [loadId, data] of Object.entries(compData)) {
          const loadComp = components.find(c => c.id === parseInt(loadId));
          if (!loadComp) continue;

          // Check if voltmeter left connects to load left and voltmeter right connects to load right (or vice versa)
          const vLeftConnected = wires.some(w =>
            (w.from.compId === comp.id && w.from.terminal === 'left' && w.to.compId === loadComp.id) ||
            (w.to.compId === comp.id && w.to.terminal === 'left' && w.from.compId === loadComp.id)
          );
          const vRightConnected = wires.some(w =>
            (w.from.compId === comp.id && w.from.terminal === 'right' && w.to.compId === loadComp.id) ||
            (w.to.compId === comp.id && w.to.terminal === 'right' && w.from.compId === loadComp.id)
          );

          if (vLeftConnected && vRightConnected) {
            measuredV = data.V;
            break;
          }
        }

        // Fall back to total voltage if not measuring specific component
        if (measuredV === 0 && totalCurrent > 0) {
          measuredV = parseFloat(totalVoltageEl.textContent) || 0;
        }

        reading.textContent = measuredV.toFixed(2) + ' V';
      }
    });

    // Update bulb brightness
    components.filter(c => c.type === 'bulb').forEach(comp => {
      const glow = comp.element ? comp.element.querySelector('[data-glow]') : null;
      if (!glow) return;

      const data = compData[comp.id];
      const current = data ? data.I : 0;

      glow.classList.remove('lit-low', 'lit-med', 'lit-high', 'lit-max');
      if (current > 0.001 && current < 0.1) {
        glow.classList.add('lit-low');
      } else if (current >= 0.1 && current < 0.2) {
        glow.classList.add('lit-med');
      } else if (current >= 0.2 && current < 0.4) {
        glow.classList.add('lit-high');
      } else if (current >= 0.4) {
        glow.classList.add('lit-max');
      }
    });
  }

  /* ═══════════ Presets ═══════════ */

  function clearWorkspace() {
    components.forEach(c => { if (c.element) c.element.remove(); });
    wires.forEach(w => { if (w.element) w.element.remove(); });
    components = [];
    wires = [];
    selectedComponent = null;
    draggingComponent = null;
    analyzeCircuit();
  }

  btnPresetSeries.addEventListener('click', () => {
    clearWorkspace();

    const cx = svg.getBoundingClientRect().width / 2;
    const cy = svg.getBoundingClientRect().height / 2;

    // Battery at top center
    const bat = addComponent('battery', 6, cx, cy - 120);
    // Switch
    const sw = addComponent('switch', 0, cx + 160, cy - 120);
    sw.closed = true;
    sw.element.remove();
    renderComponent(sw);

    // Resistor at bottom left
    const r1 = addComponent('resistor', 47, cx - 120, cy + 80);
    // Bulb at bottom right
    const b1 = addComponent('bulb', 0, cx + 120, cy + 80);
    // Ammeter at right
    const am = addComponent('ammeter', 0, cx + 160, cy - 20);

    // Wire connections forming a series loop
    // Battery right → Switch left
    addWire(bat.id, 'right', sw.id, 'left');
    // Switch right → Ammeter right (top of ammeter)
    addWire(sw.id, 'right', am.id, 'right');
    // Ammeter left → Bulb right
    addWire(am.id, 'left', b1.id, 'right');
    // Bulb left → Resistor right
    addWire(b1.id, 'left', r1.id, 'right');
    // Resistor left → Battery left
    addWire(r1.id, 'left', bat.id, 'left');

    updatePositions();
    analyzeCircuit();
    showToast('Series circuit loaded', 'success');
  });

  btnPresetParallel.addEventListener('click', () => {
    clearWorkspace();

    const cx = svg.getBoundingClientRect().width / 2;
    const cy = svg.getBoundingClientRect().height / 2;

    // Battery at left
    const bat = addComponent('battery', 6, cx - 200, cy);
    // Switch
    const sw = addComponent('switch', 0, cx - 200, cy - 120);
    sw.closed = true;
    sw.element.remove();
    renderComponent(sw);

    // Two resistors in parallel
    const r1 = addComponent('resistor', 47, cx + 40, cy - 60);
    const r2 = addComponent('resistor', 100, cx + 40, cy + 60);

    // Wire nodes for junction points
    const jLeft = addComponent('wire', 0, cx - 80, cy);
    const jRight = addComponent('wire', 0, cx + 160, cy);

    // Ammeter in main line
    const am = addComponent('ammeter', 0, cx + 240, cy);

    // Wiring
    // Battery right → Switch left
    addWire(bat.id, 'right', sw.id, 'left');
    // Switch right → junction left (via wire at top)
    addWire(sw.id, 'right', jLeft.id, 'left');
    // Battery left → ammeter right → junction right
    addWire(am.id, 'right', jRight.id, 'right');
    addWire(am.id, 'left', bat.id, 'left');

    // Junction left → R1 left, R2 left
    addWire(jLeft.id, 'right', r1.id, 'left');
    addWire(jLeft.id, 'right', r2.id, 'left');

    // R1 right → Junction right, R2 right → Junction right
    addWire(r1.id, 'right', jRight.id, 'left');
    addWire(r2.id, 'right', jRight.id, 'left');

    updatePositions();
    analyzeCircuit();
    showToast('Parallel circuit loaded', 'success');
  });

  /* ═══════════ Clear All ═══════════ */

  btnClearAll.addEventListener('click', () => {
    clearWorkspace();
    showToast('Workspace cleared', 'info');
  });

  /* ═══════════ Fullscreen ═══════════ */

  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  /* ═══════════ Resize Handler ═══════════ */

  function handleResize() {
    const rect = workspaceContainer.getBoundingClientRect();
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    drawGrid();
  }

  window.addEventListener('resize', handleResize);

  /* ═══════════ Init ═══════════ */

  function init() {
    handleResize();
    analyzeCircuit();
    showToast('Drag components from the palette to build a circuit', 'info');
  }

  // Wait for layout
  requestAnimationFrame(() => {
    requestAnimationFrame(init);
  });

})();
