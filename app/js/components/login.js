/*
 * Co-Cher Login Screen
 * ====================
 * Simple name-based login against teachers.json
 */

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
        ">Welcome back</span>
      </div>

      <div style="text-align: left;">
        <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 6px; color: #334155;">
          Who are you?
        </label>
        <select id="login-teacher-select" style="
          width: 100%; padding: 12px 32px 12px 14px;
          border: 1.5px solid #e2e8f0; border-radius: 12px;
          font-size: 0.9rem; font-family: inherit;
          background: #f8fafc; color: #0f172a; outline: none;
          appearance: none; cursor: pointer; box-sizing: border-box;
          background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%2764748b%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E');
          background-repeat: no-repeat; background-position: right 10px center;
          margin-bottom: 24px;
        "
          onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px #dbeafe';"
          onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';"
        >
          <option value="" disabled selected>Select your name...</option>
          ${teachers.map((t, i) => `<option value="${i}">${t.name}</option>`).join('')}
        </select>

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
          Let's Go
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const select = overlay.querySelector('#login-teacher-select');
  const goBtn = overlay.querySelector('#login-go');
  const errorEl = overlay.querySelector('#login-error');

  goBtn.addEventListener('click', () => {
    const idx = select.value;
    if (idx === '' || idx === null) {
      errorEl.textContent = 'Please select your name.';
      errorEl.style.display = 'block';
      return;
    }

    const teacher = teachers[parseInt(idx, 10)];
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

  // Enter key on select
  select.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goBtn.click();
  });

  setTimeout(() => select.focus(), 300);
}

export function isLoggedIn() {
  return getCurrentUser() !== null;
}
