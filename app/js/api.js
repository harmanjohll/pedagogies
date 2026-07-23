/*
 * Co-Cher API Layer
 * =================
 * Gemini API integration for lesson planning chat.
 */

import { Store } from './state.js';
import { trackEvent } from './utils/analytics.js';
import { getPreferredName } from './components/login.js';
import { SCHEMA_PRESETS } from './utils/tracking.js';
import { TEACHING_AREAS, actionsForArea, TEACHING_ACTION_OTHER } from './utils/stp.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `You are Co-Cher, a warm, knowledgeable AI teaching assistant designed for Singapore educators across ALL disciplines — Sciences, Humanities, Languages, Mathematics, the Arts, PE, CCE (Character & Citizenship Education), and more. You help teachers with lesson experience design, enactment planning, and pedagogical thinking.

## Root Principles (Apply to EVERY response)

### E21CC — 21st Century Competencies
Every lesson should intentionally develop one or more E21CC domains:
- **CAIT** (Critical, Adaptive & Inventive Thinking): analysis, evaluation, creative problem-solving, design thinking
- **CCI** (Communication, Collaboration & Information): teamwork, articulation, digital literacy, information fluency
- **CGC** (Civic, Global & Cross-cultural Literacy): perspective-taking, social awareness, ethical reasoning, active citizenship
- Core Values (R3ICH): Respect, Responsibility, Resilience, Integrity, Care, Harmony
- SEL Outcomes: Self-Awareness, Self-Management, Social Awareness, Relationship Management, Responsible Decision-Making

For classroom observation and student profiling, Co-Cher tracks six classroom-observable dimensions: Critical Thinking and Creative Thinking (mapping to CAIT), Communication and Collaboration (mapping to CCI), and Social Connectedness and Self-Regulation (SEL-adjacent dimensions tracked alongside E21CC). These six are Co-Cher's tracking dimensions, not MOE domains.

When suggesting activities, always note which E21CC domain(s) they develop and how.

### CCE2021 — Character & Citizenship Education
CCE is integral to holistic student development. The CCE2021 framework is built on three Big Ideas:
- **Identity**: Who am I? Developing self-awareness, sense of purpose, and moral compass
- **Relationships**: How do I relate to others? Building empathy, respect, and positive connections
- **Choices**: How do I make responsible choices? Ethical reasoning, consequences, responsible decision-making

CCE Content Areas: National Education (NE), Sexuality Education (SE), Mental Health (MH), Education & Career Guidance (ECG), Cyber Wellness (CW), Family Education (FE).

NE Citizenship Dispositions: Sense of Belonging, Sense of Hope, Sense of Reality, The Will to Act.

When planning CCE lessons or when CCE is the subject, use age-appropriate facilitation strategies: circle structure, four corners, freeze frame, hot seat, round table, forum theatre, and structured academic controversy. Draw on students' life experiences as context. Encourage discussion of contemporary issues including sensitive topics (race, religion, identity) in a safe, respectful classroom environment.

### EdTech Masterplan 2030
Technology should amplify pedagogy, not replace it. Consider how digital tools can:
- Enable self-directed learning (student agency, choice, pacing)
- Support collaborative knowledge building (shared docs, discussion forums, peer feedback)
- Make thinking visible (concept maps, digital portfolios, screencasts)
- Provide formative feedback loops (quizzes, polls, exit tickets via digital platforms)

### Disciplinarity & Transferability
Respect the discipline the teacher works in. A Science lesson emphasises inquiry and evidence; a Language lesson emphasises expression and interpretation; a Humanities lesson emphasises perspective and analysis; a Mathematics lesson emphasises reasoning and modelling; a CCE lesson emphasises values clarification, ethical reasoning, and perspective-taking through discussion of real-world issues. Adapt your language, examples, and suggestions to the teacher's subject context. If no subject is specified, keep suggestions cross-disciplinary.

### Singapore Teaching Practice (STP)
Align with the four Teaching Processes (non-hierarchical): Positive Classroom Culture, Lesson Preparation, Lesson Enactment, Assessment and Feedback.

## Your Expertise
- Singapore MOE frameworks: E21CC, STP, EdTech Masterplan 2030, CCE2021
- Lesson design: Understanding by Design (UbD), 5E Instructional Model, Thinking Routines
- CCE pedagogy: Values-based discussions, contemporary issues, facilitation techniques, Social-Emotional Learning
- Spatial classroom design — how physical arrangement supports pedagogy
- Differentiated instruction and inclusive teaching strategies
- Assessment for/of/as learning (formative & summative)
- Cross-curricular connections and interdisciplinary approaches

## Output Shape — Concise Scaffold (CRITICAL)
1. SHARP BY DEFAULT — this is the most important rule. Write like a busy teacher's prep notes, not an essay: short lines, one idea per bullet, no restating the question back, no filler openers ("Great question!", "Here's a comprehensive plan for..."), no closing summary that just repeats what you already said. If a paragraph is forming, break it into bullets or cut it.
2. A lesson plan is a CONCISE SCAFFOLD, not a script: every section is AT MOST ~4 tight bullets. The key constructs are always present — learning intention/success criteria, hook, activities with timing, an assessment check, and a differentiation pointer — but each stays skeletal.
3. NO long exemplar prose and NO model answers written inline — the teacher expands what they need on demand via EXPAND markers.
4. ON-DEMAND EXPANSION: after each major section of a plan, append ONE line of expansion markers: [EXPAND: Details|<section-slug>], where <section-slug> is that section's heading in kebab-case (e.g. "## Main Activity" → main-activity). When one genuinely fits the section, add AT MOST one extra marker on the same line using a verb from: Exemplar, Example, Model answer, Misconceptions, Instance — e.g. [EXPAND: Details|main-activity] [EXPAND: Misconceptions|main-activity]. These render as buttons the teacher clicks to generate the expansion later — NEVER write the expanded content yourself. Use EXPAND markers only in lesson plans, not in ordinary chat replies.
5. PROGRESSIVE DETAIL for micro-cases: for a small one-off aside (a rationale, an alternate phrasing, a caveat) too minor for a section expansion, use [DETAIL: short label | the fuller explanation] — it renders as a small expandable line the teacher can open only if they want it.
6. END COMPLETE: a plan must end complete — never truncated mid-section. If space is tight, cut detail (it lives behind EXPAND markers), never cut sections.

## Guidelines
1. Be warm and collegial in tone even while being terse — brevity is not curtness
2. Give classroom-ready, practical suggestions grounded in the teacher's subject
3. Reference E21CC, STP, CCE2021, and EdTech frameworks naturally — don't force them; when a connection is genuinely useful, name it in one clause, not a paragraph
4. Offer 2-3 options when the teacher needs to make a design decision
5. Consider the whole lesson experience — how students feel, move, interact, and learn; consider spatial design (sightlines, mobility, grouping modes) where relevant, briefly
6. Use markdown formatting for scannability (headers, bullets, bold) — never a wall of prose
7. When useful, suggest how a lesson could be framed through different curriculum orientations (Scholar-Academic, Learner-Centred, Social Efficiency, Social Reconstructivist) — one line, and only if it adds value, never as a checklist
8. For CCE lessons, connect to the Big Ideas (Identity, Relationships, Choices) and relevant R3ICH values — name them, don't explain them
9. Start with a real-world hook connecting the topic to students' lives — 1-2 sentences, no more. Fit the framing to the discipline and pedagogy (a question, a scenario, an artefact, a provocation) rather than forcing one phrasing. This is the first thing students hear
10. When an activity develops E21CC competencies, name the specific domain (CAIT, CCI, CGC) in a short clause. Same for EdTech tools and STP alignment — name it, don't elaborate unless asked
11. TEACHER'S CALL: when a design decision genuinely belongs to the teacher (hook variant, grouping format, assessment format, pacing trade-off), do NOT decide it for them. Present it on its own line in exactly this form: [CHOICE: first option | second option]. Use at most 2 per response, and only when the decision meaningfully shapes the lesson — never for trivia

Respond conversationally, but keep it tight. Help the teacher think through their lesson experience holistically — without making them read more than they need to.`;

/* ── Transient-failure handling ──
 * Gemini free-tier keys hit 429s routinely; 5xx happens under load.
 * Retry twice with backoff (1.5s, 3s) before surfacing a friendly error. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* Default per-attempt timeout. TTS / large builds can pass a longer ms. */
const DEFAULT_TIMEOUT_MS = 60000;

/* ── Honest offline guard ──
 * When the browser knows it's offline there's no point running the retry loop
 * against a connection that isn't there — fail fast with a message the UI can
 * show as-is. Guarded on navigator so it's a no-op under node/tests. */
function assertOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error("You're offline — AI generation needs a connection. Everything you've made is saved here and works offline.");
  }
}

async function fetchWithRetry(url, init, { retries = 2, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  assertOnline();
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1500 * Math.pow(2, attempt - 1));
    // Abort a hung socket so a dead connection rejects instead of hanging forever.
    const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetch(url, controller ? { ...init, signal: controller.signal } : init);
      if (!RETRYABLE_STATUS.has(res.status) || attempt === retries) return res;
      lastErr = new Error(`API error ${res.status}`);
    } catch (e) {
      if (e && e.name === 'AbortError') {
        throw new Error('The request timed out — check your connection and try again.');
      }
      lastErr = e;
      if (attempt === retries) throw new Error('Could not reach Gemini — check your internet connection and try again.');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr;
}

function friendlyApiError(status, raw) {
  if (status === 429) return 'Gemini is rate-limiting your key (free-tier quota). Co-Cher already retried; wait a minute and try again.';
  if (status === 401 || status === 403) return 'Your Gemini API key was rejected. Check it in Settings → Gemini API Key.';
  if (status === 404) return 'The selected model is unavailable. Pick another model in Settings.';
  if (status >= 500) return 'Gemini had a server hiccup. Co-Cher retried without luck; try again shortly.';
  return raw;
}

/** Map a stored model id that no longer exists to the current default. */
export function normalizeModel(id) {
  return AVAILABLE_MODELS.some(m => m.id === id) ? id : 'gemini-2.5-flash';
}

/* ── Defensive JSON extraction for jsonMode responses ──
 * responseMimeType asks Gemini for pure JSON, but models occasionally wrap
 * output in ``` fences or stray prose. Strip both before parsing. */
function parseJsonResponse(raw, label) {
  let text = String(raw ?? '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start && (start > 0 || end < text.length - 1)) {
    text = text.slice(start, end + 1);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Could not read the model's ${label} response — please try again.`);
  }
}

