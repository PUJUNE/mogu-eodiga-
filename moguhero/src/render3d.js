// render3d.js — THREE.js 복셀 마을 · 던전 전장 · 캐릭터 · 전투 효과 (쿼터뷰 직교 카메라, 드래그로 회전)
// 축 대응: THREE x = 논리 x, THREE y = 높이, THREE z = 논리 y
// 발열을 줄이려고 정적 지형은 꼭짓점 색 하나의 메시로 합치고(그리기 호출 1번), 램버트 재질만 쓴다
const M = window.MHR;
const THREE = window.THREE;

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return t;
}
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra));

// ── 복셀 합치기: 상자 여러 개 → 꼭짓점 색 메시 하나 ──
const FACES = [
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]], [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]], [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];
class Vox {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; }
  // x,z 가운데 · y 바닥 · 크기 w h d · 색(살짝 흔들어 복셀 느낌)
  box(x, y, z, w, h, d, col, jit = 0.05) {
    const c = new THREE.Color(col);
    const k = 1 + (rnd() - 0.5) * 2 * jit;
    c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
    const hx = w / 2, hz = d / 2, cy = y + h / 2, hy = h / 2;
    for (const [nrm, vs] of FACES) {
      const base = this.p.length / 3;
      const shade = nrm[1] > 0 ? 1 : nrm[1] < 0 ? 0.6 : 0.86;
      for (const v of vs) {
        this.p.push(x + v[0] * hx, cy + v[1] * hy, z + v[2] * hz);
        this.n.push(nrm[0], nrm[1], nrm[2]);
        this.c.push(c.r * shade, c.g * shade, c.b * shade);
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return new THREE.Mesh(g, mat || new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
}

// ── 얼굴 그림 (모구는 사진, 나머지는 코드로 — 시리즈 공통 + 이번 몬스터) ──
function drawFace(kind, g, S) {
  const c = S / 2;
  const circle = (x, y, r, col) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); };
  const eye = (x, y, r, col = '#1a1410') => { circle(x, y, r, col); circle(x - r * 0.3, y - r * 0.35, r * 0.32, '#fff'); };
  const angry = (y = c - 30) => { g.strokeStyle = '#1a1410'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(c - 52, y - 10); g.lineTo(c - 16, y + 4); g.stroke(); g.beginPath(); g.moveTo(c + 52, y - 10); g.lineTo(c + 16, y + 4); g.stroke(); };
  const mouseHead = (fur, inner) => {
    circle(c - 70, c - 62, 46, fur); circle(c + 70, c - 62, 46, fur);
    circle(c - 70, c - 62, 30, inner); circle(c + 70, c - 62, 30, inner);
    circle(c, c + 8, 82, fur); circle(c, c + 40, 46, '#e6e2dc');
    eye(c - 30, c - 2, 11); eye(c + 30, c - 2, 11); circle(c, c + 30, 10, '#e88a9a');
    g.strokeStyle = '#555'; g.lineWidth = 2.5;
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(c + s * 20, c + 34); g.lineTo(c + s * 70, c + 26 + k * 12); g.stroke(); }
  };
  switch (kind) {
    case 'mouse': mouseHead('#9aa2ad', '#f0b8c4'); break;
    case 'sumo':
      mouseHead('#8f96a0', '#f0b8c4');
      circle(c - 46, c + 30, 20, 'rgba(240,140,150,.45)'); circle(c + 46, c + 30, 20, 'rgba(240,140,150,.45)');
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(c, c - 74, 22, 14, 0, 0, Math.PI * 2); g.fill(); g.fillRect(c - 6, c - 80, 12, 30);
      break;
    case 'ninja':
      mouseHead('#7e8692', '#f0b8c4');
      g.fillStyle = '#1e2026'; g.beginPath(); g.arc(c, c + 8, 84, Math.PI * 0.98, Math.PI * 2.02); g.fill();
      g.fillRect(c - 84, c + 12, 168, 66); g.beginPath(); g.arc(c, c + 70, 60, 0, Math.PI); g.fill();
      g.fillStyle = '#f2e6d8'; g.fillRect(c - 62, c - 16, 124, 30);
      eye(c - 30, c - 1, 10); eye(c + 30, c - 1, 10);
      g.fillStyle = '#d6282e'; g.fillRect(c - 84, c - 40, 168, 14);
      break;
    case 'chick':
      circle(c, c + 6, 86, '#ffe07a');
      for (const [x, r] of [[-20, 20], [6, 24], [30, 18]]) circle(c + x, c - 82, r, '#e8553c');
      g.fillStyle = '#d6282e'; g.fillRect(c - 86, c - 34, 172, 16);
      eye(c - 30, c, 11); eye(c + 30, c, 11);
      g.fillStyle = '#f08a3c'; g.beginPath(); g.moveTo(c - 18, c + 22); g.lineTo(c + 18, c + 22); g.lineTo(c, c + 46); g.fill();
      break;
    case 'crow': case 'scrow': {
      const sh = kind === 'scrow';
      circle(c, c + 6, 86, sh ? '#2a2038' : '#33333f');
      g.fillStyle = sh ? '#4a3a6a' : '#4a4a5a';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(c - 20 + i * 18, c - 76); g.lineTo(c - 6 + i * 18, c - 112); g.lineTo(c + 6 + i * 18, c - 74); g.fill(); }
      eye(c - 32, c - 6, 13, sh ? '#b48cff' : '#ffd83d'); eye(c + 32, c - 6, 13, sh ? '#b48cff' : '#ffd83d');
      circle(c - 32, c - 6, 6, '#111'); circle(c + 32, c - 6, 6, '#111');
      angry(c - 22);
      g.fillStyle = '#8a8f9a'; g.beginPath(); g.moveTo(c - 22, c + 16); g.lineTo(c + 22, c + 16); g.lineTo(c, c + 60); g.fill();
      break;
    }
    case 'kiwi':
      circle(c, c + 10, 86, '#9b6a42');
      for (let i = 0; i < 40; i++) circle(c - 70 + rnd() * 140, c - 60 + rnd() * 140, 3, 'rgba(70,40,20,.35)');
      eye(c + 26, c - 10, 10);
      g.strokeStyle = '#f0dcae'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(c + 30, c + 14); g.quadraticCurveTo(c + 70, c + 40, c + 96, c + 110); g.stroke();
      g.fillStyle = '#7a4bb8'; g.beginPath(); g.moveTo(c - 70, c - 60); g.lineTo(c, c - 128); g.lineTo(c + 50, c - 64); g.fill();   // 점술사 모자
      break;
    case 'shadow':
      g.fillStyle = '#1a1424';
      g.beginPath(); g.moveTo(c - 84, c - 10); g.lineTo(c - 70, c - 108); g.lineTo(c - 22, c - 70); g.fill();
      g.beginPath(); g.moveTo(c + 84, c - 10); g.lineTo(c + 70, c - 108); g.lineTo(c + 22, c - 70); g.fill();
      circle(c, c + 10, 86, '#1a1424');
      g.fillStyle = '#ffd83d';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(c + s * 34, c, 16, 11, s * -0.25, 0, Math.PI * 2); g.fill(); }
      circle(c - 34, c, 4.5, '#111'); circle(c + 34, c, 4.5, '#111');
      g.strokeStyle = '#b48cff'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(c - 20, c + 40); g.quadraticCurveTo(c, c + 52, c + 24, c + 36); g.stroke();
      break;
    case 'hairball':
      for (let i = 0; i < 60; i++) { const a = rnd() * Math.PI * 2, r = 70 + rnd() * 22; circle(c + Math.cos(a) * r * 0.9, c + 10 + Math.sin(a) * r * 0.9, 14, i % 2 ? '#b8b0a8' : '#9a928a'); }
      circle(c, c + 10, 76, '#c8c0b8');
      eye(c - 28, c + 4, 13); eye(c + 28, c + 4, 13); angry(c - 18);
      g.strokeStyle = '#3a3430'; g.lineWidth = 5; g.beginPath(); g.arc(c, c + 52, 16, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      break;
    case 'vacuum':
      g.fillStyle = '#8a96a8'; g.beginPath(); g.roundRect ? g.roundRect(c - 84, c - 64, 168, 148, 30) : g.rect(c - 84, c - 64, 168, 148); g.fill();
      g.fillStyle = '#2a3040'; g.fillRect(c - 60, c - 34, 120, 52);
      circle(c - 28, c - 8, 14, '#ff3a3a'); circle(c + 28, c - 8, 14, '#ff3a3a');
      g.fillStyle = '#3a4050'; g.fillRect(c - 50, c + 40, 100, 14);
      for (let i = 0; i < 5; i++) g.fillRect(c - 46 + i * 22, c + 60, 12, 20);
      g.strokeStyle = '#5a6070'; g.lineWidth = 10; g.beginPath(); g.moveTo(c + 70, c - 60); g.quadraticCurveTo(c + 120, c - 110, c + 60, c - 120); g.stroke();
      break;
    case 'cucumber':
      g.fillStyle = '#4a9a3a'; g.beginPath(); g.ellipse(c, c + 6, 62, 108, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 18; i++) circle(c - 44 + rnd() * 88, c - 80 + rnd() * 170, 4, '#2f6a24');
      g.fillStyle = '#9ad86a'; g.beginPath(); g.ellipse(c - 18, c - 40, 10, 40, 0.2, 0, Math.PI * 2); g.fill();
      eye(c - 22, c - 4, 12); eye(c + 22, c - 4, 12); angry(c - 22);
      g.strokeStyle = '#1a3a12'; g.lineWidth = 5; g.beginPath(); g.moveTo(c - 18, c + 36); g.lineTo(c + 18, c + 36); g.stroke();
      break;
    case 'drop':
      g.fillStyle = '#5ab0f0'; g.beginPath(); g.moveTo(c, c - 110); g.quadraticCurveTo(c + 86, c - 10, c + 70, c + 40);
      g.arc(c, c + 34, 72, 0.1, Math.PI - 0.1); g.quadraticCurveTo(c - 86, c - 10, c, c - 110); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(c - 34, c - 10, 12, 26, 0.4, 0, Math.PI * 2); g.fill();
      eye(c - 24, c + 24, 12); eye(c + 24, c + 24, 12); angry(c + 4);
      g.strokeStyle = '#1a3a6a'; g.lineWidth = 5; g.beginPath(); g.arc(c, c + 72, 14, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      break;
    case 'cone':
      g.fillStyle = 'rgba(230,240,250,.92)'; g.beginPath(); g.moveTo(c - 120, c - 70); g.lineTo(c + 120, c - 70); g.lineTo(c + 64, c + 60); g.lineTo(c - 64, c + 60); g.fill();
      g.strokeStyle = '#8ab0c0'; g.lineWidth = 6; g.stroke();
      circle(c, c + 6, 58, '#f4e8dc');
      eye(c - 22, c, 10); eye(c + 22, c, 10); angry(c - 18);
      g.fillStyle = '#e83a3a'; g.fillRect(c - 12, c - 66, 24, 8); g.fillRect(c - 4, c - 74, 8, 24);
      break;
    case 'dog':
      g.fillStyle = '#7a5030'; g.beginPath(); g.ellipse(c - 74, c - 10, 26, 54, 0.3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(c + 74, c - 10, 26, 54, -0.3, 0, Math.PI * 2); g.fill();
      circle(c, c, 80, '#a8784a'); circle(c, c + 38, 44, '#e8d0b0');
      eye(c - 30, c - 12, 11); eye(c + 30, c - 12, 11); angry(c - 32);
      circle(c, c + 20, 14, '#1a1410');
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(c - 18, c + 50); g.lineTo(c - 10, c + 64); g.lineTo(c - 2, c + 50); g.fill();
      g.fillStyle = '#3a3a3a'; g.fillRect(c - 50, c - 72, 100, 14);   // 깡패 두건
      break;
  }
}

// ── 캐릭터 (복셀 몸 + 얼굴 빌보드) ──
function makeFigure(o) {
  const s = o.scale || 1;
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bodyMat = lam(o.body), limbMat = lam(o.limb != null ? o.limb : o.body);
  const box = (w, h, d, m, parent, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), m); b.position.set(x * s, y * s, z * s); b.castShadow = true; parent.add(b); return b; };
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * 0.13 * s, 0.42 * s, 0); body.add(leg);
    box(0.16, 0.42, 0.18, limbMat, leg, 0, -0.21, 0); legs.push(leg);
  }
  const torso = box(0.46, 0.46, 0.3, bodyMat, body, 0, 0.64, 0);
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * 0.31 * s, 0.84 * s, 0); body.add(arm);
    box(0.13, 0.4, 0.14, limbMat, arm, 0, -0.18, 0); arms.push(arm);
  }
  let tail = null;
  if (o.tail) { tail = box(0.09, 0.09, 0.5, lam(o.tail), body, 0, 0.5, -0.32); tail.rotation.x = -0.6; }
  let weapon = null;
  if (o.weapon != null) {
    weapon = new THREE.Group(); weapon.position.set(0, -0.38 * s, 0.05 * s); arms[1].add(weapon);
    const wm = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.08 * s, 0.75 * s), lam(o.weapon)); wm.position.z = 0.3 * s; wm.castShadow = true; weapon.add(wm);
    weapon.userData.mat = wm.material;
  }
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.faceTex, transparent: true }));
  const hs = (o.headSize || 0.82) * s;
  head.scale.set(hs, hs * (o.faceAspect || 1), 1); head.position.y = 1.22 * s; body.add(head);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34 * s, 14), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
  return { root, body, legs, arms, head, torso, weapon, tail, s, phase: 0, mats: [bodyMat, limbMat] };
}
function faceTexture(kind, faceImg) {
  if (kind === 'photo') { const t = new THREE.Texture(faceImg); t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; return t; }
  return canvasTex(256, 256, (g, w) => drawFace(kind, g, w));
}
function labelSprite(text, sub, col = '#2a2a3a') {
  const t = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); (g.roundRect ? g.roundRect(8, 14, w - 16, h - 28, 26) : g.rect(8, 14, w - 16, h - 28)); g.fill();
    g.strokeStyle = col; g.lineWidth = 6; g.stroke();
    g.fillStyle = col; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text + (sub ? ' ' + sub : ''), w / 2, h / 2 + 2);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  sp.scale.set(2.6, 0.65, 1); sp.renderOrder = 5;
  return sp;
}

