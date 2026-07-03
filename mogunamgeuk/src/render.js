// render.js — 유사 3D 빙판 러너 렌더 (480×270): 원작풍 하늘·설원·원근 투영
const M = window.MNG;
const W = 480, H = 270;
const HORIZON = 96;              // 지평선 y
const NEAR_Z = 8, FAR_Z = 420;   // 가시 거리 (m)
const PLAYER_Z = 11;             // 모구가 서 있는 깊이

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
  },

  scale(z) { return Math.pow(NEAR_Z / z, 0.9); },
  gy(z) { return HORIZON + (H - HORIZON - 26) * this.scale(z); },
  gx(st, z, wx, curve) {
    const bend = curve * z * z * 0.02;
    return W / 2 + (wx - st.x * 0.55 + bend) * 1.9 * this.scale(z);
  },

  draw(st, t, dt) {
    const c = this.ctx;
    const curve = M.curveAt(st.stage, st.dist);

    // ── 하늘 ──
    const g = c.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#2a6de0'); g.addColorStop(1, '#9fd4f4');
    c.fillStyle = g; c.fillRect(0, 0, W, HORIZON);
    // 태양
    c.fillStyle = '#fff4c8';
    c.beginPath(); c.arc(W - 90, 30, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,244,200,.3)';
    c.beginPath(); c.arc(W - 90, 30, 20, 0, Math.PI * 2); c.fill();
    // 오로라 (은은한 띠)
    for (let i = 0; i < 3; i++) {
      c.fillStyle = ['rgba(120,255,190,.10)', 'rgba(150,200,255,.10)', 'rgba(220,150,255,.08)'][i];
      c.beginPath();
      c.moveTo(0, 18 + i * 8);
      for (let x = 0; x <= W; x += 24) c.lineTo(x, 18 + i * 8 + Math.sin(x * 0.02 + t * 0.8 + i * 2) * 6);
      for (let x = W; x >= 0; x -= 24) c.lineTo(x, 44 + i * 8 + Math.sin(x * 0.02 + t * 0.8 + i * 2) * 6);
      c.fill();
    }
    // 원경 설산 (커브에 따라 흐르는 패럴랙스)
    const mOff = -curve * 60 - (st.x * 0.1);
    c.fillStyle = '#e8f2fa';
    c.beginPath();
    c.moveTo(0, HORIZON);
    for (let i = 0; i <= 12; i++) {
      const x = i * 44 + (mOff % 44);
      c.lineTo(x, HORIZON - 14 - ((i * 37 + 11) % 23));
      c.lineTo(x + 22, HORIZON);
    }
    c.lineTo(W, HORIZON); c.fill();
    c.fillStyle = '#c8ddef';
    c.beginPath();
    c.moveTo(0, HORIZON);
    for (let i = 0; i <= 9; i++) {
      const x = i * 60 + (mOff * 1.6 % 60) - 20;
      c.lineTo(x, HORIZON - 8 - ((i * 53 + 5) % 14));
      c.lineTo(x + 30, HORIZON);
    }
    c.lineTo(W, HORIZON); c.fill();

    // ── 빙판 (원근 줄무늬 밴드) ──
    c.fillStyle = '#f4fafd';
    c.fillRect(0, HORIZON, W, H - HORIZON);
    const band = 60;                                   // 월드 60m 밴드
    const base = Math.floor((st.dist + NEAR_Z) / band) * band;
    for (let k = -1; k < 10; k++) {
      const wd = base + k * band;
      const z0 = Math.max(NEAR_Z, wd - st.dist);
      const z1 = Math.max(NEAR_Z, wd + band - st.dist);
      if (z0 >= FAR_Z || z1 <= NEAR_Z || z0 >= z1) continue;
      if ((wd / band) % 2) continue;                   // 짝수 밴드만 옅게
      c.fillStyle = 'rgba(160,205,235,.30)';
      const y0 = this.gy(Math.min(z1, FAR_Z)), y1 = this.gy(z0);
      c.fillRect(0, y0, W, Math.max(1, y1 - y0));
    }
    // 트랙 가장자리 눈더미
    c.fillStyle = '#dcebf6';
    for (let k = 0; k < 14; k++) {
      const wd = Math.floor(st.dist / 90) * 90 + k * 90;
      const z = wd - st.dist;
      if (z < NEAR_Z || z > FAR_Z) continue;
      const s = this.scale(z);
      for (const side of [-1, 1]) {
        const x = this.gx(st, z, side * (M.TRACK_W + 42), curve);
        const y = this.gy(z);
        c.beginPath(); c.ellipse(x, y, 26 * s * 1.9, 12 * s * 1.9, 0, Math.PI, 0); c.fill();
      }
    }

    // ── 목표 기지 (접근 시 지평선에서 등장) ──
    const goalZ = st.stage.length - st.dist + 30;
    if (goalZ < FAR_Z * 2.2) {
      const z = Math.max(14, goalZ);
      const s = Math.min(1.4, this.scale(z) * 2.4);
      const x = this.gx(st, Math.min(z, FAR_Z), 0, curve);
      const y = this.gy(Math.min(z, FAR_Z));
      c.fillStyle = '#d8e6f0';
      c.beginPath(); c.arc(x, y, 46 * s, Math.PI, 0); c.fill();
      c.strokeStyle = '#8aa6ba'; c.lineWidth = 2 * s;
      c.beginPath(); c.arc(x, y, 46 * s, Math.PI, 0); c.stroke();
      c.fillStyle = '#c05050';
      c.fillRect(x - 2 * s, y - 66 * s, 4 * s, 22 * s);
      c.beginPath(); c.arc(x, y - 68 * s, 4 * s, 0, Math.PI * 2); c.fill();
      c.font = `bold ${Math.max(9, 13 * s)}px sans-serif`; c.textAlign = 'center';
      c.fillStyle = '#4a6a86';
      c.fillText(st.stage.to, x, y - 74 * s);
    }

    // ── 오브젝트 (먼 것부터) ──
    const objs = st.stage.objs;
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      const z = o.d - st.dist;
      if (z < NEAR_Z - 4 || z > FAR_Z) continue;
      if (st.resolved.has(i) && (o.type === 'flag' || o.type === 'fish') && Math.abs(o.x - st.x) < o.w + 15) continue;
      const s = this.scale(Math.max(NEAR_Z, z));
      const x = this.gx(st, Math.max(NEAR_Z, z), o.x, curve);
      const y = this.gy(Math.max(NEAR_Z, z));
      if (o.type === 'crev') {
        // 전폭 크레바스: 지그재그 균열
        const x0 = this.gx(st, Math.max(NEAR_Z, z), -M.TRACK_W - 30, curve);
        const x1 = this.gx(st, Math.max(NEAR_Z, z), M.TRACK_W + 30, curve);
        const hh = Math.max(3, 26 * s * 1.9);
        const grd = c.createLinearGradient(0, y - hh / 2, 0, y + hh / 2);
        grd.addColorStop(0, '#3a6a9c'); grd.addColorStop(0.5, '#16324e'); grd.addColorStop(1, '#3a6a9c');
        c.fillStyle = grd;
        c.beginPath();
        c.moveTo(x0, y - hh / 2);
        for (let px = x0; px < x1; px += 26) c.lineTo(px + 13, y - hh / 2 + (((px / 26) % 2) ? 2 : -2) * s * 3);
        c.lineTo(x1, y - hh / 2);
        c.lineTo(x1, y + hh / 2);
        for (let px = x1; px > x0; px -= 26) c.lineTo(px - 13, y + hh / 2 + (((px / 26) % 2) ? -2 : 2) * s * 3);
        c.closePath(); c.fill();
      } else if (o.type === 'hole') {
        c.fillStyle = '#1c3a58';
        c.beginPath(); c.ellipse(x, y, 34 * s * 1.9, 13 * s * 1.9, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2 * s;
        c.beginPath(); c.ellipse(x, y, 34 * s * 1.9, 13 * s * 1.9, 0, 0, Math.PI * 2); c.stroke();
      } else if (o.type === 'seal') {
        const pop = 0.75 + 0.25 * Math.sin(t * 4 + o.d);
        c.fillStyle = '#7a8a9a';
        c.beginPath(); c.ellipse(x, y - 16 * s * pop, 16 * s * 1.9, 20 * s * 1.9 * pop, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#9aacbc';
        c.beginPath(); c.ellipse(x, y - 8 * s * pop, 10 * s * 1.9, 12 * s * 1.9 * pop, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1a2430';
        c.beginPath(); c.arc(x - 5 * s * 1.9, y - 26 * s * pop, 2.2 * s * 1.9, 0, Math.PI * 2);
        c.arc(x + 5 * s * 1.9, y - 26 * s * pop, 2.2 * s * 1.9, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(x, y - 21 * s * pop, 1.8 * s * 1.9, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(0,0,0,.18)';
        c.beginPath(); c.ellipse(x, y + 2, 16 * s * 1.9, 5 * s * 1.9, 0, 0, Math.PI * 2); c.fill();
      } else if (o.type === 'flag') {
        c.strokeStyle = '#6a4a2a'; c.lineWidth = Math.max(1.2, 3 * s);
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 46 * s * 1.9); c.stroke();
        c.fillStyle = '#e83838';
        c.beginPath();
        c.moveTo(x, y - 46 * s * 1.9);
        c.lineTo(x + 26 * s * 1.9, y - 38 * s * 1.9);
        c.lineTo(x, y - 30 * s * 1.9);
        c.closePath(); c.fill();
        c.fillStyle = 'rgba(0,0,0,.15)';
        c.beginPath(); c.ellipse(x, y + 1, 8 * s * 1.9, 3 * s * 1.9, 0, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = '#5aa8d8';
        c.beginPath(); c.ellipse(x, y - 5 * s, 13 * s * 1.9, 7 * s * 1.9, -0.2, 0, Math.PI * 2); c.fill();
        c.beginPath();
        c.moveTo(x + 11 * s * 1.9, y - 5 * s);
        c.lineTo(x + 18 * s * 1.9, y - 10 * s);
        c.lineTo(x + 18 * s * 1.9, y); c.fill();
        c.fillStyle = '#1a2430';
        c.beginPath(); c.arc(x - 6 * s * 1.9, y - 6 * s, 1.6 * s * 1.9, 0, Math.PI * 2); c.fill();
      }
    }

    // ── 모구 (스키점프 컷아웃 스프라이트) ──
    this.drawMogu(st, t);

    this.drawHud(st, t);
  },

  drawMogu(st, t) {
    const c = this.ctx;
    const jy = M.Logic.jy(st);
    const s = this.scale(PLAYER_Z) * 1.9;
    const x = W / 2 + st.x * 0.45 * s;
    const gy = this.gy(PLAYER_Z) + 6;
    // 그림자
    c.fillStyle = `rgba(30,60,90,${0.25 - jy * 0.12})`;
    c.beginPath(); c.ellipse(x, gy, 24 * (1 - jy * 0.25), 7 * (1 - jy * 0.25), 0, 0, Math.PI * 2); c.fill();
    if (!this.mogu) return;
    const a = this.mogu.width / this.mogu.height;
    const hh = 62 * (1 + jy * 0.18);
    const y = gy - jy * 46;
    c.save();
    c.translate(x, y);
    if (st.stunT > 0) {
      c.rotate(Math.sin(st.stunT * 26) * 0.5);          // 넘어져 버둥
    } else {
      const waddle = Math.sin(t * (6 + st.spd * 0.045)) * 0.11;   // 뒤뚱
      c.rotate(waddle);
      c.translate(0, Math.abs(Math.sin(t * (6 + st.spd * 0.045))) * -3);
    }
    c.drawImage(this.mogu, -hh * a / 2, -hh, hh * a, hh);
    c.restore();
  },

  drawHud(st, t) {
    const c = this.ctx;
    // 상단 바
    c.fillStyle = 'rgba(10,24,48,.55)';
    c.fillRect(0, 0, W, 20);
    c.font = 'bold 10px sans-serif'; c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText(`SCORE ${st.score}`, 8, 14);
    c.fillText(`🚩 ${st.flags}/${st.stage.flagsTotal}`, 108, 14);
    c.textAlign = 'center';
    const tCol = st.time < 10 ? (Math.floor(t * 4) % 2 ? '#ff6a6a' : '#ffd0d0') : '#ffe08a';
    c.fillStyle = tCol;
    c.fillText(`TIME ${Math.ceil(st.time)}`, W / 2 + 30, 14);
    c.textAlign = 'right';
    c.fillStyle = '#bfe0ff';
    c.fillText(`${Math.round(st.spd * 1.4)} km/h`, W - 10, 14);
    // 진행 게이지 (출발 → 도착 기지)
    const px0 = W / 2 - 70, pw = 60;
    c.fillStyle = 'rgba(255,255,255,.25)';
    c.fillRect(px0, 8, pw, 4);
    c.fillStyle = '#7de08a';
    c.fillRect(px0, 8, pw * Math.min(1, st.dist / st.stage.length), 4);
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(px0 + pw * Math.min(1, st.dist / st.stage.length), 10, 3, 0, Math.PI * 2); c.fill();
    // 하단 스테이지 라벨
    c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 3;
    const label = `STAGE ${st.no} · ${st.stage.from} → ${st.stage.to} (${(Math.max(0, st.stage.length - st.dist) / 1000).toFixed(1)}km)`;
    c.strokeText(label, W / 2, H - 8);
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.fillText(label, W / 2, H - 8);
  },
};
