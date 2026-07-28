# build.py — mogurace/ 모듈들을 단일 배포 html로 병합
# 산출물: ../mogurace.html (더블클릭 실행, 외부 의존 없음)
import base64
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogurace.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# 1) 에셋 → base64 데이터 URI
# index.html의 ASSETS 블록에 적힌 "assets/…" 경로를 전부 찾아 데이터 URI로 치환한다.
# (파일이 늘어도 build.py를 고칠 필요가 없다)
MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def data_uri(rel):
    p = HERE / rel
    mime = MIME.get(p.suffix.lower())
    if mime is None:
        raise SystemExit("지원하지 않는 에셋 형식: %s" % rel)
    return "data:%s;base64,%s" % (mime, base64.b64encode(p.read_bytes()).decode())


def embed_assets(m):
    block = m.group(0)
    used = sorted(set(re.findall(r'"(assets/[^"]+)"', block)))
    if not used:
        raise SystemExit("ASSETS 블록에서 에셋 경로를 찾지 못했습니다")
    for rel in used:
        block = block.replace('"%s"' % rel, '"%s"' % data_uri(rel))
    print("  에셋 %d개 내장" % len(used))
    return block


html, n = re.subn(r"<script>window\.MRC = \{ ASSETS:.*?\};</script>", embed_assets, html, flags=re.S)
if n != 1:
    raise SystemExit("ASSETS 스크립트 블록을 찾지 못했습니다")

# 2) 모듈 스크립트 병합 (각 파일을 블록 스코프로 감싸 const 충돌 방지)
order = ["rng.js", "levels.js", "logic.js", "render.js", "audio.js", "ui.js", "main.js"]
merged = []
for name in order:
    code = (HERE / "src" / name).read_text(encoding="utf-8")
    code = re.sub(r"^import .*?;\s*$", "", code, flags=re.M)  # 개별 import 제거
    merged.append("/* ── %s ── */\n{\n%s\n}" % (name, code))
merged_js = "\n".join(merged)

html = re.sub(
    r'(<script type="module" src="src/[^"]+"></script>\s*)+',
    lambda m: '<script type="module">\n' + merged_js + "\n</script>\n",
    html,
)

OUT.write_text(html, encoding="utf-8")
print("빌드 완료:", OUT, f"({OUT.stat().st_size/1024:.0f} KB)")
