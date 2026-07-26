// sim-test.mjs — 노드 그래프 완전 열거 검증
//   (a) 무한루프·막다른 노드 0건  (b) 24개 엔딩 전부 도달 가능
//   (c) 고아 노드 0건  (d) 게이트 양쪽 모두 실경로 존재  (e) 원작 정본 경로(13부 전체) 존재
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const win = {};
new Function("window", readFileSync(join(HERE, "../src/story.js"), "utf8"))(win);
new Function("window", readFileSync(join(HERE, "../src/engine.js"), "utf8"))(win);

const NS = win.MNC;
const { STORY, ENDINGS, START, BASE_STATS, Logic } = NS;

const fail = [];
const note = (m) => fail.push(m);

/* ── 1) 참조 무결성 ── */
const referenced = new Set([START]);
for (const [id, n] of Object.entries(STORY)) {
  const push = (t, why) => {
    if (!t) return note(`${id}: ${why} 대상이 비어 있음`);
    if (!STORY[t]) note(`${id}: ${why} → 존재하지 않는 노드 '${t}'`);
    referenced.add(t);
  };
  if (n.branch) {
    if (n.lines || n.choices || n.next || n.ending) note(`${id}: branch 노드에 다른 필드가 섞임`);
    push(n.branch.then, "branch.then");
    push(n.branch.else, "branch.else");
    if (n.branch.gte == null && n.branch.lte == null) note(`${id}: branch에 gte/lte 없음`);
    continue;
  }
  if (!Array.isArray(n.lines) || n.lines.length === 0) note(`${id}: lines 없음`);
  else n.lines.forEach((l, i) => {
    if (!Array.isArray(l) || l.length !== 2) note(`${id}: lines[${i}] 형식 오류`);
    else if (l[0] !== "n" && !NS.CHARS[l[0]]) note(`${id}: lines[${i}] 미등록 화자 '${l[0]}'`);
  });
  const outs = ["choices", "next", "ending"].filter((k) => n[k]);
  if (outs.length !== 1) note(`${id}: 출구가 ${outs.length}개 (choices/next/ending 중 정확히 하나여야 함)`);
  if (n.choices) {
    if (n.choices.length < 2) note(`${id}: choices가 2개 미만`);
    n.choices.forEach((c, i) => {
      if (!c.t) note(`${id}: choices[${i}] 문구 없음`);
      push(c.next, `choices[${i}].next`);
    });
  }
  if (n.next) push(n.next, "next");
  if (n.ending && !ENDINGS[n.ending]) note(`${id}: 미등록 엔딩 '${n.ending}'`);
  // 등장 인물이 cast에 있는지 (내레이션 제외)
  if (n.lines) {
    const cast = new Set(n.cast || []);
    for (const [who] of n.lines)
      if (who !== "n" && !cast.has(who)) note(`${id}: 화자 '${who}'가 cast에 없음`);
  }
  if (n.bg && !NS.__bgOk) { /* 배경 키 검증은 scenes.js 로드 시에만 */ }
}

/* ── 2) 고아 노드 ── */
for (const id of Object.keys(STORY))
  if (!referenced.has(id)) note(`고아 노드: ${id} (아무도 참조하지 않음)`);

/* ── 3) 전 경로 완전 열거 ── */
const reachedEndings = new Set();
const visitedNodes = new Set();
const gateSides = new Map(); // gateId -> Set('then'|'else')
let paths = 0, maxDepth = 0;
const OVER = 400; // 루프 감지용 깊이 한계

function resolve(id, stats, trail) {
  let guard = 0;
  while (STORY[id] && STORY[id].branch && guard++ < 30) {
    const b = STORY[id].branch;
    const v = stats[b.stat] || 0;
    const ok = b.gte != null ? v >= b.gte : v <= b.lte;
    if (!gateSides.has(id)) gateSides.set(id, new Set());
    gateSides.get(id).add(ok ? "then" : "else");
    visitedNodes.add(id);
    id = ok ? b.then : b.else;
  }
  if (guard >= 30) note(`branch 연쇄 루프 의심: ${trail.slice(-4).join(" → ")}`);
  return id;
}

const memo = new Set();          // 'node|luck|guard|grace' — 같은 상태 재방문 시 가지치기
function walk(id, stats, trail) {
  if (trail.length > OVER) { note(`무한루프 의심 (깊이 ${OVER} 초과): ${trail.slice(-6).join(" → ")}`); return; }
  id = resolve(id, stats, trail);
  const n = STORY[id];
  if (!n) return; // 참조 무결성에서 이미 보고됨
  const st = { ...stats };
  if (n.fx) for (const k in n.fx) st[k] = (st[k] || 0) + n.fx[k];
  visitedNodes.add(id);
  const key = id + "|" + st.luck + "|" + st.guard + "|" + st.grace;
  if (memo.has(key)) return;
  memo.add(key);
  const t2 = trail.concat(id);
  maxDepth = Math.max(maxDepth, t2.length);
  if (n.ending) { reachedEndings.add(n.ending); paths++; return; }
  if (n.next) return walk(n.next, st, t2);
  if (n.choices) {
    for (const c of n.choices) {
      const s2 = { ...st };
      if (c.fx) for (const k in c.fx) s2[k] = (s2[k] || 0) + c.fx[k];
      walk(c.next, s2, t2);
    }
    return;
  }
  note(`막다른 노드: ${id} (출구 없음)`);
}

