/*
 * Co-Cher Lesson Planner
 * ======================
 * AI chat interface for lesson experience design and planning.
 * Spatial Designer is complementary and on by default.
 */

import { Store } from '../state.js';
import { sendChat } from '../api.js';
import { showToast } from '../components/toast.js';

let chatMessages = [];
let isGenerating = false;

function renderMarkdown(text) {
  // Simple markdown: bold, italic, headers, bullets, code
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.06);padding:8px 12px;border-radius:8px;font-size:0.8rem;overflow-x:auto;margin:6px 0;"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:0.95rem;font-weight:600;margin:8px 0 4px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:10px 0 4px;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h3 style="font-size:1.05rem;font-weight:700;margin:12px 0 4px;">$1</h3>')
    .replace(/^[-*] (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul style="padding-left:1.25rem;margin:4px 0;">${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/\n{2,}/g, '</p><p style="margin:4px 0;">')
    .replace(/\n/g, '<br>');
}

export function render(container) {
  container.innerHTML = `
    <div class="lp-layout" style="height: 100%;">
      <!-- Chat Column -->
      <div class="lp-chat-col">
        <div class="chat-header">
          <div class="chat-header-title">Co-Cher Assistant</div>
          <div class="chat-header-subtitle">Bounce ideas on lesson experience, design & planning</div>
        </div>

        <div class="chat-messages" id="chat-messages">
          ${chatMessages.length === 0 ? `
            <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
              <div style="text-align: center; max-width: 300px;">
                <div style="
                  width: 48px; height: 48px; margin: 0 auto var(--sp-4);
                  background: var(--accent-light); border-radius: var(--radius-lg);
                  display: flex; align-items: center; justify-content: center;
                  color: var(--accent);
                ">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3 style="font-size: 1.0625rem; font-weight: 600; margin-bottom: var(--sp-2); color: var(--ink);">Start a conversation</h3>
                <p style="font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.6; margin-bottom: var(--sp-5);">
                  I can help you design engaging lesson experiences, consider spatial arrangements, align with E21CC frameworks, and more.
                </p>
                <div style="display: flex; flex-direction: column; gap: var(--sp-2);">
                  <button class="chat-option quick-prompt" data-prompt="Help me plan an engaging lesson on fractions for Primary 4">Plan a fractions lesson</button>
                  <button class="chat-option quick-prompt" data-prompt="What spatial arrangement works best for collaborative group work?">Best layouts for group work</button>
                  <button class="chat-option quick-prompt" data-prompt="How can I develop Critical, Adaptive and Inventive Thinking in a Science lesson?">Develop CAIT in Science</button>
                </div>
              </div>
            </div>
          ` : chatMessages.map(m => `
            <div class="chat-msg ${m.role === 'user' ? 'user' : 'ai'}">
              ${m.role === 'user' ? escapeHtml(m.content) : renderMarkdown(m.content)}
            </div>
          `).join('')}
          ${isGenerating ? `<div class="chat-typing">Co-Cher is thinking...</div>` : ''}
        </div>

        <div class="chat-input-row">
          <textarea class="chat-input" id="chat-input" placeholder="Describe your lesson idea, ask about spatial design, or explore frameworks..." rows="1"></textarea>
          <button class="chat-send" id="chat-send" ${isGenerating ? 'disabled' : ''}>Send</button>
        </div>
      </div>

      <!-- Plan / Spatial Column -->
      <div class="lp-plan-col" style="background: var(--bg);">
        <div style="flex: 1; overflow-y: auto; padding: var(--sp-6);">
          <div style="max-width: 680px; margin: 0 auto;">

            <!-- Spatial toggle -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-6);">
              <div>
                <h2 style="font-size: 1.125rem; font-weight: 600; color: var(--ink);">Lesson Canvas</h2>
                <p style="font-size: 0.8125rem; color: var(--ink-muted);">Your lesson plan builds here as you chat</p>
              </div>
              <div class="tab-group">
                <button class="tab active" data-panel="plan">Plan</button>
                <button class="tab" data-panel="spatial">Spatial</button>
              </div>
            </div>

            <!-- Plan View -->
            <div id="plan-view">
              ${chatMessages.some(m => m.role === 'assistant') ? `
                <div class="card" style="padding: var(--sp-6);">
                  <p style="color: var(--ink-muted); font-size: 0.875rem; line-height: 1.6;">
                    Continue chatting to build your lesson plan. As you discuss objectives, activities, grouping strategies, and spatial arrangements, your plan will take shape here.
                  </p>
                </div>
              ` : `
                <div class="empty-state" style="padding: var(--sp-12);">
                  <div class="empty-state-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <h3 class="empty-state-title">Your lesson plan</h3>
                  <p class="empty-state-text">Start chatting with Co-Cher to collaboratively design your lesson. Discuss objectives, activities, student experience, and spatial arrangement.</p>
                </div>
              `}
            </div>

            <!-- Spatial View (hidden by default) -->
            <div id="spatial-view" style="display: none;">
              <div class="card" style="padding: var(--sp-8); text-align: center;">
                <div style="
                  width: 56px; height: 56px; margin: 0 auto var(--sp-4);
                  background: var(--success-light); border-radius: var(--radius-lg);
                  display: flex; align-items: center; justify-content: center;
                  color: var(--success);
                ">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                </div>
                <h3 style="font-size: 1.0625rem; font-weight: 600; margin-bottom: var(--sp-2); color: var(--ink);">Spatial Designer</h3>
                <p style="font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.6; max-width: 320px; margin: 0 auto var(--sp-5);">
                  The full spatial classroom designer is coming in the next update. For now, discuss classroom arrangements with Co-Cher and she'll suggest optimal layouts.
                </p>
                <span class="badge badge-green badge-dot">Coming in Phase 4</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('[data-panel]').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('[data-panel]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const panel = tab.dataset.panel;
      container.querySelector('#plan-view').style.display = panel === 'plan' ? 'block' : 'none';
      container.querySelector('#spatial-view').style.display = panel === 'spatial' ? 'block' : 'none';
    });
  });

  // Chat send
  const chatInput = container.querySelector('#chat-input');
  const chatSend = container.querySelector('#chat-send');
  const messagesEl = container.querySelector('#chat-messages');

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || isGenerating) return;

    if (!Store.get('apiKey')) {
      showToast('Please set your API key in Settings first.', 'danger');
      return;
    }

    // Add user message
    chatMessages.push({ role: 'user', content: text });
    chatInput.value = '';
    chatInput.style.height = 'auto';
    isGenerating = true;

    // Re-render messages area only
    updateMessages(messagesEl);

    try {
      const response = await sendChat(chatMessages);
      chatMessages.push({ role: 'assistant', content: response });
    } catch (err) {
      chatMessages.push({ role: 'assistant', content: `I encountered an error: ${err.message}. Please check your API key in Settings.` });
      showToast(err.message, 'danger');
    } finally {
      isGenerating = false;
      updateMessages(messagesEl);
    }
  }

  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  // Quick prompts
  container.querySelectorAll('.quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.prompt;
      sendMessage();
    });
  });
}

function updateMessages(messagesEl) {
  if (!messagesEl) return;

  let html = '';
  if (chatMessages.length === 0) {
    html = `<div style="flex:1;display:flex;align-items:center;justify-content:center;"><p style="color:var(--ink-muted);font-style:italic;">Start a conversation above.</p></div>`;
  } else {
    html = chatMessages.map(m => `
      <div class="chat-msg ${m.role === 'user' ? 'user' : 'ai'}">
        ${m.role === 'user' ? escapeHtml(m.content) : renderMarkdown(m.content)}
      </div>
    `).join('');
  }

  if (isGenerating) {
    html += `<div class="chat-typing">Co-Cher is thinking...</div>`;
  }

  messagesEl.innerHTML = html;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
