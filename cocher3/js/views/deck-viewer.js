/*
 * Co-Cher — In-app Deck Viewer + Editor (#/deck/:id)
 * ==================================================
 * VIEWING: shows a stored slide deck INSIDE Co-Cher instead of a blob: tab.
 * This is load-bearing, not cosmetic: blob documents send no Referer, and
 * YouTube's embedded player refuses to play without one ("Error 153"), so
 * slide videos silently failed. Served from the app's real URL, embeds load
 * normally. The compiled deck document runs in an iframe via srcdoc; its own
 * Exit button/Esc posts {type:'cocher-deck-exit'} and we navigate back.
 *
 * EDITING (v8.9): decks stored WITH their slide model (v8.1+) gain an Edit
 * mode. The same compiled document is re-served with a small editor layer
 * injected at display time (the STORED html stays pure):
 *   · Tap any text → edit it in place (contenteditable); on blur the change
 *     writes back to the model via the compiler's data-ed path tags and
 *     auto-saves (recompile + updateDeckMaterial, same deck id — lesson
 *     attachments, Present and Go Live keep working).
 *   · Magic AI brush → tap elements/slides to drop numbered pins, type an
 *     instruction per pin, then Apply sends model + pins to editDeck (api.js)
 *     in ONE call and swaps in the returned model.
 *   · The pre-session model is stashed once per editing session, so Revert
 *     always returns to how the deck looked when editing began (and toggles).
 */

import { getMediaContent, listDeckMeta, getDeckModel, updateDeckMaterial, revertDeckMaterial, compileDeckHTML } from '../utils/deck.js';
import { editDeck } from '../api.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/markdown.js';

function goBack() {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = '#/lessons';
}

/* ── Editor layer injected into the deck document (edit mode only) ──
 * Runs INSIDE the iframe. Suppresses the deck's click-to-advance (capture
 * phase), turns data-ed elements into tap-to-edit fields, drops brush pins,
 * and protects contenteditable typing from the deck's global key handlers.
 * Talks to the viewer via postMessage; slide navigation stays on arrow keys
 * (synthetic ones for the viewer's ‹ › buttons). */
const EDITOR_CSS = `
  [data-ed] { cursor: text; border-radius: 4px; }
  [data-ed]:hover { outline: 2px dashed color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 3px; }
  .ed-editing { outline: 2px solid var(--accent) !important; outline-offset: 3px; }
  body.ed-brush [data-ed], body.ed-brush .slide-inner { cursor: crosshair; }
  body.ed-brush [data-ed]:hover { outline-color: #e11d48; outline-style: solid; }
  .ed-pin { display:inline-flex; align-items:center; justify-content:center; min-width:1.5em; height:1.5em; margin-left:.35em; padding:0 .3em; border-radius:999px; background:#e11d48; color:#fff; font-size:.65em; font-weight:800; vertical-align:middle; user-select:none; animation: edPop .25s ease; }
  @keyframes edPop { from { transform: scale(.4); opacity: 0; } to { transform: none; opacity: 1; } }
  #ed-banner { position:fixed; top:10px; left:50%; transform:translateX(-50%); background:var(--ink); color:#fff; font-size:.78rem; font-weight:600; padding:6px 16px; border-radius:999px; z-index:30; opacity:.92; pointer-events:none; max-width:92vw; text-align:center; }
`;
const EDITOR_JS = `
(function () {
  var brush = false;
  var send = function (m) { try { parent.postMessage(m, '*'); } catch (e) {} };
  var banner = document.createElement('div');
  banner.id = 'ed-banner';
  banner.textContent = 'Editing — tap any text to change it';
  document.body.appendChild(banner);
  function slideIndexOf(el) {
    var slides = [].slice.call(document.querySelectorAll('.slide'));
    return slides.indexOf(el.closest('.slide'));
  }
  function startEdit(el) {
    if (el.isContentEditable) return;
    var before = el.textContent;
    try { el.contentEditable = 'plaintext-only'; } catch (e) { el.contentEditable = 'true'; }
    el.classList.add('ed-editing');
    el.focus();
    var done = function () {
      el.removeEventListener('blur', done);
      el.contentEditable = 'false';
      el.classList.remove('ed-editing');
      var text = el.textContent.replace(/\\s+/g, ' ').trim();
      if (text !== before.replace(/\\s+/g, ' ').trim()) {
        send({ type: 'cocher-deck-edit', path: el.getAttribute('data-ed'), text: text });
      }
    };
    el.addEventListener('blur', done);
  }
  // Capture phase: beat the deck's own click-to-advance handler.
  document.addEventListener('click', function (e) {
    if (e.target.closest('#deck-ctrl')) return;   // Notes / Full / Exit keep working
    e.stopPropagation();
    e.preventDefault();
    var ed = e.target.closest('[data-ed]');
    if (brush) {
      var host = ed || e.target.closest('.slide-inner');
      if (!host) return;
      var path = ed ? ed.getAttribute('data-ed') : String(slideIndexOf(host));
      var label = (ed ? ed.textContent : (host.querySelector('h1,h2,.statement,blockquote') || host).textContent)
        .replace(/\\s+/g, ' ').trim().slice(0, 80);
      send({ type: 'cocher-deck-pin', path: path, label: label });
      return;
    }
    if (ed) startEdit(ed);
  }, true);
  // Protect typing: the deck maps Space/arrows/N/F/Esc globally.
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.isContentEditable) {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.target.blur(); }
      e.stopPropagation();
    }
  }, true);
  window.addEventListener('message', function (ev) {
    var d = (ev && ev.data) || {};
    if (d.type === 'cocher-ed-brush') {
      brush = !!d.on;
      document.body.classList.toggle('ed-brush', brush);
      banner.textContent = brush ? 'AI brush — tap what should change, then type the instruction above' : 'Editing — tap any text to change it';
    } else if (d.type === 'cocher-ed-nav') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: d.dir > 0 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
    } else if (d.type === 'cocher-ed-pin-add') {
      var target = null;
      if (/^\\d+$/.test(String(d.path))) {
        var slide = document.querySelectorAll('.slide')[Number(d.path)];
        target = slide && slide.querySelector('.slide-inner');
      } else {
        target = document.querySelector('[data-ed="' + d.path + '"]');
      }
      if (target) {
        var b = document.createElement('span');
        b.className = 'ed-pin';
        b.setAttribute('data-pin', d.n);
        b.textContent = d.n;
        target.appendChild(b);
      }
    } else if (d.type === 'cocher-ed-unpin') {
      var p = document.querySelector('.ed-pin[data-pin="' + d.n + '"]');
      if (p) p.remove();
    } else if (d.type === 'cocher-ed-clearpins') {
      [].slice.call(document.querySelectorAll('.ed-pin')).forEach(function (x) { x.remove(); });
    }
  });
})();`;

