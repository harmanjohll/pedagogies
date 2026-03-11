/*
 * Kitchen Layout — View
 * =====================
 * Dedicated page for the Kitchen Layout Planner teaching tool.
 * Launches the MasterChef-style kitchen designer in a fullscreen overlay.
 */

import { openOverlay } from '../components/overlay.js';

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <div class="page-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#009432" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              Kitchen Layout Planner
            </h1>
            <p class="page-subtitle">MasterChef-style kitchen workstation designer for NFS & FCE practical lessons.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <div style="display:flex;gap:var(--sp-5);align-items:flex-start;">
            <div style="flex:1;">
              <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Kitchen Floor Plan Designer</h3>
              <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-3);">
                Design kitchen layouts for practical lessons. Drag equipment onto the floor plan, place student markers,
                and visualise safety zones and workflow paths.
              </p>
              <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:20px;margin-bottom:var(--sp-4);">
                <li>Drag-and-drop equipment: hobs, ovens, sinks, prep counters, storage</li>
                <li>MasterChef template with 4 cooking stations and shared area</li>
                <li>Student position markers — adjustable from 4 to 16 students</li>
                <li>Safety zones: hot areas (red) near ovens, wet areas (blue) near sinks</li>
                <li>Workflow arrows: prep → cook → plate pathway visualisation</li>
                <li>5 templates: MasterChef, U-Shape Lab, Island Central, Paired Stations, Blank</li>
              </ul>
              <button class="btn btn-primary" id="launch-kitchen" style="gap:8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Launch Kitchen Planner
              </button>
            </div>
            <div style="width:200px;height:160px;border-radius:12px;background:linear-gradient(135deg,#009432 0%,#006266 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">MasterChef Pedagogy</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Set up timed station rotations where each team handles a different task — chopping, cooking, plating.
              Builds teamwork, time management, and kitchen discipline.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Food Safety Zones</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Visualise hot and wet zones to teach kitchen safety. Students learn to plan efficient workflows
              that minimise cross-contamination and movement hazards.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#launch-kitchen').addEventListener('click', () => {
    openOverlay('Kitchen Layout Planner', {
      src: 'simulations/interactives/kitchen-layout/index.html'
    });
  });
}
