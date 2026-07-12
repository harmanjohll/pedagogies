/* ============================================================
   Preparation of Salts – Canvas Simulation
   Step-by-step practical: warm acid, add base, stir, filter,
   evaporate, crystallise, dry
   ============================================================ */
(function () {
  'use strict';

  var D = SALTS_DATA;

  /* --- DOM refs --- */
  var canvas     = document.getElementById('workbench-canvas');
  var ctx        = canvas.getContext('2d');
  var selPair    = document.getElementById('sel-pair');
  var btnStart   = document.getElementById('btn-start');
  var btnReset   = document.getElementById('btn-reset');
  var btnGuide   = document.getElementById('btn-guide');
  var btnAction  = document.getElementById('btn-action');
  var actionBar  = document.getElementById('action-bar');
  var actionTitle = document.getElementById('action-step-title');
  var actionHint  = document.getElementById('action-step-hint');
  var eqInfo     = document.getElementById('equation-info');
  var eqText     = document.getElementById('equation-text');
  var obsBody    = document.getElementById('obs-body');
  var obsPlaceholder = document.getElementById('obs-placeholder');
  var procList   = document.getElementById('procedure-list');
  var toastContainer = document.getElementById('toast-container');

  /* --- Recording Mode --- */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  /* --- Canvas sizing --- */
  var W = 620, H = 420;
  canvas.width = W;
  canvas.height = H;

  /* --- State --- */
  var state = {
    pair: null,        /* selected acid-base pair object */
    pairKey: '',
    stepIndex: -1,     /* -1 = not started */
    animating: false,
    animFrame: 0,
    animId: null,
    lastTime: 0,

    /* Visual state evolved through steps */
    flameOn: false,
    flamePhase: 0,
    liquidColor: 'rgba(200, 210, 220, 0.15)',  /* colourless acid */
    liquidLevel: 0.45,
    particles: [],       /* CuO / base particles */
    particleAlpha: 1.0,
    stirAngle: 0,
    stirring: false,

    /* Filter stage */
    showFilter: false,
    filterProgress: 0,  /* 0..1 drip animation */
    filtrateDrips: [],

    /* Evaporate stage */
    showEvapDish: false,
    steamParticles: [],
    evapProgress: 0,

    /* Crystallise stage */
    showCrystals: false,
    crystalGrowth: 0,   /* 0..1 */

    /* Dry stage */
    showDrying: false,
    dryProgress: 0,

    /* Scene mode: 'beaker' | 'filter' | 'evaporate' | 'crystal' | 'dry' */
    scene: 'beaker'
  };

  /* --- Populate pair selector --- */
  var pairKeys = Object.keys(D.pairs);
  pairKeys.forEach(function (key) {
    var opt = document.createElement('option');
    opt.value = key;
    opt.textContent = D.pairs[key].base + ' + ' + D.pairs[key].acid;
    selPair.appendChild(opt);
  });

  selPair.addEventListener('change', function () {
    var key = selPair.value;
    if (key && D.pairs[key]) {
      state.pairKey = key;
      state.pair = D.pairs[key];
      eqText.textContent = state.pair.equation;
      eqInfo.hidden = false;
      btnStart.disabled = false;
    } else {
      state.pair = null;
      eqInfo.hidden = true;
      btnStart.disabled = true;
    }
  });

  /* --- Start practical --- */
  btnStart.addEventListener('click', function () {
    if (!state.pair) return;
    selPair.disabled = true;
    btnStart.hidden = true;
    state.stepIndex = 0;
    showStep();
  });

  /* --- Reset --- */
  btnReset.addEventListener('click', resetAll);

  function resetAll() {
    cancelAnimationFrame(state.animId);
    state.stepIndex = -1;
    state.animating = false;
    state.flameOn = false;
    state.flamePhase = 0;
    state.liquidColor = 'rgba(200, 210, 220, 0.15)';
    state.liquidLevel = 0.45;
    state.particles = [];
    state.particleAlpha = 1.0;
    state.stirAngle = 0;
    state.stirring = false;
    state.showFilter = false;
    state.filterProgress = 0;
    state.filtrateDrips = [];
    state.showEvapDish = false;
    state.steamParticles = [];
    state.evapProgress = 0;
    state.showCrystals = false;
    state.crystalGrowth = 0;
    state.showDrying = false;
    state.dryProgress = 0;
    state.scene = 'beaker';

    selPair.disabled = false;
    btnStart.hidden = false;
    btnStart.disabled = !state.pair;
    actionBar.hidden = true;

    /* Reset observations */
    obsBody.innerHTML = '';
    obsBody.appendChild(obsPlaceholder);
    obsPlaceholder.hidden = false;

    /* Reset procedure list */
    var items = procList.querySelectorAll('.procedure-step');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('active', 'done');
    }

    draw();
  }

  /* --- Guide toggle --- */
  var guidePanel = document.getElementById('guide-panel');
  var guideVisible = true;
  btnGuide.addEventListener('click', function () {
    guideVisible = !guideVisible;
    guidePanel.style.display = guideVisible ? '' : 'none';
  });

  /* --- Step management --- */
  function showStep() {
    var step = D.steps[state.stepIndex];
    if (!step) return;

    actionBar.hidden = false;
    actionTitle.textContent = 'Step ' + (state.stepIndex + 1) + ': ' + step.title;
    actionHint.textContent = step.instruction;
    btnAction.textContent = step.button;
    btnAction.disabled = false;

    highlightProcedure(step.id);
  }

  function highlightProcedure(stepId) {
    var items = procList.querySelectorAll('.procedure-step');
    var found = false;
    for (var i = 0; i < items.length; i++) {
      var id = items[i].getAttribute('data-step');
      if (id === stepId) {
        items[i].classList.add('active');
        items[i].classList.remove('done');
        found = true;
      } else if (!found) {
        items[i].classList.add('done');
        items[i].classList.remove('active');
      } else {
        items[i].classList.remove('active', 'done');
      }
    }
  }

  function addObservation(step) {
    obsPlaceholder.hidden = true;
    var card = document.createElement('div');
    card.className = 'obs-card';
    var isLast = state.stepIndex === D.steps.length - 1;
    if (isLast) card.classList.add('complete');

    var title = document.createElement('div');
    title.className = 'obs-card-title';
    title.textContent = 'Step ' + (state.stepIndex + 1) + ': ' + step.title;

    var text = document.createElement('div');
    text.className = 'obs-card-text';

    var isIndependent = typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided();
    var correctObs = step.observation(state.pair);

    if (isIndependent) {
      var input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Type your observation...';
      input.style.cssText = 'width:100%;font-size:var(--text-sm);border:1px dashed var(--color-border);padding:6px 8px;border-radius:6px;background:var(--color-surface);color:var(--color-text);font-family:inherit;';
      input.dataset.answer = correctObs;
      input.addEventListener('blur', function () {
        if (this.value.trim().length > 0 && !this.dataset.revealed) {
          this.dataset.revealed = 'true';
          var fb = document.createElement('div');
          fb.style.cssText = 'font-size:11px;color:var(--color-text-muted);margin-top:4px;font-style:italic;';
          fb.textContent = 'Expected: ' + correctObs;
          text.appendChild(fb);
        }
      });
      text.appendChild(input);
    } else {
      text.textContent = correctObs;
    }

    card.appendChild(title);
    card.appendChild(text);
    obsBody.appendChild(card);

    /* Scroll to bottom */
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* --- Action button handler --- */
  btnAction.addEventListener('click', function () {
    if (state.animating) return;
    var step = D.steps[state.stepIndex];
    if (!step) return;

    btnAction.disabled = true;
    addObservation(step);

    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('salts', step.id);
    }

    /* Dispatch to animation for this step */
    switch (step.id) {
      case 'warm':       animateWarm(); break;
      case 'add':        animateAdd(); break;
      case 'stir':       animateStir(); break;
      case 'filter':     animateFilter(); break;
      case 'evaporate':  animateEvaporate(); break;
      case 'crystallise': animateCrystallise(); break;
      case 'dry':        animateDry(); break;
      default:           advanceStep(); break;
    }
  });

  function advanceStep() {
    state.animating = false;
    state.stepIndex++;
    if (state.stepIndex < D.steps.length) {
      showStep();
      toast(D.steps[state.stepIndex - 1].title + ' complete');
    } else {
      /* Practical complete */
      actionBar.hidden = true;
      highlightAllDone();
      toast('Practical complete! Pure, dry sample prepared.', 'success');
      if (typeof LabAudio !== 'undefined') LabAudio.success();
      if (typeof LabProgress !== 'undefined') LabProgress.markComplete('salts');
      showTryAnotherSalt();
    }
  }

  function showTryAnotherSalt() {
    if (document.getElementById('try-another-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'try-another-bar';
    bar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 16px;background:var(--color-primary-light,#eff6ff);border:2px solid var(--color-primary);border-radius:var(--radius-md);margin-top:var(--sp-3);';
    var msg = document.createElement('span');
    msg.style.cssText = 'font-size:var(--text-sm);color:var(--color-text);';
    msg.textContent = 'Try preparing a different salt?';
    bar.appendChild(msg);
    var btn = document.createElement('button');
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = 'Prepare Another Salt';
    btn.addEventListener('click', function () {
      cancelAnimationFrame(state.animId);
      state.stepIndex = -1;
      state.animating = false;
      state.flameOn = false;
      state.flamePhase = 0;
      state.liquidColor = 'rgba(200, 210, 220, 0.15)';
      state.liquidLevel = 0.45;
      state.particles = [];
      state.particleAlpha = 1.0;
      state.stirAngle = 0;
      state.stirring = false;
      state.showFilter = false;
      state.filterProgress = 0;
      state.filtrateDrips = [];
      state.showEvapDish = false;
      state.steamParticles = [];
      state.evapProgress = 0;
      state.showCrystals = false;
      state.crystalGrowth = 0;
      state.showDrying = false;
      state.dryProgress = 0;
      state.scene = 'beaker';
      state.pair = null;
      state.pairKey = '';
      selPair.disabled = false;
      selPair.value = '';
      btnStart.hidden = false;
      btnStart.disabled = true;
      eqInfo.hidden = true;
      actionBar.hidden = true;

      /* Reset observations */
      obsBody.innerHTML = '';
      obsBody.appendChild(obsPlaceholder);
      obsPlaceholder.hidden = false;

      /* Reset procedure list */
      var items = procList.querySelectorAll('.procedure-step');
      for (var i = 0; i < items.length; i++) {
        items[i].classList.remove('active', 'done');
      }

      bar.remove();
      draw();
      toast('Select a new acid-base pair.', 'info');
    });
    bar.appendChild(btn);
    var parent = canvas.parentElement;
    if (parent) parent.appendChild(bar);
  }

  function highlightAllDone() {
    var items = procList.querySelectorAll('.procedure-step');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.add('done');
      items[i].classList.remove('active');
    }
  }

  /* ============================================================
     ANIMATION FUNCTIONS
     ============================================================ */

  /* --- Warm acid: turn on flame, animate convection --- */
  function animateWarm() {
    state.animating = true;
    state.flameOn = true;
    var duration = 2000;
    var start = null;

    function tick(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      state.flamePhase = elapsed * 0.005;

      draw();

      if (elapsed < duration) {
        state.animId = requestAnimationFrame(tick);
      } else {
        if (typeof LabAudio !== 'undefined') LabAudio.bubble();
        advanceStep();
      }
    }
    state.animId = requestAnimationFrame(tick);
  }

  /* --- Add CuO: particles appear --- */
  function animateAdd() {
    state.animating = true;

    /* Generate particles */
    state.particles = [];
    var count = 14;
    for (var i = 0; i < count; i++) {
      state.particles.push({
        x: 0.35 + Math.random() * 0.30,
        y: 0.15 + Math.random() * 0.15,  /* start above liquid */
        targetY: 0.50 + Math.random() * 0.25,
        size: 2 + Math.random() * 3,
        settled: false
      });
    }
    state.particleAlpha = 1.0;

    var duration = 2200;
    var start = null;

    function tick(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var t = Math.min(elapsed / duration, 1);

      /* Particles fall into liquid */
      for (var i = 0; i < state.particles.length; i++) {
        var p = state.particles[i];
        var delay = i * 0.04;
        var pt = Math.max(0, Math.min((t - delay) / (1 - delay), 1));
        p.y = p.y + (p.targetY - 0.15) * easeOutCubic(pt) * 0.05;
        if (pt > 0.5) p.y = p.targetY;
      }

      state.flamePhase += 0.08;
      draw();

      if (elapsed < duration) {
        state.animId = requestAnimationFrame(tick);
      } else {
        if (typeof LabAudio !== 'undefined') LabAudio.pour();
        advanceStep();
      }
    }
    state.animId = requestAnimationFrame(tick);
  }

  /* --- Stir: particles dissolve, solution changes colour --- */
  function animateStir() {
    state.animating = true;
    state.stirring = true;
    var duration = 3000;
    var start = null;

    function tick(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var t = Math.min(elapsed / duration, 1);

      /* Stir rod oscillation */
      state.stirAngle = Math.sin(t * Math.PI * 6) * 0.15;

      /* Solution colour transition */
      state.liquidColor = lerpColor(
        'rgba(200, 210, 220, 0.15)',
        state.pair.solutionColor,
        easeInOutCubic(t)
      );

      /* Particles dissolve (but some remain for excess) */
      var dissolveCount = Math.floor(state.particles.length * 0.7);
      for (var i = 0; i < state.particles.length; i++) {
        if (i < dissolveCount) {
          state.particles[i].size *= (1 - t * 0.02);
          if (t > 0.7) state.particles[i].size = 0;
        }
      }

      state.flamePhase += 0.08;
      draw();

      if (elapsed < duration) {
        state.animId = requestAnimationFrame(tick);
      } else {
        state.stirring = false;
        /* Keep a few undissolved particles (excess) */
        state.particles = state.particles.filter(function (p) { return p.size > 0.5; });
        if (typeof LabAudio !== 'undefined') LabAudio.click();
        advanceStep();
      }
    }
    state.animId = requestAnimationFrame(tick);
  }

  /* --- Filter: switch to filter scene --- */
  function animateFilter() {
    state.animating = true;
    state.scene = 'filter';
    state.showFilter = true;
    state.filterProgress = 0;
    state.filtrateDrips = [];
    state.flameOn = false;

    var duration = 3500;
    var start = null;

    function tick(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var t = Math.min(elapsed / duration, 1);
      state.filterProgress = t;

      /* Spawn filtrate drips */
      if (t > 0.15 && t < 0.85 && Math.random() < 0.12) {
        state.filtrateDrips.push({
          x: 0.50 + (Math.random() - 0.5) * 0.02,
          y: 0.58,
          vy: 0.003 + Math.random() * 0.002,
          alpha: 1
        });
      }

      /* Update drips */
      for (var i = state.filtrateDrips.length - 1; i >= 0; i--) {
        var d = state.filtrateDrips[i];
        d.y += d.vy;
        if (d.y > 0.82) {
          state.filtrateDrips.splice(i, 1);
        }
      }

      draw();

      if (elapsed < duration) {
        state.animId = requestAnimationFrame(tick);
      } else {
        if (typeof LabAudio !== 'undefined') LabAudio.pour();
        advanceStep();
      }
    }
    state.animId = requestAnimationFrame(tick);
  }

  /* --- Evaporate: switch to evaporating dish --- */
  function animateEvaporate() {
    state.animating = true;
    state.scene = 'evaporate';
    state.showEvapDish = true;
    state.steamParticles = [];
    state.evapProgress = 0;
    state.flameOn = true;

    var duration = 3500;
    var start = null;

    function tick(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var t = Math.min(elapsed / duration, 1);
      state.evapProgress = t;
      state.flamePhase += 0.1;

      /* Spawn steam */
      if (t > 0.1 && Math.random() < 0.2) {
        state.steamParticles.push({
          x: 0.40 + Math.random() * 0.20,
          y: 0.38,
          vy: -0.002 - Math.random() * 0.002,
          vx: (Math.random() - 0.5) * 0.001,
          size: 2 + Math.random() * 3,
          alpha: 0.5 + Math.random() * 0.3
        });
      }

      /* Update steam */
      for (var i = state.steamParticles.length - 1; i >= 0; i--) {
        var s = state.steamParticles[i];
        s.y += s.vy;
        s.x += s.vx + Math.sin(s.y * 30) * 0.0005;
        s.alpha -= 0.005;
        s.size += 0.02;
        if (s.alpha <= 0 || s.y < 0.05) {
          state.steamParticles.splice(i, 1);
        }
      }

      draw();

      if (elapsed < duration) {
        state.animId = requestAnimationFrame(tick);
      } else {
        if (typeof LabAudio !== 'undefined') LabAudio.bubble();
        advanceStep();
      }
    }
    state.animId = requestAnimationFrame(tick);
  }

  /* --- Crystallise: crystals grow in dish --- */
  function animateCrystallise() {
    state.animating = true;
    state.scene = 'evaporate';  /* same dish scene */
    state.showCrystals = true;
    state.crystalGrowth = 0;
    state.flameOn = false;
    state.steamParticles = [];

    var duration = 3000;
    var start = null;

    function tick(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var t = Math.min(elapsed / duration, 1);
      state.crystalGrowth = easeOutCubic(t);

      draw();

      if (elapsed < duration) {
        state.animId = requestAnimationFrame(tick);
      } else {
        if (typeof LabAudio !== 'undefined') LabAudio.record();
        advanceStep();
      }
    }
    state.animId = requestAnimationFrame(tick);
  }

  /* --- Dry: filter paper patting --- */
  function animateDry() {
    state.animating = true;
    state.scene = 'dry';
    state.showDrying = true;
    state.dryProgress = 0;

    var duration = 2500;
    var start = null;

    function tick(ts) {
      if (!start) start = ts;
      var elapsed = ts - start;
      var t = Math.min(elapsed / duration, 1);
      state.dryProgress = t;

      draw();

      if (elapsed < duration) {
        state.animId = requestAnimationFrame(tick);
      } else {
        if (typeof LabAudio !== 'undefined') LabAudio.success();
        advanceStep();
      }
    }
    state.animId = requestAnimationFrame(tick);
  }


  /* ============================================================
     DRAWING FUNCTIONS
     ============================================================ */

  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* Bench surface */
    drawBench();

    switch (state.scene) {
      case 'beaker':
        drawTripodAndBurner();
        drawBeaker();
        drawParticles();
        if (state.stirring) drawStirRod();
        break;
      case 'filter':
        drawFilterScene();
        break;
      case 'evaporate':
        drawEvaporateScene();
        break;
      case 'dry':
        drawDryScene();
        break;
    }
  }

  /* --- Bench surface --- */
  function drawBench() {
    var benchY = H - 50;
    ctx.fillStyle = '#2a2b3d';
    ctx.fillRect(0, benchY, W, 50);
    ctx.fillStyle = '#4a4b62';
    ctx.fillRect(0, benchY - 2, W, 3);
  }

  /* --- Tripod with Bunsen burner --- */
  function drawTripodAndBurner() {
    var cx = W * 0.50;
    var benchY = H - 52;

    /* Bunsen burner base */
    var burnerBaseY = benchY;
    var burnerW = 30;
    var burnerH = 60;

    /* Burner body - cylindrical tube */
    ctx.fillStyle = '#5c5f6e';
    ctx.fillRect(cx - burnerW / 2, burnerBaseY - burnerH, burnerW, burnerH);

    /* Burner base plate */
    ctx.fillStyle = '#4a4d5c';
    var baseW = 50;
    ctx.beginPath();
    ctx.ellipse(cx, burnerBaseY, baseW / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Air hole ring */
    ctx.fillStyle = '#6b6e80';
    ctx.fillRect(cx - burnerW / 2 - 3, burnerBaseY - burnerH + 12, burnerW + 6, 6);

    /* Flame if on */
    if (state.flameOn) {
      drawFlame(cx, burnerBaseY - burnerH);
    }

    /* Tripod legs */
    ctx.strokeStyle = '#6b6e80';
    ctx.lineWidth = 3;
    var tripodTop = burnerBaseY - burnerH - 48;

    /* Three legs */
    ctx.beginPath();
    ctx.moveTo(cx - 45, benchY);
    ctx.lineTo(cx - 10, tripodTop);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 45, benchY);
    ctx.lineTo(cx + 10, tripodTop);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, benchY);
    ctx.lineTo(cx, tripodTop + 5);
    ctx.stroke();

    /* Gauze on tripod */
    ctx.fillStyle = '#8b8f9e';
    ctx.fillRect(cx - 40, tripodTop - 2, 80, 4);

    /* Gauze wire mesh pattern */
    ctx.strokeStyle = 'rgba(180, 185, 200, 0.4)';
    ctx.lineWidth = 0.5;
    for (var gx = cx - 38; gx <= cx + 38; gx += 6) {
      ctx.beginPath();
      ctx.moveTo(gx, tripodTop - 1);
      ctx.lineTo(gx, tripodTop + 1);
      ctx.stroke();
    }
  }

  /* --- Flame animation --- */
  function drawFlame(cx, topY) {
    var p = state.flamePhase;

    /* Outer flame - yellow/orange */
    ctx.beginPath();
    var outerH = 30 + Math.sin(p * 1.3) * 4;
    var outerW = 14 + Math.sin(p * 2.1) * 2;
    ctx.moveTo(cx - outerW, topY);
    ctx.quadraticCurveTo(cx - outerW * 0.6, topY - outerH * 0.6, cx + Math.sin(p) * 2, topY - outerH);
    ctx.quadraticCurveTo(cx + outerW * 0.6, topY - outerH * 0.6, cx + outerW, topY);
    ctx.closePath();
    var outerGrad = ctx.createLinearGradient(cx, topY, cx, topY - outerH);
    outerGrad.addColorStop(0, 'rgba(255, 165, 0, 0.9)');
    outerGrad.addColorStop(0.5, 'rgba(255, 200, 50, 0.7)');
    outerGrad.addColorStop(1, 'rgba(255, 220, 100, 0.1)');
    ctx.fillStyle = outerGrad;
    ctx.fill();

    /* Inner flame - blue */
    ctx.beginPath();
    var innerH = 18 + Math.sin(p * 1.7) * 3;
    var innerW = 7 + Math.sin(p * 2.5) * 1;
    ctx.moveTo(cx - innerW, topY);
    ctx.quadraticCurveTo(cx - innerW * 0.5, topY - innerH * 0.6, cx + Math.sin(p * 1.2) * 1.5, topY - innerH);
    ctx.quadraticCurveTo(cx + innerW * 0.5, topY - innerH * 0.6, cx + innerW, topY);
    ctx.closePath();
    var innerGrad = ctx.createLinearGradient(cx, topY, cx, topY - innerH);
    innerGrad.addColorStop(0, 'rgba(60, 120, 255, 0.9)');
    innerGrad.addColorStop(0.7, 'rgba(100, 160, 255, 0.5)');
    innerGrad.addColorStop(1, 'rgba(180, 200, 255, 0.1)');
    ctx.fillStyle = innerGrad;
    ctx.fill();
  }

  /* --- Beaker on gauze --- */
  function drawBeaker() {
    var cx = W * 0.50;
    var benchY = H - 52;
    var tripodTop = benchY - 60 - 48;

    var bx = cx - 55;
    var by = tripodTop - 2;
    var bw = 110;
    var bh = 120;

    /* Beaker body */
    ctx.beginPath();
    ctx.moveTo(bx, by - bh);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by - bh);
    /* Spout lip */
    ctx.lineTo(bx + bw + 8, by - bh - 5);
    ctx.strokeStyle = 'rgba(160, 170, 195, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* Glass fill */
    ctx.fillStyle = 'rgba(235, 240, 250, 0.08)';
    ctx.fillRect(bx + 1, by - bh + 1, bw - 2, bh - 2);

    /* Liquid */
    var liqH = bh * state.liquidLevel;
    var liqY = by - liqH;
    ctx.fillStyle = state.liquidColor;
    ctx.fillRect(bx + 2, liqY, bw - 4, liqH - 2);

    /* Liquid meniscus highlight */
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 4, liqY);
    ctx.quadraticCurveTo(cx, liqY + 3, bx + bw - 4, liqY);
    ctx.stroke();

    /* Glass highlight streak */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(bx + 8, by - bh + 10, 2, bh * 0.5);

    /* Graduation marks */
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;
    for (var m = 1; m <= 4; m++) {
      var my = by - (bh * m * 0.2);
      ctx.beginPath();
      ctx.moveTo(bx + bw - 12, my);
      ctx.lineTo(bx + bw - 4, my);
      ctx.stroke();
    }

    /* Label */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('250 mL', cx, by - bh + 14);
  }

  /* --- Base particles in beaker --- */
  function drawParticles() {
    if (state.particles.length === 0) return;

    var cx = W * 0.50;
    var benchY = H - 52;
    var tripodTop = benchY - 60 - 48;
    var by = tripodTop - 2;
    var bh = 120;

    for (var i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      if (p.size <= 0) continue;

      var px = cx - 55 + p.x * 110;
      var py = by - bh + p.y * bh;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = state.pair ? state.pair.baseColor : '#2a2a2a';
      ctx.globalAlpha = state.particleAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /* --- Glass stirring rod --- */
  function drawStirRod() {
    var cx = W * 0.50;
    var benchY = H - 52;
    var tripodTop = benchY - 60 - 48;
    var by = tripodTop - 2;
    var bh = 120;

    ctx.save();
    ctx.translate(cx + 20, by - bh - 20);
    ctx.rotate(state.stirAngle);

    ctx.strokeStyle = 'rgba(200, 210, 230, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, bh + 10);
    ctx.stroke();

    /* Glass highlight */
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.lineTo(1, bh + 8);
    ctx.stroke();

    ctx.restore();
  }

  /* --- Filter scene: funnel, flask, residue --- */
  function drawFilterScene() {
    var cx = W * 0.50;
    var benchY = H - 52;

    /* Retort stand */
    ctx.fillStyle = '#5c5f6e';
    ctx.fillRect(cx - 80, benchY - 10, 60, 10);  /* base */
    ctx.fillRect(cx - 75, benchY - 280, 8, 280);  /* pole */

    /* Clamp */
    ctx.fillStyle = '#6b6e80';
    ctx.fillRect(cx - 67, benchY - 200, 75, 8);

    /* Filter funnel - conical */
    var funnelCX = cx + 5;
    var funnelTop = benchY - 220;
    var funnelBottom = benchY - 140;
    var funnelTopW = 50;
    var funnelBottomW = 6;

    /* Funnel glass body */
    ctx.beginPath();
    ctx.moveTo(funnelCX - funnelTopW, funnelTop);
    ctx.lineTo(funnelCX - funnelBottomW, funnelBottom);
    ctx.lineTo(funnelCX + funnelBottomW, funnelBottom);
    ctx.lineTo(funnelCX + funnelTopW, funnelTop);
    ctx.closePath();
    ctx.fillStyle = 'rgba(235, 240, 250, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 170, 195, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* Stem */
    ctx.fillStyle = 'rgba(235, 240, 250, 0.10)';
    ctx.fillRect(funnelCX - 4, funnelBottom, 8, 35);
    ctx.strokeStyle = 'rgba(160, 170, 195, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(funnelCX - 4, funnelBottom, 8, 35);

    /* Filter paper - folded cone */
    var paperProgress = Math.min(state.filterProgress * 3, 1);
    ctx.fillStyle = 'rgba(220, 215, 200, 0.6)';
    ctx.beginPath();
    ctx.moveTo(funnelCX - funnelTopW + 4, funnelTop + 3);
    ctx.lineTo(funnelCX, funnelBottom - 10);
    ctx.lineTo(funnelCX + funnelTopW - 4, funnelTop + 3);
    ctx.closePath();
    ctx.fill();

    /* Mixture/residue in funnel (darkens as filtering proceeds) */
    if (state.pair) {
      var residueAlpha = Math.min(state.filterProgress * 2, 0.8);
      ctx.fillStyle = state.pair.baseColor;
      ctx.globalAlpha = residueAlpha;
      ctx.beginPath();
      ctx.moveTo(funnelCX - 20, funnelTop + 25);
      ctx.lineTo(funnelCX, funnelBottom - 15);
      ctx.lineTo(funnelCX + 20, funnelTop + 25);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* Collecting flask below */
    var flaskY = benchY;
    var flaskH = 100;
    var flaskW = 80;
    var flaskX = funnelCX - flaskW / 2;

    /* Conical flask shape */
    ctx.beginPath();
    ctx.moveTo(flaskX, flaskY);
    ctx.lineTo(funnelCX - 10, flaskY - flaskH);
    ctx.lineTo(funnelCX + 10, flaskY - flaskH);
    ctx.lineTo(flaskX + flaskW, flaskY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(235, 240, 250, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 170, 195, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* Filtrate collecting in flask */
    if (state.filterProgress > 0.1 && state.pair) {
      var filtrateH = flaskH * 0.5 * Math.min(state.filterProgress * 1.5, 1);
      var filtrateY = flaskY - filtrateH;
      var ratio = filtrateH / flaskH;
      var filtrateHalfW = (flaskW / 2) * (1 - ratio * 0.75);

      ctx.beginPath();
      ctx.moveTo(funnelCX - filtrateHalfW, filtrateY);
      ctx.lineTo(flaskX + 2, flaskY - 2);
      ctx.lineTo(flaskX + flaskW - 2, flaskY - 2);
      ctx.lineTo(funnelCX + filtrateHalfW, filtrateY);
      ctx.closePath();
      ctx.fillStyle = state.pair.solutionColor;
      ctx.fill();
    }

    /* Drips falling from funnel stem */
    if (state.pair) {
      ctx.fillStyle = state.pair.solutionColor;
      for (var i = 0; i < state.filtrateDrips.length; i++) {
        var d = state.filtrateDrips[i];
        var dx = d.x * W;
        var dy = d.y * H;
        ctx.beginPath();
        ctx.ellipse(dx, dy, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* Labels */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Filter funnel', funnelCX, funnelTop - 10);
    ctx.fillText('Conical flask', funnelCX, flaskY + 16);

    if (state.filterProgress > 0.5) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '9px Inter, sans-serif';

      /* Residue label */
      ctx.textAlign = 'left';
      ctx.fillText('Residue: excess ' + (state.pair ? state.pair.baseFormula : ''), funnelCX + funnelTopW + 8, funnelTop + 30);

      /* Filtrate label */
      ctx.textAlign = 'left';
      ctx.fillText('Filtrate: ' + (state.pair ? state.pair.saltFormula + '(aq)' : ''), flaskX + flaskW + 8, flaskY - 30);
    }
  }

  /* --- Evaporate scene: dish on tripod --- */
  function drawEvaporateScene() {
    var cx = W * 0.50;
    var benchY = H - 52;

    /* Tripod + burner (if flame on) */
    if (state.flameOn) {
      /* Small tripod for evaporating dish */
      ctx.strokeStyle = '#6b6e80';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx - 40, benchY); ctx.lineTo(cx - 8, benchY - 70); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 40, benchY); ctx.lineTo(cx + 8, benchY - 70); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, benchY); ctx.lineTo(cx, benchY - 65); ctx.stroke();

      /* Gauze */
      ctx.fillStyle = '#8b8f9e';
      ctx.fillRect(cx - 35, benchY - 72, 70, 3);

      /* Burner */
      ctx.fillStyle = '#5c5f6e';
      ctx.fillRect(cx - 12, benchY - 50, 24, 50);
      ctx.fillStyle = '#4a4d5c';
      ctx.beginPath();
      ctx.ellipse(cx, benchY, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      drawFlame(cx, benchY - 50);
    } else {
      /* Just a surface for the dish */
      ctx.fillStyle = '#3a3b4d';
      ctx.fillRect(cx - 50, benchY - 10, 100, 10);
    }

    /* Evaporating dish */
    var dishY = state.flameOn ? benchY - 74 : benchY - 12;
    var dishW = 100;
    var dishH = 25;

    ctx.beginPath();
    ctx.ellipse(cx, dishY, dishW / 2, dishH / 2, 0, 0, Math.PI);
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(245, 245, 250, 0.1)';
    ctx.fill();

    /* Rim */
    ctx.beginPath();
    ctx.ellipse(cx, dishY, dishW / 2, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* Solution in dish */
    if (state.pair) {
      var solutionLevel = state.showCrystals ? 0.3 : (1 - state.evapProgress * 0.55);
      ctx.beginPath();
      ctx.ellipse(cx, dishY + 2, (dishW / 2 - 4) * solutionLevel, (dishH / 2 - 3) * solutionLevel, 0, 0, Math.PI);
      ctx.fillStyle = state.pair.solutionColor;
      ctx.fill();
    }

    /* Crystals growing */
    if (state.showCrystals && state.pair) {
      drawCrystals(cx, dishY, dishW, state.crystalGrowth);
    }

    /* Steam particles */
    for (var i = 0; i < state.steamParticles.length; i++) {
      var s = state.steamParticles[i];
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200, 210, 230, ' + s.alpha + ')';
      ctx.fill();
    }

    /* Labels */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Evaporating dish', cx, dishY + dishH + 16);

    if (state.showCrystals && state.crystalGrowth > 0.5) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(state.pair ? state.pair.crystalDesc : 'crystals', cx, dishY - dishH - 8);
    }
  }

  /* --- Draw crystals in evaporating dish --- */
  function drawCrystals(cx, dishY, dishW, growth) {
    if (!state.pair) return;

    var crystalPositions = [
      { dx: -18, dy: 3 },
      { dx: 5, dy: 5 },
      { dx: -8, dy: 7 },
      { dx: 15, dy: 4 },
      { dx: -25, dy: 5 },
      { dx: 22, dy: 6 },
      { dx: 0, dy: 8 },
      { dx: -12, dy: 4 },
      { dx: 10, dy: 3 }
    ];

    for (var i = 0; i < crystalPositions.length; i++) {
      var cp = crystalPositions[i];
      var size = (3 + i % 3) * growth;
      if (size < 0.5) continue;

      var x = cx + cp.dx;
      var y = dishY + cp.dy;

      /* Diamond/rhombus crystal shape */
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.7, y);
      ctx.lineTo(x, y + size * 0.6);
      ctx.lineTo(x - size * 0.7, y);
      ctx.closePath();
      ctx.fillStyle = state.pair.crystalColor;
      ctx.fill();

      /* Crystal highlight */
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.3, y - size * 0.3);
      ctx.lineTo(x, y);
      ctx.lineTo(x - size * 0.3, y - size * 0.3);
      ctx.closePath();
      ctx.fillStyle = state.pair.crystalHighlight;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /* --- Dry scene: crystals on filter paper --- */
  function drawDryScene() {
    var cx = W * 0.50;
    var benchY = H - 52;

    /* Filter paper sheets - bottom */
    ctx.fillStyle = 'rgba(235, 230, 215, 0.7)';
    roundRect(ctx, cx - 70, benchY - 80, 140, 60, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 195, 180, 0.5)';
    ctx.lineWidth = 1;
    roundRect(ctx, cx - 70, benchY - 80, 140, 60, 4);
    ctx.stroke();

    /* Paper texture lines */
    ctx.strokeStyle = 'rgba(200, 195, 180, 0.25)';
    ctx.lineWidth = 0.5;
    for (var ly = benchY - 75; ly < benchY - 25; ly += 8) {
      ctx.beginPath();
      ctx.moveTo(cx - 65, ly);
      ctx.lineTo(cx + 65, ly);
      ctx.stroke();
    }

    /* Crystals on paper */
    if (state.pair) {
      var crystalPositions = [
        { dx: -15, dy: -50 }, { dx: 5, dy: -48 }, { dx: -5, dy: -42 },
        { dx: 12, dy: -55 }, { dx: -20, dy: -45 }, { dx: 18, dy: -42 },
        { dx: 0, dy: -52 }, { dx: -10, dy: -47 }, { dx: 8, dy: -44 }
      ];

      for (var i = 0; i < crystalPositions.length; i++) {
        var cp = crystalPositions[i];
        var size = 3 + i % 3;
        var x = cx + cp.dx;
        var y = benchY + cp.dy;

        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.7, y);
        ctx.lineTo(x, y + size * 0.6);
        ctx.lineTo(x - size * 0.7, y);
        ctx.closePath();
        ctx.fillStyle = state.pair.crystalColor;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.3, y - size * 0.3);
        ctx.lineTo(x, y);
        ctx.lineTo(x - size * 0.3, y - size * 0.3);
        ctx.closePath();
        ctx.fillStyle = state.pair.crystalHighlight;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* Top filter paper (patting) - bouncing animation */
    var patBounce = Math.abs(Math.sin(state.dryProgress * Math.PI * 5));
    var topPaperY = benchY - 85 - patBounce * 20;
    ctx.fillStyle = 'rgba(235, 230, 215, 0.8)';
    roundRect(ctx, cx - 60, topPaperY, 120, 40, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 195, 180, 0.5)';
    ctx.lineWidth = 1;
    roundRect(ctx, cx - 60, topPaperY, 120, 40, 4);
    ctx.stroke();

    /* Damp patches fading */
    if (state.dryProgress < 0.7) {
      ctx.fillStyle = 'rgba(150, 160, 180, ' + (0.2 * (1 - state.dryProgress)) + ')';
      ctx.beginPath();
      ctx.ellipse(cx - 10, topPaperY + 20, 15, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 12, topPaperY + 22, 10, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Labels */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Filter paper', cx, benchY - 5);

    if (state.dryProgress > 0.8 && state.pair) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText('Pure, dry ' + state.pair.crystalDesc, cx, benchY - 95);
    }
  }


  /* ============================================================
     UTILITY FUNCTIONS
     ============================================================ */

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerpColor(colorA, colorB, t) {
    /* Parse rgba strings and interpolate */
    var a = parseRGBA(colorA);
    var b = parseRGBA(colorB);
    if (!a || !b) return colorB;

    var r = Math.round(a.r + (b.r - a.r) * t);
    var g = Math.round(a.g + (b.g - a.g) * t);
    var bl = Math.round(a.b + (b.b - a.b) * t);
    var al = a.a + (b.a - a.a) * t;
    return 'rgba(' + r + ', ' + g + ', ' + bl + ', ' + al.toFixed(3) + ')';
  }

  function parseRGBA(str) {
    var m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (!m) return null;
    return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]), a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  }

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


  /* --- Toast function --- */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    toastContainer.appendChild(el);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
    setTimeout(function () {
      el.classList.add('exiting');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 200);
    }, 3000);
  }


  /* --- Init --- */
  draw();
  if (typeof LabProgress !== 'undefined') LabProgress.markVisited('salts');

})();
