/*
 * Co-Cher 3: the shell
 * ====================
 * A new body on Co-Cher 2's engine. This file supplies the menu, the strip of
 * sibling screens, the look panel and the v3 screens; js/app.js does the rest
 * exactly as it does for Co-Cher 2 (sign in, school, data, every view).
 *
 * It registers itself as window.__cocherShell before app.js runs (v3/boot.js).
 * Same data as Co-Cher 2: a teacher sees their own classes and lessons here.
 * The first time v3 opens, a copy of their saved work is set aside on this
 * device (IndexedDB), in case a preview bug ever damages it.
 */

import { getPrefs, setPref, applyPrefs, CHOICES } from './prefs.js';
import { PLACES, ICONS, placeFor, screensIn, getLinks, setLinks, ALL_SCREENS } from './places.js';
import { renderNow, renderWeek, renderTerm, renderHub, renderPaths } from './screens.js';
import { openModal } from '../js/components/modals.js';
import { renderDemos, demoById } from './demos.js';
import { openSearch } from '../js/components/unified-search.js';
import { currentSchoolId, getCurrentUser } from '../js/components/login.js';
import { Store, storageKeyFor } from '../js/state.js';
import { idbGet, idbPut } from '../js/utils/storage.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const route = () => (location.hash.replace(/^#/, '') || '/').split('?')[0];

/* v3 is a preview for one school first. Others keep Co-Cher 2. */
const OPEN_TO = ['bty'];

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
    return `${head}<a class="v3-link${here && here.id === p.id ? ' on' : ''}" href="#${p.route}" data-place="${p.id}">${ICONS[p.id]}<span>${p.label}</span></a>`;
  }).join('');
  const user = getCurrentUser();
  return `
    <a class="v3-brand" href="#/"><b>Co-Cher</b><span>3.1 preview</span></a>
    ${items}
    <div class="v3-spacer"></div>
    <span class="v3-sep"></span>
    <button class="v3-link v3-util" data-act="search">${ICONS.search}<span>Search</span><kbd>Ctrl K</kbd></button>
    <div class="v3-school"><i></i><b>${esc(schoolPack?.name || user?.schoolName || 'Your school')}</b>${esc(user?.preferredName || user?.name || user?.email || '')}</div>`;
}

function stripHTML() {
  const r = route();
  const place = currentPlace();
  if (!place) return '';
  const screens = screensIn(place);
  const current = screens.filter(s => r === s.route || (s.route !== '/' && r.startsWith(s.route))).sort((a, b) => b.route.length - a.route.length)[0];
  const demo = current?.demo ? demoById(current.demo) : null;
  const tabs = screens.length > 1 ? `<span class="where">${place.label}</span>` + screens.map(s =>
    `<a href="#${s.route}" class="${current && current.route === s.route ? 'on' : ''}"${current && current.route === s.route ? ' aria-current="page"' : ''}${s.linked ? ` title="Linked here by you; its home is ${esc(s.home.label)}"` : ''}>${esc(s.label)}${s.linked ? ICONS.link : ''}</a>`).join('') : '';
  const tools = current ? `<span class="tools">
      ${demo ? `<a class="tool" href="#/demos/${demo.id}" title="A short demo of this screen">${ICONS.play}Demo</a>` : ''}
      <button class="tool" data-act="link" data-route="${esc(current.route)}" title="Also show this screen under another place">${ICONS.link}Link</button>
    </span>` : '';
  return tabs + tools;
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
  const nav = document.querySelector('.v3-nav');
  const strip = document.querySelector('.v3-strip');
  if (nav) nav.innerHTML = navHTML();
  if (strip) strip.innerHTML = stripHTML();
}

/* ── Look and feel ── */
function openLook() {
  if (document.querySelector('.v3-look')) return;
  const back = document.createElement('div'); back.className = 'v3-look-back';
  const panel = document.createElement('aside'); panel.className = 'v3-look'; panel.setAttribute('aria-label', 'Look and feel');
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
      <h2>Look and feel</h2>
      <p>Make Co-Cher yours. Changes apply at once and stay on this device. Your school’s colours come with every look, softened to suit it.</p>
      ${group('look', 'Look')}
      ${group('night', 'Day or night')}
      ${group('type', 'Type', 'three')}
      ${group('nav', 'Menu', 'three')}
      ${group('home', 'How you start')}
      ${group('density', 'Spacing')}`;
    panel.querySelector('.close').onclick = close;
    panel.querySelectorAll('.v3-opt').forEach(b => b.onclick = () => {
      setPref(b.dataset.key, b.dataset.val);
      if (b.dataset.key === 'night') Store.set('darkMode', b.dataset.val === 'on');
      paint(); draw();
      if (b.dataset.key === 'home' && route() === '/') window.dispatchEvent(new HashChangeEvent('hashchange'));
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
    const open = OPEN_TO.includes(currentSchoolId());
    app.innerHTML = `
      <nav class="v3-nav" aria-label="Co-Cher"></nav>
      <div class="v3-body">
        <div class="v3-strip" aria-label="In this place"></div>
        <main class="main-content"><div id="main-view" style="height:100%;display:flex;flex-direction:column;"></div></main>
      </div>`;
    if (!open) {
      app.innerHTML = `<div class="v3-gate">
        <div class="v3-eyebrow">Co-Cher 3 preview</div>
        <h1 class="v3-title">Open to Beatty for now</h1>
        <p class="v3-lede" style="margin:0 auto 24px;">This preview is being tried at one school first. Your school’s Co-Cher is where it has always been, with all your work.</p>
        <a class="btn btn-primary" href="cocher2.html">Open Co-Cher 2</a>
        <div id="main-view" hidden></div></div>`;
      return;
    }
    paint();
    window.addEventListener('hashchange', paint);
    window.matchMedia('(max-width: 760px)').addEventListener('change', () => applyPrefs());
    app.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'search') openSearch();
      if (b.dataset.act === 'look') openLook();
      if (b.dataset.act === 'link') openLink(b.dataset.route);
    });
    backupOnce();
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
    registerRoute('/', renderNow);
    registerRoute('/dashboard', dashboard);
    registerRoute('/week', renderWeek);
    registerRoute('/term', renderTerm);
    registerRoute('/resources', (c) => renderHub(c, 'resources'));
    registerRoute('/school', (c) => renderHub(c, 'school'));
    registerRoute('/personal', (c) => renderHub(c, 'personal'));
    registerRoute('/paths', renderPaths);
    registerRoute('/demos', renderDemos);
    registerRoute('/demos/:id', renderDemos);
  },

  openLook,
};
