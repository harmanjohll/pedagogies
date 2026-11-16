/*
 * Co-Cher 3: the teacher's own look and way of working
 * ====================================================
 * Five choices, kept on this device (key cocher3_prefs) and written onto
 * <html> so v3.css can act on them. cocher3.html applies the same values
 * before first paint; keep the two in step.
 */

const KEY = 'cocher3_prefs';

export const CHOICES = {
  look: [
    { id: 'washi', label: 'Washi', note: 'Warm paper, ink, quiet', sw: ['#F3F0E8', '#FAF8F2', '#2A2925'] },
    { id: 'fjord', label: 'Fjord', note: 'Cool stone, clear air', sw: ['#F0F3F2', '#FAFBFB', '#1D2A2D'] },
    { id: 'kiln', label: 'Kiln', note: 'Clay and linen', sw: ['#F4EEE7', '#FBF7F2', '#2E2622'] },
    { id: 'classic', label: 'Classic', note: 'The Co-Cher 2 look', sw: ['#faf9f6', '#ffffff', '#16323A'] },
  ],
  night: [
    { id: 'off', label: 'Day' },
    { id: 'on', label: 'Night' },
  ],
  type: [
    { id: 'mincho', label: 'Mincho', note: 'Shippori Mincho, Zen Kaku Gothic' },
    { id: 'editorial', label: 'Editorial', note: 'Newsreader, Hanken Grotesk' },
    { id: 'grotesk', label: 'Grotesk', note: 'Figtree throughout' },
  ],
  nav: [
    { id: 'rail', label: 'Rail', note: 'Menu at the side' },
    { id: 'top', label: 'Bar', note: 'Menu along the top' },
    { id: 'dock', label: 'Dock', note: 'Menu at the bottom' },
  ],
  home: [
    { id: 'school', label: 'My School', note: 'Every place as a tile, with Now large and live' },
    { id: 'flow', label: 'Flow', note: 'Your day in order: now, next, what needs you' },
    { id: 'board', label: 'Board', note: 'Everything laid out, grouped by place' },
    { id: 'ask', label: 'Ask', note: 'One search box; type where you want to go' },
  ],
  density: [
    { id: 'airy', label: 'Airy' },
    { id: 'compact', label: 'Compact' },
  ],
};

/* The owner's chosen starting point (A2 B1 C3 D1). Every teacher can change all of it in Look and feel. */
export const DEFAULTS = { look: 'fjord', night: 'off', type: 'mincho', nav: 'dock', home: 'school', density: 'airy' };

export function getPrefs() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { saved = {}; }
  const out = { ...DEFAULTS };
  Object.keys(DEFAULTS).forEach(k => { if (CHOICES[k].some(c => c.id === saved[k])) out[k] = saved[k]; });
  // 3.1 made My School the landing page. A start mode saved before that was
  // never a choice (the app saved it by itself), so it moves once.
  if (saved.rev !== 2) out.home = 'school';
  return out;
}

export function setPref(key, value) {
  const p = { ...getPrefs(), [key]: value, rev: 2 };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: lasts this visit */ }
  applyPrefs(p);
  return p;
}

export function applyPrefs(p = getPrefs()) {
  const h = document.documentElement;
  h.classList.add('v3');
  h.dataset.look = p.look;
  h.dataset.type = p.type;
  h.dataset.density = p.density;
  // A phone always gets the dock: a side rail has nowhere to live at that width.
  h.dataset.nav = window.matchMedia('(max-width: 760px)').matches ? 'dock' : p.nav;
  h.classList.toggle('dark', p.night === 'on');
  h.classList.toggle('theme-classic', false);
}
