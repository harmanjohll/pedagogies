/* ======================================================
   Molecular Builder – SciSim Interactive  v3
   2D molecular editor with:
   - VSEPR geometry engine
   - Rotation (R key + drag, or scroll on selection)
   - Multi-select (Shift+click, or drag-box in Move mode)
   - Multiple molecules on canvas (presets ADD, don't replace)
   - Wedge/dash stereochemistry bonds
   - Up to 20 molecules
   ====================================================== */

(function () {
  "use strict";

  /* ===== Atom database ===== */
  const ATOMS = [
    { symbol: "H",  name: "Hydrogen",   valence: 1, mass: 1.008,  radius: 20, color: "#d0d0d0", text: "#333",  covalentR: 31  },
    { symbol: "C",  name: "Carbon",     valence: 4, mass: 12.011, radius: 26, color: "#333333", text: "#fff",  covalentR: 76  },
    { symbol: "N",  name: "Nitrogen",   valence: 3, mass: 14.007, radius: 24, color: "#3050d0", text: "#fff",  covalentR: 71  },
    { symbol: "O",  name: "Oxygen",     valence: 2, mass: 15.999, radius: 23, color: "#d03030", text: "#fff",  covalentR: 66  },
    { symbol: "F",  name: "Fluorine",   valence: 1, mass: 18.998, radius: 20, color: "#10b020", text: "#fff",  covalentR: 57  },
    { symbol: "S",  name: "Sulfur",     valence: 2, mass: 32.06,  radius: 26, color: "#c4a800", text: "#fff",  covalentR: 105 },
    { symbol: "Cl", name: "Chlorine",   valence: 1, mass: 35.45,  radius: 24, color: "#06d6a0", text: "#fff",  covalentR: 102 },
    { symbol: "Br", name: "Bromine",    valence: 1, mass: 79.904, radius: 25, color: "#a52a2a", text: "#fff",  covalentR: 120 },
    { symbol: "P",  name: "Phosphorus", valence: 3, mass: 30.974, radius: 24, color: "#ff8c00", text: "#fff",  covalentR: 107 },
  ];

  const BOND_HIT_DIST = 10;

  /* ===== Modes ===== */
  const MODE = { BOND: "bond", MOVE: "move", DELETE: "delete", ROTATE: "rotate" };

  /* ===== State ===== */
  let atoms = [];       // { id, symbol, x, y, data }
  let bonds = [];       // { from, to, order, stereo }
  let nextId = 1;
  let mode = MODE.BOND;
  let selectedElement = ATOMS[1]; // Carbon
  let selectedBondOrder = 1;

  // Selection
  let selected = new Set();      // atom ids
  let selectionBox = null;       // { x0, y0, x1, y1 } for drag-select

  // Interaction transients
  let dragging = null;           // { startX, startY, atoms:[{id,ox,oy}], moved }
  let linkPreview = null;        // { fromAtom, mx, my, snapAtom }
  let ghostDrag = null;          // palette→canvas
  let rotating = null;           // { cx, cy, startAngle, atomAngles:[{id, angle, dist}] }
  let hoveredAtom = null;
  let hoveredBond = null;

  /* ===== DOM ===== */
  const canvas = document.getElementById("mol-canvas");
  const ctx = canvas.getContext("2d");
  const hint = document.getElementById("canvas-hint");
  const paletteEl = document.getElementById("palette-atoms");
  const infoFormula = document.getElementById("info-formula");
  const infoMass = document.getElementById("info-mass");
  const infoBonds = document.getElementById("info-bonds");
  const infoWarnings = document.getElementById("info-warnings");
  const infoAtoms = document.getElementById("info-atoms");
  const infoGeometry = document.getElementById("info-geometry");
  const infoMolCount = document.getElementById("info-molcount");
  const presetEl = document.getElementById("preset-buttons");

  /* ===== Palette ===== */
  ATOMS.forEach(a => {
    const el = document.createElement("div");
    el.className = "palette-atom" + (a.symbol === selectedElement.symbol ? " selected" : "");
    el.style.setProperty("--atom-color", a.color);
    el.style.setProperty("--atom-bg", a.color + "18");
    el.innerHTML = `<span class="symbol">${a.symbol}</span><span class="valence">${a.valence}</span>`;
    el.title = `${a.name} – valence ${a.valence}`;

    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      selectedElement = a;
      document.querySelectorAll(".palette-atom").forEach(p => p.classList.remove("selected"));
      el.classList.add("selected");
      ghostDrag = { data: a, x: e.clientX, y: e.clientY };
      document.addEventListener("pointermove", onGhostMove);
      document.addEventListener("pointerup", onGhostUp);
    });

    paletteEl.appendChild(el);
  });

  function onGhostMove(e) {
    if (!ghostDrag) return;
    ghostDrag.x = e.clientX;
    ghostDrag.y = e.clientY;
    draw();
  }

  function onGhostUp(e) {
    if (!ghostDrag) return;
    document.removeEventListener("pointermove", onGhostMove);
    document.removeEventListener("pointerup", onGhostUp);
    const pos = clientToCanvas(e.clientX, e.clientY);
    if (isInCanvas(e.clientX, e.clientY)) {
      addAtom(ghostDrag.data, pos.x, pos.y);
      updateInfo();
    }
    ghostDrag = null;
    draw();
  }

  /* ===== Mode / tool buttons ===== */
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setMode(btn.dataset.mode);
    });
  });

  document.querySelectorAll(".bond-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedBondOrder = parseInt(btn.dataset.bond);
      document.querySelectorAll(".bond-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("btn-clear").addEventListener("click", () => {
    atoms = []; bonds = []; nextId = 1; selected.clear();
    updateInfo(); draw();
  });

  document.getElementById("btn-clean").addEventListener("click", () => {
    if (selected.size > 0) {
      cleanGeometrySubset(selected);
    } else {
      cleanGeometryAll();
    }
    draw();
  });

  /* ===== Coordinate helpers ===== */
  function clientToCanvas(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (cx - rect.left) * (canvas.width / rect.width) / dpr,
      y: (cy - rect.top) * (canvas.height / rect.height) / dpr,
    };
  }

  function canvasCoords(e) { return clientToCanvas(e.clientX, e.clientY); }

  function isInCanvas(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    return cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;
  }

  /* ===== Canvas sizing ===== */
  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = wrap.clientWidth * dpr;
    canvas.height = wrap.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  /* ===== Atom / bond helpers ===== */
  function addAtom(data, x, y) {
    const a = { id: nextId++, symbol: data.symbol, x, y, data };
    atoms.push(a);
    return a;
  }

  function getAtomAt(x, y) {
    for (let i = atoms.length - 1; i >= 0; i--) {
      const a = atoms[i];
      const dx = a.x - x, dy = a.y - y;
      if (dx * dx + dy * dy < a.data.radius * a.data.radius) return a;
    }
    return null;
  }

  function getBondAt(x, y) {
    for (const b of bonds) {
      const a1 = atomById(b.from), a2 = atomById(b.to);
      if (!a1 || !a2) continue;
      if (ptSegDist(x, y, a1.x, a1.y, a2.x, a2.y) < BOND_HIT_DIST) return b;
    }
    return null;
  }

  function atomById(id) { return atoms.find(a => a.id === id); }

  function ptSegDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function findBond(id1, id2) {
    return bonds.find(b => (b.from === id1 && b.to === id2) || (b.from === id2 && b.to === id1));
  }

  function bondOrderSum(atomId) {
    let s = 0;
    for (const b of bonds) {
      if (b.from === atomId || b.to === atomId) s += b.order;
    }
    return s;
  }

  function neighbours(atomId) {
    const ns = [];
    for (const b of bonds) {
      if (b.from === atomId) ns.push({ atom: atomById(b.to), bond: b });
      else if (b.to === atomId) ns.push({ atom: atomById(b.from), bond: b });
    }
    return ns;
  }

  function freeValence(atom) { return atom.data.valence - bondOrderSum(atom.id); }

  /* ===== Connected components (molecules) ===== */
  function getMolecules() {
    const visited = new Set();
    const molecules = [];
    for (const a of atoms) {
      if (visited.has(a.id)) continue;
      const mol = [];
      const queue = [a.id];
      visited.add(a.id);
      while (queue.length) {
        const id = queue.shift();
        mol.push(id);
        for (const n of neighbours(id)) {
          if (!visited.has(n.atom.id)) {
            visited.add(n.atom.id);
            queue.push(n.atom.id);
          }
        }
      }
      molecules.push(mol);
    }
    return molecules;
  }

  function getMoleculeOf(atomId) {
    const visited = new Set();
    const queue = [atomId];
    visited.add(atomId);
    while (queue.length) {
      const id = queue.shift();
      for (const n of neighbours(id)) {
        if (!visited.has(n.atom.id)) {
          visited.add(n.atom.id);
          queue.push(n.atom.id);
        }
      }
    }
    return visited;
  }

  /* ============================================================
     VSEPR Geometry Engine
     ============================================================ */

  function nextBondAngle(atom) {
    const nbrs = neighbours(atom.id);
    if (nbrs.length === 0) return -Math.PI / 6;

    const angles = nbrs.map(n => Math.atan2(n.atom.y - atom.y, n.atom.x - atom.x));
    const lp = computeLonePairs(atom);
    const stericN = nbrs.length + lp + 1;
    const idealSep = idealAngleSeparation(stericN);

    if (angles.length === 1) return angles[0] + idealSep;

    angles.sort((a, b) => a - b);
    let bestGap = -1, bestMid = 0;
    for (let i = 0; i < angles.length; i++) {
      const a1 = angles[i];
      const a2 = angles[(i + 1) % angles.length];
      let gap = a2 - a1;
      if (i === angles.length - 1) gap += Math.PI * 2;
      if (gap > bestGap) { bestGap = gap; bestMid = a1 + gap / 2; }
    }
    return bestMid;
  }

  function computeLonePairs(atom) {
    const used = bondOrderSum(atom.id);
    const ve = { H: 1, C: 4, N: 5, O: 6, F: 7, S: 6, Cl: 7, Br: 7, P: 5 }[atom.symbol] || 4;
    return Math.max(0, Math.floor((ve - used) / 2));
  }

  function idealAngleSeparation(sn) {
    switch (sn) {
      case 1: case 2: return Math.PI;
      case 3: return 2 * Math.PI / 3;
      case 4: return 109.5 * Math.PI / 180;
      case 5: return 90 * Math.PI / 180;
      case 6: return 90 * Math.PI / 180;
      default: return 2 * Math.PI / sn;
    }
  }

  function geometryLabel(atom) {
    const bn = neighbours(atom.id).length;
    const lp = computeLonePairs(atom);
    if (bn <= 1) return "";
    const labels = {
      "2-0": "Linear", "2-1": "Bent", "2-2": "Bent",
      "3-0": "Trigonal planar", "3-1": "Trigonal pyramidal",
      "4-0": "Tetrahedral", "4-1": "See-saw", "4-2": "Square planar",
    };
    return labels[bn + "-" + lp] || ((bn + lp) + " steric");
  }

  function bondLength(a1, a2) {
    const d1 = a1.data || a1;
    const d2 = a2.data || a2;
    return Math.max(50, Math.min(80, (d1.covalentR + d2.covalentR) * 0.5));
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  /* ===== Clean geometry ===== */
  function cleanGeometryAll() {
    const mols = getMolecules();
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr, ch = canvas.height / dpr;

    // Arrange molecules in a grid
    const cols = Math.ceil(Math.sqrt(mols.length));
    const cellW = cw / cols;
    const rows = Math.ceil(mols.length / cols);
    const cellH = ch / rows;

    mols.forEach((mol, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = cellW * (col + 0.5);
      const cy = cellH * (row + 0.5);
      layoutMolecule(mol, cx, cy);
    });
    updateInfo();
  }

  function cleanGeometrySubset(idSet) {
    // Find center of selected atoms
    let sx = 0, sy = 0, n = 0;
    for (const id of idSet) {
      const a = atomById(id);
      if (a) { sx += a.x; sy += a.y; n++; }
    }
    if (n === 0) return;
    // Get the connected molecules that include selected atoms
    const molIds = new Set();
    for (const id of idSet) {
      const mol = getMoleculeOf(id);
      for (const mid of mol) molIds.add(mid);
    }
    layoutMolecule([...molIds], sx / n, sy / n);
    updateInfo();
  }

  function layoutMolecule(molIds, cx, cy) {
    if (molIds.length === 0) return;

    // BFS from the heaviest/most-connected atom
    let root = null, bestScore = -1;
    for (const id of molIds) {
      const a = atomById(id);
      if (!a) continue;
      const score = neighbours(id).length * 100 + a.data.mass;
      if (score > bestScore) { bestScore = score; root = a; }
    }
    if (!root) return;

    const visited = new Set();
    const queue = [root.id];
    visited.add(root.id);
    root.x = cx;
    root.y = cy;

    while (queue.length) {
      const cid = queue.shift();
      const current = atomById(cid);
      const nbrs = neighbours(cid);
      const placed = [], unplaced = [];
      for (const n of nbrs) {
        if (visited.has(n.atom.id)) placed.push(n);
        else unplaced.push(n);
      }
      if (unplaced.length === 0) continue;

      const lp = computeLonePairs(current);
      const totalPos = nbrs.length + lp;
      let refAngle = placed.length > 0
        ? Math.atan2(current.y - placed[0].atom.y, current.x - placed[0].atom.x)
        : -Math.PI / 6;

      const sep = 2 * Math.PI / Math.max(totalPos, 2);
      const slots = [];
      for (let i = 0; i < totalPos; i++) slots.push(refAngle + sep * i);

      const usedSlots = new Set();
      for (const p of placed) {
        const ang = Math.atan2(p.atom.y - current.y, p.atom.x - current.x);
        let bi = 0, bd = Infinity;
        for (let i = 0; i < slots.length; i++) {
          if (usedSlots.has(i)) continue;
          const d = Math.abs(angleDiff(ang, slots[i]));
          if (d < bd) { bd = d; bi = i; }
        }
        usedSlots.add(bi);
      }

      const freeSlots = [];
      for (let i = 0; i < slots.length; i++) {
        if (!usedSlots.has(i)) freeSlots.push(slots[i]);
      }
      const bondSlots = freeSlots.slice(lp);

      for (let i = 0; i < unplaced.length && i < bondSlots.length; i++) {
        const n = unplaced[i];
        const angle = bondSlots[i];
        const len = bondLength(current, n.atom);
        n.atom.x = current.x + Math.cos(angle) * len;
        n.atom.y = current.y + Math.sin(angle) * len;
        visited.add(n.atom.id);
        queue.push(n.atom.id);
      }
    }
  }

  /* ===== Rotation ===== */
  function startRotation(x, y) {
    if (selected.size === 0) return false;

    // Compute centre of selection
    let cx = 0, cy = 0, n = 0;
    for (const id of selected) {
      const a = atomById(id);
      if (a) { cx += a.x; cy += a.y; n++; }
    }
    if (n === 0) return false;
    cx /= n; cy /= n;

    const startAngle = Math.atan2(y - cy, x - cx);
    const atomAngles = [];
    for (const id of selected) {
      const a = atomById(id);
      if (!a) continue;
      const ang = Math.atan2(a.y - cy, a.x - cx);
      const dist = Math.hypot(a.x - cx, a.y - cy);
      atomAngles.push({ id, angle: ang, dist });
    }

    rotating = { cx, cy, startAngle, atomAngles };
    return true;
  }

  function applyRotation(x, y) {
    if (!rotating) return;
    const currentAngle = Math.atan2(y - rotating.cy, x - rotating.cx);
    const delta = currentAngle - rotating.startAngle;

    for (const aa of rotating.atomAngles) {
      const a = atomById(aa.id);
      if (!a) continue;
      const newAngle = aa.angle + delta;
      a.x = rotating.cx + Math.cos(newAngle) * aa.dist;
      a.y = rotating.cy + Math.sin(newAngle) * aa.dist;
    }
  }

  /* ===== Angle snapping ===== */
  function snapToIdealAngle(atom, rawAngle) {
    const nbrs = neighbours(atom.id);
    if (nbrs.length === 0) {
      const snap30 = Math.round(rawAngle / (Math.PI / 6)) * (Math.PI / 6);
      if (Math.abs(angleDiff(rawAngle, snap30)) < 0.15) return snap30;
      return rawAngle;
    }
    const idealAngle = nextBondAngle(atom);
    if (Math.abs(angleDiff(rawAngle, idealAngle)) < 0.4) return idealAngle;
    const snap30 = Math.round(rawAngle / (Math.PI / 6)) * (Math.PI / 6);
    if (Math.abs(angleDiff(rawAngle, snap30)) < 0.15) return snap30;
    return rawAngle;
  }

  /* ===== Auto-fill H ===== */
  function autoFillH(atom) {
    const free = freeValence(atom);
    if (free <= 0) return;
    for (let i = 0; i < free; i++) {
      const angle = nextBondAngle(atom);
      const len = bondLength(atom, { covalentR: ATOMS[0].covalentR });
      const h = addAtom(ATOMS[0], atom.x + Math.cos(angle) * len, atom.y + Math.sin(angle) * len);
      bonds.push({ from: atom.id, to: h.id, order: 1, stereo: "none" });
    }
  }

  /* ============================================================
     Canvas Interaction
     ============================================================ */

  canvas.addEventListener("pointerdown", e => {
    const { x, y } = canvasCoords(e);
    const atom = getAtomAt(x, y);
    const bond = atom ? null : getBondAt(x, y);

    // DELETE
    if (mode === MODE.DELETE) {
      if (atom) {
        atoms = atoms.filter(a => a.id !== atom.id);
        bonds = bonds.filter(b => b.from !== atom.id && b.to !== atom.id);
        selected.delete(atom.id);
      } else if (bond) {
        bonds = bonds.filter(b => b !== bond);
      }
      updateInfo(); draw();
      return;
    }

    // ROTATE
    if (mode === MODE.ROTATE) {
      if (selected.size > 0) {
        startRotation(x, y);
        canvas.setPointerCapture(e.pointerId);
      }
      return;
    }

    // MOVE
    if (mode === MODE.MOVE) {
      if (atom) {
        // If shift-click, toggle selection
        if (e.shiftKey) {
          if (selected.has(atom.id)) selected.delete(atom.id);
          else selected.add(atom.id);
          draw();
          return;
        }

        // If clicking on a selected atom, drag entire selection
        // If clicking on unselected atom without shift, select just that molecule
        if (!selected.has(atom.id)) {
          selected.clear();
          const mol = getMoleculeOf(atom.id);
          for (const id of mol) selected.add(id);
        }

        // Start dragging all selected atoms
        const dragAtoms = [];
        for (const id of selected) {
          const a = atomById(id);
          if (a) dragAtoms.push({ id, ox: a.x - x, oy: a.y - y });
        }
        dragging = { startX: x, startY: y, atoms: dragAtoms, moved: false };
        canvas.setPointerCapture(e.pointerId);
      } else {
        // Start selection box
        if (!e.shiftKey) selected.clear();
        selectionBox = { x0: x, y0: y, x1: x, y1: y };
        canvas.setPointerCapture(e.pointerId);
      }
      draw();
      return;
    }

    // BOND mode
    if (atom) {
      linkPreview = { fromAtom: atom, mx: x, my: y, snapAtom: null };
      canvas.setPointerCapture(e.pointerId);
    } else if (bond) {
      if (e.shiftKey) {
        const stereos = ["none", "wedge", "dash"];
        const idx = stereos.indexOf(bond.stereo || "none");
        bond.stereo = stereos[(idx + 1) % stereos.length];
      } else {
        bond.order = bond.order >= 3 ? 1 : bond.order + 1;
      }
      updateInfo(); draw();
    } else {
      // Click empty canvas: place new atom
      if (atoms.length < 500) { // safety limit
        addAtom(selectedElement, x, y);
        updateInfo(); draw();
      }
    }
  });

  canvas.addEventListener("pointermove", e => {
    const { x, y } = canvasCoords(e);

    if (rotating) {
      applyRotation(x, y);
      draw();
      return;
    }

    if (dragging) {
      for (const da of dragging.atoms) {
        const a = atomById(da.id);
        if (a) { a.x = x + da.ox; a.y = y + da.oy; }
      }
      dragging.moved = true;
      draw();
      return;
    }

    if (selectionBox) {
      selectionBox.x1 = x;
      selectionBox.y1 = y;
      draw();
      return;
    }

    if (linkPreview) {
      linkPreview.mx = x;
      linkPreview.my = y;
      linkPreview.snapAtom = null;
      for (const a of atoms) {
        if (a.id === linkPreview.fromAtom.id) continue;
        const dx = a.x - x, dy = a.y - y;
        if (dx * dx + dy * dy < a.data.radius * a.data.radius * 1.8) {
          linkPreview.snapAtom = a;
          break;
        }
      }
      draw();
      return;
    }

    // Hover
    const prev = hoveredAtom, prevB = hoveredBond;
    hoveredAtom = getAtomAt(x, y);
    hoveredBond = hoveredAtom ? null : getBondAt(x, y);
    if (hoveredAtom !== prev || hoveredBond !== prevB) draw();

    canvas.style.cursor =
      mode === MODE.DELETE ? "crosshair" :
      mode === MODE.ROTATE ? (selected.size > 0 ? "grab" : "default") :
      mode === MODE.MOVE ? (hoveredAtom ? "grab" : "crosshair") :
      (hoveredAtom ? "pointer" : (hoveredBond ? "pointer" : "crosshair"));
  });

  canvas.addEventListener("pointerup", e => {
    const { x, y } = canvasCoords(e);

    if (rotating) {
      rotating = null;
      draw();
      return;
    }

    if (dragging) {
      dragging = null;
      draw();
      return;
    }

    if (selectionBox) {
      // Select all atoms within the box
      const bx = Math.min(selectionBox.x0, selectionBox.x1);
      const by = Math.min(selectionBox.y0, selectionBox.y1);
      const bw = Math.abs(selectionBox.x1 - selectionBox.x0);
      const bh = Math.abs(selectionBox.y1 - selectionBox.y0);
      if (bw > 5 || bh > 5) { // only if actually dragged
        for (const a of atoms) {
          if (a.x >= bx && a.x <= bx + bw && a.y >= by && a.y <= by + bh) {
            selected.add(a.id);
          }
        }
      }
      selectionBox = null;
      draw();
      return;
    }

    if (linkPreview) {
      const from = linkPreview.fromAtom;
      if (linkPreview.snapAtom) {
        const to = linkPreview.snapAtom;
        const existing = findBond(from.id, to.id);
        if (existing) {
          existing.order = existing.order >= 3 ? 1 : existing.order + 1;
        } else {
          bonds.push({ from: from.id, to: to.id, order: selectedBondOrder, stereo: "none" });
        }
      } else {
        const dist = Math.hypot(x - from.x, y - from.y);
        if (dist > 15) {
          let angle = Math.atan2(y - from.y, x - from.x);
          angle = snapToIdealAngle(from, angle);
          const len = bondLength(from, selectedElement);
          const newAtom = addAtom(selectedElement, from.x + Math.cos(angle) * len, from.y + Math.sin(angle) * len);
          bonds.push({ from: from.id, to: newAtom.id, order: selectedBondOrder, stereo: "none" });
        }
      }
      linkPreview = null;
      updateInfo(); draw();
      return;
    }
  });

  canvas.addEventListener("dblclick", e => {
    const { x, y } = canvasCoords(e);
    const bond = getBondAt(x, y);
    if (bond) {
      bond.order = bond.order >= 3 ? 1 : bond.order + 1;
      updateInfo(); draw();
      return;
    }
    const atom = getAtomAt(x, y);
    if (atom) {
      autoFillH(atom);
      updateInfo(); draw();
    }
  });

  // Scroll to rotate selection
  canvas.addEventListener("wheel", e => {
    if (selected.size === 0) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.05 : -0.05;

    let cx = 0, cy = 0, n = 0;
    for (const id of selected) {
      const a = atomById(id);
      if (a) { cx += a.x; cy += a.y; n++; }
    }
    if (n === 0) return;
    cx /= n; cy /= n;

    for (const id of selected) {
      const a = atomById(id);
      if (!a) continue;
      const ang = Math.atan2(a.y - cy, a.x - cx) + delta;
      const dist = Math.hypot(a.x - cx, a.y - cy);
      a.x = cx + Math.cos(ang) * dist;
      a.y = cy + Math.sin(ang) * dist;
    }
    draw();
  }, { passive: false });

  /* ============================================================
     Drawing
     ============================================================ */

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    drawGrid(w, h);

    // Selection box
    if (selectionBox) {
      ctx.save();
      ctx.fillStyle = "rgba(67,97,238,0.08)";
      ctx.strokeStyle = "rgba(67,97,238,0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      const bx = Math.min(selectionBox.x0, selectionBox.x1);
      const by = Math.min(selectionBox.y0, selectionBox.y1);
      const bw = Math.abs(selectionBox.x1 - selectionBox.x0);
      const bh = Math.abs(selectionBox.y1 - selectionBox.y0);
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
    }

    // Bonds
    for (const b of bonds) {
      const a1 = atomById(b.from), a2 = atomById(b.to);
      if (!a1 || !a2) continue;
      drawBond(a1, a2, b.order, b.stereo || "none", b === hoveredBond);
    }

    // Link preview
    if (linkPreview) {
      const from = linkPreview.fromAtom;
      let tx = linkPreview.mx, ty = linkPreview.my;
      if (linkPreview.snapAtom) { tx = linkPreview.snapAtom.x; ty = linkPreview.snapAtom.y; }
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#4361ee";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();

      if (!linkPreview.snapAtom) {
        let angle = Math.atan2(ty - from.y, tx - from.x);
        angle = snapToIdealAngle(from, angle);
        const len = bondLength(from, selectedElement);
        const px = from.x + Math.cos(angle) * len;
        const py = from.y + Math.sin(angle) * len;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(px, py, selectedElement.radius, 0, Math.PI * 2);
        ctx.fillStyle = selectedElement.color;
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = selectedElement.text;
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(selectedElement.symbol, px, py);
        ctx.restore();
      }
    }

    // Rotation pivot
    if (rotating) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(rotating.cx, rotating.cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#4361ee";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rotating.cx, rotating.cy, 20, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(67,97,238,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }

    // Atoms
    for (const a of atoms) {
      drawAtom(a, a === hoveredAtom, selected.has(a.id));
    }

    // Ghost drag
    if (ghostDrag) {
      const pos = clientToCanvas(ghostDrag.x, ghostDrag.y);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ghostDrag.data.radius, 0, Math.PI * 2);
      ctx.fillStyle = ghostDrag.data.color;
      ctx.fill();
      ctx.fillStyle = ghostDrag.data.text;
      ctx.font = "bold 12px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ghostDrag.data.symbol, pos.x, pos.y);
      ctx.restore();
    }

    hint.style.display = atoms.length === 0 && !ghostDrag ? "block" : "none";
  }

  function drawGrid(w, h) {
    ctx.strokeStyle = "rgba(150,150,150,0.06)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }
  }

  function drawBond(a1, a2, order, stereo, highlighted) {
    const dx = a2.x - a1.x, dy = a2.y - a1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const r1 = a1.data.radius * 0.65, r2 = a2.data.radius * 0.65;
    const x1 = a1.x + ux * r1, y1 = a1.y + uy * r1;
    const x2 = a2.x - ux * r2, y2 = a2.y - uy * r2;

    ctx.lineCap = "round";

    if (stereo === "wedge") { drawWedgeBond(x1, y1, x2, y2, nx, ny, highlighted); return; }
    if (stereo === "dash") { drawDashBond(x1, y1, x2, y2, nx, ny, highlighted); return; }

    const color = highlighted ? "#4361ee" : "#555";
    ctx.strokeStyle = color;
    ctx.lineWidth = highlighted ? 3 : 2;
    const gap = 3.5;

    if (order === 1) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    } else if (order === 2) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x1 + nx * gap * s, y1 + ny * gap * s);
        ctx.lineTo(x2 + nx * gap * s, y2 + ny * gap * s);
        ctx.stroke();
      }
    } else if (order === 3) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x1 + nx * gap * 1.4 * s, y1 + ny * gap * 1.4 * s);
        ctx.lineTo(x2 + nx * gap * 1.4 * s, y2 + ny * gap * 1.4 * s);
        ctx.stroke();
      }
    }
  }

  function drawWedgeBond(x1, y1, x2, y2, nx, ny, hl) {
    const hw = 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 + nx * hw, y2 + ny * hw);
    ctx.lineTo(x2 - nx * hw, y2 - ny * hw);
    ctx.closePath();
    ctx.fillStyle = hl ? "#4361ee" : "#555";
    ctx.fill();
  }

  function drawDashBond(x1, y1, x2, y2, nx, ny, hl) {
    const steps = 7, maxW = 5;
    ctx.strokeStyle = hl ? "#4361ee" : "#555";
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
      const hw = maxW * t;
      ctx.beginPath();
      ctx.moveTo(cx + nx * hw, cy + ny * hw);
      ctx.lineTo(cx - nx * hw, cy - ny * hw);
      ctx.stroke();
    }
  }

  function drawAtom(atom, hovered, sel) {
    const r = atom.data.radius;
    const bc = bondOrderSum(atom.id);
    const over = bc > atom.data.valence;

    // Selection highlight
    if (sel) {
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(67,97,238,0.12)";
      ctx.fill();
      ctx.strokeStyle = "rgba(67,97,238,0.5)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Shadow
    ctx.beginPath();
    ctx.arc(atom.x, atom.y + 1.5, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(atom.x, atom.y, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(atom.x - r * 0.25, atom.y - r * 0.25, r * 0.1, atom.x, atom.y, r);
    grad.addColorStop(0, lighten(atom.data.color, 55));
    grad.addColorStop(1, atom.data.color);
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.strokeStyle = over ? "#ef476f" : (hovered ? "#4361ee" : darken(atom.data.color, 20));
    ctx.lineWidth = over ? 2.5 : (hovered ? 2.5 : 1.5);
    ctx.stroke();

    if (over) {
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(239,71,111,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Symbol
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 2;
    ctx.fillStyle = atom.data.text;
    ctx.font = `bold ${Math.round(r * 0.65)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(atom.symbol, atom.x, atom.y);
    ctx.restore();

    // Free valence
    const free = atom.data.valence - bc;
    if (atoms.length > 1 || bonds.length > 0) {
      ctx.font = "bold 8px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (over) {
        ctx.fillStyle = "#ef476f";
        ctx.fillText("!" + bc + "/" + atom.data.valence, atom.x, atom.y + r + 10);
      } else if (free === 0) {
        ctx.fillStyle = "#06d6a0";
        ctx.fillText("\u2713", atom.x, atom.y + r + 10);
      } else {
        ctx.fillStyle = "rgba(100,100,100,0.45)";
        ctx.fillText(free + " free", atom.x, atom.y + r + 10);
      }
    }
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.replace("#", ""), 16);
    return `rgb(${Math.min(255, ((n >> 16) & 0xff) + amt)},${Math.min(255, ((n >> 8) & 0xff) + amt)},${Math.min(255, (n & 0xff) + amt)})`;
  }

  function darken(hex, amt) {
    const n = parseInt(hex.replace("#", ""), 16);
    return `rgb(${Math.max(0, ((n >> 16) & 0xff) - amt)},${Math.max(0, ((n >> 8) & 0xff) - amt)},${Math.max(0, (n & 0xff) - amt)})`;
  }

  /* ===== Info panel ===== */
  function updateInfo() {
    const mols = getMolecules();

    if (atoms.length === 0) {
      infoFormula.textContent = "\u2014";
      infoMass.textContent = "\u2014";
      infoBonds.textContent = "\u2014";
      infoWarnings.textContent = "None";
      infoWarnings.style.color = "";
      infoAtoms.textContent = "\u2014";
      if (infoGeometry) infoGeometry.textContent = "\u2014";
      if (infoMolCount) infoMolCount.textContent = "\u2014";
      return;
    }

    // Molecule count
    if (infoMolCount) {
      infoMolCount.textContent = mols.length + (mols.length === 1 ? " molecule" : " molecules") +
        " (" + atoms.length + " atoms)";
    }

    // Per-molecule formulas
    const formulas = mols.map(mol => {
      const counts = {};
      mol.forEach(id => {
        const a = atomById(id);
        if (a) counts[a.symbol] = (counts[a.symbol] || 0) + 1;
      });
      const order = [];
      if (counts.C) { order.push("C"); if (counts.H) order.push("H"); }
      Object.keys(counts).sort().forEach(s => { if (!order.includes(s)) order.push(s); });
      return order.map(s => s + (counts[s] > 1 ? subscript(counts[s]) : "")).join("");
    });
    infoFormula.textContent = formulas.join(" + ");

    // Total mass
    let mass = 0;
    atoms.forEach(a => mass += a.data.mass);
    infoMass.textContent = mass.toFixed(3) + " g/mol";

    // Bond summary
    const singles = bonds.filter(b => b.order === 1).length;
    const doubles = bonds.filter(b => b.order === 2).length;
    const triples = bonds.filter(b => b.order === 3).length;
    const parts = [];
    if (singles) parts.push(singles + "\u00d71");
    if (doubles) parts.push(doubles + "\u00d72");
    if (triples) parts.push(triples + "\u00d73");
    infoBonds.textContent = bonds.length + " bonds" + (parts.length ? " (" + parts.join(", ") + ")" : "");

    // Warnings
    const warnings = [];
    atoms.forEach(a => {
      const bc = bondOrderSum(a.id);
      if (bc > a.data.valence) warnings.push(a.symbol + "#" + a.id);
    });
    infoWarnings.textContent = warnings.length ? warnings.length + " over-valence: " + warnings.join(", ") : "None";
    infoWarnings.style.color = warnings.length ? "var(--color-danger)" : "var(--color-success)";

    // Geometry
    if (infoGeometry) {
      const central = atoms.filter(a => neighbours(a.id).length >= 2);
      infoGeometry.textContent = central.length === 0 ? "\u2014" :
        central.map(a => {
          const lp = computeLonePairs(a);
          const bn = neighbours(a.id).length;
          return a.symbol + "#" + a.id + ": " + geometryLabel(a) +
            " (" + bn + "b" + (lp ? "+" + lp + "lp" : "") + ")";
        }).join("\n");
    }

    // Atom list
    infoAtoms.textContent = atoms.filter(a => neighbours(a.id).length >= 2).map(a => {
      return a.symbol + "#" + a.id + ": " + geometryLabel(a);
    }).filter(Boolean).join(", ") || "All terminal";
  }

  function subscript(n) {
    const subs = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089";
    return String(n).split("").map(d => subs[parseInt(d)]).join("");
  }

  /* ===== Presets (ADD to canvas, don't replace) ===== */
  function findOpenPosition() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    // Try to find a position not overlapping existing atoms
    for (let attempt = 0; attempt < 50; attempt++) {
      const cx = 100 + Math.random() * (w - 200);
      const cy = 80 + Math.random() * (h - 160);
      let tooClose = false;
      for (const a of atoms) {
        if (Math.hypot(a.x - cx, a.y - cy) < 120) { tooClose = true; break; }
      }
      if (!tooClose) return { cx, cy };
    }
    return { cx: w / 2, cy: h / 2 };
  }

  const PRESETS = [
    {
      name: "Water (H\u2082O)",
      build(cx, cy) {
        const o = addAtom(ATOMS[3], cx, cy);
        const ha = 104.5 / 2 * Math.PI / 180;
        const len = bondLength(ATOMS[3], ATOMS[0]);
        const h1 = addAtom(ATOMS[0], cx - Math.sin(ha) * len, cy + Math.cos(ha) * len);
        const h2 = addAtom(ATOMS[0], cx + Math.sin(ha) * len, cy + Math.cos(ha) * len);
        bonds.push({ from: o.id, to: h1.id, order: 1, stereo: "none" });
        bonds.push({ from: o.id, to: h2.id, order: 1, stereo: "none" });
      }
    },
    {
      name: "Methane (CH\u2084)",
      build(cx, cy) {
        const c = addAtom(ATOMS[1], cx, cy);
        const len = bondLength(ATOMS[1], ATOMS[0]);
        const h1 = addAtom(ATOMS[0], cx - len * Math.sin(Math.PI / 6), cy + len * Math.cos(Math.PI / 6));
        const h2 = addAtom(ATOMS[0], cx + len * Math.sin(Math.PI / 6), cy + len * Math.cos(Math.PI / 6));
        const h3 = addAtom(ATOMS[0], cx, cy - len);
        const h4 = addAtom(ATOMS[0], cx, cy + len * 0.4);
        bonds.push({ from: c.id, to: h1.id, order: 1, stereo: "none" });
        bonds.push({ from: c.id, to: h2.id, order: 1, stereo: "none" });
        bonds.push({ from: c.id, to: h3.id, order: 1, stereo: "wedge" });
        bonds.push({ from: c.id, to: h4.id, order: 1, stereo: "dash" });
      }
    },
    {
      name: "CO\u2082",
      build(cx, cy) {
        const c = addAtom(ATOMS[1], cx, cy);
        const len = bondLength(ATOMS[1], ATOMS[3]);
        const o1 = addAtom(ATOMS[3], cx - len, cy);
        const o2 = addAtom(ATOMS[3], cx + len, cy);
        bonds.push({ from: c.id, to: o1.id, order: 2, stereo: "none" });
        bonds.push({ from: c.id, to: o2.id, order: 2, stereo: "none" });
      }
    },
    {
      name: "Ammonia (NH\u2083)",
      build(cx, cy) {
        const n = addAtom(ATOMS[2], cx, cy);
        const len = bondLength(ATOMS[2], ATOMS[0]);
        const sep = 107 * Math.PI / 180;
        const start = Math.PI / 2 + sep / 2;
        for (let i = 0; i < 3; i++) {
          const angle = start + (i - 1) * sep;
          const h = addAtom(ATOMS[0], cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
          bonds.push({ from: n.id, to: h.id, order: 1, stereo: "none" });
        }
      }
    },
    {
      name: "Ethanol (C\u2082H\u2085OH)",
      build(cx, cy) {
        const lcc = bondLength(ATOMS[1], ATOMS[1]);
        const lco = bondLength(ATOMS[1], ATOMS[3]);
        const lch = bondLength(ATOMS[1], ATOMS[0]);
        const loh = bondLength(ATOMS[3], ATOMS[0]);
        const c1 = addAtom(ATOMS[1], cx - lcc * 0.5, cy);
        const c2 = addAtom(ATOMS[1], cx + lcc * 0.5, cy);
        const o = addAtom(ATOMS[3], c2.x + lco * Math.cos(-Math.PI / 6), cy + lco * Math.sin(-Math.PI / 6));
        bonds.push({ from: c1.id, to: c2.id, order: 1, stereo: "none" });
        bonds.push({ from: c2.id, to: o.id, order: 1, stereo: "none" });
        const oh = addAtom(ATOMS[0], o.x + loh * Math.cos(Math.PI / 4), o.y + loh * Math.sin(Math.PI / 4));
        bonds.push({ from: o.id, to: oh.id, order: 1, stereo: "none" });
        for (const ang of [Math.PI, -Math.PI / 2, Math.PI + Math.PI / 3]) {
          const h = addAtom(ATOMS[0], c1.x + Math.cos(ang) * lch, c1.y + Math.sin(ang) * lch);
          bonds.push({ from: c1.id, to: h.id, order: 1, stereo: "none" });
        }
        for (const ang of [-Math.PI / 2, Math.PI / 2 + Math.PI / 6]) {
          const h = addAtom(ATOMS[0], c2.x + Math.cos(ang) * lch, c2.y + Math.sin(ang) * lch);
          bonds.push({ from: c2.id, to: h.id, order: 1, stereo: "none" });
        }
      }
    },
    {
      name: "Nitrogen (N\u2082)",
      build(cx, cy) {
        const len = bondLength(ATOMS[2], ATOMS[2]);
        const n1 = addAtom(ATOMS[2], cx - len / 2, cy);
        const n2 = addAtom(ATOMS[2], cx + len / 2, cy);
        bonds.push({ from: n1.id, to: n2.id, order: 3, stereo: "none" });
      }
    },
    {
      name: "Benzene (C\u2086H\u2086)",
      build(cx, cy) {
        const ringR = 55;
        const cs = [];
        for (let i = 0; i < 6; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 3;
          cs.push(addAtom(ATOMS[1], cx + Math.cos(angle) * ringR, cy + Math.sin(angle) * ringR));
        }
        for (let i = 0; i < 6; i++) {
          bonds.push({ from: cs[i].id, to: cs[(i + 1) % 6].id, order: (i % 2 === 0) ? 2 : 1, stereo: "none" });
        }
        const lch = bondLength(ATOMS[1], ATOMS[0]);
        for (let i = 0; i < 6; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 3;
          const h = addAtom(ATOMS[0], cx + Math.cos(angle) * (ringR + lch), cy + Math.sin(angle) * (ringR + lch));
          bonds.push({ from: cs[i].id, to: h.id, order: 1, stereo: "none" });
        }
      }
    },
    {
      name: "Ethene (C\u2082H\u2084)",
      build(cx, cy) {
        const lcc = bondLength(ATOMS[1], ATOMS[1]);
        const lch = bondLength(ATOMS[1], ATOMS[0]);
        const c1 = addAtom(ATOMS[1], cx - lcc / 2, cy);
        const c2 = addAtom(ATOMS[1], cx + lcc / 2, cy);
        bonds.push({ from: c1.id, to: c2.id, order: 2, stereo: "none" });
        for (const a of [Math.PI - Math.PI / 3, Math.PI + Math.PI / 3]) {
          const h = addAtom(ATOMS[0], c1.x + Math.cos(a) * lch, c1.y + Math.sin(a) * lch);
          bonds.push({ from: c1.id, to: h.id, order: 1, stereo: "none" });
        }
        for (const a of [-Math.PI / 3, Math.PI / 3]) {
          const h = addAtom(ATOMS[0], c2.x + Math.cos(a) * lch, c2.y + Math.sin(a) * lch);
          bonds.push({ from: c2.id, to: h.id, order: 1, stereo: "none" });
        }
      }
    },
  ];

  PRESETS.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      // Check molecule limit
      const currentMols = getMolecules().length;
      if (currentMols >= 20) {
        alert("Maximum 20 molecules on canvas. Clear some to add more.");
        return;
      }
      const { cx, cy } = findOpenPosition();
      p.build(cx, cy);
      updateInfo(); draw();
    });
    presetEl.appendChild(btn);
  });

  /* ===== Keyboard shortcuts ===== */
  document.addEventListener("keydown", e => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selected.size > 0) {
        atoms = atoms.filter(a => !selected.has(a.id));
        bonds = bonds.filter(b => !selected.has(b.from) && !selected.has(b.to));
        selected.clear();
        updateInfo(); draw();
        return;
      }
      if (hoveredAtom) {
        atoms = atoms.filter(a => a.id !== hoveredAtom.id);
        bonds = bonds.filter(b => b.from !== hoveredAtom.id && b.to !== hoveredAtom.id);
        hoveredAtom = null;
        updateInfo(); draw();
      } else if (hoveredBond) {
        bonds = bonds.filter(b => b !== hoveredBond);
        hoveredBond = null;
        updateInfo(); draw();
      }
      return;
    }

    if (e.key === "1") { selectedBondOrder = 1; syncBondBtns(); }
    if (e.key === "2") { selectedBondOrder = 2; syncBondBtns(); }
    if (e.key === "3") { selectedBondOrder = 3; syncBondBtns(); }

    if (e.key === "b" || e.key === "B") setMode(MODE.BOND);
    if (e.key === "v" || e.key === "V") setMode(MODE.MOVE);
    if (e.key === "x" || e.key === "X") setMode(MODE.DELETE);
    if (e.key === "r" || e.key === "R") setMode(MODE.ROTATE);

    if ((e.key === "h" || e.key === "H") && !e.ctrlKey && !e.metaKey) {
      const targets = selected.size > 0
        ? atoms.filter(a => selected.has(a.id) && freeValence(a) > 0)
        : atoms.filter(a => freeValence(a) > 0);
      targets.forEach(a => autoFillH(a));
      updateInfo(); draw();
    }

    if (e.key === "l" || e.key === "L") {
      if (selected.size > 0) cleanGeometrySubset(selected);
      else cleanGeometryAll();
      draw();
    }

    if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      selected.clear();
      atoms.forEach(a => selected.add(a.id));
      draw();
    }

    if (e.key === "Escape") {
      selected.clear();
      draw();
    }
  });

  function setMode(m) {
    mode = m;
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === m));
  }

  function syncBondBtns() {
    document.querySelectorAll(".bond-btn").forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.bond) === selectedBondOrder);
    });
  }

  /* ===== Init ===== */
  draw();
})();
