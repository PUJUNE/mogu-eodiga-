// render3d.js — THREE.js 실내 체육관 배드민턴 코트 (선수 모델·얼굴은 모구 1on1 농구와 같다)
// 축 대응: THREE x = 코트 x, THREE y = 높이 z, THREE z = 코트 y (네트 0, 내 코트 +, 상대 코트 −)
const M = window.MBD;
const THREE = window.THREE;

function mat(color, rough = 0.85, extra = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: 0 }, extra));
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ── 얼굴 그림 (모구는 사진, 나머지는 코드로) ──
function drawFace(kind, g, S) {
  const c = S / 2;
  const circle = (x, y, r, col) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); };
  const eye = (x, y, r, col = '#1a1410') => { circle(x, y, r, col); circle(x - r * 0.3, y - r * 0.35, r * 0.32, '#fff'); };
  const mouseHead = (fur, inner) => {
    circle(c - 70, c - 62, 46, fur); circle(c + 70, c - 62, 46, fur);
    circle(c - 70, c - 62, 30, inner); circle(c + 70, c - 62, 30, inner);
    circle(c, c + 8, 82, fur);
    circle(c, c + 40, 46, '#e6e2dc');
    eye(c - 30, c - 2, 11); eye(c + 30, c - 2, 11);
    circle(c, c + 30, 10, '#e88a9a');
    g.strokeStyle = '#555'; g.lineWidth = 2.5;
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(c + s * 20, c + 34); g.lineTo(c + s * 70, c + 26 + k * 12); g.stroke(); }
  };
  switch (kind) {
    case 'mouse': mouseHead('#9aa2ad', '#f0b8c4'); break;
    case 'sumo':
      mouseHead('#8f96a0', '#f0b8c4');
      circle(c - 46, c + 30, 20, 'rgba(240,140,150,.45)'); circle(c + 46, c + 30, 20, 'rgba(240,140,150,.45)');
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(c, c - 74, 22, 14, 0, 0, Math.PI * 2); g.fill();   // 상투
      g.fillRect(c - 6, c - 80, 12, 30);
      break;
    case 'ninja':
      mouseHead('#7e8692', '#f0b8c4');
      g.fillStyle = '#1e2026'; g.beginPath(); g.arc(c, c + 8, 84, Math.PI * 0.98, Math.PI * 2.02); g.fill();
      g.fillRect(c - 84, c + 12, 168, 66); g.beginPath(); g.arc(c, c + 70, 60, 0, Math.PI); g.fill();
      g.fillStyle = '#f2e6d8'; g.fillRect(c - 62, c - 16, 124, 30);
      eye(c - 30, c - 1, 10); eye(c + 30, c - 1, 10);
      g.fillStyle = '#d6282e'; g.fillRect(c - 84, c - 40, 168, 14);
      g.beginPath(); g.moveTo(c + 78, c - 36); g.lineTo(c + 122, c - 60); g.lineTo(c + 118, c - 44); g.lineTo(c + 124, c - 22); g.closePath(); g.fill();
      break;
    case 'chick':
      circle(c, c + 6, 86, '#ffe07a');
      g.fillStyle = '#e8553c'; for (const [x, r] of [[-20, 20], [6, 24], [30, 18]]) circle(c + x, c - 82, r, '#e8553c');
      g.fillStyle = '#d6282e'; g.fillRect(c - 86, c - 34, 172, 16);                         // 권법가 머리띠
      eye(c - 30, c, 11); eye(c + 30, c, 11);
      g.fillStyle = '#f08a3c'; g.beginPath(); g.moveTo(c - 18, c + 22); g.lineTo(c + 18, c + 22); g.lineTo(c, c + 46); g.fill();
      circle(c - 56, c + 30, 13, 'rgba(255,120,120,.5)'); circle(c + 56, c + 30, 13, 'rgba(255,120,120,.5)');
      break;
    case 'crow':
      circle(c, c + 6, 86, '#33333f');
      g.fillStyle = '#4a4a5a'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(c - 20 + i * 18, c - 76); g.lineTo(c - 6 + i * 18, c - 112); g.lineTo(c + 6 + i * 18, c - 74); g.fill(); }
      eye(c - 32, c - 6, 13, '#ffd83d'); eye(c + 32, c - 6, 13, '#ffd83d');
      circle(c - 32, c - 6, 6, '#111'); circle(c + 32, c - 6, 6, '#111');
      g.strokeStyle = '#111'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(c - 54, c - 32); g.lineTo(c - 14, c - 18); g.stroke();
      g.beginPath(); g.moveTo(c + 54, c - 32); g.lineTo(c + 14, c - 18); g.stroke();
      g.fillStyle = '#8a8f9a'; g.beginPath(); g.moveTo(c - 22, c + 16); g.lineTo(c + 22, c + 16); g.lineTo(c, c + 60); g.fill();
      break;
    case 'kiwi':
      circle(c, c + 10, 86, '#9b6a42');
      g.fillStyle = 'rgba(70,40,20,.35)';
      for (let i = 0; i < 40; i++) circle(c - 70 + rnd() * 140, c - 60 + rnd() * 140, 3, 'rgba(70,40,20,.35)');
      eye(c + 26, c - 10, 10);
      g.strokeStyle = '#f0dcae'; g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.moveTo(c + 30, c + 14); g.quadraticCurveTo(c + 70, c + 40, c + 96, c + 110); g.stroke();
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
  }
}


