/*
 * Co-Cher 3: term goals
 * =====================
 * Two or three things a teacher means to get better at, or get done, this
 * term. Entries can be linked to a goal (in the entry's own form), so a goal
 * shows how much of its work is done. Kept with the teacher's other work
 * (Store key `goals`) and exported with it.
 */

import { Store, generateId } from '../state.js';
import { openModal } from '../components/modals.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const allGoals = () => (Store.get('goals') || []).slice();
const save = (list) => Store.set('goals', list);

/** { total, done } of the entries linked to a goal. */
export function goalProgress(goalId) {
  const mine = (Store.get('agenda') || []).filter(e => e.goalId === goalId);
  return { total: mine.length, done: mine.filter(e => e.done).length };
}

export function goalsHTML() {
  const goals = allGoals();
  if (!goals.length) return `<p class="v3-empty">None set. Two or three is plenty: something to get better at, something to get done. Link your entries to a goal and it shows how far along you are.</p>`;
  return goals.map(g => { const p = goalProgress(g.id); const pct = p.total ? Math.round(p.done / p.total * 100) : 0;
    return `<div class="v3-goal${g.done ? ' done' : ''}" data-goal="${esc(g.id)}">
      <button class="body" data-goal-act="edit" title="Edit this goal"><span class="t">${esc(g.title)}</span>
        ${g.note ? `<span class="s">${esc(g.note)}</span>` : ''}</button>
      <span class="n">${g.done ? 'Met' : p.total ? `${p.done} of ${p.total} entries done` : 'No entries linked yet'}</span>
      <span class="bar" role="img" aria-label="${pct}% of linked entries done"><i style="width:${g.done ? 100 : pct}%"></i></span>
    </div>`; }).join('');
}

export function wireGoals(root, redraw) {
  root.querySelectorAll('[data-goal-act="edit"]').forEach(b => b.addEventListener('click', () => {
    const g = allGoals().find(x => x.id === b.closest('[data-goal]').dataset.goal); if (g) openGoal(g, redraw);
  }));
  root.querySelectorAll('[data-add-goal]').forEach(b => b.addEventListener('click', () => openGoal({}, redraw)));
}

export function openGoal(goal, redraw) {
  const isNew = !goal.id;
  const g = { title: '', note: '', done: false, ...goal };
  const { backdrop, close } = openModal({
    title: isNew ? 'Set a goal for the term' : 'Edit goal', width: 460,
    body: `<div style="display:flex;flex-direction:column;gap:14px;">
      <div><label class="input-label" for="gl-title">The goal</label>
        <input class="input" id="gl-title" maxlength="120" value="${esc(g.title)}" placeholder="Every 3E lesson ends with an exit ticket" autocomplete="off"></div>
      <div><label class="input-label" for="gl-note">How you will know (optional)</label>
        <input class="input" id="gl-note" maxlength="160" value="${esc(g.note)}" placeholder="Eight lessons taught with one, by Week 8" autocomplete="off"></div>
      ${isNew ? '' : `<label style="display:flex;gap:8px;align-items:center;font-size:.875rem;cursor:pointer;"><input type="checkbox" id="gl-done"${g.done ? ' checked' : ''} style="accent-color:var(--accent);"> Met</label>`}
    </div>`,
    footer: `${isNew ? '' : '<button class="btn btn-ghost" data-act="del" style="margin-right:auto;color:var(--danger);">Delete</button>'}
      <button class="btn btn-secondary" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">${isNew ? 'Set goal' : 'Save'}</button>`,
  });
  const q = (s) => backdrop.querySelector(s);
  setTimeout(() => q('#gl-title').focus(), 50);
  const commit = () => {
    const title = q('#gl-title').value.trim(); if (!title) { q('#gl-title').focus(); return; }
    const next = { ...g, title, note: q('#gl-note').value.trim(), done: !!q('#gl-done')?.checked };
    const list = allGoals();
    if (isNew) list.push({ ...next, id: generateId(), createdAt: Date.now() }); else { const i = list.findIndex(x => x.id === g.id); if (i >= 0) list[i] = next; }
    save(list); close(); redraw();
  };
  q('[data-act="save"]').addEventListener('click', commit);
  q('#gl-title').addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
  q('[data-act="cancel"]').addEventListener('click', close);
  q('[data-act="del"]')?.addEventListener('click', () => {
    save(allGoals().filter(x => x.id !== g.id));
    Store.set('agenda', (Store.get('agenda') || []).map(e => (e.goalId === g.id ? { ...e, goalId: '' } : e)));
    close(); redraw();
  });
}
