/* ═══════════════════════════════════════════════════════
   3D Molecular Viewer — SciSim
   Pure Canvas 2D with 3D projection (no WebGL / libraries)
   ═══════════════════════════════════════════════════════ */

(() => {
'use strict';

/* ── Atom CPK colours & covalent radii (pm) ── */
const ELEMENTS = {
  H:  { color: '#ffffff', radius: 31,  mass: 1.008 },
  C:  { color: '#333333', radius: 77,  mass: 12.011 },
  N:  { color: '#3050f8', radius: 75,  mass: 14.007 },
  O:  { color: '#ff0d0d', radius: 73,  mass: 15.999 },
  F:  { color: '#90e050', radius: 72,  mass: 18.998 },
  P:  { color: '#ff8000', radius: 107, mass: 30.974 },
  S:  { color: '#ffff30', radius: 105, mass: 32.065 },
  Cl: { color: '#1ff01f', radius: 99,  mass: 35.453 },
  Br: { color: '#a62929', radius: 114, mass: 79.904 },
  I:  { color: '#940094', radius: 133, mass: 126.90 },
  Si: { color: '#f0c8a0', radius: 117, mass: 28.086 },
  B:  { color: '#ffb5b5', radius: 87,  mass: 10.811 },
  Na: { color: '#ab5cf2', radius: 154, mass: 22.990 },
  Mg: { color: '#8aff00', radius: 136, mass: 24.305 },
  Al: { color: '#bfa6a6', radius: 125, mass: 26.982 },
  Ca: { color: '#3dff00', radius: 174, mass: 40.078 },
  Fe: { color: '#e06633', radius: 126, mass: 55.845 },
  Xe: { color: '#429eb0', radius: 131, mass: 131.29 },
};

/* ── Molecule library ── */
const MOLECULES = [
  // Simple
  { id: 'h2', name: 'Hydrogen', formula: 'H\u2082', category: 'simple', shape: 'Linear', bondAngle: '180\u00b0', polarity: 'Non-polar',
    atoms: [{el:'H',x:0,y:0,z:-0.37},{el:'H',x:0,y:0,z:0.37}],
    bonds: [[0,1,1]] },

  { id: 'o2', name: 'Oxygen', formula: 'O\u2082', category: 'simple', shape: 'Linear', bondAngle: '180\u00b0', polarity: 'Non-polar',
    atoms: [{el:'O',x:0,y:0,z:-0.60},{el:'O',x:0,y:0,z:0.60}],
    bonds: [[0,1,2]] },

  { id: 'n2', name: 'Nitrogen', formula: 'N\u2082', category: 'simple', shape: 'Linear', bondAngle: '180\u00b0', polarity: 'Non-polar',
    atoms: [{el:'N',x:0,y:0,z:-0.55},{el:'N',x:0,y:0,z:0.55}],
    bonds: [[0,1,3]] },

  { id: 'hcl', name: 'Hydrogen Chloride', formula: 'HCl', category: 'simple', shape: 'Linear', bondAngle: '180\u00b0', polarity: 'Polar',
    atoms: [{el:'H',x:0,y:0,z:-0.64},{el:'Cl',x:0,y:0,z:0.64}],
    bonds: [[0,1,1]] },

  { id: 'hf', name: 'Hydrogen Fluoride', formula: 'HF', category: 'simple', shape: 'Linear', bondAngle: '180\u00b0', polarity: 'Polar',
    atoms: [{el:'H',x:0,y:0,z:-0.46},{el:'F',x:0,y:0,z:0.46}],
    bonds: [[0,1,1]] },

  // VSEPR showcase
  { id: 'h2o', name: 'Water', formula: 'H\u2082O', category: 'vsepr', shape: 'Bent', bondAngle: '104.5\u00b0', polarity: 'Polar',
    atoms: [{el:'O',x:0,y:0,z:0},{el:'H',x:-0.76,y:0.59,z:0},{el:'H',x:0.76,y:0.59,z:0}],
    bonds: [[0,1,1],[0,2,1]] },

  { id: 'co2', name: 'Carbon Dioxide', formula: 'CO\u2082', category: 'vsepr', shape: 'Linear', bondAngle: '180\u00b0', polarity: 'Non-polar',
    atoms: [{el:'C',x:0,y:0,z:0},{el:'O',x:-1.16,y:0,z:0},{el:'O',x:1.16,y:0,z:0}],
    bonds: [[0,1,2],[0,2,2]] },

  { id: 'nh3', name: 'Ammonia', formula: 'NH\u2083', category: 'vsepr', shape: 'Trigonal pyramidal', bondAngle: '107\u00b0', polarity: 'Polar',
    atoms: [{el:'N',x:0,y:-0.36,z:0},{el:'H',x:0,y:0.33,z:0.94},{el:'H',x:0.81,y:0.33,z:-0.47},{el:'H',x:-0.81,y:0.33,z:-0.47}],
    bonds: [[0,1,1],[0,2,1],[0,3,1]] },

  { id: 'ch4', name: 'Methane', formula: 'CH\u2084', category: 'vsepr', shape: 'Tetrahedral', bondAngle: '109.5\u00b0', polarity: 'Non-polar',
    atoms: [{el:'C',x:0,y:0,z:0},{el:'H',x:0.63,y:0.63,z:0.63},{el:'H',x:-0.63,y:-0.63,z:0.63},{el:'H',x:-0.63,y:0.63,z:-0.63},{el:'H',x:0.63,y:-0.63,z:-0.63}],
    bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1]] },

  { id: 'bf3', name: 'Boron Trifluoride', formula: 'BF\u2083', category: 'vsepr', shape: 'Trigonal planar', bondAngle: '120\u00b0', polarity: 'Non-polar',
    atoms: [{el:'B',x:0,y:0,z:0},{el:'F',x:0,y:-1.30,z:0},{el:'F',x:1.13,y:0.65,z:0},{el:'F',x:-1.13,y:0.65,z:0}],
    bonds: [[0,1,1],[0,2,1],[0,3,1]] },

  { id: 'pcl5', name: 'Phosphorus Pentachloride', formula: 'PCl\u2085', category: 'vsepr', shape: 'Trigonal bipyramidal', bondAngle: '90\u00b0 / 120\u00b0', polarity: 'Non-polar',
    atoms: [{el:'P',x:0,y:0,z:0},{el:'Cl',x:0,y:-2.0,z:0},{el:'Cl',x:0,y:2.0,z:0},{el:'Cl',x:2.0,y:0,z:0},{el:'Cl',x:-1.0,y:0,z:1.73},{el:'Cl',x:-1.0,y:0,z:-1.73}],
    bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1],[0,5,1]] },

  { id: 'sf6', name: 'Sulfur Hexafluoride', formula: 'SF\u2086', category: 'vsepr', shape: 'Octahedral', bondAngle: '90\u00b0', polarity: 'Non-polar',
    atoms: [{el:'S',x:0,y:0,z:0},{el:'F',x:1.6,y:0,z:0},{el:'F',x:-1.6,y:0,z:0},{el:'F',x:0,y:1.6,z:0},{el:'F',x:0,y:-1.6,z:0},{el:'F',x:0,y:0,z:1.6},{el:'F',x:0,y:0,z:-1.6}],
    bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1],[0,5,1],[0,6,1]] },

  // Organic
  { id: 'c2h4', name: 'Ethene', formula: 'C\u2082H\u2084', category: 'organic', shape: 'Trigonal planar', bondAngle: '120\u00b0', polarity: 'Non-polar',
    atoms: [{el:'C',x:-0.67,y:0,z:0},{el:'C',x:0.67,y:0,z:0},{el:'H',x:-1.24,y:0.93,z:0},{el:'H',x:-1.24,y:-0.93,z:0},{el:'H',x:1.24,y:0.93,z:0},{el:'H',x:1.24,y:-0.93,z:0}],
    bonds: [[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]] },

  { id: 'c2h2', name: 'Ethyne', formula: 'C\u2082H\u2082', category: 'organic', shape: 'Linear', bondAngle: '180\u00b0', polarity: 'Non-polar',
    atoms: [{el:'C',x:-0.60,y:0,z:0},{el:'C',x:0.60,y:0,z:0},{el:'H',x:-1.66,y:0,z:0},{el:'H',x:1.66,y:0,z:0}],
    bonds: [[0,1,3],[0,2,1],[1,3,1]] },

  { id: 'ch3oh', name: 'Methanol', formula: 'CH\u2083OH', category: 'organic', shape: 'Tetrahedral (C)', bondAngle: '109.5\u00b0', polarity: 'Polar',
    atoms: [{el:'C',x:0,y:0,z:0},{el:'O',x:1.43,y:0,z:0},{el:'H',x:1.83,y:0.89,z:0},{el:'H',x:-0.52,y:0.89,z:0.52},{el:'H',x:-0.52,y:0.89,z:-0.52},{el:'H',x:-0.52,y:-0.89,z:0}],
    bonds: [[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1]] },

  { id: 'c2h6', name: 'Ethane', formula: 'C\u2082H\u2086', category: 'organic', shape: 'Tetrahedral', bondAngle: '109.5\u00b0', polarity: 'Non-polar',
    atoms: [{el:'C',x:-0.77,y:0,z:0},{el:'C',x:0.77,y:0,z:0},{el:'H',x:-1.17,y:0.51,z:0.89},{el:'H',x:-1.17,y:0.51,z:-0.89},{el:'H',x:-1.17,y:-1.03,z:0},{el:'H',x:1.17,y:-0.51,z:0.89},{el:'H',x:1.17,y:-0.51,z:-0.89},{el:'H',x:1.17,y:1.03,z:0}],
    bonds: [[0,1,1],[0,2,1],[0,3,1],[0,4,1],[1,5,1],[1,6,1],[1,7,1]] },

  { id: 'ch2o', name: 'Methanal (Formaldehyde)', formula: 'CH\u2082O', category: 'organic', shape: 'Trigonal planar', bondAngle: '120\u00b0', polarity: 'Polar',
    atoms: [{el:'C',x:0,y:0,z:0},{el:'O',x:0,y:-1.20,z:0},{el:'H',x:0.94,y:0.54,z:0},{el:'H',x:-0.94,y:0.54,z:0}],
    bonds: [[0,1,2],[0,2,1],[0,3,1]] },

  // Inorganic
  { id: 'nacl', name: 'Sodium Chloride', formula: 'NaCl', category: 'inorganic', shape: 'Linear (ion pair)', bondAngle: 'N/A', polarity: 'Ionic',
    atoms: [{el:'Na',x:-1.18,y:0,z:0},{el:'Cl',x:1.18,y:0,z:0}],
    bonds: [[0,1,1]] },

  { id: 'sio2', name: 'Silicon Dioxide (unit)', formula: 'SiO\u2082', category: 'inorganic', shape: 'Tetrahedral', bondAngle: '109.5\u00b0', polarity: 'Non-polar (network)',
    atoms: [{el:'Si',x:0,y:0,z:0},{el:'O',x:1.0,y:1.0,z:0},{el:'O',x:-1.0,y:-1.0,z:0}],
    bonds: [[0,1,2],[0,2,2]] },

  { id: 'h2s', name: 'Hydrogen Sulfide', formula: 'H\u2082S', category: 'inorganic', shape: 'Bent', bondAngle: '92.1\u00b0', polarity: 'Polar',
    atoms: [{el:'S',x:0,y:0,z:0},{el:'H',x:-0.96,y:0.55,z:0},{el:'H',x:0.96,y:0.55,z:0}],
    bonds: [[0,1,1],[0,2,1]] },

  { id: 'so2', name: 'Sulfur Dioxide', formula: 'SO\u2082', category: 'inorganic', shape: 'Bent', bondAngle: '119\u00b0', polarity: 'Polar',
    atoms: [{el:'S',x:0,y:0,z:0},{el:'O',x:-1.25,y:0.6,z:0},{el:'O',x:1.25,y:0.6,z:0}],
    bonds: [[0,1,2],[0,2,2]] },

  { id: 'no2', name: 'Nitrogen Dioxide', formula: 'NO\u2082', category: 'inorganic', shape: 'Bent', bondAngle: '134\u00b0', polarity: 'Polar',
    atoms: [{el:'N',x:0,y:0,z:0},{el:'O',x:-1.1,y:0.7,z:0},{el:'O',x:1.1,y:0.7,z:0}],
    bonds: [[0,1,2],[0,2,1]] },
];

