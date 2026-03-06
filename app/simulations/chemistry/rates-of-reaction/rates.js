/* ============================================================
   Rates of Reaction – Simulation
   Canvas: conical flask + gas syringe, reaction animation
   Students must actively read the gas syringe and record values.
   ============================================================ */
(function () {
  'use strict';

  var D = RATES_DATA;

  /* --- DOM --- */
  var canvas   = document.getElementById('canvas');
  var ctx      = canvas.getContext('2d');
  var graph    = document.getElementById('graph');
  var gctx     = graph.getContext('2d');
  var selConc  = document.getElementById('sel-conc');
  var selChips = document.getElementById('sel-chips');
  var btnStart = document.getElementById('btn-start');
  var btnReset = document.getElementById('btn-reset');
  var timerEl  = document.getElementById('timer');
  var dataBody = document.getElementById('data-body');
  var rateCalc = document.getElementById('rate-calc');
  var rateValue = document.getElementById('rate-value');
  var procList = document.getElementById('procedure-list');
  var btnRecord = document.getElementById('btn-record');
  var recordPrompt = document.getElementById('record-prompt');

  /* --- State --- */
  var state = {
    running: false,
    paused: false,           /* paused waiting for student to record */
    elapsed: 0,
    concentration: 1.0,
    chipSize: 'large',
    gasVolume: 0,
    bubbles: [],
    readings: [],
    allRuns: [],             /* [{conc, chip, readings}] */
    nextReadingIdx: 0,       /* index into D.timePoints for next expected reading */
    pendingTime: null,       /* time point waiting for student to record */
    pendingActual: null,     /* the actual gas volume at that time */
    animId: null,
    lastFrame: 0,
    recordedSet: {},         /* tracks which time points have been recorded */
    score: { correct: 0, total: 0 }
  };

  /* --- Init UI --- */
  document.getElementById('equation').textContent = D.equation;

  D.concentrations.forEach(function (c) {
    var opt = document.createElement('option');
    opt.value = c.value;
    opt.textContent = c.label;
    selConc.appendChild(opt);
  });
  selConc.value = '1';

  D.steps.forEach(function (s) {
    var li = document.createElement('li');
    li.textContent = s.instruction;
    li.id = 'step-' + s.id;
    procList.appendChild(li);
  });

  buildTable();

  /* --- Model --- */
  function getK() {
    var conc = state.concentration;
    var chipMult = 1.0;
    var chip = D.chipSizes.filter(function (c) { return c.id === state.chipSize; })[0];
    if (chip) chipMult = chip.surfaceMultiplier;
    return D.baseK * conc * chipMult;
  }

  function gasAtTime(t) {
    var k = getK();
    return D.maxGas * (1 - Math.exp(-k * t));
  }

  /* --- Table (with editable input cells) --- */
  function buildTable() {
    dataBody.innerHTML = '';
    state.recordedSet = {};
    D.timePoints.forEach(function (t) {
      var tr = document.createElement('tr');
      var tdTime = document.createElement('td');
      tdTime.textContent = t;
      var tdVol = document.createElement('td');
      tdVol.className = 'vol-cell';
      tdVol.id = 'vol-' + t;
      tdVol.innerHTML = '<span class="vol-placeholder">\u2014</span>';
      tr.appendChild(tdTime);
      tr.appendChild(tdVol);
      dataBody.appendChild(tr);
    });
  }

  function fillCell(time, studentVal, actualVal) {
    var cell = document.getElementById('vol-' + time);
    if (!cell) return;

    var diff = Math.abs(studentVal - actualVal);
    var pct = (actualVal > 0) ? (diff / actualVal) * 100 : (diff < 0.5 ? 0 : 100);
    var accurate = pct < 8; /* within 8% counts as accurate */

    cell.textContent = studentVal.toFixed(1);
    cell.className = 'vol-cell ' + (accurate ? 'vol-accurate' : 'vol-inaccurate');
    cell.title = accurate
      ? 'Good reading! Actual: ' + actualVal.toFixed(1) + ' cm\u00B3'
      : 'Check your reading. Actual: ' + actualVal.toFixed(1) + ' cm\u00B3';

    state.readings.push({ time: time, vol: studentVal });
    state.recordedSet[time] = true;

    if (accurate) state.score.correct++;
    state.score.total++;
  }

  /* --- Canvas drawing --- */
  var W = canvas.width, H = canvas.height;

  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* Bench surface */
    ctx.fillStyle = '#2a2b3d';
    ctx.fillRect(0, H - 50, W, 50);
    ctx.fillStyle = '#4a4b62';
    ctx.fillRect(0, H - 52, W, 3);

    drawFlask();
    drawSyringe();
    drawTube();
    drawBubbles();

    /* Recording prompt flash on canvas */
    if (state.paused) {
      drawRecordPromptOnCanvas();
    }
  }

  function drawFlask() {
    var fx = 160, fy = H - 52; /* base of flask */

    /* Flask body - conical shape */
    ctx.beginPath();
    ctx.moveTo(fx - 50, fy);
    ctx.lineTo(fx - 12, fy - 110);
    ctx.lineTo(fx - 12, fy - 130);
    ctx.lineTo(fx + 12, fy - 130);
    ctx.lineTo(fx + 12, fy - 110);
    ctx.lineTo(fx + 50, fy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(235, 240, 250, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 170, 195, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* Liquid in flask */
    var concObj = D.concentrations.filter(function (c) { return c.value === state.concentration; })[0];
    var liqColor = concObj ? concObj.color : 'rgba(180,210,255,0.35)';
    var liqH = 70; /* height of liquid */
    var liqY = fy - liqH;
    var liqRatio = liqH / 110;
    var liqHalfW = 50 * (1 - liqRatio) + 12 * liqRatio;

    ctx.beginPath();
    ctx.moveTo(fx - liqHalfW, liqY);
    ctx.lineTo(fx - 50, fy);
    ctx.lineTo(fx + 50, fy);
    ctx.lineTo(fx + liqHalfW, liqY);
    ctx.closePath();
    ctx.fillStyle = liqColor;
    ctx.fill();

    /* Chips in flask */
    if (state.running || state.paused || state.elapsed > 0) {
      drawChips(fx, fy - 20);
    }

    /* Bung */
    if (state.running || state.paused || state.elapsed > 0) {
      ctx.fillStyle = '#6b5b45';
      ctx.fillRect(fx - 14, fy - 134, 28, 8);
    }
  }

  function drawChips(cx, cy) {
    var chipCount = state.chipSize === 'powder' ? 12 : (state.chipSize === 'small' ? 6 : 3);
    var chipSize = state.chipSize === 'powder' ? 3 : (state.chipSize === 'small' ? 6 : 10);

    ctx.fillStyle = '#d4d0c8';
    for (var i = 0; i < chipCount; i++) {
      var x = cx - 20 + (i * 40 / chipCount) + Math.sin(i * 2.5) * 8;
      var y = cy + Math.cos(i * 1.7) * 6;
      ctx.beginPath();
      ctx.arc(x, y, chipSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#aaa89e';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  function drawTube() {
    /* Delivery tube from flask neck to syringe */
    ctx.strokeStyle = 'rgba(160, 170, 195, 0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(172, H - 186);
    ctx.quadraticCurveTo(200, H - 200, 300, H - 200);
    ctx.lineTo(340, H - 200);
    ctx.stroke();

    /* Inner tube */
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(172, H - 186);
    ctx.quadraticCurveTo(200, H - 200, 300, H - 200);
    ctx.lineTo(340, H - 200);
    ctx.stroke();
  }

  function drawSyringe() {
    var sx = 400, sy = H - 200;
    var maxLen = 120;
    var plungerLen = (state.gasVolume / D.maxGas) * maxLen;

    /* Barrel */
    ctx.fillStyle = 'rgba(235, 240, 250, 0.1)';
    ctx.strokeStyle = 'rgba(160, 170, 195, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(sx - 60, sy - 15, maxLen + 20, 30);
    ctx.fill();
    ctx.stroke();

    /* Graduation marks - students must read these */
    ctx.fillStyle = 'rgba(160, 170, 195, 0.5)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (var v = 0; v <= D.maxGas; v += 5) {
      var mx = sx - 55 + (v / D.maxGas) * maxLen;
      var isMajor = (v % 10 === 0);
      ctx.fillRect(mx, sy - 14, 0.5, isMajor ? 6 : 3);
      if (v % 10 === 0) {
        ctx.fillText(v, mx, sy - 17);
      }
    }

    /* Plunger */
    ctx.fillStyle = '#5c5f6e';
    var plungerX = sx - 55 + plungerLen;
    ctx.fillRect(plungerX, sy - 12, 4, 24);

    /* Plunger handle */
    ctx.fillRect(plungerX + 4, sy - 8, maxLen - plungerLen + 15, 2);
    ctx.fillRect(plungerX + maxLen - plungerLen + 15, sy - 14, 4, 28);

    /* Gas in syringe */
    if (state.gasVolume > 0) {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.08)';
      ctx.fillRect(sx - 55, sy - 12, plungerLen, 24);
    }

    /* Label */
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Gas syringe (cm\u00B3)', sx - 55, sy + 28);

    /* Pointer line at current plunger position to help read scale */
    if (state.running || state.paused) {
      ctx.strokeStyle = 'rgba(79, 195, 247, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(plungerX, sy - 14);
      ctx.lineTo(plungerX, sy - 22);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /* Draw a prompt arrow on canvas near the syringe when paused for recording */
  function drawRecordPromptOnCanvas() {
    var pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    ctx.fillStyle = 'rgba(67, 97, 238, ' + (pulse * 0.8) + ')';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Read the syringe scale!', 400, H - 145);

    /* Arrow pointing to syringe */
    ctx.beginPath();
    ctx.moveTo(400, H - 140);
    ctx.lineTo(395, H - 135);
    ctx.lineTo(405, H - 135);
    ctx.closePath();
    ctx.fill();
  }

  function drawBubbles() {
    for (var i = 0; i < state.bubbles.length; i++) {
      var b = state.bubbles[i];
      var alpha = b.opacity !== undefined ? b.opacity : 0.6;
      ctx.fillStyle = 'rgba(220, 230, 250, ' + alpha + ')';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      /* Bubble highlight for realism */
      if (b.r > 1.5) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (alpha * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* --- Bubbles --- */
  /* Flask geometry constants for bubble containment (derived from actual canvas H) */
  var FLASK_X = 160;
  var FLASK_BASE_Y = H - 52;
  var FLASK_LIQUID_TOP = H - 52 - 70;
  var FLASK_NECK_TOP = H - 52 - 130;

  /* Return the half-width of the flask interior at a given y coordinate */
  function flaskHalfWidthAt(y) {
    if (y >= FLASK_BASE_Y) return 48;
    if (y <= FLASK_BASE_Y - 110 && y >= FLASK_NECK_TOP) return 10;
    if (y < FLASK_NECK_TOP) return 10;
    var ratio = (FLASK_BASE_Y - y) / 110;
    return 48 * (1 - ratio) + 10 * ratio;
  }

  function spawnBubble() {
    var rate = getK() * state.concentration;
    if (Math.random() > rate * 2) return;
    var spawnY = FLASK_BASE_Y - 15 - Math.random() * 15;
    var halfW = flaskHalfWidthAt(spawnY) - 4;
    var spawnX = FLASK_X + (Math.random() - 0.5) * 2 * halfW;
    state.bubbles.push({
      x: spawnX,
      y: spawnY,
      r: 1.5 + Math.random() * 2.5,
      vy: -0.4 - Math.random() * 1.0,
      vx: (Math.random() - 0.5) * 0.2,
      opacity: 0.55 + Math.random() * 0.15
    });
  }

  function updateBubbles(dt) {
    for (var i = state.bubbles.length - 1; i >= 0; i--) {
      var b = state.bubbles[i];
      b.y += b.vy * dt * 60;
      b.x += b.vx * dt * 60;
      b.x += Math.sin(b.y * 0.08 + b.x * 0.05) * 0.15;

      /* Clamp x to stay inside the flask */
      var hw = flaskHalfWidthAt(b.y) - b.r - 1;
      if (hw < 1) hw = 1;
      if (b.x < FLASK_X - hw) { b.x = FLASK_X - hw; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x > FLASK_X + hw) { b.x = FLASK_X + hw; b.vx = -Math.abs(b.vx) * 0.5; }

      /* Fade out approaching liquid surface */
      if (b.y < FLASK_LIQUID_TOP + 12) {
        b.opacity -= dt * 2.5;
        b.r -= dt * 1.2;
      }

      if (b.opacity <= 0 || b.r <= 0.3 || b.y < FLASK_LIQUID_TOP - 2) {
        state.bubbles.splice(i, 1);
      }
    }
  }

  /* --- Recording mechanics --- */
  function promptForReading(timePoint) {
    state.paused = true;
    state.pendingTime = timePoint;
    state.pendingActual = gasAtTime(timePoint);

    /* Show recording prompt UI */
    btnRecord.disabled = false;
    recordPrompt.hidden = false;
    recordPrompt.querySelector('.prompt-time').textContent = timePoint;

    var input = recordPrompt.querySelector('.reading-input');
    input.value = '';
    input.focus();

    /* Highlight the relevant row */
    var cell = document.getElementById('vol-' + timePoint);
    if (cell) {
      cell.innerHTML = '<span class="vol-waiting">...</span>';
      cell.parentElement.classList.add('row-active');
    }

    highlightStep('record');
    if (typeof LabAudio !== 'undefined') LabAudio.click();

    /* Keep drawing so student can read the syringe */
    drawWhilePaused();
  }

  function drawWhilePaused() {
    if (!state.paused) return;
    /* Update bubble animation even while paused (reaction still fizzing) */
    updateBubbles(0.016);
    var completion = state.gasVolume / D.maxGas;
    if (completion < 0.98) {
      spawnBubble();
    }
    draw();
    requestAnimationFrame(drawWhilePaused);
  }

  function submitReading() {
    var input = recordPrompt.querySelector('.reading-input');
    var val = parseFloat(input.value);

    if (isNaN(val) || val < 0 || val > D.maxGas + 5) {
      input.classList.add('input-error');
      toast('Enter a valid volume between 0 and ' + D.maxGas + ' cm\u00B3', 'warn');
      setTimeout(function () { input.classList.remove('input-error'); }, 600);
      return;
    }

    /* Remove active highlight from row */
    var cell = document.getElementById('vol-' + state.pendingTime);
    if (cell && cell.parentElement) {
      cell.parentElement.classList.remove('row-active');
    }

    /* Record the reading */
    fillCell(state.pendingTime, val, state.pendingActual);

    /* Feedback */
    var diff = Math.abs(val - state.pendingActual);
    var pct = (state.pendingActual > 0) ? (diff / state.pendingActual) * 100 : (diff < 0.5 ? 0 : 100);
    if (pct < 8) {
      toast('Reading recorded at ' + state.pendingTime + ' s  --  accurate!', 'success');
    } else {
      toast('Reading recorded at ' + state.pendingTime + ' s  --  check your reading carefully next time (actual: ' + state.pendingActual.toFixed(1) + ' cm\u00B3)', 'warn');
    }

    /* Hide prompt, advance */
    recordPrompt.hidden = true;
    btnRecord.disabled = true;
    state.pendingTime = null;
    state.pendingActual = null;
    state.paused = false;
    state.nextReadingIdx++;

    /* Update graph with recorded data so far */
    drawGraph();

    /* Resume animation */
    state.lastFrame = 0;
    state.animId = requestAnimationFrame(animate);
  }

  /* --- Animation loop --- */
  function animate(timestamp) {
    if (!state.running || state.paused) return;

    var dt = state.lastFrame ? (timestamp - state.lastFrame) / 1000 : 0.016;
    dt = Math.min(dt, 0.05);
    state.lastFrame = timestamp;

    /* Speed: 1 real second = 4 simulated seconds */
    var simDt = dt * 4;
    state.elapsed += simDt;

    /* Update gas volume */
    state.gasVolume = gasAtTime(state.elapsed);

    /* Spawn bubbles when reaction is active */
    var completion = state.gasVolume / D.maxGas;
    if (completion < 0.98) {
      spawnBubble();
      if (completion < 0.5) spawnBubble();
    }
    updateBubbles(dt);

    /* Check if we have reached the next time point that needs recording */
    if (state.nextReadingIdx < D.timePoints.length &&
        state.elapsed >= D.timePoints[state.nextReadingIdx]) {
      /* Pause and prompt student to record */
      var tp = D.timePoints[state.nextReadingIdx];
      /* Snap gas volume to the exact time point value */
      state.gasVolume = gasAtTime(tp);
      state.elapsed = tp;
      promptForReading(tp);
      return; /* stop animating until student records */
    }

    /* Timer display */
    timerEl.textContent = Math.floor(state.elapsed) + ' s';

    /* Check completion */
    if (state.elapsed >= 120) {
      finishRun();
      return;
    }

    draw();
    drawGraph();
    state.animId = requestAnimationFrame(animate);
  }

  /* --- Start / Reset --- */
  function startReaction() {
    if (state.running) return;

    state.concentration = parseFloat(selConc.value);
    state.chipSize = selChips.value;
    state.elapsed = 0;
    state.gasVolume = 0;
    state.bubbles = [];
    state.readings = [];
    state.nextReadingIdx = 0;
    state.pendingTime = null;
    state.pendingActual = null;
    state.paused = false;
    state.lastFrame = 0;
    state.running = true;
    state.score = { correct: 0, total: 0 };

    buildTable();
    rateCalc.hidden = true;
    btnStart.disabled = true;
    btnRecord.disabled = true;
    recordPrompt.hidden = true;
    selConc.disabled = true;
    selChips.disabled = true;

    highlightStep('pour');
    toast('Reaction started! Read the gas syringe and record each volume when prompted.');

    state.animId = requestAnimationFrame(animate);
  }

  function finishRun() {
    state.running = false;
    state.paused = false;
    cancelAnimationFrame(state.animId);
    recordPrompt.hidden = true;
    btnRecord.disabled = true;

    state.gasVolume = gasAtTime(120);
    draw();
    drawGraph();

    /* Calculate initial rate (first 10 s) */
    var initRate = (gasAtTime(10) - gasAtTime(0)) / 10;
    rateValue.textContent = initRate.toFixed(2) + ' cm\u00B3/s';
    rateCalc.hidden = false;

    /* Store run */
    state.allRuns.push({
      conc: state.concentration,
      chip: state.chipSize,
      readings: state.readings.slice()
    });

    btnStart.disabled = false;
    selConc.disabled = false;
    selChips.disabled = false;

    highlightStep('repeat');

    /* Score feedback */
    var pctCorrect = state.score.total > 0
      ? Math.round((state.score.correct / state.score.total) * 100) : 0;
    toast('Run complete! Accuracy: ' + pctCorrect + '% (' + state.score.correct + '/' + state.score.total + ' readings within tolerance). Change variables and repeat.', 'success');

    if (typeof LabAudio !== 'undefined') LabAudio.success();
    if (typeof LabProgress !== 'undefined') LabProgress.markComplete('rates-of-reaction');

    /* Export buttons */
    var exportArea = document.getElementById('export-area');
    exportArea.innerHTML = '';
    if (typeof LabExport !== 'undefined') {
      LabExport.addExportButtons(exportArea, {
        canvas: graph,
        filename: 'rates-graph.png',
        table: document.getElementById('data-table'),
        csvFilename: 'rates-data.csv'
      });
    }
  }

  function resetAll() {
    state.running = false;
    state.paused = false;
    cancelAnimationFrame(state.animId);
    state.elapsed = 0;
    state.gasVolume = 0;
    state.bubbles = [];
    state.readings = [];
    state.allRuns = [];
    state.nextReadingIdx = 0;
    state.pendingTime = null;
    state.pendingActual = null;

    btnStart.disabled = false;
    btnRecord.disabled = true;
    recordPrompt.hidden = true;
    selConc.disabled = false;
    selChips.disabled = false;
    timerEl.textContent = '0 s';
    rateCalc.hidden = true;

    buildTable();
    draw();
    clearGraph();
    highlightStep('measure');
  }

  btnStart.addEventListener('click', startReaction);
  btnReset.addEventListener('click', resetAll);
  btnRecord.addEventListener('click', submitReading);

  /* Allow Enter key to submit reading */
  recordPrompt.querySelector('.reading-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitReading();
    }
  });

  /* --- Graph --- */
  var GW = graph.width, GH = graph.height;

  function drawGraph() {
    gctx.clearRect(0, 0, GW, GH);

    var pad = { top: 20, right: 15, bottom: 35, left: 45 };
    var plotW = GW - pad.left - pad.right;
    var plotH = GH - pad.top - pad.bottom;

    /* Axes */
    gctx.strokeStyle = '#ccc';
    gctx.lineWidth = 1;
    gctx.beginPath();
    gctx.moveTo(pad.left, pad.top);
    gctx.lineTo(pad.left, pad.top + plotH);
    gctx.lineTo(pad.left + plotW, pad.top + plotH);
    gctx.stroke();

    /* Labels */
    gctx.fillStyle = '#666';
    gctx.font = '10px Inter, sans-serif';
    gctx.textAlign = 'center';
    gctx.fillText('Time / s', pad.left + plotW / 2, GH - 5);
    gctx.save();
    gctx.translate(12, pad.top + plotH / 2);
    gctx.rotate(-Math.PI / 2);
    gctx.fillText('Volume CO\u2082 / cm\u00B3', 0, 0);
    gctx.restore();

    /* Tick marks */
    gctx.font = '9px Inter, sans-serif';
    gctx.textAlign = 'center';
    for (var t = 0; t <= 120; t += 30) {
      var tx = pad.left + (t / 120) * plotW;
      gctx.fillText(t, tx, pad.top + plotH + 14);
      gctx.strokeStyle = '#eee';
      gctx.beginPath();
      gctx.moveTo(tx, pad.top);
      gctx.lineTo(tx, pad.top + plotH);
      gctx.stroke();
    }
    gctx.textAlign = 'right';
    for (var v = 0; v <= D.maxGas; v += 10) {
      var vy = pad.top + plotH - (v / D.maxGas) * plotH;
      gctx.fillText(v, pad.left - 6, vy + 3);
    }

    /* Plot completed runs */
    var colors = ['#4361ee', '#06d6a0', '#f77f00', '#ef476f'];
    for (var r = 0; r < state.allRuns.length; r++) {
      plotLine(state.allRuns[r].readings, colors[r % colors.length], pad, plotW, plotH);
    }

    /* Plot current run in progress */
    if ((state.running || state.paused) && state.readings.length > 0) {
      plotLine(state.readings, colors[state.allRuns.length % colors.length], pad, plotW, plotH);
    }
  }

  function plotLine(readings, color, pad, plotW, plotH) {
    if (readings.length < 1) return;
    gctx.strokeStyle = color;
    gctx.lineWidth = 2;
    gctx.beginPath();
    for (var i = 0; i < readings.length; i++) {
      var x = pad.left + (readings[i].time / 120) * plotW;
      var y = pad.top + plotH - (readings[i].vol / D.maxGas) * plotH;
      if (i === 0) gctx.moveTo(x, y); else gctx.lineTo(x, y);
    }
    gctx.stroke();

    /* Points */
    gctx.fillStyle = color;
    for (var j = 0; j < readings.length; j++) {
      var px = pad.left + (readings[j].time / 120) * plotW;
      var py = pad.top + plotH - (readings[j].vol / D.maxGas) * plotH;
      gctx.beginPath();
      gctx.arc(px, py, 3, 0, Math.PI * 2);
      gctx.fill();
    }
  }

  function clearGraph() {
    gctx.clearRect(0, 0, GW, GH);
  }

  /* --- Procedure steps --- */
  function highlightStep(id) {
    var items = procList.querySelectorAll('li');
    var found = false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === 'step-' + id) {
        items[i].className = 'active';
        found = true;
      } else if (!found) {
        items[i].className = 'done';
      } else {
        items[i].className = '';
      }
    }
  }

  /* --- Toast --- */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4500);
  }

  /* --- Init --- */
  highlightStep('measure');
  draw();
  if (typeof LabProgress !== 'undefined') LabProgress.markVisited('rates-of-reaction');
})();
