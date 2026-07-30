/*
 * Co-Cher — Live Session runtime engine (in-app)
 * ==============================================
 * The rendering + sync engine behind the #/live (presenter) and #/join
 * (student) routes. A direct port of the v8.0 string engine into a real ES
 * module: one `mountLive(host, opts)` renders either role into a fullscreen
 * overlay, syncs over MQTT-over-WebSockets (public broker) with a same-device
 * BroadcastChannel fallback, and returns a destroy() for router cleanup.
 *
 * The presenter broadcasts each slide's CONTENT (not just an index), so the
 * audience surface is content-agnostic; each phone builds its own command
 * card from its answers at the end. Nothing is stored server-side.
 *
 * All class names / ids are lv-prefixed and every CSS rule is scoped under
 * .live-root so the app's own styles and the engine's can never collide.
 * The wire protocol (topic base, envelope, BroadcastChannel name) is
 * unchanged from v8.0/v8.1, so the standalone live/acids-live.html demo and
 * this engine remain mutually compatible.
 */

import { DEFAULT_BROKER, normRoom } from './live-deck.js';

/* ── Dynamic script loading (mqtt.js / qrcode.js from live/) ── */
const _scriptPromises = new Map();
export function loadScriptOnce(src) {
  if (_scriptPromises.has(src)) return _scriptPromises.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => { _scriptPromises.delete(src); reject(new Error('failed to load ' + src)); };
    document.head.appendChild(s);
  });
  _scriptPromises.set(src, p);
  return p;
}

