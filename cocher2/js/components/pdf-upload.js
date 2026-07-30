/*
 * Co-Cher PDF & File Upload Component
 * ====================================
 * Reusable drag-drop + browse upload widget with PDF page-range extraction.
 * Supports .txt, .md, .csv, .pdf files.
 *
 * Usage:
 *   import { createFileUploadZone } from '../components/pdf-upload.js';
 *
 *   const zone = createFileUploadZone({
 *     onContent: (text, meta) => { ... },  // Called when content is ready
 *     compact: false,                       // Optional: smaller variant
 *   });
 *   someElement.appendChild(zone.el);
 *
 * The `meta` object contains:
 *   { filename, isPdf, totalPages, pageRange: { from, to }, extractedPages }
 */

import { showToast } from './toast.js';

const ACCEPTED_TYPES = '.txt,.md,.csv,.text,.pdf';

const UPLOAD_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" style="margin:0 auto var(--sp-2);display:block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

const PDF_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-2h2a1 1 0 1 0 0-2H9v6"/></svg>`;

/**
 * Extract text from specific pages of a PDF file using pdf.js
 */
async function extractPdfText(arrayBuffer, fromPage = 1, toPage = null) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF.js library not loaded. Please refresh the page.');
  }

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const end = Math.min(toPage || totalPages, totalPages);
  const start = Math.max(1, Math.min(fromPage, end));

  const pages = [];
  for (let i = start; i <= end; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    pages.push({ page: i, text: pageText });
  }

  const fullText = pages.map(p => p.text).join('\n\n');

  return { text: fullText, totalPages, extractedFrom: start, extractedTo: end, pages };
}

/**
 * Create the page-range selector UI (shown after PDF is loaded)
 */
function renderPageRangeUI(totalPages, onExtract) {
  const wrapper = document.createElement('div');
  wrapper.className = 'pdf-page-range';
  wrapper.innerHTML = `
    <div style="background:var(--bg-subtle,#f8f9fa);border:1px solid var(--border,#e2e5ea);border-radius:var(--radius-md,8px);padding:12px 16px;margin-top:8px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        ${PDF_ICON}
        <span style="font-size:0.8125rem;font-weight:600;color:var(--ink);">PDF loaded — ${totalPages} page${totalPages !== 1 ? 's' : ''}</span>
      </div>

      <div style="margin-bottom:10px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;color:var(--ink-secondary);cursor:pointer;margin-bottom:4px;">
          <input type="radio" name="pdf-range-mode" value="all" checked style="margin:0;" />
          Extract all pages (1–${totalPages})
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;color:var(--ink-secondary);cursor:pointer;">
          <input type="radio" name="pdf-range-mode" value="range" style="margin:0;" />
          Select page range
        </label>
      </div>

      <div id="pdf-range-inputs" style="display:none;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.75rem;color:var(--ink-muted);">Pages</span>
          <input type="number" id="pdf-from" min="1" max="${totalPages}" value="1"
            style="width:64px;padding:4px 8px;border:1px solid var(--border,#e2e5ea);border-radius:6px;font-size:0.8125rem;text-align:center;" />
          <span style="font-size:0.75rem;color:var(--ink-muted);">to</span>
          <input type="number" id="pdf-to" min="1" max="${totalPages}" value="${totalPages}"
            style="width:64px;padding:4px 8px;border:1px solid var(--border,#e2e5ea);border-radius:6px;font-size:0.8125rem;text-align:center;" />
          <span id="pdf-range-info" style="font-size:0.6875rem;color:var(--ink-faint);">(${totalPages} pages)</span>
        </div>
      </div>

      <button id="pdf-extract-btn" style="
        display:inline-flex;align-items:center;gap:6px;
        background:#4361ee;color:#fff;border:none;
        padding:7px 18px;border-radius:6px;font-size:0.8125rem;font-weight:600;
        cursor:pointer;transition:background 0.15s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Extract Text
      </button>
      <div id="pdf-extracting" style="display:none;font-size:0.8125rem;color:var(--ink-muted);margin-top:6px;">
        <span style="display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:#4361ee;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:-2px;margin-right:6px;"></span>
        Extracting text...
      </div>
    </div>
  `;

  // Wire radio toggle
  const radios = wrapper.querySelectorAll('input[name="pdf-range-mode"]');
  const rangeInputs = wrapper.querySelector('#pdf-range-inputs');
  const fromInput = wrapper.querySelector('#pdf-from');
  const toInput = wrapper.querySelector('#pdf-to');
  const infoEl = wrapper.querySelector('#pdf-range-info');

  radios.forEach(r => r.addEventListener('change', () => {
    rangeInputs.style.display = r.value === 'range' && r.checked ? 'block' : 'none';
  }));

  // Update info text on range change
  function updateInfo() {
    const from = parseInt(fromInput.value) || 1;
    const to = parseInt(toInput.value) || totalPages;
    const count = Math.max(0, to - from + 1);
    infoEl.textContent = `(${count} page${count !== 1 ? 's' : ''})`;
  }
  fromInput.addEventListener('input', updateInfo);
  toInput.addEventListener('input', updateInfo);

  // Extract button
  const extractBtn = wrapper.querySelector('#pdf-extract-btn');
  const extractingEl = wrapper.querySelector('#pdf-extracting');

  extractBtn.addEventListener('click', () => {
    const mode = wrapper.querySelector('input[name="pdf-range-mode"]:checked').value;
    let from = 1, to = totalPages;
    if (mode === 'range') {
      from = parseInt(fromInput.value) || 1;
      to = parseInt(toInput.value) || totalPages;
      if (from > to) { showToast('Start page must be before end page.', 'danger'); return; }
      if (from < 1 || to > totalPages) { showToast(`Page range must be 1–${totalPages}.`, 'danger'); return; }
    }
    extractBtn.style.display = 'none';
    extractingEl.style.display = 'block';
    onExtract(from, to);
  });

  return wrapper;
}

