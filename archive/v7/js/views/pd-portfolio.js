/*
 * Co-Cher — My Professional Growth
 * =================================
 * Personal PD portfolio: folders for courses, workshops, reflections.
 * Materials can be selected as context when designing lessons.
 */

import { Store, generateId } from '../state.js';
import { navigate } from '../router.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { showToast } from '../components/toast.js';
import { createFileUploadZone } from '../components/pdf-upload.js';
import { extractText, fileExt } from '../utils/doc-extract.js';
import { sendChat } from '../api.js';
import { md } from '../utils/markdown.js';

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }); }
function timeAgo(ts) {
  const d = Date.now() - ts, m = Math.floor(d / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`;
}

const FOLDER_ICONS = {
  course: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  workshop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  conference: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  selfstudy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  pedagogy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
  other: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
};

const FOLDER_COLORS = {
  course: 'var(--accent)',
  workshop: 'var(--success)',
  conference: 'var(--info)',
  selfstudy: 'var(--warning)',
  pedagogy: '#8b5cf6',
  other: 'var(--ink-muted)'
};

const CATEGORY_LABELS = {
  course: 'Course / Module',
  workshop: 'Workshop',
  conference: 'Conference / Seminar',
  selfstudy: 'Self-Study',
  pedagogy: 'Pedagogy',
  other: 'Other'
};

/* ══════════ My Practice (Teacher Growth Engine) ══════════ */

const PRACTICE_COACH_PROMPT = `You are a teacher-development coach. Frame your analysis with Duckworth's deliberate-practice principles (goals just beyond current ability, focused effort, immediate feedback, reflective repetition) and Hattie's Visible Learning evidence (e.g. teacher clarity d=0.75, feedback d=0.70). Be concise and concrete — quote or reference the teacher's own entries.

Respond in markdown with exactly this structure:
### Strengths
Two bullet points, each naming a strength with evidence from the entries.
### Growth edge
One short paragraph naming the single most promising area to work on.
### Suggested micro-goal
One sentence — a specific, observable action the teacher can attempt in their next 2 lessons. End your response with a final line formatted exactly as:
MICRO-GOAL: <that one sentence>`;

// Kept across re-renders this session so the profile survives goal changes
let practiceProfileMd = null;
let practiceGoalSuggestion = '';

function renderPracticeProfile() {
  return `
    <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--sp-4);margin-bottom:var(--sp-3);">
      <div style="font-size:0.8125rem;line-height:1.7;color:var(--ink-secondary);">${md(practiceProfileMd)}</div>
      ${!Store.getPracticeGoal() && practiceGoalSuggestion ? `
        <div style="display:flex;justify-content:flex-end;margin-top:var(--sp-3);">
          <button class="btn btn-secondary btn-sm" id="practice-set-goal-btn">Set as my goal</button>
        </div>
      ` : ''}
    </div>`;
}

function renderPracticeSection() {
  const log = Store.getPracticeLog();
  const goal = Store.getPracticeGoal();
  const last = log[log.length - 1];
  return `
    <div class="card" style="margin-bottom:var(--sp-6);border-left:3px solid var(--marker, #FFE200);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-2);">
        <h3 style="font-family:var(--font-serif, Georgia, serif);font-size:1.125rem;font-weight:600;color:var(--ink);">My Practice</h3>
        <span class="badge badge-gray">${log.length} entr${log.length === 1 ? 'y' : 'ies'}${last ? ` &middot; last ${fmtDate(last.createdAt)}` : ''}</span>
      </div>
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">Every lesson reflection, rehearsal debrief and capture feeds this record of your teaching practice.</p>

      ${goal ? `
        <div style="background:var(--marker-wash, #FFF9C9);border-left:3px solid var(--marker, #FFE200);border-radius:var(--radius-md);padding:var(--sp-3) var(--sp-4);margin-bottom:var(--sp-3);">
          <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-muted);margin-bottom:2px;">Current practice goal &middot; set ${fmtDate(goal.createdAt)}</div>
          <div style="font-family:var(--font-serif, Georgia, serif);font-size:0.9375rem;color:var(--ink);line-height:1.6;">${esc(goal.text)}</div>
          <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-2);">
            <button class="btn btn-secondary btn-sm" id="practice-goal-achieved-btn">Mark achieved</button>
            <button class="btn btn-ghost btn-sm" id="practice-goal-change-btn">Change goal</button>
          </div>
        </div>
      ` : ''}

      ${log.length === 0 ? `
        <p style="font-size:0.8125rem;color:var(--ink-faint);font-style:italic;margin-bottom:var(--sp-3);">No practice entries yet — save a lesson reflection or run a rehearsal to start building your profile.</p>
      ` : `
        <button class="btn btn-primary btn-sm" id="practice-profile-btn" style="margin-bottom:var(--sp-3);">Generate my practice profile</button>
      `}
      <div id="practice-profile-output">${practiceProfileMd ? renderPracticeProfile() : ''}</div>
      <div id="practice-mirror-slot" style="margin-top:var(--sp-3);">${renderIdeologyMirror()}</div>
    </div>`;
}

/* ── Espoused vs enacted: the ideology mirror ──
 * The teacher names the orientation they ASPIRE to in Settings
 * (cocher_espoused_ideology). Here we keyword-classify their actual saved
 * plans and hold the two up against each other. Deliberately a heuristic —
 * the point is a moment of honest reflection, not a verdict, so the copy
 * stays in the critical-friend voice and the method is disclosed. */

const IDEOLOGY_META = {
  'learner-centred': { label: 'Learner-Centred' },
  'scholar-academic': { label: 'Scholar-Academic' },
  'social-efficiency': { label: 'Social Efficiency' },
  'social-reconstructivist': { label: 'Social Reconstructivist' }
};

const IDEOLOGY_LEXICON = {
  'learner-centred': ['student choice', 'choice board', 'their interests', 'student interests', 'agency', 'self-directed', 'inquiry', 'student-led', 'student voice', 'personalised', 'personalized', 'differentiat', 'explore', 'curiosity', 'ownership', 'wonder', 'own pace', 'passion'],
  'scholar-academic': ['direct instruction', 'worked example', 'content mastery', 'disciplinary', 'canon', 'lecture', 'definitions', 'key concepts', 'subject knowledge', 'notes', 'textbook', 'theory', 'rigour', 'rigor', 'derivation', 'proof', 'terminology'],
  'social-efficiency': ['learning objectives', 'success criteria', 'measurable', 'assessment', 'exam', 'test', 'drill', 'practice questions', 'performance', 'standards', 'competenc', 'skills', 'outcomes', 'efficiency', 'readiness', 'timed', 'checklist', 'mastery check'],
  'social-reconstructivist': ['justice', 'equity', 'inequality', 'community', 'real-world issue', 'social issue', 'debate', 'perspectives', 'take action', 'advocacy', 'sustainability', 'empathy', 'ethics', 'service learning', 'civic', 'activism', 'marginalised', 'marginalized']
};

/** Count lexicon hits for one plan text; returns {ideology: hits}. */
function classifyPlanText(text) {
  const t = String(text || '').toLowerCase();
  const scores = {};
  for (const [id, words] of Object.entries(IDEOLOGY_LEXICON)) {
    let n = 0;
    for (const w of words) {
      let i = t.indexOf(w);
      while (i !== -1) { n++; i = t.indexOf(w, i + w.length); }
    }
    scores[id] = n;
  }
  return scores;
}

/** The plannable text of a lesson: latest AI plan message, else lesson.plan. */
function lessonPlanText(l) {
  const aiMsgs = (l.chatHistory || []).filter(m => m.role === 'assistant' || m.role === 'model');
  const latest = aiMsgs.length ? aiMsgs[aiMsgs.length - 1].content : '';
  return `${latest || ''}\n${l.plan || ''}`;
}

function renderIdeologyMirror() {
  let espoused = '';
  try { espoused = localStorage.getItem('cocher_v7_espoused_ideology') || ''; } catch { /* ignore */ }

  const hint = (msg) => `
    <div style="padding:var(--sp-3);border:1px dashed var(--border);border-radius:var(--radius-md);font-size:0.75rem;color:var(--ink-faint);font-style:italic;">${msg}</div>`;

  if (!espoused || !IDEOLOGY_META[espoused]) {
    return hint('Name your teaching orientation in <a href="#/settings" style="color:var(--accent);">Settings &rarr; Enactment</a> and this mirror will compare it against what your plans actually look like.');
  }

  // Aggregate keyword signal across recent plans that carry any text
  const lessons = Store.getLessons()
    .filter(l => !l.isExemplar)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 12);
  const totals = { 'learner-centred': 0, 'scholar-academic': 0, 'social-efficiency': 0, 'social-reconstructivist': 0 };
  let plansWithSignal = 0;
  for (const l of lessons) {
    const scores = classifyPlanText(lessonPlanText(l));
    const sum = Object.values(scores).reduce((a, b) => a + b, 0);
    if (sum === 0) continue;
    plansWithSignal++;
    for (const id of Object.keys(totals)) totals[id] += scores[id];
  }

  if (plansWithSignal < 3) {
    return hint(`Mirror ready after 3 plans with enough to read — ${plansWithSignal} so far. Keep designing.`);
  }

  const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  const enacted = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0];
  const aligned = enacted === espoused;

  const bars = Object.keys(IDEOLOGY_META).map(id => {
    const pct = Math.round((totals[id] / grand) * 100);
    const isEspoused = id === espoused;
    const isEnacted = id === enacted;
    return `
      <div style="display:flex;align-items:center;gap:var(--sp-2);font-size:0.6875rem;">
        <span style="width:132px;flex-shrink:0;color:var(--ink-secondary);${isEspoused ? 'font-weight:700;' : ''}">${IDEOLOGY_META[id].label}${isEspoused ? ' <span style="background:var(--marker-wash,#FFF6BF);padding:0 4px;border-radius:3px;">aspires</span>' : ''}</span>
        <div style="flex:1;height:10px;border-radius:5px;background:var(--bg-subtle);overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${isEnacted ? 'var(--brand-navy,#000C53)' : 'var(--border)'};"></div>
        </div>
        <span style="width:32px;text-align:right;color:var(--ink-muted);">${pct}%</span>
      </div>`;
  }).join('');

  const verdict = aligned
    ? `<p style="font-size:0.8125rem;color:var(--growth,#2c7a4b);line-height:1.6;margin-top:var(--sp-2);font-family:var(--font-serif, Georgia, serif);">Your plans walk your talk — the ${IDEOLOGY_META[espoused].label} orientation you named shows up strongest in what you actually design.</p>`
    : `<p class="redpen-note" style="font-size:0.8125rem;color:var(--redpen,#C94F4F);line-height:1.6;margin-top:var(--sp-2);font-family:var(--font-serif, Georgia, serif);">You aspire to ${IDEOLOGY_META[espoused].label}, but your recent plans lean ${IDEOLOGY_META[enacted].label}. Not a verdict — just a mirror. Worth one deliberate ${IDEOLOGY_META[espoused].label.toLowerCase()} design move in your next plan?</p>`;

  return `
    <div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:var(--sp-4);">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-3);">
        <span style="font-weight:600;font-size:0.875rem;color:var(--ink);">Espoused vs enacted</span>
        <span style="font-size:0.6875rem;color:var(--ink-faint);">keyword read of your last ${plansWithSignal} readable plans</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">${bars}</div>
      ${verdict}
    </div>`;
}

/* ══════════ My Practice Story (WS-G Growth loop) ══════════
 * A REVIEW surface the teacher opens. It COMPOSES existing data — practice-log
 * entries, saved reflections, engagement, loop-close cadence, current goal and
 * the espoused-vs-enacted mirror — into a warm, scannable term narrative. Pure
 * composition: no AI call, no writes, no auto-generated teacher content. Old
 * (string) reflections and empty logs are handled gracefully. */

const STORY_E21CC_LABELS = {
  cait: 'CAIT', cci: 'CCI', cgc: 'CGC',
  criticalThinking: 'Critical Thinking', creativeThinking: 'Creative Thinking',
  communication: 'Communication', collaboration: 'Collaboration',
  socialConnectedness: 'Social Connectedness', selfRegulation: 'Self-Regulation'
};

/** Engagement 1–5 from a reflection object, or 0 (legacy string reflections
 * and missing/out-of-range values count as no reading). */
function reflectionEngagement(l) {
  const r = l.reflection;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 0;
  const n = Number(r.engagement) || 0;
  return n >= 1 && n <= 5 ? n : 0;
}

/** Whether a lesson carries a real reflection (object fields or a non-empty
 * legacy string) — mirrors getReflectionsFromLessons' filter. */
function lessonIsReflected(l) {
  const r = l.reflection;
  if (!r) return false;
  if (typeof r === 'string') return r.trim().length > 0;
  return !!(r.whatWorked || r.whatToAdjust || r.engagement || r.e21ccObservations || r.freeform);
}

function monthGroup(ts) {
  const d = new Date(ts);
  return { key: `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`, label: d.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }) };
}

/** Compact espoused-vs-enacted read for the story. Returns null unless the
 * teacher named an orientation AND there are ≥3 readable plans to compare.
 * Same heuristic as renderIdeologyMirror, condensed to a snapshot. */
function computeIdeologySnapshot() {
  let espoused = '';
  try { espoused = localStorage.getItem('cocher_v7_espoused_ideology') || ''; } catch { /* ignore */ }
  if (!espoused || !IDEOLOGY_META[espoused]) return null;
  const lessons = Store.getLessons()
    .filter(l => !l.isExemplar)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 12);
  const totals = { 'learner-centred': 0, 'scholar-academic': 0, 'social-efficiency': 0, 'social-reconstructivist': 0 };
  let plansWithSignal = 0;
  for (const l of lessons) {
    const scores = classifyPlanText(lessonPlanText(l));
    if (Object.values(scores).reduce((a, b) => a + b, 0) === 0) continue;
    plansWithSignal++;
    for (const id of Object.keys(totals)) totals[id] += scores[id];
  }
  if (plansWithSignal < 3) return null;
  const enacted = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0];
  return {
    aligned: enacted === espoused,
    espousedLabel: IDEOLOGY_META[espoused].label,
    enactedLabel: IDEOLOGY_META[enacted].label
  };
}

function renderPracticeStorySection() {
  const log = Store.getPracticeLog();
  const lessons = Store.getLessons().filter(l => !l.isExemplar);
  const reflected = lessons.filter(lessonIsReflected).sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
  const goal = Store.getPracticeGoal();

  // Warm empty state — nothing to compose yet, and never a crash.
  if (log.length === 0 && reflected.length === 0) {
    return `
      <div class="card practice-story-card" style="margin-bottom:var(--sp-6);border-left:3px solid var(--marker, #FFE200);">
        <h3 style="font-family:var(--font-serif, Georgia, serif);font-size:1.125rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">My Practice Story</h3>
        <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">Your practice story starts with your first reflection. Teach a lesson, jot a line on what worked over in <a href="#/lessons" style="color:var(--accent);">Lessons</a>, and it will gather here into a term-long narrative — assembled from your own words, nothing auto-written.</p>
      </div>`;
  }

  // Engagement trend across reflected lessons in chronological order.
  const engs = reflected.map(reflectionEngagement).filter(v => v > 0);
  const avgEng = engs.length ? engs.reduce((a, b) => a + b, 0) / engs.length : 0;
  let trendPhrase = '';
  if (engs.length >= 2) {
    const half = Math.floor(engs.length / 2);
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const diff = mean(engs.slice(engs.length - half)) - mean(engs.slice(0, half));
    trendPhrase = diff > 0.3 ? 'engagement trending up'
      : diff < -0.3 ? 'engagement dipping a little lately'
      : 'engagement holding steady';
  } else if (engs.length === 1) {
    trendPhrase = 'engagement getting its first read';
  }

  // Growing focus: the most-named E21CC dimension across reflected (else all)
  // lessons.
  const focusPool = reflected.length ? reflected : lessons;
  const focusTally = {};
  focusPool.forEach(l => (l.e21ccFocus || []).forEach(f => { focusTally[f] = (focusTally[f] || 0) + 1; }));
  const topFocus = Object.keys(focusTally).sort((a, b) => focusTally[b] - focusTally[a])[0];
  const focusPhrase = topFocus ? `focus growing on ${STORY_E21CC_LABELS[topFocus] || topFocus}` : '';

  const carried = reflected.length;
  const totalLessons = lessons.length;

  const bits = [`${carried} lesson${carried === 1 ? '' : 's'} carried to reflection${totalLessons ? ` of ${totalLessons}` : ''}`];
  if (trendPhrase) bits.push(trendPhrase);
  if (focusPhrase) bits.push(focusPhrase);
  const headline = `This term so far: ${bits.join(', ')}.`;

  const statChips = [
    `${log.length} practice entr${log.length === 1 ? 'y' : 'ies'}`,
    `${carried} reflection${carried === 1 ? '' : 's'}`,
    avgEng ? `avg engagement ${avgEng.toFixed(1)}/5` : ''
  ].filter(Boolean);

  const ideo = computeIdeologySnapshot();
  const ideoLine = !ideo ? '' : (ideo.aligned
    ? `<p style="font-size:0.75rem;color:var(--growth,#2c7a4b);line-height:1.6;margin-top:var(--sp-2);">Your plans are walking your talk — they lean ${esc(ideo.espousedLabel)}, just as you aspire.</p>`
    : `<p style="font-size:0.75rem;color:var(--ink-muted);line-height:1.6;margin-top:var(--sp-2);">You aspire to ${esc(ideo.espousedLabel)}; your recent plans read closer to ${esc(ideo.enactedLabel)}. A mirror, not a verdict.</p>`);

  // Raw practice-log entries, grouped by month, newest month first, expandable.
  const groups = new Map();
  log.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach(e => {
    const { key, label } = monthGroup(e.createdAt);
    if (!groups.has(key)) groups.set(key, { label, entries: [] });
    groups.get(key).entries.push(e);
  });
  const groupBlocks = [...groups.values()].reverse().map(g => `
    <div style="margin-bottom:var(--sp-3);">
      <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-muted);margin-bottom:var(--sp-1);">${esc(g.label)} &middot; ${g.entries.length} entr${g.entries.length === 1 ? 'y' : 'ies'}</div>
      <div style="display:flex;flex-direction:column;">
        ${g.entries.slice().reverse().map(e => `
          <div style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.5;padding:var(--sp-2) 0;border-bottom:1px solid var(--border-light);">
            <div style="color:var(--ink-faint);font-size:0.6875rem;margin-bottom:2px;">${fmtDate(e.createdAt)}${e.lessonTitle ? ` &middot; ${esc(e.lessonTitle)}` : ''}${e.source ? ` &middot; ${esc(e.source)}` : ''}</div>
            ${String(e.text || '').trim() ? esc(String(e.text).slice(0, 300)) : '<span style="color:var(--ink-faint);font-style:italic;">(no note)</span>'}
          </div>`).join('')}
      </div>
    </div>`).join('');

  return `
    <div class="card practice-story-card" style="margin-bottom:var(--sp-6);border-left:3px solid var(--marker, #FFE200);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-2);">
        <h3 style="font-family:var(--font-serif, Georgia, serif);font-size:1.125rem;font-weight:600;color:var(--ink);">My Practice Story</h3>
        <span class="badge badge-gray">review</span>
      </div>
      <p style="font-family:var(--font-serif, Georgia, serif);font-size:1rem;color:var(--ink);line-height:1.6;margin-bottom:var(--sp-3);">${esc(headline)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-bottom:var(--sp-2);">
        ${statChips.map(c => `<span class="badge badge-blue">${esc(c)}</span>`).join('')}
      </div>
      ${goal ? `<p style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.6;margin-bottom:var(--sp-1);">Current focus: <strong style="font-family:var(--font-serif, Georgia, serif);">${esc(goal.text)}</strong></p>` : ''}
      ${ideoLine}
      ${log.length ? `
        <details style="margin-top:var(--sp-3);">
          <summary style="cursor:pointer;font-size:0.8125rem;color:var(--ink-muted);padding:var(--sp-2) 0;">The entries behind this story (${log.length})</summary>
          <div style="margin-top:var(--sp-2);">${groupBlocks}</div>
        </details>` : ''}
    </div>`;
}

function bindSetGoalBtn(container) {
  container.querySelector('#practice-set-goal-btn')?.addEventListener('click', () => {
    Store.setPracticeGoal({ text: practiceGoalSuggestion, focus: '', createdAt: Date.now() });
    showToast('Practice goal set!', 'success');
    render(container);
  });
}

function wirePracticeSection(container) {
  container.querySelector('#practice-profile-btn')?.addEventListener('click', async () => {
    const btn = container.querySelector('#practice-profile-btn');
    const out = container.querySelector('#practice-profile-output');
    const entries = Store.getPracticeLog().slice(-12);
    if (entries.length === 0 || !btn || !out) return;
    btn.disabled = true;
    out.innerHTML = '<div class="chat-typing" style="padding:var(--sp-3) 0;">Reading your practice log...</div>';
    const input = entries.map(e => {
      const where = e.lessonTitle ? ` — ${e.lessonTitle}` : '';
      return `- [${e.source}, ${fmtDate(e.createdAt)}${where}] ${String(e.text || '').replace(/\s+/g, ' ').slice(0, 400)}`;
    }).join('\n');
    try {
      const response = await sendChat(
        [{ role: 'user', content: `Here are my last ${entries.length} practice entries (lesson reflections, rehearsal debriefs, captures):\n\n${input}` }],
        { systemPrompt: PRACTICE_COACH_PROMPT, temperature: 0.6, maxTokens: 1200, trackLabel: 'practice_profile' }
      );
      practiceProfileMd = response;
      const match = response.match(/MICRO-GOAL:\s*(.+)/i);
      practiceGoalSuggestion = (match ? match[1] : (response.trim().split('\n').filter(l => l.trim()).pop() || ''))
        .replace(/[*_#>`]/g, '').trim();
      out.innerHTML = renderPracticeProfile();
      bindSetGoalBtn(container);
    } catch (err) {
      out.innerHTML = '';
      showToast(err.message, 'danger');
    } finally {
      btn.disabled = false;
    }
  });

  container.querySelector('#practice-goal-achieved-btn')?.addEventListener('click', () => {
    const goal = Store.getPracticeGoal();
    if (!goal) return;
    Store.addPracticeEntry({ source: 'capture', lessonTitle: '', classId: null, text: `Goal achieved: ${goal.text}` });
    Store.setPracticeGoal(null);
    showToast('Goal achieved — logged to your practice record!', 'success');
    render(container);
  });

  container.querySelector('#practice-goal-change-btn')?.addEventListener('click', () => {
    Store.setPracticeGoal(null);
    showToast('Goal cleared — generate a new profile to set another.');
    render(container);
  });

  bindSetGoalBtn(container);
}

