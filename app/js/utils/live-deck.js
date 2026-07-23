/*
 * Co-Cher — Live Session (deck → two-device workshop)
 * ===================================================
 * Turns a compiled deck into a LIVE session teachers can switch on: the
 * presenter drives on the projector, students open one generic hosted page
 * (`live/join.html`) on their phones, join with a room code, and follow +
 * submit in lockstep. Sync is MQTT-over-WebSockets on a public broker
 * (HiveMQ by default; overridable in Settings) plus a same-device
 * BroadcastChannel for rehearsal. Nothing is stored server-side.
 *
 * The presenter broadcasts each slide's CONTENT (not just an index), so the
 * join page is content-agnostic — it renders whatever arrives. The session
 * ends with a personalised command card each phone builds from its own answers.
 *
 * This module is the single source of truth for the runtime engine
 * (LIVE_ENGINE_JS). `compileLivePresenterHTML` bakes the deck's slides in for
 * the projector; `compileLiveJoinHTML` produces the generic phone page (used to
 * generate the hosted live/join.html). mqtt.js is loaded from a hosted URL (a
 * live session needs the network anyway), not inlined.
 */

export const DEFAULT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';

/** Normalise a room code the same way on presenter and phone. */
export function normRoom(s) {
  return String(s || '').replace(/[\s-]+/g, '').toUpperCase().slice(0, 12) || 'ROOM';
}

/* ── Build the live slide list from a normal deck ──
 * join → confidence poll (in) → deck slides (watch, or an interaction the deck
 * declares) → word-wall → confidence poll (out) → command card. */
export function liveSlidesFromDeck(deck) {
  const src = Array.isArray(deck?.slides) ? deck.slides : [];
  const out = [];
  out.push({ mode: 'join' });
  out.push({ mode: 'poll', id: 'confIn', q: 'Before we start — how sure are you about today’s topic?', low: 'Not yet', high: 'Very sure' });

  const quizzes = [];
  src.forEach((s, i) => {
    const it = s.interaction;
    if (it && it.type === 'quiz' && Array.isArray(it.options) && it.options.length >= 2) {
      const id = 'q' + i;
      out.push({ mode: 'quiz', id, q: it.q || s.title || 'Predict', options: it.options.slice(0, 4), answer: Math.max(0, Math.min(it.options.length - 1, it.answer | 0)), why: it.why || '' });
      quizzes.push({ id, label: it.label || it.q || s.title || 'Question', answer: out[out.length - 1].answer });
    } else if (it && it.type === 'poll') {
      out.push({ mode: 'poll', id: 'p' + i, q: it.q || s.title || 'Your view', low: it.low || 'Low', high: it.high || 'High' });
    } else if (it && it.type === 'wall') {
      out.push({ mode: 'wall', id: 'w' + i, q: it.q || s.title || 'Your answer', placeholder: it.placeholder || '' });
    } else {
      out.push(watchFromSlide(s));
    }
  });

  out.push({ mode: 'wall', id: 'wall', q: deck?.wallPrompt || 'One thing you’re taking away from today?', placeholder: 'in a few words…' });
  out.push({ mode: 'poll', id: 'confOut', q: 'And now — how sure are you?', low: 'Not yet', high: 'Very sure' });
  out.push({
    mode: 'card',
    title: deck?.title || 'Today’s learning',
    frames: (deck?.cardFrames && deck.cardFrames.length ? deck.cardFrames : deriveFrames(deck)).slice(0, 4),
    quizzes, pollIn: 'confIn', pollOut: 'confOut', wallId: 'wall',
  });
  return out;
}

function watchFromSlide(s) {
  const bullets = (Array.isArray(s.bullets) ? s.bullets : []).filter(Boolean).slice(0, 6);
  return {
    mode: 'watch',
    kicker: s.kicker || (s.layout === 'section' ? 'Section' : ''),
    title: s.title || s.statement || '',
    statement: s.statement || '',
    quote: s.quote || '', attribution: s.attribution || '',
    subtitle: s.subtitle || '',
    bullets,
  };
}

/* A few "keep these" frames if the deck doesn't supply its own. */
function deriveFrames(deck) {
  const frames = [];
  const src = Array.isArray(deck?.slides) ? deck.slides : [];
  src.forEach(s => {
    if (frames.length >= 4) return;
    if (s.statement) frames.push(String(s.statement).slice(0, 90));
    else if (s.layout === 'exit' && Array.isArray(s.bullets) && s.bullets[0]) frames.push(String(s.bullets[0]).slice(0, 90));
  });
  if (!frames.length && deck?.title) frames.push(String(deck.title).slice(0, 90));
  return frames;
}

