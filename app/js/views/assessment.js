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
      { key: 'declarative', label: 'Declarative Knowledge', desc: 'Knowing about oneself as a learner \u2014 strengths, weaknesses, and what strategies are available.' },
      { key: 'procedural',  label: 'Procedural Knowledge',  desc: 'Knowing how to use learning strategies \u2014 when to skim, how to take notes, how to organise information.' },
      { key: 'conditional', label: 'Conditional Knowledge', desc: 'Knowing when and why to use particular strategies \u2014 matching strategy to task demands.' },
    ]
  },
  regulation: {
    label: 'Regulation of Cognition',
    desc: 'How learners manage and control their thinking processes',
    subs: [
      { key: 'planning',     label: 'Planning',              desc: 'Goal setting, activating prior knowledge, and allocating time before a task.' },
      { key: 'information',  label: 'Information Management', desc: 'Strategies for processing information \u2014 organising, elaborating, summarising, selective focusing.' },
      { key: 'monitoring',   label: 'Comprehension Monitoring', desc: 'Assessing understanding during learning \u2014 self-testing, checking pace, questioning.' },
      { key: 'debugging',    label: 'Debugging Strategies',  desc: 'Fixing comprehension failures \u2014 re-reading, asking for help, trying a different approach.' },
      { key: 'evaluation',   label: 'Evaluation',            desc: 'Appraising the outcomes of learning \u2014 did I meet my goal? What would I do differently?' },
    ]
  }
};

/* ── SRL Strategies with topic-specific applications ── */
const SRL_STRATEGIES = [
  { title: 'Think-Aloud', desc: 'Teacher verbalises thought process while solving a problem, making invisible thinking visible to students.',
    applications: {
      Science: 'Model scientific reasoning: "I notice the test tube changed colour, so I\u2019m thinking an exothermic reaction occurred because\u2026"',
      Mathematics: 'Walk through problem-solving steps: "First I identify what\u2019s given, then I choose the formula\u2026"',
      English: 'Demonstrate reading comprehension: "This phrase suggests the author feels\u2026 I\u2019m connecting it to the earlier paragraph where\u2026"',
      Humanities: 'Model source analysis: "The date tells me this was during the Cold War, so I should consider\u2026"',
      default: 'Verbalise your decision-making process step by step so students can see how an expert thinks through the task.'
    }},
  { title: 'KWL Chart', desc: 'What I Know / What I Want to Know / What I Learned \u2014 activates prior knowledge and sets learning goals.',
    applications: {
      Science: 'Before a new topic (e.g., Electricity): K \u2014 "Batteries store energy", W \u2014 "How does current flow?", L \u2014 filled after experiments.',
      Mathematics: 'Before a new chapter: K \u2014 "I know how to solve linear equations", W \u2014 "How do quadratics differ?", L \u2014 after practice.',
      English: 'Before studying a new text: K \u2014 "I know about narrative perspective", W \u2014 "How does this author use it?", L \u2014 post-reading.',
      Humanities: 'Before a new unit: K \u2014 "I know WWII started in 1939", W \u2014 "What caused the Pacific front?", L \u2014 after sources study.',
      default: 'Have students fill in K and W columns before the lesson, then complete L at the end to track their own learning journey.'
    }},
  { title: 'Wrapper Activity', desc: 'Brief pre- and post-task reflection (e.g., \u201cHow will I approach this?\u201d \u2192 task \u2192 \u201cWhat worked?\u201d).',
    applications: {
      Science: 'Before a practical: "What safety steps will I follow?" After: "Did my prediction match the results? Why or why not?"',
      Mathematics: 'Before a problem set: "Which methods will I try first?" After: "Where did I get stuck and what helped me move forward?"',
      English: 'Before essay writing: "What structure will I use?" After: "Did I address the question fully? What could be stronger?"',
      Humanities: 'Before source-based work: "What biases might I encounter?" After: "Did I cross-reference enough sources?"',
      default: 'Ask students to briefly plan their approach before the task, then reflect on what worked and what they\u2019d change.'
    }},
  { title: 'Error Analysis', desc: 'Students examine their own mistakes, classify error types, and plan how to avoid them.',
    applications: {
      Science: 'Classify errors as conceptual (misunderstood the concept), procedural (wrong method), or careless (calculation slip).',
      Mathematics: 'Sort mistakes into categories: sign errors, wrong formula, misread question, or conceptual gap \u2014 then target each.',
      English: 'Review marked essays for patterns: grammar, argument structure, evidence use \u2014 create a personal improvement checklist.',
      Humanities: 'Analyse test answers: Did I misinterpret the source? Lack evidence? Miss the command word? Plan targeted revision.',
      default: 'Have students categorise their mistakes, identify patterns, and create a personal action plan for improvement.'
    }},
  { title: 'Learning Journals', desc: 'Regular reflective entries about what was learned, what was difficult, and strategies used.',
    applications: {
      Science: 'After each practical: "What did I observe? What confused me? How does this connect to the theory we learned?"',
      Mathematics: 'Weekly entries: "This week I learned\u2026 The hardest part was\u2026 I overcame it by\u2026"',
      English: 'Reading logs: "Today\u2019s passage made me think about\u2026 I found the vocabulary challenging because\u2026"',
      Humanities: 'Reflective diary: "The most surprising thing I learned was\u2026 It changed my perspective on\u2026"',
      default: 'Prompt students with structured questions to write brief reflections regularly, building a habit of self-awareness.'
    }},
  { title: 'Exam Wrappers', desc: 'Post-test reflection: How did you prepare? What types of errors did you make? What will you do differently?',
    applications: {
      Science: 'After a test: "I studied \u2026 hours. My errors were mostly in (topic). Next time I will revise (specific area) using (method)."',
      Mathematics: 'After a quiz: "I practised \u2026 questions. I lost marks on (topic). I\u2019ll do more timed practice on (specific skill)."',
      English: 'After a composition: "My weakest area was (e.g., paragraph transitions). I\u2019ll practise by (specific strategy)."',
      Humanities: 'After an exam: "I was confident on (topics) but weak on (topics). I need to focus on (source skills / essay structure)."',
      default: 'Return the graded assessment with a structured reflection sheet. Students analyse their preparation, errors, and next steps.'
    }},
];

