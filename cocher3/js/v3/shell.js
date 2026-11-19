/*
 * Co-Cher 3: the shell
 * ====================
 * The menu, the strip of sibling screens, the look panel and Co-Cher 3's own
 * screens. The engine beside it (../app.js and everything under ../) does the
 * rest: sign in, school, data, every other view.
 *
 * It registers itself as window.__cocherShell before app.js runs (boot.js).
 * Saved work is shared with Co-Cher 2 on purpose (see ../version.js).
 * The first time Co-Cher 3 opens, a copy of the teacher's saved work is set
 * aside on the device (IndexedDB), in case a bug ever damages it.
 */

import { getPrefs, setPref, applyPrefs, CHOICES } from './prefs.js';
import { VERSION, NOTES } from './version.js';
import { PLACES, ICONS, placeFor, screensIn, getLinks, setLinks, ALL_SCREENS } from './places.js';
import { renderHome, renderNow, renderSchool, renderWeek, renderTerm, renderHub, renderPaths } from './screens.js';
import { renderFreeTime, renderHandover, renderSend } from './together.js';
import { renderNewLesson, watchPlannerTools } from './planner.js';
import { openKeySetup } from './start.js';
import { openModal } from '../components/modals.js';
import { renderDemos, demoById } from './demos.js';
import { openSearch } from '../components/unified-search.js';
import { currentSchoolId, getCurrentUser } from '../components/login.js';
import { Store, storageKeyFor } from '../state.js';
import { idbGet, idbPut } from '../utils/storage.js';

/* On a phone the menu holds these five; the rest sit behind More. */
const PRIME = new Set(['school', 'now', 'week', 'classes', 'lessons']);
const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* '/' is the landing page: My School, unless the teacher chose to start elsewhere. */
const route = () => {
  const r = (location.hash.replace(/^#/, '') || '/').split('?')[0];
  if (r !== '/') return r;
  const home = getPrefs().home;
  return home === 'school' ? '/school' : '/now';
};

/* Co-Cher 3 is open to every signed in teacher. What a teacher sees still
 * follows their school (packs, timetable, school only tools), as in Co-Cher 2. */

/* Shown in Look and Feel and at the foot of My School, so anyone can tell
 * which version their browser is running. Set in js/version.js. */
export const BUILD = VERSION;

/* Links written as "#/classes": tapping the one you are on redraws it, and a
 * new tab opens on this same page. (Kept from when the page had a base address.) */
const here = (hash) => location.pathname + location.search + hash;
document.addEventListener('click', (e) => {
  if (e.defaultPrevented) return;
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  const h = a.getAttribute('href');
  // A new tab or window (Ctrl, Cmd, Shift, or target) must open Co-Cher 3 too.
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') {
    e.preventDefault(); window.open(here(h), '_blank', 'noopener'); return;
  }
  e.preventDefault();
  if (h.length > 1) { if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; }
});
document.addEventListener('auxclick', (e) => {
  const a = e.button === 1 && e.target.closest && e.target.closest('a[href^="#"]');
  if (a) { e.preventDefault(); window.open(here(a.getAttribute('href')), '_blank', 'noopener'); }
});
/* The same for code that rewrites the address bar: the lesson planner does it
 * on its first save, and without this the address became a Co-Cher 2 one. */
for (const k of ['pushState', 'replaceState']) {
  const f = history[k].bind(history);
  history[k] = (state, title, url) => f(state, title, typeof url === 'string' && url.startsWith('#') ? here(url) : url);
}

/* What changed, once, to a returning teacher. Co-Cher 3's own notes only. */
function whatsNew() {
  const KEY = 'cocher3_seen_version';
  let seen = ''; try { seen = localStorage.getItem(KEY) || ''; } catch { /* private mode */ }
  try { localStorage.setItem(KEY, VERSION); } catch { /* private mode */ }
  if (!seen || seen === VERSION) return;
  const cmp = (a, b) => { const A = a.split('.').map(Number), B = b.split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; } return 0; };
  const fresh = NOTES.filter(n => cmp(n.version, seen) > 0);
  if (!fresh.length) return;
  openModal({ title: `New in Co-Cher ${VERSION}`, width: 480,
    body: fresh.map(n => n.items.map(([t, d]) => `<p style="margin:0 0 12px;font-size:.875rem;line-height:1.55;"><b>${esc(t)}</b><br><span style="color:var(--ink-secondary);">${esc(d)}</span></p>`).join('')).join('') });
}

