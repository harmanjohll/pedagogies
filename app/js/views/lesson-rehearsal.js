/*
 * Co-Cher Lesson Rehearsal
 * ========================
 * Subject-agnostic teacher rehearsal tool. Teachers select a designed lesson
 * and practice delivering it to AI-powered student personas via a chat interface.
 * Uses Anthropic API (Claude) for realistic student roleplay.
 */

import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { trackEvent } from '../utils/analytics.js';

/* ── Constants ── */

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

const PERSONA_PRESETS = [
  { id: 'high_achiever',     label: 'High achiever',      desc: 'Asks probing questions, extends concepts',                        color: '#6366f1' },
  { id: 'quiet_learner',     label: 'Quiet learner',       desc: 'Rarely speaks unless prompted, gives short answers',              color: '#8b5cf6' },
  { id: 'curious_questioner', label: 'Curious questioner', desc: 'Asks tangential but interesting questions',                       color: '#0ea5e9' },
  { id: 'struggling_student', label: 'Struggling student', desc: 'Has misconceptions, needs scaffolding',                           color: '#f59e0b' },
  { id: 'disengaged',        label: 'Disengaged',          desc: 'Off-task, needs motivation',                                      color: '#ef4444' },
  { id: 'esl_learner',       label: 'ESL learner',         desc: 'Understands concepts but struggles with academic English',        color: '#10b981' },
];

const STUDENT_NAMES = [
  'Priya', 'Haziq', 'Wei Lin', 'Aisha', 'Jun Hao', 'Siti',
  'Ravi', 'Mei Xuan', 'Darren', 'Nurul', 'Ethan', 'Zhi Ying'
];

const PERSONA_BADGE_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#a855f7', '#84cc16'
];

/* ── Feedback Focus Frames ── */

const FEEDBACK_FRAMES = [
  {
    id: 'stp',
    label: 'STP-Aligned',
    color: '#3b82f6',
    desc: 'Feedback organised under the 4 areas of the Singapore Teaching Practice',
    promptBlock: `Organise your feedback under the four areas of the Singapore Teaching Practice (STP):

### Area 1 — Lesson Preparation
Did the teacher demonstrate understanding of learners, set clear objectives, and plan resources effectively?

### Area 2 — Lesson Enactment
Evaluate teaching actions, interaction patterns, and classroom discourse quality.

### Area 3 — Monitoring & Feedback
How well did the teacher use formative assessment, provide effective feedback, and offer differentiated support?

### Area 4 — Positive Learning Culture
Was the environment safe and supportive? Were routines clear? Was student agency encouraged?`
  },
  {
    id: 'grow_coaching',
    label: 'GROW Coaching',
    color: '#10b981',
    desc: 'Whitmore\'s Goal → Reality → Options → Will structure for teacher development',
    promptBlock: `Structure your feedback using the GROW coaching model (Whitmore). NOTE: This is the coaching GROW (Goal, Reality, Options, Will) — NOT Beatty's GROW for student metacognition.

### Goal
What was the teacher trying to achieve in this lesson? How clearly was the learning intent communicated?

### Reality
What actually happened during the rehearsal? Describe specific moments — what went well and what fell short of the goal.

### Options
What alternative approaches, strategies, or techniques could the teacher consider? Offer 3-4 concrete options.

### Will
What specific, actionable next steps should the teacher commit to before the real lesson? Frame these as commitments, not suggestions.`
  },
  {
    id: 'grow_reflection',
    label: 'Beatty\'s GROW Reflection',
    color: '#8b5cf6',
    desc: 'Self-reflection using Gift, Rise, Own, Watch — metacognition applied to your own practice',
    promptBlock: `Add a personal reflection section using Beatty's GROW by Reflecting framework. NOTE: This is Beatty's GROW for metacognition (Gift, Rise, Own, Watch) — NOT Whitmore's coaching GROW.

### Teacher Self-Reflection (GROW by Reflecting)
Frame these as prompts the teacher can use to reflect on their own practice:

**G — Gift yourself success**: What did you do well in this rehearsal? Identify 1-2 specific strengths to celebrate.

**R — Rise above one challenge**: What was the hardest moment? How might you handle it differently next time?

**O — Own your knowledge**: What have you learned about your own teaching from this rehearsal?

**W — Watch what comes next**: What is one thing you will focus on improving before the real lesson?`
  },
  {
    id: 'hattie',
    label: 'Hattie\'s Visible Learning',
    color: '#f59e0b',
    desc: 'Feedback referencing effect sizes and high-impact teaching strategies',
    promptBlock: `Frame your feedback through the lens of Hattie's Visible Learning research. Reference effect sizes where relevant:

### High-Impact Strategies Observed
Which high-effect-size strategies did the teacher employ? (e.g. Teacher Clarity d=0.75, Feedback d=0.70, Metacognitive Strategies d=0.60, Questioning d=0.48)

### Impact Potential
Based on the rehearsal, which strategies have the greatest potential to lift student achievement? Rate the teacher's use of:
- **Teacher clarity** — Were objectives and success criteria visible?
- **Feedback quality** — Was feedback timely, specific, and actionable?
- **Scaffolding** — Was there appropriate challenge with support?

### Suggestions (Evidence-Based)
Recommend 3-4 adjustments grounded in Visible Learning research, citing the relevant strategy and its effect size.`
  },
];

/* ── State ── */

