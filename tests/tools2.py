# Functional test for the photo metadata remover and the fingerprint test (real Chromium, local server with the real CSP).
import http.server, threading, socketserver, os, sys, io, re, subprocess
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
csp = None
for blk in open(os.path.join(ROOT, '_headers')).read().split('\n/'):
    if blk.startswith('tools/*') or blk.startswith('/tools/*'):
        m = re.search(r'Content-Security-Policy: (.*)', blk); csp = m.group(1)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s):
        s.send_header('Content-Security-Policy', csp); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

img = Image.new('RGB', (64, 48), (200, 30, 30))
ex = Image.Exif(); ex[0x010F] = 'TestCam'; ex[0x0110] = 'Model X'
ex[0x8825] = {1: 'N', 2: (31.0, 14.0, 0.0), 3: 'E', 4: (121.0, 28.0, 30.0)}
buf = io.BytesIO(); img.save(buf, 'JPEG', exif=ex); jpg = '/tmp/claude-0/t_exif.jpg'
open(jpg, 'wb').write(buf.getvalue())

fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(accept_downloads=True)
    viol = []
    pg.on('console', lambda m: viol.append(m.text) if 'Content Security Policy' in m.text else None)
    pg.on('pageerror', lambda e: viol.append(str(e)))
    pg.goto(f'http://127.0.0.1:{port}/tools/photo-metadata-remover/')
    pg.set_input_files('#file', jpg); pg.wait_for_selector('#clean:not([hidden])')
    txt = pg.inner_text('#rows')
    ok('31.23333, 121.47500' in txt, 'GPS shown: ' + txt.replace('\n', ' ')[:120])
    ok('TestCam' in txt, 'device shown')
    with pg.expect_download() as d: pg.click('#clean')
    out = '/tmp/claude-0/t_clean.jpg'; d.value.save_as(out)
    data = open(out, 'rb').read()
    ok(b'Exif' not in data and b'TestCam' not in data, 'downloaded file has no EXIF')
    ok(Image.open(out).size == (64, 48), 'size preserved')
    pg.wait_for_function("document.getElementById('summary').textContent.indexOf('Done')===0")
    ok(True, 'summary: ' + pg.inner_text('#summary'))
    ok(not viol, 'no CSP/page errors on photo page %s' % viol)
    pg.set_input_files('#file', '/home/claude/secureinchat/public/favicon.svg')
    pg.wait_for_timeout(300)
    ok('Only JPEG' in pg.inner_text('#summary'), 'svg handled: ' + pg.inner_text('#summary'))

    pg2 = b.new_page(); v2 = []
    pg2.on('console', lambda m: v2.append(m.text) if 'Content Security Policy' in m.text else None)
    pg2.on('pageerror', lambda e: v2.append(str(e)))
    pg2.goto(f'http://127.0.0.1:{port}/tools/browser-fingerprint-test/')
    pg2.click('#run'); pg2.wait_for_selector('#rows tr .pill:not(:text("Not run"))')
    pg2.wait_for_timeout(500)
    t2 = pg2.inner_text('#rows')
    ok('Canvas' in t2 and 'Browser and device' in t2 and 'Global Privacy Control' in t2, 'fingerprint rows: ' + pg2.inner_text('#summary'))
    ok(not v2, 'no CSP/page errors on fingerprint page %s' % v2)
    b.close()
print('FAILED' if fails else 'TOOLS2 PASSED'); sys.exit(1 if fails else 0)
