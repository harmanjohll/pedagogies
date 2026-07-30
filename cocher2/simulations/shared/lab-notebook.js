/* ============================================================
   LabSim — Procedural Metacognition Notebook
   A guided reflection tool that helps students develop
   process knowledge by noting what they did well, what needs
   work, and what to watch for next time in the lab.

   Rendered as a floating pull-up panel with a visible toggle
   button so it is always accessible regardless of scroll
   position.  Entries persist in localStorage per practical.
   ============================================================ */
var LabNotebook = (function () {
  'use strict';

  var STORAGE_KEY = 'labsim_notebook';
  var notebook = {};
  var isOpen = false;
  var overlay = null;
  var fab = null;

  /* ── Persistence ── */

  function load() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) notebook = JSON.parse(saved);
    } catch (e) { /* ignore */ }
    if (!notebook || typeof notebook !== 'object') notebook = {};
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notebook));
    } catch (e) { /* ignore */ }
  }

  function getEntry(practicalId) {
    return notebook[practicalId] || {
      strengths: '',
      improvements: '',
      watchouts: '',
      notes: '',
      timestamp: null
    };
  }

  function saveEntry(practicalId, entry) {
    notebook[practicalId] = {
      strengths: entry.strengths || '',
      improvements: entry.improvements || '',
      watchouts: entry.watchouts || '',
      notes: entry.notes || '',
      timestamp: new Date().toISOString()
    };
    save();
  }

  /* ── Helpers ── */

  function esc(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Build floating panel ── */

  function buildOverlay(practicalId) {
    var entry = getEntry(practicalId);

    /* Backdrop — clicking it closes the panel */
    var wrapper = document.createElement('div');
    wrapper.className = 'nb-overlay';
    wrapper.id = 'nb-overlay';

    var backdrop = document.createElement('div');
    backdrop.className = 'nb-backdrop';
    backdrop.addEventListener('click', function () { togglePanel(); });
    wrapper.appendChild(backdrop);

    /* Panel container */
    var panel = document.createElement('div');
    panel.className = 'nb-panel';

    panel.innerHTML =
      '<div class="nb-panel-header">' +
        '<div class="nb-panel-title">' +
          '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">' +
            '<path d="M1 3.5A1.5 1.5 0 012.5 2h9A1.5 1.5 0 0113 3.5v9a1.5 ' +
            '1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 12.5v-9zM2.5 3a.5.5 0 ' +
            '00-.5.5v9a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5h-9z"/>' +
            '<path d="M3.5 6h5a.5.5 0 010 1h-5a.5.5 0 010-1zm0 2h5a.5.5 ' +
            '0 010 1h-5a.5.5 0 010-1zm0 2h3a.5.5 0 010 1h-3a.5.5 0 010-1z"/>' +
          '</svg>' +
          ' Lab Notebook' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm nb-close-btn" type="button" aria-label="Close notebook">' +
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">' +
            '<path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="nb-panel-body">' +
        '<p class="notebook-intro">Reflect on your practical skills. This helps build confidence and awareness for real lab work.</p>' +

        '<div class="notebook-section">' +
          '<label class="notebook-label nb-label-good">' +
            '<span class="nb-dot nb-dot-good"></span> What I did well' +
          '</label>' +
          '<p class="notebook-hint">Which procedural steps did you perform confidently? ' +
            '(e.g. careful measurements, correct safety precautions, systematic recording)</p>' +
          '<textarea class="notebook-textarea" data-nb-field="strengths" rows="2" ' +
            'placeholder="I was careful to\u2026">' + esc(entry.strengths) + '</textarea>' +
        '</div>' +

        '<div class="notebook-section">' +
          '<label class="notebook-label nb-label-improve">' +
            '<span class="nb-dot nb-dot-improve"></span> What I need to improve' +
          '</label>' +
          '<p class="notebook-hint">Which steps were tricky? Where did you hesitate or make errors?</p>' +
          '<textarea class="notebook-textarea" data-nb-field="improvements" rows="2" ' +
            'placeholder="I found it difficult to\u2026">' + esc(entry.improvements) + '</textarea>' +
        '</div>' +

        '<div class="notebook-section">' +
          '<label class="notebook-label nb-label-watch">' +
            '<span class="nb-dot nb-dot-watch"></span> Watch out for next time' +
          '</label>' +
          '<p class="notebook-hint">What will you remember for the next time you are in the lab?</p>' +
          '<textarea class="notebook-textarea" data-nb-field="watchouts" rows="2" ' +
            'placeholder="Next time I will\u2026">' + esc(entry.watchouts) + '</textarea>' +
        '</div>' +

        '<div class="notebook-section">' +
          '<label class="notebook-label">Other observations</label>' +
          '<textarea class="notebook-textarea" data-nb-field="notes" rows="2" ' +
            'placeholder="Anything else I noticed\u2026">' + esc(entry.notes) + '</textarea>' +
        '</div>' +

        '<div class="notebook-footer">' +
          '<button class="btn btn-primary btn-sm nb-save-btn" type="button">Save Reflections</button>' +
          '<span class="nb-saved-msg" style="display:none;">Saved</span>' +
        '</div>' +
      '</div>';

    wrapper.appendChild(panel);

    /* ── Bind events ── */

    var closeBtn = panel.querySelector('.nb-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { togglePanel(); });
    }

    var saveBtn = panel.querySelector('.nb-save-btn');
    var savedMsg = panel.querySelector('.nb-saved-msg');

    function collectAndSave() {
      var fields = panel.querySelectorAll('[data-nb-field]');
      var data = {};
      for (var i = 0; i < fields.length; i++) {
        data[fields[i].getAttribute('data-nb-field')] = fields[i].value.trim();
      }
      saveEntry(practicalId, data);

      if (savedMsg) {
        savedMsg.style.display = '';
        savedMsg.classList.add('nb-fade-in');
        setTimeout(function () {
          savedMsg.style.display = 'none';
          savedMsg.classList.remove('nb-fade-in');
        }, 2000);
      }
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', collectAndSave);
    }

    /* Auto-save on input (debounced 1.5 s) */
    var debounce;
    var textareas = panel.querySelectorAll('.notebook-textarea');
    for (var t = 0; t < textareas.length; t++) {
      textareas[t].addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(collectAndSave, 1500);
      });
    }

    return wrapper;
  }

  /* ── Floating action button ── */

  function buildFAB() {
    var btn = document.createElement('button');
    btn.className = 'nb-fab';
    btn.id = 'nb-fab';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open Lab Notebook');
    btn.title = 'Lab Notebook';
    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">' +
        '<path d="M1 3.5A1.5 1.5 0 012.5 2h9A1.5 1.5 0 0113 3.5v9a1.5 ' +
        '1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 12.5v-9zM2.5 3a.5.5 0 ' +
        '00-.5.5v9a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5h-9z"/>' +
        '<path d="M3.5 6h5a.5.5 0 010 1h-5a.5.5 0 010-1zm0 2h5a.5.5 ' +
        '0 010 1h-5a.5.5 0 010-1zm0 2h3a.5.5 0 010 1h-3a.5.5 0 010-1z"/>' +
      '</svg>' +
      '<span class="nb-fab-label">Notebook</span>';

    btn.addEventListener('click', function () { togglePanel(); });
    return btn;
  }

  /* ── Toggle ── */

  function togglePanel() {
    isOpen = !isOpen;
    if (overlay) {
      overlay.classList.toggle('nb-open', isOpen);
    }
    if (fab) {
      fab.classList.toggle('nb-fab-active', isOpen);
    }
  }

  /* ── Auto-inject on DOMContentLoaded ── */

  document.addEventListener('DOMContentLoaded', function () {
    /* Find the first notebook slot to get the practical ID */
    var slots = document.querySelectorAll('.lab-notebook-slot');
    if (slots.length === 0) return;

    var pid = null;
    for (var i = 0; i < slots.length; i++) {
      var p = slots[i].getAttribute('data-practical');
      if (p) { pid = p; break; }
    }
    if (!pid) return;

    /* Hide slot elements (no longer needed for inline display) */
    for (var j = 0; j < slots.length; j++) {
      slots[j].style.display = 'none';
    }

    /* Build and attach the floating panel + FAB */
    overlay = buildOverlay(pid);
    document.body.appendChild(overlay);

    fab = buildFAB();
    document.body.appendChild(fab);
  });

  load();

  return {
    getEntry: getEntry,
    saveEntry: saveEntry,
    toggle: togglePanel
  };
})();
