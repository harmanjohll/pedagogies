/*
 * Co-Cher Assessment
 * ==================
 * Three standalone views accessed via separate routes:
 *   AoL — Assessment of Learning (summative, Table of Specifications)
 *   AaL — Assessment as Learning (metacognition, MAI framework)
 *   AfL — Assessment for Learning (formative, Hattie's Visible Learning)
 */

import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { sendChat } from '../api.js';

/* ── Bloom's Cognitive Process Dimension ── */
const BLOOMS = [
  { key: 'remember',   label: 'Remember',   desc: 'Recall facts and basic concepts', verbs: 'define, list, recall, identify, name, state' },
  { key: 'understand', label: 'Understand', desc: 'Explain ideas or concepts', verbs: 'describe, explain, summarise, classify, interpret' },
  { key: 'apply',      label: 'Apply',      desc: 'Use information in new situations', verbs: 'solve, demonstrate, calculate, use, apply' },
  { key: 'analyse',    label: 'Analyse',    desc: 'Draw connections among ideas', verbs: 'compare, contrast, distinguish, examine, categorise' },
  { key: 'evaluate',   label: 'Evaluate',   desc: 'Justify a stand or decision', verbs: 'justify, critique, assess, judge, argue' },
  { key: 'create',     label: 'Create',     desc: 'Produce new or original work', verbs: 'design, construct, develop, formulate, propose' },
];

/* ── Anderson & Krathwohl Knowledge Dimension (2001) ── */
const KNOWLEDGE_DIMS = [
  { key: 'factual',       label: 'Factual',       desc: 'Terminology, specific details and elements',
    ex: { remember: 'list, recognise, recall', understand: 'summarise, classify, explain', apply: 'respond, carry out', analyse: 'differentiate, select', evaluate: 'check, detect', create: 'generate' } },
  { key: 'conceptual',    label: 'Conceptual',    desc: 'Classifications, principles, theories, models',
    ex: { remember: 'recognise, recall', understand: 'interpret, compare, infer', apply: 'implement, use model', analyse: 'organise, attribute', evaluate: 'judge, critique', create: 'plan, design' } },
  { key: 'procedural',    label: 'Procedural',    desc: 'Methods, techniques, algorithms, criteria for use',
    ex: { remember: 'recall steps', understand: 'clarify, predict', apply: 'execute, solve', analyse: 'integrate, verify', evaluate: 'critique method', create: 'construct, devise' } },
  { key: 'metacognitive', label: 'Metacognitive', desc: 'Self-knowledge, awareness of own cognition',
    ex: { remember: 'identify strategies', understand: 'reflect on approach', apply: 'use self-monitoring', analyse: 'examine thinking', evaluate: 'assess own learning', create: 'devise new strategy' } },
];

/* ── MAI Metacognition domains (Schraw & Dennison, 1994) ── */
const MAI_DOMAINS = {
  knowledge: {
    label: 'Knowledge of Cognition',
    desc: 'What learners know about their own thinking processes',
    subs: [
      { key: 'declarative', label: 'Declarative Knowledge', desc: 'Knowing about oneself as a learner — strengths, weaknesses, and what strategies are available.' },
      { key: 'procedural',  label: 'Procedural Knowledge',  desc: 'Knowing how to use learning strategies — when to skim, how to take notes, how to organise information.' },
      { key: 'conditional', label: 'Conditional Knowledge', desc: 'Knowing when and why to use particular strategies — matching strategy to task demands.' },
    ]
  },
  regulation: {
    label: 'Regulation of Cognition',
    desc: 'How learners manage and control their thinking processes',
    subs: [
      { key: 'planning',     label: 'Planning',              desc: 'Goal setting, activating prior knowledge, and allocating time before a task.' },
      { key: 'information',  label: 'Information Management', desc: 'Strategies for processing information — organising, elaborating, summarising, selective focusing.' },
      { key: 'monitoring',   label: 'Comprehension Monitoring', desc: 'Assessing understanding during learning — self-testing, checking pace, questioning.' },
      { key: 'debugging',    label: 'Debugging Strategies',  desc: 'Fixing comprehension failures — re-reading, asking for help, trying a different approach.' },
      { key: 'evaluation',   label: 'Evaluation',            desc: 'Appraising the outcomes of learning — did I meet my goal? What would I do differently?' },
    ]
  }
};

