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
import { isVoiceInputSupported, createDictation } from '../utils/voice.js';
import { markStart } from './start.js';

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
      `Follow the Singapore Teaching Practice: tag each part with the Lesson Enactment Teaching Area it serves, by its exact name, and name the check for learning as Checking for Understanding and Providing Feedback.`,
    ];
    if (cls() && lastReflection(cls().id)) lines.push(`${lastReflection(cls().id)}. Keep what worked and act on what to change.`);
    if (mode === 'ask') lines.push('Before you plan, ask me up to three short questions, one line each, that would most improve the lesson. Then wait for my answers.');
    const focus = sow && st.row >= 0 && rows[st.row]
      ? [`This lesson: ${rows[st.row]}`, st.row > 0 ? `Before it: ${rows[st.row - 1]}` : '', rows[st.row + 1] ? `After it: ${rows[st.row + 1]}` : ''].filter(Boolean).join('\n') : '';
    return { classId: st.classId, subject: subject(), level: level(), prompt: lines.join('\n'), sowId: st.sowId, sowFocus: focus, send: true };
  }

  function go(mode) {
    try { sessionStorage.setItem('cocher3_plan_brief', JSON.stringify(brief(mode))); } catch { /* private mode: the planner opens empty */ }
    markStart('lesson');
    location.hash = '#/lesson-planner';
  }

  function draw() {
    const c = cls(); const fit = fitting(); const sow = sows().find(u => u.id === st.sowId) || null; const rows = sow ? sowRows(sow) : [];
    container.innerHTML = `<div class="main-scroll"><div class="v3-page v3-plan">
      <div class="v3-head"><div><div class="v3-eyebrow">Lessons</div><h1 class="v3-title">New Lesson</h1>
        <p class="v3-lede">Lesson Preparation, in four quick choices. Co-Cher drafts the lesson along the Singapore Teaching Practice, and you change anything after.</p></div></div>

      <div class="v3-panel"><div class="v3-h">Who Is It For</div>
        <div class="v3-plan-row">
          <div><label class="input-label" for="pl-class">Class</label>
            <select class="input" id="pl-class"><option value="">No class: I will say</option>${classes.map(k => `<option value="${esc(k.id)}"${k.id === st.classId ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select></div>
          ${c && lastReflection(c.id) ? `<p class="v3-row-s v3-last" style="grid-column:1/-1;order:9;">${esc(lastReflection(c.id))}. Co-Cher will build on this.</p>` : ''}
          ${c ? `<p class="v3-row-s" style="align-self:end;padding-bottom:10px;">${esc([c.level, c.subject].filter(Boolean).join(', ') || 'No subject or level set on this class')}${(c.students || []).length ? `, ${c.students.length} students` : ''}</p>`
            : `<div><label class="input-label" for="pl-subject">Subject</label><input class="input" id="pl-subject" value="${esc(st.subject)}" placeholder="Subject" autocomplete="off"></div>
               <div><label class="input-label" for="pl-level">Level</label><input class="input" id="pl-level" value="${esc(st.level)}" placeholder="${esc(exampleLevel())}" autocomplete="off"></div>`}
          <div><label class="input-label" for="pl-min">Length</label>
            <select class="input" id="pl-min">${LENGTHS.map(m => `<option value="${m}"${m === st.minutes ? ' selected' : ''}>${m} minutes</option>`).join('')}</select></div>
        </div></div>

      <div class="v3-panel"><div class="v3-h">What Is It About</div>
        <label class="input-label" for="pl-topic">Topic</label>
        <div class="v3-keyrow"><input class="input" id="pl-topic" value="${esc(st.topic)}" placeholder="The topic, in a few words" autocomplete="off">
          ${isVoiceInputSupported() ? '<button class="btn btn-secondary v3-mic" id="pl-mic" aria-pressed="false" title="Say the topic instead of typing it">' + MIC + '<span>Speak</span></button>' : ''}</div>
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
        <a class="btn btn-ghost" href="#/autopilot" title="Auto-Lesson: scheme of work, lesson, assessment and reflection in one pass">Plan the whole unit in one pass</a>
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
    speakInto(q('#pl-mic'), q('#pl-topic'), (text) => { st.topic = text; });
  }
  draw();
}

/* ══════════ Voice ══════════
 * A teacher on a phone would sooner say it than type it. `speakInto` turns a
 * button into press to talk for one field. It only ever fills the field: the
 * teacher still reads it and sends it. Hidden where the device cannot listen. */
