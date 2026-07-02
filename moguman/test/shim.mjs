// shim.mjs — node 단독 실행용 window 스텁 + 로직 모듈 로드 (렌더·오디오·UI 제외)
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.window = { MGM: {} };
globalThis.performance = globalThis.performance || { now: () => Date.now() };

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
for (const name of ['rng.js', 'levels.js', 'logic.js']) {
  const code = readFileSync(join(src, name), 'utf-8');
  new Function('window', code)(globalThis.window);
}
