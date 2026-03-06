/*
 * Co-Cher Simulations Gallery
 * ===========================
 * Interactive science practicals gallery and AI-powered custom simulation builder.
 */

import { showToast } from '../components/toast.js';
import { Store } from '../state.js';
import { sendChat } from '../api.js';

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
    description: 'Marble chips and acid \u2014 measure gas production with a syringe. Investigate concentration and surface area effects.',
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
    description: 'Explore wave behaviour \u2014 reflection, refraction, and diffraction in a simulated ripple tank.',
    difficulty: 'Intermediate',
    path: 'simulations/physics/waves/index.html'
  }
];

/* ── Helpers ── */
function subjectColor(subject) {
  if (subject === 'Chemistry') return '#4361ee';
  if (subject === 'Biology') return '#06d6a0';
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
  // opts: { src } or { srcdoc }
  const overlay = document.createElement('div');
  overlay.id = 'sim-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);animation:simFadeIn 0.2s ease;';

  // Window — starts full viewport, user drags edges to resize
  const win = document.createElement('div');
  win.id = 'sim-window';
  win.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;overflow:hidden;background:#1a1a2e;transition:border-radius 0.15s;';

  // Top bar: title + hint + close
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:6px 16px;background:#12122a;color:#fff;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.08);user-select:none;';
  topBar.innerHTML = `
    <span style="font-weight:600;font-size:0.9375rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${title}</span>
    <span style="font-size:0.6875rem;color:rgba(255,255,255,0.3);">Drag edges to resize</span>
    <button id="sim-overlay-close" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px 10px;font-size:1.25rem;line-height:1;border-radius:6px;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='none'">&times;</button>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'flex:1;border:none;width:100%;background:#1e1f2b;';
  if (opts.src) iframe.src = opts.src;
  else if (opts.srcdoc) iframe.srcdoc = opts.srcdoc;
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');

  // Inject layout overrides into labsim simulations after load
  iframe.addEventListener('load', () => {
    try {
      const doc = iframe.contentDocument;
      if (!doc || !doc.querySelector('.practical-layout')) return;
      injectSimLayoutOverrides(doc);
    } catch (e) { /* cross-origin or sandbox restriction */ }
  });

  win.appendChild(topBar);
  win.appendChild(iframe);

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
  // Try to find HTML within code fences first
  const fenced = text.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // If it starts with <!DOCTYPE or <html, use the whole thing
  const trimmed = text.trim();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
    return trimmed;
  }
  // Last resort: find first <html...> to </html>
  const htmlMatch = trimmed.match(/<html[\s\S]*<\/html>/i);
  if (htmlMatch) return htmlMatch[0];
  // If nothing else, wrap in a basic page
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:sans-serif;background:#1a1a2e;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head><body>${trimmed}</body></html>`;
}

