/* ============================================================
   Enzyme Activity – Data
   Effect of temperature on amylase breaking down starch
   ============================================================ */
var ENZYME_DATA = {
  title: 'Enzyme Activity',
  subtitle: 'Investigating the effect of temperature on amylase activity using the starch-iodine test',

  enzyme: 'Amylase',
  substrate: 'Starch solution (1%)',
  indicator: 'Iodine solution',

  /* Amylase optimum is ~37°C */
  optimumTemp: 37,
  denatureTemp: 60,

  temperatures: [20, 30, 37, 40, 50, 60, 70],

  /* Time for starch to be fully digested (seconds)
     Model: slowest at extremes, fastest near optimum, denatured above 60 */
  getDigestionTime: function (temp) {
    if (temp >= 65) return Infinity; /* denatured, never completes */
    if (temp >= 60) return 600;     /* very slow, barely active */
    /* Bell-curve model centred on 37°C */
    var distance = Math.abs(temp - 37);
    var base = 60; /* fastest time at optimum */
    var time = base + (distance * distance * 0.15);
    /* Add noise */
    return Math.round(time + (Math.random() - 0.5) * 10);
  },

  /* Iodine colour at each time check:
     - 'black': starch present
     - 'brown': partial digestion
     - 'yellow': starch fully digested (endpoint) */
  getColourAtTime: function (elapsed, totalTime) {
    if (totalTime === Infinity) return 'black';
    var ratio = elapsed / totalTime;
    if (ratio >= 1.0) return 'yellow';
    if (ratio >= 0.6) return 'brown';
    return 'black';
  },

  colours: {
    black: { hex: '#1a1a2e', label: 'Blue-black (starch present)' },
    brown: { hex: '#8B6914', label: 'Brown (partial digestion)' },
    yellow: { hex: '#d4a843', label: 'Yellow-brown (no starch \u2013 endpoint)' }
  },

  steps: [
    { id: 'prepare', title: 'Prepare water baths', instruction: 'Set up water baths at each test temperature.' },
    { id: 'pipette', title: 'Prepare solutions', instruction: 'Place 5 cm\u00B3 of starch solution and 2 cm\u00B3 of amylase in separate test tubes. Stand both in the water bath for 2 minutes to equilibrate.' },
    { id: 'spot', title: 'Prepare spotting tile', instruction: 'Add a drop of iodine solution to each well of a spotting tile.' },
    { id: 'mix', title: 'Mix & start timer', instruction: 'Pour the amylase into the starch and start the timer.' },
    { id: 'test', title: 'Test every 30 s', instruction: 'Every 30 seconds, transfer a drop of the mixture to a well of iodine. Record the colour.' },
    { id: 'endpoint', title: 'Find the endpoint', instruction: 'The endpoint is when iodine stays yellow-brown \u2013 all starch digested.' },
    { id: 'repeat', title: 'Repeat', instruction: 'Repeat at each temperature. Record the time to reach the endpoint.' }
  ],

  riskAssessment: [
    { hazard: 'Iodine solution', risk: 'Stains skin and clothing', precaution: 'Wear gloves; wash spills immediately' },
    { hazard: 'Hot water baths', risk: 'Burns/scalds', precaution: 'Use tongs for hot test tubes; keep water below 80\u00B0C' },
    { hazard: 'Glassware', risk: 'Cuts if broken', precaution: 'Handle carefully; report breakages' }
  ]
};
