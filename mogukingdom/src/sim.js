// sim.js — 인구·경제·교역·왕조·전쟁·재난·신화 시뮬레이션
{
const M=window.MKR;

function notable(W,id){return W.notables.find(function(n){return n.id===id;});}
function house(W,id){return W.houses.find(function(h){return h.id===id;});}
function settlement(W,id){return W.settlements.find(function(s){return s.id===id;});}
function avg(W,key){return W.settlements.reduce(function(a,s){return a+(s[key]||0);},0)/Math.max(1,W.settlements.length);}

M.dateStr=function(day){
  const year=Math.floor(day/360)+1;
  const d=day%360;
  const season=Math.floor(d/90);
  const month=Math.floor((d%90)/30)+1;
  const date=Math.floor(d%30)+1;
  return '모구력 '+year+'년 · '+M.SEASONS[season]+' '+month+'월 '+date+'일';
};

M.chron=function(type,text,place,importance){
  const W=M.state;if(!W)return;
  const e={id:W.events.length+1,day:Math.floor(W.clock.day),type:type||'realm',text:text,place:place==null?null:place,importance:importance||1};
  W.events.push(e);
  if(W.events.length>600)W.events.shift();
  if(M.appendEvent)M.appendEvent(e);
  if((W.watch||W.director)&&importance>=3&&M.showBeat)M.showBeat(e);
  return e;
};

function initialChronicle(W){
  M.chron('year','모구력 1년',0,1);
  M.chron('crown','여기 '+W.realmName+'의 기록을 시작함. '+W.settlements.length+'개 고을에 '+M.fmt(W.realmPop)+'마리의 고양이가 살고, 왕실 창고에는 츄르 '+M.fmt(W.treasury)+'개가 있음.',0,5);
  const king=notable(W,W.monarch);
  M.chron('crown',king.name+' 국왕이 황금 방울 왕관을 쓰고 다섯 가문의 충성을 받음.',0,4);
  W.settlements.slice(1).forEach(function(s){
    const h=house(W,s.owner);
    if(h)M.chron('realm',h.name+'이 '+s.name+'의 생선 창고와 시장을 돌봄.',s.id,1);
  });
}

M.initSimulation=function(){
  const W=M.state;
  M.recomputeTech(W);
  M.worldMetrics(W);
  initialChronicle(W);
  snapshot(W);
};

M.recomputeTech=function(W){
  const b=M.techBonusDefault();
  W.tech.unlocked.forEach(function(id){
    const t=M.TECHS.find(function(x){return x.id===id;});
    if(t&&t.mult)Object.keys(t.mult).forEach(function(k){b[k]=(b[k]||1)*t.mult[k];});
  });
  W.tech.bonus=b;
  W.tech.era=Math.min(M.ERAS.length-1,Math.floor(W.tech.unlocked.length/M.ERA_STEP));
};

M.unlockTech=function(id){
  const W=M.state,t=M.TECHS.find(function(x){return x.id===id;});
  if(!t||W.tech.unlocked.indexOf(id)>=0)return false;
  if(t.era>W.tech.era)return false;                 // 아직 열리지 않은 시대
  if(W.tech.points<t.cost)return false;             // 연구력 부족
  W.tech.points-=t.cost;
  const prevEra=W.tech.era;
  W.tech.unlocked.push(id);
  M.recomputeTech(W);
  M.chron('crown','왕실 서고가 「'+t.name+'」의 지혜를 갖춤. '+t.desc+'.',0,3);
  if(W.tech.era>prevEra)M.chron('crown','왕국이 '+M.ERAS[W.tech.era]+'로 들어섬. 새 지혜의 길이 열림.',0,6);
  M.worldMetrics(W);
  if(M.refreshUI)M.refreshUI(true);
  return true;
};

function productionRates(s,season,W){
  const winter=season===3?.38:season===2?1.25:season===1?1.12:.9;
  const tb=W.tech.bonus,c=s.civic||{};
  const harborLvl=(s.harbor?1:0)+(c.harbor||0);
  return{
    grain:s.pop*.055*winter*W.rates.harvest*tb.grain*(1+(c.granary||0)*.12)*(s.flood>0?.65:1)*(W.drought>0?.55:1),
    fish:s.pop*(harborLvl?.025*(1+(c.harbor||0)*.35):.008)*tb.fish*(W.weather.state==='폭풍'?.6:1),
    timber:s.pop*.006,ore:s.kind==='village'?0:s.pop*.0035,
    tools:s.pop*.0018,cloth:s.pop*.0015,churu:s.pop*.001
  };
}

function economyDay(W,s,day){
  const season=Math.floor((day%360)/90);
  const p=productionRates(s,season,W);s.production=p;
  Object.keys(p).forEach(function(k){s.stores[k]+=p[k];});
  const food=s.pop*.052;
  const grainUse=Math.min(s.stores.grain,food*.72);
  s.stores.grain-=grainUse;
  const left=food-grainUse;
  s.stores.fish=Math.max(0,s.stores.fish-left);
  const shortage=Math.max(0,left-s.stores.fish)/Math.max(1,food);
  const tb=W.tech.bonus,c=s.civic||{};
  s.hunger=M.clamp(s.hunger*.985+shortage*.045/tb.food,0,1);

  const cap=Math.max(120,s.buildings.filter(function(b){return b.alive;}).length*15);
  const crowd=M.clamp(1-s.pop/cap,0,1);
  const births=s.pop*.00017*W.rates.birth*(.4+.6*crowd)*(1-s.hunger*.8);
  const deaths=s.pop*.00009*W.rates.mortality*(1+s.hunger*7+s.inf*8);
  s.pop=Math.max(20,s.pop+births-deaths);
  s.prosperity=M.clamp(s.prosperity+((s.hunger<.08?.00035:-.0012)+(s.trade>0?.0003:0))*tb.culture+(c.market||0)*.00026-(s.inf*.001),0,1);
  s.unrest=M.clamp(s.unrest+(s.hunger*1.4+s.inf*.7+W.rates.tax*.45-.085)-(c.temple||0)*.02,0,100);
  W.treasury+=s.pop*s.prosperity*W.rates.tax*.0015*tb.tax*(1+(c.market||0)*.08);
  s.trade*=.985;

  if(day%30===8&&s.hunger>.28&&day-s.lastEvent>90){
    M.chron('fate',s.name+'의 곡물 창고가 비어 배급 줄이 시장 밖까지 이어짐.',s.id,3);s.lastEvent=day;
  }
  if(day%45===15&&s.prosperity>.74&&s.pop>cap*.76){
    const r=W.rng;
    const a=r.range(0,Math.PI*2),rad=r.range(s.radius*.75,s.radius*1.12);
    const b={x:s.x+Math.cos(a)*rad,z:s.z+Math.sin(a)*rad,w:r.range(9,16),d:r.range(9,15),h:r.range(8,15),rot:r.range(-.3,.3),roof:r.int(0,3),color:r.int(0,5),alive:true};
    s.buildings.push(b);
    if(M.addBuildingVisual)M.addBuildingVisual(s,b);
  }
  if(day%60===26&&s.pop<cap*.25&&s.buildings.filter(function(b){return b.alive;}).length>10){
    const alive=s.buildings.filter(function(b){return b.alive;});
    const b=W.rng.pick(alive);b.alive=false;s.ruins++;
    if(M.removeBuildingVisual)M.removeBuildingVisual(b);
  }
  if(s.fire>0){
    s.fire--;
    if(W.rng.chance(.055/(1+(c.wall||0)*.4+(tb.ward-1)))){
      const alive=s.buildings.filter(function(b){return b.alive;});
      if(alive.length){const b=W.rng.pick(alive);b.alive=false;s.ruins++;if(M.removeBuildingVisual)M.removeBuildingVisual(b);}
      s.pop=Math.max(20,s.pop-W.rng.range(2,12));
    }
    if(s.fire===0)M.chron('fate',s.name+'의 불길이 잦아들었고, 검게 탄 지붕 '+s.ruins+'채가 남음.',s.id,3);
  }
  if(s.flood>0){s.flood--;s.prosperity=Math.max(0,s.prosperity-.001);}
}

function findTrade(W){
  if(W.caravans.length>24)return;
  let src=null,dst=null,good=null,best=0;
  W.roads.forEach(function(rd){
    const a=settlement(W,rd.from),b=settlement(W,rd.to);
    M.GOODS.forEach(function(g){
      const needA=a.pop*(g==='grain'?30:g==='fish'?6:1);
      const needB=b.pop*(g==='grain'?30:g==='fish'?6:1);
      const ratioA=a.stores[g]/Math.max(1,needA),ratioB=b.stores[g]/Math.max(1,needB);
      if(ratioA-ratioB>best){best=ratioA-ratioB;src=a;dst=b;good=g;}
      if(ratioB-ratioA>best){best=ratioB-ratioA;src=b;dst=a;good=g;}
    });
  });
  if(!src||best<.12)return;
  const qty=Math.max(8,Math.min(src.stores[good]*.08,src.pop*.8))*W.rates.trade*W.tech.bonus.trade;
  src.stores[good]-=qty;
  W.caravans.push({id:Date.now()+W.rng.int(0,9999),from:src.id,to:dst.id,good:good,qty:qty,start:W.clock.day,duration:M.dist(src,dst)/95+3,progress:0,robbed:false});
  if(M.spawnCaravanVisual)M.spawnCaravanVisual(W.caravans[W.caravans.length-1]);
}

function caravansDay(W,day){
  W.caravans.slice().forEach(function(c){
    c.progress=(day-c.start)/c.duration;
    if(!c.robbed&&W.bandits.length&&W.rng.chance(.0025*W.rates.bandit)){
      c.robbed=true;c.qty*=.45;
      M.chron('fate',settlement(W,c.from).name+'에서 떠난 '+M.GOOD_NAMES[c.good]+' 수레가 들개 도적단을 만나 짐 절반을 잃음.',c.from,3);
    }
    if(c.progress>=1){
      const dst=settlement(W,c.to),src=settlement(W,c.from);
      dst.stores[c.good]+=c.qty;dst.trade+=c.qty;
      W.treasury+=c.qty*.04*W.rates.tax;
      const road=W.roads.find(function(rd){return rd.from===c.from&&rd.to===c.to||rd.from===c.to&&rd.to===c.from;});
      if(road)road.volume+=c.qty;
      if(W.rng.chance(.12))M.chron('trade',src.name+'의 '+M.GOOD_NAMES[c.good]+' 수레가 '+dst.name+' 시장에 도착함.',dst.id,1);
      W.caravans.splice(W.caravans.indexOf(c),1);
      if(M.removeAgentVisual)M.removeAgentVisual(c.id);
    }
  });
}

function plagueDay(W,s,day){
  const med=W.tech.bonus.med;
  if(s.inf>0){
    const catching=s.inf*s.sus*.105*W.rates.plagueV/med;
    s.sus=Math.max(0,s.sus-catching);
    s.inf=M.clamp(s.inf+catching-s.inf*.047,0,1);
    const dead=s.pop*s.inf*.0011*W.rates.plagueL/med;
    s.pop=Math.max(20,s.pop-dead);
    if(s.inf<.012){
      s.inf=0;
      M.chron('fate',s.name+'의 고양이 감기가 잦아들어 닫혔던 시장 문이 다시 열림.',s.id,3);
    }
  }else{
    s.sus=Math.min(1,s.sus+.00012);
    if(day>240&&W.rng.chance(.000006*W.rates.plagueV))infect(W,s,'떠돌이 상단을 따라');
  }
  if(s.inf>.06){
    W.roads.filter(function(rd){return rd.from===s.id||rd.to===s.id;}).forEach(function(rd){
      if(W.rng.chance(s.inf*.0009*W.rates.plagueV)){
        const other=settlement(W,rd.from===s.id?rd.to:rd.from);
        if(other.inf===0)infect(W,other,'생선 수레를 따라');
      }
    });
  }
}
function infect(W,s,how){
  if(!s||s.inf>0)return;
  s.inf=.025;s.sus=Math.max(s.sus,.65);
  M.chron('fate',s.name+'에 고양이 감기가 번짐. '+how+' 재채기 소리가 성문 안으로 들어옴.',s.id,5);
}

function ageNotables(W,day){
  W.notables.slice().forEach(function(n){
    if(!n.alive)return;
    n.age+=1/360;
    let q=n.age<16?.002:n.age<50?.004:.004+(n.age-50)*.0022;
    if(n.traits.indexOf('병약함')>=0)q*=1.7;
    if(W.rng.chance(q/360))killNotable(W,n,'병으로',day);
  });
  if(day%5===0){
    W.notables.forEach(function(n){
      if(!n.alive||!n.spouse||n.age<18||n.age>43)return;
      const sp=notable(W,n.spouse);
      if(!sp||!sp.alive||n.id>sp.id)return;
      const living=W.notables.filter(function(x){return x.alive;}).length;
      if(living>120)return;
      if(W.rng.chance(.0068*W.rates.fertility)){
        const h=n.house;
        const child={id:W.nextIds.notable++,given:W.rng.pick(['모찌','단추','별이','보리','구름','라떼','두부','호두']),name:'',house:h,role:h<0?'왕자녀':'후계자',age:0,alive:true,traits:[W.rng.pick(['건강함','호기심','느긋함'])],spouse:null,children:[],born:day};
        child.name=child.given+(h<0?' 모구':' '+HOUSE_NAME_SAFE(W,h));
        W.notables.push(child);n.children.push(child.id);sp.children.push(child.id);
        if(h<0)M.chron('crown','왕실에 새 아기 고양이 '+child.name+'이 태어나 궁정에 금방울이 울림.',0,4);
      }
    });
  }
}
function HOUSE_NAME_SAFE(W,id){const h=house(W,id);return h?h.name.split(' ')[0]:'고양이';}

function heirs(W,king){
  return king.children.map(function(id){return notable(W,id);}).filter(function(n){return n&&n.alive;}).sort(function(a,b){return b.age-a.age;});
}
function killNotable(W,n,why,day){
  if(!n.alive)return;n.alive=false;
  if(n.id===W.monarch){
    M.chron('crown',n.name+' 국왕이 '+why+' 숨을 거둠. 왕실 금방울이 하루 동안 울리지 않음.',0,6);
    succession(W,day);
  }else if(n.role==='가주'){
    const h=house(W,n.house);
    if(h){const next=n.children.map(function(id){return notable(W,id);}).find(function(x){return x&&x.alive;});if(next){next.role='가주';h.head=next.id;}}
  }
}
function succession(W,day){
  const old=notable(W,W.monarch);
  const list=old?heirs(W,old):[];
  let next=list.find(function(n){return n.age>=12;});
  if(!next){
    next=W.notables.filter(function(n){return n.alive&&n.house<0&&n.id!==old.id;}).sort(function(a,b){return b.age-a.age;})[0];
  }
  if(!next){
    next={id:W.nextIds.notable++,given:'새모구',name:'새모구 모구',house:-1,role:'국왕',age:21,alive:true,traits:['신중함'],spouse:null,children:[],born:day-21*360};W.notables.push(next);
  }
  next.role='국왕';W.monarch=next.id;W.legitimacy=M.clamp(list.indexOf(next)>=0?68:42,0,100);
  W.regency=next.age<16;
  M.chron('crown',next.name+'이 '+(W.regency?'섭정의 보호 아래 ':'')+'새 국왕으로 즉위함.',0,6);
  W.houses.forEach(function(h){h.loyalty=M.clamp(h.loyalty+W.rng.range(-12,8),0,100);});
}

function politicsDay(W,day){
  if(day%30!==9)return;
  W.houses.forEach(function(h){
    if(h.exiled)return;
    const seat=settlement(W,h.seat);
    h.loyalty=M.clamp(h.loyalty+(seat.prosperity-.5)*4-seat.unrest*.025+W.rng.range(-2,2)-(W.rates.aggression-1)*1.5,0,100);
  });
  if(!W.war&&day>W.peaceUntil){
    const rebels=W.houses.filter(function(h){return !h.exiled&&h.loyalty<28;});
    if(rebels.length)startWar(W,rebels,'왕실의 생선세에 반발하여',day);
  }
}
function startWar(W,rebels,reason,day){
  if(W.war)return;
  W.war={rebels:rebels.map(function(h){return h.id;}),score:0,start:day,battles:0};
  M.chron('war',rebels.map(function(h){return h.name;}).join('·')+'이 '+reason+' 깃발을 세움. 왕국 내전이 시작됨.',rebels[0].seat,7);
  rebels.forEach(function(h){
    W.armies.push({id:Date.now()+h.id,house:h.id,side:'rebel',from:h.seat,to:0,start:day,duration:M.dist(settlement(W,h.seat),W.settlements[0])/60+5,progress:0});
    if(M.spawnArmyVisual)M.spawnArmyVisual(W.armies[W.armies.length-1]);
  });
}
function warDay(W,day){
  if(!W.war)return;
  W.armies.forEach(function(a){a.progress=(day-a.start)/a.duration;});
  if(day%18===0){
    const rebels=W.war.rebels.map(function(id){return house(W,id);}).filter(Boolean);
    const rebelMight=rebels.reduce(function(a,h){return a+settlement(W,h.seat).pop*(1-h.loyalty/140);},0);
    const crownMight=W.settlements.filter(function(s){return W.war.rebels.indexOf(s.owner)<0;}).reduce(function(a,s){return a+s.pop;},0)*W.legitimacy/100;
    const swing=W.rng.range(-24,24)+(crownMight-rebelMight)/Math.max(80,W.realmPop)*65;
    W.war.score+=swing;W.war.battles++;
    const site=W.rng.pick(W.settlements);
    M.chron('war',site.name+' 들판에서 왕실군과 반란군이 충돌하여 '+(swing>=0?'왕실군':'반란군')+'이 우세를 잡음.',site.id,4);
    site.pop=Math.max(20,site.pop-W.rng.range(6,35));
  }
  if(W.war.score>100||day-W.war.start>900&&W.war.score>=0)endWar(W,true);
  else if(W.war.score<-100||day-W.war.start>900)endWar(W,false);
}
function endWar(W,crownWins){
  if(crownWins){
    W.war.rebels.forEach(function(id){const h=house(W,id);h.exiled=true;h.loyalty=5;});
    W.legitimacy=M.clamp(W.legitimacy+12,0,100);
    M.chron('war','왕실군이 반란 깃발을 내리고 왕국의 길을 다시 열었으며, 패한 가문은 변방으로 추방됨.',0,7);
  }else{
    const victor=house(W,W.war.rebels[0]);
    const head=notable(W,victor.head);
    if(head){head.house=-1;head.role='국왕';W.monarch=head.id;}
    W.legitimacy=48;
    M.chron('war',victor.name+'이 수도의 황금 방울을 차지하고 새 왕조를 열었음.',0,7);
  }
  W.war=null;W.peaceUntil=Math.floor(W.clock.day)+360;
  W.armies.slice().forEach(function(a){if(M.removeAgentVisual)M.removeAgentVisual(a.id);});W.armies=[];
}

function weatherDay(W,day){
  if(W.weather.until<=day){
    const season=Math.floor((day%360)/90);
    W.weather.state=M.pickWeighted(W.rng,season===3?[['맑음',5],['눈',3],['폭풍',1]]:[['맑음',6],['비',3],['폭풍',1]]);
    W.weather.until=day+W.rng.int(3,16);
  }
  if(W.drought>0)W.drought--;
  if(day%30===21&&W.rng.chance(.018*W.rates.disaster/W.tech.bonus.ward)){
    const roll=W.rng.next();
    if(roll<.25){W.drought=W.rng.int(60,150);M.chron('fate','비구름이 왕국을 비껴가며 긴 가뭄이 시작됨.',0,5);}
    else if(roll<.5){const s=W.rng.pick(W.settlements);s.fire=W.rng.int(20,55);M.chron('fate',s.name+'의 건어물 창고에서 불이 번져 지붕 사이로 불티가 날림.',s.id,5);}
    else if(roll<.75){const s=W.rng.pick(W.settlements.filter(function(x){return x.harbor;}));if(s){s.flood=60;M.chron('fate',s.name+'의 강물이 둑을 넘어 생선 시장을 덮침.',s.id,5);}}
    else{quake(W,W.rng.pick(W.settlements));}
  }
}
function quake(W,s){
  if(!s)return;let lost=0;
  const guard=.05/(1+(s.civic?s.civic.wall:0)*.45+(W.tech.bonus.ward-1));
  s.buildings.filter(function(b){return b.alive;}).forEach(function(b){if(W.rng.chance(guard)){b.alive=false;lost++;if(M.removeBuildingVisual)M.removeBuildingVisual(b);}});
  s.ruins+=lost;s.pop=Math.max(20,s.pop-lost*W.rng.range(1,4));
  M.chron('fate',s.name+' 아래에서 땅이 흔들려 집 '+lost+'채가 무너짐.',s.id,5);
}

function banditDay(W,day){
  if(W.bandits.length<3&&W.rng.chance((.0012+(W.war?.003:0))*W.rates.bandit)){
    const s=W.rng.pick(W.settlements.slice(1));
    const b={id:Date.now()+W.rng.int(0,999),near:s.id,strength:W.rng.int(30,90),born:day};
    W.bandits.push(b);M.chron('fate',s.name+' 바깥 숲에 들개 도적단이 자리를 잡아 상단이 호위 고양이를 구함.',s.id,4);
  }
  W.bandits.slice().forEach(function(b){
    if(day-b.born>W.rng.int(250,600)||b.strength<10){
      W.bandits.splice(W.bandits.indexOf(b),1);M.chron('fate',settlement(W,b.near).name+' 길목의 들개 도적단이 흩어져 수레가 다시 다니기 시작함.',b.near,2);
    }
  });
}

function dragonDay(W,day){
  const d=W.dragon;if(!d||d.dead||W.rates.myth===0)return;
  if(d.state==='sleeping'&&day>d.until&&W.treasury>7000&&W.rng.chance(.00045*W.rates.myth)){
    d.state='flying';d.target=W.rng.pick(W.settlements).id;d.until=day+12;
    if(M.spawnDragonVisual)M.spawnDragonVisual();
    M.chron('myth',d.name+'이 산 위에서 날개를 펴자 달빛이 잠시 가려짐.',d.target,7);
  }else if(d.state==='flying'&&day>=d.until){
    const s=settlement(W,d.target);s.fire=35;s.stores.fish*=.65;W.treasury*=.92;
    M.chron('myth',d.name+'이 '+s.name+'의 생선 창고를 덮쳐 가장 큰 참치통을 물고 감.',s.id,7);
    d.state='return';d.until=day+10;
  }else if(d.state==='return'&&day>=d.until){
    d.state='sleeping';d.until=day+W.rng.int(600,1500);
    if(M.removeDragonVisual)M.removeDragonVisual();
  }
}

function rareEvent(W,day){
  if(day%30!==21||!W.rng.chance(.05))return;
  const s=W.rng.pick(W.settlements),roll=W.rng.next();
  if(roll<.17&&W.rates.myth){
    s.prosperity=M.clamp(s.prosperity+.08,0,1);
    M.chron('myth',s.name+' 우물가에 흰 고양이가 나타나 세 번 울고 사라졌으며, 주민들은 풍어의 징조로 기록함.',s.id,4);
  }else if(roll<.34){
    W.treasury+=400;M.chron('myth',s.name+' 들판에 별똥별이 떨어져 대장장이들이 반짝이는 쇳조각을 거둠.',s.id,4);
  }else if(roll<.52){
    s.stores.churu+=s.pop*4;M.chron('trade',s.name+'의 장인이 새 참치맛 츄르를 만들어 장날이 사흘 동안 이어짐.',s.id,3);
  }else if(roll<.7){
    const h=W.rng.pick(W.houses.filter(function(x){return !x.exiled;}));h.loyalty=M.clamp(h.loyalty+12,0,100);
    M.chron('crown',h.name+'이 국왕에게 황금 털실을 바치며 충성을 새로 맹세함.',h.seat,3);
  }else{
    s.unrest=M.clamp(s.unrest+12,0,100);M.chron('fate',s.name+'의 생선 저울이 조작되었다는 소문이 퍼져 시장 고양이들이 항의함.',s.id,3);
  }
}

function snapshot(W){
  W.history.push({day:Math.floor(W.clock.day),pop:Math.round(W.realmPop),treasury:Math.round(W.treasury),pros:+avg(W,'prosperity').toFixed(3),unrest:+avg(W,'unrest').toFixed(2)});
  if(W.history.length>180)W.history.shift();
}

function researchDay(W){
  // 백성·번영이 학문을 키움. 연구력을 모아 기술을 해금함.
  const pros=W.settlements.reduce(function(a,s){return a+s.prosperity;},0)/Math.max(1,W.settlements.length);
  W.tech.points+=W.realmPop*(.28+pros*.9)*.0003*W.tech.bonus.research;
}

function developMilestone(W){
  const step=200,mark=Math.floor(W.dev/step);
  if(mark>W.devMark&&W.dev>=step){
    W.devMark=mark;
    M.chron('crown','왕국 발전도가 '+(mark*step)+'을 넘어 「'+W.devTier+'」의 격을 갖춤.',0,5);
  }
  if(!W.victory&&W.dev>=M.DEV_WIN&&W.tech.era>=M.ERAS.length-1){
    W.victory=true;
    M.chron('myth','다섯 가문이 한자리에 모여 '+W.realmName+'을 전설의 왕국으로 선포함. 황금 방울 소리가 사계절 내내 울림.',0,7);
  }
}

M.tickDay=function(day){
  const W=M.state;
  if(day%360===0&&day>0)M.chron('year','모구력 '+(Math.floor(day/360)+1)+'년',0,1);
  weatherDay(W,day);
  W.settlements.forEach(function(s){economyDay(W,s,day);plagueDay(W,s,day);});
  if(day%9===2)findTrade(W);
  caravansDay(W,day);
  ageNotables(W,day);
  politicsDay(W,day);
  warDay(W,day);
  banditDay(W,day);
  dragonDay(W,day);
  rareEvent(W,day);
  researchDay(W);
  M.worldMetrics(W);
  developMilestone(W);
  if(day%30===0)snapshot(W);
  if(M.onSimDay)M.onSimDay(day);
};

M.advanceSimulation=function(realDt){
  const W=M.state;
  const days=M.SPEEDS[W.clock.speed]*realDt;
  const before=Math.floor(W.clock.day);
  W.clock.day+=days;
  const after=Math.floor(W.clock.day);
  let guard=0;
  for(let d=before+1;d<=after&&guard<5000;d++,guard++)M.tickDay(d);
};

// 국왕이 츄르를 들여 고을에 문물을 세움
const CIVIC_DEFS={
  granary:{key:'granary',name:'곡창',base:800, note:'곡물 수확과 식량 보존이 좋아짐'},
  market: {key:'market', base:950, name:'시장',note:'교역과 세수, 번영이 함께 오름'},
  harbor: {key:'harbor', base:1100,name:'항구',note:'포구가 열려 생선 어획이 늘어남'},
  wall:   {key:'wall',   base:850, name:'성벽',note:'재난과 전란의 피해를 크게 막음'},
  temple: {key:'temple', base:1000,name:'신전',note:'백성의 불만이 가라앉음'}
};
M.civicCost=function(s,key){
  const d=CIVIC_DEFS[key];if(!d||!s.civic)return Infinity;
  return Math.round(d.base*Math.pow(1.5,s.civic[key]||0));
};
function buildCivic(W,s,key){
  const d=CIVIC_DEFS[key];if(!d||!s)return;
  const cost=M.civicCost(s,key);
  if(W.treasury<cost){
    M.chron('realm',s.name+'에 '+d.name+'을 세우려 했으나 왕실 창고의 츄르가 모자람('+M.fmt(cost)+' 필요).',s.id,2);
    if(M.toast)M.toast('츄르 부족 · '+d.name+' 건설에 '+M.fmt(cost)+' 필요 (보유 '+M.fmt(W.treasury)+')','warn');
    return;
  }
  W.treasury-=cost;
  s.civic[key]=(s.civic[key]||0)+1;
  if(key==='harbor')s.harbor=true;
  if(key==='temple')W.legitimacy=M.clamp(W.legitimacy+2,0,100);
  if(key==='market'||key==='wall'){s.unrest=M.clamp(s.unrest-3,0,100);}
  // 시각적으로 새 건물 한 채를 올림 (문물은 조금 크고 눈에 띄게)
  const r=W.rng,a=r.range(0,Math.PI*2),rad=r.range(s.radius*.3,s.radius*.7);
  const b={x:s.x+Math.cos(a)*rad,z:s.z+Math.sin(a)*rad,w:r.range(17,24),d:r.range(17,24),h:r.range(18,30),rot:r.range(-.3,.3),roof:r.int(0,3),color:r.int(0,5),alive:true,civic:key};
  s.buildings.push(b);if(M.addBuildingVisual)M.addBuildingVisual(s,b);
  M.chron('crown',s.name+'에 '+d.name+'('+(s.civic[key])+'째)이 세워짐. '+d.note+'. 츄르 '+M.fmt(cost)+' 사용.',s.id,4);
  if(M.focusSettlement)M.focusSettlement(s.id);
  if(M.toast)M.toast('🏛 '+s.name+' · '+d.name+' 건설 완료 · 츄르 '+M.fmt(cost)+' 사용','ok');
}

M.runAct=function(act,target){
  const W=M.state;
  let s=typeof target==='number'?settlement(W,target):target&&target.id!=null?settlement(W,target.id):null;
  if(!s&&target&&target.x!=null)s=M.nearestSettlement(target.x,target.z);
  if(act.indexOf('build_')===0){buildCivic(W,s||W.settlements[0],act.slice(6));}
  else if(act==='invest'){
    s=s||W.settlements[0];const cost=700;
    if(W.treasury<cost){M.chron('realm',s.name+'에 투자하려 했으나 츄르가 모자람.',s.id,2);if(M.toast)M.toast('츄르 부족 · 번영 투자에 '+M.fmt(cost)+' 필요 (보유 '+M.fmt(W.treasury)+')','warn');}
    else{W.treasury-=cost;s.prosperity=M.clamp(s.prosperity+.07,0,1);s.unrest=M.clamp(s.unrest-5,0,100);M.chron('crown',s.name+'의 저잣거리에 왕실 츄르 '+M.fmt(cost)+'가 풀려 살림이 넉넉해짐.',s.id,3);if(M.focusSettlement)M.focusSettlement(s.id);if(M.toast)M.toast('💰 '+s.name+' · 번영 투자 완료 · 츄르 '+M.fmt(cost)+' 사용','ok');}
  }
  else if(act==='plague'){infect(W,s||W.rng.pick(W.settlements),'궁정의 명령으로');}
  else if(act==='fire'){s=s||W.rng.pick(W.settlements);s.fire=45;M.chron('fate',s.name+'에 인위적인 대화재가 시작됨.',s.id,5);}
  else if(act==='flood'){const ports=W.settlements.filter(function(x){return x.harbor;});s=W.rng.pick(ports.length?ports:W.settlements);if(s){s.flood=80;M.chron('fate',s.name+'의 강물이 갑자기 불어 시장까지 넘침.',s.id,5);}}
  else if(act==='drought'){W.drought=120;M.chron('fate','왕국 전역에 가뭄이 선포되어 우물과 곡물 창고를 함께 관리함.',0,5);}
  else if(act==='quake'){quake(W,s||W.rng.pick(W.settlements));}
  else if(act==='dragon'){W.dragon.until=0;W.treasury=Math.max(W.treasury,9000);dragonDay(W,Math.floor(W.clock.day)+1);}
  else if(act==='bandits'){s=s||W.rng.pick(W.settlements.slice(1));W.bandits.push({id:Date.now(),near:s.id,strength:70,born:Math.floor(W.clock.day)});M.chron('fate',s.name+' 외곽에 들개 도적단이 깃발을 세움.',s.id,4);}
  else if(act==='assassinate'){const k=notable(W,W.monarch);if(k)killNotable(W,k,'의문의 독이 든 츄르를 먹고',Math.floor(W.clock.day));}
  else if(act==='contest'){const h=W.houses.filter(function(x){return !x.exiled;}).sort(function(a,b){return a.loyalty-b.loyalty;})[0];if(h){h.loyalty=0;startWar(W,[h],'왕위 계승을 인정하지 않고',Math.floor(W.clock.day));}}
  else if(act==='marriage'){
    const k=notable(W,W.monarch);
    if(k&&!k.spouse){const n={id:W.nextIds.notable++,given:W.rng.pick(['나비','라떼','별이','설이']),name:'',house:-1,role:'왕비',age:W.rng.range(19,35),alive:true,traits:['사교적임'],spouse:k.id,children:[],born:0};n.name=n.given+' 모구';W.notables.push(n);k.spouse=n.id;M.chron('crown',k.name+' 국왕과 '+n.name+'의 혼인이 수도 광장에서 열림.',0,5);}
    else M.chron('crown','왕실이 다섯 가문의 혼인 서약을 정리하여 가문 사이의 긴장이 낮아짐.',0,3);
    W.houses.forEach(function(h){h.loyalty=M.clamp(h.loyalty+5,0,100);});
  }
  else if(act==='bless'){W.settlements.forEach(function(x){x.stores.fish+=x.pop*18;x.prosperity=M.clamp(x.prosperity+.05,0,1);});M.chron('myth','왕국 모든 포구에 은빛 물고기 떼가 들어와 창고가 가득 참.',0,5);}
  else if(act==='comet'){W.treasury+=400;M.chron('myth','긴 꼬리별이 왕국 하늘을 가로질러 천문 고양이들이 밤새 기록함.',0,5);}
  else if(act==='found'&&target&&target.x!=null){M.foundSettlement(target.x,target.z);}
  else if(act==='gold'){W.treasury+=5000;M.chron('crown','왕실 창고에 츄르 5,000개가 추가로 들어옴.',0,3);}
  else if(act==='raze'){s=s||W.rng.pick(W.settlements);const alive=s.buildings.filter(function(b){return b.alive;});if(alive.length){const b=W.rng.pick(alive);b.alive=false;s.ruins++;if(M.removeBuildingVisual)M.removeBuildingVisual(b);M.chron('fate',s.name+'의 건물 한 채가 왕명으로 철거됨.',s.id,2);}}
  M.worldMetrics(W);
  if(M.refreshUI)M.refreshUI(true);
};

M.nearestSettlement=function(x,z){
  let best=null,bd=Infinity;
  M.state.settlements.forEach(function(s){const d=Math.hypot(s.x-x,s.z-z);if(d<bd){bd=d;best=s;}});
  return best;
};

M.foundSettlement=function(x,z){
  const W=M.state;
  if(W.settlements.length>=14){M.chron('realm','새 마을 허가를 검토했으나 왕국의 행정 한계에 도달함.',0,2);return;}
  const name=W.rng.pick(['새봄마을','은방울터','고운털고을','참치나루','달수염골'])+W.nextIds.settlement;
  const s={id:W.nextIds.settlement++,name:name,kind:'village',x:x,z:z,y:M.heightAt(x,z),pop:80,radius:64,harbor:Math.abs(x-M.riverX(z,W.seed))<220,
    buildings:[],owner:W.rng.int(0,W.houses.length-1),prosperity:.45,hunger:0,unrest:6,inf:0,sus:1,fire:0,flood:0,ruins:0,
    civic:{granary:0,market:0,harbor:0,wall:0,temple:0},
    stores:{grain:5600,fish:500,timber:180,ore:12,tools:36,cloth:24,churu:10},production:{},trade:0,lastEvent:0};
  for(let i=0;i<12;i++){const a=W.rng.range(0,Math.PI*2),r=W.rng.range(8,58);s.buildings.push({x:x+Math.cos(a)*r,z:z+Math.sin(a)*r,w:W.rng.range(8,13),d:W.rng.range(8,13),h:W.rng.range(7,12),rot:W.rng.range(-.3,.3),roof:W.rng.int(0,3),color:W.rng.int(0,5),alive:true});}
  let nearest=W.settlements[0],bd=Infinity;W.settlements.forEach(function(o){const d=M.dist(s,o);if(d<bd){bd=d;nearest=o;}});
  W.settlements.push(s);W.roads.push({id:W.roads.length,from:s.id,to:nearest.id,volume:0});
  if(M.addSettlementVisual)M.addSettlementVisual(s,nearest);
  M.chron('realm',s.name+'이 새 마을로 허가되어 '+nearest.name+'까지 이어지는 흙길이 놓임.',s.id,5);
};
}
