/*
 * Titration Lab Simulator — Logic
 * ==================================
 * Co-Cher / LabSim — Acid-Base Titration
 *
 * Fully guided 12-step acid-base titration simulation.
 * Supports configurable acid/base concentrations, 3 indicator choices,
 * burette flow controls, multi-trial recording, concordance checking,
 * and final concentration calculation.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════
  //  Constants
  // ═══════════════════════════════════════

  const BURETTE_MAX = 50.00;
  const PIPETTE_VOL = 25.0;
  const CONCORDANCE = 0.10;    // cm³ tolerance for concordant pair
  const MAX_TRIALS  = 4;       // rough + 3 accurate
  const FLOW_INTERVAL = 80;    // ms between flow ticks

  const INDICATORS = [
    { name: 'Methyl Orange',   acidColor: '#ff4444',    baseColor: '#ffcc00', endColor: '#ff8822', range: [3.1, 4.4] },
    { name: 'Phenolphthalein', acidColor: 'transparent', baseColor: '#ff69b4', endColor: '#ffb6c1', range: [8.2, 10.0] },
    { name: 'Thymol Blue',    acidColor: '#ff4444',    baseColor: '#0066cc', endColor: '#886644', range: [1.2, 2.8] }
  ];

  // The 12 guided steps
  const STEPS = [
    { label: 'Rinse burette with distilled water', instruction: 'Click the beaker (FA2), then click the burette to rinse it with distilled water.' },
    { label: 'Rinse burette with acid',            instruction: 'Click the beaker (FA2), then click the burette to rinse it with the acid solution.' },
    { label: 'Fill burette with acid',             instruction: 'Click the beaker (FA2), then click the burette to fill it with acid to the 0.00 mark.' },
    { label: 'Record initial reading',             instruction: 'Click "Initial Reading" on the controls bar to record the burette\'s starting volume.' },
    { label: 'Rinse pipette with base',            instruction: 'Click the conical flask, then click the pipette to rinse it with the base solution.' },
    { label: 'Pipette 25.0 cm³ of base into flask', instruction: 'Click the pipette to draw up 25.0 cm³ of base, then click the conical flask to dispense.' },
    { label: 'Add indicator to flask',             instruction: 'Click the indicator bottle, then choose your indicator.' },
    { label: 'Place flask under burette',          instruction: 'Click the conical flask, then click the white tile zone to place it under the burette.' },
    { label: 'Titrate — add acid until endpoint',  instruction: 'Use Fast, Slow, or Half-drop to add acid. Swirl the flask. Stop when the colour changes at the endpoint.' },
    { label: 'Record final reading',               instruction: 'Click "Final Reading" to record the burette reading. The titre will be calculated automatically.' },
    { label: 'Check concordance',                  instruction: 'Review your titres. You need 2 accurate results within 0.10 cm³. Repeat titrations if needed.' },
    { label: 'Calculate concentration',            instruction: 'Concordant results found! The concentration of the base has been calculated.' }
  ];

  // ═══════════════════════════════════════
  //  State
  // ═══════════════════════════════════════

  const state = {
    step: 0,
    acidConc: 0.10,
    baseConc: 0.10,
    indicator: null,        // selected indicator object
    buretteVolume: BURETTE_MAX,
    endpointVol: 0,         // theoretical volume of acid at endpoint
    results: [],            // array of { initial, final, titre }
    titrationCount: 0,      // current trial index (0 = rough, 1 = 1st, …)
    picked: null,           // currently picked apparatus element
    flowing: false,         // is acid flowing?
    flowTimer: null,
    flowRate: 0,
    flaskPlaced: false,
    flaskHasBase: false,
    flaskHasIndicator: false,
    endpointReached: false,
    initialRecorded: false,
    buretteReady: false,    // burette filled?
    pipetteRinsed: false,
    buretteRinsedWater: false,
    buretteRinsedAcid: false,
    concordantPair: null,   // indices of concordant pair
    configLocked: false     // lock config after first titration starts
  };

  // ═══════════════════════════════════════
  //  DOM References
  // ═══════════════════════════════════════

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    stepBar:          $('#stepBar'),
    guidePanel:       $('#guidePanel'),
    guideStepNum:     $('#guideStepNum'),
    guideText:        $('#guideText'),
    guideHint:        $('#guideHint'),
    acidSlider:       $('#acidSlider'),
    acidValue:        $('#acidValue'),
    baseSelect:       $('#baseSelect'),
    workbench:        $('#workbench'),
    beaker:           $('#beaker'),
    beakerLiquid:     $('#beakerLiquid'),
    pipette:          $('#pipette'),
    pipetteLiquid:    $('#pipetteLiquid'),
    conicalFlask:     $('#conicalFlask'),
    flaskLiquid:      $('#flaskLiquid'),
    indicatorBottle:  $('#indicatorBottle'),
    retortAssembly:   $('#retortAssembly'),
    burette:          $('#burette'),
    buretteLiquid:    $('#buretteLiquid'),
    stopcockHandle:   $('#stopcockHandle'),
    buretteNozzle:    $('#buretteNozzle'),
    drip:             $('#drip'),
    whiteTile:        $('#whiteTile'),
    flaskZone:        $('#flaskZone'),
    buretteControls:  $('#buretteControls'),
    readingValue:     $('#readingValue'),
    btnFast:          $('#btnFast'),
    btnSlow:          $('#btnSlow'),
    btnHalf:          $('#btnHalf'),
    btnSwirl:         $('#btnSwirl'),
    btnInitial:       $('#btnInitial'),
    btnFinal:         $('#btnFinal'),
    btnTopUp:         $('#btnTopUp'),
    btnReset:         $('#btnReset'),
    resultsTable:     $('#resultsTable'),
    concordantMsg:    $('#concordantMsg'),
    calcWorkspace:    $('#calcWorkspace'),
    indicatorPopup:   $('#indicatorPopup'),
    indicatorChoices: $('#indicatorChoices'),
    toastContainer:   $('#toastContainer')
  };

  // ═══════════════════════════════════════
  //  Helpers
  // ═══════════════════════════════════════

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function round2(val) {
    return Math.round(val * 100) / 100;
  }

  function fmt(val) {
    return val.toFixed(2);
  }

  // ═══════════════════════════════════════
  //  Toast System
  // ═══════════════════════════════════════

  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    dom.toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove());
    }, 2800);
  }

  // ═══════════════════════════════════════
  //  Endpoint Calculation
  // ═══════════════════════════════════════

  // For a 1:1 acid-base reaction (e.g., HCl + NaOH):
  //   C_acid * V_acid = C_base * V_base
  //   V_acid = (C_base * V_base) / C_acid
  // Note: endpointVol is the volume of acid to DELIVER from the burette.

  function calcEndpoint() {
    state.endpointVol = round2((state.baseConc * PIPETTE_VOL) / state.acidConc);
  }

  // Add slight random variation for realism (+/- 0.15 cm³)
  function getEndpointWithNoise() {
    const noise = (Math.random() - 0.5) * 0.30;
    return round2(state.endpointVol + noise);
  }

  // ═══════════════════════════════════════
  //  Step Bar Rendering
  // ═══════════════════════════════════════

  function renderSteps() {
    dom.stepBar.innerHTML = '';
    STEPS.forEach((s, i) => {
      const pip = document.createElement('div');
      pip.className = 'step-pip';
      if (i < state.step) pip.classList.add('done');
      if (i === state.step) pip.classList.add('active');
      pip.innerHTML = `
        <span class="step-pip-num">${i < state.step ? '&#10003;' : i + 1}</span>
        <span class="step-pip-label">${s.label}</span>
      `;
      dom.stepBar.appendChild(pip);
    });
  }

  // ═══════════════════════════════════════
  //  Guide Panel
  // ═══════════════════════════════════════

  function updateGuide() {
    const s = STEPS[state.step] || STEPS[STEPS.length - 1];
    dom.guideStepNum.textContent = state.step + 1;
    dom.guideText.textContent = s.instruction;
    dom.guideHint.textContent = '';
  }

  function setHint(msg) {
    dom.guideHint.textContent = msg;
  }

  // ═══════════════════════════════════════
  //  Configuration Handlers
  // ═══════════════════════════════════════

  dom.acidSlider.addEventListener('input', () => {
    if (state.configLocked) return;
    state.acidConc = parseFloat(dom.acidSlider.value);
    dom.acidValue.textContent = fmt(state.acidConc) + ' M';
    calcEndpoint();
  });

  dom.baseSelect.addEventListener('change', () => {
    if (state.configLocked) return;
    state.baseConc = parseFloat(dom.baseSelect.value);
    calcEndpoint();
  });

  function lockConfig() {
    state.configLocked = true;
    dom.acidSlider.disabled = true;
    dom.baseSelect.disabled = true;
  }

  // ═══════════════════════════════════════
  //  Burette Display
  // ═══════════════════════════════════════

  function updateBuretteDisplay() {
    dom.readingValue.textContent = fmt(BURETTE_MAX - state.buretteVolume);
    // Liquid height: buretteVolume / BURETTE_MAX * 100%
    const pct = (state.buretteVolume / BURETTE_MAX) * 100;
    dom.buretteLiquid.style.height = pct + '%';
  }

  // ═══════════════════════════════════════
  //  Flask Colour
  // ═══════════════════════════════════════

  function updateFlaskColour() {
    if (!state.indicator || !state.flaskHasBase || !state.flaskHasIndicator) return;

    const delivered = getCurrentDelivered();
    const target = state.currentEndpoint || state.endpointVol;

    // ratio of how close we are to endpoint (0 = start, 1 = endpoint)
    const ratio = clamp(delivered / target, 0, 1);

    if (ratio < 0.85) {
      // Base colour (with indicator)
      dom.flaskLiquid.style.background = state.indicator.baseColor;
    } else if (ratio >= 1) {
      // Endpoint colour
      dom.flaskLiquid.style.background = state.indicator.endColor;
      if (!state.endpointReached) {
        state.endpointReached = true;
        stopFlow();
        dom.conicalFlask.style.animation = 'endpointFlash 0.5s ease 3';
        setTimeout(() => { dom.conicalFlask.style.animation = ''; }, 1600);
        toast('Endpoint reached! Colour change observed.', 'success');
        if (typeof LabAudio !== 'undefined') LabAudio.play('success');
        // Move to record final reading
        if (state.step === 8) advanceStep();
      }
    } else {
      // Transition zone — interpolate toward endpoint color
      const t = (ratio - 0.85) / 0.15;
      dom.flaskLiquid.style.background = lerpColor(state.indicator.baseColor, state.indicator.endColor, t);
    }
  }

  function getCurrentDelivered() {
    const currentResult = state.results[state.titrationCount];
    if (!currentResult || currentResult.initial === null) return 0;
    const reading = BURETTE_MAX - state.buretteVolume;
    return round2(reading - currentResult.initial);
  }

  // Simple hex color lerp
  function lerpColor(a, b, t) {
    if (a === 'transparent') a = '#ffffff';
    if (b === 'transparent') b = '#ffffff';
    const ah = parseInt(a.replace('#', ''), 16);
    const bh = parseInt(b.replace('#', ''), 16);
    const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);
    return `rgb(${rr},${rg},${rb})`;
  }

  // ═══════════════════════════════════════
  //  Step Advancement
  // ═══════════════════════════════════════

  function advanceStep() {
    if (state.step < STEPS.length - 1) {
      state.step++;
      renderSteps();
      updateGuide();
      updateButtonStates();
      clearPicked();
    }
  }

  function goToStep(n) {
    state.step = clamp(n, 0, STEPS.length - 1);
    renderSteps();
    updateGuide();
    updateButtonStates();
  }

  // ═══════════════════════════════════════
  //  Click-to-Move: Pick & Target System
  // ═══════════════════════════════════════

  function clearPicked() {
    if (state.picked) {
      state.picked.classList.remove('picked');
      state.picked = null;
    }
    $$('.valid-target').forEach(el => el.classList.remove('valid-target'));
    dom.flaskZone.classList.remove('active');
  }

  function pickApparatus(el) {
    clearPicked();
    state.picked = el;
    el.classList.add('picked');
    if (typeof LabAudio !== 'undefined') LabAudio.play('click');

    // Highlight valid targets based on current step
    highlightTargets();
  }

  function highlightTargets() {
    if (!state.picked) return;
    const pickedType = state.picked.dataset.apparatus;

    switch (state.step) {
      case 0: // Rinse burette with water
      case 1: // Rinse burette with acid
      case 2: // Fill burette with acid
        if (pickedType === 'beaker') {
          dom.retortAssembly.classList.add('valid-target');
        }
        break;
      case 4: // Rinse pipette with base
        if (pickedType === 'flask') {
          dom.pipette.classList.add('valid-target');
        }
        break;
      case 5: // Pipette base into flask
        if (pickedType === 'pipette') {
          dom.conicalFlask.classList.add('valid-target');
        }
        break;
      case 6: // Add indicator
        // Indicator bottle opens popup (handled separately)
        break;
      case 7: // Place flask under burette
        if (pickedType === 'flask') {
          dom.flaskZone.classList.add('active');
        }
        break;
    }
  }

  // ═══════════════════════════════════════
  //  Apparatus Click Handlers
  // ═══════════════════════════════════════

  dom.beaker.addEventListener('click', () => {
    if (state.step > 2) return;
    pickApparatus(dom.beaker);
  });

  dom.retortAssembly.addEventListener('click', () => {
    if (!state.picked) return;
    const pickedType = state.picked.dataset.apparatus;

    // Steps 0-2: beaker -> burette
    if (pickedType === 'beaker' && state.step <= 2) {
      performBuretteRinseOrFill();
    }
  });

  dom.pipette.addEventListener('click', () => {
    if (state.step === 4 && state.picked && state.picked.dataset.apparatus === 'flask') {
      // Rinse pipette with base
      performPipetteRinse();
    } else if (state.step === 5) {
      // Pick pipette to dispense into flask
      pickApparatus(dom.pipette);
      // Fill pipette with base visually
      dom.pipetteLiquid.style.height = '80%';
      dom.pipetteLiquid.style.background = 'rgba(100, 200, 255, 0.4)';
      if (typeof LabAudio !== 'undefined') LabAudio.play('pour');
      setHint('Now click the conical flask to dispense 25.0 cm³ of base.');
    }
  });

  dom.conicalFlask.addEventListener('click', () => {
    if (state.step === 4) {
      // Pick flask for pipette rinse target
      pickApparatus(dom.conicalFlask);
      setHint('Now click the pipette to rinse it with base.');
    } else if (state.step === 5 && state.picked && state.picked.dataset.apparatus === 'pipette') {
      // Dispense base into flask
      performDispenseBase();
    } else if (state.step === 7) {
      // Pick flask to place under burette
      pickApparatus(dom.conicalFlask);
      setHint('Now click the placement zone on the white tile.');
    }
  });

  dom.indicatorBottle.addEventListener('click', () => {
    if (state.step === 6) {
      showIndicatorPopup();
    }
  });

  dom.flaskZone.addEventListener('click', () => {
    if (state.step === 7 && state.picked && state.picked.dataset.apparatus === 'flask') {
      performPlaceFlask();
    }
  });

  // ═══════════════════════════════════════
  //  Step Actions
  // ═══════════════════════════════════════

  function performBuretteRinseOrFill() {
    clearPicked();
    if (typeof LabAudio !== 'undefined') LabAudio.play('pour');

    if (state.step === 0) {
      // Rinse with distilled water
      state.buretteRinsedWater = true;
      toast('Burette rinsed with distilled water.', 'info');
      advanceStep();
    } else if (state.step === 1) {
      // Rinse with acid
      state.buretteRinsedAcid = true;
      toast('Burette rinsed with acid solution.', 'info');
      advanceStep();
    } else if (state.step === 2) {
      // Fill burette
      state.buretteReady = true;
      state.buretteVolume = BURETTE_MAX;
      updateBuretteDisplay();
      lockConfig();
      toast('Burette filled with acid to 0.00 cm³ mark.', 'success');
      advanceStep();
    }
  }

  function performPipetteRinse() {
    clearPicked();
    if (typeof LabAudio !== 'undefined') LabAudio.play('pour');
    state.pipetteRinsed = true;
    dom.pipetteLiquid.style.height = '30%';
    dom.pipetteLiquid.style.background = 'rgba(100, 200, 255, 0.3)';
    setTimeout(() => {
      dom.pipetteLiquid.style.height = '0%';
    }, 600);
    toast('Pipette rinsed with base solution.', 'info');
    advanceStep();
  }

  function performDispenseBase() {
    clearPicked();
    if (typeof LabAudio !== 'undefined') LabAudio.play('pour');

    // Empty pipette
    dom.pipetteLiquid.style.height = '0%';

    // Fill flask with base
    state.flaskHasBase = true;
    dom.flaskLiquid.style.height = '45%';
    dom.flaskLiquid.style.background = 'rgba(100, 200, 255, 0.3)';

    toast('25.0 cm³ of base dispensed into conical flask.', 'success');
    advanceStep();
  }

  // ═══════════════════════════════════════
  //  Indicator Selection
  // ═══════════════════════════════════════

  function showIndicatorPopup() {
    dom.indicatorChoices.innerHTML = '';
    INDICATORS.forEach((ind, i) => {
      const choice = document.createElement('div');
      choice.className = 'indicator-choice';
      choice.innerHTML = `
        <div class="indicator-swatch">
          <span style="background:${ind.baseColor === 'transparent' ? '#f0f0f0' : ind.baseColor}"></span>
          <span style="background:${ind.endColor}"></span>
          <span style="background:${ind.acidColor === 'transparent' ? '#f0f0f0' : ind.acidColor}"></span>
        </div>
        <span class="indicator-choice-name">${ind.name}</span>
        <span class="indicator-choice-range">pH ${ind.range[0]}–${ind.range[1]}</span>
      `;
      choice.addEventListener('click', () => selectIndicator(i));
      dom.indicatorChoices.appendChild(choice);
    });
    dom.indicatorPopup.classList.add('visible');
  }

  function selectIndicator(index) {
    state.indicator = INDICATORS[index];
    state.flaskHasIndicator = true;
    dom.indicatorPopup.classList.remove('visible');
    if (typeof LabAudio !== 'undefined') LabAudio.play('drip');

    // Update flask colour to show indicator in base
    dom.flaskLiquid.style.background = state.indicator.baseColor === 'transparent'
      ? 'rgba(100, 200, 255, 0.3)'
      : state.indicator.baseColor;

    // Update indicator bottle label
    const labelEl = dom.indicatorBottle.querySelector('.bottle-label');
    if (labelEl) labelEl.textContent = state.indicator.name.substring(0, 3) + '.';

    toast(`${state.indicator.name} added to flask.`, 'info');
    advanceStep();
  }

  // ═══════════════════════════════════════
  //  Place Flask Under Burette
  // ═══════════════════════════════════════

  function performPlaceFlask() {
    clearPicked();
    state.flaskPlaced = true;
    if (typeof LabAudio !== 'undefined') LabAudio.play('click');

    // Move flask visually under burette
    dom.conicalFlask.classList.add('placed');
    dom.flaskZone.classList.add('occupied');

    // Assign a noisy endpoint for this titration
    state.currentEndpoint = getEndpointWithNoise();

    toast('Flask placed on white tile under burette. Ready to titrate!', 'success');
    advanceStep();
  }

  // ═══════════════════════════════════════
  //  Burette Flow Controls
  // ═══════════════════════════════════════

  function startFlow(rate) {
    if (state.step !== 8) return;
    if (state.endpointReached) return;
    if (!state.flaskPlaced) {
      toast('Place the flask under the burette first.', 'warning');
      return;
    }
    if (state.flowing) stopFlow();

    state.flowing = true;
    state.flowRate = rate;
    dom.stopcockHandle.classList.add('open');

    // Highlight active button
    dom.btnFast.classList.toggle('active', rate === 0.50);
    dom.btnSlow.classList.toggle('active', rate === 0.10);

    if (typeof LabAudio !== 'undefined') LabAudio.play('pour');

    state.flowTimer = setInterval(() => {
      if (state.buretteVolume <= 0 || state.endpointReached) {
        stopFlow();
        return;
      }
      state.buretteVolume = round2(Math.max(0, state.buretteVolume - rate));
      updateBuretteDisplay();
      animateDrip();
      updateFlaskColour();
    }, FLOW_INTERVAL);
  }

  function stopFlow() {
    state.flowing = false;
    if (state.flowTimer) {
      clearInterval(state.flowTimer);
      state.flowTimer = null;
    }
    dom.stopcockHandle.classList.remove('open');
    dom.btnFast.classList.remove('active');
    dom.btnSlow.classList.remove('active');
  }

  function halfDrop() {
    if (state.step !== 8) return;
    if (state.endpointReached) return;
    if (state.buretteVolume <= 0) return;

    state.buretteVolume = round2(Math.max(0, state.buretteVolume - 0.05));
    updateBuretteDisplay();
    animateDrip();
    if (typeof LabAudio !== 'undefined') LabAudio.play('drip');
    updateFlaskColour();
  }

  function animateDrip() {
    const drip = dom.drip;
    drip.classList.remove('falling');
    // Force reflow
    void drip.offsetWidth;
    drip.classList.add('falling');
    setTimeout(() => drip.classList.remove('falling'), 500);
  }

  // Flow button listeners
  dom.btnFast.addEventListener('mousedown', () => startFlow(0.50));
  dom.btnFast.addEventListener('mouseup', () => stopFlow());
  dom.btnFast.addEventListener('mouseleave', () => { if (state.flowing && state.flowRate === 0.50) stopFlow(); });

  dom.btnSlow.addEventListener('mousedown', () => startFlow(0.10));
  dom.btnSlow.addEventListener('mouseup', () => stopFlow());
  dom.btnSlow.addEventListener('mouseleave', () => { if (state.flowing && state.flowRate === 0.10) stopFlow(); });

  dom.btnHalf.addEventListener('click', () => halfDrop());

  // Touch support for flow buttons
  dom.btnFast.addEventListener('touchstart', (e) => { e.preventDefault(); startFlow(0.50); });
  dom.btnFast.addEventListener('touchend', () => stopFlow());

  dom.btnSlow.addEventListener('touchstart', (e) => { e.preventDefault(); startFlow(0.10); });
  dom.btnSlow.addEventListener('touchend', () => stopFlow());

  // ═══════════════════════════════════════
  //  Swirl
  // ═══════════════════════════════════════

  dom.btnSwirl.addEventListener('click', () => {
    if (state.step !== 8 && state.step !== 9) return;
    if (!state.flaskPlaced) return;
    dom.conicalFlask.classList.remove('swirling');
    void dom.conicalFlask.offsetWidth;
    dom.conicalFlask.classList.add('swirling');
    if (typeof LabAudio !== 'undefined') LabAudio.play('swirl');
    setTimeout(() => dom.conicalFlask.classList.remove('swirling'), 500);
  });

  // ═══════════════════════════════════════
  //  Recording Readings
  // ═══════════════════════════════════════

  dom.btnInitial.addEventListener('click', () => {
    if (state.step !== 3) {
      // Also allow recording initial when repeating (step 8 after top-up)
      if (state.step !== 8 || state.initialRecorded) return;
    }

    const reading = round2(BURETTE_MAX - state.buretteVolume);

    // Ensure we have a result object for this trial
    if (!state.results[state.titrationCount]) {
      state.results[state.titrationCount] = { initial: null, final: null, titre: null };
    }
    state.results[state.titrationCount].initial = reading;
    state.initialRecorded = true;

    updateResultsTable();
    if (typeof LabAudio !== 'undefined') LabAudio.play('click');
    toast(`Initial reading recorded: ${fmt(reading)} cm³`, 'info');

    if (state.step === 3) advanceStep();
  });

  dom.btnFinal.addEventListener('click', () => {
    if (state.step !== 9) return;

    const reading = round2(BURETTE_MAX - state.buretteVolume);
    const result = state.results[state.titrationCount];
    if (!result || result.initial === null) {
      toast('Record the initial reading first!', 'warning');
      return;
    }

    result.final = reading;
    result.titre = round2(reading - result.initial);

    updateResultsTable();
    if (typeof LabAudio !== 'undefined') LabAudio.play('success');
    toast(`Final reading: ${fmt(reading)} cm³ — Titre: ${fmt(result.titre)} cm³`, 'success');

    // Check if we can check concordance
    state.titrationCount++;
    advanceStep(); // -> step 10 (concordance check)
    checkConcordance();
  });

  // ═══════════════════════════════════════
  //  Top Up
  // ═══════════════════════════════════════

  dom.btnTopUp.addEventListener('click', () => {
    if (state.step < 10) return;
    if (state.concordantPair) return; // already done

    if (state.titrationCount >= MAX_TRIALS) {
      toast('Maximum 4 trials reached. Use the results you have.', 'warning');
      return;
    }

    // Reset for another titration
    state.buretteVolume = BURETTE_MAX;
    state.endpointReached = false;
    state.initialRecorded = false;
    state.flaskPlaced = false;
    state.flaskHasBase = false;
    state.flaskHasIndicator = false;
    state.currentEndpoint = getEndpointWithNoise();

    // Reset flask visuals
    dom.conicalFlask.classList.remove('placed');
    dom.flaskZone.classList.remove('occupied');
    dom.flaskLiquid.style.height = '0%';
    dom.flaskLiquid.style.background = 'transparent';
    dom.pipetteLiquid.style.height = '0%';

    updateBuretteDisplay();

    // Go back to step 4 (rinse pipette) for the next trial — but for a repeat
    // we skip the burette rinse steps and go straight to pipette
    goToStep(4);
    state.pipetteRinsed = false;

    toast(`Starting titration ${state.titrationCount + 1}. Rinse the pipette, then proceed.`, 'info');
    if (typeof LabAudio !== 'undefined') LabAudio.play('click');
  });

  // ═══════════════════════════════════════
  //  Results Table
  // ═══════════════════════════════════════

  function updateResultsTable() {
    for (let i = 0; i < MAX_TRIALS; i++) {
      const r = state.results[i];
      const initCell = document.getElementById(`init-${i}`);
      const finalCell = document.getElementById(`final-${i}`);
      const titreCell = document.getElementById(`titre-${i}`);

      if (r) {
        initCell.textContent = r.initial !== null ? fmt(r.initial) : '—';
        finalCell.textContent = r.final !== null ? fmt(r.final) : '—';
        titreCell.textContent = r.titre !== null ? fmt(r.titre) : '—';
      } else {
        initCell.textContent = '—';
        finalCell.textContent = '—';
        titreCell.textContent = '—';
      }

      // Highlight active trial
      initCell.classList.toggle('active-trial', i === state.titrationCount && !state.results[i]?.final);
      finalCell.classList.toggle('active-trial', i === state.titrationCount && !state.results[i]?.final);
      titreCell.classList.toggle('active-trial', i === state.titrationCount && !state.results[i]?.final);
    }
  }

  // ═══════════════════════════════════════
  //  Concordance Check
  // ═══════════════════════════════════════

  function checkConcordance() {
    const titres = state.results
      .map((r, i) => ({ titre: r?.titre, index: i }))
      .filter(r => r.titre !== null && r.index > 0); // exclude rough (index 0)

    // Need at least 2 accurate titres
    if (titres.length < 2) {
      dom.concordantMsg.innerHTML = `
        <div class="msg-box info">
          Need at least 2 accurate titrations (excluding rough).
          Click "Top Up" to repeat.
        </div>
      `;
      return;
    }

    // Find a concordant pair
    for (let i = 0; i < titres.length; i++) {
      for (let j = i + 1; j < titres.length; j++) {
        const diff = Math.abs(titres[i].titre - titres[j].titre);
        if (diff <= CONCORDANCE) {
          state.concordantPair = [titres[i].index, titres[j].index];
          highlightConcordant();
          calculateConcentration(titres[i].titre, titres[j].titre);
          goToStep(11); // Calculate concentration step
          return;
        }
      }
    }

    // No concordant pair yet
    dom.concordantMsg.innerHTML = `
      <div class="msg-box info">
        No concordant pair found yet (need 2 titres within ${fmt(CONCORDANCE)} cm³).
        Click "Top Up" to do another titration.
      </div>
    `;
  }

  function highlightConcordant() {
    if (!state.concordantPair) return;
    const [a, b] = state.concordantPair;

    const cellA = document.getElementById(`titre-${a}`);
    const cellB = document.getElementById(`titre-${b}`);
    if (cellA) cellA.classList.add('concordant');
    if (cellB) cellB.classList.add('concordant');

    const tA = state.results[a].titre;
    const tB = state.results[b].titre;
    const avg = round2((tA + tB) / 2);

    dom.concordantMsg.innerHTML = `
      <div class="msg-box success">
        Concordant pair found! Titres ${fmt(tA)} and ${fmt(tB)} cm³
        (diff: ${fmt(Math.abs(tA - tB))} cm³). Average titre: <strong>${fmt(avg)} cm³</strong>
      </div>
    `;

    if (typeof LabAudio !== 'undefined') LabAudio.play('success');
    toast('Concordant results achieved!', 'success');
  }

  // ═══════════════════════════════════════
  //  Calculation
  // ═══════════════════════════════════════

  function calculateConcentration(titre1, titre2) {
    const avgTitre = round2((titre1 + titre2) / 2);

    // C_base = (C_acid * V_acid) / V_base
    // We are calculating the "experimental" concentration of the base
    const calcConc = round2((state.acidConc * avgTitre) / PIPETTE_VOL * 100) / 100;

    dom.calcWorkspace.innerHTML = `
      <div class="calc-line">
        <span class="calc-label">Average Titre (V_acid)</span>
        <span class="calc-value">${fmt(avgTitre)} cm³</span>
      </div>
      <div class="calc-line">
        <span class="calc-label">Acid Concentration (C_acid)</span>
        <span class="calc-value">${fmt(state.acidConc)} mol/dm³</span>
      </div>
      <div class="calc-line">
        <span class="calc-label">Volume of Base (V_base)</span>
        <span class="calc-value">${fmt(PIPETTE_VOL)} cm³</span>
      </div>
      <div class="calc-line">
        <span class="calc-label">Using: C_acid × V_acid = C_base × V_base</span>
      </div>
      <div class="calc-line">
        <span class="calc-label">C_base = (C_acid × V_acid) / V_base</span>
      </div>
      <div class="calc-line">
        <span class="calc-label">C_base = (${fmt(state.acidConc)} × ${fmt(avgTitre)}) / ${fmt(PIPETTE_VOL)}</span>
      </div>
      <div class="calc-result">
        <div class="calc-label">Concentration of Base (NaOH)</div>
        <div class="calc-value">${calcConc.toFixed(4)} mol/dm³</div>
      </div>
    `;
  }

  // ═══════════════════════════════════════
  //  Button State Management
  // ═══════════════════════════════════════

  function updateButtonStates() {
    const s = state.step;

    // Flow controls: only active during titration (step 8)
    dom.btnFast.disabled = s !== 8 || state.endpointReached;
    dom.btnSlow.disabled = s !== 8 || state.endpointReached;
    dom.btnHalf.disabled = s !== 8 || state.endpointReached;
    dom.btnSwirl.disabled = (s !== 8 && s !== 9) || !state.flaskPlaced;

    // Recording actions
    dom.btnInitial.disabled = s !== 3 && !(s === 8 && !state.initialRecorded);
    dom.btnFinal.disabled = s !== 9;
    dom.btnTopUp.disabled = s < 10 || !!state.concordantPair;

    // Apparatus clickability
    dom.beaker.classList.toggle('disabled', s > 2);
    dom.indicatorBottle.classList.toggle('disabled', s !== 6);
  }

  // ═══════════════════════════════════════
  //  Full Reset
  // ═══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    if (!confirm('Reset the entire experiment? All data will be lost.')) return;

    // Reset state
    state.step = 0;
    state.buretteVolume = BURETTE_MAX;
    state.endpointVol = 0;
    state.results = [];
    state.titrationCount = 0;
    state.picked = null;
    state.flowing = false;
    state.flowRate = 0;
    state.flaskPlaced = false;
    state.flaskHasBase = false;
    state.flaskHasIndicator = false;
    state.endpointReached = false;
    state.initialRecorded = false;
    state.buretteReady = false;
    state.pipetteRinsed = false;
    state.buretteRinsedWater = false;
    state.buretteRinsedAcid = false;
    state.concordantPair = null;
    state.configLocked = false;
    state.indicator = null;
    state.currentEndpoint = 0;

    stopFlow();

    // Unlock config
    dom.acidSlider.disabled = false;
    dom.baseSelect.disabled = false;
    state.acidConc = parseFloat(dom.acidSlider.value);
    state.baseConc = parseFloat(dom.baseSelect.value);

    // Reset visuals
    updateBuretteDisplay();
    dom.buretteLiquid.style.height = '100%';
    dom.pipetteLiquid.style.height = '0%';
    dom.flaskLiquid.style.height = '0%';
    dom.flaskLiquid.style.background = 'transparent';
    dom.conicalFlask.classList.remove('placed', 'swirling');
    dom.flaskZone.classList.remove('occupied', 'active');
    dom.stopcockHandle.classList.remove('open');
    clearPicked();

    // Reset data panel
    updateResultsTable();
    dom.concordantMsg.innerHTML = '';
    dom.calcWorkspace.innerHTML = '<p class="calc-placeholder">Complete at least 2 concordant titrations to calculate concentration.</p>';

    // Reset indicator label
    const labelEl = dom.indicatorBottle.querySelector('.bottle-label');
    if (labelEl) labelEl.textContent = 'Ind.';

    // Re-render
    calcEndpoint();
    renderSteps();
    updateGuide();
    updateButtonStates();

    toast('Experiment reset. Start from step 1.', 'info');
  });

  // ═══════════════════════════════════════
  //  Keyboard Shortcuts
  // ═══════════════════════════════════════

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearPicked();
      stopFlow();
      dom.indicatorPopup.classList.remove('visible');
    }
    if (e.key === 'f' || e.key === 'F') {
      if (state.step === 8 && !state.endpointReached) startFlow(0.50);
    }
    if (e.key === 's' || e.key === 'S') {
      if (state.step === 8 && !state.endpointReached) startFlow(0.10);
    }
    if (e.key === 'h' || e.key === 'H') {
      halfDrop();
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (state.flowing) stopFlow();
    }
  });

  document.addEventListener('keyup', (e) => {
    if ((e.key === 'f' || e.key === 'F') && state.flowRate === 0.50) stopFlow();
    if ((e.key === 's' || e.key === 'S') && state.flowRate === 0.10) stopFlow();
  });

  // ═══════════════════════════════════════
  //  Click outside to deselect
  // ═══════════════════════════════════════

  dom.workbench.addEventListener('click', (e) => {
    // If clicking on the workbench background (not an apparatus or zone)
    if (e.target === dom.workbench || e.target.classList.contains('bench-surface')) {
      clearPicked();
    }
  });

  // Close indicator popup on overlay click
  dom.indicatorPopup.addEventListener('click', (e) => {
    if (e.target === dom.indicatorPopup) {
      dom.indicatorPopup.classList.remove('visible');
    }
  });

  // ═══════════════════════════════════════
  //  Initialize
  // ═══════════════════════════════════════

  calcEndpoint();
  renderSteps();
  updateGuide();
  updateBuretteDisplay();
  updateResultsTable();
  updateButtonStates();

});
