// Builds deterministic timelines for the briefing videos from the recovered tour scenes.
const fs=require('fs'), path=require('path');
const V=process.argv[2];
const SC=JSON.parse(fs.readFileSync(path.join(V,'scenes.json'),'utf8'));
const NOTE='Every frame is the live app — nothing recreated.';
const CH=[
 {key:'classes', name:'Setting up Classes', short:'Classes',
  promise:'Upload your class list — then choose what to track: E21CC, or areas of your own, like group work.',
  outro:{h2:'Upload your list. Track what actually matters.',
   items:['Create a class in seconds','Upload names from CSV or Excel','A class portrait, from the learners up','E21CC — <b style="color:#FFE200">or</b> RAG, Mastery, Participation','Build your own — e.g. Group Work','Switching never deletes data'],
   cta:'My Classes → Add Class → <b>Upload students</b>'}},
 {key:'lp', name:'Lesson Planner', short:'Lesson Planner',
  promise:'Plan with an AI co-teacher — then turn the plan into real classroom materials in one tap.',
  outro:{h2:'One prompt in. A whole lesson — and its materials — out.',
   items:['Starter cards or your own words','Attach · dictate · your frameworks','A full plan in seconds','YouTube curation · slide decks','25+ tools build the artefacts','Stage → Place → Present · autosaved'],
   cta:'Lesson Planner → describe your lesson → <b>explore the AI Tools</b>'}},
 {key:'aol', name:'Assessment of Learning', short:'Assessment',
  promise:'A Table of Specifications that keeps every paper balanced by design — before a question is written.',
  outro:{h2:'A balanced paper — by design, not by luck.',
   items:['1D Bloom or revised 2D taxonomy','Objectives × cognitive levels','Marks totalled — and checked to 100%','Lower · balanced · higher-order demand','You review every question before export','Bloom\'s verbs, always on hand'],
   cta:'Assessment → Assessment of Learning → <b>Build TOS Grid</b>'}},
 {key:'admin', name:'Admin One-Stop', short:'Admin',
  promise:'Brief an event once — every document drafted, and tracked all the way to approval.',
  outro:{h2:'Brief once. Every document — drafted and tracked.',
   items:['Your school\'s own forms, one tap','Find a colleague who\'s genuinely free','One brief → RAMS, bus, notify, AOR…','Every draft already written','Draft → Submitted → Approved','Nothing slips'],
   cta:'Admin One-Stop → <b>New Event</b> → brief it once'}},
];
const D={chapter:3400, outro:5400, opening:5200, agenda:7000, closing:7000};
const HERO={classes:'img/classes-picker.png',lp:'img/lp-pop.png',aol:'img/aol-grid.png',admin:'img/admin-detail.png'};
const sceneDur=s=>Math.max(2500,Math.round(s.dur*1.1/100)*100);
const images={};
CH.forEach(c=>{ c.labels=SC[c.key].map(s=>s.ch); for(const s of SC[c.key]) images[`${c.key}-${s.img}`]=`img/${c.key}-${s.img}.png`; });
function chapterSegs(ci,mode){
  const c=CH[ci], list=SC[c.key], segs=[];
  segs.push({type:'card',kind:'chapter',dur:D.chapter,data:{n:ci+1,eb:mode==='master'?`Part ${ci+1} of ${CH.length}`:'Co-Cher · Feature guide',title:c.name,promise:c.promise,note:NOTE,hero:HERO[c.key]}});
  list.forEach((s,i)=>segs.push({type:'scene',ch:ci,idx:i,count:list.length,imgKey:`${c.key}-${s.img}`,box:s.box||null,click:s.click||null,notes:s.notes||[],title:s.title,desc:s.desc,dur:sceneDur(s)}));
  segs.push({type:'card',kind:'outro',dur:D.outro,data:{eb:`In short · ${c.name}`,h2:c.outro.h2,items:c.outro.items,cta:c.outro.cta}});
  return segs;
}
const mmss=ms=>{const s=Math.round(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const chapters=CH.map(c=>({key:c.key,name:c.name,short:c.short,labels:c.labels}));
const write=(name,tl)=>{ const total=tl.segments.reduce((a,s)=>a+s.dur,0); fs.writeFileSync(path.join(V,name),JSON.stringify(tl)); console.log(name,'segments',tl.segments.length,'duration',mmss(total)); };
// master
const parts=CH.map((c,i)=>chapterSegs(i,'master'));
const partDur=parts.map(p=>p.reduce((a,s)=>a+s.dur,0));
const master=[
 {type:'card',kind:'opening',dur:D.opening,data:{eb:'Staff briefing',sub:'Your co-teaching assistant — from class list to lesson, assessment and admin, in one app.',note:'Every screen in this briefing is the real, live app.',collage:CH.map(c=>({src:HERO[c.key],label:c.short}))}},
 {type:'card',kind:'agenda',dur:D.agenda,data:{eb:'In this briefing',h2:'Four parts. One workflow.',items:CH.map((c,i)=>({h:c.name,s:c.promise.split(' — ')[0].replace(/[.:]$/,''),tm:mmss(partDur[i])}))}},
 ...parts.flat(),
 {type:'card',kind:'closing',dur:D.closing,data:{eb:'Try it this week',h2:'Four small wins.',items:[
   {h:'Set up one class',s:'Add Class, upload your CSV — and pick what to track.'},
   {h:'Plan tomorrow\'s lesson',s:'Then tap YouTube or Slide Deck and see what it builds.'},
   {h:'Build a TOS for your next test',s:'Watch the banner turn green when the marks balance.'},
   {h:'Brief your next event once',s:'Let Admin One-Stop draft the paperwork.'}],
   cta:'Open Co-Cher at <b>harmanjohll.github.io/pedagogies</b>'}},
];
write('tl-00-master.json',{mode:'master',chapters,images,segments:master});
CH.forEach((c,i)=>write(`tl-0${i+1}-${c.key}.json`,{mode:'single',chapters,images,segments:chapterSegs(i,'single')}));
