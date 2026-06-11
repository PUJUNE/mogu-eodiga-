// stagegen.js — 시드 기반 스테이지 절차 생성 (통과 가능 경로 보장)
const G = window.MOGU;

G.makeStage = function (stageNo) {
  const P = G.paramsFor(stageNo);
  const seed = stageNo * 7919 + 13;
  const rng = G.makeRng(seed);

  // ── 강 형태 (해석적 함수: 어디서든 동일 값) ──
  const a1 = P.curveAmp, p1 = P.curvePeriod, ph1 = rng.range(0, Math.PI * 2);
  const a2 = P.curveAmp * 0.4, p2 = P.curvePeriod * 0.37, ph2 = rng.range(0, Math.PI * 2);
  const wSeed = seed + 101;

  const cx = (z) => a1 * Math.sin((Math.PI * 2 * z) / p1 + ph1) + a2 * Math.sin((Math.PI * 2 * z) / p2 + ph2);
  const halfW = (z) => {
    const n = G.noise1d(z * 0.018, wSeed);
    return (P.widthMin + (P.widthMax - P.widthMin) * n) / 2;
  };

  const L = P.length;
  const obstacles = [], items = [], decos = [], zones = [], gates = [];

  // ── 특수 구간 (급류 / 눈보라) ──
  const zoneCount = P.rapids || P.blizzard ? 1 + Math.floor(((stageNo - 1) % 10) / 3) : 0;
  for (let i = 0; i < zoneCount; i++) {
    const zlen = rng.range(40, 70);
    const z0 = (L * (i + 1)) / (zoneCount + 1) + rng.range(-30, 30);
    zones.push({ type: P.rapids ? 'rapid' : 'blizzard', z0: Math.max(70, z0), z1: Math.min(L - 50, z0 + zlen) });
  }

  // ── 폭포 게이트 (W5) ──
  for (let i = 0; i < P.waterfalls; i++) {
    const z = (L * (i + 1)) / (P.waterfalls + 1) + rng.range(-20, 20);
    const gapHalf = Math.max(1.3, 1.8 - ((stageNo - 1) / 49) * 0.5);
    const hw = halfW(z);
    gates.push({ z, gapOff: rng.range(-(hw - gapHalf - 1), hw - gapHalf - 1), gapHalf });
  }

  // ── 장애물 배치: 통로(gap) 경로를 추적하며 항상 통과폭 보장 ──
  const GAP_HALF = 1.4;          // 보장 통로 반폭 (바구니 판정 0.6 + 여유)
  let gapX = 0;
  let z = 55;                    // 출발 직후 안전 구간
  let lastZ = z;

  const place = (type, oz, off, extra) => {
    obstacles.push(Object.assign({ type, z: oz, off }, extra || {}));
  };

  const gapSamples = [{ z: 0, x: 0 }];

  while (z < L - 40) {
    const hw = halfW(z);
    const dz = z - lastZ;
    const reach = P.latReach * (dz / P.speed) * 0.65;
    gapX = Math.max(-(hw - GAP_HALF - 0.6), Math.min(hw - GAP_HALF - 0.6, gapX + rng.range(-reach, reach)));
    gapSamples.push({ z, x: gapX });

    const nearGate = gates.some((g) => Math.abs(g.z - z) < 14);
    if (!nearGate) {
      const type = rng.pick(P.obstacles);
      const lo = gapX - GAP_HALF, hi = gapX + GAP_HALF;   // 비워둘 통로
      const leftRoom = lo - (-hw), rightRoom = hw - hi;

      if (type === 'rock' || type === 'icefloe') {
        const big = type === 'icefloe';
        const extF = big ? 1.15 : 0.95;          // 충돌 판정 배율 (player.js와 일치)
        const n = rng.int(1, big ? 2 : 3);
        for (let k = 0; k < n; k++) {
          const side = rng.chance(leftRoom / (leftRoom + rightRoom + 0.001)) ? -1 : 1;
          const room = side < 0 ? leftRoom : rightRoom;
          // 장애물 충돌 반경이 빈 공간 안에 들어가도록 크기 클램프
          let r = big ? rng.range(1.4, 2.0) : rng.range(0.9, 1.4);
          const maxExt = room / 2 - 0.55;
          if (maxExt < 0.7) continue;
          r = Math.min(r, maxExt / extF);
          const ext = r * extF;
          const cLo = side < 0 ? -hw + ext + 0.35 : hi + ext + 0.25;
          const cHi = side < 0 ? lo - ext - 0.25 : hw - ext - 0.35;
          if (cHi <= cLo) continue;
          place(type, z + rng.range(-2, 2) * (k > 0 ? 1 : 0), rng.range(cLo, cHi), { r });
        }
      } else if (type === 'lily') {
        for (let k = 0; k < rng.int(2, 4); k++) {
          const c = rng.range(-hw + 1, hw - 1);
          if (Math.abs(c - gapX) < GAP_HALF + 0.6) continue;
          place('lily', z + rng.range(-3, 3), c, { r: 1.1 });
        }
      } else if (type === 'log' || type === 'crevasse') {
        // 통로만 남기고 가로막는 벽 (crevasse는 얼음벽 비주얼)
        if (leftRoom > 1.6) place(type === 'log' ? 'logwall' : 'icewall', z, (lo - hw) / 2, { half: leftRoom / 2 - 0.2 });
        if (rightRoom > 1.6) place(type === 'log' ? 'logwall' : 'icewall', z, (hi + hw) / 2, { half: rightRoom / 2 - 0.2 });
      } else if (type === 'movelog') {
        const len = hw * 2 * rng.range(0.32, 0.45);
        const amp = Math.max(0, hw - len / 2 - 1.5);
        place('movelog', z, 0, { len, amp, period: rng.range(2.2, 3.6), phase: rng.range(0, Math.PI * 2) });
      } else if (type === 'pillar') {
        for (let k = 0; k < rng.int(2, 3); k++) {
          const c = rng.range(-hw + 1.2, hw - 1.2);
          if (Math.abs(c - gapX) < GAP_HALF + 1.0) continue;
          place('pillar', z, c, { r: 0.8 });
        }
      } else if (type === 'cactuswall') {
        const side = leftRoom > rightRoom ? -1 : 1;
        const room = side < 0 ? leftRoom : rightRoom;
        if (room > 2.4) {
          const half = Math.min(room / 2 - 0.3, hw * 0.45);
          place('cactuswall', z, side < 0 ? -hw + half : hw - half, { half, side });
        }
      } else if (type === 'sandbar') {
        const side = leftRoom > rightRoom ? -1 : 1;
        const room = side < 0 ? leftRoom : rightRoom;
        if (room > 2.6) place('sandbar', z, side < 0 ? lo - room / 2 : hi + room / 2, { r: Math.min(2.2, room / 2 - 0.2) });
      }
    }

    lastZ = z;
    z += P.interval * rng.range(0.8, 1.25);
  }
  gapSamples.push({ z: L, x: 0 });
  obstacles.sort((a, b) => a.z - b.z);

  // ── 아이템: 통로 경로를 따라 배치 (아이템 라인 = 추천 주행선) ──
  let gi = 0, itemId = 0;
  for (let iz = 60; iz < L - 35; iz += 6.5) {
    while (gi < gapSamples.length - 2 && gapSamples[gi + 1].z < iz) gi++;
    const A = gapSamples[gi], B = gapSamples[gi + 1];
    const t = Math.min(1, Math.max(0, (iz - A.z) / Math.max(1, B.z - A.z)));
    const off = A.x + (B.x - A.x) * t + rng.range(-0.5, 0.5);
    if (rng.chance(0.62)) {
      const kind = rng.chance(0.12) ? 'fish' : 'chur';
      items.push({ id: itemId++, z: iz, off, kind });
    }
  }

  // ── 둔치 장식 (나무·집·선인장·횃불 등) ──
  for (let dz2 = 20; dz2 < L; dz2 += 7) {
    for (const side of [-1, 1]) {
      const h = G.hash2(Math.round(dz2), side, seed + 7);
      if (h < 0.42) {
        const type = P.theme.deco[Math.floor(G.hash2(Math.round(dz2), side * 3, seed + 9) * P.theme.deco.length)];
        decos.push({ type, z: dz2, side, dist: 2.5 + G.hash2(Math.round(dz2), side * 5, seed + 11) * 13 });
      }
    }
  }
  // W5: 강둑 횃불 추가 (조명 느낌)
  if (P.theme.night) for (let tz = 30; tz < L; tz += 18) {
    decos.push({ type: 'torch', z: tz, side: tz % 36 < 18 ? -1 : 1, dist: 0.8 });
  }

  // ── 닭 이스터에그 ──
  let chicken = null;
  if (P.chicken) {
    const czRaw = L * 0.3;
    let coff = 0;
    for (let k = 0; k < gapSamples.length - 1; k++)
      if (gapSamples[k].z <= czRaw && gapSamples[k + 1].z > czRaw) {
        const A = gapSamples[k], B = gapSamples[k + 1];
        coff = A.x + ((B.x - A.x) * (czRaw - A.z)) / Math.max(1, B.z - A.z);
      }
    chicken = { z: czRaw, off: coff, joined: false };
  }

  return { no: stageNo, params: P, seed, cx, halfW, length: L, finishZ: L - 6,
           obstacles, items, decos, zones, gates, chicken };
};
