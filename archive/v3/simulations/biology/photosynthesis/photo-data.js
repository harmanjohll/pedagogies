/* ============================================================
   Photosynthesis Practical -- Data
   Investigating the rate of photosynthesis using pondweed
   ============================================================ */
var PHOTO_DATA = (function () {
  'use strict';

  /* ── Light-distance data ──
     Rate follows inverse-square law: intensity ~ 1/d^2
     At very close distances the rate plateaus (light saturation).
     Distances in cm, rates in bubbles per minute. */

  var lightDistances = [5, 10, 15, 20, 25, 30, 40, 50];

  /* Theoretical max rate at saturating light */
  var MAX_RATE_LIGHT = 120;

  /**
   * Expected bubble rate for a given lamp distance (cm).
   * Uses inverse-square with a saturation cap and random noise.
   * @param {number} d - lamp distance in cm
   * @param {boolean} [noNoise] - if true, return the clean value
   * @returns {number} bubbles per minute
   */
  function lightRate(d, noNoise) {
    if (d <= 0) d = 1;
    /* Inverse-square relative to reference distance of 10 cm */
    var intensity = 100 / (d * d);          /* arbitrary units */
    /* Michaelis-Menten-style saturation curve */
    var rate = MAX_RATE_LIGHT * intensity / (intensity + 0.4);
    rate = Math.max(rate, 1);               /* minimum 1 bubble/min */
    if (noNoise) return Math.round(rate);
    /* Add +/- ~8 % noise */
    var noise = 1 + (Math.random() - 0.5) * 0.16;
    return Math.max(1, Math.round(rate * noise));
  }

  /* ── CO2 concentration data ──
     NaHCO3 concentration in % w/v.
     Rate increases then plateaus (limiting factor becomes light). */

  var co2Concentrations = [0, 0.5, 1, 2, 3, 4, 5];

  var MAX_RATE_CO2 = 85;

  /**
   * Expected bubble rate for a given NaHCO3 concentration (% w/v).
   * @param {number} conc
   * @param {boolean} [noNoise]
   * @returns {number} bubbles per minute
   */
  function co2Rate(conc, noNoise) {
    /* Michaelis-Menten saturation */
    var rate;
    if (conc <= 0) {
      rate = 5; /* baseline from dissolved CO2 in water */
    } else {
      rate = MAX_RATE_CO2 * conc / (conc + 1.2);
    }
    rate = Math.max(1, rate);
    if (noNoise) return Math.round(rate);
    var noise = 1 + (Math.random() - 0.5) * 0.14;
    return Math.max(1, Math.round(rate * noise));
  }

  /* ── Procedure steps ── */

  var steps = [
    {
      id: 'setup',
      title: 'Set up apparatus',
      instruction: 'Place a piece of pondweed (Elodea or Cabomba) cut-end up in a beaker of water with NaHCO\u2083 added. Position the lamp at a measured distance.'
    },
    {
      id: 'variable',
      title: 'Choose your variable',
      instruction: 'Decide whether to investigate light intensity (lamp distance) or CO\u2082 concentration (NaHCO\u2083 level).'
    },
    {
      id: 'acclimate',
      title: 'Allow plant to acclimate',
      instruction: 'Leave the pondweed under the lamp for 2 minutes to allow it to adjust to the conditions before counting.'
    },
    {
      id: 'count',
      title: 'Count bubbles for 1 minute',
      instruction: 'Start the timer and count the number of oxygen bubbles released from the cut stem in exactly 1 minute.'
    },
    {
      id: 'record',
      title: 'Record your result',
      instruction: 'Enter the bubble count in the results table. This is one data point.'
    },
    {
      id: 'repeat',
      title: 'Change the variable & repeat',
      instruction: 'Adjust the lamp distance or NaHCO\u2083 concentration and repeat. Collect data for all values.'
    },
    {
      id: 'graph',
      title: 'Plot your graph',
      instruction: 'Plot bubbles per minute on the y-axis against distance (or 1/d\u00B2) or concentration on the x-axis.'
    }
  ];

  /* ── Analysis questions ── */

  var analysisQuestions = {
    light: [
      {
        id: 'q-relationship',
        type: 'textarea',
        label: 'Describe the relationship between lamp distance and the rate of photosynthesis.',
        keywords: ['inverse', 'closer', 'increase', 'further', 'decrease', 'distance'],
        model: 'As lamp distance decreases, the rate of photosynthesis increases because light intensity follows an inverse-square relationship with distance.'
      },
      {
        id: 'q-inversesq',
        type: 'textarea',
        label: 'Explain the inverse-square law and how it applies to this experiment.',
        keywords: ['1/d\u00B2', 'inverse square', 'proportional', 'intensity', 'double', 'quarter'],
        model: 'Light intensity is inversely proportional to the square of the distance (I \u221D 1/d\u00B2). Doubling the distance reduces the intensity to one quarter.'
      },
      {
        id: 'q-limiting',
        type: 'textarea',
        label: 'What are the limiting factors of photosynthesis? Why might the rate plateau at very close distances?',
        keywords: ['limiting', 'CO2', 'carbon dioxide', 'temperature', 'light', 'plateau', 'saturate'],
        model: 'Limiting factors include light intensity, CO\u2082 concentration and temperature. At very close distances, light is no longer limiting \u2014 another factor (e.g. CO\u2082 or temperature) limits the rate, causing a plateau.'
      }
    ],
    co2: [
      {
        id: 'q-co2-effect',
        type: 'textarea',
        label: 'Describe the effect of increasing NaHCO\u2083 concentration on the rate of photosynthesis.',
        keywords: ['increase', 'CO2', 'carbon dioxide', 'rate', 'more', 'bubbles'],
        model: 'Increasing NaHCO\u2083 concentration provides more dissolved CO\u2082, so the rate of photosynthesis increases.'
      },
      {
        id: 'q-plateau',
        type: 'textarea',
        label: 'Why does the rate of photosynthesis plateau at higher CO\u2082 concentrations?',
        keywords: ['limiting', 'light', 'temperature', 'plateau', 'saturate', 'another factor', 'enzyme'],
        model: 'At higher CO\u2082 concentrations, CO\u2082 is no longer the limiting factor. The rate plateaus because another factor, such as light intensity or temperature, becomes limiting.'
      },
      {
        id: 'q-equation',
        type: 'textarea',
        label: 'Write the balanced equation for photosynthesis and explain how we measure the rate in this experiment.',
        keywords: ['6CO2', 'C6H12O6', '6O2', '6H2O', 'oxygen', 'bubble'],
        model: '6CO\u2082 + 6H\u2082O \u2192 C\u2086H\u2081\u2082O\u2086 + 6O\u2082. We measure the rate by counting oxygen bubbles released per minute, since O\u2082 is a product of photosynthesis.'
      }
    ]
  };

  /* ── Risk assessment ── */

  var riskAssessment = [
    { hazard: 'Lamp (heat)', risk: 'Burns from hot bulb', precaution: 'Do not touch the lamp when hot; use a heat shield or LED lamp' },
    { hazard: 'Water spillage', risk: 'Slips, electrical hazard', precaution: 'Keep water away from electrical equipment; mop spills immediately' },
    { hazard: 'Glassware', risk: 'Cuts if broken', precaution: 'Handle beakers carefully; report breakages' },
    { hazard: 'NaHCO\u2083 solution', risk: 'Mild irritant', precaution: 'Wash hands after handling; avoid contact with eyes' }
  ];

  /* ── Public API ── */

  return {
    title: 'Photosynthesis',
    subtitle: 'Investigating the rate of photosynthesis using pondweed and oxygen bubble counts',
    equation: '6CO\u2082 + 6H\u2082O  \u2192  C\u2086H\u2081\u2082O\u2086 + 6O\u2082',

    lightDistances: lightDistances,
    co2Concentrations: co2Concentrations,
    lightRate: lightRate,
    co2Rate: co2Rate,

    MAX_RATE_LIGHT: MAX_RATE_LIGHT,
    MAX_RATE_CO2: MAX_RATE_CO2,

    steps: steps,
    analysisQuestions: analysisQuestions,
    riskAssessment: riskAssessment,

    /* Helper: return clean (no-noise) expected rate for display/grading */
    expectedLightRate: function (d) { return lightRate(d, true); },
    expectedCO2Rate: function (c) { return co2Rate(c, true); }
  };
})();
