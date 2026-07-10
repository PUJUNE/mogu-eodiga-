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

// ── 세이브: 자동저장(localStorage) + 파일 내보내기/불러오기 ──
const SAVE_KEY='moguKingdom:autosave',SAVE_MAGIC='mogukingdom',SAVE_VER=1;
let lastAuto=0;

// 직렬화 가능한 값만 남기는 수동 딥클론.
// 주의: three.js 객체(_mesh 등)는 자체 toJSON을 가져 JSON.stringify replacer로는
// 걸러지지 않으므로(교체자보다 toJSON이 먼저 호출됨), 밑줄·rng 키를 아예 순회에서 제외한다.
function sanitize(v,depth){
  if(v===null||typeof v!=='object')return v;
  if(depth>60)return undefined;
  if(Array.isArray(v)){const a=[];for(let i=0;i<v.length;i++)a[i]=sanitize(v[i],depth+1);return a;}
  const o={},keys=Object.keys(v);
  for(let i=0;i<keys.length;i++){
    const k=keys[i];
    if(k==='rng'||k.charAt(0)==='_')continue;
    o[k]=sanitize(v[k],depth+1);
  }
  return o;
}

// 전체 상태를 직렬화(난수기 rng는 제외하고 불러올 때 재시드)
M.serialize=function(){
  const W=M.state;if(!W)return null;
  return{magic:SAVE_MAGIC,version:SAVE_VER,seed:W.seed,day:Math.floor(W.clock.day),
    realmName:W.realmName,savedAt:Date.now(),state:sanitize(W,0)};
};

// 저장 데이터를 실제 상태로 복원(전이 중이던 일시적 요소는 정리)
M.hydrate=function(save){
  const st=save.state;
  st.rng=M.rng(st.seed+':history');
  st.clock.last=performance.now();
  st.caravans=[];st.armies=[];                 // 이동 중이던 수레·군대 시각물은 재생성됨
  if(st.dragon&&st.dragon.state!=='sleeping'){st.dragon.state='sleeping';st.dragon.until=Math.floor(st.clock.day)+M.rng(st.seed+':d').int(400,900);}
  if(!st.tech)st.tech={points:0,era:0,unlocked:[],bonus:M.techBonusDefault()};
  if(!st.tech.bonus)st.tech.bonus=M.techBonusDefault();
  return st;
};

M.loadAutosave=function(){
  try{const s=localStorage.getItem(SAVE_KEY);if(!s)return null;const o=JSON.parse(s);
    if(o&&o.magic===SAVE_MAGIC&&o.state&&o.state.seed)return o;}catch(e){}
  return null;
};
M.clearAutosave=function(){try{localStorage.removeItem(SAVE_KEY);}catch(e){}};

M.autosave=function(force){
  try{
    const now=performance.now();
    if(!force&&now-lastAuto<7000)return false;
    const save=M.serialize();if(!save)return false;
    localStorage.setItem(SAVE_KEY,JSON.stringify(save));
    lastAuto=now;
    if(M.onAutosaved)M.onAutosaved(save);
    return true;
  }catch(e){if(M.onSaveError)M.onSaveError(e);return false;}
};

M.startAutosave=function(){
  if(M._autoTimer)clearInterval(M._autoTimer);
  M._autoTimer=setInterval(function(){M.autosave(false);},8000);
  window.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')M.autosave(true);});
  window.addEventListener('pagehide',function(){M.autosave(true);});
};

M.hasProgress=function(){return !!(M.state&&(M.state.clock.day>3||(M.state.tech&&M.state.tech.unlocked.length)));};

// 파일에서 불러온 저장을 적용하고 그 왕국으로 재개
M.importSave=function(text){
  const o=JSON.parse(text);
  if(!o||o.magic!==SAVE_MAGIC||!o.state||!o.state.seed)throw new Error('모구 고양이 왕국 세이브 파일이 아닙니다.');
  localStorage.setItem(SAVE_KEY,JSON.stringify(o));
  try{localStorage.setItem('moguKingdom:lastSeed',o.state.seed);}catch(e){}
  location.hash='s='+encodeURIComponent(o.state.seed);
  location.reload();
};

function boot(){
  try{
    const seed=seedFromHash();
    const save=M.loadAutosave();
    let resumed=false;
    if(save&&save.seed===seed){
      try{M.state=M.hydrate(save);resumed=true;}catch(e){console.warn('세이브 복원 실패, 새로 생성함',e);M.state=null;}
    }
    if(!M.state)M.state=M.generateWorld(seed);
    M.worldMetrics(M.state);
    try{localStorage.setItem('moguKingdom:lastSeed',seed);}catch(e){}
    if(!M.initRenderer())return;
    M.initUI();
    if(resumed){M.recomputeTech(M.state);M.worldMetrics(M.state);M.chron('crown','저장된 기록을 펼쳐 '+M.state.realmName+'의 이야기를 이어감.',0,2);}
    else M.initSimulation();
    M.refreshUI(true);
    M.startAutosave();
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
  M.clearAutosave();                            // 새 왕국은 항상 처음부터
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
