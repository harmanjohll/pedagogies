/*
 * Co-Cher+ (Beta) — Autopilot Workflow Agent
 * ============================================
 * Compact, icon-driven output with clickable deep-dive elements.
 * Each step's output is parsed into structured sections that teachers
 * can click to expand, refine, or navigate to the relevant Co-Cher page.
 */

import { sendChat } from '../api.js';
import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';
import { processLatex } from '../utils/latex.js';

/* ── SVG icon library (inline, small) ── */
const I = {
  book:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  target:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  check:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  clock:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  users:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  zap:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  file:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  msg:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  edit:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  grid:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  award:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`,
  bulb:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`,
  heart:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  arrow:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  ext:      `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  layers:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
};

/* ── Pipeline step definitions ── */

const STEPS = [
  {
    id: 'sow',
    label: 'Scheme of Work',
    icon: I.calendar,
    color: '#8b5cf6',
    brief: 'Unit overview, topic sequence, and assessment strategy',
    route: '/knowledge',
    routeLabel: 'Knowledge Base',
    buildPrompt: (params, _prev) => ({
      system: `You are Co-Cher+, an expert Singapore MOE curriculum designer. Generate a concise Scheme of Work.

IMPORTANT: Output in this EXACT structure using these section markers:

[UNIT_OVERVIEW]
Subject: ${params.subject}
Level: ${params.level}
Duration: ${params.duration || '4-6 weeks'}
E21CC Focus: (identify 1-2 primary domains)

[LEARNING_OUTCOMES]
- (outcome 1, measurable, E21CC-aligned)
- (outcome 2)
- (outcome 3)
- (outcome 4 — optional)

[TOPIC_SEQUENCE]
Week 1: (topic) | (key concepts) | (E21CC domain) | (pedagogy)
Week 2: (topic) | (key concepts) | (E21CC domain) | (pedagogy)
Week 3: (topic) | (key concepts) | (E21CC domain) | (pedagogy)
Week 4: (topic) | (key concepts) | (E21CC domain) | (pedagogy)

[ASSESSMENT_STRATEGY]
Formative: (brief — 1-2 lines)
Summative: (brief — 1-2 lines)

[RESOURCES]
- (resource 1)
- (resource 2)
- (resource 3)

Be specific to Singapore's ${params.subject} syllabus. Keep each section terse — bullet points, not paragraphs.`,
      user: `Create a Scheme of Work for:
- Subject: ${params.subject}
- Topic/Unit: ${params.topic}
- Level: ${params.level}
- Duration: ${params.duration || '4-6 weeks'}
${params.notes ? `- Notes: ${params.notes}` : ''}`
    })
  },
  {
    id: 'lesson',
    label: 'Lesson Plan',
    icon: I.book,
    color: '#4361ee',
    brief: 'Learning intentions, lesson flow, differentiation',
    route: '/lesson-planner',
    routeLabel: 'Lesson Planner',
    buildPrompt: (params, prev) => ({
      system: `You are Co-Cher+, a Singapore lesson designer. Using the SoW context below, generate a lesson plan.

Context — SoW:
${prev.sow}

IMPORTANT: Output in this EXACT structure:

[LESSON_TITLE]
(title of the lesson)

[OVERVIEW]
Duration: (e.g. 60 min)
E21CC Focus: (domain)
STP Area: (area)

[LEARNING_INTENTIONS]
- (intention 1)
- (intention 2)

[SUCCESS_CRITERIA]
- (criterion 1)
- (criterion 2)
- (criterion 3)

[LESSON_FLOW]
Opening (__ min): (1-2 sentences — hook, activation)
Development (__ min): (2-3 sentences — core activity, grouping, strategies)
Consolidation (__ min): (1-2 sentences — closure, exit ticket)

[DIFFERENTIATION]
Support: (1 sentence)
Stretch: (1 sentence)

[TEACHER_NOTES]
- (note 1 — key consideration or misconception)
- (note 2)

Keep it practical and classroom-ready. Terse bullet points.`,
      user: `Design a lesson plan for the first core lesson. Subject: ${params.subject}, Level: ${params.level}, Topic: ${params.topic}.`
    })
  },
  {
    id: 'enactment',
    label: 'Enactment',
    icon: I.zap,
    color: '#10b981',
    brief: 'Stimulus material, discussion prompts, worksheet',
    route: '/stimulus-material',
    routeLabel: 'Stimulus Material',
    buildPrompt: (params, prev) => ({
      system: `You are Co-Cher+, a Singapore classroom resources specialist. Using the lesson plan below, generate three resources.

Context — Lesson Plan:
${prev.lesson}

IMPORTANT: Output in this EXACT structure:

[STIMULUS_TITLE]
(title of the stimulus text)

[STIMULUS_CONTENT]
(150-200 word passage, scenario, or case study — engaging, age-appropriate)

[STIMULUS_QUESTIONS]
- (question 1)
- (question 2)
- (question 3)

[DISCUSSION_OPENING]
(one opening prompt — spark interest)

[DISCUSSION_DEEPENING]
- (deepening question 1 — push critical thinking)
- (deepening question 2)

[DISCUSSION_CLOSING]
(one closing prompt — reflection, personal connection)

[DISCUSSION_TIPS]
- (facilitation tip 1)
- (facilitation tip 2)

[WORKSHEET_TITLE]
(worksheet title)

[WORKSHEET_TASKS]
1. (Recall task)
2. (Comprehension task)
3. (Application task)
4. (Analysis task)
5. (Reflection prompt)

Specific to ${params.subject} at ${params.level}. Singapore context. Terse.`,
      user: `Generate resources for the lesson on "${params.topic}".`
    })
  },
  {
    id: 'assessment',
    label: 'Assessment',
    icon: I.award,
    color: '#f59e0b',
    brief: 'Rubric, exit ticket, draft questions',
    route: '/assessment/afl',
    routeLabel: 'AfL',
    buildPrompt: (params, prev) => ({
      system: `You are Co-Cher+, a Singapore assessment specialist. Generate assessment materials.

Context — Lesson Plan:
${prev.lesson}

IMPORTANT: Output in this EXACT structure:

[RUBRIC]
Criterion 1: Exemplary — (desc) | Proficient — (desc) | Developing — (desc) | Beginning — (desc)
Criterion 2: Exemplary — (desc) | Proficient — (desc) | Developing — (desc) | Beginning — (desc)
Criterion 3: Exemplary — (desc) | Proficient — (desc) | Developing — (desc) | Beginning — (desc)

[EXIT_TICKET]
1. Recall: (question)
2. Apply: (question)
3. Think Deeper: (question)

[DRAFT_QUESTIONS]
Q1 (Remember, 2m): (question) → (model answer)
Q2 (Understand, 3m): (question) → (model answer)
Q3 (Apply, 4m): (question) → (model answer)
Q4 (Analyse, 5m): (question) → (model answer)
Q5 (Evaluate, 6m): (question) → (model answer)

Specific to ${params.subject} at ${params.level}. Terse.`,
      user: `Create assessment materials for the lesson on "${params.topic}".`
    })
  },
  {
    id: 'reflection',
    label: 'Reflection',
    icon: I.heart,
    color: '#06b6d4',
    brief: 'Post-lesson reflection prompts and forward planning',
    route: '/lessons',
    routeLabel: 'Lessons',
    buildPrompt: (params, prev) => ({
      system: `You are Co-Cher+, a reflective practice coach. Generate post-lesson reflection prompts.

Context — Lesson Plan:
${prev.lesson}

IMPORTANT: Output in this EXACT structure:

[PULSE_CHECK]
Engagement indicators: (what to look for, 1-2 sentences)
Understanding indicators: (what to look for, 1-2 sentences)

[REFLECTION_PROMPTS]
- What worked well? (focus area hint)
- What would I adjust? (focus area hint)
- E21CC observations? (what to look for)
- Student voice? (what surprised me)

[FORWARD_PLANNING]
- (suggestion 1 for next lesson)
- (suggestion 2 for next lesson)
- (what to revisit if needed)

[GROWTH_CONNECTION]
STP area strengthened: (area)
Try next time: (one concrete strategy)

Warm, encouraging. Terse.`,
      user: `Generate reflection prompts for the lesson on "${params.topic}" (${params.subject}, ${params.level}).`
    })
  }
];