/* ── Derive a short title from the prompt ── */
function deriveTitle(prompt) {
  const cleaned = prompt.replace(/^(create|build|make|generate|design)\s+(a|an|the)?\s*/i, '').trim();
  const first = cleaned.split(/[.\n]/)[0].trim();
  return first.length > 60 ? first.slice(0, 57) + '...' : first || 'Custom Simulation';
}

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
          padding: 28px;
          transition: border-color 0.2s;
        }
        .sim-byo-card:hover { border-color: #4361ee; }
        .dark .sim-byo-card {
          background: var(--bg-card, #1e1e2e);
          border-color: var(--border, #3e3e4e);
        }
        .dark .sim-byo-card:hover { border-color: #4361ee; }
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
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              <div class="sim-byo-title">Build Your Own Simulation</div>
            </div>
            <div class="sim-byo-desc">Configure the parameters below, then let AI generate an interactive simulation for your lesson.</div>

            <!-- Scaffolded parameters -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
              <div class="sim-byo-field">
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
              <div class="sim-byo-field">
                <label class="sim-byo-label">Level</label>
                <select id="byo-level" class="sim-byo-select">
                  <option value="">Select...</option>
                  <option value="Lower Secondary">Lower Secondary</option>
                  <option value="Upper Secondary">Upper Secondary</option>
                  <option value="JC / Pre-U">JC / Pre-U</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
              <div class="sim-byo-field">
                <label class="sim-byo-label">Topic</label>
                <select id="byo-topic-select" class="sim-byo-select">
                  <option value="">Select a subject first...</option>
                </select>
              </div>
              <div class="sim-byo-field">
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
            </div>

            <div id="byo-other-topic-wrap" class="sim-byo-field" style="margin-bottom:14px;display:none;">
              <label class="sim-byo-label">Your Topic</label>
              <input type="text" id="byo-other-topic" class="sim-byo-input" placeholder="Enter your topic and learning objective..." />
            </div>

            <div class="sim-byo-field" style="margin-bottom:14px;">
              <label class="sim-byo-label">Learning Objective</label>
              <input type="text" id="byo-topic" class="sim-byo-input" placeholder="e.g. Show how changing flux produces EMF" />
            </div>

            <div class="sim-byo-field" style="margin-bottom:14px;">
              <label class="sim-byo-label">Key Variables / Parameters to Include</label>
              <input type="text" id="byo-variables" class="sim-byo-input" placeholder="e.g. coil turns, magnet speed, field strength" />
            </div>

            <div class="sim-byo-field" style="margin-bottom:14px;">
              <label class="sim-byo-label">Additional Instructions <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
              <textarea class="sim-byo-textarea" id="sim-prompt" rows="3" placeholder="Any other details: specific apparatus, colour scheme, data table format, guided questions..."></textarea>
            </div>

            <button class="sim-generate-btn" id="sim-generate-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Generate Simulation
            </button>
            <div id="sim-loading" style="display:none;" class="sim-loading">
              <div class="sim-spinner"></div>
              <span>Generating your simulation... This may take a moment.</span>
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
                  <div class="sim-custom-title" title="${sim.title}">${sim.title}</div>
                  <div class="sim-custom-date">${new Date(sim.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  <div class="sim-custom-actions">
                    <button class="sim-custom-launch" data-custom-launch="${sim.id}">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Launch
                    </button>
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
      document.addEventListener('click', () => moreMenu.classList.remove('open'), { once: false });
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

    // Launch custom sims
    container.querySelectorAll('[data-custom-launch]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sims = getCustomSims();
        const sim = sims.find(s => s.id === btn.dataset.customLaunch);
        if (sim) {
          openOverlay(container, sim.title, { srcdoc: sim.html });
        }
      });
    });

    // Delete custom sims
    container.querySelectorAll('[data-custom-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.customDelete;
        const sims = getCustomSims().filter(s => s.id !== id);
        saveCustomSims(sims);
        showToast('Simulation deleted', 'default');
        renderView();
      });
    });

    // Generate simulation
    const generateBtn = container.querySelector('#sim-generate-btn');
    const promptArea = container.querySelector('#sim-prompt');
    const loadingEl = container.querySelector('#sim-loading');

    generateBtn.addEventListener('click', async () => {
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
        return;
      }

      // Build the structured prompt from scaffold fields
      const topicLine = selectedTopic ? `${selectedTopic}${objective ? ' \u2014 ' + objective : ''}` : objective;
      const parts = [`Create an interactive simulation for: ${topicLine}`];
      if (subject && subject !== 'Other') parts.push(`Subject: ${subject}`);
      if (level) parts.push(`Student level: ${level}`);
      if (simType) parts.push(`Simulation style: ${simType.replace(/-/g, ' ')}`);
      if (variables) parts.push(`Key variables/parameters: ${variables}`);
      if (extra) parts.push(`Additional instructions: ${extra}`);
      const prompt = parts.join('\n');

      // Show loading state
      generateBtn.disabled = true;
      loadingEl.style.display = 'flex';

      try {
        const systemPrompt = `You are LabSim Builder, an expert at creating visually rich, interactive science simulations for Singapore secondary / JC students. Generate a COMPLETE, self-contained HTML page with embedded CSS and JavaScript.

VISUAL QUALITY — CRITICAL:
- Use HTML5 Canvas 2D API for ALL apparatus and equipment visuals — do NOT use plain HTML divs for the simulation area.
- Draw realistic apparatus: use ctx.createLinearGradient, ctx.createRadialGradient, ctx.arc, ctx.bezierCurveTo, shadows (ctx.shadowBlur), and layered strokes+fills.
- Lab glassware: semi-transparent glass rgba(200,225,255,0.25) with white highlights, graduation marks, meniscus curves, rounded test-tube bottoms.
- Metals/equipment: linear gradients light-to-dark grey, bevelled edges, proper proportions.
- Liquids: semi-transparent coloured fills, meniscus at surface, colour-change animations for reactions.
- Physics apparatus: clean vector drawings with labelled force arrows, proper circuit symbols, realistic pendulum bobs with shadows.
- Canvas must be at least 600x450 px and visually prominent — it is the MAIN element.
- Add smooth animations using requestAnimationFrame for dynamic elements.

LAYOUT:
- Preferred 3-section layout: LEFT guide panel (200px), CENTRE large canvas (flexible, fills space), RIGHT data+controls panel (260px).
- Alternative 2-column: LEFT canvas 65-70%, RIGHT controls 30-35%.
- Dark theme: background #1a1a2e, panels #252540, text #e8e8f0, accent #4361ee, success #22c55e, danger #ef4444.
- Rounded panels (12px radius), subtle borders rgba(255,255,255,0.08), system-ui font.

CONTROLS & DATA:
- Labelled sliders/buttons/dropdowns for each variable with live numeric readout.
- Data table that accumulates recorded readings.
- Reset button. Brief instruction text at top.

SCIENCE: Accurate equations, correct SI units, reasonable significant figures, annotated labels on canvas.

TECHNICAL:
- Fully self-contained: NO external libraries, NO CDN, NO images.
- requestAnimationFrame for animations.
- Return ONLY the raw HTML. No markdown fences, no explanation.`;

        const text = await sendChat(
          [{ role: 'user', content: prompt }],
          { systemPrompt, temperature: 0.5, maxTokens: 16000 }
        );

        const html = extractHTML(text);
        const title = deriveTitle(prompt);
        const newSim = {
          id: generateId(),
          title: title,
          html: html,
          createdAt: Date.now()
        };

        const sims = getCustomSims();
        sims.unshift(newSim);
        saveCustomSims(sims);

        showToast('Simulation generated!', 'success');

        // Re-render to show the new sim, then auto-launch it
        renderView();
        openOverlay(container, title, { srcdoc: html });

      } catch (err) {
        console.error('Simulation generation error:', err);
        showToast(`Generation failed: ${err.message}`, 'danger');
      } finally {
        generateBtn.disabled = false;
        loadingEl.style.display = 'none';
      }
    });
  }

  renderView();
}
