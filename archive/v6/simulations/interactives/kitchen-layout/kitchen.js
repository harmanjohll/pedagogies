(function() {
  'use strict';

  /* ══════════════════════════════════════════
   * Scale: 40px ≈ 1 metre
   * ══════════════════════════════════════════ */
  const PX_PER_METRE = 40;

  /* ══════════════════════════════════════════
   * Equipment Catalogue
   * ══════════════════════════════════════════ */

  // Footprints are realistic at 40px/m (e.g. hob 26px = 0.65m, fridge 28px = 0.7m).
  const EQUIPMENT = {
    cooking: [
      { id: 'hob',       icon: '🔥', label: 'Hob / Stove', w: 26, h: 24, color: '#78716c', safetyType: 'hot' },
      { id: 'oven',      icon: '♨️',  label: 'Oven',        w: 24, h: 24, color: '#78716c', safetyType: 'hot' },
      { id: 'microwave', icon: '📡', label: 'Microwave',   w: 20, h: 14, color: '#78716c' },
      { id: 'wok',       icon: '🥘', label: 'Wok Station', w: 24, h: 24, color: '#78716c', safetyType: 'hot' },
      { id: 'grill',     icon: '🥩', label: 'Grill',       w: 24, h: 20, color: '#78716c', safetyType: 'hot' },
    ],
    prep: [
      { id: 'chopping',  icon: '🔪', label: 'Chopping',    w: 20, h: 14, color: '#a3896b' },
      { id: 'counter',   icon: '🧱', label: 'Counter',     w: 48, h: 24, color: '#a3896b' },
      { id: 'mixer',     icon: '🍰', label: 'Mixer',       w: 16, h: 16, color: '#a8a29e' },
      { id: 'scale',     icon: '⚖️',  label: 'Scale',       w: 12, h: 10, color: '#a8a29e' },
      { id: 'sink',      icon: '🚰', label: 'Sink',        w: 24, h: 20, color: '#94a3b8', safetyType: 'wet' },
    ],
    storage: [
      { id: 'fridge',    icon: '🧊', label: 'Fridge',      w: 28, h: 28, color: '#d6d3d1' },
      { id: 'pantry',    icon: '🗄️',  label: 'Pantry',      w: 32, h: 20, color: '#c4b5a0' },
      { id: 'rack',      icon: '🍽️',  label: 'Dish Rack',   w: 20, h: 16, color: '#a8a29e' },
      { id: 'bin',       icon: '🗑️',  label: 'Waste Bin',   w: 16, h: 16, color: '#78716c' },
    ],
    safety: [
      { id: 'extinguisher', icon: '🧯', label: 'Extinguisher', w: 16, h: 16, color: '#dc2626' },
      { id: 'firstaid',    icon: '🩹', label: 'First Aid',    w: 16, h: 16, color: '#f43f5e' },
      { id: 'exit',        icon: '🚪', label: 'Exit',         w: 40, h: 45, color: '#22d3ee' },
      { id: 'apron',       icon: '🧤', label: 'Apron Hook',   w: 14, h: 16, color: '#f59e0b' },
    ],
  };

  /* ── Per-equipment top-down drawing routines ── */
  const EQUIP_DRAW = {
    hob(ctx, w, h) {
      // Stainless body
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // 4 burner rings
      ctx.strokeStyle = '#44403c'; ctx.lineWidth = 1.5;
      const cx1 = w * 0.3, cx2 = w * 0.7, cy1 = h * 0.35, cy2 = h * 0.7;
      const r1 = Math.min(w, h) * 0.14, r2 = r1 * 0.55;
      [{ x: cx1, y: cy1 }, { x: cx2, y: cy1 }, { x: cx1, y: cy2 }, { x: cx2, y: cy2 }].forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, r1, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, r2, 0, Math.PI * 2); ctx.stroke();
      });
      // Red heat glow
      ctx.fillStyle = 'rgba(239,68,68,0.15)';
      [{ x: cx1, y: cy1 }, { x: cx2, y: cy1 }, { x: cx1, y: cy2 }, { x: cx2, y: cy2 }].forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, r1, 0, Math.PI * 2); ctx.fill();
      });
    },
    oven(ctx, w, h) {
      // Body
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Door panel
      const pad = 4;
      ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1;
      ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
      // Handle
      ctx.strokeStyle = '#57534e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pad + 3, h / 2); ctx.lineTo(w - pad - 3, h / 2); ctx.stroke();
      // Window
      ctx.fillStyle = 'rgba(68,64,60,0.2)';
      ctx.fillRect(pad + 4, pad + 4, w - pad * 2 - 8, h / 2 - pad - 6);
    },
    microwave(ctx, w, h) {
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Door window
      const dw = w * 0.55, dh = h * 0.7;
      ctx.strokeStyle = '#78716c';
      ctx.strokeRect(2, (h - dh) / 2, dw, dh);
      ctx.fillStyle = 'rgba(68,64,60,0.15)';
      ctx.fillRect(2, (h - dh) / 2, dw, dh);
      // Control panel
      ctx.fillStyle = '#78716c';
      ctx.fillRect(dw + 4, h * 0.25, w - dw - 6, h * 0.5);
    },
    wok(ctx, w, h) {
      // Body
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Single large wok ring
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.32;
      ctx.strokeStyle = '#44403c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#57534e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(239,68,68,0.12)';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    },
    grill(ctx, w, h) {
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Grill lines
      ctx.strokeStyle = '#57534e'; ctx.lineWidth = 1;
      const pad = 5, count = 6;
      for (let i = 0; i < count; i++) {
        const y = pad + (h - pad * 2) * i / (count - 1);
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(239,68,68,0.1)';
      ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
    },
    chopping(ctx, w, h) {
      // Wooden chopping board
      ctx.fillStyle = '#c4a97d';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a3896b'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Wood grain lines
      ctx.strokeStyle = 'rgba(120,80,40,0.15)'; ctx.lineWidth = 0.5;
      for (let i = 1; i < 5; i++) {
        const x = w * i / 5;
        ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x, h - 1); ctx.stroke();
      }
    },
    counter(ctx, w, h) {
      // Steel counter top
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Subtle reflection
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(3, 3, w - 6, 2);
    },
    mixer(ctx, w, h) {
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Bowl
      ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.28, 0, Math.PI * 2); ctx.stroke();
      // Arm
      ctx.strokeStyle = '#57534e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w / 2, 2); ctx.lineTo(w / 2, h / 2 - 2); ctx.stroke();
    },
    scale(ctx, w, h) {
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Platform
      ctx.fillStyle = '#d6d3d1';
      const pad = 2;
      ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2);
      ctx.strokeStyle = '#78716c';
      ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
      // Display
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(w / 2 - 4, h - pad - 4, 8, 3);
    },
    sink(ctx, w, h) {
      // Counter body
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Basin (oval inset)
      const bw = w * 0.65, bh = h * 0.55;
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 + 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
      ctx.stroke();
      // Drain
      ctx.fillStyle = '#64748b';
      ctx.beginPath(); ctx.arc(w / 2, h / 2 + 2, 3, 0, Math.PI * 2); ctx.fill();
      // Faucet indicator at top
      ctx.fillStyle = '#78716c';
      ctx.beginPath(); ctx.arc(w / 2, 6, 4, 0, Math.PI * 2); ctx.fill();
      // Water tint
      ctx.fillStyle = 'rgba(59,130,246,0.08)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2 + 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    },
    fridge(ctx, w, h) {
      ctx.fillStyle = '#f5f5f4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Two-door divider
      ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w / 2, 1); ctx.lineTo(w / 2, h - 1); ctx.stroke();
      // Handles
      ctx.fillStyle = '#57534e';
      ctx.fillRect(w / 2 - 5, h * 0.35, 2, 12);
      ctx.fillRect(w / 2 + 3, h * 0.35, 2, 12);
    },
    pantry(ctx, w, h) {
      ctx.fillStyle = '#d6cfc4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a3896b'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Shelves
      ctx.strokeStyle = '#a3896b'; ctx.lineWidth = 0.5;
      for (let i = 1; i < 4; i++) {
        const y = h * i / 4;
        ctx.beginPath(); ctx.moveTo(2, y); ctx.lineTo(w - 2, y); ctx.stroke();
      }
    },
    rack(ctx, w, h) {
      ctx.fillStyle = '#e7e5e4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Grid slots
      ctx.strokeStyle = '#d6d3d1'; ctx.lineWidth = 0.5;
      for (let i = 1; i < 6; i++) {
        const x = w * i / 6;
        ctx.beginPath(); ctx.moveTo(x, 3); ctx.lineTo(x, h - 3); ctx.stroke();
      }
    },
    bin(ctx, w, h) {
      ctx.fillStyle = '#57534e';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#44403c'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Lid line
      ctx.strokeStyle = '#78716c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(3, h * 0.2); ctx.lineTo(w - 3, h * 0.2); ctx.stroke();
      // Pedal
      ctx.fillStyle = '#44403c';
      ctx.fillRect(w * 0.3, h - 5, w * 0.4, 3);
    },
    extinguisher(ctx, w, h) {
      // Red cylinder (top-down = oval)
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#991b1b'; ctx.lineWidth = 1.5;
      ctx.stroke();
      // Nozzle
      ctx.fillStyle = '#1c1917';
      ctx.beginPath(); ctx.arc(w / 2, h * 0.2, 3, 0, Math.PI * 2); ctx.fill();
    },
    firstaid(ctx, w, h) {
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(2, 2, w - 4, h - 4);
      ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 1.5;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      // Red cross
      ctx.fillStyle = '#ef4444';
      const cx = w / 2, cy = h / 2, arm = Math.max(2, w * 0.12), len = Math.max(4, w * 0.3);
      ctx.fillRect(cx - arm, cy - len, arm * 2, len * 2);
      ctx.fillRect(cx - len, cy - arm, len * 2, arm * 2);
    },
    exit(ctx, w, h) {
      // Door frame
      ctx.fillStyle = '#164e63';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#0e7490'; ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Door panel
      ctx.fillStyle = '#0891b2';
      ctx.fillRect(3, 3, w - 6, h - 6);
      // Arrow
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h / 2); ctx.lineTo(w * 0.7, h / 2);
      ctx.moveTo(w * 0.55, h * 0.35); ctx.lineTo(w * 0.7, h / 2); ctx.lineTo(w * 0.55, h * 0.65);
      ctx.stroke();
    },
    apron(ctx, w, h) {
      // Wall hook plate
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      // Hook
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.45, 5, Math.PI, 0);
      ctx.stroke();
    },
  };

  /* ══════════════════════════════════════════
   * State
   * ══════════════════════════════════════════ */

  let placedItems = [];       // { id, equipId, x, y, w, h, color, icon, label, safetyType }
  let studentMarkers = [];    // { id, x, y, num }
  let showSafety = false;
  let showFlow = false;
  let selectedItem = null;
  let dragItem = null;
  let dragOffset = { x: 0, y: 0 };
  let nextItemId = 1;

  const WALL = 10;            // wall thickness in px

  /* Fixed room: 14m x 8m usable floor at 40px/m, letterboxed in the canvas.
   * All item / marker coordinates are relative to the room's inner top-left. */
  const ROOM_W_M = 14, ROOM_H_M = 8;
  const ROOM_W = ROOM_W_M * PX_PER_METRE;   // 560px usable floor width
  const ROOM_H = ROOM_H_M * PX_PER_METRE;   // 320px usable floor depth
  let roomX = 0, roomY = 0;                 // outer wall top-left in canvas px

  const canvas = document.getElementById('kitchen-canvas');
  const ctx = canvas.getContext('2d');
  const placedContainer = document.getElementById('placed-items');

  /* ══════════════════════════════════════════
   * Canvas sizing
   * ══════════════════════════════════════════ */

  function layoutRoom() {
    roomX = Math.max(0, Math.round((canvas.width - (ROOM_W + WALL * 2)) / 2));
    roomY = Math.max(0, Math.round((canvas.height - (ROOM_H + WALL * 2)) / 2));
    // Anchor the placed-items layer to the room's inner floor so item
    // coordinates stay room-relative regardless of window size.
    placedContainer.style.inset = 'auto';
    placedContainer.style.left = (roomX + WALL) + 'px';
    placedContainer.style.top = (roomY + WALL) + 'px';
    placedContainer.style.width = ROOM_W + 'px';
    placedContainer.style.height = ROOM_H + 'px';
  }

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    layoutRoom();
    draw();
  }
  window.addEventListener('resize', resizeCanvas);

  /* ══════════════════════════════════════════
   * Build palette
   * ══════════════════════════════════════════ */

  function buildPalette() {
    Object.entries(EQUIPMENT).forEach(([cat, items]) => {
      const container = document.getElementById(`${cat}-items`);
      if (!container) return;
      container.innerHTML = items.map(eq =>
        `<button class="equip-btn" data-equip="${eq.id}" data-cat="${cat}" draggable="true">
          <span class="eq-icon">${eq.icon}</span>
          <span>${eq.label}</span>
        </button>`
      ).join('');
    });

    // Wire drag from palette
    document.querySelectorAll('.equip-btn').forEach(btn => {
      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          cat: btn.dataset.cat,
          equipId: btn.dataset.equip,
        }));
        e.dataTransfer.effectAllowed = 'copy';
      });

      // Click to add at room centre
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        const equipId = btn.dataset.equip;
        const eq = EQUIPMENT[cat].find(e => e.id === equipId);
        if (!eq) return;
        addItem(eq, ROOM_W / 2 - eq.w / 2, ROOM_H / 2 - eq.h / 2);
      });
    });
  }

  /* ══════════════════════════════════════════
   * Place / remove items
   * ══════════════════════════════════════════ */

  function addItem(eq, x, y) {
    const item = {
      id: nextItemId++,
      equipId: eq.id,
      x: Math.max(0, Math.min(Math.round(x), ROOM_W - eq.w)),
      y: Math.max(0, Math.min(Math.round(y), ROOM_H - eq.h)),
      w: eq.w,
      h: eq.h,
      color: eq.color,
      icon: eq.icon,
      label: eq.label,
      safetyType: eq.safetyType || null,
    };
    placedItems.push(item);
    renderPlacedItems();
    draw();
  }

  function removeItem(id) {
    placedItems = placedItems.filter(i => i.id !== id);
    if (selectedItem === id) selectedItem = null;
    renderPlacedItems();
    draw();
  }

  /* ══════════════════════════════════════════
   * Draw equipment into a canvas element
   * ══════════════════════════════════════════ */

  function drawEquipmentCanvas(equipId, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    const fn = EQUIP_DRAW[equipId];
    if (fn) {
      fn(cx, w, h);
    } else {
      // Fallback: plain rectangle
      cx.fillStyle = '#d6d3d1';
      cx.fillRect(0, 0, w, h);
      cx.strokeStyle = '#a8a29e'; cx.lineWidth = 1;
      cx.strokeRect(0.5, 0.5, w - 1, h - 1);
    }
    return c;
  }

  /* ══════════════════════════════════════════
   * Render placed items as DOM elements
   * ══════════════════════════════════════════ */

  function renderPlacedItems() {
    placedContainer.innerHTML = '';

    // Safety zones (rendered behind items)
    if (showSafety) {
      placedItems.forEach(item => {
        if (!item.safetyType) return;
        const zone = document.createElement('div');
        zone.className = `safety-zone ${item.safetyType} visible`;
        // Zone = item footprint + the stated minimum clearance on every side
        // (0.9m for hot zones, 0.6m for wet — matches the info panel)
        const clearanceM = item.safetyType === 'hot' ? 0.9 : 0.6;
        const size = Math.max(item.w, item.h) + 2 * clearanceM * PX_PER_METRE;
        zone.style.cssText = `width:${size}px;height:${size}px;left:${item.x + item.w/2 - size/2}px;top:${item.y + item.h/2 - size/2}px;`;
        placedContainer.appendChild(zone);
      });
    }

    // Equipment items — rendered as mini canvases for realistic shapes
    placedItems.forEach(item => {
      const el = document.createElement('div');
      el.className = `placed-item equip-rendered${selectedItem === item.id ? ' selected' : ''}`;
      el.dataset.itemId = item.id;
      el.style.cssText = `left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px;`;

      // Draw equipment shape onto a mini canvas
      const equipCanvas = drawEquipmentCanvas(item.equipId, item.w, item.h);
      equipCanvas.style.cssText = 'width:100%;height:100%;display:block;border-radius:2px;';
      el.appendChild(equipCanvas);

      // Label below
      const lbl = document.createElement('span');
      lbl.className = 'item-label';
      lbl.textContent = item.label;
      el.appendChild(lbl);

      // Remove button
      const rm = document.createElement('button');
      rm.className = 'remove-btn';
      rm.dataset.remove = item.id;
      rm.innerHTML = '&times;';
      el.appendChild(rm);

      // Dragging — pointer events for mouse + touch support
      el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.remove-btn')) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        dragItem = item;
        dragOffset.x = e.clientX - item.x;
        dragOffset.y = e.clientY - item.y;
        selectedItem = item.id;
        renderPlacedItems();
        updateInfoPanel(item);
      });

      el.addEventListener('click', () => {
        selectedItem = item.id;
        renderPlacedItems();
        updateInfoPanel(item);
      });

      el.style.touchAction = 'none';

      placedContainer.appendChild(el);
    });

    // Student markers
    studentMarkers.forEach(s => {
      const el = document.createElement('div');
      el.className = 'placed-item student-marker';
      el.style.cssText = `left:${s.x}px;top:${s.y}px;width:28px;height:28px;`;
      el.textContent = `S${s.num}`;
      el.title = `Student ${s.num}`;

      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        dragItem = s;
        dragItem.w = 28; dragItem.h = 28;
        dragOffset.x = e.clientX - s.x;
        dragOffset.y = e.clientY - s.y;
      });

      el.style.touchAction = 'none';

      placedContainer.appendChild(el);
    });

    // Flow arrows
    if (showFlow) drawFlowArrows();
  }

  /* ══════════════════════════════════════════
   * Drag & drop
   * ══════════════════════════════════════════ */

  document.addEventListener('pointermove', (e) => {
    if (!dragItem) return;
    dragItem.x = Math.max(0, Math.min(e.clientX - dragOffset.x, ROOM_W - (dragItem.w || 28)));
    dragItem.y = Math.max(0, Math.min(e.clientY - dragOffset.y, ROOM_H - (dragItem.h || 28)));
    renderPlacedItems();
    draw();
  });

  document.addEventListener('pointerup', () => {
    dragItem = null;
  });

  // Drop from palette onto floor plan
  const floorPlan = document.getElementById('floor-plan');
  floorPlan.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  floorPlan.addEventListener('drop', (e) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const eq = EQUIPMENT[data.cat]?.find(eq => eq.id === data.equipId);
      if (!eq) return;
      const rect = placedContainer.getBoundingClientRect(); // room-relative drop point
      addItem(eq, e.clientX - rect.left - eq.w / 2, e.clientY - rect.top - eq.h / 2);
    } catch {}
  });

  // Remove button delegation
  placedContainer.addEventListener('click', (e) => {
    const rmBtn = e.target.closest('[data-remove]');
    if (rmBtn) {
      removeItem(parseInt(rmBtn.dataset.remove));
    }
  });

  /* ══════════════════════════════════════════
   * Canvas drawing — architectural floor plan
   * ══════════════════════════════════════════ */

  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const wt = WALL;
    // Room rectangle (fixed 14m x 8m floor), centred in the canvas
    const rx = roomX, ry = roomY;                 // outer wall top-left
    const ix = rx + wt, iy = ry + wt;             // inner floor top-left
    const ow = ROOM_W + wt * 2, oh = ROOM_H + wt * 2;

    // ── Letterbox area outside the room ──
    ctx.fillStyle = '#e9e4d9';
    ctx.fillRect(0, 0, w, h);

    // ── Floor: warm tile pattern (inside the room only) ──
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(ix, iy, ROOM_W, ROOM_H);

    // Tile grid
    const gridSize = PX_PER_METRE;
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = ix + gridSize; x < ix + ROOM_W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, iy); ctx.lineTo(x, iy + ROOM_H); ctx.stroke();
    }
    for (let y = iy + gridSize; y < iy + ROOM_H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(ix, y); ctx.lineTo(ix + ROOM_W, y); ctx.stroke();
    }

    // Half-tile offset lines (subtler)
    ctx.strokeStyle = 'rgba(0,0,0,0.025)';
    for (let x = ix + gridSize / 2; x < ix + ROOM_W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, iy); ctx.lineTo(x, iy + ROOM_H); ctx.stroke();
    }
    for (let y = iy + gridSize / 2; y < iy + ROOM_H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(ix, y); ctx.lineTo(ix + ROOM_W, y); ctx.stroke();
    }

    // ── Walls: thick architectural lines with hatching ──
    ctx.fillStyle = '#57534e';
    // Top wall
    ctx.fillRect(rx, ry, ow, wt);
    // Bottom wall
    ctx.fillRect(rx, ry + oh - wt, ow, wt);
    // Left wall
    ctx.fillRect(rx, ry, wt, oh);
    // Right wall
    ctx.fillRect(rx + ow - wt, ry, wt, oh);

    // Wall hatching (exterior side)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    const hatchSpacing = 6;
    // Top wall hatching
    for (let x = rx; x < rx + ow; x += hatchSpacing) {
      ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x + wt, ry + wt); ctx.stroke();
    }
    // Bottom wall hatching
    for (let x = rx; x < rx + ow; x += hatchSpacing) {
      ctx.beginPath(); ctx.moveTo(x, ry + oh); ctx.lineTo(x + wt, ry + oh - wt); ctx.stroke();
    }
    // Left wall hatching
    for (let y = ry; y < ry + oh; y += hatchSpacing) {
      ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx + wt, y + wt); ctx.stroke();
    }
    // Right wall hatching
    for (let y = ry; y < ry + oh; y += hatchSpacing) {
      ctx.beginPath(); ctx.moveTo(rx + ow, y); ctx.lineTo(rx + ow - wt, y + wt); ctx.stroke();
    }

    // Inner wall edge (clean line)
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix, iy, ROOM_W, ROOM_H);

    // ── Dimension labels (from the fixed room, not the window) ──
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = '#78716c';
    ctx.textAlign = 'center';

    // Top dimension
    drawDimension(ctx, ix, ry + wt / 2, ix + ROOM_W, ry + wt / 2, `${ROOM_W_M.toFixed(1)}m`, 'top');
    // Left dimension
    drawDimension(ctx, rx + wt / 2, iy, rx + wt / 2, iy + ROOM_H, `${ROOM_H_M.toFixed(1)}m`, 'left');

    // ── Room label ──
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.textAlign = 'left';
    ctx.fillText('NFS Food Lab', ix + 8, iy + 16);

    // ── Scale bar ──
    ctx.fillStyle = '#78716c';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    const scaleX = ix + 6, scaleY = iy + ROOM_H - 8;
    ctx.fillRect(scaleX, scaleY, PX_PER_METRE, 2);
    ctx.fillRect(scaleX, scaleY - 3, 1, 6);
    ctx.fillRect(scaleX + PX_PER_METRE, scaleY - 3, 1, 6);
    ctx.fillText('1m', scaleX + PX_PER_METRE + 4, scaleY + 3);

    // ── Compass rose ──
    const compassX = ix + ROOM_W - 24, compassY = iy + ROOM_H - 22;
    ctx.strokeStyle = '#a8a29e'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(compassX, compassY - 10); ctx.lineTo(compassX, compassY + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(compassX - 10, compassY); ctx.lineTo(compassX + 10, compassY); ctx.stroke();
    ctx.fillStyle = '#78716c';
    ctx.font = 'bold 7px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', compassX, compassY - 13);

    // ── Branding ──
    ctx.font = '9px Inter, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.textAlign = 'right';
    ctx.fillText('Kitchen Layout Planner — Co-Cher', ix + ROOM_W - 6, iy + ROOM_H - 6);
    ctx.textAlign = 'left';
  }

  /* ── Dimension line with label ── */
  function drawDimension(ctx, x1, y1, x2, y2, label, side) {
    ctx.save();
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#78716c';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';

    if (side === 'top') {
      // Horizontal dimension
      const mid = (x1 + x2) / 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.stroke();
      // End ticks
      ctx.beginPath(); ctx.moveTo(x1, y1 - 3); ctx.lineTo(x1, y1 + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y1 - 3); ctx.lineTo(x2, y1 + 3); ctx.stroke();
      ctx.fillText(label, mid, y1 - 1);
    } else if (side === 'left') {
      // Vertical dimension
      const mid = (y1 + y2) / 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1 - 3, y1); ctx.lineTo(x1 + 3, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1 - 3, y2); ctx.lineTo(x1 + 3, y2); ctx.stroke();
      ctx.save();
      ctx.translate(x1 - 2, mid);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════
   * Flow arrows (prep → cook → plate)
   * ══════════════════════════════════════════ */

  function drawFlowArrows() {
    const categories = {
      prep: placedItems.filter(i => ['chopping','counter','mixer','scale'].includes(i.equipId)),
      cook: placedItems.filter(i => ['hob','oven','wok','grill','microwave'].includes(i.equipId)),
      plate: placedItems.filter(i => ['rack','sink'].includes(i.equipId)),
    };

    function centroid(items) {
      if (items.length === 0) return null;
      const cx = items.reduce((s, i) => s + i.x + i.w/2, 0) / items.length;
      const cy = items.reduce((s, i) => s + i.y + i.h/2, 0) / items.length;
      return { x: cx, y: cy };
    }

    const points = [centroid(categories.prep), centroid(categories.cook), centroid(categories.plate)].filter(Boolean);
    if (points.length < 2) return;

    // Draw SVG arrows
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'flow-arrow visible');
    svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    svg.innerHTML = `<defs><marker id="fah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#16a34a" opacity="0.7"/></marker></defs>`;

    for (let i = 0; i < points.length - 1; i++) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', points[i].x);
      line.setAttribute('y1', points[i].y);
      line.setAttribute('x2', points[i+1].x);
      line.setAttribute('y2', points[i+1].y);
      line.setAttribute('stroke', '#16a34a');
      line.setAttribute('stroke-width', '2.5');
      line.setAttribute('stroke-dasharray', '8 5');
      line.setAttribute('opacity', '0.6');
      line.setAttribute('marker-end', 'url(#fah)');
      svg.appendChild(line);

      // Labels
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const labels = ['Prep → Cook', 'Cook → Plate'];
      text.setAttribute('x', (points[i].x + points[i+1].x) / 2);
      text.setAttribute('y', (points[i].y + points[i+1].y) / 2 - 8);
      text.setAttribute('fill', '#16a34a');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'Inter, sans-serif');
      text.setAttribute('font-weight', '600');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('opacity', '0.8');
      text.textContent = labels[i] || '';
      svg.appendChild(text);
    }

    placedContainer.appendChild(svg);
  }

  /* ══════════════════════════════════════════
   * Info panel
   * ══════════════════════════════════════════ */

  function updateInfoPanel(item) {
    const infoDiv = document.getElementById('station-info');
    if (!item) {
      infoDiv.innerHTML = '<p class="info-hint">Click a station or placed item to see details.</p>';
      return;
    }

    const realW = (item.w / PX_PER_METRE).toFixed(2);
    const realH = (item.h / PX_PER_METRE).toFixed(2);
    const clearance = item.safetyType === 'hot' ? '0.9m' : item.safetyType === 'wet' ? '0.6m' : '0.3m';

    const safetyNote = item.safetyType === 'hot'
      ? '<span style="color:#ef4444;">⚠ Hot zone — keep 0.9m clear paths. Students must use oven mitts.</span>'
      : item.safetyType === 'wet'
      ? '<span style="color:#3b82f6;">💧 Wet zone — 0.6m clearance. Non-slip mats required. Wipe spills immediately.</span>'
      : '<span style="color:#78716c;">Standard clearance (0.3m). No special safety requirements.</span>';

    // Work triangle calculation
    let triangleNote = '';
    const hobs = placedItems.filter(i => ['hob','oven','wok','grill'].includes(i.equipId));
    const sinks = placedItems.filter(i => i.equipId === 'sink');
    const fridges = placedItems.filter(i => i.equipId === 'fridge');
    if (hobs.length > 0 && sinks.length > 0 && fridges.length > 0) {
      const dist = (a, b) => Math.sqrt((a.x + a.w/2 - b.x - b.w/2) ** 2 + (a.y + a.h/2 - b.y - b.h/2) ** 2) / PX_PER_METRE;
      const d1 = dist(hobs[0], sinks[0]).toFixed(1);
      const d2 = dist(sinks[0], fridges[0]).toFixed(1);
      const d3 = dist(fridges[0], hobs[0]).toFixed(1);
      const total = (parseFloat(d1) + parseFloat(d2) + parseFloat(d3)).toFixed(1);
      const verdict = total < 4 ? '✓ Compact' : total > 8 ? '✗ Too spread' : '✓ Good';
      triangleNote = `
        <div style="margin-top:8px;font-size:0.6875rem;color:#94a3b8;line-height:1.5;">
          <strong style="color:#e2e8f0;">Work Triangle:</strong><br>
          Hob↔Sink: ${d1}m · Sink↔Fridge: ${d2}m · Fridge↔Hob: ${d3}m<br>
          Total: ${total}m <span style="color:${total > 8 ? '#ef4444' : '#22c55e'}">${verdict}</span>
          <div style="font-size:0.5625rem;color:#64748b;margin-top:2px;">Ideal: 4–8m total</div>
        </div>`;
    }

    infoDiv.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:1.5rem;">${item.icon}</span>
        <div>
          <div style="font-weight:600;font-size:0.8125rem;">${item.label}</div>
          <div style="font-size:0.625rem;color:#64748b;">${realW}m × ${realH}m</div>
        </div>
      </div>
      <div style="font-size:0.6875rem;color:#94a3b8;line-height:1.5;">
        <strong style="color:#e2e8f0;">Safety:</strong><br>
        ${safetyNote}
      </div>
      <div style="margin-top:6px;font-size:0.6875rem;color:#94a3b8;">
        <strong style="color:#e2e8f0;">Min. clearance:</strong> ${clearance}
      </div>
      ${triangleNote}
    `;
  }

  /* ══════════════════════════════════════════
   * Templates / Presets
   * ══════════════════════════════════════════ */

  function applyTemplate(templateId) {
    placedItems = [];
    studentMarkers = [];
    selectedItem = null;
    // All template coordinates are in fixed-room space (0..ROOM_W x 0..ROOM_H)

    const templates = {
      blank: () => {},
      masterchef: () => {
        // MasterChef style: 4 cooking stations facing centre judge area
        const stations = [
          // Station 1 — top left
          { equipId: 'hob', x: 40, y: 20 },
          { equipId: 'chopping', x: 80, y: 24 },
          { equipId: 'sink', x: 112, y: 22 },
          // Station 2 — top right
          { equipId: 'hob', x: 410, y: 20 },
          { equipId: 'chopping', x: 450, y: 24 },
          { equipId: 'sink', x: 482, y: 22 },
          // Station 3 — bottom left
          { equipId: 'oven', x: 40, y: 272 },
          { equipId: 'counter', x: 80, y: 274 },
          { equipId: 'chopping', x: 140, y: 278 },
          // Station 4 — bottom right
          { equipId: 'oven', x: 400, y: 272 },
          { equipId: 'counter', x: 440, y: 274 },
          { equipId: 'chopping', x: 500, y: 278 },
          // Centre shared area
          { equipId: 'fridge', x: 266, y: 132 },
          { equipId: 'pantry', x: 220, y: 136 },
          { equipId: 'bin', x: 308, y: 138 },
          // Safety
          { equipId: 'extinguisher', x: 12, y: 150 },
          { equipId: 'firstaid', x: 532, y: 150 },
          { equipId: 'exit', x: 260, y: 275 },
        ];
        stations.forEach(s => {
          const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
          const eq = allEquip.find(e => e.id === s.equipId);
          if (eq) addItem(eq, s.x, s.y);
        });
        // Student markers (2 per station)
        const studentNum = parseInt(document.getElementById('students-select').value) || 8;
        const positions = [
          { x: 60, y: 60 }, { x: 110, y: 60 },
          { x: 420, y: 60 }, { x: 470, y: 60 },
          { x: 60, y: 230 }, { x: 110, y: 230 },
          { x: 420, y: 230 }, { x: 470, y: 230 },
          { x: 236, y: 190 }, { x: 296, y: 190 },
          { x: 40, y: 146 }, { x: 490, y: 146 },
          { x: 160, y: 146 }, { x: 372, y: 146 },
          { x: 200, y: 90 }, { x: 332, y: 90 },
        ];
        for (let i = 0; i < Math.min(studentNum, positions.length); i++) {
          studentMarkers.push({ id: `s${i+1}`, x: positions[i].x, y: positions[i].y, num: i + 1 });
        }
      },
      'u-shape': () => {
        const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
        const find = id => allEquip.find(e => e.id === id);
        [find('hob'), find('hob'), find('oven')].forEach((eq, i) => {
          if (eq) addItem(eq, 12, 40 + i * 50);
        });
        [find('counter'), find('sink'), find('counter'), find('chopping')].forEach((eq, i) => {
          if (eq) addItem(eq, 80 + i * 62, 288);
        });
        [find('fridge'), find('pantry'), find('rack')].forEach((eq, i) => {
          if (eq) addItem(eq, 516, 40 + i * 50);
        });
        addItem(find('extinguisher'), 272, 12);
        addItem(find('exit'), 400, 275);
      },
      island: () => {
        const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
        const find = id => allEquip.find(e => e.id === id);
        [find('counter'), find('chopping'), find('counter')].forEach((eq, i) => {
          if (eq) addItem(eq, 196 + i * 58, 148);
        });
        [find('hob'), find('hob'), find('oven')].forEach((eq, i) => {
          if (eq) addItem(eq, 40 + i * 50, 16);
        });
        [find('fridge'), find('pantry')].forEach((eq, i) => {
          if (eq) addItem(eq, 514, 30 + i * 50);
        });
        [find('sink'), find('rack')].forEach((eq, i) => {
          if (eq) addItem(eq, 30 + i * 44, 288);
        });
        addItem(find('extinguisher'), 532, 290);
        addItem(find('exit'), 260, 275); // fire exit — every layout needs one
      },
      pairs: () => {
        const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
        const find = id => allEquip.find(e => e.id === id);
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            const bx = 40 + col * 160;
            const by = 40 + row * 150;
            addItem(find('hob'), bx, by);
            addItem(find('chopping'), bx + 40, by + 4);
            addItem(find('sink'), bx + 16, by + 40);
          }
        }
        addItem(find('fridge'), 500, 30);
        addItem(find('pantry'), 498, 80);
        addItem(find('extinguisher'), 12, 290);
        addItem(find('exit'), 260, 275);
      },
    };

    if (templates[templateId]) templates[templateId]();
    renderPlacedItems();
    draw();
  }

  /* ══════════════════════════════════════════
   * Controls wiring
   * ══════════════════════════════════════════ */

  document.getElementById('template-select').addEventListener('change', (e) => {
    applyTemplate(e.target.value);
  });

  document.getElementById('students-select').addEventListener('change', () => {
    applyTemplate(document.getElementById('template-select').value);
  });

  document.getElementById('toggle-safety').addEventListener('click', function() {
    showSafety = !showSafety;
    this.classList.toggle('active', showSafety);
    renderPlacedItems();
  });

  document.getElementById('toggle-flow').addEventListener('click', function() {
    showFlow = !showFlow;
    this.classList.toggle('active', showFlow);
    renderPlacedItems();
  });

  document.getElementById('clear-btn').addEventListener('click', () => {
    placedItems = [];
    studentMarkers = [];
    selectedItem = null;
    document.getElementById('template-select').value = 'blank';
    renderPlacedItems();
    draw();
  });

  /* ══════════════════════════════════════════
   * Save / Load / Print
   * ══════════════════════════════════════════ */

  const STORAGE_KEY = 'cocher_v6_kitchen_layouts';

  function getSavedLayouts() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  }

  document.getElementById('save-btn').addEventListener('click', () => {
    const name = prompt('Layout name:', `Kitchen ${new Date().toLocaleDateString()}`);
    if (!name) return;
    const layouts = getSavedLayouts();
    layouts.push({
      name,
      date: new Date().toISOString(),
      template: document.getElementById('template-select').value,
      students: document.getElementById('students-select').value,
      items: placedItems.map(i => ({ equipId: i.equipId, x: i.x, y: i.y, w: i.w, h: i.h, color: i.color, icon: i.icon, label: i.label, safetyType: i.safetyType })),
      markers: studentMarkers.map(s => ({ x: s.x, y: s.y, num: s.num })),
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
    showNotification('Layout saved!');
  });

  document.getElementById('load-btn').addEventListener('click', () => {
    const layouts = getSavedLayouts();
    if (layouts.length === 0) { showNotification('No saved layouts found.'); return; }
    const list = layouts.map((l, i) => `${i + 1}. ${l.name} (${new Date(l.date).toLocaleDateString()})`).join('\n');
    const choice = prompt(`Select a layout to load:\n\n${list}\n\nEnter number:`);
    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= layouts.length) return;
    const layout = layouts[idx];
    placedItems = [];
    studentMarkers = [];
    selectedItem = null;
    nextItemId = 1;
    const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
    layout.items.forEach(saved => {
      const eq = allEquip.find(e => e.id === saved.equipId);
      if (eq) addItem(eq, saved.x, saved.y);
    });
    layout.markers.forEach(m => {
      studentMarkers.push({ id: `s${m.num}`, x: m.x, y: m.y, num: m.num });
    });
    if (layout.template) document.getElementById('template-select').value = layout.template;
    if (layout.students) document.getElementById('students-select').value = layout.students;
    renderPlacedItems();
    draw();
    showNotification(`Loaded: ${layout.name}`);
  });

  document.getElementById('print-btn').addEventListener('click', () => {
    // Create a high-res snapshot of the floor plan for printing
    const printCanvas = document.createElement('canvas');
    const scale = 2;
    printCanvas.width = canvas.width * scale;
    printCanvas.height = canvas.height * scale;
    const pCtx = printCanvas.getContext('2d');
    pCtx.scale(scale, scale);
    // Draw the base floor plan onto print canvas
    pCtx.drawImage(canvas, 0, 0);
    // Item coordinates are room-relative; offset to canvas space
    const ox = roomX + WALL, oy = roomY + WALL;
    // Draw placed equipment onto print canvas
    placedItems.forEach(item => {
      const equipCanvas = drawEquipmentCanvas(item.equipId, item.w, item.h);
      pCtx.drawImage(equipCanvas, ox + item.x, oy + item.y);
      // Label
      pCtx.font = '8px Inter, sans-serif';
      pCtx.fillStyle = '#57534e';
      pCtx.textAlign = 'center';
      pCtx.fillText(item.label, ox + item.x + item.w / 2, oy + item.y + item.h + 10);
    });
    // Draw student markers
    studentMarkers.forEach(s => {
      pCtx.beginPath();
      pCtx.arc(ox + s.x + 14, oy + s.y + 14, 14, 0, Math.PI * 2);
      pCtx.fillStyle = 'rgba(139,92,246,0.2)';
      pCtx.fill();
      pCtx.strokeStyle = '#7c3aed';
      pCtx.lineWidth = 2;
      pCtx.stroke();
      pCtx.fillStyle = '#6d28d9';
      pCtx.font = 'bold 9px Inter, sans-serif';
      pCtx.textAlign = 'center';
      pCtx.textBaseline = 'middle';
      pCtx.fillText(`S${s.num}`, ox + s.x + 14, oy + s.y + 14);
    });
    // Open print window
    const pw = window.open('', '_blank');
    pw.document.write(`<!DOCTYPE html><html><head><title>Kitchen Layout — Co-Cher</title>
    <style>@media print{@page{margin:1cm;}}body{margin:0;display:flex;flex-direction:column;align-items:center;font-family:Inter,sans-serif;}
    h1{font-size:1rem;margin:12px 0 4px;}p{font-size:0.75rem;color:#666;margin:0 0 12px;}
    img{max-width:100%;border:1px solid #ddd;}</style></head><body>
    <h1>Kitchen Floor Plan</h1>
    <p>${placedItems.length} equipment items · ${studentMarkers.length} student positions</p>
    <img src="${printCanvas.toDataURL('image/png')}" alt="Kitchen Layout"/>
    <script>window.onload=function(){window.print();}<\/script></body></html>`);
    pw.document.close();
  });

  function showNotification(msg) {
    let el = document.getElementById('kitchen-notification');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kitchen-notification';
      el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#009432;color:#fff;padding:8px 20px;border-radius:8px;font-size:0.8125rem;font-weight:600;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2000);
  }

  /* ══════════════════════════════════════════
   * Legend
   * ══════════════════════════════════════════ */

  function buildLegend() {
    const legend = document.getElementById('floor-legend');
    const items = [
      { color: '#78716c', label: 'Cooking' },
      { color: '#a3896b', label: 'Prep' },
      { color: '#94a3b8', label: 'Water/Wet' },
      { color: '#d6d3d1', label: 'Storage' },
      { color: '#8b5cf6', label: 'Student' },
      { color: '#dc2626', label: 'Safety' },
    ];
    legend.innerHTML = items.map(i =>
      `<div class="legend-item"><span class="legend-swatch" style="background:${i.color};"></span>${i.label}</div>`
    ).join('');
  }

  /* ══════════════════════════════════════════
   * Init
   * ══════════════════════════════════════════ */

  buildPalette();
  buildLegend();
  resizeCanvas();

  // Apply default template after a small delay to ensure canvas is sized
  requestAnimationFrame(() => {
    resizeCanvas();
    applyTemplate('masterchef');
  });

})();
