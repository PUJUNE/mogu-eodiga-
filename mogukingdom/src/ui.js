// ui.js — 한글 HUD, 장부, 연대기, 통계, 키보드·터치 연결
{
const M=window.MKR;
let pendingAct=null,filter='',chartOn=false,fpsOn=false,lastFps=0,frames=0,lastBeatTimer=null;

function q(id){return document.getElementById(id);}
function qa(sel){return Array.from(document.querySelectorAll(sel));}
function notable(id){return M.state.notables.find(function(n){return n.id===id;});}
function house(id){return M.state.houses.find(function(h){return h.id===id;});}
function settlement(id){return M.state.settlements.find(function(s){return s.id===id;});}
function htmlSafe(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

M.buildLabels=function(){
  const holder=q('labels');holder.innerHTML='';
  M.state.settlements.forEach(function(s){
    const el=document.createElement('div');el.className='mapLabel '+(s.kind==='capital'?'cap':'');
    el.dataset.id=s.id;el.innerHTML=(s.kind==='capital'?'♛ ':'')+htmlSafe(s.name);
    holder.appendChild(el);
  });
};

M.appendEvent=function(e){
  const box=q('chronScroll');
  const el=document.createElement('div');el.className='event '+e.type;el.dataset.type=e.type;el.dataset.place=e.place==null?'':e.place;
  el.innerHTML='<time>'+htmlSafe(M.dateStr(e.day))+'</time>'+htmlSafe(e.text);
  if(e.type==='year'){el.innerHTML=htmlSafe(e.text);}
  el.style.display=eventVisible(e)?'block':'none';
  el.addEventListener('click',function(){if(e.place!=null)M.focusSettlement(e.place);});
  box.appendChild(el);
  if(box.scrollHeight-box.scrollTop-box.clientHeight<180)box.scrollTop=box.scrollHeight;
};

function eventVisible(e){
  if(!filter)return true;
  if(filter==='fate')return e.type==='fate'||e.type==='myth'||e.type==='realm';
  return e.type===filter||e.type==='year';
}

function applyFilter(){
  qa('#chronFilters [data-filter]').forEach(function(b){b.classList.toggle('on',b.dataset.filter===filter);});
  qa('#chronScroll .event').forEach(function(el){
    const type=el.dataset.type;
    const ok=!filter||type===filter||type==='year'||filter==='fate'&&(type==='fate'||type==='myth'||type==='realm');
    el.style.display=ok?'block':'none';
  });
}

M.showBeat=function(e){
  const card=q('beatCard');card.querySelector('time').textContent=M.dateStr(e.day);card.querySelector('p').textContent=e.text;
  q('inspector').classList.add('hidden');
  card.classList.remove('hidden');
  if(lastBeatTimer)clearTimeout(lastBeatTimer);
  lastBeatTimer=setTimeout(function(){card.classList.add('hidden');},5200);
  if(M.state.director&&e.place!=null)M.focusSettlement(e.place);
};

function renderHouses(){
  const W=M.state,box=q('tab-houses'),king=notable(W.monarch);
  let out='<div class="monarch"><div class="sigil" style="background:#9b7825">👑</div><div><b>'+htmlSafe(king?king.name:'왕위 공석')+
    '</b><br><span style="font-size:11px;color:#6d604d">정통성 '+Math.round(W.legitimacy)+(W.war?' · 내전 중':'')+'</span></div></div>';
  if(king){
    const hs=king.children.map(notable).filter(function(n){return n&&n.alive;}).sort(function(a,b){return b.age-a.age;});
    out+='<div class="hint" style="margin:5px 0 8px">계승 순위: '+(hs.length?hs.slice(0,3).map(function(n){return htmlSafe(n.given)+' ('+Math.floor(n.age)+')';}).join(' → '):'후계자 없음')+'</div>';
  }
  W.houses.forEach(function(h){
    const head=notable(h.head),seat=settlement(h.seat);
    out+='<div class="house" data-house="'+h.id+'"><div class="houseTop"><span class="sigil" style="background:'+h.color+'">'+h.sigil+'</span>'+
      '<b>'+htmlSafe(h.name)+(h.exiled?' · 추방됨':'')+'</b><span>'+Math.round(h.loyalty)+'</span></div>'+
      '<div style="font-size:11px;color:#6d604d;margin-left:39px">'+htmlSafe(head?head.name:'가주 없음')+' · '+htmlSafe(seat?seat.name:'영지 없음')+'</div>'+
      '<div class="loyal"><i style="width:'+M.clamp(h.loyalty,0,100)+'%"></i></div></div>';
  });
  box.innerHTML=out;
  qa('#tab-houses .house').forEach(function(el){el.addEventListener('click',function(){const h=house(Number(el.dataset.house));if(h)M.focusSettlement(h.seat);});});
}

function renderWar(){
  const W=M.state,bar=q('warStrip');
  if(!W.war){bar.classList.add('hidden');return;}
  const names=W.war.rebels.map(function(id){const h=house(id);return h?h.name:'';}).filter(Boolean).join('·');
  bar.textContent='⚔ 왕국 내전 · '+names+' · 전황 '+Math.round(W.war.score);
  bar.classList.remove('hidden');bar.onclick=function(){const h=house(W.war.rebels[0]);if(h)M.focusSettlement(h.seat);};
}

function refreshHud(){
  const W=M.state;
  q('dateTxt').textContent=M.dateStr(Math.floor(W.clock.day));
  q('popTxt').textContent=M.fmt(W.realmPop);
  q('treasuryTxt').textContent=M.fmt(W.treasury);
  qa('#speeds button').forEach(function(b){b.classList.toggle('on',Number(b.dataset.speed)===W.clock.speed);});
  q('watchDate').textContent=M.dateStr(Math.floor(W.clock.day));
  if(W.watch)q('watchDate').classList.remove('hidden');else q('watchDate').classList.add('hidden');
}

M.refreshUI=function(full){
  refreshHud();renderWar();
  if(full)renderHouses();
  if(chartOn)drawChart();
};

M.inspectSettlement=function(s){
  const W=M.state,h=s.owner<0?null:house(s.owner),box=q('inspector');
  q('beatCard').classList.add('hidden');
  const food=(s.stores.grain+s.stores.fish)/Math.max(1,s.pop);
  box.innerHTML='<h3>'+(s.kind==='capital'?'♛ ':'')+htmlSafe(s.name)+'</h3><p>'+
    (s.kind==='capital'?'수도':s.kind==='town'?'도시':'마을')+' · 주민 '+M.fmt(s.pop)+'마리 · 번영 '+Math.round(s.prosperity*100)+
    ' · 불만 '+Math.round(s.unrest)+' · 식량 '+food.toFixed(1)+'일분'+(s.inf>0?' · 감염 '+Math.round(s.inf*100)+'%':'')+
    '<br>영주 '+htmlSafe(h?h.name:'왕실 직할')+' · 건물 '+s.buildings.filter(function(b){return b.alive;}).length+'채 · 폐허 '+s.ruins+
    '<br>창고: 곡물 '+M.fmt(s.stores.grain)+' · 생선 '+M.fmt(s.stores.fish)+' · 목재 '+M.fmt(s.stores.timber)+' · 츄르 '+M.fmt(s.stores.churu)+'</p>';
  box.classList.remove('hidden');
};

function drawChart(){
  const cv=q('chart'),box=q('chartBox'),hist=M.state.history;if(!chartOn||!hist.length)return;
  const dpr=Math.min(devicePixelRatio||1,2),r=box.getBoundingClientRect();cv.width=Math.max(10,r.width*dpr);cv.height=Math.max(10,r.height*dpr);
  const g=cv.getContext('2d');g.scale(dpr,dpr);const w=r.width,h=r.height;
  g.clearRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(0,0,w,h);
  const pad=22,maxPop=Math.max.apply(null,hist.map(function(x){return x.pop;}))*1.08,minPop=Math.min.apply(null,hist.map(function(x){return x.pop;}))*.92;
  function line(key,color,min,max){
    g.strokeStyle=color;g.lineWidth=2;g.beginPath();
    hist.forEach(function(x,i){const px=pad+(w-pad*2)*i/Math.max(1,hist.length-1),py=h-pad-(h-pad*2)*(x[key]-min)/Math.max(.001,max-min);if(i)g.lineTo(px,py);else g.moveTo(px,py);});
    g.stroke();
  }
  line('pop','#5e7ea5',minPop,maxPop);line('pros','#4c7a48',0,1);line('unrest','#9a4238',0,100);
  g.font='11px '+getComputedStyle(document.body).fontFamily;g.fillStyle='#4b4034';
  g.fillText('인구',8,13);g.fillStyle='#4c7a48';g.fillText('번영',50,13);g.fillStyle='#9a4238';g.fillText('불만',92,13);
}
M.drawChart=drawChart;

function setTab(name){
  qa('#drawerTabs [data-tab]').forEach(function(b){b.classList.toggle('on',b.dataset.tab===name);});
  qa('#drawer .tab').forEach(function(el){el.classList.toggle('hidden',el.id!=='tab-'+name);});
  if(name==='houses')renderHouses();
}

function setWatch(on){
  M.state.watch=on;
  q('btnWatch').classList.toggle('on',on);q('btnQuickWatch').classList.toggle('on',on);
  if(on){M.state.clock.speed=Math.max(M.state.clock.speed,3);q('chronicle').classList.add('folded');q('drawer').classList.add('hidden');q('drawerHandle').classList.remove('hidden');}
  refreshHud();
}

M.syncDirectorButtons=function(){
  const on=M.state.director;
  q('btnDirector').classList.toggle('on',on);q('btnDirector').textContent='연출 '+(on?'켬':'끔');q('btnQuickDirector').classList.toggle('on',on);
};
function setDirector(on){M.state.director=on;M.syncDirectorButtons();}

function setLabels(on){M.state.labels=on;q('btnLabels').classList.toggle('on',on);}

function setFps(on){fpsOn=on;q('fps').classList.toggle('hidden',!on);q('btnFps').classList.toggle('on',on);}

function toggleUI(){
  document.body.classList.toggle('ui-hidden');
  if(document.body.classList.contains('ui-hidden'))q('inspector').classList.add('hidden');
}

function setPending(act){
  pendingAct=act;const btn=qa('[data-act]').find(function(b){return b.dataset.act===act;});
  q('aimNotice').textContent=(btn?btn.textContent.replace('⌖','').trim():'사건')+' 위치를 지도에서 선택';
  q('aimNotice').classList.remove('hidden');document.body.classList.add('aiming');
}
function clearPending(){pendingAct=null;q('aimNotice').classList.add('hidden');document.body.classList.remove('aiming');}

M.onMapClick=function(x,y){
  if(document.body.classList.contains('ui-hidden')){toggleUI();return;}
  const hit=M.pickAt(x,y);if(!hit)return;
  if(pendingAct){
    const target=pendingAct==='found'?hit.point:(hit.settlement||hit.point);
    M.runAct(pendingAct,target);clearPending();return;
  }
  if(hit.settlement){M.state.selected=hit.settlement.id;M.inspectSettlement(hit.settlement);}
};

function exportChronicle(){
  const W=M.state;
  const lines=[W.realmName,'씨앗 '+W.seed,''];
  W.events.forEach(function(e){lines.push('['+M.dateStr(e.day)+'] '+e.text);});
  const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='모구_고양이_왕국_'+W.seed+'_연대기.txt';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},500);
}