/* ── Engine CSS, fully scoped under .live-root ── */
export const LIVE_ENGINE_CSS = String.raw`
  .live-root{ position:fixed; inset:0; z-index:9000; display:flex; flex-direction:column;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
  .live-root.presenter{ background:#070b24; color:#eaf0ff; }
  .live-root.audience{ background:#f4f5f7; color:#0f172a; }
  .live-root{ --lv-navy:#000C53; --lv-yellow:#FFE200; --lv-red:#e11d48; --lv-green:#16a34a; }
  .live-root button{ font:inherit; cursor:pointer; }
  .live-root .lv-landing{ flex:1; display:flex; align-items:center; justify-content:center; padding:24px;
    background:radial-gradient(1200px 600px at 50% -10%,#10206b,#060a22); color:#fff; }
  .live-root .lv-card-l{ width:min(440px,94vw); background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); border-radius:20px; padding:28px; }
  .live-root .lv-card-l h1{ font-size:1.4rem; margin:0 0 4px; } .live-root .lv-card-l .lv-sub{ color:#b9c2e6; font-size:.9rem; margin-bottom:18px; }
  .live-root .lv-card-l label{ display:block; font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:#9fb0e8; margin:10px 0 6px; }
  .live-root .lv-card-l input{ width:100%; padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.2); background:rgba(0,0,0,.25); color:#fff; font-size:1.1rem; letter-spacing:.12em; text-transform:uppercase; box-sizing:border-box; }
  .live-root .lv-card-l button{ width:100%; margin-top:16px; padding:14px; border-radius:14px; border:none; background:linear-gradient(135deg,#2b3fb3,#1a2570); color:#fff; font-weight:700; font-size:1rem; }
  .live-root .lv-session{ flex:1; min-height:0; display:flex; flex-direction:column; }
  .live-root .lv-topbar{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:12px 20px; }
  .live-root.presenter .lv-topbar{ border-bottom:1px solid rgba(255,255,255,.08); } .live-root.audience .lv-topbar{ border-bottom:1px solid #e3e6eb; }
  .live-root .lv-room{ font-weight:800; letter-spacing:.14em; } .live-root .lv-room small{ font-weight:600; letter-spacing:.06em; opacity:.6; }
  .live-root .lv-status{ display:inline-flex; align-items:center; gap:7px; font-size:.78rem; opacity:.85; }
  .live-root .lv-dot{ width:9px; height:9px; border-radius:50%; background:#f59e0b; } .live-root .lv-dot.online{ background:var(--lv-green); } .live-root .lv-dot.offline{ background:var(--lv-red); }
  .live-root .lv-exit{ padding:6px 14px; border-radius:10px; border:1px solid rgba(255,255,255,.25); background:none; color:inherit; font-size:.8rem; font-weight:600; }
  .live-root.audience .lv-exit{ border-color:#c7ccd6; }
  .live-root .lv-stage{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:4vh 6vw; gap:2.2vh; min-height:0; overflow-y:auto; }
  .live-root .lv-kicker{ font-size:clamp(.72rem,1.6vw,1rem); font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
  .live-root.presenter .lv-kicker{ color:var(--lv-yellow); } .live-root.audience .lv-kicker{ color:var(--lv-red); }
  .live-root .lv-big{ font-size:clamp(1.6rem,5vw,3.4rem); font-weight:800; line-height:1.12; max-width:24ch; }
  .live-root .lv-body{ font-size:clamp(1rem,2.3vw,1.5rem); opacity:.85; max-width:34ch; line-height:1.45; }
  .live-root .lv-wlist{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:1.2vh; text-align:left; max-width:30ch; }
  .live-root .lv-wlist li{ font-size:clamp(1rem,2.2vw,1.5rem); padding-left:1.1em; position:relative; }
  .live-root .lv-wlist li::before{ content:"•"; position:absolute; left:0; color:var(--lv-yellow); } .live-root.audience .lv-wlist li::before{ color:var(--lv-navy); }
  .live-root .lv-scale{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  .live-root .lv-scale button{ width:60px; height:60px; border-radius:16px; font-size:1.3rem; font-weight:800; border:2px solid #c7ccd6; background:transparent; color:inherit; }
  .live-root .lv-scale button.sel{ background:var(--lv-navy); border-color:var(--lv-navy); color:#fff; }
  .live-root .lv-scale-lab{ display:flex; justify-content:space-between; width:min(420px,80vw); font-size:.8rem; opacity:.6; }
  .live-root .lv-qopts{ display:flex; flex-direction:column; gap:12px; width:min(520px,86vw); }
  .live-root .lv-qopts button{ padding:15px 18px; border-radius:14px; text-align:left; font-size:1.05rem; font-weight:600; border:2px solid #c7ccd6; background:#fff; color:#0f172a; }
  .live-root.presenter .lv-qopts button{ border-color:rgba(255,255,255,.18); background:rgba(255,255,255,.04); color:#eaf0ff; }
  .live-root .lv-qopts button.sel{ border-color:var(--lv-navy); background:#eef1ff; }
  .live-root .lv-qopts button.correct{ border-color:var(--lv-green)!important; background:rgba(22,163,74,.14)!important; }
  .live-root .lv-qopts button.wrongsel{ border-color:var(--lv-red)!important; background:rgba(225,29,72,.10)!important; }
  .live-root .lv-bars{ display:flex; flex-direction:column; gap:10px; width:min(560px,86vw); }
  .live-root .lv-bar-row{ display:flex; align-items:center; gap:10px; }
  .live-root .lv-bar-lab{ width:11ch; text-align:right; font-size:.9rem; opacity:.85; }
  .live-root .lv-bar-track{ flex:1; height:26px; border-radius:8px; background:rgba(255,255,255,.08); overflow:hidden; } .live-root.audience .lv-bar-track{ background:#e6e9ef; }
  .live-root .lv-bar-fill{ height:100%; border-radius:8px; background:var(--lv-yellow); transition:width .5s ease; } .live-root.audience .lv-bar-fill{ background:var(--lv-navy); }
  .live-root .lv-bar-fill.correct{ background:var(--lv-green); }
  .live-root .lv-bar-n{ width:4ch; font-size:.85rem; opacity:.75; }
  .live-root .lv-avg{ font-size:clamp(2.4rem,7vw,5rem); font-weight:800; } .live-root.presenter .lv-avg{ color:var(--lv-yellow); }
  .live-root .lv-wall-in{ display:flex; gap:8px; width:min(520px,88vw); }
  .live-root .lv-wall-in input{ flex:1; padding:14px 16px; border-radius:12px; border:2px solid #c7ccd6; font-size:1rem; min-width:0; }
  .live-root .lv-wall-in button{ padding:0 20px; border-radius:12px; border:none; background:var(--lv-navy); color:#fff; font-weight:700; }
  .live-root .lv-wall{ display:flex; flex-wrap:wrap; gap:10px; justify-content:center; width:min(1100px,92vw); }
  .live-root .lv-wall .lv-tile{ padding:10px 16px; border-radius:999px; font-size:clamp(.9rem,1.8vw,1.3rem); font-weight:600; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); animation:lvpop .4s ease; }
  .live-root.audience .lv-wall .lv-tile{ background:#fff; border:1px solid #e3e6eb; }
  @keyframes lvpop{ from{transform:scale(.8);opacity:0} to{transform:none;opacity:1} }
  .live-root .lv-note{ font-size:.95rem; opacity:.7; max-width:32ch; }
  .live-root .lv-pill{ display:inline-block; padding:6px 16px; border-radius:999px; font-weight:700; font-size:.85rem; background:rgba(255,226,0,.14); color:var(--lv-yellow); }
  .live-root.audience .lv-pill{ background:#eef1ff; color:var(--lv-navy); }
  .live-root .lv-pill.ok{ background:rgba(22,163,74,.15); color:#166534; } .live-root .lv-pill.bad{ background:rgba(225,29,72,.12); color:#9f1239; }
  .live-root .lv-roomcode-big{ font-size:clamp(2.6rem,10vw,6rem); font-weight:800; letter-spacing:.1em; } .live-root.presenter .lv-roomcode-big{ color:var(--lv-yellow); }
  .live-root .lv-joinrow{ display:flex; align-items:center; justify-content:center; gap:clamp(20px,5vw,64px); flex-wrap:wrap; }
  .live-root .lv-joincol{ display:flex; flex-direction:column; align-items:center; gap:1.4vh; }
  .live-root .lv-qrbox{ background:#fff; padding:14px; border-radius:16px; line-height:0; box-shadow:0 10px 40px rgba(0,0,0,.3); }
  .live-root .lv-qrbox svg{ width:clamp(150px,24vh,280px); height:auto; display:block; }
  .live-root .lv-cmd{ width:min(440px,94vw); background:#fff; color:#0f172a; border-radius:18px; overflow:hidden; box-shadow:0 16px 50px rgba(0,0,0,.25); text-align:left; }
  .live-root .lv-cmd .lv-band{ height:12px; background:linear-gradient(90deg,var(--lv-navy) 0 70%,var(--lv-yellow) 70% 100%); }
  .live-root .lv-cmd .lv-in{ padding:22px 24px; }
  .live-root .lv-cmd h2{ color:var(--lv-navy); font-size:1.35rem; margin:2px 0 4px; }
  .live-root .lv-cmd .lv-k{ font-size:.68rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--lv-red); }
  .live-root .lv-cmd .lv-sec{ font-size:.68rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--lv-navy); margin:15px 0 6px; }
  .live-root .lv-cmd ul{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
  .live-root .lv-cmd li{ padding-left:20px; position:relative; font-size:.98rem; }
  .live-root .lv-cmd li::before{ content:"✓"; position:absolute; left:0; color:var(--lv-red); font-weight:800; }
  .live-root .lv-cmd li.rev::before{ content:"↻"; color:var(--lv-navy); }
  .live-root .lv-cmd .lv-shift{ display:flex; align-items:center; gap:10px; font-size:1.05rem; font-weight:700; } .live-root .lv-cmd .lv-shift b{ color:var(--lv-navy); font-size:1.3rem; }
  .live-root .lv-cmd .lv-foot{ margin-top:16px; padding-top:12px; border-top:1px solid #e3e6eb; font-size:.8rem; color:#64748b; text-align:center; }
  .live-root .lv-controls{ display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; padding:12px 20px; }
  .live-root.presenter .lv-controls{ border-top:1px solid rgba(255,255,255,.08); }
  .live-root .lv-controls button{ padding:11px 20px; border-radius:12px; font-weight:700; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.06); color:#eaf0ff; }
  .live-root .lv-controls .primary{ background:var(--lv-yellow)!important; color:#111!important; border-color:var(--lv-yellow)!important; }
  .live-root .lv-controls .reveal{ background:#2b3fb3!important; color:#fff!important; border-color:#2b3fb3!important; }
  .live-root .lv-dots{ display:flex; gap:6px; align-items:center; } .live-root .lv-sdot{ width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.25); } .live-root .lv-sdot.now{ background:var(--lv-yellow); transform:scale(1.4); }
  .live-root .lv-actions{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:10px; }
  .live-root .lv-actions button{ padding:12px 22px; border-radius:999px; font-weight:800; border:none; }
  .live-root .lv-actions .save{ background:var(--lv-navy); color:#fff; }
  .live-root .lv-offline{ display:none; background:var(--lv-red); color:#fff; text-align:center; padding:8px; font-size:.85rem; font-weight:600; } .live-root .lv-offline.show{ display:block; }
  @media print{
    body > *:not(#lv-print-root){ display:none !important; }
    .live-root{ position:static; background:#fff !important; color:#0f172a !important; }
    .live-root .lv-topbar, .live-root .lv-controls, .live-root .lv-offline, .live-root .lv-actions{ display:none !important; }
    .live-root .lv-cmd{ box-shadow:none; }
  }
`;