let selectedLessonId = null;
let studentCount = 5;
let selectedPersonas = ['high_achiever', 'quiet_learner', 'curious_questioner', 'struggling_student'];
let rehearsalActive = false;
let rehearsalEnded = false;
let chatMessages = [];    // { role: 'teacher' | 'student', name?: string, text: string, color?: string }
let apiMessages = [];     // messages array sent to Anthropic API
let isGenerating = false;
let debriefContent = null;
let assignedStudents = []; // { name, persona, color }
let selectedFeedbackFrames = ['stp']; // default to STP
let customFeedbackFocus = ''; // free-text "Other" focus

/* ── API ── */

function getApiKey() {
  return localStorage.getItem('cocher_api_key') || Store.get('apiKey') || '';
}

async function callAnthropic(systemPrompt, messages, maxTokens = 4096) {
  trackEvent('ai', 'rehearsal', 'message');
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key configured.');

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages
    })
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

/* ── Build System Prompt ── */

function buildSystemPrompt(lesson) {
  const cls = lesson.classId ? Store.getClass(lesson.classId) : null;
  const className = cls ? cls.name : 'the class';

  // Gather lesson content
  const planText = lesson.plan || '';
  const objectivesText = lesson.objectives || '';
  const e21ccFocus = (lesson.e21ccFocus || []).join(', ') || 'General';

  // Build student roster
  const roster = assignedStudents.map(s => {
    const preset = PERSONA_PRESETS.find(p => p.id === s.persona);
    return `- ${s.name}: ${preset ? preset.label + ' — ' + preset.desc : 'General student'}`;
  }).join('\n');

  return `You are simulating a classroom of students for a teacher rehearsal. The teacher is practising delivering a lesson before teaching it to a real class.

## Lesson Context
Title: ${lesson.title || 'Untitled Lesson'}
Class: ${className}
Objectives: ${objectivesText || 'Not specified'}
E21CC Focus: ${e21ccFocus}

## Lesson Plan
${planText || '(No detailed plan provided — respond based on the lesson title and objectives.)'}

## Your Students
You are roleplaying ALL of the following students simultaneously:
${roster}

## Instructions
1. Respond as the students would in a real classroom. Use each student's name in square brackets before their dialogue, like: [Priya] or [Haziq].
2. Be realistic:
   - NOT all students respond to every teacher prompt. Typically 1-3 students respond.
   - Quiet learners only speak when directly called upon or truly engaged.
   - Disengaged students may be off-task, whispering, or distracted.
   - High achievers volunteer frequently.
   - Struggling students may give wrong answers or show misconceptions.
   - ESL learners understand but may use simpler language or ask for clarification of vocabulary.
   - Curious questioners ask "what if" or "why" questions that go beyond the immediate topic.
3. Keep each student's response brief and natural — like real student speech, not essays.
4. If the teacher asks the class a question, have a realistic number of students respond (not everyone at once).
5. If the teacher calls on a specific student by name, that student should respond.
6. React to the lesson content naturally. If the teacher explains something confusing, the struggling student might look confused. If the teacher shares something interesting, the curious questioner might ask a follow-up.
7. Occasionally show classroom dynamics: side conversations, one student helping another, a student asking to go to the bathroom, etc.
8. Format each student's speech on its own line, preceded by their name in brackets.`;
}

function buildDebriefPrompt() {
  const transcript = chatMessages.map(m => {
    if (m.role === 'teacher') return `TEACHER: ${m.text}`;
    return `${m.name ? `[${m.name}]` : 'STUDENT'}: ${m.text}`;
  }).join('\n');

  // Build framework-specific sections based on teacher's selections
  const frameSections = selectedFeedbackFrames
    .map(id => FEEDBACK_FRAMES.find(f => f.id === id))
    .filter(Boolean)
    .map(f => f.promptBlock)
    .join('\n\n');

  // Custom focus from "Other"
  const customSection = customFeedbackFocus
    ? `\n\n### Custom Focus\nThe teacher has specifically asked for feedback on: ${customFeedbackFocus}\nProvide targeted observations and suggestions for this area.`
    : '';

  // Fallback if nothing selected
  const fallbackSection = (!frameSections && !customFeedbackFocus) ? `
### Questioning Breadth
Did the teacher engage different students? Were questions distributed, or did the teacher only interact with volunteers?

### Pacing Assessment
Was the delivery too fast, too slow, or well-paced? Were there awkward silences or rushed transitions?

### Differentiation Quality
Did the teacher adapt their language or approach for different learners?

### Misconception Handling
If students showed misconceptions, how did the teacher address them?` : '';

  return `You are an experienced instructional coach reviewing a teacher's rehearsal of a lesson delivery. Analyse the following transcript of a simulated classroom rehearsal and provide structured, constructive feedback.

## Rehearsal Transcript
${transcript}

## Feedback Framework
${frameSections}${fallbackSection}${customSection}

## Always Include

### Strengths
What did the teacher do well? Highlight 2-3 specific moments from the transcript.

### Suggestions for Improvement
Provide 3-4 actionable suggestions the teacher can implement before teaching the real lesson.

Format your response using markdown headers (###) for each section. Be encouraging but honest. Where multiple frameworks are selected, organise clearly under each framework heading before the Strengths and Suggestions sections.`;
}

/* ── Parse Student Responses ── */

