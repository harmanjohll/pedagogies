/* ============================================================
   Gas Tests Practical — Chemistry Simulation
   Canvas-based gas generation, collection, and identification
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ── State ──
  var state = {
    selectedGas: null,       // key from GAS_DATA.gases e.g. 'O2'
    phase: 'idle',           // idle | selected | generating | collected | testing | done
    procedureStep: 0,        // index into GAS_DATA.procedureSteps

    // Animation state
    bubbles: [],             // [{x, y, r, speed, opacity}]
    gasLevel: 0,             // 0-1 collection level
    generating: false,
    generationProgress: 0,   // 0-1
    testAnimPhase: 0,        // 0-1 for test result animation
    testAnimActive: false,

    // Splint / tool animation
    toolVisible: false,
    toolApplied: false,

    // Per-gas completion
    completedGases: {},      // { O2: true, CO2: true, ... }

    // Results data
    results: {},             // { O2: { observation, conclusion, scored }, ... }
  };

  // ── DOM helpers ──
  var $ = function (id) { return document.getElementById(id); };
  var dom = {
    canvas:           $('main-canvas'),
    gasSelector:      $('gas-selector'),
    reactionCard:     $('reaction-card'),
    reactionEquation: $('reaction-equation'),
    reactionDesc:     $('reaction-desc'),
    reactionPlaceholder: $('reaction-placeholder'),
    procedureList:    $('procedure-list'),
    wbStatus:         $('wb-status'),
    actionStatus:     $('action-status'),
    btnAddReagent:    $('btn-add-reagent'),
    btnApplyTest:     $('btn-apply-test'),
    resultsTbody:     $('results-tbody'),
    dataEmpty:        $('data-empty'),
    analysisList:     $('analysis-list'),
    resultOverlay:    $('result-overlay'),
    resultOverlayIcon: $('result-overlay-icon'),
    resultOverlayText: $('result-overlay-text'),
    resultOverlaySub:  $('result-overlay-sub'),
    btnDismissOverlay: $('btn-dismiss-overlay'),
    completionBanner: $('completion-banner'),
    btnReset:         $('btn-reset'),
    btnToggleGuide:   $('btn-toggle-guide'),
    guidePanel:       $('guide-panel'),
    toast:            $('toast-container'),
  };

  var ctx = dom.canvas.getContext('2d');
  var animFrameId = null;

  // ── Canvas sizing ──
  function resizeCanvas() {
    var panel = dom.canvas.parentElement;
    var w = Math.min(panel.clientWidth - 32, 700);
    var h = Math.min(panel.clientHeight - 60, 480);
    dom.canvas.width = w;
    dom.canvas.height = h;
    draw();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);


  // ══════════════════════════════════════
  // INITIALISATION — Build UI
  // ══════════════════════════════════════

  function init() {
    buildGasSelector();
    buildProcedureList();
    buildResultsTable();
    buildAnalysisQuestions();
    updateProcedureHighlight();
    draw();

    // LabRecordMode integration
    if (typeof LabRecordMode !== 'undefined') {
      LabRecordMode.inject('#record-mode-slot');
    }
  }

  // ── Gas Selector Buttons ──
  function buildGasSelector() {
    dom.gasSelector.innerHTML = '';
    GAS_DATA.gasOrder.forEach(function (key) {
      var gas = GAS_DATA.gases[key];
      var btn = document.createElement('button');
      btn.className = 'gas-btn';
      btn.setAttribute('data-gas', key);
      btn.innerHTML =
        '<span class="gas-btn-check">&#10003;</span>' +
        '<span class="gas-formula">' + gas.formulaHTML + '</span> ' +
        gas.name;
      btn.addEventListener('click', function () { selectGas(key); });
      dom.gasSelector.appendChild(btn);
    });
  }

  // ── Procedure Steps ──
  function buildProcedureList() {
    dom.procedureList.innerHTML = '';
    GAS_DATA.procedureSteps.forEach(function (step, i) {
      var el = document.createElement('div');
      el.className = 'procedure-step';
      el.setAttribute('data-step', step.id);
      el.innerHTML =
        '<div class="procedure-num">' + (i + 1) + '</div>' +
        '<div class="procedure-text">' +
          '<strong>' + step.title + '</strong><br>' +
          '<span class="text-sm text-muted">' + step.instruction + '</span>' +
        '</div>';
      dom.procedureList.appendChild(el);
    });
  }

  // ── Results Table ──
  function buildResultsTable() {
    dom.resultsTbody.innerHTML = '';
    GAS_DATA.gasOrder.forEach(function (key) {
      var gas = GAS_DATA.gases[key];
      var tr = document.createElement('tr');
      tr.className = 'results-row';
      tr.setAttribute('data-gas', key);

      var isGuided = isGuidedMode();

      tr.innerHTML =
        '<td>' + gas.formulaHTML + '</td>' +
        '<td id="test-used-' + key + '">—</td>' +
        '<td>' +
          (isGuided
            ? '<span id="obs-' + key + '" class="text-muted">—</span>'
            : '<textarea id="obs-' + key + '" placeholder="Enter observation..." rows="2" disabled></textarea>') +
        '</td>' +
        '<td>' +
          (isGuided
            ? '<span id="con-' + key + '" class="text-muted">—</span>'
            : '<textarea id="con-' + key + '" placeholder="Enter conclusion..." rows="2" disabled></textarea>') +
        '</td>';
      dom.resultsTbody.appendChild(tr);
    });
  }

  // ── Analysis Questions ──
  function buildAnalysisQuestions() {
    dom.analysisList.innerHTML = '';
    GAS_DATA.analysisQuestions.forEach(function (q, i) {
      var div = document.createElement('div');
      div.className = 'analysis-q';
      div.innerHTML =
        '<div class="analysis-q-num">Q' + (i + 1) + ' (' + q.marks + ' marks)</div>' +
        '<div class="analysis-q-text">' + q.question + '</div>' +
        '<textarea id="analysis-' + q.id + '" placeholder="Type your answer..." rows="3"></textarea>' +
        '<button class="btn btn-primary btn-sm" id="btn-check-' + q.id + '">Check Answer</button>' +
        '<div class="analysis-feedback" id="feedback-' + q.id + '"></div>';
      dom.analysisList.appendChild(div);

      // Check answer handler
      document.getElementById('btn-check-' + q.id).addEventListener('click', function () {
        checkAnalysisAnswer(q);
      });
    });
  }

  function isGuidedMode() {
    if (typeof LabRecordMode !== 'undefined') {
      return LabRecordMode.isGuided();
    }
    return true; // default to guided
  }


  // ══════════════════════════════════════
  // GAS SELECTION
  // ══════════════════════════════════════

  function selectGas(key) {
    if (state.phase === 'generating' || state.phase === 'testing') return;

    state.selectedGas = key;
    state.phase = 'selected';
    state.generating = false;
    state.generationProgress = 0;
    state.gasLevel = 0;
    state.bubbles = [];
    state.testAnimPhase = 0;
    state.testAnimActive = false;
    state.toolVisible = false;
    state.toolApplied = false;
    state.procedureStep = 1; // 'setup' step

    var gas = GAS_DATA.gases[key];

    // Update selector UI
    var btns = dom.gasSelector.querySelectorAll('.gas-btn');
    btns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-gas') === key);
    });

    // Show reaction card
    dom.reactionCard.style.display = '';
    dom.reactionPlaceholder.style.display = 'none';
    dom.reactionEquation.innerHTML = gas.generation.equationHTML;
    dom.reactionDesc.textContent = gas.generation.description;

    // Update buttons
    dom.btnAddReagent.disabled = false;
    dom.btnApplyTest.disabled = true;
    dom.actionStatus.innerHTML = 'Gas: <span class="status-gas">' + gas.name + ' (' + gas.formulaHTML + ')</span> — Ready';
    dom.wbStatus.innerHTML = '<span class="gas-name">' + gas.name + '</span> — ' + gas.formulaHTML;

    updateProcedureHighlight();
    draw();
    toast('Selected ' + gas.name + '. Click "Add Reagent" to generate the gas.');
  }


  // ══════════════════════════════════════
  // GAS GENERATION (Animation)
  // ══════════════════════════════════════

  dom.btnAddReagent.addEventListener('click', function () {
    if (state.phase !== 'selected' || !state.selectedGas) return;

    state.phase = 'generating';
    state.generating = true;
    state.generationProgress = 0;
    state.gasLevel = 0;
    state.bubbles = [];
    state.procedureStep = 2; // 'generate'

    dom.btnAddReagent.disabled = true;
    dom.btnApplyTest.disabled = true;

    var gas = GAS_DATA.gases[state.selectedGas];
    dom.actionStatus.innerHTML = 'Generating <span class="status-gas">' + gas.formulaHTML + '</span>...';

    updateProcedureHighlight();
    awardMark('gen-' + state.selectedGas);
    toast('Reagent added. Gas generation in progress...');

    if (typeof LabAudio !== 'undefined') LabAudio.click();

    startAnimation();
  });


  // ══════════════════════════════════════
  // APPLY TEST
  // ══════════════════════════════════════

  dom.btnApplyTest.addEventListener('click', function () {
    if (state.phase !== 'collected' || !state.selectedGas) return;

    state.phase = 'testing';
    state.testAnimActive = true;
    state.testAnimPhase = 0;
    state.toolVisible = true;
    state.toolApplied = false;
    state.procedureStep = 4; // 'test'

    dom.btnApplyTest.disabled = true;
    dom.btnAddReagent.disabled = true;

    var gas = GAS_DATA.gases[state.selectedGas];
    dom.actionStatus.innerHTML = 'Applying: ' + gas.test.name + '...';

    updateProcedureHighlight();
    awardMark('test-' + state.selectedGas);

    if (typeof LabAudio !== 'undefined') LabAudio.click();

    startAnimation();
  });


  // ══════════════════════════════════════
  // ANIMATION LOOP
  // ══════════════════════════════════════

  var lastTime = 0;

  function startAnimation() {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    lastTime = 0;
    animFrameId = requestAnimationFrame(animLoop);
  }

  function animLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    var needsAnim = false;

    // --- Gas generation phase ---
    if (state.phase === 'generating' && state.generating) {
      state.generationProgress += dt * 0.25; // ~4 seconds to fill
      state.gasLevel = Math.min(1, state.generationProgress);

      // Spawn bubbles
      if (Math.random() < 0.3) {
        state.bubbles.push({
          x: 0.2 + Math.random() * 0.6,
          y: 1.0,
          r: 2 + Math.random() * 4,
          speed: 60 + Math.random() * 40,
          opacity: 0.5 + Math.random() * 0.4,
        });
      }

      // Update bubbles
      state.bubbles = state.bubbles.filter(function (b) {
        b.y -= (b.speed * dt) / 140;
        b.opacity -= dt * 0.3;
        return b.y > 0 && b.opacity > 0;
      });

      if (state.generationProgress >= 1) {
        state.generating = false;
        state.phase = 'collected';
        state.procedureStep = 3; // 'collect' done, ready for test
        state.bubbles = [];

        dom.btnApplyTest.disabled = false;
        var gas = GAS_DATA.gases[state.selectedGas];
        dom.actionStatus.innerHTML =
          '<span class="status-gas">' + gas.formulaHTML + '</span> collected. Click "Apply Test".';
        dom.btnApplyTest.textContent = gas.test.toolLabel;

        updateProcedureHighlight();
        toast(gas.name + ' collected! Apply the test to identify the gas.', 'success');
        if (typeof LabAudio !== 'undefined') LabAudio.success();
      }
      needsAnim = true;
    }

    // --- Test animation phase ---
    if (state.phase === 'testing' && state.testAnimActive) {
      state.testAnimPhase += dt * 0.5; // ~2 seconds

      if (state.testAnimPhase >= 0.3 && !state.toolApplied) {
        state.toolApplied = true;
      }

      if (state.testAnimPhase >= 1) {
        state.testAnimActive = false;
        state.phase = 'done';
        state.procedureStep = 5; // 'record'
        onTestComplete();
      }
      needsAnim = true;
    }

    draw();

    if (needsAnim) {
      animFrameId = requestAnimationFrame(animLoop);
    } else {
      animFrameId = null;
    }
  }


  // ══════════════════════════════════════
  // TEST COMPLETION
  // ══════════════════════════════════════

  function onTestComplete() {
    var key = state.selectedGas;
    var gas = GAS_DATA.gases[key];

    updateProcedureHighlight();

    // Show result overlay
    dom.resultOverlayIcon.textContent = getResultIcon(key);
    dom.resultOverlayText.textContent = gas.positiveResult;
    dom.resultOverlaySub.textContent = gas.positiveResultDetail;
    dom.resultOverlay.classList.add('visible');

    dom.actionStatus.innerHTML = gas.test.name + ' — <span class="status-gas">Positive!</span>';

    if (typeof LabAudio !== 'undefined') LabAudio.success();

    if (isGuidedMode()) {
      // Auto-fill results
      fillResultGuided(key);
    } else {
      // Enable text inputs for independent mode
      enableResultInputs(key);
    }

    toast(gas.positiveResult, 'success');
  }

  function getResultIcon(key) {
    switch (key) {
      case 'O2': return '\uD83D\uDD25'; // fire
      case 'CO2': return '\u2601';       // cloud
      case 'H2': return '\uD83D\uDCA5'; // collision
      case 'Cl2': return '\uD83E\uDDEA'; // test tube
      case 'NH3': return '\uD83D\uDC83'; // nose / pungent
      default: return '\u2714';
    }
  }

  // ── Guided mode: auto-fill ──
  function fillResultGuided(key) {
    var gas = GAS_DATA.gases[key];

    var testUsedEl = document.getElementById('test-used-' + key);
    var obsEl = document.getElementById('obs-' + key);
    var conEl = document.getElementById('con-' + key);

    if (testUsedEl) testUsedEl.textContent = gas.test.name;
    if (obsEl) {
      obsEl.textContent = gas.positiveResult;
      obsEl.classList.remove('text-muted');
    }
    if (conEl) {
      conEl.textContent = 'The gas is ' + gas.name.toLowerCase() + ' (' + gas.formula + ').';
      conEl.classList.remove('text-muted');
    }

    var row = document.querySelector('.results-row[data-gas="' + key + '"]');
    if (row) row.classList.add('recorded');

    state.results[key] = {
      observation: gas.positiveResult,
      conclusion: gas.name,
      scored: true,
    };

    awardMark('obs-' + key);
    awardMark('con-' + key);

    dom.dataEmpty.style.display = 'none';
    markGasCompleted(key);
  }

  // ── Independent mode: enable inputs ──
  function enableResultInputs(key) {
    var gas = GAS_DATA.gases[key];
    var testUsedEl = document.getElementById('test-used-' + key);
    if (testUsedEl) testUsedEl.textContent = gas.test.name;

    var obsEl = document.getElementById('obs-' + key);
    var conEl = document.getElementById('con-' + key);

    if (obsEl) obsEl.disabled = false;
    if (conEl) conEl.disabled = false;

    dom.dataEmpty.style.display = 'none';

    // Listen for recording
    var recordBtn = document.createElement('button');
    recordBtn.className = 'btn btn-success btn-sm';
    recordBtn.textContent = 'Record';
    recordBtn.style.marginTop = '4px';
    var cell = conEl ? conEl.parentElement : null;
    if (cell && !cell.querySelector('.btn')) {
      cell.appendChild(recordBtn);
    }
    recordBtn.addEventListener('click', function () {
      recordIndependentResult(key);
      recordBtn.remove();
    });
  }

  function recordIndependentResult(key) {
    var gas = GAS_DATA.gases[key];
    var obsEl = document.getElementById('obs-' + key);
    var conEl = document.getElementById('con-' + key);

    var obsText = (obsEl && obsEl.value) ? obsEl.value.trim() : '';
    var conText = (conEl && conEl.value) ? conEl.value.trim() : '';

    state.results[key] = {
      observation: obsText,
      conclusion: conText,
      scored: false,
    };

    // Check observation keywords
    var obsLower = obsText.toLowerCase();
    var obsMatch = gas.observationKeywords.some(function (kw) {
      return obsLower.indexOf(kw.toLowerCase()) !== -1;
    });
    if (obsMatch) {
      awardMark('obs-' + key);
      state.results[key].scored = true;
    }

    // Check conclusion keywords
    var conLower = conText.toLowerCase();
    var conMatch = gas.conclusionKeywords.some(function (kw) {
      return conLower.indexOf(kw.toLowerCase()) !== -1;
    });
    if (conMatch) {
      awardMark('con-' + key);
    }

    if (obsEl) obsEl.disabled = true;
    if (conEl) conEl.disabled = true;

    var row = document.querySelector('.results-row[data-gas="' + key + '"]');
    if (row) row.classList.add('recorded');

    markGasCompleted(key);

    if (obsMatch && conMatch) {
      toast('Correct! ' + gas.name + ' identified.', 'success');
    } else {
      toast('Result recorded. Review the expected answers.', 'warn');
    }
  }


  // ══════════════════════════════════════
  // GAS COMPLETION TRACKING
  // ══════════════════════════════════════

  function markGasCompleted(key) {
    state.completedGases[key] = true;

    // Update gas button
    var btn = dom.gasSelector.querySelector('[data-gas="' + key + '"]');
    if (btn) btn.classList.add('completed');

    // Check if all done
    var allDone = GAS_DATA.gasOrder.every(function (k) {
      return state.completedGases[k];
    });
    if (allDone) {
      dom.completionBanner.classList.add('visible');
      toast('All five gas tests completed!', 'success');
    }
  }


  // ══════════════════════════════════════
  // OVERLAY DISMISS
  // ══════════════════════════════════════

  dom.btnDismissOverlay.addEventListener('click', function () {
    dom.resultOverlay.classList.remove('visible');

    // Reset for next gas
    state.phase = 'idle';
    state.toolVisible = false;
    state.toolApplied = false;
    state.procedureStep = 0;

    dom.btnAddReagent.disabled = true;
    dom.btnApplyTest.disabled = true;
    dom.btnApplyTest.textContent = 'Apply Test';
    dom.actionStatus.innerHTML = 'Select another gas to continue.';
    dom.wbStatus.innerHTML = '';

    // Deselect current gas
    var btns = dom.gasSelector.querySelectorAll('.gas-btn');
    btns.forEach(function (btn) { btn.classList.remove('active'); });

    state.selectedGas = null;
    updateProcedureHighlight();
    draw();
  });


  // ══════════════════════════════════════
  // PROCEDURE HIGHLIGHT
  // ══════════════════════════════════════

  function updateProcedureHighlight() {
    var steps = dom.procedureList.querySelectorAll('.procedure-step');
    steps.forEach(function (el, i) {
      el.classList.remove('active', 'done');
      if (i < state.procedureStep) {
        el.classList.add('done');
      } else if (i === state.procedureStep) {
        el.classList.add('active');
      }
    });
  }


  // ══════════════════════════════════════
  // CANVAS DRAWING
  // ══════════════════════════════════════

  function draw() {
    var W = dom.canvas.width;
    var H = dom.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Layout positions
    var genTubeX = W * 0.22;
    var genTubeY = H * 0.2;
    var genTubeW = 44;
    var genTubeH = 160;

    var collectTubeX = W * 0.62;
    var collectTubeY = H * 0.25;
    var collectTubeW = 44;
    var collectTubeH = 140;

    // Bench surface
    var benchY = H * 0.82;
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(0, benchY, W, H - benchY);
    ctx.strokeStyle = '#5a504a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, benchY);
    ctx.lineTo(W, benchY);
    ctx.stroke();

    // ── Retort Stand ──
    drawRetortStand(genTubeX - 30, benchY);

    // ── Generation Test Tube ──
    drawTestTube(genTubeX, genTubeY, genTubeW, genTubeH, 'generation');

    // ── Delivery Tube ──
    drawDeliveryTube(
      genTubeX + genTubeW / 2, genTubeY,
      collectTubeX + collectTubeW / 2, collectTubeY
    );

    // ── Collection Test Tube ──
    drawTestTube(collectTubeX, collectTubeY, collectTubeW, collectTubeH, 'collection');

    // ── Test Tool ──
    if (state.toolVisible && state.selectedGas) {
      drawTestTool(collectTubeX, collectTubeY, collectTubeW);
    }

    // ── Labels ──
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Generation', genTubeX + genTubeW / 2, genTubeY + genTubeH + 28);
    ctx.fillText('Collection', collectTubeX + collectTubeW / 2, collectTubeY + collectTubeH + 28);

    // ── Idle state prompt ──
    if (state.phase === 'idle' && !state.selectedGas) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select a gas from the panel to begin', W / 2, H - 30);
    }
  }

  // ── Retort Stand ──
  function drawRetortStand(x, benchY) {
    // Base
    ctx.fillStyle = '#6b6b6b';
    ctx.fillRect(x - 20, benchY - 10, 100, 10);

    // Pole
    ctx.fillStyle = '#888';
    ctx.fillRect(x - 5, benchY - 300, 10, 290);

    // Clamp arm
    ctx.fillStyle = '#999';
    ctx.fillRect(x + 5, benchY - 250, 70, 8);

    // Clamp ring
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + 75, benchY - 246, 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Test Tube ──
  function drawTestTube(x, y, w, h, type) {
    var gas = state.selectedGas ? GAS_DATA.gases[state.selectedGas] : null;
    var roundR = w / 2;

    // Glass body
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h - roundR);
    ctx.arc(x + w / 2, y + h - roundR, roundR, Math.PI, 0, true);
    ctx.lineTo(x + w, y);
    ctx.closePath();

    // Fill glass
    ctx.fillStyle = 'rgba(200, 220, 240, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 200, 230, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    if (type === 'generation' && gas) {
      // Liquid in generation tube
      var liquidH = h * 0.4;
      var liquidY = y + h - roundR - liquidH + roundR * 0.3;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + 1, liquidY);
      ctx.lineTo(x + 1, y + h - roundR);
      ctx.arc(x + w / 2, y + h - roundR, roundR - 1, Math.PI, 0, true);
      ctx.lineTo(x + w - 1, liquidY);
      ctx.closePath();
      ctx.fillStyle = gas.generation.liquidColor;
      ctx.fill();
      ctx.restore();

      // Solid / catalyst at bottom
      var solidH = h * 0.1;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h - roundR - solidH + roundR * 0.5);
      ctx.lineTo(x + 4, y + h - roundR);
      ctx.arc(x + w / 2, y + h - roundR, roundR - 4, Math.PI, 0, true);
      ctx.lineTo(x + w - 4, y + h - roundR - solidH + roundR * 0.5);
      ctx.closePath();
      ctx.fillStyle = gas.generation.catalystColor;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Bubbles during generation
      if (state.generating) {
        state.bubbles.forEach(function (b) {
          ctx.fillStyle = 'rgba(255, 255, 255, ' + (b.opacity * 0.5) + ')';
          ctx.beginPath();
          ctx.arc(
            x + b.x * w,
            liquidY + b.y * liquidH,
            b.r,
            0, Math.PI * 2
          );
          ctx.fill();
        });
      }
    }

    if (type === 'collection' && gas) {
      // Gas filling the collection tube from top
      if (state.gasLevel > 0) {
        var gasH = (h - roundR * 0.5) * state.gasLevel;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 1);
        ctx.lineTo(x + 1, y + gasH);
        ctx.lineTo(x + w - 1, y + gasH);
        ctx.lineTo(x + w - 1, y + 1);
        ctx.closePath();
        ctx.fillStyle = gas.generation.gasColor;
        ctx.fill();
        ctx.restore();
      }

      // Limewater for CO2 test
      if (state.selectedGas === 'CO2' && state.toolApplied) {
        var lwH = h * 0.35;
        var lwY = y + h - roundR - lwH + roundR * 0.3;
        var milky = state.testAnimPhase > 0.4 ? Math.min(1, (state.testAnimPhase - 0.4) / 0.4) : 0;
        var r = Math.round(230 + milky * 10);
        var g2 = Math.round(240 - milky * 10);
        var b2 = Math.round(255 - milky * 30);
        var alpha = 0.35 + milky * 0.5;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + 1, lwY);
        ctx.lineTo(x + 1, y + h - roundR);
        ctx.arc(x + w / 2, y + h - roundR, roundR - 1, Math.PI, 0, true);
        ctx.lineTo(x + w - 1, lwY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(' + r + ',' + g2 + ',' + b2 + ',' + alpha + ')';
        ctx.fill();
        ctx.restore();
      }
    }

    // Glass highlight
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(x + 4, y + 8, 3, h * 0.4);
    ctx.restore();

    // Rim
    ctx.strokeStyle = 'rgba(180, 200, 230, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + w + 2, y);
    ctx.stroke();
  }

  // ── Delivery Tube ──
  function drawDeliveryTube(x1, y1, x2, y2) {
    var cpX = (x1 + x2) / 2;
    var cpY = Math.min(y1, y2) - 50;

    // Outer stroke
    ctx.strokeStyle = 'rgba(180, 200, 230, 0.3)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
    ctx.stroke();

    // Inner fill
    ctx.strokeStyle = 'rgba(200, 220, 240, 0.08)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
    ctx.stroke();

    // Gas flow animation during generation
    if (state.generating && state.generationProgress > 0.2) {
      var progress = (state.generationProgress - 0.2) / 0.8;
      var dotCount = Math.floor(progress * 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      for (var i = 0; i < dotCount; i++) {
        var t = ((i / 6) + (Date.now() % 2000) / 2000) % 1;
        var px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpX + t * t * x2;
        var py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpY + t * t * y2;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── Test Tool Drawing ──
  function drawTestTool(tubeX, tubeY, tubeW) {
    var key = state.selectedGas;
    if (!key) return;

    var cx = tubeX + tubeW / 2;
    var topY = tubeY - 10;

    switch (key) {
      case 'O2':
        drawSplint(cx, topY, 'glow');
        break;
      case 'H2':
        drawSplint(cx, topY, 'lit');
        break;
      case 'CO2':
        // Limewater is drawn in the tube itself
        drawLimewaterLabel(cx, tubeY + 160);
        break;
      case 'Cl2':
        drawLitmusPaper(cx, topY, '#4477cc', key);
        break;
      case 'NH3':
        drawLitmusPaper(cx, topY, '#cc4444', key);
        break;
    }
  }

  function drawSplint(cx, topY, type) {
    var splintX = cx + 30;
    var splintTopY = topY - 40;
    var splintBottomY = topY + 60;

    // Animate approach
    var approach = state.toolApplied ? 1 : Math.min(1, state.testAnimPhase / 0.3);
    var offsetX = (1 - approach) * 50;

    splintX += offsetX;

    // Wooden splint
    ctx.strokeStyle = '#a08030';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(splintX, splintBottomY);
    ctx.lineTo(splintX, splintTopY);
    ctx.stroke();

    // Tip
    if (type === 'glow') {
      // Glowing ember
      var glowR = 5 + Math.sin(Date.now() / 300) * 2;
      var gradient = ctx.createRadialGradient(splintX, splintTopY, 0, splintX, splintTopY, glowR * 3);
      gradient.addColorStop(0, 'rgba(255, 107, 42, 0.9)');
      gradient.addColorStop(0.5, 'rgba(255, 60, 0, 0.4)');
      gradient.addColorStop(1, 'rgba(255, 60, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(splintX, splintTopY, glowR * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff6b2a';
      ctx.beginPath();
      ctx.arc(splintX, splintTopY, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Relight effect for O2
      if (state.toolApplied && state.testAnimPhase > 0.5) {
        var relightT = (state.testAnimPhase - 0.5) / 0.5;
        var flameH = 12 + relightT * 10;
        var flameGrad = ctx.createRadialGradient(splintX, splintTopY - flameH / 2, 0, splintX, splintTopY - flameH / 2, flameH);
        flameGrad.addColorStop(0, 'rgba(255, 255, 200, ' + relightT * 0.9 + ')');
        flameGrad.addColorStop(0.3, 'rgba(255, 200, 50, ' + relightT * 0.7 + ')');
        flameGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.ellipse(splintX, splintTopY - flameH / 2, 6, flameH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'lit') {
      // Burning flame
      var flameH2 = 14 + Math.sin(Date.now() / 150) * 3;
      var flameGrad2 = ctx.createRadialGradient(splintX, splintTopY - flameH2 / 2, 0, splintX, splintTopY - flameH2 / 2, flameH2);
      flameGrad2.addColorStop(0, 'rgba(255, 255, 150, 0.9)');
      flameGrad2.addColorStop(0.3, 'rgba(255, 170, 0, 0.7)');
      flameGrad2.addColorStop(0.7, 'rgba(255, 100, 0, 0.3)');
      flameGrad2.addColorStop(1, 'rgba(255, 50, 0, 0)');
      ctx.fillStyle = flameGrad2;
      ctx.beginPath();
      ctx.ellipse(splintX, splintTopY - flameH2 / 2, 6, flameH2 / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Squeaky pop flash for H2
      if (state.toolApplied && state.testAnimPhase > 0.4 && state.testAnimPhase < 0.8) {
        var popT = (state.testAnimPhase - 0.4) / 0.4;
        var popR = popT * 50;
        var popAlpha = 1 - popT;
        ctx.fillStyle = 'rgba(255, 200, 100, ' + popAlpha * 0.7 + ')';
        ctx.beginPath();
        ctx.arc(cx_safe(splintX, topY_safe(splintTopY)), splintTopY, popR, 0, Math.PI * 2);
        ctx.fill();

        // White center flash
        ctx.fillStyle = 'rgba(255, 255, 255, ' + popAlpha + ')';
        ctx.beginPath();
        ctx.arc(splintX, splintTopY, popR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Safe coordinate helpers for pop flash
  function cx_safe(x) { return x; }
  function topY_safe(y) { return y; }

  function drawLimewaterLabel(cx, y) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Limewater', cx, y);
  }

  function drawLitmusPaper(cx, topY, color, gasKey) {
    var paperX = cx + 20;
    var paperW = 14;
    var paperH = 45;
    var paperY = topY - paperH;

    var approach = state.toolApplied ? 1 : Math.min(1, state.testAnimPhase / 0.3);
    var offsetX = (1 - approach) * 40;
    paperX += offsetX;

    // Determine color based on animation
    var fillColor = color;
    if (state.toolApplied) {
      if (gasKey === 'Cl2') {
        // Blue -> red -> white
        var t = state.testAnimPhase;
        if (t < 0.5) {
          // Turning red
          var mixT = t / 0.5;
          var r1 = Math.round(68 + mixT * (204 - 68));
          var g1 = Math.round(119 + mixT * (68 - 119));
          var b1 = Math.round(204 + mixT * (68 - 204));
          fillColor = 'rgb(' + r1 + ',' + g1 + ',' + b1 + ')';
        } else {
          // Bleaching to white
          var mixT2 = (t - 0.5) / 0.5;
          var r2 = Math.round(204 + mixT2 * (240 - 204));
          var g2 = Math.round(68 + mixT2 * (235 - 68));
          var b2 = Math.round(68 + mixT2 * (224 - 68));
          fillColor = 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')';
        }
      } else if (gasKey === 'NH3') {
        // Red -> blue
        var tNH3 = Math.min(1, state.testAnimPhase / 0.7);
        var rA = Math.round(204 + tNH3 * (68 - 204));
        var gA = Math.round(68 + tNH3 * (119 - 68));
        var bA = Math.round(68 + tNH3 * (204 - 68));
        fillColor = 'rgb(' + rA + ',' + gA + ',' + bA + ')';
      }
    }

    // Handle stick
    ctx.strokeStyle = '#a08030';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(paperX + paperW / 2, paperY + paperH);
    ctx.lineTo(paperX + paperW / 2, paperY + paperH + 50);
    ctx.stroke();

    // Paper
    ctx.fillStyle = fillColor;
    ctx.fillRect(paperX, paperY, paperW, paperH);

    // Slight border
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(paperX, paperY, paperW, paperH);

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (gasKey === 'Cl2') {
      ctx.fillText('Blue Litmus', paperX + paperW / 2, paperY + paperH + 65);
    } else {
      ctx.fillText('Red Litmus', paperX + paperW / 2, paperY + paperH + 65);
    }
  }


  // ══════════════════════════════════════
  // ANALYSIS QUESTIONS
  // ══════════════════════════════════════

  function checkAnalysisAnswer(q) {
    var textarea = document.getElementById('analysis-' + q.id);
    var feedback = document.getElementById('feedback-' + q.id);
    if (!textarea || !feedback) return;

    var userAnswer = textarea.value.trim();
    if (!userAnswer) {
      toast('Please write an answer before checking.', 'warn');
      return;
    }

    // Simple keyword check: look for key terms in the model answer
    var answerLower = q.answer.toLowerCase();
    var userLower = userAnswer.toLowerCase();

    // Extract key terms from the answer (words longer than 4 characters)
    var keyTerms = answerLower.match(/\b[a-z]{5,}\b/g) || [];
    var uniqueTerms = [];
    keyTerms.forEach(function (t) {
      if (uniqueTerms.indexOf(t) === -1 && ['which', 'where', 'there', 'their', 'about', 'would', 'could', 'should', 'other', 'these', 'those', 'being', 'after', 'before'].indexOf(t) === -1) {
        uniqueTerms.push(t);
      }
    });

    var matchCount = 0;
    uniqueTerms.forEach(function (term) {
      if (userLower.indexOf(term) !== -1) matchCount++;
    });

    var threshold = Math.max(1, Math.floor(uniqueTerms.length * 0.3));
    var correct = matchCount >= threshold;

    if (correct) {
      feedback.className = 'analysis-feedback correct';
      feedback.textContent = 'Good answer! ' + q.answer;
      awardMark(q.id);
      if (typeof LabAudio !== 'undefined') LabAudio.success();
    } else {
      feedback.className = 'analysis-feedback show-answer';
      feedback.textContent = 'Model answer: ' + q.answer;
      if (typeof LabAudio !== 'undefined') LabAudio.warn();
    }

    textarea.disabled = true;
    document.getElementById('btn-check-' + q.id).disabled = true;
  }


  // ══════════════════════════════════════
  // SCORING
  // ══════════════════════════════════════

  function awardMark(criterionId) {
    if (typeof LabScore === 'undefined') return;
    LabScore.award(criterionId);
  }

  // Initialise scoring
  if (typeof LabScore !== 'undefined') {
    LabScore.init({
      criteria: GAS_DATA.scoringCriteria,
      totalMarks: GAS_DATA.totalMarks,
      targetEl: document.getElementById('score-slot'),
    });
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', function () {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    state.selectedGas = null;
    state.phase = 'idle';
    state.procedureStep = 0;
    state.bubbles = [];
    state.gasLevel = 0;
    state.generating = false;
    state.generationProgress = 0;
    state.testAnimPhase = 0;
    state.testAnimActive = false;
    state.toolVisible = false;
    state.toolApplied = false;
    state.completedGases = {};
    state.results = {};

    // Reset UI
    var btns = dom.gasSelector.querySelectorAll('.gas-btn');
    btns.forEach(function (btn) {
      btn.classList.remove('active', 'completed');
    });

    dom.reactionCard.style.display = 'none';
    dom.reactionPlaceholder.style.display = '';

    dom.btnAddReagent.disabled = true;
    dom.btnApplyTest.disabled = true;
    dom.btnApplyTest.textContent = 'Apply Test';
    dom.actionStatus.innerHTML = 'Select a gas to begin.';
    dom.wbStatus.innerHTML = '';

    dom.resultOverlay.classList.remove('visible');
    dom.completionBanner.classList.remove('visible');

    // Rebuild results table and analysis
    buildResultsTable();
    dom.dataEmpty.style.display = '';

    // Reset analysis questions
    GAS_DATA.analysisQuestions.forEach(function (q) {
      var ta = document.getElementById('analysis-' + q.id);
      if (ta) {
        ta.value = '';
        ta.disabled = false;
      }
      var btn = document.getElementById('btn-check-' + q.id);
      if (btn) btn.disabled = false;
      var fb = document.getElementById('feedback-' + q.id);
      if (fb) {
        fb.className = 'analysis-feedback';
        fb.textContent = '';
      }
    });

    // Reset score
    if (typeof LabScore !== 'undefined') {
      LabScore.reset();
    }

    updateProcedureHighlight();
    draw();
    toast('Practical reset. Select a gas to begin.');
  });


  // ══════════════════════════════════════
  // GUIDE TOGGLE
  // ══════════════════════════════════════

  dom.btnToggleGuide.addEventListener('click', function () {
    var visible = dom.guidePanel.style.display !== 'none';
    dom.guidePanel.style.display = visible ? 'none' : '';
  });


  // ══════════════════════════════════════
  // TOAST
  // ══════════════════════════════════════

  function toast(message, type) {
    if (!dom.toast) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = message;
    dom.toast.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('visible'); });
    setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(function () { el.remove(); }, 300);
    }, 2500);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }


  // ══════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════

  init();

});