walk(START, { ...BASE_STATS }, []);

/* ── 4) 엔딩 도달 ── */
for (const key of Object.keys(ENDINGS))
  if (!reachedEndings.has(key)) note(`도달 불가 엔딩: ${key} (${ENDINGS[key].n}. ${ENDINGS[key].title})`);

/* ── 5) 게이트 양쪽 실경로 ── */
for (const [id, n] of Object.entries(STORY)) {
  if (!n.branch) continue;
  const sides = gateSides.get(id);
  if (!sides) { note(`게이트 미도달: ${id}`); continue; }
  if (!sides.has("then")) note(`게이트 한쪽만 사용: ${id} (then 경로 없음 — gte ${n.branch.gte ?? n.branch.lte} 도달 불가)`);
  if (!sides.has("else")) note(`게이트 한쪽만 사용: ${id} (else 경로 없음)`);
}

/* ── 6) 방문되지 않은 노드 ── */
for (const id of Object.keys(STORY))
  if (!visitedNodes.has(id)) note(`실행 중 한 번도 방문되지 않음: ${id}`);

/* ── 7) 원작 정본 경로 (13부 전체 통과) ── */
{
  const st = { ...BASE_STATS };
  const s2 = Logic.newState();
  s2.stats = st;
  const seen = [];
  let cur = Logic.enter(s2, START), guard = 0;
  // 정본: 매 선택에서 원작에 해당하는 첫 번째 선택지를 고른다
  const CANON = {
    p1_5: 0, p1_8: 2, p1_10: 0, p1_13: 0, p2_3: 0, p2_5: 0, p3_2: 1, p3_9: 0, p3_11: 0,
    p4_7: 0, p4_8: 0, p4_9: 0, p4_10: 0, p5_3: 0, p6_3: 0, p6_6: 0, p8_2: 0, p8_3: 0,
    p8_4: 0, p8_6: 0, p8_7: 0, p9_5: 2, p9_8: 0, p10_4: 1, p11_2: 0, p12_2: 0
  };
  const parts = new Set();
  while (guard++ < 500) {
    seen.push(s2.node);
    const m = /^p(\d+)_/.exec(s2.node);
    if (m) parts.add(+m[1]);
    const n = STORY[s2.node];
    if (n.ending) break;
    if (n.choices) { Logic.choose(s2, CANON[s2.node] ?? 0); continue; }
    if (n.next) { Logic.advance(s2); continue; }
    break;
  }
  const missing = [];
  for (let i = 1; i <= 13; i++) if (!parts.has(i)) missing.push(i);
  if (missing.length) note(`정본 경로가 통과하지 못한 부: ${missing.join(", ")}부`);
  const endId = STORY[s2.node].ending;
  if (endId !== "trough") note(`정본 경로의 엔딩이 '돌 구유의 약속'이 아님: ${endId}`);
  console.log(`정본 경로  노드 ${seen.length}개 · 통과한 부 ${[...parts].sort((a, b) => a - b).join(",")} · 엔딩 ${endId}`);
}

/* ── 결과 ── */
const nodeCount = Object.keys(STORY).length;
const branchCount = Object.values(STORY).filter((n) => n.branch).length;
const lineCount = Object.values(STORY).reduce((a, n) => a + (n.lines ? n.lines.length : 0), 0);
const charCount = Object.values(STORY).reduce(
  (a, n) => a + (n.lines ? n.lines.reduce((b, l) => b + l[1].length, 0) : 0), 0);

console.log(`노드 ${nodeCount}개 (게이트 ${branchCount}) · 대사 ${lineCount}줄 · ${charCount.toLocaleString()}자`);
console.log(`상태 열거: 고유 상태 ${memo.size.toLocaleString()}개 · 엔딩 도달 상태 ${paths.toLocaleString()}개 · 최대 깊이 ${maxDepth}`);
console.log(`엔딩 도달 ${reachedEndings.size} / ${Object.keys(ENDINGS).length}`);

if (fail.length) {
  console.error(`\n❌ 실패 ${fail.length}건`);
  fail.slice(0, 40).forEach((m) => console.error("  · " + m));
  if (fail.length > 40) console.error(`  … 외 ${fail.length - 40}건`);
  process.exit(1);
}
console.log("\n✅ sim-test 전체 통과");
