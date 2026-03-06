/* ============================================================
   Gas Tests Practical — Data Definitions
   Defines gas properties, generation reactions, test methods,
   procedure steps, and analysis questions.
   ============================================================ */
var GAS_DATA = (function () {
  'use strict';

  /* ── Gas Definitions ── */
  var gases = {

    O2: {
      name: 'Oxygen',
      formula: 'O\u2082',
      formulaHTML: 'O<sub>2</sub>',
      generation: {
        reagentA: '2H\u2082O\u2082 (aq)',
        reagentB: 'MnO\u2082 catalyst',
        reagentAHTML: '2H<sub>2</sub>O<sub>2</sub> (aq)',
        reagentBHTML: 'MnO<sub>2</sub> catalyst',
        equation: '2H\u2082O\u2082 \u2192 2H\u2082O + O\u2082',
        equationHTML: '2H<sub>2</sub>O<sub>2</sub> &xrarr; 2H<sub>2</sub>O + O<sub>2</sub>',
        description: 'Add manganese(IV) oxide catalyst to hydrogen peroxide solution.',
        liquidColor: 'rgba(180, 210, 255, 0.35)',
        catalystColor: '#2d2d2d',
        gasColor: 'rgba(200, 220, 255, 0.15)'
      },
      test: {
        name: 'Glowing splint test',
        method: 'Insert a glowing (not burning) splint into the mouth of the test tube.',
        toolLabel: 'Glowing Splint',
        toolIcon: 'splint-glow'
      },
      positiveResult: 'The glowing splint relights.',
      positiveResultDetail: 'The glowing splint relights, confirming the presence of oxygen which supports combustion.',
      observationKeywords: ['relight', 'relights', 'burns', 'brighter'],
      conclusionKeywords: ['oxygen', 'o2', 'O2']
    },

    CO2: {
      name: 'Carbon Dioxide',
      formula: 'CO\u2082',
      formulaHTML: 'CO<sub>2</sub>',
      generation: {
        reagentA: 'HCl (aq)',
        reagentB: 'CaCO\u2083 (s)',
        reagentAHTML: 'HCl (aq)',
        reagentBHTML: 'CaCO<sub>3</sub> (s)',
        equation: 'CaCO\u2083 + 2HCl \u2192 CaCl\u2082 + H\u2082O + CO\u2082',
        equationHTML: 'CaCO<sub>3</sub> + 2HCl &xrarr; CaCl<sub>2</sub> + H<sub>2</sub>O + CO<sub>2</sub>',
        description: 'Add dilute hydrochloric acid to calcium carbonate (marble chips).',
        liquidColor: 'rgba(220, 240, 200, 0.35)',
        catalystColor: '#e8e0d0',
        gasColor: 'rgba(200, 200, 200, 0.12)'
      },
      test: {
        name: 'Limewater test',
        method: 'Bubble the gas through limewater (calcium hydroxide solution).',
        toolLabel: 'Limewater',
        toolIcon: 'limewater'
      },
      positiveResult: 'Limewater turns milky / chalky white.',
      positiveResultDetail: 'The limewater turns milky (cloudy white) due to formation of insoluble calcium carbonate: Ca(OH)\u2082 + CO\u2082 \u2192 CaCO\u2083 + H\u2082O.',
      observationKeywords: ['milky', 'chalky', 'cloudy', 'white', 'turns white'],
      conclusionKeywords: ['carbon dioxide', 'co2', 'CO2']
    },

    H2: {
      name: 'Hydrogen',
      formula: 'H\u2082',
      formulaHTML: 'H<sub>2</sub>',
      generation: {
        reagentA: 'HCl (aq)',
        reagentB: 'Mg (s)',
        reagentAHTML: 'HCl (aq)',
        reagentBHTML: 'Mg (s)',
        equation: 'Mg + 2HCl \u2192 MgCl\u2082 + H\u2082',
        equationHTML: 'Mg + 2HCl &xrarr; MgCl<sub>2</sub> + H<sub>2</sub>',
        description: 'Add dilute hydrochloric acid to magnesium ribbon.',
        liquidColor: 'rgba(220, 230, 255, 0.30)',
        catalystColor: '#c0c0c0',
        gasColor: 'rgba(230, 230, 255, 0.08)'
      },
      test: {
        name: 'Burning splint test (squeaky pop)',
        method: 'Bring a lit (burning) splint to the mouth of the test tube.',
        toolLabel: 'Lit Splint',
        toolIcon: 'splint-lit'
      },
      positiveResult: 'A squeaky pop is heard.',
      positiveResultDetail: 'A squeaky pop sound is heard as the hydrogen ignites. The hydrogen burns in air: 2H\u2082 + O\u2082 \u2192 2H\u2082O.',
      observationKeywords: ['squeaky', 'pop', 'squeaky pop', 'ignite'],
      conclusionKeywords: ['hydrogen', 'h2', 'H2']
    },

    Cl2: {
      name: 'Chlorine',
      formula: 'Cl\u2082',
      formulaHTML: 'Cl<sub>2</sub>',
      generation: {
        reagentA: 'Conc. HCl (aq)',
        reagentB: 'MnO\u2082 (s)',
        reagentAHTML: 'Conc. HCl (aq)',
        reagentBHTML: 'MnO<sub>2</sub> (s)',
        equation: 'MnO\u2082 + 4HCl \u2192 MnCl\u2082 + 2H\u2082O + Cl\u2082',
        equationHTML: 'MnO<sub>2</sub> + 4HCl &xrarr; MnCl<sub>2</sub> + 2H<sub>2</sub>O + Cl<sub>2</sub>',
        description: 'Add concentrated hydrochloric acid to manganese(IV) oxide.',
        liquidColor: 'rgba(180, 230, 180, 0.30)',
        catalystColor: '#2d2d2d',
        gasColor: 'rgba(180, 220, 130, 0.18)'
      },
      test: {
        name: 'Damp litmus paper test',
        method: 'Hold damp blue litmus paper at the mouth of the test tube.',
        toolLabel: 'Damp Litmus',
        toolIcon: 'litmus'
      },
      positiveResult: 'Damp blue litmus turns red, then bleaches white.',
      positiveResultDetail: 'The damp blue litmus paper first turns red (acidic gas) then is bleached white by the chlorine. Chlorine is an oxidising agent.',
      observationKeywords: ['red', 'bleach', 'white', 'turns red', 'bleaches'],
      conclusionKeywords: ['chlorine', 'cl2', 'Cl2']
    },

    NH3: {
      name: 'Ammonia',
      formula: 'NH\u2083',
      formulaHTML: 'NH<sub>3</sub>',
      generation: {
        reagentA: 'NaOH (aq, warm)',
        reagentB: 'NH\u2084Cl (s)',
        reagentAHTML: 'NaOH (aq, warm)',
        reagentBHTML: 'NH<sub>4</sub>Cl (s)',
        equation: 'NH\u2084Cl + NaOH \u2192 NaCl + H\u2082O + NH\u2083',
        equationHTML: 'NH<sub>4</sub>Cl + NaOH &xrarr; NaCl + H<sub>2</sub>O + NH<sub>3</sub>',
        description: 'Warm ammonium chloride with sodium hydroxide solution.',
        liquidColor: 'rgba(220, 210, 250, 0.30)',
        catalystColor: '#f0f0f0',
        gasColor: 'rgba(210, 200, 240, 0.12)'
      },
      test: {
        name: 'Damp red litmus paper test',
        method: 'Hold damp red litmus paper at the mouth of the test tube.',
        toolLabel: 'Damp Red Litmus',
        toolIcon: 'litmus-red'
      },
      positiveResult: 'Damp red litmus paper turns blue. Pungent smell.',
      positiveResultDetail: 'The damp red litmus paper turns blue, indicating an alkaline gas. Ammonia has a characteristic pungent smell.',
      observationKeywords: ['blue', 'turns blue', 'pungent', 'alkaline'],
      conclusionKeywords: ['ammonia', 'nh3', 'NH3']
    }
  };

  /* ── Procedure Steps ── */
  var procedureSteps = [
    {
      id: 'select',
      title: 'Select a Gas',
      instruction: 'Choose which gas you want to test from the gas selector panel.',
      why: 'Each gas has a different generation reaction and a specific identification test.'
    },
    {
      id: 'setup',
      title: 'Observe the Setup',
      instruction: 'Read the generation reaction. Identify the reagents in the test tube.',
      why: 'Understanding the reaction helps you predict what gas is produced and any safety hazards.'
    },
    {
      id: 'generate',
      title: 'Generate the Gas',
      instruction: 'Click "Add Reagent" to start the gas generation reaction.',
      why: 'The reagent must be added to the starting material to initiate the reaction.'
    },
    {
      id: 'collect',
      title: 'Collect the Gas',
      instruction: 'Wait for the gas to collect via the delivery tube in the collection tube.',
      why: 'The gas must be collected before testing so you have a sufficient amount.'
    },
    {
      id: 'test',
      title: 'Apply the Test',
      instruction: 'Click the test tool to apply the standard gas test.',
      why: 'Each gas has a specific test that gives a unique positive result.'
    },
    {
      id: 'record',
      title: 'Record Your Results',
      instruction: 'Enter your observation and conclusion in the results table.',
      why: 'Accurate recording of observations and conclusions is key to scientific method.'
    }
  ];

  /* ── Analysis Questions ── */
  var analysisQuestions = [
    {
      id: 'q1',
      question: 'Why must the splint be glowing (not burning) for the oxygen test?',
      answer: 'A burning splint is already alight, so you cannot tell if oxygen relights it. A glowing splint only relights in the presence of oxygen, which supports combustion.',
      marks: 2
    },
    {
      id: 'q2',
      question: 'What substance makes limewater turn milky when CO\u2082 is bubbled through?',
      answer: 'Insoluble calcium carbonate (CaCO\u2083) is formed as a white precipitate, making the limewater appear milky/cloudy.',
      marks: 2
    },
    {
      id: 'q3',
      question: 'Why does hydrogen produce a "squeaky pop" with a lit splint?',
      answer: 'Hydrogen is a flammable gas. It ignites and reacts explosively with oxygen in the air (2H\u2082 + O\u2082 \u2192 2H\u2082O), producing the characteristic popping sound.',
      marks: 2
    },
    {
      id: 'q4',
      question: 'Why does chlorine first turn blue litmus red, then bleach it white?',
      answer: 'Chlorine dissolves in water on the damp paper to form hydrochloric acid (turns litmus red) and hypochlorous acid (HOCl), which is a bleaching agent that decolourises the dye.',
      marks: 2
    },
    {
      id: 'q5',
      question: 'Which of the five gases is alkaline? How can you tell from the litmus test?',
      answer: 'Ammonia (NH\u2083) is the only alkaline gas. It turns damp red litmus paper blue, which indicates an alkaline substance.',
      marks: 2
    }
  ];

  /* ── Scoring Criteria ── */
  var scoringCriteria = [
    { id: 'gen-O2',    description: 'Generate oxygen correctly',        marks: 1, category: 'Gas Generation' },
    { id: 'gen-CO2',   description: 'Generate carbon dioxide correctly', marks: 1, category: 'Gas Generation' },
    { id: 'gen-H2',    description: 'Generate hydrogen correctly',       marks: 1, category: 'Gas Generation' },
    { id: 'gen-Cl2',   description: 'Generate chlorine correctly',       marks: 1, category: 'Gas Generation' },
    { id: 'gen-NH3',   description: 'Generate ammonia correctly',        marks: 1, category: 'Gas Generation' },
    { id: 'test-O2',   description: 'Apply glowing splint test',         marks: 1, category: 'Gas Tests' },
    { id: 'test-CO2',  description: 'Apply limewater test',              marks: 1, category: 'Gas Tests' },
    { id: 'test-H2',   description: 'Apply burning splint test',         marks: 1, category: 'Gas Tests' },
    { id: 'test-Cl2',  description: 'Apply damp litmus test',            marks: 1, category: 'Gas Tests' },
    { id: 'test-NH3',  description: 'Apply damp red litmus test',        marks: 1, category: 'Gas Tests' },
    { id: 'obs-O2',    description: 'Record O\u2082 observation correctly',  marks: 2, category: 'Observations' },
    { id: 'obs-CO2',   description: 'Record CO\u2082 observation correctly', marks: 2, category: 'Observations' },
    { id: 'obs-H2',    description: 'Record H\u2082 observation correctly',  marks: 2, category: 'Observations' },
    { id: 'obs-Cl2',   description: 'Record Cl\u2082 observation correctly', marks: 2, category: 'Observations' },
    { id: 'obs-NH3',   description: 'Record NH\u2083 observation correctly', marks: 2, category: 'Observations' },
    { id: 'con-O2',    description: 'Identify O\u2082 correctly',            marks: 1, category: 'Conclusions' },
    { id: 'con-CO2',   description: 'Identify CO\u2082 correctly',           marks: 1, category: 'Conclusions' },
    { id: 'con-H2',    description: 'Identify H\u2082 correctly',            marks: 1, category: 'Conclusions' },
    { id: 'con-Cl2',   description: 'Identify Cl\u2082 correctly',           marks: 1, category: 'Conclusions' },
    { id: 'con-NH3',   description: 'Identify NH\u2083 correctly',           marks: 1, category: 'Conclusions' },
    { id: 'q1',        description: 'Analysis Q1 answered',                  marks: 2, category: 'Analysis' },
    { id: 'q2',        description: 'Analysis Q2 answered',                  marks: 2, category: 'Analysis' },
    { id: 'q3',        description: 'Analysis Q3 answered',                  marks: 2, category: 'Analysis' },
    { id: 'q4',        description: 'Analysis Q4 answered',                  marks: 2, category: 'Analysis' },
    { id: 'q5',        description: 'Analysis Q5 answered',                  marks: 2, category: 'Analysis' }
  ];

  var totalMarks = 0;
  for (var i = 0; i < scoringCriteria.length; i++) {
    totalMarks += scoringCriteria[i].marks;
  }

  return {
    gases: gases,
    gasOrder: ['O2', 'CO2', 'H2', 'Cl2', 'NH3'],
    procedureSteps: procedureSteps,
    analysisQuestions: analysisQuestions,
    scoringCriteria: scoringCriteria,
    totalMarks: totalMarks
  };

})();