/* ── State ── */
const canvas = document.getElementById('viewer-canvas');
const ctx = canvas.getContext('2d');
let W, H;
let currentMol = null;
let rotX = -0.3, rotY = 0.5;
let autoRotate = true;
let showLabels = true;
let showBonds = true;
let zoom = 1.0;
let displayStyle = 'ball-stick';  // ball-stick | space-fill | wireframe
let bgMode = 'dark';             // dark | light | gradient

// Mouse drag state
let dragging = false;
let lastMX = 0, lastMY = 0;

/* ── Projection ── */
const SCALE = 120;  // base scale: angstroms to pixels

function project(x, y, z) {
  // Rotate Y
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
  let rx = x * cosY + z * sinY;
  let rz = -x * sinY + z * cosY;
  // Rotate X
  const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
  let ry = y * cosX - rz * sinX;
  rz = y * sinX + rz * cosX;
  // Perspective
  const d = 8;
  const scale = d / (d + rz) * SCALE * zoom;
  return {
    sx: W / 2 + rx * scale,
    sy: H / 2 + ry * scale,
    sz: rz,
    scale
  };
}

/* ── Rendering ── */
function drawBackground() {
  if (bgMode === 'light') {
    ctx.fillStyle = '#f0f0f5';
  } else if (bgMode === 'gradient') {
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#1a1a3e');
    grd.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = grd;
  } else {
    ctx.fillStyle = '#111122';
  }
  ctx.fillRect(0, 0, W, H);
}

