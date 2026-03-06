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

/* ── Helper: render AI output ── */
function renderAIOutput(text) {
  return `<div class="ai-output-box">${escHtml(text)}</div>`;
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

          <!-- Difficulty / Cognitive Level Selector -->
          <div style="margin-top:16px;padding:16px;border:1px solid var(--border,#e2e5ea);border-radius:10px;background:var(--bg-subtle,#f8f9fa);">
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

          <!-- Review Confirmation & Export (hidden until questions generated) -->
          <div id="aol-export-section" style="display:none;margin-top:16px;padding:16px;border:1px solid var(--border,#e2e5ea);border-radius:10px;">
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
    const prompt = `Generate draft assessment questions based on this Table of Specifications.

Subject: ${subject || 'Not specified'}
Level: ${level || 'Secondary'}
Total marks: ${totalMarks}
TOS mode: ${tosMode === '2d' ? '2D (Knowledge Dimension x Cognitive Process)' : '1D (Objectives x Cognitive Levels)'}
Difficulty preference: ${difficultyGuide[difficulty]}

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
      systemPrompt: `You are an expert assessment designer for Singapore schools. Generate high-quality exam questions aligned to Bloom's taxonomy. Return ONLY valid JSON. Each question must be clear, unambiguous, and curriculum-appropriate. Include marking schemes.`,
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
          <div style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:6px;">Q${i + 1}. ${escHtml(q.question)}</div>
          <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;padding:8px 12px;background:var(--bg-subtle,#f8f9fa);border-radius:6px;">
            <strong style="color:var(--ink-secondary);">Suggested Answer:</strong> ${escHtml(q.answer || 'No answer provided')}
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
        <div style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:6px;">Q${idx + 1}. ${escHtml(newText)}</div>
        <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;padding:8px 12px;background:var(--bg-subtle,#f8f9fa);border-radius:6px;">
          <strong style="color:var(--ink-secondary);">Suggested Answer:</strong> ${escHtml(newAnswer || 'No answer provided')}
        </div>`;
      display.style.display = 'block';
      editArea.style.display = 'none';

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
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escHtml(subject)} Assessment</title>
  <style>
    @media print { @page { margin: 2cm; } .no-print { display: none !important; } }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e1e2e; position: relative; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 5rem; font-weight: 900; color: rgba(0,0,0,0.04); pointer-events: none; z-index: 0; letter-spacing: 0.1em; white-space: nowrap; }
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
    .answer-section { margin-top: 32px; border-top: 2px dashed #ccc; padding-top: 16px; }
    .answer-section h2 { font-size: 1rem; margin-bottom: 12px; }
    .answer { margin-bottom: 12px; font-size: 0.8125rem; line-height: 1.5; }
    .footer { margin-top: 32px; text-align: center; font-size: 0.6875rem; color: #999; }
  </style>
</head>
<body>
  <div class="watermark">Johll</div>
  <div class="header">
    <h1>${escHtml(subject)}${level ? ' \u2014 ' + escHtml(level) : ''}</h1>
    <p>Total Marks: ${totalMarks} | Questions: ${questions.length}</p>
  </div>
  <div class="student-info">
    <div>Name: ____________________</div>
    <div>Class: ________</div>
    <div>Date: ________</div>
  </div>

  ${questions.map((q, i) => `
    <div class="question">
      <div class="q-header">
        <span class="q-number">Q${i + 1}.</span>
        <span class="q-marks">[${q.marks} mark${q.marks !== 1 ? 's' : ''}]</span>
      </div>
      <div class="q-text">${escHtml(q.question)}</div>
      ${Array.from({length: Math.max(2, Math.ceil((q.marks || 1) * 1.5))}, () => '<div class="q-lines"></div>').join('')}
    </div>
  `).join('')}

  <div class="answer-section no-print">
    <h2>Answer Key / Marking Scheme</h2>
    ${questions.map((q, i) => `
      <div class="answer">
        <strong>Q${i + 1} (${(q.bloom_level || '').charAt(0).toUpperCase() + (q.bloom_level || '').slice(1)}, ${q.marks}m):</strong>
        ${escHtml(q.answer || 'No answer provided')}
      </div>
    `).join('')}
  </div>

  <div class="footer">
    Generated by Co-Cher | Teacher-reviewed and approved | Johll
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
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);

  let text = `${subject}${level ? ' \u2014 ' + level : ''}\nTotal Marks: ${totalMarks}\n\n`;
  questions.forEach((q, i) => {
    text += `Q${i + 1}. [${q.marks}m] (${q.bloom_level || 'unknown'})\n${q.question}\n`;
    text += `Answer: ${q.answer || 'N/A'}\n\n`;
  });
  text += `\nGenerated by Co-Cher | Reviewed by teacher | Johll`;

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

        <!-- GROW by Reflecting (Beatty, 2015) -->
        <div class="assess-card">
          <div class="assess-section-title">GROW by Reflecting</div>
          <div class="assess-section-desc">
            Beatty\u2019s GROW framework empowers students to become proactive, self-reflective learners.
            Each letter guides a stage of personal reflection \u2014 celebrating success, planning improvement, owning knowledge, and looking ahead.
          </div>

          <!-- Circular GROW Diagram -->
          <div style="display:flex;justify-content:center;margin-bottom:20px;">
            <svg viewBox="0 0 340 340" width="300" height="300" style="max-width:100%;">
              <!-- Quadrant segments -->
              <path d="M170,24 A146,146 0 0,1 296,104 L170,170 Z" fill="rgba(59,130,246,0.12)" stroke="#3b82f6" stroke-width="2"/>
              <path d="M296,104 A146,146 0 0,1 296,246 L170,170 Z" fill="rgba(245,158,11,0.12)" stroke="#f59e0b" stroke-width="2"/>
              <path d="M296,246 A146,146 0 0,1 44,246 L170,170 Z" fill="rgba(16,185,129,0.12)" stroke="#10b981" stroke-width="2"/>
              <path d="M44,246 A146,146 0 0,1 170,24 L170,170 Z" fill="rgba(139,92,246,0.12)" stroke="#8b5cf6" stroke-width="2"/>
              <!-- Centre -->
              <circle cx="170" cy="170" r="46" fill="var(--bg-card,#fff)" stroke="var(--border,#e2e5ea)" stroke-width="2"/>
              <text x="170" y="164" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink,#1e1e2e)">Believe</text>
              <text x="170" y="178" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink,#1e1e2e)">you can</text>
              <!-- Clockwise arrows -->
              <path d="M200,42 Q230,32 255,58" fill="none" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arwG)"/>
              <path d="M306,178 Q312,210 298,238" fill="none" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#arwR)"/>
              <path d="M210,302 Q170,312 130,302" fill="none" stroke="#10b981" stroke-width="1.5" marker-end="url(#arwO)"/>
              <path d="M38,190 Q28,150 48,112" fill="none" stroke="#8b5cf6" stroke-width="1.5" marker-end="url(#arwW)"/>
              <defs>
                <marker id="arwG" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#3b82f6"/></marker>
                <marker id="arwR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#f59e0b"/></marker>
                <marker id="arwO" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#10b981"/></marker>
                <marker id="arwW" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#8b5cf6"/></marker>
              </defs>
              <!-- Labels -->
              <text x="212" y="66" text-anchor="middle" font-size="15" font-weight="800" fill="#3b82f6">G</text>
              <text x="212" y="80" text-anchor="middle" font-size="7.5" font-weight="600" fill="#3b82f6">Gift yourself</text>
              <text x="212" y="90" text-anchor="middle" font-size="7.5" font-weight="600" fill="#3b82f6">success</text>
              <text x="272" y="170" text-anchor="middle" font-size="15" font-weight="800" fill="#f59e0b">R</text>
              <text x="272" y="184" text-anchor="middle" font-size="7.5" font-weight="600" fill="#f59e0b">Rise above</text>
              <text x="272" y="194" text-anchor="middle" font-size="7.5" font-weight="600" fill="#f59e0b">with small steps</text>
              <text x="170" y="268" text-anchor="middle" font-size="15" font-weight="800" fill="#10b981">O</text>
              <text x="170" y="282" text-anchor="middle" font-size="7.5" font-weight="600" fill="#10b981">Own your</text>
              <text x="170" y="292" text-anchor="middle" font-size="7.5" font-weight="600" fill="#10b981">knowledge</text>
              <text x="68" y="170" text-anchor="middle" font-size="15" font-weight="800" fill="#8b5cf6">W</text>
              <text x="68" y="184" text-anchor="middle" font-size="7.5" font-weight="600" fill="#8b5cf6">Watch for what</text>
              <text x="68" y="194" text-anchor="middle" font-size="7.5" font-weight="600" fill="#8b5cf6">comes next</text>
            </svg>
          </div>

          <!-- GROW detail cards -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-left:4px solid #3b82f6;background:rgba(59,130,246,0.04);">
              <div style="font-weight:700;font-size:0.9375rem;color:#3b82f6;margin-bottom:4px;">G \u2014 Gift yourself success</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Celebrate what you <em>do</em> understand. Recognise your strengths before focusing on gaps.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat is one thing I understand?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow would I teach this to a friend?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-left:4px solid #f59e0b;background:rgba(245,158,11,0.04);">
              <div style="font-weight:700;font-size:0.9375rem;color:#f59e0b;margin-bottom:4px;">R \u2014 Rise above with small steps</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Identify what you don\u2019t yet understand and plan a small, achievable step to improve.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat do I not yet understand?\u201d<br/>
                <strong>Go deeper:</strong> \u201cWhat will I do to improve?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-left:4px solid #10b981;background:rgba(16,185,129,0.04);">
              <div style="font-weight:700;font-size:0.9375rem;color:#10b981;margin-bottom:4px;">O \u2014 Own your knowledge</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Make learning yours by connecting it to real life and sharing it with others.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat is one real-life example?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow have I shared this with someone?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-left:4px solid #8b5cf6;background:rgba(139,92,246,0.04);">
              <div style="font-weight:700;font-size:0.9375rem;color:#8b5cf6;margin-bottom:4px;">W \u2014 Watch for what comes next</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Look ahead. Activate prior knowledge about the next topic so you arrive prepared.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:6px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cWhat do I already know about the next topic?\u201d<br/>
                <strong>Go deeper:</strong> \u201cWhat is coming up and how can I prepare?\u201d
              </div>
            </div>
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
        <div class="assess-card">
          <div class="assess-section-title">ACT on Feedback</div>
          <div class="assess-section-desc">
            A learner-centred framework for acting on feedback received. ACT teaches students to treat feedback as a growth tool
            rather than a judgement \u2014 moving from passive receipt to active response.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-top:4px solid #ef4444;background:rgba(239,68,68,0.03);">
              <div style="font-weight:700;font-size:0.9375rem;color:#ef4444;margin-bottom:4px;">A \u2014 Acknowledge</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Receive the feedback with an open mind. Notice your emotional response and look past it to the learning message.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:8px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cHow do I feel about this feedback?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow might it help me learn better?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-top:4px solid #f59e0b;background:rgba(245,158,11,0.03);">
              <div style="font-weight:700;font-size:0.9375rem;color:#f59e0b;margin-bottom:4px;">C \u2014 Connect</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Link the feedback to your success criteria, your goals, and any previous feedback you\u2019ve received.</div>
              <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:8px;line-height:1.5;">
                <strong>Ask yourself:</strong> \u201cHow does this connect with the success criteria or my goals?\u201d<br/>
                <strong>Go deeper:</strong> \u201cHow does this connect with previous feedback?\u201d
              </div>
            </div>
            <div style="padding:14px;border-radius:10px;border:1px solid var(--border,#e2e5ea);border-top:4px solid #3b82f6;background:rgba(59,130,246,0.03);">
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
        <div class="assess-card">
          <div class="assess-section-title">The Proactive Learner Cycle</div>
          <div class="assess-section-desc">
            Beatty\u2019s Proactive Learner model shows how GROW, ACT, MAP, and ASK work together in a continuous cycle
            \u2014 both in and out of lessons. The inner ring represents the learner behaviours that drive the cycle: Prepare, Participate, and Process.
          </div>

          <div style="display:flex;justify-content:center;margin-bottom:20px;">
            <svg viewBox="0 0 400 400" width="360" height="360" style="max-width:100%;">
              <!-- Outer ring: GROW / ACT / MAP / ASK -->
              <!-- Top-right: GROW -->
              <path d="M200,30 A170,170 0 0,1 370,200 L200,200 Z" fill="rgba(59,130,246,0.10)" stroke="#3b82f6" stroke-width="2.5"/>
              <!-- Bottom-right: ACT -->
              <path d="M370,200 A170,170 0 0,1 200,370 L200,200 Z" fill="rgba(239,68,68,0.10)" stroke="#ef4444" stroke-width="2.5"/>
              <!-- Bottom-left: MAP -->
              <path d="M200,370 A170,170 0 0,1 30,200 L200,200 Z" fill="rgba(16,185,129,0.10)" stroke="#10b981" stroke-width="2.5"/>
              <!-- Top-left: ASK -->
              <path d="M30,200 A170,170 0 0,1 200,30 L200,200 Z" fill="rgba(245,158,11,0.10)" stroke="#f59e0b" stroke-width="2.5"/>

              <!-- Inner ring: Prepare / Participate / Process -->
              <circle cx="200" cy="200" r="90" fill="none" stroke="var(--border,#d1d5db)" stroke-width="1" stroke-dasharray="4,3"/>
              <!-- Prepare (top) -->
              <path d="M200,110 A90,90 0 0,1 278,245 L200,200 Z" fill="rgba(99,102,241,0.08)" stroke="#6366f1" stroke-width="1.5"/>
              <!-- Participate (bottom-right) -->
              <path d="M278,245 A90,90 0 0,1 122,245 L200,200 Z" fill="rgba(236,72,153,0.08)" stroke="#ec4899" stroke-width="1.5"/>
              <!-- Process (bottom-left) -->
              <path d="M122,245 A90,90 0 0,1 200,110 L200,200 Z" fill="rgba(20,184,166,0.08)" stroke="#14b8a6" stroke-width="1.5"/>

              <!-- Centre -->
              <circle cx="200" cy="200" r="36" fill="var(--bg-card,#fff)" stroke="var(--border,#e2e5ea)" stroke-width="2"/>
              <text x="200" y="195" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink,#1e1e2e)">Proactive</text>
              <text x="200" y="208" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink,#1e1e2e)">Learner</text>

              <!-- Outer clockwise arrows -->
              <path d="M260,48 Q310,40 345,80" fill="none" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#plArw1)"/>
              <path d="M378,260 Q380,310 345,340" fill="none" stroke="#ef4444" stroke-width="1.5" marker-end="url(#plArw2)"/>
              <path d="M140,370 Q90,365 58,335" fill="none" stroke="#10b981" stroke-width="1.5" marker-end="url(#plArw3)"/>
              <path d="M35,140 Q32,90 55,60" fill="none" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#plArw4)"/>
              <defs>
                <marker id="plArw1" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#3b82f6"/></marker>
                <marker id="plArw2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#ef4444"/></marker>
                <marker id="plArw3" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#10b981"/></marker>
                <marker id="plArw4" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#f59e0b"/></marker>
              </defs>

              <!-- Outer labels -->
              <text x="305" y="105" text-anchor="middle" font-size="16" font-weight="800" fill="#3b82f6">GROW</text>
              <text x="305" y="120" text-anchor="middle" font-size="7.5" fill="#3b82f6" font-weight="500">Reflect on learning</text>
              <text x="315" y="310" text-anchor="middle" font-size="16" font-weight="800" fill="#ef4444">ACT</text>
              <text x="315" y="325" text-anchor="middle" font-size="7.5" fill="#ef4444" font-weight="500">Act on feedback</text>
              <text x="90" y="310" text-anchor="middle" font-size="16" font-weight="800" fill="#10b981">MAP</text>
              <text x="90" y="325" text-anchor="middle" font-size="7.5" fill="#10b981" font-weight="500">Map your progress</text>
              <text x="95" y="105" text-anchor="middle" font-size="16" font-weight="800" fill="#f59e0b">ASK</text>
              <text x="95" y="120" text-anchor="middle" font-size="7.5" fill="#f59e0b" font-weight="500">Ask for help</text>

              <!-- Inner labels -->
              <text x="245" y="157" text-anchor="middle" font-size="10" font-weight="700" fill="#6366f1">Prepare</text>
              <text x="240" y="268" text-anchor="middle" font-size="10" font-weight="700" fill="#ec4899">Participate</text>
              <text x="155" y="165" text-anchor="middle" font-size="10" font-weight="700" fill="#14b8a6">Process</text>
            </svg>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:0.8125rem;font-weight:700;color:var(--ink);margin-bottom:6px;">Outer Ring \u2014 Learning Practices</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
                <span style="color:#3b82f6;font-weight:600;">GROW</span> \u2192 Reflect on what you know and don\u2019t know<br/>
                <span style="color:#ef4444;font-weight:600;">ACT</span> \u2192 Process and act on feedback received<br/>
                <span style="color:#10b981;font-weight:600;">MAP</span> \u2192 Track your progress against goals<br/>
                <span style="color:#f59e0b;font-weight:600;">ASK</span> \u2192 Seek help and clarify understanding
              </div>
            </div>
            <div>
              <div style="font-size:0.8125rem;font-weight:700;color:var(--ink);margin-bottom:6px;">Inner Ring \u2014 Learner Behaviours</div>
              <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
                <span style="color:#6366f1;font-weight:600;">Prepare</span> \u2192 Get ready for learning before class<br/>
                <span style="color:#ec4899;font-weight:600;">Participate</span> \u2192 Engage actively during lessons<br/>
                <span style="color:#14b8a6;font-weight:600;">Process</span> \u2192 Make sense of learning after class
              </div>
            </div>
          </div>
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
        temperature: 0.6, maxTokens: 1500
      });

      output.innerHTML = renderAIOutput(text);
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
        temperature: 0.6, maxTokens: 1500
      });

      output.innerHTML = renderAIOutput(text);
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
