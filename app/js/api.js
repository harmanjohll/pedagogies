/*
 * Co-Cher API Layer
 * =================
 * Gemini API integration for lesson planning chat.
 */

import { Store } from './state.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `You are Co-Cher, a warm, knowledgeable AI teaching assistant designed for Singapore educators. You help teachers with lesson experience considerations, lesson design, and planning.

Your expertise includes:
- Singapore MOE frameworks: E21CC (21st Century Competencies), STP (Singapore Teaching Practice), EdTech Masterplan 2030
- Lesson design using Understanding by Design (UbD) and 5E instructional model
- Spatial classroom design — how physical arrangement supports pedagogy
- Differentiated instruction and inclusive teaching strategies
- Assessment for understanding (formative & summative)

E21CC Framework Domains:
- CAIT: Critical, Adaptive & Inventive Thinking
- CCI: Communication, Collaboration & Information
- CGC: Civic, Global & Cross-cultural Literacy
Core Values: Respect, Responsibility, Resilience, Integrity, Care, Harmony
SEL Outcomes: Self-Awareness, Self-Management, Social Awareness, Relationship Management, Responsible Decision-Making

Guidelines:
1. Be warm, encouraging, and collegial — you are a co-teacher, not an authority
2. Give classroom-ready, practical suggestions
3. Reference Singapore MOE frameworks naturally when relevant
4. Offer 2-3 options when the teacher needs to make a design decision (avoid choice paralysis)
5. Think about the whole lesson experience — how students feel, move, interact, and learn
6. When discussing spatial design, consider sightlines, mobility, flexibility, and grouping modes
7. Keep responses focused and concise — teachers are busy professionals
8. Use markdown formatting for clarity (headers, bullets, bold)

Respond conversationally. Help the teacher think through their lesson experience holistically.`;

export async function sendChat(messages, options = {}) {
  const apiKey = Store.get('apiKey');
  const model = Store.get('model') || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error('No API key configured. Please add your Gemini API key in Settings.');
  }

  const systemPrompt = options.systemPrompt || SYSTEM_PROMPT;
  const temperature = options.temperature ?? 0.8;
  const maxTokens = options.maxTokens ?? 4096;

  let body;

  if (options.jsonMode) {
    // JSON mode: match the proven pattern from the original spatial planner.
    // Embed system prompt in the user message (no systemInstruction) and
    // only set responseMimeType — this is what Gemini reliably responds to.
    const userText = messages.map(m => m.content).join('\n\n');
    const combined = `${systemPrompt}\n\nUser request:\n${userText}`;
    body = {
      contents: [{ role: 'user', parts: [{ text: combined }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
  } else {
    // Normal text mode: use systemInstruction for richer conversations
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }]
    }));
    body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    };
  }

  const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    throw new Error(msg);
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
    systemPrompt: 'You are a helpful assistant that summarizes teacher class notes concisely. Use bullet points. Focus on actionable insights and recurring themes. Keep it brief (3-5 bullet points).',
    temperature: 0.4,
    maxTokens: 1024
  });
}

/* ── AI Lesson Review ── */
export async function reviewLesson(planText) {
  const messages = [{
    role: 'user',
    content: `Please review this lesson plan and provide constructive feedback:\n\n${planText}`
  }];

  return sendChat(messages, {
    systemPrompt: `You are Co-Cher's lesson review assistant for Singapore educators. Analyse lesson plans against:
- E21CC alignment (CAIT, CCI, CGC) — which domains are addressed, which could be strengthened
- STP alignment — lesson preparation, enactment, monitoring/feedback, positive culture
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
    maxTokens: 2048
  });
}

