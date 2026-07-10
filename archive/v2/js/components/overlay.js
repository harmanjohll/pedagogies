/*
 * Shared Overlay Launcher
 * =======================
 * Fullscreen resizable overlay for embedding interactive tools via iframe.
 * Extracted from simulations.js for reuse across all teaching tool pages.
 */

export function openOverlay(title, opts) {
  // opts: { src } or { srcdoc }
  const overlay = document.createElement('div');
  overlay.id = 'sim-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);animation:simFadeIn 0.2s ease;';

  const win = document.createElement('div');
  win.id = 'sim-window';
  win.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;overflow:hidden;background:#1a1a2e;transition:border-radius 0.15s;';

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
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');

  // Optional post-load callback
  if (opts.onLoad) {
    iframe.addEventListener('load', () => {
      try { opts.onLoad(iframe); } catch (e) { /* sandbox restriction */ }
    });
  }

  win.appendChild(topBar);
  win.appendChild(iframe);

  // Resize handles
  let resizing = null;
  let startX, startY, startBounds;
  const cursors = {
    top: 'ns-resize', bottom: 'ns-resize', left: 'ew-resize', right: 'ew-resize',
    'top-left': 'nwse-resize', 'bottom-right': 'nwse-resize',
    'top-right': 'nesw-resize', 'bottom-left': 'nesw-resize'
  };
  const E = 7, C = 14;
  const handleDefs = {
    top: `top:0;left:${C}px;right:${C}px;height:${E}px;`,
    bottom: `bottom:0;left:${C}px;right:${C}px;height:${E}px;`,
    left: `left:0;top:${C}px;bottom:${C}px;width:${E}px;`,
    right: `right:0;top:${C}px;bottom:${C}px;width:${E}px;`,
    'top-left': `top:0;left:0;width:${C}px;height:${C}px;`,
    'top-right': `top:0;right:0;width:${C}px;height:${C}px;`,
    'bottom-left': `bottom:0;left:0;width:${C}px;height:${C}px;`,
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

  const closeOverlay = () => {
    overlay.remove();
    document.removeEventListener('keydown', escHandler);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  overlay.querySelector('#sim-overlay-close').addEventListener('click', closeOverlay);
  const escHandler = (e) => { if (e.key === 'Escape') closeOverlay(); };
  document.addEventListener('keydown', escHandler);

  return { overlay, iframe, close: closeOverlay };
}
