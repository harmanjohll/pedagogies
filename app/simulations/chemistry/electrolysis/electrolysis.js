/* Electrolysis practical – simulation logic */
document.addEventListener('DOMContentLoaded', function () {
  var DATA = window.ELECTROLYSIS_DATA;
  var $ = function (id) { return document.getElementById(id); };

  /* ── DOM refs ── */
  var dom = {
    selElectrolyte: $('sel-electrolyte'),
    selElectrode:   $('sel-electrode'),
    ionInfo:        $('ion-info'),
    ionList:        $('ion-list'),
    btnConfirm:     $('btn-confirm'),
    canvas:         $('cell-canvas'),
    controls:       $('controls'),
    btnSwitch:      $('btn-switch'),
    currentDisplay: $('current-display'),
    currentValue:   $('current-value'),
    obsBefore:      $('obs-before'),
    obsBeforeText:  $('obs-before-text'),
    obsCathode:     $('obs-cathode'),
    obsCathodeText: $('obs-cathode-text'),
    obsCathodeProduct: $('obs-cathode-product'),
    obsAnode:       $('obs-anode'),
    obsAnodeText:   $('obs-anode-text'),
    obsAnodeProduct: $('obs-anode-product'),
    eqPanel:        $('equations-panel'),
    eqCathode:      $('eq-cathode'),
    eqAnode:        $('eq-anode'),
    eqOverall:      $('eq-overall'),
    eqNotes:        $('eq-notes'),
    idSection:      $('id-section'),
    idCathode:      $('id-cathode'),
    idAnode:        $('id-anode'),
    btnCheckId:     $('btn-check-id'),
    idResult:       $('id-result'),
    btnGuide:       $('btn-guide'),
    btnReset:       $('btn-reset'),
    guidePanel:     $('guide-panel'),
    procList:       $('procedure-list')
  };

  var ctx = dom.canvas.getContext('2d');

  /* ── Recording Mode ── */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  /* ── State ── */
  var state = {
    electrolyteKey: '',
    electrodeKey: '',
    electrolyteData: null,
    electrodeData: null,
    resultData: null,
    cellReady: false,
    switchClosed: false,
    elapsed: 0,
    bubbles: [],
    depositThickness: 0,
    anodeDissolve: 0,
    solutionFade: 0,
    procedureDone: {},
    guideOpen: true,
    animId: null
  };

  /* ── Populate selects ── */
  (function buildSelects() {
    Object.keys(DATA.electrolytes).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = DATA.electrolytes[k].name;
      dom.selElectrolyte.appendChild(o);
    });
    Object.keys(DATA.electrodes).forEach(function (k) {
      var o = document.createElement('option');
      o.value = k;
      o.textContent = DATA.electrodes[k].name;
      dom.selElectrode.appendChild(o);
    });
  })();

  /* ── Config handlers ── */
  dom.selElectrolyte.addEventListener('change', onConfigChange);
  dom.selElectrode.addEventListener('change', onConfigChange);

  function onConfigChange() {
    var ek = dom.selElectrolyte.value;
    var ed = dom.selElectrode.value;

    // show ions
    if (ek) {
      var elData = DATA.electrolytes[ek];
      dom.ionInfo.hidden = false;
      dom.ionList.textContent = elData.ions;

      // disable copper for molten PbBr2
      var opts = dom.selElectrode.options;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].value === 'copper') {
          opts[i].disabled = !elData.allowCopper;
          if (!elData.allowCopper && ed === 'copper') {
            dom.selElectrode.value = '';
            ed = '';
          }
        }
      }
    } else {
      dom.ionInfo.hidden = true;
    }

    dom.btnConfirm.disabled = !(ek && ed);
  }

  /* ── Confirm setup ── */
  dom.btnConfirm.addEventListener('click', function () {
    state.electrolyteKey = dom.selElectrolyte.value;
    state.electrodeKey = dom.selElectrode.value;
    state.electrolyteData = DATA.electrolytes[state.electrolyteKey];
    state.electrodeData = DATA.electrodes[state.electrodeKey];
    state.resultData = DATA.results[state.electrolyteKey][state.electrodeKey];
    state.cellReady = true;
    state.switchClosed = false;
    state.elapsed = 0;
    state.bubbles = [];
    state.depositThickness = 0;
    state.anodeDissolve = 0;
    state.solutionFade = 0;

    dom.controls.hidden = false;
    dom.btnSwitch.textContent = 'Close Switch';
    dom.currentDisplay.hidden = true;

    // lock selects
    dom.selElectrolyte.disabled = true;
    dom.selElectrode.disabled = true;
    dom.btnConfirm.disabled = true;

    markProcedure('setup');

    // show before observation
    dom.obsBefore.hidden = false;
    var elec = state.electrolyteData;
    dom.obsBeforeText.textContent = elec.name + ' in beaker with '
      + state.electrodeData.name + ' electrodes. No current flowing.';
    markProcedure('observe');

    resizeCanvas();
    drawCell();
    toast('Cell set up. Close the switch to begin electrolysis.', 'info');
  });

  /* ── Switch ── */
  dom.btnSwitch.addEventListener('click', function () {
    if (!state.cellReady) return;
    state.switchClosed = !state.switchClosed;

    if (state.switchClosed) {
      dom.btnSwitch.textContent = 'Open Switch';
      dom.currentDisplay.hidden = false;
      var amps = (0.3 + Math.random() * 0.2).toFixed(2);
      dom.currentValue.textContent = amps + ' A';
      markProcedure('switch-on');
      startAnimation();
      toast('Current flowing — observe the electrodes.', 'info');

      // reveal observation sections after a short delay
      setTimeout(function () {
        showCathodeObs();
        showAnodeObs();
        showEquations();
        dom.idSection.hidden = false;
      }, 2000);
    } else {
      dom.btnSwitch.textContent = 'Close Switch';
      dom.currentDisplay.hidden = true;
      dom.currentValue.textContent = '0.00 A';
      stopAnimation();
      drawCell();
    }
  });

  function isIndependentMode() {
    return typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided();
  }

  function makeObsInput(correctAnswer, container) {
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type your observation...';
    input.style.cssText = 'width:100%;font-size:var(--text-sm);border:1px dashed var(--color-border);padding:6px 8px;border-radius:6px;background:var(--color-surface);color:var(--color-text);font-family:inherit;';
    input.dataset.answer = correctAnswer;
    input.addEventListener('blur', function () {
      if (this.value.trim().length > 0 && !this.dataset.revealed) {
        this.dataset.revealed = 'true';
        var fb = document.createElement('div');
        fb.style.cssText = 'font-size:11px;color:var(--color-text-muted);margin-top:4px;font-style:italic;';
        fb.textContent = 'Expected: ' + correctAnswer;
        container.appendChild(fb);
      }
    });
    return input;
  }

  function showCathodeObs() {
    var r = state.resultData.cathode;
    dom.obsCathode.hidden = false;
    if (isIndependentMode()) {
      dom.obsCathodeText.textContent = '';
      dom.obsCathodeText.appendChild(makeObsInput(r.observation, dom.obsCathodeText));
      dom.obsCathodeProduct.textContent = '';
    } else {
      dom.obsCathodeText.textContent = r.observation;
      dom.obsCathodeProduct.textContent = r.product + ' (' + r.formula + ')';
    }
    markProcedure('cathode');
  }

  function showAnodeObs() {
    var r = state.resultData.anode;
    dom.obsAnode.hidden = false;
    if (isIndependentMode()) {
      dom.obsAnodeText.textContent = '';
      dom.obsAnodeText.appendChild(makeObsInput(r.observation, dom.obsAnodeText));
      dom.obsAnodeProduct.textContent = '';
    } else {
      dom.obsAnodeText.textContent = r.observation;
      dom.obsAnodeProduct.textContent = r.product + ' (' + r.formula + ')';
    }
    markProcedure('anode');
  }

  function showEquations() {
    var r = state.resultData;
    dom.eqPanel.hidden = false;
    if (isIndependentMode()) {
      dom.eqCathode.textContent = '';
      dom.eqCathode.appendChild(makeObsInput(r.cathodeEq, dom.eqCathode));
      dom.eqAnode.textContent = '';
      dom.eqAnode.appendChild(makeObsInput(r.anodeEq, dom.eqAnode));
      dom.eqOverall.textContent = '';
      dom.eqNotes.textContent = '';
    } else {
      dom.eqCathode.textContent = r.cathodeEq;
      dom.eqAnode.textContent = r.anodeEq;
      dom.eqOverall.textContent = r.overall;
      dom.eqNotes.textContent = r.notes;
    }
    markProcedure('equations');
  }

  /* ── Identification ── */
  dom.btnCheckId.addEventListener('click', function () {
    var catAns = dom.idCathode.value.trim().toLowerCase();
    var anoAns = dom.idAnode.value.trim().toLowerCase();
    var catCorrect = matchProduct(catAns, state.resultData.cathode.product);
    var anoCorrect = matchProduct(anoAns, state.resultData.anode.product);

    if (catCorrect && anoCorrect) {
      dom.idResult.textContent = 'Both correct!';
      dom.idResult.className = 'id-result correct';
      toast('Excellent — both products identified correctly!', 'success');
      showTryAnotherElectrolyte();
    } else if (catCorrect || anoCorrect) {
      var wrong = catCorrect ? 'anode' : 'cathode';
      dom.idResult.textContent = 'One correct. Check the ' + wrong + ' product.';
      dom.idResult.className = 'id-result partial';
    } else {
      dom.idResult.textContent = 'Not quite. Try again.';
      dom.idResult.className = 'id-result incorrect';
    }
  });

  function showTryAnotherElectrolyte() {
    if (document.getElementById('try-another-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'try-another-bar';
    bar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 16px;background:var(--color-primary-light,#eff6ff);border-top:2px solid var(--color-primary);margin-top:var(--sp-3);border-radius:var(--radius-md);';
    var msg = document.createElement('span');
    msg.style.cssText = 'font-size:var(--text-sm);color:var(--color-text);';
    msg.textContent = 'Try a different electrolyte or electrode combination?';
    bar.appendChild(msg);
    var btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = 'Try Another';
    btn.addEventListener('click', function () {
      // Soft reset: stop animation, re-enable selectors, clear cell
      stopAnimation();
      state.cellReady = false;
      state.switchClosed = false;
      state.elapsed = 0;
      state.bubbles = [];
      state.depositThickness = 0;
      state.anodeDissolve = 0;
      state.solutionFade = 0;

      dom.selElectrolyte.disabled = false;
      dom.selElectrode.disabled = false;
      dom.selElectrolyte.value = '';
      dom.selElectrode.value = '';
      dom.btnConfirm.disabled = true;
      dom.ionInfo.hidden = true;
      dom.controls.hidden = true;
      dom.currentDisplay.hidden = true;
      dom.obsBefore.hidden = true;
      dom.obsCathode.hidden = true;
      dom.obsAnode.hidden = true;
      dom.eqPanel.hidden = true;
      dom.idSection.hidden = true;
      dom.idResult.textContent = '';
      dom.idCathode.value = '';
      dom.idAnode.value = '';
      bar.remove();
      markProcedure('select');
      drawCell();
      toast('Select a new electrolyte and electrode combination.', 'info');
    });
    bar.appendChild(btn);
    dom.idSection.parentElement.appendChild(bar);
  }

  function matchProduct(answer, product) {
    if (!answer || answer.length < 3) return false;
    var p = product.toLowerCase().replace(/dissolves/g, '').trim();
    /* Only check if user answer contains the expected product — not the reverse,
       which would accept partial guesses like "cop" for "copper" */
    return answer.indexOf(p) !== -1;
  }

  /* ── Canvas sizing ── */
  function resizeCanvas() {
    var rect = dom.canvas.parentElement.getBoundingClientRect();
    dom.canvas.width = rect.width * devicePixelRatio;
    dom.canvas.height = rect.height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    if (state.cellReady) drawCell();
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  /* ── Animation ── */
  function startAnimation() {
    if (state.animId) return;
    var last = performance.now();
    (function loop(now) {
      var dt = (now - last) / 1000;
      last = now;
      state.elapsed += dt;
      updateBubbles(dt);
      updateDeposit(dt);
      drawCell();
      state.animId = requestAnimationFrame(loop);
    })(performance.now());
  }

  function stopAnimation() {
    if (state.animId) {
      cancelAnimationFrame(state.animId);
      state.animId = null;
    }
  }

  /* ── Bubble system ── */
  function updateBubbles(dt) {
    var r = state.resultData;
    // spawn bubbles at cathode if gas
    if (r.cathode.type === 'gas' && Math.random() < 0.4) {
      spawnBubble('cathode', r.cathode.bubbleColor);
    }
    // spawn at anode if gas
    if (r.anode.type === 'gas' && Math.random() < 0.3) {
      spawnBubble('anode', r.anode.bubbleColor);
    }
    // move bubbles up, clamp within beaker bounds
    for (var i = state.bubbles.length - 1; i >= 0; i--) {
      var b = state.bubbles[i];
      b.y -= b.speed * dt;
      b.x += Math.sin(b.wobble + state.elapsed * 3) * 0.3;
      b.wobble += dt * 2;
      // Clamp horizontal position within beaker walls
      if (b.minX !== undefined && b.x - b.radius < b.minX) b.x = b.minX + b.radius;
      if (b.maxX !== undefined && b.x + b.radius > b.maxX) b.x = b.maxX - b.radius;
      // Remove bubble when it reaches liquid surface
      if (b.y < b.minY) {
        state.bubbles.splice(i, 1);
      }
    }
  }

  function spawnBubble(electrode, color) {
    var w = dom.canvas.width / devicePixelRatio;
    var h = dom.canvas.height / devicePixelRatio;
    var beakerX = w * 0.25;
    var beakerW = w * 0.5;
    var beakerTop = h * 0.32;
    var beakerBot = h * 0.78;
    var cx = electrode === 'cathode'
      ? beakerX + beakerW * 0.28
      : beakerX + beakerW * 0.72;
    state.bubbles.push({
      x: cx + (Math.random() - 0.5) * 10,
      y: beakerBot - 20,
      speed: 30 + Math.random() * 25,
      radius: 2 + Math.random() * 3,
      color: color,
      wobble: Math.random() * Math.PI * 2,
      minY: beakerTop + 5,
      minX: beakerX + 3,
      maxX: beakerX + beakerW - 3
    });
  }

  function updateDeposit(dt) {
    var r = state.resultData;
    if (r.cathode.type === 'deposit') {
      state.depositThickness = Math.min(state.depositThickness + dt * 3, 12);
    }
    if (r.anode.type === 'dissolve') {
      state.anodeDissolve = Math.min(state.anodeDissolve + dt * 2, 8);
    }
    // solution colour fading for CuSO4 + carbon
    if (state.electrolyteKey === 'cuso4' && state.electrodeKey === 'carbon') {
      state.solutionFade = Math.min(state.solutionFade + dt * 0.05, 0.6);
    }
  }

  /* ── Draw cell ── */
  function drawCell() {
    var w = dom.canvas.width / devicePixelRatio;
    var h = dom.canvas.height / devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    if (!state.cellReady) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '500 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select electrolyte and electrodes to begin', w / 2, h / 2);
      return;
    }

    var beakerX = w * 0.25;
    var beakerW = w * 0.5;
    var beakerTop = h * 0.3;
    var beakerBot = h * 0.8;
    var beakerH = beakerBot - beakerTop;
    var liquidTop = beakerTop + beakerH * 0.08;

    // Power supply
    drawPowerSupply(w, h);

    // Wires
    drawWires(w, h, beakerX, beakerW, beakerTop);

    // Beaker
    ctx.strokeStyle = 'rgba(180,200,220,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beakerX, beakerTop);
    ctx.lineTo(beakerX, beakerBot);
    ctx.lineTo(beakerX + beakerW, beakerBot);
    ctx.lineTo(beakerX + beakerW, beakerTop);
    ctx.stroke();

    // Liquid fill
    var baseColor = state.electrolyteData.color;
    if (state.solutionFade > 0) {
      // fade blue for CuSO4
      var alpha = 0.35 - state.solutionFade * 0.4;
      if (alpha < 0.05) alpha = 0.05;
      baseColor = 'rgba(50, 140, 220, ' + alpha + ')';
    }
    ctx.fillStyle = baseColor;
    ctx.fillRect(beakerX + 1, liquidTop, beakerW - 2, beakerBot - liquidTop - 1);

    // Molten glow
    if (state.electrolyteData.state === 'molten') {
      var grd = ctx.createLinearGradient(0, beakerBot - 30, 0, beakerBot);
      grd.addColorStop(0, 'rgba(200,130,40,0)');
      grd.addColorStop(1, 'rgba(220,140,30,0.25)');
      ctx.fillStyle = grd;
      ctx.fillRect(beakerX + 1, beakerBot - 30, beakerW - 2, 30);
    }

    // Electrodes
    var cathodeX = beakerX + beakerW * 0.28;
    var anodeX = beakerX + beakerW * 0.72;
    var elecTop = beakerTop - 15;
    var elecBot = beakerBot - 25;
    var elecW = 14;

    // Cathode (−)
    var catColor = state.electrodeKey === 'carbon' ? '#4a4e5a' : '#b87333';
    ctx.fillStyle = catColor;
    ctx.fillRect(cathodeX - elecW / 2, elecTop, elecW, elecBot - elecTop);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cathodeX - elecW / 2, elecTop, elecW, elecBot - elecTop);

    // Deposit on cathode
    if (state.depositThickness > 0 && state.switchClosed) {
      ctx.fillStyle = state.resultData.cathode.depositColor;
      ctx.fillRect(
        cathodeX - elecW / 2 - state.depositThickness / 2,
        liquidTop + 5,
        elecW + state.depositThickness,
        elecBot - liquidTop - 5
      );
    }

    // Anode (+)
    var anoW = elecW - state.anodeDissolve;
    if (anoW < 4) anoW = 4;
    ctx.fillStyle = state.electrodeKey === 'carbon' ? '#4a4e5a' : '#b87333';
    ctx.fillRect(anodeX - anoW / 2, elecTop, anoW, elecBot - elecTop);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(anodeX - anoW / 2, elecTop, anoW, elecBot - elecTop);

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cathode (−)', cathodeX, elecTop - 6);
    ctx.fillText('Anode (+)', anodeX, elecTop - 6);

    // Bubbles
    for (var i = 0; i < state.bubbles.length; i++) {
      var b = state.bubbles[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Bromine vapour cloud above anode
    if (state.switchClosed && state.resultData.anode.type === 'gas'
        && state.electrolyteKey === 'molten-pbbr2') {
      ctx.fillStyle = 'rgba(160, 70, 20, ' + (0.08 + Math.sin(state.elapsed * 2) * 0.04) + ')';
      ctx.beginPath();
      ctx.ellipse(anodeX, beakerTop - 10, 25, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Chlorine vapour cloud above anode
    if (state.switchClosed && state.electrolyteKey === 'brine' && state.electrodeKey === 'carbon') {
      ctx.fillStyle = 'rgba(180, 210, 100, ' + (0.06 + Math.sin(state.elapsed * 2) * 0.03) + ')';
      ctx.beginPath();
      ctx.ellipse(anodeX, beakerTop - 10, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Switch indicator
    drawSwitch(w, h);

    // Beaker label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.electrolyteData.formula, beakerX + beakerW / 2, beakerBot + 16);

    // Current direction arrows when switch closed
    if (state.switchClosed) {
      drawCurrentArrows(w, h, cathodeX, anodeX, beakerTop);
    }
  }

  function drawPowerSupply(w, h) {
    var cx = w / 2;
    var y = h * 0.08;
    var bw = 70, bh = 28;

    ctx.fillStyle = '#3a3d4a';
    ctx.strokeStyle = 'rgba(180,200,220,0.4)';
    ctx.lineWidth = 1.5;
    roundRect(cx - bw / 2, y, bw, bh, 4);
    ctx.fill();
    ctx.stroke();

    // terminals
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(cx + bw / 2 - 12, y + bh / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(cx - bw / 2 + 12, y + bh / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('D.C. SUPPLY', cx, y + bh / 2 + 3);

    ctx.font = 'bold 8px Inter, sans-serif';
    ctx.fillStyle = '#e74c3c';
    ctx.fillText('+', cx + bw / 2 - 12, y - 3);
    ctx.fillStyle = '#3498db';
    ctx.fillText('−', cx - bw / 2 + 12, y - 3);
  }

  function drawWires(w, h, beakerX, beakerW, beakerTop) {
    var cx = w / 2;
    var supplyY = h * 0.08 + 28;
    var cathodeX = beakerX + beakerW * 0.28;
    var anodeX = beakerX + beakerW * 0.72;
    var elecTop = beakerTop - 15;

    ctx.strokeStyle = state.switchClosed ? 'rgba(100,180,255,0.6)' : 'rgba(160,170,190,0.35)';
    ctx.lineWidth = 2;

    // + terminal to anode
    ctx.beginPath();
    ctx.moveTo(cx + 23, supplyY);
    ctx.lineTo(cx + 23, supplyY + 12);
    ctx.lineTo(anodeX, supplyY + 12);
    ctx.lineTo(anodeX, elecTop);
    ctx.stroke();

    // − terminal to switch to cathode
    ctx.beginPath();
    ctx.moveTo(cx - 23, supplyY);
    ctx.lineTo(cx - 23, supplyY + 12);
    ctx.lineTo(cathodeX, supplyY + 12);
    ctx.lineTo(cathodeX, elecTop);
    ctx.stroke();
  }

  function drawSwitch(w, h) {
    var sx = w * 0.13;
    var sy = h * 0.08 + 40;

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Switch', sx, sy - 6);

    // pivot
    ctx.beginPath();
    ctx.arc(sx - 10, sy + 4, 3, 0, Math.PI * 2);
    ctx.fillStyle = state.switchClosed ? 'rgba(100,200,120,0.8)' : 'rgba(200,100,100,0.6)';
    ctx.fill();

    // contact
    ctx.beginPath();
    ctx.arc(sx + 16, sy + 4, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(160,170,190,0.6)';
    ctx.fill();

    // arm
    ctx.strokeStyle = state.switchClosed ? 'rgba(100,200,120,0.8)' : 'rgba(200,100,100,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - 10, sy + 4);
    if (state.switchClosed) {
      ctx.lineTo(sx + 16, sy + 4);
    } else {
      ctx.lineTo(sx + 10, sy - 8);
    }
    ctx.stroke();
  }

  function drawCurrentArrows(w, h, cathodeX, anodeX, beakerTop) {
    var y = h * 0.08 + 12;
    ctx.fillStyle = 'rgba(100,200,255,0.5)';

    // arrows along top wire from + to anode
    drawArrow(anodeX - 30, y, 8, 'right');
    // arrows along top wire from - to cathode (conventional current)
    drawArrow(cathodeX + 30, y, 8, 'left');
  }

  function drawArrow(x, y, size, dir) {
    ctx.beginPath();
    if (dir === 'right') {
      ctx.moveTo(x - size, y - size / 2);
      ctx.lineTo(x, y);
      ctx.lineTo(x - size, y + size / 2);
    } else {
      ctx.moveTo(x + size, y - size / 2);
      ctx.lineTo(x, y);
      ctx.lineTo(x + size, y + size / 2);
    }
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
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

  /* ── Procedure tracking ── */
  function markProcedure(key) {
    if (state.procedureDone[key]) return;
    state.procedureDone[key] = true;
    var steps = dom.procList.querySelectorAll('.procedure-step');
    var nextActive = false;
    steps.forEach(function (el) {
      var s = el.getAttribute('data-step');
      if (state.procedureDone[s]) {
        el.classList.remove('active');
        el.classList.add('done');
      } else if (!nextActive) {
        el.classList.add('active');
        nextActive = true;
      }
    });
  }

  /* ── Guide toggle ── */
  dom.btnGuide.addEventListener('click', function () {
    state.guideOpen = !state.guideOpen;
    dom.guidePanel.style.display = state.guideOpen ? '' : 'none';
  });

  /* ── Reset ── */
  dom.btnReset.addEventListener('click', function () {
    stopAnimation();
    state.cellReady = false;
    state.switchClosed = false;
    state.elapsed = 0;
    state.bubbles = [];
    state.depositThickness = 0;
    state.anodeDissolve = 0;
    state.solutionFade = 0;
    state.procedureDone = {};

    dom.selElectrolyte.disabled = false;
    dom.selElectrode.disabled = false;
    dom.selElectrolyte.value = '';
    dom.selElectrode.value = '';
    dom.btnConfirm.disabled = true;
    dom.ionInfo.hidden = true;
    dom.controls.hidden = true;
    dom.currentDisplay.hidden = true;

    dom.obsBefore.hidden = true;
    dom.obsCathode.hidden = true;
    dom.obsAnode.hidden = true;
    dom.eqPanel.hidden = true;
    dom.idSection.hidden = true;
    dom.idCathode.value = '';
    dom.idAnode.value = '';
    dom.idResult.textContent = '';
    dom.idResult.className = 'id-result';

    var steps = dom.procList.querySelectorAll('.procedure-step');
    steps.forEach(function (el) {
      el.classList.remove('active', 'done');
    });

    resizeCanvas();
    drawCell();
    toast('Practical reset.', 'info');
  });

  /* ── Toast ── */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    $('toast-container').appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }

  /* ── Init ── */
  resizeCanvas();
  drawCell();
  markProcedure(''); // activate first step
  dom.procList.querySelector('.procedure-step').classList.add('active');
});
