/* ============================================================
   LabSim – Diffusion Practical Data
   IIFE providing DIFFUSION_DATA for both experiments:
     1. KMnO₄ spreading in water at different temperatures
     2. Agar cube size investigation (SA:V ratio)
   ============================================================ */
var DIFFUSION_DATA = (function () {
  'use strict';

  /* ── Experiment 1: KMnO₄ in water ── */
  var tempExperiment = {
    title: 'Temperature & Diffusion Rate',
    subtitle: 'KMnO\u2084 crystal in water at different temperatures',
    temperatures: [20, 30, 40, 50],                     // °C
    targetRadiusMM: 15,                                  // mm radius to measure time for
    /* Base spreading rate in mm/s at each temperature.
       Higher temperature → faster diffusion (more kinetic energy). */
    spreadRates: {
      20: 0.018,   // mm/s  (slowest – room temperature)
      30: 0.028,   // mm/s
      40: 0.042,   // mm/s
      50: 0.060    // mm/s  (fastest)
    },
    /* Expected time to reach 15 mm radius (seconds), derived from rates.
       Used for results validation; actual simulation uses spreadRates. */
    expectedTimes: {
      20: 833,     // ~13 min 53 s
      30: 536,     // ~8 min 56 s
      40: 357,     // ~5 min 57 s
      50: 250      // ~4 min 10 s
    },
    /* Colour: KMnO₄ is deep purple */
    crystalColour: 'rgba(90, 0, 120, 0.95)',
    spreadColourInner: 'rgba(128, 0, 128, 0.7)',
    spreadColourOuter: 'rgba(180, 50, 200, 0.0)',
    waterColour: 'rgba(180, 210, 255, 0.35)',
    /* Noise factor – adds slight random variation ±% */
    noiseFactor: 0.08
  };

  /* ── Experiment 2: Agar cube SA:V ratio ── */
  var agarExperiment = {
    title: 'Surface Area to Volume Ratio',
    subtitle: 'Phenolphthalein agar cubes in dilute acid',
    cubeSizes: [1, 2, 3],  // cm side length
    /* SA:V calculations:
       1 cm → SA = 6 cm², V = 1 cm³, SA:V = 6:1
       2 cm → SA = 24 cm², V = 8 cm³, SA:V = 3:1
       3 cm → SA = 54 cm², V = 27 cm³, SA:V = 2:1 */
    cubeData: [
      { size: 1, surfaceArea: 6,  volume: 1,  saToV: 6.00, decolouriseTimeSec: 180  },
      { size: 2, surfaceArea: 24, volume: 8,  saToV: 3.00, decolouriseTimeSec: 720  },
      { size: 3, surfaceArea: 54, volume: 27, saToV: 2.00, decolouriseTimeSec: 1620 }
    ],
    /* Acid diffusion rate inward (cm/s) – constant for all cubes */
    diffusionRateInward: 0.00278,  // ~0.5 cm in 180 s
    /* Colours */
    agarPinkColour:    'rgba(255, 80, 130, 0.85)',
    agarClearColour:   'rgba(240, 240, 240, 0.6)',
    acidSolutionColour: 'rgba(255, 255, 200, 0.3)',
    noiseFactor: 0.06
  };

  /* ── Procedure steps ── */
  var procedures = {
    temperature: [
      { key: 'setup',   text: 'Set up 4 beakers of water at 20\u00b0C, 30\u00b0C, 40\u00b0C, and 50\u00b0C' },
      { key: 'select',  text: 'Select a temperature to investigate first' },
      { key: 'drop',    text: 'Drop a KMnO\u2084 crystal into the beaker' },
      { key: 'observe', text: 'Observe the purple colour spreading outward' },
      { key: 'measure', text: 'Record the time for colour to reach 15 mm radius' },
      { key: 'repeat',  text: 'Repeat for all four temperatures' },
      { key: 'graph',   text: 'Plot a graph of diffusion rate vs temperature' }
    ],
    agar: [
      { key: 'cut',     text: 'Cut agar cubes: 1 cm, 2 cm, and 3 cm sides' },
      { key: 'measure', text: 'Calculate the surface area and volume of each cube' },
      { key: 'place',   text: 'Place all cubes in dilute hydrochloric acid' },
      { key: 'observe', text: 'Watch the acid diffuse inward (pink \u2192 clear from outside)' },
      { key: 'time',    text: 'Record time for each cube to fully decolourise' },
      { key: 'calc',    text: 'Calculate SA:V ratio for each cube size' },
      { key: 'graph',   text: 'Plot time to decolourise vs SA:V ratio' }
    ]
  };

  /* ── Analysis questions ── */
  var analysisQuestions = {
    temperature: [
      {
        id: 'q-temp-1',
        question: 'What is diffusion?',
        hint: 'Think about the movement of particles and concentration.',
        modelAnswer: 'Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration, down a concentration gradient.'
      },
      {
        id: 'q-temp-2',
        question: 'Explain why the KMnO\u2084 colour spreads faster at higher temperatures.',
        hint: 'Consider what temperature means at the particle level.',
        modelAnswer: 'At higher temperatures, particles have more kinetic energy and move faster. This means they collide more frequently and spread out more rapidly, increasing the rate of diffusion.'
      },
      {
        id: 'q-temp-3',
        question: 'Describe the relationship shown in your rate vs temperature graph.',
        hint: 'Is the relationship linear or curved? What happens as temperature increases?',
        modelAnswer: 'The graph shows a positive correlation: as temperature increases, the rate of diffusion increases. The relationship is approximately proportional, showing that diffusion rate increases with kinetic energy.'
      },
      {
        id: 'q-temp-4',
        question: 'Suggest one variable that should be controlled in this experiment.',
        hint: 'What else could affect how fast the colour spreads?',
        modelAnswer: 'The volume of water in each beaker should be kept the same, as well as the size of the KMnO\u2084 crystal. The beakers should also be left undisturbed (no stirring).'
      }
    ],
    agar: [
      {
        id: 'q-agar-1',
        question: 'Calculate the SA:V ratio for a 2 cm cube. Show your working.',
        hint: 'SA = 6 \u00d7 side\u00b2, V = side\u00b3',
        modelAnswer: 'SA = 6 \u00d7 2\u00b2 = 24 cm\u00b2. Volume = 2\u00b3 = 8 cm\u00b3. SA:V = 24 \u00f7 8 = 3:1.'
      },
      {
        id: 'q-agar-2',
        question: 'Which cube decolourised fastest? Explain why.',
        hint: 'Think about how far the acid has to travel and the surface available.',
        modelAnswer: 'The 1 cm cube decolourised fastest because it has the highest SA:V ratio (6:1). More surface area relative to its volume means acid can diffuse in from all sides and reach the centre quickly.'
      },
      {
        id: 'q-agar-3',
        question: 'Explain why cells need to remain small, using your SA:V ratio data.',
        hint: 'Cells rely on diffusion for getting substances in and waste out.',
        modelAnswer: 'Cells must remain small to maintain a high SA:V ratio. A high ratio means substances like oxygen and glucose can diffuse in quickly enough to supply the entire cell, and waste products like CO\u2082 can diffuse out efficiently. Large cells would have too low a SA:V ratio for diffusion alone to meet their metabolic needs.'
      },
      {
        id: 'q-agar-4',
        question: 'Describe the pattern shown in your time vs SA:V ratio graph.',
        hint: 'What happens to decolourisation time as SA:V increases?',
        modelAnswer: 'As the SA:V ratio increases, the time taken for complete decolourisation decreases. This is because a larger surface area relative to volume allows acid to diffuse throughout the cube more quickly.'
      }
    ]
  };

  /* ── SA:V ratio helper ── */
  function calcSAVRatio(sideCm) {
    var sa = 6 * sideCm * sideCm;
    var vol = sideCm * sideCm * sideCm;
    return { surfaceArea: sa, volume: vol, ratio: sa / vol };
  }

  /* ── Add realistic noise to a value ── */
  function addNoise(value, factor) {
    var noise = 1 + (Math.random() - 0.5) * 2 * (factor || 0.05);
    return value * noise;
  }

  /* ── Public API ── */
  return {
    tempExperiment: tempExperiment,
    agarExperiment: agarExperiment,
    procedures: procedures,
    analysisQuestions: analysisQuestions,
    calcSAVRatio: calcSAVRatio,
    addNoise: addNoise
  };
})();
