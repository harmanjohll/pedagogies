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

export function validateApiKey(key) {
  return key && key.trim().length >= 20;
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast and capable (recommended)' },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview', description: 'Latest preview' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Most capable, slower' }
];
