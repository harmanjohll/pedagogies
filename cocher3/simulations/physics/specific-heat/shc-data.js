/* ============================================================
   Specific Heat Capacity — Data & Configuration
   Static data file loaded before shc.js
   ============================================================ */

var SHC_DATA = {

  /* Metal blocks available for the experiment */
  metals: [
    { id: 'aluminium', name: 'Aluminium', mass: 1.0, actualSHC: 900, colour: '#b0b8c8' },
    { id: 'copper',    name: 'Copper',    mass: 1.0, actualSHC: 390, colour: '#d4845a' },
    { id: 'iron',      name: 'Iron',      mass: 1.0, actualSHC: 450, colour: '#5c5f6e' },
    { id: 'brass',     name: 'Brass',     mass: 1.0, actualSHC: 380, colour: '#c9a84c' }
  ],

  /* Heater & power supply */
  heaterPower: 48,          /* watts (P = V x I) */
  voltage: 12,              /* volts */
  current: 4,               /* amps */

  /* Formulae
   *   Energy supplied:    E = V * I * t     (joules)
   *   Specific heat:      E = m * c * DT
   *   Rearranged:         c = E / (m * DT)
   *                       c = (V * I * t) / (m * DT)
   */

  /* Procedure steps */
  steps: [
    { id: 'select',    text: 'Select a metal block and note its mass.' },
    { id: 'insert',    text: 'Insert the heater and thermometer into the block.' },
    { id: 'startTemp', text: 'Record the starting temperature.' },
    { id: 'powerOn',   text: 'Switch on the power supply (12 V, 4 A).' },
    { id: 'collect',   text: 'Record temperature every 60 s for 10 minutes.' },
    { id: 'calculate', text: 'Calculate c using E = VIt and c = E / (m * DT).' }
  ],

  /* Simulation timing */
  intervalSim: 60,          /* simulated seconds between readings */
  intervalReal: 1000,       /* real milliseconds per simulated interval */
  totalReadings: 11,        /* 0 s through 600 s inclusive */

  /* Noise factor: +/- this many degrees C random noise */
  noiseFactor: 0.3,

  /* Heat-loss coefficient — slight downward curve at higher temps */
  heatLossCoeff: 0.0003,

  /* Scoring criteria */
  scoring: {
    practical: 'specific-heat',
    totalMarks: 8,
    criteria: [
      { id: 'select',       description: 'Select a metal block',                    marks: 1, category: 'Setup' },
      { id: 'startTemp',    description: 'Record starting temperature',             marks: 1, category: 'Setup' },
      { id: 'powerOn',      description: 'Switch on heater correctly',              marks: 1, category: 'Method' },
      { id: 'collectAll',   description: 'Collect all 11 temperature readings',     marks: 2, category: 'Method' },
      { id: 'calcEnergy',   description: 'Calculate energy supplied (E = VIt)',     marks: 1, category: 'Analysis' },
      { id: 'calcSHC',      description: 'Calculate specific heat capacity',        marks: 1, category: 'Analysis' },
      { id: 'accuracy',     description: 'SHC within 15% of accepted value',        marks: 1, category: 'Analysis' }
    ]
  }
};
