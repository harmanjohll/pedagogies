var CHEMISTRY_DATA = {
  unknowns: {
    FB6:  { formula: 'CuSO\u2084',       cation: 'Cu2+', anion: 'SO42-', solutionColor: '#4491e3', colorName: 'blue' },
    FB7:  { formula: 'FeSO\u2084',       cation: 'Fe2+', anion: 'SO42-', solutionColor: '#7db57c', colorName: 'pale green' },
    FB8:  { formula: 'ZnCl\u2082',       cation: 'Zn2+', anion: 'Cl-',   solutionColor: 'rgba(200, 220, 240, 0.15)', colorName: 'colourless' },
    FB9:  { formula: 'FeCl\u2083',       cation: 'Fe3+', anion: 'Cl-',   solutionColor: '#d4a830', colorName: 'yellow/brown' },
    FB10: { formula: 'CaI\u2082',        cation: 'Ca2+', anion: 'I-',    solutionColor: 'rgba(200, 220, 240, 0.15)', colorName: 'colourless' },
    FB11: { formula: 'Al\u2082(SO\u2084)\u2083',   cation: 'Al3+', anion: 'SO42-', solutionColor: 'rgba(200, 220, 240, 0.15)', colorName: 'colourless' },
    FB12: { formula: 'Pb(NO\u2083)\u2082',    cation: 'Pb2+', anion: 'NO3-',  solutionColor: 'rgba(200, 220, 240, 0.15)', colorName: 'colourless' },
  },
  cationTests: {
    'Cu2+': {
      NaOH_few: { ppt: true, pptColor: '#2563eb', observation: 'Light blue precipitate formed.' },
      NaOH_excess: { ppt: true, pptColor: '#2563eb', solutionColor: '#6aa8eb', observation: 'Blue precipitate remains \u2014 insoluble in excess NaOH(aq).' },
      NH3_few: { ppt: true, pptColor: '#2563eb', observation: 'Light blue precipitate formed.' },
      NH3_excess: { ppt: false, solutionColor: '#2d4cc6', observation: 'Precipitate dissolves, forming a deep blue solution \u2014 [Cu(NH\u2083)\u2084]\u00B2\u207A complex.' },
      flame: { flameColor: '#00b894', colorName: 'blue-green', observation: 'Blue-green flame observed.' }
    },
    'Fe2+': {
      NaOH_few: { ppt: true, pptColor: '#6a8a4a', observation: 'Dirty green precipitate formed.' },
      NaOH_excess: { ppt: true, pptColor: '#6a8a4a', solutionColor: '#b8deb8', observation: 'Green precipitate remains \u2014 insoluble in excess NaOH(aq).' },
      NH3_few: { ppt: true, pptColor: '#6a8a4a', observation: 'Dirty green precipitate formed.' },
      NH3_excess: { ppt: true, pptColor: '#6a8a4a', solutionColor: '#b8deb8', observation: 'Green precipitate remains \u2014 insoluble in excess NH\u2083(aq).' },
      flame: null
    },
    'Fe3+': {
      NaOH_few: { ppt: true, pptColor: '#a06020', observation: 'Reddish-brown precipitate formed.' },
      NaOH_excess: { ppt: true, pptColor: '#a06020', solutionColor: '#e6d46a', observation: 'Reddish-brown precipitate remains \u2014 insoluble in excess NaOH(aq).' },
      NH3_few: { ppt: true, pptColor: '#a06020', observation: 'Reddish-brown precipitate formed.' },
      NH3_excess: { ppt: true, pptColor: '#a06020', solutionColor: '#e6d46a', observation: 'Reddish-brown precipitate remains \u2014 insoluble in excess NH\u2083(aq).' },
      flame: null
    },
    'Zn2+': {
      NaOH_few: { ppt: true, pptColor: '#f0f2f5', observation: 'White precipitate formed.' },
      NaOH_excess: { ppt: false, solutionColor: 'rgba(200, 220, 240, 0.15)', observation: 'White precipitate dissolves in excess NaOH(aq) \u2014 colourless solution formed.' },
      NH3_few: { ppt: true, pptColor: '#f0f2f5', observation: 'White precipitate formed.' },
      NH3_excess: { ppt: false, solutionColor: 'rgba(200, 220, 240, 0.15)', observation: 'White precipitate dissolves in excess NH\u2083(aq) \u2014 [Zn(NH\u2083)\u2084]\u00B2\u207A complex.' },
      flame: null
    },
    'Ca2+': {
      NaOH_few: { ppt: true, pptColor: '#f5f5f8', observation: 'White precipitate formed.' },
      NaOH_excess: { ppt: true, pptColor: '#f5f5f8', solutionColor: 'rgba(220, 225, 235, 0.25)', observation: 'White precipitate remains \u2014 insoluble in excess NaOH(aq).' },
      NH3_few: { ppt: false, observation: 'No precipitate (Ca(OH)\u2082 is slightly soluble; NH\u2083 too weak).' },
      NH3_excess: { ppt: false, observation: 'No precipitate.' },
      flame: { flameColor: '#ef4444', colorName: 'brick-red', observation: 'Brick-red flame observed.' }
    },
    'Al3+': {
      NaOH_few: { ppt: true, pptColor: '#f0f2f5', observation: 'White precipitate formed.' },
      NaOH_excess: { ppt: false, solutionColor: 'rgba(200, 220, 240, 0.15)', observation: 'White precipitate dissolves in excess NaOH(aq) \u2014 colourless solution formed.' },
      NH3_few: { ppt: true, pptColor: '#f0f2f5', observation: 'White precipitate formed.' },
      NH3_excess: { ppt: true, pptColor: '#f0f2f5', solutionColor: 'rgba(220, 225, 235, 0.25)', observation: 'White precipitate remains \u2014 insoluble in excess NH\u2083(aq).' },
      flame: null
    },
    'Pb2+': {
      NaOH_few: { ppt: true, pptColor: '#f0f2f5', observation: 'White precipitate formed.' },
      NaOH_excess: { ppt: false, solutionColor: 'rgba(200, 220, 240, 0.15)', observation: 'White precipitate dissolves in excess NaOH(aq) \u2014 forming [Pb(OH)\u2084]\u00B2\u207B.' },
      NH3_few: { ppt: true, pptColor: '#f0f2f5', observation: 'White precipitate formed.' },
      NH3_excess: { ppt: true, pptColor: '#f0f2f5', solutionColor: 'rgba(220, 225, 235, 0.25)', observation: 'White precipitate remains \u2014 insoluble in excess NH\u2083(aq).' },
      flame: null
    }
  },
  anionTests: {
    'Cl-': {
      AgNO3: { ppt: true, pptColor: '#f0f2f5', observation: 'White precipitate formed \u2014 Cl\u207B confirmed.' },
      BaCl2: { ppt: false, observation: 'No precipitate.' }
    },
    'I-': {
      AgNO3: { ppt: true, pptColor: '#f5e642', observation: 'Yellow precipitate formed \u2014 I\u207B confirmed.' },
      BaCl2: { ppt: false, observation: 'No precipitate.' }
    },
    'SO42-': {
      AgNO3: { ppt: false, observation: 'No precipitate.' },
      BaCl2: { ppt: true, pptColor: '#f0f2f5', observation: 'White precipitate formed \u2014 SO\u2084\u00B2\u207B confirmed.' }
    },
    'NO3-': {
      AgNO3: { ppt: false, observation: 'No precipitate.' },
      BaCl2: { ppt: false, observation: 'No precipitate.' }
    }
  },
  reagentNames: {
    'NaOH': 'NaOH(aq)', 'NH3': 'NH\u2083(aq)', 'HNO3': 'dil. HNO\u2083(aq)',
    'AgNO3': 'AgNO\u2083(aq)', 'BaCl2': 'BaCl\u2082(aq)'
  }
};
