// world.js — 복셀 월드 렌더링 (청크 스트리밍 + 인스턴싱)
import * as THREE from 'three';
const G = window.MOGU;

const CHUNK = 24;          // 청크 z 길이
const BAND = 16;           // 강둑에서 블록으로 채우는 폭

// 공유 지오메트리/머티리얼 캐시
const BOX = new THREE.BoxGeometry(1, 1, 1);
const geoCache = {};
function cyl(r, h, n = 10) {
  const k = `c${r}_${h}_${n}`;
  if (!geoCache[k]) geoCache[k] = new THREE.CylinderGeometry(r, r, h, n);
  return geoCache[k];
}
const matCache = {};
function lambert(color, opts) {
  const k = `${color}_${JSON.stringify(opts || {})}`;
  if (!matCache[k]) matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
  return matCache[k];
}

function makeWaterTexture(hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const col = new THREE.Color(hex);
  g.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`;
  g.fillRect(0, 0, 128, 128);
  const rng = G.makeRng(42);
  for (let i = 0; i < 90; i++) {
    const l = 0.12 + rng.next() * 0.18;
    g.fillStyle = `rgba(255,255,255,${l * 0.35})`;
    const x = rng.next() * 128, y = rng.next() * 128, w = 6 + rng.next() * 22;
    g.fillRect(x, y, w, 2);
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = 'rgba(0,0,30,0.10)';
    g.fillRect(rng.next() * 128, rng.next() * 128, 4 + rng.next() * 10, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

G.WorldRenderer = class {
  constructor(scene, stage) {
    this.scene = scene;
    this.stage = stage;
    this.theme = stage.params.theme;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.chunks = new Map();
    this.collected = new Set();
    this.flowTime = 0;

    const T = this.theme;
    scene.background = new THREE.Color(T.sky);
    scene.fog = new THREE.Fog(T.fog, 18, T.fogFar);

    this.hemi = new THREE.HemisphereLight(T.sky, T.farGround, T.night ? 0.5 : 1.0);
    this.dir = new THREE.DirectionalLight(T.sun, T.night ? 0.35 : 0.95);
    this.dir.position.set(30, 60, -25);
    this.amb = new THREE.AmbientLight(0xffffff, T.ambient * 0.5);
    this.root.add(this.hemi, this.dir, this.amb);

    // 물 (카메라 추적 대형 평면 + 스크롤 텍스처)
    this.waterTex = makeWaterTexture(T.water);
    this.waterTex.repeat.set(64, 64);
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      new THREE.MeshBasicMaterial({ map: this.waterTex, transparent: true, opacity: T.waterOpacity,
        color: 0xffffff, depthWrite: false })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0;
    this.root.add(this.water);
    // 물 아래 어두운 바닥 (깊이감)
    this.waterBed = new THREE.Mesh(new THREE.PlaneGeometry(360, 360),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(T.water).multiplyScalar(0.45) }));
    this.waterBed.rotation.x = -Math.PI / 2;
    this.waterBed.position.y = -0.8;
    this.root.add(this.waterBed);

    // 구름
    this.clouds = [];
    if (!T.night) {
      const cm = lambert(0xffffff, { transparent: true, opacity: 0.92 });
      const crng = G.makeRng(stage.seed + 5);
      for (let i = 0; i < 9; i++) {
        const cl = new THREE.Group();
        for (let b = 0; b < 3; b++) {
          const m = new THREE.Mesh(BOX, cm);
          m.scale.set(5 + crng.next() * 7, 1.6, 3 + crng.next() * 4);
          m.position.set(crng.range(-4, 4), crng.range(-0.4, 0.4), crng.range(-2.5, 2.5));
          cl.add(m);
        }
        cl.position.set(crng.range(-70, 70), 26 + crng.next() * 12, crng.range(0, 160));
        cl.userData.speed = 0.4 + crng.next() * 0.5;
        this.clouds.push(cl);
        this.root.add(cl);
      }
    }
    // 달 + 별 (밤)
    if (T.night) {
      const moon = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xf4f0d8 }));
      moon.scale.set(6, 6, 1);
      this.moon = moon;
      this.root.add(moon);
      const sg = new THREE.BufferGeometry();
      const sp = [];
      const srng = G.makeRng(7);
      for (let i = 0; i < 300; i++) sp.push(srng.range(-160, 160), srng.range(30, 120), srng.range(-60, 200));
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcdd8ff, size: 0.7, fog: false }));
      this.root.add(this.stars);
    }

    // 입자 (눈 / 반딧불)
    this.particles = null;
    if (stage.params.blizzard || T.night) {
      const n = T.night ? 220 : 700;
      const pg = new THREE.BufferGeometry();
      const arr = new Float32Array(n * 3);
      const prng = G.makeRng(stage.seed + 21);
      this.pData = [];
      for (let i = 0; i < n; i++) {
        arr[i * 3] = prng.range(-40, 40); arr[i * 3 + 1] = prng.range(0.5, 24); arr[i * 3 + 2] = prng.range(-20, 90);
        this.pData.push({ vx: prng.range(-0.6, 0.6), vy: T.night ? prng.range(-0.25, 0.25) : -prng.range(4, 8), ph: prng.range(0, 6.28) });
      }
      pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this.particles = new THREE.Points(pg, new THREE.PointsMaterial({
        color: T.night ? 0xffe27a : 0xffffff, size: T.night ? 0.32 : 0.22,
        transparent: true, opacity: T.night ? 0.95 : 0.85,
        blending: T.night ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false }));
      this.root.add(this.particles);
    }
  }

  // ── 지형 높이 ──
  bankHeight(d, x, z) {
    const T = this.theme, P = this.stage.params, s = this.stage.seed;
    if (P.world === 3) { // 캐니언: 강에서 멀수록 급상승
      const n = G.hash2(x, z, s + 31);
      return 1 + Math.min(8, Math.max(0, Math.floor((d - 1.5) * 0.95 + n * 2)));
    }
    if (d < 2.5) return 1;
    const n = G.noise1d(x * 0.13 + z * 0.07, s + 33);
    const hill = n < 0.55 ? 0 : n < 0.82 ? 1 : 2;
    return 1 + (P.world === 4 ? Math.min(hill + (G.hash2(x, z, s + 35) > 0.8 ? 1 : 0), 3) : hill);
  }

  // ── 청크 생성 ──
  buildChunk(ci) {
    const st = this.stage, T = this.theme, s = st.seed;
    const z0 = ci * CHUNK, z1 = z0 + CHUNK;
    const group = new THREE.Group();
    const anims = [];

    // 1) 지형 블록 수집
    const inst = []; // {x,y,z,color}
    const topCols = new THREE.Color(), c = new THREE.Color();
    let minL = Infinity, maxR = -Infinity;
    for (let z = z0; z < z1; z++) {
      const cxz = st.cx(z + 0.5), hw = st.halfW(z + 0.5);
      const xL = Math.floor(cxz - hw - BAND), xR = Math.ceil(cxz + hw + BAND);
      minL = Math.min(minL, cxz - hw - BAND); maxR = Math.max(maxR, cxz + hw + BAND);
      for (let x = xL; x <= xR; x++) {
        const d = Math.abs(x + 0.5 - cxz) - hw;
        if (d <= 0.2) continue; // 강
        const h = this.bankHeight(d, x, z);
        const topHex = T.grassTop[Math.floor(G.hash2(x, z, s + 1) * T.grassTop.length)];
        for (let y = 0; y < h; y++) {
          const isTop = y === h - 1;
          inst.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, color: isTop ? topHex : T.dirt, dim: isTop ? 1 : 0.92 });
          if (h <= 2 && y === 0 && h === 1) break;
        }
        if (z === z0 || z === z1 - 1) continue;
      }
    }
    if (inst.length) {
      const im = new THREE.InstancedMesh(BOX, new THREE.MeshLambertMaterial({ color: 0xffffff }), inst.length);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < inst.length; i++) {
        m4.makeTranslation(inst[i].x, inst[i].y, inst[i].z);
        im.setMatrixAt(i, m4);
        c.setHex(inst[i].color).multiplyScalar(inst[i].dim);
        im.setColorAt(i, c);
      }
      im.instanceMatrix.needsUpdate = true;
      group.add(im);
    }

    // 2) 측면 원경 바닥 (블록 밴드 바깥)
    const sideMat = lambert(T.farGround);
    for (const side of [-1, 1]) {
      const inner = side < 0 ? minL : maxR;
      const sp = new THREE.Mesh(BOX, sideMat);
      const w = 130;
      sp.scale.set(w, 0.9, CHUNK);
      sp.position.set(inner + side * (w / 2 - 2), 0.52, z0 + CHUNK / 2);
      group.add(sp);
    }

    // 3) 장식
    for (const d of st.decos) {
      if (d.z < z0 || d.z >= z1) continue;
      const cxz = st.cx(d.z), hw = st.halfW(d.z);
      const x = cxz + d.side * (hw + d.dist);
      const gy = this.bankHeight(d.dist, Math.floor(x), Math.floor(d.z));
      this.addDeco(group, d.type, x, gy, d.z, anims);
    }

    // 4) 장애물
    for (const o of st.obstacles) {
      if (o.z < z0 || o.z >= z1) continue;
      this.addObstacle(group, o, anims);
    }

    // 5) 아이템
    for (const it of st.items) {
      if (it.z < z0 || it.z >= z1 || this.collected.has(it.id)) continue;
      const mesh = this.makeItem(it);
      group.add(mesh);
      it._mesh = mesh;
      anims.push((t) => {
        if (this.collected.has(it.id)) { mesh.visible = false; return; }
        mesh.position.y = 0.62 + Math.sin(t * 3 + it.id) * 0.13;
        mesh.rotation.y = t * 1.8 + it.id;
      });
    }

    // 6) 폭포 게이트
    for (const g of st.gates) {
      if (g.z < z0 || g.z >= z1) continue;
      this.addGate(group, g, anims);
    }

    // 7) 닭 이스터에그
    if (st.chicken && st.chicken.z >= z0 && st.chicken.z < z1 && !st.chicken.joined) {
      const ch = this.makeChicken();
      const pad = new THREE.Mesh(cyl(1.2, 0.14, 12), lambert(0x2e8b3a));
      pad.position.set(st.cx(st.chicken.z) + st.chicken.off, 0.07, st.chicken.z);
      ch.position.set(pad.position.x, 0.15, st.chicken.z);
      group.add(pad, ch);
      st.chicken._mesh = ch; st.chicken._pad = pad;
      anims.push((t) => {
        if (st.chicken.joined) { ch.visible = false; return; }
        ch.position.y = 0.15 + Math.abs(Math.sin(t * 4)) * 0.12;
        ch.rotation.y = Math.sin(t * 1.2) * 0.6;
      });
    }

    // 8) 결승 선착장
    if (st.finishZ >= z0 && st.finishZ < z1) this.addFinish(group, anims);

    const chunk = { group, anims };
    this.root.add(group);
    this.chunks.set(ci, chunk);
  }

  addDeco(group, type, x, gy, z, anims) {
    const T = this.theme;
    const leafHex = () => T.leaf[Math.floor(G.hash2(Math.floor(x * 3), Math.floor(z * 3), 77) * T.leaf.length)];
    if (type === 'tree' || type === 'spruce') {
      const trunk = new THREE.Mesh(BOX, lambert(T.trunk));
      const th = type === 'spruce' ? 3.4 : 2.6;
      trunk.scale.set(0.8, th, 0.8); trunk.position.set(x, gy + th / 2, z);
      group.add(trunk);
      if (type === 'spruce') {
        for (let i = 0; i < 3; i++) {
          const lf = new THREE.Mesh(BOX, lambert(leafHex()));
          const w = 3.2 - i * 0.9;
          lf.scale.set(w, 1.0, w); lf.position.set(x, gy + 2.0 + i * 1.0, z);
          group.add(lf);
        }
      } else {
        const lf = new THREE.Mesh(BOX, lambert(leafHex()));
        lf.scale.set(3.0, 2.4, 3.0); lf.position.set(x, gy + th + 0.9, z);
        group.add(lf);
      }
    } else if (type === 'house') {
      const wall = new THREE.Mesh(BOX, lambert(0xb08850));
      wall.scale.set(4.4, 2.6, 3.8); wall.position.set(x, gy + 1.3, z);
      const roof1 = new THREE.Mesh(BOX, lambert(0x77787c));
      roof1.scale.set(5.2, 0.8, 4.6); roof1.position.set(x, gy + 3.0, z);
      const roof2 = new THREE.Mesh(BOX, lambert(0x77787c));
      roof2.scale.set(3.4, 0.8, 3.0); roof2.position.set(x, gy + 3.8, z);
      const door = new THREE.Mesh(BOX, lambert(0x5e3d1e));
      door.scale.set(0.9, 1.6, 0.2); door.position.set(x, gy + 0.8, z + 1.95);
      group.add(wall, roof1, roof2, door);
    } else if (type === 'cactus') {
      const h = 1.6 + G.hash2(Math.floor(x), Math.floor(z), 3) * 1.6;
      const b = new THREE.Mesh(BOX, lambert(0x4e9c3c));
      b.scale.set(0.9, h, 0.9); b.position.set(x, gy + h / 2, z);
      group.add(b);
    } else if (type === 'deadbush') {
      const b = new THREE.Mesh(BOX, lambert(0x9a6b3a));
      b.scale.set(0.7, 0.7, 0.7); b.position.set(x, gy + 0.35, z);
      group.add(b);
    } else if (type === 'rockpile' || type === 'icerock') {
      const b = new THREE.Mesh(BOX, lambert(type === 'icerock' ? 0xcfe8f5 : 0x8a8f94));
      const s2 = 1 + G.hash2(Math.floor(x), Math.floor(z), 4) * 1.4;
      b.scale.set(s2, s2 * 0.8, s2); b.position.set(x, gy + s2 * 0.4, z);
      group.add(b);
    } else if (type === 'snowpile') {
      const b = new THREE.Mesh(BOX, lambert(0xffffff));
      b.scale.set(1.6, 0.6, 1.6); b.position.set(x, gy + 0.3, z);
      group.add(b);
    } else if (type === 'flower') {
      const colors = [0xe85a5a, 0xf0d04a, 0xd96fd9, 0xff9a3d];
      const b = new THREE.Mesh(BOX, lambert(colors[Math.floor(G.hash2(Math.floor(x), Math.floor(z), 5) * 4)]));
      b.scale.set(0.32, 0.5, 0.32); b.position.set(x, gy + 0.25, z);
      group.add(b);
    } else if (type === 'mushroom') {
      const stem = new THREE.Mesh(BOX, lambert(0xe8dcc8));
      stem.scale.set(0.3, 0.6, 0.3); stem.position.set(x, gy + 0.3, z);
      const cap = new THREE.Mesh(BOX, lambert(0xc84a3a, { emissive: 0x331008 }));
      cap.scale.set(0.8, 0.35, 0.8); cap.position.set(x, gy + 0.75, z);
      group.add(stem, cap);
    } else if (type === 'torch') {
      const pole = new THREE.Mesh(BOX, lambert(0x6b4a2a));
      pole.scale.set(0.22, 1.5, 0.22); pole.position.set(x, gy + 0.75, z);
      const fire = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xffb347 }));
      fire.scale.set(0.4, 0.45, 0.4); fire.position.set(x, gy + 1.65, z);
      group.add(pole, fire);
      anims.push((t) => { const f = 0.85 + Math.sin(t * 11 + x) * 0.18; fire.scale.set(0.4 * f, 0.45 * f, 0.4 * f); });
    }
  }

  addObstacle(group, o, anims) {
    const st = this.stage;
    const baseX = () => st.cx(o.z) + o.off;
    if (o.type === 'rock') {
      const m = new THREE.Mesh(BOX, lambert(0x8a8f94));
      m.scale.set(o.r * 1.7, o.r * 1.5, o.r * 1.5);
      m.position.set(baseX(), o.r * 0.45, o.z);
      m.rotation.y = o.z;
      const m2 = new THREE.Mesh(BOX, lambert(0x767b80));
      m2.scale.set(o.r, o.r, o.r);
      m2.position.set(baseX() + o.r * 0.3, o.r * 0.9, o.z + 0.2);
      group.add(m, m2);
    } else if (o.type === 'icefloe') {
      const m = new THREE.Mesh(BOX, lambert(0xd8eef8, { transparent: true, opacity: 0.95 }));
      m.scale.set(o.r * 2.3, 0.55, o.r * 1.9);
      m.position.set(baseX(), 0.12, o.z);
      m.rotation.y = o.z * 0.7;
      group.add(m);
    } else if (o.type === 'lily') {
      const pad = new THREE.Mesh(cyl(o.r, 0.13, 12), lambert(0x2e8b3a));
      pad.position.set(baseX(), 0.06, o.z);
      group.add(pad);
      if (G.hash2(Math.floor(o.z), 1, 9) > 0.6) {
        const fl = new THREE.Mesh(BOX, lambert(0xf0a8c8));
        fl.scale.set(0.4, 0.35, 0.4); fl.position.set(baseX(), 0.3, o.z);
        group.add(fl);
      }
    } else if (o.type === 'logwall') {
      const m = new THREE.Mesh(cyl(0.55, o.half * 2, 9), lambert(0x6e4a26));
      m.rotation.z = Math.PI / 2;
      m.position.set(baseX(), 0.3, o.z);
      group.add(m);
    } else if (o.type === 'icewall') {
      const m = new THREE.Mesh(BOX, lambert(0xbfe3f5, { transparent: true, opacity: 0.85 }));
      m.scale.set(o.half * 2, 1.8, 1.0);
      m.position.set(baseX(), 0.9, o.z);
      group.add(m);
    } else if (o.type === 'movelog') {
      const m = new THREE.Mesh(cyl(0.55, o.len, 9), lambert(0x5e3d1e));
      m.rotation.z = Math.PI / 2;
      m.position.set(baseX(), 0.3, o.z);
      group.add(m);
      anims.push((t) => {
        o._x = st.cx(o.z) + o.off + o.amp * Math.sin((Math.PI * 2 * t) / o.period + o.phase);
        m.position.x = o._x;
        m.rotation.x = t * 0.8;
      });
    } else if (o.type === 'pillar') {
      const m = new THREE.Mesh(BOX, lambert(0x9a9a9a));
      m.scale.set(1.5, 3.4, 1.5);
      m.position.set(baseX(), 1.4, o.z);
      const top = new THREE.Mesh(BOX, lambert(0x7f8a7f));
      top.scale.set(1.9, 0.5, 1.9); top.position.set(baseX(), 3.2, o.z);
      group.add(m, top);
    } else if (o.type === 'cactuswall') {
      const n = Math.max(2, Math.round((o.half * 2) / 1.1));
      for (let i = 0; i < n; i++) {
        const cx2 = baseX() - o.half + 0.55 + i * 1.1;
        const h = 1.4 + G.hash2(i, Math.floor(o.z), 6) * 1.2;
        const b = new THREE.Mesh(BOX, lambert(0x4e9c3c));
        b.scale.set(0.9, h, 0.9); b.position.set(cx2, h / 2 - 0.1, o.z);
        group.add(b);
      }
    } else if (o.type === 'sandbar') {
      const m = new THREE.Mesh(BOX, lambert(0xe7d6a3));
      m.scale.set(o.r * 2.1, 0.4, o.r * 1.7);
      m.position.set(baseX(), 0.02, o.z);
      m.rotation.y = o.z * 0.5;
      group.add(m);
    }
  }

  addGate(group, g, anims) {
    const st = this.stage;
    const cxz = st.cx(g.z), hw = st.halfW(g.z);
    const frameMat = lambert(0x6f7a85);
    for (const gx of [g.gapOff - g.gapHalf - 0.6, g.gapOff + g.gapHalf + 0.6]) {
      const p = new THREE.Mesh(BOX, frameMat);
      p.scale.set(1.2, 5, 1.2); p.position.set(cxz + gx, 2.5, g.z);
      group.add(p);
    }
    const lintel = new THREE.Mesh(BOX, frameMat);
    lintel.scale.set(hw * 2 + 2, 1.1, 1.4); lintel.position.set(cxz, 5.2, g.z);
    group.add(lintel);
    // 물 커튼 (통로 제외)
    const curtMat = new THREE.MeshLambertMaterial({ color: 0x9fd0f5, transparent: true, opacity: 0.65 });
    const segs = [[-hw, g.gapOff - g.gapHalf], [g.gapOff + g.gapHalf, hw]];
    const curts = [];
    for (const [x0, x1] of segs) {
      if (x1 - x0 < 0.4) continue;
      const cm = new THREE.Mesh(BOX, curtMat);
      cm.scale.set(x1 - x0, 4.6, 0.5);
      cm.position.set(cxz + (x0 + x1) / 2, 2.4, g.z);
      group.add(cm); curts.push(cm);
    }
    anims.push((t) => { curtMat.opacity = 0.55 + Math.sin(t * 9) * 0.12; });
  }

  addFinish(group, anims) {
    const st = this.stage, z = st.finishZ, cxz = st.cx(z), hw = st.halfW(z);
    const isHome = st.no === 50;
    // 선착장 (오른쪽 둔치에서 강 안으로)
    const plankMat = lambert(0xb08850);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(BOX, plankMat);
      p.scale.set(2.4, 0.3, 1.2);
      p.position.set(cxz + hw - i * 0.1, 0.45, z - 1.5 + i * 1.25);
      group.add(p);
    }
    // 결승 깃발 2개 (강 양쪽)
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(BOX, lambert(0x6b4a2a));
      pole.scale.set(0.3, 4.4, 0.3);
      pole.position.set(cxz + side * (hw + 0.8), 2.2, z);
      const flag = new THREE.Mesh(BOX, lambert(side < 0 ? 0xe84a4a : 0x4a90e8));
      flag.scale.set(1.6, 1.0, 0.15);
      flag.position.set(cxz + side * (hw + 0.8) + side * -0.95, 3.8, z);
      group.add(pole, flag);
      anims.push((t) => { flag.rotation.y = Math.sin(t * 3 + side) * 0.25; });
    }
    // 집 (스테이지 50은 크게, 그 외는 작은 오두막)
    const hx = cxz + hw + (isHome ? 7 : 5), hz = z + (isHome ? 4 : 2);
    const sc = isHome ? 1.8 : 1.0;
    const wall = new THREE.Mesh(BOX, lambert(0xc8a060));
    wall.scale.set(4.6 * sc, 2.8 * sc, 4.0 * sc); wall.position.set(hx, 1 + 1.4 * sc, hz);
    const roof1 = new THREE.Mesh(BOX, lambert(0x8a4a3a));
    roof1.scale.set(5.6 * sc, 0.9 * sc, 5.0 * sc); roof1.position.set(hx, 1 + 3.1 * sc, hz);
    const roof2 = new THREE.Mesh(BOX, lambert(0x8a4a3a));
    roof2.scale.set(3.6 * sc, 0.9 * sc, 3.2 * sc); roof2.position.set(hx, 1 + 4.0 * sc, hz);
    const door = new THREE.Mesh(BOX, lambert(0x5e3d1e));
    door.scale.set(1.0 * sc, 1.7 * sc, 0.2); door.position.set(hx - 2.31 * sc, 1 + 0.85 * sc, hz);
    door.rotation.y = Math.PI / 2;
    const win = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
    win.scale.set(0.15, 0.9 * sc, 0.9 * sc); win.position.set(hx - 2.31 * sc, 1 + 1.9 * sc, hz + 1.2 * sc);
    group.add(wall, roof1, roof2, door, win);
    if (isHome) {
      const sign = new THREE.Mesh(BOX, lambert(0xffd83d));
      sign.scale.set(2.6, 1.2, 0.2); sign.position.set(hx - 3.4, 4.4, hz - 2);
      group.add(sign);
    }
  }

  makeItem(it) {
    const g2 = new THREE.Group();
    if (it.kind === 'chur') {
      const body = new THREE.Mesh(cyl(0.16, 0.78, 8), lambert(0xf5e2c8));
      const cap = new THREE.Mesh(cyl(0.17, 0.2, 8), lambert(0xe84a4a));
      cap.position.y = 0.45;
      body.add(cap);
      body.rotation.z = 0.7;
      g2.add(body);
    } else {
      const body = new THREE.Mesh(BOX, lambert(0x58a8e8));
      body.scale.set(0.85, 0.5, 0.3);
      const tail = new THREE.Mesh(BOX, lambert(0x4a90c8));
      tail.scale.set(0.35, 0.4, 0.22); tail.position.x = -0.55;
      const eye = new THREE.Mesh(BOX, lambert(0x10243a));
      eye.scale.set(0.1, 0.1, 0.34); eye.position.set(0.26, 0.08, 0);
      g2.add(body, tail, eye);
    }
    g2.position.set(this.stage.cx(it.z) + it.off, 0.62, it.z);
    return g2;
  }

  makeChicken() {
    const ch = new THREE.Group();
    const body = new THREE.Mesh(BOX, lambert(0xf8f8f2));
    body.scale.set(0.75, 0.65, 0.95); body.position.y = 0.55;
    const head = new THREE.Mesh(BOX, lambert(0xf8f8f2));
    head.scale.set(0.45, 0.55, 0.45); head.position.set(0, 1.05, 0.42);
    const beak = new THREE.Mesh(BOX, lambert(0xf0b429));
    beak.scale.set(0.22, 0.16, 0.25); beak.position.set(0, 1.0, 0.74);
    const comb = new THREE.Mesh(BOX, lambert(0xe03e3e));
    comb.scale.set(0.16, 0.22, 0.3); comb.position.set(0, 1.38, 0.42);
    const wing1 = new THREE.Mesh(BOX, lambert(0xeeeee6));
    wing1.scale.set(0.12, 0.4, 0.6); wing1.position.set(0.43, 0.6, 0);
    const wing2 = wing1.clone(); wing2.position.x = -0.43;
    ch.add(body, head, beak, comb, wing1, wing2);
    return ch;
  }

  // ── 매 프레임 ──
  ensure(pz) {
    const ahead = this.theme.fogFar + 28;
    const c0 = Math.floor((pz - 26) / CHUNK), c1 = Math.floor((pz + ahead) / CHUNK);
    for (let ci = c0; ci <= c1; ci++) {
      if (ci < 0 || ci * CHUNK > this.stage.length + CHUNK) continue;
      if (!this.chunks.has(ci)) this.buildChunk(ci);
    }
    for (const [ci, ch] of this.chunks) {
      if (ci < c0 - 1 || ci > c1 + 1) {
        this.root.remove(ch.group);
        ch.group.traverse((m) => { if (m.isInstancedMesh) m.dispose(); });
        this.chunks.delete(ci);
      }
    }
  }

  update(t, dt, pz, px, blizzard) {
    this.ensure(pz);
    this.flowTime += dt;
    // 물: 평면은 카메라 추적, 텍스처는 월드 고정 + 하류 흐름
    this.water.position.set(px, 0, pz + 120);
    this.waterBed.position.set(px, -0.8, pz + 120);
    const rep = 360 / 64;
    this.waterTex.offset.y = ((pz + 120) / (360 / 64) - this.flowTime * 0.5) % 1;
    this.waterTex.offset.x = (px / (360 / 64)) % 1;

    for (const cl of this.clouds) {
      cl.position.x += cl.userData.speed * dt;
      if (cl.position.x > 90) cl.position.x = -90;
      const rz = cl.position.z;
      if (rz < pz - 40) cl.position.z += 220;
    }
    if (this.moon) this.moon.position.set(px - 40, 55, pz + 110);
    if (this.stars) this.stars.position.z = pz - 60;

    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      const night = this.theme.night;
      for (let i = 0; i < this.pData.length; i++) {
        const d = this.pData[i];
        let x = pos.getX(i), y = pos.getY(i), z2 = pos.getZ(i);
        if (night) {
          x += Math.sin(t * 0.7 + d.ph) * dt * 1.2;
          y += d.vy * dt + Math.sin(t * 1.3 + d.ph * 2) * dt * 0.4;
          if (y < 0.4) y = 0.4; if (y > 7) y = 7;
        } else {
          x += d.vx * dt; y += d.vy * dt * (blizzard ? 1.8 : 1);
          if (y < 0) { y = 22; x = px + (G.hash2(i, Math.floor(t * 10), 1) - 0.5) * 80; z2 = pz + G.hash2(i, 3, 2) * 90 - 15; }
        }
        if (z2 < pz - 20) z2 += 105;
        pos.setXYZ(i, x, y, z2);
      }
      pos.needsUpdate = true;
      if (!night) this.particles.material.opacity = blizzard ? 1.0 : 0.75;
    }
    // 눈보라: 안개 강화
    if (this.stage.params.blizzard) {
      const base = this.theme.fogFar;
      this.scene.fog.far += ((blizzard ? base * 0.42 : base) - this.scene.fog.far) * Math.min(1, dt * 2);
    }

    for (const ch of this.chunks.values()) for (const fn of ch.anims) fn(t, dt);
  }

  setCollected(id) { this.collected.add(id); }

  dispose() {
    for (const ch of this.chunks.values()) {
      this.root.remove(ch.group);
      ch.group.traverse((m) => { if (m.isInstancedMesh) m.dispose(); });
    }
    this.chunks.clear();
    this.scene.remove(this.root);
    this.waterTex.dispose();
  }
};
