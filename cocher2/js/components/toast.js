/*
 * Co-Cher Toast Notifications
 * ===========================
 * Lightweight toast system.
 */

let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    // Announce toasts to screen readers without stealing focus
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'default', duration = 2500) {
  const c = ensureContainer();

  const toast = document.createElement('div');
  toast.className = `toast${type !== 'default' ? ` toast-${type}` : ''}`;
  toast.textContent = message;
  c.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Toast with an action button (e.g. Undo). onAction fires if clicked before
 * the toast times out; the return value tells callers whether it was used.
 */
export function showActionToast(message, actionLabel, onAction, duration = 6000) {
  const c = ensureContainer();
  const toast = document.createElement('div');
  toast.className = 'toast toast-action';
  toast.style.cssText = 'display:flex;align-items:center;gap:12px;';
  const msg = document.createElement('span');
  msg.textContent = message;
  const btn = document.createElement('button');
  btn.textContent = actionLabel;
  btn.style.cssText = 'background:none;border:none;color:var(--brand-yellow,#FFE200);font-weight:700;cursor:pointer;font-size:0.8125rem;padding:0;';
  let used = false;
  let removeTimer = null;
  const dismiss = () => {
    if (removeTimer) clearTimeout(removeTimer);
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  };
  btn.addEventListener('click', () => { used = true; try { onAction(); } finally { dismiss(); } });
  toast.appendChild(msg);
  toast.appendChild(btn);
  c.appendChild(toast);
  removeTimer = setTimeout(dismiss, duration);
  return () => used;
}
