// render.js — 2D 캔버스 유사3D 렌더 (아웃런 계열 세그먼트 투영)
// 배경은 월드별 실사 사진을 지평선에 맞춰 좌우 반전 타일링으로 흘리고,
// 도로는 원근 사다리꼴을 뒤에서 앞으로 쌓은 뒤 아스팔트 결을 덧입힌다.
// 교통 차량은 다이캐스트 미니카 사진의 후방 프레임을 쓴다.
const M = window.MRC;

const FOV = 100;
const CAM_H = 1250;                       // 카메라 높이 (월드 단위)
const DRAW_DIST = 260;                    // 전방 렌더 세그먼트 수
const FOG_DENSITY = 4.2;
// 스프라이트 크기는 투영된 도로 반폭 대비 비율로 잡는다 (해상도·거리에 자동 대응)
const SPRITE_W = 0.62;                    // 노변 물체 폭
// 차폭은 logic.js의 충돌 폭을 그대로 투영해 쓴다 (보이는 폭 = 부딪히는 폭)
const CAR_MAX_W = 0.34;                   // 교통 차량 최대 화면 폭 비율
const CAR_CULL_W = 0.62;                  // 이보다 커질 만큼 가까우면 그리지 않음 (옆을 스치는 중)
// 미등(=방향지시등) 위치 — 스프라이트를 굽는 쪽과 깜빡이를 얹는 쪽이 같은 값을 봐야
// 등이 차체에서 떠 보이지 않는다. 차체 높이 대비 비율.
const TAIL_Y = { sedan: 0.56, van: 0.60, truck: 0.745 };
const BLINK_HZ = 1.4;                     // 방향지시등 점멸 (실제 차 기준 ~1.5Hz)
const RAIL_X = 1.24;                      // 가드레일 위치 (갓길 줄무늬 1.14 바깥)

const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);

const lerp = (a, b, p) => a + (b - a) * p;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

// 반올림 없이 서브픽셀 그대로 둔다 — 픽셀 스냅은 저속에서 도로 가장자리·차량을 떨리게 한다
function project(p, camX, camY, camZ, w, h, roadW) {
  p.camera.x = (p.world.x || 0) - camX;
  p.camera.y = (p.world.y || 0) - camY;
  p.camera.z = (p.world.z || 0) - camZ;
  p.screen.scale = CAM_DEPTH / p.camera.z;
  p.screen.x = w / 2 + p.screen.scale * p.camera.x * w / 2;
  p.screen.y = h / 2 - p.screen.scale * p.camera.y * h / 2;
  p.screen.w = p.screen.scale * roadW * w / 2;
}

function poly(ctx, x1, y1, w1, x2, y2, w2, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2);
  ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1);
  ctx.closePath(); ctx.fill();
}

