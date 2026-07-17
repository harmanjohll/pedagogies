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
  { keys: ['Ctrl', '.'], desc: 'Focus mode (hide sidebar while planning)', action: null },
  { keys: ['Ctrl', 'J'], desc: 'Next action only (collapse the lesson journey)', action: null },
  { keys: ['Ctrl', '/'], desc: 'Show shortcuts', action: () => showShortcutsHelp() },
];

export function toggleFocusMode() {
  document.body.classList.toggle('focus-mode');
}

/* ── "Next action only" — collapse the lesson journey to just its CTA ──
 * Mirrors Focus Mode (a body class), but the preference PERSISTS across
 * sessions since it's a durable teacher choice, not a per-page toggle. */
const JOURNEY_MINIMAL_KEY = 'cocher_v5_1_journey_minimal';

/** Toggle journey-minimal, persist it, and return the new on/off state. */
export function toggleJourneyMinimal() {
  const on = !document.body.classList.contains('journey-minimal');
  document.body.classList.toggle('journey-minimal', on);
  try { localStorage.setItem(JOURNEY_MINIMAL_KEY, on ? '1' : '0'); } catch { /* quota — ignore */ }
  return on;
}

/** Apply the persisted preference to <body>. Returns the current state. */
export function applyJourneyMinimal() {
  let on = false;
  try { on = localStorage.getItem(JOURNEY_MINIMAL_KEY) === '1'; } catch { /* ignore */ }
  document.body.classList.toggle('journey-minimal', on);
  return on;
}

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
    if ((e.ctrlKey || e.metaKey) && e.key === '.') {
      e.preventDefault();
      toggleFocusMode();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
      toggleJourneyMinimal();
    }
  });

  // Leaving a page always exits focus mode (the sidebar must come back)
  window.addEventListener('hashchange', () => {
    document.body.classList.remove('focus-mode');
  });
}
