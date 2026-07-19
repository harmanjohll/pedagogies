/* ============================================================
   Waves & Ripple Tank – Data
   Properties, experiments, and procedure steps for wave
   reflection, refraction, and diffraction investigations
   ============================================================ */
var WAVES_DATA = {
  title: 'Waves & Ripple Tank',
  subtitle: 'Investigating wave properties: reflection, refraction, and diffraction using a ripple tank',

  modes: ['plane', 'circular'],

  /* Frequency range in Hz */
  frequencyMin: 4,
  frequencyMax: 20,
  frequencyDefault: 10,

  /* Wave speed in deep water (cm/s, representative for a ripple tank) */
  speedDeep: 30,

  /* Wave speed in shallow water (over perspex sheet) — slower */
  speedShallow: 18,

  /* Wave equation: v = f * lambda, so lambda = v / f */

  experiments: [
    {
      id: 'reflection',
      name: 'Reflection',
      description: 'Plane waves hitting a flat barrier. Observe the angle of incidence equals the angle of reflection.',
      icon: '\u2194',
      steps: [
        { id: 'select-reflection',  title: 'Select experiment',  instruction: 'Choose the Reflection experiment from the panel. Set the wave type to plane waves.' },
        { id: 'observe-incident',   title: 'Observe incident waves', instruction: 'Watch the plane wavefronts travel across the tank towards the flat barrier.' },
        { id: 'observe-reflected',  title: 'Observe reflected waves', instruction: 'Note how the wavefronts bounce off the barrier. The angle of incidence equals the angle of reflection.' },
        { id: 'adjust-frequency',   title: 'Change frequency',   instruction: 'Increase and decrease the frequency. Notice the wavelength changes but the reflection law still holds.' },
        { id: 'record-reflection',  title: 'Record observations', instruction: 'Record that the angle of incidence equals the angle of reflection, and that frequency does not affect this law.' }
      ]
    },
    {
      id: 'refraction',
      name: 'Refraction',
      description: 'Waves passing from deep water over a shallow region (perspex sheet). Waves slow down, wavelength decreases, and direction changes.',
      icon: '\u21A9',
      steps: [
        { id: 'select-refraction',  title: 'Select experiment',   instruction: 'Choose the Refraction experiment. A shallow region (perspex sheet) is shown in the tank.' },
        { id: 'observe-deep',       title: 'Observe deep water',  instruction: 'Note the wavelength and speed of waves in the deep section of the tank.' },
        { id: 'observe-shallow',    title: 'Observe shallow water', instruction: 'Watch how waves slow down and the wavelength decreases as they enter the shallow region.' },
        { id: 'measure-wavelengths', title: 'Measure wavelengths', instruction: 'Compare the wavelength in deep and shallow water. The frequency stays the same but \u03BB = v/f changes.' },
        { id: 'record-refraction',  title: 'Record observations', instruction: 'Record: speed decreases in shallow water, wavelength decreases, frequency unchanged, wavefronts change direction.' }
      ]
    },
    {
      id: 'diffraction',
      name: 'Diffraction',
      description: 'Waves passing through a gap in a barrier and spreading around an obstacle. Narrower gap = more spreading.',
      icon: '\u2248',
      steps: [
        { id: 'select-diffraction', title: 'Select experiment',   instruction: 'Choose the Diffraction experiment. A barrier with a gap is shown in the tank.' },
        { id: 'observe-gap',        title: 'Observe gap diffraction', instruction: 'Watch how waves spread out after passing through the gap. This is diffraction.' },
        { id: 'change-frequency',   title: 'Change wavelength',   instruction: 'Decrease the frequency to increase wavelength. More spreading occurs when \u03BB is comparable to the gap width.' },
        { id: 'toggle-depth',       title: 'Compare gap sizes',   instruction: 'Use the depth toggle to switch between wide and narrow gaps. Narrower gap = more diffraction.' },
        { id: 'record-diffraction', title: 'Record observations', instruction: 'Record: waves spread out through gaps, more spreading when gap width \u2248 wavelength, waves also bend around obstacles.' }
      ]
    }
  ],

  /* Scoring criteria for the practical */
  scoring: {
    totalMarks: 12,
    criteria: [
      { id: 'select-exp',    description: 'Selected and explored all three experiments', marks: 2, category: 'Method' },
      { id: 'adjust-freq',   description: 'Varied frequency and observed wavelength changes', marks: 2, category: 'Method' },
      { id: 'refl-law',      description: 'Identified angle of incidence = angle of reflection', marks: 2, category: 'Observations' },
      { id: 'refr-speed',    description: 'Identified speed/wavelength decrease in shallow water', marks: 2, category: 'Observations' },
      { id: 'diff-spread',   description: 'Described diffraction and effect of gap size', marks: 2, category: 'Observations' },
      { id: 'wave-equation', description: 'Used wave equation v = f\u03BB correctly', marks: 2, category: 'Analysis' }
    ]
  }
};
