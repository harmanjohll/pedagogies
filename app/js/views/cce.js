/*
 * Co-Cher CCE2021 — Character & Citizenship Education
 * =====================================================
 * Standalone view for Singapore's CCE2021 framework with six content-area
 * submodules: NE, SEd, MH, ECG, CW, FE.
 */

import { Store, generateId } from '../state.js';
import { sendChat } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirmDialog, openModal } from '../components/modals.js';
import { processLatex } from '../utils/latex.js';

/* ── Module-level state ── */

let cceIncludeYouTube = false;
let cceNewsSources = [];

/* ── Constants ── */

const STORAGE_KEY = 'cocher_cce_discussions';

const CONTENT_AREAS = [
  {
    id: 'NE',
    label: 'National Education',
    color: '#dc2626',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/></svg>`,
    themes: ['Sense of Belonging', 'Sense of Hope', 'Sense of Reality', 'The Will to Act'],
    commemorativeDays: ['Total Defence Day (Feb)', 'International Friendship Day (Apr)', 'Racial Harmony Day (Jul)', 'National Day (Aug)'],
    framework: 'Head-Heart-Hands: engage intellectually (Head), connect emotionally (Heart), and act with commitment (Hands).',
    description: 'National Education develops civic consciousness and a sense of belonging to Singapore. Students explore Singapore\'s history, governance, defence, and multiculturalism, building the dispositions of a concerned citizen who is rooted yet globally aware. Uses the Head-Heart-Hands framework to engage intellectually, connect emotionally, and act with commitment.',
    topics: ['Singapore\'s history & governance', 'Defence & security (Total Defence)', 'Multiculturalism & social cohesion', 'Active citizenship & volunteerism', 'National identity & sovereignty']
  },
  {
    id: 'SEd',
    label: 'Sexuality Education',
    color: '#8b5cf6',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
    themes: ['Human Development', 'Interpersonal Relationships', 'Sexual Health', 'Sexual Behaviour', 'Culture, Society & Law'],
    programmes: ['Growing Years Series (Sec)', 'eTeens Programme (Sec 3, with HPB)'],
    description: 'Sexuality Education enables students to understand physiological, social, and emotional changes, develop healthy relationships, and make wise, informed, responsible decisions. Covers five themes: Human Development, Interpersonal Relationships, Sexual Health, Sexual Behaviour, and Culture/Society/Law. Premised on the family as the basic unit of society.',
    topics: ['Human development & puberty', 'Healthy relationships & boundaries', 'Respect for self and others', 'Online safety in relationships', 'Informed decision-making']
  },
  {
    id: 'MH',
    label: 'Mental Health',
    color: '#0ea5e9',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 110 20 10 10 0 010-20z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    themes: ['Peer Support & PSLs', 'Help-Seeking Behaviour', 'Stress Management', 'Resilience Building'],
    framework: '"I am, I have, I can" resilience framework. Peer Support Leaders (PSLs) — schools train up to 5% of students to anchor supportive networks.',
    description: 'Mental Health education equips students to manage thoughts, feelings, and behaviours to cope with life\'s stresses, relate well to others, and develop a sense of meaning and purpose. Uses the "I am, I have, I can" resilience framework. Help-seeking is "not a sign of weakness but an act of strength."',
    topics: ['Emotional literacy & regulation', 'Peer support & help-seeking', 'Stress vs distress management', 'Resilience & growth mindset', 'Anti-bullying']
  },
  {
    id: 'ECG',
    label: 'Education & Career Guidance',
    color: '#f59e0b',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/></svg>`,
    themes: ['Who am I? (Discovering Purpose)', 'Where do I want to go? (Exploring Opportunities)', 'How do I get there? (Staying Relevant)'],
    framework: 'Three guiding questions: "Who am I?", "Where do I want to go?", "How do I get there?" — tied to Big Idea of Identity.',
    description: 'Education & Career Guidance helps students develop a sense of purpose in life, navigate education and career pathways purposefully, and embrace lifelong learning. Built around three guiding questions: "Who am I?" (self-awareness), "Where do I want to go?" (exploration), and "How do I get there?" (adaptability). Develops growth mindset, self-directedness, and appreciation for all occupations.',
    topics: ['Self-awareness (strengths, interests, values)', 'Career exploration & industry awareness', 'MySkillsFuture portal', 'Post-secondary pathways', 'Sense of purpose & lifelong learning']
  },
  {
    id: 'CW',
    label: 'Cyber Wellness',
    color: '#06b6d4',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    themes: ['Cyber Identity', 'Cyber Use', 'Cyber Relationships', 'Cyber Citizenship'],
    principles: ['Respect for Self & Others', 'Safe & Responsible Use', 'Positive Peer Influence'],
    framework: 'Sense-Think-Act: Sense (identify online risks), Think (analyse & reflect on CW principles), Act (take safe actions & be positive influence).',
    description: 'Cyber Wellness develops responsible digital learners who can harness ICT for positive purposes and maintain a safe presence in cyberspace. Built on three principles: Respect for Self & Others, Safe & Responsible Use, and Positive Peer Influence. Uses the Sense-Think-Act framework across four themes: Cyber Identity, Cyber Use, Cyber Relationships, and Cyber Citizenship.',
    topics: ['Balanced use of ICT & screen time', 'Online safety & cyberbullying', 'Digital identity & footprint', 'Online scams & misinformation', 'Social media & mental health']
  },
  {
    id: 'FE',
    label: 'Family Education',
    color: '#ec4899',
    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    themes: ['Family as Foundation', 'Family Bonds', 'Family Relationships', 'Filial Piety'],
    description: 'Family Education helps students appreciate the family as a foundational social unit. Students learn about managing family relationships, expressing appreciation, fulfilling responsibilities as family members, and practising filial piety.',
    topics: ['Family as foundational social unit', 'Appreciating family bonds', 'Managing family relationships', 'Filial piety & family responsibilities', 'Family diversity & inclusiveness']
  }
];

