# build.py — mogusketch/ 모듈들을 단일 배포 html로 병합
# 산출물: ../mogusketch.html (더블클릭 실행, 외부 의존 없음 — 그림은 전부 캔버스 선으로 그린다)
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogusketch.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# 모듈 스크립트 병합 (각 파일을 블록 스코프로 감싸 const 충돌 방지)
order = ["rng.js", "data.js", "poses.js", "logic.js", "ai.js", "render.js", "audio.js", "ui.js", "main.js"]
merged = []
for name in order:
    code = (HERE / "src" / name).read_text(encoding="utf-8")
    merged.append("/* ── %s ── */\n{\n%s\n}" % (name, code))
merged_js = "\n".join(merged)

html = re.sub(
    r'(<script src="src/[^"]+"></script>\s*)+',
    lambda m: "<script>\n" + merged_js + "\n</script>\n",
    html,
)

OUT.write_text(html, encoding="utf-8")
print("빌드 완료:", OUT, f"({OUT.stat().st_size/1024:.0f} KB)")
