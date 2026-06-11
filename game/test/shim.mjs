// shim.mjs — node에서 브라우저 모듈을 로드하기 위한 window 셔임
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;
window.MOGU = { ASSETS: {} };

for (const f of ['rng.js', 'difficulty.js', 'stagegen.js']) {
  const code = readFileSync(join(here, '..', 'src', f), 'utf8');
  new Function(code)(); // import 없는 순수 로직 모듈만 로드
}
