# M3: the scam warning card prints as exactly one page (Letter and A4), the printout contains the card's
# key lines and none of the page chrome, the page makes no external requests, and the link checker links to it.
import os, re, sys, threading, http.server, socketserver
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
PATH = '/blog/scam-warning-card-for-parents/'

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'

fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

html = open(os.path.join(ROOT, PATH.strip('/'), 'index.html'), encoding='utf-8').read()
card = re.search(r'<div class="print-card"[\s\S]*?</div>', html)
check(card is not None, 'card present')
c = card.group(0) if card else ''
for s in ['ReportFraud.ftc.gov', '833-372-8311', '7726', 'Gift cards are for gifts, not payments', 'Call first:']:
    check(s in c, f'card contains {s!r}')
check('<h2' not in c, 'card has no h2 (keeps it out of the table of contents)')
check(' style=' not in html and '<style' not in html, 'no inline styles')
lc = open(os.path.join(ROOT, 'tools', 'link-checker', 'index.html'), encoding='utf-8').read()
check(f'href="{PATH}"' in lc, 'English link checker links to the card')
zlc = open(os.path.join(ROOT, 'zh', 'tools', 'link-checker', 'index.html'), encoding='utf-8').read()
check(PATH not in zlc, 'Chinese link checker unchanged (English card only)')

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    external = []
    pg.on('request', lambda r: external.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') else None)
    pg.goto(BASE + PATH); pg.wait_for_load_state('networkidle')
    check(external == [], f'no external requests {external}')
    for fmt in ['Letter', 'A4']:
        pdf = pg.pdf(format=fmt)
        n = len(re.findall(rb'/Type\s*/Page[^s]', pdf))
        check(n == 1, f'{fmt}: prints on one page (got {n})')
    pg.emulate_media(media='print')
    vis = pg.evaluate("""() => [...document.querySelectorAll('header, footer, nav, h1, .article-toc, .related-content')]
        .filter(e => !e.closest('.print-card') && e.getClientRects().length > 0).map(e => e.tagName + '.' + e.className)""")
    check(vis == [], f'page chrome hidden in print {vis}')
    check(pg.locator('.print-card').is_visible(), 'card visible in print')
    pg.emulate_media(media='screen')
    check(pg.locator('h1').first.is_visible(), 'page normal on screen')
    b.close()

srv.shutdown()
print(f'\n{len(fails)} failures' if fails else '\nall passed')
sys.exit(1 if fails else 0)