/* ── Hattie's AfL Strategies ── */
const HATTIE_STRATEGIES = [
  { strategy: 'Feedback',                    effect: 0.70, desc: 'Specific information about task performance relative to success criteria.' },
  { strategy: 'Formative Evaluation',        effect: 0.48, desc: 'Using assessment evidence to adapt teaching in real-time.' },
  { strategy: 'Self-Reported Grades',        effect: 1.33, desc: 'Students estimating their own performance — calibrating expectations.' },
  { strategy: 'Classroom Discussion',        effect: 0.82, desc: 'Purposeful dialogue that makes thinking visible.' },
  { strategy: 'Teacher Clarity',             effect: 0.75, desc: 'Clear learning intentions, success criteria, and task expectations.' },
  { strategy: 'Metacognitive Strategies',    effect: 0.60, desc: 'Teaching students to think about their own thinking.' },
  { strategy: 'Questioning',                 effect: 0.48, desc: 'Higher-order and diagnostic questions that reveal understanding.' },
  { strategy: 'Peer Tutoring',              effect: 0.53, desc: 'Students explaining concepts to each other.' },
  { strategy: 'Self-Assessment',            effect: 0.54, desc: 'Students evaluating their own work against criteria.' },
  { strategy: 'Worked Examples',            effect: 0.57, desc: 'Step-by-step demonstrations before independent practice.' },
];

/* ── Shared CSS ── */
const ASSESS_STYLES = `
  .assess-card { background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .dark .assess-card { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
  .assess-section-title { font-size: 1.0625rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .assess-section-desc { font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: 16px; line-height: 1.5; }

  .tos-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin-top: 12px; }
  .tos-table th, .tos-table td { padding: 8px 10px; border: 1px solid var(--border, #e2e5ea); text-align: center; }
  .tos-table th { background: var(--bg-subtle, #f8f9fa); font-weight: 600; color: var(--ink); font-size: 0.75rem; text-transform: uppercase; }
  .tos-table td input {
    width: 50px; padding: 4px; text-align: center; border: 1px solid var(--border, #e2e5ea);
    border-radius: 4px; font-size: 0.8125rem; font-family: inherit; background: var(--bg, #fff); color: var(--ink);
  }
  .dark .tos-table td input { background: var(--bg-subtle, #1e1e2e); color: var(--ink, #e8e8f0); border-color: var(--border, #3e3e4e); }
  .tos-table .tos-obj-cell { text-align: left; font-weight: 500; min-width: 200px; }
  .tos-table .tos-dim-cell { text-align: left; font-weight: 600; min-width: 180px; vertical-align: top; }
  .tos-table .tos-dim-desc { font-size: 0.6875rem; font-weight: 400; color: var(--ink-muted); display: block; margin-top: 2px; }
  .tos-table .tos-total { font-weight: 700; background: var(--accent-light, #eef1fd); }
  .tos-table td[title] { cursor: help; }

  .tos-mode-toggle { display: inline-flex; border: 1px solid var(--border, #e2e5ea); border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
  .tos-mode-btn {
    padding: 8px 18px; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
    border: none; background: transparent; color: var(--ink-muted); transition: all 0.15s;
  }
  .tos-mode-btn.active { background: var(--accent, #4361ee); color: #fff; }
  .tos-mode-btn:not(.active):hover { background: var(--bg-subtle, #f0f0f4); }

  .mai-domain { margin-bottom: 20px; }
  .mai-domain-header { font-size: 0.9375rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .mai-domain-desc { font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: 12px; }
  .mai-sub { padding: 12px 16px; background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea); border-radius: 8px; margin-bottom: 8px; }
  .dark .mai-sub { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
  .mai-sub-label { font-weight: 600; font-size: 0.875rem; color: var(--ink); }
  .mai-sub-desc { font-size: 0.8125rem; color: var(--ink-muted); margin-top: 2px; line-height: 1.5; }

  .hattie-bar { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light, #f0f0f4); }
  .dark .hattie-bar { border-bottom-color: var(--border, #2e2e3e); }
  .hattie-label { flex: 0 0 200px; font-size: 0.8125rem; font-weight: 600; color: var(--ink); }
  .hattie-fill { height: 22px; border-radius: 4px; transition: width 0.4s ease; min-width: 4px; }
  .hattie-effect { flex: 0 0 50px; font-size: 0.8125rem; font-weight: 700; color: var(--ink); text-align: right; font-family: var(--font-mono, monospace); }

  .lisc-box { padding: 16px; border-radius: 10px; border: 1px solid var(--border, #e2e5ea); }
  .dark .lisc-box { border-color: var(--border, #2e2e3e); }
  .lisc-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px; }
  .lisc-content { font-size: 0.875rem; color: var(--ink); line-height: 1.6; }

  .feedback-q { padding: 14px 16px; border-radius: 8px; margin-bottom: 8px; }
  .feedback-q-label { font-weight: 700; font-size: 0.875rem; margin-bottom: 4px; }
  .feedback-q-desc { font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.5; }
`;

/* ── TOS mode state ── */
let tosMode = '1d';

