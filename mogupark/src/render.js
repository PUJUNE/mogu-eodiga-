// render.js — 평면 3D 장면 렌더러 (1인칭 차내 시야 + 미러 3개 + 탑다운 리플레이)
// 주차장은 평지라 지면 쿼드 + 상자(차·벽·기둥)만으로 그린다:
// 카메라 변환 → 근평면 클리핑(Sutherland-Hodgman) → 원근 투영 → 페인터 정렬.
// 미러는 같은 drawScene을 미러 카메라로 저해상 오프스크린에 돌려 좌우 반전 합성한다.
const M = window.MPK;

const NEAR = 0.14;
const PLAYER_COL = '#d8a63a';                 // 모구의 차 (리플레이·미러 속 자기 차)
const EYE = { x: -0.40, y: 1.16, z: 0.35 };   // 운전석 눈 위치 (차 기준: x=좌우, z=전후)
const MIRRORS = {
  room:  { lx: 0,     ly: 1.30, lz: 0.20, dyaw: Math.PI,        fov: 58, pitch: 0.04, self: false },
  left:  { lx: -0.92, ly: 1.02, lz: 0.55, dyaw: Math.PI + 0.30, fov: 50, pitch: 0.055, self: true },
  right: { lx: 0.92,  ly: 1.02, lz: 0.55, dyaw: Math.PI - 0.30, fov: 50, pitch: 0.055, self: true },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// '#rrggbb'와 자기 출력('rgb(r,g,b)') 둘 다 받는다 — drawBox가 이미 셰이드된 색을
// 다시 셰이드하는 경로(캐빈 등)가 있어서 hex 전용이면 무효 색이 나온다.
function shade(col, k) {
  let r, g, b;
  if (col[0] === '#') {
    const n = parseInt(col.slice(1), 16);
    r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
  } else {
    const m = col.match(/(\d+),\s*(\d+),\s*(\d+)/);
    r = +m[1]; g = +m[2]; b = +m[3];
  }
  return `rgb(${clamp(Math.round(r * k), 0, 255)},${clamp(Math.round(g * k), 0, 255)},${clamp(Math.round(b * k), 0, 255)})`;
}

// ── 카메라 ──
function makeCam(x, y, z, yaw, pitch, fovDeg, w, h) {
  const f = (w / 2) / Math.tan((fovDeg * Math.PI / 180) / 2);
  return { x, y, z, sy: Math.sin(yaw), cy: Math.cos(yaw), sp: Math.sin(pitch), cp: Math.cos(pitch),
    yaw, pitch, f, w, h, cx: w / 2, cyp: h / 2 };
}
// 월드 → 카메라 공간 [가로, 세로, 깊이]
function camPt(cam, wx, wy, wz) {
  const dx = wx - cam.x, dy = wy - cam.y, dz = wz - cam.z;
  const x1 = dx * cam.cy - dz * cam.sy;
  const z1 = dx * cam.sy + dz * cam.cy;
  return [x1, dy * cam.cp + z1 * cam.sp, z1 * cam.cp - dy * cam.sp];
}
// 근평면 클리핑 (z > NEAR)
function clipNear(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ain = a[2] > NEAR, bin = b[2] > NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}
function fillWorldPoly(ctx, cam, pts, color) {
  const ps = clipNear(pts.map((p) => camPt(cam, p[0], p[1], p[2])));
  if (ps.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < ps.length; i++) {
    const sx = cam.cx + cam.f * ps[i][0] / ps[i][2];
    const sy = cam.cyp - cam.f * ps[i][1] / ps[i][2];
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.fill();
}

// 상자 (밑면 y0 → 윗면 y1): 보이는 면만 페인터 정렬로
function drawBox(ctx, cam, cx0, cz0, y0, y1, w, l, yaw, color, dark) {
  const cs = M.Logic.corners(cx0, cz0, w, l, yaw);
  const amb = dark ? 0.72 : 0.62, dif = dark ? 0.28 : 0.38;
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const a = cs[i], b = cs[(i + 1) % 4];
    const nx = b[1] - a[1], nz = -(b[0] - a[0]);              // 바깥 법선
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if ((mx - cam.x) * nx + (mz - cam.z) * nz >= 0) continue; // 뒷면 컬링
    const ln = Math.hypot(nx, nz) || 1;
    const br = amb + dif * Math.max(0, (nx * 0.55 + nz * 0.35) / ln);
    faces.push({
      pts: [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]],
      col: shade(color, br),
      d: (mx - cam.x) * (mx - cam.x) + (mz - cam.z) * (mz - cam.z),
    });
  }
  if (cam.y > y1) faces.push({ pts: cs.map((c) => [c[0], y1, c[1]]), col: shade(color, dark ? 0.95 : 1.0), d: -1 });
  faces.sort((p, q) => q.d - p.d);
  for (const fc of faces) fillWorldPoly(ctx, cam, fc.pts, fc.col);
}