/* ══════════ My References (reusable AI context library, like a skill) ══════════ */

const REFERENCE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

/** Human-readable size for a reference's stored content length. */
function fmtSize(len) {
  const n = len || 0;
  return n >= 1000 ? `${Math.round(n / 1000)}K chars` : `${n} char${n === 1 ? '' : 's'}`;
}

function renderReferencesSection() {
  const refs = Store.getReferences();
  const list = refs.map(r => `
    <div class="card" style="padding:var(--sp-4) var(--sp-5);border:1px solid var(--border-light);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--sp-3);">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:2px;">
            <span style="color:#8b5cf6;flex-shrink:0;">${REFERENCE_ICON}</span>
            <h4 style="font-weight:600;font-size:0.9375rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.name)}</h4>
          </div>
          <div style="font-size:0.6875rem;color:var(--ink-faint);margin-bottom:var(--sp-2);">
            ${r.source && r.source.filename ? esc(r.source.filename) + ' &middot; ' : ''}${fmtSize(r.contentLength)} &middot; ${fmtDate(r.createdAt)}
          </div>
          ${r.summary
            ? `<div style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.6;">${md(r.summary)}</div>`
            : `<div style="font-size:0.75rem;color:var(--ink-faint);font-style:italic;">Stored as raw context — no summary${Store.get('apiKey') ? '' : ' (add a Gemini API key in Settings to auto-summarise new references)'}.</div>`}
        </div>
        <div style="display:flex;gap:var(--sp-1);flex-shrink:0;">
          <button class="btn btn-ghost btn-sm ref-rename-btn" data-rid="${esc(r.id)}" title="Rename" style="padding:2px 4px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm ref-delete-btn" data-rid="${esc(r.id)}" title="Delete" style="padding:2px 4px;color:var(--danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>`).join('');

  return `
    <div class="card" style="margin-bottom:var(--sp-6);border-left:3px solid #8b5cf6;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-2);">
        <h3 style="font-family:var(--font-serif, Georgia, serif);font-size:1.125rem;font-weight:600;color:var(--ink);">My References</h3>
        <div style="display:flex;align-items:center;gap:var(--sp-2);">
          <span class="badge badge-gray">${refs.length} reference${refs.length === 1 ? '' : 's'}</span>
          <button class="btn btn-primary btn-sm" id="add-reference-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Reference
          </button>
        </div>
      </div>
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">Upload documents (PDF, Word, PowerPoint, Excel, Markdown, CSV, text) into a reusable library. Toggle any reference on in the Lesson Planner to pull it into Co-Cher's context — like a teaching skill.</p>
      ${refs.length === 0 ? `
        <p style="font-size:0.8125rem;color:var(--ink-faint);font-style:italic;">No references yet — add a document and it becomes a toggleable context source in the Lesson Planner.</p>
      ` : `
        <div style="display:flex;flex-direction:column;gap:var(--sp-3);">${list}</div>
      `}
    </div>`;
}

