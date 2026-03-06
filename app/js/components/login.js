/*
 * Co-Cher Login Screen
 * ====================
 * Email-based login validated against teachers.json
 */

import { Store } from '../state.js';

const TEACHERS_URL = './data/teachers.json';

let _teachersList = null;

async function loadTeachers() {
  if (_teachersList) return _teachersList;
  try {
    const res = await fetch(TEACHERS_URL);
    _teachersList = await res.json();
  } catch {
    _teachersList = [];
  }
  return _teachersList;
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('cocher_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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

export async function renderLogin(onComplete) {
  const teachers = await loadTeachers();

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
        <h1 style="font-size: 2rem; font-weight: 700; color: #000C53; margin: 0 0 6px; letter-spacing: -0.02em;">
          Co-Cher
        </h1>
        <p style="color: #64748b; font-size: 0.9375rem; margin: 0 0 16px;">
          Your Co-Teaching Assistant
        </p>
        <span style="
          display: inline-block; background: #eef2ff; color: #4338ca;
          padding: 5px 14px; border-radius: 999px; font-size: 0.8rem; font-weight: 500;
        ">Built for Singapore Educators</span>
      </div>

      <div style="text-align: left;">
        <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 6px; color: #334155;">
          Email
        </label>
        <input
          type="email"
          id="login-email"
          placeholder="e.g. name@schools.gov.sg"
          autocomplete="email"
          style="
            width: 100%; padding: 12px 14px;
            border: 1.5px solid #e2e8f0; border-radius: 12px;
            font-size: 0.9rem; font-family: inherit;
            background: #f8fafc; color: #0f172a; outline: none;
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

    // Match against teachers list (case-insensitive, cross-domain via prefix)
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

    // Animate out
    const card = overlay.querySelector('#login-card');
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.96)';

    overlay.style.transition = 'opacity 0.4s';
    setTimeout(() => { overlay.style.opacity = '0'; }, 150);
    setTimeout(() => {
      overlay.remove();
      onComplete();
    }, 500);
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
