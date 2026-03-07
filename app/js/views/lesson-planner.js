/*
 * Co-Cher Lesson Planner
 * ======================
 * AI chat + plan canvas with save / link-to-class / export.
 * Phase 3: Subject-aware prompts, status badge, undo, mobile toggle, improved markdown.
 */

import { Store } from '../state.js';
import { sendChat, reviewLesson, generateRubric, suggestGrouping, generateExitTicket, suggestDifferentiation, generateTimeline, suggestSeatAssignment, suggestYouTubeVideos, suggestSimulations, generateWorksheet, generateDiscussionPrompts, suggestExternalResources } from '../api.js';
import { showToast } from '../components/toast.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { navigate } from '../router.js';
import { getCurrentUser } from '../components/login.js';
import { loadTT, findTeacherRow } from './dashboard.js';

let chatMessages = [];
let isGenerating = false;
let currentLessonId = null;  // if editing a saved lesson
let planClassContext = null;  // class context from "Plan from Class"
let attachedKBContext = [];   // attached knowledge base resources
let lessonDateTime = null;    // { date, period, room, classCode } from timetable or manual

/* ── Lesson Components: persistent AI tool results integrated into the plan ── */
let lessonComponents = {};    // { review, rubric, grouping, timeline, exitTicket, differentiation, seatPlan }

