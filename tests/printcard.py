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

CARDS = [
    ('/blog/scam-warning-card-for-parents/', ['ReportFraud.ftc.gov', '833-372-8311', '7726', 'Gift cards are for gifts, not payments', 'Call first:'], '.article-toc'),
    ('/zh/scam-warning-card/', ['未知链接不点击', '陌生来电不轻信', '个人信息不透露', '转账汇款多核实', '安全账户', '110', '96110', '12381', '先打给：'], '.info-nav'),
]
for path, must, _ in CARDS:
    html = open(os.path.join(ROOT, path.strip('/'), 'index.html'), encoding='utf-8').read()
    card = re.search(r'<div class="print-card"[\s\S]*?</div>', html)
    check(card is not None, f'{path} card present')
    c = card.group(0) if card else ''
    for s in must:
        check(s in c, f'{path} card contains {s!r}')
    check('<h2' not in c, f'{path} card has no h2 (keeps it out of the table of contents)')
    check(' style=' not in html and '<style' not in html, f'{path} no inline styles')
zh = open(os.path.join(ROOT, 'zh', 'scam-warning-card', 'index.html'), encoding='utf-8').read()
zh_text = re.sub(r'<[^>]+>', ' ', zh.split('<main', 1)[1].split('</main>', 1)[0])
for bad in ['VPN', 'IP 泄露', 'IP泄露', '翻墙', '代理']:
    check(bad not in zh_text, f'Chinese card page does not mention {bad!r}')
check('lang="zh-CN"' in zh, 'Chinese card page is lang zh-CN')
lc = open(os.path.join(ROOT, 'tools', 'link-checker', 'index.html'), encoding='utf-8').read()
check('href="/blog/scam-warning-card-for-parents/"' in lc, 'English link checker links to the English card')
zlc = open(os.path.join(ROOT, 'zh', 'tools', 'link-checker', 'index.html'), encoding='utf-8').read()
check('href="/zh/scam-warning-card/"' in zlc, 'Chinese link checker links to the Chinese card')
check('/blog/scam-warning-card-for-parents/' not in zlc, 'Chinese link checker does not link the US card')
en = open(os.path.join(ROOT, 'blog', 'scam-warning-card-for-parents', 'index.html'), encoding='utf-8').read()
check('href="/zh/scam-warning-card/"' in en and 'href="/blog/scam-warning-card-for-parents/"' in zh, 'English and Chinese cards link each other')
sm = open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read()
check('https://secureinchat.com/zh/scam-warning-card/' in sm, 'Chinese card in sitemap')
hd = open(os.path.join(ROOT, '_headers'), encoding='utf-8').read()
check('\n/zh/scam-warning-card/\n  Content-Security-Policy:' in hd, 'Chinese card has a CSP in _headers')

with sync_playwright() as p:
    b = p.chromium.launch()
    for path, _, toc in CARDS:
        pg = b.new_page()
        external = []
        pg.on('request', lambda r: external.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') else None)
        pg.goto(BASE + path); pg.wait_for_load_state('networkidle')
        check(external == [], f'{path} no external requests {external}')
        for fmt in ['Letter', 'A4']:
            pdf = pg.pdf(format=fmt)
            n = len(re.findall(rb'/Type\s*/Page[^s]', pdf))
            check(n == 1, f'{path} {fmt}: prints on one page (got {n})')
        pg.emulate_media(media='print')
        vis = pg.evaluate("""(toc) => [...document.querySelectorAll('header, footer, nav, h1, .related-content, ' + toc)]
            .filter(e => !e.closest('.print-card') && e.getClientRects().length > 0).map(e => e.tagName + '.' + e.className)""", toc)
        check(vis == [], f'{path} page chrome hidden in print {vis}')
        check(pg.locator('.print-card').is_visible(), f'{path} card visible in print')
        pg.emulate_media(media='screen')
        check(pg.locator('h1').first.is_visible(), f'{path} page normal on screen')
        pg.close()
    b.close()

srv.shutdown()
print(f'\n{len(fails)} failures' if fails else '\nall passed')
sys.exit(1 if fails else 0)
