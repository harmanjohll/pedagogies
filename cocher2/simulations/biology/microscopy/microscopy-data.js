/* Microscopy & Cell Drawing practical – data */
var MICROSCOPY_DATA = {

  /* ── Specimen slides ── */
  slides: [
    {
      id: 'onion',
      name: 'Onion Epidermis',
      type: 'plant',
      description: 'A thin layer of onion epidermal cells stained with iodine. Plant cells with clearly visible cell walls arranged in a regular, brick-like pattern.',
      magnifications: ['x40', 'x100', 'x400'],
      structures: [
        { id: 'cell-wall',     label: 'Cell wall',      colour: '#8B7355', required: true,  description: 'Rigid outer boundary made of cellulose; gives the cell its rectangular shape.' },
        { id: 'cell-membrane', label: 'Cell membrane',   colour: '#C4A46C', required: true,  description: 'Thin layer just inside the cell wall; controls what enters and leaves the cell.' },
        { id: 'nucleus',       label: 'Nucleus',         colour: '#5C4033', required: true,  description: 'Dark, round structure containing DNA; controls cell activities.' },
        { id: 'cytoplasm',     label: 'Cytoplasm',       colour: '#E8D8B8', required: true,  description: 'Jelly-like substance filling the cell; where chemical reactions occur.' },
        { id: 'vacuole',       label: 'Vacuole',         colour: '#D4E8F0', required: true,  description: 'Large central space filled with cell sap; keeps the cell turgid.' }
      ],
      stain: 'Iodine solution',
      prepSteps: 'Peel a thin layer of epidermis from the inner surface of an onion scale. Place on a slide, add a drop of iodine, and lower a coverslip.'
    },
    {
      id: 'cheek',
      name: 'Cheek Epithelial Cells',
      type: 'animal',
      description: 'Human cheek lining cells stained with methylene blue. Animal cells with irregular rounded shapes and no cell wall.',
      magnifications: ['x40', 'x100', 'x400'],
      structures: [
        { id: 'cell-membrane', label: 'Cell membrane',   colour: '#7A9EBF', required: true,  description: 'Thin outer boundary of the cell; controls entry and exit of substances.' },
        { id: 'nucleus',       label: 'Nucleus',         colour: '#2C4A6E', required: true,  description: 'Dark oval structure containing genetic material.' },
        { id: 'cytoplasm',     label: 'Cytoplasm',       colour: '#B8CFE0', required: true,  description: 'Pale blue-stained material filling the cell; site of chemical reactions.' }
      ],
      stain: 'Methylene blue',
      prepSteps: 'Gently scrape the inside of the cheek with a cotton bud. Smear onto a slide, add a drop of methylene blue, and lower a coverslip.'
    },
    {
      id: 'elodea',
      name: 'Elodea Leaf',
      type: 'plant',
      description: 'A whole leaf of the aquatic plant Elodea (pondweed). Cells contain many green chloroplasts, visible moving by cytoplasmic streaming.',
      magnifications: ['x40', 'x100', 'x400'],
      structures: [
        { id: 'cell-wall',     label: 'Cell wall',      colour: '#6B8E4E', required: true,  description: 'Rigid rectangular boundary made of cellulose.' },
        { id: 'cell-membrane', label: 'Cell membrane',   colour: '#8FB06A', required: true,  description: 'Lies just inside the cell wall.' },
        { id: 'chloroplast',   label: 'Chloroplasts',    colour: '#2D6E1E', required: true,  description: 'Small green disc-shaped organelles; site of photosynthesis.' },
        { id: 'nucleus',       label: 'Nucleus',         colour: '#3D5C2E', required: false, description: 'Often obscured by chloroplasts; may be visible as a faint darker area.' },
        { id: 'vacuole',       label: 'Vacuole',         colour: '#C8E6B8', required: true,  description: 'Large central vacuole pushes chloroplasts to the edges of the cell.' },
        { id: 'cytoplasm',     label: 'Cytoplasm',       colour: '#A8D48A', required: false, description: 'Thin layer around the edge of the cell; chloroplasts are embedded in it.' }
      ],
      stain: 'None (unstained)',
      prepSteps: 'Detach a single young leaf from the Elodea stem. Mount in a drop of water on a slide and lower a coverslip.'
    },
    {
      id: 'blood',
      name: 'Blood Smear',
      type: 'animal',
      description: 'A thin smear of blood stained with Leishman stain. Red blood cells are small, round, and biconcave (no nucleus). White blood cells are larger with visible nuclei.',
      magnifications: ['x40', 'x100', 'x400'],
      structures: [
        { id: 'rbc-membrane',  label: 'Red blood cell membrane', colour: '#E07070', required: true,  description: 'Circular biconcave disc shape; no nucleus in mature mammalian red blood cells.' },
        { id: 'rbc-centre',    label: 'Pale centre (RBC)',       colour: '#F0A0A0', required: false, description: 'Lighter area in the centre due to the biconcave shape.' },
        { id: 'wbc-membrane',  label: 'White blood cell membrane', colour: '#A8A0D0', required: true, description: 'Larger, irregularly-shaped cell membrane.' },
        { id: 'wbc-nucleus',   label: 'Nucleus (WBC)',           colour: '#5040A0', required: true,  description: 'Large, dark, often lobed nucleus visible in white blood cells.' },
        { id: 'cytoplasm',     label: 'Cytoplasm (WBC)',         colour: '#C8C0E8', required: false, description: 'Pale-staining area around the nucleus of white blood cells.' }
      ],
      stain: 'Leishman stain',
      prepSteps: 'Place a small drop of blood at one end of a slide. Use another slide at 45 degrees to spread a thin smear. Air dry and add Leishman stain.'
    }
  ],

  /* ── Procedure steps ── */
  steps: [
    { id: 'select',    text: 'Select a prepared slide from the slide box.',          instruction: 'Choose a specimen from the dropdown.' },
    { id: 'low-power', text: 'Place slide on the stage and focus at low power (x40).', instruction: 'Click the x40 button and adjust the focus slider until the image is sharp.' },
    { id: 'locate',    text: 'Move to a clear area showing typical cells.',           instruction: 'The viewport shows a representative field of view.' },
    { id: 'medium',    text: 'Switch to medium power (x100) and refocus.',            instruction: 'Click x100 and readjust the focus slider.' },
    { id: 'high',      text: 'Switch to high power (x400) and fine-focus.',           instruction: 'Click x400 and use the focus slider for fine adjustment.' },
    { id: 'draw',      text: 'Draw and label the cells you observe.',                 instruction: 'Use the drawing canvas on the right to sketch what you see. Tick off each structure.' },
    { id: 'complete',  text: 'Add title and magnification to your drawing.',          instruction: 'Check all required labels and click "Complete Drawing".' }
  ],

  /* ── Drawing criteria (for mark scheme) ── */
  drawingCriteria: [
    { id: 'size',         description: 'Drawing fills at least half the available space',          marks: 1, category: 'Drawing skill' },
    { id: 'proportions',  description: 'Proportions of structures are realistic',                  marks: 1, category: 'Drawing skill' },
    { id: 'lines',        description: 'Clear, continuous lines (not sketchy / feathered)',        marks: 1, category: 'Drawing skill' },
    { id: 'label-lines',  description: 'Straight label lines (no arrowheads) touching structures', marks: 1, category: 'Labelling' },
    { id: 'labels-correct', description: 'All required structures correctly labelled',             marks: 2, category: 'Labelling' },
    { id: 'title',        description: 'Title includes specimen name',                             marks: 1, category: 'Presentation' },
    { id: 'magnification', description: 'Magnification noted (e.g. x400)',                         marks: 1, category: 'Presentation' },
    { id: 'focus-skill',  description: 'Focused correctly at each magnification',                  marks: 1, category: 'Microscope technique' },
    { id: 'mag-sequence',  description: 'Used magnifications in correct order (low to high)',      marks: 1, category: 'Microscope technique' }
  ]
};
