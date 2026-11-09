// Cut a ~60 s overview from the snippets: intro card, 13 highlights, outro card, crossfades.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const V = path.resolve(process.env.OUT_DIR || path.join(__dirname, 'out')), TMP = path.join(V, '_ov');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP);
const SEG = 4.45, XF = 0.35;
// [snippet, caption to start from, offset seconds]
const PICKS = [
  ['01-your-day', 'Workflow modes reshape the app', 0.4],
  ['02-my-classes', 'Each student’s E21CC levels', 1.8],
  ['03-student-finder', 'Find any student', 1.6],
  ['04-commit-class', 'Committed: an ordinary class', -1.4],
  ['05-plan-to-present', 'Present, with one tap', 0.4],
  ['06-spatial-designer', 'Swap the layout, see the trade offs', 0.2],
  ['07-cce-and-paths', 'Paths answers “How do I get there?”', 0.5],
  ['08-learning-log', 'Inside a student’s log', 0.8],
  ['09-assessment', 'Assessment as Learning', 0.4],
  ['10-simulations-tools', 'Interactive practicals', 6.9],
  ['11-resources-library', 'Reopen anything', 0.3],
  ['12-find-anything', 'Students and classes too', 0.2],
  ['13-every-school', 'Your timetable, without retyping', 0.2],
];
const ff = args => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
const ENC = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30'];

(async () => {
  // Cards, drawn with the same overlay as the snippets.
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 });
  const rec = fs.readFileSync(path.join(__dirname, 'rec.cjs'), 'utf8');
  const overlay = rec.slice(rec.indexOf('const OVERLAY = `') + 17, rec.indexOf('`;\n\nasync function newContext'));
  await p.setContent('<html><body style="margin:0;background:#0d1b3e"></body></html>');
  await p.addScriptTag({ content: overlay.replace(/\\`/g, '`') });
  const card = async (file, k, t, d) => {
    await p.evaluate(([k, t, d]) => { window.__dir.card(k, t, d); document.getElementById('dir-card').style.transition = 'none'; }, [k, t, d]);
    await p.waitForTimeout(300); await p.screenshot({ path: file });
  };
  await card(path.join(TMP, 'intro.png'), 'One minute tour', 'Plan, teach and track,<br>in one place', 'Co-Cher 2: thirteen things it does for a teacher, from the timetable to the student.');
  await card(path.join(TMP, 'outro.png'), 'Every school, its own space', 'Co-Cher 2', 'Beatty, Park View, Opera Estate and SAJC.<br>Open it at harmanjohll.github.io/pedagogies/cocher2');
  await b.close();

  const parts = [];
  ff(['-loop', '1', '-t', '3.2', '-i', path.join(TMP, 'intro.png'), '-vf', 'scale=1920:1080,fade=t=in:st=0:d=0.5', ...ENC, path.join(TMP, 'p00.mp4')]); parts.push(['p00.mp4', 3.2]);
  PICKS.forEach(([name, title, off], i) => {
    const marks = JSON.parse(fs.readFileSync(path.join(V, name + '.json'), 'utf8'));
    const m = marks.find(x => x.title === title); if (!m) throw new Error(`${name}: no caption "${title}"`);
    const ss = Math.max(0, m.t + off);
    const out = `p${String(i + 1).padStart(2, '0')}.mp4`;
    ff(['-ss', ss.toFixed(2), '-t', String(SEG), '-i', path.join(V, name + '.mp4'), '-vf', 'scale=1920:1080,setpts=PTS-STARTPTS', ...ENC, path.join(TMP, out)]);
    parts.push([out, SEG]);
    console.log(`${name}: from ${ss.toFixed(1)}s`);
  });
  ff(['-loop', '1', '-t', '4.2', '-i', path.join(TMP, 'outro.png'), '-vf', 'scale=1920:1080,fade=t=out:st=3.6:d=0.6', ...ENC, path.join(TMP, 'p99.mp4')]); parts.push(['p99.mp4', 4.2]);

  // Crossfade chain.
  const inputs = parts.flatMap(([f]) => ['-i', path.join(TMP, f)]);
  let filter = '', last = '[0:v]', t = parts[0][1];
  for (let i = 1; i < parts.length; i++) {
    const off = (t - XF).toFixed(3), lab = `[v${i}]`;
    filter += `${last}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${off}${lab};`;
    last = lab; t = t - XF + parts[i][1];
  }
  const out = path.join(V, '00-co-cher-2-in-one-minute.mp4');
  ff([...inputs, '-filter_complex', filter.replace(/;$/, ''), '-map', last, ...ENC, '-movflags', '+faststart', out]);
  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  console.log(`overview: ${(+dur).toFixed(1)}s`);
  fs.rmSync(TMP, { recursive: true, force: true });
})();
