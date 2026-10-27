"""Generate non-destructive compact WebP study assets for LUEN case cards.

Original marketing/creator visuals MUST NOT be overwritten. Output files remain
under perf-case-study/ as CI artifacts only; they are not committed or deployed.
"""
from PIL import Image, ImageOps, ImageDraw
from pathlib import Path
import json, io
files = [
    "herahera-highres-thumbnail.webp",
    "japan-beauty-creator-marketing-case-01.webp",
    "korea-clinic-marketing-case-02.webp",
    "korea-food-marketing-case-04.webp",
]
root = Path("assets/images/cases")
out = Path("perf-case-study")
out.mkdir(exist_ok=True)
summary=[]
for name in files:
    src=root/name
    original_size=src.stat().st_size
    with Image.open(src) as image:
        image=image.convert("RGB")
        original_dimensions=list(image.size)
        # On phones these images render in ~300px supporting cards / ~350px hero.
        # Keep at least 600+ physical px for reasonable mobile image sharpness.
        small=image.copy()
        small.thumbnail((640,640),Image.Resampling.LANCZOS)
        dest=out/name.replace(".webp","-mobile-test.webp")
        small.save(dest,"WEBP",quality=80,method=6)
        new_size=dest.stat().st_size
        # Side-by-side quality review only, not used on website.
        height=270
        display_w=480
        left=ImageOps.contain(image,(display_w,height))
        right=ImageOps.contain(small,(display_w,height))
        canvas=Image.new("RGB",(display_w*2+30,height+44),(245,243,238))
        canvas.paste(left,((display_w-left.width)//2,33))
        canvas.paste(right,(display_w+30+(display_w-right.width)//2,33))
        draw=ImageDraw.Draw(canvas)
        draw.text((12,10),"ORIGINAL",fill=(35,30,27))
        draw.text((display_w+42,10),"MOBILE TEST / QUALITY 80",fill=(35,30,27))
        canvas.save(out/(src.stem+"-comparison.jpg"),quality=86)
    summary.append(dict(filename=name,old_bytes=original_size,new_bytes=new_size,
       saved_bytes=original_size-new_size,reduction_pct=round(100*(original_size-new_size)/original_size,1),
       old_dimensions=original_dimensions,new_dimensions=list(small.size)))
report=dict(assets=summary,old_total=sum(x["old_bytes"] for x in summary),
  new_total=sum(x["new_bytes"] for x in summary))
report["total_savings_pct"]=round(100*(1-report["new_total"]/report["old_total"]),1)
(out/"manifest.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
print("LUEN_CASE_IMAGE_VARIANT_PILOT "+json.dumps(report))
