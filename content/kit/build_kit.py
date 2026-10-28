# Builds the Phone & Account Takeover Kit PDF from content/kit/kit-en.md.
# Usage: python3 content/kit/build_kit.py [out.pdf]
# Self-hosted fonts only; the page loads nothing from the network (checked below).
import os, sys, re, pathlib
import markdown
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FONTS = ROOT / 'public' / 'assets' / 'fonts'
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist' / 'kit' / 'phone-account-takeover-kit.pdf'
VERSION = '0.2 (draft)'

md = (HERE / 'kit-en.md').read_text(encoding='utf-8')
title = re.sub(r'[*#]', '', md.splitlines()[0]).strip()
body = markdown.markdown(md, extensions=['tables', 'sane_lists'])
# Long URLs: let them wrap instead of overflowing the page.
body = re.sub(r'(https://[^\s<]+)', lambda m: m.group(1).replace('/', '/<wbr>'), body)

css = f"""
@font-face {{ font-family: 'Atkinson'; src: url('{(FONTS / 'atkinson-next-400.woff2').as_uri()}'); font-weight: 400; }}
@font-face {{ font-family: 'Atkinson'; src: url('{(FONTS / 'atkinson-next-800.woff2').as_uri()}'); font-weight: 800; }}
@font-face {{ font-family: 'Noto Serif'; src: url('{(FONTS / 'noto-serif-subset.woff2').as_uri()}'); font-weight: 400 900; }}
@page {{ size: A4; margin: 18mm 16mm 20mm; }}
body {{ font: 10.5pt/1.55 'Atkinson', sans-serif; color: #20312B; }}
h1, h2, h3 {{ font-family: 'Noto Serif', Georgia, serif; color: #173D32; line-height: 1.25; }}
h2 {{ font-size: 17pt; margin: 0 0 8pt; break-before: page; }}
h3 {{ font-size: 12.5pt; margin: 14pt 0 4pt; break-after: avoid; }}
p, li {{ orphans: 3; widows: 3; }}
a {{ color: #173D32; overflow-wrap: anywhere; }}
code {{ font-family: ui-monospace, monospace; font-size: 9.5pt; }}
table {{ width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 9.5pt; break-inside: avoid; }}
th, td {{ border: 1px solid #D2D8D0; padding: 5pt 6pt; text-align: left; vertical-align: top; overflow-wrap: anywhere; }}
th {{ background: #E7E9E2; }}
hr {{ display: none; }}
.cover {{ height: 240mm; display: flex; flex-direction: column; justify-content: center; }}
.cover h1 {{ font-size: 30pt; margin: 0 0 12pt; }}
.cover p {{ font-size: 11pt; max-width: 120mm; }}
"""
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{title}</title><style>{css}</style></head><body>
<section class="cover"><h1>{title}</h1>
<p>A printable workbook for making phone-number and account takeover harder.</p>
<p>Version {VERSION}. Every step links the official page it is based on. Menus change; when your phone differs, trust the official page.</p>
<p>This workbook does not guarantee that any account is safe from takeover. Do not write passwords, PINs or recovery codes in it.</p>
<p>SecureInChat · secureinchat.com</p></section>
{body.split('</p>', 1)[1] if body.startswith('<p><strong>') else body}
</body></html>"""

OUT.parent.mkdir(parents=True, exist_ok=True)
tmp = OUT.with_suffix('.html'); tmp.write_text(html, encoding='utf-8')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); outside = []
    pg.on('request', lambda r: outside.append(r.url) if not r.url.startswith(('file:', 'data:')) else None)
    pg.goto(tmp.as_uri()); pg.wait_for_load_state('networkidle')
    assert pg.evaluate("document.fonts.check('400 12px Atkinson') && document.fonts.check('700 12px \"Noto Serif\"')"), 'fonts not loaded'
    pg.pdf(path=str(OUT), format='A4', print_background=True, display_header_footer=True, header_template='<span></span>',
           footer_template='<div style="font-size:8px;width:100%;text-align:center;color:#596760"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
           margin={'top': '18mm', 'bottom': '20mm', 'left': '16mm', 'right': '16mm'})
    b.close()
tmp.unlink()
assert not outside, f'network requests while building: {outside}'
print(f'{OUT} {OUT.stat().st_size // 1024} KB')
