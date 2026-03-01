/*
 * Co-Cher Lesson Planner
 * ======================
 * AI chat + plan canvas with save / link-to-class / export.
 * Phase 3: Subject-aware prompts, status badge, undo, mobile toggle, improved markdown.
 */

import { Store } from '../state.js';
import { sendChat, reviewLesson, generateRubric, suggestGrouping } from '../api.js';
import { showToast } from '../components/toast.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { navigate } from '../router.js';

let chatMessages = [];
let isGenerating = false;
let currentLessonId = null;  // if editing a saved lesson

/* ── Markdown renderer (improved — supports tables and ordered lists) ── */
function md(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.06);padding:8px 12px;border-radius:8px;font-size:0.8rem;overflow-x:auto;margin:6px 0;font-family:var(--font-mono);"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold, italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h5 style="font-size:0.85rem;font-weight:600;margin:6px 0 3px;">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:0.9rem;font-weight:600;margin:8px 0 4px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:10px 0 4px;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h3 style="font-size:1.05rem;font-weight:700;margin:12px 0 4px;">$1</h3>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-light);margin:12px 0;">')
    // Tables
    .replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/gm, (match, headerRow, sepRow, bodyRows) => {
      const headers = headerRow.split('|').filter(c => c.trim());
      const alignments = sepRow.split('|').filter(c => c.trim()).map(c => {
        c = c.trim();
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      const rows = bodyRows.trim().split('\n').map(r => r.split('|').filter(c => c.trim()));
      return `<div style="overflow-x:auto;margin:8px 0;"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem;">
        <thead><tr>${headers.map((h, i) => `<th style="text-align:${alignments[i] || 'left'};padding:6px 10px;border-bottom:2px solid var(--border);font-weight:600;color:var(--ink);background:var(--bg-subtle);">${h.trim()}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td style="text-align:${alignments[i] || 'left'};padding:5px 10px;border-bottom:1px solid var(--border-light);">${cell.trim()}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    })
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => {
      if (m.match(/^\d+\./m)) return m;
      return `<ul style="padding-left:1.25rem;margin:4px 0;">${m}</ul>`;
    })
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/(<li style="margin:2px 0;">[^<]*<\/li>\n?){2,}/g, m => {
      if (m.includes('<ul') || m.includes('<ol')) return m;
      return `<ol style="padding-left:1.25rem;margin:4px 0;">${m}</ol>`;
    })
    // Paragraphs
    .replace(/\n{2,}/g, '</p><p style="margin:4px 0;">')
    .replace(/\n/g, '<br>');
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ── Build quick prompts based on classes/subjects ── */
function buildQuickPrompts(classes) {
  const prompts = [];

  // Subject-specific prompts based on existing classes
  const subjects = [...new Set(classes.map(c => c.subject).filter(Boolean))];
  const levels = [...new Set(classes.map(c => c.level).filter(Boolean))];

  if (subjects.length > 0) {
    const subj = subjects[0];
    const level = levels[0] || '';
    const subjectPrompts = {
      'Mathematics': `Help me plan an engaging ${level} Mathematics lesson with hands-on activities`,
      'Science': `Design a ${level} Science lesson with inquiry-based learning and experiments`,
      'Chemistry': `Plan a ${level} Chemistry lesson connecting concepts to real-world applications`,
      'Physics': `Create a ${level} Physics lesson with demonstrations and problem-solving`,
      'Biology': `Design a ${level} Biology lesson with collaborative investigation activities`,
      'English': `Plan a ${level} English lesson focused on creative writing and peer feedback`,
      'History': `Create a ${level} History lesson using source analysis and discussion`,
      'Geography': `Design a ${level} Geography lesson with data analysis and fieldwork skills`,
    };
    // Match by partial subject name
    for (const [key, prompt] of Object.entries(subjectPrompts)) {
      if (subj.toLowerCase().includes(key.toLowerCase())) {
        prompts.push({ label: `Plan a ${key} lesson`, prompt: prompt });
        break;
      }
    }
  }

  // Default prompts
  if (prompts.length === 0) {
    prompts.push({ label: 'Plan an engaging lesson', prompt: 'Help me plan an engaging lesson with hands-on activities and collaborative work' });
  }
  prompts.push({ label: 'Best layouts for group work', prompt: 'What spatial arrangement works best for collaborative group work?' });
  prompts.push({ label: 'Develop CAIT in a lesson', prompt: 'How can I develop Critical and Inventive Thinking (CAIT) in my lesson?' });
  prompts.push({ label: 'E21CC activity ideas', prompt: 'Suggest activities that build all three E21CC domains: CAIT, CCI, and CGC' });

  return prompts.slice(0, 4);
}

