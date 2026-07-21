/*
 * Subject Tools — Gallery
 * =======================
 * One home for the subject-specific teaching tools (Music, Art, D&T, NFS).
 * Each tool keeps its own route/page; this gallery is the sidebar entry so
 * five niche destinations don't crowd the navigation.
 */

import { navigate } from '../router.js';
import { trackEvent } from '../utils/analytics.js';

const TOOLS = [
  {
    route: '/rhythm-tool',
    name: 'Rhythm & Percussion',
    subject: 'Music',
    description: 'Beat grid sequencer with drum kit and body percussion sounds. BPM, time signatures, presets.',
    gradient: 'linear-gradient(135deg,#a855f7,#6366f1)',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/>',
  },
  {
    route: '/stave-notation',
    name: 'Stave Notation',
    subject: 'Music',
    description: 'Staff notation editor with treble/bass clefs, key and time signatures, and audio playback.',
    gradient: 'linear-gradient(135deg,#6366f1,#0ea5e9)',
    icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  },
  {
    route: '/art-critique',
    name: 'Art Critique Guide',
    subject: 'Art',
    description: 'Feldman Model critique (Describe → Analyse → Interpret → Judge) with image upload and print export.',
    gradient: 'linear-gradient(135deg,#ec4899,#f97316)',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  },
  {
    route: '/design-process',
    name: 'Design Process',
    subject: 'D&T',
    description: '5-stage design thinking workflow (Empathise → Test) with Empathy Maps, SCAMPER, and journal export.',
    gradient: 'linear-gradient(135deg,#10b981,#0d9488)',
    icon: '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>',
  },
  {
    route: '/kitchen-layout',
    name: 'Kitchen Layout Planner',
    subject: 'NFS / FCE',
    description: 'Kitchen floor-plan designer, AI recipe adaptation, nutrition analysis, and station rotation timer.',
    gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  },
];

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:960px;">
        <div class="page-header">
          <div>
            <h1 class="page-title">Subject Tools</h1>
            <p class="page-subtitle">Specialised teaching tools for Music, Art, D&amp;T, and Nutrition &amp; Food Science.</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--sp-4);">
          ${TOOLS.map(t => `
            <button class="card subject-tool-card" data-route="${t.route}" style="text-align:left;cursor:pointer;padding:0;overflow:hidden;border:1px solid var(--border-light);background:var(--bg-card);display:flex;flex-direction:column;">
              <div style="height:88px;background:${t.gradient};display:flex;align-items:center;justify-content:center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.9">${t.icon}</svg>
              </div>
              <div style="padding:var(--sp-4);flex:1;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                  <span style="font-size:0.9375rem;font-weight:600;color:var(--ink);">${t.name}</span>
                  <span style="font-size:0.625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;padding:2px 8px;border-radius:999px;background:var(--bg-subtle);color:var(--ink-muted);white-space:nowrap;">${t.subject}</span>
                </div>
                <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin:0;">${t.description}</p>
                <span style="margin-top:auto;font-size:0.75rem;font-weight:600;color:var(--accent);">Open &rarr;</span>
              </div>
            </button>
          `).join('')}
        </div>

        <p style="font-size:0.75rem;color:var(--ink-faint);margin-top:var(--sp-5);">
          Tip: tools you select in Settings &rarr; Lesson Planner (Enactment marketplace) also appear as quick generators inside the Lesson Planner.
        </p>
      </div>
    </div>
  `;

  container.querySelectorAll('.subject-tool-card').forEach(card => {
    card.addEventListener('click', () => {
      trackEvent('feature', 'open_subject_tool', card.dataset.route);
      navigate(card.dataset.route);
    });
  });
}