/* ── Section parser — extracts [MARKER] sections from raw text ── */
function parseSections(raw) {
  const sections = {};
  const regex = /\[([A-Z_]+)\]\s*\n([\s\S]*?)(?=\n\[|$)/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    sections[m[1]] = m[2].trim();
  }
  return sections;
}

/* ── Escape HTML ── */
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Parse bullet lines from a section ── */
function bullets(text) {
  if (!text) return [];
  return text.split('\n').map(l => l.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
}

/* ── Render a single step's structured output ── */
function renderStepOutput(stepId, raw, params) {
  const s = parseSections(raw);
  // If structured parsing fails, fall back to compact markdown
  if (Object.keys(s).length === 0) return renderFallback(raw);

  switch (stepId) {
    case 'sow': return renderSoW(s, params);
    case 'lesson': return renderLesson(s);
    case 'enactment': return renderEnactment(s);
    case 'assessment': return renderAssessment(s);
    case 'reflection': return renderReflection(s);
    default: return renderFallback(raw);
  }
}

function renderSoW(s, params) {
  const outcomes = bullets(s.LEARNING_OUTCOMES);
  const weeks = bullets(s.TOPIC_SEQUENCE).map(w => {
    const parts = w.split('|').map(p => p.trim());
    return { week: parts[0] || w, concepts: parts[1] || '', domain: parts[2] || '', pedagogy: parts[3] || '' };
  });
  const resources = bullets(s.RESOURCES);

  return `
    <div class="ap-section">
      <div class="ap-section-head">${I.target}<span>Learning Outcomes</span></div>
      <div class="ap-pills">
        ${outcomes.map(o => `<div class="ap-pill ap-clickable" data-dive="outcome" data-text="${esc(o)}">${I.arrow}<span>${esc(o)}</span></div>`).join('')}
      </div>
    </div>
    <div class="ap-section">
      <div class="ap-section-head">${I.calendar}<span>Topic Sequence</span></div>
      <div class="ap-timeline">
        ${weeks.map((w, i) => `
          <div class="ap-tl-row ap-clickable" data-dive="week" data-text="${esc(w.week + ' — ' + w.concepts)}">
            <div class="ap-tl-dot">${i + 1}</div>
            <div class="ap-tl-body">
              <strong>${esc(w.week)}</strong>
              ${w.concepts ? `<span class="ap-subtle">${esc(w.concepts)}</span>` : ''}
              ${w.domain ? `<span class="ap-tag">${esc(w.domain)}</span>` : ''}
              ${w.pedagogy ? `<span class="ap-tag ap-tag-alt">${esc(w.pedagogy)}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ${s.ASSESSMENT_STRATEGY ? `
    <div class="ap-section">
      <div class="ap-section-head">${I.check}<span>Assessment Strategy</span></div>
      <div class="ap-compact-text">${esc(s.ASSESSMENT_STRATEGY).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
    ${resources.length ? `
    <div class="ap-section">
      <div class="ap-section-head">${I.file}<span>Resources</span></div>
      <div class="ap-pills">${resources.map(r => `<div class="ap-pill">${I.file}<span>${esc(r)}</span></div>`).join('')}</div>
    </div>` : ''}`;
}

function renderLesson(s) {
  const intentions = bullets(s.LEARNING_INTENTIONS);
  const criteria = bullets(s.SUCCESS_CRITERIA);
  const notes = bullets(s.TEACHER_NOTES);

  return `
    ${s.LESSON_TITLE ? `<div class="ap-lesson-title">${esc(s.LESSON_TITLE)}</div>` : ''}
    ${s.OVERVIEW ? `<div class="ap-meta-row">${esc(s.OVERVIEW).split('\n').map(l => `<span class="ap-tag">${esc(l.trim())}</span>`).join('')}</div>` : ''}
    <div class="ap-two-col">
      <div class="ap-section">
        <div class="ap-section-head">${I.target}<span>Learning Intentions</span></div>
        ${intentions.map(li => `<div class="ap-pill ap-clickable" data-dive="intention" data-text="${esc(li)}">${I.arrow}<span>${esc(li)}</span></div>`).join('')}
      </div>
      <div class="ap-section">
        <div class="ap-section-head">${I.check}<span>Success Criteria</span></div>
        ${criteria.map(c => `<div class="ap-pill">${I.check}<span>${esc(c)}</span></div>`).join('')}
      </div>
    </div>
    <div class="ap-section">
      <div class="ap-section-head">${I.clock}<span>Lesson Flow</span></div>
      <div class="ap-flow-strip">
        ${(s.LESSON_FLOW || '').split('\n').filter(l => l.trim()).map(phase => {
          const [label, ...rest] = phase.split(':');
          return `<div class="ap-flow-block ap-clickable" data-dive="phase" data-text="${esc(phase)}">
            <div class="ap-flow-label">${esc(label.trim())}</div>
            <div class="ap-flow-desc">${esc(rest.join(':').trim())}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    ${s.DIFFERENTIATION ? `
    <div class="ap-section">
      <div class="ap-section-head">${I.users}<span>Differentiation</span></div>
      <div class="ap-compact-text">${esc(s.DIFFERENTIATION).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
    ${notes.length ? `
    <div class="ap-section">
      <div class="ap-section-head">${I.bulb}<span>Teacher Notes</span></div>
      <div class="ap-pills">${notes.map(n => `<div class="ap-pill">${I.bulb}<span>${esc(n)}</span></div>`).join('')}</div>
    </div>` : ''}`;
}

function renderEnactment(s) {
  const stimQ = bullets(s.STIMULUS_QUESTIONS);
  const deepening = bullets(s.DISCUSSION_DEEPENING);
  const tips = bullets(s.DISCUSSION_TIPS);
  const tasks = bullets(s.WORKSHEET_TASKS);

  return `
    <div class="ap-sub-card">
      <div class="ap-sub-head">${I.file}<span>Stimulus Material</span><span class="ap-sub-action ap-clickable" data-dive="stimulus-full">${I.ext} Expand</span></div>
      ${s.STIMULUS_TITLE ? `<div class="ap-sub-title">${esc(s.STIMULUS_TITLE)}</div>` : ''}
      <div class="ap-stimulus-preview">${esc(s.STIMULUS_CONTENT || '').slice(0, 200)}${(s.STIMULUS_CONTENT || '').length > 200 ? '...' : ''}</div>
      <div class="ap-stimulus-full" style="display:none;">${esc(s.STIMULUS_CONTENT || '').replace(/\n/g, '<br>')}</div>
      ${stimQ.length ? `<div class="ap-pills">${stimQ.map(q => `<div class="ap-pill ap-clickable" data-dive="question" data-text="${esc(q)}">${I.msg}<span>${esc(q)}</span></div>`).join('')}</div>` : ''}
    </div>

    <div class="ap-sub-card">
      <div class="ap-sub-head">${I.msg}<span>Discussion Prompts</span></div>
      ${s.DISCUSSION_OPENING ? `<div class="ap-disc-prompt"><span class="ap-tag ap-tag-alt">Opening</span>${esc(s.DISCUSSION_OPENING)}</div>` : ''}
      ${deepening.map(d => `<div class="ap-disc-prompt ap-clickable" data-dive="discussion" data-text="${esc(d)}"><span class="ap-tag">Deepening</span>${esc(d)}</div>`).join('')}
      ${s.DISCUSSION_CLOSING ? `<div class="ap-disc-prompt"><span class="ap-tag ap-tag-alt">Closing</span>${esc(s.DISCUSSION_CLOSING)}</div>` : ''}
      ${tips.length ? `<div class="ap-tips">${tips.map(t => `<span>${I.bulb} ${esc(t)}</span>`).join('')}</div>` : ''}
    </div>

    <div class="ap-sub-card">
      <div class="ap-sub-head">${I.edit}<span>Worksheet</span>${s.WORKSHEET_TITLE ? ` — ${esc(s.WORKSHEET_TITLE)}` : ''}</div>
      <div class="ap-task-list">
        ${tasks.map((t, i) => `<div class="ap-task-item ap-clickable" data-dive="task" data-text="${esc(t)}"><span class="ap-task-num">${i + 1}</span><span>${esc(t)}</span></div>`).join('')}
      </div>
    </div>`;
}

function renderAssessment(s) {
  const rubricRows = bullets(s.RUBRIC);
  const exitQ = bullets(s.EXIT_TICKET);
  const draftQ = bullets(s.DRAFT_QUESTIONS);

  return `
    <div class="ap-sub-card">
      <div class="ap-sub-head">${I.grid}<span>Rubric</span></div>
      ${rubricRows.map(r => {
        const [criterion, ...levels] = r.split('|').map(p => p.replace(/^Criterion\s*\d+:\s*/i, '').trim());
        return `<div class="ap-rubric-row ap-clickable" data-dive="rubric" data-text="${esc(r)}">
          <div class="ap-rubric-criterion">${esc(criterion)}</div>
          <div class="ap-rubric-levels">${levels.map(l => `<span class="ap-rubric-level">${esc(l)}</span>`).join('')}</div>
        </div>`;
      }).join('')}
    </div>

    <div class="ap-sub-card">
      <div class="ap-sub-head">${I.zap}<span>Exit Ticket</span></div>
      ${exitQ.map(q => {
        const [label, ...rest] = q.split(':');
        return `<div class="ap-exit-q ap-clickable" data-dive="exit-ticket" data-text="${esc(q)}">
          <span class="ap-tag">${esc(label.trim())}</span>
          <span>${esc(rest.join(':').trim())}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="ap-sub-card">
      <div class="ap-sub-head">${I.file}<span>Draft Questions</span></div>
      ${draftQ.map(q => {
        const match = q.match(/^Q\d+\s*\(([^)]+)\):\s*(.*?)(?:\s*→\s*(.*))?$/);
        if (match) {
          return `<div class="ap-draft-q ap-clickable" data-dive="draft-question" data-text="${esc(q)}">
            <span class="ap-tag">${esc(match[1])}</span>
            <span class="ap-draft-q-text">${esc(match[2])}</span>
            ${match[3] ? `<div class="ap-draft-q-answer">${I.check} ${esc(match[3])}</div>` : ''}
          </div>`;
        }
        return `<div class="ap-draft-q ap-clickable" data-dive="draft-question" data-text="${esc(q)}">${esc(q)}</div>`;
      }).join('')}
    </div>`;
}

function renderReflection(s) {
  const prompts = bullets(s.REFLECTION_PROMPTS);
  const forward = bullets(s.FORWARD_PLANNING);

  return `
    ${s.PULSE_CHECK ? `
    <div class="ap-section">
      <div class="ap-section-head">${I.heart}<span>Pulse Check</span></div>
      <div class="ap-compact-text">${esc(s.PULSE_CHECK).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
    <div class="ap-section">
      <div class="ap-section-head">${I.msg}<span>Reflection Prompts</span></div>
      ${prompts.map(p => {
        const [q, ...hints] = p.split('(');
        const hint = hints.join('(').replace(/\)$/, '');
        return `<div class="ap-reflection-item ap-clickable" data-dive="reflection" data-text="${esc(p)}">
          <span class="ap-refl-q">${esc(q.trim())}</span>
          ${hint ? `<span class="ap-refl-hint">${esc(hint.trim())}</span>` : ''}
        </div>`;
      }).join('')}
    </div>
    ${forward.length ? `
    <div class="ap-section">
      <div class="ap-section-head">${I.zap}<span>Forward Planning</span></div>
      <div class="ap-pills">${forward.map(f => `<div class="ap-pill">${I.arrow}<span>${esc(f)}</span></div>`).join('')}</div>
    </div>` : ''}
    ${s.GROWTH_CONNECTION ? `
    <div class="ap-section">
      <div class="ap-section-head">${I.award}<span>Growth Connection</span></div>
      <div class="ap-compact-text">${esc(s.GROWTH_CONNECTION).replace(/\n/g, '<br>')}</div>
    </div>` : ''}`;
}

function renderFallback(raw) {
  // Simple markdown fallback for unparseable output
  let html = esc(raw);
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:0.875rem;margin:12px 0 4px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:0.95rem;margin:14px 0 4px;">$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/^- (.+)$/gm, '<div class="ap-pill">' + I.arrow + '<span>$1</span></div>');
  html = html.replace(/\n\n/g, '<br>');
  return `<div class="ap-compact-text">${html}</div>`;
}


/* ── Render ── */

export function render(container) {
  let running = false;
  let aborted = false;
  let currentStep = -1;
  const outputs = {};     // step id → raw text
  let expandedDive = null; // { stepId, type, text } for deep-dive panel
  let params = {};

  function renderView() {
    // Preserve scroll position across re-renders
    const prevScroll = container.querySelector('.ap-scroll');
    const savedScrollTop = prevScroll ? prevScroll.scrollTop : 0;

    container.innerHTML = `
      <style>
        .ap-scroll { overflow-y: auto; height: 100%; }
        .ap-container { max-width: 920px; margin: 0 auto; padding: 24px 16px 48px; }
        .ap-header { margin-bottom: 20px; }
        .ap-header h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 2px; letter-spacing: -0.02em; color: var(--ink); }
        .ap-header p { font-size: 0.8125rem; color: var(--ink-muted); margin: 0; }
        .ap-beta { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.5625rem; font-weight: 700; background: var(--warning-light); color: var(--warning); margin-left: 6px; vertical-align: middle; letter-spacing: 0.04em; }

        .ap-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        @media (max-width: 600px) { .ap-form { grid-template-columns: 1fr; } }
        .ap-form .full { grid-column: 1 / -1; }
        .ap-form label { display: block; font-size: 0.6875rem; font-weight: 600; color: var(--ink-secondary); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
        .ap-actions { display: flex; gap: 8px; margin-bottom: 24px; }

        /* Pipeline dots */
        .ap-pipeline { display: flex; gap: 0; align-items: flex-start; margin-bottom: 20px; }
        .ap-step { flex: 1; text-align: center; position: relative; }
        .ap-step-dot { width: 32px; height: 32px; border-radius: 50%; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; border: 2px solid var(--border); background: var(--bg-card); color: var(--ink-faint); transition: all 0.3s ease; }
        .ap-step.active .ap-step-dot { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
        .ap-step.done .ap-step-dot { border-color: var(--success); background: var(--success); color: #fff; }
        .ap-step-label { font-size: 0.625rem; font-weight: 600; color: var(--ink-faint); }
        .ap-step.active .ap-step-label { color: var(--accent); }
        .ap-step.done .ap-step-label { color: var(--success); }
        .ap-step-line { position: absolute; top: 16px; left: 50%; width: 100%; height: 2px; background: var(--border); z-index: 0; }
        .ap-step:last-child .ap-step-line { display: none; }
        .ap-step.done .ap-step-line { background: var(--success); }

        /* Output cards */
        .ap-card { border-radius: 10px; border: 1px solid var(--border); background: var(--bg-card); margin-bottom: 12px; overflow: hidden; }
        .ap-card-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; cursor: pointer; user-select: none; }
        .ap-card-head:hover { background: var(--surface-hover); }
        .ap-card-icon { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ap-card-title { font-weight: 700; font-size: 0.8125rem; flex: 1; color: var(--ink); }
        .ap-card-brief { font-size: 0.6875rem; color: var(--ink-faint); }
        .ap-card-nav { font-size: 0.625rem; color: var(--ink-faint); padding: 2px 8px; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 3px; white-space: nowrap; }
        .ap-card-nav:hover { color: var(--accent); border-color: var(--accent); }
        .ap-chevron { transition: transform 0.2s ease; color: var(--ink-faint); }
        .ap-chevron.open { transform: rotate(180deg); }
        .ap-card-body { padding: 4px 16px 16px; display: none; color: var(--ink); }
        .ap-card-body.visible { display: block; }

        /* Structured sections */
        .ap-section { margin-bottom: 12px; }
        .ap-section-head { display: flex; align-items: center; gap: 6px; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-secondary); margin-bottom: 6px; }
        .ap-section-head svg { opacity: 0.6; }
        .ap-pills { display: flex; flex-direction: column; gap: 4px; }
        .ap-pill { display: flex; align-items: flex-start; gap: 6px; padding: 6px 10px; border-radius: 8px; background: var(--surface-hover); font-size: 0.8125rem; line-height: 1.45; border: 1px solid transparent; color: var(--ink); }
        .ap-pill svg { flex-shrink: 0; margin-top: 2px; opacity: 0.4; }
        .ap-clickable { cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
        .ap-clickable:hover { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-light); }

        .ap-tag { display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 0.625rem; font-weight: 600; background: var(--accent-light); color: var(--accent); white-space: nowrap; }
        .ap-tag-alt { background: var(--success-light); color: var(--success); }
        .ap-subtle { font-size: 0.75rem; color: var(--ink-secondary); }
        .ap-compact-text { font-size: 0.8125rem; color: var(--ink-secondary); line-height: 1.6; }

        /* Timeline */
        .ap-timeline { display: flex; flex-direction: column; gap: 0; }
        .ap-tl-row { display: flex; align-items: flex-start; gap: 10px; padding: 6px 8px; border-radius: 8px; border: 1px solid transparent; color: var(--ink); }
        .ap-tl-dot { width: 22px; height: 22px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 0.625rem; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
        .ap-tl-body { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 0.8125rem; }

        /* Lesson-specific */
        .ap-lesson-title { font-size: 1rem; font-weight: 700; margin-bottom: 6px; color: var(--ink); }
        .ap-meta-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
        .ap-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px; }
        @media (max-width: 600px) { .ap-two-col { grid-template-columns: 1fr; } }
        .ap-flow-strip { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
        .ap-flow-block { flex: 1; min-width: 140px; padding: 8px 10px; border-radius: 8px; background: var(--surface-hover); border: 1px solid transparent; }
        .ap-flow-label { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: var(--accent); margin-bottom: 2px; }
        .ap-flow-desc { font-size: 0.75rem; color: var(--ink-secondary); line-height: 1.4; }

        /* Enactment sub-cards */
        .ap-sub-card { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; background: var(--bg-card); }
        .ap-sub-head { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; margin-bottom: 6px; color: var(--ink); }
        .ap-sub-head svg { opacity: 0.5; }
        .ap-sub-action { margin-left: auto; font-size: 0.625rem; font-weight: 600; color: var(--accent); display: flex; align-items: center; gap: 3px; cursor: pointer; }
        .ap-sub-title { font-size: 0.8125rem; font-weight: 600; margin-bottom: 4px; color: var(--ink); }
        .ap-stimulus-preview { font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.5; margin-bottom: 8px; font-style: italic; }
        .ap-stimulus-full { font-size: 0.8125rem; color: var(--ink); line-height: 1.6; margin-bottom: 8px; padding: 8px; background: var(--surface-hover); border-radius: 6px; }
        .ap-disc-prompt { font-size: 0.8125rem; padding: 5px 8px; border-radius: 6px; border: 1px solid transparent; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; color: var(--ink); }
        .ap-tips { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; font-size: 0.75rem; color: var(--ink-secondary); }
        .ap-tips span { display: flex; align-items: center; gap: 4px; }
        .ap-task-list { display: flex; flex-direction: column; gap: 3px; }
        .ap-task-item { display: flex; align-items: flex-start; gap: 8px; padding: 5px 8px; border-radius: 6px; font-size: 0.8125rem; border: 1px solid transparent; color: var(--ink); }
        .ap-task-num { width: 20px; height: 20px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 0.625rem; font-weight: 700; flex-shrink: 0; }

        /* Assessment */
        .ap-rubric-row { padding: 6px 8px; border-radius: 6px; border: 1px solid transparent; margin-bottom: 3px; color: var(--ink); }
        .ap-rubric-criterion { font-size: 0.8125rem; font-weight: 600; margin-bottom: 3px; }
        .ap-rubric-levels { display: flex; gap: 4px; flex-wrap: wrap; }
        .ap-rubric-level { font-size: 0.6875rem; padding: 2px 6px; background: var(--surface-hover); border-radius: 4px; color: var(--ink-secondary); }
        .ap-exit-q { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 6px; font-size: 0.8125rem; border: 1px solid transparent; margin-bottom: 3px; color: var(--ink); }
        .ap-draft-q { padding: 6px 8px; border-radius: 6px; border: 1px solid transparent; margin-bottom: 3px; font-size: 0.8125rem; color: var(--ink); }
        .ap-draft-q-text { font-weight: 500; }
        .ap-draft-q-answer { font-size: 0.75rem; color: var(--success); margin-top: 2px; display: flex; align-items: center; gap: 4px; }

        /* Reflection */
        .ap-reflection-item { padding: 8px 10px; border-radius: 8px; border: 1px solid transparent; margin-bottom: 4px; color: var(--ink); }
        .ap-refl-q { font-size: 0.8125rem; font-weight: 600; display: block; }
        .ap-refl-hint { font-size: 0.75rem; color: var(--ink-secondary); }

        /* Deep-dive panel */
        .ap-dive-panel { position: fixed; right: 0; top: 0; width: 380px; height: 100vh; background: var(--bg-card); border-left: 1px solid var(--border); box-shadow: var(--shadow-lg, -4px 0 24px rgba(0,0,0,0.08)); z-index: 1000; display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.25s ease; }
        .ap-dive-panel.visible { transform: translateX(0); }
        .ap-dive-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
        .ap-dive-head h3 { font-size: 0.875rem; margin: 0; color: var(--ink); }
        .ap-dive-close { background: none; border: none; cursor: pointer; color: var(--ink-faint); padding: 4px; font-size: 1.25rem; }
        .ap-dive-body { flex: 1; overflow-y: auto; padding: 16px; }
        .ap-dive-text { font-size: 0.875rem; line-height: 1.7; margin-bottom: 16px; color: var(--ink); }
        .ap-dive-actions { display: flex; flex-direction: column; gap: 6px; }
        .ap-dive-action { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border); cursor: pointer; font-size: 0.8125rem; font-weight: 500; background: none; color: var(--ink); text-align: left; }
        .ap-dive-action:hover { border-color: var(--accent); background: var(--accent-light); }
        .ap-dive-action svg { opacity: 0.5; flex-shrink: 0; }

        .ap-spinner { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: apSpin 0.6s linear infinite; }
        @keyframes apSpin { to { transform: rotate(360deg); } }
        .ap-generating { display: flex; align-items: center; gap: 8px; padding: 14px; color: var(--ink-secondary); font-size: 0.8125rem; }
        .ap-empty-state { text-align: center; padding: 36px 20px; color: var(--ink-secondary); border: 2px dashed var(--border); border-radius: 12px; }
        .ap-empty-state p { margin: 6px 0 0; font-size: 0.8125rem; }
      </style>

      <div class="ap-scroll">
        <div class="ap-container">

          <div class="ap-header">
            <h1>Co-Cher+<span class="ap-beta">BETA</span></h1>
            <p>Full-workflow autopilot — SoW to Reflection in one pass.</p>
          </div>

          <div class="ap-form" id="ap-form">
            <div>
              <label for="ap-subject">Subject</label>
              <select id="ap-subject" class="input" style="width:100%;box-sizing:border-box;">
                <option value="">Select...</option>
                <option>English Language</option><option>Mother Tongue</option>
                <option>Mathematics</option><option>Additional Mathematics</option>
                <option>Science</option><option>Physics</option><option>Chemistry</option><option>Biology</option>
                <option>History</option><option>Geography</option><option>Social Studies</option>
                <option>Literature</option><option>Art</option><option>Music</option>
                <option>Physical Education</option><option>Character &amp; Citizenship Education</option>
                <option>General Paper</option><option>Computing</option>
                <option>Design &amp; Technology</option><option>Food &amp; Consumer Education</option>
                <option>Principles of Accounts</option><option>Economics</option>
                <option>H2 Mathematics</option><option>H2 Chemistry</option><option>H2 Physics</option><option>H2 Biology</option>
                <option>H2 Economics</option><option>H2 History</option><option>H2 Geography</option><option>H2 Literature</option>
              </select>
            </div>
            <div>
              <label for="ap-school-type">School Type</label>
              <select id="ap-school-type" class="input" style="width:100%;box-sizing:border-box;">
                <option value="">Select...</option>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="jc">Junior College</option>
              </select>
            </div>
            <div>
              <label for="ap-year">Year</label>
              <select id="ap-year" class="input" style="width:100%;box-sizing:border-box;">
                <option value="">Select school type first...</option>
              </select>
            </div>
            <div>
              <label for="ap-demand">Level of Demand</label>
              <select id="ap-demand" class="input" style="width:100%;box-sizing:border-box;">
                <option value="">Select year first...</option>
              </select>
            </div>
            <div class="full">
              <label for="ap-topic">Topic / Unit</label>
              <input id="ap-topic" class="input" type="text" placeholder="e.g. Chemical Bonding, Narrative Writing, The Cold War..." style="width:100%;box-sizing:border-box;">
            </div>
            <div>
              <label for="ap-duration">Duration</label>
              <select id="ap-duration" class="input" style="width:100%;box-sizing:border-box;">
                <option>2 weeks</option><option>3 weeks</option>
                <option selected>4-6 weeks</option><option>One term</option>
              </select>
            </div>
            <div>
              <label for="ap-notes">Additional Notes (optional)</label>
              <input id="ap-notes" class="input" type="text" placeholder="e.g. mixed-ability, focus on inquiry..." style="width:100%;box-sizing:border-box;">
            </div>
          </div>

          <div class="ap-actions">
            <button id="ap-run-btn" class="btn btn-primary" style="flex:1;max-width:260px;">
              ${I.layers} Run Full Workflow
            </button>
            <button id="ap-stop-btn" class="btn btn-ghost" style="display:none;color:#ef4444;">Stop</button>
          </div>

          <!-- Pipeline -->
          <div class="ap-pipeline" style="${currentStep < 0 ? 'display:none;' : ''}">
            ${STEPS.map((s, i) => {
              let cls = '';
              if (i < currentStep || (i <= currentStep && outputs[s.id])) cls = 'done';
              else if (i === currentStep && running) cls = 'active';
              return `
                <div class="ap-step ${cls}">
                  <div class="ap-step-line"></div>
                  <div class="ap-step-dot">${outputs[s.id] ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : s.icon}</div>
                  <div class="ap-step-label">${s.label}</div>
                </div>`;
            }).join('')}
          </div>

          <!-- Output cards -->
          <div id="ap-outputs">
            ${currentStep < 0 && Object.keys(outputs).length === 0 ? `
              <div class="ap-empty-state">
                ${I.layers}
                <p>Configure your lesson above, then <strong>Run Full Workflow</strong>.</p>
              </div>
            ` : ''}

            ${STEPS.map((s, i) => {
              if (!outputs[s.id] && i !== currentStep) return '';
              const isGenerating = i === currentStep && running && !outputs[s.id];
              return `
                <div class="ap-card">
                  <div class="ap-card-head" data-toggle="${s.id}">
                    <div class="ap-card-icon" style="background:${s.color}14;color:${s.color};">${s.icon}</div>
                    <div class="ap-card-title">${s.label}</div>
                    ${!isGenerating && outputs[s.id] ? `
                      <div class="ap-card-brief">${s.brief}</div>
                      <div class="ap-card-nav" data-goto="${s.route}">${s.routeLabel} ${I.ext}</div>
                    ` : ''}
                    ${isGenerating ? '<div class="ap-spinner"></div>' : `
                      <svg class="ap-chevron${outputs[s.id] ? ' open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    `}
                  </div>
                  ${isGenerating ? `
                    <div class="ap-generating"><div class="ap-spinner"></div><span>${s.brief}...</span></div>
                  ` : outputs[s.id] ? `
                    <div class="ap-card-body visible" id="ap-body-${s.id}">
                      ${renderStepOutput(s.id, outputs[s.id], params)}
                    </div>
                  ` : ''}
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Deep-dive slide-over panel -->
      <div class="ap-dive-panel${expandedDive ? ' visible' : ''}" id="ap-dive-panel">
        ${expandedDive ? `
          <div class="ap-dive-head">
            <h3>${esc(expandedDive.type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}</h3>
            <button class="ap-dive-close" id="ap-dive-close">&times;</button>
          </div>
          <div class="ap-dive-body">
            <div class="ap-dive-text">${esc(expandedDive.text)}</div>
            <div class="ap-dive-actions">
              <button class="ap-dive-action" data-action="planner">${I.book} <span>Open in Lesson Planner</span></button>
              <button class="ap-dive-action" data-action="refine">${I.edit} <span>Ask Co-Cher to refine this</span></button>
              <button class="ap-dive-action" data-action="copy">${I.file} <span>Copy to clipboard</span></button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Restore scroll position after re-render
    const newScroll = container.querySelector('.ap-scroll');
    if (newScroll && savedScrollTop) newScroll.scrollTop = savedScrollTop;

    /* ── Wire events ── */

    // Toggle card bodies
    container.querySelectorAll('.ap-card-head[data-toggle]').forEach(h => {
      h.addEventListener('click', (e) => {
        if (e.target.closest('.ap-card-nav')) return;
        const body = container.querySelector(`#ap-body-${h.dataset.toggle}`);
        const chev = h.querySelector('.ap-chevron');
        if (body) { body.classList.toggle('visible'); if (chev) chev.classList.toggle('open'); }
      });
    });

    // Navigate-to-page buttons
    container.querySelectorAll('.ap-card-nav[data-goto]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate(btn.dataset.goto);
      });
    });

    // Stimulus expand toggle
    container.querySelectorAll('.ap-sub-action[data-dive="stimulus-full"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.ap-sub-card');
        const preview = card.querySelector('.ap-stimulus-preview');
        const full = card.querySelector('.ap-stimulus-full');
        if (preview && full) {
          const showing = full.style.display !== 'none';
          full.style.display = showing ? 'none' : 'block';
          preview.style.display = showing ? 'block' : 'none';
          btn.innerHTML = `${I.ext} ${showing ? 'Expand' : 'Collapse'}`;
        }
      });
    });

    // Clickable elements → deep-dive panel
    container.querySelectorAll('.ap-clickable[data-dive]').forEach(el => {
      if (el.dataset.dive === 'stimulus-full') return; // handled above
      el.addEventListener('click', () => {
        expandedDive = { type: el.dataset.dive, text: el.dataset.text || el.textContent.trim() };
        renderView();
      });
    });

    // Deep-dive close
    const closeBtn = container.querySelector('#ap-dive-close');
    if (closeBtn) closeBtn.addEventListener('click', () => { expandedDive = null; renderView(); });

    // Deep-dive actions
    container.querySelectorAll('.ap-dive-action[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'planner') {
          expandedDive = null;
          navigate('/lesson-planner');
        } else if (action === 'copy') {
          navigator.clipboard.writeText(expandedDive?.text || '').then(() => showToast('Copied!', 'success'));
        } else if (action === 'refine') {
          // Store the text and navigate to lesson planner with pre-filled context
          if (expandedDive?.text) {
            sessionStorage.setItem('cocher_plus_refinement', JSON.stringify({
              text: expandedDive.text,
              type: expandedDive.type,
              subject: params.subject,
              level: params.level,
              topic: params.topic
            }));
          }
          expandedDive = null;
          navigate('/lesson-planner');
        }
      });
    });

    // Run/stop buttons
    const runBtn = container.querySelector('#ap-run-btn');
    const stopBtn = container.querySelector('#ap-stop-btn');
    if (runBtn) runBtn.addEventListener('click', () => runPipeline());
    if (stopBtn) stopBtn.addEventListener('click', () => {
      aborted = true; running = false;
      showToast('Workflow stopped.', 'warning');
      renderView();
    });

    // Render LaTeX in all output cards
    processLatex(container);

    // Cascading level selectors
    const schoolType = container.querySelector('#ap-school-type');
    const yearSelect = container.querySelector('#ap-year');
    const demandSelect = container.querySelector('#ap-demand');

    if (schoolType && yearSelect && demandSelect) {
      schoolType.addEventListener('change', () => {
        const type = schoolType.value;
        let years = [];
        if (type === 'primary') years = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
        else if (type === 'secondary') years = ['Sec 1', 'Sec 2', 'Sec 3', 'Sec 4', 'Sec 5'];
        else if (type === 'jc') years = ['JC 1', 'JC 2'];

        yearSelect.innerHTML = '<option value="">Select...</option>' +
          years.map(y => `<option value="${y}">${y}</option>`).join('');
        demandSelect.innerHTML = '<option value="">Select year first...</option>';
      });

      yearSelect.addEventListener('change', () => {
        const type = schoolType.value;
        const year = yearSelect.value;
        let demands = [];

        if (type === 'primary' && ['P5', 'P6'].includes(year)) {
          demands = ['Standard', 'Foundation'];
        } else if (type === 'secondary') {
          demands = ['G1', 'G2', 'G3'];
        } else if (type === 'jc') {
          demands = ['H1', 'H2', 'H3'];
        }

        if (demands.length === 0) {
          demandSelect.innerHTML = '<option value="">N/A</option>';
        } else {
          demandSelect.innerHTML = '<option value="">Select...</option>' +
            demands.map(d => `<option value="${d}">${d}</option>`).join('');
        }
      });
    }
  }

  /* ── Pipeline runner ── */
  async function runPipeline() {
    const subject = container.querySelector('#ap-subject').value;
    const level = [
      container.querySelector('#ap-year')?.value,
      container.querySelector('#ap-demand')?.value
    ].filter(Boolean).join(' ');
    const topic = container.querySelector('#ap-topic').value.trim();
    const duration = container.querySelector('#ap-duration').value;
    const notes = container.querySelector('#ap-notes').value.trim();

    if (!subject || !level || !topic) {
      showToast('Please fill in Subject, Level, and Topic.', 'warning');
      return;
    }

    params = { subject, level, topic, duration, notes };
    running = true; aborted = false; currentStep = 0;
    for (const key of Object.keys(outputs)) delete outputs[key];

    renderView();
    const setButtons = () => {
      const rb = container.querySelector('#ap-run-btn');
      const sb = container.querySelector('#ap-stop-btn');
      if (rb) rb.disabled = true;
      if (sb) sb.style.display = '';
    };
    setButtons();

    for (let i = 0; i < STEPS.length; i++) {
      if (aborted) break;
      currentStep = i;
      renderView(); setButtons();

      const step = STEPS[i];
      const { system, user } = step.buildPrompt(params, outputs);

      try {
        const text = await sendChat(
          [{ role: 'user', content: user }],
          { trackLabel: 'autopilotPipeline', systemPrompt: system, temperature: 0.6, maxTokens: 3072 }
        );
        if (aborted) break;
        outputs[step.id] = text;
        currentStep = i + 1;
        renderView();
      } catch (err) {
        if (aborted) break;
        console.error(`Co-Cher+ step "${step.id}" failed:`, err);
        showToast(`Step "${step.label}" failed: ${err.message}`, 'danger');
        running = false; renderView(); return;
      }
    }

    running = false;
    if (!aborted) showToast('Workflow complete!', 'success');
    renderView();
  }

  renderView();
}
