/* ============================================================
   Enzyme Activity Practical — Simulation Logic
   Uses ENZYME_DATA from enzyme-data.js (loaded first via var)
   Effect of temperature on amylase activity (starch-iodine test)
   ============================================================ */

(function () {
  'use strict';

  var D = ENZYME_DATA;

  /* Time-scale factors: real-world to simulation */
  var EQUILIBRATE_MS   = 2000;  /* 2 min equilibration  -> 2 s real  */
  var TEST_INTERVAL_MS = 1000;  /* 30 s sample interval -> 1 s real  */
  var SIM_INTERVAL     = 30;    /* Each tick = 30 s in simulation     */
  var MAX_SIM_TIME     = 600;   /* 10 min max per temperature         */

  /* Spotting tile grid */
  var TILE_COLS = 10;
  var TILE_ROWS = 2;
  var TOTAL_WELLS = TILE_COLS * TILE_ROWS;

  /* ── DOM ── */
  var tempSelector     = document.getElementById('temp-selector');
  var btnStartTemp     = document.getElementById('btn-start-temp');
  var procList         = document.getElementById('procedure-list');
  var riskBody         = document.getElementById('risk-tbody');
  var spottingTile     = document.getElementById('spotting-tile');
  var statusEl         = document.getElementById('experiment-status');
  var statusLabel      = document.getElementById('status-label');
  var timerBar         = document.getElementById('timer-bar');
  var timerLabel       = document.getElementById('timer-label');
  var timerTime        = document.getElementById('timer-time');
  var timerFill        = document.getElementById('timer-fill');
  var waterTemp        = document.getElementById('water-bath-temp');
  var waterBody        = document.querySelector('.water-bath-body-enz');
  var waterWater       = document.getElementById('water-bath-water-enz');
  var tubeStarchLiq    = document.getElementById('tube-starch-liquid');
  var tubeAmylaseLiq   = document.getElementById('tube-amylase-liquid');
  var tubeStarch       = document.getElementById('tube-starch');
  var resultsBody      = document.getElementById('results-tbody');
  var resultsEmpty     = document.getElementById('results-empty');
  var graphCanvas      = document.getElementById('graph-canvas');
  var gctx             = graphCanvas.getContext('2d');
  var exportArea       = document.getElementById('export-buttons-container');
  var analysisBtn      = document.getElementById('btn-check-analysis');
  var analysisResult   = document.getElementById('analysis-result');
  var btnReset         = document.getElementById('btn-reset');
  var btnGuide         = document.getElementById('btn-toggle-guide');
  var guidePanel       = document.getElementById('guide-panel');
  var toastContainer   = document.getElementById('toast-container');

  /* ── State ── */
  var state = {
    selectedTemp: null,
    running: false,
    phase: 'idle',        /* idle | equilibrating | testing | done */
    elapsed: 0,           /* simulated seconds elapsed             */
    digestionTime: 0,     /* total digestion time for current temp */
    wellIndex: 0,
    timerId: null,
    eqTimerId: null,
    eqIntervalId: null,
    results: {},          /* temp -> { time, rate }                */
    completedTemps: [],
    exportAdded: false
  };

  /* ══════════════════════════════════════
     INITIALISATION
     ══════════════════════════════════════ */

  function init() {
    /* LabRecordMode toggle */
    if (typeof LabRecordMode !== 'undefined') {
      LabRecordMode.inject('#record-mode-slot');
    }

    buildTempButtons();
    buildProcedureList();
    buildRiskTable();
    buildResultsTable();
    buildSpottingTile();
    initTubes();
    drawGraphEmpty();
    highlightStep('prepare');

    if (typeof LabProgress !== 'undefined') {
      LabProgress.markVisited('enzyme-activity');
    }
  }

  /* ══════════════════════════════════════
     TEMPERATURE SELECTOR
     ══════════════════════════════════════ */

  function buildTempButtons() {
    tempSelector.innerHTML = '';
    D.temperatures.forEach(function (t) {
      var btn = document.createElement('button');
      btn.className = 'temp-btn';
      btn.type = 'button';
      btn.textContent = t + '\u00B0C';
      btn.setAttribute('data-temp', t);

      if (state.completedTemps.indexOf(t) !== -1) {
        btn.classList.add('done');
      }

      btn.addEventListener('click', function () {
        if (state.running) return;
        selectTemp(t);
      });
      tempSelector.appendChild(btn);
    });
  }

  function selectTemp(t) {
    if (state.running) return;
    state.selectedTemp = t;

    var btns = tempSelector.querySelectorAll('.temp-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.remove('selected');
      if (parseInt(btns[i].getAttribute('data-temp')) === t) {
        btns[i].classList.add('selected');
      }
    }
    btnStartTemp.disabled = false;
    setStatus('Ready: ' + t + '\u00B0C selected. Press Start.', '');
    audioPlay('click');
  }

  function disableTempBtns(off) {
    var btns = tempSelector.querySelectorAll('.temp-btn');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = off;
  }

  /* ══════════════════════════════════════
     PROCEDURE LIST
     ══════════════════════════════════════ */

  function buildProcedureList() {
    procList.innerHTML = '';
    D.steps.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'procedure-step';
      li.setAttribute('data-step', s.id);
      li.innerHTML = '<strong>' + s.title + '</strong><br>' + s.instruction;
      procList.appendChild(li);
    });
  }

  function highlightStep(id) {
    var items = procList.querySelectorAll('.procedure-step');
    var found = false;
    for (var i = 0; i < items.length; i++) {
      var stepId = items[i].getAttribute('data-step');
      if (stepId === id) {
        items[i].className = 'procedure-step active';
        found = true;
      } else if (!found) {
        items[i].className = 'procedure-step done';
      } else {
        items[i].className = 'procedure-step';
      }
    }
  }

  /* ══════════════════════════════════════
     RISK TABLE
     ══════════════════════════════════════ */

  function buildRiskTable() {
    riskBody.innerHTML = '';
    D.riskAssessment.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + r.hazard + '</td><td>' + r.risk + '</td><td>' + r.precaution + '</td>';
      riskBody.appendChild(tr);
    });
  }

  /* ══════════════════════════════════════
     RESULTS TABLE
     ══════════════════════════════════════ */

  function buildResultsTable() {
    resultsBody.innerHTML = '';
    D.temperatures.forEach(function (t) {
      var tr = document.createElement('tr');
      tr.id = 'result-row-' + t;
      tr.innerHTML =
        '<td>' + t + '\u00B0C</td>' +
        '<td id="res-time-' + t + '" class="pending">\u2014</td>' +
        '<td id="res-rate-' + t + '" class="pending">\u2014</td>';
      resultsBody.appendChild(tr);
    });
  }

  function updateResultRow(temp, time, rate) {
    var tdTime = document.getElementById('res-time-' + temp);
    var tdRate = document.getElementById('res-rate-' + temp);
    var tr     = document.getElementById('result-row-' + temp);
    var guided = (typeof LabRecordMode === 'undefined') || LabRecordMode.isGuided();

    if (time === null) {
      tdTime.textContent = 'No reaction';
      tdTime.className = '';
      tdRate.textContent = '0';
      tdRate.className = '';
      if (tr) tr.className = 'denatured-row';
    } else if (guided) {
      tdTime.textContent = time;
      tdTime.className = '';
      tdRate.textContent = rate;
      tdRate.className = '';
      if (tr) tr.className = 'completed-row';
    } else {
      /* Independent mode: student enters time and rate manually */
      tdTime.innerHTML = '<input type="text" placeholder="time" data-expected="' + time + '" style="width:50px;text-align:center;border:1px solid var(--color-border);border-radius:4px;padding:2px;font-family:var(--font-mono);font-size:inherit;background:var(--color-surface);color:var(--color-text);">';
      tdTime.className = '';
      tdRate.innerHTML = '<input type="text" placeholder="rate" data-expected="' + rate + '" style="width:60px;text-align:center;border:1px solid var(--color-border);border-radius:4px;padding:2px;font-family:var(--font-mono);font-size:inherit;background:var(--color-surface);color:var(--color-text);">';
      tdRate.className = '';
      if (tr) tr.className = 'completed-row';
    }
  }

  function highlightActiveRow(temp) {
    var rows = resultsBody.querySelectorAll('tr');
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove('active-row');
    if (temp !== null) {
      var tr = document.getElementById('result-row-' + temp);
      if (tr) tr.classList.add('active-row');
    }
  }

  /* ══════════════════════════════════════
     SPOTTING TILE
     ══════════════════════════════════════ */

  function buildSpottingTile() {
    spottingTile.innerHTML = '';
    spottingTile.style.gridTemplateColumns = 'repeat(' + TILE_COLS + ', 1fr)';

    for (var i = 0; i < TOTAL_WELLS; i++) {
      var well = document.createElement('div');
      well.className = 'well';
      well.id = 'well-' + i;
      spottingTile.appendChild(well);
    }
  }

  function clearWells() {
    for (var i = 0; i < TOTAL_WELLS; i++) {
      var well = document.getElementById('well-' + i);
      if (well) {
        well.className = 'well';
        well.style.background = '';
        well.innerHTML = '';
        well.title = '';
      }
    }
  }

  function fillWell(idx, colourKey, isEndpoint) {
    var well = document.getElementById('well-' + idx);
    if (!well) return;

    var hex = D.colours[colourKey].hex;
    well.classList.add('filled');
    well.style.background = hex;
    well.title = state.elapsed + ' s: ' + D.colours[colourKey].label;

    if (isEndpoint) {
      well.classList.add('endpoint');
    }

    /* Animated inner drop */
    var dot = document.createElement('div');
    dot.className = 'well-drop';
    dot.style.cssText =
      'width:16px;height:16px;border-radius:50%;background:' + hex +
      ';box-shadow:inset 0 -2px 4px rgba(0,0,0,0.3),inset 0 2px 2px rgba(255,255,255,0.15);';
    well.appendChild(dot);

    audioPlay('drip');
  }

  /* ══════════════════════════════════════
     TEST TUBES & WATER BATH VISUALS
     ══════════════════════════════════════ */

  function initTubes() {
    tubeStarchLiq.style.height = '0';
    tubeStarchLiq.style.background = 'transparent';
    tubeAmylaseLiq.style.height = '0';
    tubeAmylaseLiq.style.background = 'transparent';
  }

  function showTubesFilled() {
    tubeStarchLiq.style.height = '55%';
    tubeStarchLiq.style.background = 'rgba(255, 255, 240, 0.5)';
    tubeAmylaseLiq.style.height = '45%';
    tubeAmylaseLiq.style.background = 'rgba(200, 220, 255, 0.35)';
  }

  function showTubesMixed() {
    tubeAmylaseLiq.style.height = '0';
    tubeStarchLiq.style.height = '70%';
    tubeStarchLiq.style.background = 'rgba(230, 240, 255, 0.45)';
    if (tubeStarch) {
      tubeStarch.classList.add('mixed');
      setTimeout(function () { tubeStarch.classList.remove('mixed'); }, 600);
    }
    audioPlay('pour');
  }

  function setWaterBath(temp) {
    waterTemp.textContent = temp + '\u00B0C';
    waterTemp.classList.add('active');

    waterWater.classList.remove('warm', 'hot');
    if (temp >= 50) waterWater.classList.add('hot');
    else if (temp >= 35) waterWater.classList.add('warm');

    waterBody.classList.add('active');
  }

  function resetWaterBath() {
    waterTemp.textContent = '--\u00B0C';
    waterTemp.classList.remove('active');
    waterWater.classList.remove('warm', 'hot');
    waterBody.classList.remove('active');
  }

  /* ══════════════════════════════════════
     TIMER
     ══════════════════════════════════════ */

  function formatTime(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setTimerDisplay(label, simSecs, maxSecs) {
    timerBar.classList.add('active');
    timerLabel.textContent = label;
    timerTime.textContent = formatTime(simSecs);
    if (maxSecs > 0) {
      timerFill.style.width = Math.min((simSecs / maxSecs) * 100, 100) + '%';
    }
  }

  function resetTimer() {
    timerBar.classList.remove('active');
    timerLabel.textContent = 'Timer';
    timerTime.textContent = '0:00';
    timerFill.style.width = '0';
    timerFill.classList.remove('pulsing');
  }

  /* ══════════════════════════════════════
     STATUS BANNER
     ══════════════════════════════════════ */

  function setStatus(text, mode) {
    statusLabel.textContent = text;
    statusEl.className = 'experiment-status' + (mode ? ' ' + mode : '');
  }

  /* ══════════════════════════════════════
     EXPERIMENT WORKFLOW
     ══════════════════════════════════════ */

  btnStartTemp.addEventListener('click', function () {
    if (!state.selectedTemp || state.running) return;
    startExperiment(state.selectedTemp);
  });

  function startExperiment(temp) {
    if (state.running) return;
    state.running = true;
    state.phase = 'equilibrating';
    state.elapsed = 0;
    state.wellIndex = 0;
    state.digestionTime = D.getDigestionTime(temp);

    btnStartTemp.disabled = true;
    disableTempBtns(true);
    highlightActiveRow(temp);

    /* Prepare */
    highlightStep('pipette');
    setWaterBath(temp);
    showTubesFilled();
    clearWells();

    setStatus('Equilibrating at ' + temp + '\u00B0C\u2026', 'active');
    timerFill.classList.add('pulsing');
    setTimerDisplay('Equilibrating', 0, 120);
    toast('Water bath set to ' + temp + '\u00B0C. Equilibrating solutions\u2026', 'info');

    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('enzyme-activity', 'prepare-' + temp);
    }

    /* Equilibration animation (2 s real = 2 min sim) */
    var eqStart = Date.now();
    state.eqIntervalId = setInterval(function () {
      var frac = Math.min((Date.now() - eqStart) / EQUILIBRATE_MS, 1);
      setTimerDisplay('Equilibrating', Math.round(frac * 120), 120);
    }, 100);

    state.eqTimerId = setTimeout(function () {
      clearInterval(state.eqIntervalId);
      timerFill.classList.remove('pulsing');
      onEquilibrated(temp);
    }, EQUILIBRATE_MS);
  }

  function onEquilibrated(temp) {
    state.phase = 'testing';
    highlightStep('spot');

    /* Brief pause then mix */
    setTimeout(function () {
      highlightStep('mix');
      showTubesMixed();

      setStatus('Testing at ' + temp + '\u00B0C \u2014 sampling every 30 s', 'active');
      toast('Solutions mixed! Timer started. Testing every 30 seconds.', 'info');
      audioPlay('beep');

      /* First test at t=0 */
      state.elapsed = 0;
      state.wellIndex = 0;
      doTest(temp);

      /* Subsequent tests every 1 s real */
      state.timerId = setInterval(function () {
        state.elapsed += SIM_INTERVAL;
        state.wellIndex++;

        if (state.wellIndex >= TOTAL_WELLS || state.elapsed >= MAX_SIM_TIME) {
          finishExperiment(temp, true);
          return;
        }

        highlightStep('test');
        doTest(temp);
      }, TEST_INTERVAL_MS);
    }, 300);
  }

  function doTest(temp) {
    var colour = D.getColourAtTime(state.elapsed, state.digestionTime);
    var isEndpoint = (colour === 'yellow');
    var maxDisplay = state.digestionTime === Infinity ? MAX_SIM_TIME : state.digestionTime * 1.3;

    setTimerDisplay('Testing', state.elapsed, maxDisplay);
    fillWell(state.wellIndex, colour, isEndpoint);

    if (isEndpoint) {
      highlightStep('endpoint');
      finishExperiment(temp, false);
    } else {
      audioPlay('beep');
    }
  }

  function finishExperiment(temp, denatured) {
    clearInterval(state.timerId);
    state.timerId = null;
    state.running = false;
    state.phase = 'done';

    var time, rate, rateStr;
    if (denatured || state.digestionTime === Infinity) {
      time = null;
      rate = 0;
      rateStr = '0';
    } else {
      time = state.elapsed;
      rate = 1 / time;
      rateStr = rate.toFixed(4);
    }

    /* Record */
    state.results[temp] = { time: time, rate: rate };
    if (state.completedTemps.indexOf(temp) === -1) {
      state.completedTemps.push(temp);
    }

    /* UI updates */
    updateResultRow(temp, time, rateStr);
    highlightActiveRow(null);
    timerFill.classList.remove('pulsing');

    if (time === null) {
      setStatus(temp + '\u00B0C: Enzyme denatured \u2014 no reaction', 'complete');
      toast(temp + '\u00B0C: Enzyme denatured! Iodine stays blue-black.', 'warn');
    } else {
      setStatus(temp + '\u00B0C: Endpoint reached at ' + time + ' s', 'complete');
      toast(temp + '\u00B0C: Endpoint at ' + time + ' s (rate = ' + rateStr + ' s\u207B\u00B9)', 'success');
    }

    /* Re-enable */
    state.selectedTemp = null;
    btnStartTemp.disabled = true;
    disableTempBtns(false);
    buildTempButtons();

    highlightStep('repeat');
    resetTimer();
    resetWaterBath();
    initTubes();

    /* Redraw graph */
    drawGraph();

    /* Export buttons (add once) */
    if (!state.exportAdded && exportArea && typeof LabExport !== 'undefined') {
      LabExport.addExportButtons(exportArea, {
        canvas: graphCanvas,
        filename: 'enzyme-rate-graph.png',
        table: document.getElementById('results-table'),
        csvFilename: 'enzyme-results.csv'
      });
      state.exportAdded = true;
    }

    /* All temps done? */
    if (state.completedTemps.length >= D.temperatures.length) {
      onAllComplete();
    }

    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('enzyme-activity', 'temp-' + temp);
    }
  }

  function onAllComplete() {
    resultsEmpty.style.display = 'none';
    analysisBtn.disabled = false;
    setStatus('All temperatures tested! Complete the analysis below.', 'complete');
    toast('All temperatures complete! Answer the analysis questions.', 'success');

    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('enzyme-activity', 'all-temps');
    }
  }

  /* ══════════════════════════════════════
     GRAPH
     ══════════════════════════════════════ */

  function drawGraphEmpty() {
    var w = graphCanvas.width, h = graphCanvas.height;
    gctx.clearRect(0, 0, w, h);

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    gctx.fillStyle = isDark ? '#22232f' : '#f8f9fb';
    gctx.fillRect(0, 0, w, h);

    gctx.fillStyle = '#8b8f9a';
    gctx.font = '11px Inter, sans-serif';
    gctx.textAlign = 'center';
    gctx.fillText('Complete experiments to see the graph', w / 2, h / 2);
  }

  function drawGraph() {
    var w = graphCanvas.width, h = graphCanvas.height;
    gctx.clearRect(0, 0, w, h);

    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    gctx.fillStyle = isDark ? '#22232f' : '#f8f9fb';
    gctx.fillRect(0, 0, w, h);

    /* Collect plotable points */
    var points = [];
    var maxRate = 0;
    D.temperatures.forEach(function (t) {
      var r = state.results[t];
      if (r) {
        var rv = r.rate || 0;
        if (rv > maxRate) maxRate = rv;
        points.push({ temp: t, rate: rv });
      }
    });

    if (points.length === 0) { drawGraphEmpty(); return; }

    /* Layout */
    var pad = { top: 18, right: 15, bottom: 35, left: 48 };
    var pw = w - pad.left - pad.right;
    var ph = h - pad.top - pad.bottom;

    var tempMin = D.temperatures[0];
    var tempMax = D.temperatures[D.temperatures.length - 1];
    var rateMax = maxRate * 1.2 || 0.02;

    function xOf(t) { return pad.left + ((t - tempMin) / (tempMax - tempMin)) * pw; }
    function yOf(r) { return pad.top + ph - (r / rateMax) * ph; }

    /* Grid */
    gctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    gctx.lineWidth = 1;
    var gridLines = 4;
    for (var g = 0; g <= gridLines; g++) {
      var gy = yOf((rateMax / gridLines) * g);
      gctx.beginPath(); gctx.moveTo(pad.left, gy); gctx.lineTo(w - pad.right, gy); gctx.stroke();
    }

    /* Axes */
    gctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : '#6b6e7d';
    gctx.lineWidth = 1.5;
    gctx.beginPath();
    gctx.moveTo(pad.left, pad.top);
    gctx.lineTo(pad.left, pad.top + ph);
    gctx.lineTo(w - pad.right, pad.top + ph);
    gctx.stroke();

    /* Tick labels */
    var tickCol = isDark ? '#9a9dab' : '#5a5f6d';
    gctx.fillStyle = tickCol;
    gctx.font = '9px Inter, sans-serif';
    gctx.textAlign = 'center';

    D.temperatures.forEach(function (t) {
      gctx.fillText(t + '\u00B0', xOf(t), pad.top + ph + 14);
    });

    gctx.font = '10px Inter, sans-serif';
    gctx.fillText('Temperature (\u00B0C)', pad.left + pw / 2, h - 3);

    /* Y labels */
    gctx.textAlign = 'right';
    gctx.font = '8px Inter, sans-serif';
    for (var yi = 0; yi <= gridLines; yi++) {
      var rv = (rateMax / gridLines) * yi;
      gctx.fillText(rv.toFixed(4), pad.left - 4, yOf(rv) + 3);
    }

    /* Y title */
    gctx.save();
    gctx.translate(10, pad.top + ph / 2);
    gctx.rotate(-Math.PI / 2);
    gctx.textAlign = 'center';
    gctx.font = '10px Inter, sans-serif';
    gctx.fillText('Rate (s\u207B\u00B9)', 0, 0);
    gctx.restore();

    /* Sort */
    points.sort(function (a, b) { return a.temp - b.temp; });

    /* Line (smooth quadratic) */
    if (points.length > 1) {
      gctx.strokeStyle = '#06d6a0';
      gctx.lineWidth = 2;
      gctx.lineJoin = 'round';
      gctx.beginPath();
      gctx.moveTo(xOf(points[0].temp), yOf(points[0].rate));

      for (var li = 1; li < points.length; li++) {
        var cpx = (xOf(points[li - 1].temp) + xOf(points[li].temp)) / 2;
        var cpy = (yOf(points[li - 1].rate) + yOf(points[li].rate)) / 2;
        gctx.quadraticCurveTo(xOf(points[li - 1].temp), yOf(points[li - 1].rate), cpx, cpy);
      }
      gctx.lineTo(xOf(points[points.length - 1].temp), yOf(points[points.length - 1].rate));
      gctx.stroke();

      /* Shaded area */
      gctx.lineTo(xOf(points[points.length - 1].temp), pad.top + ph);
      gctx.lineTo(xOf(points[0].temp), pad.top + ph);
      gctx.closePath();
      gctx.fillStyle = 'rgba(6,214,160,0.08)';
      gctx.fill();
    }

    /* Data points */
    points.forEach(function (p) {
      var px = xOf(p.temp), py = yOf(p.rate);
      gctx.beginPath(); gctx.arc(px, py, 5, 0, Math.PI * 2);
      gctx.fillStyle = '#06d6a0'; gctx.fill();
      gctx.beginPath(); gctx.arc(px, py, 2.5, 0, Math.PI * 2);
      gctx.fillStyle = '#fff'; gctx.fill();
    });

    /* Optimum annotation */
    var best = null;
    points.forEach(function (p) { if (!best || p.rate > best.rate) best = p; });
    if (best && points.length >= 3) {
      var ox = xOf(best.temp), oy = yOf(best.rate);
      gctx.setLineDash([3, 3]);
      gctx.strokeStyle = 'rgba(6,214,160,0.4)';
      gctx.lineWidth = 1;
      gctx.beginPath(); gctx.moveTo(ox, oy + 8); gctx.lineTo(ox, pad.top + ph); gctx.stroke();
      gctx.setLineDash([]);
      gctx.fillStyle = '#06d6a0';
      gctx.font = 'bold 9px Inter, sans-serif';
      gctx.textAlign = 'center';
      gctx.fillText('Optimum', ox, oy - 10);
    }
  }

  /* ══════════════════════════════════════
     ANALYSIS
     ══════════════════════════════════════ */

  analysisBtn.addEventListener('click', checkAnalysis);

  function checkAnalysis() {
    var qOpt     = document.getElementById('q-optimum');
    var qExplain = document.getElementById('q-explain');
    var qDenat   = document.getElementById('q-denature');

    var optVal     = parseInt(qOpt.value);
    var explainVal = (qExplain.value || '').trim().toLowerCase();
    var denatVal   = (qDenat.value || '').trim().toLowerCase();

    if (!optVal && !explainVal && !denatVal) {
      toast('Please answer at least one question.', 'warn');
      return;
    }

    var parts = [];
    var score = 0;
    var maxScore = 3;

    /* Q1 */
    if (optVal) {
      if (optVal >= 35 && optVal <= 40) {
        parts.push('<div class="analysis-feedback correct">Q1: Correct! The optimum temperature for amylase is approximately 37\u00B0C.</div>');
        score++;
      } else {
        parts.push('<div class="analysis-feedback incorrect">Q1: Not quite. The optimum is near 37\u00B0C (body temperature). Look at the peak on your graph.</div>');
      }
    } else {
      parts.push('<div class="analysis-feedback partial">Q1: Please enter the optimum temperature.</div>');
    }

    /* Q2 */
    if (explainVal.length > 15) {
      var hasUp   = /increas|rise|faster|more|higher/.test(explainVal);
      var hasPeak = /peak|optimum|maximum|highest|fastest/.test(explainVal);
      var hasDown = /decreas|slow|fall|drop|less|lower|denatur/.test(explainVal);
      var hasWhy  = /energy|kinetic|collision|active.?site|protein/.test(explainVal);
      var eq = (hasUp ? 1 : 0) + (hasPeak ? 1 : 0) + (hasDown ? 1 : 0) + (hasWhy ? 1 : 0);

      if (eq >= 3) {
        parts.push('<div class="analysis-feedback correct">Q2: Good explanation covering the bell-curve shape of the graph.</div>');
        score++;
      } else if (eq >= 1) {
        parts.push('<div class="analysis-feedback partial">Q2: Partial. Try to explain: rate increases (more kinetic energy), peaks at the optimum, then decreases as the enzyme denatures.</div>');
        score += 0.5;
      } else {
        parts.push('<div class="analysis-feedback incorrect">Q2: Explain why rate rises, reaches a peak, then falls.</div>');
      }
    } else if (explainVal) {
      parts.push('<div class="analysis-feedback partial">Q2: Please write a more detailed explanation.</div>');
    } else {
      parts.push('<div class="analysis-feedback partial">Q2: Please explain the shape of the graph.</div>');
    }

    /* Q3 */
    if (denatVal.length > 10) {
      var hasDen = /denatur|destroy|break|unfold|lose|change/.test(denatVal);
      var hasAS  = /active.?site|shape|structure|3d|tertiary|protein/.test(denatVal);
      if (hasDen && hasAS) {
        parts.push('<div class="analysis-feedback correct">Q3: Correct! Above 60\u00B0C the enzyme denatures \u2014 its active site changes shape and can no longer bind the substrate.</div>');
        score++;
      } else if (hasDen || hasAS) {
        parts.push('<div class="analysis-feedback partial">Q3: Partial. Mention both that the enzyme denatures AND that the active site changes shape so the substrate no longer fits.</div>');
        score += 0.5;
      } else {
        parts.push('<div class="analysis-feedback incorrect">Q3: The enzyme denatures above 60\u00B0C. Its active site changes shape so it can no longer catalyse the reaction.</div>');
      }
    } else if (denatVal) {
      parts.push('<div class="analysis-feedback partial">Q3: Please give a more detailed answer.</div>');
    } else {
      parts.push('<div class="analysis-feedback partial">Q3: Please explain what happens above 60\u00B0C.</div>');
    }

    var pct = Math.round((score / maxScore) * 100);
    var cls = pct >= 80 ? 'correct' : pct >= 50 ? 'partial' : 'incorrect';
    parts.push('<div class="analysis-feedback ' + cls + '" style="margin-top:8px;font-weight:700;">Score: ' + score + ' / ' + maxScore + ' (' + pct + '%)</div>');

    analysisResult.style.display = '';
    analysisResult.innerHTML = parts.join('');

    if (score >= 2) {
      toast('Good analysis! ' + score + '/' + maxScore, 'success');
    } else {
      toast('Review the feedback and improve your answers.', 'info');
    }

    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('enzyme-activity', 'analysis');
      if (state.completedTemps.length >= D.temperatures.length) {
        LabProgress.markComplete('enzyme-activity', pct);
      }
    }
  }

  /* ══════════════════════════════════════
     RESET
     ══════════════════════════════════════ */

  btnReset.addEventListener('click', function () {
    if (state.timerId) clearInterval(state.timerId);
    if (state.eqTimerId) clearTimeout(state.eqTimerId);
    if (state.eqIntervalId) clearInterval(state.eqIntervalId);

    state.selectedTemp = null;
    state.running = false;
    state.phase = 'idle';
    state.elapsed = 0;
    state.wellIndex = 0;
    state.digestionTime = 0;
    state.timerId = null;
    state.eqTimerId = null;
    state.eqIntervalId = null;
    state.results = {};
    state.completedTemps = [];
    state.exportAdded = false;

    buildTempButtons();
    buildResultsTable();
    clearWells();
    initTubes();
    resetWaterBath();
    resetTimer();
    drawGraphEmpty();

    if (exportArea) exportArea.innerHTML = '';

    btnStartTemp.disabled = true;
    analysisBtn.disabled = true;
    resultsEmpty.style.display = '';
    analysisResult.style.display = 'none';

    var qOpt  = document.getElementById('q-optimum');
    var qExp  = document.getElementById('q-explain');
    var qDen  = document.getElementById('q-denature');
    if (qOpt) qOpt.value = '';
    if (qExp) qExp.value = '';
    if (qDen) qDen.value = '';

    setStatus('Select a temperature to begin', '');
    highlightStep('prepare');

    toast('Experiment reset. Select a temperature to start.', 'info');
  });

  /* ══════════════════════════════════════
     GUIDE TOGGLE
     ══════════════════════════════════════ */

  if (btnGuide) {
    btnGuide.addEventListener('click', function () {
      var vis = guidePanel.style.display !== 'none';
      guidePanel.style.display = vis ? 'none' : '';
    });
  }

  /* ══════════════════════════════════════
     TOAST
     ══════════════════════════════════════ */

  function toast(msg, type) {
    if (!toastContainer) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    toastContainer.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('visible'); });
    setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 3500);

    /* Audio feedback for toasts */
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }

  /* ══════════════════════════════════════
     AUDIO HELPER
     ══════════════════════════════════════ */

  function audioPlay(sound) {
    if (typeof LabAudio !== 'undefined' && LabAudio[sound]) {
      LabAudio[sound]();
    }
  }

  /* ── Boot ── */
  init();

})();