export async function sendChat(messages, options = {}) {
  trackEvent('ai', 'generate', options.trackLabel || 'chat', options.trackDetail || '');
  const apiKey = Store.get('apiKey');
  // options.model lets a caller pick a heavier model for one call
  // (e.g. complex simulation builds) without changing the app default
  const model = normalizeModel(options.model || Store.get('model') || 'gemini-2.5-flash');

  if (!apiKey) {
    throw new Error('No API key configured. Please add your Gemini API key in Settings.');
  }

  let systemPrompt = options.systemPrompt || SYSTEM_PROMPT;
  const temperature = options.temperature ?? 0.8;
  const maxTokens = options.maxTokens ?? 4096;

  // Inject school profile into system prompt when available
  const schoolProfile = Store.getSchoolProfile?.() || {};
  if (schoolProfile.values) {
    systemPrompt += `\n\nThe teacher's school values are: ${schoolProfile.values}. Where these values naturally align with the lesson content, weave them in subtly. Do NOT force or contrive connections — only reference school values when the context genuinely supports it.`;
  }
  if (schoolProfile.name) {
    systemPrompt += `\nThe teacher's school is: ${schoolProfile.name}.`;
  }

  // Inject teacher's preferred name
  const teacherName = getPreferredName?.() || '';
  if (teacherName) {
    systemPrompt += `\nThe teacher's name is ${teacherName}. Address them naturally by name when appropriate — not every message, but when it fits. Never say "Hello Co-Cher" — you ARE Co-Cher. When introducing a lesson topic, connect it to a relevant pedagogical opportunity rather than starting with generic pleasantries.`;
  }

  let body;

  if (options.jsonMode) {
    // JSON mode: match the proven pattern from the original spatial planner.
    // Embed system prompt in the user message (no systemInstruction) and set
    // responseMimeType — this is what Gemini reliably responds to. Callers'
    // temperature/maxTokens are honoured here just like the text path.
    // Content may be a plain string OR a multimodal array ({text}/{inlineData});
    // jsonMode is text-only, so flatten to the text parts (never stringify an
    // object to "[object Object]").
    const textOf = (c) => Array.isArray(c)
      ? c.map(p => (typeof p === 'string' ? p : (p && typeof p.text === 'string' ? p.text : ''))).filter(Boolean).join('\n')
      : String(c ?? '');
    const userText = messages.map(m => textOf(m.content)).join('\n\n');
    const combined = `${systemPrompt}\n\nUser request:\n${userText}`;
    body = {
      contents: [{ role: 'user', parts: [{ text: combined }] }],
      generationConfig: { responseMimeType: 'application/json', temperature, maxOutputTokens: maxTokens }
    };
  } else {
    // Normal text mode: use systemInstruction for richer conversations.
    // m.content may be a plain string or an array of multimodal items —
    // map each item to a Gemini part ({text} or {inlineData}).
    const toParts = (content) => {
      if (!Array.isArray(content)) return [{ text: content }];
      return content.map(item => {
        if (item == null) return null;
        if (typeof item === 'string') return { text: item };
        if (item.inlineData) return { inlineData: item.inlineData };            // direct Gemini passthrough
        if (item.type === 'image' && item.source) {                             // Anthropic-style image block
          return { inlineData: { mimeType: item.source.media_type || item.source.mimeType || 'image/png', data: item.source.data } };
        }
        if (typeof item.text === 'string') return { text: item.text };
        return null;
      }).filter(Boolean);
    };
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: toParts(m.content)
    }));
    body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    };
  }

  // Key travels in a header (not the URL) so it can't leak into logs/history
  const res = await fetchWithRetry(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body)
  }, { timeoutMs: options.timeoutMs });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    throw new Error(friendlyApiError(res.status, msg));
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!parts || parts.length === 0) {
    throw new Error('No response from model.');
  }

  // For thinking models the answer is the last text part;
  // for standard models there is only one part — either way last works.
  const textParts = parts.filter(p => p.text != null);
  const text = textParts.length > 0 ? textParts[textParts.length - 1].text : null;

  if (!text) {
    throw new Error('No response from model.');
  }

  return text;
}

export async function summarizeNotes(notes) {
  const joined = notes.map((n, i) => `Note ${i + 1} (${new Date(n.createdAt).toLocaleDateString()}):\n${n.text}`).join('\n\n');

  const messages = [{
    role: 'user',
    content: `Please provide a concise summary of these class notes, highlighting key themes, student observations, and action items:\n\n${joined}`
  }];

  return sendChat(messages, {
    trackLabel: 'summarizeNotes',
    systemPrompt: 'You are a helpful assistant that summarizes teacher class notes concisely. Use bullet points. Focus on actionable insights and recurring themes. Keep it brief (3-5 bullet points).',
    temperature: 0.4,
    maxTokens: 1024
  });
}

/* ── On-demand section expansion ([EXPAND: Verb|slug] chips) ──
 * Plans and components are concise scaffolds; each [EXPAND:] chip the teacher
 * clicks lands here. One focused call, one section, one verb — never the
 * whole plan again. */
export async function expandSection({ planContext, sectionHeading, verb, classContext } = {}) {
  const plan = String(planContext ?? '').trim().slice(0, 8000);
  const heading = String(sectionHeading ?? '').trim() || 'the requested section';
  const want = String(verb ?? '').trim() || 'Details';

  const messages = [{
    role: 'user',
    content: `Lesson plan (for context — do NOT rewrite it):
${plan}
${classContext ? `\nClass context:\n${classContext}\n` : ''}
Section to expand: "${heading}"
Expansion requested: ${want}`
  }];

  return sendChat(messages, {
    trackLabel: 'expandSection',
    trackDetail: want,
    temperature: 0.7,
    maxTokens: 1100,
    systemPrompt: `You are Co-Cher, an expert co-teacher for Singapore educators. You are given a lesson plan and ONE section of it. Produce ONLY the requested expansion for THAT section — nothing else.

Verb semantics (produce exactly what the verb asks for):
- Details → concrete how-to steps the teacher follows to run that section (numbered or bulleted, classroom-ready)
- Exemplar / Example / Instance → ONE worked, classroom-ready instance (the actual text/task/problem the teacher would use, fully written out)
- Model answer → the answer a strong student would actually give, written in the student's voice
- Misconceptions → the top 2-3 misconceptions students bring to this section, each with one corrective move

Rules:
- Maximum 250 words.
- Markdown (bullets, bold, short lines) — no headers, and do NOT repeat the section heading.
- No preamble ("Here's...", "Sure!") and no closing summary — start directly with the content.
- Stay grounded in THIS plan's topic, level and class context.
- Never include [EXPAND:], [DETAIL:] or [CHOICE:] markers in your output.`
  });
}

/* ── AI Lesson Review ── */
export async function reviewLesson(planText) {
  const messages = [{
    role: 'user',
    content: `Please review this lesson plan and provide constructive feedback:\n\n${planText}`
  }];

  return sendChat(messages, {
    trackLabel: 'reviewLesson',
    systemPrompt: `You are Co-Cher's lesson review assistant for Singapore educators. Analyse lesson plans against:
- E21CC alignment (CAIT, CCI, CGC) — which domains are addressed, which could be strengthened
- STP alignment — positive classroom culture, lesson preparation, lesson enactment, assessment and feedback
- Differentiation — how well does the plan cater to diverse learners
- Engagement — student-centred vs teacher-centred balance
- Assessment — how understanding is checked

Format your response as:
## Strengths
(2-3 bullet points)

## Areas for Growth
(2-3 bullet points with specific suggestions)

## E21CC Alignment
(Brief analysis of which domains are covered)

## Quick Wins
(1-2 small changes that would significantly improve the lesson)

Be encouraging, specific, and practical. Speak as a fellow educator.`,
    temperature: 0.5,
    maxTokens: 3072
  });
}

/* ── Generate Rubric ── */
export async function generateRubric(lessonTopic, level, subject) {
  const messages = [{
    role: 'user',
    content: `Create an assessment rubric for: ${lessonTopic}\nLevel: ${level || 'Secondary'}\nSubject: ${subject || 'General'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateRubric',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's assessment specialist for Singapore educators. Generate clear, practical rubrics.

Format rubrics as markdown tables with:
- 3-4 criteria rows
- 4 achievement levels: Exemplary | Proficient | Developing | Beginning
- Each cell should have a brief descriptor (1-2 sentences)
- Include E21CC domains where relevant
- Make criteria observable and measurable

End with a brief "Teacher Notes" section with tips on using the rubric.`,
    temperature: 0.5,
    maxTokens: 3072
  });
}

/* ── Student Grouping ── */
/* Students carry six E21CC dimensions with rubric levels
 * (developing → applying → extending → leading) — see state.js. */
const E21CC_PROFILE_DIMS = [
  ['criticalThinking', 'Critical Thinking'],
  ['creativeThinking', 'Creative Thinking'],
  ['communication', 'Communication'],
  ['collaboration', 'Collaboration'],
  ['socialConnectedness', 'Social Connectedness'],
  ['selfRegulation', 'Self-Regulation']
];
const e21ccProfileLine = (s) =>
  E21CC_PROFILE_DIMS.map(([key, label]) => `${label}=${s.e21cc?.[key] || 'developing'}`).join(', ');

/* Returns a structured result:
 *   { groups: [{ name, studentNames: [], rationale }], strategyNote }
 * A non-enumerable toString() renders the legacy markdown so callers that
 * treat the result as text (e.g. classes.js via escapeHtml → String()) keep
 * working unchanged. Use groupingToMarkdown() for an explicit rendering.
 * options.portraitText: schema-aware class portrait prose
 * (Store.getPortraitPromptText) injected as extra grouping context. */
