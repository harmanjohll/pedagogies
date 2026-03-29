/*
 * Co-Cher Login Screen
 * ====================
 * Email-based login validated against the timetable CSV (single source of truth).
 * Admin/tester accounts are also supported — they exist in the CSV but are
 * excluded from operational lists like relief pools.
 */

import { Store } from '../state.js';
import { trackEvent } from '../utils/analytics.js';

const TT_CSV_URL = './btyrelief/BTYTT_2026Sem1_v1.csv';

let _authorisedList = null;   // [{ name, email }]

/**
 * Load authorised teacher list from the timetable CSV.
 * Extracts unique {name, email} pairs from the "NAME" and "Teacher's Email" columns.
 */
async function loadAuthorisedTeachers() {
  if (_authorisedList) return _authorisedList;
  try {
    const res = await fetch(TT_CSV_URL);
    const text = await res.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { _authorisedList = []; return _authorisedList; }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
    const nameIdx = headers.indexOf('NAME');
    const emailIdx = headers.indexOf("Teacher's Email");
    if (nameIdx < 0 || emailIdx < 0) { _authorisedList = []; return _authorisedList; }

    const seen = new Set();
    _authorisedList = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const email = (cols[emailIdx] || '').trim().toLowerCase();
      const name = (cols[nameIdx] || '').trim();
      if (email && !seen.has(email)) {
        seen.add(email);
        _authorisedList.push({ name, email });
      }
    }
  } catch {
    _authorisedList = [];
  }
  return _authorisedList;
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('cocher_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Get the user's preferred display name, or null. */
export function getPreferredName() {
  const user = getCurrentUser();
  return user?.preferredName || null;
}

/** Update the user's preferred display name. */
export function setPreferredName(name) {
  const user = getCurrentUser();
  if (!user) return;
  user.preferredName = name;
  setCurrentUser(user);
}

/**
 * Guess the first name from a full name string.
 * Skips salutations (MR, MS, MDM, etc.) and title-cases the result.
 */
export function guessFirstName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  const salutations = new Set(['MR', 'MS', 'MDM', 'MRS', 'DR', 'PROF', 'MISS']);
  let nameStart = 0;
  if (parts.length > 1 && salutations.has(parts[0].toUpperCase())) {
    nameStart = 1;
  }
  const first = parts[nameStart] || parts[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function setCurrentUser(user) {
  localStorage.setItem('cocher_current_user', JSON.stringify(user));
}

export function clearCurrentUser() {
  localStorage.removeItem('cocher_current_user');
  // Clear API key so next user must enter their own
  Store.set('apiKey', '');
  localStorage.removeItem('cocher_api_key');
}

function animateOut(overlay, onComplete) {
  const card = overlay.querySelector('#login-card') || overlay.querySelector('#name-card');
  if (card) {
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.96)';
  }
  overlay.style.transition = 'opacity 0.4s';
  setTimeout(() => { overlay.style.opacity = '0'; }, 150);
  setTimeout(() => { overlay.remove(); onComplete(); }, 500);
}

function showNamePrompt(overlay, teacher, onComplete) {
  const guessed = guessFirstName(teacher.name);
  const card = overlay.querySelector('#login-card');
  card.id = 'name-card';
  card.style.transition = 'opacity 0.25s, transform 0.25s';
  card.style.opacity = '0';
  card.style.transform = 'scale(0.97)';

  setTimeout(() => {
    card.innerHTML = `
      <div style="margin-bottom: 20px; text-align: center;">
        <div style="
          width: 48px; height: 48px;
          background: linear-gradient(135deg, #000C53, #26d0ce);
          border-radius: 14px; margin: 0 auto 16px;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 1.1rem;
          box-shadow: 0 4px 16px rgba(0,12,83,0.2);
        ">${guessed.charAt(0)}</div>
        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--ink, #000C53); margin: 0 0 6px;">
          Welcome, Cher!
        </h2>
        <p style="color: var(--ink-muted, #64748b); font-size: 0.875rem; margin: 0; line-height: 1.5;">
          What would you like us to call you?
        </p>
      </div>
      <div style="text-align: left;">
        <label style="display: block; font-weight: 600; font-size: 0.8125rem; margin-bottom: 6px; color: var(--ink-secondary, #334155);">
          Preferred Name
        </label>
        <input
          type="text"
          id="pref-name-input"
          value="${guessed}"
          style="
            width: 100%; padding: 12px 14px;
            border: 1.5px solid #e2e8f0; border-radius: 12px;
            font-size: 0.9rem; font-family: inherit;
            background: var(--bg-subtle, #f8fafc); color: var(--ink, #0f172a); outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
            margin-bottom: 6px;
          "
          onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px #dbeafe';"
          onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';"
        />
        <p style="font-size: 0.75rem; color: #94a3b8; margin: 0 0 20px; line-height: 1.4;">
          You can change this later in Settings.
        </p>
        <button id="pref-name-go" style="
          width: 100%; padding: 14px;
          background: #000C53; color: #FFE200;
          border: none; border-radius: 14px;
          font-weight: 600; font-size: 1rem; cursor: pointer;
          transition: background 0.2s;
          font-family: inherit;
        ">
          Continue
        </button>
      </div>
    `;
    card.style.opacity = '1';
    card.style.transform = 'scale(1)';

    const nameInput = card.querySelector('#pref-name-input');
    const goBtn = card.querySelector('#pref-name-go');

    goBtn.addEventListener('click', () => {
      const preferred = nameInput.value.trim() || guessed;
      setPreferredName(preferred);
      animateOut(overlay, onComplete);
    });

    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') goBtn.click();
    });

    setTimeout(() => nameInput.select(), 100);
  }, 280);
}