function wireReferencesSection(container) {
  container.querySelector('#add-reference-btn')?.addEventListener('click', () => showAddReferenceModal(container));

  container.querySelectorAll('.ref-rename-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ref = Store.getReferences().find(r => r.id === btn.dataset.rid);
      if (ref) showRenameReferenceModal(ref, container);
    });
  });

  container.querySelectorAll('.ref-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ref = Store.getReferences().find(r => r.id === btn.dataset.rid);
      if (!ref) return;
      const ok = await confirmDialog({ title: 'Delete Reference', message: `Delete "${ref.name}" from your References library? This cannot be undone.` });
      if (ok) {
        Store.deleteReference(ref.id);
        showToast('Reference deleted');
        render(container);
      }
    });
  });
}

function showRenameReferenceModal(ref, container) {
  const { backdrop, close } = openModal({
    title: 'Rename Reference',
    body: `
      <div class="input-group">
        <label class="input-label">Reference Name</label>
        <input class="input" id="ref-rename-input" value="${esc(ref.name)}" autofocus />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save</button>
    `
  });
  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const input = backdrop.querySelector('#ref-rename-input');
    const name = input.value.trim();
    if (!name) { input.style.borderColor = 'var(--danger)'; return; }
    Store.updateReference(ref.id, { name });
    showToast('Reference renamed', 'success');
    close();
    render(container);
  });
  setTimeout(() => backdrop.querySelector('#ref-rename-input')?.focus(), 100);
}

