import http.server, threading, socketserver, os, re, io, tempfile
import piexif
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
csp = re.search(r'/workspace/\*?\n\s*Content-Security-Policy: (.*)', open(os.path.join(ROOT, '_headers')).read()).group(1)
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

# A JPEG with EXIF including GPS and a camera model.
exif = piexif.dump({'0th': {piexif.ImageIFD.Model: b'SecretCam'},
                    'GPS': {piexif.GPSIFD.GPSLatitudeRef: b'N', piexif.GPSIFD.GPSLatitude: ((31, 1), (14, 1), (0, 1))}})
buf = io.BytesIO(); Image.new('RGB', (64, 48), (200, 30, 30)).save(buf, 'JPEG', exif=exif)
src = os.path.join(tempfile.mkdtemp(), 'holiday-photo.jpg'); open(src, 'wb').write(buf.getvalue())
ok(b'Exif\x00\x00' in buf.getvalue() and b'SecretCam' in buf.getvalue(), 'fixture JPEG carries EXIF and GPS')

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(accept_downloads=True)
    outside, errors = [], []
    pg.on('request', lambda r: outside.append(r.url) if not r.url.startswith(f'http://127.0.0.1:{port}') else None)
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(f'http://127.0.0.1:{port}/workspace/')
    pg.click('#tab-image')
    ok(pg.is_visible('#panel-image'), 'image panel opens from its tab')
    pg.set_input_files('#image-file', src)
    pg.wait_for_selector('#download-image', timeout=15000)
    with pg.expect_download() as d:
        pg.click('#download-image')
    dl = d.value
    out = open(dl.path(), 'rb').read()
    ok(out[:3] == b'\xff\xd8\xff', 'download is a JPEG')
    ok(b'Exif\x00\x00' not in out, 'download has no EXIF APP1 segment')
    ok(b'SecretCam' not in out, 'camera model string is gone')
    ok('holiday' not in dl.suggested_filename, f'download name does not reuse the original ({dl.suggested_filename})')
    img = Image.open(io.BytesIO(out)); ok(img.size == (64, 48), 'pixel size kept')
    pg.set_input_files('#image-file', {'name': 'x.jpg', 'mimeType': 'image/jpeg', 'buffer': b'GIF89a not a jpeg'})
    pg.wait_for_timeout(500)
    ok('jpeg' in pg.inner_text('#image-result').lower() or 'not' in pg.inner_text('#image-result').lower(), 'mismatched file is refused with a message')
    ok(not outside, f'no request left the local server {outside}')
    ok(not errors, f'no console errors {errors}')
    b.close()
srv.shutdown()
raise SystemExit(1 if fails else 0)
