// render.js — 저다각형 3D 왕국, 카메라, 지도 표시와 이동 개체
{
const M=window.MKR;
let T,renderer,scene,camera,sun,hemi,terrain,river,sea;
let cam={target:null,yaw:-.78,pitch:.72,dist:1250,min:180,max:3100};
let pointer={down:false,id:null,x:0,y:0,button:0,moved:false,lastTap:0};
let touches=new Map(),pinch=null;
const roofColors=[0x6d4435,0x3e5873,0x6a5942,0x78413b,0x4a5f45,0x66516f];
const wallColors=[0xd9c69f,0xe4d9bd,0xc9b18b,0xe1c6aa,0xc8c9b5,0xbca987];
const visuals={settlements:new Map(),roads:[],agents:new Map(),territories:[],tradeLines:[],dragon:null,trees:null,select:null};
M.visual=visuals;

function fatal(msg){
  document.getElementById('fatalText').textContent=msg;
  document.getElementById('fatal').classList.remove('hidden');
  document.getElementById('loading').classList.add('hidden');
}

function mat(color,rough){
  return new T.MeshStandardMaterial({color:color,roughness:rough==null?.9:rough,metalness:0,flatShading:true});
}

function setProgress(i,text){
  const el=document.getElementById('loadFill'),tx=document.getElementById('loadStep');
  if(el)el.style.width=Math.round(i/9*100)+'%';
  if(tx)tx.textContent=text;
}

function terrainColor(h,x,z){
  if(h<3)return new T.Color(0x89945d);
  if(h>92)return new T.Color(0x9b9984);
  const wet=Math.abs(x-M.riverX(z,M.state.seed));
  if(wet<85)return new T.Color(0x7c9160);
  if(h>60)return new T.Color(0x7f845e);
  return new T.Color(0x6f8a50);
}

function buildTerrain(){
  const size=M.WORLD_SIZE,seg=84;
  const g=new T.PlaneGeometry(size,size,seg,seg);
  const p=g.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=-p.getY(i),h=M.heightAt(x,z);
    p.setZ(i,h);
    const c=terrainColor(h,x,z);
    colors.push(c.r,c.g,c.b);
  }
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();
  const m=new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:false});
  terrain=new T.Mesh(g,m);terrain.rotation.x=-Math.PI/2;terrain.receiveShadow=true;terrain.userData.ground=true;scene.add(terrain);
}