/**
 * Create a reusable file upload zone element.
 *
 * Options:
 *   onContent(text, meta) — called with extracted text + metadata
 *   compact — if true, use a smaller layout
 *   placeholder — custom placeholder text
 */
export function createFileUploadZone({ onContent, compact = false, placeholder = null }) {
  const el = document.createElement('div');
  el.className = 'file-upload-zone';

  const dropText = placeholder || 'Drop file here or click to browse';
  const supportText = 'Supports .txt, .md, .csv, .pdf';

  el.innerHTML = `
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
      .file-upload-drop {
        border: 2px dashed var(--border, #e2e5ea);
        border-radius: var(--radius-lg, 10px);
        padding: ${compact ? 'var(--sp-4, 16px)' : 'var(--sp-6, 24px)'};
        text-align: center;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
      }
      .file-upload-drop:hover, .file-upload-drop.dragover {
        border-color: var(--accent, #4361ee);
        background: var(--accent-light, rgba(67,97,238,0.04));
      }
      .file-upload-drop.has-file {
        border-style: solid;
        border-color: var(--success, #06d6a0);
        background: rgba(6,214,160,0.04);
      }
    </style>

    <div class="file-upload-drop" id="fu-drop">
      ${compact ? '' : UPLOAD_ICON}
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:2px;">${dropText}</p>
      <p style="font-size:0.6875rem;color:var(--ink-faint);" id="fu-status">${supportText}</p>
      <input type="file" id="fu-input" accept="${ACCEPTED_TYPES}" style="display:none;" />
    </div>
    <div id="fu-pdf-range"></div>
  `;

  const dropZone = el.querySelector('#fu-drop');
  const fileInput = el.querySelector('#fu-input');
  const statusEl = el.querySelector('#fu-status');
  const pdfRangeContainer = el.querySelector('#fu-pdf-range');

  let pdfArrayBuffer = null;
  let currentFilename = '';

  // Drag & drop
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) processFile(fileInput.files[0]);
  });

  function processFile(file) {
    currentFilename = file.name;
    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      statusEl.textContent = `Loading ${file.name}...`;
      dropZone.classList.add('has-file');

      const reader = new FileReader();
      reader.onload = async () => {
        pdfArrayBuffer = reader.result;

        try {
          // Quick load to get page count
          const pdfjsLib = window.pdfjsLib;
          if (!pdfjsLib) {
            showToast('PDF.js not loaded yet. Please wait a moment and try again.', 'danger');
            return;
          }
          const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer.slice(0) }).promise;
          const totalPages = pdf.numPages;

          statusEl.textContent = `${file.name} — ${totalPages} pages`;
          pdfRangeContainer.innerHTML = '';

          const rangeUI = renderPageRangeUI(totalPages, async (from, to) => {
            try {
              const result = await extractPdfText(pdfArrayBuffer.slice(0), from, to);
              showToast(`Extracted ${result.extractedTo - result.extractedFrom + 1} pages`, 'success');

              onContent(result.text, {
                filename: file.name,
                isPdf: true,
                totalPages: result.totalPages,
                pageRange: { from: result.extractedFrom, to: result.extractedTo },
                extractedPages: result.extractedTo - result.extractedFrom + 1
              });
            } catch (err) {
              console.error('PDF extraction error:', err);
              showToast('Failed to extract PDF text: ' + err.message, 'danger');
              pdfRangeContainer.querySelector('#pdf-extract-btn').style.display = '';
              pdfRangeContainer.querySelector('#pdf-extracting').style.display = 'none';
            }
          });
          pdfRangeContainer.appendChild(rangeUI);

        } catch (err) {
          console.error('PDF load error:', err);
          showToast('Failed to load PDF: ' + err.message, 'danger');
          statusEl.textContent = supportText;
          dropZone.classList.remove('has-file');
        }
      };
      reader.readAsArrayBuffer(file);

    } else {
      // Plain text file
      pdfRangeContainer.innerHTML = '';
      pdfArrayBuffer = null;
      statusEl.textContent = `Loaded: ${file.name}`;
      dropZone.classList.add('has-file');

      const reader = new FileReader();
      reader.onload = () => {
        onContent(reader.result, {
          filename: file.name,
          isPdf: false,
          totalPages: null,
          pageRange: null,
          extractedPages: null
        });
      };
      reader.readAsText(file);
    }
  }

  return {
    el,
    reset() {
      pdfArrayBuffer = null;
      currentFilename = '';
      pdfRangeContainer.innerHTML = '';
      dropZone.classList.remove('has-file');
      statusEl.textContent = supportText;
      fileInput.value = '';
    }
  };
}