export async function suggestGrouping(students, activityType, options = {}) {
  const groupSize = options.groupSize || 4;
  const considerations = options.considerations || '';
  const portraitText = options.portraitText || '';

  const studentSummary = students.map((s, i) =>
    `${i + 1}. ${s.name}: ${e21ccProfileLine(s)}`
  ).join('\n');

  const totalStudents = students.length;
  const expectedGroups = Math.ceil(totalStudents / groupSize);

  const userContent = `Create student groupings for: ${activityType}
Preferred group size: ${groupSize} students per group (approximately ${expectedGroups} groups)
Total students: ${totalStudents}

${portraitText ? `Class portrait (whole-class summary — use it to inform the strategy):\n${portraitText}\n\n` : ''}${considerations ? `Teacher's additional considerations:\n${considerations}\n\n` : ''}Students and their E21CC profiles:
${studentSummary}`;

  const raw = await sendChat([{ role: 'user', content: userContent }], {
    trackLabel: 'suggestGrouping',
    jsonMode: true,
    systemPrompt: `You are Co-Cher's grouping specialist. Create student groups for Singapore classrooms.

ABSOLUTE RULES — FOLLOW EXACTLY:
1. You MUST assign EVERY SINGLE ONE of the ${totalStudents} students to exactly one group. Count them. No one left out, no one duplicated.
2. Target ${groupSize} per group. Some groups may have ${groupSize - 1} or ${groupSize + 1} if numbers don't divide evenly.
3. Keep each rationale SHORT — one sentence maximum.
4. Use each student's FULL NAME exactly as provided in the list. Do NOT abbreviate, do NOT use "..." or "etc."

E21CC dimension levels run developing → applying → extending → leading.

Grouping logic:
- Collaborative: mix E21CC strengths
- Peer tutoring: pair extending/leading with developing
- Competitive: balance groups fairly
- Jigsaw: roles by individual strengths
- Lab/practical: mix practical readiness
- Debate: balance Communication levels
- Project-based: diverse strengths

Return STRICT JSON only (no markdown, no commentary) in exactly this shape:
{"groups":[{"name":"Group 1","studentNames":["Full Name A","Full Name B"],"rationale":"One short sentence."}],"strategyNote":"One or two sentences on the overall grouping strategy."}`,
    temperature: 0.5,
    maxTokens: 8192
  });

  const parsed = parseJsonResponse(raw, 'grouping');
  const groups = (Array.isArray(parsed?.groups) ? parsed.groups : [])
    .map((g, i) => ({
      name: typeof g?.name === 'string' && g.name.trim() ? g.name.trim() : `Group ${i + 1}`,
      studentNames: Array.isArray(g?.studentNames) ? g.studentNames.map(n => String(n).trim()).filter(Boolean) : [],
      rationale: typeof g?.rationale === 'string' ? g.rationale.trim() : ''
    }))
    .filter(g => g.studentNames.length > 0);
  if (groups.length === 0) {
    throw new Error('The model returned no usable groups — please try again.');
  }
  const result = {
    groups,
    strategyNote: typeof parsed?.strategyNote === 'string' ? parsed.strategyNote.trim() : ''
  };
  Object.defineProperty(result, 'toString', {
    value: () => groupingToMarkdown(result, { activityType }),
    enumerable: false
  });
  return result;
}

/* Render a structured grouping result as the markdown shape the UI has
 * always shown (**Group N:** names + rationale). Pure and synchronous. */
export function groupingToMarkdown(result, options = {}) {
  const groups = Array.isArray(result?.groups) ? result.groups : [];
  const lines = [`## Groups${options.activityType ? ` for ${options.activityType}` : ''}`, ''];
  let total = 0;
  groups.forEach((g, i) => {
    const names = (g.studentNames || []).map(n => String(n).trim()).filter(Boolean);
    total += names.length;
    const isDefaultName = /^group\s*\d+$/i.test((g.name || '').trim());
    const label = isDefaultName ? g.name.trim() : `Group ${i + 1}${g.name ? ` — ${g.name}` : ''}`;
    lines.push(`**${label}:** ${names.join(', ')}`);
    if (g.rationale) lines.push(`**Rationale:** ${g.rationale}`);
    lines.push('');
  });
  if (total > 0) lines.push(`**Total: ${total} student${total === 1 ? '' : 's'} assigned**`);
  if (result?.strategyNote) {
    lines.push('');
    lines.push(`**Strategy:** ${result.strategyNote}`);
  }
  return lines.join('\n').trim();
}

/* ── Exit Ticket / Quick Check Generator ── */
export async function generateExitTicket(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate exit ticket questions for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateExitTicket',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's assessment specialist for Singapore educators. Generate a TIGHT exit ticket — a scaffold the teacher scans in seconds, not a worksheet.

Create exactly 3–4 ESSENTIAL questions:
1. **Recall** — factual check
2. **Apply** — apply what they learned
3. **Think Deeper** — higher-order (CAIT)
4. (Optional) **Reflect** — values / collaboration / real-world (CGC/CCI)

Format EXACTLY (keep every line to ONE line):
## Exit Ticket

### Q1: Recall
[The question — ONE line]
*exercises: [specific E21CC element, e.g. recalling key concepts (Critical Thinking)]*
*Expected response:* [ONE line]
[EXPAND: Model answer|exit-q-1]

### Q2: Apply
[Question — ONE line]
*exercises: [E21CC element, e.g. transferring ideas to new contexts (Creative Thinking)]*
*Expected response:* [ONE line]
[EXPAND: Model answer|exit-q-2]

### Q3: Think Deeper
[Question — ONE line]
*exercises: [E21CC element, e.g. questioning assumptions (Critical Thinking)]*
*What to look for:* [ONE line]
[EXPAND: Model answer|exit-q-3]

### Q4: Reflect (optional)
[Question — ONE line]
*exercises: [E21CC element]*
[EXPAND: Model answer|exit-q-4]

## Teacher Notes
- 2-3 one-line bullets only (how to run it; what a misconception looks like; one follow-up move)
[EXPAND: Details|teacher-notes]

Rules: every question ONE line; expected responses at most ONE line; NO model answers written inline — the [EXPAND: Model answer|exit-q-N] markers are buttons the teacher clicks to generate them on demand, so keep the marker syntax exactly. Age-appropriate, aligned to Singapore curriculum standards.`,
    temperature: 0.5,
    maxTokens: 2048
  });
}

/* ── Differentiation Suggestions ── */
export async function suggestDifferentiation(students, planText) {
  const profileSummary = students.map(s =>
    `${s.name}: ${e21ccProfileLine(s)}`
  ).join('\n');

  const messages = [{
    role: 'user',
    content: `Analyse these student E21CC profiles against the lesson plan and suggest differentiation strategies.

Lesson Plan:
${planText}

Student Profiles (${students.length} students):
${profileSummary}`
  }];

  return sendChat(messages, {
    trackLabel: 'suggestDifferentiation',
    systemPrompt: `You are Co-Cher's differentiation specialist for Singapore educators. Analyse student E21CC profiles and identify which students may need additional support or extension for a given lesson.

E21CC level interpretation (developing → applying → extending → leading):
- developing: likely needs scaffolding and structured support in that dimension
- applying: benefits from guided practice
- extending: ready for standard-level activities with some stretch
- leading: ready for extension tasks or peer mentoring

Output a CONCISE SCAFFOLD — one-line entries, no explanatory prose. Format:

## Class Profile Overview
1-2 bullets: the class's E21CC strengths and growth areas.
[EXPAND: Details|class-profile-overview]

## Students Needing Scaffolding
Only the 3-5 most pressing students (developing in a key dimension):
- **[Name]** — [dimension] at [level]: [suggestion, ONE line]
[EXPAND: Details|students-needing-scaffolding]

## Students Ready for Extension
Only the 3-5 clearest cases (extending/leading in key dimensions):
- **[Name]** — [dimension] at [level]: [extension opportunity, ONE line]
[EXPAND: Details|students-ready-for-extension]

## Differentiation Strategies
2-3 strategies, ONE line each — name the strategy and where in THIS lesson it lands.
[EXPAND: Details|differentiation-strategies]

Rules: every entry ONE line; no worked examples inline — the [EXPAND: Details|<slug>] markers are buttons the teacher clicks to expand a block on demand, so keep their syntax exactly and place one at the end of each section. Name specific students, tie suggestions to the actual lesson content, and reference the STP process of Assessment and Feedback only where it genuinely fits.`,
    temperature: 0.5,
    maxTokens: 2048
  });
}

/* ── Lesson Timeline / Pacing ── */
export async function generateTimeline(planText, totalMinutes, subject) {
  const messages = [{
    role: 'user',
    content: `Create a lesson timeline/pacing guide for this lesson:\n\n${planText}\n\nTotal lesson duration: ${totalMinutes} minutes\nSubject: ${subject || 'General'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateTimeline',
    trackDetail: subject || '',
    systemPrompt: `You are Co-Cher's lesson pacing specialist for Singapore educators. Create a clear, practical lesson timeline that breaks the lesson into timed segments.

Guidelines:
- Total time must add up to exactly ${totalMinutes} minutes
- Include transition time between activities (1–2 min)
- Suggest spatial arrangement for each segment where relevant (e.g., "rows", "pods", "U-shape", "stations")
- Reference E21CC domains being developed in each segment
- Include what the teacher and students are doing in each segment

Format:

## Lesson Timeline (${totalMinutes} min)

| Time | Duration | Segment | Spatial Setup | Activity | E21CC Focus |
|------|----------|---------|---------------|----------|-------------|
| 0:00 | 5 min | Opening | Rows | [description] | — |
| 0:05 | 10 min | [name] | [arrangement] | [description] | CAIT |
| ... | ... | ... | ... | ... | ... |

## Pacing Notes
- Key transition points and what to prepare
- Where to add buffer time if needed
- Checkpoint moments (when to check understanding)

## Spatial Flow
Brief description of how the room arrangement changes during the lesson (if applicable). This helps the teacher plan physical transitions.

Be specific and practical. Teachers need minute-by-minute clarity.`,
    temperature: 0.5,
    maxTokens: 3072
  });
}

/* ── Seat Assignment (Who Sits Where) ── */
/* Returns a structured result:
 *   { groups: [{ name, position, members: [], why }], note }
 * A non-enumerable toString() renders the legacy markdown; use
 * seatPlanToMarkdown() for an explicit rendering. */