function showAddReferenceModal(container) {
  let staged = null;  // { text, source }

  const { backdrop, close } = openModal({
    title: 'Add Reference',
    width: 560,
    body: `
      <div class="input-group">
        <label class="input-label">Reference Name</label>
        <input class="input" id="ref-name" placeholder="e.g. Assessment Policy 2025" autofocus />
      </div>
      <div class="input-group">
        <label class="input-label">Upload (PDF, .txt, .md, .csv)</label>
        <div id="ref-upload-mount"></div>
      </div>
      <div style="display:flex;align-items:center;gap:var(--sp-2);margin:var(--sp-2) 0;color:var(--ink-faint);font-size:0.6875rem;">
        <div style="flex:1;height:1px;background:var(--border-light);"></div>
        or a Word / PowerPoint / Excel file
        <div style="flex:1;height:1px;background:var(--border-light);"></div>
      </div>
      <div class="input-group">
        <button type="button" class="btn btn-secondary btn-sm" id="ref-office-btn">Choose .docx / .pptx / .xlsx file</button>
        <input type="file" id="ref-office-input" accept=".docx,.pptx,.xlsx,.xls,.md,.markdown,.csv,.txt,.text" style="display:none;" />
      </div>
      <div id="ref-status" style="font-size:0.75rem;color:var(--ink-muted);min-height:1.2em;margin-bottom:var(--sp-2);"></div>
      <p style="font-size:0.6875rem;color:var(--ink-faint);line-height:1.5;">On save, Co-Cher writes a short summary of the document for use as teaching context${Store.get('apiKey') ? '' : ' (needs a Gemini API key — without one the reference is still stored, just without a summary)'}.</p>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save Reference</button>
    `
  });

  const nameInput = backdrop.querySelector('#ref-name');
  const statusEl = backdrop.querySelector('#ref-status');

  function stageReference(text, source) {
    staged = { text, source };
    if (!nameInput.value.trim() && source.filename) {
      nameInput.value = source.filename.replace(/\.[^.]+$/, '');
    }
    statusEl.innerHTML = `<span style="color:var(--success);font-weight:600;">Loaded ${esc(source.filename || 'document')}</span> — ${fmtSize(text.length)} ready to summarise.`;
  }

  // Reuse the shared upload zone for drag-drop + PDF page-range extraction.
  const uploadMount = backdrop.querySelector('#ref-upload-mount');
  if (uploadMount) {
    const zone = createFileUploadZone({
      compact: true,
      onContent: (text, meta) => {
        stageReference(text, {
          filename: meta.filename,
          isPdf: !!meta.isPdf,
          pageRange: meta.pageRange || null,
          type: meta.isPdf ? 'pdf' : (fileExt({ name: meta.filename || '' }) || 'text')
        });
      }
    });
    uploadMount.appendChild(zone.el);
  }

  // Office / Excel formats route through extractText (JSZip / SheetJS).
  const officeInput = backdrop.querySelector('#ref-office-input');
  backdrop.querySelector('#ref-office-btn')?.addEventListener('click', () => officeInput.click());
  officeInput?.addEventListener('change', async () => {
    const file = officeInput.files[0];
    if (!file) return;
    statusEl.textContent = `Extracting ${file.name}...`;
    try {
      const { text, meta } = await extractText(file);
      if (!text || !text.trim()) {
        showToast('No text could be extracted from that file.', 'danger');
        statusEl.textContent = '';
        return;
      }
      stageReference(text, { filename: file.name, isPdf: false, pageRange: null, type: meta.type });
    } catch (err) {
      showToast(err.message, 'danger');
      statusEl.textContent = '';
    } finally {
      officeInput.value = '';
    }
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.style.borderColor = 'var(--danger)'; return; }
    if (!staged || !staged.text.trim()) { showToast('Upload a document first.', 'danger'); return; }

    const saveBtn = backdrop.querySelector('[data-action="save"]');
    saveBtn.disabled = true;
    saveBtn.textContent = Store.get('apiKey') ? 'Summarising...' : 'Saving...';

    // One-time summarize-on-ingest. Degrade gracefully with no key / on error.
    let summary = '';
    if (Store.get('apiKey')) {
      try {
        summary = await sendChat(
          [{ role: 'user', content: `Summarise the following reference document in about 150 words so a teacher can reuse it as lesson-planning context. Capture the key facts, ideas, and anything usable in a lesson. No preamble.\n\n${staged.text.slice(0, 12000)}` }],
          { systemPrompt: 'You write concise, factual ~150-word summaries of teacher reference documents for later use as lesson-planning context. Plain prose, no preamble.', temperature: 0.4, maxTokens: 512, trackLabel: 'summarizeReference' }
        );
      } catch (err) {
        showToast(`Saved without summary: ${err.message}`, 'danger');
      }
    }

    Store.addReference({ name, source: staged.source, summary: (summary || '').trim(), content: staged.text });
    showToast(`Reference "${name}" added`, 'success');
    close();
    render(container);
  });

  setTimeout(() => nameInput?.focus(), 100);
}

