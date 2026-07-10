/*
 * Co-Cher Keyboard Shortcuts
 * ==========================
 * Global keyboard shortcuts for power users.
 */

import { navigate } from '../router.js';
import { openModal } from './modals.js';

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], desc: 'Search everything', action: null },  // Handled by unified-search
  { keys: ['Ctrl', 'N'], desc: 'New lesson', action: () => navigate('/lesson-planner') },
  { keys: ['Ctrl', 'Shift', 'S'], desc: 'Spatial Designer', action: () => navigate('/spatial') },
  { keys: ['Ctrl', '/'], desc: 'Show shortcuts', action: () => showShortcutsHelp() },
];

function showShortcutsHelp() {
  openModal({
    title: 'Keyboard Shortcuts',
    width: 420,
    body: `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${SHORTCUTS.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">
            <span style="font-size:0.8125rem;color:var(--ink-secondary);">${s.desc}</span>
            <div style="display:flex;gap:4px;">
              ${s.keys.map(k => `<kbd style="
                padding:2px 8px;background:var(--bg-subtle,#f1f5f9);
                border:1px solid var(--border,#e2e8f0);border-radius:4px;
                font-size:0.6875rem;font-family:var(--font-mono);color:var(--ink-muted);
              ">${k}</kbd>`).join('<span style="color:var(--ink-faint);font-size:0.625rem;">+</span>')}
            </div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-light,#f0f0f4);font-size:0.6875rem;color:var(--ink-faint);">
        Shortcuts work from any page. Press Esc to close dialogs.
      </div>
    `,
    footer: '<button class="btn btn-primary btn-sm" data-action="cancel">Close</button>'
  });
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Skip if user is typing in an input/textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      navigate('/lesson-planner');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      navigate('/spatial');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      showShortcutsHelp();
    }
  });
}
