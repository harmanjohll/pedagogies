/* ============================================================
   Diffusion & Osmosis — Biology Simulation
   Canvas-based particle simulation with membrane, data collection
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── State ──
  const state = {
    mode: 'diffusion',
    running: false,
    time: 0,
    particles: [],
    permeability: 5,
    temperature: 25,
    dataPoints: [],
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('diff-canvas'),
    modeSelect: $('mode-select'),
    concLeft: $('conc-left'),
    concLeftVal: $('conc-left-val'),
    concRight: $('conc-right'),
    concRightVal: $('conc-right-val'),
    permeability: $('permeability'),
    permVal: $('perm-val'),
    temperature: $('temperature'),
    tempVal: $('temp-val'),
    btnStart: $('btn-start'),
    btnPause: $('btn-pause'),
    btnRecord: $('btn-record'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel: $('guide-panel'),
    timerDisplay: $('timer-display'),
    dataTbody: $('data-tbody'),
    dataEmpty: $('data-empty'),
    graphCanvas: $('graph-canvas'),
  };

  const ctx = dom.canvas.getContext('2d');
  const gCtx = dom.graphCanvas.getContext('2d');

  // ── Canvas sizing ──
  function resizeCanvas() {
    const panel = dom.canvas.parentElement;
    const w = Math.min(panel.clientWidth - 32, 650);
    const h = Math.min(panel.clientHeight - 100, 450);
    dom.canvas.width = w;
    dom.canvas.height = h;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Procedure steps ──
  const STEP_ORDER = ['setup', 'observe', 'record', 'analyse'];
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

  // ── Particle class ──
  function createParticle(x, y, type) {
    const speedMul = state.temperature / 25;
    return {
      x, y,
      vx: (Math.random() - 0.5) * 2 * speedMul,
      vy: (Math.random() - 0.5) * 2 * speedMul,
      type, // 'solute' or 'water'
      radius: type === 'solute' ? 4 : 3,
      color: type === 'solute' ? '#ef476f' : '#4cc9f0',
    };
  }

  // ── Initialise particles ──
  function initParticles() {
    state.particles = [];
    const w = dom.canvas.width;
    const h = dom.canvas.height;
    const midX = w / 2;
    const nLeft = parseInt(dom.concLeft.value);
    const nRight = parseInt(dom.concRight.value);

    if (state.mode === 'diffusion') {
      // Solute particles on both sides
      for (let i = 0; i < nLeft; i++) {
        state.particles.push(createParticle(
          Math.random() * (midX - 20) + 10,
          Math.random() * (h - 20) + 10,
          'solute'
        ));
      }
      for (let i = 0; i < nRight; i++) {
        state.particles.push(createParticle(
          midX + 10 + Math.random() * (midX - 20),
          Math.random() * (h - 20) + 10,
          'solute'
        ));
      }
    } else {
      // Osmosis: solute fixed, water moves
      // More solute on left = lower water potential on left
      for (let i = 0; i < nLeft; i++) {
        state.particles.push(createParticle(
          Math.random() * (midX - 20) + 10,
          Math.random() * (h - 20) + 10,
          'solute'
        ));
      }
      for (let i = 0; i < nRight; i++) {
        state.particles.push(createParticle(
          midX + 10 + Math.random() * (midX - 20),
          Math.random() * (h - 20) + 10,
          'solute'
        ));
      }
      // Water molecules — more on the dilute side (right if right has fewer solute)
      const waterLeft = 60 - nLeft;
      const waterRight = 60 - nRight;
      for (let i = 0; i < Math.max(5, waterLeft); i++) {
        state.particles.push(createParticle(
          Math.random() * (midX - 20) + 10,
          Math.random() * (h - 20) + 10,
          'water'
        ));
      }
      for (let i = 0; i < Math.max(5, waterRight); i++) {
        state.particles.push(createParticle(
          midX + 10 + Math.random() * (midX - 20),
          Math.random() * (h - 20) + 10,
          'water'
        ));
      }
    }
  }

  // ── Count particles per side ──
  function countSides() {
    const midX = dom.canvas.width / 2;
    let leftSolute = 0, rightSolute = 0, leftWater = 0, rightWater = 0;
    for (const p of state.particles) {
      if (p.x < midX) {
        if (p.type === 'solute') leftSolute++; else leftWater++;
      } else {
        if (p.type === 'solute') rightSolute++; else rightWater++;
      }
    }
    return { leftSolute, rightSolute, leftWater, rightWater };
  }

  // ── Physics update ──
  function update(dt) {
    const w = dom.canvas.width;
    const h = dom.canvas.height;
    const midX = w / 2;
    const perm = state.permeability / 10; // 0.1 to 1.0
    const speedMul = state.temperature / 25;
    const membraneGap = 6; // membrane visual width

    for (const p of state.particles) {
      // Brownian motion nudge
      p.vx += (Math.random() - 0.5) * 0.5 * speedMul;
      p.vy += (Math.random() - 0.5) * 0.5 * speedMul;

      // Speed limit
      const maxSpeed = 3 * speedMul;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      const nx = p.x + p.vx;
      const ny = p.y + p.vy;

      // Membrane crossing check
      const crossingMembrane = (p.x < midX && nx >= midX) || (p.x >= midX && nx < midX);

      if (crossingMembrane) {
        // In diffusion mode: solute can cross based on permeability
        // In osmosis mode: only water can cross, solute is blocked
        let canCross = false;
        if (state.mode === 'diffusion' && p.type === 'solute') {
          canCross = Math.random() < perm;
        } else if (state.mode === 'osmosis' && p.type === 'water') {
          canCross = Math.random() < perm;
        }

        if (!canCross) {
          // Bounce off membrane
          p.vx = -p.vx * 0.8;
          p.x = p.x < midX ? midX - membraneGap : midX + membraneGap;
        } else {
          p.x = nx;
        }
      } else {
        p.x = nx;
      }

      p.y = ny;

      // Wall bouncing
      if (p.x < p.radius) { p.x = p.radius; p.vx = Math.abs(p.vx); }
      if (p.x > w - p.radius) { p.x = w - p.radius; p.vx = -Math.abs(p.vx); }
      if (p.y < p.radius) { p.y = p.radius; p.vy = Math.abs(p.vy); }
      if (p.y > h - p.radius) { p.y = h - p.radius; p.vy = -Math.abs(p.vy); }
    }
  }

  // ── Draw ──
  function draw() {
    const w = dom.canvas.width;
    const h = dom.canvas.height;
    const midX = w / 2;

    ctx.clearRect(0, 0, w, h);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#1e1f2b');
    bgGrad.addColorStop(0.6, '#252638');
    bgGrad.addColorStop(1, '#2d2e42');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Container outline
    ctx.strokeStyle = 'rgba(160, 170, 195, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Side labels
    ctx.font = '600 12px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('Side A', midX / 2, 20);
    ctx.fillText('Side B', midX + midX / 2, 20);

    // Membrane
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Membrane pores
    const poreCount = Math.round(state.permeability * 1.5);
    const poreSpacing = h / (poreCount + 1);
    for (let i = 1; i <= poreCount; i++) {
      const py = i * poreSpacing;
      ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(midX, py, 3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Membrane label
    ctx.save();
    ctx.font = '500 10px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.translate(midX, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('PARTIALLY PERMEABLE MEMBRANE', 0, -10);
    ctx.restore();

    // Draw particles
    for (const p of state.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

      // Glow effect
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight
      ctx.beginPath();
      ctx.arc(p.x - 1, p.y - 1, p.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    }

    // Particle count overlay
    const counts = countSides();
    ctx.font = '600 13px system-ui';
    ctx.textAlign = 'center';

    if (state.mode === 'diffusion') {
      ctx.fillStyle = '#ef476f';
      ctx.fillText(`Solute: ${counts.leftSolute}`, midX / 2, h - 15);
      ctx.fillText(`Solute: ${counts.rightSolute}`, midX + midX / 2, h - 15);
    } else {
      ctx.fillStyle = '#ef476f';
      ctx.fillText(`Solute: ${counts.leftSolute}`, midX / 2, h - 30);
      ctx.fillText(`Solute: ${counts.rightSolute}`, midX + midX / 2, h - 30);
      ctx.fillStyle = '#4cc9f0';
      ctx.fillText(`Water: ${counts.leftWater}`, midX / 2, h - 12);
      ctx.fillText(`Water: ${counts.rightWater}`, midX + midX / 2, h - 12);
    }

    // Legend
    ctx.textAlign = 'left';
    ctx.font = '500 11px system-ui';
    ctx.fillStyle = '#ef476f';
    ctx.beginPath(); ctx.arc(15, h - 15, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillText('Solute', 24, h - 11);
    if (state.mode === 'osmosis') {
      ctx.fillStyle = '#4cc9f0';
      ctx.beginPath(); ctx.arc(15, h - 30, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillText('Water', 24, h - 26);
    }
  }

  // ── Graph ──
  function drawGraph() {
    const w = dom.graphCanvas.width;
    const h = dom.graphCanvas.height;
    const pad = { t: 20, r: 15, b: 30, l: 35 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    gCtx.clearRect(0, 0, w, h);
    gCtx.fillStyle = '#fff';
    gCtx.fillRect(0, 0, w, h);

    // Axes
    gCtx.strokeStyle = '#ccc';
    gCtx.lineWidth = 1;
    gCtx.beginPath();
    gCtx.moveTo(pad.l, pad.t);
    gCtx.lineTo(pad.l, h - pad.b);
    gCtx.lineTo(w - pad.r, h - pad.b);
    gCtx.stroke();

    // Labels
    gCtx.font = '500 10px system-ui';
    gCtx.fillStyle = '#666';
    gCtx.textAlign = 'center';
    gCtx.fillText('Time (s)', w / 2, h - 5);
    gCtx.save();
    gCtx.translate(10, h / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText('Count', 0, 0);
    gCtx.restore();

    if (state.dataPoints.length < 2) return;

    const maxTime = Math.max(...state.dataPoints.map(d => d.time));
    const maxCount = Math.max(...state.dataPoints.flatMap(d => [d.left, d.right])) + 5;

    function px(t) { return pad.l + (t / maxTime) * plotW; }
    function py(c) { return h - pad.b - (c / maxCount) * plotH; }

    // Left line
    gCtx.strokeStyle = '#ef476f';
    gCtx.lineWidth = 2;
    gCtx.beginPath();
    state.dataPoints.forEach((d, i) => {
      const fn = i === 0 ? 'moveTo' : 'lineTo';
      gCtx[fn](px(d.time), py(d.left));
    });
    gCtx.stroke();

    // Right line
    gCtx.strokeStyle = '#06d6a0';
    gCtx.beginPath();
    state.dataPoints.forEach((d, i) => {
      const fn = i === 0 ? 'moveTo' : 'lineTo';
      gCtx[fn](px(d.time), py(d.right));
    });
    gCtx.stroke();

    // Legend
    gCtx.font = '500 9px system-ui';
    gCtx.fillStyle = '#ef476f';
    gCtx.fillText('Side A', w - pad.r - 30, pad.t + 10);
    gCtx.fillStyle = '#06d6a0';
    gCtx.fillText('Side B', w - pad.r - 30, pad.t + 22);
  }

  // ── Animation loop ──
  let lastTime = 0;
  let animId = null;

  function loop(timestamp) {
    if (!state.running) return;
    const dt = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
    lastTime = timestamp;

    state.time += dt;
    dom.timerDisplay.textContent = state.time.toFixed(1) + ' s';

    // Run multiple substeps for smoother physics
    for (let i = 0; i < 3; i++) update(dt / 3);

    draw();
    animId = requestAnimationFrame(loop);
  }

  // ── Controls ──
  dom.concLeft.addEventListener('input', () => {
    dom.concLeftVal.textContent = dom.concLeft.value;
  });
  dom.concRight.addEventListener('input', () => {
    dom.concRightVal.textContent = dom.concRight.value;
  });
  dom.permeability.addEventListener('input', () => {
    state.permeability = parseInt(dom.permeability.value);
    dom.permVal.textContent = state.permeability;
  });
  dom.temperature.addEventListener('input', () => {
    state.temperature = parseInt(dom.temperature.value);
    dom.tempVal.textContent = state.temperature + ' °C';
  });
  dom.modeSelect.addEventListener('change', () => {
    state.mode = dom.modeSelect.value;
    if (!state.running) {
      initParticles();
      draw();
    }
  });

  dom.btnStart.addEventListener('click', () => {
    if (state.running) return;
    initParticles();
    state.running = true;
    state.time = 0;
    state.dataPoints = [];
    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';
    lastTime = 0;

    dom.btnStart.disabled = true;
    dom.btnPause.disabled = false;
    dom.btnRecord.disabled = false;
    dom.concLeft.disabled = true;
    dom.concRight.disabled = true;
    dom.modeSelect.disabled = true;

    highlightStep('observe');
    showToast('Simulation started', 'info');
    animId = requestAnimationFrame(loop);
  });

  dom.btnPause.addEventListener('click', () => {
    if (state.running) {
      state.running = false;
      dom.btnPause.textContent = 'Resume';
      cancelAnimationFrame(animId);
    } else {
      state.running = true;
      dom.btnPause.textContent = 'Pause';
      lastTime = 0;
      animId = requestAnimationFrame(loop);
    }
  });

  dom.btnRecord.addEventListener('click', () => {
    const counts = countSides();
    const isOsmosis = state.mode === 'osmosis';
    const leftVal = isOsmosis ? counts.leftWater : counts.leftSolute;
    const rightVal = isOsmosis ? counts.rightWater : counts.rightSolute;

    state.dataPoints.push({
      time: parseFloat(state.time.toFixed(1)),
      left: leftVal,
      right: rightVal,
    });

    dom.dataEmpty.style.display = 'none';
    const row = document.createElement('tr');
    row.innerHTML = `<td>${state.time.toFixed(1)}</td><td>${leftVal}</td><td>${rightVal}</td>`;
    dom.dataTbody.appendChild(row);

    highlightStep('record');
    drawGraph();
    showToast('Data recorded', 'success');

    if (state.dataPoints.length >= 3) {
      highlightStep('analyse');
    }
  });

  // ── Reset ──
  dom.btnReset.addEventListener('click', () => {
    state.running = false;
    state.time = 0;
    state.dataPoints = [];
    cancelAnimationFrame(animId);

    dom.btnStart.disabled = false;
    dom.btnPause.disabled = true;
    dom.btnPause.textContent = 'Pause';
    dom.btnRecord.disabled = true;
    dom.concLeft.disabled = false;
    dom.concRight.disabled = false;
    dom.modeSelect.disabled = false;
    dom.timerDisplay.textContent = '0.0 s';
    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';

    highlightStep('setup');
    initParticles();
    draw();
    drawGraph();
    showToast('Simulation reset', 'info');
  });

  // ── Guide toggle ──
  dom.btnToggleGuide.addEventListener('click', () => {
    dom.guidePanel.classList.toggle('collapsed');
  });

  // ── Initial draw ──
  initParticles();
  draw();
  drawGraph();
});
