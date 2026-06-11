// rng.js — 시드 기반 결정적 난수 + 1D 값 노이즈
const G = window.MOGU;

G.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

G.makeRng = function (seed) {
  const f = G.mulberry32(seed);
  return {
    next: f,
    range: (a, b) => a + f() * (b - a),
    int: (a, b) => Math.floor(a + f() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
  };
};

// 정수 격자 해시 (좌표 기반 결정적 난수 — 청크 재생성에도 항상 동일)
G.hash2 = function (x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// 부드러운 1D 값 노이즈 (코사인 보간)
G.noise1d = function (t, seed) {
  const i = Math.floor(t), f = t - i;
  const a = G.hash2(i, 0, seed), b = G.hash2(i + 1, 0, seed);
  const u = (1 - Math.cos(f * Math.PI)) * 0.5;
  return a * (1 - u) + b * u; // 0..1
};
