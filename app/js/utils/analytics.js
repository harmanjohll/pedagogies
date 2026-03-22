/*
 * Co-Cher Usage Analytics (Tier 2)
 * =================================
 * Lightweight, fire-and-forget feature-level tracking.
 * Sends events to a Google Sheets webhook configured in Settings.
 * Zero impact on UX — fails silently if no webhook is set or endpoint is down.
 *
 * ── Google Apps Script (deploy as Web App → "Anyone") ──
 *
 *   function doPost(e) {
 *     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *     var rows = JSON.parse(e.postData.contents);
 *     rows.forEach(function(r) {
 *       sheet.appendRow([
 *         new Date(r.timestamp),
 *         r.user,
 *         r.email,
 *         r.category,
 *         r.action,
 *         r.label || '',
 *         r.sessionId
 *       ]);
 *     });
 *     return ContentService.createTextOutput('ok');
 *   }
 *
 * Sheet columns: Timestamp | User | Email | Category | Action | Label | Session
 */

const WEBHOOK_KEY = 'cocher_analytics_url';
const BATCH_SIZE = 5;
const BATCH_INTERVAL = 10_000; // 10 seconds

let _queue = [];
let _timer = null;
let _sessionId = null;

function getSessionId() {
  if (!_sessionId) {
    _sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  return _sessionId;
}

function getWebhookUrl() {
  try { return localStorage.getItem(WEBHOOK_KEY) || ''; } catch { return ''; }
}

function flush() {
  clearTimeout(_timer);
  _timer = null;
  if (_queue.length === 0) return;

  const url = getWebhookUrl();
  if (!url) { _queue = []; return; }

  const batch = _queue.splice(0);

  // Fire-and-forget — never block the UI
  try {
    const payload = JSON.stringify(batch);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // silently ignore
  }
}

/**
 * Track a usage event. Non-blocking, batched, fail-silent.
 * @param {string} category  e.g. 'navigation', 'ai', 'content', 'export', 'session'
 * @param {string} action    e.g. 'page_view', 'generate', 'class_created'
 * @param {string} [label]   optional detail e.g. route path, feature name
 */
export function trackEvent(category, action, label) {
  if (!getWebhookUrl()) return; // fast exit — no work at all if unconfigured

  let user = '';
  let email = '';
  try {
    const u = JSON.parse(localStorage.getItem('cocher_current_user') || 'null');
    if (u) { user = u.name || ''; email = u.email || ''; }
  } catch { /* ignore */ }

  _queue.push({ timestamp: Date.now(), user, email, category, action, label: label || '', sessionId: getSessionId() });

  if (_queue.length >= BATCH_SIZE) {
    flush();
  } else if (!_timer) {
    _timer = setTimeout(flush, BATCH_INTERVAL);
  }
}

/**
 * Send a single test event immediately (used by Settings "Test" button).
 * Returns a promise that resolves true on success, false on failure.
 */
export async function sendTestEvent(url) {
  const payload = JSON.stringify([{
    timestamp: Date.now(),
    user: 'Test',
    email: 'test@cocher',
    category: 'system',
    action: 'test',
    label: 'Webhook connectivity test',
    sessionId: getSessionId()
  }]);

  try {
    const res = await fetch(url, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' } });
    return res.ok || res.redirected; // Apps Script redirects on success
  } catch {
    return false;
  }
}

// Flush remaining events when the page is unloading
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}
