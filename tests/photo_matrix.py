# Photo remover matrix: formats, orientation, no-EXIF input, big image, unsupported type. Real Chromium, real CSP.
import http.server, threading, socketserver, os, sys, io, re
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
csp = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', open(os.path.join(ROOT, '_headers')).read()).group(1)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

def exif(orient=None, gps=True):
    e = Image.Exif(); e[0x010F] = 'TestCam'; e[0x0110] = 'Model X'; e[0x0132] = '2026:10:20 10:00:00'
    if orient: e[0x0112] = orient
    if gps: e[0x8825] = {1: 'N', 2: (31.0, 14.0, 0.0), 3: 'E', 4: (121.0, 28.0, 30.0)}
    return e
def jpeg(size, **kw):
    b = io.BytesIO(); im = Image.new('RGB', size, (10, 120, 200))
    for x in range(size[0] // 2): im.putpixel((x, 0), (255, 0, 0))
    im.save(b, 'JPEG', exif=kw.get('exif') if 'exif' in kw else exif()); return b.getvalue()
def fmt(f, size=(40, 20)):
    b = io.BytesIO(); Image.new('RGBA', size, (1, 2, 3, 255)).save(b, f, **({'exif': exif()} if f == 'WEBP' else {})); return b.getvalue()

fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(accept_downloads=True)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if 'Content Security' in m.text else None)
    pg.goto(f'http://127.0.0.1:{port}/tools/photo-metadata-remover/')
    def run(name, mime, data):
        pg.set_input_files('#file', files=[{'name': name, 'mimeType': mime, 'buffer': data}])
        pg.wait_for_timeout(400)
        return pg.inner_text('#summary')
    def clean(name, mime, data):
        run(name, mime, data)
        with pg.expect_download(timeout=60000) as d: pg.click('#clean')
        path = '/tmp/claude-0/m_' + name; d.value.save_as(path); return open(path, 'rb').read()

    out = clean('gps.jpg', 'image/jpeg', jpeg((40, 20)))
    ok(b'Exif' not in out and b'TestCam' not in out, 'JPEG with GPS: no EXIF left')
    ok(Image.open(io.BytesIO(out)).size == (40, 20), 'JPEG size kept')

    out = clean('rot.jpg', 'image/jpeg', jpeg((40, 20), exif=exif(orient=6)))
    im = Image.open(io.BytesIO(out)); ok(im.size == (20, 40), 'orientation 6 baked in: output %s (expected 20x40)' % (im.size,))
    ok(b'Exif' not in out, 'rotated JPEG: no EXIF left')

    s = run('plain.jpg', 'image/jpeg', jpeg((40, 20), exif=Image.Exif()))
    ok('No readable metadata' in s, 'no-EXIF JPEG reported: ' + s)
    out = clean('plain.jpg', 'image/jpeg', jpeg((40, 20), exif=Image.Exif())); ok(Image.open(io.BytesIO(out)).size == (40, 20), 'no-EXIF JPEG cleans fine')

    out = clean('a.png', 'image/png', fmt('PNG')); ok(out[:4] == b'\x89PNG' and Image.open(io.BytesIO(out)).size == (40, 20), 'PNG ok')
    out = clean('a.webp', 'image/webp', fmt('WEBP')); ok(out[:4] == b'RIFF' and b'EXIF' not in out, 'WebP ok, no EXIF chunk')

    s = run('a.heic', 'image/heic', b'\x00\x00\x00\x18ftypheic'); ok('Only JPEG' in s, 'HEIC refused: ' + s)
    s = run('a.gif', 'image/gif', b'GIF89a'); ok('Only JPEG' in s, 'GIF refused')
    s = run('fake.jpg', 'image/jpeg', b'not really a jpeg at all')
    pg.click('#clean'); pg.wait_for_timeout(800)
    ok('could not decode' in pg.inner_text('#summary'), 'corrupt file gets an error, not fake success: ' + pg.inner_text('#summary'))

    import time; t = time.time()
    big = io.BytesIO(); Image.effect_noise((7000, 5000), 40).convert('RGB').save(big, 'JPEG', quality=85, exif=exif())
    ok(len(big.getvalue()) < 40 * 1024 * 1024, 'big test file %d MB' % (len(big.getvalue()) // 1048576))
    out = clean('big.jpg', 'image/jpeg', big.getvalue())
    ok(Image.open(io.BytesIO(out)).size == (7000, 5000) and b'TestCam' not in out, 'large 35MP JPEG cleaned in %.1fs' % (time.time() - t))
    ok(not errs, 'no page/CSP errors %s' % errs)
    b.close()
print('FAILED' if fails else 'MATRIX PASSED'); sys.exit(1 if fails else 0)
