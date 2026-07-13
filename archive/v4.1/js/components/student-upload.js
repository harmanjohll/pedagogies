/*
 * Student List Upload Component
 * =============================
 * Drag-drop or click-to-upload for CSV/XLSX student lists.
 * Uses SheetJS (window.XLSX) for XLSX, falls back to manual CSV parse.
 * Returns parsed student array for use by Admin One-Stop tasks.
 */

/**
 * Parse a CSV string into rows of objects using flexible header matching.
 */
function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim().toLowerCase());

  // Flexible column matching
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'student name' || h === 'student' || h === 'full name');
  const classIdx = headers.findIndex(h => h === 'class' || h === 'form class' || h === 'form_class' || h === 'register class');
  const contactIdx = headers.findIndex(h => h === 'contact' || h === 'phone' || h === 'contact number' || h === 'mobile');
  const emergencyIdx = headers.findIndex(h => h.includes('emergency') || h.includes('parent') || h.includes('guardian'));
  const indexIdx = headers.findIndex(h => h === 'index' || h === 'register number' || h === 'reg no' || h === 'reg_no' || h === 's/n' || h === 'no' || h === 'no.');

  if (nameIdx === -1) return [];

  const students = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const name = (cols[nameIdx] || '').trim();
    if (!name) continue;

    students.push({
      index: indexIdx !== -1 ? (cols[indexIdx] || '').trim() : String(students.length + 1),
      name,
      class: classIdx !== -1 ? (cols[classIdx] || '').trim() : '',
      contact: contactIdx !== -1 ? (cols[contactIdx] || '').trim() : '',
      emergencyContact: emergencyIdx !== -1 ? (cols[emergencyIdx] || '').trim() : '',
    });
  }
  return students;
}

/** State-machine CSV line parser (handles quoted fields) */
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

/**
 * Parse an XLSX ArrayBuffer using SheetJS into student rows.
 */
function parseXLSX(arrayBuffer) {
  if (!window.XLSX) return [];
  const wb = window.XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const csv = window.XLSX.utils.sheet_to_csv(firstSheet);
  return parseCSVText(csv);
}

/**
 * Create a student upload zone (drag-drop + click).
 * @param {Object} options
 * @param {Function} options.onParsed - callback(students[]) after successful parse
 * @param {boolean} [options.compact=false] - smaller layout
 * @returns {{ el: HTMLElement, reset: Function, getStudents: Function }}
 */
export function createStudentUploadZone(options = {}) {
  const { onParsed, compact = false } = options;
  let students = [];

  const wrapper = document.createElement('div');

  function renderUploadState() {
    wrapper.innerHTML = `
      <div class="student-upload-zone" style="
        border: 2px dashed var(--border);
        border-radius: var(--radius-lg);
        padding: ${compact ? 'var(--sp-3)' : 'var(--sp-6)'};
        text-align: center;
        cursor: pointer;
        transition: border-color 0.2s, background 0.2s;
        background: var(--bg-subtle);
      ">
        <input type="file" accept=".csv,.xlsx,.xls" style="display:none;" class="student-file-input" />
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" style="margin-bottom:var(--sp-2);">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p style="font-size:0.8125rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-1);">
          Upload Student List
        </p>
        <p style="font-size:0.6875rem;color:var(--ink-faint);">
          Drag & drop a CSV or Excel file, or click to browse.<br/>
          Expected columns: Name, Class, Contact, Emergency Contact
        </p>
      </div>
    `;

    const zone = wrapper.querySelector('.student-upload-zone');
    const input = wrapper.querySelector('.student-file-input');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; zone.style.background = 'var(--accent-light)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = 'var(--border)'; zone.style.background = 'var(--bg-subtle)'; });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.borderColor = 'var(--border)';
      zone.style.background = 'var(--bg-subtle)';
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => { if (input.files.length) handleFile(input.files[0]); });
  }

  async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        students = parseXLSX(buf);
      } else {
        const text = await file.text();
        students = parseCSVText(text);
      }

      if (students.length === 0) {
        wrapper.innerHTML = `
          <div style="padding:var(--sp-4);background:var(--danger-light,#fef2f2);border-radius:var(--radius-lg);text-align:center;">
            <p style="font-size:0.8125rem;color:var(--danger);">Could not find student data. Ensure the file has a "Name" column.</p>
            <button class="btn btn-ghost btn-sm" style="margin-top:var(--sp-2);">Try Again</button>
          </div>
        `;
        wrapper.querySelector('button').addEventListener('click', () => { students = []; renderUploadState(); });
        return;
      }

      renderPreview(file.name);
      if (onParsed) onParsed(students);
    } catch (err) {
      wrapper.innerHTML = `
        <div style="padding:var(--sp-4);background:var(--danger-light,#fef2f2);border-radius:var(--radius-lg);text-align:center;">
          <p style="font-size:0.8125rem;color:var(--danger);">Error parsing file: ${err.message}</p>
          <button class="btn btn-ghost btn-sm" style="margin-top:var(--sp-2);">Try Again</button>
        </div>
      `;
      wrapper.querySelector('button').addEventListener('click', () => { students = []; renderUploadState(); });
    }
  }

  function renderPreview(filename) {
    const classes = [...new Set(students.map(s => s.class).filter(Boolean))].sort();
    const maxPreview = 10;
    const shown = students.slice(0, maxPreview);

    wrapper.innerHTML = `
      <div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-bottom:1px solid var(--border);">
          <div>
            <span style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${students.length} students loaded</span>
            <span style="font-size:0.6875rem;color:var(--ink-faint);margin-left:var(--sp-2);">from ${esc(filename)}</span>
            ${classes.length > 0 ? `<span style="font-size:0.6875rem;color:var(--ink-faint);margin-left:var(--sp-2);">| Classes: ${classes.join(', ')}</span>` : ''}
          </div>
          <button class="btn btn-ghost btn-sm student-upload-clear" style="font-size:0.6875rem;color:var(--danger);">Clear</button>
        </div>
        <div style="max-height:240px;overflow-y:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
            <thead>
              <tr style="background:var(--bg-subtle);">
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--ink-muted);font-weight:600;">S/N</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--ink-muted);font-weight:600;">Name</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--ink-muted);font-weight:600;">Class</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--ink-muted);font-weight:600;">Contact</th>
              </tr>
            </thead>
            <tbody>
              ${shown.map((s, i) => `
                <tr style="border-bottom:1px solid var(--border-light);">
                  <td style="padding:5px 10px;color:var(--ink-faint);">${i + 1}</td>
                  <td style="padding:5px 10px;color:var(--ink);">${esc(s.name)}</td>
                  <td style="padding:5px 10px;color:var(--ink-muted);">${esc(s.class)}</td>
                  <td style="padding:5px 10px;color:var(--ink-muted);">${esc(s.contact || s.emergencyContact || '—')}</td>
                </tr>
              `).join('')}
              ${students.length > maxPreview ? `
                <tr><td colspan="4" style="padding:6px 10px;color:var(--ink-faint);text-align:center;font-style:italic;">
                  ...and ${students.length - maxPreview} more
                </td></tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    wrapper.querySelector('.student-upload-clear').addEventListener('click', () => {
      students = [];
      renderUploadState();
      if (onParsed) onParsed([]);
    });
  }

  function reset() {
    students = [];
    renderUploadState();
  }

  function getStudents() {
    return students;
  }

  renderUploadState();
  return { el: wrapper, reset, getStudents };
}

/* ── Utility ── */
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
