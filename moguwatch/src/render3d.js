// render3d.js — THREE.js 아이소메트릭 디오라마: 지역 지형·랜드마크 · 냥이 탑 · 도둑단 · 병사 · 탄 · 효과
// 지형과 풍경은 꼭짓점 색 메시 하나(+ 밤에 빛나는 메시 하나)로 합친다. 낮은 해상도로 그려 화소를 키운다(도트 느낌 + 발열 줄이기)
// 그림자 지도 없이 발밑 동그란 그림자만, 램버트 재질
const M = window.MWT;
const THREE = window.THREE;

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rr = (a, b) => a + rnd() * (b - a);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ── 상자 여러 개 → 꼭짓점 색 메시 하나 ──
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
      const shade = nrm[1] > 0 ? 1 : nrm[1] < 0 ? 0.6 : (nrm[0] !== 0 ? 0.8 : 0.9);
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
M.Vox = Vox;
const VMAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
const SLOWMAT = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x9ac8ff, emissive: 0x10204a });
const GHOSTMAT = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false });
const HITMAT = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x884433 });
const basic = (color, extra = {}) => new THREE.MeshBasicMaterial(Object.assign({ color }, extra));

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter;
  return t;
}
function signTex(text, bg = '#fff6e0', fg = '#6a3a1a') {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = fg; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  });
}
function plane(tex, w, h, extra = {}) { return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial(Object.assign({ map: tex, transparent: true, side: THREE.DoubleSide }, extra))); }

// ══ 나무 · 소품 ══
function tree(v, x, z, kind, s = 1) {
  const y = 0.06;
  switch (kind) {
    case 'ginkgo':   // 노란 은행나무
      v.box(x, y, z, 0.22 * s, 1.0 * s, 0.22 * s, 0x6a4a2a);
      v.box(x, y + 0.8 * s, z, 1.1 * s, 0.7 * s, 1.1 * s, 0xf2c632, 0, 0.1); v.box(x, y + 1.45 * s, z, 0.8 * s, 0.55 * s, 0.8 * s, 0xf6d24a, 0, 0.1); v.box(x, y + 1.95 * s, z, 0.45 * s, 0.4 * s, 0.45 * s, 0xf8da5a); break;
    case 'metaseq':  // 메타세쿼이아 — 길쭉한 원뿔
      v.box(x, y, z, 0.2 * s, 0.6 * s, 0.2 * s, 0x7a4a2a);
      [[1.0, 0.5], [0.8, 1.1], [0.6, 1.7], [0.4, 2.3], [0.22, 2.8]].forEach(([w, yy]) => v.box(x, y + yy * s, z, w * s, 0.65 * s, w * s, 0x4a8a3a, 0, 0.1)); break;
    case 'pine':
      v.box(x, y, z, 0.2 * s, 0.6 * s, 0.2 * s, 0x6a4a2a);
      [[1.2, 0.45], [0.9, 1.0], [0.55, 1.5]].forEach(([w, yy]) => v.box(x, y + yy * s, z, w * s, 0.6 * s, w * s, 0x2e6a3e, 0, 0.08)); break;
    case 'maple': case 'maple2': {
      const col = kind === 'maple' ? pick([0xe8501e, 0xd83a1a, 0xf07a1a]) : pick([0xf0a020, 0xe8c030, 0xd86a1a]);
      v.box(x, y, z, 0.22 * s, 0.9 * s, 0.22 * s, 0x5a3a22);
      v.box(x, y + 0.75 * s, z, 1.3 * s, 0.75 * s, 1.2 * s, col, 0, 0.1); v.box(x + 0.15 * s, y + 1.4 * s, z - 0.1 * s, 0.85 * s, 0.5 * s, 0.85 * s, col, 0, 0.12); break;
    }
    case 'cherry':
      v.box(x, y, z, 0.22 * s, 0.85 * s, 0.22 * s, 0x5a3a2a);
      v.box(x, y + 0.7 * s, z, 1.3 * s, 0.7 * s, 1.2 * s, 0xffc0d6, 0, 0.08); v.box(x - 0.1 * s, y + 1.3 * s, z, 0.85 * s, 0.5 * s, 0.85 * s, 0xffd2e2, 0, 0.08); break;
    case 'willow':
      v.box(x, y, z, 0.22 * s, 1.1 * s, 0.22 * s, 0x5a4a2a);
      v.box(x, y + 0.9 * s, z, 1.3 * s, 0.6 * s, 1.3 * s, 0x8ab84a, 0, 0.1);
      for (const [dx, dz] of [[-0.55, 0], [0.55, 0], [0, -0.55], [0, 0.55]]) v.box(x + dx * s, y + 0.35 * s, z + dz * s, 0.25 * s, 0.7 * s, 0.25 * s, 0x9ac458); break;
    default:         // 둥근 활엽수
      v.box(x, y, z, 0.22 * s, 0.85 * s, 0.22 * s, 0x6a4a2a);
      v.box(x, y + 0.7 * s, z, 1.2 * s, 0.8 * s, 1.1 * s, pick([0x4a9a3a, 0x58a842, 0x3e8a34]), 0, 0.1); v.box(x + 0.1 * s, y + 1.4 * s, z, 0.75 * s, 0.5 * s, 0.75 * s, 0x5aae46, 0, 0.1);
  }
}
function roofTiers(v, x, y, z, w, d, col, n = 3, ry = 0) {   // 계단처럼 쌓은 기와지붕 + 들린 처마
  for (let i = 0; i < n; i++) v.box(x, y + i * 0.16, z, w * (1 - i * 0.22), 0.17, d * (1 - i * 0.18), i === n - 1 ? 0x3a3a44 : col, ry, 0.02);
  for (const s of [-1, 1]) v.box(x + Math.cos(ry) * s * w * 0.5, y + 0.12, z - Math.sin(ry) * s * w * 0.5, 0.18, 0.12, d * 0.95, col, ry);
}
function lamp(v, g, x, z, night) { v.box(x, 0.05, z, 0.08, 1.1, 0.08, 0x3a3a44); (night ? g : v).box(x, 1.12, z, 0.22, 0.22, 0.22, 0xfff0a0); }

