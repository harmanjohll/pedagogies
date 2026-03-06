/* ============================================================
   LabSim Guided Tutorial Overlay
   Step-by-step walkthrough tooltips for first-time visitors
   ============================================================ */
var LabTutorial = (function () {
  'use strict';

  var STORAGE_PREFIX = 'labsim_tutorial_';

  function create(config) {
    var practicalId = config.id;
    var steps = config.steps; /* [{target, title, text, position}] */
    var currentStep = 0;
    var overlay = null;
    var tooltip = null;
    var active = false;

    /* Check if already dismissed */
    function wasSeen() {
      try { return localStorage.getItem(STORAGE_PREFIX + practicalId) === '1'; } catch (e) { return false; }
    }

    function markSeen() {
      try { localStorage.setItem(STORAGE_PREFIX + practicalId, '1'); } catch (e) { /* ignore */ }
    }

    function build() {
      overlay = document.createElement('div');
      overlay.className = 'tutorial-overlay';
      overlay.innerHTML =
        '<div class="tutorial-backdrop"></div>' +
        '<div class="tutorial-tooltip">' +
          '<div class="tutorial-step-num"></div>' +
          '<div class="tutorial-title"></div>' +
          '<div class="tutorial-text"></div>' +
          '<div class="tutorial-actions">' +
            '<button class="btn btn-ghost btn-sm tutorial-skip">Skip</button>' +
            '<button class="btn btn-primary btn-sm tutorial-next">Next</button>' +
          '</div>' +
        '</div>';

      tooltip = overlay.querySelector('.tutorial-tooltip');
      overlay.querySelector('.tutorial-skip').addEventListener('click', dismiss);
      overlay.querySelector('.tutorial-next').addEventListener('click', next);
      overlay.querySelector('.tutorial-backdrop').addEventListener('click', dismiss);
      document.body.appendChild(overlay);
    }

    function positionTooltip(step) {
      var el = document.querySelector(step.target);
      if (!el) {
        /* Target not found, skip */
        tooltip.style.top = '50%';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translate(-50%, -50%)';
        return;
      }

      var rect = el.getBoundingClientRect();
      var pos = step.position || 'bottom';

      /* Highlight the target */
      el.style.position = el.style.position || 'relative';
      el.style.zIndex = '10001';
      el.style.boxShadow = '0 0 0 4px rgba(67, 97, 238, 0.4), 0 0 0 9999px rgba(0, 0, 0, 0.4)';
      el.dataset.origBorderRadius = el.style.borderRadius || '';
      el.style.borderRadius = el.style.borderRadius || '8px';

      /* Reset tooltip positioning */
      tooltip.style.transform = '';
      tooltip.style.maxWidth = '320px';

      var gap = 12;
      if (pos === 'bottom') {
        tooltip.style.top = (rect.bottom + gap + window.scrollY) + 'px';
        tooltip.style.left = (rect.left + rect.width / 2) + 'px';
        tooltip.style.transform = 'translateX(-50%)';
      } else if (pos === 'top') {
        tooltip.style.top = (rect.top - gap + window.scrollY) + 'px';
        tooltip.style.left = (rect.left + rect.width / 2) + 'px';
        tooltip.style.transform = 'translate(-50%, -100%)';
      } else if (pos === 'right') {
        tooltip.style.top = (rect.top + rect.height / 2 + window.scrollY) + 'px';
        tooltip.style.left = (rect.right + gap) + 'px';
        tooltip.style.transform = 'translateY(-50%)';
      } else if (pos === 'left') {
        tooltip.style.top = (rect.top + rect.height / 2 + window.scrollY) + 'px';
        tooltip.style.left = (rect.left - gap) + 'px';
        tooltip.style.transform = 'translate(-100%, -50%)';
      }
    }

    function showStep(idx) {
      if (idx >= steps.length) { dismiss(); return; }
      currentStep = idx;
      var step = steps[idx];

      /* Clear previous highlights */
      clearHighlights();

      overlay.querySelector('.tutorial-step-num').textContent = 'Step ' + (idx + 1) + ' of ' + steps.length;
      overlay.querySelector('.tutorial-title').textContent = step.title;
      overlay.querySelector('.tutorial-text').textContent = step.text;

      var nextBtn = overlay.querySelector('.tutorial-next');
      nextBtn.textContent = idx === steps.length - 1 ? 'Got it!' : 'Next';

      positionTooltip(step);
    }

    function clearHighlights() {
      var highlighted = document.querySelectorAll('[style*="10001"]');
      for (var i = 0; i < highlighted.length; i++) {
        highlighted[i].style.zIndex = '';
        highlighted[i].style.boxShadow = '';
        highlighted[i].style.borderRadius = highlighted[i].dataset.origBorderRadius || '';
        delete highlighted[i].dataset.origBorderRadius;
      }
    }

    function next() {
      showStep(currentStep + 1);
    }

    function dismiss() {
      clearHighlights();
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      active = false;
      markSeen();
    }

    function start() {
      if (active) return;
      active = true;
      build();
      showStep(0);
    }

    function autoStart() {
      if (!wasSeen()) {
        setTimeout(start, 600);
      }
    }

    return { start: start, autoStart: autoStart, dismiss: dismiss, reset: function () {
      try { localStorage.removeItem(STORAGE_PREFIX + practicalId); } catch (e) { /* ignore */ }
    }};
  }

  return { create: create };
})();
