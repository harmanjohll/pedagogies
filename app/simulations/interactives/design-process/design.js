(function() {
  'use strict';

  /* ══════════════════════════════════════════
   * Design Thinking Stages
   * ══════════════════════════════════════════ */

  const STAGES = [
    {
      id: 'identify',
      num: 1,
      label: 'Identify',
      sub: 'Define the Problem',
      color: '#ef4444',
      desc: 'Understand the design brief. Who is the user? What problem needs solving? What are the constraints?',
      prompts: [
        { id: 'brief', label: 'Design Brief', hint: 'What is the problem you are trying to solve? Who is it for?', placeholder: 'Describe the design challenge and who will use your solution...' },
        { id: 'needs', label: 'User Needs', hint: 'What does the user need? What are their pain points?', placeholder: 'List the needs and requirements of your target user...' },
        { id: 'constraints', label: 'Constraints', hint: 'What limitations do you have? (time, materials, budget, size)', placeholder: 'List any constraints or limitations for your design...' },
        { id: 'criteria', label: 'Success Criteria', hint: 'How will you know if your design is successful?', placeholder: 'Define measurable success criteria...' },
      ],
      tools: ['research'],
      guide: 'Start by empathising with your user. Conduct interviews, surveys, or observations. Use the "5 Whys" technique to get to the root of the problem.',
    },
    {
      id: 'explore',
      num: 2,
      label: 'Explore',
      sub: 'Research & Ideate',
      color: '#f59e0b',
      desc: 'Research existing solutions. Brainstorm ideas. Explore different approaches and materials.',
      prompts: [
        { id: 'research', label: 'Research Findings', hint: 'What existing products or solutions did you find? What can you learn from them?', placeholder: 'Document your research into existing solutions, materials, and techniques...' },
        { id: 'ideas', label: 'Idea Generation', hint: 'Brainstorm at least 5 different ideas. No idea is too wild!', placeholder: 'List your brainstormed ideas (aim for quantity over quality at this stage)...' },
        { id: 'materials', label: 'Materials & Techniques', hint: 'What materials, tools, or techniques could you use?', placeholder: 'List potential materials, manufacturing techniques, and tools...' },
      ],
      tools: ['tinkercad', 'pinterest', 'teachable'],
      guide: 'Use SCAMPER (Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse) to generate more ideas. Sketch thumbnails for each concept.',
    },
    {
      id: 'develop',
      num: 3,
      label: 'Develop',
      sub: 'Design & Model',
      color: '#22c55e',
      desc: 'Develop your best idea into a detailed design. Create sketches, CAD models, or prototypes.',
      prompts: [
        { id: 'chosen', label: 'Chosen Design', hint: 'Which idea did you choose and why?', placeholder: 'Explain which design you selected and the reasoning behind your choice...' },
        { id: 'details', label: 'Design Details', hint: 'Describe dimensions, materials, colours, and key features.', placeholder: 'Detail the specifications: dimensions, materials, assembly method, finish...' },
        { id: 'cad', label: 'CAD / Digital Model Notes', hint: 'If using CAD tools, note the software used and key design decisions.', placeholder: 'Document your CAD work: software used, file names, key measurements...' },
        { id: 'iteration', label: 'Design Iterations', hint: 'What changes did you make from your initial concept?', placeholder: 'Describe how your design evolved through iterations...' },
      ],
      tools: ['tinkercad', 'onshape', 'fusion', '3dprint'],
      guide: 'This is where CAD tools shine. Use TinkerCAD for quick 3D modelling, Onshape for parametric design, or Fusion 360 for advanced projects. Export STL files for 3D printing.',
    },
    {
      id: 'realise',
      num: 4,
      label: 'Realise',
      sub: 'Make & Build',
      color: '#3b82f6',
      desc: 'Build your prototype or final product. Document the making process with photos and notes.',
      prompts: [
        { id: 'plan', label: 'Making Plan', hint: 'List the steps to build your design in order.', placeholder: 'Step-by-step making plan:\n1. \n2. \n3. ...' },
        { id: 'process', label: 'Process Documentation', hint: 'Document what happened during making. Any problems? How did you solve them?', placeholder: 'Record what happened during the build process...' },
        { id: 'safety', label: 'Safety Considerations', hint: 'What safety precautions did you follow?', placeholder: 'List safety measures taken during the making process...' },
      ],
      tools: ['3dprint', 'lasercutter'],
      guide: 'Take photos at every stage! Safety first — wear PPE, follow workshop rules. If 3D printing, check print settings: layer height, infill, supports.',
    },
    {
      id: 'test',
      num: 5,
      label: 'Test & Evaluate',
      sub: 'Review & Improve',
      color: '#a855f7',
      desc: 'Test your product against success criteria. Gather feedback. Reflect on what you would change.',
      prompts: [
        { id: 'testing', label: 'Testing Results', hint: 'Did your product meet the success criteria? What tests did you run?', placeholder: 'Describe the tests you conducted and the results...' },
        { id: 'feedback', label: 'User Feedback', hint: 'What did your user/peers say about your product?', placeholder: 'Record feedback from testing with users or peer review...' },
        { id: 'evaluation', label: 'Self-Evaluation', hint: 'What went well? What would you improve? What did you learn?', placeholder: 'Reflect on your design process and outcome...' },
        { id: 'next', label: 'Next Steps', hint: 'If you had more time, what would you change or add?', placeholder: 'Describe potential improvements and next iterations...' },
      ],
      tools: ['teachable', 'forms'],
      guide: 'Test with real users if possible. Use a rubric or scoring sheet to evaluate systematically. The design process is iterative — testing leads back to identifying improvements.',
    },
  ];

  /* ══════════════════════════════════════════
   * External Tool Links
   * ══════════════════════════════════════════ */

  const EXTERNAL_TOOLS = {
    tinkercad:   { icon: '🧊', name: 'TinkerCAD', desc: 'Free 3D modelling for beginners', url: 'https://www.tinkercad.com/' },
    onshape:     { icon: '⚙️', name: 'Onshape', desc: 'Professional parametric CAD (free edu)', url: 'https://www.onshape.com/en/education' },
    fusion:      { icon: '🔧', name: 'Fusion 360', desc: 'Advanced CAD/CAM by Autodesk', url: 'https://www.autodesk.com/products/fusion-360/education' },
    '3dprint':   { icon: '🖨️', name: '3D Printing Guide', desc: 'Slicing, settings, troubleshooting', url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/' },
    teachable:   { icon: '🤖', name: 'Teachable Machine', desc: 'Train ML models with no code', url: 'https://teachablemachine.withgoogle.com/' },
    pinterest:   { icon: '📌', name: 'Pinterest', desc: 'Visual research & mood boards', url: 'https://www.pinterest.com/' },
    research:    { icon: '🔍', name: 'Design Research', desc: 'Methods & empathy mapping', url: 'https://designkit.org/methods' },
    lasercutter: { icon: '✂️', name: 'Laser Cutting Tips', desc: 'Settings, materials, safety', url: 'https://www.instructables.com/How-to-Use-a-Laser-Cutter/' },
    forms:       { icon: '📋', name: 'Google Forms', desc: 'Create feedback surveys', url: 'https://forms.google.com/' },
  };

  /* ══════════════════════════════════════════
   * State
   * ══════════════════════════════════════════ */

  const STORAGE_KEY = 'cocher_design_process';
  let activeStage = 0;
  let stageData = loadData();

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    // Initialise empty data for each stage
    const data = {};
    STAGES.forEach(stage => {
      data[stage.id] = { completed: false, prompts: {}, images: [] };
      stage.prompts.forEach(p => { data[stage.id].prompts[p.id] = ''; });
    });
    return data;
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stageData));
  }

  function isStageComplete(stageId) {
    const d = stageData[stageId];
    if (!d) return false;
    const stage = STAGES.find(s => s.id === stageId);
    return stage.prompts.every(p => (d.prompts[p.id] || '').trim().length > 0);
  }

  /* ══════════════════════════════════════════
   * Stage Navigation
   * ══════════════════════════════════════════ */

  function renderNav() {
    const nav = document.getElementById('stage-nav');
    nav.innerHTML = STAGES.map((stage, i) => {
      const complete = isStageComplete(stage.id);
      const cls = [
        'stage-btn',
        i === activeStage ? 'active' : '',
        complete ? 'completed' : '',
      ].filter(Boolean).join(' ');
      return `
        <button class="${cls}" data-stage="${i}" style="${i === activeStage ? `border-color:${stage.color};color:${stage.color};` : ''}">
          <span class="stage-num" style="${i === activeStage ? `border-color:${stage.color};color:${stage.color};` : ''}">${complete ? '✓' : stage.num}</span>
          <span class="stage-info">
            <span class="stage-label">${stage.label}</span>
            <span class="stage-sub">${stage.sub}</span>
          </span>
        </button>
      `;
    }).join('');

    nav.querySelectorAll('.stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        saveCurrentPrompts();
        activeStage = parseInt(btn.dataset.stage);
        render();
      });
    });
  }

  /* ══════════════════════════════════════════
   * Stage Content
   * ══════════════════════════════════════════ */

  function renderContent() {
    const stage = STAGES[activeStage];
    const data = stageData[stage.id];
    const completedCount = STAGES.filter(s => isStageComplete(s.id)).length;

    const content = document.getElementById('stage-content');
    content.innerHTML = `
      <div class="stage-card">
        <div class="completion-bar">
          ${STAGES.map((s, i) => `<div class="completion-seg ${isStageComplete(s.id) ? 'filled' : ''}" style="${isStageComplete(s.id) ? `background:${s.color};` : ''}"></div>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <span style="width:32px;height:32px;border-radius:50%;background:${stage.color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.875rem;color:#fff;">${stage.num}</span>
          <h2 style="color:${stage.color};">${stage.label}</h2>
        </div>
        <p class="stage-desc">${stage.desc}</p>

        <!-- Upload area -->
        <div class="upload-area" id="upload-area">
          <div class="upload-icon">📷</div>
          <p>Drop images here or click to upload sketches, photos, screenshots</p>
          <input type="file" id="file-input" accept="image/*" multiple style="display:none;">
        </div>

        ${data.images.length > 0 ? `
          <div class="uploaded-images" id="uploaded-images">
            ${data.images.map((img, i) => `<img src="${img}" class="uploaded-img" data-img-idx="${i}" alt="Upload ${i+1}">`).join('')}
          </div>
        ` : ''}

        ${stage.prompts.map(p => `
          <div class="prompt-group">
            <div class="prompt-label">${p.label}</div>
            <div class="prompt-text">${p.hint}</div>
            <textarea class="prompt-textarea" data-prompt="${p.id}" placeholder="${p.placeholder}">${data.prompts[p.id] || ''}</textarea>
          </div>
        `).join('')}

        <div class="stage-actions">
          ${activeStage > 0 ? `<button class="btn-stage ghost" id="prev-btn">← ${STAGES[activeStage - 1].label}</button>` : '<div></div>'}
          ${activeStage < STAGES.length - 1
            ? `<button class="btn-stage primary" id="next-btn">${STAGES[activeStage + 1].label} →</button>`
            : `<button class="btn-stage primary" id="finish-btn">✓ Complete Design Journal</button>`
          }
        </div>
      </div>
    `;

    // Wire textareas for auto-save
    content.querySelectorAll('.prompt-textarea').forEach(ta => {
      ta.addEventListener('input', () => {
        stageData[stage.id].prompts[ta.dataset.prompt] = ta.value;
        // Don't save on every keystroke — debounce
        clearTimeout(ta._saveTimeout);
        ta._saveTimeout = setTimeout(() => {
          saveData();
          renderNav(); // Update completion indicators
        }, 500);
      });
    });

    // Navigation buttons
    const prevBtn = content.querySelector('#prev-btn');
    const nextBtn = content.querySelector('#next-btn');
    const finishBtn = content.querySelector('#finish-btn');

    if (prevBtn) prevBtn.addEventListener('click', () => { saveCurrentPrompts(); activeStage--; render(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { saveCurrentPrompts(); activeStage++; render(); });
    if (finishBtn) finishBtn.addEventListener('click', () => { saveCurrentPrompts(); exportJournal(); });

    // Image upload
    const uploadArea = content.querySelector('#upload-area');
    const fileInput = content.querySelector('#file-input');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = '#14b8a6'; });
    uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = '#334155'; });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#334155';
      handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
  }

  function handleFiles(files) {
    const stage = STAGES[activeStage];
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        stageData[stage.id].images.push(e.target.result);
        saveData();
        renderContent();
      };
      reader.readAsDataURL(file);
    });
  }

  function saveCurrentPrompts() {
    const stage = STAGES[activeStage];
    document.querySelectorAll('.prompt-textarea').forEach(ta => {
      stageData[stage.id].prompts[ta.dataset.prompt] = ta.value;
    });
    saveData();
  }

  /* ══════════════════════════════════════════
   * Tools Panel
   * ══════════════════════════════════════════ */

  function renderToolsPanel() {
    const stage = STAGES[activeStage];

    // Tool links
    const linksDiv = document.getElementById('tool-links');
    linksDiv.innerHTML = stage.tools.map(toolId => {
      const tool = EXTERNAL_TOOLS[toolId];
      if (!tool) return '';
      return `
        <a class="tool-link" href="${tool.url}" target="_blank" rel="noopener">
          <span class="tool-icon">${tool.icon}</span>
          <span class="tool-info">
            <span class="tool-name">${tool.name}</span>
            <span class="tool-desc">${tool.desc}</span>
          </span>
        </a>
      `;
    }).join('');

    // Stage guide
    const guideDiv = document.getElementById('stage-guide');
    guideDiv.innerHTML = `
      <div class="guide-card">
        <strong>${stage.label} Tips</strong>
        ${stage.guide}
      </div>
      <div class="guide-card">
        <strong>D&T Framework</strong>
        The 5-stage design process is iterative. You can always go back to earlier stages as you learn more.
      </div>
      ${stage.id === 'develop' ? `
        <div class="guide-card">
          <strong>CAD Workflow</strong>
          1. Sketch on paper first<br>
          2. Model in TinkerCAD/Onshape<br>
          3. Export as STL for 3D printing<br>
          4. Check dimensions match constraints
        </div>
        <div class="guide-card">
          <strong>ML Integration</strong>
          Use Teachable Machine to train a classifier (e.g. material types, gesture controls) that can enhance your product.
        </div>
      ` : ''}
      ${stage.id === 'realise' ? `
        <div class="guide-card">
          <strong>3D Print Settings</strong>
          Layer height: 0.2mm (standard)<br>
          Infill: 20% (normal strength)<br>
          Supports: auto-generate for overhangs &gt;45°
        </div>
      ` : ''}
    `;
  }

  /* ══════════════════════════════════════════
   * Export Journal
   * ══════════════════════════════════════════ */

  function exportJournal() {
    saveCurrentPrompts();
    let md = '# Design Process Journal\n\n';
    md += `_Exported: ${new Date().toLocaleDateString()}_\n\n---\n\n`;

    STAGES.forEach(stage => {
      const data = stageData[stage.id];
      md += `## ${stage.num}. ${stage.label} — ${stage.sub}\n\n`;
      stage.prompts.forEach(p => {
        md += `### ${p.label}\n`;
        md += `${data.prompts[p.id] || '_No response_'}\n\n`;
      });
      if (data.images.length > 0) {
        md += `_${data.images.length} image(s) attached_\n\n`;
      }
      md += '---\n\n';
    });

    // Create and download
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-journal-${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ══════════════════════════════════════════
   * Controls
   * ══════════════════════════════════════════ */

  document.getElementById('save-btn').addEventListener('click', () => {
    saveCurrentPrompts();
    // Visual feedback
    const btn = document.getElementById('save-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ Saved!';
    btn.style.color = '#22c55e';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
  });

  document.getElementById('export-btn').addEventListener('click', exportJournal);

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Reset all design process data? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    stageData = loadData();
    activeStage = 0;
    render();
  });

  /* ══════════════════════════════════════════
   * Render all
   * ══════════════════════════════════════════ */

  function render() {
    renderNav();
    renderContent();
    renderToolsPanel();
  }

  render();

})();