// ══ 랜드마크 ══
function landmark(v, g, m, night, anims) {
  const { x, z } = m, b = (dx, y, dz, w, h, d, col, ry = 0) => v.box(x + dx, y, z + dz, w, h, d, col, ry);
  const gb = (dx, y, dz, w, h, d, col) => (night ? g : v).box(x + dx, y, z + dz, w, h, d, col);
  switch (m.k) {
    case 'deer': {   // 서울숲 꽃사슴 방사장 — 나무 울타리 안 사슴 둘
      b(0, 0.06, 0, 3.2, 0.04, 3.0, 0x9ac46a);
      for (let i = 0; i <= 8; i++) { const t = i / 8 * 3.2 - 1.6; b(t, 0.06, -1.5, 0.1, 0.6, 0.1, 0x8a6a3a); b(t, 0.06, 1.5, 0.1, 0.6, 0.1, 0x8a6a3a); }
      for (let i = 0; i <= 7; i++) { const t = i / 7 * 3 - 1.5; b(-1.6, 0.06, t, 0.1, 0.6, 0.1, 0x8a6a3a); b(1.6, 0.06, t, 0.1, 0.6, 0.1, 0x8a6a3a); }
      for (const zz of [-1.5, 1.5]) { b(0, 0.42, zz, 3.2, 0.08, 0.06, 0xa07a4a); b(0, 0.25, zz, 3.2, 0.06, 0.06, 0xa07a4a); }
      for (const xx of [-1.6, 1.6]) { b(xx, 0.42, 0, 0.06, 0.08, 3, 0xa07a4a); b(xx, 0.25, 0, 0.06, 0.06, 3, 0xa07a4a); }
      for (const [dx, dz, r] of [[-0.6, 0.3, 0.6], [0.7, -0.4, -1]]) {
        const cs = Math.cos(r), sn = Math.sin(r), P = (a, c) => [dx + a * sn + c * cs * 0, dz + a * cs];
        b(dx, 0.45, dz, 0.35, 0.35, 0.8, 0xb8743a, r); for (const [a, c] of [[-0.25, -0.1], [-0.25, 0.1], [0.25, -0.1], [0.25, 0.1]]) b(dx + a * sn + c * cs, 0.06, dz + a * cs - c * sn, 0.08, 0.42, 0.08, 0x8a5a2a);
        const h = P(0.45, 0); b(h[0], 0.75, h[1], 0.22, 0.32, 0.26, 0xb8743a, r); b(h[0], 1.05, h[1], 0.3, 0.2, 0.05, 0x7a5a3a, r);
        for (const [a, c] of [[-0.1, 0], [0.1, 0.1], [0, -0.12]]) b(dx + a * sn + c * cs, 0.81, dz + a * cs - c * sn, 0.07, 0.04, 0.07, 0xfff4e0);
      }
      break;
    }
    case 'brick': {   // 성수동 붉은 벽돌 공장 + 굴뚝
      b(0, 0.05, 0, 3.0, 1.4, 1.8, 0xa8442a); b(0, 1.45, 0, 3.1, 0.12, 1.9, 0x6a2a1a);
      for (let i = -1; i <= 1; i++) gb(i * 0.9, 0.6, 0.92, 0.5, 0.45, 0.04, 0xfff0b8);
      b(1.1, 0.05, -0.5, 0.45, 2.8, 0.45, 0x983a24); b(1.1, 2.85, -0.5, 0.55, 0.15, 0.55, 0x6a2a1a);
      break;
    }
    case 'apt': {     // 아파트 동
      b(0, 0.05, 0, 1.3, 3.6, 1.0, 0xe8e4dc); b(0, 3.65, 0, 1.36, 0.12, 1.06, 0x8a9aaa);
      for (let f = 0; f < 6; f++) for (const dx of [-0.35, 0.35]) gb(dx, 0.4 + f * 0.55, 0.51, 0.3, 0.25, 0.03, 0x9ad0f0);
      break;
    }
    case 'horse': {   // 서울숲 군마상
      b(0, 0.05, 0, 1.1, 0.5, 1.1, 0xb8b0a0); b(0, 0.55, 0, 0.3, 0.4, 0.8, 0x6a7a6a); b(0, 0.95, -0.35, 0.22, 0.35, 0.3, 0x6a7a6a);
      for (const [a, c] of [[-0.1, -0.3], [0.1, -0.3], [-0.1, 0.3], [0.1, 0.3]]) b(a, 0.55, c, 0.08, 0.05, 0.08, 0x5a6a5a);
      break;
    }
    case 'gate': {    // 남한산성 남문 — 돌 기단 위 문루, 가운데로 길이 지난다
      b(-1.2, 0.05, 0, 1.0, 1.3, 1.0, 0x9a968a); b(1.2, 0.05, 0, 1.0, 1.3, 1.0, 0x9a968a); b(0, 1.0, 0, 3.4, 0.4, 1.0, 0x9a968a);
      b(0, 1.4, 0, 2.6, 0.5, 0.8, 0x8a2a20); for (const dx of [-1.1, -0.4, 0.4, 1.1]) b(dx, 1.4, 0.42, 0.1, 0.5, 0.06, 0xc8382a);
      roofTiers(v, x, 1.9, z, 3.4, 1.4, 0x4a4e5e);
      break;
    }
    case 'wall': case 'hwall': {   // 성벽 — 돌담 위 여장
      const L = m.len || 4, col = m.k === 'hwall' ? 0xc8bca0 : 0x9a968a;
      b(0, 0.05, 0, L, 0.9, 0.7, col);
      for (let t = -L / 2 + 0.25; t < L / 2; t += 0.5) b(t, 0.95, 0, 0.32, 0.28, 0.7, m.k === 'hwall' ? 0x8a8070 : 0x7a766a);
      break;
    }
    case 'jangan': {  // 수원 장안문 — 옹성 + 2층 누각
      b(-1.5, 0.05, 0.2, 1.4, 1.4, 1.4, 0xc8bca0); b(1.5, 0.05, 0.2, 1.4, 1.4, 1.4, 0xc8bca0); b(0, 1.1, 0.2, 4.4, 0.4, 1.4, 0xc8bca0);
      b(0, 1.5, 0.2, 3.0, 0.6, 1.0, 0x9a2a20); roofTiers(v, x, 2.1, z + 0.2, 3.8, 1.6, 0x4a4e5e, 2);
      b(0, 2.45, 0.2, 2.2, 0.45, 0.8, 0x9a2a20); roofTiers(v, x, 2.9, z + 0.2, 3.0, 1.3, 0x4a4e5e, 3);
      for (const dx of [-2.1, 2.1]) b(dx, 1.5, 0.2, 0.14, 1.3, 0.14, 0x6a4a2a);
      gb(-2.1, 2.7, 0.2, 0.3, 0.4, 0.3, 0xffe080); gb(2.1, 2.7, 0.2, 0.3, 0.4, 0.3, 0xffe080);
      break;
    }
    case 'pavilion': {   // 방화수류정
      b(0, 0.05, 0, 2.2, 0.35, 1.8, 0xc8bca0);
      for (const [dx, dz] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]]) b(dx, 0.4, dz, 0.14, 0.9, 0.14, 0x9a2a20);
      b(0, 0.4, 0, 1.7, 0.08, 1.3, 0x8a6a3a); roofTiers(v, x, 1.3, z, 2.6, 2.2, 0x4a4e5e, 3);
      break;
    }
    case 'balloon': {   // 플라잉수원 열기구 — 둥실 떠 있다 (따로 움직이는 그룹)
      b(0, 0.05, 0, 1.4, 0.2, 1.4, 0x8a8a8a);
      const gg = new THREE.Group(), w = new Vox();
      const cols = [0xffffff, 0x3aa0e8]; for (let i = 0; i < 6; i++) { const r = Math.sin((i + 0.5) / 6 * Math.PI) * 1.1 + 0.25; w.box(0, 1.6 + i * 0.36, 0, r * 2, 0.37, r * 2, cols[i % 2], 0, 0.02); }
      w.box(0, 0.9, 0, 0.55, 0.4, 0.55, 0x8a5a2a); for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) w.box(dx, 1.3, dz, 0.04, 0.4, 0.04, 0x3a3a3a);
      gg.add(new THREE.Mesh(w.geo(), VMAT)); gg.position.set(x, 1.8, z);
      const rope = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.8, 0.03), basic(0x3a3a3a)); rope.position.set(x, 1.0, z);
      anims.push((t) => { gg.position.y = 1.8 + Math.sin(t * 0.7) * 0.25; gg.rotation.y = t * 0.2; });
      return [gg, rope];
    }
    case 'chicken': {   // 통닭 거리 가게
      for (let i = -1; i <= 1; i++) {
        b(i * 1.0, 0.05, 0, 0.95, 1.1, 0.9, [0xf2e2c2, 0xe8d0a8, 0xf4e8d4][i + 1]); b(i * 1.0, 1.15, 0, 1.0, 0.1, 0.95, 0x8a4a2a);
        gb(i * 1.0, 0.8, 0.46, 0.8, 0.28, 0.04, [0xffb000, 0xff6a30, 0xffd040][i + 1]); b(i * 1.0, 0.05, 0.46, 0.3, 0.55, 0.03, 0x6a4a3a);
      }
      break;
    }
    case 'glass': case 'glass2': {   // 판교 유리 빌딩
      const H = m.k === 'glass' ? 4.8 : 3.4, Wd = m.k === 'glass' ? 1.8 : 1.6;
      b(0, 0.05, 0, Wd, H, Wd, 0x6a9ac8); for (let y = 0.4; y < H; y += 0.5) b(0, y, 0, Wd + 0.04, 0.06, Wd + 0.04, 0xc8dcf0);
      b(0, H + 0.05, 0, Wd * 0.6, 0.3, Wd * 0.6, 0xa8b8c8);
      if (night) for (let y = 0.6; y < H; y += 0.5) g.box(x, y, z + Wd / 2 + 0.01, Wd * 0.8, 0.12, 0.02, 0xb8e0ff);
      break;
    }
    case 'market': {   // 모란시장 천막
      const cols = [0xe84a3a, 0x3a8ae8, 0xf0c030, 0x3ab05a];
      for (let i = 0; i < 4; i++) {
        const dx = (i % 2) * 1.6 - 0.8, dz = Math.floor(i / 2) * 1.5 - 0.75;
        for (const [a, c] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) b(dx + a, 0.05, dz + c, 0.06, 0.9, 0.06, 0x8a8a8a);
        b(dx, 0.9, dz, 1.4, 0.12, 1.2, cols[i]); b(dx, 1.02, dz, 1.0, 0.12, 1.2, 0xffffff); b(dx, 0.05, dz, 1.0, 0.45, 0.6, 0xc8a070);
        b(dx - 0.2, 0.5, dz, 0.25, 0.12, 0.25, pick([0xf07a2a, 0x8ac83a, 0xe83a3a]));
      }
      break;
    }
    case 'chiak': case 'chiak2': case 'samsung': {   // 뒷산 — 맵 뒤쪽 큰 산 (치악산 단풍 · 삼성산)
      const autumn = m.k !== 'samsung', S = m.k === 'chiak' ? 0.85 : 0.65;
      const lv = [[11, 1.4], [9, 1.4], [7, 1.4], [5, 1.3], [3.2, 1.2], [1.6, 1.0]];
      let y = -2.2;
      lv.forEach(([w, h], i) => {
        const col = autumn ? [0x8a6a3a, 0xc8501e, 0xe87a2a, 0xd8a03a, 0x8a8a6a, 0xb8b0a0][i] : [0x5a7a4a, 0x4a8a3a, 0x5a9a4a, 0x6aa05a, 0x8a9a7a, 0xa8a8a0][i];
        b(rr(-0.3, 0.3), y, rr(-0.2, 0.2), w * S, h * S + (i === 0 ? 2.2 : 0), w * S * 0.4, col, 0, 0.04); y += h * S + (i === 0 ? 2.2 : 0);
      });
      break;
    }
    case 'gamyeong': {   // 강원감영 선화당 — 붉은 대문 기와집
      b(0, 0.05, 0, 2.4, 0.3, 1.8, 0xb8b0a0); b(0, 0.35, 0, 2.0, 0.9, 1.3, 0xe8dcc0);
      for (const dx of [-0.95, -0.3, 0.3, 0.95]) b(dx, 0.35, 0.66, 0.12, 0.9, 0.06, 0x9a2a20);
      b(0, 0.35, 0.67, 0.5, 0.75, 0.04, 0xa83a2a); roofTiers(v, x, 1.25, z, 2.8, 2.0, 0x4a4e5e, 3);
      break;
    }
    case 'museum': {   // 뮤지엄산 — 물의 정원과 돌 건물
      b(0, 0.02, 0, 2.6, 0.06, 1.6, 0x5ab0d8); b(0.6, 0.05, -0.2, 1.2, 0.9, 1.0, 0xb8b0a0); b(0.6, 0.95, -0.2, 1.3, 0.08, 1.1, 0x8a847a);
      b(-0.8, 0.05, 0.2, 0.4, 0.5, 0.4, 0xd84a2a); b(-0.8, 0.55, 0.2, 0.25, 0.3, 0.25, 0xd84a2a);
      break;
    }
    case 'art': {      // 안양예술공원 — 알록달록 조형물
      b(0, 0.05, 0, 1.6, 0.15, 1.6, 0xd8d4c8);
      const cols = [0xe84a6a, 0xf0b030, 0x3aa0d8, 0x5ac05a, 0xa05ad8];
      for (let i = 0; i < 6; i++) b(Math.sin(i * 1.3) * 0.25, 0.2 + i * 0.32, Math.cos(i * 1.3) * 0.25, 0.55 - i * 0.04, 0.3, 0.55 - i * 0.04, cols[i % 5], i * 0.4);
      b(0.6, 0.2, 0.5, 0.15, 1.2, 0.15, 0xf06a3a); b(0.6, 1.4, 0.5, 0.5, 0.15, 0.15, 0xf06a3a);
      break;
    }
    case 'station': {   // 안양역
      b(0, 0.05, 0, 3.0, 1.2, 1.5, 0xd8d8d0); b(0, 1.25, 0, 3.2, 0.15, 1.7, 0x3a6aa8);
      for (let i = -1; i <= 1; i++) gb(i * 0.9, 0.5, 0.76, 0.6, 0.4, 0.03, 0xbfe0f8);
      b(0, 1.4, 0.7, 1.4, 0.35, 0.08, 0x3a6aa8);
      break;
    }
    case 'sstation': {  // 옛 신촌역 — 뾰족 지붕의 작은 역사
      b(0, 0.05, 0, 2.4, 1.0, 1.4, 0xf0e6d0); b(0, 1.05, 0, 2.6, 0.18, 1.6, 0x4a5a7a);
      b(0, 1.23, 0, 2.0, 0.22, 1.2, 0x4a5a7a); b(0, 1.45, 0, 1.2, 0.22, 0.8, 0x4a5a7a); b(0.6, 1.0, 0.2, 0.5, 1.0, 0.5, 0x4a5a7a);
      gb(-0.5, 0.45, 0.71, 0.5, 0.4, 0.03, 0xffe0a0); gb(0.5, 0.45, 0.71, 0.5, 0.4, 0.03, 0xffe0a0);
      break;
    }
    case 'rail': {     // 철길
      const L = m.len || 20;
      for (let t = -L / 2; t < L / 2; t += 0.5) b(t, 0.02, 0, 0.18, 0.06, 0.8, 0x6a5a4a);
      for (const dz of [-0.25, 0.25]) b(0, 0.08, dz, L, 0.06, 0.06, 0x9a9aa2, 0, 0);
      break;
    }
    case 'eagle': {    // 독수리 동상
      b(0, 0.05, 0, 1.2, 0.6, 1.2, 0xc8c4b8); b(0, 0.65, 0, 0.9, 0.5, 0.9, 0xb8b4a8);
      b(0, 1.15, 0, 0.35, 0.6, 0.35, 0x5a4a3a); b(0, 1.75, 0.08, 0.25, 0.25, 0.3, 0xf0f0f0); b(0, 1.78, 0.25, 0.1, 0.08, 0.15, 0xf0b020);
      b(-0.55, 1.4, 0, 0.8, 0.12, 0.3, 0x5a4a3a, 0.4); b(0.55, 1.4, 0, 0.8, 0.12, 0.3, 0x5a4a3a, -0.4);
      if (night) g.box(x, 0.06, z + 0.62, 0.8, 0.08, 0.04, 0xffe0a0);
      break;
    }
    case 'hall': {     // 대학 석조 건물 + 시계탑
      b(0, 0.05, 0, 3.0, 1.5, 1.6, 0xb8aa94); b(0, 1.55, 0, 3.1, 0.15, 1.7, 0x7a6a5a);
      b(0, 0.05, 0.1, 0.9, 2.8, 0.9, 0xa89a84); b(0, 2.85, 0.1, 0.6, 0.5, 0.6, 0x5a6a5a);
      gb(0, 2.2, 0.56, 0.4, 0.4, 0.03, 0xfff6d0);
      for (let i = -1; i <= 1; i += 2) for (let f = 0; f < 2; f++) gb(i * 0.95, 0.35 + f * 0.6, 0.81, 0.45, 0.3, 0.03, 0xffd890);
      break;
    }
    case 'shops': {    // 연세로 가게와 네온 간판
      const neon = [0xff4ad8, 0x4af0ff, 0xffe04a, 0x6aff7a];
      for (let i = -1; i <= 1; i++) {
        b(i * 1.0, 0.05, 0, 0.95, 1.5, 0.9, [0x8a8a9a, 0x7a7a8a, 0x9a9aaa][i + 1]);
        gb(i * 1.0, 1.1, 0.46, 0.8, 0.25, 0.04, neon[i + 1]); gb(i * 1.0, 0.4, 0.46, 0.6, 0.45, 0.03, 0xffe8b0);
      }
      gb(1.5, 0.3, 0.3, 0.06, 1.4, 0.3, neon[3]);
      break;
    }
    case 'bus': {      // 연세로 버스
      b(0, 0.25, 0, 2.6, 0.9, 0.9, 0x3ab05a); b(0, 0.6, 0, 2.62, 0.3, 0.92, 0xbfe0f0); b(0, 1.15, 0, 2.4, 0.08, 0.8, 0x2a8a4a);
      for (const dx of [-0.8, 0.8]) for (const dz of [-0.45, 0.45]) b(dx, 0.05, dz, 0.4, 0.4, 0.12, 0x222222);
      if (night) { g.box(x - 1.31, 0.4, z - 0.25, 0.03, 0.12, 0.15, 0xfff8c0); g.box(x - 1.31, 0.4, z + 0.25, 0.03, 0.12, 0.15, 0xfff8c0); }
      break;
    }
  }
  return null;
}