const R = {
  renderer: null, scene: null, camera: null, sun: null, hemi: null,
  village: null, arena: null, fxGroup: null,
  hero: null, npcs: {}, mobs: new Map(), faceImg: null,
  view: { angle: Math.PI * 0.25, zoom: 1, target: new THREE.Vector3() },
  t: 0, portal: null, glow: null, particles: [], slashes: [], rings: [], slamMeshes: [], moveMark: null,
  inBattle: false,

  init(canvas) {
    const phone = window.matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe0f4);
    this.camera = new THREE.OrthographicCamera(-10, 10, 6, -6, -50, 120);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a60, 0.75); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 0.75);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.fxGroup = new THREE.Group(); this.scene.add(this.fxGroup);
    this.buildVillage();
    this.buildFx();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const cv = this.renderer.domElement; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    this.aspect = w / h;
    this.applyZoom();
  },
  applyZoom() {
    const base = (this.aspect < 1.2 ? 9.5 : 7.2) / this.view.zoom;
    this.camera.left = -base * this.aspect; this.camera.right = base * this.aspect; this.camera.top = base; this.camera.bottom = -base;
    this.camera.updateProjectionMatrix();
  },
  rotate(dx) { this.view.angle += dx * 0.008; },
  zoomBy(f) { this.view.zoom = Math.max(0.6, Math.min(2.2, this.view.zoom * f)); this.applyZoom(); },

  // ════════ 마을 ════════
  buildVillage() {
    seed = 7;
    const v = new Vox(), glow = new Vox();
    const N = M.ISLAND;
    const B = M.BUILDINGS;
    const inB = (x, z, pad = 0.6) => Object.values(B).some((b) => Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.y) < b.d / 2 + pad);
    // 길: 광장(반경 4) + 문까지 돌길
    const path = new Set();
    const mark = (x, z) => path.add(Math.round(x) + ',' + Math.round(z));
    for (let x = -4; x <= 4; x++) for (let z = -4; z <= 4; z++) if (x * x + z * z <= 17) mark(x, z);
    for (const b of Object.values(B)) {
      const [dx, dz] = b.door, n = Math.ceil(Math.hypot(dx, dz));
      for (let i = 0; i <= n; i++) { mark(dx * i / n, dz * i / n); mark(dx * i / n + 0.5, dz * i / n); }
    }
    // 섬 윗면 타일 + 옆면 흙
    for (let x = -N; x < N; x++) for (let z = -N; z < N; z++) {
      const cx = x + 0.5, cz = z + 0.5, k = Math.round(cx - 0.5) + ',' + Math.round(cz - 0.5);
      const p = path.has(Math.round(cx) + ',' + Math.round(cz));
      const col = p ? ((x + z) & 1 ? 0xd8cfc0 : 0xcfc5b4) : ((x + z) & 1 ? 0x8cc870 : 0x7fbd64);
      v.box(cx, -0.25, cz, 1, 0.25, 1, col, 0.03);
    }
    v.box(0, -2.2, 0, N * 2, 1.95, N * 2, 0x8a6a48, 0);
    v.box(0, -3.2, 0, N * 2 - 2, 1.0, N * 2 - 2, 0x6a5038, 0);
    // 분수 (광장 가운데)
    v.box(0, 0, 0, 2.4, 0.4, 2.4, 0xb0b0b8); v.box(0, 0.4, 0, 0.5, 0.9, 0.5, 0xc0c0c8); v.box(0, 1.3, 0, 1.0, 0.2, 1.0, 0xb0b0b8);
    glow.box(0, 0.38, 0, 2.0, 0.06, 2.0, 0x6ac8f0, 0);
    // 건물
    for (const [key, b] of Object.entries(B)) {
      if (key === 'dungeon') { this.buildCave(v, glow, b); continue; }
      const H = key === 'tarot' ? 1.8 : 2.3;
      v.box(b.x, 0, b.y, b.w, 0.25, b.d, 0x9a9aa0);                                     // 주춧돌
      v.box(b.x, 0.25, b.y, b.w - 0.2, H, b.d - 0.2, key === 'tarot' ? 0x5a3a8a : 0xe8dcc4);
      // 계단식 지붕
      for (let i = 0; i < 4; i++) {
        const sh = 1 - i * 0.22;
        v.box(b.x, 0.25 + H + i * 0.32, b.y, (b.w + 0.3) * sh, 0.32, (b.d + 0.3) * sh, b.col);
      }
      if (key === 'home') v.box(b.x + 1.1, 0.25 + H + 0.6, b.y - 0.6, 0.45, 1.1, 0.45, 0x8a6a6a);   // 굴뚝
      // 문 (문 좌표 쪽 벽)
      const dx = b.door[0] - b.x, dz = b.door[1] - b.y;
      const alongX = Math.abs(dz) > Math.abs(dx);
      const fx = alongX ? b.x : b.x + Math.sign(dx) * (b.w / 2 - 0.08), fz = alongX ? b.y + Math.sign(dz) * (b.d / 2 - 0.08) : b.y;
      v.box(fx, 0.25, fz, alongX ? 0.9 : 0.12, 1.4, alongX ? 0.12 : 0.9, 0x6a4428);
      // 창문 두 개
      for (const s of [-1, 1]) {
        const wx = alongX ? fx + s * (b.w / 2 - 0.9) : fx, wz = alongX ? fz : fz + s * (b.d / 2 - 0.9);
        glow.box(wx, 1.0, wz, alongX ? 0.6 : 0.14, 0.6, alongX ? 0.14 : 0.6, 0xa8d8f0, 0);
      }
      // 차양 (가게)
      if (key === 'fish' || key === 'shop') for (let i = 0; i < 6; i++) v.box(fx + Math.sign(dx) * 0.5, 1.7, fz - 1.5 + i * 0.6, 0.9, 0.12, 0.6, i % 2 ? 0xffffff : b.col, 0);
      if (key === 'dojo') { v.box(b.x - 2.9, 0, b.y + 1.6, 0.25, 1.4, 0.25, 0x8a5a2a); v.box(b.x - 2.9, 1.3, b.y + 1.6, 0.6, 0.25, 0.3, 0x8a5a2a); }   // 나무 인형
      // 간판 (빌보드)
      const sp = labelSprite(b.icon, b.name, hex(b.col));
      sp.position.set(b.x, 0.25 + H + 1.9, b.y); this.scene.add(sp); b._label = sp;
    }
    // 나무 · 가로등 · 울타리 · 꽃 · 밭 · 보물상자
    let trees = 0;
    for (let i = 0; i < 400 && trees < 42; i++) {
      const x = (rnd() * 2 - 1) * (N - 1.2), z = (rnd() * 2 - 1) * (N - 1.2);
      if (inB(x, z, 1.2) || path.has(Math.round(x) + ',' + Math.round(z)) || Math.hypot(x, z) < 6) continue;
      if (Math.abs(x) < 2.5 || Math.abs(z) < 2.5) continue;
      const h = 0.8 + rnd() * 0.6;
      v.box(x, 0, z, 0.35, h, 0.35, 0x7a5030);
      v.box(x, h, z, 1.5, 1.2, 1.5, rnd() < 0.5 ? 0x5a9a48 : 0x4f8f40, 0.08);
      v.box(x, h + 1.2, z, 0.95, 0.6, 0.95, 0x6aaa52, 0.08);
      trees++;
    }
    for (const [x, z] of [[-4.5, 3.5], [4.5, 3.5], [-4.5, -3.5], [4.5, -3.5], [-2.2, 8], [2.2, 8], [-2, -7], [2, -7]]) {
      v.box(x, 0, z, 0.3, 0.2, 0.3, 0x3a3a40); v.box(x, 0.2, z, 0.16, 1.6, 0.16, 0x3a3a40);
      glow.box(x, 1.8, z, 0.34, 0.34, 0.34, 0xffd070, 0);
    }
    for (let i = 0; i < 70; i++) {
      const x = (rnd() * 2 - 1) * (N - 1), z = (rnd() * 2 - 1) * (N - 1);
      if (inB(x, z, 0.4) || path.has(Math.round(x) + ',' + Math.round(z))) continue;
      v.box(x, 0, z, 0.14, 0.16, 0.14, [0xffe04a, 0xff7aa8, 0xffffff, 0x8ab8ff][i % 4], 0);
    }
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { v.box(-12.5 + i * 0.7, 0, 9.5 + j * 1.2, 0.5, 0.25, 0.9, 0x6a4a2a, 0); v.box(-12.5 + i * 0.7, 0.25, 9.5 + j * 1.2, 0.3, 0.4, 0.3, 0x7ac84a); }
    for (let i = -N + 1; i < N - 1; i += 1.2) { v.box(i, 0, -N + 0.4, 0.15, 0.6, 0.15, 0xc8a878, 0); v.box(i, 0, N - 0.4, 0.15, 0.6, 0.15, 0xc8a878, 0); }
    v.box(-N + 0.4, 0.35, 0, 0.08, 0.1, N * 2 - 1, 0xc8a878, 0); v.box(N - 0.4, 0.35, 0, 0.08, 0.1, N * 2 - 1, 0xc8a878, 0);
    v.box(4.6, 0, -1.5, 1.0, 0.6, 0.7, 0x8a5a2a); v.box(4.6, 0.6, -1.5, 1.0, 0.25, 0.7, 0xc8902a);   // 보물상자
    glow.box(4.6, 0.55, -1.5, 0.2, 0.15, 0.72, 0xffe070, 0);
    // 마을 표지판
    const sign = labelSprite('🐱', '모구 마을', '#e8702a'); sign.position.set(-3, 2.4, 6.2); sign.scale.set(2.4, 0.6, 1); this.scene.add(sign);
    const mesh = v.mesh(); mesh.receiveShadow = true; mesh.castShadow = true;
    const glowMesh = glow.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.village = new THREE.Group(); this.village.add(mesh, glowMesh, sign);
    for (const b of Object.values(B)) if (b._label) this.village.add(b._label);
    if (this.portal) this.village.add(this.portal);
    this.scene.add(this.village);
    // 클릭한 곳 표시
    this.moveMark = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.36, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    this.moveMark.rotation.x = -Math.PI / 2; this.moveMark.position.y = 0.03; this.moveMark.visible = false; this.scene.add(this.moveMark);
  },
  buildCave(v, glow, b) {
    // 바위 아치 + 보라 소용돌이
    for (let i = 0; i < 14; i++) v.box(b.x + (rnd() - 0.5) * b.w * 1.2, 0, b.y + 0.4 + rnd() * 1.2, 0.8 + rnd() * 0.9, 0.6 + rnd() * 1.6, 0.8 + rnd() * 0.8, 0x6a6a74, 0.1);
    v.box(b.x - 1.5, 0, b.y - 0.3, 0.9, 2.6, 1.0, 0x5a5a66); v.box(b.x + 1.5, 0, b.y - 0.3, 0.9, 2.6, 1.0, 0x5a5a66);
    v.box(b.x, 2.6, b.y - 0.3, 4.0, 0.8, 1.1, 0x50505c);
    for (const s of [-1, 1]) { v.box(b.x + s * 2.4, 0, b.y - 1.3, 0.25, 1.4, 0.25, 0x3a3a40); glow.box(b.x + s * 2.4, 1.4, b.y - 1.3, 0.3, 0.4, 0.3, 0xff8a3a, 0); }
    const tex = canvasTex(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
      gr.addColorStop(0, '#f0d8ff'); gr.addColorStop(0.4, '#9a5aff'); gr.addColorStop(1, '#2a1048');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9 }));
    p.position.set(b.x, 1.3, b.y - 0.84); p.rotation.y = Math.PI; this.portal = p;
    const sp = labelSprite(b.icon, b.name, '#5a5a66'); sp.position.set(b.x, 4.2, b.y); b._label = sp;
  },

  // 마을 사람 · 주인공 만들기 (얼굴 사진이 들어오면 다시 부른다)
  setFace(img) { this.faceImg = img; this.makeHero(); this.makeNpcs(); },
  makeHero(weaponCol = 0x8a5a2a, armorCol = 0xfbfaf6) {
    if (this.hero) { this.scene.remove(this.hero.root); }
    this.hero = makeFigure({ body: armorCol, limb: 0xfbfaf6, tail: 0x5a4a40, faceTex: faceTexture('photo', this.faceImg), faceAspect: 221 / 256, headSize: 0.92, weapon: weaponCol });
    // 모구 무늬 (등의 회갈색 얼룩)
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.05), lam(0x8a7a6a)); patch.position.set(0.05, 0.72, -0.16); this.hero.body.add(patch);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 24), new THREE.MeshBasicMaterial({ color: 0x3f8cff, transparent: true, opacity: 0.75, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; this.hero.root.add(ring);
    this.scene.add(this.hero.root);
  },
  setGear(weaponCol, armorCol) {
    if (!this.hero) return;
    if (this.hero.weapon) this.hero.weapon.userData.mat.color.set(weaponCol);
    this.hero.mats[0].color.set(armorCol);
  },
  makeNpcs() {
    for (const n of Object.values(this.npcs)) this.village.remove(n.fig.root);
    this.npcs = {};
    for (const [key, N] of Object.entries(M.NPCS)) {
      const fig = makeFigure({ body: N.body, faceTex: faceTexture(N.face), headSize: 0.85, tail: null });
      let x, y;
      if (N.home) { const b = M.BUILDINGS[N.home]; x = b.door[0] + (b.door[0] > b.x ? 0.4 : b.door[0] < b.x ? -0.4 : 1.2); y = b.door[1] + (b.door[1] > b.y ? 0.6 : b.door[1] < b.y ? -0.6 : 0.9); }
      else { x = key === 'sumo' ? -2.5 : 3; y = key === 'sumo' ? 2.5 : -2.8; }
      const tag = labelSprite('', N.name, '#3a3a4a'); tag.scale.set(1.7, 0.42, 1); tag.position.y = 2.05; fig.root.add(tag);
      this.village.add(fig.root);
      this.npcs[key] = { fig, x, y, hx: x, hy: y, tx: x, ty: y, fx: 0, fy: 1, wait: 1 + rnd() * 3, wander: !!N.wander };
    }
  },
  npcNear(x, y, d = 1.6) {
    let best = null, bd = d;
    for (const [k, n] of Object.entries(this.npcs)) { const dd = Math.hypot(n.x - x, n.y - y); if (dd < bd) { bd = dd; best = k; } }
    return best;
  },

  // ════════ 던전 전장 ════════
  buildArena(spec) {
    if (this.arena) { this.scene.remove(this.arena); this.arena.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    seed = 100 + (spec.t * 10 | 0);
    const v = new Vox(), N = M.ARENA + 2;
    const g0 = new THREE.Color(spec.ground), g1 = g0.clone().multiplyScalar(0.92);
    for (let x = -N; x < N; x++) for (let z = -N; z < N; z++) v.box(x + 0.5, -0.25, z + 0.5, 1, 0.25, 1, (x + z) & 1 ? g0.getHex() : g1.getHex(), 0.03);
    v.box(0, -2.2, 0, N * 2, 1.95, N * 2, 0x6a5038, 0);
    // 테두리 소품 (나무·바위·기둥)
    for (let i = 0; i < 46; i++) {
      const side = i % 4, u = (rnd() * 2 - 1) * (N - 0.5), e = N - 0.6 - rnd() * 1.2;
      const [x, z] = side === 0 ? [u, -e] : side === 1 ? [u, e] : side === 2 ? [-e, u] : [e, u];
      const h = 0.6 + rnd() * 1.8;
      if (spec.kind === 'invasion' || spec.t < 1.5 || spec.t === 3) { v.box(x, 0, z, 0.35, h * 0.6, 0.35, 0x7a5030); v.box(x, h * 0.6, z, 1.3, 1.1, 1.3, spec.prop, 0.1); }
      else v.box(x, 0, z, 0.7 + rnd() * 0.8, h, 0.7 + rnd() * 0.8, spec.prop, 0.1);
    }
    // 바닥 무늬 (가운데 원)
    for (let a = 0; a < 24; a++) { const r = 5.2; v.box(Math.cos(a / 24 * Math.PI * 2) * r, -0.02, Math.sin(a / 24 * Math.PI * 2) * r, 0.5, 0.04, 0.5, g0.clone().multiplyScalar(0.8).getHex(), 0); }
    const mesh = v.mesh(); mesh.receiveShadow = true; mesh.castShadow = true;
    this.arena = new THREE.Group(); this.arena.add(mesh); this.scene.add(this.arena);
  },

  showVillage() {
    if (this.inBattle && this.view.vz) { this.view.zoom = this.view.vz; this.applyZoom(); }
    this.inBattle = false; this.village.visible = true; if (this.arena) this.arena.visible = false;
    for (const m of this.mobs.values()) this.scene.remove(m.root); this.mobs.clear();
    this.clearFx();
  },
  showBattle(b) {
    if (!this.inBattle) { this.view.vz = this.view.zoom; this.view.zoom = Math.max(this.view.zoom, 1.4); this.applyZoom(); }   // 전투는 가까이
    this.inBattle = true; this.buildArena(b.spec); this.village.visible = false; this.arena.visible = true;
    for (const m of this.mobs.values()) this.scene.remove(m.root); this.mobs.clear();
    this.clearFx(); this.moveMark.visible = false;
    this.view.target.set(b.hero.x, 0, b.hero.y);
  },

  makeMob(m) {
    const T = M.MOBS[m.type];
    const fig = makeFigure({ body: m.boss && m.face === 'shadow' ? 0x2a2038 : T.col, faceTex: faceTexture(m.face), headSize: 1.0, scale: m.size * 1.3, tail: m.face === 'shadow' ? 0x1a1424 : null });
    // 체력 막대 (빌보드)
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.07), new THREE.MeshBasicMaterial({ color: m.boss ? 0xb48cff : 0xe84a3a, depthTest: false }));
    fg.position.z = 0.001; bg.renderOrder = 6; fg.renderOrder = 7; bar.add(bg, fg);
    bar.position.y = 1.85 * fig.s + 0.2; bar.visible = !m.boss; fig.root.add(bar);
    const warn = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.0, depthWrite: false }));
    warn.rotation.x = -Math.PI / 2; warn.position.y = 0.04; warn.scale.setScalar(fig.s * 1.2); fig.root.add(warn);
    fig.bar = fg; fig.barG = bar; fig.warn = warn;
    this.scene.add(fig.root);
    return fig;
  },

  // ════════ 효과 ════════
  buildFx() {
    const pg = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    for (let i = 0; i < 60; i++) { const p = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); p.visible = false; this.fxGroup.add(p); this.particles.push({ m: p, life: 0 }); }
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.75, 24, 1, -1.1, 2.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      s.rotation.x = -Math.PI / 2; s.visible = false; this.fxGroup.add(s); this.slashes.push({ m: s, life: 0 });
    }
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0x9ae0ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      r.rotation.x = -Math.PI / 2; r.visible = false; this.fxGroup.add(r); this.rings.push({ m: r, life: 0 });
    }
  },
  clearFx() {
    for (const p of this.particles) { p.life = 0; p.m.visible = false; }
    for (const s of this.slashes) { s.life = 0; s.m.visible = false; }
    for (const r of this.rings) { r.life = 0; r.m.visible = false; }
    for (const s of this.slamMeshes) this.fxGroup.remove(s.g); this.slamMeshes = [];
  },
  burst(x, y, h, col, n = 8, spd = 3) {
    for (let k = 0; k < n; k++) {
      const p = this.particles.find((q) => q.life <= 0); if (!p) return;
      p.life = 0.5 + Math.random() * 0.3; p.m.visible = true; p.m.material.color.set(col); p.m.position.set(x, h, y);
      const a = Math.random() * Math.PI * 2, s = spd * (0.5 + Math.random());
      p.v = new THREE.Vector3(Math.cos(a) * s, 2 + Math.random() * 3, Math.sin(a) * s);
    }
  },
  slash(x, y, fx, fy, heavy) {
    const s = this.slashes.find((q) => q.life <= 0) || this.slashes[0];
    s.life = 0.18; s.m.visible = true; s.m.position.set(x, 0.7, y);
    s.m.rotation.z = Math.atan2(fy, fx); s.m.scale.setScalar(heavy ? 1.3 : 1);
    s.m.material.color.set(heavy ? 0xffe070 : 0xffffff);
  },
  ring(x, y, r, col) {
    const q = this.rings.find((k) => k.life <= 0) || this.rings[0];
    q.life = 0.45; q.max = r; q.m.visible = true; q.m.position.set(x, 0.08, y); q.m.material.color.set(col);
  },
  battleFx(b, evs) {
    const h = b.hero;
    for (const e of evs) {
      if (e.type === 'swing') this.slash(h.x + h.fx * 0.7, h.y + h.fy * 0.7, h.fx, h.fy, e.i === 2);
      else if (e.type === 'hit') this.burst(e.x, e.y, 0.8, e.crit ? 0xffd83d : 0xffffff, e.crit ? 10 : 5);
      else if (e.type === 'kill') this.burst(e.x, e.y, 0.6, e.boss ? 0xb48cff : 0xffb070, e.boss ? 40 : 14, e.boss ? 6 : 3.5);
      else if (e.type === 'skill') { this.ring(e.x, e.y, M.SKILL.r, 0x9ae0ff); this.burst(e.x, e.y, 0.4, 0x9ae0ff, 16, 5); }
      else if (e.type === 'hurt') this.burst(h.x, h.y, 0.9, 0xff4a3a, 6);
      else if (e.type === 'slam') { this.ring(e.x, e.y, M.BOSS_SLAM.r, 0xff6a3a); this.burst(e.x, e.y, 0.3, 0x8a7a6a, 18, 5); }
      else if (e.type === 'dash') this.burst(h.x, h.y, 0.3, 0xffffff, 6, 1.5);
    }
  },
  updateFx(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt; p.v.y -= 12 * dt; p.m.position.addScaledVector(p.v, dt);
      if (p.m.position.y < 0.05) { p.m.position.y = 0.05; p.v.y *= -0.3; p.v.x *= 0.7; p.v.z *= 0.7; }
      p.m.material.opacity = Math.min(1, p.life * 3); if (p.life <= 0) p.m.visible = false;
    }
    for (const s of this.slashes) { if (s.life <= 0) continue; s.life -= dt; s.m.material.opacity = Math.max(0, s.life / 0.18) * 0.85; if (s.life <= 0) s.m.visible = false; }
    for (const r of this.rings) {
      if (r.life <= 0) continue; r.life -= dt;
      const u = 1 - r.life / 0.45; r.m.scale.setScalar(0.2 + u * r.max); r.m.material.opacity = (1 - u) * 0.9; if (r.life <= 0) r.m.visible = false;
    }
  },

  // ════════ 매 프레임 ════════
  poseFigure(f, x, y, fx, fy, spd, dt, act) {
    f.root.position.set(x, 0, y);
    const target = Math.atan2(fx, fy);
    let d = target - f.root.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    f.root.rotation.y += d * Math.min(1, dt * 14);
    f.phase += spd * dt * 2.4;
    const run = Math.min(1, spd / 3.5), sw = Math.sin(f.phase) * 0.8 * run;
    f.legs[0].rotation.x = sw; f.legs[1].rotation.x = -sw;
    let la = -sw * 0.8, ra = sw * 0.8, tilt = run * 0.12, bob = Math.abs(Math.sin(f.phase)) * 0.06 * run;
    if (act) {
      if (act.kind === 'atk') { const u = Math.min(1, act.t / M.COMBO[act.i].t); ra = act.i === 2 ? -2.8 + u * 3.6 : -1.9 + u * 2.4; f.arms[1].rotation.z = act.i === 1 ? 0.9 - u * 1.4 : 0; tilt = 0.2; }
      else if (act.kind === 'skill') { f.body.rotation.y += dt * 30; ra = -1.6; la = -1.6; }
      else if (act.kind === 'windup') { ra = -2.6; la = -2.6; tilt = -0.25; }
      else if (act.kind === 'strike') { ra = 0.4; la = 0.4; tilt = 0.35; }
    } else { f.arms[1].rotation.z = 0; f.body.rotation.y *= 0.8; }
    f.arms[0].rotation.x = la; f.arms[1].rotation.x = ra;
    f.body.rotation.x = tilt; f.body.position.y = bob;
    if (f.tail) f.tail.rotation.y = Math.sin(this.t * 3) * 0.4;
  },
  setLight(hour) {
    // 시간에 따라 하늘·햇빛 색 (아침 맑음 → 저녁 노을 → 밤)
    const u = (hour - M.DAY_START) / (M.DAY_END - M.DAY_START);
    const day = new THREE.Color(0xbfe0f4), eve = new THREE.Color(0xf4b48a), night = new THREE.Color(0x2a3458);
    const sky = u < 0.62 ? day : u < 0.86 ? day.clone().lerp(eve, (u - 0.62) / 0.24) : eve.clone().lerp(night, Math.min(1, (u - 0.86) / 0.14));
    this.scene.background.copy(sky);
    this.sun.intensity = u < 0.86 ? 0.8 : 0.8 - (u - 0.86) * 3.5;
    this.sun.color.set(u < 0.62 ? 0xfff4e0 : 0xffc89a);
    this.hemi.intensity = 0.75 - Math.max(0, u - 0.8) * 1.2;
  },
  camTo(x, y, dt) {
    const k = 1 - Math.pow(0.004, dt);
    this.view.target.x += (x - this.view.target.x) * k; this.view.target.z += (y - this.view.target.z) * k;
    const a = this.view.angle, D = 24;
    this.camera.position.set(this.view.target.x + Math.sin(a) * D, 18, this.view.target.z + Math.cos(a) * D);
    this.camera.lookAt(this.view.target);
    this.sun.position.set(this.view.target.x + 8, 20, this.view.target.z + 6); this.sun.target.position.copy(this.view.target);
  },

  drawVillage(vs, dt, hour) {
    this.t += dt;
    this.setLight(hour);
    if (this.hero) this.poseFigure(this.hero, vs.x, vs.y, vs.fx, vs.fy, vs.spd, dt, null);
    for (const n of Object.values(this.npcs)) {
      // 돌아다니는 사람은 집 근처를 어슬렁, 가게 사람은 제자리에서 두리번
      n.wait -= dt;
      if (n.wander && n.wait <= 0) { n.tx = n.hx + (rnd() - 0.5) * 7; n.ty = n.hy + (rnd() - 0.5) * 7; [n.tx, n.ty] = M.Village.push(n.tx, n.ty); n.wait = 3 + rnd() * 4; }
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      let spd = 0;
      if (d > 0.1) { spd = 1.4; n.x += dx / d * spd * dt; n.y += dy / d * spd * dt; n.fx = dx / d; n.fy = dy / d; [n.x, n.y] = M.Village.push(n.x, n.y); }
      else if (vs && Math.hypot(vs.x - n.x, vs.y - n.y) < 3) { n.fx = vs.x - n.x; n.fy = vs.y - n.y; }
      this.poseFigure(n.fig, n.x, n.y, n.fx, n.fy, spd, dt, null);
    }
    if (this.portal) this.portal.material.opacity = 0.75 + Math.sin(this.t * 3) * 0.15;
    if (this.moveMark.visible) { this.moveMark.scale.setScalar(1 + Math.sin(this.t * 8) * 0.12); if (vs && Math.hypot(vs.x - this.moveMark.position.x, vs.y - this.moveMark.position.z) < 0.4) this.moveMark.visible = false; }
    this.updateFx(dt);
    this.camTo(vs.x, vs.y, dt);
    this.renderer.render(this.scene, this.camera);
  },
  // 타이틀 — 마을을 천천히 돈다
  drawTitle(dt) {
    this.t += dt; this.view.angle += dt * 0.08;
    this.setLight(10);
    for (const n of Object.values(this.npcs)) this.poseFigure(n.fig, n.x, n.y, n.fx, n.fy, 0, dt, null);
    if (this.hero) this.poseFigure(this.hero, 0.8, 1.8, 0.3, 1, 0, dt, null);
    this.camTo(0, 0, 1);
    this.renderer.render(this.scene, this.camera);
  },

  drawBattle(b, dt) {
    this.t += dt;
    this.setLight(b.spec.kind === 'invasion' ? 19.5 : 12);
    if (b.spec.kind !== 'invasion') { this.scene.background.set(b.spec.t >= 6 ? 0x2a2038 : 0x8ab0c8); }
    const h = b.hero;
    const act = h.act ? h.act : null;
    this.poseFigure(this.hero, h.x, h.y, h.fx, h.fy, Math.hypot(h.vx, h.vy), dt, act);
    this.hero.body.rotation.z = h.dash ? 0 : 0;
    this.hero.root.visible = !(h.iframe > 0 && !h.dash && Math.floor(this.t * 20) % 2);
    // 몬스터
    const seen = new Set();
    for (const m of b.mobs) {
      if (m.dead) continue;
      seen.add(m.id);
      let f = this.mobs.get(m.id);
      if (!f) { f = this.makeMob(m); this.mobs.set(m.id, f); }
      const a = m.state === 'windup' ? { kind: 'windup' } : m.st > M.MOB_CD * 0.8 ? { kind: 'strike' } : null;
      this.poseFigure(f, m.x, m.y, m.fx, m.fy, m.stun > 0 ? 0 : m.spd, dt, a);
      f.bar.scale.x = Math.max(0.001, m.hp / m.maxHp); f.bar.position.x = -(1 - f.bar.scale.x) * 0.44;
      f.barG.quaternion.copy(f.root.quaternion).invert().multiply(this.camera.quaternion);   // 몸이 돌아도 막대는 화면을 본다
      f.warn.material.opacity = m.state === 'windup' ? 0.85 : 0;
      for (const mt of f.mats) mt.emissive.setHex(m.flash > 0 ? 0xffffff : m.state === 'windup' ? 0x551010 : 0);
    }
    for (const [id, f] of this.mobs) if (!seen.has(id)) { this.scene.remove(f.root); this.mobs.delete(id); }
    // 보스 빨간 원
    for (const s of b.slams) {
      let sm = this.slamMeshes.find((q) => q.s === s);
      if (!sm) {
        const g = new THREE.Group();
        const fill = new THREE.Mesh(new THREE.CircleGeometry(s.r, 40), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.25, depthWrite: false }));
        const edge = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.12, s.r, 40), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.9, depthWrite: false }));
        fill.rotation.x = edge.rotation.x = -Math.PI / 2; g.add(fill, edge); g.position.set(s.x, 0.05, s.y);
        this.fxGroup.add(g); sm = { s, g, fill }; this.slamMeshes.push(sm);
      }
      const u = 1 - Math.max(0, s.t) / s.warn;
      sm.fill.scale.setScalar(Math.max(0.01, u)); sm.g.visible = !s.done;
    }
    this.slamMeshes = this.slamMeshes.filter((q) => { if (!b.slams.includes(q.s)) { this.fxGroup.remove(q.g); return false; } return true; });
    this.updateFx(dt);
    this.camTo(h.x, h.y, dt);
    this.renderer.render(this.scene, this.camera);
  },

  // 화면 좌표 → 땅 위 논리 좌표
  pickGround(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return null;
    return { x: p.x, y: p.z };
  },
  showMark(x, y) { this.moveMark.position.set(x, 0.03, y); this.moveMark.visible = true; },
  toScreen(x, y, h = 0) {
    const v = new THREE.Vector3(x, h, y).project(this.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
  },
};

M.R3 = R;
M.drawFace = drawFace;
