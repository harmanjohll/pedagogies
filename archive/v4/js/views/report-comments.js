/*
 * Report Comment Drafter (Labs · beta)
 * ====================================
 * Draft holistic, parent-facing report comments per student from E21CC
 * levels, teacher observations, and completed-lesson reflections.
 * Nothing auto-saves — teachers review, edit, and copy out.
 */

import { sendChat } from '../api.js';
import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { escapeHtml } from '../utils/markdown.js';
import { trackEvent } from '../utils/analytics.js';

const E21CC_DIMS = [
  { key: 'criticalThinking', label: 'Critical Thinking' },
  { key: 'creativeThinking', label: 'Creative Thinking' },
  { key: 'communication', label: 'Communication' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'socialConnectedness', label: 'Social Connectedness' },
  { key: 'selfRegulation', label: 'Self-Regulation' },
];

const TONES = {
  Warm: 'affirming and encouraging; celebrates effort and character alongside progress',
  Balanced: 'professional and even-handed; strengths and growth areas in equal measure',
  Formal: 'measured and precise; suitable for official school reports',
};

const LENGTHS = {
  short: '2-3 sentences per student',
  paragraph: 'one short paragraph (4-6 sentences) per student',
};

/* Reflections captured on completed lessons for this class (shared context). */
function classReflections(classId) {
  const lessons = Store.getLessons().filter(l => l.classId === classId && l.status === 'completed');
  const notes = [];
  lessons.slice(-4).forEach(l => {
    const r = l.reflection;
    if (!r) return;
    if (typeof r === 'string') {
      if (r.trim()) notes.push(`${l.title}: ${r.trim().slice(0, 240)}`);
      return;
    }
    const bits = [r.whatWorked, r.whatToAdjust, r.e21ccObservations, r.freeform]
      .filter(t => t && String(t).trim()).map(t => String(t).trim()).join(' / ');
    if (bits) notes.push(`${l.title}: ${bits.slice(0, 240)}`);
  });
  return notes;
}

function studentContext(s, idx) {
  const levels = E21CC_DIMS.map(d => `${d.label}: ${s.e21cc?.[d.key] || 'developing'}`).join(', ');
  const obs = [...(s.observations || [])]
    .sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 3)
    .map(o => `"${String(o.text || '').slice(0, 220)}"`).filter(Boolean).join(' | ');
  return `${idx + 1}. ${s.name}\n   E21CC levels: ${levels}${obs ? `\n   Teacher observations: ${obs}` : ''}`;
}

/* Defensive JSON-array extraction — jsonMode usually returns clean JSON,
 * but the model can still wrap it in prose or fences. */
function parseJsonArray(text) {
  const tryParse = (s) => {
    try { const v = JSON.parse(s); return Array.isArray(v) ? v : null; } catch { return null; }
  };
  let arr = tryParse(text);
  if (!arr) {
    const m = String(text).match(/\[[\s\S]*\]/);
    if (m) arr = tryParse(m[0]);
  }
  return arr;
}

