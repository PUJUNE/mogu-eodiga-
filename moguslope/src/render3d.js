// render3d.js — THREE.js 코스 · 주변 풍경 · 썰매 탄 모구 · 생선 · 뒤따르는 카메라
// 코스는 40m 조각으로 나눠 앞쪽만 만들고 지나간 조각은 버린다. 조각 하나 = 꼭짓점 색 메시 하나(그리기 호출 1번)
// 색은 적은 값 그대로 보이게 출력 색 공간 변환을 끈다. 발열을 줄이려고 그림자 지도를 쓰지 않고(발밑 동그란 그림자만), 램버트 재질과 안개로 먼 곳을 가린다
const M = window.MSL;
const THREE = window.THREE;
const Prof = M.Prof;

const CH = 40;            // 조각 길이 (m)
const AHEAD = 200, BEHIND = 30;

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rr = (a, b) => a + rnd() * (b - a);

// 구역 색
const ZC = {
  canal: { sky: 0xbfe4f6, fog: 0xf4e2ea, floor: 0x9ab4ae, water: 0x5aaed0, wallA: 0x9a968c, wallB: 0x86827a, rim: 0xd8d4ca, near: 0xa8a090, out: 0x8cbc6a, amb: 0xffb8d0 },
  tube:  { sky: 0x8fd4f6, fog: 0xc4ecfa, floor: 0x7adcf4, water: 0x9ae8fa, wallA: 0x2a8ae8, wallB: 0x5ab0f4, rim: 0xf6f6f6, near: 0xe4f2f4, out: 0x9ee0ee, amb: null },
  field: { sky: 0xf6dcaa, fog: 0xf6cc96, floor: 0xe88a2c, water: 0xd8761e, wallA: 0xd4a246, wallB: 0xb88a36, rim: 0x9a7a3a, near: 0xe0962e, out: 0xe6a03e, amb: 0xe8601e },
  snow:  { sky: 0xbcd4ea, fog: 0xdce8f4, floor: 0xe8f0f8, water: 0xd6e4f2, wallA: 0xc4d6ea, wallB: 0xb8cce4, rim: 0xffffff, near: 0xf4f8fc, out: 0xf2f6fa, amb: 0xffffff },
};

// ── 상자 · 사각형 여러 개 → 꼭짓점 색 메시 하나 ──
const FACES = [
  [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]], [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]],
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]], [[0, -1, 0], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];
const _c = new THREE.Color();
class Vox {
  constructor() { this.p = []; this.n = []; this.c = []; this.i = []; }
  // x,z 가운데 · y 바닥 · 크기 w h d · ry = y축 회전
  box(x, y, z, w, h, d, col, ry = 0, jit = 0.05) {
    _c.set(col);
    const k = 1 + (rnd() - 0.5) * 2 * jit, r = Math.min(1, _c.r * k), g = Math.min(1, _c.g * k), b = Math.min(1, _c.b * k);
    const hx = w / 2, hz = d / 2, cy = y + h / 2, hy = h / 2, cs = Math.cos(ry), sn = Math.sin(ry);
    for (const [nrm, vs] of FACES) {
      const base = this.p.length / 3;
      const shade = nrm[1] > 0 ? 1 : nrm[1] < 0 ? 0.6 : 0.86;
      const nx = nrm[0] * cs + nrm[2] * sn, nz = -nrm[0] * sn + nrm[2] * cs;
      for (const v of vs) {
        const lx = v[0] * hx, lz = v[2] * hz;
        this.p.push(x + lx * cs + lz * sn, cy + v[1] * hy, z - lx * sn + lz * cs);
        this.n.push(nx, nrm[1], nz);
        this.c.push(r * shade, g * shade, b * shade);
      }
      this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  quad(a, b, c, d, col, shade = 1) {
    _c.set(col);
    const base = this.p.length / 3;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c, d]) { this.p.push(p[0], p[1], p[2]); this.n.push(nx, ny, nz); this.c.push(_c.r * shade, _c.g * shade, _c.b * shade); }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);   // 양면
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}
const VMAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra));
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  return t;
}
function signSprite(text, col = '#c85a1a') {
  const t = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); (g.roundRect ? g.roundRect(6, 10, w - 12, h - 20, 30) : g.rect(6, 10, w - 12, h - 20)); g.fill();
    g.strokeStyle = col; g.lineWidth = 8; g.stroke();
    g.fillStyle = col; g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, fog: false }));
  sp.scale.set(6, 1.5, 1);
  return sp;
}

// ── 코스 좌표 도우미 ──
function W(T, s, u, z = 0) { return T.world(s, u, z); }
// 세계 좌표 위치에 진행 방향으로 돌린 상자 (lu 옆, lf 앞 = 진행 방향 기준 지역 좌표)
function boxAt(v, T, s, u, z, w, h, d, col, lu = 0, lf = 0, jit) {
  const f = T.frame(s), th = f.th;
  const [x, y, zz] = W(T, s, u, z);
  const R = [Math.cos(th), Math.sin(th)], F = [Math.sin(th), -Math.cos(th)];
  v.box(x + R[0] * lu + F[0] * lf, y, zz + R[1] * lu + F[1] * lf, w, h, d, col, -th, jit);
}

