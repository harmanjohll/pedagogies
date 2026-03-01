/*
 * Co-Cher Spatial Designer (Stub)
 * ================================
 * Full spatial classroom designer — coming in Phase 4.
 */

import { navigate } from '../router.js';

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width: 640px;">
        <div style="text-align: center; padding: var(--sp-16) 0;">

          <div style="
            width: 72px; height: 72px; margin: 0 auto var(--sp-6);
            background: var(--success-light); border-radius: var(--radius-xl);
            display: flex; align-items: center; justify-content: center;
            color: var(--success);
            animation: float 3s ease-in-out infinite;
          ">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18"/><path d="M9 21V9"/>
            </svg>
          </div>

          <h1 class="text-h1" style="margin-bottom: var(--sp-2);">Spatial Designer</h1>
          <p style="font-size: 1rem; color: var(--ink-muted); line-height: 1.7; max-width: 420px; margin: 0 auto var(--sp-6);">
            The full interactive classroom layout designer is being built. It will feature drag-and-drop furniture, smart snapping, preset arrangements, and pedagogical effectiveness analysis.
          </p>

          <div style="display: flex; flex-direction: column; gap: var(--sp-3); max-width: 360px; margin: 0 auto var(--sp-8);">
            <div class="card" style="padding: var(--sp-4); text-align: left; display: flex; gap: var(--sp-3); align-items: center;">
              <span style="font-size: 1.25rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M5 3l14 9-14 9V3z"/></svg>
              </span>
              <div>
                <div style="font-weight: 600; font-size: 0.875rem;">Drag & Drop Furniture</div>
                <div style="font-size: 0.75rem; color: var(--ink-muted);">25+ items including desks, tech, and zones</div>
              </div>
            </div>
            <div class="card" style="padding: var(--sp-4); text-align: left; display: flex; gap: var(--sp-3); align-items: center;">
              <span style="font-size: 1.25rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </span>
              <div>
                <div style="font-weight: 600; font-size: 0.875rem;">Effectiveness Analysis</div>
                <div style="font-size: 0.75rem; color: var(--ink-muted);">Sightlines, mobility, flexibility, density metrics</div>
              </div>
            </div>
            <div class="card" style="padding: var(--sp-4); text-align: left; display: flex; gap: var(--sp-3); align-items: center;">
              <span style="font-size: 1.25rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
              </span>
              <div>
                <div style="font-weight: 600; font-size: 0.875rem;">AI-Powered Suggestions</div>
                <div style="font-size: 0.75rem; color: var(--ink-muted);">Describe your lesson, get optimal layouts</div>
              </div>
            </div>
          </div>

          <p style="font-size: 0.8125rem; color: var(--ink-faint); margin-bottom: var(--sp-4);">
            In the meantime, you can discuss spatial design in the Lesson Planner chat.
          </p>
          <button class="btn btn-primary" id="go-planner">Open Lesson Planner</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#go-planner')?.addEventListener('click', () => navigate('/lesson-planner'));
}
