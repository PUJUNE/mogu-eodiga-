// render.js — 프로레슬링 링 렌더 (480×270): 군중·링·근육 레슬러
const M = window.MMS;
const W = 480, H = 270;
const PAD = 18;                  // 링 매트가 경기 영역보다 넓게 깔리는 여유

M.Render = {
  cv: null, ctx: null, mogu: null, fx: [],

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => { this.mogu = img; };
    img.src = M.ASSETS.mogu;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
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

  // 월드 (x: 좌우, z: 깊이 -가 안쪽) → 화면
  sx(x, z) { return W / 2 + x * 1.28 + z * 0.35; },
  sy(z) { return 152 + z * 1.05; },
  sc(z) { return 1 + z * 0.0028; },

  draw(st, t, dt) {
    const c = this.ctx;

    // ── 아레나 배경 + 군중 ──
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16101c'); g.addColorStop(0.45, '#241a2c'); g.addColorStop(1, '#100c16');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let row = 0; row < 4; row++) {
      const y = 18 + row * 13;
      for (let i = 0; i < 30; i++) {
        const x = i * 17 + (row % 2) * 8;
        const ph = Math.sin(i * 13.7 + row * 7.1);
        const up = Math.sin(t * (2 + (i % 3)) + i) > 0.6 ? -2 : 0;   // 환호 들썩임
        c.fillStyle = ['#c8a06a', '#8a6a9a', '#6a8aa0', '#a06a6a', '#7a9a6a'][((i * 7 + row * 3) % 5)];
        c.globalAlpha = 0.5 + 0.2 * ph;
        c.beginPath(); c.arc(x, y + up, 3.4, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
    // 스포트라이트
    for (const lx of [120, 360]) {
      const lg = c.createLinearGradient(lx, 0, lx, 180);
      lg.addColorStop(0, 'rgba(255,240,200,.18)'); lg.addColorStop(1, 'rgba(255,240,200,0)');
      c.fillStyle = lg;
      c.beginPath(); c.moveTo(lx - 8, 0); c.lineTo(lx - 66, 190); c.lineTo(lx + 66, 190); c.lineTo(lx + 8, 0); c.fill();
    }

    // ── 링 매트 ──
    const RX = M.RING_X + PAD, RZ = M.RING_Z + PAD * 0.7;
    const corners = [[-RX, -RZ], [RX, -RZ], [RX, RZ], [-RX, RZ]];
    const pts = corners.map(([x, z]) => [this.sx(x, z), this.sy(z)]);
    // 에이프런 (앞면 스커트)
    c.fillStyle = '#7a1e2e';
    c.beginPath();
    c.moveTo(pts[3][0], pts[3][1]); c.lineTo(pts[2][0], pts[2][1]);
    c.lineTo(pts[2][0] + 4, pts[2][1] + 26); c.lineTo(pts[3][0] - 4, pts[3][1] + 26);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,220,120,.85)';
    c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
    c.fillText('MOGU MUSCLE', W / 2, pts[2][1] + 17);
    // 매트
    c.fillStyle = '#ded8ca';
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath(); c.fill();
    c.strokeStyle = '#b8b0a0'; c.lineWidth = 2; c.stroke();
    // 중앙 로고
    c.strokeStyle = 'rgba(160,60,70,.5)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(this.sx(0, 0), this.sy(0), 44, 17, 0, 0, Math.PI * 2); c.stroke();

    // ── 포스트·로프 (뒤쪽 먼저) ──
    const postH = (z) => 42 * this.sc(z);
    const drawPost = ([x, z], padCol) => {
      const px = this.sx(x, z), py = this.sy(z), h = postH(z);
      c.strokeStyle = '#8a94a4'; c.lineWidth = 4 * this.sc(z);
      c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - h); c.stroke();
      c.fillStyle = padCol;
      for (const hh of [0.28, 0.55, 0.82]) {
        c.beginPath(); c.arc(px, py - h * hh, 3.6 * this.sc(z), 0, Math.PI * 2); c.fill();
      }
    };
    const elec = st.stage.electric;
    const ropes = (a, b, alpha, zap) => {
      const [ax, az] = a, [bx, bz] = b;
      c.globalAlpha = alpha;
      for (const hh of [0.3, 0.56, 0.82]) {
        c.strokeStyle = zap ? (Math.floor(t * 10 + hh * 3) % 2 ? '#ffd83d' : '#fff4b0')
          : hh > 0.7 ? '#c8404e' : hh > 0.4 ? '#e8e8e8' : '#3a6ac8';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(this.sx(ax, az), this.sy(az) - postH(az) * hh);
        c.lineTo(this.sx(bx, bz), this.sy(bz) - postH(bz) * hh);
        c.stroke();
      }
      if (zap) {                                 // 전류 스파크
        for (let i = 0; i < 3; i++) {
          const k = ((t * 1.7 + i * 0.37) % 1);
          const hh = 0.3 + ((i * 7 + Math.floor(t * 5)) % 3) * 0.26;
          const px = this.sx(ax + (bx - ax) * k, az + (bz - az) * k);
          const py = this.sy(az + (bz - az) * k) - postH(az + (bz - az) * k) * hh;
          c.fillStyle = '#fff8c0';
          c.beginPath(); c.arc(px, py, 1.6, 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
    };
    drawPost(corners[0], '#3a6ac8'); drawPost(corners[1], '#3a6ac8');
    ropes(corners[0], corners[1], 1);            // 뒤
    ropes(corners[0], corners[3], 1, elec);      // 좌 (전류 링이면 스파크)
    ropes(corners[1], corners[2], 1, elec);      // 우

    // ── 꼬마 매니저 (구슬 투척 전) ──
    if (st.meat) {
      const mx = this.sx(0, st.meat.z), my = this.sy(st.meat.z);
      c.fillStyle = 'rgba(10,10,20,.3)';
      c.beginPath(); c.ellipse(mx, my, 9, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a6ad4';                   // 몸통
      c.fillRect(mx - 5, my - 16, 10, 12);
      c.fillStyle = '#f0d0a8';                   // 얼굴
      c.beginPath(); c.arc(mx, my - 21, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d43a3a';                   // 모자
      c.beginPath(); c.arc(mx, my - 24, 5.4, Math.PI, 0); c.fill();
      c.fillStyle = '#ffd83d';                   // 들고 있는 구슬
      const wob = Math.sin(t * 9) * 2;
      c.beginPath(); c.arc(mx + 8, my - 18 + wob, 4, 0, Math.PI * 2); c.fill();
    }

    // ── 생명의 구슬 ──
    if (st.ball) {
      const b = st.ball;
      const arc = b.flying ? Math.sin(Math.PI * Math.min(1, b.ft / M.Logic.C.BALL_FLY)) * 34 : 0;
      const bx = this.sx(b.x, b.z), by = this.sy(b.z) - arc;
      const pul = 1 + Math.sin(t * 8) * 0.15;
      c.fillStyle = 'rgba(255,216,61,.25)';
      c.beginPath(); c.arc(bx, by - 8, 13 * pul, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd83d';
      c.beginPath(); c.arc(bx, by - 8, 6.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff8d0';
      c.beginPath(); c.arc(bx - 2, by - 10, 2.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(0,0,0,.2)';
      c.beginPath(); c.ellipse(bx, this.sy(b.z) + 1, 7, 2.6, 0, 0, Math.PI * 2); c.fill();
    }

    // ── 가스 투사체 ──
    for (const s of st.shots) {
      const gx = this.sx(s.x, s.z), gy2 = this.sy(s.z) - 26;
      c.fillStyle = 'rgba(200,180,60,.5)';
      c.beginPath(); c.arc(gx, gy2, 6 + Math.sin(t * 16) * 1.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(230,220,120,.8)';
      c.beginPath(); c.arc(gx - Math.sign(s.vx) * 3, gy2, 3.4, 0, Math.PI * 2); c.fill();
    }

    // ── 레슬러 (z 순 정렬: 먼 것부터) ──
    const T = st.stage.team;
    const who = [
      { w: st.enemies[1 - st.ei], team: 'e', rest: true },
      { w: st.players[1 - st.pi], team: 'p', rest: true },
      { w: st.enemies[st.ei], team: 'e' },
      { w: st.players[st.pi], team: 'p' },
    ];
    // 휴식 레슬러는 에이프런 밖 대기 위치
    const restPos = { p: { x: -M.RING_X - 46, z: M.RING_Z + 20 }, e: { x: M.RING_X + 46, z: -M.RING_Z - 4 } };
    const drawList = who.map((o) => {
      const pos = o.rest ? restPos[o.team] : o.w;
      return { ...o, dx: pos.x, dz: pos.z };
    }).sort((a, b) => a.dz - b.dz);
    for (const o of drawList) this.drawW(st, o.w, o.team, o.dx, o.dz, T, t, o.rest);

    // ── 앞 로프·포스트 (레슬러 위에 반투명) ──
    ropes(corners[3], corners[2], 0.8);
    drawPost(corners[2], '#c8404e'); drawPost(corners[3], '#c8404e');

    // ── FX (스파크·데미지 숫자) ──
    this.fx = this.fx.filter((f) => f.t < f.ttl);
    for (const f of this.fx) {
      f.t += dt;
      f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
      c.globalAlpha = 1 - f.t / f.ttl;
      if (f.txt) {
        c.font = 'bold 12px sans-serif'; c.textAlign = 'center';
        c.fillStyle = f.col || '#ffd83d';
        c.fillText(f.txt, f.x, f.y);
      } else {
        c.fillStyle = f.col || '#ffe08a';
        c.beginPath(); c.arc(f.x, f.y, f.r, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;

    this.drawHud(st, t);
  },

  addHit(x, z, amount, special) {
    const sx = this.sx(x, z), sy = this.sy(z) - 30;
    for (let i = 0; i < (special ? 14 : 7); i++) {
      const a = (i / 7) * Math.PI * 2;
      this.fx.push({ x: sx, y: sy, vx: Math.cos(a) * (40 + (i % 3) * 30), vy: Math.sin(a) * 40 - 30, r: special ? 2.6 : 1.8, t: 0, ttl: 0.35, col: special ? '#ffd83d' : '#ffe08a' });
    }
    this.fx.push({ x: sx, y: sy - 6, vy: -34, txt: `-${amount}`, t: 0, ttl: 0.7, col: special ? '#ffd83d' : '#ff8a7a' });
  },

  // 근육 레슬러: kind = mogu(사진 얼굴) | kko(닭) | mouseA/B(마스크 쥐)
  drawW(st, w, team, wx, wz, T, t, rest) {
    const c = this.ctx;
    const x = this.sx(wx, wz), gy = this.sy(wz), s = this.sc(wz) * (rest ? 0.88 : 1);
    const skin = w.kind === 'mogu' ? '#e8b48a' : w.kind === 'kko' ? '#f0e2c8' : '#9a8f85';
    const trunk = w.kind === 'mogu' ? '#d43a3a' : w.kind === 'kko' ? '#3a6ad4' : (T[w.kind === 'mouseA' ? 'a' : 'b'].mask);
    const down = w.state === 'down' || w.state === 'ko';
    // 공중 높이 (점프 아크 / FBA·돌진 수평 비행)
    const airY = w.state === 'air' ? Math.sin(Math.PI * Math.max(0, 1 - w.airT / (w.airDur || 1))) * 24 * s
      : (w.state === 'fba' || w.state === 'run') ? 15 * s : 0;

    // 그림자
    c.fillStyle = 'rgba(10,10,20,.3)';
    c.beginPath(); c.ellipse(x, gy, (down ? 24 : airY > 0 ? 11 : 15) * s, 5 * s, 0, 0, Math.PI * 2); c.fill();

    // 방향 마커 (활성 레슬러): 발밑 삼각형이 보는 방향 — 배후 판정 시인성
    const isActive = !rest && !down && (st.players[st.pi] === w || st.enemies[st.ei] === w);
    if (isActive) {
      const f0 = w.face || 1;
      c.fillStyle = team === 'p' ? 'rgba(255,216,61,.75)' : 'rgba(255,120,120,.75)';
      c.beginPath();
      c.moveTo(x + f0 * 18 * s, gy);
      c.lineTo(x + f0 * 11 * s, gy - 2.8 * s);
      c.lineTo(x + f0 * 11 * s, gy + 2.8 * s);
      c.closePath(); c.fill();
    }

    // 생명의 구슬 점멸 (원작: 캐릭터 점멸 + 오라)
    if (w.poweredT > 0) {
      c.fillStyle = `rgba(255,216,61,${0.18 + Math.sin(t * 10) * 0.08})`;
      c.beginPath(); c.ellipse(x, gy - airY - 22 * s, 24 * s, 30 * s, 0, 0, Math.PI * 2); c.fill();
      if (Math.floor(t * 14) % 2) c.globalAlpha = 0.55;
    }

    if (down) {
      // 다운: 매트에 대자로
      c.save(); c.translate(x, gy - 5 * s);
      c.fillStyle = skin;
      c.beginPath(); c.ellipse(0, 0, 20 * s, 8 * s, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = trunk;
      c.fillRect(-6 * s, -7 * s, 12 * s, 14 * s * 0.9);
      this.drawHead(w, T, -20 * s * (w.face || 1), -2 * s, s * 0.9, t, true);
      c.restore();
      if (w.state === 'ko') {
        c.font = `bold ${Math.round(10 * s)}px sans-serif`; c.textAlign = 'center';
        c.fillStyle = '#ffd0d0'; c.fillText('K.O.', x, gy - 22 * s);
      } else {
        for (let i = 0; i < 3; i++) {                      // 어지럼 별
          const a = t * 5 + (i * Math.PI * 2) / 3;
          c.fillStyle = '#ffe08a'; c.font = `${Math.round(7 * s)}px sans-serif`;
          c.fillText('★', x + Math.cos(a) * 16 * s, gy - 18 * s + Math.sin(a) * 5 * s);
        }
      }
      c.globalAlpha = 1;
      return;
    }

    const fast = ['run', 'rope', 'fba'].includes(w.state);
    const walk = w.state === 'walk' || fast || w.state === 'air';
    const step = walk ? Math.sin(t * (fast ? 22 : 12)) : 0;
    const lean = w.state === 'run' ? (w.runVx >= 0 ? 0.2 : -0.2)
      : w.state === 'rope' ? (w.ropeVx >= 0 ? 0.25 : -0.25)
      : w.state === 'fba' ? (w.fbaVx >= 0 ? 0.55 : -0.55) : 0;
    const bob = w.state === 'idle' ? Math.sin(t * 3 + x) * 1.2 : 0;

    c.save();
    c.translate(x, gy - airY);
    c.rotate(lean);
    // 다리
    c.strokeStyle = skin; c.lineWidth = 5.5 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-4.5 * s, -16 * s); c.lineTo(-4.5 * s - step * 5 * s, 0); c.stroke();
    c.beginPath(); c.moveTo(4.5 * s, -16 * s); c.lineTo(4.5 * s + step * 5 * s, 0); c.stroke();
    // 부츠
    c.fillStyle = '#2a2a34';
    c.beginPath(); c.ellipse(-4.5 * s - step * 5 * s, -1, 4 * s, 2.4 * s, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(4.5 * s + step * 5 * s, -1, 4 * s, 2.4 * s, 0, 0, Math.PI * 2); c.fill();
    // 트렁크
    c.fillStyle = trunk;
    c.fillRect(-8 * s, -24 * s + bob, 16 * s, 9 * s);
    // 상체 (역삼각 근육)
    c.fillStyle = skin;
    c.beginPath();
    c.moveTo(-13 * s, -42 * s + bob);
    c.lineTo(13 * s, -42 * s + bob);
    c.lineTo(7 * s, -22 * s + bob);
    c.lineTo(-7 * s, -22 * s + bob);
    c.closePath(); c.fill();
    // 가슴 근육 + 복근
    c.strokeStyle = 'rgba(120,70,40,.4)'; c.lineWidth = 1.2 * s;
    c.beginPath(); c.arc(-4.5 * s, -36 * s + bob, 4 * s, 0.2, Math.PI - 0.6); c.stroke();
    c.beginPath(); c.arc(4.5 * s, -36 * s + bob, 4 * s, 0.2 + Math.PI / 2, Math.PI - 0.2); c.stroke();
    c.beginPath(); c.moveTo(0, -32 * s + bob); c.lineTo(0, -24 * s + bob); c.stroke();
    // 팔 (상태별 포즈)
    c.strokeStyle = skin; c.lineWidth = 5 * s;
    const f = w.face || 1;
    if (w.state === 'atk') {
      c.beginPath(); c.moveTo(11 * f * s, -39 * s + bob); c.lineTo(22 * f * s, -34 * s + bob); c.stroke();   // 뻗은 팔
      c.beginPath(); c.moveTo(-11 * f * s, -39 * s + bob); c.lineTo(-14 * f * s, -28 * s + bob); c.stroke();
      c.fillStyle = '#e8556a';
      c.beginPath(); c.arc(24 * f * s, -33 * s + bob, 3.4 * s, 0, Math.PI * 2); c.fill();                    // 글러브
    } else if (w.state === 'run') {
      c.beginPath(); c.moveTo(11 * s, -39 * s + bob); c.lineTo(17 * s, -30 * s + bob); c.stroke();
      c.beginPath(); c.moveTo(-11 * s, -39 * s + bob); c.lineTo(-17 * s, -30 * s + bob); c.stroke();
    } else {
      // 가드 자세: 리드 팔이 보는 방향으로 — 앞뒤 실루엣 구분
      c.beginPath(); c.moveTo(11 * f * s, -39 * s + bob); c.lineTo(21 * f * s, -35 * s + bob); c.stroke();
      c.fillStyle = '#e8556a';
      c.beginPath(); c.arc(23 * f * s, -34.5 * s + bob, 3 * s, 0, Math.PI * 2); c.fill();       // 리드 글러브
      c.beginPath(); c.moveTo(-11 * f * s, -39 * s + bob); c.lineTo(-17 * f * s, -34 * s + bob); c.lineTo(-15 * f * s, -44 * s + bob); c.stroke();
    }
    // 머리
    this.drawHead(w, T, 0, -50 * s + bob, s, t, false);
    // 경직 표시
    if (w.stunT > 0) {
      c.fillStyle = '#ffe08a'; c.font = `${Math.round(8 * s)}px sans-serif`; c.textAlign = 'center';
      c.fillText('✶', 8 * s, -62 * s);
    }
    c.restore();
    c.globalAlpha = 1;
  },

  drawHead(w, T, hx, hy, s, t, lying) {
    const c = this.ctx;
    if (w.kind === 'mogu') {
      if (this.mogu) {
        const a = this.mogu.width / this.mogu.height;
        const hh = 21 * s;
        c.drawImage(this.mogu, hx - (hh * a) / 2, hy - hh * 0.62, hh * a, hh);
      }
      return;
    }
    if (w.kind === 'kko') {
      c.fillStyle = '#f6f2ea';
      c.beginPath(); c.arc(hx, hy, 9 * s, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d43a3a';                               // 볏
      for (let i = -1; i <= 1; i++) {
        c.beginPath(); c.arc(hx + i * 4 * s, hy - 9 * s, 2.6 * s, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#e8973a';                               // 부리
      const f = w.face || 1;
      c.beginPath(); c.moveTo(hx + 8 * f * s, hy - 1 * s); c.lineTo(hx + 14 * f * s, hy + 1 * s); c.lineTo(hx + 8 * f * s, hy + 3 * s); c.fill();
      c.fillStyle = '#1a2430';
      c.beginPath(); c.arc(hx + 4 * f * s, hy - 2.5 * s, 1.5 * s, 0, Math.PI * 2); c.fill();
      return;
    }
    // 쥐 레슬러: 귀 + 마스크
    const mask = T[w.kind === 'mouseA' ? 'a' : 'b'].mask;
    c.fillStyle = '#8a7f75';
    c.beginPath(); c.arc(hx - 6 * s, hy - 7 * s, 4.4 * s, 0, Math.PI * 2); c.fill();   // 귀
    c.beginPath(); c.arc(hx + 6 * s, hy - 7 * s, 4.4 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c8a0a0';
    c.beginPath(); c.arc(hx - 6 * s, hy - 7 * s, 2.2 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(hx + 6 * s, hy - 7 * s, 2.2 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9a8f85';
    c.beginPath(); c.arc(hx, hy, 8.6 * s, 0, Math.PI * 2); c.fill();                   // 얼굴
    c.fillStyle = mask;                                                                // 복면
    c.fillRect(hx - 8.6 * s, hy - 4.5 * s, 17.2 * s, 5.5 * s);
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(hx - 3.4 * s, hy - 1.8 * s, 1.7 * s, 0, Math.PI * 2);
    c.arc(hx + 3.4 * s, hy - 1.8 * s, 1.7 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a24';
    c.beginPath(); c.arc(hx - 3.4 * s, hy - 1.8 * s, 0.8 * s, 0, Math.PI * 2);
    c.arc(hx + 3.4 * s, hy - 1.8 * s, 0.8 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d88a9a';                                                           // 코
    const f = w.face || 1;
    c.beginPath(); c.arc(hx + 7 * f * s, hy + 2.5 * s, 1.6 * s, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(240,240,240,.6)'; c.lineWidth = 0.8 * s;                     // 수염
    for (const wy of [1.5, 3.5]) {
      c.beginPath(); c.moveTo(hx + 5 * f * s, hy + wy * s); c.lineTo(hx + 13 * f * s, hy + (wy - 1) * s); c.stroke();
    }
  },

  drawHud(st, t) {
    const c = this.ctx;
    c.fillStyle = 'rgba(10,10,24,.62)';
    c.fillRect(0, 0, W, 34);
    // 초인 파워 5칸 게이지 (원작: 20당 1칸)
    const bar = (x, y, w0, wr, right) => {
      const seg = (w0 - 8) / 5, blocks = Math.ceil(Math.max(0, wr.hp) / 20);
      for (let i = 0; i < 5; i++) {
        const bx = right ? x + w0 - (i + 1) * seg - i * 2 : x + i * (seg + 2);
        c.fillStyle = 'rgba(255,255,255,.18)';
        c.fillRect(bx, y, seg, 6);
        if (i < blocks) {
          c.fillStyle = blocks > 2 ? '#5ad46a' : blocks > 1 ? '#e8c83a' : '#e85555';
          c.fillRect(bx, y, seg, 6);
        }
      }
      c.font = 'bold 9px sans-serif';
      c.textAlign = right ? 'right' : 'left';
      const activeW = st.players[st.pi] === wr || st.enemies[st.ei] === wr;
      c.fillStyle = wr.state === 'ko' ? '#8a8a96' : activeW ? '#ffd83d' : '#d8d8e2';
      const tag = (activeW ? '▶ ' : '') + wr.name + (wr.poweredT > 0 ? ' ⚡' : '') + (wr.state === 'ko' ? ' KO' : '');
      c.fillText(tag, right ? x + w0 : x, y - 3);
    };
    bar(8, 12, 92, st.players[0], false);
    bar(8, 27, 92, st.players[1], false);
    bar(W - 100, 12, 92, st.enemies[0], true);
    bar(W - 100, 27, 92, st.enemies[1], true);
    // 폴 램프 (3판 2선승)
    const lamp = (cx, n) => {
      for (let i = 0; i < 2; i++) {
        c.beginPath(); c.arc(cx + i * 10, 24, 3.4, 0, Math.PI * 2);
        c.fillStyle = i < n ? '#ffd83d' : 'rgba(255,255,255,.22)';
        c.fill();
      }
    };
    lamp(W / 2 - 46, st.falls.p);
    lamp(W / 2 + 36, st.falls.e);
    // 시간·폴 번호·점수
    c.textAlign = 'center';
    c.font = 'bold 15px sans-serif';
    c.fillStyle = st.time < 10 ? (Math.floor(t * 4) % 2 ? '#ff6a6a' : '#ffd0d0') : '#ffe08a';
    c.fillText(String(Math.ceil(st.time)), W / 2, 16);
    c.font = 'bold 8px sans-serif'; c.fillStyle = '#bfd0ff';
    c.fillText(`FALL ${Math.min(3, st.fallNo)} · ${st.score}`, W / 2, 29);
    // 하단 라벨
    c.font = 'bold 10px sans-serif';
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3;
    const label = `STAGE ${st.no} · vs ${st.stage.team.name}` +
      (M.diff !== 'normal' ? ` · ${M.DIFFS[M.diff].name}` : '');
    c.strokeText(label, W / 2, H - 6);
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.fillText(label, W / 2, H - 6);

    // 폴 사이 휴지 연출
    if (st.phase === 'break') {
      c.textAlign = 'center';
      c.font = 'bold 30px sans-serif';
      c.fillStyle = '#ffd83d';
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 5;
      const txt = `FALL! ${st.falls.p} - ${st.falls.e}`;
      c.strokeText(txt, W / 2, 120); c.fillText(txt, W / 2, 120);
    }
    // 승패 연출: 3카운트 / KO
    if (st.phase === 'clear') {
      c.textAlign = 'center';
      c.font = 'bold 34px sans-serif';
      c.fillStyle = '#ffd83d';
      const n = Math.min(3, 1 + Math.floor(st.endT / 0.55));
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 5;
      const txt = st.endT < 1.65 ? String(n) + '…' : 'WINNER!!';
      c.strokeText(txt, W / 2, 120); c.fillText(txt, W / 2, 120);
    } else if (st.phase === 'over') {
      c.textAlign = 'center';
      c.font = 'bold 30px sans-serif';
      c.fillStyle = '#ff7a7a';
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 5;
      c.strokeText('LOSE…', W / 2, 120); c.fillText('LOSE…', W / 2, 120);
    }
  },
};