const R = {
  renderer: null, scene: null, camera: null,
  chars: [], shuttle: null, marker: null, trail: [], netMesh: null, netShake: 0,
  cam: { pos: null, look: null, shake: 0 },
  t: 0,

  init(canvas) {
    const phone = window.matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a3a52);
    this.scene.fog = new THREE.Fog(0x2a3a52, 30, 70);
    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 200);
    this.cam.pos = new THREE.Vector3(0, 6.2, 13.5); this.cam.look = new THREE.Vector3(0, 0.6, -1.5);

    this.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a5a48, 0.6));
    const top = new THREE.DirectionalLight(0xffffff, 0.75);
    top.position.set(3, 16, 6); top.castShadow = true;
    top.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
    Object.assign(top.shadow.camera, { left: -9, right: 9, top: 11, bottom: -11, near: 1, far: 40 });
    this.scene.add(top);

    this.buildGym();
    this.buildNet();
    this.buildShuttle();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const cv = this.renderer.domElement; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1.3 ? 56 : 43;
    this.camera.updateProjectionMatrix();
  },

  // ── 체육관: 나무 바닥 + 초록 코트 매트 + 벽·창·현수막·조명 ──
  buildGym() {
    const PX = 60, W = 10, L = 17;                              // 코트 매트 텍스처 (단식 라인만 굵게)
    const tex = canvasTex(W * PX, L * PX, (g) => {
      const X = (x) => (x + W / 2) * PX, Y = (y) => (y + L / 2) * PX;
      g.fillStyle = '#2f8a5a'; g.fillRect(0, 0, W * PX, L * PX);
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.03})`; g.fillRect(rnd() * W * PX, rnd() * L * PX, 2 + rnd() * 6, 2 + rnd() * 6); }
      g.strokeStyle = '#f4f4ee'; g.lineWidth = 0.05 * PX;
      const dw = 6.1 / 2, sw = M.SINGLE_W / 2, hl = M.HALF_L;
      g.strokeRect(X(-dw), Y(-hl), 6.1 * PX, hl * 2 * PX);           // 복식 바깥선 (가늘게 의미만)
      g.lineWidth = 0.07 * PX;
      g.beginPath(); g.moveTo(X(-sw), Y(-hl)); g.lineTo(X(-sw), Y(hl)); g.moveTo(X(sw), Y(-hl)); g.lineTo(X(sw), Y(hl)); g.stroke();   // 단식 사이드라인
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(X(-dw), Y(s * M.SHORT_LINE)); g.lineTo(X(dw), Y(s * M.SHORT_LINE)); g.stroke();   // 숏 서비스 라인
        g.beginPath(); g.moveTo(X(0), Y(s * M.SHORT_LINE)); g.lineTo(X(0), Y(s * hl)); g.stroke();                // 센터 라인
      }
      g.beginPath(); g.moveTo(X(-dw), Y(0)); g.lineTo(X(dw), Y(0)); g.stroke();
    });
    const mat1 = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat(0xffffff, 0.8, { map: tex }));
    mat1.rotation.x = -Math.PI / 2; mat1.position.y = 0.005; mat1.receiveShadow = true; this.scene.add(mat1);
    // 나무 바닥
    const wood = canvasTex(512, 512, (g, w, h) => {
      for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 * 64; x < w + 128; x += 128) {
        const v = 176 + rnd() * 18;
        g.fillStyle = `rgb(${v + 34},${v + 4},${v - 50})`; g.fillRect(x - 128, y, 127, 31);
      }
    });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), mat(0xffffff, 0.6, { map: wood }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    // 벽 (창문 줄) · 천장 보
    const wallTex = canvasTex(512, 256, (g, w, h) => {
      g.fillStyle = '#d9cfbf'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b8ad9c'; g.fillRect(0, h * 0.62, w, h * 0.38);
      g.fillStyle = '#9fc4e8';
      for (let x = 20; x < w; x += 64) g.fillRect(x, 20, 44, 70);
      g.fillStyle = '#e8702a'; g.fillRect(0, h * 0.6, w, 6);
    });
    wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(4, 1);
    const wall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 10), mat(0xffffff, 0.9, { map: wallTex })); m.position.set(x, 5, z); m.rotation.y = ry; this.scene.add(m); };
    wall(30, 0, -13, 0); wall(30, -11, 0, Math.PI / 2); wall(30, 11, 0, -Math.PI / 2);
    // 현수막
    const banner = (text, x, z, ry, col) => {
      const t = canvasTex(512, 96, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, 3.2, z); m.rotation.y = ry; this.scene.add(m);
    };
    banner('MOGU OPEN 🏸', 0, -12.95, 0, '#2f6fe0');
    banner('냥 체육관', -10.95, -3, Math.PI / 2, '#e8702a');
    banner('츄르 배 배드민턴', 10.95, -3, -Math.PI / 2, '#2f8a5a');
    // 천장 조명
    for (const x of [-4, 4]) for (const z of [-6, 0, 6]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff8e0 }));
      lamp.position.set(x, 9.5, z); this.scene.add(lamp);
    }
    // 관중석 벤치 (옆)
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45 + i * 0.45, 12), mat(0x5a6e8a, 0.8));
      bench.position.set(s * (6.6 + i * 0.8), (0.45 + i * 0.45) / 2, -1); bench.castShadow = true; bench.receiveShadow = true; this.scene.add(bench);
    }
  },

  buildNet() {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, M.NET_H + 0.03, 8), mat(0x3a3f48, 0.5));
      post.position.set(s * 3.1, (M.NET_H + 0.03) / 2, 0); post.castShadow = true; g.add(post);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.08, 12), mat(0x3a3f48, 0.5));
      base.position.set(s * 3.1, 0.04, 0); g.add(base);
    }
    const netTex = canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(20,20,24,.85)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); });
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.repeat.set(6.2 / 0.06, 0.76 / 0.06);
    const net = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 0.76), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    net.position.set(0, M.NET_H - 0.38, 0); g.add(net); this.netMesh = net;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.04, 0.02), mat(0xffffff, 0.6));
    tape.position.set(0, M.NET_H, 0); g.add(tape);
    this.scene.add(g);
  },

  buildShuttle() {
    const s = new THREE.Group();
    const cork = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(0xf4efe6, 0.6));
    s.add(cork);
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.075, 12, 1, true), mat(0xffffff, 0.5, { side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
    skirt.position.y = 0.045; skirt.rotation.x = Math.PI; s.add(skirt);
    s.scale.setScalar(1.6);                                     // 화면에서 보이게 조금 크게
    s.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    this.scene.add(s); this.shuttle = s;
    // 낙하 예상 지점 표시 (사람 쪽으로 오는 셔틀)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 24), new THREE.MeshBasicMaterial({ color: 0xffd83d, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; this.scene.add(ring); this.marker = ring;
    // 셔틀 그림자 점
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    dot.rotation.x = -Math.PI / 2; dot.position.y = 0.015; this.scene.add(dot); this.dot = dot;
    // 꼬리 (스매시가 빠르게 보이게)
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
      this.scene.add(p); this.trail.push(p);
    }
  },

  makeChar(key, faceImg) {
    const P = M.PLAYERS[key];
    const furCol = { photo: 0xfbfaf6, mouse: 0x9aa2ad, sumo: 0x8f96a0, ninja: 0x7e8692, chick: 0xffe07a, crow: 0x33333f, kiwi: 0x9b6a42, shadow: 0x2a2038 }[P.face];
    const fur = mat(furCol, 0.9);
    const jersey = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#' + P.jersey.toString(16).padStart(6, '0'); g.fillRect(0, 0, w, h);
      g.fillStyle = '#' + P.trim.toString(16).padStart(6, '0');
      g.fillRect(0, 0, w, 8);
      g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(P.num), w * 0.25, h * 0.58); g.fillText(String(P.num), w * 0.75, h * 0.58);
    });
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const s = P.h;
    const limb = (r, len, m) => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 8), m); c.position.y = -len / 2; c.castShadow = true; g.add(c); const e = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 8, 6), m); e.position.y = -len; e.castShadow = true; g.add(e); return g; };
    // 다리 + 운동화
    const legs = [];
    for (const side of [-1, 1]) {
      const leg = limb(0.075 * s, 0.62 * s, fur);
      leg.position.set(side * 0.12 * s, 0.72 * s, 0);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, 0.09 * s, 0.24 * s), mat(0xffffff, 0.6));
      shoe.position.set(0, -0.66 * s, 0.04); shoe.castShadow = true; leg.add(shoe);
      body.add(leg); legs.push(leg);
    }
    // 반바지 · 유니폼
    const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.27 * s, 0.24 * s, 12), mat(P.jersey, 0.8));
    shorts.position.y = 0.76 * s; shorts.castShadow = true; body.add(shorts);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.25 * s, 0.5 * s, 14), mat(0xffffff, 0.8, { map: jersey }));
    torso.position.y = 1.1 * s; torso.castShadow = true; body.add(torso);
    // 팔
    const arms = [];
    for (const side of [-1, 1]) {
      const arm = limb(0.06 * s, 0.5 * s, fur);
      arm.position.set(side * 0.29 * s, 1.3 * s, 0);
      body.add(arm); arms.push(arm);
    }
    // 라켓 (오른손) — 손잡이 + 테 + 줄
    const racket = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), mat(0x222222, 0.6));
    grip.position.y = -0.17; racket.add(grip);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 20), mat(0xe8402a, 0.4));
    frame.scale.set(1, 1.3, 1); frame.position.y = -0.48; racket.add(frame);
    const strings = new THREE.Mesh(new THREE.CircleGeometry(0.115, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    strings.scale.set(1, 1.3, 1); strings.position.y = -0.48; racket.add(strings);
    racket.position.y = -0.5 * s; racket.rotation.x = 0.15;
    arms[1].add(racket);
    // 고양이 꼬리
    if (P.face === 'photo' || P.face === 'shadow') {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.82 * s, -0.22), new THREE.Vector3(0, 0.95 * s, -0.5), new THREE.Vector3(0, 1.3 * s, -0.55)]);
      const tail = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.04, 6), mat(P.face === 'photo' ? 0x3a3230 : 0x1a1424));
      tail.castShadow = true; body.add(tail);
    }
    // 머리 = 빌보드 (사진/그림)
    let faceTex;
    if (P.face === 'photo') { faceTex = new THREE.Texture(faceImg); faceTex.encoding = THREE.sRGBEncoding; faceTex.needsUpdate = true; }
    else faceTex = canvasTex(256, 256, (g, w) => drawFace(P.face, g, w));
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTex, transparent: true }));
    const hs = 0.78 * s;
    head.scale.set(hs, P.face === 'photo' ? hs * 221 / 256 : hs, 1);
    head.position.y = 1.62 * s;
    body.add(head);
    // 발밑 표시 고리 (내 선수 파랑 / 상대 빨강)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; root.add(ring);
    this.scene.add(root);
    return { root, body, legs, arms, head, ring, s, phase: 0, lastX: 0, lastY: 0 };
  },

  setPlayers(st, faceImg) {
    for (const c of this.chars) this.scene.remove(c.root);
    this.chars = st.pl.map((p) => this.makeChar(p.key, faceImg));
    this.chars[0].ring.material.color.set(0x3f8cff);
    this.chars[1].ring.material.color.set(0xff5a4a);
  },


  // ── 매 프레임 ──
  poseChar(c, p, st) {
    const s = c.s;
    c.root.position.set(p.x, p.z, p.y);
    c.root.rotation.y = Math.atan2(p.fx, p.fy);
    const moved = Math.hypot(p.x - c.lastX, p.y - c.lastY);
    c.lastX = p.x; c.lastY = p.y;
    c.phase += moved * 3.4;
    const run = Math.min(1, Math.hypot(p.vx, p.vy) / 3.5);
    const sw = Math.sin(c.phase) * 0.7 * run;
    let la = sw, ra = -sw, lArm = -0.6, rArm = -1.1, rz = 0.5, tilt = 0.1 + run * 0.1, twist = 0;
    if (p.swing) {
      const u = Math.min(1, p.swing.t / M.SWING_T);
      if (p.swing.high || p.swing.kind === 'strong' && p.swing.high) {        // 오버헤드: 뒤로 젖혔다가 앞으로 내려친다
        rArm = -3.0 + u * 2.4; rz = 0.2; lArm = -2.4; tilt = -0.15 + u * 0.4; twist = 0.5 - u;
      } else {                                                                 // 언더·사이드: 아래에서 위로 걷어 올린다
        rArm = 0.3 - u * 2.0; rz = 0.9 - u * 0.4; tilt = 0.25; twist = -0.4 + u * 0.8;
      }
    }
    if (st.phase === 'serve' && st.sh.held === p.idx) { lArm = -1.3; rArm = -0.3; rz = 0.7; }
    c.legs[0].rotation.x = la; c.legs[1].rotation.x = ra;
    c.arms[0].rotation.x = lArm; c.arms[1].rotation.x = rArm;
    c.arms[0].rotation.z = -0.25; c.arms[1].rotation.z = rz;
    c.body.rotation.x = tilt; c.body.rotation.y = twist;
    c.body.position.y = -0.05 * s;
  },

  draw(st, dt) {
    this.t += dt;
    const b = st.sh;
    st.pl.forEach((p, i) => this.poseChar(this.chars[i], p, st));
    this.shuttle.position.set(b.x, b.z, b.y);
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    if (b.held === null && sp > 0.5) {                          // 코르크가 진행 방향 앞
      const dir = new THREE.Vector3(b.vx, b.vz, b.vy).normalize();
      this.shuttle.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    } else this.shuttle.quaternion.set(0, 0, 0, 1);
    this.dot.position.set(b.x, 0.015, b.y);
    this.dot.visible = b.z > 0.05;
    // 꼬리
    this.trail.unshift(this.trail.pop());
    this.trail[0].position.copy(this.shuttle.position);
    this.trail.forEach((p, i) => { p.material.opacity = b.held === null && sp > 12 ? (1 - i / 10) * 0.5 : 0; p.scale.setScalar(1 - i / 12); });
    // 낙하 예상 지점 — 내 코트로 오는 셔틀만
    const show = st.phase === 'rally' && b.held === null && b.last === 1 && b.landing && !b.netHit;
    this.marker.visible = !!show;
    if (show) {
      this.marker.position.set(b.landing.x, 0.02, b.landing.y);
      const inside = Math.abs(b.landing.x) <= M.SINGLE_W / 2 && Math.abs(b.landing.y) <= M.HALF_L && b.landing.y > 0;
      this.marker.material.color.set(inside ? 0xffd83d : 0xff6a5a);
      this.marker.scale.setScalar(1 + Math.sin(this.t * 10) * 0.08);
    }
    // 네트 흔들림
    this.netShake *= Math.pow(0.02, dt);
    this.netMesh.position.z = Math.sin(this.t * 40) * 0.04 * this.netShake;
    this.updateCamera(st, dt);
    this.renderer.render(this.scene, this.camera);
  },

  updateCamera(st, dt) {
    const me = st.pl[0];
    // 내 코트 뒤 위쪽 — 네트 너머 상대 코트까지 한눈에
    const tp = new THREE.Vector3(me.x * 0.3, 8.6, Math.max(13.2, me.y + 7.5));
    const tl = new THREE.Vector3(me.x * 0.2, 0.2, -0.6);
    const k = 1 - Math.pow(0.05, dt);
    this.cam.pos.lerp(tp, k); this.cam.look.lerp(tl, k);
    this.camera.position.copy(this.cam.pos);
    if (this.cam.shake > 0) { this.cam.shake -= dt; this.camera.position.x += (Math.random() - 0.5) * 0.1; this.camera.position.y += (Math.random() - 0.5) * 0.08; }
    this.camera.lookAt(this.cam.look);
  },

  toScreen(x, y, z) {
    const v = new THREE.Vector3(x, z, y).project(this.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
  },
};

M.R3 = R;
M.drawFace = drawFace;
