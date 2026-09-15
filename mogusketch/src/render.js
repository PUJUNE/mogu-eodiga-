// render.js — 손그림 러프 스토리보드 렌더 (960×540 논리 좌표, Canvas 2D)
// 흰 종이 + 옅은 붉은 가이드 + 파란 투시 보조선 링 / 선만 쓰고 면을 채우지 않는다.
// 선 떨림(line boil): 초당 8회 흔들림 시드를 바꾸고, 그 사이에는 같은 시드를 재사용한다.
const M = window.MSK;
const W = 960, H = 540;

const PAPER = '#fbfbf7';
const BLUE = '#7c8fe2';
const GUIDE = '#e8a0a0';
const GRAPHITE = '#5a5a60';
const BOIL_HZ = 8;
const VIS = 1.18;                 // 인물 표시 배율 (판정 좌표는 그대로)
M.VIS = VIS;

// ── 결정적 흔들림 ──
let SEED = 1, CNT = 0, SEGS = 0;
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15;
  return ((n >>> 0) % 20000) / 10000 - 1;
}
function nz() { CNT++; return hash((SEED * 7919 + CNT * 104729) | 0); }
function beginBoil(seed) { SEED = seed | 0; CNT = 0; }

// 러프 선 한 획 — 양끝이 살짝 삐져나가고 가운데가 휜다. 긴 획은 옅은 두 번째 획을 겹친다
function line(c, x1, y1, x2, y2, w, amp, double) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const a = amp == null ? 1.2 : amp;
  const o1 = nz() * 1.8, o2 = nz() * 1.8;
  const ax = x1 - ux * o1, ay = y1 - uy * o1, bx = x2 + ux * o2, by = y2 + uy * o2;
  const m = nz() * a * (0.5 + Math.min(1, len / 60));
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(ax + nx * nz() * 0.5, ay + ny * nz() * 0.5);
  c.quadraticCurveTo((ax + bx) / 2 + nx * m, (ay + by) / 2 + ny * m, bx, by);
  c.stroke();
  SEGS += 2;
  if (double !== false && len > 34) {
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.42;
    c.lineWidth = w * 0.7;
    const s = nz() * 1.1;
    c.beginPath();
    c.moveTo(ax + nx * s, ay + ny * s);
    c.quadraticCurveTo((ax + bx) / 2 + nx * (m * 0.6 + s), (ay + by) / 2 + ny * (m * 0.6 + s), bx + nx * s, by + ny * s);
    c.stroke();
    c.globalAlpha = ga;
    SEGS += 2;
  }
}
function ellipse(c, cx, cy, rx, ry, w, n) {
  const k = n || 12;
  const start = nz() * 0.5;
  c.lineWidth = w;
  c.beginPath();
  for (let i = 0; i <= k; i++) {
    const ang = start + (i / k) * Math.PI * 2.08;
    const r = 1 + nz() * 0.06;
    const px = cx + Math.cos(ang) * rx * r, py = cy + Math.sin(ang) * ry * r;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.stroke();
  SEGS += k;
}
function poly(c, pts, w) { for (let i = 0; i < pts.length - 1; i++) line(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, 0.8, false); }
function sketchText(c, text, x, y, size, ink, rot, width) {
  c.save();
  c.translate(x, y);
  c.rotate(rot || 0);
  c.font = `900 ${size}px 'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.strokeStyle = ink;
  c.lineJoin = 'round';
  c.lineWidth = width || Math.max(1.6, size / 22);
  c.strokeText(text, nz() * 0.8, nz() * 0.8);
  c.globalAlpha *= 0.45;
  c.lineWidth *= 0.7;
  c.strokeText(text, 1.4 + nz(), -1.2 + nz());
  c.restore();
  SEGS += text.length * 3;
}

M.Render = {
  cv: null, ctx: null, res: 1, bg: [], fx: [], shake: 0, flash: 0,
  stats: { segments: 0 },

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const s = Math.max(0.3, Math.min(window.innerWidth / W, window.innerHeight / H) * 0.99);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);          // 설계 7절: 화면 배율 상한 2
    this.res = Math.max(0.5, s * dpr);
    this.cv.width = Math.round(W * this.res);
    this.cv.height = Math.round(H * this.res);
    this.buildBackground();
  },

  reset() { this.fx = []; this.shake = 0; this.flash = 0; },

  // ── 배경: 떨림 프레임 3장을 미리 그려 순환 (설계 7절) ──
  buildBackground() {
    this.bg = [];
    for (let i = 0; i < 3; i++) {
      const cv = document.createElement('canvas');
      cv.width = this.cv.width; cv.height = this.cv.height;
      const c = cv.getContext('2d');
      c.setTransform(this.res, 0, 0, this.res, 0, 0);
      this.paintArena(c, 101 + i * 37);
      this.bg.push(cv);
    }
  },

  paintArena(c, seed) {
    beginBoil(seed);
    c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
    c.lineCap = 'round';
    // 옅은 붉은 가이드선 (스토리보드 칸 나눔)
    c.strokeStyle = GUIDE; c.globalAlpha = 0.35;
    line(c, W * 0.33, 0, W * 0.335, H, 1, 0.4, false);
    line(c, W * 0.66, 0, W * 0.665, H, 1, 0.4, false);
    line(c, 0, H * 0.47, W, H * 0.465, 1, 0.4, false);
    line(c, 0, H * 0.9, W, H * 0.905, 1, 0.4, false);
    c.globalAlpha = 1;

    c.strokeStyle = BLUE;
    const post = 480;
    // 뒷벽 격자 — 두 벽면이 코너 기둥에서 만난다
    c.globalAlpha = 0.55;
    for (const x of [30, 150, 300, 630, 780, 920]) line(c, x + nz() * 4, -10, x + nz() * 6, 300 + nz() * 20, 1.8, 2);
    line(c, post - 2, -10, post, 150, 2.2, 1);
    for (const [y0, y1] of [[40, 90], [120, 160], [210, 232]]) {
      line(c, -20, y0, post, y1, 1.8, 3);
      line(c, post, y1, W + 20, y0, 1.8, 3);
    }
    line(c, -20, 12, W + 20, 8, 1.6, 3);
    // 코너 기둥
    c.globalAlpha = 0.8;
    line(c, post - 10, 150, post - 9, 332, 2.4, 1.2);
    line(c, post + 10, 150, post + 11, 332, 2.4, 1.2);
    line(c, post - 12, 150, post + 12, 148, 2, 0.8);
    // 로프 3줄씩 (기둥 → 화면 밖 앞쪽 코너)
    for (let k = 0; k < 3; k++) {
      const yb = 176 + k * 38, yf = 250 + k * 56;
      line(c, post - 10, yb, -30, yf, 2.4, 5);
      line(c, post + 10, yb, W + 30, yf, 2.4, 5);
    }
    // 링 바닥 가장자리와 판자선
    c.globalAlpha = 0.7;
    line(c, post, 334, -40, 452, 2.6, 4);
    line(c, post, 334, W + 40, 452, 2.6, 4);
    c.globalAlpha = 0.32;
    for (let k = 1; k <= 4; k++) {
      line(c, post - k * 70, 334 + k * 12, -40, 452 + k * 30, 1.6, 4);
      line(c, post + k * 70, 334 + k * 12, W + 40, 452 + k * 30, 1.6, 4);
    }
    for (let k = 0; k < 5; k++) line(c, 120 + k * 150 + nz() * 20, 380 + nz() * 10, 60 + k * 170 + nz() * 20, 540, 1.4, 3);
    // 앞쪽 에이프런·로프 (화면 아래)
    c.globalAlpha = 0.75;
    line(c, -30, 466, W + 30, 476, 2.8, 6);
    line(c, -30, 486, W + 30, 498, 2.6, 6);
    for (const x of [70, 560, 890]) { line(c, x, 470, x + 4, 500, 2.2, 1); line(c, x + 38, 471, x + 40, 500, 2.2, 1); }
    c.globalAlpha = 1;
  },

  // ── 이벤트 → 효과 ──
  addFx(e, st) {
    const inkOf = (side) => (st && st.p[side] ? st.p[side].def.ink : '#222');
    switch (e.type) {
      case 'hit': {
        const y = M.FLOOR - e.y * VIS;
        this.fx.push({ kind: 'spark', x: e.x, y, t: 0, life: 0.28, ink: inkOf(e.side), strong: e.strong, seed: (Math.random() * 1e6) | 0 });
        const words = e.isSuper ? ['쾅!!', '콰광!', '빠악!'] : e.strong ? ['쾅!', '퍽!!', '빡!'] : ['퍽', '탁', '팍'];
        this.fx.push({ kind: 'text', x: e.x + (Math.random() - 0.5) * 40, y: y - 40, t: 0, life: 0.5, ink: inkOf(e.side), text: words[(Math.random() * 3) | 0], size: e.strong ? 46 : 32, rot: (Math.random() - 0.5) * 0.5 });
        if (e.strong) this.shake = Math.max(this.shake, 0.18);
        if (e.combo >= 2) this.fx.push({ kind: 'combo', side: e.side, n: e.combo, t: 0, life: 0.9, ink: inkOf(e.side) });
        break;
      }
      case 'block':
        this.fx.push({ kind: 'guard', x: e.x, y: M.FLOOR - e.y * VIS, t: 0, life: 0.22, ink: GRAPHITE, dir: st ? -st.p[e.side].face : 1 });
        this.fx.push({ kind: 'text', x: e.x, y: M.FLOOR - e.y * VIS - 36, t: 0, life: 0.35, ink: GRAPHITE, text: '탁', size: 24, rot: 0 });
        break;
      case 'land': if (e.heavy) this.fx.push({ kind: 'dust', x: e.x, t: 0, life: 0.35, ink: GRAPHITE }); break;
      case 'teleport': this.fx.push({ kind: 'poof', x: e.x, t: 0, life: 0.45, ink: inkOf(e.side) }); break;
      case 'super': this.flash = 0.4; this.flashSide = e.side; this.fx.push({ kind: 'text', x: W / 2, y: 150, t: 0, life: 0.9, ink: inkOf(e.side), text: e.name, size: 40, rot: -0.04 }); break;
      case 'special': this.fx.push({ kind: 'text', x: st ? st.p[e.side].x : W / 2, y: 190, t: 0, life: 0.7, ink: inkOf(e.side), text: e.name, size: 24, rot: 0 }); break;
      case 'grab': this.fx.push({ kind: 'text', x: e.x, y: 250, t: 0, life: 0.6, ink: inkOf(e.side), text: e.command ? '파일 드라이버!' : '잡았다!', size: 30, rot: 0.05 }); break;
      case 'clash': this.fx.push({ kind: 'spark', x: e.x, y: M.FLOOR - 92, t: 0, life: 0.25, ink: GRAPHITE, strong: false, seed: 7 }); break;
      case 'wallsplat': this.fx.push({ kind: 'text', x: e.x, y: 230, t: 0, life: 0.6, ink: '#d6282e', text: '쿵!', size: 44, rot: 0.1 }); break;
    }
  },

  // ── 캐릭터 ──
  // opt: { floor, limit(획 수 제한 — 엔딩 그려지는 연출), ink }
  drawFighter(c, f, pose, opt) {
    const o = opt || {};
    const def = f.def;
    const ink = o.ink || def.ink;
    const sx = def.sx || 1, sy = def.sy || 1, face = f.face;
    const floor = o.floor != null ? o.floor : M.FLOOR;
    const k = o.scale || VIS;
    const P = {};
    for (const j of M.JOINTS) P[j] = [f.x + pose[j][0] * face * sx * k, floor - f.y * k - pose[j][1] * sy * k];
    let strokes = 0;
    const lim = o.limit == null ? 1e9 : o.limit;
    const ok = () => (strokes++ < lim);
    c.strokeStyle = ink;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const w = 2.3 * k;

    const limb = (A, B, wa, wb) => {
      const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      wa *= k * sx; wb *= k * sx;
      if (ok()) line(c, A[0] + nx * wa, A[1] + ny * wa, B[0] + nx * wb, B[1] + ny * wb, w, 1);
      if (ok()) line(c, A[0] - nx * wa, A[1] - ny * wa, B[0] - nx * wb, B[1] - ny * wb, w, 1);
    };
    const hand = (A, r) => { if (ok()) ellipse(c, A[0], A[1], (r || 4.5) * k, (r || 4.5) * k, w * 0.9, 6); };
    const foot = (A) => { if (ok()) line(c, A[0] - face * 6 * k, A[1], A[0] + face * 11 * k, A[1] + 1, w, 0.5, false); };

    // 뒷다리 · 뒷팔 — 스토리보드 관례대로 뒤쪽 팔다리는 옅게 그려 앞뒤를 가른다
    const baseAlpha = c.globalAlpha;
    c.globalAlpha = baseAlpha * 0.5;
    limb(P.hip, P.kB, 9, 7); limb(P.kB, P.fB, 7, 5); foot(P.fB);
    limb(P.sB, P.eB, 6.5, 5.5); limb(P.eB, P.hB, 5.5, 4);
    if (def.style === 'boxer') { if (ok()) ellipse(c, P.hB[0], P.hB[1], 9 * k, 9 * k, w, 8); } else hand(P.hB);
    c.globalAlpha = baseAlpha;

    // 몸통 (목~엉덩이 윤곽 두 줄 + 옷깃·허리선)
    {
      const vx = P.neck[0] - P.hip[0], vy = P.neck[1] - P.hip[1], len = Math.hypot(vx, vy) || 1;
      const nx = -vy / len, ny = vx / len;
      const tw = 16 * k * sx, bw = 13 * k * sx;
      if (def.style === 'sumo') {
        const mx = (P.chest[0] + P.hip[0]) / 2 + face * 6, my = (P.chest[1] + P.hip[1]) / 2 + 4;
        if (ok()) ellipse(c, mx, my, 30 * k, 30 * k, w, 14);
      } else {
        if (ok()) line(c, P.neck[0] + nx * tw, P.neck[1] + ny * tw, P.hip[0] + nx * bw, P.hip[1] + ny * bw, w, 1.4);
        if (ok()) line(c, P.neck[0] - nx * tw, P.neck[1] - ny * tw, P.hip[0] - nx * bw, P.hip[1] - ny * bw, w, 1.4);
      }
      if (ok()) line(c, P.hip[0] + nx * bw * 1.1, P.hip[1] + ny * bw * 1.1, P.hip[0] - nx * bw * 1.1, P.hip[1] - ny * bw * 1.1, w * 1.1, 0.6, false);
      this.torsoDeco(c, def.style, P, face, k, w, nx, ny, ok);
    }

    // 앞다리
    limb(P.hip, P.kF, 9, 7); limb(P.kF, P.fF, 7, 5); foot(P.fF);
    // 머리
    const hx = P.head[0], hy = P.head[1];
    if (ok()) ellipse(c, hx, hy, 13 * k, 15 * k, w, 12);
    this.headDeco(c, def.style, hx, hy, face, k, w, P, ok);
    // 앞팔
    limb(P.sF, P.eF, 6.5, 5.5); limb(P.eF, P.hF, 5.5, 4);
    if (def.style === 'boxer') { if (ok()) ellipse(c, P.hF[0], P.hF[1], 9 * k, 9 * k, w, 8); } else hand(P.hF);
    if (def.style === 'sensei' || o.pencil) this.pencil(c, P, face, k, ok);
    // 발밑 그림자 — 가로 선 몇 줄
    if (!o.noShadow && ok()) {
      const gy = floor + 3;
      const sw = (f.y > 0 ? 18 : 30) * k * sx;
      c.globalAlpha = 0.55;
      line(c, f.x - sw, gy, f.x + sw, gy + 1, w * 0.9, 0.6, false);
      line(c, f.x - sw * 0.6, gy + 5, f.x + sw * 0.7, gy + 5, w * 0.7, 0.6, false);
      c.globalAlpha = 1;
    }
    return strokes;
  },

  torsoDeco(c, style, P, face, k, w, nx, ny, ok) {
    const hip = P.hip, neck = P.neck, chest = P.chest;
    switch (style) {
      case 'mogu': case 'tkd': {
        // 도복 옷깃 V + 띠 꼬리
        if (ok()) line(c, neck[0] + nx * 10 * k, neck[1] + ny * 10 * k, chest[0] + face * 4 * k, chest[1] + 6 * k, w * 0.9, 0.6, false);
        if (ok()) line(c, neck[0] - nx * 10 * k, neck[1] - ny * 10 * k, chest[0] + face * 4 * k, chest[1] + 6 * k, w * 0.9, 0.6, false);
        if (ok()) line(c, hip[0] + face * 4 * k, hip[1] + 2, hip[0] + face * 9 * k, hip[1] + 18 * k, w * 1.3, 0.6, false);
        if (ok()) line(c, hip[0] + face * 1 * k, hip[1] + 2, hip[0] - face * 2 * k, hip[1] + 17 * k, w * 1.3, 0.6, false);
        if (style === 'mogu' && ok()) {           // 고양이 꼬리
          c.lineWidth = w; c.beginPath();
          c.moveTo(hip[0] - face * 10 * k, hip[1] - 2 * k);
          c.quadraticCurveTo(hip[0] - face * (40 + nz() * 3) * k, hip[1] + 4 * k, hip[0] - face * 38 * k, hip[1] - 34 * k);
          c.stroke(); SEGS += 2;
        }
        break;
      }
      case 'bboy': {
        if (ok()) line(c, chest[0] - 10 * k, chest[1] + 26 * k, chest[0] + 10 * k, chest[1] + 26 * k, w, 0.6, false);   // 후드티 주머니
        if (ok()) line(c, neck[0] + face * 5 * k, neck[1] + 4, neck[0] + face * 6 * k, neck[1] + 11 * k, w * 0.8, 0.3, false);
        if (ok()) line(c, neck[0] - face * 1 * k, neck[1] + 4, neck[0] - face * 0 * k, neck[1] + 10 * k, w * 0.8, 0.3, false);
        if (ok()) line(c, P.kF[0] + face * 10 * k, P.kF[1], P.fF[0] + face * 11 * k, P.fF[1] - 6 * k, w, 1.5);          // 헐렁한 바지
        if (ok()) line(c, P.kB[0] - face * 10 * k, P.kB[1], P.fB[0] - face * 11 * k, P.fB[1] - 6 * k, w, 1.5);
        break;
      }
      case 'kkokko': {
        for (let i = 0; i < 3; i++) if (ok()) line(c, hip[0] - face * 8 * k, hip[1] - i * 6 * k, hip[0] - face * (30 + i * 4) * k, hip[1] - (22 + i * 10) * k, w, 0.8, false);
        for (const [e, h] of [[P.eF, P.hF], [P.eB, P.hB]]) if (ok()) line(c, e[0], e[1], e[0] - face * 16 * k, e[1] + 12 * k, w * 0.9, 0.6, false);
        break;
      }
      case 'boxer': case 'wrestler': {
        if (ok()) line(c, P.kF[0] - 6 * k, hip[1] + 26 * k, P.kB[0] + 6 * k, hip[1] + 26 * k, w, 0.8, false);    // 트렁크 밑단
        if (style === 'wrestler') {
          if (ok()) ellipse(c, P.sF[0], P.sF[1], 12 * k, 9 * k, w, 8);
          if (ok()) ellipse(c, P.sB[0], P.sB[1], 12 * k, 9 * k, w, 8);
        }
        break;
      }
      case 'sumo': {
        if (ok()) line(c, hip[0] - 22 * k, hip[1] - 4 * k, hip[0] + 22 * k, hip[1] - 2 * k, w * 1.6, 0.6, false);    // 마와시
        if (ok()) line(c, hip[0] + face * 4 * k, hip[1], hip[0] + face * 6 * k, hip[1] + 20 * k, w * 1.4, 0.6, false);
        break;
      }
      case 'ninja': {
        if (ok()) { c.lineWidth = w; c.beginPath(); c.moveTo(neck[0], neck[1]); c.quadraticCurveTo(neck[0] - face * 30 * k, neck[1] - 6 * k + nz() * 4, neck[0] - face * 52 * k, neck[1] + 10 * k + nz() * 6); c.stroke(); SEGS += 2; }
        break;
      }
      case 'sensei': {
        if (ok()) line(c, hip[0] + face * 14 * k, hip[1], P.kF[0] + face * 16 * k, P.kF[1] - 6 * k, w, 1.2);           // 도포 자락
        if (ok()) line(c, hip[0] - face * 14 * k, hip[1], P.kB[0] - face * 16 * k, P.kB[1] - 6 * k, w, 1.2);
        break;
      }
    }
  },

  headDeco(c, style, hx, hy, face, k, w, P, ok) {
    const f = face;
    const earTri = (bx) => { if (ok()) poly(c, [[hx + bx - 5 * k, hy - 9 * k], [hx + bx - 3 * k, hy - 24 * k], [hx + bx + 6 * k, hy - 12 * k]], w); };
    const ratEars = () => { if (ok()) ellipse(c, hx - 8 * k, hy - 14 * k, 5 * k, 5 * k, w, 6); if (ok()) ellipse(c, hx + 7 * k, hy - 15 * k, 5 * k, 5 * k, w, 6); };
    const snout = () => { if (ok()) line(c, hx + f * 11 * k, hy + 1 * k, hx + f * 20 * k, hy + 5 * k, w, 0.4, false); };
    const brow = () => { if (ok()) line(c, hx + f * 2 * k, hy - 4 * k, hx + f * 10 * k, hy - 1 * k, w, 0.3, false); };
    switch (style) {
      case 'mogu':
        earTri(-5 * k); earTri(9 * k);
        for (let i = 0; i < 3; i++) if (ok()) line(c, hx - 2 * k + i * 3 * k, hy - 13 * k, hx - 4 * k + i * 5 * k, hy - 21 * k - (i % 2) * 3 * k, w * 0.9, 0.3, false);   // 삐죽 머리 (참고 영상 오마주)
        brow();
        if (ok()) line(c, hx + f * 10 * k, hy + 4 * k, hx + f * 23 * k, hy + 2 * k, w * 0.7, 0.3, false);    // 수염
        if (ok()) line(c, hx + f * 10 * k, hy + 7 * k, hx + f * 22 * k, hy + 9 * k, w * 0.7, 0.3, false);
        break;
      case 'bboy':
        // 참고 영상의 빨간 후드 — 머리를 감싸는 큰 윤곽 + 앞챙
        if (ok()) ellipse(c, hx - f * 4 * k, hy - 2 * k, 19 * k, 21 * k, w, 12);
        if (ok()) line(c, hx + f * 12 * k, hy - 12 * k, hx + f * 21 * k, hy - 4 * k, w, 0.5, false);
        snout();
        break;
      case 'kkokko':
        for (let i = 0; i < 3; i++) if (ok()) ellipse(c, hx - 6 * k + i * 6 * k, hy - 17 * k - (i === 1 ? 3 : 0) * k, 3.5 * k, 4.5 * k, w * 0.9, 6);
        if (ok()) poly(c, [[hx + f * 11 * k, hy - 3 * k], [hx + f * 24 * k, hy + 2 * k], [hx + f * 11 * k, hy + 6 * k]], w);
        brow();
        break;
      case 'boxer': ratEars(); snout(); brow(); break;
      case 'tkd':
        ratEars(); snout();
        if (ok()) line(c, hx - 13 * k, hy - 6 * k, hx + 13 * k, hy - 8 * k, w * 1.1, 0.4, false);           // 머리띠
        if (ok()) line(c, hx - f * 13 * k, hy - 7 * k, hx - f * 32 * k, hy - 2 * k + nz() * 3, w * 0.9, 1.2, false);
        break;
      case 'sumo':
        ratEars(); snout();
        if (ok()) ellipse(c, hx - f * 2 * k, hy - 19 * k, 5 * k, 4 * k, w, 6);                              // 상투
        break;
      case 'ninja':
        ratEars();
        if (ok()) line(c, hx - 12 * k, hy + 2 * k, hx + 13 * k, hy + 1 * k, w, 0.3, false);                  // 복면
        for (let i = 0; i < 3; i++) if (ok()) line(c, hx - 6 * k + i * 6 * k, hy + 5 * k, hx - 9 * k + i * 6 * k, hy + 12 * k, w * 0.7, 0.2, false);
        if (ok()) line(c, hx - f * 12 * k, hy - 6 * k, hx - f * 36 * k, hy - 10 * k + nz() * 4, w * 0.9, 1.5, false);
        break;
      case 'wrestler':
        if (ok()) ellipse(c, hx + f * 4 * k, hy - 3 * k, 3.5 * k, 2.5 * k, w * 0.8, 6);
        if (ok()) ellipse(c, hx + f * 9 * k, hy - 3 * k, 3.5 * k, 2.5 * k, w * 0.8, 6);
        if (ok()) line(c, hx - f * 2 * k, hy - 15 * k, hx + f * 2 * k, hy + 13 * k, w, 0.5, false);          // 마스크 줄무늬
        break;
      case 'sensei':
        if (ok()) ellipse(c, hx + f * 5 * k, hy - 2 * k, 4 * k, 4 * k, w * 0.8, 6);
        if (ok()) ellipse(c, hx + f * 13 * k, hy - 2 * k, 4 * k, 4 * k, w * 0.8, 6);
        for (let i = 0; i < 3; i++) if (ok()) line(c, hx + f * (2 + i * 4) * k, hy + 10 * k, hx + f * (0 + i * 5) * k, hy + 26 * k, w * 0.8, 0.8, false);
        if (ok()) ellipse(c, hx - f * 3 * k, hy - 18 * k, 5 * k, 4 * k, w, 6);
        break;
    }
  },

  pencil(c, P, face, k, ok) {
    const dx = P.hF[0] - P.eF[0], dy = P.hF[1] - P.eF[1], len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const L = 58 * k, r = 4.5 * k;
    const bx = P.hF[0] - ux * 12 * k, by = P.hF[1] - uy * 12 * k;
    const tx = bx + ux * L, ty = by + uy * L;
    c.save();
    c.strokeStyle = GRAPHITE;
    if (ok()) line(c, bx + nx * r, by + ny * r, tx + nx * r, ty + ny * r, 2, 0.4, false);
    if (ok()) line(c, bx - nx * r, by - ny * r, tx - nx * r, ty - ny * r, 2, 0.4, false);
    if (ok()) poly(c, [[tx + nx * r, ty + ny * r], [tx + ux * 13 * k, ty + uy * 13 * k], [tx - nx * r, ty - ny * r]], 2);
    if (ok()) line(c, bx + nx * r, by + ny * r, bx - nx * r, by - ny * r, 2, 0.3, false);
    c.restore();
  },

  // ── 기탄 · 함정 · 지우개 ──
  drawProjectile(c, p, st, t) {
    const ink = st.p[p.owner].def.ink;
    const x = p.x, y = M.FLOOR - p.y * VIS;
    c.strokeStyle = ink;
    if (p.kind === 'shuriken') {
      const a = p.age * 18;
      for (let i = 0; i < 4; i++) {
        const ang = a + i * Math.PI / 2;
        line(c, x, y, x + Math.cos(ang) * 11, y + Math.sin(ang) * 11, 2, 0.4, false);
      }
      ellipse(c, x, y, 3, 3, 1.6, 6);
    } else {
      const r = p.isSuper ? 24 : 16;
      ellipse(c, x, y, r, r * 0.9, 2.4, 12);
      ellipse(c, x + nz() * 2, y, r * 0.62, r * 0.55, 2, 10);
      ellipse(c, x, y, r * 0.25, r * 0.25, 1.8, 6);
      const back = -Math.sign(p.vx);
      for (let i = 0; i < 4; i++) line(c, x + back * (r + 4), y - 12 + i * 8, x + back * (r + 26 + nz() * 8), y - 12 + i * 8, 1.8, 0.5, false);
    }
  },

  drawHazard(c, h, st, t) {
    const ink = st.p[h.owner].def.ink;
    c.strokeStyle = ink;
    if (h.kind === 'trap') {
      const y = M.FLOOR + 2;
      if (h.t < h.arm) {
        c.globalAlpha = 0.5 + 0.4 * Math.sin(h.t * 30);
        for (let i = 0; i < 5; i++) {
          const x0 = h.x - h.width / 2 + i * (h.width / 5);
          line(c, x0, y, x0 + h.width / 8, y, 2, 0.3, false);
        }
        c.globalAlpha = 1;
      } else {
        const pts = [];
        for (let i = 0; i <= 8; i++) pts.push([h.x - h.width / 2 + i * h.width / 8, y - (i % 2 ? 36 : 0)]);
        poly(c, pts, 2.4);
      }
    } else if (h.kind === 'wall') {
      const top = M.FLOOR - 170;
      c.globalAlpha = Math.min(1, (h.life - h.t) * 2);
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push([h.x + (i % 2 ? 5 : -5), M.FLOOR - (i / 6) * 170]);
      poly(c, pts, 3);
      line(c, h.x + 9, M.FLOOR, h.x + 7, top, 1.6, 2);
      for (let i = 0; i < 4; i++) line(c, h.x - 12, M.FLOOR - 30 - i * 36, h.x + 12, M.FLOOR - 42 - i * 36, 1.4, 0.3, false);
      c.globalAlpha = 1;
    }
  },

  drawEraser(c, f) {
    const mv = f.mv;
    if (!mv || mv.kind !== 'eraser' || mv.front == null) return;
    const x0 = Math.min(f.x, mv.front), x1 = Math.max(f.x, mv.front);
    const top = M.FLOOR - 160;
    c.fillStyle = PAPER;
    c.fillRect(x0, top, x1 - x0, 165);                          // 지운 자리 = 종이색
    c.strokeStyle = GRAPHITE;
    line(c, x0, top, x1, top, 1.6, 2);
    line(c, x0, M.FLOOR + 5, x1, M.FLOOR + 5, 1.6, 2);
    const fx = mv.front;
    ellipse(c, fx, M.FLOOR - 80, 22, 70, 2.4, 12);               // 지우개 덩어리
    for (let i = 0; i < 8; i++) {
      const ex = fx - f.face * (10 + Math.abs(nz()) * 60), ey = M.FLOOR - 150 + Math.abs(nz()) * 150;
      line(c, ex, ey, ex + 4, ey + 2, 2, 0.2, false);
    }
  },

  drawFx(c, dt) {
    const keep = [];
    for (const e of this.fx) {
      e.t += dt;
      if (e.t > e.life) continue;
      keep.push(e);
      const k = e.t / e.life;
      c.strokeStyle = e.ink;
      c.globalAlpha = 1 - k * 0.8;
      switch (e.kind) {
        case 'spark': {
          const n = e.strong ? 12 : 8;
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + hash(e.seed + i) * 0.3;
            const r0 = 6 + k * 14, r1 = (e.strong ? 30 : 20) + hash(e.seed * 3 + i) * 10 + k * 18;
            line(c, e.x + Math.cos(ang) * r0, e.y + Math.sin(ang) * r0, e.x + Math.cos(ang) * r1, e.y + Math.sin(ang) * r1, 2.2, 0.3, false);
          }
          if (e.strong) ellipse(c, e.x, e.y, 18 + k * 16, 14 + k * 12, 1.8, 10);
          break;
        }
        case 'guard':
          for (let i = 0; i < 3; i++) {
            c.lineWidth = 2; c.beginPath();
            c.arc(e.x + e.dir * i * 7, e.y, 16 + i * 6, e.dir > 0 ? -1 : Math.PI - 1, e.dir > 0 ? 1 : Math.PI + 1);
            c.stroke(); SEGS += 3;
          }
          break;
        case 'text': sketchText(c, e.text, e.x, e.y - k * 20, e.size, e.ink, e.rot); break;
        case 'dust':
          for (let i = 0; i < 5; i++) line(c, e.x - 40 - k * 20 + i * 18, M.FLOOR - 2 - (i % 2) * 6, e.x - 30 - k * 20 + i * 18, M.FLOOR - 4 - (i % 2) * 6, 1.8, 0.2, false);
          break;
        case 'poof':
          for (let i = 0; i < 3; i++) ellipse(c, e.x + (i - 1) * 16, M.FLOOR - 70 - i * 12, 18 + k * 12, 14 + k * 10, 1.8, 10);
          break;
        case 'combo':
          sketchText(c, `${e.n} HIT`, e.side === 0 ? 170 : W - 170, 118, 30, e.ink, e.side === 0 ? -0.06 : 0.06);
          break;
      }
      c.globalAlpha = 1;
    }
    this.fx = keep;
  },

  // ── HUD (체력 바는 손으로 그린 사각형 안 사선 해칭) ──
  drawHUD(c, st, t) {
    const bw = 380, bx = [52, W - 52 - bw], by = 24, bh = 28;
    for (const side of [0, 1]) {
      const f = st.p[side];
      const ratio = Math.max(0, f.hp / f.maxHp);
      f.ghost = f.ghost == null ? ratio : Math.max(ratio, f.ghost - 0.35 * (1 / 60));
      const x0 = bx[side];
      c.strokeStyle = f.def.ink;
      line(c, x0, by, x0 + bw, by, 2.2, 0.8, false);
      line(c, x0, by + bh, x0 + bw, by + bh, 2.2, 0.8, false);
      line(c, x0, by, x0, by + bh, 2.2, 0.4, false);
      line(c, x0 + bw, by, x0 + bw, by + bh, 2.2, 0.4, false);
      const fill = (r0, r1, gap, alpha) => {
        const a = side === 0 ? x0 + bw * r0 : x0 + bw * (1 - r1);
        const b = side === 0 ? x0 + bw * r1 : x0 + bw * (1 - r0);
        if (b - a < 1) return;
        c.save();
        c.beginPath(); c.rect(a, by + 2, b - a, bh - 4); c.clip();
        c.globalAlpha = alpha;
        for (let x = a - bh; x < b + 4; x += gap) line(c, x, by + bh, x + bh, by, 1.6, 0.2, false);
        c.restore();
      };
      fill(0, ratio, 7, 0.95);
      if (f.ghost > ratio + 0.002) fill(ratio, f.ghost, 14, 0.4);
      sketchText(c, f.def.name, side === 0 ? x0 + 70 : x0 + bw - 70, by + bh + 20, 17, f.def.ink, 0, 1.4);
      // 라운드 승리 표시
      for (let i = 0; i < M.ROUNDS_TO_WIN; i++) {
        const cx = side === 0 ? x0 + bw - 12 - i * 22 : x0 + 12 + i * 22, cy = by + bh + 18;
        ellipse(c, cx, cy, 7, 7, 1.8, 8);
        if (st.wins[side] > i) { line(c, cx - 5, cy - 5, cx + 5, cy + 5, 2, 0.2, false); line(c, cx + 5, cy - 5, cx - 5, cy + 5, 2, 0.2, false); }
      }
      // 필살 게이지
      const gw = 220, gx = side === 0 ? 52 : W - 52 - gw, gy = 512, gh = 14;
      c.strokeStyle = f.def.ink;
      line(c, gx, gy, gx + gw, gy, 1.8, 0.5, false);
      line(c, gx, gy + gh, gx + gw, gy + gh, 1.8, 0.5, false);
      line(c, gx, gy, gx, gy + gh, 1.8, 0.2, false);
      line(c, gx + gw, gy, gx + gw, gy + gh, 1.8, 0.2, false);
      const gr = f.gauge / M.GAUGE_MAX;
      if (gr > 0) {
        c.save();
        const ga = side === 0 ? gx : gx + gw * (1 - gr);
        c.beginPath(); c.rect(ga, gy + 2, gw * gr, gh - 4); c.clip();
        for (let x = ga - gh; x < ga + gw * gr + 4; x += 6) { line(c, x, gy + gh, x + gh, gy, 1.4, 0.1, false); }
        if (gr >= 1) for (let x = ga; x < ga + gw; x += 6) line(c, x, gy, x + gh, gy + gh, 1.2, 0.1, false);
        c.restore();
      }
      const label = f.gauge >= M.GAUGE_MAX ? (Math.floor(t * 4) % 2 ? 'MAX!' : '') : '필살';
      if (label) sketchText(c, label, side === 0 ? gx + gw + 36 : gx - 36, gy + 8, 16, f.def.ink, 0, 1.3);
    }
    // 타이머
    c.strokeStyle = '#222';
    ellipse(c, W / 2, 44, 30, 26, 2.2, 12);
    sketchText(c, String(Math.ceil(st.timer)), W / 2, 45, 30, '#222', 0, 1.8);
    sketchText(c, `도전자 ${st.stage + 1}/8`, W / 2, 88, 14, GRAPHITE, 0, 1.1);
  },

  drawBanner(c, st, t) {
    const ph = st.phase;
    if (ph === 'intro') {
      const first = st.introLen >= M.INTRO_FIRST - 1e-6;
      const def = st.p[1].def;
      if (first && st.phaseT < 1.2) {
        const k = Math.min(1, st.phaseT / 0.25);
        c.save();
        c.globalAlpha = k;
        c.fillStyle = PAPER; c.fillRect(250, 120 - (1 - k) * 30, 460, 220);
        c.strokeStyle = '#333';
        line(c, 250, 120, 710, 118, 2.2, 2); line(c, 250, 340, 710, 342, 2.2, 2);
        line(c, 250, 120, 252, 340, 2.2, 1); line(c, 710, 118, 708, 342, 2.2, 1);
        line(c, 262, 132, 698, 130, 1.2, 2);
        sketchText(c, `도전자 ${st.stage + 1}`, 480, 170, 26, GRAPHITE, -0.02, 1.6);
        sketchText(c, def.name, 480, 228, 52, def.ink, -0.03, 2.4);
        sketchText(c, def.trait, 480, 290, 20, GRAPHITE, 0, 1.3);
        c.restore();
        return;
      }
      const remain = st.introLen - st.phaseT;
      if (remain > 0.45) sketchText(c, `ROUND ${st.round}`, W / 2, 220, 70, '#222', -0.04, 3);
      else sketchText(c, 'FIGHT!', W / 2, 220, 90, '#d6282e', -0.06, 3.4);
    } else if (ph === 'ko') {
      const text = st.p[0].hp > 0 && st.p[1].hp > 0 ? 'TIME UP' : 'K.O.';
      sketchText(c, text, W / 2, 210, 100, '#222', -0.05, 3.6);
      if (text === 'K.O.') { c.strokeStyle = '#222'; poly(c, [[300, 280], [360, 268], [420, 290], [490, 262], [560, 284], [650, 266]], 2.2); }
    } else if (ph === 'roundEnd' || ph === 'matchEnd') {
      const w = st.roundWinner;
      const text = w === 'draw' ? '무승부' : `${st.p[w].def.name} 승!`;
      sketchText(c, text, W / 2, 210, 54, w === 'draw' ? '#222' : st.p[w].def.ink, -0.03, 2.4);
    }
  },

  drawFlash(c, dt) {
    if (this.flash <= 0) return;
    this.flash -= dt;
    const k = 1 - this.flash / 0.4;
    const dir = this.flashSide === 0 ? 1 : -1;
    const x = dir > 0 ? k * W * 1.2 - 60 : W - k * W * 1.2 + 60;
    c.fillStyle = PAPER;
    if (dir > 0) c.fillRect(-10, 0, x + 10, H); else c.fillRect(x, 0, W - x + 10, H);
    c.strokeStyle = '#333';
    line(c, x, -10, x - dir * 20, H + 10, 2.6, 2);
    poly(c, [[x, H - 120], [x - dir * 70, H], [x, H]], 2.2);                      // 넘어가는 종이 모서리
    for (let i = 0; i < 6; i++) line(c, x - dir * (10 + i * 8), H - 90 + i * 14, x - dir * (30 + i * 8), H - 90 + i * 14, 1.2, 0.2, false);
  },

  // ── 한 프레임 ──
  draw(st, now, dt) {
    const c = this.ctx;
    SEGS = 0;
    const boil = Math.floor(now * BOIL_HZ);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg[boil % 3], 0, 0);
    c.setTransform(this.res, 0, 0, this.res, 0, 0);
    c.lineCap = 'round'; c.lineJoin = 'round';

    // 화면 흔들림
    let sx = 0, sy = 0;
    if (this.shake > 0) { this.shake -= dt; sx = Math.sin(now * 90) * 4; sy = Math.cos(now * 70) * 3; }
    c.translate(sx, sy);

    beginBoil(boil * 13 + 5);
    for (const h of st.haz) this.drawHazard(c, h, st, now);
    // 뒤에 있는 캐릭터(행동 중이 아닌 쪽)를 먼저
    const order = st.p.slice().sort((a, b) => (a.mv ? 1 : 0) - (b.mv ? 1 : 0));
    for (const f of order) {
      beginBoil(boil * 31 + f.side * 977 + 11);
      if (f.invuln > 0 && f.state === 'idle' && Math.floor(now * 20) % 2) c.globalAlpha = 0.45;
      this.drawFighter(c, f, M.poseOf(f, now), {});
      c.globalAlpha = 1;
      this.drawEraser(c, f);
    }
    beginBoil(boil * 17 + 3);
    for (const p of st.proj) this.drawProjectile(c, p, st, now);
    this.drawFx(c, dt);
    c.translate(-sx, -sy);
    this.drawFlash(c, dt);
    beginBoil(boil * 7 + 1);
    this.drawHUD(c, st, now);
    this.drawBanner(c, st, now);
    this.stats.segments = SEGS;
  },

  // ── 타이틀 미리보기 (작은 캔버스) ──
  drawPreview(cv, now) {
    const c = cv.getContext('2d');
    const cw = cv.width, ch = cv.height, s = cw / 420;
    SEGS = 0;
    c.setTransform(s, 0, 0, s, 0, 0);
    c.fillStyle = PAPER; c.fillRect(0, 0, 420, 220);
    const boil = Math.floor(now * BOIL_HZ);
    beginBoil(boil * 5 + 2);
    c.strokeStyle = BLUE; c.globalAlpha = 0.6;
    line(c, 210, 10, 211, 130, 1.8, 1);
    for (let k = 0; k < 2; k++) { line(c, 210, 60 + k * 26, -10, 110 + k * 40, 1.8, 3); line(c, 210, 60 + k * 26, 430, 110 + k * 40, 1.8, 3); }
    line(c, 210, 132, -10, 196, 2, 3); line(c, 210, 132, 430, 196, 2, 3);
    c.globalAlpha = 1;
    const mk = (id, x, face, side) => ({ id, def: M.FIGHTERS[id], x, y: 0, face, side, state: 'idle', stT: now, inp: {}, vy: 0, vx: 0, invuln: 0 });
    const a = mk('mogu', 130, 1, 0), b = mk('bboy', 290, -1, 1);
    beginBoil(boil * 11 + 1);
    this.drawFighter(c, a, M.poseOf(a, now), { floor: 196, scale: 0.9 });
    beginBoil(boil * 11 + 7);
    this.drawFighter(c, b, M.poseOf(b, now), { floor: 196, scale: 0.9 });
  },

  // ── 엔딩: 모구가 연필을 빼앗아 사범을 그린다 ──
  drawEnding(now, t) {
    const c = this.ctx;
    const boil = Math.floor(now * BOIL_HZ);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg[boil % 3], 0, 0);
    c.setTransform(this.res, 0, 0, this.res, 0, 0);
    c.fillStyle = PAPER; c.globalAlpha = 0.75; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    const mogu = { id: 'mogu', def: M.FIGHTERS.mogu, x: 310, y: 0, face: 1, side: 0, state: 'idle', stT: t, inp: {}, vy: 0, invuln: 0 };
    beginBoil(boil * 3 + 1);
    const drawingPose = M.lerpPose(M.POSES.draw, M.POSES.push, 0.5 + 0.5 * Math.sin(t * 9));
    this.drawFighter(c, mogu, t < 1.2 ? M.POSES.win : drawingPose, { pencil: true });
    const sensei = { id: 'sensei', def: M.FIGHTERS.sensei, x: 640, y: 0, face: -1, side: 1, state: 'idle', stT: t, inp: {}, vy: 0, invuln: 0 };
    beginBoil(boil * 3 + 9);
    const limit = t < 1.2 ? 0 : Math.floor((t - 1.2) * 16);
    this.drawFighter(c, sensei, M.POSES.hit, { limit, noShadow: true });
    beginBoil(boil * 7 + 4);
    if (t > 0.2) sketchText(c, '연필은 이제 모구의 것!', W / 2, 110, 44, '#18181c', -0.03, 2.2);
    if (t > 3.2) sketchText(c, '도전자 8명 격파 — 스케치 마스터 모구', W / 2, 160, 26, '#d6282e', 0, 1.6);
  },
};