const MIC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.500 11a6.500 6.500 0 0 0 13 0M12 17.500V21"/></svg>';
function speakInto(button, field, onText) {
  if (!button || !field || !isVoiceInputSupported()) return;
  const word = button.querySelector('span');
  const idle = word ? word.textContent : '';
  let on = false;
  const set = (v, label) => { on = v; button.setAttribute('aria-pressed', String(v)); if (word) word.textContent = label || (v ? 'Listening…' : idle); };
  const d = createDictation({
    onPhase: (ph) => { if (word) word.textContent = ph === 'transcribing' ? 'Writing it down…' : 'Listening…'; },
    onResult: (text) => { const t = String(text || '').trim(); if (!t) return; field.value = (field.value ? field.value.replace(/\s+$/, '') + ' ' : '') + t; field.dispatchEvent(new Event('input', { bubbles: true })); if (onText) onText(field.value); },
    onError: () => set(false),
    onEnd: () => set(false),
  });
  button.addEventListener('click', () => { if (on) { d.stop(); set(false); } else if (d.start()) set(true); });
}

/* ══════════ The planner on a phone ══════════
 * On a narrow screen the planner shows one pane at a time. A lesson that
 * already exists opens on the LESSON, with a slim bar at the foot: speak or
 * type to change it. The writing pane itself is pared back: its optional
 * extras (lens, frameworks) fold behind "Options", so the box, the mic and
 * Send are what is on screen. */
const PHONE = () => window.matchMedia('(max-width: 760px)').matches;
function phonePlanner() {
  const layout = document.getElementById('lp-layout') || document.querySelector('.lp-layout');
  if (!layout || !PHONE()) return;
  const chat = layout.querySelector('.lp-chat-col'), plan = layout.querySelector('.lp-plan-col');
  if (!chat || !plan) return;
  if (!layout.dataset.v3Phone) {                          // once for each time the planner is drawn
    layout.dataset.v3Phone = '1';
    const hasLesson = !!layout.querySelector('#chat-messages .chat-msg, #chat-messages [class*="assistant"]') || /\S/.test(layout.querySelector('#plan-content')?.textContent || '');
    if (hasLesson) layout.classList.add('show-plan');
  }
  if (!plan.querySelector('#v3-askbar')) {
    const bar = document.createElement('div'); bar.id = 'v3-askbar'; bar.className = 'v3-askbar';
    bar.innerHTML = `${isVoiceInputSupported() ? `<button class="v3-mic" id="v3-ask-mic" title="Say what to change">${MIC}</button>` : ''}<button class="v3-ask" id="v3-ask-type">Tell Co-Cher what to change</button>`;
    plan.appendChild(bar);
    const toChat = () => { layout.classList.remove('show-plan'); const box = document.getElementById('chat-input'); if (box) box.focus(); };
    bar.querySelector('#v3-ask-type').addEventListener('click', toChat);
    bar.querySelector('#v3-ask-mic')?.addEventListener('click', () => { toChat(); document.getElementById('composer-mic-btn')?.click(); });
  }
  const tools = chat.querySelector('.chat-composer-toolbar');
  if (tools && !tools.querySelector('#v3-opts')) {
    const opt = document.createElement('button'); opt.id = 'v3-opts'; opt.type = 'button'; opt.className = 'btn btn-ghost btn-sm'; opt.textContent = 'Options'; opt.setAttribute('aria-expanded', 'false');
    opt.addEventListener('click', () => { const open = tools.classList.toggle('v3-open'); opt.setAttribute('aria-expanded', String(open)); });
    tools.appendChild(opt);
  }
}

/* ══════════ The two tap reflection ══════════
 * After a lesson: one tap for what worked, one for what to change. A few
 * words if the teacher wants. Saved in the shape the engine already uses for
 * reflections (`whatWorked`, `whatToAdjust`), so the class portrait carries it
 * and the next plan for that class reads it with nothing more to do.
 */
const WORKED = ['The hook', 'Group work', 'The pace', 'Student talk', 'The check for learning', 'The activity itself'];
const CHANGE = ['Slower pace', 'Faster pace', 'Clearer instructions', 'More challenge', 'More support', 'Less teacher talk'];