// ══ 츄르 곳간 (지킬 곳) · 쥐구멍 (도둑이 나오는 곳) ══
function baseModel(faceTex) {
  const g = new THREE.Group(), v = new Vox();
  v.box(0, 0.05, 0, 2.2, 0.2, 2.0, 0xc8b89a);
  v.box(0, 0.25, 0, 1.8, 1.2, 1.5, 0xfff2dc); v.box(0, 0.25, 0.76, 0.5, 0.8, 0.04, 0x9a5a3a);
  for (let i = 0; i < 4; i++) v.box(0, 1.45 + i * 0.2, 0, 2.2 - i * 0.5, 0.2, 1.9 - i * 0.12, 0xe8604a);
  v.box(-0.55, 2.2, 0, 0.3, 0.35, 0.3, 0xe8604a); v.box(0.55, 2.2, 0, 0.3, 0.35, 0.3, 0xe8604a);   // 고양이 귀 지붕
  // 츄르 더미
  const cols = [0xf05a8a, 0xf0b030, 0x5ac0e0, 0x8ad05a];
  for (let i = 0; i < 10; i++) v.box(1.25 + (i % 3) * 0.16 - 0.16, 0.25 + Math.floor(i / 3) * 0.1, 0.4 + (i % 2) * 0.1, 0.12, 0.1, 0.6, cols[i % 4], 0.1 * (i % 3));
  v.box(-1.15, 0.25, 0.5, 0.06, 1.8, 0.06, 0x8a6a4a);
  g.add(new THREE.Mesh(v.geo(), VMAT));
  const flag = plane(canvasTex(64, 40, (c, w, h) => { c.fillStyle = '#ffd83d'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8702a'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🐟', w / 2, h / 2 + 2); }), 0.7, 0.45);
  flag.position.set(-0.8, 1.8, 0.5); g.add(flag); g.userData.flag = flag;
  const face = plane(faceTex, 0.9, 0.9 * 221 / 256); face.position.set(0, 1.12, 0.79); g.add(face);
  const sign = plane(signTex('츄르 곳간'), 1.4, 0.35); sign.position.set(0, 1.5, 0.98); sign.rotation.x = -0.2; g.add(sign);
  return g;
}
function holeModel(v, x, z, dir) {
  const ry = Math.atan2(dir[0], dir[1]);
  const P = (a, c) => [x + a * Math.cos(ry) + c * Math.sin(ry), z - a * Math.sin(ry) + c * Math.cos(ry)];
  for (const [a, h] of [[-1.0, 1.1], [1.0, 1.1]]) { const p = P(a, 0); v.box(p[0], 0.05, p[1], 0.6, h, 0.8, 0x7a7266, ry); }
  const p = P(0, 0); v.box(p[0], 1.0, p[1], 2.6, 0.45, 0.8, 0x8a8276, ry); v.box(p[0], 0.05, p[1], 1.4, 0.95, 0.3, 0x1a1414, ry);
}

