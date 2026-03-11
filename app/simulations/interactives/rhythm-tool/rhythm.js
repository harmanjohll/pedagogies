/*
 * Rhythm & Percussion Interactive
 * ================================
 * Beat grid sequencer with Web Audio API playback.
 * Body percussion + drum kit sounds.
 */

(function () {
  'use strict';

  // ── Sound definitions ──
  const SOUNDS = [
    { id: 'kick',  label: 'Bass Drum', icon: '🥁', color: '#ef4444', freq: 60, type: 'drum' },
    { id: 'snare', label: 'Snare',     icon: '🪘', color: '#f59e0b', freq: 200, type: 'drum' },
    { id: 'hihat', label: 'Hi-Hat',    icon: '🔔', color: '#22c55e', freq: 800, type: 'drum' },
    { id: 'clap',  label: 'Clap',      icon: '👏', color: '#3b82f6', freq: 400, type: 'body' },
    { id: 'stamp', label: 'Stamp',     icon: '🦶', color: '#8b5cf6', freq: 80,  type: 'body' },
    { id: 'snap',  label: 'Snap',      icon: '🤌', color: '#ec4899', freq: 1200, type: 'body' },
    { id: 'pat',   label: 'Pat (Lap)', icon: '🫳', color: '#06b6d4', freq: 300, type: 'body' },
    // Piano / Keys — one octave (C4–B4) + high C
    { id: 'C4',  label: 'C4',  icon: '🎹', color: '#ffd93d', freq: 261.63, type: 'keys' },
    { id: 'D4',  label: 'D4',  icon: '🎹', color: '#ffb347', freq: 293.66, type: 'keys' },
    { id: 'E4',  label: 'E4',  icon: '🎹', color: '#ff6b6b', freq: 329.63, type: 'keys' },
    { id: 'F4',  label: 'F4',  icon: '🎹', color: '#c084fc', freq: 349.23, type: 'keys' },
    { id: 'G4',  label: 'G4',  icon: '🎹', color: '#67e8f9', freq: 392.00, type: 'keys' },
    { id: 'A4',  label: 'A4',  icon: '🎹', color: '#86efac', freq: 440.00, type: 'keys' },
    { id: 'B4',  label: 'B4',  icon: '🎹', color: '#fca5a5', freq: 493.88, type: 'keys' },
    { id: 'C5',  label: 'C5',  icon: '🎹', color: '#fde68a', freq: 523.25, type: 'keys' },
  ];

  // Voice: organ, piano, or pad
  let keyVoice = 'piano'; // 'piano' | 'organ' | 'pad'

  // ── State ──
  let bpm = 100;
  let beatsPerBar = 4;
  let numBars = 4;
  let totalSteps = beatsPerBar * numBars;
  let grid = {}; // { soundId: [bool, bool, ...] }
  let playing = false;
  let currentStep = -1;
  let intervalId = null;
  let audioCtx = null;

  function initGrid() {
    grid = {};
    SOUNDS.forEach(s => {
      grid[s.id] = new Array(totalSteps).fill(false);
    });
  }

  // ── Audio ──
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playSound(sound) {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;

    if (sound.id === 'kick') {
      // Bass drum: low osc with pitch envelope
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (sound.id === 'snare') {
      // Snare: noise burst + tone
      const bufSize = ctx.sampleRate * 0.1;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;
      noise.connect(filter).connect(noiseGain).connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.12);
      // Tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, t);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    } else if (sound.id === 'hihat') {
      // Hi-hat: filtered noise
      const bufSize = ctx.sampleRate * 0.05;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      noise.connect(hp).connect(gain).connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.05);
    } else if (sound.id === 'clap') {
      // Clap: multiple noise bursts
      for (let n = 0; n < 3; n++) {
        const delay = n * 0.01;
        const bufSize = ctx.sampleRate * 0.04;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5, t + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.06);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2000;
        noise.connect(bp).connect(gain).connect(ctx.destination);
        noise.start(t + delay);
        noise.stop(t + delay + 0.06);
      }
    } else if (sound.id === 'stamp') {
      // Stamp: low thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } else if (sound.id === 'snap') {
      // Snap: high click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.03);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    } else if (sound.id === 'pat') {
      // Pat: muffled tap
      const bufSize = ctx.sampleRate * 0.06;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800;
      noise.connect(lp).connect(gain).connect(ctx.destination);
      noise.start(t);
      noise.stop(t + 0.08);
    } else if (sound.type === 'keys') {
      // Piano / Organ / Pad synthesis
      const freq = sound.freq;
      if (keyVoice === 'piano') {
        // Piano: sharp attack, fast decay
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc2.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc2.frequency.setValueAtTime(freq * 2, t); // overtone
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.15, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc2.connect(gain);
        osc.start(t); osc2.start(t);
        osc.stop(t + 0.5); osc2.stop(t + 0.5);
      } else if (keyVoice === 'organ') {
        // Organ: sustained, rich harmonics
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc2.type = 'sine';
        osc3.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc2.frequency.setValueAtTime(freq * 2, t);
        osc3.frequency.setValueAtTime(freq * 3, t);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.setValueAtTime(0.2, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc2.connect(gain);
        osc3.connect(gain);
        osc.start(t); osc2.start(t); osc3.start(t);
        osc.stop(t + 0.6); osc2.stop(t + 0.6); osc3.stop(t + 0.6);
      } else if (keyVoice === 'pad') {
        // Pad: slow attack, long sustain, warm
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2000;
        osc.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc2.frequency.setValueAtTime(freq * 1.005, t); // slight detune for warmth
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);
        osc.connect(lp);
        osc2.connect(lp);
        lp.connect(gain).connect(ctx.destination);
        osc.start(t); osc2.start(t);
        osc.stop(t + 1.0); osc2.stop(t + 1.0);
      }
    }
  }

  // ── Build Grid UI ──
  function buildGrid() {
    totalSteps = beatsPerBar * numBars;
    const container = document.getElementById('rhythm-grid');
    container.innerHTML = '';

    let prevType = '';
    SOUNDS.forEach(sound => {
      // Ensure grid array is correct length
      if (!grid[sound.id] || grid[sound.id].length !== totalSteps) {
        const old = grid[sound.id] || [];
        grid[sound.id] = new Array(totalSteps).fill(false);
        for (let i = 0; i < Math.min(old.length, totalSteps); i++) grid[sound.id][i] = old[i];
      }

      // Group divider between percussion and keys
      if (sound.type === 'keys' && prevType !== 'keys') {
        const divider = document.createElement('div');
        divider.className = 'rhythm-group-divider';
        divider.innerHTML = '<span>Piano / Keys</span>';
        container.appendChild(divider);
      }
      prevType = sound.type;

      const row = document.createElement('div');
      row.className = 'rhythm-row';
      row.dataset.sound = sound.id;

      // Label
      const label = document.createElement('div');
      label.className = 'rhythm-row-label';
      label.innerHTML = `<span class="row-icon">${sound.icon}</span><span>${sound.label}</span>`;
      row.appendChild(label);

      // Cells
      for (let i = 0; i < totalSteps; i++) {
        const cell = document.createElement('div');
        cell.className = 'rhythm-cell ' + (grid[sound.id][i] ? 'on' : 'off');
        if (i % beatsPerBar === 0) cell.classList.add('beat-start');
        cell.dataset.step = i;
        cell.dataset.sound = sound.id;
        cell.addEventListener('click', () => toggleCell(sound.id, i, cell));
        row.appendChild(cell);
      }

      container.appendChild(row);
    });

    // Legend
    const legend = document.getElementById('rhythm-legend');
    legend.innerHTML = SOUNDS.map(s =>
      `<div class="legend-item"><div class="legend-swatch" style="background:${s.color};"></div>${s.icon} ${s.label} <span style="opacity:0.5;">(${s.type})</span></div>`
    ).join('');
  }

  function toggleCell(soundId, step, cell) {
    grid[soundId][step] = !grid[soundId][step];
    cell.classList.toggle('on');
    cell.classList.toggle('off');
    if (grid[soundId][step]) {
      const sound = SOUNDS.find(s => s.id === soundId);
      if (sound) playSound(sound);
    }
  }

  // ── Playback ──
  function startPlayback() {
    if (playing) return;
    playing = true;
    currentStep = -1;
    document.getElementById('play-icon').style.display = 'none';
    document.getElementById('pause-icon').style.display = '';

    const stepInterval = (60 / bpm / 1) * 1000; // quarter note = one beat column
    intervalId = setInterval(() => {
      // Remove old playhead
      document.querySelectorAll('.rhythm-cell.playhead').forEach(c => c.classList.remove('playhead'));

      currentStep = (currentStep + 1) % totalSteps;

      // Highlight current column
      document.querySelectorAll(`.rhythm-cell[data-step="${currentStep}"]`).forEach(c => c.classList.add('playhead'));

      // Play active sounds
      SOUNDS.forEach(sound => {
        if (grid[sound.id][currentStep]) {
          playSound(sound);
        }
      });
    }, stepInterval);
  }

  function stopPlayback() {
    playing = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    currentStep = -1;
    document.getElementById('play-icon').style.display = '';
    document.getElementById('pause-icon').style.display = 'none';
    document.querySelectorAll('.rhythm-cell.playhead').forEach(c => c.classList.remove('playhead'));
  }

  // ── Presets ──
  const PRESETS = {
    'basic-4': {
      bpm: 100, beatsPerBar: 4, numBars: 4,
      pattern: {
        kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
        snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
        hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
      }
    },
    'rock': {
      bpm: 120, beatsPerBar: 4, numBars: 4,
      pattern: {
        kick:  [1,0,0,0, 1,0,0,0, 1,0,0,1, 0,0,1,0],
        snare: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
        hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      }
    },
    'waltz': {
      bpm: 90, beatsPerBar: 3, numBars: 4,
      pattern: {
        kick:  [1,0,0, 1,0,0, 1,0,0, 1,0,0],
        snare: [0,1,1, 0,1,1, 0,1,1, 0,1,1],
        hihat: [1,1,1, 1,1,1, 1,1,1, 1,1,1],
      }
    },
    'samba': {
      bpm: 110, beatsPerBar: 4, numBars: 4,
      pattern: {
        kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
        snare: [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,1,0,0],
        hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
        clap:  [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      }
    },
    'body-percussion': {
      bpm: 90, beatsPerBar: 4, numBars: 4,
      pattern: {
        clap:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
        stamp: [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
        snap:  [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1],
        pat:   [1,1,0,0, 1,1,0,0, 1,1,0,0, 1,1,0,0],
      }
    },
  };

  function loadPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    stopPlayback();
    bpm = p.bpm;
    beatsPerBar = p.beatsPerBar;
    numBars = p.numBars;
    totalSteps = beatsPerBar * numBars;

    // Update UI controls
    document.getElementById('bpm-slider').value = bpm;
    document.getElementById('bpm-display').textContent = bpm;
    document.getElementById('beats-select').value = beatsPerBar;
    document.getElementById('bars-select').value = numBars;

    // Build grid with preset pattern
    initGrid();
    for (const [soundId, pattern] of Object.entries(p.pattern)) {
      for (let i = 0; i < Math.min(pattern.length, totalSteps); i++) {
        grid[soundId][i] = !!pattern[i];
      }
    }
    buildGrid();
  }

  // ── Event Wiring ──
  function init() {
    initGrid();
    buildGrid();

    // BPM slider
    const bpmSlider = document.getElementById('bpm-slider');
    const bpmDisplay = document.getElementById('bpm-display');
    bpmSlider.addEventListener('input', () => {
      bpm = parseInt(bpmSlider.value);
      bpmDisplay.textContent = bpm;
      if (playing) { stopPlayback(); startPlayback(); }
    });

    // Beats selector
    document.getElementById('beats-select').addEventListener('change', (e) => {
      beatsPerBar = parseInt(e.target.value);
      totalSteps = beatsPerBar * numBars;
      buildGrid();
    });

    // Bars selector
    document.getElementById('bars-select').addEventListener('change', (e) => {
      numBars = parseInt(e.target.value);
      totalSteps = beatsPerBar * numBars;
      buildGrid();
    });

    // Voice selector
    document.getElementById('voice-select').addEventListener('change', (e) => {
      keyVoice = e.target.value;
    });

    // Play / Pause
    document.getElementById('play-btn').addEventListener('click', () => {
      if (playing) stopPlayback();
      else startPlayback();
    });

    // Stop
    document.getElementById('stop-btn').addEventListener('click', stopPlayback);

    // Clear
    document.getElementById('clear-btn').addEventListener('click', () => {
      stopPlayback();
      initGrid();
      buildGrid();
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); playing ? stopPlayback() : startPlayback(); }
    });
  }

  init();
})();
