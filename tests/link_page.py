import sys, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'
fails = []
def check(c, m): print(('ok   ' if c else 'FAIL ') + m); (None if c else fails.append(m))
with sync_playwright() as p:
    b = p.chromium.launch()
    for vp in [{'width': 1280, 'height': 800}, {'width': 390, 'height': 844}]:
        pg = b.new_page(viewport=vp); reqs = []
        pg.on('request', lambda r: reqs.append(r.url))
        pg.goto(BASE + '/tools/link-checker/'); n0 = len(reqs)
        pg.fill('#lk-in', 'https://paypal.com@secure-paypal.example.net/login?utm_source=sms&fbclid=x&id=7')
        pg.wait_for_timeout(200)
        check(pg.input_value('#lk-out') == 'https://secure-paypal.example.net/login?id=7', f'clean link {pg.input_value("#lk-out")}')
        rows = pg.inner_text('#rows')
        check('Text before an @' in rows and 'Brand name on a different site' in rows and 'Tracking parameters' in rows, 'findings shown')
        check('warning sign' in pg.inner_text('#summary'), 'summary: ' + pg.inner_text('#summary'))
        check(pg.inner_text('#lk-site').startswith('secure-paypal.example.net'), 'site shown')
        check(len(reqs) == n0, f'no network requests while checking ({len(reqs) - n0})')
        pg.fill('#lk-in', 'https://www.wikipedia.org/'); pg.wait_for_timeout(100)
        check('No warning signs' in pg.inner_text('#summary'), 'clean link summary')
        check(pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, f'no overflow {vp["width"]}')
        pg.close()
    b.close()
print('\nFAILED:' if fails else '\nLINK PAGE PASSED', *fails, sep='\n'); sys.exit(1 if fails else 0)
