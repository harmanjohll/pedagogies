/* ============================================================
   Ohm's Law — Circuit Simulation
   Canvas-based circuit diagram with ammeter/voltmeter readings,
   data collection, and V–I graphing.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── State ──
  const state = {
    emf: 2.0,
    resistance: 47,
    switchClosed: false,
    current: 0,
    voltage: 0,
    dataPoints: [],
    procedureDone: { setup: false, close: false, record: false, vary: false, graph: false, calculate: false },
  };

  // ── DOM ──
  const $ = id => document.getElementById(id);
  const dom = {
    canvas: $('circuit-canvas'),
    emfSlider: $('emf-slider'),
    emfDisplay: $('emf-display'),
    resistorSelect: $('resistor-select'),
    btnSwitch: $('btn-switch'),
    meterReadings: $('meter-readings'),
    ammeterValue: $('ammeter-value'),
    voltmeterValue: $('voltmeter-value'),
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
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(panel.clientWidth - 32, 560);
    const h = Math.min(panel.clientHeight - 100, 420);
    dom.canvas.width = w * dpr;
    dom.canvas.height = h * dpr;
    dom.canvas.style.width = w + 'px';
    dom.canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCircuit();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Config ──
  dom.emfSlider.addEventListener('input', () => {
    state.emf = parseFloat(dom.emfSlider.value);
    dom.emfDisplay.textContent = state.emf.toFixed(1) + ' V';
    if (state.switchClosed) updateReadings();
    drawCircuit();
  });

  dom.resistorSelect.addEventListener('change', () => {
    state.resistance = parseInt(dom.resistorSelect.value);
    if (state.switchClosed) updateReadings();
    drawCircuit();
  });


  // ══════════════════════════════════════
  // SWITCH
  // ══════════════════════════════════════

  dom.btnSwitch.addEventListener('click', () => {
    state.switchClosed = !state.switchClosed;
    dom.btnSwitch.textContent = state.switchClosed ? 'Open Switch' : 'Close Switch';
    dom.btnSwitch.className = state.switchClosed
      ? 'btn btn-ghost btn-sm w-full'
      : 'btn btn-primary btn-sm w-full';

    if (state.switchClosed) {
      updateReadings();
      dom.meterReadings.style.display = '';
      markProcedure('close');
      toast('Switch closed — current flowing.');
    } else {
      state.current = 0;
      state.voltage = 0;
      dom.ammeterValue.textContent = '0.000 A';
      dom.voltmeterValue.textContent = '0.00 V';
      dom.meterReadings.style.display = 'none';
    }
    drawCircuit();
  });

  function updateReadings() {
    // V = EMF (ideal battery, negligible internal resistance)
    // I = V / R + small noise
    const noise = (Math.random() - 0.5) * 0.002;
    state.voltage = state.emf;
    state.current = (state.voltage / state.resistance) + noise;
    if (state.current < 0) state.current = 0;

    dom.ammeterValue.textContent = state.current.toFixed(3) + ' A';
    dom.voltmeterValue.textContent = state.voltage.toFixed(2) + ' V';
  }


  // ══════════════════════════════════════
  // RECORD
  // ══════════════════════════════════════

  /* ── LabRecordMode integration ── */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  dom.btnRecord.addEventListener('click', () => {
    if (!state.switchClosed) { toast('Close the switch first.', 'warn'); return; }

    let dp;

    /* In independent mode, require manual entry of V and I */
    if (typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided()) {
      const userV = prompt('Enter the voltmeter reading (V):');
      if (userV === null) return;
      const userI = prompt('Enter the ammeter reading (A):');
      if (userI === null) return;
      const vVal = parseFloat(userV);
      const iVal = parseFloat(userI);
      if (isNaN(vVal) || vVal < 0 || isNaN(iVal) || iVal < 0) {
        toast('Please enter valid positive numbers for V and I.', 'warn');
        return;
      }
      dp = { voltage: vVal, current: iVal };
    } else {
      dp = { voltage: state.voltage, current: state.current };
    }

    state.dataPoints.push(dp);

    dom.dataEmpty.style.display = 'none';
    const row = document.createElement('tr');
    row.className = 'animate-fade-in';
    row.innerHTML = `<td>${dp.voltage.toFixed(2)}</td><td>${dp.current.toFixed(3)}</td>`;
    dom.dataTbody.appendChild(row);

    markProcedure('record');
    if (state.dataPoints.length >= 2) markProcedure('vary');

    drawGraph();
    if (state.dataPoints.length >= 3) calculateR();

    toast(`Recorded: V=${dp.voltage.toFixed(2)} V, I=${dp.current.toFixed(3)} A`);
  });


  // ══════════════════════════════════════
  // CIRCUIT DRAWING
  // ══════════════════════════════════════

  function drawCircuit() {
    const dpr = window.devicePixelRatio || 1;
    const W = dom.canvas.width / dpr;
    const H = dom.canvas.height / dpr;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    const hw = 200; // half-width of circuit rectangle
    const hh = 130; // half-height

    const wireColor = state.switchClosed ? '#60a5fa' : 'rgba(200, 210, 230, 0.5)';
    const wireWidth = state.switchClosed ? 2.5 : 2;

    ctx.strokeStyle = wireColor;
    ctx.lineWidth = wireWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ── Wires (rectangular path) ──
    // Top wire: left corner → switch → ammeter → right corner
    // Right wire: right corner → down to bottom-right
    // Bottom wire: bottom-right → resistor → bottom-left
    // Left wire: bottom-left → up → battery → top-left

    const tl = { x: cx - hw, y: cy - hh };
    const tr = { x: cx + hw, y: cy - hh };
    const br = { x: cx + hw, y: cy + hh };
    const bl = { x: cx - hw, y: cy + hh };

    // Top wire (with gap for switch and ammeter)
    const switchX = cx - 80;
    const ammeterX = cx + 60;

    // Left wire segment (tl to switch)
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(switchX - 20, tl.y);
    ctx.stroke();

    // Switch
    drawSwitch(switchX, tl.y, state.switchClosed);

    // Switch to ammeter
    ctx.beginPath();
    ctx.moveTo(switchX + 20, tl.y);
    ctx.lineTo(ammeterX - 22, tl.y);
    ctx.stroke();

    // Ammeter
    drawMeter(ammeterX, tl.y, 'A', '#ef4444');

    // Ammeter to top-right
    ctx.beginPath();
    ctx.moveTo(ammeterX + 22, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.stroke();

    // Right wire
    ctx.beginPath();
    ctx.moveTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.stroke();

    // Bottom wire (with resistor)
    const resistorX = cx;
    ctx.beginPath();
    ctx.moveTo(br.x, br.y);
    ctx.lineTo(resistorX + 40, br.y);
    ctx.stroke();

    drawResistor(resistorX, br.y);

    ctx.beginPath();
    ctx.moveTo(resistorX - 40, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.stroke();

    // Left wire (with battery)
    const batteryY = cy;
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y);
    ctx.lineTo(bl.x, batteryY + 18);
    ctx.stroke();

    drawBattery(tl.x, batteryY);

    ctx.beginPath();
    ctx.moveTo(tl.x, batteryY - 18);
    ctx.lineTo(tl.x, tl.y);
    ctx.stroke();

    // Voltmeter (in parallel across resistor)
    const vmY = Math.min(br.y + 55, H - 30);
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = wireWidth * 0.8;

    // Left branch down from bottom wire
    ctx.beginPath();
    ctx.moveTo(resistorX - 55, br.y);
    ctx.lineTo(resistorX - 55, vmY);
    ctx.lineTo(cx - 22, vmY);
    ctx.stroke();

    drawMeter(cx, vmY, 'V', '#3b82f6');

    ctx.strokeStyle = wireColor;
    ctx.lineWidth = wireWidth * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + 22, vmY);
    ctx.lineTo(resistorX + 55, vmY);
    ctx.lineTo(resistorX + 55, br.y);
    ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';

    // Battery label
    ctx.fillText(`EMF = ${state.emf.toFixed(1)} V`, tl.x - 55, batteryY + 4);

    // Resistor label
    ctx.fillText(`R = ${state.resistance} Ω`, resistorX, br.y - 22);

    // Current direction arrows (when flowing)
    if (state.switchClosed) {
      drawArrow(cx - 30, tl.y, 1, 0, wireColor);     // top wire →
      drawArrow(tr.x, cy, 0, 1, wireColor);           // right wire ↓
      drawArrow(cx + 30, br.y, -1, 0, wireColor);     // bottom wire ←
      drawArrow(tl.x, cy + 50, 0, -1, wireColor);     // left wire ↑

      // "Current flowing" indicator
      ctx.fillStyle = 'rgba(96, 165, 250, 0.5)';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('I', cx - 30, tl.y - 12);
    }

    // Info text
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (!state.switchClosed) {
      ctx.fillText('Close the switch to complete the circuit', cx, H - 12);
    }
  }

  function drawSwitch(x, y, closed) {
    ctx.save();
    // Fixed terminal
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.arc(x - 18, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 18, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Switch arm
    ctx.strokeStyle = closed ? '#60a5fa' : '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 18, y);
    if (closed) {
      ctx.lineTo(x + 18, y);
    } else {
      ctx.lineTo(x + 10, y - 18);
    }
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(closed ? 'ON' : 'OFF', x, y - 20);
    ctx.restore();
  }

  function drawMeter(x, y, symbol, color) {
    const r = 20;
    ctx.save();
    // Circle
    ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Symbol
    ctx.fillStyle = color;
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, x, y);
    ctx.restore();
  }

  function drawResistor(x, y) {
    ctx.save();
    const wireColor = state.switchClosed ? '#60a5fa' : 'rgba(200, 210, 230, 0.5)';
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = 2;

    // Zigzag resistor symbol
    const segments = 6;
    const segW = 80 / segments;
    const amp = 10;

    ctx.beginPath();
    ctx.moveTo(x - 40, y);
    for (let i = 0; i < segments; i++) {
      const sx = x - 40 + (i + 0.25) * segW;
      const ex = x - 40 + (i + 0.75) * segW;
      const dir = i % 2 === 0 ? -1 : 1;
      ctx.lineTo(sx, y + dir * amp);
      ctx.lineTo(ex, y - dir * amp);
    }
    ctx.lineTo(x + 40, y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBattery(x, y) {
    ctx.save();
    // Long line (+)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 14);
    ctx.lineTo(x + 12, y - 14);
    ctx.stroke();

    // Short line (-)
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 14);
    ctx.lineTo(x + 7, y + 14);
    ctx.stroke();

    // + and - labels
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+', x + 20, y - 10);
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('−', x + 20, y + 18);
    ctx.restore();
  }

  function drawArrow(x, y, dx, dy, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    const size = 6;
    ctx.moveTo(x + dx * size, y + dy * size);
    ctx.lineTo(x - dy * size * 0.5 - dx * size, y + dx * size * 0.5 - dy * size);
    ctx.lineTo(x + dy * size * 0.5 - dx * size, y - dx * size * 0.5 - dy * size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Initial draw
  drawCircuit();


  // ══════════════════════════════════════
  // V-I GRAPH
  // ══════════════════════════════════════

  function drawGraph() {
    const W = dom.graphCanvas.width;
    const H = dom.graphCanvas.height;
    const pad = { top: 20, right: 15, bottom: 35, left: 50 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    gCtx.clearRect(0, 0, W, H);
    if (state.dataPoints.length === 0) return;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const axisColor = isDark ? '#9ca3af' : '#374151';
    const gridColor = isDark ? '#4b5563' : '#e5e7eb';
    const labelColor = isDark ? '#d1d5db' : '#6b7280';

    const maxV = Math.max(13, ...state.dataPoints.map(d => d.voltage)) * 1.1;
    const maxI = Math.max(0.15, ...state.dataPoints.map(d => d.current)) * 1.2;

    // Axes
    gCtx.strokeStyle = axisColor;
    gCtx.lineWidth = 1;
    gCtx.beginPath();
    gCtx.moveTo(pad.left, pad.top);
    gCtx.lineTo(pad.left, H - pad.bottom);
    gCtx.lineTo(W - pad.right, H - pad.bottom);
    gCtx.stroke();

    // Grid
    gCtx.strokeStyle = gridColor;
    gCtx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const y = pad.top + (plotH * i / 5);
      gCtx.beginPath(); gCtx.moveTo(pad.left, y); gCtx.lineTo(W - pad.right, y); gCtx.stroke();
      const x = pad.left + (plotW * i / 5);
      gCtx.beginPath(); gCtx.moveTo(x, pad.top); gCtx.lineTo(x, H - pad.bottom); gCtx.stroke();
    }

    // Axis labels
    gCtx.fillStyle = labelColor;
    gCtx.font = '9px Inter, sans-serif';
    gCtx.textAlign = 'center';
    gCtx.fillText('I / A', W / 2, H - 5);
    gCtx.save();
    gCtx.translate(12, pad.top + plotH / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText('V / V', 0, 0);
    gCtx.restore();

    // Tick labels — X axis (I)
    gCtx.fillStyle = labelColor;
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'top';
    for (let i = 0; i <= 5; i++) {
      const val = (maxI * i / 5).toFixed(2);
      gCtx.fillText(val, pad.left + (plotW * i / 5), H - pad.bottom + 4);
    }
    // Y axis (V)
    gCtx.textAlign = 'right';
    gCtx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const val = (maxV * (5 - i) / 5).toFixed(1);
      gCtx.fillText(val, pad.left - 5, pad.top + (plotH * i / 5));
    }

    // Data points — V on Y axis, I on X axis
    const toX = i => pad.left + (i / maxI) * plotW;
    const toY = v => pad.top + plotH - (v / maxV) * plotH;

    gCtx.fillStyle = '#f77f00';
    state.dataPoints.forEach(d => {
      gCtx.beginPath();
      gCtx.arc(toX(d.current), toY(d.voltage), 4, 0, Math.PI * 2);
      gCtx.fill();
    });

    // Best-fit line through origin: V = R * I
    if (state.dataPoints.length >= 2) {
      let sumVI = 0, sumI2 = 0;
      state.dataPoints.forEach(d => {
        sumVI += d.voltage * d.current;
        sumI2 += d.current * d.current;
      });
      const gradient = sumVI / sumI2; // = R

      gCtx.strokeStyle = '#f77f00';
      gCtx.lineWidth = 1.5;
      gCtx.setLineDash([4, 3]);
      gCtx.beginPath();
      gCtx.moveTo(toX(0), toY(0));
      const endI = maxI;
      gCtx.lineTo(toX(endI), toY(gradient * endI));
      gCtx.stroke();
      gCtx.setLineDash([]);

      gCtx.fillStyle = '#f77f00';
      gCtx.font = '10px Inter, sans-serif';
      gCtx.textAlign = 'left';
      gCtx.fillText(`gradient = ${gradient.toFixed(1)} Ω`, pad.left + 8, pad.top + 14);
    }
  }


  // ══════════════════════════════════════
  // CALCULATE R
  // ══════════════════════════════════════

  function calculateR() {
    if (state.dataPoints.length < 3) return;

    let sumVI = 0, sumI2 = 0;
    state.dataPoints.forEach(d => {
      sumVI += d.voltage * d.current;
      sumI2 += d.current * d.current;
    });
    const gradient = sumVI / sumI2;
    const percentError = Math.abs((gradient - state.resistance) / state.resistance * 100);

    markProcedure('graph');
    markProcedure('calculate');

    dom.calcPanel.innerHTML = `
      <span class="calc-label">Linear regression: V = R × I (through origin)</span>
      <div class="calc-line">Gradient R = Σ(V·I) / Σ(I²)</div>
      <div class="calc-line">= ${sumVI.toFixed(4)} / ${sumI2.toFixed(6)}</div>
      <div class="calc-line">= ${gradient.toFixed(1)} Ω</div>
      <span class="calc-label">Comparison with marked value</span>
      <div class="calc-line">Marked: ${state.resistance} Ω</div>
      <div class="calc-result">R = ${gradient.toFixed(1)} Ω (${percentError.toFixed(1)}% error)</div>
      <span class="calc-label">Since V = IR gives a straight line through the origin, the resistor obeys Ohm's law.</span>
    `;
  }


  // ══════════════════════════════════════
  // PROCEDURE TRACKING
  // ══════════════════════════════════════

  function markProcedure(step) {
    state.procedureDone[step] = true;
    document.querySelectorAll('.procedure-step').forEach(el => {
      const s = el.dataset.step;
      if (state.procedureDone[s]) { el.classList.add('done'); el.classList.remove('active'); }
    });
    const steps = ['setup', 'close', 'record', 'vary', 'graph', 'calculate'];
    for (const s of steps) {
      if (!state.procedureDone[s]) {
        const el = document.querySelector(`.procedure-step[data-step="${s}"]`);
        if (el) el.classList.add('active');
        break;
      }
    }
  }

  markProcedure('setup');


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', () => {
    Object.assign(state, {
      emf: 2.0, resistance: 47, switchClosed: false,
      current: 0, voltage: 0, dataPoints: [],
      procedureDone: { setup: false, close: false, record: false, vary: false, graph: false, calculate: false },
    });

    dom.emfSlider.value = 2;
    dom.emfDisplay.textContent = '2.0 V';
    dom.resistorSelect.value = '47';
    dom.btnSwitch.textContent = 'Close Switch';
    dom.btnSwitch.className = 'btn btn-primary btn-sm w-full';
    dom.meterReadings.style.display = 'none';
    dom.ammeterValue.textContent = '0.000 A';
    dom.voltmeterValue.textContent = '0.00 V';
    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';
    dom.calcPanel.innerHTML = '<p class="text-sm text-muted">Collect at least 3 data points to calculate R from the gradient.</p>';

    document.querySelectorAll('.procedure-step').forEach(el => { el.classList.remove('done', 'active'); });
    markProcedure('setup');

    drawCircuit();
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
