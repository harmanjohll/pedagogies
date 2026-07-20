/* Microscopy & Cell Drawing practical – simulation */
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };

  /* ── Data ── */
  var DATA = MICROSCOPY_DATA;

  /* ── DOM refs ── */
  var dom = {
    procList:      $('procedure-list'),
    slideSelect:   $('slide-select'),
    slidePrep:     $('slide-prep'),
    prepText:      $('prep-text'),
    prepStain:     $('prep-stain'),
    magRow:        $('mag-row'),
    specimenCanvas: $('specimen-canvas'),
    viewportClip:  $('viewport-clip'),
    viewportEmpty: $('viewport-empty'),
    focusSlider:   $('focus-slider'),
    focusValue:    $('focus-value'),
    infoSlide:     $('info-slide'),
    infoMag:       $('info-mag'),
    drawCanvas:    $('draw-canvas'),
    btnPencil:     $('btn-pencil'),
    btnEraser:     $('btn-eraser'),
    drawColour:    $('draw-colour'),
    drawSize:      $('draw-size'),
    btnClearDraw:  $('btn-clear-draw'),
    btnExportDraw: $('btn-export-draw'),
    btnComplete:   $('btn-complete'),
    specimenInfo:  $('specimen-info'),
    infoTitle:     $('info-title'),
    infoDesc:      $('info-desc'),
    labelChecklist: $('label-checklist'),
    checklistList: $('checklist-list'),
    scoreContainer: $('score-container'),
    btnGuide:      $('btn-guide'),
    btnReset:      $('btn-reset'),
    guidePanel:    $('guide-panel'),
    toastContainer: $('toast-container')
  };

  var sctx = dom.specimenCanvas.getContext('2d');
  var dctx = dom.drawCanvas.getContext('2d');

  /* ── State ── */
  var state = {
    slide: null,
    mag: null,
    focused: true,
    focusVal: 50,
    guideOpen: true,
    drawTool: 'pencil',
    drawColour: '#1a1b25',
    drawLineWidth: 2,
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    procedureDone: {},
    checkedStructures: {},
    completed: false,
    magSequence: [],    // track magnification order for scoring
    focusedCorrectly: {}  // track focusing at each mag
  };

  var scorer = null;

  /* ── LabRecordMode ── */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  /* Magnification calculation elements */
  var magCalcEl = document.getElementById('mag-calc');
  var magCalcValue = document.getElementById('mag-calc-value');
  var EYEPIECE_MAG = 10; /* Standard eyepiece magnification */

  /* ── Build procedure list ── */
  function buildProcedure() {
    dom.procList.innerHTML = '';
    DATA.steps.forEach(function (step) {
      var li = document.createElement('li');
      li.className = 'procedure-step';
      li.setAttribute('data-step', step.id);
      li.textContent = step.text;
      li.title = step.instruction;
      dom.procList.appendChild(li);
    });
  }

  /* ── Build slide selector ── */
  function buildSlideSelector() {
    DATA.slides.forEach(function (slide) {
      var opt = document.createElement('option');
      opt.value = slide.id;
      opt.textContent = slide.name + ' (' + slide.type + ')';
      dom.slideSelect.appendChild(opt);
    });
  }

  /* ── Procedure tracking ── */
  function markProcedure(key) {
    if (state.procedureDone[key]) return;
    state.procedureDone[key] = true;
    if (typeof LabProgress !== 'undefined') {
      LabProgress.markStep('microscopy', key);
    }
    updateProcedureUI();
  }

  function updateProcedureUI() {
    var steps = dom.procList.querySelectorAll('.procedure-step');
    var nextActive = false;
    for (var i = 0; i < steps.length; i++) {
      var el = steps[i];
      var s = el.getAttribute('data-step');
      el.classList.remove('active', 'done');
      if (state.procedureDone[s]) {
        el.classList.add('done');
      } else if (!nextActive) {
        el.classList.add('active');
        nextActive = true;
      }
    }
  }

  /* ── Toast ── */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    dom.toastContainer.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }

  /* ── Slide selection ── */
  dom.slideSelect.addEventListener('change', function () {
    var id = this.value;
    if (!id) {
      state.slide = null;
      state.mag = null;
      disableMagButtons();
      hideSpecimenInfo();
      dom.slidePrep.hidden = true;
      dom.viewportEmpty.style.display = '';
      clearSpecimenCanvas();
      dom.infoSlide.textContent = 'No slide loaded';
      dom.infoMag.textContent = '\u2014';
      return;
    }

    var slide = findSlide(id);
    if (!slide) return;

    state.slide = slide;
    state.mag = null;
    state.checkedStructures = {};

    // Show prep info
    dom.slidePrep.hidden = false;
    dom.prepText.textContent = slide.prepSteps;
    dom.prepStain.textContent = 'Stain: ' + slide.stain;

    // Enable mag buttons
    enableMagButtons();
    clearActiveMag();

    // Show specimen info
    showSpecimenInfo(slide);
    buildChecklist(slide);

    // Update info bar
    dom.infoSlide.textContent = slide.name;
    dom.infoMag.textContent = '\u2014';

    // Clear viewport
    dom.viewportEmpty.style.display = '';
    clearSpecimenCanvas();

    markProcedure('select');
    toast('Slide loaded: ' + slide.name, 'info');
  });

  function findSlide(id) {
    for (var i = 0; i < DATA.slides.length; i++) {
      if (DATA.slides[i].id === id) return DATA.slides[i];
    }
    return null;
  }

  /* ── Magnification ── */
  var magBtns = document.querySelectorAll('.mag-btn');

  function disableMagButtons() {
    for (var i = 0; i < magBtns.length; i++) {
      magBtns[i].disabled = true;
      magBtns[i].classList.remove('active');
    }
  }

  function enableMagButtons() {
    for (var i = 0; i < magBtns.length; i++) {
      magBtns[i].disabled = false;
    }
  }

  function clearActiveMag() {
    for (var i = 0; i < magBtns.length; i++) {
      magBtns[i].classList.remove('active');
    }
  }

  for (var i = 0; i < magBtns.length; i++) {
    magBtns[i].addEventListener('click', function () {
      if (!state.slide) return;

      var mag = this.getAttribute('data-mag');
      state.mag = mag;

      clearActiveMag();
      this.classList.add('active');

      // Track magnification sequence
      state.magSequence.push(mag);

      // Mark procedure steps
      if (mag === 'x40') {
        markProcedure('low-power');
        markProcedure('locate');
      }
      if (mag === 'x100') markProcedure('medium');
      if (mag === 'x400') markProcedure('high');

      // Defocus slightly when changing magnification
      state.focusVal = 40 + Math.floor(Math.random() * 20);
      dom.focusSlider.value = state.focusVal;
      updateFocus();

      // Render
      dom.viewportEmpty.style.display = 'none';
      renderSpecimen();

      dom.infoMag.textContent = mag;

      /* Update magnification calculation
         The buttons show total magnification (x40, x100, x400).
         Objective = total / eyepiece. Eyepiece = x10. */
      var totalMag = parseInt(mag.replace('x', ''), 10);
      var objectivePower = totalMag / EYEPIECE_MAG;
      if (magCalcEl) {
        magCalcEl.hidden = false;
        magCalcValue.textContent = '\u00d710 \u00d7 ' + objectivePower + ' = \u00d7' + totalMag;
      }

      toast('Switched to ' + mag + ' magnification. Adjust focus.', 'info');

      if (typeof LabAudio !== 'undefined') LabAudio.switchToggle();
    });
  }

  /* ── Focus ── */
  dom.focusSlider.addEventListener('input', function () {
    state.focusVal = parseInt(this.value, 10);
    updateFocus();
  });

  function updateFocus() {
    // Focus is "sharp" when slider is between 45 and 55
    var diff = Math.abs(state.focusVal - 50);
    var blur = 0;
    if (diff > 5) {
      blur = (diff - 5) * 0.3;
    }

    state.focused = diff <= 5;
    dom.specimenCanvas.style.filter = blur > 0 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none';

    if (state.focused) {
      dom.focusValue.textContent = 'Focused';
      dom.focusValue.classList.remove('blurred');
      // Record that we focused at this magnification
      if (state.mag) {
        state.focusedCorrectly[state.mag] = true;
      }
    } else {
      dom.focusValue.textContent = 'Blurred';
      dom.focusValue.classList.add('blurred');
    }
  }

  /* ── Specimen canvas rendering ── */
  function resizeSpecimenCanvas() {
    var clip = dom.viewportClip;
    var rect = clip.getBoundingClientRect();
    var size = Math.floor(Math.min(rect.width, rect.height));
    var dpr = window.devicePixelRatio || 1;
    dom.specimenCanvas.width = size * dpr;
    dom.specimenCanvas.height = size * dpr;
    dom.specimenCanvas.style.width = size + 'px';
    dom.specimenCanvas.style.height = size + 'px';
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state.slide && state.mag) renderSpecimen();
  }

  function clearSpecimenCanvas() {
    var w = dom.specimenCanvas.width / (window.devicePixelRatio || 1);
    var h = dom.specimenCanvas.height / (window.devicePixelRatio || 1);
    sctx.clearRect(0, 0, w, h);
  }

  function renderSpecimen() {
    if (!state.slide || !state.mag) return;

    var w = dom.specimenCanvas.width / (window.devicePixelRatio || 1);
    var h = dom.specimenCanvas.height / (window.devicePixelRatio || 1);
    var cx = w / 2;
    var cy = h / 2;

    sctx.clearRect(0, 0, w, h);

    // Light background with slight warm tone (like real microscopy)
    sctx.fillStyle = '#faf8f2';
    sctx.fillRect(0, 0, w, h);

    // Circular field of view vignette
    var gradient = sctx.createRadialGradient(cx, cy, w * 0.3, cx, cy, w * 0.52);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.08)');
    sctx.fillStyle = gradient;
    sctx.fillRect(0, 0, w, h);

    var slideId = state.slide.id;
    var mag = state.mag;

    // Use a seeded pseudo-random for consistent cell positions
    var seed = slideId.length * 1000;
    function seededRandom() {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed & 0x7fffffff) / 0x7fffffff;
    }

    if (slideId === 'onion') {
      drawOnionCells(sctx, w, h, mag, seededRandom);
    } else if (slideId === 'cheek') {
      drawCheekCells(sctx, w, h, mag, seededRandom);
    } else if (slideId === 'elodea') {
      drawElodeaCells(sctx, w, h, mag, seededRandom);
    } else if (slideId === 'blood') {
      drawBloodCells(sctx, w, h, mag, seededRandom);
    }
  }

  /* ── Onion epidermis drawing ── */
  function drawOnionCells(ctx, w, h, mag, rand) {
    var cx = w / 2, cy = h / 2;

    if (mag === 'x40') {
      // Many small rectangular cells in brick pattern
      var cellW = w / 8;
      var cellH = w / 20;
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 1;

      for (var row = -2; row < (h / cellH) + 2; row++) {
        var offset = (row % 2) * (cellW * 0.5);
        for (var col = -1; col < (w / cellW) + 2; col++) {
          var x = col * cellW + offset;
          var y = row * cellH;
          ctx.strokeRect(x, y, cellW, cellH);
          ctx.fillStyle = 'rgba(232, 216, 184, 0.3)';
          ctx.fillRect(x, y, cellW, cellH);
        }
      }
    } else if (mag === 'x100') {
      // Fewer cells, more detail
      var cellW = w / 3.5;
      var cellH = w / 8;
      ctx.lineWidth = 1.5;

      for (var row = -1; row < (h / cellH) + 1; row++) {
        var offset = (row % 2) * (cellW * 0.5);
        for (var col = -1; col < (w / cellW) + 2; col++) {
          var x = col * cellW + offset;
          var y = row * cellH;
          drawOnionSingleCell(ctx, x, y, cellW, cellH, false, rand);
        }
      }
    } else if (mag === 'x400') {
      // Single large cell fills most of view
      var cellW = w * 0.75;
      var cellH = h * 0.55;
      var x = (w - cellW) / 2;
      var y = (h - cellH) / 2;
      drawOnionSingleCell(ctx, x, y, cellW, cellH, true, rand);

      // Partial neighbouring cells
      drawOnionSingleCell(ctx, x - cellW * 0.9, y, cellW, cellH, false, rand);
      drawOnionSingleCell(ctx, x + cellW * 0.9, y, cellW, cellH, false, rand);
      drawOnionSingleCell(ctx, x + cellW * 0.45, y - cellH * 0.95, cellW, cellH, false, rand);
      drawOnionSingleCell(ctx, x + cellW * 0.45, y + cellH * 0.95, cellW, cellH, false, rand);
      drawOnionSingleCell(ctx, x - cellW * 0.45, y - cellH * 0.95, cellW, cellH, false, rand);
      drawOnionSingleCell(ctx, x - cellW * 0.45, y + cellH * 0.95, cellW, cellH, false, rand);
    }
  }

  function drawOnionSingleCell(ctx, x, y, w, h, detailed, rand) {
    // Cell wall
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = detailed ? 2.5 : 1.5;
    ctx.strokeRect(x, y, w, h);

    // Cytoplasm fill
    ctx.fillStyle = 'rgba(232, 216, 184, 0.25)';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

    // Cell membrane (inner line)
    if (detailed) {
      ctx.strokeStyle = '#C4A46C';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
      ctx.setLineDash([]);
    }

    // Vacuole (large light area)
    var vacX = x + w * 0.15;
    var vacY = y + h * 0.15;
    var vacW = w * 0.7;
    var vacH = h * 0.7;
    ctx.fillStyle = 'rgba(212, 232, 240, 0.4)';
    ctx.beginPath();
    ctx.ellipse(vacX + vacW / 2, vacY + vacH / 2, vacW / 2, vacH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (detailed) {
      ctx.strokeStyle = 'rgba(180, 210, 230, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Nucleus
    var nucR = detailed ? Math.min(w, h) * 0.1 : Math.min(w, h) * 0.08;
    var nucX = x + w * (0.3 + (rand ? rand() * 0.15 : 0.1));
    var nucY = y + h * 0.5;
    ctx.fillStyle = '#5C4033';
    ctx.beginPath();
    ctx.arc(nucX, nucY, nucR, 0, Math.PI * 2);
    ctx.fill();

    if (detailed) {
      // Nucleolus
      ctx.fillStyle = '#3a2518';
      ctx.beginPath();
      ctx.arc(nucX + nucR * 0.2, nucY - nucR * 0.1, nucR * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Nucleus outline
      ctx.strokeStyle = '#4a3020';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(nucX, nucY, nucR, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* ── Cheek epithelial cells ── */
  function drawCheekCells(ctx, w, h, mag, rand) {
    if (mag === 'x40') {
      // Many small irregular round shapes scattered
      for (var i = 0; i < 60; i++) {
        var cx = rand() * w;
        var cy = rand() * h;
        var r = w * 0.02 + rand() * w * 0.015;
        drawCheekSingleCell(ctx, cx, cy, r, false, rand);
      }
    } else if (mag === 'x100') {
      for (var i = 0; i < 18; i++) {
        var cx = rand() * w;
        var cy = rand() * h;
        var r = w * 0.06 + rand() * w * 0.03;
        drawCheekSingleCell(ctx, cx, cy, r, false, rand);
      }
      // Some folded cells
      for (var j = 0; j < 3; j++) {
        var fx = rand() * w;
        var fy = rand() * h;
        drawFoldedCheekCell(ctx, fx, fy, w * 0.07, rand);
      }
    } else if (mag === 'x400') {
      // One large cell in centre
      drawCheekSingleCell(ctx, w / 2, h / 2, w * 0.25, true, rand);
      // Scattered smaller cells around
      for (var i = 0; i < 6; i++) {
        var angle = (i / 6) * Math.PI * 2 + rand() * 0.5;
        var dist = w * 0.3 + rand() * w * 0.15;
        var cx = w / 2 + Math.cos(angle) * dist;
        var cy = h / 2 + Math.sin(angle) * dist;
        var r = w * 0.12 + rand() * w * 0.06;
        drawCheekSingleCell(ctx, cx, cy, r, false, rand);
      }
      // A folded cell
      drawFoldedCheekCell(ctx, w * 0.2, h * 0.75, w * 0.12, rand);
    }
  }

  function drawCheekSingleCell(ctx, cx, cy, r, detailed, rand) {
    // Irregular round shape
    ctx.beginPath();
    var points = 24;
    for (var i = 0; i <= points; i++) {
      var angle = (i / points) * Math.PI * 2;
      var rr = r * (0.85 + (rand ? rand() * 0.3 : 0.15));
      var px = cx + Math.cos(angle) * rr;
      var py = cy + Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Cytoplasm
    ctx.fillStyle = 'rgba(184, 207, 224, 0.3)';
    ctx.fill();

    // Cell membrane
    ctx.strokeStyle = '#7A9EBF';
    ctx.lineWidth = detailed ? 2 : 1;
    ctx.stroke();

    // Nucleus
    var nucR = r * (detailed ? 0.3 : 0.25);
    var nucOffX = (rand ? (rand() - 0.5) * r * 0.2 : 0);
    var nucOffY = (rand ? (rand() - 0.5) * r * 0.2 : 0);
    ctx.fillStyle = '#2C4A6E';
    ctx.beginPath();
    ctx.ellipse(cx + nucOffX, cy + nucOffY, nucR, nucR * 0.85, rand ? rand() * 0.5 : 0, 0, Math.PI * 2);
    ctx.fill();

    if (detailed) {
      // Nucleus outline
      ctx.strokeStyle = '#1a3050';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx + nucOffX, cy + nucOffY, nucR, nucR * 0.85, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Granular cytoplasm dots
      ctx.fillStyle = 'rgba(150, 175, 200, 0.3)';
      for (var d = 0; d < 30; d++) {
        var da = rand() * Math.PI * 2;
        var dd = rand() * r * 0.8;
        var dx = cx + Math.cos(da) * dd;
        var dy = cy + Math.sin(da) * dd;
        ctx.beginPath();
        ctx.arc(dx, dy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawFoldedCheekCell(ctx, cx, cy, r, rand) {
    // Elongated folded cell
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.5, r * 0.5, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(184, 207, 224, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#7A9EBF';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Fold line
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.quadraticCurveTo(cx, cy - r * 0.3, cx + r, cy);
    ctx.strokeStyle = 'rgba(122, 158, 191, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  /* ── Elodea leaf cells ── */
  function drawElodeaCells(ctx, w, h, mag, rand) {
    if (mag === 'x40') {
      var cellW = w / 7;
      var cellH = w / 14;
      for (var row = -1; row < (h / cellH) + 1; row++) {
        var offset = (row % 2) * (cellW * 0.5);
        for (var col = -1; col < (w / cellW) + 2; col++) {
          var x = col * cellW + offset;
          var y = row * cellH;
          drawElodeaSingleCell(ctx, x, y, cellW, cellH, false, rand);
        }
      }
    } else if (mag === 'x100') {
      var cellW = w / 3;
      var cellH = w / 6;
      for (var row = -1; row < (h / cellH) + 1; row++) {
        var offset = (row % 2) * (cellW * 0.5);
        for (var col = -1; col < (w / cellW) + 2; col++) {
          var x = col * cellW + offset;
          var y = row * cellH;
          drawElodeaSingleCell(ctx, x, y, cellW, cellH, false, rand);
        }
      }
    } else if (mag === 'x400') {
      var cellW = w * 0.7;
      var cellH = h * 0.45;
      var x = (w - cellW) / 2;
      var y = (h - cellH) / 2;
      drawElodeaSingleCell(ctx, x, y, cellW, cellH, true, rand);

      // Neighbours
      drawElodeaSingleCell(ctx, x - cellW * 0.95, y, cellW, cellH, false, rand);
      drawElodeaSingleCell(ctx, x + cellW * 0.95, y, cellW, cellH, false, rand);
      drawElodeaSingleCell(ctx, x + cellW * 0.48, y - cellH * 0.95, cellW, cellH, false, rand);
      drawElodeaSingleCell(ctx, x + cellW * 0.48, y + cellH * 0.95, cellW, cellH, false, rand);
      drawElodeaSingleCell(ctx, x - cellW * 0.48, y - cellH * 0.95, cellW, cellH, false, rand);
      drawElodeaSingleCell(ctx, x - cellW * 0.48, y + cellH * 0.95, cellW, cellH, false, rand);
    }
  }

  function drawElodeaSingleCell(ctx, x, y, w, h, detailed, rand) {
    // Cell wall (rounded rect)
    var r = Math.min(w, h) * 0.08;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();

    // Cell fill - light green
    ctx.fillStyle = 'rgba(168, 212, 138, 0.2)';
    ctx.fill();

    ctx.strokeStyle = '#6B8E4E';
    ctx.lineWidth = detailed ? 2.5 : 1.2;
    ctx.stroke();

    // Cell membrane (inner)
    if (detailed) {
      ctx.strokeStyle = '#8FB06A';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.rect(x + 5, y + 5, w - 10, h - 10);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Central vacuole
    var vacPad = detailed ? 0.2 : 0.25;
    ctx.fillStyle = 'rgba(200, 230, 184, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w * (0.5 - vacPad), h * (0.5 - vacPad), 0, 0, Math.PI * 2);
    ctx.fill();
    if (detailed) {
      ctx.strokeStyle = 'rgba(160, 200, 140, 0.4)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Chloroplasts along edges
    var numChloroplasts = detailed ? 20 : (w > 30 ? 8 : 3);
    ctx.fillStyle = '#2D6E1E';
    for (var c = 0; c < numChloroplasts; c++) {
      var edge = rand() > 0.5;
      var cx, cy, angle;
      if (edge) {
        // Along top/bottom edges
        cx = x + w * 0.1 + rand() * w * 0.8;
        cy = rand() > 0.5 ? y + h * 0.1 + rand() * h * 0.1 : y + h * 0.8 + rand() * h * 0.1;
        angle = rand() * 0.4 - 0.2;
      } else {
        // Along left/right edges
        cx = rand() > 0.5 ? x + w * 0.08 + rand() * w * 0.08 : x + w * 0.84 + rand() * w * 0.08;
        cy = y + h * 0.1 + rand() * h * 0.8;
        angle = Math.PI / 2 + rand() * 0.4 - 0.2;
      }
      var cw = detailed ? w * 0.06 : w * 0.04;
      var ch = detailed ? w * 0.03 : w * 0.02;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, ch, angle, 0, Math.PI * 2);
      ctx.fill();

      if (detailed) {
        ctx.strokeStyle = '#1a5010';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Nucleus (often partially hidden, shown in detailed view)
    if (detailed) {
      var nucR = Math.min(w, h) * 0.09;
      var nucX = x + w * 0.35;
      var nucY = y + h * 0.5;
      ctx.fillStyle = 'rgba(61, 92, 46, 0.6)';
      ctx.beginPath();
      ctx.arc(nucX, nucY, nucR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a4020';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  /* ── Blood cells ── */
  function drawBloodCells(ctx, w, h, mag, rand) {
    if (mag === 'x40') {
      // Many tiny red dots, very hard to see detail
      ctx.fillStyle = '#faf0f0';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 300; i++) {
        var cx = rand() * w;
        var cy = rand() * h;
        var r = w * 0.008 + rand() * w * 0.004;
        ctx.fillStyle = 'rgba(224, 112, 112, 0.6)';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // A couple WBCs
      for (var j = 0; j < 2; j++) {
        var wx = rand() * w;
        var wy = rand() * h;
        ctx.fillStyle = 'rgba(168, 160, 208, 0.5)';
        ctx.beginPath();
        ctx.arc(wx, wy, w * 0.015, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (mag === 'x100') {
      ctx.fillStyle = '#faf0f0';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 80; i++) {
        var cx = rand() * w;
        var cy = rand() * h;
        var r = w * 0.025 + rand() * w * 0.008;
        drawRBC(ctx, cx, cy, r, false, rand);
      }
      // WBCs
      for (var j = 0; j < 3; j++) {
        var wx = w * 0.2 + rand() * w * 0.6;
        var wy = h * 0.2 + rand() * h * 0.6;
        drawWBC(ctx, wx, wy, w * 0.04, false, rand);
      }
    } else if (mag === 'x400') {
      ctx.fillStyle = '#faf0f0';
      ctx.fillRect(0, 0, w, h);
      // Many RBCs fill the view
      for (var i = 0; i < 25; i++) {
        var cx = rand() * w;
        var cy = rand() * h;
        var r = w * 0.065 + rand() * w * 0.015;
        drawRBC(ctx, cx, cy, r, true, rand);
      }
      // One prominent WBC
      drawWBC(ctx, w * 0.45, h * 0.5, w * 0.1, true, rand);
      // Another smaller WBC
      drawWBC(ctx, w * 0.8, h * 0.3, w * 0.07, false, rand);
    }
  }

  function drawRBC(ctx, cx, cy, r, detailed, rand) {
    // Red blood cell - biconcave disc seen from above
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(224, 112, 112, 0.65)';
    ctx.fill();
    ctx.strokeStyle = '#c06060';
    ctx.lineWidth = detailed ? 1.2 : 0.6;
    ctx.stroke();

    // Pale centre (biconcave)
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240, 160, 160, 0.5)';
    ctx.fill();

    if (detailed) {
      // Gradient to show biconcave shape
      var grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      grad.addColorStop(0, 'rgba(240, 180, 180, 0.4)');
      grad.addColorStop(0.4, 'rgba(224, 112, 112, 0.1)');
      grad.addColorStop(0.7, 'rgba(224, 112, 112, 0.5)');
      grad.addColorStop(1, 'rgba(200, 90, 90, 0.6)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  function drawWBC(ctx, cx, cy, r, detailed, rand) {
    // White blood cell - larger, irregular
    ctx.beginPath();
    var points = 20;
    for (var i = 0; i <= points; i++) {
      var angle = (i / points) * Math.PI * 2;
      var rr = r * (0.9 + rand() * 0.2);
      var px = cx + Math.cos(angle) * rr;
      var py = cy + Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(200, 192, 232, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#8880b0';
    ctx.lineWidth = detailed ? 1.5 : 0.8;
    ctx.stroke();

    // Multi-lobed nucleus
    if (detailed) {
      var lobes = 3;
      for (var l = 0; l < lobes; l++) {
        var la = (l / lobes) * Math.PI * 1.5 + 0.3;
        var ld = r * 0.25;
        var lx = cx + Math.cos(la) * ld;
        var ly = cy + Math.sin(la) * ld;
        ctx.beginPath();
        ctx.ellipse(lx, ly, r * 0.3, r * 0.22, la, 0, Math.PI * 2);
        ctx.fillStyle = '#5040A0';
        ctx.fill();
        ctx.strokeStyle = '#3a2d80';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Cytoplasm dots
      ctx.fillStyle = 'rgba(180, 175, 210, 0.4)';
      for (var d = 0; d < 15; d++) {
        var da = rand() * Math.PI * 2;
        var dd = rand() * r * 0.7;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(da) * dd, cy + Math.sin(da) * dd, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Simple nucleus blob
      ctx.fillStyle = '#5040A0';
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 0.5, r * 0.4, rand() * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── Specimen info panel ── */
  function showSpecimenInfo(slide) {
    dom.specimenInfo.hidden = false;
    dom.infoTitle.textContent = slide.name + ' (' + slide.type + ')';
    dom.infoDesc.textContent = slide.description;
  }

  function hideSpecimenInfo() {
    dom.specimenInfo.hidden = true;
    dom.labelChecklist.hidden = true;
  }

  /* ── Label checklist ── */
  function buildChecklist(slide) {
    dom.labelChecklist.hidden = false;
    dom.checklistList.innerHTML = '';
    state.checkedStructures = {};

    var guided = (typeof LabRecordMode === 'undefined') || LabRecordMode.isGuided();

    slide.structures.forEach(function (struct) {
      var li = document.createElement('li');
      li.className = 'checklist-item';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'chk-' + struct.id;
      cb.setAttribute('data-id', struct.id);
      cb.addEventListener('change', function () {
        var sid = this.getAttribute('data-id');
        state.checkedStructures[sid] = this.checked;
        checkCompletionReady();
        if (this.checked) {
          toast('Identified: ' + struct.label, 'info');
        }
      });

      var label = document.createElement('label');
      label.setAttribute('for', 'chk-' + struct.id);

      var swatch = document.createElement('span');
      swatch.className = 'structure-colour';
      swatch.style.backgroundColor = struct.colour;

      label.appendChild(swatch);

      if (guided) {
        var text = document.createTextNode(struct.label);
        label.appendChild(text);
      } else {
        /* Independent mode: student must type the structure name */
        var nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Name this structure\u2026';
        nameInput.setAttribute('data-expected', struct.label);
        nameInput.style.cssText = 'width:120px;border:1px solid var(--color-border);border-radius:4px;padding:2px 6px;font-size:inherit;background:var(--color-surface);color:var(--color-text);';
        label.appendChild(nameInput);
      }

      if (struct.required) {
        var req = document.createElement('span');
        req.className = 'structure-req';
        req.textContent = '(required)';
        label.appendChild(req);
      }

      // Description tooltip on hover / underneath (always show in guided, hide in independent)
      var desc = document.createElement('span');
      desc.className = 'structure-desc';
      if (guided) {
        desc.textContent = struct.description;
      } else {
        desc.textContent = ''; /* Hidden in independent mode */
      }
      label.appendChild(desc);

      li.appendChild(cb);
      li.appendChild(label);
      dom.checklistList.appendChild(li);
    });

  }

  /* Rebuild checklist when mode changes (registered once, outside buildChecklist) */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.onChange(function () {
      if (state.slide) buildChecklist(state.slide);
    });
  }

  function checkCompletionReady() {
    if (!state.slide) {
      dom.btnComplete.disabled = true;
      return;
    }
    // Must have at least been at x400 and checked all required structures
    var hasHighMag = state.magSequence.indexOf('x400') !== -1;
    var allRequired = true;
    state.slide.structures.forEach(function (s) {
      if (s.required && !state.checkedStructures[s.id]) allRequired = false;
    });
    dom.btnComplete.disabled = !(hasHighMag && allRequired);
  }

  /* ── Drawing canvas ── */
  function resizeDrawCanvas() {
    var wrap = dom.drawCanvas.parentElement;
    var rect = wrap.getBoundingClientRect();
    var size = Math.floor(rect.width);
    var dpr = window.devicePixelRatio || 1;

    // Save existing drawing
    var imageData = null;
    if (dom.drawCanvas.width > 0 && dom.drawCanvas.height > 0) {
      try { imageData = dctx.getImageData(0, 0, dom.drawCanvas.width, dom.drawCanvas.height); } catch (e) {}
    }

    dom.drawCanvas.width = size * dpr;
    dom.drawCanvas.height = size * dpr;
    dom.drawCanvas.style.width = size + 'px';
    dom.drawCanvas.style.height = size + 'px';
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Restore
    if (imageData) {
      try { dctx.putImageData(imageData, 0, 0); } catch (e) {}
    }

    // White background for fresh canvas
    if (!imageData) {
      dctx.fillStyle = '#fff';
      dctx.fillRect(0, 0, size, size);
    }
  }

  function getCanvasPos(e, canvas) {
    var rect = canvas.getBoundingClientRect();
    var clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function startDraw(e) {
    e.preventDefault();
    state.isDrawing = true;
    var pos = getCanvasPos(e, dom.drawCanvas);
    state.lastX = pos.x;
    state.lastY = pos.y;
    markProcedure('draw');
  }

  function moveDraw(e) {
    if (!state.isDrawing) return;
    e.preventDefault();
    var pos = getCanvasPos(e, dom.drawCanvas);

    dctx.beginPath();
    dctx.moveTo(state.lastX, state.lastY);
    dctx.lineTo(pos.x, pos.y);

    if (state.drawTool === 'eraser') {
      dctx.strokeStyle = '#ffffff';
      dctx.lineWidth = parseInt(state.drawLineWidth, 10) * 4;
    } else {
      dctx.strokeStyle = state.drawColour;
      dctx.lineWidth = parseInt(state.drawLineWidth, 10);
    }

    dctx.lineCap = 'round';
    dctx.lineJoin = 'round';
    dctx.stroke();

    state.lastX = pos.x;
    state.lastY = pos.y;
  }

  function endDraw(e) {
    if (state.isDrawing) {
      state.isDrawing = false;
    }
  }

  // Mouse events
  dom.drawCanvas.addEventListener('mousedown', startDraw);
  dom.drawCanvas.addEventListener('mousemove', moveDraw);
  dom.drawCanvas.addEventListener('mouseup', endDraw);
  dom.drawCanvas.addEventListener('mouseleave', endDraw);

  // Touch events
  dom.drawCanvas.addEventListener('touchstart', startDraw, { passive: false });
  dom.drawCanvas.addEventListener('touchmove', moveDraw, { passive: false });
  dom.drawCanvas.addEventListener('touchend', endDraw);
  dom.drawCanvas.addEventListener('touchcancel', endDraw);

  /* Drawing tools */
  dom.btnPencil.addEventListener('click', function () {
    state.drawTool = 'pencil';
    dom.btnPencil.classList.add('active');
    dom.btnEraser.classList.remove('active');
    dom.drawCanvas.parentElement.style.cursor = 'crosshair';
  });

  dom.btnEraser.addEventListener('click', function () {
    state.drawTool = 'eraser';
    dom.btnEraser.classList.add('active');
    dom.btnPencil.classList.remove('active');
    dom.drawCanvas.parentElement.style.cursor = 'cell';
  });

  dom.drawColour.addEventListener('input', function () {
    state.drawColour = this.value;
    // Switch back to pencil when picking a colour
    state.drawTool = 'pencil';
    dom.btnPencil.classList.add('active');
    dom.btnEraser.classList.remove('active');
  });

  dom.drawSize.addEventListener('change', function () {
    state.drawLineWidth = parseInt(this.value, 10);
  });

  dom.btnClearDraw.addEventListener('click', function () {
    var size = dom.drawCanvas.width / (window.devicePixelRatio || 1);
    dctx.fillStyle = '#fff';
    dctx.fillRect(0, 0, size, size);
    toast('Drawing cleared.', 'info');
  });

  /* ── Export drawing ── */
  dom.btnExportDraw.addEventListener('click', function () {
    if (typeof LabExport !== 'undefined') {
      var filename = state.slide ? 'microscopy-' + state.slide.id + '.png' : 'microscopy-drawing.png';
      LabExport.canvasToPNG(dom.drawCanvas, filename);
      toast('Drawing saved as PNG.', 'success');
    }
  });

  /* ── Complete drawing ── */
  dom.btnComplete.addEventListener('click', function () {
    if (state.completed) return;
    state.completed = true;

    markProcedure('complete');

    // Score the work
    buildScore();

    toast('Drawing completed! Check your score below.', 'success');
    dom.btnComplete.disabled = true;

    if (typeof LabProgress !== 'undefined') {
      var pct = scorer ? scorer.percentage() : 0;
      LabProgress.markComplete('microscopy', Math.round(pct));
    }
  });

  /* ── Scoring ── */
  function buildScore() {
    scorer = LabScore.create({
      practical: 'microscopy',
      criteria: DATA.drawingCriteria,
      totalMarks: DATA.drawingCriteria.reduce(function (sum, c) { return sum + c.marks; }, 0)
    });

    // Auto-evaluate what we can
    // Drawing size: check if canvas has significant coverage (heuristic)
    var drawData = dctx.getImageData(0, 0, dom.drawCanvas.width, dom.drawCanvas.height).data;
    var nonWhite = 0;
    var total = drawData.length / 4;
    for (var i = 0; i < drawData.length; i += 4) {
      if (drawData[i] < 240 || drawData[i + 1] < 240 || drawData[i + 2] < 240) {
        nonWhite++;
      }
    }
    var coverage = nonWhite / total;
    if (coverage > 0.05) {
      scorer.award('size', 1, 'Drawing covers ' + (coverage * 100).toFixed(0) + '% of canvas');
    } else {
      scorer.award('size', 0, 'Drawing is too small');
    }

    // Award proportions if they drew something substantial
    if (coverage > 0.02) {
      scorer.award('proportions', 1);
      scorer.award('lines', 1);
    }

    // Labels checked
    var requiredCount = 0;
    var checkedRequired = 0;
    if (state.slide) {
      state.slide.structures.forEach(function (s) {
        if (s.required) {
          requiredCount++;
          if (state.checkedStructures[s.id]) checkedRequired++;
        }
      });
    }

    if (checkedRequired === requiredCount && requiredCount > 0) {
      scorer.award('labels-correct', 2, 'All ' + requiredCount + ' required structures identified');
    } else if (checkedRequired > 0) {
      scorer.award('labels-correct', 1, checkedRequired + '/' + requiredCount + ' required structures');
    }

    // Label lines – give if they drew and labelled
    if (coverage > 0.02 && checkedRequired > 0) {
      scorer.award('label-lines', 1);
    }

    // Title and magnification – award if completed at x400
    if (state.magSequence.indexOf('x400') !== -1) {
      scorer.award('title', 1, 'Specimen: ' + (state.slide ? state.slide.name : ''));
      scorer.award('magnification', 1, 'Viewed at x400');
    }

    // Focus skill
    var focusCount = 0;
    if (state.focusedCorrectly['x40']) focusCount++;
    if (state.focusedCorrectly['x100']) focusCount++;
    if (state.focusedCorrectly['x400']) focusCount++;
    if (focusCount >= 2) {
      scorer.award('focus-skill', 1, 'Focused at ' + focusCount + ' magnifications');
    }

    // Magnification sequence – should go x40 → x100 → x400
    var correctOrder = true;
    var expected = ['x40', 'x100', 'x400'];
    var found = [];
    for (var m = 0; m < state.magSequence.length; m++) {
      var mag = state.magSequence[m];
      if (found.indexOf(mag) === -1) found.push(mag);
    }
    for (var e = 0; e < expected.length; e++) {
      if (found[e] !== expected[e]) { correctOrder = false; break; }
    }
    if (correctOrder && found.length >= 3) {
      scorer.award('mag-sequence', 1, 'Low \u2192 medium \u2192 high power');
    } else {
      scorer.award('mag-sequence', 0, 'Magnifications not used in correct order');
    }

    // Render summary
    dom.scoreContainer.innerHTML = '';
    dom.scoreContainer.appendChild(scorer.buildSummary());
  }

  /* ── Guide toggle ── */
  dom.btnGuide.addEventListener('click', function () {
    state.guideOpen = !state.guideOpen;
    dom.guidePanel.style.display = state.guideOpen ? '' : 'none';
  });

  /* ── Reset ── */
  dom.btnReset.addEventListener('click', function () {
    // Reset state
    state.slide = null;
    state.mag = null;
    state.focused = true;
    state.focusVal = 50;
    state.drawTool = 'pencil';
    state.drawColour = '#1a1b25';
    state.drawLineWidth = 2;
    state.isDrawing = false;
    state.procedureDone = {};
    state.checkedStructures = {};
    state.completed = false;
    state.magSequence = [];
    state.focusedCorrectly = {};
    scorer = null;

    // Reset UI
    dom.slideSelect.value = '';
    dom.slidePrep.hidden = true;
    disableMagButtons();
    clearActiveMag();
    hideSpecimenInfo();
    dom.viewportEmpty.style.display = '';
    clearSpecimenCanvas();
    dom.specimenCanvas.style.filter = 'none';
    dom.focusSlider.value = 50;
    dom.focusValue.textContent = 'Focused';
    dom.focusValue.classList.remove('blurred');
    dom.infoSlide.textContent = 'No slide loaded';
    dom.infoMag.textContent = '\u2014';
    if (magCalcEl) magCalcEl.hidden = true;

    // Clear drawing
    var size = dom.drawCanvas.width / (window.devicePixelRatio || 1);
    dctx.fillStyle = '#fff';
    dctx.fillRect(0, 0, size, size);

    // Reset draw tools
    dom.btnPencil.classList.add('active');
    dom.btnEraser.classList.remove('active');
    dom.drawColour.value = '#1a1b25';
    dom.drawSize.value = '2';

    // Reset buttons
    dom.btnComplete.disabled = true;

    // Clear score
    dom.scoreContainer.innerHTML = '';

    // Reset procedure
    updateProcedureUI();

    toast('Practical reset.', 'info');
  });

  /* ── Resize handling ── */
  function handleResize() {
    resizeSpecimenCanvas();
    resizeDrawCanvas();
  }

  window.addEventListener('resize', handleResize);

  /* ── Init ── */
  buildProcedure();
  buildSlideSelector();
  resizeSpecimenCanvas();
  resizeDrawCanvas();
  updateProcedureUI();

  // Mark initial step as active
  var firstStep = dom.procList.querySelector('.procedure-step');
  if (firstStep) firstStep.classList.add('active');

  // Track visit
  if (typeof LabProgress !== 'undefined') {
    LabProgress.markVisited('microscopy');
  }
});
