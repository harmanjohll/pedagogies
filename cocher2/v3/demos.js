/*
 * Co-Cher 3: demo slots
 * =====================
 * Space for short animations that show how a feature works, kept inside
 * Co-Cher. Each slot has an id that a screen can point to (places.js `demo`).
 *
 * To fill a slot, put the file in v3/demos/ and set `src`:
 *   .mp4 / .webm  plays as a looping, muted video
 *   .html         runs in a frame (an animated page, a Lottie player, ...)
 *   .svg / .gif   shows as an image
 * A slot with no `src` says plainly that its demo has not been made yet.
 */

export const DEMOS = [
  { id: 'now', title: 'Your day at a glance', about: 'Now, Week and Term: how Co-Cher follows your time.', src: '' },
  { id: 'classes', title: 'A profile for every student', about: 'E21CC across classes, the evidence, and the pathway.', src: '' },
  { id: 'student-finder', title: 'Student Finder and Commit class', about: 'From the school timetable to My Classes, without retyping a name.', src: '' },
  { id: 'lesson-cycle', title: 'One lesson, five stages', about: 'Design, prepare, rehearse, teach, reflect.', src: '' },
  { id: 'plan', title: 'Plan with Co-Cher', about: 'From a prompt to a staged lesson.', src: '' },
  { id: 'room', title: 'Design the room', about: 'Layouts scored for the learning you want.', src: '' },
  { id: 'observe', title: 'Observe while you teach', about: 'Press O in Present; two taps per student.', src: '' },
  { id: 'paths', title: 'Paths, inside ECG', about: 'How do I get there? The live Pathways app.', src: '' },
  { id: 'learning-log', title: 'The E21CC Learning Log', about: 'Students’ own evidence, beside your classes.', src: '' },
  { id: 'look', title: 'Make it yours', about: 'Look, type, layout and way of working.', src: '' },
];

export const demoById = (id) => DEMOS.find(d => d.id === id) || null;

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The player for one slot. */
export function demoPlayerHTML(d) {
  if (!d?.src) {
    return `<div class="v3-demo-stage empty"><div>
      <b>Not made yet</b><span>This space is kept for a short animation of ${esc(d?.title || 'this feature').toLowerCase()}.</span>
    </div></div>`;
  }
  const url = `v3/demos/${d.src}`;
  if (/\.(mp4|webm)$/i.test(d.src)) return `<div class="v3-demo-stage"><video src="${esc(url)}" autoplay loop muted playsinline controls></video></div>`;
  if (/\.html?$/i.test(d.src)) return `<div class="v3-demo-stage"><iframe src="${esc(url)}" title="${esc(d.title)}" loading="lazy"></iframe></div>`;
  return `<div class="v3-demo-stage"><img src="${esc(url)}" alt="${esc(d.title)}"></div>`;
}

/** The "How it works" screen: every slot, filled or waiting. */
export function renderDemos(container, params) {
  const pick = (params && params.id) || '';
  const sel = demoById(pick) || DEMOS.find(d => d.src) || DEMOS[0];
  container.innerHTML = `<div class="main-scroll"><div class="v3-page">
    <div class="v3-head"><div>
      <div class="v3-eyebrow">How it works</div>
      <h1 class="v3-title">Short demos</h1>
      <p class="v3-lede">A few seconds each, showing one thing Co-Cher does. ${DEMOS.some(d => d.src) ? '' : 'The slots are ready; the animations come next.'}</p>
    </div></div>
    <div class="v3-grid">
      <div class="v3-col-8"><div class="v3-panel flush">${demoPlayerHTML(sel)}
        <div style="padding:16px 20px;"><div class="v3-row-t">${esc(sel.title)}</div><div class="v3-row-s">${esc(sel.about)}</div></div></div></div>
      <div class="v3-col-4"><div class="v3-panel"><div class="v3-h">All demos</div>
        ${DEMOS.map(d => `<a class="v3-row" href="#/demos/${d.id}">
          <span><span class="v3-row-t" style="${d.id === sel.id ? 'color:var(--accent-dark);' : ''}">${esc(d.title)}</span><br><span class="v3-row-s">${d.src ? esc(d.about) : 'Not made yet'}</span></span>
        </a>`).join('')}</div></div>
    </div></div></div>`;
}