let schoolPack = null;
let lastPlace = null;       // the place the teacher is working in; a linked screen keeps it

/* The place to show for a route: stay in the current place when the screen
 * was linked into it by the teacher, otherwise the screen's own home. */
function currentPlace() {
  const r = route();
  const home = placeFor(r);
  if (lastPlace && lastPlace.id !== home?.id && screensIn(lastPlace).some(s => s.linked && (r === s.route || r.startsWith(s.route + '/')))) return lastPlace;
  lastPlace = home;
  return home;
}

function navHTML() {
  const here = currentPlace();
  let group = '';
  const items = PLACES.map(p => {
    const head = p.group !== group ? `${group ? '<span class="v3-sep"></span>' : ''}<div class="v3-group">${p.group}</div>` : '';
    group = p.group;
    return `${head}<a class="v3-link${PRIME.has(p.id) ? '' : ' v3-rest'}${here && here.id === p.id ? ' on' : ''}" href="#${p.route}" data-place="${p.id}">${ICONS[p.id]}<span>${p.label}</span></a>`;
  }).join('') + `<button class="v3-link v3-more${here && !PRIME.has(here.id) ? ' on' : ''}" data-act="more" aria-haspopup="dialog">${ICONS.more}<span>${here && !PRIME.has(here.id) ? esc(here.label) : 'More'}</span></button>`;
  const user = getCurrentUser();
  return `
    <a class="v3-brand" href="#/" title="My School">${ICONS.mark}<b>Co-Cher</b><span>${BUILD}</span></a>
    ${items}
    <div class="v3-spacer"></div>
    <span class="v3-sep"></span>
    <button class="v3-link v3-util" data-act="search">${ICONS.search}<span>Search</span><kbd>Ctrl K</kbd></button>
    <div class="v3-school"><i></i><b>${esc(schoolPack?.name || user?.schoolName || 'Your school')}</b>${esc(user?.preferredName || user?.name || user?.email || '')}</div>`;
}

/* Phone: everything that is not in the five, one tap away. */
function openMore() {
  const here = currentPlace();
  const { backdrop, close } = openModal({ title: 'More', width: 420,
    body: `<div class="v3-more-list">
      ${PLACES.filter(p => !PRIME.has(p.id)).map(p => `<a href="#${p.route}" class="${here && here.id === p.id ? 'on' : ''}">${ICONS[p.id]}<b>${esc(p.label)}</b></a>`).join('')}
      <button data-more="search">${ICONS.search}<b>Search</b></button>
      <button data-more="look">${ICONS.look}<b>Look and Feel</b></button>
      <a href="#/settings">${ICONS.settings}<b>Settings</b></a>
    </div>` });
  backdrop.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setTimeout(close, 0)));
  backdrop.querySelector('[data-more="search"]').onclick = () => { close(); openSearch(); };
  backdrop.querySelector('[data-more="look"]').onclick = () => { close(); openLook(); };
}

function stripHTML() {
  const r = route();
  const place = currentPlace();
  // Top left, where people look for it: the mark, which always leads home to My School.
  // (With the menu at the side or along the top, the mark sits in the menu instead.)
  const mark = `<a class="v3-mark" href="#/" title="My School" aria-label="Co-Cher: go to My School">${ICONS.mark}</a>`;
  if (!place) return mark;
  const screens = screensIn(place);
  const current = screens.filter(s => r === s.route || (s.route !== '/' && r.startsWith(s.route))).sort((a, b) => b.route.length - a.route.length)[0];
  const demo = current?.demo ? demoById(current.demo) : null;
  const tab = (s) => `<a href="#${s.route}" class="${current && current.route === s.route ? 'on' : ''}"${current && current.route === s.route ? ' aria-current="page"' : ''}${s.linked ? ` title="Linked here by you; its home is ${esc(s.home.label)}"` : ''}>${esc(s.label)}${s.linked ? ICONS.link : ''}</a>`;
  // Screens marked `more` wait under "More", so the row stays short. The one that is open always shows.
  const isOpen = (s) => current && current.route === s.route;
  const shown = screens.filter(s => !s.more || isOpen(s)), tucked = screens.filter(s => s.more && !isOpen(s));
  const tabs = screens.length > 1 ? `<span class="where">${place.label}</span>` + shown.map(tab).join('')
    + (tucked.length ? `<details class="v3-morewrap"><summary>More (${tucked.length})</summary><div class="v3-moremenu">${tucked.map(s => `<a href="#${s.route}">${esc(s.label)}</a>`).join('')}</div></details>` : '') : '';
  const tools = current ? `<span class="tools">
      ${demo ? `<a class="tool" href="#/demos/${demo.id}" title="A short demo of this screen">${ICONS.play}Demo</a>` : ''}
      <button class="tool" data-act="link" data-route="${esc(current.route)}" title="Also show this screen under another place">${ICONS.link}Link</button>
    </span>` : '';
  return mark + tabs + tools;
}