function lightenColor(hex, amt) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + amt);
  g = Math.min(255, g + amt);
  b = Math.min(255, b + amt);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amt) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, r - amt);
  g = Math.max(0, g - amt);
  b = Math.max(0, b - amt);
  return `rgb(${r},${g},${b})`;
}

function drawAtom(px, py, r, color, label) {
  // Sphere shading via radial gradient
  const grd = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.05, px, py, r);
  grd.addColorStop(0, lightenColor(color, 100));
  grd.addColorStop(0.5, color);
  grd.addColorStop(1, darkenColor(color, 80));

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // Subtle outline
  ctx.strokeStyle = darkenColor(color, 60);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Specular highlight
  ctx.beginPath();
  ctx.arc(px - r * 0.25, py - r * 0.25, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  // Label
  if (showLabels && label) {
    const textColor = bgMode === 'light' ? '#1a1a2e' : '#ffffff';
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.max(10, r * 0.7)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, px, py);
  }
}

function drawBond(x1, y1, z1, x2, y2, z2, order) {
  const p1 = project(x1, y1, z1);
  const p2 = project(x2, y2, z2);
  const bondColor = bgMode === 'light' ? 'rgba(60,60,80,0.6)' : 'rgba(180,190,220,0.5)';

  if (displayStyle === 'wireframe') {
    ctx.strokeStyle = bondColor;
    ctx.lineWidth = order === 1 ? 2 : order === 2 ? 3 : 4;
    ctx.beginPath();
    ctx.moveTo(p1.sx, p1.sy);
    ctx.lineTo(p2.sx, p2.sy);
    ctx.stroke();
    return;
  }

  // Ball-and-stick or space-fill bond rendering
  const dx = p2.sx - p1.sx;
  const dy = p2.sy - p1.sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = -dy / len;
  const ny = dx / len;

  const offsets = order === 1 ? [0] : order === 2 ? [-3, 3] : [-4, 0, 4];

  offsets.forEach(off => {
    ctx.strokeStyle = bondColor;
    ctx.lineWidth = displayStyle === 'space-fill' ? 1.5 : 3;
    ctx.beginPath();
    ctx.moveTo(p1.sx + nx * off, p1.sy + ny * off);
    ctx.lineTo(p2.sx + nx * off, p2.sy + ny * off);
    ctx.stroke();
  });
}

