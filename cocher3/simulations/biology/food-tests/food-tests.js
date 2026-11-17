/* ============================================================
   Food Tests Practical — Logic
   Uses FOOD_DATA from food-data.js (loaded first via var)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const data = window.FOOD_DATA;
  if (!data) { console.error('FOOD_DATA not loaded.'); return; }

  const NUM_TUBES = 6;

  // ── State ──
  const state = {
    sampleKey: null,
    sampleData: null,
    selectedBottle: null,
    selectedTube: null,
    tubeContents: {},
    observations: [],
    procedureDone: { select: false, iodine: false, benedicts: false, biuret: false, emulsion: false, conclude: false },
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    sampleSelect: $('sample-select'),
    confirmBtn: $('btn-confirm-sample'),
    sampleChooser: $('sample-chooser'),
    sampleInfo: $('sample-info'),
    sampleBadge: $('sample-badge'),
    sampleHint: $('sample-hint'),
    rackTubes: $('rack-tubes'),
    reagentShelf: $('reagent-shelf'),
    waterBath: $('water-bath'),
    waterBathBody: null,
    waterBathIndicator: $('water-bath-indicator'),
    sink: $('sink'),
    washBar: $('wash-bar'),
    btnWash: $('btn-wash'),
    obsTbody: $('obs-tbody'),
    obsEmpty: $('obs-empty'),
    idStarch: $('id-starch'),
    idSugar: $('id-reducing-sugar'),
    idProtein: $('id-protein'),
    idLipid: $('id-lipid'),
    btnCheckId: $('btn-check-id'),
    idResult: $('id-result'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel: $('guide-panel'),
    workbench: $('workbench'),
    toastContainer: $('toast-container'),
  };
  dom.waterBathBody = dom.waterBath.querySelector('.water-bath-body');

  // ── LabRecordMode ──
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  // ── Init ──
  buildSampleSelect();
  buildTestTubes();
  buildReagentBottles();

  // ══════════════════════════════════════
  // SAMPLE SELECTION
  // ══════════════════════════════════════

  function buildSampleSelect() {
    Object.keys(data.samples).forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      dom.sampleSelect.appendChild(opt);
    });
  }

  dom.sampleSelect.addEventListener('change', () => {
    dom.confirmBtn.disabled = !dom.sampleSelect.value;
  });

  dom.confirmBtn.addEventListener('click', () => {
    const key = dom.sampleSelect.value;
    if (!key) return;
    state.sampleKey = key;
    state.sampleData = data.samples[key];

    dom.sampleChooser.style.display = 'none';
    dom.sampleInfo.style.display = '';
    dom.sampleBadge.textContent = key;
    dom.sampleHint.textContent = state.sampleData.appearance + '. Perform food tests to identify macronutrients.';

    dom.washBar.style.display = '';
    dom.btnCheckId.disabled = false;
    markProcedure('select');

    // Update sample bottle
    const bottle = document.querySelector('[data-bottle="Sample"]');
    if (bottle) {
      const lbl = bottle.querySelector('.bottle-label');
      if (lbl) lbl.innerHTML = key.split(' ')[0] + '<br><span style="font-weight:400;opacity:0.7;">sample</span>';
      const fill = bottle.querySelector('.bottle-fill');
      if (fill) fill.style.background = state.sampleData.color;
    }

    addObservation('—', `${key} selected.`, state.sampleData.appearance + '.');
    toast(`${key} selected. Transfer sample to test tubes and add reagents.`, 'info');
  });


  // ══════════════════════════════════════
  // TEST TUBES
  // ══════════════════════════════════════

  function buildTestTubes() {
    dom.rackTubes.innerHTML = '';
    for (let i = 1; i <= NUM_TUBES; i++) {
      state.tubeContents[i] = { hasSample: false, reagents: [], heated: false, reacted: false };

      const slot = document.createElement('div');
      slot.className = 'tube-slot';

      const label = document.createElement('div');
      label.className = 'tube-label';
      label.id = `tube-label-${i}`;
      label.textContent = `${i}`;

      const tube = document.createElement('div');
      tube.className = 'test-tube';
      tube.dataset.tube = i;
      tube.title = `Test tube ${i}`;

      const liquid = document.createElement('div');
      liquid.className = 'tube-liquid';
      liquid.id = `tube-liquid-${i}`;

      const ppt = document.createElement('div');
      ppt.className = 'ppt-layer';
      ppt.id = `tube-ppt-${i}`;

      tube.appendChild(liquid);
      tube.appendChild(ppt);
      slot.appendChild(label);
      slot.appendChild(tube);
      dom.rackTubes.appendChild(slot);

      tube.addEventListener('click', (e) => {
        e.stopPropagation();
        handleTubeClick(i);
      });
    }
  }

  function handleTubeClick(tubeIdx) {
    document.querySelectorAll('.test-tube').forEach(t => t.classList.remove('selected'));
    document.querySelector(`.test-tube[data-tube="${tubeIdx}"]`).classList.add('selected');
    state.selectedTube = tubeIdx;

    if (!state.sampleKey) { toast('Select a food sample first.', 'warn'); return; }
    if (!state.selectedBottle) { toast('Select a reagent bottle first, then click a tube.', 'info'); return; }

    const bottle = state.selectedBottle;

    if (bottle === 'Sample') {
      transferSample(tubeIdx);
      return;
    }

    if (!state.tubeContents[tubeIdx].hasSample) {
      toast('Transfer sample to this tube first.', 'warn');
      return;
    }

    addReagent(tubeIdx, bottle);
  }


  // ══════════════════════════════════════
  // REAGENT BOTTLES
  // ══════════════════════════════════════

  function buildReagentBottles() {
    dom.reagentShelf.innerHTML = '';

    // Sample bottle
    dom.reagentShelf.appendChild(createBottle('Sample', state.sampleKey || 'Sample', '', state.sampleData?.color || 'rgba(200,220,255,0.3)'));

    // Reagent bottles
    Object.entries(data.reagents).forEach(([key, r]) => {
      dom.reagentShelf.appendChild(createBottle(key, r.label, r.sub, r.color));
    });
  }

  function createBottle(key, label, sub, liquidColor) {
    const slot = document.createElement('div');
    slot.className = 'reagent-slot';

    const bottle = document.createElement('div');
    bottle.className = 'reagent-bottle';
    bottle.dataset.bottle = key;

    const dropper = document.createElement('div');
    dropper.className = 'bottle-dropper';
    const bulb = document.createElement('div');
    bulb.className = 'bottle-dropper-bulb';
    const stem = document.createElement('div');
    stem.className = 'bottle-dropper-stem';
    dropper.appendChild(bulb);
    dropper.appendChild(stem);

    const fill = document.createElement('div');
    fill.className = 'bottle-fill';
    fill.style.background = liquidColor || 'rgba(200,220,255,0.3)';

    const lbl = document.createElement('span');
    lbl.className = 'bottle-label';
    lbl.innerHTML = label + (sub ? `<br><span style="font-weight:400;opacity:0.7;">${sub}</span>` : '');

    bottle.appendChild(dropper);
    bottle.appendChild(fill);
    bottle.appendChild(lbl);
    slot.appendChild(bottle);

    bottle.addEventListener('click', (e) => {
      e.stopPropagation();
      selectBottle(key);
    });

    return slot;
  }

  function selectBottle(key) {
    if (!state.sampleKey && key !== 'Sample') { toast('Select a food sample first.', 'warn'); return; }
    if (state.selectedBottle === key) { deselectBottle(); return; }

    document.querySelectorAll('.reagent-bottle').forEach(b => b.classList.remove('selected'));
    state.selectedBottle = key;
    const bottle = document.querySelector(`[data-bottle="${key}"]`);
    if (bottle) bottle.classList.add('selected');

    if (state.selectedTube) handleTubeClick(state.selectedTube);
  }

  function deselectBottle() {
    document.querySelectorAll('.reagent-bottle').forEach(b => b.classList.remove('selected'));
    state.selectedBottle = null;
  }


  // ══════════════════════════════════════
  // CHEMISTRY ENGINE
  // ══════════════════════════════════════

  function transferSample(tubeIdx) {
    const tc = state.tubeContents[tubeIdx];
    if (tc.hasSample && tc.reagents.length === 0) { toast('Already has sample.', 'info'); return; }
    if (tc.hasSample) { toast('Tube already has contents. Wash it first.', 'warn'); return; }

    tc.hasSample = true;
    tc.reagents = [];
    tc.heated = false;
    tc.reacted = false;

    const liquid = document.getElementById(`tube-liquid-${tubeIdx}`);
    const label = document.getElementById(`tube-label-${tubeIdx}`);
    liquid.style.height = '30%';
    liquid.style.background = state.sampleData.color;
    if (label) label.textContent = state.sampleKey.split(' ')[0];

    flashTube(tubeIdx);
    addObservation(`TT${tubeIdx}`, `Sample transferred to TT${tubeIdx}.`, state.sampleData.appearance + '.');
  }

  function addReagent(tubeIdx, reagentKey) {
    const tc = state.tubeContents[tubeIdx];
    tc.reagents.push(reagentKey);

    const reagentName = data.reagents[reagentKey]?.label || reagentKey;
    addObservation(`TT${tubeIdx}`, `${reagentName} added to TT${tubeIdx}.`, 'Reagent added.');

    // Update liquid level
    const liquid = document.getElementById(`tube-liquid-${tubeIdx}`);
    const currentH = parseInt(liquid.style.height) || 30;
    liquid.style.height = Math.min(currentH + 10, 60) + '%';

    // Check if any test is now complete
    checkTestResult(tubeIdx);
    flashTube(tubeIdx);

    // Update tube label
    const label = document.getElementById(`tube-label-${tubeIdx}`);
    if (label) {
      const codes = tc.reagents.map(r => {
        if (r === 'Benedicts') return 'Ben';
        if (r === 'Iodine') return 'I₂';
        if (r === 'CuSO4') return 'Cu²⁺';
        return r;
      });
      label.textContent = codes.join('+');
    }
  }

  function checkTestResult(tubeIdx) {
    const tc = state.tubeContents[tubeIdx];
    if (tc.reacted) return;

    const reagentSet = new Set(tc.reagents);

    // Check each test
    Object.entries(data.tests).forEach(([testKey, test]) => {
      const needed = test.reagents;
      const allPresent = needed.every(r => reagentSet.has(r));
      if (!allPresent) return;

      // For heating-required tests, don't react yet
      if (test.requiresHeating && !tc.heated) return;

      // Determine result
      tc.reacted = true;
      const hasNutrient = state.sampleData.components.includes(test.detects);
      const result = hasNutrient ? test.positiveResult : test.negativeResult;

      applyTestResult(tubeIdx, testKey, test, result);
      markProcedure(testKey);
    });
  }

  function applyTestResult(tubeIdx, testKey, test, result) {
    const liquid = document.getElementById(`tube-liquid-${tubeIdx}`);
    const ppt = document.getElementById(`tube-ppt-${tubeIdx}`);

    liquid.style.background = result.tubeColor;

    if (result.ppt) {
      ppt.style.opacity = '1';
      ppt.style.height = '16px';
      ppt.style.background = result.pptColor || '#f0f2f5';
    }

    addObservation(`TT${tubeIdx}`, test.name, result.observation);
    flashTube(tubeIdx);
  }


  // ══════════════════════════════════════
  // WATER BATH (for Benedict's)
  // ══════════════════════════════════════

  dom.waterBath.addEventListener('click', () => {
    if (!state.sampleKey) { toast('Select a food sample first.', 'warn'); return; }
    if (!state.selectedTube) { toast('Select a tube to heat first.', 'info'); return; }

    const tubeIdx = state.selectedTube;
    const tc = state.tubeContents[tubeIdx];

    if (!tc.hasSample) { toast('This tube is empty.', 'warn'); return; }
    if (tc.heated) { toast('Already heated.', 'info'); return; }

    // Check if tube has Benedict's solution
    if (!tc.reagents.includes('Benedicts')) {
      toast("Add Benedict's solution to the tube before heating.", 'warn');
      return;
    }

    // Animate heating
    dom.waterBathBody.classList.add('heating');
    dom.waterBathIndicator.textContent = 'Heating...';
    dom.waterBathIndicator.classList.add('heating');

    addObservation(`TT${tubeIdx}`, `TT${tubeIdx} heated in water bath (~80°C).`, 'Heating for 2 minutes...');

    setTimeout(() => {
      tc.heated = true;
      dom.waterBathBody.classList.remove('heating');
      dom.waterBathIndicator.textContent = 'Off';
      dom.waterBathIndicator.classList.remove('heating');

      // Now check for reaction
      checkTestResult(tubeIdx);
      toast('Heating complete.', 'success');
    }, 2000);
  });


  // ══════════════════════════════════════
  // OBSERVATIONS TABLE
  // ══════════════════════════════════════

  function addObservation(tube, procedure, observation) {
    state.observations.push({ tube, procedure, observation });
    dom.obsEmpty.style.display = 'none';

    const guided = (typeof LabRecordMode === 'undefined') || LabRecordMode.isGuided();

    const row = document.createElement('tr');
    row.className = 'animate-fade-in';

    if (guided) {
      row.innerHTML = `<td>${tube}</td><td>${procedure}</td><td>${observation}</td>`;
    } else {
      // Independent mode: student must type the observation
      const tdTube = document.createElement('td');
      tdTube.textContent = tube;
      const tdProc = document.createElement('td');
      tdProc.textContent = procedure;
      const tdObs = document.createElement('td');
      const obsInput = document.createElement('input');
      obsInput.type = 'text';
      obsInput.className = 'obs-manual-input';
      obsInput.placeholder = 'Type your observation\u2026';
      obsInput.style.cssText = 'width:100%;border:1px solid var(--color-border);border-radius:4px;padding:2px 6px;font-size:inherit;background:var(--color-surface);color:var(--color-text);';
      obsInput.setAttribute('data-expected', observation);
      tdObs.appendChild(obsInput);
      row.appendChild(tdTube);
      row.appendChild(tdProc);
      row.appendChild(tdObs);
    }

    dom.obsTbody.appendChild(row);

    const scrollContainer = dom.obsTbody.closest('.ft-obs-scroll');
    if (scrollContainer) setTimeout(() => { scrollContainer.scrollTop = scrollContainer.scrollHeight; }, 50);
  }


  // ══════════════════════════════════════
  // PROCEDURE TRACKING
  // ══════════════════════════════════════

  function markProcedure(step) {
    state.procedureDone[step] = true;
    document.querySelectorAll('.procedure-step').forEach(el => {
      const s = el.dataset.step;
      if (state.procedureDone[s]) {
        el.classList.add('done');
        el.classList.remove('active');
      }
    });
    const steps = ['select', 'iodine', 'benedicts', 'biuret', 'emulsion', 'conclude'];
    for (const s of steps) {
      if (!state.procedureDone[s]) {
        const el = document.querySelector(`.procedure-step[data-step="${s}"]`);
        if (el) el.classList.add('active');
        break;
      }
    }
  }


  // ══════════════════════════════════════
  // WASH / SINK
  // ══════════════════════════════════════

  dom.sink.addEventListener('click', washTubes);
  dom.btnWash.addEventListener('click', washTubes);

  function washTubes() {
    if (!state.sampleKey) return;
    for (let i = 1; i <= NUM_TUBES; i++) {
      const liquid = document.getElementById(`tube-liquid-${i}`);
      const ppt = document.getElementById(`tube-ppt-${i}`);
      const label = document.getElementById(`tube-label-${i}`);
      if (liquid) { liquid.style.height = '0'; liquid.style.background = 'transparent'; }
      if (ppt) { ppt.style.opacity = '0'; ppt.style.height = '0'; }
      if (label) label.textContent = `${i}`;
      state.tubeContents[i] = { hasSample: false, reagents: [], heated: false, reacted: false };
    }
    document.querySelectorAll('.test-tube').forEach(t => t.classList.remove('selected'));
    document.querySelectorAll('.reagent-bottle').forEach(b => b.classList.remove('selected'));
    state.selectedTube = null;
    state.selectedBottle = null;
    addObservation('All', 'All test tubes washed and dried.', '—');
    toast('All test tubes washed.', 'info');
  }


  // ══════════════════════════════════════
  // IDENTIFICATION CHECK
  // ══════════════════════════════════════

  dom.btnCheckId.addEventListener('click', () => {
    if (!state.sampleKey) return;

    const guesses = [];
    if (dom.idStarch.checked) guesses.push('starch');
    if (dom.idSugar.checked) guesses.push('reducing-sugar');
    if (dom.idProtein.checked) guesses.push('protein');
    if (dom.idLipid.checked) guesses.push('lipid');

    if (guesses.length === 0) { toast('Tick at least one macronutrient.', 'warn'); return; }

    const actual = state.sampleData.components.slice().sort();
    const sorted = guesses.slice().sort();
    const correct = actual.length === sorted.length && actual.every((v, i) => v === sorted[i]);

    dom.idResult.style.display = '';
    if (correct) {
      dom.idResult.className = 'mt-2 id-result-correct';
      dom.idResult.innerHTML = `Correct! <strong>${state.sampleKey}</strong> contains: ${actual.join(', ').replace('reducing-sugar', 'reducing sugar')}.`;
      markProcedure('conclude');
      toast('Correct identification!', 'success');
    } else {
      dom.idResult.className = 'mt-2 id-result-incorrect';
      dom.idResult.textContent = 'Not quite right. Review your observations and try again.';
    }
  });


  // ══════════════════════════════════════
  // UTILITY
  // ══════════════════════════════════════

  function flashTube(tubeIdx) {
    const tube = document.querySelector(`.test-tube[data-tube="${tubeIdx}"]`);
    if (!tube) return;
    tube.classList.add('flash');
    setTimeout(() => tube.classList.remove('flash'), 500);
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    Object.assign(state, {
      sampleKey: null, sampleData: null, selectedBottle: null, selectedTube: null,
      tubeContents: {}, observations: [],
      procedureDone: { select: false, iodine: false, benedicts: false, biuret: false, emulsion: false, conclude: false },
    });

    dom.sampleChooser.style.display = '';
    dom.sampleInfo.style.display = 'none';
    dom.sampleSelect.value = '';
    dom.confirmBtn.disabled = true;

    for (let i = 1; i <= NUM_TUBES; i++) {
      state.tubeContents[i] = { hasSample: false, reagents: [], heated: false, reacted: false };
      const liquid = document.getElementById(`tube-liquid-${i}`);
      const ppt = document.getElementById(`tube-ppt-${i}`);
      const label = document.getElementById(`tube-label-${i}`);
      if (liquid) { liquid.style.height = '0'; liquid.style.background = 'transparent'; }
      if (ppt) { ppt.style.opacity = '0'; ppt.style.height = '0'; }
      if (label) label.textContent = `${i}`;
    }

    document.querySelectorAll('.test-tube').forEach(t => t.classList.remove('selected'));
    document.querySelectorAll('.reagent-bottle').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.procedure-step').forEach(el => { el.classList.remove('done', 'active'); });
    document.querySelector('.procedure-step[data-step="select"]')?.classList.add('active');

    dom.obsTbody.innerHTML = '';
    dom.obsEmpty.style.display = '';
    dom.washBar.style.display = 'none';
    dom.btnCheckId.disabled = true;
    dom.idResult.style.display = 'none';
    dom.idStarch.checked = false;
    dom.idSugar.checked = false;
    dom.idProtein.checked = false;
    dom.idLipid.checked = false;

    dom.waterBathBody.classList.remove('heating');
    dom.waterBathIndicator.textContent = 'Off';
    dom.waterBathIndicator.classList.remove('heating');

    buildReagentBottles();
  });


  // ══════════════════════════════════════
  // GUIDE TOGGLE
  // ══════════════════════════════════════

  dom.btnToggleGuide.addEventListener('click', () => {
    const visible = dom.guidePanel.style.display !== 'none';
    dom.guidePanel.style.display = visible ? 'none' : '';
  });


  // ══════════════════════════════════════
  // GLOBAL CLICK TO DESELECT
  // ══════════════════════════════════════

  dom.workbench.addEventListener('click', (e) => {
    if (!e.target.closest('.test-tube') &&
        !e.target.closest('.reagent-bottle') &&
        !e.target.closest('.reagent-popup') &&
        !e.target.closest('.water-bath-assembly') &&
        !e.target.closest('.sink-assembly')) {
      document.querySelectorAll('.test-tube').forEach(t => t.classList.remove('selected'));
      state.selectedTube = null;
    }
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
    }, 3000);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }
});
