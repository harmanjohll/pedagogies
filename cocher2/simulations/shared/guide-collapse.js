/* ============================================================
   LabSim — Guide Panel Compact / Collapse
   When the guide toggle is clicked, the guide panel enters
   "compact mode": verbose procedure text is hidden but
   interactive controls (sliders, selectors, action buttons)
   remain visible and accessible. The grid column narrows
   to fit just the controls.
   ============================================================ */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.getElementById('guide-panel');
    if (!panel) return;

    var layout = panel.parentElement;
    if (!layout) return;

    /* Capture original grid columns for restoration */
    var origCols = getComputedStyle(layout).gridTemplateColumns;
    var tracks = origCols.split(/\s+/);
    if (tracks.length < 2) return;

    /* Build compact and collapsed column definitions */
    var dataTracks = tracks.slice(2).join(' ');
    var compactCols = dataTracks ? 'auto 1fr ' + dataTracks : 'auto 1fr';
    var collapsedCols = dataTracks ? '0px 1fr ' + dataTracks : '0px 1fr';

    /* Find the toggle button (two naming conventions) */
    var btn = document.getElementById('btn-toggle-guide')
           || document.getElementById('btn-guide');
    if (!btn) return;

    /* Detect whether the guide has interactive content
       (controls, action buttons, etc.) that should stay visible */
    var hasControls = panel.querySelector(
      'input, select, textarea, .config-section, .config-row'
    );
    var hasGuideActions = panel.querySelector(
      '.guide-step-actions, [id="guide-actions"]'
    );
    var hasInteractive = !!(hasControls || hasGuideActions);

    /* Mark text-only panels: panels with no interactive elements
       and no procedure list (procedure steps may have action buttons) */
    var guidePanels = panel.querySelectorAll('.panel');
    for (var i = 0; i < guidePanels.length; i++) {
      var p = guidePanels[i];
      var panelHasControls = p.querySelector(
        'input, select, textarea, .guide-step-actions, ' +
        '[role="radio"], [data-action], .config-row'
      );
      var panelHasProcedure = p.querySelector(
        '.procedure-list, .procedure-step'
      );
      if (!panelHasControls && !panelHasProcedure) {
        p.classList.add('guide-text-panel');
      }
    }

    /* ── State ── */
    var compact = false;

    /* Override existing toggle handlers in capture phase.
       This runs BEFORE practical-specific handlers, preventing
       the old display:none approach. Instead we toggle compact mode
       so controls remain accessible. */
    btn.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();

      compact = !compact;

      if (compact) {
        panel.classList.add('guide-compact');
        layout.classList.add('guide-compact-layout');
        /* Ensure panel stays visible */
        panel.style.display = '';

        if (hasInteractive) {
          layout.style.gridTemplateColumns = compactCols;
        } else {
          /* No controls to show — fully collapse */
          layout.style.gridTemplateColumns = collapsedCols;
          panel.classList.add('guide-fully-collapsed');
        }
      } else {
        panel.classList.remove('guide-compact');
        panel.classList.remove('guide-fully-collapsed');
        layout.classList.remove('guide-compact-layout');
        panel.style.display = '';
        layout.style.gridTemplateColumns = '';
      }

      /* Update button visual state */
      btn.classList.toggle('active', compact);
      if (btn.getAttribute('aria-expanded') !== null) {
        btn.setAttribute('aria-expanded', String(!compact));
      }

      /* Notify canvases to resize */
      setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
      }, 60);
    }, true); /* capture phase */

    /* Watch for external display changes (e.g., reset handlers).
       If something tries to hide the panel while in compact mode
       with interactive content, force it visible. */
    var observer = new MutationObserver(function () {
      if (compact && panel.style.display === 'none' && hasInteractive) {
        panel.style.display = '';
      }
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['style'] });
  });
})();