export function openQuickReflect(lessonId, done) {
  const lesson = Store.getLesson(lessonId); if (!lesson) return;
  const prev = lesson.reflection && typeof lesson.reflection === 'object' ? lesson.reflection : {};
  const pick = { worked: new Set(), change: new Set() };
  const chips = (key, list) => `<div class="v3-feels v3-ticks">${list.map(t => `<button class="v3-feel" data-${key}="${esc(t)}" aria-pressed="false"><b>${esc(t)}</b></button>`).join('')}</div>`;
  const { backdrop, close } = openModal({ title: 'How Did It Go', width: 560,
    body: `<p style="font-size:.875rem;color:var(--ink-secondary);margin:0 0 16px;line-height:1.5;">${esc(lesson.title || 'This lesson')}. Two taps are enough; your next plan for this class will read them.</p>
      <div class="input-label">What worked</div>${chips('worked', WORKED)}
      <div class="input-label" style="margin-top:16px;">What to change next time</div>${chips('change', CHANGE)}
      <label class="input-label" for="qr-note" style="margin-top:16px;display:block;">Anything else (optional)</label>
      <input class="input" id="qr-note" maxlength="200" autocomplete="off" placeholder="A few words">`,
    footer: '<button class="btn btn-secondary" data-act="cancel">Not now</button><button class="btn btn-primary" data-act="save" disabled>Save</button>' });
  const save = backdrop.querySelector('[data-act="save"]');
  backdrop.querySelectorAll('.v3-feel').forEach(b => b.addEventListener('click', () => {
    const key = b.dataset.worked != null ? 'worked' : 'change', val = b.dataset[key];
    pick[key].has(val) ? pick[key].delete(val) : pick[key].add(val);
    b.setAttribute('aria-pressed', pick[key].has(val));
    save.disabled = !(pick.worked.size || pick.change.size);
  }));
  backdrop.querySelector('#qr-note').addEventListener('input', (e) => { if (e.target.value.trim()) save.disabled = false; });
  backdrop.querySelector('[data-act="cancel"]').onclick = close;
  save.onclick = () => {
    const note = backdrop.querySelector('#qr-note').value.trim();
    const join = (old, set) => [String(old || '').trim(), [...set].join(', ')].filter(Boolean).join('. ');
    Store.updateLesson(lessonId, { status: 'completed', reflection: { engagement: 0, e21ccObservations: '', ...prev,
      whatWorked: join(prev.whatWorked, pick.worked), whatToAdjust: join(prev.whatToAdjust, pick.change),
      freeform: [String(prev.freeform || '').trim(), note].filter(Boolean).join(' ') } });
    close();
    if (done) done();
  };
}

/** The last reflection on a class, in one line, or ''. Shown where the next lesson begins. */
export function lastReflection(classId) {
  if (!classId) return '';
  const l = Store.getLessons().filter(x => x.classId === classId && x.reflection && typeof x.reflection === 'object' && (x.reflection.whatWorked || x.reflection.whatToAdjust))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  if (!l) return '';
  const r = l.reflection;
  return [`Last time (${l.title || 'your last lesson'})`, r.whatWorked ? `worked: ${r.whatWorked}` : '', r.whatToAdjust ? `to change: ${r.whatToAdjust}` : ''].filter(Boolean).join('; ');
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

/* The planner's header had eight buttons before a lesson existed. Save stays;
 * staging is offered by the "Next" button; the ones used now and then (Print,
 * Word, Snapshot, Share, Templates, and the two staging buttons for those who
 * want them directly) wait under one "More". Their own buttons stay in the
 * page, hidden, and the menu simply presses them. */
const HEADER_MORE = [['auto-stage-btn', 'Stage it for me'], ['stage-lesson-btn', 'Stage it myself'], ['export-pdf-btn', 'Print'], ['export-word-btn', 'Word'], ['snapshot-btn', 'Snapshot'], ['share-lesson-btn', 'Share'], ['templates-btn', 'Templates']];
function tidyHeader() {
  const save = document.getElementById('save-lesson-btn'); if (!save || document.getElementById('v3-header-more')) return;
  const found = HEADER_MORE.map(([id, label]) => [document.getElementById(id), label]).filter(([b]) => b);
  if (!found.length) return;
  found.forEach(([b]) => b.classList.add('v3-tucked'));   // the button only: a menu it opens (Templates) lives beside it and must still show
  const wrap = document.createElement('details'); wrap.id = 'v3-header-more'; wrap.className = 'v3-morewrap';
  wrap.innerHTML = `<summary class="btn btn-secondary btn-sm">More</summary><div class="v3-moremenu">${found.map(([b, label]) => `<button type="button" data-press="${esc(b.id)}">${esc(label)}</button>`).join('')}</div>`;
  wrap.addEventListener('click', (e) => { const x = e.target.closest('[data-press]'); if (x) { wrap.removeAttribute('open'); document.getElementById(x.dataset.press)?.click(); } });
  save.insertAdjacentElement('afterend', wrap);
}

/** Watch for the planner, and shelve its tools each time it draws them. */
export function watchPlannerTools() {
  const root = document.getElementById('main-view') || document.body;
  let busy = false;
  const run = () => { if (busy) return; busy = true; try { const bar = document.getElementById('ai-tools-bar'); if (bar) shelve(bar); tidyHeader(); phonePlanner(); } finally { busy = false; } };
  new MutationObserver(run).observe(root, { childList: true, subtree: true });
  run();
}