export async function suggestSeatAssignment(groups, layoutPreset, studentCount) {
  const groupSummary = groups.map((g, i) => {
    const custom = g.name && !/^group\s*\d+$/i.test(String(g.name).trim());
    return `Group ${i + 1}${custom ? ` (${g.name})` : ''}: ${(g.members || []).join(', ')}`;
  }).join('\n');

  const messages = [{
    role: 'user',
    content: `Assign seating positions for these student groups in a "${layoutPreset}" classroom arrangement with ${studentCount} students.

Groups:
${groupSummary}`
  }];

  const raw = await sendChat(messages, {
    trackLabel: 'suggestSeatAssignment',
    jsonMode: true,
    systemPrompt: `You are Co-Cher's spatial arrangement specialist. Given student groups and a classroom layout preset, suggest where each group should sit.

Layout presets and their spatial features:
- direct: Rows facing front — assign by row position (front, middle, back)
- pods: Triangular clusters — assign to specific pod/cluster numbers
- stations: Rotation stations — assign home base stations
- ushape: U-shape / circle — assign by position along the U (left arm, curve, right arm)
- quiet: Individual desks — assign by zone (window side, door side, center)
- gallery: Exhibition displays — assign gallery stations
- fishbowl: Inner + outer circle — assign inner/outer positions
- maker: Makerspace tables — assign workbench areas

Include every group and every member exactly as provided. Be practical and visual — help the teacher picture exactly where each group goes.

Return STRICT JSON only (no markdown, no commentary) in exactly this shape:
{"groups":[{"name":"Group 1","position":"Specific location, e.g. Front-left pod","members":["Full Name A","Full Name B"],"why":"Brief rationale, e.g. Near whiteboard for presentations"}],"note":"Room notes: where the teacher should position themselves, sightline considerations, students who should face specific directions."}`,
    temperature: 0.5,
    maxTokens: 4096
  });

  const parsed = parseJsonResponse(raw, 'seating plan');
  const parsedGroups = (Array.isArray(parsed?.groups) ? parsed.groups : [])
    .map((g, i) => ({
      name: typeof g?.name === 'string' && g.name.trim() ? g.name.trim() : `Group ${i + 1}`,
      position: typeof g?.position === 'string' ? g.position.trim() : '',
      members: Array.isArray(g?.members) ? g.members.map(m => String(m).trim()).filter(Boolean) : [],
      why: typeof g?.why === 'string' ? g.why.trim() : ''
    }))
    .filter(g => g.members.length > 0);
  if (parsedGroups.length === 0) {
    throw new Error('The model returned no usable seating plan — please try again.');
  }
  const result = {
    groups: parsedGroups,
    note: typeof parsed?.note === 'string' ? parsed.note.trim() : ''
  };
  Object.defineProperty(result, 'toString', {
    value: () => seatPlanToMarkdown(result),
    enumerable: false
  });
  return result;
}

/* Render a structured seat plan as the markdown shape the UI has always
 * shown ('### Group N / Position / Members / Why here'). */
export function seatPlanToMarkdown(result) {
  const lines = ['## Seating Plan', ''];
  (Array.isArray(result?.groups) ? result.groups : []).forEach((g, i) => {
    const isDefaultName = /^group\s*\d+$/i.test((g.name || '').trim());
    lines.push(isDefaultName ? `### ${g.name.trim()}` : `### Group ${i + 1}${g.name ? `: ${g.name}` : ''}`);
    if (g.position) lines.push(`**Position:** ${g.position}`);
    lines.push(`**Members:** ${(g.members || []).join(', ')}`);
    if (g.why) lines.push(`**Why here:** ${g.why}`);
    lines.push('');
  });
  if (result?.note) {
    lines.push('## Room Notes');
    lines.push(result.note);
  }
  return lines.join('\n').trim();
}

/* ── Run of Show: stage a freeform plan into runnable segments ── */
const RUN_OF_SHOW_MODES = ['individual', 'pairs', 'groups', 'whole-class'];

// The six E21CC tracking dimensions (single source of truth: utils/tracking.js)
const E21CC_FOCUS_KEYS = SCHEMA_PRESETS.e21cc.fields.map(f => f.key);
const TEACHING_AREA_KEYS = TEACHING_AREAS.map(a => a.key);

function coerceGroupingMode(value) {
  const v = String(value ?? '').toLowerCase().trim();
  if (!v) return null;
  if (RUN_OF_SHOW_MODES.includes(v)) return v;
  if (/^(solo|individual|independent)/.test(v)) return 'individual';
  if (/pair/.test(v)) return 'pairs';
  if (/(whole|full)[\s_-]*class|plenary/.test(v)) return 'whole-class';
  if (/group|team|pod/.test(v)) return 'groups';
  return null;
}

let _segmentSeq = 0;
function newSegmentId() {
  _segmentSeq += 1;
  return `seg_${Date.now().toString(36)}_${_segmentSeq}${Math.random().toString(36).slice(2, 6)}`;
}

/* Normalize + validate raw model output (or any segment-ish data) into the
 * lesson.runOfShow shape: { generatedAt, segments: [{ id, name, duration,
 * activity, studentInstructions, layoutSceneId, grouping, resources }] }.
 * Clamps to 1-14 segments, coerces numbers, defaults missing fields, and
 * gives every segment an id. Throws when nothing usable remains.
 * Exported for testability. */
export function normalizeRunOfShow(raw) {
  let data = raw;
  if (typeof data === 'string') data = parseJsonResponse(data, 'run of show');
  const list = Array.isArray(data) ? data : (Array.isArray(data?.segments) ? data.segments : []);
  const segments = list.slice(0, 14).map((seg, i) => {
    const s = (seg && typeof seg === 'object') ? seg : {};
    let duration = Math.round(Number(s.duration));
    if (!Number.isFinite(duration) || duration < 1) duration = 5;
    if (duration > 240) duration = 240;
    const mode = coerceGroupingMode(s.groupingMode ?? s.grouping?.mode);
    const existingGroups = Array.isArray(s.grouping?.groups) ? s.grouping.groups : [];
    // STP: validate the Teaching Area against the registry, and the Teaching
    // Action against that area's action ids (or the "other" escape hatch).
    const teachingArea = TEACHING_AREA_KEYS.includes(s.teachingArea) ? s.teachingArea : null;
    const validActionIds = teachingArea ? actionsForArea(teachingArea).map(a => a.id) : [];
    const teachingAction = (teachingArea && typeof s.teachingAction === 'string'
      && (validActionIds.includes(s.teachingAction) || s.teachingAction === TEACHING_ACTION_OTHER))
      ? s.teachingAction : null;
    return {
      id: (typeof s.id === 'string' && s.id) ? s.id : newSegmentId(),
      name: String(s.name ?? '').trim() || `Segment ${i + 1}`,
      duration,
      activity: String(s.activity ?? '').trim(),
      studentInstructions: String(s.studentInstructions ?? '').trim(),
      layoutSceneId: (typeof s.layoutSceneId === 'string' && s.layoutSceneId) ? s.layoutSceneId : null,
      grouping: mode ? { mode, groups: existingGroups } : null,
      resources: Array.isArray(s.resources) ? s.resources : [],
      e21ccFocus: E21CC_FOCUS_KEYS.includes(s.e21ccFocus) ? s.e21ccFocus : null,
      teachingArea,
      teachingAction,
      teachingActionOther: String(s.teachingActionOther ?? '').trim()
    };
  });
  if (segments.length === 0) {
    throw new Error('No usable segments in the run of show — please try again.');
  }
  return { generatedAt: Date.now(), segments };
}

/* Stage a freeform lesson plan (markdown) into 3-7 chronological segments.
 * Returns the normalized runOfShow object or throws. */
export async function generateRunOfShow({ plan, className = '', portraitText = '', durationHint = null } = {}) {
  const planText = String(plan ?? '').trim();
  if (!planText) throw new Error('No lesson plan to stage yet.');

  const duration = Math.round(Number(durationHint));
  const durationLine = (Number.isFinite(duration) && duration > 0)
    ? `The lesson is ${duration} minutes long — segment durations must be integers summing to approximately ${duration}.`
    : 'If the plan implies a total lesson duration, make the integer segment durations sum to approximately it; otherwise assume a 55-minute lesson.';

  // STP Teaching Areas + their action ids, so the stager can tag each segment.
  const stpAreasRef = TEACHING_AREAS
    .map(a => `  ${a.key} (${a.label}): ${actionsForArea(a.key).map(x => x.id).join(', ')}`)
    .join('\n');

  const raw = await sendChat([{
    role: 'user',
    content: `Break this lesson plan into a chronological run of show.
${className ? `Class: ${className}\n` : ''}${portraitText ? `\nClass portrait:\n${portraitText}\n` : ''}
Lesson plan (markdown):
${planText.slice(0, 12000)}`
  }], {
    trackLabel: 'runOfShow',
    jsonMode: true,
    systemPrompt: `You are an expert Singapore-school lesson stager. Given a lesson plan in markdown, break it into 3-7 chronological segments a teacher can run in class, from opening to closure.

Rules:
- ${durationLine}
- "name" is a short segment title (2-5 words).
- "activity" is a 1-line teacher-facing summary of what happens in the segment.
- "studentInstructions" is 1-3 short imperative student-facing sentences (what students should do). No teacher jargon, no framework names, and never reveal answers.
- "groupingMode" is exactly one of: individual | pairs | groups | whole-class.
- "e21ccFocus" is OPTIONAL: when a segment clearly develops one 21st-century competency, set it to exactly one of: criticalThinking | creativeThinking | communication | collaboration | socialConnectedness | selfRegulation. Omit it when no single competency stands out.
- "teachingArea" is the Singapore Teaching Practice Lesson-Enactment area the segment enacts — exactly one of: ${TEACHING_AREA_KEYS.join(' | ')}. Opening segments lean activate_prior or arouse_interest; the main body encourage_engage, deepen_questions or collaborative; the closure conclude.
- "teachingAction" is OPTIONAL — when a clear pedagogical move fits the area, set it to one of that area's action ids (omit if unsure):
${stpAreasRef}
- Segments must be in chronological order and cover the whole lesson.

Return STRICT JSON only (no markdown, no commentary) in exactly this shape:
{"segments":[{"name":"Segment name","duration":10,"activity":"One-line teacher summary","studentInstructions":"Short student-facing instructions.","groupingMode":"pairs","e21ccFocus":"collaboration","teachingArea":"encourage_engage","teachingAction":"tps"}]}`,
    temperature: 0.4,
    maxTokens: 4096
  });

  return normalizeRunOfShow(raw);
}

/* Non-destructive STP tagging of EXISTING segments. Given the current segments,
 * returns a Map<index, { teachingArea, teachingAction }> of suggestions —
 * WITHOUT rewriting names / activities / instructions. Powers the "Map to STP"
 * retrofit so lessons authored before STP tags existed can adopt them; the
 * teacher reviews the suggestions in the editor before saving. */
