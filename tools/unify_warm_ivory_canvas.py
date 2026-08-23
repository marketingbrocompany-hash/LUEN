from pathlib import Path

css_path = Path('assets/css/site-overrides.css')
html_path = Path('index.html')
css = css_path.read_text()
html = html_path.read_text()

marker = '/* FINAL WARM IVORY CANVAS · 2026-08-23 */'
block = '''\n\n/* FINAL WARM IVORY CANVAS · 2026-08-23\n   Section bands use one continuous Warm Ivory canvas.\n   Inner cards/media/forms keep their own surface colors. */\nmain>section,\n.outcome-strip,\n.capability-strip,\n.brand-wall,\n.marquee{\n  background:#F5F3EE!important;\n  background-image:none!important;\n}\n'''

if marker not in css:
    css = css.rstrip() + block

html = html.replace('assets/css/site-overrides.css?v=20260823-6', 'assets/css/site-overrides.css?v=20260823-7')

css_path.write_text(css)
html_path.write_text(html)
