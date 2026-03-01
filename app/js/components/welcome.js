/*
 * Co-Cher Welcome Screen
 * ======================
 * Elegant onboarding with API key input.
 */

import { Store } from '../state.js';
import { validateApiKey, AVAILABLE_MODELS } from '../api.js';

export function renderWelcome(onComplete) {
  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.innerHTML = `
    <div class="welcome-card" id="welcome-card">
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
          Your AI-powered lesson design companion
        </p>
        <span style="
          display: inline-block; background: #eef2ff; color: #4338ca;
          padding: 5px 14px; border-radius: 999px; font-size: 0.8rem; font-weight: 500;
        ">Built for Singapore Educators</span>
      </div>

      <div id="welcome-step" style="text-align: left;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 6px; color: #334155;">
            Gemini API Key
          </label>
          <div style="position: relative;">
            <input
              type="password"
              id="welcome-key"
              placeholder="Enter your API key..."
              value="${Store.get('apiKey') || ''}"
              style="
                width: 100%; padding: 12px 44px 12px 14px;
                border: 1.5px solid #e2e8f0; border-radius: 12px;
                font-size: 0.9rem; font-family: inherit;
                outline: none; transition: border-color 0.2s, box-shadow 0.2s;
                background: #f8fafc; color: #0f172a; box-sizing: border-box;
              "
              onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px #dbeafe';"
              onblur="this.style.borderColor='#e2e8f0'; this.style.boxShadow='none';"
            />
            <button id="welcome-toggle-key" style="
              position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
              background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px;
              font-size: 0.75rem;
            " type="button">Show</button>
          </div>
          <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 8px; line-height: 1.5;">
            Get your free key from
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"
               style="color: #3b82f6; text-decoration: underline;">Google AI Studio</a>.
            Your key stays in your browser only.
          </p>
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display: block; font-weight: 600; font-size: 0.875rem; margin-bottom: 6px; color: #334155;">
            Model
          </label>
          <select id="welcome-model" style="
            width: 100%; padding: 10px 32px 10px 12px;
            border: 1.5px solid #e2e8f0; border-radius: 12px;
            font-size: 0.875rem; font-family: inherit;
            background: #f8fafc; color: #0f172a; outline: none;
            appearance: none; cursor: pointer; box-sizing: border-box;
            background-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%2764748b%27 stroke-width=%272%27%3E%3Cpath d=%27M6 9l6 6 6-6%27/%3E%3C/svg%3E');
            background-repeat: no-repeat; background-position: right 10px center;
          ">
            ${AVAILABLE_MODELS.map(m => `
              <option value="${m.id}" ${Store.get('model') === m.id ? 'selected' : ''}>
                ${m.label} — ${m.description}
              </option>
            `).join('')}
          </select>
        </div>

        <p id="welcome-error" style="
          color: #f43f5e; font-size: 0.8125rem; margin-bottom: 12px;
          display: none; text-align: center;
        "></p>

        <button id="welcome-start" style="
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
          Enter Co-Cher
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Toggle key visibility
  const keyInput = overlay.querySelector('#welcome-key');
  const toggleBtn = overlay.querySelector('#welcome-toggle-key');
  toggleBtn.addEventListener('click', () => {
    const isPassword = keyInput.type === 'password';
    keyInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
  });

  // Start button
  const startBtn = overlay.querySelector('#welcome-start');
  const errorEl = overlay.querySelector('#welcome-error');
  const modelSelect = overlay.querySelector('#welcome-model');

  startBtn.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!validateApiKey(key)) {
      errorEl.textContent = 'Please enter a valid API key (at least 20 characters).';
      errorEl.style.display = 'block';
      keyInput.style.borderColor = '#f43f5e';
      keyInput.style.boxShadow = '0 0 0 3px #ffe4e6';
      return;
    }

    Store.set('apiKey', key);
    Store.set('model', modelSelect.value);

    // Animate out
    const card = overlay.querySelector('#welcome-card');
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

  // Enter key
  keyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startBtn.click();
  });

  // Focus input
  setTimeout(() => keyInput.focus(), 300);
}

export function shouldShowWelcome() {
  return !Store.get('apiKey');
}
