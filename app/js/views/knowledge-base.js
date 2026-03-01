/*
 * Co-Cher Knowledge Base
 * ======================
 * Searchable framework reference for E21CC, STP, and EdTech Masterplan 2030.
 * Teachers can upload their own curriculum documents and resources.
 */

import { Store, generateId } from '../state.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modals.js';

const FRAMEWORKS = [
  {
    id: 'e21cc',
    title: 'E21CC Framework',
    subtitle: '21st Century Competencies',
    accent: 'var(--e21cc-cait)',
    accentLight: 'var(--e21cc-cait-light)',
    icon: 'E21',
    tags: [
      { label: 'CAIT', badge: 'badge-blue' },
      { label: 'CCI', badge: 'badge-green' },
      { label: 'CGC', badge: 'badge-amber' },
    ],
    overview: 'The Enhanced 21st Century Competencies (E21CC) framework, updated in 2021, guides holistic student development across three domains: Critical, Adaptive & Inventive Thinking (CAIT), Communication, Collaboration & Information (CCI), and Civic, Global & Cross-cultural Literacy (CGC).',
    sections: [
      {
        heading: 'CAIT — Critical, Adaptive & Inventive Thinking',
        items: [
          { term: 'Sound Reasoning', desc: 'Examine issues logically and from multiple perspectives, draw well-reasoned conclusions.' },
          { term: 'Creative Problem-Solving', desc: 'Generate novel ideas, make connections, and explore innovative solutions.' },
          { term: 'Managing Complexity & Ambiguity', desc: 'Navigate uncertain, complex problems without clear-cut answers.' },
          { term: 'Metacognition', desc: 'Monitor one\'s own thinking, self-regulate, and transfer learning to new contexts.' },
        ]
      },
      {
        heading: 'CCI — Communication, Collaboration & Information',
        items: [
          { term: 'Communicative Competence', desc: 'Express ideas clearly and persuasively across modes and contexts.' },
          { term: 'Collaborative Skills', desc: 'Work effectively in teams, co-create meaning, and navigate social dynamics.' },
          { term: 'Information Literacy', desc: 'Find, evaluate, and use information critically and ethically.' },
        ]
      },
      {
        heading: 'CGC — Civic, Global & Cross-cultural Literacy',
        items: [
          { term: 'Active Citizenship', desc: 'Contribute responsibly to community and nation; understand governance and rights.' },
          { term: 'Global Awareness', desc: 'Appreciate interconnectedness, sustainability, and global challenges.' },
          { term: 'Cross-cultural Sensitivity', desc: 'Respect diversity, navigate cultural differences, and bridge divides.' },
        ]
      },
      {
        heading: 'Core Values & SEL',
        items: [
          { term: 'Core Values', desc: 'Respect, Responsibility, Resilience, Integrity, Care, Harmony — the moral compass underlying all competencies.' },
          { term: 'SEL Competencies', desc: 'Self-awareness, self-management, social awareness, relationship management, and responsible decision-making.' },
        ]
      }
    ]
  },
  {
    id: 'stp',
    title: 'Singapore Teaching Practice',
    subtitle: 'Pedagogical Excellence',
    accent: 'var(--e21cc-cci)',
    accentLight: 'var(--e21cc-cci-light)',
    icon: 'STP',
    tags: [
      { label: 'Pedagogy', badge: 'badge-green' },
      { label: 'Assessment', badge: 'badge-green' },
      { label: 'Positive Culture', badge: 'badge-green' },
    ],
    overview: 'The Singapore Teaching Practice (STP) is an integrated model of the knowledge bases, skills, and professional values that underpin effective teaching. It guides teachers in creating positive learning experiences across four areas of practice.',
    sections: [
      {
        heading: 'Area 1: Lesson Preparation',
        items: [
          { term: 'Understanding Learners', desc: 'Know students\' readiness, interests, backgrounds, and learning profiles to plan inclusive lessons.' },
          { term: 'Clear Learning Objectives', desc: 'Define outcomes aligned to syllabi, E21CC, and relevant assessment criteria.' },
          { term: 'Resource & Material Planning', desc: 'Select or create resources that scaffold learning and engage multiple modalities.' },
        ]
      },
      {
        heading: 'Area 2: Lesson Enactment',
        items: [
          { term: 'Teaching Actions', desc: 'Direct instruction, inquiry-based learning, discussion, modelling — selecting the right approach for the outcome.' },
          { term: 'Interaction Patterns', desc: 'Managing teacher\u2013student and student\u2013student interactions; think-pair-share, jigsaw, Socratic dialogue.' },
          { term: 'Classroom Discourse', desc: 'Questioning techniques that promote higher-order thinking; productive talk moves.' },
        ]
      },
      {
        heading: 'Area 3: Monitoring & Feedback',
        items: [
          { term: 'Formative Assessment', desc: 'Check for understanding in real time \u2014 exit tickets, concept checks, mini-whiteboards.' },
          { term: 'Effective Feedback', desc: 'Timely, specific, actionable feedback that helps students close the gap between current and desired performance.' },
          { term: 'Differentiated Support', desc: 'Adjust instruction based on assessment data; provide scaffolds or extensions as needed.' },
        ]
      },
      {
        heading: 'Area 4: Positive Learning Culture',
        items: [
          { term: 'Safe & Supportive Environment', desc: 'Build trust, belonging, and psychological safety so students can take intellectual risks.' },
          { term: 'Routines & Expectations', desc: 'Establish clear, consistent classroom norms that maximise learning time.' },
          { term: 'Student Agency', desc: 'Empower students to take ownership of their learning through choice, reflection, and self-assessment.' },
        ]
      }
    ]
  },
  {
    id: 'edtech',
    title: 'EdTech Masterplan 2030',
    subtitle: 'Technology-Enhanced Learning',
    accent: 'var(--e21cc-cgc)',
    accentLight: 'var(--e21cc-cgc-light)',
    icon: 'EdT',
    tags: [
      { label: 'Digital Literacy', badge: 'badge-amber' },
      { label: 'Digital Creation', badge: 'badge-amber' },
      { label: 'Digital Citizenship', badge: 'badge-amber' },
    ],
    overview: 'Singapore\'s EdTech Masterplan 2030 envisions technology as an enabler for deepening learning, personalising education, and developing digital competencies. It rests on three thrusts with nine digital competencies.',
    sections: [
      {
        heading: 'Thrust 1: Digital Literacy',
        items: [
          { term: 'Data Literacy', desc: 'Read, analyse, and draw conclusions from data; understand data visualisations.' },
          { term: 'Information & Media Literacy', desc: 'Evaluate online sources critically; identify bias, misinformation, and deepfakes.' },
          { term: 'Digital Communication', desc: 'Communicate effectively using digital tools; understand digital etiquette.' },
        ]
      },
      {
        heading: 'Thrust 2: Digital Creation',
        items: [
          { term: 'Computational Thinking', desc: 'Decompose problems, recognise patterns, design algorithms, and abstract solutions.' },
          { term: 'Digital Design', desc: 'Create digital artefacts \u2014 presentations, videos, apps, simulations \u2014 purposefully.' },
          { term: 'AI Literacy', desc: 'Understand how AI works, its capabilities and limitations, and use it responsibly.' },
        ]
      },
      {
        heading: 'Thrust 3: Digital Citizenship',
        items: [
          { term: 'Online Safety', desc: 'Protect personal data, recognise cybersecurity threats, and practise safe online behaviour.' },
          { term: 'Digital Ethics', desc: 'Understand copyright, intellectual property, and the ethical implications of technology.' },
          { term: 'Digital Wellbeing', desc: 'Manage screen time, maintain healthy tech habits, and balance online and offline life.' },
        ]
      },
      {
        heading: 'Classroom Integration',
        items: [
          { term: 'TPACK Model', desc: 'Integrate Technological, Pedagogical, and Content Knowledge to design tech-enhanced lessons.' },
          { term: 'Blended Learning', desc: 'Combine in-person and online learning modes; SLS (Student Learning Space) as the national platform.' },
          { term: 'AI-Enhanced Pedagogy', desc: 'Use AI tools for personalised feedback, adaptive pathways, and reducing administrative burden.' },
        ]
      }
    ]
  }
];

