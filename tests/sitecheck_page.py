import http.server, threading, socketserver, os, re, json
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
RESP = {'target': 'example.com', 'finalUrl': 'https://example.com/', 'checkedAt': '2026-10-20T00:00:00Z', 'summary': {'pass': 1, 'warn': 1, 'fail': 1, 'info': 0},
        'checks': [{'id': 'https', 'label': 'HTTPS', 'status': 'pass', 'value': 'Served over HTTPS', 'detail': 'ok'},
                   {'id': 'hsts', 'label': 'HSTS', 'status': 'warn', 'value': 'Missing', 'detail': 'Add HSTS'},
                   {'id': 'viewport', 'label': 'Mobile viewport', 'status': 'fail', 'value': 'Missing', 'detail': 'Add viewport'}]}
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(permissions=['clipboard-read', 'clipboard-write']); pg = ctx.new_page(); pg.set_viewport_size({'width': 1280, 'height': 800}); errs = []; api = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if 'Content Security' in m.text else None)
    def handle(route):
        u = route.request.url; api.append(u)
        if 'url=bad' in u: route.fulfill(status=400, content_type='application/json', body=json.dumps({'error': 'Enter a domain name, not an IP address.'}))
        else: route.fulfill(status=200, content_type='application/json', body=json.dumps(RESP))
    pg.route('**/tools/api/site-check*', handle)
    pg.goto(f'http://127.0.0.1:{port}/tools/site-health-check/')
    ok(pg.is_disabled('#sc-copy'), 'copy disabled before a run')
    pg.click('#sc-go')
    ok('Enter a website address' in pg.inner_text('#summary') and not api, 'empty input is refused without a request')
    pg.fill('#sc-url', 'bad')
    pg.click('#sc-go'); pg.wait_for_selector('#summary[data-tone="fail"]')
    ok('not an IP' in pg.inner_text('#summary'), 'server error message is shown')
    pg.fill('#sc-url', 'example.com'); pg.keyboard.press('Enter')
    pg.wait_for_selector('#rows tr:nth-child(3)')
    ok('url=example.com' in api[-1], 'address is sent encoded to the site endpoint: ' + api[-1])
    ok(pg.locator('#rows tr[data-status="fail"]').count() == 1 and pg.locator('#rows tr[data-status="warn"]').count() == 1, 'rows carry statuses')
    ok('1 OK, 1 to improve, 1 problem.' in pg.inner_text('#summary'), 'summary counts: ' + pg.inner_text('#summary'))
    ok(pg.is_enabled('#sc-copy'), 'copy enabled after a run')
    pg.click('#sc-copy')
    txt = pg.evaluate('navigator.clipboard.readText()')
    ok('[Problem] Mobile viewport: Missing' in txt and 'Website health check: example.com' in txt, 'copied report has statuses')
    ok(all(not u.startswith('http') or u.startswith(f'http://127.0.0.1:{port}') for u in api), 'only same-origin requests')
    pg.fill('#sb-list', 'a.com\nbad\nb.com\na.com')
    pg.click('#sb-go'); pg.wait_for_selector('#sb-rows tr:nth-child(3)'); pg.wait_for_selector('#sb-dl:not([disabled])')
    ok(pg.locator('#sb-rows tr').count() == 3, 'duplicates removed, one row per site')
    ok('not an IP' in pg.locator('#sb-rows tr').nth(1).inner_text(), 'per-site error shown')
    ok('Done: 3 sites' in pg.inner_text('#sb-status'), 'batch status: ' + pg.inner_text('#sb-status'))
    with pg.expect_download() as d: pg.click('#sb-dl')
    path = d.value.path(); html = open(path).read()
    ok(d.value.suggested_filename == 'website-health-report.html' and 'Mobile viewport' in html and '<script' not in html, 'report file downloads and has no script')
    RESP['checks'][0]['value'] = '<script>x</script>'
    pg.fill('#sb-list', 'c.com'); pg.click('#sb-go'); pg.wait_for_selector('#sb-dl:not([disabled])')
    with pg.expect_download() as d2: pg.click('#sb-dl')
    h2 = open(d2.value.path()).read()
    ok('<script>x' not in h2 and '&lt;script&gt;x' in h2, 'untrusted values are escaped in the report')
    pg.fill('#sb-list', ' '.join(f'h{i}.com' for i in range(12))); pg.click('#sb-go'); pg.wait_for_selector('#sb-dl:not([disabled])')
    ok(pg.locator('#sb-rows tr').count() == 10 and '2 more were ignored' in pg.inner_text('#sb-status'), 'limit of 10 per run')
    pg.set_viewport_size({'width': 390, 'height': 800})
    ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no overflow at 390px')
    ok(not errs, 'no page or CSP errors ' + str(errs))
    b.close()
print('SITECHECK PAGE ' + ('FAILED' if fails else 'PASSED'))
raise SystemExit(1 if fails else 0)