function ribbon(points,width,color,opacity){
  const pos=[],idx=[];
  for(let i=0;i<points.length;i++){
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    let dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
    const px=-dz*width*.5,pz=dx*width*.5;
    pos.push(points[i].x+px,points[i].y,points[i].z+pz,points[i].x-px,points[i].y,points[i].z-pz);
    if(i<points.length-1){const q=i*2;idx.push(q,q+1,q+2,q+1,q+3,q+2);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  return new T.Mesh(g,new T.MeshStandardMaterial({color:color,transparent:opacity<1,opacity:opacity,roughness:.35,metalness:.05,side:T.DoubleSide}));
}

function buildWater(){
  const pts=[];
  for(let i=0;i<=70;i++){const z=-1320+i/70*2640,x=M.riverX(z,M.state.seed);pts.push({x:x,y:3.5,z:z});}
  river=ribbon(pts,68,0x6ea7b8,.92);river.renderOrder=2;scene.add(river);
  const sg=new T.PlaneGeometry(720,2600,1,1);
  sea=new T.Mesh(sg,new T.MeshStandardMaterial({color:0x6b9faf,transparent:true,opacity:.92,roughness:.3}));
  sea.rotation.x=-Math.PI/2;sea.position.set(1310,3,0);scene.add(sea);
}

function roadPoints(a,b){
  const pts=[],n=28;
  const bend=((a.id*71+b.id*37)%100-50)*1.4;
  for(let i=0;i<n;i++){
    const t=i/(n-1),x=M.lerp(a.x,b.x,t)+Math.sin(t*Math.PI)*bend,z=M.lerp(a.z,b.z,t)+Math.sin(t*Math.PI*2)*18;
    pts.push(new T.Vector3(x,M.heightAt(x,z)+2,z));
  }
  return pts;
}

function addRoad(rd){
  const a=M.state.settlements.find(function(s){return s.id===rd.from;}),b=M.state.settlements.find(function(s){return s.id===rd.to;});
  if(!a||!b)return;
  const pts=roadPoints(a,b);
  rd.points=pts;
  const g=new T.BufferGeometry().setFromPoints(pts);
  const line=new T.Line(g,new T.LineBasicMaterial({color:0x6e5c42,transparent:true,opacity:.75}));
  line.userData.roadId=rd.id;scene.add(line);visuals.roads.push(line);
  const tg=new T.BufferGeometry().setFromPoints(pts.map(function(p){return p.clone().add(new T.Vector3(0,2,0));}));
  const trade=new T.Line(tg,new T.LineBasicMaterial({color:0xe6b84c,transparent:true,opacity:.9}));
  trade.visible=false;scene.add(trade);visuals.tradeLines.push(trade);
}

function roofGeometry(w,d,h,type){
  if(type===0){
    const g=new T.ConeGeometry(Math.max(w,d)*.72,h,4);g.rotateY(Math.PI/4);return g;
  }
  if(type===1)return new T.ConeGeometry(Math.max(w,d)*.68,h,6);
  const shape=new T.BufferGeometry();
  const x=w*.58,z=d*.58,y=h;
  const p=[-x,0,-z,x,0,-z,x,0,z,-x,0,z,0,y,-z,0,y,z];
  const ix=[0,1,4,0,4, 0,4,5,0,5,3, 1,2,5,1,5,4, 3,5,2,3,2];
  shape.setAttribute('position',new T.Float32BufferAttribute(p,3));shape.setIndex(ix);shape.computeVertexNormals();return shape;
}

function catEarGeometry(){
  const g=new T.ConeGeometry(1,2,3);g.rotateZ(Math.PI);return g;
}

function addBuilding(s,b){
  const group=new T.Group();
  const wall=mat(wallColors[b.color%wallColors.length]);
  const roof=mat(roofColors[b.color%roofColors.length]);
  const body=new T.Mesh(new T.BoxGeometry(b.w,b.h,b.d),wall);
  body.position.y=b.h*.5;body.castShadow=true;body.receiveShadow=true;body.userData.settlementId=s.id;body.userData.building=b;
  const top=new T.Mesh(roofGeometry(b.w,b.d,Math.max(3,b.h*.42),b.roof),roof);
  top.position.y=b.h+Math.max(3,b.h*.42)*.35;top.castShadow=true;top.userData.settlementId=s.id;top.userData.building=b;
  group.add(body,top);
  if(b.w>16&&b.h>16){
    const earMat=mat(roofColors[b.color%roofColors.length]);
    [-1,1].forEach(function(side){
      const e=new T.Mesh(catEarGeometry(),earMat);e.scale.set(2.2,3.5,2.2);e.position.set(side*b.w*.23,b.h+7,b.d*.08);e.userData.settlementId=s.id;group.add(e);
    });
  }
  const sg=visuals.settlements.get(s.id);
  if(sg)group.position.set(b.x-sg.s.x,M.heightAt(b.x,b.z)-M.heightAt(sg.s.x,sg.s.z),b.z-sg.s.z);
  else group.position.set(b.x,M.heightAt(b.x,b.z),b.z);
  group.rotation.y=b.rot;
  b._mesh=group;b._base=wall.color.getHex();
  if(sg)sg.group.add(group);else scene.add(group);
  return group;
}
M.addBuildingVisual=addBuilding;
M.removeBuildingVisual=function(b){if(b&&b._mesh)b._mesh.visible=false;};

function addKeep(s,group){
  const stone=mat(0x827c70),dark=mat(0x5e554a),gold=mat(0xc59627,.55);
  const base=new T.Mesh(new T.BoxGeometry(48,54,48),stone);base.position.set(0,27,0);base.castShadow=true;base.userData.settlementId=s.id;group.add(base);
  [-1,1].forEach(function(x){[-1,1].forEach(function(z){
    const tower=new T.Mesh(new T.CylinderGeometry(10,12,66,8),dark);tower.position.set(x*30,33,z*30);tower.castShadow=true;tower.userData.settlementId=s.id;group.add(tower);
    const cap=new T.Mesh(new T.ConeGeometry(15,18,8),gold);cap.position.set(x*30,75,z*30);cap.userData.settlementId=s.id;group.add(cap);
  });});
  const crown=new T.Mesh(new T.TorusGeometry(15,2.2,6,18),gold);crown.rotation.x=Math.PI/2;crown.position.y=60;group.add(crown);
}

function addWalls(s,group){
  const m=mat(0x827968);
  const n=24,r=s.radius*1.08;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;
    const x1=Math.cos(a)*r,z1=Math.sin(a)*r,x2=Math.cos(b)*r,z2=Math.sin(b)*r;
    const len=Math.hypot(x2-x1,z2-z1),wall=new T.Mesh(new T.BoxGeometry(len,9,4),m);
    wall.position.set((x1+x2)/2,5,(z1+z2)/2);wall.rotation.y=-Math.atan2(z2-z1,x2-x1);wall.castShadow=true;wall.userData.settlementId=s.id;group.add(wall);
  }
}

function addTerritory(s){
  const owner=s.owner<0?{color:'#c59627'}:M.state.houses[s.owner];
  const g=new T.CircleGeometry(s.kind==='capital'?380:s.kind==='town'?270:180,48);
  const me=new T.Mesh(g,new T.MeshBasicMaterial({color:owner.color,transparent:true,opacity:.13,depthWrite:false,side:T.DoubleSide}));
  me.rotation.x=-Math.PI/2;me.position.set(s.x,M.heightAt(s.x,s.z)+1,s.z);me.visible=false;scene.add(me);visuals.territories.push({mesh:me,s:s});
}

function addSettlement(s){
  const group=new T.Group();group.position.set(s.x,M.heightAt(s.x,s.z),s.z);scene.add(group);
  visuals.settlements.set(s.id,{group:group,s:s});
  if(s.kind==='capital'){addKeep(s,group);addWalls(s,group);}
  s.buildings.forEach(function(b){addBuilding({id:s.id},b);});
  addTerritory(s);
}

function buildTrees(){
  const group=new T.Group(),r=M.rng(M.state.seed+':trees');
  const trunkMat=mat(0x57452f),leafMats=[mat(0x385d39),mat(0x4a6c3d),mat(0x667341)];
  const trunkG=new T.CylinderGeometry(1.2,1.8,9,5),leafG=new T.ConeGeometry(7,18,6);
  for(let i=0;i<430;i++){
    const x=r.range(-1250,1250),z=r.range(-1250,1250);
    if(Math.abs(x-M.riverX(z,M.state.seed))<95||M.state.settlements.some(function(s){return Math.hypot(s.x-x,s.z-z)<s.radius*1.4;}))continue;
    const y=M.heightAt(x,z),g=new T.Group(),tr=new T.Mesh(trunkG,trunkMat),leaf=new T.Mesh(leafG,r.pick(leafMats));
    tr.position.y=4.5;leaf.position.y=16;g.add(tr,leaf);g.position.set(x,y,z);const sc=r.range(.65,1.25);g.scale.set(sc,sc,sc);group.add(g);
  }
  visuals.trees=group;scene.add(group);
}

function buildLandmarks(){
  const cap=M.state.settlements[0];
  const fish=new T.Group(),silver=mat(0xc7d3d3,.4),eye=mat(0x202020);
  const body=new T.Mesh(new T.SphereGeometry(14,10,7),silver);body.scale.set(1.9,.9,.75);fish.add(body);
  const tail=new T.Mesh(new T.ConeGeometry(11,22,3),silver);tail.rotation.z=-Math.PI/2;tail.position.x=-29;fish.add(tail);
  const e=new T.Mesh(new T.SphereGeometry(1.6,8,6),eye);e.position.set(20,4,-8);fish.add(e);
  fish.position.set(cap.x+80,M.heightAt(cap.x+80,cap.z)+18,cap.z-40);fish.rotation.y=.4;scene.add(fish);
}

M.initRenderer=function(){
  if(!window.THREE){fatal('3D 엔진을 불러오지 못했음. 인터넷 연결을 확인한 뒤 다시 열어 주세요.');return false;}
  T=window.THREE;
  renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  document.getElementById('app').appendChild(renderer.domElement);
  scene=new T.Scene();scene.background=new T.Color(0x8da4b7);scene.fog=new T.FogExp2(0x9ca8a2,.00019);
  camera=new T.PerspectiveCamera(42,innerWidth/innerHeight,2,7000);
  cam.target=new T.Vector3(0,0,0);
  hemi=new T.HemisphereLight(0xc9ddff,0x495132,.82);scene.add(hemi);
  sun=new T.DirectionalLight(0xffe2a6,1.16);sun.position.set(-900,1400,-650);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-1500;sun.shadow.camera.right=1500;sun.shadow.camera.top=1500;sun.shadow.camera.bottom=-1500;scene.add(sun);

  setProgress(1,'왕국의 지형을 빚는 중…');buildTerrain();
  setProgress(2,'강과 바다를 채우는 중…');buildWater();
  setProgress(3,'수도와 고을을 세우는 중…');M.state.settlements.forEach(addSettlement);
  setProgress(5,'왕국의 길을 잇는 중…');M.state.roads.forEach(addRoad);
  setProgress(6,'숲과 들판을 가꾸는 중…');buildTrees();
  setProgress(7,'황금 물고기 상징을 세우는 중…');buildLandmarks();
  setProgress(8,'왕국의 고양이들을 깨우는 중…');
  bindCamera();updateCamera();
  window.addEventListener('resize',resize);
  return true;
};

function resize(){
  if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
}

function updateCamera(){
  const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
  camera.position.set(cam.target.x+Math.sin(cam.yaw)*cp*cam.dist,cam.target.y+sp*cam.dist+70,cam.target.z+Math.cos(cam.yaw)*cp*cam.dist);
  camera.lookAt(cam.target.x,cam.target.y,cam.target.z);
}

function bindCamera(){
  const el=renderer.domElement;
  el.addEventListener('contextmenu',function(e){e.preventDefault();});
  el.addEventListener('pointerdown',function(e){
    el.setPointerCapture(e.pointerId);touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size===2){const a=Array.from(touches.values());pinch={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),cx:(a[0].x+a[1].x)/2,cy:(a[0].y+a[1].y)/2};}
    pointer={down:true,id:e.pointerId,x:e.clientX,y:e.clientY,button:e.button,moved:false,lastTap:pointer.lastTap};
    M.state.director=false;if(M.syncDirectorButtons)M.syncDirectorButtons();
  });
  el.addEventListener('pointermove',function(e){
    if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size===2&&pinch){
      const a=Array.from(touches.values()),d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),cx=(a[0].x+a[1].x)/2,cy=(a[0].y+a[1].y)/2;
      cam.dist=M.clamp(cam.dist*pinch.d/Math.max(1,d),cam.min,cam.max);
      panCamera((cx-pinch.cx)*-1,(cy-pinch.cy)*-1);pinch={d:d,cx:cx,cy:cy};updateCamera();return;
    }
    if(!pointer.down||e.pointerId!==pointer.id)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.abs(dx)+Math.abs(dy)>3)pointer.moved=true;
    if(pointer.button===2||e.shiftKey)panCamera(dx,dy);
    else{cam.yaw-=dx*.006;cam.pitch=M.clamp(cam.pitch+dy*.004,.16,1.25);}
    pointer.x=e.clientX;pointer.y=e.clientY;updateCamera();
  });
  function end(e){
    touches.delete(e.pointerId);if(touches.size<2)pinch=null;
    if(pointer.down&&e.pointerId===pointer.id&&!pointer.moved){
      const now=performance.now();
      if(now-pointer.lastTap<330){const hit=M.pickAt(e.clientX,e.clientY);if(hit&&hit.settlement)M.focusSettlement(hit.settlement.id);}
      else if(M.onMapClick)M.onMapClick(e.clientX,e.clientY);
      pointer.lastTap=now;
    }
    if(e.pointerId===pointer.id)pointer.down=false;
  }
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
  el.addEventListener('wheel',function(e){e.preventDefault();cam.dist=M.clamp(cam.dist*Math.exp(e.deltaY*.001),cam.min,cam.max);updateCamera();},{passive:false});
}

