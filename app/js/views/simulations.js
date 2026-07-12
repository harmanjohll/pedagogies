/*
 * Co-Cher Simulations Gallery
 * ===========================
 * Interactive science practicals gallery and AI-powered custom simulation builder.
 */

import { showToast } from '../components/toast.js';
import { Store } from '../state.js';
import { sendChat } from '../api.js';
import { renderWorkflowBreadcrumb, bindWorkflowClicks } from '../components/workflow-breadcrumb.js';
import { idbPut, idbGet, idbRemove } from '../utils/storage.js';
import { escapeHtml } from '../utils/markdown.js';
import { openModal, confirmDialog } from '../components/modals.js';

/* ── Simulation catalogue ── */
const SIMULATIONS = [
  /* ─── Biology ─── */
  {
    id: 'diffusion',
    title: 'Diffusion',
    subject: 'Biology',
    description: 'Observe particle movement through a membrane. Vary concentration and temperature to explore the factors affecting diffusion rate.',
    difficulty: 'Beginner',
    path: 'simulations/biology/diffusion/index.html'
  },
  {
    id: 'enzyme-activity',
    title: 'Enzyme Activity',
    subject: 'Biology',
    description: 'Investigate how temperature affects amylase activity. Use the starch-iodine test to find the optimum temperature.',
    difficulty: 'Intermediate',
    path: 'simulations/biology/enzyme-activity/index.html'
  },
  {
    id: 'food-tests',
    title: 'Food Tests',
    subject: 'Biology',
    description: 'Test for starch, reducing sugars, proteins, and lipids using iodine, Benedict\u2019s, Biuret, and emulsion tests.',
    difficulty: 'Beginner',
    path: 'simulations/biology/food-tests/index.html'
  },
  {
    id: 'microscopy',
    title: 'Microscopy & Cell Drawing',
    subject: 'Biology',
    description: 'Observe plant and animal cells under the microscope. Practice focusing, labelling, and biological drawing.',
    difficulty: 'Beginner',
    path: 'simulations/biology/microscopy/index.html'
  },
  {
    id: 'osmosis',
    title: 'Osmosis',
    subject: 'Biology',
    description: 'Investigate osmosis using potato cylinders in sucrose solutions. Calculate percentage mass change and find the isotonic point.',
    difficulty: 'Intermediate',
    path: 'simulations/biology/osmosis/index.html'
  },
  {
    id: 'photosynthesis',
    title: 'Photosynthesis',
    subject: 'Biology',
    description: 'Investigate the rate of photosynthesis by counting oxygen bubbles. Vary light intensity, CO\u2082, and temperature.',
    difficulty: 'Intermediate',
    path: 'simulations/biology/photosynthesis/index.html'
  },
  /* ─── Chemistry ─── */
  {
    id: 'chromatography',
    title: 'Paper Chromatography',
    subject: 'Chemistry',
    description: 'Separate mixtures of dyes and inks. Calculate Rf values and identify unknown substances.',
    difficulty: 'Beginner',
    path: 'simulations/chemistry/chromatography/index.html'
  },
  {
    id: 'electrolysis',
    title: 'Electrolysis',
    subject: 'Chemistry',
    description: 'Electrodes, electrolytes, and selective discharge. Observe products formed at the cathode and anode.',
    difficulty: 'Intermediate',
    path: 'simulations/chemistry/electrolysis/index.html'
  },
  {
    id: 'gas-tests',
    title: 'Gas Tests',
    subject: 'Chemistry',
    description: 'Test for O\u2082, CO\u2082, H\u2082, Cl\u2082, and NH\u2083 using splint tests, limewater, and litmus paper.',
    difficulty: 'Beginner',
    path: 'simulations/chemistry/gas-tests/index.html'
  },
  {
    id: 'qualitative-analysis',
    title: 'Qualitative Analysis',
    subject: 'Chemistry',
    description: 'Identify unknown cations and anions through systematic chemical tests with NaOH, NH\u2083, and more.',
    difficulty: 'Advanced',
    path: 'simulations/chemistry/qualitative-analysis/index.html'
  },
  {
    id: 'rates-of-reaction',
    title: 'Rates of Reaction',
    subject: 'Chemistry',
    description: 'Marble chips and acid; measure gas production with a syringe. Investigate concentration and surface area effects.',
    difficulty: 'Intermediate',
    path: 'simulations/chemistry/rates-of-reaction/index.html'
  },
  {
    id: 'salts',
    title: 'Preparation of Salts',
    subject: 'Chemistry',
    description: 'React copper oxide with sulfuric acid, filter, evaporate, and crystallise to produce pure copper sulfate.',
    difficulty: 'Intermediate',
    path: 'simulations/chemistry/salts/index.html'
  },
  {
    id: 'titration',
    title: 'Acid-Base Titration',
    subject: 'Chemistry',
    description: 'Pipette, burette, indicators, and endpoint detection. Practice the full titration procedure with guided steps.',
    difficulty: 'Intermediate',
    path: 'simulations/chemistry/titration/index.html'
  },
  /* ─── Physics ─── */
  {
    id: 'density',
    title: 'Density',
    subject: 'Physics',
    description: 'Measure mass and volume of regular and irregular objects. Calculate density and identify unknown materials.',
    difficulty: 'Beginner',
    path: 'simulations/physics/density/index.html'
  },
  {
    id: 'electromagnets',
    title: 'Electromagnets',
    subject: 'Physics',
    description: 'Build electromagnets and investigate how current, coils, and core material affect magnetic field strength.',
    difficulty: 'Intermediate',
    path: 'simulations/physics/electromagnets/index.html'
  },
  {
    id: 'lenses',
    title: 'Lenses & Light',
    subject: 'Physics',
    description: 'Converging lenses, image formation, and focal length determination using the lens equation.',
    difficulty: 'Intermediate',
    path: 'simulations/physics/lenses/index.html'
  },
  {
    id: 'ohms-law',
    title: 'Ohm\u2019s Law',
    subject: 'Physics',
    description: 'Investigate V-I characteristics. Vary EMF, record readings, plot graphs, and calculate resistance.',
    difficulty: 'Intermediate',
    path: 'simulations/physics/ohms-law/index.html'
  },
  {
    id: 'pendulum',
    title: 'Pendulum & Oscillations',
    subject: 'Physics',
    description: 'Investigate the relationship between pendulum length and period. Plot T\u00B2 vs L and determine g.',
    difficulty: 'Beginner',
    path: 'simulations/physics/pendulum/index.html'
  },
  {
    id: 'specific-heat',
    title: 'Specific Heat Capacity',
    subject: 'Physics',
    description: 'Heat a metal block with an electrical heater. Plot temperature rise and calculate specific heat capacity.',
    difficulty: 'Intermediate',
    path: 'simulations/physics/specific-heat/index.html'
  },
  {
    id: 'waves',
    title: 'Waves & Ripple Tank',
    subject: 'Physics',
    description: 'Explore wave behaviour: reflection, refraction, and diffraction in a simulated ripple tank.',
    difficulty: 'Intermediate',
    path: 'simulations/physics/waves/index.html'
  },
  /* ─── Interactives ─── */
  {
    id: 'molecular-builder',
    title: 'Molecular Builder',
    subject: 'Interactive',
    description: 'Build molecules atom by atom. Explore bonding, molecular geometry, and 3D structure with an interactive construction tool.',
    difficulty: 'Intermediate',
    path: 'simulations/interactives/molecular-builder/index.html'
  },
  {
    id: 'molecular-viewer',
    title: '3D Molecular Viewer',
    subject: 'Interactive',
    description: 'Rotate and examine molecules in 3D. Explore VSEPR shapes, bond angles, polarity, and molecular geometry with ball-and-stick, space-filling, and wireframe views.',
    difficulty: 'Beginner',
    path: 'simulations/interactives/molecular-viewer/index.html'
  },
  {
    id: 'particle-dynamics',
    title: 'Particle Dynamics',
    subject: 'Interactive',
    description: 'Simulate particle systems; explore states of matter, gas laws, diffusion, and kinetic theory with adjustable parameters.',
    difficulty: 'Intermediate',
    path: 'simulations/interactives/particle-dynamics/index.html'
  }
];

/* ── Helpers ── */
function subjectColor(subject) {
  if (subject === 'Chemistry') return '#4361ee';
  if (subject === 'Biology') return '#06d6a0';
  if (subject === 'Interactive') return '#8b5cf6';
  return '#f77f00';
}

