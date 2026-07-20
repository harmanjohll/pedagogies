/* ============================================================
   Photosynthesis Practical — Biology Simulation
   Canvas-based pondweed bubble counting with data collection
   and graphing for light distance & CO2 concentration
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Constants ──
  const TIMER_DURATION = 60; // 1 minute in seconds

  // ── State ──
  const state = {
    variable: 'light',          // 'light' or 'co2'
    distance: 10,               // lamp distance in cm
    co2Conc: 0,                 // NaHCO3 concentration (% w/v)
    speed: 1,                   // time acceleration factor

    // Counting
    counting: false,
    timerStart: 0,
    timerElapsed: 0,            // real seconds elapsed
    simElapsed: 0,              // simulated seconds elapsed
    bubbleCount: 0,
    bubbleRate: 0,              // bubbles per sim-minute
    lastBubbleTime: 0,          // last time a bubble was spawned (sim-seconds)

    // Bubbles for canvas animation
    bubbles: [],                // [{x, y, size, opacity, drift, speed}]

    // Recording
    lastCountedValue: null,     // the value (distance or conc) that was just counted
    lastBubbleResult: 0,        // the bubble count from the last run

    // Data
    lightData: [],              // [{distance, bubbles}]
    co2Data: [],                // [{conc, bubbles}]
    completedLight: new Set(),
    completedCO2: new Set(),

    // Procedure
    currentStep: 0,
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('main-canvas'),
    equationDisplay: $('equation-display'),
    btnVarLight: $('btn-var-light'),
    btnVarCO2: $('btn-var-co2'),
    lightControls: $('light-controls'),
    co2Controls: $('co2-controls'),
    distanceSlider: $('distance-slider'),
    distanceDisplay: $('distance-display'),
    distancePresets: $('distance-presets'),
    co2Presets: $('co2-presets'),
    btnCount: $('btn-count'),
    btnStop: $('btn-stop'),
    btnRecord: $('btn-record'),
    counterValue: $('counter-value'),
    timerBar: $('timer-bar'),
    timerTime: $('timer-time'),
    timerFill: $('timer-fill'),
    resultsThead: $('results-thead'),
    resultsTbody: $('results-tbody'),
    dataEmpty: $('data-empty'),
    graphCanvas: $('graph-canvas'),
    graphEmpty: $('graph-empty'),
    analysisPanel: $('analysis-panel'),
    procedureList: $('procedure-list'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel: $('guide-panel'),
    toast: $('toast-container'),
  };

  const ctx = dom.canvas.getContext('2d');
  const gCtx = dom.graphCanvas.getContext('2d');

  // Speed buttons
  const speedBtns = {
    1: $('btn-speed-1'),
    10: $('btn-speed-10'),
    30: $('btn-speed-30'),
  };


  // ══════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════

  function init() {
    dom.equationDisplay.textContent = PHOTO_DATA.equation;
    buildDistancePresets();
    buildCO2Presets();
    buildProcedureList();
    buildAnalysisQuestions();
    updateTableHeaders();
    resizeCanvas();
    draw();

    if (typeof LabRecordMode !== 'undefined') {
      LabRecordMode.inject('#record-mode-slot');
    }
  }

  // ── Canvas sizing ──
  function resizeCanvas() {
    const panel = dom.canvas.parentElement;
    const w = Math.min(panel.clientWidth - 32, 700);
    const h = Math.min(panel.clientHeight - 180, 420);
    dom.canvas.width = w;
    dom.canvas.height = h;
  }
  window.addEventListener('resize', () => {
    resizeCanvas();
    if (!state.counting) draw();
  });


  // ══════════════════════════════════════
  // PRESET BUTTONS
  // ══════════════════════════════════════

  function buildDistancePresets() {
    dom.distancePresets.innerHTML = '';
    PHOTO_DATA.lightDistances.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'value-btn';
      btn.textContent = d + ' cm';
      btn.dataset.value = d;
      if (d === state.distance) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        if (state.counting) return;
        state.distance = d;
        dom.distanceSlider.value = d;
        dom.distanceDisplay.textContent = d + ' cm';
        updateDistancePresetSelection();
        draw();
      });
      dom.distancePresets.appendChild(btn);
    });
  }

  function updateDistancePresetSelection() {
    dom.distancePresets.querySelectorAll('.value-btn').forEach(btn => {
      const v = parseInt(btn.dataset.value);
      btn.classList.toggle('selected', v === state.distance);
      btn.classList.toggle('done', state.completedLight.has(v));
    });
  }

  function buildCO2Presets() {
    dom.co2Presets.innerHTML = '';
    PHOTO_DATA.co2Concentrations.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'value-btn';
      btn.textContent = c + '%';
      btn.dataset.value = c;
      if (c === state.co2Conc) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        if (state.counting) return;
        state.co2Conc = c;
        updateCO2PresetSelection();
        draw();
      });
      dom.co2Presets.appendChild(btn);
    });
  }

  function updateCO2PresetSelection() {
    dom.co2Presets.querySelectorAll('.value-btn').forEach(btn => {
      const v = parseFloat(btn.dataset.value);
      btn.classList.toggle('selected', v === state.co2Conc);
      btn.classList.toggle('done', state.completedCO2.has(v));
    });
  }


  // ══════════════════════════════════════
  // VARIABLE SWITCHING
  // ══════════════════════════════════════

  dom.btnVarLight.addEventListener('click', () => switchVariable('light'));
  dom.btnVarCO2.addEventListener('click', () => switchVariable('co2'));

  function switchVariable(v) {
    if (state.counting) return;
    state.variable = v;
    dom.btnVarLight.classList.toggle('selected', v === 'light');
    dom.btnVarCO2.classList.toggle('selected', v === 'co2');
    dom.lightControls.style.display = v === 'light' ? '' : 'none';
    dom.co2Controls.style.display = v === 'co2' ? '' : 'none';
    updateTableHeaders();
    renderResultsTable();
    buildAnalysisQuestions();
    drawGraph();
    draw();
    toast('Switched to ' + (v === 'light' ? 'light distance' : 'CO\u2082 concentration') + ' investigation.');
  }

  function updateTableHeaders() {
    if (state.variable === 'light') {
      dom.resultsThead.innerHTML = '<tr><th>Distance / cm</th><th>Bubbles / min</th></tr>';
    } else {
      dom.resultsThead.innerHTML = '<tr><th>NaHCO\u2083 / %</th><th>Bubbles / min</th></tr>';
    }
  }


  // ══════════════════════════════════════
  // SLIDER
  // ══════════════════════════════════════

  dom.distanceSlider.addEventListener('input', () => {
    if (state.counting) return;
    state.distance = parseInt(dom.distanceSlider.value);
    dom.distanceDisplay.textContent = state.distance + ' cm';
    updateDistancePresetSelection();
    draw();
  });


  // ══════════════════════════════════════
  // SPEED CONTROL
  // ══════════════════════════════════════

  Object.keys(speedBtns).forEach(s => {
    speedBtns[s].addEventListener('click', () => {
      state.speed = parseInt(s);
      Object.keys(speedBtns).forEach(k => {
        speedBtns[k].classList.toggle('selected', parseInt(k) === state.speed);
      });
    });
  });


  // ══════════════════════════════════════
  // COUNTING / TIMER
  // ══════════════════════════════════════

  dom.btnCount.addEventListener('click', startCounting);
  dom.btnStop.addEventListener('click', stopCounting);
  dom.btnRecord.addEventListener('click', recordResult);

  function startCounting() {
    if (state.counting) return;

    // Determine bubble rate from data model
    if (state.variable === 'light') {
      state.bubbleRate = PHOTO_DATA.lightRate(state.distance);
    } else {
      state.bubbleRate = PHOTO_DATA.co2Rate(state.co2Conc);
    }

    state.counting = true;
    state.timerStart = performance.now();
    state.timerElapsed = 0;
    state.simElapsed = 0;
    state.bubbleCount = 0;
    state.lastBubbleTime = 0;
    state.bubbles = [];
    state.lastCountedValue = null;

    dom.counterValue.textContent = '0';
    dom.timerTime.textContent = '0:00';
    dom.timerFill.style.width = '0%';
    dom.timerBar.classList.add('active');
    dom.timerFill.classList.add('pulsing');

    dom.btnCount.disabled = true;
    dom.btnStop.disabled = false;
    dom.btnRecord.disabled = true;
    dom.distanceSlider.disabled = true;

    // Disable variable switching during counting
    dom.btnVarLight.disabled = true;
    dom.btnVarCO2.disabled = true;

    setStep(3); // "Count bubbles for 1 minute"
    lastFrameTime = 0;
    requestAnimationFrame(animate);

    toast('Counting bubbles... (' + state.bubbleRate + ' expected/min)');
    if (typeof LabAudio !== 'undefined') LabAudio.click();
  }

  function stopCounting() {
    state.counting = false;

    dom.timerBar.classList.remove('active');
    dom.timerFill.classList.remove('pulsing');
    dom.btnCount.disabled = false;
    dom.btnStop.disabled = true;
    dom.btnRecord.disabled = false;
    dom.distanceSlider.disabled = false;
    dom.btnVarLight.disabled = false;
    dom.btnVarCO2.disabled = false;

    // Store what was just counted
    if (state.variable === 'light') {
      state.lastCountedValue = state.distance;
    } else {
      state.lastCountedValue = state.co2Conc;
    }
    state.lastBubbleResult = state.bubbleCount;

    setStep(4); // "Record your result"
    toast('Counted ' + state.bubbleCount + ' bubbles. Click "Record Result" to save.', 'success');
    if (typeof LabAudio !== 'undefined') LabAudio.success();
  }

  function timerComplete() {
    stopCounting();
    dom.timerFill.style.width = '100%';
    toast('1 minute complete! ' + state.bubbleCount + ' bubbles counted.', 'success');
  }


  // ══════════════════════════════════════
  // RECORDING
  // ══════════════════════════════════════

  function recordResult() {
    if (state.lastCountedValue === null) return;

    let value, count;

    // In independent mode, prompt for manual entry
    if (typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided()) {
      const userCount = prompt('Enter the number of bubbles you counted:');
      if (userCount === null) return;
      count = parseInt(userCount);
      if (isNaN(count) || count < 0) {
        toast('Please enter a valid positive number.', 'warn');
        return;
      }
    } else {
      count = state.lastBubbleResult;
    }

    value = state.lastCountedValue;

    if (state.variable === 'light') {
      // Replace existing entry for same distance or add new
      const existing = state.lightData.findIndex(d => d.distance === value);
      if (existing >= 0) {
        state.lightData[existing].bubbles = count;
      } else {
        state.lightData.push({ distance: value, bubbles: count });
        state.lightData.sort((a, b) => a.distance - b.distance);
      }
      state.completedLight.add(value);
      updateDistancePresetSelection();
    } else {
      const existing = state.co2Data.findIndex(d => d.conc === value);
      if (existing >= 0) {
        state.co2Data[existing].bubbles = count;
      } else {
        state.co2Data.push({ conc: value, bubbles: count });
        state.co2Data.sort((a, b) => a.conc - b.conc);
      }
      state.completedCO2.add(value);
      updateCO2PresetSelection();
    }

    state.lastCountedValue = null;
    dom.btnRecord.disabled = true;

    renderResultsTable();
    drawGraph();
    setStep(5); // "Change variable & repeat"

    const label = state.variable === 'light'
      ? value + ' cm'
      : value + '% NaHCO\u2083';
    toast('Recorded: ' + label + ' = ' + count + ' bubbles/min', 'success');
    if (typeof LabAudio !== 'undefined') LabAudio.success();
  }


  // ══════════════════════════════════════
  // RESULTS TABLE
  // ══════════════════════════════════════

  function renderResultsTable() {
    dom.resultsTbody.innerHTML = '';
    const data = state.variable === 'light' ? state.lightData : state.co2Data;

    if (data.length === 0) {
      dom.dataEmpty.style.display = '';
      return;
    }
    dom.dataEmpty.style.display = 'none';

    data.forEach(dp => {
      const row = document.createElement('tr');
      row.className = 'animate-fade-in completed-row';
      if (state.variable === 'light') {
        row.innerHTML = '<td>' + dp.distance + '</td><td>' + dp.bubbles + '</td>';
      } else {
        row.innerHTML = '<td>' + dp.conc + '</td><td>' + dp.bubbles + '</td>';
      }
      dom.resultsTbody.appendChild(row);
    });
  }


  // ══════════════════════════════════════
  // ANIMATION LOOP
  // ══════════════════════════════════════

  let lastFrameTime = 0;

  function animate(timestamp) {
    if (!state.counting) {
      draw();
      return;
    }

    if (!lastFrameTime) lastFrameTime = timestamp;
    const realDt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    // Advance simulated time
    const simDt = realDt * state.speed;
    state.simElapsed += simDt;
    state.timerElapsed = state.simElapsed;

    // Update timer display
    const displaySec = Math.min(state.simElapsed, TIMER_DURATION);
    const mins = Math.floor(displaySec / 60);
    const secs = Math.floor(displaySec % 60);
    dom.timerTime.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    dom.timerFill.style.width = Math.min(100, (state.simElapsed / TIMER_DURATION) * 100) + '%';

    // Spawn bubbles based on rate (guard against zero rate)
    if (state.bubbleRate > 0) {
      const bubbleInterval = 60 / state.bubbleRate; // seconds between bubbles (sim time)
      while (state.lastBubbleTime + bubbleInterval <= state.simElapsed && state.simElapsed <= TIMER_DURATION) {
        state.lastBubbleTime += bubbleInterval;
        state.bubbleCount++;
        dom.counterValue.textContent = state.bubbleCount;
        spawnBubble();
      }
    }

    // Update bubble positions
    updateBubbles(realDt);

    // Check if timer is done
    if (state.simElapsed >= TIMER_DURATION) {
      timerComplete();
    }

    draw();

    if (state.counting) {
      requestAnimationFrame(animate);
    }
  }

  function spawnBubble() {
    const W = dom.canvas.width;
    const H = dom.canvas.height;
    const beakerCX = W * 0.6;
    const beakerBottom = H - 50;
    const pondweedTopY = beakerBottom - 100;

    state.bubbles.push({
      x: beakerCX + (Math.random() - 0.5) * 6,
      y: pondweedTopY,
      size: 3 + Math.random() * 4,
      opacity: 0.8 + Math.random() * 0.2,
      drift: (Math.random() - 0.5) * 0.6,
      speed: 40 + Math.random() * 30,
      age: 0,
    });
  }

  function updateBubbles(dt) {
    for (let i = state.bubbles.length - 1; i >= 0; i--) {
      const b = state.bubbles[i];
      b.age += dt;
      b.y -= b.speed * dt;
      b.x += b.drift;
      b.opacity -= dt * 0.3;
      if (b.opacity <= 0 || b.y < 30) {
        state.bubbles.splice(i, 1);
      }
    }
  }


  // ══════════════════════════════════════
  // CANVAS DRAWING
  // ══════════════════════════════════════

  function draw() {
    const W = dom.canvas.width;
    const H = dom.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Layout positions
    const beakerCX = W * 0.6;
    const beakerW = 100;
    const beakerH = 140;
    const beakerLeft = beakerCX - beakerW / 2;
    const beakerBottom = H - 40;
    const beakerTop = beakerBottom - beakerH;
    const waterTop = beakerTop + beakerH * 0.18;

    // Lamp position based on distance
    const pixelsPerCm = 4;
    const lampX = beakerLeft - state.distance * pixelsPerCm;
    const lampY = beakerTop + beakerH / 2;

    // ── Bench surface ──
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, beakerBottom, W, H - beakerBottom);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, beakerBottom);
    ctx.lineTo(W, beakerBottom);
    ctx.stroke();

    // ── Lamp glow cone ──
    if (state.variable === 'light') {
      const glowIntensity = Math.min(0.15, 0.8 / (state.distance / 5));
      const grad = ctx.createRadialGradient(
        lampX + 22, lampY, 5,
        lampX + 22, lampY, state.distance * pixelsPerCm + 40
      );
      grad.addColorStop(0, 'rgba(255, 235, 120, ' + glowIntensity + ')');
      grad.addColorStop(0.5, 'rgba(255, 235, 120, ' + (glowIntensity * 0.3) + ')');
      grad.addColorStop(1, 'rgba(255, 235, 120, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(lampX + 22, lampY - 25);
      ctx.lineTo(beakerLeft + 10, beakerTop - 10);
      ctx.lineTo(beakerLeft + 10, beakerBottom + 10);
      ctx.lineTo(lampX + 22, lampY + 25);
      ctx.closePath();
      ctx.fill();
    }

    // ── Lamp ──
    drawLamp(lampX, lampY);

    // ── Ruler between lamp and beaker ──
    drawRuler(lampX + 44, beakerLeft, lampY + 50);

    // ── Beaker ──
    drawBeaker(beakerLeft, beakerTop, beakerW, beakerH, waterTop, beakerBottom);

    // ── Pondweed ──
    drawPondweed(beakerCX, beakerBottom);

    // ── Bubbles ──
    drawBubbles();

    // ── Info text ──
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (!state.counting && state.lastCountedValue === null) {
      ctx.fillText('Set your variable and click "Count Bubbles" to begin', W / 2, H - 10);
    } else if (state.counting) {
      ctx.fillText('Counting oxygen bubbles from pondweed cut end...', W / 2, H - 10);
    }
  }

  function drawLamp(x, y) {
    // Lamp base
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(x - 2, y + 18, 48, 8);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(x + 18, y + 10, 8, 12);

    // Lamp head (bulb)
    const headX = x + 22;
    const headY = y;
    const radius = 18;
    const brightness = Math.min(1, 10 / state.distance);

    const grad = ctx.createRadialGradient(headX - 3, headY - 3, 2, headX, headY, radius);
    grad.addColorStop(0, 'rgba(255, 251, 230, ' + (0.6 + brightness * 0.4) + ')');
    grad.addColorStop(0.4, 'rgba(255, 213, 79, ' + (0.5 + brightness * 0.3) + ')');
    grad.addColorStop(0.7, 'rgba(249, 168, 37, ' + (0.3 + brightness * 0.2) + ')');
    grad.addColorStop(1, 'rgba(230, 81, 0, ' + (0.2 + brightness * 0.1) + ')');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(headX, headY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.shadowColor = 'rgba(255, 213, 79, ' + brightness * 0.6 + ')';
    ctx.shadowBlur = 15 + brightness * 20;
    ctx.beginPath();
    ctx.arc(headX, headY, radius - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Lamp label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LAMP', headX, y + 36);
  }

  function drawRuler(x1, x2, y) {
    if (x2 <= x1) return;
    // Ruler bar
    ctx.fillStyle = 'rgba(255, 220, 100, 0.15)';
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.25)';
    ctx.lineWidth = 1;
    ctx.fillRect(x1, y - 6, x2 - x1, 12);
    ctx.strokeRect(x1, y - 6, x2 - x1, 12);

    // End caps
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.4)';
    ctx.beginPath();
    ctx.moveTo(x1, y - 10);
    ctx.lineTo(x1, y + 10);
    ctx.moveTo(x2, y - 10);
    ctx.lineTo(x2, y + 10);
    ctx.stroke();

    // Distance label
    ctx.fillStyle = 'rgba(255, 220, 100, 0.8)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.distance + ' cm', (x1 + x2) / 2, y + 4);
  }

  function drawBeaker(left, top, w, h, waterTop, bottom) {
    // Glass body
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.quadraticCurveTo(left, bottom + 8, left + 10, bottom + 8);
    ctx.lineTo(left + w - 10, bottom + 8);
    ctx.quadraticCurveTo(left + w, bottom + 8, left + w, bottom);
    ctx.lineTo(left + w, top);
    ctx.stroke();

    // Rim
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left - 4, top);
    ctx.lineTo(left + w + 4, top);
    ctx.stroke();

    // Water
    let waterColor;
    if (state.variable === 'co2') {
      const alpha = 0.15 + state.co2Conc * 0.03;
      const green = Math.min(255, 200 + state.co2Conc * 10);
      waterColor = 'rgba(150, ' + green + ', 255, ' + alpha + ')';
    } else {
      waterColor = 'rgba(150, 200, 255, 0.15)';
    }

    ctx.fillStyle = waterColor;
    ctx.beginPath();
    ctx.moveTo(left + 2, waterTop);
    // Meniscus
    ctx.quadraticCurveTo(left + w / 2, waterTop + 4, left + w - 2, waterTop);
    ctx.lineTo(left + w - 2, bottom);
    ctx.quadraticCurveTo(left + w - 2, bottom + 6, left + w - 10, bottom + 6);
    ctx.lineTo(left + 10, bottom + 6);
    ctx.quadraticCurveTo(left + 2, bottom + 6, left + 2, bottom);
    ctx.closePath();
    ctx.fill();

    // Glass highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(left + 6, waterTop + 8, 3, (bottom - waterTop) * 0.6);

    // Beaker label
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (state.variable === 'co2') {
      ctx.fillText('NaHCO\u2083 ' + state.co2Conc + '%', left + w / 2, bottom + 22);
    } else {
      ctx.fillText('Water + NaHCO\u2083', left + w / 2, bottom + 22);
    }
  }

  function drawPondweed(cx, beakerBottom) {
    const stemHeight = 70;
    const stemBottom = beakerBottom - 12;
    const stemTop = stemBottom - stemHeight;
    const stemWidth = 5;

    // Stem
    const stemGrad = ctx.createLinearGradient(cx, stemTop, cx, stemBottom);
    stemGrad.addColorStop(0, '#4caf50');
    stemGrad.addColorStop(1, '#2e7d32');
    ctx.fillStyle = stemGrad;
    ctx.fillRect(cx - stemWidth / 2, stemTop, stemWidth, stemHeight);

    // Leaves
    const leafPositions = [
      { y: stemTop + 10, side: -1, angle: -0.35 },
      { y: stemTop + 10, side: 1, angle: 0.4 },
      { y: stemTop + 22, side: -1, angle: -0.25 },
      { y: stemTop + 22, side: 1, angle: 0.35 },
      { y: stemTop + 34, side: -1, angle: -0.4 },
      { y: stemTop + 34, side: 1, angle: 0.3 },
      { y: stemTop + 46, side: -1, angle: -0.2 },
      { y: stemTop + 46, side: 1, angle: 0.35 },
    ];

    leafPositions.forEach(leaf => {
      ctx.save();
      ctx.translate(cx + leaf.side * 3, leaf.y);
      ctx.rotate(leaf.angle);
      const leafGrad = ctx.createLinearGradient(0, 0, leaf.side * 18, 0);
      leafGrad.addColorStop(0, '#66bb6a');
      leafGrad.addColorStop(1, '#43a047');
      ctx.fillStyle = leafGrad;
      ctx.beginPath();
      ctx.ellipse(leaf.side * 8, 0, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Cut end at top
    ctx.fillStyle = '#81c784';
    ctx.shadowColor = 'rgba(129, 199, 132, 0.5)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.ellipse(cx, stemTop - 1, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '8px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Pondweed', cx, stemBottom + 12);
    ctx.fillText('(cut end up)', cx, stemBottom + 22);
  }

  function drawBubbles() {
    state.bubbles.forEach(b => {
      const grad = ctx.createRadialGradient(
        b.x - b.size * 0.3, b.y - b.size * 0.3, b.size * 0.1,
        b.x, b.y, b.size
      );
      grad.addColorStop(0, 'rgba(255, 255, 255, ' + b.opacity * 0.9 + ')');
      grad.addColorStop(0.5, 'rgba(180, 220, 255, ' + b.opacity * 0.5 + ')');
      grad.addColorStop(1, 'rgba(180, 220, 255, ' + b.opacity * 0.1 + ')');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, ' + b.opacity * 0.4 + ')';
      ctx.beginPath();
      ctx.arc(b.x - b.size * 0.25, b.y - b.size * 0.25, b.size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
  }


  // ══════════════════════════════════════
  // GRAPH
  // ══════════════════════════════════════

  function drawGraph() {
    const W = dom.graphCanvas.width;
    const H = dom.graphCanvas.height;
    const pad = { top: 20, right: 15, bottom: 35, left: 45 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    gCtx.clearRect(0, 0, W, H);

    const data = state.variable === 'light' ? state.lightData : state.co2Data;

    if (data.length === 0) {
      dom.graphEmpty.style.display = '';
      return;
    }
    dom.graphEmpty.style.display = 'none';

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const axisColor = isDark ? '#9ca3af' : '#374151';
    const gridColor = isDark ? '#4b5563' : '#e5e7eb';
    const labelColor = isDark ? '#d1d5db' : '#6b7280';
    const dotColor = '#06d6a0';

    // Determine axis ranges
    let maxX, maxY, xLabel;
    if (state.variable === 'light') {
      maxX = Math.max(55, ...data.map(d => d.distance)) * 1.1;
      maxY = Math.max(50, ...data.map(d => d.bubbles)) * 1.2;
      xLabel = 'Distance / cm';
    } else {
      maxX = Math.max(6, ...data.map(d => d.conc)) * 1.1;
      maxY = Math.max(50, ...data.map(d => d.bubbles)) * 1.2;
      xLabel = 'NaHCO\u2083 / %';
    }

    // ── Axes ──
    gCtx.strokeStyle = axisColor;
    gCtx.lineWidth = 1;
    gCtx.beginPath();
    gCtx.moveTo(pad.left, pad.top);
    gCtx.lineTo(pad.left, H - pad.bottom);
    gCtx.lineTo(W - pad.right, H - pad.bottom);
    gCtx.stroke();

    // ── Grid lines ──
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

    // ── Axis labels ──
    gCtx.fillStyle = labelColor;
    gCtx.font = '9px Inter, sans-serif';
    gCtx.textAlign = 'center';
    gCtx.fillText(xLabel, W / 2, H - 5);
    gCtx.save();
    gCtx.translate(12, pad.top + plotH / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText('Bubbles / min', 0, 0);
    gCtx.restore();

    // Tick labels
    gCtx.fillStyle = labelColor;
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const val = state.variable === 'light'
        ? (maxX * i / 5).toFixed(0)
        : (maxX * i / 5).toFixed(1);
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

    // ── Data points ──
    const toX = v => pad.left + (v / maxX) * plotW;
    const toY = v => pad.top + plotH - (v / maxY) * plotH;

    // Connect points with line
    if (data.length >= 2) {
      gCtx.strokeStyle = dotColor;
      gCtx.lineWidth = 1.5;
      gCtx.setLineDash([4, 3]);
      gCtx.beginPath();
      const sorted = [...data].sort((a, b) => {
        return state.variable === 'light'
          ? a.distance - b.distance
          : a.conc - b.conc;
      });
      sorted.forEach((d, i) => {
        const xVal = state.variable === 'light' ? d.distance : d.conc;
        const px = toX(xVal);
        const py = toY(d.bubbles);
        if (i === 0) gCtx.moveTo(px, py);
        else gCtx.lineTo(px, py);
      });
      gCtx.stroke();
      gCtx.setLineDash([]);
    }

    // Plot dots
    gCtx.fillStyle = dotColor;
    data.forEach(d => {
      const xVal = state.variable === 'light' ? d.distance : d.conc;
      const px = toX(xVal);
      const py = toY(d.bubbles);
      gCtx.beginPath();
      gCtx.arc(px, py, 4, 0, Math.PI * 2);
      gCtx.fill();
    });
  }


  // ══════════════════════════════════════
  // PROCEDURE STEPS
  // ══════════════════════════════════════

  function buildProcedureList() {
    dom.procedureList.innerHTML = '';
    PHOTO_DATA.steps.forEach((step, i) => {
      const li = document.createElement('li');
      li.className = 'procedure-step' + (i === 0 ? ' active' : '');
      li.innerHTML = '<strong>' + step.title + '</strong><br>' + step.instruction;
      li.id = 'step-' + step.id;
      dom.procedureList.appendChild(li);
    });
  }

  function setStep(index) {
    state.currentStep = index;
    const steps = dom.procedureList.querySelectorAll('.procedure-step');
    steps.forEach((li, i) => {
      li.classList.remove('active', 'done');
      if (i < index) li.classList.add('done');
      else if (i === index) li.classList.add('active');
    });
  }


  // ══════════════════════════════════════
  // ANALYSIS QUESTIONS
  // ══════════════════════════════════════

  function buildAnalysisQuestions() {
    dom.analysisPanel.innerHTML = '';
    const questions = state.variable === 'light'
      ? PHOTO_DATA.analysisQuestions.light
      : PHOTO_DATA.analysisQuestions.co2;

    questions.forEach(q => {
      const div = document.createElement('div');
      div.className = 'analysis-q';

      const label = document.createElement('label');
      label.setAttribute('for', q.id);
      label.textContent = q.label;
      div.appendChild(label);

      const textarea = document.createElement('textarea');
      textarea.className = 'analysis-textarea';
      textarea.id = q.id;
      textarea.rows = 3;
      textarea.placeholder = 'Type your answer...';
      div.appendChild(textarea);

      const checkBtn = document.createElement('button');
      checkBtn.className = 'btn btn-primary btn-sm mt-1';
      checkBtn.textContent = 'Check Answer';
      checkBtn.style.fontSize = '11px';

      const feedback = document.createElement('div');
      feedback.className = 'analysis-feedback';
      feedback.style.display = 'none';

      checkBtn.addEventListener('click', () => {
        const answer = textarea.value.trim().toLowerCase();
        if (!answer) {
          toast('Please write an answer first.', 'warn');
          return;
        }
        const matched = q.keywords.filter(kw => answer.includes(kw.toLowerCase()));
        const ratio = matched.length / q.keywords.length;

        feedback.style.display = '';
        if (ratio >= 0.5) {
          feedback.className = 'analysis-feedback correct';
          feedback.textContent = 'Good answer! You mentioned key concepts: ' + matched.join(', ') + '.';
          if (typeof LabAudio !== 'undefined') LabAudio.success();
        } else if (ratio > 0) {
          feedback.className = 'analysis-feedback partial';
          feedback.textContent = 'Partial answer. You mentioned: ' + matched.join(', ') + '. Try to include more detail.';
        } else {
          feedback.className = 'analysis-feedback incorrect';
          feedback.textContent = 'Try again. Consider: ' + q.keywords.slice(0, 3).join(', ') + '...';
          if (typeof LabAudio !== 'undefined') LabAudio.warn();
        }
      });

      div.appendChild(checkBtn);
      div.appendChild(feedback);
      dom.analysisPanel.appendChild(div);
    });
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    state.counting = false;
    state.timerElapsed = 0;
    state.simElapsed = 0;
    state.bubbleCount = 0;
    state.bubbles = [];
    state.lastCountedValue = null;
    state.lastBubbleResult = 0;
    state.lightData = [];
    state.co2Data = [];
    state.completedLight.clear();
    state.completedCO2.clear();
    state.distance = 10;
    state.co2Conc = 0;
    state.speed = 1;
    state.currentStep = 0;

    dom.distanceSlider.value = 10;
    dom.distanceDisplay.textContent = '10 cm';
    dom.counterValue.textContent = '0';
    dom.timerTime.textContent = '0:00';
    dom.timerFill.style.width = '0%';
    dom.timerBar.classList.remove('active');
    dom.timerFill.classList.remove('pulsing');

    dom.btnCount.disabled = false;
    dom.btnStop.disabled = true;
    dom.btnRecord.disabled = true;
    dom.distanceSlider.disabled = false;
    dom.btnVarLight.disabled = false;
    dom.btnVarCO2.disabled = false;

    // Reset speed buttons
    Object.keys(speedBtns).forEach(k => {
      speedBtns[k].classList.toggle('selected', parseInt(k) === 1);
    });

    dom.resultsTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';

    updateDistancePresetSelection();
    updateCO2PresetSelection();
    buildProcedureList();
    buildAnalysisQuestions();
    drawGraph();
    draw();

    toast('Experiment reset. Ready to begin.');
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
    el.className = 'toast toast-' + (type || 'info');
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


  // ── Start ──
  init();
});