const BIG_IDEAS = ['Identity', 'Relationships', 'Choices'];

const R3ICH_VALUES = ['Respect', 'Responsibility', 'Resilience', 'Integrity', 'Care', 'Harmony'];

const SEL_COMPETENCIES = [
  'Self-Awareness',
  'Self-Management',
  'Social Awareness',
  'Relationship Management',
  'Responsible Decision-Making'
];

const NE_DISPOSITIONS = [
  'Sense of Belonging',
  'Sense of Hope',
  'Sense of Reality',
  'The Will to Act'
];

const LEVELS = ['Sec 1', 'Sec 2', 'Sec 3', 'Sec 4', 'Sec 5', 'JC 1', 'JC 2'];

const DISCUSSION_FORMATS = [
  'Four Corners',
  'Hot Seat',
  'Structured Academic Controversy',
  'Circle Structure',
  'Forum Theatre',
  'Think-Pair-Share',
  'Role Play / Perspective-Taking',
  'Case-Based Deliberation',
  'Values Clarification Exercise',
  'Others'
];

/* ── localStorage helpers ── */

function getSavedDiscussions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDiscussions(discussions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(discussions));
}

/* ── System prompt for CCE discussion generation ── */

function buildSystemPrompt(contentArea) {
  return `You are an expert CCE (Character & Citizenship Education) curriculum specialist in Singapore. You design engaging, age-appropriate CCE discussion lessons aligned to the CCE2021 framework.

## CCE2021 Framework

### Three Big Ideas
- **Identity**: Who am I? Developing self-awareness, sense of purpose, and moral compass.
- **Relationships**: How do I relate to others? Building empathy, respect, and positive connections.
- **Choices**: How do I make responsible choices? Ethical reasoning, consequences, responsible decision-making.

### Core Values (R3ICH)
Respect, Responsibility, Resilience, Integrity, Care, Harmony

### SEL Competencies
Self-Awareness, Self-Management, Social Awareness, Relationship Management, Responsible Decision-Making

### NE Citizenship Dispositions
Sense of Belonging, Sense of Hope, Sense of Reality, The Will to Act

### NE Commemorative Days
Total Defence Day, International Friendship Day, Racial Harmony Day, National Day

### CCE Content Areas
1. **National Education (NE)**: Singapore's history, governance, defence, multiculturalism, active citizenship
2. **Sexuality Education (SEd)**: Growing Years Programme, healthy relationships, boundaries, human development
3. **Mental Health (MH)**: Peer support, help-seeking, stress management, resilience, emotional regulation
4. **Education & Career Guidance (ECG)**: Self-awareness, career exploration, MySkillsFuture, work values
5. **Cyber Wellness (CW)**: Balanced ICT use, online safety, digital identity, cyberbullying, digital footprint
6. **Family Education (FE)**: Family bonds, relationships, filial piety, responsibilities

### Four CCE2021 Goals
1. Good Character — sound moral compass, ethical thinking
2. Resilience and Social-Emotional Well-Being — mental well-being, coping skills
3. Future Readiness — sense of purpose, adaptability, lifelong learning
4. Active Citizenship — national identity, sense of belonging, will to act

### Six Expanding Domains
Self → Family → School → Community → Nation → The World

### Content-Area Specific Frameworks
- **NE**: Head-Heart-Hands (engage intellectually, connect emotionally, act with commitment)
- **SEd**: 5 themes — Human Development, Interpersonal Relationships, Sexual Health, Sexual Behaviour, Culture/Society/Law
- **MH**: "I am, I have, I can" resilience framework; Peer Support Leaders (PSLs)
- **ECG**: 3 guiding questions — "Who am I?", "Where do I want to go?", "How do I get there?"
- **CW**: Sense-Think-Act framework; 3 principles — Respect for Self & Others, Safe & Responsible Use, Positive Peer Influence
- **FE**: Family as basic unit of society; roles, resilience, conflict resolution, gratitude

The current content area is: **${contentArea.label} (${contentArea.id})**
${contentArea.framework ? `\nContent-area framework: ${contentArea.framework}` : ''}

## Output Format
Be sharp and concise. Use bullet points. Give options where possible.

### Lesson Overview
Big Idea | Values | SEL | Content Area | Level | Format (one line each, as bullets)

### Hook Options (pick 2-3)
Short, punchy openers — 1-2 sentences each. Scenario, video prompt, news headline, or provocative question.

### Scenario (150 words max)
Realistic, age-appropriate, Singapore context. Just the scenario — no analysis.

### Guiding Questions (4)
Numbered. Each question scaffolded: perspectives → personal → ethical → action.

### Facilitation Tips
3-4 bullets for the selected discussion format. Practical, not theoretical.

### Reflection Prompt
One journal/exit ticket prompt. One commitment prompt. 2-3 sentences total.

### Teacher Notes
Bullets only: background context, sensitive handling tips, 2-3 extension ideas.`;
}

