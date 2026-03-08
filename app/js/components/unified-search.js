/*
 * Co-Cher Unified Search (Ctrl+K)
 * ================================
 * Global search overlay that spans all data stores.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';

let overlay = null;

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function getAllSearchableItems() {
  const items = [];

  // Knowledge Base uploads
  (Store.get('knowledgeUploads') || []).forEach(u => {
    items.push({
      type: 'knowledge', icon: 'KB', color: '#3b82f6',
      title: u.title, subtitle: `${u.category} · ${u.subject || 'General'}`,
      searchText: `${u.title} ${u.category} ${u.subject || ''} ${u.content || ''} ${u.notes || ''}`,
      action: () => navigate('/knowledge')
    });
  });

  // Stimulus Materials
  const stimLib = Store.get('stimulusLibrary') || [];
  const legacyStim = stimLib.length ? stimLib : (() => { try { return JSON.parse(localStorage.getItem('cocher_stimulus_library') || '[]'); } catch { return []; } })();
  legacyStim.forEach(s => {
    items.push({
      type: 'stimulus', icon: 'SM', color: '#8b5cf6',
      title: s.title, subtitle: `${s.subject || ''} · ${s.type || ''} · ${s.level || ''}`,
      searchText: `${s.title} ${s.subject || ''} ${s.type || ''} ${s.content || ''}`,
      action: () => navigate('/stimulus-material')
    });
  });

  // Source Analysis sets
  const srcLib = Store.get('sourceLibrary') || [];
  const legacySrc = srcLib.length ? srcLib : (() => { try { return JSON.parse(localStorage.getItem('cocher_source_library') || '[]'); } catch { return []; } })();
  legacySrc.forEach(s => {
    items.push({
      type: 'source', icon: 'SA', color: '#e11d48',
      title: s.title, subtitle: `${s.subject || ''} · ${s.topic || ''} · ${s.level || ''}`,
      searchText: `${s.title} ${s.subject || ''} ${s.topic || ''} ${(s.sources || []).map(src => src.content).join(' ')}`,
      action: () => navigate('/source-analysis')
    });
  });

  // PD Portfolio folders & materials
  (Store.get('pdFolders') || []).forEach(f => {
    items.push({
      type: 'pd', icon: 'PD', color: '#10b981',
      title: f.name, subtitle: `PD Folder · ${(f.materials || []).length} items`,
      searchText: `${f.name} ${f.description || ''} ${(f.tags || []).join(' ')} ${(f.materials || []).map(m => m.title + ' ' + (m.content || '')).join(' ')}`,
      action: () => navigate(`/my-growth/${f.id}`)
    });
  });

  // Lessons
  (Store.get('lessons') || []).forEach(l => {
    items.push({
      type: 'lesson', icon: 'LS', color: '#f59e0b',
      title: l.title, subtitle: `Lesson · ${l.status || 'draft'}`,
      searchText: `${l.title} ${l.plan || ''} ${l.objectives || ''}`,
      action: () => navigate(`/lessons/${l.id}`)
    });
  });

  // Classes
  (Store.get('classes') || []).forEach(c => {
    items.push({
      type: 'class', icon: 'CL', color: '#06b6d4',
      title: c.name, subtitle: `Class · ${c.level || ''} ${c.subject || ''} · ${(c.students || []).length} students`,
      searchText: `${c.name} ${c.level || ''} ${c.subject || ''} ${(c.students || []).map(s => s.name).join(' ')}`,
      action: () => navigate(`/classes/${c.id}`)
    });
  });

  // Department Schemes
  (Store.get('departmentSchemes') || []).forEach(s => {
    items.push({
      type: 'scheme', icon: 'DS', color: '#7c3aed',
      title: s.name, subtitle: `${s.department || ''} · ${s.level || ''}`,
      searchText: `${s.name} ${s.department || ''} ${s.level || ''} ${(s.terms || []).map(t => t.topics?.join(' ')).join(' ')}`,
      action: () => navigate('/knowledge')
    });
  });

  // Assessment Blueprints
  (Store.get('assessmentBlueprints') || []).forEach(b => {
    items.push({
      type: 'blueprint', icon: 'AB', color: '#ec4899',
      title: b.name, subtitle: `Assessment Blueprint · ${b.subject || ''}`,
      searchText: `${b.name} ${b.subject || ''} ${(b.questions || []).map(q => q.topic + ' ' + q.question).join(' ')}`,
      action: () => navigate('/assessment/aol')
    });
  });

  return items;
}

function renderResults(query, items, resultsList) {
  if (!query.trim()) {
    resultsList.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ink-faint,#94a3b8);font-size:0.8125rem;">Type to search across all your resources...</div>`;
    return;
  }

  const q = query.toLowerCase();
  const matches = items.filter(item => item.searchText.toLowerCase().includes(q)).slice(0, 12);

  if (matches.length === 0) {
    resultsList.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ink-faint,#94a3b8);font-size:0.8125rem;">No results for "${esc(query)}"</div>`;
    return;
  }

  resultsList.innerHTML = matches.map((m, i) => `
    <div class="us-result ${i === 0 ? 'us-result-active' : ''}" data-idx="${i}" style="
      display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;
      border-radius:8px;transition:background 0.1s;">
      <div style="width:32px;height:32px;border-radius:8px;background:${m.color}15;color:${m.color};
        display:flex;align-items:center;justify-content:center;font-size:0.625rem;font-weight:700;flex-shrink:0;">${m.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.875rem;font-weight:500;color:var(--ink,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.title)}</div>
        <div style="font-size:0.6875rem;color:var(--ink-muted,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(m.subtitle)}</div>
      </div>
      <span style="font-size:0.5625rem;background:var(--bg-subtle,#f1f5f9);padding:2px 8px;border-radius:4px;color:var(--ink-faint,#94a3b8);text-transform:uppercase;font-weight:600;">${m.type}</span>
    </div>
  `).join('');

  // Click handlers
  resultsList.querySelectorAll('.us-result').forEach((el, i) => {
    el.addEventListener('click', () => { closeSearch(); matches[i].action(); });
    el.addEventListener('mouseenter', () => {
      resultsList.querySelectorAll('.us-result').forEach(r => r.classList.remove('us-result-active'));
      el.classList.add('us-result-active');
    });
  });
}

export function openSearch() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.id = 'unified-search-overlay';
  overlay.innerHTML = `
    <style>
      #unified-search-overlay {
        position:fixed;inset:0;z-index:9999;
        background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);
        display:flex;align-items:flex-start;justify-content:center;padding-top:min(20vh,140px);
        animation:usFadeIn 0.15s ease;
      }
      @keyframes usFadeIn { from { opacity:0; } to { opacity:1; } }
      .us-dialog {
        background:var(--bg-card,#fff);border:1px solid var(--border,#e2e8f0);
        border-radius:14px;width:min(580px,92vw);
        box-shadow:0 25px 60px rgba(0,0,0,0.25);overflow:hidden;
        animation:usSlideIn 0.2s ease;
      }
      @keyframes usSlideIn { from { transform:translateY(-12px);opacity:0; } to { transform:translateY(0);opacity:1; } }
      .dark .us-dialog { background:var(--bg-card,#1e1e2e);border-color:var(--border,#2e2e3e); }
      .us-input-row {
        display:flex;align-items:center;gap:10px;padding:14px 18px;
        border-bottom:1px solid var(--border-light,#f0f0f4);
      }
      .dark .us-input-row { border-bottom-color:var(--border,#2e2e3e); }
      .us-input {
        flex:1;border:none;outline:none;font-size:1rem;font-family:inherit;
        background:transparent;color:var(--ink,#0f172a);
      }
      .dark .us-input { color:var(--ink,#f1f5f9); }
      .us-input::placeholder { color:var(--ink-faint,#94a3b8); }
      .us-kbd {
        font-size:0.625rem;background:var(--bg-subtle,#f1f5f9);padding:2px 6px;
        border-radius:4px;color:var(--ink-faint,#94a3b8);border:1px solid var(--border,#e2e8f0);
      }
      .dark .us-kbd { background:var(--bg-subtle,#0f1629);border-color:var(--border,#2e2e3e); }
      .us-results { max-height:360px;overflow-y:auto;padding:6px; }
      .us-result-active { background:var(--accent-light,rgba(59,130,246,0.08)) !important; }
      .dark .us-result-active { background:rgba(59,130,246,0.15) !important; }
      .us-footer {
        padding:8px 18px;border-top:1px solid var(--border-light,#f0f0f4);
        display:flex;gap:12px;font-size:0.6875rem;color:var(--ink-faint,#94a3b8);
      }
      .dark .us-footer { border-top-color:var(--border,#2e2e3e); }
    </style>
    <div class="us-dialog">
      <div class="us-input-row">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted,#64748b)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="us-input" id="us-input" placeholder="Search lessons, resources, classes..." autofocus />
        <span class="us-kbd">ESC</span>
      </div>
      <div class="us-results" id="us-results"></div>
      <div class="us-footer">
        <span>↑↓ Navigate</span>
        <span>↵ Open</span>
        <span>Esc Close</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('#us-input');
  const resultsList = overlay.querySelector('#us-results');
  const allItems = getAllSearchableItems();
  let activeIdx = 0;

  renderResults('', allItems, resultsList);

  input.addEventListener('input', () => {
    activeIdx = 0;
    renderResults(input.value, allItems, resultsList);
  });

  // Keyboard navigation
  input.addEventListener('keydown', e => {
    const results = resultsList.querySelectorAll('.us-result');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, results.length - 1);
      results.forEach((r, i) => r.classList.toggle('us-result-active', i === activeIdx));
      results[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      results.forEach((r, i) => r.classList.toggle('us-result-active', i === activeIdx));
      results[activeIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = resultsList.querySelector('.us-result-active');
      if (active) active.click();
    }
  });

  // Close on overlay click or Escape
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

  setTimeout(() => input.focus(), 50);
}

export function closeSearch() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

/**
 * Install global keyboard shortcut (Ctrl+K / Cmd+K).
 * Call once during app init.
 */
export function initGlobalSearch() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (overlay) closeSearch(); else openSearch();
    }
  });
}