/* ══════════════════════════════════════════════════════
   AoL — Assessment of Learning (Summative / TOS)
   ══════════════════════════════════════════════════════ */

export function renderAoL(container) {
  const lessons = Store.getLessons();

  container.innerHTML = `
    <style>${ASSESS_STYLES}</style>
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header" style="margin-bottom: 8px;">
          <div>
            <h1 class="page-title" style="font-size:1.625rem;">Assessment of Learning</h1>
            <p class="page-subtitle">Summative assessment design — Table of Specifications</p>
          </div>
        </div>

        <div class="assess-card">
          <div class="assess-section-title">Table of Specifications (TOS)</div>
          <div class="assess-section-desc">
            A TOS maps assessment items to cognitive levels, ensuring balanced coverage.
            Choose between the <strong>original 1D taxonomy</strong> (topics × cognitive levels) or the
            <strong>revised 2D taxonomy</strong> (Anderson & Krathwohl — knowledge dimension × cognitive process).
          </div>

          <div class="tos-mode-toggle">
            <button class="tos-mode-btn ${tosMode === '1d' ? 'active' : ''}" data-mode="1d">1D Bloom</button>
            <button class="tos-mode-btn ${tosMode === '2d' ? 'active' : ''}" data-mode="2d">2D Revised Bloom</button>
          </div>

          ${tosMode === '1d' ? render1DInputs(lessons) : render2DInputs(lessons)}

          <div style="display:flex;gap:8px;margin-bottom:16px;">
            <button class="btn btn-primary btn-sm" id="tos-generate-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              AI Suggest Distribution
            </button>
            <button class="btn btn-secondary btn-sm" id="tos-build-btn">Build TOS</button>
          </div>

          <div id="tos-output"></div>
        </div>

        <!-- Bloom's reference -->
        <div class="assess-card">
          <div class="assess-section-title">Bloom's Taxonomy — Quick Reference</div>
          ${tosMode === '2d' ? '<div class="assess-section-desc">The revised taxonomy (Anderson & Krathwohl, 2001) adds a <strong>Knowledge Dimension</strong> intersecting the cognitive process dimension.</div>' : ''}
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:12px;">
            ${BLOOMS.map((b, i) => {
              const colors = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];
              return `
                <div style="padding:12px;border-radius:8px;border:1px solid var(--border,#e2e5ea);border-left:3px solid ${colors[i]};">
                  <div style="font-weight:700;font-size:0.875rem;color:${colors[i]};margin-bottom:2px;">${b.label}</div>
                  <div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:6px;">${b.desc}</div>
                  <div style="font-size:0.6875rem;color:var(--ink-faint);font-style:italic;">${b.verbs}</div>
                </div>`;
            }).join('')}
          </div>
          ${tosMode === '2d' ? renderKnowledgeDimRef() : ''}
        </div>
      </div>
    </div>
  `;

  // Mode toggle
  container.querySelectorAll('.tos-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tosMode = btn.dataset.mode;
      renderAoL(container);
    });
  });

  wireAoLEvents(container, lessons);
}