/* ── Category options for uploads ── */
const UPLOAD_CATEGORIES = [
  'Curriculum / Syllabus',
  'Scheme of Work',
  'Exam Paper / Assessment',
  'Topic Guide',
  'Pedagogical Resource',
  'Department Policy',
  'Other'
];

export function render(container) {
  const uploads = Store.get('knowledgeUploads') || [];

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header">
          <div>
            <h1 class="page-title">Knowledge Base</h1>
            <p class="page-subtitle">MOE frameworks, pedagogical references, and your uploaded resources.</p>
          </div>
          <div style="display:flex;gap:var(--sp-2);align-items:center;">
            <div style="max-width:240px;width:100%;">
              <input class="input" id="kb-search" placeholder="Search all resources..." />
            </div>
            <button class="btn btn-primary btn-sm" id="upload-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload
            </button>
          </div>
        </div>

        <!-- Built-in Frameworks -->
        <div style="margin-bottom:var(--sp-6);">
          <div class="section-header">
            <span class="section-title">MOE Frameworks</span>
          </div>
          <div class="grid-3 stagger" id="framework-cards"></div>
        </div>

        <!-- Uploaded Resources -->
        <div style="margin-bottom:var(--sp-6);" id="uploads-section">
          <div class="section-header">
            <span class="section-title">Your Resources</span>
            <span class="badge badge-blue badge-dot">${uploads.length} file${uploads.length !== 1 ? 's' : ''}</span>
          </div>
          <div id="uploads-list"></div>
        </div>

        <div id="framework-detail" style="margin-top:var(--sp-6);"></div>
      </div>
    </div>
  `;

  const cardsEl = container.querySelector('#framework-cards');
  const detailEl = container.querySelector('#framework-detail');
  const searchInput = container.querySelector('#kb-search');
  const uploadsEl = container.querySelector('#uploads-list');

  renderCards(cardsEl);
  renderUploads(uploadsEl, uploads, detailEl);

  cardsEl.addEventListener('click', e => {
    const card = e.target.closest('[data-fw]');
    if (!card) return;
    const fw = FRAMEWORKS.find(f => f.id === card.dataset.fw);
    if (fw) renderDetail(detailEl, fw, cardsEl);
  });

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
      renderCards(cardsEl);
      renderUploads(uploadsEl, uploads, detailEl);
      detailEl.innerHTML = '';
      return;
    }
    renderSearchResults(detailEl, q, uploads);
  });

  container.querySelector('#upload-btn').addEventListener('click', () => showUploadModal(container));
}

function renderCards(el) {
  el.innerHTML = FRAMEWORKS.map(fw => `
    <div class="card card-hover card-interactive" data-fw="${fw.id}" style="border-top:3px solid ${fw.accent};">
      <div style="width:44px;height:44px;margin-bottom:var(--sp-4);background:${fw.accentLight};border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;color:${fw.accent};font-weight:700;font-size:0.8rem;">${fw.icon}</div>
      <h3 style="font-size:1rem;font-weight:600;margin-bottom:var(--sp-1);">${fw.title}</h3>
      <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">${fw.subtitle}</p>
      <p style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.6;margin-bottom:var(--sp-4);">${fw.overview.slice(0, 120)}...</p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--sp-1);">
        ${fw.tags.map(t => `<span class="badge ${t.badge}">${t.label}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

/* ── Uploaded resources list ── */
function renderUploads(el, uploads, detailEl) {
  if (uploads.length === 0) {
    el.innerHTML = `
      <div class="card" style="text-align:center;padding:var(--sp-8);border:2px dashed var(--border);background:transparent;box-shadow:none;">
        <div style="color:var(--ink-faint);margin-bottom:var(--sp-2);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto;display:block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <p style="font-size:0.875rem;color:var(--ink-muted);margin-bottom:var(--sp-1);">No resources uploaded yet</p>
        <p style="font-size:0.75rem;color:var(--ink-faint);">Upload syllabi, topic guides, schemes of work, or any teaching resource.</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
      ${uploads.map(u => `
        <div class="card card-hover" style="padding:var(--sp-4);cursor:pointer;display:flex;align-items:center;justify-content:space-between;" data-upload="${u.id}">
          <div style="display:flex;align-items:center;gap:var(--sp-3);flex:1;min-width:0;">
            <div style="width:40px;height:40px;border-radius:var(--radius-md);background:var(--accent-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div style="min-width:0;">
              <div style="font-size:0.875rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(u.title)}</div>
              <div style="font-size:0.6875rem;color:var(--ink-muted);">
                ${u.category} · ${u.subject || 'General'} · ${formatSize(u.contentLength)} · ${formatDate(u.createdAt)}
              </div>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm delete-upload" data-del="${u.id}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `).join('')}
    </div>`;

  // View upload detail
  el.querySelectorAll('[data-upload]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.delete-upload')) return;
      const u = uploads.find(u => u.id === card.dataset.upload);
      if (u) renderUploadDetail(detailEl, u);
    });
  });

  // Delete upload
  el.querySelectorAll('.delete-upload').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.del;
      const updated = uploads.filter(u => u.id !== id);
      Store.set('knowledgeUploads', updated);
      showToast('Resource deleted.', 'success');
      renderUploads(el, updated, detailEl);
      // Update badge
      const badge = el.closest('#uploads-section')?.querySelector('.badge');
      if (badge) badge.textContent = `${updated.length} file${updated.length !== 1 ? 's' : ''}`;
    });
  });
}

/* ── Upload detail view ── */
function renderUploadDetail(el, upload) {
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const preview = upload.content.length > 3000
    ? upload.content.slice(0, 3000) + '\n\n... (content truncated for display)'
    : upload.content;

  el.innerHTML = `
    <div class="card" style="border-top:3px solid var(--accent);padding:var(--sp-8);animation:fadeInUp var(--dur-slow) var(--ease) both;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
        <div>
          <h2 style="font-size:1.25rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-1);">${esc(upload.title)}</h2>
          <p style="font-size:0.8125rem;color:var(--ink-muted);">
            ${upload.category} · ${upload.subject || 'General'} · Uploaded ${formatDate(upload.createdAt)}
          </p>
        </div>
        <button class="btn btn-ghost btn-sm" id="close-upload-detail">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      ${upload.notes ? `<div style="background:var(--bg-subtle);padding:var(--sp-3) var(--sp-4);border-radius:var(--radius-md);margin-bottom:var(--sp-4);font-size:0.8125rem;color:var(--ink-secondary);line-height:1.6;"><strong>Notes:</strong> ${esc(upload.notes)}</div>` : ''}

      <div style="background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:var(--sp-5);max-height:500px;overflow-y:auto;">
        <pre style="font-family:var(--font-mono);font-size:0.8rem;line-height:1.7;color:var(--ink-secondary);white-space:pre-wrap;word-wrap:break-word;margin:0;">${esc(preview)}</pre>
      </div>
    </div>
  `;

  el.querySelector('#close-upload-detail')?.addEventListener('click', () => {
    el.innerHTML = '';
  });
}

/* ── Upload modal ── */
function showUploadModal(container) {
  const classes = Store.getClasses();

  const { backdrop, close } = openModal({
    title: 'Upload Resource',
    body: `
      <div class="input-group">
        <label class="input-label">Title</label>
        <input class="input" id="upload-title" placeholder="e.g. 4A Chemistry Scheme of Work 2026" />
      </div>
      <div class="input-group">
        <label class="input-label">Category</label>
        <select class="input" id="upload-category">
          ${UPLOAD_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Subject (optional)</label>
        <input class="input" id="upload-subject" placeholder="e.g. Pure Chemistry" />
      </div>
      <div class="input-group">
        <label class="input-label">Link to Class (optional)</label>
        <select class="input" id="upload-class">
          <option value="">No class</option>
          ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Upload File or Paste Content</label>
        <p style="font-size:0.6875rem;color:var(--ink-faint);margin-bottom:var(--sp-2);">Supports .txt, .md, .csv files. For PDFs, copy-paste the text content below.</p>
        <div style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:var(--sp-6);text-align:center;cursor:pointer;transition:border-color 0.15s;" id="drop-zone">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" style="margin:0 auto var(--sp-2);display:block;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-1);">Drop file here or click to browse</p>
          <p style="font-size:0.6875rem;color:var(--ink-faint);" id="file-name">No file selected</p>
          <input type="file" id="file-input" accept=".txt,.md,.csv,.text" style="display:none;" />
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Or paste content directly</label>
        <textarea class="input" id="upload-content" rows="6" placeholder="Paste syllabus text, topic outlines, exam rubrics, or any reference material..."></textarea>
      </div>
      <div class="input-group">
        <label class="input-label">Notes (optional)</label>
        <textarea class="input" id="upload-notes" rows="2" placeholder="Any notes about this resource..."></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="upload">Upload Resource</button>
    `
  });

  const dropZone = backdrop.querySelector('#drop-zone');
  const fileInput = backdrop.querySelector('#file-input');
  const fileNameEl = backdrop.querySelector('#file-name');
  const contentArea = backdrop.querySelector('#upload-content');
  let fileContent = '';

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  function handleFile(file) {
    fileNameEl.textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      fileContent = reader.result;
      contentArea.value = fileContent;
    };
    reader.readAsText(file);
  }

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="upload"]').addEventListener('click', () => {
    const title = backdrop.querySelector('#upload-title').value.trim();
    const content = contentArea.value.trim();

    if (!title) { showToast('Please enter a title.', 'danger'); return; }
    if (!content) { showToast('Please upload a file or paste content.', 'danger'); return; }

    const upload = {
      id: generateId(),
      title,
      category: backdrop.querySelector('#upload-category').value,
      subject: backdrop.querySelector('#upload-subject').value.trim(),
      classId: backdrop.querySelector('#upload-class').value || null,
      content,
      contentLength: content.length,
      notes: backdrop.querySelector('#upload-notes').value.trim(),
      createdAt: Date.now()
    };

    const uploads = [...(Store.get('knowledgeUploads') || []), upload];
    Store.set('knowledgeUploads', uploads);
    showToast(`"${title}" uploaded!`, 'success');
    close();
    render(container);
  });

  setTimeout(() => backdrop.querySelector('#upload-title')?.focus(), 100);
}

function renderDetail(el, fw, cardsEl) {
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });

  el.innerHTML = `
    <div class="card" style="border-top:3px solid ${fw.accent};padding:var(--sp-8);animation:fadeInUp var(--dur-slow) var(--ease) both;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);">
        <div>
          <h2 style="font-size:1.25rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-1);">${fw.title}</h2>
          <p style="font-size:0.875rem;color:var(--ink-muted);">${fw.subtitle}</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="close-detail">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <p style="font-size:0.875rem;color:var(--ink-secondary);line-height:1.7;margin-bottom:var(--sp-6);">${fw.overview}</p>

      ${fw.sections.map(sec => `
        <div style="margin-bottom:var(--sp-6);">
          <h3 style="font-size:0.9375rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);padding-bottom:var(--sp-2);border-bottom:1px solid var(--border-light);">${sec.heading}</h3>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
            ${sec.items.map(item => `
              <div style="display:flex;gap:var(--sp-3);align-items:flex-start;">
                <div style="width:8px;height:8px;border-radius:50%;background:${fw.accent};margin-top:6px;flex-shrink:0;"></div>
                <div>
                  <div style="font-weight:600;font-size:0.8125rem;color:var(--ink);margin-bottom:2px;">${item.term}</div>
                  <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">${item.desc}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  el.querySelector('#close-detail')?.addEventListener('click', () => {
    el.innerHTML = '';
    cardsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ── Search across frameworks AND uploads ── */
function renderSearchResults(el, query, uploads) {
  const results = [];

  // Search built-in frameworks
  FRAMEWORKS.forEach(fw => {
    fw.sections.forEach(sec => {
      sec.items.forEach(item => {
        if (item.term.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query) ||
            sec.heading.toLowerCase().includes(query) || fw.title.toLowerCase().includes(query)) {
          results.push({ type: 'framework', fw, section: sec.heading, term: item.term, desc: item.desc });
        }
      });
    });
  });

  // Search uploaded resources
  (uploads || []).forEach(u => {
    if (u.title.toLowerCase().includes(query) ||
        u.content.toLowerCase().includes(query) ||
        (u.category || '').toLowerCase().includes(query) ||
        (u.subject || '').toLowerCase().includes(query)) {
      // Extract matching snippet from content
      const idx = u.content.toLowerCase().indexOf(query);
      const snippetStart = Math.max(0, idx - 60);
      const snippetEnd = Math.min(u.content.length, idx + query.length + 100);
      const snippet = (snippetStart > 0 ? '...' : '') +
                      u.content.slice(snippetStart, snippetEnd) +
                      (snippetEnd < u.content.length ? '...' : '');

      results.push({ type: 'upload', upload: u, term: u.title, desc: snippet, section: u.category });
    }
  });

  if (results.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:var(--sp-8);color:var(--ink-muted);font-size:0.875rem;">No matches found for "${esc(query)}".</div>`;
    return;
  }

  el.innerHTML = `
    <div style="margin-bottom:var(--sp-3);font-size:0.8125rem;color:var(--ink-muted);">${results.length} result${results.length !== 1 ? 's' : ''} found</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
      ${results.map(r => `
        <div class="card" style="padding:var(--sp-4);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-1);">
            <span class="badge ${r.type === 'upload' ? 'badge-violet' : 'badge-gray'}">${r.type === 'upload' ? 'Your Resource' : r.fw.title}</span>
            <span style="font-size:0.6875rem;color:var(--ink-faint);">${r.section}</span>
          </div>
          <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:2px;">${highlight(r.term, query)}</div>
          <div style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">${highlight(r.desc, query)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return esc(text).replace(regex, '<mark style="background:var(--warning-light);padding:0 2px;border-radius:2px;">$1</mark>');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatSize(len) { return len > 1024 ? `${(len / 1024).toFixed(1)} KB` : `${len} chars`; }
function formatDate(ts) { return new Date(ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }); }