/* ── Toolbar display preference ── */
const LP_PREFS_KEY = 'cocher_lp_prefs';
function getLPPrefs() {
  try { const r = localStorage.getItem(LP_PREFS_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function saveLPPrefs(p) {
  try { localStorage.setItem(LP_PREFS_KEY, JSON.stringify(p)); } catch {}
}

/* ── Active component tab ── */
let activeComponentTab = null;  // null = show all (auto-select first)

const COMPONENT_META = {
  timeline:        { label: 'Timeline / Pacing',       color: 'var(--accent)',      icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', order: 1 },
  grouping:        { label: 'Student Groups',          color: 'var(--e21cc-cci)',   icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', order: 2 },
  seatPlan:        { label: 'Seating Plan',            color: 'var(--e21cc-cgc)',   icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>', order: 3 },
  differentiation: { label: 'Differentiation',         color: 'var(--e21cc-cait)',  icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>', order: 4 },
  rubric:          { label: 'Assessment Rubric',       color: 'var(--success)',     icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>', order: 5 },
  exitTicket:      { label: 'Exit Ticket',             color: 'var(--e21cc-cait)',  icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', order: 6 },
  review:          { label: 'Lesson Review',           color: 'var(--accent)',      icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', order: 7 },
  youtubeVideos:   { label: 'YouTube Videos',          color: '#ff0000',            icon: '<polygon points="5 3 19 12 5 21 5 3"/>', order: 8 },
  simulations:     { label: 'Simulation Models',        color: '#8b5cf6',            icon: '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5"/><circle cx="12" cy="12" r="10"/>', order: 9 },
  worksheet:       { label: 'Worksheet / Handout',      color: 'var(--info, #3b82f6)',icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>', order: 10 },
  discussionPrompts: { label: 'Discussion Prompts',     color: 'var(--warning, #f59e0b)', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', order: 11 },
  externalLinks:   { label: 'External Resources',       color: 'var(--success, #22c55e)', icon: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>', order: 12 },
};

function setComponent(key, content, meta = '') {
  lessonComponents[key] = { content, meta, updatedAt: Date.now() };
  autoSaveComponents();
}

function removeComponent(key) {
  delete lessonComponents[key];
  autoSaveComponents();
}

function autoSaveComponents() {
  if (currentLessonId) {
    Store.updateLesson(currentLessonId, { components: { ...lessonComponents } });
  }
}

function renderComponents(container) {
  const el = container.querySelector('#lesson-components');
  if (!el) return;

  const keys = Object.keys(lessonComponents)
    .filter(k => lessonComponents[k]?.content)
    .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));

  if (keys.length === 0) {
    el.innerHTML = '';
    activeComponentTab = null;
    return;
  }

  // Auto-select first tab if none active or current tab removed
  if (!activeComponentTab || !keys.includes(activeComponentTab)) {
    activeComponentTab = keys[0];
  }

  const activeComp = lessonComponents[activeComponentTab];
  const activeMeta = COMPONENT_META[activeComponentTab] || { label: activeComponentTab, color: 'var(--ink-muted)', icon: '', order: 99 };

  el.innerHTML = `
    <div style="margin-top:var(--sp-5);">
      <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
        <span class="text-overline" style="color:var(--ink-faint);">Lesson Components</span>
        <span class="badge badge-blue" style="font-size:0.6875rem;">${keys.length}</span>
      </div>

      <!-- Component Tabs -->
      <div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:var(--sp-3);border-bottom:2px solid var(--border-light);padding-bottom:0;">
        ${keys.map(key => {
          const m = COMPONENT_META[key] || { label: key, color: 'var(--ink-muted)', icon: '' };
          const isActive = key === activeComponentTab;
          return `<button class="component-tab" data-tab="${key}" style="
            display:inline-flex;align-items:center;gap:4px;padding:6px 10px;font-size:0.75rem;font-weight:${isActive ? '600' : '400'};
            color:${isActive ? 'var(--accent)' : 'var(--ink-muted)'};background:${isActive ? 'var(--accent-light)' : 'transparent'};
            border:none;border-bottom:2px solid ${isActive ? 'var(--accent)' : 'transparent'};margin-bottom:-2px;
            border-radius:var(--radius-md) var(--radius-md) 0 0;cursor:pointer;transition:all 0.15s;white-space:nowrap;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isActive ? m.color : 'currentColor'}" stroke-width="2">${m.icon}</svg>
            ${m.label}
          </button>`;
        }).join('')}
      </div>

      <!-- Active Component Content -->
      <div class="card" style="border-top:3px solid ${activeMeta.color};overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${activeMeta.color}" stroke-width="2">${activeMeta.icon}</svg>
            <span style="font-size:0.875rem;font-weight:600;color:var(--ink);">${activeMeta.label}</span>
            ${activeComp.meta ? `<span style="font-size:0.6875rem;color:var(--ink-faint);">${esc(activeComp.meta)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-1);">
            <button class="btn btn-ghost btn-sm component-refresh" data-key="${activeComponentTab}" title="Regenerate" style="padding:2px 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm component-remove" data-key="${activeComponentTab}" title="Remove" style="padding:2px 4px;color:var(--danger);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div style="padding:var(--sp-4);font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);max-height:600px;overflow-y:auto;">
          ${md(activeComp.content)}
        </div>
      </div>
    </div>`;

  // Wire remove buttons
  el.querySelectorAll('.component-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.key;
      removeComponent(key);
      renderComponents(container);
    });
  });

  // Wire refresh buttons
  el.querySelectorAll('.component-refresh').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.key;
      // Trigger the corresponding tool
      const toolBtnMap = {
        review: '#ai-review-btn',
        rubric: '#ai-rubric-btn',
        grouping: '#ai-group-btn',
        timeline: '#ai-timeline-btn',
        exitTicket: '#ai-exit-ticket-btn',
        differentiation: '#ai-differentiation-btn',
        youtubeVideos: '#ai-youtube-btn',
        simulations: '#ai-simulations-btn',
        worksheet: '#ai-worksheet-btn',
        discussionPrompts: '#ai-discussion-btn',
        externalLinks: '#ai-external-btn',
      };
      if (toolBtnMap[key]) container.querySelector(toolBtnMap[key])?.click();
    });
  });

  // Wire tab clicks
  el.querySelectorAll('.component-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeComponentTab = tab.dataset.tab;
      renderComponents(container);
    });
  });
}

/* ── Markdown renderer (improved — supports tables, links, YouTube embeds) ── */
function md(text) {
  // Preserve markdown links before HTML-escaping by extracting them first
  const linkPlaceholders = [];
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
    const idx = linkPlaceholders.length;
    linkPlaceholders.push({ label, url });
    return `%%MDLINK_${idx}%%`;
  });

  // Preserve bare URLs before escaping
  const bareUrlPlaceholders = [];
  text = text.replace(/(?<!["\(=\[])(https?:\/\/[^\s<)"]+)/g, (url) => {
    const idx = bareUrlPlaceholders.length;
    bareUrlPlaceholders.push(url);
    return `%%BAREURL_${idx}%%`;
  });

  let result = text
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
    // Blockquotes (for "copy this prompt" sections)
    .replace(/&gt; (.+)/g, '<blockquote style="border-left:3px solid var(--accent);padding:8px 12px;margin:6px 0;background:var(--accent-light,rgba(67,97,238,0.06));border-radius:0 6px 6px 0;font-size:0.8125rem;color:var(--ink-secondary);">$1</blockquote>')
    // Paragraphs
    .replace(/\n{2,}/g, '</p><p style="margin:4px 0;">')
    .replace(/\n/g, '<br>');

  // Restore markdown links with rich rendering
  result = result.replace(/%%MDLINK_(\d+)%%/g, (_, idx) => {
    const { label, url } = linkPlaceholders[parseInt(idx)];
    // YouTube video URL → inline embed preview
    const ytWatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (ytWatch) {
      return `<div style="margin:8px 0;">
        <a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff0000" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="#fff"/></svg>
          ${label}
        </a>
        <div style="margin-top:6px;border-radius:8px;overflow:hidden;max-width:480px;aspect-ratio:16/9;background:#000;">
          <iframe src="https://www.youtube-nocookie.com/embed/${ytWatch[1]}" style="width:100%;height:100%;border:none;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>`;
    }
    // YouTube search URL → styled red search button
    if (url.includes('youtube.com/results?search_query=')) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:#ff0000;color:#fff;border-radius:6px;font-size:0.75rem;font-weight:500;text-decoration:none;margin:2px 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="#fff"/></svg>
        ${label}
      </a>`;
    }
    // Simulation platform links → styled accent button
    if (/phet\.colorado\.edu|geogebra\.org|desmos\.com|falstad\.com|labxchange\.org|chemcollective\.org/.test(url)) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:var(--accent,#4361ee);color:#fff;border-radius:6px;font-size:0.75rem;font-weight:500;text-decoration:none;margin:2px 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${label}
      </a>`;
    }
    // General link
    return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">${label}</a>`;
  });

  // Restore bare URLs
  result = result.replace(/%%BAREURL_(\d+)%%/g, (_, idx) => {
    const url = bareUrlPlaceholders[parseInt(idx)];
    if (url.includes('youtube.com/results?search_query=')) {
      const q = decodeURIComponent(url.split('search_query=')[1] || '').replace(/\+/g, ' ');
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:#ff0000;color:#fff;border-radius:6px;font-size:0.75rem;font-weight:500;text-decoration:none;margin:2px 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="#fff"/></svg>
        Search: ${esc(q.slice(0, 50))}
      </a>`;
    }
    if (/phet\.colorado\.edu|geogebra\.org|desmos\.com|falstad\.com/.test(url)) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:var(--accent,#4361ee);color:#fff;border-radius:6px;font-size:0.75rem;font-weight:500;text-decoration:none;margin:2px 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Open: ${url.split('/').pop() || url}
      </a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">${url}</a>`;
  });

  return result;
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ── Build quick prompts based on classes/subjects ── */
function buildQuickPrompts(classes) {
  const prompts = [];

  // Use planClassContext first if available
  const subjects = planClassContext?.subject
    ? [planClassContext.subject]
    : [...new Set(classes.map(c => c.subject).filter(Boolean))];
  const levels = planClassContext?.level
    ? [planClassContext.level]
    : [...new Set(classes.map(c => c.level).filter(Boolean))];

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

/* ── AI Tool definitions for compact toolbar ── */
const AI_TOOLS = [
  { id: 'ai-review-btn', label: 'Review', icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', color: '', cat: 'planning' },
  { id: 'ai-rubric-btn', label: 'Rubric', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>', color: '', cat: 'assess' },
  { id: 'ai-group-btn', label: 'Grouping', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', color: '', cat: 'planning' },
  { id: 'ai-timeline-btn', label: 'Timeline', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', color: '', cat: 'planning' },
  { id: 'ai-exit-ticket-btn', label: 'Exit Ticket', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', color: '', cat: 'assess' },
  { id: 'ai-differentiation-btn', label: 'Differentiate', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>', color: '', cat: 'planning' },
  { id: 'ai-youtube-btn', label: 'YouTube', icon: '<polygon points="5 3 19 12 5 21 5 3"/>', color: '#ff0000', cat: 'resources' },
  { id: 'ai-simulations-btn', label: 'Simulations', icon: '<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5"/><circle cx="12" cy="12" r="10"/>', color: '#8b5cf6', cat: 'resources' },
  { id: 'ai-worksheet-btn', label: 'Worksheet', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', color: '', cat: 'resources' },
  { id: 'ai-discussion-btn', label: 'Discussion', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', color: '', cat: 'planning' },
  { id: 'ai-external-btn', label: 'Resources', icon: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>', color: '', cat: 'resources' },
  { id: 'spatial-layout-btn', label: 'Spatial Layout', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>', color: '', cat: 'planning' }
];

function buildToolbarHTML(mode) {
  if (mode === 'dropdown') {
    const cats = { planning: 'Planning', assess: 'Assessment', resources: 'Resources' };
    return Object.entries(cats).map(([cat, label]) => {
      const tools = AI_TOOLS.filter(t => t.cat === cat);
      return `<div style="margin-bottom:var(--sp-2);">
        <div style="font-size:0.625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);margin-bottom:2px;">${label}</div>
        ${tools.map(t => `<button class="btn btn-ghost btn-sm" id="${t.id}" title="${t.label}" style="width:100%;text-align:left;justify-content:flex-start;gap:var(--sp-2);${t.color ? 'color:' + t.color + ';' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.icon}</svg>
          <span style="font-size:0.8125rem;">${t.label}</span>
        </button>`).join('')}
      </div>`;
    }).join('');
  }
  // Icon mode — compact buttons with tooltip on hover
  return AI_TOOLS.map(t =>
    `<button class="btn btn-ghost btn-sm lp-tool-icon" id="${t.id}" title="${t.label}" style="padding:6px;${t.color ? 'color:' + t.color + ';' : ''}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.icon}</svg>
    </button>`
  ).join('');
}

/* ══════════ Main render ══════════ */
export function render(container) {
  const classes = Store.getClasses();
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;

  // Pick up "Plan from Class" context from sessionStorage
  const planClassId = sessionStorage.getItem('cocher_plan_class_id');
  if (planClassId && !currentLessonId && chatMessages.length === 0) {
    planClassContext = {
      id: planClassId,
      name: sessionStorage.getItem('cocher_plan_class_name') || '',
      subject: sessionStorage.getItem('cocher_plan_class_subject') || '',
      level: sessionStorage.getItem('cocher_plan_class_level') || ''
    };
    sessionStorage.removeItem('cocher_plan_class_id');
    sessionStorage.removeItem('cocher_plan_class_name');
    sessionStorage.removeItem('cocher_plan_class_subject');
    sessionStorage.removeItem('cocher_plan_class_level');
  }

  // Pick up spatial layout link from Spatial Designer
  const incomingSpatialId = sessionStorage.getItem('cocher_link_spatial_layout');
  if (incomingSpatialId) {
    sessionStorage.removeItem('cocher_link_spatial_layout');
    // If we have an existing lesson, link it; otherwise store for linking on save
    if (currentLessonId) {
      Store.updateLesson(currentLessonId, { spatialLayout: incomingSpatialId });
    }
    // Store so the spatial section renders the link
    if (!currentLessonId) {
      sessionStorage.setItem('cocher_pending_spatial_layout', incomingSpatialId);
    }
  }

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

        ${planClassContext ? `
          <div class="chat-context-banner" id="class-context-banner" style="flex-shrink:0;padding:var(--sp-2) var(--sp-4);background:var(--accent-light);border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:0.8125rem;color:var(--accent-dark);">
              <strong>Planning for:</strong> ${planClassContext.name}${planClassContext.subject ? ' · ' + planClassContext.subject : ''}${planClassContext.level ? ' · ' + planClassContext.level : ''}
            </span>
            <button class="btn btn-ghost btn-sm" id="clear-class-context" style="padding:2px 6px;font-size:0.75rem;">Clear</button>
          </div>
        ` : ''}

        <!-- KB Context Attachments -->
        <div id="kb-context-bar" style="flex-shrink:0;${attachedKBContext.length > 0 ? '' : 'display:none;'}padding:var(--sp-2) var(--sp-4);background:var(--bg-subtle);border-bottom:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;">
            <span style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);">Context:</span>
            <div id="kb-chips" style="display:flex;gap:var(--sp-1);flex-wrap:wrap;"></div>
          </div>
        </div>

        <div class="chat-messages" id="chat-messages" style="flex:1;min-height:0;overflow-y:auto;"></div>

        <div class="chat-input-row" style="flex-shrink:0;">
          <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-2);">
            <button class="btn btn-ghost btn-sm" id="attach-kb-btn" title="Attach Knowledge Base resource as context" style="font-size:0.75rem;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              Attach Context
            </button>
          </div>
          <textarea class="chat-input" id="chat-input" placeholder="${planClassContext ? `Plan a lesson for ${planClassContext.name}...` : 'Describe your lesson idea, ask about spatial design, or explore frameworks...'}" rows="3"></textarea>
          <button class="chat-send" id="chat-send" ${isGenerating ? 'disabled' : ''}>Send</button>
        </div>
      </div>

      <!-- Resize Handle -->
      <div class="resize-handle" id="lp-resize-handle"></div>

      <!-- Plan Column -->
      <div class="lp-plan-col" style="background:var(--bg);">
        <div style="flex:1;overflow-y:auto;padding:var(--sp-6);">
          <div style="max-width:680px;margin:0 auto;width:100%;box-sizing:border-box;">
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
                <button class="btn btn-ghost btn-sm" id="export-word-btn" title="Export as Word document (.doc)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Word
                </button>
                <button class="btn btn-ghost btn-sm" id="share-lesson-btn" title="Share lesson with a colleague (export/import JSON)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
                <div style="position:relative;display:inline-block;">
                  <button class="btn btn-ghost btn-sm" id="templates-btn" title="Start from a lesson template">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    Templates
                  </button>
                </div>
              </div>
            </div>

            <!-- Lesson Date/Time -->
            <div id="lesson-datetime-bar" style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-4);padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);flex-wrap:wrap;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input type="date" id="lesson-date" class="input" style="width:auto;padding:4px 8px;font-size:0.8125rem;" />
              <select id="lesson-period" class="input" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
                <option value="">Period</option>
                <option value="1">P1 (7:30)</option><option value="2">P2 (8:10)</option>
                <option value="3">P3 (8:50)</option><option value="4">P4 (9:30)</option>
                <option value="5">P5 (10:20)</option><option value="6">P6 (11:00)</option>
                <option value="7">P7 (11:40)</option><option value="8">P8 (12:20)</option>
                <option value="9">P9 (1:10)</option><option value="10">P10 (1:50)</option>
                <option value="11">P11 (2:30)</option>
              </select>
              <div id="lesson-tt-hint" style="font-size:0.75rem;color:var(--ink-muted);flex:1;min-width:120px;"></div>
            </div>

            <!-- AI Tools Bar (compact icons with tooltips, toggleable to dropdown) -->
            <div id="ai-tools-bar" style="margin-bottom:var(--sp-4);">
              <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2);">
                <span style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);">AI Tools</span>
                <button class="btn btn-ghost btn-sm" id="toggle-toolbar-mode" title="Switch between icon bar and dropdown" style="padding:2px 6px;font-size:0.625rem;color:var(--ink-faint);">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>
              <div id="ai-tools-icons" style="display:flex;flex-wrap:wrap;gap:4px;">
                ${buildToolbarHTML(getLPPrefs().toolbarMode || 'icons')}
              </div>
            </div>

            <!-- Spatial Context Bar (when layout linked) -->
            <div id="spatial-context-bar" style="display:none;margin-bottom:var(--sp-4);"></div>

            <!-- Plan Content -->
            <div id="plan-content"></div>

            <!-- Integrated Lesson Components (persistent AI tool results) -->
            <div id="lesson-components"></div>

            <!-- Spatial Layout Section -->
            <div id="spatial-section" style="margin-top:var(--sp-4);"></div>

            <!-- Temporary loading/status area -->
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

  // Load components from existing lesson
  if (currentLessonId) {
    const existingLesson = Store.getLesson(currentLessonId);
    if (existingLesson?.components) {
      lessonComponents = { ...existingLesson.components };
    }
  }

  // Render initial messages
  renderMessages(messagesEl, classes);
  renderPlanContent(container.querySelector('#plan-content'));
  renderComponents(container);

  // Mobile panel toggle
  const showPlanBtn = container.querySelector('#show-plan-btn');
  const showChatBtn = container.querySelector('#show-chat-btn');
  if (showPlanBtn) {
    showPlanBtn.addEventListener('click', () => layoutEl.classList.add('show-plan'));
  }
  if (showChatBtn) {
    showChatBtn.addEventListener('click', () => layoutEl.classList.remove('show-plan'));
  }

  // Resizable panels
  initResizeHandle(
    container.querySelector('#lp-resize-handle'),
    container.querySelector('.lp-chat-col'),
    container.querySelector('.lp-plan-col'),
    layoutEl
  );

  // New chat
  container.querySelector('#new-chat-btn').addEventListener('click', () => {
    chatMessages = [];
    currentLessonId = null;
    isGenerating = false;
    lessonComponents = {};
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

    // Build context-enriched message
    let contextParts = [];
    if (planClassContext && chatMessages.length === 0) {
      contextParts.push(`[Class Context: ${planClassContext.name}, ${planClassContext.level} ${planClassContext.subject}]`);
    }
    // Inject spatial layout context if linked
    if (chatMessages.length === 0) {
      const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
      const linkedLayoutId = currentLesson?.spatialLayout;
      if (linkedLayoutId) {
        const layout = (Store.getSavedLayouts() || []).find(l => l.id === linkedLayoutId);
        if (layout) {
          const presetLabel = PRESET_NAMES[layout.preset] || 'Custom';
          contextParts.push(`[Spatial Layout: ${presetLabel} arrangement, ${layout.studentCount || '?'} students, ${layout.items?.length || 0} furniture items]`);
        }
      }
    }
    if (attachedKBContext.length > 0) {
      contextParts.push(...attachedKBContext.map(kb =>
        `[Reference — ${kb.title}]:\n${kb.content.slice(0, 2000)}`
      ));
    }

    const enrichedContent = contextParts.length > 0 && chatMessages.length === 0
      ? `${contextParts.join('\n\n')}\n\n${text}`
      : text;

    chatMessages.push({ role: 'user', content: enrichedContent });
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

  // Class context banner
  container.querySelector('#clear-class-context')?.addEventListener('click', () => {
    planClassContext = null;
    container.querySelector('#class-context-banner')?.remove();
    chatInput.placeholder = 'Describe your lesson idea, ask about spatial design, or explore frameworks...';
  });

  // KB context chips
  renderKBChips(container);

  // Attach KB context
  container.querySelector('#attach-kb-btn')?.addEventListener('click', () => {
    showAttachKBModal(container);
  });

  // Quick prompts
  messagesEl.addEventListener('click', e => {
    const btn = e.target.closest('.quick-prompt');
    if (btn) { chatInput.value = btn.dataset.prompt; sendMessage(); }
  });

  // Save lesson
  container.querySelector('#save-lesson-btn').addEventListener('click', () => showSaveModal(classes));

  // Print / Export (includes all components)
  container.querySelector('#export-pdf-btn').addEventListener('click', () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
      showToast('No lesson content to print yet.', 'danger'); return;
    }
    const printWin = window.open('', '_blank');
    const planHtml = aiMsgs.map(m => md(m.content)).join('<hr style="margin:24px 0;">');

    // Build components HTML for print
    const compKeys = Object.keys(lessonComponents)
      .filter(k => lessonComponents[k]?.content)
      .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));
    const componentsHtml = compKeys.length > 0
      ? `<hr style="margin:32px 0;border-top:2px solid #000c53;"><h2>Lesson Components</h2>` +
        compKeys.map(key => {
          const m = COMPONENT_META[key] || { label: key };
          return `<h3>${m.label}</h3>${md(lessonComponents[key].content)}`;
        }).join('<hr style="margin:24px 0;">')
      : '';

    printWin.document.write(`<!DOCTYPE html><html><head><title>Lesson Plan — Co-Cher</title>
      <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.7;font-size:14px}
      h1{font-size:18px;border-bottom:2px solid #000c53;padding-bottom:8px;color:#000c53}
      h2,h3,h4{margin:16px 0 8px}strong{font-weight:600}ul,ol{padding-left:20px}
      hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
      pre{background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto}
      @media print{body{margin:0;padding:16px}}</style></head>
      <body><h1>Lesson Plan</h1><p style="color:#64748b;font-size:12px;">Exported from Co-Cher · ${new Date().toLocaleDateString('en-SG')}</p>${planHtml}${componentsHtml}</body></html>`);
    printWin.document.close();
    printWin.print();
  });

  // AI Review
  container.querySelector('#ai-review-btn').addEventListener('click', async () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Reviewing your lesson plan...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = aiMsgs.map(m => m.content).join('\n\n');
      const review = await reviewLesson(planText);
      setComponent('review', review);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Lesson review added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Review failed: ${err.message}</div>`;
    }
  });

  // AI Rubric
  container.querySelector('#ai-rubric-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const topic = chatMessages.find(m => m.role === 'user')?.content || 'General lesson';
    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Generating rubric...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const rubric = await generateRubric(topic);
      setComponent('rubric', rubric);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Rubric added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Rubric generation failed: ${err.message}</div>`;
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

  // AI Timeline
  container.querySelector('#ai-timeline-btn').addEventListener('click', () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    showTimelineModal(container);
  });

  // AI Exit Ticket
  container.querySelector('#ai-exit-ticket-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Generating exit ticket questions...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = aiMsgs.map(m => m.content).join('\n\n');
      const subject = planClassContext?.subject || '';
      const level = planClassContext?.level || '';
      const ticket = await generateExitTicket(planText, subject, level);
      setComponent('exitTicket', ticket);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Exit ticket added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Exit ticket generation failed: ${err.message}</div>`;
    }
  });

  // AI Differentiation
  container.querySelector('#ai-differentiation-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    // Need a class with students for differentiation
    const allClasses = Store.getClasses().filter(c => c.students?.length > 0);
    if (allClasses.length === 0) { showToast('No students found. Add students to a class first.', 'danger'); return; }

    showDifferentiationModal(container, allClasses);
  });

  // YouTube recommendations
  container.querySelector('#ai-youtube-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Finding YouTube recommendations...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await suggestYouTubeVideos(planText, cls.subject, cls.level);
      setComponent('youtubeVideos', result, cls.subject || 'Videos');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('YouTube recommendations added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Simulation Models
  container.querySelector('#ai-simulations-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Finding simulation models...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await suggestSimulations(planText, cls.subject, cls.level);
      setComponent('simulations', result, cls.subject || 'Simulations');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Simulation suggestions added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Worksheet Generator
  container.querySelector('#ai-worksheet-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating worksheet...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateWorksheet(planText, cls.subject, cls.level);
      setComponent('worksheet', result, cls.subject || 'Worksheet');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Worksheet generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Discussion Prompts
  container.querySelector('#ai-discussion-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating discussion prompts...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateDiscussionPrompts(planText, cls.subject, cls.level);
      setComponent('discussionPrompts', result, cls.subject || 'Discussion');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Discussion prompts generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // External Resources
  container.querySelector('#ai-external-btn').addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Finding external resources...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await suggestExternalResources(planText, cls.subject, cls.level);
      setComponent('externalLinks', result, cls.subject || 'Resources');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('External resources added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Share Lesson (export/import JSON)
  // Word export
  container.querySelector('#export-word-btn')?.addEventListener('click', exportToWord);

  container.querySelector('#share-lesson-btn').addEventListener('click', () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
      showToast('No lesson content to share yet.', 'danger'); return;
    }
    showShareModal(container);
  });

  // Lesson Templates
  container.querySelector('#templates-btn').addEventListener('click', () => {
    showTemplateModal(container);
  });

  // Spatial Layout
  renderSpatialSection(container);
  renderSpatialContextBar(container);
  container.querySelector('#spatial-layout-btn').addEventListener('click', () => {
    const spatialSection = container.querySelector('#spatial-section');
    spatialSection.scrollIntoView({ behavior: 'smooth' });
    renderSpatialSection(container, true);
  });

  // Toolbar mode toggle (icons ↔ dropdown) — full re-render to re-wire handlers
  container.querySelector('#toggle-toolbar-mode')?.addEventListener('click', () => {
    const prefs = getLPPrefs();
    const newMode = (prefs.toolbarMode || 'icons') === 'icons' ? 'dropdown' : 'icons';
    prefs.toolbarMode = newMode;
    saveLPPrefs(prefs);
    render(container);
  });

  // Date/time setup — populate with today and show timetable hints
  const dateInput = container.querySelector('#lesson-date');
  const periodSelect = container.querySelector('#lesson-period');
  if (dateInput) {
    const today = new Date();
    dateInput.value = lessonDateTime?.date || today.toISOString().split('T')[0];
    if (lessonDateTime?.period) periodSelect.value = lessonDateTime.period;
  }
  setupTimetableHints(container);
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
  const suggestedClassId = existing?.classId || planClassContext?.id || '';

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
      components: { ...lessonComponents },
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

/* ── Last grouping result for seat assignment ── */
let lastGroupingResult = null;
let lastGroupingMeta = null;

/* ── AI Grouping Modal ── */
function showGroupingModal(container, classes) {
  const classesWithStudents = classes.filter(c => c.students?.length > 0);

  // Auto-select class from context
  const contextClassId = planClassContext?.id || '';

  const { backdrop, close } = openModal({
    title: 'AI Student Grouping',
    body: `
      <div class="input-group">
        <label class="input-label">Select Class</label>
        <select class="input" id="group-class">
          ${classesWithStudents.map(c => `<option value="${c.id}" ${c.id === contextClassId ? 'selected' : ''}>${c.name} (${c.students.length} students)</option>`).join('')}
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
          <option value="Circuit training">PE — Circuit training</option>
          <option value="Team game">PE — Team game</option>
          <option value="Warmup drill">PE — Warm-up / drill</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Preferred Group Size</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="group-size" min="2" max="6" value="4" style="flex:1;" />
          <span id="group-size-label" style="font-size:0.875rem;font-weight:600;color:var(--ink);min-width:80px;text-align:center;">4 students</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6875rem;color:var(--ink-faint);margin-top:2px;">
          <span>Pairs</span><span>Trios</span><span>Quads</span><span>Fives</span><span>Sixes</span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Grouping Considerations <span style="font-weight:400;color:var(--ink-faint);">(optional)</span></label>
        <textarea class="input" id="group-considerations" rows="3" placeholder="E.g. 'Keep Ahmad and Wei Lin in separate groups', 'Priya needs a confident English speaker in her group', 'Balance genders where possible', 'Seat students with vision needs near the front'..." style="resize:vertical;font-size:0.8125rem;"></textarea>
        <div style="font-size:0.6875rem;color:var(--ink-faint);margin-top:4px;">Share any seating preferences, student dynamics, or special needs the AI should factor in.</div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="generate">Generate Groups</button>
    `
  });

  // Group size slider label
  const sizeSlider = backdrop.querySelector('#group-size');
  const sizeLabel = backdrop.querySelector('#group-size-label');
  sizeSlider.addEventListener('input', () => {
    sizeLabel.textContent = `${sizeSlider.value} students`;
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
    const classId = backdrop.querySelector('#group-class').value;
    const activityType = backdrop.querySelector('#group-activity').value;
    const groupSize = parseInt(sizeSlider.value);
    const considerations = backdrop.querySelector('#group-considerations').value.trim();
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Analysing E21CC profiles and creating groups for ${cls.students.length} students...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const grouping = await suggestGrouping(cls.students, activityType, { groupSize, considerations });

      // Store for seat assignment feature
      lastGroupingResult = grouping;
      lastGroupingMeta = { classId, className: cls.name, activityType, groupSize, studentCount: cls.students.length };

      // Save as persistent component
      setComponent('grouping', grouping, `${cls.name} · ${activityType} · groups of ${groupSize}`);
      renderComponents(container);

      // Show action buttons in status area
      statusEl.innerHTML = `
        <div class="card" style="padding:var(--sp-4);background:var(--bg-subtle);border:1px dashed var(--border);">
          <div style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Groups saved to lesson components. Next steps:</div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="seat-assignment-btn" title="Get AI suggestions for where each group should sit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              Who Sits Where
            </button>
            <button class="btn btn-secondary btn-sm" id="arrange-classroom-btn" title="Open spatial designer with a layout suited for this activity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              Arrange Classroom
            </button>
            <button class="btn btn-ghost btn-sm" id="dismiss-actions" style="margin-left:auto;">Dismiss</button>
          </div>
        </div>`;

      statusEl.querySelector('#dismiss-actions')?.addEventListener('click', () => { statusEl.innerHTML = ''; });

      // Who Sits Where button
      statusEl.querySelector('#seat-assignment-btn')?.addEventListener('click', () => {
        showSeatAssignmentModal(container, lastGroupingResult, lastGroupingMeta);
      });

      // Arrange Classroom button — navigate to spatial with context
      statusEl.querySelector('#arrange-classroom-btn')?.addEventListener('click', () => {
        const presetMap = {
          'Collaborative group work': 'pods',
          'Peer tutoring': 'pods',
          'Jigsaw activity': 'stations',
          'Debate or discussion': 'fishbowl',
          'Project-based learning': 'pods',
          'Competition': 'pods',
          'Lab work': 'stations',
          'Circuit training': 'circuit',
          'Team game': 'team_game',
          'Warmup drill': 'warmup'
        };
        sessionStorage.setItem('cocher_spatial_preset', presetMap[activityType] || 'pods');
        sessionStorage.setItem('cocher_spatial_student_count', cls.students.length.toString());
        sessionStorage.setItem('cocher_spatial_activity', activityType);
        navigate('/spatial');
      });
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Grouping failed: ${err.message}</div>`;
    }
  });
}

/* ── Seat Assignment Modal ── */
function showSeatAssignmentModal(container, groupingText, meta) {
  if (!groupingText || !meta) {
    showToast('Generate groups first before assigning seats.', 'danger');
    return;
  }

  const savedLayouts = Store.getSavedLayouts() || [];
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;

  const { backdrop, close } = openModal({
    title: 'Who Sits Where',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-4);">
        Choose a classroom layout and the AI will suggest where each group should sit.
      </p>
      <div class="input-group">
        <label class="input-label">Classroom Layout</label>
        <select class="input" id="seat-layout">
          <option value="direct">Direct Instruction (Rows)</option>
          <option value="pods" selected>Collaborative Pods</option>
          <option value="stations">Stations</option>
          <option value="ushape">U-Shape / Circle</option>
          <option value="quiet">Quiet Work (Individual)</option>
          <option value="gallery">Gallery Walk</option>
          <option value="fishbowl">Fishbowl / Socratic</option>
          <option value="maker">Makerspace</option>
        </select>
      </div>
      ${savedLayouts.length > 0 ? `
        <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:-8px;margin-bottom:var(--sp-3);">
          ${linkedLayoutId ? 'Using your linked layout\'s preset.' : 'Or choose based on your saved layouts.'}
        </div>
      ` : ''}
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="assign">Assign Seats</button>
    `
  });

  // Pre-select based on linked layout or activity type
  const layoutSelect = backdrop.querySelector('#seat-layout');
  if (linkedLayoutId) {
    const linkedLayout = savedLayouts.find(l => l.id === linkedLayoutId);
    if (linkedLayout?.preset) layoutSelect.value = linkedLayout.preset;
  } else {
    const presetMap = {
      'Collaborative group work': 'pods', 'Peer tutoring': 'pods',
      'Jigsaw activity': 'stations', 'Debate or discussion': 'fishbowl',
      'Project-based learning': 'pods', 'Competition': 'pods', 'Lab work': 'stations',
      'Circuit training': 'circuit', 'Team game': 'team_game', 'Warmup drill': 'warmup'
    };
    layoutSelect.value = presetMap[meta.activityType] || 'pods';
  }

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="assign"]').addEventListener('click', async () => {
    const layoutPreset = layoutSelect.value;
    close();

    // Parse groups from grouping text
    const groups = parseGroupsFromText(groupingText);

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Assigning seats for ${groups.length} groups in ${PRESET_NAMES[layoutPreset] || layoutPreset} layout...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

    try {
      const seatPlan = await suggestSeatAssignment(groups, layoutPreset, meta.studentCount);
      setComponent('seatPlan', seatPlan, PRESET_NAMES[layoutPreset] || layoutPreset);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Seating plan added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Seat assignment failed: ${err.message}</div>`;
    }
  });
}

/* ── Parse groups from AI grouping text ── */
function parseGroupsFromText(text) {
  const groups = [];
  // Match "### Group N:" or "Group N:" patterns followed by members
  const groupPattern = /(?:###?\s*)?Group\s*\d+[^]*?(?:\*\*Members?:\*\*|Members?:)\s*([^\n]+)/gi;
  let match;
  while ((match = groupPattern.exec(text)) !== null) {
    const membersLine = match[1].trim();
    const members = membersLine.split(/,\s*/).map(n => n.replace(/\*\*/g, '').trim()).filter(Boolean);
    if (members.length > 0) {
      groups.push({ members });
    }
  }
  // Fallback: if parsing didn't find structured groups, try simpler patterns
  if (groups.length === 0) {
    const lines = text.split('\n');
    let currentMembers = [];
    for (const line of lines) {
      const groupMatch = line.match(/Group\s*\d+\s*:/i);
      if (groupMatch) {
        if (currentMembers.length > 0) groups.push({ members: currentMembers });
        currentMembers = [];
        // Try to extract names from the same line
        const namesAfterColon = line.split(':').slice(1).join(':').trim();
        if (namesAfterColon) {
          currentMembers = namesAfterColon.split(/,\s*/).map(n => n.replace(/\*\*/g, '').replace(/—.*$/, '').trim()).filter(Boolean);
        }
      }
    }
    if (currentMembers.length > 0) groups.push({ members: currentMembers });
  }
  return groups;
}

/* ══════════ Timeline Modal ══════════ */
function showTimelineModal(container) {
  const { backdrop, close } = openModal({
    title: 'Lesson Timeline / Pacing Guide',
    body: `
      <div class="input-group">
        <label class="input-label">Total Lesson Duration</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="timeline-duration" min="15" max="120" value="45" step="5" style="flex:1;" />
          <span id="timeline-duration-label" style="font-size:0.875rem;font-weight:600;color:var(--ink);min-width:60px;text-align:center;">45 min</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6875rem;color:var(--ink-faint);margin-top:2px;">
          <span>15 min</span><span>45 min</span><span>60 min</span><span>90 min</span><span>120 min</span>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="generate">Generate Timeline</button>
    `
  });

  const durationSlider = backdrop.querySelector('#timeline-duration');
  const durationLabel = backdrop.querySelector('#timeline-duration-label');
  durationSlider.addEventListener('input', () => {
    durationLabel.textContent = `${durationSlider.value} min`;
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
    const totalMinutes = parseInt(durationSlider.value);
    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Creating ${totalMinutes}-minute lesson timeline...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
      const subject = planClassContext?.subject || '';
      const timeline = await generateTimeline(planText, totalMinutes, subject);
      setComponent('timeline', timeline, `${totalMinutes} minutes`);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Timeline added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Timeline generation failed: ${err.message}</div>`;
    }
  });
}

/* ══════════ Differentiation Modal ══════════ */
function showDifferentiationModal(container, classes) {
  const contextClassId = planClassContext?.id || '';

  const { backdrop, close } = openModal({
    title: 'Differentiation Suggestions',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-4);">
        Analyse student E21CC profiles against your lesson plan to identify who needs scaffolding and who is ready for extension.
      </p>
      <div class="input-group">
        <label class="input-label">Select Class</label>
        <select class="input" id="diff-class">
          ${classes.map(c => `<option value="${c.id}" ${c.id === contextClassId ? 'selected' : ''}>${c.name} (${c.students.length} students)</option>`).join('')}
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="analyse">Analyse & Suggest</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="analyse"]').addEventListener('click', async () => {
    const classId = backdrop.querySelector('#diff-class').value;
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Analysing ${cls.students.length} student profiles for differentiation opportunities...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
      const diff = await suggestDifferentiation(cls.students, planText);
      setComponent('differentiation', diff, cls.name);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Differentiation suggestions added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Differentiation analysis failed: ${err.message}</div>`;
    }
  });
}

/* ══════════ Spatial Context Bar (coupling) ══════════ */
function renderSpatialContextBar(container) {
  const barEl = container.querySelector('#spatial-context-bar');
  if (!barEl) return;

  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;
  if (!linkedLayoutId) { barEl.style.display = 'none'; return; }

  const savedLayouts = Store.getSavedLayouts() || [];
  const layout = savedLayouts.find(l => l.id === linkedLayoutId);
  if (!layout) { barEl.style.display = 'none'; return; }

  barEl.style.display = '';
  barEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:linear-gradient(135deg, rgba(0,12,83,0.04), rgba(167,243,208,0.08));border:1px solid var(--border-light);border-radius:var(--radius-lg);">
      <div style="font-size:1.25rem;">${PRESET_ICONS[layout.preset] || '📐'}</div>
      <div style="flex:1;">
        <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">
          ${PRESET_NAMES[layout.preset] || 'Custom'} Layout Linked
        </div>
        <div style="font-size:0.6875rem;color:var(--ink-muted);">
          ${layout.name} · ${layout.studentCount || '?'} students · ${layout.items?.length || 0} items
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="spatial-context-open" style="font-size:0.75rem;">Open</button>
    </div>`;

  barEl.querySelector('#spatial-context-open')?.addEventListener('click', () => navigate('/spatial'));
}

/* ══════════ KB Context Attachment ══════════ */

const FRAMEWORK_SUMMARIES = [
  { id: 'e21cc', title: 'E21CC Framework', content: 'Enhanced 21st Century Competencies:\n\nCAIT — Critical, Adaptive & Inventive Thinking:\n- Sound Reasoning: Examine issues logically, draw well-reasoned conclusions\n- Creative Problem-Solving: Generate novel ideas, explore innovative solutions\n- Managing Complexity & Ambiguity: Navigate uncertain, complex problems\n- Metacognition: Monitor own thinking, self-regulate, transfer learning\n\nCCI — Communication, Collaboration & Information:\n- Communicative Competence: Express ideas clearly across modes and contexts\n- Collaborative Skills: Work effectively in teams, co-create meaning\n- Information Literacy: Find, evaluate, use information critically and ethically\n\nCGC — Civic, Global & Cross-cultural Literacy:\n- Active Citizenship: Contribute responsibly to community and nation\n- Global Awareness: Appreciate interconnectedness and global challenges\n- Cross-cultural Sensitivity: Respect diversity, bridge cultural divides' },
  { id: 'stp', title: 'Singapore Teaching Practice', content: 'Singapore Teaching Practice (STP) — 4 Areas:\n\nArea 1: Lesson Preparation — Understanding learners, clear objectives, resource planning\nArea 2: Lesson Enactment — Teaching actions, interaction patterns, classroom discourse\nArea 3: Monitoring & Feedback — Formative assessment, effective feedback, differentiated support\nArea 4: Positive Learning Culture — Safe environment, routines, student agency' },
  { id: 'edtech', title: 'EdTech Masterplan 2030', content: 'EdTech Masterplan 2030 — 3 Thrusts:\n\nThrust 1: Digital Literacy — Data literacy, information & media literacy, digital communication\nThrust 2: Digital Creation — Computational thinking, digital design, AI literacy\nThrust 3: Digital Citizenship — Online safety, digital ethics, digital wellbeing\n\nIntegration: TPACK model, blended learning (SLS), AI-enhanced pedagogy' }
];

function renderKBChips(container) {
  const chipsEl = container.querySelector('#kb-chips');
  const barEl = container.querySelector('#kb-context-bar');
  if (!chipsEl || !barEl) return;

  if (attachedKBContext.length === 0) {
    barEl.style.display = 'none';
    return;
  }

  barEl.style.display = '';
  chipsEl.innerHTML = attachedKBContext.map((kb, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--accent-light);color:var(--accent-dark);border-radius:var(--radius-full);font-size:0.75rem;font-weight:500;">
      ${esc(kb.title.slice(0, 30))}
      <button class="kb-remove-chip" data-idx="${i}" style="background:none;border:none;cursor:pointer;color:var(--accent-dark);padding:0;font-size:0.875rem;line-height:1;">&times;</button>
    </span>
  `).join('');

  chipsEl.querySelectorAll('.kb-remove-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      attachedKBContext.splice(parseInt(btn.dataset.idx), 1);
      renderKBChips(container);
    });
  });
}

function showAttachKBModal(container) {
  const uploads = Store.get('knowledgeUploads') || [];
  const pdFolders = Store.get('pdFolders') || [];
  const allItems = [
    ...FRAMEWORK_SUMMARIES.map(f => ({ ...f, type: 'framework' })),
    ...uploads.map(u => ({ id: u.id, title: u.title, content: u.content, type: 'upload' })),
    ...pdFolders.map(f => ({
      id: 'pd_' + f.id,
      title: f.name + ' (PD Folder)',
      content: (f.materials || []).map(m => `## ${m.title}\n${m.content}`).join('\n\n---\n\n'),
      type: 'pd-folder'
    })).filter(f => f.content.length > 0)
  ];

  const alreadyAttached = new Set(attachedKBContext.map(k => k.id));

  const { backdrop, close } = openModal({
    title: 'Attach Knowledge Base Context',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Select resources to include as context in your conversation. Co-Cher will reference these when planning your lesson.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
        ${allItems.map(item => `
          <label style="display:flex;align-items:flex-start;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-md);cursor:pointer;transition:background 0.15s;">
            <input type="checkbox" value="${item.id}" class="kb-attach-check" ${alreadyAttached.has(item.id) ? 'checked' : ''} style="margin-top:3px;" />
            <div>
              <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${esc(item.title)}</div>
              <div style="font-size:0.6875rem;color:var(--ink-muted);">
                ${item.type === 'framework' ? 'Built-in Framework' : item.type === 'pd-folder' ? 'PD Portfolio Folder' : 'Uploaded Resource'} · ${(item.content?.length || 0) > 1000 ? Math.round(item.content.length / 1000) + 'K chars' : item.content?.length + ' chars'}
              </div>
            </div>
          </label>
        `).join('')}
      </div>
      ${allItems.length === 0 ? '<p style="text-align:center;color:var(--ink-muted);padding:var(--sp-6);font-size:0.875rem;">No resources available. Upload documents in the Knowledge Base.</p>' : ''}
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="attach">Attach Selected</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="attach"]').addEventListener('click', () => {
    const checked = [...backdrop.querySelectorAll('.kb-attach-check:checked')].map(cb => cb.value);
    attachedKBContext = allItems.filter(item => checked.includes(item.id));
    renderKBChips(container);
    close();
    if (attachedKBContext.length > 0) {
      showToast(`${attachedKBContext.length} resource${attachedKBContext.length > 1 ? 's' : ''} attached as context`, 'success');
    }
  });
}

/* ══════════ Spatial Layout Section ══════════ */

const PRESET_ICONS = {
  direct: '📣', pods: '🤝', stations: '🔄', ushape: '🗣️',
  quiet: '📝', gallery: '🖼️', fishbowl: '🐟', maker: '🛠️'
};
const PRESET_NAMES = {
  direct: 'Direct Instruction', pods: 'Collaborative Pods', stations: 'Stations',
  ushape: 'U-Shape / Circle', quiet: 'Quiet Work', gallery: 'Gallery Walk',
  fishbowl: 'Fishbowl / Socratic', maker: 'Makerspace'
};

function renderSpatialSection(container, forceShow = false) {
  const el = container.querySelector('#spatial-section');
  if (!el) return;

  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;
  const linkedLayout = linkedLayoutId ? Store.getSavedLayouts()?.find(l => l.id === linkedLayoutId) : null;
  const savedLayouts = Store.getSavedLayouts() || [];

  // If no layout linked and not forced open, show nothing or minimal prompt
  if (!linkedLayout && !forceShow && savedLayouts.length === 0) {
    el.innerHTML = '';
    return;
  }

  if (linkedLayout) {
    // Show linked layout summary
    el.innerHTML = `
      <div class="card" style="padding:var(--sp-5);border-top:3px solid var(--e21cc-cci);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--e21cc-cci)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);">Spatial Layout</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);">
            <button class="btn btn-ghost btn-sm" id="open-spatial-editor">Open in Designer</button>
            <button class="btn btn-ghost btn-sm" id="unlink-spatial" style="color:var(--danger);">Unlink</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-md);">
          <div style="font-size:2rem;">${PRESET_ICONS[linkedLayout.preset] || '📐'}</div>
          <div>
            <div style="font-weight:600;font-size:0.875rem;color:var(--ink);">${esc(linkedLayout.name)}</div>
            <div style="font-size:0.75rem;color:var(--ink-muted);">
              ${linkedLayout.studentCount || '?'} students · ${linkedLayout.items?.length || 0} items · ${PRESET_NAMES[linkedLayout.preset] || 'Custom'}
            </div>
          </div>
        </div>
      </div>`;

    el.querySelector('#open-spatial-editor')?.addEventListener('click', () => {
      navigate('/spatial');
    });
    el.querySelector('#unlink-spatial')?.addEventListener('click', () => {
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { spatialLayout: null });
        showToast('Spatial layout unlinked', 'success');
        renderSpatialSection(container);
      }
    });
  } else {
    // Show option to link an existing layout or go design one
    el.innerHTML = `
      <div class="card" style="padding:var(--sp-5);border:2px dashed var(--border);background:transparent;box-shadow:none;">
        <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);">Spatial Layout</span>
        </div>
        <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-3);">
          Link a classroom layout to this lesson to plan how students will be arranged physically.
        </p>
        ${savedLayouts.length > 0 ? `
          <div style="margin-bottom:var(--sp-3);">
            <label class="input-label" style="font-size:0.75rem;">Link existing layout</label>
            <select class="input" id="link-layout-select" style="font-size:0.8125rem;">
              <option value="">Choose a saved layout...</option>
              ${savedLayouts.map(l => `<option value="${l.id}">${l.name} (${l.studentCount || '?'} students)</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div style="display:flex;gap:var(--sp-2);">
          ${savedLayouts.length > 0 ? `<button class="btn btn-primary btn-sm" id="link-layout-btn">Link Layout</button>` : ''}
          <button class="btn btn-secondary btn-sm" id="design-new-spatial">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Design New in Spatial Designer
          </button>
        </div>
      </div>`;

    el.querySelector('#link-layout-btn')?.addEventListener('click', () => {
      const layoutId = container.querySelector('#link-layout-select')?.value;
      if (!layoutId) { showToast('Select a layout to link.', 'danger'); return; }
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { spatialLayout: layoutId });
        showToast('Spatial layout linked!', 'success');
        renderSpatialSection(container);
      } else {
        showToast('Save the lesson first, then link a layout.', 'danger');
      }
    });
    el.querySelector('#design-new-spatial')?.addEventListener('click', () => {
      navigate('/spatial');
    });
  }
}