// ══ 장애물 모형 (상자 조합) ══
function obstModel(v, T, o) {
  const s = o.s, u = o.u;
  const B = (w, h, d, col, z = 0, lu = 0, lf = 0) => boxAt(v, T, s, u, z, w, h, d, col, lu, lf);
  switch (o.kind) {
    case 'rock': B(1.3, 0.7, 1.1, 0x8a8a90); B(0.9, 0.45, 0.8, 0x9c9ca4, 0.65, 0.1, -0.1); break;
    case 'crate': B(1.15, 1.15, 1.15, 0xb07a3a); B(1.2, 0.12, 1.2, 0x7a5020, 0.52); B(0.14, 1.16, 1.18, 0x7a5020); break;
    case 'cone': B(0.8, 0.12, 0.8, 0xf0601a); B(0.6, 0.3, 0.6, 0xf0701e, 0.12); B(0.48, 0.2, 0.48, 0xffffff, 0.42); B(0.36, 0.3, 0.36, 0xf0701e, 0.62); break;
    case 'duck': B(1.2, 0.8, 1.3, 0xffd83a); B(0.75, 0.7, 0.7, 0xffd83a, 0.75, 0, -0.3); B(0.4, 0.18, 0.4, 0xf08a1a, 1.0, 0, -0.75); B(0.12, 0.12, 0.05, 0x1a1a1a, 1.18, 0.2, -0.66); B(0.12, 0.12, 0.05, 0x1a1a1a, 1.18, -0.2, -0.66); break;
    case 'ball': B(1.2, 1.2, 1.2, 0xffffff); B(1.22, 1.22, 0.4, 0xe83a3a); B(0.4, 1.22, 1.22, 0x3a8ae8); B(1.0, 0.1, 1.0, 0xffd83a, 1.18); break;
    case 'hay': B(1.5, 1.35, 1.3, 0xe8c050); B(1.52, 0.12, 1.32, 0xc89a30, 0.4); B(1.52, 0.12, 1.32, 0xc89a30, 0.9); break;
    case 'pumpkin': B(1.2, 0.9, 1.1, 0xf07a1a); B(0.4, 0.92, 1.12, 0xd8661a); B(0.14, 0.3, 0.14, 0x3a7a2a, 0.9); break;
    case 'scarecrow': B(0.14, 2.0, 0.14, 0x7a5a30); B(1.6, 0.12, 0.12, 0x7a5a30, 1.35); B(0.7, 0.7, 0.35, 0x4a7ac8, 1.0); B(0.5, 0.45, 0.45, 0xf4e0a8, 1.7); B(0.9, 0.1, 0.9, 0xd8b050, 2.12); break;
    case 'snowman': B(1.1, 0.9, 1.1, 0xffffff); B(0.8, 0.7, 0.8, 0xffffff, 0.85); B(0.55, 0.5, 0.55, 0xffffff, 1.5); B(0.1, 0.1, 0.4, 0xf07a1a, 1.72, 0, -0.4); B(0.5, 0.35, 0.5, 0x2a2a2a, 1.98); B(0.9, 0.12, 0.9, 0xe83a3a, 1.45); break;
    case 'pine': B(0.3, 0.8, 0.3, 0x6a4a2a); B(1.5, 0.8, 1.5, 0x2e6a3e, 0.6); B(1.1, 0.7, 1.1, 0x35784a, 1.3); B(0.7, 0.7, 0.7, 0x3c8452, 1.9); B(0.5, 0.15, 0.5, 0xffffff, 2.6); break;
    default:
      if (o.low) {    // 너비 전체를 가로막는 낮은 장애물 — 단면을 따라 놓는다
        const p = T.frame(s).prof, half = Prof.half(p);
        const col = { log: 0x8a5a2a, noodle: 0xf05ab8, hayrow: 0xe8c050, mound: 0xffffff }[o.kind];
        const h = o.kind === 'noodle' ? 0.35 : 0.55;
        for (let x = -half + 0.25; x <= half - 0.2; x += 0.5) boxAt(v, T, s, x, -0.05, 0.52, h + 0.05, o.kind === 'mound' ? 1.2 : 0.7, col);
        if (o.kind === 'log') for (let x = -half + 0.25; x <= half; x += 1.5) boxAt(v, T, s, x, h - 0.02, 0.3, 0.06, 0.72, 0x6a4018);
      }
  }
}
// 움직이는 장애물 — 따로 움직이는 그룹
function moverModel(kind) {
  const g = new THREE.Group(), v = new Vox();
  const b = (x, y, z, w, h, d, col) => v.box(x, y, z, w, h, d, col);
  if (kind === 'tractor') {
    b(0, 0.6, 0, 1.4, 0.9, 2.4, 0x3aa84a); b(0, 1.5, 0.35, 1.2, 1.0, 1.1, 0x3aa84a); b(0, 1.6, 0.35, 1.24, 0.6, 0.9, 0xbfe4f6);
    b(0, 0.9, -1.0, 0.9, 0.5, 0.6, 0x2a8a3a); b(0.1, 1.4, -0.8, 0.12, 0.6, 0.12, 0x333333);
    for (const sx of [-1, 1]) { b(sx * 0.85, 0, 0.6, 0.35, 1.3, 1.3, 0x222222); b(sx * 0.8, 0.05, -0.85, 0.3, 0.8, 0.8, 0x222222); b(sx * 0.9, 0.45, 0.6, 0.06, 0.4, 0.4, 0xf0c030); }
  } else if (kind === 'bucket') {
    b(0, 0, 0, 1.5, 0.6, 1.5, 0xb8c4cc); b(0, 0.6, 0, 1.6, 0.1, 1.6, 0x98a4ac); b(0, 0.25, 0, 1.3, 0.38, 1.3, 0x7ab8d8);
  } else if (kind === 'ring') {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.3, 8, 16), lam(0xff7a2a)); m.rotation.x = Math.PI / 2; m.position.y = 0.3; g.add(m);
    const m2 = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.31, 8, 16, Math.PI / 3), lam(0xffffff)); m2.rotation.x = Math.PI / 2; m2.position.y = 0.3; g.add(m2);
  } else if (kind === 'snowball') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), lam(0xf4f8fc, { flatShading: true })); m.position.y = 1.0; g.add(m); g.userData.roll = m;
  }
  if (v.p.length) g.add(new THREE.Mesh(v.geo(), VMAT));
  return g;
}