function difficultyColor(level) {
  if (level === 'Beginner') return { bg: '#d4edda', fg: '#155724' };
  if (level === 'Intermediate') return { bg: '#fff3cd', fg: '#856404' };
  return { bg: '#f8d7da', fg: '#721c24' };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ── Custom sim storage ──
 * Metadata (id, title, timestamps) lives in localStorage; the heavy HTML
 * payload lives in IndexedDB ('custom_sims' store) as { html, versions }
 * so generated sims stop eating the ~5MB localStorage budget. Legacy sims
 * that still carry .html inline migrate on first render. */
const _simHtmlCache = new Map();
let _menuCloser = null;  // id -> { html, versions: [] }

async function loadSimRecord(id) {
  if (_simHtmlCache.has(id)) return _simHtmlCache.get(id);
  const rec = await idbGet('custom_sims', id);
  if (rec && typeof rec.html === 'string') {
    _simHtmlCache.set(id, rec);
    return rec;
  }
  // Fallback: legacy inline html
  const sim = getCustomSims().find(s => s.id === id);
  if (sim && typeof sim.html === 'string') {
    const legacy = { html: sim.html, versions: [] };
    _simHtmlCache.set(id, legacy);
    return legacy;
  }
  return null;
}

function storeSimRecord(id, html, versions) {
  const rec = { html, versions: (versions || []).slice(-3) };
  _simHtmlCache.set(id, rec);
  idbPut('custom_sims', id, rec).then(ok => {
    if (!ok) {
      // No IndexedDB (private browsing etc.) — keep the HTML inline in
      // localStorage so the sim survives a reload (quota costs apply)
      const sims = getCustomSims();
      const target = sims.find(s => s.id === id);
      if (target) { target.html = html; saveCustomSims(sims); }
    }
  }).catch(() => {});
  return rec;
}

let _simMigrationDone = false;
async function migrateLegacySimHtml() {
  if (_simMigrationDone) return;
  _simMigrationDone = true;
  try {
    const sims = getCustomSims();
    let dirty = false;
    for (const sim of sims) {
      if (typeof sim.html === 'string' && sim.html) {
        const ok = await idbPut('custom_sims', sim.id, { html: sim.html, versions: [] });
        if (ok) {
          _simHtmlCache.set(sim.id, { html: sim.html, versions: [] });
          delete sim.html;
          dirty = true;
        }
      }
    }
    if (dirty) saveCustomSims(sims);
  } catch { /* legacy sims keep working from localStorage */ }
}

function getCustomSims() {
  try {
    const raw = localStorage.getItem('cocher_custom_sims');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomSims(sims) {
  localStorage.setItem('cocher_custom_sims', JSON.stringify(sims));
}

/* ── Iframe overlay with drag-to-resize edges ── */
function openOverlay(container, title, opts) {
  // opts: { src } for trusted built-ins, or { srcdoc, spec } for generated sims
  const overlay = document.createElement('div');
  overlay.id = 'sim-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);animation:simFadeIn 0.2s ease;';

  // Window; starts full viewport, user drags edges to resize
  const win = document.createElement('div');
  win.id = 'sim-window';
  win.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;overflow:hidden;background:#1a1a2e;transition:border-radius 0.15s;';

  // Top bar: title + hint + close
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:6px 16px;background:#12122a;color:#fff;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.08);user-select:none;';
  topBar.innerHTML = `
    <span style="font-weight:600;font-size:0.9375rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${escapeHtml(title)}</span>
    <span style="font-size:0.6875rem;color:rgba(255,255,255,0.3);">Drag edges to resize</span>
    <button id="sim-overlay-close" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px 10px;font-size:1.25rem;line-height:1;border-radius:6px;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='none'">&times;</button>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'flex:1;border:none;width:100%;height:100%;background:#1e1f2b;';
  if (opts.src) iframe.src = opts.src;
  else if (opts.srcdoc) iframe.srcdoc = opts.srcdoc;
  // SECURITY: with allow-same-origin a srcdoc iframe inherits THIS origin, so
  // AI-generated code could read the teacher's API key out of localStorage.
  // Generated (srcdoc) sims get allow-scripts ONLY; same-origin stays limited
  // to the trusted built-in sims loaded via src (needed for layout injection).
  iframe.setAttribute('sandbox', opts.src ? 'allow-scripts allow-same-origin allow-popups' : 'allow-scripts');

  // Inject responsive CSS + layout overrides into simulations after load
  iframe.addEventListener('load', () => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      // Responsive base styles for all sim iframes
      const style = doc.createElement('style');
      style.textContent = `
        body { margin: 0; overflow-x: hidden; width: 100%; }
        * { box-sizing: border-box; }
        canvas { max-width: 100%; height: auto !important; }
        .guide-panel, .data-panel, [class*="panel"] { min-width: 0; overflow-wrap: break-word; }
      `;
      doc.head.appendChild(style);
      // Additional layout overrides for labsim practicals
      if (doc.querySelector('.practical-layout')) {
        injectSimLayoutOverrides(doc);
      }
    } catch (e) { /* cross-origin or sandbox restriction */ }
  });

  win.appendChild(topBar);
  // Custom sims that carry a pedagogical spec get app-owned chrome around the
  // iframe (objective strip, predict-first veil, guiding questions). Legacy
  // sims and built-ins get the bare iframe, exactly as before.
  if (opts.spec && opts.srcdoc) {
    win.appendChild(buildPedagogyShell(iframe, opts.spec));
  } else {
    win.appendChild(iframe);
  }

  // ── Resize state ──
  let resizing = null;
  let startX, startY, startBounds;
  const cursors = {
    top: 'ns-resize', bottom: 'ns-resize', left: 'ew-resize', right: 'ew-resize',
    'top-left': 'nwse-resize', 'bottom-right': 'nwse-resize',
    'top-right': 'nesw-resize', 'bottom-left': 'nesw-resize'
  };

  // ── Resize handles on all edges and corners ──
  const E = 7, C = 14;
  const handleDefs = {
    top:            `top:0;left:${C}px;right:${C}px;height:${E}px;`,
    bottom:         `bottom:0;left:${C}px;right:${C}px;height:${E}px;`,
    left:           `left:0;top:${C}px;bottom:${C}px;width:${E}px;`,
    right:          `right:0;top:${C}px;bottom:${C}px;width:${E}px;`,
    'top-left':     `top:0;left:0;width:${C}px;height:${C}px;`,
    'top-right':    `top:0;right:0;width:${C}px;height:${C}px;`,
    'bottom-left':  `bottom:0;left:0;width:${C}px;height:${C}px;`,
    'bottom-right': `bottom:0;right:0;width:${C}px;height:${C}px;`,
  };

  Object.entries(handleDefs).forEach(([pos, css]) => {
    const h = document.createElement('div');
    h.dataset.resize = pos;
    h.style.cssText = `position:absolute;z-index:10;cursor:${cursors[pos]};${css}`;
    h.addEventListener('mouseenter', () => { if (!resizing) h.style.background = 'rgba(67,97,238,0.2)'; });
    h.addEventListener('mouseleave', () => { if (!resizing) h.style.background = ''; });
    win.appendChild(h);
  });

  overlay.appendChild(win);
  document.body.appendChild(overlay);

  // ── Resize drag logic ──
  function getBounds() {
    return { top: parseInt(win.style.top)||0, left: parseInt(win.style.left)||0,
             right: parseInt(win.style.right)||0, bottom: parseInt(win.style.bottom)||0 };
  }

  win.addEventListener('mousedown', (e) => {
    const h = e.target.closest('[data-resize]');
    if (!h) return;
    e.preventDefault();
    resizing = h.dataset.resize;
    startX = e.clientX; startY = e.clientY;
    startBounds = getBounds();
    iframe.style.pointerEvents = 'none';
    document.body.style.cursor = cursors[resizing];
    document.body.style.userSelect = 'none';
  });

  function onMouseMove(e) {
    if (!resizing) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    const MIN = 400, vw = window.innerWidth, vh = window.innerHeight;
    let { top, left, right, bottom } = startBounds;
    if (resizing.includes('top'))    top    = Math.max(0, Math.min(top + dy, vh - MIN - bottom));
    if (resizing.includes('bottom')) bottom = Math.max(0, Math.min(bottom - dy, vh - MIN - top));
    if (resizing.includes('left'))   left   = Math.max(0, Math.min(left + dx, vw - MIN - right));
    if (resizing.includes('right'))  right  = Math.max(0, Math.min(right - dx, vw - MIN - left));
    win.style.top = top + 'px'; win.style.left = left + 'px';
    win.style.right = right + 'px'; win.style.bottom = bottom + 'px';
    win.style.borderRadius = (top > 0 || left > 0 || right > 0 || bottom > 0) ? '10px' : '0';
  }

  function onMouseUp() {
    if (!resizing) return;
    resizing = null;
    iframe.style.pointerEvents = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    win.querySelectorAll('[data-resize]').forEach(h => h.style.background = '');
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // ── Close ──
  const closeOverlay = () => {
    overlay.remove();
    document.removeEventListener('keydown', escHandler);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  overlay.querySelector('#sim-overlay-close').addEventListener('click', closeOverlay);
  const escHandler = (e) => { if (e.key === 'Escape') closeOverlay(); };
  document.addEventListener('keydown', escHandler);
}

/* ── Pedagogical shell around generated sims ──
 * App-owned chrome (never AI-generated): the learning objective up top, a
 * predict-before-you-run veil over the iframe, guiding questions in a
 * collapsible side panel, debrief question beneath. Teacher-mediated by
 * design — the Skip link is always there; this is a nudge, not a lock. */
function buildPedagogyShell(iframe, spec) {
  const shell = document.createElement('div');
  shell.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;';
  const questions = Array.isArray(spec.guidingQuestions)
    ? spec.guidingQuestions.filter(q => typeof q === 'string' && q.trim())
    : [];
  const debrief = typeof spec.debrief === 'string' ? spec.debrief.trim() : '';
  shell.innerHTML = `
    ${spec.learningObjective ? `
      <div style="padding:8px 16px;background:#1c1c3a;color:#c7cbe8;font-size:0.8125rem;line-height:1.5;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
        <strong style="color:#8f9bff;">Objective:</strong> ${escapeHtml(spec.learningObjective)}
      </div>` : ''}
    <div style="flex:1;display:flex;min-height:0;">
      <div id="sim-shell-stage" style="position:relative;flex:1;min-width:0;display:flex;"></div>
      ${(questions.length || debrief) ? `
      <div id="sim-shell-side" style="width:280px;flex-shrink:0;display:flex;flex-direction:column;min-height:0;background:#12122a;border-left:1px solid rgba(255,255,255,0.08);">
        <button id="sim-shell-side-toggle" aria-expanded="true" style="background:none;border:none;color:#c7cbe8;cursor:pointer;padding:10px 14px;font-size:0.75rem;font-weight:600;text-align:left;letter-spacing:0.03em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Guiding questions &#9662;</button>
        <div id="sim-shell-side-body" style="flex:1;overflow-y:auto;padding:12px 14px;color:#e8e8f0;font-size:0.8125rem;line-height:1.6;">
          ${questions.length ? `<ol style="margin:0 0 14px;padding-left:18px;display:flex;flex-direction:column;gap:8px;">${questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ol>` : ''}
          ${debrief ? `
            <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:10px;">
              <div style="font-size:0.6875rem;font-weight:700;color:#8f9bff;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Debrief</div>
              ${escapeHtml(debrief)}
            </div>` : ''}
        </div>
      </div>` : ''}
    </div>`;

  const stage = shell.querySelector('#sim-shell-stage');
  stage.appendChild(iframe);

  // Predict first: blur the sim until the class has committed to a prediction
  if (typeof spec.prediction === 'string' && spec.prediction.trim()) {
    iframe.style.filter = 'blur(8px)';
    iframe.style.pointerEvents = 'none';
    const veil = document.createElement('div');
    veil.style.cssText = 'position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(18,18,42,0.45);';
    veil.innerHTML = `
      <div style="max-width:520px;width:100%;background:#252540;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:22px 24px;color:#e8e8f0;box-shadow:0 12px 40px rgba(0,0,0,0.45);">
        <div style="font-size:0.6875rem;font-weight:700;color:#8f9bff;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Predict first</div>
        <p style="margin:0 0 12px;font-size:0.9375rem;line-height:1.55;">${escapeHtml(spec.prediction)}</p>
        <textarea id="sim-predict-answer" rows="3" aria-label="Class prediction" placeholder="Type the class prediction here (optional)…" style="width:100%;box-sizing:border-box;background:#1a1a2e;color:#e8e8f0;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;font-family:inherit;font-size:0.8125rem;resize:vertical;"></textarea>
        <div style="display:flex;align-items:center;gap:14px;margin-top:12px;">
          <button id="sim-predict-reveal" style="background:#4361ee;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:0.8125rem;font-weight:600;cursor:pointer;">Reveal simulation</button>
          <a href="#" id="sim-predict-skip" style="font-size:0.75rem;color:rgba(255,255,255,0.45);">Skip</a>
        </div>
      </div>`;
    const reveal = () => {
      veil.remove();
      iframe.style.filter = '';
      iframe.style.pointerEvents = '';
    };
    veil.querySelector('#sim-predict-reveal').addEventListener('click', reveal);
    veil.querySelector('#sim-predict-skip').addEventListener('click', (e) => { e.preventDefault(); reveal(); });
    stage.appendChild(veil);
  }

  // Collapsible side panel
  const toggle = shell.querySelector('#sim-shell-side-toggle');
  const side = shell.querySelector('#sim-shell-side');
  const sideBody = shell.querySelector('#sim-shell-side-body');
  if (toggle && side && sideBody) {
    toggle.addEventListener('click', () => {
      const collapsed = sideBody.style.display === 'none';
      sideBody.style.display = collapsed ? '' : 'none';
      side.style.width = collapsed ? '280px' : 'auto';
      toggle.setAttribute('aria-expanded', String(collapsed));
      toggle.innerHTML = collapsed ? 'Guiding questions &#9662;' : 'Guiding questions &#9656;';
    });
  }
  return shell;
}

/* ── Inject layout overrides into labsim simulation iframes ── */
function injectSimLayoutOverrides(doc) {
  // 1. CSS overrides: narrower panels, scrollable body, collapsible notebook
  const style = doc.createElement('style');
  style.id = 'cocher-sim-overrides';
  style.textContent = `
    body { overflow-y: auto !important; }
    .practical-layout {
      display: flex !important;
    }
    .guide-panel {
      flex: 0 0 180px !important;
      min-width: 120px !important;
      max-width: 360px !important;
    }
    .workbench-panel {
      flex: 1 1 auto !important;
      min-width: 300px !important;
    }
    .data-panel {
      flex: 0 0 200px !important;
      min-width: 140px !important;
      max-width: 360px !important;
    }
    .cocher-col-handle {
      flex: 0 0 5px;
      cursor: col-resize;
      background: transparent;
      position: relative;
      z-index: 5;
      transition: background 0.15s;
    }
    .cocher-col-handle:hover, .cocher-col-handle.active {
      background: rgba(67,97,238,0.25);
    }
    .cocher-col-handle::after {
      content: '';
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%,-50%);
      width: 2px; height: 36px;
      background: rgba(160,170,195,0.3);
      border-radius: 1px;
    }
    .cocher-col-handle:hover::after, .cocher-col-handle.active::after {
      background: rgba(67,97,238,0.5);
      height: 48px;
    }
    .lab-notebook-slot {
      border: 1px solid var(--color-border, #e2e5ea);
      border-radius: 8px;
      margin: 8px auto !important;
      overflow: hidden !important;
    }
    .lab-notebook-slot.nb-collapsed > *:not(.nb-toggle) { display: none !important; }
    .nb-toggle {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; cursor: pointer;
      font-size: 0.8125rem; font-weight: 600;
      color: var(--color-text-secondary, #5a5f6d);
      background: var(--color-surface-alt, #f8f9fb);
      user-select: none;
    }
    .nb-toggle:hover { background: var(--color-primary-light, #eef1fd); }
  `;
  doc.head.appendChild(style);

  // 2. Insert resize handles between panels
  const layout = doc.querySelector('.practical-layout');
  if (layout) {
    const guide = layout.querySelector('.guide-panel');
    const workbench = layout.querySelector('.workbench-panel');
    const data = layout.querySelector('.data-panel');

    const h1 = doc.createElement('div');
    h1.className = 'cocher-col-handle';
    h1.dataset.side = 'left';
    const h2 = doc.createElement('div');
    h2.className = 'cocher-col-handle';
    h2.dataset.side = 'right';

    if (workbench) layout.insertBefore(h1, workbench);
    if (data) layout.insertBefore(h2, data);

    // Drag resize logic
    let active = null, startX = 0, startW = 0;

    layout.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.cocher-col-handle');
      if (!handle) return;
      e.preventDefault();
      active = handle;
      startX = e.clientX;
      const panel = handle.dataset.side === 'left' ? guide : data;
      startW = panel ? panel.getBoundingClientRect().width : 0;
      handle.classList.add('active');
      doc.body.style.cursor = 'col-resize';
      doc.body.style.userSelect = 'none';
      if (workbench) workbench.style.pointerEvents = 'none';
    });

    doc.addEventListener('mousemove', (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (active.dataset.side === 'left' && guide) {
        guide.style.flex = `0 0 ${Math.max(120, Math.min(360, startW + dx))}px`;
      } else if (active.dataset.side === 'right' && data) {
        data.style.flex = `0 0 ${Math.max(140, Math.min(360, startW - dx))}px`;
      }
    });

    doc.addEventListener('mouseup', () => {
      if (!active) return;
      active.classList.remove('active');
      active = null;
      doc.body.style.cursor = '';
      doc.body.style.userSelect = '';
      if (workbench) workbench.style.pointerEvents = '';
    });
  }

  // 3. Collapse Lab Notebook by default with toggle bar
  const notebook = doc.querySelector('.lab-notebook-slot');
  if (notebook) {
    notebook.classList.add('nb-collapsed');
    const toggle = doc.createElement('div');
    toggle.className = 'nb-toggle';
    toggle.innerHTML = '<span>📓 Lab Notebook</span><span style="margin-left:auto;font-size:0.7rem;opacity:0.5;">▶ Expand</span>';
    notebook.insertBefore(toggle, notebook.firstChild);
    toggle.addEventListener('click', () => {
      const collapsed = notebook.classList.toggle('nb-collapsed');
      toggle.querySelector('span:last-child').textContent = collapsed ? '▶ Expand' : '▼ Collapse';
    });
  }
}

/* ── Extract HTML from AI response ── */
function extractHTML(text) {
  const trimmed = text.trim();
  let candidate = null;
  // Try to find HTML within code fences first
  const fenced = trimmed.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();
  // If it starts with <!DOCTYPE or <html, use the whole thing
  else if (trimmed.startsWith('<!') || /^<html/i.test(trimmed)) candidate = trimmed;
  else {
    // Last resort: find first <html...> to </html>
    const htmlMatch = trimmed.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch) candidate = htmlMatch[0];
  }
  // A response with no HTML markers at all is a refusal or an explanation —
  // surface it as an error instead of wrapping prose into a saved "sim".
  const target = candidate || trimmed;
  if (!/<!doctype|<html[\s>]|<canvas[\s>]|<script[\s>]/i.test(target)) {
    const snippet = trimmed.replace(/\s+/g, ' ').slice(0, 220);
    throw new Error(`The model replied with text instead of a simulation: "${snippet}${trimmed.length > 220 ? '…' : ''}"`);
  }
  if (candidate) return candidate;
  // Markers exist but no full document (e.g. a bare <canvas>+<script> fragment) — wrap it
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:sans-serif;background:#1a1a2e;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head><body>${trimmed}</body></html>`;
}

/* A generation cut off mid-document would save a silently broken sim —
 * detect it, ask the model to finish, and hard-close as a last resort. */
function isCompleteHTML(html) {
  return /<\/html>\s*$/i.test(html.trim()) || html.toLowerCase().includes('</html>');
}

async function completeTruncatedHTML(partial, originalPrompt, model) {
  try {
    const remainder = await sendChat(
      [{ role: 'user', content: `The simulation below was cut off mid-generation. Original request:\n${originalPrompt}\n\nPARTIAL HTML (ends abruptly):\n${partial}` }],
      {
        trackLabel: 'customSimulationContinue',
        systemPrompt: 'You complete truncated HTML documents. Output ONLY the missing remainder, continuing EXACTLY from the final character of the partial document — no repetition of earlier content, no markdown fences, no commentary. End with </html>.',
        temperature: 0.3,
        maxTokens: 8000,
        model
      }
    );
    const cleaned = remainder.replace(/^```(?:html)?\s*\n?/, '').replace(/```\s*$/, '');
    const joined = partial + cleaned;
    if (isCompleteHTML(joined)) return joined;
  } catch { /* fall through to hard close */ }
  // Last resort: close open tags so the sim at least renders what exists
  return partial + '\n</body></html>';
}

/* ── Quality gate: test-run generated HTML before it is ever saved ──
 * A copy of the HTML gets a tiny reporter script and runs in a hidden
 * allow-scripts iframe. The reporter posts back either the first runtime
 * error, or (after the sim has had ~1.2s to boot) an ok message with a
 * control count. Silence means the document never parsed. */
const PROBE_TIMEOUT_MS = 6000;

function injectProbeReporter(html) {
  const reporter = `<script>(function(){window.onerror=function(m,s,l){parent.postMessage({simProbe:1,error:String(m)+' @'+l},'*');};window.addEventListener('load',function(){setTimeout(function(){parent.postMessage({simProbe:1,ok:true,hasCanvas:!!document.querySelector('canvas'),controls:document.querySelectorAll('input,button,select').length},'*');},1200);});})();<\/script>`;
  const bodyOpen = html.match(/<body[^>]*>/i);
  if (bodyOpen) {
    const at = bodyOpen.index + bodyOpen[0].length;
    return html.slice(0, at) + reporter + html.slice(at);
  }
  const bodyClose = html.search(/<\/body>/i);
  if (bodyClose !== -1) return html.slice(0, bodyClose) + reporter + html.slice(bodyClose);
  return html + reporter;
}

function probeSimHTML(html) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    // Off-screen rather than display:none so canvas sizing code behaves
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;visibility:hidden;border:none;';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      frame.remove();
      resolve(result);
    };
    const onMessage = (e) => {
      if (e.source !== frame.contentWindow || !e.data || e.data.simProbe !== 1) return;
      if (e.data.error) {
        finish({ ok: false, error: `Runtime error: ${String(e.data.error).slice(0, 300)}` });
      } else if (e.data.ok) {
        if (!e.data.controls) {
          finish({ ok: false, error: 'The page loaded but has no interactive controls (no inputs, buttons or selects).' });
        } else {
          finish({ ok: true, hasCanvas: !!e.data.hasCanvas, controls: e.data.controls });
        }
      }
    };
    const timer = setTimeout(() => finish({
      ok: false,
      error: 'No signal from the simulation — the document likely failed to parse or crashed before it could load.'
    }), PROBE_TIMEOUT_MS);
    window.addEventListener('message', onMessage);
    frame.srcdoc = injectProbeReporter(html);
    document.body.appendChild(frame);
  });
}

const REPAIR_SYSTEM_PROMPT = 'You repair broken self-contained HTML simulations. Fix the reported problem while preserving the layout, science and styling of everything else. Return the COMPLETE corrected HTML document only — no markdown fences, no commentary.';

/* Probe → on failure, ONE automatic repair pass → re-probe.
 * Returns { ok, html, error? } — html is the best candidate either way. */
async function gateSimHTML(html, { repairContext = '', model, onStage } = {}) {
  onStage?.('Testing the build…');
  const first = await probeSimHTML(html);
  if (first.ok) return { ok: true, html };
  onStage?.('Check failed — attempting an automatic repair…');
  try {
    const text = await sendChat(
      [{ role: 'user', content: `This self-contained HTML simulation failed an automated check.\nPROBLEM: ${first.error}\n${repairContext ? `CONTEXT: ${repairContext}\n` : ''}\nFULL HTML:\n${html}\n\nReturn the corrected COMPLETE HTML document.` }],
      { trackLabel: 'customSimulationRepair', systemPrompt: REPAIR_SYSTEM_PROMPT, temperature: 0.2, maxTokens: 16000, model }
    );
    let repaired = extractHTML(text);
    if (!isCompleteHTML(repaired)) repaired = await completeTruncatedHTML(repaired, repairContext || 'Repair the simulation.', model);
    onStage?.('Re-testing the repaired build…');
    const second = await probeSimHTML(repaired);
    if (second.ok) return { ok: true, html: repaired };
    return { ok: false, html: repaired, error: second.error };
  } catch {
    return { ok: false, html, error: first.error };
  }
}

/* Honest choice when the repair pass also fails: the teacher decides. */
function askProbeFailChoice(errorMsg) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value, close) => {
      if (settled) return;
      settled = true;
      close?.();
      resolve(value);
    };
    const { backdrop, close } = openModal({
      title: 'Simulation failed its check',
      body: `
        <p style="font-size:0.875rem;color:var(--ink-secondary);line-height:1.6;">Co-Cher test-ran the generated simulation and it did not pass, even after one automatic repair:</p>
        <p style="font-size:0.8125rem;color:var(--danger);background:var(--bg-subtle);border-radius:8px;padding:10px 12px;line-height:1.5;">${escapeHtml(errorMsg || 'Unknown failure.')}</p>
        <p style="font-size:0.875rem;color:var(--ink-secondary);line-height:1.6;">Retry the build, keep it anyway (it will be labelled <strong>experimental</strong>), or discard it.</p>`,
      footer: `
        <button class="btn btn-secondary" data-action="discard">Discard</button>
        <button class="btn btn-secondary" data-action="save">Save anyway (experimental)</button>
        <button class="btn btn-primary" data-action="retry">Retry</button>`,
      onClose: () => settle('discard')
    });
    backdrop.querySelector('[data-action="discard"]').addEventListener('click', () => settle('discard', close));
    backdrop.querySelector('[data-action="save"]').addEventListener('click', () => settle('save', close));
    backdrop.querySelector('[data-action="retry"]').addEventListener('click', () => settle('retry', close));
  });
}

