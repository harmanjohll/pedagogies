/*
 * Staff Directory & Picker Component
 * ===================================
 * Loads staff from BTYTT timetable CSV and provides a multi-select picker modal.
 * Includes "All Staff" option, department filtering, search, select all/deselect all.
 */

import { openModal } from './modals.js';

const TT_CSV_URL = './btyrelief/BTYTT_2026Sem1_v1.csv';
const ALL_STAFF_EMAIL = 'BTYSS_all_staff@btyss.moe.edu.sg';

let _staffCache = null;

/**
 * Load the full staff directory from the timetable CSV.
 * Returns deduplicated array of { name, email, department }.
 */
export async function loadStaffDirectory() {
  if (_staffCache) return _staffCache;

  try {
    const res = await fetch(TT_CSV_URL);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { _staffCache = []; return _staffCache; }

    const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
    const deptIdx = headers.indexOf('DEPARTMENT');
    const nameIdx = headers.indexOf('NAME');
    const emailIdx = headers.findIndex(h => h === "Teacher's Email");

    if (nameIdx < 0 || emailIdx < 0) { _staffCache = []; return _staffCache; }

    const seen = new Set();
    _staffCache = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const email = (cols[emailIdx] || '').trim().toLowerCase();
      const name = (cols[nameIdx] || '').trim();
      const department = deptIdx >= 0 ? (cols[deptIdx] || '').trim() : '';

      if (name && email && email !== '0' && !seen.has(email)) {
        seen.add(email);
        _staffCache.push({ name, email, department });
      }
    }

    // Sort alphabetically
    _staffCache.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    _staffCache = [];
  }

  return _staffCache;
}

/**
 * Open a staff picker modal for selecting recipients.
 * @param {Object} opts
 * @param {Function} opts.onSelect - callback(selectedEmails[])
 * @param {boolean} [opts.multiSelect=true]
 * @param {string[]} [opts.preSelected=[]] - pre-selected emails
 * @param {boolean} [opts.showAllStaff=true] - show "All Staff" option
 */
