/* ======================================================
   Molecular Builder – SciSim Interactive
   Drag-and-drop 2D molecule construction with valence rules
   ====================================================== */

(function () {
  "use strict";

  /* ---------- Atom data ---------- */
  const ATOMS = [
    { symbol: "H",  name: "Hydrogen",  valence: 1, mass: 1.008,  color: "#e8e8e8", border: "#999"    },
    { symbol: "C",  name: "Carbon",    valence: 4, mass: 12.011, color: "#333",     border: "#333"    },
    { symbol: "N",  name: "Nitrogen",  valence: 3, mass: 14.007, color: "#3753db",  border: "#3753db" },
    { symbol: "O",  name: "Oxygen",    valence: 2, mass: 15.999, color: "#e04040",  border: "#e04040" },
    { symbol: "F",  name: "Fluorine",  valence: 1, mass: 18.998, color: "#1dc41d",  border: "#1dc41d" },
    { symbol: "S",  name: "Sulfur",    valence: 2, mass: 32.06,  color: "#c4a800",  border: "#c4a800" },
    { symbol: "Cl", name: "Chlorine",  valence: 1, mass: 35.45,  color: "#06d6a0",  border: "#06d6a0" },
    { symbol: "Br", name: "Bromine",   valence: 1, mass: 79.904, color: "#a52a2a",  border: "#a52a2a" },
    { symbol: "P",  name: "Phosphorus",valence: 3, mass: 30.974, color: "#ff8c00",  border: "#ff8c00" },
  ];

  const ATOM_RADIUS = 24;
  const BOND_HIT = 8;

  /* ---------- State ---------- */
  let atoms = [];       // { id, symbol, x, y, data }
  let bonds = [];       // { from, to, order }
  let nextId = 1;
  let selectedBondOrder = 1;
  let deleteMode = false;
  let dragging = null;  // { atom, offsetX, offsetY }
  let linking = null;   // { fromAtom, x, y }
  let hoveredAtom = null;
  let hoveredBond = null;
  let ghostDrag = null; // palette drag: { data, x, y }

  /* ---------- DOM refs ---------- */
  const canvas = document.getElementById("mol-canvas");
  const ctx = canvas.getContext("2d");
  const hint = document.getElementById("canvas-hint");
  const paletteEl = document.getElementById("palette-atoms");
  const infoFormula = document.getElementById("info-formula");
  const infoMass = document.getElementById("info-mass");
  const infoBonds = document.getElementById("info-bonds");
  const infoWarnings = document.getElementById("info-warnings");
  const infoAtoms = document.getElementById("info-atoms");
  const presetEl = document.getElementById("preset-buttons");

  /* ---------- Build palette ---------- */
  ATOMS.forEach(a => {
    const el = document.createElement("div");
    el.className = "palette-atom";
    el.style.setProperty("--atom-color", a.border);
    el.style.setProperty("--atom-bg", a.color + "18");
    el.innerHTML = `<span class="symbol">${a.symbol}</span><span class="valence">${a.valence}</span>`;
    el.setAttribute("draggable", "false");

    // Pointer-based drag from palette
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
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
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (x > 0 && y > 0 && x < canvas.width && y < canvas.height) {
      addAtom(ghostDrag.data, x, y);
    }
    ghostDrag = null;
    draw();
  }

  /* ---------- Bond tool buttons ---------- */
  document.querySelectorAll(".bond-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".bond-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedBondOrder = parseInt(btn.dataset.bond);
      deleteMode = false;
      document.getElementById("btn-delete").classList.remove("active");
    });
  });

  /* ---------- Tool buttons ---------- */
  document.getElementById("btn-delete").addEventListener("click", () => {
    deleteMode = !deleteMode;
    document.getElementById("btn-delete").classList.toggle("active", deleteMode);
  });
  document.getElementById("btn-clear").addEventListener("click", () => {
    atoms = [];
    bonds = [];
    nextId = 1;
    updateInfo();
    draw();
  });

  /* ---------- Canvas sizing ---------- */
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

  /* ---------- Helpers ---------- */
  function addAtom(data, x, y) {
    atoms.push({ id: nextId++, symbol: data.symbol, x, y, data });
    updateInfo();
  }

  function getAtomAt(cx, cy) {
    for (let i = atoms.length - 1; i >= 0; i--) {
      const a = atoms[i];
      const dx = a.x - cx, dy = a.y - cy;
      if (dx * dx + dy * dy < ATOM_RADIUS * ATOM_RADIUS) return a;
    }
    return null;
  }

  function getBondAt(cx, cy) {
    for (const b of bonds) {
      const a1 = atoms.find(a => a.id === b.from);
      const a2 = atoms.find(a => a.id === b.to);
      if (!a1 || !a2) continue;
      const dist = pointToSegment(cx, cy, a1.x, a1.y, a2.x, a2.y);
      if (dist < BOND_HIT + 4) return b;
    }
    return null;
  }

  function pointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function bondExists(id1, id2) {
    return bonds.find(b => (b.from === id1 && b.to === id2) || (b.from === id2 && b.to === id1));
  }

  function getBondCount(atomId) {
    let count = 0;
    for (const b of bonds) {
      if (b.from === atomId || b.to === atomId) count += b.order;
    }
    return count;
  }

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1),
      y: (e.clientY - rect.top) * (canvas.height / rect.height) / (window.devicePixelRatio || 1)
    };
  }

  /* ---------- Canvas interaction ---------- */
  canvas.addEventListener("pointerdown", e => {
    const { x, y } = canvasCoords(e);
    const atom = getAtomAt(x, y);

    if (deleteMode) {
      if (atom) {
        atoms = atoms.filter(a => a.id !== atom.id);
        bonds = bonds.filter(b => b.from !== atom.id && b.to !== atom.id);
        updateInfo();
        draw();
      } else {
        const bond = getBondAt(x, y);
        if (bond) {
          bonds = bonds.filter(b => b !== bond);
          updateInfo();
          draw();
        }
      }
      return;
    }

    if (atom) {
      if (e.shiftKey) {
        // Start linking
        linking = { fromAtom: atom, x: atom.x, y: atom.y };
      } else {
        // Start dragging
        dragging = { atom, offsetX: x - atom.x, offsetY: y - atom.y };
      }
    }
  });

  canvas.addEventListener("pointermove", e => {
    const { x, y } = canvasCoords(e);

    if (dragging) {
      dragging.atom.x = x - dragging.offsetX;
      dragging.atom.y = y - dragging.offsetY;
      draw();
      return;
    }

    if (linking) {
      linking.x = x;
      linking.y = y;
      draw();
      return;
    }

    // Hover detection
    const prevAtom = hoveredAtom;
    const prevBond = hoveredBond;
    hoveredAtom = getAtomAt(x, y);
    hoveredBond = hoveredAtom ? null : getBondAt(x, y);
    if (hoveredAtom !== prevAtom || hoveredBond !== prevBond) draw();

    canvas.style.cursor = deleteMode
      ? "crosshair"
      : (hoveredAtom ? "grab" : (hoveredBond ? "pointer" : "default"));
  });

  canvas.addEventListener("pointerup", e => {
    if (linking) {
      const { x, y } = canvasCoords(e);
      const target = getAtomAt(x, y);
      if (target && target.id !== linking.fromAtom.id) {
        const existing = bondExists(linking.fromAtom.id, target.id);
        if (existing) {
          // Cycle bond order
          existing.order = existing.order >= 3 ? 1 : existing.order + 1;
        } else {
          bonds.push({ from: linking.fromAtom.id, to: target.id, order: selectedBondOrder });
        }
        updateInfo();
      }
      linking = null;
      draw();
    }
    dragging = null;
  });

  // Double-click to cycle bond
  canvas.addEventListener("dblclick", e => {
    const { x, y } = canvasCoords(e);
    const bond = getBondAt(x, y);
    if (bond) {
      bond.order = bond.order >= 3 ? 1 : bond.order + 1;
      updateInfo();
      draw();
    }
  });

  /* ---------- Drawing ---------- */
  function draw() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(150,150,150,0.08)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    // Bonds
    for (const b of bonds) {
      const a1 = atoms.find(a => a.id === b.from);
      const a2 = atoms.find(a => a.id === b.to);
      if (!a1 || !a2) continue;
      drawBond(a1, a2, b.order, b === hoveredBond);
    }

    // Linking preview
    if (linking) {
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "var(--color-primary)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(linking.fromAtom.x, linking.fromAtom.y);
      ctx.lineTo(linking.x, linking.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Atoms
    for (const a of atoms) {
      drawAtomOnCanvas(a, a === hoveredAtom);
    }

    // Ghost drag from palette
    if (ghostDrag) {
      const rect = canvas.getBoundingClientRect();
      const gx = (ghostDrag.x - rect.left) * (canvas.width / rect.width) / (window.devicePixelRatio || 1);
      const gy = (ghostDrag.y - rect.top) * (canvas.height / rect.height) / (window.devicePixelRatio || 1);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(gx, gy, ATOM_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = ghostDrag.data.color;
      ctx.fill();
      ctx.strokeStyle = ghostDrag.data.border;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = ghostDrag.data.color === "#333" ? "#fff" : "#fff";
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ghostDrag.data.symbol, gx, gy);
      ctx.globalAlpha = 1;
    }

    // Hint
    hint.style.display = atoms.length === 0 && !ghostDrag ? "block" : "none";
  }

  function drawBond(a1, a2, order, highlighted) {
    const dx = a2.x - a1.x;
    const dy = a2.y - a1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const nx = -dy / len;
    const ny = dx / len;
    const gap = 5;

    ctx.strokeStyle = highlighted ? "#4361ee" : "#666";
    ctx.lineWidth = highlighted ? 3 : 2;
    ctx.lineCap = "round";

    if (order === 1) {
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
    } else if (order === 2) {
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(a1.x + nx * gap * i * 0.5, a1.y + ny * gap * i * 0.5);
        ctx.lineTo(a2.x + nx * gap * i * 0.5, a2.y + ny * gap * i * 0.5);
        ctx.stroke();
      }
    } else if (order === 3) {
      ctx.beginPath();
      ctx.moveTo(a1.x, a1.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.stroke();
      for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.moveTo(a1.x + nx * gap * i, a1.y + ny * gap * i);
        ctx.lineTo(a2.x + nx * gap * i, a2.y + ny * gap * i);
        ctx.stroke();
      }
    }
  }

  function drawAtomOnCanvas(atom, hovered) {
    const bondCount = getBondCount(atom.id);
    const overValence = bondCount > atom.data.valence;
    const r = ATOM_RADIUS;

    // Shadow
    ctx.beginPath();
    ctx.arc(atom.x, atom.y + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(atom.x, atom.y, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(atom.x - 6, atom.y - 6, 2, atom.x, atom.y, r);
    grad.addColorStop(0, lighten(atom.data.color, 40));
    grad.addColorStop(1, atom.data.color);
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.strokeStyle = overValence ? "#ef476f" : (hovered ? "#4361ee" : atom.data.border);
    ctx.lineWidth = overValence ? 3 : (hovered ? 3 : 2);
    ctx.stroke();

    // Valence warning ring
    if (overValence) {
      ctx.beginPath();
      ctx.arc(atom.x, atom.y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(239,71,111,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Symbol
    ctx.fillStyle = atom.data.color === "#333" || atom.data.color === "#a52a2a" ? "#fff" : "#fff";
    ctx.font = "bold 14px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Text shadow for readability
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 3;
    ctx.fillText(atom.symbol, atom.x, atom.y);
    ctx.restore();

    // Bond count indicator
    const remaining = atom.data.valence - bondCount;
    if (atoms.length > 0) {
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillStyle = overValence ? "#ef476f" : (remaining === 0 ? "#06d6a0" : "rgba(255,255,255,0.7)");
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 2;
      ctx.fillText(remaining === 0 ? "ok" : remaining, atom.x, atom.y + r + 12);
      ctx.restore();
    }
  }

  function lighten(hex, amount) {
    const num = parseInt(hex.replace("#", ""), 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0xff) + amount;
    let b = (num & 0xff) + amount;
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `rgb(${r},${g},${b})`;
  }

  /* ---------- Info panel ---------- */
  function updateInfo() {
    if (atoms.length === 0) {
      infoFormula.textContent = "—";
      infoMass.textContent = "—";
      infoBonds.textContent = "—";
      infoWarnings.textContent = "None";
      infoWarnings.style.color = "var(--color-text-muted)";
      infoAtoms.textContent = "—";
      return;
    }

    // Formula (Hill system: C first, then H, then alphabetical)
    const counts = {};
    atoms.forEach(a => { counts[a.symbol] = (counts[a.symbol] || 0) + 1; });
    let formula = "";
    const order = [];
    if (counts["C"]) { order.push("C"); if (counts["H"]) order.push("H"); }
    Object.keys(counts).sort().forEach(s => { if (!order.includes(s)) order.push(s); });
    order.forEach(s => {
      formula += s;
      if (counts[s] > 1) formula += subscript(counts[s]);
    });
    infoFormula.textContent = formula;

    // Mass
    let mass = 0;
    atoms.forEach(a => { mass += a.data.mass; });
    infoMass.textContent = mass.toFixed(2) + " g/mol";

    // Bonds
    let totalBondOrder = 0;
    bonds.forEach(b => totalBondOrder += b.order);
    infoBonds.textContent = bonds.length + " (" + totalBondOrder + " bond order)";

    // Warnings
    const warnings = [];
    atoms.forEach(a => {
      const bc = getBondCount(a.id);
      if (bc > a.data.valence) {
        warnings.push(a.symbol + " (id " + a.id + "): " + bc + "/" + a.data.valence);
      }
    });
    if (warnings.length) {
      infoWarnings.textContent = warnings.join("; ");
      infoWarnings.style.color = "var(--color-danger)";
    } else {
      infoWarnings.textContent = "None";
      infoWarnings.style.color = "var(--color-success)";
    }

    // Atom list
    infoAtoms.textContent = atoms.map(a => a.symbol + " (" + getBondCount(a.id) + "/" + a.data.valence + ")").join(", ");
  }

  function subscript(n) {
    const subs = "₀₁₂₃₄₅₆₇₈₉";
    return String(n).split("").map(d => subs[parseInt(d)]).join("");
  }

  /* ---------- Presets ---------- */
  const PRESETS = [
    {
      name: "Water (H₂O)",
      build() {
        const cx = 300, cy = 200;
        addAtom(ATOMS[3], cx, cy);        // O
        addAtom(ATOMS[0], cx - 60, cy + 50); // H
        addAtom(ATOMS[0], cx + 60, cy + 50); // H
        bonds.push({ from: 1, to: 2, order: 1 });
        bonds.push({ from: 1, to: 3, order: 1 });
      }
    },
    {
      name: "Methane (CH₄)",
      build() {
        const cx = 300, cy = 200;
        addAtom(ATOMS[1], cx, cy);
        addAtom(ATOMS[0], cx - 60, cy - 50);
        addAtom(ATOMS[0], cx + 60, cy - 50);
        addAtom(ATOMS[0], cx - 60, cy + 50);
        addAtom(ATOMS[0], cx + 60, cy + 50);
        bonds.push({ from: 1, to: 2, order: 1 });
        bonds.push({ from: 1, to: 3, order: 1 });
        bonds.push({ from: 1, to: 4, order: 1 });
        bonds.push({ from: 1, to: 5, order: 1 });
      }
    },
    {
      name: "CO₂",
      build() {
        const cx = 300, cy = 200;
        addAtom(ATOMS[1], cx, cy);
        addAtom(ATOMS[3], cx - 70, cy);
        addAtom(ATOMS[3], cx + 70, cy);
        bonds.push({ from: 1, to: 2, order: 2 });
        bonds.push({ from: 1, to: 3, order: 2 });
      }
    },
    {
      name: "Ethanol (C₂H₅OH)",
      build() {
        const cx = 250, cy = 200;
        addAtom(ATOMS[1], cx, cy);        // C1
        addAtom(ATOMS[1], cx + 80, cy);   // C2
        addAtom(ATOMS[3], cx + 160, cy);  // O
        addAtom(ATOMS[0], cx + 220, cy + 30); // H (on O)
        addAtom(ATOMS[0], cx - 50, cy - 40);
        addAtom(ATOMS[0], cx - 50, cy + 40);
        addAtom(ATOMS[0], cx + 30, cy - 50);
        addAtom(ATOMS[0], cx + 80, cy - 50);
        addAtom(ATOMS[0], cx + 80, cy + 50);
        bonds.push({ from: 1, to: 2, order: 1 });
        bonds.push({ from: 2, to: 3, order: 1 });
        bonds.push({ from: 3, to: 4, order: 1 });
        bonds.push({ from: 1, to: 5, order: 1 });
        bonds.push({ from: 1, to: 6, order: 1 });
        bonds.push({ from: 1, to: 7, order: 1 });
        bonds.push({ from: 2, to: 8, order: 1 });
        bonds.push({ from: 2, to: 9, order: 1 });
      }
    },
    {
      name: "Nitrogen (N₂)",
      build() {
        addAtom(ATOMS[2], 270, 200);
        addAtom(ATOMS[2], 350, 200);
        bonds.push({ from: 1, to: 2, order: 3 });
      }
    },
    {
      name: "Ammonia (NH₃)",
      build() {
        const cx = 300, cy = 200;
        addAtom(ATOMS[2], cx, cy);
        addAtom(ATOMS[0], cx - 60, cy + 50);
        addAtom(ATOMS[0], cx + 60, cy + 50);
        addAtom(ATOMS[0], cx, cy - 60);
        bonds.push({ from: 1, to: 2, order: 1 });
        bonds.push({ from: 1, to: 3, order: 1 });
        bonds.push({ from: 1, to: 4, order: 1 });
      }
    },
  ];

  PRESETS.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      atoms = [];
      bonds = [];
      nextId = 1;
      p.build();
      updateInfo();
      draw();
    });
    presetEl.appendChild(btn);
  });

  /* ---------- Keyboard shortcuts ---------- */
  document.addEventListener("keydown", e => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (hoveredAtom) {
        atoms = atoms.filter(a => a.id !== hoveredAtom.id);
        bonds = bonds.filter(b => b.from !== hoveredAtom.id && b.to !== hoveredAtom.id);
        hoveredAtom = null;
        updateInfo();
        draw();
      } else if (hoveredBond) {
        bonds = bonds.filter(b => b !== hoveredBond);
        hoveredBond = null;
        updateInfo();
        draw();
      }
    }
    if (e.key === "1") { selectedBondOrder = 1; updateBondButtons(); }
    if (e.key === "2") { selectedBondOrder = 2; updateBondButtons(); }
    if (e.key === "3") { selectedBondOrder = 3; updateBondButtons(); }
    if (e.key === "d" || e.key === "D") {
      deleteMode = !deleteMode;
      document.getElementById("btn-delete").classList.toggle("active", deleteMode);
    }
  });

  function updateBondButtons() {
    document.querySelectorAll(".bond-btn").forEach(b => {
      b.classList.toggle("active", parseInt(b.dataset.bond) === selectedBondOrder);
    });
  }

  /* ---------- Init ---------- */
  draw();
})();
