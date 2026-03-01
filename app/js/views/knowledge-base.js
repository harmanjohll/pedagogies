/*
 * Co-Cher Knowledge Base
 * ======================
 * Searchable framework reference for E21CC, STP, and EdTech Masterplan 2030.
 */

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
          { term: 'Interaction Patterns', desc: 'Managing teacher–student and student–student interactions; think-pair-share, jigsaw, Socratic dialogue.' },
          { term: 'Classroom Discourse', desc: 'Questioning techniques that promote higher-order thinking; productive talk moves.' },
        ]
      },
      {
        heading: 'Area 3: Monitoring & Feedback',
        items: [
          { term: 'Formative Assessment', desc: 'Check for understanding in real time — exit tickets, concept checks, mini-whiteboards.' },
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
          { term: 'Digital Design', desc: 'Create digital artefacts — presentations, videos, apps, simulations — purposefully.' },
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

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header">
          <div>
            <h1 class="page-title">Knowledge Base</h1>
            <p class="page-subtitle">Singapore MOE frameworks and pedagogical references — tap any card to explore.</p>
          </div>
          <div style="max-width:280px;width:100%;">
            <input class="input" id="kb-search" placeholder="Search frameworks..." />
          </div>
        </div>

        <div class="grid-3 stagger" id="framework-cards"></div>

        <div id="framework-detail" style="margin-top:var(--sp-6);"></div>
      </div>
    </div>
  `;

  const cardsEl = container.querySelector('#framework-cards');
  const detailEl = container.querySelector('#framework-detail');
  const searchInput = container.querySelector('#kb-search');

  renderCards(cardsEl);

  cardsEl.addEventListener('click', e => {
    const card = e.target.closest('[data-fw]');
    if (!card) return;
    const fw = FRAMEWORKS.find(f => f.id === card.dataset.fw);
    if (fw) renderDetail(detailEl, fw, cardsEl);
  });

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) { renderCards(cardsEl); detailEl.innerHTML = ''; return; }
    renderSearchResults(detailEl, q);
  });
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

function renderDetail(el, fw, cardsEl) {
  // Scroll to detail
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

function renderSearchResults(el, query) {
  const results = [];
  FRAMEWORKS.forEach(fw => {
    fw.sections.forEach(sec => {
      sec.items.forEach(item => {
        if (item.term.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query) ||
            sec.heading.toLowerCase().includes(query) || fw.title.toLowerCase().includes(query)) {
          results.push({ fw, section: sec.heading, term: item.term, desc: item.desc });
        }
      });
    });
  });

  if (results.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:var(--sp-8);color:var(--ink-muted);font-size:0.875rem;">No matches found for "${query}".</div>`;
    return;
  }

  el.innerHTML = `
    <div style="margin-bottom:var(--sp-3);font-size:0.8125rem;color:var(--ink-muted);">${results.length} result${results.length !== 1 ? 's' : ''} found</div>
    <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
      ${results.map(r => `
        <div class="card" style="padding:var(--sp-4);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-1);">
            <span class="badge badge-gray">${r.fw.title}</span>
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
  return text.replace(regex, '<mark style="background:var(--warning-light);padding:0 2px;border-radius:2px;">$1</mark>');
}
