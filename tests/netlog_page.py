# W4: the "Network requests from this page" panel on the redactor and file-cleaner pages.
# Served with the real tools CSP; checks the count matches Resource Timing, the marker row,
# that the WASM engine shows up after picking a file, no CSP errors, and the fallback.
import http.server, threading, socketserver, os, re, tempfile
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
base = f'http://127.0.0.1:{port}'
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

COUNT_MATCH = """() => { const n = performance.getEntriesByType('resource').length;
  const shown = Number(document.querySelector('#netlog .netlog-count').textContent);
  const rows = document.querySelectorAll('#netlog .netlog-row').length; return [n, shown, rows]; }"""

tmp = tempfile.mkdtemp(prefix='netlog-')
jpg = os.path.join(tmp, 'a.jpg'); Image.new('RGB', (32, 32), (10, 120, 40)).save(jpg, 'JPEG')
with sync_playwright() as p:
    b = p.chromium.launch()
    for path, act in [('/tools/text-redactor/', 'redact'), ('/tools/file-metadata-remover/', 'file')]:
        pg = b.new_page(); errs = []
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(base + path); pg.wait_for_load_state('networkidle')
        n, shown, rows = pg.evaluate(COUNT_MATCH)
        ok(n == shown == rows and n > 0, f'{path}: panel count {shown}, rows {rows}, Resource Timing {n}')
        ok(pg.locator('#netlog details').get_attribute('open') is None, f'{path}: panel starts collapsed')
        pg.click('#netlog summary')
        if act == 'redact':
            pg.fill('textarea', 'Call Alice Smith at alice@example.com')
            pg.wait_for_timeout(500)
            ok(pg.locator('#netlog .netlog-marker').count() == 1, f'{path}: one marker row after typing')
            ok('You ran the redactor' in pg.locator('#netlog .netlog-marker').inner_text(), f'{path}: marker label')
            ok(pg.locator('#netlog .netlog-after').count() == 0, f'{path}: no requests after running the redactor')
        else:
            pg.set_input_files('input[type=file]', jpg)
            pg.wait_for_function("() => [...document.querySelectorAll('#netlog .netlog-after code')].some(c => c.textContent.indexOf('.wasm') !== -1)", timeout=15000)
            after = pg.locator('#netlog .netlog-after code').all_inner_texts()
            ok(any('.wasm' in a for a in after), f'{path}: WASM engine listed after picking a file ({after})')
            ok(all(a.startswith('/') for a in after), f'{path}: every request after the pick is same-origin')
            ok(pg.locator('#netlog .netlog-marker').inner_text().strip() == 'You picked a file', f'{path}: marker label')
        n, shown, rows = pg.evaluate(COUNT_MATCH)
        ok(n == shown == rows, f'{path}: count still matches after the action ({shown}/{n})')
        ok(pg.locator('#netlog .netlog-tag').count() == 0, f'{path}: no external requests')
        ok(not errs, f'{path}: no console errors {errs}')
        pg.close()
    # Fallback: no PerformanceObserver.
    pg = b.new_page()
    pg.add_init_script("delete window.PerformanceObserver;")
    pg.goto(base + '/tools/text-redactor/'); pg.wait_for_load_state('networkidle')
    pg.click('#netlog summary')
    ok(pg.locator('#netlog .netlog-fallback').is_visible(), 'fallback line visible without PerformanceObserver')
    ok(not pg.locator('#netlog .netlog-scroll').is_visible(), 'table hidden in fallback')
    b.close()
srv.shutdown()
print('FAILED: %d' % len(fails) if fails else 'all passed')
raise SystemExit(1 if fails else 0)
