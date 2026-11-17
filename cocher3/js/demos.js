/*
 * Co-Cher 3: demo slots
 * =====================
 * Short videos that show how a feature works, kept inside Co-Cher. They are
 * recorded by briefing-videos/tools/cocher3-demos/ (made up people only);
 * when a screen changes, rerecord its clip and replace the file here. Each slot has an id that a screen can point to (places.js `demo`).
 *
 * To fill a slot, put the file in cocher3/demos/ and set `src`:
 *   .mp4 / .webm  plays as a looping, muted video
 *   .html         runs in a frame (an animated page, a Lottie player, ...)
 *   .svg / .gif   shows as an image
 * A slot with no `src` says plainly that its demo has not been made yet.
 */

export const DEMOS = [
  { id: 'overview', title: 'What is Co-Cher?', about: 'The whole app in one minute', src: '00-what-is-co-cher.mp4' },
  { id: 'school', title: 'Where do I start?', about: 'My School, the tiles and the menu', src: '01-my-school.mp4' },
  { id: 'now', title: 'How do I keep track of what needs doing?', about: 'Entries on Now and Week; goals on Term', src: '02-entries-and-goals.mp4' },
  { id: 'lesson-cycle', title: 'How do I take a lesson from plan to class?', about: 'Lesson stages, the next step, Present', src: '03-plan-to-present.mp4' },
  { id: 'student-finder', title: 'How do I get my class list in without typing?', about: 'Student Finder and Commit class', src: '04-commit-class.mp4' },
  { id: 'observe', title: 'How do I note what a student showed, mid lesson?', about: 'Observe, inside Present', src: '05-observe.mp4' },
  { id: 'classes', title: 'How do I see one student as a whole?', about: 'A profile across classes, with their pathway', src: '06-student-profile.mp4' },
  { id: 'paths', title: 'Where is Paths for ECG lessons?', about: 'CCE2021, then ECG', src: '07-paths.mp4' },
  { id: 'learning-log', title: 'What is the E21CC Learning Log?', about: 'For Beatty: student view, console, demo', src: '08-learning-log.mp4' },
  { id: 'admin', title: 'What is in Admin?', about: 'Quick tools, Find a teacher, events', src: '12-admin.mp4' },
  { id: 'free-time', title: 'When are my colleagues and I all free?', about: 'Common free time, in Admin', src: '09-common-free-time.mp4' },
  { id: 'send', title: 'How do I pass my work to a colleague?', about: 'Send lessons, layouts, entries, goals', src: '10-send-to-a-colleague.mp4' },
  { id: 'look', title: 'Can I change how Co-Cher looks?', about: 'Look, day or night, type, menu', src: '11-make-it-yours.mp4' },
];

export const demoById = (id) => DEMOS.find(d => d.id === id) || null;

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The player for one slot. */
export function demoPlayerHTML(d) {
  if (!d?.src) {
    return `<div class="v3-demo-stage empty"><div>
      <b>Not made yet</b><span>This space is kept for a short animation of ${esc(d?.title || 'this feature').toLowerCase()}</span>
    </div></div>`;
  }
  const url = new URL(`../demos/${d.src}`, import.meta.url).href;
  if (/\.(mp4|webm)$/i.test(d.src)) return `<div class="v3-demo-stage"><video src="${esc(url)}#t=0.1" muted playsinline controls preload="metadata"></video></div>`;
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
      <h1 class="v3-title">Short videos, one question each</h1>
      <p class="v3-lede">About twenty seconds each, with captions and no sound. Every person shown is made up</p>
    </div></div>
    <div class="v3-grid">
      <div class="v3-col-8"><div class="v3-panel flush">${demoPlayerHTML(sel)}
        <div style="padding:16px 20px;"><div class="v3-row-t">${esc(sel.title)}</div><div class="v3-row-s">${esc(sel.about)}</div></div></div></div>
      <div class="v3-col-4"><div class="v3-panel"><div class="v3-h">All videos</div>
        ${DEMOS.map(d => `<a class="v3-row" href="#/demos/${d.id}">
          <span><span class="v3-row-t" style="${d.id === sel.id ? 'color:var(--accent-dark);' : ''}">${esc(d.title)}</span><br><span class="v3-row-s">${d.src ? esc(d.about) : 'Not made yet'}</span></span>
        </a>`).join('')}</div></div>
    </div></div></div>`;
}