/* ══════════ The runtime engine (shared by presenter + join page) ══════════
 * A single string so the two surfaces can never drift. Reads window.__ROLE,
 * window.__ROOM, window.__SLIDES (presenter only), window.__BROKER,
 * window.__JOIN_URL. */
export const LIVE_ENGINE_JS = String.raw`
(function(){
  "use strict";
  var BROKER = window.__BROKER || 'wss://broker.hivemq.com:8884/mqtt';
  var TOPIC_BASE = 'cocher/live';
  var ROLE = window.__ROLE;                 // 'presenter' | 'audience'
  var SLIDES = window.__SLIDES || null;     // presenter only
  var JOIN_URL = window.__JOIN_URL || '';
  var CID = Math.random().toString(36).slice(2)+Date.now().toString(36);
  var ROOM=null, BUS=null;
  var view = { i:0, reveal:false, slide:(SLIDES?SLIDES[0]:{mode:'join'}) };
  var agg = {}; var joiners = {}; var my = {};

  function esc(s){ var d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; }
  function norm(s){ return String(s||'').replace(/[\s-]+/g,'').toUpperCase().slice(0,12)||'ROOM'; }
  function rid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function cur(){ return ROLE==='presenter' ? SLIDES[view.i] : view.slide; }

  function makeBus(room,onStatus){
    var base=TOPIC_BASE+'/'+room, listeners={}, seen={}, client=null, mqok=false;
    var bc=('BroadcastChannel' in window)?new BroadcastChannel('cocher-live-'+room):null;
    function emit(env){ if(!env||!env.id||seen[env.id])return; seen[env.id]=1; (listeners[env.kind]||[]).forEach(function(cb){cb(env.payload);}); }
    if(bc) bc.onmessage=function(e){ emit(e.data); };
    try{
      client=window.mqtt.connect(BROKER,{clean:true,keepalive:30,connectTimeout:8000,reconnectPeriod:4000});
      client.on('connect',function(){ mqok=true; onStatus('online'); client.subscribe(base+'/#'); });
      client.on('reconnect',function(){ onStatus('connecting'); });
      client.on('offline',function(){ mqok=false; onStatus('offline'); });
      client.on('error',function(){ onStatus('offline'); });
      client.on('close',function(){ mqok=false; });
      client.on('message',function(t,b){ try{ emit(JSON.parse(b.toString())); }catch(e){} });
    }catch(e){ onStatus('offline'); }
    return {
      on:function(k,cb){ (listeners[k]=listeners[k]||[]).push(cb); },
      publish:function(k,p,retain){ var env={kind:k,payload:p,id:rid()}; seen[env.id]=1; if(bc)bc.postMessage(env); if(client&&mqok){try{client.publish(base+'/'+k,JSON.stringify(env),{retain:!!retain,qos:0});}catch(e){}} }
    };
  }

  function setStatus(st){
    var dot=document.getElementById('statdot'),lbl=document.getElementById('statlbl'),off=document.getElementById('offline');
    if(dot) dot.className='dot'+(st==='online'?' online':st==='offline'?' offline':'');
    if(lbl) lbl.textContent= st==='online'?'live': st==='offline'?'no network':'connecting…';
    if(off) off.className='offline-banner'+(st==='offline'?' show':'');
  }

  function connect(room){
    ROOM=norm(room);
    document.body.classList.add(ROLE);
    var L=document.getElementById('landing'); if(L) L.style.display='none';
    document.getElementById('session').style.display='flex';
    var rl=document.getElementById('room-lbl'); if(rl) rl.textContent=ROOM;
    var role=document.getElementById('role-lbl'); if(role) role.textContent= ROLE==='presenter'?'· presenting':'· you’re in';
    BUS=makeBus(ROOM,setStatus);
    BUS.on('state',function(p){ if(ROLE==='audience'){ view={i:p.i,reveal:!!p.reveal,slide:p.slide}; render(); } });
    BUS.on('submit',function(p){ if(ROLE==='presenter'){ record(p); if(cur() && cur().id===p.slide) render(); } });
    BUS.on('hello',function(p){ if(ROLE==='presenter'){ joiners[p.cid]=1; if(cur().mode==='join') render(); broadcast(); } });
    if(ROLE==='presenter'){ view.i=0; view.reveal=false; broadcast(); render();
      document.addEventListener('keydown',function(e){
        if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(1);}
        else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(-1);}
        else if(e.key==='r'||e.key==='R'){ doReveal(); }
      });
    } else { BUS.publish('hello',{cid:CID}); render(); }
  }
  function broadcast(){ BUS.publish('state',{i:view.i,reveal:view.reveal,slide:SLIDES[view.i]},true); }
  function go(d){ var n=Math.max(0,Math.min(SLIDES.length-1,view.i+d)); if(n===view.i)return; view.i=n; view.reveal=false; broadcast(); render(); }
  function doReveal(){ if(SLIDES[view.i].mode!=='quiz')return; view.reveal=true; broadcast(); render(); }
  function record(p){ if(!agg[p.slide])agg[p.slide]=[]; agg[p.slide]=agg[p.slide].filter(function(x){return x.cid!==p.cid;}); agg[p.slide].push({cid:p.cid,value:p.value}); joiners[p.cid]=1; }
  function submit(id,val){ my[id]=val; BUS.publish('submit',{slide:id,value:val,cid:CID}); render(); }

  function render(){
    var s=cur(); var stage=document.getElementById('stage'), controls=document.getElementById('controls');
    if(!s){ stage.innerHTML='<div class="note">Waiting for the presenter…</div>'; return; }
    stage.innerHTML=''; if(controls) controls.innerHTML='';
    var jc=document.getElementById('joincount'); if(jc) jc.textContent= ROLE==='presenter'?('· '+Object.keys(joiners).length+' joined'):'';
    ({join:rJoin,watch:rWatch,poll:rPoll,quiz:rQuiz,wall:rWall,card:rCard}[s.mode]||rWatch)(stage,s);
    if(ROLE==='presenter') rControls(controls,s);
  }
  function joinLink(){ if(!JOIN_URL) return ''; return JOIN_URL + (JOIN_URL.indexOf('?')>=0?'&':'?') + 'room=' + encodeURIComponent(ROOM); }
  function qrSvg(text){
    try{ if(typeof window.qrcode!=='function'||!text) return '';
      var q=window.qrcode(0,'M'); q.addData(text); q.make();
      return q.createSvgTag({cellSize:6,margin:2,scalable:true});
    }catch(e){ return ''; }
  }
  function rJoin(stage){
    if(ROLE==='presenter'){
      var link=joinLink(), svg=qrSvg(link);
      var qrCol=svg?('<div class="joincol"><div class="qrbox">'+svg+'</div><div class="pill">Scan to join</div></div>'):'';
      var codeCol='<div class="joincol"><div class="kicker">Join the room</div><div class="roomcode-big">'+esc(ROOM)+'</div>'+
        (JOIN_URL?'<div class="body">or open <b>'+esc(JOIN_URL)+'</b><br>and enter this code</div>':'<div class="body">Open the class link on your phone and enter this code.</div>')+'</div>';
      stage.innerHTML='<div class="joinrow">'+qrCol+codeCol+'</div><div class="pill" style="margin-top:1vh">'+Object.keys(joiners).length+' joined</div>';
    } else { stage.innerHTML='<div class="kicker">You’re in ✓</div><div class="big">Look up at the screen</div><div class="body">This phone will follow along and ask for your input.</div>'; }
  }
  function rWatch(stage,s){
    var bullets=(s.bullets&&s.bullets.length)?'<ul class="wlist">'+s.bullets.map(function(b){return '<li>'+esc(b)+'</li>';}).join('')+'</ul>':'';
    var quote=s.quote?('<div class="big" style="font-style:italic">“'+esc(s.quote)+'”</div>'+(s.attribution?'<div class="note">— '+esc(s.attribution)+'</div>':'')):'';
    stage.innerHTML=(s.kicker?'<div class="kicker">'+esc(s.kicker)+'</div>':'')+
      (s.title?'<div class="big">'+esc(s.title)+'</div>':'')+
      (s.subtitle?'<div class="body">'+esc(s.subtitle)+'</div>':'')+ quote + bullets;
  }
  function rPoll(stage,s){
    var subs=agg[s.id]||[]; var vals=subs.map(function(x){return +x.value;});
    var avg=vals.length?(vals.reduce(function(a,b){return a+b;},0)/vals.length):0;
    if(ROLE==='presenter'){
      var counts=[0,0,0,0,0]; vals.forEach(function(v){ if(v>=1&&v<=5)counts[v-1]++; }); var mx=Math.max(1,Math.max.apply(null,counts));
      var bars=counts.map(function(c,i){return '<div class="bar-row"><div class="bar-lab">'+(i+1)+'</div><div class="bar-track"><div class="bar-fill" style="width:'+(c/mx*100)+'%"></div></div><div class="bar-n">'+c+'</div></div>';}).join('');
      stage.innerHTML='<div class="kicker">Confidence check</div><div class="big" style="font-size:clamp(1.4rem,4vw,2.6rem)">'+esc(s.q)+'</div><div class="avg">'+(vals.length?avg.toFixed(1):'—')+'</div><div class="note">'+vals.length+' response'+(vals.length===1?'':'s')+' · out of 5</div><div class="bars">'+bars+'</div>';
    } else {
      var mine=my[s.id],btns=''; for(var v=1;v<=5;v++) btns+='<button class="'+(mine==v?'sel':'')+'" data-v="'+v+'">'+v+'</button>';
      stage.innerHTML='<div class="kicker">Your call</div><div class="big" style="font-size:clamp(1.3rem,4vw,2.2rem)">'+esc(s.q)+'</div><div class="scale">'+btns+'</div><div class="scale-lab"><span>'+esc(s.low)+'</span><span>'+esc(s.high)+'</span></div>'+(mine?'<div class="note">You chose <b>'+mine+'</b>.</div>':'');
      Array.prototype.forEach.call(stage.querySelectorAll('.scale button'),function(b){ b.onclick=function(){ submit(s.id,+b.dataset.v); }; });
    }
  }
  function rQuiz(stage,s){
    var subs=agg[s.id]||[]; var counts=(s.options||[]).map(function(){return 0;}); subs.forEach(function(x){ if(x.value>=0&&x.value<counts.length)counts[x.value]++; }); var total=subs.length;
    if(ROLE==='presenter'){
      var mx=Math.max(1,Math.max.apply(null,counts));
      var opts=s.options.map(function(o,i){ var cls='bar-fill'+(view.reveal&&i===s.answer?' correct':''); var pct=total?Math.round(counts[i]/total*100):0; return '<div class="bar-row"><div class="bar-lab">'+(view.reveal&&i===s.answer?'✓ ':'')+esc(o)+'</div><div class="bar-track"><div class="'+cls+'" style="width:'+(counts[i]/mx*100)+'%"></div></div><div class="bar-n">'+pct+'%</div></div>'; }).join('');
      stage.innerHTML='<div class="kicker">Predict &amp; reveal</div><div class="big" style="font-size:clamp(1.4rem,4vw,2.6rem)">'+esc(s.q)+'</div><div class="note">'+total+' vote'+(total===1?'':'s')+(view.reveal?' · revealed':'')+'</div><div class="bars">'+opts+'</div>'+(view.reveal&&s.why?'<div class="body" style="font-size:clamp(.95rem,2vw,1.3rem)">'+esc(s.why)+'</div>':'');
    } else {
      var mine=my[s.id];
      var btns=s.options.map(function(o,i){ var cls=''; if(view.reveal){ if(i===s.answer)cls='correct'; else if(mine===i)cls='wrongsel'; } else if(mine===i)cls='sel'; return '<button class="'+cls+'" data-i="'+i+'"'+(view.reveal?' disabled':'')+'>'+esc(o)+'</button>'; }).join('');
      var verdict= (view.reveal&&mine!=null)?(mine===s.answer?'<div class="pill ok">You got it ✓</div>':'<div class="pill bad">Revisit this one</div>'):(mine!=null?'<div class="note">Locked in. Waiting for the reveal…</div>':'');
      stage.innerHTML='<div class="kicker">Predict</div><div class="big" style="font-size:clamp(1.3rem,4vw,2.2rem)">'+esc(s.q)+'</div><div class="qopts">'+btns+'</div>'+verdict+(view.reveal&&s.why?'<div class="note">'+esc(s.why)+'</div>':'');
      Array.prototype.forEach.call(stage.querySelectorAll('.qopts button'),function(b){ b.onclick=function(){ if(!view.reveal) submit(s.id,+b.dataset.i); }; });
    }
  }
  function rWall(stage,s){
    var subs=agg[s.id]||[];
    if(ROLE==='presenter'){
      var tiles=subs.map(function(x){return '<div class="tile">'+esc(x.value)+'</div>';}).join('');
      stage.innerHTML='<div class="kicker">Everyone’s answers</div><div class="big" style="font-size:clamp(1.4rem,4vw,2.6rem)">'+esc(s.q)+'</div>'+(subs.length?'<div class="wall">'+tiles+'</div>':'<div class="note">Waiting for the room…</div>');
    } else {
      var mine=my[s.id];
      stage.innerHTML='<div class="kicker">Add to the wall</div><div class="big" style="font-size:clamp(1.3rem,4vw,2.2rem)">'+esc(s.q)+'</div><div class="wall-in"><input id="wl" placeholder="'+esc(s.placeholder||'')+'" maxlength="48" value="'+esc(mine||'')+'"><button id="ws">Send</button></div>'+(mine?'<div class="note">Sent: <b>'+esc(mine)+'</b></div>':'');
      var inp=stage.querySelector('#wl'); function send(){ var v=(inp.value||'').trim(); if(v) submit(s.id,v); }
      stage.querySelector('#ws').onclick=send; inp.addEventListener('keydown',function(e){ if(e.key==='Enter')send(); });
    }
  }
  function rCard(stage,s){
    if(ROLE==='presenter'){
      var cin=agg[s.pollIn]||[],cout=agg[s.pollOut]||[]; var avg=function(a){var v=a.map(function(x){return +x.value;});return v.length?(v.reduce(function(p,q){return p+q;},0)/v.length):0;};
      var right=0,tot=0; (s.quizzes||[]).forEach(function(q){ (agg[q.id]||[]).forEach(function(x){ tot++; if(x.value===q.answer)right++; }); });
      stage.innerHTML='<div class="kicker">That’s a wrap</div><div class="big">Everyone has their card</div><div class="body">Confidence '+(cin.length?avg(cin).toFixed(1):'—')+' → '+(cout.length?avg(cout).toFixed(1):'—')+' · '+(tot?Math.round(right/tot*100):0)+'% of predictions correct · '+((agg[s.wallId]||[]).length)+' on the wall.</div><div class="actions"><button class="save" id="exp">⬇ Export the room’s input</button></div>';
      stage.querySelector('#exp').onclick=function(){ var out={room:ROOM,exportedAt:new Date().toISOString(),joined:Object.keys(joiners).length,results:agg}; var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})); a.download='live-'+ROOM+'.json'; document.body.appendChild(a); a.click(); a.remove(); };
    } else {
      var got=[],rev=[]; (s.quizzes||[]).forEach(function(q){ if(my[q.id]==null)rev.push(q.label); else if(my[q.id]===q.answer)got.push(q.label); else rev.push(q.label); });
      var html='<div class="cmd"><div class="band"></div><div class="in">'+
        '<div class="k">Your command card</div><h2>'+esc(s.title||'Today’s learning')+'</h2>'+
        '<div class="sec">Your confidence</div><div class="shift"><b>'+(my[s.pollIn]||'—')+'</b> → <b>'+(my[s.pollOut]||'—')+'</b> <span style="opacity:.6;font-weight:500">out of 5</span></div>'+
        (got.length?'<div class="sec">You nailed</div><ul>'+got.map(function(t){return '<li>'+esc(t)+'</li>';}).join('')+'</ul>':'')+
        (rev.length?'<div class="sec">Revisit</div><ul>'+rev.map(function(t){return '<li style="list-style:none">↻ '+esc(t)+'</li>';}).join('')+'</ul>':'')+
        (my[s.wallId]?'<div class="sec">Your takeaway</div><div>“'+esc(my[s.wallId])+'”</div>':'')+
        ((s.frames&&s.frames.length)?'<div class="sec">Keep these</div><ul>'+s.frames.map(function(f){return '<li>'+esc(f)+'</li>';}).join('')+'</ul>':'')+
        '<div class="foot">Co-Cher · yours to keep</div></div></div><div class="actions"><button class="save" onclick="window.print()">Save as PDF</button></div>';
      stage.innerHTML=html;
    }
  }
  function rControls(controls,s){
    if(!controls) return;
    var dots=SLIDES.map(function(_,i){return '<span class="sdot'+(i===view.i?' now':'')+'"></span>';}).join('');
    var rev=(s.mode==='quiz'&&!view.reveal)?'<button class="reveal" id="cr">Reveal (R)</button>':'';
    controls.innerHTML='<button id="cp" '+(view.i===0?'disabled':'')+'>← Back</button><div class="dots">'+dots+'</div>'+rev+'<button class="primary" id="cn" '+(view.i===SLIDES.length-1?'disabled':'')+'>Next →</button>';
    controls.querySelector('#cp').onclick=function(){go(-1);}; controls.querySelector('#cn').onclick=function(){go(1);};
    if(controls.querySelector('#cr')) controls.querySelector('#cr').onclick=doReveal;
  }

  // boot
  function qs(){ var o={}; location.search.slice(1).split('&').forEach(function(p){ if(!p)return; var kv=p.split('='); o[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1]||''); }); return o; }
  var params=qs();
  window.__live={ get view(){return view;}, get agg(){return agg;}, get my(){return my;}, go:go, doReveal:doReveal, connect:connect };
  if(ROLE==='presenter'){ connect(window.__ROOM || params.room || 'ROOM'); }
  else {
    // audience: landing to enter a room code (or ?room= auto-joins)
    var ri=document.getElementById('room-in'); if(ri && params.room) ri.value=norm(params.room);
    var jb=document.getElementById('go-join'); if(jb) jb.onclick=function(){ connect(document.getElementById('room-in').value); };
    if(params.room) connect(params.room);
  }
})();
`;

