/*
 * Co-Cher Settings
 * ================
 * API key, model selection, theme, and data management.
 */

import { Store } from '../state.js';
import { validateApiKey, AVAILABLE_MODELS } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modals.js';

export function render(container) {
  const apiKey = Store.get('apiKey') || '';
  const model = Store.get('model') || 'gemini-2.5-flash';
  const darkMode = Store.get('darkMode');

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width: 640px;">
        <div class="page-header">
          <div>
            <h1 class="page-title">Settings</h1>
            <p class="page-subtitle">Configure your Co-Cher experience.</p>
          </div>
        </div>

        <!-- API Key -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Gemini API Key</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Your API key is stored locally in your browser. It is never sent anywhere except directly to Google's Gemini API.
          </p>
          <div class="input-group" style="margin-bottom: var(--sp-4);">
            <div class="input-with-icon">
              <input class="input" type="password" id="settings-key" value="${apiKey}" placeholder="Enter your Gemini API key..." />
              <button class="input-icon-btn" id="toggle-key-visibility" type="button" style="font-size: 0.7rem;">Show</button>
            </div>
            <p class="input-hint" style="margin-top: var(--sp-2);">
              Get a free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color: var(--accent);">Google AI Studio</a>
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: var(--sp-2);">
            <div id="key-status" style="font-size: 0.8125rem;">
              ${apiKey ? `<span class="badge badge-green badge-dot">Key configured</span>` : `<span class="badge badge-amber badge-dot">No key set</span>`}
            </div>
          </div>
        </div>

        <!-- Model -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">AI Model</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Choose which Gemini model powers Co-Cher's responses.
          </p>
          <select class="input" id="settings-model">
            ${AVAILABLE_MODELS.map(m => `
              <option value="${m.id}" ${model === m.id ? 'selected' : ''}>
                ${m.label} — ${m.description}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Appearance -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Appearance</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Customize the visual theme.
          </p>
          <label class="toggle">
            <input type="checkbox" class="toggle-input" id="settings-dark" ${darkMode ? 'checked' : ''} />
            <span class="toggle-track"></span>
            <span class="toggle-label">Dark Mode</span>
          </label>
        </div>

        <!-- Data Management -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Data Management</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Export your data for backup or import from a previous export.
          </p>
          <div style="display: flex; gap: var(--sp-3); flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="export-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Data
            </button>
            <button class="btn btn-secondary btn-sm" id="import-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Import Data
            </button>
            <button class="btn btn-ghost btn-sm" id="clear-btn" style="color: var(--danger);">Clear All Data</button>
          </div>
          <input type="file" id="import-file" accept=".json" style="display: none;" />
        </div>

        <!-- Save Button -->
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" id="save-settings">Save Settings</button>
        </div>
      </div>
    </div>
  `;

  // Toggle key visibility
  const keyInput = container.querySelector('#settings-key');
  container.querySelector('#toggle-key-visibility').addEventListener('click', () => {
    const isPass = keyInput.type === 'password';
    keyInput.type = isPass ? 'text' : 'password';
    container.querySelector('#toggle-key-visibility').textContent = isPass ? 'Hide' : 'Show';
  });

  // Dark mode toggle
  container.querySelector('#settings-dark').addEventListener('change', (e) => {
    const dark = e.target.checked;
    Store.set('darkMode', dark);
    document.documentElement.classList.toggle('dark', dark);
  });

  // Save
  container.querySelector('#save-settings').addEventListener('click', () => {
    const newKey = keyInput.value.trim();
    const newModel = container.querySelector('#settings-model').value;

    if (newKey && !validateApiKey(newKey)) {
      showToast('API key seems too short. Please check it.', 'danger');
      return;
    }

    Store.set('apiKey', newKey);
    Store.set('model', newModel);
    showToast('Settings saved!', 'success');

    // Update key status
    const status = container.querySelector('#key-status');
    if (status) {
      status.innerHTML = newKey
        ? `<span class="badge badge-green badge-dot">Key configured</span>`
        : `<span class="badge badge-amber badge-dot">No key set</span>`;
    }
  });

  // Export
  container.querySelector('#export-btn').addEventListener('click', () => {
    const data = Store.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cocher-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!', 'success');
  });

  // Import
  const fileInput = container.querySelector('#import-file');
  container.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = Store.importData(reader.result);
      if (ok) {
        showToast('Data imported successfully!', 'success');
      } else {
        showToast('Failed to import data. Invalid file format.', 'danger');
      }
    };
    reader.readAsText(file);
  });

  // Clear
  container.querySelector('#clear-btn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Clear All Data',
      message: 'This will permanently delete all your classes, students, notes, and lesson data. Your API key will be kept. This cannot be undone.'
    });
    if (ok) {
      Store.clearAllData();
      showToast('All data cleared.', 'danger');
      render(container);
    }
  });
}
