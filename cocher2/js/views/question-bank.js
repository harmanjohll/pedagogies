/*
 * Question Bank Builder (Labs · beta)
 * ===================================
 * Generate a bank of questions spread across Bloom's levels and a difficulty
 * mix. Items can be regenerated individually, sent to an AoL Assessment
 * Blueprint, or printed as a worksheet with an answer key.
 */

import { sendChat } from '../api.js';
import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/markdown.js';
import { trackEvent } from '../utils/analytics.js';
import { saveArtifact, savedArtifactsHTML, wireSavedArtifacts, consumeOpenArtifact, getArtifact, listArtifacts } from '../utils/library.js';

const BLOOMS = [
  { key: 'Remember', color: '#3b82f6' },
  { key: 'Understand', color: '#06b6d4' },
  { key: 'Apply', color: '#10b981' },
  { key: 'Analyse', color: '#f59e0b' },
  { key: 'Evaluate', color: '#8b5cf6' },
  { key: 'Create', color: '#ec4899' },
];
const DIFF_COLORS = { Easy: '#3b82f6', Medium: '#f59e0b', Hard: '#ef4444' };
const DIFF_MIXES = {
  balanced: 'Balanced mix (roughly equal Easy / Medium / Hard)',
  accessible: 'Mostly Easy and Medium (confidence-building)',
  stretch: 'Mostly Medium and Hard (stretch and challenge)',
};
const LEVELS = ['Sec 1', 'Sec 2', 'Sec 3', 'Sec 4', 'Sec 5', 'JC 1', 'JC 2'];