function parseStudentMessages(responseText) {
  const lines = responseText.split('\n').filter(l => l.trim());
  const messages = [];
  let currentName = null;
  let currentText = '';

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)/);
    if (match) {
      // Save previous message if exists
      if (currentName && currentText.trim()) {
        messages.push({ name: currentName, text: currentText.trim() });
      }
      currentName = match[1];
      currentText = match[2];
    } else if (currentName) {
      currentText += ' ' + line.trim();
    }
  }
  // Push last message
  if (currentName && currentText.trim()) {
    messages.push({ name: currentName, text: currentText.trim() });
  }

  // If parsing failed, return the whole text as one message
  if (messages.length === 0 && responseText.trim()) {
    messages.push({ name: assignedStudents[0]?.name || 'Student', text: responseText.trim() });
  }

  // Attach colors from assigned students
  return messages.map(m => {
    const student = assignedStudents.find(s => s.name === m.name);
    return {
      role: 'student',
      name: m.name,
      text: m.text,
      color: student?.color || '#6b7280'
    };
  });
}

/* ── Render ── */

export function render(container) {
  // Reset state when view loads
  selectedLessonId = null;
  studentCount = 5;
  selectedPersonas = ['high_achiever', 'quiet_learner', 'curious_questioner', 'struggling_student'];
  rehearsalActive = false;
  rehearsalEnded = false;
  chatMessages = [];
  apiMessages = [];
  isGenerating = false;
  debriefContent = null;
  assignedStudents = [];
  selectedFeedbackFrames = ['stp'];
  customFeedbackFocus = '';

  renderView(container);

  // Return cleanup function
  return () => {
    selectedLessonId = null;
    rehearsalActive = false;
    rehearsalEnded = false;
    chatMessages = [];
    apiMessages = [];
    isGenerating = false;
    debriefContent = null;
    assignedStudents = [];
    selectedFeedbackFrames = ['stp'];
    customFeedbackFocus = '';
  };
}

function renderView(container) {
  const apiKey = getApiKey();
  const lessons = Store.getLessons();
  const classes = Store.getClasses();

  // No API key
  if (!apiKey) {
    container.innerHTML = `
      <div class="main-scroll">
        <div class="page-container" style="max-width: 700px;">
          <div class="page-header">
            <div>
              <h1 class="page-title">Lesson Rehearsal</h1>
              <p class="page-subtitle">Practice delivering your lesson with AI student personas</p>
            </div>
          </div>
          <div class="card" style="text-align: center; padding: 3rem 2rem;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="1.5" stroke-linecap="round" style="margin-bottom: 1rem;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--ink); margin-bottom: 0.5rem;">API Key Required</h3>
            <p style="font-size: 0.875rem; color: var(--ink-muted); line-height: 1.6; margin-bottom: 1.5rem;">
              Lesson Rehearsal uses the Anthropic Claude API to power realistic student personas.<br>
              Please configure your API key in Settings to get started.
            </p>
            <a href="#/settings" class="btn btn-primary" style="text-decoration: none;">Go to Settings</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Filter lessons that are ready or complete
  const eligibleLessons = lessons.filter(l => l.status === 'ready' || l.status === 'complete' || l.status === 'completed');

  // No lessons available
  if (lessons.length === 0 || eligibleLessons.length === 0) {
    container.innerHTML = `
      <div class="main-scroll">
        <div class="page-container" style="max-width: 700px;">
          <div class="page-header">
            <div>
              <h1 class="page-title">Lesson Rehearsal</h1>
              <p class="page-subtitle">Practice delivering your lesson with AI student personas</p>
            </div>
          </div>
          <div class="card" style="text-align: center; padding: 3rem 2rem;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="1.5" stroke-linecap="round" style="margin-bottom: 1rem;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="12" x2="12" y2="18"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--ink); margin-bottom: 0.5rem;">No Lessons Ready for Rehearsal</h3>
            <p style="font-size: 0.875rem; color: var(--ink-muted); line-height: 1.6; margin-bottom: 1.5rem;">
              ${lessons.length === 0
                ? 'You haven\'t created any lessons yet. Head to the Lesson Planner to design your first lesson, then come back to rehearse it.'
                : 'None of your lessons have a "ready" or "complete" status. Mark a lesson as ready in the Lesson Planner to rehearse it here.'}
            </p>
            <a href="#/lesson-planner" class="btn btn-primary" style="text-decoration: none;">Open Lesson Planner</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Main rehearsal view
  if (rehearsalActive || rehearsalEnded) {
    renderRehearsalInterface(container);
  } else {
    renderSetupInterface(container, eligibleLessons, classes);
  }
}

/* ── Setup Interface (Steps 1 & 2) ── */