// ══ 주변 풍경 ══
function tree(v, x, y, z, s = 1, canopy = 0xffb8d0, trunk = 0x7a5a3a) {
  v.box(x, y, z, 0.35 * s, 1.6 * s, 0.35 * s, trunk);
  v.box(x, y + 1.4 * s, z, 2.2 * s, 1.1 * s, 2.0 * s, canopy, 0, 0.08);
  v.box(x + 0.3 * s, y + 2.3 * s, z - 0.2 * s, 1.5 * s, 0.8 * s, 1.5 * s, canopy, 0, 0.1);
}
function pine(v, x, y, z, s = 1) {
  v.box(x, y, z, 0.3 * s, 0.8 * s, 0.3 * s, 0x6a4a2a);
  [[1.9, 0.9, 0.6], [1.4, 0.8, 1.35], [0.9, 0.8, 2.0]].forEach(([w, h, yy]) => { v.box(x, y + yy * s, z, w * s, h * s, w * s, 0x2e6a3e, 0, 0.08); v.box(x, y + (yy + h - 0.12) * s, z, w * 0.8 * s, 0.16 * s, w * 0.8 * s, 0xffffff); });
}
function house(v, x, y, z, ry, wall = 0xf2e6cc, roof = 0x4a4e5e) {
  const w = rr(4, 6), d = rr(4, 5.5), h = rr(2.6, 3.6);
  v.box(x, y, z, w, h, d, wall, ry);
  v.box(x, y + h, z, w + 0.6, 0.5, d + 0.6, roof, ry); v.box(x, y + h + 0.5, z, w * 0.7, 0.5, d + 0.6, roof, ry); v.box(x, y + h + 1.0, z, w * 0.35, 0.4, d + 0.6, roof, ry);
  v.box(x, y + 0.9, z, w * 0.3, 1.0, d + 0.05, 0x8ac4e0, ry);
}

function decor(v, T, run, s0, s1) {
  seed = 1 + Math.floor(s0) * 13;
  for (let s = s0; s < s1; s += 1) {
    const f = T.frame(s), z = f.zone, half = Prof.half(f.prof), rim = Prof.rim(f.prof);
    const P = (u, zz = 0) => W(T, s, Math.sign(u) * (half + Math.abs(u)), 0).map((c, i) => i === 1 ? f.y + rim + zz : c);
    const si = Math.round(s);
    if (z === 'canal') {
      // 왼쪽 철길 · 침목 · 전봇대, 양쪽 벚나무 · 집
      const rl = P(-5.5);
      v.box(rl[0], rl[1], rl[2], 2.6, 0.1, 0.3, 0x6a5a4a, -f.th);
      for (const o of [-0.7, 0.7]) { const q = W(T, s, -(half + 5.5) + o, 0); v.box(q[0], rl[1] + 0.1, q[2], 0.1, 0.12, 1.02, 0x8a8a92, -f.th, 0); }
      if (si % 15 === 0) { const q = P(-8); v.box(q[0], q[1], q[2], 0.25, 6, 0.25, 0x6a6a6a); v.box(q[0], q[1] + 5.4, q[2], 0.2, 0.15, 2.4, 0x6a6a6a, -f.th); }
      if (si % 7 === 0) { const q = P(rr(1.8, 3.2)); tree(v, q[0], q[1], q[2], rr(0.9, 1.3)); }
      if (si % 9 === 4) { const q = P(-rr(10, 13)); tree(v, q[0], q[1], q[2], rr(1, 1.4)); }
      if (si % 23 === 0) { const q = P(rr(7, 11)); house(v, q[0], q[1], q[2], -f.th); }
      if (si % 31 === 11) { const q = P(-rr(14, 18)); house(v, q[0], q[1], q[2], -f.th, 0xe8d8b8, 0x6a3a2a); }
      if (si % 12 === 6) { const q = P(1.0); v.box(q[0], q[1], q[2], 0.15, 1.8, 0.15, 0x3a3a3a); v.box(q[0], q[1] + 1.8, q[2], 0.4, 0.45, 0.4, 0xfff0c0); }
    } else if (z === 'tube') {
      // 알록달록 아치 · 야자수 · 파라솔
      if (si % 6 === 0) {
        const col = [0xff5a5a, 0xffd83a, 0x5ac85a, 0xffffff][(si / 6) % 4];
        const l = P(-0.4), r = P(0.4);
        v.box(l[0], l[1], l[2], 0.5, 3.2, 0.5, col); v.box(r[0], r[1], r[2], 0.5, 3.2, 0.5, col);
        const n = 8;
        for (let i = 0; i <= n; i++) { const u = -half - 0.4 + (2 * half + 0.8) * i / n; const q = W(T, s, u, 0); v.box(q[0], f.y + rim + 3.2, q[2], (2 * half + 0.8) / n + 0.1, 0.45, 0.5, col, -f.th); }
      }
      if (si % 11 === 3) { const q = P(rr(3, 8) * (rnd() < 0.5 ? -1 : 1)); v.box(q[0], q[1], q[2], 0.3, 3.4, 0.3, 0x9a7a4a); for (let a = 0; a < 4; a++) v.box(q[0], q[1] + 3.4, q[2], 2.4, 0.15, 0.5, 0x3aa84a, a * 0.8); }
      if (si % 17 === 8) { const q = P(rr(4, 9) * (rnd() < 0.5 ? -1 : 1)); v.box(q[0], q[1], q[2], 0.12, 2.2, 0.12, 0xffffff); v.box(q[0], q[1] + 2.1, q[2], 2.2, 0.25, 2.2, rnd() < 0.5 ? 0xff7a5a : 0x5ab4ff); }
    } else if (z === 'field') {
      // 울타리 · 단풍나무 · 빨간 헛간 · 풍차
      if (si % 3 === 0) for (const sd of [-1, 1]) { const q = P(sd * 0.6); v.box(q[0], q[1], q[2], 0.15, 1.0, 0.15, 0xf2e6cc); }
      for (const sd of [-1, 1]) { const q = P(sd * 0.6); v.box(q[0], q[1] + 0.7, q[2], 0.08, 0.1, 1.05, 0xf2e6cc, -f.th, 0); }
      if (si % 5 === 0) { const q = P(rr(2.5, 14) * (rnd() < 0.5 ? -1 : 1)); tree(v, q[0], q[1], q[2], rr(0.9, 1.4), [0xe8601e, 0xf0a020, 0xd8401a][Math.floor(rnd() * 3)]); }
      if (si % 47 === 20) { const sd = rnd() < 0.5 ? -1 : 1, q = P(sd * rr(9, 14)); v.box(q[0], q[1], q[2], 5, 3.5, 6, 0xc8382a, -f.th); v.box(q[0], q[1] + 3.5, q[2], 5.6, 0.6, 6.4, 0xf2e6cc, -f.th); v.box(q[0], q[1] + 4.1, q[2], 3.6, 0.8, 6.4, 0x8a2a20, -f.th); v.box(q[0], q[1], q[2], 1.8, 2.2, 6.05, 0xf2e6cc, -f.th); }
      if (si % 13 === 7) { const q = P(rr(3, 12) * (rnd() < 0.5 ? -1 : 1)); v.box(q[0], q[1], q[2], 1.3, 1.2, 1.3, 0xe8c050); }
      if (si % 97 === 50) { const q = P(-rr(16, 20)); v.box(q[0], q[1], q[2], 1.4, 9, 1.4, 0xd8cfc0); for (let a = 0; a < 4; a++) v.box(q[0], q[1] + 8.5, q[2] + 0.8, 0.5, 6, 0.15, 0xf2f2f2, 0); }
    } else {
      // 소나무 숲 · 바위 · 통나무집
      if (si % 3 === 0) { const q = P(rr(2, 16) * (rnd() < 0.5 ? -1 : 1)); pine(v, q[0], q[1], q[2], rr(1, 1.8)); }
      if (si % 11 === 5) { const q = P(rr(2, 6) * (rnd() < 0.5 ? -1 : 1)); v.box(q[0], q[1], q[2], 1.6, 0.9, 1.4, 0x8a8e98); v.box(q[0], q[1] + 0.85, q[2], 1.3, 0.2, 1.1, 0xffffff); }
      if (si % 61 === 30) { const q = P(rr(8, 13) * (rnd() < 0.5 ? -1 : 1)); house(v, q[0], q[1], q[2], -f.th, 0x8a5a32, 0xffffff); }
    }
  }
}