function panCamera(dx,dy){
  const scale=cam.dist*.0014;
  const right=new T.Vector3(Math.cos(cam.yaw),0,-Math.sin(cam.yaw));
  const forward=new T.Vector3(Math.sin(cam.yaw),0,Math.cos(cam.yaw));
  cam.target.addScaledVector(right,-dx*scale);cam.target.addScaledVector(forward,-dy*scale);
  cam.target.x=M.clamp(cam.target.x,-1200,1200);cam.target.z=M.clamp(cam.target.z,-1200,1200);cam.target.y=M.heightAt(cam.target.x,cam.target.z);
}

M.focusSettlement=function(id){
  const s=M.state.settlements.find(function(x){return x.id===id;});if(!s)return;
  cam.target.set(s.x,M.heightAt(s.x,s.z)+20,s.z);cam.dist=s.kind==='capital'?520:360;cam.pitch=.62;updateCamera();
  M.state.selected=id;if(M.inspectSettlement)M.inspectSettlement(s);
};

M.pickAt=function(clientX,clientY){
  if(!renderer)return null;
  const r=renderer.domElement.getBoundingClientRect();
  const mouse=new T.Vector2((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height*2-1));
  const ray=new T.Raycaster();ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(scene.children,true);
  for(let i=0;i<hits.length;i++){
    let o=hits[i].object;
    if(o.userData&&o.userData.settlementId!=null)return{settlement:M.state.settlements.find(function(s){return s.id===o.userData.settlementId;}),point:hits[i].point};
    if(o===terrain)return{settlement:M.nearestSettlement(hits[i].point.x,hits[i].point.z),point:hits[i].point};
  }
  return null;
};