function renderSetupInterface(container, eligibleLessons, classes) {
  const selectedLesson = selectedLessonId ? Store.getLesson(selectedLessonId) : null;
  const selectedClass = selectedLesson?.classId ? Store.getClass(selectedLesson.classId) : null;

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width: 700px;">
        <div class="page-header">
          <div>
            <h1 class="page-title">Lesson Rehearsal</h1>
            <p class="page-subtitle">Practice delivering your lesson with AI student personas</p>
          </div>
        </div>

        <!-- Step 1: Select a Lesson -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <div style="display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4);">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.875rem; flex-shrink: 0;">1</div>
            <div>
              <h3 style="font-size: 1rem; font-weight: 600; color: var(--ink); margin: 0;">Select a Lesson</h3>
              <p style="font-size: 0.8125rem; color: var(--ink-muted); margin: 0;">Choose a lesson you'd like to rehearse</p>
            </div>
          </div>

          <select class="input" id="rh-lesson-select" style="margin-bottom: var(--sp-4);">
            <option value="">-- Select a lesson --</option>
            ${eligibleLessons.map(l => {
              const cls = l.classId ? classes.find(c => c.id === l.classId) : null;
              const clsLabel = cls ? ` (${cls.name})` : '';
              return `<option value="${l.id}" ${l.id === selectedLessonId ? 'selected' : ''}>${escHtml(l.title || 'Untitled Lesson')}${escHtml(clsLabel)}</option>`;
            }).join('')}
          </select>

          ${selectedLesson ? `
            <div style="background: var(--bg-card-alt, var(--surface-dim, #f8f9fa)); border-radius: 10px; padding: var(--sp-4); border: 1px solid var(--border);">
              <h4 style="font-size: 0.9375rem; font-weight: 600; color: var(--ink); margin: 0 0 var(--sp-2) 0;">${escHtml(selectedLesson.title || 'Untitled Lesson')}</h4>
              ${selectedClass ? `<p style="font-size: 0.8125rem; color: var(--ink-muted); margin: 0 0 var(--sp-2) 0;">Class: ${escHtml(selectedClass.name)}</p>` : ''}
              ${selectedLesson.objectives ? `<p style="font-size: 0.8125rem; color: var(--ink-muted); margin: 0 0 var(--sp-2) 0;"><strong>Objectives:</strong> ${escHtml(selectedLesson.objectives)}</p>` : ''}
              ${selectedLesson.e21ccFocus && selectedLesson.e21ccFocus.length > 0 ? `
                <div style="display: flex; gap: var(--sp-1); flex-wrap: wrap; margin-top: var(--sp-2);">
                  ${selectedLesson.e21ccFocus.map(f => `<span class="badge badge-blue">${escHtml(f)}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Step 2: Configure Classroom (only if lesson selected) -->
        ${selectedLesson ? `
          <div class="card" style="margin-bottom: var(--sp-6);">
            <div style="display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4);">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.875rem; flex-shrink: 0;">2</div>
              <div>
                <h3 style="font-size: 1rem; font-weight: 600; color: var(--ink); margin: 0;">Configure Classroom</h3>
                <p style="font-size: 0.8125rem; color: var(--ink-muted); margin: 0;">Set up the student personas for your rehearsal</p>
              </div>
            </div>

            <!-- Student count slider -->
            <div style="margin-bottom: var(--sp-5);">
              <label style="font-size: 0.875rem; font-weight: 600; color: var(--ink); display: block; margin-bottom: var(--sp-2);">
                Number of students: <span id="rh-count-display" style="color: var(--accent);">${studentCount}</span>
              </label>
              <input type="range" id="rh-student-count" min="3" max="6" value="${studentCount}"
                style="width: 100%; accent-color: var(--accent); cursor: pointer;" />
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--ink-muted); margin-top: 2px;">
                <span>3</span><span>4</span><span>5</span><span>6</span>
              </div>
            </div>

            <!-- Persona checkboxes -->
            <div style="margin-bottom: var(--sp-5);">
              <label style="font-size: 0.875rem; font-weight: 600; color: var(--ink); display: block; margin-bottom: var(--sp-3);">
                Student persona types
              </label>
              <div style="display: grid; gap: var(--sp-3);">
                ${PERSONA_PRESETS.map(p => `
                  <label style="display: flex; align-items: flex-start; gap: var(--sp-3); cursor: pointer; padding: var(--sp-3); border-radius: 8px; border: 1px solid var(--border); transition: background 0.15s; background: ${selectedPersonas.includes(p.id) ? 'var(--accent-light)' : 'transparent'};">
                    <input type="checkbox" class="rh-persona-cb" value="${p.id}" ${selectedPersonas.includes(p.id) ? 'checked' : ''}
                      style="accent-color: var(--accent); margin-top: 2px; flex-shrink: 0;" />
                    <div>
                      <div style="font-size: 0.875rem; font-weight: 600; color: var(--ink);">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${p.color}; margin-right: 6px;"></span>
                        ${escHtml(p.label)}
                      </div>
                      <div style="font-size: 0.8125rem; color: var(--ink-muted); margin-top: 2px;">${escHtml(p.desc)}</div>
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Start button -->
            <button class="btn btn-primary" id="rh-start-btn" style="width: 100%; padding: 0.75rem; font-size: 1rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right: 8px; vertical-align: -3px;">
                <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
              </svg>
              Start Rehearsal
            </button>
          </div>

          <!-- Step 3: Feedback Focus -->
          <div class="card" style="margin-bottom: var(--sp-6);">
            <div style="display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4);">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.875rem; flex-shrink: 0;">3</div>
              <div>
                <h3 style="font-size: 1rem; font-weight: 600; color: var(--ink); margin: 0;">Feedback Focus</h3>
                <p style="font-size: 0.8125rem; color: var(--ink-muted); margin: 0;">Choose how you'd like your debrief feedback framed</p>
              </div>
            </div>

            <div style="display: grid; gap: var(--sp-3); margin-bottom: var(--sp-4);">
              ${FEEDBACK_FRAMES.map(f => `
                <label style="display: flex; align-items: flex-start; gap: var(--sp-3); cursor: pointer; padding: var(--sp-3); border-radius: 8px; border: 1px solid var(--border); transition: background 0.15s; background: ${selectedFeedbackFrames.includes(f.id) ? 'var(--accent-light)' : 'transparent'};">
                  <input type="checkbox" class="rh-feedback-frame-cb" value="${f.id}" ${selectedFeedbackFrames.includes(f.id) ? 'checked' : ''}
                    style="accent-color: var(--accent); margin-top: 2px; flex-shrink: 0;" />
                  <div>
                    <div style="font-size: 0.875rem; font-weight: 600; color: var(--ink);">
                      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${f.color}; margin-right: 6px;"></span>
                      ${escHtml(f.label)}
                    </div>
                    <div style="font-size: 0.8125rem; color: var(--ink-muted); margin-top: 2px;">${escHtml(f.desc)}</div>
                  </div>
                </label>
              `).join('')}

              <!-- Other / custom focus -->
              <label style="display: flex; align-items: flex-start; gap: var(--sp-3); cursor: pointer; padding: var(--sp-3); border-radius: 8px; border: 1px solid var(--border); transition: background 0.15s; background: ${customFeedbackFocus ? 'var(--accent-light)' : 'transparent'};">
                <input type="checkbox" id="rh-feedback-other-cb" ${customFeedbackFocus ? 'checked' : ''}
                  style="accent-color: var(--accent); margin-top: 2px; flex-shrink: 0;" />
                <div style="flex: 1;">
                  <div style="font-size: 0.875rem; font-weight: 600; color: var(--ink);">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #6b7280; margin-right: 6px;"></span>
                    Other
                  </div>
                  <div style="font-size: 0.8125rem; color: var(--ink-muted); margin-top: 2px;">Specify your own feedback focus</div>
                  <textarea id="rh-feedback-other-text" class="input" rows="2"
                    placeholder="e.g. Focus on my use of ICT, or how I managed transitions between activities..."
                    style="margin-top: var(--sp-2); font-size: 0.8125rem; resize: vertical; width: 100%; display: ${customFeedbackFocus ? 'block' : 'none'};">${escHtml(customFeedbackFocus)}</textarea>
                </div>
              </label>
            </div>

            <p style="font-size: 0.75rem; color: var(--ink-faint); line-height: 1.5; margin: 0;">
              Select one or more frames. Your debrief will be structured around the selected focus areas.
            </p>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Event: lesson selection
  const lessonSelect = container.querySelector('#rh-lesson-select');
  if (lessonSelect) {
    lessonSelect.addEventListener('change', () => {
      selectedLessonId = lessonSelect.value || null;
      renderView(container);
    });
  }

  // Event: student count slider
  const countSlider = container.querySelector('#rh-student-count');
  if (countSlider) {
    countSlider.addEventListener('input', () => {
      studentCount = parseInt(countSlider.value, 10);
      const display = container.querySelector('#rh-count-display');
      if (display) display.textContent = studentCount;
    });
  }

  // Event: persona checkboxes — update state + styling in-place (no full re-render)
  container.querySelectorAll('.rh-persona-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!selectedPersonas.includes(cb.value)) selectedPersonas.push(cb.value);
      } else {
        selectedPersonas = selectedPersonas.filter(p => p !== cb.value);
      }
      // Toggle highlight on the parent label without re-rendering
      const label = cb.closest('label');
      if (label) {
        label.style.background = cb.checked ? 'var(--accent-light)' : 'transparent';
      }
    });
  });

  // Event: feedback frame checkboxes
  container.querySelectorAll('.rh-feedback-frame-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!selectedFeedbackFrames.includes(cb.value)) selectedFeedbackFrames.push(cb.value);
      } else {
        selectedFeedbackFrames = selectedFeedbackFrames.filter(f => f !== cb.value);
      }
      const label = cb.closest('label');
      if (label) label.style.background = cb.checked ? 'var(--accent-light)' : 'transparent';
    });
  });

  // Event: "Other" feedback focus
  const otherCb = container.querySelector('#rh-feedback-other-cb');
  const otherText = container.querySelector('#rh-feedback-other-text');
  if (otherCb && otherText) {
    otherCb.addEventListener('change', () => {
      otherText.style.display = otherCb.checked ? 'block' : 'none';
      if (!otherCb.checked) customFeedbackFocus = '';
      const label = otherCb.closest('label');
      if (label) label.style.background = otherCb.checked ? 'var(--accent-light)' : 'transparent';
    });
    otherText.addEventListener('input', () => {
      customFeedbackFocus = otherText.value;
    });
  }

  // Event: start rehearsal
  const startBtn = container.querySelector('#rh-start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (!selectedLessonId) {
        showToast('Please select a lesson first.', 'warning');
        return;
      }
      if (selectedPersonas.length === 0) {
        showToast('Please select at least one student persona type.', 'warning');
        return;
      }
      const _lesson = selectedLessonId ? Store.getLesson(selectedLessonId) : null;
      trackEvent('feature', 'rehearsal_start', `${selectedPersonas.length} personas`, _lesson?.title || '');
      startRehearsal(container);
    });
  }
}

/* ── Start Rehearsal ── */

function startRehearsal(container) {
  // Assign student names and personas
  assignedStudents = [];
  const shuffledNames = [...STUDENT_NAMES].sort(() => Math.random() - 0.5);
  const personaPool = [...selectedPersonas];

  for (let i = 0; i < studentCount; i++) {
    const name = shuffledNames[i] || `Student ${i + 1}`;
    // Distribute personas round-robin
    const persona = personaPool[i % personaPool.length];
    const color = PERSONA_BADGE_COLORS[i % PERSONA_BADGE_COLORS.length];
    assignedStudents.push({ name, persona, color });
  }

  // Reset chat
  chatMessages = [];
  apiMessages = [];
  rehearsalActive = true;
  rehearsalEnded = false;
  debriefContent = null;

  renderView(container);
}

/* ── Rehearsal Chat Interface (Step 3) ── */

function renderRehearsalInterface(container) {
  const lesson = Store.getLesson(selectedLessonId);
  const cls = lesson?.classId ? Store.getClass(lesson.classId) : null;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
      <!-- Header bar -->
      <div style="padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border); background: var(--bg-card, var(--surface, #fff)); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: var(--sp-3); min-width: 0;">
          <button class="btn btn-ghost" id="rh-back-btn" style="padding: 6px; flex-shrink: 0;" title="Back to setup">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div style="min-width: 0;">
            <h2 style="font-size: 0.9375rem; font-weight: 600; color: var(--ink); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escHtml(lesson?.title || 'Lesson Rehearsal')}</h2>
            <p style="font-size: 0.75rem; color: var(--ink-muted); margin: 0;">${cls ? escHtml(cls.name) + ' — ' : ''}${assignedStudents.length} students</p>
          </div>
        </div>
        <div style="display: flex; gap: var(--sp-2); flex-shrink: 0;">
          ${!rehearsalEnded ? `
            <button class="btn" id="rh-roster-btn" style="font-size: 0.8125rem; padding: 6px 12px; border: 1px solid var(--border); background: var(--bg-card, var(--surface, #fff));" title="View student roster">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right: 4px; vertical-align: -2px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Roster
            </button>
            <button class="btn" id="rh-end-btn" style="font-size: 0.8125rem; padding: 6px 12px; background: #ef4444; color: #fff; border: none; border-radius: 8px;">
              End Rehearsal
            </button>
          ` : `
            <button class="btn btn-primary" id="rh-new-btn" style="font-size: 0.8125rem; padding: 6px 12px;">
              New Rehearsal
            </button>
          `}
        </div>
      </div>

      <!-- Student roster panel (hidden by default) -->
      <div id="rh-roster-panel" style="display: none; padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--border); background: var(--surface-dim, #f8f9fa);">
        <div style="display: flex; flex-wrap: wrap; gap: var(--sp-2);">
          ${assignedStudents.map(s => {
            const preset = PERSONA_PRESETS.find(p => p.id === s.persona);
            return `
              <div style="display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: var(--bg-card, var(--surface, #fff)); border: 1px solid var(--border); font-size: 0.8125rem;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${s.color}; flex-shrink: 0;"></span>
                <span style="font-weight: 600; color: var(--ink);">${escHtml(s.name)}</span>
                <span style="color: var(--ink-muted); font-size: 0.75rem;">${preset ? escHtml(preset.label) : ''}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Chat messages area -->
      <div id="rh-chat-area" style="flex: 1; overflow-y: auto; padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3);">
        ${chatMessages.length === 0 && !rehearsalEnded ? `
          <div style="text-align: center; color: var(--ink-muted); padding: 2rem 1rem; font-size: 0.875rem; line-height: 1.7;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint, #ccc)" stroke-width="1.5" stroke-linecap="round" style="margin-bottom: 0.75rem;">
              <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
            <p style="margin: 0 0 0.5rem 0; font-weight: 600; color: var(--ink);">Your classroom is ready</p>
            <p style="margin: 0;">${assignedStudents.length} students are waiting. Start by greeting the class or introducing the lesson topic.</p>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.8125rem;">Try: <em>"Good morning class, today we'll be learning about..."</em></p>
          </div>
        ` : ''}

        ${chatMessages.map(m => renderChatBubble(m)).join('')}

        ${isGenerating ? `
          <div style="display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); color: var(--ink-muted); font-size: 0.8125rem;">
            <span class="rh-typing-dots" style="display: flex; gap: 3px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--ink-muted); animation: rh-dot-bounce 1.2s infinite ease-in-out; animation-delay: 0s;"></span>
              <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--ink-muted); animation: rh-dot-bounce 1.2s infinite ease-in-out; animation-delay: 0.2s;"></span>
              <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--ink-muted); animation: rh-dot-bounce 1.2s infinite ease-in-out; animation-delay: 0.4s;"></span>
            </span>
            Students are responding...
          </div>
        ` : ''}

        ${rehearsalEnded && debriefContent ? renderDebrief(debriefContent) : ''}
        ${rehearsalEnded && !debriefContent && isGenerating ? `
          <div class="card" style="text-align: center; padding: 2rem;">
            <span class="rh-typing-dots" style="display: inline-flex; gap: 4px; margin-bottom: 0.75rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: rh-dot-bounce 1.2s infinite ease-in-out; animation-delay: 0s;"></span>
              <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: rh-dot-bounce 1.2s infinite ease-in-out; animation-delay: 0.2s;"></span>
              <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: rh-dot-bounce 1.2s infinite ease-in-out; animation-delay: 0.4s;"></span>
            </span>
            <p style="color: var(--ink-muted); font-size: 0.875rem; margin: 0;">Generating your rehearsal debrief...</p>
          </div>
        ` : ''}
      </div>

      <!-- Chat input -->
      ${!rehearsalEnded ? `
        <div style="padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--border); background: var(--bg-card, var(--surface, #fff)); flex-shrink: 0;">
          <form id="rh-chat-form" style="display: flex; gap: var(--sp-2); align-items: center;">
            <input type="text" id="rh-chat-input" class="input"
              placeholder="Speak to your class..."
              style="flex: 1; padding: 0.625rem 1rem; font-size: 0.9375rem;"
              ${isGenerating ? 'disabled' : ''} autocomplete="off" />
            <button type="button" id="rh-mic-btn" title="Voice input — click to start"
              style="padding: 0.5rem; flex-shrink: 0; border: 1px solid var(--border); background: var(--bg-card, var(--surface, #fff)); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s;" ${isGenerating ? 'disabled' : ''}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
            <button type="submit" class="btn btn-primary" id="rh-send-btn"
              style="padding: 0.625rem 1.25rem; flex-shrink: 0;" ${isGenerating ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      ` : ''}
    </div>

    <style>
      @keyframes rh-dot-bounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-6px); opacity: 1; }
      }
    </style>
  `;

  // Scroll chat to bottom
  const chatArea = container.querySelector('#rh-chat-area');
  if (chatArea) {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // Event: back button
  const backBtn = container.querySelector('#rh-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (chatMessages.length > 0 && !rehearsalEnded) {
        if (!confirm('Are you sure you want to leave? Your rehearsal progress will be lost.')) return;
      }
      rehearsalActive = false;
      rehearsalEnded = false;
      chatMessages = [];
      apiMessages = [];
      debriefContent = null;
      renderView(container);
    });
  }

  // Event: roster toggle
  const rosterBtn = container.querySelector('#rh-roster-btn');
  const rosterPanel = container.querySelector('#rh-roster-panel');
  if (rosterBtn && rosterPanel) {
    rosterBtn.addEventListener('click', () => {
      rosterPanel.style.display = rosterPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Event: end rehearsal
  const endBtn = container.querySelector('#rh-end-btn');
  if (endBtn) {
    endBtn.addEventListener('click', () => {
      if (chatMessages.length === 0) {
        showToast('Have a conversation first before ending the rehearsal.', 'warning');
        return;
      }
      endRehearsal(container);
    });
  }

  // Event: new rehearsal
  const newBtn = container.querySelector('#rh-new-btn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      rehearsalActive = false;
      rehearsalEnded = false;
      chatMessages = [];
      apiMessages = [];
      debriefContent = null;
      selectedLessonId = null;
      renderView(container);
    });
  }

  // Event: mic button (Web Speech API)
  const micBtn = container.querySelector('#rh-mic-btn');
  if (micBtn && chatInput) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      let recognition = null;
      let isListening = false;

      micBtn.addEventListener('click', () => {
        if (isListening && recognition) {
          recognition.stop();
          return;
        }
        recognition = new SpeechRecognition();
        recognition.lang = 'en-SG';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.maxAlternatives = 1;

        const prevValue = chatInput.value;
        isListening = true;
        micBtn.style.background = '#ef4444';
        micBtn.style.borderColor = '#ef4444';
        micBtn.querySelector('svg').style.stroke = '#fff';
        chatInput.placeholder = 'Listening...';

        recognition.onresult = (event) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          chatInput.value = prevValue + (prevValue ? ' ' : '') + transcript;
        };

        recognition.onend = () => {
          isListening = false;
          micBtn.style.background = '';
          micBtn.style.borderColor = '';
          micBtn.querySelector('svg').style.stroke = '';
          chatInput.placeholder = 'Speak to your class...';
          chatInput.focus();
        };

        recognition.onerror = (event) => {
          isListening = false;
          micBtn.style.background = '';
          micBtn.style.borderColor = '';
          micBtn.querySelector('svg').style.stroke = '';
          chatInput.placeholder = 'Speak to your class...';
          if (event.error !== 'aborted') {
            showToast(`Mic error: ${event.error}. Check browser permissions.`, 'warning');
          }
        };

        recognition.start();
      });
    } else {
      micBtn.disabled = true;
      micBtn.title = 'Speech recognition not supported in this browser';
      micBtn.style.opacity = '0.4';
    }
  }

  // Event: chat form submit
  const chatForm = container.querySelector('#rh-chat-form');
  if (chatForm && chatInput) {
    chatInput.focus();
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text || isGenerating) return;

      // Add teacher message
      chatMessages.push({ role: 'teacher', text });
      apiMessages.push({ role: 'user', content: text });
      chatInput.value = '';

      renderView(container);

      // Get AI response
      await getStudentResponse(container);
    });
  }
}

/* ── Chat Bubble Rendering ── */

function renderChatBubble(msg) {
  if (msg.role === 'teacher') {
    return `
      <div style="display: flex; justify-content: flex-end;">
        <div style="max-width: 80%; background: var(--accent, #3b82f6); color: #fff; border-radius: 16px 16px 4px 16px; padding: 0.625rem 1rem; font-size: 0.875rem; line-height: 1.5;">
          ${escHtml(msg.text)}
        </div>
      </div>
    `;
  } else {
    const badgeColor = msg.color || '#6b7280';
    return `
      <div style="display: flex; justify-content: flex-start;">
        <div style="max-width: 80%;">
          <div style="display: inline-block; padding: 2px 10px; border-radius: 10px; background: ${badgeColor}; color: #fff; font-size: 0.75rem; font-weight: 600; margin-bottom: 4px;">
            ${escHtml(msg.name || 'Student')}
          </div>
          <div style="background: var(--surface-dim, #f1f3f5); color: var(--ink); border-radius: 4px 16px 16px 16px; padding: 0.625rem 1rem; font-size: 0.875rem; line-height: 1.5;">
            ${escHtml(msg.text)}
          </div>
        </div>
      </div>
    `;
  }
}

/* ── AI Response ── */

async function getStudentResponse(container) {
  isGenerating = true;
  renderView(container);

  const lesson = Store.getLesson(selectedLessonId);
  if (!lesson) {
    isGenerating = false;
    showToast('Lesson not found.', 'error');
    renderView(container);
    return;
  }

  try {
    const systemPrompt = buildSystemPrompt(lesson);
    const response = await callAnthropic(systemPrompt, apiMessages);

    // Parse the response into individual student messages
    const studentMsgs = parseStudentMessages(response);

    // Add to chat messages
    for (const sm of studentMsgs) {
      chatMessages.push(sm);
    }

    // Add assistant response to API messages (as single block)
    apiMessages.push({ role: 'assistant', content: response });

    isGenerating = false;
    renderView(container);
  } catch (err) {
    isGenerating = false;
    console.error('Rehearsal API error:', err);
    showToast(`Error: ${err.message}`, 'error');
    renderView(container);
  }
}

/* ── End Rehearsal & Debrief (Step 4) ── */

async function endRehearsal(container) {
  rehearsalActive = false;
  rehearsalEnded = true;
  isGenerating = true;
  renderView(container);

  try {
    const debriefSystemPrompt = buildDebriefPrompt();
    const response = await callAnthropic(
      debriefSystemPrompt,
      [{ role: 'user', content: 'Please provide your detailed feedback on this rehearsal.' }],
      4096
    );

    debriefContent = response;
    isGenerating = false;
    renderView(container);
  } catch (err) {
    isGenerating = false;
    console.error('Debrief API error:', err);
    debriefContent = `**Error generating debrief:** ${err.message}\n\nPlease check your API key and try again.`;
    renderView(container);
  }
}

/* ── Debrief Card Rendering ── */

function renderDebrief(content) {
  // Parse markdown-like content into HTML
  const htmlContent = simpleMarkdownToHtml(content);

  // Build frame badges
  const usedFrames = selectedFeedbackFrames
    .map(id => FEEDBACK_FRAMES.find(f => f.id === id))
    .filter(Boolean);
  const frameBadges = usedFrames.map(f =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:600;background:rgba(${f.id === 'stp' ? '59,130,246' : f.id === 'grow_coaching' ? '16,185,129' : f.id === 'grow_reflection' ? '139,92,246' : '245,158,11'},0.12);color:${f.color};">` +
    `<span style="width:6px;height:6px;border-radius:50%;background:${f.color};"></span>${escHtml(f.label)}</span>`
  ).join('');
  const customBadge = customFeedbackFocus
    ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:0.75rem;font-weight:600;background:rgba(107,114,128,0.12);color:#6b7280;"><span style="width:6px;height:6px;border-radius:50%;background:#6b7280;"></span>Custom</span>`
    : '';

  return `
    <div style="margin-top: var(--sp-4);">
      <div style="display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-4);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <h3 style="font-size: 1.125rem; font-weight: 700; color: var(--ink); margin: 0;">Rehearsal Debrief</h3>
      </div>

      ${(frameBadges || customBadge) ? `
        <div style="display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-3);">
          ${frameBadges}${customBadge}
        </div>
      ` : ''}

      <div class="card" style="padding: var(--sp-5);">
        <div style="font-size: 0.875rem; line-height: 1.7; color: var(--ink);" class="rh-debrief-content">
          ${htmlContent}
        </div>
      </div>

      <div style="display: flex; gap: var(--sp-3); margin-top: var(--sp-4); flex-wrap: wrap;">
        <button class="btn btn-primary" id="rh-new-rehearsal-btn" style="flex: 1; min-width: 180px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right: 6px; vertical-align: -2px;">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          Rehearse Again
        </button>
        <button class="btn" id="rh-copy-debrief-btn" style="flex: 1; min-width: 180px; border: 1px solid var(--border); background: var(--bg-card, var(--surface, #fff));">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right: 6px; vertical-align: -2px;">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy Feedback
        </button>
      </div>
    </div>
  `;
}