/* "Also show this screen under...": the teacher's own tagging. */
function openLink(routeToLink) {
  const screen = ALL_SCREENS().find(s => s.route === routeToLink);
  if (!screen) return;
  const mine = getLinks()[routeToLink] || [];
  const { backdrop, close } = openModal({
    title: `Link \u201c${esc(screen.label)}\u201d`,
    width: 440,
    body: `<p style="font-size:.875rem;color:var(--ink-secondary);line-height:1.55;margin:0 0 14px;">Its home is ${esc(screen.home.label)}. Tick the other places where you want it within reach. Only you decide; link it where it is useful.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${PLACES.filter(p => p.id !== screen.home.id).map(p => `<label style="display:flex;gap:8px;align-items:center;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;font-size:.875rem;">
          <input type="checkbox" value="${p.id}"${mine.includes(p.id) ? ' checked' : ''} style="accent-color:var(--accent);"> ${esc(p.label)}</label>`).join('')}
      </div>`,
    footer: `<button class="btn btn-secondary" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Save</button>`,
  });
  backdrop.querySelector('[data-act="cancel"]').onclick = close;
  backdrop.querySelector('[data-act="save"]').onclick = () => {
    setLinks(routeToLink, [...backdrop.querySelectorAll('input:checked')].map(i => i.value));
    close(); paint();
  };
}

function paint() {
  // My School is the menu, laid out large: the dock, rail or bar stays away there.
  // On the way in, note where each menu item sits, so the tiles can fly up from it.
  const root = document.documentElement, toHome = route() === '/school';
  if (toHome && !root.hasAttribute('data-home')) {
    const rects = {};
    const more = document.querySelector('.v3-nav .v3-more');
    document.querySelectorAll('.v3-nav [data-place]').forEach(l => { let r = l.getBoundingClientRect(); if (!r.width && more) r = more.getBoundingClientRect(); if (r.width) rects[l.dataset.place] = { left: r.left, top: r.top, width: r.width, height: r.height }; });
    window.__v3DockRects = Object.keys(rects).length ? rects : null;
  }
  root.toggleAttribute('data-home', toHome);
  const nav = document.querySelector('.v3-nav');
  const strip = document.querySelector('.v3-strip');
  if (nav) nav.innerHTML = navHTML();
  if (strip) strip.innerHTML = stripHTML();
}

