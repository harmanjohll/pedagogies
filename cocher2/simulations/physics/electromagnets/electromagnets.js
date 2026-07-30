/* ============================================================
   Electromagnets Investigation — Physics Simulation
   Canvas-based electromagnet with variable selection,
   data collection, graphing, and analysis questions
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── State ──
  const state = {
    selectedVar: 'coils',       // 'coils' | 'current' | 'core'
    coilTurns: 10,              // current slider/input value for coils
    currentAmps: 0.5,           // current slider value for current investigation
    coreMaterial: 'iron',       // selected core material
    powerOn: false,
    pickingUp: false,           // animation in progress
    lastClipCount: 0,           // result of last pick-up
    hasResult: false,           // true after pick-up, before record
    dataPoints: [],             // [{iv, ivLabel, clips}]
    animFrame: 0,               // animation counter for current flow
    animId: null,               // requestAnimationFrame id
    pickupAnimId: null,         // pickup animation frame id
    clipsOnNail: [],            // positions of clips stuck to nail for drawing
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas:           $('sim-canvas'),
    varSelector:      $('var-selector'),
    controlledList:   $('controlled-list'),
    setupControls:    $('setup-controls'),
    procedureList:    $('procedure-list'),
    ammeterValue:     $('ammeter-value'),
    btnPower:         $('btn-power'),
    btnPickup:        $('btn-pickup'),
    btnRecord:        $('btn-record'),
    clipCountDisplay: $('clip-count-display'),
    clipCountValue:   $('clip-count-value'),
    clipInputGroup:   $('clip-input-group'),
    clipInput:        $('clip-input'),
    thIndependent:    $('th-independent'),
    dataTbody:        $('data-tbody'),
    dataEmpty:        $('data-empty'),
    graphCanvas:      $('graph-canvas'),
    graphHeader:      $('graph-header'),
    analysisQuestions:$('analysis-questions'),
    btnReset:         $('btn-reset'),
    btnToggleGuide:   $('btn-toggle-guide'),
    guidePanel:       $('guide-panel'),
    toast:            $('toast-container'),
  };

  const ctx = dom.canvas.getContext('2d');
  const gCtx = dom.graphCanvas.getContext('2d');


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
      else LabAudio.click();
    }
  }


  // ══════════════════════════════════════
  // LABRECORDMODE INTEGRATION
  // ══════════════════════════════════════

  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-container');
  }

  function isGuidedMode() {
    return typeof LabRecordMode === 'undefined' || LabRecordMode.isGuided();
  }


  // ══════════════════════════════════════
  // PROCEDURE STEPS
  // ══════════════════════════════════════

  function populateProcedure() {
    dom.procedureList.innerHTML = '';
    EM_DATA.procedureSteps.forEach(step => {
      const li = document.createElement('li');
      li.className = 'procedure-step';
      li.setAttribute('data-step', step.id);
      li.innerHTML = `<strong>${step.title}</strong><br>${step.instruction}`;
      li.title = step.why;
      dom.procedureList.appendChild(li);
    });
    highlightProcedureStep('select');
  }

  function highlightProcedureStep(stepId) {
    dom.procedureList.querySelectorAll('.procedure-step').forEach(li => {
      const sid = li.getAttribute('data-step');
      li.classList.remove('active', 'done');
      const order = EM_DATA.procedureSteps.map(s => s.id);
      const target = order.indexOf(stepId);
      const current = order.indexOf(sid);
      if (current < target) li.classList.add('done');
      else if (current === target) li.classList.add('active');
    });
  }

  populateProcedure();


  // ══════════════════════════════════════
  // VARIABLE SELECTION
  // ══════════════════════════════════════

  function selectVariable(varId) {
    if (state.powerOn) togglePower(); // turn off before switching
    state.selectedVar = varId;
    state.dataPoints = [];
    state.hasResult = false;
    state.lastClipCount = 0;
    state.clipsOnNail = [];

    // Update selector UI
    dom.varSelector.querySelectorAll('.var-option').forEach(opt => {
      const isSelected = opt.getAttribute('data-var') === varId;
      opt.classList.toggle('selected', isSelected);
      opt.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    // Update controlled variables
    const meta = EM_DATA.variables[varId];
    dom.controlledList.textContent = meta.controlled.join(', ');

    // Update table header
    dom.thIndependent.textContent = meta.independent;

    // Update graph header
    dom.graphHeader.textContent = `Graph: ${meta.dependent} vs ${meta.independent}`;

    // Clear data table
    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';

    // Clear graph
    gCtx.clearRect(0, 0, dom.graphCanvas.width, dom.graphCanvas.height);

    // Build setup controls
    buildSetupControls(varId);

    // Reset buttons
    dom.btnPickup.disabled = true;
    dom.btnRecord.disabled = true;
    dom.clipCountDisplay.style.display = 'none';
    dom.clipInputGroup.style.display = 'none';
    dom.ammeterValue.textContent = '0.0 A';

    // Reset analysis
    dom.analysisQuestions.innerHTML = '<p class="text-sm text-muted">Complete the experiment to unlock analysis questions.</p>';

    highlightProcedureStep('setup');
    draw();
    toast(`Investigating: ${meta.label}`);
  }

  dom.varSelector.querySelectorAll('.var-option').forEach(opt => {
    opt.addEventListener('click', () => selectVariable(opt.getAttribute('data-var')));
    opt.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectVariable(opt.getAttribute('data-var'));
      }
    });
  });


  // ══════════════════════════════════════
  // SETUP CONTROLS
  // ══════════════════════════════════════

  function buildSetupControls(varId) {
    dom.setupControls.innerHTML = '';

    if (varId === 'coils') {
      const data = EM_DATA.coilData;
      const min = data[0].turns;
      const max = data[data.length - 1].turns;
      state.coilTurns = min;
      dom.setupControls.innerHTML = `
        <div class="config-row">
          <label for="coil-slider">Number of turns</label>
          <input type="range" id="coil-slider" class="slider" min="${min}" max="${max}" step="10" value="${min}">
          <span class="config-value" id="coil-value">${min} turns</span>
        </div>
      `;
      const slider = $('coil-slider');
      const display = $('coil-value');
      slider.addEventListener('input', () => {
        state.coilTurns = parseInt(slider.value);
        display.textContent = state.coilTurns + ' turns';
        if (!state.pickingUp) draw();
      });

    } else if (varId === 'current') {
      const data = EM_DATA.currentData;
      const min = data[0].current;
      const max = data[data.length - 1].current;
      state.currentAmps = min;
      dom.setupControls.innerHTML = `
        <div class="config-row">
          <label for="current-slider">Current (A)</label>
          <input type="range" id="current-slider" class="slider" min="${min}" max="${max}" step="0.5" value="${min}">
          <span class="config-value" id="current-value">${min.toFixed(1)} A</span>
        </div>
      `;
      const slider = $('current-slider');
      const display = $('current-value');
      slider.addEventListener('input', () => {
        state.currentAmps = parseFloat(slider.value);
        display.textContent = state.currentAmps.toFixed(1) + ' A';
        if (state.powerOn) {
          dom.ammeterValue.textContent = state.currentAmps.toFixed(1) + ' A';
        }
        if (!state.pickingUp) draw();
      });

    } else if (varId === 'core') {
      let html = '<div class="config-row"><label>Core material</label>';
      EM_DATA.coreData.forEach((c, i) => {
        const checked = i === 2 ? 'checked' : ''; // default to iron
        html += `
          <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:var(--text-sm);cursor:pointer;">
            <input type="radio" name="core-material" value="${c.material}" ${checked}>
            ${c.label}
          </label>
        `;
      });
      html += '</div>';
      dom.setupControls.innerHTML = html;
      state.coreMaterial = 'iron';

      dom.setupControls.querySelectorAll('input[name="core-material"]').forEach(radio => {
        radio.addEventListener('change', () => {
          state.coreMaterial = radio.value;
          if (!state.pickingUp) draw();
        });
      });
    }
  }


  // ══════════════════════════════════════
  // POWER ON/OFF
  // ══════════════════════════════════════

  function togglePower() {
    state.powerOn = !state.powerOn;
    state.hasResult = false;
    state.lastClipCount = 0;
    state.clipsOnNail = [];
    dom.clipCountDisplay.style.display = 'none';
    dom.clipInputGroup.style.display = 'none';
    dom.btnRecord.disabled = true;

    if (state.powerOn) {
      dom.btnPower.textContent = 'Switch OFF';
      dom.btnPower.classList.remove('btn-primary');
      dom.btnPower.classList.add('btn-danger', 'power-on-glow');
      dom.btnPickup.disabled = false;

      // Show ammeter reading
      const amps = getCurrentAmps();
      dom.ammeterValue.textContent = amps.toFixed(1) + ' A';

      highlightProcedureStep('power');
      startAnimation();
      toast('Power ON — current flowing through coils.');
      if (typeof LabAudio !== 'undefined') LabAudio.click();
    } else {
      dom.btnPower.textContent = 'Switch ON';
      dom.btnPower.classList.remove('btn-danger', 'power-on-glow');
      dom.btnPower.classList.add('btn-primary');
      dom.btnPickup.disabled = true;

      dom.ammeterValue.textContent = '0.0 A';

      stopAnimation();
      draw();
      toast('Power OFF.');
    }
  }

  dom.btnPower.addEventListener('click', togglePower);

  function getCurrentAmps() {
    if (state.selectedVar === 'current') return state.currentAmps;
    return 1.5; // default fixed current
  }

  function getCurrentTurns() {
    if (state.selectedVar === 'coils') return state.coilTurns;
    return 30; // default fixed turns
  }

  function getCurrentCore() {
    if (state.selectedVar === 'core') return state.coreMaterial;
    return 'iron'; // default fixed core
  }


  // ══════════════════════════════════════
  // ANIMATION LOOP (current flow)
  // ══════════════════════════════════════

  function startAnimation() {
    if (state.animId) return;
    function loop() {
      state.animFrame++;
      draw();
      state.animId = requestAnimationFrame(loop);
    }
    state.animId = requestAnimationFrame(loop);
  }

  function stopAnimation() {
    if (state.animId) {
      cancelAnimationFrame(state.animId);
      state.animId = null;
    }
    if (state.pickupAnimId) {
      cancelAnimationFrame(state.pickupAnimId);
      state.pickupAnimId = null;
    }
  }


  // ══════════════════════════════════════
  // PICK UP CLIPS
  // ══════════════════════════════════════

  dom.btnPickup.addEventListener('click', () => {
    if (!state.powerOn || state.pickingUp) return;

    state.pickingUp = true;
    dom.btnPickup.disabled = true;
    highlightProcedureStep('test');

    // Determine clip count from data
    const clipCount = getClipCountForCurrentSetup();
    state.lastClipCount = clipCount;

    // Generate random clip positions around the nail tip
    state.clipsOnNail = [];
    for (let i = 0; i < clipCount; i++) {
      state.clipsOnNail.push({
        offsetX: (Math.random() - 0.5) * 30,
        offsetY: Math.random() * 20 + 10 + i * 4,
        angle: (Math.random() - 0.5) * 0.6,
        progress: 0,
        delay: i * 80,
      });
    }

    // Animate clips attaching over time
    const startTime = performance.now();
    const totalDuration = 1200 + clipCount * 80;

    function animatePickup(now) {
      const elapsed = now - startTime;
      state.clipsOnNail.forEach(clip => {
        const t = Math.max(0, Math.min(1, (elapsed - clip.delay) / 500));
        clip.progress = easeOutBack(t);
      });
      draw();
      if (elapsed < totalDuration) {
        state.pickupAnimId = requestAnimationFrame(animatePickup);
      } else {
        state.pickupAnimId = null;
        finishPickup(clipCount);
      }
    }
    /* Cancel any previous pickup animation */
    if (state.pickupAnimId) cancelAnimationFrame(state.pickupAnimId);
    state.pickupAnimId = requestAnimationFrame(animatePickup);

    toast('Bringing electromagnet near paper clips...');
    if (typeof LabAudio !== 'undefined') LabAudio.click();
  });

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function finishPickup(clipCount) {
    state.pickingUp = false;
    state.hasResult = true;

    if (isGuidedMode()) {
      // Show the clip count directly
      dom.clipCountDisplay.style.display = '';
      dom.clipCountValue.textContent = clipCount;
      dom.clipInputGroup.style.display = 'none';
      dom.btnRecord.disabled = false;
    } else {
      // Independent mode: require manual entry
      dom.clipCountDisplay.style.display = '';
      dom.clipCountValue.textContent = '?';
      dom.clipInputGroup.style.display = '';
      dom.clipInput.value = '';
      dom.clipInput.focus();
      dom.btnRecord.disabled = false;
    }

    highlightProcedureStep('record');
    toast(`Clips picked up! ${isGuidedMode() ? clipCount + ' clips.' : 'Enter your count.'}`, 'success');
    if (typeof LabAudio !== 'undefined') LabAudio.success();
  }

  function getClipCountForCurrentSetup() {
    const varId = state.selectedVar;
    const data = EM_DATA.variables[varId].data;

    if (varId === 'coils') {
      const entry = data.find(d => d.turns === state.coilTurns);
      if (entry) return EM_DATA.getClipCount(entry.clips, entry.noise);
      return 1;

    } else if (varId === 'current') {
      const entry = data.find(d => d.current === state.currentAmps);
      if (entry) return EM_DATA.getClipCount(entry.clips, entry.noise);
      return 1;

    } else if (varId === 'core') {
      const entry = data.find(d => d.material === state.coreMaterial);
      if (entry) return EM_DATA.getClipCount(entry.clips, entry.noise);
      return 1;
    }
    return 1;
  }


  // ══════════════════════════════════════
  // RECORD RESULT
  // ══════════════════════════════════════

  dom.btnRecord.addEventListener('click', () => {
    if (!state.hasResult) return;

    let clips;

    if (!isGuidedMode()) {
      // Independent mode: read from manual input
      const val = parseInt(dom.clipInput.value);
      if (isNaN(val) || val < 0) {
        toast('Please enter a valid clip count.', 'warn');
        return;
      }
      clips = val;
    } else {
      clips = state.lastClipCount;
    }

    // Determine independent variable value and label
    let iv, ivLabel;
    if (state.selectedVar === 'coils') {
      iv = getCurrentTurns();
      ivLabel = iv.toString();
    } else if (state.selectedVar === 'current') {
      iv = getCurrentAmps();
      ivLabel = iv.toFixed(1);
    } else if (state.selectedVar === 'core') {
      iv = getCurrentCore();
      const coreEntry = EM_DATA.coreData.find(d => d.material === iv);
      ivLabel = coreEntry ? coreEntry.label : iv;
    }

    // Check for duplicate IV value
    const isDuplicate = state.dataPoints.some(dp => {
      if (state.selectedVar === 'core') return dp.iv === iv;
      return dp.iv === iv;
    });
    if (isDuplicate) {
      toast('You already have a result for this value. Change the variable first.', 'warn');
      return;
    }

    const dp = { iv, ivLabel, clips };
    state.dataPoints.push(dp);

    // Add to data table
    dom.dataEmpty.style.display = 'none';
    const row = document.createElement('tr');
    row.className = 'animate-fade-in';
    row.innerHTML = `
      <td>${ivLabel}</td>
      <td>${clips}</td>
    `;
    dom.dataTbody.appendChild(row);

    // Reset for next measurement
    state.hasResult = false;
    state.lastClipCount = 0;
    state.clipsOnNail = [];
    dom.clipCountDisplay.style.display = 'none';
    dom.clipInputGroup.style.display = 'none';
    dom.btnRecord.disabled = true;
    dom.btnPickup.disabled = !state.powerOn;

    drawGraph();
    highlightProcedureStep('repeat');
    toast(`Recorded: ${ivLabel} → ${clips} clips`, 'success');

    // Check if all data points collected
    const totalValues = EM_DATA.variables[state.selectedVar].data.length;
    if (state.dataPoints.length >= totalValues) {
      highlightProcedureStep('analyse');
      showAnalysisQuestions();
      toast('All values tested! Check the analysis section.', 'success');
    }

    draw();
  });


  // ══════════════════════════════════════
  // CANVAS DRAWING
  // ══════════════════════════════════════

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const W = dom.canvas.width / dpr;
    const H = dom.canvas.height / dpr;
    ctx.clearRect(0, 0, W, H);

    drawBattery(ctx, W, H);
    drawWires(ctx, W, H);
    drawNailAndCoil(ctx, W, H);
    drawPaperClips(ctx, W, H);
    if (state.powerOn) drawFieldLines(ctx, W, H);
    drawLabels(ctx, W, H);
  }

  // ── Proportional helpers (reference canvas: 620 × 420) ──
  function px(val, W) { return val * (W / 620); }
  function py(val, H) { return val * (H / 420); }

  // ── Battery ──
  function drawBattery(ctx, W, H) {
    const bx = px(80, W), by = H - py(80, H), bw = px(60, W), bh = py(30, H);

    // Battery body
    ctx.fillStyle = '#374151';
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fill();
    ctx.stroke();

    // Battery terminals
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(bx + bw, by + 8, 8, 14);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(bx - 8, by + 8, 8, 14);

    // + / - labels
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+', bx + bw + 4, by - 4);
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('−', bx - 4, by - 4);

    // Voltage label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Battery', bx + bw / 2, by + bh + 16);
  }

  // ── Wires ──
  function drawWires(ctx, W, H) {
    const batteryRight = px(148, W);
    const batteryLeft = px(72, W);
    const batteryY = H - py(65, H);
    const nailLeft = px(220, W);
    const nailRight = px(450, W);
    const nailY = py(180, H);

    ctx.strokeStyle = state.powerOn ? '#ef4444' : '#6b7280';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Right wire: battery + terminal → nail right end
    ctx.beginPath();
    ctx.moveTo(batteryRight, batteryY);
    ctx.lineTo(nailRight + 20, batteryY);
    ctx.lineTo(nailRight + 20, nailY);
    ctx.lineTo(nailRight, nailY);
    ctx.stroke();

    // Left wire: battery - terminal → nail left end
    ctx.strokeStyle = state.powerOn ? '#3b82f6' : '#6b7280';
    ctx.beginPath();
    ctx.moveTo(batteryLeft, batteryY);
    ctx.lineTo(px(40, W), batteryY);
    ctx.lineTo(px(40, W), nailY);
    ctx.lineTo(nailLeft, nailY);
    ctx.stroke();

    // Current flow animation (moving dots)
    if (state.powerOn) {
      const dotSpacing = 20;
      const offset = (state.animFrame * 2) % dotSpacing;

      ctx.fillStyle = '#fbbf24';

      // Right wire path dots (conventional current: + to coil)
      drawCurrentDots(ctx, [
        { x: batteryRight, y: batteryY },
        { x: nailRight + 20, y: batteryY },
        { x: nailRight + 20, y: nailY },
        { x: nailRight, y: nailY },
      ], dotSpacing, offset);

      // Left wire path dots (coil back to -)
      drawCurrentDots(ctx, [
        { x: nailLeft, y: nailY },
        { x: px(40, W), y: nailY },
        { x: px(40, W), y: batteryY },
        { x: batteryLeft, y: batteryY },
      ], dotSpacing, offset);
    }
  }

  function drawCurrentDots(ctx, points, spacing, offset) {
    // Walk along the path and place dots at intervals
    let totalDist = 0;
    const segments = [];
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      segments.push({ start: points[i - 1], end: points[i], len, cumDist: totalDist });
      totalDist += len;
    }

    for (let d = offset; d < totalDist; d += spacing) {
      // Find which segment this distance falls in
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (d >= seg.cumDist && d < seg.cumDist + seg.len) {
          const t = (d - seg.cumDist) / seg.len;
          const x = seg.start.x + (seg.end.x - seg.start.x) * t;
          const y = seg.start.y + (seg.end.y - seg.start.y) * t;
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
  }

  // ── Nail and coil ──
  function drawNailAndCoil(ctx, W, H) {
    const nailX = px(220, W);
    const nailY = py(180, H);
    const nailLen = px(230, W);
    const turns = getCurrentTurns();
    const core = getCurrentCore();

    // Core/nail colors
    const coreColors = {
      iron: { body: '#9ca3af', highlight: '#d1d5db', label: 'Soft iron nail' },
      steel: { body: '#78716c', highlight: '#a8a29e', label: 'Steel nail' },
      air: { body: 'rgba(148,163,184,0.3)', highlight: 'rgba(148,163,184,0.15)', label: 'Air (no core)' },
    };
    const coreStyle = coreColors[core] || coreColors.iron;

    // Draw nail body
    const nailRadius = 8;
    ctx.fillStyle = coreStyle.body;
    ctx.strokeStyle = coreStyle.highlight;
    ctx.lineWidth = 1;

    // Main nail shaft
    ctx.beginPath();
    ctx.moveTo(nailX, nailY - nailRadius);
    ctx.lineTo(nailX + nailLen, nailY - nailRadius);
    // Pointed tip
    ctx.lineTo(nailX + nailLen + 20, nailY);
    ctx.lineTo(nailX + nailLen, nailY + nailRadius);
    ctx.lineTo(nailX, nailY + nailRadius);
    // Flat head
    ctx.lineTo(nailX - 5, nailY + nailRadius + 3);
    ctx.lineTo(nailX - 5, nailY - nailRadius - 3);
    ctx.lineTo(nailX, nailY - nailRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Nail highlight
    ctx.fillStyle = coreStyle.highlight;
    ctx.fillRect(nailX + 10, nailY - nailRadius + 2, nailLen - 20, 3);

    // Draw coil windings
    const coilStart = nailX + 30;
    const coilEnd = nailX + nailLen - 30;
    const coilWidth = coilEnd - coilStart;
    const turnSpacing = Math.min(coilWidth / turns, 12);
    const coilRadius = 18;

    ctx.strokeStyle = state.powerOn ? '#f59e0b' : '#a16207';
    ctx.lineWidth = 2.5;

    for (let i = 0; i < turns; i++) {
      const x = coilStart + i * turnSpacing + turnSpacing / 2;
      // Draw each turn as an ellipse around the nail
      ctx.beginPath();
      ctx.ellipse(x, nailY, turnSpacing * 0.35, coilRadius, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Coil glow when powered
    if (state.powerOn) {
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
      ctx.lineWidth = 4;
      for (let i = 0; i < turns; i++) {
        const x = coilStart + i * turnSpacing + turnSpacing / 2;
        ctx.beginPath();
        ctx.ellipse(x, nailY, turnSpacing * 0.35, coilRadius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }

  // ── Paper clips (scattered on bench and attached to nail) ──
  function drawPaperClips(ctx, W, H) {
    const tipX = px(470, W);
    const tipY = py(180, H);

    // Draw scattered clips on the bench (below the nail)
    if (!state.hasResult && state.clipsOnNail.length === 0) {
      const scatterY = py(280, H);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 15; i++) {
        const cx = tipX - 40 + (i % 5) * 20 + Math.sin(i * 3.7) * 8;
        const cy = scatterY + Math.floor(i / 5) * 18 + Math.cos(i * 2.3) * 5;
        const angle = Math.sin(i * 1.9) * 0.5;
        drawSingleClip(ctx, cx, cy, angle, '#94a3b8');
      }
    }

    // Draw clips stuck to nail tip
    state.clipsOnNail.forEach(clip => {
      if (clip.progress > 0) {
        const cx = tipX + clip.offsetX;
        const cy = tipY + clip.offsetY * clip.progress;
        ctx.globalAlpha = Math.min(1, clip.progress);
        drawSingleClip(ctx, cx, cy, clip.angle, '#d4d7e0');
        ctx.globalAlpha = 1;
      }
    });

    // Clips remaining on bench when some are picked up
    if (state.hasResult || state.clipsOnNail.length > 0) {
      const remaining = 15 - state.lastClipCount;
      const scatterY = py(280, H);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < Math.max(0, remaining); i++) {
        const cx = tipX - 40 + (i % 5) * 20 + Math.sin(i * 3.7) * 8;
        const cy = scatterY + Math.floor(i / 5) * 18 + Math.cos(i * 2.3) * 5;
        const angle = Math.sin(i * 1.9) * 0.5;
        drawSingleClip(ctx, cx, cy, angle, '#64748b');
      }
    }
  }

  function drawSingleClip(ctx, x, y, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Simple paper clip shape
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(6, -8);
    ctx.lineTo(6, 8);
    ctx.lineTo(-3, 8);
    ctx.lineTo(-3, -4);
    ctx.lineTo(3, -4);
    ctx.stroke();

    ctx.restore();
  }

  // ── Magnetic field lines ──
  function drawFieldLines(ctx, W, H) {
    const nailCx = px(335, W);
    const nailCy = py(180, H);
    const pulsePhase = (state.animFrame % 120) / 120;

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 1;

    // Draw concentric field ovals around the coil
    for (let i = 1; i <= 4; i++) {
      const rx = 40 + i * 30;
      const ry = 15 + i * 15;
      const alpha = 0.08 + 0.07 * Math.sin(pulsePhase * Math.PI * 2 + i * 0.8);
      ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(nailCx, nailCy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // N and S pole labels
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.fillText('N', px(500, W), py(170, H));
    ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.fillText('S', px(210, W), py(170, H));
  }

  // ── Labels ──
  function drawLabels(ctx, W, H) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';

    const core = getCurrentCore();
    const coreEntry = EM_DATA.coreData.find(d => d.material === core);
    const coreLabel = coreEntry ? coreEntry.label : core;

    // Core label
    ctx.fillText(coreLabel, 335, 220);

    // Turns label
    ctx.fillText(getCurrentTurns() + ' turns', 335, 236);

    // Status text at bottom
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'center';
    if (!state.powerOn) {
      ctx.fillText('Click "Switch ON" to power the electromagnet', W / 2, H - 15);
    } else if (!state.hasResult && !state.pickingUp) {
      ctx.fillText('Click "Pick Up Clips" to test the electromagnet strength', W / 2, H - 15);
    } else if (state.hasResult) {
      ctx.fillText('Record the result, then change the variable for the next test', W / 2, H - 15);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }


  // ══════════════════════════════════════
  // GRAPH (clips vs independent variable)
  // ══════════════════════════════════════

  function drawGraph() {
    const W = dom.graphCanvas.width;
    const H = dom.graphCanvas.height;
    const pad = { top: 20, right: 15, bottom: 35, left: 45 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    gCtx.clearRect(0, 0, W, H);

    if (state.dataPoints.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const axisColor = isDark ? '#9ca3af' : '#374151';
    const gridColor = isDark ? '#4b5563' : '#e5e7eb';
    const labelColor = isDark ? '#d1d5db' : '#6b7280';

    const meta = EM_DATA.variables[state.selectedVar];
    const isCategorical = (state.selectedVar === 'core');

    if (isCategorical) {
      drawBarChart(W, H, pad, plotW, plotH, axisColor, gridColor, labelColor, meta);
    } else {
      drawScatterPlot(W, H, pad, plotW, plotH, axisColor, gridColor, labelColor, meta);
    }
  }

  function drawScatterPlot(W, H, pad, plotW, plotH, axisColor, gridColor, labelColor, meta) {
    // Determine axis ranges
    const xVals = state.dataPoints.map(d => typeof d.iv === 'number' ? d.iv : 0);
    const yVals = state.dataPoints.map(d => d.clips);
    const maxX = Math.max(...xVals) * 1.15;
    const maxY = Math.max(...yVals) * 1.25;

    // Axes
    gCtx.strokeStyle = axisColor;
    gCtx.lineWidth = 1;
    gCtx.beginPath();
    gCtx.moveTo(pad.left, pad.top);
    gCtx.lineTo(pad.left, H - pad.bottom);
    gCtx.stroke();
    gCtx.beginPath();
    gCtx.moveTo(pad.left, H - pad.bottom);
    gCtx.lineTo(W - pad.right, H - pad.bottom);
    gCtx.stroke();

    // Grid
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

    // Axis labels
    gCtx.fillStyle = labelColor;
    gCtx.font = '9px Inter, sans-serif';
    gCtx.textAlign = 'center';
    gCtx.fillText(meta.independent, W / 2, H - 5);
    gCtx.save();
    gCtx.translate(12, pad.top + plotH / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText(meta.dependent, 0, 0);
    gCtx.restore();

    // Tick labels
    gCtx.fillStyle = labelColor;
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const val = (maxX * i / 5).toFixed(state.selectedVar === 'current' ? 1 : 0);
      const x = pad.left + (plotW * i / 5);
      gCtx.fillText(val, x, H - pad.bottom + 4);
    }
    gCtx.textAlign = 'right';
    gCtx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const val = (maxY * (5 - i) / 5).toFixed(0);
      const y = pad.top + (plotH * i / 5);
      gCtx.fillText(val, pad.left - 5, y);
    }

    // Data points
    const toX = v => pad.left + (v / maxX) * plotW;
    const toY = v => pad.top + plotH - (v / maxY) * plotH;

    gCtx.fillStyle = '#f77f00';
    state.dataPoints.forEach(d => {
      const x = toX(d.iv);
      const y = toY(d.clips);
      gCtx.beginPath();
      gCtx.arc(x, y, 4, 0, Math.PI * 2);
      gCtx.fill();
    });

    // Best-fit line (if 2+ points)
    if (state.dataPoints.length >= 2) {
      const n = state.dataPoints.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      state.dataPoints.forEach(d => {
        sumX += d.iv;
        sumY += d.clips;
        sumXY += d.iv * d.clips;
        sumX2 += d.iv * d.iv;
      });
      const gradient = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - gradient * sumX) / n;

      gCtx.strokeStyle = '#f77f00';
      gCtx.lineWidth = 1.5;
      gCtx.setLineDash([4, 3]);
      gCtx.beginPath();
      gCtx.moveTo(toX(0), toY(intercept));
      gCtx.lineTo(toX(maxX), toY(gradient * maxX + intercept));
      gCtx.stroke();
      gCtx.setLineDash([]);
    }
  }

  function drawBarChart(W, H, pad, plotW, plotH, axisColor, gridColor, labelColor, meta) {
    // Axes
    gCtx.strokeStyle = axisColor;
    gCtx.lineWidth = 1;
    gCtx.beginPath();
    gCtx.moveTo(pad.left, pad.top);
    gCtx.lineTo(pad.left, H - pad.bottom);
    gCtx.stroke();
    gCtx.beginPath();
    gCtx.moveTo(pad.left, H - pad.bottom);
    gCtx.lineTo(W - pad.right, H - pad.bottom);
    gCtx.stroke();

    const maxY = Math.max(...state.dataPoints.map(d => d.clips)) * 1.25;
    const barCount = state.dataPoints.length;
    const barWidth = Math.min(plotW / barCount * 0.6, 50);
    const gap = (plotW - barWidth * barCount) / (barCount + 1);

    // Grid lines
    gCtx.strokeStyle = gridColor;
    gCtx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const y = pad.top + (plotH * i / 5);
      gCtx.beginPath();
      gCtx.moveTo(pad.left, y);
      gCtx.lineTo(W - pad.right, y);
      gCtx.stroke();
    }

    // Y axis label
    gCtx.fillStyle = labelColor;
    gCtx.font = '9px Inter, sans-serif';
    gCtx.save();
    gCtx.translate(12, pad.top + plotH / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.textAlign = 'center';
    gCtx.fillText(meta.dependent, 0, 0);
    gCtx.restore();

    // Y tick labels
    gCtx.textAlign = 'right';
    gCtx.textBaseline = 'middle';
    gCtx.fillStyle = labelColor;
    for (let i = 0; i <= 5; i++) {
      const val = (maxY * (5 - i) / 5).toFixed(0);
      const y = pad.top + (plotH * i / 5);
      gCtx.fillText(val, pad.left - 5, y);
    }

    // Bars
    const barColors = ['#94a3b8', '#78716c', '#6b7280'];
    state.dataPoints.forEach((d, i) => {
      const x = pad.left + gap + i * (barWidth + gap);
      const barH = (d.clips / maxY) * plotH;
      const y = H - pad.bottom - barH;

      // Find color from core data if available
      const coreEntry = EM_DATA.coreData.find(c => c.material === d.iv);
      gCtx.fillStyle = coreEntry ? coreEntry.color : (barColors[i % barColors.length]);
      gCtx.fillRect(x, y, barWidth, barH);

      // Value label on top of bar
      gCtx.fillStyle = labelColor;
      gCtx.font = '10px Inter, sans-serif';
      gCtx.textAlign = 'center';
      gCtx.fillText(d.clips, x + barWidth / 2, y - 5);

      // Category label below
      gCtx.fillStyle = labelColor;
      gCtx.font = '8px Inter, sans-serif';
      gCtx.textAlign = 'center';
      // Truncate label for bar chart
      const shortLabel = d.ivLabel.length > 10 ? d.ivLabel.substring(0, 10) + '...' : d.ivLabel;
      gCtx.fillText(shortLabel, x + barWidth / 2, H - pad.bottom + 10);
    });
  }


  // ══════════════════════════════════════
  // ANALYSIS QUESTIONS
  // ══════════════════════════════════════

  function showAnalysisQuestions() {
    const questions = EM_DATA.analysisQuestions[state.selectedVar];
    if (!questions || questions.length === 0) return;

    dom.analysisQuestions.innerHTML = '';

    questions.forEach(q => {
      const div = document.createElement('div');
      div.className = 'analysis-question';
      div.innerHTML = `
        <div class="analysis-question-text">
          ${q.question}
          <span class="marks-badge">${q.marks} mark${q.marks > 1 ? 's' : ''}</span>
        </div>
        <textarea class="analysis-answer" id="${q.id}" rows="3"
                  placeholder="Type your answer here..."></textarea>
        <div class="analysis-reveal">
          <button class="btn btn-ghost btn-sm" data-reveal="${q.id}">Show model answer</button>
          <div class="model-answer" id="model-${q.id}" style="display:none;">
            ${q.modelAnswer}
          </div>
        </div>
      `;
      dom.analysisQuestions.appendChild(div);
    });

    // Reveal buttons
    dom.analysisQuestions.querySelectorAll('[data-reveal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modelDiv = $('model-' + btn.getAttribute('data-reveal'));
        if (modelDiv) {
          const isHidden = modelDiv.style.display === 'none';
          modelDiv.style.display = isHidden ? '' : 'none';
          btn.textContent = isHidden ? 'Hide model answer' : 'Show model answer';
        }
      });
    });
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    // Turn off power if on
    if (state.powerOn) togglePower();

    // Reset state
    state.dataPoints = [];
    state.hasResult = false;
    state.lastClipCount = 0;
    state.clipsOnNail = [];
    state.animFrame = 0;

    // Reset UI
    dom.ammeterValue.textContent = '0.0 A';
    dom.btnPower.textContent = 'Switch ON';
    dom.btnPower.classList.remove('btn-danger', 'power-on-glow');
    dom.btnPower.classList.add('btn-primary');
    dom.btnPickup.disabled = true;
    dom.btnRecord.disabled = true;
    dom.clipCountDisplay.style.display = 'none';
    dom.clipInputGroup.style.display = 'none';

    // Clear data table
    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';

    // Clear graph
    gCtx.clearRect(0, 0, dom.graphCanvas.width, dom.graphCanvas.height);

    // Reset analysis
    dom.analysisQuestions.innerHTML = '<p class="text-sm text-muted">Complete the experiment to unlock analysis questions.</p>';

    // Reset procedure
    highlightProcedureStep('select');

    // Rebuild setup controls
    buildSetupControls(state.selectedVar);

    draw();
    toast('Experiment reset. Choose a variable to investigate.');
  });


  // ══════════════════════════════════════
  // GUIDE TOGGLE
  // ══════════════════════════════════════

  dom.btnToggleGuide.addEventListener('click', () => {
    const visible = dom.guidePanel.style.display !== 'none';
    dom.guidePanel.style.display = visible ? 'none' : '';
  });


  // ══════════════════════════════════════
  // INITIALISE
  // ══════════════════════════════════════

  // ══════════════════════════════════════
  // CANVAS RESIZE
  // ══════════════════════════════════════

  function resizeCanvas() {
    const parent = dom.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(parent.clientWidth - 16, 620);
    const h = Math.round(w * (420 / 620));
    const needsUpdate = dom.canvas.width !== Math.round(w * dpr) || dom.canvas.height !== Math.round(h * dpr);
    if (needsUpdate) {
      dom.canvas.width = w * dpr;
      dom.canvas.height = h * dpr;
      dom.canvas.style.width = w + 'px';
      dom.canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
  }

  window.addEventListener('resize', resizeCanvas);


  // ══════════════════════════════════════
  // INITIALISE
  // ══════════════════════════════════════

  selectVariable('coils');
  resizeCanvas();
  draw();

});
