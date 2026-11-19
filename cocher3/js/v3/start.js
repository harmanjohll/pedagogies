/*
 * Co-Cher 3: a new teacher's first minutes
 * ========================================
 * Almost everything Co-Cher does with AI needs the teacher's own Gemini key,
 * and a teacher who cannot get one stalls in the first minute. So:
 *
 * The key screen (openKeySetup). Shown once, before the app, to a teacher with
 * no key; reachable again from Start Here and from Settings. It says, in this
 * order: use your PERSONAL Google account (a school account usually cannot
 * make a key), the five steps, where to paste it, and "Check the key", which
 * asks Google whether it works before the teacher goes on. A short video
 * shows the steps. "Later" is always allowed: the app works without AI.
 *
 * Start Here (startHereHTML). A short list on My School until it is done or
 * hidden: your key, your classes, your first lesson. Each line leads to the
 * place where that is done. Kept on the device (`cocher3_start`).
 */
import { Store } from '../state.js';
import { checkApiKey } from '../api.js';
import { getPreferredName, setPreferredName, getCurrentUser, guessFirstName } from '../components/login.js';
import { demoById } from './demos.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'cocher3_start';
const state = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...state(), ...patch })); } catch { /* private mode */ } };
export const markStart = (what) => save({ [what]: true });

/** The key screen. `onDone` runs when the teacher saves a key or chooses Later. */
export function openKeySetup(onDone, { first = false } = {}) {
  const video = demoById('ai-key');
  const videoUrl = video?.src ? new URL(`../../demos/${video.src}`, import.meta.url).href : '';
  const name = getPreferredName() || guessFirstName(getCurrentUser()?.name || '');
  const el = document.createElement('div');
  el.className = 'v3-startwrap';
  el.innerHTML = `<div class="v3-start" role="dialog" aria-modal="true" aria-label="Set up your AI key">
    <div class="v3-eyebrow">${first ? 'Welcome to Co-Cher' : 'Your AI key'}</div>
    <h1 class="v3-title">${first ? `Good to have you${name ? ', ' + esc(name) : ''}` : 'Set Up Your AI Key'}</h1>
    <p class="v3-lede">Co-Cher plans with Google’s Gemini, using a key that is yours. It is free, takes two minutes, and stays on this device.</p>

    <div class="v3-callout"><b>Use your personal Google account.</b> Not your school account: school accounts usually cannot create a key. A personal Gmail works.</div>

    <ol class="v3-steps v3-keysteps">
      <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> (it opens in a new tab).</li>
      <li>Sign in with your <b>personal</b> Google account.</li>
      <li>Choose <b>Create API key</b>.</li>
      <li>Copy the key. It is a long line of letters and numbers.</li>
      <li>Paste it below, and check it.</li>
    </ol>
    ${videoUrl ? `<details class="v3-keyvideo"><summary>Watch how (under a minute)</summary><video src="${esc(videoUrl)}#t=0.1" controls muted playsinline preload="metadata"></video></details>` : ''}

    <label class="input-label" for="st-key">Your key</label>
    <div class="v3-keyrow">
      <input class="input" id="st-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your key here" value="${esc(Store.get('apiKey') || '')}">
      <button class="btn btn-secondary" id="st-check">Check the key</button>
    </div>
    <p class="v3-row-s" id="st-msg" role="status" aria-live="polite"></p>
    ${first ? `<label class="input-label" for="st-name" style="margin-top:16px;display:block;">What should Co-Cher call you</label>
      <input class="input" id="st-name" autocomplete="off" maxlength="40" value="${esc(name)}" placeholder="Your first name">` : ''}

    <div class="v3-plan-go" style="margin-top:24px;">
      <button class="btn btn-primary" id="st-save">Save and continue</button>
      <button class="btn btn-ghost" id="st-later">Later: look around first</button>
    </div>
    <p class="v3-row-s" style="margin-top:12px;">Never share your key, and never paste it anywhere but here. You can change or remove it in Settings.</p>
  </div>`;
  document.body.appendChild(el);
  const q = (x) => el.querySelector(x);
  const msg = (text, ok) => { const m = q('#st-msg'); m.textContent = text; m.dataset.ok = ok === true ? 'yes' : ok === false ? 'no' : ''; };
  let checked = false;
  const check = async () => {
    msg('Asking Google…'); q('#st-check').disabled = true;
    const r = await checkApiKey(q('#st-key').value);
    q('#st-check').disabled = false; checked = r.ok; msg(r.message, r.ok);
    return r.ok;
  };
  const finish = () => { const n = q('#st-name')?.value.trim(); if (n) setPreferredName(n); el.remove(); if (onDone) onDone(); };
  q('#st-key').addEventListener('input', () => { checked = false; msg(''); });
  q('#st-check').addEventListener('click', check);
  q('#st-save').addEventListener('click', async () => {
    const key = q('#st-key').value.trim();
    if (!key) { msg('Paste your key first, or choose Later.', false); return; }
    if (!checked && !(await check())) return;            // a key that Google refuses is not saved
    Store.set('apiKey', key); Store.set('apiKeyDeferred', false); markStart('key');
    finish();
  });
  q('#st-later').addEventListener('click', () => { if (!Store.get('apiKey')) Store.set('apiKeyDeferred', true); finish(); });
  setTimeout(() => q('#st-key').focus(), 80);
}

/** Start Here, for My School. '' once every step is done or the teacher has hidden it. */
export function startHereHTML() {
  const st = state();
  if (st.hidden) return '';
  const steps = [
    { id: 'key', done: !!Store.get('apiKey'), t: 'Add Your AI Key', s: 'Two minutes, with your personal Google account. Co-Cher’s planning needs it.', act: 'key', go: 'Set it up' },
    { id: 'classes', done: !!st.classes, t: 'Bring In Your Classes', s: 'From the school timetable in Student Finder, or add one by hand.', href: '#/classes', go: 'Open Classes' },
    { id: 'lesson', done: !!st.lesson, t: 'Plan Your First Lesson', s: 'Four quick choices in New Lesson.', href: '#/plan', go: 'New Lesson' },
  ];
  if (steps.every(x => x.done)) return '';
  const n = steps.filter(x => x.done).length;
  return `<div class="v3-starthere" id="v3-starthere">
    <div class="v3-h">Start Here <span class="v3-row-s">${n} of 3 done</span><button class="btn btn-ghost btn-sm" data-start="hide" title="You can find the videos under How Co-Cher Works">Hide</button></div>
    ${steps.map((x, i) => `<div class="v3-startrow${x.done ? ' done' : ''}">
      <span class="n" aria-hidden="true">${x.done ? '✓' : i + 1}</span>
      <span class="b"><b>${x.t}</b><span>${x.s}</span></span>
      ${x.done ? '<span class="v3-row-s">Done</span>' : x.act ? `<button class="btn btn-primary btn-sm" data-start="${x.act}">${x.go}</button>` : `<a class="btn btn-secondary btn-sm" href="${x.href}" data-start-go="${x.id}">${x.go}</a>`}
    </div>`).join('')}
  </div>`;
}
export function wireStartHere(container, redraw) {
  const box = container.querySelector('#v3-starthere'); if (!box) return;
  box.addEventListener('click', (e) => {
    const a = e.target.closest('[data-start]'), g = e.target.closest('[data-start-go]');
    if (g) markStart(g.dataset.startGo);
    if (!a) return;
    if (a.dataset.start === 'hide') { save({ hidden: true }); box.remove(); }
    if (a.dataset.start === 'key') openKeySetup(redraw);
  });
}