function render() {
  drawBackground();
  if (!currentMol) {
    ctx.fillStyle = bgMode === 'light' ? '#777' : 'rgba(255,255,255,0.25)';
    ctx.font = '16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Select a molecule from the panel', W / 2, H / 2);
    return;
  }

  const mol = currentMol;

  // Project all atoms
  const projected = mol.atoms.map(a => {
    const el = ELEMENTS[a.el] || ELEMENTS.C;
    const p = project(a.x, a.y, a.z);
    let r;
    if (displayStyle === 'space-fill') {
      r = (el.radius / 77) * 35 * (p.scale / SCALE);
    } else if (displayStyle === 'wireframe') {
      r = 4 * (p.scale / SCALE);
    } else {
      r = (el.radius / 77) * 16 * (p.scale / SCALE);
    }
    return { ...p, r, color: el.color, label: a.el };
  });

  // Draw bonds (behind atoms, sorted by z)
  if (showBonds) {
    // Sort bonds by average z (furthest first)
    const sortedBonds = [...mol.bonds].sort((a, b) => {
      const azAvg = (mol.atoms[a[0]].z + mol.atoms[a[1]].z) / 2;
      const bzAvg = (mol.atoms[b[0]].z + mol.atoms[b[1]].z) / 2;
      // Need to transform z through rotation to get screen-depth
      const pa = project(0, 0, azAvg);
      const pb = project(0, 0, bzAvg);
      return pa.sz - pb.sz;  // furthest first
    });

    sortedBonds.forEach(([i, j, order]) => {
      const a = mol.atoms[i], b = mol.atoms[j];
      drawBond(a.x, a.y, a.z, b.x, b.y, b.z, order);
    });
  }

  // Sort atoms by z-depth (furthest first = draw first)
  const sorted = projected.map((p, i) => ({ ...p, i })).sort((a, b) => b.sz - a.sz);

  sorted.forEach(p => {
    drawAtom(p.sx, p.sy, p.r, p.color, p.label);
  });
}

