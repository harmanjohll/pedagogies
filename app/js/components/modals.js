/*
 * Co-Cher Modals
 * ==============
 * Reusable modal dialog system.
 */

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function openModal({ title, body, footer, width = 480, onClose, onMount }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const previouslyFocused = document.activeElement;

  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${String(title).replace(/"/g, '&quot;')}" style="max-width: ${width}px;">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" aria-label="Close">${CLOSE_ICON}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);

  // Call onMount callback so callers can wire up event listeners
  if (typeof onMount === 'function') onMount(backdrop);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.style.opacity = '0';
    backdrop.querySelector('.modal').style.transform = 'scale(0.96)';
    backdrop.querySelector('.modal').style.opacity = '0';
    setTimeout(() => {
      backdrop.remove();
      // Return focus to where the user was before the modal opened
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
      if (typeof onClose === 'function') onClose();
    }, 200);
  }

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // Close button
  backdrop.querySelector('.modal-close').addEventListener('click', close);

  // Escape closes; Tab cycles within the modal (focus trap)
  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const focusables = [...backdrop.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!backdrop.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey);

  // Initial focus: first focusable element inside the modal body/footer
  setTimeout(() => {
    const focusables = [...backdrop.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && el.offsetParent !== null && !el.classList.contains('modal-close'));
    (focusables[0] || backdrop.querySelector('.modal-close'))?.focus();
  }, 50);

  return { backdrop, close };
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', confirmClass = 'btn btn-danger', cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    const { backdrop, close } = openModal({
      title,
      body: `<p style="font-size: 0.875rem; color: var(--ink-secondary); line-height: 1.6;">${message}</p>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">${cancelLabel}</button>
        <button class="${confirmClass}" data-action="confirm">${confirmLabel}</button>
      `,
      onClose: () => resolve(false)
    });

    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', () => { close(); resolve(false); });
    backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => { close(); resolve(true); });
  });
}