// 지면 마킹용 쿼드 (중심·크기·회전, y 고정)
function quadPts(x, z, w, l, yaw, y) {
  return M.Logic.corners(x, z, w, l, yaw).map((c) => [c[0], y, c[1]]);
}

M.Render = {
  cv: null, ctx: null, mirrorCv: {}, replay: null,
  mogu: null, asphalt: null, asphaltPat: null, bgImgs: {},

  init(root) {
    this.cv = document.createElement('canvas');
    this.cv.id = 'game-canvas';
    root.insertBefore(this.cv, root.firstChild);
    this.ctx = this.cv.getContext('2d');
    for (const k of ['room', 'left', 'right']) {
      const c = document.createElement('canvas');
      c.width = k === 'room' ? 300 : 190; c.height = k === 'room' ? 110 : 128;
      this.mirrorCv[k] = c;
    }
    const load = (src, cb) => { const im = new Image(); im.onload = () => cb && cb(im); im.src = src; return im; };
    this.mogu = load(M.ASSETS.mogu);
    this.asphalt = load(M.ASSETS.asphalt, (im) => {
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      g.fillStyle = 'rgba(20,22,28,.62)';                       // 탑다운 노면은 어둡게 눌러 마킹이 뜨게
      g.fillRect(0, 0, c.width, c.height);
      this.asphaltPat = this.ctx.createPattern(c, 'repeat');
    });
    for (const k in M.ASSETS.bg) this.bgImgs[k] = load(M.ASSETS.bg[k]);
    const fit = () => { this.cv.width = window.innerWidth; this.cv.height = window.innerHeight; };
    fit();
    window.addEventListener('resize', fit);
  },

  setStage(stage) {
    this.stage = stage;
    const rng = M.makeRng(stage.no * 331 + 7);
    // 노면 얼룩 (실사 톤의 정적 패치)
    this.patches = [];
    for (let i = 0; i < 26; i++) {
      this.patches.push({ x: rng.range(stage.lot.x0, stage.lot.x1), z: rng.range(stage.lot.z0, stage.lot.z1),
        w: rng.range(0.8, 3.2), l: rng.range(0.8, 2.6), yaw: rng.range(0, 3), k: rng.range(0.9, 1.06) });
    }
    // 지하 천장 형광등 줄
    this.strips = [];
    if (stage.theme.dark) {
      for (let z = stage.lot.z0 + 2.5; z < stage.lot.z1; z += 5.5) this.strips.push(z);
    }
    this.replay = null;
  },

  // ══ 장면 (지면 + 마킹 + 상자들) — 메인 뷰와 미러가 공유 ══
  drawScene(ctx, cam, st, opts, t) {
    const stage = st.stage, th = stage.theme;
    const W = cam.w, H = cam.h;
    // 지평선: 눈높이 원거리 점의 투영
    const horizon = cam.cyp - cam.f * Math.tan(cam.pitch);

    // ── 하늘 / 배경 사진 ──
    if (th.dark) {
      ctx.fillStyle = th.sky0; ctx.fillRect(0, 0, W, Math.max(0, horizon));
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
      g.addColorStop(0, th.sky0); g.addColorStop(1, th.sky1);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.max(0, horizon));
      const img = this.bgImgs[th.bg];
      if (img && img.complete && img.naturalWidth) {
        const dh = H * 0.42, dw = cam.f * 1.6, u = cam.yaw * cam.f;
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, Math.max(0, horizon)); ctx.clip();
        ctx.globalAlpha = 0.94;
        for (let k = Math.floor(u / dw) - 1; ; k++) {
          const sx = k * dw - u;
          if (sx > W) break;
          if (k % 2) { ctx.save(); ctx.translate(sx + dw, horizon - dh); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, dw, dh); ctx.restore(); }
          else ctx.drawImage(img, sx, horizon - dh, dw, dh);
        }
        ctx.restore();
      }
    }

    // ── 지면 ──
    ctx.fillStyle = th.outside;
    ctx.fillRect(0, Math.max(0, horizon), W, H - Math.max(0, horizon));
    const lot = stage.lot;
    fillWorldPoly(ctx, cam, [[lot.x0, 0, lot.z0], [lot.x1, 0, lot.z0], [lot.x1, 0, lot.z1], [lot.x0, 0, lot.z1]], th.asphalt);
    for (const p of this.patches) fillWorldPoly(ctx, cam, quadPts(p.x, p.z, p.w, p.l, p.yaw, 0.002), shade(th.asphalt2, p.k));

    // ── 지하 천장 + 형광등 ──
    if (th.dark) {
      fillWorldPoly(ctx, cam, [[lot.x0, 2.75, lot.z1], [lot.x1, 2.75, lot.z1], [lot.x1, 2.75, lot.z0], [lot.x0, 2.75, lot.z0]], '#24262c');
      for (const z of this.strips)
        fillWorldPoly(ctx, cam, [[lot.x0 + 1, 2.72, z + 0.2], [lot.x1 - 1, 2.72, z + 0.2], [lot.x1 - 1, 2.72, z - 0.2], [lot.x0 + 1, 2.72, z - 0.2]], '#e9f2da');
    }

    // ── 칸 마킹 ──
    const LW = 0.10;
    for (const s of stage.slots) {
      const col = s.target ? th.target : th.line;
      const y = s.target ? 0.006 : 0.004;
      if (s.target) {
        const pulse = 0.16 + 0.08 * Math.sin(t * 3);
        ctx.globalAlpha = pulse + 0.1;
        fillWorldPoly(ctx, cam, quadPts(s.x, s.z, s.w, s.l, s.yaw, 0.005), th.target);
        ctx.globalAlpha = 1;
      }
      const sn = Math.sin(s.yaw), cs = Math.cos(s.yaw);
      const hw = s.w / 2, hl = s.l / 2;
      const side = (lx) => quadPts(s.x + lx * cs, s.z - lx * sn, LW, s.l, s.yaw, y);
      const end = (lz) => quadPts(s.x + lz * sn, s.z + lz * cs, s.w, LW, s.yaw, y);
      fillWorldPoly(ctx, cam, side(-hw), col);
      fillWorldPoly(ctx, cam, side(hw), col);
      fillWorldPoly(ctx, cam, end(hl * Math.sign(s.z || 1)), col);
      if (s.target) fillWorldPoly(ctx, cam, end(-hl * Math.sign(s.z || 1)), col);
    }

    // ── 상자들 (원거리부터) ──
    const units = [];
    for (const o of stage.obstacles) units.push({ x: o.x, z: o.z, o });
    if (opts.self) units.push({ x: st.car.x, z: st.car.z, self: true });
    for (const u of units) u.d = (u.x - cam.x) ** 2 + (u.z - cam.z) ** 2;
    units.sort((a, b) => b.d - a.d);
    for (const u of units) {
      if (u.self) { this._drawCarBoxes(ctx, cam, st.car.x, st.car.z, st.car.h, PLAYER_COL, th.dark); continue; }
      const o = u.o;
      if (o.kind === 'car') this._drawCarBoxes(ctx, cam, o.x, o.z, o.yaw, M.CAR_HUES[o.hue], th.dark);
      else if (o.kind === 'pillar') drawBox(ctx, cam, o.x, o.z, 0, 2.75, o.w, o.l, o.yaw, th.wallC || '#9aa', th.dark);
      else if (o.kind === 'wall') drawBox(ctx, cam, o.x, o.z, 0, stage.world === 3 ? 2.6 : (th.dark ? 2.75 : 0.95), o.w, o.l, o.yaw, th.wallC, th.dark);
      else if (o.kind === 'curb') drawBox(ctx, cam, o.x, o.z, 0, 0.13, o.w, o.l, o.yaw, th.curbC, th.dark);
      else if (o.kind === 'cone') {
        drawBox(ctx, cam, o.x, o.z, 0, 0.06, 0.36, 0.36, o.yaw, '#c85a20', th.dark);
        drawBox(ctx, cam, o.x, o.z, 0.06, 0.55, 0.17, 0.17, o.yaw, '#e06424', th.dark);
      }
    }

    if (th.dark) { ctx.fillStyle = 'rgba(8,10,16,.18)'; ctx.fillRect(0, 0, W, H); }
  },

  // 주차 차량 = 차체 + 캐빈(유리) 상자 2개
  _drawCarBoxes(ctx, cam, x, z, yaw, col, dark) {
    const C = M.CAR;
    drawBox(ctx, cam, x, z, 0.12, 0.78, C.W, C.L, yaw, col, dark);
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const off = -0.25;                                           // 캐빈은 살짝 뒤쪽
    drawBox(ctx, cam, x + off * s, z + off * c, 0.78, 1.42, C.W * 0.86, C.L * 0.52, yaw, shade(col, 0.74), dark);
  },

  // ══ 주행 화면 (1인칭 + 미러 + 콕핏) ══
  drawRun(st, t) {
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    const car = st.car;
    const cs = Math.cos(car.h), sn = Math.sin(car.h);
    const px = (lx, lz) => [car.x + lx * cs + lz * sn, car.z - lx * sn + lz * cs];

    // 미러 3개 먼저 오프스크린에 (좌우 반전은 캔버스 변환으로)
    for (const k of ['room', 'left', 'right']) {
      const mdef = MIRRORS[k], mc = this.mirrorCv[k], g = mc.getContext('2d');
      const [mx, mz] = px(mdef.lx, mdef.lz);
      const cam = makeCam(mx, mdef.ly, mz, car.h + mdef.dyaw, mdef.pitch, mdef.fov, mc.width, mc.height);
      g.save();
      g.translate(mc.width, 0); g.scale(-1, 1);
      this.drawScene(g, cam, st, { self: mdef.self }, t);
      g.restore();
    }

    // 메인 뷰
    const [ex, ez] = px(EYE.x, EYE.z);
    const cam = makeCam(ex, EYE.y, ez, car.h + car.headYaw, 0.10, 76, W, H);
    this.drawScene(ctx, cam, st, { self: false }, t);

    this._drawCockpit(ctx, st, t, cam);

    // 주차 확인 링
    if (st.parkT > 0 && st.phase === 'run') {
      const p = Math.min(1, st.parkT / M.Logic.PARK_HOLD);
      ctx.save();
      ctx.translate(W / 2, H * 0.30);
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#7de08a';
      ctx.beginPath(); ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('주차 확인', 0, 5);
      ctx.restore();
    }

    // 충돌·종료 플래시
    if (st.phase === 'crash') { ctx.fillStyle = 'rgba(200,40,30,.25)'; ctx.fillRect(0, 0, W, H); }
  },

  // ── 콕핏: 고개 각도(headYaw) 기준 원통 오버레이 ──
  // 차 기준 각도 a의 요소를 cx + f·tan(a − headYaw)에 그린다.
  _drawCockpit(ctx, st, t, cam) {
    const W = cam.w, H = cam.h, f = cam.f;
    const hy = st.car.headYaw;
    const sx = (a) => {
      const rel = wrapPi(a - hy);
      return cam.cx + f * Math.tan(clamp(rel, -1.32, 1.32));
    };
    const off = (a) => Math.abs(wrapPi(a - hy)) >= 1.32;

    const DASH = '#191b21', DOOR = '#22242b', PILLAR = '#101216', ROOF = '#0d0f13';

    // 좌우 백미러 (차 외부 — 실내 패널보다 먼저 그려 창틀이 덮게)
    const mirror = (k, a, wPx) => {
      if (off(a)) return;
      const mc = this.mirrorCv[k];
      const x = sx(a), h = wPx * (mc.height / mc.width);
      const y = H * 0.40;
      ctx.save();
      ctx.beginPath();
      const r = wPx * 0.12;
      ctx.roundRect ? ctx.roundRect(x - wPx / 2 - 5, y - 5, wPx + 10, h + 10, r) : ctx.rect(x - wPx / 2 - 5, y - 5, wPx + 10, h + 10);
      ctx.fillStyle = '#15171c'; ctx.fill();
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - wPx / 2, y, wPx, h, r * 0.7) : ctx.rect(x - wPx / 2, y, wPx, h);
      ctx.clip();
      ctx.drawImage(mc, x - wPx / 2, y, wPx, h);
      ctx.restore();
    };
    mirror('left', -1.02, W * 0.135);
    mirror('right', 1.06, W * 0.135);

    // 대시보드 (앞유리 아래) — 좌우 필러 사이를 곡선으로 잇는다
    const aWL = -0.80, aWR = 0.72;                              // 앞유리 좌/우 경계각
    const xL = sx(aWL), xR = sx(aWR);
    ctx.fillStyle = DASH;
    ctx.beginPath();
    ctx.moveTo(xL, H * 0.585);
    ctx.quadraticCurveTo((xL + xR) / 2, H * 0.66, xR, H * 0.585);
    ctx.lineTo(xR, H); ctx.lineTo(xL, H);
    ctx.closePath(); ctx.fill();

    // 지붕
    ctx.fillStyle = ROOF; ctx.fillRect(0, 0, W, H * 0.10);

    // A필러
    const pillarBand = (a0, a1, y0, y1, col) => {
      const x0 = sx(a0), x1 = sx(a1);
      if (off(a0) && off(a1) && Math.sign(wrapPi(a0 - hy)) === Math.sign(wrapPi(a1 - hy))) return;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1);
      ctx.closePath(); ctx.fill();
    };
    pillarBand(-0.92, aWL, H * 0.06, H, PILLAR);
    pillarBand(aWR, 0.84, H * 0.06, H, PILLAR);

    // 옆창 아래 도어 패널 (창턱 H*0.63) + B필러 + 그 너머 뒷좌석 창
    const doorPanel = (a0, a1) => {
      const x0 = sx(a0), x1 = sx(a1);
      ctx.fillStyle = DOOR;
      ctx.fillRect(Math.min(x0, x1), H * 0.63, Math.abs(x1 - x0), H);
      ctx.fillStyle = ROOF;
      ctx.fillRect(Math.min(x0, x1), H * 0.10, Math.abs(x1 - x0), H * 0.045);   // 창 위 프레임
    };
    doorPanel(-2.02, -0.92); doorPanel(0.84, 2.06);
    pillarBand(-2.18, -2.02, H * 0.05, H, PILLAR);              // B필러
    pillarBand(2.06, 2.22, H * 0.05, H, PILLAR);
    doorPanel(-2.85, -2.18); doorPanel(2.22, 2.9);              // 뒷좌석 창턱

    // 룸미러 (실내 — 맨 위) + 모구 참
    if (!off(0.30)) {
      const mc = this.mirrorCv.room;
      const mw = Math.min(W * 0.21, 330), mh = mw * (mc.height / mc.width);
      const x = sx(0.30), y = H * 0.115;
      ctx.fillStyle = '#111318';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - mw / 2 - 6, y - 6, mw + 12, mh + 12, 10) : ctx.rect(x - mw / 2 - 6, y - 6, mw + 12, mh + 12);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - mw / 2, y, mw, mh, 7) : ctx.rect(x - mw / 2, y, mw, mh);
      ctx.clip();
      ctx.drawImage(mc, x - mw / 2, y, mw, mh);
      ctx.restore();
      // 참: 모구 사진이 조향·시간에 따라 흔들린다
      if (this.mogu && this.mogu.complete) {
        const swing = Math.sin(t * 2.1) * 0.08 + st.car.steer * 0.35;
        const ch = H * 0.085, cw = ch * (this.mogu.naturalWidth / this.mogu.naturalHeight || 0.45);
        ctx.save();
        ctx.translate(x + mw * 0.28, y + mh + 4);
        ctx.rotate(swing);
        ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 8); ctx.stroke();
        ctx.drawImage(this.mogu, -cw / 2, 8, cw, ch);
        ctx.restore();
      }
    }

    // 핸들 — 조향각 × 스티어링비만큼 실제로 돈다
    if (!off(0)) {
      const x = sx(0), y = H * 1.02, R = H * 0.27;
      const th = (st.car.steer / M.CAR.LOCK) * (470 * Math.PI / 180);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.86);                                        // 컬럼 기울기
      ctx.rotate(th);
      ctx.strokeStyle = '#22252c'; ctx.lineWidth = H * 0.052; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#2c3038'; ctx.lineWidth = H * 0.030;
      for (const a of [Math.PI, 0, Math.PI / 2]) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92); ctx.stroke();
      }
      ctx.fillStyle = '#191c22';
      ctx.beginPath(); ctx.arc(0, 0, R * 0.24, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8a63a'; ctx.font = `800 ${Math.round(R * 0.2)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐾', 0, 0);
      ctx.restore();
    }
  },

  // ══ 탑다운 리플레이 ══
  startReplay(st) {
    const rec = st.rec;
    const dur = rec.length ? rec[rec.length - 1][0] : 0;
    this.replay = { clock: 0, dur, rate: Math.max(1.6, dur / 8), done: false, endT: 0 };
  },

  drawReplay(st, t, dt) {
    const rp = this.replay;
    if (!rp) return;
    const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
    const stage = st.stage, th = stage.theme, lot = stage.lot;
    if (!rp.done) rp.clock = Math.min(rp.dur, rp.clock + dt * rp.rate);

    const scale = Math.min(W / (lot.x1 - lot.x0 + 3), H / (lot.z1 - lot.z0 + 3));
    const mx = (lot.x0 + lot.x1) / 2, mz = (lot.z0 + lot.z1) / 2;
    const SX = (x) => W / 2 + (x - mx) * scale;
    const SY = (z) => H / 2 - (z - mz) * scale;

    ctx.fillStyle = shade(th.outside, 0.8);
    ctx.fillRect(0, 0, W, H);
    // 노면 (실사 아스팔트 패턴)
    ctx.save();
    ctx.beginPath();
    ctx.rect(SX(lot.x0), SY(lot.z1), (lot.x1 - lot.x0) * scale, (lot.z1 - lot.z0) * scale);
    ctx.clip();
    ctx.fillStyle = this.asphaltPat || th.asphalt;
    ctx.fillRect(SX(lot.x0), SY(lot.z1), (lot.x1 - lot.x0) * scale, (lot.z1 - lot.z0) * scale);
    ctx.restore();

    const poly = (pts, col, stroke, lw) => {
      ctx.beginPath();
      pts.forEach(([x, z], i) => { if (i === 0) ctx.moveTo(SX(x), SY(z)); else ctx.lineTo(SX(x), SY(z)); });
      ctx.closePath();
      if (col) { ctx.fillStyle = col; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
    };

    // 칸 마킹
    for (const s of stage.slots) {
      const cs4 = M.Logic.corners(s.x, s.z, s.w, s.l, s.yaw);
      if (s.target) {
        poly(cs4, `rgba(255,216,61,${0.18 + 0.1 * Math.sin(t * 3)})`, th.target, 3);
      } else poly(cs4, null, th.line, 1.5);
    }

    // 장애물
    for (const o of stage.obstacles) {
      const cs4 = M.Logic.corners(o.x, o.z, o.w, o.l, o.yaw);
      if (o.kind === 'car') this._carTop(ctx, SX, SY, scale, o.x, o.z, o.yaw, M.CAR_HUES[o.hue], 0);
      else if (o.kind === 'pillar') poly(cs4, th.wallC, '#000', 1);
      else if (o.kind === 'wall') poly(cs4, shade(th.wallC, 0.8));
      else if (o.kind === 'curb') poly(cs4, th.curbC);
      else if (o.kind === 'cone') {
        ctx.fillStyle = '#e06424';
        ctx.beginPath(); ctx.arc(SX(o.x), SY(o.z), Math.max(3, 0.2 * scale), 0, Math.PI * 2); ctx.fill();
      }
    }

    // 궤적 + 현재 포즈
    const rec = st.rec;
    if (rec.length) {
      ctx.strokeStyle = 'rgba(255,216,61,.85)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath();
      let last = rec[0];
      ctx.moveTo(SX(rec[0][1]), SY(rec[0][2]));
      for (const s of rec) { if (s[0] > rp.clock) break; ctx.lineTo(SX(s[1]), SY(s[2])); last = s; }
      ctx.stroke();
      // 보간 포즈
      let i = 0;
      while (i < rec.length - 1 && rec[i + 1][0] <= rp.clock) i++;
      const a = rec[i], b = rec[Math.min(i + 1, rec.length - 1)];
      const k = b[0] > a[0] ? clamp((rp.clock - a[0]) / (b[0] - a[0]), 0, 1) : 0;
      const cx0 = a[1] + (b[1] - a[1]) * k, cz0 = a[2] + (b[2] - a[2]) * k;
      const hh = a[3] + wrapPi(b[3] - a[3]) * k, sw = a[4] + (b[4] - a[4]) * k;
      this._carTop(ctx, SX, SY, scale, cx0, cz0, hh, PLAYER_COL, sw, true);
    }

    // 종료 연출
    if (rp.clock >= rp.dur) {
      rp.endT += dt;
      if (st.phase === 'crash' && st.crashAt) {
        const [bx, bz] = st.crashAt;
        ctx.fillStyle = '#ffd83d'; ctx.font = `900 ${Math.round(24 + Math.min(1, rp.endT) * 14)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('💥', SX(bx), SY(bz) + 10);
      } else if (st.phase === 'parked') {
        ctx.fillStyle = '#7de08a'; ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('★'.repeat(st.stars), SX(stage.target.x), SY(stage.target.z) - 14);
      }
      if (rp.endT > 1.2) rp.done = true;
    }

    // 리플레이 HUD
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = '#ffd83d'; ctx.font = '800 15px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`📼 리플레이 ×${rp.rate.toFixed(1)}`, 14, 26);
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.textAlign = 'right';
    ctx.fillText('클릭 / Enter — 건너뛰기', W - 14, 26);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(0, H - 6, W, 6);
    ctx.fillStyle = '#ffd83d';
    ctx.fillRect(0, H - 6, W * (rp.dur ? rp.clock / rp.dur : 1), 6);
  },

  // 탑다운 차량 (지붕 위 모구 + 조향각 앞바퀴)
  _carTop(ctx, SX, SY, scale, x, z, h, col, steer, isPlayer) {
    const C = M.CAR;
    ctx.save();
    ctx.translate(SX(x), SY(z));
    ctx.rotate(h);                                              // 화면 y가 -z라 헤딩 그대로
    const w = C.W * scale, l = C.L * scale;
    // 바퀴
    ctx.fillStyle = '#14161a';
    const wl = l * 0.16, ww = w * 0.16;
    for (const [px, pz, st2] of [[-w / 2 + ww * 0.4, -l * 0.31, 0], [w / 2 - ww * 0.4, -l * 0.31, 0],
      [-w / 2 + ww * 0.4, l * 0.31, steer || 0], [w / 2 - ww * 0.4, l * 0.31, steer || 0]]) {
      ctx.save(); ctx.translate(px, -pz); ctx.rotate(st2 || 0);
      ctx.fillRect(-ww / 2, -wl / 2, ww, wl);
      ctx.restore();
    }
    // 차체 + 캐빈
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-w / 2, -l / 2, w, l, w * 0.22) : ctx.rect(-w / 2, -l / 2, w, l);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = shade(col, 0.72);
    ctx.fillRect(-w * 0.38, -l * 0.28, w * 0.76, l * 0.5);
    ctx.fillStyle = 'rgba(40,60,80,.8)';
    ctx.fillRect(-w * 0.34, -l * 0.34, w * 0.68, l * 0.12);     // 앞유리 (위쪽 = 차 앞)
    if (isPlayer && this.mogu && this.mogu.complete) {
      const mh = l * 0.62, mw = mh * (this.mogu.naturalWidth / this.mogu.naturalHeight || 0.45);
      ctx.drawImage(this.mogu, -mw / 2, -mh / 2, mw, mh);
    }
    ctx.restore();
  },
};