/* ── Generate Rubric ── */
export async function generateRubric(lessonTopic, level, subject) {
  const messages = [{
    role: 'user',
    content: `Create an assessment rubric for: ${lessonTopic}\nLevel: ${level || 'Secondary'}\nSubject: ${subject || 'General'}`
  }];

  return sendChat(messages, {
    systemPrompt: `You are Co-Cher's assessment specialist for Singapore educators. Generate clear, practical rubrics.

Format rubrics as markdown tables with:
- 3-4 criteria rows
- 4 achievement levels: Exemplary | Proficient | Developing | Beginning
- Each cell should have a brief descriptor (1-2 sentences)
- Include E21CC domains where relevant
- Make criteria observable and measurable

End with a brief "Teacher Notes" section with tips on using the rubric.`,
    temperature: 0.5,
    maxTokens: 2048
  });
}

/* ── Student Grouping ── */
export async function suggestGrouping(students, activityType, options = {}) {
  const groupSize = options.groupSize || 4;
  const considerations = options.considerations || '';

  const studentSummary = students.map((s, i) =>
    `${i + 1}. ${s.name}: CAIT=${s.e21cc?.cait || 50}, CCI=${s.e21cc?.cci || 50}, CGC=${s.e21cc?.cgc || 50}`
  ).join('\n');

  const totalStudents = students.length;
  const expectedGroups = Math.ceil(totalStudents / groupSize);

  let userContent = `Create student groupings for: ${activityType}
Preferred group size: ${groupSize} students per group (approximately ${expectedGroups} groups)
Total students: ${totalStudents}

${considerations ? `Teacher's additional considerations:\n${considerations}\n\n` : ''}Students and their E21CC profiles:
${studentSummary}`;

  const messages = [{ role: 'user', content: userContent }];

  return sendChat(messages, {
    systemPrompt: `You are Co-Cher's grouping specialist for Singapore educators. Suggest student groups based on E21CC profiles, the activity type, and teacher considerations.

CRITICAL RULES:
- You MUST assign EVERY student to exactly one group. No student may be left out.
- There are exactly ${totalStudents} students. Your groups must account for all ${totalStudents}.
- Target ${groupSize} students per group. If students don't divide evenly, some groups may have ${groupSize - 1} or ${groupSize + 1}.
- After listing all groups, include a checklist confirming total students assigned equals ${totalStudents}.

Principles:
- For collaborative work: mix strengths across E21CC domains so each group has varied support
- For peer tutoring: pair stronger students with those who would benefit from support
- For competitive activities: balance average E21CC scores for fairness
- For differentiated tasks: cluster by readiness level for targeted instruction
- For jigsaw: assign roles based on individual strengths
- For lab/practical work: ensure each group has students comfortable with hands-on tasks
- For debate/discussion: balance perspectives and communication skills (CCI)
- For project-based learning: ensure diverse strengths for comprehensive project coverage

Format your response EXACTLY like this:

## Suggested Groups

### Group 1: [Descriptive name for group]
**Members:** [Full name 1], [Full name 2], [Full name 3], [Full name 4]
**Rationale:** [Why these students work well together for this activity]

### Group 2: [Descriptive name for group]
**Members:** [Full name 1], [Full name 2], [Full name 3], [Full name 4]
**Rationale:** [Why these students work well together for this activity]

(continue for ALL groups...)

## Grouping Strategy
Brief explanation of the overall approach and why this arrangement works for ${activityType}.

## Verification
Total students assigned: [number] / ${totalStudents}

Be practical, specific, and use every student's full name as provided.`,
    temperature: 0.6,
    maxTokens: 4096
  });
}

/* ── Exit Ticket / Quick Check Generator ── */
export async function generateExitTicket(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Generate exit ticket questions for this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
    systemPrompt: `You are Co-Cher's assessment specialist for Singapore educators. Generate quick formative assessment questions (exit tickets) that teachers can use at the end of a lesson to check understanding.

Create exactly 3–4 questions:
1. **Recall** — a factual question checking basic understanding
2. **Apply** — a question requiring students to apply what they learned
3. **Think Deeper (CAIT)** — a higher-order thinking question that develops Critical, Adaptive & Inventive Thinking
4. (Optional) **Reflect (CGC/CCI)** — a reflection question connecting to values, collaboration, or real-world application

Format:
## Exit Ticket

### Q1: Recall
[Question]
*Expected response:* [Brief expected answer]

### Q2: Apply
[Question]
*Expected response:* [Brief expected answer]

### Q3: Think Deeper
[Question]
*What to look for:* [Key indicators of understanding]

### Q4: Reflect (optional)
[Question]

## Teacher Notes
- How to use these questions (verbal, written, digital)
- What responses might indicate misconceptions
- Quick follow-up actions based on results

Keep questions age-appropriate and aligned to Singapore curriculum standards.`,
    temperature: 0.5,
    maxTokens: 2048
  });
}

