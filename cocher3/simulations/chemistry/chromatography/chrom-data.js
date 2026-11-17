/* ============================================================
   Paper Chromatography — Data Module
   Samples, reference dyes, procedure steps, analysis questions
   ============================================================ */
var CHROM_DATA = (function () {
  'use strict';

  /* ---- Reference dyes ---- */
  var referenceDyes = [
    { id: 'R1', name: 'Tartrazine (E102)',        colour: '#FFD700', rf: 0.45 },
    { id: 'R2', name: 'Sunset Yellow (E110)',      colour: '#FF8C00', rf: 0.62 },
    { id: 'R3', name: 'Allura Red (E129)',         colour: '#DC143C', rf: 0.52 },
    { id: 'R4', name: 'Brilliant Blue (E133)',     colour: '#1E90FF', rf: 0.38 },
    { id: 'R5', name: 'Green S (E142)',            colour: '#2E8B57', rf: 0.30 },
    { id: 'R6', name: 'Indigo Carmine (E132)',     colour: '#4B0082', rf: 0.25 },
    { id: 'R7', name: 'Chlorophyll a',             colour: '#228B22', rf: 0.59 },
    { id: 'R8', name: 'Chlorophyll b',             colour: '#32CD32', rf: 0.42 },
    { id: 'R9', name: 'Carotene',                  colour: '#FFA500', rf: 0.95 },
    { id: 'R10', name: 'Xanthophyll',              colour: '#DAA520', rf: 0.71 }
  ];

  /* ---- Samples ---- */
  var samples = [
    /* --- Food colourings --- */
    {
      id: 'fc-yellow',
      name: 'Yellow Food Colouring',
      category: 'Food Colourings',
      solvent: 'water',
      pure: true,
      spotColour: '#FFD700',
      spots: [
        { colour: '#FFD700', rf: 0.45, label: 'Tartrazine (E102)' }
      ]
    },
    {
      id: 'fc-orange',
      name: 'Orange Food Colouring',
      category: 'Food Colourings',
      solvent: 'water',
      pure: false,
      spotColour: '#FF6600',
      spots: [
        { colour: '#FFD700', rf: 0.45, label: 'Tartrazine (E102)' },
        { colour: '#FF8C00', rf: 0.62, label: 'Sunset Yellow (E110)' }
      ]
    },
    {
      id: 'fc-green',
      name: 'Green Food Colouring',
      category: 'Food Colourings',
      solvent: 'water',
      pure: false,
      spotColour: '#228B22',
      spots: [
        { colour: '#FFD700', rf: 0.45, label: 'Tartrazine (E102)' },
        { colour: '#1E90FF', rf: 0.38, label: 'Brilliant Blue (E133)' }
      ]
    },
    {
      id: 'fc-purple',
      name: 'Purple Food Colouring',
      category: 'Food Colourings',
      solvent: 'water',
      pure: false,
      spotColour: '#8B008B',
      spots: [
        { colour: '#DC143C', rf: 0.52, label: 'Allura Red (E129)' },
        { colour: '#1E90FF', rf: 0.38, label: 'Brilliant Blue (E133)' }
      ]
    },
    {
      id: 'fc-brown',
      name: 'Brown Food Colouring',
      category: 'Food Colourings',
      solvent: 'water',
      pure: false,
      spotColour: '#8B4513',
      spots: [
        { colour: '#FFD700', rf: 0.45, label: 'Tartrazine (E102)' },
        { colour: '#FF8C00', rf: 0.62, label: 'Sunset Yellow (E110)' },
        { colour: '#DC143C', rf: 0.52, label: 'Allura Red (E129)' }
      ]
    },

    /* --- Inks --- */
    {
      id: 'ink-black',
      name: 'Black Ink (Water-soluble)',
      category: 'Inks',
      solvent: 'water',
      pure: false,
      spotColour: '#1a1a2e',
      spots: [
        { colour: '#4B0082', rf: 0.25, label: 'Indigo Carmine (E132)' },
        { colour: '#DC143C', rf: 0.52, label: 'Allura Red (E129)' },
        { colour: '#FFD700', rf: 0.45, label: 'Tartrazine (E102)' }
      ]
    },
    {
      id: 'ink-green',
      name: 'Green Ink (Water-soluble)',
      category: 'Inks',
      solvent: 'water',
      pure: false,
      spotColour: '#006400',
      spots: [
        { colour: '#1E90FF', rf: 0.38, label: 'Brilliant Blue (E133)' },
        { colour: '#FFD700', rf: 0.45, label: 'Tartrazine (E102)' }
      ]
    },
    {
      id: 'ink-red',
      name: 'Red Ink (Water-soluble)',
      category: 'Inks',
      solvent: 'water',
      pure: true,
      spotColour: '#DC143C',
      spots: [
        { colour: '#DC143C', rf: 0.52, label: 'Allura Red (E129)' }
      ]
    },

    /* --- Leaf pigments --- */
    {
      id: 'leaf-spinach',
      name: 'Spinach Leaf Extract',
      category: 'Leaf Pigments',
      solvent: 'ethanol',
      pure: false,
      spotColour: '#2E5A1E',
      spots: [
        { colour: '#FFA500', rf: 0.95, label: 'Carotene' },
        { colour: '#DAA520', rf: 0.71, label: 'Xanthophyll' },
        { colour: '#228B22', rf: 0.59, label: 'Chlorophyll a' },
        { colour: '#32CD32', rf: 0.42, label: 'Chlorophyll b' }
      ]
    },
    {
      id: 'leaf-grass',
      name: 'Grass Extract',
      category: 'Leaf Pigments',
      solvent: 'ethanol',
      pure: false,
      spotColour: '#3A7D2C',
      spots: [
        { colour: '#FFA500', rf: 0.95, label: 'Carotene' },
        { colour: '#228B22', rf: 0.59, label: 'Chlorophyll a' },
        { colour: '#32CD32', rf: 0.42, label: 'Chlorophyll b' }
      ]
    },

    /* --- Unknown samples for identification --- */
    {
      id: 'unknown-A',
      name: 'Unknown Sample A',
      category: 'Unknowns',
      solvent: 'water',
      pure: false,
      spotColour: '#556B2F',
      spots: [
        { colour: '#FFD700', rf: 0.45, label: 'Tartrazine (E102)' },
        { colour: '#1E90FF', rf: 0.38, label: 'Brilliant Blue (E133)' }
      ]
    },
    {
      id: 'unknown-B',
      name: 'Unknown Sample B',
      category: 'Unknowns',
      solvent: 'water',
      pure: true,
      spotColour: '#FF8C00',
      spots: [
        { colour: '#FF8C00', rf: 0.62, label: 'Sunset Yellow (E110)' }
      ]
    }
  ];

  /* ---- Procedure steps ---- */
  var steps = [
    {
      id: 'select',
      num: 1,
      title: 'Select a Sample',
      instruction: 'Choose a sample to analyse from the sample selector.',
      why: 'Different samples contain different dyes. We will separate them to identify the components.'
    },
    {
      id: 'baseline',
      num: 2,
      title: 'Draw Pencil Baseline',
      instruction: 'Click on the chromatography paper to draw a pencil line 2 cm from the bottom.',
      why: 'The baseline must be drawn in pencil because pencil graphite is insoluble and will not dissolve in the solvent. Pen ink would travel with the solvent and ruin the result.'
    },
    {
      id: 'spot',
      num: 3,
      title: 'Spot the Sample',
      instruction: 'Click on the baseline to apply a small spot of your chosen sample.',
      why: 'The spot should be small and concentrated so the separated components form distinct spots rather than smeared streaks.'
    },
    {
      id: 'develop',
      num: 4,
      title: 'Place Paper in Solvent',
      instruction: 'Click the beaker to lower the paper into the solvent. The solvent level must be below the baseline.',
      why: 'If the solvent is above the baseline, the sample spots will dissolve directly into the solvent instead of being carried up by capillary action.'
    },
    {
      id: 'run',
      num: 5,
      title: 'Watch Solvent Rise',
      instruction: 'Observe as the solvent travels up the paper by capillary action, carrying the dye components with it.',
      why: 'Different substances have different affinities for the paper (stationary phase) and the solvent (mobile phase). Substances more soluble in the solvent travel further.'
    },
    {
      id: 'measure',
      num: 6,
      title: 'Measure Distances',
      instruction: 'Measure the distance from the baseline to each spot centre, and from the baseline to the solvent front.',
      why: 'Accurate measurements are needed to calculate the Rf value for each component.'
    },
    {
      id: 'calculate',
      num: 7,
      title: 'Calculate Rf Values',
      instruction: 'Calculate Rf = distance moved by substance \u00F7 distance moved by solvent front.',
      why: 'The Rf value is characteristic of a substance in a given solvent. It allows identification by comparison with known reference values.'
    }
  ];

  /* ---- Analysis questions ---- */
  var questions = [
    {
      id: 'q1',
      question: 'What does Rf stand for and what does it represent?',
      answer: 'Rf stands for Retention Factor (or Retardation Factor). It represents the ratio of the distance moved by a substance to the distance moved by the solvent front. It is a value between 0 and 1.',
      marks: 2
    },
    {
      id: 'q2',
      question: 'How do you calculate the Rf value of a substance?',
      answer: 'Rf = distance moved by substance from the origin \u00F7 distance moved by solvent front from the origin. Both distances are measured from the pencil baseline.',
      marks: 2
    },
    {
      id: 'q3',
      question: 'Why must the baseline be drawn in pencil, not pen?',
      answer: 'Pencil graphite is insoluble in the solvent, so it stays on the baseline. Pen ink would dissolve in the solvent and travel up the paper, interfering with the results.',
      marks: 2
    },
    {
      id: 'q4',
      question: 'Why must the solvent level be below the pencil baseline?',
      answer: 'If the solvent level is above the baseline, the sample spots would dissolve directly into the solvent rather than being carried up the paper by capillary action. The separation would not occur.',
      marks: 2
    },
    {
      id: 'q5',
      question: 'How can you tell if a substance is pure or a mixture from a chromatogram?',
      answer: 'A pure substance produces a single spot on the chromatogram. A mixture separates into multiple spots, one for each component.',
      marks: 2
    },
    {
      id: 'q6',
      question: 'How can an unknown substance be identified using chromatography?',
      answer: 'Run the unknown sample alongside known reference substances using the same solvent and conditions. If a spot from the unknown has the same Rf value as a reference spot, they are the same substance.',
      marks: 2
    },
    {
      id: 'q7',
      question: 'Why might the same substance give different Rf values on different days?',
      answer: 'Rf values depend on the solvent used, the type of paper, and the temperature. If any of these conditions change, the Rf value will be different. This is why reference dyes should be run alongside unknowns under identical conditions.',
      marks: 2
    },
    {
      id: 'q8',
      question: 'What is the role of the solvent (mobile phase) in chromatography?',
      answer: 'The solvent carries the dissolved components up the paper by capillary action. Components that are more soluble in the solvent travel further up the paper, while those with a greater affinity for the paper (stationary phase) travel less far.',
      marks: 2
    }
  ];

  /* ---- Scoring criteria ---- */
  var scoreCriteria = [
    { id: 'baseline',    description: 'Drew pencil baseline correctly',                  marks: 1, category: 'Technique' },
    { id: 'spot',        description: 'Applied sample spot on baseline',                 marks: 1, category: 'Technique' },
    { id: 'develop',     description: 'Placed paper in solvent correctly',               marks: 1, category: 'Technique' },
    { id: 'solvent-ok',  description: 'Solvent level below baseline',                    marks: 1, category: 'Technique' },
    { id: 'waited',      description: 'Allowed chromatogram to develop fully',           marks: 1, category: 'Technique' },
    { id: 'measure-sf',  description: 'Measured solvent front distance accurately',      marks: 2, category: 'Measurement' },
    { id: 'measure-sp',  description: 'Measured spot distances accurately',              marks: 2, category: 'Measurement' },
    { id: 'rf-calc',     description: 'Calculated Rf values correctly',                  marks: 3, category: 'Calculation' },
    { id: 'identify',    description: 'Identified components by comparing Rf values',    marks: 2, category: 'Analysis' },
    { id: 'pure-mix',    description: 'Correctly determined pure/mixture',               marks: 1, category: 'Analysis' },
    { id: 'questions',   description: 'Answered analysis questions',                     marks: 3, category: 'Understanding' }
  ];

  var totalMarks = 0;
  for (var i = 0; i < scoreCriteria.length; i++) {
    totalMarks += scoreCriteria[i].marks;
  }

  /* ---- Solvent info ---- */
  var solvents = {
    water:   { name: 'Water',   colour: 'rgba(180, 210, 255, 0.30)' },
    ethanol: { name: 'Ethanol', colour: 'rgba(220, 230, 200, 0.30)' }
  };

  /* ---- Public API ---- */
  return {
    samples: samples,
    referenceDyes: referenceDyes,
    steps: steps,
    questions: questions,
    scoreCriteria: scoreCriteria,
    totalMarks: totalMarks,
    solvents: solvents,

    /** Get sample by id */
    getSample: function (id) {
      for (var i = 0; i < samples.length; i++) {
        if (samples[i].id === id) return samples[i];
      }
      return null;
    },

    /** Get reference dye by id */
    getRef: function (id) {
      for (var i = 0; i < referenceDyes.length; i++) {
        if (referenceDyes[i].id === id) return referenceDyes[i];
      }
      return null;
    },

    /** Get samples grouped by category */
    groupedSamples: function () {
      var groups = {};
      for (var i = 0; i < samples.length; i++) {
        var cat = samples[i].category;
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(samples[i]);
      }
      return groups;
    }
  };
})();
