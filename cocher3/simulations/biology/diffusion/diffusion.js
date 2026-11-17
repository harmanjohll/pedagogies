/* ============================================================
   Diffusion Practical — Biology Simulation
   Canvas-based KMnO4 spreading & agar cube decolourisation
   with timer, data collection, and graphing
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const DATA = DIFFUSION_DATA;
  const TEMP = DATA.tempExperiment;
  const AGAR = DATA.agarExperiment;

  // ── State ──
  const state = {
    experiment: 'temperature',   // 'temperature' | 'agar'

    // Speed multiplier
    speedMultiplier: 1,
    speedOptions: [1, 10, 50],
    speedIndex: 0,

    // Temperature experiment
    selectedTemp: null,
    crystalDropped: false,
    spreadRadius: 0,             // current radius in mm
    spreadRate: 0,               // mm/s at selected temp
    spreading: false,
    tempTimerStart: 0,
    tempTimerElapsed: 0,
    tempReached: false,          // true when radius >= 15mm
    tempResults: [],             // [{temp, time, distance, rate}]
    completedTemps: new Set(),

    // Agar experiment
    agarStarted: false,
    agarRunning: false,
    agarTimerStart: 0,
    agarTimerElapsed: 0,
    cubes: [],                   // [{size, depth, done, recordedTime}]
    agarResults: [],             // [{size, sa, vol, saToV, time}]
    allCubesDone: false,

    // Animation
    animFrameId: null,
    lastFrameTime: 0,

    // Procedure tracking
    currentStep: 0,
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas:           $('sim-canvas'),
    experimentSelect: $('experiment-select'),
    tempControlsPanel: $('temp-controls-panel'),
    agarControlsPanel: $('agar-controls-panel'),
    tempSelector:     $('temp-selector'),
    tempIndicator:    $('temp-indicator'),
    tempIndicatorVal: $('temp-indicator-value'),
    timerDisplay:     $('timer-display'),
    radiusLabel:      $('radius-label'),
    radiusDisplay:    $('radius-display'),
    stopwatchDisplay: $('stopwatch-display'),
    btnDrop:          $('btn-drop'),
    btnPlaceCubes:    $('btn-place-cubes'),
    btnRecord:        $('btn-record'),
    btnSpeed:         $('btn-speed'),
    btnReset:         $('btn-reset'),
    btnToggleGuide:   $('btn-toggle-guide'),
    guidePanel:       $('guide-panel'),
    procedureList:    $('procedure-list'),
    tempResultsTable: $('temp-results-table'),
    tempResultsTbody: $('temp-results-tbody'),
    agarResultsTable: $('agar-results-table'),
    agarResultsTbody: $('agar-results-tbody'),
    dataEmpty:        $('data-empty'),
    graphCanvas:      $('graph-canvas'),
    analysisSection:  $('analysis-section'),
    workbenchArea:    $('workbench-area'),
    toastContainer:   $('toast-container'),
  };

  const ctx = dom.canvas.getContext('2d');
  const gCtx = dom.graphCanvas.getContext('2d');

  // ── Canvas sizing ──
  function resizeCanvas() {
    const area = dom.workbenchArea;
    dom.canvas.width = area.clientWidth;
    dom.canvas.height = area.clientHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', () => {
    resizeCanvas();
    drawCurrentFrame();
  });


  // ══════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════

  function toast(message, type) {
    if (!dom.toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type || 'info'}`;
    el.textContent = message;
    dom.toastContainer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 300);
    }, 2500);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }

  /* Non-blocking inline input (replaces prompt()) */
  function showInlineInput(label, onSubmit) {
    const wrap = document.createElement('div');
    wrap.className = 'inline-prompt';
    wrap.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px;background:var(--color-surface-alt,#f8f8f8);border:1px solid var(--color-border,#ddd);border-radius:6px;margin:8px 0;';
    const lbl = document.createElement('span');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size:0.85rem;flex:1 1 100%;margin-bottom:4px;';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.step = '0.1';
    inp.className = 'calc-input';
    inp.style.cssText = 'width:100px;';
    const btn = document.createElement('button');
    btn.textContent = 'Submit';
    btn.className = 'btn btn-primary btn-xs';
    wrap.appendChild(lbl);
    wrap.appendChild(inp);
    wrap.appendChild(btn);
    dom.btnRecord.parentElement.insertBefore(wrap, dom.btnRecord);
    inp.focus();
    function submit() {
      if (!inp.value) return;
      wrap.remove();
      onSubmit(inp.value);
    }
    btn.addEventListener('click', submit);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  }


  // ══════════════════════════════════════
  // EXPERIMENT SWITCHING
  // ══════════════════════════════════════

  dom.experimentSelect.addEventListener('change', () => {
    switchExperiment(dom.experimentSelect.value);
  });

  function switchExperiment(exp) {
    stopAnimation();
    state.experiment = exp;

    const isTemp = exp === 'temperature';
    dom.tempControlsPanel.style.display = isTemp ? '' : 'none';
    dom.agarControlsPanel.style.display = isTemp ? 'none' : '';
    dom.tempResultsTable.style.display  = isTemp ? '' : 'none';
    dom.agarResultsTable.style.display  = isTemp ? 'none' : '';
    dom.btnDrop.style.display           = isTemp ? '' : 'none';
    dom.btnPlaceCubes.style.display     = isTemp ? 'none' : '';
    dom.tempIndicator.style.display     = 'none';
    dom.radiusLabel.style.display       = isTemp ? '' : 'none';
    dom.radiusDisplay.style.display     = isTemp ? '' : 'none';

    resetExperiment();
    buildProcedure();
    buildAnalysisQuestions();
    drawCurrentFrame();
    toast(isTemp ? 'Temperature & Diffusion selected' : 'Agar Cubes (SA:V) selected');
  }


  // ══════════════════════════════════════
  // PROCEDURE STEPS
  // ══════════════════════════════════════

  function buildProcedure() {
    const steps = state.experiment === 'temperature'
      ? DATA.procedures.temperature
      : DATA.procedures.agar;
    dom.procedureList.innerHTML = '';
    steps.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'procedure-step' + (i === 0 ? ' active' : '');
      li.textContent = s.text;
      li.dataset.key = s.key;
      dom.procedureList.appendChild(li);
    });
    state.currentStep = 0;
  }

  function advanceProcedure(stepIndex) {
    const items = dom.procedureList.querySelectorAll('.procedure-step');
    items.forEach((li, i) => {
      li.classList.remove('active');
      if (i < stepIndex) li.classList.add('done');
      if (i === stepIndex) li.classList.add('active');
    });
    state.currentStep = stepIndex;
  }


  // ══════════════════════════════════════
  // ANALYSIS QUESTIONS
  // ══════════════════════════════════════

  function buildAnalysisQuestions() {
    const questions = state.experiment === 'temperature'
      ? DATA.analysisQuestions.temperature
      : DATA.analysisQuestions.agar;
    dom.analysisSection.innerHTML = '';
    questions.forEach(q => {
      const div = document.createElement('div');
      div.className = 'analysis-question';
      div.innerHTML = `
        <div class="analysis-question-text">${q.question}</div>
        <textarea class="analysis-answer" placeholder="Type your answer..." rows="3"></textarea>
        <div class="analysis-hint" data-id="${q.id}">Show hint</div>
        <div class="analysis-model-answer" id="model-${q.id}">${q.modelAnswer}</div>
      `;
      dom.analysisSection.appendChild(div);
    });

    // Hint toggles
    dom.analysisSection.querySelectorAll('.analysis-hint').forEach(hint => {
      hint.addEventListener('click', () => {
        const qId = hint.dataset.id;
        const qData = questions.find(q => q.id === qId);
        const modelEl = $('model-' + qId);
        if (modelEl.classList.contains('visible')) {
          modelEl.classList.remove('visible');
          hint.textContent = 'Show hint';
        } else {
          // First click shows hint, second shows model answer
          if (hint.textContent === 'Show hint') {
            hint.textContent = qData.hint + ' (click for model answer)';
          } else {
            modelEl.classList.add('visible');
            hint.textContent = 'Hide model answer';
          }
        }
      });
    });
  }


  // ══════════════════════════════════════
  // SPEED CONTROL
  // ══════════════════════════════════════

  dom.btnSpeed.addEventListener('click', () => {
    state.speedIndex = (state.speedIndex + 1) % state.speedOptions.length;
    state.speedMultiplier = state.speedOptions[state.speedIndex];
    dom.btnSpeed.textContent = `Speed: x${state.speedMultiplier}`;
    toast(`Time acceleration: x${state.speedMultiplier}`);
  });


  // ══════════════════════════════════════
  // TEMPERATURE EXPERIMENT
  // ══════════════════════════════════════

  // Temperature chip selection
  dom.tempSelector.querySelectorAll('.temp-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const temp = parseInt(chip.dataset.temp);
      if (state.completedTemps.has(temp)) {
        toast(`${temp}\u00b0C already recorded. Choose another temperature.`, 'warn');
        return;
      }
      if (state.spreading) {
        toast('Wait for the current experiment to finish or reset.', 'warn');
        return;
      }

      // Deselect all, select this one
      dom.tempSelector.querySelectorAll('.temp-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      state.selectedTemp = temp;
      state.spreadRate = TEMP.spreadRates[temp];
      state.crystalDropped = false;
      state.spreadRadius = 0;
      state.tempReached = false;
      state.tempTimerElapsed = 0;

      dom.btnDrop.disabled = false;
      dom.btnRecord.disabled = true;
      dom.tempIndicator.style.display = '';
      dom.tempIndicatorVal.textContent = temp;
      dom.timerDisplay.textContent = '0.0 s';
      dom.radiusDisplay.textContent = '0.0 mm';

      advanceProcedure(1);
      drawCurrentFrame();
      toast(`Selected ${temp}\u00b0C. Drop the crystal when ready.`);
    });
  });

  // Drop crystal
  dom.btnDrop.addEventListener('click', () => {
    if (state.selectedTemp === null || state.crystalDropped) return;

    state.crystalDropped = true;
    state.spreading = true;
    state.spreadRadius = 0;
    state.tempTimerStart = performance.now();
    state.tempTimerElapsed = 0;
    state.tempReached = false;

    dom.btnDrop.disabled = true;
    dom.btnRecord.disabled = true;

    advanceProcedure(2);
    startAnimation();
    toast('Crystal dropped! Observe the purple colour spreading.');
  });

  function updateTempExperiment(dt) {
    if (!state.spreading || state.tempReached) return;

    const effectiveDt = dt * state.speedMultiplier;
    const noise = 1 + (Math.random() - 0.5) * 2 * TEMP.noiseFactor;
    state.spreadRadius += state.spreadRate * effectiveDt * noise;
    state.tempTimerElapsed += effectiveDt;

    // Update displays
    dom.timerDisplay.textContent = state.tempTimerElapsed.toFixed(1) + ' s';
    dom.radiusDisplay.textContent = state.spreadRadius.toFixed(1) + ' mm';

    // Check if target radius reached
    if (state.spreadRadius >= TEMP.targetRadiusMM) {
      state.spreadRadius = TEMP.targetRadiusMM;
      state.tempReached = true;
      state.spreading = false;
      dom.btnRecord.disabled = false;
      dom.radiusDisplay.textContent = TEMP.targetRadiusMM.toFixed(1) + ' mm';
      advanceProcedure(4);
      toast(`Colour reached ${TEMP.targetRadiusMM} mm! Record your result.`, 'success');
    }
  }


  // ══════════════════════════════════════
  // AGAR EXPERIMENT
  // ══════════════════════════════════════

  dom.btnPlaceCubes.addEventListener('click', () => {
    if (state.agarRunning) return;

    // Initialise cubes
    state.cubes = AGAR.cubeData.map(cd => ({
      size: cd.size,
      maxDepth: cd.size / 2,   // acid must reach centre = half side length
      depth: 0,                // how far acid has penetrated (cm)
      done: false,
      recordedTime: null,
    }));

    state.agarStarted = true;
    state.agarRunning = true;
    state.allCubesDone = false;
    state.agarTimerStart = performance.now();
    state.agarTimerElapsed = 0;

    dom.btnPlaceCubes.disabled = true;
    dom.btnRecord.disabled = true;

    advanceProcedure(2);
    startAnimation();
    toast('Cubes placed in acid. Watch the pink colour disappear from outside in.');
  });

  function updateAgarExperiment(dt) {
    if (!state.agarRunning) return;

    const effectiveDt = dt * state.speedMultiplier;
    state.agarTimerElapsed += effectiveDt;
    dom.timerDisplay.textContent = state.agarTimerElapsed.toFixed(1) + ' s';

    let anyStillRunning = false;
    state.cubes.forEach(cube => {
      if (cube.done) return;
      const noise = 1 + (Math.random() - 0.5) * 2 * AGAR.noiseFactor;
      cube.depth += AGAR.diffusionRateInward * effectiveDt * noise;
      if (cube.depth >= cube.maxDepth) {
        cube.depth = cube.maxDepth;
        cube.done = true;
        cube.recordedTime = state.agarTimerElapsed;
        toast(`${cube.size} cm cube fully decolourised at ${cube.recordedTime.toFixed(1)} s`, 'success');
      } else {
        anyStillRunning = true;
      }
    });

    if (!anyStillRunning && !state.allCubesDone) {
      state.allCubesDone = true;
      state.agarRunning = false;
      dom.btnRecord.disabled = false;
      advanceProcedure(4);
      toast('All cubes decolourised! Record your results.', 'success');
    }
  }


  // ══════════════════════════════════════
  // RECORD RESULTS
  // ══════════════════════════════════════

  dom.btnRecord.addEventListener('click', () => {
    if (state.experiment === 'temperature') {
      recordTempResult();
    } else {
      recordAgarResults();
    }
  });

  function recordTempResult() {
    if (state.selectedTemp === null || !state.tempReached) return;

    let time, distance, rate;

    // Independent mode: non-blocking inline entry
    if (typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided()) {
      showInlineInput(
        `Enter time for colour to reach ${TEMP.targetRadiusMM} mm at ${state.selectedTemp}\u00b0C (seconds):`,
        function (val) {
          const parsed = parseFloat(val);
          if (isNaN(parsed) || parsed <= 0) {
            toast('Please enter a valid positive time.', 'warn');
            return;
          }
          const t = parsed;
          const d = TEMP.targetRadiusMM;
          const r = d / t;
          finishTempRecord(t, d, r);
        }
      );
      return;
    } else {
      time = DATA.addNoise(state.tempTimerElapsed, 0.03);
      distance = TEMP.targetRadiusMM;
      rate = distance / time;
    }

    finishTempRecord(time, distance, rate);
  }

  function finishTempRecord(time, distance, rate) {
    const result = {
      temp: state.selectedTemp,
      time: time,
      distance: distance,
      rate: rate,
    };
    state.tempResults.push(result);
    state.completedTemps.add(state.selectedTemp);

    // Mark chip as completed
    dom.tempSelector.querySelectorAll('.temp-chip').forEach(c => {
      if (parseInt(c.dataset.temp) === state.selectedTemp) {
        c.classList.remove('active');
        c.classList.add('completed');
      }
    });

    // Add row to table
    dom.dataEmpty.style.display = 'none';
    const row = document.createElement('tr');
    row.className = 'animate-fade-in';
    row.innerHTML = `
      <td>${result.temp}</td>
      <td>${result.time.toFixed(1)}</td>
      <td>${result.distance.toFixed(1)}</td>
      <td>${result.rate.toFixed(4)}</td>
    `;
    dom.tempResultsTbody.appendChild(row);

    // Reset for next temperature
    state.spreading = false;
    state.crystalDropped = false;
    state.selectedTemp = null;
    dom.btnDrop.disabled = true;
    dom.btnRecord.disabled = true;
    dom.tempIndicator.style.display = 'none';

    if (state.completedTemps.size >= TEMP.temperatures.length) {
      advanceProcedure(6);
      toast('All temperatures recorded! Check the graph and answer the analysis questions.', 'success');
    } else {
      advanceProcedure(5);
      toast(`Recorded! ${TEMP.temperatures.length - state.completedTemps.size} temperature(s) remaining.`);
    }

    drawGraph();
    drawCurrentFrame();
  }

  function recordAgarResults() {
    if (!state.allCubesDone) return;

    // Independent mode: non-blocking sequential inline entry
    if (typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided()) {
      let cubeIdx = 0;
      function askNextCube() {
        if (cubeIdx >= state.cubes.length) {
          finishAgarRecord();
          return;
        }
        const cube = state.cubes[cubeIdx];
        showInlineInput(
          `Enter decolourisation time for ${cube.size} cm cube (seconds):`,
          function (val) {
            const parsed = parseFloat(val);
            if (!isNaN(parsed) && parsed > 0) {
              cube.recordedTime = parsed;
            }
            cubeIdx++;
            askNextCube();
          }
        );
      }
      askNextCube();
      return;
    }

    finishAgarRecord();
  }

  function finishAgarRecord() {
    dom.dataEmpty.style.display = 'none';
    state.agarResults = [];

    state.cubes.forEach(cube => {
      const sav = DATA.calcSAVRatio(cube.size);
      const result = {
        size: cube.size,
        sa: sav.surfaceArea,
        vol: sav.volume,
        saToV: sav.ratio,
        time: DATA.addNoise(cube.recordedTime, 0.03),
      };
      state.agarResults.push(result);

      const row = document.createElement('tr');
      row.className = 'animate-fade-in';
      row.innerHTML = `
        <td>${result.size}</td>
        <td>${result.sa}</td>
        <td>${result.vol}</td>
        <td>${result.saToV.toFixed(1)}:1</td>
        <td>${result.time.toFixed(1)}</td>
      `;
      dom.agarResultsTbody.appendChild(row);
    });

    dom.btnRecord.disabled = true;
    dom.btnPlaceCubes.disabled = true;
    advanceProcedure(6);
    drawGraph();
    toast('All agar results recorded! Check the graph and analysis questions.', 'success');
  }


  // ══════════════════════════════════════
  // ANIMATION LOOP
  // ══════════════════════════════════════

  function startAnimation() {
    state.lastFrameTime = 0;
    if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
    state.animFrameId = requestAnimationFrame(animationLoop);
  }

  function stopAnimation() {
    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
      state.animFrameId = null;
    }
  }

  function animationLoop(timestamp) {
    if (!state.lastFrameTime) state.lastFrameTime = timestamp;
    const dt = Math.min((timestamp - state.lastFrameTime) / 1000, 0.1); // cap at 100ms
    state.lastFrameTime = timestamp;

    if (state.experiment === 'temperature') {
      updateTempExperiment(dt);
    } else {
      updateAgarExperiment(dt);
    }

    drawCurrentFrame();

    // Keep animating if experiment running
    const stillRunning = state.experiment === 'temperature'
      ? (state.spreading && !state.tempReached)
      : state.agarRunning;

    if (stillRunning) {
      state.animFrameId = requestAnimationFrame(animationLoop);
    } else {
      state.animFrameId = null;
    }
  }


  // ══════════════════════════════════════
  // CANVAS DRAWING
  // ══════════════════════════════════════

  function drawCurrentFrame() {
    if (state.experiment === 'temperature') {
      drawTempExperiment();
    } else {
      drawAgarExperiment();
    }
  }

  // ── Temperature experiment drawing ──
  function drawTempExperiment() {
    const W = dom.canvas.width;
    const H = dom.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const benchH = 40;
    const beakerW = 200;
    const beakerH = 200;
    const bx = (W - beakerW) / 2;
    const by = H - benchH - beakerH - 30;

    // Water in beaker
    ctx.fillStyle = TEMP.waterColour;
    ctx.beginPath();
    ctx.moveTo(bx + 8, by + 30);
    ctx.lineTo(bx + 8, by + beakerH - 8);
    ctx.quadraticCurveTo(bx + 8, by + beakerH, bx + 16, by + beakerH);
    ctx.lineTo(bx + beakerW - 16, by + beakerH);
    ctx.quadraticCurveTo(bx + beakerW - 8, by + beakerH, bx + beakerW - 8, by + beakerH - 8);
    ctx.lineTo(bx + beakerW - 8, by + 30);
    ctx.closePath();
    ctx.fill();

    // Beaker outline
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by + beakerH - 8);
    ctx.quadraticCurveTo(bx, by + beakerH + 4, bx + 12, by + beakerH + 4);
    ctx.lineTo(bx + beakerW - 12, by + beakerH + 4);
    ctx.quadraticCurveTo(bx + beakerW, by + beakerH + 4, bx + beakerW, by + beakerH - 8);
    ctx.lineTo(bx + beakerW, by);
    ctx.stroke();

    // Spout
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - 8, by - 5);
    ctx.stroke();

    // Beaker graduations
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.font = '9px Inter, sans-serif';
    ctx.fillStyle = 'rgba(200, 220, 255, 0.35)';
    ctx.textAlign = 'left';
    for (let i = 1; i <= 4; i++) {
      const gy = by + beakerH - (i * beakerH * 0.2);
      ctx.beginPath();
      ctx.moveTo(bx + 12, gy);
      ctx.lineTo(bx + 30, gy);
      ctx.stroke();
      ctx.fillText(`${i * 50} ml`, bx + 33, gy + 3);
    }

    // Crystal and spread
    if (state.crystalDropped) {
      const cx = W / 2;
      const cy = by + beakerH * 0.45;

      // Spread radius in pixels (scale: 15mm -> ~80px)
      const maxPixelRadius = Math.min(beakerW * 0.42, beakerH * 0.42);
      const pixelRadius = (state.spreadRadius / TEMP.targetRadiusMM) * maxPixelRadius;

      // Radial gradient for spreading colour
      if (pixelRadius > 0) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pixelRadius);
        grad.addColorStop(0, TEMP.spreadColourInner);
        grad.addColorStop(0.6, 'rgba(140, 20, 170, 0.35)');
        grad.addColorStop(1, TEMP.spreadColourOuter);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, pixelRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crystal (small dark square)
      ctx.fillStyle = TEMP.crystalColour;
      ctx.fillRect(cx - 3, cy - 3, 6, 6);

      // 15mm target radius circle (dashed)
      ctx.strokeStyle = 'rgba(255, 255, 100, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, maxPixelRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label the target
      ctx.fillStyle = 'rgba(255, 255, 100, 0.6)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('15 mm', cx + maxPixelRadius + 5, cy + 3);

      // Measurement line from centre to current radius
      if (pixelRadius > 5) {
        ctx.strokeStyle = 'rgba(255, 255, 100, 0.7)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + pixelRadius, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(state.spreadRadius.toFixed(1) + ' mm', cx + pixelRadius / 2, cy - 8);
      }
    }

    // Prompt text
    if (!state.crystalDropped && state.selectedTemp !== null) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click "Drop Crystal" to begin', W / 2, by - 10);
    } else if (state.selectedTemp === null) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select a temperature to begin', W / 2, H / 2);
    }

    // Thermometer icon
    if (state.selectedTemp !== null) {
      drawThermometer(bx + beakerW + 25, by + 30, state.selectedTemp);
    }
  }

  function drawThermometer(x, y, temp) {
    const h = 120;
    const w = 14;
    const fillFrac = (temp - 10) / 60; // 10-70 range

    // Tube
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y, w, h, 5);
    ctx.stroke();

    // Mercury
    ctx.fillStyle = 'rgba(220, 60, 60, 0.8)';
    const fillH = h * fillFrac;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 3, y + h - fillH, w - 6, fillH - 2, 2);
    ctx.fill();

    // Bulb
    ctx.beginPath();
    ctx.arc(x, y + h + 8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.5)';
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(temp + '\u00b0C', x, y - 8);
  }

  // ── Agar experiment drawing ──
  function drawAgarExperiment() {
    const W = dom.canvas.width;
    const H = dom.canvas.height;
    ctx.clearRect(0, 0, W, H);

    const benchH = 40;
    const trayW = W * 0.75;
    const trayH = 120;
    const trayX = (W - trayW) / 2;
    const trayY = H - benchH - trayH - 40;

    // Tray with acid solution
    ctx.fillStyle = AGAR.acidSolutionColour;
    ctx.beginPath();
    ctx.roundRect(trayX, trayY, trayW, trayH, 6);
    ctx.fill();

    // Tray outline
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(trayX, trayY, trayW, trayH, 6);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dilute HCl Solution', W / 2, trayY + trayH + 16);

    if (!state.agarStarted) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click "Place Cubes in Acid" to begin', W / 2, trayY - 20);

      // Draw cubes above tray (waiting)
      const sizes = AGAR.cubeSizes;
      const gap = 60;
      const totalW = sizes.reduce((a, s) => a + s * 35, 0) + gap * (sizes.length - 1);
      let curX = (W - totalW) / 2;

      sizes.forEach(size => {
        const pxSize = size * 35;
        const cubeY = trayY - pxSize - 20;
        drawAgarCube(curX, cubeY, pxSize, 0, size);
        curX += pxSize + gap;
      });
      return;
    }

    // Draw cubes inside tray
    const sizes = AGAR.cubeSizes;
    const gap = 40;
    const totalW = sizes.reduce((a, s) => a + s * 35, 0) + gap * (sizes.length - 1);
    let curX = (W - totalW) / 2;

    state.cubes.forEach((cube, i) => {
      const pxSize = cube.size * 35;
      const cubeX = curX;
      const cubeY = trayY + (trayH - pxSize) / 2;
      const progress = cube.depth / cube.maxDepth; // 0 to 1

      drawAgarCube(cubeX, cubeY, pxSize, progress, cube.size);

      // Time label under cube
      if (cube.done && cube.recordedTime !== null) {
        ctx.fillStyle = 'rgba(6, 214, 160, 0.9)';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cube.recordedTime.toFixed(1) + ' s', cubeX + pxSize / 2, cubeY + pxSize + 16);
      }

      // Size label above cube
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cube.size + ' cm', cubeX + pxSize / 2, cubeY - 8);

      curX += pxSize + gap;
    });
  }

  function drawAgarCube(x, y, size, progress, labelSize) {
    // Outer clear (decolourised) region
    ctx.fillStyle = AGAR.agarClearColour;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 3);
    ctx.fill();

    // Inner pink (remaining agar) region
    if (progress < 1) {
      const innerFrac = 1 - progress;
      const innerSize = size * innerFrac;
      const offset = (size - innerSize) / 2;
      ctx.fillStyle = AGAR.agarPinkColour;
      ctx.beginPath();
      ctx.roundRect(x + offset, y + offset, innerSize, innerSize, 2);
      ctx.fill();
    }

    // Cube outline
    ctx.strokeStyle = 'rgba(100, 100, 120, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 3);
    ctx.stroke();

    // Progress percentage
    ctx.fillStyle = progress >= 1 ? 'rgba(6, 214, 160, 0.9)' : 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.min(100, Math.round(progress * 100)) + '%', x + size / 2, y + size / 2);
    ctx.textBaseline = 'alphabetic';
  }


  // ══════════════════════════════════════
  // GRAPH DRAWING
  // ══════════════════════════════════════

  function drawGraph() {
    const W = dom.graphCanvas.width;
    const H = dom.graphCanvas.height;
    const pad = { top: 20, right: 15, bottom: 35, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    gCtx.clearRect(0, 0, W, H);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const axisColor = isDark ? '#9ca3af' : '#374151';
    const gridColor = isDark ? '#4b5563' : '#e5e7eb';
    const labelColor = isDark ? '#d1d5db' : '#6b7280';
    const pointColor = '#06d6a0';

    if (state.experiment === 'temperature') {
      drawTempGraph(W, H, pad, plotW, plotH, axisColor, gridColor, labelColor, pointColor);
    } else {
      drawAgarGraph(W, H, pad, plotW, plotH, axisColor, gridColor, labelColor, pointColor);
    }
  }

  function drawTempGraph(W, H, pad, plotW, plotH, axisColor, gridColor, labelColor, pointColor) {
    if (state.tempResults.length === 0) {
      gCtx.fillStyle = labelColor;
      gCtx.font = '11px Inter, sans-serif';
      gCtx.textAlign = 'center';
      gCtx.fillText('Record data to see the graph', W / 2, H / 2);
      return;
    }

    const maxTemp = 55;
    const maxRate = Math.max(0.07, ...state.tempResults.map(d => d.rate)) * 1.2;

    // Axes
    drawAxes(W, H, pad, axisColor);
    drawGridLines(W, H, pad, plotW, plotH, gridColor);

    // Axis labels
    gCtx.fillStyle = labelColor;
    gCtx.font = '9px Inter, sans-serif';
    gCtx.textAlign = 'center';
    gCtx.fillText('Temperature / \u00b0C', W / 2, H - 5);
    gCtx.save();
    gCtx.translate(12, pad.top + plotH / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText('Rate / mm s\u207b\u00b9', 0, 0);
    gCtx.restore();

    // Tick labels - X axis
    gCtx.fillStyle = labelColor;
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const val = (maxTemp * i / 5).toFixed(0);
      const x = pad.left + (plotW * i / 5);
      gCtx.fillText(val, x, H - pad.bottom + 4);
    }
    // Y axis
    gCtx.textAlign = 'right';
    gCtx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const val = (maxRate * (5 - i) / 5).toFixed(3);
      const y = pad.top + (plotH * i / 5);
      gCtx.fillText(val, pad.left - 5, y);
    }

    // Plotting
    const toX = t => pad.left + (t / maxTemp) * plotW;
    const toY = r => pad.top + plotH - (r / maxRate) * plotH;

    // Data points
    gCtx.fillStyle = pointColor;
    state.tempResults.forEach(d => {
      gCtx.beginPath();
      gCtx.arc(toX(d.temp), toY(d.rate), 4, 0, Math.PI * 2);
      gCtx.fill();
    });

    // Best-fit line
    if (state.tempResults.length >= 2) {
      const sorted = [...state.tempResults].sort((a, b) => a.temp - b.temp);
      gCtx.strokeStyle = pointColor;
      gCtx.lineWidth = 1.5;
      gCtx.setLineDash([4, 3]);
      gCtx.beginPath();
      gCtx.moveTo(toX(sorted[0].temp), toY(sorted[0].rate));
      sorted.forEach(d => gCtx.lineTo(toX(d.temp), toY(d.rate)));
      gCtx.stroke();
      gCtx.setLineDash([]);
    }
  }

  function drawAgarGraph(W, H, pad, plotW, plotH, axisColor, gridColor, labelColor, pointColor) {
    if (state.agarResults.length === 0) {
      gCtx.fillStyle = labelColor;
      gCtx.font = '11px Inter, sans-serif';
      gCtx.textAlign = 'center';
      gCtx.fillText('Record data to see the graph', W / 2, H / 2);
      return;
    }

    const maxSAV = 7;
    const maxTime = Math.max(1800, ...state.agarResults.map(d => d.time)) * 1.1;

    // Axes
    drawAxes(W, H, pad, axisColor);
    drawGridLines(W, H, pad, plotW, plotH, gridColor);

    // Axis labels
    gCtx.fillStyle = labelColor;
    gCtx.font = '9px Inter, sans-serif';
    gCtx.textAlign = 'center';
    gCtx.fillText('SA:V Ratio', W / 2, H - 5);
    gCtx.save();
    gCtx.translate(12, pad.top + plotH / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText('Time / s', 0, 0);
    gCtx.restore();

    // Tick labels - X axis
    gCtx.fillStyle = labelColor;
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const val = (maxSAV * i / 5).toFixed(0);
      const x = pad.left + (plotW * i / 5);
      gCtx.fillText(val, x, H - pad.bottom + 4);
    }
    // Y axis
    gCtx.textAlign = 'right';
    gCtx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const val = (maxTime * (5 - i) / 5).toFixed(0);
      const y = pad.top + (plotH * i / 5);
      gCtx.fillText(val, pad.left - 5, y);
    }

    // Plotting
    const toX = sav => pad.left + (sav / maxSAV) * plotW;
    const toY = t => pad.top + plotH - (t / maxTime) * plotH;

    // Data points
    gCtx.fillStyle = pointColor;
    state.agarResults.forEach(d => {
      gCtx.beginPath();
      gCtx.arc(toX(d.saToV), toY(d.time), 4, 0, Math.PI * 2);
      gCtx.fill();
    });

    // Connect with line
    if (state.agarResults.length >= 2) {
      const sorted = [...state.agarResults].sort((a, b) => a.saToV - b.saToV);
      gCtx.strokeStyle = pointColor;
      gCtx.lineWidth = 1.5;
      gCtx.setLineDash([4, 3]);
      gCtx.beginPath();
      gCtx.moveTo(toX(sorted[0].saToV), toY(sorted[0].time));
      sorted.forEach(d => gCtx.lineTo(toX(d.saToV), toY(d.time)));
      gCtx.stroke();
      gCtx.setLineDash([]);
    }
  }

  function drawAxes(W, H, pad, axisColor) {
    gCtx.strokeStyle = axisColor;
    gCtx.lineWidth = 1;
    // Y axis
    gCtx.beginPath();
    gCtx.moveTo(pad.left, pad.top);
    gCtx.lineTo(pad.left, H - pad.bottom);
    gCtx.stroke();
    // X axis
    gCtx.beginPath();
    gCtx.moveTo(pad.left, H - pad.bottom);
    gCtx.lineTo(W - pad.right, H - pad.bottom);
    gCtx.stroke();
  }

  function drawGridLines(W, H, pad, plotW, plotH, gridColor) {
    gCtx.strokeStyle = gridColor;
    gCtx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const y = pad.top + (plotH * i / 5);
      gCtx.beginPath();
      gCtx.moveTo(pad.left, y);
      gCtx.lineTo(W - pad.right, y);
      gCtx.stroke();
    }
    for (let i = 1; i <= 5; i++) {
      const x = pad.left + (plotW * i / 5);
      gCtx.beginPath();
      gCtx.moveTo(x, pad.top);
      gCtx.lineTo(x, H - pad.bottom);
      gCtx.stroke();
    }
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    resetExperiment();
    drawCurrentFrame();
    // Clear graph
    gCtx.clearRect(0, 0, dom.graphCanvas.width, dom.graphCanvas.height);
    toast('Experiment reset.');
  });

  function resetExperiment() {
    stopAnimation();

    if (state.experiment === 'temperature') {
      state.selectedTemp = null;
      state.crystalDropped = false;
      state.spreadRadius = 0;
      state.spreading = false;
      state.tempReached = false;
      state.tempTimerElapsed = 0;
      state.tempResults = [];
      state.completedTemps.clear();

      dom.btnDrop.disabled = true;
      dom.tempIndicator.style.display = 'none';
      dom.tempResultsTbody.innerHTML = '';

      dom.tempSelector.querySelectorAll('.temp-chip').forEach(c => {
        c.classList.remove('active', 'completed');
      });
    } else {
      state.agarStarted = false;
      state.agarRunning = false;
      state.allCubesDone = false;
      state.agarTimerElapsed = 0;
      state.cubes = [];
      state.agarResults = [];

      dom.btnPlaceCubes.disabled = false;
      dom.agarResultsTbody.innerHTML = '';
    }

    state.speedIndex = 0;
    state.speedMultiplier = 1;
    dom.btnSpeed.textContent = 'Speed: x1';

    dom.btnRecord.disabled = true;
    dom.timerDisplay.textContent = '0.0 s';
    dom.radiusDisplay.textContent = '0.0 mm';
    dom.dataEmpty.style.display = '';

    buildProcedure();
  }


  // ══════════════════════════════════════
  // GUIDE TOGGLE
  // ══════════════════════════════════════

  dom.btnToggleGuide.addEventListener('click', () => {
    const visible = dom.guidePanel.style.display !== 'none';
    dom.guidePanel.style.display = visible ? 'none' : '';
  });


  // ══════════════════════════════════════
  // LAB RECORD MODE INTEGRATION
  // ══════════════════════════════════════

  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }


  // ══════════════════════════════════════
  // INITIALISE
  // ══════════════════════════════════════

  buildProcedure();
  buildAnalysisQuestions();
  drawCurrentFrame();

  // Enable agar button by default when that experiment is selected
  dom.btnPlaceCubes.disabled = false;

  // Ensure correct initial state
  switchExperiment('temperature');
});