export async function renderLogin(onComplete) {
  const teachers = await loadAuthorisedTeachers();

  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.innerHTML = `
    <div class="welcome-card" id="login-card">
      <div style="margin-bottom: 28px;">
        <div style="
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #000C53, #26d0ce);
          border-radius: 16px; margin: 0 auto 20px;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 1.25rem;
          box-shadow: 0 4px 16px rgba(0,12,83,0.3);
        ">C</div>
        <h1 style="font-size: 2rem; font-weight: 700; color: var(--ink, #000C53); margin: 0 0 6px; letter-spacing: -0.02em;">
          Co-Cher
        </h1>
        <p style="color: var(--ink-muted, #64748b); font-size: 0.9375rem; margin: 0 0 16px;">
          Your Co-Teaching Assistant
        </p>
        <span style="
          display: inline-block; background: var(--accent-light, #eef2ff); color: var(--accent, #4338ca);
          padding: 5px 14px; border-radius: 999px; font-size: 0.8rem; font-weight: 500;
        ">Built for Singapore Educators</span>
      </div>

      <div style="text-align: left;">
        <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 6px; color: var(--ink-secondary, #334155);">
          Email
        </label>
        <input
          type="email"
          id="login-email"
          placeholder="e.g. name@btyss.moe.edu.sg or name@moe.edu.sg"
          autocomplete="email"
          style="
            width: 100%; padding: 12px 14px;
            border: 1.5px solid #e2e8f0; border-radius: 12px;
            font-size: 0.9rem; font-family: inherit;
            background: var(--bg-subtle, #f8fafc); color: var(--ink, #0f172a); outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s, box-shadow 0.2s;
            margin-bottom: 8px;
          "
          onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px #dbeafe';"
          onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';"
        />
        <p style="font-size: 0.75rem; color: #94a3b8; margin: 0 0 20px; line-height: 1.5;">
          Use the email registered with your school.
        </p>

        <p id="login-error" style="
          color: #f43f5e; font-size: 0.8125rem; margin-bottom: 12px;
          display: none; text-align: center;
        "></p>

        <button id="login-go" style="
          width: 100%; padding: 14px;
          background: #000C53; color: #FFE200;
          border: none; border-radius: 14px;
          font-weight: 600; font-size: 1rem; cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          font-family: inherit;
        "
        onmouseenter="this.style.background='#1a2980'; this.style.transform='translateY(-1px)';"
        onmouseleave="this.style.background='#000C53'; this.style.transform='translateY(0)';"
        onmousedown="this.style.transform='translateY(0)';"
        >
          Sign In
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const emailInput = overlay.querySelector('#login-email');
  const goBtn = overlay.querySelector('#login-go');
  const errorEl = overlay.querySelector('#login-error');

  goBtn.addEventListener('click', () => {
    const email = emailInput.value.trim().toLowerCase();
    errorEl.style.display = 'none';

    if (!email) {
      errorEl.textContent = 'Please enter your email address.';
      errorEl.style.display = 'block';
      return;
    }

    // Match against CSV teacher list (case-insensitive, cross-domain via prefix)
    const emailPrefix = email.split('@')[0];
    const teacher = teachers.find(t => t.email.toLowerCase() === email)
      || teachers.find(t => t.email.toLowerCase().split('@')[0] === emailPrefix);
    if (!teacher) {
      errorEl.textContent = 'Email not recognised. Please check with your administrator.';
      errorEl.style.display = 'block';
      emailInput.style.borderColor = '#f43f5e';
      emailInput.style.boxShadow = '0 0 0 3px #ffe4e6';
      return;
    }

    setCurrentUser(teacher);
    trackEvent('session', 'login', teacher.email, teacher.name || '');

    // Check if this is a first-time login (no preferred name set)
    if (!teacher.preferredName) {
      showNamePrompt(overlay, teacher, onComplete);
      return;
    }

    // Animate out
    animateOut(overlay, onComplete);
  });

  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goBtn.click();
  });

  // Reset styling on input
  emailInput.addEventListener('input', () => {
    errorEl.style.display = 'none';
    emailInput.style.borderColor = '#e2e8f0';
    emailInput.style.boxShadow = 'none';
  });

  setTimeout(() => emailInput.focus(), 300);
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}
