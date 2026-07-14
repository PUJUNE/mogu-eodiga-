// shim.mjs — node 단독 실행용 window 스텁 + 로직 모듈 로드
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

globalThis.window = { MBL: {} };

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
for (const name of ['board.js', 'logic.js', 'ai.js']) {
  const code = readFileSync(join(src, name), 'utf-8');
  new Function('window', code)(globalThis.window);
}
