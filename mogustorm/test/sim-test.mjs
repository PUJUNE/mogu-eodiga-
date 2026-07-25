// sim-test.mjs — 스토리 그래프 완전 열거 검증 (Node, 브라우저 불필요)
// 검증: 전 경로 종결(무한루프·막다른 노드 0) / 18개 엔딩 전부 도달 / 고아 노드 0 /
//       게이트 양쪽 실경로 존재 / 노드 데이터 형식 무결성
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;
for (const f of ["story.js", "engine.js"]) {
  // eslint 없는 환경 — 순수 데이터/로직 모듈만 eval 로드
  new Function(readFileSync(path.join(HERE, "..", "src", f), "utf-8"))();
}
const NS = globalThis.MWH;
const L = NS.Logic;
const STORY = NS.STORY;

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log("PASS", name);
  else { fails++; console.log("FAIL", name, extra || ""); }
}

/* 1) 노드 형식 무결성 */
let badNodes = [];
for (const [id, n] of Object.entries(STORY)) {
  if (n.branch) {
    const b = n.branch;
    if (!b.stat || (b.gte == null && b.lte == null) || !STORY[b.then] || !STORY[b.else])
      badNodes.push(id + ":branch");
    continue;
  }
  if (!Array.isArray(n.lines) || n.lines.length === 0) badNodes.push(id + ":lines");
  const exits = [n.next ? 1 : 0, n.choices ? 1 : 0, n.ending ? 1 : 0].reduce((a, b) => a + b);
  if (exits !== 1) badNodes.push(id + ":exits=" + exits);
  if (n.next && !STORY[n.next]) badNodes.push(id + ":next→" + n.next);
  if (n.choices)
    for (const c of n.choices) if (!STORY[c.next]) badNodes.push(id + ":choice→" + c.next);
  if (n.ending && !NS.ENDINGS[n.ending]) badNodes.push(id + ":ending→" + n.ending);
}
check("노드 형식 무결성 (출구 정확히 1개·참조 유효)", badNodes.length === 0, badNodes.join(","));

/* 2) 전 경로 완전 열거 — 선택 조합 전부 DFS */
const reached = new Set();      // 도달한 노드
const endingsHit = new Map();   // 엔딩id → 경로 수
const gateSides = new Map();    // 게이트노드 → Set("then"/"else")
let pathCount = 0;
let maxDepth = 0;
const DEPTH_LIMIT = 300;

function resolveTracked(id, stats) {
  let guard = 0;
  let n = STORY[id];
  while (n && n.branch && guard++ < 20) {
    const b = n.branch;
    const v = stats[b.stat] || 0;
    const ok = b.gte != null ? v >= b.gte : v <= b.lte;
    if (!gateSides.has(id)) gateSides.set(id, new Set());
    gateSides.get(id).add(ok ? "then" : "else");
    reached.add(id);
    id = ok ? b.then : b.else;
    n = STORY[id];
  }
  return id;
}

function walk(id, stats, depth) {
  if (depth > DEPTH_LIMIT) throw new Error("깊이 한계 초과(루프 의심): " + id);
  maxDepth = Math.max(maxDepth, depth);
  id = resolveTracked(id, stats);
  const n = STORY[id];
  if (!n) throw new Error("미정의 노드: " + id);
  reached.add(id);
  const st = { ...stats };
  L.applyFx(st, n.fx);
  if (n.ending) {
    endingsHit.set(n.ending, (endingsHit.get(n.ending) || 0) + 1);
    pathCount++;
    return;
  }
  if (n.next) return walk(n.next, st, depth + 1);
  for (const c of n.choices) {
    const cs = { ...st };
    L.applyFx(cs, c.fx);
    walk(c.next, cs, depth + 1);
  }
}

let walkError = null;
try {
  walk(NS.START, { ...NS.BASE_STATS }, 0);
} catch (e) {
  walkError = e;
}
check("전 경로 종결 (무한루프·미정의 노드 0)", !walkError, walkError && walkError.message);
console.log(`  · 총 경로 수: ${pathCount}, 최대 깊이: ${maxDepth}`);

/* 3) 18개 엔딩 전부 도달 */
const allEndings = Object.keys(NS.ENDINGS);
const missing = allEndings.filter((e) => !endingsHit.has(e));
check(`엔딩 ${allEndings.length}종 전부 도달 가능`, missing.length === 0, "미도달: " + missing.join(","));
check("엔딩 15종 이상", allEndings.length >= 15, String(allEndings.length));
for (const [e, c] of [...endingsHit].sort((a, b) => NS.ENDINGS[a[0]].n - NS.ENDINGS[b[0]].n))
  console.log(`  · [${String(NS.ENDINGS[e].n).padStart(2)}] ${NS.ENDINGS[e].title} ← ${c}개 경로`);

/* 4) 게이트 양쪽 실경로 */
const gateNodes = Object.keys(STORY).filter((k) => STORY[k].branch);
const oneSided = gateNodes.filter((g) => !gateSides.get(g) || gateSides.get(g).size < 2);
check("모든 게이트 양쪽(then/else) 실경로 존재", oneSided.length === 0, oneSided.join(","));

/* 5) 고아 노드 0 */
const orphans = Object.keys(STORY).filter((k) => !reached.has(k));
check("고아 노드 0건", orphans.length === 0, orphans.join(","));

/* 6) 엔딩 톤 분포 — 행복(4~5)·중간(2~3)·절망(1) 모두 3종 이상 */
const tones = allEndings.map((e) => NS.ENDINGS[e].tone);
const happy = tones.filter((t) => t >= 4).length;
const mid = tones.filter((t) => t === 2 || t === 3).length;
const despair = tones.filter((t) => t === 1).length;
check("톤 분포 폭넓음 (행복·중간·절망 각 3종+)", happy >= 3 && mid >= 3 && despair >= 3,
  `행복${happy}/중간${mid}/절망${despair}`);
console.log(`  · 분포 — 행복(4~5): ${happy}, 중간(2~3): ${mid}, 절망(1): ${despair}`);

/* 7) 엔진 세이브 로직 스모크 (localStorage 셔임) */
{
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
  };
  const st = L.start();
  L.saveProgress(st);
  const isNew = L.collectEnding("spring");
  const again = L.collectEnding("spring");
  check("세이브·엔딩 수집 로직", isNew === true && again === false && L.endingCount() === 1);
}

console.log(fails === 0 ? "\n✅ sim-test 전체 통과" : `\n❌ 실패 ${fails}건`);
process.exit(fails === 0 ? 0 : 1);
