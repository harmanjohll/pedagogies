/*
 * Co-Cher 3: starting a lesson, and the planner's tools
 * =====================================================
 * Two things, both for a teacher with little time.
 *
 * New Lesson (/plan). One screen, a few decisions, then a lesson:
 *   who it is for      a class (its subject and level come with it)
 *   what it is about   a topic, or a unit picked from the scheme of work
 *   how it should feel the teacher says: curiosity, a game, movement,
 *                      real stakes, student choice
 *   how to begin       "Draft it for me", or "Ask me first"
 * The answers become a short brief (sessionStorage `cocher3_plan_brief`) that
 * the planner reads once: it sets the class, fills the words, attaches the
 * chosen scheme of work with this lesson's place in it, and sends. Anything
 * the teacher left open stays as a [placeholder] to fill in, and then nothing
 * is sent for them.
 *
 * The planner's tools. It has over twenty; a teacher uses a handful. Six stay
 * in view (the owner's choice, below), and a "More tools" button, which says
 * how many more there are, opens the rest. From there a teacher runs any tool
 * or ticks it to keep it in view. Kept per device (`cocher3_lp_tools`).
 * Every tool's own button stays in the page, hidden, so nothing about how the
 * tools work has changed.
 */

import { Store } from '../state.js';
import { openModal } from '../components/modals.js';
import { exampleLevel } from '../utils/vocabulary.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ══════════ New Lesson ══════════ */

const FEELS = [
  { id: 'curiosity', label: 'Curiosity', hint: 'a puzzle or a surprise they want to solve' },
  { id: 'game', label: 'A Game', hint: 'points, a challenge, a little competition' },
  { id: 'movement', label: 'Movement', hint: 'out of their seats, stations, hands on' },
  { id: 'stakes', label: 'Real World Stakes', hint: 'a real problem, a real audience' },
  { id: 'choice', label: 'Student Choice', hint: 'they choose the task, the role or the product' },
];
const LENGTHS = [30, 35, 40, 60, 70, 90];

const sows = () => (Store.get('knowledgeUploads') || []).filter(u => u.category === 'Scheme of Work');
/** Lines of a scheme of work that read as steps in a sequence ("Week 3: ...", "Lesson 2 ...", "Unit 4 ..."). */
function sowRows(sow) {
  return String(sow?.content || '').split('\n').map(l => l.replace(/^[-•*\s]+/, '').trim())
    .filter(l => /^(week|wk|lesson|unit|topic|term\s*\d+\s*week)\s*\d+/i.test(l) && l.length < 240).slice(0, 40);
}
const rowTopic = (row) => (row.split('|')[0] || row).replace(/^(week|wk|lesson|unit|topic)\s*[\d\-–to ]+\s*[:.\-–]?\s*/i, '').trim() || row;