/* ══════════ Resizable Panel Handle ══════════ */
function initResizeHandle(handle, leftPanel, rightPanel, parentContainer) {
  if (!handle || !leftPanel || !rightPanel || !parentContainer) return;

  let isResizing = false;
  let startX = 0;
  let startLeftWidth = 0;

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startLeftWidth = leftPanel.getBoundingClientRect().width;
    handle.classList.add('active');
    document.body.classList.add('resizing-panels');
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const containerWidth = parentContainer.getBoundingClientRect().width;
    const handleWidth = 6;
    const newLeftWidth = startLeftWidth + dx;
    const minWidth = 320;
    const maxWidth = containerWidth - minWidth - handleWidth;

    if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
      const leftPct = (newLeftWidth / containerWidth) * 100;
      const rightPct = ((containerWidth - newLeftWidth - handleWidth) / containerWidth) * 100;
      leftPanel.style.flex = `0 0 ${leftPct}%`;
      rightPanel.style.flex = `0 0 ${rightPct}%`;
    }
  });

  handle.addEventListener('pointerup', () => {
    isResizing = false;
    handle.classList.remove('active');
    document.body.classList.remove('resizing-panels');
  });

  handle.addEventListener('lostpointercapture', () => {
    isResizing = false;
    handle.classList.remove('active');
    document.body.classList.remove('resizing-panels');
  });

  // Double-click to reset to 50/50
  handle.addEventListener('dblclick', () => {
    leftPanel.style.flex = '1 1 50%';
    rightPanel.style.flex = '1 1 50%';
  });
}

