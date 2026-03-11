/*
 * Rhythm & Percussion — View
 * ==========================
 * Dedicated page for the Rhythm & Percussion teaching tool.
 * Launches the beat grid sequencer in a fullscreen overlay.
 */

import { openOverlay } from '../components/overlay.js';

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <div class="page-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg>
              Rhythm &amp; Percussion
            </h1>
            <p class="page-subtitle">Interactive beat grid sequencer with body percussion and drum sounds.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <div style="display:flex;gap:var(--sp-5);align-items:flex-start;">
            <div style="flex:1;">
              <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Beat Grid Sequencer</h3>
              <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-3);">
                Build rhythm patterns on a visual grid. Click cells to activate sounds, press play to hear your pattern loop.
                Includes both <strong>drum kit</strong> (bass drum, snare, hi-hat) and <strong>body percussion</strong> (clap, stamp, snap, pat) sounds.
              </p>
              <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:20px;margin-bottom:var(--sp-4);">
                <li>Adjustable BPM (40–200), time signature (4/4, 3/4, 6/8), and bar count</li>
                <li>Web Audio API synthesis — no external files needed</li>
                <li>Built-in presets: Basic 4/4, Rock, Waltz, Samba, Body Percussion</li>
                <li>Colour-coded rows for each sound — instant visual feedback</li>
                <li>Press <kbd style="background:var(--bg-subtle);padding:1px 6px;border-radius:4px;font-size:0.75rem;">Space</kbd> to play/pause</li>
              </ul>
              <button class="btn btn-primary" id="launch-rhythm" style="gap:8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Launch Rhythm Tool
              </button>
            </div>
            <div style="width:200px;height:160px;border-radius:12px;background:linear-gradient(135deg,#a855f7 0%,#6366f1 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/></svg>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">For Music Lessons</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Teach rhythm patterns, time signatures, and beat subdivision. Students can experiment with layering sounds and discover how different combinations create musical textures.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Body Percussion</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Use the body percussion sounds (clap, stamp, snap, pat) for classroom activities that don't need instruments. Great for warm-ups, team-building, and kinaesthetic learning.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#launch-rhythm').addEventListener('click', () => {
    openOverlay('Rhythm & Percussion', {
      src: 'simulations/interactives/rhythm-tool/index.html'
    });
  });
}
