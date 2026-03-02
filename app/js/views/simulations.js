/*
 * Co-Cher Simulations Gallery
 * ===========================
 * Interactive science practicals gallery and AI-powered custom simulation builder.
 */

import { showToast } from '../components/toast.js';

/* ── Simulation catalogue ── */
const SIMULATIONS = [
  {
    id: 'titration',
    title: 'Acid-Base Titration',
    subject: 'Chemistry',
    description: 'Perform a guided titration practical. Rinse, pipette, titrate, and calculate concentration from concordant results.',
    difficulty: 'Intermediate',
    path: 'simulations/chemistry/titration/index.html'
  },
  {
    id: 'qualitative-analysis',
    title: 'Qualitative Analysis',
    subject: 'Chemistry',
    description: 'Identify unknown ionic compounds using systematic cation and anion tests, flame tests, and observation recording.',
    difficulty: 'Advanced',
    path: 'simulations/chemistry/qualitative-analysis/index.html'
  },
  {
    id: 'pendulum',
    title: 'Simple Pendulum',
    subject: 'Physics',
    description: 'Investigate the relationship between pendulum length, gravity, and period. Collect data and verify T = 2\u03c0\u221a(L/g).',
    difficulty: 'Beginner',
    path: 'simulations/physics/pendulum/index.html'
  },
  {
    id: 'circuits',
    title: 'Simple Circuits',
    subject: 'Physics',
    description: 'Build series and parallel circuits. Measure voltage, current, and resistance with virtual instruments.',
    difficulty: 'Intermediate',
    path: 'simulations/physics/electricity/index.html'
  }
];

/* ── Helpers ── */
function subjectColor(subject) {
  return subject === 'Chemistry' ? '#4361ee' : '#f77f00';
}

