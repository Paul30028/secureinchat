import http.server, threading, socketserver, os, re, json
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
csp = re.search(r'/workspace/\*?\n\s*Content-Security-Policy: (.*)', open(os.path.join(ROOT, '_headers')).read()).group(1)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

email = 'bob@example.com'
phone = '202-555-0132'
draft = f'Project Bluebird: email {email} or call {phone}. The launch note is private.'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(accept_downloads=True)
    outside, errors = [], []
    pg.on('request', lambda r: outside.append(r.url) if not r.url.startswith(f'http://127.0.0.1:{port}') else None)
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto(f'http://127.0.0.1:{port}/workspace/')
    ok(pg.locator('#recipient input[type=radio]').count() == 4, 'recipient selector has four single-choice options')
    ok(pg.locator('#recipient input[type=radio]:checked').count() == 0, 'recipient starts with no selection')
    ok('No recipient selected' in pg.inner_text('#recipient-note'), 'workspace is usable without a recipient')
    pg.locator('#recipient input[value="ai"]').check()
    ok(pg.locator('#recipient-note li').count() == 3, 'AI recipient shows three review points')
    ok('retention' in pg.inner_text('#recipient-note'), 'AI reminder names platform retention')
    ok('not a safety score' in pg.inner_text('#recipient-note'), 'recipient reminder is not a verdict')

    pg.fill('#draft', draft)
    pg.click('#inspect-text')
    pg.wait_for_selector('#download-receipt', timeout=10000)
    ok(pg.is_visible('#receipt-panel'), 'receipt is offered after a successful text check')
    ok('Unsigned and not proof' in pg.inner_text('#receipt-panel'), 'receipt panel says unsigned and not proof')
    ok('only your own record' in pg.inner_text('#receipt-panel'), 'receipt panel says it is the user own record')
    with pg.expect_download() as d:
        pg.click('#download-receipt')
    dl = d.value
    raw = open(dl.path(), encoding='utf-8').read()
    rec = json.loads(raw)
    ok(dl.suggested_filename == 'secureinchat-local-receipt.json', f'receipt file name is fixed ({dl.suggested_filename})')
    ok(rec.get('schemaVersion') == 1, 'receipt has schema version')
    ok(rec.get('checkType') == 'text', 'receipt records the check type')
    ok(rec.get('recipient') == {'id': 'ai', 'label': 'AI assistant'}, 'receipt records the selected recipient')
    ok(rec.get('summary', {}).get('counts', {}).get('email') == 1, 'receipt counts the email category')
    ok(rec.get('unsigned') is True, 'receipt is marked unsigned')
    ok('not proof' in rec.get('notice', '').lower(), 'receipt JSON says it is not proof')
    ok(rec.get('createdAt', '').endswith('Z'), 'receipt has an ISO time')
    for marker in (email, phone, draft, 'Project Bluebird', 'launch note'):
        ok(marker not in raw, f'receipt JSON does not contain input marker: {marker}')
    ok('@' not in raw, 'receipt JSON contains no email-like value')
    ok(pg.evaluate("localStorage.length+sessionStorage.length+document.cookie.length") == 0, 'receipt flow uses no storage or cookies')

    pg.click('#tab-link')
    ok(pg.is_hidden('#receipt-panel'), 'switching mode clears the receipt')
    ok(pg.locator('#download-receipt').is_hidden(), 'receipt download button is hidden after a mode switch')
    ok(pg.input_value('#draft') == '', 'switching mode clears the draft')
    ok(not outside, f'no request left the local server {outside}')
    ok(not errors, f'no console errors {errors}')
    b.close()
srv.shutdown()
raise SystemExit(1 if fails else 0)
