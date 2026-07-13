/* ============================================================
   Qualitative Analysis Practical — Logic (v2)
   Uses CHEMISTRY_DATA from chemistry-data.js (loaded first via var)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const data = window.CHEMISTRY_DATA;
  if (!data) {
    console.error('CHEMISTRY_DATA not loaded. Check chemistry-data.js.');
    return;
  }

  const NUM_TUBES = 5;

  // ── State ──
  const state = {
    unknownKey: null,
    unknownData: null,
    selectedBottle: null,   // 'Unknown', 'NaOH', 'NH3', etc.
    selectedTube: null,     // tube index 1–5
    tubeContents: {},       // { 1: { hasSample: true, reagents: [{key, amount}] } }
    observations: [],
    procedureDone: { observe: false, cation: false, anion: false, flame: false, conclude: false },
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    unknownSelect: $('unknown-select'),
    confirmBtn: $('btn-confirm-unknown'),
    unknownChooser: $('unknown-chooser'),
    unknownInfo: $('unknown-info'),
    unknownBadge: $('unknown-badge'),
    unknownHint: $('unknown-hint'),
    rackTubes: $('rack-tubes'),
    reagentShelf: $('reagent-shelf'),
    bunsen: $('bunsen'),
    bunsenFlame: $('bunsen-flame'),
    sink: $('sink'),
    washBar: $('wash-bar'),
    btnWash: $('btn-wash'),
    obsTbody: $('obs-tbody'),
    obsEmpty: $('obs-empty'),
    flameOverlay: $('flame-overlay'),
    flameVisual: $('flame-visual'),
    flameText: $('flame-text'),
    btnCloseFlame: $('btn-close-flame'),
    idCation: $('id-cation'),
    idAnion: $('id-anion'),
    btnCheckId: $('btn-check-id'),
    idResult: $('id-result'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel: $('guide-panel'),
    workbench: $('workbench'),
    toastContainer: $('toast-container'),
  };

  // ── Reagent definitions ──
  const REAGENTS = [
    { key: 'NaOH',  label: 'NaOH',  sub: '(aq)',  color: 'rgba(200,220,255,0.4)' },
    { key: 'NH3',   label: 'NH₃',   sub: '(aq)',  color: 'rgba(200,220,255,0.4)' },
    { key: 'HNO3',  label: 'HNO₃',  sub: '(aq)',  color: 'rgba(255,240,200,0.4)' },
    { key: 'AgNO3', label: 'AgNO₃', sub: '(aq)',  color: 'rgba(220,220,220,0.4)' },
    { key: 'BaCl2', label: 'BaCl₂', sub: '(aq)',  color: 'rgba(220,220,220,0.4)' },
  ];

  // ── Recording Mode ──
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  // ── Initialise UI ──
  buildUnknownSelect();
  buildTestTubes();
  buildReagentBottles();

  // ══════════════════════════════════════
  // UNKNOWN SELECTION
  // ══════════════════════════════════════

  function buildUnknownSelect() {
    const keys = Object.keys(data.unknowns);
    keys.forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      dom.unknownSelect.appendChild(opt);
    });
  }

  dom.unknownSelect.addEventListener('change', () => {
    dom.confirmBtn.disabled = !dom.unknownSelect.value;
  });

  dom.confirmBtn.addEventListener('click', () => {
    const key = dom.unknownSelect.value;
    if (!key) return;
    state.unknownKey = key;
    state.unknownData = data.unknowns[key];

    const cn = state.unknownData.colorName;

    dom.unknownChooser.style.display = 'none';
    dom.unknownInfo.style.display = '';
    dom.unknownBadge.textContent = key;
    dom.unknownBadge.style.background = cn === 'colourless'
      ? 'var(--color-primary)' : state.unknownData.solutionColor;
    dom.unknownHint.textContent = cn === 'colourless'
      ? 'The solution is colourless. Identify the cation and anion.'
      : `The solution is ${cn}. Identify the cation and anion.`;

    dom.washBar.style.display = '';
    dom.btnCheckId.disabled = false;
    markProcedure('observe');

    // Update unknown bottle label and fill colour
    const unknownBottle = document.querySelector('[data-bottle="Unknown"]');
    if (unknownBottle) {
      const lbl = unknownBottle.querySelector('.bottle-label');
      if (lbl) lbl.innerHTML = key + '<br><span style="font-weight:400;opacity:0.7;">sample</span>';
      const fill = unknownBottle.querySelector('.bottle-fill');
      if (fill) fill.style.background = cn === 'colourless'
        ? 'rgba(200, 220, 240, 0.35)' : state.unknownData.solutionColor;
    }

    addObservation('—', `${key} solution examined.`,
      cn === 'colourless'
        ? 'Colourless solution.'
        : `${cn.charAt(0).toUpperCase() + cn.slice(1)} solution.`
    );

    toast(`${key} selected. Click the sample bottle, then click a test tube to transfer.`, 'info');
  });


  // ══════════════════════════════════════
  // TEST TUBES
  // ══════════════════════════════════════

  function buildTestTubes() {
    dom.rackTubes.innerHTML = '';
    for (let i = 1; i <= NUM_TUBES; i++) {
      state.tubeContents[i] = { hasSample: false, reagents: [] };

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
    // Highlight this tube
    document.querySelectorAll('.test-tube').forEach(t => t.classList.remove('selected'));
    document.querySelector(`.test-tube[data-tube="${tubeIdx}"]`).classList.add('selected');
    state.selectedTube = tubeIdx;

    if (!state.unknownKey) {
      toast('Select an unknown sample first.', 'warn');
      return;
    }

    if (!state.selectedBottle) {
      toast('Select a reagent bottle first, then click a test tube.', 'info');
      return;
    }

    const bottle = state.selectedBottle;

    // TRANSFER unknown sample
    if (bottle === 'Unknown') {
      if (!state.unknownData) {
        toast('Confirm an unknown sample first.', 'warn');
        return;
      }
      transferSample(tubeIdx);
      return;
    }

    // ADD REAGENT — need sample in tube
    if (!state.tubeContents[tubeIdx].hasSample) {
      toast('Transfer sample to this tube first.', 'warn');
      return;
    }

    // Show popup asking few drops or excess
    showReagentPopup(tubeIdx, bottle);
  }


  // ══════════════════════════════════════
  // REAGENT BOTTLES
  // ══════════════════════════════════════

  function buildReagentBottles() {
    dom.reagentShelf.innerHTML = '';

    // Unknown sample bottle
    const unknownSlot = createBottle('Unknown', state.unknownKey || 'Sample', '', state.unknownData?.solutionColor || 'rgba(200,220,255,0.3)');
    dom.reagentShelf.appendChild(unknownSlot);

    // Reagent bottles
    REAGENTS.forEach(r => {
      const slot = createBottle(r.key, r.label, r.sub, r.color);
      dom.reagentShelf.appendChild(slot);
    });
  }

  function createBottle(key, label, sub, liquidColor) {
    const slot = document.createElement('div');
    slot.className = 'reagent-slot';

    const bottle = document.createElement('div');
    bottle.className = 'reagent-bottle';
    bottle.dataset.bottle = key;

    // Dropper top: rubber bulb + glass stem
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
    if (!state.unknownKey && key !== 'Unknown') {
      toast('Select an unknown sample first.', 'warn');
      return;
    }

    // Toggle — clicking same bottle deselects
    if (state.selectedBottle === key) {
      deselectBottle();
      return;
    }

    document.querySelectorAll('.reagent-bottle').forEach(b => b.classList.remove('selected'));
    state.selectedBottle = key;
    const bottle = document.querySelector(`[data-bottle="${key}"]`);
    if (bottle) bottle.classList.add('selected');

    // If a tube is already selected, auto-trigger
    if (state.selectedTube) {
      handleTubeClick(state.selectedTube);
    }
  }

  function deselectBottle() {
    document.querySelectorAll('.reagent-bottle').forEach(b => b.classList.remove('selected'));
    state.selectedBottle = null;
  }


  // ══════════════════════════════════════
  // REAGENT POPUP (few drops / excess)
  // ══════════════════════════════════════

  function showReagentPopup(tubeIdx, reagentKey) {
    // Remove any existing popup
    closeReagentPopup();

    const tube = document.querySelector(`.test-tube[data-tube="${tubeIdx}"]`);
    const tubeRect = tube.getBoundingClientRect();
    const wbRect = dom.workbench.getBoundingClientRect();

    const popup = document.createElement('div');
    popup.className = 'reagent-popup';
    popup.id = 'reagent-popup';

    const reagentName = data.reagentNames[reagentKey] || reagentKey;
    const title = document.createElement('div');
    title.className = 'popup-title';
    title.textContent = `Add ${reagentName} to TT${tubeIdx}`;
    popup.appendChild(title);

    // "Add a few drops" button
    const btnFew = document.createElement('button');
    btnFew.className = 'btn btn-primary btn-sm w-full';
    btnFew.textContent = 'Add a few drops';
    btnFew.addEventListener('click', () => {
      applyReagent(tubeIdx, reagentKey, 'few');
      closeReagentPopup();
    });
    popup.appendChild(btnFew);

    // "Add excess" button — for NaOH and NH3 only
    if (reagentKey === 'NaOH' || reagentKey === 'NH3') {
      const btnExcess = document.createElement('button');
      btnExcess.className = 'btn btn-ghost btn-sm w-full';
      btnExcess.textContent = 'Add excess';
      btnExcess.style.marginTop = '4px';
      btnExcess.addEventListener('click', () => {
        applyReagent(tubeIdx, reagentKey, 'excess');
        closeReagentPopup();
      });
      popup.appendChild(btnExcess);
    }

    // Cancel
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-ghost btn-sm w-full';
    btnCancel.textContent = 'Cancel';
    btnCancel.style.marginTop = '4px';
    btnCancel.style.opacity = '0.6';
    btnCancel.addEventListener('click', closeReagentPopup);
    popup.appendChild(btnCancel);

    // Position above tube
    popup.style.left = (tubeRect.left - wbRect.left + tubeRect.width / 2 - 75) + 'px';
    popup.style.top = (tubeRect.top - wbRect.top - 130) + 'px';

    dom.workbench.appendChild(popup);
  }

  function closeReagentPopup() {
    const existing = document.getElementById('reagent-popup');
    if (existing) existing.remove();
  }


  // ══════════════════════════════════════
  // CHEMISTRY ENGINE
  // ══════════════════════════════════════

  function transferSample(tubeIdx) {
    const tc = state.tubeContents[tubeIdx];
    if (tc.hasSample && tc.reagents.length === 0) {
      toast('This tube already has sample.', 'info');
      return;
    }
    if (tc.hasSample) {
      toast('This tube already has contents. Wash it first.', 'warn');
      return;
    }

    tc.hasSample = true;
    tc.reagents = [];

    const liquid = document.getElementById(`tube-liquid-${tubeIdx}`);
    const label = document.getElementById(`tube-label-${tubeIdx}`);
    liquid.style.height = '30%';
    liquid.style.background = state.unknownData.solutionColor;
    if (label) label.textContent = state.unknownKey;

    // Flash animation
    flashTube(tubeIdx);

    addObservation(`TT${tubeIdx}`,
      `About 1 cm³ of ${state.unknownKey} transferred to TT${tubeIdx}.`,
      state.unknownData.colorName === 'colourless'
        ? 'Colourless solution.'
        : `${state.unknownData.colorName.charAt(0).toUpperCase() + state.unknownData.colorName.slice(1)} solution.`
    );
  }

  function applyReagent(tubeIdx, reagentKey, amount) {
    const tc = state.tubeContents[tubeIdx];
    tc.reagents.push({ key: reagentKey, amount });

    const cation = state.unknownData.cation;
    const anion = state.unknownData.anion;
    const reagentDisplay = data.reagentNames[reagentKey] || reagentKey;

    let procedure = amount === 'few'
      ? `1–2 drops of ${reagentDisplay} added to TT${tubeIdx}.`
      : `Excess ${reagentDisplay} added to TT${tubeIdx}.`;

    let result = null;

    // ── Cation tests (NaOH / NH3) ──
    if (reagentKey === 'NaOH' || reagentKey === 'NH3') {
      const testKey = `${reagentKey}_${amount}`;
      const cationData = data.cationTests[cation];
      if (cationData && cationData[testKey]) {
        result = cationData[testKey];
      }
      markProcedure('cation');
    }

    // ── Anion tests (AgNO3 / BaCl2) ──
    if (reagentKey === 'AgNO3' || reagentKey === 'BaCl2') {
      const hasHNO3 = tc.reagents.some(r => r.key === 'HNO3');
      if (hasHNO3) {
        const anionData = data.anionTests[anion];
        if (anionData && anionData[reagentKey]) {
          result = anionData[reagentKey];
        }
        markProcedure('anion');
      } else {
        result = { observation: 'No HNO₃ added first. Acidify the solution with dilute HNO₃ before testing for anions.' };
        toast('Acidify with HNO₃ first!', 'warn');
      }
    }

    // ── HNO3 (acidification) ──
    if (reagentKey === 'HNO3') {
      result = { observation: 'Solution acidified with dilute HNO₃(aq). Ready for anion testing.' };
      markProcedure('anion');
    }

    // ── Update visuals ──
    const liquid = document.getElementById(`tube-liquid-${tubeIdx}`);
    const ppt = document.getElementById(`tube-ppt-${tubeIdx}`);

    if (result) {
      if (result.ppt) {
        ppt.style.opacity = '1';
        ppt.style.height = '16px';
        ppt.style.background = result.pptColor || '#f0f2f5';
      } else {
        ppt.style.opacity = '0';
        ppt.style.height = '0';
      }
      if (result.solutionColor) {
        liquid.style.background = result.solutionColor;
      }
      if (amount === 'excess') {
        liquid.style.height = '65%';
      } else {
        const currentH = parseInt(liquid.style.height) || 30;
        liquid.style.height = Math.min(currentH + 12, 60) + '%';
      }
      addObservation(`TT${tubeIdx}`, procedure, result.observation || 'No visible change.');
    } else {
      const currentH = parseInt(liquid.style.height) || 30;
      liquid.style.height = Math.min(currentH + 8, 55) + '%';
      addObservation(`TT${tubeIdx}`, procedure, 'No visible change.');
    }

    flashTube(tubeIdx);

    // Update tube label
    const label = document.getElementById(`tube-label-${tubeIdx}`);
    if (label) {
      const reagentCodes = tc.reagents.map(r => r.key === 'NaOH' ? 'NaOH' : r.key === 'NH3' ? 'NH₃' : r.key === 'HNO3' ? 'HNO₃' : r.key === 'AgNO3' ? 'Ag⁺' : r.key === 'BaCl2' ? 'Ba²⁺' : '');
      label.textContent = `${state.unknownKey}+${reagentCodes.join('+')}`;
    }
  }

  function flashTube(tubeIdx) {
    const tube = document.querySelector(`.test-tube[data-tube="${tubeIdx}"]`);
    if (!tube) return;
    tube.classList.add('flash');
    setTimeout(() => tube.classList.remove('flash'), 500);
  }


  // ══════════════════════════════════════
  // FLAME TEST
  // ══════════════════════════════════════

  dom.bunsen.addEventListener('click', () => {
    if (!state.unknownKey) {
      toast('Select an unknown sample first.', 'warn');
      return;
    }
    performFlameTest();
  });

  function performFlameTest() {
    const cation = state.unknownData.cation;
    const cationData = data.cationTests[cation];
    const flameData = cationData?.flame;

    dom.bunsenFlame.classList.add('lit');
    markProcedure('flame');

    if (flameData) {
      dom.flameVisual.style.background = `radial-gradient(ellipse, ${flameData.flameColor} 0%, ${flameData.flameColor}88 40%, transparent 70%)`;
      dom.flameText.textContent = flameData.observation;
      addObservation('Flame', `Nichrome wire dipped in ${state.unknownKey}, held in Bunsen flame.`, flameData.observation);
    } else {
      dom.flameVisual.style.background = 'radial-gradient(ellipse, #3b82f6 0%, #60a5fa 40%, transparent 70%)';
      dom.flameText.textContent = 'No distinctive flame colour observed (normal blue flame).';
      addObservation('Flame', `Nichrome wire dipped in ${state.unknownKey}, held in Bunsen flame.`, 'No distinctive flame colour observed.');
    }

    dom.flameOverlay.style.display = '';
  }

  dom.btnCloseFlame.addEventListener('click', () => {
    dom.flameOverlay.style.display = 'none';
    dom.bunsenFlame.classList.remove('lit');
  });


  // ══════════════════════════════════════
  // OBSERVATIONS TABLE
  // ══════════════════════════════════════

  function addObservation(tube, procedure, observation) {
    state.observations.push({ tube, procedure, observation });
    dom.obsEmpty.style.display = 'none';

    const isIndependent = typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided();

    const row = document.createElement('tr');
    row.className = 'animate-fade-in';

    if (isIndependent) {
      // Independent mode: student records observation manually
      const tdTube = document.createElement('td');
      tdTube.textContent = tube;
      const tdProc = document.createElement('td');
      tdProc.textContent = procedure;
      const tdObs = document.createElement('td');
      const obsInput = document.createElement('input');
      obsInput.type = 'text';
      obsInput.className = 'reading-input';
      obsInput.placeholder = 'Type your observation...';
      obsInput.style.cssText = 'width:100%;font-size:var(--text-xs);border:1px dashed var(--color-border);padding:4px;border-radius:4px;background:var(--color-surface);color:var(--color-text);';
      obsInput.dataset.answer = observation;
      obsInput.title = 'Record what you observe';
      // Reveal correct answer on blur if student typed something
      obsInput.addEventListener('blur', function () {
        if (this.value.trim().length > 0 && !this.dataset.revealed) {
          this.dataset.revealed = 'true';
          const feedback = document.createElement('div');
          feedback.style.cssText = 'font-size:9px;color:var(--color-text-muted);margin-top:2px;';
          feedback.textContent = 'Expected: ' + observation;
          tdObs.appendChild(feedback);
        }
      });
      tdObs.appendChild(obsInput);
      row.appendChild(tdTube);
      row.appendChild(tdProc);
      row.appendChild(tdObs);
    } else {
      row.innerHTML = `
        <td>${tube}</td>
        <td>${procedure}</td>
        <td>${observation}</td>
      `;
    }

    dom.obsTbody.appendChild(row);

    const scrollContainer = dom.obsTbody.closest('.qa-obs-scroll');
    if (scrollContainer) {
      setTimeout(() => { scrollContainer.scrollTop = scrollContainer.scrollHeight; }, 50);
    }
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
    // Mark next undone step as active
    const steps = ['observe', 'cation', 'anion', 'flame', 'conclude'];
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
    if (!state.unknownKey) return;
    for (let i = 1; i <= NUM_TUBES; i++) {
      const liquid = document.getElementById(`tube-liquid-${i}`);
      const ppt = document.getElementById(`tube-ppt-${i}`);
      const label = document.getElementById(`tube-label-${i}`);
      if (liquid) { liquid.style.height = '0'; liquid.style.background = 'transparent'; }
      if (ppt) { ppt.style.opacity = '0'; ppt.style.height = '0'; }
      if (label) label.textContent = `${i}`;
      state.tubeContents[i] = { hasSample: false, reagents: [] };
    }
    document.querySelectorAll('.test-tube').forEach(t => t.classList.remove('selected'));
    state.selectedTube = null;
    addObservation('All', 'All test tubes washed and dried.', '—');
    toast('All test tubes washed.', 'info');
  }


  // ══════════════════════════════════════
  // IDENTIFICATION CHECK
  // ══════════════════════════════════════

  dom.btnCheckId.addEventListener('click', () => {
    if (!state.unknownKey) return;
    checkIdentification();
  });

  function checkIdentification() {
    const cationInput = dom.idCation.value.trim();
    const anionInput = dom.idAnion.value.trim();
    if (!cationInput && !anionInput) {
      toast('Enter your cation and anion identification.', 'warn');
      return;
    }

    const actualCation = state.unknownData.cation;
    const actualAnion = state.unknownData.anion;

    const cationCorrect = matchIon(cationInput, actualCation);
    const anionCorrect = matchIon(anionInput, actualAnion);

    dom.idResult.style.display = '';

    if (cationCorrect && anionCorrect) {
      dom.idResult.className = 'mt-2 id-result-correct';
      dom.idResult.innerHTML = `Correct! The unknown is <strong>${state.unknownData.formula}</strong> (${formatIon(actualCation)} + ${formatIon(actualAnion)}).`;
      markProcedure('conclude');
      toast('Correct identification!', 'success');
    } else {
      let msg = '';
      if (cationCorrect) msg += 'Cation is correct. ';
      else if (cationInput) msg += `Cation is incorrect. `;
      if (anionCorrect) msg += 'Anion is correct. ';
      else if (anionInput) msg += `Anion is incorrect. `;
      msg += 'Review your observations and try again.';
      dom.idResult.className = 'mt-2 id-result-incorrect';
      dom.idResult.textContent = msg;
    }
  }

  function matchIon(input, actual) {
    if (!input) return false;
    const normalize = s => s.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[²³⁺⁻₂₃₄]/g, c => ({ '²':'2','³':'3','⁺':'+','⁻':'-','₂':'2','₃':'3','₄':'4' }[c] || c))
      .replace(/\^(\d[+-])/g, '$1')
      .replace(/\(([^)]+)\)/g, '$1');
    const a = normalize(input);
    const b = normalize(actual);
    // Match with or without charge
    return a === b || a === b.replace(/[+-]/g, '') || a.replace(/[+-]/g, '') === b.replace(/[+-]/g, '');
  }

  function formatIon(ion) {
    return ion.replace('2+', '²⁺').replace('3+', '³⁺').replace('2-', '²⁻').replace('-', '⁻')
      .replace('42-', '₄²⁻').replace('SO42-', 'SO₄²⁻');
  }


  // ══════════════════════════════════════
  // TOAST NOTIFICATIONS
  // ══════════════════════════════════════

  function toast(message, type) {
    if (!dom.toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type || 'info'}`;
    el.textContent = message;
    dom.toastContainer.appendChild(el);

    // Trigger animation
    requestAnimationFrame(() => el.classList.add('visible'));

    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 300);
    }, 3000);

    // Audio feedback
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    Object.assign(state, {
      unknownKey: null,
      unknownData: null,
      selectedBottle: null,
      selectedTube: null,
      tubeContents: {},
      observations: [],
      procedureDone: { observe: false, cation: false, anion: false, flame: false, conclude: false },
    });

    dom.unknownChooser.style.display = '';
    dom.unknownInfo.style.display = 'none';
    dom.unknownSelect.value = '';
    dom.confirmBtn.disabled = true;

    for (let i = 1; i <= NUM_TUBES; i++) {
      state.tubeContents[i] = { hasSample: false, reagents: [] };
      const liquid = document.getElementById(`tube-liquid-${i}`);
      const ppt = document.getElementById(`tube-ppt-${i}`);
      const label = document.getElementById(`tube-label-${i}`);
      if (liquid) { liquid.style.height = '0'; liquid.style.background = 'transparent'; }
      if (ppt) { ppt.style.opacity = '0'; ppt.style.height = '0'; }
      if (label) label.textContent = `${i}`;
    }

    document.querySelectorAll('.test-tube').forEach(t => t.classList.remove('selected'));
    document.querySelectorAll('.reagent-bottle').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.procedure-step').forEach(el => {
      el.classList.remove('done', 'active');
    });

    closeReagentPopup();
    dom.obsTbody.innerHTML = '';
    dom.obsEmpty.style.display = '';
    dom.washBar.style.display = 'none';
    dom.flameOverlay.style.display = 'none';
    dom.bunsenFlame.classList.remove('lit');
    dom.idCation.value = '';
    dom.idAnion.value = '';
    dom.btnCheckId.disabled = true;
    dom.idResult.style.display = 'none';

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
        !e.target.closest('.bunsen-assembly') &&
        !e.target.closest('.sink-assembly')) {
      document.querySelectorAll('.test-tube').forEach(t => t.classList.remove('selected'));
      state.selectedTube = null;
      closeReagentPopup();
      // Don't deselect bottle — it should stay selected for multi-tube use
    }
  });
});
