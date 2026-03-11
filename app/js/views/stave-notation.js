/*
 * Stave Notation — View
 * =====================
 * Dedicated page for the Stave Notation teaching tool.
 * Launches the staff notation editor in a fullscreen overlay.
 */

import { openOverlay } from '../components/overlay.js';

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <div class="page-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9980FA" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              Stave Notation
            </h1>
            <p class="page-subtitle">Staff notation editor for music theory — treble/bass clef, time signatures, and composition.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <div style="display:flex;gap:var(--sp-5);align-items:flex-start;">
            <div style="flex:1;">
              <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Staff Notation Editor</h3>
              <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-3);">
                Place notes on the staff by selecting a note value and clicking. Hear your composition with built-in playback.
                Supports both <strong>treble</strong> and <strong>bass</strong> clef with correct pitch mappings.
              </p>
              <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:20px;margin-bottom:var(--sp-4);">
                <li>Note values: whole, half, quarter, eighth, sixteenth, and rests</li>
                <li>Treble clef (E4–A5) and bass clef (E2–C4) with ledger lines</li>
                <li>Key signatures: C, G, F, D, B&#9837; Major and A Minor</li>
                <li>Time signatures: 4/4, 3/4, 2/4, 6/8</li>
                <li>Click-to-place, click-to-remove — instant visual feedback</li>
                <li>Web Audio playback — hear your composition from left to right</li>
              </ul>
              <button class="btn btn-primary" id="launch-stave" style="gap:8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Launch Stave Notation
              </button>
            </div>
            <div style="width:200px;height:160px;border-radius:12px;background:linear-gradient(135deg,#9980FA 0%,#7c3aed 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">For Music Lessons</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Teach note values, pitch placement, and basic composition. Students see notes on the staff and hear the result instantly — bridging music theory and practice.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Staff Reading Skills</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Practice reading treble and bass clef. Mnemonics (Every Good Boy Deserves Fun) come alive when students place and hear the actual pitches on the staff.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#launch-stave').addEventListener('click', () => {
    openOverlay('Stave Notation', {
      src: 'simulations/interactives/stave-notation/index.html'
    });
  });
}
