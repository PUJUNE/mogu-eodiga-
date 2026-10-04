// render3d.js — THREE.js 옥상 코트 (참고 영상의 블록아웃 장면: 하늘색 페인트 코트 · 펜스 · 둘러싼 건물 · 동그란 나무)
// 축 대응: THREE x = 코트 x, THREE y = 높이 z, THREE z = 코트 y (베이스라인 0 → 하프라인 11)
const M = window.MBK;
const THREE = window.THREE;
const H = M.HOOP;

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
// 랜덤이 화면마다 달라지지 않게 고정 시드
let seed = 7;
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
  renderer: null, scene: null, camera: null, overlay: null,
  chars: [], ball: null, ballShadow: null, arcLine: null, net: null, netSway: 0,
  cam: { pos: null, look: null, cine: 0, cineKind: null, shake: 0 },
  t: 0, faceImg: null,

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    // 휴대폰은 해상도·그림자를 낮춰 프레임을 지킨다
    const phone = window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.scene.background = canvasTex(4, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#5aa8f0'); gr.addColorStop(0.55, '#a9d6ff'); gr.addColorStop(1, '#e8f4ff');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    this.scene.fog = new THREE.Fog(0xcfe6ff, 40, 110);
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 300);
    this.cam.pos = new THREE.Vector3(0, 8, 19); this.cam.look = new THREE.Vector3(0, 1.4, 4.5);

    const hemi = new THREE.HemisphereLight(0xeaf4ff, 0x8a8478, 0.55); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 0.8);
    sun.position.set(-9, 18, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -6, near: 1, far: 50 });
    sun.target.position.set(0, 0, 5); this.scene.add(sun.target);
    this.scene.add(sun);

    this.buildCourt();
    this.buildHoop();
    this.buildSurroundings();
    this.buildBall();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },

  resize() {
    const cv = this.renderer.domElement;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1.3 ? 54 : 42;           // 세로·정사각 화면이면 넓게
    this.camera.updateProjectionMatrix();
  },

  // ── 코트: 옥상 콘크리트 + 칠이 벗겨진 하늘색 페인트 ──
  buildCourt() {
    const PX = 80, W = 18, L = 14;                       // 텍스처는 코트 바깥 여유까지 18×14m
    const ox = W / 2, oy = 1.0;                          // 코트 (0,0) 이 텍스처의 (ox, oy)
    const tex = canvasTex(W * PX, L * PX, (g) => {
      const X = (x) => (x + ox) * PX, Y = (y) => (y + oy) * PX;
      g.fillStyle = '#b9b0a2'; g.fillRect(0, 0, W * PX, L * PX);
      for (let i = 0; i < 900; i++) {                    // 얼룩
        g.fillStyle = `rgba(${150 + rnd() * 60},${140 + rnd() * 50},${120 + rnd() * 50},${0.08 + rnd() * 0.12})`;
        g.beginPath(); g.arc(rnd() * W * PX, rnd() * L * PX, 4 + rnd() * 26, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#c9c0b0'; g.fillRect(X(-7.5), Y(0), 15 * PX, 11 * PX);
      // 하늘색 페인트 — 페인트존, 하프라인 반원
      g.fillStyle = '#5f9cc4';
      g.fillRect(X(-M.KEY_W / 2), Y(0), M.KEY_W * PX, M.KEY_L * PX);
      g.beginPath(); g.arc(X(0), Y(M.KEY_L), 1.8 * PX, 0, Math.PI); g.fill();
      g.beginPath(); g.arc(X(0), Y(11), 1.8 * PX, Math.PI, Math.PI * 2); g.fill();
      // 벗겨진 자국
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(220,214,200,${0.25 + rnd() * 0.35})`;
        const x = X(-7.5) + rnd() * 15 * PX, y = Y(0) + rnd() * 11 * PX;
        g.beginPath(); g.ellipse(x, y, 4 + rnd() * 22, 2 + rnd() * 10, rnd() * 3, 0, Math.PI * 2); g.fill();
      }
      // 선
      g.strokeStyle = '#ffffff'; g.lineWidth = 0.06 * PX;
      g.strokeRect(X(-7.5), Y(0), 15 * PX, 11 * PX);
      g.strokeRect(X(-M.KEY_W / 2), Y(0), M.KEY_W * PX, M.KEY_L * PX);
      g.beginPath(); g.arc(X(0), Y(M.KEY_L), 1.8 * PX, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(X(0), Y(11), 1.8 * PX, Math.PI, Math.PI * 2); g.stroke();
      // 2점 라인
      g.lineWidth = 0.07 * PX;
      const yc = H.y + Math.sqrt(M.ARC_R * M.ARC_R - M.CORNER_X * M.CORNER_X);
      g.beginPath(); g.moveTo(X(-M.CORNER_X), Y(0)); g.lineTo(X(-M.CORNER_X), Y(yc)); g.stroke();
      g.beginPath(); g.moveTo(X(M.CORNER_X), Y(0)); g.lineTo(X(M.CORNER_X), Y(yc)); g.stroke();
      const a0 = Math.atan2(yc - H.y, -M.CORNER_X), a1 = Math.atan2(yc - H.y, M.CORNER_X);
      g.beginPath(); g.arc(X(H.x), Y(H.y), M.ARC_R * PX, a1, a0); g.stroke();
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), mat(0xffffff, 0.95, { map: tex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, L / 2 - oy);
    floor.receiveShadow = true;
    this.scene.add(floor);
    // 옥상 슬래브 (건물 위)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 6, L + 0.6), mat(0xb9b2a6));
    slab.position.set(0, -3.01, L / 2 - oy); slab.receiveShadow = true;
    this.scene.add(slab);
    // 클리어 안내용 2점 라인 덧그림 (공을 뺏었을 때 깜빡인다)
    const pts = [];
    const yc = H.y + Math.sqrt(M.ARC_R * M.ARC_R - M.CORNER_X * M.CORNER_X);
    pts.push(new THREE.Vector3(-M.CORNER_X, 0.02, 0), new THREE.Vector3(-M.CORNER_X, 0.02, yc));
    const a0 = Math.atan2(yc - H.y, -M.CORNER_X), a1 = Math.atan2(yc - H.y, M.CORNER_X);
    for (let i = 0; i <= 40; i++) { const a = a0 + (a1 - a0) * i / 40; pts.push(new THREE.Vector3(H.x + Math.cos(a) * M.ARC_R, 0.02, H.y + Math.sin(a) * M.ARC_R)); }
    pts.push(new THREE.Vector3(M.CORNER_X, 0.02, 0));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.arcLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd83d, transparent: true, opacity: 0 }));
    this.scene.add(this.arcLine);
  },

  buildHoop() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.9, 12), mat(0x3a5a7a, 0.5));
    pole.position.set(0, 1.95, -0.25); pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.45), mat(0x3a5a7a, 0.5));
    arm.position.set(0, 3.55, 0.47); arm.castShadow = true; g.add(arm);
    const boardTex = canvasTex(360, 210, (c, w, h) => {
      c.fillStyle = 'rgba(255,255,255,0.92)'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d6282e'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
      c.strokeRect(w / 2 - 60, h - 100, 120, 80);
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(M.BOARD_W, M.BOARD_Z1 - M.BOARD_Z0, 0.05),
      [mat(0xdddddd), mat(0xdddddd), mat(0xdddddd), mat(0xdddddd), mat(0xffffff, 0.4, { map: boardTex }), mat(0xffffff, 0.4)]);
    board.position.set(0, (M.BOARD_Z0 + M.BOARD_Z1) / 2, M.BOARD_Y - 0.025); board.castShadow = true; g.add(board);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(M.RIM_R, 0.018, 8, 32), mat(0xff6a1a, 0.4, { emissive: 0x401000 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(H.x, H.z, H.y); g.add(rim);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.16), mat(0xff6a1a));
    bracket.position.set(0, H.z, M.BOARD_Y + 0.08); g.add(bracket);
    // 그물 (선으로 만든 원뿔) — 득점하면 흔들린다
    const net = new THREE.Group();
    const segs = 12, lines = [];
    for (let i = 0; i < segs; i++) {
      const a = i / segs * Math.PI * 2, b = (i + 1.5) / segs * Math.PI * 2;
      lines.push(new THREE.Vector3(Math.cos(a) * M.RIM_R, 0, Math.sin(a) * M.RIM_R), new THREE.Vector3(Math.cos(b) * 0.13, -0.42, Math.sin(b) * 0.13));
      lines.push(new THREE.Vector3(Math.cos(a) * 0.18, -0.2, Math.sin(a) * 0.18), new THREE.Vector3(Math.cos(b) * 0.18, -0.2, Math.sin(b) * 0.18));
    }
    net.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0xffffff })));
    net.position.set(H.x, H.z, H.y);
    g.add(net); this.net = net;
    this.scene.add(g);
  },

  buildSurroundings() {
    // 펜스 (옆·뒤) — 철망 텍스처
    const meshTex = canvasTex(64, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(60,70,80,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    });
    meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping;
    const fenceH = 3.2;
    const fence = (len, x, z, rotY) => {
      const t = meshTex.clone(); t.needsUpdate = true; t.repeat.set(len * 3, fenceH * 3);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, fenceH), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set(x, fenceH / 2, z); m.rotation.y = rotY; this.scene.add(m);
      const postN = Math.ceil(len / 3);
      for (let i = 0; i <= postN; i++) {
        const u = -len / 2 + len * i / postN;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, fenceH, 6), mat(0x55606a, 0.6));
        p.position.set(x + Math.cos(rotY) * u, fenceH / 2, z - Math.sin(rotY) * u); p.castShadow = true; this.scene.add(p);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), mat(0x55606a, 0.6));
      rail.position.set(x, fenceH, z); rail.rotation.y = rotY; this.scene.add(rail);
    };
    fence(18, 0, -1.0, 0);
    fence(14, -9, 6, Math.PI / 2);
    fence(14, 9, 6, Math.PI / 2);
    // 둘러싼 건물 — 창문 텍스처 상자 (블록아웃 감성)
    const winTex = (base) => canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(70,100,130,.55)';
      for (let y = 10; y < h - 10; y += 26) for (let x = 10; x < w - 10; x += 28) g.fillRect(x, y, 16, 15);
    });
    const tones = ['#e8e6e0', '#d9dde3', '#cfd6dc', '#ece3d6', '#dfe4ea'];
    const texs = tones.map(winTex);
    const spots = [];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * 0.05 + (i / 26) * Math.PI * 1.1 + rnd() * 0.08;    // 골대 뒤와 양옆 (카메라 쪽은 비움)
      const r = 17 + rnd() * 16;
      spots.push([Math.cos(a + Math.PI) * r, Math.sin(a + Math.PI) * r * 0.8 + 3]);
    }
    for (let i = 0; i < 10; i++) spots.push([(-1 + 2 * rnd()) * 34, 26 + rnd() * 14]);
    for (const [x, z] of spots) {
      const w = 4 + rnd() * 6, d = 4 + rnd() * 6, h = 3 + rnd() * 16;
      const t = texs[Math.floor(rnd() * texs.length)].clone(); t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 5)));
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h + 6, d), mat(0xffffff, 0.9, { map: t }));
      b.position.set(x, (h + 6) / 2 - 6, z); b.castShadow = h < 9; b.receiveShadow = true;
      this.scene.add(b);
    }
    // 아래 거리 (건물 사이로 하늘이 비치지 않게)
    const street = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat(0x8d9096, 1));
    street.rotation.x = -Math.PI / 2; street.position.y = -6; this.scene.add(street);
    // 동그란 나무 (화분)
    const tree = (x, z, s) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 1.2 * s, 6), mat(0x7a5a3a));
      trunk.position.set(x, 0.6 * s, z); trunk.castShadow = true; this.scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.85 * s, 14, 10), mat(0x3f8f4a, 0.9, { flatShading: true }));
      crown.position.set(x, 1.55 * s, z); crown.castShadow = true; this.scene.add(crown);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * s, 0.38 * s, 0.4 * s, 10), mat(0xa9a196));
      pot.position.set(x, 0.2 * s, z); pot.castShadow = true; this.scene.add(pot);
    };
    tree(-8.6, -0.4, 1.1); tree(8.6, -0.4, 1.0); tree(-8.6, 12.2, 0.9); tree(8.7, 12.4, 1.2);
    for (let i = 0; i < 8; i++) tree(-30 + rnd() * 60, -14 - rnd() * 12, 2 + rnd() * 1.5);
  },

  buildBall() {
    const tex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#e8702a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2a1408'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      for (const x of [w / 4, w * 3 / 4]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.18, h * 0.5, 0, 0, Math.PI * 2); g.stroke();
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(M.BALL_R, 20, 14), mat(0xffffff, 0.7, { map: tex }));
    this.ball.castShadow = true;
    this.scene.add(this.ball);
  },

  // ── 선수 ──
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
    return { root, body, legs, arms, head, ring, s, phase: 0, lastX: 0, lastY: 0, dribble: 0 };
  },

  setPlayers(st, faceImg) {
    for (const c of this.chars) this.scene.remove(c.root);
    this.chars = st.pl.map((p) => this.makeChar(p.key, faceImg));
    this.chars[0].ring.material.color.set(0x3f8cff);
    this.chars[1].ring.material.color.set(0xff5a4a);
  },

  // ── 매 프레임 ──
  poseChar(c, p, st, dt, isHolder) {
    const s = c.s;
    c.root.position.set(p.x, p.z, p.y);
    c.root.rotation.y = Math.atan2(p.fx, p.fy);
    const moved = Math.hypot(p.x - c.lastX, p.y - c.lastY);
    c.lastX = p.x; c.lastY = p.y;
    c.phase += moved * 3.2;
    const run = Math.min(1, Math.hypot(p.vx, p.vy) / 4);
    const sw = Math.sin(c.phase) * 0.7 * run;
    let la = sw, ra = -sw, lArm = -sw * 0.6, rArm = sw * 0.6, tilt = run * 0.12, roll = 0, crouch = 0;
    if (isHolder && (p.state === 'idle' || p.state === 'run' || p.state === 'cross')) {
      rArm = -0.5 + Math.abs(Math.sin(c.dribble)) * 0.5; crouch = 0.06;
      if (p.state === 'cross') { roll = 0.35 * p.crossSide; lArm = -0.8; }
    }
    if (p.state === 'shoot' || p.state === 'hang') { lArm = -2.8; rArm = -2.9; tilt = -0.05; la = 0.1; ra = -0.1; }
    if (p.state === 'dunk') { lArm = -2.6; rArm = -3.0; tilt = 0.25; la = 0.6; ra = -0.3; }
    if (p.state === 'block') { lArm = -2.9; rArm = -2.9; la = 0.15; ra = -0.15; }
    if (p.state === 'reach') { rArm = -1.5; tilt = 0.35; }
    if (p.state === 'off') { rArm = -1.0; tilt = 0.25; roll = 0.2; }
    if (p.state === 'stumble') { tilt = -0.5; roll = 0.6; crouch = 0.35; lArm = -1.2; rArm = 0.4; la = -1.2; ra = -1.4; }
    if (!isHolder && st.ball.holder !== null && (p.state === 'idle' || p.state === 'run')) { lArm = -1.2; rArm = -1.2; crouch = 0.08; }   // 수비 자세
    c.legs[0].rotation.x = la; c.legs[1].rotation.x = ra;
    c.arms[0].rotation.x = lArm; c.arms[1].rotation.x = rArm;
    c.arms[0].rotation.z = -0.15; c.arms[1].rotation.z = 0.15;
    c.body.rotation.x = tilt; c.body.rotation.z = roll;
    c.body.position.y = -crouch * s;
  },

  draw(st, dt, ui) {
    this.t += dt;
    const b = st.ball;
    st.pl.forEach((p, i) => this.poseChar(this.chars[i], p, st, dt, b.holder === i));
    // 공 — 쥔 공은 드리블로 튄다
    let bx = b.x, by = b.y, bz = b.z;
    if (b.holder !== null) {
      const p = st.pl[b.holder], c = this.chars[b.holder];
      const dribbling = p.state === 'idle' || p.state === 'run' || p.state === 'cross' || p.state === 'off';
      if (dribbling && st.phase === 'live') {
        const prev = Math.sin(c.dribble);
        c.dribble += dt * (7 + Math.hypot(p.vx, p.vy) * 0.8);
        if (Math.sign(Math.sin(c.dribble)) !== Math.sign(prev) && ui && ui.onDribble) ui.onDribble();
        bz = M.BALL_R + Math.abs(Math.sin(c.dribble)) * 0.72 * c.s;
        if (p.state === 'cross') { bx += -p.fy * 0.35 * Math.sin(c.dribble * 0.5) * p.crossSide; }
      } else bz = b.z;
    }
    this.ball.position.set(bx, bz, by);
    this.ball.rotation.x += dt * (b.holder === null ? 8 : 4);
    // 그물
    this.netSway *= Math.pow(0.04, dt);
    this.net.scale.set(1 - this.netSway * 0.15, 1 + this.netSway * 0.35, 1 - this.netSway * 0.15);
    this.net.rotation.y += this.netSway * dt * 6;
    // 클리어 안내 2점 라인
    this.arcLine.material.opacity = st.phase === 'live' && !st.cleared ? 0.55 + Math.sin(this.t * 8) * 0.45 : 0;
    this.updateCamera(st, dt, bx, by, bz);
    this.renderer.render(this.scene, this.camera);
  },

  cinematic(kind, dur) { this.cam.cine = dur; this.cam.cineKind = kind; },

  updateCamera(st, dt, bx, by, bz) {
    const cp = this.cam.pos, cl = this.cam.look;
    let tp, tl;
    if (this.cam.cine > 0) {
      this.cam.cine -= dt;
      if (this.cam.cineKind === 'dunk') {                 // 림 아래 낮은 각도 (참고 영상의 마지막 장면)
        tp = new THREE.Vector3(2.4, 0.7, 4.6); tl = new THREE.Vector3(0, 2.9, 1.6);
      } else {                                            // 득점·블록 — 공 쪽으로 살짝 당긴다
        tp = new THREE.Vector3(bx * 0.6, 4.2, by + 7.5); tl = new THREE.Vector3(bx * 0.5, 2.2, by);
      }
    } else {
      // 중계 카메라 — 오른쪽 위 비스듬히 (두 선수가 한 줄로 겹치지 않게)
      const fx = bx * 0.4 + 3.2;
      const far = Math.max(14, by + 7.2);
      tp = new THREE.Vector3(fx, 9.6, far); tl = new THREE.Vector3(bx * 0.55, 0.9, Math.min(by, 8.5) * 0.42 + 1.1);
    }
    const k = 1 - Math.pow(this.cam.cine > 0 ? 0.0005 : 0.04, dt);
    cp.lerp(tp, k); cl.lerp(tl, k);
    this.camera.position.copy(cp);
    if (this.cam.shake > 0) { this.cam.shake -= dt; this.camera.position.x += (Math.random() - 0.5) * 0.12; this.camera.position.y += (Math.random() - 0.5) * 0.1; }
    this.camera.lookAt(cl);
  },

  // 3D 위치 → 화면 좌표 (슛 게이지·말풍선 자리)
  toScreen(x, y, z) {
    const v = new THREE.Vector3(x, z, y).project(this.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, on: v.z < 1 };
  },
};

M.R3 = R;
M.drawFace = drawFace;
