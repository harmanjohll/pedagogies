/*
 * Co-Cher 2 Login Screen
 * ======================
 * Email-based sign-in, resolved to a SCHOOL by email domain.
 *
 * Co-Cher 1 gated sign-in on Beatty's staff timetable CSV: your email had to
 * appear in that file or you could not get in, and a failed fetch left the
 * allowlist empty so EVERY login failed. That is the single thing this version
 * had to fix — a teacher from any school must be able to sign in.
 *
 * Now: the email's domain is matched against schools/registry.json. Known
 * domain → straight in, with the school recorded on the user. Unknown domain →
 * the teacher picks their school from a list (or continues without one). The
 * registry never gates entry; it only says which school you belong to.
 */

import { Store } from '../state.js';
import { trackEvent } from '../utils/analytics.js';
import { schoolForEmail, listSchools, resetSchoolCache } from '../utils/school.js';
import { seedDemoTimetable } from '../utils/demo-timetables.js';

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('cocher2_current_user');
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
  localStorage.setItem('cocher2_current_user', JSON.stringify(user));
}

export function clearCurrentUser() {
  resetSchoolCache();
  // Everything derived from the old school goes with it: the next teacher must
  // not inherit the last one's levels, subjects or colleague list. Imported
  // dynamically because both of those modules import THIS one to find out who
  // is signed in — a static import here would close the cycle.
  import('../utils/vocabulary.js').then(m => m.resetVocabulary()).catch(() => {});
  import('../utils/directory.js').then(m => m.resetDirectory()).catch(() => {});
  // ORDER MATTERS. Clearing the key persists the store, and persisting AFTER
  // the user is gone writes this school's entire blob into the school-less one
  // — which the next teacher's school then inherits as "legacy" data. Clear it
  // while still signed in, so the write lands in this school's own store.
  Store.set('apiKey', '');
  localStorage.removeItem('cocher2_api_key');
  localStorage.removeItem('cocher2_current_user');
  // And drop this school's data from memory, so nothing on the way out can be
  // written into the next school's store either.
  Store.rehydrate?.();
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
  const guessed = guessFirstName(teacher.name || teacher.email.split('@')[0].replace(/[._]+/g, ' '));
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
          background: linear-gradient(135deg, #16323A, #26d0ce);
          border-radius: 14px; margin: 0 auto 16px;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 1.1rem;
          box-shadow: 0 4px 16px rgba(0,12,83,0.2);
        ">${guessed.charAt(0)}</div>
        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--ink, #16323A); margin: 0 0 6px;">
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
          background: #16323A; color: #F2B441;
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

  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.innerHTML = `
    <div class="welcome-card" id="login-card">
      <div style="margin-bottom: 28px;">
        <div style="
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #16323A, #26d0ce);
          border-radius: 16px; margin: 0 auto 20px;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 1.25rem;
          box-shadow: 0 4px 16px rgba(0,12,83,0.3);
        ">C</div>
        <h1 style="font-size: 2rem; font-weight: 700; color: var(--ink, #16323A); margin: 0 0 6px; letter-spacing: -0.02em;">
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
          placeholder="e.g. name@yourschool.moe.edu.sg"
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
          Your school is recognised from your email address.
        </p>

        <p id="login-error" style="
          color: #f43f5e; font-size: 0.8125rem; margin-bottom: 12px;
          display: none; text-align: center;
        "></p>

        <button id="login-go" style="
          width: 100%; padding: 14px;
          background: #16323A; color: #F2B441;
          border: none; border-radius: 14px;
          font-weight: 600; font-size: 1rem; cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          font-family: inherit;
        "
        onmouseenter="this.style.background='#1a2980'; this.style.transform='translateY(-1px)';"
        onmouseleave="this.style.background='#16323A'; this.style.transform='translateY(0)';"
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

  goBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim().toLowerCase();
    errorEl.style.display = 'none';

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      errorEl.textContent = 'Please enter a valid email address.';
      errorEl.style.display = 'block';
      return;
    }

    // The domain decides the school. An unknown domain is NOT a rejection —
    // the teacher simply tells us which school they're from.
    goBtn.disabled = true;
    const match = await schoolForEmail(email);
    goBtn.disabled = false;

    if (!match) { showSchoolPicker(overlay, email, onComplete); return; }
    signIn(overlay, { email, schoolId: match.id, schoolName: match.name }, onComplete);
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

/* Persist the user and move on to naming. */
async function signIn(overlay, user, onComplete) {
  setCurrentUser(user);
  // Demo accounts get their timetable once, here. AWAITED: this used to be
  // fire-and-forget under a comment promising it ran before the app painted,
  // which it did not — open My Timetable fast enough and the seed had not
  // landed, so the page said "No timetable yet" and never corrected itself.
  // Real teachers import their own; this is a no-op for them and costs nothing.
  await seedDemoTimetable(user.email).catch(() => false);
  trackEvent('session', 'login', user.email, user.schoolName || '');
  showNamePrompt(overlay, user, onComplete);
}

/**
 * Unknown email domain — ask which school, rather than turning the teacher
 * away. "Not listed" is a first-class option: Co-Cher still works without a
 * school pack, just without school-specific calendar/levels/frameworks.
 */
async function showSchoolPicker(overlay, email, onComplete) {
  const schools = await listSchools();
  const card = overlay.querySelector('#login-card');
  card.innerHTML = `
    <div style="text-align:left;">
      <h2 style="font-size:1.25rem;font-weight:700;color:var(--ink,#16323A);margin:0 0 6px;">Which school are you at?</h2>
      <p style="color:var(--ink-muted,#64748b);font-size:0.875rem;margin:0 0 18px;line-height:1.5;">
        We don't recognise <strong>${email.split('@')[1]}</strong> yet. Pick your school so Co-Cher uses the right
        calendar, levels and frameworks.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
        ${schools.map(s => `<button class="sch-opt" data-id="${s.id}" data-name="${s.name}" style="
          width:100%;padding:13px 14px;text-align:left;border:1.5px solid #e2e8f0;border-radius:12px;
          background:var(--bg-subtle,#f8fafc);font-family:inherit;font-size:0.9rem;font-weight:600;
          color:var(--ink,#0f172a);cursor:pointer;min-height:48px;">${s.name}</button>`).join('')}
        <button class="sch-opt" data-id="" data-name="" style="
          width:100%;padding:13px 14px;text-align:left;border:1.5px dashed #cbd5e1;border-radius:12px;
          background:transparent;font-family:inherit;font-size:0.9rem;color:var(--ink-muted,#64748b);
          cursor:pointer;min-height:48px;">My school isn't listed &mdash; continue anyway</button>
      </div>
    </div>`;
  card.querySelectorAll('.sch-opt').forEach(b => b.addEventListener('click', () => {
    signIn(overlay, { email, schoolId: b.dataset.id || null, schoolName: b.dataset.name || '' }, onComplete);
  }));
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}