/* ══════════ Main View ══════════ */

export function render(container) {
  const folders = Store.get('pdFolders') || [];
  const lessonReflections = getReflectionsFromLessons();

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header">
          <div>
            <h1 class="page-title">My Professional Growth</h1>
            <p class="page-subtitle">Your PD portfolio — courses, workshops, reflections, and learning resources. Select folders as context when planning lessons.</p>
          </div>
          <button class="btn btn-primary" id="new-folder-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Folder
          </button>
        </div>

        ${renderPracticeSection()}

        ${renderPracticeStorySection()}

        ${renderReferencesSection()}

        ${lessonReflections.length > 0 ? `
          <div class="card" style="margin-bottom:var(--sp-6);border-left:3px solid var(--accent);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
              <h3 style="font-size:0.9375rem;font-weight:600;color:var(--ink);">Lesson Reflections</h3>
              <span class="badge badge-blue">${lessonReflections.length} reflections</span>
            </div>
            <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Your post-lesson reflections are automatically collected here for reference.</p>
            <div style="display:flex;flex-direction:column;gap:var(--sp-2);max-height:200px;overflow-y:auto;">
              ${lessonReflections.slice(0, 5).map(lr => `
                <div class="card" style="padding:var(--sp-3) var(--sp-4);border:1px solid var(--border-light);cursor:pointer;" data-lesson-ref="${lr.id}">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:500;font-size:0.8125rem;color:var(--ink);">${esc(lr.title)}</span>
                    <span style="font-size:0.6875rem;color:var(--ink-faint);">${fmtDate(lr.updatedAt)}</span>
                  </div>
                  ${lr.snippet ? `<div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(lr.snippet)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${folders.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 class="empty-state-title">No PD folders yet</h3>
            <p class="empty-state-text">Create folders to organise your professional development materials — courses, workshops, reading notes, pedagogy explorations. These can be selected as context when planning lessons.</p>
            <button class="btn btn-primary" id="new-folder-empty">Create Your First Folder</button>
          </div>
        ` : `
          <div style="margin-bottom:var(--sp-3);display:flex;align-items:center;justify-content:space-between;">
            <input class="input" id="pd-search" placeholder="Search folders and materials..." style="max-width:320px;font-size:0.8125rem;" />
          </div>
          <div class="grid-3 stagger" id="folders-grid">
            ${folders.map(f => renderFolderCard(f)).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  // Handlers
  wirePracticeSection(container);
  wireReferencesSection(container);

  (container.querySelector('#new-folder-btn') || container.querySelector('#new-folder-empty'))
    ?.addEventListener('click', () => showNewFolderModal(container));

  container.querySelectorAll('[data-folder-id]').forEach(el => {
    el.addEventListener('click', () => navigate(`/my-growth/${el.dataset.folderId}`));
  });

  container.querySelectorAll('[data-lesson-ref]').forEach(el => {
    el.addEventListener('click', () => navigate(`/lessons/${el.dataset.lessonRef}`));
  });

  // Search
  container.querySelector('#pd-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    const grid = container.querySelector('#folders-grid');
    if (!grid) return;
    if (!q) {
      grid.innerHTML = folders.map(f => renderFolderCard(f)).join('');
    } else {
      const filtered = folders.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (f.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (f.materials || []).some(m => m.title.toLowerCase().includes(q))
      );
      grid.innerHTML = filtered.length > 0 ? filtered.map(f => renderFolderCard(f)).join('')
        : '<div style="grid-column:1/-1;text-align:center;padding:var(--sp-8);color:var(--ink-muted);font-size:0.875rem;">No folders match your search.</div>';
    }
    grid.querySelectorAll('[data-folder-id]').forEach(el => {
      el.addEventListener('click', () => navigate(`/my-growth/${el.dataset.folderId}`));
    });
  });
}

function renderFolderCard(f) {
  const icon = FOLDER_ICONS[f.category] || FOLDER_ICONS.other;
  const color = FOLDER_COLORS[f.category] || FOLDER_COLORS.other;
  const materialCount = (f.materials || []).length;
  return `
    <div class="card card-hover card-interactive" data-folder-id="${f.id}" style="border-top:3px solid ${color};">
      <div class="card-header" style="padding-bottom:var(--sp-2);">
        <div style="display:flex;align-items:center;gap:var(--sp-2);">
          <span style="color:${color};">${icon}</span>
          <div class="card-title" style="font-size:0.9375rem;">${esc(f.name)}</div>
        </div>
      </div>
      <div class="card-body">
        ${f.description ? `<p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-2);line-height:1.5;">${esc(f.description).slice(0, 80)}${f.description.length > 80 ? '...' : ''}</p>` : ''}
        <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-2);">
          <span class="badge badge-gray">${materialCount} item${materialCount !== 1 ? 's' : ''}</span>
          <span class="badge" style="background:${color}20;color:${color};">${CATEGORY_LABELS[f.category] || f.category}</span>
        </div>
        ${(f.tags || []).length > 0 ? `
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            ${f.tags.slice(0, 4).map(t => `<span style="font-size:0.625rem;background:var(--bg-subtle);padding:1px 6px;border-radius:var(--radius-full);color:var(--ink-muted);">#${esc(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>`;
}

function getReflectionsFromLessons() {
  return Store.getLessons()
    .filter(l => {
      const r = l.reflection;
      if (!r) return false;
      if (typeof r === 'string') return r.trim().length > 0;
      return !!(r.whatWorked || r.whatToAdjust || r.engagement || r.e21ccObservations || r.freeform);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(l => {
      const r = typeof l.reflection === 'object' ? l.reflection : { freeform: l.reflection };
      return {
        id: l.id,
        title: l.title,
        updatedAt: l.updatedAt,
        snippet: r.whatWorked || r.freeform || r.whatToAdjust || ''
      };
    });
}

function showNewFolderModal(pageContainer) {
  const { backdrop, close } = openModal({
    title: 'New PD Folder',
    body: `
      <div class="input-group">
        <label class="input-label">Folder Name</label>
        <input class="input" id="pd-name" placeholder="e.g. Team Based Learning" autofocus />
      </div>
      <div class="input-group">
        <label class="input-label">Category</label>
        <select class="input" id="pd-category">
          ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Description</label>
        <textarea class="input" id="pd-desc" rows="2" placeholder="Brief description of this PD area..."></textarea>
      </div>
      <div class="input-group">
        <label class="input-label">Tags (comma-separated)</label>
        <input class="input" id="pd-tags" placeholder="e.g. pedagogy, groupwork, active learning" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="create">Create Folder</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="create"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#pd-name').value.trim();
    if (!name) { backdrop.querySelector('#pd-name').style.borderColor = 'var(--danger)'; return; }
    const folder = {
      id: generateId(),
      name,
      category: backdrop.querySelector('#pd-category').value,
      description: backdrop.querySelector('#pd-desc').value.trim(),
      tags: backdrop.querySelector('#pd-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      materials: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const folders = [...(Store.get('pdFolders') || []), folder];
    Store.set('pdFolders', folders);
    showToast(`Folder "${name}" created!`, 'success');
    close();
    navigate('/my-growth');
  });

  setTimeout(() => backdrop.querySelector('#pd-name')?.focus(), 100);
}

/* ══════════ Folder Detail ══════════ */

export function renderDetail(container, { id }) {
  const folders = Store.get('pdFolders') || [];
  const folder = folders.find(f => f.id === id);
  if (!folder) {
    container.innerHTML = `<div class="main-scroll"><div class="page-container"><div class="empty-state"><h3 class="empty-state-title">Folder not found</h3><button class="btn btn-primary" id="back-btn">Back</button></div></div></div>`;
    container.querySelector('#back-btn')?.addEventListener('click', () => navigate('/my-growth'));
    return;
  }

  const materials = folder.materials || [];
  const color = FOLDER_COLORS[folder.category] || FOLDER_COLORS.other;
  const icon = FOLDER_ICONS[folder.category] || FOLDER_ICONS.other;

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <button class="btn btn-ghost btn-sm" id="back-btn" style="margin-bottom:var(--sp-4);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to My Growth
        </button>

        <div style="margin-bottom:var(--sp-6);">
          <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2);">
            <span style="color:${color};">${icon}</span>
            <h1 class="page-title">${esc(folder.name)}</h1>
          </div>
          ${folder.description ? `<p class="page-subtitle">${esc(folder.description)}</p>` : ''}
          <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-2);flex-wrap:wrap;">
            <span class="badge" style="background:${color}20;color:${color};">${CATEGORY_LABELS[folder.category] || folder.category}</span>
            ${(folder.tags || []).map(t => `<span class="badge badge-gray">#${esc(t)}</span>`).join('')}
            <span class="badge badge-gray">${materials.length} item${materials.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-6);flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="add-material-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Material
          </button>
          <button class="btn btn-secondary btn-sm" id="add-note-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Add Note
          </button>
          <button class="btn btn-ghost btn-sm" id="edit-folder-btn">Edit Folder</button>
          <button class="btn btn-ghost btn-sm" id="delete-folder-btn" style="color:var(--danger);">Delete Folder</button>
        </div>

        ${materials.length === 0 ? `
          <div class="empty-state" style="padding:var(--sp-8);">
            <div class="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3 class="empty-state-title">No materials yet</h3>
            <p class="empty-state-text">Upload slides, paste notes, or add reflections from your PD sessions.</p>
          </div>
        ` : `
          <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
            ${materials.map(m => `
              <div class="card" style="padding:var(--sp-4) var(--sp-5);">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;">
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-1);">
                      <span class="badge ${m.type === 'file' ? 'badge-blue' : m.type === 'note' ? 'badge-green' : 'badge-gray'}">${m.type === 'file' ? 'File' : m.type === 'note' ? 'Note' : 'Link'}</span>
                      <span style="font-size:0.6875rem;color:var(--ink-faint);">${fmtDate(m.createdAt)}</span>
                    </div>
                    <h4 style="font-weight:600;font-size:0.9375rem;color:var(--ink);margin-bottom:4px;">${esc(m.title)}</h4>
                    ${m.sourceRef ? `<div style="font-size:0.6875rem;color:var(--accent);margin-bottom:4px;">Source: ${esc(m.sourceRef.filename)}${m.sourceRef.isPdf && m.sourceRef.pageRange ? ` — pp ${m.sourceRef.pageRange.from}–${m.sourceRef.pageRange.to}` : ''}</div>` : ''}
                    <div style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.6;max-height:120px;overflow:hidden;white-space:pre-wrap;">${esc((m.content || '').slice(0, 400))}${(m.content || '').length > 400 ? '...' : ''}</div>
                  </div>
                  <div style="display:flex;gap:var(--sp-1);flex-shrink:0;margin-left:var(--sp-3);">
                    <button class="btn btn-ghost btn-sm expand-material-btn" data-mid="${m.id}" title="View full content">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-sm del-material-btn" data-mid="${m.id}" title="Delete" style="color:var(--danger);">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}

        <div class="card" style="margin-top:var(--sp-6);background:var(--bg-subtle);border:1px dashed var(--border);">
          <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
            <strong>Use in Lesson Planning:</strong> When designing a lesson in the Lesson Planner, click "Attach Context" and select this folder.
            Its materials will be included as context for Co-Cher's suggestions.
          </p>
        </div>
      </div>
    </div>
  `;

  // Handlers
  container.querySelector('#back-btn').addEventListener('click', () => navigate('/my-growth'));

  container.querySelector('#add-material-btn')?.addEventListener('click', () => {
    showAddMaterialModal(folder.id, 'file', () => renderDetail(container, { id }));
  });

  container.querySelector('#add-note-btn')?.addEventListener('click', () => {
    showAddMaterialModal(folder.id, 'note', () => renderDetail(container, { id }));
  });

  container.querySelector('#edit-folder-btn')?.addEventListener('click', () => {
    showEditFolderModal(folder, () => renderDetail(container, { id }));
  });

  container.querySelector('#delete-folder-btn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete Folder',
      message: `Delete "${folder.name}" and all its materials? This cannot be undone.`
    });
    if (ok) {
      Store.set('pdFolders', (Store.get('pdFolders') || []).filter(f => f.id !== id));
      showToast(`Deleted "${folder.name}"`);
      navigate('/my-growth');
    }
  });

  container.querySelectorAll('.expand-material-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = materials.find(x => x.id === btn.dataset.mid);
      if (!m) return;
      openModal({
        title: m.title,
        width: 640,
        body: `<div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);white-space:pre-wrap;max-height:60vh;overflow-y:auto;">${esc(m.content || 'No content')}</div>`,
        footer: `<button class="btn btn-primary" data-action="cancel">Close</button>`
      });
    });
  });

  container.querySelectorAll('.del-material-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = materials.find(x => x.id === btn.dataset.mid);
      if (!m) return;
      const ok = await confirmDialog({ title: 'Delete Material', message: `Delete "${m.title}"?` });
      if (ok) {
        const folders = Store.get('pdFolders') || [];
        const updated = folders.map(f => {
          if (f.id !== id) return f;
          return { ...f, materials: (f.materials || []).filter(x => x.id !== btn.dataset.mid), updatedAt: Date.now() };
        });
        Store.set('pdFolders', updated);
        showToast('Material deleted');
        renderDetail(container, { id });
      }
    });
  });
}