function instrument(html) {
  return html.replace('</body>', `<style>${EDITOR_CSS}</style><script>${EDITOR_JS}</scr` + `ipt></body>`);
}

/* Write an edited text back into the model at a data-ed path ("3.bullets.1"). */
function setByPath(model, path, text) {
  const toks = String(path || '').split('.');
  if (!toks.length) return false;
  let node = model.slides?.[Number(toks[0])];
  if (!node) return false;
  for (let k = 1; k < toks.length - 1; k++) {
    const key = /^\d+$/.test(toks[k]) ? Number(toks[k]) : toks[k];
    if (node[key] == null) node[key] = /^\d+$/.test(toks[k + 1]) ? [] : {};
    node = node[key];
  }
  const last = toks[toks.length - 1];
  node[/^\d+$/.test(last) ? Number(last) : last] = text;
  return true;
}

export function renderDeckViewer(container, params) {
  const id = params?.id || '';
  let meta = listDeckMeta().find(m => m.id === id) || null;

  let mode = 'view';
  let model = null;          // loaded on entering edit mode
  let pins = [];             // [{n, path, label, text}]
  let pinSeq = 0;
  let stashed = false;       // pre-session model stashed this session?
  let busy = false;
  let saveTimer = null;
  let statusTimer = null;

  container.innerHTML = `
    <div id="deck-viewer" style="position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:#0b0d1a;">
      <style>
        #dv-bar { display:flex; align-items:center; gap:8px; padding:6px 14px; background:#12122a; color:#fff; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.08); flex-wrap:wrap; }
        #dv-bar button { font:inherit; background:none; border:1px solid rgba(255,255,255,0.25); color:#fff; cursor:pointer; padding:4px 12px; border-radius:8px; font-size:0.8125rem; min-height:32px; }
        #dv-bar button:hover { border-color:rgba(255,255,255,0.6); }
        #dv-bar button[aria-pressed="true"] { background:#e11d48; border-color:#e11d48; }
        #dv-bar button:disabled { opacity:0.5; cursor:default; }
        #dv-status { font-size:0.75rem; color:#a5b4fc; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        #dv-status.err { color:#fda4af; }
        #dv-tray { display:none; flex-direction:column; gap:6px; padding:8px 14px; background:#181834; color:#fff; flex-shrink:0; border-bottom:1px solid rgba(255,255,255,0.08); max-height:32vh; overflow-y:auto; }
        .dv-pin-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .dv-pin-n { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:999px; background:#e11d48; font-size:0.72rem; font-weight:800; }
        .dv-pin-label { flex-shrink:1; min-width:0; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.72rem; color:#c7d2fe; }
        .dv-pin-input { flex:1 1 180px; min-width:0; font:inherit; font-size:0.8125rem; padding:7px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.07); color:#fff; }
        .dv-pin-input::placeholder { color:rgba(255,255,255,0.45); }
        .dv-pin-x { flex-shrink:0; background:none; border:none; color:#fda4af; cursor:pointer; font-size:1rem; padding:2px 6px; min-height:32px; }
        @media (max-width:720px) {
          #dv-bar { gap:6px; padding:6px 8px; }
          #dv-bar button { min-height:40px; padding:6px 12px; }
          #dv-title { display:none; }
          .dv-pin-label { max-width:120px; }
          .dv-pin-x { min-height:40px; }
        }
      </style>
      <div id="dv-bar"></div>
      <div id="dv-tray"></div>
      <iframe id="deck-viewer-frame" title="${escapeHtml(meta?.title || 'Slide deck')}"
        style="flex:1;min-height:0;border:none;width:100%;background:#fff;"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
    </div>`;

  const frame = container.querySelector('#deck-viewer-frame');
  const bar = container.querySelector('#dv-bar');
  const tray = container.querySelector('#dv-tray');
  const post = (msg) => { try { frame.contentWindow?.postMessage(msg, '*'); } catch { /* ignore */ } };

  function flashStatus(text, isError = false) {
    const el = bar.querySelector('#dv-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('err', isError);
    clearTimeout(statusTimer);
    if (!isError) statusTimer = setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3500);
  }

  function renderBar() {
    if (mode === 'view') {
      bar.innerHTML = `
        <span id="dv-title" style="font-weight:600;font-size:0.9375rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:60px;">${escapeHtml(meta?.title || 'Slide deck')}</span>
        ${meta?.hasModel ? `<button id="dv-edit" title="Edit this deck — tap text to change it, or pin AI edits">&#9998; Edit</button>` : ''}
        <button id="dv-close">&times; Close</button>`;
      bar.querySelector('#dv-close').addEventListener('click', goBack);
      bar.querySelector('#dv-edit')?.addEventListener('click', enterEdit);
      tray.style.display = 'none';
    } else {
      bar.innerHTML = `
        <button id="dv-prev" title="Previous slide">&#8249;</button>
        <button id="dv-next" title="Next slide">&#8250;</button>
        <span id="dv-title" style="font-weight:600;font-size:0.8125rem;color:#c7d2fe;">Editing — tap text on a slide to change it</span>
        <span id="dv-status" style="flex:1;"></span>
        <button id="dv-brush" aria-pressed="false" title="Magic AI brush — tap what should change, describe the change, Apply once">&#128396;&#65039; AI brush</button>
        <button id="dv-apply" style="display:none;">&#10024; Apply</button>
        ${(meta?.hasPrev || stashed) ? `<button id="dv-revert" title="Swap back to how the deck looked before this editing session (press again to redo)">&#8630; Revert</button>` : ''}
        <button id="dv-done" style="font-weight:700;">Done</button>`;
      bar.querySelector('#dv-prev').addEventListener('click', () => post({ type: 'cocher-ed-nav', dir: -1 }));
      bar.querySelector('#dv-next').addEventListener('click', () => post({ type: 'cocher-ed-nav', dir: 1 }));
      bar.querySelector('#dv-brush').addEventListener('click', () => {
        const btn = bar.querySelector('#dv-brush');
        const on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(on));
        post({ type: 'cocher-ed-brush', on });
      });
      bar.querySelector('#dv-apply').addEventListener('click', applyPins);
      bar.querySelector('#dv-revert')?.addEventListener('click', doRevert);
      bar.querySelector('#dv-done').addEventListener('click', exitEdit);
      renderTray();
    }
  }

  function renderTray() {
    const applyBtn = bar.querySelector('#dv-apply');
    if (!pins.length) {
      tray.style.display = 'none';
      tray.innerHTML = '';
      if (applyBtn) applyBtn.style.display = 'none';
      return;
    }
    tray.style.display = 'flex';
    tray.innerHTML = pins.map(p => `
      <div class="dv-pin-row" data-n="${p.n}">
        <span class="dv-pin-n">${p.n}</span>
        <span class="dv-pin-label" title="${escapeHtml(p.label)}">${escapeHtml(p.label || 'Whole slide')}</span>
        <input class="dv-pin-input" type="text" placeholder="What should change here?" value="${escapeHtml(p.text)}" ${busy ? 'disabled' : ''} />
        <button class="dv-pin-x" title="Remove pin" ${busy ? 'disabled' : ''}>&times;</button>
      </div>`).join('');
    tray.querySelectorAll('.dv-pin-row').forEach(row => {
      const n = Number(row.dataset.n);
      const pin = pins.find(p => p.n === n);
      row.querySelector('.dv-pin-input').addEventListener('input', (e) => { if (pin) pin.text = e.target.value; });
      row.querySelector('.dv-pin-x').addEventListener('click', () => {
        pins = pins.filter(p => p.n !== n);
        post({ type: 'cocher-ed-unpin', n });
        renderTray();
      });
    });
    if (applyBtn) {
      applyBtn.style.display = '';
      applyBtn.innerHTML = busy ? 'Applying&hellip;' : `&#10024; Apply ${pins.length} AI edit${pins.length === 1 ? '' : 's'}`;
      applyBtn.disabled = busy;
    }
  }

  function loadEditFrame() {
    frame.srcdoc = instrument(compileDeckHTML(model));
  }

  /* Auto-save: recompile + overwrite the SAME deck id. The first save of the
   * session stashes the pre-edit model so Revert has a fixed point. */
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 600);
  }
  async function doSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const updated = await updateDeckMaterial(id, { html: compileDeckHTML(model), deck: model, stashPrevModel: !stashed });
    if (updated) {
      const hadRevert = !!bar.querySelector('#dv-revert');
      meta = updated;
      stashed = true;
      if (!hadRevert && mode === 'edit') renderBar();   // Revert appears after first save
      flashStatus('Saved ✓');
    } else {
      flashStatus('Save failed — storage may be full.', true);
    }
  }

  async function applyPins() {
    if (busy) return;
    const edits = pins.filter(p => p.text.trim()).map(p => ({ path: p.path, anchor: p.label, instruction: p.text.trim() }));
    if (!edits.length) { flashStatus('Type an instruction on a pin first.', true); return; }
    busy = true;
    renderTray();
    flashStatus('Applying AI edits…');
    try {
      const updated = await editDeck({ deck: model, edits });
      model = updated;
      pins = [];
      busy = false;
      await doSave();
      loadEditFrame();
      renderBar();
      flashStatus('AI edits applied ✓ — Revert brings the old version back');
    } catch (err) {
      busy = false;
      renderTray();
      flashStatus(err?.message || 'The AI edit failed — please try again.', true);
    }
  }

  async function doRevert() {
    if (busy) return;
    if (saveTimer) await doSave();      // don't revert past an uncommitted tweak
    const ok = await revertDeckMaterial(id);
    if (!ok) { flashStatus('Nothing to revert to yet.', true); return; }
    model = await getDeckModel(id);
    meta = listDeckMeta().find(m => m.id === id) || meta;
    pins = [];
    loadEditFrame();
    renderBar();
    flashStatus('Reverted ✓ — press Revert again to redo');
  }

  async function enterEdit() {
    model = await getDeckModel(id);
    if (!model) {
      showToast('This deck was saved without an editable model (pre-v8.1) — regenerate it in the Lesson Planner to edit.', 'warning');
      return;
    }
    mode = 'edit';
    stashed = false;
    pins = [];
    pinSeq = 0;
    renderBar();
    loadEditFrame();
  }

  async function exitEdit() {
    if (saveTimer) await doSave();
    mode = 'view';
    pins = [];
    renderBar();
    frame.srcdoc = compileDeckHTML(model);   // pure document, no editor layer
  }

  /* Messages from the deck document. */
  const onMsg = (e) => {
    const d = e?.data || {};
    if (d.type === 'cocher-deck-exit') {
      if (mode === 'edit') exitEdit(); else goBack();
    } else if (d.type === 'cocher-deck-edit' && mode === 'edit' && model) {
      if (setByPath(model, d.path, d.text)) scheduleSave();
    } else if (d.type === 'cocher-deck-pin' && mode === 'edit') {
      const n = ++pinSeq;
      pins.push({ n, path: d.path, label: d.label || '', text: '' });
      post({ type: 'cocher-ed-pin-add', n, path: d.path });
      renderTray();
      tray.querySelector(`.dv-pin-row[data-n="${n}"] .dv-pin-input`)?.focus();
    }
  };
  window.addEventListener('message', onMsg);

  renderBar();

  (async () => {
    const html = await getMediaContent(id);
    if (typeof html !== 'string' || !html) {
      showToast('Deck content not found on this device.', 'danger');
      goBack();
      return;
    }
    if (mode === 'view') frame.srcdoc = html;   // don't clobber an already-entered edit session
  })();

  // Router cleanup: drop the listener; flush any uncommitted edit (best-effort).
  return () => {
    window.removeEventListener('message', onMsg);
    if (saveTimer && model) doSave();
  };
}