/* ══════════ Load existing lesson ══════════ */
export function renderForLesson(container, { id }) {
  const lesson = Store.getLesson(id);
  if (!lesson) { navigate('/lessons'); return; }
  currentLessonId = id;
  chatMessages = [...(lesson.chatHistory || [])];
  render(container);
}

/* ══════════ Main render ══════════ */
export function render(container) {
  const classes = Store.getClasses();
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;

  // Status badge for current lesson
  const statusBadgeHTML = currentLesson ? (() => {
    const colors = { draft: 'badge-gray', ready: 'badge-blue', completed: 'badge-green' };
    const labels = { draft: 'Draft', ready: 'Ready', completed: 'Done' };
    return `<span class="badge ${colors[currentLesson.status] || 'badge-gray'} badge-dot">${labels[currentLesson.status] || 'Draft'}</span>`;
  })() : '';

  container.innerHTML = `
    <div class="lp-layout" id="lp-layout" style="height:100%;overflow:hidden;">
      <!-- Chat Column -->
      <div class="lp-chat-col" style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;">
        <div class="chat-header" style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <div>
              <div class="chat-header-title">Co-Cher Assistant</div>
              <div class="chat-header-subtitle">Lesson experience, design & planning</div>
            </div>
            ${statusBadgeHTML}
          </div>
          <div style="display:flex;gap:var(--sp-2);align-items:center;">
            <button class="lp-panel-toggle" id="show-plan-btn" title="View plan canvas">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Canvas
            </button>
            ${chatMessages.length >= 2 ? `
              <button class="btn btn-ghost btn-sm" id="undo-btn" title="Undo last exchange">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm" id="new-chat-btn" title="New conversation">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>
          </div>
        </div>

        <div class="chat-messages" id="chat-messages" style="flex:1;min-height:0;overflow-y:auto;"></div>

        <div class="chat-input-row" style="flex-shrink:0;">
          <textarea class="chat-input" id="chat-input" placeholder="Describe your lesson idea, ask about spatial design, or explore frameworks..." rows="3"></textarea>
          <button class="chat-send" id="chat-send" ${isGenerating ? 'disabled' : ''}>Send</button>
        </div>
      </div>

      <!-- Plan Column -->
      <div class="lp-plan-col" style="background:var(--bg);">
        <div style="flex:1;overflow-y:auto;padding:var(--sp-6);">
          <div style="max-width:680px;margin:0 auto;">
            <!-- Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-6);flex-wrap:wrap;gap:var(--sp-2);">
              <div style="display:flex;align-items:center;gap:var(--sp-2);">
                <button class="lp-panel-toggle" id="show-chat-btn" title="Back to chat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                  Chat
                </button>
                <div>
                  <h2 style="font-size:1.125rem;font-weight:600;color:var(--ink);">Lesson Canvas</h2>
                  <p style="font-size:0.8125rem;color:var(--ink-muted);">
                    ${currentLessonId ? `Editing: ${currentLesson?.title || 'Lesson'}` : 'New lesson — save when ready'}
                  </p>
                </div>
              </div>
              <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" id="save-lesson-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save
                </button>
                <button class="btn btn-ghost btn-sm" id="export-pdf-btn" title="Export as printable page">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
              </div>
            </div>

            <!-- AI Tools Bar -->
            <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-bottom:var(--sp-4);padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);">
              <span style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);align-self:center;margin-right:var(--sp-2);">AI Tools</span>
              <button class="btn btn-ghost btn-sm" id="ai-review-btn" title="AI reviews your lesson plan for E21CC alignment">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                Review Plan
              </button>
              <button class="btn btn-ghost btn-sm" id="ai-rubric-btn" title="Generate an assessment rubric">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>
                Rubric
              </button>
              <button class="btn btn-ghost btn-sm" id="ai-group-btn" title="Suggest student groupings based on E21CC profiles">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Grouping
              </button>
            </div>

            <!-- Plan Content -->
            <div id="plan-content"></div>

            <!-- AI Result Panel -->
            <div id="ai-result" style="margin-top:var(--sp-4);"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const messagesEl = container.querySelector('#chat-messages');
  const chatInput = container.querySelector('#chat-input');
  const chatSend = container.querySelector('#chat-send');
  const layoutEl = container.querySelector('#lp-layout');

  // Render initial messages
  renderMessages(messagesEl, classes);
  renderPlanContent(container.querySelector('#plan-content'));

  // Mobile panel toggle
  const showPlanBtn = container.querySelector('#show-plan-btn');
  const showChatBtn = container.querySelector('#show-chat-btn');
  if (showPlanBtn) {
    showPlanBtn.addEventListener('click', () => layoutEl.classList.add('show-plan'));
  }
  if (showChatBtn) {
    showChatBtn.addEventListener('click', () => layoutEl.classList.remove('show-plan'));
  }

  // New chat
  container.querySelector('#new-chat-btn').addEventListener('click', () => {
    chatMessages = [];
    currentLessonId = null;
    isGenerating = false;
    render(container);
  });

  // Undo last exchange
  const undoBtn = container.querySelector('#undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Undo Last Exchange',
        message: 'Remove the last user message and AI response?',
        confirmLabel: 'Undo',
        cancelLabel: 'Cancel'
      });
      if (!confirmed) return;

      // Remove last AI message and last user message
      if (chatMessages.length >= 2) {
        const lastAi = chatMessages.length - 1;
        const lastUser = chatMessages.length - 2;
        if (chatMessages[lastAi]?.role === 'assistant' && chatMessages[lastUser]?.role === 'user') {
          chatMessages.splice(lastUser, 2);
        } else {
          chatMessages.pop();
        }
      } else if (chatMessages.length === 1) {
        chatMessages.pop();
      }
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { chatHistory: [...chatMessages] });
      }
      render(container);
      showToast('Last exchange removed.', 'success');
    });
  }

  // Send message
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isGenerating) return;
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    chatMessages.push({ role: 'user', content: text });
    chatInput.value = '';
    chatInput.style.height = 'auto';
    isGenerating = true;
    renderMessages(messagesEl, classes);

    try {
      const response = await sendChat(chatMessages);
      chatMessages.push({ role: 'assistant', content: response });
    } catch (err) {
      chatMessages.push({ role: 'assistant', content: `I encountered an error: ${err.message}` });
      showToast(err.message, 'danger');
    } finally {
      isGenerating = false;
      renderMessages(messagesEl, classes);
      renderPlanContent(container.querySelector('#plan-content'));
      // Auto-save if editing existing lesson
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { chatHistory: [...chatMessages] });
      }
    }
  }

  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
  });

  // Quick prompts
  messagesEl.addEventListener('click', e => {
    const btn = e.target.closest('.quick-prompt');
    if (btn) { chatInput.value = btn.dataset.prompt; sendMessage(); }
  });

  // Save lesson
  container.querySelector('#save-lesson-btn').addEventListener('click', () => showSaveModal(classes));

  // Print / Export
  container.querySelector('#export-pdf-btn').addEventListener('click', () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('No lesson content to print yet.', 'danger'); return; }
    const printWin = window.open('', '_blank');
    const planHtml = aiMsgs.map(m => md(m.content)).join('<hr style="margin:24px 0;">');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Lesson Plan — Co-Cher</title>
      <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.7;font-size:14px}
      h1{font-size:18px;border-bottom:2px solid #000c53;padding-bottom:8px;color:#000c53}
      h2,h3,h4{margin:16px 0 8px}strong{font-weight:600}ul,ol{padding-left:20px}
      hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
      pre{background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto}
      @media print{body{margin:0;padding:16px}}</style></head>
      <body><h1>Lesson Plan</h1><p style="color:#64748b;font-size:12px;">Exported from Co-Cher · ${new Date().toLocaleDateString('en-SG')}</p>${planHtml}</body></html>`);
    printWin.document.close();
    printWin.print();
  });

  // AI Review
  container.querySelector('#ai-review-btn').addEventListener('click', async () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Reviewing your lesson plan...</div></div>`;
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = aiMsgs.map(m => m.content).join('\n\n');
      const review = await reviewLesson(planText);
      resultEl.innerHTML = `
        <div class="card" style="padding:var(--sp-6);border-top:3px solid var(--accent);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
            <span style="font-size:0.9375rem;font-weight:600;color:var(--ink);">Lesson Review</span>
            <button class="btn btn-ghost btn-sm close-ai-result"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);">${md(review)}</div>
        </div>`;
      resultEl.querySelector('.close-ai-result')?.addEventListener('click', () => { resultEl.innerHTML = ''; });
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Review failed: ${err.message}</div>`;
    }
  });

  // AI Rubric
  container.querySelector('#ai-rubric-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const topic = chatMessages.find(m => m.role === 'user')?.content || 'General lesson';
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Generating rubric...</div></div>`;
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const rubric = await generateRubric(topic);
      resultEl.innerHTML = `
        <div class="card" style="padding:var(--sp-6);border-top:3px solid var(--success);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
            <span style="font-size:0.9375rem;font-weight:600;color:var(--ink);">Assessment Rubric</span>
            <button class="btn btn-ghost btn-sm close-ai-result"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);">${md(rubric)}</div>
        </div>`;
      resultEl.querySelector('.close-ai-result')?.addEventListener('click', () => { resultEl.innerHTML = ''; });
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Rubric generation failed: ${err.message}</div>`;
    }
  });

  // AI Grouping
  container.querySelector('#ai-group-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const allClasses = Store.getClasses();
    if (allClasses.length === 0 || allClasses.every(c => !c.students?.length)) {
      showToast('No students found. Add students to a class first.', 'danger');
      return;
    }
    showGroupingModal(container, allClasses);
  });
}

/* ── Messages render ── */
function renderMessages(el, classes) {
  if (!el) return;
  if (chatMessages.length === 0) {
    const prompts = buildQuickPrompts(classes || Store.getClasses());
    el.innerHTML = `
      <div style="padding:var(--sp-6) var(--sp-4);">
        <div style="text-align:center;max-width:380px;margin:0 auto;">
          <div style="width:52px;height:52px;margin:0 auto var(--sp-4);background:var(--accent-light);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;color:var(--accent);">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:var(--sp-2);color:var(--ink);">Chat with Co-Cher</h3>
          <p style="font-size:0.875rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-5);">
            Design engaging lesson experiences, spatial arrangements, and E21CC-aligned activities.
          </p>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
            ${prompts.map(p => `<button class="chat-option quick-prompt" data-prompt="${esc(p.prompt)}">${p.label}</button>`).join('')}
          </div>
        </div>
      </div>`;
  } else {
    el.innerHTML = chatMessages.map(m => `
      <div class="chat-msg ${m.role === 'user' ? 'user' : 'ai'}">
        ${m.role === 'user' ? esc(m.content) : md(m.content)}
      </div>
    `).join('');
  }
  if (isGenerating) el.insertAdjacentHTML('beforeend', `<div class="chat-typing">Co-Cher is thinking...</div>`);
  el.scrollTop = el.scrollHeight;
}

/* ── Plan content (right panel) ── */
function renderPlanContent(el) {
  if (!el) return;
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');

  if (aiMsgs.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding:var(--sp-10);">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <h3 class="empty-state-title">Your lesson plan</h3>
        <p class="empty-state-text">Start chatting with Co-Cher to collaboratively design your lesson.</p>
      </div>`;
    return;
  }

  // Show the latest AI response as the working plan
  const latest = aiMsgs[aiMsgs.length - 1].content;
  el.innerHTML = `
    <div class="card" style="padding:var(--sp-6);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
        <span class="text-overline" style="color:var(--ink-faint);">Latest from Co-Cher</span>
        <span class="badge badge-blue badge-dot">${aiMsgs.length} exchange${aiMsgs.length > 1 ? 's' : ''}</span>
      </div>
      <div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);">${md(latest)}</div>
    </div>
    ${aiMsgs.length > 1 ? `
      <details style="margin-top:var(--sp-4);">
        <summary style="cursor:pointer;font-size:0.8125rem;font-weight:500;color:var(--ink-muted);padding:var(--sp-2) 0;">
          View earlier responses (${aiMsgs.length - 1})
        </summary>
        <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3);">
          ${aiMsgs.slice(0, -1).reverse().map((m, i) => `
            <div class="card" style="padding:var(--sp-4);opacity:${0.9 - i * 0.1};">
              <div style="font-size:0.8125rem;line-height:1.6;color:var(--ink-muted);">${md(m.content)}</div>
            </div>
          `).join('')}
        </div>
      </details>
    ` : ''}
  `;
}

