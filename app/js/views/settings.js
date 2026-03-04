/*
 * Co-Cher Settings
 * ================
 * API key, model selection, theme, and data management.
 */

import { Store } from '../state.js';
import { validateApiKey, AVAILABLE_MODELS } from '../api.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modals.js';
import { getCurrentUser, clearCurrentUser } from '../components/login.js';

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

        <!-- Import Classes from CSV -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Import Classes from CSV</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Upload a .csv file to create a class with students. The CSV should have a header row. Accepted columns:
            <code style="background: var(--bg-subtle); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">Name</code> (required),
            <code style="background: var(--bg-subtle); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">CAIT</code>,
            <code style="background: var(--bg-subtle); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">CCI</code>,
            <code style="background: var(--bg-subtle); padding: 2px 4px; border-radius: 4px; font-size: 0.75rem;">CGC</code> (optional E21CC scores, 0-100).
          </p>
          <div style="display: flex; gap: var(--sp-3); align-items: center; flex-wrap: wrap;">
            <input class="input" type="text" id="csv-class-name" placeholder="Class name, e.g. 4A Pure Chemistry" style="flex: 1; min-width: 200px;" />
            <button class="btn btn-secondary btn-sm" id="csv-upload-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload CSV
            </button>
          </div>
          <input type="file" id="csv-file" accept=".csv,.txt" style="display: none;" />
          <div id="csv-preview" style="margin-top: var(--sp-3); display: none;">
            <p style="font-size: 0.8125rem; color: var(--ink-secondary); margin-bottom: var(--sp-2);" id="csv-preview-text"></p>
            <button class="btn btn-primary btn-sm" id="csv-confirm-btn">Confirm Import</button>
          </div>
          <p style="font-size: 0.75rem; color: var(--ink-faint); margin-top: var(--sp-2);">
            Tip: Export from Excel as CSV (UTF-8). One student per row.
          </p>
        </div>

        <!-- Clear Sample Data -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Sample Data</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            Co-Cher comes with sample classes and exemplar lessons so you can explore features. When you're ready to use your own data, clear the samples below.
          </p>
          <button class="btn btn-ghost btn-sm" id="clear-samples-btn" style="color: var(--warning);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Clear Sample Data &amp; Start Fresh
          </button>
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

        <!-- Account -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">Account</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-4); line-height: 1.5;">
            ${getCurrentUser() ? `Signed in as <strong style="color: var(--ink);">${getCurrentUser().name}</strong>` : 'Not signed in'}
          </p>
          <button class="btn btn-ghost btn-sm" id="sign-out-btn" style="color: var(--danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>

        <!-- About -->
        <div class="card" style="margin-bottom: var(--sp-6);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-1); color: var(--ink);">About Co-Cher</h3>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-3); line-height: 1.6;">
            <strong style="color: var(--ink);">Co-Cher</strong> \u2014 your co-teaching assistant. Designed for Singapore educators, Co-Cher supports lesson design, classroom enactment, assessment, admin operations, and professional growth in one place.
          </p>
          <p style="font-size: 0.8125rem; color: var(--ink-muted); margin-bottom: var(--sp-3); line-height: 1.6;">
            Grounded in the <strong style="color: var(--ink);">Singapore Teaching Practice</strong>, <strong style="color: var(--ink);">E21CC</strong>, and <strong style="color: var(--ink);">EdTech Masterplan 2030</strong>. Powered by Hattie\u2019s Visible Learning, Bloom\u2019s Taxonomy, GROW coaching, and Schraw & Dennison\u2019s metacognitive frameworks.
          </p>
          <p style="font-size: 0.75rem; color: var(--ink-faint); line-height: 1.5;">
            Created by <strong style="color: var(--ink-muted);">Harman Johll</strong><br />
            Built with care for the teaching fraternity.
          </p>
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

  // Sign out
  container.querySelector('#sign-out-btn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Sign Out',
      message: 'You will be returned to the login screen. Your data will not be deleted.'
    });
    if (ok) {
      clearCurrentUser();
      window.location.reload();
    }
  });

  // ── CSV Upload ──
  let csvParsedStudents = [];
  const csvFileInput = container.querySelector('#csv-file');
  container.querySelector('#csv-upload-btn').addEventListener('click', () => {
    const className = container.querySelector('#csv-class-name').value.trim();
    if (!className) {
      showToast('Please enter a class name first.', 'danger');
      return;
    }
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', () => {
    const file = csvFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      csvParsedStudents = parseCSV(reader.result);
      if (csvParsedStudents.length === 0) {
        showToast('No students found in CSV. Check the format.', 'danger');
        return;
      }
      const preview = container.querySelector('#csv-preview');
      const previewText = container.querySelector('#csv-preview-text');
      previewText.textContent = `Found ${csvParsedStudents.length} students: ${csvParsedStudents.slice(0, 5).map(s => s.name).join(', ')}${csvParsedStudents.length > 5 ? '...' : ''}`;
      preview.style.display = 'block';
    };
    reader.readAsText(file);
  });

  container.querySelector('#csv-confirm-btn').addEventListener('click', () => {
    const className = container.querySelector('#csv-class-name').value.trim();
    if (!className || csvParsedStudents.length === 0) return;
    const cls = Store.addClass({ name: className });
    csvParsedStudents.forEach(s => {
      Store.addStudent(cls.id, { name: s.name, e21cc: s.e21cc });
    });
    showToast(`Class "${className}" created with ${csvParsedStudents.length} students!`, 'success');
    csvParsedStudents = [];
    container.querySelector('#csv-preview').style.display = 'none';
    container.querySelector('#csv-class-name').value = '';
    csvFileInput.value = '';
  });

  // ── Clear Sample Data ──
  container.querySelector('#clear-samples-btn').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Clear Sample Data',
      message: 'This will remove all sample classes, students, and exemplar lessons. Your own data (if any) and API key will be kept. Ready to start fresh?'
    });
    if (ok) {
      Store.clearAllData();
      // Reset seed flags so they don't re-seed
      localStorage.setItem('cocher_seeded', '1');
      localStorage.setItem('cocher_pd_seeded', '1');
      localStorage.setItem('cocher_lessons_seeded', '1');
      showToast('Sample data cleared. You can now add your own classes!', 'success');
      render(container);
    }
  });
}

/* ── CSV Parser ── */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'student name' || h === 'student');
  if (nameIdx === -1) return [];

  const caitIdx = headers.findIndex(h => h === 'cait');
  const cciIdx = headers.findIndex(h => h === 'cci');
  const cgcIdx = headers.findIndex(h => h === 'cgc');

  const students = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = (cols[nameIdx] || '').trim();
    if (!name) continue;

    const e21cc = { cait: 50, cci: 50, cgc: 50 };
    if (caitIdx !== -1 && cols[caitIdx]) e21cc.cait = clampScore(cols[caitIdx]);
    if (cciIdx !== -1 && cols[cciIdx]) e21cc.cci = clampScore(cols[cciIdx]);
    if (cgcIdx !== -1 && cols[cgcIdx]) e21cc.cgc = clampScore(cols[cgcIdx]);

    students.push({ name, e21cc });
  }
  return students;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function clampScore(val) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}
