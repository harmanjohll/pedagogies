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

import { getMediaContent, listDeckMeta, getDeckModel, updateDeckMaterial, revertDeckMaterial, compileDeckHTML, DECK_STYLES, schoolDeckLook } from '../utils/deck.js';
import { downloadDeckPptx } from '../utils/deck-pptx.js';
import { Store } from '../state.js';
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
  let cur = 0;               // the slide showing (the deck tells us)
  let scope = 'slide';       // talk to edit: this slide, or the whole deck

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
        /* The editing workspace: slides down the side, the slide in the middle, "tell Co-Cher" beneath it. */
        #dv-work { flex:1; min-height:0; display:flex; }
        #dv-stage { flex:1; min-width:0; display:flex; flex-direction:column; }
        #dv-strip { display:none; width:216px; flex-shrink:0; overflow-y:auto; background:#12122a; border-right:1px solid rgba(255,255,255,0.08); padding:8px; color:#fff; }
        .dv-th { display:flex; gap:8px; align-items:flex-start; width:100%; text-align:left; font:inherit; color:#e5e7fb; background:transparent; border:1px solid transparent; border-radius:8px; padding:8px; cursor:pointer; min-height:44px; }
        .dv-th:hover { background:rgba(255,255,255,0.06); }
        .dv-th[aria-current="true"] { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.35); }
        .dv-th i { font-style:normal; font-size:.72rem; color:#a5b4fc; min-width:1.4em; font-variant-numeric:tabular-nums; }
        .dv-th b { display:block; font-weight:600; font-size:.8125rem; line-height:1.3; }
        .dv-th small { display:block; font-size:.7rem; color:#a5b4fc; }
        .dv-ops { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; margin:4px 0 8px; }
        .dv-ops button, #dv-add { font:inherit; font-size:.75rem; color:#fff; background:none; border:1px solid rgba(255,255,255,0.25); border-radius:6px; min-height:32px; cursor:pointer; }
        .dv-ops button:hover, #dv-add:hover { border-color:rgba(255,255,255,0.6); }
        .dv-ops button:disabled { opacity:.35; cursor:default; }
        #dv-add { width:100%; margin-top:4px; }
        #dv-talk { display:none; flex-shrink:0; background:#181834; color:#fff; padding:8px 14px 10px; border-top:1px solid rgba(255,255,255,0.08); }
        #dv-talk .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        #dv-say { flex:1 1 260px; min-width:0; font:inherit; font-size:.875rem; padding:9px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.08); color:#fff; }
        #dv-say::placeholder { color:rgba(255,255,255,0.55); }
        #dv-talk select, #dv-talk button { font:inherit; font-size:.8125rem; color:#fff; background:none; border:1px solid rgba(255,255,255,0.25); border-radius:8px; padding:6px 12px; min-height:36px; cursor:pointer; }
        #dv-talk select option { color:#111; }
        #dv-go { background:#fff !important; color:#12122a !important; font-weight:700; border-color:#fff !important; }
        #dv-go:disabled { opacity:.5; cursor:default; }
        .dv-quick { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
        .dv-quick button { font-size:.75rem !important; padding:4px 10px !important; min-height:30px !important; color:#c7d2fe !important; }
        @media (max-width:720px) {
          #dv-strip { width:100%; max-height:26vh; border-right:0; border-bottom:1px solid rgba(255,255,255,0.08); }
          #dv-work { flex-direction:column; }
          #dv-bar { gap:6px; padding:6px 8px; }
          #dv-bar button { min-height:40px; padding:6px 12px; }
          #dv-title { display:none; }
          .dv-pin-label { max-width:120px; }
          .dv-pin-x { min-height:40px; }
        }
      </style>
      <div id="dv-bar"></div>
      <div id="dv-tray"></div>
      <div id="dv-work"><div id="dv-strip"></div><div id="dv-stage">
      <iframe id="deck-viewer-frame" title="${escapeHtml(meta?.title || 'Slide deck')}"
        style="flex:1;min-height:0;border:none;width:100%;background:#fff;"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
      <div id="dv-talk"></div>
      </div></div>
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
        ${meta?.hasModel ? `<button id="dv-edit" title="Change slides by typing, by telling Co-Cher, or by moving them">Edit with Co-Cher</button>
        <button id="dv-pptx" title="Download as an editable PowerPoint file">PowerPoint</button>` : ''}
        <button id="dv-close">&times; Close</button>`;
      bar.querySelector('#dv-close').addEventListener('click', goBack);
      bar.querySelector('#dv-edit')?.addEventListener('click', enterEdit);
      bar.querySelector('#dv-pptx')?.addEventListener('click', toPowerPoint);
      tray.style.display = 'none';
      container.querySelector('#dv-strip').style.display = 'none';
      container.querySelector('#dv-talk').style.display = 'none';
    } else {
      bar.innerHTML = `
        <button id="dv-prev" title="Previous slide">&#8249;</button>
        <button id="dv-next" title="Next slide">&#8250;</button>
        <span id="dv-title" style="font-weight:600;font-size:0.8125rem;color:#c7d2fe;">Editing — tap text on a slide to change it</span>
        <span id="dv-status" style="flex:1;"></span>
        <button id="dv-brush" aria-pressed="false" title="Magic AI brush — tap what should change, describe the change, Apply once">&#128396;&#65039; AI brush</button>
        <button id="dv-apply" style="display:none;">&#10024; Apply</button>
        <select id="dv-style" title="The look of this deck" style="font:inherit;font-size:0.8125rem;background:none;color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:8px;padding:4px 8px;min-height:32px;">
          ${DECK_STYLES.map(x => `<option value="${x.id}" style="color:#111;"${(model?.style || 'classic') === x.id ? ' selected' : ''}>Look: ${x.label}</option>`).join('')}</select>
        ${planOf() ? `<button id="dv-sync" title="The lesson plan has changed? Update only the slides it affects">Update from plan</button>` : ''}
        <button id="dv-pptx" title="Download as an editable PowerPoint file">PowerPoint</button>
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
      bar.querySelector('#dv-pptx').addEventListener('click', toPowerPoint);
      bar.querySelector('#dv-sync')?.addEventListener('click', updateFromPlan);
      bar.querySelector('#dv-style').addEventListener('change', async (e) => {
        model.style = e.target.value;
        if (model.style !== 'classic' && !model.theme) model.theme = (await schoolDeckLook()).theme;
        await doSave(); loadEditFrame(); flashStatus('Look changed');
      });
      renderTray();
      renderStrip();
      renderTalk();
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
    cur = Math.max(0, Math.min((model?.slides?.length || 1) - 1, cur));
    frame.onload = () => { post({ type: 'cocher-deck-goto', i: cur }); };
    frame.srcdoc = instrument(compileDeckHTML(model));
    renderStrip();
  }

  /* An AI edit returns slides only; the deck's look and colours stay as they were. */
  const keepLook = (d) => { if (model?.style) d.style = model.style; if (model?.theme) d.theme = model.theme; return d; };
  /* The lesson this deck belongs to, if it still holds a plan. */
  function planOf() {
    const l = meta?.lessonId ? Store.getLesson(meta.lessonId) : null;
    const text = l ? (l.plan || (l.chatHistory || []).filter(m => m.role === 'assistant').map(m => m.content).join('\n\n')) : '';
    return text && text.trim().length > 40 ? text : '';
  }
  const slideName = (sl, i) => String(sl?.title || sl?.statement || sl?.quote || `Slide ${i + 1}`).slice(0, 60);

  /* ── The slide strip: see them all; move, copy, add, remove ── */
  function renderStrip() {
    const strip = container.querySelector('#dv-strip');
    if (mode !== 'edit' || !model) { strip.style.display = 'none'; return; }
    strip.style.display = 'block';
    const n = model.slides.length;
    strip.innerHTML = model.slides.map((sl, i) => `<button class="dv-th" data-go="${i}" aria-current="${i === cur}"><i>${i + 1}</i><span><b>${escapeHtml(slideName(sl, i))}</b><small>${escapeHtml(sl?.layout || 'bullets')}</small></span></button>
      ${i === cur ? `<div class="dv-ops"><button data-op="up" title="Move up"${i === 0 ? ' disabled' : ''}>&uarr;</button><button data-op="down" title="Move down"${i === n - 1 ? ' disabled' : ''}>&darr;</button><button data-op="copy" title="Duplicate this slide">Copy</button><button data-op="del" title="Delete this slide"${n <= 2 ? ' disabled' : ''}>Del</button></div>` : ''}`).join('')
      + `<button id="dv-add" title="Add a blank slide after this one">+ Add a slide</button>`;
    strip.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { cur = +b.dataset.go; post({ type: 'cocher-deck-goto', i: cur }); renderStrip(); renderTalk(); }));
    strip.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => slideOp(b.dataset.op)));
    strip.querySelector('#dv-add').addEventListener('click', () => slideOp('add'));
    strip.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  async function slideOp(op) {
    if (busy || !model) return;
    const a = model.slides, i = cur;
    if (op === 'up' && i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; cur = i - 1; }
    else if (op === 'down' && i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; cur = i + 1; }
    else if (op === 'copy') { a.splice(i + 1, 0, JSON.parse(JSON.stringify(a[i]))); cur = i + 1; }
    else if (op === 'del' && a.length > 2) { a.splice(i, 1); cur = Math.min(i, a.length - 1); }
    else if (op === 'add') { a.splice(i + 1, 0, { layout: 'bullets', title: 'New slide', bullets: ['Tap to write, or tell Co-Cher what this slide is for'] }); cur = i + 1; }
    else return;
    pins = []; renderTray();
    await doSave(); loadEditFrame(); renderTalk();
  }

  /* ── Tell Co-Cher: change a slide, or the deck, in plain words ── */
  const QUICK = ['Shorter', 'Simpler words', 'Add an example', 'Turn it into a question', 'Add a quick check'];
  function renderTalk() {
    const el = container.querySelector('#dv-talk');
    if (mode !== 'edit' || !model) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    const keep = el.querySelector('#dv-say')?.value || '';
    el.innerHTML = `<div class="row">
        <select id="dv-scope" aria-label="What to change"><option value="slide"${scope === 'slide' ? ' selected' : ''}>This slide (${cur + 1})</option><option value="deck"${scope === 'deck' ? ' selected' : ''}>The whole deck</option></select>
        <input id="dv-say" type="text" autocomplete="off" placeholder="Tell Co-Cher what to change, in your own words" ${busy ? 'disabled' : ''}>
        <button id="dv-go" ${busy ? 'disabled' : ''}>${busy ? 'Working…' : 'Change it'}</button>
      </div>
      <div class="dv-quick">${QUICK.map(t => `<button data-quick="${escapeHtml(t)}" ${busy ? 'disabled' : ''}>${escapeHtml(t)}</button>`).join('')}</div>`;
    const say = el.querySelector('#dv-say'); say.value = keep;
    el.querySelector('#dv-scope').addEventListener('change', (e) => { scope = e.target.value; });
    el.querySelector('#dv-go').addEventListener('click', () => tell(say.value));
    say.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tell(say.value); } e.stopPropagation(); });
    el.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => tell(b.dataset.quick)));
  }
  async function tell(words, whole = scope === 'deck', done = '') {
    const instruction = String(words || '').trim();
    if (busy || !model) return;
    if (!instruction) { flashStatus('Say what should change first.', true); return; }
    if (saveTimer) await doSave();
    busy = true; renderTalk(); flashStatus('Co-Cher is changing it…');
    try {
      const before = model.slides.map(x => JSON.stringify(x));
      const edit = whole ? { path: '', anchor: '', instruction } : { path: String(cur), anchor: slideName(model.slides[cur], cur), instruction };
      model = keepLook(await editDeck({ deck: model, edits: [edit] }));
      const changed = model.slides.filter((x, i) => JSON.stringify(x) !== before[i]).length + Math.abs(model.slides.length - before.length);
      busy = false;
      await doSave(); loadEditFrame(); renderBar();
      const say = container.querySelector('#dv-say'); if (say) say.value = '';
      flashStatus(done || `Changed ${changed} slide${changed === 1 ? '' : 's'}. Revert brings the old version back.`);
    } catch (err) {
      busy = false; renderTalk();
      flashStatus(err?.message || 'That change did not work. Please try again.', true);
    }
  }
  function updateFromPlan() {
    const plan = planOf(); if (!plan) return;
    tell(`The lesson plan has changed. Bring the deck in line with it. Change ONLY the slides the new plan affects, add or remove a slide only if the plan now needs it, and leave every other slide exactly as it is. The new plan:\n${plan.slice(0, 6000)}`, true, 'Deck brought in line with the plan. Revert brings the old version back.');
  }
  async function toPowerPoint() {
    try {
      flashStatus('Making the PowerPoint file…');
      const d = model || await getDeckModel(id);
      if (!d) { showToast('This deck has no slide model to export. Regenerate it in the Lesson Planner.', 'warning'); return; }
      await downloadDeckPptx(d);
      flashStatus('PowerPoint file saved');
    } catch (err) { showToast(err?.message || 'Could not make the PowerPoint file.', 'danger'); flashStatus(''); }
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
      model = keepLook(updated);
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
    frame.onload = null;
    frame.srcdoc = compileDeckHTML(model);   // pure document, no editor layer
  }

  /* Messages from the deck document. */
  const onMsg = (e) => {
    const d = e?.data || {};
    if (d.type === 'cocher-deck-slide') {
      if (mode === 'edit' && Number.isInteger(d.i) && d.i !== cur) { cur = d.i; renderStrip(); renderTalk(); }
    } else if (d.type === 'cocher-deck-exit') {
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
