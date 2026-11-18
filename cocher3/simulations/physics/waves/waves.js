/* ============================================================
   Waves & Ripple Tank — Simulation
   Canvas-based wave propagation with reflection, refraction,
   and diffraction experiments.
   Uses pixel-level wave rendering with sine-based amplitude,
   Huygens secondary sources for diffraction, and phase-
   accumulation for refraction.
   ============================================================ */
(function () {
  'use strict';

  var D = WAVES_DATA;
  var TWO_PI = 2 * Math.PI;

  /* ── DOM ── */
  var canvas      = document.getElementById('ripple-canvas');
  var ctx         = canvas.getContext('2d');
  var freqSlider  = document.getElementById('freq-slider');
  var freqDisplay = document.getElementById('freq-display');
  var speedSlider = document.getElementById('speed-slider');
  var speedDisplay = document.getElementById('speed-display');
  var btnPlay     = document.getElementById('btn-play');
  var btnPause    = document.getElementById('btn-pause');
  var btnStep     = document.getElementById('btn-step');
  var btnReset    = document.getElementById('btn-reset');
  var btnGuide    = document.getElementById('btn-toggle-guide');
  var guidePanel  = document.getElementById('guide-panel');
  var expTabs     = document.getElementById('experiment-tabs');
  var expDesc     = document.getElementById('experiment-desc');
  var procList    = document.getElementById('procedure-list');
  var overlay     = document.getElementById('tank-overlay');
  var measFreq    = document.getElementById('meas-freq');
  var measLambda  = document.getElementById('meas-lambda');
  var measSpeed   = document.getElementById('meas-speed');
  var measLambdaShallow    = document.getElementById('meas-lambda-shallow');
  var measSpeedShallow     = document.getElementById('meas-speed-shallow');
  var measLambdaShallowRow = document.getElementById('meas-lambda-shallow-row');
  var measSpeedShallowRow  = document.getElementById('meas-speed-shallow-row');
  var equationSub  = document.getElementById('equation-sub');
  var waveTypeBtns = document.getElementById('wave-type-toggle');
  var depthToggle  = document.getElementById('depth-toggle');
  var depthRow     = document.getElementById('depth-toggle-row');
  var depthLabel   = document.getElementById('depth-toggle-label');
  var btnSaveObs   = document.getElementById('btn-save-obs');
  var obsText      = document.getElementById('observations-text');
  var obsLog       = document.getElementById('obs-log');
  var obsEmpty     = document.getElementById('obs-empty');
  var toastContainer = document.getElementById('toast-container');

  /* ── Canvas sizing ── */
  var W, H, imageData, pixels;

  function resizeCanvas() {
    var parent = canvas.parentElement;
    W = Math.min(parent.clientWidth - 32, 700);
    H = Math.min(parent.clientHeight - 100, 520);
    if (W < 200) W = 200;
    if (H < 200) H = 200;
    canvas.width  = W;
    canvas.height = H;
    imageData = ctx.createImageData(W, H);
    pixels = imageData.data;
    if (!state.playing) renderFrame();
  }

  /* ── State ── */
  var state = {
    experiment: 'reflection',
    frequency: D.frequencyDefault,
    speedDeep: D.speedDeep,
    speedShallow: D.speedShallow,
    waveType: 'plane',
    depthOpt: 'default',
    time: 0,
    playing: false,
    animSpeed: 1,
    animId: null,
    lastFrame: 0,
    /* Tracking */
    procedureDone: {},
    exploredExps: {},
    observations: [],
    scorer: null
  };

  /* ── Experiment lookup ── */
  var experiments = {};
  D.experiments.forEach(function (e) { experiments[e.id] = e; });

  /* ── Scorer ── */
  if (typeof LabScore !== 'undefined') {
    state.scorer = LabScore.create({
      practical: 'waves',
      criteria: D.scoring.criteria,
      totalMarks: D.scoring.totalMarks
    });
  }

  /* ── LabRecordMode integration ── */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
    LabRecordMode.onChange(function () {
      updateMeasurements();
    });
  }

  /* ── Progress ── */
  if (typeof LabProgress !== 'undefined') {
    LabProgress.markVisited('waves');
  }

  /* ── Derived values ── */
  function lambdaDeep()    { return state.speedDeep / state.frequency; }
  function lambdaShallow() { return state.speedShallow / state.frequency; }

  /* Scale: pixels per cm — choose so ~10 wavelengths fit across canvas */
  function pxPerCm() { return Math.min(W, H) / 25; }


  /* ══════════════════════════════════════
     EXPERIMENT SELECTION
     ══════════════════════════════════════ */

  function selectExperiment(id) {
    state.experiment = id;
    state.exploredExps[id] = true;
    state.depthOpt = 'default';

    var exp = experiments[id];
    expDesc.textContent = exp ? exp.description : '';

    /* Update tab highlights */
    var tabs = expTabs.querySelectorAll('.experiment-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-exp') === id);
    }

    /* Configure depth/option toggle */
    configureDepthToggle(id);

    /* Show/hide shallow measurements */
    var showShallow = id === 'refraction';
    measLambdaShallowRow.style.display = showShallow ? '' : 'none';
    measSpeedShallowRow.style.display  = showShallow ? '' : 'none';

    /* Build procedure steps */
    state.procedureDone = {};
    procList.innerHTML = '';
    if (exp && exp.steps) {
      for (var s = 0; s < exp.steps.length; s++) {
        var li = document.createElement('li');
        li.className = 'procedure-step' + (s === 0 ? ' active' : '');
        li.setAttribute('data-step', exp.steps[s].id);
        li.innerHTML = '<strong>' + exp.steps[s].title + '</strong> — ' + exp.steps[s].instruction;
        procList.appendChild(li);
      }
      markProcedure(exp.steps[0].id);
    }

    /* Score: explored all three */
    if (Object.keys(state.exploredExps).length >= 3 && state.scorer) {
      state.scorer.award('select-exp', 2);
    }

    state.time = 0;
    updateMeasurements();
    if (!state.playing) renderFrame();

    toast('Experiment: ' + (exp ? exp.name : id));
    if (typeof LabAudio !== 'undefined') LabAudio.switchToggle();
  }

  function configureDepthToggle(id) {
    var btns = depthToggle.querySelectorAll('.toggle-btn');
    btns[0].classList.add('active');
    btns[1].classList.remove('active');

    if (id === 'reflection') {
      depthRow.style.display = '';
      depthLabel.textContent = 'Barrier Shape';
      btns[0].textContent = 'Flat';
      btns[0].setAttribute('data-opt', 'default');
      btns[1].textContent = 'Curved';
      btns[1].setAttribute('data-opt', 'alt');
    } else if (id === 'refraction') {
      depthRow.style.display = '';
      depthLabel.textContent = 'Boundary Angle';
      btns[0].textContent = 'Angled';
      btns[0].setAttribute('data-opt', 'default');
      btns[1].textContent = 'Straight';
      btns[1].setAttribute('data-opt', 'alt');
    } else if (id === 'diffraction') {
      depthRow.style.display = '';
      depthLabel.textContent = 'Gap Width';
      btns[0].textContent = 'Wide';
      btns[0].setAttribute('data-opt', 'default');
      btns[1].textContent = 'Narrow';
      btns[1].setAttribute('data-opt', 'alt');
    }
  }


  /* ══════════════════════════════════════
     MEASUREMENTS
     ══════════════════════════════════════ */

  function updateMeasurements() {
    var f = state.frequency;
    var v = state.speedDeep;
    var lam = lambdaDeep();

    var isIndependent = typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided();

    measFreq.textContent   = f.toFixed(1) + ' Hz';

    if (isIndependent) {
      /* In independent mode, students must determine wavelength and speed themselves */
      measLambda.textContent = '— (measure)';
      measSpeed.textContent  = '— (calculate)';
      measLambdaShallow.textContent = '— (measure)';
      measSpeedShallow.textContent  = '— (calculate)';
      equationSub.innerHTML = 'v = f &times; &lambda; &mdash; calculate using your measurements';
    } else {
      measLambda.textContent = lam.toFixed(2) + ' cm';
      measSpeed.textContent  = v.toFixed(1) + ' cm/s';

      var vs = state.speedShallow;
      var lamS = lambdaShallow();
      measLambdaShallow.textContent = lamS.toFixed(2) + ' cm';
      measSpeedShallow.textContent  = vs.toFixed(1) + ' cm/s';

      equationSub.innerHTML = v.toFixed(1) + ' = ' + f.toFixed(1) + ' &times; ' + lam.toFixed(2);
    }
  }


  /* ══════════════════════════════════════
     WAVE RENDERING
     ══════════════════════════════════════ */

  /* Scale factor for converting cm to pixels */
  function renderFrame() {
    if (!pixels) return;
    var f    = state.frequency;
    var time = state.time;
    var exp  = state.experiment;
    var scale = pxPerCm();
    var lamD = lambdaDeep() * scale;   /* deep wavelength in px */
    var lamS = lambdaShallow() * scale; /* shallow wavelength in px */

    /* Source position */
    var srcX, srcY;
    if (state.waveType === 'plane') {
      srcX = 0;
      srcY = H / 2;
    } else {
      srcX = W * 0.15;
      srcY = H / 2;
    }

    /* Geometry for current experiment */
    var barrier     = getBarrier();
    var shallowRect = getShallowRegion();

    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var idx = (y * W + x) * 4;

        /* Check if pixel is on a barrier */
        if (isBarrierPixel(x, y, barrier)) {
          /* Draw barrier as light grey */
          pixels[idx]     = 180;
          pixels[idx + 1] = 190;
          pixels[idx + 2] = 200;
          pixels[idx + 3] = 255;
          continue;
        }

        /* Determine if in shallow region */
        var inShallow = shallowRect && isInShallow(x, y, shallowRect);
        var localLam  = inShallow ? lamS : lamD;

        /* Compute wave amplitude */
        var amp = 0;
        if (exp === 'reflection') {
          amp = waveReflection(x, y, srcX, srcY, lamD, f, time, barrier);
        } else if (exp === 'refraction') {
          amp = waveRefraction(x, y, srcX, srcY, lamD, lamS, f, time, inShallow, shallowRect);
        } else if (exp === 'diffraction') {
          amp = waveDiffraction(x, y, srcX, srcY, lamD, f, time, barrier);
        }

        amp = Math.max(-1, Math.min(1, amp));

        /* Colour: base blue, modulated by amplitude */
        var bR, bG, bB;
        if (inShallow) {
          bR = 25;  bG = 85; bB = 115;
        } else {
          bR = 12;  bG = 55; bB = 105;
        }
        var bright = amp * 55;
        pixels[idx]     = clamp8(bR + bright * 0.8);
        pixels[idx + 1] = clamp8(bG + bright * 1.2);
        pixels[idx + 2] = clamp8(bB + bright * 1.5);
        pixels[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    drawOverlays(barrier, shallowRect, scale);
  }

  function clamp8(v) { return v < 0 ? 0 : (v > 255 ? 255 : v | 0); }


  /* ── Reflection ── */
  function waveReflection(x, y, srcX, srcY, lambda, freq, t, barrier) {
    if (!barrier) return 0;
    var bx = barrier.x;
    var amp = 0;

    if (state.waveType === 'plane') {
      /* Incident plane wave moving right */
      var incPhase = TWO_PI * (x / lambda - freq * t);
      if (x < bx) {
        amp += Math.sin(incPhase);
        /* Reflected wave: mirror image travelling left */
        var distFromB = bx - x;
        var refPhase = TWO_PI * (distFromB / lambda - freq * t);
        amp += -Math.sin(refPhase) * 0.8;  /* slight attenuation, phase inversion */
      }
      /* Beyond barrier: shadow region — no wave */
    } else {
      /* Circular waves */
      var dist = Math.sqrt((x - srcX) * (x - srcX) + (y - srcY) * (y - srcY));
      if (dist < 1) dist = 1;
      var falloff = Math.min(1, 10 / Math.sqrt(dist));

      if (x < bx) {
        amp += Math.sin(TWO_PI * (dist / lambda - freq * t)) * falloff;

        /* Reflected: virtual source mirrored across barrier */
        var mirX = 2 * bx - srcX;
        var distM = Math.sqrt((x - mirX) * (x - mirX) + (y - srcY) * (y - srcY));
        if (distM < 1) distM = 1;
        var falloffM = Math.min(1, 10 / Math.sqrt(distM));

        if (barrier.curved) {
          /* Curved barrier focuses reflected waves */
          var focalX = bx - barrier.radius / 2;
          var distF = Math.sqrt((x - focalX) * (x - focalX) + (y - srcY) * (y - srcY));
          if (distF < 1) distF = 1;
          var falloffF = Math.min(1, 10 / Math.sqrt(distF));
          var mirrorDist = Math.sqrt((bx - srcX) * (bx - srcX) + 0) * 2 - dist;
          if (mirrorDist > 0) {
            amp += -Math.sin(TWO_PI * (mirrorDist / lambda - freq * t)) * falloffF * 0.6;
          }
        } else {
          amp += -Math.sin(TWO_PI * (distM / lambda - freq * t)) * falloffM * 0.7;
        }
      }
    }

    return amp;
  }


  /* ── Refraction ── */
  function waveRefraction(x, y, srcX, srcY, lamDeep, lamShallow, freq, t, inShallow, region) {
    if (!region) return 0;
    var amp = 0;
    var boundaryX = region.x;

    if (state.waveType === 'plane') {
      if (!inShallow) {
        /* Deep region — standard plane wave */
        amp = Math.sin(TWO_PI * (x / lamDeep - freq * t));
      } else {
        /* Shallow region: phase continues from boundary but with shorter wavelength */
        var phaseAtBoundary = TWO_PI * (boundaryX / lamDeep - freq * t);
        var dx = x - boundaryX;
        /* If angled boundary, add a y-dependent bending effect */
        if (state.depthOpt === 'default') {
          /* Angled boundary: waves bend — Snell's law visualised */
          var yOffset = (y - H / 2);
          var bendAmount = 0.12 * (lamShallow / lamDeep);
          dx = dx + yOffset * bendAmount;
        }
        var shallowPhase = phaseAtBoundary + TWO_PI * (dx / lamShallow);
        amp = Math.sin(shallowPhase);
      }
    } else {
      /* Circular waves */
      var dist = Math.sqrt((x - srcX) * (x - srcX) + (y - srcY) * (y - srcY));
      if (dist < 1) dist = 1;
      var falloff = Math.min(1, 10 / Math.sqrt(dist));

      if (!inShallow) {
        amp = Math.sin(TWO_PI * (dist / lamDeep - freq * t)) * falloff;
      } else {
        /* Split the ray: deep portion + shallow portion */
        /* Approximate the distance in deep water up to boundary */
        var deepPortionX = Math.max(0, boundaryX - srcX);
        var deepDist, shallowDist;
        if (srcX < boundaryX) {
          /* Source is in deep water */
          /* Approximate: straight-line to boundary, then to pixel */
          var towardBoundaryY = srcY + (y - srcY) * (boundaryX - srcX) / Math.max(1, x - srcX);
          deepDist = Math.sqrt((boundaryX - srcX) * (boundaryX - srcX) + (towardBoundaryY - srcY) * (towardBoundaryY - srcY));
          shallowDist = Math.sqrt((x - boundaryX) * (x - boundaryX) + (y - towardBoundaryY) * (y - towardBoundaryY));
        } else {
          deepDist = 0;
          shallowDist = dist;
        }

        var phase = TWO_PI * ((deepDist / lamDeep + shallowDist / lamShallow) - freq * t);
        amp = Math.sin(phase) * falloff;
      }
    }

    return amp;
  }


  /* ── Diffraction ── */
  function waveDiffraction(x, y, srcX, srcY, lambda, freq, t, barrier) {
    if (!barrier) return 0;
    var bx = barrier.x;
    var gapCy = barrier.gapCentre;
    var gapHalf = barrier.gapHalf;
    var amp = 0;

    if (state.waveType === 'plane') {
      if (x < bx - 2) {
        /* Before barrier: incident plane wave */
        amp = Math.sin(TWO_PI * (x / lambda - freq * t));
      } else if (x >= bx - 2 && x <= bx + 2) {
        /* At barrier: only in gap */
        if (y >= gapCy - gapHalf && y <= gapCy + gapHalf) {
          amp = Math.sin(TWO_PI * (x / lambda - freq * t));
        }
      } else {
        /* Beyond barrier: Huygens secondary sources in the gap */
        var nSrc = Math.max(7, Math.round(gapHalf * 2 / 4));
        var totalAmp = 0;
        for (var i = 0; i < nSrc; i++) {
          var gy = (gapCy - gapHalf) + (2 * gapHalf) * (i / (nSrc - 1));
          var dx = x - bx;
          var dy = y - gy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) dist = 1;
          /* Cylindrical falloff for 2D waves */
          var fo = Math.min(1, 5 / Math.sqrt(dist));
          /* Phase: wave reaches gap at bx, then propagates distance dist */
          var phaseAtGap = TWO_PI * (bx / lambda - freq * t);
          var wPhase = phaseAtGap + TWO_PI * (dist / lambda);
          totalAmp += Math.sin(wPhase) * fo;
        }
        amp = totalAmp / nSrc * 2.2;
      }
    } else {
      /* Circular wave diffraction */
      if (x < bx - 2) {
        var distC = Math.sqrt((x - srcX) * (x - srcX) + (y - srcY) * (y - srcY));
        if (distC < 1) distC = 1;
        var foC = Math.min(1, 10 / Math.sqrt(distC));
        amp = Math.sin(TWO_PI * (distC / lambda - freq * t)) * foC;
      } else if (x >= bx - 2 && x <= bx + 2) {
        if (y >= gapCy - gapHalf && y <= gapCy + gapHalf) {
          var distCG = Math.sqrt((x - srcX) * (x - srcX) + (y - srcY) * (y - srcY));
          if (distCG < 1) distCG = 1;
          var foCG = Math.min(1, 10 / Math.sqrt(distCG));
          amp = Math.sin(TWO_PI * (distCG / lambda - freq * t)) * foCG;
        }
      } else {
        /* Huygens from gap */
        var nS = Math.max(7, Math.round(gapHalf * 2 / 4));
        var tA = 0;
        for (var j = 0; j < nS; j++) {
          var gyC = (gapCy - gapHalf) + (2 * gapHalf) * (j / (nS - 1));
          /* Phase arriving at this gap point from the source */
          var distToGap = Math.sqrt((bx - srcX) * (bx - srcX) + (gyC - srcY) * (gyC - srcY));
          var phaseArr = TWO_PI * (distToGap / lambda - freq * t);
          /* Distance from gap point to pixel */
          var dxC = x - bx;
          var dyC = y - gyC;
          var distFromGap = Math.sqrt(dxC * dxC + dyC * dyC);
          if (distFromGap < 1) distFromGap = 1;
          var foS = Math.min(1, 5 / Math.sqrt(distFromGap));
          var wPhaseC = phaseArr + TWO_PI * (distFromGap / lambda);
          tA += Math.sin(wPhaseC) * foS;
        }
        amp = tA / nS * 2.2;
      }
    }

    return amp;
  }


  /* ══════════════════════════════════════
     GEOMETRY
     ══════════════════════════════════════ */

  function getBarrier() {
    if (state.experiment === 'reflection') {
      var bx = Math.round(W * 0.75);
      var curved = state.depthOpt === 'alt';
      return {
        type: 'wall',
        x: bx,
        y1: Math.round(H * 0.1),
        y2: Math.round(H * 0.9),
        curved: curved,
        radius: curved ? Math.round(H * 0.4) : 0
      };
    }
    if (state.experiment === 'diffraction') {
      var gapW = state.depthOpt === 'default' ? H * 0.22 : H * 0.08;
      return {
        type: 'gap',
        x: Math.round(W * 0.42),
        y1: 0,
        y2: H,
        gapCentre: Math.round(H / 2),
        gapHalf: Math.round(gapW / 2)
      };
    }
    return null;
  }

  function getShallowRegion() {
    if (state.experiment !== 'refraction') return null;
    var bx = Math.round(W * 0.50);
    return {
      x: bx,
      angled: state.depthOpt === 'default'
    };
  }

  function isBarrierPixel(x, y, barrier) {
    if (!barrier) return false;

    if (barrier.type === 'wall') {
      if (barrier.curved) {
        /* Curved (concave) barrier: arc from y1 to y2 */
        var cy = (barrier.y1 + barrier.y2) / 2;
        var r = barrier.radius;
        var dx = x - (barrier.x + r);
        var dy = y - cy;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (y >= barrier.y1 && y <= barrier.y2 && d >= r - 2 && d <= r + 2) return true;
        /* End caps */
        if (y >= barrier.y1 - 1 && y <= barrier.y1 + 1 && x >= barrier.x && x <= barrier.x + 10) return true;
        if (y >= barrier.y2 - 1 && y <= barrier.y2 + 1 && x >= barrier.x && x <= barrier.x + 10) return true;
        return false;
      } else {
        /* Flat barrier */
        return x >= barrier.x - 2 && x <= barrier.x + 2 &&
               y >= barrier.y1 && y <= barrier.y2;
      }
    }

    if (barrier.type === 'gap') {
      if (x >= barrier.x - 2 && x <= barrier.x + 2) {
        /* In gap? */
        if (y >= barrier.gapCentre - barrier.gapHalf &&
            y <= barrier.gapCentre + barrier.gapHalf) {
          return false;
        }
        return true;
      }
    }

    return false;
  }

  function isInShallow(x, y, region) {
    if (!region) return false;
    if (region.angled) {
      var offset = (y - H / 2) * 0.18;
      return x >= region.x + offset;
    }
    return x >= region.x;
  }


  /* ══════════════════════════════════════
     OVERLAYS
     ══════════════════════════════════════ */

  function drawOverlays(barrier, shallowRect, scale) {
    ctx.textAlign = 'center';

    if (state.experiment === 'reflection' && barrier) {
      /* Label */
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText('Barrier', barrier.x - 20, barrier.y1 - 8);

      /* Source label */
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '400 10px Inter, sans-serif';
      if (state.waveType === 'plane') {
        ctx.fillText('Plane wave source', 75, H - 10);
      } else {
        ctx.beginPath();
        ctx.arc(W * 0.15, H / 2, 4, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255,200,80,0.7)';
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText('Source', W * 0.15, H / 2 + 18);
      }

      /* Normal + angle labels */
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(barrier.x, H * 0.35);
      ctx.lineTo(barrier.x - 80, H * 0.35);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,220,100,0.4)';
      ctx.font = '400 9px Inter, sans-serif';
      ctx.fillText('angle i = angle r', barrier.x - 55, H * 0.35 - 8);
    }

    if (state.experiment === 'refraction' && shallowRect) {
      /* Boundary line */
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      if (shallowRect.angled) {
        var topX = shallowRect.x + (-H / 2) * 0.18;
        var botX = shallowRect.x + (H / 2) * 0.18;
        ctx.moveTo(topX, 0);
        ctx.lineTo(botX, H);
      } else {
        ctx.moveTo(shallowRect.x, 0);
        ctx.lineTo(shallowRect.x, H);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      /* Region labels */
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText('Deep water', shallowRect.x * 0.4, 20);
      ctx.fillText('Shallow (perspex)', shallowRect.x + (W - shallowRect.x) * 0.45, 20);

      ctx.font = '400 9px Inter, sans-serif';
      ctx.fillStyle = 'rgba(180,220,255,0.4)';
      ctx.fillText('v = ' + state.speedDeep + ' cm/s', shallowRect.x * 0.4, 36);
      ctx.fillText('v = ' + state.speedShallow + ' cm/s', shallowRect.x + (W - shallowRect.x) * 0.45, 36);

      /* Source dot for circular */
      if (state.waveType === 'circular') {
        ctx.beginPath();
        ctx.arc(W * 0.15, H / 2, 4, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255,200,80,0.7)';
        ctx.fill();
      }
    }

    if (state.experiment === 'diffraction' && barrier) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText('Barrier with gap', barrier.x, 16);

      /* Gap width bracket */
      var gTop = barrier.gapCentre - barrier.gapHalf;
      var gBot = barrier.gapCentre + barrier.gapHalf;
      ctx.strokeStyle = 'rgba(255,220,100,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(barrier.x + 8, gTop);
      ctx.lineTo(barrier.x + 16, gTop);
      ctx.lineTo(barrier.x + 16, gBot);
      ctx.lineTo(barrier.x + 8, gBot);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,220,100,0.45)';
      ctx.font = '400 9px Inter, sans-serif';
      var gapLabel = state.depthOpt === 'default' ? 'Wide gap' : 'Narrow gap';
      ctx.fillText(gapLabel, barrier.x + 38, barrier.gapCentre + 3);

      /* Spreading note */
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      var note = state.depthOpt === 'alt'
        ? 'Narrow gap: more diffraction spreading'
        : 'Wide gap: less spreading';
      ctx.fillText(note, barrier.x + 90, H - 10);

      /* Source dot for circular */
      if (state.waveType === 'circular') {
        ctx.beginPath();
        ctx.arc(W * 0.15, H / 2, 4, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255,200,80,0.7)';
        ctx.fill();
      }
    }

    /* Wave type label */
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.font = '400 9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.waveType === 'plane' ? 'Plane waves' : 'Circular waves', 8, H - 8);

    /* Wavelength scale bar */
    drawScaleBar(scale);
  }

  function drawScaleBar(scale) {
    var barLen = lambdaDeep() * scale;
    if (barLen < 10 || barLen > W * 0.4) return;

    var x0 = W - 20 - barLen;
    var y0 = H - 16;

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + barLen, y0);
    ctx.stroke();
    /* End ticks */
    ctx.beginPath();
    ctx.moveTo(x0, y0 - 3);
    ctx.lineTo(x0, y0 + 3);
    ctx.moveTo(x0 + barLen, y0 - 3);
    ctx.lineTo(x0 + barLen, y0 + 3);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '400 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u03BB = ' + lambdaDeep().toFixed(1) + ' cm', x0 + barLen / 2, y0 - 6);
  }


  /* ══════════════════════════════════════
     ANIMATION
     ══════════════════════════════════════ */

  function animate(timestamp) {
    if (!state.playing) return;
    var dt = state.lastFrame ? (timestamp - state.lastFrame) / 1000 : 0.016;
    dt = Math.min(dt, 0.05);
    state.lastFrame = timestamp;
    state.time += dt * state.animSpeed;

    renderFrame();
    state.animId = requestAnimationFrame(animate);
  }


  /* ══════════════════════════════════════
     EVENT HANDLERS
     ══════════════════════════════════════ */

  /* Experiment tabs */
  var tabBtns = expTabs.querySelectorAll('.experiment-tab');
  for (var t = 0; t < tabBtns.length; t++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        selectExperiment(btn.getAttribute('data-exp'));
      });
    })(tabBtns[t]);
  }

  /* Frequency */
  freqSlider.addEventListener('input', function () {
    state.frequency = parseInt(freqSlider.value, 10);
    freqDisplay.textContent = state.frequency + ' Hz';
    updateMeasurements();
    if (!state.playing) renderFrame();

    /* Score */
    if (state.scorer) state.scorer.award('adjust-freq', 2);

    /* Procedure */
    if (state.experiment === 'reflection')  markProcedure('adjust-frequency');
    if (state.experiment === 'diffraction') markProcedure('change-frequency');
    if (state.experiment === 'refraction')  markProcedure('measure-wavelengths');
  });

  /* Animation speed */
  speedSlider.addEventListener('input', function () {
    state.animSpeed = parseFloat(speedSlider.value);
    speedDisplay.textContent = state.animSpeed.toFixed(2) + 'x';
  });

  /* Wave type toggle */
  var wTypeBtns = waveTypeBtns.querySelectorAll('.toggle-btn');
  for (var w = 0; w < wTypeBtns.length; w++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        state.waveType = btn.getAttribute('data-mode');
        for (var i = 0; i < wTypeBtns.length; i++)
          wTypeBtns[i].classList.toggle('active', wTypeBtns[i] === btn);
        if (!state.playing) renderFrame();
        if (typeof LabAudio !== 'undefined') LabAudio.switchToggle();
      });
    })(wTypeBtns[w]);
  }

  /* Depth / gap toggle */
  var dBtns = depthToggle.querySelectorAll('.toggle-btn');
  for (var d = 0; d < dBtns.length; d++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        state.depthOpt = btn.getAttribute('data-opt');
        for (var i = 0; i < dBtns.length; i++)
          dBtns[i].classList.toggle('active', dBtns[i] === btn);
        if (!state.playing) renderFrame();

        if (state.experiment === 'diffraction') markProcedure('toggle-depth');
        if (typeof LabAudio !== 'undefined') LabAudio.switchToggle();
      });
    })(dBtns[d]);
  }

  /* Play */
  btnPlay.addEventListener('click', function () {
    if (state.playing) return;
    state.playing = true;
    overlay.classList.add('hidden');
    btnPlay.disabled  = true;
    btnPause.disabled = false;
    state.lastFrame = 0;
    state.animId = requestAnimationFrame(animate);

    toast('Simulation running');

    /* Auto-advance observation procedure steps */
    if (state.experiment === 'reflection') {
      markProcedure('observe-incident');
      setTimeout(function () { markProcedure('observe-reflected'); }, 2500);
    }
    if (state.experiment === 'refraction') {
      markProcedure('observe-deep');
      setTimeout(function () { markProcedure('observe-shallow'); }, 2500);
    }
    if (state.experiment === 'diffraction') markProcedure('observe-gap');
  });

  /* Pause */
  btnPause.addEventListener('click', function () {
    state.playing = false;
    if (state.animId) cancelAnimationFrame(state.animId);
    btnPlay.disabled  = false;
    btnPause.disabled = true;
    toast('Paused');
  });

  /* Step */
  btnStep.addEventListener('click', function () {
    state.time += 0.03 * state.animSpeed;
    overlay.classList.add('hidden');
    renderFrame();
  });

  /* Guide toggle */
  if (btnGuide) {
    btnGuide.addEventListener('click', function () {
      var vis = guidePanel.style.display !== 'none';
      guidePanel.style.display = vis ? 'none' : '';
    });
  }

  /* Save observation */
  if (btnSaveObs) {
    btnSaveObs.addEventListener('click', function () {
      var text = obsText.value.trim();
      if (!text) {
        toast('Please type an observation first.', 'warn');
        return;
      }

      state.observations.push({
        experiment: state.experiment,
        text: text,
        time: new Date().toLocaleTimeString()
      });

      /* Add to log */
      if (obsEmpty) obsEmpty.style.display = 'none';
      var entry = document.createElement('div');
      entry.className = 'obs-entry';
      var expName = state.experiment.charAt(0).toUpperCase() + state.experiment.slice(1);
      entry.innerHTML =
        '<div class="obs-entry-meta">' + expName + ' — ' + new Date().toLocaleTimeString() + '</div>' +
        '<div class="obs-entry-text">' + escapeHtml(text) + '</div>';
      obsLog.appendChild(entry);
      obsText.value = '';

      /* Score observations */
      scoreObservation(text);

      /* Mark record procedure */
      if (state.experiment === 'reflection')  markProcedure('record-reflection');
      if (state.experiment === 'refraction')  markProcedure('record-refraction');
      if (state.experiment === 'diffraction') markProcedure('record-diffraction');

      toast('Observation saved', 'success');
      if (typeof LabAudio !== 'undefined') LabAudio.record();
      if (typeof LabProgress !== 'undefined') LabProgress.markStep('waves', 'obs-' + state.experiment);
    });
  }

  /* Reset */
  btnReset.addEventListener('click', function () {
    state.playing = false;
    if (state.animId) cancelAnimationFrame(state.animId);
    state.time = 0;
    state.frequency = D.frequencyDefault;
    state.animSpeed = 1;
    state.waveType = 'plane';
    state.depthOpt = 'default';
    state.observations = [];
    state.procedureDone = {};
    state.exploredExps = {};

    freqSlider.value = D.frequencyDefault;
    freqDisplay.textContent = D.frequencyDefault + ' Hz';
    speedSlider.value = 1;
    speedDisplay.textContent = '1.0x';
    btnPlay.disabled  = false;
    btnPause.disabled = true;
    overlay.classList.remove('hidden');

    /* Reset wave type */
    var wtB = waveTypeBtns.querySelectorAll('.toggle-btn');
    if (wtB[0]) wtB[0].classList.add('active');
    if (wtB[1]) wtB[1].classList.remove('active');

    /* Clear obs */
    obsText.value = '';
    obsLog.innerHTML = '<p class="text-sm text-muted text-center" id="obs-empty">No observations recorded yet.</p>';
    obsEmpty = document.getElementById('obs-empty');

    if (state.scorer) state.scorer.reset();

    updateMeasurements();

    /* Select default experiment without counting it as "explored" */
    selectExperiment('reflection');
    state.exploredExps = {};

    toast('Practical reset');
  });


  /* ══════════════════════════════════════
     PROCEDURE TRACKING
     ══════════════════════════════════════ */

  function markProcedure(stepId) {
    if (state.procedureDone[stepId]) return;
    state.procedureDone[stepId] = true;

    var steps = procList.querySelectorAll('.procedure-step');
    var nextActive = false;
    for (var i = 0; i < steps.length; i++) {
      var sid = steps[i].getAttribute('data-step');
      if (state.procedureDone[sid]) {
        steps[i].classList.remove('active');
        steps[i].classList.add('done');
      } else if (!nextActive) {
        steps[i].classList.add('active');
        nextActive = true;
      } else {
        steps[i].classList.remove('active', 'done');
      }
    }

    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('waves', stepId);
    }

    /* Check if all steps done */
    var exp = experiments[state.experiment];
    if (exp && exp.steps) {
      var allDone = true;
      for (var j = 0; j < exp.steps.length; j++) {
        if (!state.procedureDone[exp.steps[j].id]) { allDone = false; break; }
      }
      if (allDone) {
        toast('All steps complete for ' + exp.name + '!', 'success');
        if (typeof LabProgress !== 'undefined') {
          LabProgress.markStep('waves', state.experiment + '-complete');
        }
      }
    }
  }


  /* ══════════════════════════════════════
     SCORING
     ══════════════════════════════════════ */

  function scoreObservation(text) {
    if (!state.scorer) return;
    var low = text.toLowerCase();

    /* Reflection */
    if (state.experiment === 'reflection') {
      if ((low.indexOf('angle') !== -1) &&
          (low.indexOf('incidence') !== -1 || low.indexOf('reflection') !== -1 ||
           low.indexOf('equal') !== -1 || low.indexOf('same') !== -1)) {
        state.scorer.award('refl-law', 2);
      }
    }

    /* Refraction */
    if (state.experiment === 'refraction') {
      if ((low.indexOf('slow') !== -1 || low.indexOf('speed') !== -1 ||
           low.indexOf('wavelength') !== -1 || low.indexOf('shorter') !== -1) &&
          (low.indexOf('shallow') !== -1 || low.indexOf('decrease') !== -1 ||
           low.indexOf('change') !== -1 || low.indexOf('perspex') !== -1)) {
        state.scorer.award('refr-speed', 2);
      }
    }

    /* Diffraction */
    if (state.experiment === 'diffraction') {
      if ((low.indexOf('spread') !== -1 || low.indexOf('diffract') !== -1 ||
           low.indexOf('bend') !== -1 || low.indexOf('curve') !== -1) &&
          (low.indexOf('gap') !== -1 || low.indexOf('narrow') !== -1 ||
           low.indexOf('wide') !== -1 || low.indexOf('wavelength') !== -1)) {
        state.scorer.award('diff-spread', 2);
      }
    }

    /* Wave equation */
    if (low.indexOf('v = f') !== -1 || low.indexOf('v=f') !== -1 ||
        low.indexOf('speed = frequency') !== -1 ||
        (low.indexOf('v =') !== -1 && low.indexOf('lambda') !== -1) ||
        (low.indexOf('speed') !== -1 && low.indexOf('frequency') !== -1 && low.indexOf('wavelength') !== -1)) {
      state.scorer.award('wave-equation', 2);
    }
  }


  /* ══════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════ */

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function toast(msg, type) {
    if (!toastContainer) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    toastContainer.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('visible'); });
    setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 2800);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }


  /* ══════════════════════════════════════
     INIT
     ══════════════════════════════════════ */

  resizeCanvas();
  updateMeasurements();
  selectExperiment('reflection');

  window.addEventListener('resize', resizeCanvas);
})();
