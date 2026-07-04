// render.js — 벨트스크롤 캔버스 렌더 (480×270): 더블드래곤풍 캐릭터·배경
const M = window.MDG;
const W = 480, H = 270;
const ZS = 0.62;                        // 깊이 → 화면 y 계수

M.Render = {
  cv: null, ctx: null, mogu: null, fx: [], camX: 0,

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
    // 고해상도: 내부 버퍼를 표시 배율×DPR로 키우고 논리 좌표는 유지
    const res = Math.min(4, Math.max(1, s * (window.devicePixelRatio || 1)));
    this.cv.width = Math.round(W * res);
    this.cv.height = Math.round(H * res);
    this.ctx.setTransform(res, 0, 0, res, 0, 0);
    this.ctx.imageSmoothingQuality = 'high';
  },

  addSpark(x, y, kd) { this.fx.push({ kind: kd ? 'kd' : 'spark', x, y, t: 0 }); },

  sy(z, jy) { return M.FLOOR_Y + z * ZS - (jy || 0); },

  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g},${b})`;
  },

  // 둥근 끝 두꺼운 선분 — 팔다리 (윤곽선 포함)
  limb(x1, y1, x2, y2, w2, color, outline = true) {
    const c = this.ctx;
    c.lineCap = 'round';
    if (outline) {
      c.strokeStyle = 'rgba(20,16,28,.9)';
      c.lineWidth = w2 + 2.6;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    c.strokeStyle = color;
    c.lineWidth = w2;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  },

  draw(st, t, dt) {
    const c = this.ctx, th = st.stage.theme;
    // 카메라
    const target = Math.max(0, Math.min(st.stage.length - W, st.p.x - 210));
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    const cam = this.camX;

    this.drawBackground(st, t, cam);

    // GO → 표시
    if (st.go && Math.floor(t * 2.5) % 2 === 0) {
      c.font = 'bold 22px sans-serif'; c.textAlign = 'right';
      c.fillStyle = th.accent;
      c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 4;
      c.strokeText('GO ▶▶', W - 14, M.FLOOR_Y - 12);
      c.fillText('GO ▶▶', W - 14, M.FLOOR_Y - 12);
    }

    // 츄르
    for (const it of st.items) {
      const x = it.x - cam, y = this.sy(it.z, 0);
      c.save();
      c.translate(x, y - 5 + Math.sin(t * 5 + it.x) * 2); c.rotate(-0.5);
      c.strokeStyle = 'rgba(20,16,28,.8)'; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke();
      c.strokeStyle = '#f0e0c8'; c.lineWidth = 6.5;
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke();
      c.strokeStyle = '#e08830';
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(-2, 0); c.stroke();
      c.restore();
    }

    // 엔티티 (깊이 정렬)
    const ents = [st.p, st.b, ...st.enemies].filter((f) => f.state !== 'dead' || f.stT < 1.6);
    ents.sort((a, b2) => a.z - b2.z);
    for (const f of ents) this.drawFighter(st, f, t);

    // FX
    this.fx = this.fx.filter((f) => f.t < 0.3);
    for (const f of this.fx) {
      f.t += dt;
      const p = f.t / 0.3, x = f.x - cam;
      c.globalAlpha = 1 - p;
      c.strokeStyle = f.kind === 'kd' ? '#ffd83d' : '#fff';
      c.lineWidth = 2.5; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + p * 2;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * 4, f.y + Math.sin(a) * 4);
        c.lineTo(x + Math.cos(a) * (9 + p * 15), f.y + Math.sin(a) * (9 + p * 15));
        c.stroke();
      }
      if (f.kind === 'kd') {
        c.font = 'bold 13px sans-serif'; c.textAlign = 'center';
        c.fillStyle = '#ffd83d';
        c.fillText('POW!', x, f.y - 16 - p * 10);
      }
      c.globalAlpha = 1;
    }

    this.drawHud(st, t);
  },

  // ── 미션별 배경 (황혼 도시 무드 — 하늘 띠 0~62px에 원경을 얹음) ──
  drawBackground(st, t, cam) {
    const c = this.ctx, th = st.stage.theme, m = st.mission;
    // 하늘: 지평선 3단 그라데이션 (황혼·스모그·핏빛 노을)
    const g = c.createLinearGradient(0, 0, 0, 66);
    g.addColorStop(0, th.sky0);
    if (th.horizon) { g.addColorStop(0.55, th.sky1); g.addColorStop(1, th.horizon); }
    else g.addColorStop(1, th.sky1);
    c.fillStyle = g; c.fillRect(0, 0, W, 66);

    if (m === 1) {                      // 노을: 낮게 걸린 해 + 구름 띠
      const sx2 = W - 110, sy2 = 44;
      const sg = c.createRadialGradient(sx2, sy2, 3, sx2, sy2, 42);
      sg.addColorStop(0, 'rgba(255,214,120,.85)');
      sg.addColorStop(0.4, 'rgba(255,150,90,.35)');
      sg.addColorStop(1, 'rgba(255,150,90,0)');
      c.fillStyle = sg; c.fillRect(sx2 - 44, sy2 - 44, 88, 88);
      c.fillStyle = '#ffe0a0';
      c.beginPath(); c.arc(sx2, sy2, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(40,28,58,.5)';
      for (const [cy2, cw, co] of [[20, 150, 0], [32, 90, 210], [46, 120, 330]]) {
        const x = (((co - cam * 0.04 - t * 3) % (W + cw)) + W + cw) % (W + cw) - cw;
        c.fillRect(x, cy2, cw, 3.5);
      }
    }
    if (m === 3) {                      // 숲: 초승달 + 별
      c.fillStyle = '#e8ecf4';
      c.beginPath(); c.arc(W - 84, 22, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = th.sky0;
      c.beginPath(); c.arc(W - 89, 18, 8.5, 0, Math.PI * 2); c.fill();
    }
    if (m === 4 || m === 3) {           // 밤: 별
      c.fillStyle = 'rgba(255,255,240,.6)';
      for (let i = 0; i < 22; i++) c.fillRect((i * 151 + 23) % W, (i * 67 + 9) % 44, 1.5, 1.5);
    }
    if (m === 2) {                      // 공장: 원경 굴뚝 + 피어오르는 연기
      for (let i = -1; i < 4; i++) {
        const x = i * 170 - ((cam * 0.18) % 170) + 60;
        c.fillStyle = 'rgba(20,16,26,.55)';
        c.fillRect(x, 20, 12, 46);
        c.fillRect(x - 3, 20, 18, 4);
        for (let k = 0; k < 4; k++) {
          const pt = (t * 0.35 + k * 0.25 + i * 0.13) % 1;
          c.fillStyle = `rgba(60,54,66,${0.4 * (1 - pt)})`;
          c.beginPath();
          c.arc(x + 6 + Math.sin(t + k + i) * 5 + pt * 14, 18 - pt * 26, 4 + pt * 8, 0, Math.PI * 2);
          c.fill();
        }
      }
    }

    // 원경 스카이라인 2겹 (불 켠 창·안테나) — 먼 층일수록 옅고 느리게
    if (m !== 3) {
      const layers = [
        { pf: 0.1, alpha: 0.2, seg: 64, win: false },
        { pf: 0.22, alpha: 0.4, seg: 78, win: true },
      ];
      for (const L2 of layers) {
        for (let i = -1; i < Math.ceil(W / L2.seg) + 1; i++) {
          const bx = i * L2.seg - ((cam * L2.pf) % L2.seg);
          const seg = Math.floor(cam * L2.pf / L2.seg) + i;
          const h2 = (seg * 2654435761) >>> 6;
          const hgt = 20 + (h2 % 34);
          const bw = L2.seg - 16;
          c.fillStyle = `rgba(8,10,24,${L2.alpha})`;
          c.fillRect(bx, 66 - hgt, bw, hgt);
          if (h2 % 3 === 0) c.fillRect(bx + bw / 2 - 1, 58 - hgt, 2, 8);
          if (L2.win) {                 // 불 켠 창 (해시 점등, 황혼엔 따뜻한 불빛)
            c.fillStyle = m === 1 ? 'rgba(255,206,110,.6)' : 'rgba(200,220,255,.35)';
            for (let wy = 0; wy < Math.floor((hgt - 6) / 8); wy++)
              for (let wx = 0; wx < 3; wx++)
                if (((h2 >> (wy * 3 + wx)) & 1) === 0)
                  c.fillRect(bx + 7 + wx * 13, 70 - hgt + wy * 8, 3, 4);
          }
        }
      }
    }
    // 도시 앞 숲 실루엣 (마천루와 골목 사이의 나무들)
    c.fillStyle = m === 3 ? 'rgba(4,14,8,.9)' : 'rgba(10,12,24,.55)';
    for (let i = -1; i < 16; i++) {
      const seg = Math.floor(cam * 0.35 / 34) + i;
      const x = seg * 34 - cam * 0.35;
      const h2 = (seg * 97 + 13) % 12;
      c.beginPath(); c.ellipse(x, 66, 24, 8 + h2 * 0.9, 0, Math.PI, 0, true); c.fill();
    }

    // ── 근경 벽 (미션별) ──
    const wallTop = 62, wallH = M.FLOOR_Y - wallTop;
    if (m === 1) {
      // 벽돌 골목: 벽돌 패턴 + 그래피티 + 창살 + 쓰레기통 + 가로등
      c.fillStyle = '#6a4a44';
      c.fillRect(0, wallTop, W, wallH);
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
      for (let ry = 0; ry < wallH; ry += 10) {
        c.beginPath(); c.moveTo(0, wallTop + ry); c.lineTo(W, wallTop + ry); c.stroke();
        const off = (ry / 10) % 2 ? 12 : 0;
        for (let bx = -24; bx < W + 24; bx += 24) {
          const x = bx + off - ((cam * 0.6) % 24);
          c.beginPath(); c.moveTo(x, wallTop + ry); c.lineTo(x, wallTop + ry + 10); c.stroke();
        }
      }
      // 그래피티·창문·쓰레기통·가로등 (구간 해시 배치)
      for (let i = -1; i < 5; i++) {
        const seg = Math.floor(cam * 0.6 / 160) + i;
        const x = seg * 160 - cam * 0.6;
        const h2 = (seg * 2654435761) >>> 8;
        if (h2 % 3 === 0) {             // 그래피티
          c.fillStyle = ['#e05a8a', '#5ab8e0', '#a8e05a'][h2 % 3 === 0 ? seg % 3 : 0];
          c.globalAlpha = 0.55;
          c.font = 'bold 22px sans-serif'; c.textAlign = 'left';
          c.fillText(['MOGU!', '냥', '~=≋', 'ZZZ'][h2 % 4], x + 30, wallTop + 46);
          c.globalAlpha = 1;
        } else if (h2 % 3 === 1) {      // 창살 창문
          c.fillStyle = '#2a2030';
          c.fillRect(x + 40, wallTop + 14, 34, 26);
          c.strokeStyle = '#8a7a74'; c.lineWidth = 2;
          c.strokeRect(x + 40, wallTop + 14, 34, 26);
          c.beginPath(); c.moveTo(x + 51, wallTop + 14); c.lineTo(x + 51, wallTop + 40);
          c.moveTo(x + 62, wallTop + 14); c.lineTo(x + 62, wallTop + 40); c.stroke();
        } else {                        // 쓰레기통
          c.fillStyle = '#4a5a5a';
          c.beginPath(); c.roundRect(x + 90, M.FLOOR_Y - 30, 26, 30, 3); c.fill();
          c.fillStyle = '#3a4a4a';
          c.fillRect(x + 87, M.FLOOR_Y - 34, 32, 6);
        }
        // 체인링크 펜스 (h2 짝수 구간)
        if (h2 % 2 === 0) {
          const fx0 = x + 118, fw = 38;
          c.strokeStyle = 'rgba(180,190,200,.4)'; c.lineWidth = 1;
          for (let k = 0; k <= 4; k++) {
            c.beginPath(); c.moveTo(fx0 + k * 9, wallTop + 18); c.lineTo(fx0 + k * 9 - 10, wallTop + 56); c.stroke();
            c.beginPath(); c.moveTo(fx0 + k * 9 - 10, wallTop + 18); c.lineTo(fx0 + k * 9, wallTop + 56); c.stroke();
          }
          c.strokeStyle = 'rgba(140,150,160,.6)'; c.lineWidth = 2;
          c.strokeRect(fx0 - 10, wallTop + 18, fw + 10, 38);
        }
      }
      // 가로등: 깜빡이는 불빛 콘 + 바닥 빛 웅덩이
      for (let i = -1; i < 4; i++) {
        const seg = Math.floor(cam * 0.6 / 220) + i;
        const x = seg * 220 - cam * 0.6 + 130;
        const flick = (seg * 7 + Math.floor(t * 9)) % 23 === 0 ? 0.25 : 1;   // 이따금 깜빡
        c.fillStyle = '#2a2430';
        c.fillRect(x, wallTop - 10, 4, M.FLOOR_Y - wallTop + 10);
        c.fillRect(x - 8, wallTop - 12, 20, 4);
        c.fillStyle = `rgba(255,214,130,${0.85 * flick})`;
        c.beginPath(); c.ellipse(x + 2, wallTop - 6, 5, 3.5, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.13 * flick;
        c.fillStyle = '#ffd88a';
        c.beginPath();
        c.moveTo(x - 2, wallTop - 5); c.lineTo(x + 6, wallTop - 5);
        c.lineTo(x + 26, M.FLOOR_Y + 18); c.lineTo(x - 22, M.FLOOR_Y + 18);
        c.closePath(); c.fill();
        c.globalAlpha = 0.1 * flick;
        c.beginPath(); c.ellipse(x + 2, M.FLOOR_Y + 16, 34, 9, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
      }
    } else if (m === 2) {
      // 공장: 골함석 + 파이프 + 톱니 + 경고 스트라이프
      c.fillStyle = '#5a5048';
      c.fillRect(0, wallTop, W, wallH);
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 3;
      for (let bx = -16; bx < W + 16; bx += 16) {
        const x = bx - ((cam * 0.6) % 16);
        c.beginPath(); c.moveTo(x, wallTop); c.lineTo(x, M.FLOOR_Y); c.stroke();
      }
      // 파이프 (수평 2줄 + 조인트)
      for (const py of [wallTop + 12, wallTop + 30]) {
        c.fillStyle = '#7a6a58';
        c.fillRect(0, py, W, 8);
        c.fillStyle = 'rgba(255,255,255,.2)';
        c.fillRect(0, py + 1, W, 2);
        c.fillStyle = '#8a7a68';
        for (let i = -1; i < 6; i++) {
          const x = i * 110 - ((cam * 0.6) % 110);
          c.fillRect(x, py - 2, 10, 12);
        }
      }
      // 톱니 실루엣·경고 스트라이프
      for (let i = -1; i < 4; i++) {
        const x = i * 200 - ((cam * 0.6) % 200);
        c.fillStyle = 'rgba(30,26,34,.5)';
        c.beginPath(); c.arc(x + 60, M.FLOOR_Y - 22, 20, 0, Math.PI * 2); c.fill();
        c.fillStyle = th.sky1;
        c.beginPath(); c.arc(x + 60, M.FLOOR_Y - 22, 8, 0, Math.PI * 2); c.fill();
      }
      c.save();
      c.beginPath(); c.rect(0, M.FLOOR_Y - 8, W, 8); c.clip();
      for (let bx = -20; bx < W + 20; bx += 20) {
        const x = bx - ((cam * 0.6) % 20);
        c.fillStyle = (Math.floor(bx / 20) % 2) ? '#d8b83a' : '#2a2430';
        c.save(); c.translate(x, M.FLOOR_Y - 8); c.transform(1, 0, -0.6, 1, 0, 0);
        c.fillRect(0, 0, 10, 8); c.restore();
      }
      c.restore();
    } else if (m === 3) {
      // 어두운 숲길: 겹나무 + 울타리 + 반딧불
      c.fillStyle = '#16301a';
      c.fillRect(0, wallTop, W, wallH);
      for (let i = -1; i < 7; i++) {
        const x = i * 90 - ((cam * 0.55) % 90);
        const h2 = ((i * 73 + 11) % 20);
        c.fillStyle = '#0e2010';
        c.beginPath(); c.ellipse(x + 40, wallTop + 26 + h2 * 0.4, 42, 30, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#241a10';
        c.fillRect(x + 36, wallTop + 40, 9, M.FLOOR_Y - wallTop - 40);
      }
      // 울타리
      c.fillStyle = '#3a2c1c';
      c.fillRect(0, M.FLOOR_Y - 26, W, 5);
      for (let bx = -18; bx < W + 18; bx += 18) {
        const x = bx - ((cam * 0.6) % 18);
        c.fillRect(x, M.FLOOR_Y - 38, 6, 38);
      }
      // 반딧불
      c.fillStyle = '#c8e87a';
      for (let i = 0; i < 6; i++) {
        c.globalAlpha = 0.4 + 0.4 * Math.sin(t * 3 + i * 2.1);
        c.beginPath();
        c.arc(((i * 173 + Math.sin(t * 0.7 + i) * 30) % W + W) % W, wallTop + 30 + (i * 31) % 60, 1.8, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      // 밤안개 띠 (느리게 흐름)
      for (let k = 0; k < 2; k++) {
        const mx = (((t * (8 + k * 5) + k * 260) % (W + 240)) + W + 240) % (W + 240) - 240;
        const mg = c.createRadialGradient(mx + 120, wallTop + 70 + k * 24, 8, mx + 120, wallTop + 70 + k * 24, 130);
        mg.addColorStop(0, 'rgba(180,200,190,.1)');
        mg.addColorStop(1, 'rgba(180,200,190,0)');
        c.fillStyle = mg;
        c.fillRect(mx, wallTop + 40 + k * 24, 240, 60);
      }
    } else {
      // 악당 아지트: 석벽 + 횃불 + 붉은 현수막
      c.fillStyle = '#3a2c48';
      c.fillRect(0, wallTop, W, wallH);
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.5;
      for (let ry = 0; ry < wallH; ry += 16) {
        c.beginPath(); c.moveTo(0, wallTop + ry); c.lineTo(W, wallTop + ry); c.stroke();
        const off = (ry / 16) % 2 ? 20 : 0;
        for (let bx = -40; bx < W + 40; bx += 40) {
          const x = bx + off - ((cam * 0.6) % 40);
          c.beginPath(); c.moveTo(x, wallTop + ry); c.lineTo(x, wallTop + ry + 16); c.stroke();
        }
      }
      for (let i = -1; i < 4; i++) {
        const x = i * 170 - ((cam * 0.6) % 170);
        // 현수막
        c.fillStyle = '#8a2030';
        c.fillRect(x + 30, wallTop + 8, 26, 44);
        c.beginPath(); c.moveTo(x + 30, wallTop + 52); c.lineTo(x + 43, wallTop + 62); c.lineTo(x + 56, wallTop + 52); c.fill();
        c.fillStyle = '#ffd83d';
        c.font = 'bold 14px sans-serif'; c.textAlign = 'center';
        c.fillText('鼠', x + 43, wallTop + 34);
        // 횃불
        const fx2 = x + 120;
        c.fillStyle = '#6a4a2a';
        c.fillRect(fx2, wallTop + 30, 5, 20);
        const fl = Math.sin(t * 11 + i * 2) * 2;
        c.fillStyle = '#ff9d3c';
        c.beginPath(); c.ellipse(fx2 + 2.5, wallTop + 24 + fl * 0.4, 5, 8 + fl, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffe08a';
        c.beginPath(); c.ellipse(fx2 + 2.5, wallTop + 26, 2.5, 4.5, 0, 0, Math.PI * 2); c.fill();
      }
    }

    // ── 바닥 (원근 라인 + 미션 톤) ──
    const fg = c.createLinearGradient(0, M.FLOOR_Y, 0, H);
    fg.addColorStop(0, th.floor);
    fg.addColorStop(1, this.shade(th.floor, 0.72));
    c.fillStyle = fg;
    c.fillRect(0, M.FLOOR_Y, W, H - M.FLOOR_Y);
    // 보도 경계
    c.fillStyle = this.shade(th.floor, 1.25);
    c.fillRect(0, M.FLOOR_Y, W, 3);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.fillRect(0, M.FLOOR_Y + 3, W, 1.5);
    // 깊이 라인 (희미한 수평선)
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 1;
    for (const zz of [20, 40, 60]) {
      const y = M.FLOOR_Y + zz * ZS;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    // 바닥 균열·맨홀 (해시 데칼)
    for (let i = -1; i < 5; i++) {
      const seg = Math.floor(cam / 150) + i;
      const x = seg * 150 - cam + 40;
      const h2 = (seg * 40503 + 7) >>> 3;
      const zz = 14 + (h2 % 50);
      const y = M.FLOOR_Y + zz * ZS;
      if (h2 % 2 === 0) {
        c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 12, y + 4); c.lineTo(x + 20, y + 2); c.stroke();
      } else {
        c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(x + 14, y, 11, 4.5, 0, 0, Math.PI * 2); c.stroke();
      }
    }
  },

  // ── HUD: 초상화 + HP 바 ──
  drawHud(st, t) {
    const c = this.ctx;
    this.portraitBar(10, 8, 120, st.p.hp / st.p.maxHp, '#58c85c', 'mogu');
    this.portraitBar(10, 32, 92, Math.max(0, st.b.hp) / st.b.maxHp, '#ffd83d', 'chick');
    // 레벨 배지 + 경험치 게이지
    c.font = 'bold 9px sans-serif'; c.textAlign = 'left';
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    c.strokeText(`Lv.${st.lv}`, 10, 61);
    c.fillStyle = '#ffd83d';
    c.fillText(`Lv.${st.lv}`, 10, 61);
    if (st.lv < M.Logic.LV_MAX) {
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(38, 55, 52, 5);
      c.fillStyle = '#b07dff';
      c.fillRect(39, 56, 50 * Math.min(1, st.expInto / M.Logic.expNeed(st.lv)), 3);
    } else {
      c.fillStyle = '#b07dff';
      c.fillText('MAX', 38, 61);
    }
    const boss = st.enemies.find((e) => e.boss && M.Logic.alive(e));
    if (boss) {
      c.fillStyle = 'rgba(0,0,0,.5)';
      c.fillRect(W - 166, 10, 156, 12);
      c.fillStyle = '#ff5a5a';
      c.fillRect(W - 165, 11, 154 * Math.max(0, boss.hp / boss.maxHp), 10);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
      c.strokeRect(W - 166, 10, 156, 12);
      c.font = 'bold 9px sans-serif'; c.textAlign = 'right'; c.fillStyle = '#fff';
      c.fillText('👑 ' + boss.name, W - 12, 32);
    }
    c.font = 'bold 11px sans-serif'; c.textAlign = 'center';
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    c.fillStyle = 'rgba(255,255,255,.92)';
    const label = `MISSION ${st.mission} · ${st.stage.theme.name}`;
    c.strokeText(label, W / 2, 18);
    c.fillText(label, W / 2, 18);
  },

  portraitBar(x, y, w2, ratio, color, face) {
    const c = this.ctx;
    // 초상화 틀
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.beginPath(); c.roundRect(x, y, 19, 19, 3); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2;
    c.strokeRect(x, y, 19, 19);
    if (face === 'mogu' && this.mogu) {
      const a = this.mogu.width / this.mogu.height;
      c.save();
      c.beginPath(); c.rect(x + 1, y + 1, 17, 17); c.clip();
      c.drawImage(this.mogu, x + 9.5 - (17 * a) / 2, y + 1, 17 * a, 17);
      c.restore();
    } else if (face === 'chick') {
      c.fillStyle = '#f4f4f0';
      c.beginPath(); c.arc(x + 9.5, y + 11, 6.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d83a3a';
      c.beginPath(); c.arc(x + 7, y + 4.5, 2, 0, Math.PI * 2); c.arc(x + 10.5, y + 3.8, 2, 0, Math.PI * 2); c.arc(x + 13, y + 4.5, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f0a030';
      c.beginPath(); c.moveTo(x + 14, y + 10); c.lineTo(x + 18, y + 11.5); c.lineTo(x + 14, y + 13); c.fill();
      c.fillStyle = '#22262e'; c.fillRect(x + 10.5, y + 8.5, 2, 2);
    }
    // HP 바
    c.fillStyle = 'rgba(0,0,0,.5)';
    c.fillRect(x + 23, y + 5, w2, 9);
    c.fillStyle = color;
    c.fillRect(x + 24, y + 6, Math.max(0, (w2 - 2) * Math.min(1, ratio)), 7);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
    c.strokeRect(x + 23, y + 5, w2, 9);
  },

  // ── 캐릭터 (더블드래곤풍 리그) ──
  drawFighter(st, f, t) {
    const c = this.ctx;
    const x = f.x - this.camX;
    if (x < -70 || x > W + 70) return;
    const y = this.sy(f.z, f.jy);
    const down = f.state === 'down' || f.state === 'dead';
    const hurt = f.state === 'hurt';
    const atk = f.state === 'atk';
    const walk = f.state === 'walk';
    const dead = f.state === 'dead';
    const airkick = atk && f.jy > 0;

    // 그림자
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath(); c.ellipse(x, this.sy(f.z, 0) + 3, 15, 4.5, 0, 0, Math.PI * 2); c.fill();

    c.save();
    c.translate(x, y);
    if (f.face < 0) c.scale(-1, 1);
    if (dead) c.globalAlpha = Math.max(0, 1 - (f.stT - 0.8) / 0.8);
    if (down) { c.rotate(-Math.PI / 2); c.translate(4, 12); }
    if (hurt) { c.translate(Math.sin(t * 40) * 1.5, 0); c.rotate(-0.12); }

    const big = f.boss ? 1.35 : f.type === 'tank' ? 1.15 : 1;
    c.scale(big, big);

    // 팔레트
    const isP = f.kind === 'p', isB = f.kind === 'b';
    const E = M.ETYPES[f.type];
    const shirtC = isP ? '#d84838' : isB ? '#3a7ec8' : this.shade((f.body || (E && E.body) || '#9aa2ad'), 0.9);
    const skinC = isP ? '#e8c8a0' : isB ? '#f0e8d8' : this.shade((f.body || (E && E.body) || '#9aa2ad'), 1.18);
    const pantC = isP ? '#3a4a7a' : isB ? '#4a3a2a' : '#3a3644';
    const shoeC = isP ? '#e8e4dc' : '#2a2430';

    const step = walk ? Math.sin(t * 11) : 0;      // 걷기 위상

    // ── 다리 (무릎 굽힘 워크 사이클) ──
    if (airkick) {
      this.limb(0, -22, 16, -20, 7, pantC);        // 앞차기 허벅지+정강이
      this.limb(16, -20, 26, -18, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(29, -18, 5, 3.5, 0.2, 0, Math.PI * 2); c.fill();
      this.limb(-2, -22, -7, -12, 7, pantC);       // 접은 뒷다리
      this.limb(-7, -12, -2, -8, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(-1, -7, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
    } else if (f.jy > 0) {
      this.limb(1, -22, 4, -12, 7, pantC);
      this.limb(4, -12, 7, -8, 6, pantC);
      this.limb(-3, -22, -7, -13, 7, pantC);
      this.limb(-7, -13, -10, -9, 6, pantC);
      c.fillStyle = shoeC;
      c.beginPath(); c.ellipse(8, -7, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(-11, -8, 4.5, 3, 0, 0, Math.PI * 2); c.fill();
    } else {
      // 지상: 앞다리·뒷다리 (걸을 때 무릎이 번갈아 굽음)
      const k1 = step * 5, k2 = -step * 5;
      this.limb(2, -22, 4 + k1, -11, 7, pantC);
      this.limb(4 + k1, -11, 5 + k1 * 1.2, -1, 6, pantC);
      this.limb(-3, -22, -4 + k2, -11, 7, pantC);
      this.limb(-4 + k2, -11, -5 + k2 * 1.2, -1, 6, pantC);
      c.fillStyle = shoeC;
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(7 + k1 * 1.2, -1, 5.5, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(-3 + k2 * 1.2, -1, 5.5, 3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // ── 몸통 (역삼각 + 벨트 + 근육 음영) ──
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 2.4; c.lineJoin = 'round';
    c.fillStyle = shirtC;
    c.beginPath();
    c.moveTo(-11, -42); c.quadraticCurveTo(0, -45, 11, -42);
    c.lineTo(7, -21); c.quadraticCurveTo(0, -19, -7, -21);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = this.shade(shirtC, 0.75);        // 옆구리 음영
    c.beginPath();
    c.moveTo(6, -41); c.lineTo(11, -42); c.lineTo(7, -21); c.lineTo(4, -21);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -30); c.stroke();       // 가슴 골
    c.beginPath(); c.moveTo(-6, -29); c.quadraticCurveTo(0, -26.5, 6, -29); c.stroke();   // 가슴 근육
    // 벨트
    c.fillStyle = '#1a1620';
    c.fillRect(-7, -22, 14, 3.5);
    c.fillStyle = '#d8b83a';
    c.fillRect(-2, -22, 4, 3.5);

    // ── 팔 (가드 자세 / 펀치 / 어퍼컷) ──
    const shY = -38;
    if (atk && f.jy === 0) {
      const upper = f.combo === 3;
      if (upper) {
        this.limb(-8, shY, -14, -32, 6, skinC);    // 뒷팔 가드
        c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(-15, -31, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
        this.limb(8, shY, 17, -46, 6.5, skinC);    // 어퍼컷!
        this.limb(17, -46, 21, -56, 6, skinC);
        c.beginPath(); c.arc(22, -59, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
      } else {
        this.limb(-8, shY, -14, -31, 6, skinC);
        c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(-15, -30, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
        this.limb(8, shY, 18, -37, 6.5, skinC);    // 스트레이트
        this.limb(18, -37, 28, -36, 6, skinC);
        c.beginPath(); c.arc(31, -36, 5.5, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    } else if (hurt || down) {
      this.limb(-8, shY, -15, -30, 6, skinC);
      this.limb(8, shY, 15, -30, 6, skinC);
    } else {
      // 파이팅 가드: 두 주먹을 몸 앞에
      const g2 = Math.sin(t * 4 + (isB ? 1 : 0)) * 0.8;
      this.limb(-8, shY, -12, -30 + g2, 6, skinC);
      this.limb(-12, -30 + g2, -5, -27 + g2, 5.5, skinC);
      this.limb(8, shY, 13, -31 - g2, 6, skinC);
      this.limb(13, -31 - g2, 9, -27 - g2, 5.5, skinC);
      c.fillStyle = skinC; c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(-4, -27 + g2, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(10, -27 - g2, 4.5, 0, Math.PI * 2); c.fill(); c.stroke();
    }

    // ── 머리 ──
    this.drawHead(f, t);

    // 적 체력바
    if (!isP && !isB && f.hp < f.maxHp && !down) {
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(-12, -70, 24, 3);
      c.fillStyle = '#ff5a5a'; c.fillRect(-12, -70, 24 * Math.max(0, f.hp / f.maxHp), 3);
    }
    c.restore();
  },

  drawHead(f, t) {
    const c = this.ctx;
    if (f.kind === 'p') {
      if (this.mogu) {
        const a = this.mogu.width / this.mogu.height, hh = 25;
        c.save();
        c.scale(-1, 1);                   // 원본 사진이 왼쪽을 봄 → 로컬(오른쪽 향) 반전
        c.drawImage(this.mogu, -hh * a / 2, -64, hh * a, hh);
        c.restore();
      }
      return;
    }
    if (f.kind === 'b') {
      // 꼬꼬
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.8;
      c.fillStyle = '#f4f4f0';
      c.beginPath(); c.arc(1, -50, 10.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#d83a3a';
      c.beginPath(); c.arc(-3, -60, 3, 0, Math.PI * 2); c.arc(1, -62, 3.2, 0, Math.PI * 2); c.arc(5, -60, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(9, -44); c.lineTo(12, -39); c.lineTo(7, -41); c.fill();   // 턱볏
      c.fillStyle = '#f0a030';
      c.beginPath(); c.moveTo(10, -51); c.lineTo(19, -49); c.lineTo(10, -46); c.fill(); c.stroke();
      c.fillStyle = '#22262e'; c.fillRect(4, -54, 3, 3);
      c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1;
      c.beginPath(); c.arc(1, -50, 10.5, 0.6, 1.8); c.stroke();
      return;
    }
    // 악당 머리
    const E = M.ETYPES[f.type] || f;
    const bodyC = f.body || (E && E.body) || '#9aa2ad';
    const earC = f.ear || (E && E.ear) || '#c8ccd4';
    c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.8;
    if (f.type === 'tank' || f.base === 'tank') {
      // 로봇 머리
      c.fillStyle = bodyC;
      c.beginPath(); c.roundRect(-10, -60, 21, 15, 4); c.fill(); c.stroke();
      c.fillStyle = '#ff5252';
      c.fillRect(3, -56, 5, 3.5);
      c.fillStyle = 'rgba(255,255,255,.25)';
      c.fillRect(-8, -59, 17, 3);
      c.strokeStyle = earC; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-4, -60); c.lineTo(-6, -66); c.stroke();
      c.fillStyle = earC;
      c.beginPath(); c.arc(-6, -67, 2, 0, Math.PI * 2); c.fill();
    } else {
      // 쥐 머리: 주둥이 + 수염 + 귀
      c.fillStyle = bodyC;
      c.beginPath(); c.ellipse(0, -50, 10.5, 9.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(7, -52); c.quadraticCurveTo(16, -50, 15, -46);
      c.quadraticCurveTo(10, -43, 5, -45); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = earC;
      c.beginPath(); c.arc(-6, -59, 4.8, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(2, -61, 4.8, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = this.shade(earC, 0.7);
      c.beginPath(); c.arc(-6, -59, 2.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(2, -61, 2.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1620';
      c.beginPath(); c.arc(14, -48.5, 1.6, 0, Math.PI * 2); c.fill();   // 코
      c.fillRect(3, -53, 2.6, 2.6);                                     // 눈
      c.strokeStyle = 'rgba(230,230,240,.6)'; c.lineWidth = 0.9;
      for (const wy of [-49, -47]) {
        c.beginPath(); c.moveTo(11, wy); c.lineTo(19, wy - 1.5); c.stroke();
      }
    }
    if (f.boss) {
      c.fillStyle = '#ffd83d';
      c.strokeStyle = 'rgba(20,16,28,.9)'; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-8, -63); c.lineTo(-5, -72); c.lineTo(-1, -64); c.lineTo(3, -73); c.lineTo(7, -63);
      c.closePath(); c.fill(); c.stroke();
    }
  },
};