/* ══════════ Share Modal (Export / Import lesson JSON) ══════════ */
/* ══════════ Timetable Hints for Date/Time ══════════ */
async function setupTimetableHints(container) {
  const dateInput = container.querySelector('#lesson-date');
  const periodSelect = container.querySelector('#lesson-period');
  const hintEl = container.querySelector('#lesson-tt-hint');
  if (!dateInput || !hintEl) return;

  try {
    const user = getCurrentUser();
    if (!user?.email) return;
    const ttData = await loadTT();
    const teacherRow = findTeacherRow(ttData, user.email);
    if (!teacherRow) return;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const periodTimes = ['7:30', '8:10', '8:50', '9:30', '10:20', '11:00', '11:40', '12:20', '1:10', '1:50', '2:30'];

    function updateHint() {
      const dateVal = dateInput.value;
      if (!dateVal) { hintEl.innerHTML = ''; return; }
      const d = new Date(dateVal + 'T00:00:00');
      const dayIdx = d.getDay();
      if (dayIdx === 0 || dayIdx === 6) { hintEl.innerHTML = '<em>Weekend</em>'; return; }
      const dayStr = dayNames[dayIdx];

      // Determine week type (Odd/Even) — simple: week number modulo 2
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      const weekType = weekNum % 2 === 1 ? 'Odd' : 'Even';

      // Gather the day's lessons
      const lessons = [];
      for (let p = 1; p <= 11; p++) {
        const col = `${weekType}${dayStr}${p}`;
        const val = teacherRow[col];
        if (val && val !== '0') {
          const parts = val.split(' / ');
          lessons.push({ p, code: parts[0]?.trim(), room: parts[1]?.trim() || '' });
        }
      }

      if (lessons.length === 0) {
        hintEl.innerHTML = `<em>${weekType} ${dayStr} — no lessons</em>`;
        return;
      }

      hintEl.innerHTML = `<strong>${weekType} ${dayStr}:</strong> ` +
        lessons.map(l => `<span style="display:inline-block;padding:1px 6px;background:var(--accent-light);border-radius:4px;margin:1px;cursor:pointer;font-size:0.6875rem;" class="tt-period-chip" data-period="${l.p}" data-code="${l.code}" data-room="${l.room}">P${l.p} ${l.code}</span>`).join(' ');

      // Wire period chips
      hintEl.querySelectorAll('.tt-period-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          periodSelect.value = chip.dataset.period;
          lessonDateTime = {
            date: dateVal,
            period: chip.dataset.period,
            classCode: chip.dataset.code,
            room: chip.dataset.room
          };
        });
      });
    }

    dateInput.addEventListener('change', updateHint);
    periodSelect.addEventListener('change', () => {
      lessonDateTime = {
        date: dateInput.value,
        period: periodSelect.value,
        classCode: '',
        room: ''
      };
    });
    updateHint();
  } catch { /* TT is optional */ }
}