function copyLink(){
  const url=location.href.split('#')[0]+'#s='+encodeURIComponent(M.state.seed);
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(function(){q('btnLink').textContent='복사됨';setTimeout(function(){q('btnLink').textContent='링크 복사';},1200);});
  else{q('seedInput').value=url;q('seedInput').select();document.execCommand('copy');}
}

function readRates(){
  qa('#tab-rates input[data-rate]').forEach(function(r){
    const k=r.dataset.rate;
    if(k==='tax'){M.state.rates.tax=Number(r.value)/100;document.querySelector('[data-value="tax"]').textContent=r.value+'%';}
    else{const v=.25*Math.pow(16,Number(r.value));M.state.rates[k]=v;document.querySelector('[data-value="'+k+'"]').textContent='×'+v.toFixed(2);}
  });
}

M.initUI=function(){
  const W=M.state;
  q('seedInput').value=W.seed;
  qa('#speeds button').forEach(function(b){b.addEventListener('click',function(){W.clock.speed=Number(b.dataset.speed);refreshHud();});});
  qa('#drawerTabs [data-tab]').forEach(function(b){b.addEventListener('click',function(){setTab(b.dataset.tab);});});
  q('drawerFold').addEventListener('click',function(){q('drawer').classList.add('hidden');q('drawerHandle').classList.remove('hidden');});
  q('drawerHandle').addEventListener('click',function(){q('drawer').classList.remove('hidden');q('drawerHandle').classList.add('hidden');});
  q('chronToggle').addEventListener('click',function(){q('chronicle').classList.toggle('folded');q('chronicle').classList.toggle('open-mobile');});
  q('chronHead').addEventListener('click',function(e){if(innerWidth<=800&&e.target.tagName!=='BUTTON')q('chronicle').classList.toggle('open-mobile');});
  qa('#chronFilters [data-filter]').forEach(function(b){b.addEventListener('click',function(){filter=b.dataset.filter;applyFilter();});});
  q('btnChart').addEventListener('click',function(){chartOn=!chartOn;q('chartBox').classList.toggle('hidden',!chartOn);q('btnChart').classList.toggle('on',chartOn);if(chartOn)drawChart();});
  q('btnExport').addEventListener('click',exportChronicle);
  qa('#tab-rates input[data-rate]').forEach(function(r){r.addEventListener('input',readRates);r.addEventListener('change',function(){M.chron('realm','왕국 장부의 '+r.parentElement.querySelector('label').childNodes[0].textContent.trim()+' 조정값이 변경됨.',0,1);});});
  qa('[data-myth]').forEach(function(b){b.addEventListener('click',function(){qa('[data-myth]').forEach(function(x){x.classList.remove('on');});b.classList.add('on');W.rates.myth=Number(b.dataset.myth);M.chron('myth','신화 사건 빈도가 '+b.textContent+'으로 변경됨.',0,1);});});
  qa('[data-act]').forEach(function(b){b.addEventListener('click',function(){const act=b.dataset.act;if(b.textContent.indexOf('⌖')>=0)setPending(act);else M.runAct(act,null);});});
  q('btnReforge').addEventListener('click',function(){M.reforge(q('seedInput').value.trim()||String(Math.floor(Math.random()*9000000+1000000)));});
  q('seedInput').addEventListener('keydown',function(e){if(e.key==='Enter')q('btnReforge').click();});
  q('btnLink').addEventListener('click',copyLink);
  q('btnLabels').addEventListener('click',function(){setLabels(!W.labels);});
  q('btnWatch').addEventListener('click',function(){setWatch(!W.watch);});
  q('btnQuickWatch').addEventListener('click',function(){setWatch(!W.watch);});
  q('btnDirector').addEventListener('click',function(){setDirector(!W.director);});
  q('btnQuickDirector').addEventListener('click',function(){setDirector(!W.director);});
  q('btnHideUI').addEventListener('click',toggleUI);
  q('btnFps').addEventListener('click',function(){setFps(!fpsOn);});
  q('btnOverlay').addEventListener('click',function(){q('overlayMenu').classList.toggle('hidden');});
  qa('#overlayMenu [data-overlay]').forEach(function(b){b.addEventListener('click',function(){qa('#overlayMenu [data-overlay]').forEach(function(x){x.classList.remove('on');});b.classList.add('on');M.setOverlay(b.dataset.overlay);});});
  q('warStrip').addEventListener('click',function(){if(W.war){const h=house(W.war.rebels[0]);if(h)M.focusSettlement(h.seat);}});
  window.addEventListener('keydown',keyboard);
  window.addEventListener('resize',function(){if(chartOn)drawChart();});
  readRates();M.buildLabels();
  W.events.forEach(M.appendEvent);
  ['hud','drawer','chronicle'].forEach(function(id){q(id).classList.remove('hidden');});
  if(innerWidth<=800){q('drawer').classList.add('hidden');q('drawerHandle').classList.remove('hidden');}
  setProgressDone();
  M.refreshUI(true);M.syncDirectorButtons();
};