function render1DInputs(lessons) {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div>
        <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#555);text-transform:uppercase;display:block;margin-bottom:4px;">Source</label>
        <select id="tos-lesson-select" class="input" style="width:100%;">
          <option value="">Manual entry</option>
          ${lessons.map(l => `<option value="${l.id}">${escHtml(l.title || 'Untitled')}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#555);text-transform:uppercase;display:block;margin-bottom:4px;">Total Marks</label>
        <input type="number" id="tos-total-marks" class="input" value="50" min="1" style="width:100%;" />
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#555);text-transform:uppercase;display:block;margin-bottom:4px;">Learning Objectives (one per line)</label>
      <textarea id="tos-objectives" class="input" rows="4" style="width:100%;resize:vertical;font-size:0.8125rem;" placeholder="e.g.\nDescribe the structure of an atom\nExplain ionic and covalent bonding\nPredict products of acid-base reactions"></textarea>
    </div>
  `;
}

function render2DInputs(lessons) {
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div>
        <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#555);text-transform:uppercase;display:block;margin-bottom:4px;">Source (optional)</label>
        <select id="tos-lesson-select" class="input" style="width:100%;">
          <option value="">—</option>
          ${lessons.map(l => `<option value="${l.id}">${escHtml(l.title || 'Untitled')}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#555);text-transform:uppercase;display:block;margin-bottom:4px;">Total Marks</label>
        <input type="number" id="tos-total-marks" class="input" value="50" min="1" style="width:100%;" />
      </div>
    </div>
    <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:12px;">
      The 2D grid maps <strong>Knowledge Dimension</strong> (rows) against <strong>Cognitive Process</strong> (columns).
      Hover cells for example verbs at each intersection.
    </p>
  `;
}

function renderKnowledgeDimRef() {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  return `
    <div style="margin-top:20px;">
      <div style="font-weight:700;font-size:0.9375rem;color:var(--ink);margin-bottom:10px;">Knowledge Dimension (Anderson &amp; Krathwohl)</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">
        ${KNOWLEDGE_DIMS.map((d, i) => `
          <div style="padding:12px;border-radius:8px;border:1px solid var(--border,#e2e5ea);border-left:3px solid ${colors[i]};">
            <div style="font-weight:700;font-size:0.875rem;color:${colors[i]};margin-bottom:2px;">${d.label} Knowledge</div>
            <div style="font-size:0.75rem;color:var(--ink-muted);">${d.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ── 1D TOS table ── */
function build1DTOSTable(objectives, totalMarks) {
  if (!objectives.length) return '<p style="color:var(--ink-muted);font-size:0.8125rem;">Enter objectives above and click "Build TOS".</p>';
  return `
    <table class="tos-table">
      <thead><tr>
        <th style="text-align:left;">Learning Objective</th>
        ${BLOOMS.map(b => `<th title="${b.desc}">${b.label}</th>`).join('')}
        <th>Total</th><th>%</th>
      </tr></thead>
      <tbody>
        ${objectives.map((obj, i) => `<tr>
          <td class="tos-obj-cell">${escHtml(obj)}</td>
          ${BLOOMS.map(b => `<td><input type="number" class="tos-cell" data-row="${i}" data-col="${b.key}" value="0" min="0" /></td>`).join('')}
          <td class="tos-total" data-row-total="${i}">0</td>
          <td class="tos-total" data-row-pct="${i}">0%</td>
        </tr>`).join('')}
        <tr style="font-weight:700;">
          <td style="text-align:left;">Column Total</td>
          ${BLOOMS.map(b => `<td data-col-total="${b.key}">0</td>`).join('')}
          <td data-grand-total>0</td><td>\u2014</td>
        </tr>
        <tr>
          <td style="text-align:left;font-weight:600;">% of Paper</td>
          ${BLOOMS.map(b => `<td data-col-pct="${b.key}">0%</td>`).join('')}
          <td>100%</td><td>\u2014</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:0.75rem;color:var(--ink-muted);margin-top:8px;">Target total: <strong>${totalMarks}</strong> marks.</p>
  `;
}

/* ── 2D TOS table (Knowledge × Cognitive Process) ── */
function build2DTOSTable(totalMarks) {
  return `
    <table class="tos-table">
      <thead><tr>
        <th style="text-align:left;">Knowledge \\ Process</th>
        ${BLOOMS.map(b => `<th title="${b.desc}\n${b.verbs}">${b.label}</th>`).join('')}
        <th>Total</th><th>%</th>
      </tr></thead>
      <tbody>
        ${KNOWLEDGE_DIMS.map((dim, i) => `<tr>
          <td class="tos-dim-cell" title="${dim.desc}">
            ${dim.label}
            <span class="tos-dim-desc">${dim.desc}</span>
          </td>
          ${BLOOMS.map(b => `<td title="${dim.ex[b.key]}"><input type="number" class="tos-cell" data-row="${i}" data-col="${b.key}" value="0" min="0" /></td>`).join('')}
          <td class="tos-total" data-row-total="${i}">0</td>
          <td class="tos-total" data-row-pct="${i}">0%</td>
        </tr>`).join('')}
        <tr style="font-weight:700;">
          <td style="text-align:left;">Column Total</td>
          ${BLOOMS.map(b => `<td data-col-total="${b.key}">0</td>`).join('')}
          <td data-grand-total>0</td><td>\u2014</td>
        </tr>
        <tr>
          <td style="text-align:left;font-weight:600;">% of Paper</td>
          ${BLOOMS.map(b => `<td data-col-pct="${b.key}">0%</td>`).join('')}
          <td>100%</td><td>\u2014</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:0.75rem;color:var(--ink-muted);margin-top:8px;">Target total: <strong>${totalMarks}</strong> marks. Hover cells for example verbs at each intersection.</p>
  `;
}

/* ── AoL event wiring ── */
function wireAoLEvents(container, lessons) {
  const objArea = container.querySelector('#tos-objectives');
  const lessonSel = container.querySelector('#tos-lesson-select');
  const output = container.querySelector('#tos-output');
  const totalInput = container.querySelector('#tos-total-marks');

  // Pre-fill from selected lesson (1D mode only)
  if (lessonSel && objArea) {
    lessonSel.addEventListener('change', () => {
      const lesson = Store.getLesson(lessonSel.value);
      if (lesson && lesson.objectives) {
        objArea.value = lesson.objectives.split(/[;,\n]/).map(o => o.trim()).filter(Boolean).join('\n');
      }
    });
  }

  // Build TOS
  container.querySelector('#tos-build-btn')?.addEventListener('click', () => {
    const total = parseInt(totalInput.value) || 50;
    if (tosMode === '1d') {
      const objs = objArea ? objArea.value.split('\n').map(o => o.trim()).filter(Boolean) : [];
      if (!objs.length) { showToast('Enter at least one learning objective.', 'warning'); return; }
      output.innerHTML = build1DTOSTable(objs, total);
      attachTOSCalc(container, objs.length, total);
    } else {
      output.innerHTML = build2DTOSTable(total);
      attachTOSCalc(container, KNOWLEDGE_DIMS.length, total);
    }
  });

  // AI suggest
  container.querySelector('#tos-generate-btn')?.addEventListener('click', async () => {
    const total = parseInt(totalInput.value) || 50;
    const btn = container.querySelector('#tos-generate-btn');
    btn.disabled = true;
    btn.textContent = 'Generating\u2026';

    try {
      if (tosMode === '1d') {
        const objs = objArea ? objArea.value.split('\n').map(o => o.trim()).filter(Boolean) : [];
        if (!objs.length) { showToast('Enter at least one learning objective.', 'warning'); btn.disabled = false; resetAIBtn(btn); return; }

        const prompt = `Create a Table of Specifications for an assessment with ${total} total marks.\n\nLearning Objectives:\n${objs.map((o,i) => `${i+1}. ${o}`).join('\n')}\n\nDistribute marks across Bloom's taxonomy levels: Remember, Understand, Apply, Analyse, Evaluate, Create.\nReturn ONLY a JSON array of objects, one per objective, like:\n[{"objective":"...","remember":2,"understand":3,"apply":4,"analyse":2,"evaluate":1,"create":0}]\nEnsure total across all objectives sums to exactly ${total}. Weight higher-order thinking appropriately.`;

        const text = await sendChat([{ role: 'user', content: prompt }], {
          systemPrompt: 'You are an assessment design specialist. Return ONLY valid JSON, no explanation.',
          temperature: 0.3, maxTokens: 2048
        });

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          output.innerHTML = build1DTOSTable(objs, total);
          attachTOSCalc(container, objs.length, total);
          data.forEach((row, i) => {
            BLOOMS.forEach(b => {
              const inp = container.querySelector(`.tos-cell[data-row="${i}"][data-col="${b.key}"]`);
              if (inp && row[b.key] !== undefined) inp.value = row[b.key];
            });
          });
          recalcTOS(container, objs.length, total);
        }
      } else {
        // 2D AI suggest
        const lessonCtx = lessonSel?.value ? Store.getLesson(lessonSel.value) : null;
        const context = lessonCtx ? `Lesson: ${lessonCtx.title}. Objectives: ${lessonCtx.objectives || 'not specified'}.` : 'General assessment.';

        const prompt = `Create a 2D Table of Specifications (Anderson & Krathwohl revised taxonomy) for an assessment with ${total} total marks.\n\n${context}\n\nDistribute marks across a 4\u00d76 grid:\nRows (Knowledge Dimension): Factual, Conceptual, Procedural, Metacognitive\nColumns (Cognitive Process): Remember, Understand, Apply, Analyse, Evaluate, Create\n\nReturn ONLY a JSON array of 4 objects (one per knowledge dimension, in order):\n[{"dimension":"factual","remember":2,"understand":3,"apply":4,"analyse":1,"evaluate":0,"create":0},\u2026]\nEnsure total sums to exactly ${total}. Weight appropriately.`;

        const text = await sendChat([{ role: 'user', content: prompt }], {
          systemPrompt: 'You are an assessment design specialist using Anderson & Krathwohl\'s revised taxonomy. Return ONLY valid JSON.',
          temperature: 0.3, maxTokens: 1024
        });

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          output.innerHTML = build2DTOSTable(total);
          attachTOSCalc(container, KNOWLEDGE_DIMS.length, total);
          data.forEach((row, i) => {
            BLOOMS.forEach(b => {
              const inp = container.querySelector(`.tos-cell[data-row="${i}"][data-col="${b.key}"]`);
              if (inp && row[b.key] !== undefined) inp.value = row[b.key];
            });
          });
          recalcTOS(container, KNOWLEDGE_DIMS.length, total);
        }
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'danger');
    } finally {
      btn.disabled = false;
      resetAIBtn(btn);
    }
  });
}

function resetAIBtn(btn) {
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> AI Suggest Distribution';
}

function attachTOSCalc(container, rowCount, totalMarks) {
  container.querySelectorAll('.tos-cell').forEach(input => {
    input.addEventListener('input', () => recalcTOS(container, rowCount, totalMarks));
  });
}

function recalcTOS(container, rowCount, totalMarks) {
  let grandTotal = 0;
  const colTotals = {};
  BLOOMS.forEach(b => colTotals[b.key] = 0);

  for (let i = 0; i < rowCount; i++) {
    let rowTotal = 0;
    BLOOMS.forEach(b => {
      const val = parseInt(container.querySelector(`.tos-cell[data-row="${i}"][data-col="${b.key}"]`)?.value) || 0;
      rowTotal += val;
      colTotals[b.key] += val;
    });
    grandTotal += rowTotal;
    const rowTotalEl = container.querySelector(`[data-row-total="${i}"]`);
    const rowPctEl = container.querySelector(`[data-row-pct="${i}"]`);
    if (rowTotalEl) rowTotalEl.textContent = rowTotal;
    if (rowPctEl) rowPctEl.textContent = totalMarks ? Math.round(rowTotal / totalMarks * 100) + '%' : '0%';
  }

  BLOOMS.forEach(b => {
    const el = container.querySelector(`[data-col-total="${b.key}"]`);
    const pctEl = container.querySelector(`[data-col-pct="${b.key}"]`);
    if (el) el.textContent = colTotals[b.key];
    if (pctEl) pctEl.textContent = totalMarks ? Math.round(colTotals[b.key] / totalMarks * 100) + '%' : '0%';
  });

  const grandEl = container.querySelector('[data-grand-total]');
  if (grandEl) {
    grandEl.textContent = grandTotal;
    grandEl.style.color = grandTotal === totalMarks ? 'var(--success, #22c55e)' : (grandTotal > totalMarks ? 'var(--danger, #ef4444)' : 'var(--ink)');
  }
}


/* ══════════════════════════════════════════════════════
   AaL — Assessment as Learning (Metacognition)
   ══════════════════════════════════════════════════════ */

export function renderAaL(container) {
  container.innerHTML = `
    <style>${ASSESS_STYLES}</style>
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header" style="margin-bottom: 8px;">
          <div>
            <h1 class="page-title" style="font-size:1.625rem;">Assessment as Learning</h1>
            <p class="page-subtitle">Metacognition frameworks and self-regulated learning</p>
          </div>
        </div>

        <!-- MAI Framework -->
        <div class="assess-card">
          <div class="assess-section-title">Metacognitive Awareness Inventory (MAI)</div>
          <div class="assess-section-desc">
            Based on Schraw &amp; Dennison (1994), the MAI measures two broad domains of metacognition.
            Use these as a framework for teaching students to become more self-aware, strategic learners.
          </div>

          ${Object.entries(MAI_DOMAINS).map(([key, domain]) => `
            <div class="mai-domain">
              <div class="mai-domain-header">${domain.label}</div>
              <div class="mai-domain-desc">${domain.desc}</div>
              ${domain.subs.map(sub => `
                <div class="mai-sub">
                  <div class="mai-sub-label">${sub.label}</div>
                  <div class="mai-sub-desc">${sub.desc}</div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>

        <!-- Reflection Prompt Generator -->
        <div class="assess-card">
          <div class="assess-section-title">Metacognitive Reflection Prompt Generator</div>
          <div class="assess-section-desc">
            Generate reflection prompts for students to develop metacognitive awareness.
            Select a domain focus and the AI will create age-appropriate prompts aligned to Singapore\u2019s curriculum context.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Focus Domain</label>
              <select id="aal-domain" class="input" style="width:100%;">
                <option value="planning">Planning \u2014 Before Learning</option>
                <option value="monitoring">Monitoring \u2014 During Learning</option>
                <option value="evaluation">Evaluation \u2014 After Learning</option>
                <option value="debugging">Debugging \u2014 When Stuck</option>
                <option value="general">General Metacognition</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Subject Context</label>
              <input type="text" id="aal-subject" class="input" placeholder="e.g. Chemistry, Math\u2026" style="width:100%;" />
            </div>
          </div>

          <button class="btn btn-primary btn-sm" id="aal-generate-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Generate Reflection Prompts
          </button>
          <div id="aal-output" style="margin-top:12px;"></div>
        </div>

        <!-- SRL Strategies -->
        <div class="assess-card">
          <div class="assess-section-title">Self-Regulated Learning (SRL) Strategies</div>
          <div class="assess-section-desc">Key strategies teachers can model and scaffold for students.</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">
            ${[
              { title: 'Think-Aloud', desc: 'Teacher verbalises thought process while solving a problem, making invisible thinking visible to students.' },
              { title: 'KWL Chart', desc: 'What I Know / What I Want to Know / What I Learned \u2014 activates prior knowledge and sets learning goals.' },
              { title: 'Wrapper Activity', desc: 'Brief pre- and post-task reflection (e.g., \u201cHow will I approach this?\u201d \u2192 task \u2192 \u201cWhat worked?\u201d).' },
              { title: 'Error Analysis', desc: 'Students examine their own mistakes, classify error types, and plan how to avoid them.' },
              { title: 'Learning Journals', desc: 'Regular reflective entries about what was learned, what was difficult, and strategies used.' },
              { title: 'Exam Wrappers', desc: 'Post-test reflection: How did you prepare? What types of errors did you make? What will you do differently?' },
            ].map(s => `
              <div style="padding:12px;border:1px solid var(--border,#e2e5ea);border-radius:8px;">
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:4px;">${s.title}</div>
                <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">${s.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  wireAaLEvents(container);
}

function wireAaLEvents(container) {
  container.querySelector('#aal-generate-btn')?.addEventListener('click', async () => {
    const domain = container.querySelector('#aal-domain')?.value || 'general';
    const subject = container.querySelector('#aal-subject')?.value.trim() || '';
    const output = container.querySelector('#aal-output');
    const btn = container.querySelector('#aal-generate-btn');

    btn.disabled = true;
    btn.textContent = 'Generating\u2026';
    output.innerHTML = '<p style="color:var(--ink-muted);font-size:0.8125rem;">Generating prompts\u2026</p>';

    try {
      const prompt = `Generate 5 metacognitive reflection prompts for Singapore secondary students.
Focus: ${domain} (${domain === 'planning' ? 'before learning' : domain === 'monitoring' ? 'during learning' : domain === 'evaluation' ? 'after learning' : domain === 'debugging' ? 'when stuck' : 'general'})
${subject ? `Subject context: ${subject}` : ''}

Format each as a numbered question. Make them concrete, student-friendly, and appropriate for 13-17 year olds.`;

      const text = await sendChat([{ role: 'user', content: prompt }], {
        systemPrompt: 'You are a metacognition specialist for Singapore schools. Generate clear, practical reflection prompts.',
        temperature: 0.6, maxTokens: 1024
      });

      output.innerHTML = `<div style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);font-size:0.875rem;line-height:1.7;color:var(--ink);white-space:pre-wrap;">${escHtml(text)}</div>`;
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate Reflection Prompts';
    }
  });
}


/* ══════════════════════════════════════════════════════
   AfL — Assessment for Learning (Hattie / Formative)
   ══════════════════════════════════════════════════════ */

export function renderAfL(container) {
  const maxEffect = Math.max(...HATTIE_STRATEGIES.map(s => s.effect));
  const sorted = [...HATTIE_STRATEGIES].sort((a, b) => b.effect - a.effect);

  container.innerHTML = `
    <style>${ASSESS_STYLES}</style>
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header" style="margin-bottom: 8px;">
          <div>
            <h1 class="page-title" style="font-size:1.625rem;">Assessment for Learning</h1>
            <p class="page-subtitle">Formative assessment strategies from Hattie\u2019s Visible Learning</p>
          </div>
        </div>

        <!-- LISC Framework -->
        <div class="assess-card">
          <div class="assess-section-title">Learning Intentions &amp; Success Criteria (LISC)</div>
          <div class="assess-section-desc">
            Hattie\u2019s research shows that <strong>teacher clarity</strong> (d=0.75) is one of the most powerful influences on learning.
            LISC provides a structure: tell students what they\u2019re learning, why, and how they\u2019ll know they\u2019ve succeeded.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
            <div class="lisc-box" style="background:rgba(59,130,246,0.06);">
              <div class="lisc-label" style="color:#3b82f6;">Learning Intention (LI)</div>
              <div class="lisc-content">
                <strong>What</strong> students will learn \u2014 stated in terms of knowledge, skills, or understanding.<br>
                <em style="color:var(--ink-muted);font-size:0.8125rem;">Example: \u201cWe are learning to explain how ionic bonds form between metals and non-metals.\u201d</em>
              </div>
            </div>
            <div class="lisc-box" style="background:rgba(16,185,129,0.06);">
              <div class="lisc-label" style="color:#10b981;">Success Criteria (SC)</div>
              <div class="lisc-content">
                <strong>How</strong> students will know they\u2019ve succeeded \u2014 observable, measurable indicators.<br>
                <em style="color:var(--ink-muted);font-size:0.8125rem;">Example: \u201cI can draw a dot-and-cross diagram showing electron transfer in NaCl.\u201d</em>
              </div>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Topic / Lesson Focus</label>
            <input type="text" id="afl-lisc-topic" class="input" placeholder="e.g. Chemical bonding \u2014 ionic compounds" style="width:100%;" />
          </div>
          <button class="btn btn-primary btn-sm" id="afl-lisc-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Generate LISC
          </button>
          <div id="afl-lisc-output" style="margin-top:12px;"></div>
        </div>

        <!-- Hattie's Feedback Model -->
        <div class="assess-card">
          <div class="assess-section-title">Hattie\u2019s Feedback Model</div>
          <div class="assess-section-desc">
            Effective feedback answers three questions for the learner. The most powerful feedback is specific, timely, and actionable.
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;">
            <div class="feedback-q" style="background:rgba(59,130,246,0.06);">
              <div class="feedback-q-label" style="color:#3b82f6;">Feed Up \u2014 \u201cWhere am I going?\u201d</div>
              <div class="feedback-q-desc">Clarify the learning goal and success criteria. Students need to understand what success looks like before they can assess their progress.</div>
            </div>
            <div class="feedback-q" style="background:rgba(245,158,11,0.06);">
              <div class="feedback-q-label" style="color:#f59e0b;">Feed Back \u2014 \u201cHow am I going?\u201d</div>
              <div class="feedback-q-desc">Provide information about current performance relative to the goal. Focus on the task and process, not the person. Be specific about what was done well and what needs work.</div>
            </div>
            <div class="feedback-q" style="background:rgba(16,185,129,0.06);">
              <div class="feedback-q-label" style="color:#10b981;">Feed Forward \u2014 \u201cWhere to next?\u201d</div>
              <div class="feedback-q-desc">Guide the learner on what to do to improve. Provide actionable next steps, not just grades or scores. This is the most powerful component.</div>
            </div>
          </div>
        </div>

        <!-- Effect Sizes Chart -->
        <div class="assess-card">
          <div class="assess-section-title">Formative Assessment Strategies \u2014 Effect Sizes (Hattie)</div>
          <div class="assess-section-desc">
            From Hattie\u2019s <em>Visible Learning</em> meta-analyses. Effect size d=0.40 is the \u201chinge point\u201d \u2014
            strategies above this threshold accelerate learning beyond typical growth.
            <span style="display:inline-block;width:12px;height:12px;background:rgba(239,68,68,0.15);border-left:2px solid #ef4444;margin:0 4px;vertical-align:middle;"></span> d=0.40 threshold shown.
          </div>

          <div style="margin-top:8px;">
            ${sorted.map(s => {
              const pct = Math.round((s.effect / maxEffect) * 100);
              const color = s.effect >= 0.6 ? '#22c55e' : s.effect >= 0.4 ? '#4361ee' : '#f59e0b';
              return `
                <div class="hattie-bar">
                  <div class="hattie-label">${s.strategy}</div>
                  <div style="flex:1;background:var(--bg-subtle,#f0f0f4);border-radius:4px;position:relative;">
                    <div class="hattie-fill" style="width:${pct}%;background:${color};"></div>
                    <div style="position:absolute;left:${Math.round(0.4/maxEffect*100)}%;top:0;bottom:0;width:2px;background:#ef4444;opacity:0.5;" title="d=0.40 hinge point"></div>
                  </div>
                  <div class="hattie-effect">${s.effect.toFixed(2)}</div>
                </div>`;
            }).join('')}
          </div>
          <p style="font-size:0.75rem;color:var(--ink-muted);margin-top:8px;">Source: Hattie, J. (2023). <em>Visible Learning: The Sequel.</em> Effect sizes are indicative and context-dependent.</p>
        </div>
      </div>
    </div>
  `;

  wireAfLEvents(container);
}

function wireAfLEvents(container) {
  container.querySelector('#afl-lisc-btn')?.addEventListener('click', async () => {
    const topic = container.querySelector('#afl-lisc-topic')?.value.trim();
    if (!topic) { showToast('Enter a topic or lesson focus.', 'warning'); return; }

    const output = container.querySelector('#afl-lisc-output');
    const btn = container.querySelector('#afl-lisc-btn');
    btn.disabled = true;
    btn.textContent = 'Generating\u2026';

    try {
      const text = await sendChat([{
        role: 'user',
        content: `Generate Learning Intentions and Success Criteria for: ${topic}\n\nFormat:\n**Learning Intention:** We are learning to...\n\n**Success Criteria:**\n- I can...\n- I can...\n- I can...\n\nAlso suggest 2 formative check questions a teacher could ask during the lesson.`
      }], {
        systemPrompt: 'You are a Visible Learning specialist for Singapore secondary schools. Generate clear, student-friendly LISC aligned to Singapore MOE curriculum.',
        temperature: 0.5, maxTokens: 1024
      });

      output.innerHTML = `<div style="padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);font-size:0.875rem;line-height:1.7;color:var(--ink);white-space:pre-wrap;">${escHtml(text)}</div>`;
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate LISC';
    }
  });
}

/* ── Utility ── */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
