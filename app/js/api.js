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
    systemPrompt: `You are Co-Cher's grouping specialist. Create student groups for Singapore classrooms.

ABSOLUTE RULES — FOLLOW EXACTLY:
1. You MUST list EVERY SINGLE ONE of the ${totalStudents} students. Count them. No one left out.
2. Target ${groupSize} per group. Some groups may have ${groupSize - 1} or ${groupSize + 1} if numbers don't divide evenly.
3. Keep rationale SHORT — one sentence per group maximum.
4. Use the student's FULL NAME exactly as provided in the list.

Grouping logic:
- Collaborative: mix E21CC strengths
- Peer tutoring: pair strong with developing
- Competitive: balance groups fairly
- Jigsaw: roles by individual strengths
- Lab/practical: mix practical readiness
- Debate: balance CCI scores
- Project-based: diverse strengths

FORMAT — follow this exactly:

## Groups for ${activityType}

**Group 1:** Name A, Name B, Name C, Name D
**Rationale:** One short sentence.

**Group 2:** Name E, Name F, Name G, Name H
**Rationale:** One short sentence.

(continue until ALL ${totalStudents} students are assigned)

**Total: ${totalStudents} / ${totalStudents} students assigned**

IMPORTANT: List every student name. Do NOT abbreviate, do NOT use "..." or "etc." Do NOT skip any student.`,
    temperature: 0.6,
    maxTokens: 8192
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

/* ── YouTube Recommendations ── */
export async function suggestYouTubeVideos(planText, subject, level) {
  const messages = [{
    role: 'user',
    content: `Suggest YouTube videos that would support this lesson:\n\n${planText}\n\nSubject: ${subject || 'General'}\nLevel: ${level || 'Secondary'}`
  }];

  return sendChat(messages, {
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
    systemPrompt: `You are Co-Cher's worksheet designer for Singapore educators. Create a print-ready student worksheet that teachers can use in class.

Guidelines:
- Design a structured worksheet with clear sections
- Include a mix of question types: fill-in-the-blank, short answer, diagram labelling, calculation, structured response
- Start with easier recall questions and progress to application/analysis
- Include space indicators like [Space for answer] or [Draw diagram here]
- Add a header with: Lesson Title, Name: ___, Class: ___, Date: ___
- Align with Singapore O/N-Level or IP curriculum where possible
- Include 8-12 questions appropriate for the topic
- Add a bonus/extension question for advanced students
- Keep instructions clear and student-friendly

Format the worksheet in clean markdown that can be printed.`,
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
    systemPrompt: `You are Co-Cher's discussion facilitator for Singapore educators. Generate thoughtful discussion prompts that promote deep thinking and classroom discourse.

Generate prompts in these categories:

## Opening Questions (Hook / Activate Prior Knowledge)
2-3 questions to start the lesson and spark curiosity

## Core Discussion Questions (During Lesson)
4-5 questions that probe understanding at different levels:
- Recall/Understanding level
- Application level
- Analysis/Evaluation level
- Create/Synthesize level

## Think-Pair-Share Prompts
2-3 prompts suitable for pair discussion format

## Reflection / Closing Questions
2-3 prompts for end-of-lesson reflection

## Tips for Facilitation
- 3-4 tips on how to facilitate productive discussion (wait time, cold calling, sentence starters, etc.)

For each question, include a brief facilitator note on what kind of response to look for.`,
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

export function validateApiKey(key) {
  return key && key.trim().length >= 20;
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast and capable (recommended)' },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview', description: 'Latest preview' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Most capable, slower' }
];