function showAddMaterialModal(folderId, defaultType, onDone) {
  const isNote = defaultType === 'note';
  let fileMeta = null;

  const { backdrop, close } = openModal({
    title: isNote ? 'Add Note' : 'Add Material',
    width: 560,
    body: `
      <div class="input-group">
        <label class="input-label">Title</label>
        <input class="input" id="mat-title" placeholder="${isNote ? 'e.g. My reflections on TBL' : 'e.g. TBL Workshop Slides'}" autofocus />
      </div>
      ${!isNote ? `
        <div class="input-group">
          <label class="input-label">Upload File (.txt, .md, .csv, .pdf)</label>
          <div id="mat-upload-mount"></div>
        </div>
        <div id="mat-source-ref" style="display:none;"></div>
      ` : ''}
      <div class="input-group">
        <label class="input-label">${isNote ? 'Your Notes / Reflections' : 'Content (paste or type)'}</label>
        <textarea class="input" id="mat-content" rows="8" placeholder="${isNote ? 'Write your thoughts, key takeaways, reflections...' : 'Paste slides content, notes, or key points...'}"></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save</button>
    `
  });

  // Mount the file upload zone for material (non-note) uploads
  const uploadMount = backdrop.querySelector('#mat-upload-mount');
  if (uploadMount) {
    const uploadZone = createFileUploadZone({
      compact: true,
      onContent: (text, meta) => {
        backdrop.querySelector('#mat-content').value = text;
        fileMeta = meta;

        if (!backdrop.querySelector('#mat-title').value.trim() && meta.filename) {
          backdrop.querySelector('#mat-title').value = meta.filename.replace(/\.[^.]+$/, '');
        }

        const sourceRefEl = backdrop.querySelector('#mat-source-ref');
        if (sourceRefEl && meta.isPdf && meta.pageRange) {
          sourceRefEl.style.display = 'block';
          sourceRefEl.innerHTML = `
            <div style="background:rgba(67,97,238,0.06);border:1px solid rgba(67,97,238,0.15);border-radius:var(--radius-md);padding:var(--sp-3) var(--sp-4);margin-bottom:var(--sp-3);">
              <div style="font-size:0.75rem;font-weight:600;color:var(--accent);margin-bottom:2px;">Source Reference</div>
              <div style="font-size:0.8125rem;color:var(--ink-secondary);">
                ${esc(meta.filename)} — pp ${meta.pageRange.from}–${meta.pageRange.to} (${meta.extractedPages} of ${meta.totalPages} pages)
              </div>
            </div>
          `;
        }
      }
    });
    uploadMount.appendChild(uploadZone.el);
  }

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const title = backdrop.querySelector('#mat-title').value.trim();
    const content = backdrop.querySelector('#mat-content').value.trim();
    if (!title) { backdrop.querySelector('#mat-title').style.borderColor = 'var(--danger)'; return; }
    if (!content) { showToast('Please add some content.', 'danger'); return; }

    const material = {
      id: generateId(),
      title,
      type: isNote ? 'note' : 'file',
      content,
      createdAt: Date.now()
    };

    // Attach source reference if from a file upload
    if (fileMeta) {
      material.sourceRef = {
        filename: fileMeta.filename,
        isPdf: fileMeta.isPdf,
        totalPages: fileMeta.totalPages,
        pageRange: fileMeta.pageRange,
        extractedPages: fileMeta.extractedPages
      };
    }

    const folders = (Store.get('pdFolders') || []).map(f => {
      if (f.id !== folderId) return f;
      return { ...f, materials: [...(f.materials || []), material], updatedAt: Date.now() };
    });
    Store.set('pdFolders', folders);
    showToast(`Added "${title}"`, 'success');
    close();
    onDone();
  });

  setTimeout(() => backdrop.querySelector('#mat-title')?.focus(), 100);
}