/* ── Animation loop ── */
let animFrame;
function animate() {
  if (autoRotate && !dragging) {
    rotY += 0.008;
  }
  render();
  animFrame = requestAnimationFrame(animate);
}

/* ── Canvas sizing ── */
function resize() {
  const wrap = canvas.parentElement;
  W = wrap.clientWidth;
  H = wrap.clientHeight;
  canvas.width = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

/* ── Mouse interaction ── */
canvas.addEventListener('mousedown', e => {
  dragging = true;
  lastMX = e.clientX;
  lastMY = e.clientY;
});
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastMX;
  const dy = e.clientY - lastMY;
  rotY += dx * 0.01;
  rotX += dy * 0.01;
  // Clamp vertical rotation
  rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
  lastMX = e.clientX;
  lastMY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });

// Touch support
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    dragging = true;
    lastMX = e.touches[0].clientX;
    lastMY = e.touches[0].clientY;
  }
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (!dragging || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - lastMX;
  const dy = e.touches[0].clientY - lastMY;
  rotY += dx * 0.01;
  rotX += dy * 0.01;
  rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
  lastMX = e.touches[0].clientX;
  lastMY = e.touches[0].clientY;
}, { passive: true });
canvas.addEventListener('touchend', () => { dragging = false; }, { passive: true });

