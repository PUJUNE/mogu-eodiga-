# build.py — mogumarble/ 모듈들을 단일 배포 html로 병합
# 산출물: ../mogumarble.html (THREE.js 내장 — 더블클릭 실행, 외부 의존 없음)
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogumarble.html"

html = (HERE / "index.html").read_text(encoding="utf-8")

# THREE.js 내장
three = (HERE / "vendor" / "three.min.js").read_text(encoding="utf-8")
html = html.replace(
    '<script src="vendor/three.min.js"></script>',
    "<script>\n" + three + "\n</script>",
)

order = ["board.js", "logic.js", "ai.js", "audio.js", "ui.js", "render3d.js", "main.js"]
merged = []
for name in order:
    code = (HERE / "src" / name).read_text(encoding="utf-8")
    merged.append("/* ── %s ── */\n(function(){\n%s\n})();" % (name, code))
merged_js = "\n".join(merged)

html = re.sub(
    r'(<script src="src/[^"]+"></script>\s*)+',
    lambda m: "<script>\n" + merged_js + "\n</script>\n",
    html,
)

OUT.write_text(html, encoding="utf-8")
print("빌드 완료:", OUT, f"({OUT.stat().st_size/1024:.0f} KB)")