// ══ 냥이 탑 ══
const TCOL = [0xc8503a, 0x3a7ac8, 0xe8b030];   // 레벨별 지붕색
function catHead(v, x, y, z, col = 0xf0a050, ry = 0, s = 1) {
  v.box(x, y, z, 0.34 * s, 0.3 * s, 0.3 * s, col, ry, 0);
  const cs = Math.cos(ry), sn = Math.sin(ry);
  for (const sx of [-1, 1]) v.box(x + sx * 0.11 * s * cs, y + 0.3 * s, z - sx * 0.11 * s * sn, 0.09 * s, 0.11 * s, 0.07 * s, col, ry, 0);
  for (const sx of [-1, 1]) v.box(x + (sx * 0.08 * cs + 0.151 * sn) * s, y + 0.15 * s, z + (-sx * 0.08 * sn + 0.151 * cs) * s, 0.05 * s, 0.06 * s, 0.01, 0x1a1a1a, ry, 0);
}
function towerModel(kind, lvl) {
  const body = new Vox(), head = new Vox(), roof = TCOL[lvl];
  const H = 1.25 + lvl * 0.35;
  if (kind === 'yarn') {
    for (const [a, c] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) body.box(a, 0.2, c, 0.14, H, 0.14, 0x8a5a2a);
    for (let y = 0.5; y < H; y += 0.55) { body.box(0, y, -0.42, 0.9, 0.07, 0.07, 0xa06a3a); body.box(0, y, 0.42, 0.9, 0.07, 0.07, 0xa06a3a); }
    body.box(0, H + 0.2, 0, 1.2, 0.14, 1.2, 0xb07a40); body.box(0, H + 0.34, 0.58, 1.2, 0.22, 0.05, 0xa06a3a); body.box(0, H + 0.34, -0.58, 1.2, 0.22, 0.05, 0xa06a3a);
    for (const [a, c] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) body.box(a, H + 0.34, c, 0.08, 0.75, 0.08, 0x8a5a2a);
    body.box(0, H + 1.05, 0, 1.4, 0.16, 1.4, roof); body.box(0, H + 1.2, 0, 0.95, 0.16, 0.95, roof); body.box(0, H + 1.35, 0, 0.45, 0.16, 0.45, roof);
    catHead(head, 0, 0.18, 0, 0xf0a050); head.box(0, 0, 0, 0.32, 0.22, 0.28, 0xf0a050, 0, 0);
    head.box(0.24, 0.05, 0.12, 0.2, 0.2, 0.2, 0xe84a8a, 0, 0); // 털실 뭉치
    if (lvl >= 1) { catHead(body, -0.35, H + 0.48, -0.3, 0xfaf6ee); }
    if (lvl >= 2) { catHead(body, 0.35, H + 0.48, -0.3, 0x3a3434); }
  } else if (kind === 'can') {
    body.box(0, 0.2, 0, 1.3, 0.55, 1.3, 0x9a968a); body.box(0, 0.75, 0, 1.1, 0.2, 1.1, 0x8a8478);
    for (let i = 0; i < 4; i++) body.box(-0.45 + i * 0.3, 0.95, 0.5, 0.18, 0.18, 0.12, 0x8a8478);
    for (let i = 0; i < lvl + 1; i++) body.box(-0.5, 0.95 + i * 0.16, -0.45, 0.28, 0.15, 0.28, 0xc8c8d0);   // 캔 더미
    // 머리 = 투석 받침 + 커다란 캔 포신
    head.box(0, 0, 0, 0.75, 0.25, 0.75, 0x8a5a2a, 0, 0);
    head.box(0, 0.25, 0.05, 0.42 + lvl * 0.06, 0.42 + lvl * 0.06, 0.8, 0xc8ccd4, 0, 0); head.box(0, 0.25, 0.05, 0.44 + lvl * 0.06, 0.2, 0.5, roof, 0, 0);
    head.box(0, 0.32, 0.47, 0.3, 0.3, 0.04, 0x2a2a2a, 0, 0);
    catHead(head, -0.42, 0.15, -0.25, 0xfaf6ee, 0);
  } else if (kind === 'laser') {
    const n = 4 + lvl;
    for (let i = 0; i < n; i++) body.box(0, 0.2 + i * 0.35, 0, 0.72 - i * 0.03, 0.35, 0.72 - i * 0.03, i % 2 ? 0xd84a3a : 0xf6f2ea);
    const top = 0.2 + n * 0.35;
    body.box(0, top, 0, 0.95, 0.12, 0.95, 0x3a3a44);
    for (const [a, c] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) body.box(a, top + 0.12, c, 0.06, 0.55, 0.06, 0x3a3a44);
    body.box(0, top + 0.67, 0, 0.85, 0.12, 0.85, roof); body.box(0, top + 0.79, 0, 0.45, 0.2, 0.45, roof);
    head.box(0, 0, 0, 0.32, 0.3, 0.42, 0x3a3a44, 0, 0);
  } else {   // guard — 천막 초소 + 깃발
    body.box(0, 0.2, 0, 1.3, 0.12, 1.2, 0x9a8a6a);
    for (let i = 0; i < 4; i++) body.box(0, 0.32 + i * 0.22, 0, 1.2 - i * 0.28, 0.22, 1.1, i % 2 ? 0xf6f2ea : roof);
    body.box(0, 0.32, 0.56, 0.4, 0.5, 0.02, 0x3a2a2a);
    body.box(0.55, 0.32, -0.45, 0.06, 1.6 + lvl * 0.3, 0.06, 0x6a4a2a);
    body.box(0.55, 1.5 + lvl * 0.3, -0.3, 0.04, 0.35, 0.32, roof);
    body.box(-0.55, 0.32, 0.45, 0.3, 0.36, 0.06, 0xe8c040);   // 발바닥 방패
  }
  return { body: body.geo(), head: head.geo(), headY: kind === 'yarn' ? H + 0.34 : kind === 'can' ? 0.95 : kind === 'laser' ? 0.2 + (4 + lvl) * 0.35 + 0.18 : 0 };
}