/* ── Hattie's AfL Strategies ── */
const HATTIE_STRATEGIES = [
  { strategy: 'Feedback',                    effect: 0.70, desc: 'Specific information about task performance relative to success criteria.' },
  { strategy: 'Formative Evaluation',        effect: 0.48, desc: 'Using assessment evidence to adapt teaching in real-time.' },
  { strategy: 'Self-Reported Grades',        effect: 1.33, desc: 'Students estimating their own performance \u2014 calibrating expectations.' },
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

  .ai-output-box {
    padding: 16px; border: 1px solid var(--border); border-radius: 8px;
    background: var(--bg-card); font-size: 0.875rem; line-height: 1.7;
    color: var(--ink); white-space: pre-wrap;
    max-height: 400px; overflow-y: auto; position: relative;
  }
  .ai-output-box.expanded { max-height: none; }
  .ai-output-toggle {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 8px; padding: 4px 10px; font-size: 0.75rem; font-weight: 600;
    color: var(--accent, #4361ee); background: none; border: 1px solid var(--accent, #4361ee);
    border-radius: 6px; cursor: pointer; transition: all 0.15s;
  }
  .ai-output-toggle:hover { background: var(--accent, #4361ee); color: #fff; }

  .tos-table-wrap { width: 100%; overflow-x: auto; margin-top: 12px; }
  .tos-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  .tos-table th, .tos-table td { padding: 8px 10px; border: 1px solid var(--border, #e2e5ea); text-align: center; }
  .tos-table th { background: var(--bg-subtle, #f8f9fa); font-weight: 600; color: var(--ink); font-size: 0.75rem; text-transform: uppercase; }
  .tos-table td input {
    width: 50px; padding: 4px; text-align: center; border: 1px solid var(--border, #e2e5ea);
    border-radius: 4px; font-size: 0.8125rem; font-family: inherit; background: var(--bg, #fff); color: var(--ink);
  }
  .dark .tos-table td input { background: var(--bg-subtle, #1e1e2e); color: var(--ink, #e8e8f0); border-color: var(--border, #3e3e4e); }
  .tos-table .tos-obj-cell { text-align: left; font-weight: 500; min-width: 200px; }
  .tos-table .tos-dim-cell { text-align: left; font-weight: 600; min-width: 140px; vertical-align: top; white-space: normal; word-wrap: break-word; }
  .tos-table .tos-dim-desc { font-size: 0.6875rem; font-weight: 400; color: var(--ink-muted); display: block; margin-top: 2px; }
  .tos-table .tos-total { font-weight: 700; background: var(--accent-light, #eef1fd); }
  .tos-table td[title] { cursor: help; }

  .tos-2d-obj-cell {
    text-align: left; font-weight: 500; min-width: 120px; max-width: 260px;
    font-size: 0.75rem; line-height: 1.4; white-space: normal; word-wrap: break-word;
    vertical-align: top; padding: 6px 8px;
  }
  .tos-2d-obj-label { font-weight: 700; font-size: 0.8125rem; color: var(--ink); }
  .tos-2d-obj-desc { color: var(--ink-muted); margin-top: 1px; }

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

  .srl-card { padding: 12px; border: 1px solid var(--border, #e2e5ea); border-radius: 8px; cursor: pointer; transition: all 0.15s; }
  .srl-card:hover { border-color: var(--accent, #4361ee); box-shadow: 0 2px 8px rgba(67,97,238,0.1); }
  .srl-card.active { border-color: var(--accent, #4361ee); background: rgba(67,97,238,0.04); }
  .srl-detail-panel {
    margin-top: 12px; padding: 16px; border: 1px solid var(--accent, #4361ee);
    border-radius: 10px; background: rgba(67,97,238,0.03);
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  .srl-detail-panel .srl-app-item {
    padding: 8px 12px; border-radius: 6px; margin-bottom: 6px;
    background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e5ea);
    font-size: 0.8125rem; line-height: 1.5; color: var(--ink);
  }
  .dark .srl-detail-panel .srl-app-item { background: var(--bg-card, #1e1e2e); border-color: var(--border, #2e2e3e); }
  .srl-app-subject { font-weight: 700; font-size: 0.75rem; text-transform: uppercase; color: var(--accent, #4361ee); margin-bottom: 2px; }

  .class-topic-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  @media (max-width: 600px) { .class-topic-grid { grid-template-columns: 1fr; } }
`;

/* ── TOS mode state ── */
let tosMode = '1d';

/* ── Helper: build class dropdown options ── */
function classDropdownOptions(includeEmpty = true) {
  const classes = Store.getClasses();
  let html = includeEmpty ? '<option value="">-- Select a class --</option>' : '';
  classes.forEach(cls => {
    const label = cls.subject ? `${escHtml(cls.name)} (${escHtml(cls.subject)})` : escHtml(cls.name);
    html += `<option value="${cls.id}">${label}</option>`;
  });
  if (!classes.length) {
    html = '<option value="">No classes yet \u2014 add via Classes page</option>';
  }
  return html;
}

/* ── Helper: get topics for a class from its lessons ── */
function getTopicsForClass(classId) {
  if (!classId) return [];
  const lessons = Store.getLessonsForClass(classId);
  return lessons.map(l => ({
    id: l.id,
    title: l.title || 'Untitled',
    objectives: l.objectives || ''
  })).filter(l => l.title !== 'Untitled' || l.objectives);
}

/* ── Helper: render AI output with scroll + expand toggle ── */
function renderAIOutput(text) {
  return `
    <div class="ai-output-box" id="ai-result-box">${escHtml(text)}</div>
    <button class="ai-output-toggle" id="ai-expand-toggle">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
      Expand / Collapse
    </button>
  `;
}

function wireExpandToggle(container) {
  const toggle = container.querySelector('#ai-expand-toggle');
  const box = container.querySelector('#ai-result-box');
  if (toggle && box) {
    toggle.addEventListener('click', () => box.classList.toggle('expanded'));
  }
}


/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   AoL \u2014 Assessment of Learning (Summative / TOS)
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

export function renderAoL(container) {
  const lessons = Store.getLessons();

  container.innerHTML = `
    <style>${ASSESS_STYLES}</style>
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header" style="margin-bottom: 8px;">
          <div>
            <h1 class="page-title" style="font-size:1.625rem;">Assessment of Learning</h1>
            <p class="page-subtitle">Summative assessment design \u2014 Table of Specifications</p>
          </div>
        </div>

        <div class="assess-card">
          <div class="assess-section-title">Table of Specifications (TOS)</div>
          <div class="assess-section-desc">
            A TOS maps assessment items to cognitive levels, ensuring balanced coverage.
            Choose between the <strong>original 1D taxonomy</strong> (topics \u00d7 cognitive levels) or the
            <strong>revised 2D taxonomy</strong> (Anderson & Krathwohl \u2014 knowledge dimension \u00d7 cognitive process).
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
          <div class="assess-section-title">Bloom's Taxonomy \u2014 Quick Reference</div>
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
          <option value="">\u2014</option>
          ${lessons.map(l => `<option value="${l.id}">${escHtml(l.title || 'Untitled')}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#555);text-transform:uppercase;display:block;margin-bottom:4px;">Total Marks</label>
        <input type="number" id="tos-total-marks" class="input" value="50" min="1" style="width:100%;" />
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#555);text-transform:uppercase;display:block;margin-bottom:4px;">Learning Objectives (one per line, optional)</label>
      <textarea id="tos-2d-objectives" class="input" rows="3" style="width:100%;resize:vertical;font-size:0.8125rem;" placeholder="e.g.\nExplain the concept of chemical equilibrium\nApply Le Chatelier's principle to predict shifts\n(Leave blank for a generic Knowledge Dimension \u00d7 Process grid)"></textarea>
    </div>
    <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:12px;">
      The 2D grid maps <strong>Knowledge Dimension</strong> (rows) against <strong>Cognitive Process</strong> (columns).
      ${`Add objectives above to create a richer table with objectives mapped to each knowledge dimension, or leave blank for the standard 4\u00d76 grid.`}
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

/* \u2500\u2500 1D TOS table \u2500\u2500 */
function build1DTOSTable(objectives, totalMarks) {
  if (!objectives.length) return '<p style="color:var(--ink-muted);font-size:0.8125rem;">Enter objectives above and click "Build TOS".</p>';
  return `
    <div class="tos-table-wrap">
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
    </div>
    <p style="font-size:0.75rem;color:var(--ink-muted);margin-top:8px;">Target total: <strong>${totalMarks}</strong> marks.</p>
  `;
}

/* \u2500\u2500 2D TOS table (Knowledge \u00d7 Cognitive Process) with objectives support \u2500\u2500 */
function build2DTOSTable(totalMarks, objectives) {
  const hasObj = objectives && objectives.length > 0;
  return `
    <div class="tos-table-wrap">
    <table class="tos-table" style="table-layout:fixed;width:100%;">
      <colgroup>
        <col style="width:${hasObj ? '22%' : '18%'};" />
        ${hasObj ? '<col style="width:22%;" />' : ''}
        ${BLOOMS.map(() => `<col style="width:${hasObj ? '8%' : '11%'};" />`).join('')}
        <col style="width:${hasObj ? '5%' : '7%'};" />
        <col style="width:${hasObj ? '5%' : '7%'};" />
      </colgroup>
      <thead><tr>
        <th style="text-align:left;">Knowledge \\ Process</th>
        ${hasObj ? '<th style="text-align:left;">Objectives</th>' : ''}
        ${BLOOMS.map(b => `<th title="${b.desc}\n${b.verbs}" style="font-size:0.6875rem;">${b.label}</th>`).join('')}
        <th>Total</th><th>%</th>
      </tr></thead>
      <tbody>
        ${KNOWLEDGE_DIMS.map((dim, i) => {
          const dimObjs = hasObj ? objectives.filter((_, idx) => idx % KNOWLEDGE_DIMS.length === i) : [];
          return `<tr>
          <td class="tos-dim-cell" title="${dim.desc}">
            <span class="tos-2d-obj-label">${dim.label}</span>
            <span class="tos-dim-desc">${dim.desc}</span>
          </td>
          ${hasObj ? `<td class="tos-2d-obj-cell">${dimObjs.length ? dimObjs.map(o => `<div style="margin-bottom:2px;">\u2022 ${escHtml(o)}</div>`).join('') : '<span style="color:var(--ink-faint);font-size:0.75rem;">\u2014</span>'}</td>` : ''}
          ${BLOOMS.map(b => `<td title="${dim.ex[b.key]}"><input type="number" class="tos-cell" data-row="${i}" data-col="${b.key}" value="0" min="0" /></td>`).join('')}
          <td class="tos-total" data-row-total="${i}">0</td>
          <td class="tos-total" data-row-pct="${i}">0%</td>
        </tr>`;
        }).join('')}
        <tr style="font-weight:700;">
          <td style="text-align:left;" ${hasObj ? 'colspan="2"' : ''}>Column Total</td>
          ${BLOOMS.map(b => `<td data-col-total="${b.key}">0</td>`).join('')}
          <td data-grand-total>0</td><td>\u2014</td>
        </tr>
        <tr>
          <td style="text-align:left;font-weight:600;" ${hasObj ? 'colspan="2"' : ''}>% of Paper</td>
          ${BLOOMS.map(b => `<td data-col-pct="${b.key}">0%</td>`).join('')}
          <td>100%</td><td>\u2014</td>
        </tr>
      </tbody>
    </table>
    </div>
    <p style="font-size:0.75rem;color:var(--ink-muted);margin-top:8px;">Target total: <strong>${totalMarks}</strong> marks. Hover cells for example verbs at each intersection.</p>
  `;
}

/* \u2500\u2500 AoL event wiring \u2500\u2500 */
function wireAoLEvents(container, lessons) {
  const objArea = container.querySelector('#tos-objectives');
  const obj2dArea = container.querySelector('#tos-2d-objectives');
  const lessonSel = container.querySelector('#tos-lesson-select');
  const output = container.querySelector('#tos-output');
  const totalInput = container.querySelector('#tos-total-marks');

  // Pre-fill from selected lesson
  if (lessonSel) {
    lessonSel.addEventListener('change', () => {
      const lesson = Store.getLesson(lessonSel.value);
      if (lesson && lesson.objectives) {
        const objectives = lesson.objectives.split(/[;,\n]/).map(o => o.trim()).filter(Boolean).join('\n');
        if (objArea) objArea.value = objectives;
        if (obj2dArea) obj2dArea.value = objectives;
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
      const objs2d = obj2dArea ? obj2dArea.value.split('\n').map(o => o.trim()).filter(Boolean) : [];
      output.innerHTML = build2DTOSTable(total, objs2d.length ? objs2d : null);
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
        const objs2d = obj2dArea ? obj2dArea.value.split('\n').map(o => o.trim()).filter(Boolean) : [];
        const context = lessonCtx ? `Lesson: ${lessonCtx.title}. Objectives: ${lessonCtx.objectives || 'not specified'}.` :
                        objs2d.length ? `Objectives:\n${objs2d.map((o,i) => `${i+1}. ${o}`).join('\n')}` : 'General assessment.';

        const prompt = `Create a 2D Table of Specifications (Anderson & Krathwohl revised taxonomy) for an assessment with ${total} total marks.\n\n${context}\n\nDistribute marks across a 4\u00d76 grid:\nRows (Knowledge Dimension): Factual, Conceptual, Procedural, Metacognitive\nColumns (Cognitive Process): Remember, Understand, Apply, Analyse, Evaluate, Create\n\nReturn ONLY a JSON array of 4 objects (one per knowledge dimension, in order):\n[{"dimension":"factual","remember":2,"understand":3,"apply":4,"analyse":1,"evaluate":0,"create":0},\u2026]\nEnsure total sums to exactly ${total}. Weight appropriately.`;

        const text = await sendChat([{ role: 'user', content: prompt }], {
          systemPrompt: 'You are an assessment design specialist using Anderson & Krathwohl\'s revised taxonomy. Return ONLY valid JSON.',
          temperature: 0.3, maxTokens: 1024
        });

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          output.innerHTML = build2DTOSTable(total, objs2d.length ? objs2d : null);
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


/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   AaL \u2014 Assessment as Learning (Metacognition)
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

export function renderAaL(container) {
  const classes = Store.getClasses();

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

          <div class="class-topic-grid">
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
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Class</label>
              <select id="aal-class" class="input" style="width:100%;">
                ${classDropdownOptions()}
              </select>
            </div>
          </div>
          <div class="class-topic-grid">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Topic</label>
              <select id="aal-topic" class="input" style="width:100%;">
                <option value="">-- Select class first --</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Or type subject context</label>
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
          <div class="assess-section-desc">Key strategies teachers can model and scaffold for students. Click a strategy to see subject-specific applications.</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;" id="srl-grid">
            ${SRL_STRATEGIES.map((s, i) => `
              <div class="srl-card" data-srl-idx="${i}">
                <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:4px;">${s.title}</div>
                <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">${s.desc}</div>
              </div>
            `).join('')}
          </div>
          <div id="srl-detail"></div>
        </div>
      </div>
    </div>
  `;

  wireAaLEvents(container);
}

function wireAaLEvents(container) {
  // Class -> Topic cascade
  const classSel = container.querySelector('#aal-class');
  const topicSel = container.querySelector('#aal-topic');
  const subjectInput = container.querySelector('#aal-subject');

  if (classSel && topicSel) {
    classSel.addEventListener('change', () => {
      const classId = classSel.value;
      const topics = getTopicsForClass(classId);
      const cls = Store.getClass(classId);

      if (topics.length) {
        topicSel.innerHTML = '<option value="">-- Select a topic --</option>' +
          topics.map(t => `<option value="${t.id}">${escHtml(t.title)}</option>`).join('');
      } else {
        topicSel.innerHTML = classId
          ? '<option value="">No lessons found for this class</option>'
          : '<option value="">-- Select class first --</option>';
      }

      // Auto-fill subject from class
      if (cls && cls.subject && subjectInput) {
        subjectInput.value = cls.subject;
      }
    });
  }

  // SRL strategy click
  container.querySelectorAll('.srl-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.srlIdx);
      const strategy = SRL_STRATEGIES[idx];
      const detail = container.querySelector('#srl-detail');
      const wasActive = card.classList.contains('active');

      // Clear all active
      container.querySelectorAll('.srl-card').forEach(c => c.classList.remove('active'));

      if (wasActive) {
        detail.innerHTML = '';
        return;
      }

      card.classList.add('active');
      const subjects = Object.entries(strategy.applications).filter(([k]) => k !== 'default');

      detail.innerHTML = `
        <div class="srl-detail-panel">
          <div style="font-weight:700;font-size:0.9375rem;color:var(--ink);margin-bottom:8px;">${strategy.title} \u2014 Subject Applications</div>
          ${subjects.map(([subj, app]) => `
            <div class="srl-app-item">
              <div class="srl-app-subject">${subj}</div>
              <div>${app}</div>
            </div>
          `).join('')}
          <div class="srl-app-item" style="border-style:dashed;">
            <div class="srl-app-subject" style="color:var(--ink-muted);">General Tip</div>
            <div style="color:var(--ink-muted);">${strategy.applications.default}</div>
          </div>
        </div>
      `;
    });
  });

  // Generate button
  container.querySelector('#aal-generate-btn')?.addEventListener('click', async () => {
    const domain = container.querySelector('#aal-domain')?.value || 'general';
    const subject = container.querySelector('#aal-subject')?.value.trim() || '';
    const topicId = container.querySelector('#aal-topic')?.value;
    const classId = container.querySelector('#aal-class')?.value;
    const output = container.querySelector('#aal-output');
    const btn = container.querySelector('#aal-generate-btn');

    // Build context from selections
    let contextStr = '';
    if (classId) {
      const cls = Store.getClass(classId);
      if (cls) contextStr += `Class: ${cls.name}${cls.subject ? ` (${cls.subject})` : ''}. `;
    }
    if (topicId) {
      const lesson = Store.getLesson(topicId);
      if (lesson) contextStr += `Topic: ${lesson.title}. ${lesson.objectives ? `Objectives: ${lesson.objectives}` : ''}`;
    }

    btn.disabled = true;
    btn.textContent = 'Generating\u2026';
    output.innerHTML = '<p style="color:var(--ink-muted);font-size:0.8125rem;">Generating prompts\u2026</p>';

    try {
      const prompt = `Generate 5 metacognitive reflection prompts for Singapore secondary students.
Focus: ${domain} (${domain === 'planning' ? 'before learning' : domain === 'monitoring' ? 'during learning' : domain === 'evaluation' ? 'after learning' : domain === 'debugging' ? 'when stuck' : 'general'})
${subject ? `Subject context: ${subject}` : ''}
${contextStr ? `Additional context: ${contextStr}` : ''}

Format each as a numbered question. Make them concrete, student-friendly, and appropriate for 13-17 year olds.`;

      const text = await sendChat([{ role: 'user', content: prompt }], {
        systemPrompt: 'You are a metacognition specialist for Singapore schools. Generate clear, practical reflection prompts.',
        temperature: 0.6, maxTokens: 1024
      });

      output.innerHTML = renderAIOutput(text);
      wireExpandToggle(container);
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate Reflection Prompts';
    }
  });
}


/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   AfL \u2014 Assessment for Learning (Hattie / Formative)
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

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

          <div class="class-topic-grid">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Class</label>
              <select id="afl-class" class="input" style="width:100%;">
                ${classDropdownOptions()}
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Topic</label>
              <select id="afl-topic" class="input" style="width:100%;">
                <option value="">-- Select class first --</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Or type topic / lesson focus</label>
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
  // Class -> Topic cascade
  const classSel = container.querySelector('#afl-class');
  const topicSel = container.querySelector('#afl-topic');
  const topicInput = container.querySelector('#afl-lisc-topic');

  if (classSel && topicSel) {
    classSel.addEventListener('change', () => {
      const classId = classSel.value;
      const topics = getTopicsForClass(classId);

      if (topics.length) {
        topicSel.innerHTML = '<option value="">-- Select a topic --</option>' +
          topics.map(t => `<option value="${t.id}">${escHtml(t.title)}</option>`).join('');
      } else {
        topicSel.innerHTML = classId
          ? '<option value="">No lessons found for this class</option>'
          : '<option value="">-- Select class first --</option>';
      }
    });

    // Auto-fill topic input when topic selected
    if (topicSel && topicInput) {
      topicSel.addEventListener('change', () => {
        const lessonId = topicSel.value;
        if (lessonId) {
          const lesson = Store.getLesson(lessonId);
          if (lesson) topicInput.value = lesson.title;
        }
      });
    }
  }

  container.querySelector('#afl-lisc-btn')?.addEventListener('click', async () => {
    const topic = container.querySelector('#afl-lisc-topic')?.value.trim();
    const classId = container.querySelector('#afl-class')?.value;
    const topicId = container.querySelector('#afl-topic')?.value;

    // Build context
    let topicStr = topic || '';
    if (!topicStr && topicId) {
      const lesson = Store.getLesson(topicId);
      if (lesson) topicStr = lesson.title;
    }

    if (!topicStr) { showToast('Enter a topic or select one from a class.', 'warning'); return; }

    let context = '';
    if (classId) {
      const cls = Store.getClass(classId);
      if (cls) context += `Class: ${cls.name}${cls.subject ? ` (${cls.subject})` : ''}. `;
    }
    if (topicId) {
      const lesson = Store.getLesson(topicId);
      if (lesson && lesson.objectives) context += `Objectives: ${lesson.objectives}`;
    }

    const output = container.querySelector('#afl-lisc-output');
    const btn = container.querySelector('#afl-lisc-btn');
    btn.disabled = true;
    btn.textContent = 'Generating\u2026';

    try {
      const text = await sendChat([{
        role: 'user',
        content: `Generate Learning Intentions and Success Criteria for: ${topicStr}\n${context ? `\nContext: ${context}` : ''}\n\nFormat:\n**Learning Intention:** We are learning to...\n\n**Success Criteria:**\n- I can...\n- I can...\n- I can...\n\nAlso suggest 2 formative check questions a teacher could ask during the lesson.`
      }], {
        systemPrompt: 'You are a Visible Learning specialist for Singapore secondary schools. Generate clear, student-friendly LISC aligned to Singapore MOE curriculum.',
        temperature: 0.5, maxTokens: 1024
      });

      output.innerHTML = renderAIOutput(text);
      wireExpandToggle(container);
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate LISC';
    }
  });
}

/* \u2500\u2500 Utility \u2500\u2500 */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
