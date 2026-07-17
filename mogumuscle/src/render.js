// render.js — 원작 머슬 태그매치 시각 문법의 도트 렌더 (480×270)
// 사선 평행사변형 링 · 플랫 투영(원근 스케일 없음) · 2등신 측면 프로필 스프라이트 ·
// 파워업 팔레트 스왑 점멸 · 검은 생명의 구슬 · 상단 스트립 HUD
const M = window.MMS;
const W = 480, H = 270;

// NES풍 제한 팔레트 (역할 색 고정 — Loop C/D)
const PAL = {
  floor: '#101858', floorD: '#0a1040', moat: '#080b2c',   // 장외 바닥 (어둡게 = 링 분리 강화)
  wall: '#4a2e12', wallHi: '#6a4420',
  matW: '#e8dcc0', matS: '#cbbd98', matLine: '#b6a074', apron: '#202c86', apronS: '#141c58',
  rope: '#f0a010', ropeHi: '#ffd24a', ropeBk: '#7a3a04', ropeZap: '#f8e048',  // 로프 + 어두운 backing
  post: '#e8e8e8', postS: '#8888a8', postHi: '#ffffff',
  padA: '#d82800', padB: '#2848c8',                       // 코너 턴버클 패드
  crowd0: '#153f6e', crowd1: '#12345c', crowdRail: '#0c2036',  // 객석 띠 (배경 역할색)
  skin: '#f0b080', skinS: '#c07848',
  pwr: '#f8e048', pwrS: '#c8a818',
  white: '#f8f8f8', black: '#101010', red: '#d82800', gold: '#f8b800',
};