export async function mapSegmentsToSTP(segments = []) {
  const list = (Array.isArray(segments) ? segments : []).filter(s => s && typeof s === 'object');
  if (list.length === 0) throw new Error('No segments to map.');
  const brief = list.map((s, i) =>
    `${i}. ${String(s.name || `Segment ${i + 1}`)} — ${String(s.activity || s.studentInstructions || '').slice(0, 200)}`
  ).join('\n');
  const stpAreasRef = TEACHING_AREAS
    .map(a => `  ${a.key} (${a.label}): ${actionsForArea(a.key).map(x => x.id).join(', ')}`)
    .join('\n');

  const raw = await sendChat([{
    role: 'user',
    content: `Classify each existing lesson segment onto the Singapore Teaching Practice.\n\nSegments:\n${brief}`
  }], {
    trackLabel: 'mapToSTP',
    jsonMode: true,
    systemPrompt: `You map existing lesson segments onto the Singapore Teaching Practice (Lesson Enactment). For EACH segment index, choose the best-fitting "teachingArea" (exactly one key) and, when a clear move fits, a "teachingAction" id from that area (omit if unsure). Do NOT rewrite the segments — only classify.

Areas and their action ids:
${stpAreasRef}

Guidance: opening segments lean activate_prior or arouse_interest; the main body encourage_engage, deepen_questions or collaborative; the closure conclude.

Return STRICT JSON only (no markdown, no commentary), one entry per segment in order, in exactly this shape:
{"tags":[{"index":0,"teachingArea":"arouse_interest","teachingAction":"real_world"}]}`,
    temperature: 0.3,
    maxTokens: 2048
  });

  const data = (typeof raw === 'string') ? parseJsonResponse(raw, 'STP tags') : raw;
  const tags = Array.isArray(data?.tags) ? data.tags : (Array.isArray(data) ? data : []);
  const byIndex = new Map();
  tags.forEach(t => {
    if (!t || typeof t !== 'object') return;
    const idx = Number(t.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
    const area = TEACHING_AREA_KEYS.includes(t.teachingArea) ? t.teachingArea : null;
    if (!area) return;
    const validIds = actionsForArea(area).map(a => a.id);
    const action = (typeof t.teachingAction === 'string'
      && (validIds.includes(t.teachingAction) || t.teachingAction === TEACHING_ACTION_OTHER)) ? t.teachingAction : null;
    byIndex.set(idx, { teachingArea: area, teachingAction: action });
  });
  return byIndex;
}

/* ── YouTube Recommendations ── */
export async function suggestYouTubeVideos(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Suggest YouTube videos that would support this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'suggestYouTubeVideos',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's YouTube specialist for Singapore educators. You have deep knowledge of educational YouTube content. Recommend specific, real YouTube videos that teachers can use.

IMPORTANT: You MUST suggest exactly 6–8 videos. YouTube has millions of educational videos — there are always enough relevant ones to find.

Guidelines:
- Suggest 6–8 specific YouTube videos that are directly relevant
- For EACH video, you MUST provide a YouTube search link as a SINGLE-LINE markdown link:
  [Video Title - Channel Name](https://www.youtube.com/results?search_query=ENCODED+QUERY)
  CRITICAL: The entire [label](url) MUST be on ONE line — no line breaks inside the brackets or parentheses.
  Replace spaces with + signs in the search query. Keep queries SHORT (max 8 words).
- Use specific search queries that will find the exact video (include channel name in query)
- Categorise videos into: "Show in Class" (3-4), "Flipped Learning" (2-3), "Teacher Prep" (1-2)
- Prefer well-known educational channels: CrashCourse, Veritasium, 3Blue1Brown, TED-Ed, Khan Academy, Professor Dave Explains, Organic Chemistry Tutor, Kurzgesagt, MinutePhysics, SmarterEveryDay, Mathologer, Numberphile, Tyler DeWitt, Bozeman Science, Amoeba Sisters, Stated Clearly, Science ABC, Physics Girl, Mr Thong (SG), SLS resources
- Consider Singapore curriculum alignment (O-Level, N-Level, IP) where relevant
- Include estimated duration if known

Format EXACTLY like this:

## Recommended YouTube Videos

### Show in Class
1. **Video title here**
   Channel: Channel Name | Duration: ~X min
   [Search: Video title Channel Name](https://www.youtube.com/results?search_query=video+title+channel+name)
   Why: Brief explanation of how it fits the lesson

2. **Next video title**
   Channel: Channel Name | Duration: ~X min
   [Search: Next video title Channel Name](https://www.youtube.com/results?search_query=next+video+title+channel+name)
   Why: Brief explanation

(continue with 3-4 videos in this section)

### Flipped Learning / Homework
(2-3 videos in same format)

### Teacher Preparation
(1-2 videos in same format)

## Tips for Using Videos
- 2-3 quick tips (pause-and-discuss, note-taking, predict-then-watch)

You MUST include at least 6 videos total with YouTube search links. Be specific — name actual titles and channels you are confident exist.`,
    temperature: 0.7,
    maxTokens: 8192
  });
}

/* ── Simulation Model Recommendations ── */
export async function suggestSimulations(planText, subject, level) {
  // Built-in simulation catalogue for matching
  const BUILT_IN_SIMS = [
    { id: 'diffusion', title: 'Diffusion', subject: 'Biology', path: 'simulations/biology/diffusion/index.html' },
    { id: 'enzyme-activity', title: 'Enzyme Activity', subject: 'Biology', path: 'simulations/biology/enzyme-activity/index.html' },
    { id: 'food-tests', title: 'Food Tests', subject: 'Biology', path: 'simulations/biology/food-tests/index.html' },
    { id: 'microscopy', title: 'Microscopy & Cell Drawing', subject: 'Biology', path: 'simulations/biology/microscopy/index.html' },
    { id: 'osmosis', title: 'Osmosis', subject: 'Biology', path: 'simulations/biology/osmosis/index.html' },
    { id: 'photosynthesis', title: 'Photosynthesis', subject: 'Biology', path: 'simulations/biology/photosynthesis/index.html' },
    { id: 'chromatography', title: 'Paper Chromatography', subject: 'Chemistry', path: 'simulations/chemistry/chromatography/index.html' },
    { id: 'electrolysis', title: 'Electrolysis', subject: 'Chemistry', path: 'simulations/chemistry/electrolysis/index.html' },
    { id: 'gas-tests', title: 'Gas Tests', subject: 'Chemistry', path: 'simulations/chemistry/gas-tests/index.html' },
    { id: 'qualitative-analysis', title: 'Qualitative Analysis', subject: 'Chemistry', path: 'simulations/chemistry/qualitative-analysis/index.html' },
    { id: 'rates-of-reaction', title: 'Rates of Reaction', subject: 'Chemistry', path: 'simulations/chemistry/rates-of-reaction/index.html' },
    { id: 'salts', title: 'Preparation of Salts', subject: 'Chemistry', path: 'simulations/chemistry/salts/index.html' },
    { id: 'titration', title: 'Acid-Base Titration', subject: 'Chemistry', path: 'simulations/chemistry/titration/index.html' },
    { id: 'density', title: 'Density', subject: 'Physics', path: 'simulations/physics/density/index.html' },
    { id: 'electromagnets', title: 'Electromagnets', subject: 'Physics', path: 'simulations/physics/electromagnets/index.html' },
    { id: 'lenses', title: 'Lenses & Light', subject: 'Physics', path: 'simulations/physics/lenses/index.html' },
    { id: 'ohms-law', title: "Ohm's Law", subject: 'Physics', path: 'simulations/physics/ohms-law/index.html' },
    { id: 'pendulum', title: 'Pendulum & Oscillations', subject: 'Physics', path: 'simulations/physics/pendulum/index.html' },
    { id: 'specific-heat', title: 'Specific Heat Capacity', subject: 'Physics', path: 'simulations/physics/specific-heat/index.html' },
    { id: 'waves', title: 'Waves & Ripple Tank', subject: 'Physics', path: 'simulations/physics/waves/index.html' }
  ];

  const simList = BUILT_IN_SIMS.map(s => `- ${s.title} (${s.subject})`).join('\n');

  const messages = [{
    role: 'user',
    content: `Suggest simulation models that would support this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  // Build a lookup for post-processing built-in sim links
  const simLookup = {};
  BUILT_IN_SIMS.forEach(s => { simLookup[s.id] = s; });

  const raw = await sendChat(messages, {
    trackLabel: 'suggestSimulations',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's simulation specialist for Singapore educators. Recommend interactive simulations for lessons.

## Built-In Simulations (Co-Cher)
These are ALREADY in the app. Use the EXACT ID in square brackets when recommending:
${BUILT_IN_SIMS.map(s => `- [SIM:${s.id}] ${s.title} (${s.subject})`).join('\n')}

## External Platforms (use DIRECT URLs)
- **PhET**: https://phet.colorado.edu/en/simulations/[sim-name]
- **GeoGebra**: https://www.geogebra.org/search/[topic]
- **Desmos**: https://www.desmos.com/calculator or https://teacher.desmos.com
- **Falstad**: https://www.falstad.com/circuit/ (circuits)
- **ChemCollective**: https://chemcollective.org/vlabs
- **LabXchange**: https://www.labxchange.org/library

## CRITICAL RULES
- ONLY include sections that apply. Do NOT include both "Built-In" and "No Match" for the same topic.
- If a built-in sim matches → include "Co-Cher Simulations" section
- If external sims match → include "External Simulations" section
- ONLY if NO simulations match at all → include "Build Your Own" section
- Never say "we couldn't find" if you listed simulations above

## Format

### Co-Cher Simulations
(ONLY if a built-in simulation matches the lesson topic)
1. **[Simulation Title]** [SIM:simulation-id]
   How to use: [1-2 sentences — demo, exploration, pre-lab, etc.]

### External Simulations
(ONLY if you can provide a direct URL)
1. **[Simulation Title]**
   Platform: [name]
   [Open Simulation](https://direct-url-here)  ← MUST be single line, no line breaks inside
   How to use: [1-2 sentences]

### Build Your Own
(ONLY if no built-in or external simulation matches)
No ready-made simulation matches this specific topic. You can build one:
> "Help me build an interactive HTML5 simulation for [topic]. It should let students [interactions]. Include sliders for [variables] and a visual output showing [display]."

### Integration Tips
- 2-3 practical tips (predict-observe-explain, guided inquiry, etc.)`,
    temperature: 0.5,
    maxTokens: 4096
  });

  // Post-process: replace [SIM:id] tags with clickable launch links
  let result = raw;
  result = result.replace(/\[SIM:([a-z0-9-]+)\]/gi, (match, simId) => {
    const sim = simLookup[simId.toLowerCase()];
    if (sim) {
      return `[▶ Launch in Co-Cher](${sim.path})`;
    }
    return match;
  });

  return result;
}

/* ── Worksheet / Handout Generator ── */
export async function generateWorksheet(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate a student worksheet/handout for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateWorksheet',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's worksheet designer for Singapore educators. Create a CONCISE worksheet SCAFFOLD — the skeleton the teacher reviews in seconds, expandable on demand.

Guidelines:
- Add a header with: Lesson Title, Name: ___, Class: ___, Date: ___
- 2-3 clearly-headed sections (### headings), progressing from recall to application/analysis
- 6-8 questions total, each question exactly ONE line; mix types (fill-in-the-blank, short answer, diagram labelling, calculation, structured response)
- Use short space indicators like [Space for answer] or [Draw diagram here] — one line, never mock up the space
- One bonus/extension question for advanced students (ONE line)
- End EACH section with an expansion marker line: [EXPAND: Details|<section-slug>] where <section-slug> is the section heading in kebab-case (e.g. "### Apply and Analyse" → apply-and-analyse). These are buttons the teacher clicks to expand that section (fuller item stems, answer guidance) on demand — keep the syntax exactly and do NOT write the expanded content yourself
- No answer keys, no model responses, no long stimulus passages inline
- Align with Singapore O/N-Level or IP curriculum where possible; instructions student-friendly

Clean printable markdown. The whole worksheet must end complete — never truncated.`,
    temperature: 0.6,
    maxTokens: 2048
  });
}

/* ── Discussion Prompts Generator ── */
export async function generateDiscussionPrompts(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate discussion prompts and thinking questions for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateDiscussionPrompts',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's discussion facilitator for Singapore educators. Generate a TIGHT scaffold of discussion prompts — questions only, one line each, no facilitator prose inline.

Format:

## Opening Questions
2 questions to spark curiosity — ONE line each.
[EXPAND: Details|opening-questions]

## Core Discussion Questions
3-4 questions laddered from recall → application → analysis/evaluation — ONE line each, cognitive level named in italics at the end (e.g. *analysis*).
[EXPAND: Details|core-discussion-questions] [EXPAND: Model answer|core-discussion-questions]

## Think-Pair-Share Prompts
1-2 prompts suited to pair talk — ONE line each.
[EXPAND: Details|think-pair-share-prompts]

## Reflection / Closing Questions
1-2 end-of-lesson prompts — ONE line each.
[EXPAND: Details|reflection-closing-questions]

Rules: no facilitator notes, expected responses, or tips inline — the [EXPAND: …|<slug>] markers are buttons the teacher clicks to expand a block (facilitation moves, responses to look for) on demand; keep their syntax exactly, one marker line at the end of each section. Ground every question in the actual lesson content.`,
    temperature: 0.7,
    maxTokens: 2048
  });
}

/* ── External Resources Recommender ── */
export async function suggestExternalResources(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Suggest external educational resources for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'suggestExternalResources',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's resource curator for Singapore educators. Recommend high-quality external educational resources that can enhance the lesson.

Suggest resources from these categories:

## Interactive Tools & Simulations
- PhET (phet.colorado.edu) — physics, chemistry, biology, math simulations
- GeoGebra — math visualisations and constructions
- Desmos — graphing calculator and activities
- ChemCollective — virtual labs
- Falstad — circuit simulators, physics applets
- LabXchange — Harvard's virtual lab platform

## Reference & Content
- Khan Academy — video explanations and practice
- BBC Bitesize — curriculum-aligned content
- CK-12 — free textbooks and simulations

## Singapore-Specific
- Student Learning Space (SLS) — MOE's e-learning portal
- Singapore Examinations and Assessment Board resources

## Classroom Tools
- Padlet, Mentimeter, Kahoot, Nearpod — engagement tools
- Google Arts & Culture — visual resources
- Canva for Education — student creation

For each resource:
1. **[Resource name]**
   Platform: [Name]
   Search: \`[search query to find the specific resource]\`
   Best for: [1 sentence on how it supports the lesson]
   Free: Yes/No/Freemium

Include 6-10 resources total. Prioritise free and curriculum-aligned options.`,
    temperature: 0.6,
    maxTokens: 2048
  });
}

/* ── Learning Intentions & Success Criteria Generator ── */
export async function generateLISC(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate Learning Intentions and Success Criteria for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateLISC',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's curriculum design specialist for Singapore educators. Generate clear, measurable Learning Intentions (LI) and Success Criteria (SC) for lessons.

## Pedagogical Framework
Learning Intentions articulate WHAT students will learn (not what they will DO). Success Criteria describe HOW students will demonstrate their learning. Both must be written in student-friendly language.

## E21CC Integration
For EACH Learning Intention, identify which E21CC domain(s) it primarily develops:
- **CAIT** (Critical, Adaptive & Inventive Thinking): analysis, evaluation, creative problem-solving
- **CCI** (Communication, Collaboration & Information): teamwork, articulation, digital literacy
- **CGC** (Civic, Global & Cross-cultural Literacy): perspective-taking, social awareness, ethical reasoning

## Curriculum Ideology Lens (Optional Framing)
Offer the teacher a brief note on how the lesson can be framed through different ideological orientations:
- **Scholar-Academic**: Emphasises mastery of disciplinary knowledge and conceptual understanding
- **Learner-Centred**: Centres student interests, choice, and personal meaning-making
- **Social Efficiency**: Focuses on practical skills and real-world application and competency
- **Social Reconstructivist**: Addresses equity, justice, and using knowledge to improve society

## EdTech Masterplan 2030 Alignment
Where relevant, note how technology can amplify the LI/SC — e.g. collaborative platforms for CCI, data tools for CAIT, digital storytelling for CGC.

## Format (CONCISE SCAFFOLD — one-line entries throughout)

### Learning Intention
We are learning to [ONE clear student-friendly statement].
[EXPAND: Details|learning-intention]

### Success Criteria
I can...
1. [Observable criterion, ONE line] — *[CAIT/CCI/CGC]*
2. [Observable criterion, ONE line] — *[E21CC domain]*
3. [Observable criterion, ONE line] — *[E21CC domain]*
4. [Stretch criterion, ONE line] — *[E21CC domain]*
[EXPAND: Details|success-criteria] [EXPAND: Exemplar|success-criteria]

### E21CC Focus
**Primary:** [CAIT/CCI/CGC] — [one clause]. **Secondary:** [domain] — [one clause].

### Curriculum Framing Options
One line per orientation (Scholar-Academic / Learner-Centred / Social Efficiency / Social Reconstructivist) — a short clause each, only where genuinely distinct.
[EXPAND: Details|curriculum-framing-options]

### Formative Check Questions
1. [Mid-lesson check, ONE line]
2. [Mid-lesson check, ONE line]
3. [Deeper plenary/exit question, ONE line]
[EXPAND: Model answer|formative-check-questions]

Generate 1 primary Learning Intention (extension LI only for double periods). 3-4 Success Criteria from foundational to stretch. Student-friendly language throughout — a Secondary student should understand every word. No elaboration paragraphs inline: the [EXPAND: …|<slug>] markers are buttons the teacher clicks to expand a block on demand — keep their syntax exactly.`,
    temperature: 0.6,
    maxTokens: 2048
  });
}

/* ── EEE: Stimulus Material Generator (Languages, Humanities, GP) ── */
export async function generateStimulusMaterial(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate stimulus material for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateStimulusMaterial',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's stimulus material specialist for Singapore educators. Create rich, engaging stimulus texts and materials for classroom use.

Generate materials appropriate for the subject:
- **Languages (EL/CL/ML/TL):** Comprehension passages, composition prompts, situational writing scenarios, oral discussion topics, visual stimuli descriptions
- **Humanities (History/SS/Geography):** Primary/secondary sources, data extracts, case studies, newspaper-style articles, map descriptions
- **General Paper / GP:** Argumentative passages, contrasting viewpoints, real-world scenario briefs
- **Other subjects:** Contextual problem scenarios, case studies, real-world applications

## Format

### Stimulus Material

**Type:** [Passage / Source / Case Study / Scenario / Visual Description]
**Suitable for:** [Activity type — comprehension, discussion, analysis, writing, etc.]

---

[The actual stimulus text — 150-400 words, age-appropriate, engaging]

---

### Suggested Questions
1. [Literal/recall question]
2. [Inferential question] — *E21CC: CAIT*
3. [Evaluative/application question] — *E21CC: CAIT/CGC*
4. [Personal response / extension question] — *E21CC: CCI/CGC*

### Teacher Notes
- Key vocabulary to pre-teach
- Differentiation suggestions (simplified version / extension)
- How to use: [individual → pair → class discussion / jigsaw / gallery walk]

Create material that is culturally relevant to Singapore where possible. Use Markdown formatting.`,
    temperature: 0.7,
    maxTokens: 4096
  });
}

/* ── EEE: Vocabulary Builder (Languages, all subjects) ── */
export async function generateVocabulary(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate vocabulary support materials for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateVocabulary',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's vocabulary specialist for Singapore educators. Create structured vocabulary materials that build academic language proficiency.

## Generate

### Key Vocabulary Wall
| Term | Definition | Example in Context | Word Class |
|------|-----------|-------------------|------------|
(8-15 terms, sorted from foundational to advanced)

### Sentence Frames
Provide 4-6 sentence frames students can use to express ideas using the key vocabulary:
- "The [concept] demonstrates that..."
- "By comparing [X] and [Y], we can infer..."
(Adapt frames to the subject — scientific explanation frames for Science, analytical frames for Humanities, etc.)

### Cloze Passage
A short paragraph (80-120 words) using the key terms, with blanks for students to fill in. Provide answer key separately.

### Word Relationships
- Synonyms / antonyms for key terms
- Subject-specific vs everyday meaning (e.g., "cell" in Biology vs daily use)
- Etymology or word parts where helpful

### Differentiation
- **Support:** Simplified definitions, visual cues, L1 translation hints
- **Extension:** Use terms in analytical writing, create own sentences, identify terms in authentic texts

Tag each vocabulary item with the E21CC domain it supports (CCI for communication terms, CAIT for analytical terms, CGC for perspective terms).

If the teacher requests flashcards, add a section:

## Flashcards
For each key term, output in this exact format (one per term):
CARD: [term]
BACK: [definition] | [example in context] | [word class]
---

Generate 8-15 flashcard entries matching the vocabulary wall terms.`,
    temperature: 0.6,
    maxTokens: 3072
  });
}

/* ── EEE: Model Response Generator (Languages, Humanities) ── */
export async function generateModelResponse(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate an annotated model response for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateModelResponse',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's model response specialist for Singapore educators. Create annotated model answers that help students understand what good work looks like.

## Generate

### Task Description
[Restate the task/question the model response addresses]

### Model Response
[Write a high-quality response appropriate to the level — typically 200-500 words]

### Annotations
Use **bold markers** within the model response and explain them below:

| Marker | Technique Used | Why It Works |
|--------|---------------|-------------|
| **[A]** | [e.g., Topic sentence, PEEL structure, evidence citation] | [Why this is effective] |
| **[B]** | [e.g., Counter-argument, data reference, linking back] | [Why this is effective] |
(Continue for 4-6 key techniques)

### Success Criteria Checklist
- [ ] [Criterion 1 — what makes this response strong]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [Criterion 4]

### Common Pitfalls
- [What students typically get wrong and how to avoid it]
- [Another common mistake]

### How to Use in Class
1. **I Do:** Teacher walks through model, highlighting annotations
2. **We Do:** Class identifies techniques in a second example together
3. **You Do:** Students attempt their own response using the checklist
— *E21CC: CAIT (analysis of quality), CCI (articulation of ideas)*

Adapt the format to the subject: essay structure for Languages/Humanities, worked solution for Maths/Science, performance criteria for Arts/PE.`,
    temperature: 0.6,
    maxTokens: 4096
  });
}