/* ── Derive a short title from the prompt ── */
function deriveTitle(prompt) {
  const cleaned = prompt.replace(/^(create|build|make|generate|design)\s+(a|an|the)?\s*/i, '').trim();
  const first = cleaned.split(/[.\n]/)[0].trim();
  return first.length > 60 ? first.slice(0, 57) + '...' : first || 'Custom Simulation';
}

/* ── Spec-then-build: Stage 1 designs the pedagogy, Stage 2 compiles it ── */
const SPEC_SYSTEM_PROMPT = `You are LabSim Planner. Before any code is written, you design the pedagogical specification for an interactive science simulation for Singapore secondary / JC students. Respond with ONE JSON object only — no markdown fences, no commentary — in exactly this shape:
{
  "title": "short display title",
  "learningObjective": "one sentence, student-facing",
  "prediction": "ONE question students answer BEFORE running the simulation",
  "guidingQuestions": ["2-3 questions students explore WHILE running it"],
  "debrief": "ONE reflection question for after the simulation",
  "variables": [{ "name": "", "symbol": "", "unit": "SI unit", "min": 0, "max": 0, "default": 0, "step": 0, "rationale": "why this range suits the level" }],
  "representations": ["animation", "graph"],
  "governingEquations": ["plain-text equations the simulation must implement"],
  "modelNotes": "integration scheme and timestep, e.g. semi-implicit Euler, fixed dt = 1/120 s"
}
Rules: variable ranges MUST be pedagogically targeted at the stated student level (values students meet in their syllabus, not arbitrary numbers); representations MUST include "animation" and "graph"; use SI units throughout; 2-6 variables; keep every string concise.`;