/* ── Render ── */

export function render(container) {
  let activeTab = 'NE';
  let generationId = 0;          // tracks async generation; increments on each renderView
  let pendingResult = null;       // holds { content, meta } if generation completes across a re-render

  function renderView() {
    generationId++;               // invalidate any in-flight generation from previous render
    const discussions = getSavedDiscussions();
    const area = CONTENT_AREAS.find(a => a.id === activeTab);

    container.innerHTML = `
      <div class="main-scroll">
      <style>
        .cce-header {
          text-align: center;
          padding: var(--sp-6, 24px) var(--sp-4, 16px) var(--sp-4, 16px);
        }
        .cce-header h1 {
          font-size: 2rem;
          font-weight: 800;
          margin: 0 0 6px;
          letter-spacing: -0.02em;
        }
        .cce-header p {
          color: var(--ink-secondary, #666);
          font-size: 0.9375rem;
          margin: 0;
        }
        .cce-tabs {
          display: flex;
          gap: 6px;
          justify-content: center;
          flex-wrap: wrap;
          padding: 0 var(--sp-4, 16px);
          margin-bottom: var(--sp-5, 20px);
        }
        .cce-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: var(--radius-md, 10px);
          border: 2px solid var(--border-light);
          background: var(--bg, #fff);
          color: var(--ink);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .cce-tab:hover {
          border-color: var(--accent);
          transform: translateY(-1px);
        }
        .cce-tab.active {
          color: #fff;
          border-color: transparent;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          transform: translateY(-1px);
        }
        .cce-tab svg {
          flex-shrink: 0;
        }
        .cce-content {
          max-width: 960px;
          margin: 0 auto;
          padding: 0 var(--sp-4, 16px) var(--sp-6, 24px);
        }
        .cce-overview {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--sp-4, 16px);
          margin-bottom: var(--sp-5, 20px);
        }
        @media (max-width: 700px) {
          .cce-overview { grid-template-columns: 1fr; }
        }
        .cce-card {
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--border-light);
          background: var(--bg, #fff);
          padding: var(--sp-4, 16px) var(--sp-5, 20px);
        }
        .cce-card h3 {
          font-size: 0.9375rem;
          font-weight: 700;
          margin: 0 0 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cce-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .cce-tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .cce-tag {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 14px;
          font-size: 0.6875rem;
          font-weight: 600;
          border: 1px solid var(--border-light);
          color: var(--ink-secondary, #666);
          background: var(--bg, #fff);
        }
        .cce-gen-section {
          margin-bottom: var(--sp-5, 20px);
        }
        .cce-gen-section h2 {
          font-size: 1.125rem;
          font-weight: 700;
          margin: 0 0 var(--sp-3, 12px);
        }
        .cce-gen-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--sp-3, 12px);
          margin-bottom: var(--sp-3, 12px);
        }
        @media (max-width: 600px) {
          .cce-gen-form { grid-template-columns: 1fr; }
        }
        .cce-gen-form .full-width {
          grid-column: 1 / -1;
        }
        .cce-gen-form label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--ink-secondary, #666);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .cce-result {
          margin-top: var(--sp-4, 16px);
          padding: var(--sp-4, 16px) var(--sp-5, 20px);
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--border-light);
          background: var(--bg, #fff);
          display: none;
        }
        .cce-result.visible { display: block; }
        .cce-result-content {
          line-height: 1.7;
          font-size: 0.9rem;
        }
        .cce-result-content h3 { font-size: 1rem; margin-top: 1.2em; }
        .cce-result-content ul, .cce-result-content ol { padding-left: 1.5em; }
        .cce-result-content strong { font-weight: 700; }
        .cce-save-bar {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: var(--sp-3, 12px);
          padding-top: var(--sp-3, 12px);
          border-top: 1px solid var(--border-light);
        }
        .cce-library-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--sp-3, 12px);
        }
        .cce-lib-card {
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--border-light);
          background: var(--bg, #fff);
          padding: var(--sp-3, 12px) var(--sp-4, 16px);
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .cce-lib-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .cce-lib-card h4 {
          margin: 0 0 8px;
          font-size: 0.875rem;
          font-weight: 700;
        }
        .cce-lib-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 6px;
        }
        .cce-lib-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          font-size: 0.6875rem;
          color: var(--ink-secondary, #666);
        }
        .cce-expanded-content {
          margin-top: var(--sp-3, 12px);
          padding-top: var(--sp-3, 12px);
          border-top: 1px solid var(--border-light);
          font-size: 0.875rem;
          line-height: 1.7;
          display: none;
        }
        .cce-expanded-content.visible { display: block; }
        .cce-expanded-content h3 { font-size: 0.9375rem; margin-top: 1em; }
        .cce-expanded-content ul, .cce-expanded-content ol { padding-left: 1.5em; }
        .cce-loading {
          display: none;
          align-items: center;
          gap: 8px;
          padding: var(--sp-3, 12px);
          color: var(--ink-secondary, #666);
          font-size: 0.8125rem;
        }
        .cce-loading.visible { display: flex; }
        .cce-spinner {
          width: 18px; height: 18px;
          border: 2px solid var(--border-light);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: cceSpin 0.6s linear infinite;
        }
        @keyframes cceSpin { to { transform: rotate(360deg); } }
        .cce-empty {
          text-align: center;
          padding: var(--sp-6, 24px);
          color: var(--ink-secondary, #666);
          font-size: 0.875rem;
        }
      </style>

      <!-- Header -->
      <div class="cce-header">
        <h1>CCE2021</h1>
        <p>Character & Citizenship Education — Singapore Framework</p>
      </div>

      <!-- Tabs -->
      <div class="cce-tabs">
        ${CONTENT_AREAS.map(a => `
          <button class="cce-tab${a.id === activeTab ? ' active' : ''}"
                  data-tab="${a.id}"
                  style="${a.id === activeTab ? `background:${a.color};border-color:${a.color};` : ''}">
            ${a.icon}
            <span>${a.id}</span>
          </button>
        `).join('')}
      </div>

      <!-- Content -->
      <div class="cce-content">

        <!-- Discussion Generator (primary action — at the top) -->
        <div class="cce-gen-section">
          <h2>Discussion Generator</h2>
          <div class="cce-card">
            <div class="cce-gen-form">
              <div class="full-width">
                <label for="cce-topic">Topic / Issue</label>
                <input id="cce-topic" class="input" type="text" placeholder="e.g. Should National Service be extended to women?" style="width:100%;box-sizing:border-box;">
              </div>
              <div>
                <label for="cce-level">Level</label>
                <select id="cce-level" class="input" style="width:100%;box-sizing:border-box;">
                  ${LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}
                </select>
              </div>
              <div>
                <label for="cce-format">Discussion Format</label>
                <select id="cce-format" class="input" style="width:100%;box-sizing:border-box;">
                  ${DISCUSSION_FORMATS.map(f => `<option value="${f}">${f}</option>`).join('')}
                </select>
              </div>
              <div class="full-width" id="cce-custom-format-wrap" style="display:none;">
                <label for="cce-custom-format">Your Discussion Format</label>
                <input id="cce-custom-format" class="input" type="text" placeholder="e.g. Socratic Seminar, Fishbowl, Philosophical Chairs..." style="width:100%;box-sizing:border-box;">
              </div>
            </div>
            <div style="margin-bottom: var(--sp-3);">
              <label style="display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; font-size: 0.8125rem; color: var(--ink);">
                <input type="checkbox" id="cce-youtube-cb" style="accent-color: var(--accent);"${cceIncludeYouTube ? ' checked' : ''} />
                Include suggested YouTube videos as discussion starters
              </label>
            </div>
            <div style="margin-bottom: var(--sp-4);">
              <label style="display: block; font-size: 0.75rem; font-weight: 600; color: var(--ink-secondary); margin-bottom: var(--sp-2); text-transform: uppercase; letter-spacing: 0.03em;">
                Suggest material from news sources <span style="font-weight: 400; text-transform: none; letter-spacing: 0;">(optional)</span>
              </label>
              <div style="display: flex; flex-wrap: wrap; gap: var(--sp-2);" id="cce-news-sources">
                ${['The Straits Times', 'CNA', 'TODAY', 'BBC', 'CNN', 'Reuters'].map(src => {
                  const isActive = cceNewsSources.includes(src);
                  return `<button type="button" class="cce-news-chip" data-source="${src}" style="
                    padding: 5px 14px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    border: 1.5px solid ${isActive ? 'var(--accent)' : 'var(--border-light)'};
                    background: ${isActive ? 'var(--accent)' : 'var(--bg, #fff)'};
                    color: ${isActive ? '#fff' : 'var(--ink-secondary, #666)'};
                    transition: all 0.15s ease;
                    font-family: inherit;
                  ">${src}</button>`;
                }).join('')}
              </div>
            </div>
            <button id="cce-generate-btn" class="btn btn-primary" style="width:100%;">Generate Discussion</button>
            <div id="cce-loading" class="cce-loading">
              <div class="cce-spinner"></div>
              <span>Generating discussion lesson...</span>
            </div>
          </div>

          <!-- Result area -->
          <div id="cce-result" class="cce-result">
            <div id="cce-result-content" class="cce-result-content"></div>
            <div class="cce-save-bar">
              <input id="cce-save-title" class="input" type="text" placeholder="Discussion title..." style="flex:1;">
              <button id="cce-save-btn" class="btn btn-primary">Save</button>
            </div>
          </div>
        </div>

        <!-- Saved Discussions Library -->
        <div class="cce-gen-section">
          <h2>Saved Discussions</h2>
          ${(() => {
            const filtered = discussions.filter(d => d.contentArea === activeTab);
            if (filtered.length === 0) {
              return `<div class="cce-empty">No saved discussions for ${area.label} yet. Generate one above!</div>`;
            }
            return `<div class="cce-library-grid">
              ${filtered.map(d => {
                const areaColor = area.color;
                return `
                <div class="cce-lib-card" data-id="${d.id}">
                  <div style="font-weight:700;font-size:0.9375rem;color:var(--ink);margin-bottom:6px;">${escapeHTML(d.title)}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                    <span class="cce-badge" style="background:${areaColor};color:#fff;font-size:0.6875rem;">${d.contentArea || 'NE'}</span>
                    ${d.bigIdea ? `<span class="cce-badge" style="background:var(--accent-light);color:var(--accent);font-size:0.6875rem;">${escapeHTML(d.bigIdea)}</span>` : ''}
                  </div>
                  <div style="font-size:0.75rem;color:var(--ink-secondary,#666);">
                    ${d.level || ''} · ${d.format || ''} · ${new Date(d.createdAt).toLocaleDateString('en-SG', {day:'numeric',month:'short',year:'numeric'})}
                  </div>
                  <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="btn btn-sm btn-primary cce-view-btn" data-id="${d.id}">View</button>
                    <button class="btn btn-sm btn-ghost cce-delete-btn" data-id="${d.id}" style="color:var(--danger);">Delete</button>
                  </div>
                </div>
              `; }).join('')}
            </div>`;
          })()}
        </div>

        <!-- Content Area Reference (below generator) -->
        <div class="cce-overview">
          <div class="cce-card">
            <h3>
              <span class="cce-badge" style="background:${area.color}22;color:${area.color};">${area.id}</span>
              ${area.label}
            </h3>
            <p style="font-size:0.8125rem;color:var(--ink-secondary,#666);line-height:1.6;margin:0 0 10px;">${area.description}</p>
            <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#666);margin-bottom:4px;">Key Themes</div>
            <div class="cce-tag-row">
              ${area.themes.map(t => `<span class="cce-tag">${t}</span>`).join('')}
            </div>
            ${area.framework ? `
              <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#666);margin:10px 0 4px;">Framework</div>
              <p style="font-size:0.8rem;color:var(--ink-secondary,#666);line-height:1.5;margin:0 0 6px;padding:8px 12px;background:${area.color}08;border-left:3px solid ${area.color};border-radius:0 6px 6px 0;">${area.framework}</p>
            ` : ''}
            ${area.commemorativeDays ? `
              <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#666);margin:10px 0 4px;">NE Commemorative Days</div>
              <div class="cce-tag-row">
                ${area.commemorativeDays.map(d => `<span class="cce-tag" style="border-color:${area.color}44;color:${area.color};">${d}</span>`).join('')}
              </div>
            ` : ''}
            ${area.principles ? `
              <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#666);margin:10px 0 4px;">Guiding Principles</div>
              <div class="cce-tag-row">
                ${area.principles.map(p => `<span class="cce-tag" style="border-color:${area.color}44;color:${area.color};">${p}</span>`).join('')}
              </div>
            ` : ''}
            ${area.programmes ? `
              <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#666);margin:10px 0 4px;">Key Programmes</div>
              <div class="cce-tag-row">
                ${area.programmes.map(p => `<span class="cce-tag" style="border-color:${area.color}44;color:${area.color};">${p}</span>`).join('')}
              </div>
            ` : ''}
            <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#666);margin:10px 0 4px;">Core Values (R3ICH)</div>
            <div class="cce-tag-row">
              ${R3ICH_VALUES.map(v => `<span class="cce-tag">${v}</span>`).join('')}
            </div>
          </div>

          <div class="cce-card">
            <h3>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Big Ideas Connection
            </h3>
            <p style="font-size:0.8125rem;color:var(--ink-secondary,#666);line-height:1.6;margin:0 0 12px;">
              Every CCE lesson connects to one or more of the three Big Ideas that form the backbone of the CCE2021 curriculum.
            </p>
            ${BIG_IDEAS.map(idea => {
              const desc = idea === 'Identity'
                ? 'Who am I? Developing self-awareness, sense of purpose, and moral compass.'
                : idea === 'Relationships'
                ? 'How do I relate to others? Building empathy, respect, and positive connections.'
                : 'How do I make responsible choices? Ethical reasoning, consequences, responsible decision-making.';
              return `
                <div style="margin-bottom:10px;padding:8px 12px;border-radius:8px;border:1px solid var(--border-light,#e5e7eb);">
                  <div style="font-weight:700;font-size:0.8125rem;margin-bottom:2px;">${idea}</div>
                  <div style="font-size:0.75rem;color:var(--ink-secondary,#666);line-height:1.5;">${desc}</div>
                </div>`;
            }).join('')}
            <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary,#666);margin:10px 0 4px;">SEL Competencies</div>
            <div class="cce-tag-row">
              ${SEL_COMPETENCIES.map(c => `<span class="cce-tag">${c}</span>`).join('')}
            </div>
          </div>
        </div>

      </div>
      </div>
    `;

    /* ── Wire up event listeners ── */

    // Tab switching
    container.querySelectorAll('.cce-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        cceIncludeYouTube = false;
        cceNewsSources = [];
        renderView();
      });
    });

    // "Others" custom format toggle
    const formatSelect = container.querySelector('#cce-format');
    const customFormatWrap = container.querySelector('#cce-custom-format-wrap');
    formatSelect.addEventListener('change', () => {
      customFormatWrap.style.display = formatSelect.value === 'Others' ? '' : 'none';
    });

    // YouTube checkbox
    const youtubeCb = container.querySelector('#cce-youtube-cb');
    if (youtubeCb) {
      youtubeCb.addEventListener('change', () => {
        cceIncludeYouTube = youtubeCb.checked;
      });
    }

    // News source chips
    container.querySelectorAll('.cce-news-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const src = chip.dataset.source;
        const idx = cceNewsSources.indexOf(src);
        if (idx >= 0) {
          cceNewsSources.splice(idx, 1);
          chip.style.border = '1.5px solid var(--border-light)';
          chip.style.background = 'var(--bg, #fff)';
          chip.style.color = 'var(--ink-secondary, #666)';
        } else {
          cceNewsSources.push(src);
          chip.style.border = '1.5px solid var(--accent)';
          chip.style.background = 'var(--accent)';
          chip.style.color = '#fff';
        }
      });
    });

    // Generate discussion
    const generateBtn = container.querySelector('#cce-generate-btn');
    const loadingEl = container.querySelector('#cce-loading');
    const resultEl = container.querySelector('#cce-result');
    const resultContent = container.querySelector('#cce-result-content');

    generateBtn.addEventListener('click', async () => {
      const topic = container.querySelector('#cce-topic').value.trim();
      const level = container.querySelector('#cce-level').value;
      const rawFormat = container.querySelector('#cce-format').value;
      const format = rawFormat === 'Others'
        ? (container.querySelector('#cce-custom-format').value.trim() || 'Open Discussion')
        : rawFormat;

      if (!topic) {
        showToast('Please enter a topic or issue.', 'warning');
        return;
      }

      const thisGenId = generationId; // snapshot so we can detect stale completions

      generateBtn.disabled = true;
      loadingEl.classList.add('visible');
      resultEl.classList.remove('visible');

      try {
        const systemPrompt = buildSystemPrompt(area);
        let userMessage = `Create a CCE discussion lesson for the following:
- **Content Area**: ${area.id} — ${area.label}
- **Topic/Issue**: ${topic}
- **Level**: ${level}
- **Discussion Format**: ${format}

Design an engaging, age-appropriate lesson that connects to the CCE2021 framework. Use the ${format} facilitation strategy.`;

        if (cceIncludeYouTube) {
          userMessage += `\n\nInclude 2-3 suggested YouTube videos relevant to this discussion topic. Format each as: [Video Title](https://www.youtube.com/results?search_query=ENCODED_QUERY). Choose videos from reputable educational channels (CNA Insider, TED-Ed, Channel NewsAsia, The Straits Times).`;
        }

        if (cceNewsSources.length > 0) {
          userMessage += `\n\nReference or suggest discussion material from these news outlets where relevant: ${cceNewsSources.join(', ')}. Frame scenarios around real issues these outlets would cover. Where possible, suggest specific search terms teachers can use to find relevant articles on these platforms.`;
        }

        const text = await sendChat(
          [{ role: 'user', content: userMessage }],
          { trackLabel: 'cceDiscussionDirect', systemPrompt, temperature: 0.7, maxTokens: 4096 }
        );

        // If user switched tabs while we were generating, store result
        // so it can be shown later, and don't touch (now-stale) DOM refs
        if (thisGenId !== generationId) {
          pendingResult = { content: text, meta: { contentArea: activeTab, level, format }, title: topic };
          showToast('Discussion generated! Switch back to see it.', 'success');
          return;
        }

        resultContent.innerHTML = renderMarkdown(text);
        processLatex(resultContent);
        resultEl.classList.add('visible');
        resultEl._generatedContent = text;
        resultEl._meta = { contentArea: activeTab, level, format };

        // Pre-fill title
        const titleInput = container.querySelector('#cce-save-title');
        titleInput.value = topic.length > 60 ? topic.slice(0, 57) + '...' : topic;

        showToast('Discussion generated!', 'success');
      } catch (err) {
        if (thisGenId !== generationId) return; // stale — silently ignore
        console.error('CCE generation error:', err);
        showToast(`Generation failed: ${err.message}`, 'danger');
      } finally {
        if (thisGenId === generationId) {
          generateBtn.disabled = false;
          loadingEl.classList.remove('visible');
        }
      }
    });

    // Save discussion
    const saveBtn = container.querySelector('#cce-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const titleInput = container.querySelector('#cce-save-title');
        const title = titleInput.value.trim();
        if (!title) {
          showToast('Please enter a title.', 'warning');
          return;
        }
        if (!resultEl._generatedContent) {
          showToast('No discussion to save.', 'warning');
          return;
        }

        // Extract Big Idea and values from the generated content
        const content = resultEl._generatedContent;
        const bigIdeaMatch = content.match(/\*\*Big Idea\*\*:\s*(.+)/i);
        const valuesMatch = content.match(/\*\*R3ICH Values?\*\*:\s*(.+)/i);

        const discussion = {
          id: generateId(),
          title,
          contentArea: resultEl._meta.contentArea,
          bigIdea: bigIdeaMatch ? bigIdeaMatch[1].trim() : '',
          values: valuesMatch ? valuesMatch[1].trim() : '',
          level: resultEl._meta.level,
          format: resultEl._meta.format,
          content,
          createdAt: Date.now()
        };

        const discussions = getSavedDiscussions();
        discussions.unshift(discussion);
        saveDiscussions(discussions);

        showToast('Discussion saved!', 'success');
        renderView();
      });
    }

    // View discussion in modal
    container.querySelectorAll('.cce-view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const discussion = getSavedDiscussions().find(d => d.id === id);
        if (!discussion) return;
        openModal({
          title: discussion.title || 'Discussion',
          width: 720,
          body: `<div style="font-size:0.875rem;line-height:1.7;color:var(--ink);">${renderMarkdown(discussion.content || '')}</div>`,
          footer: `<button class="btn btn-secondary" data-action="cancel">Close</button>`
        });
      });
    });

    // Delete discussion
    container.querySelectorAll('.cce-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const confirmed = await confirmDialog({
          title: 'Delete Discussion',
          message: 'Are you sure you want to delete this saved discussion? This cannot be undone.',
          confirmLabel: 'Delete',
          confirmClass: 'btn btn-danger'
        });
        if (confirmed) {
          const discussions = getSavedDiscussions().filter(d => d.id !== id);
          saveDiscussions(discussions);
          showToast('Discussion deleted.', 'success');
          renderView();
        }
      });
    });

    // If there's a pending result from a generation that completed while on another tab, show it now
    if (pendingResult) {
      const pr = pendingResult;
      pendingResult = null;
      resultContent.innerHTML = renderMarkdown(pr.content);
      processLatex(resultContent);
      resultEl.classList.add('visible');
      resultEl._generatedContent = pr.content;
      resultEl._meta = pr.meta;
      const titleInput = container.querySelector('#cce-save-title');
      if (titleInput) {
        titleInput.value = pr.title.length > 60 ? pr.title.slice(0, 57) + '...' : pr.title;
      }
    }
  }

  renderView();
}