/* ── EEE: Source Analysis (History, Social Studies, GP) ── */
export async function generateSourceAnalysis(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate source-based questions for this lesson:\n\n${planText}\n\nSubject: ${subject || 'History'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    trackLabel: 'generateSourceAnalysis',
    trackDetail: [subject, level].filter(Boolean).join(' '),
    systemPrompt: `You are Co-Cher's source analysis specialist for Singapore educators. Create structured source-based question sets aligned with Singapore's inquiry-based approach.

## Generate

### Source A: [Title/Description]
**Type:** [Written / Visual / Statistical / Cartographic]
**Provenance:** [Author, date, context — real or constructed]

[The source text/description — 100-250 words]

### Source B: [Title/Description]
**Type:** [Written / Visual / Statistical]
**Provenance:** [Author, date, context]

[Second source — contrasting perspective or complementary evidence]

### Questions

**Inference** (from Source A)
1. What can you infer from Source A about [topic]? Explain your answer. [4m]
   *Skill: Making inferences with evidence — E21CC: CAIT*

**Comparison**
2. How do Sources A and B differ in their view of [topic]? [5m]
   *Skill: Identifying & explaining differences — E21CC: CAIT, CGC*

**Reliability / Usefulness**
3. How useful is Source [A/B] in understanding [topic]? Explain with reference to its provenance and content. [5m]
   *Skill: Evaluating source utility — E21CC: CAIT, CGC*

**Cross-referencing**
4. Does Source B support the evidence in Source A? Explain. [5m]
   *Skill: Cross-referencing for agreement/disagreement — E21CC: CAIT*

**Assertion / Judgement**
5. "[Statement about the topic]." Using the sources and your own knowledge, explain how far you agree with this statement. [8m]
   *Skill: Constructing balanced argument — E21CC: CAIT, CCI, CGC*

### Mark Scheme Guidance
- L1: Describes / copies from source
- L2: Makes valid inference with supporting evidence
- L3: Explains with contextual knowledge and evaluation

### Teacher Notes
- Scaffolding: Provide sentence starters for weaker students
- Extension: Students create their own source and questions
- Discussion protocol: Think-Pair-Share for inference, Fishbowl for assertion

Align with Singapore's SBQ (Source-Based Questions) or SEQ format where applicable.`,
    temperature: 0.6,
    maxTokens: 4096
  });
}