/* Shared CSS for both surfaces. */
export const LIVE_CSS = String.raw`
  :root{ --navy:#000C53; --yellow:#FFE200; --red:#e11d48; --green:#16a34a; }
  *{ margin:0; padding:0; box-sizing:border-box; } html,body{ height:100%; }
  body{ font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; -webkit-font-smoothing:antialiased; }
  button{ font:inherit; cursor:pointer; }
  #landing{ min-height:100%; display:flex; align-items:center; justify-content:center; padding:24px; background:radial-gradient(1200px 600px at 50% -10%,#10206b,#060a22); color:#fff; }
  .card-l{ width:min(440px,94vw); background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); border-radius:20px; padding:28px; }
  .card-l h1{ font-size:1.4rem; margin-bottom:4px; } .card-l .sub{ color:#b9c2e6; font-size:.9rem; margin-bottom:18px; }
  .card-l label{ display:block; font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:#9fb0e8; margin:10px 0 6px; }
  .card-l input{ width:100%; padding:12px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.2); background:rgba(0,0,0,.25); color:#fff; font-size:1.1rem; letter-spacing:.12em; text-transform:uppercase; }
  .card-l button{ width:100%; margin-top:16px; padding:14px; border-radius:14px; border:none; background:linear-gradient(135deg,#2b3fb3,#1a2570); color:#fff; font-weight:700; font-size:1rem; }
  #session{ display:none; min-height:100%; flex-direction:column; }
  body.presenter #session{ background:#070b24; color:#eaf0ff; } body.audience #session{ background:#f4f5f7; color:#0f172a; }
  .topbar{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:12px 20px; }
  body.presenter .topbar{ border-bottom:1px solid rgba(255,255,255,.08); } body.audience .topbar{ border-bottom:1px solid #e3e6eb; }
  .room{ font-weight:800; letter-spacing:.14em; } .room small{ font-weight:600; letter-spacing:.06em; opacity:.6; }
  .status{ display:inline-flex; align-items:center; gap:7px; font-size:.78rem; opacity:.85; }
  .dot{ width:9px; height:9px; border-radius:50%; background:#f59e0b; } .dot.online{ background:var(--green); } .dot.offline{ background:var(--red); }
  .stage{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:4vh 6vw; gap:2.2vh; min-height:0; overflow-y:auto; }
  .kicker{ font-size:clamp(.72rem,1.6vw,1rem); font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
  body.presenter .kicker{ color:var(--yellow); } body.audience .kicker{ color:var(--red); }
  .big{ font-size:clamp(1.6rem,5vw,3.4rem); font-weight:800; line-height:1.12; max-width:24ch; }
  .body{ font-size:clamp(1rem,2.3vw,1.5rem); opacity:.85; max-width:34ch; line-height:1.45; }
  .wlist{ list-style:none; display:flex; flex-direction:column; gap:1.2vh; text-align:left; max-width:30ch; } .wlist li{ font-size:clamp(1rem,2.2vw,1.5rem); padding-left:1.1em; position:relative; } .wlist li::before{ content:"•"; position:absolute; left:0; color:var(--yellow); } body.audience .wlist li::before{ color:var(--navy); }
  .scale{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; } .scale button{ width:60px; height:60px; border-radius:16px; font-size:1.3rem; font-weight:800; border:2px solid #c7ccd6; background:transparent; color:inherit; } .scale button.sel{ background:var(--navy); border-color:var(--navy); color:#fff; }
  .scale-lab{ display:flex; justify-content:space-between; width:min(420px,80vw); font-size:.8rem; opacity:.6; }
  .qopts{ display:flex; flex-direction:column; gap:12px; width:min(520px,86vw); } .qopts button{ padding:15px 18px; border-radius:14px; text-align:left; font-size:1.05rem; font-weight:600; border:2px solid #c7ccd6; background:#fff; color:#0f172a; } body.presenter .qopts button{ border-color:rgba(255,255,255,.18); background:rgba(255,255,255,.04); color:#eaf0ff; } .qopts button.sel{ border-color:var(--navy); background:#eef1ff; } .qopts button.correct{ border-color:var(--green)!important; background:rgba(22,163,74,.14)!important; } .qopts button.wrongsel{ border-color:var(--red)!important; background:rgba(225,29,72,.10)!important; }
  .bars{ display:flex; flex-direction:column; gap:10px; width:min(560px,86vw); } .bar-row{ display:flex; align-items:center; gap:10px; } .bar-lab{ width:11ch; text-align:right; font-size:.9rem; opacity:.85; } .bar-track{ flex:1; height:26px; border-radius:8px; background:rgba(255,255,255,.08); overflow:hidden; } body.audience .bar-track{ background:#e6e9ef; } .bar-fill{ height:100%; border-radius:8px; background:var(--yellow); transition:width .5s ease; } body.audience .bar-fill{ background:var(--navy); } .bar-fill.correct{ background:var(--green); } .bar-n{ width:4ch; font-size:.85rem; opacity:.75; }
  .avg{ font-size:clamp(2.4rem,7vw,5rem); font-weight:800; } body.presenter .avg{ color:var(--yellow); }
  .wall-in{ display:flex; gap:8px; width:min(520px,88vw); } .wall-in input{ flex:1; padding:14px 16px; border-radius:12px; border:2px solid #c7ccd6; font-size:1rem; } .wall-in button{ padding:0 20px; border-radius:12px; border:none; background:var(--navy); color:#fff; font-weight:700; }
  .wall{ display:flex; flex-wrap:wrap; gap:10px; justify-content:center; width:min(1100px,92vw); } .wall .tile{ padding:10px 16px; border-radius:999px; font-size:clamp(.9rem,1.8vw,1.3rem); font-weight:600; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.14); animation:pop .4s ease; } body.audience .wall .tile{ background:#fff; border:1px solid #e3e6eb; } @keyframes pop{ from{transform:scale(.8);opacity:0} to{transform:none;opacity:1} }
  .note{ font-size:.95rem; opacity:.7; max-width:32ch; } .pill{ display:inline-block; padding:6px 16px; border-radius:999px; font-weight:700; font-size:.85rem; background:rgba(255,226,0,.14); color:var(--yellow); } body.audience .pill{ background:#eef1ff; color:var(--navy); } .pill.ok{ background:rgba(22,163,74,.15); color:#166534; } .pill.bad{ background:rgba(225,29,72,.12); color:#9f1239; }
  .roomcode-big{ font-size:clamp(2.6rem,10vw,6rem); font-weight:800; letter-spacing:.1em; } body.presenter .roomcode-big{ color:var(--yellow); }
  .joinrow{ display:flex; align-items:center; justify-content:center; gap:clamp(20px,5vw,64px); flex-wrap:wrap; }
  .joincol{ display:flex; flex-direction:column; align-items:center; gap:1.4vh; }
  .qrbox{ background:#fff; padding:14px; border-radius:16px; line-height:0; box-shadow:0 10px 40px rgba(0,0,0,.3); }
  .qrbox svg{ width:clamp(150px,24vh,280px); height:auto; display:block; } .qrbox .qrcap{ line-height:1.2; margin-top:8px; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#334155; text-align:center; }
  .cmd{ width:min(440px,94vw); background:#fff; color:#0f172a; border-radius:18px; overflow:hidden; box-shadow:0 16px 50px rgba(0,0,0,.25); text-align:left; }
  .cmd .band{ height:12px; background:linear-gradient(90deg,var(--navy) 0 70%,var(--yellow) 70% 100%); } .cmd .in{ padding:22px 24px; } .cmd h2{ color:var(--navy); font-size:1.35rem; margin:2px 0 4px; }
  .cmd .k{ font-size:.68rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--red); } .cmd .sec{ font-size:.68rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--navy); margin:15px 0 6px; }
  .cmd ul{ list-style:none; display:flex; flex-direction:column; gap:6px; } .cmd li{ padding-left:20px; position:relative; font-size:.98rem; } .cmd li::before{ content:"✓"; position:absolute; left:0; color:var(--red); font-weight:800; }
  .cmd .shift{ display:flex; align-items:center; gap:10px; font-size:1.05rem; font-weight:700; } .cmd .shift b{ color:var(--navy); font-size:1.3rem; } .cmd .foot{ margin-top:16px; padding-top:12px; border-top:1px solid #e3e6eb; font-size:.8rem; color:#64748b; text-align:center; }
  .controls{ display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap; padding:12px 20px; } body.presenter .controls{ border-top:1px solid rgba(255,255,255,.08); }
  .controls button{ padding:11px 20px; border-radius:12px; font-weight:700; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.06); color:#eaf0ff; } .controls .primary{ background:var(--yellow)!important; color:#111!important; border-color:var(--yellow)!important; } .controls .reveal{ background:#2b3fb3!important; color:#fff!important; border-color:#2b3fb3!important; }
  .dots{ display:flex; gap:6px; align-items:center; } .sdot{ width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.25); } .sdot.now{ background:var(--yellow); transform:scale(1.4); }
  .actions{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:10px; } .actions button{ padding:12px 22px; border-radius:999px; font-weight:800; border:none; } .actions .save{ background:var(--navy); color:#fff; }
  .offline-banner{ display:none; background:var(--red); color:#fff; text-align:center; padding:8px; font-size:.85rem; font-weight:600; } .offline-banner.show{ display:block; }
  @media print{ .topbar,.controls,.offline-banner,.actions{ display:none!important; } body{ background:#fff!important; } .cmd{ box-shadow:none; } }
`;