// ── 노변 스프라이트 굽기 ───────────────────────────────────────────────
function bakeSprite(type, theme) {
  const S = 128;
  const c = mkCanvas(S, S * 1.6), g = c.getContext('2d');
  const H = c.height;
  const trunk = (wRatio, hRatio, col) => {
    g.fillStyle = col;
    g.fillRect(S / 2 - S * wRatio / 2, H * (1 - hRatio), S * wRatio, H * hRatio);
  };
  if (type === 'pine' || type === 'snowpine') {
    trunk(0.09, 0.26, '#5a3f28');
    const dark = type === 'snowpine' ? '#2c5a48' : '#2f6b3a';
    const lit = type === 'snowpine' ? '#e8f2f8' : '#4a8f4c';
    for (let i = 0; i < 3; i++) {
      const yTop = H * (0.06 + i * 0.22), yBot = H * (0.42 + i * 0.22), wid = S * (0.34 + i * 0.16);
      g.fillStyle = dark;
      g.beginPath(); g.moveTo(S / 2, yTop); g.lineTo(S / 2 + wid, yBot); g.lineTo(S / 2 - wid, yBot); g.closePath(); g.fill();
      g.fillStyle = lit;
      g.beginPath(); g.moveTo(S / 2, yTop); g.lineTo(S / 2 + wid * 0.55, yBot); g.lineTo(S / 2, yBot); g.closePath(); g.fill();
    }
  } else if (type === 'bush') {
    g.fillStyle = theme.ground === '#eaf2fa' ? '#cfe0ee' : '#3c7a3e';
    g.beginPath(); g.ellipse(S / 2, H * 0.82, S * 0.36, H * 0.16, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.beginPath(); g.ellipse(S * 0.42, H * 0.77, S * 0.18, H * 0.07, 0, 0, Math.PI * 2); g.fill();
  } else if (type === 'rock') {
    g.fillStyle = theme.midC;
    g.beginPath(); g.moveTo(S * 0.14, H); g.lineTo(S * 0.3, H * 0.62); g.lineTo(S * 0.58, H * 0.55);
    g.lineTo(S * 0.86, H); g.closePath(); g.fill();
    g.fillStyle = theme.midLit;
    g.beginPath(); g.moveTo(S * 0.3, H * 0.62); g.lineTo(S * 0.58, H * 0.55); g.lineTo(S * 0.5, H); g.lineTo(S * 0.36, H); g.closePath(); g.fill();
  } else if (type === 'cactus') {
    g.fillStyle = '#3f7a44';
    g.fillRect(S * 0.43, H * 0.28, S * 0.14, H * 0.72);
    g.fillRect(S * 0.24, H * 0.5, S * 0.1, H * 0.16);
    g.fillRect(S * 0.24, H * 0.5, S * 0.28, H * 0.08);
    g.fillRect(S * 0.66, H * 0.42, S * 0.1, H * 0.2);
    g.fillRect(S * 0.56, H * 0.42, S * 0.2, H * 0.08);
  } else if (type === 'lamp') {
    g.fillStyle = '#8d949c';
    g.fillRect(S * 0.47, H * 0.1, S * 0.06, H * 0.9);
    g.fillRect(S * 0.2, H * 0.1, S * 0.33, H * 0.05);
    g.fillStyle = theme.night ? '#ffe6a8' : '#c8ced6';
    g.beginPath(); g.ellipse(S * 0.22, H * 0.15, S * 0.09, H * 0.035, 0, 0, Math.PI * 2); g.fill();
    if (theme.night) {
      const gl = g.createRadialGradient(S * 0.22, H * 0.17, 2, S * 0.22, H * 0.17, S * 0.5);
      gl.addColorStop(0, 'rgba(255,224,150,.55)'); gl.addColorStop(1, 'rgba(255,224,150,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(S * 0.22, H * 0.17, S * 0.5, 0, Math.PI * 2); g.fill();
    }
  } else if (type === 'sign') {
    g.fillStyle = '#7c848c'; g.fillRect(S * 0.46, H * 0.42, S * 0.08, H * 0.58);
    g.fillStyle = theme.night ? '#1d5a3a' : '#2a7a4a';
    g.fillRect(S * 0.12, H * 0.14, S * 0.76, H * 0.3);
    g.strokeStyle = '#eef4f8'; g.lineWidth = 3; g.strokeRect(S * 0.16, H * 0.18, S * 0.68, H * 0.22);
    g.fillStyle = '#eef4f8'; g.fillRect(S * 0.24, H * 0.26, S * 0.3, H * 0.05);
    g.fillRect(S * 0.24, H * 0.34, S * 0.44, H * 0.04);
  } else {                                             // building
    g.fillStyle = theme.midC; g.fillRect(S * 0.1, H * 0.06, S * 0.8, H * 0.94);
    g.fillStyle = theme.night ? 'rgba(255,214,140,.6)' : 'rgba(190,214,236,.65)';
    for (let y = H * 0.14; y < H * 0.9; y += H * 0.1) {
      for (let x = S * 0.18; x < S * 0.8; x += S * 0.16) g.fillRect(x, y, S * 0.09, H * 0.05);
    }
  }
  return c;
}

// ── 교통 차량 굽기 (후방 눈높이 뷰) ────────────────────────────────────
// 다이캐스트 사진 팩(24방향)은 전 프레임이 위에서 내려찍은 각도라, 추격 시점
// 도로에 붙이면 탑다운 차를 세워 둔 판처럼 보인다. 후방 뷰는 플레이어 차와
// 같은 방식으로 직접 그린다.
const TRAFFIC_HUES = [
  ['#c8443c', '#7e2a24'],   // 빨강
  ['#2f6fb8', '#1d4a80'],   // 파랑
  ['#e0a828', '#9a7314'],   // 노랑
  ['#3f9a5c', '#27663c'],   // 초록
  ['#8a5ac0', '#5c3a86'],   // 보라
  ['#d0ccc2', '#918c80'],   // 은색
];

function bakeTraffic(type, hue, night) {
  const W = 200, H = type === 'truck' ? 220 : type === 'van' ? 196 : 158;
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const rr = (x, y, w, h, r) => {
    g.beginPath(); g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath(); g.fill();
  };
  const [body, dark] = TRAFFIC_HUES[hue % TRAFFIC_HUES.length];
  const glass = night ? '#141a26' : '#3d4f66';

  g.fillStyle = 'rgba(0,0,0,.32)';                      // 접지 그림자
  g.beginPath(); g.ellipse(W / 2, H * 0.97, W * 0.47, H * 0.03, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#17181d';                              // 뒷바퀴
  rr(W * 0.02, H * 0.80, W * 0.15, H * 0.17, W * 0.03);
  rr(W * 0.83, H * 0.80, W * 0.15, H * 0.17, W * 0.03);

  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, body); grd.addColorStop(0.6, body); grd.addColorStop(1, dark);

  if (type === 'sedan') {
    g.fillStyle = grd;
    rr(W * 0.17, H * 0.04, W * 0.66, H * 0.50, W * 0.09);   // 캐빈
    rr(W * 0.05, H * 0.40, W * 0.90, H * 0.53, W * 0.06);   // 트렁크·펜더
    g.fillStyle = glass;                                     // 뒷유리
    rr(W * 0.22, H * 0.10, W * 0.56, H * 0.30, W * 0.05);
    g.fillStyle = 'rgba(255,255,255,.14)';
    rr(W * 0.24, H * 0.11, W * 0.20, H * 0.27, W * 0.04);
  } else if (type === 'van') {
    g.fillStyle = grd;
    rr(W * 0.06, H * 0.03, W * 0.88, H * 0.90, W * 0.07);   // 박스 차체
    g.fillStyle = glass;                                     // 뒷문 유리 2장
    rr(W * 0.13, H * 0.08, W * 0.34, H * 0.22, W * 0.03);
    rr(W * 0.53, H * 0.08, W * 0.34, H * 0.22, W * 0.03);
    g.strokeStyle = 'rgba(0,0,0,.30)';                       // 문 이음선
    g.lineWidth = Math.max(2, W * 0.012);
    g.beginPath(); g.moveTo(W * 0.5, H * 0.06); g.lineTo(W * 0.5, H * 0.84); g.stroke();
  } else {                                                   // truck
    g.fillStyle = '#b9b4a8';                                 // 컨테이너
    rr(W * 0.04, H * 0.02, W * 0.92, H * 0.72, W * 0.03);
    g.strokeStyle = 'rgba(0,0,0,.22)';
    g.lineWidth = Math.max(2, W * 0.01);
    for (let i = 1; i <= 3; i++) {                           // 롤도어 골
      g.beginPath(); g.moveTo(W * 0.09, H * (0.02 + 0.17 * i)); g.lineTo(W * 0.91, H * (0.02 + 0.17 * i)); g.stroke();
    }
    g.fillStyle = grd;                                       // 하부 섀시는 차체색
    rr(W * 0.05, H * 0.72, W * 0.90, H * 0.20, W * 0.03);
  }

  g.fillStyle = '#20232a';                                   // 범퍼
  rr(W * 0.06, H * 0.87, W * 0.88, H * 0.065, H * 0.02);

  const ly = H * TAIL_Y[type];
  if (night) {                                               // 야간: 미등 점등 글로우
    for (const lx of [W * 0.165, W * 0.835]) {
      const glow = g.createRadialGradient(lx, ly + H * 0.035, 2, lx, ly + H * 0.035, W * 0.15);
      glow.addColorStop(0, 'rgba(255,84,64,.6)'); glow.addColorStop(1, 'rgba(255,84,64,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(lx, ly + H * 0.035, W * 0.15, 0, Math.PI * 2); g.fill();
    }
  }
  g.fillStyle = night ? '#ff6a52' : '#b8322a';               // 미등
  rr(W * 0.10, ly, W * 0.13, H * 0.07, H * 0.018);
  rr(W * 0.77, ly, W * 0.13, H * 0.07, H * 0.018);
  g.fillStyle = '#e8e4da';                                   // 번호판
  rr(W * 0.42, ly + H * 0.02, W * 0.16, H * 0.06, H * 0.012);
  return c;
}

// ── 모구 레이서 굽기 (오픈탑 차체 + 모구 뒷모습 합성) ──────────────────
// 모구를 먼저 그리고 차체를 그 위에 덮어, 하반신이 차체에 가려 '앉아 있게' 만든다.
// 모구 머리 꼭대기를 헤드레스트(차체 최상단)와 같은 높이에 맞춰, 콕핏에 깊이 앉은 모습으로.
function bakeMogu(moguImg) {
  // 차체 위로는 머리와 어깨만 나오므로 스프라이트는 차체에 딱 맞게 잡는다 — 폭:높이 ≈ 1.58:1.
  const W = 380, H = 240;
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const round = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath(); g.fill();
  };

  const TOP = H * 0.106;                               // 차체 최상단(헤드레스트 꼭대기) = 모구 머리 높이
  const DECK = H * 0.374;                              // 차체 상면(모구가 잠기는 선)

  g.fillStyle = 'rgba(0,0,0,.34)';                     // 접지 그림자
  g.beginPath(); g.ellipse(W / 2, H * 0.952, W * 0.46, H * 0.055, 0, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#15161a';                             // 뒷바퀴 — 차체 밖으로 살짝만
  round(W * 0.005, H * 0.450, W * 0.155, H * 0.481, W * 0.035);
  round(W * 0.84, H * 0.450, W * 0.155, H * 0.481, W * 0.035);
  g.fillStyle = '#40454e';                             // 휠
  round(W * 0.03, H * 0.588, W * 0.105, H * 0.206, W * 0.02);
  round(W * 0.865, H * 0.588, W * 0.105, H * 0.206, W * 0.02);

  g.fillStyle = '#1c1e24';                             // 헤드레스트 — 꼭대기를 TOP에 맞춰 모구 머리와 같은 높이
  g.beginPath(); g.ellipse(W / 2, TOP + H * 0.234, W * 0.15, H * 0.234, 0, 0, Math.PI * 2); g.fill();

  if (moguImg && moguImg.width) {                      // 운전석의 모구 (뒷모습) — 머리 꼭대기를 TOP에 맞춘다
    // 원본에서 머리는 왼쪽으로 치우쳐 있어(가로 0.28 지점), 이미지가 아니라 머리를 차 중앙에 맞춘다.
    const mh = H * 1.10, mw = mh * (moguImg.width / moguImg.height);
    g.save();                                          // 차체 상면 아래는 콕핏 안 — 꼬리가 차 밑으로 삐져나오지 않게 자른다
    g.beginPath(); g.rect(0, 0, W, DECK); g.clip();
    g.drawImage(moguImg, W / 2 - mw * 0.28, TOP, mw, mh);
    g.restore();
  }

  // 차체 — 모구 몸통을 덮어 콕핏에 앉은 자세를 만든다. 아래로 갈수록 살짝 벌어지는 사다리꼴.
  const grd = g.createLinearGradient(0, DECK, 0, H * 0.931);
  grd.addColorStop(0, '#e05a45'); grd.addColorStop(0.45, '#c8402f'); grd.addColorStop(1, '#8e2a1e');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(W * 0.10, H * 0.931); g.lineTo(W * 0.185, DECK);
  g.lineTo(W * 0.815, DECK); g.lineTo(W * 0.90, H * 0.931);
  g.closePath(); g.fill();

  g.fillStyle = 'rgba(255,255,255,.30)';               // 상면 하이라이트
  g.fillRect(W * 0.19, DECK, W * 0.62, H * 0.048);
  g.fillStyle = '#23262c';                             // 사이드 포드
  round(W * 0.115, H * 0.5325, W * 0.075, H * 0.3025, W * 0.02);
  round(W * 0.81, H * 0.5325, W * 0.075, H * 0.3025, W * 0.02);

  g.fillStyle = '#1f2228';                             // 리어윙 (화면에 가장 가까운 요소)
  g.fillRect(W * 0.225, H * 0.4156, W * 0.035, H * 0.1375);
  g.fillRect(W * 0.74, H * 0.4156, W * 0.035, H * 0.1375);
  round(W * 0.14, DECK, W * 0.72, H * 0.0619, H * 0.0194);

  g.fillStyle = '#ff5f4d';                             // 미등
  round(W * 0.20, H * 0.663, W * 0.13, H * 0.0756, H * 0.0194);
  round(W * 0.67, H * 0.663, W * 0.13, H * 0.0756, H * 0.0194);
  g.fillStyle = '#2b2f36';                             // 디퓨저
  round(W * 0.30, H * 0.828, W * 0.40, H * 0.0825, H * 0.0165);
  return c;
}

// ── 렌더러 ─────────────────────────────────────────────────────────────
M.Render = {
  canvas: null, ctx: null, w: 0, h: 0,
  stage: null, backdrop: null, sprites: null, traffic: null, asphalt: null,
  mogu: null, moguImg: null,
  offFar: 0, offMid: 0, lastPos: 0, shake: 0,
  dpr: 1, quality: 1, theme: null,
  bgStrip: null, bgTileW: 0,          // 그릴 크기로 미리 구운 배경 타일 (정상+좌우반전)
  asphaltImg: null, asphaltLayer: null,   // 노면색 위에 결까지 합성해 둔 화면 크기 레이어

  init(container) {
    this.canvas = mkCanvas(1, 1);
    this.canvas.id = 'game-canvas';
    this.ctx = this.canvas.getContext('2d');
    container.insertBefore(this.canvas, container.firstChild);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    const load = (src, cb) => { const im = new Image(); im.onload = () => cb(im); im.src = src; return im; };

    this.moguImg = load(M.ASSETS.mogu, (im) => { this.mogu = bakeMogu(im); });
    this.mogu = bakeMogu(null);

    // 실사 배경(월드별) · 아스팔트 타일
    this.bgImgs = {};
    for (const k in M.ASSETS.bg) this.bgImgs[k] = load(M.ASSETS.bg[k], (im) => {
      if (this.backdrop === im) this._bakeBackdrop();     // 사진이 늦게 도착한 경우
    });
    this.asphalt = load(M.ASSETS.asphalt, (im) => {
      this.asphaltImg = im;
      this._bakeAsphalt();
    });
  },

  // 화면 채우기 비용은 백킹 픽셀 수에 정비례한다. 버거운 기기에서는 배율을 낮춰
  // 프레임을 지킨다 — 선명도보다 프레임이 체감에 크다. (main.js가 자동으로 부른다)
  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.resize();
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
    this.dpr = dpr;
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._bakeBackdrop();               // 구운 것들은 전부 화면 크기에 묶여 있다
    this._bakeAsphalt();
  },

  // ── 배경 사진 굽기 ────────────────────────────────────────────────────
  // 매 프레임 사진을 확대·축소해 붙이면 리샘플링만으로 프레임 예산을 다 쓴다.
  // 그릴 크기 그대로 [정상|좌우반전] 두 장짜리 띠를 미리 구워두고, 프레임마다
  // 디바이스 픽셀 등배로 붙이기만 한다.
  _bakeBackdrop() {
    this.bgStrip = null;
    const img = this.backdrop;
    if (!img || !img.width || !this.canvas.height) return;
    const dh = Math.round(this.canvas.height / 2);        // 지평선(화면 절반)까지
    const dw = Math.round(img.width * (dh / img.height));
    if (dh < 1 || dw < 1) return;
    const c = mkCanvas(dw * 2, dh), g = c.getContext('2d');
    g.drawImage(img, 0, 0, dw, dh);
    g.translate(dw * 2, 0); g.scale(-1, 1);              // 이음매를 지우는 좌우 반전 타일
    g.drawImage(img, 0, 0, dw, dh);
    this.bgStrip = c; this.bgTileW = dw;
  },

  // ── 아스팔트 결 굽기 ──────────────────────────────────────────────────
  // 결은 원근을 따르지 않는 화면 고정 레이어라 미리 구울 수 있다. 노면색 위에
  // overlay로 합성하고 거리별 농도를 알파로 구워두면, 프레임마다 할 일은
  // 도로 모양으로 잘라 한 번 붙이는 것뿐이다. 알파 합성은 블렌드 결과의
  // 선형 보간이므로 노면 위에서는 매 프레임 overlay를 돌리던 것과 결과가 같다.
  _bakeAsphalt() {
    this.asphaltLayer = null;
    const im = this.asphaltImg, theme = this.theme;
    if (!im || !theme || !this.canvas.width) return;
    const c = mkCanvas(this.canvas.width, this.canvas.height), g = c.getContext('2d');
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);      // 화면과 같은 좌표계에서 굽는다
    const w = this.w, h = this.h;
    g.fillStyle = theme.road; g.fillRect(0, 0, w, h);    // 합성 바탕 = 노면색
    g.globalCompositeOperation = 'overlay';
    g.fillStyle = g.createPattern(im, 'repeat');
    g.fillRect(0, 0, w, h);
    // 거리별 농도(가까울수록 진하게)를 알파로 굽는다. 띠 밖(지평선 위)은 알파 0.
    g.globalCompositeOperation = 'destination-in';
    const top = h * 0.52, bands = 4;
    const grd = g.createLinearGradient(0, top, 0, h);
    for (let b = 0; b < bands; b++) {
      const a = 0.05 + b * 0.075;
      grd.addColorStop(b / bands, `rgba(0,0,0,${a})`);
      grd.addColorStop((b + 1) / bands - 1e-4, `rgba(0,0,0,${a})`);
    }
    g.fillStyle = grd;
    g.fillRect(0, top, w, h - top);
    this.asphaltLayer = c;
  },

  setStage(stage) {
    this.stage = stage;
    const theme = stage.theme;
    this.theme = theme;
    this.backdrop = this.bgImgs[theme.bg || stage.world] || null;   // 테마 6+는 사진 재활용
    this.sprites = {};
    for (const t of ['lamp', 'sign']) this.sprites[t] = bakeSprite(t, theme);
    this.traffic = {};
    for (const t of ['sedan', 'van', 'truck']) {
      this.traffic[t] = [];
      for (let hue = 0; hue < TRAFFIC_HUES.length; hue++) this.traffic[t].push(bakeTraffic(t, hue, theme.night));
    }
    this.offFar = 0; this.offMid = 0; this.lastPos = 0; this.shake = 0;
    this._bakeBackdrop();
    this._bakeAsphalt();
  },

  // ── 배경 — 월드별 실사 사진 한 장을 지평선(h/2)에 맞춰 좌우로 흘린다 ──
  // 사진은 이어붙는 그림이 아니라서 좌우 반전 타일링으로 이음매를 없앤다.
  _background(theme, horizon) {
    const ctx = this.ctx, w = this.w, h = this.h;
    if (!this.bgStrip) {                                 // 로딩 전에는 하늘색만
      ctx.fillStyle = theme.sky1; ctx.fillRect(0, 0, w, horizon + 2);
    } else {
      // 미리 구운 띠를 디바이스 픽셀 정수 위치에 등배로 붙인다 — 확대·축소가 없으니
      // 리샘플링도 없다. 원경 시차는 아주 느려서 1픽셀 단위 이동으로 충분하다.
      const tile = this.bgTileW, span = tile * 2, cw = this.canvas.width;
      let x = Math.round(-(((this.offFar * tile) % span) + span) % span);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);                // 디바이스 좌표계
      for (; x < cw; x += span) ctx.drawImage(this.bgStrip, x, 0);
      ctx.restore();
    }
    if (theme.tint) {                                    // 사진 재활용 테마의 색조 — 노을·새벽·눈보라
      ctx.fillStyle = theme.tint;
      ctx.fillRect(0, 0, w, horizon + 2);
    }
    ctx.fillStyle = theme.haze;                          // 지평선 헤이즈로 노면과 이어준다
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, horizon - 8, w, 16);
    ctx.globalAlpha = 1;
  },

  // ── 가드레일 한 구간 (높이를 도로 폭에 비례시켜야 원근이 맞는다) ──
  _rail(x1, y1, w1, x2, y2, w2, theme, side, post) {
    const ctx = this.ctx;
    const rx1 = x1 + side * w1 * RAIL_X, rx2 = x2 + side * w2 * RAIL_X;
    const hh1 = w1 * 0.20, hh2 = w2 * 0.20;
    if (post) {                                        // 지주 — 한 지점에 수직으로 세운다
      const pw = Math.max(1, w1 * 0.022);
      ctx.fillStyle = theme.night ? '#4e535d' : '#8a919b';
      ctx.fillRect(rx1 - pw / 2, y1 - hh1, pw, hh1);
    }
    ctx.fillStyle = theme.night ? '#7b818c' : '#ccd2da';   // 레일 (W 단면 상단)
    ctx.beginPath();
    ctx.moveTo(rx1, y1 - hh1); ctx.lineTo(rx2, y2 - hh2);
    ctx.lineTo(rx2, y2 - hh2 * 0.52); ctx.lineTo(rx1, y1 - hh1 * 0.52);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = theme.night ? '#5a606a' : '#9aa2ac';   // 하단 음영
    ctx.beginPath();
    ctx.moveTo(rx1, y1 - hh1 * 0.52); ctx.lineTo(rx2, y2 - hh2 * 0.52);
    ctx.lineTo(rx2, y2 - hh2 * 0.34); ctx.lineTo(rx1, y1 - hh1 * 0.34);
    ctx.closePath(); ctx.fill();
  },

  draw(st, time, dt) {
    const ctx = this.ctx, w = this.w, h = this.h;
    const stage = st.stage, theme = stage.theme, segs = stage.segs;
    const roadW = M.ROAD_W;

    // 배경 시차 — 커브를 돌면 원경이 반대로 흐른다
    const dz = st.pos - this.lastPos; this.lastPos = st.pos;
    const baseSeg = stage.segAt(st.pos);
    this.offFar += baseSeg.curve * dz * 0.0000009;
    this.offMid += baseSeg.curve * dz * 0.0000021;

    const basePct = (st.pos % M.SEG_LEN) / M.SEG_LEN;
    const playerY = lerp(baseSeg.p1.world.y, baseSeg.p2.world.y, basePct);
    const camY = CAM_H + playerY;
    const camZ = st.pos;

    ctx.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this._background(theme, h * 0.5);                   // 소실점과 같은 높이

    // ── 도로: 뒤에서 앞으로 사다리꼴을 쌓는다 ──
    let x = 0, dx = -(baseSeg.curve * basePct);
    let maxy = h;
    const drawn = [];
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segs[(baseSeg.index + n) % stage.total];
      seg.looped = seg.index < baseSeg.index;
      seg.fog = 1 / Math.exp((n / DRAW_DIST) * (n / DRAW_DIST) * FOG_DENSITY);
      const zOff = camZ - (seg.looped ? stage.length : 0);
      project(seg.p1, st.playerX * roadW - x, camY, zOff, w, h, roadW);
      project(seg.p2, st.playerX * roadW - x - dx, camY, zOff, w, h, roadW);
      x += dx; dx += seg.curve;

      // 크레스트 클립선 — 이 세그먼트 위 스프라이트·차량은 이 y 아래로는 가려진다.
      // 컬링돼도 기록해 둬야 언덕 너머 차가 프레임 단위로 사라지지 않는다.
      seg.clip = maxy;

      if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      const p1 = seg.p1.screen, p2 = seg.p2.screen;
      const alt = seg.color === 1;

      ctx.fillStyle = alt ? theme.ground : theme.ground2;   // 노변 지면
      ctx.fillRect(0, p2.y, w, p1.y - p2.y + 1);
      poly(ctx, p1.x, p1.y, p1.w * 1.14, p2.x, p2.y, p2.w * 1.14, alt ? theme.rumble : theme.rumble2);
      poly(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, alt ? theme.road : theme.road2);
      // 편도 3차선 도색 — 왼쪽 가장자리 황색 실선 + 오른쪽 흰 실선(일방통행 관례),
      // 차선 경계는 ±1/3 지점의 흰 점선. 중앙 황색 복선은 가운데 차선을 반으로
      // 갈라 4개의 불균등한 차선처럼 보이게 하므로 두지 않는다.
      // 도색은 원경에서 서브픽셀로 사라지므로 최소 폭을 보장한다.
      const ew1 = Math.max(0.7, p1.w / 34), ew2 = Math.max(0.7, p2.w / 34);
      poly(ctx, p1.x - p1.w * 0.955, p1.y, ew1, p2.x - p2.w * 0.955, p2.y, ew2, theme.center);
      poly(ctx, p1.x + p1.w * 0.955, p1.y, ew1, p2.x + p2.w * 0.955, p2.y, ew2, theme.lane);

      if (alt) {                                            // 차선 점선
        const lw1 = Math.max(0.7, p1.w / 46), lw2 = Math.max(0.7, p2.w / 46);
        for (let l = 1; l < M.LANES; l++) {
          const o = (l / M.LANES) * 2 - 1;
          poly(ctx, p1.x + p1.w * o, p1.y, lw1, p2.x + p2.w * o, p2.y, lw2, theme.lane);
        }
      }

      if (seg.fog < 1) {                                    // 거리 안개
        ctx.globalAlpha = 1 - seg.fog;
        ctx.fillStyle = theme.haze;
        ctx.fillRect(0, p2.y, w, p1.y - p2.y + 1);
        ctx.globalAlpha = 1;
      }
      drawn.push(seg);
      maxy = p2.y;
    }

    // ── 아스팔트 결 — 도로 영역만 잘라내 실사 텍스처를 덧입힌다 ──
    // 패턴은 원근을 따르지 않으므로, 가까울수록 진하고 멀수록 옅게 띠를 나눠 얹는다.
    if (this.asphaltLayer && drawn.length > 2) {
      ctx.save();
      ctx.beginPath();
      const first = drawn[0].p1.screen;
      ctx.moveTo(first.x - first.w, first.y);
      for (let i = 0; i < drawn.length; i++) { const p = drawn[i].p1.screen; ctx.lineTo(p.x - p.w, p.y); }
      for (let i = drawn.length - 1; i >= 0; i--) { const p = drawn[i].p1.screen; ctx.lineTo(p.x + p.w, p.y); }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(this.asphaltLayer, 0, 0, w, h);      // 농도·블렌드는 구울 때 끝냈다
      ctx.restore();
    }

    // ── 도로 위로 솟는 것들은 먼 것부터 별도 패스로 (도로 폴리곤이 덮어쓰지 않게) ──
    for (let i = drawn.length - 1; i >= 0; i--) {
      const seg = drawn[i], p1 = seg.p1.screen, p2 = seg.p2.screen;
      const post = seg.index % 4 === 0;
      ctx.globalAlpha = seg.fog;
      this._rail(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, theme, 1, post);
      this._rail(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, theme, -1, post);
      if (seg.cp) {                                         // 체크포인트 게이트
        const gh = p1.w * 1.15;
        ctx.fillStyle = '#ffd83d';
        ctx.fillRect(p1.x - p1.w * 1.3, p1.y - gh, p1.w * 2.6, gh * 0.14);
        ctx.fillRect(p1.x - p1.w * 1.3, p1.y - gh, p1.w * 0.1, gh);
        ctx.fillRect(p1.x + p1.w * 1.2, p1.y - gh, p1.w * 0.1, gh);
      }
      ctx.globalAlpha = 1;
    }

    // ── 스프라이트·차량: 렌더 창 전체를 먼 것부터 (앞이 뒤를 가리게) ──
    // 컬링된 세그먼트(크레스트 뒤·내리막 뒷면)도 건너뛰지 않고 클립선으로 잘라 그린다.
    // 세그먼트가 컬링 목록에 들었다 빠졌다 할 때마다 차가 통째로 사라지면 깜빡임이 된다.
    const drawClipped = (img, dxp, dyp, dw, dh, alpha, clip) => {
      if (dyp >= clip || alpha <= 0) return;              // 전부 크레스트 뒤
      ctx.globalAlpha = alpha;
      if (dyp + dh > clip) {                              // 아랫부분만 가려짐 — 클립선까지만
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, w, clip); ctx.clip();
        ctx.drawImage(img, dxp, dyp, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(img, dxp, dyp, dw, dh);
      }
      ctx.globalAlpha = 1;
    };

    // 차량을 실제 z가 속한 세그먼트에 인덱스로 배정한다. 거리 비교 방식은 루프
    // 구간에서 어긋나 차가 안 그려지는 프레임이 생겼다.
    const carsAt = new Map();                             // 창 내 오프셋 n → 차량 목록
    for (const c of st.cars) {
      const ci = Math.floor(c.z / M.SEG_LEN) % stage.total;
      const n = (ci - baseSeg.index + stage.total) % stage.total;
      if (n >= DRAW_DIST) continue;
      if (!carsAt.has(n)) carsAt.set(n, []);
      carsAt.get(n).push(c);
    }

    for (let n = DRAW_DIST - 1; n >= 0; n--) {
      const seg = segs[(baseSeg.index + n) % stage.total];
      if (seg.p1.camera.z <= CAM_DEPTH) continue;         // 카메라 뒤·바로 옆 — 투영이 발산
      const p = seg.p1.screen, clip = seg.clip;

      for (const sp of seg.sprites) {
        const img = this.sprites[sp.type];
        if (!img) continue;
        const dw = p.w * SPRITE_W * sp.scale;             // 도로 반폭 대비 크기
        const dh = dw * (img.height / img.width);
        const dxp = p.x + p.w * sp.offset - dw / 2;
        drawClipped(img, dxp, p.y - dh, dw, dh, seg.fog, clip);
      }

      const cars = carsAt.get(n);
      if (!cars) continue;
      if (cars.length > 1) cars.sort((a, b) => b.z - a.z);   // 같은 세그먼트 안에서도 먼 차부터
      for (const c of cars) {
        const img = this.traffic[c.type][c.hue % TRAFFIC_HUES.length];
        // 세그먼트 시작점에 스냅하지 않고 양 끝(p1·p2) 사이를 차의 실제 z로 보간한다.
        // 스냅하면 경계를 넘을 때마다 화면에서 한 세그먼트씩 툭툭 튄다.
        const pct = (c.z % M.SEG_LEN) / M.SEG_LEN;
        const s2 = seg.p2.screen;
        const rx = lerp(p.x, s2.x, pct);
        const ry = lerp(p.y, s2.y, pct);
        const rw = lerp(p.w, s2.w, pct);
        // 바로 옆을 스치는 차는 원본(200px)을 몇 배로 늘려야 해서 흐릿한 거대 컷아웃이 된다.
        // 화면 폭의 절반으로 크기를 묶고, 더 가까워지면 잘라내는 대신 서서히 지운다
        // (즉시 소멸은 그 자체가 깜빡임으로 보인다).
        let dw = rw * M.Logic.CAR_HALF * 2;
        let fade = 1;
        if (dw > w * CAR_MAX_W) {
          fade = 1 - (dw - w * CAR_MAX_W) / (w * (CAR_CULL_W - CAR_MAX_W));
          if (fade <= 0) continue;
          dw = w * CAR_MAX_W;
        }
        const dh = dw * (img.height / img.width);
        const dxp = rx + rw * c.offset - dw / 2, dyp = ry - dh;
        drawClipped(img, dxp, dyp, dw, dh, seg.fog * fade, clip);

        // 방향지시등 — 미등 자리를 호박색으로 덮는다. 차마다 위상이 어긋나 있어
        // 실제 도로처럼 제각각 깜빡인다. (차선을 바꾸는 차는 반드시 여기에 걸린다)
        if (c.blink && ((time * BLINK_HZ + c.phase) % 1) < 0.55) {
          const bw = Math.max(1.5, dw * 0.13), bh = Math.max(1.5, dh * 0.07);
          const bx = dxp + dw * (c.blink < 0 ? 0.10 : 0.77);
          const by = dyp + dh * TAIL_Y[c.type];
          ctx.globalAlpha = seg.fog * fade;
          ctx.fillStyle = '#ffb02e';
          if (by + bh > clip) {                           // 크레스트 뒤는 잘라낸다 — 차와 같은 규칙
            if (by < clip) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, clip); ctx.clip(); ctx.fillRect(bx, by, bw, bh); ctx.restore(); }
          } else ctx.fillRect(bx, by, bw, bh);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ── 플레이어 (화면 하단 고정) ──
    if (this.shake > 0) this.shake -= dt;
    if (st.hitT > 0 || st.railT > 0) this.shake = 0.25;
    const bump = st.speed > 0 ? Math.sin(time * 22) * (st.speed / M.MAX_SPEED) * 3 : 0;
    const jolt = this.shake > 0 ? (Math.random() - 0.5) * 14 : 0;
    // 플레이어 차 폭도 충돌 폭에서 뽑는다. 플레이어 위치(카메라 앞 CAM_H)에서의
    // 도로 반폭 = (ROAD_W / CAM_H) × w/2 이므로, 여기에 충돌 폭을 곱하면 화면 폭이 나온다.
    const roadHalfAtPlayer = (M.ROAD_W / CAM_H) * (w / 2);
    const carW = roadHalfAtPlayer * M.Logic.PLAYER_HALF * 2;
    const carH = carW * (this.mogu.height / this.mogu.width);
    const cx = w / 2 + jolt, cy = h * 0.895 + bump + jolt * 0.4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(st.steer * 0.05);                            // 조향 기울기
    ctx.translate(st.steer * w * 0.02, 0);
    ctx.drawImage(this.mogu, -carW / 2, -carH, carW, carH);
    ctx.restore();

    if (st.offT > 0) {                                      // 노면 이탈 흙먼지
      ctx.fillStyle = 'rgba(210,190,150,.5)';
      for (let i = 0; i < 14; i++) {
        const px = cx + (Math.random() - 0.5) * carW * 1.2;
        const py = cy - Math.random() * carH * 0.3;
        ctx.fillRect(px, py, 5, 5);
      }
    }
  },
};
