/*
 * Co-Cher+ (Beta) — Autopilot Workflow Agent
 * ============================================
 * Runs the full teaching workflow from start to finish:
 *   Scheme of Work → Lesson Plan → Enactment Resources → Assessment → Reflection Prompts
 *
 * Each step feeds its output as context into the next, and displays a "vision"
 * of the corresponding page's output within this single sub-page.
 */

import { sendChat } from '../api.js';
import { Store } from '../state.js';
import { showToast } from '../components/toast.js';

/* ── Pipeline step definitions ── */

const STEPS = [
  {
    id: 'sow',
    label: 'Scheme of Work',
    icon: '1',
    description: 'Generating a scheme of work overview — topics, sequencing, and E21CC alignment.',
    buildPrompt: (params, _prev) => ({
      system: `You are Co-Cher+, an expert Singapore MOE curriculum designer. Generate a concise Scheme of Work overview.

Include:
## Scheme of Work: [Topic]
### Unit Overview
- Subject, Level, Duration, E21CC Focus

### Learning Outcomes
(3-5 measurable outcomes aligned to E21CC — CAIT, CCI, CGC)

### Topic Sequence
| Week | Topic | Key Concepts | E21CC Domain | Suggested Pedagogy |
(4-6 week plan)

### Assessment Strategy
(Formative + summative approaches)

### Resources & References
(Key resources, textbook chapters, digital tools)

Be specific to Singapore's ${params.subject} syllabus at ${params.level} level. Use markdown.`,
      user: `Create a Scheme of Work for:
- **Subject**: ${params.subject}
- **Topic/Unit**: ${params.topic}
- **Level**: ${params.level}
- **Duration**: ${params.duration || '4-6 weeks'}
${params.notes ? `- **Additional notes**: ${params.notes}` : ''}`
    })
  },
  {
    id: 'lesson',
    label: 'Lesson Plan',
    icon: '2',
    description: 'Designing a detailed lesson plan for one lesson within the scheme.',
    buildPrompt: (params, prev) => ({
      system: `You are Co-Cher+, an expert Singapore lesson designer. Using the Scheme of Work context below, generate a detailed lesson plan for ONE lesson.

## Context — Scheme of Work (generated earlier):
${prev.sow}

---

Format the lesson plan as:

## Lesson Plan: [Lesson Title]

### Lesson Overview
| Field | Detail |
|-------|--------|
| Subject | ... |
| Level | ... |
| Duration | ... |
| E21CC Focus | ... |
| STP Area | ... |

### Learning Intentions
(What students will understand/be able to do)

### Success Criteria
(How students demonstrate understanding — observable, measurable)

### Lesson Flow

#### Opening / Engagement (__ min)
(Hook, prior knowledge activation)

#### Development / Exploration (__ min)
(Core activity, key teaching strategies, student grouping)

#### Consolidation / Closure (__ min)
(Summary, exit ticket, reflection)

### Differentiation
(How to support struggling and stretch advanced learners)

### Teacher Notes
(Key considerations, potential misconceptions, links to STP)

Be practical and classroom-ready. Use markdown.`,
      user: `Design a detailed lesson plan for the first core lesson in this unit.
Subject: ${params.subject}, Level: ${params.level}, Topic: ${params.topic}.`
    })
  },
  {
    id: 'enactment',
    label: 'Enactment Resources',
    icon: '3',
    description: 'Creating classroom resources — stimulus material, discussion prompts, and a worksheet.',
    buildPrompt: (params, prev) => ({
      system: `You are Co-Cher+, a Singapore classroom resources specialist. Using the lesson plan below, generate three enactment resources in one response.

## Context — Lesson Plan (generated earlier):
${prev.lesson}

---

Generate ALL THREE of these in a single response:

## 1. Stimulus Material
A rich, engaging text (150-250 words) — passage, scenario, case study, or data extract — that serves as the lesson's anchor resource. Include 3 suggested questions.

## 2. Discussion Prompts
- **Opening prompt** (spark interest)
- **Deepening prompts** (2-3 questions that push critical thinking — CAIT)
- **Closing prompt** (reflection, personal connection)
Include facilitation tips.

## 3. Worksheet
A student-facing worksheet with:
- Title and learning intention
- 4-6 scaffolded tasks (from recall → application → analysis)
- Space indicators [Write your answer here]
- A reflection box at the end

Make all resources specific to ${params.subject} at ${params.level} level. Use Singapore context where appropriate. Use markdown.`,
      user: `Generate enactment resources (stimulus material, discussion prompts, and worksheet) for this lesson on "${params.topic}".`
    })
  },
  {
    id: 'assessment',
    label: 'Assessment',
    icon: '4',
    description: 'Building assessment items — rubric, exit ticket, and draft questions.',
    buildPrompt: (params, prev) => ({
      system: `You are Co-Cher+, a Singapore assessment specialist. Using the lesson plan and resources below, generate assessment materials.

## Context — Lesson Plan:
${prev.lesson}

## Context — Enactment Resources:
${prev.enactment}

---

Generate ALL of these in a single response:

## 1. Assessment Rubric
A markdown table with 3-4 criteria × 4 levels (Exemplary | Proficient | Developing | Beginning). Align to lesson outcomes and E21CC.

## 2. Exit Ticket
3 quick-check questions:
1. Recall (remembering key content)
2. Apply (using the concept in a new scenario)
3. Think Deeper (analysis or evaluation)

## 3. Draft Assessment Questions
5 questions spanning Bloom's levels:
| Q# | Question | Bloom's Level | Marks | Model Answer |
Include a mix of MCQ, short answer, and structured response.

Make questions specific to ${params.subject} at ${params.level}. Use markdown.`,
      user: `Create assessment materials (rubric, exit ticket, and draft questions) for the lesson on "${params.topic}".`
    })
  },
  {
    id: 'reflection',
    label: 'Reflection Prompts',
    icon: '5',
    description: 'Generating post-lesson reflection prompts and improvement suggestions.',
    buildPrompt: (params, prev) => ({
      system: `You are Co-Cher+, a reflective practice coach for Singapore educators. Using the full lesson context below, generate post-lesson reflection prompts.

## Context — Lesson Plan:
${prev.lesson}

## Context — Assessment:
${prev.assessment}

---

Generate:

## Post-Lesson Reflection Guide

### Quick Pulse Check
- Rate engagement (1-5): what to look for at each level
- Rate understanding (1-5): what to look for at each level

### Reflection Questions
1. **What worked well?** (prompts to consider: student responses, timing, grouping effectiveness)
2. **What would I adjust?** (prompts: pacing, scaffolding, differentiation, resources)
3. **E21CC observations** (Which competencies did I see students developing? Evidence?)
4. **Student voice** (What surprised me? What questions did students ask that I hadn't anticipated?)

### Forward Planning
- 2-3 specific suggestions for the NEXT lesson based on likely outcomes
- How to build on this lesson's momentum
- What to revisit or reteach if needed

### Professional Growth Connection
- Which STP area did this lesson strengthen?
- One thing to try differently next time (with a concrete strategy)

Be warm and encouraging. Frame growth areas as opportunities, not deficiencies. Use markdown.`,
      user: `Generate post-lesson reflection prompts for the lesson on "${params.topic}" (${params.subject}, ${params.level}).`
    })
  }
];

