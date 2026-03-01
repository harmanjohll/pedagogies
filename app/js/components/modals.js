/*
 * Co-Cher Modals
 * ==============
 * Reusable modal dialog system.
 */

const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export function openModal({ title, body, footer, width = 480, onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal" style="max-width: ${width}px;">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" aria-label="Close">${CLOSE_ICON}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);

  function close() {
    backdrop.style.opacity = '0';
    backdrop.querySelector('.modal').style.transform = 'scale(0.96)';
    backdrop.querySelector('.modal').style.opacity = '0';
    setTimeout(() => {
      backdrop.remove();
      if (typeof onClose === 'function') onClose();
    }, 200);
  }

  // Close on backdrop click
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // Close button
  backdrop.querySelector('.modal-close').addEventListener('click', close);

  // Escape key
  function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  }
  document.addEventListener('keydown', onKey);

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
