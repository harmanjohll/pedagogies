/* Preparation of Salts practical – data definitions */
var SALTS_DATA = {
  pairs: {
    'cuo-h2so4': {
      name: 'Copper(II) Sulfate',
      base: 'Copper(II) oxide',
      baseFormula: 'CuO',
      acid: 'Dilute sulfuric acid',
      acidFormula: 'H\u2082SO\u2084(aq)',
      salt: 'Copper(II) sulfate',
      saltFormula: 'CuSO\u2084',
      equation: 'CuO(s) + H\u2082SO\u2084(aq) \u2192 CuSO\u2084(aq) + H\u2082O(l)',
      baseColor: '#2a2a2a',
      baseLabel: 'black powder',
      solutionColor: 'rgba(30, 120, 220, 0.45)',
      solutionLabel: 'blue',
      crystalColor: '#3b82f6',
      crystalHighlight: '#60a5fa',
      residueDesc: 'black copper(II) oxide',
      crystalDesc: 'blue copper(II) sulfate crystals'
    },
    'zno-h2so4': {
      name: 'Zinc Sulfate',
      base: 'Zinc oxide',
      baseFormula: 'ZnO',
      acid: 'Dilute sulfuric acid',
      acidFormula: 'H\u2082SO\u2084(aq)',
      salt: 'Zinc sulfate',
      saltFormula: 'ZnSO\u2084',
      equation: 'ZnO(s) + H\u2082SO\u2084(aq) \u2192 ZnSO\u2084(aq) + H\u2082O(l)',
      baseColor: '#e8e4c0',
      baseLabel: 'white powder',
      solutionColor: 'rgba(200, 210, 220, 0.3)',
      solutionLabel: 'colourless',
      crystalColor: '#d1d5db',
      crystalHighlight: '#e5e7eb',
      residueDesc: 'white zinc oxide',
      crystalDesc: 'white zinc sulfate crystals'
    },
    'mgo-h2so4': {
      name: 'Magnesium Sulfate',
      base: 'Magnesium oxide',
      baseFormula: 'MgO',
      acid: 'Dilute sulfuric acid',
      acidFormula: 'H\u2082SO\u2084(aq)',
      salt: 'Magnesium sulfate',
      saltFormula: 'MgSO\u2084',
      equation: 'MgO(s) + H\u2082SO\u2084(aq) \u2192 MgSO\u2084(aq) + H\u2082O(l)',
      baseColor: '#f0ece0',
      baseLabel: 'white powder',
      solutionColor: 'rgba(200, 210, 220, 0.25)',
      solutionLabel: 'colourless',
      crystalColor: '#e5e7eb',
      crystalHighlight: '#f3f4f6',
      residueDesc: 'white magnesium oxide',
      crystalDesc: 'colourless magnesium sulfate crystals'
    }
  },

  steps: [
    {
      id: 'warm',
      title: 'Warm the acid',
      instruction: 'Light the Bunsen burner and gently warm the dilute sulfuric acid in the beaker. Do not boil.',
      why: 'Warming speeds up the reaction between the acid and the metal oxide.',
      button: 'Warm Acid',
      observation: function (pair) {
        return 'The dilute sulfuric acid is gently warmed. Small convection currents are visible. The acid is colourless.';
      }
    },
    {
      id: 'add',
      title: 'Add excess base',
      instruction: 'Add spatulas of the metal oxide powder to the warm acid. Keep adding until some remains undissolved.',
      why: 'Adding excess ensures all the acid has reacted, so the filtrate contains only salt solution (no unreacted acid).',
      button: 'Add Metal Oxide',
      observation: function (pair) {
        return 'The ' + pair.baseLabel + ' (' + pair.baseFormula + ') is added to the warm acid. It begins to dissolve.';
      }
    },
    {
      id: 'stir',
      title: 'Stir the mixture',
      instruction: 'Stir the mixture with a glass rod to help the base dissolve. The solution should change colour as salt forms.',
      why: 'Stirring increases contact between acid and base, helping the reaction go to completion.',
      button: 'Stir Mixture',
      observation: function (pair) {
        return 'As the oxide dissolves, a ' + pair.solutionLabel + ' solution of ' + pair.saltFormula + ' forms. Excess ' + pair.baseLabel + ' remains at the bottom, showing all the acid has reacted.';
      }
    },
    {
      id: 'filter',
      title: 'Filter the mixture',
      instruction: 'Set up filter funnel with filter paper. Pour the mixture through to remove excess insoluble base.',
      why: 'Filtering separates the soluble salt solution (filtrate) from the excess insoluble metal oxide (residue).',
      button: 'Filter',
      observation: function (pair) {
        return 'The ' + pair.solutionLabel + ' filtrate (' + pair.saltFormula + ' solution) passes through the filter paper. The ' + pair.residueDesc + ' residue is left on the filter paper.';
      }
    },
    {
      id: 'evaporate',
      title: 'Evaporate the solution',
      instruction: 'Pour the filtrate into an evaporating dish. Heat gently on a water bath or with a Bunsen to evaporate about half the water.',
      why: 'Removing some water produces a saturated solution, which will form crystals on cooling.',
      button: 'Evaporate',
      observation: function (pair) {
        return 'Steam rises from the evaporating dish as water evaporates. The ' + pair.solutionLabel + ' solution becomes more concentrated. Stop heating when crystals begin to appear at the edges.';
      }
    },
    {
      id: 'crystallise',
      title: 'Crystallise',
      instruction: 'Leave the saturated solution to cool slowly. Crystals will form as the solution cools.',
      why: 'Slow cooling produces larger, more regular crystals. The solubility decreases as temperature falls.',
      button: 'Crystallise',
      observation: function (pair) {
        return pair.crystalDesc.charAt(0).toUpperCase() + pair.crystalDesc.slice(1) + ' form as the solution cools. The crystals have a regular shape.';
      }
    },
    {
      id: 'dry',
      title: 'Dry the crystals',
      instruction: 'Remove crystals with a spatula. Pat dry between sheets of filter paper. Leave in a warm place.',
      why: 'Filter paper absorbs excess solution without re-dissolving the crystals. Gentle drying avoids losing water of crystallisation.',
      button: 'Dry Crystals',
      observation: function (pair) {
        return 'The ' + pair.crystalDesc + ' are patted dry between filter paper. A pure, dry sample of ' + pair.salt + ' (' + pair.saltFormula + ') has been prepared.';
      }
    }
  ]
};