/* Coerce AI output into the blueprint vocabulary used in views/assessment.js */
function normDifficulty(d) {
  const v = String(d || '').trim().toLowerCase();
  if (v.startsWith('e')) return 'Easy';
  if (v.startsWith('h') || v.startsWith('d')) return 'Hard';
  return 'Medium';
}
function normBloom(b) {
  const v = String(b || '').trim().toLowerCase();
  const hit = BLOOMS.find(x => v.startsWith(x.key.toLowerCase().slice(0, 4)));
  return hit ? hit.key : 'Understand';
}
function normItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const question = String(raw.question || '').trim();
  if (!question) return null;
  return {
    question,
    answer: String(raw.answer || '').trim(),
    bloom: normBloom(raw.bloom),
    difficulty: normDifficulty(raw.difficulty),
    marks: Math.max(1, parseInt(raw.marks, 10) || 1),
  };
}
function parseJson(text, wantArray) {
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
  let v = tryParse(text);
  if (v == null) {
    const m = String(text).match(wantArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
    if (m) v = tryParse(m[0]);
  }
  return v;
}

export function render(container) {
  let subject = '';
  let level = 'Sec 3';
  let topic = '';
  let count = 10;
  let blooms = new Set(['Remember', 'Understand', 'Apply', 'Analyse']);
  let mix = 'balanced';
  let items = [];
  let isGenerating = false;
  let regeneratingIdx = -1;
  let savedBankId = null;   // Library id once THIS set is saved

  function renderView() {
    container.innerHTML = `
      <style>
        .qb-form { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        @media (max-width: 640px) { .qb-form { grid-template-columns: 1fr; } }
        .qb-form .full { grid-column: 1 / -1; }
        .qb-label { display: block; font-size: 0.6875rem; font-weight: 600; color: var(--ink-secondary); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
        .qb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .qb-chip { padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-card); font-size: 0.75rem; font-weight: 600; color: var(--ink-muted); cursor: pointer; user-select: none; }
        .qb-chip.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light, rgba(67,97,238,0.08)); }
        .qb-card { border: 1px solid var(--border); border-radius: 10px; background: var(--bg-card); padding: 14px 16px; margin-bottom: 10px; }
        .qb-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.625rem; font-weight: 700; letter-spacing: 0.02em; }
        .qb-q { font-size: 0.875rem; color: var(--ink); line-height: 1.6; margin: 8px 0 6px; }
        .qb-answer summary { font-size: 0.75rem; color: var(--ink-muted); cursor: pointer; }
        .qb-answer p { font-size: 0.8125rem; color: var(--ink-secondary); line-height: 1.6; margin: 6px 0 0; }
        .labs-beta-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.5625rem; font-weight: 700; background: var(--warning-light, rgba(245,158,11,0.15)); color: var(--warning, #f59e0b); margin-left: 6px; vertical-align: middle; letter-spacing: 0.04em; }
      </style>
      <div class="main-scroll">
        <div class="page-container" style="max-width: 860px;">
          <div class="page-header">
            <div>
              <h1 class="page-title">Question Bank Builder <span class="labs-beta-badge">Labs &middot; beta</span></h1>
              <p class="page-subtitle">Build a question set across Bloom's levels, then send it to an AoL Blueprint or print it as a worksheet.</p>
            </div>
          </div>

          <div class="qb-form">
            <div>
              <label class="qb-label" for="qb-subject">Subject</label>
              <input id="qb-subject" class="input" type="text" value="${escapeHtml(subject)}" placeholder="e.g. Geography" style="width:100%;box-sizing:border-box;">
            </div>
            <div>
              <label class="qb-label" for="qb-level">Level</label>
              <select id="qb-level" class="input" style="width:100%;box-sizing:border-box;">
                ${LEVELS.map(l => `<option ${l === level ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="qb-label" for="qb-count">Questions</label>
              <select id="qb-count" class="input" style="width:100%;box-sizing:border-box;">
                ${[5, 10, 15].map(n => `<option value="${n}" ${n === count ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </div>
            <div class="full">
              <label class="qb-label" for="qb-topic">Topic</label>
              <input id="qb-topic" class="input" type="text" value="${escapeHtml(topic)}" placeholder="e.g. Plate tectonics" style="width:100%;box-sizing:border-box;">
            </div>
            <div class="full">
              <label class="qb-label">Bloom's levels to cover</label>
              <div class="qb-chips">
                ${BLOOMS.map(b => `<span class="qb-chip ${blooms.has(b.key) ? 'active' : ''}" data-bloom="${b.key}">${b.key}</span>`).join('')}
              </div>
            </div>
            <div class="full">
              <label class="qb-label" for="qb-mix">Difficulty mix</label>
              <select id="qb-mix" class="input" style="width:100%;box-sizing:border-box;">
                ${Object.entries(DIFF_MIXES).map(([k, v]) => `<option value="${k}" ${k === mix ? 'selected' : ''}>${v}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
            <button id="qb-generate" class="btn btn-primary" ${isGenerating ? 'disabled' : ''}>${isGenerating ? 'Generating...' : 'Generate Questions'}</button>
            ${items.length ? `
              ${savedBankId
                ? '<span style="align-self:center;font-size:0.75rem;color:var(--success,#22c55e);font-weight:600;">&#10003; Saved to Library</span>'
                : '<button id="qb-save" class="btn btn-secondary">Save to Library</button>'}
              <button id="qb-blueprint" class="btn btn-secondary">Send to AoL Blueprint</button>
              <button id="qb-print-student" class="btn btn-ghost" title="Answer key is excluded from the printout">Print Student Copy</button>
              <button id="qb-print-teacher" class="btn btn-ghost" title="Includes the answer key in the printout">Print Teacher Copy (with answers)</button>
            ` : ''}
          </div>

          <div id="qb-output">
            ${isGenerating ? '<div class="card" style="padding:var(--sp-4, 16px);"><div class="chat-typing">Drafting questions across the selected Bloom’s levels...</div></div>' : ''}
            ${!isGenerating && items.length ? items.map((q, i) => `
              <div class="qb-card">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span style="font-weight:700;font-size:0.8125rem;color:var(--ink);">Q${i + 1}</span>
                  <span class="qb-badge" style="background:${(BLOOMS.find(b => b.key === q.bloom) || BLOOMS[1]).color}1f;color:${(BLOOMS.find(b => b.key === q.bloom) || BLOOMS[1]).color};">${escapeHtml(q.bloom)}</span>
                  <span class="qb-badge" style="background:${DIFF_COLORS[q.difficulty]}1f;color:${DIFF_COLORS[q.difficulty]};">${escapeHtml(q.difficulty)}</span>
                  <span style="font-size:0.6875rem;color:var(--ink-faint);">[${q.marks} mark${q.marks !== 1 ? 's' : ''}]</span>
                  <button class="btn btn-ghost btn-sm qb-regen" data-idx="${i}" style="margin-left:auto;font-size:0.6875rem;" ${regeneratingIdx !== -1 ? 'disabled' : ''}>
                    ${regeneratingIdx === i ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>
                <div class="qb-q">${escapeHtml(q.question)}</div>
                <details class="qb-answer">
                  <summary>Show answer / marking notes</summary>
                  <p>${escapeHtml(q.answer || 'No answer provided.')}</p>
                </details>
              </div>
            `).join('') : ''}
            ${!isGenerating && !items.length ? `
              ${savedArtifactsHTML('questionbank', escapeHtml)}
              <div style="text-align:center;padding:36px 20px;color:var(--ink-muted);border:2px dashed var(--border);border-radius:12px;font-size:0.875rem;">
                Set a subject and topic, pick your Bloom's spread, and generate a question bank.
              </div>` : ''}
          </div>
        </div>
      </div>
    `;
    wireEvents();
  }

  function readForm() {
    subject = container.querySelector('#qb-subject')?.value.trim() ?? subject;
    level = container.querySelector('#qb-level')?.value ?? level;
    topic = container.querySelector('#qb-topic')?.value.trim() ?? topic;
    count = parseInt(container.querySelector('#qb-count')?.value, 10) || count;
    mix = container.querySelector('#qb-mix')?.value ?? mix;
  }

  function wireEvents() {
    container.querySelectorAll('.qb-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        readForm();
        const key = chip.dataset.bloom;
        if (blooms.has(key)) blooms.delete(key); else blooms.add(key);
        renderView();
      });
    });
    container.querySelector('#qb-generate')?.addEventListener('click', generateBank);
    container.querySelector('#qb-save')?.addEventListener('click', async () => {
      const meta = await saveArtifact({
        kind: 'questionbank',
        title: [topic || 'Question Bank', subject].filter(Boolean).join(' — '),
        subject, level,
        summary: `${items.length} questions`,
        data: { subject, level, topic, count, mix, blooms: [...blooms], items },
      });
      if (meta) { savedBankId = meta.id; showToast('Question bank saved to your Library.', 'success'); renderView(); }
      else showToast('Could not save — browser storage unavailable.', 'danger');
    });
    // Saved banks: open restores the set for editing / printing / blueprinting.
    wireSavedArtifacts(container, {
      onOpen: (id, meta, data) => {
        subject = data.subject || ''; level = data.level || level; topic = data.topic || '';
        count = data.count || count; mix = data.mix || mix;
        if (Array.isArray(data.blooms) && data.blooms.length) blooms = new Set(data.blooms);
        items = Array.isArray(data.items) ? data.items : [];
        savedBankId = id;
        renderView();
      },
      onChanged: renderView,
    });
    container.querySelector('#qb-blueprint')?.addEventListener('click', sendToBlueprint);
    container.querySelector('#qb-print-student')?.addEventListener('click', () => printBank(false));
    container.querySelector('#qb-print-teacher')?.addEventListener('click', () => printBank(true));
    container.querySelectorAll('.qb-regen').forEach(btn => {
      btn.addEventListener('click', () => regenerateItem(parseInt(btn.dataset.idx, 10)));
    });
  }

  function buildPromptContext() {
    return `Subject: ${subject}\nLevel: ${level} (Singapore)\nTopic: ${topic}\nDifficulty mix: ${DIFF_MIXES[mix]}\nBloom's levels to use (spread questions across ALL of these): ${[...blooms].join(', ')}`;
  }

  const ITEM_SHAPE = `{"question": "...", "answer": "concise answer / marking notes", "bloom": "Remember|Understand|Apply|Analyse|Evaluate|Create", "difficulty": "Easy|Medium|Hard", "marks": 1-5}`;

  async function generateBank() {
    readForm();
    if (!subject || !topic) { showToast('Enter a subject and topic.', 'warning'); return; }
    if (!blooms.size) { showToast('Pick at least one Bloom’s level.', 'warning'); return; }

    isGenerating = true;
    renderView();
    try {
      const raw = await sendChat([{
        role: 'user',
        content: `Generate exactly ${count} assessment questions.\n\n${buildPromptContext()}\n\nEvery question must use one of the listed Bloom's levels; cover each listed level at least once where the count allows. Assign 1-5 marks per question according to demand.\n\nReturn ONLY a JSON array of ${count} items:\n[${ITEM_SHAPE}]`
      }], {
        jsonMode: true,
        trackLabel: 'questionBankGenerate',
        trackDetail: [subject, level, topic].filter(Boolean).join(' · '),
        systemPrompt: 'You are an expert assessment designer for Singapore schools. Write clear, unambiguous, curriculum-appropriate questions aligned to Bloom\'s taxonomy, each with a concise answer or marking note. Return ONLY a valid JSON array — no markdown fences, no commentary.'
      });

      const arr = parseJson(raw, true);
      const parsed = Array.isArray(arr) ? arr.map(normItem).filter(Boolean) : [];
      if (!parsed.length) {
        showToast('Could not parse the AI response — please try again.', 'danger');
      } else {
        items = parsed;
        savedBankId = null;   // fresh set → not yet in the Library
      }
    } catch (err) {
      console.error('Question Bank generation error:', err);
      showToast(`Generation failed: ${err.message}`, 'danger');
    } finally {
      isGenerating = false;
      renderView();
    }
  }

  async function regenerateItem(idx) {
    const old = items[idx];
    if (!old || regeneratingIdx !== -1) return;
    regeneratingIdx = idx;
    renderView();
    try {
      const raw = await sendChat([{
        role: 'user',
        content: `Write ONE replacement assessment question.\n\n${buildPromptContext()}\n\nKeep the same Bloom's level ("${old.bloom}") and difficulty ("${old.difficulty}") as the question being replaced, but ask something different from:\n"${old.question}"\n\nReturn ONLY one JSON object:\n${ITEM_SHAPE}`
      }], {
        jsonMode: true,
        trackLabel: 'questionBankRegenerate',
        trackDetail: [subject, old.bloom, old.difficulty].filter(Boolean).join(' · '),
        systemPrompt: 'You are an expert assessment designer for Singapore schools. Return ONLY one valid JSON object for the requested question — no markdown fences, no commentary.'
      });
      const replacement = normItem(parseJson(raw, false));
      if (replacement) {
        items[idx] = replacement;
        savedBankId = null;   // edited set → save again to keep the change
        showToast(`Q${idx + 1} regenerated.`, 'success');
      } else {
        showToast('Could not parse the regenerated question — kept the original.', 'warning');
      }
    } catch (err) {
      console.error('Question Bank regenerate error:', err);
      showToast(`Regeneration failed: ${err.message}`, 'danger');
    } finally {
      regeneratingIdx = -1;
      renderView();
    }
  }

  /* Create an AoL Assessment Blueprint (see views/assessment.js) from the set.
   * Blueprint questions use { number, topic, competency, difficulty, marks };
   * competency (CAIT/CCI/CGC) isn't knowable from Bloom's level, so it is left
   * blank for the teacher to tag. Question/answer text rides along as extra fields. */
  function sendToBlueprint() {
    if (!items.length) return;
    const bp = Store.addAssessmentBlueprint({
      title: `${subject}${topic ? `: ${topic}` : ''} (Question Bank)`,
      subject,
      questions: items.map((q, i) => ({
        number: i + 1,
        topic: topic || subject,
        competency: '',
        difficulty: q.difficulty,
        marks: q.marks,
        question: q.question,
        answer: q.answer,
        bloom: q.bloom,
      })),
    });
    trackEvent('feature', 'question_bank_to_blueprint', subject, `${items.length} questions`);
    showToast(`Blueprint "${bp.title}" saved — find it under Assessment → AoL.`, 'success');
  }

  /* withAnswers=false prints a student worksheet (answer key hidden via .no-print);
   * withAnswers=true prints a teacher copy including the answer key. */
  function printBank(withAnswers = false) {
    if (!items.length) return;
    const w = window.open('', '_blank');
    if (!w) { showToast('Pop-up blocked — allow pop-ups for this site to print.', 'warning'); return; }
    trackEvent('export', 'print_question_bank', `${items.length} questions (${withAnswers ? 'teacher copy' : 'student copy'})`, [subject, level].filter(Boolean).join(' '));
    const totalMarks = items.reduce((s, q) => s + q.marks, 0);
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(subject)} Question Bank${withAnswers ? ' (Teacher Copy)' : ''}</title>
  <style>
    @media print { @page { margin: 2cm; } .no-print { display: none !important; } }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e1e2e; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1e1e2e; padding-bottom: 16px; }
    .header h1 { font-size: 1.25rem; margin: 0 0 4px; }
    .header p { font-size: 0.875rem; color: #666; margin: 0; }
    .student-info { display: flex; gap: 24px; margin-bottom: 24px; font-size: 0.875rem; }
    .student-info div { flex: 1; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .question { margin-bottom: 20px; page-break-inside: avoid; }
    .q-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
    .q-number { font-weight: 700; font-size: 0.9375rem; }
    .q-meta { font-size: 0.75rem; color: #666; }
    .q-text { font-size: 0.9375rem; line-height: 1.6; margin-bottom: 8px; }
    .q-lines { border-bottom: 1px solid #ddd; height: 28px; }
    .answer-section { margin-top: 32px; border-top: 2px dashed #ccc; padding-top: 16px; }
    .answer-section h2 { font-size: 1rem; margin-bottom: 12px; }
    .answer { margin-bottom: 12px; font-size: 0.8125rem; line-height: 1.5; }
    .footer { margin-top: 32px; text-align: center; font-size: 0.6875rem; color: #999; }
  </style>
</head>
<body>
  ${withAnswers ? `<div style="border: 2px solid #b45309; color: #b45309; text-align: center; font-weight: 700; font-size: 0.8125rem; letter-spacing: 0.06em; padding: 8px 12px; margin-bottom: 16px;">TEACHER COPY &mdash; INCLUDES ANSWERS</div>` : ''}
  <div class="header">
    <h1>${escapeHtml(subject)}${level ? ' | ' + escapeHtml(level) : ''}${topic ? ' | ' + escapeHtml(topic) : ''}</h1>
    <p>Total Marks: ${totalMarks} | Questions: ${items.length}</p>
  </div>
  <div class="student-info">
    <div>Name: ____________________</div>
    <div>Class: ________</div>
    <div>Date: ________</div>
  </div>
  ${items.map((q, i) => `
    <div class="question">
      <div class="q-header">
        <span class="q-number">Q${i + 1}.</span>
        <span class="q-meta">[${q.marks} mark${q.marks !== 1 ? 's' : ''}]</span>
      </div>
      <div class="q-text">${escapeHtml(q.question)}</div>
      ${Array.from({ length: Math.max(2, Math.ceil(q.marks * 1.5)) }, () => '<div class="q-lines"></div>').join('')}
    </div>`).join('')}
  <div class="answer-section${withAnswers ? '' : ' no-print'}">
    <h2>Answer Key</h2>
    ${items.map((q, i) => `
      <div class="answer"><strong>Q${i + 1} (${escapeHtml(q.bloom)}, ${escapeHtml(q.difficulty)}, ${q.marks}m):</strong> ${escapeHtml(q.answer || 'No answer provided')}</div>
    `).join('')}
  </div>
  <div class="footer">Generated by Co-Cher Question Bank Builder | Teacher review required before use</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
    w.document.close();
  }

  renderView();

  // Ctrl+K asked us to open a specific saved bank.
  const openId = consumeOpenArtifact();
  if (openId) {
    (async () => {
      const meta = listArtifacts('questionbank').find(a => a.id === openId);
      const data = meta ? await getArtifact(openId) : null;
      if (!data) return;
      subject = data.subject || ''; level = data.level || level; topic = data.topic || '';
      count = data.count || count; mix = data.mix || mix;
      if (Array.isArray(data.blooms) && data.blooms.length) blooms = new Set(data.blooms);
      items = Array.isArray(data.items) ? data.items : [];
      savedBankId = openId;
      renderView();
    })();
  }
}
