/* ============================================================
   Wave Properties — Physics Simulation
   Canvas-based transverse/longitudinal wave visualisation
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── State ──
  const state = {
    waveType: 'transverse',
    frequency: 1.5,
    amplitude: 40,
    waveSpeed: 150,
    damping: 0.05,
    running: false,
    frozen: false,
    time: 0,
    showLabels: true,
    showParticles: true,
    pulseMode: false,
    pulseTime: -1,
    dataPoints: [],
  };

  const NUM_PARTICLES = 80;

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('wave-canvas'),
    waveType: $('wave-type'),
    frequency: $('frequency'),
    freqVal: $('freq-val'),
    amplitude: $('amplitude'),
    ampVal: $('amp-val'),
    waveSpeed: $('wave-speed'),
    speedVal: $('speed-val'),
    damping: $('damping'),
    dampVal: $('damp-val'),
    btnStart: $('btn-start'),
    btnFreeze: $('btn-freeze'),
    btnPulse: $('btn-pulse'),
    btnRecord: $('btn-record'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel: $('guide-panel'),
    showLabels: $('show-labels'),
    showParticles: $('show-particles'),
    measWavelength: $('meas-wavelength'),
    measPeriod: $('meas-period'),
    measSpeed: $('meas-speed'),
    measCheck: $('meas-check'),
    dataTbody: $('data-tbody'),
    dataEmpty: $('data-empty'),
  };

  const ctx = dom.canvas.getContext('2d');

  // ── Canvas sizing ──
  function resizeCanvas() {
    const panel = dom.canvas.parentElement;
    const w = Math.min(panel.clientWidth - 32, 700);
    const h = Math.min(panel.clientHeight - 100, 420);
    dom.canvas.width = w;
    dom.canvas.height = h;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Procedure steps ──
  const STEP_ORDER = ['setup', 'observe', 'measure', 'investigate'];
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

  // ── Toast ──
  function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 2500);
  }

  // ── Computed properties ──
  function getWavelength() {
    return state.waveSpeed / state.frequency; // in pixels (representing cm)
  }

  function updateMeasurements() {
    const wl = getWavelength();
    const T = 1 / state.frequency;
    dom.measWavelength.textContent = (wl / 100).toFixed(2) + ' m';
    dom.measPeriod.textContent = T.toFixed(2) + ' s';
    dom.measSpeed.textContent = (state.waveSpeed / 100).toFixed(2) + ' m/s';
    dom.measCheck.textContent = (state.frequency * wl / 100).toFixed(2) + ' m/s';
  }

  // ── Wave displacement function ──
  function waveY(x, t) {
    const wl = getWavelength();
    const k = (2 * Math.PI) / wl;
    const omega = 2 * Math.PI * state.frequency;
    const dampFactor = Math.exp(-state.damping * x / 200);

    if (state.pulseMode && state.pulseTime >= 0) {
      // Single pulse: Gaussian envelope
      const pulseWidth = wl * 0.8;
      const pulseCenter = state.waveSpeed * (t - state.pulseTime);
      const envelope = Math.exp(-Math.pow(x - pulseCenter, 2) / (2 * pulseWidth * pulseWidth));
      return state.amplitude * envelope * Math.sin(k * x - omega * t) * dampFactor;
    }

    return state.amplitude * Math.sin(k * x - omega * t) * dampFactor;
  }

  // ── Draw ──
  function draw() {
    const w = dom.canvas.width;
    const h = dom.canvas.height;
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#1e1f2b');
    bgGrad.addColorStop(0.6, '#252638');
    bgGrad.addColorStop(1, '#2d2e42');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Equilibrium line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Source indicator
    ctx.fillStyle = 'rgba(247, 127, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(10, midY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f77f00';
    ctx.lineWidth = 2;
    ctx.stroke();

    const t = state.time;

    if (state.waveType === 'transverse') {
      drawTransverse(w, h, midY, t);
    } else {
      drawLongitudinal(w, h, midY, t);
    }

    // Labels
    if (state.showLabels && state.running) {
      drawLabels(w, h, midY, t);
    }
  }

  function drawTransverse(w, h, midY, t) {
    // Wave curve
    ctx.strokeStyle = '#f77f00';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += 2) {
      const y = midY - waveY(x, t);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Particles
    if (state.showParticles) {
      const spacing = w / NUM_PARTICLES;
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const px = i * spacing;
        const displacement = waveY(px, t);
        const py = midY - displacement;

        // Equilibrium position marker
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(px, midY, 2, 0, Math.PI * 2);
        ctx.fill();

        // Displacement arrow
        if (Math.abs(displacement) > 2) {
          ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, midY);
          ctx.lineTo(px, py);
          ctx.stroke();
        }

        // Particle
        ctx.fillStyle = '#4cc9f0';
        ctx.shadowColor = '#4cc9f0';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawLongitudinal(w, h, midY, t) {
    const spacing = w / NUM_PARTICLES;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const eqX = i * spacing;
      const displacement = waveY(eqX, t) * 0.6; // horizontal displacement
      const px = eqX + displacement;
      const py = midY;

      // Density-based colouring
      const density = Math.abs(displacement);
      const compression = displacement < 0 ? Math.abs(displacement) / state.amplitude : 0;
      const rarefaction = displacement > 0 ? displacement / state.amplitude : 0;

      let color;
      if (compression > 0.3) {
        color = `rgba(239, 71, 111, ${0.4 + compression * 0.6})`;
      } else if (rarefaction > 0.3) {
        color = `rgba(76, 201, 240, ${0.3 + rarefaction * 0.4})`;
      } else {
        color = 'rgba(200, 200, 220, 0.6)';
      }

      // Particle
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Vertical lines between particles to show compression/rarefaction
      if (i < NUM_PARTICLES - 1) {
        const nextEqX = (i + 1) * spacing;
        const nextDisp = waveY(nextEqX, t) * 0.6;
        const nextPx = nextEqX + nextDisp;
        const gap = nextPx - px;
        const normalGap = spacing;
        const compressionRatio = gap / normalGap;

        ctx.strokeStyle = compressionRatio < 0.7 ?
          'rgba(239, 71, 111, 0.2)' :
          compressionRatio > 1.3 ?
            'rgba(76, 201, 240, 0.15)' :
            'rgba(200, 200, 220, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py - 20);
        ctx.lineTo(px, py + 20);
        ctx.stroke();
      }
    }

    // Direction of wave propagation arrow
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '500 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Wave direction →', w / 2, h - 15);

    // Legend
    ctx.textAlign = 'left';
    ctx.font = '500 10px system-ui';
    ctx.fillStyle = 'rgba(239, 71, 111, 0.8)';
    ctx.fillText('C = Compression', 15, 20);
    ctx.fillStyle = 'rgba(76, 201, 240, 0.7)';
    ctx.fillText('R = Rarefaction', 15, 34);
  }

  function drawLabels(w, h, midY, t) {
    const wl = getWavelength();

    if (state.waveType === 'transverse') {
      // Find a crest
      let crestX = -1;
      for (let x = 50; x < w - 50; x++) {
        const y = waveY(x, t);
        if (y > state.amplitude * 0.95) { crestX = x; break; }
      }

      if (crestX > 0) {
        const crestY = midY - waveY(crestX, t);

        // Crest label
        ctx.fillStyle = '#fca311';
        ctx.font = '600 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Crest', crestX, crestY - 12);

        // Trough label
        const troughX = crestX + wl / 2;
        if (troughX < w - 20) {
          const troughY = midY - waveY(troughX, t);
          ctx.fillText('Trough', troughX, troughY + 20);
        }

        // Wavelength arrow
        const wlEndX = crestX + wl;
        if (wlEndX < w - 10) {
          ctx.strokeStyle = '#06d6a0';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(crestX, crestY - 25);
          ctx.lineTo(wlEndX, crestY - 25);
          ctx.stroke();

          // Arrowheads
          ctx.beginPath();
          ctx.moveTo(crestX, crestY - 30);
          ctx.lineTo(crestX, crestY - 20);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(wlEndX, crestY - 30);
          ctx.lineTo(wlEndX, crestY - 20);
          ctx.stroke();

          ctx.fillStyle = '#06d6a0';
          ctx.font = '600 11px system-ui';
          ctx.fillText('\u03BB', (crestX + wlEndX) / 2, crestY - 30);
        }

        // Amplitude arrow
        ctx.strokeStyle = '#ef476f';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(crestX + 5, midY);
        ctx.lineTo(crestX + 5, crestY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ef476f';
        ctx.font = '600 10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('A', crestX + 10, (midY + crestY) / 2 + 4);
      }
    } else {
      // Longitudinal labels
      const spacing = w / NUM_PARTICLES;
      for (let i = 5; i < NUM_PARTICLES - 5; i++) {
        const eqX = i * spacing;
        const disp = waveY(eqX, t) * 0.6;
        const nextDisp = waveY((i + 1) * spacing, t) * 0.6;
        const gap = ((i + 1) * spacing + nextDisp) - (eqX + disp);

        if (gap < spacing * 0.5) {
          ctx.fillStyle = 'rgba(239, 71, 111, 0.7)';
          ctx.font = '600 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('C', eqX + disp, midY - 30);
          i += 8; // skip ahead
        } else if (gap > spacing * 1.5) {
          ctx.fillStyle = 'rgba(76, 201, 240, 0.6)';
          ctx.font = '600 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('R', eqX + disp, midY - 30);
          i += 8;
        }
      }
    }
  }

  // ── Animation loop ──
  let lastTime = 0;
  let animId = null;

  function loop(timestamp) {
    if (!state.running || state.frozen) return;
    const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0.016;
    lastTime = timestamp;

    state.time += dt;
    draw();
    animId = requestAnimationFrame(loop);
  }

  // ── Controls ──
  dom.waveType.addEventListener('change', () => {
    state.waveType = dom.waveType.value;
    if (!state.running) draw();
  });

  dom.frequency.addEventListener('input', () => {
    state.frequency = parseFloat(dom.frequency.value);
    dom.freqVal.textContent = state.frequency.toFixed(1) + ' Hz';
    updateMeasurements();
    if (!state.running) draw();
  });

  dom.amplitude.addEventListener('input', () => {
    state.amplitude = parseInt(dom.amplitude.value);
    dom.ampVal.textContent = state.amplitude + ' cm';
    if (!state.running) draw();
  });

  dom.waveSpeed.addEventListener('input', () => {
    state.waveSpeed = parseInt(dom.waveSpeed.value);
    dom.speedVal.textContent = state.waveSpeed;
    updateMeasurements();
    if (!state.running) draw();
  });

  dom.damping.addEventListener('input', () => {
    state.damping = parseInt(dom.damping.value) / 100;
    dom.dampVal.textContent = dom.damping.value + '%';
  });

  dom.showLabels.addEventListener('change', () => {
    state.showLabels = dom.showLabels.checked;
    if (!state.running || state.frozen) draw();
  });

  dom.showParticles.addEventListener('change', () => {
    state.showParticles = dom.showParticles.checked;
    if (!state.running || state.frozen) draw();
  });

  dom.btnStart.addEventListener('click', () => {
    if (state.running && !state.frozen) return;
    state.running = true;
    state.frozen = false;
    state.pulseMode = false;
    state.time = 0;
    lastTime = 0;

    dom.btnStart.disabled = true;
    dom.btnFreeze.disabled = false;
    dom.btnFreeze.textContent = 'Freeze';

    highlightStep('observe');
    updateMeasurements();
    showToast('Wave started', 'info');
    animId = requestAnimationFrame(loop);
  });

  dom.btnFreeze.addEventListener('click', () => {
    if (!state.running) return;
    state.frozen = !state.frozen;
    dom.btnFreeze.textContent = state.frozen ? 'Resume' : 'Freeze';

    if (!state.frozen) {
      lastTime = 0;
      animId = requestAnimationFrame(loop);
    } else {
      highlightStep('measure');
      showToast('Wave frozen — measure wavelength and amplitude', 'info');
    }
  });

  dom.btnPulse.addEventListener('click', () => {
    state.running = true;
    state.frozen = false;
    state.pulseMode = true;
    state.pulseTime = state.time;
    state.time = 0;
    lastTime = 0;

    dom.btnStart.disabled = true;
    dom.btnFreeze.disabled = false;

    highlightStep('observe');
    updateMeasurements();
    showToast('Single pulse sent', 'info');
    animId = requestAnimationFrame(loop);
  });

  dom.btnRecord.addEventListener('click', () => {
    const wl = getWavelength();
    const row = {
      freq: state.frequency,
      amp: state.amplitude,
      wavelength: (wl / 100).toFixed(2),
      speed: (state.waveSpeed / 100).toFixed(2),
    };
    state.dataPoints.push(row);

    dom.dataEmpty.style.display = 'none';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.freq}</td><td>${row.amp}</td><td>${row.wavelength}</td><td>${row.speed}</td>`;
    dom.dataTbody.appendChild(tr);

    highlightStep('investigate');
    showToast('Data recorded', 'success');
  });

  // ── Reset ──
  dom.btnReset.addEventListener('click', () => {
    state.running = false;
    state.frozen = false;
    state.time = 0;
    state.pulseMode = false;
    state.pulseTime = -1;
    state.dataPoints = [];
    cancelAnimationFrame(animId);

    dom.btnStart.disabled = false;
    dom.btnFreeze.disabled = true;
    dom.btnFreeze.textContent = 'Freeze';
    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';

    dom.measWavelength.textContent = '—';
    dom.measPeriod.textContent = '—';
    dom.measSpeed.textContent = '—';
    dom.measCheck.textContent = '—';

    highlightStep('setup');
    draw();
    showToast('Simulation reset', 'info');
  });

  // ── Guide toggle ──
  dom.btnToggleGuide.addEventListener('click', () => {
    dom.guidePanel.classList.toggle('collapsed');
  });

  // ── Initial draw ──
  draw();
  updateMeasurements();
});
