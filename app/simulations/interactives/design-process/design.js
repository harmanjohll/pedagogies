(function() {
  'use strict';

  /* ══════════════════════════════════════════
   * Design Thinking Stages
   * ══════════════════════════════════════════ */

  const STAGES = [
    {
      id: 'empathise',
      num: 1,
      label: 'Empathise',
      sub: 'Understand the User',
      color: '#ef4444',
      desc: 'Immerse yourself in the user\'s world. Observe, engage, and listen to understand their experiences, needs, and motivations.',
      prompts: [
        { id: 'user', label: 'User Profile', hint: 'Who is the user? Describe their age, context, and daily life.', placeholder: 'Describe the target user — who they are, what they do, their environment...' },
        { id: 'observations', label: 'Observations', hint: 'What did you see and hear when observing the user? What stood out?', placeholder: 'Record what you observed about the user and their behaviour...' },
        { id: 'interviews', label: 'Interview Insights', hint: 'What did the user tell you about their experience? Direct quotes are powerful.', placeholder: 'Key quotes and insights from user interviews...' },
        { id: 'empathymap', label: 'Empathy Map', hint: 'What does the user Think, Feel, Say, and Do?', placeholder: 'Think: ...\nFeel: ...\nSay: ...\nDo: ...' },
      ],
      tools: ['empathymap', 'interview5whys', 'shadowing'],
      guide: 'Use an Empathy Map to organise what the user thinks, feels, says, and does. Conduct interviews with the "5 Whys" technique. Shadow or observe users in their real environment.',
    },
    {
      id: 'define',
      num: 2,
      label: 'Define',
      sub: 'Frame the Problem',
      color: '#f59e0b',
      desc: 'Synthesise your empathy findings into a clear problem statement. Define the design challenge with a Point of View (POV) or "How Might We" question.',
      prompts: [
        { id: 'needs', label: 'User Needs', hint: 'What are the core needs you identified? Prioritise the most important.', placeholder: 'List the key user needs discovered during empathy research...' },
        { id: 'pov', label: 'Point of View Statement', hint: '[User] needs [need] because [insight].', placeholder: '[User] needs [need] because [surprising insight]...' },
        { id: 'hmw', label: '"How Might We" Questions', hint: 'Reframe the problem as opportunity questions starting with "How might we..."', placeholder: 'HMW 1: How might we...\nHMW 2: How might we...\nHMW 3: How might we...' },
        { id: 'constraints', label: 'Constraints & Criteria', hint: 'What limitations exist? What does success look like?', placeholder: 'Constraints: time, materials, budget, size...\nSuccess criteria: ...' },
      ],
      tools: ['affinitydiagram', 'hmw', 'povstatement'],
      guide: 'Use an Affinity Diagram to cluster your empathy research into themes. Frame "How Might We" questions to open up the problem space. Write a clear POV statement: [User] needs [need] because [insight].',
    },
    {
      id: 'ideate',
      num: 3,
      label: 'Ideate',
      sub: 'Generate Ideas',
      color: '#22c55e',
      desc: 'Generate a wide range of creative solutions. Go for quantity over quality. Build on each other\'s ideas. Defer judgement.',
      prompts: [
        { id: 'brainstorm', label: 'Brainstorm Output', hint: 'List every idea — wild, practical, or in between. Aim for 15+.', placeholder: 'List all brainstormed ideas (the wilder the better at this stage)...' },
        { id: 'selection', label: 'Idea Selection', hint: 'Which 2–3 ideas are strongest? Why?', placeholder: 'Top ideas selected and the reasoning behind each choice...' },
        { id: 'sketch', label: 'Concept Sketches', hint: 'Upload or describe quick sketches for your top ideas.', placeholder: 'Describe your concept sketches or upload images...' },
      ],
      tools: ['crazyeights', 'scamper', 'brainwriting'],
      guide: 'Use Crazy Eights: fold paper into 8 panels, sketch 8 ideas in 8 minutes. Apply SCAMPER (Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse) to push ideas further. Try Brainwriting 6-3-5 for group ideation.',
    },
    {
      id: 'prototype',
      num: 4,
      label: 'Prototype',
      sub: 'Build to Think',
      color: '#3b82f6',
      desc: 'Create quick, low-fidelity representations of your ideas. Prototypes are for learning, not perfection. Build to think and to test.',
      prompts: [
        { id: 'plan', label: 'Prototype Plan', hint: 'What will you make? What materials/tools will you use? What do you want to learn?', placeholder: 'Describe what you will prototype and the questions it should answer...' },
        { id: 'process', label: 'Making Process', hint: 'Document the build with notes and photos. What worked? What didn\'t?', placeholder: 'Step-by-step record of your prototyping process...' },
        { id: 'cad', label: 'Digital Model / CAD Notes', hint: 'If using CAD, note the software, key measurements, and export format.', placeholder: 'CAD software used, file names, dimensions, STL/print settings...' },
        { id: 'safety', label: 'Safety Considerations', hint: 'What safety precautions did you follow during making?', placeholder: 'List safety measures: PPE, workshop rules, material handling...' },
      ],
      tools: ['tinkercad', 'onshape', '3dprint'],
      guide: 'Start low-fidelity: paper, cardboard, tape. Move to digital: TinkerCAD for quick 3D models, Onshape for parametric design. For 3D printing, export STL and check settings: 0.2mm layer height, 20% infill.',
    },
    {
      id: 'test',
      num: 5,
      label: 'Test',
      sub: 'Learn & Iterate',
      color: '#a855f7',
      desc: 'Put your prototype in front of users. Observe, listen, and learn. Testing is not about proving your idea works — it\'s about learning what to improve.',
      prompts: [
        { id: 'testing', label: 'Test Setup', hint: 'Who tested your prototype? What scenario or task did you give them?', placeholder: 'Describe the test: who, where, what task, how observed...' },
        { id: 'feedback', label: 'User Feedback', hint: 'What did users say and do? What surprised you?', placeholder: 'Record feedback: direct quotes, observed behaviour, difficulties...' },
        { id: 'evaluation', label: 'Evaluation Against Criteria', hint: 'How well did the prototype meet your success criteria?', placeholder: 'Rate each success criterion and explain the evidence...' },
        { id: 'iterate', label: 'Iterate — What\'s Next?', hint: 'What will you change? Do you need to go back to an earlier stage?', placeholder: 'Improvements for next iteration. Which stage to revisit if needed...' },
      ],
      tools: ['feedbackgrid', 'forms', 'rubric'],
      guide: 'Use a Feedback Capture Grid (likes, wishes, questions, ideas) to structure testing. Create a simple survey with Google Forms for broader feedback. Evaluate against your success criteria with a rubric.',
    },
  ];

  /* ══════════════════════════════════════════
   * External Tool Links
   * ══════════════════════════════════════════ */

  const EXTERNAL_TOOLS = {
    // Empathise tools
    empathymap:     { icon: '🗺️', name: 'Empathy Map Canvas', desc: 'Think / Feel / Say / Do framework', url: 'https://designkit.org/methods/empathy-map' },
    interview5whys: { icon: '❓', name: '5 Whys Interview', desc: 'Root-cause questioning technique', url: 'https://designkit.org/methods/interview' },
    shadowing:      { icon: '👁️', name: 'User Shadowing Guide', desc: 'Observe users in context', url: 'https://designkit.org/methods/shadowing' },
    // Define tools
    affinitydiagram:{ icon: '📎', name: 'Affinity Diagram', desc: 'Cluster research into themes', url: 'https://designkit.org/methods/affinity-diagram' },
    hmw:            { icon: '💡', name: '"How Might We"', desc: 'Reframe problems as opportunities', url: 'https://designkit.org/methods/how-might-we' },
    povstatement:   { icon: '🎯', name: 'POV Statement', desc: '[User] needs [need] because [insight]', url: 'https://dschool.stanford.edu/resources/design-thinking-bootleg' },
    // Ideate tools
    crazyeights:    { icon: '⚡', name: 'Crazy Eights', desc: '8 ideas in 8 minutes — rapid sketching', url: 'https://designsprintkit.withgoogle.com/methodology/phase3-sketch/crazy-eights' },
    scamper:        { icon: '🔄', name: 'SCAMPER', desc: 'Substitute, Combine, Adapt, Modify...', url: 'https://www.interaction-design.org/literature/article/learn-how-to-use-the-best-ideation-methods-scamper' },
    brainwriting:   { icon: '✏️', name: 'Brainwriting 6-3-5', desc: '6 people, 3 ideas, 5 minutes each', url: 'https://www.interaction-design.org/literature/article/brainwriting' },
    // Prototype tools
    tinkercad:      { icon: '🧊', name: 'TinkerCAD', desc: 'Free 3D modelling for beginners', url: 'https://www.tinkercad.com/' },
    onshape:        { icon: '⚙️', name: 'Onshape', desc: 'Professional parametric CAD (free edu)', url: 'https://www.onshape.com/en/education' },
    '3dprint':      { icon: '🖨️', name: '3D Printing Guide', desc: 'Slicing, settings, troubleshooting', url: 'https://www.simplify3d.com/resources/print-quality-troubleshooting/' },
    // Test tools
    feedbackgrid:   { icon: '📊', name: 'Feedback Capture Grid', desc: 'Likes, wishes, questions, ideas', url: 'https://designsprintkit.withgoogle.com/methodology/phase6-validate/feedback-capture-grid' },
    forms:          { icon: '📋', name: 'Google Forms', desc: 'Create feedback surveys', url: 'https://forms.google.com/' },
    rubric:         { icon: '📝', name: 'Rubric Builder', desc: 'Criteria-based evaluation sheets', url: 'https://www.rcampus.com/rubricshellc.cfm' },
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
        <strong>Design Thinking</strong>
        The 5-stage process is iterative. Testing often leads back to empathy or ideation. Embrace the loop!
      </div>
      ${stage.id === 'ideate' ? `
        <div class="guide-card">
          <strong>Crazy Eights</strong>
          Fold A4 paper into 8 panels. Set a timer for 8 minutes. Sketch one idea per panel — speed forces creativity.
        </div>
        <div class="guide-card">
          <strong>SCAMPER Checklist</strong>
          <strong>S</strong>ubstitute · <strong>C</strong>ombine · <strong>A</strong>dapt · <strong>M</strong>odify · <strong>P</strong>ut to other use · <strong>E</strong>liminate · <strong>R</strong>everse
        </div>
      ` : ''}
      ${stage.id === 'prototype' ? `
        <div class="guide-card">
          <strong>CAD Workflow</strong>
          1. Sketch on paper first<br>
          2. Model in TinkerCAD/Onshape<br>
          3. Export as STL for 3D printing<br>
          4. Check dimensions match constraints
        </div>
        <div class="guide-card">
          <strong>3D Print Settings</strong>
          Layer height: 0.2mm (standard)<br>
          Infill: 20% (normal strength)<br>
          Supports: auto-generate for overhangs &gt;45°
        </div>
      ` : ''}
      ${stage.id === 'test' ? `
        <div class="guide-card">
          <strong>Feedback Capture Grid</strong>
          Draw 4 quadrants: Likes (+), Wishes (△), Questions (?), Ideas (💡). Have testers fill each section.
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
