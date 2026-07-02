// levels.js — 시드 기반 힐(스테이지) 생성: 인런 프로파일 + 착지 언덕 + 바람
const M = window.MSJ;

M.WORLDS = {
  1: { name: '뒷동산',     sky0: '#8ecdf0', sky1: '#d8f0fa', ground: '#5da24a', track: '#8fd070', far: '#79b868', accent: '#ffd83d', night: false },
  2: { name: '가을 숲',    sky0: '#f0b870', sky1: '#fae0b8', ground: '#a06a34', track: '#d89858', far: '#c08048', accent: '#ff7d3c', night: false },
  3: { name: '사막 사구',  sky0: '#f2d494', sky1: '#faecc8', ground: '#d8b470', track: '#f0d498', far: '#e4c484', accent: '#ff9d5c', night: false },
  4: { name: '설산',       sky0: '#a8c8e8', sky1: '#e8f2fa', ground: '#e8f2fa', track: '#ffffff', far: '#c8dcf0', accent: '#5db8ff', night: false },
  5: { name: '꿈속 밤하늘', sky0: '#120a2a', sky1: '#3a2860', ground: '#2a1c50', track: '#5a4090', far: '#241650', accent: '#e08fff', night: true },
};

const RIVALS = { 10: '재빠른 생쥐', 20: '바람 까마귀', 30: '사막 청소기', 40: '그림자 점퍼', 50: '쥐마왕 킹' };

// 스테이지별 목표 거리(m) — 퍼펙트 봇 시뮬레이션 거리 × 0.84 로 역산해 구움
// (재생성 방법: test/tune.mjs — 물리 상수를 바꾸면 반드시 다시 구워야 함)
M.TARGETS = [39.5, 41, 42, 43, 44.5, 45.5, 47.5, 48, 48.5, 49, 52, 52, 51.5, 52, 52.5,
  54, 56.5, 57, 56.5, 59.5, 58, 59.5, 60.5, 60.5, 65.5, 69.5, 69, 66, 72, 72.5,
  74.5, 80, 83.5, 89, 91, 87.5, 92.5, 97, 96, 109, 109.5, 119.5, 119.5, 114, 115,
  141, 143.5, 151, 151, 161.5];

M.makeStage = function (no) {
  const rng = M.makeRng(no * 7919 + 77);
  const world = Math.min(5, Math.ceil(no / 10));
  const theme = M.WORLDS[world];

  const K = Math.round((20 + (no - 1) * 2.041) * 2) / 2;      // K20 → K120
  const vLip = 16.5 + (no - 1) * 0.23;                        // 도약 순간 속도 (m/s)
  const a = 3.9 + no * 0.012;                                 // 활강 가속 (m/s²)
  const L = (vLip * vLip) / (2 * a);                          // 인런 길이 (m)

  // 바람: 월드 1은 무풍, 이후 스테이지별 결정적 (+ = 맞바람 = 유리)
  let wind = 0;
  if (world >= 2) wind = Math.round(rng.range(-1, 1) * (1 + world * 0.55) * 10) / 10;

  // ── 인런 프로파일 (도약대 끝 = 원점, y 위+) ──
  // 테이블(마지막 8m)은 9.5°, 위로 갈수록 30°까지 급해짐
  const TABLE = 9.5 * Math.PI / 180, TOP = 30 * Math.PI / 180;
  const pts = [];                    // s = 립까지 남은 거리 → {x, y, th}
  let x = 0, y = 0;
  const step = 1.5;
  pts.push({ s: 0, x: 0, y: 0, th: TABLE });
  for (let s = step; s <= L + step; s += step) {
    const u = Math.max(0, Math.min(1, (s - 8) / Math.max(1, L - 8)));
    const th = TABLE + (TOP - TABLE) * (u * u * (3 - 2 * u));
    x -= Math.cos(th) * step;
    y += Math.sin(th) * step;
    pts.push({ s, x, y, th });
  }
  const inrunAt = (s) => {                                    // s(립까지 거리) → 위치·경사
    const c = Math.max(0, Math.min(pts.length - 1.001, s / step));
    const i = Math.floor(c), f = c - i;
    const A = pts[i], B = pts[Math.min(i + 1, pts.length - 1)];
    return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f, th: A.th + (B.th - A.th) * f };
  };

  // ── 착지 언덕 프로파일 (x ≥ 0, y 음수로 하강) ──
  const yK = -(0.13 * K + 0.26 * K);                          // x=K 지점 높이
  const K1 = K * 1.32, EASE = 34;
  const hillY = (hx) => {
    if (hx <= 0) return 0;
    if (hx <= K) return -(0.13 * hx + (0.26 * hx * hx) / K);
    if (hx <= K1) return yK - 0.65 * (hx - K);
    const yK1 = yK - 0.65 * (K1 - K);
    if (hx <= K1 + EASE) {
      const u = (hx - K1) / EASE;
      return yK1 - 0.65 * EASE * (u - (u * u) / 2);
    }
    return yK1 - 0.65 * EASE * 0.5;
  };

  const cl = M.CL_CAL ? M.CL_CAL(K) : 0.0075;   // 양력 계수 (CL_CAL은 튜닝 스크립트용 후크)

  return {
    no, world, theme, K, vLip, a, L, wind,
    rival: RIVALS[no] || null,
    target: M.TARGETS[no - 1], cl,
    inrunAt, hillY, inrunPts: pts,
  };
};