M.setOverlay=function(mode){
  M.state.overlay=mode;
  visuals.territories.forEach(function(o){o.mesh.visible=mode==='territory'||mode==='pop'||mode==='prosperity'||mode==='plague'||mode==='unrest';});
  visuals.tradeLines.forEach(function(l){l.visible=mode==='trade';});
  visuals.territories.forEach(function(o){
    let c=o.s.owner<0?'#c59627':M.state.houses[o.s.owner].color,op=.13;
    if(mode==='pop'){const q=M.clamp(o.s.pop/2800,0,1);c=new T.Color().setHSL(.6-q*.55,.75,.48);op=.14+q*.25;}
    else if(mode==='prosperity'){c=new T.Color().setHSL(.02+o.s.prosperity*.32,.72,.45);op=.15+o.s.prosperity*.18;}
    else if(mode==='plague'){c=new T.Color().setHSL(.31-o.s.inf*.3,.8,.42);op=o.s.inf>0?.2+o.s.inf*.5:.06;}
    else if(mode==='unrest'){c=new T.Color().setHSL(.3-o.s.unrest/100*.3,.78,.43);op=.12+o.s.unrest/250;}
    o.mesh.material.color.set(c);o.mesh.material.opacity=op;
  });
  M.state.settlements.forEach(function(s){
    s.buildings.forEach(function(b){
      if(!b._mesh)return;
      const body=b._mesh.children[0];if(!body||!body.material)return;
      if(mode==='plague'&&s.inf>0)body.material.color.setHSL(.28,.55,.32);
      else if(mode==='unrest')body.material.color.setHSL(.08+s.unrest/100*.03,.32,.58);
      else body.material.color.setHex(b._base);
    });
  });
};

