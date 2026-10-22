# Functional test for the phone number privacy checkup (real Chromium, real CSP from _headers, en + zh).
import os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
HDR = {}
cur = None
for line in open(os.path.join(ROOT, '_headers')).read().splitlines():
    if not line.strip() or line.startswith('#'): continue
    if not line.startswith(' '): cur = line.strip(); continue
    if 'Content-Security-Policy' in line: HDR[cur] = line.split(':', 1)[1].strip()

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        p = self.path.split('?')[0]
        csp = HDR.get(p) or (HDR.get('/tools/*') if p.startswith('/tools/') else None)
        if csp: self.send_header('Content-Security-Policy', csp)
        super().end_headers()
    def log_message(self, *a): pass

srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(H, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch()
    for path, done6, count1 in [('/tools/phone-checkup/', 'All six checks reviewed', '1 of 6 completed'), ('/zh/tools/phone-checkup/', '你已检查全部六项', '已完成 1 / 6 项')]:
        for w in (1280, 390):
            pg = b.new_page(viewport={'width': w, 'height': 900})
            reqs, errs = [], []
            pg.on('request', lambda r: reqs.append(r.url))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(BASE + path)
            tag = f'{path} [{w}]'
            ok(pg.locator('input[type="tel"], input[type="text"], input[type="number"]').count() == 0, f'{tag} no field to type a number into')
            boxes = pg.locator('.phone-check-item input[type="checkbox"]')
            ok(boxes.count() == 6, f'{tag} six checklist items')
            labels = pg.locator('.phone-check-label')
            labels.nth(0).click()  # what a person clicks: the label with the custom box
            ok(boxes.nth(0).is_checked(), f'{tag} clicking the label ticks the item')
            ok(count1 in pg.inner_text('[data-completed-count]'), f'{tag} count updates: {pg.inner_text("[data-completed-count]")}')
            ok(pg.evaluate("document.querySelector('[data-progress]').value") == 1, f'{tag} progress bar updates')
            for i in range(1, 6): labels.nth(i).click()
            ok(done6 in pg.inner_text('#next-step-title'), f'{tag} completion message')
            pg.click('[data-reset-checklist]')
            ok(pg.evaluate("[...document.querySelectorAll('.phone-check-item input')].every(x => !x.checked)"), f'{tag} clear resets all')
            labels.nth(2).click(); pg.reload()
            ok(not boxes.nth(2).is_checked(), f'{tag} reload clears state')
            ok(pg.evaluate('localStorage.length + sessionStorage.length') == 0 and pg.evaluate('document.cookie') == '', f'{tag} nothing stored')
            ok(not [u for u in reqs if not u.startswith(BASE)], f'{tag} no external requests')
            ok(pg.locator('.phone-source-slot a').count() >= 6 and 'To be added' not in pg.content() and '待团队' not in pg.content(), f'{tag} every item has a verified source link')
            ok(pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, f'{tag} no horizontal overflow')
            ok(not errs, f'{tag} no console or CSP errors {errs[:2]}')
            pg.close()
    b.close()
srv.shutdown()
print('PHONE FAILED' if fails else 'PHONE PASSED')
sys.exit(1 if fails else 0)
