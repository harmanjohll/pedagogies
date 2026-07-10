/* ============================================================
   Electromagnets Practical — Data Module
   IIFE providing experiment data, procedure steps, and
   analysis questions for the electromagnet strength investigation.
   ============================================================ */
var EM_DATA = (function () {
  'use strict';

  /* ── Coil count investigation ──
     Fixed: current = 1.5 A, core = iron
     Variable: number of coils (turns)                          */
  var coilData = [
    { turns: 10,  clips: 3,  noise: 1 },
    { turns: 20,  clips: 7,  noise: 1 },
    { turns: 30,  clips: 11, noise: 2 },
    { turns: 40,  clips: 16, noise: 2 },
    { turns: 50,  clips: 21, noise: 2 }
  ];

  /* ── Current investigation ──
     Fixed: coils = 30, core = iron
     Variable: current (A)                                      */
  var currentData = [
    { current: 0.5, clips: 4,  noise: 1 },
    { current: 1.0, clips: 8,  noise: 1 },
    { current: 1.5, clips: 12, noise: 2 },
    { current: 2.0, clips: 17, noise: 2 }
  ];

  /* ── Core material investigation ──
     Fixed: coils = 30, current = 1.5 A
     Variable: core material                                    */
  var coreData = [
    { material: 'air',   label: 'Air (no core)',  clips: 2,  noise: 1, color: '#94a3b8', desc: 'Weakest — no ferromagnetic material to concentrate field lines.' },
    { material: 'steel', label: 'Steel nail',     clips: 8,  noise: 1, color: '#78716c', desc: 'Moderate — steel is hard to magnetise but retains magnetism (permanent magnet).' },
    { material: 'iron',  label: 'Soft iron nail', clips: 14, noise: 2, color: '#6b7280', desc: 'Strongest — soft iron is easily magnetised and demagnetised.' }
  ];

  /* ── Variables metadata ── */
  var variables = {
    coils: {
      id: 'coils',
      label: 'Number of coils (turns)',
      independent: 'Number of turns',
      dependent: 'Paper clips picked up',
      controlled: ['Current (1.5 A)', 'Core material (iron)', 'Same paper clips', 'Same nail length'],
      unit: 'turns',
      data: coilData
    },
    current: {
      id: 'current',
      label: 'Current (A)',
      independent: 'Current / A',
      dependent: 'Paper clips picked up',
      controlled: ['Number of coils (30)', 'Core material (iron)', 'Same paper clips', 'Same nail length'],
      unit: 'A',
      data: currentData
    },
    core: {
      id: 'core',
      label: 'Core material',
      independent: 'Core material',
      dependent: 'Paper clips picked up',
      controlled: ['Number of coils (30)', 'Current (1.5 A)', 'Same paper clips', 'Same nail length'],
      unit: '',
      data: coreData
    }
  };

  /* ── Procedure steps ── */
  var procedureSteps = [
    {
      id: 'select',
      title: 'Select variable',
      instruction: 'Choose which factor to investigate: number of coils, current, or core material.',
      why: 'A fair test changes only one variable at a time while keeping all others constant.'
    },
    {
      id: 'setup',
      title: 'Set up electromagnet',
      instruction: 'Set the first value for your chosen variable using the controls. The electromagnet will be assembled on the workbench.',
      why: 'Ensure all controlled variables are kept the same throughout the experiment.'
    },
    {
      id: 'power',
      title: 'Switch on power',
      instruction: 'Click the power switch to turn on the power supply. Current will flow through the coils.',
      why: 'Current flowing through the coils creates a magnetic field, turning the nail into an electromagnet.'
    },
    {
      id: 'test',
      title: 'Test strength',
      instruction: 'Click "Pick Up Clips" to bring the electromagnet near the paper clips and see how many stick.',
      why: 'The number of paper clips picked up is a measure of the electromagnet\'s strength.'
    },
    {
      id: 'record',
      title: 'Record result',
      instruction: 'Count the paper clips and record the result in the data table.',
      why: 'Accurate recording allows reliable conclusions to be drawn from the data.'
    },
    {
      id: 'repeat',
      title: 'Repeat for all values',
      instruction: 'Change to the next value and repeat steps 2-5 until all values have been tested.',
      why: 'Testing a range of values reveals the pattern (relationship) between the variables.'
    },
    {
      id: 'analyse',
      title: 'Analyse results',
      instruction: 'Plot a graph and answer the analysis questions to draw conclusions.',
      why: 'A graph makes it easier to identify the trend and draw a conclusion about the relationship.'
    }
  ];

  /* ── Analysis questions ── */
  var analysisQuestions = {
    coils: [
      {
        id: 'q_coils_pattern',
        question: 'Describe the relationship between the number of coils and the strength of the electromagnet.',
        modelAnswer: 'As the number of coils (turns) increases, the strength of the electromagnet increases proportionally. More turns means more wire carrying current, which creates a stronger magnetic field.',
        marks: 2
      },
      {
        id: 'q_coils_explain',
        question: 'Explain why increasing the number of coils makes the electromagnet stronger, using the idea of magnetic field lines.',
        modelAnswer: 'Each coil of wire carrying current produces its own magnetic field. When multiple coils are wound close together, their individual magnetic fields add up (superpose), producing a stronger combined magnetic field. More turns concentrate more field lines through the core.',
        marks: 3
      },
      {
        id: 'q_coils_graph',
        question: 'What type of graph would you expect? Describe its shape.',
        modelAnswer: 'A straight line through or near the origin, showing a directly proportional (linear) relationship between number of turns and electromagnet strength.',
        marks: 2
      }
    ],
    current: [
      {
        id: 'q_current_pattern',
        question: 'Describe the relationship between current and electromagnet strength.',
        modelAnswer: 'As the current increases, the strength of the electromagnet increases proportionally. Doubling the current approximately doubles the number of paper clips picked up.',
        marks: 2
      },
      {
        id: 'q_current_explain',
        question: 'Explain why increasing the current makes the electromagnet stronger.',
        modelAnswer: 'A larger current means more charge flows through the wire per second. The magnetic field strength around a wire is directly proportional to the current, so increasing current strengthens the overall magnetic field of the solenoid.',
        marks: 3
      },
      {
        id: 'q_current_limit',
        question: 'Why can\'t we just keep increasing the current to make an infinitely strong electromagnet?',
        modelAnswer: 'At very high currents the wire overheats due to its resistance (P = I^2R), which could melt the insulation or the wire itself. The core material also reaches magnetic saturation, where increasing current produces no further increase in field strength.',
        marks: 2
      }
    ],
    core: [
      {
        id: 'q_core_rank',
        question: 'Rank the core materials from strongest to weakest electromagnet and explain your ranking.',
        modelAnswer: 'Soft iron (strongest) > Steel > Air (weakest). Iron is a ferromagnetic material that is easily magnetised, concentrating the magnetic field lines through the core. Steel is also ferromagnetic but harder to magnetise. Air provides no magnetic concentration.',
        marks: 3
      },
      {
        id: 'q_core_domain',
        question: 'Use the idea of magnetic domains to explain why iron makes a better electromagnet core than air.',
        modelAnswer: 'Iron contains tiny regions called magnetic domains, each acting like a small magnet. Normally these domains point in random directions and cancel out. When placed inside a solenoid, the magnetic field from the coils causes the domains to align in the same direction, greatly strengthening the overall magnetic field. Air has no magnetic domains to align.',
        marks: 3
      },
      {
        id: 'q_core_steel',
        question: 'Explain the difference between soft iron and steel as core materials. Why might steel be a disadvantage for an electromagnet?',
        modelAnswer: 'Soft iron is easily magnetised AND easily demagnetised when the current is switched off. Steel retains its magnetism after the current stops (it becomes a permanent magnet). This is a disadvantage for an electromagnet because the whole point is to be able to switch the magnetism on and off — e.g. in a scrapyard crane that needs to release objects.',
        marks: 3
      }
    ]
  };

  /* ── Applications ── */
  var applications = [
    { name: 'Scrapyard crane', desc: 'Picks up and drops scrap metal by switching electromagnet on/off.' },
    { name: 'Circuit breaker', desc: 'Electromagnet trips the switch when current is too high, protecting the circuit.' },
    { name: 'Electric bell', desc: 'Electromagnet attracts hammer to bell, then releases — rapid on/off creates ringing.' },
    { name: 'Magnetic door lock', desc: 'Electromagnet holds door closed; cutting power releases it (fail-safe).' },
    { name: 'MRI scanner', desc: 'Very strong electromagnets create magnetic fields to image inside the body.' }
  ];

  /* ── Helper: get clip count with random noise ── */
  function getClipCount(base, noise) {
    var offset = Math.round((Math.random() - 0.5) * 2 * noise);
    return Math.max(1, base + offset);
  }

  return {
    coilData: coilData,
    currentData: currentData,
    coreData: coreData,
    variables: variables,
    procedureSteps: procedureSteps,
    analysisQuestions: analysisQuestions,
    applications: applications,
    getClipCount: getClipCount
  };
})();
