/* ============================================================
   Qualitative Analysis — Chemistry Reaction Database

   All cation/anion test results for the Singapore O-level / A-level
   QA syllabus. Data-driven: add new unknowns by extending the
   objects below — no rendering code changes needed.
   ============================================================ */

var CHEMISTRY_DATA = {

  /* ── Unknown salts ──
     Each unknown maps to a cation, anion, solution colour, and display info.
     The label (e.g. FB6) is what the student sees; the formula is hidden
     until they identify it (or in teacher mode). */
  unknowns: {
    FB6:  { formula: 'CuSO₄',       cation: 'Cu2+', anion: 'SO42-', solutionColor: '#4491e3', colorName: 'blue' },
    FB7:  { formula: 'FeSO₄',       cation: 'Fe2+', anion: 'SO42-', solutionColor: '#7db57c', colorName: 'pale green' },
    FB8:  { formula: 'ZnCl₂',       cation: 'Zn2+', anion: 'Cl-',   solutionColor: 'rgba(200, 220, 240, 0.15)', colorName: 'colourless' },
    FB9:  { formula: 'FeCl₃',       cation: 'Fe3+', anion: 'Cl-',   solutionColor: '#d4a830', colorName: 'yellow/brown' },
    FB10: { formula: 'CaI₂',        cation: 'Ca2+', anion: 'I-',    solutionColor: 'rgba(200, 220, 240, 0.15)', colorName: 'colourless' },
    FB11: { formula: 'Al₂(SO₄)₃',   cation: 'Al3+', anion: 'SO42-', solutionColor: 'rgba(200, 220, 240, 0.15)', colorName: 'colourless' },
    FB12: { formula: 'Pb(NO₃)₂',    cation: 'Pb2+', anion: 'NO3-',  solutionColor: 'rgba(200, 220, 240, 0.15)', colorName: 'colourless' },
  },


  /* ── Cation tests ──
     Key = cation identifier, value = test results.
     Each test key: reagent_amount (e.g. NaOH_few, NH3_excess)

     Result fields:
       ppt:            boolean — is a precipitate visible?
       pptColor:       CSS color of the precipitate layer
       solutionColor:  CSS color of the supernatant (if changed)
       observation:    text description for the observations table
  */
  cationTests: {

    'Cu2+': {
      NaOH_few: {
        ppt: true, pptColor: '#2563eb',
        observation: 'Light blue precipitate formed.',
      },
      NaOH_excess: {
        ppt: true, pptColor: '#2563eb', solutionColor: '#6aa8eb',
        observation: 'Blue precipitate remains — insoluble in excess NaOH(aq).',
      },
      NH3_few: {
        ppt: true, pptColor: '#2563eb',
        observation: 'Light blue precipitate formed.',
      },
      NH3_excess: {
        ppt: false, solutionColor: '#2d4cc6',
        observation: 'Precipitate dissolves, forming a deep blue solution — [Cu(NH₃)₄]²⁺ complex.',
      },
      flame: { flameColor: '#00b894', colorName: 'blue-green', observation: 'Blue-green flame observed.' },
    },

    'Fe2+': {
      NaOH_few: {
        ppt: true, pptColor: '#6a8a4a',
        observation: 'Dirty green precipitate formed.',
      },
      NaOH_excess: {
        ppt: true, pptColor: '#6a8a4a', solutionColor: '#b8deb8',
        observation: 'Green precipitate remains — insoluble in excess NaOH(aq).',
      },
      NH3_few: {
        ppt: true, pptColor: '#6a8a4a',
        observation: 'Dirty green precipitate formed.',
      },
      NH3_excess: {
        ppt: true, pptColor: '#6a8a4a', solutionColor: '#b8deb8',
        observation: 'Green precipitate remains — insoluble in excess NH₃(aq).',
      },
      flame: null,
    },

    'Fe3+': {
      NaOH_few: {
        ppt: true, pptColor: '#a06020',
        observation: 'Reddish-brown precipitate formed.',
      },
      NaOH_excess: {
        ppt: true, pptColor: '#a06020', solutionColor: '#e6d46a',
        observation: 'Reddish-brown precipitate remains — insoluble in excess NaOH(aq).',
      },
      NH3_few: {
        ppt: true, pptColor: '#a06020',
        observation: 'Reddish-brown precipitate formed.',
      },
      NH3_excess: {
        ppt: true, pptColor: '#a06020', solutionColor: '#e6d46a',
        observation: 'Reddish-brown precipitate remains — insoluble in excess NH₃(aq).',
      },
      flame: null,
    },

    'Zn2+': {
      NaOH_few: {
        ppt: true, pptColor: '#f0f2f5',
        observation: 'White precipitate formed.',
      },
      NaOH_excess: {
        ppt: false, solutionColor: 'rgba(200, 220, 240, 0.15)',
        observation: 'White precipitate dissolves in excess NaOH(aq) — colourless solution formed. Zn(OH)₂ is amphoteric.',
      },
      NH3_few: {
        ppt: true, pptColor: '#f0f2f5',
        observation: 'White precipitate formed.',
      },
      NH3_excess: {
        ppt: false, solutionColor: 'rgba(200, 220, 240, 0.15)',
        observation: 'White precipitate dissolves in excess NH₃(aq) — colourless solution formed. [Zn(NH₃)₄]²⁺ complex.',
      },
      flame: null,
    },

    'Ca2+': {
      NaOH_few: {
        ppt: true, pptColor: '#f5f5f8',
        observation: 'White precipitate formed.',
      },
      NaOH_excess: {
        ppt: true, pptColor: '#f5f5f8', solutionColor: 'rgba(220, 225, 235, 0.25)',
        observation: 'White precipitate remains — insoluble in excess NaOH(aq).',
      },
      NH3_few: {
        ppt: false,
        observation: 'No precipitate (Ca(OH)₂ is slightly soluble; NH₃ is too weak a base to exceed Ksp).',
      },
      NH3_excess: {
        ppt: false,
        observation: 'No precipitate.',
      },
      flame: { flameColor: '#ef4444', colorName: 'brick-red', observation: 'Brick-red flame observed.' },
    },

    'Al3+': {
      NaOH_few: {
        ppt: true, pptColor: '#f0f2f5',
        observation: 'White precipitate formed.',
      },
      NaOH_excess: {
        ppt: false, solutionColor: 'rgba(200, 220, 240, 0.15)',
        observation: 'White precipitate dissolves in excess NaOH(aq) — colourless solution formed. Al(OH)₃ is amphoteric.',
      },
      NH3_few: {
        ppt: true, pptColor: '#f0f2f5',
        observation: 'White precipitate formed.',
      },
      NH3_excess: {
        ppt: true, pptColor: '#f0f2f5', solutionColor: 'rgba(220, 225, 235, 0.25)',
        observation: 'White precipitate remains — insoluble in excess NH₃(aq).',
      },
      flame: null,
    },

    'Pb2+': {
      NaOH_few: {
        ppt: true, pptColor: '#f0f2f5',
        observation: 'White precipitate formed.',
      },
      NaOH_excess: {
        /* CORRECTED: Pb(OH)₂ is amphoteric — dissolves in excess NaOH */
        ppt: false, solutionColor: 'rgba(200, 220, 240, 0.15)',
        observation: 'White precipitate dissolves in excess NaOH(aq) — colourless solution formed. Pb(OH)₂ is amphoteric, forming [Pb(OH)₄]²⁻.',
      },
      NH3_few: {
        ppt: true, pptColor: '#f0f2f5',
        observation: 'White precipitate formed.',
      },
      NH3_excess: {
        ppt: true, pptColor: '#f0f2f5', solutionColor: 'rgba(220, 225, 235, 0.25)',
        observation: 'White precipitate remains — insoluble in excess NH₃(aq).',
      },
      flame: null,
    },
  },


  /* ── Anion tests ──
     Anion tests require acidification with dilute HNO₃ first,
     then addition of the test reagent.

     Key = anion identifier
     Test keys: AgNO3 (for halides), BaCl2 (for sulfate)
  */
  anionTests: {

    'Cl-': {
      AgNO3: {
        ppt: true, pptColor: '#f0f2f5',
        observation: 'White precipitate formed — Cl⁻ confirmed. (AgCl, soluble in dilute NH₃)',
      },
      BaCl2: {
        ppt: false,
        observation: 'No precipitate.',
      },
    },

    'I-': {
      AgNO3: {
        ppt: true, pptColor: '#f5e642',
        observation: 'Yellow precipitate formed — I⁻ confirmed. (AgI, insoluble in dilute NH₃)',
      },
      BaCl2: {
        ppt: false,
        observation: 'No precipitate.',
      },
    },

    'SO42-': {
      AgNO3: {
        ppt: false,
        observation: 'No precipitate.',
      },
      BaCl2: {
        ppt: true, pptColor: '#f0f2f5',
        observation: 'White precipitate formed — SO₄²⁻ confirmed. (BaSO₄, insoluble in excess dilute HCl)',
      },
    },

    'NO3-': {
      AgNO3: {
        ppt: false,
        observation: 'No precipitate.',
      },
      BaCl2: {
        ppt: false,
        observation: 'No precipitate.',
      },
    },
  },


  /* ── Heating test ──
     Warming with NaOH(aq) — used to test for NH₄⁺.
     None of the current unknowns contain NH₄⁺, but this
     is included for completeness and future unknowns. */
  heatingTests: {
    'NH4+': {
      observation: 'Pungent gas evolved that turns damp red litmus paper blue — NH₃ gas detected. NH₄⁺ confirmed.',
      gasColor: 'transparent',
    },
  },


  /* ── Reagent display names ── */
  reagentNames: {
    'NaOH':  'NaOH(aq)',
    'NH3':   'NH₃(aq)',
    'HNO3':  'dil. HNO₃(aq)',
    'AgNO3': 'AgNO₃(aq)',
    'BaCl2': 'BaCl₂(aq)',
  },
};