/* ── Simple markdown renderer (mirrors cce.js) ── */

function renderMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.05rem;margin-top:1.2em;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split('|').filter(c => c.trim() !== '');
    if (cells.every(c => /^[\s-:]+$/.test(c))) return ''; // separator row
    const tag = match.includes('---') ? 'td' : 'td';
    return '<tr>' + cells.map(c => `<${tag} style="padding:6px 10px;border:1px solid var(--border-light,#e5e7eb);">${c.trim()}</${tag}>`).join('') + '</tr>';
  });
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:0.8125rem;">$1</table>');

  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[1-3]>)/g, '$1');
  html = html.replace(/(<\/h[1-3]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<table)/g, '$1');
  html = html.replace(/(<\/table>)\s*<\/p>/g, '$1');

  return html;
}

/* ── Render ── */

export function render(container) {
  let running = false;
  let aborted = false;
  let currentStep = -1;          // -1 = not started
  const outputs = {};            // step id → generated text

  function renderView() {
    container.innerHTML = `
      <style>
        .ap-scroll { overflow-y: auto; height: 100%; }
        .ap-container { max-width: 900px; margin: 0 auto; padding: 24px 16px 48px; }
        .ap-header { margin-bottom: 24px; }
        .ap-header h1 { font-size: 1.625rem; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.02em; }
        .ap-header p { font-size: 0.9375rem; color: var(--ink-muted, #777); margin: 0; }
        .ap-beta { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.625rem; font-weight: 700; background: #f59e0b22; color: #f59e0b; margin-left: 8px; vertical-align: middle; letter-spacing: 0.04em; }
        .ap-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
        @media (max-width: 600px) { .ap-form { grid-template-columns: 1fr; } }
        .ap-form .full { grid-column: 1 / -1; }
        .ap-form label { display: block; font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary, #666); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
        .ap-actions { display: flex; gap: 10px; margin-bottom: 28px; }

        /* Pipeline progress */
        .ap-pipeline { display: flex; gap: 0; align-items: flex-start; margin-bottom: 28px; position: relative; }
        .ap-step { flex: 1; text-align: center; position: relative; }
        .ap-step-dot {
          width: 36px; height: 36px; border-radius: 50%; margin: 0 auto 6px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.8125rem;
          border: 2px solid var(--border-light, #e5e7eb);
          background: var(--bg, #fff); color: var(--ink-faint, #aaa);
          transition: all 0.3s ease;
        }
        .ap-step.active .ap-step-dot { border-color: #4361ee; color: #4361ee; box-shadow: 0 0 0 4px #4361ee22; }
        .ap-step.done .ap-step-dot { border-color: #10b981; background: #10b981; color: #fff; }
        .ap-step.error .ap-step-dot { border-color: #ef4444; background: #ef4444; color: #fff; }
        .ap-step-label { font-size: 0.6875rem; font-weight: 600; color: var(--ink-faint, #aaa); }
        .ap-step.active .ap-step-label { color: #4361ee; }
        .ap-step.done .ap-step-label { color: #10b981; }
        .ap-step-line {
          position: absolute; top: 18px; left: 50%; width: 100%; height: 2px;
          background: var(--border-light, #e5e7eb); z-index: 0;
        }
        .ap-step:last-child .ap-step-line { display: none; }
        .ap-step.done .ap-step-line { background: #10b981; }

        /* Output cards */
        .ap-output-card {
          border-radius: 10px; border: 1px solid var(--border-light, #e5e7eb);
          background: var(--bg, #fff); margin-bottom: 16px; overflow: hidden;
        }
        .ap-output-header {
          display: flex; align-items: center; gap: 10px; padding: 12px 16px;
          cursor: pointer; user-select: none;
          border-bottom: 1px solid var(--border-light, #e5e7eb);
        }
        .ap-output-header:hover { background: var(--bg-hover, #f9fafb); }
        .ap-output-icon {
          width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.75rem; flex-shrink: 0;
        }
        .ap-output-title { font-weight: 700; font-size: 0.875rem; flex: 1; }
        .ap-output-chevron { transition: transform 0.2s ease; color: var(--ink-faint, #aaa); }
        .ap-output-chevron.open { transform: rotate(180deg); }
        .ap-output-body {
          padding: 16px 20px; font-size: 0.875rem; line-height: 1.7;
          display: none;
        }
        .ap-output-body.visible { display: block; }
        .ap-output-body h2 { font-size: 1rem; margin-top: 1em; }
        .ap-output-body h3 { font-size: 0.9375rem; margin-top: 0.8em; }
        .ap-output-body ul, .ap-output-body ol { padding-left: 1.5em; }
        .ap-output-body table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 0.8125rem; }

        .ap-generating {
          display: flex; align-items: center; gap: 8px; padding: 16px;
          color: var(--ink-secondary, #666); font-size: 0.8125rem;
        }
        .ap-spinner {
          width: 16px; height: 16px; border: 2px solid var(--border-light, #e5e7eb);
          border-top-color: #4361ee; border-radius: 50%; animation: apSpin 0.6s linear infinite;
        }
        @keyframes apSpin { to { transform: rotate(360deg); } }

        .ap-empty-state {
          text-align: center; padding: 40px 20px; color: var(--ink-secondary, #666);
          border: 2px dashed var(--border-light, #e5e7eb); border-radius: 12px;
        }
        .ap-empty-state p { margin: 8px 0 0; font-size: 0.875rem; }
      </style>

      <div class="ap-scroll">
        <div class="ap-container">

          <div class="ap-header">
            <h1>Co-Cher+<span class="ap-beta">BETA</span></h1>
            <p>Full-workflow autopilot — from Scheme of Work to Reflection, in one go.</p>
          </div>

          <!-- Input form -->
          <div class="ap-form" id="ap-form">
            <div>
              <label for="ap-subject">Subject</label>
              <select id="ap-subject" class="input" style="width:100%;box-sizing:border-box;">
                <option value="">Select...</option>
                <option>English Language</option>
                <option>Mother Tongue</option>
                <option>Mathematics</option>
                <option>Additional Mathematics</option>
                <option>Science</option>
                <option>Physics</option>
                <option>Chemistry</option>
                <option>Biology</option>
                <option>History</option>
                <option>Geography</option>
                <option>Social Studies</option>
                <option>Literature</option>
                <option>Art</option>
                <option>Music</option>
                <option>Physical Education</option>
                <option>Character & Citizenship Education</option>
                <option>General Paper</option>
                <option>Computing</option>
              </select>
            </div>
            <div>
              <label for="ap-level">Level</label>
              <select id="ap-level" class="input" style="width:100%;box-sizing:border-box;">
                <option value="">Select...</option>
                <option>Sec 1</option>
                <option>Sec 2</option>
                <option>Sec 3</option>
                <option>Sec 4</option>
                <option>Sec 5</option>
                <option>JC 1</option>
                <option>JC 2</option>
              </select>
            </div>
            <div class="full">
              <label for="ap-topic">Topic / Unit</label>
              <input id="ap-topic" class="input" type="text" placeholder="e.g. Chemical Bonding, Narrative Writing, The Cold War..." style="width:100%;box-sizing:border-box;">
            </div>
            <div>
              <label for="ap-duration">Duration</label>
              <select id="ap-duration" class="input" style="width:100%;box-sizing:border-box;">
                <option>2 weeks</option>
                <option>3 weeks</option>
                <option selected>4-6 weeks</option>
                <option>One term</option>
              </select>
            </div>
            <div>
              <label for="ap-notes">Additional Notes (optional)</label>
              <input id="ap-notes" class="input" type="text" placeholder="e.g. mixed-ability class, focus on inquiry..." style="width:100%;box-sizing:border-box;">
            </div>
          </div>

          <!-- Action buttons -->
          <div class="ap-actions">
            <button id="ap-run-btn" class="btn btn-primary" style="flex:1;max-width:280px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Run Full Workflow
            </button>
            <button id="ap-stop-btn" class="btn btn-ghost" style="display:none;color:#ef4444;">Stop</button>
          </div>

          <!-- Pipeline progress indicator -->
          <div class="ap-pipeline" id="ap-pipeline" style="${currentStep < 0 ? 'display:none;' : ''}">
            ${STEPS.map((s, i) => {
              let cls = '';
              if (i < currentStep || (i <= currentStep && outputs[s.id])) cls = 'done';
              else if (i === currentStep && running) cls = 'active';
              return `
                <div class="ap-step ${cls}">
                  <div class="ap-step-line"></div>
                  <div class="ap-step-dot">${outputs[s.id] ? '&#10003;' : s.icon}</div>
                  <div class="ap-step-label">${s.label}</div>
                </div>`;
            }).join('')}
          </div>

          <!-- Output cards -->
          <div id="ap-outputs">
            ${currentStep < 0 && Object.keys(outputs).length === 0 ? `
              <div class="ap-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint, #ccc)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                <p>Configure your lesson parameters above, then hit <strong>Run Full Workflow</strong>.<br>
                Co-Cher+ will generate everything from Scheme of Work to Reflection prompts.</p>
              </div>
            ` : ''}

            ${STEPS.map((s, i) => {
              if (!outputs[s.id] && i !== currentStep) return '';
              const isGenerating = i === currentStep && running && !outputs[s.id];
              const colors = {
                sow: '#8b5cf6', lesson: '#4361ee', enactment: '#10b981',
                assessment: '#f59e0b', reflection: '#06b6d4'
              };
              const color = colors[s.id] || '#4361ee';
              return `
                <div class="ap-output-card">
                  <div class="ap-output-header" data-toggle="${s.id}">
                    <div class="ap-output-icon" style="background:${color}18;color:${color};">${s.icon}</div>
                    <div class="ap-output-title">${s.label}</div>
                    ${isGenerating ? '<div class="ap-spinner"></div>' : `
                      <svg class="ap-output-chevron${outputs[s.id] ? ' open' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    `}
                  </div>
                  ${isGenerating ? `
                    <div class="ap-generating">
                      <div class="ap-spinner"></div>
                      <span>${s.description}</span>
                    </div>
                  ` : outputs[s.id] ? `
                    <div class="ap-output-body visible" id="ap-body-${s.id}">
                      ${renderMarkdown(outputs[s.id])}
                    </div>
                  ` : ''}
                </div>`;
            }).join('')}
          </div>

        </div>
      </div>
    `;

    /* ── Wire events ── */

    // Toggle output card bodies
    container.querySelectorAll('.ap-output-header[data-toggle]').forEach(header => {
      header.addEventListener('click', () => {
        const id = header.dataset.toggle;
        const body = container.querySelector(`#ap-body-${id}`);
        const chevron = header.querySelector('.ap-output-chevron');
        if (body) {
          body.classList.toggle('visible');
          if (chevron) chevron.classList.toggle('open');
        }
      });
    });

    // Run button
    const runBtn = container.querySelector('#ap-run-btn');
    const stopBtn = container.querySelector('#ap-stop-btn');

    runBtn.addEventListener('click', () => runPipeline());

    stopBtn.addEventListener('click', () => {
      aborted = true;
      running = false;
      stopBtn.style.display = 'none';
      runBtn.disabled = false;
      showToast('Workflow stopped.', 'warning');
      renderView();
    });
  }

  /* ── Pipeline runner ── */

  async function runPipeline() {
    const subject = container.querySelector('#ap-subject').value;
    const level = container.querySelector('#ap-level').value;
    const topic = container.querySelector('#ap-topic').value.trim();
    const duration = container.querySelector('#ap-duration').value;
    const notes = container.querySelector('#ap-notes').value.trim();

    if (!subject || !level || !topic) {
      showToast('Please fill in Subject, Level, and Topic.', 'warning');
      return;
    }

    const params = { subject, level, topic, duration, notes };

    // Reset state
    running = true;
    aborted = false;
    currentStep = 0;
    for (const key of Object.keys(outputs)) delete outputs[key];

    renderView();
    const runBtn = container.querySelector('#ap-run-btn');
    const stopBtn = container.querySelector('#ap-stop-btn');
    if (runBtn) runBtn.disabled = true;
    if (stopBtn) stopBtn.style.display = '';

    for (let i = 0; i < STEPS.length; i++) {
      if (aborted) break;

      currentStep = i;
      renderView();
      // Re-grab buttons after re-render
      const rb = container.querySelector('#ap-run-btn');
      const sb = container.querySelector('#ap-stop-btn');
      if (rb) rb.disabled = true;
      if (sb) sb.style.display = '';

      const step = STEPS[i];
      const { system, user } = step.buildPrompt(params, outputs);

      try {
        const text = await sendChat(
          [{ role: 'user', content: user }],
          { systemPrompt: system, temperature: 0.7, maxTokens: 4096 }
        );

        if (aborted) break;

        outputs[step.id] = text;
        currentStep = i + 1;
        renderView();
      } catch (err) {
        if (aborted) break;
        console.error(`Co-Cher+ step "${step.id}" failed:`, err);
        showToast(`Step "${step.label}" failed: ${err.message}`, 'danger');
        running = false;
        renderView();
        return;
      }
    }

    running = false;
    if (!aborted) {
      showToast('Full workflow complete!', 'success');
    }
    renderView();
  }

  renderView();
}
