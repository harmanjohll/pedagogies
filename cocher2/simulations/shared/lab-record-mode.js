/* ============================================================
   LabSim Recording Mode Toggle
   Switches between Guided (auto-record) and Independent
   (student manually records) data collection modes.
   ============================================================ */
var LabRecordMode = (function () {
  'use strict';

  var STORAGE_KEY = 'labsim_record_mode';
  var mode = 'guided'; // 'guided' | 'independent'
  var listeners = [];

  function load() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'guided' || saved === 'independent') mode = saved;
    } catch (e) { /* ignore */ }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) { /* ignore */ }
  }

  function set(newMode) {
    if (newMode !== 'guided' && newMode !== 'independent') return;
    mode = newMode;
    save();
    updateToggles();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](mode); } catch (e) { /* ignore */ }
    }
  }

  function toggle() {
    set(mode === 'guided' ? 'independent' : 'guided');
  }

  function current() {
    return mode;
  }

  function isGuided() {
    return mode === 'guided';
  }

  /** Register a callback for mode changes */
  function onChange(fn) {
    listeners.push(fn);
  }

  /** Update all toggle UI elements on the page */
  function updateToggles() {
    var toggles = document.querySelectorAll('.record-mode-toggle');
    for (var i = 0; i < toggles.length; i++) {
      var t = toggles[i];
      var track = t.querySelector('.record-toggle-track');
      var label = t.querySelector('.record-toggle-label');
      if (track) {
        if (mode === 'independent') {
          track.classList.add('active');
        } else {
          track.classList.remove('active');
        }
      }
      if (label) {
        label.textContent = mode === 'guided' ? 'Guided' : 'Independent';
      }
    }
  }

  /**
   * Inject the toggle into a container element.
   * @param {HTMLElement|string} container - element or selector
   */
  function inject(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'record-mode-toggle';
    wrapper.title = 'Guided: data auto-records. Independent: you record readings manually.';

    var labelLeft = document.createElement('span');
    labelLeft.className = 'record-toggle-hint';
    labelLeft.textContent = 'Recording:';

    var track = document.createElement('button');
    track.type = 'button';
    track.className = 'record-toggle-track' + (mode === 'independent' ? ' active' : '');
    track.setAttribute('role', 'switch');
    track.setAttribute('aria-checked', mode === 'independent' ? 'true' : 'false');
    track.setAttribute('aria-label', 'Toggle between guided and independent recording');

    var thumb = document.createElement('span');
    thumb.className = 'record-toggle-thumb';
    track.appendChild(thumb);

    var label = document.createElement('span');
    label.className = 'record-toggle-label';
    label.textContent = mode === 'guided' ? 'Guided' : 'Independent';

    track.addEventListener('click', function () {
      toggle();
      track.setAttribute('aria-checked', mode === 'independent' ? 'true' : 'false');
    });

    wrapper.appendChild(labelLeft);
    wrapper.appendChild(track);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
  }

  load();

  return {
    current: current,
    isGuided: isGuided,
    set: set,
    toggle: toggle,
    onChange: onChange,
    inject: inject
  };
})();
