/*
 * Relief Lesson Kit (Labs · beta)
 * ===============================
 * Generate a self-contained one-period relief lesson: a run sheet written for
 * a NON-specialist relief teacher, a printable student worksheet, and an
 * answer key. Slots come from the school timetable when available, with a
 * manual subject/level fallback.
 */

import { sendChat } from '../api.js';
import { showToast } from '../components/toast.js';
import { md, escapeHtml } from '../utils/markdown.js';
import { trackEvent } from '../utils/analytics.js';
import { loadTT, findTeacherRow } from './dashboard.js';
import { getCurrentUser } from '../components/login.js';
import { saveArtifact, savedArtifactsHTML, wireSavedArtifacts, consumeOpenArtifact, getArtifact, listArtifacts } from '../utils/library.js';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const WEEK_TYPES = ['Odd', 'Even'];

const MATERIALS = {
  worksheets: {
    label: 'Worksheets only',
    brief: 'Printed worksheets can be handed out. No projector, no student devices.',
  },
  projector: {
    label: 'Projector available',
    brief: 'A projector/screen is available for showing prompts, and worksheets can be printed.',
  },
  nothing: {
    label: 'Nothing — board only',
    brief: 'NO printed materials or projector. Whiteboard and verbal instructions only — all student tasks must be copied from the board into their own notebooks.',
  },
};

/* Flatten a timetable row (columns like "OddMon3" = "CLASS / ROOM") into slots. */
function buildSlots(row) {
  const slots = [];
  WEEK_TYPES.forEach(wt => {
    DAYS.forEach(day => {
      for (let p = 1; p <= 14; p++) {
        const val = row[`${wt}${day}P${String(p).padStart(2, '0')}`];
        if (val && val !== '0') {
          const parts = val.split(' / ');
          const classCode = parts[0]?.trim() || '';
          const room = parts[1]?.trim() || '';
          slots.push({
            weekType: wt, day, p, classCode, room,
            label: `${wt} Week · ${day} P${p} — ${classCode}${room ? ` (${room})` : ''}`,
          });
        }
      }
    });
  });
  return slots;
}

