/* ============================================================
   LabSim Dark Mode Toggle
   Adds a theme switcher that persists via localStorage
   ============================================================ */
var LabTheme = (function () {
  'use strict';

  var STORAGE_KEY = 'labsim_theme';
  var currentTheme = 'light';

  function apply(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }

    /* Update any toggle buttons */
    var btns = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
      btns[i].setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function toggle() {
    apply(currentTheme === 'dark' ? 'light' : 'dark');
  }

  function init() {
    /* Check saved preference, then system preference */
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }

    if (saved === 'dark' || saved === 'light') {
      apply(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      apply('dark');
    } else {
      apply('light');
    }

    /* Auto-inject toggle button into topbar if one exists */
    var topbar = document.querySelector('.topbar-inner') || document.querySelector('.topbar');
    if (topbar && !topbar.querySelector('.theme-toggle')) {
      var btn = document.createElement('button');
      btn.className = 'theme-toggle';
      btn.type = 'button';
      btn.style.cssText = 'margin-left:auto;background:none;border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:4px 8px;cursor:pointer;font-size:1rem;line-height:1;';
      btn.addEventListener('click', toggle);
      topbar.appendChild(btn);
      /* Set initial label */
      btn.textContent = currentTheme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
      btn.setAttribute('aria-label', currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  /* Init when DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { toggle: toggle, apply: apply, current: function () { return currentTheme; } };
})();