// 바닥 꼭짓점 색
function surfColor(zone, region, u, h, s, side) {
  const C = ZC[zone];
  switch (region) {
    case 'floor':
      if (zone === 'canal') return Math.abs(u) < 0.7 ? C.water : C.floor;
      if (zone === 'tube') return Math.floor(s / 3) % 2 ? C.floor : C.water;
      if (zone === 'field') return Math.floor(s / 2) % 2 ? C.floor : C.water;
      return Math.floor(s / 4) % 2 ? C.floor : C.water;
    case 'wall':
      if (zone === 'canal') return Math.floor(s / 2) % 2 ? C.wallA : C.wallB;
      if (zone === 'tube') return Math.floor(s / 4) % 2 ? C.wallA : C.wallB;
      return Math.floor(s / 3) % 2 ? C.wallA : C.wallB;
    case 'rim': return C.rim;
    case 'near': return zone === 'canal' && side < 0 ? 0x9a8e80 : C.near;
    default: return C.out;
  }
}

// ══ 조각 하나 ══
function buildChunk(T, run, k) {
  const s0 = k * CH, s1 = Math.min(T.len - 1, s0 + CH);
  const v = new Vox();
  // ── 바닥면 ──
  const cols = [];   // [영역, 매개변수]
  const NW = 6, NF = 4;
  cols.push(['out', -30], ['out', -12], ['near', -3], ['rim', -0.6]);
  for (let i = NW; i >= 1; i--) cols.push(['wall', -i / NW]);
  for (let i = 0; i <= NF; i++) cols.push(['floor', -1 + 2 * i / NF]);
  for (let i = 1; i <= NW; i++) cols.push(['wall', i / NW]);
  cols.push(['rim', 0.6], ['near', 3], ['out', 12], ['out', 30]);
  const rows = [];
  for (let s = s0; s <= s1 + 0.001; s += 1) {
    const f = T.frame(s), p = f.prof, half = Prof.half(p), rim = Prof.rim(p);
    const row = [];
    for (const [reg, a] of cols) {
      let u, h;
      if (reg === 'floor') { u = a * p.f; h = 0; }
      else if (reg === 'wall') { const ang = Math.abs(a) * p.tm; u = Math.sign(a) * (p.f + p.r * Math.sin(ang)); h = p.r - p.r * Math.cos(ang); }
      else { u = Math.sign(a) * (half + Math.abs(a)); h = rim + (reg === 'out' && f.zone === 'snow' ? Math.abs(a) * 0.08 : 0); }
      const pos = [f.x + Math.cos(f.th) * u, f.y + h, f.z + Math.sin(f.th) * u];
      _c.set(surfColor(f.zone, reg, u, h, s, Math.sign(a)));
      const j = 1 + (rnd() - 0.5) * 0.06;
      row.push([pos, _c.r * j, _c.g * j, _c.b * j]);
    }
    rows.push(row);
  }
  const base = v.p.length / 3, nc = cols.length, nr = rows.length;
  const P = (i, j) => rows[Math.max(0, Math.min(nr - 1, i))][Math.max(0, Math.min(nc - 1, j))][0];
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
    const [pos, r, g, b] = rows[i][j];
    // 법선 = 옆 방향 × 앞 방향
    const a1 = P(i, j + 1), a0 = P(i, j - 1), b1 = P(i + 1, j), b0 = P(i - 1, j);
    const ux = a1[0] - a0[0], uy = a1[1] - a0[1], uz = a1[2] - a0[2], fx = b1[0] - b0[0], fy = b1[1] - b0[1], fz = b1[2] - b0[2];
    let nx = uy * fz - uz * fy, ny = uz * fx - ux * fz, nz = ux * fy - uy * fx;
    const l = Math.hypot(nx, ny, nz) || 1;
    v.p.push(pos[0], pos[1], pos[2]); v.n.push(nx / l, ny / l, nz / l); v.c.push(r, g, b);
  }
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < nc - 1; j++) {
    const a = base + i * nc + j, b = a + 1, c = a + nc, d = c + 1;
    v.i.push(a, b, c, b, d, c);
  }
  // ── 풍경 ──
  decor(v, T, run, s0, s1);
  // ── 정지 장애물 · 도약대 · 발판 ──
  const movers = [];
  for (const o of run.obst) {
    if (o.s < s0 || o.s >= s0 + CH) continue;
    if (o.mv) movers.push(o); else obstModel(v, T, o);
  }
  for (const r of run.ramps) {
    if (r.s < s0 || r.s >= s0 + CH) continue;
    const zone = T.frame(r.s).zone;
    const col = { canal: 0x9aa0a8, tube: 0xff8a3a, field: 0xa8743a, snow: 0xbfe0f4 }[zone];
    const a = W(T, r.s, r.u - r.w / 2, 0.02), b = W(T, r.s, r.u + r.w / 2, 0.02);
    const c = W(T, r.s + r.len, r.u + r.w / 2, r.h), d = W(T, r.s + r.len, r.u - r.w / 2, r.h);
    const c0 = W(T, r.s + r.len, r.u + r.w / 2, 0), d0 = W(T, r.s + r.len, r.u - r.w / 2, 0);
    v.quad(a, b, c, d, col, 1);
    v.quad(b, c0, c, b, col, 0.75); v.quad(a, d, d0, a, col, 0.75); v.quad(d0, c0, c, d, col, 0.6);
    for (let i = 1; i < 4; i++) {    // 노란 줄무늬
      const t0 = i / 4 - 0.04, t1 = i / 4 + 0.04;
      v.quad(W(T, r.s + r.len * t0, r.u - r.w / 2, r.h * t0 + 0.04), W(T, r.s + r.len * t0, r.u + r.w / 2, r.h * t0 + 0.04), W(T, r.s + r.len * t1, r.u + r.w / 2, r.h * t1 + 0.04), W(T, r.s + r.len * t1, r.u - r.w / 2, r.h * t1 + 0.04), 0xffd83a);
    }
  }
  for (const pd of run.pads) {
    if (pd.s < s0 || pd.s >= s0 + CH) continue;
    v.quad(W(T, pd.s - 1.6, pd.u - 1.1, 0.03), W(T, pd.s - 1.6, pd.u + 1.1, 0.03), W(T, pd.s + 1.6, pd.u + 1.1, 0.03), W(T, pd.s + 1.6, pd.u - 1.1, 0.03), 0x3a3a8a);
    for (let i = 0; i < 3; i++) {
      const ss = pd.s - 1.2 + i * 1.0;
      v.quad(W(T, ss, pd.u - 0.9, 0.06), W(T, ss + 0.6, pd.u, 0.06), W(T, ss + 0.95, pd.u, 0.06), W(T, ss + 0.35, pd.u - 0.9, 0.06), 0xffd83a);
      v.quad(W(T, ss + 0.6, pd.u, 0.06), W(T, ss, pd.u + 0.9, 0.06), W(T, ss + 0.35, pd.u + 0.9, 0.06), W(T, ss + 0.95, pd.u, 0.06), 0xffd83a);
    }
  }
  // ── 구역 문 · 결승선 ──
  const gates = [];
  for (const z of run.zones) if (z.s0 >= s0 && z.s0 < s0 + CH) gates.push({ s: Math.max(z.s0, 14), zone: z.zone, kind: 'zone' });
  if (run.L >= s0 && run.L < s0 + CH) gates.push({ s: run.L, kind: 'finish' });
  const group = new THREE.Group();
  for (const gt of gates) {
    const f = T.frame(gt.s), half = Prof.half(f.prof) + 0.8, top = Prof.rim(f.prof) + 4.2;
    const fin = gt.kind === 'finish';
    for (const sd of [-1, 1]) boxAt(v, T, gt.s, sd * half, -0.2, 0.6, top - Prof.rim(f.prof) + 0.2, 0.6, fin ? 0xffffff : 0xe8702a);
    for (let x = -half; x <= half + 0.01; x += 0.8) {
      const fy = top - Prof.h(f.prof, x);
      boxAt(v, T, gt.s, x, fy, 0.82, 0.8, 0.4, fin ? ((Math.round((x + half) / 0.8)) % 2 ? 0x1a1a1a : 0xffffff) : 0xffd83a);
    }
    const Z = gt.kind === 'zone' ? M.ZONES[gt.zone] : null;
    const sp = signSprite(fin ? '🏁 결승' : Z.icon + ' ' + Z.name, fin ? '#2a2f45' : '#c85a1a');
    const [x, y, zz] = W(T, gt.s, 0, 0);
    sp.position.set(x, f.y + top + 1.6, zz); group.add(sp);
  }
  const mesh = new THREE.Mesh(v.geo(), VMAT);
  group.add(mesh);
  const mv = movers.map((o) => { const m = moverModel(o.kind); group.add(m); return { o, m }; });
  return { k, group, movers: mv };
}