M.Render = {
  cv: null, ctx: null, fx: [],

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    let s = Math.min(window.innerWidth / W, window.innerHeight / H);
    s = s >= 2 ? Math.floor(s) : Math.max(0.6, s * 0.97);
    this.cv.style.width = W * s + 'px';
    this.cv.style.height = H * s + 'px';
    this.cv.style.imageRendering = 'pixelated';
    const res = Math.min(4, Math.max(1, Math.round(s * (window.devicePixelRatio || 1))));
    this.cv.width = W * res;
    this.cv.height = H * res;
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  },

  // 월드 (x 좌우 ±RING_X, z 깊이 ±RING_Z) → 화면. 원작식 시어(shear) 투영 — 깊이 스케일 없음
  sx(x, z) { return Math.round(W / 2 + x * 0.85 - z * 0.55); },
  sy(z) { return Math.round(165 + z * 1.25); },

  draw(st, t, dt) {
    const c = this.ctx;
    const RX = M.RING_X, RZ = M.RING_Z;

    // ── 장외 바닥 (링 분리 강화: 어두운 바닥 + 링 둘레 해자) ──
    c.fillStyle = PAL.floorD; c.fillRect(0, 0, W, H);
    c.fillStyle = PAL.floor; c.fillRect(0, 96, W, H - 96);           // 앞쪽 바닥은 살짝 밝게

    // ── 배경 관중석 (HUD 아래 ~ 링 위, 화면을 누르는 띠 구조 — Loop D) ──
    const seat = ['#e8b088', '#f0d8b0', '#c87850', '#d8a878'];
    const shirt = ['#3048c8', '#c83048', '#28a048', '#c8a020'];
    for (let r = 0; r < 4; r++) {
      const ry = 34 + r * 11;
      c.fillStyle = r % 2 ? PAL.crowd0 : PAL.crowd1;
      c.fillRect(0, ry, W, 11);
      c.fillStyle = PAL.crowdRail; c.fillRect(0, ry + 10, W, 1);     // 난간 띠
      for (let i = 0; i < 40; i++) {
        const hx = 3 + i * 12 + (r % 2) * 6;
        c.fillStyle = seat[(i * 5 + r * 3) % 4];
        c.fillRect(hx, ry + 2, 5, 4);                               // 머리
        c.fillStyle = shirt[(i * 3 + r) % 4];
        c.fillRect(hx + 1, ry + 6, 3, 3);                           // 몸
      }
    }
    // 관중석 아래 통로 그림자 (배경 → 장외 분리)
    c.fillStyle = PAL.moat; c.fillRect(0, 78, W, 4);

    // ── 링 매트 (사선 평행사변형) ──
    const TL = [this.sx(-RX, -RZ), this.sy(-RZ)], TR = [this.sx(RX, -RZ), this.sy(-RZ)];
    const BL = [this.sx(-RX, RZ), this.sy(RZ)], BR = [this.sx(RX, RZ), this.sy(RZ)];
    // 링 아래 짙은 해자 (바닥과 강하게 분리)
    c.fillStyle = PAL.moat;
    c.beginPath(); c.moveTo(TL[0] - 6, TL[1] + 4); c.lineTo(TR[0] + 6, TR[1] + 4);
    c.lineTo(BR[0] + 4, BR[1] + 26); c.lineTo(BL[0] - 4, BL[1] + 26); c.closePath(); c.fill();
    // 매트 본판
    c.fillStyle = PAL.matW;
    c.beginPath(); c.moveTo(...TL); c.lineTo(...TR); c.lineTo(...BR); c.lineTo(...BL); c.closePath(); c.fill();
    // 매트 색면 분절 (원작식 4분할 패널 이음선)
    c.strokeStyle = PAL.matLine; c.lineWidth = 1;
    const mid = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    c.beginPath();
    c.moveTo(...mid(TL, TR, 0.5)); c.lineTo(...mid(BL, BR, 0.5));    // 세로 이음
    c.moveTo(...mid(TL, BL, 0.5)); c.lineTo(...mid(TR, BR, 0.5));    // 가로 이음
    c.stroke();
    // 뒤쪽 매트 살짝 어둡게 (플랫 투영에 약한 깊이감)
    c.fillStyle = 'rgba(120,104,64,.18)';
    c.beginPath(); c.moveTo(...TL); c.lineTo(...TR); c.lineTo(...mid(TR, BR, 0.32)); c.lineTo(...mid(TL, BL, 0.32)); c.closePath(); c.fill();
    // 에이프런 (앞면) — 2톤으로 두께감
    c.fillStyle = PAL.apron;
    c.beginPath(); c.moveTo(...BL); c.lineTo(...BR); c.lineTo(BR[0] - 3, BR[1] + 17); c.lineTo(BL[0] - 3, BL[1] + 17); c.closePath(); c.fill();
    c.fillStyle = PAL.apronS;
    c.beginPath(); c.moveTo(BL[0] - 3, BL[1] + 12); c.lineTo(BR[0] - 3, BR[1] + 12); c.lineTo(BR[0] - 3, BR[1] + 17); c.lineTo(BL[0] - 3, BL[1] + 17); c.closePath(); c.fill();
    // 중앙 로고 띠
    c.fillStyle = PAL.matS; c.fillRect(this.sx(-30, 0), this.sy(0) - 8, 52, 3);
    c.fillStyle = 'rgba(200,60,70,.5)'; c.fillRect(this.sx(-30, 0), this.sy(0) - 5, 52, 10);

    // ── 로프·포스트 ──
    const elec = st.stage.electric;
    const zapOn = (w) => elec;                                       // 링 자체가 전류 (점멸 무효는 개인 판정)
    // 코너 포스트 (굵은 기둥 + 턴버클 패드 — 존재감 강화)
    const post = (px0, py0, pad) => {
      c.fillStyle = PAL.moat; c.fillRect(px0 - 5, py0 - 41, 10, 41);       // 그림자 backing
      c.fillStyle = PAL.postS; c.fillRect(px0 - 4, py0 - 40, 8, 40);       // 기둥
      c.fillStyle = PAL.post; c.fillRect(px0 - 4, py0 - 40, 3, 40);        // 하이라이트 면
      c.fillStyle = PAL.postHi; c.fillRect(px0 - 4, py0 - 40, 1, 40);
      // 턴버클 패드 3단 (로프 높이에 맞춰)
      for (let i = 0; i < 3; i++) {
        c.fillStyle = pad;
        c.fillRect(px0 - 6, py0 - 13 - i * 10, 12, 6);
        c.fillStyle = 'rgba(255,255,255,.28)';
        c.fillRect(px0 - 6, py0 - 13 - i * 10, 12, 1);
      }
      c.fillStyle = PAL.gold; c.fillRect(px0 - 5, py0 - 44, 10, 4);        // 상단 캡
    };
    const ropes3 = (a, b, zap, alpha) => {
      c.globalAlpha = alpha || 1;
      for (let i = 0; i < 3; i++) {
        const ry = -11 - i * 10;
        if (!zap) {                                                        // 어두운 backing → 밝은 바닥에서도 또렷
          c.strokeStyle = PAL.ropeBk; c.lineWidth = 4.5;
          c.beginPath(); c.moveTo(a[0], a[1] + ry + 1); c.lineTo(b[0], b[1] + ry + 1); c.stroke();
        }
        c.strokeStyle = zap ? (Math.floor(t * 10 + i) % 2 ? PAL.ropeZap : '#fff8b0')
          : i === 1 ? PAL.ropeHi : PAL.rope;
        c.lineWidth = 3.2;
        c.beginPath(); c.moveTo(a[0], a[1] + ry); c.lineTo(b[0], b[1] + ry); c.stroke();
        if (!zap) {                                                        // 로프 상단 하이라이트
          c.strokeStyle = 'rgba(255,240,180,.5)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(a[0], a[1] + ry - 1.2); c.lineTo(b[0], b[1] + ry - 1.2); c.stroke();
        }
      }
      if (zap) {                                                     // 전류 스파크
        for (let i = 0; i < 3; i++) {
          const k = (t * 1.6 + i * 0.33) % 1;
          c.fillStyle = '#fff8c0';
          c.fillRect(a[0] + (b[0] - a[0]) * k - 1, a[1] + (b[1] - a[1]) * k - 12 - ((i * 7 + Math.floor(t * 6)) % 3) * 10, 3, 3);
        }
      }
      c.globalAlpha = 1;
    };
    ropes3(TL, TR, false);                                           // 뒤
    ropes3(TL, BL, elec); ropes3(TR, BR, elec);                      // 좌우 (전류 링)
    post(TL[0], TL[1], PAL.padB); post(TR[0], TR[1], PAL.padA);      // 뒤 코너 (파란/빨간 패드)

    // ── 꼬마 매니저 (구슬 투척 전) ──
    if (st.meat) {
      const mx = this.sx(0, st.meat.z), my = this.sy(st.meat.z);
      c.fillStyle = 'rgba(10,10,30,.35)';
      c.fillRect(mx - 7, my - 2, 14, 4);
      c.fillStyle = '#3048c8'; c.fillRect(mx - 6, my - 14, 12, 12);  // 몸
      c.fillStyle = PAL.skin; c.fillRect(mx - 4, my - 23, 9, 9);     // 얼굴
      c.fillStyle = PAL.red; c.fillRect(mx - 5, my - 26, 11, 4);     // 모자
      const wob = Math.round(Math.sin(t * 9) * 2);
      c.fillStyle = PAL.black; c.fillRect(mx + 7, my - 20 + wob, 5, 5);  // 들고 있는 구슬
    }

    // ── 생명의 구슬 (원작: 검은 구슬 점멸) ──
    if (st.ball) {
      const b = st.ball;
      const arc = b.flying ? Math.sin(Math.PI * Math.min(1, b.ft / M.Logic.C.BALL_FLY)) * 34 : 0;
      const bx = this.sx(b.x, b.z), by = this.sy(b.z) - Math.round(arc);
      c.fillStyle = 'rgba(10,10,30,.3)';
      c.fillRect(bx - 4, this.sy(b.z) - 1, 8, 3);
      c.fillStyle = Math.floor(t * 8) % 2 ? PAL.black : '#484858';   // 점멸
      c.fillRect(bx - 3, by - 9, 6, 6);
      c.fillStyle = PAL.white; c.fillRect(bx - 2, by - 8, 2, 2);
    }

    // ── 가스 투사체 ──
    for (const s of st.shots) {
      const gx = this.sx(s.x, s.z), gy = this.sy(s.z) - 24;
      c.fillStyle = Math.floor(t * 12) % 2 ? '#c8c838' : '#a8b028';
      c.fillRect(gx - 4, gy - 4, 8, 8);
      c.fillStyle = '#e8e878'; c.fillRect(gx - 2, gy - 2, 4, 4);
    }

    // ── 레슬러 (z 정렬: 먼 것부터) ──
    const T = st.stage.team;
    const restPos = { p: { x: -RX - 22, z: RZ + 13 }, e: { x: RX + 26, z: -RZ + 6 } };
    const who = [
      { w: st.enemies[1 - st.ei], team: 'e', rest: true },
      { w: st.players[1 - st.pi], team: 'p', rest: true },
      { w: st.enemies[st.ei], team: 'e' },
      { w: st.players[st.pi], team: 'p' },
    ];
    const drawList = who.map((o) => {
      const pos = o.rest ? restPos[o.team] : o.w;
      return { ...o, dx: pos.x, dz: pos.z };
    }).sort((a, b) => a.dz - b.dz);
    for (const o of drawList) {
      if (o.rest) c.globalAlpha = 0.68;                              // 링 밖 대기자 = 채도/명도 낮춰 후경화 (Loop D)
      this.drawW(st, o.w, o.team, o.dx, o.dz, T, t, o.rest);
      if (o.rest) c.globalAlpha = 1;
    }

    // ── 앞 로프·포스트 (레슬러 위) ──
    ropes3(BL, BR, false, 0.9);
    post(BL[0], BL[1] + 2, PAL.padA); post(BR[0], BR[1] + 2, PAL.padB);  // 앞 코너

    // ── FX (도트 스파크·대미지 숫자) ──
    this.fx = this.fx.filter((f) => f.t < f.ttl);
    for (const f of this.fx) {
      f.t += dt;
      f.x += (f.vx || 0) * dt; f.y += (f.vy || 0) * dt;
      c.globalAlpha = 1 - f.t / f.ttl;
      if (f.txt) {
        c.font = 'bold 11px monospace'; c.textAlign = 'center';
        c.fillStyle = f.col || PAL.gold;
        c.fillText(f.txt, Math.round(f.x), Math.round(f.y));
      } else {
        c.fillStyle = f.col || '#ffe08a';
        c.fillRect(Math.round(f.x) - f.r, Math.round(f.y) - f.r, f.r * 2, f.r * 2);
      }
    }
    c.globalAlpha = 1;

    this.drawHud(st, t);
  },

  addHit(x, z, amount, special) {
    const sx = this.sx(x, z), sy = this.sy(z) - 28;
    for (let i = 0; i < (special ? 12 : 6); i++) {
      const a = (i / 6) * Math.PI * 2;
      this.fx.push({ x: sx, y: sy, vx: Math.cos(a) * (40 + (i % 3) * 30), vy: Math.sin(a) * 40 - 30, r: special ? 3 : 2, t: 0, ttl: 0.35, col: special ? PAL.gold : '#ffe08a' });
    }
    this.fx.push({ x: sx, y: sy - 6, vy: -34, txt: `-${amount}`, t: 0, ttl: 0.7, col: special ? PAL.gold : '#ff8a7a' });
  },

  // ══ 도트 레슬러 (2등신 측면 프로필 — 얼굴 방향 = 앞) ══
  // 파워업(poweredT) = 팔레트 스왑 점멸 (원작)
  drawW(st, w, team, wx, wz, T, t, rest) {
    const c = this.ctx;
    const cxp = this.sx(wx, wz), gy = this.sy(wz);
    const down = w.state === 'down' || w.state === 'ko';
    const airY = w.state === 'air' ? Math.round(Math.sin(Math.PI * Math.max(0, 1 - w.airT / (w.airDur || 1))) * 22)
      : (w.state === 'fba' || w.state === 'run') ? 14 : 0;
    const f = w.state === 'fba' ? (Math.sign(w.fbaVx) || 1) : (w.face || 1);  // FBA는 비행 방향
    const u = 2;
    // 팔레트 (파워업 스왑 점멸)
    const swap = w.poweredT > 0 && Math.floor(t * 8) % 2 === 0;
    // 종족별 몸 털색 (고양이=태비 갈색 / 닭=흰 깃털 / 쥐=회색 털) — 머리 색과 통일
    const BODY = w.kind === 'mogu' ? ['#b87838', '#855020']
      : w.kind === 'kko' ? ['#f4f0e4', '#c8c0a8'] : ['#a8a0a0', '#787070'];
    const skin = swap ? PAL.pwr : BODY[0];
    const skinS = swap ? PAL.pwrS : BODY[1];
    const trunk = w.kind === 'mogu' ? '#d82800' : w.kind === 'kko' ? '#2848c8' : (T[w.kind === 'mouseA' ? 'a' : 'b'].mask);
    // 미러 도트 헬퍼: B(dx[u], yAbs, w[u], h[u])
    const B = (dx, y2, ww, hh, col) => {
      const left = f === 1 ? cxp + dx * u : cxp - (dx + ww) * u;
      c.fillStyle = col;
      c.fillRect(Math.round(left), Math.round(y2), ww * u, hh * u);
    };

    // 그림자
    c.fillStyle = 'rgba(10,10,30,.35)';
    c.fillRect(cxp - (down ? 22 : 13), gy - 2, down ? 44 : 26, 4);

    if (down) {                                              // 다운: 등 대고 반듯이 누움 (깔끔한 수평 실루엣)
      // 머리(뒤) → 가슴 → 트렁크 → 다리 → 부츠(앞)를 한 줄로 배치. 바닥선 = gy - 3
      const ly = gy - 7, boot = trunk, glove = '#e8556a';
      const fresh = w.state === 'down' && w.downT > (M.Logic.C.DOWN_T - 0.3);   // 막 넘어간 순간
      if (fresh) {                                           // 슬램 먼지구름
        c.fillStyle = 'rgba(232,224,204,.5)';
        for (let i = 0; i < 5; i++) c.fillRect(cxp - 22 + i * 10, gy - 3 - (i % 2) * 3, 5, 3);
      }
      // 상체(가슴, 뒤쪽)
      B(-8.5, ly + 1, 6.5, 4, skin);
      B(-8.5, ly + 4, 6.5, 1, skinS);                        // 등 바닥 음영
      // 트렁크 + 벨트 (허리)
      B(-2.5, ly + 0.8, 5, 4.2, trunk);
      B(-2.5, ly + 0.3, 5, 1, PAL.gold);
      // 두 다리 (겹쳐 앞으로 뻗음) + 부츠
      B(2.2, ly + 1.4, 5.5, 3.4, skin);
      B(2, ly + 4.2, 5.7, 1, skinS);                         // 다리 바닥 음영
      B(7, ly + 1, 3, 4, boot);                              // 부츠
      B(9.4, ly + 1.2, 0.9, 3.6, '#282838');                 // 밑창(발끝)
      // 가슴 위로 축 늘어진 한 팔
      B(-3.5, ly - 1.6, 4.5, 1.8, skinS);
      B(0.2, ly - 1.9, 2, 2, glove);
      // 머리 (뒤쪽 끝, 매트에 옆으로 누움)
      this.drawHead(w, T, cxp - f * 20, ly - 1, -f, trunk, true);
      if (w.state === 'ko') {
        c.font = 'bold 10px monospace'; c.textAlign = 'center';
        c.fillStyle = '#ffd0d0'; c.fillText('K.O.', cxp, gy - 20);
      } else {
        for (let i = 0; i < 3; i++) {
          const a = t * 5 + (i * Math.PI * 2) / 3;
          c.fillStyle = '#ffe08a'; c.font = '8px monospace'; c.textAlign = 'center';
          c.fillText('★', cxp + Math.cos(a) * 16, gy - 16 + Math.sin(a) * 4);
        }
      }
      return;
    }

    const y = gy - airY - 44;                                // 스프라이트 상단 기준
    const fast = ['run', 'rope', 'fba'].includes(w.state);
    const step = (w.state === 'walk' || fast) ? (Math.floor(t * (fast ? 16 : 9)) % 2 ? 1.5 : -1.5) : 0;
    // 레슬러 대기 스탠스: 다리를 넓게 벌려 낮게 버팀 (Loop B — 레슬러 가독성)
    const stance = (w.state === 'idle') ? 1.3 : 0;
    const boot = trunk;                                      // 레슬링 부츠 = 팀 컬러
    const pad = '#f0ece0';                                   // 니패드·엘보패드 (화이트)
    const glove = '#e8556a';
    // 피격 리코일: 경직 중이면 몸 전체가 뒤로 젖혀짐 (텍스트 없이 타격 읽힘 — Loop E)
    const recoil = (w.stunT > 0 && !fast && w.state !== 'atk') ? Math.min(4, w.stunT * 11) : 0;
    if (recoil) { c.save(); c.translate(Math.round(-f * recoil), Math.round(-recoil * 0.5)); }

    // 속도선 (로프 반동·돌진·FBA)
    if (fast) {
      c.fillStyle = 'rgba(255,255,255,.5)';
      const dir = w.state === 'rope' ? Math.sign(w.ropeVx || 1) : w.state === 'fba' ? Math.sign(w.fbaVx || 1) : Math.sign(w.runVx || 1);
      for (let i = 0; i < 3; i++) c.fillRect(cxp - dir * (18 + i * 7), y + 14 + i * 8, 5, 2);
    }

    // ── 드롭킥·FBA: 수평 비행 (양 부츠 = 진행 방향) → 착지 후 매트 슬라이드 ──
    if (w.state === 'fba' || (w.anim === 'dropkick' && (w.state === 'air' || w.state === 'idle'))) {
      const ly = w.state === 'idle' ? y + 24 : y + 8;
      c.fillStyle = 'rgba(255,255,255,.55)';                 // 비행 궤적
      for (let i = 0; i < 3; i++) c.fillRect(cxp - f * (16 + i * 6) - 2, ly + 4 + i * 5, 5, 2);
      if (w.kind === 'mogu') B(-11.5, ly + 1.2, 3.2, 2, skinS);       // 꼬리 (뒤로 뻗침)
      else if (w.kind !== 'kko') B(-12, ly + 2, 3.6, 1.2, '#e0a0b0'); // 쥐 분홍 꼬리
      B(-7, ly + 3, 8, 4, skin); B(-7, ly + 3, 8, 1.2, skinS);   // 몸통 수평
      B(-3.2, ly + 3, 3.6, 4, trunk);                        // 트렁크
      B(-3.2, ly + 2.4, 3.6, 1, PAL.gold);                   // 벨트
      B(0.4, ly + 2.2, 5.4, 2, skin); B(0.4, ly + 4.6, 5.4, 2, skinS);  // 두 다리 앞으로 쭉
      B(3.6, ly + 4.5, 1.6, 1.2, pad);                       // 니패드
      B(5.6, ly + 1.8, 3, 2.4, boot); B(5.6, ly + 4.4, 3, 2.4, boot);   // 부츠 2연격
      B(8.2, ly + 1.8, 0.9, 5, PAL.white);                   // 임팩트 하이라이트
      B(-9.6, ly + 0.6, 3, 1.8, skinS);                      // 팔 (뒤로)
      this.drawHead(w, T, cxp - f * 20, ly - 9, f, trunk, false, swap);  // 머리 (몸 뒤쪽)
      return;
    }

    // 꼬리·꽁지깃 (종족 실루엣 차별화 — 몸 뒤에 깔림)
    const sway = Math.sin(t * 4 + wx * 0.04) * 0.8;
    if (w.kind === 'mogu') {                                 // 고양이: 굵은 줄무늬 꼬리, 위로 말림
      B(-7.5, y + 22, 2.4, 2.6, skin);
      B(-8.8 + sway, y + 18.8, 2.2, 2.6, skinS);
      B(-9.4 + sway * 1.6, y + 15.4, 2.2, 2.6, skin);
      B(-9 + sway * 2.2, y + 12.6, 2, 2.2, skinS);           // 꼬리 끝
    } else if (w.kind === 'kko') {                           // 닭: 수탉 꽁지깃
      B(-8.2, y + 16, 2.8, 2.2, '#f4f0e4');
      B(-9.4 + sway, y + 13, 2.6, 2.4, PAL.red);
      B(-8.6 + sway * 1.5, y + 10.4, 2.2, 2, '#2848c8');
    } else {                                                 // 쥐: 가늘고 긴 분홍 꼬리, 바닥 쪽
      B(-7.2, y + 26.5, 2.8, 1.1, '#e0a0b0');
      B(-9.4 + sway, y + 23.6, 1.3, 2.6, '#e0a0b0');
      B(-10 + sway * 2, y + 20.4, 1.3, 2.6, '#d890a0');
    }

    // 다리 (근육 허벅지) + 니패드 + 레이스업 부츠 — 대기 시 넓은 스탠스
    B(-3.6 + step - stance, y + 28, 2.8, 3, skin); B(1 - step + stance, y + 28, 2.8, 3, skinS);
    B(-3.4 + step - stance, y + 33, 2.4, 1.4, pad); B(1.2 - step + stance, y + 33, 2.4, 1.4, pad);
    B(-3.6 + step - stance, y + 35.5, 2.8, 2.4, boot); B(1 - step + stance, y + 35.5, 2.8, 2.4, boot);
    B(-2.6 + step - stance, y + 36, 0.9, 1.8, PAL.white); B(2 - step + stance, y + 36, 0.9, 1.8, PAL.white);  // 레이스
    B(-4.2 + step - stance, y + 40, 3.6, 1, '#282838'); B(0.6 - step + stance, y + 40, 3.6, 1, '#282838');    // 밑창
    // 트렁크 + 챔피언 벨트
    B(-4.5, y + 22, 9, 3.5, trunk);
    B(-4.5, y + 21, 9, 1.3, PAL.gold);
    B(-1, y + 20.8, 2, 1.6, '#f8e048');                      // 버클
    // 상체 (역삼각 근육질: 어깨 → 허리 테이퍼)
    B(-6, y + 9, 12, 3.5, skin);                             // 광배·어깨
    B(-4.8, y + 16, 9.6, 3, skin);                           // 허리
    B(-6, y + 9, 2, 3.5, skinS); B(-4.8, y + 16, 2, 3, skinS);  // 등 음영
    if (w.kind === 'mogu') {
      B(0.6, y + 12.6, 3.6, 6.4, swap ? PAL.pwr : '#f0e0c8');    // 크림색 가슴·배 털
      B(-4.4, y + 10, 1.3, 5.4, skinS); B(-2, y + 10.6, 1.3, 4.8, skinS);  // 태비 등 줄무늬
    } else if (w.kind === 'kko') {
      B(0.6, y + 12.6, 3.6, 6.4, swap ? PAL.pwr : PAL.white);    // 흰 가슴깃
    }
    B(1.5, y + 13.5, 3, 1, skinS);                           // 가슴 라인 (펙)
    B(-1.4, y + 17, 2.8, 0.7, skinS); B(-1.4, y + 19.4, 2.8, 0.7, skinS);  // 복근
    // 팔: 기술별 포즈 (라리아트/백드롭/펀치/공중/평시)
    if (w.state === 'atk' && w.anim === 'lariat') {          // 라리아트: 팔 수평 풀스윙
      B(3.5, y + 10.5, 7.5, 3, skin);
      B(9.2, y + 10.8, 1.4, 2.4, PAL.gold);                  // 리스트밴드
      B(10.6, y + 10, 2.8, 3.6, glove);
      B(-7.2, y + 12, 2.2, 4, skinS); B(-7.2, y + 13, 2.2, 1.5, pad);
      c.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 3; i++) c.fillRect(cxp + f * (14 + i * 6), y + 18 + i * 4, 5, 2);
    } else if (w.state === 'atk' && w.anim === 'backdrop') { // 백드롭: 양팔 번쩍 들어올림
      B(1.6, y + 3, 2.2, 7, skin); B(1.7, y + 1, 2.5, 2.3, glove);
      B(-3.9, y + 3, 2.2, 7, skinS); B(-3.8, y + 1, 2.5, 2.3, glove);
    } else if (w.state === 'atk') {                          // 펀치
      B(4, y + 11, 6, 2.5, skin);
      B(8.6, y + 11.2, 1.3, 2.2, PAL.gold);                  // 리스트밴드
      B(9.8, y + 10.6, 2.6, 3.2, glove);
      B(-7, y + 12, 2.2, 4, skinS); B(-7, y + 13, 2.2, 1.5, pad);
    } else if (w.state === 'air') {
      B(3, y + 8, 5, 2, skin); B(7.5, y + 7.5, 2, 2.5, glove);     // 위로 뻗은 팔
      B(-6, y + 12, 2, 3, skinS);
      B(-2 + step, y + 30, 3, 3, skinS);                     // 다리 접기 덧칠
    } else {                                                 // 평시: 넓게 벌린 파이팅 가드
      B(3.4, y + 10, 3.2, 3, skin);                          // 앞 이두 벌크
      B(6.2, y + 10.6, 2, 2.4, skin);
      B(7.8, y + 9.6, 2.6, 3.4, glove);                      // 리드 글러브 (앞·위로 든 가드)
      B(-7.6, y + 10.5, 2.6, 3, skinS);                      // 뒷팔 벌크
      B(-8.4, y + 10, 2.2, 3.2, glove);                      // 뒷 글러브 (뒤로 든 가드)
      B(-8.4, y + 12.8, 2.2, 1.4, pad);                      // 엘보패드
    }
    // 머리 (측면 프로필 — 방향 표현의 핵심)
    this.drawHead(w, T, cxp, y - 2, f, trunk, false, swap);
    if (recoil) c.restore();                                 // 피격 리코일 종료
    // 경직 스파크 (임팩트 강조)
    if (w.stunT > 0) {
      c.fillStyle = '#fff'; c.font = 'bold 10px monospace'; c.textAlign = 'center';
      c.fillText('✷', cxp - f * 10, y + 4);
    }
  },

  // 측면 프로필 머리: 주둥이·부리·코 = 보는 방향
  drawHead(w, T, hx, hy, f, trunk, lying, swap) {
    const c = this.ctx;
    const u = 2;
    const B = (dx, dy, ww, hh, col) => {
      const left = f === 1 ? hx + dx * u : hx - (dx + ww) * u;
      c.fillStyle = col;
      c.fillRect(Math.round(left), Math.round(hy + dy * u), ww * u, hh * u);
    };

    // ── 다운 시: 옆 얼굴(측면 프로필)을 90° 세워 코가 위를 향하게 ──
    // (화면 시점 = 옆에서 봄 → 등 대고 누우면 옆얼굴이 그대로 보이고 주둥이만 위로)
    if (lying) {
      c.save();
      c.translate(hx, hy + 5);                 // 목/어깨 근처를 회전 축으로
      c.scale(-f, 1);                          // 목·턱이 몸통(안쪽)을 향하도록 좌우 반전
      c.rotate(-Math.PI / 2);                  // 측면 프로필을 세움 (주둥이 +x → 위쪽)
      this.drawHead(w, T, 0, 0, 1, trunk, false, swap);  // 기존 측면 머리 재사용
      // 눈을 감김/✕ 처리 (다운·KO 표정)
      if (w.state === 'ko') {
        c.fillStyle = PAL.black; c.font = 'bold 6px monospace'; c.textAlign = 'center';
        c.fillText('✕', 2 * u, -2.2 * u);      // 측면 눈 위치(회전 로컬)
      } else {
        c.fillStyle = PAL.black;               // 감은 눈 (기절)
        c.fillRect(1.2 * u, -2.6 * u, 2 * u, 0.8 * u);
      }
      c.restore();
      return;
    }

    if (w.kind === 'mogu') {                                 // 도트 태비 고양이
      const fur = swap ? PAL.pwr : '#a06828', furD = swap ? PAL.pwrS : '#7a4c18';
      B(-4.6, -4, 1.8, 2.2, furD); B(2.8, -4, 1.8, 2.2, furD);     // 뾰족 삼각 귀 (2단)
      B(-5, -2.2, 3, 2.4, furD); B(2, -2.2, 3, 2.4, furD);
      B(-4.2, -1.8, 1.6, 1.8, '#e8a0a0'); B(2.6, -1.8, 1.6, 1.8, '#e8a0a0');
      B(-5, 0, 10, 7, fur);                                  // 머리
      B(-5, 0, 2, 7, furD);                                  // 뒤통수
      B(-2, 1, 1.5, 3, furD); B(0.5, 1, 1.5, 3, furD);       // 줄무늬
      B(2, 3, 4, 4, '#f0e8d8');                              // 흰 주둥이 (앞)
      B(4.8, 3.5, 1.5, 1.5, '#e87890');                      // 코
      B(6.2, 3, 2.2, 0.6, PAL.white); B(6.2, 4.8, 2.2, 0.6, PAL.white);  // 수염
      B(1.5, 1.5, 2, 2, PAL.white); B(2.4, 2, 1, 1.4, PAL.black);  // 눈
    } else if (w.kind === 'kko') {                           // 닭
      const body2 = swap ? PAL.pwr : '#f4f0e4', bd = swap ? PAL.pwrS : '#c8c0a8';
      B(-2.5, -2, 2, 2, PAL.red); B(0, -2.5, 2, 2.5, PAL.red); B(2.5, -2, 2, 2, PAL.red);  // 볏
      B(-4.5, 0, 9, 7, body2); B(-4.5, 0, 2, 7, bd);
      B(4, 3, 3.5, 2, '#e89028');                            // 부리 (앞)
      B(1, 1.5, 2, 2, PAL.black);                            // 눈
    } else {                                                 // 쥐 레슬러
      const fur = swap ? PAL.pwr : '#a8a0a0', furD = swap ? PAL.pwrS : '#787070';
      B(-6, -3.6, 4.2, 4.2, '#909090'); B(1.4, -3.6, 4.2, 4.2, '#909090');  // 왕 접시귀
      B(-5.2, -2.8, 2.6, 2.6, '#e0a0b0'); B(2.2, -2.8, 2.6, 2.6, '#e0a0b0');
      B(-4.5, 0, 9, 7, fur); B(-4.5, 0, 2, 7, furD);
      B(-4.5, 1, 9, 2.5, trunk);                             // 팀색 마스크 밴드
      B(-6, 1.5, 1.5, 1.5, trunk); B(-6.5, 3, 1, 2, trunk);  // 루차 마스크 매듭·끈 (뒤통수)
      B(1, 1.5, 2, 1.5, PAL.white); B(2, 1.8, 1, 1, PAL.black);      // 눈
      B(3.5, 4, 3.5, 2, '#909090');                          // 뾰족 주둥이 (앞)
      B(6.2, 4.2, 1.2, 1.2, '#e87890');                      // 코
      B(4.6, 5.9, 1.3, 1.3, PAL.white);                      // 앞니
    }
  },

  // ── HUD: 원작식 건조한 상단 바 + 파워 5칸 + 폴 램프 (Loop C) ──
  drawHud(st, t) {
    const c = this.ctx;
    // 상단 HUD 바 (검은 아케이드 바 — 관중석과 분리, 파워칸 가독성)
    c.fillStyle = '#080810'; c.fillRect(0, 0, W, 33);
    c.fillStyle = PAL.gold; c.fillRect(0, 33, W, 1);
    // 중앙 FALL/타이머 (건조한 박스)
    c.fillStyle = '#181820'; c.fillRect(206, 3, 68, 27);
    c.fillStyle = PAL.gold; c.fillRect(206, 3, 68, 1); c.fillRect(206, 29, 68, 1);
    c.font = 'bold 9px monospace'; c.textAlign = 'center';
    c.fillStyle = '#c8c0d0'; c.fillText(`FALL ${Math.min(3, st.fallNo)}/3`, 240, 12);
    c.font = 'bold 16px monospace';
    c.fillStyle = st.time < 10 ? (Math.floor(t * 4) % 2 ? '#ff3020' : '#801008') : PAL.gold;
    c.fillText(String(Math.ceil(st.time)), 240, 27);
    // 팀 파워 (5칸 × 레슬러 2) + 이름 — 색 규칙 고정: 3칸+ 초록 / 2칸 노랑 / 1칸 빨강
    const bar = (x, y, wr, right) => {
      const blocks = Math.ceil(Math.max(0, wr.hp) / 20);
      for (let i = 0; i < 5; i++) {
        const bx = right ? x + 72 - (i + 1) * 15 : x + i * 15;
        c.fillStyle = '#000'; c.fillRect(bx, y, 14, 8);
        c.fillStyle = '#30303c'; c.fillRect(bx + 1, y + 1, 12, 6);
        if (i < blocks) {
          c.fillStyle = blocks >= 3 ? '#28c848' : blocks === 2 ? PAL.gold : '#f83820';
          c.fillRect(bx + 1, y + 1, 12, 6);
          c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(bx + 1, y + 1, 12, 1);
        }
      }
      const activeW = st.players[st.pi] === wr || st.enemies[st.ei] === wr;
      c.font = 'bold 8px monospace'; c.textAlign = right ? 'right' : 'left';
      c.fillStyle = wr.state === 'ko' ? '#8a8a96' : activeW ? PAL.gold : '#c8d0e0';
      const tag = (activeW ? '▶' : '') + wr.name + (wr.poweredT > 0 ? '⚡' : '') + (wr.state === 'ko' ? ' KO' : '');
      c.fillText(tag, right ? x + 72 : x, y - 1.5);
    };
    bar(8, 8, st.players[0], false);
    bar(8, 22, st.players[1], false);
    bar(400, 8, st.enemies[0], true);
    bar(400, 22, st.enemies[1], true);
    // 폴 램프 (양팀 획득 폴)
    const lamp = (cx0, n) => {
      for (let i = 0; i < 2; i++) {
        c.fillStyle = i < n ? PAL.gold : '#303040';
        c.fillRect(cx0 + i * 9, 12, 6, 8);
        if (i < n) { c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(cx0 + i * 9, 12, 6, 2); }
      }
    };
    lamp(180, st.falls.p); lamp(288, st.falls.e);
    // 하단 스테이지 태그 (전류/난이도만 최소 표기 — 텍스트 의존 축소)
    if (st.stage.electric || M.diff !== 'normal') {
      c.font = 'bold 9px monospace'; c.textAlign = 'right';
      const tag = (M.diff !== 'normal' ? M.DIFFS[M.diff].name : '') +
        (st.stage.electric ? (M.diff !== 'normal' ? ' · ' : '') + '⚡전류' : '');
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
      c.strokeText(tag, W - 6, H - 6); c.fillStyle = '#ffe08a'; c.fillText(tag, W - 6, H - 6);
    }

    // 연출 오버레이
    c.textAlign = 'center';
    if (st.phase === 'break') {
      c.font = 'bold 28px monospace';
      c.fillStyle = PAL.gold; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 5;
      const txt = `FALL! ${st.falls.p} - ${st.falls.e}`;
      c.strokeText(txt, W / 2, 120); c.fillText(txt, W / 2, 120);
    } else if (st.phase === 'clear') {
      c.font = 'bold 32px monospace';
      c.fillStyle = PAL.gold; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 5;
      const n = Math.min(3, 1 + Math.floor(st.endT / 0.55));
      const txt = st.endT < 1.65 ? String(n) + '…' : 'WINNER!!';
      c.strokeText(txt, W / 2, 120); c.fillText(txt, W / 2, 120);
    } else if (st.phase === 'over') {
      c.font = 'bold 28px monospace';
      c.fillStyle = '#ff7a7a'; c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 5;
      c.strokeText('LOSE…', W / 2, 120); c.fillText('LOSE…', W / 2, 120);
    }
  },
};