// Scroll to zoom
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  zoom *= e.deltaY > 0 ? 0.92 : 1.08;
  zoom = Math.max(0.3, Math.min(4, zoom));
}, { passive: false });

/* ── UI: Molecule list ── */
const molList = document.getElementById('mol-list');
const searchInput = document.getElementById('mol-search');
let activeCategory = 'all';

function renderMolList() {
  const query = searchInput.value.toLowerCase();
  const filtered = MOLECULES.filter(m => {
    const catMatch = activeCategory === 'all' || m.category === activeCategory;
    const searchMatch = !query || m.name.toLowerCase().includes(query) || m.formula.toLowerCase().includes(query);
    return catMatch && searchMatch;
  });

  molList.innerHTML = filtered.map(m => `
    <button class="mol-item ${currentMol && currentMol.id === m.id ? 'active' : ''}" data-id="${m.id}">
      <div class="mol-item-name">${m.name}</div>
      <div class="mol-item-formula">${m.formula}</div>
    </button>
  `).join('');

  molList.querySelectorAll('.mol-item').forEach(btn => {
    btn.addEventListener('click', () => selectMolecule(btn.dataset.id));
  });
}

function selectMolecule(id) {
  currentMol = MOLECULES.find(m => m.id === id);
  if (!currentMol) return;

  // Reset view
  rotX = -0.3;
  rotY = 0.5;
  zoom = 1.0;

  // Update info panel
  document.getElementById('info-name').textContent = currentMol.name;
  document.getElementById('info-formula').innerHTML = currentMol.formula;

  // Calculate molecular mass
  const mass = currentMol.atoms.reduce((sum, a) => sum + (ELEMENTS[a.el]?.mass || 0), 0);
  document.getElementById('info-mass').textContent = mass.toFixed(3) + ' g/mol';

  document.getElementById('info-shape').textContent = currentMol.shape;
  document.getElementById('info-angle').textContent = currentMol.bondAngle;
  document.getElementById('info-polarity').textContent = currentMol.polarity;

  // Hide hint
  const hint = document.getElementById('canvas-hint');
  if (hint) hint.style.display = 'none';

  renderMolList();
}

/* ── UI: Category tabs ── */
document.querySelectorAll('.cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeCategory = tab.dataset.cat;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderMolList();
  });
});

/* ── UI: Search ── */
searchInput.addEventListener('input', renderMolList);

/* ── UI: Canvas controls ── */
const btnRotate = document.getElementById('btn-rotate');
const btnLabels = document.getElementById('btn-labels');
const btnBonds = document.getElementById('btn-bonds');
const btnResetView = document.getElementById('btn-reset-view');

btnRotate.classList.add('active');
btnLabels.classList.add('active');
btnBonds.classList.add('active');

btnRotate.addEventListener('click', () => {
  autoRotate = !autoRotate;
  btnRotate.classList.toggle('active', autoRotate);
});
btnLabels.addEventListener('click', () => {
  showLabels = !showLabels;
  btnLabels.classList.toggle('active', showLabels);
});
btnBonds.addEventListener('click', () => {
  showBonds = !showBonds;
  btnBonds.classList.toggle('active', showBonds);
});
btnResetView.addEventListener('click', () => {
  rotX = -0.3;
  rotY = 0.5;
  zoom = 1.0;
});

/* ── UI: Display style ── */
document.querySelectorAll('input[name="style"]').forEach(radio => {
  radio.addEventListener('change', () => {
    displayStyle = radio.value;
  });
});

/* ── UI: Background ── */
document.querySelectorAll('input[name="bg"]').forEach(radio => {
  radio.addEventListener('change', () => {
    bgMode = radio.value;
  });
});

/* ── Init ── */
renderMolList();
// Auto-select water as a nice default
selectMolecule('h2o');
animate();

})();
