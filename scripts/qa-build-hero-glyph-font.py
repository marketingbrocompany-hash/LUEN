#!/usr/bin/env python3
"""Make a temporary original-font hero-only glyph subset for isolated CI.
No font binaries are committed, uploaded, or linked for users.
The official original Pretendard source is SIL OFL 1.1.
"""
from html.parser import HTMLParser
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
import json
import re
import urllib.request
root = Path.cwd()
html = (root / "index.html").read_text("utf-8")
match = re.search(r'<section class="hero">(.+?)</section>', html, re.S)
if not match:
    raise RuntimeError("Missing unique hero section")
class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, data):
        self.parts.append(data)
texts = []
for pattern in (r"<h1>(.+?)</h1>", r'<p class="hero-desc">(.+?)</p>'):
    el = re.search(pattern, match.group(1), re.S)
    if not el:
        raise RuntimeError("Missing hero title or description")
    parser = Text()
    parser.feed(el.group(1))
    texts.extend(parser.parts)
# Only actual glyphs in hero headline/description. Other homepage text uses
# official CDN subsets as before, never a heavy duplicate full-font load.
text = " ".join(texts)
points = sorted({ord(c) for c in text if ord(c) >= 32})
out = root / "qa-temp-hero-font"
out.mkdir(exist_ok=True)
url = ("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/"
       "packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2")
request = urllib.request.Request(url, headers={"User-Agent":"LUEN-hero-CI-test/1.0"})
with urllib.request.urlopen(request,timeout=60) as response:
    binary = response.read(4_500_001)
if not (100_000 <= len(binary) <= 4_500_000) or not binary.startswith(b"wOF2"):
    raise RuntimeError("Upstream Pretendard font unavailable")
orig = out / "temp-original.woff2"
orig.write_bytes(binary)
font = TTFont(orig)
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.notdef_glyph = True
options.notdef_outline = True
generator = subset.Subsetter(options=options)
generator.populate(unicodes=points)
generator.subset(font)
target = out / "pretendard-hero-ci-only.woff2"
font.save(target)
font.close()
orig.unlink()
if target.stat().st_size > 150_000:
    raise RuntimeError("Hero subset too large for low-risk mobile test")
range_css = ",".join(f"U+{p:X}" for p in points)
css = (
 "@font-face{font-family:'Pretendard Variable';font-style:normal;"
 "font-weight:45 920;font-display:swap;"
 "src:url('/qa-font/pretendard-hero-ci-only.woff2') format('woff2-variations');"
 f"unicode-range:{range_css};}}"
)
(out / "hero.css").write_text(css,encoding="utf-8")
report = {"glyphs":len(points),"bytes":target.stat().st_size,
 "source_bytes":len(binary),"license":"SIL Open Font License 1.1",
 "isolation":"CI-only, never uploaded or committed"}
(out / "metadata.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),"utf-8")
print("LUEN_HERO_FONT_CI_META "+json.dumps(report,ensure_ascii=False))