function showEditFolderModal(folder, onDone) {
  const { backdrop, close } = openModal({
    title: 'Edit Folder',
    body: `
      <div class="input-group">
        <label class="input-label">Folder Name</label>
        <input class="input" id="edit-pd-name" value="${esc(folder.name)}" />
      </div>
      <div class="input-group">
        <label class="input-label">Category</label>
        <select class="input" id="edit-pd-category">
          ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}" ${folder.category === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Description</label>
        <textarea class="input" id="edit-pd-desc" rows="2">${esc(folder.description || '')}</textarea>
      </div>
      <div class="input-group">
        <label class="input-label">Tags (comma-separated)</label>
        <input class="input" id="edit-pd-tags" value="${esc((folder.tags || []).join(', '))}" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#edit-pd-name').value.trim();
    if (!name) return;
    const folders = (Store.get('pdFolders') || []).map(f => {
      if (f.id !== folder.id) return f;
      return {
        ...f,
        name,
        category: backdrop.querySelector('#edit-pd-category').value,
        description: backdrop.querySelector('#edit-pd-desc').value.trim(),
        tags: backdrop.querySelector('#edit-pd-tags').value.split(',').map(t => t.trim()).filter(Boolean),
        updatedAt: Date.now()
      };
    });
    Store.set('pdFolders', folders);
    showToast('Folder updated', 'success');
    close();
    onDone();
  });
}
