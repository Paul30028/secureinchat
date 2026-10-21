# Functional test for the account checkup (real Chromium, local server with the real /tools/* CSP).
import os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
CSP, cur = None, None
for line in open(os.path.join(ROOT, '_headers')).read().splitlines():
    if not line.strip() or line.startswith('#'): continue
    if not line.startswith(' '): cur = line.strip(); continue
    if cur == '/tools/*' and 'Content-Security-Policy' in line: CSP = line.split(':', 1)[1].strip()
assert CSP

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        super().end_headers()
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(H, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'
URL = BASE + '/tools/account-checkup/'
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch()
    for w, label in [(1280, 'desktop'), (390, 'mobile')]:
        ctx = b.new_context(viewport={'width': w, 'height': 900})
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE)
        pg = ctx.new_page()
        errs, reqs = [], []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('request', lambda r: reqs.append(r.url))
        pg.add_init_script("document.addEventListener('securitypolicyviolation',e=>{(window.__v=window.__v||[]).push(e.violatedDirective)})")
        pg.goto(URL)
        pg.wait_for_load_state('load')
        ok(pg.locator('fieldset.ac-item').count() == 8, f'{label}: 8 checks')
        ok(pg.locator('.ac-src a').count() >= 8, f'{label}: every check has sources')
        ok(pg.is_hidden('#ac-next') and pg.is_hidden('#ac-copy'), f'{label}: nothing to do before answering')
        pg.check('#ac-mfa input[value="no"]')
        pg.check('#ac-unique input[value="yes"]')
        pg.check('#ac-recovery input[value="unsure"]')
        summ = pg.inner_text('#summary')
        ok(summ == '1 of 8 done, 1 to do, 1 to find out, 5 not answered.', f'{label}: summary "{summ}"')
        nxt = pg.eval_on_selector_all('#ac-next-list li', 'ls => ls.map(l => l.textContent)')
        ok(nxt == ['Turn on two-step verification', 'Update the recovery email and phone (find out)'], f'{label}: next list {nxt}')
        ok(pg.get_attribute('#ac-mfa', 'data-state') == 'no', f'{label}: item state shown')
        pg.click('#ac-copy')
        pg.wait_for_timeout(200)
        clip = pg.evaluate('navigator.clipboard.readText()')
        ok('1. Turn on two-step verification' in clip and 'Nothing was saved' in clip, f'{label}: copied text')
        sw = pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= w, f'{label}: no horizontal overflow ({sw})')
        pg.reload(); pg.wait_for_load_state('load'); pg.wait_for_timeout(200)
        ok(pg.locator('input:checked').count() == 0 and pg.get_attribute('#summary', 'data-tone') == 'idle', f'{label}: reload clears answers')
        pg.check('#ac-apps input[value="yes"]'); pg.click('#ac-reset')
        ok(pg.locator('input:checked').count() == 0, f'{label}: clear button')
        ok(pg.evaluate('document.cookie') == '' and pg.evaluate('localStorage.length + sessionStorage.length') == 0, f'{label}: nothing stored')
        ext = [u for u in reqs if not u.startswith(BASE)]
        ok(not ext, f'{label}: no external requests {ext[:3]}')
        ok(not pg.evaluate('window.__v||[]') and not errs, f'{label}: no CSP or page errors {errs}')
        ctx.close()
    b.close()
srv.shutdown()
print('ACCOUNT PAGE FAILED' if fails else 'ACCOUNT PAGE PASSED')
sys.exit(1 if fails else 0)