export function renderNewLesson(container) {
  const classes = Store.getClasses();
  const st = { classId: classes.length === 1 ? classes[0].id : '', subject: '', level: '', topic: '', minutes: 60, feels: new Set(), sowId: '', row: -1 };

  const cls = () => classes.find(c => c.id === st.classId) || null;
  const subject = () => cls()?.subject || st.subject.trim();
  const level = () => cls()?.level || st.level.trim();
  const fitting = () => { const k = subject().toLowerCase(); const all = sows();
    const fit = all.filter(u => !k || `${u.subject || ''} ${u.title || ''}`.toLowerCase().includes(k)); return fit.length ? fit : (k ? [] : all); };

  function brief(mode) {
    const sow = sows().find(u => u.id === st.sowId) || null;
    const rows = sow ? sowRows(sow) : [];
    const feels = FEELS.filter(f => st.feels.has(f.id));
    const who = cls() ? ` for ${cls().name}` : '';
    const feel = feels.length ? feels.map(f => `${f.label.toLowerCase()} (${f.hint})`).join('; ') : '[how it should feel: curiosity / a game / movement / real world stakes / student choice]';
    const lines = [
      `Plan a ${st.minutes} minute ${level() || `[level e.g. ${exampleLevel()}]`} ${subject() || '[subject]'} lesson on ${st.topic.trim() || '[topic]'}${who}.`,
      `Make it a lesson students enjoy and remember. It should feel like: ${feel}. Open with a hook of that kind.`,
      `Keep the plan to one screen: the hook in one or two lines, three or four parts with times, and one check for learning at the end. No long prose.`,
    ];
    if (mode === 'ask') lines.push('Before you plan, ask me up to three short questions, one line each, that would most improve the lesson. Then wait for my answers.');
    const focus = sow && st.row >= 0 && rows[st.row]
      ? [`This lesson: ${rows[st.row]}`, st.row > 0 ? `Before it: ${rows[st.row - 1]}` : '', rows[st.row + 1] ? `After it: ${rows[st.row + 1]}` : ''].filter(Boolean).join('\n') : '';
    return { classId: st.classId, subject: subject(), level: level(), prompt: lines.join('\n'), sowId: st.sowId, sowFocus: focus, send: true };
  }

  function go(mode) {
    try { sessionStorage.setItem('cocher3_plan_brief', JSON.stringify(brief(mode))); } catch { /* private mode: the planner opens empty */ }
    location.hash = '#/lesson-planner';
  }

  function draw() {
    const c = cls(); const fit = fitting(); const sow = sows().find(u => u.id === st.sowId) || null; const rows = sow ? sowRows(sow) : [];
    container.innerHTML = `<div class="main-scroll"><div class="v3-page v3-plan">
      <div class="v3-head"><div><div class="v3-eyebrow">Lessons</div><h1 class="v3-title">New Lesson</h1>
        <p class="v3-lede">Four quick choices. Co-Cher does the rest, and you change anything after.</p></div></div>

      <div class="v3-panel"><div class="v3-h">Who Is It For</div>
        <div class="v3-plan-row">
          <div><label class="input-label" for="pl-class">Class</label>
            <select class="input" id="pl-class"><option value="">No class: I will say</option>${classes.map(k => `<option value="${esc(k.id)}"${k.id === st.classId ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select></div>
          ${c ? `<p class="v3-row-s" style="align-self:end;padding-bottom:10px;">${esc([c.level, c.subject].filter(Boolean).join(', ') || 'No subject or level set on this class')}${(c.students || []).length ? `, ${c.students.length} students` : ''}</p>`
            : `<div><label class="input-label" for="pl-subject">Subject</label><input class="input" id="pl-subject" value="${esc(st.subject)}" placeholder="Subject" autocomplete="off"></div>
               <div><label class="input-label" for="pl-level">Level</label><input class="input" id="pl-level" value="${esc(st.level)}" placeholder="${esc(exampleLevel())}" autocomplete="off"></div>`}
          <div><label class="input-label" for="pl-min">Length</label>
            <select class="input" id="pl-min">${LENGTHS.map(m => `<option value="${m}"${m === st.minutes ? ' selected' : ''}>${m} minutes</option>`).join('')}</select></div>
        </div></div>

      <div class="v3-panel"><div class="v3-h">What Is It About</div>
        <label class="input-label" for="pl-topic">Topic</label>
        <input class="input" id="pl-topic" value="${esc(st.topic)}" placeholder="The topic, in a few words" autocomplete="off">
        ${fit.length ? `<div style="margin-top:16px;"><label class="input-label" for="pl-sow">From your scheme of work</label>
            <select class="input" id="pl-sow"><option value="">Choose one, and the lesson will follow it</option>${fit.map(u => `<option value="${esc(u.id)}"${u.id === st.sowId ? ' selected' : ''}>${esc(u.title)}</option>`).join('')}</select>
            ${sow ? (rows.length ? `<p class="v3-row-s" style="margin:12px 0 8px;">Where is this lesson in it? Pick one and the topic fills in.</p>
              <div class="v3-rows">${rows.map((r, i) => `<button class="v3-rowpick" data-row="${i}" aria-pressed="${i === st.row}">${esc(r.length > 110 ? r.slice(0, 108) + '…' : r)}</button>`).join('')}</div>`
              : '<p class="v3-row-s" style="margin-top:12px;">Co-Cher will read this scheme of work and keep the lesson inside it. It has no week by week lines to pick from, so name the topic above.</p>') : ''}
          </div>`
          : `<p class="v3-row-s" style="margin-top:12px;">No scheme of work${subject() ? ` for ${esc(subject())}` : ''} yet, so Co-Cher will check the lesson against the syllabus and the web. <a href="#/knowledge">Add a scheme of work</a></p>`}
      </div>

      <div class="v3-panel"><div class="v3-h">How Should It Feel <span class="v3-row-s">pick any</span></div>
        <div class="v3-feels">${FEELS.map(f => `<button class="v3-feel" data-feel="${f.id}" aria-pressed="${st.feels.has(f.id)}"><b>${f.label}</b><span>${f.hint}</span></button>`).join('')}</div></div>

      <div class="v3-plan-go">
        <button class="btn btn-primary" data-go="draft">Draft it for me</button>
        <button class="btn btn-secondary" data-go="ask">Ask me a few questions first</button>
        <a class="btn btn-ghost" href="#/lesson-planner">Skip: open the planner</a>
      </div>
      ${Store.get('apiKey') ? '' : '<p class="v3-row-s" style="margin-top:12px;">No AI key on this device yet, so the words will be placed in the planner for you, unsent. Add a key in Settings.</p>'}
    </div></div>`;

    const q = (x) => container.querySelector(x);
    q('#pl-class').onchange = (e) => { st.classId = e.target.value; st.sowId = ''; st.row = -1; draw(); };
    q('#pl-subject')?.addEventListener('change', (e) => { st.subject = e.target.value; st.sowId = ''; st.row = -1; draw(); });
    q('#pl-level')?.addEventListener('input', (e) => { st.level = e.target.value; });
    q('#pl-min').onchange = (e) => { st.minutes = +e.target.value; };
    q('#pl-topic').oninput = (e) => { st.topic = e.target.value; };
    q('#pl-sow')?.addEventListener('change', (e) => { st.sowId = e.target.value; st.row = -1; draw(); });
    container.querySelectorAll('[data-row]').forEach(b => b.onclick = () => { st.row = +b.dataset.row; st.topic = rowTopic(rows[st.row]); draw(); });
    container.querySelectorAll('[data-feel]').forEach(b => b.onclick = () => { st.feels.has(b.dataset.feel) ? st.feels.delete(b.dataset.feel) : st.feels.add(b.dataset.feel); b.setAttribute('aria-pressed', st.feels.has(b.dataset.feel)); });
    container.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  }
  draw();
}

/* ══════════ The planner's tools: six in view, the rest one tap away ══════════ */

const TOOLS_KEY = 'cocher3_lp_tools';
/* The owner's six: YouTube, Slide Deck, Grouping, Spatial Layout, Exit Ticket, Differentiate. */
const DEFAULT_TOOLS = ['ai-youtube-btn', 'ai-deck-btn', 'ai-group-btn', 'spatial-layout-btn', 'ai-exit-ticket-btn', 'ai-differentiation-btn'];
const keptTools = () => { try { const v = JSON.parse(localStorage.getItem(TOOLS_KEY) || 'null'); return Array.isArray(v) ? v : DEFAULT_TOOLS.slice(); } catch { return DEFAULT_TOOLS.slice(); } };
const keepTools = (ids) => { try { localStorage.setItem(TOOLS_KEY, JSON.stringify(ids)); } catch { /* private mode */ } };

function shelve(bar) {
  const box = bar.querySelector('#ai-tools-icons'); if (!box) return;
  const tools = [...box.querySelectorAll('button[id]')].filter(b => b.id !== 'v3-more-tools');
  if (!tools.length) return;
  const kept = new Set(keptTools());
  tools.forEach(b => b.classList.toggle('v3-tool-off', !kept.has(b.id)));
  box.classList.add('v3-shelved');
  const hidden = tools.filter(b => !kept.has(b.id)).length;
  let more = box.querySelector('#v3-more-tools');
  if (!more) {
    more = document.createElement('button'); more.id = 'v3-more-tools'; more.type = 'button'; more.className = 'btn btn-secondary btn-sm v3-more-tools';
    more.addEventListener('click', () => openTools(bar));
  }
  if (box.lastElementChild !== more) box.appendChild(more);   // always last; moved only when it is not (moving it is itself a change the watcher sees)
  const text = hidden ? `More tools (${hidden})` : 'Choose tools';
  if (more.textContent !== text) more.textContent = text;
  more.title = 'See every tool, run one, or choose which stay in view';
}

function openTools(bar) {
  const box = bar.querySelector('#ai-tools-icons');
  const tools = [...box.querySelectorAll('button[id]')].filter(b => b.id !== 'v3-more-tools');
  const kept = new Set(keptTools());
  const { backdrop, close } = openModal({ title: 'All Tools', width: 520,
    body: `<p style="font-size:.875rem;color:var(--ink-secondary);margin:0 0 12px;line-height:1.5;">Tap a tool to use it now. Tick the ones you want kept in view.</p>
      <div class="v3-toollist">${tools.map(b => `<div class="v3-toolrow"><button class="run" data-run="${esc(b.id)}">${esc(b.getAttribute('aria-label') || b.title || b.textContent.trim())}</button>
        <label title="Keep in view"><input type="checkbox" data-keep="${esc(b.id)}"${kept.has(b.id) ? ' checked' : ''}> In view</label></div>`).join('')}</div>`,
    footer: '<button class="btn btn-ghost" data-act="reset" style="margin-right:auto;">Back to the first six</button><button class="btn btn-primary" data-act="done">Done</button>' });
  const save = () => { keepTools([...backdrop.querySelectorAll('[data-keep]:checked')].map(i => i.dataset.keep)); shelve(bar); };
  backdrop.querySelectorAll('[data-keep]').forEach(i => i.addEventListener('change', save));
  backdrop.querySelectorAll('[data-run]').forEach(r => r.addEventListener('click', () => { close(); document.getElementById(r.dataset.run)?.click(); }));
  backdrop.querySelector('[data-act="done"]').onclick = close;
  backdrop.querySelector('[data-act="reset"]').onclick = () => { keepTools(DEFAULT_TOOLS.slice()); close(); shelve(bar); };
}

/** Watch for the planner, and shelve its tools each time it draws them. */
export function watchPlannerTools() {
  const root = document.getElementById('main-view') || document.body;
  let busy = false;
  const run = () => { if (busy) return; busy = true; try { const bar = document.getElementById('ai-tools-bar'); if (bar) shelve(bar); } finally { busy = false; } };
  new MutationObserver(run).observe(root, { childList: true, subtree: true });
  run();
}