// ══ 도둑단 모형 (앞 = +z) ══
function monGeo(type) {
  const v = new Vox(), b = (x, y, z, w, h, d, col) => v.box(x, y, z, w, h, d, col, 0, 0.03);
  const ears = (y, z, col, inner = 0xf0a0b0, sp = 0.13, s = 0.1) => { for (const sx of [-1, 1]) { b(sx * sp, y, z, s, s, 0.05, col); b(sx * sp, y + 0.01, z + 0.03, s * 0.6, s * 0.6, 0.01, inner); } };
  const eyes = (y, z, sp = 0.07, col = 0x1a1a1a) => { for (const sx of [-1, 1]) b(sx * sp, y, z, 0.05, 0.05, 0.02, col); };
  const legs = (col, sx = 0.12, fz = 0.12, h = 0.12) => { for (const a of [-sx, sx]) for (const c of [-fz, fz]) b(a, 0, c, 0.07, h, 0.07, col); };
  switch (type) {
    case 'mouse': legs(0xd08a9a); b(0, 0.1, 0, 0.32, 0.26, 0.44, 0x9a9aa2); b(0, 0.16, 0.26, 0.24, 0.2, 0.18, 0xa8a8b0); b(0, 0.18, 0.37, 0.06, 0.05, 0.04, 0xf08aa0); ears(0.3, 0.22, 0x9a9aa2); eyes(0.22, 0.351); b(0, 0.14, -0.4, 0.04, 0.04, 0.4, 0xd08a9a); break;
    case 'squirrel': legs(0x6a3a1a, 0.08, 0.08, 0.1); b(0, 0.08, 0, 0.22, 0.22, 0.3, 0x9a5a2a); b(0, 0.18, 0.18, 0.2, 0.18, 0.16, 0xa8622e); ears(0.34, 0.15, 0x9a5a2a, 0x6a3a1a, 0.07, 0.07); eyes(0.24, 0.265, 0.05);
      b(0, 0.15, -0.22, 0.2, 0.22, 0.16, 0xb87a3a); b(0, 0.35, -0.3, 0.22, 0.3, 0.16, 0xb87a3a); b(0, 0.6, -0.22, 0.2, 0.12, 0.2, 0xc88a4a); break;
    case 'pigeon': b(0, 0, 0, 0.3, 0.28, 0.46, 0x8a92a8); b(0, 0.2, 0.22, 0.2, 0.2, 0.2, 0x5a6a8a); b(0, 0.15, 0.24, 0.21, 0.08, 0.12, 0x5aa08a); b(0, 0.24, 0.34, 0.06, 0.05, 0.08, 0xd8c8a8); eyes(0.3, 0.32, 0.06, 0xe85a2a);
      b(-0.3, 0.12, -0.02, 0.32, 0.05, 0.3, 0x7a82a0); b(0.3, 0.12, -0.02, 0.32, 0.05, 0.3, 0x7a82a0); b(0, 0.08, -0.3, 0.2, 0.05, 0.16, 0x5a6a8a); break;
    case 'raccoon': legs(0x3a3a3a, 0.15, 0.16, 0.14); b(0, 0.12, 0, 0.44, 0.36, 0.56, 0x8a8478); b(0, 0.22, 0.32, 0.36, 0.3, 0.24, 0x9a948a); b(0, 0.27, 0.44, 0.38, 0.1, 0.06, 0x2a2a2a);
      eyes(0.3, 0.47, 0.09, 0xfaf6ee); b(0, 0.24, 0.47, 0.08, 0.06, 0.04, 0x1a1a1a); ears(0.52, 0.28, 0x6a6458, 0x3a3a3a, 0.14);
      for (let i = 0; i < 4; i++) b(0, 0.2 + i * 0.02, -0.34 - i * 0.12, 0.14, 0.14, 0.12, i % 2 ? 0x2a2a2a : 0xb0aaa0); break;
    case 'boxrat': b(0, 0, 0, 0.62, 0.48, 0.62, 0xc89a5a); b(0, 0.48, 0, 0.64, 0.04, 0.64, 0xb88a4a); b(0, 0.22, 0.311, 0.64, 0.08, 0.01, 0xe8d8a8); b(0, 0.0, 0.311, 0.1, 0.48, 0.01, 0xe8d8a8);
      b(0.08, 0.52, 0.1, 0.24, 0.2, 0.22, 0x9a9aa2); ears(0.7, 0.1, 0x9a9aa2, 0xf0a0b0, 0.1, 0.08); b(0.08, 0.6, 0.22, 0.12, 0.06, 0.04, 0x1a1a1a); break;
    case 'boar': legs(0x3a2a1a, 0.13, 0.15, 0.14); b(0, 0.12, 0, 0.4, 0.38, 0.6, 0x6a4a32); b(0, 0.18, 0.36, 0.3, 0.28, 0.2, 0x7a5a3a); b(0, 0.2, 0.48, 0.18, 0.14, 0.06, 0xc8907a);
      for (const sx of [-1, 1]) b(sx * 0.12, 0.18, 0.5, 0.04, 0.14, 0.04, 0xfaf6ee); eyes(0.36, 0.461, 0.09); ears(0.46, 0.28, 0x5a3a22, 0x3a2a1a, 0.12); b(0, 0.5, -0.05, 0.08, 0.08, 0.5, 0x3a2a1a); break;
    case 'weasel': legs(0x7a5a2a, 0.08, 0.2, 0.08); b(0, 0.08, 0, 0.18, 0.16, 0.6, 0xb8863a); b(0, 0.12, 0.34, 0.16, 0.15, 0.14, 0xc8964a); b(0, 0.1, 0.34, 0.15, 0.06, 0.12, 0xfaf0d8); eyes(0.2, 0.411, 0.05); ears(0.27, 0.32, 0xb8863a, 0x7a5a2a, 0.06, 0.05); b(0, 0.12, -0.42, 0.08, 0.08, 0.3, 0x6a4a2a); break;
    case 'frog': b(0, 0, 0, 0.48, 0.26, 0.44, 0x5ab84a); b(0, 0.04, 0.06, 0.4, 0.12, 0.36, 0xd8f0a8); for (const sx of [-1, 1]) { b(sx * 0.14, 0.26, 0.14, 0.14, 0.14, 0.14, 0x5ab84a); b(sx * 0.14, 0.3, 0.215, 0.07, 0.07, 0.01, 0x1a1a1a); b(sx * 0.3, 0, -0.12, 0.16, 0.12, 0.3, 0x4aa83a); } b(0, 0.12, 0.221, 0.24, 0.03, 0.01, 0xd84a4a); break;
    case 'skunk': legs(0x1a1a1a); b(0, 0.1, 0, 0.32, 0.28, 0.48, 0x2a2a30); b(0, 0.38, 0, 0.1, 0.02, 0.48, 0xfaf6ee); b(0, 0.16, 0.28, 0.24, 0.22, 0.16, 0x2a2a30); b(0, 0.27, 0.361, 0.05, 0.12, 0.01, 0xfaf6ee); eyes(0.24, 0.361);
      b(0, 0.25, -0.3, 0.24, 0.3, 0.2, 0x2a2a30); b(0, 0.5, -0.3, 0.26, 0.3, 0.22, 0x2a2a30); b(0, 0.55, -0.3, 0.08, 0.3, 0.23, 0xfaf6ee); break;
    case 'fox': legs(0x3a2a1a, 0.1, 0.15, 0.16); b(0, 0.16, 0, 0.3, 0.28, 0.52, 0xe87a2a); b(0, 0.24, 0.32, 0.26, 0.24, 0.2, 0xf08a3a); b(0, 0.22, 0.46, 0.12, 0.1, 0.1, 0xfaf6ee); b(0, 0.25, 0.51, 0.04, 0.04, 0.02, 0x1a1a1a);
      eyes(0.32, 0.421, 0.07); for (const sx of [-1, 1]) b(sx * 0.09, 0.48, 0.3, 0.08, 0.14, 0.05, 0xe87a2a); b(0, 0.24, -0.38, 0.2, 0.2, 0.36, 0xe87a2a); b(0, 0.26, -0.58, 0.16, 0.16, 0.1, 0xfaf6ee); break;
    case 'crow': b(0, 0, 0, 0.32, 0.28, 0.5, 0x2a2a34); b(0, 0.18, 0.26, 0.22, 0.22, 0.2, 0x22222c); b(0, 0.24, 0.4, 0.06, 0.06, 0.12, 0x3a3a3a); eyes(0.3, 0.361, 0.08, 0xe8e8f0);
      b(-0.36, 0.12, 0, 0.42, 0.05, 0.34, 0x22222c); b(0.36, 0.12, 0, 0.42, 0.05, 0.34, 0x22222c); b(0, 0.06, -0.34, 0.22, 0.05, 0.2, 0x22222c); break;
    case 'cheer': legs(0xd08a9a); b(0, 0.1, 0, 0.36, 0.3, 0.42, 0xd83a3a); b(0, 0.25, 0, 0.37, 0.08, 0.43, 0x2a4ac8); b(0, 0.4, 0.06, 0.26, 0.22, 0.22, 0x9a9aa2); ears(0.6, 0.06, 0x9a9aa2); eyes(0.48, 0.171);
      b(0, 0.62, 0.06, 0.28, 0.08, 0.24, 0x2a4ac8); b(0, 0.1, 0.32, 0.3, 0.26, 0.14, 0xfaf6ee); b(0, 0.22, 0.4, 0.31, 0.04, 0.02, 0xd83a3a);
      for (const sx of [-1, 1]) b(sx * 0.26, 0.36, 0.12, 0.12, 0.12, 0.12, 0xffd83a); break;
    case 'captain': legs(0xd08a9a); b(0, 0.1, 0, 0.36, 0.32, 0.48, 0x9a9aa2); b(0, 0.1, 0.1, 0.37, 0.24, 0.3, 0x2a3a6a); b(0, 0.2, 0.3, 0.26, 0.24, 0.2, 0xa8a8b0); ears(0.44, 0.24, 0x9a9aa2); eyes(0.3, 0.401);
      b(0, 0.44, 0.3, 0.32, 0.08, 0.3, 0x2a3a6a); b(0, 0.52, 0.3, 0.26, 0.1, 0.24, 0xfaf6ee); b(0, 0.46, 0.46, 0.3, 0.03, 0.06, 0x1a1a2a); b(0.12, 0.2, 0.42, 0.06, 0.06, 0.08, 0xe8c040); b(0, 0.14, -0.44, 0.04, 0.04, 0.4, 0xd08a9a); break;
    case 'badger': legs(0x2a2a2a, 0.17, 0.18, 0.12); b(0, 0.12, 0, 0.56, 0.38, 0.7, 0x5a5a5a); b(0, 0.5, 0, 0.4, 0.04, 0.6, 0x8a8a8a); b(0, 0.2, 0.42, 0.36, 0.3, 0.22, 0x3a3a3a); b(0, 0.22, 0.42, 0.08, 0.31, 0.23, 0xfaf6ee);
      eyes(0.34, 0.531, 0.1); b(0, 0.2, 0.54, 0.08, 0.06, 0.03, 0x1a1a1a); break;
    case 'robot': for (const [w, y] of [[0.85, 0.06], [0.95, 0.12], [0.85, 0.24]]) { b(0, y, 0, w, 0.14, w * 0.42, 0x4a4a54); b(0, y, 0, w * 0.42, 0.14, w, 0x4a4a54); b(0, y, 0, w * 0.75, 0.14, w * 0.75, 0x4a4a54); }
      b(0, 0.38, 0, 0.4, 0.04, 0.4, 0x2a2a34); b(0, 0.42, 0.1, 0.12, 0.04, 0.12, 0x6aff8a); b(0, 0.16, 0.46, 0.6, 0.12, 0.06, 0x8a8a94); break;
    case 'bRaccoon': return monGeo('raccoon');
    case 'bRobot': return monGeo('robot');
    case 'bRat': legs(0xd08a9a, 0.15, 0.15, 0.16); b(0, 0.14, 0, 0.5, 0.42, 0.62, 0x8a8a92); b(0, 0.24, 0.36, 0.36, 0.3, 0.26, 0x9a9aa2); b(0, 0.28, 0.5, 0.08, 0.07, 0.05, 0xf08aa0); ears(0.54, 0.32, 0x8a8a92, 0xf0a0b0, 0.17, 0.14); eyes(0.36, 0.491, 0.09, 0xe83a3a);
      b(0.32, 0.3, 0.2, 0.1, 0.1, 0.5, 0xfaf0d8); b(0.32, 0.3, 0.46, 0.18, 0.16, 0.12, 0xfaf0d8); b(0.32, 0.3, 0.1, 0.16, 0.2, 0.25, 0x9a4a2a); b(0, 0.18, -0.5, 0.05, 0.05, 0.5, 0xd08a9a); break;
    case 'bSnake': { const segs = 9; for (let i = 0; i < segs; i++) { const zz = 0.3 - i * 0.22, xx = Math.sin(i * 0.9) * 0.2, s = 0.34 - i * 0.02; b(xx, 0, zz, s, s * 0.8, 0.26, i % 2 ? 0x4a7a3a : 0x5a8a4a); b(xx, s * 0.8, zz, s * 0.5, 0.02, 0.2, 0xd8c060); }
      b(0, 0.18, 0.5, 0.34, 0.24, 0.32, 0x4a7a3a); eyes(0.34, 0.661, 0.1, 0xffd83a); b(0, 0.16, 0.7, 0.05, 0.02, 0.12, 0xd83a3a); break; }
    case 'bFrog': return monGeo('frog');
    case 'bCheer': return monGeo('cheer');
  }
  return v.geo();
}
function crownGeo() { const v = new Vox(); v.box(0, 0, 0, 0.3, 0.08, 0.3, 0xffd83a, 0, 0); for (const [a, c] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) v.box(a, 0.08, c, 0.06, 0.1, 0.06, 0xffd83a, 0, 0); v.box(0, 0.05, 0.151, 0.06, 0.06, 0.01, 0xe83a3a, 0, 0); return v.geo(); }
const MSCALE = { mouse: 1.35, squirrel: 1.35, pigeon: 1.35, raccoon: 1.3, boxrat: 1.25, boar: 1.3, weasel: 1.35, frog: 1.3, skunk: 1.35, fox: 1.3, crow: 1.3, cheer: 1.3, captain: 1.35, badger: 1.35, robot: 1.25, bRaccoon: 2.5, bRobot: 2.3, bRat: 2.4, bSnake: 2.5, bFrog: 2.8, bCheer: 2.4 };

// 냥이 병사 — 투구 쓰고 생선뼈 칼
function manGeo(col, col2) {
  const v = new Vox(), b = (x, y, z, w, h, d, c) => v.box(x, y, z, w, h, d, c, 0, 0.02);
  for (const a of [-0.08, 0.08]) b(a, 0, 0, 0.08, 0.14, 0.08, col);
  b(0, 0.12, 0, 0.26, 0.24, 0.22, col); b(0.06, 0.18, 0.04, 0.12, 0.12, 0.15, col2);
  catHead(v, 0, 0.36, 0.02, col, 0, 0.95);
  b(0, 0.62, 0.02, 0.36, 0.08, 0.32, 0xb8c0cc); b(0, 0.7, 0.02, 0.06, 0.1, 0.06, 0xd83a3a);   // 투구
  b(0.18, 0.18, 0.12, 0.04, 0.04, 0.38, 0xfaf6ee); for (let i = 0; i < 3; i++) b(0.18, 0.18, 0.18 + i * 0.09, 0.14, 0.02, 0.02, 0xfaf6ee);   // 생선뼈 칼
  b(-0.17, 0.12, 0.06, 0.06, 0.24, 0.2, 0xe8c040);   // 방패
  b(0, 0.24, -0.16, 0.06, 0.06, 0.2, col);
  return v.geo();
}

// ══ 본체 ══
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _col = new THREE.Color();