/* ── Look and Feel ── */
function openLook() {
  if (document.querySelector('.v3-look')) return;
  const back = document.createElement('div'); back.className = 'v3-look-back';
  const panel = document.createElement('aside'); panel.className = 'v3-look'; panel.setAttribute('aria-label', 'Look and Feel');
  const close = () => { back.remove(); panel.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const group = (key, title, cls = '') => {
    const p = getPrefs();
    return `<h3>${title}</h3><div class="v3-opts ${cls}">${CHOICES[key].map(c => `
      <button class="v3-opt" data-key="${key}" data-val="${c.id}" aria-pressed="${p[key] === c.id}">
        ${c.sw ? `<span class="v3-sw">${c.sw.map(x => `<i style="background:${x}"></i>`).join('')}<i style="background:var(--school)"></i></span>` : ''}
        ${esc(c.label)}${c.note ? `<small>${esc(c.note)}</small>` : ''}
      </button>`).join('')}</div>`;
  };
  const draw = () => {
    panel.innerHTML = `
      <button class="close" aria-label="Close">&times;</button>
      <h2>Look and Feel</h2>
      <p>Make Co-Cher yours. Changes apply at once and stay on this device. Your school’s colours come with every look, softened to suit it.</p>
      ${group('look', 'Look')}
      ${group('night', 'Day or Night')}
      ${group('type', 'Type', 'three')}
      ${group('text', 'Text Size', 'three')}
      ${group('nav', 'Menu', 'three')}
      ${group('home', 'How You Start')}
      ${group('density', 'Spacing')}
      ${group('motion', 'Motion')}
      ${window.matchMedia('(prefers-reduced-motion: reduce)').matches ? '<p style="margin-top:8px;">This device asks apps to reduce motion. Co-Cher\u2019s tile move is short, and plays unless you turn Motion off here.</p>' : ''}
      <p style="margin-top:24px;font-size:.8125rem;">Co-Cher ${BUILD}</p>`;
    panel.querySelector('.close').onclick = close;
    panel.querySelectorAll('.v3-opt').forEach(b => b.onclick = () => {
      setPref(b.dataset.key, b.dataset.val);
      if (b.dataset.key === 'night') Store.set('darkMode', b.dataset.val === 'on');
      paint(); draw();
      if (b.dataset.key === 'home') { if (location.hash.replace(/^#/, '') !== '/' && location.hash !== '') location.hash = '#/'; else window.dispatchEvent(new HashChangeEvent('hashchange')); }
    });
  };
  back.onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.append(back, panel);
  draw();
}

/* One copy of the teacher's saved work, set aside the first time v3 opens. */
async function backupOnce() {
  try {
    const id = currentSchoolId();
    const key = `v3backup__${id || 'none'}`;
    if (await idbGet('media', key)) return;
    const raw = localStorage.getItem(storageKeyFor(id));
    if (raw) await idbPut('media', key, JSON.stringify({ at: Date.now(), data: raw }));
  } catch { /* a backup that cannot be made must not stop the app */ }
}

window.__cocherShell = {
  mount(app) {
    // Day or night is one choice across Co-Cher 2 and 3; the store holds it.
    setPref('night', Store.get('darkMode') ? 'on' : 'off');
    applyPrefs();
    app.innerHTML = `
      <nav class="v3-nav" aria-label="Co-Cher"></nav>
      <div class="v3-body">
        <div class="v3-strip" aria-label="In this place"></div>
        <main class="main-content"><div id="main-view" style="height:100%;display:flex;flex-direction:column;"></div></main>
      </div>`;
    paint();
    window.addEventListener('hashchange', paint);
    window.matchMedia('(max-width: 760px)').addEventListener('change', () => applyPrefs());
    app.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'search') openSearch();
      if (b.dataset.act === 'look') openLook();
      if (b.dataset.act === 'more') openMore();
      if (b.dataset.act === 'link') openLink(b.dataset.route);
    });
    document.addEventListener('click', (e) => {
      document.querySelectorAll('details.v3-morewrap[open]').forEach(d => { if (!d.contains(e.target) || e.target.closest('.v3-moremenu')) d.removeAttribute('open'); });
    });
    backupOnce();
    watchPlannerTools();
  },

  /* The school's colours arrive: hand them to the look, which softens them. */
  themed(pack) {
    schoolPack = pack || null;
    const root = document.documentElement.style;
    ['--accent', '--accent-dark', '--accent-light'].forEach(p => root.removeProperty(p));
    if (pack?.theme?.accent) root.setProperty('--school', pack.theme.accent);
    if (pack?.theme?.secondary) root.setProperty('--school-2', pack.theme.secondary);
    paint();
  },

  routes(registerRoute, { dashboard }) {
    registerRoute('/', renderHome);
    registerRoute('/now', renderNow);
    registerRoute('/dashboard', dashboard);
    registerRoute('/week', renderWeek);
    registerRoute('/term', renderTerm);
    registerRoute('/resources', (c) => renderHub(c, 'resources'));
    registerRoute('/school', renderSchool);
    registerRoute('/personal', (c) => renderHub(c, 'personal'));
    registerRoute('/paths', renderPaths);
    registerRoute('/free-time', renderFreeTime);
    registerRoute('/handover', renderHandover);
    registerRoute('/send', renderSend);
    registerRoute('/plan', renderNewLesson);
    registerRoute('/demos', renderDemos);
    registerRoute('/demos/:id', renderDemos);
  },

  /* A teacher with no AI key meets the key screen first, once. */
  welcome(onDone) { applyPrefs(); openKeySetup(onDone, { first: true }); },

  openLook,
  whatsNew,
  build: BUILD,
};