function agentPosition(a){
  const from=M.state.settlements.find(function(s){return s.id===a.from;}),to=M.state.settlements.find(function(s){return s.id===a.to;});
  const road=M.state.roads.find(function(rd){return rd.from===a.from&&rd.to===a.to||rd.from===a.to&&rd.to===a.from;});
  let t=M.clamp(a.progress||0,0,1);if(road&&road.from!==a.from)t=1-t;
  if(road&&road.points){
    const q=t*(road.points.length-1),i=Math.floor(q),f=q-i,p0=road.points[i],p1=road.points[Math.min(i+1,road.points.length-1)];
    return new T.Vector3(M.lerp(p0.x,p1.x,f),M.lerp(p0.y,p1.y,f)+5,M.lerp(p0.z,p1.z,f));
  }
  const x=M.lerp(from.x,to.x,t),z=M.lerp(from.z,to.z,t);return new T.Vector3(x,M.heightAt(x,z)+5,z);
}

M.spawnCaravanVisual=function(a){
  const g=new T.Group(),body=new T.Mesh(new T.BoxGeometry(10,5,14),mat(0x8a6337)),cat=new T.Mesh(new T.SphereGeometry(3.5,8,6),mat(0xd8b46e));
  body.position.y=2.5;cat.position.set(0,7,-2);g.add(body,cat);
  [-1,1].forEach(function(side){const wheel=new T.Mesh(new T.CylinderGeometry(3,3,1.5,8),mat(0x3a2b22));wheel.rotation.z=Math.PI/2;wheel.position.set(side*5.6,2,2);g.add(wheel);});
  scene.add(g);visuals.agents.set(a.id,g);
};
M.spawnArmyVisual=function(a){
  const g=new T.Group(),pole=new T.Mesh(new T.CylinderGeometry(.7,.7,22,5),mat(0x514131)),flag=new T.Mesh(new T.PlaneGeometry(15,9),mat(a.side==='rebel'?0x8b2f2a:0xc59627));
  pole.position.y=11;flag.position.set(7,17,0);g.add(pole,flag);scene.add(g);visuals.agents.set(a.id,g);
};
M.removeAgentVisual=function(id){const g=visuals.agents.get(id);if(g){scene.remove(g);visuals.agents.delete(id);}};
M.spawnDragonVisual=function(){
  if(visuals.dragon)return;
  const g=new T.Group(),m=mat(0xd9d6c7),body=new T.Mesh(new T.SphereGeometry(14,9,7),m);body.scale.set(2.3,.8,.8);g.add(body);
  [-1,1].forEach(function(side){const wing=new T.Mesh(new T.ConeGeometry(18,44,3),m);wing.rotation.z=side*.9;wing.rotation.y=side*.4;wing.position.set(0,6,side*18);g.add(wing);});
  const head=new T.Mesh(new T.SphereGeometry(9,8,6),m);head.position.x=32;g.add(head);scene.add(g);visuals.dragon=g;
};
M.removeDragonVisual=function(){if(visuals.dragon){scene.remove(visuals.dragon);visuals.dragon=null;}};

