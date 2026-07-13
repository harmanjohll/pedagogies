/* Lenses & Light practical – ray optics simulation */
document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };

  var dom = {
    canvas:     $('bench-canvas'),
    sliderF:    $('slider-focal'),
    sliderU:    $('slider-object'),
    valF:       $('val-focal'),
    valU:       $('val-object'),
    infoV:      $('info-v'),
    infoMag:    $('info-mag'),
    infoNature: $('info-nature'),
    btnRecord:  $('btn-record'),
    tbody:      $('data-tbody'),
    graphCanvas: $('graph-canvas'),
    calcPanel:  $('calc-panel'),
    calcXInt:   $('calc-x-int'),
    calcYInt:   $('calc-y-int'),
    calcFx:     $('calc-fx'),
    calcFy:     $('calc-fy'),
    calcFAvg:   $('calc-f-avg'),
    calcError:  $('calc-error'),
    btnGuide:   $('btn-guide'),
    btnReset:   $('btn-reset'),
    guidePanel: $('guide-panel'),
    procList:   $('procedure-list')
  };

  var ctx = dom.canvas.getContext('2d');
  var gctx = dom.graphCanvas.getContext('2d');

  /* ── State ── */
  var state = {
    f: 10,         // focal length cm
    u: 25,         // object distance cm
    dataPoints: [],
    procedureDone: {},
    guideOpen: true
  };

  /* Scale: 1 cm = N pixels, computed from canvas width */
  var BENCH_CM = 60;  // total bench length in cm
  var OBJ_HEIGHT_CM = 3; // arrow height

  /* ── Config handlers ── */
  dom.sliderF.addEventListener('input', function () {
    state.f = +this.value;
    dom.valF.textContent = state.f + ' cm';
    markProcedure('setup');
    update();
  });

  dom.sliderU.addEventListener('input', function () {
    state.u = +this.value;
    dom.valU.textContent = state.u + ' cm';
    markProcedure('position');
    update();
  });

  /* ── LabRecordMode integration ── */
  if (typeof LabRecordMode !== 'undefined') {
    LabRecordMode.inject('#record-mode-slot');
  }

  /* ── Record ── */
  dom.btnRecord.addEventListener('click', function () {
    var v = computeV();
    if (v === null || v < 0) {
      toast('Virtual image — cannot be captured on a screen. Move object beyond F.', 'warn');
      return;
    }

    /* In independent mode, require manual entry of v */
    if (typeof LabRecordMode !== 'undefined' && !LabRecordMode.isGuided()) {
      var userV = prompt('Enter the image distance v (cm) you measured:');
      if (userV === null) return;
      userV = parseFloat(userV);
      if (isNaN(userV) || userV <= 0) {
        toast('Please enter a valid positive number for v.', 'warn');
        return;
      }
      addReading(state.u, userV);
    } else {
      // add noise (guided mode auto-records)
      var vNoisy = v + (Math.random() - 0.5) * 0.6;
      addReading(state.u, +vNoisy.toFixed(1));
    }
  });

  function addReading(uVal, vVal) {
    var invU = 1 / uVal;
    var invV = 1 / vVal;
    state.dataPoints.push({ u: uVal, v: vVal, invU: invU, invV: invV });

    // table row
    var n = state.dataPoints.length;
    var row = document.createElement('tr');
    row.innerHTML = '<td>' + n + '</td><td>' + uVal.toFixed(1) + '</td><td>'
      + vVal.toFixed(1) + '</td><td>' + invU.toFixed(4) + '</td><td>' + invV.toFixed(4) + '</td>';
    dom.tbody.appendChild(row);

    markProcedure('record');
    if (n >= 5) markProcedure('repeat');

    drawGraph();
    if (n >= 5) {
      calculateF();
      markProcedure('graph');
    }
    toast('Reading #' + n + ' recorded (u=' + uVal + ', v=' + vVal.toFixed(1) + ').', 'info');
  }

  /* ── Compute image ── */
  function computeV() {
    // 1/f = 1/v + 1/u  →  1/v = 1/f - 1/u  →  v = uf/(u - f)
    if (state.u === state.f) return null; // at F → image at infinity
    return (state.u * state.f) / (state.u - state.f);
  }

  function update() {
    var v = computeV();
    markProcedure('observe');

    if (v === null) {
      dom.infoV.textContent = '∞';
      dom.infoMag.textContent = '∞';
      dom.infoNature.textContent = 'Image at infinity';
    } else if (v < 0) {
      // virtual image (u < f)
      dom.infoV.textContent = Math.abs(v).toFixed(1) + ' cm';
      var mag = Math.abs(v / state.u);
      dom.infoMag.textContent = mag.toFixed(2) + '×';
      var vSize = mag > 1.05 ? 'magnified' : (mag < 0.95 ? 'diminished' : 'same size');
      dom.infoNature.textContent = 'Virtual, upright, ' + vSize;
    } else {
      dom.infoV.textContent = v.toFixed(1) + ' cm';
      var mag2 = v / state.u;
      dom.infoMag.textContent = mag2.toFixed(2) + '×';
      var size = mag2 > 1.05 ? 'magnified' : (mag2 < 0.95 ? 'diminished' : 'same size');
      dom.infoNature.textContent = 'Real, inverted, ' + size;
    }

    drawBench();
  }

  /* ── Canvas sizing ── */
  function resizeCanvas() {
    var rect = dom.canvas.parentElement.getBoundingClientRect();
    dom.canvas.width = rect.width * devicePixelRatio;
    dom.canvas.height = rect.height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    var gr = dom.graphCanvas.parentElement.getBoundingClientRect();
    dom.graphCanvas.width = gr.width * devicePixelRatio;
    dom.graphCanvas.height = 220 * devicePixelRatio;
    gctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    drawBench();
    drawGraph();
  }
  window.addEventListener('resize', resizeCanvas);

  /* ── Draw optical bench ── */
  function drawBench() {
    var w = dom.canvas.width / devicePixelRatio;
    var h = dom.canvas.height / devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    var scale = w / BENCH_CM;
    var axisY = h * 0.55; // principal axis
    var lensX = w * 0.45; // lens position on screen

    // ruler along bottom
    drawRuler(w, h, scale, lensX);

    // Principal axis
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, axisY);
    ctx.lineTo(w, axisY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Focal points
    var fPx = state.f * scale;
    ctx.fillStyle = 'rgba(255,200,50,0.7)';
    drawDot(lensX - fPx, axisY, 4);
    drawDot(lensX + fPx, axisY, 4);
    ctx.fillStyle = 'rgba(255,200,50,0.5)';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('F', lensX - fPx, axisY + 16);
    ctx.fillText("F'", lensX + fPx, axisY + 16);

    // 2F points
    drawDot(lensX - 2 * fPx, axisY, 3);
    drawDot(lensX + 2 * fPx, axisY, 3);
    ctx.fillText('2F', lensX - 2 * fPx, axisY + 16);
    ctx.fillText("2F'", lensX + 2 * fPx, axisY + 16);

    // Lens
    drawLens(lensX, axisY, h);

    // Object arrow
    var objX = lensX - state.u * scale;
    var objH = OBJ_HEIGHT_CM * scale;
    ctx.strokeStyle = '#4fc3f7';
    ctx.fillStyle = '#4fc3f7';
    ctx.lineWidth = 2.5;
    drawArrowLine(objX, axisY, objX, axisY - objH);

    // label
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText('Object', objX, axisY + 28);
    ctx.fillText('u = ' + state.u + ' cm', objX, axisY + 40);

    // Compute image
    var v = computeV();
    if (v === null) {
      // rays parallel after lens
      drawRays(lensX, axisY, objX, objH, scale, null, false);
      return;
    }

    var isVirtual = v < 0;
    var imgX = lensX + v * scale;  // v is negative for virtual, so imgX < lensX
    var mag = v / state.u;
    var imgH = Math.abs(mag) * objH;
    if (imgH > h * 0.4) imgH = h * 0.4; // cap for display

    // Image arrow
    if (!isVirtual) {
      // real: inverted
      ctx.strokeStyle = '#ef5350';
      ctx.fillStyle = '#ef5350';
      ctx.lineWidth = 2.5;
      drawArrowLine(imgX, axisY, imgX, axisY + imgH);
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Image', imgX, axisY + imgH + 16);
      ctx.fillText('v = ' + Math.abs(v).toFixed(1) + ' cm', imgX, axisY + imgH + 28);
    } else {
      // virtual: upright, on same side
      ctx.strokeStyle = 'rgba(239,83,80,0.5)';
      ctx.fillStyle = 'rgba(239,83,80,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      drawArrowLine(imgX, axisY, imgX, axisY - imgH);
      ctx.setLineDash([]);
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(239,83,80,0.7)';
      ctx.fillText('Virtual Image', imgX, axisY - imgH - 8);
    }

    // Rays
    drawRays(lensX, axisY, objX, objH, scale, v, isVirtual);
  }

  function drawLens(lx, ay, h) {
    var lensH = h * 0.55;
    ctx.strokeStyle = 'rgba(130,200,255,0.6)';
    ctx.fillStyle = 'rgba(130,200,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // double convex shape using bezier curves
    ctx.moveTo(lx, ay - lensH / 2);
    ctx.bezierCurveTo(lx + 12, ay - lensH / 4, lx + 12, ay + lensH / 4, lx, ay + lensH / 2);
    ctx.bezierCurveTo(lx - 12, ay + lensH / 4, lx - 12, ay - lensH / 4, lx, ay - lensH / 2);
    ctx.fill();
    ctx.stroke();

    // arrowheads on lens tips
    ctx.fillStyle = 'rgba(130,200,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(lx - 6, ay - lensH / 2 + 2);
    ctx.lineTo(lx, ay - lensH / 2 - 4);
    ctx.lineTo(lx + 6, ay - lensH / 2 + 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lx - 6, ay + lensH / 2 - 2);
    ctx.lineTo(lx, ay + lensH / 2 + 4);
    ctx.lineTo(lx + 6, ay + lensH / 2 - 2);
    ctx.fill();

    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillStyle = 'rgba(130,200,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('Lens', lx, ay + lensH / 2 + 20);
  }

  function drawRays(lensX, axisY, objX, objH, scale, v, isVirtual) {
    var topObj = axisY - objH;
    var fPx = state.f * scale;

    ctx.lineWidth = 1.2;

    // Ray 1: parallel to axis → through F' after lens
    ctx.strokeStyle = 'rgba(255,230,80,0.7)';
    ctx.beginPath();
    ctx.moveTo(objX, topObj);
    ctx.lineTo(lensX, topObj); // horizontal to lens
    ctx.stroke();
    // after lens: passes through F'
    if (v === null) {
      // parallel after lens (object at F)
      ctx.beginPath();
      ctx.moveTo(lensX, topObj);
      ctx.lineTo(lensX + 200, topObj);
      ctx.stroke();
    } else if (!isVirtual) {
      // converges through F' and continues to image
      var imgX = lensX + v * scale;
      var mag = v / state.u;
      var imgH = Math.abs(mag) * objH;
      if (imgH > (dom.canvas.height / devicePixelRatio) * 0.4) imgH = (dom.canvas.height / devicePixelRatio) * 0.4;
      ctx.beginPath();
      ctx.moveTo(lensX, topObj);
      ctx.lineTo(imgX, axisY + imgH);
      ctx.stroke();
    } else {
      // diverges — trace forward and show virtual extension backward
      var slope = -(topObj - axisY) / fPx; // slope from lens hit toward F'
      var extX = lensX + 200;
      var extY = topObj + slope * 200;
      ctx.beginPath();
      ctx.moveTo(lensX, topObj);
      ctx.lineTo(extX, extY);
      ctx.stroke();
      // virtual extension (dashed backward)
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255,230,80,0.35)';
      var vExtX = lensX - 200;
      var vExtY = topObj - slope * 200;
      ctx.beginPath();
      ctx.moveTo(lensX, topObj);
      ctx.lineTo(vExtX, vExtY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ray 2: through optical centre → straight through
    ctx.strokeStyle = 'rgba(80,255,130,0.7)';
    ctx.beginPath();
    ctx.moveTo(objX, topObj);
    ctx.lineTo(lensX, axisY); // towards centre
    ctx.stroke();
    // continue straight
    var dx = lensX - objX;
    var dy = axisY - topObj;
    var extLen = 250;
    ctx.beginPath();
    ctx.moveTo(lensX, axisY);
    ctx.lineTo(lensX + extLen, axisY + (dy / dx) * extLen);
    ctx.stroke();
    if (isVirtual) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(80,255,130,0.35)';
      ctx.beginPath();
      ctx.moveTo(lensX, axisY);
      ctx.lineTo(lensX - extLen, axisY - (dy / dx) * extLen);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ray 3: through F on object side → parallel after lens
    ctx.strokeStyle = 'rgba(255,100,200,0.7)';
    var fObjX = lensX - fPx;
    // line from top of object through F to lens
    var slopeToF = (axisY - topObj) / (fObjX - objX);
    var yAtLens = topObj + slopeToF * (lensX - objX);
    ctx.beginPath();
    ctx.moveTo(objX, topObj);
    ctx.lineTo(lensX, yAtLens);
    ctx.stroke();
    // after lens: parallel to axis
    ctx.beginPath();
    ctx.moveTo(lensX, yAtLens);
    ctx.lineTo(lensX + 250, yAtLens);
    ctx.stroke();
    if (isVirtual) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255,100,200,0.35)';
      ctx.beginPath();
      ctx.moveTo(lensX, yAtLens);
      ctx.lineTo(lensX - 200, yAtLens);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawRuler(w, h, scale, lensX) {
    var rulerY = h - 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rulerY);
    ctx.lineTo(w, rulerY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '400 8px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (var cm = 0; cm < BENCH_CM; cm += 5) {
      var x = lensX - (BENCH_CM / 2 - cm) * scale;
      if (x < 0 || x > w) continue;
      ctx.beginPath();
      ctx.moveTo(x, rulerY);
      ctx.lineTo(x, rulerY + 5);
      ctx.stroke();
      ctx.fillText(cm + '', x, rulerY + 14);
    }
  }

  function drawDot(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawArrowLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // arrowhead
    var angle = Math.atan2(y2 - y1, x2 - x1);
    var headLen = 8;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.4), y2 - headLen * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.4), y2 - headLen * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  /* ── Graph: 1/v vs 1/u ── */
  function drawGraph() {
    var w = dom.graphCanvas.width / devicePixelRatio;
    var h = 220;
    gctx.clearRect(0, 0, w, h);

    var pad = { top: 15, right: 15, bottom: 35, left: 45 };
    var gw = w - pad.left - pad.right;
    var gh = h - pad.top - pad.bottom;

    // determine axis range
    var maxInvU = 0.22;
    var maxInvV = 0.22;

    // detect dark mode for graph colors
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var axisColor = isDark ? '#aaa' : '#666';
    var gridColor = isDark ? '#444' : '#eee';
    var textColor = isDark ? '#bbb' : '#999';
    var labelColor = isDark ? '#bbb' : '#666';

    // axes
    gctx.strokeStyle = axisColor;
    gctx.lineWidth = 1;
    gctx.beginPath();
    gctx.moveTo(pad.left, pad.top);
    gctx.lineTo(pad.left, pad.top + gh);
    gctx.lineTo(pad.left + gw, pad.top + gh);
    gctx.stroke();

    // labels
    gctx.fillStyle = labelColor;
    gctx.font = '500 10px Inter, sans-serif';
    gctx.textAlign = 'center';
    gctx.fillText('1/u (cm\u207b\u00b9)', pad.left + gw / 2, h - 4);
    gctx.save();
    gctx.translate(12, pad.top + gh / 2);
    gctx.rotate(-Math.PI / 2);
    gctx.fillText('1/v (cm\u207b\u00b9)', 0, 0);
    gctx.restore();

    // grid + ticks
    gctx.strokeStyle = gridColor;
    gctx.lineWidth = 0.5;
    gctx.font = '400 9px Inter, sans-serif';
    gctx.fillStyle = textColor;
    for (var t = 0; t <= 0.2; t += 0.05) {
      var xp = pad.left + (t / maxInvU) * gw;
      var yp = pad.top + gh - (t / maxInvV) * gh;
      // vertical grid
      gctx.beginPath();
      gctx.moveTo(xp, pad.top);
      gctx.lineTo(xp, pad.top + gh);
      gctx.stroke();
      gctx.textAlign = 'center';
      gctx.fillText(t.toFixed(2), xp, pad.top + gh + 14);
      // horizontal grid
      gctx.beginPath();
      gctx.moveTo(pad.left, yp);
      gctx.lineTo(pad.left + gw, yp);
      gctx.stroke();
      gctx.textAlign = 'right';
      gctx.fillText(t.toFixed(2), pad.left - 4, yp + 3);
    }

    if (state.dataPoints.length === 0) return;

    // plot points
    state.dataPoints.forEach(function (d) {
      var px = pad.left + (d.invU / maxInvU) * gw;
      var py = pad.top + gh - (d.invV / maxInvV) * gh;
      gctx.beginPath();
      gctx.arc(px, py, 4, 0, Math.PI * 2);
      gctx.fillStyle = '#e67e22';
      gctx.fill();
      gctx.strokeStyle = '#c0601a';
      gctx.lineWidth = 1;
      gctx.stroke();
    });

    // best-fit line: 1/v = -1/u + 1/f  →  line with slope -1, y-int = 1/f
    // use linear regression: 1/v = m*(1/u) + c
    if (state.dataPoints.length >= 2) {
      var n = state.dataPoints.length;
      var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      state.dataPoints.forEach(function (d) {
        sumX += d.invU;
        sumY += d.invV;
        sumXY += d.invU * d.invV;
        sumXX += d.invU * d.invU;
      });
      var m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      var c = (sumY - m * sumX) / n;

      // draw line from x=0 to where it crosses x axis
      var x0 = 0, y0 = c;
      var x1 = maxInvU, y1 = m * maxInvU + c;
      // also find x-intercept: 0 = mx + c → x = -c/m
      var xInt = -c / m;

      var px0 = pad.left + (x0 / maxInvU) * gw;
      var py0 = pad.top + gh - (y0 / maxInvV) * gh;
      var px1 = pad.left + (x1 / maxInvU) * gw;
      var py1 = pad.top + gh - (y1 / maxInvV) * gh;

      gctx.strokeStyle = '#e67e22';
      gctx.lineWidth = 1.5;
      gctx.setLineDash([5, 3]);
      gctx.beginPath();
      gctx.moveTo(px0, py0);
      gctx.lineTo(px1, py1);
      gctx.stroke();
      gctx.setLineDash([]);
    }
  }

  /* ── Calculate f from graph ── */
  function calculateF() {
    if (state.dataPoints.length < 3) return;
    dom.calcPanel.hidden = false;

    var n = state.dataPoints.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    state.dataPoints.forEach(function (d) {
      sumX += d.invU;
      sumY += d.invV;
      sumXY += d.invU * d.invV;
      sumXX += d.invU * d.invU;
    });
    var m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    var c = (sumY - m * sumX) / n;

    // x-intercept: 1/u when 1/v = 0 → x = -c/m
    var xInt = -c / m;
    // y-intercept: 1/v when 1/u = 0 → y = c
    var yInt = c;

    var fFromX = 1 / xInt;
    var fFromY = 1 / yInt;
    var fAvg = (fFromX + fFromY) / 2;
    var pctError = Math.abs(fAvg - state.f) / state.f * 100;

    dom.calcXInt.textContent = xInt.toFixed(4) + ' cm\u207b\u00b9';
    dom.calcYInt.textContent = yInt.toFixed(4) + ' cm\u207b\u00b9';
    dom.calcFx.textContent = fFromX.toFixed(1) + ' cm';
    dom.calcFy.textContent = fFromY.toFixed(1) + ' cm';
    dom.calcFAvg.textContent = fAvg.toFixed(1) + ' cm';
    dom.calcError.textContent = pctError.toFixed(1) + '%';
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
    state.f = 10;
    state.u = 25;
    state.dataPoints = [];
    state.procedureDone = {};

    dom.sliderF.value = 10;
    dom.sliderU.value = 25;
    dom.valF.textContent = '10 cm';
    dom.valU.textContent = '25 cm';
    dom.tbody.innerHTML = '';
    dom.calcPanel.hidden = true;

    var steps = dom.procList.querySelectorAll('.procedure-step');
    steps.forEach(function (el) { el.classList.remove('active', 'done'); });
    steps[0].classList.add('active');

    resizeCanvas();
    update();
    toast('Practical reset.', 'info');
  });

  /* ── Toast ── */
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.textContent = msg;
    $('toast-container').appendChild(el);
    requestAnimationFrame(function () { el.classList.add('visible'); });
    setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(function () { el.remove(); }, 300);
    }, 3000);
    if (typeof LabAudio !== 'undefined') {
      if (type === 'success') LabAudio.success();
      else if (type === 'warn') LabAudio.warn();
      else LabAudio.click();
    }
  }

  /* ── Init ── */
  resizeCanvas();
  update();
  dom.procList.querySelector('.procedure-step').classList.add('active');
});