function difficultyColor(level) {
  if (level === 'Beginner') return { bg: '#d4edda', fg: '#155724' };
  if (level === 'Intermediate') return { bg: '#fff3cd', fg: '#856404' };
  return { bg: '#f8d7da', fg: '#721c24' };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getCustomSims() {
  try {
    const raw = localStorage.getItem('cocher_custom_sims');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomSims(sims) {
  localStorage.setItem('cocher_custom_sims', JSON.stringify(sims));
}

/* ── Iframe overlay ── */
function openOverlay(container, title, opts) {
  // opts: { src } or { srcdoc }
  const overlay = document.createElement('div');
  overlay.id = 'sim-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:rgba(0,0,0,0.85);animation:simFadeIn 0.2s ease;';

  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#1a1a2e;color:#fff;flex-shrink:0;';
  topBar.innerHTML = `
    <span style="font-weight:600;font-size:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</span>
    <button id="sim-overlay-close" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px 8px;font-size:1.25rem;line-height:1;border-radius:6px;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='none'">&times;</button>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'flex:1;border:none;width:100%;background:#fff;';
  if (opts.src) {
    iframe.src = opts.src;
  } else if (opts.srcdoc) {
    iframe.srcdoc = opts.srcdoc;
  }
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');

  overlay.appendChild(topBar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector('#sim-overlay-close');
  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/* ── Extract HTML from AI response ── */
function extractHTML(text) {
  // Try to find HTML within code fences first
  const fenced = text.match(/```(?:html)?\s*\n?([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // If it starts with <!DOCTYPE or <html, use the whole thing
  const trimmed = text.trim();
  if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
    return trimmed;
  }
  // Last resort: find first <html...> to </html>
  const htmlMatch = trimmed.match(/<html[\s\S]*<\/html>/i);
  if (htmlMatch) return htmlMatch[0];
  // If nothing else, wrap in a basic page
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:sans-serif;background:#1a1a2e;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head><body>${trimmed}</body></html>`;
}

/* ── Derive a short title from the prompt ── */
function deriveTitle(prompt) {
  const cleaned = prompt.replace(/^(create|build|make|generate|design)\s+(a|an|the)?\s*/i, '').trim();
  const first = cleaned.split(/[.\n]/)[0].trim();
  return first.length > 60 ? first.slice(0, 57) + '...' : first || 'Custom Simulation';
}

/* ── Main render ── */
export function render(container) {

  function renderView() {
    const customSims = getCustomSims();
    const isDark = document.documentElement.classList.contains('dark');

    container.innerHTML = `
      <style>
        @keyframes simFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sim-card {
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.2s, transform 0.15s;
          cursor: default;
        }
        .sim-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .dark .sim-card {
          background: var(--bg-card, #1e1e2e);
          border-color: var(--border, #2e2e3e);
        }
        .dark .sim-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .sim-card-body {
          padding: 20px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .sim-card-footer {
          padding: 14px 20px;
          border-top: 1px solid var(--border-light, #f0f0f4);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .dark .sim-card-footer {
          border-top-color: var(--border, #2e2e3e);
        }
        .sim-subject-tag {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #fff;
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 12px;
          width: fit-content;
        }
        .sim-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--ink, #1a1a2e);
          margin-bottom: 8px;
          line-height: 1.3;
        }
        .dark .sim-title {
          color: var(--ink, #e8e8f0);
        }
        .sim-desc {
          font-size: 0.8125rem;
          color: var(--ink-secondary, #555);
          line-height: 1.55;
          flex: 1;
        }
        .dark .sim-desc {
          color: var(--ink-secondary, #aaa);
        }
        .sim-difficulty {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 2px 10px;
          border-radius: 20px;
        }
        .sim-launch-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #4361ee;
          color: #fff;
          border: none;
          padding: 7px 18px;
          border-radius: 8px;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .sim-launch-btn:hover { background: #3a56d4; transform: scale(1.03); }
        .sim-launch-btn:active { transform: scale(0.98); }
        .sim-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .sim-byo-card {
          background: var(--bg-card, #fff);
          border: 2px dashed var(--border, #d0d5dd);
          border-radius: 12px;
          padding: 28px;
          transition: border-color 0.2s;
        }
        .sim-byo-card:hover { border-color: #4361ee; }
        .dark .sim-byo-card {
          background: var(--bg-card, #1e1e2e);
          border-color: var(--border, #3e3e4e);
        }
        .dark .sim-byo-card:hover { border-color: #4361ee; }
        .sim-byo-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--ink, #1a1a2e);
          margin-bottom: 6px;
        }
        .dark .sim-byo-title { color: var(--ink, #e8e8f0); }
        .sim-byo-desc {
          font-size: 0.875rem;
          color: var(--ink-muted, #777);
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .dark .sim-byo-desc { color: var(--ink-muted, #999); }
        .sim-byo-textarea {
          width: 100%;
          min-height: 100px;
          padding: 12px 14px;
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 8px;
          font-size: 0.875rem;
          font-family: inherit;
          resize: vertical;
          background: var(--bg, #fff);
          color: var(--ink, #1a1a2e);
          line-height: 1.5;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .sim-byo-textarea:focus {
          outline: none;
          border-color: #4361ee;
          box-shadow: 0 0 0 3px rgba(67,97,238,0.12);
        }
        .dark .sim-byo-textarea {
          background: var(--bg-subtle, #16161e);
          color: var(--ink, #e8e8f0);
          border-color: var(--border, #3e3e4e);
        }
        .sim-generate-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #4361ee;
          color: #fff;
          border: none;
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 12px;
          transition: background 0.15s, transform 0.1s;
        }
        .sim-generate-btn:hover { background: #3a56d4; }
        .sim-generate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .sim-custom-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 16px;
        }
        .sim-custom-card {
          background: var(--bg-card, #fff);
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.2s;
        }
        .sim-custom-card:hover {
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .dark .sim-custom-card {
          background: var(--bg-card, #1e1e2e);
          border-color: var(--border, #2e2e3e);
        }
        .sim-custom-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--ink, #1a1a2e);
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dark .sim-custom-title { color: var(--ink, #e8e8f0); }
        .sim-custom-date {
          font-size: 0.75rem;
          color: var(--ink-muted, #888);
          margin-bottom: 12px;
        }
        .sim-custom-actions {
          display: flex;
          gap: 8px;
          margin-top: auto;
        }
        .sim-custom-launch {
          flex: 1;
          background: #4361ee;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .sim-custom-launch:hover { background: #3a56d4; }
        .sim-custom-delete {
          background: none;
          border: 1px solid var(--border, #e2e5ea);
          color: var(--ink-muted, #888);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .sim-custom-delete:hover {
          color: #dc3545;
          border-color: #dc3545;
        }
        .dark .sim-custom-delete {
          border-color: var(--border, #3e3e4e);
        }
        .sim-byo-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sim-byo-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ink-secondary, #555);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .dark .sim-byo-label { color: var(--ink-secondary, #aaa); }
        .sim-byo-select, .sim-byo-input {
          padding: 8px 12px;
          border: 1px solid var(--border, #e2e5ea);
          border-radius: 8px;
          font-size: 0.8125rem;
          font-family: inherit;
          background: var(--bg, #fff);
          color: var(--ink, #1a1a2e);
          transition: border-color 0.15s;
        }
        .sim-byo-select:focus, .sim-byo-input:focus {
          outline: none;
          border-color: #4361ee;
          box-shadow: 0 0 0 3px rgba(67,97,238,0.12);
        }
        .dark .sim-byo-select, .dark .sim-byo-input {
          background: var(--bg-subtle, #16161e);
          color: var(--ink, #e8e8f0);
          border-color: var(--border, #3e3e4e);
        }
        .sim-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
          font-size: 0.875rem;
          color: var(--ink-muted, #777);
        }
        .sim-spinner {
          width: 20px;
          height: 20px;
          border: 2.5px solid var(--border, #e2e5ea);
          border-top-color: #4361ee;
          border-radius: 50%;
          animation: simSpin 0.7s linear infinite;
        }
        @keyframes simSpin { to { transform: rotate(360deg); } }
        .sim-section-divider {
          margin: 40px 0 24px;
          border: none;
          border-top: 1px solid var(--border-light, #f0f0f4);
        }
        .dark .sim-section-divider {
          border-top-color: var(--border, #2e2e3e);
        }
      </style>

      <div class="main-scroll">
        <div class="page-container">

          <!-- Header -->
          <div class="page-header" style="margin-bottom: 28px;">
            <div>
              <h1 class="page-title" style="font-size:1.625rem;font-weight:700;color:var(--ink, #1a1a2e);margin:0 0 4px;">Simulations</h1>
              <p class="page-subtitle" style="font-size:0.9375rem;color:var(--ink-muted, #777);margin:0;">Interactive science practicals and custom simulations</p>
            </div>
          </div>

          <!-- Simulation Cards Grid -->
          <div class="sim-grid" id="sim-gallery">
            ${SIMULATIONS.map(sim => {
              const sc = subjectColor(sim.subject);
              const dc = difficultyColor(sim.difficulty);
              return `
                <div class="sim-card">
                  <div class="sim-card-body">
                    <span class="sim-subject-tag" style="background:${sc};">${sim.subject}</span>
                    <div class="sim-title">${sim.title}</div>
                    <div class="sim-desc">${sim.description}</div>
                  </div>
                  <div class="sim-card-footer">
                    <span class="sim-difficulty" style="background:${dc.bg};color:${dc.fg};">${sim.difficulty}</span>
                    <button class="sim-launch-btn" data-sim-id="${sim.id}">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Launch
                    </button>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <!-- Build Your Own Section -->
          <hr class="sim-section-divider" />

          <div class="sim-byo-card" id="sim-byo">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4361ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              <div class="sim-byo-title">Build Your Own Simulation</div>
            </div>
            <div class="sim-byo-desc">Configure the parameters below, then let AI generate an interactive simulation for your lesson.</div>

            <!-- Scaffolded parameters -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
              <div class="sim-byo-field">
                <label class="sim-byo-label">Subject</label>
                <select id="byo-subject" class="sim-byo-select">
                  <option value="">Select...</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Geography">Geography</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="sim-byo-field">
                <label class="sim-byo-label">Level</label>
                <select id="byo-level" class="sim-byo-select">
                  <option value="">Select...</option>
                  <option value="Lower Secondary">Lower Secondary</option>
                  <option value="Upper Secondary">Upper Secondary</option>
                  <option value="JC / Pre-U">JC / Pre-U</option>
                </select>
              </div>
              <div class="sim-byo-field">
                <label class="sim-byo-label">Simulation Type</label>
                <select id="byo-type" class="sim-byo-select">
                  <option value="">Select...</option>
                  <option value="virtual-lab">Virtual Lab Practical</option>
                  <option value="interactive-model">Interactive Model / Diagram</option>
                  <option value="data-collection">Data Collection & Graphing</option>
                  <option value="guided-exploration">Guided Exploration</option>
                  <option value="sandbox">Free-play Sandbox</option>
                </select>
              </div>
              <div class="sim-byo-field">
                <label class="sim-byo-label">Interactivity</label>
                <select id="byo-interactivity" class="sim-byo-select">
                  <option value="sliders">Sliders &amp; Controls</option>
                  <option value="drag-drop">Drag &amp; Drop</option>
                  <option value="click-step">Click-through Steps</option>
                  <option value="combined">Combined</option>
                </select>
              </div>
            </div>

            <div class="sim-byo-field" style="margin-bottom:14px;">
              <label class="sim-byo-label">Topic &amp; Learning Objective</label>
              <input type="text" id="byo-topic" class="sim-byo-input" placeholder="e.g. Electromagnetic induction — show how changing flux produces EMF" />
            </div>

            <div class="sim-byo-field" style="margin-bottom:14px;">
              <label class="sim-byo-label">Key Variables / Parameters to Include</label>
              <input type="text" id="byo-variables" class="sim-byo-input" placeholder="e.g. coil turns, magnet speed, field strength" />
            </div>

            <div class="sim-byo-field" style="margin-bottom:14px;">
              <label class="sim-byo-label">Additional Instructions <span style="font-weight:400;opacity:0.6;">(optional)</span></label>
              <textarea class="sim-byo-textarea" id="sim-prompt" rows="3" placeholder="Any other details: specific apparatus, colour scheme, data table format, guided questions..."></textarea>
            </div>

            <button class="sim-generate-btn" id="sim-generate-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Generate Simulation
            </button>
            <div id="sim-loading" style="display:none;" class="sim-loading">
              <div class="sim-spinner"></div>
              <span>Generating your simulation... This may take a moment.</span>
            </div>
          </div>

          <!-- Previously Generated Sims -->
          ${customSims.length > 0 ? `
            <hr class="sim-section-divider" />
            <div style="margin-bottom: 16px;">
              <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink, #1a1a2e);margin:0 0 4px;">Your Generated Simulations</h2>
              <p style="font-size:0.8125rem;color:var(--ink-muted, #777);margin:0;">Previously created AI-generated simulations</p>
            </div>
            <div class="sim-custom-grid" id="sim-custom-grid">
              ${customSims.map(sim => `
                <div class="sim-custom-card" data-custom-id="${sim.id}">
                  <div class="sim-custom-title" title="${sim.title}">${sim.title}</div>
                  <div class="sim-custom-date">${new Date(sim.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  <div class="sim-custom-actions">
                    <button class="sim-custom-launch" data-custom-launch="${sim.id}">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline;vertical-align:-1px;margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      Launch
                    </button>
                    <button class="sim-custom-delete" data-custom-delete="${sim.id}">Delete</button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

        </div>
      </div>
    `;

    /* ── Event listeners ── */

    // Launch built-in sims
    container.querySelectorAll('[data-sim-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sim = SIMULATIONS.find(s => s.id === btn.dataset.simId);
        if (sim) {
          openOverlay(container, sim.title, { src: sim.path });
        }
      });
    });

    // Launch custom sims
    container.querySelectorAll('[data-custom-launch]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sims = getCustomSims();
        const sim = sims.find(s => s.id === btn.dataset.customLaunch);
        if (sim) {
          openOverlay(container, sim.title, { srcdoc: sim.html });
        }
      });
    });

    // Delete custom sims
    container.querySelectorAll('[data-custom-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.customDelete;
        const sims = getCustomSims().filter(s => s.id !== id);
        saveCustomSims(sims);
        showToast('Simulation deleted', 'default');
        renderView();
      });
    });

    // Generate simulation
    const generateBtn = container.querySelector('#sim-generate-btn');
    const promptArea = container.querySelector('#sim-prompt');
    const loadingEl = container.querySelector('#sim-loading');

    generateBtn.addEventListener('click', async () => {
      const subject = container.querySelector('#byo-subject')?.value || '';
      const level = container.querySelector('#byo-level')?.value || '';
      const simType = container.querySelector('#byo-type')?.value || '';
      const interactivity = container.querySelector('#byo-interactivity')?.value || 'sliders';
      const topic = container.querySelector('#byo-topic')?.value.trim() || '';
      const variables = container.querySelector('#byo-variables')?.value.trim() || '';
      const extra = promptArea.value.trim();

      if (!topic) {
        showToast('Please enter a topic and learning objective.', 'danger');
        container.querySelector('#byo-topic')?.focus();
        return;
      }

      // Build the structured prompt from scaffold fields
      const parts = [`Create an interactive simulation for: ${topic}`];
      if (subject) parts.push(`Subject: ${subject}`);
      if (level) parts.push(`Student level: ${level}`);
      if (simType) parts.push(`Simulation style: ${simType.replace(/-/g, ' ')}`);
      if (interactivity) parts.push(`Interactivity: ${interactivity.replace(/-/g, ' ')}`);
      if (variables) parts.push(`Key variables/parameters: ${variables}`);
      if (extra) parts.push(`Additional instructions: ${extra}`);
      const prompt = parts.join('\n');

      // Check for API key
      const apiKey = localStorage.getItem('cocher_api_key');
      if (!apiKey) {
        showToast('Please set your Anthropic API key in Settings first.', 'danger');
        return;
      }

      // Show loading state
      generateBtn.disabled = true;
      loadingEl.style.display = 'flex';

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            system: `You are LabSim Builder, an expert at creating interactive science simulations for Singapore secondary school / JC students. Generate a complete, self-contained HTML page with embedded CSS and JavaScript. Requirements:
- Dark theme (background #1a1a2e, text #e8e8f0, accent #4361ee)
- Use HTML5 Canvas or SVG for visual elements
- Include labelled interactive controls (sliders, buttons, dropdowns) for each variable
- Show real-time data readouts or a data table where appropriate
- Add a brief instruction/guide panel explaining what to do
- Make it scientifically accurate and educationally meaningful
- The page must be fully self-contained — no external dependencies
- Return ONLY the complete HTML — no explanation or markdown`,
            messages: [
              { role: 'user', content: prompt }
            ]
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err?.error?.message || `API error ${res.status}`;
          throw new Error(msg);
        }

        const data = await res.json();
        const text = data?.content?.[0]?.text;
        if (!text) {
          throw new Error('No response received from the API.');
        }

        const html = extractHTML(text);
        const title = deriveTitle(prompt);
        const newSim = {
          id: generateId(),
          title: title,
          html: html,
          createdAt: Date.now()
        };

        const sims = getCustomSims();
        sims.unshift(newSim);
        saveCustomSims(sims);

        showToast('Simulation generated!', 'success');

        // Re-render to show the new sim, then auto-launch it
        renderView();
        openOverlay(container, title, { srcdoc: html });

      } catch (err) {
        console.error('Simulation generation error:', err);
        showToast(`Generation failed: ${err.message}`, 'danger');
      } finally {
        generateBtn.disabled = false;
        loadingEl.style.display = 'none';
      }
    });
  }

  renderView();
}
