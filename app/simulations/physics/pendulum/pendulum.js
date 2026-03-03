/* ============================================================
   Pendulum & Oscillations — Physics Simulation
   Canvas-based pendulum with timer, data collection, and graphing
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const G_ACTUAL = 9.81; // m/s²
  const NUM_OSCILLATIONS = 10;

  // ── State ──
  const state = {
    length: 0.50,       // m
    releaseAngle: 8,    // degrees
    angle: 0,           // current angle in radians
    angularVel: 0,
    swinging: false,
    damping: 0.99999,   // very slight damping for realism

    // Timer
    timerRunning: false,
    timerStart: 0,
    timerElapsed: 0,
    oscillationCount: 0,
    lastCrossDir: 0,    // tracks zero-crossing direction for counting
    prevAngle: 0,

    // Data
    dataPoints: [],     // [{length, time10, period, periodSq}]
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('pendulum-canvas'),
    lengthSlider: $('length-slider'),
    lengthDisplay: $('length-display'),
    angleSlider: $('angle-slider'),
    angleDisplay: $('angle-display'),
    btnRelease: $('btn-release'),
    btnStopPend: $('btn-stop-pend'),
    timerDisplay: $('timer-display'),
    oscCount: $('osc-count'),
    btnStartTimer: $('btn-start-timer'),
    btnStopTimer: $('btn-stop-timer'),
    btnRecord: $('btn-record'),
    dataTbody: $('data-tbody'),
    dataEmpty: $('data-empty'),
    graphCanvas: $('graph-canvas'),
    calcPanel: $('calc-panel'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel: $('guide-panel'),
    toast: $('toast-container'),
  };

  const ctx = dom.canvas.getContext('2d');
  const gCtx = dom.graphCanvas.getContext('2d');

  // ── Canvas sizing ──
  function resizeCanvas() {
    const panel = dom.canvas.parentElement;
    const w = Math.min(panel.clientWidth - 32, 600);
    const h = Math.min(panel.clientHeight - 100, 500);
    dom.canvas.width = w;
    dom.canvas.height = h;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Procedure step tracking ──
  const STEP_ORDER = ['setup', 'release', 'time', 'record', 'repeat', 'graph'];

  function highlightStep(stepId) {
    const steps = document.querySelectorAll('.procedure-step');
    const targetIdx = STEP_ORDER.indexOf(stepId);
    steps.forEach(step => {
      const sid = step.getAttribute('data-step');
      const idx = STEP_ORDER.indexOf(sid);
      step.classList.remove('active', 'done');
      if (idx < targetIdx) step.classList.add('done');
      else if (idx === targetIdx) step.classList.add('active');
    });
  }
  highlightStep('setup');

  // ── Config ──
  dom.lengthSlider.addEventListener('input', () => {
    state.length = parseFloat(dom.lengthSlider.value);
    dom.lengthDisplay.textContent = state.length.toFixed(2) + ' m';
    if (!state.swinging) draw();
  });
  dom.angleSlider.addEventListener('input', () => {
    state.releaseAngle = parseInt(dom.angleSlider.value);
    dom.angleDisplay.textContent = state.releaseAngle + '°';
    if (!state.swinging) {
      state.angle = state.releaseAngle * Math.PI / 180;
      draw();
    }
  });

  // ── Pendulum Physics ──
  // Using simple pendulum equation: θ'' = -(g/L) sin(θ)
  // Euler integration at small timestep

  const PHYSICS_DT = 0.002; // 2ms physics step
  let lastFrameTime = 0;

  function physicsStep() {
    const gOverL = G_ACTUAL / state.length;
    // Add tiny random variation to simulate measurement uncertainty
    const accel = -gOverL * Math.sin(state.angle);
    state.angularVel += accel * PHYSICS_DT;
    state.angularVel *= state.damping;
    state.prevAngle = state.angle;
    state.angle += state.angularVel * PHYSICS_DT;

    // Count oscillations: a full oscillation = bob passes rest pos twice in same direction
    if (state.timerRunning) {
      // Detect zero-crossing (angle passes through 0)
      if (state.prevAngle > 0 && state.angle <= 0) {
        // Crossed from positive to negative
        if (state.lastCrossDir !== -1) {
          state.lastCrossDir = -1;
          state.oscillationCount += 0.5;
        }
      } else if (state.prevAngle < 0 && state.angle >= 0) {
        if (state.lastCrossDir !== 1) {
          state.lastCrossDir = 1;
          state.oscillationCount += 0.5;
        }
      }
    }
  }

  function animate(timestamp) {
    if (!state.swinging) return;

    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    // Run physics substeps
    const steps = Math.min(Math.floor(dt / PHYSICS_DT), 50);
    for (let i = 0; i < steps; i++) {
      physicsStep();
    }

    // Update timer
    if (state.timerRunning) {
      state.timerElapsed = (performance.now() - state.timerStart) / 1000;
      dom.timerDisplay.textContent = state.timerElapsed.toFixed(2) + ' s';
      dom.oscCount.textContent = Math.floor(state.oscillationCount);

      // Auto-stop at target oscillations
      if (Math.floor(state.oscillationCount) >= NUM_OSCILLATIONS) {
        stopTimer();
        toast(`${NUM_OSCILLATIONS} oscillations completed!`, 'success');
      }
    }

    draw();
    requestAnimationFrame(animate);
  }

  // ── Drawing ──
  function draw() {
    const W = dom.canvas.width;
    const H = dom.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Pivot point
    const pivotX = W / 2;
    const pivotY = 50;

    // Scale: map real length (m) to pixels
    const scale = Math.min(300, H - 120) / 1.2; // 1.2m max maps to available space
    const pixelLength = state.length * scale;

    // Bob position
    const bobX = pivotX + pixelLength * Math.sin(state.angle);
    const bobY = pivotY + pixelLength * Math.cos(state.angle);
    const bobRadius = 14;

    // ── Support bar ──
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(pivotX - 60, 20, 120, 8);
    // Clamp
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
    ctx.fill();

    // ── Ruler / scale alongside string ──
    const rulerX = pivotX + 55;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rulerX, pivotY);
    ctx.lineTo(rulerX, pivotY + pixelLength);
    ctx.stroke();

    // Tick marks every 0.10m
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    for (let m = 0; m <= state.length + 0.01; m += 0.10) {
      const y = pivotY + m * scale;
      ctx.beginPath();
      ctx.moveTo(rulerX - 3, y);
      ctx.lineTo(rulerX + 3, y);
      ctx.stroke();
      if (m > 0.01) {
        ctx.fillText(m.toFixed(1), rulerX + 6, y + 3);
      }
    }

    // Length label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`L = ${state.length.toFixed(2)} m`, rulerX + 25, pivotY + pixelLength / 2 + 4);

    // ── Rest position line (dotted) ──
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX, pivotY + pixelLength + 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── String ──
    ctx.strokeStyle = 'rgba(200,210,230,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // ── Bob (metallic sphere) ──
    const grad = ctx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, bobRadius);
    grad.addColorStop(0, '#d4d7e0');
    grad.addColorStop(0.4, '#9ca3af');
    grad.addColorStop(1, '#4b5563');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bob highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(bobX - 4, bobY - 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // ── Angle arc (when not at rest) ──
    if (Math.abs(state.angle) > 0.01) {
      const arcRadius = 40;
      ctx.strokeStyle = 'rgba(243,156,18,0.4)';
      ctx.lineWidth = 1;
      const startAngle = Math.PI / 2; // straight down
      const endAngle = Math.PI / 2 - state.angle;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, arcRadius, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
      ctx.stroke();

      // Angle label
      const angleDeg = Math.abs(state.angle * 180 / Math.PI).toFixed(1);
      ctx.fillStyle = 'rgba(243,156,18,0.6)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(angleDeg + '°', pivotX - 50, pivotY + 20);
    }

    // ── Info text at bottom ──
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (!state.swinging) {
      ctx.fillText('Click "Release" to start the pendulum', W / 2, H - 15);
    } else if (!state.timerRunning && state.oscillationCount === 0) {
      ctx.fillText('Click "Start Timer" as the bob passes the rest position', W / 2, H - 15);
    }
  }

  // Initial draw
  state.angle = state.releaseAngle * Math.PI / 180;
  draw();


  // ══════════════════════════════════════
  // CONTROLS
  // ══════════════════════════════════════

  dom.btnRelease.addEventListener('click', () => {
    if (state.swinging) return;
    state.angle = state.releaseAngle * Math.PI / 180;
    state.angularVel = 0;
    state.swinging = true;
    state.oscillationCount = 0;
    state.lastCrossDir = 0;
    state.timerRunning = false;
    state.timerElapsed = 0;
    dom.timerDisplay.textContent = '0.00 s';
    dom.oscCount.textContent = '0';

    dom.btnRelease.disabled = true;
    dom.btnStopPend.disabled = false;
    dom.btnStartTimer.disabled = false;
    dom.btnRecord.disabled = true;
    dom.lengthSlider.disabled = true;

    lastFrameTime = 0;
    requestAnimationFrame(animate);
    highlightStep('release');
    toast('Pendulum released. Start the timer when ready.');
  });

  dom.btnStopPend.addEventListener('click', () => {
    state.swinging = false;
    state.angle = state.releaseAngle * Math.PI / 180;
    state.angularVel = 0;
    if (state.timerRunning) stopTimer();

    dom.btnRelease.disabled = false;
    dom.btnStopPend.disabled = true;
    dom.btnStartTimer.disabled = true;
    dom.btnStopTimer.disabled = true;
    dom.lengthSlider.disabled = false;
    draw();
  });

  dom.btnStartTimer.addEventListener('click', () => {
    state.timerRunning = true;
    state.timerStart = performance.now();
    state.oscillationCount = 0;
    state.lastCrossDir = 0;

    dom.btnStartTimer.disabled = true;
    dom.btnStopTimer.disabled = false;
    dom.btnRecord.disabled = true;
    highlightStep('time');
    toast(`Timing ${NUM_OSCILLATIONS} oscillations...`);
  });

  dom.btnStopTimer.addEventListener('click', stopTimer);

  function stopTimer() {
    state.timerRunning = false;
    dom.btnStopTimer.disabled = true;
    dom.btnRecord.disabled = false;
    dom.btnStartTimer.disabled = true;
    highlightStep('record');
  }

  /* ── LabRecordMode integration ── */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  dom.btnRecord.addEventListener('click', () => {
    let adjustedTime;

    /* In independent mode, require manual entry of the time */
    if (typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided()) {
      const userTime = prompt('Enter the time for ' + NUM_OSCILLATIONS + ' oscillations (s):');
      if (userTime === null) return;
      adjustedTime = parseFloat(userTime);
      if (isNaN(adjustedTime) || adjustedTime <= 0) {
        toast('Please enter a valid positive time.', 'warn');
        return;
      }
    } else {
      const time10 = state.timerElapsed;
      // Add small random error (±0.1s) for realism
      const noise = (Math.random() - 0.5) * 0.15;
      adjustedTime = Math.max(0.5, time10 + noise);
    }

    const period = adjustedTime / NUM_OSCILLATIONS;
    const periodSq = period * period;

    const dp = {
      length: state.length,
      time10: adjustedTime,
      period: period,
      periodSq: periodSq,
    };
    state.dataPoints.push(dp);

    // Add to table
    dom.dataEmpty.style.display = 'none';
    const row = document.createElement('tr');
    row.className = 'animate-fade-in';
    row.innerHTML = `
      <td>${dp.length.toFixed(2)}</td>
      <td>${dp.time10.toFixed(2)}</td>
      <td>${dp.period.toFixed(3)}</td>
      <td>${dp.periodSq.toFixed(3)}</td>
    `;
    dom.dataTbody.appendChild(row);

    // Stop pendulum for next measurement
    state.swinging = false;
    state.angle = state.releaseAngle * Math.PI / 180;
    state.angularVel = 0;
    dom.btnRelease.disabled = false;
    dom.btnStopPend.disabled = true;
    dom.btnStartTimer.disabled = true;
    dom.btnStopTimer.disabled = true;
    dom.btnRecord.disabled = true;
    dom.lengthSlider.disabled = false;

    draw();
    drawGraph();
    if (state.dataPoints.length >= 3) {
      calculateG();
      highlightStep('graph');
    } else {
      highlightStep('repeat');
    }
    toast(`Recorded: L=${dp.length.toFixed(2)}m, T=${dp.period.toFixed(3)}s`);
  });


  // ══════════════════════════════════════
  // GRAPH (T² vs L)
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

    // Determine axis ranges
    const maxL = Math.max(1.3, ...state.dataPoints.map(d => d.length)) * 1.1;
    const maxT2 = Math.max(1, ...state.dataPoints.map(d => d.periodSq)) * 1.2;

    // ── Axes ──
    gCtx.strokeStyle = axisColor;
    gCtx.lineWidth = 1;
    // Y axis
    gCtx.beginPath();
    gCtx.moveTo(pad.left, pad.top);
    gCtx.lineTo(pad.left, H - pad.bottom);
    gCtx.stroke();
    // X axis
    gCtx.beginPath();
    gCtx.moveTo(pad.left, H - pad.bottom);
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
    gCtx.fillText('L / m', W / 2, H - 5);
    gCtx.save();
    gCtx.translate(12, pad.top + plotH / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText('T² / s²', 0, 0);
    gCtx.restore();

    // Tick labels
    gCtx.fillStyle = labelColor;
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const val = (maxL * i / 5).toFixed(1);
      const x = pad.left + (plotW * i / 5);
      gCtx.fillText(val, x, H - pad.bottom + 4);
    }
    gCtx.textAlign = 'right';
    gCtx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const val = (maxT2 * (5 - i) / 5).toFixed(1);
      const y = pad.top + (plotH * i / 5);
      gCtx.fillText(val, pad.left - 5, y);
    }

    // ── Data points ──
    const toX = l => pad.left + (l / maxL) * plotW;
    const toY = t2 => pad.top + plotH - (t2 / maxT2) * plotH;

    gCtx.fillStyle = '#f77f00';
    state.dataPoints.forEach(d => {
      const x = toX(d.length);
      const y = toY(d.periodSq);
      gCtx.beginPath();
      gCtx.arc(x, y, 4, 0, Math.PI * 2);
      gCtx.fill();
    });

    // ── Best-fit line (linear regression through origin: T² = (4π²/g)L) ──
    if (state.dataPoints.length >= 2) {
      // T² = m * L, regression through origin: m = Σ(Li*T²i) / Σ(Li²)
      let sumLT2 = 0, sumL2 = 0;
      state.dataPoints.forEach(d => {
        sumLT2 += d.length * d.periodSq;
        sumL2 += d.length * d.length;
      });
      const gradient = sumLT2 / sumL2;

      gCtx.strokeStyle = '#f77f00';
      gCtx.lineWidth = 1.5;
      gCtx.setLineDash([4, 3]);
      gCtx.beginPath();
      gCtx.moveTo(toX(0), toY(0));
      gCtx.lineTo(toX(maxL), toY(gradient * maxL));
      gCtx.stroke();
      gCtx.setLineDash([]);

      // Label gradient
      gCtx.fillStyle = '#f77f00';
      gCtx.font = '10px Inter, sans-serif';
      gCtx.textAlign = 'left';
      gCtx.fillText(`gradient = ${gradient.toFixed(3)}`, pad.left + 8, pad.top + 14);
    }
  }


  // ══════════════════════════════════════
  // CALCULATE g
  // ══════════════════════════════════════

  function calculateG() {
    if (state.dataPoints.length < 3) return;

    // Linear regression through origin: T² = (4π²/g) * L
    let sumLT2 = 0, sumL2 = 0;
    state.dataPoints.forEach(d => {
      sumLT2 += d.length * d.periodSq;
      sumL2 += d.length * d.length;
    });
    const gradient = sumLT2 / sumL2; // = 4π²/g
    const g = (4 * Math.PI * Math.PI) / gradient;
    const percentError = Math.abs((g - G_ACTUAL) / G_ACTUAL * 100);

    dom.calcPanel.innerHTML = `
      <span class="calc-label">Linear regression: T² = m × L (through origin)</span>
      <div class="calc-line">Gradient m = Σ(L·T²) / Σ(L²)</div>
      <div class="calc-line">= ${sumLT2.toFixed(4)} / ${sumL2.toFixed(4)}</div>
      <div class="calc-line">= ${gradient.toFixed(4)} s² m⁻¹</div>

      <span class="calc-label">Since gradient = 4π²/g</span>
      <div class="calc-line">g = 4π² / ${gradient.toFixed(4)}</div>
      <div class="calc-result">g = ${g.toFixed(2)} m s⁻² (${percentError.toFixed(1)}% from accepted value)</div>

      <span class="calc-label">Data points: ${state.dataPoints.length}</span>
    `;
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    state.swinging = false;
    state.angle = state.releaseAngle * Math.PI / 180;
    state.angularVel = 0;
    state.timerRunning = false;
    state.timerElapsed = 0;
    state.oscillationCount = 0;
    state.dataPoints = [];

    dom.timerDisplay.textContent = '0.00 s';
    dom.oscCount.textContent = '0';
    dom.btnRelease.disabled = false;
    dom.btnStopPend.disabled = true;
    dom.btnStartTimer.disabled = true;
    dom.btnStopTimer.disabled = true;
    dom.btnRecord.disabled = true;
    dom.lengthSlider.disabled = false;

    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';
    dom.calcPanel.innerHTML = '<p class="text-sm text-muted">Collect at least 3 data points to calculate g from the gradient.</p>';

    draw();
    highlightStep('setup');

    // Clear graph
    const W = dom.graphCanvas.width, H = dom.graphCanvas.height;
    gCtx.clearRect(0, 0, W, H);
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
      else LabAudio.click();
    }
  }
});
