import http.server, threading, socketserver, os, sys, re, hashlib
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
csp = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', open(os.path.join(ROOT, '_headers')).read()).group(1)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
sha = hashlib.sha1(b'password').hexdigest().upper(); pre, suf = sha[:5], sha[5:]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if 'Content Security' in m.text else None)
    seen = []
    mode = {'v': 'found'}
    def handle(route):
        req = route.request; seen.append((req.url, req.headers.get('add-padding'), req.headers.get('referer')))
        if mode['v'] == 'down': return route.abort()
        body = (f'{suf}:9545824\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0\r\n' if mode['v'] == 'found' else '0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n')
        route.fulfill(status=200, content_type='text/plain', headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'}, body=body)
    pg.route('https://api.pwnedpasswords.com/**', handle)
    pg.goto(f'http://127.0.0.1:{port}/tools/password-checker/')
    ok(pg.is_disabled('#breach'), 'breach button disabled with an empty field')
    ok(pg.get_attribute('#pw', 'type') == 'password' and pg.get_attribute('#pw', 'autocomplete') == 'off', 'field masked, autocomplete off')
    pg.fill('#pw', 'password'); ok('Very weak' in pg.inner_text('#rows'), 'common password is very weak')
    ok(len(seen) == 0, 'no network request while typing')
    pg.click('#breach'); pg.wait_for_selector('#rows .pill:text-is("Found")', timeout=5000)
    ok('9,545,824' in pg.inner_text('#rows'), 'found count shown')
    ok(len(seen) == 1 and seen[0][0] == f'https://api.pwnedpasswords.com/range/{pre}', 'only the 5-char prefix was requested: ' + seen[0][0])
    ok(suf not in seen[0][0] and not seen[0][0].endswith('password'), 'neither the password nor the rest of the hash was sent')
    ok(seen[0][1] == 'true', 'padding requested'); ok(not seen[0][2], 'no referrer sent')
    mode['v'] = 'none'; pg.fill('#pw', 'k7#Vq9!rTz2@Lm8%Xw4$'); ok('Very strong' in pg.inner_text('#rows'), 'strong password rated')
    ok('Found' not in pg.inner_text('#rows'), 'old breach result cleared when the password changes')
    pg.click('#breach'); pg.wait_for_selector('#rows .pill:text-is("Not found")', timeout=5000); ok('does not mean it is safe' in pg.inner_text('#rows'), 'not-found caveat shown: ' + pg.inner_text('#rows').replace(chr(10), ' | ')[:300])
    mode['v'] = 'down'; pg.fill('#pw', 'another one 123'); pg.click('#breach'); pg.wait_for_selector('#rows .pill:text-is("Not checked")', timeout=15000)
    ok('Nothing was concluded' in pg.inner_text('#rows'), 'service failure is not reported as safe')
    pg.check('#show'); ok(pg.get_attribute('#pw', 'type') == 'text', 'show toggles')
    g1 = pg.inner_text('#gen-out'); pg.click('#gen-new'); g2 = pg.inner_text('#gen-out')
    ok(len(g1) == 20 and g1 != g2 and not re.search('[0OIl1]', g1), 'generator output length 20, changes, no look-alikes: ' + g1)
    pg.fill('#gen-len', '32') if False else pg.eval_on_selector('#gen-len', "e=>{e.value=32;e.dispatchEvent(new Event('input'))}")
    ok(len(pg.inner_text('#gen-out')) == 32, 'length slider works')
    ov = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth'); ok(ov <= 0, 'no horizontal overflow %s' % ov)
    ok(not errs, 'no page or CSP errors %s' % errs)
    m = b.new_page(viewport={'width': 390, 'height': 800}); m.goto(f'http://127.0.0.1:{port}/tools/password-checker/')
    ok(m.evaluate('document.documentElement.scrollWidth - window.innerWidth') <= 0, 'no overflow at 390px')
    b.close()
print('FAILED' if fails else 'PASSWORD PAGE PASSED'); sys.exit(1 if fails else 0)
