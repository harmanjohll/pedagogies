/* ======================================================
   Particle Dynamics – SciSim Interactive
   2D particle simulation with Lennard-Jones potential,
   real substance data, and authentic phase transitions
   ====================================================== */

(function () {
  "use strict";

  /* ---------- Substance Database ---------- */
  var SUBSTANCES = [
    { name: "neon",     label: "Neon",     mass: 20,  epsilon: 0.3, sigma: 8,  melt: 25,   boil: 27,   color: "#ff6b6b" },
    { name: "argon",    label: "Argon",    mass: 40,  epsilon: 1.0, sigma: 9,  melt: 84,   boil: 87,   color: "#64b5f6" },
    { name: "nitrogen", label: "Nitrogen", mass: 28,  epsilon: 0.8, sigma: 10, melt: 63,   boil: 77,   color: "#ce93d8" },
    { name: "oxygen",   label: "Oxygen",   mass: 32,  epsilon: 0.9, sigma: 10, melt: 54,   boil: 90,   color: "#ef5350" },
    { name: "water",    label: "Water",    mass: 18,  epsilon: 2.8, sigma: 8,  melt: 273,  boil: 373,  color: "#42a5f5" },
    { name: "ethanol",  label: "Ethanol",  mass: 46,  epsilon: 2.2, sigma: 11, melt: 159,  boil: 352,  color: "#81c784" },
    { name: "mercury",  label: "Mercury",  mass: 201, epsilon: 3.5, sigma: 9,  melt: 234,  boil: 630,  color: "#cfd8dc" },
    { name: "iron",     label: "Iron",     mass: 56,  epsilon: 8.0, sigma: 7,  melt: 1811, boil: 3134, color: "#b0bec5" },
  ];

  /* ---------- Constants ---------- */
  var WALL_COLOUR = "rgba(100,140,255,0.4)";
  var GRAVITY_STRENGTH = 0.08;
  var DT = 0.4;
  var N_SUBSTEPS = 3;
  var SUB_DT = DT / N_SUBSTEPS;
  var SPATIAL_CELL_FACTOR = 3;

  /* ---------- State ---------- */
  var particles = [];
  var running = true;
  var temperature = 300;
  var targetCount = 80;
  var containerPct = 100;
  var substanceIdx = 4; // default: Water (index 4 in new order)
  var gravityOn = false;
  var colourMode = "speed";
  var wallHits = 0;
  var lastPressureTime = 0;
  var pressure = 0;
  var animFrameId;
  var lastPhase = null;
  var prevPhase = null; // for tracking transitions in temperature slider

  function substance() { return SUBSTANCES[substanceIdx]; }

  function currentPhase() {
    var s = substance();
    if (temperature < s.melt) return "solid";
    if (temperature < s.boil) return "liquid";
    return "gas";
  }

  /* ---------- DOM ---------- */
  var canvas = document.getElementById("sim-canvas");
  var ctx = canvas.getContext("2d");
  var distCanvas = document.getElementById("dist-canvas");
  var distCtx = distCanvas.getContext("2d");

  var sliderTemp  = document.getElementById("slider-temp");
  var sliderCount = document.getElementById("slider-count");
  var sliderSize  = document.getElementById("slider-size");
  var tempValue   = document.getElementById("temp-value");
  var countValue  = document.getElementById("count-value");
  var sizeValue   = document.getElementById("size-value");
  var readPressure = document.getElementById("read-pressure");
  var readSpeed    = document.getElementById("read-speed");
  var readKE       = document.getElementById("read-ke");
  var readPhase    = document.getElementById("read-phase");
  var btnPlay  = document.getElementById("btn-play");
  var btnReset = document.getElementById("btn-reset");

  /* ---------- Temperature slider range ---------- */
  function updateTempSlider() {
    var s = substance();
    var lo = Math.max(10, Math.floor(s.melt * 0.3));
    var hi = Math.ceil(s.boil * 1.3);
    sliderTemp.min = lo;
    sliderTemp.max = hi;
    var labels = sliderTemp.parentElement.querySelector(".slider-labels");
    if (labels) {
      labels.innerHTML = "<span>" + lo + " K</span><span>" + hi + " K</span>";
    }
    if (temperature < lo) temperature = lo;
    if (temperature > hi) temperature = hi;
    sliderTemp.value = temperature;
    tempValue.textContent = temperature;
  }

  /* ---------- Container geometry ---------- */
  function getContainer() {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    var cw = w * containerPct / 100;
    var ch = h * containerPct / 100;
    return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  }

  /* ---------- Speed helpers ---------- */
  function speedFromTemp() {
    return Math.sqrt(temperature / substance().mass) * 2.5;
  }

  /* ---------- Spatial Hash ---------- */
  var hashCellSize = 30;
  var hashCols = 1;
  var hashRows = 1;
  var hashMap = new Map();

  function buildSpatialHash(c) {
    var s = substance();
    hashCellSize = s.sigma * SPATIAL_CELL_FACTOR;
    hashCols = Math.ceil(c.w / hashCellSize) + 1;
    hashRows = Math.ceil(c.h / hashCellSize) + 1;
    hashMap.clear();
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var col = Math.floor((p.x - c.x) / hashCellSize);
      var row = Math.floor((p.y - c.y) / hashCellSize);
      var key = row * hashCols + col;
      var bucket = hashMap.get(key);
      if (!bucket) { bucket = []; hashMap.set(key, bucket); }
      bucket.push(i);
    }
  }

  function getNeighbourIndices(pi, c) {
    var p = particles[pi];
    var col = Math.floor((p.x - c.x) / hashCellSize);
    var row = Math.floor((p.y - c.y) / hashCellSize);
    var result = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var key = (row + dr) * hashCols + (col + dc);
        var bucket = hashMap.get(key);
        if (bucket) {
          for (var k = 0; k < bucket.length; k++) {
            var j = bucket[k];
            if (j > pi) result.push(j);
          }
        }
      }
    }
    return result;
  }

  /* ---------- Lattice generation ---------- */
  function createLatticeParticles(c) {
    var s = substance();
    var spacing = s.sigma * 1.12; // equilibrium distance ~1.12 sigma for LJ
    var r = s.sigma * 0.4;
    var positions = [];

    var rowH = spacing * Math.sqrt(3) / 2;
    var cols = Math.floor((c.w - 2 * r) / spacing);
    var rows = Math.floor((c.h - 2 * r) / rowH);

    if (cols < 1) cols = 1;
    if (rows < 1) rows = 1;

    var totalSlots = cols * rows;
    var needed = Math.min(targetCount, totalSlots);

    // Center the lattice
    var latticeW = (cols - 1) * spacing;
    var latticeH = (rows - 1) * rowH;
    var offX = c.x + (c.w - latticeW) / 2;
    var offY = c.y + (c.h - latticeH) / 2;

    for (var row = 0; row < rows && positions.length < needed; row++) {
      var shift = (row % 2 === 1) ? spacing * 0.5 : 0;
      for (var col = 0; col < cols && positions.length < needed; col++) {
        positions.push({
          x: offX + col * spacing + shift,
          y: offY + row * rowH,
        });
      }
    }

    // Very small vibration for solid
    var vibAmp = speedFromTemp() * 0.03;
    var result = [];
    for (var i = 0; i < positions.length; i++) {
      var angle = Math.random() * Math.PI * 2;
      var v = vibAmp * (0.5 + Math.random() * 0.5);
      result.push({
        x: positions[i].x,
        y: positions[i].y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        ax: 0, ay: 0,
        eqX: positions[i].x,
        eqY: positions[i].y,
        trail: [],
      });
    }
    return result;
  }

  /* ---------- Random particle creation (liquid/gas) ---------- */
  function createParticle(c) {
    if (!c) c = getContainer();
    var s = substance();
    var r = s.sigma * 0.5;
    var speed = speedFromTemp();
    var angle = Math.random() * Math.PI * 2;
    var factor = 0.4 + Math.random() * 0.8;
    return {
      x: c.x + r + Math.random() * (c.w - 2 * r),
      y: c.y + r + Math.random() * (c.h - 2 * r),
      vx: Math.cos(angle) * speed * factor,
      vy: Math.sin(angle) * speed * factor,
      ax: 0, ay: 0,
      trail: [],
    };
  }

  /* ---------- Clustered liquid creation ---------- */
  function createLiquidParticles(c) {
    var s = substance();
    var spacing = s.sigma * 1.15;
    var r = s.sigma * 0.4;

    // Place particles in a loose cluster near center-bottom (like a puddle)
    var centerX = c.x + c.w / 2;
    var centerY = c.y + c.h / 2;
    var cols = Math.ceil(Math.sqrt(targetCount * 1.2));
    var rows = Math.ceil(targetCount / cols);
    var clusterW = (cols - 1) * spacing;
    var clusterH = (rows - 1) * spacing * 0.866;
    var startX = centerX - clusterW / 2;
    var startY = centerY - clusterH / 2;

    var result = [];
    var speed = speedFromTemp();
    for (var row = 0; row < rows && result.length < targetCount; row++) {
      var shift = (row % 2 === 1) ? spacing * 0.5 : 0;
      for (var col = 0; col < cols && result.length < targetCount; col++) {
        var px = startX + col * spacing + shift + (Math.random() - 0.5) * spacing * 0.3;
        var py = startY + row * spacing * 0.866 + (Math.random() - 0.5) * spacing * 0.3;
        // Clamp inside container
        px = Math.max(c.x + r, Math.min(c.x + c.w - r, px));
        py = Math.max(c.y + r, Math.min(c.y + c.h - r, py));
        var angle = Math.random() * Math.PI * 2;
        var vMag = speed * (0.3 + Math.random() * 0.7);
        result.push({
          x: px,
          y: py,
          vx: Math.cos(angle) * vMag,
          vy: Math.sin(angle) * vMag,
          ax: 0, ay: 0,
          trail: [],
        });
      }
    }
    return result;
  }

  /* ---------- Init particles based on phase ---------- */
  function initParticles() {
    var c = getContainer();
    var phase = currentPhase();

    if (phase === "solid") {
      particles = createLatticeParticles(c);
    } else if (phase === "liquid") {
      particles = createLiquidParticles(c);
    } else {
      particles = [];
      for (var i = 0; i < targetCount; i++) {
        particles.push(createParticle(c));
      }
    }
    wallHits = 0;
    pressure = 0;
    lastPressureTime = performance.now();
  }

  /* ---------- Physics step ---------- */
  function step() {
    var c = getContainer();
    var s = substance();
    var phase = currentPhase();
    var eps = s.epsilon;
    var sig = s.sigma;
    var cutoff = sig * 3;
    var cutoff2 = cutoff * cutoff;
    var particleR = sig * 0.4;
    var targetSpeed = speedFromTemp();

    /* Force clamp: cap |F/r| to prevent LJ divergence at close range.
       At r = sigma, fOverR = 24*eps/sig^2 ≈ moderate.
       We allow up to 100x that before clamping. */
    var maxFOverR = 100 * eps / (sig * sig);

    /* Minimum separation squared: below 0.4*sigma the repulsive wall
       is so steep that numerical integration breaks down.
       We enforce a hard floor and separate overlapping particles. */
    var minSep = sig * 0.4;
    var minSep2 = minSep * minSep;

    // Phase-dependent thermostat coupling (stronger than before)
    var coupling;
    if (phase === "gas") {
      coupling = 0.08;
    } else if (phase === "liquid") {
      coupling = 0.06;
    } else {
      coupling = 0.06;
    }

    /* Global velocity cap: prevents runaway in all phases.
       Solid keeps its tighter cap (1.2x) applied separately. */
    var globalMaxSpeed = targetSpeed * 3.0;

    /* ---- Sub-step loop for stability ---- */
    for (var sub = 0; sub < N_SUBSTEPS; sub++) {

      // Reset accelerations
      for (var i = 0; i < particles.length; i++) {
        particles[i].ax = 0;
        particles[i].ay = 0;
      }

      // Build spatial hash
      buildSpatialHash(c);

      // Lennard-Jones forces (with clamping)
      for (var i = 0; i < particles.length; i++) {
        var pi = particles[i];
        var neighbours = getNeighbourIndices(i, c);
        for (var k = 0; k < neighbours.length; k++) {
          var j = neighbours[k];
          var pj = particles[j];
          var dx = pj.x - pi.x;
          var dy = pj.y - pi.y;
          var r2 = dx * dx + dy * dy;

          /* Hard-core separation: if particles overlap below minSep,
             push them apart immediately instead of relying on divergent LJ. */
          if (r2 < minSep2 && r2 > 0.0001) {
            var rr = Math.sqrt(r2);
            var overlap = minSep - rr;
            var nx = dx / rr;
            var ny = dy / rr;
            // Push each particle half the overlap distance apart
            pi.x -= nx * overlap * 0.5;
            pi.y -= ny * overlap * 0.5;
            pj.x += nx * overlap * 0.5;
            pj.y += ny * overlap * 0.5;
            // Kill approach velocity
            var relV = (pj.vx - pi.vx) * nx + (pj.vy - pi.vy) * ny;
            if (relV < 0) {
              pi.vx += relV * 0.5 * nx;
              pi.vy += relV * 0.5 * ny;
              pj.vx -= relV * 0.5 * nx;
              pj.vy -= relV * 0.5 * ny;
            }
            r2 = minSep2; // use floor distance for LJ
          }

          if (r2 < cutoff2 && r2 > 0.0001) {
            var r = Math.sqrt(r2);
            var sr = sig / r;
            var sr2 = sr * sr;
            var sr6 = sr2 * sr2 * sr2;
            var sr12 = sr6 * sr6;
            var fOverR = 24 * eps * (2 * sr12 - sr6) / r2;

            // Clamp force to prevent divergence
            if (fOverR > maxFOverR) fOverR = maxFOverR;
            if (fOverR < -maxFOverR) fOverR = -maxFOverR;

            var fx = fOverR * dx;
            var fy = fOverR * dy;
            pi.ax += fx / s.mass;
            pi.ay += fy / s.mass;
            pj.ax -= fx / s.mass;
            pj.ay -= fy / s.mass;
          }
        }
      }

      // Solid: strong spring anchoring to equilibrium positions
      if (phase === "solid") {
        var kSpring = 0.5 * eps;
        var dampFactor = 0.88;
        var maxDisp = 0.3 * sig;
        var maxDisp2 = maxDisp * maxDisp;

        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          if (p.eqX !== undefined) {
            var dx = p.x - p.eqX;
            var dy = p.y - p.eqY;

            // Clamp displacement from equilibrium
            var d2 = dx * dx + dy * dy;
            if (d2 > maxDisp2) {
              var dMag = Math.sqrt(d2);
              var clampRatio = maxDisp / dMag;
              p.x = p.eqX + dx * clampRatio;
              p.y = p.eqY + dy * clampRatio;
              dx = p.x - p.eqX;
              dy = p.y - p.eqY;
              // Also kill radial velocity
              var vDot = (p.vx * dx + p.vy * dy) / (dx * dx + dy * dy + 0.001);
              if (vDot > 0) {
                p.vx -= vDot * dx;
                p.vy -= vDot * dy;
              }
            }

            // Spring force pulling back to equilibrium
            p.ax += -kSpring * dx / s.mass;
            p.ay += -kSpring * dy / s.mass;

            // Heavy velocity damping
            p.vx *= dampFactor;
            p.vy *= dampFactor;
          }
        }
      }

      // Integrate (using SUB_DT for stability)
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];

        // Gravity
        if (gravityOn) {
          p.ay += GRAVITY_STRENGTH;
        }

        // Update velocity
        p.vx += p.ax * SUB_DT;
        p.vy += p.ay * SUB_DT;

        // Berendsen thermostat (per substep, scaled coupling)
        var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0.01) {
          var ratio = targetSpeed / speed;
          // Emergency brake: if way over target, use much stronger coupling
          var effCoupling = (speed > targetSpeed * 2) ? 0.3 : coupling;
          var scale = 1 + (ratio - 1) * effCoupling;
          p.vx *= scale;
          p.vy *= scale;
        }

        // Phase-specific speed caps
        if (phase === "solid") {
          var maxSolidSpeed = targetSpeed * 1.2;
          var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (sp > maxSolidSpeed) {
            p.vx *= maxSolidSpeed / sp;
            p.vy *= maxSolidSpeed / sp;
          }
        } else {
          // Global cap for liquid/gas
          var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (sp > globalMaxSpeed) {
            p.vx *= globalMaxSpeed / sp;
            p.vy *= globalMaxSpeed / sp;
          }
        }

        // Update position
        p.x += p.vx * SUB_DT;
        p.y += p.vy * SUB_DT;

        // Wall collisions
        if (p.x - particleR < c.x) {
          p.x = c.x + particleR;
          p.vx = Math.abs(p.vx) * 0.8;
          wallHits++;
        }
        if (p.x + particleR > c.x + c.w) {
          p.x = c.x + c.w - particleR;
          p.vx = -Math.abs(p.vx) * 0.8;
          wallHits++;
        }
        if (p.y - particleR < c.y) {
          p.y = c.y + particleR;
          p.vy = Math.abs(p.vy) * 0.8;
          wallHits++;
        }
        if (p.y + particleR > c.y + c.h) {
          p.y = c.y + c.h - particleR;
          p.vy = -Math.abs(p.vy) * 0.8;
          wallHits++;
        }
      }
    } /* end substep loop */

    // Record trail position (once per frame, not per substep)
    var maxTrailDist2 = sig * sig * 4; // max trail segment length squared
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.trail) p.trail = [];
      // If particle jumped too far, clear trail to avoid streaks
      if (p.trail.length > 0) {
        var last = p.trail[p.trail.length - 1];
        var tdx = p.x - last.x;
        var tdy = p.y - last.y;
        if (tdx * tdx + tdy * tdy > maxTrailDist2) {
          p.trail = [];
        }
      }
      p.trail.push({ x: p.x, y: p.y });
      var maxTrail = phase === "solid" ? 3 : phase === "liquid" ? 4 : 5;
      while (p.trail.length > maxTrail) {
        p.trail.shift();
      }
    }

    // Pressure calculation
    var now = performance.now();
    if (now - lastPressureTime > 500) {
      var dt = (now - lastPressureTime) / 1000;
      var perimeter = 2 * (c.w + c.h);
      pressure = (wallHits / dt) * s.mass * 0.1 / Math.max(perimeter, 1);
      wallHits = 0;
      lastPressureTime = now;
    }
  }

  /* ---------- Colour helpers ---------- */
  function hexToRgba(hex, alpha) {
    if (hex.startsWith("rgba")) {
      return hex.replace(/,\s*[\d.]+\)$/, "," + alpha + ")");
    }
    if (hex.startsWith("rgb(")) {
      return hex.replace("rgb(", "rgba(").replace(")", "," + alpha + ")");
    }
    var r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function speedToTier(t) {
    // t in [0,1]
    if (t < 0.25) return "rgba(59,130,246,1)";   // blue - slow
    if (t < 0.5)  return "rgba(6,214,160,1)";    // green - medium
    if (t < 0.75) return "rgba(245,158,11,1)";   // yellow - fast
    return "rgba(239,71,111,1)";                   // red - very fast
  }

  function getParticleColour(p, maxSpeed, s) {
    if (colourMode === "uniform") return s.color;
    var speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    var t = Math.min(speed / Math.max(maxSpeed, 0.1), 1);
    if (colourMode === "energy") {
      // KE proportional to v^2
      var ke = t * t;
      return speedToTier(ke);
    }
    return speedToTier(t);
  }

  /* ---------- Drawing ---------- */
  function draw() {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    var c = getContainer();
    var s = substance();
    var phase = currentPhase();
    var sig = s.sigma;
    var particleR = sig * 0.4;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, w, h);

    // Container fill
    ctx.fillStyle = "rgba(30,40,80,0.3)";
    ctx.fillRect(c.x, c.y, c.w, c.h);

    // Container border
    ctx.strokeStyle = WALL_COLOUR;
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);

    // Bond lines for SOLID phase - thick, opaque, crystal-like
    if (phase === "solid") {
      var bondDist = sig * 1.4;
      var bondDist2 = bondDist * bondDist;
      ctx.strokeStyle = "rgba(180,200,255,0.6)";
      ctx.lineWidth = 1.8;

      for (var i = 0; i < particles.length; i++) {
        var pi = particles[i];
        var col = Math.floor((pi.x - c.x) / hashCellSize);
        var row = Math.floor((pi.y - c.y) / hashCellSize);
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            var key = (row + dr) * hashCols + (col + dc);
            var bucket = hashMap.get(key);
            if (!bucket) continue;
            for (var k = 0; k < bucket.length; k++) {
              var j = bucket[k];
              if (j <= i) continue;
              var pj = particles[j];
              var dx = pj.x - pi.x;
              var dy = pj.y - pi.y;
              if (dx * dx + dy * dy < bondDist2) {
                ctx.beginPath();
                ctx.moveTo(pi.x, pi.y);
                ctx.lineTo(pj.x, pj.y);
                ctx.stroke();
              }
            }
          }
        }
      }
    }

    // Bond lines for LIQUID phase - faint, between nearby particles
    if (phase === "liquid") {
      var bondDist = sig * 1.3;
      var bondDist2 = bondDist * bondDist;
      ctx.strokeStyle = "rgba(100,180,255,0.15)";
      ctx.lineWidth = 0.7;

      for (var i = 0; i < particles.length; i++) {
        var pi = particles[i];
        var col = Math.floor((pi.x - c.x) / hashCellSize);
        var row = Math.floor((pi.y - c.y) / hashCellSize);
        for (var dr = -1; dr <= 1; dr++) {
          for (var dc = -1; dc <= 1; dc++) {
            var key = (row + dr) * hashCols + (col + dc);
            var bucket = hashMap.get(key);
            if (!bucket) continue;
            for (var k = 0; k < bucket.length; k++) {
              var j = bucket[k];
              if (j <= i) continue;
              var pj = particles[j];
              var dx = pj.x - pi.x;
              var dy = pj.y - pi.y;
              if (dx * dx + dy * dy < bondDist2) {
                ctx.beginPath();
                ctx.moveTo(pi.x, pi.y);
                ctx.lineTo(pj.x, pj.y);
                ctx.stroke();
              }
            }
          }
        }
      }
    }

    // Particles
    var maxSpeed = speedFromTemp() * 2.5;
    var glowExtra = phase === "gas" ? 5 : phase === "liquid" ? 3 : 2;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var colour = getParticleColour(p, maxSpeed, s);

      // Velocity trail
      if (p.trail && p.trail.length > 1) {
        var trailLen = p.trail.length;
        for (var t = 1; t < trailLen; t++) {
          var alpha = (t / trailLen) * 0.3;
          ctx.beginPath();
          ctx.moveTo(p.trail[t - 1].x, p.trail[t - 1].y);
          ctx.lineTo(p.trail[t].x, p.trail[t].y);
          ctx.strokeStyle = hexToRgba(colour, alpha);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Glow
      var gradient = ctx.createRadialGradient(p.x, p.y, particleR * 0.3, p.x, p.y, particleR + glowExtra);
      gradient.addColorStop(0, hexToRgba(colour, 0.4));
      gradient.addColorStop(1, hexToRgba(colour, 0));
      ctx.beginPath();
      ctx.arc(p.x, p.y, particleR + glowExtra, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(p.x, p.y, particleR, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
    }

    updateReadouts();
  }

  /* ---------- Readouts ---------- */
  function updateReadouts() {
    readPressure.textContent = pressure.toFixed(1) + " au";

    var totalSpeed = 0;
    var totalKE = 0;
    var m = substance().mass;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      totalSpeed += sp;
      totalKE += 0.5 * m * sp * sp;
    }
    var n = particles.length || 1;
    readSpeed.textContent = (totalSpeed / n).toFixed(1) + " u/s";
    readKE.textContent = (totalKE / n).toFixed(1) + " au";

    var s = substance();
    var phase = currentPhase();
    if (phase === "solid") {
      readPhase.textContent = "Solid (below " + s.melt + " K)";
    } else if (phase === "liquid") {
      readPhase.textContent = "Liquid (" + s.melt + "\u2013" + s.boil + " K)";
    } else {
      readPhase.textContent = "Gas (above " + s.boil + " K)";
    }
  }

  /* ---------- Speed distribution chart ---------- */
  function drawDistribution() {
    var dpr = window.devicePixelRatio || 1;
    var cw = distCanvas.width / dpr;
    var ch = distCanvas.height / dpr;
    distCtx.clearRect(0, 0, cw, ch);

    distCtx.fillStyle = getComputedStyle(document.body).getPropertyValue("--color-surface-alt") || "#f5f5f5";
    distCtx.fillRect(0, 0, cw, ch);

    if (particles.length === 0) return;

    var speeds = [];
    var maxSpeedVal = 1;
    for (var i = 0; i < particles.length; i++) {
      var sp = Math.sqrt(particles[i].vx * particles[i].vx + particles[i].vy * particles[i].vy);
      speeds.push(sp);
      if (sp > maxSpeedVal) maxSpeedVal = sp;
    }

    var bins = 20;
    var binWidth = maxSpeedVal / bins;
    var hist = new Array(bins).fill(0);
    for (var i = 0; i < speeds.length; i++) {
      var idx = Math.min(Math.floor(speeds[i] / binWidth), bins - 1);
      hist[idx]++;
    }
    var maxCount = 1;
    for (var i = 0; i < bins; i++) {
      if (hist[i] > maxCount) maxCount = hist[i];
    }

    var margin = { top: 10, right: 10, bottom: 25, left: 10 };
    var plotW = cw - margin.left - margin.right;
    var plotH = ch - margin.top - margin.bottom;
    var barW = plotW / bins;

    for (var i = 0; i < bins; i++) {
      var barH = (hist[i] / maxCount) * plotH;
      var x = margin.left + i * barW;
      var y = margin.top + plotH - barH;
      var t = i / bins;
      if (t < 0.25) {
        distCtx.fillStyle = "rgba(59,130,246,0.6)";
      } else if (t < 0.5) {
        distCtx.fillStyle = "rgba(6,214,160,0.6)";
      } else if (t < 0.75) {
        distCtx.fillStyle = "rgba(245,158,11,0.6)";
      } else {
        distCtx.fillStyle = "rgba(239,71,111,0.6)";
      }
      distCtx.fillRect(x, y, barW - 1, barH);
    }

    // Theoretical Maxwell-Boltzmann curve (2D)
    var m = substance().mass;
    var kT = temperature * 0.01;
    distCtx.beginPath();
    distCtx.strokeStyle = "rgba(255,255,255,0.5)";
    distCtx.lineWidth = 1.5;
    distCtx.setLineDash([4, 3]);

    var mbMax = 0;
    var mbPoints = [];
    for (var i = 0; i <= 100; i++) {
      var v = (i / 100) * maxSpeedVal;
      var fv = (m / kT) * v * Math.exp(-m * v * v / (2 * kT));
      mbPoints.push(fv);
      if (fv > mbMax) mbMax = fv;
    }
    for (var i = 0; i <= 100; i++) {
      var x = margin.left + (i / 100) * plotW;
      var y = margin.top + plotH - (mbPoints[i] / Math.max(mbMax, 0.001)) * plotH * 0.9;
      if (i === 0) {
        distCtx.moveTo(x, y);
      } else {
        distCtx.lineTo(x, y);
      }
    }
    distCtx.stroke();
    distCtx.setLineDash([]);

    // Labels
    distCtx.fillStyle = "rgba(150,150,150,0.7)";
    distCtx.font = "9px Inter, sans-serif";
    distCtx.textAlign = "center";
    distCtx.fillText("Speed \u2192", cw / 2, ch - 3);
    distCtx.textAlign = "left";
    distCtx.fillText("Count", 2, margin.top + 8);
  }

  /* ---------- Phase transition handling ---------- */
  function handlePhaseChange() {
    var phase = currentPhase();
    if (lastPhase !== null && lastPhase !== phase) {
      if (phase === "solid") {
        // Transitioning INTO solid: reinitialize as lattice
        initParticles();
      } else if (lastPhase === "solid" && (phase === "liquid" || phase === "gas")) {
        // MELTING: leaving solid -> delete equilibrium, let particles flow
        var speed = speedFromTemp();
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          delete p.eqX;
          delete p.eqY;
          var angle = Math.random() * Math.PI * 2;
          var vMag = speed * (0.5 + Math.random() * 0.5);
          p.vx = Math.cos(angle) * vMag;
          p.vy = Math.sin(angle) * vMag;
          p.trail = []; // clear trails on transition
        }
      } else if (lastPhase === "liquid" && phase === "gas") {
        // BOILING: spread particles apart (capped to prevent runaway)
        var c = getContainer();
        var speed = speedFromTemp();
        var maxTransSpeed = speed * 2.5; // hard cap on transition velocity
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          var cx = c.x + c.w / 2;
          var cy = c.y + c.h / 2;
          var dx = p.x - cx;
          var dy = p.y - cy;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          var pushSpeed = speed * 1.2;
          p.vx = (dx / dist) * pushSpeed + (Math.random() - 0.5) * speed * 0.5;
          p.vy = (dy / dist) * pushSpeed + (Math.random() - 0.5) * speed * 0.5;
          // Cap resulting speed
          var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (sp > maxTransSpeed) {
            p.vx *= maxTransSpeed / sp;
            p.vy *= maxTransSpeed / sp;
          }
          p.trail = []; // clear trails on transition
        }
      } else if (lastPhase === "gas" && phase === "liquid") {
        // CONDENSING: bring particles closer together
        var c = getContainer();
        var cx = c.x + c.w / 2;
        var cy = c.y + c.h / 2;
        var speed = speedFromTemp();
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          var dx = cx - p.x;
          var dy = cy - p.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          p.vx = (dx / dist) * speed * 0.5 + (Math.random() - 0.5) * speed * 0.3;
          p.vy = (dy / dist) * speed * 0.5 + (Math.random() - 0.5) * speed * 0.3;
          p.trail = []; // clear trails on transition
        }
      }
    }
    lastPhase = phase;
  }

  /* ---------- Adjust particle count ---------- */
  function adjustParticleCount() {
    var c = getContainer();
    if (currentPhase() === "solid") {
      initParticles();
      return;
    }
    while (particles.length < targetCount) {
      if (currentPhase() === "liquid") {
        // Add near existing particles for cohesion
        var existing = particles.length > 0 ? particles[Math.floor(Math.random() * particles.length)] : null;
        var np = createParticle(c);
        if (existing) {
          var sig = substance().sigma;
          np.x = existing.x + (Math.random() - 0.5) * sig * 2;
          np.y = existing.y + (Math.random() - 0.5) * sig * 2;
          np.x = Math.max(c.x + sig * 0.4, Math.min(c.x + c.w - sig * 0.4, np.x));
          np.y = Math.max(c.y + sig * 0.4, Math.min(c.y + c.h - sig * 0.4, np.y));
        }
        particles.push(np);
      } else {
        particles.push(createParticle(c));
      }
    }
    while (particles.length > targetCount) {
      particles.pop();
    }
  }

  /* ---------- Clamp particles to container ---------- */
  function clampParticlesToContainer() {
    var c = getContainer();
    var s = substance();
    var r = s.sigma * 0.4;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x = Math.max(c.x + r, Math.min(c.x + c.w - r, p.x));
      p.y = Math.max(c.y + r, Math.min(c.y + c.h - r, p.y));
      // Also update equilibrium positions if in solid
      if (p.eqX !== undefined) {
        p.eqX = Math.max(c.x + r, Math.min(c.x + c.w - r, p.eqX));
        p.eqY = Math.max(c.y + r, Math.min(c.y + c.h - r, p.eqY));
      }
    }
  }

  /* ---------- Controls ---------- */
  sliderTemp.addEventListener("input", function () {
    temperature = parseInt(sliderTemp.value);
    tempValue.textContent = temperature;
    handlePhaseChange();
  });

  sliderCount.addEventListener("input", function () {
    targetCount = parseInt(sliderCount.value);
    countValue.textContent = targetCount;
    adjustParticleCount();
  });

  sliderSize.addEventListener("input", function () {
    containerPct = parseInt(sliderSize.value);
    sizeValue.textContent = containerPct;
    clampParticlesToContainer();
  });

  // Map substance radio values to indices
  var substanceNameMap = {};
  for (var i = 0; i < SUBSTANCES.length; i++) {
    substanceNameMap[SUBSTANCES[i].name] = i;
  }

  document.querySelectorAll('input[name="substance"]').forEach(function (r) {
    r.addEventListener("change", function () {
      substanceIdx = substanceNameMap[r.value] != null ? substanceNameMap[r.value] : 4;
      var s = substance();
      temperature = Math.round((s.melt + s.boil) / 2);
      updateTempSlider();
      lastPhase = null;
      initParticles();
    });
  });

  document.querySelectorAll('input[name="colour"]').forEach(function (r) {
    r.addEventListener("change", function () {
      colourMode = r.value;
    });
  });

  document.getElementById("toggle-gravity").addEventListener("change", function () {
    gravityOn = this.checked;
  });

  btnPlay.addEventListener("click", function () {
    running = !running;
    btnPlay.textContent = running ? "Pause" : "Play";
    if (running) loop();
  });

  btnReset.addEventListener("click", function () {
    var s = substance();
    temperature = Math.round((s.melt + s.boil) / 2);
    updateTempSlider();
    targetCount = 80;
    sliderCount.value = 80;
    countValue.textContent = 80;
    containerPct = 100;
    sliderSize.value = 100;
    sizeValue.textContent = 100;
    gravityOn = false;
    document.getElementById("toggle-gravity").checked = false;
    lastPhase = null;
    initParticles();
  });

  /* ---------- Canvas sizing ---------- */
  function resizeCanvas() {
    var wrap = canvas.parentElement;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = wrap.clientWidth * dpr;
    canvas.height = wrap.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var distWrap = distCanvas.parentElement;
    distCanvas.width = distWrap.clientWidth * dpr;
    distCanvas.height = 160 * dpr;
    distCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  /* ---------- Animation loop ---------- */
  var distTimer = 0;

  function loop() {
    if (!running) return;
    step();
    draw();
    distTimer++;
    if (distTimer % 10 === 0) drawDistribution();
    animFrameId = requestAnimationFrame(loop);
  }

  /* ---------- Init ---------- */
  updateTempSlider();
  temperature = Math.round((substance().melt + substance().boil) / 2);
  updateTempSlider();
  lastPhase = currentPhase();
  initParticles();
  loop();

})();
