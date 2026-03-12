(function() {
  'use strict';

  /* ══════════════════════════════════════════
   * Equipment Catalogue
   * ══════════════════════════════════════════ */

  const EQUIPMENT = {
    cooking: [
      { id: 'hob',       icon: '🔥', label: 'Hob / Stove', w: 70, h: 50, color: '#ef4444', safetyType: 'hot' },
      { id: 'oven',      icon: '♨️',  label: 'Oven',        w: 60, h: 50, color: '#dc2626', safetyType: 'hot' },
      { id: 'microwave', icon: '📡', label: 'Microwave',   w: 50, h: 40, color: '#f97316' },
      { id: 'wok',       icon: '🥘', label: 'Wok Station', w: 60, h: 50, color: '#ea580c', safetyType: 'hot' },
      { id: 'grill',     icon: '🥩', label: 'Grill',       w: 60, h: 40, color: '#b91c1c', safetyType: 'hot' },
    ],
    prep: [
      { id: 'chopping',  icon: '🔪', label: 'Chopping',    w: 70, h: 45, color: '#22c55e' },
      { id: 'counter',   icon: '🧱', label: 'Counter',     w: 80, h: 40, color: '#16a34a' },
      { id: 'mixer',     icon: '🍰', label: 'Mixer',       w: 45, h: 45, color: '#a3e635' },
      { id: 'scale',     icon: '⚖️',  label: 'Scale',       w: 40, h: 35, color: '#65a30d' },
      { id: 'sink',      icon: '🚰', label: 'Sink',        w: 55, h: 45, color: '#3b82f6', safetyType: 'wet' },
    ],
    storage: [
      { id: 'fridge',    icon: '🧊', label: 'Fridge',      w: 55, h: 60, color: '#60a5fa' },
      { id: 'pantry',    icon: '🗄️',  label: 'Pantry',      w: 60, h: 50, color: '#a78bfa' },
      { id: 'rack',      icon: '🍽️',  label: 'Dish Rack',   w: 50, h: 35, color: '#8b5cf6' },
      { id: 'bin',       icon: '🗑️',  label: 'Waste Bin',   w: 35, h: 35, color: '#475569' },
    ],
    safety: [
      { id: 'extinguisher', icon: '🧯', label: 'Extinguisher', w: 30, h: 30, color: '#ef4444' },
      { id: 'firstaid',    icon: '🩹', label: 'First Aid',    w: 30, h: 30, color: '#f43f5e' },
      { id: 'exit',        icon: '🚪', label: 'Exit',         w: 40, h: 45, color: '#22d3ee' },
      { id: 'apron',       icon: '🧤', label: 'Apron Hook',   w: 30, h: 35, color: '#f59e0b' },
    ],
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

  const canvas = document.getElementById('kitchen-canvas');
  const ctx = canvas.getContext('2d');
  const placedContainer = document.getElementById('placed-items');

  /* ══════════════════════════════════════════
   * Canvas sizing
   * ══════════════════════════════════════════ */

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
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

      // Click to add at centre
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        const equipId = btn.dataset.equip;
        const eq = EQUIPMENT[cat].find(e => e.id === equipId);
        if (!eq) return;
        addItem(eq, canvas.width / 2 - eq.w / 2, canvas.height / 2 - eq.h / 2);
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
      x: Math.round(x),
      y: Math.round(y),
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
        const size = Math.max(item.w, item.h) * 3;
        zone.style.cssText = `width:${size}px;height:${size}px;left:${item.x + item.w/2 - size/2}px;top:${item.y + item.h/2 - size/2}px;`;
        placedContainer.appendChild(zone);
      });
    }

    // Equipment items
    placedItems.forEach(item => {
      const el = document.createElement('div');
      el.className = `placed-item${selectedItem === item.id ? ' selected' : ''}`;
      el.dataset.itemId = item.id;
      el.style.cssText = `left:${item.x}px;top:${item.y}px;width:${item.w}px;height:${item.h}px;background:${item.color}cc;`;
      el.innerHTML = `
        <span class="item-icon">${item.icon}</span>
        <span class="item-label">${item.label}</span>
        <button class="remove-btn" data-remove="${item.id}">&times;</button>
      `;

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
      el.style.cssText = `left:${s.x}px;top:${s.y}px;width:28px;height:28px;background:#8b5cf6cc;`;
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
    const rect = canvas.getBoundingClientRect();
    dragItem.x = Math.max(0, Math.min(e.clientX - dragOffset.x, rect.width - (dragItem.w || 28)));
    dragItem.y = Math.max(0, Math.min(e.clientY - dragOffset.y, rect.height - (dragItem.h || 28)));
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
      const rect = floorPlan.getBoundingClientRect();
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
   * Canvas drawing — grid, walls, labels
   * ══════════════════════════════════════════ */

  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Floor
    ctx.fillStyle = '#1a1b2e';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = gridSize; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = gridSize; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Walls
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Title
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.textAlign = 'right';
    ctx.fillText('Kitchen Layout Planner — Co-Cher', w - 12, h - 10);
    ctx.textAlign = 'left';

    // Scale indicator
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(12, h - 20, 40, 2);
    ctx.font = '8px Inter, sans-serif';
    ctx.fillText('~1m', 16, h - 24);
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
    svg.innerHTML = `<defs><marker id="fah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#22c55e" opacity="0.6"/></marker></defs>`;

    for (let i = 0; i < points.length - 1; i++) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', points[i].x);
      line.setAttribute('y1', points[i].y);
      line.setAttribute('x2', points[i+1].x);
      line.setAttribute('y2', points[i+1].y);
      line.setAttribute('stroke', '#22c55e');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '6 4');
      line.setAttribute('opacity', '0.5');
      line.setAttribute('marker-end', 'url(#fah)');
      svg.appendChild(line);

      // Labels
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const labels = ['Prep → Cook', 'Cook → Plate'];
      text.setAttribute('x', (points[i].x + points[i+1].x) / 2);
      text.setAttribute('y', (points[i].y + points[i+1].y) / 2 - 8);
      text.setAttribute('fill', '#22c55e');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'Inter, sans-serif');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('opacity', '0.7');
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

    const safetyNote = item.safetyType === 'hot'
      ? '<span style="color:#ef4444;">⚠ Hot zone — keep clear paths. Students must use oven mitts.</span>'
      : item.safetyType === 'wet'
      ? '<span style="color:#3b82f6;">💧 Wet zone — ensure non-slip mats. Wipe spills immediately.</span>'
      : '<span style="color:#94a3b8;">No special safety requirements.</span>';

    infoDiv.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:1.5rem;">${item.icon}</span>
        <div>
          <div style="font-weight:600;font-size:0.8125rem;">${item.label}</div>
          <div style="font-size:0.625rem;color:#64748b;">${item.w}×${item.h} units</div>
        </div>
      </div>
      <div style="font-size:0.6875rem;color:#94a3b8;line-height:1.5;">
        <strong style="color:#e2e8f0;">Safety:</strong><br>
        ${safetyNote}
      </div>
      <div style="margin-top:8px;font-size:0.6875rem;color:#94a3b8;">
        <strong style="color:#e2e8f0;">Position:</strong> (${item.x}, ${item.y})
      </div>
    `;
  }

  /* ══════════════════════════════════════════
   * Templates / Presets
   * ══════════════════════════════════════════ */

  function applyTemplate(templateId) {
    placedItems = [];
    studentMarkers = [];
    selectedItem = null;
    const w = canvas.width, h = canvas.height;

    const templates = {
      blank: () => {},
      masterchef: () => {
        // MasterChef style: 4 cooking stations facing centre judge area
        const stations = [
          // Station 1 — top left
          { equipId: 'hob', x: 80, y: 40 },
          { equipId: 'chopping', x: 160, y: 40 },
          { equipId: 'sink', x: 240, y: 40 },
          // Station 2 — top right
          { equipId: 'hob', x: w - 320, y: 40 },
          { equipId: 'chopping', x: w - 240, y: 40 },
          { equipId: 'sink', x: w - 150, y: 40 },
          // Station 3 — bottom left
          { equipId: 'oven', x: 80, y: h - 100 },
          { equipId: 'counter', x: 150, y: h - 100 },
          { equipId: 'chopping', x: 240, y: h - 100 },
          // Station 4 — bottom right
          { equipId: 'oven', x: w - 310, y: h - 100 },
          { equipId: 'counter', x: w - 220, y: h - 100 },
          { equipId: 'chopping', x: w - 130, y: h - 100 },
          // Centre shared area
          { equipId: 'fridge', x: w/2 - 28, y: h/2 - 30 },
          { equipId: 'pantry', x: w/2 - 90, y: h/2 - 25 },
          { equipId: 'bin', x: w/2 + 40, y: h/2 - 18 },
          // Safety
          { equipId: 'extinguisher', x: 20, y: h/2 - 15 },
          { equipId: 'firstaid', x: w - 50, y: h/2 - 15 },
          { equipId: 'exit', x: w/2 - 20, y: h - 50 },
        ];
        stations.forEach(s => {
          const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
          const eq = allEquip.find(e => e.id === s.equipId);
          if (eq) addItem(eq, s.x, s.y);
        });
        // Student markers (2 per station)
        const studentNum = parseInt(document.getElementById('students-select').value) || 8;
        const positions = [
          { x: 130, y: 100 }, { x: 200, y: 100 },
          { x: w - 260, y: 100 }, { x: w - 190, y: 100 },
          { x: 130, y: h - 160 }, { x: 200, y: h - 160 },
          { x: w - 260, y: h - 160 }, { x: w - 190, y: h - 160 },
          { x: w/2 - 40, y: h/2 + 50 }, { x: w/2 + 20, y: h/2 + 50 },
          { x: 60, y: h/2 + 50 }, { x: w - 80, y: h/2 + 50 },
          { x: 130, y: h/2 }, { x: w - 150, y: h/2 },
          { x: w/2 - 80, y: 140 }, { x: w/2 + 50, y: 140 },
        ];
        for (let i = 0; i < Math.min(studentNum, positions.length); i++) {
          studentMarkers.push({ id: `s${i+1}`, x: positions[i].x, y: positions[i].y, num: i + 1 });
        }
      },
      'u-shape': () => {
        // U-shape: counters along 3 walls
        const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
        const find = id => allEquip.find(e => e.id === id);
        // Left wall
        [find('hob'), find('hob'), find('oven')].forEach((eq, i) => {
          if (eq) addItem(eq, 20, 60 + i * 80);
        });
        // Bottom wall
        [find('counter'), find('sink'), find('counter'), find('chopping')].forEach((eq, i) => {
          if (eq) addItem(eq, 120 + i * 100, h - 70);
        });
        // Right wall
        [find('fridge'), find('pantry'), find('rack')].forEach((eq, i) => {
          if (eq) addItem(eq, w - 80, 60 + i * 80);
        });
        addItem(find('extinguisher'), w/2, 20);
        addItem(find('exit'), w/2 - 20, h - 50);
      },
      island: () => {
        const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
        const find = id => allEquip.find(e => e.id === id);
        // Centre island
        [find('counter'), find('chopping'), find('counter')].forEach((eq, i) => {
          if (eq) addItem(eq, w/2 - 130 + i * 90, h/2 - 22);
        });
        // Perimeter cooking
        [find('hob'), find('hob'), find('oven')].forEach((eq, i) => {
          if (eq) addItem(eq, 30 + i * 90, 30);
        });
        // Perimeter storage
        [find('fridge'), find('pantry')].forEach((eq, i) => {
          if (eq) addItem(eq, w - 80, 40 + i * 80);
        });
        [find('sink'), find('rack')].forEach((eq, i) => {
          if (eq) addItem(eq, 30 + i * 80, h - 70);
        });
        addItem(find('extinguisher'), w - 50, h - 50);
      },
      pairs: () => {
        const allEquip = [...EQUIPMENT.cooking, ...EQUIPMENT.prep, ...EQUIPMENT.storage, ...EQUIPMENT.safety];
        const find = id => allEquip.find(e => e.id === id);
        // Paired workstations in rows
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            const bx = 60 + col * 240;
            const by = 60 + row * 240;
            addItem(find('hob'), bx, by);
            addItem(find('chopping'), bx + 80, by);
            addItem(find('sink'), bx + 40, by + 60);
          }
        }
        addItem(find('fridge'), w - 70, 30);
        addItem(find('pantry'), w - 70, 100);
        addItem(find('extinguisher'), 20, h - 50);
        addItem(find('exit'), w/2, h - 50);
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
    // Re-apply current template to update student count
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
   * Legend
   * ══════════════════════════════════════════ */

  function buildLegend() {
    const legend = document.getElementById('floor-legend');
    const items = [
      { color: '#ef4444', label: 'Cooking' },
      { color: '#22c55e', label: 'Prep' },
      { color: '#3b82f6', label: 'Water/Wet' },
      { color: '#a78bfa', label: 'Storage' },
      { color: '#8b5cf6', label: 'Student' },
      { color: '#475569', label: 'Other' },
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
