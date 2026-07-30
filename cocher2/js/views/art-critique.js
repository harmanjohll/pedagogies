/*
 * Art Critique Guide — View
 * =========================
 * Dedicated page for the Art Critique teaching tool.
 * Launches the Feldman Model critique framework in a fullscreen overlay.
 */

import { openOverlay } from '../components/overlay.js';
import { trackEvent } from '../utils/analytics.js';

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <div class="page-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Art Critique Guide
            </h1>
            <p class="page-subtitle">Structured artwork analysis using the Feldman Model.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <div style="display:flex;gap:var(--sp-5);align-items:flex-start;">
            <div style="flex:1;">
              <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Feldman Model Critique</h3>
              <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-3);">
                Guide students through four stages of art criticism:
                <strong style="color:#3b82f6;">Describe</strong>,
                <strong style="color:#f59e0b;">Analyse</strong>,
                <strong style="color:#22c55e;">Interpret</strong>, and
                <strong style="color:#ec4899;">Judge</strong>.
              </p>
              <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:20px;margin-bottom:var(--sp-4);">
                <li>Upload or paste an artwork image (JPG, PNG, WebP)</li>
                <li>Guided observation prompts at each stage</li>
                <li>Student response text areas with auto-save</li>
                <li>Progress bar tracks completion across all 4 stages</li>
                <li>Print / export completed critique for portfolio</li>
              </ul>
              <button class="btn btn-primary" id="launch-art-critique" style="gap:8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Launch Art Critique Tool
              </button>
            </div>
            <div style="width:200px;height:160px;border-radius:12px;background:linear-gradient(135deg,#ec4899 0%,#8b5cf6 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">The Feldman Model</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Edmund Feldman's four-step method moves students from objective observation to subjective interpretation. It builds visual literacy and critical thinking skills progressively.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Classroom Use</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Project an artwork on screen, then have students work through the stages individually or in groups. Use the print feature to collect responses as part of art portfolios or formative assessment.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#launch-art-critique').addEventListener('click', () => {
    trackEvent('feature', 'launch', 'artCritique');
    openOverlay('Art Critique Guide', {
      src: 'simulations/interactives/art-critique/index.html'
    });
  });
}
