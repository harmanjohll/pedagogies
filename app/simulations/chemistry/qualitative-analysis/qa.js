/*
 * Qualitative Analysis Simulation — Logic
 * =========================================
 * Complete interactive QA sim for Co-Cher LabSim.
 */

document.addEventListener('DOMContentLoaded', function () {

  /* ═══════════ References ═══════════ */

  var DATA = CHEMISTRY_DATA;

  var unknownSelect     = document.getElementById('unknownSelect');
  var btnConfirmUnknown = document.getElementById('btnConfirmUnknown');
  var unknownBadge      = document.getElementById('unknownBadge');
  var badgeSwatch       = document.getElementById('badgeSwatch');
  var badgeLabel        = document.getElementById('badgeLabel');
  var procedureList     = document.getElementById('procedureList');
  var tubesContainer    = document.getElementById('tubesContainer');
  var bottlesContainer  = document.getElementById('bottlesContainer');
  var bunsenBurner      = document.getElementById('bunsenBurner');
  var sink              = document.getElementById('sink');
  var washBar           = document.getElementById('washBar');
  var btnWash           = document.getElementById('btnWash');
  var observationsBody  = document.getElementById('observationsBody');
  var observationsEmpty = document.getElementById('observationsEmpty');
  var cationInput       = document.getElementById('cationInput');
  var anionInput        = document.getElementById('anionInput');
  var btnCheckId        = document.getElementById('btnCheckId');
  var idResult          = document.getElementById('idResult');
  var amountPopup       = document.getElementById('amountPopup');
  var amountPopupTitle  = document.getElementById('amountPopupTitle');
  var amountPopupSub    = document.getElementById('amountPopupSub');
  var amountCancel      = document.getElementById('amountCancel');
  var flameOverlay      = document.getElementById('flameOverlay');
  var flameVisual       = document.getElementById('flameVisual');
  var flameObservation  = document.getElementById('flameObservation');
  var flameDismiss      = document.getElementById('flameDismiss');
  var btnGuideToggle    = document.getElementById('btnGuideToggle');
  var btnResetAll       = document.getElementById('btnResetAll');
  var guidePanel        = document.getElementById('guidePanel');
  var toastContainer    = document.getElementById('toastContainer');

  /* ═══════════ State ═══════════ */

  var NUM_TUBES = 5;

  var state = {
    selectedUnknown: null,       // key in DATA.unknowns e.g. 'FB6'
    unknownData: null,           // the data object for the selected unknown
    tubes: [],                   // array of tube state objects
    selectedTubeIndex: null,     // currently selected tube (0-4) or null
    selectedReagent: null,       // currently selected reagent key or null
    pendingReagent: null,        // reagent key pending amount choice
    pendingAmount: null,         // 'few' or 'excess' waiting for tube click
    proceduresDone: new Set(),   // set of step keys: 'observe','cation','anion','flame','conclude'
    observationCount: 0
  };

  /* ═══════════ Initialisation ═══════════ */

  function init() {
    populateUnknownDropdown();
    generateTubes();
    generateBottles();
    bindEvents();
    updateProcedureUI();
    updateWashBar();
  }

  function populateUnknownDropdown() {
    var keys = Object.keys(DATA.unknowns);
    keys.forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key + ' — Unknown solution';
      unknownSelect.appendChild(opt);
    });
  }

  /* ═══════════ Tube Generation ═══════════ */

  function initTubeState() {
    return {
      hasSample: false,
      reagents: [],        // list of {reagent, amount} objects
      liquidColor: 'transparent',
      pptColor: null,
      pptHeight: 0,
      liquidHeight: 0,
      hasHNO3: false
    };
  }

  function generateTubes() {
    tubesContainer.innerHTML = '';
    state.tubes = [];

    for (var i = 0; i < NUM_TUBES; i++) {
      state.tubes.push(initTubeState());

      var tube = document.createElement('div');
      tube.className = 'qa-tube';
      tube.dataset.index = i;

      var num = document.createElement('span');
      num.className = 'qa-tube-num';
      num.textContent = i + 1;

      var glass = document.createElement('div');
      glass.className = 'qa-tube-glass';

      var liquid = document.createElement('div');
      liquid.className = 'qa-tube-liquid';

      var ppt = document.createElement('div');
      ppt.className = 'qa-tube-precipitate';

      glass.appendChild(liquid);
      glass.appendChild(ppt);
      tube.appendChild(num);
      tube.appendChild(glass);
      tubesContainer.appendChild(tube);
    }
  }

  /* ═══════════ Bottle Generation ═══════════ */

  var REAGENT_LIST = [
    { key: 'sample', label: 'Unknown', caption: 'Sample', fillColor: null },
    { key: 'NaOH',  label: 'NaOH',    caption: 'NaOH(aq)',         fillColor: 'rgba(180,200,240,0.35)' },
    { key: 'NH3',   label: 'NH\u2083', caption: 'NH\u2083(aq)',     fillColor: 'rgba(180,200,240,0.35)' },
    { key: 'HNO3',  label: 'HNO\u2083',caption: 'dil. HNO\u2083',  fillColor: 'rgba(240,200,180,0.35)' },
    { key: 'AgNO3', label: 'AgNO\u2083',caption: 'AgNO\u2083(aq)',  fillColor: 'rgba(200,200,210,0.4)' },
    { key: 'BaCl2', label: 'BaCl\u2082',caption: 'BaCl\u2082(aq)',  fillColor: 'rgba(200,200,210,0.4)' }
  ];

  function generateBottles() {
    bottlesContainer.innerHTML = '';

    REAGENT_LIST.forEach(function (r) {
      var bottle = document.createElement('div');
      bottle.className = 'qa-bottle';
      bottle.dataset.reagent = r.key;
      bottle.title = r.caption;

      // Dropper top
      var dropper = document.createElement('div');
      dropper.className = 'qa-bottle-dropper';
      var bulb = document.createElement('div');
      bulb.className = 'qa-dropper-bulb';
      var stem = document.createElement('div');
      stem.className = 'qa-dropper-stem';
      dropper.appendChild(bulb);
      dropper.appendChild(stem);

      // Body
      var body = document.createElement('div');
      body.className = 'qa-bottle-body';

      var fill = document.createElement('div');
      fill.className = 'qa-bottle-fill';
      var fillColor = r.fillColor;
      if (r.key === 'sample' && state.unknownData) {
        fillColor = state.unknownData.solutionColor;
      } else if (r.key === 'sample') {
        fillColor = 'rgba(180,200,240,0.2)';
      }
      fill.style.background = fillColor;
      body.appendChild(fill);

      var label = document.createElement('div');
      label.className = 'qa-bottle-label';
      label.textContent = r.label;
      body.appendChild(label);

      // Caption
      var caption = document.createElement('div');
      caption.className = 'qa-bottle-caption';
      caption.textContent = r.caption;

      bottle.appendChild(dropper);
      bottle.appendChild(body);
      bottle.appendChild(caption);
      bottlesContainer.appendChild(bottle);
    });
  }

  /* ═══════════ Event Binding ═══════════ */

  function bindEvents() {
    // Unknown selection
    unknownSelect.addEventListener('change', function () {
      btnConfirmUnknown.disabled = !unknownSelect.value;
    });

    btnConfirmUnknown.addEventListener('click', confirmUnknown);

    // Bottles
    bottlesContainer.addEventListener('click', function (e) {
      var bottle = e.target.closest('.qa-bottle');
      if (!bottle) return;
      handleBottleClick(bottle.dataset.reagent);
    });

    // Tubes
    tubesContainer.addEventListener('click', function (e) {
      var tube = e.target.closest('.qa-tube');
      if (!tube) return;
      handleTubeClick(parseInt(tube.dataset.index, 10));
    });

    // Bunsen
    bunsenBurner.addEventListener('click', handleBunsenClick);

    // Sink
    sink.addEventListener('click', washAllTubes);
    btnWash.addEventListener('click', washAllTubes);

    // Amount popup
    amountPopup.querySelectorAll('.qa-amount-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleAmountChoice(btn.dataset.amount);
      });
    });
    amountCancel.addEventListener('click', cancelAmountPopup);

    // Flame dismiss
    flameDismiss.addEventListener('click', function () {
      flameOverlay.classList.remove('visible');
    });

    // Identification check
    btnCheckId.addEventListener('click', checkIdentification);
    cationInput.addEventListener('input', toggleCheckBtn);
    anionInput.addEventListener('input', toggleCheckBtn);

    // Guide toggle
    btnGuideToggle.addEventListener('click', function () {
      guidePanel.classList.toggle('collapsed');
    });

    // Reset all
    btnResetAll.addEventListener('click', resetAll);
  }

  /* ═══════════ Unknown Selection ═══════════ */

  function confirmUnknown() {
    var key = unknownSelect.value;
    if (!key || !DATA.unknowns[key]) return;

    state.selectedUnknown = key;
    state.unknownData = DATA.unknowns[key];

    // Update badge
    unknownBadge.classList.add('visible');
    badgeSwatch.style.background = state.unknownData.solutionColor;
    badgeLabel.textContent = key + ' — ' + state.unknownData.colorName + ' solution';

    // Disable further changes
    unknownSelect.disabled = true;
    btnConfirmUnknown.disabled = true;

    // Update sample bottle fill
    var sampleBottle = bottlesContainer.querySelector('[data-reagent="sample"]');
    if (sampleBottle) {
      var fill = sampleBottle.querySelector('.qa-bottle-fill');
      if (fill) fill.style.background = state.unknownData.solutionColor;
    }

    toast('Unknown ' + key + ' selected (' + state.unknownData.colorName + ' solution)', 'info');
  }

  /* ═══════════ Bottle Click ═══════════ */

  function handleBottleClick(reagentKey) {
    if (!state.selectedUnknown) {
      toast('Select and confirm an unknown sample first.', 'warning');
      return;
    }

    // Deselect all bottles
    bottlesContainer.querySelectorAll('.qa-bottle').forEach(function (b) {
      b.classList.remove('selected');
    });

    if (reagentKey === 'sample') {
      // Directly transfer sample to a tube: enter "awaiting tube click" mode
      state.selectedReagent = 'sample';
      state.pendingReagent = null;
      state.pendingAmount = null;
      var bottle = bottlesContainer.querySelector('[data-reagent="sample"]');
      if (bottle) bottle.classList.add('selected');
      toast('Click a test tube to transfer the sample.', 'info');
      return;
    }

    // For reagents that need amount choice
    state.selectedReagent = null;
    state.pendingReagent = reagentKey;

    var bottle = bottlesContainer.querySelector('[data-reagent="' + reagentKey + '"]');
    if (bottle) bottle.classList.add('selected');

    // HNO3 doesn't need amount choice — it's added to acidify
    if (reagentKey === 'HNO3') {
      state.selectedReagent = 'HNO3';
      state.pendingReagent = null;
      state.pendingAmount = null;
      toast('Click a tube with sample to add dilute HNO\u2083.', 'info');
      return;
    }

    // Show amount popup for NaOH, NH3, AgNO3, BaCl2
    showAmountPopup(reagentKey);
  }

  /* ═══════════ Amount Popup ═══════════ */

  function showAmountPopup(reagentKey) {
    var name = DATA.reagentNames[reagentKey] || reagentKey;
    amountPopupTitle.textContent = 'Add ' + name;
    amountPopupSub.textContent = 'How much do you want to add?';
    amountPopup.classList.add('visible');
  }

  function handleAmountChoice(amount) {
    amountPopup.classList.remove('visible');
    if (!state.pendingReagent) return;

    state.selectedReagent = state.pendingReagent;
    state.pendingAmount = amount;
    state.pendingReagent = null;

    var name = DATA.reagentNames[state.selectedReagent] || state.selectedReagent;
    var desc = amount === 'few' ? 'a few drops' : 'excess';
    toast('Now click a tube with sample to add ' + desc + ' of ' + name + '.', 'info');
  }

  function cancelAmountPopup() {
    amountPopup.classList.remove('visible');
    state.pendingReagent = null;
    state.selectedReagent = null;
    state.pendingAmount = null;
    deselectAllBottles();
  }

  function deselectAllBottles() {
    bottlesContainer.querySelectorAll('.qa-bottle').forEach(function (b) {
      b.classList.remove('selected');
    });
  }

  /* ═══════════ Tube Click ═══════════ */

  function handleTubeClick(index) {
    var tubeState = state.tubes[index];
    var tubeEl = tubesContainer.querySelectorAll('.qa-tube')[index];

    // If we have a sample selected for transfer
    if (state.selectedReagent === 'sample') {
      if (tubeState.hasSample) {
        toast('This tube already has a sample.', 'warning');
        return;
      }
      transferSample(index);
      state.selectedReagent = null;
      deselectAllBottles();
      return;
    }

    // If we have HNO3 selected
    if (state.selectedReagent === 'HNO3') {
      if (!tubeState.hasSample) {
        toast('This tube has no sample. Add sample first.', 'warning');
        return;
      }
      addHNO3(index);
      state.selectedReagent = null;
      deselectAllBottles();
      return;
    }

    // If we have a reagent + amount ready
    if (state.selectedReagent && state.pendingAmount) {
      if (!tubeState.hasSample) {
        toast('This tube has no sample. Add sample first.', 'warning');
        return;
      }
      applyReagent(index, state.selectedReagent, state.pendingAmount);
      state.selectedReagent = null;
      state.pendingAmount = null;
      deselectAllBottles();
      return;
    }

    // Otherwise just select/deselect the tube (for flame test)
    deselectAllTubes();
    if (state.selectedTubeIndex === index) {
      state.selectedTubeIndex = null;
    } else {
      state.selectedTubeIndex = index;
      tubeEl.classList.add('selected');
    }
  }

  function deselectAllTubes() {
    state.selectedTubeIndex = null;
    tubesContainer.querySelectorAll('.qa-tube').forEach(function (t) {
      t.classList.remove('selected');
    });
  }

  /* ═══════════ Transfer Sample ═══════════ */

  function transferSample(index) {
    var tubeState = state.tubes[index];
    tubeState.hasSample = true;
    tubeState.liquidColor = state.unknownData.solutionColor;
    tubeState.liquidHeight = 55;

    updateTubeVisual(index);
    flashTube(index);

    addObservation(index + 1, 'Observe', state.unknownData.colorName.charAt(0).toUpperCase() + state.unknownData.colorName.slice(1) + ' solution observed.');
    markProcedureDone('observe');
  }

  /* ═══════════ Add HNO3 ═══════════ */

  function addHNO3(index) {
    var tubeState = state.tubes[index];
    tubeState.hasHNO3 = true;
    tubeState.reagents.push({ reagent: 'HNO3', amount: 'few' });

    // HNO3 dissolves any precipitate from cation tests (acidify for anion test)
    tubeState.pptColor = null;
    tubeState.pptHeight = 0;

    // If the solution had changed colour from cation test, adding acid returns to original
    tubeState.liquidColor = state.unknownData.solutionColor;
    tubeState.liquidHeight = Math.min(tubeState.liquidHeight + 8, 85);

    updateTubeVisual(index);
    flashTube(index);

    addObservation(index + 1, '+ dil. HNO\u2083', 'Acidified with dilute HNO\u2083(aq). Any precipitate dissolved.');
    toast('Tube ' + (index + 1) + ' acidified with dil. HNO\u2083.', 'info');
  }

  /* ═══════════ Apply Reagent ═══════════ */

  function applyReagent(index, reagentKey, amount) {
    var tubeState = state.tubes[index];
    var cation = state.unknownData.cation;
    var anion = state.unknownData.anion;

    // Build lookup key
    var lookupKey = reagentKey + '_' + amount;
    var result = null;
    var procedureCategory = null;
    var reagentDisplayName = DATA.reagentNames[reagentKey] || reagentKey;
    var amountLabel = amount === 'few' ? 'few drops' : 'excess';

    // Check if this is a cation test reagent
    if (reagentKey === 'NaOH' || reagentKey === 'NH3') {
      procedureCategory = 'cation';
      var cationData = DATA.cationTests[cation];
      if (cationData) {
        result = cationData[lookupKey];
      }
    }

    // Check if this is an anion test reagent
    if (reagentKey === 'AgNO3' || reagentKey === 'BaCl2') {
      procedureCategory = 'anion';

      // Must have HNO3 first
      if (!tubeState.hasHNO3) {
        toast('Acidify the solution with dil. HNO\u2083 first before adding ' + reagentDisplayName + '.', 'warning');
        return;
      }

      var anionData = DATA.anionTests[anion];
      if (anionData) {
        result = anionData[reagentKey];
      }
    }

    if (!result) {
      toast('No reaction data found.', 'warning');
      return;
    }

    // Record reagent usage
    tubeState.reagents.push({ reagent: reagentKey, amount: amount });

    // Update tube state based on result
    tubeState.liquidHeight = Math.min(tubeState.liquidHeight + 10, 85);

    if (result.solutionColor) {
      tubeState.liquidColor = result.solutionColor;
    }

    if (result.ppt) {
      tubeState.pptColor = result.pptColor;
      tubeState.pptHeight = Math.min((tubeState.pptHeight || 0) + 15, 30);
    } else {
      // Precipitate dissolves (for excess reagent cases)
      if (amount === 'excess') {
        tubeState.pptColor = null;
        tubeState.pptHeight = 0;
      }
    }

    updateTubeVisual(index);
    flashTube(index);

    // Build observation description
    var obsDesc = amountLabel + ' ' + reagentDisplayName;
    addObservation(index + 1, '+ ' + obsDesc, result.observation);

    // Mark procedure done
    if (procedureCategory) {
      markProcedureDone(procedureCategory);
    }

    updateWashBar();
  }

  /* ═══════════ Bunsen / Flame Test ═══════════ */

  function handleBunsenClick() {
    if (!state.selectedUnknown) {
      toast('Select an unknown sample first.', 'warning');
      return;
    }

    if (state.selectedTubeIndex === null) {
      toast('Select a test tube with sample first, then click the burner.', 'info');
      return;
    }

    var tubeState = state.tubes[state.selectedTubeIndex];
    if (!tubeState.hasSample) {
      toast('Selected tube has no sample.', 'warning');
      return;
    }

    var cation = state.unknownData.cation;
    var flameData = DATA.cationTests[cation] ? DATA.cationTests[cation].flame : null;

    // Light the burner briefly
    bunsenBurner.classList.add('lit');
    setTimeout(function () {
      bunsenBurner.classList.remove('lit');
    }, 2000);

    if (!flameData) {
      // No characteristic flame
      addObservation(state.selectedTubeIndex + 1, 'Flame test', 'No characteristic flame colour observed.');
      toast('No characteristic flame colour for ' + cation + '.', 'info');
      markProcedureDone('flame');
      deselectAllTubes();
      return;
    }

    // Show flame overlay
    flameVisual.style.background = 'radial-gradient(ellipse at 50% 80%, ' +
      flameData.flameColor + ' 0%, ' +
      flameData.flameColor + '88 40%, transparent 70%)';
    flameObservation.textContent = flameData.observation;
    flameOverlay.classList.add('visible');

    addObservation(state.selectedTubeIndex + 1, 'Flame test', flameData.observation);
    markProcedureDone('flame');
    deselectAllTubes();
  }

  /* ═══════════ Tube Visual Update ═══════════ */

  function updateTubeVisual(index) {
    var tubeState = state.tubes[index];
    var tubeEl = tubesContainer.querySelectorAll('.qa-tube')[index];
    if (!tubeEl) return;

    var liquidEl = tubeEl.querySelector('.qa-tube-liquid');
    var pptEl = tubeEl.querySelector('.qa-tube-precipitate');

    // Liquid
    liquidEl.style.height = tubeState.liquidHeight + 'px';
    liquidEl.style.background = tubeState.liquidColor;

    // Precipitate
    if (tubeState.pptColor && tubeState.pptHeight > 0) {
      pptEl.style.height = tubeState.pptHeight + 'px';
      pptEl.style.background = tubeState.pptColor;
    } else {
      pptEl.style.height = '0px';
      pptEl.style.background = 'transparent';
    }
  }

  function flashTube(index) {
    var tubeEl = tubesContainer.querySelectorAll('.qa-tube')[index];
    if (!tubeEl) return;
    var glass = tubeEl.querySelector('.qa-tube-glass');
    glass.classList.remove('flash');
    // Trigger reflow
    void glass.offsetWidth;
    glass.classList.add('flash');
    setTimeout(function () {
      glass.classList.remove('flash');
    }, 600);
  }

  /* ═══════════ Observations Table ═══════════ */

  function addObservation(tubeNum, procedure, observation) {
    state.observationCount++;
    observationsEmpty.style.display = 'none';

    var tr = document.createElement('tr');

    var tdTube = document.createElement('td');
    tdTube.className = 'obs-tube';
    tdTube.textContent = tubeNum;

    var tdProc = document.createElement('td');
    tdProc.className = 'obs-procedure';
    tdProc.textContent = procedure;

    var tdResult = document.createElement('td');
    tdResult.className = 'obs-result';
    tdResult.textContent = observation;

    tr.appendChild(tdTube);
    tr.appendChild(tdProc);
    tr.appendChild(tdResult);
    observationsBody.appendChild(tr);

    // Scroll to bottom
    var wrap = document.querySelector('.qa-observations-wrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }

  /* ═══════════ Procedure Tracking ═══════════ */

  function markProcedureDone(stepKey) {
    state.proceduresDone.add(stepKey);
    updateProcedureUI();
  }

  function updateProcedureUI() {
    var steps = procedureList.querySelectorAll('li');
    var stepKeys = ['observe', 'cation', 'anion', 'flame', 'conclude'];
    var foundNextActive = false;

    steps.forEach(function (li, i) {
      var key = stepKeys[i];
      li.classList.remove('active', 'done');

      if (state.proceduresDone.has(key)) {
        li.classList.add('done');
      } else if (!foundNextActive) {
        li.classList.add('active');
        foundNextActive = true;
      }
    });

    // Enable check button when we have at least some tests done
    btnCheckId.disabled = !(state.proceduresDone.has('observe'));
  }

  /* ═══════════ Identification Check ═══════════ */

  function toggleCheckBtn() {
    var hasBoth = cationInput.value.trim().length > 0 && anionInput.value.trim().length > 0;
    btnCheckId.disabled = !(hasBoth && state.selectedUnknown);
  }

  function checkIdentification() {
    if (!state.unknownData) return;

    var userCation = normalizeIon(cationInput.value.trim());
    var userAnion = normalizeIon(anionInput.value.trim());
    var actualCation = normalizeIon(state.unknownData.cation);
    var actualAnion = normalizeIon(state.unknownData.anion);

    var cationCorrect = userCation === actualCation;
    var anionCorrect = userAnion === actualAnion;

    idResult.classList.add('visible');
    idResult.classList.remove('correct', 'incorrect');

    if (cationCorrect && anionCorrect) {
      idResult.classList.add('correct');
      idResult.innerHTML = 'Correct! The unknown is <strong>' + state.unknownData.formula + '</strong> ' +
        '(cation: ' + state.unknownData.cation + ', anion: ' + formatAnionDisplay(state.unknownData.anion) + ').';
      toast('Identification correct!', 'success');
    } else {
      var msg = 'Not quite. ';
      if (!cationCorrect) msg += 'Cation is incorrect. ';
      if (!anionCorrect) msg += 'Anion is incorrect. ';
      msg += 'Review your observations and try again.';
      idResult.classList.add('incorrect');
      idResult.textContent = msg;
      toast('Incorrect identification. Check your observations.', 'error');
    }

    markProcedureDone('conclude');
  }

  function normalizeIon(str) {
    // Remove whitespace
    str = str.replace(/\s+/g, '');
    // Replace superscript characters with plain equivalents
    str = str.replace(/\u00B2/g, '2')   // ²
             .replace(/\u00B3/g, '3')    // ³
             .replace(/\u2074/g, '4')    // ⁴
             .replace(/\u207A/g, '+')    // ⁺
             .replace(/\u207B/g, '-');   // ⁻
    // Replace subscript characters
    str = str.replace(/\u2080/g, '0')
             .replace(/\u2081/g, '1')
             .replace(/\u2082/g, '2')
             .replace(/\u2083/g, '3')
             .replace(/\u2084/g, '4');
    // Lowercase for comparison
    str = str.toLowerCase();
    return str;
  }

  function formatAnionDisplay(anion) {
    return anion.replace('SO42-', 'SO\u2084\u00B2\u207B')
                .replace('NO3-', 'NO\u2083\u207B')
                .replace('Cl-', 'Cl\u207B')
                .replace('I-', 'I\u207B');
  }

  /* ═══════════ Wash ═══════════ */

  function washAllTubes() {
    for (var i = 0; i < NUM_TUBES; i++) {
      state.tubes[i] = initTubeState();
      updateTubeVisual(i);
    }
    deselectAllTubes();
    updateWashBar();
    toast('All tubes washed and cleared.', 'info');
  }

  function updateWashBar() {
    var anyUsed = state.tubes.some(function (t) { return t.hasSample; });
    if (anyUsed) {
      washBar.classList.add('visible');
    } else {
      washBar.classList.remove('visible');
    }
  }

  /* ═══════════ Reset ═══════════ */

  function resetAll() {
    state.selectedUnknown = null;
    state.unknownData = null;
    state.selectedTubeIndex = null;
    state.selectedReagent = null;
    state.pendingReagent = null;
    state.pendingAmount = null;
    state.proceduresDone = new Set();
    state.observationCount = 0;

    // Reset unknown selection
    unknownSelect.value = '';
    unknownSelect.disabled = false;
    btnConfirmUnknown.disabled = true;
    unknownBadge.classList.remove('visible');
    badgeLabel.textContent = '\u2014';

    // Reset tubes
    generateTubes();

    // Reset bottles
    generateBottles();

    // Reset observations
    observationsBody.innerHTML = '';
    observationsEmpty.style.display = '';

    // Reset identification
    cationInput.value = '';
    anionInput.value = '';
    btnCheckId.disabled = true;
    idResult.classList.remove('visible', 'correct', 'incorrect');
    idResult.textContent = '';

    // Reset procedure
    updateProcedureUI();
    updateWashBar();

    // Close any open overlays
    amountPopup.classList.remove('visible');
    flameOverlay.classList.remove('visible');

    toast('Experiment reset.', 'info');
  }

  /* ═══════════ Toast Utility ═══════════ */

  function toast(message, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    toastContainer.appendChild(el);

    setTimeout(function () {
      el.classList.add('toast-out');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, 3000);
  }

  /* ═══════════ Start ═══════════ */

  init();

});