function setProgressDone(){
  q('loadFill').style.width='100%';q('loadStep').textContent='왕국의 첫 기록을 펼치는 중…';
  setTimeout(function(){q('loading').style.opacity='0';q('loading').style.transition='opacity .65s';setTimeout(function(){q('loading').classList.add('hidden');},660);},300);
}

function keyboard(e){
  if(e.target&&/INPUT|TEXTAREA/.test(e.target.tagName))return;
  if(e.key==='Escape'){clearPending();q('overlayMenu').classList.add('hidden');q('inspector').classList.add('hidden');}
  else if(e.key===' '){e.preventDefault();M.state.clock.speed=M.state.clock.speed?0:2;refreshHud();}
  else if(/^[1-5]$/.test(e.key)){M.state.clock.speed=Number(e.key);refreshHud();}
  else if(e.key.toLowerCase()==='t'){M.setOverlay(M.state.overlay==='territory'?'':'territory');}
  else if(e.key.toLowerCase()==='c')setWatch(!M.state.watch);
  else if(e.key.toLowerCase()==='g')setDirector(!M.state.director);
  else if(e.key.toLowerCase()==='h')toggleUI();
  else if(e.key.toLowerCase()==='l')setLabels(!M.state.labels);
  else if(e.key.toLowerCase()==='f')setFps(!fpsOn);
}

M.updateFps=function(now){
  frames++;
  if(now-lastFps>1000){
    if(fpsOn){const info=M.rendererInfo();q('fps').textContent=frames+' FPS · '+info.calls+' calls · '+M.fmt(info.triangles)+' tris';}
    frames=0;lastFps=now;
  }
};

M.onSimDay=function(day){
  if(day%3===0)refreshHud();
  if(day%30===0)M.refreshUI(true);
};

M.uiDebug=function(){return{pendingAct:pendingAct,filter:filter,chartOn:chartOn,fpsOn:fpsOn};};
}
