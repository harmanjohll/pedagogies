/*
 * Co-Cher Assessment
 * ==================
 * Three standalone views accessed via separate routes:
 *   AoL — Assessment of Learning (summative, Table of Specifications)
 *   AaL — Assessment as Learning (metacognition, MAI framework)
 *   AfL — Assessment for Learning (formative, Hattie's Visible Learning)
 */

import { Store, generateId } from '../state.js';
import { trackEvent } from '../utils/analytics.js';
import { showToast } from '../components/toast.js';
import { sendChat } from '../api.js';
import { renderWorkflowBreadcrumb, bindWorkflowClicks } from '../components/workflow-breadcrumb.js';
import { processLatex, renderMd } from '../utils/latex.js';

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
  }

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

  /* ── AoL Sequential Card Flow ── */
  .aol-card { position: relative; }
  .aol-card-header {
    display: flex; align-items: center; gap: 12px;
  }
  .aol-card-num {
    width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.875rem; flex-shrink: 0;
    background: var(--accent, #4361ee); color: #fff;
  }
  .aol-card-title { font-size: 1rem; font-weight: 700; color: var(--ink); line-height: 1.2; }
  .aol-card-hint { font-size: 0.75rem; font-weight: 400; color: var(--ink-muted); margin-top: 2px; }
  .aol-tos-mismatch {
    display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
    background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8125rem;
    margin-top: 8px;
  }
  .dark .aol-tos-mismatch { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
  .aol-tos-match {
    display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
    background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 0.8125rem;
    margin-top: 8px;
  }
  .dark .aol-tos-match { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #86efac; }

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

  .collapsible-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; border: none; background: none; padding: 0; width: 100%; text-align: left; }
  .collapsible-toggle .tri { display: inline-block; width: 0; height: 0; border-left: 6px solid var(--ink-muted); border-top: 5px solid transparent; border-bottom: 5px solid transparent; transition: transform 0.2s ease; flex-shrink: 0; }
  .collapsible-toggle.open .tri { transform: rotate(90deg); }
  .collapsible-body { overflow: hidden; transition: max-height 0.3s ease, opacity 0.2s ease; }
  .collapsible-body.collapsed { max-height: 0 !important; opacity: 0; pointer-events: none; }
  .collapsible-body.expanded { opacity: 1; pointer-events: auto; }

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

/* ── Helper: render AI output ── */
function renderAIOutput(text) {
  return `<div class="ai-output-box">${renderMd(text)}</div>`;
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
        ${renderWorkflowBreadcrumb('assess')}
        <div class="page-header" style="margin-bottom: 8px;">
          <div>
            <h1 class="page-title" style="font-size:1.625rem;">Assessment of Learning</h1>
            <p class="page-subtitle">Summative assessment design \u2014 Table of Specifications</p>
          </div>
        </div>

        <!-- Step 1: Setup -->
        <div class="assess-card aol-card" id="aol-step-1">
          <div class="aol-card-header">
            <div class="aol-card-num">1</div>
            <div>
              <div class="aol-card-title">Setup</div>
              <div class="aol-card-hint">Choose taxonomy mode, set objectives and total marks</div>
            </div>
          </div>

          <div class="assess-section-desc" style="margin-top:12px;">
            A TOS maps assessment items to cognitive levels, ensuring balanced coverage.
            Choose between the <strong>original 1D taxonomy</strong> (topics \u00d7 cognitive levels) or the
            <strong>revised 2D taxonomy</strong> (Anderson & Krathwohl \u2014 knowledge dimension \u00d7 cognitive process).
          </div>

          <div class="tos-mode-toggle">
            <button class="tos-mode-btn ${tosMode === '1d' ? 'active' : ''}" data-mode="1d">1D Bloom</button>
            <button class="tos-mode-btn ${tosMode === '2d' ? 'active' : ''}" data-mode="2d">2D Revised Bloom</button>
          </div>

          ${tosMode === '1d' ? render1DInputs(lessons) : render2DInputs(lessons)}
        </div>

        <!-- Step 2: Build TOS -->
        <div class="assess-card aol-card" id="aol-step-2">
          <div class="aol-card-header">
            <div class="aol-card-num">2</div>
            <div>
              <div class="aol-card-title">Build Table of Specifications</div>
              <div class="aol-card-hint">Generate the grid, then allocate marks manually or with AI assistance</div>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-top:12px;margin-bottom:16px;">
            <button class="btn btn-primary btn-sm" id="tos-build-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              Build TOS Grid
            </button>
            <button class="btn btn-secondary btn-sm" id="tos-generate-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              AI-Suggested Distribution
            </button>
          </div>

          <div id="tos-output"></div>
        </div>

        <!-- Step 3: Generate Questions -->
        <div class="assess-card aol-card" id="aol-step-3">
          <div class="aol-card-header">
            <div class="aol-card-num">3</div>
            <div>
              <div class="aol-card-title">Generate Draft Questions</div>
              <div class="aol-card-hint">Set parameters and let AI draft questions based on your TOS</div>
            </div>
          </div>

          <div style="margin-top:12px;padding:16px;border:1px solid var(--border,#e2e5ea);border-radius:10px;background:var(--bg-subtle,#f8f9fa);">
            <div style="font-weight:700;font-size:0.875rem;color:var(--ink);margin-bottom:8px;">Cognitive Level of Demand</div>
            <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:10px;line-height:1.5;">
              Set the difficulty distribution for generated questions. This maps to Bloom's taxonomy levels.
            </p>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;cursor:pointer;">
                <input type="radio" name="aol-difficulty" value="lower" />
                <span><strong>Lower Order</strong><br/><span style="font-size:0.6875rem;color:var(--ink-muted);">Remember, Understand</span></span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;cursor:pointer;">
                <input type="radio" name="aol-difficulty" value="balanced" checked />
                <span><strong>Balanced</strong><br/><span style="font-size:0.6875rem;color:var(--ink-muted);">Mix across all levels</span></span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;cursor:pointer;">
                <input type="radio" name="aol-difficulty" value="higher" />
                <span><strong>Higher Order</strong><br/><span style="font-size:0.6875rem;color:var(--ink-muted);">Analyse, Evaluate, Create</span></span>
              </label>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Subject</label>
                <input type="text" id="aol-subject" class="input" placeholder="e.g. Chemistry, Physics" style="width:100%;" />
              </div>
              <div>
                <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Level</label>
                <input type="text" id="aol-level" class="input" placeholder="e.g. Sec 4, JC1" style="width:100%;" />
              </div>
            </div>

            <button class="btn btn-primary btn-sm" id="aol-generate-questions-btn" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Generate Draft Questions
            </button>
            <p style="font-size:0.6875rem;color:var(--ink-faint);margin-top:6px;">Build the TOS and fill in mark allocations first, then generate questions.</p>
          </div>

          <!-- AI Review Banner (non-dismissable) -->
          <div id="aol-review-banner" style="display:none;margin-top:16px;padding:14px 18px;border-radius:10px;background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #f59e0b;position:sticky;top:0;z-index:10;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <strong style="color:#92400e;font-size:0.9375rem;">Teacher Review Required</strong>
            </div>
            <p style="font-size:0.8125rem;color:#78350f;line-height:1.5;margin-bottom:0;">
              AI-generated questions require your professional review. You MUST review, edit, and approve every question before exporting.
              Use the Keep / Edit / Delete controls below each question.
            </p>
          </div>

          <!-- Generated Questions Output -->
          <div id="aol-questions-output" style="margin-top:16px;"></div>
        </div>

        <!-- Step 4: Review & Export -->
        <div class="assess-card aol-card" id="aol-step-4">
          <div class="aol-card-header">
            <div class="aol-card-num">4</div>
            <div>
              <div class="aol-card-title">Review & Export</div>
              <div class="aol-card-hint">Verify all questions, then export or copy</div>
            </div>
          </div>

          <div id="aol-export-section" style="margin-top:12px;">
            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:12px;">
              <input type="checkbox" id="aol-review-confirm" style="margin-top:3px;" />
              <span style="font-size:0.875rem;color:var(--ink);line-height:1.5;">
                <strong>I have reviewed and verified all questions.</strong> I confirm that each question is accurate, appropriate for my students, and aligned with the Table of Specifications.
              </span>
            </label>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" id="aol-export-btn" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export / Print
              </button>
              <button class="btn btn-secondary btn-sm" id="aol-copy-btn" disabled>
                Copy to Clipboard
              </button>
            </div>
          </div>
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

        <!-- Assessment Blueprint Mapping -->
        <div class="assess-card">
          <div class="assess-section-title">Assessment Blueprint Mapping</div>
          <div class="assess-section-desc">
            Map individual questions to topics, E21CC competencies, and difficulty levels to visualise assessment coverage and identify gaps.
          </div>

          <!-- Saved Blueprints -->
          ${renderBlueprintList()}

          <!-- Create / Edit Blueprint -->
          <details id="bp-create-section" style="margin-top:12px;">
            <summary style="cursor:pointer;font-weight:600;font-size:0.875rem;color:var(--accent,#4361ee);padding:8px 0;user-select:none;">
              + Create New Blueprint
            </summary>
            <div style="margin-top:12px;padding:16px;border:1px solid var(--border,#e2e5ea);border-radius:10px;background:var(--bg-subtle,#f8f9fa);">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
                <div>
                  <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Blueprint Title</label>
                  <input type="text" id="bp-title" class="input" placeholder="e.g. Mid-Year Exam 2026" style="width:100%;" />
                </div>
                <div>
                  <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Subject</label>
                  <input type="text" id="bp-subject" class="input" placeholder="e.g. History, Science" style="width:100%;" />
                </div>
              </div>

              <div style="font-weight:600;font-size:0.8125rem;color:var(--ink);margin-bottom:8px;">Questions</div>
              <div id="bp-questions-list">
                ${renderBlueprintQuestionRow(1)}
              </div>
              <button class="btn btn-ghost btn-sm" id="bp-add-question" style="margin-top:8px;margin-bottom:14px;font-size:0.75rem;">
                + Add Question
              </button>

              <div style="display:flex;gap:8px;">
                <button class="btn btn-primary btn-sm" id="bp-save-btn">Save Blueprint</button>
              </div>
            </div>
          </details>

          <!-- Coverage Visualisation -->
          <div id="bp-coverage-viz" style="margin-top:16px;"></div>
        </div>
      </div>
    </div>
  `;

  // Mode toggle with data-loss warning
  container.querySelectorAll('.tos-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      const cells = container.querySelectorAll('.tos-cell');
      const hasData = [...cells].some(c => parseInt(c.value) > 0);
      const hasQuestions = (container._aolQuestions || []).length > 0;
      if (hasData || hasQuestions) {
        if (!confirm('Switching modes will clear your current TOS data and any generated questions. Continue?')) return;
      }
      container._aolQuestions = null;
      tosMode = btn.dataset.mode;
      renderAoL(container);
    });
  });

  wireAoLEvents(container, lessons);
  wireBlueprintEvents(container);
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
  bindWorkflowClicks(container);
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
          trackLabel: 'generateTOS',
          trackDetail: [container.querySelector('#aol-subject')?.value, container.querySelector('#aol-level')?.value].filter(Boolean).join(' '),
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
          trackLabel: 'generateTOS_2D',
          trackDetail: [container.querySelector('#aol-subject')?.value, container.querySelector('#aol-level')?.value].filter(Boolean).join(' '),
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

  // ── Enable Generate Questions button when TOS has data ──
  const genQBtn = container.querySelector('#aol-generate-questions-btn');
  if (genQBtn) {
    // Monitor TOS cell changes to enable the button
    const observer = new MutationObserver(() => {
      const cells = container.querySelectorAll('.tos-cell');
      const hasData = [...cells].some(c => parseInt(c.value) > 0);
      genQBtn.disabled = !hasData;
    });
    observer.observe(container.querySelector('#tos-output') || container, { childList: true, subtree: true });

    // Also enable on input changes
    container.addEventListener('input', (e) => {
      if (e.target.classList.contains('tos-cell')) {
        const cells = container.querySelectorAll('.tos-cell');
        const hasData = [...cells].some(c => parseInt(c.value) > 0);
        genQBtn.disabled = !hasData;
      }
    });

    genQBtn.addEventListener('click', () => generateDraftQuestions(container));
  }

  // ── Review confirm checkbox ──
  const confirmCb = container.querySelector('#aol-review-confirm');
  if (confirmCb) {
    confirmCb.addEventListener('change', () => {
      const enabled = confirmCb.checked;
      const exportBtn = container.querySelector('#aol-export-btn');
      const copyBtn = container.querySelector('#aol-copy-btn');
      if (exportBtn) exportBtn.disabled = !enabled;
      if (copyBtn) copyBtn.disabled = !enabled;
      updateAoLStepper(container);
    });
  }

  // ── Export / Print ──
  container.querySelector('#aol-export-btn')?.addEventListener('click', () => exportQuestions(container));
  container.querySelector('#aol-copy-btn')?.addEventListener('click', () => copyQuestions(container));
}

/* ── Collect TOS data from the filled table ── */
function collectTOSData(container) {
  const cells = container.querySelectorAll('.tos-cell');
  if (!cells.length) return null;

  const data = [];
  const rows = {};
  cells.forEach(c => {
    const row = parseInt(c.dataset.row);
    const col = c.dataset.col;
    const val = parseInt(c.value) || 0;
    if (!rows[row]) rows[row] = {};
    rows[row][col] = val;
  });

  // Get objective/dimension labels from the table
  const objCells = container.querySelectorAll('.tos-obj-cell');
  const dimCells = container.querySelectorAll('.tos-dim-cell');
  const labelCells = objCells.length > 0 ? objCells : dimCells;

  Object.keys(rows).sort((a,b) => a - b).forEach((rowIdx, i) => {
    const label = labelCells[i]?.textContent?.trim() || `Row ${parseInt(rowIdx) + 1}`;
    data.push({ label, marks: rows[rowIdx] });
  });

  return data;
}

/* ── Generate Draft Questions ── */
async function generateDraftQuestions(container) {
  const tosData = collectTOSData(container);
  if (!tosData || tosData.length === 0) {
    showToast('Build the TOS and fill in mark allocations first.', 'warning');
    return;
  }

  const difficulty = container.querySelector('input[name="aol-difficulty"]:checked')?.value || 'balanced';
  const subject = container.querySelector('#aol-subject')?.value?.trim() || '';
  const level = container.querySelector('#aol-level')?.value?.trim() || '';
  const totalMarks = parseInt(container.querySelector('#tos-total-marks')?.value) || 50;

  const difficultyGuide = {
    lower: 'Focus heavily on Remember and Understand levels (60-70% lower order). Include fewer Apply/Analyse questions.',
    balanced: 'Distribute across all cognitive levels proportionally. Roughly 30% lower order, 40% middle, 30% higher order.',
    higher: 'Focus heavily on Analyse, Evaluate, and Create levels (60-70% higher order). Include fewer Remember/Understand questions.'
  };

  // Build the TOS summary for the prompt
  const tosSummary = tosData.map(row => {
    const parts = BLOOMS.map(b => `${b.label}: ${row.marks[b.key] || 0} marks`).filter(p => !p.endsWith('0 marks'));
    return `- ${row.label}: ${parts.join(', ')}`;
  }).join('\n');

  const btn = container.querySelector('#aol-generate-questions-btn');
  btn.disabled = true;
  btn.textContent = 'Generating questions\u2026';

  try {
    // Detect formula-heavy subjects for prompt tailoring
    const formulaSubjectPattern = /math|physics|chemistry|chem|add\s*math|a\s*math|e\s*math/i;
    const isFormulaSub = formulaSubjectPattern.test(subject);

    const mathGuidance = isFormulaSub ? `
IMPORTANT — This is a formula/calculation-heavy subject. Follow these rules:
- Write questions concisely. State the problem directly, avoid unnecessary preamble or story context unless it is essential to the question.
- Use LaTeX notation for all mathematical expressions: wrap inline math in $...$ and display math in $$...$$.
- For example, write "Solve $2x + 5 = 17$." not "A student has an equation where two times x plus five equals seventeen. Solve for x."
- For answers, show the working steps using LaTeX.
- Prefer clean mathematical notation over verbose word descriptions of formulas.
` : '';

    const prompt = `Generate draft assessment questions based on this Table of Specifications.

Subject: ${subject || 'Not specified'}
Level: ${level || 'Secondary'}
Total marks: ${totalMarks}
TOS mode: ${tosMode === '2d' ? '2D (Knowledge Dimension x Cognitive Process)' : '1D (Objectives x Cognitive Levels)'}
Difficulty preference: ${difficultyGuide[difficulty]}
${mathGuidance}
Table of Specifications:
${tosSummary}

Generate questions that match EACH cell in the TOS where marks are allocated.
For each question, provide:
1. The question text
2. The cognitive level (Bloom's taxonomy)
3. The mark allocation
4. A suggested answer or marking scheme
5. The topic/objective it maps to

Format as JSON array:
[{
  "question": "...",
  "bloom_level": "remember|understand|apply|analyse|evaluate|create",
  "marks": 3,
  "topic": "...",
  "answer": "...",
  "question_type": "MCQ|short_answer|structured|essay|calculation"
}]

Generate enough questions to cover ALL marks in the TOS (total ${totalMarks} marks).
Make questions appropriate for Singapore ${level || 'secondary'} students.
Return ONLY the JSON array.`;

    const text = await sendChat([{ role: 'user', content: prompt }], {
      trackLabel: 'generateQuestions',
      trackDetail: [subject, level].filter(Boolean).join(' '),
      systemPrompt: `You are an expert assessment designer for Singapore schools. Generate high-quality exam questions aligned to Bloom's taxonomy. Return ONLY valid JSON. Each question must be clear, unambiguous, and curriculum-appropriate. Include marking schemes.${isFormulaSub ? ' Use LaTeX ($...$ for inline, $$...$$ for display) for all mathematical expressions and formulas.' : ''}`,
      temperature: 0.5,
      maxTokens: 8192
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      showToast('Failed to parse AI response. Please try again.', 'danger');
      return;
    }

    const questions = JSON.parse(jsonMatch[0]);
    renderGeneratedQuestions(container, questions);
  } catch (err) {
    showToast(`Error: ${err.message}`, 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate Draft Questions';
  }
}

/* ── Render Generated Questions with Keep/Edit/Delete controls ── */
function renderGeneratedQuestions(container, questions) {
  const output = container.querySelector('#aol-questions-output');
  const banner = container.querySelector('#aol-review-banner');
  const exportSection = container.querySelector('#aol-export-section');

  if (banner) banner.style.display = 'block';
  if (exportSection) exportSection.style.display = 'block';

  // Reset confirmation
  const confirmCb = container.querySelector('#aol-review-confirm');
  if (confirmCb) confirmCb.checked = false;
  const exportBtn = container.querySelector('#aol-export-btn');
  const copyBtn = container.querySelector('#aol-copy-btn');
  if (exportBtn) exportBtn.disabled = true;
  if (copyBtn) copyBtn.disabled = true;

  const bloomColors = {
    remember: '#3b82f6', understand: '#6366f1', apply: '#8b5cf6',
    analyse: '#a855f7', evaluate: '#d946ef', create: '#ec4899'
  };

  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

  output.innerHTML = `
    <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-weight:700;font-size:1rem;color:var(--ink);">Draft Questions (${questions.length} questions, ${totalMarks} marks)</div>
      <span class="badge badge-amber badge-dot" style="font-size:0.75rem;">AI-Generated \u2014 Review Required</span>
    </div>
    ${questions.map((q, i) => {
      const color = bloomColors[q.bloom_level] || '#6366f1';
      return `
      <div class="aol-question-card" data-q-idx="${i}" style="padding:16px;border:1px solid var(--border,#e2e5ea);border-radius:10px;margin-bottom:12px;border-left:4px solid ${color};background:var(--bg-card,#fff);transition:opacity 0.3s;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
          <div>
            <span class="badge" style="background:${color}15;color:${color};font-size:0.6875rem;font-weight:600;padding:2px 8px;border-radius:4px;">${(q.bloom_level || 'unknown').charAt(0).toUpperCase() + (q.bloom_level || '').slice(1)}</span>
            <span style="font-size:0.75rem;color:var(--ink-muted);margin-left:8px;">${q.question_type || 'structured'} \u2022 ${q.marks || 0} mark${q.marks !== 1 ? 's' : ''}</span>
            <span style="font-size:0.75rem;color:var(--ink-faint);margin-left:8px;">${escHtml(q.topic || '')}</span>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <button class="btn btn-ghost btn-sm aol-q-keep" data-idx="${i}" style="font-size:0.6875rem;color:var(--success,#22c55e);padding:2px 8px;" title="Keep this question">Keep</button>
            <button class="btn btn-ghost btn-sm aol-q-edit" data-idx="${i}" style="font-size:0.6875rem;color:var(--accent,#4361ee);padding:2px 8px;" title="Edit this question">Edit</button>
            <button class="btn btn-ghost btn-sm aol-q-delete" data-idx="${i}" style="font-size:0.6875rem;color:var(--danger,#ef4444);padding:2px 8px;" title="Delete this question">Delete</button>
          </div>
        </div>
        <div class="aol-q-display">
          <div style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:6px;">Q${i + 1}. ${renderMd(q.question)}</div>
          <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;padding:8px 12px;background:var(--bg-subtle,#f8f9fa);border-radius:6px;">
            <strong style="color:var(--ink-secondary);">Suggested Answer:</strong> ${renderMd(q.answer || 'No answer provided')}
          </div>
        </div>
        <div class="aol-q-edit-area" style="display:none;">
          <div style="margin-bottom:8px;">
            <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Question</label>
            <textarea class="input aol-q-text" rows="3" style="width:100%;font-size:0.8125rem;resize:vertical;">${escHtml(q.question)}</textarea>
          </div>
          <div style="margin-bottom:8px;">
            <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Answer / Marking Scheme</label>
            <textarea class="input aol-q-answer" rows="2" style="width:100%;font-size:0.8125rem;resize:vertical;">${escHtml(q.answer || '')}</textarea>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <div>
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Marks</label>
              <input type="number" class="input aol-q-marks" value="${q.marks || 0}" min="0" style="width:60px;font-size:0.8125rem;" />
            </div>
            <div>
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Level</label>
              <select class="input aol-q-level" style="font-size:0.8125rem;">
                ${BLOOMS.map(b => `<option value="${b.key}" ${b.key === q.bloom_level ? 'selected' : ''}>${b.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-sm aol-q-save" data-idx="${i}" style="font-size:0.6875rem;">Save Changes</button>
        </div>
      </div>`;
    }).join('')}
  `;

  // Store questions on the container for export
  container._aolQuestions = [...questions];

  // Update wizard stepper to reflect questions generated
  updateAoLStepper(container);

  // Wire Keep/Edit/Delete buttons
  output.querySelectorAll('.aol-q-keep').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.aol-question-card');
      card.style.borderLeftColor = 'var(--success, #22c55e)';
      card.style.background = 'rgba(34,197,94,0.04)';
      btn.textContent = 'Kept';
      btn.disabled = true;
    });
  });

  output.querySelectorAll('.aol-q-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.aol-question-card');
      const display = card.querySelector('.aol-q-display');
      const editArea = card.querySelector('.aol-q-edit-area');
      display.style.display = 'none';
      editArea.style.display = 'block';
    });
  });

  output.querySelectorAll('.aol-q-save').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const card = btn.closest('.aol-question-card');
      const newText = card.querySelector('.aol-q-text').value.trim();
      const newAnswer = card.querySelector('.aol-q-answer').value.trim();
      const newMarks = parseInt(card.querySelector('.aol-q-marks').value) || 0;
      const newLevel = card.querySelector('.aol-q-level').value;

      // Update stored question
      if (container._aolQuestions[idx]) {
        container._aolQuestions[idx].question = newText;
        container._aolQuestions[idx].answer = newAnswer;
        container._aolQuestions[idx].marks = newMarks;
        container._aolQuestions[idx].bloom_level = newLevel;
      }

      // Update display
      const display = card.querySelector('.aol-q-display');
      const editArea = card.querySelector('.aol-q-edit-area');
      display.innerHTML = `
        <div style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:6px;">Q${idx + 1}. ${renderMd(newText)}</div>
        <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;padding:8px 12px;background:var(--bg-subtle,#f8f9fa);border-radius:6px;">
          <strong style="color:var(--ink-secondary);">Suggested Answer:</strong> ${renderMd(newAnswer || 'No answer provided')}
        </div>`;
      display.style.display = 'block';
      editArea.style.display = 'none';
      processLatex(display);

      card.style.borderLeftColor = 'var(--accent, #4361ee)';
      showToast('Question updated.', 'success');
    });
  });

  output.querySelectorAll('.aol-q-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const card = btn.closest('.aol-question-card');
      card.style.opacity = '0.3';
      card.style.pointerEvents = 'none';
      if (container._aolQuestions[idx]) {
        container._aolQuestions[idx]._deleted = true;
      }
    });
  });

  // Render any LaTeX in generated questions
  processLatex(output);
}

/* ── Export Questions (print-ready with watermark) ── */
function exportQuestions(container) {
  const questions = (container._aolQuestions || []).filter(q => !q._deleted);
  if (questions.length === 0) {
    showToast('No questions to export.', 'warning');
    return;
  }
  const subject = container.querySelector('#aol-subject')?.value?.trim() || 'Assessment';
  const level = container.querySelector('#aol-level')?.value?.trim() || '';
  trackEvent('export', 'print_questions', `${questions.length} questions`, [subject, level].filter(Boolean).join(' '));
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

  // Detect formula-heavy subjects — use blank working space instead of lines
  const formulaSubjects = /math|physics|chemistry|chem|add\s*math|a\s*math|e\s*math/i;
  const isFormulaSubject = formulaSubjects.test(subject);

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escHtml(subject)} Assessment</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"><\/script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false}],throwOnError:false});"><\/script>
  <style>
    @media print { @page { margin: 2cm; } .no-print { display: none !important; } }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e1e2e; position: relative; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1e1e2e; padding-bottom: 16px; }
    .header h1 { font-size: 1.25rem; margin: 0 0 4px; }
    .header p { font-size: 0.875rem; color: #666; margin: 0; }
    .student-info { display: flex; gap: 24px; margin-bottom: 24px; font-size: 0.875rem; }
    .student-info div { flex: 1; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .question { margin-bottom: 20px; page-break-inside: avoid; }
    .q-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
    .q-number { font-weight: 700; font-size: 0.9375rem; }
    .q-marks { font-size: 0.75rem; color: #666; }
    .q-text { font-size: 0.9375rem; line-height: 1.6; margin-bottom: 8px; }
    .q-lines { border-bottom: 1px solid #ddd; height: 28px; }
    .q-blank { height: 28px; }
    .answer-section { margin-top: 32px; border-top: 2px dashed #ccc; padding-top: 16px; }
    .answer-section h2 { font-size: 1rem; margin-bottom: 12px; }
    .answer { margin-bottom: 12px; font-size: 0.8125rem; line-height: 1.5; }
    .footer { margin-top: 32px; text-align: center; font-size: 0.6875rem; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(subject)}${level ? ' \u2014 ' + escHtml(level) : ''}</h1>
    <p>Total Marks: ${totalMarks} | Questions: ${questions.length}</p>
  </div>
  <div class="student-info">
    <div>Name: ____________________</div>
    <div>Class: ________</div>
    <div>Date: ________</div>
  </div>

  ${questions.map((q, i) => {
    const spaceLines = Math.max(2, Math.ceil((q.marks || 1) * 1.5));
    const spaceClass = isFormulaSubject ? 'q-blank' : 'q-lines';
    return `
    <div class="question">
      <div class="q-header">
        <span class="q-number">Q${i + 1}.</span>
        <span class="q-marks">[${q.marks} mark${q.marks !== 1 ? 's' : ''}]</span>
      </div>
      <div class="q-text">${q.question}</div>
      ${Array.from({length: spaceLines}, () => '<div class="' + spaceClass + '"></div>').join('')}
    </div>`;
  }).join('')}

  <div class="answer-section no-print">
    <h2>Answer Key / Marking Scheme</h2>
    ${questions.map((q, i) => `
      <div class="answer">
        <strong>Q${i + 1} (${(q.bloom_level || '').charAt(0).toUpperCase() + (q.bloom_level || '').slice(1)}, ${q.marks}m):</strong>
        ${q.answer || 'No answer provided'}
      </div>
    `).join('')}
  </div>

  <div class="footer">
    Generated by Co-Cher | Teacher-reviewed and approved
  </div>

  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
  printWindow.document.close();
}

/* ── Copy Questions to Clipboard ── */
function copyQuestions(container) {
  const questions = (container._aolQuestions || []).filter(q => !q._deleted);
  if (questions.length === 0) {
    showToast('No questions to copy.', 'warning');
    return;
  }
  const subject = container.querySelector('#aol-subject')?.value?.trim() || 'Assessment';
  const level = container.querySelector('#aol-level')?.value?.trim() || '';
  trackEvent('export', 'copy_questions', `${questions.length} questions`, [subject, level].filter(Boolean).join(' '));
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

  let text = `${subject}${level ? ' \u2014 ' + level : ''}\nTotal Marks: ${totalMarks}\n\n`;
  questions.forEach((q, i) => {
    text += `Q${i + 1}. [${q.marks}m] (${q.bloom_level || 'unknown'})\n${q.question}\n`;
    text += `Answer: ${q.answer || 'N/A'}\n\n`;
  });
  text += `\nGenerated by Co-Cher | Reviewed by teacher`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('Questions copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy. Try selecting and copying manually.', 'danger');
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

  // Show match / mismatch indicator
  const existing = container.querySelector('.aol-tos-mismatch, .aol-tos-match');
  if (existing) existing.remove();
  const tosOutput = container.querySelector('#tos-output');
  if (tosOutput && grandTotal > 0) {
    const indicator = document.createElement('div');
    if (grandTotal === totalMarks) {
      indicator.className = 'aol-tos-match';
      indicator.innerHTML = '\u2705 Mark allocation matches target (' + totalMarks + ' marks). Ready to generate questions.';
    } else {
      indicator.className = 'aol-tos-mismatch';
      indicator.innerHTML = '\u26a0\ufe0f Allocated <strong>' + grandTotal + '</strong> of <strong>' + totalMarks + '</strong> marks. ' +
        (grandTotal < totalMarks ? 'Distribute <strong>' + (totalMarks - grandTotal) + '</strong> more marks.' : 'Remove <strong>' + (grandTotal - totalMarks) + '</strong> marks.');
    }
    tosOutput.appendChild(indicator);
  }

  // Update wizard stepper
  updateAoLStepper(container);
}

function updateAoLStepper(container) {
  // Sequential card flow — no stepper to update; kept as no-op for compatibility
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
        ${renderWorkflowBreadcrumb('assess')}
        <div class="page-header" style="margin-bottom: 8px;">
          <div>
            <h1 class="page-title" style="font-size:1.625rem;">Assessment as Learning</h1>
            <p class="page-subtitle">Metacognition frameworks and self-regulated learning</p>
          </div>
        </div>

        <!-- GROW by Reflecting (Beatty, 2015) -->
        <div class="assess-card" id="aal-grow-card">
          <div class="assess-section-title" style="cursor:pointer;" data-jump="aal-grow-card" title="Click to see this framework in action">
            <span style="display:inline-flex;align-items:center;gap:6px;">
              GROW by Reflecting
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </span>
          </div>
          <div class="assess-section-desc">
            Beatty\u2019s GROW framework empowers students to become proactive, self-reflective learners.
            Each letter guides a stage of personal reflection \u2014 celebrating success, planning improvement, owning knowledge, and looking ahead.
          </div>

          <!-- Circular GROW Diagram (matched to reference: G top-right, R right, O bottom, W left) -->
          <div style="display:flex;justify-content:center;margin-bottom:20px;">
            <svg viewBox="0 0 380 380" width="320" height="320" style="max-width:100%;">
              <defs>
                <marker id="arwG" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#f59e0b"/></marker>
                <marker id="arwR" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#f59e0b"/></marker>
                <marker id="arwO" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#10b981"/></marker>
                <marker id="arwW" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#8b5cf6"/></marker>
              </defs>

              <!-- Outer circle border -->
              <circle cx="190" cy="190" r="150" fill="none" stroke="#10b981" stroke-width="2.5"/>

              <!-- Quadrant dividing lines -->
              <line x1="190" y1="40" x2="190" y2="340" stroke="var(--border,#d1d5db)" stroke-width="1.5"/>
              <line x1="40" y1="190" x2="340" y2="190" stroke="var(--border,#d1d5db)" stroke-width="1.5"/>

              <!-- Quadrant fills -->
              <!-- G (top-right): light orange/amber -->
              <path d="M190,40 A150,150 0 0,1 340,190 L190,190 Z" fill="rgba(245,158,11,0.08)"/>
              <!-- R (bottom-right): light amber/yellow -->
              <path d="M340,190 A150,150 0 0,1 190,340 L190,190 Z" fill="rgba(245,158,11,0.06)"/>
              <!-- O (bottom-left): light green -->
              <path d="M190,340 A150,150 0 0,1 40,190 L190,190 Z" fill="rgba(16,185,129,0.08)"/>
              <!-- W (top-left): light blue/purple -->
              <path d="M40,190 A150,150 0 0,1 190,40 L190,190 Z" fill="rgba(139,92,246,0.06)"/>

              <!-- Centre circle -->
              <circle cx="190" cy="190" r="50" fill="var(--bg-card,#fff)" stroke="var(--border,#e2e5ea)" stroke-width="2"/>
              <text x="190" y="184" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink,#374151)">Believe</text>
              <text x="190" y="200" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink,#374151)">you can</text>

              <!-- Clockwise arrows along the outer edge -->
              <path d="M215,44 Q265,28 310,60" fill="none" stroke="#f59e0b" stroke-width="2" marker-end="url(#arwG)"/>
              <path d="M344,215 Q352,265 325,310" fill="none" stroke="#f59e0b" stroke-width="2" marker-end="url(#arwR)"/>
              <path d="M165,344 Q115,352 65,325" fill="none" stroke="#10b981" stroke-width="2" marker-end="url(#arwO)"/>
              <path d="M36,165 Q28,115 55,65" fill="none" stroke="#8b5cf6" stroke-width="2" marker-end="url(#arwW)"/>

              <!-- G label (top-right quadrant) -->
              <text x="270" y="100" text-anchor="middle" font-size="22" font-weight="800" fill="#f59e0b">G</text>
              <text x="270" y="116" text-anchor="middle" font-size="8" font-weight="600" fill="#f59e0b" font-style="italic">Gift yourself</text>
              <text x="270" y="127" text-anchor="middle" font-size="8" font-weight="600" fill="#f59e0b" font-style="italic">success</text>

              <!-- R label (bottom-right quadrant) -->
              <text x="270" y="265" text-anchor="middle" font-size="22" font-weight="800" fill="#f59e0b">R</text>
              <text x="270" y="281" text-anchor="middle" font-size="8" font-weight="600" fill="#f59e0b" font-style="italic">Rise above</text>
              <text x="270" y="292" text-anchor="middle" font-size="8" font-weight="600" fill="#f59e0b" font-style="italic">with small steps</text>

              <!-- O label (bottom-left quadrant) -->
              <text x="110" y="265" text-anchor="middle" font-size="22" font-weight="800" fill="#10b981">O</text>
              <text x="110" y="281" text-anchor="middle" font-size="8" font-weight="600" fill="#10b981" font-style="italic">Own your</text>
              <text x="110" y="292" text-anchor="middle" font-size="8" font-weight="600" fill="#10b981" font-style="italic">knowledge</text>

              <!-- W label (top-left quadrant) -->
              <text x="110" y="100" text-anchor="middle" font-size="22" font-weight="800" fill="#8b5cf6">W</text>
              <text x="110" y="116" text-anchor="middle" font-size="8" font-weight="600" fill="#8b5cf6" font-style="italic">Watch for what</text>
              <text x="110" y="127" text-anchor="middle" font-size="8" font-weight="600" fill="#8b5cf6" font-style="italic">comes next</text>
            </svg>
          </div>

          <!-- GROW detail cards -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-left:4px solid #f59e0b;background:rgba(245,158,11,0.04);cursor:pointer;" class="aal-panel-link" data-panel="grow-g" title="Click to see what G looks like when enacted">
              <div style="font-weight:700;font-size:0.9375rem;color:#f59e0b;margin-bottom:4px;">G \u2014 Gift yourself success</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Celebrate what you <em>do</em> understand. Recognise your strengths before focusing on gaps.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat is one thing I understand?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow would I teach this to a friend?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-left:4px solid #f59e0b;background:rgba(245,158,11,0.04);cursor:pointer;" class="aal-panel-link" data-panel="grow-r" title="Click to see what R looks like when enacted">
              <div style="font-weight:700;font-size:0.9375rem;color:#f59e0b;margin-bottom:4px;">R \u2014 Rise above with small steps</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Identify what you don\u2019t yet understand and plan a small, achievable step to improve.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat do I not yet understand?\u201d<br/>
                <strong>Go deeper:</strong> \u201cWhat will I do to improve?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-left:4px solid #10b981;background:rgba(16,185,129,0.04);cursor:pointer;" class="aal-panel-link" data-panel="grow-o" title="Click to see what O looks like when enacted">
              <div style="font-weight:700;font-size:0.9375rem;color:#10b981;margin-bottom:4px;">O \u2014 Own your knowledge</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Make learning yours by connecting it to real life and sharing it with others.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat is one real-life example?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow have I shared this with someone?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-left:4px solid #8b5cf6;background:rgba(139,92,246,0.04);cursor:pointer;" class="aal-panel-link" data-panel="grow-w" title="Click to see what W looks like when enacted">
              <div style="font-weight:700;font-size:0.9375rem;color:#8b5cf6;margin-bottom:4px;">W \u2014 Watch for what comes next</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Look ahead. Activate prior knowledge about the next topic so you arrive prepared.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat do I already know about the next topic?\u201d<br/>
                <strong>Go deeper:</strong> \u201cWhat is coming up and how can I prepare?\u201d
              </div>
            </div>
          </div>

          <!-- Enacted example popup area -->
          <div id="aal-enacted-example" style="display:none;margin-bottom:16px;padding:16px;border-radius:10px;border:2px solid var(--accent,#4361ee);background:rgba(67,97,238,0.04);animation:fadeIn 0.2s ease;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div style="font-weight:700;font-size:0.875rem;color:var(--accent,#4361ee);" id="enacted-title"></div>
              <button class="btn btn-secondary btn-sm" id="close-enacted" style="padding:2px 8px;font-size:0.75rem;">Close</button>
            </div>
            <div id="enacted-content" style="font-size:0.8125rem;color:var(--ink);line-height:1.7;"></div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Class (optional)</label>
              <select id="grow-class" class="input" style="width:100%;">
                ${classDropdownOptions()}
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Topic / context</label>
              <input type="text" id="grow-topic" class="input" placeholder="e.g. Chemical bonding revision" style="width:100%;" />
            </div>
          </div>

          <button class="btn btn-primary btn-sm" id="grow-generate-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Generate GROW Reflection Prompts
          </button>
          <div id="grow-output" style="margin-top:12px;"></div>
        </div>

        <!-- ACT on Feedback Framework -->
        <div class="assess-card" id="aal-act-card">
          <div class="assess-section-title" style="cursor:pointer;" data-jump="aal-act-card" title="Click to see this framework in action">
            <span style="display:inline-flex;align-items:center;gap:6px;">
              ACT on Feedback
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </span>
          </div>
          <div class="assess-section-desc">
            A learner-centred framework for acting on feedback received. ACT teaches students to treat feedback as a growth tool
            rather than a judgement \u2014 moving from passive receipt to active response.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-top:4px solid #ef4444;background:rgba(239,68,68,0.03);cursor:pointer;" class="aal-panel-link" data-panel="act-a" title="Click to see what A looks like when enacted">
              <div style="font-weight:700;font-size:0.9375rem;color:#ef4444;margin-bottom:4px;">A \u2014 Acknowledge</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Receive the feedback with an open mind. Notice your emotional response and look past it to the learning message.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:8px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cHow do I feel about this feedback?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow might it help me learn better?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-top:4px solid #f59e0b;background:rgba(245,158,11,0.03);cursor:pointer;" class="aal-panel-link" data-panel="act-c" title="Click to see what C looks like when enacted">
              <div style="font-weight:700;font-size:0.9375rem;color:#f59e0b;margin-bottom:4px;">C \u2014 Connect</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Link the feedback to your success criteria, your goals, and any previous feedback you\u2019ve received.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:8px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cHow does this connect with the success criteria or my goals?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow does this connect with previous feedback?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-top:4px solid #3b82f6;background:rgba(59,130,246,0.03);cursor:pointer;" class="aal-panel-link" data-panel="act-t" title="Click to see what T looks like when enacted">
              <div style="font-weight:700;font-size:0.9375rem;color:#3b82f6;margin-bottom:4px;">T \u2014 Test</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Put the feedback into action. Identify a specific habit to adjust and plan how to check your progress.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:8px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat habit do I need to adjust?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow will I know I am improving?\u201d
              </div>
            </div>
          </div>

          <div style="padding:12px 16px;border-radius:8px;background:var(--bg-subtle,#f8f9fa);border:1px solid var(--border,#e2e5ea);margin-bottom:12px;">
            <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);margin-bottom:6px;">The Proactive Learner Cycle</div>
            <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              GROW and ACT are part of a continuous learning cycle: <span style="color:#3b82f6;font-weight:600;">GROW</span> \u2192 <span style="color:#ef4444;font-weight:600;">ACT</span> \u2192 MAP \u2192 ASK.<br/>
              Students cycle through these both <em>in</em> and <em>out</em> of lessons, supported by three learner behaviours: <strong>Prepare</strong> \u2192 <strong>Participate</strong> \u2192 <strong>Process</strong>.<br/>
              See the full Proactive Learner visual below.
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Class (optional)</label>
              <select id="act-class" class="input" style="width:100%;">
                ${classDropdownOptions()}
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Topic / activity</label>
              <input type="text" id="act-topic" class="input" placeholder="e.g. Essay feedback on argumentative writing" style="width:100%;" />
            </div>
          </div>

          <button class="btn btn-primary btn-sm" id="act-generate-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Generate ACT Feedback Prompts
          </button>
          <div id="act-output" style="margin-top:12px;"></div>
        </div>

        <!-- Proactive Learner Cycle -->
        <div class="assess-card" id="aal-proactive-card">
          <div class="assess-section-title" style="cursor:pointer;" data-jump="aal-proactive-card" title="Click to see this framework in action">
            <span style="display:inline-flex;align-items:center;gap:6px;">
              The Proactive Learner Cycle
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </span>
          </div>
          <div class="assess-section-desc">
            Beatty\u2019s Proactive Learner model shows how GROW, ACT, MAP, and ASK work together simultaneously
            \u2014 both in and out of lessons. All practices happen all the time, not in sequence.
            The inner ring represents the learner behaviours that drive learning: Prepare, Participate, and Process.
          </div>

          <div style="display:flex;justify-content:center;margin-bottom:20px;">
            <svg viewBox="0 0 440 440" width="380" height="380" style="max-width:100%;">
              <!-- Outer ring band (GROW / ACT / MAP / ASK) -->
              <!-- Full outer ring background -->
              <circle cx="220" cy="220" r="200" fill="none" stroke="var(--border,#e2e5ea)" stroke-width="1"/>

              <!-- Outer quadrant arcs as thick bands -->
              <!-- GROW (top): blue band -->
              <path d="M220,30 A190,190 0 0,1 410,220" fill="none" stroke="rgba(59,130,246,0.18)" stroke-width="40"/>
              <path d="M220,30 A190,190 0 0,1 410,220" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="0"/>
              <!-- ACT (right): red band -->
              <path d="M410,220 A190,190 0 0,1 220,410" fill="none" stroke="rgba(239,68,68,0.18)" stroke-width="40"/>
              <path d="M410,220 A190,190 0 0,1 220,410" fill="none" stroke="#ef4444" stroke-width="2"/>
              <!-- MAP (bottom): green band -->
              <path d="M220,410 A190,190 0 0,1 30,220" fill="none" stroke="rgba(16,185,129,0.18)" stroke-width="40"/>
              <path d="M220,410 A190,190 0 0,1 30,220" fill="none" stroke="#10b981" stroke-width="2"/>
              <!-- ASK (left): amber band -->
              <path d="M30,220 A190,190 0 0,1 220,30" fill="none" stroke="rgba(245,158,11,0.18)" stroke-width="40"/>
              <path d="M30,220 A190,190 0 0,1 220,30" fill="none" stroke="#f59e0b" stroke-width="2"/>

              <!-- Outer ring labels (positioned at midpoints of each quadrant arc) -->
              <text x="345" y="100" text-anchor="middle" font-size="17" font-weight="800" fill="#3b82f6">GROW</text>
              <text x="345" y="115" text-anchor="middle" font-size="7.5" fill="#3b82f6" font-weight="500" font-style="italic">Reflect on learning</text>
              <text x="345" y="350" text-anchor="middle" font-size="17" font-weight="800" fill="#ef4444">ACT</text>
              <text x="345" y="365" text-anchor="middle" font-size="7.5" fill="#ef4444" font-weight="500" font-style="italic">Act on feedback</text>
              <text x="95" y="350" text-anchor="middle" font-size="17" font-weight="800" fill="#10b981">MAP</text>
              <text x="95" y="365" text-anchor="middle" font-size="7.5" fill="#10b981" font-weight="500" font-style="italic">Map your progress</text>
              <text x="95" y="100" text-anchor="middle" font-size="17" font-weight="800" fill="#f59e0b">ASK</text>
              <text x="95" y="115" text-anchor="middle" font-size="7.5" fill="#f59e0b" font-weight="500" font-style="italic">Ask for help</text>

              <!-- Inner ring band (Prepare / Participate / Process) -->
              <!-- Inner ring background -->
              <circle cx="220" cy="220" r="120" fill="var(--bg-card,#fff)"/>
              <circle cx="220" cy="220" r="120" fill="none" stroke="var(--border,#e2e5ea)" stroke-width="1"/>

              <!-- Inner thirds as curved bands -->
              <!-- Prepare (top-right, 0° to 120°) -->
              <path d="M220,110 A110,110 0 0,1 315.3,275" fill="none" stroke="rgba(99,102,241,0.2)" stroke-width="32"/>
              <path d="M220,110 A110,110 0 0,1 315.3,275" fill="none" stroke="#6366f1" stroke-width="1.5"/>
              <!-- Participate (120° to 240°) -->
              <path d="M315.3,275 A110,110 0 0,1 124.7,275" fill="none" stroke="rgba(236,72,153,0.2)" stroke-width="32"/>
              <path d="M315.3,275 A110,110 0 0,1 124.7,275" fill="none" stroke="#ec4899" stroke-width="1.5"/>
              <!-- Process (240° to 360°) -->
              <path d="M124.7,275 A110,110 0 0,1 220,110" fill="none" stroke="rgba(20,184,166,0.2)" stroke-width="32"/>
              <path d="M124.7,275 A110,110 0 0,1 220,110" fill="none" stroke="#14b8a6" stroke-width="1.5"/>

              <!-- Inner labels (positioned along the bands, rotated to follow the curve) -->
              <text x="280" y="168" text-anchor="middle" font-size="12" font-weight="700" fill="#6366f1" transform="rotate(30,280,168)">Prepare</text>
              <text x="220" y="310" text-anchor="middle" font-size="12" font-weight="700" fill="#ec4899">Participate</text>
              <text x="158" y="168" text-anchor="middle" font-size="12" font-weight="700" fill="#14b8a6" transform="rotate(-30,158,168)">Process</text>

              <!-- Centre circle -->
              <circle cx="220" cy="220" r="55" fill="var(--bg-card,#fff)" stroke="var(--border,#e2e5ea)" stroke-width="2"/>
              <text x="220" y="215" text-anchor="middle" font-size="11" font-weight="800" fill="var(--ink,#374151)">Proactive</text>
              <text x="220" y="232" text-anchor="middle" font-size="11" font-weight="800" fill="var(--ink,#374151)">Learner</text>
            </svg>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:0.8125rem;font-weight:700;color:var(--ink);margin-bottom:6px;">Outer Ring \u2014 Learning Practices</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
                <span style="color:#3b82f6;font-weight:600;">GROW</span> \u2014 Reflect on what you know and don\u2019t know<br/>
                <span style="color:#ef4444;font-weight:600;">ACT</span> \u2014 Process and act on feedback received<br/>
                <span style="color:#10b981;font-weight:600;">MAP</span> \u2014 Track your progress against goals<br/>
                <span style="color:#f59e0b;font-weight:600;">ASK</span> \u2014 Seek help and clarify understanding
              </div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;font-style:italic;">All four practices happen simultaneously, not in sequence.</div>
            </div>
            <div>
              <div style="font-size:0.8125rem;font-weight:700;color:var(--ink);margin-bottom:6px;">Inner Ring \u2014 Learner Behaviours</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
                <span style="color:#6366f1;font-weight:600;">Prepare</span> \u2014 Get ready for learning before class<br/>
                <span style="color:#ec4899;font-weight:600;">Participate</span> \u2014 Engage actively during lessons<br/>
                <span style="color:#14b8a6;font-weight:600;">Process</span> \u2014 Make sense of learning after class
              </div>
            </div>
          </div>
        </div>

        <!-- Reflection Prompt Generator -->
        <div class="assess-card" id="aal-reflection-card">
          <div class="assess-section-title" style="cursor:pointer;" data-jump="aal-reflection-card" title="Click to see this tool in action">
            <span style="display:inline-flex;align-items:center;gap:6px;">
              Metacognitive Reflection Prompt Generator
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </span>
          </div>
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
        <div class="assess-card" id="aal-srl-card">
          <div class="assess-section-title" style="cursor:pointer;" data-jump="aal-srl-card" title="Click to see subject-specific applications">
            <span style="display:inline-flex;align-items:center;gap:6px;">
              Self-Regulated Learning (SRL) Strategies
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </span>
          </div>
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

        <!-- MAI Framework (Say More — collapsible) -->
        <div class="assess-card" id="aal-mai-card">
          <button class="collapsible-toggle" id="mai-toggle">
            <span class="tri"></span>
            <span class="assess-section-title" style="margin-bottom:0;">Metacognitive Awareness Inventory (MAI) \u2014 Theoretical Reference</span>
          </button>
          <div class="assess-section-desc" style="margin-top:4px;">
            Based on Schraw &amp; Dennison (1994). Click <em>Say More</em> to expand the full MAI taxonomy.
          </div>

          <div class="collapsible-body collapsed" id="mai-body" style="max-height:0;">
            <div style="padding-top:12px;">
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
          </div>
        </div>
      </div>
    </div>
  `;

  wireAaLEvents(container);
}

/* ── Enacted examples data for panel links ── */
const ENACTED_EXAMPLES = {
  'grow-g': {
    title: 'G — Gift yourself success (Enacted)',
    content: `<strong>In the classroom:</strong> After a quiz on Chemical Bonding, the teacher asks students to write down one concept they understood well.\n\n<strong>Student example:</strong> "I understood that ionic bonds form when electrons are transferred from a metal to a non-metal. I could draw the dot-and-cross diagram for NaCl."\n\n<strong>Teacher prompt:</strong> "Now, how would you explain this to someone who missed today's lesson?"\n\n<strong>Outcome:</strong> Students feel empowered because they start from a position of success rather than focusing on gaps first.`
  },
  'grow-r': {
    title: 'R — Rise above with small steps (Enacted)',
    content: `<strong>In the classroom:</strong> Students identify one thing they found challenging in the lesson.\n\n<strong>Student example:</strong> "I'm not sure why some atoms form covalent bonds instead of ionic bonds. My small step: I'll re-read the textbook section on electronegativity tonight and try the practice questions."\n\n<strong>Teacher prompt:</strong> "What is the smallest thing you can do today to move forward?"\n\n<strong>Outcome:</strong> Breaks down overwhelming gaps into manageable actions.`
  },
  'grow-o': {
    title: 'O — Own your knowledge (Enacted)',
    content: `<strong>In the classroom:</strong> Students connect learning to real life or share it with someone.\n\n<strong>Student example:</strong> "Ionic compounds are in table salt (NaCl) which we use every day. I explained to my younger sister why salt dissolves in water — the ions separate."\n\n<strong>Teacher prompt:</strong> "Where have you seen this concept in real life? Who could you teach this to?"\n\n<strong>Outcome:</strong> Deepens understanding through application and teaching others.`
  },
  'grow-w': {
    title: 'W — Watch for what comes next (Enacted)',
    content: `<strong>In the classroom:</strong> Before the end of the lesson, students preview the next topic.\n\n<strong>Student example:</strong> "Next lesson is on metallic bonding. I already know metals conduct electricity, so maybe metallic bonds have something to do with free-moving electrons."\n\n<strong>Teacher prompt:</strong> "What do you already know about next lesson's topic? How can you prepare?"\n\n<strong>Outcome:</strong> Students arrive ready to learn, with prior knowledge activated.`
  },
  'act-a': {
    title: 'A — Acknowledge (Enacted)',
    content: `<strong>In the classroom:</strong> Students receive feedback on an essay and first identify their emotional response.\n\n<strong>Student example:</strong> "I feel a bit disappointed because I thought my argument was strong. But reading the feedback again, I see the teacher is pointing out that I need more evidence from the text."\n\n<strong>Teacher prompt:</strong> "How do you feel about this feedback? Now read it again — what is the learning message?"\n\n<strong>Outcome:</strong> Students learn to separate emotion from content, making feedback actionable.`
  },
  'act-c': {
    title: 'C — Connect (Enacted)',
    content: `<strong>In the classroom:</strong> Students link feedback to their goals and previous feedback.\n\n<strong>Student example:</strong> "My teacher said I need more textual evidence — that's the same feedback I got last time. The success criteria says I need at least 2 quotes per paragraph. I only used 1."\n\n<strong>Teacher prompt:</strong> "How does this feedback connect to the success criteria? Have you received similar feedback before?"\n\n<strong>Outcome:</strong> Students see patterns in their learning and connect feedback to clear standards.`
  },
  'act-t': {
    title: 'T — Test (Enacted)',
    content: `<strong>In the classroom:</strong> Students create an action plan and a way to check improvement.\n\n<strong>Student example:</strong> "My new habit: for every point I make, I'll highlight 2 quotes before I start writing. I'll check by counting my quotes before submitting."\n\n<strong>Teacher prompt:</strong> "What specific habit will you change? How will you know you're improving?"\n\n<strong>Outcome:</strong> Feedback leads to concrete, measurable behaviour change.`
  }
};

function wireAaLEvents(container) {
  bindWorkflowClicks(container);
  // MAI collapsible toggle
  const maiToggle = container.querySelector('#mai-toggle');
  const maiBody = container.querySelector('#mai-body');
  if (maiToggle && maiBody) {
    maiToggle.addEventListener('click', () => {
      const isOpen = maiToggle.classList.toggle('open');
      if (isOpen) {
        maiBody.classList.remove('collapsed');
        maiBody.classList.add('expanded');
        maiBody.style.maxHeight = maiBody.scrollHeight + 'px';
      } else {
        maiBody.style.maxHeight = '0';
        maiBody.classList.remove('expanded');
        maiBody.classList.add('collapsed');
      }
    });
  }

  // Panel link click → show enacted example
  container.querySelectorAll('.aal-panel-link').forEach(panel => {
    panel.addEventListener('click', () => {
      const key = panel.dataset.panel;
      const data = ENACTED_EXAMPLES[key];
      if (!data) return;
      const box = container.querySelector('#aal-enacted-example');
      const title = container.querySelector('#enacted-title');
      const content = container.querySelector('#enacted-content');
      if (!box || !title || !content) return;
      title.textContent = data.title;
      content.innerHTML = data.content.replace(/\n\n/g, '<br/><br/>');
      box.style.display = 'block';
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // Close enacted example
  container.querySelector('#close-enacted')?.addEventListener('click', () => {
    const box = container.querySelector('#aal-enacted-example');
    if (box) box.style.display = 'none';
  });

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

  // GROW generate
  container.querySelector('#grow-generate-btn')?.addEventListener('click', async () => {
    const topic = container.querySelector('#grow-topic')?.value.trim() || '';
    const growClassId = container.querySelector('#grow-class')?.value;
    const output = container.querySelector('#grow-output');
    const btn = container.querySelector('#grow-generate-btn');

    let context = '';
    if (growClassId) {
      const cls = Store.getClass(growClassId);
      if (cls) context += `Class: ${cls.name}${cls.subject ? ` (${cls.subject})` : ''}. `;
    }

    btn.disabled = true;
    btn.textContent = 'Generating\u2026';
    output.innerHTML = '<p style="color:var(--ink-muted);font-size:0.8125rem;">Generating GROW prompts\u2026</p>';

    try {
      const prompt = `Generate a set of GROW self-reflection prompts for Singapore secondary students (age 13-17) based on Beatty's "GROW by reflecting" framework.

GROW framework (Beatty):
G = Gift yourself success: Celebrate what you DO understand. "What is one thing I understand? How would I teach this to a friend?"
R = Rise above with small steps: Identify gaps and plan improvement. "What do I not yet understand? What will I do to improve?"
O = Own your knowledge: Connect learning to real life and share it. "What is one real-life example? How have I shared this?"
W = Watch for what comes next: Look ahead and prepare. "What do I already know about the next topic? What is coming up?"

${topic ? `Topic/context: ${topic}` : ''}
${context || ''}

For each GROW stage, provide:
1. A reflection question tailored to the topic
2. A follow-up probe to go deeper
3. A student sentence starter

Make them concrete, empowering, and suitable for student self-reflection journals or exit tickets.`;

      const text = await sendChat([{ role: 'user', content: prompt }], {
        systemPrompt: 'You are a metacognition specialist for Singapore secondary schools using Beatty\'s GROW by reflecting framework. Generate empowering student self-reflection prompts.',
        temperature: 0.6, maxTokens: 4096
      });

      output.innerHTML = renderAIOutput(text);
      processLatex(output);
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate GROW Reflection Prompts';
    }
  });

  // ACT generate
  container.querySelector('#act-generate-btn')?.addEventListener('click', async () => {
    const topic = container.querySelector('#act-topic')?.value.trim() || '';
    const actClassId = container.querySelector('#act-class')?.value;
    const output = container.querySelector('#act-output');
    const btn = container.querySelector('#act-generate-btn');

    let context = '';
    if (actClassId) {
      const cls = Store.getClass(actClassId);
      if (cls) context += `Class: ${cls.name}${cls.subject ? ` (${cls.subject})` : ''}. `;
    }

    btn.disabled = true;
    btn.textContent = 'Generating\u2026';
    output.innerHTML = '<p style="color:var(--ink-muted);font-size:0.8125rem;">Generating ACT observation prompts\u2026</p>';

    try {
      const prompt = `Generate a set of ACT on Feedback prompts for Singapore secondary students (age 13-17) based on Beatty's framework.

ACT on Feedback framework (Beatty):
A = Acknowledge: "How do I feel about this feedback? How might it help me learn better?"
C = Connect: "How does this connect with success criteria/my goals? How does this connect with previous feedback?"
T = Test: "What habit do I need to adjust? How will I know I am improving?"

${topic ? `Feedback context: ${topic}` : ''}
${context || ''}

For each ACT stage, provide:
1. A reflection question tailored to the context
2. A follow-up probe to go deeper
3. A student sentence starter
4. A practical tip for how to use this stage effectively

Make them empowering, non-defensive, and suitable for student self-reflection after receiving teacher or peer feedback.`;

      const text = await sendChat([{ role: 'user', content: prompt }], {
        systemPrompt: 'You are a metacognition specialist for Singapore secondary schools using Beatty\'s ACT on Feedback framework. Generate empowering student self-reflection prompts that help learners process and act on feedback.',
        temperature: 0.6, maxTokens: 4096
      });

      output.innerHTML = renderAIOutput(text);
      processLatex(output);
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate ACT Feedback Prompts';
    }
  });

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
      processLatex(output);
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
        ${renderWorkflowBreadcrumb('assess')}
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

        <!-- Quick Exit Ticket Generator -->
        <div class="assess-card">
          <div class="assess-section-title">
            <span style="display:inline-flex;align-items:center;gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--e21cc-cait,#6366f1)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Exit Ticket Generator
            </span>
          </div>
          <div class="assess-section-desc">
            A quick 2\u20133 question formative check at the end of a lesson. Students answer before leaving \u2014
            gives you immediate data on who understood the lesson and who needs follow-up.
          </div>

          <div class="class-topic-grid" style="margin-bottom:12px;">
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Class</label>
              <select id="exit-ticket-class" class="input" style="width:100%;">
                ${classDropdownOptions()}
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Lesson / Topic</label>
              <select id="exit-ticket-lesson" class="input" style="width:100%;">
                <option value="">-- Select class first --</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;display:block;margin-bottom:4px;">Or describe the lesson focus</label>
            <input type="text" id="exit-ticket-topic" class="input" placeholder="e.g. Ionic bonding and electron transfer" style="width:100%;" />
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="exit-ticket-gen-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Generate Exit Ticket
            </button>
            <span style="font-size:0.6875rem;color:var(--ink-faint);">2\u20133 questions, ~3 min for students</span>
          </div>
          <div id="exit-ticket-output" style="margin-top:12px;"></div>
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
  bindWorkflowClicks(container);
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
      processLatex(output);
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate LISC';
    }
  });

  /* ── Exit Ticket Generator ── */
  const etClassSel = container.querySelector('#exit-ticket-class');
  const etLessonSel = container.querySelector('#exit-ticket-lesson');
  const etTopicInput = container.querySelector('#exit-ticket-topic');

  if (etClassSel && etLessonSel) {
    etClassSel.addEventListener('change', () => {
      const classId = etClassSel.value;
      const topics = getTopicsForClass(classId);
      if (topics.length) {
        etLessonSel.innerHTML = '<option value="">-- Select a lesson --</option>' +
          topics.map(t => `<option value="${t.id}">${escHtml(t.title)}</option>`).join('');
      } else {
        etLessonSel.innerHTML = classId
          ? '<option value="">No lessons found for this class</option>'
          : '<option value="">-- Select class first --</option>';
      }
    });
    if (etLessonSel && etTopicInput) {
      etLessonSel.addEventListener('change', () => {
        const lessonId = etLessonSel.value;
        if (lessonId) {
          const lesson = Store.getLesson(lessonId);
          if (lesson) etTopicInput.value = lesson.title;
        }
      });
    }
  }

  container.querySelector('#exit-ticket-gen-btn')?.addEventListener('click', async () => {
    let topic = etTopicInput?.value.trim() || '';
    if (!topic && etLessonSel?.value) {
      const lesson = Store.getLesson(etLessonSel.value);
      if (lesson) topic = lesson.title;
    }
    if (!topic) { showToast('Enter a topic or select a lesson.', 'warning'); return; }

    let context = '';
    if (etClassSel?.value) {
      const cls = Store.getClass(etClassSel.value);
      if (cls) context += `Class: ${cls.name}${cls.subject ? ` (${cls.subject})` : ''}${cls.level ? `, ${cls.level}` : ''}. `;
    }

    const output = container.querySelector('#exit-ticket-output');
    const btn = container.querySelector('#exit-ticket-gen-btn');
    btn.disabled = true;
    btn.textContent = 'Generating\u2026';

    try {
      const text = await sendChat([{
        role: 'user',
        content: `Generate a short exit ticket (2-3 questions) for this lesson topic: ${topic}\n${context ? `\nContext: ${context}` : ''}\n\nRequirements:\n- 2-3 quick questions that take students ~3 minutes total\n- Mix of recall and application\n- Include a brief self-reflection prompt (e.g. "Rate your confidence 1-5")\n- Format clearly with question numbers\n- Include suggested answers for the teacher`
      }], {
        systemPrompt: 'You are a formative assessment specialist for Singapore secondary schools. Generate concise, effective exit ticket questions that give teachers immediate insight into student understanding.',
        temperature: 0.5, maxTokens: 1024
      });

      output.innerHTML = renderAIOutput(text);
      processLatex(output);
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate Exit Ticket';
    }
  });
}

/* \u2500\u2500 Blueprint Mapping helpers \u2500\u2500 */
const E21CC_COMPETENCIES = [
  { key: 'CAIT', label: 'CAIT', desc: 'Critical, Adaptive & Inventive Thinking' },
  { key: 'CCI',  label: 'CCI',  desc: 'Communication, Collaboration & Information Skills' },
  { key: 'CGC',  label: 'CGC',  desc: 'Civic, Global & Cross-cultural Literacy' },
];
const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];

function renderBlueprintList() {
  const blueprints = Store.getAssessmentBlueprints();
  if (!blueprints.length) {
    return `<p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:8px;">No blueprints saved yet. Create one below.</p>`;
  }
  return `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;">
      ${blueprints.map(bp => {
        const qCount = (bp.questions || []).length;
        const topics = [...new Set((bp.questions || []).map(q => q.topic).filter(Boolean))];
        const comps = [...new Set((bp.questions || []).map(q => q.competency).filter(Boolean))];
        const totalMarks = (bp.questions || []).reduce((s, q) => s + (parseInt(q.marks) || 0), 0);
        return `
          <div class="assess-card" style="padding:14px 16px;margin-bottom:0;cursor:pointer;" data-bp-expand="${bp.id}">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-weight:700;font-size:0.875rem;color:var(--ink);">${escHtml(bp.title)}</div>
                <div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;">
                  ${escHtml(bp.subject || '')} &middot; ${qCount} question${qCount !== 1 ? 's' : ''} &middot; ${totalMarks} marks
                </div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;">
                <button class="btn btn-ghost btn-sm" data-bp-viz="${bp.id}" style="font-size:0.6875rem;">Coverage</button>
                <button class="btn btn-ghost btn-sm" data-bp-delete="${bp.id}" style="font-size:0.6875rem;color:var(--danger,#dc3545);">Delete</button>
              </div>
            </div>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
              ${topics.map(t => `<span style="display:inline-block;font-size:0.625rem;font-weight:600;padding:2px 8px;border-radius:12px;background:rgba(67,97,238,0.1);color:#4361ee;">${escHtml(t)}</span>`).join('')}
              ${comps.map(c => `<span style="display:inline-block;font-size:0.625rem;font-weight:600;padding:2px 8px;border-radius:12px;background:rgba(34,197,94,0.1);color:#16a34a;">${escHtml(c)}</span>`).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function renderBlueprintQuestionRow(num) {
  return `
    <div class="bp-question-row" style="display:grid;grid-template-columns:50px 1fr 1fr 1fr 80px 30px;gap:8px;align-items:center;margin-bottom:8px;">
      <span style="font-size:0.75rem;font-weight:600;color:var(--ink-muted);text-align:center;">Q${num}</span>
      <input type="text" class="input bp-q-topic" placeholder="Topic" style="font-size:0.75rem;padding:6px 8px;" />
      <select class="input bp-q-competency" style="font-size:0.75rem;padding:6px 8px;">
        <option value="">Competency...</option>
        ${E21CC_COMPETENCIES.map(c => `<option value="${c.key}" title="${c.desc}">${c.label}</option>`).join('')}
      </select>
      <select class="input bp-q-difficulty" style="font-size:0.75rem;padding:6px 8px;">
        ${DIFFICULTY_LEVELS.map(d => `<option value="${d}">${d}</option>`).join('')}
      </select>
      <input type="number" class="input bp-q-marks" placeholder="Marks" min="1" value="5" style="font-size:0.75rem;padding:6px 8px;text-align:center;" />
      <button class="bp-remove-q" style="background:none;border:none;cursor:pointer;color:var(--ink-muted);font-size:1rem;padding:0;" title="Remove">&times;</button>
    </div>
  `;
}

function renderBlueprintCoverage(bp) {
  const questions = bp.questions || [];
  if (!questions.length) return '<p style="font-size:0.8125rem;color:var(--ink-muted);">No questions in this blueprint.</p>';

  const topicMap = {};
  const compMap = { CAIT: 0, CCI: 0, CGC: 0 };
  const diffMap = { Easy: 0, Medium: 0, Hard: 0 };
  questions.forEach(q => {
    if (q.topic) topicMap[q.topic] = (topicMap[q.topic] || 0) + 1;
    if (q.competency && compMap.hasOwnProperty(q.competency)) compMap[q.competency]++;
    if (q.difficulty && diffMap.hasOwnProperty(q.difficulty)) diffMap[q.difficulty]++;
  });

  const totalQ = questions.length;
  const missingComp = E21CC_COMPETENCIES.filter(c => compMap[c.key] === 0);
  const missingDiff = DIFFICULTY_LEVELS.filter(d => diffMap[d] === 0);
  const hasGaps = missingComp.length > 0 || missingDiff.length > 0;

  return `
    <div style="padding:16px;border:1px solid var(--border,#e2e5ea);border-radius:10px;background:var(--bg-subtle,#f8f9fa);">
      <div style="font-weight:700;font-size:0.875rem;color:var(--ink);margin-bottom:12px;">Coverage Analysis: ${escHtml(bp.title)}</div>

      ${hasGaps ? `
        <div style="padding:10px 14px;border-radius:8px;background:#fef3c7;border:1px solid #f59e0b;margin-bottom:14px;">
          <div style="font-size:0.8125rem;font-weight:600;color:#92400e;margin-bottom:4px;">Coverage Gaps Detected</div>
          ${missingComp.length ? `<div style="font-size:0.75rem;color:#78350f;">Missing competencies: ${missingComp.map(c => c.label + ' (' + c.desc + ')').join(', ')}</div>` : ''}
          ${missingDiff.length ? `<div style="font-size:0.75rem;color:#78350f;margin-top:2px;">Missing difficulty levels: ${missingDiff.join(', ')}</div>` : ''}
        </div>` : `
        <div style="padding:10px 14px;border-radius:8px;background:#d1fae5;border:1px solid #22c55e;margin-bottom:14px;">
          <div style="font-size:0.8125rem;font-weight:600;color:#065f46;">Full coverage across competencies and difficulty levels.</div>
        </div>`}

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
        <div>
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;margin-bottom:6px;">Topics</div>
          ${Object.entries(topicMap).map(([t, count]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border-light,#f0f0f4);">
              <span style="font-size:0.8125rem;color:var(--ink);">${escHtml(t)}</span>
              <span style="font-size:0.75rem;font-weight:600;color:var(--accent,#4361ee);">${count}/${totalQ}</span>
            </div>
          `).join('')}
        </div>
        <div>
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;margin-bottom:6px;">Competencies</div>
          ${E21CC_COMPETENCIES.map(c => {
            const count = compMap[c.key];
            const pct = totalQ ? Math.round((count / totalQ) * 100) : 0;
            const barColor = count === 0 ? '#ef4444' : '#22c55e';
            return `
              <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:2px;">
                  <span style="color:var(--ink);">${c.label}</span>
                  <span style="font-weight:600;color:${count === 0 ? '#ef4444' : 'var(--ink)'};">${count} (${pct}%)</span>
                </div>
                <div style="height:6px;background:var(--border-light,#e5e7eb);border-radius:3px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;transition:width 0.3s;"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div>
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);text-transform:uppercase;margin-bottom:6px;">Difficulty</div>
          ${DIFFICULTY_LEVELS.map(d => {
            const count = diffMap[d];
            const pct = totalQ ? Math.round((count / totalQ) * 100) : 0;
            const barColor = count === 0 ? '#ef4444' : (d === 'Easy' ? '#3b82f6' : d === 'Medium' ? '#f59e0b' : '#ef4444');
            return `
              <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:2px;">
                  <span style="color:var(--ink);">${d}</span>
                  <span style="font-weight:600;color:${count === 0 ? '#ef4444' : 'var(--ink)'};">${count} (${pct}%)</span>
                </div>
                <div style="height:6px;background:var(--border-light,#e5e7eb);border-radius:3px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;transition:width 0.3s;"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function wireBlueprintEvents(container) {
  container.querySelector('#bp-add-question')?.addEventListener('click', () => {
    const list = container.querySelector('#bp-questions-list');
    if (!list) return;
    const count = list.querySelectorAll('.bp-question-row').length + 1;
    list.insertAdjacentHTML('beforeend', renderBlueprintQuestionRow(count));
    wireRemoveQuestionBtns(container);
  });

  wireRemoveQuestionBtns(container);

  container.querySelector('#bp-save-btn')?.addEventListener('click', () => {
    const title = container.querySelector('#bp-title')?.value?.trim();
    const subject = container.querySelector('#bp-subject')?.value?.trim();
    if (!title) { showToast('Enter a blueprint title.', 'warning'); return; }

    const rows = container.querySelectorAll('.bp-question-row');
    const questions = [];
    rows.forEach((row, i) => {
      const topic = row.querySelector('.bp-q-topic')?.value?.trim() || '';
      const competency = row.querySelector('.bp-q-competency')?.value || '';
      const difficulty = row.querySelector('.bp-q-difficulty')?.value || 'Medium';
      const marks = parseInt(row.querySelector('.bp-q-marks')?.value) || 0;
      questions.push({ number: i + 1, topic, competency, difficulty, marks });
    });

    if (!questions.length) { showToast('Add at least one question.', 'warning'); return; }

    Store.addAssessmentBlueprint({ title, subject, questions, createdAt: Date.now() });
    showToast('Blueprint saved successfully.', 'success');
    renderAoL(container);
  });

  container.querySelectorAll('[data-bp-delete]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.bpDelete;
      const bps = Store.getAssessmentBlueprints().filter(b => b.id !== id);
      Store.set('assessmentBlueprints', bps);
      showToast('Blueprint deleted.', 'default');
      renderAoL(container);
    });
  });

  container.querySelectorAll('[data-bp-viz]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.bpViz;
      const bp = Store.getAssessmentBlueprints().find(b => b.id === id);
      const vizBox = container.querySelector('#bp-coverage-viz');
      if (bp && vizBox) {
        vizBox.innerHTML = renderBlueprintCoverage(bp);
      }
    });
  });
}

function wireRemoveQuestionBtns(container) {
  container.querySelectorAll('.bp-remove-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.bp-question-row');
      if (row) {
        const list = container.querySelector('#bp-questions-list');
        if (list && list.querySelectorAll('.bp-question-row').length > 1) {
          row.remove();
          list.querySelectorAll('.bp-question-row').forEach((r, i) => {
            const label = r.querySelector('span');
            if (label) label.textContent = `Q${i + 1}`;
          });
        } else {
          showToast('At least one question is required.', 'warning');
        }
      }
    });
  });
}

/* \u2500\u2500 Utility \u2500\u2500 */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