/* ── Save lesson modal ── */
function showSaveModal(classes) {
  if (chatMessages.length === 0) {
    showToast('Chat with Co-Cher first before saving.', 'danger');
    return;
  }

  const existing = currentLessonId ? Store.getLesson(currentLessonId) : null;

  // Auto-suggest class linkage if there's context
  const suggestedClassId = existing?.classId || '';

  const { backdrop, close } = openModal({
    title: existing ? 'Update Lesson' : 'Save Lesson',
    body: `
      <div class="input-group">
        <label class="input-label">Lesson Title</label>
        <input class="input" id="save-title" value="${escAttr(existing?.title || suggestTitle())}" placeholder="e.g. Exploring Fractions — P4 Maths" />
      </div>
      <div class="input-group">
        <label class="input-label">Link to Class (optional)</label>
        <select class="input" id="save-class">
          <option value="">No class</option>
          ${classes.map(c => `<option value="${c.id}" ${suggestedClassId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Status</label>
        <select class="input" id="save-status">
          <option value="draft" ${(!existing || existing.status === 'draft') ? 'selected' : ''}>Draft</option>
          <option value="ready" ${existing?.status === 'ready' ? 'selected' : ''}>Ready to Teach</option>
          <option value="completed" ${existing?.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">E21CC Focus</label>
        <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cait" class="e21cc-check" ${existing?.e21ccFocus?.includes('cait') ? 'checked' : ''} /> CAIT
          </label>
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cci" class="e21cc-check" ${existing?.e21ccFocus?.includes('cci') ? 'checked' : ''} /> CCI
          </label>
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cgc" class="e21cc-check" ${existing?.e21ccFocus?.includes('cgc') ? 'checked' : ''} /> CGC
          </label>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">${existing ? 'Update' : 'Save Lesson'}</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const title = backdrop.querySelector('#save-title').value.trim() || 'Untitled Lesson';
    const classId = backdrop.querySelector('#save-class').value || null;
    const status = backdrop.querySelector('#save-status').value;
    const e21ccFocus = [...backdrop.querySelectorAll('.e21cc-check:checked')].map(cb => cb.value);

    const data = {
      title,
      classId,
      status,
      e21ccFocus,
      chatHistory: [...chatMessages],
      plan: chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n---\n\n')
    };

    if (existing) {
      Store.updateLesson(currentLessonId, data);
      showToast('Lesson updated!', 'success');
    } else {
      const lesson = Store.addLesson(data);
      currentLessonId = lesson.id;
      showToast('Lesson saved!', 'success');
    }
    close();
  });

  setTimeout(() => backdrop.querySelector('#save-title')?.focus(), 100);
}

function suggestTitle() {
  const firstUser = chatMessages.find(m => m.role === 'user');
  if (!firstUser) return '';
  return firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '...' : '');
}

function escAttr(s) { return (s || '').replace(/"/g, '&quot;'); }

/* ── AI Grouping Modal ── */
function showGroupingModal(container, classes) {
  const classesWithStudents = classes.filter(c => c.students?.length > 0);

  const { backdrop, close } = openModal({
    title: 'AI Student Grouping',
    body: `
      <div class="input-group">
        <label class="input-label">Select Class</label>
        <select class="input" id="group-class">
          ${classesWithStudents.map(c => `<option value="${c.id}">${c.name} (${c.students.length} students)</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Activity Type</label>
        <select class="input" id="group-activity">
          <option value="Collaborative group work">Collaborative group work</option>
          <option value="Peer tutoring">Peer tutoring</option>
          <option value="Jigsaw activity">Jigsaw activity</option>
          <option value="Debate or discussion">Debate / discussion</option>
          <option value="Project-based learning">Project-based learning</option>
          <option value="Competition">Competition</option>
          <option value="Lab work">Lab / practical work</option>
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="generate">Generate Groups</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
    const classId = backdrop.querySelector('#group-class').value;
    const activityType = backdrop.querySelector('#group-activity').value;
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    close();

    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Analysing E21CC profiles and creating groups...</div></div>`;
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const grouping = await suggestGrouping(cls.students, activityType);
      resultEl.innerHTML = `
        <div class="card" style="padding:var(--sp-6);border-top:3px solid var(--e21cc-cci);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
            <div>
              <span style="font-size:0.9375rem;font-weight:600;color:var(--ink);">Student Groups</span>
              <span style="font-size:0.75rem;color:var(--ink-muted);margin-left:var(--sp-2);">${cls.name} · ${activityType}</span>
            </div>
            <button class="btn btn-ghost btn-sm close-ai-result"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);">${md(grouping)}</div>
        </div>`;
      resultEl.querySelector('.close-ai-result')?.addEventListener('click', () => { resultEl.innerHTML = ''; });
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Grouping failed: ${err.message}</div>`;
    }
  });
}
