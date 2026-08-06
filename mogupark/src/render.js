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

// 사용자가 맞춘 미러 각도 (yaw = 좌우, pitch = 상하). ui.js 가 세이브에서 읽어 채운다.
M.MIRROR_ADJ_MAX = { yaw: 0.42, pitch: 0.26 };
M.mirrorAdj = { room: { yaw: 0, pitch: 0 }, left: { yaw: 0, pitch: 0 }, right: { yaw: 0, pitch: 0 } };

// 콕핏 오버레이에서 좌우 백미러를 그릴 방향 (눈 위치 기준 실제 각도).
// 고개를 HEAD_MIRROR(±1.22rad)만큼 돌리면 해당 미러가 화면 한가운데 오도록 맞춰 뒀다.
const A_MIRROR_L = -1.18, A_MIRROR_R = 1.30;

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
  recorder: null, clip: null, onClipReady: null,
  mogu: null, asphalt: null, asphaltPat: null, bgImgs: {},

  init(root) {
    this.cv = document.createElement('canvas');
    this.cv.id = 'game-canvas';
    root.insertBefore(this.cv, root.firstChild);
    this.ctx = this.cv.getContext('2d');
    for (const k of ['room', 'left', 'right']) {
      const c = document.createElement('canvas');
      c.width = k === 'room' ? 420 : 288; c.height = k === 'room' ? 154 : 194;
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
    const fit = () => {
      this.cv.width = window.innerWidth;
      this.cv.height = window.innerHeight;
      // 세로 화면에서는 1인칭 시야를 위쪽 띠로 제한하고 아래는 콘솔로 쓴다.
      // 전체 높이를 다 쓰면 세로 화각이 120°까지 벌어져 노면이 훅 휘어 보인다.
      const vh = this.viewH();
      document.documentElement.style.setProperty('--viewh', vh + 'px');
      document.body.classList.toggle('console', vh < this.cv.height - 40);
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
  },

  // ── 리플레이 화면 녹화 ──────────────────────────────────────────────
  // 캔버스 스트림을 MediaRecorder 로 받아 둔다. 방금 친 판의 리플레이만 저장하면
  // 되므로 판을 벗어나면 버린다. 지원 안 하는 브라우저에서는 조용히 꺼진다.
  clipMime() {
    if (typeof MediaRecorder === 'undefined' || !this.cv || !this.cv.captureStream) return '';
    for (const m of ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9',
                     'video/webm;codecs=vp8', 'video/webm']) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  },

  clipStart() {
    this.clipDrop();
    const mime = this.clipMime();
    if (!mime) return false;
    try {
      const stream = this.cv.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        this.clip = chunks.length ? { blob: new Blob(chunks, { type: mime }), mime } : null;
        stream.getTracks().forEach((tr) => tr.stop());
        if (this.onClipReady) this.onClipReady(this.clip);
      };
      rec.start();
      this.recorder = rec;
      return true;
    } catch (e) { return false; }
  },

  clipStop() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.recorder = null;
  },

  clipDrop() {
    this.clipStop();
    this.clip = null;
  },

  // 1인칭 시야로 쓸 높이. 가로 화면(=PC·가로 폰)에서는 캔버스 전체와 같다.
  viewH() {
    const W = this.cv.width, H = this.cv.height;
    return Math.round(Math.min(H, Math.max(W * 0.85, H * 0.42)));
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
    if (opts.main) this.carsOnScreen = 0;                        // 테스트용: 화면에 잡힌 주차 차량 수
    const units = [];
    for (const o of stage.obstacles) units.push({ x: o.x, z: o.z, o });
    if (opts.self) units.push({ x: st.car.x, z: st.car.z, self: true });
    for (const u of units) u.d = (u.x - cam.x) ** 2 + (u.z - cam.z) ** 2;
    units.sort((a, b) => b.d - a.d);
    for (const u of units) {
      if (u.self) { this._drawCarBoxes(ctx, cam, st.car.x, st.car.z, st.car.h, PLAYER_COL, th.dark); continue; }
      const o = u.o;
      if (o.kind === 'car') {
        this._drawCarBoxes(ctx, cam, o.x, o.z, o.yaw, M.CAR_HUES[o.hue], th.dark);
        if (opts.main) {
          const p = camPt(cam, o.x, 0.7, o.z);
          if (p[2] > NEAR) {
            const px = cam.cx + cam.f * p[0] / p[2], py = cam.cyp - cam.f * p[1] / p[2];
            if (px >= 0 && px <= W && py >= 0 && py <= H) this.carsOnScreen++;
          }
        }
      }
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

  // 주차 차량 — 상자 두 개면 멀리서 담벼락처럼 보여서, 바퀴·유리·지붕을 나눠 실루엣을 만든다
  _drawCarBoxes(ctx, cam, x, z, yaw, col, dark) {
    const C = M.CAR;
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];   // 차 로컬 → 월드
    const glass = dark ? '#252a33' : '#39434f';
    const tyre = dark ? '#121317' : '#1a1c20';

    // 바퀴 4개 — 차체보다 살짝 바깥으로 튀어나오게
    const wb = C.WB / 2, tw = C.W / 2 - 0.05;
    for (const [lx, lz] of [[-tw, wb], [tw, wb], [-tw, -wb], [tw, -wb]]) {
      const [wx, wz] = P(lx, lz);
      drawBox(ctx, cam, wx, wz, 0.0, 0.33, 0.22, 0.66, yaw, tyre, dark);
    }
    // 차체: 문턱(좁고 낮음) + 몸통
    drawBox(ctx, cam, x, z, 0.22, 0.44, C.W * 0.92, C.L * 0.97, yaw, shade(col, 0.72), dark);
    drawBox(ctx, cam, x, z, 0.30, 0.82, C.W, C.L, yaw, col, dark);
    // 캐빈: 유리띠 + 그 위 지붕 (뒤로 살짝 물러나 있음)
    const [gx, gz] = P(0, -0.28);
    drawBox(ctx, cam, gx, gz, 0.82, 1.26, C.W * 0.90, C.L * 0.50, yaw, glass, dark);
    drawBox(ctx, cam, gx, gz, 1.26, 1.40, C.W * 0.86, C.L * 0.46, yaw, shade(col, 0.92), dark);
    // 앞뒤 등 — 어느 쪽을 향한 차인지 한눈에 보이게
    const [tx, tz] = P(0, -C.L / 2 + 0.06);
    drawBox(ctx, cam, tx, tz, 0.52, 0.70, C.W * 0.86, 0.10, yaw, dark ? '#7a2018' : '#a8342a', dark);
    const [hx, hz] = P(0, C.L / 2 - 0.06);
    drawBox(ctx, cam, hx, hz, 0.50, 0.66, C.W * 0.84, 0.10, yaw, dark ? '#d8d2b8' : '#efe8cf', dark);
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
      // 사용자가 맞춘 각도를 더한다. 화면에 붙일 때 좌우 반전하므로 yaw 는 부호를 뒤집어야
      // "→ 를 누르면 보이는 범위가 오른쪽으로" 가 된다.
      const adj = M.mirrorAdj[k] || { yaw: 0, pitch: 0 };
      const cam = makeCam(mx, mdef.ly, mz, car.h + mdef.dyaw - adj.yaw,
        mdef.pitch + adj.pitch, mdef.fov, mc.width, mc.height);
      g.save();
      g.translate(mc.width, 0); g.scale(-1, 1);
      this.drawScene(g, cam, st, { self: mdef.self }, t);
      g.restore();
    }

    // 메인 뷰 — 세로 화면에서는 위쪽 띠(VH)만 1인칭 시야로 쓴다
    const VH = this.viewH();
    const [ex, ez] = px(EYE.x, EYE.z);
    const cam = makeCam(ex, EYE.y, ez, car.h + car.headYaw, 0.10, 76, W, VH);
    this.drawScene(ctx, cam, st, { self: false, main: true }, t);
    if (VH < H) { ctx.fillStyle = '#141519'; ctx.fillRect(0, VH, W, H - VH); }   // 아래는 콘솔

    this._drawCockpit(ctx, st, t, cam);

    // 주차 확인 링
    if (st.parkT > 0 && st.phase === 'run') {
      const p = Math.min(1, st.parkT / M.Logic.PARK_HOLD);
      ctx.save();
      ctx.translate(W / 2, VH * 0.30);
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
    const LIM = 1.35;                                            // tan 발산 방지 (±77°)
    const rel = (a) => wrapPi(a - hy);
    const xOf = (r) => cam.cx + f * Math.tan(clamp(r, -LIM, LIM));
    const sx = (a) => xOf(rel(a));
    const off = (a) => Math.abs(rel(a)) >= LIM;
    // 각도 구간 [a0,a1] → 화면 x 구간. 시야 밖이면 null.
    // wrapPi 만 쓰면 뒤통수 쪽 구간이 좌우로 갈라져 화면 전체를 덮는 검은 띠가 된다.
    const span = (a0, a1) => {
      let r0 = rel(a0), r1 = rel(a1);
      if (r1 - r0 > Math.PI) r1 -= Math.PI * 2;                  // 뒤로 감긴 구간을 펴 준다
      else if (r1 - r0 < -Math.PI) r1 += Math.PI * 2;
      if ((r0 > LIM && r1 > LIM) || (r0 < -LIM && r1 < -LIM)) return null;
      const x0 = xOf(r0), x1 = xOf(r1);
      if (Math.max(x0, x1) < 0 || Math.min(x0, x1) > W) return null;
      return [x0, x1];
    };

    const DASH = '#191b21', DOOR = '#22242b', PILLAR = '#101216', ROOF = '#0d0f13';
    const aWL = -0.80, aWR = 0.72;                              // 앞유리 좌/우 경계각

    // ── 옆면 실루엣 ──
    // |각도| → [벨트라인(창 아래) y비율, 루프라인(창 위) y비율].
    // 앞쪽은 창이 크고 낮게, 뒤로 갈수록 창턱이 올라오고 지붕이 내려앉는다 = 차 옆모습.
    // 예전엔 이게 전부 수평선이라 창틀이 그냥 네모난 세로 기둥처럼 보였다.
    // 앞끝(0.72)은 앞유리 지붕선(0.10H)과 같은 높이 — 안 맞추면 그 경계에 계단이 생긴다
    const SIDE = [[0.72, 0.672, 0.100], [0.90, 0.652, 0.150], [1.20, 0.618, 0.156],
                  [1.74, 0.590, 0.173], [2.30, 0.566, 0.199], [2.95, 0.552, 0.229]];
    const sideY = (aAbs) => {
      let i = 0;
      while (i < SIDE.length - 2 && aAbs > SIDE[i + 1][0]) i++;
      const A = SIDE[i], B = SIDE[i + 1];
      const u = clamp((aAbs - A[0]) / (B[0] - A[0]), 0, 1);
      return [H * (A[1] + (B[1] - A[1]) * u), H * (A[2] + (B[2] - A[2]) * u)];
    };
    const beltY = (a) => sideY(Math.abs(a))[0];
    // ±π 경계에서 끊기지 않는 연속 rel 열 (span()과 같은 이유)
    const relSeq = (as) => {
      const out = []; let prev = null;
      for (const a of as) {
        let r = rel(a);
        if (prev !== null) { while (r - prev > Math.PI) r -= Math.PI * 2; while (r - prev < -Math.PI) r += Math.PI * 2; }
        out.push(r); prev = r;
      }
      return out;
    };
    const allOut = (rs) => rs.every((r) => r > LIM) || rs.every((r) => r < -LIM);

    // 테스트용: 이번 프레임에 실제로 그려진 미러 위치와 필러 가로 구간
    this.mirrorRect = { left: null, right: null };
    this.pillarRect = [];

    // ── 좌우 백미러 (차 외부 — 실내 패널보다 먼저 그려 창틀이 덮게) ──
    // 창턱 위에 얹고 도어 쪽으로 암·세일패널을 뻗어 차체에 붙은 것처럼 보이게 한다.
    const mirror = (k, a, aMount, wPx) => {
      if (off(a)) return;
      const mc = this.mirrorCv[k];
      const x = sx(a), h = wPx * (mc.height / mc.width);
      if (x + wPx / 2 < 0 || x - wPx / 2 > W) return;             // 화면 밖이면 생략

      // 비스듬히 달린 거울이라 화면에는 평행사변형으로 맺힌다 — 바깥 모서리가 내려앉는 방향
      const mx = sx(aMount), sgn = Math.sign(mx - x) || 1;
      const skew = -0.17 * sgn;
      const drop = Math.abs(skew) * wPx / 2;                      // 기울어서 h보다 더 내려가는 만큼
      const y = beltY(a) - h - drop - H * 0.022;                  // 그만큼 띄워야 아래 모서리가 창턱에 안 잘린다
      this.mirrorRect[k] = { x: x - wPx / 2, y, w: wPx, h };

      const inner = x + sgn * wPx * 0.46;
      const dyInner = skew * (sgn * wPx * 0.46);                  // 기운 만큼 안쪽 모서리도 올라간다

      // 암 + 세일패널: 미러 안쪽 모서리 → 도어 앞 모서리(창턱)
      const my = beltY(aMount);
      ctx.fillStyle = '#20232a';
      ctx.beginPath();
      ctx.moveTo(inner, y + h * 0.28 + dyInner);
      ctx.lineTo(inner, y + h * 0.78 + dyInner);
      ctx.lineTo(mx, my + H * 0.010);
      ctx.lineTo(mx, my - H * 0.085);
      ctx.closePath(); ctx.fill();

      ctx.save();
      ctx.translate(x, y + h / 2);
      ctx.transform(1, skew, 0, 1, 0, 0);                         // 세로 전단 = 평행사변형
      const r = wPx * 0.10, gx = -wPx / 2, gy = -h / 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(gx - 5, gy - 5, wPx + 10, h + 10, r) : ctx.rect(gx - 5, gy - 5, wPx + 10, h + 10);
      ctx.fillStyle = '#15171c'; ctx.fill();
      // 유리 테두리만 평행사변형으로 자르고, 비친 장면은 수평 그대로 —
      // 지평선이 기울면 연석·차와의 간격을 눈으로 재기 어렵다
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(gx, gy, wPx, h, r * 0.7) : ctx.rect(gx, gy, wPx, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clip();
      ctx.drawImage(mc, x - wPx / 2, y, wPx, h);
      ctx.restore();
    };
    // 미러 각도는 눈 위치에서 본 실제 방향 (운전석이 왼쪽이라 우측 미러가 더 바깥)
    mirror('left', A_MIRROR_L, -0.92, Math.min(W * 0.19, 300));
    mirror('right', A_MIRROR_R, 0.84, Math.min(W * 0.19, 300));

    // ── 필러 — 위쪽이 뒤로 눕는 사선 (앞유리 레이크) ──
    const pillar = (a0, a1, lean, yTop) => {
      const rb = relSeq([a0, a1]), rt = relSeq([a0 + lean, a1 + lean]);
      if (allOut(rb) && allOut(rt)) return;
      const xb = rb.map(xOf), xt = rt.map(xOf);
      const lo = Math.min(xb[0], xb[1], xt[0], xt[1]), hi = Math.max(xb[0], xb[1], xt[0], xt[1]);
      if (hi < 0 || lo > W) return;
      // 기록은 '창 높이에서의' 가로 구간 — 기울어진 필러의 전체 바운딩박스는 실제보다 넓다
      const u = (H * 0.35 - yTop) / (H - yTop);
      this.pillarRect.push([Math.min(xt[0] + (xb[0] - xt[0]) * u, xt[1] + (xb[1] - xt[1]) * u),
                            Math.max(xt[0] + (xb[0] - xt[0]) * u, xt[1] + (xb[1] - xt[1]) * u)]);
      if (hi - lo > 2) {
        const g = ctx.createLinearGradient(lo, 0, hi, 0);
        g.addColorStop(0, PILLAR); g.addColorStop(0.34, '#2b2e36');
        g.addColorStop(0.62, '#1b1e25'); g.addColorStop(1, PILLAR);
        ctx.fillStyle = g;
      } else ctx.fillStyle = PILLAR;
      ctx.beginPath();
      ctx.moveTo(xt[0], yTop); ctx.lineTo(xt[1], yTop);
      ctx.lineTo(xb[1], H); ctx.lineTo(xb[0], H);
      ctx.closePath(); ctx.fill();
    };
    pillar(-0.92, aWL, -0.20, H * 0.05);                        // A필러 (윗쪽이 뒤로)
    pillar(aWR, 0.84, 0.20, H * 0.05);
    // B필러는 좌석 기준 ≈100°. 예전엔 116~125°에 있어서 어깨너머(±117°)가 필러를
    // 정면으로 보게 됐고, 화면 한가운데 검은 세로 띠만 남았다. 이제 그 각도는 뒷좌석 창이다.
    pillar(-1.86, -1.70, -0.05, H * 0.05);                      // B필러 (거의 수직)
    pillar(1.70, 1.86, 0.05, H * 0.05);

    // ── 옆면 차체: 벨트라인 아래(도어) / 루프라인 위(헤더) ──
    // 필러 뒤에 그려서 창틀이 필러 끝을 덮고, 창 구멍만 남는다.
    const sideBody = (sgn) => {
      const N = 18, A0 = 0.72, A1 = 2.95, as = [];
      for (let i = 0; i <= N; i++) as.push(sgn * (A0 + (A1 - A0) * i / N));
      const rs = relSeq(as);
      if (allOut(rs)) return;
      const xs = rs.map(xOf), ys = as.map((a) => sideY(Math.abs(a)));
      const band = (idx, closeY) => {
        ctx.beginPath();
        ctx.moveTo(xs[0], ys[0][idx]);
        for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i][idx]);
        ctx.lineTo(xs[xs.length - 1], closeY); ctx.lineTo(xs[0], closeY);
        ctx.closePath(); ctx.fill();
      };
      ctx.fillStyle = DOOR; band(0, H);
      ctx.fillStyle = ROOF; band(1, 0);
    };
    sideBody(-1); sideBody(1);

    // 지붕 (앞유리 위)
    ctx.fillStyle = ROOF; ctx.fillRect(0, 0, W, H * 0.10);

    // 대시보드 (앞유리 아래) — 좌우 필러 사이를 곡선으로 잇는다.
    // 콘솔 띠가 따로 있으면(세로 화면) 대시는 얇게 — 시야 띠를 최대한 장면에 쓴다.
    const CONS = this.cv.height - H;
    const dashTop = CONS > 40 ? 0.80 : 0.585;
    const sDash = span(aWL, aWR);
    if (sDash) {
      const [xL, xR] = sDash;
      ctx.fillStyle = DASH;
      ctx.beginPath();
      ctx.moveTo(xL, H * dashTop);
      ctx.quadraticCurveTo((xL + xR) / 2, H * (dashTop + 0.075), xR, H * dashTop);
      ctx.lineTo(xR, H); ctx.lineTo(xL, H);
      ctx.closePath(); ctx.fill();
    }

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

    // 핸들 — 조향각 × 스티어링비만큼 실제로 돈다.
    // 콘솔 띠가 있으면 그 아래쪽에 크게 놓아 빈 공간이 남지 않게 한다.
    if (!off(0)) {
      const x = sx(0);
      const y = CONS > 40 ? H + CONS * 0.66 : H * 1.02;
      const R = CONS > 40 ? Math.min(W * 0.34, CONS * 0.40) : H * 0.27;
      const th = (st.car.steer / M.CAR.LOCK) * (470 * Math.PI / 180);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.86);                                        // 컬럼 기울기
      ctx.rotate(th);
      ctx.strokeStyle = '#22252c'; ctx.lineWidth = R * 0.19; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#2c3038'; ctx.lineWidth = R * 0.11;
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
