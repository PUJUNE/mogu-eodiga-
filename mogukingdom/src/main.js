// main.js — 왕국 생성, 시간 루프, 씨앗 링크와 검증용 상태 공개
{
const M=window.MKR;
let last=performance.now(),running=false;

function seedFromHash(){
  const m=location.hash.match(/(?:^#|[&#])s=([^&]+)/);
  if(m)return decodeURIComponent(m[1]);
  try{
    const saved=localStorage.getItem('moguKingdom:lastSeed');
    if(saved)return saved;
  }catch(e){}
  return String(Math.floor(Math.random()*9000000+1000000));
}

function boot(){
  try{
    const seed=seedFromHash();
    M.state=M.generateWorld(seed);
    M.worldMetrics(M.state);
    try{localStorage.setItem('moguKingdom:lastSeed',seed);}catch(e){}
    if(!M.initRenderer())return;
    M.initUI();
    M.initSimulation();
    M.refreshUI(true);
    running=true;last=performance.now();requestAnimationFrame(frame);
  }catch(err){
    console.error(err);
    const fatal=document.getElementById('fatal'),text=document.getElementById('fatalText');
    if(text)text.textContent=String(err&&err.stack||err);
    if(fatal)fatal.classList.remove('hidden');
    const loading=document.getElementById('loading');if(loading)loading.classList.add('hidden');
  }
}

function frame(now){
  if(!running)return;
  const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  M.advanceSimulation(dt);
  M.renderFrame(dt);
  M.updateFps(now);
  requestAnimationFrame(frame);
}

M.reforge=function(seed){
  const clean=String(seed||'').trim()||String(Math.floor(Math.random()*9000000+1000000));
  try{localStorage.setItem('moguKingdom:lastSeed',clean);}catch(e){}
  location.hash='s='+encodeURIComponent(clean);
  location.reload();
};

M._dbg=function(){
  const W=M.state;
  return{
    seed:W.seed,day:W.clock.day,speed:W.clock.speed,pop:W.realmPop,treasury:W.treasury,
    settlements:W.settlements.length,houses:W.houses.length,notables:W.notables.filter(function(n){return n.alive;}).length,
    events:W.events.length,caravans:W.caravans.length,bandits:W.bandits.length,war:!!W.war,
    dragon:W.dragon.state,overlay:W.overlay,watch:W.watch,director:W.director,ui:M.uiDebug()
  };
};
M._state=function(){return M.state;};
M._tick=function(days){for(let i=0;i<days;i++){M.state.clock.day++;M.tickDay(Math.floor(M.state.clock.day));}M.refreshUI(true);return M._dbg();};
M._act=function(act,id){M.runAct(act,id);return M._dbg();};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
}
