/* ============================================================
   Light & Refraction — Physics Simulation
   Canvas-based reflection, refraction, and TIR with Snell's law
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── State ──
  const state = {
    mode: 'reflection',
    angleI: 30,
    n1: 1.50,
    n2: 1.00,
    rayColor: '#ffff33',
    dataPoints: [],
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('light-canvas'),
    modeSelect: $('mode-select'),
    angleI: $('angle-i'),
    angleIVal: $('angle-i-val'),
    medium1: $('medium1'),
    medium2: $('medium2'),
    n1Row: $('n1-row'),
    n2Row: $('n2-row'),
    rayColor: $('ray-color'),
    measI: $('meas-i'),
    measR: $('meas-r'),
    measSinI: $('meas-sin-i'),
    measSinR: $('meas-sin-r'),
    measN: $('meas-n'),
    measNWrap: $('meas-n-wrap'),
    measCritWrap: $('meas-crit-wrap'),
    measCritical: $('meas-critical'),
    btnRecord: $('btn-record'),
    btnReset: $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel: $('guide-panel'),
    dataTbody: $('data-tbody'),
    dataEmpty: $('data-empty'),
    graphCanvas: $('graph-canvas'),
    graphPanel: $('graph-panel'),
  };

  const ctx = dom.canvas.getContext('2d');
  const gCtx = dom.graphCanvas.getContext('2d');

  // ── Canvas sizing ──
  function resizeCanvas() {
    const panel = dom.canvas.parentElement;
    const w = Math.min(panel.clientWidth - 32, 600);
    const h = Math.min(panel.clientHeight - 40, 500);
    dom.canvas.width = w;
    dom.canvas.height = h;
    draw();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Procedure steps ──
  const STEP_ORDER = ['setup', 'adjust', 'record', 'analyse'];
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

  // ── Physics ──
  function calcRefraction(angleIDeg, n1, n2) {
    const angleIRad = angleIDeg * Math.PI / 180;
    const sinR = (n1 * Math.sin(angleIRad)) / n2;
    if (Math.abs(sinR) > 1) return { tir: true, angleR: 90, sinI: Math.sin(angleIRad), sinR: 1 };
    const angleR = Math.asin(sinR) * 180 / Math.PI;
    return { tir: false, angleR, sinI: Math.sin(angleIRad), sinR };
  }

  function calcCriticalAngle(n1, n2) {
    if (n1 <= n2) return null;
    return Math.asin(n2 / n1) * 180 / Math.PI;
  }

  // ── Update measurements ──
  function updateMeasurements() {
    dom.measI.textContent = state.angleI + '°';
    const sinI = Math.sin(state.angleI * Math.PI / 180);
    dom.measSinI.textContent = sinI.toFixed(4);

    if (state.mode === 'reflection') {
      dom.measR.textContent = state.angleI + '°';
      dom.measSinR.textContent = sinI.toFixed(4);
      dom.measN.textContent = '—';
      dom.measNWrap.style.display = 'none';
      dom.measCritWrap.style.display = 'none';
    } else {
      const result = calcRefraction(state.angleI, state.n1, state.n2);
      if (result.tir) {
        dom.measR.textContent = 'TIR';
        dom.measSinR.textContent = '> 1';
        dom.measN.textContent = 'TIR';
      } else {
        dom.measR.textContent = result.angleR.toFixed(1) + '°';
        dom.measSinR.textContent = result.sinR.toFixed(4);
        if (result.sinR > 0.001) {
          dom.measN.textContent = (sinI / result.sinR).toFixed(3);
        } else {
          dom.measN.textContent = '—';
        }
      }
      dom.measNWrap.style.display = '';

      const crit = calcCriticalAngle(state.n1, state.n2);
      if (crit !== null) {
        dom.measCritWrap.style.display = '';
        dom.measCritical.textContent = crit.toFixed(1) + '°';
      } else {
        dom.measCritWrap.style.display = 'none';
      }
    }
  }

  // ── Draw ──
  function draw() {
    const w = dom.canvas.width;
    const h = dom.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const rayLen = Math.min(w, h) * 0.42;

    ctx.clearRect(0, 0, w, h);

    if (state.mode === 'reflection') {
      drawReflection(w, h, cx, cy, rayLen);
    } else {
      drawRefraction(w, h, cx, cy, rayLen);
    }
  }

  function drawReflection(w, h, cx, cy, rayLen) {
    // Dark background
    ctx.fillStyle = '#1e1f2b';
    ctx.fillRect(0, 0, w, h);

    // Mirror surface
    const mirrorLen = rayLen * 1.5;
    ctx.save();
    ctx.translate(cx, cy);

    // Mirror (horizontal at centre)
    const mirrorGrad = ctx.createLinearGradient(-mirrorLen, 0, mirrorLen, 0);
    mirrorGrad.addColorStop(0, 'rgba(160,180,220,0.1)');
    mirrorGrad.addColorStop(0.5, 'rgba(200,210,230,0.4)');
    mirrorGrad.addColorStop(1, 'rgba(160,180,220,0.1)');
    ctx.fillStyle = mirrorGrad;
    ctx.fillRect(-mirrorLen, 0, mirrorLen * 2, 6);

    ctx.strokeStyle = 'rgba(200,210,230,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-mirrorLen, 0);
    ctx.lineTo(mirrorLen, 0);
    ctx.stroke();

    // Hatching below mirror
    ctx.strokeStyle = 'rgba(150,160,180,0.2)';
    ctx.lineWidth = 1;
    for (let x = -mirrorLen; x < mirrorLen; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x + 10, 16);
      ctx.stroke();
    }

    // Normal (dashed vertical line)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, -rayLen * 0.95);
    ctx.lineTo(0, rayLen * 0.3);
    ctx.stroke();
    ctx.setLineDash([]);

    // Normal label
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '500 10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Normal', 5, -rayLen * 0.85);

    const angleRad = state.angleI * Math.PI / 180;

    // Incident ray (coming from upper-left to centre)
    const ix = -Math.sin(angleRad) * rayLen;
    const iy = -Math.cos(angleRad) * rayLen;

    ctx.strokeStyle = state.rayColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = state.rayColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // Reflected ray (upper-right)
    const rx = Math.sin(angleRad) * rayLen;
    const ry = -Math.cos(angleRad) * rayLen;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Arrowhead on reflected ray
    drawArrowhead(ctx, 0, 0, rx, ry, state.rayColor);

    // Angle arcs
    const arcR = 40;
    // Incident angle arc
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, arcR, -Math.PI / 2, -Math.PI / 2 + angleRad, false);
    ctx.stroke();

    // Reflected angle arc
    ctx.strokeStyle = '#06d6a0';
    ctx.beginPath();
    ctx.arc(0, 0, arcR + 5, -Math.PI / 2, -Math.PI / 2 - angleRad, true);
    ctx.stroke();

    // Angle labels
    ctx.font = '600 11px system-ui';
    if (state.angleI > 8) {
      ctx.fillStyle = '#4cc9f0';
      ctx.textAlign = 'left';
      ctx.fillText('i=' + state.angleI + '°', arcR * Math.sin(angleRad / 2) + 8, -arcR * Math.cos(angleRad / 2));

      ctx.fillStyle = '#06d6a0';
      ctx.textAlign = 'right';
      ctx.fillText('r=' + state.angleI + '°', -arcR * Math.sin(angleRad / 2) - 8, -arcR * Math.cos(angleRad / 2));
    }

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '500 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Incident ray', ix * 0.5 - 30, iy * 0.5);
    ctx.fillText('Reflected ray', rx * 0.5 + 30, ry * 0.5);

    ctx.restore();
  }

  function drawRefraction(w, h, cx, cy, rayLen) {
    const isTIR = state.mode === 'tir';

    // Two media - top and bottom halves
    // For TIR: denser medium on top (n1), less dense below (n2)
    // For refraction: less dense on top (n1=air), denser below (n2=glass)

    // Top medium
    const topColor = isTIR ? 'rgba(100, 150, 255, 0.15)' : '#1e1f2b';
    ctx.fillStyle = topColor;
    ctx.fillRect(0, 0, w, cy);

    // Bottom medium
    const bottomColor = isTIR ? '#1e1f2b' : 'rgba(100, 150, 255, 0.15)';
    ctx.fillStyle = bottomColor;
    ctx.fillRect(0, cy, w, h - cy);

    // Interface line
    ctx.strokeStyle = 'rgba(200,210,230,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // Medium labels
    ctx.font = '500 11px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'left';
    if (isTIR) {
      ctx.fillText(`Medium 1: n = ${state.n1}`, 10, 20);
      ctx.fillText(`Medium 2: n = ${state.n2}`, 10, h - 10);
    } else {
      ctx.fillText(`Medium 1: n = ${state.n1}`, 10, 20);
      ctx.fillText(`Medium 2: n = ${state.n2}`, 10, h - 10);
    }

    ctx.save();
    ctx.translate(cx, cy);

    // Normal
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, -rayLen * 0.95);
    ctx.lineTo(0, rayLen * 0.95);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '500 10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('Normal', 5, -rayLen * 0.85);

    const angleRad = state.angleI * Math.PI / 180;

    // For TIR: ray comes from below (denser medium)
    // For refraction: ray comes from above

    let n1Eff, n2Eff;
    if (isTIR) {
      // Ray in denser medium (top) hitting interface going down
      n1Eff = state.n1;
      n2Eff = state.n2;
    } else {
      // Ray from medium 1 (top) into medium 2 (bottom)
      n1Eff = state.n1;
      n2Eff = state.n2;
    }

    const result = calcRefraction(state.angleI, n1Eff, n2Eff);

    // Incident ray (from top-left down to centre)
    const ix = -Math.sin(angleRad) * rayLen;
    const iy = -Math.cos(angleRad) * rayLen;

    ctx.strokeStyle = state.rayColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = state.rayColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(0, 0);
    ctx.stroke();

    if (result.tir) {
      // Total internal reflection
      const rx = Math.sin(angleRad) * rayLen;
      const ry = -Math.cos(angleRad) * rayLen;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rx, ry);
      ctx.stroke();
      drawArrowhead(ctx, 0, 0, rx, ry, state.rayColor);

      // TIR label
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ef476f';
      ctx.font = '700 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('TOTAL INTERNAL REFLECTION', 0, rayLen * 0.5);

      // Faint evanescent wave (optional visual)
      ctx.strokeStyle = 'rgba(255,255,100,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 30);
      ctx.stroke();
    } else {
      // Refracted ray
      const refAngleRad = result.angleR * Math.PI / 180;
      const rx = Math.sin(refAngleRad) * rayLen;
      const ry = Math.cos(refAngleRad) * rayLen;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rx, ry);
      ctx.stroke();
      ctx.shadowBlur = 0;
      drawArrowhead(ctx, 0, 0, rx, ry, state.rayColor);

      // Partial reflection (faint)
      const reflX = Math.sin(angleRad) * rayLen * 0.6;
      const reflY = -Math.cos(angleRad) * rayLen * 0.6;
      ctx.strokeStyle = state.rayColor;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(reflX, reflY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Refraction angle arc
      ctx.strokeStyle = '#06d6a0';
      ctx.lineWidth = 1.5;
      const arcR2 = 45;
      ctx.beginPath();
      ctx.arc(0, 0, arcR2, Math.PI / 2, Math.PI / 2 - refAngleRad, true);
      ctx.stroke();

      if (result.angleR > 5) {
        ctx.fillStyle = '#06d6a0';
        ctx.font = '600 11px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('r=' + result.angleR.toFixed(1) + '°', arcR2 * Math.sin(refAngleRad / 2) + 8, arcR2 * Math.cos(refAngleRad / 2));
      }
    }

    // Incidence angle arc
    const arcR = 40;
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, arcR, -Math.PI / 2, -Math.PI / 2 + angleRad, false);
    ctx.stroke();

    if (state.angleI > 5) {
      ctx.fillStyle = '#4cc9f0';
      ctx.font = '600 11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('i=' + state.angleI + '°', -8, -arcR * Math.cos(angleRad / 2) + 4);
    }

    // Critical angle marker (if applicable)
    const critAngle = calcCriticalAngle(n1Eff, n2Eff);
    if (critAngle !== null) {
      const critRad = critAngle * Math.PI / 180;
      ctx.strokeStyle = 'rgba(239, 71, 111, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.sin(critRad) * rayLen * 0.7, -Math.cos(critRad) * rayLen * 0.7);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(239, 71, 111, 0.5)';
      ctx.font = '500 9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('c=' + critAngle.toFixed(1) + '°', -Math.sin(critRad) * rayLen * 0.72 - 5, -Math.cos(critRad) * rayLen * 0.72);
    }

    ctx.restore();
  }

  function drawArrowhead(ctx, fromX, fromY, toX, toY, color) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const size = 10;
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(midX + size * Math.cos(angle), midY + size * Math.sin(angle));
    ctx.lineTo(midX + size * 0.5 * Math.cos(angle - Math.PI * 0.7), midY + size * 0.5 * Math.sin(angle - Math.PI * 0.7));
    ctx.lineTo(midX + size * 0.5 * Math.cos(angle + Math.PI * 0.7), midY + size * 0.5 * Math.sin(angle + Math.PI * 0.7));
    ctx.closePath();
    ctx.fill();
  }

  // ── Graph (sin i vs sin r) ──
  function drawGraph() {
    const w = dom.graphCanvas.width;
    const h = dom.graphCanvas.height;
    const pad = { t: 20, r: 15, b: 30, l: 40 };
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
    gCtx.fillText('sin(i)', w / 2, h - 5);
    gCtx.save();
    gCtx.translate(12, h / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText('sin(r)', 0, 0);
    gCtx.restore();

    // Axis scale marks
    gCtx.font = '500 8px system-ui';
    gCtx.fillStyle = '#999';
    gCtx.textAlign = 'center';
    for (let v = 0; v <= 1; v += 0.2) {
      const x = pad.l + v * plotW;
      const y = h - pad.b - v * plotH;
      gCtx.fillText(v.toFixed(1), x, h - pad.b + 12);
      gCtx.textAlign = 'right';
      gCtx.fillText(v.toFixed(1), pad.l - 5, y + 3);
      gCtx.textAlign = 'center';
    }

    if (state.dataPoints.length < 1) return;

    // Plot points
    state.dataPoints.forEach(d => {
      const x = pad.l + d.sinI * plotW;
      const y = h - pad.b - d.sinR * plotH;
      gCtx.fillStyle = '#f77f00';
      gCtx.beginPath();
      gCtx.arc(x, y, 4, 0, Math.PI * 2);
      gCtx.fill();
    });

    // Best fit line (if enough points)
    if (state.dataPoints.length >= 2) {
      const pts = state.dataPoints.filter(d => d.sinR < 1);
      if (pts.length >= 2) {
        // Simple linear regression through origin: slope = sum(sinI*sinR)/sum(sinI^2)
        let sumXY = 0, sumXX = 0;
        pts.forEach(d => { sumXY += d.sinI * d.sinR; sumXX += d.sinI * d.sinI; });
        const slope = sumXY / sumXX;

        gCtx.strokeStyle = 'rgba(247, 127, 0, 0.4)';
        gCtx.lineWidth = 1.5;
        gCtx.setLineDash([4, 4]);
        gCtx.beginPath();
        gCtx.moveTo(pad.l, h - pad.b);
        const endSinI = Math.min(1, 1 / slope);
        gCtx.lineTo(pad.l + endSinI * plotW, h - pad.b - endSinI * slope * plotH);
        gCtx.stroke();
        gCtx.setLineDash([]);

        // Show gradient
        gCtx.fillStyle = '#f77f00';
        gCtx.font = '600 10px system-ui';
        gCtx.textAlign = 'right';
        gCtx.fillText(`gradient = ${slope.toFixed(3)}`, w - pad.r, pad.t + 12);
      }
    }
  }

  // ── Controls ──
  dom.modeSelect.addEventListener('change', () => {
    state.mode = dom.modeSelect.value;
    const isRefl = state.mode === 'reflection';
    dom.n1Row.style.display = isRefl ? 'none' : '';
    dom.n2Row.style.display = isRefl ? 'none' : '';
    dom.graphPanel.style.display = isRefl ? 'none' : '';

    if (state.mode === 'tir') {
      // Default for TIR: glass to air
      dom.medium1.value = '1.50';
      dom.medium2.value = '1.00';
      state.n1 = 1.50;
      state.n2 = 1.00;
    }

    highlightStep('setup');
    updateMeasurements();
    draw();
  });

  dom.angleI.addEventListener('input', () => {
    state.angleI = parseInt(dom.angleI.value);
    dom.angleIVal.textContent = state.angleI + '°';
    highlightStep('adjust');
    updateMeasurements();
    draw();
  });

  dom.medium1.addEventListener('change', () => {
    state.n1 = parseFloat(dom.medium1.value);
    updateMeasurements();
    draw();
  });

  dom.medium2.addEventListener('change', () => {
    state.n2 = parseFloat(dom.medium2.value);
    updateMeasurements();
    draw();
  });

  dom.rayColor.addEventListener('change', () => {
    state.rayColor = dom.rayColor.value;
    draw();
  });

  dom.btnRecord.addEventListener('click', () => {
    const sinI = Math.sin(state.angleI * Math.PI / 180);
    const result = calcRefraction(state.angleI, state.n1, state.n2);

    const row = {
      angleI: state.angleI,
      angleR: result.tir ? 'TIR' : result.angleR.toFixed(1),
      sinI: sinI,
      sinR: result.sinR,
    };
    state.dataPoints.push(row);

    dom.dataEmpty.style.display = 'none';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.angleI}</td><td>${row.angleR}</td><td>${sinI.toFixed(4)}</td><td>${result.tir ? '> 1' : result.sinR.toFixed(4)}</td>`;
    dom.dataTbody.appendChild(tr);

    highlightStep('record');
    drawGraph();
    showToast('Data recorded', 'success');

    if (state.dataPoints.length >= 3) highlightStep('analyse');
  });

  // ── Reset ──
  dom.btnReset.addEventListener('click', () => {
    state.angleI = 30;
    state.dataPoints = [];
    dom.angleI.value = 30;
    dom.angleIVal.textContent = '30°';
    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';

    highlightStep('setup');
    updateMeasurements();
    draw();
    drawGraph();
    showToast('Simulation reset', 'info');
  });

  // ── Guide toggle ──
  dom.btnToggleGuide.addEventListener('click', () => {
    dom.guidePanel.classList.toggle('collapsed');
  });

  // ── Initial setup ──
  // Hide n1/n2 and graph for reflection mode
  dom.n1Row.style.display = 'none';
  dom.n2Row.style.display = 'none';
  dom.graphPanel.style.display = 'none';

  updateMeasurements();
  draw();
  drawGraph();
});
