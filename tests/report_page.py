# Functional test for the browser privacy report (real Chromium, local server with the real CSP, external services mocked).
import json, os, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
CSP = None
cur = None
for line in open(os.path.join(ROOT, '_headers')).read().splitlines():
    if not line.strip() or line.startswith('#'): continue
    if not line.startswith(' '): cur = line.strip(); continue
    if cur == '/tools/*' and 'Content-Security-Policy' in line: CSP = line.split(':', 1)[1].strip()
assert CSP and 'ipify' in CSP
WHO = {"ip":"185.65.134.10","asn":9009,"asOrganization":"M247 Europe SRL","city":"Bucharest","region":"Bucharest","country":"RO",
       "timezone":"Europe/Bucharest","colo":"OTP","httpProtocol":"HTTP/2","tlsVersion":"TLSv1.3",
       "headers":{"accept-language":"en-US,en;q=0.9","sec-ch-ua-platform":"\"Windows\""}}

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        if CSP: self.send_header('Content-Security-Policy', CSP)
        super().end_headers()
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(H, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/tools/privacy-report/'
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

J = {'access-control-allow-origin': '*'}
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, label in [(1280, 'desktop'), (390, 'mobile')]:
        pg = b.new_page(viewport={'width': w, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if 'Content Security Policy' in m.text else None)
        pg.route('**/tools/api/whoami', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(WHO)))
        pg.route('https://api4.ipify.org/**', lambda r: r.fulfill(status=200, content_type='application/json', headers=J, body='{"ip":"185.65.134.10"}'))
        pg.route('https://api6.ipify.org/**', lambda r: r.fulfill(status=200, content_type='application/json', headers=J, body='{"ip":"2001:db8::1"}'))
        pg.route('https://ipwho.is/**', lambda r: r.fulfill(status=200, content_type='application/json', headers=J, body='{"success":true,"connection":{"asn":7922,"org":"Comcast Cable Communications, LLC"},"country_code":"US"}'))
        pg.route('https://*.lk.secureinchat.com/**', lambda r: r.abort())
        pg.route('https://dnsapi.secureinchat.com/**', lambda r: r.fulfill(status=200, content_type='application/json', headers=J, body='{"resolvers":[]}'))
        pg.goto(URL)
        pg.click('#run')
        pg.wait_for_selector('#run:has-text("Run again")', timeout=30000)
        summ = pg.inner_text('#summary')
        net = pg.eval_on_selector_all('#net-rows tr', 'rs => rs.map(r => [r.dataset.check, r.dataset.status])')
        br = pg.eval_on_selector_all('#browser-rows tr', 'rs => rs.map(r => [r.dataset.check, r.dataset.status])')
        ok(len(net) == 6 and len(br) == 6, f'{label}: 6 + 6 rows {net} {br}')
        ok(dict(net).get('ipv6') == 'fail', f'{label}: IPv6 on another network is a leak')
        fix = pg.eval_on_selector_all('#fix-list li', 'ls => ls.map(l => l.textContent)')
        ok(not pg.is_hidden('#fix') and fix and fix[0].startswith('IPv6'), f'{label}: fix list starts with the leak: {fix[:2]}')
        ok(all(a.startswith('/') for a in pg.eval_on_selector_all('#fix-list a', 'as => as.map(a => a.getAttribute("href"))')), f'{label}: fix links are internal')
        ok('leak found' in summ, f'{label}: summary "{summ}"')
        pg.uncheck('#vpn')
        net2 = dict(pg.eval_on_selector_all('#net-rows tr', 'rs => rs.map(r => [r.dataset.check, r.dataset.status])'))
        ok(net2.get('ipv6') != 'fail', f'{label}: unticking VPN re-judges without rerun ({net2.get("ipv6")})')
        txt = pg.evaluate("window.PRIVACY_REPORT.text(window.PRIVACY_REPORT.build([], [{id:'gpc',name:'Global Privacy Control',status:'warn',label:'Not sent',lines:['x'],why:''}]), false, '2026-10-21')")
        ok('Look at first:\n1. Global Privacy Control (Not sent)' in txt and 'Nothing was saved' in txt, f'{label}: copy text format')
        sw = pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= w, f'{label}: no horizontal overflow ({sw})')
        ok(not errs, f'{label}: no page or CSP errors {errs}')
        ok(pg.evaluate('document.cookie') == '' and pg.evaluate('localStorage.length') == 0, f'{label}: nothing stored')
        pg.close()
    b.close()
srv.shutdown()
print('REPORT FAILED' if fails else 'REPORT PASSED')
sys.exit(1 if fails else 0)
