/* ============================================================
   Density Practical — Physics Simulation
   Canvas-based workbench with balance, measuring cylinder, and
   object measurement for regular solids, irregular solids, and
   liquids.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const DATA = DENSITY_DATA;

  // ── Helpers ──
  const $ = id => document.getElementById(id);
  const noise = (range) => (Math.random() - 0.5) * 2 * range;
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const round = (val, dp) => parseFloat(val.toFixed(dp));

  // ── State ──
  const state = {
    selectedObject: null,     // current DATA.objects entry
    category: null,           // 'regular' | 'irregular' | 'liquid'
    step: null,               // current procedure step id

    // Measurements (with noise applied)
    measuredMass: 0,
    measuredDimensions: null, // { length, width, height } or { diameter, height }
    measuredVolume: 0,
    calculatedDensity: 0,

    // Irregular method
    cylinderInitialLevel: DATA.measuringCylinder.initialWaterLevel,
    cylinderCurrentLevel: DATA.measuringCylinder.initialWaterLevel,
    objectImmersed: false,

    // Liquid method
    cylinderMassEmpty: 0,
    cylinderMassFull: 0,
    liquidPoured: false,

    // Results
    results: [],              // [{ name, mass, volume, density, actual }]

    // Canvas animation
    animating: false,
    animProgress: 0,
    animType: null,            // 'place' | 'immerse' | 'pour'

    // Object on balance
    objectOnBalance: false,
    dimensionsMeasured: false,
  };

  // ── DOM ──
  const dom = {
    canvas: $('main-canvas'),
    balanceValue: $('balance-value'),
    volumeValue: $('volume-value'),
    densityValue: $('density-value'),
    btnPlace: $('btn-place'),
    btnMeasure: $('btn-measure'),
    btnImmerse: $('btn-immerse'),
    btnPour: $('btn-pour'),
    btnWeighFull: $('btn-weigh-full'),
    btnCalculate: $('btn-calculate'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel: $('guide-panel'),
    regularObjects: $('regular-objects'),
    irregularObjects: $('irregular-objects'),
    liquidObjects: $('liquid-objects'),
    methodBadge: $('method-badge'),
    procedureList: $('procedure-list'),
    resultsTbody: $('results-tbody'),
    dataEmpty: $('data-empty'),
    calcInputs: $('calc-inputs'),
    calcPlaceholder: $('calc-placeholder'),
    inputMass: $('input-mass'),
    inputVolume: $('input-volume'),
    inputDensity: $('input-density'),
    btnCheck: $('btn-check'),
    calcResult: $('calc-result'),
    analysisList: $('analysis-list'),
    scoreSlot: $('score-slot'),
    exportButtons: $('export-buttons'),
    toast: $('toast-container'),
  };

  const ctx = dom.canvas.getContext('2d');

  // ── Scorer ──
  let scorer = null;
  if (typeof LabScore !== 'undefined') {
    scorer = LabScore.create(DATA.scoring);
  }

  // ── LabRecordMode integration ──
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }


  // ══════════════════════════════════════
  // CANVAS SIZING
  // ══════════════════════════════════════

  function resizeCanvas() {
    const panel = dom.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(panel.clientWidth - 32, 700);
    const h = Math.min(panel.clientHeight - 100, 480);
    dom.canvas.width = w * dpr;
    dom.canvas.height = h * dpr;
    dom.canvas.style.width = w + 'px';
    dom.canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);


  // ══════════════════════════════════════
  // OBJECT SELECTOR
  // ══════════════════════════════════════

  function buildObjectSelector() {
    const containers = {
      regular: dom.regularObjects,
      irregular: dom.irregularObjects,
      liquid: dom.liquidObjects,
    };

    DATA.objects.forEach(obj => {
      const btn = document.createElement('button');
      btn.className = 'object-btn';
      btn.dataset.id = obj.id;
      btn.innerHTML = `
        <span class="object-swatch" style="background:${obj.colour || obj.liquidColourSolid || '#888'}"></span>
        <span class="object-name">${obj.name}</span>
      `;
      btn.addEventListener('click', () => selectObject(obj));
      containers[obj.category].appendChild(btn);
    });
  }
  buildObjectSelector();

  function selectObject(obj) {
    // Deselect previous
    document.querySelectorAll('.object-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.object-btn[data-id="${obj.id}"]`);
    if (btn) btn.classList.add('active');

    // Check if already measured
    const alreadyMeasured = state.results.find(r => r.id === obj.id);
    if (alreadyMeasured) {
      toast('You have already measured this object. Select a different one.', 'warn');
      return;
    }

    // Reset measurement state for new object
    resetMeasurementState();

    state.selectedObject = obj;
    state.category = obj.category;
    state.step = 'select';

    // Update method badge
    const labels = { regular: 'Regular Solid', irregular: 'Irregular Solid', liquid: 'Liquid' };
    dom.methodBadge.textContent = labels[obj.category];

    // Build procedure list
    buildProcedureList(obj.category);
    advanceStep('select');

    // Enable first action
    updateActionButtons();

    // Score selecting an object
    if (scorer) scorer.award('selectObj', 1);

    draw();
    toast(`Selected: ${obj.name}`);
    if (typeof LabAudio !== 'undefined') LabAudio.click();
  }


  // ══════════════════════════════════════
  // PROCEDURE LIST
  // ══════════════════════════════════════

  function buildProcedureList(category) {
    dom.procedureList.innerHTML = '';
    const steps = DATA.procedures[category] || [];
    steps.forEach((step, i) => {
      const li = document.createElement('li');
      li.className = 'procedure-step';
      li.id = `step-${step.id}`;
      li.textContent = step.text;
      dom.procedureList.appendChild(li);
    });
  }

  function advanceStep(stepId) {
    state.step = stepId;
    // Highlight current step, mark previous as done
    const steps = DATA.procedures[state.category] || [];
    let pastCurrent = false;
    steps.forEach(step => {
      const el = $(`step-${step.id}`);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (step.id === stepId) {
        el.classList.add('active');
        pastCurrent = true;
      } else if (!pastCurrent) {
        el.classList.add('done');
      }
    });
  }


  // ══════════════════════════════════════
  // ACTION BUTTONS
  // ══════════════════════════════════════

  function updateActionButtons() {
    const obj = state.selectedObject;
    const cat = state.category;

    // Disable all first
    dom.btnPlace.disabled = true;
    dom.btnMeasure.disabled = true;
    dom.btnImmerse.disabled = true;
    dom.btnPour.disabled = true;
    dom.btnWeighFull.disabled = true;
    dom.btnCalculate.disabled = true;

    if (!obj) return;

    if (cat === 'regular') {
      if (state.step === 'select') {
        dom.btnPlace.disabled = false;
      } else if (state.step === 'readMass') {
        dom.btnMeasure.disabled = false;
      } else if (state.step === 'measure' || state.step === 'calcVol') {
        dom.btnCalculate.disabled = false;
      }
    } else if (cat === 'irregular') {
      if (state.step === 'select') {
        dom.btnPlace.disabled = false;
      } else if (state.step === 'readMass' || state.step === 'fillCylinder') {
        dom.btnImmerse.disabled = false;
      } else if (state.step === 'readLevel') {
        dom.btnCalculate.disabled = false;
      }
    } else if (cat === 'liquid') {
      if (state.step === 'select') {
        dom.btnPlace.disabled = false;
      } else if (state.step === 'weighEmpty') {
        dom.btnPour.disabled = false;
      } else if (state.step === 'addLiquid') {
        dom.btnWeighFull.disabled = false;
      } else if (state.step === 'calcMass') {
        dom.btnCalculate.disabled = false;
      }
    }
  }


  // ══════════════════════════════════════
  // MEASUREMENT ACTIONS
  // ══════════════════════════════════════

  // --- Place on Balance ---
  dom.btnPlace.addEventListener('click', () => {
    const obj = state.selectedObject;
    if (!obj) return;

    state.objectOnBalance = true;

    if (state.category === 'liquid') {
      // Weigh empty cylinder
      const emptyMass = DATA.liquidMethod.cylinderMassEmpty + noise(DATA.massNoise);
      state.cylinderMassEmpty = round(emptyMass, 2);
      state.measuredMass = state.cylinderMassEmpty;

      if (isGuided()) {
        dom.balanceValue.textContent = state.cylinderMassEmpty.toFixed(2) + ' g';
      } else {
        const entered = prompt('Read the mass of the empty cylinder from the balance (g):');
        if (entered === null) return;
        const val = parseFloat(entered);
        if (isNaN(val) || val <= 0) { toast('Enter a valid mass.', 'warn'); return; }
        state.cylinderMassEmpty = val;
        dom.balanceValue.textContent = val.toFixed(2) + ' g';
      }

      advanceStep('weighEmpty');
      toast(`Empty cylinder mass: ${state.cylinderMassEmpty.toFixed(2)} g`);
    } else {
      // Regular or irregular solid
      const rawMass = obj.mass + noise(DATA.massNoise);
      state.measuredMass = round(rawMass, 2);

      if (isGuided()) {
        dom.balanceValue.textContent = state.measuredMass.toFixed(2) + ' g';
      } else {
        const entered = prompt('Read the mass from the balance (g):');
        if (entered === null) return;
        const val = parseFloat(entered);
        if (isNaN(val) || val <= 0) { toast('Enter a valid mass.', 'warn'); return; }
        state.measuredMass = val;
        dom.balanceValue.textContent = val.toFixed(2) + ' g';
      }

      advanceStep('readMass');
      if (scorer) scorer.award('readMass', 1);
      toast(`Mass: ${state.measuredMass.toFixed(2)} g`);
    }

    // Animate placement
    runAnimation('place');
    if (typeof LabAudio !== 'undefined') LabAudio.clink();
    updateActionButtons();
  });

  // --- Measure Dimensions (regular solids) ---
  dom.btnMeasure.addEventListener('click', () => {
    const obj = state.selectedObject;
    if (!obj || state.category !== 'regular') return;

    state.dimensionsMeasured = true;

    if (obj.shape === 'cuboid') {
      const l = obj.dimensions.length + noise(DATA.dimensionNoise);
      const w = obj.dimensions.width + noise(DATA.dimensionNoise);
      const h = obj.dimensions.height + noise(DATA.dimensionNoise);

      if (isGuided()) {
        state.measuredDimensions = {
          length: round(l, 2),
          width: round(w, 2),
          height: round(h, 2)
        };
      } else {
        const entL = prompt(`Enter the length (cm):`);
        const entW = prompt(`Enter the width (cm):`);
        const entH = prompt(`Enter the height (cm):`);
        if (entL === null || entW === null || entH === null) return;
        state.measuredDimensions = {
          length: parseFloat(entL) || 0,
          width: parseFloat(entW) || 0,
          height: parseFloat(entH) || 0
        };
      }

      state.measuredVolume = round(
        state.measuredDimensions.length *
        state.measuredDimensions.width *
        state.measuredDimensions.height, 2
      );

      toast(`Dimensions: ${state.measuredDimensions.length} x ${state.measuredDimensions.width} x ${state.measuredDimensions.height} cm`);

    } else if (obj.shape === 'cylinder') {
      const d = obj.dimensions.diameter + noise(DATA.dimensionNoise);
      const h = obj.dimensions.height + noise(DATA.dimensionNoise);

      if (isGuided()) {
        state.measuredDimensions = {
          diameter: round(d, 2),
          height: round(h, 2)
        };
      } else {
        const entD = prompt(`Enter the diameter (cm):`);
        const entH = prompt(`Enter the height (cm):`);
        if (entD === null || entH === null) return;
        state.measuredDimensions = {
          diameter: parseFloat(entD) || 0,
          height: parseFloat(entH) || 0
        };
      }

      const r = state.measuredDimensions.diameter / 2;
      state.measuredVolume = round(Math.PI * r * r * state.measuredDimensions.height, 2);

      toast(`Dimensions: d=${state.measuredDimensions.diameter} cm, h=${state.measuredDimensions.height} cm`);
    }

    dom.volumeValue.textContent = state.measuredVolume.toFixed(2) + ' cm\u00B3';
    advanceStep('calcVol');
    if (scorer) scorer.award('measureVol', 2);
    if (typeof LabAudio !== 'undefined') LabAudio.click();
    updateActionButtons();
    draw();
  });

  // --- Immerse in Cylinder (irregular solids) ---
  dom.btnImmerse.addEventListener('click', () => {
    const obj = state.selectedObject;
    if (!obj || state.category !== 'irregular') return;

    state.objectImmersed = true;
    const displaced = obj.displacedVolume + noise(DATA.volumeNoise);
    state.cylinderCurrentLevel = round(state.cylinderInitialLevel + displaced, 1);
    state.measuredVolume = round(state.cylinderCurrentLevel - state.cylinderInitialLevel, 1);

    if (!isGuided()) {
      const entered = prompt(
        `The initial water level was ${state.cylinderInitialLevel} cm\u00B3.\n` +
        `Read the new water level (cm\u00B3):`
      );
      if (entered === null) return;
      const val = parseFloat(entered);
      if (isNaN(val) || val <= state.cylinderInitialLevel) {
        toast('The new level must be higher than the initial level.', 'warn');
        return;
      }
      state.cylinderCurrentLevel = val;
      state.measuredVolume = round(val - state.cylinderInitialLevel, 1);
    }

    dom.volumeValue.textContent = state.measuredVolume.toFixed(1) + ' cm\u00B3';
    advanceStep('readLevel');
    if (scorer) scorer.award('measureVol', 2);
    toast(`Displaced volume: ${state.measuredVolume.toFixed(1)} cm\u00B3`);

    runAnimation('immerse');
    if (typeof LabAudio !== 'undefined') LabAudio.bubble();
    updateActionButtons();
  });

  // --- Pour Liquid ---
  dom.btnPour.addEventListener('click', () => {
    const obj = state.selectedObject;
    if (!obj || state.category !== 'liquid') return;

    state.liquidPoured = true;
    state.cylinderCurrentLevel = DATA.liquidMethod.pourVolume;

    advanceStep('addLiquid');
    toast(`Poured ${DATA.liquidMethod.pourVolume} cm\u00B3 of ${obj.name}.`);

    runAnimation('pour');
    if (typeof LabAudio !== 'undefined') LabAudio.pour();
    updateActionButtons();
    draw();
  });

  // --- Weigh Full Cylinder (liquid method) ---
  dom.btnWeighFull.addEventListener('click', () => {
    const obj = state.selectedObject;
    if (!obj || state.category !== 'liquid') return;

    const liquidMass = obj.liquidDensity * DATA.liquidMethod.pourVolume;
    const fullMass = DATA.liquidMethod.cylinderMassEmpty + liquidMass + noise(DATA.massNoise);
    state.cylinderMassFull = round(fullMass, 2);

    if (isGuided()) {
      dom.balanceValue.textContent = state.cylinderMassFull.toFixed(2) + ' g';
    } else {
      const entered = prompt('Read the mass of the cylinder with liquid (g):');
      if (entered === null) return;
      const val = parseFloat(entered);
      if (isNaN(val) || val <= 0) { toast('Enter a valid mass.', 'warn'); return; }
      state.cylinderMassFull = val;
      dom.balanceValue.textContent = val.toFixed(2) + ' g';
    }

    // Calculate liquid mass
    state.measuredMass = round(state.cylinderMassFull - state.cylinderMassEmpty, 2);
    state.measuredVolume = DATA.liquidMethod.pourVolume;

    dom.volumeValue.textContent = state.measuredVolume.toFixed(1) + ' cm\u00B3';
    if (scorer) {
      scorer.award('readMass', 1);
      scorer.award('measureVol', 2);
    }

    advanceStep('calcMass');
    toast(`Liquid mass: ${state.measuredMass.toFixed(2)} g (${state.cylinderMassFull.toFixed(2)} - ${state.cylinderMassEmpty.toFixed(2)})`);
    if (typeof LabAudio !== 'undefined') LabAudio.clink();
    updateActionButtons();
    draw();
  });

  // --- Calculate Density ---
  dom.btnCalculate.addEventListener('click', () => {
    const obj = state.selectedObject;
    if (!obj) return;

    // Show calculation inputs
    dom.calcInputs.style.display = '';
    dom.calcPlaceholder.style.display = 'none';

    // Pre-fill mass and volume in guided mode
    if (isGuided()) {
      dom.inputMass.value = state.measuredMass;
      dom.inputVolume.value = state.measuredVolume;
      dom.inputDensity.value = '';
    } else {
      dom.inputMass.value = '';
      dom.inputVolume.value = '';
      dom.inputDensity.value = '';
    }
    dom.inputDensity.focus();

    advanceStep('calcDensity');
    toast('Enter the density in g/cm\u00B3 and click Check Answer.');
    updateActionButtons();
  });


  // ══════════════════════════════════════
  // CHECK ANSWER
  // ══════════════════════════════════════

  dom.btnCheck.addEventListener('click', () => {
    const obj = state.selectedObject;
    if (!obj) return;

    const enteredMass = parseFloat(dom.inputMass.value);
    const enteredVolume = parseFloat(dom.inputVolume.value);
    const enteredDensity = parseFloat(dom.inputDensity.value);

    if (isNaN(enteredDensity) || enteredDensity <= 0) {
      toast('Please enter a valid density value.', 'warn');
      return;
    }

    // Determine the accepted density
    const actualDensity = obj.actualDensity || obj.liquidDensity;

    // Calculate expected from measured values
    const expectedDensity = state.measuredVolume > 0
      ? state.measuredMass / state.measuredVolume
      : 0;

    // Check how close the entered value is to actual
    const percentError = Math.abs((enteredDensity - actualDensity) / actualDensity * 100);
    const closeToExpected = Math.abs(enteredDensity - expectedDensity) / expectedDensity * 100 < 5;

    state.calculatedDensity = enteredDensity;
    dom.densityValue.textContent = enteredDensity.toFixed(2) + ' g/cm\u00B3';

    let resultMsg = '';
    let resultType = '';

    if (percentError <= 10) {
      resultMsg = `Correct! Your density of ${enteredDensity.toFixed(2)} g/cm\u00B3 is within 10% of the accepted value (${actualDensity.toFixed(2)} g/cm\u00B3). Percentage error: ${percentError.toFixed(1)}%.`;
      resultType = 'success';
      if (scorer) {
        scorer.award('calcDensity', 2);
        scorer.award('accuracy', 2);
      }
    } else if (closeToExpected) {
      resultMsg = `Your calculation of ${enteredDensity.toFixed(2)} g/cm\u00B3 matches your measured data, but is ${percentError.toFixed(1)}% from the accepted value (${actualDensity.toFixed(2)} g/cm\u00B3). Check your measurements for systematic errors.`;
      resultType = 'warn';
      if (scorer) scorer.award('calcDensity', 2);
    } else {
      resultMsg = `${enteredDensity.toFixed(2)} g/cm\u00B3 is ${percentError.toFixed(1)}% from the accepted value (${actualDensity.toFixed(2)} g/cm\u00B3). Check your calculation: density = mass / volume = ${state.measuredMass.toFixed(2)} / ${state.measuredVolume.toFixed(2)} = ${expectedDensity.toFixed(2)} g/cm\u00B3.`;
      resultType = 'warn';
    }

    dom.calcResult.style.display = '';
    dom.calcResult.className = 'calc-result-box calc-result-' + resultType;
    dom.calcResult.textContent = resultMsg;

    // Add to results table
    addResult(obj, state.measuredMass, state.measuredVolume, enteredDensity);

    toast(percentError <= 10 ? 'Great result!' : 'Density recorded.', percentError <= 10 ? 'success' : 'info');
    if (typeof LabAudio !== 'undefined') {
      percentError <= 10 ? LabAudio.success() : LabAudio.record();
    }

    // Check multi-object scoring
    if (scorer && state.results.length >= 3) {
      scorer.award('multiObj', 1);
    }

    updateScoreSummary();
  });


  // ══════════════════════════════════════
  // RESULTS TABLE
  // ══════════════════════════════════════

  function addResult(obj, mass, volume, density) {
    const result = {
      id: obj.id,
      name: obj.name,
      mass: mass,
      volume: volume,
      density: density,
      actual: obj.actualDensity || obj.liquidDensity
    };
    state.results.push(result);

    dom.dataEmpty.style.display = 'none';
    const row = document.createElement('tr');
    row.className = 'animate-fade-in';

    const pctErr = Math.abs((density - result.actual) / result.actual * 100);
    const accClass = pctErr <= 10 ? 'text-success' : 'text-warn';

    row.innerHTML = `
      <td>${result.name}</td>
      <td>${result.mass.toFixed(2)}</td>
      <td>${result.volume.toFixed(2)}</td>
      <td class="${accClass}">${result.density.toFixed(2)}</td>
    `;
    dom.resultsTbody.appendChild(row);
  }


  // ══════════════════════════════════════
  // ANALYSIS QUESTIONS
  // ══════════════════════════════════════

  function buildAnalysisQuestions() {
    dom.analysisList.innerHTML = '';
    DATA.analysisQuestions.forEach(q => {
      const li = document.createElement('li');
      li.className = 'analysis-item';
      li.innerHTML = `
        <p class="analysis-question">${q.question}</p>
        <textarea class="analysis-textarea" id="answer-${q.id}" rows="3" placeholder="Type your answer..."></textarea>
        <button class="btn btn-ghost btn-sm mt-1 analysis-reveal-btn" data-qid="${q.id}">Show Answer</button>
        <div class="analysis-answer" id="answer-reveal-${q.id}" style="display:none;">
          <strong>Model answer:</strong> ${q.answer}
        </div>
      `;
      dom.analysisList.appendChild(li);
    });

    // Reveal buttons
    document.querySelectorAll('.analysis-reveal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const revealEl = $(`answer-reveal-${qid}`);
        if (revealEl) {
          revealEl.style.display = revealEl.style.display === 'none' ? '' : 'none';
        }
        if (scorer) scorer.award('answerQ', 1);
        updateScoreSummary();
      });
    });
  }
  buildAnalysisQuestions();


  // ══════════════════════════════════════
  // SCORE SUMMARY
  // ══════════════════════════════════════

  function updateScoreSummary() {
    if (!scorer) return;
    dom.scoreSlot.innerHTML = '';
    dom.scoreSlot.appendChild(scorer.buildSummary());
  }


  // ══════════════════════════════════════
  // EXPORT BUTTONS
  // ══════════════════════════════════════

  if (typeof LabExport !== 'undefined' && dom.exportButtons) {
    LabExport.addExportButtons(dom.exportButtons, {
      table: $('results-table'),
      csvFilename: 'density-results.csv',
    });
  }


  // ══════════════════════════════════════
  // ANIMATION
  // ══════════════════════════════════════

  function runAnimation(type) {
    state.animType = type;
    state.animProgress = 0;
    state.animating = true;
    requestAnimationFrame(animateStep);
  }

  function animateStep(timestamp) {
    if (!state.animating) return;
    state.animProgress += 0.03;
    if (state.animProgress >= 1) {
      state.animProgress = 1;
      state.animating = false;
    }
    draw();
    if (state.animating) {
      requestAnimationFrame(animateStep);
    }
  }


  // ══════════════════════════════════════
  // CANVAS DRAWING
  // ══════════════════════════════════════

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const W = dom.canvas.width / dpr;
    const H = dom.canvas.height / dpr;
    ctx.clearRect(0, 0, W, H);

    drawWorkbench(W, H);
    drawBalance(W, H);
    drawMeasuringCylinder(W, H);
    drawSelectedObject(W, H);
    drawInfoText(W, H);
  }

  // --- Workbench Surface ---
  function drawWorkbench(W, H) {
    // Bench surface
    const benchY = H - 60;
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, benchY, W, 60);

    // Bench edge highlight
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(0, benchY, W, 3);
  }

  // --- Electronic Balance ---
  function drawBalance(W, H) {
    const bx = W * 0.25;
    const by = H - 60;
    const bw = 140;
    const bh = 20;

    // Base
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(bx - bw / 2, by - bh, bw, bh);

    // Platform
    ctx.fillStyle = '#555568';
    ctx.fillRect(bx - bw / 2 + 10, by - bh - 6, bw - 20, 6);

    // Screen
    ctx.fillStyle = '#111';
    ctx.fillRect(bx - 35, by - bh + 3, 70, 14);

    // Reading text
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let displayVal = '0.00 g';
    if (state.objectOnBalance && state.measuredMass > 0) {
      if (state.category === 'liquid' && state.liquidPoured && state.cylinderMassFull > 0) {
        displayVal = state.cylinderMassFull.toFixed(2) + ' g';
      } else if (state.category === 'liquid' && !state.liquidPoured) {
        displayVal = state.cylinderMassEmpty.toFixed(2) + ' g';
      } else {
        displayVal = state.measuredMass.toFixed(2) + ' g';
      }
    }
    ctx.fillText(displayVal, bx, by - bh + 10);

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Electronic Balance', bx, by + 14);
  }

  // --- Measuring Cylinder ---
  function drawMeasuringCylinder(W, H) {
    const cx = W * 0.65;
    const bottom = H - 66;
    const cylW = 40;
    const cylH = 180;
    const top = bottom - cylH;

    // Glass body
    ctx.strokeStyle = 'rgba(180, 200, 230, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - cylW / 2, top);
    ctx.lineTo(cx - cylW / 2, bottom);
    ctx.lineTo(cx + cylW / 2, bottom);
    ctx.lineTo(cx + cylW / 2, top);
    ctx.stroke();

    // Base
    ctx.fillStyle = 'rgba(180, 200, 230, 0.15)';
    ctx.fillRect(cx - cylW / 2 - 5, bottom, cylW + 10, 6);

    // Scale markings
    const maxVol = DATA.measuringCylinder.maxVolume;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '8px Inter, sans-serif';
    ctx.textAlign = 'right';

    for (let v = 0; v <= maxVol; v += 10) {
      const y = bottom - (v / maxVol) * cylH;
      const isMajor = v % 20 === 0;
      ctx.strokeStyle = 'rgba(255,255,255,' + (isMajor ? '0.3' : '0.15') + ')';
      ctx.lineWidth = isMajor ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - cylW / 2 + 2, y);
      ctx.lineTo(cx - cylW / 2 + (isMajor ? 10 : 6), y);
      ctx.stroke();

      if (isMajor && v > 0) {
        ctx.fillText(v.toString(), cx - cylW / 2 - 2, y + 3);
      }
    }

    // Water / liquid fill
    let fillLevel = 0;
    let fillColour = 'rgba(100, 160, 255, 0.3)';

    if (state.category === 'irregular') {
      fillLevel = state.objectImmersed ? state.cylinderCurrentLevel : state.cylinderInitialLevel;
      fillColour = 'rgba(100, 160, 255, 0.3)';
    } else if (state.category === 'liquid' && state.liquidPoured) {
      fillLevel = state.cylinderCurrentLevel;
      fillColour = state.selectedObject ? (state.selectedObject.liquidColour || 'rgba(100, 160, 255, 0.3)') : 'rgba(100, 160, 255, 0.3)';
    } else if (state.category === 'regular') {
      // No liquid in cylinder for regular solids
      fillLevel = 0;
    } else {
      fillLevel = 0;
    }

    // Animate fill level
    if (state.animating && (state.animType === 'immerse' || state.animType === 'pour')) {
      let startLevel;
      if (state.animType === 'immerse') {
        startLevel = state.cylinderInitialLevel;
      } else {
        startLevel = 0;
      }
      const targetLevel = fillLevel;
      fillLevel = startLevel + (targetLevel - startLevel) * easeOut(state.animProgress);
    }

    if (fillLevel > 0) {
      const fillH = (fillLevel / maxVol) * cylH;
      const fillY = bottom - fillH;

      ctx.fillStyle = fillColour;
      ctx.fillRect(cx - cylW / 2 + 2, fillY, cylW - 4, fillH);

      // Meniscus
      ctx.strokeStyle = 'rgba(100, 160, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - cylW / 2 + 2, fillY + 2);
      ctx.quadraticCurveTo(cx, fillY - 2, cx + cylW / 2 - 2, fillY + 2);
      ctx.stroke();

      // Level reading
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(fillLevel.toFixed(1) + ' cm\u00B3', cx + cylW / 2 + 6, fillY + 3);
    }

    // Draw immersed object in cylinder
    if (state.category === 'irregular' && state.objectImmersed && state.selectedObject) {
      const objY = bottom - (state.cylinderInitialLevel / maxVol) * cylH;
      const objSize = Math.min(cylW - 12, 20);

      let drawY = objY;
      if (state.animating && state.animType === 'immerse') {
        drawY = top + (objY - top) * easeOut(state.animProgress);
      }

      ctx.fillStyle = state.selectedObject.colour || '#888';
      if (state.selectedObject.id === 'stone') {
        drawIrregularShape(ctx, cx, drawY - objSize / 2, objSize);
      } else {
        ctx.fillRect(cx - objSize / 2, drawY - objSize, objSize, objSize * 0.6);
      }
    }

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Measuring Cylinder', cx, H - 46);
    ctx.fillText(`(${maxVol} cm\u00B3)`, cx, H - 36);
  }

  // --- Draw Selected Object ---
  function drawSelectedObject(W, H) {
    const obj = state.selectedObject;
    if (!obj) return;

    const bx = W * 0.25;
    const by = H - 86; // top of balance platform

    if (state.objectOnBalance && !state.objectImmersed) {
      const drawX = bx;
      let drawY = by;

      // Animate placement
      if (state.animating && state.animType === 'place') {
        const startY = by - 80;
        drawY = startY + (by - startY) * easeOut(state.animProgress);
      }

      if (obj.category === 'regular') {
        drawRegularSolid(ctx, obj, drawX, drawY);
      } else if (obj.category === 'irregular') {
        drawIrregularSolid(ctx, obj, drawX, drawY);
      } else if (obj.category === 'liquid') {
        // Draw the measuring cylinder on the balance for liquid method
        drawCylinderOnBalance(ctx, obj, drawX, drawY);
      }
    }

    // If not yet placed, show object floating near selector area
    if (!state.objectOnBalance) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${obj.name} selected`, W / 2, 25);
    }
  }

  // --- Draw Regular Solid ---
  function drawRegularSolid(context, obj, x, y) {
    const colour = obj.colour || '#aaa';
    const dark = obj.colourDark || '#777';

    if (obj.shape === 'cuboid') {
      const dims = obj.dimensions;
      const scale = 6;
      const dw = dims.width * scale;
      const dh = dims.height * scale;
      const dl = dims.length * scale;
      const offset = dl * 0.3;

      // Front face
      context.fillStyle = colour;
      context.fillRect(x - dw / 2, y - dh, dw, dh);

      // Top face
      context.fillStyle = lighten(colour, 20);
      context.beginPath();
      context.moveTo(x - dw / 2, y - dh);
      context.lineTo(x - dw / 2 + offset, y - dh - offset * 0.6);
      context.lineTo(x + dw / 2 + offset, y - dh - offset * 0.6);
      context.lineTo(x + dw / 2, y - dh);
      context.closePath();
      context.fill();

      // Side face
      context.fillStyle = dark;
      context.beginPath();
      context.moveTo(x + dw / 2, y - dh);
      context.lineTo(x + dw / 2 + offset, y - dh - offset * 0.6);
      context.lineTo(x + dw / 2 + offset, y - offset * 0.6);
      context.lineTo(x + dw / 2, y);
      context.closePath();
      context.fill();

      // Dimension labels
      if (state.dimensionsMeasured && state.measuredDimensions) {
        context.fillStyle = 'rgba(255,255,255,0.6)';
        context.font = '9px Inter, sans-serif';
        context.textAlign = 'center';
        context.fillText(state.measuredDimensions.width.toFixed(1) + ' cm', x, y + 12);
        context.save();
        context.translate(x + dw / 2 + 14, y - dh / 2);
        context.fillText(state.measuredDimensions.height.toFixed(1) + ' cm', 0, 0);
        context.restore();
      }

    } else if (obj.shape === 'cylinder') {
      const dims = obj.dimensions;
      const r = (dims.diameter / 2) * 6;
      const h = dims.height * 6;

      // Body
      context.fillStyle = colour;
      context.fillRect(x - r, y - h, r * 2, h);

      // Top ellipse
      context.fillStyle = lighten(colour, 20);
      context.beginPath();
      context.ellipse(x, y - h, r, r * 0.3, 0, 0, Math.PI * 2);
      context.fill();

      // Bottom ellipse edge
      context.strokeStyle = dark;
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(x, y, r, r * 0.3, 0, 0, Math.PI);
      context.stroke();

      // Dimension labels
      if (state.dimensionsMeasured && state.measuredDimensions) {
        context.fillStyle = 'rgba(255,255,255,0.6)';
        context.font = '9px Inter, sans-serif';
        context.textAlign = 'center';
        context.fillText('d=' + state.measuredDimensions.diameter.toFixed(1) + ' cm', x, y + 14);
        context.fillText('h=' + state.measuredDimensions.height.toFixed(1) + ' cm', x + r + 18, y - h / 2);
      }
    }
  }

  // --- Draw Irregular Solid ---
  function drawIrregularSolid(context, obj, x, y) {
    context.fillStyle = obj.colour || '#888';
    if (obj.id === 'stone') {
      drawIrregularShape(context, x, y - 16, 28);
    } else if (obj.id === 'key') {
      // Simple key shape
      context.beginPath();
      context.arc(x, y - 18, 8, 0, Math.PI * 2);
      context.fill();
      context.fillRect(x - 2, y - 10, 4, 14);
      context.fillRect(x - 6, y, 6, 3);
      context.fillRect(x - 6, y - 4, 6, 3);
    } else {
      context.beginPath();
      context.arc(x, y - 12, 12, 0, Math.PI * 2);
      context.fill();
    }
  }

  // --- Draw Irregular Shape (stone) ---
  function drawIrregularShape(context, x, y, size) {
    context.beginPath();
    context.moveTo(x - size * 0.4, y - size * 0.2);
    context.quadraticCurveTo(x - size * 0.1, y - size * 0.5, x + size * 0.3, y - size * 0.35);
    context.quadraticCurveTo(x + size * 0.5, y - size * 0.1, x + size * 0.4, y + size * 0.2);
    context.quadraticCurveTo(x + size * 0.1, y + size * 0.45, x - size * 0.2, y + size * 0.3);
    context.quadraticCurveTo(x - size * 0.5, y + size * 0.1, x - size * 0.4, y - size * 0.2);
    context.closePath();
    context.fill();
  }

  // --- Draw Cylinder on Balance (liquid method) ---
  function drawCylinderOnBalance(context, obj, x, y) {
    const cylW = 24;
    const cylH = 50;

    // Glass body
    context.strokeStyle = 'rgba(180, 200, 230, 0.5)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x - cylW / 2, y - cylH);
    context.lineTo(x - cylW / 2, y);
    context.lineTo(x + cylW / 2, y);
    context.lineTo(x + cylW / 2, y - cylH);
    context.stroke();

    // Liquid fill
    if (state.liquidPoured && obj) {
      const fillFraction = state.cylinderCurrentLevel / DATA.measuringCylinder.maxVolume;
      const fillH = cylH * fillFraction;
      const fillY = y - fillH;

      context.fillStyle = obj.liquidColour || 'rgba(100, 160, 255, 0.3)';
      context.fillRect(x - cylW / 2 + 1, fillY, cylW - 2, fillH);
    }
  }

  // --- Info Text ---
  function drawInfoText(W, H) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';

    if (!state.selectedObject) {
      ctx.fillText('Select an object from the panel to begin', W / 2, H / 2);
    } else if (!state.objectOnBalance && state.category !== 'liquid') {
      ctx.fillText('Click "Place on Balance" to measure the mass', W / 2, 50);
    } else if (!state.objectOnBalance && state.category === 'liquid') {
      ctx.fillText('Click "Place on Balance" to weigh the empty cylinder', W / 2, 50);
    }
  }

  // --- Utility: Lighten a hex colour ---
  function lighten(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  // --- Easing ---
  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Initial draw
  draw();


  // ══════════════════════════════════════
  // RECORDING MODE HELPER
  // ══════════════════════════════════════

  function isGuided() {
    if (typeof LabRecordMode !== 'undefined') {
      return LabRecordMode.isGuided();
    }
    return true;
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  function resetMeasurementState() {
    state.selectedObject = null;
    state.category = null;
    state.step = null;
    state.measuredMass = 0;
    state.measuredDimensions = null;
    state.measuredVolume = 0;
    state.calculatedDensity = 0;
    state.cylinderInitialLevel = DATA.measuringCylinder.initialWaterLevel;
    state.cylinderCurrentLevel = DATA.measuringCylinder.initialWaterLevel;
    state.objectImmersed = false;
    state.cylinderMassEmpty = 0;
    state.cylinderMassFull = 0;
    state.liquidPoured = false;
    state.objectOnBalance = false;
    state.dimensionsMeasured = false;
    state.animating = false;
    state.animProgress = 0;
    state.animType = null;

    // Reset instrument readouts
    dom.balanceValue.textContent = '0.00 g';
    dom.volumeValue.textContent = '\u2014 cm\u00B3';
    dom.densityValue.textContent = '\u2014 g/cm\u00B3';

    // Reset calc panel
    dom.calcInputs.style.display = 'none';
    dom.calcPlaceholder.style.display = '';
    dom.calcResult.style.display = 'none';
    dom.inputMass.value = '';
    dom.inputVolume.value = '';
    dom.inputDensity.value = '';

    // Reset action buttons
    updateActionButtons();
  }

  dom.btnReset.addEventListener('click', () => {
    resetMeasurementState();
    state.results = [];
    dom.resultsTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';

    // Reset procedure list
    dom.procedureList.innerHTML = '';
    dom.methodBadge.textContent = 'Regular Solid';

    // Deselect all objects
    document.querySelectorAll('.object-btn').forEach(b => b.classList.remove('active'));

    // Reset scorer
    if (scorer) {
      scorer.reset();
      dom.scoreSlot.innerHTML = '';
    }

    draw();
    toast('Practical reset. Select an object to begin.');
    if (typeof LabAudio !== 'undefined') LabAudio.switchToggle();
  });


  // ══════════════════════════════════════
  // GUIDE TOGGLE
  // ══════════════════════════════════════

  dom.btnToggleGuide.addEventListener('click', () => {
    const visible = dom.guidePanel.style.display !== 'none';
    dom.guidePanel.style.display = visible ? 'none' : '';
  });


  // ══════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════

  function toast(message, type) {
    if (!dom.toast) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type || 'info'}`;
    el.textContent = message;
    dom.toast.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 300);
    }, 2500);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
    }
  }

});
