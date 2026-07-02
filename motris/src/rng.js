// rng.js — 시드 기반 결정적 난수 (모구 어디가 rng.js와 동일 계열)
const M = window.MTR;

M.mulberry32 = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

M.makeRng = function (seed) {
  const f = M.mulberry32(seed);
  return {
    next: f,
    range: (a, b) => a + f() * (b - a),
    int: (a, b) => Math.floor(a + f() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
  };
};
