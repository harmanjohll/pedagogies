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

        <!-- Music Theory Basics -->
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-3);">Music Theory Basics</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🎼 The Staff &amp; Clefs</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              The staff has <strong style="color:var(--ink);">5 lines</strong> and <strong style="color:var(--ink);">4 spaces</strong>. Notes sit on lines or in spaces, going higher as you move up.
            </p>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-top:var(--sp-2);">
              <strong style="color:var(--ink);">Treble Clef</strong> (G clef) — for higher-pitched instruments and right hand piano<br>
              Lines: <strong style="color:var(--ink);">E G B D F</strong> — "Every Good Boy Deserves Fun"<br>
              Spaces: <strong style="color:var(--ink);">F A C E</strong> — spells "FACE"
            </p>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-top:var(--sp-2);">
              <strong style="color:var(--ink);">Bass Clef</strong> (F clef) — for lower-pitched instruments and left hand piano<br>
              Lines: <strong style="color:var(--ink);">G B D F A</strong> — "Good Boys Deserve Fun Always"<br>
              Spaces: <strong style="color:var(--ink);">A C E G</strong> — "All Cows Eat Grass"
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🎵 Note Values &amp; Rests</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Each note has a duration measured in beats:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:2;padding-left:18px;margin-top:var(--sp-1);">
              <li><strong style="color:var(--ink);">Whole note (𝅝)</strong> — 4 beats</li>
              <li><strong style="color:var(--ink);">Half note (𝅗𝅥)</strong> — 2 beats</li>
              <li><strong style="color:var(--ink);">Quarter note (♩)</strong> — 1 beat</li>
              <li><strong style="color:var(--ink);">Eighth note (♪)</strong> — ½ beat</li>
              <li><strong style="color:var(--ink);">Sixteenth note (𝅘𝅥𝅯)</strong> — ¼ beat</li>
            </ul>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-top:var(--sp-2);">
              Every note has a matching <strong style="color:var(--ink);">rest</strong> symbol of equal duration — silence is part of music!
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🕐 Time Signatures</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              The two numbers at the start of a piece tell you how beats are grouped:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:2;padding-left:18px;margin-top:var(--sp-1);">
              <li><strong style="color:var(--ink);">4/4 (Common Time)</strong> — 4 quarter-note beats per bar. Most popular in pop, rock, classical.</li>
              <li><strong style="color:var(--ink);">3/4 (Waltz Time)</strong> — 3 quarter-note beats per bar. Used in waltzes, minuets.</li>
              <li><strong style="color:var(--ink);">2/4 (March Time)</strong> — 2 quarter-note beats per bar. Marches, polkas.</li>
              <li><strong style="color:var(--ink);">6/8 (Compound Duple)</strong> — 6 eighth-note beats grouped in 2. Jigs, ballads with a lilting feel.</li>
            </ul>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🎹 Scales &amp; Keys</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Major scale pattern:</strong> W – W – H – W – W – W – H<br>
              (W = whole step, H = half step). C Major uses only white keys.
            </p>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-top:var(--sp-2);">
              <strong style="color:var(--ink);">Natural minor pattern:</strong> W – H – W – W – H – W – W<br>
              A Minor also uses only white keys — the "relative minor" of C Major.
            </p>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-top:var(--sp-2);">
              Key signatures show which notes are sharped or flatted throughout a piece, saving space by not writing accidentals on every note.
            </p>
          </div>
        </div>

        <!-- Key Musical Concepts -->
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-3);">Key Musical Concepts</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🔊 Dynamics</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Volume markings that shape expression:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:2;padding-left:18px;margin-top:var(--sp-1);">
              <li><strong style="color:var(--ink);">pp</strong> (pianissimo) — very soft</li>
              <li><strong style="color:var(--ink);">p</strong> (piano) — soft</li>
              <li><strong style="color:var(--ink);">mp</strong> (mezzo-piano) — moderately soft</li>
              <li><strong style="color:var(--ink);">mf</strong> (mezzo-forte) — moderately loud</li>
              <li><strong style="color:var(--ink);">f</strong> (forte) — loud</li>
              <li><strong style="color:var(--ink);">ff</strong> (fortissimo) — very loud</li>
            </ul>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-top:var(--sp-1);">
              <strong style="color:var(--ink);">Crescendo</strong> (gradually louder) and <strong style="color:var(--ink);">decrescendo</strong> (gradually softer) create movement.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🏃 Tempo</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Speed markings (beats per minute):
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:2;padding-left:18px;margin-top:var(--sp-1);">
              <li><strong style="color:var(--ink);">Largo</strong> — very slow (40–60 BPM)</li>
              <li><strong style="color:var(--ink);">Adagio</strong> — slow, expressive (66–76 BPM)</li>
              <li><strong style="color:var(--ink);">Andante</strong> — walking pace (76–108 BPM)</li>
              <li><strong style="color:var(--ink);">Moderato</strong> — moderate (108–120 BPM)</li>
              <li><strong style="color:var(--ink);">Allegro</strong> — fast, lively (120–156 BPM)</li>
              <li><strong style="color:var(--ink);">Presto</strong> — very fast (168–200 BPM)</li>
            </ul>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">📏 Intervals</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              The distance between two notes — the building blocks of melody and harmony:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:2;padding-left:18px;margin-top:var(--sp-1);">
              <li><strong style="color:var(--ink);">Unison</strong> — same note (0 steps)</li>
              <li><strong style="color:var(--ink);">2nd</strong> — one step (sounds "close")</li>
              <li><strong style="color:var(--ink);">3rd</strong> — two steps (happy or sad depending on major/minor)</li>
              <li><strong style="color:var(--ink);">Perfect 4th</strong> — "Here Comes the Bride"</li>
              <li><strong style="color:var(--ink);">Perfect 5th</strong> — "Star Wars" opening</li>
              <li><strong style="color:var(--ink);">Octave</strong> — same note, higher/lower — "Somewhere Over the Rainbow"</li>
            </ul>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🎶 Composition Ideas</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Try these techniques when composing in the stave editor:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:18px;margin-top:var(--sp-1);">
              <li><strong style="color:var(--ink);">Call &amp; Response</strong> — write a 2-bar phrase, then "answer" it with a variation</li>
              <li><strong style="color:var(--ink);">Ostinato</strong> — create a short repeating pattern as a foundation, then add melody above</li>
              <li><strong style="color:var(--ink);">ABA Form</strong> — write section A, contrast with section B, return to A</li>
              <li><strong style="color:var(--ink);">Pentatonic Scale</strong> — use only C, D, E, G, A — nearly impossible to sound "wrong", perfect for improvisation</li>
              <li><strong style="color:var(--ink);">Step-wise motion</strong> — melodies that move by steps (C→D→E) feel smooth; leaps (C→G) add excitement</li>
            </ul>
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
