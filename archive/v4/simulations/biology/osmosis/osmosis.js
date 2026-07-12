/* Osmosis practical – potato chip experiment */
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };

  /* ── Configuration ── */
  var CONCENTRATIONS = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
  var ISOTONIC_CONC = 0.32; // approximate isotonic point of potato cells
  var BASE_MASS = 2.0;      // grams
  var TIMER_REAL_MS = 6000;  // 6 seconds simulates 30 minutes

  /* ── DOM refs ── */
  var dom = {
    beakersRow:    $('beakers-row'),
    legendChips:   $('legend-chips'),
    btnCut:        $('btn-cut'),
    btnWeighInit:  $('btn-weigh-init'),
    btnPlace:      $('btn-place'),
    btnWait:       $('btn-wait'),
    btnRemove:     $('btn-remove'),
    btnWeighFinal: $('btn-weigh-final'),
    timerBar:      $('timer-bar'),
    timerProgress: $('timer-progress'),
    timerText:     $('timer-text'),
    balanceDisplay: $('balance-display'),
    balanceReading: $('balance-reading'),
    balanceLabel:  $('balance-label'),
    tbody:         $('data-tbody'),
    graphCanvas:   $('graph-canvas'),
    calcPanel:     $('calc-panel'),
    calcIsotonic:  $('calc-isotonic'),
    calcExplanation: $('calc-explanation'),
    btnGuide:      $('btn-guide'),
    btnReset:      $('btn-reset'),
    guidePanel:    $('guide-panel'),
    procList:      $('procedure-list')
  };

  var gctx = dom.graphCanvas.getContext('2d');

  /* ── State ── */
  var state = {
    chips: [],       // { conc, initialMass, finalMass, pctChange, placed, removed }
    phase: 'start',  // start, cut, weighed, placed, waiting, done-wait, removed, final
    weighIndex: 0,
    timerInterval: null,
    procedureDone: {},
    guideOpen: true
  };

  /* ── Build beakers ── */
  function buildBeakers() {
    dom.beakersRow.innerHTML = '';
    dom.legendChips.innerHTML = '';

    CONCENTRATIONS.forEach(function (conc, i) {
      // legend chip
      var chip = document.createElement('span');
      chip.className = 'legend-chip';
      chip.textContent = conc.toFixed(1) + ' M';
      dom.legendChips.appendChild(chip);

      // beaker unit
      var unit = document.createElement('div');
      unit.className = 'beaker-unit';
      unit.setAttribute('data-index', i);

      var label = document.createElement('div');
      label.className = 'beaker-label';
      label.textContent = conc.toFixed(1) + ' M';

      // SVG beaker
      var svgNS = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'beaker-svg');
      svg.setAttribute('viewBox', '0 0 70 100');

      // liquid
      var liquidAlpha = 0.08 + conc * 0.12;
      var liquid = document.createElementNS(svgNS, 'rect');
      liquid.setAttribute('class', 'beaker-liquid');
      liquid.setAttribute('x', '8');
      liquid.setAttribute('y', '30');
      liquid.setAttribute('width', '54');
      liquid.setAttribute('height', '60');
      liquid.setAttribute('rx', '2');
      liquid.setAttribute('fill', 'rgba(150,200,255,' + liquidAlpha + ')');
      svg.appendChild(liquid);

      // potato chip (hidden initially)
      var potato = document.createElementNS(svgNS, 'rect');
      potato.setAttribute('class', 'potato-chip');
      potato.setAttribute('id', 'potato-' + i);
      potato.setAttribute('x', '25');
      potato.setAttribute('y', '55');
      potato.setAttribute('width', '20');
      potato.setAttribute('height', '28');
      potato.setAttribute('rx', '3');
      potato.setAttribute('fill', '#d4a843');
      potato.setAttribute('stroke', '#b8922e');
      potato.setAttribute('stroke-width', '1');
      potato.setAttribute('opacity', '0');
      svg.appendChild(potato);

      // beaker walls
      var walls = document.createElementNS(svgNS, 'path');
      walls.setAttribute('class', 'beaker-wall');
      walls.setAttribute('d', 'M8 20 L8 92 L62 92 L62 20');
      svg.appendChild(walls);

      // concentration label
      var txt = document.createElementNS(svgNS, 'text');
      txt.setAttribute('class', 'beaker-conc');
      txt.setAttribute('x', '35');
      txt.setAttribute('y', '15');
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = conc.toFixed(1) + ' M';
      svg.appendChild(txt);

      unit.appendChild(svg);
      unit.appendChild(label);
      dom.beakersRow.appendChild(unit);
    });
  }

  /* ── Generate chip data ── */
  function generateChips() {
    state.chips = CONCENTRATIONS.map(function (conc) {
      var initial = BASE_MASS + (Math.random() - 0.5) * 0.1; // 1.95–2.05g

      // Percentage change depends on difference from isotonic point
      // Hypotonic (conc < isotonic): water enters → mass increases
      // Hypertonic (conc > isotonic): water leaves → mass decreases
      var diff = conc - ISOTONIC_CONC;
      var pctChange = -diff * 28 + (Math.random() - 0.5) * 2; // ~linear with noise

      var finalMass = initial * (1 + pctChange / 100);
      return {
        conc: conc,
        initialMass: +initial.toFixed(2),
        finalMass: +finalMass.toFixed(2),
        pctChange: +pctChange.toFixed(1),
        placed: false,
        removed: false
      };
    });
  }

  /* ── Button handlers ── */
  dom.btnCut.addEventListener('click', function () {
    generateChips();
    state.phase = 'cut';
    dom.btnCut.disabled = true;
    dom.btnWeighInit.disabled = false;
    markProcedure('cut');
    toast('6 potato cylinders cut to equal size using cork borer.', 'info');
  });

  dom.btnWeighInit.addEventListener('click', function () {
    state.weighIndex = 0;
    dom.balanceDisplay.hidden = false;
    showInitialMass();
  });

  function showInitialMass() {
    if (state.weighIndex >= state.chips.length) {
      state.phase = 'weighed';
      dom.btnWeighInit.disabled = true;
      dom.btnPlace.disabled = false;
      dom.balanceDisplay.hidden = true;
      markProcedure('weigh');
      toast('All initial masses recorded.', 'success');
      populateTable();
      return;
    }
    var c = state.chips[state.weighIndex];
    var guided = (typeof LabRecordMode === 'undefined') || LabRecordMode.isGuided();

    if (guided) {
      dom.balanceReading.textContent = c.initialMass.toFixed(2) + ' g';
    } else {
      dom.balanceReading.textContent = '?.?? g';
    }
    dom.balanceLabel.textContent = 'Cylinder ' + (state.weighIndex + 1)
      + ' (' + c.conc.toFixed(1) + ' M)';

    setTimeout(function () {
      if (!guided) {
        dom.balanceReading.textContent = c.initialMass.toFixed(2) + ' g';
      }
      state.weighIndex++;
      showInitialMass();
    }, guided ? 800 : 1500);
  }

  dom.btnPlace.addEventListener('click', function () {
    state.phase = 'placed';
    dom.btnPlace.disabled = true;
    dom.btnWait.disabled = false;

    // show potato chips in beakers
    state.chips.forEach(function (c, i) {
      c.placed = true;
      var el = document.getElementById('potato-' + i);
      if (el) el.setAttribute('opacity', '1');
    });

    markProcedure('place');
    toast('Cylinders placed in sucrose solutions.', 'info');
  });

  dom.btnWait.addEventListener('click', function () {
    state.phase = 'waiting';
    dom.btnWait.disabled = true;
    dom.timerBar.hidden = false;

    var start = Date.now();
    state.timerInterval = setInterval(function () {
      var elapsed = Date.now() - start;
      var pct = Math.min(elapsed / TIMER_REAL_MS * 100, 100);
      var simMin = Math.floor(pct / 100 * 30);
      var simSec = Math.floor((pct / 100 * 30 - simMin) * 60);
      dom.timerProgress.style.width = pct + '%';
      dom.timerText.textContent = simMin + ':'
        + (simSec < 10 ? '0' : '') + simSec + ' / 30:00';

      if (elapsed >= TIMER_REAL_MS) {
        clearInterval(state.timerInterval);
        state.phase = 'done-wait';
        dom.btnRemove.disabled = false;
        dom.timerText.textContent = '30:00 / 30:00';

        // apply visual changes to chips
        state.chips.forEach(function (c, i) {
          var el = document.getElementById('potato-' + i);
          if (!el) return;
          if (c.pctChange > 3) {
            el.classList.add('swollen');
          } else if (c.pctChange < -3) {
            el.classList.add('shrunk');
          }
        });

        markProcedure('wait');
        toast('30 minutes elapsed. Remove and blot the cylinders.', 'success');
      }
    }, 50);
  });

  dom.btnRemove.addEventListener('click', function () {
    state.phase = 'removed';
    dom.btnRemove.disabled = true;
    dom.btnWeighFinal.disabled = false;

    state.chips.forEach(function (c, i) {
      c.removed = true;
      var el = document.getElementById('potato-' + i);
      if (el) el.setAttribute('opacity', '0.4');
    });

    markProcedure('reweigh');
    toast('Cylinders removed and blotted dry with paper towel.', 'info');
  });

  dom.btnWeighFinal.addEventListener('click', function () {
    state.weighIndex = 0;
    dom.balanceDisplay.hidden = false;
    showFinalMass();
  });

  function showFinalMass() {
    if (state.weighIndex >= state.chips.length) {
      state.phase = 'final';
      dom.btnWeighFinal.disabled = true;
      dom.balanceDisplay.hidden = true;
      toast('All final masses recorded.', 'success');
      updateTable();
      drawGraph();
      calculateIsotonic();
      markProcedure('graph');
      return;
    }
    var c = state.chips[state.weighIndex];
    var guided = (typeof LabRecordMode === 'undefined') || LabRecordMode.isGuided();

    if (guided) {
      dom.balanceReading.textContent = c.finalMass.toFixed(2) + ' g';
    } else {
      dom.balanceReading.textContent = '?.?? g';
    }
    dom.balanceLabel.textContent = 'Cylinder ' + (state.weighIndex + 1)
      + ' (' + c.conc.toFixed(1) + ' M) \u2014 final';

    setTimeout(function () {
      if (!guided) {
        dom.balanceReading.textContent = c.finalMass.toFixed(2) + ' g';
      }
      state.weighIndex++;
      showFinalMass();
    }, guided ? 800 : 1500);
  }

  /* ── Table ── */
  function populateTable() {
    dom.tbody.innerHTML = '';
    state.chips.forEach(function (c) {
      var row = document.createElement('tr');
      row.innerHTML = '<td>' + c.conc.toFixed(1) + '</td>'
        + '<td>' + c.initialMass.toFixed(2) + '</td>'
        + '<td>—</td><td>—</td>';
      dom.tbody.appendChild(row);
    });
  }

  function updateTable() {
    dom.tbody.innerHTML = '';
    var guided = (typeof LabRecordMode === 'undefined') || LabRecordMode.isGuided();

    state.chips.forEach(function (c) {
      var pct = ((c.finalMass - c.initialMass) / c.initialMass * 100).toFixed(1);
      var row = document.createElement('tr');

      if (guided) {
        row.innerHTML = '<td>' + c.conc.toFixed(1) + '</td>'
          + '<td>' + c.initialMass.toFixed(2) + '</td>'
          + '<td>' + c.finalMass.toFixed(2) + '</td>'
          + '<td>' + (pct > 0 ? '+' : '') + pct + '%</td>';
      } else {
        // Independent mode: student must calculate % change
        row.innerHTML = '<td>' + c.conc.toFixed(1) + '</td>'
          + '<td>' + c.initialMass.toFixed(2) + '</td>'
          + '<td>' + c.finalMass.toFixed(2) + '</td>'
          + '<td><input type="text" placeholder="calc %" style="width:60px;text-align:center;border:1px solid var(--color-border);border-radius:4px;padding:2px;font-size:inherit;background:var(--color-surface);color:var(--color-text);" data-expected="' + ((pct > 0 ? '+' : '') + pct) + '"></td>';
      }

      dom.tbody.appendChild(row);
    });
  }

  /* ── Graph: % mass change vs concentration ── */
  function resizeGraph() {
    var gr = dom.graphCanvas.parentElement.getBoundingClientRect();
    dom.graphCanvas.width = gr.width * devicePixelRatio;
    dom.graphCanvas.height = 240 * devicePixelRatio;
    gctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    drawGraph();
  }
  window.addEventListener('resize', resizeGraph);

  function drawGraph() {
    var w = dom.graphCanvas.width / devicePixelRatio;
    var h = 240;
    gctx.clearRect(0, 0, w, h);

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    gctx.fillStyle = isDark ? '#1a1b27' : '#ffffff';
    gctx.fillRect(0, 0, w, h);

    var pad = { top: 20, right: 15, bottom: 40, left: 50 };
    var gw = w - pad.left - pad.right;
    var gh = h - pad.top - pad.bottom;

    var maxConc = 1.1;
    var maxPct = 15;
    var minPct = -20;
    var pctRange = maxPct - minPct;

    // zero line
    var zeroY = pad.top + (maxPct / pctRange) * gh;
    gctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : '#ccc';
    gctx.lineWidth = 0.5;
    gctx.setLineDash([4, 3]);
    gctx.beginPath();
    gctx.moveTo(pad.left, zeroY);
    gctx.lineTo(pad.left + gw, zeroY);
    gctx.stroke();
    gctx.setLineDash([]);

    // axes
    gctx.strokeStyle = isDark ? 'rgba(255,255,255,0.4)' : '#666';
    gctx.lineWidth = 1;
    gctx.beginPath();
    gctx.moveTo(pad.left, pad.top);
    gctx.lineTo(pad.left, pad.top + gh);
    gctx.lineTo(pad.left + gw, pad.top + gh);
    gctx.stroke();

    // labels
    gctx.fillStyle = isDark ? '#9a9dab' : '#666';
    gctx.font = '500 10px Inter, sans-serif';
    gctx.textAlign = 'center';
    gctx.fillText('Sucrose concentration (mol/dm\u00b3)', pad.left + gw / 2, h - 4);
    gctx.save();
    gctx.translate(12, pad.top + gh / 2);
    gctx.rotate(-Math.PI / 2);
    gctx.fillText('% mass change', 0, 0);
    gctx.restore();

    // ticks
    gctx.font = '400 9px Inter, sans-serif';
    gctx.fillStyle = isDark ? '#6b6e7d' : '#999';
    gctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : '#eee';
    gctx.lineWidth = 0.5;

    for (var c = 0; c <= 1.0; c += 0.2) {
      var xp = pad.left + (c / maxConc) * gw;
      gctx.beginPath();
      gctx.moveTo(xp, pad.top);
      gctx.lineTo(xp, pad.top + gh);
      gctx.stroke();
      gctx.textAlign = 'center';
      gctx.fillText(c.toFixed(1), xp, pad.top + gh + 14);
    }

    for (var p = minPct; p <= maxPct; p += 5) {
      var yp = pad.top + ((maxPct - p) / pctRange) * gh;
      gctx.beginPath();
      gctx.moveTo(pad.left, yp);
      gctx.lineTo(pad.left + gw, yp);
      gctx.stroke();
      gctx.textAlign = 'right';
      gctx.fillText((p > 0 ? '+' : '') + p, pad.left - 4, yp + 3);
    }

    if (state.phase !== 'final') return;

    // plot points
    state.chips.forEach(function (c) {
      var pct = (c.finalMass - c.initialMass) / c.initialMass * 100;
      var px = pad.left + (c.conc / maxConc) * gw;
      var py = pad.top + ((maxPct - pct) / pctRange) * gh;
      gctx.beginPath();
      gctx.arc(px, py, 4, 0, Math.PI * 2);
      gctx.fillStyle = '#16a34a';
      gctx.fill();
      gctx.strokeStyle = '#0d7c2e';
      gctx.lineWidth = 1;
      gctx.stroke();
    });

    // best-fit line
    if (state.chips.length >= 2) {
      var n = state.chips.length;
      var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      state.chips.forEach(function (c) {
        var pct = (c.finalMass - c.initialMass) / c.initialMass * 100;
        sumX += c.conc;
        sumY += pct;
        sumXY += c.conc * pct;
        sumXX += c.conc * c.conc;
      });
      var m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      var b = (sumY - m * sumX) / n;

      var x0 = 0, y0 = b;
      var x1 = maxConc, y1 = m * maxConc + b;

      var px0 = pad.left + (x0 / maxConc) * gw;
      var py0 = pad.top + ((maxPct - y0) / pctRange) * gh;
      var px1 = pad.left + (x1 / maxConc) * gw;
      var py1 = pad.top + ((maxPct - y1) / pctRange) * gh;

      gctx.strokeStyle = '#16a34a';
      gctx.lineWidth = 1.5;
      gctx.setLineDash([5, 3]);
      gctx.beginPath();
      gctx.moveTo(px0, py0);
      gctx.lineTo(px1, py1);
      gctx.stroke();
      gctx.setLineDash([]);

      // mark isotonic point (where line crosses 0%)
      var isoConc = -b / m;
      if (isoConc > 0 && isoConc < maxConc) {
        var isoPx = pad.left + (isoConc / maxConc) * gw;
        gctx.beginPath();
        gctx.arc(isoPx, zeroY, 6, 0, Math.PI * 2);
        gctx.strokeStyle = '#e74c3c';
        gctx.lineWidth = 2;
        gctx.stroke();
        gctx.fillStyle = '#e74c3c';
        gctx.font = '500 9px Inter, sans-serif';
        gctx.textAlign = 'center';
        gctx.fillText('Isotonic', isoPx, zeroY - 10);
        gctx.fillText(isoConc.toFixed(2) + ' M', isoPx, zeroY + 18);
      }
    }
  }

  /* ── Calculate isotonic point ── */
  function calculateIsotonic() {
    var n = state.chips.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    state.chips.forEach(function (c) {
      var pct = (c.finalMass - c.initialMass) / c.initialMass * 100;
      sumX += c.conc;
      sumY += pct;
      sumXY += c.conc * pct;
      sumXX += c.conc * c.conc;
    });
    var m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    var b = (sumY - m * sumX) / n;
    var isoConc = -b / m;

    dom.calcPanel.hidden = false;
    dom.calcIsotonic.textContent = isoConc.toFixed(2) + ' mol/dm\u00b3';
    dom.calcExplanation.textContent = 'The isotonic point is where the line crosses 0% mass change. '
      + 'At this concentration, the water potential inside the potato cells equals the water potential '
      + 'of the surrounding solution, so there is no net movement of water by osmosis.';
  }

  /* ── Procedure tracking ── */
  function markProcedure(key) {
    if (state.procedureDone[key]) return;
    state.procedureDone[key] = true;
    var steps = dom.procList.querySelectorAll('.procedure-step');
    var nextActive = false;
    steps.forEach(function (el) {
      var s = el.getAttribute('data-step');
      if (state.procedureDone[s]) {
        el.classList.remove('active');
        el.classList.add('done');
      } else if (!nextActive) {
        el.classList.add('active');
        nextActive = true;
      }
    });
  }

  /* ── Guide toggle ── */
  dom.btnGuide.addEventListener('click', function () {
    state.guideOpen = !state.guideOpen;
    dom.guidePanel.style.display = state.guideOpen ? '' : 'none';
  });

  /* ── Reset ── */
  dom.btnReset.addEventListener('click', function () {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.chips = [];
    state.phase = 'start';
    state.weighIndex = 0;
    state.procedureDone = {};

    dom.btnCut.disabled = false;
    dom.btnWeighInit.disabled = true;
    dom.btnPlace.disabled = true;
    dom.btnWait.disabled = true;
    dom.btnRemove.disabled = true;
    dom.btnWeighFinal.disabled = true;

    dom.timerBar.hidden = true;
    dom.timerProgress.style.width = '0%';
    dom.timerText.textContent = '0:00 / 30:00';
    dom.balanceDisplay.hidden = true;
    dom.tbody.innerHTML = '';
    dom.calcPanel.hidden = true;

    var steps = dom.procList.querySelectorAll('.procedure-step');
    steps.forEach(function (el) { el.classList.remove('active', 'done'); });
    steps[0].classList.add('active');

    buildBeakers();
    resizeGraph();
    toast('Practical reset.', 'info');
  });

  /* ── Toast ── */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    $('toast-container').appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }

  /* ── LabRecordMode ── */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  /* ── Init ── */
  buildBeakers();
  resizeGraph();
  dom.procList.querySelector('.procedure-step').classList.add('active');
});