/* ── Differentiation Suggestions ── */
export async function suggestDifferentiation(students, planText) {
  const profileSummary = students.map(s =>
    `${s.name}: CAIT=${s.e21cc?.cait || 50}, CCI=${s.e21cc?.cci || 50}, CGC=${s.e21cc?.cgc || 50}`
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
    systemPrompt: `You are Co-Cher's differentiation specialist for Singapore educators. Analyse student E21CC profiles and identify which students may need additional support or extension for a given lesson.

E21CC score interpretation:
- Below 40: May need scaffolding and structured support in this domain
- 40–60: Developing; benefits from guided practice
- 60–80: Competent; ready for standard-level activities
- Above 80: Strong; can take on extension tasks or peer mentoring

Format your response as:

## Class Profile Overview
Brief summary of the class's E21CC strengths and areas for growth.

## Students Needing Scaffolding
For each relevant student (scores below 40 in any domain):
- **[Name]** — [domain] at [score]: [specific suggestion for this lesson]

## Students Ready for Extension
For each relevant student (scores above 75 in key domains):
- **[Name]** — [domain] at [score]: [extension opportunity for this lesson]

## Differentiation Strategies
3–4 practical strategies the teacher can embed in this lesson:
1. [Strategy with specific example]
2. [Strategy with specific example]
3. [Strategy with specific example]

## Quick Adjustments
2–3 small tweaks to the lesson plan that would better serve diverse learners.

Be practical, name specific students, and tie suggestions to the actual lesson content. Reference STP Area 3 (Monitoring & Feedback) where relevant.`,
    temperature: 0.5,
    maxTokens: 3072
  });
}

/* ── Lesson Timeline / Pacing ── */
export async function generateTimeline(planText, totalMinutes, subject) {
  const messages = [{
    role: 'user',
    content: `Create a lesson timeline/pacing guide for this lesson:\n\n${planText}\n\nTotal lesson duration: ${totalMinutes} minutes\nSubject: ${subject || 'General'}`
  }];

  return sendChat(messages, {
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
    maxTokens: 2048
  });
}

/* ── Seat Assignment (Who Sits Where) ── */
export async function suggestSeatAssignment(groups, layoutPreset, studentCount) {
  const groupSummary = groups.map((g, i) =>
    `Group ${i + 1}: ${g.members.join(', ')}`
  ).join('\n');

  const messages = [{
    role: 'user',
    content: `Assign seating positions for these student groups in a "${layoutPreset}" classroom arrangement with ${studentCount} students.

Groups:
${groupSummary}`
  }];

  return sendChat(messages, {
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

Format:

## Seating Plan

### Group 1: [group name]
**Position:** [Specific location in the room, e.g., "Front-left pod", "Station A (Blue)"]
**Members:** [names with seat positions if applicable]
**Why here:** [Brief rationale — e.g., "Near whiteboard for presentations", "Close to materials"]

(continue for all groups...)

## Room Notes
- Where the teacher should position themselves
- Sightline considerations
- Any students who should face specific directions

Be practical and visual — help the teacher picture exactly where each group goes.`,
    temperature: 0.6,
    maxTokens: 2048
  });
}

export function validateApiKey(key) {
  return key && key.trim().length >= 20;
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast and capable (recommended)' },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview', description: 'Latest preview' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Most capable, slower' }
];
