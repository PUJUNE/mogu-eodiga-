// render.js — 캔버스 렌더: 물속 배경·어군·모구 다이버·보스·HUD
const M = window.MDV;

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (c0, c1, t) => {
  const a = hex(c0), b = hex(c1);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
};

M.Render = {
  cv: null, ctx: null, camX: 0, camY: 0, fx: [], bub: [],

  init(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.fx = []; this.bub = [];
    for (let i = 0; i < 26; i++) {
      this.bub.push({ x: Math.random() * M.WORLD_W, y: Math.random() * 900, r: 0.8 + Math.random() * 1.8, s: 8 + Math.random() * 16 });
    }
    // CC0 에셋 (ansimuz "Underwater Diving Pack"): 원경 타일·암초 미드그라운드·해저 소품
    this.imgs = {};
    for (const k of ['uwdBg', 'uwdMid', 'uwdProps']) {
      if (!M.ASSETS[k]) continue;
      const im2 = new Image();
      im2.onload = () => {
        this.imgs[k] = im2;
        if (k === 'uwdMid') {
          // 상단 페이드 마스크 (이미지 직사각 경계가 수평선으로 잘려 보이는 것 방지)
          const topFade = (cv2) => {
            const c3 = cv2.getContext('2d');
            c3.globalCompositeOperation = 'destination-out';
            const g2 = c3.createLinearGradient(0, 0, 0, 90);
            g2.addColorStop(0, 'rgba(0,0,0,1)');
            g2.addColorStop(1, 'rgba(0,0,0,0)');
            c3.fillStyle = g2;
            c3.fillRect(0, 0, cv2.width, 90);
            c3.globalCompositeOperation = 'source-over';
          };
          // 원거리 실루엣 층 (형상만 남기고 짙은 남색 채움)
          const oc = document.createElement('canvas');
          oc.width = im2.width; oc.height = im2.height;
          const c2 = oc.getContext('2d');
          c2.drawImage(im2, 0, 0);
          c2.globalCompositeOperation = 'source-in';
          c2.fillStyle = '#081426';
          c2.fillRect(0, 0, oc.width, oc.height);
          topFade(oc);
          this.midSil = oc;
          // 근거리 실채색 층 (같은 페이드 적용본)
          const oc2 = document.createElement('canvas');
          oc2.width = im2.width; oc2.height = im2.height;
          oc2.getContext('2d').drawImage(im2, 0, 0);
          topFade(oc2);
          this.midFade = oc2;
        }
      };
      im2.src = M.ASSETS[k];
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  // 소품 시트 소스 좌표 (알파 바운딩 자동 측정값)
  PROPS: {
    log:       [49, 95, 85, 98],
    arch:      [177, 34, 198, 205],
    totem:     [432, 41, 92, 219],
    totemMoss: [596, 41, 120, 219],
    ruins:     [752, 70, 245, 186],
    coralSm:   [434, 260, 128, 123],
    seaweed:   [614, 260, 82, 124],
  },
  drawProp(name, X, Y, sc) {
    // Y = 소품 밑변(바닥 접점) 화면 좌표
    const im2 = this.imgs && this.imgs.uwdProps;
    if (!im2) return false;
    const [px, py, pw, ph] = this.PROPS[name];
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.drawImage(im2, px, py, pw, ph, X - pw * sc / 2, Y - ph * sc, pw * sc, ph * sc);
    c.imageSmoothingEnabled = true;
    return true;
  },

  resize() {
    const W = M.W, H = M.H;
    let s = Math.min(window.innerWidth / W, window.innerHeight / H);
    s = s >= 2 ? Math.floor(s) : Math.max(0.6, s * 0.97);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    const res = Math.min(4, Math.max(1, s * (window.devicePixelRatio || 1)));
    this.cv.width = Math.round(W * res);
    this.cv.height = Math.round(H * res);
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
  },

  addSpark(x, y) { for (let i = 0; i < 5; i++) this.fx.push({ kind: 'spark', x, y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, t: 0.28 }); },
  addPuff(x, y, color) { for (let i = 0; i < 7; i++) this.fx.push({ kind: 'puff', x, y, vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, t: 0.6, color }); },
  addFloat(x, y, text, color) { this.fx.push({ kind: 'float', x, y, vx: 0, vy: -26, t: 1.0, text, color }); },
  addRing(x, y, r, color) { this.fx.push({ kind: 'ring', x, y, r, t: 0.35, color }); },
  addBubbles(x, y, n) { for (let i = 0; i < n; i++) this.fx.push({ kind: 'bubble', x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 16, vy: -30 - Math.random() * 25, t: 0.9 }); },

  draw(st, t, dt) {
    const c = this.ctx, W = M.W, H = M.H;
    const S = st.stage, D = S.depth, p = st.p;
    // 카메라
    this.camX = Math.max(0, Math.min(M.WORLD_W - W, p.x - W / 2));
    this.camY = Math.max(-40, Math.min(D - H + 24, p.y - H * 0.45));
    const cx = this.camX, cy = this.camY;
    const sx = (x) => x - cx, sy = (y) => y - cy;

    // ── 하늘 + 물 ──
    const th = S.theme;
    if (cy < M.SURF) {
      c.fillStyle = '#cfe8fa';
      c.fillRect(0, 0, W, sy(M.SURF));
      c.fillStyle = '#ffe9a0';
      c.beginPath(); c.arc(sx(cx + W - 70), sy(cy) + 26, 16, 0, Math.PI * 2); c.fill();
    }
    const t0 = Math.max(0, cy) / D, t1 = Math.min(1, (cy + H) / D);
    const g = c.createLinearGradient(0, Math.max(0, sy(M.SURF)), 0, H);
    g.addColorStop(0, mix(th.w0, th.deep, t0));
    g.addColorStop(1, mix(th.w0, th.deep, t1));
    c.fillStyle = g;
    c.fillRect(0, Math.max(0, sy(M.SURF)), W, H);

    // 수면 물결
    if (cy < M.SURF + 10) {
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.6;
      c.beginPath();
      for (let x = 0; x <= W; x += 8) c.lineTo(x, sy(M.SURF) + Math.sin((x + cx) * 0.06 + t * 2.2) * 1.6);
      c.stroke();
    }
    // 빛줄기 (얕은 곳 — 물결 따라 흔들림)
    if (cy < 190) {
      c.save();
      c.globalAlpha = Math.max(0, 0.2 - cy / 900);
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const swy = Math.sin(t * 0.4 + i * 1.7) * 10;
        const bx = ((i * 260 + 80 - cx * 0.6) % (W + 200)) - 100;
        c.beginPath();
        c.moveTo(bx, sy(M.SURF)); c.lineTo(bx + 34, sy(M.SURF));
        c.lineTo(bx + 90 + swy, H); c.lineTo(bx + 26 + swy, H);
        c.closePath(); c.fill();
      }
      c.restore();
    }

    // ── 원경 암초 층 (CC0 미드그라운드 — 실루엣 원거리 + 실채색 근거리) ──
    // 형상은 팩 아트, 깊이감은 기존 2겹 패럴랙스 문법 유지
    if (this.imgs && this.imgs.uwdMid) {
      c.imageSmoothingEnabled = false;
      if (cy < M.SURF + 30) {            // 아주 얕은 곳: 원경 타일 띠
        const bg = this.imgs.uwdBg;
        if (bg) {
          c.save(); c.globalAlpha = 0.3;
          const bw = bg.width, off = ((cx * 0.12) % bw + bw) % bw;
          for (let x = -off; x < W; x += bw) c.drawImage(bg, x, sy(M.SURF) + 6, bw, bg.height);
          c.restore();
        }
      }
      for (const L2 of [{ img: this.midSil, pf: 0.3, a: 0.5, sc: 0.72 },
                        { img: this.midFade || this.imgs.uwdMid, pf: 0.55, a: 0.85, sc: 0.6 }]) {
        if (!L2.img) continue;
        const iw = L2.img.width * L2.sc, ih = L2.img.height * L2.sc;
        const yb = sy(D + 8);
        if (yb - ih > H + 20 || yb < -20) continue;
        const off = ((cx * L2.pf) % iw + iw) % iw;
        c.save(); c.globalAlpha = L2.a;
        for (let x = -off; x < W + iw; x += iw) c.drawImage(L2.img, x, yb - ih, iw, ih);
        c.restore();
      }
      c.imageSmoothingEnabled = true;
    } else {
      // 이미지 미로드 폴백: 기존 실루엣 기둥
      for (const L2 of [{ pf: 0.3, a: 0.22 }, { pf: 0.55, a: 0.38 }]) {
        const gx = cx * L2.pf;
        c.fillStyle = `rgba(5,16,32,${L2.a})`;
        for (let i = -1; i < 8; i++) {
          const seg = Math.floor(gx / 150) + i;
          const h2 = (seg * 2654435761) >>> 7;
          const x = seg * 150 - gx + (h2 % 60);
          const wdt = 26 + (h2 % 36);
          const hgt = 80 + (h2 % 240);
          const yb = sy(D - 6);
          if (yb - hgt > H + 20 || yb < -20) continue;
          c.beginPath();
          c.moveTo(x - wdt / 2, yb);
          c.quadraticCurveTo(x - wdt / 2 + 5, yb - hgt, x + Math.sin(seg) * 5, yb - hgt - 10);
          c.quadraticCurveTo(x + wdt / 2 - 5, yb - hgt, x + wdt / 2, yb);
          c.closePath(); c.fill();
        }
      }
    }

    // ── 원경 물고기 떼 실루엣 (비상호작용) ──
    c.fillStyle = 'rgba(8,22,40,.4)';
    for (let s2 = 0; s2 < 3; s2++) {
      const dir = s2 % 2 ? 1 : -1;
      const wx = (((s2 * 430 + t * 16 * dir) % (M.WORLD_W + 240)) + M.WORLD_W + 240) % (M.WORLD_W + 240) - 120;
      const wy = M.SURF + 80 + ((s2 * 217) % Math.max(120, D - 220));
      const X0 = wx - cx * 0.5, Y0 = sy(wy);
      if (X0 < -80 || X0 > W + 80 || Y0 < -40 || Y0 > H + 40) continue;
      for (let k = 0; k < 9; k++) {
        const fx2 = X0 + (k % 3) * 13 + Math.floor(k / 3) * 11;
        const fy2 = Y0 + (k % 3) * 7 - Math.floor(k / 3) * 5 + Math.sin(t * 3 + k) * 2;
        c.beginPath();
        c.ellipse(fx2, fy2, 3.4, 1.6, 0, 0, Math.PI * 2);
        c.moveTo(fx2 - dir * 3, fy2);
        c.lineTo(fx2 - dir * 6, fy2 - 2); c.lineTo(fx2 - dir * 6, fy2 + 2);
        c.closePath(); c.fill();
      }
    }

    // ── 배경 장식 (시드 고정) ──
    const rng = M.makeRng(st.no * 991 + 5);
    for (let i = 0; i < 26; i++) {
      const dx0 = rng.range(20, M.WORLD_W - 20), dy0 = rng.range(M.SURF + 80, D - 26), kind = rng.int(0, 2), sc = rng.range(0.7, 1.5);
      const X = sx(dx0), Y = sy(dy0);
      if (X < -40 || X > W + 40 || Y < -40 || Y > H + 40) continue;
      c.save(); c.globalAlpha = 0.62;
      if (kind === 0) {           // 산호 덤불 (CC0 소품)
        if (!this.drawProp('coralSm', X, Y + 4, 0.22 * sc)) {
          c.fillStyle = 'rgba(20,40,60,.8)';
          c.beginPath(); c.ellipse(X, Y, 12 * sc, 7 * sc, 0, 0, Math.PI * 2); c.fill();
        }
      } else if (kind === 1) {    // 해초 (프로시저럴 — 물결 애니메이션 유지)
        c.strokeStyle = th.accent; c.lineWidth = 2 * sc;
        c.beginPath();
        for (let k = 0; k <= 4; k++) c.lineTo(X + Math.sin(t * 1.4 + i + k) * 3, Y - k * 7 * sc);
        c.stroke();
      } else {                    // 해초 다발 (CC0 소품)
        if (!this.drawProp('seaweed', X, Y + 4, 0.26 * sc)) {
          c.fillStyle = th.accent;
          c.fillRect(X - 3 * sc, Y - 8 * sc, 6 * sc, 8 * sc);
          c.fillRect(X - 8 * sc, Y - 4 * sc, 5 * sc, 4 * sc);
        }
      }
      c.restore();
    }

    // ── 바닥 ──
    if (sy(D) < H + 30) {
      c.fillStyle = th.sand;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) c.lineTo(x, sy(D - 10) + Math.sin((x + cx) * 0.05) * 4);
      c.lineTo(W, H);
      c.closePath(); c.fill();
      // 커스틱 (얕은 바다 — 일렁이는 빛 그물)
      if (st.no <= 3) {
        c.strokeStyle = 'rgba(255,255,255,.14)';
        c.lineWidth = 1.2;
        for (let i = 0; i < 7; i++) {
          const x = ((i * 90 - cx) % (W + 80) + W + 80) % (W + 80) - 40;
          const ph = t * 1.6 + i * 1.3;
          c.beginPath();
          c.ellipse(x + Math.sin(ph) * 8, sy(D - 8) + (i % 3), 16 + Math.sin(ph * 1.3) * 5, 3.4, 0, 0, Math.PI * 2);
          c.stroke();
        }
      }
    }

    // ── 해저 대형 소품 (CC0 — 고대 토템·유적·산호 아치, 스테이지 시드 고정) ──
    if (sy(D) < H + 260 && this.imgs && this.imgs.uwdProps) {
      const rng2 = M.makeRng(st.no * 77 + 3);
      const kinds = ['totemMoss', 'ruins', 'arch', 'totem', 'log'];
      for (let i = 0; i < 3; i++) {
        const wx = rng2.range(90, M.WORLD_W - 90);
        const name = kinds[(st.no + i * 2) % kinds.length];
        const sc = rng2.range(0.5, 0.75);
        const X = sx(wx), Y = sy(D + 4);
        if (X < -160 || X > W + 160) continue;
        c.save(); c.globalAlpha = 0.92;
        this.drawProp(name, X, Y, sc);
        c.restore();
      }
    }

    // ── 보트 (하역 지점) ──
    if (cy < M.SURF + 40) {
      const bx = sx(M.BOAT_X), by = sy(M.SURF);
      c.fillStyle = '#8a5a30';
      c.beginPath();
      c.moveTo(bx - 42, by - 4); c.lineTo(bx + 42, by - 4);
      c.lineTo(bx + 30, by + 12); c.lineTo(bx - 30, by + 12);
      c.closePath(); c.fill();
      c.fillStyle = '#b07a48'; c.fillRect(bx - 42, by - 8, 84, 5);
      c.fillStyle = '#d8b880'; c.fillRect(bx - 14, by - 20, 26, 13);      // 바구니
      c.strokeStyle = '#8a6a40'; c.lineWidth = 1.2; c.strokeRect(bx - 14, by - 20, 26, 13);
      c.fillStyle = '#ff5a5a';
      c.beginPath(); c.moveTo(bx - 36, by - 30); c.lineTo(bx - 22, by - 25); c.lineTo(bx - 36, by - 20); c.closePath(); c.fill();
      c.strokeStyle = '#6a4a28'; c.beginPath(); c.moveTo(bx - 36, by - 30); c.lineTo(bx - 36, by - 8); c.stroke();
      if (p.carry) {              // 하역 유도 화살표
        c.fillStyle = 'rgba(255,216,61,' + (0.5 + 0.4 * Math.sin(t * 5)) + ')';
        c.beginPath(); c.moveTo(bx, by + 20); c.lineTo(bx - 7, by + 30); c.lineTo(bx + 7, by + 30); c.closePath(); c.fill();
      }
    }

    // ── 배경 기포 ──
    c.fillStyle = 'rgba(255,255,255,.35)';
    for (const b of this.bub) {
      b.y -= b.s * dt;
      if (b.y < M.SURF) { b.y = D - 10; b.x = Math.random() * M.WORLD_W; }
      const X = sx(b.x), Y = sy(b.y);
      if (X < -8 || X > W + 8 || Y < -8 || Y > H + 8) continue;
      c.beginPath(); c.arc(X, Y, b.r, 0, Math.PI * 2); c.fill();
    }
    // ── 마린 스노우 (부유 입자) ──
    c.fillStyle = 'rgba(215,232,250,.28)';
    for (let i = 0; i < 26; i++) {
      const x = ((i * 191 - cx * 0.85) % (W + 20) + W + 20) % (W + 20) - 10;
      const y = ((i * 127 + t * 8 - cy * 0.85) % (H + 20) + H + 20) % (H + 20) - 10;
      c.fillRect(x + Math.sin(t * 0.9 + i) * 4, y, 1.4, 1.4);
    }

    // ── 어군 ──
    for (const f of st.fish) this.drawFish(c, st, f, sx(f.x), sy(f.y), t);

    // ── 보스 ──
    if (st.boss) this.drawBoss(c, st, st.boss, sx(st.boss.x), sy(st.boss.y), t);

    // ── 투사체 ──
    for (const sh of st.shots) {
      const X = sx(sh.x), Y = sy(sh.y);
      if (sh.kind === 'spike') {
        c.save(); c.translate(X, Y); c.rotate(Math.atan2(sh.vy, sh.vx));
        c.fillStyle = '#f0e8c0';
        c.beginPath(); c.moveTo(6, 0); c.lineTo(-4, -3); c.lineTo(-4, 3); c.closePath(); c.fill();
        c.restore();
      } else {
        c.fillStyle = st.stage.boss.shot || '#2a2038';
        c.beginPath(); c.arc(X, Y, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(42,32,56,.35)';
        c.beginPath(); c.arc(X - sh.vx * 0.04, Y - sh.vy * 0.04, 3.4, 0, Math.PI * 2); c.fill();
      }
    }

    // ── 플레이어 (모구 다이버) ──
    this.drawCat(c, st, sx(p.x), sy(p.y), t);

    // ── FX ──
    for (const f of this.fx) {
      f.t -= dt; f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
      const X = sx(f.x), Y = sy(f.y), a = Math.max(0, f.t / 0.4);
      if (f.kind === 'spark') {
        c.fillStyle = `rgba(255,240,180,${Math.min(1, a)})`;
        c.fillRect(X - 1.5, Y - 1.5, 3, 3);
      } else if (f.kind === 'puff') {
        c.fillStyle = f.color || 'rgba(200,220,255,.5)';
        c.globalAlpha = Math.min(1, f.t / 0.6);
        c.beginPath(); c.arc(X, Y, 3 + (0.6 - f.t) * 8, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      } else if (f.kind === 'float') {
        c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
        c.globalAlpha = Math.min(1, f.t);
        c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2.5; c.strokeText(f.text, X, Y);
        c.fillStyle = f.color || '#ffd83d'; c.fillText(f.text, X, Y);
        c.globalAlpha = 1;
      } else if (f.kind === 'ring') {
        c.strokeStyle = f.color || 'rgba(255,255,255,.8)';
        c.globalAlpha = Math.min(1, f.t / 0.35);
        c.lineWidth = 2;
        c.beginPath(); c.arc(X, Y, f.r * (1 - f.t / 0.35 * 0.4 + 0.6), 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
      } else if (f.kind === 'bubble') {
        c.fillStyle = `rgba(220,240,255,${Math.min(1, f.t)})`;
        c.beginPath(); c.arc(X, Y, 1.6, 0, Math.PI * 2); c.fill();
      }
    }
    this.fx = this.fx.filter((f) => f.t > 0);

    // 심도 어둠 (깊을수록) + 심해 랜턴 글로우
    const dark = Math.max(0, Math.min(0.5, (p.y / D - 0.35) * 0.75)) * (st.no >= 4 ? 1.25 : 1);
    if (dark > 0.02) {
      if (st.no >= 4) {
        const lg = c.createRadialGradient(sx(p.x), sy(p.y), 4, sx(p.x), sy(p.y), 85);
        lg.addColorStop(0, `rgba(255,222,150,${0.16 * dark / 0.5})`);
        lg.addColorStop(1, 'rgba(255,222,150,0)');
        c.fillStyle = lg;
        c.fillRect(sx(p.x) - 90, sy(p.y) - 90, 180, 180);
      }
      const vg = c.createRadialGradient(sx(p.x), sy(p.y), 60, sx(p.x), sy(p.y), 240);
      vg.addColorStop(0, 'rgba(0,0,10,0)');
      vg.addColorStop(1, `rgba(0,0,12,${dark})`);
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
    }

    this.drawHud(c, st, t);
  },

  // ── 물고기 ──
  drawFish(c, st, f, X, Y, t) {
    if (X < -40 || X > M.W + 40 || Y < -40 || Y > M.H + 40) return;
    const F = M.FISH[f.type];
    const w = F.w, dir = f.dead ? 1 : f.dir;
    c.save();
    c.translate(X, Y);
    if (f.dead) { c.rotate(Math.PI); c.globalAlpha = 0.85; }
    c.scale(dir, 1);
    if (F.kind === 'jelly') {
      c.globalAlpha = 0.75;
      c.fillStyle = F.body;
      c.beginPath(); c.arc(0, 0, w * 0.55, Math.PI, 0); c.fill();
      c.strokeStyle = F.belly; c.lineWidth = 1.4;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(i * 3, 1);
        c.quadraticCurveTo(i * 3 + Math.sin(t * 3 + i) * 3, 7, i * 3 + Math.sin(t * 3 + i + 1) * 4, 13);
        c.stroke();
      }
    } else if (F.kind === 'squid') {
      c.fillStyle = F.body;
      c.beginPath(); c.moveTo(w * 0.7, 0); c.lineTo(-w * 0.1, -w * 0.32); c.lineTo(-w * 0.1, w * 0.32); c.closePath(); c.fill();
      c.strokeStyle = F.belly; c.lineWidth = 1.6;
      for (let i = -1; i <= 1; i++) {
        c.beginPath(); c.moveTo(-w * 0.08, i * 3); c.lineTo(-w * 0.55 - Math.sin(t * 5 + i) * 2, i * 4); c.stroke();
      }
      c.fillStyle = '#222'; c.beginPath(); c.arc(w * 0.24, -2, 1.6, 0, Math.PI * 2); c.fill();
    } else if (F.kind === 'ray') {
      c.fillStyle = F.body;
      c.beginPath();
      c.moveTo(w * 0.55, 0); c.quadraticCurveTo(0, -w * 0.5, -w * 0.4, 0); c.quadraticCurveTo(0, w * 0.5, w * 0.55, 0);
      c.closePath(); c.fill();
      c.strokeStyle = F.body; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-w * 0.38, 0); c.lineTo(-w * 0.8, Math.sin(t * 4) * 3); c.stroke();
      c.fillStyle = '#222'; c.beginPath(); c.arc(w * 0.3, -2, 1.5, 0, Math.PI * 2); c.fill();
    } else {
      // 일반 어형 (상어 포함)
      const sh = F.kind === 'shark';
      c.fillStyle = F.body;
      c.beginPath(); c.ellipse(0, 0, w * 0.55, w * 0.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = F.belly;
      c.beginPath(); c.ellipse(w * 0.06, w * 0.1, w * 0.42, w * 0.17, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = F.body;
      const tw = Math.sin(t * 8 + f.wob) * 0.15;
      c.beginPath();
      c.moveTo(-w * 0.45, 0);
      c.lineTo(-w * 0.85, -w * (0.3 + tw));
      c.lineTo(-w * 0.85, w * (0.3 - tw));
      c.closePath(); c.fill();
      if (sh) {
        c.beginPath(); c.moveTo(-w * 0.05, -w * 0.26); c.lineTo(w * 0.12, -w * 0.55); c.lineTo(w * 0.22, -w * 0.24); c.closePath(); c.fill();
        c.fillStyle = '#fff';
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(w * 0.2 + i * 4, w * 0.12); c.lineTo(w * 0.23 + i * 4, w * 0.22); c.lineTo(w * 0.26 + i * 4, w * 0.12); c.closePath(); c.fill(); }
      }
      if (F.stripes) {
        c.fillStyle = 'rgba(255,255,255,.65)';
        c.fillRect(-w * 0.12, -w * 0.26, w * 0.1, w * 0.52);
        c.fillRect(w * 0.14, -w * 0.24, w * 0.09, w * 0.48);
      }
      if (F.glow) {
        c.fillStyle = `rgba(255,230,120,${0.5 + 0.4 * Math.sin(t * 4 + f.wob)})`;
        c.beginPath(); c.arc(w * 0.62, -w * 0.3, 2.2, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#222';
      c.beginPath(); c.arc(w * 0.32, -w * 0.08, sh ? 2 : 1.6, 0, Math.PI * 2); c.fill();
    }
    if (f.dead) {                 // X자 눈
      c.strokeStyle = '#222'; c.lineWidth = 1.2;
      const ex = w * 0.32, ey = -w * 0.08;
      c.beginPath(); c.moveTo(ex - 2.4, ey - 2.4); c.lineTo(ex + 2.4, ey + 2.4);
      c.moveTo(ex + 2.4, ey - 2.4); c.lineTo(ex - 2.4, ey + 2.4); c.stroke();
    }
    c.restore();
  },

  // ── 보스 ──
  drawBoss(c, st, b, X, Y, t) {
    const B = st.stage.boss, w = b.w;
    c.save();
    c.translate(X, Y);
    if (b.dead) { c.rotate(Math.PI); c.globalAlpha = 0.8; }
    const tele = b.state === 'tele';
    if (tele && Math.floor(t * 12) % 2 === 0) c.globalAlpha = 0.65;
    c.scale(b.face || 1, 1);
    if (b.kind === 'puffer') {
      const puff = tele ? 1.25 : 1;
      c.fillStyle = B.body;
      c.beginPath(); c.arc(0, 0, w * 0.42 * puff, 0, Math.PI * 2); c.fill();
      c.fillStyle = B.belly;
      c.beginPath(); c.arc(0, w * 0.1, w * 0.3 * puff, 0, Math.PI); c.fill();
      c.strokeStyle = '#a08840'; c.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r0 = w * 0.42 * puff, r1 = r0 + (tele ? 8 : 4);
        c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke();
      }
      c.fillStyle = '#222'; c.beginPath(); c.arc(w * 0.18, -w * 0.12, 3, 0, Math.PI * 2); c.fill();
    } else if (b.kind === 'eel') {
      c.strokeStyle = B.body; c.lineWidth = w * 0.28; c.lineCap = 'round';
      c.beginPath();
      for (let k = 0; k <= 6; k++) c.lineTo(-k * w * 0.16, Math.sin(t * 5 - k * 0.9) * w * 0.16);
      c.stroke();
      c.strokeStyle = B.belly; c.lineWidth = w * 0.1;
      c.beginPath();
      for (let k = 0; k <= 6; k++) c.lineTo(-k * w * 0.16, Math.sin(t * 5 - k * 0.9) * w * 0.16 + w * 0.05);
      c.stroke();
      if (tele) {
        c.strokeStyle = `rgba(255,255,120,${0.5 + 0.5 * Math.sin(t * 20)})`;
        c.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const a = t * 10 + i * 1.3;
          c.beginPath(); c.moveTo(Math.cos(a) * w * 0.3, Math.sin(a) * w * 0.3); c.lineTo(Math.cos(a) * w * 0.5, Math.sin(a) * w * 0.5); c.stroke();
        }
      }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(w * 0.06, -w * 0.06, 3.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#222'; c.beginPath(); c.arc(w * 0.08, -w * 0.06, 1.8, 0, Math.PI * 2); c.fill();
    } else if (b.kind === 'angler') {
      c.fillStyle = B.body;
      c.beginPath(); c.ellipse(0, 0, w * 0.5, w * 0.34, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = B.belly;
      c.beginPath(); c.ellipse(0, w * 0.12, w * 0.4, w * 0.18, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = B.body; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(w * 0.2, -w * 0.3); c.quadraticCurveTo(w * 0.45, -w * 0.62, w * 0.55, -w * 0.42); c.stroke();
      c.fillStyle = `rgba(255,230,120,${0.6 + 0.4 * Math.sin(t * 6)})`;
      c.beginPath(); c.arc(w * 0.55, -w * 0.42, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(w * 0.12 + i * 5, w * 0.16); c.lineTo(w * 0.15 + i * 5, w * 0.3); c.lineTo(w * 0.18 + i * 5, w * 0.16); c.closePath(); c.fill(); }
      c.fillStyle = '#ffd83d'; c.beginPath(); c.arc(w * 0.26, -w * 0.1, 2.6, 0, Math.PI * 2); c.fill();
    } else if (b.kind === 'squid') {
      c.fillStyle = B.body;
      c.beginPath(); c.moveTo(w * 0.62, 0); c.lineTo(-w * 0.05, -w * 0.34); c.lineTo(-w * 0.05, w * 0.34); c.closePath(); c.fill();
      c.strokeStyle = B.belly; c.lineWidth = 2.6;
      for (let i = -2; i <= 2; i++) {
        c.beginPath(); c.moveTo(-w * 0.02, i * 4); c.lineTo(-w * 0.55 - Math.sin(t * 4 + i) * 4, i * 6); c.stroke();
      }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(w * 0.2, -3, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#222'; c.beginPath(); c.arc(w * 0.22, -3, 2.2, 0, Math.PI * 2); c.fill();
    } else if (b.kind === 'shark') {
      c.fillStyle = B.body;
      c.beginPath(); c.ellipse(0, 0, w * 0.55, w * 0.26, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = B.belly;
      c.beginPath(); c.ellipse(w * 0.06, w * 0.09, w * 0.44, w * 0.14, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = B.body;
      c.beginPath(); c.moveTo(-w * 0.02, -w * 0.22); c.lineTo(w * 0.14, -w * 0.5); c.lineTo(w * 0.24, -w * 0.2); c.closePath(); c.fill();
      const tw = Math.sin(t * 7) * 0.12;
      c.beginPath(); c.moveTo(-w * 0.48, 0); c.lineTo(-w * 0.8, -w * (0.26 + tw)); c.lineTo(-w * 0.8, w * (0.26 - tw)); c.closePath(); c.fill();
      c.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(w * 0.24 + i * 4.5, w * 0.1); c.lineTo(w * 0.27 + i * 4.5, w * 0.2); c.lineTo(w * 0.3 + i * 4.5, w * 0.1); c.closePath(); c.fill(); }
      c.fillStyle = '#222'; c.beginPath(); c.arc(w * 0.36, -w * 0.06, 2.4, 0, Math.PI * 2); c.fill();
    } else {
      // 크라켄
      c.fillStyle = B.body;
      c.beginPath(); c.arc(0, -w * 0.06, w * 0.4, Math.PI, 0); c.lineTo(w * 0.4, w * 0.14); c.lineTo(-w * 0.4, w * 0.14); c.closePath(); c.fill();
      c.strokeStyle = B.belly; c.lineWidth = 3;
      for (let i = -3; i <= 3; i++) {
        c.beginPath();
        c.moveTo(i * w * 0.1, w * 0.12);
        c.quadraticCurveTo(i * w * 0.14, w * 0.34, i * w * 0.12 + Math.sin(t * 3 + i) * 5, w * 0.5);
        c.stroke();
      }
      c.fillStyle = `rgba(255,90,90,${0.7 + 0.3 * Math.sin(t * 5)})`;
      c.beginPath(); c.arc(-w * 0.13, -w * 0.1, 3.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(w * 0.13, -w * 0.1, 3.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    // 텔레그래프 링
    if (b.state === 'tele' && b.base === 'zap') {
      c.strokeStyle = `rgba(180,180,255,${0.3 + 0.4 * Math.sin(t * 14)})`;
      c.lineWidth = 1.6;
      c.beginPath(); c.arc(X, Y, (b.hp < b.maxHp * 0.5 ? 92 : 72), 0, Math.PI * 2); c.stroke();
    }
  },

  // ── 모구 다이버 ──
  drawCat(c, st, X, Y, t) {
    const p = st.p;
    if (p.iv > 0 && Math.floor(t * 14) % 2 === 0) return;   // 무적 깜빡임
    const spd = Math.hypot(p.vx, p.vy);
    const tilt = Math.max(-0.4, Math.min(0.4, p.vy * 0.004)) * p.face;
    c.save();
    c.translate(X, Y);
    c.rotate(tilt);
    c.scale(p.face, 1);
    // 꼬리
    c.strokeStyle = '#e8a23d'; c.lineWidth = 3.4; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-9, 2);
    c.quadraticCurveTo(-15, 2 + Math.sin(t * (4 + spd * 0.05)) * 4, -19, -2 + Math.sin(t * 5) * 4);
    c.stroke();
    // 몸통
    c.fillStyle = '#f4b64a';
    c.beginPath(); c.ellipse(0, 2, 10, 7.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff3dc';
    c.beginPath(); c.ellipse(1, 5, 6.5, 4, 0, 0, Math.PI * 2); c.fill();
    // 산소통
    c.fillStyle = '#c8d8e8';
    c.beginPath(); c.roundRect(-8, -8, 6, 11, 2.4); c.fill();
    c.strokeStyle = '#8aa0b8'; c.lineWidth = 1; c.strokeRect(-8, -8, 6, 11);
    // 뒷다리·앞다리 (물장구)
    c.strokeStyle = '#e8a23d'; c.lineWidth = 2.8;
    const kick = Math.sin(t * (6 + spd * 0.08)) * 3;
    c.beginPath(); c.moveTo(-5, 8); c.lineTo(-7, 12 + kick); c.stroke();
    c.beginPath(); c.moveTo(5, 8); c.lineTo(6, 12 - kick); c.stroke();
    // 머리
    c.fillStyle = '#f4b64a';
    c.beginPath(); c.arc(9, -4, 7.5, 0, Math.PI * 2); c.fill();
    // 귀
    c.beginPath(); c.moveTo(4, -9); c.lineTo(5.5, -15); c.lineTo(9, -10.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(11, -10.5); c.lineTo(14.5, -14.5); c.lineTo(15, -8.5); c.closePath(); c.fill();
    c.fillStyle = '#e88aa0';
    c.beginPath(); c.moveTo(5.4, -10.4); c.lineTo(6.1, -13.4); c.lineTo(8.2, -10.8); c.closePath(); c.fill();
    // 물안경
    c.fillStyle = 'rgba(140,220,255,.85)';
    c.beginPath(); c.ellipse(11, -5, 4.6, 3.6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#e05a3a'; c.lineWidth = 1.6;
    c.beginPath(); c.ellipse(11, -5, 4.6, 3.6, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(6.5, -6); c.lineTo(2, -7); c.stroke();
    c.fillStyle = '#222';
    c.beginPath(); c.arc(12, -5, 1.5, 0, Math.PI * 2); c.fill();
    // 입·수염
    c.strokeStyle = '#b07830'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(14, -1); c.lineTo(17.5, -2); c.moveTo(14, 0); c.lineTo(17.5, 0.5); c.stroke();
    // 물고 있는 물고기
    if (p.carry) {
      const F = M.FISH[p.carry.type];
      c.save();
      c.translate(17, 1);
      c.rotate(0.3);
      c.scale(0.8, 0.8);
      c.fillStyle = F.body;
      c.beginPath(); c.ellipse(0, 0, F.w * 0.5, F.w * 0.28, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-F.w * 0.4, 0); c.lineTo(-F.w * 0.75, -F.w * 0.26); c.lineTo(-F.w * 0.75, F.w * 0.26); c.closePath(); c.fill();
      c.restore();
    }
    // 발톱 스윙
    if (p.clawT > 0) {
      c.strokeStyle = `rgba(255,255,255,${p.clawT / 0.16})`;
      c.lineWidth = 2.2; c.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.arc(14, -2 + i * 3.4, 13 + i * 2, -0.7, 0.7);
        c.stroke();
      }
    }
    c.restore();
  },

  // ── HUD ──
  drawHud(c, st, t) {
    const W = M.W, p = st.p, S = st.stage;
    // 산소 바
    const o2r = p.o2 / M.Logic.O2MAX;
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.fillRect(10, 10, 130, 13);
    c.fillStyle = o2r < 0.25 ? (Math.floor(t * 6) % 2 ? '#ff5a5a' : '#ff9a5a') : '#4ac8f0';
    c.fillRect(11, 11, 128 * Math.max(0, o2r), 11);
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1;
    c.strokeRect(10, 10, 130, 13);
    c.font = 'bold 9px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#fff';
    c.fillText('O₂', 14, 20);
    // 물고 있는 것
    if (p.carry) {
      c.fillStyle = 'rgba(0,0,0,.4)';
      c.fillRect(10, 27, 90, 13);
      c.fillStyle = '#ffd83d';
      c.fillText('물고 있음: ' + p.carry.name, 14, 37);
    }
    // 할당량
    c.textAlign = 'right'; c.fillStyle = '#fff';
    c.font = 'bold 11px sans-serif';
    const bossUp = !!st.boss && !st.boss.dead;
    if (!bossUp) {
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
      const qtext = `🐟 ${Math.min(st.delivered, S.quota)}/${S.quota}`;
      c.strokeText(qtext, W - 12, 21);
      c.fillText(qtext, W - 12, 21);
    } else {
      // 보스 바
      const b = st.boss;
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(W - 166, 10, 156, 12);
      c.fillStyle = b.hp < b.maxHp * 0.5 ? '#ff8a3d' : '#ff5a5a';
      c.fillRect(W - 165, 11, 154 * Math.max(0, b.hp / b.maxHp), 10);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
      c.strokeRect(W - 166, 10, 156, 12);
      c.font = 'bold 9px sans-serif'; c.fillStyle = '#fff';
      c.fillText('👑 ' + S.boss.name, W - 12, 32);
    }
    // 스테이지 라벨
    c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    c.fillStyle = 'rgba(255,255,255,.92)';
    const label = `STAGE ${st.no} · ${S.theme.name}`;
    c.strokeText(label, W / 2, 18);
    c.fillText(label, W / 2, 18);
    // 수심계
    c.font = 'bold 9px sans-serif'; c.textAlign = 'right';
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.fillText(`${Math.max(0, Math.round((p.y - M.SURF) / 6))}m`, W - 12, M.H - 10);
    // 점수
    c.textAlign = 'left';
    c.fillText(`SCORE ${st.score}`, 12, M.H - 10);
  },
};