export async function openStaffPicker(opts = {}) {
  const { onSelect, multiSelect = true, preSelected = [], showAllStaff = true } = opts;
  const staff = await loadStaffDirectory();
  const departments = [...new Set(staff.map(s => s.department).filter(Boolean))].sort();

  let selected = new Set(preSelected.map(e => e.toLowerCase()));
  let allStaffSelected = selected.has(ALL_STAFF_EMAIL.toLowerCase());
  let searchQuery = '';
  let activeDept = '';

  const { backdrop, close } = openModal({
    title: 'Select Recipients',
    width: 560,
    body: `<div id="staff-picker-content"></div>`,
    footer: `
      <div style="display:flex;align-items:center;gap:var(--sp-3);width:100%;">
        <span style="font-size:0.75rem;color:var(--ink-muted);flex:1;" id="sp-count">0 selected</span>
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="confirm">Confirm</button>
      </div>
    `
  });

  function renderContent() {
    const filtered = staff.filter(s => {
      if (activeDept && s.department !== activeDept) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.department.toLowerCase().includes(q);
      }
      return true;
    });

    const container = backdrop.querySelector('#staff-picker-content');
    container.innerHTML = `
      ${showAllStaff ? `
        <label style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3);background:${allStaffSelected ? 'var(--accent-light)' : 'var(--bg-subtle)'};border-radius:var(--radius-md);cursor:pointer;margin-bottom:var(--sp-3);border:1px solid ${allStaffSelected ? 'var(--accent)' : 'var(--border)'};">
          <input type="checkbox" class="sp-all-staff" ${allStaffSelected ? 'checked' : ''} />
          <div>
            <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">All Staff</div>
            <div style="font-size:0.6875rem;color:var(--ink-muted);">${ALL_STAFF_EMAIL}</div>
          </div>
        </label>
      ` : ''}

      <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-3);flex-wrap:wrap;align-items:center;">
        <input class="input sp-search" placeholder="Search by name, email, or department..." style="flex:1;min-width:200px;font-size:0.8125rem;padding:6px 10px;" value="${esc(searchQuery)}" />
        <button class="btn btn-ghost btn-sm sp-select-all" style="font-size:0.6875rem;">Select All</button>
        <button class="btn btn-ghost btn-sm sp-deselect-all" style="font-size:0.6875rem;">Deselect All</button>
      </div>

      ${departments.length > 1 ? `
        <div style="display:flex;gap:var(--sp-1);margin-bottom:var(--sp-3);flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm sp-dept-pill ${!activeDept ? 'active' : ''}" data-dept="" style="font-size:0.6875rem;${!activeDept ? 'background:var(--accent-light);color:var(--accent);' : ''}">All Depts</button>
          ${departments.map(d => `
            <button class="btn btn-ghost btn-sm sp-dept-pill ${activeDept === d ? 'active' : ''}" data-dept="${esc(d)}" style="font-size:0.6875rem;${activeDept === d ? 'background:var(--accent-light);color:var(--accent);' : ''}">${esc(d)}</button>
          `).join('')}
        </div>
      ` : ''}

      <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);">
        ${filtered.length === 0 ? `
          <div style="padding:var(--sp-6);text-align:center;color:var(--ink-faint);font-size:0.8125rem;">No staff found.</div>
        ` : filtered.map(s => `
          <label class="sp-staff-row" style="display:flex;align-items:center;gap:var(--sp-3);padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-light);transition:background 0.1s;${selected.has(s.email) ? 'background:var(--accent-light);' : ''}" data-email="${esc(s.email)}">
            <input type="checkbox" class="sp-staff-check" data-email="${esc(s.email)}" ${selected.has(s.email) ? 'checked' : ''} />
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.8125rem;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.name)}</div>
              <div style="font-size:0.6875rem;color:var(--ink-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.email)}</div>
            </div>
            <span style="font-size:0.625rem;color:var(--ink-faint);white-space:nowrap;">${esc(s.department)}</span>
          </label>
        `).join('')}
      </div>
    `;

    // Update count
    const countEl = backdrop.querySelector('#sp-count');
    const total = allStaffSelected ? staff.length : selected.size;
    countEl.textContent = allStaffSelected ? `All staff (${staff.length})` : `${total} selected`;

    // Wire events
    const searchInput = container.querySelector('.sp-search');
    searchInput.addEventListener('input', () => { searchQuery = searchInput.value; renderContent(); });
    // Focus search after render
    setTimeout(() => searchInput.focus(), 50);

    // All Staff toggle
    const allStaffCheck = container.querySelector('.sp-all-staff');
    if (allStaffCheck) {
      allStaffCheck.addEventListener('change', () => {
        allStaffSelected = allStaffCheck.checked;
        if (allStaffSelected) {
          selected.clear();
          selected.add(ALL_STAFF_EMAIL.toLowerCase());
        } else {
          selected.delete(ALL_STAFF_EMAIL.toLowerCase());
        }
        renderContent();
      });
    }

    // Individual checkboxes
    container.querySelectorAll('.sp-staff-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const email = cb.dataset.email;
        if (cb.checked) {
          selected.add(email);
        } else {
          selected.delete(email);
        }
        allStaffSelected = false;
        selected.delete(ALL_STAFF_EMAIL.toLowerCase());
        renderContent();
      });
    });

    // Select All / Deselect All
    container.querySelector('.sp-select-all')?.addEventListener('click', () => {
      filtered.forEach(s => selected.add(s.email));
      allStaffSelected = false;
      selected.delete(ALL_STAFF_EMAIL.toLowerCase());
      renderContent();
    });
    container.querySelector('.sp-deselect-all')?.addEventListener('click', () => {
      selected.clear();
      allStaffSelected = false;
      renderContent();
    });

    // Department pills
    container.querySelectorAll('.sp-dept-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        activeDept = pill.dataset.dept;
        renderContent();
      });
    });
  }

  renderContent();

  // Footer actions
  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    const result = allStaffSelected
      ? [ALL_STAFF_EMAIL]
      : [...selected].filter(e => e !== ALL_STAFF_EMAIL.toLowerCase());
    if (onSelect) onSelect(result);
    close();
  });
}

/**
 * Render selected emails as removable chips.
 * @param {string[]} emails
 * @param {Function} onRemove - callback(emailToRemove)
 * @param {Function} onAdd - callback() to open picker
 * @returns {string} HTML
 */
export function renderRecipientChips(emails, staffList) {
  if (!emails || emails.length === 0) return '';

  return emails.map(email => {
    const isAllStaff = email.toLowerCase() === ALL_STAFF_EMAIL.toLowerCase();
    const staff = staffList?.find(s => s.email === email);
    const label = isAllStaff ? 'All Staff' : (staff?.name || email);

    return `<span class="recipient-chip" data-email="${esc(email)}" style="
      display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
      background:${isAllStaff ? 'var(--accent-light)' : 'var(--bg-subtle)'};
      border:1px solid ${isAllStaff ? 'var(--accent)' : 'var(--border)'};
      border-radius:var(--radius-full);font-size:0.6875rem;color:var(--ink);
      white-space:nowrap;
    ">
      ${esc(label)}
      <button class="chip-remove" data-email="${esc(email)}" style="background:none;border:none;cursor:pointer;padding:0;color:var(--ink-faint);font-size:0.75rem;line-height:1;">&times;</button>
    </span>`;
  }).join('');
}

export { ALL_STAFF_EMAIL };

/* ── Utility ── */
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
