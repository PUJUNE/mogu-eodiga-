# build.py — 모구 고양이 왕국 모듈을 시리즈용 단일 HTML로 병합
# 산출물: ../mogukingdom.html
import base64
import re
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE.parent / "mogukingdom.html"
html = (HERE / "index.html").read_text(encoding="utf-8")

icon = HERE.parent / "game" / "assets" / "mogu-icon.png"
icon_uri = "data:image/png;base64," + base64.b64encode(icon.read_bytes()).decode()
html = html.replace('<link rel="icon" href="../game/assets/mogu-icon.png">', '<link rel="icon" href="data:,">')
html = html.replace('<img src="../game/assets/mogu-icon.png"', '<img src="' + icon_uri + '"')
html = re.sub(
    r'<script>window\.MKR=\{ASSETS:\{mogu:"[^"]+"\}\};</script>',
    '<script>window.MKR={ASSETS:{mogu:""}};</script>',
    html,
)

order = ["rng.js", "world.js", "sim.js", "render.js", "ui.js", "main.js"]
merged = []
for name in order:
    code = (HERE / "src" / name).read_text(encoding="utf-8")
    merged.append("/* ── %s ── */\n%s" % (name, code))
merged_js = "\n".join(merged)
html = re.sub(
    r'(<script src="src/[^"]+"></script>\s*)+',
    lambda _: "<script>\n" + merged_js + "\n</script>\n",
    html,
)

OUT.write_text(html, encoding="utf-8")
print("빌드 완료:", OUT, "(%.0f KB)" % (OUT.stat().st_size / 1024))
