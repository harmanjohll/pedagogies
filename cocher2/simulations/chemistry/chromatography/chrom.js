/* ============================================================
   Paper Chromatography — Chemistry Simulation
   Canvas-based chromatography with Rf calculation and analysis
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── roundRect polyfill for older browsers ──
  if (typeof CanvasRenderingContext2D !== 'undefined' &&
      !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
      if (!Array.isArray(radii)) radii = [radii, radii, radii, radii];
      var tl = radii[0] || 0, tr = radii[1] || 0, br = radii[2] || 0, bl = radii[3] || 0;
      this.moveTo(x + tl, y);
      this.lineTo(x + w - tr, y);
      this.quadraticCurveTo(x + w, y, x + w, y + tr);
      this.lineTo(x + w, y + h - br);
      this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
      this.lineTo(x + bl, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - bl);
      this.lineTo(x, y + tl);
      this.quadraticCurveTo(x, y, x + tl, y);
      this.closePath();
      return this;
    };
  }

  // ── Constants ──
  const PAPER_HEIGHT_CM  = 14;     // total paper height in cm
  const BASELINE_CM      = 2;      // baseline distance from bottom
  const SOLVENT_FRONT_CM = 12;     // solvent front stops here
  const SOLVENT_RISE_MS  = 6000;   // time for solvent to rise fully
  const SPOT_TRAVEL_MS   = 5500;   // spot separation animation time

  // ── State ──
  const state = {
    currentSample: null,
    phase: 'idle',       // idle | selected | baseline | spotted | developing | done | measuring
    solventProgress: 0,  // 0..1 how far solvent has risen
    spotPositions: [],   // [{colour, rf, label, currentCm}] after separation
    animationId: null,
    animStartTime: 0,

    // Measurement
    solventFrontCm: 0,
    measurementsDone: false,

    // Scoring
    score: {},
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas:          $('main-canvas'),
    sampleSelect:    $('sample-select'),
    sampleInfo:      $('sample-info'),
    sampleSwatch:    $('sample-swatch'),
    sampleNameDisp:  $('sample-name-display'),
    sampleSolvent:   $('sample-solvent-tag'),
    refDyeList:      $('ref-dye-list'),
    procedureSteps:  $('procedure-steps'),
    actionHint:      $('action-hint'),
    solventDisplay:  $('solvent-display'),
    solventDot:      $('solvent-dot'),
    solventName:     $('solvent-name'),
    resultsTable:    $('results-table'),
    resultsTbody:    $('results-tbody'),
    resultsEmpty:    $('results-empty'),
    sfDistance:       $('sf-distance'),
    calcWorkspace:   $('calc-workspace'),
    calcPlaceholder: $('calc-placeholder'),
    pureMixPanel:    $('pure-mix-panel'),
    pureMixBody:     $('pure-mix-body'),
    analysisList:    $('analysis-list'),
    scoreSlot:       $('score-slot'),
    btnReset:        $('btn-reset'),
    btnToggleGuide:  $('btn-toggle-guide'),
    guidePanel:      $('guide-panel'),
    toast:           $('toast-container'),
  };

  const ctx = dom.canvas.getContext('2d');

  // ── Canvas sizing ──
  function resizeCanvas() {
    const panel = dom.canvas.parentElement;
    const w = Math.min(panel.clientWidth - 32, 700);
    const h = Math.min(panel.clientHeight - 20, 520);
    dom.canvas.width  = w;
    dom.canvas.height = h;
    draw();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);


  // ══════════════════════════════════════
  // INITIALISATION — populate UI from CHROM_DATA
  // ══════════════════════════════════════

  function init() {
    buildSampleSelector();
    buildReferenceDyes();
    buildProcedureSteps();
    buildAnalysisQuestions();
    updateProcedureHighlight();
    draw();
  }

  // ── Sample Selector (grouped by category) ──
  function buildSampleSelector() {
    const groups = CHROM_DATA.groupedSamples();
    const sel = dom.sampleSelect;
    Object.keys(groups).forEach(cat => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = cat;
      groups[cat].forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        optgroup.appendChild(opt);
      });
      sel.appendChild(optgroup);
    });
  }

  // ── Reference Dyes List ──
  function buildReferenceDyes() {
    CHROM_DATA.referenceDyes.forEach(d => {
      const item = document.createElement('div');
      item.className = 'ref-dye-item';
      item.innerHTML = `
        <span class="ref-dye-swatch" style="background:${d.colour}"></span>
        <span class="ref-dye-name">${d.name}</span>
        <span class="ref-dye-rf">${d.rf.toFixed(2)}</span>
      `;
      dom.refDyeList.appendChild(item);
    });
  }

  // ── Procedure Steps ──
  function buildProcedureSteps() {
    CHROM_DATA.steps.forEach(step => {
      const el = document.createElement('div');
      el.className = 'procedure-step';
      el.id = 'step-' + step.id;
      el.innerHTML = `
        <div class="step-num">${step.num}</div>
        <div class="step-content">
          <h4>${step.title}</h4>
          <p>${step.instruction}</p>
          <div class="step-why">${step.why}</div>
        </div>
      `;
      dom.procedureSteps.appendChild(el);
    });
  }

  // ── Analysis Questions ──
  function buildAnalysisQuestions() {
    CHROM_DATA.questions.forEach((q, i) => {
      const el = document.createElement('div');
      el.className = 'analysis-question';
      el.innerHTML = `
        <div class="question-header" data-qid="${q.id}">
          <span class="question-num">${i + 1}</span>
          <span class="question-text">${q.question}</span>
          <span class="question-marks">[${q.marks}]</span>
          <svg class="question-chevron" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 6l3.5 4 3.5-4z"/></svg>
        </div>
        <div class="question-body">
          <div class="question-answer">${q.answer}</div>
        </div>
      `;
      el.querySelector('.question-header').addEventListener('click', () => {
        el.classList.toggle('open');
        // Score: answered questions
        awardScore('questions');
      });
      dom.analysisList.appendChild(el);
    });
  }

  // ── Procedure highlight ──
  function updateProcedureHighlight() {
    const phaseToStep = {
      'idle':       'select',
      'selected':   'baseline',
      'baseline':   'spot',
      'spotted':    'develop',
      'developing': 'run',
      'done':       'measure',
      'measuring':  'calculate',
    };
    const activeId = phaseToStep[state.phase] || 'select';

    CHROM_DATA.steps.forEach(step => {
      const el = document.getElementById('step-' + step.id);
      if (!el) return;
      el.classList.remove('active', 'completed');

      const stepIndex = CHROM_DATA.steps.findIndex(s => s.id === step.id);
      const activeIndex = CHROM_DATA.steps.findIndex(s => s.id === activeId);
      if (stepIndex < activeIndex) {
        el.classList.add('completed');
      } else if (stepIndex === activeIndex) {
        el.classList.add('active');
      }
    });
  }

  // ── Action hint text ──
  function setHint(text) {
    dom.actionHint.textContent = text;
  }


  // ══════════════════════════════════════
  // CANVAS DRAWING
  // ══════════════════════════════════════

  function draw() {
    const W = dom.canvas.width;
    const H = dom.canvas.height;
    ctx.clearRect(0, 0, W, H);

    drawBench(W, H);
    drawBeaker(W, H);
    drawPaper(W, H);
    drawInfoText(W, H);
  }

  // ── Bench surface ──
  function drawBench(W, H) {
    const benchY = H - 40;
    // Bench top
    const benchGrad = ctx.createLinearGradient(0, benchY, 0, H);
    benchGrad.addColorStop(0, '#5a4a3a');
    benchGrad.addColorStop(0.05, '#6b5b4b');
    benchGrad.addColorStop(1, '#4a3a2a');
    ctx.fillStyle = benchGrad;
    ctx.fillRect(0, benchY, W, H - benchY);

    // Edge highlight
    ctx.strokeStyle = '#7a6a5a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, benchY);
    ctx.lineTo(W, benchY);
    ctx.stroke();
  }

  // ── Beaker ──
  function drawBeaker(W, H) {
    const benchY = H - 40;
    const bW = 140;
    const bH = 170;
    const bX = W / 2 - bW / 2;
    const bY = benchY - bH;

    // Glass body
    ctx.strokeStyle = 'rgba(160, 200, 240, 0.5)';
    ctx.lineWidth = 2;

    // Left wall
    ctx.beginPath();
    ctx.moveTo(bX, bY);
    ctx.lineTo(bX + 4, benchY);
    ctx.stroke();

    // Right wall
    ctx.beginPath();
    ctx.moveTo(bX + bW, bY);
    ctx.lineTo(bX + bW - 4, benchY);
    ctx.stroke();

    // Bottom
    ctx.beginPath();
    ctx.moveTo(bX + 4, benchY);
    ctx.lineTo(bX + bW - 4, benchY);
    ctx.stroke();

    // Rim / lip
    ctx.strokeStyle = 'rgba(160, 200, 240, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bX - 4, bY);
    ctx.lineTo(bX + bW + 4, bY);
    ctx.stroke();

    // Glass highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bX + 12, bY + 10);
    ctx.lineTo(bX + 14, benchY - 10);
    ctx.stroke();

    // Solvent
    if (state.currentSample) {
      const solventInfo = CHROM_DATA.solvents[state.currentSample.solvent];
      const solventH = bH * 0.22;
      const solventY = benchY - solventH;

      ctx.fillStyle = solventInfo.colour;
      ctx.beginPath();
      // Slightly inset from walls
      const leftX  = bX + 5 + (4 * (1 - solventH / bH));
      const rightX = bX + bW - 5 - (4 * (1 - solventH / bH));
      ctx.moveTo(leftX, solventY);
      ctx.lineTo(rightX, solventY);
      ctx.lineTo(bX + bW - 5, benchY - 1);
      ctx.lineTo(bX + 5, benchY - 1);
      ctx.closePath();
      ctx.fill();

      // Meniscus
      ctx.strokeStyle = solventInfo.colour.replace('0.30', '0.50');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(leftX, solventY);
      ctx.quadraticCurveTo(W / 2, solventY + 4, rightX, solventY);
      ctx.stroke();

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(solventInfo.name, W / 2, benchY + 25);
    }

    // Highlight beaker if awaiting develop action
    if (state.phase === 'spotted') {
      ctx.strokeStyle = 'rgba(67, 97, 238, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(bX - 5, bY - 5, bW + 10, bH + 10);
      ctx.setLineDash([]);
    }
  }

  // ── Chromatography Paper ──
  function drawPaper(W, H) {
    const benchY = H - 40;
    const pW = 80;
    const pH = 280;
    const pX = W / 2 - pW / 2;

    // Paper is lowered into beaker when developing or done
    let paperOffsetY = 0;
    if (state.phase === 'developing' || state.phase === 'done' || state.phase === 'measuring') {
      paperOffsetY = 45;
    }

    const pY = benchY - 170 - pH + 60 + paperOffsetY;

    // Clip at top
    const clipW = 40;
    const clipH = 14;
    const clipX = W / 2 - clipW / 2;
    const clipY = pY - clipH;

    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.roundRect(clipX, clipY, clipW, clipH, [3, 3, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#b0b8c4';
    ctx.fillRect(clipX + 4, clipY + 2, clipW - 8, 3);

    // Rod above clip
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(W / 2 - 60, clipY - 6, 120, 6);

    // Paper body
    ctx.fillStyle = '#f5f0e8';
    ctx.strokeStyle = 'rgba(200, 190, 170, 0.6)';
    ctx.lineWidth = 1;
    ctx.fillRect(pX, pY, pW, pH);
    ctx.strokeRect(pX, pY, pW, pH);

    // Paper texture
    ctx.strokeStyle = 'rgba(200, 190, 170, 0.08)';
    ctx.lineWidth = 0.5;
    for (let y = pY; y < pY + pH; y += 4) {
      ctx.beginPath();
      ctx.moveTo(pX, y);
      ctx.lineTo(pX + pW, y);
      ctx.stroke();
    }

    // Conversion helpers: cm on paper to pixel Y
    const cmToPixelY = (cm) => {
      return pY + pH - (cm / PAPER_HEIGHT_CM) * pH;
    };

    // ── Pencil Baseline ──
    if (state.phase !== 'idle' && state.phase !== 'selected') {
      const baselineY = cmToPixelY(BASELINE_CM);
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pX + 6, baselineY);
      ctx.lineTo(pX + pW - 6, baselineY);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#888';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('baseline', pX + pW + 6, baselineY + 3);
    }

    // ── Sample spot at origin ──
    if (state.phase === 'spotted' || state.phase === 'developing' || state.phase === 'done' || state.phase === 'measuring') {
      if (state.phase === 'spotted') {
        // Show original combined spot
        const spotY = cmToPixelY(BASELINE_CM);
        ctx.fillStyle = state.currentSample.spotColour;
        ctx.beginPath();
        ctx.arc(W / 2, spotY, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Solvent front & wet region ──
    if (state.phase === 'developing' || state.phase === 'done' || state.phase === 'measuring') {
      const sfCm = state.phase === 'developing'
        ? BASELINE_CM + state.solventProgress * (SOLVENT_FRONT_CM - BASELINE_CM)
        : SOLVENT_FRONT_CM;
      const sfY = cmToPixelY(sfCm);

      // Wet paper region
      const wetBottom = pY + pH;
      ctx.fillStyle = 'rgba(180, 210, 255, 0.08)';
      ctx.fillRect(pX, sfY, pW, wetBottom - sfY);

      // Solvent front dashed line
      ctx.strokeStyle = 'rgba(100, 140, 200, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(pX, sfY);
      ctx.lineTo(pX + pW, sfY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(100, 140, 200, 0.7)';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('solvent front', pX + pW + 6, sfY + 3);
    }

    // ── Separated spots ──
    if (state.phase === 'developing' || state.phase === 'done' || state.phase === 'measuring') {
      const sfCm = state.phase === 'developing'
        ? BASELINE_CM + state.solventProgress * (SOLVENT_FRONT_CM - BASELINE_CM)
        : SOLVENT_FRONT_CM;

      state.currentSample.spots.forEach((spot, i) => {
        const targetCm = BASELINE_CM + spot.rf * (SOLVENT_FRONT_CM - BASELINE_CM);
        let currentCm;

        if (state.phase === 'developing') {
          // Spot travels as solvent front passes it
          const spotProgress = Math.min(1, state.solventProgress / spot.rf);
          currentCm = BASELINE_CM + spotProgress * (targetCm - BASELINE_CM);
          // Only show spot if solvent has reached baseline
          if (sfCm < BASELINE_CM + 0.3) return;
        } else {
          currentCm = targetCm;
        }

        const spotY = cmToPixelY(currentCm);

        // Spot ellipse
        ctx.fillStyle = spot.colour;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(W / 2, spotY, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Spot label (visible only when done/measuring)
        if (state.phase === 'done' || state.phase === 'measuring') {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = '8px Inter, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(spot.label, pX + pW + 6, spotY + 3);
        }
      });
    }

    // ── Measurement annotations ──
    if (state.phase === 'measuring') {
      const baselineY = cmToPixelY(BASELINE_CM);
      const sfY = cmToPixelY(SOLVENT_FRONT_CM);
      const sfDistCm = (SOLVENT_FRONT_CM - BASELINE_CM).toFixed(1);

      // Solvent front distance bracket (left side)
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(pX - 18, baselineY);
      ctx.lineTo(pX - 18, sfY);
      ctx.stroke();
      // Top tick
      ctx.beginPath();
      ctx.moveTo(pX - 24, sfY);
      ctx.lineTo(pX - 12, sfY);
      ctx.stroke();
      // Bottom tick
      ctx.beginPath();
      ctx.moveTo(pX - 24, baselineY);
      ctx.lineTo(pX - 12, baselineY);
      ctx.stroke();
      // Label
      ctx.fillStyle = '#f59e0b';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(sfDistCm + ' cm', pX - 26, (baselineY + sfY) / 2 + 3);

      // Spot distance markers (right side)
      state.currentSample.spots.forEach((spot, i) => {
        const targetCm = BASELINE_CM + spot.rf * (SOLVENT_FRONT_CM - BASELINE_CM);
        const spotY = cmToPixelY(targetCm);
        const distCm = (targetCm - BASELINE_CM).toFixed(1);

        ctx.strokeStyle = spot.colour;
        ctx.lineWidth = 1;
        // Tick at spot
        ctx.beginPath();
        ctx.moveTo(pX + pW + 3, spotY);
        ctx.lineTo(pX + pW + 18, spotY);
        ctx.stroke();
        // Vertical dash to baseline
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(pX + pW + 10, spotY);
        ctx.lineTo(pX + pW + 10, baselineY);
        ctx.stroke();
        ctx.setLineDash([]);
        // Distance label
        ctx.fillStyle = spot.colour;
        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(distCm + ' cm', pX + pW + 22, spotY + 3);
      });
    }

    // ── Highlight paper for baseline click ──
    if (state.phase === 'selected') {
      ctx.strokeStyle = 'rgba(67, 97, 238, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(pX - 3, pY - 3, pW + 6, pH + 6);
      ctx.setLineDash([]);
    }
  }

  // ── Info text at bottom ──
  function drawInfoText(W, H) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';

    const hints = {
      'idle':       'Select a sample from the panel to begin.',
      'selected':   'Click on the paper to draw a pencil baseline.',
      'baseline':   'Click on the baseline to spot your sample.',
      'spotted':    'Click the beaker to lower the paper into the solvent.',
      'developing': 'Solvent is rising by capillary action...',
      'done':       'Chromatogram complete. Click "Measure" below to measure distances.',
      'measuring':  'Distances measured. Check the results table.',
    };
    ctx.fillText(hints[state.phase] || '', W / 2, H - 8);
  }


  // ══════════════════════════════════════
  // CANVAS INTERACTION
  // ══════════════════════════════════════

  dom.canvas.addEventListener('click', (e) => {
    const rect = dom.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const W = dom.canvas.width;
    const H = dom.canvas.height;
    const benchY = H - 40;
    const pW = 80;
    const pH = 280;
    const pX = W / 2 - pW / 2;

    let paperOffsetY = 0;
    if (state.phase === 'developing' || state.phase === 'done' || state.phase === 'measuring') {
      paperOffsetY = 45;
    }
    const pY = benchY - 170 - pH + 60 + paperOffsetY;

    // Beaker region
    const bW = 140;
    const bH = 170;
    const bX = W / 2 - bW / 2;
    const bY = benchY - bH;

    if (state.phase === 'selected') {
      // Click on paper to draw baseline
      if (mx >= pX && mx <= pX + pW && my >= pY && my <= pY + pH) {
        state.phase = 'baseline';
        awardScore('baseline');
        updateProcedureHighlight();
        setHint('Click the baseline to spot your sample.');
        toast('Pencil baseline drawn 2 cm from the bottom.');
        if (typeof LabAudio !== 'undefined') LabAudio.click();
        draw();
      }
    } else if (state.phase === 'baseline') {
      // Click near baseline to spot sample
      const baselinePxY = pY + pH - (BASELINE_CM / PAPER_HEIGHT_CM) * pH;
      if (mx >= pX && mx <= pX + pW && Math.abs(my - baselinePxY) < 20) {
        state.phase = 'spotted';
        awardScore('spot');
        updateProcedureHighlight();
        setHint('Click the beaker to lower the paper into the solvent.');
        toast('Sample spotted on the baseline. Place paper in solvent.');
        if (typeof LabAudio !== 'undefined') LabAudio.click();
        draw();
      }
    } else if (state.phase === 'spotted') {
      // Click beaker to develop
      if (mx >= bX && mx <= bX + bW && my >= bY && my <= benchY) {
        startDevelopment();
      }
    } else if (state.phase === 'done') {
      // Click anywhere on paper to start measuring
      if (mx >= pX - 30 && mx <= pX + pW + 80 && my >= pY && my <= pY + pH) {
        startMeasurement();
      }
    }
  });

  // Change cursor based on phase
  dom.canvas.addEventListener('mousemove', (e) => {
    const validPhases = ['selected', 'baseline', 'spotted', 'done'];
    dom.canvas.style.cursor = validPhases.includes(state.phase) ? 'pointer' : 'default';
  });


  // ══════════════════════════════════════
  // SAMPLE SELECTION
  // ══════════════════════════════════════

  dom.sampleSelect.addEventListener('change', () => {
    const id = dom.sampleSelect.value;
    const sample = CHROM_DATA.getSample(id);
    if (!sample) return;

    /* Cancel any running animation from a previous sample */
    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }

    state.currentSample = sample;
    state.phase = 'selected';

    // Show sample info
    dom.sampleInfo.style.display = '';
    dom.sampleSwatch.style.background = sample.spotColour;
    dom.sampleNameDisp.textContent = sample.name;
    const solventInfo = CHROM_DATA.solvents[sample.solvent];
    dom.sampleSolvent.textContent = 'Solvent: ' + solventInfo.name;

    // Show solvent display
    dom.solventDisplay.style.display = 'flex';
    dom.solventDot.style.background = solventInfo.colour;
    dom.solventName.textContent = solventInfo.name;

    updateProcedureHighlight();
    setHint('Click on the chromatography paper to draw a pencil baseline.');
    toast('Selected: ' + sample.name + '. Draw a pencil baseline on the paper.');
    if (typeof LabAudio !== 'undefined') LabAudio.click();
    draw();
  });


  // ══════════════════════════════════════
  // CHROMATOGRAM DEVELOPMENT (ANIMATION)
  // ══════════════════════════════════════

  function startDevelopment() {
    state.phase = 'developing';
    state.solventProgress = 0;
    state.animStartTime = performance.now();

    awardScore('develop');
    awardScore('solvent-ok');
    updateProcedureHighlight();
    setHint('Solvent rising by capillary action... please wait.');
    toast('Paper placed in solvent. Watching capillary action...');
    if (typeof LabAudio !== 'undefined') LabAudio.click();

    function animLoop(timestamp) {
      const elapsed = timestamp - state.animStartTime;
      state.solventProgress = Math.min(1, elapsed / SOLVENT_RISE_MS);

      draw();

      if (state.solventProgress < 1) {
        state.animationId = requestAnimationFrame(animLoop);
      } else {
        // Development complete
        state.phase = 'done';
        state.solventFrontCm = SOLVENT_FRONT_CM;
        awardScore('waited');
        updateProcedureHighlight();
        setHint('Chromatogram complete! Click the paper to measure distances.');
        toast('Solvent front reached the top. Click paper to measure.', 'success');
        if (typeof LabAudio !== 'undefined') LabAudio.success();
        draw();
      }
    }
    state.animationId = requestAnimationFrame(animLoop);
  }


  // ══════════════════════════════════════
  // MEASUREMENT
  // ══════════════════════════════════════

  function startMeasurement() {
    state.phase = 'measuring';
    state.measurementsDone = true;

    awardScore('measure-sf');
    awardScore('measure-sp');
    updateProcedureHighlight();
    setHint('Distances measured. Calculate Rf values in the results panel.');
    toast('Distances measured. Check the results table on the right.', 'success');
    if (typeof LabAudio !== 'undefined') LabAudio.success();

    draw();
    buildResultsTable();
    buildRfCalculations();
    buildPureMixture();
    showScore();
  }

  // ── Results Table ──
  function buildResultsTable() {
    dom.resultsEmpty.style.display = 'none';
    dom.resultsTable.style.display = '';
    dom.resultsTbody.innerHTML = '';

    const sfDist = (SOLVENT_FRONT_CM - BASELINE_CM);
    dom.sfDistance.textContent = sfDist.toFixed(1) + ' cm';

    state.currentSample.spots.forEach((spot, i) => {
      const distCm = spot.rf * sfDist;
      const calcRf = distCm / sfDist;

      // Find matching reference dye
      let matchName = '—';
      CHROM_DATA.referenceDyes.forEach(ref => {
        if (Math.abs(ref.rf - spot.rf) < 0.02) {
          matchName = ref.name;
        }
      });

      const row = document.createElement('tr');
      row.className = 'animate-fade-in';

      // Determine if we use guided or independent mode for Rf input
      const isGuided = (typeof LabRecordMode === 'undefined') || LabRecordMode.isGuided();

      row.innerHTML = `
        <td>${i + 1}</td>
        <td>
          <span class="colour-cell">
            <span class="colour-dot" style="background:${spot.colour}"></span>
          </span>
        </td>
        <td>${isGuided ? distCm.toFixed(1) : '<input type="number" class="rf-input" data-spot="' + i + '" data-field="dist" placeholder="?" step="0.1">'}</td>
        <td>${isGuided ? calcRf.toFixed(2) : '<input type="number" class="rf-input" data-spot="' + i + '" data-field="rf" placeholder="?" step="0.01">'}</td>
        <td class="match-cell">${matchName}</td>
      `;
      dom.resultsTbody.appendChild(row);
    });

    // If independent mode, add check button
    if (typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided()) {
      const checkRow = document.createElement('tr');
      checkRow.innerHTML = `<td colspan="5" style="text-align:center;">
        <button id="btn-check-rf" class="btn btn-success btn-sm">Check Rf Values</button>
      </td>`;
      dom.resultsTbody.appendChild(checkRow);
      const btnCheck = document.getElementById('btn-check-rf');
      if (btnCheck) {
        btnCheck.addEventListener('click', checkIndependentRf);
      }
    } else {
      awardScore('rf-calc');
      awardScore('identify');
    }
  }

  // ── Independent mode: check user Rf values ──
  function checkIndependentRf() {
    const sfDist = SOLVENT_FRONT_CM - BASELINE_CM;
    let allCorrect = true;

    state.currentSample.spots.forEach((spot, i) => {
      const expectedDist = spot.rf * sfDist;
      const expectedRf = spot.rf;

      const distInput = document.querySelector(`input[data-spot="${i}"][data-field="dist"]`);
      const rfInput   = document.querySelector(`input[data-spot="${i}"][data-field="rf"]`);

      if (distInput) {
        const userDist = parseFloat(distInput.value);
        if (isNaN(userDist) || Math.abs(userDist - expectedDist) > 0.5) {
          distInput.style.borderBottom = '2px solid #dc2626';
          allCorrect = false;
        } else {
          distInput.style.borderBottom = '2px solid #10b981';
        }
      }
      if (rfInput) {
        const userRf = parseFloat(rfInput.value);
        if (isNaN(userRf) || Math.abs(userRf - expectedRf) > 0.05) {
          rfInput.style.borderBottom = '2px solid #dc2626';
          allCorrect = false;
        } else {
          rfInput.style.borderBottom = '2px solid #10b981';
        }
      }
    });

    if (allCorrect) {
      toast('All Rf values correct!', 'success');
      awardScore('rf-calc');
      awardScore('identify');
      showScore();
    } else {
      toast('Some values are incorrect. Check and try again.', 'warn');
    }
  }

  // ── Rf Calculations Workspace ──
  function buildRfCalculations() {
    dom.calcPlaceholder.style.display = 'none';
    dom.calcWorkspace.style.display = '';
    dom.calcWorkspace.innerHTML = '';

    const sfDist = SOLVENT_FRONT_CM - BASELINE_CM;

    state.currentSample.spots.forEach((spot, i) => {
      const distCm = spot.rf * sfDist;
      const rfVal = distCm / sfDist;

      const block = document.createElement('div');
      block.style.marginBottom = '12px';
      block.innerHTML = `
        <span class="calc-label">Spot ${i + 1} (${spot.label})</span>
        <div class="calc-line">Rf = ${distCm.toFixed(1)} / ${sfDist.toFixed(1)}</div>
        <div class="calc-result">Rf = ${rfVal.toFixed(2)}</div>
      `;
      dom.calcWorkspace.appendChild(block);
    });
  }

  // ── Pure/Mixture Conclusion ──
  function buildPureMixture() {
    dom.pureMixPanel.style.display = '';
    const sample = state.currentSample;
    const numSpots = sample.spots.length;
    const isPure = sample.pure;

    let html = '';
    if (isPure) {
      html = `
        <p class="text-sm">The chromatogram shows <strong>1 spot</strong>.</p>
        <p class="text-sm" style="margin-top:8px;">
          This indicates that <strong>${sample.name}</strong> is a <strong>pure substance</strong>.
          It contains only one dye: <strong>${sample.spots[0].label}</strong>.
        </p>
      `;
    } else {
      const componentNames = sample.spots.map(s => s.label).join(', ');
      html = `
        <p class="text-sm">The chromatogram shows <strong>${numSpots} spots</strong>.</p>
        <p class="text-sm" style="margin-top:8px;">
          This indicates that <strong>${sample.name}</strong> is a <strong>mixture</strong>
          containing ${numSpots} components: <strong>${componentNames}</strong>.
        </p>
      `;
    }
    dom.pureMixBody.innerHTML = html;
    awardScore('pure-mix');
  }


  // ══════════════════════════════════════
  // SCORING
  // ══════════════════════════════════════

  function awardScore(criterionId) {
    if (state.score[criterionId]) return; // already awarded
    state.score[criterionId] = true;

    if (typeof LabScore !== 'undefined') {
      const criterion = CHROM_DATA.scoreCriteria.find(c => c.id === criterionId);
      if (criterion) {
        LabScore.award(criterionId, criterion.marks, criterion.description);
      }
    }
  }

  function showScore() {
    if (typeof LabScore === 'undefined') return;

    let earned = 0;
    CHROM_DATA.scoreCriteria.forEach(c => {
      if (state.score[c.id]) earned += c.marks;
    });

    dom.scoreSlot.innerHTML = `
      <div class="panel">
        <div class="panel-header">Score</div>
        <div class="panel-body">
          <div style="font-size:24px; font-weight:700; color:var(--color-primary); text-align:center;">
            ${earned} / ${CHROM_DATA.totalMarks}
          </div>
          <div style="margin-top:12px;">
            ${CHROM_DATA.scoreCriteria.map(c => `
              <div style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:12px;">
                <span style="color:${state.score[c.id] ? 'var(--color-success)' : 'var(--color-text-muted)'}; font-weight:700;">
                  ${state.score[c.id] ? '&#10003;' : '&#9675;'}
                </span>
                <span style="flex:1; color:var(--color-text-secondary);">${c.description}</span>
                <span style="font-family:var(--font-mono); font-weight:600;">${state.score[c.id] ? c.marks : 0}/${c.marks}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    // Cancel any running animation
    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }

    // Reset state
    state.currentSample = null;
    state.phase = 'idle';
    state.solventProgress = 0;
    state.spotPositions = [];
    state.animStartTime = 0;
    state.solventFrontCm = 0;
    state.measurementsDone = false;
    state.score = {};

    // Reset DOM
    dom.sampleSelect.value = '';
    dom.sampleInfo.style.display = 'none';
    dom.solventDisplay.style.display = 'none';

    dom.resultsTable.style.display = 'none';
    dom.resultsTbody.innerHTML = '';
    dom.resultsEmpty.style.display = '';
    dom.sfDistance.textContent = '—';

    dom.calcWorkspace.style.display = 'none';
    dom.calcWorkspace.innerHTML = '';
    dom.calcPlaceholder.style.display = '';

    dom.pureMixPanel.style.display = 'none';
    dom.pureMixBody.innerHTML = '';
    dom.scoreSlot.innerHTML = '';

    updateProcedureHighlight();
    setHint('Select a sample to begin.');
    draw();
    toast('Experiment reset. Select a new sample to start.');
  });


  // ══════════════════════════════════════
  // GUIDE TOGGLE
  // ══════════════════════════════════════

  dom.btnToggleGuide.addEventListener('click', () => {
    const visible = dom.guidePanel.style.display !== 'none';
    dom.guidePanel.style.display = visible ? 'none' : '';
  });


  // ══════════════════════════════════════
  // RECORD MODE INTEGRATION
  // ══════════════════════════════════════

  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }


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


  // ══════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════

  init();
});