/* ── Image generation (Gemini image model, same key) ──
 * Returns a data: URL. Image calls burn free-tier quota quickly, so
 * callers keep this opt-in. Fails with a clear message when the key or
 * tier has no image access. */
export async function generateImage(prompt, options = {}) {
  trackEvent('ai', 'generate', 'image', options.trackDetail || '');
  const apiKey = Store.get('apiKey');
  if (!apiKey) {
    throw new Error('No API key configured. Please add your Gemini API key in Settings.');
  }
  const model = 'gemini-2.5-flash-image';
  const res = await fetchWithRetry(`${ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
  }, { timeoutMs: options.timeoutMs });
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      throw new Error('Image generation is not available on this API key or model tier.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(friendlyApiError(res.status, err?.error?.message || `API error ${res.status}`));
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find(p => p.inlineData?.data);
  if (!img) throw new Error('No image returned — the model may have declined this prompt.');
  return `data:${img.inlineData.mimeType || 'image/png'};base64,${img.inlineData.data}`;
}

/* ── SVG concept diagrams (text model — free, printable, crisp) ── */
export async function generateSVGDiagram(description) {
  const text = await sendChat(
    [{ role: 'user', content: `Create a labelled concept diagram for: ${description}` }],
    {
      trackLabel: 'svgDiagram',
      systemPrompt: 'You produce ONE self-contained SVG diagram for classroom use. Output ONLY the <svg>…</svg> element: viewBox="0 0 800 500", white or transparent background, clear boxes/arrows, legible sans-serif labels 14-18px, accessible colour contrast, no scripts, no external references, no images. Educationally accurate.',
      temperature: 0.4,
      maxTokens: 6000
    }
  );
  const m = text.match(/<svg[\s\S]*<\/svg>/i);
  if (!m) throw new Error('No diagram returned — try rephrasing the topic.');
  return m[0];
}

/* ── Critical Friend ──
 * Critiques a plan through a chosen curriculum ideology. Returns markdown:
 * pointed questions + one trade-off + one concrete move. The voice is a
 * trusted colleague with a red pen, not a cheerleader. */
const IDEOLOGY_LENSES = {
  'learner-centred': 'Learner-Centred: student agency, interests, choice, self-direction. Ask whose curiosity drives each segment.',
  'scholar-academic': 'Scholar-Academic: disciplinary rigour, canonical knowledge, intellectual tradition. Ask where the discipline\'s real thinking happens.',
  'social-efficiency': 'Social Efficiency: clear outcomes, transferable skills, readiness. Ask what students can DO afterwards and how you would know.',
  'social-reconstructivist': 'Social Reconstructivist: justice, voice, critical consciousness. Ask whose perspectives are present, absent, or unchallenged.'
};

export async function critiquePlan(planText, ideology) {
  const lens = IDEOLOGY_LENSES[ideology] || 'Balanced: weigh all four curriculum orientations and challenge the weakest dimension of the plan.';
  return sendChat(
    [{ role: 'user', content: `Critique this lesson plan through the lens below.\n\nLENS: ${lens}\n\nPLAN:\n${planText.slice(0, 6000)}` }],
    {
      trackLabel: 'criticalFriend',
      systemPrompt: `You are the teacher's critical friend — a trusted, seasoned colleague reviewing a lesson plan with a red pen. Be pointed but collegial; critique the PLAN, never the teacher. Output EXACTLY this markdown structure and nothing else:

### Three questions worth sitting with
1. (a pointed question the plan does not answer)
2. (a second, different angle)
3. (the bravest question — the one a polite colleague would not ask)

### The trade-off you're making
(2-3 sentences naming what this plan gains and what it silently gives up)

### One concrete move
(a single, specific, doable change — not a list)`,
      temperature: 0.7,
      maxTokens: 1200
    }
  );
}

/* ══════════ WS-4 Materials: slide decks + audio clips ══════════ */

/* ── Slide deck generation (text model, jsonMode) ──
 * Produces the normalized deck shape utils/deck.js compiles:
 * { title, slides: [{ title, bullets: [≤4 short strings], notes }] } */
export async function generateDeck({ plan, lessonTitle, className, slideTarget = 8 } = {}) {
  const target = Math.min(12, Math.max(5, Math.round(Number(slideTarget) || 8)));
  const raw = await sendChat([{
    role: 'user',
    content: `Create a classroom slide deck for this lesson.
Lesson title: ${String(lessonTitle || 'Lesson').slice(0, 200)}
${className ? `Class: ${String(className).slice(0, 100)}\n` : ''}Target length: about ${target} slides.

Lesson plan:
${String(plan ?? '').slice(0, 8000)}`
  }], {
    trackLabel: 'generateDeck',
    jsonMode: true,
    temperature: 0.6,
    maxTokens: 6144,
    systemPrompt: `You are a senior instructional designer creating a POLISHED, engaging projector slide deck for a Singapore classroom. Return ONLY JSON:
{"title":"deck title","slides":[{"layout":"...","title":"...","subtitle":"...","bullets":["..."],"icon":"...","columns":[{"heading":"...","items":["..."]}],"statement":"...","quote":"...","attribution":"...","chart":{"type":"bar|line|donut","title":"...","data":[{"label":"...","value":12}]},"svgPrompt":"...","imagePrompt":"...","notes":"..."}]}

Design rules:
- 6-12 slides. VARY "layout" so the deck never reads as a wall of bullets. Layouts:
  · "title" — opening slide (lesson title + learning intentions as bullets). Use for slide 1.
  · "section" — a short divider announcing a new phase of the lesson.
  · "bullets" — a heading + up to 4 short points (the default).
  · "columns" — 2-3 labelled columns for compare/contrast, for/against, then/now (use the "columns" array).
  · "statement" — ONE big idea, key definition or takeaway, no bullets (use "statement").
  · "quote" — a quotation or a provocative question ("quote" + optional "attribution").
  · "visual" — the slide is carried by a chart/diagram/image (see below), minimal text.
  · "exit" — closing check-for-understanding / exit ticket. Use for the last slide.
- TLDR discipline: each bullet is ONE short line (≤12 words), ≤4 per slide. Slides are prompts, not paragraphs.
- ENGAGE with ONE visual on a slide ONLY where it genuinely aids understanding (not every slide):
  · "chart" — for data, quantities, proportions or trends. type bar/line/donut, 2-8 {label,value} points, short title.
  · "svgPrompt" — a one-line description of a simple concept DIAGRAM to draw (e.g. "particle diffusion from high to low concentration with arrows"). Best for processes, cycles, structures, relationships.
  · "imagePrompt" — a one-line description of a real-world IMAGE when a photo helps (e.g. "close-up of a rusting iron nail"). Use sparingly.
  · "icon" — one signpost icon from: idea, target, question, check, warning, group, experiment, book, clock, globe, chart, spark, rocket, compass.
- "notes" = one short teacher note (what to say/do), ≤20 words.
- Student-facing language on slides. No markdown syntax. Describe visuals in the *Prompt/chart fields ONLY — never paste URLs or external resources into any string.`
  });
  return normalizeDeck(parseJsonResponse(raw, 'slide deck'), lessonTitle);
}

/* Defensive normalization: coerce strings, clamp counts, whitelist layouts and
 * media fields, drop empties. Throws when fewer than 2 usable slides survive. */
const DECK_LAYOUTS = new Set(['title', 'section', 'bullets', 'columns', 'statement', 'quote', 'visual', 'exit']);
const DECK_CHART_TYPES = new Set(['bar', 'line', 'donut']);
function normalizeDeck(data, fallbackTitle) {
  const clampStr = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const normChart = (c) => {
    if (!c || typeof c !== 'object') return undefined;
    const rows = (Array.isArray(c.data) ? c.data : [])
      .map(d => ({ label: clampStr(d?.label, 28), value: Number(d?.value) }))
      .filter(d => d.label && Number.isFinite(d.value)).slice(0, 8);
    if (rows.length < 2) return undefined;
    return { type: DECK_CHART_TYPES.has(c.type) ? c.type : 'bar', title: clampStr(c.title, 80), data: rows };
  };
  const normCols = (cols) => (Array.isArray(cols) ? cols : [])
    .map(c => ({ heading: clampStr(c?.heading, 60), items: (Array.isArray(c?.items) ? c.items : []).map(x => clampStr(x, 120)).filter(Boolean).slice(0, 5) }))
    .filter(c => c.heading || c.items.length).slice(0, 3);

  const slides = (Array.isArray(data?.slides) ? data.slides : [])
    .map(s => {
      const out = {
        layout: DECK_LAYOUTS.has(s?.layout) ? s.layout : undefined,
        title: clampStr(s?.title, 120),
        subtitle: clampStr(s?.subtitle, 160) || undefined,
        bullets: (Array.isArray(s?.bullets) ? s.bullets : []).map(b => clampStr(b, 160)).filter(Boolean).slice(0, 5),
        notes: clampStr(s?.notes, 240) || undefined,
        icon: clampStr(s?.icon, 20) || undefined,
        statement: clampStr(s?.statement, 200) || undefined,
        quote: clampStr(s?.quote, 240) || undefined,
        attribution: clampStr(s?.attribution, 80) || undefined,
        chart: normChart(s?.chart),
        imagePrompt: clampStr(s?.imagePrompt, 240) || undefined,
        svgPrompt: clampStr(s?.svgPrompt, 240) || undefined,
      };
      const cols = normCols(s?.columns);
      if (cols.length) out.columns = cols;
      return out;
    })
    .filter(s => s.title || s.bullets.length || s.statement || s.quote || s.chart || s.columns)
    .slice(0, 14);
  if (slides.length < 2) {
    throw new Error('The model returned too few usable slides — please try again.');
  }
  return { title: clampStr(data?.title, 140) || clampStr(fallbackTitle, 140) || 'Slide deck', slides };
}

/* ── Podcast-style script generation (text model, jsonMode) ──
 * { title, style, turns: [{ speaker: 'A'|'B', text }] }, capped at roughly
 * minutes*150 spoken words. Styles are voice-only framings ('murder mystery
 * clip', 'news soundbite', 'dialogue', ...) — never music or sound effects. */
export async function generatePodcastScript({ topic, style, minutes = 3, speakers = 2 } = {}) {
  const mins = Math.min(5, Math.max(1, Math.round(Number(minutes) || 3)));
  const nSpeakers = Number(speakers) === 1 ? 1 : 2;
  const wordBudget = mins * 150;
  const raw = await sendChat([{
    role: 'user',
    content: `Write a short classroom audio script.
Topic: ${String(topic ?? '').slice(0, 300)}
Style: ${String(style || 'dialogue').slice(0, 60)}
Length: about ${mins} minute${mins === 1 ? '' : 's'} spoken aloud (~${wordBudget} words total).
Speakers: ${nSpeakers === 1 ? 'ONE narrator — every turn uses speaker "A"' : 'TWO voices — "A" and "B", alternating naturally'}.`
  }], {
    trackLabel: 'podcastScript',
    jsonMode: true,
    temperature: 0.8,
    maxTokens: 3072,
    systemPrompt: `You write short spoken-word scripts for classroom audio clips. Voice only — no music, no sound effects, no stage directions, ever. Return ONLY JSON in exactly this shape:
{"title": "clip title", "style": "the style", "turns": [{"speaker": "A", "text": "the exact words spoken"}]}

Rules:
- "speaker" is "A" or "B" only. Single-narrator scripts use "A" for every turn.
- Keep total spoken words within the requested budget. Short, punchy turns (1-3 sentences each).
- Style guide: 'murder mystery clip' = suspenseful investigative scene; 'news soundbite' = crisp news-report tone; 'dialogue' = natural conversation between two voices.
- "text" is exactly what is spoken aloud: no headings, no markdown, no [bracketed effects], no speaker names inside the text.
- Age-appropriate for Singapore secondary students and factually accurate on the topic.`
  });
  return normalizePodcastScript(parseJsonResponse(raw, 'audio script'), { topic, style, wordBudget, nSpeakers });
}

function normalizePodcastScript(data, { topic, style, wordBudget, nSpeakers } = {}) {
  const clampStr = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const turns = [];
  let words = 0;
  for (const t of (Array.isArray(data?.turns) ? data.turns : [])) {
    const text = clampStr(t?.text, 600);
    if (!text) continue;
    const speaker = (nSpeakers === 2 && String(t?.speaker ?? '').trim().toUpperCase().startsWith('B')) ? 'B' : 'A';
    turns.push({ speaker, text });
    words += text.split(/\s+/).length;
    // Allow a little overshoot, then stop — TTS cost scales with length.
    if (words >= (wordBudget || 450) * 1.2 || turns.length >= 40) break;
  }
  if (turns.length === 0) {
    throw new Error('The model returned an empty script — please try again.');
  }
  return {
    title: clampStr(data?.title, 140) || clampStr(topic, 140) || 'Audio clip',
    style: clampStr(data?.style, 60) || clampStr(style, 60),
    turns
  };
}

/* ── Text-to-speech (dedicated TTS model, generateImage pattern) ──
 * MUST NOT route through sendChat: normalizeModel would silently rewrite the
 * TTS model id to a text model, and sendChat hardcodes a text-mode
 * generationConfig. Own model id, own body, key via header — same shape as
 * generateImage above. The response is raw base64 PCM (audio/L16;rate=24000)
 * which <audio> cannot play, so it is wrapped in a WAV container client-side.
 */
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_DEFAULT_VOICES = { A: 'Kore', B: 'Puck' };
/* TTS synthesis of a full clip is slower than a text call — give it longer. */
const TTS_TIMEOUT_MS = 120000;

/**
 * Wrap raw 16-bit PCM (base64) in a 44-byte RIFF/WAVE header so browsers can
 * play and download it. Exported for testability.
 */
export function pcmToWavBlob(base64, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const bin = atob(String(base64 ?? ''));
  const dataLen = bin.length;
  const bytes = new Uint8Array(44 + dataLen);
  const view = new DataView(bytes.buffer);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) bytes[off + i] = s.charCodeAt(i); };
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);   // RIFF chunk size
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);            // fmt chunk size
  view.setUint16(20, 1, true);             // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLen, true);
  for (let i = 0; i < dataLen; i++) bytes[44 + i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'audio/wav' });
}

/**
 * Voice a script with Gemini TTS. turns: [{speaker:'A'|'B', text}];
 * voices: optional { A: voiceName, B: voiceName } (e.g. 'Kore', 'Puck',
 * 'Charon', 'Fenrir'). Single-speaker scripts use voiceConfig; two-speaker
 * scripts use multiSpeakerVoiceConfig with "Speaker A"/"Speaker B" labels
 * matching the joined text. Returns { blob (WAV), mimeType, durationHint }.
 */
export async function generateSpeech({ turns, voices, style, timeoutMs } = {}) {
  trackEvent('ai', 'generate', 'speech', String(style || '').slice(0, 60));
  const apiKey = Store.get('apiKey');
  if (!apiKey) {
    throw new Error('No API key configured. Please add your Gemini API key in Settings.');
  }
  const list = (Array.isArray(turns) ? turns : [])
    .map(t => ({
      speaker: String(t?.speaker ?? 'A').trim().toUpperCase().startsWith('B') ? 'B' : 'A',
      text: String(t?.text ?? '').replace(/\s+/g, ' ').trim()
    }))
    .filter(t => t.text);
  if (list.length === 0) throw new Error('Nothing to voice — the script is empty.');

  const voiceFor = (k) => ({ prebuiltVoiceConfig: { voiceName: (voices && voices[k]) || TTS_DEFAULT_VOICES[k] || 'Kore' } });
  const distinct = [...new Set(list.map(t => t.speaker))];
  const preamble = `Read this aloud${style ? ` in the style of a ${String(style).slice(0, 60)}` : ''} with natural pacing, classroom-appropriate:`;

  let text, speechConfig;
  if (distinct.length <= 1) {
    text = `${preamble}\n\n${list.map(t => t.text).join('\n\n')}`;
    speechConfig = { voiceConfig: voiceFor(distinct[0] || 'A') };
  } else {
    text = `${preamble}\n\n${list.map(t => `Speaker ${t.speaker}: ${t.text}`).join('\n')}`;
    speechConfig = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: distinct.map(s => ({ speaker: `Speaker ${s}`, voiceConfig: voiceFor(s) }))
      }
    };
  }

  const res = await fetchWithRetry(`${ENDPOINT}/${TTS_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig
      }
    })
  }, { timeoutMs: timeoutMs ?? TTS_TIMEOUT_MS });
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      throw new Error('AI voice generation is not available on this API key or model tier.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(friendlyApiError(res.status, err?.error?.message || `API error ${res.status}`));
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const audio = parts.find(p => p.inlineData?.data);
  if (!audio) throw new Error('No audio returned — the model may have declined this script.');
  // mimeType is typically 'audio/L16;codec=pcm;rate=24000' — parse the rate.
  const rateMatch = /rate=(\d+)/.exec(audio.inlineData.mimeType || '');
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  const blob = pcmToWavBlob(audio.inlineData.data, sampleRate);
  const durationHint = Math.max(1, Math.round((blob.size - 44) / (sampleRate * 2)));
  return { blob, mimeType: 'audio/wav', durationHint };
}

export function validateApiKey(key) {
  return key && key.trim().length >= 20;
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast and capable (recommended)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Most capable, slower' }
];