const TOPIC_BASE = 'cocher/live';

function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
function rid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

/* ── Sync bus: MQTT (cross-device) + BroadcastChannel (same device) ──
 * Envelope {kind, payload, id}; ids dedupe the double delivery. */
function makeBus(room, broker, onStatus) {
  const base = TOPIC_BASE + '/' + room;
  const listeners = {};
  let seen = {}, seenN = 0;
  // Dedupe ids accrete one per message; cap so a marathon session can't grow
  // without bound. A wipe only risks re-emitting a message still in flight on
  // BOTH channels at that instant — vanishingly rare, and renders are idempotent.
  const mark = (id) => { if (++seenN > 6000) { seen = {}; seenN = 1; } seen[id] = 1; };
  let client = null, mqok = false;
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('cocher-live-' + room) : null;
  function emit(env) { if (!env || !env.id || seen[env.id]) return; mark(env.id); (listeners[env.kind] || []).forEach(cb => cb(env.payload)); }
  if (bc) bc.onmessage = (e) => emit(e.data);
  try {
    client = window.mqtt && window.mqtt.connect(broker, { clean: true, keepalive: 30, connectTimeout: 8000, reconnectPeriod: 4000 });
    if (client) {
      client.on('connect', () => { mqok = true; onStatus('online'); client.subscribe(base + '/#'); });
      client.on('reconnect', () => onStatus('connecting'));
      client.on('offline', () => { mqok = false; onStatus('offline'); });
      client.on('error', () => onStatus('offline'));
      client.on('close', () => { mqok = false; });
      client.on('message', (t, b) => { try { emit(JSON.parse(b.toString())); } catch { /* not ours */ } });
    } else { onStatus('offline'); }
  } catch { onStatus('offline'); }
  return {
    on(k, cb) { (listeners[k] = listeners[k] || []).push(cb); },
    publish(k, p, retain) {
      const env = { kind: k, payload: p, id: rid() };
      mark(env.id);
      if (bc) { try { bc.postMessage(env); } catch { /* closed */ } }
      if (client && mqok) { try { client.publish(base + '/' + k, JSON.stringify(env), { retain: !!retain, qos: 0 }); } catch { /* drop */ } }
    },
    destroy() {
      try { if (client) client.end(true); } catch { /* already gone */ }
      try { if (bc) bc.close(); } catch { /* already gone */ }
    },
  };
}

