/* Electrolysis practical – data definitions */
var ELECTROLYSIS_DATA = {
  electrolytes: {
    'dilute-h2so4': {
      name: 'Dilute Sulfuric Acid',
      formula: 'H\u2082SO\u2084(aq)',
      color: 'rgba(200, 220, 240, 0.15)',
      ions: 'H\u207a, OH\u207b, SO\u2084\u00b2\u207b',
      state: 'aqueous',
      allowCopper: true
    },
    'cuso4': {
      name: 'Copper(II) Sulfate Solution',
      formula: 'CuSO\u2084(aq)',
      color: 'rgba(50, 140, 220, 0.35)',
      ions: 'Cu\u00b2\u207a, SO\u2084\u00b2\u207b, H\u207a, OH\u207b',
      state: 'aqueous',
      allowCopper: true
    },
    'brine': {
      name: 'Concentrated Sodium Chloride',
      formula: 'NaCl(aq)',
      color: 'rgba(200, 220, 240, 0.12)',
      ions: 'Na\u207a, Cl\u207b, H\u207a, OH\u207b',
      state: 'aqueous',
      allowCopper: true
    },
    'molten-pbbr2': {
      name: 'Molten Lead(II) Bromide',
      formula: 'PbBr\u2082(l)',
      color: 'rgba(190, 150, 60, 0.5)',
      ions: 'Pb\u00b2\u207a, Br\u207b',
      state: 'molten',
      allowCopper: false
    }
  },

  electrodes: {
    'carbon': { name: 'Carbon (Graphite)', type: 'inert' },
    'copper': { name: 'Copper', type: 'active' }
  },

  results: {
    'dilute-h2so4': {
      'carbon': {
        cathode: { product: 'Hydrogen', formula: 'H\u2082', type: 'gas', bubbleColor: 'rgba(220,230,240,0.6)', observation: 'Colourless gas bubbles produced at cathode' },
        anode:   { product: 'Oxygen',   formula: 'O\u2082', type: 'gas', bubbleColor: 'rgba(220,230,240,0.6)', observation: 'Colourless gas bubbles produced at anode (less volume)' },
        overall: '2H\u2082O(l) \u2192 2H\u2082(g) + O\u2082(g)',
        cathodeEq: '2H\u207a(aq) + 2e\u207b \u2192 H\u2082(g)',
        anodeEq:  '4OH\u207b(aq) \u2192 2H\u2082O(l) + O\u2082(g) + 4e\u207b',
        notes: 'Twice the volume of gas at cathode vs anode (2:1 ratio H\u2082:O\u2082).'
      },
      'copper': {
        cathode: { product: 'Copper', formula: 'Cu', type: 'deposit', depositColor: '#b87333', observation: 'Copper deposits on cathode as Cu\u00b2\u207a ions from dissolving anode are discharged' },
        anode:   { product: 'Copper dissolves', formula: 'Cu', type: 'dissolve', observation: 'Copper anode dissolves; solution turns more blue' },
        overall: 'Cu(s)(anode) \u2192 Cu\u00b2\u207a(aq) + 2e\u207b; Cu\u00b2\u207a(aq) + 2e\u207b \u2192 Cu(s)(cathode)',
        cathodeEq: 'Cu\u00b2\u207a(aq) + 2e\u207b \u2192 Cu(s)',
        anodeEq:  'Cu(s) \u2192 Cu\u00b2\u207a(aq) + 2e\u207b',
        notes: 'Active copper electrode dissolves at anode. Cu\u00b2\u207a ions are preferentially discharged at cathode over H\u207a ions.'
      }
    },
    'cuso4': {
      'carbon': {
        cathode: { product: 'Copper', formula: 'Cu', type: 'deposit', depositColor: '#b87333', observation: 'Pink-brown copper deposit forms on cathode' },
        anode:   { product: 'Oxygen',  formula: 'O\u2082', type: 'gas', bubbleColor: 'rgba(220,230,240,0.6)', observation: 'Colourless gas bubbles at anode' },
        overall: '2CuSO\u2084(aq) + 2H\u2082O(l) \u2192 2Cu(s) + 2H\u2082SO\u2084(aq) + O\u2082(g)',
        cathodeEq: 'Cu\u00b2\u207a(aq) + 2e\u207b \u2192 Cu(s)',
        anodeEq:  '4OH\u207b(aq) \u2192 2H\u2082O(l) + O\u2082(g) + 4e\u207b',
        notes: 'Solution turns paler as Cu\u00b2\u207a ions are discharged. Blue colour fades.'
      },
      'copper': {
        cathode: { product: 'Copper', formula: 'Cu', type: 'deposit', depositColor: '#b87333', observation: 'Copper deposited on cathode (gains mass)' },
        anode:   { product: 'Copper dissolves', formula: 'Cu', type: 'dissolve', observation: 'Copper anode dissolves (loses mass)' },
        overall: 'Cu(s) \u2192 Cu\u00b2\u207a(aq) + 2e\u207b (anode) ; Cu\u00b2\u207a(aq) + 2e\u207b \u2192 Cu(s) (cathode)',
        cathodeEq: 'Cu\u00b2\u207a(aq) + 2e\u207b \u2192 Cu(s)',
        anodeEq:  'Cu(s) \u2192 Cu\u00b2\u207a(aq) + 2e\u207b',
        notes: 'Copper purification: copper transfers from anode to cathode. Solution stays blue.'
      }
    },
    'brine': {
      'carbon': {
        cathode: { product: 'Hydrogen', formula: 'H\u2082', type: 'gas', bubbleColor: 'rgba(220,230,240,0.6)', observation: 'Colourless gas bubbles at cathode' },
        anode:   { product: 'Chlorine', formula: 'Cl\u2082', type: 'gas', bubbleColor: 'rgba(180,210,100,0.45)', observation: 'Pale green-yellow gas at anode (pungent smell)' },
        overall: '2NaCl(aq) + 2H\u2082O(l) \u2192 2NaOH(aq) + H\u2082(g) + Cl\u2082(g)',
        cathodeEq: '2H\u207a(aq) + 2e\u207b \u2192 H\u2082(g)',
        anodeEq:  '2Cl\u207b(aq) \u2192 Cl\u2082(g) + 2e\u207b',
        notes: 'Chlorine is produced instead of oxygen because Cl\u207b is more concentrated than OH\u207b.'
      },
      'copper': {
        cathode: { product: 'Copper', formula: 'Cu', type: 'deposit', depositColor: '#b87333', observation: 'Copper deposits on cathode as Cu\u00b2\u207a ions from dissolving anode are discharged' },
        anode:   { product: 'Copper dissolves', formula: 'Cu', type: 'dissolve', observation: 'Copper anode dissolves into solution; solution turns blue-green' },
        overall: 'Cu(s)(anode) \u2192 Cu\u00b2\u207a(aq) + 2e\u207b; Cu\u00b2\u207a(aq) + 2e\u207b \u2192 Cu(s)(cathode)',
        cathodeEq: 'Cu\u00b2\u207a(aq) + 2e\u207b \u2192 Cu(s)',
        anodeEq:  'Cu(s) \u2192 Cu\u00b2\u207a(aq) + 2e\u207b',
        notes: 'Active copper anode dissolves in preference to Cl\u207b or OH\u207b discharge. Cu\u00b2\u207a is preferentially discharged at cathode.'
      }
    },
    'molten-pbbr2': {
      'carbon': {
        cathode: { product: 'Lead', formula: 'Pb', type: 'deposit', depositColor: '#7a7f88', observation: 'Silvery-grey molten lead collects at cathode' },
        anode:   { product: 'Bromine', formula: 'Br\u2082', type: 'gas', bubbleColor: 'rgba(160, 70, 20, 0.5)', observation: 'Red-brown bromine vapour produced at anode' },
        overall: 'PbBr\u2082(l) \u2192 Pb(l) + Br\u2082(g)',
        cathodeEq: 'Pb\u00b2\u207a(l) + 2e\u207b \u2192 Pb(l)',
        anodeEq:  '2Br\u207b(l) \u2192 Br\u2082(g) + 2e\u207b',
        notes: 'Only 2 ions present; no selective discharge needed. Must be molten to conduct.'
      }
    }
  }
};
