/* ============================================================
   Titration Practical — Logic (v2)
   Click-to-move apparatus, guided mode, concordance, calculations
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Constants ──
  const BURETTE_MAX = 50.00;
  const PIPETTE_VOL = 25.0;
  const CONCORDANT_THRESHOLD = 0.10;

  // ── Indicator Data ──
  const INDICATORS = {
    MO: { name: 'Methyl Orange', acidColor: '#ef4444', baseColor: '#fde047', nearEndpoint: '#f59e0b' },
    PH: { name: 'Phenolphthalein', acidColor: 'rgba(220,230,245,0.5)', baseColor: '#ec4899', nearEndpoint: '#fbcfe8' },
    TB: { name: 'Thymol Blue', acidColor: '#fde047', baseColor: '#3b82f6', nearEndpoint: '#86efac' },
  };

  // ── Guided Steps ──
  const STEPS = [
    {
      id: 'rinse-burette', title: 'Rinse the burette',
      desc: 'Click the burette, then click "Rinse with FA1" to rinse it with the base solution.',
      why: 'Rinsing with the solution it will contain (not water) prevents dilution, which would cause systematic error.',
      target: 'burette', action: 'rinse-burette',
    },
    {
      id: 'fill-burette', title: 'Fill the burette',
      desc: 'Click the burette to fill it with base solution to the 0.00 cm³ mark.',
      why: 'The burette must be filled completely so you can record an accurate initial reading. Air bubbles below the stopcock give a false volume.',
      target: 'burette', action: 'fill-burette',
    },
    {
      id: 'rinse-pipette', title: 'Rinse the pipette',
      desc: 'Click the pipette, then click the beaker to rinse the pipette with FA2.',
      why: 'Residual water would dilute FA2, causing an inaccurate volume of acid to be transferred.',
      target: 'pipette', action: 'rinse-pipette',
    },
    {
      id: 'draw-pipette', title: 'Draw 25.0 cm³ of FA2',
      desc: 'Click the pipette, then click the beaker to draw exactly 25.0 cm³ of acid.',
      why: 'The pipette delivers a precise fixed volume. Read the bottom of the meniscus at the calibration mark to avoid parallax error.',
      target: 'pipette', action: 'draw-pipette',
    },
    {
      id: 'transfer', title: 'Transfer acid to conical flask',
      desc: 'Click the pipette, then click the conical flask to transfer the acid.',
      why: 'The pipette is calibrated to deliver its stated volume by gravity. Do not blow out the last drop.',
      target: 'pipette', action: 'transfer',
    },
    {
      id: 'add-indicator', title: 'Add indicator',
      desc: 'Click the indicator bottle, then choose an indicator to add 2–3 drops to the flask.',
      why: 'The indicator changes colour at the equivalence point. Use only 2–3 drops — too much can affect the titre.',
      target: 'indicator', action: 'add-indicator',
    },
    {
      id: 'place-flask', title: 'Place flask under burette',
      desc: 'Click the conical flask to move it under the burette on a white tile.',
      why: 'The white tile provides contrast so you can detect the first permanent colour change more easily.',
      target: 'flask', action: 'place-flask',
    },
    {
      id: 'record-initial', title: 'Record initial burette reading',
      desc: 'Click "Log Initial" to record the starting burette reading.',
      why: 'Always read at the bottom of the meniscus with your eye level. Recording the initial reading before dispensing is essential.',
      target: null, action: 'log-initial',
    },
    {
      id: 'titrate', title: 'Titrate',
      desc: 'Use Fast Flow initially, then Slow Flow near the endpoint, then Half Drop. Swirl continuously.',
      why: 'Near the endpoint, a brief colour flash appears then disappears on swirling — switch to half-drops at this point.',
      target: null, action: 'titrate',
    },
    {
      id: 'record-final', title: 'Record final burette reading',
      desc: 'The endpoint is reached — the colour change is permanent. Click "Log Final" to record.',
      why: 'Titre = final reading − initial reading. Record to 2 decimal places (nearest 0.05 cm³).',
      target: null, action: 'log-final',
    },
    {
      id: 'repeat', title: 'Repeat for concordant results',
      desc: 'Click "Next Titration" to repeat until you have two titres within 0.10 cm³.',
      why: 'Concordant results show reliability. Only concordant titres are averaged. The rough titration estimates where the endpoint lies.',
      target: null, action: 'repeat',
    },
  ];

  // ── State ──
  const state = {
    step: 0,
    guideOpen: true,
    picked: null, // apparatus currently picked up: 'pipette', 'flask', 'indicator'
    buretteRinsed: false,
    buretteFilled: false,
    buretteVolume: 0,
    pipetteRinsed: false,
    pipetteFilled: false,
    flaskFilled: false,
    indicatorType: null,
    indicatorAdded: false,
    flaskPlaced: false,
    initialReading: null,
    endpointReached: false,
    run: 0,
    results: [],
    acidConc: 0.10,
    baseConc: 0.10,
    endpointVol: 0,
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    stepsBar: $('steps-bar'),
    guidePanel: $('guide-panel'),
    guideTitle: $('guide-title'),
    guideDesc: $('guide-desc'),
    guideWhy: $('guide-why'),
    guideActions: $('guide-actions'),
    workbench: $('workbench'),
    beaker: $('beaker'),
    beakerLiquid: $('beaker-liquid'),
    pipette: $('pipette'),
    pipetteLiquid: $('pipette-liquid'),
    pipetteBulgeLiquid: $('pipette-bulge-liquid'),
    flask: $('flask'),
    flaskLiquid: $('flask-liquid'),
    indicator: $('indicator'),
    standAssembly: $('stand-assembly'),
    burette: $('burette'),
    buretteLiquid: $('burette-liquid'),
    buretteReading: $('burette-reading'),
    buretteControls: $('burette-controls'),
    buretteDrip: $('burette-drip'),
    stopcockHandle: $('stopcock-handle'),
    whiteTile: $('white-tile'),
    flaskZone: $('flask-zone'),
    btnFast: $('btn-fast'),
    btnSlow: $('btn-slow'),
    btnDrop: $('btn-drop'),
    btnSwirl: $('btn-swirl'),
    btnLogInitial: $('btn-log-initial'),
    btnLogFinal: $('btn-log-final'),
    btnTopup: $('btn-topup'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    acidSlider: $('acid-conc-slider'),
    acidDisplay: $('acid-conc-display'),
    baseSelect: $('base-select'),
    concordantMsg: $('concordant-msg'),
    calcWorkspace: $('calc-workspace'),
    btnNextTitration: $('btn-next-titration'),
    toast: $('toast-container'),
  };

  // ── Recording Mode ──
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  // ── Initialization ──
  computeEndpoint();
  renderStepsBar();
  updateGuide();
  updateVisuals();

  // ══════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════

  dom.acidSlider.addEventListener('input', () => {
    state.acidConc = parseFloat(dom.acidSlider.value);
    dom.acidDisplay.textContent = state.acidConc.toFixed(3) + ' M';
    computeEndpoint();
  });
  dom.baseSelect.addEventListener('change', () => {
    state.baseConc = parseFloat(dom.baseSelect.value);
    computeEndpoint();
  });

  function computeEndpoint() {
    state.endpointVol = (state.acidConc * PIPETTE_VOL) / state.baseConc;
    state.endpointReached = false;
  }

  // ══════════════════════════════════════
  // STEP BAR
  // ══════════════════════════════════════

  function renderStepsBar() {
    dom.stepsBar.innerHTML = '';
    STEPS.forEach((s, i) => {
      if (i > 0) {
        const conn = document.createElement('div');
        conn.className = 'step-connector' + (i <= state.step ? ' completed' : '');
        dom.stepsBar.appendChild(conn);
      }
      const dot = document.createElement('div');
      dot.className = 'step-dot';
      if (i < state.step) dot.classList.add('completed');
      if (i === state.step) dot.classList.add('active');
      dot.textContent = i + 1;
      dot.title = s.title;
      dom.stepsBar.appendChild(dot);
    });
    const active = dom.stepsBar.querySelector('.step-dot.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  // ══════════════════════════════════════
  // GUIDE PANEL
  // ══════════════════════════════════════

  function updateGuide() {
    const step = STEPS[state.step];
    if (!step) return;

    dom.guideTitle.textContent = `Step ${state.step + 1}: ${step.title}`;
    dom.guideDesc.textContent = step.desc;

    if (step.why) {
      dom.guideWhy.textContent = step.why;
      dom.guideWhy.style.display = '';
    } else {
      dom.guideWhy.style.display = 'none';
    }

    dom.guideActions.innerHTML = '';

    // Add indicator choices for the indicator step
    if (step.id === 'add-indicator') {
      Object.entries(INDICATORS).forEach(([key, ind]) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost btn-sm';
        btn.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${ind.acidColor};margin-right:6px;vertical-align:middle;border:1px solid rgba(0,0,0,0.15);"></span>${ind.name}`;
        btn.addEventListener('click', () => selectIndicator(key));
        dom.guideActions.appendChild(btn);
      });
    } else if (step.id === 'titrate') {
      const note = document.createElement('span');
      note.className = 'text-sm text-muted';
      note.textContent = 'Use the controls below the workbench.';
      dom.guideActions.appendChild(note);
    } else if (step.id === 'repeat') {
      if (state.run < 3) {
        dom.guideDesc.textContent = 'Titration recorded! Click below or use the green bar at the bottom to start the next run.';
        const btn = document.createElement('button');
        btn.className = 'btn btn-success btn-sm';
        btn.textContent = 'Next Titration';
        btn.dataset.action = 'next-titration';
        dom.guideActions.appendChild(btn);
      } else {
        dom.guideDesc.textContent = 'All four titrations complete. Check your concordance results.';
      }
    }

    // Highlight target apparatus
    document.querySelectorAll('.apparatus').forEach(a => a.classList.remove('guide-target'));
    if (step.target) {
      const target = document.getElementById(step.target) || document.querySelector(`[data-item="${step.target}"]`);
      if (target) target.classList.add('guide-target');
    }
  }

  function advanceStep() {
    if (state.step < STEPS.length - 1) {
      state.step++;
      renderStepsBar();
      updateGuide();
      // Show the Next Titration bar when reaching the repeat step
      if (STEPS[state.step] && STEPS[state.step].id === 'repeat') {
        showNextRunBar();
      }
    }
  }

  // ══════════════════════════════════════
  // CLICK-TO-MOVE APPARATUS SYSTEM
  // ══════════════════════════════════════

  // When you click an apparatus, it becomes "picked up".
  // Valid target zones glow. Click a target to perform the action.
  // For some items (burette, flask placement), single-click triggers directly.

  dom.workbench.addEventListener('click', (e) => {
    const item = e.target.closest('[data-item]');
    if (!item) {
      // Clicked empty space — cancel pick
      cancelPick();
      return;
    }

    const type = item.dataset.item;

    // ── BURETTE click ──
    if (type === 'burette') {
      if (!state.buretteRinsed) {
        state.buretteRinsed = true;
        toast('Burette rinsed with FA1.');
        if (state.step === 0) advanceStep();
        return;
      }
      if (!state.buretteFilled) {
        state.buretteFilled = true;
        state.buretteVolume = BURETTE_MAX;
        updateVisuals();
        toast('Burette filled to 0.00 cm³.');
        if (state.step === 1) advanceStep();
        return;
      }
      return;
    }

    // ── PIPETTE click ──
    if (type === 'pipette') {
      if (state.picked === 'pipette') {
        cancelPick();
        return;
      }
      pickUp('pipette');
      return;
    }

    // ── BEAKER click (target for pipette) ──
    if (type === 'beaker') {
      if (state.picked === 'pipette') {
        if (!state.pipetteRinsed) {
          // Rinse pipette
          state.pipetteRinsed = true;
          animatePipetteTo(dom.beaker, () => {
            toast('Pipette rinsed with FA2.');
            returnPipette();
            if (state.step === 2) advanceStep();
          });
        } else if (!state.pipetteFilled) {
          // Draw from beaker
          animatePipetteTo(dom.beaker, () => {
            state.pipetteFilled = true;
            dom.pipetteLiquid.style.height = '90%';
            dom.pipetteBulgeLiquid.style.height = '100%';
            toast('Drew 25.0 cm³ of FA2.');
            returnPipette();
            if (state.step === 3) advanceStep();
          });
        } else {
          toast('Pipette is already full.');
          cancelPick();
        }
        return;
      }
      return;
    }

    // ── FLASK click ──
    if (type === 'flask') {
      // If pipette is picked and flask not filled yet → transfer
      if (state.picked === 'pipette' && state.pipetteFilled && !state.flaskFilled) {
        animatePipetteTo(dom.flask, () => {
          state.pipetteFilled = false;
          state.flaskFilled = true;
          dom.pipetteLiquid.style.height = '0';
          dom.pipetteBulgeLiquid.style.height = '0';
          dom.flaskLiquid.style.height = '30%';
          dom.flaskLiquid.style.backgroundColor = 'rgba(180,210,255,0.4)';
          toast('25.0 cm³ of FA2 transferred to flask.');
          returnPipette();
          if (state.step === 4) advanceStep();
        });
        return;
      }

      // If flask has indicator and not placed → move under burette
      if (state.indicatorAdded && !state.flaskPlaced) {
        placeFlask();
        if (state.step === 6) advanceStep();
        return;
      }

      // If nothing applicable
      if (!state.flaskFilled) {
        toast('Fill the flask with acid first (use pipette → beaker → flask).', 'info');
      } else if (!state.indicatorAdded) {
        toast('Add indicator to the flask first.', 'info');
      }
      return;
    }

    // ── INDICATOR click ──
    if (type === 'indicator') {
      if (!state.flaskFilled) {
        toast('Transfer acid to the flask first.', 'warn');
        return;
      }
      if (state.indicatorAdded) {
        toast('Indicator already added.', 'info');
        return;
      }
      // Show indicator choices in guide — or show popup at indicator bottle
      showIndicatorPopup();
      return;
    }
  });

  function pickUp(item) {
    cancelPick();
    state.picked = item;
    const el = document.querySelector(`[data-item="${item}"]`);
    if (el) {
      el.classList.add('picked');
    }
    // Show valid targets
    if (item === 'pipette') {
      dom.beaker.classList.add('valid-target');
      if (state.pipetteFilled && !state.flaskFilled) {
        dom.flask.classList.add('valid-target');
      }
    }
    toast(getPickMessage(item), 'info');
  }

  function getPickMessage(item) {
    if (item === 'pipette') {
      if (!state.pipetteRinsed) return 'Click the beaker to rinse the pipette with FA2.';
      if (!state.pipetteFilled) return 'Click the beaker to draw 25.0 cm³ of FA2.';
      if (state.pipetteFilled && !state.flaskFilled) return 'Click the conical flask to transfer acid.';
      return 'Pipette selected.';
    }
    return '';
  }

  function cancelPick() {
    state.picked = null;
    document.querySelectorAll('.apparatus').forEach(a => {
      a.classList.remove('picked', 'valid-target');
    });
  }

  // ── Pipette animation ──
  function animatePipetteTo(target, onComplete) {
    const pipette = dom.pipette;
    const pRect = pipette.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();

    // Centre horizontally over target
    const dx = tRect.left + tRect.width / 2 - (pRect.left + pRect.width / 2);
    // Position pipette tip (bottom) just above the target opening (top)
    const gap = 12;
    const dy = (tRect.top - gap) - pRect.bottom;

    pipette.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)';
    pipette.style.transform = `translate(${dx}px, ${dy}px)`;
    pipette.style.zIndex = '100';

    setTimeout(() => {
      if (onComplete) onComplete();
    }, 550);
  }

  function returnPipette() {
    const pipette = dom.pipette;
    pipette.style.transition = 'transform 0.4s cubic-bezier(0.16,1,0.3,1)';
    pipette.style.transform = '';
    pipette.style.zIndex = '';
    cancelPick();
  }


  // ══════════════════════════════════════
  // INDICATOR POPUP
  // ══════════════════════════════════════

  function showIndicatorPopup() {
    closePopups();
    const popup = document.createElement('div');
    popup.className = 'indicator-popup';
    popup.id = 'ind-popup';

    const title = document.createElement('h4');
    title.textContent = 'Choose indicator';
    popup.appendChild(title);

    Object.entries(INDICATORS).forEach(([key, ind]) => {
      const choice = document.createElement('div');
      choice.className = 'indicator-choice';
      choice.innerHTML = `
        <div class="indicator-swatch">
          <div class="indicator-swatch-acid" style="background:${ind.acidColor}"></div>
          <div class="indicator-swatch-base" style="background:${ind.baseColor}"></div>
        </div>
        <span class="indicator-choice-name">${ind.name}</span>
      `;
      choice.addEventListener('click', () => {
        selectIndicator(key);
        closePopups();
      });
      popup.appendChild(choice);
    });

    const indRect = dom.indicator.getBoundingClientRect();
    const wbRect = dom.workbench.getBoundingClientRect();
    popup.style.left = (indRect.left - wbRect.left - 50) + 'px';
    popup.style.top = (indRect.top - wbRect.top - 140) + 'px';
    dom.workbench.appendChild(popup);
  }

  function closePopups() {
    document.querySelectorAll('.indicator-popup').forEach(p => p.remove());
  }

  function selectIndicator(type) {
    state.indicatorType = type;
    state.indicatorAdded = true;
    const ind = INDICATORS[type];
    dom.flaskLiquid.style.backgroundColor = ind.acidColor;
    dom.indicator.querySelector('.indicator-label').textContent = ind.name.split(' ')[0];
    toast(`${ind.name} added to flask.`);

    // Show flask is now ready to place
    dom.flask.classList.add('valid-target');
    setTimeout(() => dom.flask.classList.remove('valid-target'), 2000);

    if (state.step === 5) advanceStep();
  }

  // ══════════════════════════════════════
  // FLASK PLACEMENT
  // ══════════════════════════════════════

  function placeFlask() {
    state.flaskPlaced = true;
    const stand = dom.standAssembly;
    const bur = dom.burette;
    const base = stand.querySelector('.retort-base');

    // Show white tile — it's inside stand-assembly, so use stand-relative coords
    const burCenter = bur.offsetLeft + bur.offsetWidth / 2;
    dom.whiteTile.style.display = '';
    dom.whiteTile.style.bottom = (base.offsetHeight + 2) + 'px';
    dom.whiteTile.style.left = (burCenter - 50) + 'px';

    // Place flask inside stand-assembly, sitting on the white tile
    dom.flask.classList.add('placed');
    stand.appendChild(dom.flask);
    dom.flask.style.bottom = (base.offsetHeight + 22) + 'px';
    dom.flask.style.left = (burCenter - 38) + 'px';

    // Show controls
    dom.buretteControls.style.display = '';
    dom.flaskZone.style.display = 'none';
    updateBuretteDisplay();
    cancelPick();
    toast('Flask placed on white tile under burette.');
  }

  function unplaceFlask() {
    state.flaskPlaced = false;
    dom.flask.classList.remove('placed');
    dom.workbench.appendChild(dom.flask);
    dom.flask.style.bottom = '';
    dom.flask.style.left = '';
    dom.flask.style.position = '';
    dom.whiteTile.style.display = 'none';
    dom.buretteControls.style.display = 'none';
  }


  // ══════════════════════════════════════
  // BURETTE LOGIC
  // ══════════════════════════════════════

  let flowInterval = null;

  function getBuretteReading() { return BURETTE_MAX - state.buretteVolume; }
  function updateBuretteDisplay() { dom.buretteReading.textContent = getBuretteReading().toFixed(2) + ' cm³'; }

  function updateVisuals() {
    dom.buretteLiquid.style.height = (state.buretteVolume / BURETTE_MAX * 100) + '%';
    updateBuretteDisplay();
  }

  function dispense(vol) {
    if (state.initialReading === null) return;
    if (state.endpointReached) return;
    const amt = Math.min(vol, state.buretteVolume);
    if (amt <= 0) return;

    state.buretteVolume -= amt;
    updateVisuals();
    checkEndpoint();
    triggerDrip();
  }

  function triggerDrip() {
    dom.buretteDrip.classList.remove('falling');
    void dom.buretteDrip.offsetWidth;
    dom.buretteDrip.style.opacity = '1';
    dom.buretteDrip.classList.add('falling');
    setTimeout(() => {
      dom.buretteDrip.classList.remove('falling');
      dom.buretteDrip.style.opacity = '0';
    }, 400);
  }

  function checkEndpoint() {
    if (!state.indicatorType) return;
    const initialVol = state.initialReading;
    const deliveredVol = initialVol - state.buretteVolume;
    const ind = INDICATORS[state.indicatorType];
    const ratio = deliveredVol / state.endpointVol;

    // Near endpoint flash
    if (ratio > 0.85 && ratio < 1.0) {
      dom.flaskLiquid.style.backgroundColor = ind.nearEndpoint;
      setTimeout(() => {
        if (!state.endpointReached) {
          dom.flaskLiquid.style.backgroundColor = ind.acidColor;
        }
      }, 300);
    }

    // Endpoint
    if (deliveredVol >= state.endpointVol && !state.endpointReached) {
      state.endpointReached = true;
      dom.flaskLiquid.style.backgroundColor = ind.baseColor;
      stopFlow();
      enableFlowButtons(false);
      toast('Endpoint reached! The colour change is permanent.', 'success');
      if (state.step === 8) advanceStep();
    }

    const fillRatio = Math.min(deliveredVol / 30, 1);
    dom.flaskLiquid.style.height = (30 + fillRatio * 25) + '%';
  }

  function startFlow(rate) {
    stopFlow();
    dispense(rate);
    flowInterval = setInterval(() => dispense(rate), 180);
  }

  function stopFlow() {
    if (flowInterval) { clearInterval(flowInterval); flowInterval = null; }
  }

  function enableFlowButtons(enabled) {
    [dom.btnFast, dom.btnSlow, dom.btnDrop].forEach(b => b.disabled = !enabled);
  }

  // Fast flow
  dom.btnFast.addEventListener('mousedown', () => startFlow(0.50));
  dom.btnFast.addEventListener('touchstart', (e) => { e.preventDefault(); startFlow(0.50); });
  ['mouseup', 'mouseleave'].forEach(evt => dom.btnFast.addEventListener(evt, stopFlow));
  ['touchend', 'touchcancel'].forEach(evt => dom.btnFast.addEventListener(evt, stopFlow));

  // Slow flow
  dom.btnSlow.addEventListener('mousedown', () => startFlow(0.10));
  dom.btnSlow.addEventListener('touchstart', (e) => { e.preventDefault(); startFlow(0.10); });
  ['mouseup', 'mouseleave'].forEach(evt => dom.btnSlow.addEventListener(evt, stopFlow));
  ['touchend', 'touchcancel'].forEach(evt => dom.btnSlow.addEventListener(evt, stopFlow));

  // Half drop
  dom.btnDrop.addEventListener('click', () => dispense(0.05));

  // Swirl
  dom.btnSwirl.addEventListener('click', () => {
    dom.flask.classList.remove('swirling');
    void dom.flask.offsetWidth;
    dom.flask.classList.add('swirling');
    setTimeout(() => dom.flask.classList.remove('swirling'), 400);
  });

  // Top up
  let topupInterval = null;
  function topUp(vol) {
    const amt = Math.min(vol, BURETTE_MAX - state.buretteVolume);
    if (amt <= 0) return;
    state.buretteVolume += amt;
    updateVisuals();
  }
  dom.btnTopup.addEventListener('mousedown', () => {
    topUp(0.5);
    topupInterval = setInterval(() => topUp(0.5), 150);
  });
  ['mouseup', 'mouseleave'].forEach(evt =>
    dom.btnTopup.addEventListener(evt, () => clearInterval(topupInterval))
  );

  // Log initial
  dom.btnLogInitial.addEventListener('click', () => {
    state.initialReading = state.buretteVolume;
    const reading = getBuretteReading();
    const input = document.getElementById(`initial-${state.run}`);

    if (typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided()) {
      // Independent mode: student enters reading manually
      if (input) {
        input.readOnly = false;
        input.value = '';
        input.placeholder = reading.toFixed(2);
        input.focus();
        input.style.background = 'var(--color-primary-light)';
        toast('Read the burette and type your initial reading.', 'info');
        const confirmHandler = () => {
          const entered = parseFloat(input.value);
          if (isNaN(entered)) return;
          input.readOnly = true;
          input.style.background = '';
          input.removeEventListener('blur', confirmHandler);
          input.removeEventListener('keydown', keyHandler);
          enableFlowButtons(true);
          if (state.step === 7) advanceStep();
        };
        const keyHandler = (e) => { if (e.key === 'Enter') confirmHandler(); };
        input.addEventListener('blur', confirmHandler);
        input.addEventListener('keydown', keyHandler);
      }
    } else {
      // Guided mode: auto-fill
      if (input) input.value = reading.toFixed(2);
      enableFlowButtons(true);
      toast(`Initial reading: ${reading.toFixed(2)} cm\u00B3`);
      if (state.step === 7) advanceStep();
    }
  });

  // Log final — records the final burette reading and completes the titration
  dom.btnLogFinal.addEventListener('click', () => {
    if (state.initialReading === null) {
      toast('Log the initial reading first.', 'warn');
      return;
    }
    const finalReading = getBuretteReading();
    const initialReading = parseFloat(document.getElementById(`initial-${state.run}`)?.value || '0');
    const titre = finalReading - initialReading;
    const finalInput = document.getElementById(`final-${state.run}`);
    const titreInput = document.getElementById(`titre-${state.run}`);
    const isIndependent = typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided();

    // Helper: called after final reading is determined (immediately in guided, after input in independent)
    function finishTitration(finalVal, initVal, titreVal) {
      try {
        if (finalInput) finalInput.value = finalVal.toFixed(2);
        if (titreInput) titreInput.value = titreVal.toFixed(2);
        state.results.push({ initial: initVal, final: finalVal, titre: titreVal, run: state.run });
        enableFlowButtons(false);
        checkConcordance();
        toast(`Titre ${state.run === 0 ? '(rough)' : '#' + state.run}: ${titreVal.toFixed(2)} cm\u00B3`);
        state.step = STEPS.length - 1;
        renderStepsBar();
        updateGuide();
      } catch (err) {
        console.error('[finishTitration] Error:', err);
      }
      // Always show the next-run dialog, even if something above failed
      showNextRunBar();
    }

    if (isIndependent && finalInput) {
      // Independent mode: student types their own final reading
      finalInput.readOnly = false;
      finalInput.value = '';
      finalInput.placeholder = finalReading.toFixed(2);
      finalInput.focus();
      finalInput.style.background = 'var(--color-primary-light)';
      toast('Read the burette and type your final reading.', 'info');
      const confirmHandler = () => {
        const entered = parseFloat(finalInput.value);
        if (isNaN(entered)) return;
        finalInput.readOnly = true;
        finalInput.style.background = '';
        finalInput.removeEventListener('blur', confirmHandler);
        finalInput.removeEventListener('keydown', keyHandler);
        const studentInitial = parseFloat(document.getElementById(`initial-${state.run}`)?.value || '0');
        finishTitration(entered, studentInitial, entered - studentInitial);
      };
      const keyHandler = (e) => { if (e.key === 'Enter') confirmHandler(); };
      finalInput.addEventListener('blur', confirmHandler);
      finalInput.addEventListener('keydown', keyHandler);
    } else {
      // Guided mode: auto-fill immediately
      finishTitration(finalReading, initialReading, titre);
    }
  });


  // ══════════════════════════════════════
  // CONCORDANCE
  // ══════════════════════════════════════

  function checkConcordance() {
    if (state.results.length < 2) { dom.concordantMsg.style.display = 'none'; return; }

    const accurateTitres = state.results.filter(r => r.run > 0).map(r => r.titre);
    let concordantPair = null;

    for (let i = 0; i < accurateTitres.length; i++) {
      for (let j = i + 1; j < accurateTitres.length; j++) {
        if (Math.abs(accurateTitres[i] - accurateTitres[j]) <= CONCORDANT_THRESHOLD) {
          concordantPair = [accurateTitres[i], accurateTitres[j]];
        }
      }
    }

    dom.concordantMsg.style.display = '';
    if (concordantPair) {
      const avg = (concordantPair[0] + concordantPair[1]) / 2;
      dom.concordantMsg.className = 'concordant-msg success';
      dom.concordantMsg.innerHTML = `Concordant: ${concordantPair[0].toFixed(2)} and ${concordantPair[1].toFixed(2)} cm³.<br>Average titre = <strong>${avg.toFixed(2)} cm³</strong>`;
      showCalculations(avg);
      highlightConcordant(concordantPair);
    } else {
      dom.concordantMsg.className = 'concordant-msg info';
      dom.concordantMsg.textContent = `No concordant results yet. Need two titres within ${CONCORDANT_THRESHOLD} cm³.`;
    }
  }

  function highlightConcordant(pair) {
    document.querySelectorAll('.data-table td.concordant').forEach(td => td.classList.remove('concordant'));
    state.results.forEach(r => {
      if (pair.includes(r.titre)) {
        ['final', 'initial', 'titre'].forEach(prefix => {
          const td = document.getElementById(`${prefix}-${r.run}`)?.parentElement;
          if (td) td.classList.add('concordant');
        });
      }
    });
  }

  function showCalculations(avgTitre) {
    const molesBase = (state.baseConc * avgTitre) / 1000;
    const molesAcid = molesBase;
    const calcConc = molesAcid / (PIPETTE_VOL / 1000);

    dom.calcWorkspace.innerHTML = `
      <span class="calc-label">Average titre (concordant)</span>
      <div class="calc-line">${avgTitre.toFixed(2)} cm³</div>
      <span class="calc-label">Moles of NaOH added</span>
      <div class="calc-line">n = c × V = ${state.baseConc.toFixed(2)} × ${avgTitre.toFixed(2)}/1000 = ${molesBase.toFixed(6)} mol</div>
      <span class="calc-label">Mole ratio NaOH : acid = 1 : 1</span>
      <div class="calc-line">Moles of acid = ${molesAcid.toFixed(6)} mol</div>
      <span class="calc-label">Concentration of FA2</span>
      <div class="calc-line">c = n / V = ${molesAcid.toFixed(6)} / ${(PIPETTE_VOL / 1000).toFixed(4)}</div>
      <div class="calc-result">Concentration of FA2 = ${calcConc.toFixed(4)} mol dm⁻³</div>
    `;
  }


  // ══════════════════════════════════════
  // REPEAT / NEXT TITRATION
  // ══════════════════════════════════════

  // Button in guide actions for "repeat" step
  dom.guideActions.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn?.dataset.action === 'next-titration') startNextTitration();
  });

  // Wire up the static topbar Next Titration button
  if (dom.btnNextTitration) {
    dom.btnNextTitration.addEventListener('click', () => {
      if (state.results.length === 0) {
        toast('Complete a titration first.', 'warn');
        return;
      }
      startNextTitration();
    });
  }

  // ── Next Run Bar ──

  const nextRunBar = $('next-run-bar');
  const nextRunLabel = $('next-run-label');
  const btnNextRun = $('btn-next-run');

  if (btnNextRun) {
    btnNextRun.addEventListener('click', () => startNextTitration());
  }

  function showNextRunBar() {
    if (state.run >= 3) {
      toast('All four titrations complete! Check your concordance results.', 'success');
      return;
    }
    const label = state.run === 0 ? '1st accurate' :
                  state.run === 1 ? '2nd accurate' : '3rd accurate';

    // Enable the topbar button
    if (dom.btnNextTitration) dom.btnNextTitration.disabled = false;

    // Show the green bottom bar
    if (nextRunBar) {
      if (nextRunLabel) nextRunLabel.textContent = `Titration recorded! Ready for ${label} run.`;
      nextRunBar.style.display = '';
    }
  }

  function hideNextRunBar() {
    if (nextRunBar) nextRunBar.style.display = 'none';
    if (dom.btnNextTitration) dom.btnNextTitration.disabled = true;
  }

  function startNextTitration() {
    if (state.run >= 3) {
      toast('All four titrations complete.', 'info');
      return;
    }
    hideNextRunBar();

    state.run++;
    // Reset all per-titration state so guided steps advance correctly
    state.pipetteRinsed = false;
    state.pipetteFilled = false;
    state.flaskFilled = false;
    state.indicatorType = null;
    state.indicatorAdded = false;
    state.flaskPlaced = false;
    state.initialReading = null;
    state.endpointReached = false;
    state.endpointVol = (state.acidConc * PIPETTE_VOL) / state.baseConc;

    // Reset visuals
    dom.pipetteLiquid.style.height = '0';
    dom.pipetteBulgeLiquid.style.height = '0';
    dom.flaskLiquid.style.height = '0';
    dom.flaskLiquid.style.backgroundColor = 'transparent';
    dom.indicator.querySelector('.indicator-label').textContent = 'Indicator';
    unplaceFlask();
    enableFlowButtons(false);

    state.step = 2; // back to rinse-pipette (burette stays filled)
    renderStepsBar();
    updateGuide();
    toast(`Starting titration ${state.run === 1 ? '1st' : state.run === 2 ? '2nd' : '3rd'} accurate.`);
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    stopFlow();
    Object.assign(state, {
      step: 0, picked: null,
      buretteRinsed: false, buretteFilled: false, buretteVolume: 0,
      pipetteRinsed: false, pipetteFilled: false, flaskFilled: false,
      indicatorType: null, indicatorAdded: false, flaskPlaced: false,
      initialReading: null, endpointReached: false, run: 0, results: [],
    });
    computeEndpoint();

    dom.pipetteLiquid.style.height = '0';
    dom.pipetteBulgeLiquid.style.height = '0';
    dom.flaskLiquid.style.height = '0';
    dom.flaskLiquid.style.backgroundColor = 'transparent';
    dom.pipette.style.transform = '';
    dom.pipette.style.zIndex = '';
    dom.indicator.querySelector('.indicator-label').textContent = 'Indicator';
    unplaceFlask();
    enableFlowButtons(false);
    dom.buretteControls.style.display = 'none';
    dom.beakerLiquid.style.height = '75%';
    cancelPick();
    closePopups();
    hideNextRunBar();

    for (let i = 0; i < 4; i++) {
      ['final', 'initial', 'titre'].forEach(prefix => {
        const input = document.getElementById(`${prefix}-${i}`);
        if (input) { input.value = ''; input.parentElement?.classList.remove('concordant'); }
      });
    }
    dom.concordantMsg.style.display = 'none';
    dom.calcWorkspace.innerHTML = '<p class="text-sm text-muted">Complete at least two concordant titrations to begin calculations.</p>';

    updateVisuals();
    renderStepsBar();
    updateGuide();
  });


  // ══════════════════════════════════════
  // GUIDE TOGGLE
  // ══════════════════════════════════════

  dom.btnToggleGuide.addEventListener('click', () => {
    state.guideOpen = !state.guideOpen;
    dom.guidePanel.style.display = state.guideOpen ? '' : 'none';
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
    // Audio feedback
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }
});