const R = {
  renderer: null, scene: null, camera: null, G: null, world: null, anims: [], monMesh: new Map(), manMesh: new Map(), towerObj: new Map(),
  parts: [], beams: [], view: { zoom: 1, px: 0, pz: 0 }, sel: -1, hover: -1, t: 0,

  init(canvas, faceImg) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.outputEncoding = THREE.LinearEncoding;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 0.6); this.sun.position.set(-8, 20, 10); this.scene.add(this.sun);
    const ft = new THREE.Texture(faceImg); ft.needsUpdate = true; ft.minFilter = THREE.LinearFilter; this.faceTex = ft;
    // 공용 모형
    this.geos = {}; for (const ty in M.MON) this.geos[ty] = monGeo(ty);
    this.crown = crownGeo();
    this.manGeos = [manGeo(0xf0a050, 0xfaf6ee), manGeo(0xfaf6ee, 0x3a3434), manGeo(0x3a3434, 0xfaf6ee), manGeo(0xe8d8c0, 0xc87a3a)];
    this.shadowGeo = new THREE.CircleGeometry(1, 10); this.shadowMat = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.22, depthWrite: false });
    // 체력 막대 (인스턴스)
    const bar = new THREE.PlaneGeometry(1, 1);
    this.barBg = new THREE.InstancedMesh(bar, basic(0x1a1a1a, { depthTest: false, transparent: true }), 200);
    this.barFg = new THREE.InstancedMesh(bar, basic(0xffffff, { depthTest: false, transparent: true }), 200);
    this.barFg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(600), 3);
    for (const im of [this.barBg, this.barFg]) { im.count = 0; im.frustumCulled = false; im.renderOrder = 10; this.scene.add(im); }
    // 탄 — 털실 뭉치 · 참치캔
    const yv = new Vox(); yv.box(0, -0.12, 0, 0.24, 0.24, 0.24, 0xe84a8a, 0, 0); yv.box(0, -0.13, 0, 0.26, 0.05, 0.1, 0xffa0c8, 0, 0);
    this.yarns = new THREE.InstancedMesh(yv.geo(), VMAT, 80);
    const cv = new Vox(); cv.box(0, -0.12, 0, 0.32, 0.22, 0.32, 0xc8ccd4, 0, 0); cv.box(0, -0.06, 0, 0.33, 0.1, 0.33, 0x3a8ae8, 0, 0);
    this.cans = new THREE.InstancedMesh(cv.geo(), VMAT, 30);
    for (const im of [this.yarns, this.cans]) { im.count = 0; im.frustumCulled = false; this.scene.add(im); }
    // 조각 효과
    this.pts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 400);
    this.pts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1200), 3);
    this.pts.count = 0; this.pts.frustumCulled = false; this.scene.add(this.pts);
    // 레이저 빔 (상자 늘이기)
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 40; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.beamMat); b.visible = false; this.scene.add(b); this.beams.push({ m: b, t: 0 }); }
    // 사거리 고리 · 고른 터 표시 · 집결 깃발
    const ring = new THREE.RingGeometry(0.97, 1, 48); ring.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ring, basic(0xffffff, { transparent: true, opacity: 0.85, depthWrite: false }));
    this.ringFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), basic(0xffffff, { transparent: true, opacity: 0.12, depthWrite: false }));
    this.ring.visible = this.ringFill.visible = false; this.scene.add(this.ring, this.ringFill);
    const fv = new Vox(); fv.box(0, 0, 0, 0.05, 0.8, 0.05, 0x6a4a2a, 0, 0); fv.box(0.15, 0.55, 0, 0.3, 0.22, 0.03, 0xffd83a, 0, 0);
    this.rally = new THREE.Mesh(fv.geo(), VMAT); this.rally.visible = false; this.scene.add(this.rally);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },

  // ── 지역 하나를 짓는다 ──
  setGame(G) {
    if (this.world) { this.scene.remove(this.world); this.world.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    for (const o of this.monMesh.values()) this.scene.remove(o.g); this.monMesh.clear();
    for (const o of this.manMesh.values()) this.scene.remove(o.g); this.manMesh.clear();
    for (const o of this.towerObj.values()) this.scene.remove(o.g); this.towerObj.clear();
    this.parts.length = 0; this.anims = []; this.sel = -1; this.hover = -1;
    this.G = G;
    const map = G.map, pal = map.pal, night = !!pal.night;
    seed = 11 + M.MAPS.indexOf(map) * 97;
    this.scene.background = new THREE.Color(pal.sky);
    this.hemi.color.set(pal.hemi[0]); this.hemi.groundColor.set(pal.hemi[1]); this.hemi.intensity = 0.62 * pal.light;
    this.sun.color.set(pal.sun); this.sun.intensity = 0.62 * pal.light;
    const world = new THREE.Group(), v = new Vox(), g = new Vox();
    const W = M.MAP_W, H = M.MAP_H, paths = G.paths;
    // 땅 — 0.5 칸. 길은 조금 낮게, 물은 더 낮게, 길이 물을 지나면 다리
    const C = 0.5, X0 = -1.5, Z0 = -1.5, X1 = W + 1.5, Z1 = H + 1.5;
    for (let x = X0; x < X1 - 1e-6; x += C) for (let z = Z0; z < Z1 - 1e-6; z += C) {
      const cx = x + C / 2, cz = z + C / 2, pd = M.pathDist(paths, cx, cz), wd = M.waterDist(map, cx, cz);
      const edge = cx < 0.6 + X0 || cz < 0.6 + Z0 || cx > X1 - 0.6 || cz > Z1 - 0.6;
      const chk = (Math.floor(cx) + Math.floor(cz)) % 2 === 0;
      if (wd < 0 && pd >= 0.85) { v.box(cx, -0.6, cz, C, 0.35, C, night ? 0x2a4a7a : 0x4aa0d8, 0, 0.03); continue; }
      if (pd < 0.85) {
        const col = pd < 0.7 ? (chk ? pal.path : pal.path2) : pal.edge;
        if (wd < 0.1) {   // 다리
          v.box(cx, -0.6, cz, C, 0.35, C, night ? 0x2a4a7a : 0x4aa0d8, 0, 0.03);
          v.box(cx, 0.0, cz, C, 0.12, C, pd < 0.7 ? 0xa87a4a : 0x7a5a3a, 0, 0.06);
          continue;
        }
        v.box(cx, -1.2, cz, C, 1.22, C, col, 0, 0.04);
        continue;
      }
      const top = wd < 0.35 ? 0.02 : 0.06;
      v.box(cx, -1.2, cz, C, 1.2 + top, C, edge ? pal.ground2 : wd < 0.35 ? 0xc8b88a : (chk ? pal.ground : pal.ground2), 0, 0.05);
    }
    // 디오라마 받침 옆면 — 흙 띠
    v.box(W / 2, -2.2, Z1 + 0.01 - 0.25, X1 - X0, 1.0, 0.5, 0x6a4a32); v.box(X1 - 0.25 + 0.01, -2.2, H / 2, 0.5, 1.0, Z1 - Z0, 0x5a3e2a);
    v.box(W / 2, -2.2, Z0 + 0.25, X1 - X0, 1.0, 0.5, 0x6a4a32); v.box(X0 + 0.25, -2.2, H / 2, 0.5, 1.0, Z1 - Z0, 0x5a3e2a);
    // 다리 난간
    for (const P of paths) for (let d = 0; d < P.len; d += 0.5) {
      const q = P.at(d); if (M.waterDist(map, q.x, q.z) > 0.1) continue;
      for (const s of [-1, 1]) { const x = q.x - q.dz * 0.85 * s, z = q.z + q.dx * 0.85 * s; if (M.pathDist(paths, x, z) < 0.8) continue; v.box(x, 0.1, z, 0.12, 0.35, 0.12, map.id === 'wonju' ? 0xd83a2a : 0x8a5a3a, 0, 0); v.box(x, 0.38, z, Math.abs(q.dx) > 0.5 ? 0.55 : 0.1, 0.07, Math.abs(q.dz) > 0.5 ? 0.55 : 0.1, map.id === 'wonju' ? 0xe84a3a : 0xa06a3a, 0, 0); }
    }
    // 쥐구멍 · 곳간
    for (const P of paths) { const a = P.pts[0], b = P.pts[1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); holeModel(v, a[0] + (b[0] - a[0]) / L * 0.5, a[1] + (b[1] - a[1]) / L * 0.5, [(b[0] - a[0]) / L, (b[1] - a[1]) / L]); }
    // 랜드마크
    for (const m of map.marks) { const extra = landmark(v, g, m, night, this.anims); if (extra) extra.forEach((o) => world.add(o)); }
    // 나무 — 길·물·터·랜드마크·곳간을 피해 흩어 심는다
    const plots = G.plots, base = G.base;
    const free = (x, z, r) => M.pathDist(paths, x, z) > 1.05 + r && M.waterDist(map, x, z) > 0.3 && !plots.some((p) => Math.hypot(p.x - x, p.z - z) < 0.95 + r)
      && !map.marks.some((m) => m.r > 0 && Math.hypot(m.x - x, m.z - z) < m.r + 0.5) && Math.hypot(base[0] - x, base[1] - z) > 1.8;
    const placed = [];
    for (let i = 0; i < 900 && placed.length < 72; i++) {
      const x = rr(-1.1, W + 1.1), z = rr(-1.1, H + 1.1);
      if (!free(x, z, 0.1) || placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 1.05)) continue;
      placed.push([x, z]); tree(v, x, z, pick(map.trees), rr(0.72, 1.0));
    }
    // 덤불 · 꽃 · 돌
    for (let i = 0; i < 400; i++) {
      const x = rr(-1, W + 1), z = rr(-1, H + 1);
      if (!free(x, z, -0.4) || placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 0.5)) continue;
      const r = rnd();
      if (r < 0.5) v.box(x, 0.05, z, 0.22, 0.12, 0.22, pick([0x4a8a3a, 0x5a9a42, pal.ground2]));
      else if (r < 0.75) v.box(x, 0.05, z, 0.1, 0.1, 0.1, pick([0xffffff, 0xffd83a, 0xff8ab0, 0xb08aff]));
      else v.box(x, 0.04, z, 0.28, 0.14, 0.22, 0x9a968e);
    }
    // 길가 가로등 (밤엔 빛난다)
    for (const P of paths) for (let d = 3; d < P.len - 2; d += 6) {
      const q = P.at(d), x = q.x - q.dz * 1.05, z = q.z + q.dx * 1.05;
      if (M.pathDist(paths, x, z) > 0.95 && M.waterDist(map, x, z) > 0.3 && !plots.some((p) => Math.hypot(p.x - x, p.z - z) < 1.0)) lamp(v, g, x, z, night);
    }
    world.add(new THREE.Mesh(v.geo(), VMAT));
    if (g.p.length) world.add(new THREE.Mesh(g.geo(), GLOW));
    // 터 — 둥근 돌 받침
    this.plotMesh = [];
    const pv = new Vox(); pv.box(0, 0.0, 0, 1.25, 0.14, 1.0, 0xc8c0b0, 0, 0); pv.box(0, 0.0, 0, 1.0, 0.14, 1.25, 0xc8c0b0, 0, 0); pv.box(0, 0.14, 0, 0.9, 0.04, 0.9, 0xb0a898, 0, 0);
    pv.box(0.35, 0.18, -0.3, 0.04, 0.45, 0.04, 0x6a4a2a, 0, 0); pv.box(0.43, 0.48, -0.3, 0.16, 0.12, 0.02, 0xffd83a, 0, 0);
    const pg = pv.geo();
    for (const p of plots) {
      const m = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.position.set(p.x, 0.02, p.z); world.add(m); this.plotMesh.push(m);
    }
    // 츄르 곳간
    const b = baseModel(this.faceTex); b.position.set(base[0], 0.06, base[1]);
    const last = paths[0].pts[paths[0].pts.length - 2]; b.rotation.y = Math.atan2(last[0] - base[0], last[1] - base[1]);
    world.add(b); this.baseObj = b;
    this.world = world; this.scene.add(world);
    this.fit();
  },

  // ── 카메라: 맵 전체가 들어오게 맞춘다 ──
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    // 화면 긴 쪽이 760 화소쯤 되게 그린다 (도트 느낌 + 발열 줄이기)
    const pr = Math.max(0.45, Math.min(1.25, 760 / Math.max(w, h)));
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, true);
    this.fit();
  },
  fit() {
    const W = M.MAP_W, H = M.MAP_H, cam = this.camera, aspect = window.innerWidth / window.innerHeight;
    const portrait = aspect < 1;
    const yaw = portrait ? 1.45 : 0.5, elev = 0.9, dist = 60;   // 세로 화면은 맵 긴 쪽을 세로로 돌려 크게 보인다
    this.yaw = yaw;
    const cx = W / 2 + this.view.px, cz = H / 2 + this.view.pz;
    cam.position.set(cx + Math.sin(yaw) * Math.cos(elev) * dist, Math.sin(elev) * dist, cz + Math.cos(yaw) * Math.cos(elev) * dist);
    cam.up.set(0, 1, 0); cam.lookAt(cx, 0, cz); cam.updateMatrixWorld();
    // 맵 모서리를 카메라 평면에 올려 크기를 잰다
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const x of [-1, W + 1]) for (const z of [-1, H + 1]) for (const y of [-2, 1.5]) {
      _v.set(x - W / 2, y, z - H / 2); const a = _v.dot(right), b2 = _v.dot(up);
      x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b2); y1 = Math.max(y1, b2);
    }
    const mw = (x1 - x0) * 1.02, mh = (y1 - y0) * 1.12;
    let hw, hh; if (mw / mh > aspect) { hw = mw / 2; hh = hw / aspect; } else { hh = mh / 2; hw = hh * aspect; }
    cam.left = -hw; cam.right = hw; cam.top = hh + (y1 + y0) / 2 * 0; cam.bottom = -hh;
    cam.zoom = this.view.zoom; cam.updateProjectionMatrix();
  },
  zoomBy(f) { this.view.zoom = M.clamp(this.view.zoom * f, 1, 2.8); this.clampPan(); this.fit(); },
  panBy(dxPx, dyPx) {
    const cam = this.camera, s = (cam.right - cam.left) / cam.zoom / window.innerWidth;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); right.y = 0; right.normalize();
    const fwd = new THREE.Vector3(-right.z, 0, right.x);   // 화면 위쪽 = 땅 위에서 먼 쪽
    const ky = s / Math.sin(0.9);
    this.view.px -= right.x * dxPx * s - fwd.x * dyPx * ky; this.view.pz -= right.z * dxPx * s - fwd.z * dyPx * ky;
    this.clampPan(); this.fit();
  },
  clampPan() { const lim = (1 - 1 / this.view.zoom); this.view.px = M.clamp(this.view.px, -12 * lim, 12 * lim); this.view.pz = M.clamp(this.view.pz, -8 * lim, 8 * lim); },
  resetView() { this.view.zoom = 1; this.view.px = this.view.pz = 0; this.fit(); },

  // 화면 좌표 → 가장 가까운 터 (터 바닥과 탑 가운데 둘 다 본다)
  pickPlot(cx, cy) {
    if (!this.G) return -1;
    let best = -1, bd = 1e9;
    const lim = Math.max(22, 0.9 * this.pxPerUnit());
    this.G.plots.forEach((p, i) => {
      for (const y of [0.1, 1.0]) { const s = this.toScreen(p.x, y, p.z), d = Math.hypot(s.x - cx, s.y - cy); if (d < bd) { bd = d; best = i; } }
    });
    return bd < lim ? best : -1;
  },
  pxPerUnit() { const cam = this.camera; return window.innerWidth / ((cam.right - cam.left) / cam.zoom); },
  toScreen(x, y, z) { _v.set(x, y, z).project(this.camera); return { x: (_v.x + 1) / 2 * window.innerWidth, y: (1 - _v.y) / 2 * window.innerHeight }; },

  // ── 고른 터 · 사거리 표시 ──
  showSel(i, kind, lvl) {
    this.sel = i;
    if (i < 0 || !this.G) { this.ring.visible = this.ringFill.visible = this.rally.visible = false; return; }
    const p = this.G.plots[i], t = this.G.towerAt[i], k = kind || (t && t.kind), lv = lvl !== undefined ? lvl : t ? t.lvl : 0;
    if (!k) { this.ring.visible = this.ringFill.visible = this.rally.visible = false; return; }
    const r = M.TOWER[k].range[lv], c = k === 'guard' ? p.rally : p;
    for (const m of [this.ring, this.ringFill]) { m.visible = true; m.position.set(c.x, 0.12, c.z); m.scale.set(r, 1, r); m.material.color.set(kind && !t ? 0xffd83a : 0xffffff); }
    this.rally.visible = k === 'guard'; this.rally.position.set(p.rally.x, 0.05, p.rally.z);
  },

  // ── 효과 ──
  burst(x, y, z, col, n, spd = 2, size = 0.12, life = 0.6, up = 2) {
    for (let i = 0; i < n && this.parts.length < 400; i++) {
      const a = rnd() * 6.28, s = spd * (0.4 + rnd() * 0.8);
      this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: up * (0.5 + rnd()), vz: Math.sin(a) * s, t: 0, life: life * (0.7 + rnd() * 0.6), size: size * (0.6 + rnd() * 0.8), col: new THREE.Color(Array.isArray(col) ? pick(col) : col), g: up > 0 ? 6 : -0.5 });
    }
  },
  beam(pts, top) {
    let prev = top;
    for (const p of pts) {
      const b = this.beams.find((x) => x.t <= 0); if (!b) return;
      const dx = p[0] - prev[0], dy = p[1] - prev[1], dz = p[2] - prev[2], L = Math.hypot(dx, dy, dz);
      b.m.position.set((p[0] + prev[0]) / 2, (p[1] + prev[1]) / 2, (p[2] + prev[2]) / 2);
      b.m.scale.set(0.06, 0.06, L); b.m.lookAt(p[0], p[1], p[2]); b.m.visible = true; b.t = 0.18;
      prev = p;
    }
  },
  onEvents(evs) {
    for (const e of evs) {
      switch (e.type) {
        case 'kill': {
          const m = e.mon, cols = { mouse: 0x9a9aa2, squirrel: 0x9a5a2a, pigeon: 0x8a92a8, raccoon: 0x8a8478, boxrat: 0xc89a5a, boar: 0x6a4a32, weasel: 0xb8863a, frog: 0x5ab84a, skunk: 0x2a2a30, fox: 0xe87a2a, crow: 0x2a2a34, cheer: 0xd83a3a, captain: 0x2a3a6a, badger: 0x5a5a5a, robot: 0x4a4a54 };
          this.burst(m.x, m.y + 0.3, m.z, [cols[m.type] || 0xffd83a, 0xffffff], m.boss ? 40 : 9, m.boss ? 4 : 2);
          this.burst(m.x, m.y + 0.6, m.z, 0xffd83a, m.boss ? 14 : 3, 1, 0.09, 0.8, 3);
          break;
        }
        case 'boom': this.burst(e.x, 0.2, e.z, [0xffb030, 0xff6a20, 0xfff0a0, 0x8a8a8a], 22, e.r * 2.2, 0.14, 0.5, 2.5); break;
        case 'hit': this.burst(e.x, e.y, e.z, [0xe84a8a, 0xffa0c8], 4, 1.2, 0.07, 0.3, 1); break;
        case 'gas': this.burst(e.x, 0.3, e.z, [0x9ad04a, 0x6aa83a, 0xc8e86a], 26, e.r * 1.2, 0.2, 1.1, 0.4); break;
        case 'emp': this.burst(e.x, 0.4, e.z, [0x6ad0ff, 0xffffff], 36, e.r * 2, 0.1, 0.5, 0.5); break;
        case 'stomp': this.burst(e.x, 0.1, e.z, [0x8a7a5a, 0xb8a888], 24, 3, 0.14, 0.5, 1.5); break;
        case 'beam': { const t = e.tower; this.beam(e.pts, [t.x, (this.towerObj.get(t.id) || {}).hy || 2.2, t.z]); break; }
        case 'build': case 'upgrade': this.burst(e.tower.x, 0.3, e.tower.z, [0xffffff, 0xd8c8a8, 0xffd83a], 18, 2, 0.12, 0.6, 2.5); break;
        case 'sell': this.burst(e.tower.x, 0.3, e.tower.z, [0xffd83a, 0xb8a888], 18, 2, 0.12, 0.6, 2.5); break;
        case 'leak': this.burst(this.G.base[0], 1.2, this.G.base[1], [0xf05a8a, 0xf0b030, 0x5ac0e0], 10, 1.5, 0.1, 0.7, 3); break;
        case 'manDown': this.burst(e.man.x, 0.3, e.man.z, [0xf0a050, 0xffffff], 8, 1.5, 0.1, 0.5, 2); break;
      }
    }
  },

  // ── 움직이는 것들 ──
  syncTowers(G) {
    const seen = new Set();
    for (const t of G.towers) {
      seen.add(t.id);
      let o = this.towerObj.get(t.id);
      if (!o || o.lvl !== t.lvl) {
        if (o) this.scene.remove(o.g);
        const md = towerModel(t.kind, t.lvl), g = new THREE.Group();
        g.add(new THREE.Mesh(md.body, VMAT)); const head = new THREE.Mesh(md.head, VMAT); head.position.y = md.headY; g.add(head);
        let lens = null;
        if (t.kind === 'laser') { lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.08), basic(0xff3a3a)); lens.position.set(0, 0.15, 0.24); head.add(lens); }
        const stun = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.05, 4, 10), basic(0x6ad0ff)); stun.rotation.x = Math.PI / 2; stun.position.y = md.headY + 0.9; stun.visible = false; g.add(stun);
        g.position.set(t.x, 0.2, t.z); this.scene.add(g);
        o = { g, head, lens, stun, lvl: t.lvl, hy: md.headY + 0.35, born: this.t };
        this.towerObj.set(t.id, o);
      }
    }
    for (const [id, o] of this.towerObj) if (!seen.has(id)) { this.scene.remove(o.g); this.towerObj.delete(id); }
  },

  update(dt, G) {
    this.t += dt;
    for (const f of this.anims) f(this.t);
    if (!G) return;
    this.syncTowers(G);
    const cam = this.camera;
    // 탑 머리 돌리기 · 기절 표시 · 지을 때 쑥 올라옴
    for (const t of G.towers) {
      const o = this.towerObj.get(t.id); if (!o) continue;
      const a = t.kind === 'guard' ? 0 : t.aim; let d = a - o.head.rotation.y; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283;
      o.head.rotation.y += d * Math.min(1, dt * 12);
      if (t.kind === 'can') o.head.position.z = Math.max(0, 0.15 - t.fireT * 0.5) * -1;
      if (o.lens) o.lens.material.color.setHex(t.fireT < 0.2 ? 0xffffff : 0xff3a3a);
      o.stun.visible = t.stun > 0; o.stun.rotation.z = this.t * 6;
      const k = Math.min(1, (this.t - o.born) * 4); o.g.scale.set(1, 0.3 + 0.7 * k, 1);
    }
    // 도둑
    const seen = new Set();
    let bi = 0;
    for (const m of G.mons) {
      seen.add(m.id);
      let o = this.monMesh.get(m.id);
      if (!o) {
        const g = new THREE.Group(), body = new THREE.Mesh(this.geos[m.type], VMAT); g.add(body);
        const sc = MSCALE[m.type] || 1; body.scale.setScalar(sc);
        if (m.boss) { const c = new THREE.Mesh(this.crown, VMAT); c.position.set(0, (m.type === 'bSnake' ? 0.5 : m.type === 'bRobot' ? 0.45 : 0.62) * sc, m.type === 'bRat' ? 0.3 * sc : 0.2 * sc); g.add(c); }
        const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat); sh.rotation.x = -Math.PI / 2; sh.scale.setScalar(m.def.rad * 1.1); this.scene.add(sh);
        this.scene.add(g); o = { g, body, sh, sc }; this.monMesh.set(m.id, o);
      }
      const fly = m.def.fly, bob = m.moving ? Math.abs(Math.sin(m.walk)) * 0.06 : 0;
      o.g.position.set(m.x, 0.06 + m.y + bob + (fly ? Math.sin(this.t * 6 + m.id) * 0.1 : 0), m.z);
      let d = m.dir - o.g.rotation.y; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; o.g.rotation.y += d * Math.min(1, dt * 10);
      if (fly) o.body.scale.x = o.sc * (1 + Math.sin(this.t * 18 + m.id) * 0.18);
      if (m.type === 'robot' || m.type === 'bRobot') o.body.rotation.y = 0;
      o.body.material = m.ghost ? GHOSTMAT : G.t - m.lastHit < 0.08 ? HITMAT : m.slowT > 0 ? SLOWMAT : VMAT;
      o.sh.position.set(m.x, 0.08, m.z);
      // 체력 막대
      if ((m.hp < m.maxHp || m.boss) && bi < 200) {
        const w = m.boss ? 1.6 : 0.6, y = 0.06 + m.y + (m.boss ? 2.3 : 0.95) + (fly ? 0.1 : 0);
        _v.set(m.x, y, m.z);
        _m.compose(_v, cam.quaternion, _s.set(w + 0.06, 0.12, 1)); this.barBg.setMatrixAt(bi, _m);
        const f = Math.max(0, m.hp / m.maxHp);
        const rt = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        _v.addScaledVector(rt, -(1 - f) * w / 2);
        _m.compose(_v, cam.quaternion, _s.set(w * f, 0.07, 1)); this.barFg.setMatrixAt(bi, _m);
        _col.setHex(m.boss ? 0xff4a6a : f > 0.5 ? 0x5ad84a : f > 0.25 ? 0xf0c030 : 0xe84a3a); this.barFg.setColorAt(bi, _col);
        bi++;
      }
    }
    for (const [id, o] of this.monMesh) if (!seen.has(id)) { this.scene.remove(o.g); this.scene.remove(o.sh); this.monMesh.delete(id); }
    // 냥이 병사
    const ms = new Set();
    for (const s of G.men) {
      ms.add(s.id);
      let o = this.manMesh.get(s.id);
      if (!o) { const g = new THREE.Mesh(this.manGeos[(s.tower.plot + s.slot) % 4], VMAT); g.scale.setScalar(1.3); const sh = new THREE.Mesh(this.shadowGeo, this.shadowMat); sh.rotation.x = -Math.PI / 2; sh.scale.setScalar(0.22); this.scene.add(g, sh); o = { g, sh }; this.manMesh.set(s.id, o); }
      o.g.visible = o.sh.visible = !s.dead;
      if (s.dead) continue;
      o.g.position.set(s.x, 0.06 + Math.abs(Math.sin(s.walk)) * 0.05 + (s.target && G.t - (s.hitT || 0) < 0 ? 0.05 : 0), s.z);
      o.g.rotation.y = s.dir; o.sh.position.set(s.x, 0.08, s.z);
      if (s.hp < s.maxHp && bi < 200) {
        _v.set(s.x, 1.2, s.z); _m.compose(_v, cam.quaternion, _s.set(0.46, 0.1, 1)); this.barBg.setMatrixAt(bi, _m);
        const f = s.hp / s.maxHp, rt = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); _v.addScaledVector(rt, -(1 - f) * 0.2);
        _m.compose(_v, cam.quaternion, _s.set(0.4 * f, 0.06, 1)); this.barFg.setMatrixAt(bi, _m); _col.setHex(0x4ac0ff); this.barFg.setColorAt(bi, _col); bi++;
      }
    }
    for (const [id, o] of this.manMesh) if (!ms.has(id)) { this.scene.remove(o.g, o.sh); this.manMesh.delete(id); }
    this.barBg.count = this.barFg.count = bi;
    this.barBg.instanceMatrix.needsUpdate = this.barFg.instanceMatrix.needsUpdate = true; if (this.barFg.instanceColor) this.barFg.instanceColor.needsUpdate = true;
    // 탄
    let yi = 0, ci = 0;
    for (const s of G.shots) {
      if (s.kind === 'yarn' && yi < 80) { _e.set(this.t * 9, this.t * 7, 0); _q.setFromEuler(_e); _m.compose(_v.set(s.x, s.y, s.z), _q, _s.set(1, 1, 1)); this.yarns.setMatrixAt(yi++, _m); }
      else if (s.kind === 'can' && ci < 30) { _e.set(this.t * 8, 0, this.t * 5); _q.setFromEuler(_e); _m.compose(_v.set(s.x, s.y + 0.2, s.z), _q, _s.set(1, 1, 1)); this.cans.setMatrixAt(ci++, _m); }
    }
    this.yarns.count = yi; this.cans.count = ci; this.yarns.instanceMatrix.needsUpdate = this.cans.instanceMatrix.needsUpdate = true;
    // 조각 효과
    let pi = 0; const keep = [];
    for (const p of this.parts) {
      p.t += dt; if (p.t >= p.life) continue;
      p.vy -= p.g * dt; p.x += p.vx * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.z += p.vz * dt; p.vx *= 0.96; p.vz *= 0.96;
      const s = p.size * (1 - p.t / p.life * 0.6);
      _m.compose(_v.set(p.x, p.y, p.z), _q.identity(), _s.set(s, s, s)); this.pts.setMatrixAt(pi, _m); this.pts.setColorAt(pi, p.col); pi++;
      keep.push(p);
    }
    this.parts = keep; this.pts.count = pi; this.pts.instanceMatrix.needsUpdate = true; if (this.pts.instanceColor) this.pts.instanceColor.needsUpdate = true;
    for (const b of this.beams) { if (b.t > 0) { b.t -= dt; b.m.visible = b.t > 0; } }
    this.beamMat.opacity = 0.75 + Math.sin(this.t * 40) * 0.2;
    // 터 강조 — 고른 터는 노랗게, 지을 수 있는 빈 터는 살짝 숨쉬듯
    if (this.plotMesh) this.plotMesh.forEach((m, i) => {
      const has = !!G.towerAt[i];
      m.material.emissive.setHex(i === this.sel ? 0x6a5a00 : i === this.hover ? 0x3a3a2a : (!has && this.pulse ? (Math.sin(this.t * 4) > 0 ? 0x1a1a10 : 0) : 0));
    });
    if (this.baseObj) this.baseObj.userData.flag.rotation.y = Math.sin(this.t * 3) * 0.3;
  },
  render() { this.renderer.render(this.scene, this.camera); },
};
M.R3 = R;