/* ══════════ Word (.docx) Export ══════════ */
function exportToWord() {
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
  if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
    showToast('No lesson content to export yet.', 'danger');
    return;
  }

  const title = currentLessonId ? (Store.getLesson(currentLessonId)?.title || 'Lesson Plan') : 'Lesson Plan';
  const planText = aiMsgs.map(m => m.content).join('\n\n---\n\n');

  // Build components text
  const compKeys = Object.keys(lessonComponents)
    .filter(k => lessonComponents[k]?.content)
    .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));

  let componentsText = '';
  if (compKeys.length > 0) {
    componentsText = '\n\n' + '='.repeat(60) + '\nLESSON COMPONENTS\n' + '='.repeat(60) + '\n\n';
    componentsText += compKeys.map(key => {
      const m = COMPONENT_META[key] || { label: key };
      return `--- ${m.label} ---\n\n${lessonComponents[key].content}`;
    }).join('\n\n');
  }

  // Date/time info
  let dateInfo = '';
  if (lessonDateTime?.date) {
    dateInfo = `Date: ${lessonDateTime.date}`;
    if (lessonDateTime.period) dateInfo += ` | Period ${lessonDateTime.period}`;
    if (lessonDateTime.classCode) dateInfo += ` | ${lessonDateTime.classCode}`;
    if (lessonDateTime.room) dateInfo += ` | Room: ${lessonDateTime.room}`;
    dateInfo += '\n';
  }

  // Build a .docx using the Office Open XML format (minimal)
  const fullText = `${title}\n${dateInfo}Exported from Co-Cher · ${new Date().toLocaleDateString('en-SG')}\n\n${planText}${componentsText}`;

  // Convert to simple Word-compatible HTML wrapped in .doc
  const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.6;color:#1e293b;max-width:700px;margin:0 auto;padding:24px}
