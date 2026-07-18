/* ============================================================
   Food Tests — Reaction Data

   Each food sample lists which macronutrients it contains.
   Each test defines the reagents needed, whether heating is
   required, and the positive/negative visual result.
   ============================================================ */

var FOOD_DATA = {

  /* ── Food samples ── */
  samples: {
    'Glucose solution':  { components: ['reducing-sugar'], appearance: 'Colourless solution',       color: 'rgba(200, 220, 240, 0.15)' },
    'Starch suspension': { components: ['starch'],         appearance: 'White, cloudy suspension',  color: 'rgba(235, 235, 240, 0.55)' },
    'Albumin solution':  { components: ['protein'],        appearance: 'Pale yellow, translucent',  color: 'rgba(240, 230, 185, 0.3)' },
    'Cooking oil':       { components: ['lipid'],          appearance: 'Yellow, oily liquid',       color: 'rgba(248, 235, 140, 0.45)' },
    'Milk':              { components: ['protein', 'lipid', 'reducing-sugar'], appearance: 'White, opaque', color: 'rgba(245, 245, 250, 0.7)' },
    'Honey solution':    { components: ['reducing-sugar'], appearance: 'Golden yellow solution',    color: 'rgba(220, 180, 60, 0.4)' },
  },


  /* ── Food tests ──
     detects:         the macronutrient this test identifies
     reagents:        ordered list of reagent keys to add
     requiresHeating: must the tube be heated (water bath)?
     positiveResult:  visual outcome when nutrient IS present
     negativeResult:  visual outcome when nutrient is NOT present */
  tests: {

    iodine: {
      name: 'Iodine Test',
      detects: 'starch',
      reagents: ['Iodine'],
      requiresHeating: false,
      positiveResult: {
        tubeColor: '#1a1a40',
        observation: 'Blue-black colour — starch present.',
      },
      negativeResult: {
        tubeColor: '#c4881a',
        observation: 'Remains brown/yellow — starch absent.',
      },
    },

    benedicts: {
      name: "Benedict's Test",
      detects: 'reducing-sugar',
      reagents: ['Benedicts'],
      requiresHeating: true,
      positiveResult: {
        tubeColor: '#dc6b19',
        ppt: true,
        pptColor: '#c0510a',
        observation: 'Brick-red/orange precipitate on heating — reducing sugar present.',
      },
      negativeResult: {
        tubeColor: '#3b82f6',
        observation: "Remains blue after heating — reducing sugar absent.",
      },
    },

    biuret: {
      name: 'Biuret Test',
      detects: 'protein',
      reagents: ['NaOH', 'CuSO4'],
      requiresHeating: false,
      positiveResult: {
        tubeColor: '#7c3aed',
        observation: 'Purple/violet colour — protein present.',
      },
      negativeResult: {
        tubeColor: '#60a5fa',
        observation: 'Remains blue — protein absent.',
      },
    },

    emulsion: {
      name: 'Emulsion Test',
      detects: 'lipid',
      reagents: ['Ethanol', 'Water'],
      requiresHeating: false,
      positiveResult: {
        tubeColor: 'rgba(255, 255, 255, 0.75)',
        observation: 'White cloudy emulsion — lipid/fat present.',
      },
      negativeResult: {
        tubeColor: 'rgba(200, 220, 240, 0.15)',
        observation: 'Remains clear — lipid/fat absent.',
      },
    },
  },


  /* ── Reagent display info ── */
  reagents: {
    'Iodine':    { label: 'Iodine',      sub: '(aq)',  color: '#c4881a' },
    'Benedicts': { label: "Benedict's",   sub: '(aq)',  color: '#3b82f6' },
    'NaOH':      { label: 'NaOH',        sub: '(aq)',  color: 'rgba(200,220,255,0.4)' },
    'CuSO4':     { label: 'CuSO\u2084',  sub: '(aq)',  color: '#60a5fa' },
    'Ethanol':   { label: 'Ethanol',      sub: '',      color: 'rgba(200,220,255,0.25)' },
    'Water':     { label: 'Water',        sub: '',      color: 'rgba(200,220,255,0.15)' },
  },
};