export function render(container) {
  let disposed = false;
  let ttLoaded = false;
  let slots = [];
  let selectedSlot = -1;   // index into slots, -1 = manual entry
  let className = '';
  let subject = '';
  let level = '';
  let topic = '';
  let materials = 'worksheets';
  let output = '';
  let isGenerating = false;
  let savedArtifact = null;   // Library id once THIS output is saved

  function renderView() {
    if (disposed) return;
    const slot = slots[selectedSlot] || null;

    container.innerHTML = `
      <style>
        .rk-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        @media (max-width: 640px) { .rk-form { grid-template-columns: 1fr; } }
        .rk-form .full { grid-column: 1 / -1; }
        .rk-label { display: block; font-size: 0.6875rem; font-weight: 600; color: var(--ink-secondary); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
        .rk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .rk-chip { padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-card); font-size: 0.75rem; font-weight: 600; color: var(--ink-muted); cursor: pointer; user-select: none; }
        .rk-chip.active { border-color: var(--accent); color: var(--accent); background: var(--accent-light, rgba(67,97,238,0.08)); }
        .rk-output { border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card); padding: 20px 24px; color: var(--ink); font-size: 0.875rem; line-height: 1.7; }
        .labs-beta-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.5625rem; font-weight: 700; background: var(--warning-light, rgba(245,158,11,0.15)); color: var(--warning, #f59e0b); margin-left: 6px; vertical-align: middle; letter-spacing: 0.04em; }
      </style>
      <div class="main-scroll">
        <div class="page-container" style="max-width: 860px;">
          <div class="page-header">
            <div>
              <h1 class="page-title">Relief Lesson Kit <span class="labs-beta-badge">Labs &middot; beta</span></h1>
              <p class="page-subtitle">A one-period lesson any relief teacher can run: step-by-step instructions, a student worksheet, and answers.</p>
            </div>
          </div>

          <div class="rk-form">
            <div class="full">
              <label class="rk-label" for="rk-slot">Timetable slot</label>
              ${!ttLoaded ? `
                <div class="chat-typing" style="font-size:0.8125rem;padding:6px 0;">Loading your timetable...</div>
              ` : slots.length ? `
                <select id="rk-slot" class="input" style="width:100%;box-sizing:border-box;">
                  <option value="-1" ${selectedSlot === -1 ? 'selected' : ''}>Manual entry (no timetable slot)</option>
                  ${slots.map((s, i) => `<option value="${i}" ${i === selectedSlot ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
                </select>
              ` : `
                <div style="font-size:0.8125rem;color:var(--ink-muted);padding:6px 0;">No timetable found for your account — enter the class details manually below.</div>
              `}
            </div>
            <div>
              <label class="rk-label" for="rk-class">Class</label>
              <input id="rk-class" class="input" type="text" value="${escapeHtml(slot ? slot.classCode : className)}" placeholder="e.g. 3E2" style="width:100%;box-sizing:border-box;">
            </div>
            <div>
              <label class="rk-label" for="rk-subject">Subject</label>
              <input id="rk-subject" class="input" type="text" value="${escapeHtml(subject)}" placeholder="e.g. English" style="width:100%;box-sizing:border-box;">
            </div>
            <div>
              <label class="rk-label" for="rk-level">Level</label>
              <input id="rk-level" class="input" type="text" value="${escapeHtml(level)}" placeholder="e.g. Sec 3 Express" style="width:100%;box-sizing:border-box;">
            </div>
            <div>
              <label class="rk-label" for="rk-topic">Topic students are on</label>
              <input id="rk-topic" class="input" type="text" value="${escapeHtml(topic)}" placeholder="e.g. Situational writing" style="width:100%;box-sizing:border-box;">
            </div>
            <div class="full">
              <label class="rk-label">Materials available to the relief teacher</label>
              <div class="rk-chips">
                ${Object.entries(MATERIALS).map(([k, m]) => `<span class="rk-chip ${materials === k ? 'active' : ''}" data-mat="${k}">${m.label}</span>`).join('')}
              </div>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
            <button id="rk-generate" class="btn btn-primary" ${isGenerating ? 'disabled' : ''}>${isGenerating ? 'Building relief pack...' : 'Generate Relief Kit'}</button>
            ${output ? '<button id="rk-print" class="btn btn-secondary">Print relief pack</button>' : ''}
            ${output ? (savedArtifact
              ? '<span style="align-self:center;font-size:0.75rem;color:var(--success,#22c55e);font-weight:600;">&#10003; Saved to Library</span>'
              : '<button id="rk-save" class="btn btn-secondary">Save to Library</button>') : ''}
          </div>

          ${!output && !isGenerating ? savedArtifactsHTML('reliefkit', escapeHtml) : ''}

          <div id="rk-output">
            ${isGenerating ? '<div class="card" style="padding:var(--sp-4, 16px);"><div class="chat-typing">Writing a run sheet, worksheet, and answer key for a non-specialist...</div></div>' : ''}
            ${!isGenerating && output ? `<div class="rk-output">${md(output)}</div>` : ''}
            ${!isGenerating && !output ? `
              <div style="text-align:center;padding:36px 20px;color:var(--ink-muted);border:2px dashed var(--border);border-radius:12px;font-size:0.875rem;">
                Pick a timetable slot (or enter class details), state the topic, and generate a self-contained relief pack.
              </div>` : ''}
          </div>
        </div>
      </div>
    `;
    wireEvents();
  }

  function readForm() {
    className = container.querySelector('#rk-class')?.value.trim() ?? className;
    subject = container.querySelector('#rk-subject')?.value.trim() ?? subject;
    level = container.querySelector('#rk-level')?.value.trim() ?? level;
    topic = container.querySelector('#rk-topic')?.value.trim() ?? topic;
  }

  function wireEvents() {
    container.querySelector('#rk-slot')?.addEventListener('change', (e) => {
      readForm();
      selectedSlot = parseInt(e.target.value, 10);
      const slot = slots[selectedSlot];
      if (slot) className = slot.classCode;
      renderView();
    });
    container.querySelectorAll('.rk-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        readForm();
        materials = chip.dataset.mat;
        renderView();
      });
    });
    container.querySelector('#rk-generate')?.addEventListener('click', generateKit);
    container.querySelector('#rk-print')?.addEventListener('click', printPack);
    container.querySelector('#rk-save')?.addEventListener('click', async () => {
      const meta = await saveArtifact({
        kind: 'reliefkit',
        title: [topic || 'Relief Kit', className || subject].filter(Boolean).join(' — '),
        subject, level,
        summary: [className, materials].filter(Boolean).join(' · '),
        data: { className, subject, level, topic, materials, output },
      });
      if (meta) { savedArtifact = meta.id; showToast('Relief Kit saved to your Library.', 'success'); renderView(); }
      else showToast('Could not save — browser storage unavailable.', 'danger');
    });
    // Saved kits: open restores the form + the full pack, ready to print.
    wireSavedArtifacts(container, {
      onOpen: (id, meta, data) => {
        className = data.className || ''; subject = data.subject || ''; level = data.level || '';
        topic = data.topic || ''; materials = data.materials || 'worksheets';
        output = data.output || ''; savedArtifact = id; selectedSlot = -1;
        renderView();
      },
      onChanged: renderView,
    });
  }

  async function generateKit() {
    readForm();
    if (!subject || !topic) { showToast('Enter at least a subject and topic.', 'warning'); return; }

    isGenerating = true;
    renderView();

    const slot = slots[selectedSlot] || null;
    const slotLine = slot
      ? `Timetable slot: ${slot.weekType} Week, ${slot.day} Period ${slot.p}${slot.room ? `, Room ${slot.room}` : ''}`
      : 'Timetable slot: not specified';

    try {
      const text = await sendChat([{
        role: 'user',
        content: `Create a complete one-period (40 minute) RELIEF lesson kit.

Class: ${className || 'Not specified'}
Subject: ${subject}
Level: ${level || 'Secondary'}
Topic students are currently on: ${topic}
${slotLine}
Materials: ${MATERIALS[materials].brief}

The relief teacher covering this period is NOT a specialist in this subject and has never met this class. Everything must be self-contained: no marking judgement calls, no subject expertise, no digital logins.

Produce exactly these sections:

## Relief Teacher Brief
2-3 sentences of context a non-specialist needs (what the class is studying, what success looks like this period, one behaviour-management tip).

## Lesson Run Sheet (40 min)
Step-by-step numbered instructions with explicit timings that total 40 minutes (e.g. "0-5 min: ..."). Include exactly what to say or write on the board, how students work (individual/pairs), and what to collect at the end. Respect the materials constraint above.

## Student Worksheet
A printable worksheet for the period: title, clear instructions, and 6-10 tasks/questions of ramping difficulty that students can complete independently without teacher subject knowledge. ${materials === 'nothing' ? 'Since nothing can be printed, frame this as board-copy tasks students write in their notebooks.' : ''}

## Answer Key
Concise answers for every worksheet task so the relief teacher (or the returning teacher) can check work without subject expertise.`
      }], {
        trackLabel: 'reliefKitGenerate',
        trackDetail: [subject, level, className].filter(Boolean).join(' · '),
        systemPrompt: 'You are Co-Cher\'s relief lesson specialist for Singapore schools. You write self-contained, one-period relief lesson kits that a non-specialist relief teacher can run with zero preparation. Be concrete and directive — timings, exact instructions, and complete answers. Use clean markdown with the exact section headings requested.',
        temperature: 0.6,
        maxTokens: 6144
      });
      output = text;
      savedArtifact = null;   // fresh pack → not yet in the Library
    } catch (err) {
      console.error('Relief Kit generation error:', err);
      showToast(`Generation failed: ${err.message}`, 'danger');
    } finally {
      isGenerating = false;
      renderView();
    }
  }

  function printPack() {
    if (!output) return;
    const w = window.open('', '_blank');
    if (!w) { showToast('Pop-up blocked — allow pop-ups for this site to print.', 'warning'); return; }
    trackEvent('export', 'print_relief_pack', subject, [level, className].filter(Boolean).join(' '));

    const slot = slots[selectedSlot] || null;
    const metaLine = [
      className && `Class: ${className}`,
      subject && `Subject: ${subject}`,
      level && `Level: ${level}`,
      slot && `${slot.weekType} Week ${slot.day} P${slot.p}${slot.room ? ` · ${slot.room}` : ''}`,
    ].filter(Boolean).join(' | ');

    // md() escapes AI content and emits CSS-variable styles; define the
    // variables here so the pack renders correctly in the bare print window.
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Relief Lesson Pack — ${escapeHtml(subject)}</title>
  <style>
    :root {
      --ink: #111827; --ink-secondary: #374151; --ink-muted: #4b5563; --ink-faint: #9ca3af;
      --border: #d1d5db; --border-light: #e5e7eb; --bg-subtle: #f3f4f6; --bg-card: #fff;
      --accent: #4361ee; --accent-light: #eef1fd; --surface-hover: #f3f4f6; --font-mono: monospace;
    }
    @media print { @page { margin: 2cm; } }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #111827; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; }
    .header h1 { font-size: 1.25rem; margin: 0 0 4px; }
    .header p { font-size: 0.875rem; color: #666; margin: 0; }
    h3 { page-break-after: avoid; }
    .footer { margin-top: 32px; text-align: center; font-size: 0.6875rem; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Relief Lesson Pack</h1>
    <p>${escapeHtml(metaLine || 'One-period relief lesson')} | Topic: ${escapeHtml(topic)}</p>
  </div>
  ${md(output)}
  <div class="footer">Generated by Co-Cher Relief Lesson Kit | Prepared by ${escapeHtml(getCurrentUser()?.name || getCurrentUser()?.email || 'a colleague')}</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
    w.document.close();
  }

  renderView();

  // Load the timetable asynchronously; bail out if the user navigated away.
  (async () => {
    try {
      const ttData = await loadTT();
      const row = findTeacherRow(ttData, getCurrentUser()?.email);
      if (row) slots = buildSlots(row);
    } catch (e) {
      console.warn('Relief Kit: timetable load failed', e);
    }
    ttLoaded = true;
    if (!disposed) renderView();
  })();

  // Ctrl+K asked us to open a specific saved kit.
  const openId = consumeOpenArtifact();
  if (openId) {
    (async () => {
      const meta = listArtifacts('reliefkit').find(a => a.id === openId);
      const data = meta ? await getArtifact(openId) : null;
      if (!data || disposed) return;
      className = data.className || ''; subject = data.subject || ''; level = data.level || '';
      topic = data.topic || ''; materials = data.materials || 'worksheets';
      output = data.output || ''; savedArtifact = openId; selectedSlot = -1;
      renderView();
    })();
  }

  // Router cleanup contract — stop the async timetable load from touching
  // the container after navigation.
  return () => { disposed = true; };
}