/* ── Utility: Simple Markdown to HTML ── */

function simpleMarkdownToHtml(text) {
  if (!text) return '';
  let html = escHtml(text);

  // Headers: ### Header
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-size: 0.9375rem; font-weight: 700; color: var(--ink); margin: 1.25rem 0 0.5rem 0; padding-bottom: 0.25rem; border-bottom: 1px solid var(--border);">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size: 1rem; font-weight: 700; color: var(--ink); margin: 1.5rem 0 0.5rem 0;">$1</h3>');

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Bullet lists: - item
  html = html.replace(/^- (.+)$/gm, '<li style="margin-bottom: 0.25rem;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin: 0.5rem 0; padding-left: 1.25rem;">$&</ul>');

  // Numbered lists: 1. item
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-bottom: 0.25rem;">$1</li>');

  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, '</p><p style="margin: 0.75rem 0;">');

  // Single newlines to <br> (within paragraphs)
  html = html.replace(/\n/g, '<br>');

  return `<p style="margin: 0.75rem 0;">${html}</p>`;
}

/* ── Utility: HTML Escape ── */

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── Post-render event binding for debrief buttons ── */
// We need to re-bind these after renderView since they are inside the debrief HTML
const _origRenderView = renderView;

renderView = function(container) {
  _origRenderView(container);

  // Bind debrief buttons (only exist after rehearsal ends)
  const newRehearsalBtn = container.querySelector('#rh-new-rehearsal-btn');
  if (newRehearsalBtn) {
    newRehearsalBtn.addEventListener('click', () => {
      rehearsalActive = false;
      rehearsalEnded = false;
      chatMessages = [];
      apiMessages = [];
      debriefContent = null;
      selectedLessonId = null;
      renderView(container);
    });
  }

  const copyDebriefBtn = container.querySelector('#rh-copy-debrief-btn');
  if (copyDebriefBtn) {
    copyDebriefBtn.addEventListener('click', () => {
      if (debriefContent) {
        navigator.clipboard.writeText(debriefContent).then(() => {
          showToast('Feedback copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Failed to copy. Please select and copy manually.', 'warning');
        });
      }
    });
  }
};
