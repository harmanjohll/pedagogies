/*
 * Simple Pendulum Simulation
 * ===========================
 * Physics: θ'' = -(g/L) * sin(θ)  (exact, not small-angle)
 * Integration: Euler-Cromer (symplectic) for energy stability
 * Rendering: HTML5 Canvas at 60 fps via requestAnimationFrame
 */

(() => {
  'use strict';

  /* ═══════════ DOM References ═══════════ */

  const canvas        = document.getElementById('pendulumCanvas');
  const ctx           = canvas.getContext('2d');
  const container     = document.getElementById('canvasContainer');

  // Controls
  const lengthSlider  = document.getElementById('lengthSlider');
  const angleSlider   = document.getElementById('angleSlider');
  const gravitySelect = document.getElementById('gravitySelect');
  const lengthValue   = document.getElementById('lengthValue');
  const angleValue    = document.getElementById('angleValue');
  const btnStart      = document.getElementById('btnStart');
  const btnPause      = document.getElementById('btnPause');
  const btnReset      = document.getElementById('btnReset');
  const chkTrail      = document.getElementById('chkTrail');
  const chkTheory     = document.getElementById('chkTheory');

  // Data display
  const periodMeasured   = document.getElementById('periodMeasured');
  const periodTheory     = document.getElementById('periodTheory');
  const frequencyDisplay = document.getElementById('frequencyDisplay');
  const angVelDisplay    = document.getElementById('angVelDisplay');
  const timeDisplay      = document.getElementById('timeDisplay');
  const stateDisplay     = document.getElementById('stateDisplay');

  // Energy
  const energyKE     = document.getElementById('energyKE');
  const energyPE     = document.getElementById('energyPE');
  const keValue      = document.getElementById('keValue');
  const peValue      = document.getElementById('peValue');
  const totalEnergy  = document.getElementById('totalEnergy');

  // Measurements
  const btnRecord       = document.getElementById('btnRecord');
  const btnClearTable   = document.getElementById('btnClearTable');
  const measurementsBody = document.getElementById('measurementsBody');
  const emptyTableMsg    = document.getElementById('emptyTableMsg');

  // Toast
  const toastContainer = document.getElementById('toastContainer');

  /* ═══════════ State ═══════════ */

  const BOB_MASS = 0.5; // kg (fixed for display)
  const TRAIL_LENGTH = 120;
  const DT = 1 / 60; // fixed timestep (seconds)
  const STEPS_PER_FRAME = 4; // sub-steps for accuracy
  const SUB_DT = DT / STEPS_PER_FRAME;

  let state = {
    L: 1.0,          // string length (m)
    theta0: Math.PI / 6, // initial angle (rad)
    g: 9.81,         // gravity (m/s²)
    theta: 0,        // current angle (rad)
    omega: 0,        // angular velocity (rad/s)
    time: 0,         // elapsed time (s)
    running: false,
    paused: false,
    trail: [],       // [{x, y, alpha}]
    // Period measurement
    lastCrossingTime: null,
    measuredPeriod: null,
    prevTheta: 0,
    crossingCount: 0,
    measurements: [],
  };

  let animFrameId = null;

  /* ═══════════ Toast Helper ═══════════ */

  function showToast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  }

  /* ═══════════ Canvas Sizing ═══════════ */

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  /* ═══════════ Physics ═══════════ */

  function resetPhysics() {
    state.theta = state.theta0;
    state.omega = 0;
    state.time = 0;
    state.trail = [];
    state.lastCrossingTime = null;
    state.measuredPeriod = null;
    state.prevTheta = state.theta0;
    state.crossingCount = 0;
  }

  function stepPhysics() {
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      const prevTheta = state.theta;

      // Euler-Cromer: update velocity first, then position
      const alpha = -(state.g / state.L) * Math.sin(state.theta);
      state.omega += alpha * SUB_DT;
      state.theta += state.omega * SUB_DT;

      // Period detection: crossing θ=0 going from negative to positive (left to right)
      if (prevTheta < 0 && state.theta >= 0) {
        state.crossingCount++;
        if (state.crossingCount >= 2 && state.lastCrossingTime !== null) {
          state.measuredPeriod = state.time - state.lastCrossingTime;
        }
        state.lastCrossingTime = state.time;
      }

      state.time += SUB_DT;
    }
    state.prevTheta = state.theta;
  }

  /* ═══════════ Theoretical Period ═══════════ */

  function theoreticalPeriod() {
    // T = 2π√(L/g) is the small-angle approximation.
    // For a better estimate use the first correction: T ≈ 2π√(L/g) * (1 + θ0²/16)
    const T0 = 2 * Math.PI * Math.sqrt(state.L / state.g);
    const correction = 1 + (state.theta0 * state.theta0) / 16;
    return T0 * correction;
  }

  /* ═══════════ Energy ═══════════ */

  function computeEnergy() {
    const v = state.omega * state.L; // tangential velocity
    const h = state.L * (1 - Math.cos(state.theta)); // height above lowest point
    const KE = 0.5 * BOB_MASS * v * v;
    const PE = BOB_MASS * state.g * h;
    return { KE, PE, total: KE + PE };
  }

  /* ═══════════ Drawing ═══════════ */

  function getBobPosition(w, h) {
    // Pivot at top center
    const pivotX = w / 2;
    const pivotY = 60;
    // Scale: fit 2.2m into ~70% of available height
    const scale = Math.min((h - 120) * 0.7, 400) / 2.2;
    const stringLen = state.L * scale;
    const bobX = pivotX + stringLen * Math.sin(state.theta);
    const bobY = pivotY + stringLen * Math.cos(state.theta);
    return { pivotX, pivotY, bobX, bobY, scale, stringLen };
  }

  function draw() {
    const w = canvas.style.width ? parseFloat(canvas.style.width) : container.clientWidth;
    const h = canvas.style.height ? parseFloat(canvas.style.height) : container.clientHeight;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#1a1a2e');
    bgGrad.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const { pivotX, pivotY, bobX, bobY, scale, stringLen } = getBobPosition(w, h);
    const bobRadius = Math.max(12, Math.min(22, BOB_MASS * 30));

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let y = pivotY; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Equilibrium line (dashed)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX, pivotY + stringLen + bobRadius + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Angle arc
    if (Math.abs(state.theta) > 0.01) {
      const arcRadius = Math.min(50, stringLen * 0.3);
      ctx.strokeStyle = 'rgba(255, 226, 0, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const startAngle = Math.PI / 2 - Math.abs(state.theta);
      const endAngle = Math.PI / 2;
      if (state.theta > 0) {
        ctx.arc(pivotX, pivotY, arcRadius, Math.PI / 2 - state.theta, Math.PI / 2);
      } else {
        ctx.arc(pivotX, pivotY, arcRadius, Math.PI / 2, Math.PI / 2 - state.theta);
      }
      ctx.stroke();

      // Angle text
      const angleDeg = Math.abs(state.theta * 180 / Math.PI).toFixed(1);
      ctx.fillStyle = 'rgba(255, 226, 0, 0.6)';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(angleDeg + '\u00B0', pivotX + (state.theta > 0 ? -1 : 1) * (arcRadius + 18), pivotY + arcRadius * 0.6);
    }

    // Trail
    if (chkTrail.checked && state.trail.length > 1) {
      for (let i = 0; i < state.trail.length; i++) {
        const t = state.trail[i];
        const alpha = (i / state.trail.length) * 0.6;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.fill();
      }
    }

    // String
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // Pivot point
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#64748b';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pivot bracket
    ctx.fillStyle = '#475569';
    ctx.fillRect(pivotX - 30, pivotY - 10, 60, 6);

    // Bob shadow
    ctx.beginPath();
    ctx.arc(bobX + 2, bobY + 2, bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Bob
    const bobGrad = ctx.createRadialGradient(
      bobX - bobRadius * 0.3, bobY - bobRadius * 0.3, bobRadius * 0.1,
      bobX, bobY, bobRadius
    );
    bobGrad.addColorStop(0, '#60a5fa');
    bobGrad.addColorStop(0.5, '#3b82f6');
    bobGrad.addColorStop(1, '#1d4ed8');
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fillStyle = bobGrad;
    ctx.fill();

    // Bob highlight
    ctx.beginPath();
    ctx.arc(bobX - bobRadius * 0.25, bobY - bobRadius * 0.25, bobRadius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    // Add to trail
    if (state.running && !state.paused) {
      state.trail.push({ x: bobX, y: bobY });
      if (state.trail.length > TRAIL_LENGTH) {
        state.trail.shift();
      }
    }

    // Theoretical period on canvas
    if (chkTheory.checked) {
      const T = theoreticalPeriod();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('T(theory) = ' + T.toFixed(4) + ' s', 16, h - 16);
    }

    // Length label on string
    const midX = (pivotX + bobX) / 2;
    const midY = (pivotY + bobY) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('L = ' + state.L.toFixed(2) + ' m', midX + 12, midY);
  }

  /* ═══════════ UI Updates ═══════════ */

  function updateDataDisplay() {
    // Time
    timeDisplay.textContent = state.time.toFixed(2) + ' s';

    // Angular velocity
    angVelDisplay.textContent = state.omega.toFixed(3);

    // Period
    const Ttheory = theoreticalPeriod();
    periodTheory.textContent = Ttheory.toFixed(4);

    if (state.measuredPeriod !== null) {
      periodMeasured.textContent = state.measuredPeriod.toFixed(4);
      const f = 1 / state.measuredPeriod;
      frequencyDisplay.textContent = f.toFixed(4);
    }

    // Energy
    const { KE, PE, total } = computeEnergy();
    const totalMax = total || 1;
    const kePct = (KE / totalMax) * 100;
    const pePct = (PE / totalMax) * 100;

    energyKE.style.width = kePct + '%';
    energyPE.style.width = pePct + '%';
    keValue.textContent = KE.toFixed(3);
    peValue.textContent = PE.toFixed(3);
    totalEnergy.textContent = total.toFixed(3);
  }

  /* ═══════════ Animation Loop ═══════════ */

  function animate() {
    if (state.running && !state.paused) {
      stepPhysics();
      updateDataDisplay();
    }
    draw();
    animFrameId = requestAnimationFrame(animate);
  }

  /* ═══════════ Control Handlers ═══════════ */

  lengthSlider.addEventListener('input', () => {
    const val = parseFloat(lengthSlider.value);
    state.L = val;
    lengthValue.textContent = val.toFixed(2) + ' m';
    if (!state.running) {
      resetPhysics();
      updateDataDisplay();
    }
  });

  angleSlider.addEventListener('input', () => {
    const val = parseInt(angleSlider.value, 10);
    state.theta0 = val * Math.PI / 180;
    angleValue.innerHTML = val + '&deg;';
    if (!state.running) {
      resetPhysics();
      updateDataDisplay();
    }
  });

  gravitySelect.addEventListener('change', () => {
    state.g = parseFloat(gravitySelect.value);
    if (!state.running) {
      resetPhysics();
      updateDataDisplay();
    }
  });

  btnStart.addEventListener('click', () => {
    if (!state.running) {
      resetPhysics();
      state.running = true;
      state.paused = false;
      btnStart.disabled = true;
      btnPause.disabled = false;
      stateDisplay.textContent = 'Running';
      lengthSlider.disabled = true;
      angleSlider.disabled = true;
      gravitySelect.disabled = true;
      showToast('Simulation started', 'info');
    }
  });

  btnPause.addEventListener('click', () => {
    if (state.running) {
      state.paused = !state.paused;
      if (state.paused) {
        btnPause.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Resume`;
        stateDisplay.textContent = 'Paused';
      } else {
        btnPause.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          Pause`;
        stateDisplay.textContent = 'Running';
      }
    }
  });

  btnReset.addEventListener('click', () => {
    state.running = false;
    state.paused = false;
    resetPhysics();

    btnStart.disabled = false;
    btnPause.disabled = true;
    btnPause.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      Pause`;
    stateDisplay.textContent = 'Ready';
    lengthSlider.disabled = false;
    angleSlider.disabled = false;
    gravitySelect.disabled = false;

    // Reset display
    periodMeasured.innerHTML = '&mdash;';
    frequencyDisplay.innerHTML = '&mdash;';
    angVelDisplay.innerHTML = '&mdash;';
    timeDisplay.textContent = '0.00 s';
    energyKE.style.width = '0%';
    energyPE.style.width = '100%';

    const { KE, PE, total } = computeEnergy();
    keValue.textContent = '0.000';
    peValue.textContent = PE.toFixed(3);
    totalEnergy.textContent = total.toFixed(3);

    periodTheory.textContent = theoreticalPeriod().toFixed(4);

    showToast('Simulation reset', 'info');
  });

  /* ═══════════ Record Measurement ═══════════ */

  btnRecord.addEventListener('click', () => {
    if (state.measuredPeriod === null) {
      showToast('No period measured yet. Let the pendulum complete at least 2 swings.', 'warning');
      return;
    }

    const trial = state.measurements.length + 1;
    const measurement = {
      trial,
      length: state.L,
      period: state.measuredPeriod,
    };
    state.measurements.push(measurement);

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${trial}</td>
      <td>${measurement.length.toFixed(2)}</td>
      <td>${measurement.period.toFixed(4)}</td>
    `;
    measurementsBody.appendChild(row);
    emptyTableMsg.classList.add('hidden');

    showToast(`Trial ${trial} recorded: L=${measurement.length.toFixed(2)}m, T=${measurement.period.toFixed(4)}s`, 'success');
  });

  btnClearTable.addEventListener('click', () => {
    state.measurements = [];
    measurementsBody.innerHTML = '';
    emptyTableMsg.classList.remove('hidden');
    showToast('Measurements cleared', 'info');
  });

  /* ═══════════ Fullscreen ═══════════ */

  const btnFullscreen = document.getElementById('btnFullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  /* ═══════════ Init ═══════════ */

  function init() {
    state.L = parseFloat(lengthSlider.value);
    state.theta0 = parseInt(angleSlider.value, 10) * Math.PI / 180;
    state.g = parseFloat(gravitySelect.value);
    resetPhysics();

    // Set initial theory display
    periodTheory.textContent = theoreticalPeriod().toFixed(4);

    // Initial energy
    const { KE, PE, total } = computeEnergy();
    keValue.textContent = KE.toFixed(3);
    peValue.textContent = PE.toFixed(3);
    totalEnergy.textContent = total.toFixed(3);
    energyKE.style.width = '0%';
    energyPE.style.width = '100%';

    // Start render loop
    animate();
  }

  init();

})();
