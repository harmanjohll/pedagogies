/*
 * Observe panel (Present mode)
 * ============================
 * Capture competency evidence while teaching: pick students, pick the
 * competency (the segment's E21CC focus is chosen for you), tap "Showed it" or
 * "Working towards it", optionally add a few words. Each tap becomes an
 * observation on the student's record, linked to this lesson and segment, so
 * it shows on their profile, the lesson page and in report comments.
 *
 * Present is often on the projector, so the panel can show initials instead of
 * names (remembered on this device), and it closes with O or Esc.
 */

import { escapeHtml as esc } from '../utils/markdown.js';
import { COMPETENCIES, VERDICTS, competencyLabel, recordObservations, evidenceForLesson } from '../utils/evidence.js';

const NAMES_KEY = 'cocher2_observe_names';
const initials = name => String(name || '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase();

function injectStyles() {
  if (document.getElementById('obs-styles')) return;
  const st = document.createElement('style');
  st.id = 'obs-styles';
  st.textContent = `
    .obs-panel { position:fixed; top:0; right:0; bottom:0; width:min(400px, 92vw); z-index:900; background:var(--surface, #fff); border-left:1px solid var(--border, #e5e7eb); box-shadow:-12px 0 32px rgba(15,23,42,.14); display:flex; flex-direction:column; transform:translateX(105%); transition:transform .28s cubic-bezier(.2,.8,.2,1); text-align:left; }
    .obs-panel.open { transform:none; }
    .obs-head { padding:14px 16px 10px; border-bottom:1px solid var(--border-light, #eee); }
    .obs-head h3 { margin:0; font-size:1.05rem; display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .obs-close { border:0; background:transparent; font-size:1.4rem; line-height:1; cursor:pointer; color:var(--ink-muted); padding:2px 6px; }
    .obs-sub { font-size:.78rem; color:var(--ink-muted); margin-top:2px; }
    .obs-body { flex:1; overflow:auto; padding:12px 16px; display:flex; flex-direction:column; gap:12px; }
    .obs-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-faint, #94a3b8); margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; }
    .obs-label button { border:0; background:transparent; color:var(--accent, #4361ee); font:inherit; font-size:.7rem; cursor:pointer; text-transform:none; letter-spacing:0; }
    .obs-comps { display:flex; flex-wrap:wrap; gap:6px; }
    .obs-comp { padding:5px 10px; border-radius:999px; border:1.5px solid var(--border, #d1d5db); background:transparent; font:inherit; font-size:.78rem; font-weight:600; color:var(--ink-secondary, #475569); cursor:pointer; }
    .obs-comp.on { border-color:var(--growth, #2c7a4b); background:var(--growth-light, #e2f2e8); color:var(--growth, #2c7a4b); }
    .obs-kids { display:grid; grid-template-columns:repeat(auto-fill, minmax(104px, 1fr)); gap:6px; }
    .obs-kid { position:relative; padding:7px 8px; border-radius:10px; border:1.5px solid var(--border-light, #e5e7eb); background:var(--bg-card, #fff); font:inherit; font-size:.78rem; font-weight:600; color:var(--ink); cursor:pointer; text-align:left; line-height:1.25; min-height:38px; }
    .obs-kid.on { border-color:var(--accent, #4361ee); background:var(--accent-light, #eef1ff); }
    .obs-kid .n { position:absolute; top:3px; right:5px; font-size:.62rem; color:var(--ink-faint); }
    .obs-kid .dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--growth, #2c7a4b); margin-left:4px; vertical-align:middle; }
    .obs-note { width:100%; box-sizing:border-box; }
    .obs-foot { padding:12px 16px 16px; border-top:1px solid var(--border-light, #eee); display:flex; flex-direction:column; gap:8px; }
    .obs-verdicts { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .obs-verdict { padding:10px 8px; border-radius:10px; border:0; font:inherit; font-weight:700; font-size:.88rem; color:#fff; cursor:pointer; }
    .obs-verdict[disabled] { opacity:.4; cursor:default; }
    .obs-status { font-size:.78rem; color:var(--ink-muted); min-height:1.2em; }
    .obs-status.ok { color:var(--growth, #2c7a4b); font-weight:600; }
  `;
  document.head.appendChild(st);
}

/**
 * @param {HTMLElement} host   where the panel is appended (Present's container)
 * @param {{ lesson, cls, currentSegment: () => ({ name, e21ccFocus } | null) }} ctx
 */
export function mountObservePanel(host, ctx) {
  injectStyles();
  const { lesson, cls } = ctx;
  const el = document.createElement('aside');
  el.className = 'obs-panel';
  el.setAttribute('aria-label', 'Observe students');
  host.appendChild(el);

  let open = false;
  let selected = new Set();
  let comp = null;
  let showNames = (() => { try { return localStorage.getItem(NAMES_KEY) !== 'initials'; } catch { return true; } })();
  let status = '';
  let note = '';

  const students = (cls?.students || []).slice().sort((a, b) =>
    (parseInt(a.index, 10) || 9999) - (parseInt(b.index, 10) || 9999) || a.name.localeCompare(b.name));

  function draw() {
    const seg = ctx.currentSegment();
    if (!comp) comp = seg?.e21ccFocus || COMPETENCIES[0].key;
    const seen = new Set(evidenceForLesson(lesson).map(o => o._student.id));
    const count = evidenceForLesson(lesson).length;

    if (!cls) {
      el.innerHTML = `<div class="obs-head"><h3>Observe <button class="obs-close" aria-label="Close">&times;</button></h3></div>
        <div class="obs-body"><p class="obs-sub">This lesson has no class yet. Link a class in the Lesson Planner, and its students appear here.</p></div>`;
      el.querySelector('.obs-close').onclick = close;
      return;
    }

    el.innerHTML = `
      <div class="obs-head">
        <h3>Observe <button class="obs-close" aria-label="Close (O)">&times;</button></h3>
        <div class="obs-sub">${esc(cls.name)}${seg?.name ? ' &middot; ' + esc(seg.name) : ''} &middot; ${count} observation${count === 1 ? '' : 's'} this lesson</div>
      </div>
      <div class="obs-body">
        <div>
          <div class="obs-label">Competency${seg?.e21ccFocus ? '<span style="text-transform:none;letter-spacing:0;font-weight:500;">this part grows ' + esc(competencyLabel(seg.e21ccFocus)) + '</span>' : ''}</div>
          <div class="obs-comps">${COMPETENCIES.map(c => `<button class="obs-comp${c.key === comp ? ' on' : ''}" data-comp="${c.key}">${esc(c.label)}</button>`).join('')}</div>
        </div>
        <div>
          <div class="obs-label">Students ${selected.size ? `(${selected.size})` : ''}
            <span><button data-act="names">${showNames ? 'Show initials' : 'Show names'}</button> &middot; <button data-act="clear">Clear</button></span></div>
          <div class="obs-kids">${students.map(s => `
            <button class="obs-kid${selected.has(s.id) ? ' on' : ''}" data-kid="${esc(s.id)}" title="${esc(s.name)}">
              ${s.index ? `<span class="n">${esc(s.index)}</span>` : ''}${esc(showNames ? s.name : initials(s.name))}${seen.has(s.id) ? '<span class="dot" title="Observed this lesson"></span>' : ''}
            </button>`).join('')}</div>
        </div>
        <div>
          <div class="obs-label">A few words (optional)</div>
          <input class="input obs-note" id="obs-note" type="text" maxlength="140" placeholder="What did you see?" autocomplete="off" value="${esc(note)}">
        </div>
      </div>
      <div class="obs-foot">
        <div class="obs-verdicts">
          ${Object.entries(VERDICTS).map(([k, v]) => `<button class="obs-verdict" data-verdict="${k}" style="background:${v.color};" ${selected.size ? '' : 'disabled'}>${v.icon} ${esc(v.label)}</button>`).join('')}
        </div>
        <div class="obs-status${status ? ' ok' : ''}" role="status">${esc(status || 'Pick students, then tap what you saw.')}</div>
      </div>`;

    el.querySelector('.obs-close').onclick = close;
    el.querySelectorAll('[data-comp]').forEach(b => b.onclick = () => { comp = b.dataset.comp; status = ''; draw(); });
    el.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => {
      const id = b.dataset.kid; selected.has(id) ? selected.delete(id) : selected.add(id); status = ''; draw();
    });
    el.querySelector('[data-act="names"]').onclick = () => {
      showNames = !showNames;
      try { localStorage.setItem(NAMES_KEY, showNames ? 'names' : 'initials'); } catch { /* private mode */ }
      draw();
    };
    el.querySelector('#obs-note').oninput = e => { note = e.target.value; };
    el.querySelector('[data-act="clear"]').onclick = () => { selected.clear(); status = ''; draw(); };
    el.querySelectorAll('[data-verdict]').forEach(b => b.onclick = () => {
      if (!selected.size) return;
      const n = recordObservations(cls.id, [...selected], {
        competency: comp, verdict: b.dataset.verdict, note: note.trim(), lesson, segment: seg?.name || '',
      });
      note = '';
      status = `Saved for ${n} student${n === 1 ? '' : 's'}: ${VERDICTS[b.dataset.verdict].short.toLowerCase()} ${competencyLabel(comp)}.`;
      selected.clear();
      draw();
    });
  }

  function show() { open = true; comp = null; status = ''; draw(); requestAnimationFrame(() => el.classList.add('open')); }
  function close() { open = false; el.classList.remove('open'); }

  return {
    toggle() { open ? close() : show(); },
    close,
    isOpen: () => open,
    refresh() { if (open) { comp = null; draw(); } },     // segment changed
    destroy() { el.remove(); },
  };
}