h1{font-size:16pt;color:#000C53;border-bottom:2px solid #000C53;padding-bottom:6px}
h2{font-size:13pt;margin-top:18px}h3{font-size:11pt;margin-top:14px}
table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:10pt}
th{background:#f1f5f9;font-weight:bold}
ul,ol{padding-left:20px}
hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0}
.meta{font-size:9pt;color:#64748b}
.component-header{background:#f1f5f9;padding:8px 12px;margin:16px 0 8px;font-weight:bold;font-size:11pt;border-left:3px solid #4361ee}</style></head>
<body>
<h1>${esc(title)}</h1>
<p class="meta">${dateInfo ? esc(dateInfo) + '<br/>' : ''}Exported from Co-Cher &middot; ${new Date().toLocaleDateString('en-SG')}</p>
${md(planText)}
${compKeys.length > 0 ? '<hr/><h2>Lesson Components</h2>' + compKeys.map(key => {
    const m = COMPONENT_META[key] || { label: key };
    return `<div class="component-header">${m.label}</div>${md(lessonComponents[key].content)}`;
  }).join('') : ''}
</body></html>`;

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Word document downloaded!', 'success');
}

function showShareModal(container) {
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
  const planText = aiMsgs.map(m => m.content).join('\n\n');
  const exportData = {
    _cocherExport: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    title: currentLessonId ? (Store.getLesson(currentLessonId)?.title || 'Untitled') : 'Untitled Lesson',
    chatHistory: chatMessages,
    components: { ...lessonComponents },
    classContext: planClassContext ? { name: planClassContext.name, subject: planClassContext.subject, level: planClassContext.level } : null
  };

  let modalRef = null;
  modalRef = openModal({
    title: 'Share Lesson',
    body: `
      <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
        <!-- Export Section -->
        <div style="padding:var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style="font-weight:600;font-size:0.875rem;">Send to Colleague</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="copy-share-json">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy to Clipboard
            </button>
            <button class="btn btn-secondary btn-sm" id="download-share-json">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download .json
            </button>
          </div>
          <details style="margin-top:var(--sp-2);">
            <summary style="font-size:0.6875rem;color:var(--ink-faint);cursor:pointer;">View raw JSON</summary>
            <textarea id="share-export-json" readonly style="width:100%;height:80px;font-family:monospace;font-size:0.6875rem;resize:vertical;margin-top:4px;border-radius:var(--radius-md);">${JSON.stringify(exportData, null, 2)}</textarea>
          </details>
        </div>

        <!-- Import Section -->
        <div style="padding:var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span style="font-weight:600;font-size:0.875rem;">Import from Colleague</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-2);">
            <label class="btn btn-primary btn-sm" style="cursor:pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Upload .json File
              <input type="file" id="import-share-file" accept=".json" style="display:none;" />
            </label>
          </div>
          <details>
            <summary style="font-size:0.6875rem;color:var(--ink-faint);cursor:pointer;">Or paste JSON manually</summary>
            <textarea id="share-import-json" placeholder="Paste shared lesson JSON here..." style="width:100%;height:60px;font-family:monospace;font-size:0.6875rem;resize:vertical;margin-top:4px;border-radius:var(--radius-md);"></textarea>
            <button class="btn btn-secondary btn-sm" id="import-share-json" style="margin-top:4px;">Import</button>
          </details>
        </div>
      </div>
    `,
    onMount: (modal) => {
      modal.querySelector('#copy-share-json').addEventListener('click', () => {
        const ta = modal.querySelector('#share-export-json');
        ta.select();
        navigator.clipboard.writeText(ta.value).then(() => showToast('Copied to clipboard!', 'success'));
      });
      modal.querySelector('#download-share-json').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lesson_${exportData.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Downloaded!', 'success');
      });
      modal.querySelector('#import-share-json').addEventListener('click', () => {
        const raw = modal.querySelector('#share-import-json').value.trim();
        if (!raw) { showToast('Please paste lesson JSON first.', 'danger'); return; }
        importSharedLesson(raw, container, modalRef);
      });
      modal.querySelector('#import-share-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          importSharedLesson(reader.result, container, modalRef);
        };
        reader.readAsText(file);
      });
    }
  });
}

function importSharedLesson(jsonStr, container, modalRef) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data._cocherExport) { showToast('Not a valid Co-Cher lesson export.', 'danger'); return; }
    chatMessages = data.chatHistory || [];
    lessonComponents = data.components || {};
    planClassContext = data.classContext || null;
    currentLessonId = null;
    if (modalRef?.close) modalRef.close();
    render(container);
    showToast(`Imported "${data.title}"! Save when ready.`, 'success');
  } catch (err) {
    showToast('Invalid JSON: ' + err.message, 'danger');
  }
}

/* ══════════ Lesson Templates Modal ══════════ */
const LESSON_TEMPLATES = [
  {
    id: '5e',
    name: '5E Inquiry Model',
    desc: 'Engage, Explore, Explain, Elaborate, Evaluate — ideal for science inquiry lessons.',
    prompt: 'Design a lesson using the 5E Inquiry Model (Engage, Explore, Explain, Elaborate, Evaluate). Include activities for each phase. Make the Engage phase spark curiosity with a discrepant event or provocative question. The Explore phase should be student-driven hands-on investigation. Include formative checks.'
  },
  {
    id: 'station-rotation',
    name: 'Station Rotation',
    desc: 'Students rotate through learning stations — great for differentiation and hands-on activities.',
    prompt: 'Design a station rotation lesson with 4 stations. Each station should be 10-12 minutes. Include a mix of: teacher-led station, collaborative station, individual practice station, and a tech/simulation station. Provide clear instructions for each station and transition signals.'
  },
  {
    id: 'flipped',
    name: 'Flipped Classroom',
    desc: 'Pre-class video/reading + in-class active learning and application.',
    prompt: 'Design a flipped classroom lesson. Include: (1) Pre-class assignment (video, reading, or interactive resource ~10 min), (2) In-class warm-up check for understanding, (3) Active learning activity (problem-solving, discussion, or project work), (4) Wrap-up with exit ticket. Suggest specific resources for the pre-class component.'
  },
  {
    id: 'tbl',
    name: 'Team-Based Learning (TBL)',
    desc: 'Individual readiness test, team discussion, application activity (4S framework).',
    prompt: 'Design a Team-Based Learning (TBL) lesson with: (1) Pre-class preparation (reading/video), (2) Individual Readiness Assurance Test (iRAT, 5-8 MCQs), (3) Team Readiness Assurance Test (tRAT, same questions solved as a team), (4) Application Activity following the 4S framework (Significant problem, Same problem, Specific choice, Simultaneous report).'
  },
  {
    id: 'thinking-routine',
    name: 'Thinking Routine (VT)',
    desc: 'Visible Thinking routine — See-Think-Wonder, Connect-Extend-Challenge, etc.',
    prompt: 'Design a lesson built around Visible Thinking routines. Use at least 2 of these: See-Think-Wonder, Think-Pair-Share, Connect-Extend-Challenge, or I Used to Think...Now I Think. Show how each routine deepens understanding and makes student thinking visible. Include documentation of thinking (e.g., on mini-whiteboards or shared doc).'
  },
  {
    id: 'pbl',
    name: 'Project-Based Learning',
    desc: 'Driving question, sustained inquiry, student voice & choice, public product.',
    prompt: 'Design a project-based learning lesson segment. Include: a driving question that is open-ended and authentic, clear learning goals aligned to curriculum, scaffolded inquiry process, student voice and choice in how they investigate and present, and a public product or presentation. This can be one session of a multi-session project.'
  },
  {
    id: 'direct',
    name: 'Direct Instruction (I Do, We Do, You Do)',
    desc: 'Explicit teaching with modelling, guided practice, and independent practice.',
    prompt: 'Design a direct instruction lesson using the I Do, We Do, You Do framework. Include: (1) Hook/motivation (2 min), (2) I Do — teacher models with think-aloud (10 min), (3) We Do — guided practice with checking for understanding (10 min), (4) You Do — independent practice with differentiation for struggling and advanced learners (15 min), (5) Plenary with exit ticket.'
  },
  {
    id: 'socratic',
    name: 'Socratic Seminar',
    desc: 'Student-led discussion using open-ended questions — builds critical thinking.',
    prompt: 'Design a Socratic Seminar lesson. Include: (1) Pre-seminar preparation (text, article, or artefact for students to read/analyse), (2) Opening question, (3) Core discussion questions (3-4 open-ended questions), (4) Closing question, (5) Post-seminar reflection. Include discussion norms, roles (inner/outer circle), and how to assess participation.'
  }
];

function showTemplateModal(container) {
  let templateModalRef = null;
  templateModalRef = openModal({
    title: 'Lesson Templates',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);">Choose a pedagogical structure. Co-Cher will use it as a starting prompt for your lesson.</p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
        ${LESSON_TEMPLATES.map(t => `
          <div class="card card-hover card-interactive template-card" data-template="${t.id}" style="padding:var(--sp-3) var(--sp-4);cursor:pointer;">
            <div style="font-weight:600;color:var(--ink);font-size:0.875rem;">${t.name}</div>
            <div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;">${t.desc}</div>
          </div>
        `).join('')}
      </div>
    `,
    onMount: (modal) => {
      modal.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
          const tId = card.dataset.template;
          const template = LESSON_TEMPLATES.find(t => t.id === tId);
          if (!template) return;
          if (templateModalRef?.close) templateModalRef.close();
          // Set the template prompt as the chat input
          const chatInput = container.querySelector('#chat-input');
          if (chatInput) {
            const cls = planClassContext;
            const classContext = cls ? ` This lesson is for ${cls.name} (${cls.subject || 'General'}, ${cls.level || 'Secondary'}).` : '';
            chatInput.value = template.prompt + classContext;
            chatInput.focus();
            showToast(`Template "${template.name}" loaded. Hit Send to start!`, 'success');
          }
        });
      });
    }
  });
}
