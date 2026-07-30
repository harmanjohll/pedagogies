/* LabSim shared audio feedback system – Web Audio API */
var LabAudio = (function () {
  var ctx = null;
  var enabled = true;
  var vol = 0.15;

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { enabled = false; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function osc(freq, type, dur, gainVal) {
    var c = getCtx();
    if (!c || !enabled) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = (gainVal || vol);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime);
    o.stop(c.currentTime + dur);
  }

  function noise(dur, filterFreq, gainVal) {
    var c = getCtx();
    if (!c || !enabled) return;
    var bufSize = c.sampleRate * dur;
    var buf = c.createBuffer(1, bufSize, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf;
    var filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq || 800;
    var g = c.createGain();
    g.gain.value = gainVal || vol * 0.5;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(c.destination);
    src.start(c.currentTime);
    src.stop(c.currentTime + dur);
  }

  return {
    /* Glass clink – short high-freq tap */
    clink: function () {
      osc(2200, 'sine', 0.08, vol * 0.6);
      osc(3300, 'sine', 0.05, vol * 0.3);
    },

    /* Liquid pour – filtered noise */
    pour: function () {
      noise(0.6, 600, vol * 0.4);
    },

    /* Drip – short low pop */
    drip: function () {
      osc(350, 'sine', 0.06, vol * 0.5);
    },

    /* Bubble – repeating low pops */
    bubble: function () {
      for (var i = 0; i < 4; i++) {
        setTimeout(function () { osc(250 + Math.random() * 100, 'sine', 0.06, vol * 0.3); }, i * 80);
      }
    },

    /* Timer beep – short tone */
    beep: function () {
      osc(880, 'square', 0.12, vol * 0.4);
    },

    /* Success chime – ascending tones */
    success: function () {
      osc(523, 'sine', 0.15, vol * 0.5);
      setTimeout(function () { osc(659, 'sine', 0.15, vol * 0.5); }, 120);
      setTimeout(function () { osc(784, 'sine', 0.25, vol * 0.6); }, 240);
    },

    /* Warning – descending tones */
    warn: function () {
      osc(600, 'triangle', 0.15, vol * 0.4);
      setTimeout(function () { osc(450, 'triangle', 0.2, vol * 0.4); }, 140);
    },

    /* Click – subtle UI feedback */
    click: function () {
      osc(1200, 'sine', 0.03, vol * 0.3);
    },

    /* Switch toggle */
    switchToggle: function () {
      noise(0.04, 3000, vol * 0.5);
    },

    /* Record data logged */
    record: function () {
      osc(660, 'sine', 0.08, vol * 0.4);
      setTimeout(function () { osc(880, 'sine', 0.1, vol * 0.4); }, 80);
    },

    /* Enable / disable */
    setEnabled: function (on) { enabled = !!on; },
    isEnabled: function () { return enabled; },

    /* Volume 0–1 */
    setVolume: function (v) { vol = Math.max(0, Math.min(1, v)) * 0.2; }
  };
})();