export function render(container) {
  let selectedClassId = Store.getClasses()[0]?.id || '';
  let selectedIds = new Set((Store.getClass(selectedClassId)?.students || []).map(s => s.id));
  let tone = 'Balanced';
  let length = 'short';
  let isGenerating = false;
  let results = [];       // [{ id, name, text }]
  let rawFallback = '';   // shown when JSON parsing fails

  function renderView() {
    const classes = Store.getClasses();
    const cls = Store.getClass(selectedClassId);
    const students = cls?.students || [];

    container.innerHTML = `
      <style>
        .rc-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        @media (max-width: 640px) { .rc-form-grid { grid-template-columns: 1fr; } }
        .rc-label { display: block; font-size: 0.6875rem; font-weight: 600; color: var(--ink-secondary); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
        .rc-students { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
        .rc-student-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-card); font-size: 0.75rem; font-weight: 600; color: var(--ink-muted); cursor: pointer; user-select: none; }
        .rc-student-chip.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light, rgba(67,97,238,0.08)); }
        .rc-result-card { border: 1px solid var(--border); border-radius: 10px; background: var(--bg-card); padding: 12px 14px; margin-bottom: 10px; }
        .rc-result-card textarea { width: 100%; box-sizing: border-box; resize: vertical; }
        .labs-beta-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.5625rem; font-weight: 700; background: var(--warning-light, rgba(245,158,11,0.15)); color: var(--warning, #f59e0b); margin-left: 6px; vertical-align: middle; letter-spacing: 0.04em; }
      </style>
      <div class="main-scroll">
        <div class="page-container" style="max-width: 860px;">
          <div class="page-header">
            <div>
              <h1 class="page-title">Report Comment Drafter <span class="labs-beta-badge">Labs &middot; beta</span></h1>
              <p class="page-subtitle">Draft holistic report comments from E21CC levels, observations, and lesson reflections. Nothing is saved — review, edit, and copy out.</p>
            </div>
          </div>

          ${classes.length === 0 ? `
            <div class="empty-state" style="text-align:center;padding:40px 20px;border:2px dashed var(--border);border-radius:12px;color:var(--ink-muted);">
              <p style="margin:0 0 8px;font-weight:600;color:var(--ink);">No classes yet</p>
              <p style="margin:0;font-size:0.8125rem;">Create a class with students in My Classes first, then come back to draft comments.</p>
            </div>
          ` : `
            <div class="rc-form-grid">
              <div>
                <label class="rc-label" for="rc-class">Class</label>
                <select id="rc-class" class="input" style="width:100%;box-sizing:border-box;">
                  ${classes.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === selectedClassId ? 'selected' : ''}>${escapeHtml(c.name)}${c.level ? ` (${escapeHtml(c.level)})` : ''}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="rc-label" for="rc-tone">Tone</label>
                <select id="rc-tone" class="input" style="width:100%;box-sizing:border-box;">
                  ${Object.keys(TONES).map(t => `<option ${t === tone ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="rc-label" for="rc-length">Length</label>
                <select id="rc-length" class="input" style="width:100%;box-sizing:border-box;">
                  <option value="short" ${length === 'short' ? 'selected' : ''}>2-3 sentences</option>
                  <option value="paragraph" ${length === 'paragraph' ? 'selected' : ''}>Short paragraph</option>
                </select>
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span class="rc-label" style="margin:0;">Students (${selectedIds.size}/${students.length} selected)</span>
              <button id="rc-toggle-all" class="btn btn-ghost btn-sm" style="font-size:0.6875rem;">${selectedIds.size === students.length ? 'Deselect all' : 'Select all'}</button>
            </div>
            <div class="rc-students">
              ${students.length === 0
                ? '<span style="font-size:0.8125rem;color:var(--ink-muted);">This class has no students yet.</span>'
                : students.map(s => `
                  <span class="rc-student-chip ${selectedIds.has(s.id) ? 'active' : ''}" data-student="${escapeHtml(s.id)}">${escapeHtml(s.name)}</span>
                `).join('')}
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
              <button id="rc-generate" class="btn btn-primary" ${isGenerating || selectedIds.size === 0 ? 'disabled' : ''}>
                ${isGenerating ? 'Drafting comments...' : `Draft ${selectedIds.size || ''} Comment${selectedIds.size === 1 ? '' : 's'}`}
              </button>
              ${results.length ? '<button id="rc-copy-all" class="btn btn-secondary">Copy all</button>' : ''}
            </div>

            <div id="rc-output">
              ${isGenerating ? '<div class="card" style="padding:var(--sp-4, 16px);"><div class="chat-typing">Drafting holistic comments for the selected students...</div></div>' : ''}
              ${!isGenerating && rawFallback ? `
                <div class="rc-result-card" style="border-color:var(--warning,#f59e0b);">
                  <div style="font-size:0.75rem;font-weight:600;color:var(--warning,#f59e0b);margin-bottom:6px;">Could not parse the AI response as JSON — raw output shown below.</div>
                  <pre style="white-space:pre-wrap;font-size:0.8125rem;color:var(--ink);margin:0;font-family:inherit;">${escapeHtml(rawFallback)}</pre>
                </div>` : ''}
              ${!isGenerating ? results.map((r, i) => `
                <div class="rc-result-card">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-weight:700;font-size:0.875rem;color:var(--ink);">${escapeHtml(r.name)}</span>
                    <button class="btn btn-ghost btn-sm rc-copy-one" data-idx="${i}" style="font-size:0.6875rem;">Copy</button>
                  </div>
                  <textarea class="input rc-comment" data-idx="${i}" rows="4">${escapeHtml(r.text)}</textarea>
                </div>
              `).join('') : ''}
            </div>
          `}
        </div>
      </div>
    `;
    wireEvents();
  }

  function wireEvents() {
    container.querySelector('#rc-class')?.addEventListener('change', (e) => {
      selectedClassId = e.target.value;
      selectedIds = new Set((Store.getClass(selectedClassId)?.students || []).map(s => s.id));
      results = []; rawFallback = '';
      renderView();
    });
    container.querySelector('#rc-tone')?.addEventListener('change', (e) => { tone = e.target.value; });
    container.querySelector('#rc-length')?.addEventListener('change', (e) => { length = e.target.value; });

    container.querySelector('#rc-toggle-all')?.addEventListener('click', () => {
      const students = Store.getClass(selectedClassId)?.students || [];
      selectedIds = selectedIds.size === students.length ? new Set() : new Set(students.map(s => s.id));
      renderView();
    });

    container.querySelectorAll('.rc-student-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.student;
        if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
        renderView();
      });
    });

    container.querySelector('#rc-generate')?.addEventListener('click', generate);

    container.querySelectorAll('.rc-comment').forEach(ta => {
      ta.addEventListener('input', () => {
        const i = parseInt(ta.dataset.idx, 10);
        if (results[i]) results[i].text = ta.value;
      });
    });

    container.querySelectorAll('.rc-copy-one').forEach(btn => {
      btn.addEventListener('click', () => {
        const r = results[parseInt(btn.dataset.idx, 10)];
        if (r) copyText(`${r.text}`, `Copied comment for ${r.name}.`);
      });
    });

    container.querySelector('#rc-copy-all')?.addEventListener('click', () => {
      const all = results.map(r => `${r.name}\n${r.text}`).join('\n\n');
      copyText(all, `Copied ${results.length} comments.`);
      trackEvent('feature', 'report_comments_copy_all', Store.getClass(selectedClassId)?.name || '', `${results.length} students`);
    });
  }

  function copyText(text, successMsg) {
    if (!navigator.clipboard) {
      showToast('Clipboard unavailable — select the text and copy manually.', 'warning');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => showToast(successMsg, 'success'),
      () => showToast('Copy failed — select the text and copy manually.', 'warning')
    );
  }

  async function generate() {
    const cls = Store.getClass(selectedClassId);
    if (!cls) return;
    const students = (cls.students || []).filter(s => selectedIds.has(s.id));
    if (!students.length) { showToast('Select at least one student.', 'warning'); return; }

    isGenerating = true;
    results = []; rawFallback = '';
    renderView();

    const reflections = classReflections(cls.id);
    const prompt = `Draft one holistic report comment for EACH student below.

Class: ${cls.name}${cls.level ? ` (${cls.level})` : ''}${cls.subject ? ` — ${cls.subject}` : ''}
Tone: ${tone} — ${TONES[tone]}
Length: ${LENGTHS[length]}

E21CC levels are teacher-assessed on a rubric: developing → applying → extending → leading.

Students:
${students.map((s, i) => studentContext(s, i)).join('\n')}

${reflections.length ? `Recent completed-lesson reflections for this class (shared context, applies to the whole class):\n- ${reflections.join('\n- ')}\n\n` : ''}Rules:
- Write in third person using the student's name.
- Ground each comment in that student's E21CC levels and observations; never invent specific incidents.
- Lead with genuine strengths, then one growth area phrased constructively.
- No grades or marks, no comparisons between students, no generic filler.

Return ONLY a JSON array with exactly ${students.length} items, in the same order as the student list:
[{"name": "<student name>", "comment": "<the comment>"}]`;

    try {
      const raw = await sendChat([{ role: 'user', content: prompt }], {
        jsonMode: true,
        trackLabel: 'reportComments',
        trackDetail: `${cls.name} · ${students.length} students · ${tone}`,
        systemPrompt: 'You are Co-Cher\'s report comment specialist for Singapore schools. You write warm, professional, parent-facing holistic report comments grounded in the evidence provided. Return ONLY a valid JSON array — no markdown fences, no commentary.'
      });

      const arr = parseJsonArray(raw);
      if (arr) {
        const byName = new Map(
          arr.filter(o => o && typeof o === 'object')
            .map(o => [String(o.name || '').trim().toLowerCase(), String(o.comment || '').trim()])
        );
        results = students.map((s, i) => {
          let text = byName.get(s.name.trim().toLowerCase()) || '';
          if (!text && arr[i] && typeof arr[i] === 'object') text = String(arr[i].comment || '').trim();
          return { id: s.id, name: s.name, text };
        });
        if (results.every(r => !r.text)) {
          results = [];
          rawFallback = raw;
          showToast('Response did not match the expected format — showing raw text.', 'warning');
        }
      } else {
        rawFallback = raw;
        showToast('Could not parse the AI response — showing raw text.', 'warning');
      }
    } catch (err) {
      console.error('Report Comment Drafter error:', err);
      showToast(`Generation failed: ${err.message}`, 'danger');
    } finally {
      isGenerating = false;
      renderView();
    }
  }

  renderView();
}
