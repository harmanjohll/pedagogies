/* ======================================================
   Particle Dynamics – SciSim Interactive
   2D gas particle simulation with temperature, pressure,
   phase transitions, and Maxwell-Boltzmann distribution
   ====================================================== */

(function () {
  "use strict";

  /* ---------- Constants ---------- */
  const PARTICLE_RADIUS = 4;
  const BOLTZMANN = 1.38e-23;
  const MASS_MAP = { light: 2, medium: 32, heavy: 131 };  // AMU-like
  const WALL_COLOUR = "rgba(100,140,255,0.4)";
  const GRAVITY_STRENGTH = 0.08;

  /* ---------- State ---------- */
  let particles = [];
  let running = true;
  let temperature = 300;
  let targetCount = 80;
  let containerPct = 100;
  let massType = "light";
  let gravityOn = false;
  let colourMode = "speed";
  let wallHits = 0;        // for pressure calc
  let lastPressureTime = 0;
  let pressure = 0;
  let animFrameId;

  /* ---------- DOM ---------- */
  const canvas = document.getElementById("sim-canvas");
  const ctx = canvas.getContext("2d");
  const distCanvas = document.getElementById("dist-canvas");
  const distCtx = distCanvas.getContext("2d");

  const sliderTemp = document.getElementById("slider-temp");
  const sliderCount = document.getElementById("slider-count");
  const sliderSize = document.getElementById("slider-size");
  const tempValue = document.getElementById("temp-value");
  const countValue = document.getElementById("count-value");
  const sizeValue = document.getElementById("size-value");
  const readPressure = document.getElementById("read-pressure");
  const readSpeed = document.getElementById("read-speed");
  const readKE = document.getElementById("read-ke");
  const readPhase = document.getElementById("read-phase");
  const btnPlay = document.getElementById("btn-play");
  const btnReset = document.getElementById("btn-reset");

  /* ---------- Container geometry ---------- */
  function getContainer() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cw = w * containerPct / 100;
    const ch = h * containerPct / 100;
    return {
      x: (w - cw) / 2,
      y: (h - ch) / 2,
      w: cw,
      h: ch
    };
  }

  /* ---------- Particle creation ---------- */
  function massValue() { return MASS_MAP[massType]; }

  function speedFromTemp() {
    // RMS speed scaled for visual: sqrt(3kT/m) but we use a visual scale
    return Math.sqrt(temperature / massValue()) * 2.5;
  }

  function createParticle() {
    const c = getContainer();
    const speed = speedFromTemp();
    const angle = Math.random() * Math.PI * 2;
    // Add random variation to speed (Maxwell-Boltzmann-like)
    const factor = 0.3 + Math.random() * 1.4;
    return {
      x: c.x + PARTICLE_RADIUS + Math.random() * (c.w - 2 * PARTICLE_RADIUS),
      y: c.y + PARTICLE_RADIUS + Math.random() * (c.h - 2 * PARTICLE_RADIUS),
      vx: Math.cos(angle) * speed * factor,
      vy: Math.sin(angle) * speed * factor,
    };
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < targetCount; i++) {
      particles.push(createParticle());
    }
    wallHits = 0;
    pressure = 0;
    lastPressureTime = performance.now();
  }

  /* ---------- Physics step ---------- */
  function step() {
    const c = getContainer();
    const m = massValue();
    const targetSpeed = speedFromTemp();

    for (const p of particles) {
      // Gravity
      if (gravityOn) {
        p.vy += GRAVITY_STRENGTH;
      }

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Thermostat: gently nudge speeds toward target (Berendsen-like)
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 0.01) {
        const ratio = targetSpeed / speed;
        const coupling = 0.02;
        const scale = 1 + (ratio - 1) * coupling;
        p.vx *= scale;
        p.vy *= scale;
      }

      // Wall collisions
      if (p.x - PARTICLE_RADIUS < c.x) {
        p.x = c.x + PARTICLE_RADIUS;
        p.vx = Math.abs(p.vx);
        wallHits++;
      }
      if (p.x + PARTICLE_RADIUS > c.x + c.w) {
        p.x = c.x + c.w - PARTICLE_RADIUS;
        p.vx = -Math.abs(p.vx);
        wallHits++;
      }
      if (p.y - PARTICLE_RADIUS < c.y) {
        p.y = c.y + PARTICLE_RADIUS;
        p.vy = Math.abs(p.vy);
        wallHits++;
      }
      if (p.y + PARTICLE_RADIUS > c.y + c.h) {
        p.y = c.y + c.h - PARTICLE_RADIUS;
        p.vy = -Math.abs(p.vy);
        wallHits++;
      }
    }

    // Particle-particle collisions (elastic)
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = PARTICLE_RADIUS * 2;
        if (dist < minDist && dist > 0) {
          // Elastic collision (equal mass)
          const nx = dx / dist, ny = dy / dist;
          const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
          const dvn = dvx * nx + dvy * ny;
          if (dvn > 0) {
            a.vx -= dvn * nx;
            a.vy -= dvn * ny;
            b.vx += dvn * nx;
            b.vy += dvn * ny;
          }
          // Separate
          const overlap = (minDist - dist) / 2;
          a.x -= overlap * nx;
          a.y -= overlap * ny;
          b.x += overlap * nx;
          b.y += overlap * ny;
        }
      }
    }

    // Pressure calculation (wall hits per unit time per unit perimeter)
    const now = performance.now();
    if (now - lastPressureTime > 500) {
      const dt = (now - lastPressureTime) / 1000;
      const perimeter = 2 * (c.w + c.h);
      pressure = (wallHits / dt) * m * 0.1 / Math.max(perimeter, 1);
      wallHits = 0;
      lastPressureTime = now;
    }
  }

  /* ---------- Drawing ---------- */
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const c = getContainer();

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, w, h);

    // Container walls
    ctx.strokeStyle = WALL_COLOUR;
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);

    // Subtle container fill
    ctx.fillStyle = "rgba(30,40,80,0.3)";
    ctx.fillRect(c.x, c.y, c.w, c.h);

    // Particles
    const maxSpeed = speedFromTemp() * 2.5;
    for (const p of particles) {
      const speed = Math.hypot(p.vx, p.vy);
      const colour = getParticleColour(speed, maxSpeed);

      // Glow
      ctx.beginPath();
      ctx.arc(p.x, p.y, PARTICLE_RADIUS + 3, 0, Math.PI * 2);
      ctx.fillStyle = colour.replace("1)", "0.15)");
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(p.x, p.y, PARTICLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();

      // Velocity trail
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 1.5, p.y - p.vy * 1.5);
      ctx.strokeStyle = colour.replace("1)", "0.25)");
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Update readouts
    updateReadouts();
  }

  function getParticleColour(speed, maxSpeed) {
    if (colourMode === "uniform") return "rgba(100,180,255,1)";
    const t = Math.min(speed / Math.max(maxSpeed, 0.1), 1);
    if (colourMode === "energy") {
      // KE is proportional to v^2
      const ke = t * t;
      if (ke < 0.25) return "rgba(59,130,246,1)";
      if (ke < 0.5) return "rgba(6,214,160,1)";
      if (ke < 0.75) return "rgba(245,158,11,1)";
      return "rgba(239,71,111,1)";
    }
    // Speed mode
    if (t < 0.25) return "rgba(59,130,246,1)";
    if (t < 0.5) return "rgba(6,214,160,1)";
    if (t < 0.75) return "rgba(245,158,11,1)";
    return "rgba(239,71,111,1)";
  }

  /* ---------- Readouts ---------- */
  function updateReadouts() {
    readPressure.textContent = pressure.toFixed(1) + " au";

    let totalSpeed = 0, totalKE = 0;
    const m = massValue();
    for (const p of particles) {
      const s = Math.hypot(p.vx, p.vy);
      totalSpeed += s;
      totalKE += 0.5 * m * s * s;
    }
    const n = particles.length || 1;
    readSpeed.textContent = (totalSpeed / n).toFixed(1) + " u/s";
    readKE.textContent = (totalKE / n).toFixed(1) + " au";

    // Phase estimation
    if (temperature < 80) readPhase.textContent = "Solid";
    else if (temperature < 200) readPhase.textContent = "Liquid";
    else readPhase.textContent = "Gas";
  }

  /* ---------- Speed distribution chart ---------- */
  function drawDistribution() {
    const dpr = window.devicePixelRatio || 1;
    const cw = distCanvas.width;
    const ch = distCanvas.height;
    distCtx.clearRect(0, 0, cw, ch);

    // Background
    distCtx.fillStyle = getComputedStyle(document.body).getPropertyValue("--color-surface-alt") || "#f5f5f5";
    distCtx.fillRect(0, 0, cw, ch);

    if (particles.length === 0) return;

    // Collect speeds
    const speeds = particles.map(p => Math.hypot(p.vx, p.vy));
    const maxSpeed = Math.max(...speeds, 1);
    const bins = 20;
    const binWidth = maxSpeed / bins;
    const hist = new Array(bins).fill(0);

    for (const s of speeds) {
      const idx = Math.min(Math.floor(s / binWidth), bins - 1);
      hist[idx]++;
    }
    const maxCount = Math.max(...hist, 1);

    // Draw histogram bars
    const margin = { top: 10, right: 10, bottom: 25, left: 10 };
    const plotW = cw - margin.left - margin.right;
    const plotH = ch - margin.top - margin.bottom;
    const barW = plotW / bins;

    for (let i = 0; i < bins; i++) {
      const barH = (hist[i] / maxCount) * plotH;
      const x = margin.left + i * barW;
      const y = margin.top + plotH - barH;
      const t = i / bins;

      distCtx.fillStyle = t < 0.25 ? "rgba(59,130,246,0.6)"
        : t < 0.5 ? "rgba(6,214,160,0.6)"
        : t < 0.75 ? "rgba(245,158,11,0.6)"
        : "rgba(239,71,111,0.6)";
      distCtx.fillRect(x, y, barW - 1, barH);
    }

    // Draw theoretical Maxwell-Boltzmann curve (2D: f(v) = (m/kT) * v * exp(-mv²/2kT))
    const m = massValue();
    const kT = temperature * 0.01; // scaled
    distCtx.beginPath();
    distCtx.strokeStyle = "rgba(255,255,255,0.5)";
    distCtx.lineWidth = 1.5;
    distCtx.setLineDash([4, 3]);

    let mbMax = 0;
    const mbPoints = [];
    for (let i = 0; i <= 100; i++) {
      const v = (i / 100) * maxSpeed;
      const fv = (m / kT) * v * Math.exp(-m * v * v / (2 * kT));
      mbPoints.push(fv);
      if (fv > mbMax) mbMax = fv;
    }

    for (let i = 0; i <= 100; i++) {
      const x = margin.left + (i / 100) * plotW;
      const y = margin.top + plotH - (mbPoints[i] / Math.max(mbMax, 0.001)) * plotH * 0.9;
      if (i === 0) distCtx.moveTo(x, y);
      else distCtx.lineTo(x, y);
    }
    distCtx.stroke();
    distCtx.setLineDash([]);

    // Axis labels
    distCtx.fillStyle = "rgba(150,150,150,0.7)";
    distCtx.font = "9px Inter, sans-serif";
    distCtx.textAlign = "center";
    distCtx.fillText("Speed →", cw / 2, ch - 3);
    distCtx.textAlign = "left";
    distCtx.fillText("Count", 2, margin.top + 8);
  }

  /* ---------- Controls ---------- */
  sliderTemp.addEventListener("input", () => {
    temperature = parseInt(sliderTemp.value);
    tempValue.textContent = temperature;
  });
  sliderCount.addEventListener("input", () => {
    targetCount = parseInt(sliderCount.value);
    countValue.textContent = targetCount;
    adjustParticleCount();
  });
  sliderSize.addEventListener("input", () => {
    containerPct = parseInt(sliderSize.value);
    sizeValue.textContent = containerPct;
    clampParticlesToContainer();
  });

  document.querySelectorAll('input[name="mass"]').forEach(r => {
    r.addEventListener("change", () => { massType = r.value; });
  });
  document.querySelectorAll('input[name="colour"]').forEach(r => {
    r.addEventListener("change", () => { colourMode = r.value; });
  });
  document.getElementById("toggle-gravity").addEventListener("change", function () {
    gravityOn = this.checked;
  });

  btnPlay.addEventListener("click", () => {
    running = !running;
    btnPlay.textContent = running ? "Pause" : "Play";
    if (running) loop();
  });
  btnReset.addEventListener("click", () => {
    temperature = 300; sliderTemp.value = 300; tempValue.textContent = 300;
    targetCount = 80; sliderCount.value = 80; countValue.textContent = 80;
    containerPct = 100; sliderSize.value = 100; sizeValue.textContent = 100;
    massType = "light";
    document.querySelector('input[name="mass"][value="light"]').checked = true;
    gravityOn = false;
    document.getElementById("toggle-gravity").checked = false;
    initParticles();
  });

  function adjustParticleCount() {
    while (particles.length < targetCount) {
      particles.push(createParticle());
    }
    while (particles.length > targetCount) {
      particles.pop();
    }
  }

  function clampParticlesToContainer() {
    const c = getContainer();
    for (const p of particles) {
      p.x = Math.max(c.x + PARTICLE_RADIUS, Math.min(c.x + c.w - PARTICLE_RADIUS, p.x));
      p.y = Math.max(c.y + PARTICLE_RADIUS, Math.min(c.y + c.h - PARTICLE_RADIUS, p.y));
    }
  }

  /* ---------- Canvas sizing ---------- */
  function resizeCanvas() {
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = wrap.clientWidth * dpr;
    canvas.height = wrap.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Also resize dist canvas
    const distWrap = distCanvas.parentElement;
    distCanvas.width = distWrap.clientWidth * dpr;
    distCanvas.height = 160 * dpr;
    distCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  /* ---------- Animation loop ---------- */
  let distTimer = 0;
  function loop() {
    if (!running) return;

    step();
    draw();

    // Update distribution less frequently
    distTimer++;
    if (distTimer % 10 === 0) drawDistribution();

    animFrameId = requestAnimationFrame(loop);
  }

  /* ---------- Init ---------- */
  initParticles();
  loop();

})();
