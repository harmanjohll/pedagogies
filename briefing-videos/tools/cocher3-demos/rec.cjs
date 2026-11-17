// Recording kit for Co-Cher 3 instructional videos (adapted from ../cocher2-demos/rec.cjs).
// Live capture of the real app (CDP screencast, 1920x1080), with an injected
// overlay: cursor, click ripple, highlight ring, lower-third captions, and
// title/end cards. Frames are encoded to a constant 30 fps H.264 MP4.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.env.BASE_URL || 'http://localhost:8765/pedagogies/cocher3/';
const CDN = path.resolve(process.env.CDN_DIR || path.join(__dirname, '../cocher2-demos/cdn/node_modules'));
// A Tuesday in the middle of Term 3: ordinary teaching, no exams or holidays near, so what is on screen makes sense.
const AT = process.env.AT || '2026-07-21T09:20:00+08:00';
const FONTCSS = process.env.FONT_CSS && fs.existsSync(process.env.FONT_CSS) ? fs.readFileSync(process.env.FONT_CSS, 'utf8') : '';   // local copy of the web fonts, for a sandbox
const W = 1440, H = 810, DSF = 4 / 3;               // 1920 x 1080 frames

const MIME = { js: 'application/javascript', mjs: 'application/javascript', css: 'text/css', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', json: 'application/json' };

const OVERLAY = `
(() => {
  if (window.__dirInit || window !== window.top) return; window.__dirInit = true;
  const css = \`
  #api-key-banner { display:none !important; }
  #dir-root, #dir-root * { pointer-events:none !important; box-sizing:border-box; }
  #dir-root { position:fixed; inset:0; z-index:2147483647; font-family:'Inter','Segoe UI',system-ui,sans-serif; }
  #dir-cursor { position:fixed; left:0; top:0; width:26px; height:26px; transform:translate(-3px,-2px); opacity:0; filter:drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
  #dir-ripple { position:fixed; width:44px; height:44px; margin:-22px 0 0 -22px; border-radius:50%; border:3px solid #f5b301; opacity:0; }
  #dir-ripple.go { animation:dirr .55s ease-out; }
  @keyframes dirr { 0% { transform:scale(.3); opacity:1 } 100% { transform:scale(1.6); opacity:0 } }
  #dir-ring { position:fixed; border:3px solid #f5b301; border-radius:12px; box-shadow:0 0 0 6px rgba(245,179,1,.22), 0 0 30px rgba(245,179,1,.35); opacity:0; transition:all .45s cubic-bezier(.2,.8,.2,1); }
  #dir-cap { position:fixed; left:300px; bottom:28px; max-width:820px; padding:14px 22px 15px; border-radius:14px; background:rgba(13,27,62,.94); color:#fff; box-shadow:0 10px 30px rgba(0,0,0,.25); opacity:0; transform:translateY(14px); transition:all .45s cubic-bezier(.2,.8,.2,1); border-left:5px solid #f5b301; }
  #dir-cap.on { opacity:1; transform:none; }
  #dir-cap .t { font-weight:800; font-size:21px; letter-spacing:-.01em; }
  #dir-cap .d { font-size:15.5px; opacity:.86; margin-top:3px; line-height:1.4; }
  #dir-card { position:fixed; inset:0; display:flex; flex-direction:column; justify-content:center; padding:0 120px; background:radial-gradient(1200px 600px at 20% 30%, #1d3a8a 0%, #0d1b3e 55%, #081129 100%); color:#fff; opacity:0; transition:opacity .5s ease; }
  #dir-card.on { opacity:1; }
  #dir-card .brand { display:flex; align-items:center; gap:14px; font-size:20px; font-weight:700; letter-spacing:.02em; color:#f5b301; margin-bottom:26px; }
  #dir-card .brand i { display:inline-flex; width:40px; height:40px; border-radius:10px; background:#f5b301; color:#0d1b3e; font-style:normal; font-weight:900; align-items:center; justify-content:center; font-size:22px; }
  #dir-card .k { font-size:15px; text-transform:uppercase; letter-spacing:.14em; color:rgba(255,255,255,.6); margin-bottom:10px; }
  #dir-card .t { font-size:58px; font-weight:800; letter-spacing:-.025em; line-height:1.05; max-width:1000px; }
  #dir-card .d { font-size:22px; color:rgba(255,255,255,.82); margin-top:18px; max-width:900px; line-height:1.45; }
  #dir-card .u { position:absolute; left:120px; bottom:56px; font-size:15px; color:rgba(255,255,255,.55); letter-spacing:.02em; }
  #dir-cap { left:50% !important; bottom:104px !important; max-width:860px; width:max-content; border-radius:12px; background:rgba(28,39,51,.96) !important; transform:translate(-50%,8px) !important; }
  #dir-cap.on { transform:translate(-50%,0) !important; }
  html[data-home]:not(.v3-arriving) #dir-cap { bottom:32px !important; }   /* My School has no dock */
  #dir-cap .t { font-weight:600 !important; font-size:20px !important; letter-spacing:0 !important; }
  #dir-ring, #dir-ripple { border-color:#D9B552 !important; }
  #dir-ring { box-shadow:0 0 0 5px rgba(217,181,82,.2) !important; }
  #dir-card { background:#1C2733 !important; }
  #dir-card .brand { color:#D9B552 !important; font-weight:600 !important; font-size:19px !important; }
  #dir-card .brand i { display:none !important; }
  #dir-card .k { text-transform:none !important; letter-spacing:0 !important; font-size:18px !important; color:rgba(255,255,255,.62) !important; }
  #dir-card .t { font-family:'Shippori Mincho','Newsreader',Georgia,serif !important; font-weight:500 !important; letter-spacing:0 !important; font-size:60px !important; line-height:1.15 !important; }
  \`;
  const mount = () => {
    if (document.getElementById('dir-root')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const r = document.createElement('div'); r.id = 'dir-root';
    r.innerHTML = '<div id="dir-ring"></div><div id="dir-cap"><div class="t"></div><div class="d"></div></div>'
      + '<div id="dir-ripple"></div>'
      + '<svg id="dir-cursor" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.6L21 11z" fill="#fff" stroke="#0d1b3e" stroke-width="1.6" stroke-linejoin="round"/></svg>'
      + '<div id="dir-card"><div class="brand"><i>C</i>Co-Cher</div><div class="k"></div><div class="t"></div><div class="d"></div><div class="u">harmanjohll.github.io/pedagogies/cocher3</div></div>';
    document.body.appendChild(r);
    const cur = r.querySelector('#dir-cursor'), rip = r.querySelector('#dir-ripple');
    const p = window.__dirCursor || { x: innerWidth * 0.62, y: innerHeight * 0.55 };
    cur.style.left = p.x + 'px'; cur.style.top = p.y + 'px'; cur.style.opacity = 1;
  };
  window.__dir = {
    cap(t, d) { mount(); const c = document.getElementById('dir-cap'); c.querySelector('.t').innerHTML = t; c.querySelector('.d').innerHTML = d || ''; c.classList.add('on'); },
    hideCap() { const c = document.getElementById('dir-cap'); c && c.classList.remove('on'); },
    card(k, t, d) { mount(); const c = document.getElementById('dir-card'); c.querySelector('.k').innerHTML = k || ''; c.querySelector('.t').innerHTML = t; c.querySelector('.d').innerHTML = d || ''; c.classList.add('on'); },
    hideCard() { const c = document.getElementById('dir-card'); c && c.classList.remove('on'); },
    ring(x, y, w, h) { mount(); const g = document.getElementById('dir-ring'); Object.assign(g.style, { left: x - 6 + 'px', top: y - 6 + 'px', width: w + 12 + 'px', height: h + 12 + 'px', opacity: 1 }); },
    unring() { const g = document.getElementById('dir-ring'); g && (g.style.opacity = 0); },
    cursorTo(x, y, ms) { mount(); const c = document.getElementById('dir-cursor'); c.style.transition = 'left ' + ms + 'ms cubic-bezier(.45,.05,.25,1), top ' + ms + 'ms cubic-bezier(.45,.05,.25,1)'; c.style.opacity = 1; c.style.left = x + 'px'; c.style.top = y + 'px'; window.__dirCursor = { x, y }; try { sessionStorage.setItem('__dirCursor', JSON.stringify({ x, y })); } catch {} },
    ripple(x, y) { const r = document.getElementById('dir-ripple'); r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); },
    ringAround(sel, text, up) {
      const els = [...document.querySelectorAll(sel)].filter(e => e.offsetParent && (!text || (e.innerText || '').includes(text)));
      let el = els[0]; if (!el) return false; if (up) el = el.closest(up) || el;
      const b = el.getBoundingClientRect(); this.ring(b.x, b.y, b.width, b.height); return true;
    },
    mount,
  };
  try { const c = JSON.parse(sessionStorage.getItem('__dirCursor') || 'null'); if (c) window.__dirCursor = c; } catch {}
  if (document.readyState !== 'loading') mount(); else addEventListener('DOMContentLoaded', mount);
})();
`;

function madeUpTimetableCsv() {
  const real = path.resolve(__dirname, '../../../cocher2/btyrelief/BTYTT_2026Sem2_v1.csv');
  const head = fs.readFileSync(real, 'utf8').split('\n')[0].replace(/^\uFEFF/, '').trim().split(',');   // the header line only
  const P = { '07:55': 1, '08:30': 2, '09:05': 3, '09:40': 4, '10:50': 6, '11:25': 7, '12:00': 8, '12:35': 9, '13:10': 10, '13:45': 11 };
  const rows = require('./roster.cjs').teachers.map(t => {
    const row = Object.fromEntries(head.map(h => [h, '']));
    row.DEPARTMENT = t.department; row.SUBJECT = t.department; row.NAME = t.name.toUpperCase(); row["Teacher's Email"] = t.email;
    t.entries.forEach(e => { let p = P[e.start]; const last = Object.keys(P).find(k => P[k] === p);
      for (let st = e.start; p && st < e.end; ) { const col = `${e.cycle}${e.day}P${String(p).padStart(2, '0')}`; if (col in row) row[col] = `${e.class} / ${e.room}`;
        const [h, m] = st.split(':').map(Number); const n = h * 60 + m + 35; st = `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; p = P[st]; } });
    return head.map(h => row[h]).join(',');
  });
  return [head.join(','), ...rows].join('\n') + '\n';
}

async function newContext(browser, user) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, timezoneId: 'Asia/Singapore', locale: 'en-SG', acceptDownloads: true });
  // A made up staff roster stands in for the school's published one: no real names or timetables on screen.
  await ctx.route(/\/schools\/bty\/staff\.json/, r => r.fulfill({ body: JSON.stringify(require('./roster.cjs')), contentType: 'application/json' }));
  // The same for the timetable file behind Find a Teacher: its header is kept, its rows are built from the made up roster.
  await ctx.route(/\/btyrelief\/[^/]+\.csv/, r => r.fulfill({ body: madeUpTimetableCsv(), contentType: 'text/csv' }));
  if (FONTCSS) await ctx.route(/^https:\/\/fonts\.googleapis\.com\//, r => r.fulfill({ body: FONTCSS, contentType: 'text/css' }));
  // A fixed school morning, so the timetable always has a lesson on.
  await ctx.addInitScript(at => { const T = new Date(at).getTime(), D = Date; const off = T - D.now();
    window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } }; }, AT);
  await ctx.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\//, async route => {
    const m = route.request().url().match(/\/npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/([^?#]*)/);
    const file = m && path.join(CDN, m[1], m[2]);
    if (file && fs.existsSync(file)) return route.fulfill({ body: fs.readFileSync(file), contentType: MIME[file.split('.').pop()] || 'application/octet-stream' });
    return route.abort();
  });
  await ctx.route(/^https:\/\/cdn\.sheetjs\.com\//, route => route.fulfill({ body: fs.readFileSync(path.join(CDN, 'xlsx/dist/xlsx.full.min.js')), contentType: MIME.js }));
  await ctx.route(/^https:\/\/(www\.youtube|generativelanguage|script\.google)/, route => route.abort());
  await ctx.addInitScript(u => {
    if (!localStorage.getItem('cocher2_current_user')) localStorage.setItem('cocher2_current_user', JSON.stringify(u));
    // the milestone note is shown once in real use; keep it out of the way of every clip
    if (!localStorage.getItem('cocher2_milestones_seen')) localStorage.setItem('cocher2_milestones_seen', JSON.stringify(['presented-1','created-10','reflections-10','presented-10','reflections-25','presented-25','created-50','presented-50']));
  }, user);
  await ctx.addInitScript(OVERLAY);
  return ctx;
}

// Get past welcome / onboarding / what's new, then land on `hash`.
async function boot(page, hash = '#/') {
  await page.goto(BASE + hash);
  await page.waitForTimeout(1500);
  if (await page.locator('#welcome-skip').isVisible().catch(() => false)) { await page.click('#welcome-skip'); await page.waitForTimeout(1500); }
  for (let i = 0; i < 4; i++) for (const sel of ['#ob-skip', '#ob-explore', 'button:has-text("Skip")', '.modal-close', 'button:has-text("Got it")']) {
    const b = page.locator(sel).first();
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(400); }
  }
  await page.goto(BASE + hash);
  await page.waitForTimeout(1800);
  await page.mouse.move(W * 0.62, H * 0.55);
  await page.evaluate(([x, y]) => window.__dir && window.__dir.cursorTo(x, y, 0), [W * 0.62, H * 0.55]);
}

class Recorder {
  constructor(page) { this.page = page; this.frames = []; }
  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', async f => {
      this.frames.push({ t: f.metadata.timestamp, data: f.data });
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
    });
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    this.t0 = Date.now() / 1000;
  }
  async stop(outFile) {
    const tEnd = Date.now() / 1000;
    await this.cdp.send('Page.stopScreencast');
    const dir = outFile.replace(/\.mp4$/, '_frames');
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const fr = this.frames.filter(f => f.t >= this.t0 - 0.5);
    let list = '';
    fr.forEach((f, i) => {
      const name = `f${String(i).padStart(6, '0')}.jpg`;
      fs.writeFileSync(path.join(dir, name), Buffer.from(f.data, 'base64'));
      const next = i + 1 < fr.length ? fr[i + 1].t : tEnd;
      const dur = Math.max(0.001, next - Math.max(f.t, this.t0));
      list += `file '${name}'\nduration ${dur.toFixed(4)}\n`;
    });
    if (fr.length) list += `file 'f${String(fr.length - 1).padStart(6, '0')}.jpg'\n`;
    fs.writeFileSync(path.join(dir, 'list.txt'), list);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
      '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
      '-movflags', '+faststart', outFile]);
    fs.rmSync(dir, { recursive: true, force: true });
    const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outFile]).toString().trim();
    console.log(`${path.basename(outFile)}: ${(+dur).toFixed(1)}s, ${fr.length} frames`);
  }
}

// Director helpers, bound to a page.
function director(page, marks) {
  const wait = ms => page.waitForTimeout(ms);
  const box = async target => (typeof target === 'string' ? page.locator(target).first() : target).boundingBox();
  const d = {
    wait,
    async card(k, t, desc, ms = 2600) { await page.evaluate(([k, t, d]) => window.__dir.card(k, t, d), [k, t, desc]); await wait(ms); await page.evaluate(() => window.__dir.hideCard()); await wait(500); },
    async endCard(t, desc, ms = 2200) { await page.evaluate(() => window.__dir.hideCap()); await page.evaluate(([t, d]) => window.__dir.card('', t, d), [t, desc]); await wait(ms); },
    async cap(t, desc) { if (marks && marks.t0) marks.list.push({ t: (Date.now() - marks.t0) / 1000, title: t }); await page.evaluate(([t, d]) => window.__dir.cap(t, d), [t, desc || '']); },
    async hideCap() { await page.evaluate(() => window.__dir.hideCap()); },
    async moveXY(x, y, ms = 650) { await page.evaluate(([x, y, ms]) => window.__dir.cursorTo(x, y, ms), [x, y, ms]); await wait(ms + 30); await page.mouse.move(x, y); },
    async move(target, ms = 650) {
      const loc = typeof target === 'string' ? page.locator(target).first() : target;
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      const b = await loc.boundingBox(); if (!b) throw new Error('no box for ' + target);
      await d.moveXY(b.x + b.width / 2, b.y + b.height / 2, ms); return b;
    },
    async click(target, pause = 300) {
      const b = await d.move(target); await wait(pause);
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      await page.evaluate(([x, y]) => window.__dir.ripple(x, y), [x, y]);
      await page.mouse.click(x, y); await wait(450);
    },
    async ringAround(sel, text, up) { await page.evaluate(([s, t, u]) => window.__dir.ringAround(s, t, u), [sel, text || '', up || '']); },
    async ring(target, pad = 0) { const b = await box(target); if (!b) return; await page.evaluate(([x, y, w, h]) => window.__dir.ring(x, y, w, h), [b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2]); },
    async unring() { await page.evaluate(() => window.__dir.unring()); },
    async type(target, text, delay = 55) { await d.click(target); await page.locator(typeof target === 'string' ? target : target).first().pressSequentially(text, { delay }); },
    async scroll(sel, dy, steps = 18, ms = 900) {
      await page.evaluate(([sel, dy, steps, ms]) => new Promise(res => {
        const el = sel ? document.querySelector(sel) : (document.querySelector('.main-scroll') || document.scrollingElement);
        let i = 0; const start = el.scrollTop; const tick = () => { i++; const k = i / steps; el.scrollTop = start + dy * (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2); if (i < steps) setTimeout(tick, ms / steps); else res(); }; tick();
      }), [sel, dy, steps, ms]);
    },
    async go(hash) { await page.evaluate(h => { location.hash = h; }, hash); await wait(1200); },
  };
  return d;
}

async function take(name, user, hash, script, outDir, pre) {
  const browser = await chromium.launch();
  try {
    const ctx = await newContext(browser, user);
    const page = await ctx.newPage();
    page.setDefaultTimeout(12000);
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await boot(page, hash);
    if (pre) await pre(page, director(page));
    const rec = new Recorder(page);
    await rec.start();
    const marks = { t0: Date.now(), list: [] };
    await script(page, director(page, marks));
    await rec.stop(path.join(outDir, name + '.mp4'));
    fs.writeFileSync(path.join(outDir, name + '.json'), JSON.stringify(marks.list, null, 1));
    if (errs.length) console.log('  page errors:', errs.slice(0, 3).join(' | '));
  } finally { await browser.close(); }
}

module.exports = { take, newContext, boot, Recorder, director, BASE, W, H, AT };
