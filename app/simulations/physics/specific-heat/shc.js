/* ============================================================
   Specific Heat Capacity — Simulation
   Canvas-based apparatus drawing, temperature model,
   data collection, graph plotting, and SHC calculation.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  // ── Constants from data file ──
  var DATA    = SHC_DATA;
  var METALS  = DATA.metals;
  var POWER   = DATA.heaterPower;
  var VOLTAGE = DATA.voltage;
  var CURRENT = DATA.current;
  var INTERVAL_SIM  = DATA.intervalSim;
  var INTERVAL_REAL = DATA.intervalReal;
  var TOTAL_READINGS = DATA.totalReadings;
  var NOISE   = DATA.noiseFactor;
  var HEAT_LOSS = DATA.heatLossCoeff;

  // ── State ──
  var state = {
    metal: METALS[0],
    startTemp: 20 + Math.random() * 2,    // ~20-22 °C
    currentTemp: 0,
    simTime: 0,                            // simulated seconds elapsed
    readings: [],                          // [{ time, temp }]
    powerOn: false,
    timerHandle: null,
    collecting: false,
    collectionDone: false,
    procedureDone: {}
  };
  state.currentTemp = state.startTemp;

  // ── Scoring ──
  var scorer = (typeof LabScore !== 'undefined') ? LabScore.create(DATA.scoring) : null;

  // ── LabRecordMode integration ──
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  // ── DOM references ──
  function $(id) { return document.getElementById(id); }
  var dom = {
    canvas:         $('main-canvas'),
    metalSelect:    $('metal-select'),
    metalInfo:      $('metal-info'),
    btnPower:       $('btn-power'),
    powerStatus:    $('power-status'),
    voltmeterValue: $('voltmeter-value'),
    ammeterValue:   $('ammeter-value'),
    timerValue:     $('timer-value'),
    tempValue:      $('temp-value'),
    dataTbody:      $('data-tbody'),
    dataEmpty:      $('data-empty'),
    graphCanvas:    $('graph-canvas'),
    calcPanel:      $('calc-panel'),
    calcInputs:     $('calc-inputs'),
    calcPlaceholder:$('calc-placeholder'),
    inputEnergy:    $('input-energy'),
    inputSHC:       $('input-shc'),
    btnCheck:       $('btn-check'),
    calcResult:     $('calc-result'),
    btnReset:       $('btn-reset'),
    btnToggleGuide: $('btn-toggle-guide'),
    guidePanel:     $('guide-panel'),
    toastContainer: $('toast-container'),
    exportButtons:  $('export-buttons'),
    scoreSlot:      $('score-slot'),
    meterReadings:  $('meter-readings'),
    procedureList:  $('procedure-list')
  };

  var ctx  = dom.canvas.getContext('2d');
  var gCtx = dom.graphCanvas.getContext('2d');


  // ══════════════════════════════════════
  // CANVAS SIZING
  // ══════════════════════════════════════

  function resizeCanvas() {
    var panel = dom.canvas.parentElement;
    var dpr = window.devicePixelRatio || 1;
    var w = Math.min(panel.clientWidth - 32, 600);
    var h = Math.min(panel.clientHeight - 120, 460);
    if (w < 300) w = 300;
    if (h < 280) h = 280;
    dom.canvas.width  = w * dpr;
    dom.canvas.height = h * dpr;
    dom.canvas.style.width = w + 'px';
    dom.canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawApparatus();
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);


  // ══════════════════════════════════════
  // TEMPERATURE MODEL
  // ══════════════════════════════════════

  /**
   * T(t) = T0 + (P * t) / (m * c) - heatLoss correction + noise
   * Heat loss makes the curve slightly sub-linear at higher temps.
   */
  function computeTemp(t) {
    var metal = state.metal;
    var idealRise = (POWER * t) / (metal.mass * metal.actualSHC);
    // Heat loss: proportional to temp above ambient squared
    var lossCorrection = HEAT_LOSS * idealRise * idealRise * t;
    var temp = state.startTemp + idealRise - lossCorrection;
    // Add random noise
    var noiseVal = (Math.random() - 0.5) * 2 * NOISE;
    return temp + noiseVal;
  }


  // ══════════════════════════════════════
  // METAL SELECTOR
  // ══════════════════════════════════════

  dom.metalSelect.addEventListener('change', function () {
    if (state.powerOn || state.collectionDone) {
      toast('Reset the experiment to change metals.', 'warn');
      dom.metalSelect.value = state.metal.id;
      return;
    }
    var id = dom.metalSelect.value;
    for (var i = 0; i < METALS.length; i++) {
      if (METALS[i].id === id) {
        state.metal = METALS[i];
        break;
      }
    }
    updateMetalInfo();
    drawApparatus();
    markProcedure('select');
    if (scorer) scorer.award('select', 1);
    toast('Selected ' + state.metal.name + ' block.');
  });

  function updateMetalInfo() {
    dom.metalInfo.innerHTML =
      '<span class="tag tag-phys">' + state.metal.name + '</span>' +
      '<span class="text-sm text-muted">m = ' + state.metal.mass.toFixed(3) + ' kg</span>';
  }

  // Mark initial selection
  markProcedure('select');
  if (scorer) scorer.award('select', 1);


  // ══════════════════════════════════════
  // POWER BUTTON
  // ══════════════════════════════════════

  dom.btnPower.disabled = false;

  dom.btnPower.addEventListener('click', function () {
    if (state.collectionDone) return;

    if (!state.powerOn) {
      // Switch on
      state.powerOn = true;
      dom.btnPower.textContent = 'Switch Off Power Supply';
      dom.btnPower.className = 'btn btn-ghost btn-sm w-full';
      dom.powerStatus.innerHTML =
        '<span class="status-dot on"></span>' +
        '<span class="text-sm" style="color:var(--color-success)">Power on</span>';

      // Update meter displays
      dom.voltmeterValue.textContent = VOLTAGE.toFixed(1) + ' V';
      dom.ammeterValue.textContent   = CURRENT.toFixed(2) + ' A';

      markProcedure('insert');
      markProcedure('startTemp');
      markProcedure('powerOn');

      if (scorer) {
        scorer.award('startTemp', 1);
        scorer.award('powerOn', 1);
      }

      toast('Power supply on. Heating started.');
      if (typeof LabAudio !== 'undefined') LabAudio.switchToggle();

      // Record starting temperature reading (t = 0)
      recordReading(0, state.currentTemp);

      // Start automatic data collection
      startCollection();

    } else {
      // Switch off
      stopCollection();
      state.powerOn = false;
      dom.btnPower.textContent = 'Switch On Power Supply';
      dom.btnPower.className = 'btn btn-primary btn-sm w-full';
      dom.powerStatus.innerHTML =
        '<span class="status-dot off"></span>' +
        '<span class="text-sm text-muted">Power off</span>';
      dom.voltmeterValue.textContent = '0.0 V';
      dom.ammeterValue.textContent   = '0.00 A';

      toast('Power supply off.');
      if (typeof LabAudio !== 'undefined') LabAudio.switchToggle();
    }
    drawApparatus();
  });


  // ══════════════════════════════════════
  // DATA COLLECTION TIMER
  // ══════════════════════════════════════

  function startCollection() {
    if (state.collecting) return;
    state.collecting = true;

    state.timerHandle = setInterval(function () {
      state.simTime += INTERVAL_SIM;
      state.currentTemp = computeTemp(state.simTime);

      // Update displays
      dom.timerValue.textContent = state.simTime + ' s';
      dom.tempValue.textContent  = state.currentTemp.toFixed(1) + ' \u00B0C';

      var isIndependent = typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided();

      if (isIndependent) {
        // Pause timer while student enters reading (non-blocking)
        var capturedTime = state.simTime;
        clearInterval(state.timerHandle);
        state.timerHandle = null;

        // Build inline prompt row in the data table area
        var promptRow = document.createElement('tr');
        promptRow.className = 'animate-fade-in';
        var tdLabel = document.createElement('td');
        tdLabel.textContent = capturedTime + ' s';
        var tdInput = document.createElement('td');
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '0.1';
        inp.placeholder = 'Enter °C';
        inp.className = 'calc-input';
        inp.style.width = '90px';
        inp.style.display = 'inline-block';
        inp.style.marginRight = '4px';
        var submitBtn = document.createElement('button');
        submitBtn.textContent = 'Record';
        submitBtn.className = 'btn btn-primary btn-xs';
        tdInput.appendChild(inp);
        tdInput.appendChild(submitBtn);
        promptRow.appendChild(tdLabel);
        promptRow.appendChild(tdInput);
        dom.dataTbody.appendChild(promptRow);
        dom.dataEmpty.style.display = 'none';
        inp.focus();

        function submitReading() {
          var tempVal = parseFloat(inp.value);
          if (!isNaN(tempVal) && tempVal > 0) {
            promptRow.remove();
            recordReading(capturedTime, tempVal);
          } else {
            toast('Invalid temperature. Please enter a valid number.', 'warn');
            inp.focus();
            return;
          }

          drawApparatus();
          if (typeof LabAudio !== 'undefined') LabAudio.record();

          if (state.readings.length >= TOTAL_READINGS) {
            completeCollection();
          } else {
            // Resume collection
            startCollection();
          }
        }

        submitBtn.addEventListener('click', submitReading);
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') submitReading();
        });
        return; // Exit interval callback; timer is paused
      } else {
        // Record the reading automatically
        recordReading(state.simTime, state.currentTemp);
      }

      // Update canvas (thermometer rises)
      drawApparatus();

      if (typeof LabAudio !== 'undefined') LabAudio.record();

      // Check if collection complete
      if (state.readings.length >= TOTAL_READINGS) {
        completeCollection();
      }
    }, INTERVAL_REAL);
  }

  function stopCollection() {
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
    state.collecting = false;
  }

  function recordReading(time, temp) {
    var reading = { time: time, temp: parseFloat(temp.toFixed(1)) };
    state.readings.push(reading);

    // Add to data table
    dom.dataEmpty.style.display = 'none';
    var row = document.createElement('tr');
    row.className = 'animate-fade-in';
    row.innerHTML = '<td>' + time + '</td><td>' + reading.temp.toFixed(1) + '</td>';
    dom.dataTbody.appendChild(row);

    // Update graph
    drawGraph();
  }

  function completeCollection() {
    stopCollection();
    state.collectionDone = true;

    // Update power button state
    state.powerOn = false;
    dom.btnPower.textContent = 'Collection Complete';
    dom.btnPower.disabled = true;
    dom.btnPower.className = 'btn btn-ghost btn-sm w-full';
    dom.powerStatus.innerHTML =
      '<span class="status-dot off"></span>' +
      '<span class="text-sm text-muted">Complete</span>';
    dom.voltmeterValue.textContent = '0.0 V';
    dom.ammeterValue.textContent   = '0.00 A';

    markProcedure('collect');

    if (scorer) scorer.award('collectAll', 2);

    // Show calculation inputs
    dom.calcPlaceholder.style.display = 'none';
    dom.calcInputs.style.display = '';

    if (typeof LabAudio !== 'undefined') LabAudio.success();

    // Show "Try Another Metal" button after a short delay
    setTimeout(function () {
      showTryAnotherMetal();
    }, 500);

    // Track progress
    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('specific-heat', 'collect');
    }

    drawApparatus();

    // Add export buttons
    if (typeof LabExport !== 'undefined' && dom.exportButtons) {
      LabExport.addExportButtons(dom.exportButtons, {
        table: $('data-table'),
        canvas: dom.graphCanvas,
        filename: 'shc-graph.png',
        csvFilename: 'shc-data.csv'
      });
    }
  }


  // ══════════════════════════════════════
  // CALCULATION CHECK
  // ══════════════════════════════════════

  dom.btnCheck.addEventListener('click', function () {
    var userEnergy = parseFloat(dom.inputEnergy.value);
    var userSHC    = parseFloat(dom.inputSHC.value);

    if (isNaN(userEnergy) || userEnergy <= 0) {
      toast('Enter a valid energy value (E = V x I x t).', 'warn');
      return;
    }
    if (isNaN(userSHC) || userSHC <= 0) {
      toast('Enter a valid specific heat capacity value.', 'warn');
      return;
    }

    // Actual values
    var totalTime = (TOTAL_READINGS - 1) * INTERVAL_SIM; // 600 s
    var actualEnergy = VOLTAGE * CURRENT * totalTime;     // 28800 J
    var firstTemp = state.readings[0].temp;
    var lastTemp  = state.readings[state.readings.length - 1].temp;
    var deltaT    = lastTemp - firstTemp;
    var actualSHC = actualEnergy / (state.metal.mass * deltaT);

    // Check energy
    var energyError = Math.abs((userEnergy - actualEnergy) / actualEnergy * 100);
    var energyOK    = energyError < 5;

    // Check SHC — compare to accepted value
    var shcErrorVsAccepted = Math.abs((userSHC - state.metal.actualSHC) / state.metal.actualSHC * 100);
    // Also compare to experimentally-derived value
    var shcErrorVsExpt     = Math.abs((userSHC - actualSHC) / actualSHC * 100);
    var shcClose = shcErrorVsExpt < 15;
    var shcAccurate = shcErrorVsAccepted < 15;

    // Build result message
    var resultClass = '';
    var html = '';

    html += '<div style="margin-bottom:8px;">';
    html += '<strong>Energy supplied:</strong><br>';
    html += '<span class="result-line">E = ' + VOLTAGE + ' x ' + CURRENT + ' x ' + totalTime + ' = ' + actualEnergy.toFixed(0) + ' J</span>';
    if (energyOK) {
      html += '<br><span style="color:#065f46;">Your answer: ' + userEnergy.toFixed(0) + ' J (' + energyError.toFixed(1) + '% error)</span>';
    } else {
      html += '<br><span style="color:#991b1b;">Your answer: ' + userEnergy.toFixed(0) + ' J (' + energyError.toFixed(1) + '% error)</span>';
    }
    html += '</div>';

    html += '<div style="margin-bottom:8px;">';
    html += '<strong>Temperature rise:</strong><br>';
    html += '<span class="result-line">\u0394T = ' + lastTemp.toFixed(1) + ' - ' + firstTemp.toFixed(1) + ' = ' + deltaT.toFixed(1) + ' \u00B0C</span>';
    html += '</div>';

    html += '<div style="margin-bottom:8px;">';
    html += '<strong>Experimental SHC:</strong><br>';
    html += '<span class="result-line">c = ' + actualEnergy.toFixed(0) + ' / (' + state.metal.mass.toFixed(1) + ' x ' + deltaT.toFixed(1) + ') = ' + actualSHC.toFixed(0) + ' J/kg\u00B0C</span>';
    html += '</div>';

    html += '<div>';
    html += '<strong>Your calculated SHC:</strong> ' + userSHC.toFixed(0) + ' J/kg\u00B0C<br>';
    html += '<strong>Accepted value:</strong> ' + state.metal.actualSHC + ' J/kg\u00B0C<br>';
    html += '<strong>% error vs accepted:</strong> ' + shcErrorVsAccepted.toFixed(1) + '%';
    html += '</div>';

    if (shcClose && energyOK) {
      resultClass = 'success';
      if (shcAccurate) {
        html += '<div style="margin-top:8px;font-weight:600;">Excellent! Your SHC is within 15% of the accepted value.</div>';
      } else {
        html += '<div style="margin-top:8px;font-weight:600;">Good calculation. The difference from the accepted value is due to heat losses.</div>';
      }
    } else if (shcClose || energyOK) {
      resultClass = 'warning';
      html += '<div style="margin-top:8px;font-weight:600;">Check your working. One of your values needs correcting.</div>';
    } else {
      resultClass = 'error';
      html += '<div style="margin-top:8px;font-weight:600;">Review the formulae and try again.</div>';
    }

    dom.calcResult.innerHTML = html;
    dom.calcResult.className = 'calc-result-box ' + resultClass;
    dom.calcResult.style.display = '';

    markProcedure('calculate');

    // Scoring
    if (scorer) {
      if (energyOK) scorer.award('calcEnergy', 1);
      if (shcClose) scorer.award('calcSHC', 1);
      if (shcAccurate) scorer.award('accuracy', 1);
    }

    // Show score summary
    if (scorer && dom.scoreSlot) {
      dom.scoreSlot.innerHTML = '';
      dom.scoreSlot.appendChild(scorer.buildSummary());
    }

    // Track progress
    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('specific-heat', 'calculate');
      var pct = scorer ? scorer.percentage() : 0;
      LabProgress.markComplete('specific-heat', pct);
    }

    if (shcClose && energyOK) {
      toast('SHC calculated successfully!', 'success');
      if (typeof LabAudio !== 'undefined') LabAudio.success();
    } else {
      toast('Check your calculations.', 'warn');
      if (typeof LabAudio !== 'undefined') LabAudio.warn();
    }
  });


  // ══════════════════════════════════════
  // CANVAS DRAWING — APPARATUS
  // ══════════════════════════════════════

  function drawApparatus() {
    var dpr = window.devicePixelRatio || 1;
    var W = dom.canvas.width / dpr;
    var H = dom.canvas.height / dpr;
    ctx.clearRect(0, 0, W, H);

    var cx = W * 0.5;
    var cy = H * 0.5;

    // Layout measurements
    var blockW = Math.min(160, W * 0.27);
    var blockH = Math.min(120, H * 0.27);
    var blockX = cx - blockW / 2 + 20;
    var blockY = cy - blockH / 2 + 20;

    // ── Insulation (dashed outline around block) ──
    var insPad = 12;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      blockX - insPad, blockY - insPad,
      blockW + insPad * 2, blockH + insPad * 2
    );
    ctx.setLineDash([]);

    // Insulation label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Insulation (lagging)', blockX + blockW / 2, blockY - insPad - 6);
    ctx.restore();

    // ── Metal block ──
    ctx.save();
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Block fill with gradient
    var blockGrad = ctx.createLinearGradient(blockX, blockY, blockX, blockY + blockH);
    blockGrad.addColorStop(0, lightenColor(state.metal.colour, 30));
    blockGrad.addColorStop(0.5, state.metal.colour);
    blockGrad.addColorStop(1, darkenColor(state.metal.colour, 30));
    ctx.fillStyle = blockGrad;

    roundRect(ctx, blockX, blockY, blockW, blockH, 6);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Block border
    ctx.strokeStyle = darkenColor(state.metal.colour, 50);
    ctx.lineWidth = 1.5;
    roundRect(ctx, blockX, blockY, blockW, blockH, 6);
    ctx.stroke();

    // Block label
    ctx.fillStyle = getContrastColor(state.metal.colour);
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.metal.name, blockX + blockW / 2, blockY + blockH / 2 - 10);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(state.metal.mass.toFixed(1) + ' kg', blockX + blockW / 2, blockY + blockH / 2 + 8);
    ctx.restore();

    // ── Heater hole + heater ──
    var heaterX = blockX + blockW * 0.35;
    var heaterHoleTop = blockY + 4;
    var heaterHoleH = blockH * 0.65;

    // Hole
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(heaterX - 5, heaterHoleTop, 10, heaterHoleH);

    // Heater element (red cylinder)
    var heaterGlow = state.powerOn ? 'rgba(255, 80, 30, 0.9)' : 'rgba(180, 60, 40, 0.7)';
    var heaterGrad = ctx.createLinearGradient(heaterX - 4, 0, heaterX + 4, 0);
    heaterGrad.addColorStop(0, darkenColor(heaterGlow, 20));
    heaterGrad.addColorStop(0.5, heaterGlow);
    heaterGrad.addColorStop(1, darkenColor(heaterGlow, 30));
    ctx.fillStyle = heaterGrad;
    ctx.fillRect(heaterX - 4, heaterHoleTop + 2, 8, heaterHoleH - 4);

    // Heater glow when on
    if (state.powerOn) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(Date.now() / 200);
      ctx.fillStyle = '#ff4500';
      ctx.fillRect(heaterX - 6, heaterHoleTop, 12, heaterHoleH);
      ctx.restore();
    }

    // ── Thermometer hole + thermometer ──
    var thermX = blockX + blockW * 0.65;
    var thermHoleTop = blockY + 4;
    var thermHoleH = blockH * 0.65;

    // Hole
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(thermX - 4, thermHoleTop, 8, thermHoleH);

    // Thermometer tube (extends above the block)
    var tubeTop = blockY - 80;
    var tubeBottom = thermHoleTop + thermHoleH - 8;
    var tubeH = tubeBottom - tubeTop;

    // Glass tube
    ctx.fillStyle = 'rgba(220, 230, 245, 0.2)';
    ctx.fillRect(thermX - 3, tubeTop, 6, tubeH);
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(thermX - 3, tubeTop, 6, tubeH);

    // Mercury bulb at bottom
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(thermX, tubeBottom, 5, 0, Math.PI * 2);
    ctx.fill();

    // Mercury level (rises with temperature)
    var tempRange = 80;  // range of thermometer display
    var tempFraction = Math.max(0, Math.min(1, (state.currentTemp - 10) / tempRange));
    var mercuryH = tempFraction * (tubeH - 16);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(thermX - 2, tubeBottom - mercuryH, 4, mercuryH);

    // Thermometer scale markings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '8px Inter, sans-serif';
    ctx.textAlign = 'left';
    for (var t = 20; t <= 80; t += 10) {
      var frac = (t - 10) / tempRange;
      var markY = tubeBottom - frac * (tubeH - 16);
      ctx.fillRect(thermX + 4, markY, 4, 0.5);
      ctx.fillText(t + '\u00B0', thermX + 10, markY + 3);
    }

    // Thermometer label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Thermometer', thermX, tubeTop - 6);

    // ── Power supply box ──
    var psW = 100;
    var psH = 60;
    var psX = blockX - 140;
    var psY = blockY + blockH - psH + 10;

    // Box body
    var psGrad = ctx.createLinearGradient(psX, psY, psX, psY + psH);
    psGrad.addColorStop(0, '#4a4b62');
    psGrad.addColorStop(1, '#35364a');
    ctx.fillStyle = psGrad;
    roundRect(ctx, psX, psY, psW, psH, 5);
    ctx.fill();
    ctx.strokeStyle = '#5c5f6e';
    ctx.lineWidth = 1;
    roundRect(ctx, psX, psY, psW, psH, 5);
    ctx.stroke();

    // Power supply label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POWER SUPPLY', psX + psW / 2, psY + 12);

    // Voltage display on power supply
    var vDispX = psX + 10;
    var vDispY = psY + 20;
    ctx.fillStyle = state.powerOn ? '#1a1a2e' : '#252538';
    ctx.fillRect(vDispX, vDispY, 35, 16);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(vDispX, vDispY, 35, 16);
    ctx.fillStyle = state.powerOn ? '#60a5fa' : '#4a4b60';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.powerOn ? VOLTAGE.toFixed(1) + 'V' : '---', vDispX + 17.5, vDispY + 12);

    // Current display on power supply
    var aDispX = psX + 55;
    var aDispY = psY + 20;
    ctx.fillStyle = state.powerOn ? '#1a1a2e' : '#252538';
    ctx.fillRect(aDispX, aDispY, 35, 16);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(aDispX, aDispY, 35, 16);
    ctx.fillStyle = state.powerOn ? '#f87171' : '#4a4b60';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(state.powerOn ? CURRENT.toFixed(1) + 'A' : '---', aDispX + 17.5, aDispY + 12);

    // V and A labels
    ctx.font = '7px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('V', vDispX + 17.5, vDispY + 24);
    ctx.fillText('A', aDispX + 17.5, aDispY + 24);

    // Power indicator LED
    if (state.powerOn) {
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(psX + psW / 2, psY + psH - 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#4a4b60';
      ctx.beginPath();
      ctx.arc(psX + psW / 2, psY + psH - 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Wires from power supply to heater ──
    var wireColor = state.powerOn ? '#60a5fa' : 'rgba(200, 210, 230, 0.35)';
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = state.powerOn ? 2 : 1.5;
    ctx.lineCap = 'round';

    // Positive wire (red terminal)
    var wireStartX1 = psX + psW;
    var wireStartY1 = psY + psH * 0.35;
    ctx.strokeStyle = state.powerOn ? '#ef4444' : 'rgba(200, 100, 100, 0.35)';
    ctx.beginPath();
    ctx.moveTo(wireStartX1, wireStartY1);
    ctx.lineTo(wireStartX1 + 15, wireStartY1);
    ctx.quadraticCurveTo(wireStartX1 + 25, wireStartY1, wireStartX1 + 25, wireStartY1 - 20);
    ctx.lineTo(heaterX - 2, heaterHoleTop - 10);
    ctx.lineTo(heaterX - 2, heaterHoleTop + 2);
    ctx.stroke();

    // Negative wire (blue terminal)
    var wireStartY2 = psY + psH * 0.65;
    ctx.strokeStyle = state.powerOn ? '#3b82f6' : 'rgba(100, 100, 200, 0.35)';
    ctx.beginPath();
    ctx.moveTo(wireStartX1, wireStartY2);
    ctx.lineTo(wireStartX1 + 10, wireStartY2);
    ctx.quadraticCurveTo(wireStartX1 + 20, wireStartY2, wireStartX1 + 20, wireStartY2 + 15);
    ctx.lineTo(heaterX + 2, blockY + blockH + 15);
    ctx.lineTo(heaterX + 2, heaterHoleTop + heaterHoleH - 2);
    ctx.stroke();

    // Terminal dots
    ctx.fillStyle = state.powerOn ? '#ef4444' : '#5c5f6e';
    ctx.beginPath();
    ctx.arc(wireStartX1, wireStartY1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = state.powerOn ? '#3b82f6' : '#5c5f6e';
    ctx.beginPath();
    ctx.arc(wireStartX1, wireStartY2, 3, 0, Math.PI * 2);
    ctx.fill();

    // ── Heater label ──
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Heater', heaterX, blockY + blockH + 28);

    // ── Temperature readout on canvas ──
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(state.currentTemp.toFixed(1) + ' \u00B0C', W - 20, 30);

    // Time readout on canvas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('t = ' + state.simTime + ' s', W - 20, 48);

    // ── Status text ──
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    if (!state.powerOn && !state.collectionDone) {
      ctx.fillText('Press "Switch On Power Supply" to begin heating', W / 2, H - 14);
    } else if (state.powerOn && state.collecting) {
      ctx.fillText('Collecting data... ' + state.readings.length + ' / ' + TOTAL_READINGS + ' readings', W / 2, H - 14);
    } else if (state.collectionDone) {
      ctx.fillText('Data collection complete. Calculate the SHC.', W / 2, H - 14);
    }

    // ── Animated glow when heating ──
    if (state.powerOn) {
      requestAnimationFrame(drawApparatus);
    }
  }


  // ══════════════════════════════════════
  // GRAPH — Temperature vs Time
  // ══════════════════════════════════════

  function drawGraph() {
    var W = dom.graphCanvas.width;
    var H = dom.graphCanvas.height;
    var pad = { top: 20, right: 15, bottom: 35, left: 45 };
    var plotW = W - pad.left - pad.right;
    var plotH = H - pad.top - pad.bottom;

    gCtx.clearRect(0, 0, W, H);
    if (state.readings.length === 0) return;

    // Determine axis ranges
    var maxTime = 600;
    var temps = state.readings.map(function (r) { return r.temp; });
    var minT = Math.floor(Math.min.apply(null, temps) / 5) * 5;
    var maxT = Math.ceil(Math.max.apply(null, temps) / 5) * 5 + 5;
    if (maxT - minT < 10) maxT = minT + 10;

    // Axes
    gCtx.strokeStyle = '#374151';
    gCtx.lineWidth = 1;
    gCtx.beginPath();
    gCtx.moveTo(pad.left, pad.top);
    gCtx.lineTo(pad.left, H - pad.bottom);
    gCtx.lineTo(W - pad.right, H - pad.bottom);
    gCtx.stroke();

    // Grid lines
    gCtx.strokeStyle = '#e5e7eb';
    gCtx.lineWidth = 0.5;

    // Horizontal grid
    var tempSteps = 5;
    for (var i = 0; i <= tempSteps; i++) {
      var y = pad.top + (plotH * i / tempSteps);
      gCtx.beginPath();
      gCtx.moveTo(pad.left, y);
      gCtx.lineTo(W - pad.right, y);
      gCtx.stroke();
    }

    // Vertical grid
    var timeSteps = 6; // 0, 100, 200, ..., 600
    for (var j = 0; j <= timeSteps; j++) {
      var x = pad.left + (plotW * j / timeSteps);
      gCtx.beginPath();
      gCtx.moveTo(x, pad.top);
      gCtx.lineTo(x, H - pad.bottom);
      gCtx.stroke();
    }

    // Axis labels
    gCtx.fillStyle = '#6b7280';
    gCtx.font = '9px Inter, sans-serif';
    gCtx.textAlign = 'center';
    gCtx.fillText('Time / s', W / 2, H - 4);
    gCtx.save();
    gCtx.translate(10, pad.top + plotH / 2);
    gCtx.rotate(-Math.PI / 2);
    gCtx.fillText('Temp / \u00B0C', 0, 0);
    gCtx.restore();

    // X-axis tick labels
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'top';
    gCtx.font = '8px Inter, sans-serif';
    for (var k = 0; k <= timeSteps; k++) {
      var timeVal = (maxTime * k / timeSteps);
      gCtx.fillText(timeVal.toFixed(0), pad.left + (plotW * k / timeSteps), H - pad.bottom + 4);
    }

    // Y-axis tick labels
    gCtx.textAlign = 'right';
    gCtx.textBaseline = 'middle';
    for (var m = 0; m <= tempSteps; m++) {
      var tempVal = maxT - (maxT - minT) * m / tempSteps;
      gCtx.fillText(tempVal.toFixed(0), pad.left - 5, pad.top + (plotH * m / tempSteps));
    }

    // Coordinate transforms
    function toX(time) { return pad.left + (time / maxTime) * plotW; }
    function toY(temp) { return pad.top + plotH - ((temp - minT) / (maxT - minT)) * plotH; }

    // Connect data points with line
    if (state.readings.length > 1) {
      gCtx.strokeStyle = '#f77f00';
      gCtx.lineWidth = 1.5;
      gCtx.beginPath();
      gCtx.moveTo(toX(state.readings[0].time), toY(state.readings[0].temp));
      for (var n = 1; n < state.readings.length; n++) {
        gCtx.lineTo(toX(state.readings[n].time), toY(state.readings[n].temp));
      }
      gCtx.stroke();
    }

    // Data points
    gCtx.fillStyle = '#f77f00';
    for (var p = 0; p < state.readings.length; p++) {
      gCtx.beginPath();
      gCtx.arc(toX(state.readings[p].time), toY(state.readings[p].temp), 3, 0, Math.PI * 2);
      gCtx.fill();
    }

    // Best fit line (linear regression)
    if (state.readings.length >= 3) {
      var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      var n2 = state.readings.length;
      for (var q = 0; q < n2; q++) {
        var rx = state.readings[q].time;
        var ry = state.readings[q].temp;
        sumX += rx;
        sumY += ry;
        sumXY += rx * ry;
        sumXX += rx * rx;
      }
      var slope = (n2 * sumXY - sumX * sumY) / (n2 * sumXX - sumX * sumX);
      var intercept = (sumY - slope * sumX) / n2;

      gCtx.strokeStyle = 'rgba(247, 127, 0, 0.4)';
      gCtx.lineWidth = 1;
      gCtx.setLineDash([4, 3]);
      gCtx.beginPath();
      gCtx.moveTo(toX(0), toY(intercept));
      gCtx.lineTo(toX(maxTime), toY(slope * maxTime + intercept));
      gCtx.stroke();
      gCtx.setLineDash([]);
    }
  }


  // ══════════════════════════════════════
  // PROCEDURE TRACKING
  // ══════════════════════════════════════

  var STEP_ORDER = ['select', 'insert', 'startTemp', 'powerOn', 'collect', 'calculate'];

  function markProcedure(step) {
    state.procedureDone[step] = true;

    // Update all steps
    var steps = dom.procedureList.querySelectorAll('.procedure-step');
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i].getAttribute('data-step');
      if (state.procedureDone[s]) {
        steps[i].classList.add('done');
        steps[i].classList.remove('active');
      }
    }

    // Find next undone step and mark active
    for (var j = 0; j < STEP_ORDER.length; j++) {
      if (!state.procedureDone[STEP_ORDER[j]]) {
        var el = dom.procedureList.querySelector('.procedure-step[data-step="' + STEP_ORDER[j] + '"]');
        if (el) el.classList.add('active');
        break;
      }
    }

    // Track progress
    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('specific-heat', step);
    }
  }


  // ══════════════════════════════════════
  // TRY ANOTHER METAL
  // ══════════════════════════════════════

  function showTryAnotherMetal() {
    // Add a "Try Another Metal" button below the power controls
    var existing = document.getElementById('try-another-bar');
    if (existing) return;

    var bar = document.createElement('div');
    bar.id = 'try-another-bar';
    bar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 16px;background:var(--color-primary-light,#eff6ff);border-top:2px solid var(--color-primary);flex-shrink:0;';

    var msg = document.createElement('span');
    msg.style.cssText = 'font-size:var(--text-sm);color:var(--color-text);';
    msg.textContent = 'Want to compare another metal?';
    bar.appendChild(msg);

    var btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = 'Try Another Metal';
    btn.addEventListener('click', function () {
      // Soft reset: preserve completed data in summary but reset apparatus
      state.startTemp = 20 + Math.random() * 2;
      state.currentTemp = state.startTemp;
      state.simTime = 0;
      state.readings = [];
      state.powerOn = false;
      state.collecting = false;
      state.collectionDone = false;

      // Re-enable controls
      dom.metalSelect.disabled = false;
      dom.btnPower.textContent = 'Switch On Power Supply';
      dom.btnPower.disabled = false;
      dom.btnPower.className = 'btn btn-primary btn-sm w-full';
      dom.powerStatus.innerHTML =
        '<span class="status-dot off"></span>' +
        '<span class="text-sm text-muted">Off</span>';

      // Clear data table for new run
      dom.dataTbody.innerHTML = '';
      dom.dataEmpty.style.display = '';

      // Reset calc section
      dom.calcPlaceholder.style.display = '';
      dom.calcInputs.style.display = 'none';

      // Clear graph for new run
      var W = dom.graphCanvas.width, H = dom.graphCanvas.height;
      var gctx = dom.graphCanvas.getContext('2d');
      gctx.clearRect(0, 0, W, H);

      // Remove this bar
      bar.remove();

      // Update procedure
      markProcedure('select');
      drawApparatus();
      toast('Select a metal and begin a new measurement.', 'info');
    });
    bar.appendChild(btn);

    // Insert after the workbench
    var workbench = dom.btnPower.closest('.shc-workbench-panel') ||
                    dom.btnPower.closest('section');
    if (workbench) {
      workbench.appendChild(bar);
    }
  }


  // ══════════════════════════════════════
  // RESET
  // ══════════════════════════════════════

  dom.btnReset.addEventListener('click', function () {
    // Stop any running timer
    stopCollection();

    // Reset state
    state.metal = METALS[0];
    state.startTemp = 20 + Math.random() * 2;
    state.currentTemp = state.startTemp;
    state.simTime = 0;
    state.readings = [];
    state.powerOn = false;
    state.collecting = false;
    state.collectionDone = false;
    state.procedureDone = {};

    // Reset scorer
    if (scorer) scorer.reset();

    // Reset UI
    dom.metalSelect.value = 'aluminium';
    updateMetalInfo();

    dom.btnPower.textContent = 'Switch On Power Supply';
    dom.btnPower.className = 'btn btn-primary btn-sm w-full';
    dom.btnPower.disabled = false;

    dom.powerStatus.innerHTML =
      '<span class="status-dot off"></span>' +
      '<span class="text-sm text-muted">Power off</span>';

    dom.voltmeterValue.textContent = '0.0 V';
    dom.ammeterValue.textContent   = '0.00 A';
    dom.timerValue.textContent     = '0 s';
    dom.tempValue.textContent      = state.currentTemp.toFixed(1) + ' \u00B0C';

    dom.dataTbody.innerHTML = '';
    dom.dataEmpty.style.display = '';

    dom.calcInputs.style.display = 'none';
    dom.calcPlaceholder.style.display = '';
    dom.calcResult.style.display = 'none';
    dom.calcResult.innerHTML = '';
    dom.inputEnergy.value = '';
    dom.inputSHC.value = '';

    if (dom.scoreSlot) dom.scoreSlot.innerHTML = '';
    if (dom.exportButtons) dom.exportButtons.innerHTML = '';

    // Reset procedure steps
    var steps = dom.procedureList.querySelectorAll('.procedure-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.remove('done', 'active');
    }
    markProcedure('select');
    if (scorer) scorer.award('select', 1);

    // Redraw
    drawApparatus();
    gCtx.clearRect(0, 0, dom.graphCanvas.width, dom.graphCanvas.height);

    toast('Experiment reset.');
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
    if (!dom.toastContainer) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = message;
    dom.toastContainer.appendChild(el);
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
  // CANVAS HELPERS
  // ══════════════════════════════════════

  function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + w - r, y);
    context.quadraticCurveTo(x + w, y, x + w, y + r);
    context.lineTo(x + w, y + h - r);
    context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    context.lineTo(x + r, y + h);
    context.quadraticCurveTo(x, y + h, x, y + h - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  /**
   * Lighten a hex colour by a percentage.
   */
  function lightenColor(hex, percent) {
    var rgb = hexToRGB(hex);
    if (!rgb) return hex;
    var r = Math.min(255, rgb.r + Math.round(255 * percent / 100));
    var g = Math.min(255, rgb.g + Math.round(255 * percent / 100));
    var b = Math.min(255, rgb.b + Math.round(255 * percent / 100));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /**
   * Darken a hex colour by a percentage.
   */
  function darkenColor(hex, percent) {
    var rgb = hexToRGB(hex);
    if (!rgb) return hex;
    var r = Math.max(0, rgb.r - Math.round(255 * percent / 100));
    var g = Math.max(0, rgb.g - Math.round(255 * percent / 100));
    var b = Math.max(0, rgb.b - Math.round(255 * percent / 100));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /**
   * Determine whether to use white or dark text on a colour.
   */
  function getContrastColor(hex) {
    var rgb = hexToRGB(hex);
    if (!rgb) return '#fff';
    var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#1a1b25' : '#ffffff';
  }

  /**
   * Parse a hex colour string to {r, g, b}.
   * Also handles rgb/rgba strings.
   */
  function hexToRGB(str) {
    if (!str) return null;
    // Handle hex
    var match = str.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
    if (match) {
      return {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16)
      };
    }
    // Handle rgb/rgba
    var rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    }
    return null;
  }


  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════

  // Track visit
  if (typeof LabProgress !== 'undefined') {
    LabProgress.markVisited('specific-heat');
  }

  // Initial draw
  updateMetalInfo();
  dom.tempValue.textContent = state.currentTemp.toFixed(1) + ' \u00B0C';
  drawApparatus();

});