/**
 * Mount a live session into `host`.
 * opts: {
 *   role: 'presenter'|'audience',
 *   room: string ('' lets the audience type one on a landing),
 *   slides: [...]           (presenter only — from liveSlidesFromDeck),
 *   broker?: string,
 *   joinHref?: string       (presenter QR/link base; room is appended),
 *   joinLabel?: string      (presenter display text for the link),
 *   onExit?: () => void     (presenter Exit button / Esc; audience Leave)
 * }
 * Returns { destroy, api } — api also lands on window.__live for BOTH roles
 * (the verification suites drive the audience through it too).
 */
export function mountLive(host, opts = {}) {
  const ROLE = opts.role === 'presenter' ? 'presenter' : 'audience';
  const SLIDES = ROLE === 'presenter' ? (opts.slides || []) : null;
  const BROKER = opts.broker || DEFAULT_BROKER;
  const JOIN_HREF = opts.joinHref || '';
  const JOIN_LABEL = opts.joinLabel || JOIN_HREF;
  const CID = rid();
  let ROOM = null; let BUS = null;
  const view = { i: 0, reveal: false, slide: (SLIDES ? SLIDES[0] : { mode: 'join' }) };
  const agg = {}; const joiners = {}; const my = {};

  // Root + style (style injected once per document)
  if (!document.getElementById('lv-engine-css')) {
    const st = document.createElement('style');
    st.id = 'lv-engine-css';
    st.textContent = LIVE_ENGINE_CSS;
    document.head.appendChild(st);
  }
  const root = document.createElement('div');
  root.className = 'live-root ' + ROLE;
  root.id = 'lv-print-root';
  root.innerHTML = `
    ${ROLE === 'audience' && !opts.room ? `
    <div class="lv-landing" id="lv-landing"><div class="lv-card-l">
      <h1>Join the live session</h1><div class="lv-sub">Your teacher will show a room code on the screen.</div>
      <label for="lv-room-in">Room code</label>
      <input id="lv-room-in" maxlength="12" autocomplete="off" spellcheck="false" placeholder="ROOM">
      <button id="lv-go-join">Join →</button>
      <a id="lv-open-app" href="#" style="display:block;text-align:center;margin-top:14px;font-size:.78rem;color:#9fb0e8;text-decoration:underline;">Not joining a session? Open Co-Cher</a>
    </div></div>` : ''}
    <div class="lv-session" id="lv-session" ${ROLE === 'audience' && !opts.room ? 'style="display:none"' : ''}>
      <div class="lv-offline" id="lv-offline">Can’t reach the room — just follow the main screen. 👀</div>
      <div class="lv-topbar">
        <div class="lv-room">ROOM <span id="lv-room-lbl"></span> <small id="lv-role-lbl"></small></div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="lv-status"><span class="lv-dot" id="lv-statdot"></span><span id="lv-statlbl">connecting…</span><span id="lv-joincount"></span></div>
          <button class="lv-exit" id="lv-exit">${ROLE === 'presenter' ? '× End session' : '× Leave'}</button>
        </div>
      </div>
      <div class="lv-stage" id="lv-stage"></div>
      <div class="lv-controls" id="lv-controls"></div>
    </div>`;
  host.appendChild(root);

  const $ = (id) => root.querySelector('#' + id);
  const stage = $('lv-stage'); const controls = $('lv-controls');

  function setStatus(st) {
    const dot = $('lv-statdot'), lbl = $('lv-statlbl'), off = $('lv-offline');
    if (dot) dot.className = 'lv-dot' + (st === 'online' ? ' online' : st === 'offline' ? ' offline' : '');
    if (lbl) lbl.textContent = st === 'online' ? 'live' : st === 'offline' ? 'no network' : 'connecting…';
    if (off) off.className = 'lv-offline' + (st === 'offline' ? ' show' : '');
  }

  function cur() { return ROLE === 'presenter' ? SLIDES[view.i] : view.slide; }

  function connect(room) {
    ROOM = normRoom(room);
    const L = $('lv-landing'); if (L) L.style.display = 'none';
    $('lv-session').style.display = 'flex';
    $('lv-room-lbl').textContent = ROOM;
    $('lv-role-lbl').textContent = ROLE === 'presenter' ? '· presenting' : '· you’re in';
    BUS = makeBus(ROOM, BROKER, setStatus);
    BUS.on('state', (p) => { if (ROLE === 'audience') { view.i = p.i; view.reveal = !!p.reveal; view.slide = p.slide; render(); } });
    BUS.on('submit', (p) => { if (ROLE === 'presenter') { record(p); if (cur() && cur().id === p.slide) render(); } });
    BUS.on('hello', (p) => { if (ROLE === 'presenter') { joiners[p.cid] = 1; if (cur().mode === 'join') render(); broadcast(); } });
    if (ROLE === 'presenter') { view.i = 0; view.reveal = false; broadcast(); render(); }
    else { BUS.publish('hello', { cid: CID }); render(); }
  }
  function broadcast() { BUS.publish('state', { i: view.i, reveal: view.reveal, slide: SLIDES[view.i] }, true); }
  function go(d) { const n = Math.max(0, Math.min(SLIDES.length - 1, view.i + d)); if (n === view.i) return; view.i = n; view.reveal = false; broadcast(); render(); }
  function doReveal() { if (SLIDES[view.i].mode !== 'quiz') return; view.reveal = true; broadcast(); render(); }
  function record(p) { if (!agg[p.slide]) agg[p.slide] = []; agg[p.slide] = agg[p.slide].filter(x => x.cid !== p.cid); agg[p.slide].push({ cid: p.cid, value: p.value }); joiners[p.cid] = 1; }
  function submit(id, val) { my[id] = val; BUS.publish('submit', { slide: id, value: val, cid: CID }); render(); }

  function render() {
    const s = cur();
    if (!s) { stage.innerHTML = '<div class="lv-note">Waiting for the presenter…</div>'; return; }
    stage.innerHTML = ''; if (controls) controls.innerHTML = '';
    const jc = $('lv-joincount'); if (jc) jc.textContent = ROLE === 'presenter' ? ('· ' + Object.keys(joiners).length + ' joined') : '';
    ({ join: rJoin, watch: rWatch, poll: rPoll, quiz: rQuiz, wall: rWall, card: rCard }[s.mode] || rWatch)(s);
    if (ROLE === 'presenter') rControls(s);
  }

  function joinLink() { return JOIN_HREF ? JOIN_HREF + encodeURIComponent(ROOM) : ''; }
  function qrSvg(text) {
    try {
      if (typeof window.qrcode !== 'function' || !text) return '';
      const q = window.qrcode(0, 'M'); q.addData(text); q.make();
      return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch { return ''; }
  }

  function rJoin() {
    if (ROLE === 'presenter') {
      const link = joinLink(), svg = qrSvg(link);
      const qrCol = svg ? ('<div class="lv-joincol"><div class="lv-qrbox">' + svg + '</div><div class="lv-pill">Scan to join</div></div>') : '';
      const codeCol = '<div class="lv-joincol"><div class="lv-kicker">Join the room</div><div class="lv-roomcode-big">' + esc(ROOM) + '</div>' +
        (JOIN_LABEL ? '<div class="lv-body">or open <b>' + esc(JOIN_LABEL) + '</b><br>and enter this code</div>' : '<div class="lv-body">Open the class link on your phone and enter this code.</div>') + '</div>';
      stage.innerHTML = '<div class="lv-joinrow">' + qrCol + codeCol + '</div><div class="lv-pill" style="margin-top:1vh">' + Object.keys(joiners).length + ' joined</div>';
    } else {
      stage.innerHTML = '<div class="lv-kicker">You’re in ✓</div><div class="lv-big">Look up at the screen</div><div class="lv-body">This phone will follow along and ask for your input.</div>';
    }
  }
  function rWatch(s) {
    const bullets = (s.bullets && s.bullets.length) ? '<ul class="lv-wlist">' + s.bullets.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' : '';
    const quote = s.quote ? ('<div class="lv-big" style="font-style:italic">“' + esc(s.quote) + '”</div>' + (s.attribution ? '<div class="lv-note">— ' + esc(s.attribution) + '</div>' : '')) : '';
    stage.innerHTML = (s.kicker ? '<div class="lv-kicker">' + esc(s.kicker) + '</div>' : '') +
      (s.title ? '<div class="lv-big">' + esc(s.title) + '</div>' : '') +
      (s.subtitle ? '<div class="lv-body">' + esc(s.subtitle) + '</div>' : '') + quote + bullets;
  }
  function rPoll(s) {
    const subs = agg[s.id] || []; const vals = subs.map(x => +x.value);
    const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    if (ROLE === 'presenter') {
      const counts = [0, 0, 0, 0, 0]; vals.forEach(v => { if (v >= 1 && v <= 5) counts[v - 1]++; });
      const mx = Math.max(1, Math.max.apply(null, counts));
      const bars = counts.map((c, i) => '<div class="lv-bar-row"><div class="lv-bar-lab">' + (i + 1) + '</div><div class="lv-bar-track"><div class="lv-bar-fill" style="width:' + (c / mx * 100) + '%"></div></div><div class="lv-bar-n">' + c + '</div></div>').join('');
      stage.innerHTML = '<div class="lv-kicker">Confidence check</div><div class="lv-big" style="font-size:clamp(1.4rem,4vw,2.6rem)">' + esc(s.q) + '</div><div class="lv-avg">' + (vals.length ? avg.toFixed(1) : '—') + '</div><div class="lv-note">' + vals.length + ' response' + (vals.length === 1 ? '' : 's') + ' · out of 5</div><div class="lv-bars">' + bars + '</div>';
    } else {
      const mine = my[s.id]; let btns = '';
      for (let v = 1; v <= 5; v++) btns += '<button class="' + (mine == v ? 'sel' : '') + '" data-v="' + v + '">' + v + '</button>';
      stage.innerHTML = '<div class="lv-kicker">Your call</div><div class="lv-big" style="font-size:clamp(1.3rem,4vw,2.2rem)">' + esc(s.q) + '</div><div class="lv-scale">' + btns + '</div><div class="lv-scale-lab"><span>' + esc(s.low) + '</span><span>' + esc(s.high) + '</span></div>' + (mine ? '<div class="lv-note">You chose <b>' + mine + '</b>.</div>' : '');
      stage.querySelectorAll('.lv-scale button').forEach(b => { b.onclick = () => submit(s.id, +b.dataset.v); });
    }
  }
  function rQuiz(s) {
    const subs = agg[s.id] || []; const counts = (s.options || []).map(() => 0);
    subs.forEach(x => { if (x.value >= 0 && x.value < counts.length) counts[x.value]++; });
    const total = subs.length;
    if (ROLE === 'presenter') {
      const mx = Math.max(1, Math.max.apply(null, counts));
      const optsHtml = s.options.map((o, i) => {
        const cls = 'lv-bar-fill' + (view.reveal && i === s.answer ? ' correct' : '');
        const pct = total ? Math.round(counts[i] / total * 100) : 0;
        return '<div class="lv-bar-row"><div class="lv-bar-lab">' + (view.reveal && i === s.answer ? '✓ ' : '') + esc(o) + '</div><div class="lv-bar-track"><div class="' + cls + '" style="width:' + (counts[i] / mx * 100) + '%"></div></div><div class="lv-bar-n">' + pct + '%</div></div>';
      }).join('');
      stage.innerHTML = '<div class="lv-kicker">Predict &amp; reveal</div><div class="lv-big" style="font-size:clamp(1.4rem,4vw,2.6rem)">' + esc(s.q) + '</div><div class="lv-note">' + total + ' vote' + (total === 1 ? '' : 's') + (view.reveal ? ' · revealed' : '') + '</div><div class="lv-bars">' + optsHtml + '</div>' + (view.reveal && s.why ? '<div class="lv-body" style="font-size:clamp(.95rem,2vw,1.3rem)">' + esc(s.why) + '</div>' : '');
    } else {
      const mine = my[s.id];
      const btns = s.options.map((o, i) => {
        let cls = '';
        if (view.reveal) { if (i === s.answer) cls = 'correct'; else if (mine === i) cls = 'wrongsel'; }
        else if (mine === i) cls = 'sel';
        return '<button class="' + cls + '" data-i="' + i + '"' + (view.reveal ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('');
      const verdict = (view.reveal && mine != null) ? (mine === s.answer ? '<div class="lv-pill ok">You got it ✓</div>' : '<div class="lv-pill bad">Revisit this one</div>') : (mine != null ? '<div class="lv-note">Locked in. Waiting for the reveal…</div>' : '');
      stage.innerHTML = '<div class="lv-kicker">Predict</div><div class="lv-big" style="font-size:clamp(1.3rem,4vw,2.2rem)">' + esc(s.q) + '</div><div class="lv-qopts">' + btns + '</div>' + verdict + (view.reveal && s.why ? '<div class="lv-note">' + esc(s.why) + '</div>' : '');
      stage.querySelectorAll('.lv-qopts button').forEach(b => { b.onclick = () => { if (!view.reveal) submit(s.id, +b.dataset.i); }; });
    }
  }
  function rWall(s) {
    const subs = agg[s.id] || [];
    if (ROLE === 'presenter') {
      const tiles = subs.map(x => '<div class="lv-tile">' + esc(x.value) + '</div>').join('');
      stage.innerHTML = '<div class="lv-kicker">Everyone’s answers</div><div class="lv-big" style="font-size:clamp(1.4rem,4vw,2.6rem)">' + esc(s.q) + '</div>' + (subs.length ? '<div class="lv-wall">' + tiles + '</div>' : '<div class="lv-note">Waiting for the room…</div>');
    } else {
      const mine = my[s.id];
      stage.innerHTML = '<div class="lv-kicker">Add to the wall</div><div class="lv-big" style="font-size:clamp(1.3rem,4vw,2.2rem)">' + esc(s.q) + '</div><div class="lv-wall-in"><input id="lv-wl" placeholder="' + esc(s.placeholder || '') + '" maxlength="48" value="' + esc(mine || '') + '"><button id="lv-ws">Send</button></div>' + (mine ? '<div class="lv-note">Sent: <b>' + esc(mine) + '</b></div>' : '');
      const inp = stage.querySelector('#lv-wl');
      const send = () => { const v = (inp.value || '').trim(); if (v) submit(s.id, v); };
      stage.querySelector('#lv-ws').onclick = send;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    }
  }
  function rCard(s) {
    if (ROLE === 'presenter') {
      const cin = agg[s.pollIn] || [], cout = agg[s.pollOut] || [];
      const avg = (a) => { const v = a.map(x => +x.value); return v.length ? (v.reduce((p, q) => p + q, 0) / v.length) : 0; };
      let right = 0, tot = 0;
      (s.quizzes || []).forEach(q => { (agg[q.id] || []).forEach(x => { tot++; if (x.value === q.answer) right++; }); });
      stage.innerHTML = '<div class="lv-kicker">That’s a wrap</div><div class="lv-big">Everyone has their card</div><div class="lv-body">Confidence ' + (cin.length ? avg(cin).toFixed(1) : '—') + ' → ' + (cout.length ? avg(cout).toFixed(1) : '—') + ' · ' + (tot ? Math.round(right / tot * 100) : 0) + '% of predictions correct · ' + ((agg[s.wallId] || []).length) + ' on the wall.</div><div class="lv-actions"><button class="save" id="lv-exp">⬇ Export the room’s input</button></div>';
      stage.querySelector('#lv-exp').onclick = () => {
        const out = { room: ROOM, exportedAt: new Date().toISOString(), joined: Object.keys(joiners).length, results: agg };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
        a.download = 'live-' + ROOM + '.json';
        document.body.appendChild(a); a.click(); a.remove();
      };
    } else {
      const got = [], rev = [];
      (s.quizzes || []).forEach(q => { if (my[q.id] == null) rev.push(q.label); else if (my[q.id] === q.answer) got.push(q.label); else rev.push(q.label); });
      stage.innerHTML = '<div class="lv-cmd"><div class="lv-band"></div><div class="lv-in">' +
        '<div class="lv-k">Your command card</div><h2>' + esc(s.title || 'Today’s learning') + '</h2>' +
        '<div class="lv-sec">Your confidence</div><div class="lv-shift"><b>' + (my[s.pollIn] || '—') + '</b> → <b>' + (my[s.pollOut] || '—') + '</b> <span style="opacity:.6;font-weight:500">out of 5</span></div>' +
        (got.length ? '<div class="lv-sec">You nailed</div><ul>' + got.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '') +
        (rev.length ? '<div class="lv-sec">Revisit</div><ul>' + rev.map(t => '<li class="rev">' + esc(t) + '</li>').join('') + '</ul>' : '') +
        (my[s.wallId] ? '<div class="lv-sec">Your takeaway</div><div>“' + esc(my[s.wallId]) + '”</div>' : '') +
        ((s.frames && s.frames.length) ? '<div class="lv-sec">Keep these</div><ul>' + s.frames.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' : '') +
        '<div class="lv-foot">Co-Cher · yours to keep</div></div></div><div class="lv-actions"><button class="save" id="lv-print">Save as PDF</button></div>';
      stage.querySelector('#lv-print').onclick = () => window.print();
    }
  }
  function rControls(s) {
    if (!controls) return;
    const dots = SLIDES.map((_, i) => '<span class="lv-sdot' + (i === view.i ? ' now' : '') + '"></span>').join('');
    const rev = (s.mode === 'quiz' && !view.reveal) ? '<button class="reveal" id="lv-cr">Reveal (R)</button>' : '';
    controls.innerHTML = '<button id="lv-cp" ' + (view.i === 0 ? 'disabled' : '') + '>← Back</button><div class="lv-dots">' + dots + '</div>' + rev + '<button class="primary" id="lv-cn" ' + (view.i === SLIDES.length - 1 ? 'disabled' : '') + '>Next →</button>';
    controls.querySelector('#lv-cp').onclick = () => go(-1);
    controls.querySelector('#lv-cn').onclick = () => go(1);
    const cr = controls.querySelector('#lv-cr'); if (cr) cr.onclick = doReveal;
  }

  // Exit + presenter keyboard
  const exit = () => { if (typeof opts.onExit === 'function') opts.onExit(); };
  $('lv-exit').addEventListener('click', exit);
  const onKey = (e) => {
    if (ROLE !== 'presenter') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    else if (e.key === 'r' || e.key === 'R') { doReveal(); }
    else if (e.key === 'Escape') { if (!document.fullscreenElement) exit(); }
  };
  document.addEventListener('keydown', onKey);

  // Boot
  if (ROLE === 'presenter') {
    connect(opts.room || 'ROOM');
  } else if (opts.room) {
    connect(opts.room);
  } else {
    const ri = $('lv-room-in'); const jb = $('lv-go-join');
    if (jb) jb.onclick = () => connect(ri.value);
    if (ri) ri.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(ri.value); });
    // Escape hatch for a teacher who landed here (the #/join boot path skips
    // the whole app shell): reload without the hash → normal Co-Cher boot.
    const oa = $('lv-open-app');
    if (oa) oa.addEventListener('click', (e) => { e.preventDefault(); location.replace(location.pathname + location.search); });
  }

  const api = { get view() { return view; }, get agg() { return agg; }, get my() { return my; }, go, doReveal, connect };
  window.__live = api;

  return {
    api,
    destroy() {
      document.removeEventListener('keydown', onKey);
      try { if (BUS) BUS.destroy(); } catch { /* gone */ }
      if (window.__live === api) delete window.__live;
      root.remove();
    },
  };
}
