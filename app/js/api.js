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

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }]
  }));

  const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

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
export async function suggestGrouping(students, activityType) {
  const studentSummary = students.map(s =>
    `${s.name}: CAIT=${s.e21cc?.cait || 50}, CCI=${s.e21cc?.cci || 50}, CGC=${s.e21cc?.cgc || 50}`
  ).join('\n');

  const messages = [{
    role: 'user',
    content: `Suggest optimal student groupings for: ${activityType}\n\nStudents and their E21CC profiles:\n${studentSummary}`
  }];

  return sendChat(messages, {
    systemPrompt: `You are Co-Cher's grouping specialist. Suggest student groups based on E21CC profiles and the activity type.

Principles:
- For collaborative work: mix strengths across domains for peer support
- For competitive activities: balance groups for fairness
- For differentiated tasks: cluster by readiness level
- For jigsaw: assign roles based on individual strengths

Format:
## Suggested Groups
Group 1: [names] — rationale
Group 2: [names] — rationale
...

## Grouping Strategy
Brief explanation of why this arrangement works for the activity.

Keep groups of 3-5 students. Be practical and specific.`,
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
