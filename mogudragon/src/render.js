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
    // CC0 에셋 (ansimuz "Streets of Fight"): 캐릭터 시트·스테이지 레이어·소품
    this.imgs = {};
    for (const k of ['g_idle', 'g_walk', 'g_jab', 'g_punch', 'g_kick', 'g_jump',
      'g_jumpkick', 'g_divekick', 'g_hurt',
      'p_idle', 'p_walk', 'p_punch', 'p_hurt',
      'st_back', 'st_fore', 'pr_barrel', 'pr_car', 'pr_hydrant',
      'pr_sushi1', 'pr_sushi2', 'pr_banner1']) {
      if (!M.ASSETS[k]) continue;
      const im2 = new Image();
      im2.onload = () => { this.imgs[k] = im2; };
      im2.src = M.ASSETS[k];
    }
    this.tintCv = document.createElement('canvas');
    this.tintCv.width = 96; this.tintCv.height = 63;
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

  // 다중 스톱 hex 보간 (밴드 그라데이션용)
  mixStops(stops, t) {
    const n = stops.length - 1;
    const k = Math.min(n - 1, Math.floor(t * n));
    const f = t * n - k;
    const a = parseInt(stops[k].slice(1), 16), b = parseInt(stops[k + 1].slice(1), 16);
    const ch = (sh) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * f);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  },

  // CRT 아케이드 후처리 (원작 스크린샷 분석 반영: 원작은 밝고 대비가 강함 — 그레이드 절제)
  retroPass() {
    const c = this.ctx;
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = 'rgba(255,140,60,.05)';
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgba(0,0,0,.08)';
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.58, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(8,4,10,.26)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
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
    this.retroPass();
  },

  // ── 미션별 배경 (황혼 도시 무드 — 하늘 띠 0~62px에 원경을 얹음) ──
  drawBackground(st, t, cam) {
    const c = this.ctx, th = st.stage.theme, m = st.mission;
    // 하늘: M1은 CC0 스테이지 레이어(밤거리), 나머지는 지붕 위 얇은 띠만
    const stops = th.horizon ? [th.sky0, th.sky1, th.horizon] : [th.sky0, th.sky1];
    if (m !== 1) {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = this.mixStops(stops, i / 3);
        c.fillRect(0, 3 * i, W, 4);
      }
    } else {
      // ── M1 밤거리 (ansimuz Streets of Fight 레이어, CC0) ──
      c.fillStyle = th.sky0;
      c.fillRect(0, 0, W, M.FLOOR_Y);
      c.imageSmoothingEnabled = false;
      const bk = this.imgs && this.imgs.st_back;
      if (bk) {                          // 원경 시가 (느린 패럴랙스, ×2)
        const bw = bk.width * 2, bh = bk.height * 2;
        const off = ((cam * 0.18) % bw + bw) % bw;
        for (let x = -off; x < W; x += bw) c.drawImage(bk, x, M.FLOOR_Y - bh - 34, bw, bh);
      }
      const fo = this.imgs && this.imgs.st_fore;
      if (fo) {                          // 근경 건물·상점 (×1.22 — 바닥선 정합)
        const s2 = 1.22, fw = fo.width * s2, fh = fo.height * s2;
        const off = ((cam * 0.6) % fw + fw) % fw;
        for (let x = -off; x < W + fw; x += fw) c.drawImage(fo, x, M.FLOOR_Y - fh, fw, fh);
      }
      // 소품 (월드 앵커): 차·소화전·네온 간판·현수막
      const prop = (key, wx, py2, s2, pf) => {
        const im2 = this.imgs && this.imgs[key];
        if (!im2) return;
        const wI = im2.width * s2, hI = im2.height * s2;
        for (let i2 = -1; i2 < 2; i2++) {
          const seg = Math.floor(cam * pf / 700) + i2;
          const x = seg * 700 - cam * pf + wx;
          if (x > -wI && x < W + wI) c.drawImage(im2, x, py2 - hI, wI, hI);
        }
      };
      prop('pr_car', 320, M.FLOOR_Y, 1, 0.6);
      prop('pr_hydrant', 150, M.FLOOR_Y, 1, 0.6);
      prop('pr_barrel', 520, M.FLOOR_Y, 1, 0.6);
      const sushi = (Math.floor(t * 3) % 2 === 0) ? 'pr_sushi1' : 'pr_sushi2';
      prop(sushi, 636, M.FLOOR_Y - 58, 1, 0.6);
      c.imageSmoothingEnabled = true;
    }

    // ── 근경 벽 (미션별) — 상단 12px까지 구조물이 채움 ──
    const wallTop = 12, wallH = M.FLOOR_Y - wallTop;
    if (m === -1) {
      // (구 벽돌 골목 분기 — M1은 SOF 스테이지 레이어로 대체되어 비활성)
      const w1 = 96;
      c.fillStyle = '#6a4a44';
      c.fillRect(0, w1, W, M.FLOOR_Y - w1);
      c.fillStyle = this.shade('#6a4a44', 1.22);       // 담장 상단 갓돌
      c.fillRect(0, w1, W, 5);
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
      for (let ry = 5; ry < M.FLOOR_Y - w1; ry += 10) {
        c.beginPath(); c.moveTo(0, w1 + ry); c.lineTo(W, w1 + ry); c.stroke();
        const off = (ry / 10) % 2 ? 12 : 0;
        for (let bx = -24; bx < W + 24; bx += 24) {
          const x = bx + off - ((cam * 0.6) % 24);
          c.beginPath(); c.moveTo(x, w1 + ry); c.lineTo(x, w1 + ry + 10); c.stroke();
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
          c.fillText(['MOGU!', '냥', '~=≋', 'ZZZ'][h2 % 4], x + 30, 128);
          c.globalAlpha = 1;
        } else if (h2 % 3 === 1) {      // 창살 창문 (담벼락 중단)
          c.fillStyle = '#2a2030';
          c.fillRect(x + 40, 112, 34, 26);
          c.strokeStyle = '#8a7a74'; c.lineWidth = 2;
          c.strokeRect(x + 40, 112, 34, 26);
          c.beginPath(); c.moveTo(x + 51, 112); c.lineTo(x + 51, 138);
          c.moveTo(x + 62, 112); c.lineTo(x + 62, 138); c.stroke();
        } else {                        // 쓰레기통 + 나뒹구는 유리병
          c.fillStyle = '#4a5a5a';
          c.beginPath(); c.roundRect(x + 90, M.FLOOR_Y - 30, 26, 30, 3); c.fill();
          c.fillStyle = '#3a4a4a';
          c.fillRect(x + 87, M.FLOOR_Y - 34, 32, 6);
          c.fillStyle = 'rgba(90,160,90,.85)';
          c.fillRect(x + 122, M.FLOOR_Y - 11, 5, 11);
          c.fillRect(x + 123.5, M.FLOOR_Y - 15, 2, 5);
          c.save();
          c.translate(x + 136, M.FLOOR_Y - 2); c.rotate(1.35);   // 쓰러진 병
          c.fillStyle = 'rgba(140,100,50,.85)';
          c.fillRect(-2.5, -10, 5, 10);
          c.fillRect(-1, -14, 2, 5);
          c.restore();
        }
        // 체인링크 펜스 (h2 짝수 구간, 담벼락 중단)
        if (h2 % 2 === 0) {
          const fx0 = x + 118, fw = 38;
          c.strokeStyle = 'rgba(180,190,200,.4)'; c.lineWidth = 1;
          for (let k = 0; k <= 4; k++) {
            c.beginPath(); c.moveTo(fx0 + k * 9, 106); c.lineTo(fx0 + k * 9 - 10, 144); c.stroke();
            c.beginPath(); c.moveTo(fx0 + k * 9 - 10, 106); c.lineTo(fx0 + k * 9, 144); c.stroke();
          }
          c.strokeStyle = 'rgba(140,150,160,.6)'; c.lineWidth = 2;
          c.strokeRect(fx0 - 10, 106, fw + 10, 38);
        }
      }
      // 담장 차양 (상점 자리)
      for (let i = -1; i < 3; i++) {
        const seg = Math.floor(cam * 0.6 / 260) + i;
        const x = seg * 260 - cam * 0.6 + 30;
        for (let k = 0; k < 5; k++) {
          c.fillStyle = k % 2 ? '#8e3038' : '#d8cfc0';
          c.beginPath();
          c.moveTo(x + k * 12, 100); c.lineTo(x + k * 12 + 12, 100);
          c.lineTo(x + k * 12 + 10, 112); c.lineTo(x + k * 12 - 2, 112);
          c.closePath(); c.fill();
        }
      }
      // 드럼통 무더기 + 상자 더미 (원작 밀도)
      for (let i = -1; i < 4; i++) {
        const seg = Math.floor(cam * 0.6 / 250) + i;
        const x = seg * 250 - cam * 0.6 + 168;
        const h2 = (seg * 69621 + 11) >>> 4;
        if (h2 % 2 === 0) {
          for (let k = 0; k < 3; k++) {
            const bx2 = x + k * 20, by2 = M.FLOOR_Y - 34;
            c.fillStyle = k % 2 ? '#a05a30' : '#8e4c28';
            c.beginPath(); c.roundRect(bx2, by2 + (k % 2) * 4, 19, 30, 3); c.fill();
            c.fillStyle = 'rgba(255,255,255,.18)';
            c.fillRect(bx2 + 2, by2 + 3 + (k % 2) * 4, 4, 24);
            c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
            for (const ry of [8, 16, 24]) { c.beginPath(); c.moveTo(bx2, by2 + ry + (k % 2) * 4); c.lineTo(bx2 + 19, by2 + ry + (k % 2) * 4); c.stroke(); }
          }
        } else {
          c.fillStyle = '#9a7a4a';
          c.fillRect(x, M.FLOOR_Y - 24, 26, 24);
          c.fillRect(x + 10, M.FLOOR_Y - 44, 26, 22);
          c.strokeStyle = 'rgba(40,26,10,.5)'; c.lineWidth = 1.5;
          c.strokeRect(x, M.FLOOR_Y - 24, 26, 24);
          c.strokeRect(x + 10, M.FLOOR_Y - 44, 26, 22);
          c.beginPath(); c.moveTo(x, M.FLOOR_Y - 24); c.lineTo(x + 26, M.FLOOR_Y); c.stroke();
        }
      }
      // 가로등: 깜빡이는 불빛 콘 + 바닥 빛 웅덩이
      for (let i = -1; i < 4; i++) {
        const seg = Math.floor(cam * 0.6 / 220) + i;
        const x = seg * 220 - cam * 0.6 + 130;
        const flick = (seg * 7 + Math.floor(t * 9)) % 23 === 0 ? 0.25 : 1;   // 이따금 깜빡
        c.fillStyle = '#2a2430';
        c.fillRect(x, 46, 4, M.FLOOR_Y - 46);
        c.fillRect(x - 8, 44, 20, 4);
        c.fillStyle = `rgba(255,214,130,${0.85 * flick})`;
        c.beginPath(); c.ellipse(x + 2, 50, 5, 3.5, 0, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 0.13 * flick;
        c.fillStyle = '#ffd88a';
        c.beginPath();
        c.moveTo(x - 2, 51); c.lineTo(x + 6, 51);
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
      // 환풍 팬 (상부 밴드 — 회전)
      for (let i = -1; i < 3; i++) {
        const seg = Math.floor(cam * 0.6 / 240) + i;
        const x = seg * 240 - cam * 0.6 + 60;
        c.fillStyle = '#2a262e';
        c.beginPath(); c.arc(x, 30, 14, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#4a464e'; c.lineWidth = 2;
        c.beginPath(); c.arc(x, 30, 14, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#5a565e';
        for (let k = 0; k < 4; k++) {
          const a = t * 4 + k * Math.PI / 2 + seg;
          c.beginPath();
          c.moveTo(x, 30);
          c.arc(x, 30, 11, a, a + 0.55);
          c.closePath(); c.fill();
        }
      }
      // 크레이트 더미 + 유리병
      for (let i = -1; i < 3; i++) {
        const seg = Math.floor(cam * 0.6 / 300) + i;
        const x = seg * 300 - cam * 0.6 + 150;
        c.fillStyle = '#8a7a58';
        c.fillRect(x, M.FLOOR_Y - 28, 30, 28);
        c.fillRect(x + 14, M.FLOOR_Y - 52, 28, 24);
        c.strokeStyle = 'rgba(40,30,14,.5)'; c.lineWidth = 1.5;
        c.strokeRect(x, M.FLOOR_Y - 28, 30, 28);
        c.strokeRect(x + 14, M.FLOOR_Y - 52, 28, 24);
        c.beginPath(); c.moveTo(x, M.FLOOR_Y - 28); c.lineTo(x + 30, M.FLOOR_Y);
        c.moveTo(x + 14, M.FLOOR_Y - 52); c.lineTo(x + 42, M.FLOOR_Y - 28); c.stroke();
        c.fillStyle = 'rgba(40,30,14,.5)';             // 스텐실 마킹
        c.font = 'bold 9px monospace'; c.textAlign = 'left';
        c.fillText('MOGU', x + 4, M.FLOOR_Y - 12);
        c.fillText('냥', x + 20, M.FLOOR_Y - 38);
        for (let k = 0; k < 3; k++) {                  // 크레이트 위 병
          const bx2 = x + 18 + k * 8;
          c.fillStyle = k % 2 ? 'rgba(90,160,90,.85)' : 'rgba(140,100,50,.85)';
          c.fillRect(bx2, M.FLOOR_Y - 62, 5, 10);
          c.fillRect(bx2 + 1.5, M.FLOOR_Y - 66, 2, 5);
          c.fillStyle = 'rgba(255,255,255,.35)';
          c.fillRect(bx2 + 0.8, M.FLOOR_Y - 61, 1.2, 7);
        }
      }
      // 컨베이어 벨트 (구동 라인)
      const cyv = M.FLOOR_Y - 12;
      c.fillStyle = '#26222c';
      c.fillRect(0, cyv, W, 9);
      c.fillStyle = '#4a4652';
      for (let bx2 = -26; bx2 < W + 26; bx2 += 26) {
        const xx = bx2 - ((cam * 0.6 + t * 55) % 26);
        c.fillRect(xx, cyv + 1.5, 14, 6);
      }
      c.fillStyle = '#5a5662';
      for (let i = -1; i < 8; i++) {
        const xx = i * 70 - ((cam * 0.6) % 70);
        c.beginPath(); c.arc(xx, cyv + 4.5, 4, 0, Math.PI * 2); c.fill();
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
      // 어두운 숲길: 화면을 채우는 거대 나무 기둥 (원작 문법) + 캐노피 + 울타리 + 반딧불
      c.fillStyle = '#16301a';
      c.fillRect(0, wallTop, W, wallH);
      // 뒤층 어두운 기둥
      c.fillStyle = '#122414';
      for (let i = -1; i < 6; i++) {
        const x = i * 110 - ((cam * 0.35) % 110) + 40;
        c.fillRect(x, wallTop, 26, wallH);
      }
      // 앞층 거대 기둥 (나무 결)
      for (let i = -1; i < 5; i++) {
        const seg = Math.floor(cam * 0.55 / 130) + i;
        const x = seg * 130 - cam * 0.55;
        const wdt = 34 + ((seg * 37 + 5) % 18);
        c.fillStyle = '#5a4428';
        c.fillRect(x, wallTop, wdt, wallH);
        c.fillStyle = '#6a5232';
        c.fillRect(x + 4, wallTop, wdt * 0.3, wallH);
        c.strokeStyle = 'rgba(30,20,8,.45)'; c.lineWidth = 1.5;
        for (let k = 1; k < 4; k++) {
          c.beginPath(); c.moveTo(x + (wdt / 4) * k, wallTop); c.lineTo(x + (wdt / 4) * k + 3, M.FLOOR_Y); c.stroke();
        }
        c.fillStyle = 'rgba(20,40,20,.6)';                    // 이끼
        c.beginPath(); c.ellipse(x + wdt / 2, M.FLOOR_Y - 6, wdt / 2 + 4, 7, 0, 0, Math.PI * 2); c.fill();
      }
      // 캐노피 (상단 잎 뭉치 2줄)
      for (let i = -1; i < 12; i++) {
        const x = i * 48 - ((cam * 0.5) % 48);
        c.fillStyle = '#1c3c1e';
        c.beginPath(); c.ellipse(x, 14, 34, 16, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2a5228';
        c.beginPath(); c.ellipse(x + 20, 26, 26, 12, 0, 0, Math.PI * 2); c.fill();
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
    } else if (m === 4) {
      // 악당 아지트: 사암 석벽 + 횃불 + 붉은 현수막 (원작 분석 — 밝은 사암 + 붉은 카펫)
      c.fillStyle = th.wall;
      c.fillRect(0, wallTop, W, wallH);
      c.strokeStyle = 'rgba(70,42,16,.45)'; c.lineWidth = 2;
      for (let ry = 0; ry < wallH; ry += 26) {       // 큰 사암 블록 (원작 스케일)
        c.beginPath(); c.moveTo(0, wallTop + ry); c.lineTo(W, wallTop + ry); c.stroke();
        const off = (ry / 26) % 2 ? 30 : 0;
        for (let bx = -60; bx < W + 60; bx += 60) {
          const x = bx + off - ((cam * 0.6) % 60);
          c.beginPath(); c.moveTo(x, wallTop + ry); c.lineTo(x, wallTop + ry + 26); c.stroke();
        }
      }
      // 석조 부조 명판 (상부 밴드)
      for (let i = -1; i < 4; i++) {
        const seg = Math.floor(cam * 0.6 / 200) + i;
        const x = seg * 200 - cam * 0.6 + 100;
        c.fillStyle = this.shade(th.wall, 0.8);
        c.beginPath(); c.roundRect(x, 20, 34, 24, 3); c.fill();
        c.strokeStyle = 'rgba(40,24,10,.55)'; c.lineWidth = 2;
        c.strokeRect(x, 20, 34, 24);
        c.fillStyle = 'rgba(40,24,10,.5)';
        c.beginPath(); c.arc(x + 17, 30, 6, 0, Math.PI * 2); c.fill();
        c.fillRect(x + 13, 34, 8, 7);
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

    // ── 표면 질감 (명암 얼룩 — 회화 패스) ──
    const wt2 = wallTop;
    for (let i = m === 1 ? 99 : -1; i < 26; i++) {   // M1은 스테이지 레이어라 질감 패스 생략
      const seg = Math.floor(cam * 0.6 / 60) + i;
      const h2 = (seg * 2246822519 + 5) >>> 5;
      const x = seg * 60 - cam * 0.6 + (h2 % 40);
      const yy = wt2 + 6 + (h2 % 5) * ((M.FLOOR_Y - wt2 - 20) / 5);
      const w3 = 18 + (h2 % 34), h3 = 6 + (h2 % 14);
      c.fillStyle = h2 % 3 === 0 ? 'rgba(255,244,220,.05)' : 'rgba(10,6,14,.07)';
      c.fillRect(x, Math.min(yy, M.FLOOR_Y - h3 - 2), w3, h3);
    }
    // 벽-바닥 접합 AO (접지감)
    const ao = c.createLinearGradient(0, M.FLOOR_Y - 20, 0, M.FLOOR_Y);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, 'rgba(0,0,0,.24)');
    c.fillStyle = ao;
    c.fillRect(0, M.FLOOR_Y - 20, W, 20);

    // ── 바닥 (벽보다 밝은 콘크리트 — 원작 문법) ──
    const fg = c.createLinearGradient(0, M.FLOOR_Y, 0, H);
    fg.addColorStop(0, this.shade(th.floor, 1.08));
    fg.addColorStop(1, this.shade(th.floor, 0.8));
    c.fillStyle = fg;
    c.fillRect(0, M.FLOOR_Y, W, H - M.FLOOR_Y);
    if (m === 4) {                      // 아지트: 붉은 카펫 러너 + 금 테 (원작 분석 — 카펫 빨강 상향)
      c.fillStyle = '#c81808';
      c.fillRect(0, M.FLOOR_Y + 10, W, H - M.FLOOR_Y - 16);
      c.fillStyle = '#d8b83a';
      c.fillRect(0, M.FLOOR_Y + 10, W, 2.5);
      c.fillRect(0, H - 8, W, 2.5);
      c.fillStyle = 'rgba(0,0,0,.14)';
      for (let i = -1; i < 8; i++) {
        const x = i * 70 - (cam % 70);
        c.beginPath();
        c.moveTo(x, M.FLOOR_Y + 42); c.lineTo(x + 16, M.FLOOR_Y + 30);
        c.lineTo(x + 32, M.FLOOR_Y + 42); c.lineTo(x + 16, M.FLOOR_Y + 54);
        c.closePath(); c.fill();
      }
    }
    // 보도 경계
    c.fillStyle = this.shade(th.floor, 1.3);
    c.fillRect(0, M.FLOOR_Y, W, 3);
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.fillRect(0, M.FLOOR_Y + 3, W, 1.5);
    // 패널 경계 (수평 + 사선 이음 — 콘크리트 판, 골목·공장만)
    if (m === 1 || m === 2) {
      c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 1.4;
      for (const zz of [22, 46, 68]) {
        const y = M.FLOOR_Y + zz * ZS;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
      for (let i = -1; i < 6; i++) {
        const x = i * 120 - (cam % 120) + 30;
        c.beginPath(); c.moveTo(x, M.FLOOR_Y + 4); c.lineTo(x - 30, H); c.stroke();
      }
      c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1;
      for (const zz of [22, 46, 68]) {
        const y = M.FLOOR_Y + zz * ZS + 1.6;
        c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
      }
    }
    // 플레이필드 드럼통 (골목 — CC0 에셋 소품, 바닥 위)
    if (m === 1 && this.imgs && this.imgs.pr_barrel) {
      c.imageSmoothingEnabled = false;
      for (let i = -1; i < 3; i++) {
        const seg = Math.floor(cam / 380) + i;
        const x = seg * 380 - cam + 90;
        const h2 = (seg * 92821 + 3) >>> 4;
        if (h2 % 3 === 0) continue;
        const zz = 18 + (h2 % 34);
        const y = M.FLOOR_Y + zz * ZS;
        const im2 = this.imgs.pr_barrel;
        c.fillStyle = 'rgba(0,0,0,.28)';
        c.beginPath(); c.ellipse(x + im2.width / 2, y + 2, im2.width * 0.55, 5, 0, 0, Math.PI * 2); c.fill();
        c.drawImage(im2, x, y - im2.height, im2.width, im2.height);
      }
      c.imageSmoothingEnabled = true;
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
    // HP 블록 게이지 (80년대 아케이드 문법)
    const cells = 10, cw = Math.floor((w2 - 2) / cells);
    c.fillStyle = 'rgba(0,0,0,.6)';
    c.fillRect(x + 23, y + 5, cw * cells + 4, 9);
    const filled = Math.ceil(Math.max(0, Math.min(1, ratio)) * cells);
    for (let k = 0; k < cells; k++) {
      c.fillStyle = k < filled ? (ratio <= 0.3 ? '#e84848' : '#3a6ae8') : '#20242e';
      c.fillRect(x + 25 + k * cw, y + 6.5, cw - 1.5, 6);
      if (k < filled) {
        c.fillStyle = 'rgba(255,255,255,.4)';
        c.fillRect(x + 25 + k * cw, y + 6.5, cw - 1.5, 1.6);
      }
    }
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
    c.strokeRect(x + 23, y + 5, cw * cells + 4, 9);
  },

  // ── 캐릭터 (더블드래곤풍 리그) ──
  // 스프라이트 패스: 본체를 오프스크린에 그린 뒤 균일 윤곽 + 상하 2톤 셀 셰이딩 합성 (아케이드 화풍)
  drawFighter(st, f, t) {
    const c0 = this.ctx;
    const x = f.x - this.camX;
    if (x < -70 || x > W + 70) return;
    const y = this.sy(f.z, f.jy);
    // 접지 그림자 (메인 캔버스)
    c0.fillStyle = 'rgba(0,0,0,.3)';
    c0.beginPath(); c0.ellipse(x, this.sy(f.z, 0) + 3, 15, 4.5, 0, 0, Math.PI * 2); c0.fill();
    if (!this.osc) {
      this.osc = document.createElement('canvas'); this.osc.width = 160; this.osc.height = 190;
      this.os2 = document.createElement('canvas'); this.os2.width = 160; this.os2.height = 190;
    }
    const oc = this.osc.getContext('2d');
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, 160, 190);
    oc.setTransform(1, 0, 0, 1, 80 - x, 136 - y);
    this.ctx = oc;
    this.drawFighterBody(st, f, t);
    this.ctx = c0;
    oc.setTransform(1, 0, 0, 1, 0, 0);
    // 2톤 셰이딩: 위 하이라이트 · 아래 그늘 (실루엣 안쪽만)
    oc.globalCompositeOperation = 'source-atop';
    const sg = oc.createLinearGradient(0, 56, 0, 152);
    sg.addColorStop(0, 'rgba(255,240,205,.12)');
    sg.addColorStop(0.5, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(24,12,34,.24)');
    oc.fillStyle = sg; oc.fillRect(0, 0, 160, 190);
    oc.globalCompositeOperation = 'source-over';
    // 균일 윤곽선: 실루엣을 어두운 색으로 8방향 오프셋
    const o2 = this.os2.getContext('2d');
    o2.setTransform(1, 0, 0, 1, 0, 0);
    o2.clearRect(0, 0, 160, 190);
    o2.drawImage(this.osc, 0, 0);
    o2.globalCompositeOperation = 'source-in';
    o2.fillStyle = 'rgba(22,14,28,.95)';
    o2.fillRect(0, 0, 160, 190);
    o2.globalCompositeOperation = 'source-over';
    const bx = x - 80, by = y - 136;
    for (const [ox, oy] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      c0.drawImage(this.os2, bx + ox, by + oy);
    }
    c0.drawImage(this.osc, bx, by);
  },

  drawFighterBody(st, f, t) {
    const c = this.ctx;
    const x = f.x - this.camX;
    const y = this.sy(f.z, f.jy);
    const down = f.state === 'down' || f.state === 'dead';
    const hurt = f.state === 'hurt';
    const atk = f.state === 'atk';
    const walk = f.state === 'walk';
    const dead = f.state === 'dead';
    const airkick = atk && f.jy > 0;

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

    // ── CC0 스프라이트 캐릭터 (ansimuz Streets of Fight) — 플레이어·잡졸 ──
    // 시트 규격: 프레임 96×63, 발 기준선 프레임 하단. 보스·꼬꼬는 기존 관절 리그 유지.
    const sofP = isP && this.imgs && this.imgs.g_idle;
    const sofE = f.kind === 'e' && !f.boss && this.imgs && this.imgs.p_idle;
    if (sofP || sofE) {
      let key, n, fi;
      if (sofP) {
        if (airkick) { key = 'g_jumpkick'; n = 3; fi = Math.min(2, Math.floor(f.stT / 0.09)); }
        else if (f.jy > 0) { key = 'g_jump'; n = 4; fi = f.vy > 60 ? 1 : f.vy < -60 ? 3 : 2; }
        else if (atk) {
          key = f.combo === 3 ? 'g_kick' : f.combo === 2 ? 'g_punch' : 'g_jab';
          n = f.combo === 3 ? 5 : 3;
          fi = Math.min(n - 1, Math.floor(f.stT / (0.28 / n)));
        } else if (hurt || down) { key = 'g_hurt'; n = 2; fi = Math.min(1, Math.floor(f.stT / 0.16)); }
        else if (walk) { key = 'g_walk'; n = 10; fi = Math.floor(t * 14) % n; }
        else { key = 'g_idle'; n = 4; fi = Math.floor(t * 6) % n; }
      } else {
        if (atk) { key = 'p_punch'; n = 3; fi = Math.min(2, Math.floor(f.stT / 0.09)); }
        else if (hurt || down) { key = 'p_hurt'; n = 4; fi = Math.min(3, Math.floor(f.stT / 0.1)); }
        else if (walk) { key = 'p_walk'; n = 4; fi = Math.floor(t * 9) % n; }
        else { key = 'p_idle'; n = 4; fi = Math.floor(t * 6) % n; }
      }
      const img = this.imgs[key];
      if (img) {
        const s = f.type === 'tank' ? 1.18 : f.type === 'quick' ? 0.88 : 1;
        c.imageSmoothingEnabled = false;
        c.save();
        c.scale(-1, 1);                                // 시트 원본이 왼쪽을 봄 → 기본 반전
        if (sofE && f.type !== 'thug') {
          // 색조 변형 잡졸 (빠른 쥐: 주황 / 덩치: 청회)
          const tc = this.tintCv.getContext('2d');
          tc.clearRect(0, 0, 96, 63);
          tc.drawImage(img, fi * 96, 0, 96, 63, 0, 0, 96, 63);
          tc.globalCompositeOperation = 'source-atop';
          tc.fillStyle = f.type === 'quick' ? 'rgba(230,130,40,.32)' : 'rgba(60,80,130,.38)';
          tc.fillRect(0, 0, 96, 63);
          tc.globalCompositeOperation = 'source-over';
          c.drawImage(this.tintCv, 0, 0, 96, 63, -48 * s, -63 * s, 96 * s, 63 * s);
        } else {
          c.drawImage(img, fi * 96, 0, 96, 63, -48 * s, -63 * s, 96 * s, 63 * s);
        }
        c.restore();
        c.imageSmoothingEnabled = true;
        if (sofP && this.mogu) {
          // 모구 얼굴 (스프라이트 머리 위치에 합성 — 시리즈 정체성)
          const a2 = this.mogu.width / this.mogu.height, hh = 16;
          c.save(); c.scale(-1, 1);
          c.drawImage(this.mogu, -hh * a2 / 2, -58, hh * a2, hh);
          c.restore();
        }
        c.restore();
        return;
      }
    }

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
