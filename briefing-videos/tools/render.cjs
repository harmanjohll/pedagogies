// usage: node render.cjs <videoDir> <timeline.json> <out.mp4>            → full video
//        node render.cjs <videoDir> <timeline.json> --stills t1,t2,...   → PNG stills (ms)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const [Vin, tlName, out, extra] = process.argv.slice(2);
const V = path.resolve(Vin);   // file:// needs an absolute path
(async () => {
  const tl = fs.readFileSync(path.join(V, tlName), 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(`window.TL=${tl};`);
  await p.goto('file://' + path.join(V, 'video.html'));
  await p.evaluate(() => window.ready);
  const total = await p.evaluate(() => window.TOTAL_MS);
  if (out === '--stills') {
    for (const t of extra.split(',').map(Number)) {
      await p.evaluate(t => window.renderAt(t), t);
      const f = path.join(V, 'out', `still-${path.basename(tlName, '.json')}-${t}.png`);
      await p.screenshot({ path: f }); console.log('still', f);
    }
  } else {
    const fps = 30, frames = Math.ceil(total / 1000 * fps);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    let lastKey = null, buf = null, shots = 0; const t0 = Date.now();
    for (let f = 0; f < frames; f++) {
      const key = await p.evaluate(t => window.renderAt(t), f * 1000 / fps);
      if (key !== lastKey) { buf = await p.screenshot({ type: 'jpeg', quality: 95 }); lastKey = key; shots++; }
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 300 === 0) console.log(`${path.basename(out)} frame ${f}/${frames} (${shots} unique, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log(`DONE ${out}: ${frames} frames, ${shots} unique, ${(total / 1000).toFixed(1)}s video, ${((Date.now() - t0) / 1000).toFixed(0)}s wall`);
  }
  if (errs.length) console.log('PAGE ERRORS:', errs);
  await b.close();
})();
