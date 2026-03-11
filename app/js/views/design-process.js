/*
 * Design Process — View
 * =====================
 * Dedicated page for the Design Process teaching tool.
 * Launches the 5-stage D&T design thinking workflow in a fullscreen overlay.
 */

import { openOverlay } from '../components/overlay.js';

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <div class="page-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
              Design Process
            </h1>
            <p class="page-subtitle">D&T design thinking framework with integrated CAD, 3D printing, and ML tools.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <div style="display:flex;gap:var(--sp-5);align-items:flex-start;">
            <div style="flex:1;">
              <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">5-Stage Design Thinking</h3>
              <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-3);">
                Guide students through the design thinking cycle: <strong>Empathise → Define → Ideate → Prototype → Test</strong>.
                Each stage has guided prompts, phase-specific tools, image upload, and links to external CAD and ML tools.
              </p>
              <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:20px;margin-bottom:var(--sp-4);">
                <li>5-stage guided workflow with prompts and templates</li>
                <li>Image upload for sketches, photos, and screenshots at each stage</li>
                <li>Phase tools: Empathy Maps, Crazy Eights, SCAMPER, Feedback Grid, and more</li>
                <li>Integrated links: TinkerCAD, Onshape, Google Forms</li>
                <li>3D printing guides with recommended slicer settings</li>
                <li>Auto-save progress with export to Markdown journal</li>
                <li>Visual completion tracker across all stages</li>
              </ul>
              <button class="btn btn-primary" id="launch-design" style="gap:8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Launch Design Process
              </button>
            </div>
            <div style="width:200px;height:160px;border-radius:12px;background:linear-gradient(135deg,#14b8a6 0%,#0d9488 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">CAD Integration</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Quick links to TinkerCAD, Onshape, and Fusion 360 for digital modelling. Students document their CAD work within the journal.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">3D Printing</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Guidance on slicer settings (layer height, infill, supports) and troubleshooting — from STL export to finished print.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Machine Learning</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Train no-code ML models via Teachable Machine to add smart features — material classifiers, gesture controls, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#launch-design').addEventListener('click', () => {
    openOverlay('Design Process', {
      src: 'simulations/interactives/design-process/index.html'
    });
  });
}