M.addSettlementVisual=function(s,near){
  addSettlement(s);addRoad(M.state.roads[M.state.roads.length-1]);
};

function updateAgents(){
  M.state.caravans.forEach(function(a){const g=visuals.agents.get(a.id);if(g)g.position.copy(agentPosition(a));});
  M.state.armies.forEach(function(a){const g=visuals.agents.get(a.id);if(g)g.position.copy(agentPosition(a));});
  if(visuals.dragon){
    const d=M.state.dragon,t=M.state.settlements.find(function(s){return s.id===d.target;})||M.state.settlements[0];
    const phase=performance.now()*.00022;
    visuals.dragon.position.set(t.x+Math.cos(phase)*180,M.heightAt(t.x,t.z)+150+Math.sin(phase*2)*25,t.z+Math.sin(phase)*180);
    visuals.dragon.rotation.y=-phase;
  }
}

function updateSky(){
  const day=M.state.clock.day%1,season=Math.floor((M.state.clock.day%360)/90);
  const sunA=day*Math.PI*2-Math.PI*.45;
  sun.position.set(Math.cos(sunA)*1200,Math.max(120,Math.sin(sunA)*1450),Math.sin(sunA*.7)*900);
  const daylight=M.clamp((sun.position.y-40)/900,.18,1);
  sun.intensity=.35+daylight*1.25;hemi.intensity=.35+daylight*.85;
  let sky=season===3?new T.Color(0x9daeba):season===2?new T.Color(0xb29a78):new T.Color(0x8da4b7);
  if(M.state.weather.state==='폭풍')sky.multiplyScalar(.58);
  else if(M.state.weather.state==='비')sky.multiplyScalar(.78);
  scene.background.copy(sky);scene.fog.color.copy(sky);
}

M.projectLabels=function(){
  const holder=document.getElementById('labels');if(!holder)return;
  const els=holder.querySelectorAll('.mapLabel');
  els.forEach(function(el){
    const s=M.state.settlements.find(function(x){return x.id===Number(el.dataset.id);});if(!s)return;
    const v=new T.Vector3(s.x,M.heightAt(s.x,s.z)+(s.kind==='capital'?95:42),s.z).project(camera);
    const visible=v.z>-1&&v.z<1&&M.state.labels;
    el.style.display=visible?'block':'none';
    if(visible){el.style.left=(v.x*.5+.5)*innerWidth+'px';el.style.top=(-v.y*.5+.5)*innerHeight+'px';}
  });
};

M.renderFrame=function(dt){
  if(!renderer)return;
  updateAgents();updateSky();
  if(M.state.director&&!pointer.down){
    const t=performance.now()*.000025;
    cam.yaw+=dt*.025;cam.pitch=.62+Math.sin(t*19)*.05;updateCamera();
  }
  if(river&&river.material){river.material.opacity=.88+Math.sin(performance.now()*.0012)*.04;}
  M.projectLabels();
  renderer.render(scene,camera);
};

M.rendererInfo=function(){
  if(!renderer)return{calls:0,triangles:0};
  return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
};
}
