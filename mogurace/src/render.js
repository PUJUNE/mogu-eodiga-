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
const CAR_W = 0.56;                       // 교통 차량 폭 (도로 반폭의 56% ≈ 1.7차선 중 1차선)
const CAR_MAX_W = 0.34;                   // 교통 차량 최대 화면 폭 비율
const CAR_CULL_W = 0.62;                  // 이보다 커질 만큼 가까우면 그리지 않음 (옆을 스치는 중)
const RAIL_X = 1.24;                      // 가드레일 위치 (갓길 줄무늬 1.14 바깥)

const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);

const lerp = (a, b, p) => a + (b - a) * p;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

function project(p, camX, camY, camZ, w, h, roadW) {
  p.camera.x = (p.world.x || 0) - camX;
  p.camera.y = (p.world.y || 0) - camY;
  p.camera.z = (p.world.z || 0) - camZ;
  p.screen.scale = CAM_DEPTH / p.camera.z;
  p.screen.x = Math.round(w / 2 + p.screen.scale * p.camera.x * w / 2);
  p.screen.y = Math.round(h / 2 - p.screen.scale * p.camera.y * h / 2);
  p.screen.w = Math.round(p.screen.scale * roadW * w / 2);
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

// 교통 차량은 다이캐스트 미니카 사진(24방향 중 후방 3프레임)을 그대로 쓴다.
const CAR_COLORS = ['red', 'white', 'orange', 'gray'];

// ── 모구 레이서 굽기 (오픈탑 차체 + 모구 뒷모습 합성) ──────────────────
// 모구를 먼저 그리고 차체를 그 위에 덮어, 하반신이 차체에 가려 '앉아 있게' 만든다.
function bakeMogu(moguImg) {
  const W = 460, H = 330;
  const c = mkCanvas(W, H), g = c.getContext('2d');

  g.fillStyle = 'rgba(0,0,0,.32)';                     // 접지 그림자
  g.beginPath(); g.ellipse(W / 2, H * 0.96, W * 0.44, H * 0.045, 0, 0, Math.PI * 2); g.fill();

  g.fillStyle = '#16171c';                             // 뒷바퀴 (차체보다 바깥으로 나오게)
  g.fillRect(W * 0.02, H * 0.62, W * 0.17, H * 0.33);
  g.fillRect(W * 0.81, H * 0.62, W * 0.17, H * 0.33);
  g.fillStyle = '#4a4f58';
  g.fillRect(W * 0.045, H * 0.71, W * 0.12, H * 0.13);
  g.fillRect(W * 0.835, H * 0.71, W * 0.12, H * 0.13);

  g.fillStyle = '#1e2027';                             // 좌석 등받이 (모구 뒤 배경)
  g.beginPath(); g.ellipse(W / 2, H * 0.56, W * 0.17, H * 0.16, 0, 0, Math.PI * 2); g.fill();

  if (moguImg && moguImg.width) {                      // 운전석의 모구 (뒷모습)
    const mh = H * 0.72, mw = mh * (moguImg.width / moguImg.height);
    g.drawImage(moguImg, W / 2 - mw / 2, H * 0.06, mw, mh);
  }

  g.fillStyle = '#c8402f';                             // 차체 — 모구 하반신을 덮어 앉은 자세를 만든다
  g.beginPath();
  g.moveTo(W * 0.09, H * 0.94); g.lineTo(W * 0.17, H * 0.58);
  g.lineTo(W * 0.83, H * 0.58); g.lineTo(W * 0.91, H * 0.94);
  g.closePath(); g.fill();
  g.fillStyle = '#e8624c';                             // 상면 광택
  g.fillRect(W * 0.175, H * 0.58, W * 0.65, H * 0.05);
  g.fillStyle = 'rgba(0,0,0,.18)';                     // 하단 음영
  g.fillRect(W * 0.11, H * 0.86, W * 0.78, H * 0.08);

  g.fillStyle = '#2a2d34';                             // 사이드 포드
  g.fillRect(W * 0.11, H * 0.66, W * 0.07, H * 0.2);
  g.fillRect(W * 0.82, H * 0.66, W * 0.07, H * 0.2);

  g.fillStyle = '#24272e';                             // 리어윙 (가장 앞 = 화면 쪽)
  g.fillRect(W * 0.2, H * 0.63, W * 0.04, H * 0.11);
  g.fillRect(W * 0.76, H * 0.63, W * 0.04, H * 0.11);
  g.fillRect(W * 0.12, H * 0.6, W * 0.76, H * 0.045);
  g.fillStyle = '#ff5a4a';                             // 미등
  g.fillRect(W * 0.22, H * 0.75, W * 0.11, H * 0.055);
  g.fillRect(W * 0.67, H * 0.75, W * 0.11, H * 0.055);
  return c;
}

// ── 렌더러 ─────────────────────────────────────────────────────────────
M.Render = {
  canvas: null, ctx: null, w: 0, h: 0,
  stage: null, backdrop: null, sprites: null, carImgs: null, asphalt: null, asphaltPat: null,
  mogu: null, moguImg: null,
  offFar: 0, offMid: 0, lastPos: 0, shake: 0,

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

    // 실사 배경(월드별) · 다이캐스트 교통차(후방 3프레임) · 아스팔트 타일
    this.bgImgs = {};
    for (const k in M.ASSETS.bg) this.bgImgs[k] = load(M.ASSETS.bg[k], () => {});
    this.carImgs = {};
    for (const col in M.ASSETS.cars) {
      this.carImgs[col] = {};
      for (const tag in M.ASSETS.cars[col]) this.carImgs[col][tag] = load(M.ASSETS.cars[col][tag], () => {});
    }
    this.asphalt = load(M.ASSETS.asphalt, (im) => {
      this.asphaltPat = this.ctx.createPattern(im, 'repeat');
    });
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  setStage(stage) {
    this.stage = stage;
    const theme = stage.theme;
    this.backdrop = this.bgImgs[stage.world] || null;
    this.sprites = {};
    for (const t of ['lamp', 'sign']) this.sprites[t] = bakeSprite(t, theme);
    this.offFar = 0; this.offMid = 0; this.lastPos = 0; this.shake = 0;
  },

  // ── 배경 — 월드별 실사 사진 한 장을 지평선(h/2)에 맞춰 좌우로 흘린다 ──
  // 사진은 이어붙는 그림이 아니라서 좌우 반전 타일링으로 이음매를 없앤다.
  _background(theme, horizon) {
    const ctx = this.ctx, w = this.w, h = this.h;
    const img = this.backdrop;
    if (!img || !img.width) {                            // 로딩 전에는 하늘색만
      ctx.fillStyle = theme.sky1; ctx.fillRect(0, 0, w, horizon + 2);
      return;
    }
    const dh = horizon;                                  // 화면 위쪽부터 지평선까지 채운다
    const dw = img.width * (dh / img.height);
    let x = -(((this.offFar * dw) % (dw * 2)) + dw * 2) % (dw * 2);
    for (let i = 0; x < w; i++, x += dw) {
      const flip = ((Math.round(x / dw) % 2) + 2) % 2 === 1;
      if (flip) {
        ctx.save();
        ctx.translate(x + dw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, 0, dw, dh);
      }
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

      if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      const p1 = seg.p1.screen, p2 = seg.p2.screen;
      const alt = seg.color === 1;

      ctx.fillStyle = alt ? theme.ground : theme.ground2;   // 노변 지면
      ctx.fillRect(0, p2.y, w, p1.y - p2.y + 1);
      poly(ctx, p1.x, p1.y, p1.w * 1.14, p2.x, p2.y, p2.w * 1.14, alt ? theme.rumble : theme.rumble2);
      poly(ctx, p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, alt ? theme.road : theme.road2);
      // 차선 도색은 원경에서 서브픽셀로 사라지므로 최소 폭을 보장한다
      const mark = (den) => [Math.max(0.7, p1.w / den), Math.max(0.7, p2.w / den)];
      const [ew1, ew2] = mark(34);                          // 갓길 흰 실선
      poly(ctx, p1.x - p1.w * 0.955, p1.y, ew1, p2.x - p2.w * 0.955, p2.y, ew2, theme.lane);
      poly(ctx, p1.x + p1.w * 0.955, p1.y, ew1, p2.x + p2.w * 0.955, p2.y, ew2, theme.lane);

      if (alt) {                                            // 차선 점선
        const [lw1, lw2] = mark(46);
        for (let l = 1; l < M.LANES; l++) {
          const o = (l / M.LANES) * 2 - 1;
          poly(ctx, p1.x + p1.w * o, p1.y, lw1, p2.x + p2.w * o, p2.y, lw2, theme.lane);
        }
      }
      const [cw1, cw2] = mark(42);                          // 중앙 이중 황색선
      const cs1 = Math.max(1.6, p1.w * 0.055), cs2 = Math.max(1.6, p2.w * 0.055);
      poly(ctx, p1.x - cs1, p1.y, cw1, p2.x - cs2, p2.y, cw2, theme.center);
      poly(ctx, p1.x + cs1, p1.y, cw1, p2.x + cs2, p2.y, cw2, theme.center);

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
    if (this.asphaltPat && drawn.length > 2) {
      ctx.save();
      ctx.beginPath();
      const first = drawn[0].p1.screen;
      ctx.moveTo(first.x - first.w, first.y);
      for (let i = 0; i < drawn.length; i++) { const p = drawn[i].p1.screen; ctx.lineTo(p.x - p.w, p.y); }
      for (let i = drawn.length - 1; i >= 0; i--) { const p = drawn[i].p1.screen; ctx.lineTo(p.x + p.w, p.y); }
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = this.asphaltPat;
      const top = h * 0.52, bands = 4;
      for (let b = 0; b < bands; b++) {
        const y0 = top + (h - top) * (b / bands), y1 = top + (h - top) * ((b + 1) / bands);
        ctx.globalAlpha = 0.05 + b * 0.075;
        ctx.fillRect(0, y0, w, y1 - y0 + 1);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
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

    // ── 스프라이트·차량: 먼 것부터 (앞이 뒤를 가리게) ──
    for (let i = drawn.length - 1; i >= 0; i--) {
      const seg = drawn[i], p = seg.p1.screen;
      for (const sp of seg.sprites) {
        const img = this.sprites[sp.type];
        if (!img) continue;
        const dw = p.w * SPRITE_W * sp.scale;             // 도로 반폭 대비 크기
        const dh = dw * (img.height / img.width);
        const dxp = p.x + p.w * sp.offset - dw / 2;
        ctx.globalAlpha = seg.fog;
        ctx.drawImage(img, dxp, p.y - dh, dw, dh);
        ctx.globalAlpha = 1;
      }
    }
    for (let i = drawn.length - 1; i >= 0; i--) {
      const seg = drawn[i];
      for (const c of st.cars) {
        const rel = c.z - (seg.looped ? st.pos - stage.length : st.pos);
        const segRel = seg.p1.world.z - st.pos + (seg.looped ? -stage.length : 0);
        if (Math.abs(rel - segRel) > M.SEG_LEN / 2) continue;
        const p = seg.p1.screen;
        // 옆으로 벌어진 차일수록 살짝 돌아간 후방 프레임을 써서 시선 방향을 맞춘다
        const lat = c.offset - st.playerX;
        const tag = lat < -0.3 ? 'r' : lat > 0.3 ? 'l' : 'c';
        const set = this.carImgs[CAR_COLORS[c.hue % CAR_COLORS.length]];
        const img = (set && (set[tag] || set.c));
        if (!img || !img.width) continue;
        // 바로 옆을 스치는 차는 원본(200px)을 몇 배로 늘려야 해서 흐릿한 거대 컷아웃이 된다.
        // 화면 폭의 절반으로 크기를 묶고, 그보다 더 가까워지면 아예 그리지 않는다.
        let dw = p.w * CAR_W;
        if (dw > w * CAR_MAX_W) {
          if (dw > w * CAR_CULL_W) continue;
          dw = w * CAR_MAX_W;
        }
        const dh = dw * (img.height / img.width);
        ctx.globalAlpha = seg.fog;
        ctx.drawImage(img, p.x + p.w * c.offset - dw / 2, p.y - dh, dw, dh);
        ctx.globalAlpha = 1;
      }
    }

    // ── 플레이어 (화면 하단 고정) ──
    if (this.shake > 0) this.shake -= dt;
    if (st.hitT > 0 || st.railT > 0) this.shake = 0.25;
    const bump = st.speed > 0 ? Math.sin(time * 22) * (st.speed / M.MAX_SPEED) * 3 : 0;
    const jolt = this.shake > 0 ? (Math.random() - 0.5) * 14 : 0;
    const carW = w * 0.30, carH = carW * (this.mogu.height / this.mogu.width);
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