function parseSpecJson(text) {
  let t = String(text).trim().replace(/^```(?:json)?\s*\n?/, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* fall through */ }
  const braced = t.match(/\{[\s\S]*\}/);
  if (braced) {
    try { return JSON.parse(braced[0]); } catch { /* fall through */ }
  }
  return null;
}

/* Coerce a parsed spec into the exact shape the builder relies on;
 * throws a teacher-readable Error when the essentials are missing. */
function normalizeSpec(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('The model did not return a valid simulation spec — try again.');
  }
  const str = (v, fb = '') => (typeof v === 'string' && v.trim()) ? v.trim() : fb;
  const num = (v, fb) => Number.isFinite(Number(v)) ? Number(v) : fb;
  const spec = {
    title: str(raw.title, 'Custom Simulation'),
    learningObjective: str(raw.learningObjective),
    prediction: str(raw.prediction),
    guidingQuestions: (Array.isArray(raw.guidingQuestions) ? raw.guidingQuestions : [])
      .map(q => str(q)).filter(Boolean).slice(0, 3),
    debrief: str(raw.debrief),
    variables: (Array.isArray(raw.variables) ? raw.variables : []).map(v => ({
      name: str(v && v.name, 'variable'),
      symbol: str(v && v.symbol),
      unit: str(v && v.unit),
      min: num(v && v.min, 0),
      max: num(v && v.max, 100),
      default: num(v && v.default, num(v && v.min, 0)),
      step: num(v && v.step, 1),
      rationale: str(v && v.rationale)
    })),
    representations: [...new Set(
      (Array.isArray(raw.representations) ? raw.representations : [])
        .map(r => str(r).toLowerCase()).filter(Boolean)
        .concat(['animation', 'graph'])   // non-negotiable pair
    )],
    governingEquations: (Array.isArray(raw.governingEquations) ? raw.governingEquations : [])
      .map(e => str(e)).filter(Boolean),
    modelNotes: str(raw.modelNotes)
  };
  if (spec.variables.length === 0) {
    throw new Error('The spec came back without any variables — regenerate it.');
  }
  return spec;
}

/* Stage 1 call: api.js sendChat supports options.jsonMode (it sets Gemini's
 * responseMimeType to application/json), with one parse-repair attempt. */
async function generateSpec(prompt, model) {
  const raw = await sendChat(
    [{ role: 'user', content: prompt }],
    { trackLabel: 'customSimulationSpec', systemPrompt: SPEC_SYSTEM_PROMPT, jsonMode: true, model }
  );
  let parsed = parseSpecJson(raw);
  if (!parsed) {
    const fixed = await sendChat(
      [{ role: 'user', content: `Convert the following into ONE valid JSON object with exactly the keys the schema requires. Output ONLY the JSON.\n\n${raw}` }],
      { trackLabel: 'customSimulationSpecRepair', systemPrompt: SPEC_SYSTEM_PROMPT, jsonMode: true, model }
    );
    parsed = parseSpecJson(fixed);
  }
  if (!parsed) throw new Error('Could not get a valid simulation spec from the model — please try again.');
  return normalizeSpec(parsed);
}

/* Stage 2 contract, in priority order: model fidelity > controls >
 * representations > accessibility > visuals. */
const BUILD_SYSTEM_PROMPT = `You are LabSim Builder. Compile the provided SPEC into ONE complete, self-contained HTML page (embedded CSS + JS, no external libraries, no CDN, no images). Priorities, in this order:

1. MODEL FIDELITY (most important)
- Implement the SPEC's governingEquations exactly; cite each equation in a code comment where it is used.
- FIXED-timestep integration: accumulate elapsed real time, advance the physics in fixed steps (e.g. const DT = 1/120; acc += dt; while (acc >= DT) { step(DT); acc -= DT; }). Follow the SPEC's modelNotes for the scheme.
- SI units everywhere — in state, in calculations, in displayed values.

2. CONTROLS (mandatory for any time-evolving sim)
- One slider per SPEC variable with a unit-labelled live readout, using exactly the SPEC's min/max/default/step.
- Pause/Play, Step (advance one fixed step while paused), a simulation-speed slider, and Reset.

3. REPRESENTATIONS
- Canvas animation of the system (at least 600x450 px, the main element), drawn with requestAnimationFrame.
- At least one live-updating graph driven by the SAME state, axes labelled with quantities and units.
- A data table that accumulates recorded readings (Record button).

4. ACCESSIBILITY
- Pointer events (touch + mouse) for anything draggable; all controls keyboard-operable; ARIA labels on controls and canvas.

5. VISUALS (last, and briefly)
- Dark theme: background #1a1a2e, panels #252540, text #e8e8f0, accent #4361ee. Rounded panels, system-ui font, canvas + graph centre with controls beside or below. Clarity over decoration.

Return ONLY the raw HTML document. No markdown fences, no explanation.`;

/* Centre-panel placeholder for the builder (also restored by "Back") */
const BYO_PLACEHOLDER = `
  <div class="sim-byo-placeholder">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
    <p>Configure your simulation on the left, then click <strong>Generate</strong>.<br/>Your interactive simulation will appear here.</p>
  </div>`;

/* ── Filter / display state ── */
const SIM_DISPLAY_LIMIT_KEY = 'cocher_sim_display_limit';
const SIM_FILTER_KEY = 'cocher_sim_filter';

function getDisplayLimit() {
  return parseInt(localStorage.getItem(SIM_DISPLAY_LIMIT_KEY) || '3', 10);
}
function setDisplayLimit(n) {
  localStorage.setItem(SIM_DISPLAY_LIMIT_KEY, String(n));
}
function getSubjectFilter() {
  return localStorage.getItem(SIM_FILTER_KEY) || 'All';
}
function setSubjectFilter(v) {
  localStorage.setItem(SIM_FILTER_KEY, v);
}

function getFilteredSims() {
  const filter = getSubjectFilter();
  return filter === 'All' ? SIMULATIONS : SIMULATIONS.filter(s => s.subject === filter);
}

/* ── Main render ── */
export function render(container) {

  function renderView() {
    const customSims = getCustomSims();
    const isDark = document.documentElement.classList.contains('dark');
    const displayLimit = getDisplayLimit();
    const subjectFilter = getSubjectFilter();
    const filtered = getFilteredSims();
    const visible = filtered.slice(0, displayLimit);
    const remaining = filtered.slice(displayLimit);
    const subjects = [...new Set(SIMULATIONS.map(s => s.subject))];

    container.innerHTML = `
      <style>
        @keyframes simFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sim-toolbar {
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
          padding: 14px 18px; border-radius: 12px;
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
        }
        .dark .sim-toolbar { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
        .sim-toolbar label { font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary, #555); text-transform: uppercase; letter-spacing: 0.03em; }
        .sim-toolbar select {
          padding: 6px 12px; border: 1px solid var(--border, #e2e5ea); border-radius: 8px;
          font-size: 0.8125rem; font-family: inherit; background: var(--bg, #fff); color: var(--ink, #1a1a2e);
        }
        .dark .sim-toolbar select { background: var(--bg-subtle, #16161e); color: var(--ink, #e8e8f0); border-color: var(--border, #3e3e4e); }
        .sim-filter-tab {
          padding: 5px 14px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; cursor: pointer;
          border: 1px solid var(--border, #e2e5ea); background: transparent; color: var(--ink-muted, #777);
          transition: all 0.15s;
        }
        .sim-filter-tab:hover { border-color: #4361ee; color: #4361ee; }
        .sim-filter-tab.active { background: #4361ee; color: #fff; border-color: #4361ee; }
        .sim-more-dropdown {
          position: relative; display: inline-block;
        }
        .sim-more-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600;
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea); color: var(--ink, #1a1a2e);
          cursor: pointer; transition: all 0.15s;
        }
        .sim-more-btn:hover { border-color: #4361ee; color: #4361ee; }
        .dark .sim-more-btn { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); color: var(--ink, #e8e8f0); }
        .sim-more-menu {
          display: none; position: absolute; top: 100%; left: 0; z-index: 100; margin-top: 6px;
          min-width: 340px; max-height: 360px; overflow-y: auto;
          background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); padding: 8px;
        }
        .dark .sim-more-menu { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
        .sim-more-menu.open { display: block; animation: simFadeIn 0.15s ease; }
        .sim-more-item {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px;
          cursor: pointer; transition: background 0.1s; border: none; background: none; width: 100%; text-align: left;
          color: var(--ink, #1a1a2e);
        }
        .sim-more-item:hover { background: var(--bg-subtle, #f8f9fa); }
        .dark .sim-more-item { color: var(--ink, #e8e8f0); }
        .dark .sim-more-item:hover { background: var(--bg-subtle, #252540); }
        .sim-more-item-tag { font-size: 0.625rem; font-weight: 600; color: #fff; padding: 2px 8px; border-radius: 12px; text-transform: uppercase; white-space: nowrap; }
        .sim-more-item-info { flex: 1; }
        .sim-more-item-title { font-size: 0.8125rem; font-weight: 600; }
        .sim-more-item-desc { font-size: 0.6875rem; color: var(--ink-muted, #888); line-height: 1.4; margin-top: 2px; }
        .sim-card {
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.2s, transform 0.15s;
          cursor: default;
        }
        .sim-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .dark .sim-card {
          background: var(--bg-card, #1e1e2e);
          border-color: var(--border, #2e2e3e);
        }
        .dark .sim-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .sim-card-body {
          padding: 20px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .sim-card-footer {
          padding: 14px 20px;
          border-top: 1px solid var(--border-light, #f0f0f4);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .dark .sim-card-footer {
          border-top-color: var(--border, #2e2e3e);
        }
        .sim-subject-tag {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #fff;
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 12px;
          width: fit-content;
        }
        .sim-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--ink, #1a1a2e);
          margin-bottom: 8px;
          line-height: 1.3;
        }
        .dark .sim-title {
          color: var(--ink, #e8e8f0);
        }
        .sim-desc {
          font-size: 0.8125rem;
          color: var(--ink-secondary, #555);
          line-height: 1.55;
          flex: 1;
        }
        .dark .sim-desc {
          color: var(--ink-secondary, #aaa);
        }
        .sim-difficulty {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 2px 10px;
          border-radius: 20px;
        }
        .sim-launch-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #4361ee;
          color: #fff;
          border: none;
          padding: 7px 18px;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .sim-launch-btn:hover { background: #3a56d4; transform: scale(1.03); }
        .sim-launch-btn:active { transform: scale(0.98); }
        .sim-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .sim-byo-card {
          background: var(--bg-card, #fff);
          border: 2px dashed var(--border, #d0d5dd);
          border-radius: 12px;
          padding: 0;
          transition: border-color 0.2s;
          overflow: hidden;
        }
        .sim-byo-card:hover { border-color: #4361ee; }
        .dark .sim-byo-card {
          background: var(--bg-card, #1e1e2e);
          border-color: var(--border, #3e3e4e);
        }
        .dark .sim-byo-card:hover { border-color: #4361ee; }
        .sim-byo-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border-light, #f0f0f4);
        }
        .dark .sim-byo-header { border-bottom-color: var(--border, #3e3e4e); }
        .sim-byo-panels {
          display: flex;
          min-height: 480px;
        }
        .sim-byo-left {
          width: 300px;
          flex-shrink: 0;
          padding: 20px;
          overflow-y: auto;
          border-right: 1px solid var(--border-light, #f0f0f4);
        }
        .dark .sim-byo-left { border-right-color: var(--border, #3e3e4e); }
        .sim-byo-centre {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          min-width: 0;
          position: relative;
        }
        .sim-byo-right {
          width: 260px;
          flex-shrink: 0;
          padding: 20px;
          overflow-y: auto;
          border-left: 1px solid var(--border-light, #f0f0f4);
          font-size: 0.8125rem;
          color: var(--ink-muted, #777);
          line-height: 1.6;
        }
        .dark .sim-byo-right { border-left-color: var(--border, #3e3e4e); }
        .sim-byo-right h4 {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--ink, #1a1a2e);
          margin: 0 0 6px;
        }
        .dark .sim-byo-right h4 { color: var(--ink, #e8e8f0); }
        .sim-byo-right ul {
          margin: 0 0 14px;
          padding-left: 16px;
        }
        .sim-byo-right ul li {
          margin-bottom: 4px;
        }
        .sim-byo-placeholder {
          text-align: center;
          color: var(--ink-faint, #aaa);
          max-width: 320px;
        }
        .sim-byo-placeholder svg {
          margin-bottom: 12px;
          opacity: 0.5;
        }
        .sim-byo-placeholder p {
          font-size: 0.875rem;
          line-height: 1.6;
        }
        @media (max-width: 900px) {
          .sim-byo-panels {
            flex-direction: column;
            min-height: auto;
          }
          .sim-byo-left, .sim-byo-right {
            width: 100%;
            border-right: none;
            border-left: none;
            border-bottom: 1px solid var(--border-light, #f0f0f4);
          }
          .sim-byo-centre {
            min-height: 300px;
          }
        }
        .sim-byo-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ink, #1a1a2e);
          margin-bottom: 6px;
        }
        .dark .sim-byo-title { color: var(--ink, #e8e8f0); }
        .sim-byo-desc {
          font-size: 0.875rem;
          color: var(--ink-muted, #777);
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .dark .sim-byo-desc { color: var(--ink-muted, #999); }
        .sim-byo-textarea {
          width: 100%;
          min-height: 100px;
          padding: 12px 14px;
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 8px;
          font-size: 0.875rem;
          font-family: inherit;
          resize: vertical;
          background: var(--bg, #fff);
          color: var(--ink, #1a1a2e);
          line-height: 1.5;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .sim-byo-textarea:focus {
          outline: none;
          border-color: #4361ee;
          box-shadow: 0 0 0 3px rgba(67,97,238,0.12);
        }
        .dark .sim-byo-textarea {
          background: var(--bg-subtle, #16161e);
          color: var(--ink, #e8e8f0);
          border-color: var(--border, #3e3e4e);
        }
        .sim-generate-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #4361ee;
          color: #fff;
          border: none;
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 12px;
          transition: background 0.15s, transform 0.1s;
        }
        .sim-generate-btn:hover { background: #3a56d4; }
        .sim-generate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .sim-custom-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .sim-custom-card {
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.2s;
        }
        .sim-custom-card:hover {
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .dark .sim-custom-card {
          background: var(--bg-card, #1e1e2e);
          border-color: var(--border, #2e2e3e);
        }
        .sim-custom-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--ink, #1a1a2e);
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dark .sim-custom-title { color: var(--ink, #e8e8f0); }
        .sim-custom-date {
          font-size: 0.75rem;
          color: var(--ink-muted, #888);
          margin-bottom: 12px;
        }
        .sim-meta-badge {
          display: inline-block;
          font-size: 0.625rem;
          font-weight: 600;
          color: #fff;
          padding: 2px 8px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .sim-custom-actions {
          display: flex;
          gap: 8px;
          margin-top: auto;
        }
        .sim-custom-launch {
          flex: 1;
          background: #4361ee;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .sim-custom-launch:hover { background: #3a56d4; }
        .sim-custom-delete {
          background: none;
          border: 1px solid var(--border, #e2e5ea);
          color: var(--ink-muted, #888);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .sim-custom-delete:hover {
          color: #dc3545;
          border-color: #dc3545;
        }
        .dark .sim-custom-delete {
          border-color: var(--border, #3e3e4e);
        }
        .sim-byo-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sim-byo-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ink-secondary, #555);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .dark .sim-byo-label { color: var(--ink-secondary, #aaa); }
        .sim-byo-select, .sim-byo-input {
          padding: 8px 12px;
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 8px;
          font-size: 0.8125rem;
          font-family: inherit;
          background: var(--bg, #fff);
          color: var(--ink, #1a1a2e);
          transition: border-color 0.15s;
        }
        .sim-byo-select:focus, .sim-byo-input:focus {
          outline: none;
          border-color: #4361ee;
          box-shadow: 0 0 0 3px rgba(67,97,238,0.12);
        }
        .dark .sim-byo-select, .dark .sim-byo-input {
          background: var(--bg-subtle, #16161e);
          color: var(--ink, #e8e8f0);
          border-color: var(--border, #3e3e4e);
        }
        .sim-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          font-size: 0.875rem;
          color: var(--ink-muted, #777);
        }
        .sim-spinner {
          width: 20px;
          height: 20px;
          border: 2.5px solid var(--border, #e2e5ea);
          border-top-color: #4361ee;
          border-radius: 50%;
          animation: simSpin 0.7s linear infinite;
        }
        @keyframes simSpin { to { transform: rotate(360deg); } }
        .sim-section-divider {
          margin: 40px 0 24px;
          border: none;
          border-top: 1px solid var(--border-light, #f0f0f4);
        }
        .dark .sim-section-divider {
          border-top-color: var(--border, #2e2e3e);
        }
      </style>

      <div class="main-scroll">
        <div class="page-container">

          ${renderWorkflowBreadcrumb('enactment')}

          <!-- Header -->
          <div class="page-header" style="margin-bottom: 20px;">
            <div>
              <h1 class="page-title" style="font-size:1.625rem;font-weight:700;color:var(--ink, #1a1a2e);margin:0 0 4px;">Simulations</h1>
              <p class="page-subtitle" style="font-size:0.9375rem;color:var(--ink-muted, #777);margin:0;">Interactive science practicals and custom simulations</p>
            </div>
          </div>

          <!-- Toolbar: Subject filter tabs + display limit -->
          <div class="sim-toolbar">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <button class="sim-filter-tab ${subjectFilter === 'All' ? 'active' : ''}" data-filter="All">All</button>
              ${subjects.map(s => `<button class="sim-filter-tab ${subjectFilter === s ? 'active' : ''}" data-filter="${s}">${s}</button>`).join('')}
            </div>
            <div style="margin-left:auto;display:flex;align-items:center;gap:8px;">
              <label>Show</label>
              <select id="sim-display-limit">
                ${[3,4,6].map(n => `<option value="${n}" ${displayLimit === n ? 'selected' : ''}>${n} cards</option>`).join('')}
                <option value="99" ${displayLimit >= 99 ? 'selected' : ''}>All</option>
              </select>
            </div>
          </div>

          <!-- Simulation Cards Grid (limited) -->
          <div class="sim-grid" id="sim-gallery">
            ${visible.map(sim => {
              const sc = subjectColor(sim.subject);
              const dc = difficultyColor(sim.difficulty);
              return `
                <div class="sim-card">
                  <div class="sim-card-body">
                    <span class="sim-subject-tag" style="background:${sc};">${sim.subject}</span>
                    <div class="sim-title">${sim.title}</div>
                    <div class="sim-desc">${sim.description}</div>
                  </div>
                  <div class="sim-card-footer">
                    <span class="sim-difficulty" style="background:${dc.bg};color:${dc.fg};">${sim.difficulty}</span>
                    <button class="sim-launch-btn" data-sim-id="${sim.id}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Launch
                    </button>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <!-- More Simulations Dropdown (for remaining sims) -->
          ${remaining.length > 0 ? `
          <div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
            <div class="sim-more-dropdown" id="sim-more-dropdown">
              <button class="sim-more-btn" id="sim-more-toggle">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                ${remaining.length} more simulation${remaining.length > 1 ? 's' : ''}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="sim-more-menu" id="sim-more-menu">
                ${remaining.map(sim => `
                  <button class="sim-more-item" data-sim-id="${sim.id}">
                    <span class="sim-more-item-tag" style="background:${subjectColor(sim.subject)};">${sim.subject}</span>
                    <div class="sim-more-item-info">
                      <div class="sim-more-item-title">${sim.title}</div>
                      <div class="sim-more-item-desc">${sim.description}</div>
                    </div>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          ` : ''}

          <!-- Build Your Own Section -->
          <hr class="sim-section-divider" />

          <div class="sim-byo-card" id="sim-byo">
            <div class="sim-byo-header">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                <div class="sim-byo-title">Build Your Own Simulation</div>
              </div>
              <div class="sim-byo-desc" style="margin-bottom:0;">Configure using the form on the left. Preview appears in the centre once generated.</div>
            </div>

            <div class="sim-byo-panels">
              <!-- LEFT PANEL: Structured form -->
              <div class="sim-byo-left">
                <div class="sim-byo-field" style="margin-bottom:12px;">
                  <label class="sim-byo-label">Subject</label>
                  <select id="byo-subject" class="sim-byo-select">
                    <option value="">Select...</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Geography">Geography</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="sim-byo-field" style="margin-bottom:12px;">
                  <label class="sim-byo-label">Level</label>
                  <select id="byo-level" class="sim-byo-select">
                    <option value="">Select...</option>
                    <option value="Lower Secondary">Lower Secondary</option>
                    <option value="Upper Secondary">Upper Secondary</option>
                    <option value="JC / Pre-U">JC / Pre-U</option>
                  </select>
                </div>
                <div class="sim-byo-field" style="margin-bottom:12px;">
                  <label class="sim-byo-label">Topic</label>
                  <select id="byo-topic-select" class="sim-byo-select">
                    <option value="">Select a subject first...</option>
                  </select>
                </div>
                <div id="byo-other-topic-wrap" class="sim-byo-field" style="margin-bottom:12px;display:none;">
                  <label class="sim-byo-label">Your Topic</label>
                  <input type="text" id="byo-other-topic" class="sim-byo-input" placeholder="Enter your topic..." />
                </div>
                <div class="sim-byo-field" style="margin-bottom:12px;">
                  <label class="sim-byo-label">Simulation Type</label>
                  <select id="byo-type" class="sim-byo-select">
                    <option value="">Select...</option>
                    <option value="virtual-lab">Virtual Lab Practical</option>
                    <option value="interactive-model">Interactive Model / Diagram</option>
                    <option value="data-collection">Data Collection &amp; Graphing</option>
                    <option value="guided-exploration">Guided Exploration</option>
                    <option value="sandbox">Free-play Sandbox</option>
                  </select>
                </div>
                <div class="sim-byo-field" style="margin-bottom:12px;">
                  <label class="sim-byo-label">Learning Objective</label>
                  <input type="text" id="byo-topic" class="sim-byo-input" placeholder="e.g. Show how changing flux produces EMF" />
                </div>
                <div class="sim-byo-field" style="margin-bottom:12px;">
                  <label class="sim-byo-label">Key Variables / Parameters</label>
                  <input type="text" id="byo-variables" class="sim-byo-input" placeholder="e.g. coil turns, magnet speed" />
                </div>
                <div class="sim-byo-field" style="margin-bottom:12px;">
                  <label class="sim-byo-label">Additional Instructions <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
                  <textarea class="sim-byo-textarea" id="sim-prompt" rows="2" placeholder="Apparatus, colour scheme, data table format..."></textarea>
                </div>
                <div class="sim-byo-field" style="margin-bottom:14px;">
                  <label class="sim-byo-label">Build Quality</label>
                  <select id="byo-model" class="sim-byo-select">
                    <option value="">Fast (Gemini Flash — recommended)</option>
                    <option value="gemini-2.5-pro">Complex build (Gemini Pro — slower, better for multi-part sims)</option>
                  </select>
                </div>
                <button class="sim-generate-btn" id="sim-generate-btn" style="width:100%;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  Generate Simulation
                </button>
                <div id="sim-loading" style="display:none;" class="sim-loading">
                  <div class="sim-spinner"></div>
                  <span>Generating...</span>
                </div>
              </div>

              <!-- CENTRE PANEL: Preview / placeholder -->
              <div class="sim-byo-centre" id="sim-byo-preview">
                ${BYO_PLACEHOLDER}
              </div>

              <!-- RIGHT PANEL: Tips & guidance -->
              <div class="sim-byo-right">
                <h4>Tips for a Great Simulation</h4>
                <ul>
                  <li>Be specific with your <strong>learning objective</strong>; "Investigate how temperature affects enzyme activity" is better than "enzymes".</li>
                  <li>List the <strong>key variables</strong> students should manipulate (independent) and observe (dependent).</li>
                  <li>Mention any <strong>apparatus</strong> you want drawn (e.g., beaker, thermometer, circuit board).</li>
                </ul>

                <h4>Simulation Types</h4>
                <ul>
                  <li><strong>Virtual Lab</strong>: Mimics a hands-on practical with apparatus, readings, and data collection.</li>
                  <li><strong>Interactive Model</strong>: Visual diagram students can manipulate (e.g., cell structure, wave properties).</li>
                  <li><strong>Data Collection</strong>: Focused on graphing and recording observations from variables.</li>
                  <li><strong>Guided Exploration</strong>: Step-by-step walkthrough with embedded questions.</li>
                  <li><strong>Free-play Sandbox</strong>: Open-ended environment for experimentation.</li>
                </ul>

                <h4>After Generating</h4>
                <ul>
                  <li>Your simulation will appear in the centre panel and auto-launch in full view.</li>
                  <li>Saved simulations appear below under "Your Generated Simulations".</li>
                  <li>You can regenerate with tweaked instructions anytime.</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Previously Generated Sims -->
          ${customSims.length > 0 ? `
            <hr class="sim-section-divider" />
            <div style="margin-bottom: 16px;">
              <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink, #1a1a2e);margin:0 0 4px;">Your Generated Simulations</h2>
              <p style="font-size:0.8125rem;color:var(--ink-muted, #777);margin:0;">Previously created AI-generated simulations</p>
            </div>
            <div class="sim-custom-grid" id="sim-custom-grid">
              ${customSims.map(sim => `
                <div class="sim-custom-card" data-custom-id="${sim.id}">
                  <div class="sim-custom-title" title="${escapeHtml(sim.title)}">${escapeHtml(sim.title)}</div>
                  <div class="sim-custom-date">${new Date(sim.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  ${(sim.subject || sim.level || sim.simType || sim.experimental) ? `
                  <div style="display:flex;flex-wrap:wrap;gap:4px;margin:-6px 0 12px;">
                    ${sim.subject ? `<span class="sim-meta-badge" style="background:${subjectColor(sim.subject)};">${escapeHtml(sim.subject)}</span>` : ''}
                    ${sim.level ? `<span class="sim-meta-badge" style="background:#64748b;">${escapeHtml(sim.level)}</span>` : ''}
                    ${sim.simType ? `<span class="sim-meta-badge" style="background:#0e7490;">${escapeHtml(String(sim.simType).replace(/-/g, ' '))}</span>` : ''}
                    ${sim.experimental ? `<span class="sim-meta-badge" style="background:#b45309;" title="Saved without passing the automated check">Experimental</span>` : ''}
                  </div>` : ''}
                  <div class="sim-custom-actions" style="flex-wrap:wrap;">
                    <button class="sim-custom-launch" data-custom-launch="${sim.id}">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Launch
                    </button>
                    <button class="sim-custom-delete" data-custom-refine="${sim.id}" title="Preview & refine with AI">Refine</button>
                    <button class="sim-custom-delete" data-custom-duplicate="${sim.id}" title="Copy this simulation so you can remix it">Duplicate</button>
                    <button class="sim-custom-delete" data-custom-attach="${sim.id}" title="Link under a lesson's resources">Attach</button>
                    <button class="sim-custom-delete" data-custom-rename="${sim.id}">Rename</button>
                    <button class="sim-custom-delete" data-custom-export="${sim.id}" title="Download as standalone .html">Export</button>
                    <button class="sim-custom-delete" data-custom-delete="${sim.id}">Delete</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

        </div>
      </div>
    `;

    /* ── MOE Syllabus topics by subject ── */
    const MOE_TOPICS = {
      Physics: [
        'Kinematics (speed, velocity, acceleration)',
        'Dynamics (Newton\u2019s laws, forces)',
        'Mass, Weight & Density',
        'Turning Effect of Forces (moments)',
        'Pressure',
        'Energy, Work & Power',
        'Kinetic Model of Matter',
        'Thermal Properties of Matter',
        'Transfer of Thermal Energy',
        'General Wave Properties',
        'Light (reflection, refraction, lenses)',
        'Electromagnetic Spectrum',
        'Sound',
        'Static Electricity',
        'Current Electricity (circuits, Ohm\u2019s law)',
        'D.C. Circuits (series & parallel)',
        'Practical Electricity (power, cost)',
        'Magnetism & Electromagnetism',
        'Electromagnetic Induction',
        'Radioactivity',
      ],
      Chemistry: [
        'Experimental Chemistry (lab techniques)',
        'Atomic Structure',
        'Chemical Bonding (ionic, covalent, metallic)',
        'Acids, Bases & Salts',
        'Qualitative Analysis',
        'The Mole Concept & Stoichiometry',
        'Electrolysis',
        'Energy Changes (exo/endothermic)',
        'Rate of Reaction (factors)',
        'Redox Reactions',
        'Metals & Reactivity Series',
        'Atmosphere & Environment',
        'Organic Chemistry (alkanes, alkenes, alcohols)',
        'Polymers & Macromolecules',
        'Titration & Volumetric Analysis',
      ],
      Biology: [
        'Cell Structure & Organisation',
        'Movement of Substances (diffusion, osmosis)',
        'Biological Molecules (enzymes)',
        'Nutrition in Humans (digestion)',
        'Nutrition in Plants (photosynthesis)',
        'Transport in Flowering Plants',
        'Transport in Humans (circulatory system)',
        'Respiration & the Respiratory System',
        'Excretion (kidneys)',
        'Homeostasis (thermoregulation)',
        'Co-ordination & Response (nervous system)',
        'Cell Division (mitosis, meiosis)',
        'Molecular Genetics (DNA, inheritance)',
        'Ecology & Environment',
        'Inheritance (Mendelian genetics)',
      ],
      Mathematics: [
        'Graphs of Functions (linear, quadratic)',
        'Trigonometry (sine, cosine, tangent)',
        'Vectors in 2D',
        'Probability & Statistics',
        'Coordinate Geometry',
        'Set Theory & Venn Diagrams',
        'Number Patterns & Sequences',
        'Mensuration (area, volume, surface area)',
        'Transformation Geometry',
      ],
      Geography: [
        'Plate Tectonics (earthquakes, volcanoes)',
        'Weather & Climate',
        'Water Cycle & Rivers',
        'Coastal Processes',
        'Urban Geography',
      ],
    };

    // Wire subject → topic dropdown
    const subjectSel = container.querySelector('#byo-subject');
    const topicSel = container.querySelector('#byo-topic-select');
    const otherWrap = container.querySelector('#byo-other-topic-wrap');
    if (subjectSel && topicSel) {
      subjectSel.addEventListener('change', () => {
        const subj = subjectSel.value;
        const topics = MOE_TOPICS[subj] || [];
        if (subj === 'Other' || topics.length === 0) {
          topicSel.innerHTML = '<option value="Other">Other (type below)</option>';
          otherWrap.style.display = '';
        } else {
          topicSel.innerHTML = '<option value="">Select topic...</option>'
            + topics.map(t => `<option value="${t}">${t}</option>`).join('')
            + '<option value="Other">Other (type below)</option>';
          otherWrap.style.display = 'none';
        }
      });
      topicSel.addEventListener('change', () => {
        otherWrap.style.display = topicSel.value === 'Other' ? '' : 'none';
      });
    }

    /* ── Event listeners ── */

    // Workflow breadcrumb clicks
    bindWorkflowClicks(container);

    // Subject filter tabs
    container.querySelectorAll('.sim-filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        setSubjectFilter(tab.dataset.filter);
        renderView();
      });
    });

    // Display limit dropdown
    const limitSel = container.querySelector('#sim-display-limit');
    if (limitSel) {
      limitSel.addEventListener('change', () => {
        setDisplayLimit(parseInt(limitSel.value, 10));
        renderView();
      });
    }

    // More simulations dropdown toggle
    const moreToggle = container.querySelector('#sim-more-toggle');
    const moreMenu = container.querySelector('#sim-more-menu');
    if (moreToggle && moreMenu) {
      moreToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        moreMenu.classList.toggle('open');
      });
      // One document-level closer, re-pointed at the current menu each render
      if (_menuCloser) document.removeEventListener('click', _menuCloser);
      _menuCloser = () => moreMenu.classList.remove('open');
      document.addEventListener('click', _menuCloser);
    }

    // Launch built-in sims (cards + dropdown items)
    container.querySelectorAll('[data-sim-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sim = SIMULATIONS.find(s => s.id === btn.dataset.simId);
        if (sim) {
          if (moreMenu) moreMenu.classList.remove('open');
          openOverlay(container, sim.title, { src: sim.path });
        }
      });
    });

    // Launch custom sims (sims with a spec get the pedagogical shell)
    container.querySelectorAll('[data-custom-launch]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sim = getCustomSims().find(s => s.id === btn.dataset.customLaunch);
        if (!sim) return;
        const rec = await loadSimRecord(sim.id);
        if (rec) openOverlay(container, sim.title, { srcdoc: rec.html, spec: sim.spec || null });
        else showToast('Could not load this simulation’s content.', 'danger');
      });
    });

    // Duplicate a custom sim (fresh id + html copy) so teachers can remix
    container.querySelectorAll('[data-custom-duplicate]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sim = getCustomSims().find(s => s.id === btn.dataset.customDuplicate);
        if (!sim) return;
        const rec = await loadSimRecord(sim.id);
        if (!rec) { showToast('Could not load this simulation’s content.', 'danger'); return; }
        const copy = { ...sim, id: generateId(), title: `${sim.title} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
        delete copy.html; // legacy inline payloads must not duplicate into localStorage
        storeSimRecord(copy.id, rec.html, []);
        const sims = getCustomSims();
        sims.unshift(copy);
        saveCustomSims(sims);
        showToast('Duplicated — refine the copy freely.', 'success');
        renderView();
      });
    });

    // Open in the refine workbench (centre preview + refine box)
    container.querySelectorAll('[data-custom-refine]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sim = getCustomSims().find(s => s.id === btn.dataset.customRefine);
        if (!sim) return;
        const rec = await loadSimRecord(sim.id);
        if (!rec) { showToast('Could not load this simulation’s content.', 'danger'); return; }
        renderPreviewPane(container, sim, rec);
        container.querySelector('#sim-byo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Rename
    container.querySelectorAll('[data-custom-rename]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sim = getCustomSims().find(s => s.id === btn.dataset.customRename);
        if (!sim) return;
        const { backdrop, close } = openModal({
          title: 'Rename Simulation',
          body: `<input class="input" id="sim-rename-input" value="${escapeHtml(sim.title)}" style="width:100%;box-sizing:border-box;" />`,
          footer: `<button class="btn btn-secondary" data-action="cancel">Cancel</button>
                   <button class="btn btn-primary" data-action="save">Save</button>`
        });
        backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
        backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
          const name = backdrop.querySelector('#sim-rename-input').value.trim();
          if (name) {
            const sims = getCustomSims();
            const target = sims.find(s => s.id === sim.id);
            if (target) { target.title = name; saveCustomSims(sims); }
            close();
            renderView();
          }
        });
      });
    });

    // Export as standalone .html file
    container.querySelectorAll('[data-custom-export]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sim = getCustomSims().find(s => s.id === btn.dataset.customExport);
        if (!sim) return;
        const rec = await loadSimRecord(sim.id);
        if (!rec) { showToast('Could not load this simulation’s content.', 'danger'); return; }
        const blob = new Blob([rec.html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${sim.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'simulation'}.html`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    });

    // Attach to a lesson (shows under the lesson's Linked Resources)
    container.querySelectorAll('[data-custom-attach]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sim = getCustomSims().find(s => s.id === btn.dataset.customAttach);
        if (!sim) return;
        const lessons = Store.getLessons();
        if (lessons.length === 0) { showToast('No lessons yet — save a lesson first.', 'default'); return; }
        const { backdrop, close } = openModal({
          title: 'Attach to Lesson',
          body: `<div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;">
            ${lessons.map(l => `<button class="btn btn-secondary btn-sm sim-attach-lesson" data-lesson-id="${escapeHtml(l.id)}" style="justify-content:flex-start;text-align:left;">${escapeHtml(l.title || 'Untitled Lesson')}</button>`).join('')}
          </div>`
        });
        backdrop.querySelectorAll('.sim-attach-lesson').forEach(lb => {
          lb.addEventListener('click', () => {
            const lesson = Store.getLesson(lb.dataset.lessonId);
            if (lesson) {
              const resources = (lesson.attachedResources || []).filter(r => r.id !== sim.id);
              resources.push({ id: sim.id, type: 'simulation', title: sim.title });
              Store.updateLesson(lesson.id, { attachedResources: resources });
              showToast(`Attached to "${lesson.title}"`, 'success');
            }
            close();
          });
        });
      });
    });

    // Delete custom sims
    container.querySelectorAll('[data-custom-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.customDelete;
        const ok = await confirmDialog({
          title: 'Delete Simulation',
          message: 'Delete this generated simulation? This cannot be undone.',
          confirmLabel: 'Delete'
        });
        if (!ok) return;
        saveCustomSims(getCustomSims().filter(s => s.id !== id));
        _simHtmlCache.delete(id);
        idbRemove('custom_sims', id).catch(() => {});
        showToast('Simulation deleted', 'default');
        renderView();
      });
    });

    // Generate simulation — Stage 1 drafts a pedagogical SPEC for review;
    // Stage 2 compiles the approved spec into HTML and probe-tests it.
    const generateBtn = container.querySelector('#sim-generate-btn');
    const promptArea = container.querySelector('#sim-prompt');
    const loadingEl = container.querySelector('#sim-loading');
    const loadingText = loadingEl.querySelector('span');
    const setLoading = (on, text) => {
      generateBtn.disabled = on;
      loadingEl.style.display = on ? 'flex' : 'none';
      if (text && loadingText) loadingText.textContent = text;
      // No parallel stages: the spec card's buttons wait for the current call
      container.querySelectorAll('#sim-byo-preview button').forEach(b => { b.disabled = on; });
    };

    function readBuilderForm() {
      const subject = container.querySelector('#byo-subject')?.value || '';
      const level = container.querySelector('#byo-level')?.value || '';
      const simType = container.querySelector('#byo-type')?.value || '';
      const topicFromDropdown = container.querySelector('#byo-topic-select')?.value || '';
      const topicCustom = container.querySelector('#byo-other-topic')?.value.trim() || '';
      const selectedTopic = (topicFromDropdown === 'Other' || !topicFromDropdown) ? topicCustom : topicFromDropdown;
      const objective = container.querySelector('#byo-topic')?.value.trim() || '';
      const variables = container.querySelector('#byo-variables')?.value.trim() || '';
      const extra = promptArea.value.trim();

      if (!selectedTopic && !objective) {
        showToast('Please select a topic or enter a learning objective.', 'danger');
        container.querySelector('#byo-topic')?.focus();
        return null;
      }

      // Build the structured prompt from scaffold fields
      const topicLine = selectedTopic ? `${selectedTopic}${objective ? ': ' + objective : ''}` : objective;
      const parts = [`Create an interactive simulation for: ${topicLine}`];
      if (subject && subject !== 'Other') parts.push(`Subject: ${subject}`);
      if (level) parts.push(`Student level: ${level}`);
      if (simType) parts.push(`Simulation style: ${simType.replace(/-/g, ' ')}`);
      if (variables) parts.push(`Key variables/parameters: ${variables}`);
      if (extra) parts.push(`Additional instructions: ${extra}`);
      const model = container.querySelector('#byo-model')?.value || '';
      return { prompt: parts.join('\n'), subject, level, simType, model };
    }

    generateBtn.addEventListener('click', () => {
      const ctx = readBuilderForm();
      if (ctx) runSpecStage(ctx);
    });

    async function runSpecStage(ctx) {
      setLoading(true, 'Drafting the model spec…');
      try {
        const spec = await generateSpec(ctx.prompt, ctx.model || undefined);
        renderSpecReview(spec, ctx);
      } catch (err) {
        console.error('Simulation spec error:', err);
        showToast(`Spec failed: ${err.message}`, 'danger');
      } finally {
        setLoading(false);
      }
    }

    // Compact review card: teacher approves the pedagogy before any code
    function renderSpecReview(spec, ctx) {
      const pane = container.querySelector('#sim-byo-preview');
      if (!pane) return;
      pane.innerHTML = `
        <div style="width:100%;max-width:640px;max-height:100%;overflow-y:auto;text-align:left;border:1px solid var(--border, #e2e5ea);border-radius:12px;padding:18px 20px;background:var(--bg-card, #fff);">
          <div style="font-size:0.6875rem;font-weight:700;color:#4361ee;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Spec review — nothing is built yet</div>
          <div style="font-size:1.0625rem;font-weight:700;color:var(--ink, #1a1a2e);margin-bottom:4px;">${escapeHtml(spec.title)}</div>
          <div style="font-size:0.8125rem;color:var(--ink-secondary, #555);line-height:1.5;margin-bottom:12px;">${escapeHtml(spec.learningObjective)}</div>
          <table style="width:100%;border-collapse:collapse;font-size:0.75rem;margin-bottom:12px;">
            <thead>
              <tr style="color:var(--ink-muted, #888);text-align:left;">
                <th style="padding:4px 6px;">Variable</th><th style="padding:4px 6px;">Unit</th><th style="padding:4px 6px;">Range</th><th style="padding:4px 6px;">Default</th><th style="padding:4px 6px;">Step</th>
              </tr>
            </thead>
            <tbody>
              ${spec.variables.map(v => `
                <tr style="border-top:1px solid var(--border-light, #f0f0f4);color:var(--ink, #1a1a2e);">
                  <td style="padding:4px 6px;">${escapeHtml(v.name)}${v.symbol ? ` <em style="color:var(--ink-muted,#888);">(${escapeHtml(v.symbol)})</em>` : ''}</td>
                  <td style="padding:4px 6px;">${escapeHtml(v.unit || '—')}</td>
                  <td style="padding:4px 6px;">${v.min} – ${v.max}</td>
                  <td style="padding:4px 6px;">${v.default}</td>
                  <td style="padding:4px 6px;">${v.step}</td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${spec.governingEquations.length ? `
            <div style="font-size:0.6875rem;font-weight:700;color:var(--ink-muted, #888);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Governing equations</div>
            <ul style="margin:0 0 14px;padding-left:18px;font-size:0.8125rem;color:var(--ink, #1a1a2e);font-family:ui-monospace,monospace;">
              ${spec.governingEquations.map(eq => `<li>${escapeHtml(eq)}</li>`).join('')}
            </ul>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="sim-generate-btn" id="spec-build-btn" style="margin-top:0;">Build simulation</button>
            <button class="sim-custom-delete" id="spec-regen-btn">Regenerate spec</button>
            <button class="sim-custom-delete" id="spec-back-btn">Back</button>
          </div>
        </div>`;
      pane.querySelector('#spec-build-btn').addEventListener('click', () => runBuildStage(spec, ctx));
      pane.querySelector('#spec-regen-btn').addEventListener('click', () => runSpecStage(ctx));
      pane.querySelector('#spec-back-btn').addEventListener('click', () => { pane.innerHTML = BYO_PLACEHOLDER; });
    }

    async function runBuildStage(spec, ctx) {
      // Honest staged progress (a build takes 30-60s)
      const stages = ['Drafting the model…', 'Building controls…', 'Wiring the graph…', 'Writing the data table…', 'Still generating…'];
      let stageIdx = 0;
      setLoading(true, stages[0]);
      const stageTimer = setInterval(() => {
        stageIdx = Math.min(stageIdx + 1, stages.length - 1);
        if (loadingText) loadingText.textContent = stages[stageIdx];
      }, 9000);

      try {
        const model = ctx.model || undefined;
        const buildPrompt = `Compile this SPEC into a complete interactive simulation.\n\nSPEC (JSON):\n${JSON.stringify(spec, null, 2)}\n\nORIGINAL REQUEST (context only — the SPEC is authoritative):\n${ctx.prompt}`;
        const text = await sendChat(
          [{ role: 'user', content: buildPrompt }],
          { trackLabel: 'customSimulation', systemPrompt: BUILD_SYSTEM_PROMPT, temperature: 0.2, maxTokens: 16000, model }
        );

        let html = extractHTML(text);
        if (!isCompleteHTML(html)) {
          if (loadingText) loadingText.textContent = 'Response was cut off — asking the model to finish it…';
          html = await completeTruncatedHTML(html, buildPrompt, model);
        }
        clearInterval(stageTimer);

        // Quality gate: probe in a sandboxed iframe, one auto-repair on failure
        const gate = await gateSimHTML(html, {
          repairContext: `The simulation was built from this SPEC: ${JSON.stringify(spec)}`,
          model,
          onStage: t => { if (loadingText) loadingText.textContent = t; }
        });
        html = gate.html;
        let experimental = false;
        if (!gate.ok) {
          setLoading(false);
          const choice = await askProbeFailChoice(gate.error);
          if (choice === 'discard') { showToast('Discarded — nothing was saved.', 'default'); return; }
          if (choice === 'retry') { return runBuildStage(spec, ctx); }
          experimental = true; // save anyway, honestly labelled
        }

        const newSim = {
          id: generateId(),
          title: spec.title || deriveTitle(ctx.prompt),
          prompt: ctx.prompt,
          subject: ctx.subject,
          level: ctx.level,
          simType: ctx.simType,
          model: ctx.model || '',
          spec,
          experimental,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        storeSimRecord(newSim.id, html, []);

        const sims = getCustomSims();
        sims.unshift(newSim);
        saveCustomSims(sims);

        showToast(experimental
          ? 'Saved as experimental — it did not pass the automated check. Refine it below.'
          : 'Simulation built and checked! Preview it below — you can refine it with follow-up instructions.', 'success');

        // Re-render, then show the refine workbench with the new sim
        renderView();
        const rec = _simHtmlCache.get(newSim.id);
        renderPreviewPane(container, newSim, rec);
        container.querySelector('#sim-byo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

      } catch (err) {
        console.error('Simulation build error:', err);
        showToast(`Build failed: ${err.message}`, 'danger');
      } finally {
        clearInterval(stageTimer);
        setLoading(false);
      }
    }
  }

  /* ── Refine workbench: live preview + conversational refinement ── */
  function renderPreviewPane(container, sim, rec) {
    const pane = container.querySelector('#sim-byo-preview');
    if (!pane || !rec) return;
    const versions = rec.versions || [];
    pane.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;width:100%;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong style="flex:1;font-size:0.8125rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:120px;">${escapeHtml(sim.title)}</strong>
          ${versions.length > 0 ? `
            <select id="sim-version-select" class="sim-byo-select" style="width:auto;font-size:0.75rem;padding:4px 24px 4px 8px;">
              <option value="current">Current version</option>
              ${versions.map((_, i) => `<option value="${i}">Restore v${i + 1} (older)</option>`).join('')}
            </select>` : ''}
          <button class="sim-custom-launch" id="sim-open-full">Fullscreen</button>
        </div>
        <iframe id="sim-preview-frame" sandbox="allow-scripts" style="flex:1;width:100%;min-height:360px;border:1px solid var(--border-light,#333);border-radius:10px;background:#1a1a2e;"></iframe>
        <div style="display:flex;gap:6px;">
          <input id="sim-refine-input" class="sim-byo-input" style="flex:1;" placeholder="Refine it: e.g. slow the animation, add a data table, larger labels…" />
          <button class="sim-generate-btn" id="sim-refine-btn" style="width:auto;padding:8px 16px;">Refine</button>
        </div>
        <div id="sim-refine-loading" style="display:none;" class="sim-loading"><div class="sim-spinner"></div><span>Applying your changes…</span></div>
      </div>`;

    pane.querySelector('#sim-preview-frame').srcdoc = rec.html;

    pane.querySelector('#sim-open-full').addEventListener('click', () => {
      openOverlay(container, sim.title, { srcdoc: rec.html, spec: sim.spec || null });
    });

    pane.querySelector('#sim-version-select')?.addEventListener('change', (e) => {
      if (e.target.value === 'current') {
        pane.querySelector('#sim-preview-frame').srcdoc = rec.html;
        return;
      }
      const idx = parseInt(e.target.value);
      const old = versions[idx];
      if (!old) return;
      // Restoring promotes the old version to current; current joins history
      const newRec = storeSimRecord(sim.id, old, [...versions.filter((_, i) => i !== idx), rec.html]);
      const sims = getCustomSims();
      const target = sims.find(s => s.id === sim.id);
      if (target) { target.updatedAt = Date.now(); saveCustomSims(sims); }
      showToast('Older version restored.', 'success');
      renderPreviewPane(container, sim, newRec);
    });

    const refineBtn = pane.querySelector('#sim-refine-btn');
    const refineInput = pane.querySelector('#sim-refine-input');
    const refineLoading = pane.querySelector('#sim-refine-loading');
    const refineStage = refineLoading.querySelector('span');
    const doRefine = async () => {
      const instruction = refineInput.value.trim();
      if (!instruction) { refineInput.focus(); return; }
      refineBtn.disabled = true;
      refineLoading.style.display = 'flex';
      if (refineStage) refineStage.textContent = 'Applying your changes…';
      try {
        // Refine on the same model the sim was built with, not the app default
        const model = sim.model || undefined;
        const text = await sendChat(
          [{ role: 'user', content: `CURRENT SIMULATION HTML:\n${rec.html}\n\nREQUESTED CHANGE:\n${instruction}` }],
          {
            trackLabel: 'customSimulationRefine',
            systemPrompt: 'You refine existing self-contained HTML simulations. Apply ONLY the requested change while preserving everything else (layout, science, styling conventions). Return the COMPLETE updated HTML document. No markdown fences, no commentary.',
            temperature: 0.4,
            maxTokens: 16000,
            model
          }
        );
        let html = extractHTML(text);
        if (!isCompleteHTML(html)) html = await completeTruncatedHTML(html, instruction, model);

        // Refined output goes through the same probe gate as fresh builds
        const gate = await gateSimHTML(html, {
          repairContext: `The requested refinement was: ${instruction}`,
          model,
          onStage: t => { if (refineStage) refineStage.textContent = t; }
        });
        html = gate.html;
        let experimental = false;
        if (!gate.ok) {
          refineLoading.style.display = 'none';
          const choice = await askProbeFailChoice(gate.error);
          if (choice === 'discard') { showToast('Change discarded — the current version is untouched.', 'default'); return; }
          if (choice === 'retry') { return doRefine(); }
          experimental = true;
        }

        const newRec = storeSimRecord(sim.id, html, [...(rec.versions || []), rec.html]);
        const sims = getCustomSims();
        const target = sims.find(s => s.id === sim.id);
        if (target) { target.updatedAt = Date.now(); target.experimental = experimental; saveCustomSims(sims); }
        sim.experimental = experimental;
        showToast(experimental
          ? 'Saved as experimental — previous version kept in history.'
          : 'Refined and checked! Previous version kept in history.', 'success');
        renderPreviewPane(container, sim, newRec);
      } catch (err) {
        showToast(`Refine failed: ${err.message}`, 'danger');
      } finally {
        refineBtn.disabled = false;
        refineLoading.style.display = 'none';
      }
    };
    refineBtn.addEventListener('click', doRefine);
    refineInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doRefine(); });
  }

  migrateLegacySimHtml();
  renderView();

  // Deep link from a lesson's Linked Resources chip: open that sim directly
  const openSimId = sessionStorage.getItem('cocher_open_sim_id');
  if (openSimId) {
    sessionStorage.removeItem('cocher_open_sim_id');
    (async () => {
      const custom = getCustomSims().find(s => s.id === openSimId);
      if (custom) {
        const rec = await loadSimRecord(custom.id);
        if (rec) openOverlay(container, custom.title, { srcdoc: rec.html, spec: custom.spec || null });
        else showToast('Could not load this simulation’s content.', 'danger');
        return;
      }
      const builtIn = SIMULATIONS.find(s => s.id === openSimId);
      if (builtIn) openOverlay(container, builtIn.title, { src: builtIn.path });
    })();
  }
}