// ══ 썰매 탄 모구 ══
function makeMogu(faceImg) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const v = new Vox();
  // 빨간 썰매 — 앞이 들린 판
  v.box(0, 0, 0.1, 1.0, 0.12, 1.5, 0xe8382a, 0, 0); v.box(0, 0.08, -0.72, 1.0, 0.3, 0.16, 0xe8382a, 0, 0);
  for (const sx of [-0.5, 0.5]) v.box(sx, 0.08, 0.05, 0.08, 0.18, 1.4, 0xc82a20, 0, 0);
  v.box(0, 0.1, 0.8, 0.9, 0.12, 0.1, 0xc82a20, 0, 0);
  // 몸 (흰 바탕 · 갈색 무늬) · 다리 앞으로 · 앞발로 썰매를 쥔다
  v.box(0, 0.12, 0.2, 0.62, 0.62, 0.55, 0xfbf8f2, 0, 0); v.box(0.18, 0.4, 0.42, 0.3, 0.3, 0.15, 0x8a6a4a, 0, 0); v.box(-0.2, 0.2, 0.02, 0.25, 0.25, 0.2, 0x2a2420, 0, 0);
  for (const sx of [-0.18, 0.18]) { v.box(sx, 0.12, -0.25, 0.17, 0.17, 0.5, 0xfbf8f2, 0, 0); v.box(sx * 2.2, 0.12, -0.15, 0.13, 0.4, 0.13, 0xfbf8f2, 0, 0); }
  v.box(0, 0.62, -0.02, 0.66, 0.12, 0.16, 0xe8382a, 0, 0);   // 목도리
  const sled = new THREE.Mesh(v.geo(), VMAT); body.add(sled);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.55), lam(0x5a4a40)); tail.position.set(0, 0.35, 0.6); tail.rotation.x = 0.7; body.add(tail);
  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.5), lam(0xe8382a)); scarf.position.set(0.22, 0.66, 0.38); body.add(scarf);
  const tex = new THREE.Texture(faceImg); tex.needsUpdate = true;
  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  head.scale.set(0.92, 0.92 * 221 / 256, 1); head.position.set(0, 1.12, 0.12); body.add(head);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  return { root, body, tail, scarf, head, shadow };
}

