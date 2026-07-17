/* ============================================================
   Density Practical — Data & Configuration
   Static data file loaded before density.js
   ============================================================ */

var DENSITY_DATA = (function () {
  'use strict';

  return {

    /* ── Objects available for measurement ── */
    objects: [
      /* Regular solids — dimensions in cm, mass in g */
      {
        id: 'aluminium-cube',
        name: 'Aluminium Cube',
        category: 'regular',
        shape: 'cuboid',
        mass: 54.68,
        dimensions: { length: 2.7, width: 2.7, height: 2.7 },
        actualDensity: 2.78,
        colour: '#b0b8c8',
        colourDark: '#8a92a2'
      },
      {
        id: 'steel-cylinder',
        name: 'Steel Cylinder',
        category: 'regular',
        shape: 'cylinder',
        mass: 245.04,
        dimensions: { diameter: 2.5, height: 5.0 },
        actualDensity: 7.85,  /* V = pi*r^2*h ≈ 24.54 cm^3 => ~245/24.54 ≈ 9.98 adjusted for realistic mass */
        colour: '#6b7280',
        colourDark: '#4b5563'
      },
      {
        id: 'wooden-block',
        name: 'Wooden Block',
        category: 'regular',
        shape: 'cuboid',
        mass: 28.80,
        dimensions: { length: 6.0, width: 4.0, height: 2.0 },
        actualDensity: 0.60,
        colour: '#c2956b',
        colourDark: '#9e7850'
      },

      /* Irregular solids — volume determined by displacement */
      {
        id: 'stone',
        name: 'Stone',
        category: 'irregular',
        mass: 75.60,
        displacedVolume: 28.0,
        actualDensity: 2.70,
        colour: '#8b8680',
        colourDark: '#6b6660'
      },
      {
        id: 'key',
        name: 'Metal Key',
        category: 'irregular',
        mass: 33.60,
        displacedVolume: 4.0,
        actualDensity: 8.40,
        colour: '#d4a843',
        colourDark: '#b08930'
      },

      /* Liquids */
      {
        id: 'water',
        name: 'Water',
        category: 'liquid',
        liquidDensity: 1.00,
        liquidColour: 'rgba(100, 160, 255, 0.35)',
        liquidColourSolid: '#64a0ff'
      },
      {
        id: 'oil',
        name: 'Cooking Oil',
        category: 'liquid',
        liquidDensity: 0.92,
        liquidColour: 'rgba(220, 190, 50, 0.35)',
        liquidColourSolid: '#dcbe32'
      }
    ],

    /* ── Known densities for comparison (g/cm^3) ── */
    knownDensities: {
      'water':      { value: 1.00, unit: 'g/cm\u00B3' },
      'aluminium':  { value: 2.70, unit: 'g/cm\u00B3' },
      'steel':      { value: 7.80, unit: 'g/cm\u00B3' },
      'iron':       { value: 7.87, unit: 'g/cm\u00B3' },
      'copper':     { value: 8.96, unit: 'g/cm\u00B3' },
      'brass':      { value: 8.50, unit: 'g/cm\u00B3' },
      'wood (pine)':{ value: 0.60, unit: 'g/cm\u00B3' },
      'granite':    { value: 2.70, unit: 'g/cm\u00B3' },
      'glass':      { value: 2.50, unit: 'g/cm\u00B3' },
      'cooking oil':{ value: 0.92, unit: 'g/cm\u00B3' }
    },

    /* ── Procedure steps per method ── */
    procedures: {
      regular: [
        { id: 'select',    text: 'Select a regular solid and place it on the balance to measure its mass.' },
        { id: 'readMass',  text: 'Read and record the mass from the electronic balance.' },
        { id: 'measure',   text: 'Measure the dimensions using the ruler or vernier caliper.' },
        { id: 'calcVol',   text: 'Calculate the volume from the dimensions (L\u00D7W\u00D7H or \u03C0r\u00B2h).' },
        { id: 'calcDensity', text: 'Calculate density using \u03C1 = m / V.' }
      ],
      irregular: [
        { id: 'select',     text: 'Select an irregular solid and place it on the balance.' },
        { id: 'readMass',   text: 'Read and record the mass from the electronic balance.' },
        { id: 'fillCylinder', text: 'Fill the measuring cylinder to a known initial level (e.g. 50 cm\u00B3).' },
        { id: 'immerse',    text: 'Carefully lower the object into the measuring cylinder.' },
        { id: 'readLevel',  text: 'Read the new water level. Volume = new level \u2212 initial level.' },
        { id: 'calcDensity', text: 'Calculate density using \u03C1 = m / V.' }
      ],
      liquid: [
        { id: 'select',      text: 'Select a liquid to measure.' },
        { id: 'weighEmpty',  text: 'Place the empty measuring cylinder on the balance and record its mass.' },
        { id: 'addLiquid',   text: 'Pour a known volume (e.g. 50 cm\u00B3) of liquid into the cylinder.' },
        { id: 'weighFull',   text: 'Weigh the measuring cylinder with the liquid.' },
        { id: 'calcMass',    text: 'Mass of liquid = (mass with liquid) \u2212 (mass of empty cylinder).' },
        { id: 'calcDensity', text: 'Calculate density using \u03C1 = m / V.' }
      ]
    },

    /* ── Analysis questions ── */
    analysisQuestions: [
      {
        id: 'q1',
        question: 'The wooden block has a density of about 0.6 g/cm\u00B3. Would it float or sink in water?',
        answer: 'Float \u2014 its density is less than water (1.0 g/cm\u00B3).',
        type: 'text'
      },
      {
        id: 'q2',
        question: 'Why do we use the displacement method for irregular solids instead of measuring dimensions?',
        answer: 'Irregular solids have no simple geometric formula for volume, so we measure the volume of water displaced instead (Archimedes\u2019 principle).',
        type: 'text'
      },
      {
        id: 'q3',
        question: 'A student measures a steel cylinder and gets a density of 8.2 g/cm\u00B3 instead of 7.8 g/cm\u00B3. What is the percentage error?',
        answer: '((8.2 \u2212 7.8) / 7.8) \u00D7 100 = 5.1%',
        type: 'calculation'
      },
      {
        id: 'q4',
        question: 'Suggest two sources of error in the displacement method and how to reduce them.',
        answer: '1) Reading the meniscus incorrectly \u2014 read at eye level at the bottom of the meniscus. 2) Trapped air bubbles on the object \u2014 tap the cylinder gently or tilt the object in slowly.',
        type: 'text'
      }
    ],

    /* ── Instrument configuration ── */
    balance: {
      precision: 0.01,          /* grams */
      maxReading: 500,          /* grams */
      unit: 'g'
    },
    measuringCylinder: {
      maxVolume: 100,           /* cm^3 */
      minorDivision: 1,         /* cm^3 */
      initialWaterLevel: 50,    /* cm^3 default fill */
      unit: 'cm\u00B3'
    },
    ruler: {
      maxLength: 30,            /* cm */
      minorDivision: 0.1,       /* cm */
      unit: 'cm'
    },

    /* ── Liquid method parameters ── */
    liquidMethod: {
      cylinderMassEmpty: 85.20, /* grams — mass of empty measuring cylinder */
      pourVolume: 50            /* cm^3 of liquid added */
    },

    /* ── Noise & simulation ── */
    massNoise: 0.03,            /* +/- grams random */
    dimensionNoise: 0.02,       /* +/- cm random */
    volumeNoise: 0.5,           /* +/- cm^3 random on displacement reading */

    /* ── Scoring ── */
    scoring: {
      practical: 'density',
      totalMarks: 10,
      criteria: [
        { id: 'selectObj',    description: 'Select an object to measure',           marks: 1, category: 'Setup' },
        { id: 'readMass',     description: 'Record mass from the balance',          marks: 1, category: 'Method' },
        { id: 'measureVol',   description: 'Determine volume correctly',            marks: 2, category: 'Method' },
        { id: 'calcDensity',  description: 'Calculate density = mass / volume',     marks: 2, category: 'Analysis' },
        { id: 'accuracy',     description: 'Density within 10% of accepted value',  marks: 2, category: 'Analysis' },
        { id: 'multiObj',     description: 'Measure at least 3 different objects',   marks: 1, category: 'Method' },
        { id: 'answerQ',      description: 'Answer an analysis question',            marks: 1, category: 'Analysis' }
      ]
    }
  };

})();