function sessionShellHTML(landing) {
  return `${landing || ''}
  <div id="session">
    <div class="offline-banner" id="offline">Can’t reach the room — just follow the main screen. 👀</div>
    <div class="topbar">
      <div class="room">ROOM <span id="room-lbl"></span> <small id="role-lbl"></small></div>
      <div class="status"><span class="dot" id="statdot"></span><span id="statlbl">connecting…</span><span id="joincount"></span></div>
    </div>
    <div class="stage" id="stage"></div>
    <div class="controls" id="controls"></div>
  </div>`;
}

function htmlDoc({ title, bodyInner, headScript, mqttSrc, qrSrc }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title><style>${LIVE_CSS}</style></head>
<body>${bodyInner}
<script src="${mqttSrc}"></script>
${qrSrc ? `<script src="${qrSrc}"></script>\n` : ''}<script>${headScript}</script>
<script>${LIVE_ENGINE_JS}</script>
</body></html>`;
}

/**
 * Presenter HTML (projector) with the deck's live slides baked in.
 * ctx: { room, joinUrl, mqttSrc, broker }
 */
export function compileLivePresenterHTML(deck, ctx = {}) {
  const slides = liveSlidesFromDeck(deck);
  const head = `window.__ROLE='presenter';window.__ROOM=${JSON.stringify(normRoom(ctx.room))};`
    + `window.__SLIDES=${JSON.stringify(slides)};window.__JOIN_URL=${JSON.stringify(ctx.joinUrl || '')};`
    + `window.__BROKER=${JSON.stringify(ctx.broker || DEFAULT_BROKER)};`;
  return htmlDoc({ title: `${deck?.title || 'Lesson'} — Live (presenter)`, bodyInner: sessionShellHTML(''), headScript: head, mqttSrc: ctx.mqttSrc || 'mqtt.min.js', qrSrc: ctx.qrSrc || 'qrcode.min.js' });
}

/**
 * Generic join page (phones) — content-agnostic; renders whatever the presenter
 * broadcasts. `broker` bakes the default; a `?room=` auto-joins.
 */
export function compileLiveJoinHTML(ctx = {}) {
  const landing = `<div id="landing"><div class="card-l"><h1>Join the live session</h1><div class="sub">Your teacher will show a room code on the screen.</div>
    <label for="room-in">Room code</label><input id="room-in" maxlength="12" autocomplete="off" spellcheck="false" placeholder="ROOM">
    <button id="go-join">Join →</button></div></div>`;
  const head = `window.__ROLE='audience';window.__BROKER=${JSON.stringify(ctx.broker || DEFAULT_BROKER)};`;
  return htmlDoc({ title: 'Join — Co-Cher Live', bodyInner: sessionShellHTML(landing), headScript: head, mqttSrc: ctx.mqttSrc || 'mqtt.min.js' });
}
