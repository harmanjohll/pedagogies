/*
 * Art Critique Guide Interactive
 * ==============================
 * Feldman Model: Describe → Analyse → Interpret → Judge
 * Guided observation prompts with image upload.
 */

(function () {
  'use strict';

  const STAGES = [
    {
      id: 'describe',
      title: 'Describe',
      color: '#3b82f6',
      subtitle: 'What do you see? List everything visible in the artwork without making judgments.',
      prompts: [
        { label: 'Subject Matter', placeholder: 'What is the artwork about? What objects, people, or scenes can you see?' },
        { label: 'Visual Elements', placeholder: 'Describe the colours, shapes, lines, textures, and forms you observe.' },
        { label: 'Medium & Materials', placeholder: 'What materials or techniques appear to have been used? (e.g. oil paint, watercolour, collage, digital)' },
      ]
    },
    {
      id: 'analyse',
      title: 'Analyse',
      color: '#f59e0b',
      subtitle: 'How is the artwork organised? Look at how the elements work together.',
      prompts: [
        { label: 'Composition & Layout', placeholder: 'How are elements arranged? Is there symmetry, balance, or a focal point?' },
        { label: 'Use of Colour', placeholder: 'Are the colours warm or cool? Bright or muted? How does colour create mood or emphasis?' },
        { label: 'Principles of Design', placeholder: 'Identify pattern, rhythm, contrast, emphasis, movement, unity, or variety in the work.' },
      ]
    },
    {
      id: 'interpret',
      title: 'Interpret',
      color: '#22c55e',
      subtitle: 'What does the artwork mean? What message or feeling does it communicate?',
      prompts: [
        { label: 'Mood & Atmosphere', placeholder: 'What emotions or feelings does the artwork evoke? What atmosphere is created?' },
        { label: 'Meaning & Message', placeholder: 'What do you think the artist is trying to say? What story is being told?' },
        { label: 'Context & Connections', placeholder: 'Does it remind you of anything? What cultural, historical, or personal connections can you make?' },
      ]
    },
    {
      id: 'judge',
      title: 'Judge',
      color: '#ec4899',
      subtitle: 'Is this a successful artwork? Give your opinion with evidence.',
      prompts: [
        { label: 'Overall Impression', placeholder: 'Do you like or dislike this artwork? What is your first reaction and why?' },
        { label: 'Effectiveness', placeholder: 'Does the artwork successfully communicate its message? Why or why not?' },
        { label: 'Personal Response', placeholder: 'Would you display this artwork? What would you change? What have you learned from studying it?' },
      ]
    },
  ];

  let currentStage = 0;
  let responses = {}; // { stageId: { promptIdx: text } }

  // ── Initialise responses ──
  STAGES.forEach(s => { responses[s.id] = {}; });

  // ── Image Upload ──
  function setupImageUpload() {
    const dropZone = document.getElementById('artwork-drop');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const img = document.getElementById('artwork-img');
    const placeholder = document.getElementById('drop-placeholder');

    function showImage(src) {
      img.src = src;
      img.style.display = '';
      placeholder.style.display = 'none';
      dropZone.classList.add('has-image');
    }

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => showImage(reader.result);
      reader.readAsDataURL(file);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => showImage(reader.result);
        reader.readAsDataURL(file);
      }
    });

    // Paste from clipboard
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = () => showImage(reader.result);
          reader.readAsDataURL(file);
          break;
        }
      }
    });

    // Click image to replace
    img.addEventListener('click', () => fileInput.click());
  }

  // ── Render Stage ──
  function renderStage() {
    const stage = STAGES[currentStage];

    // Progress bar
    const progressEl = document.getElementById('stage-progress');
    progressEl.innerHTML = STAGES.map((s, i) => {
      let cls = 'progress-step';
      if (i === currentStage) cls += ' active';
      else if (i < currentStage) cls += ' completed';
      // Check if any responses exist
      const hasContent = Object.values(responses[s.id] || {}).some(v => v && v.trim());
      if (hasContent && i !== currentStage) cls += ' completed';
      return `<div class="${cls}" data-stage="${i}" title="${s.title}"></div>`;
    }).join('');

    // Click progress steps to navigate
    progressEl.querySelectorAll('.progress-step').forEach(el => {
      el.addEventListener('click', () => {
        saveCurrentResponses();
        currentStage = parseInt(el.dataset.stage);
        renderStage();
      });
    });

    // Stage content
    const container = document.getElementById('stage-container');
    container.innerHTML = `
      <div class="stage-card">
        <div class="stage-title" style="color:${stage.color};">${stage.title}</div>
        <div class="stage-subtitle">${stage.subtitle}</div>
        ${stage.prompts.map((p, i) => `
          <div class="prompt-group">
            <div class="prompt-label">
              <span class="prompt-num" style="background:${stage.color};color:#fff;">${i + 1}</span>
              ${p.label}
            </div>
            <textarea class="prompt-textarea" data-prompt="${i}" placeholder="${p.placeholder}">${responses[stage.id][i] || ''}</textarea>
          </div>
        `).join('')}
      </div>
    `;

    // Auto-save on input
    container.querySelectorAll('.prompt-textarea').forEach(ta => {
      ta.addEventListener('input', () => {
        responses[stage.id][ta.dataset.prompt] = ta.value;
      });
    });

    // Navigation
    document.getElementById('prev-btn').disabled = currentStage === 0;
    document.getElementById('next-btn').textContent = currentStage === STAGES.length - 1 ? 'Complete' : 'Next \u2192';
    document.getElementById('stage-indicator').textContent = `${currentStage + 1} / ${STAGES.length}`;
  }

  function saveCurrentResponses() {
    const stage = STAGES[currentStage];
    document.querySelectorAll('.prompt-textarea').forEach(ta => {
      responses[stage.id][ta.dataset.prompt] = ta.value;
    });
  }

  // ── Navigation ──
  function setupNav() {
    document.getElementById('prev-btn').addEventListener('click', () => {
      if (currentStage > 0) {
        saveCurrentResponses();
        currentStage--;
        renderStage();
      }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
      saveCurrentResponses();
      if (currentStage < STAGES.length - 1) {
        currentStage++;
        renderStage();
      }
    });
  }

  // ── Clear / New ──
  function setupClear() {
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (!confirm('Start a new critique? This will clear all responses.')) return;
      STAGES.forEach(s => { responses[s.id] = {}; });
      currentStage = 0;
      document.getElementById('artwork-img').style.display = 'none';
      document.getElementById('drop-placeholder').style.display = '';
      document.getElementById('artwork-drop').classList.remove('has-image');
      document.getElementById('artwork-title').value = '';
      document.getElementById('artwork-artist').value = '';
      renderStage();
    });
  }

  // ── Print ──
  function setupPrint() {
    document.getElementById('print-btn').addEventListener('click', () => {
      saveCurrentResponses();
      // Show all stages for print
      const container = document.getElementById('stage-container');
      let html = '';
      STAGES.forEach(stage => {
        html += `<div style="margin-bottom:24px;page-break-inside:avoid;">
          <h2 style="color:${stage.color};margin-bottom:4px;">${stage.title}</h2>
          <p style="color:#64748b;margin-bottom:12px;">${stage.subtitle}</p>`;
        stage.prompts.forEach((p, i) => {
          const val = responses[stage.id][i] || '(not completed)';
          html += `<div style="margin-bottom:12px;">
            <div style="font-weight:600;font-size:0.8125rem;margin-bottom:4px;">${p.label}</div>
            <div style="padding:8px;background:#f1f5f9;border-radius:6px;font-size:0.8125rem;min-height:40px;white-space:pre-wrap;">${val}</div>
          </div>`;
        });
        html += '</div>';
      });
      container.innerHTML = html;
      window.print();
      // Restore
      renderStage();
    });
  }

  // ── Init ──
  setupImageUpload();
  renderStage();
  setupNav();
  setupClear();
  setupPrint();
})();