// 생선 · 하트 모형 (인스턴스로 한꺼번에)
function fishGeo() {
  const v = new Vox();
  v.box(0, -0.16, 0, 0.14, 0.32, 0.62, 0xffb43a, 0, 0); v.box(0, -0.1, 0.38, 0.1, 0.2, 0.16, 0xffb43a, 0, 0);
  v.box(0, -0.2, 0.5, 0.08, 0.4, 0.14, 0xf08a1a, 0, 0); v.box(0.075, 0.02, -0.18, 0.02, 0.07, 0.07, 0x1a1a1a, 0, 0); v.box(-0.075, 0.02, -0.18, 0.02, 0.07, 0.07, 0x1a1a1a, 0, 0);
  return v.geo();
}
function heartGeo() {
  const v = new Vox(), px = [[-2, 1], [-1, 2], [1, 2], [2, 1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, -1], [0, -1], [1, -1], [0, -2], [-1, 1], [0, 1], [1, 1]];
  for (const [x, y] of px) v.box(x * 0.15, y * 0.15, 0, 0.16, 0.16, 0.16, 0xff3a5a, 0, 0);
  return v.geo();
}

// ══ 본체 ══
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _ax = new THREE.Vector3(), _ay = new THREE.Vector3(), _az = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

const R = {
  renderer: null, scene: null, camera: null, chunks: new Map(), run: null, mogu: null, faceImg: null,
  fish: null, hearts: null, amb: null, spray: null, train: null,
  camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), shake: 0, zone: null, t: 0, flash: 0,

  init(canvas, faceImg) {
    const phone = window.matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.25 : 1.5));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(ZC.canal.sky);
    this.scene.fog = new THREE.Fog(ZC.canal.fog, 70, 190);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a70, 0.85));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.6); sun.position.set(0.4, 1, 0.3); this.scene.add(sun);
    this.faceImg = faceImg;
    this.mogu = makeMogu(faceImg); this.scene.add(this.mogu.root); this.scene.add(this.mogu.shadow);
    this.fish = new THREE.InstancedMesh(fishGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a3a00 }), 260);
    this.hearts = new THREE.InstancedMesh(heartGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a0010 }), 12);
    for (const im of [this.fish, this.hearts]) { im.count = 0; im.frustumCulled = false; this.scene.add(im); }
    // 떠다니는 꽃잎·눈·낙엽 + 썰매 물보라
    const pts = (n, size, col) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size, transparent: true, opacity: 0.9, depthWrite: false }));
      p.frustumCulled = false; this.scene.add(p); return p;
    };
    this.amb = pts(140, 0.22, 0xffb8d0); this.ambP = [];
    for (let i = 0; i < 140; i++) this.ambP.push([rr(-25, 25), rr(0, 18), rr(-40, 20), rr(0, 6.28)]);
    this.spray = pts(90, 0.11, 0xffffff); this.sprayP = [];
    this.train = this.makeTrain(); this.scene.add(this.train.g); this.train.g.visible = false;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },

  makeTrain() {
    const g = new THREE.Group(), v = new Vox();
    for (const z of [0, 7.4]) {
      v.box(0, 0.4, z, 2.6, 2.6, 7, 0x6aa87a, 0, 0); v.box(0, 1.9, z, 2.64, 0.8, 6.6, 0xbfe4f6, 0, 0); v.box(0, 0.4, z, 2.64, 0.6, 7.04, 0xf2e6cc, 0, 0);
      v.box(0, 3.0, z, 2.2, 0.3, 6.6, 0x8a8a8a, 0, 0);
    }
    v.box(0, 3.3, 0, 0.1, 1.0, 1.4, 0x3a3a3a, 0, 0);
    g.add(new THREE.Mesh(v.geo(), VMAT));
    return { g, s: 0 };
  },

  // 출발 로프: 분홍 기둥 둘 + 썰매 뒤를 감는 밧줄 세 토막
  makeLaunch(run) {
    const T = run.track, L = M.PHYS.launch, g = new THREE.Group(), tops = [];
    for (const sd of [-1, 1]) {
      const [x, y, z] = W(T, L.postS, sd * L.postU, 0);
      const post = new THREE.Group(); post.position.set(x, y, z); g.add(post);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.3, 12), lam(0xf4c8c8)); col.position.y = 0.65; post.add(col);
      for (const yy of [0.08, 1.32]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.16, 12), lam(0xfbe4e4)); cap.position.y = yy; post.add(cap); }
      for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), lam(i % 2 ? 0x3a6ae8 : 0xe83a5a)); const a = i / 8 * Math.PI * 2; b.position.set(Math.cos(a) * 0.3, 1.05, Math.sin(a) * 0.3); post.add(b); }
      tops.push(new THREE.Vector3(x, y + 1.05, z));
    }
    const ropes = [];
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), lam(0xd8b07a)); g.add(m); ropes.push(m); }
    return { g, tops, ropes, on: true };
  },
  ropeOff() { if (this.launch) { this.launch.on = false; this.launch.ropes.forEach((r) => { r.visible = false; }); } this.charge = 0; },
  seg(m, a, b) {
    _v.subVectors(b, a); const len = _v.length();
    m.position.addVectors(a, b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, _v.normalize()); m.scale.set(1, len, 1);
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const cv = this.renderer.domElement; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.baseFov = w < h ? 74 : 60;
    this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
  },

  setRun(run) {
    for (const c of this.chunks.values()) this.dropChunk(c);
    this.chunks.clear();
    this.run = run; this.zone = null; this.shake = 0; this.sprayP = [];
    this.train.s = run.s + 160;
    this.charge = 0;
    if (this.launch) { this.scene.remove(this.launch.g); this.launch = null; }
    this.launch = this.makeLaunch(run); this.scene.add(this.launch.g);
    this.update(run, 0, [], true);
  },
  dropChunk(c) {
    this.scene.remove(c.group);
    c.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); } });
  },

  // 몸의 좌표축: 오른쪽 · 위(벽 기울기만큼) · 뒤
  basis(T, s, u, air) {
    const f = T.frame(s), th = f.th, gr = f.gr;
    const b = air ? 0 : Prof.bank(f.prof, u);
    const F = _az.set(Math.sin(th), -Math.tan(gr), -Math.cos(th)).normalize();
    const Rt = _ax.set(Math.cos(th), 0, Math.sin(th));
    const Up = _ay.crossVectors(Rt, F).normalize();       // 경사면 위쪽
    // 벽 기울기: 진행 방향 축으로 −b 만큼 굴린다
    _q2.setFromAxisAngle(F, -b); Rt.applyQuaternion(_q2); Up.applyQuaternion(_q2);
    F.negate();
    _m.makeBasis(Rt, Up, F);
    return _q.setFromRotationMatrix(_m);
  },

  update(run, dt, evs, snap = false) {
    this.t += dt;
    const T = run.track;
    // ── 조각: 앞쪽은 만들고 지나간 것은 버린다 (한 프레임에 하나씩) ──
    const kMin = Math.max(0, Math.floor((run.s - BEHIND) / CH)), kMax = Math.floor((run.s + AHEAD) / CH);
    for (const [k, c] of this.chunks) if (k < kMin || k > kMax + 1) { this.dropChunk(c); this.chunks.delete(k); }
    let built = 0;
    for (let k = kMin; k <= kMax; k++) {
      if (this.chunks.has(k) || (k + 1) * CH > T.len - 2) continue;
      if (built++ >= (snap ? 99 : 1)) break;
      const c = buildChunk(T, run, k); this.chunks.set(k, c); this.scene.add(c.group);
    }
    // ── 구역 색 ──
    const fr = T.frame(run.s), zc = ZC[fr.zone];
    if (this.zone !== fr.zone) { this.zone = fr.zone; this.amb.material.color.set(zc.amb || 0xffffff); this.amb.visible = !!zc.amb; this.spray.material.color.set(fr.zone === 'field' ? 0xf0b060 : fr.zone === 'tube' ? 0xc8f0ff : 0xffffff); }
    const k = snap ? 1 : 1 - Math.exp(-dt * 1.5);
    this.scene.background.lerp(_c.set(zc.sky), k); this.scene.fog.color.lerp(_c.set(zc.fog), k);

    // ── 움직이는 장애물 ──
    for (const c of this.chunks.values()) for (const { o, m } of c.movers) {
      const u = M.Run.moverU(o, run.t), [x, y, z] = W(T, o.s, u, 0);
      m.position.set(x, y, z);
      const f = T.frame(o.s);
      m.rotation.set(0, -f.th + (o.kind === 'tractor' ? (Math.cos(o.mv.w * run.t + o.mv.ph) > 0 ? -Math.PI / 2 : Math.PI / 2) : 0), 0);
      if (m.userData.roll) m.userData.roll.rotation.z = -u * 1.2;
      if (o.kind === 'bucket' || o.kind === 'ring') m.position.y += Math.sin(run.t * 3 + o.s) * 0.06;
    }

    // ── 모구 ──
    const mg = this.mogu, [px, py, pz] = W(T, run.s, run.u, run.z);
    mg.root.position.set(px, py, pz);
    mg.root.quaternion.copy(this.basis(T, run.s, run.u, run.air));
    if (run.spin) { _q2.setFromAxisAngle(UP, -run.spin); mg.root.quaternion.multiply(_q2); }
    const lean = run.air ? 0 : -run.uv * 0.05;
    mg.body.rotation.set((run.air ? -0.15 : 0) + this.charge * 0.35, 0, run.phase === 'over' ? this.t * 9 : lean);
    mg.tail.rotation.x = 0.7 + Math.sin(this.t * 10) * 0.15 * Math.min(1, run.v / 10);
    mg.scarf.rotation.y = Math.sin(this.t * 14) * 0.25;
    mg.root.visible = !(run.invuln > 0 && Math.floor(run.invuln * 10) % 2 === 0) || run.phase !== 'run';
    const [sx, sy, sz] = W(T, run.s, run.u, 0);
    mg.shadow.position.set(sx, sy + 0.04, sz);
    const sc = Math.max(0.3, 1 - run.z * 0.12); mg.shadow.scale.set(sc, sc, sc); mg.shadow.material.opacity = 0.25 * sc;
    mg.shadow.rotation.set(-Math.PI / 2, 0, 0);

    // ── 출발 로프 ──
    if (this.launch) {
      if (this.launch.on) {
        const back = (sd) => new THREE.Vector3(...W(T, run.s + 0.85, sd * 0.45, 0.42));
        const l = back(-1), r = back(1), [A, B] = this.launch.tops, rp = this.launch.ropes;
        this.seg(rp[0], A, l); this.seg(rp[1], l, r); this.seg(rp[2], r, B);
      }
      if (run.s > M.PHYS.launch.postS + 50) { this.scene.remove(this.launch.g); this.launch = null; }
    }

    // ── 생선 · 하트 ──
    let nf = 0, nh = 0;
    for (let i = Math.max(0, run.iC - 2); i < run.coins.length; i++) {
      const c = run.coins[i];
      if (c.s > run.s + 150) break;
      if (c.taken || c.s < run.s - 4) continue;
      const [x, y, z] = W(T, c.s, c.u, c.z);
      _v.set(x, y + Math.sin(this.t * 4 + c.s) * 0.08, z);
      _q.setFromAxisAngle(UP, this.t * 3 + c.s);
      _s.setScalar(c.kind === 'heart' ? 1.3 : 1.25);
      _m.compose(_v, _q, _s);
      if (c.kind === 'heart') { if (nh < 12) this.hearts.setMatrixAt(nh++, _m); }
      else if (nf < 260) this.fish.setMatrixAt(nf++, _m);
    }
    this.fish.count = nf; this.hearts.count = nh;
    this.fish.instanceMatrix.needsUpdate = true; this.hearts.instanceMatrix.needsUpdate = true;
    _s.set(1, 1, 1);

    // ── 기차 (수로 옆 철길) ──
    if (fr.zone === 'canal') {
      this.train.s -= 13 * dt;
      if (this.train.s < run.s - 30) this.train.s = run.s + 170 + rr(0, 80);
      const ts = Math.max(0, Math.min(T.len - 1, this.train.s)), tf = T.frame(ts);
      if (tf.zone === 'canal') {
        const half = Prof.half(tf.prof), [x, , z] = W(T, ts, -(half + 5.5), 0);
        this.train.g.position.set(x, tf.y + Prof.rim(tf.prof) + 0.1, z); this.train.g.rotation.set(0, -tf.th, 0);
        this.train.g.visible = true;
      } else this.train.g.visible = false;
    } else this.train.g.visible = false;

    // ── 꽃잎 · 눈 · 낙엽 ──
    if (this.amb.visible) {
      // 카메라 앞쪽 상자 안에 흩뿌리고 천천히 떨어뜨린다
      const a = this.amb.geometry.attributes.position, cp = this.camPos, F = [Math.sin(fr.th), -Math.cos(fr.th)], Rt = [Math.cos(fr.th), Math.sin(fr.th)];
      for (let i = 0; i < this.ambP.length; i++) {
        const p = this.ambP[i];
        p[1] -= dt * (fr.zone === 'snow' ? 1.6 : 1.0); p[3] += dt;
        if (p[1] < -4) p[1] = 18;
        const side = p[0] + Math.sin(p[3]) * 0.8, fwd = p[2] + 20;
        a.setXYZ(i, cp.x + F[0] * fwd + Rt[0] * side, cp.y + p[1] - 6 - fwd * Math.tan(fr.gr), cp.z + F[1] * fwd + Rt[1] * side);
      }
      a.needsUpdate = true;
    }
    // 물보라: 세게 꺾거나 착지할 때
    const hard = !run.air && run.phase === 'run' && (Math.abs(run.uv) > 2.5 || run.boostT > 0);
    if (hard && this.sprayP.length < 60 && rnd() < 0.6) this.sprayP.push({ p: [sx + rr(-0.4, 0.4), sy + 0.1, sz + rr(-0.4, 0.4)], v: [rr(-2, 2), rr(1.5, 3.5), rr(-2, 2)], life: rr(0.3, 0.6) });
    for (const e of evs) if (e.type === 'land' || e.type === 'crash' || e.type === 'wipeout') {
      for (let i = 0; i < 24 && this.sprayP.length < 90; i++) this.sprayP.push({ p: [sx, sy + 0.2, sz], v: [rr(-4, 4), rr(2, 5), rr(-4, 4)], life: rr(0.4, 0.8) });
      if (e.type !== 'land') this.shake = 0.5;
    }
    const sa = this.spray.geometry.attributes.position;
    this.sprayP = this.sprayP.filter((q) => (q.life -= dt) > 0);
    for (let i = 0; i < 90; i++) {
      const q = this.sprayP[i];
      if (q) { q.v[1] -= 9 * dt; q.p[0] += q.v[0] * dt; q.p[1] += q.v[1] * dt; q.p[2] += q.v[2] * dt; sa.setXYZ(i, q.p[0], q.p[1], q.p[2]); }
      else sa.setXYZ(i, 0, -999, 0);
    }
    sa.needsUpdate = true;

    // ── 카메라: 뒤에서 따라간다 ──
    const cu = run.u * 0.55;
    const back = W(T, run.s - 6.5, cu, 0), ahead = W(T, run.s + 9, run.u * 0.8, 0);
    const lift = 2.9 + Math.min(2.5, run.z * 0.45);
    _v.set(back[0], Math.max(back[1], py - 1) + lift, back[2]);
    const kk = snap ? 1 : 1 - Math.exp(-dt * 7);
    this.camPos.lerp(_v, kk);
    this.camLook.lerp(_v.set(ahead[0], ahead[1] + 0.6 + run.z * 0.4, ahead[2]), kk);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) { this.shake -= dt; this.camera.position.x += rr(-1, 1) * this.shake * 0.4; this.camera.position.y += rr(-1, 1) * this.shake * 0.4; }
    this.camera.lookAt(this.camLook);
    this.camera.rotateZ(-Prof.bank(fr.prof, run.u) * 0.25);
    const fov = this.baseFov + Math.max(0, run.v - 14) * 0.45 + (run.boostT > 0 ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * (snap ? 1 : Math.min(1, dt * 4)); this.camera.updateProjectionMatrix(); }
  },

  render() { this.renderer.render(this.scene, this.camera); },
};

M.R3 = R;
M.ZC = ZC;