/* ── Utility: escape HTML ── */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ── Utility: simple markdown to HTML ── */
function renderMarkdown(md) {
  if (!md) return '';

  // Extract links before escaping
  const linkPlaceholders = [];
  let processed = md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
    const idx = linkPlaceholders.length;
    linkPlaceholders.push({ label, url });
    return `%%LINK_${idx}%%`;
  });

  let html = escapeHTML(processed);

  // Restore links with proper HTML
  html = html.replace(/%%LINK_(\d+)%%/g, (_, idx) => {
    const { label, url } = linkPlaceholders[parseInt(idx)];
    // YouTube search tile
    const ytSearch = url.match(/youtube\.com\/results\?search_query=/);
    if (ytSearch) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--border,#e2e5ea);border-radius:8px;text-decoration:none;color:var(--ink);font-size:0.8125rem;margin:4px 0;background:var(--bg-card,#fff);">` +
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="#dc2626"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98" fill="#fff"/></svg>` +
        `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(label)}</span>` +
        `<span style="font-size:0.6875rem;color:#dc2626;white-space:nowrap;">Search →</span></a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">${escapeHTML(label)}</a>`;
  });

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.05rem;margin-top:1.2em;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Paragraphs — convert double newlines
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[1-3]>)/g, '$1');
  html = html.replace(/(<\/h[1-3]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');

  return html;
}
