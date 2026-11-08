# Playwright test for /scan/ (local-only exposure scan).
# Serves public/ with the /scan/ CSP from _headers. Asserts: nothing runs before the click,
# the expected local items appear, the scan adds zero requests, no storage is written,
# a second scan compares, no CSP or console errors, and 320px has no horizontal overflow.
import http.server
import json
import os
import re
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
headers_src = open(os.path.join(ROOT, '_headers'), encoding='utf-8').read()
match = re.search(r'/scan/\*\n\s*Content-Security-Policy: (.*)', headers_src)
if not match:
    raise SystemExit('FAIL /scan/ CSP not found in public/_headers')
CSP = match.group(1).strip()
assert "script-src 'self'" in CSP, CSP
assert "connect-src 'none'" in CSP, CSP
assert "'unsafe-inline'" not in CSP, CSP


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


server = Server(('127.0.0.1', 0), Handler)
port = server.server_address[1]
threading.Thread(target=server.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:%d' % port

fails = []


def check(condition, message):
    print(('ok   ' if condition else 'FAIL ') + message)
    if not condition:
        fails.append(message)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()
    page.set_default_timeout(30000)

    requests = []
    console_errors = []
    page.on('request', lambda request: requests.append(request.url))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    page.on('pageerror', lambda error: console_errors.append(str(error)))
    page.add_init_script(
        "window.__csp = [];"
        "document.addEventListener('securitypolicyviolation', function (event) {"
        "  window.__csp.push(event.violatedDirective + ' ' + event.blockedURI);"
        "});"
    )

    page.goto(base + '/scan/', wait_until='load')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(300)
    baseline = len(requests)

    # Nothing runs until the user presses the button.
    check(page.locator('#scan-results').is_hidden(), 'no report before the click')
    check(page.locator('#scan-results .result-card').count() == 0, 'no result cards before the click')
    check(page.locator('#scan-status').inner_text().strip() == 'No scan has run yet.', 'idle status is explicit')
    check('Start local scan' in page.inner_text('#scan-start'), 'start button waits for the user')
    check('does not use the network' in page.inner_text('.promise'), 'first screen says this part is offline')
    check(page.inner_text('#proof-new').find('0') != -1, 'proof panel starts at 0 scan requests')
    check(page.locator('#compare').is_hidden(), 'no comparison before two scans')

    page.click('#scan-start')
    page.wait_for_selector('#scan-results .result-card', timeout=30000)
    page.wait_for_function(
        "() => document.querySelectorAll('#scan-results .result-card').length >= 13"
        " && /Local scan complete/.test(document.getElementById('scan-status').textContent)"
    )
    check(page.locator('#scan-results .result-card').count() >= 13, 'report lists the local items')

    text = page.inner_text('#scan-results')
    for label in ('Time zone', 'Screen, window and pixel ratio', 'Canvas drawing', 'WebGL renderer',
                  'Detectable fonts', 'Do Not Track and Global Privacy Control', 'Cookie support',
                  'Touch capability', 'Colour-scheme preference', 'Reduced-motion preference'):
        check(label in text, 'report includes ' + label)
    check('Who can read it:' in text, 'each card states who can read it')
    check(page.locator('#scan-results details summary').first.inner_text() == 'How to reduce',
          'reduction advice is behind an expandable summary')
    check('unique' not in text.lower() and 'uniqueness' not in text.lower(), 'no uniqueness claim in the report')
    check('%' not in page.inner_text('#results-summary'), 'no percentage in the summary')

    scan_requests = requests[baseline:]
    check(not scan_requests, 'local scan added no network request (%s)' % scan_requests[:5])
    proof_new = page.inner_text('#proof-new')
    check('0 new requests' in proof_new, 'proof panel reports 0 new requests: ' + proof_new)

    storage = page.evaluate(
        "async () => ({"
        "  local: localStorage.length,"
        "  session: sessionStorage.length,"
        "  cookie: document.cookie,"
        "  idb: indexedDB.databases ? (await indexedDB.databases()).length : 0"
        "})"
    )
    check(storage['local'] == 0, 'localStorage stayed empty')
    check(storage['session'] == 0, 'sessionStorage stayed empty')
    check(storage['cookie'] == '', 'no cookie was set: %r' % storage['cookie'])
    check(storage['idb'] == 0, 'no IndexedDB database was created')

    # Save the first run in page memory, then run the same scan again.
    page.click('#save-snapshot')
    page.wait_for_selector('#compare:not([hidden])')
    check('Unchanged' in page.inner_text('#compare'), 'first comparison view names unchanged items')
    page.click('#scan-start')
    page.wait_for_function(
        "() => /Local scan complete/.test(document.getElementById('scan-status').textContent)"
        " && !document.getElementById('compare').hidden"
        " && document.querySelectorAll('#scan-results .result-card').length >= 13"
    )
    compare_text = page.inner_text('#compare')
    check('Changed' in compare_text and 'Unchanged' in compare_text, 'second scan shows changed/unchanged sections')
    check('could not compare' in compare_text.lower(), 'comparison names the not-comparable section')
    check('Unchanged' in compare_text and re.search(r'\b13 unchanged\b', page.inner_text('#compare-status')),
          'identical scans report unchanged values')

    # No second-scan request either, and memory-only state was never persisted.
    check(len(requests) == baseline, 'save and second scan added no network request (%s)' % requests[baseline:][:5])
    storage2 = page.evaluate(
        "async () => ({local: localStorage.length, session: sessionStorage.length,"
        " cookie: document.cookie,"
        " idb: indexedDB.databases ? (await indexedDB.databases()).length : 0})"
    )
    check(storage2 == {'local': 0, 'session': 0, 'cookie': '', 'idb': 0}, 'second scan wrote no storage: %r' % storage2)

    # Keyboard reachability of the main controls.
    page.focus('#scan-start')
    check(page.evaluate("document.activeElement.id") == 'scan-start', 'start button can receive keyboard focus')
    page.focus('#save-snapshot')
    check(page.evaluate("document.activeElement.id") == 'save-snapshot', 'save button can receive keyboard focus')

    # 320px: no whole-page horizontal overflow, including long UA and renderer values.
    page.set_viewport_size({'width': 320, 'height': 800})
    page.wait_for_timeout(200)
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(overflow <= 1, '320px has no horizontal overflow (overflow=%s)' % overflow)

    csp = page.evaluate('window.__csp')
    check(not csp, 'no CSP violation: %s' % csp[:5])
    check(not console_errors, 'no console or page error: %s' % console_errors[:5])

    context.close()
    browser.close()

server.shutdown()
print('\n%d failure(s)' % len(fails))
if fails:
    raise SystemExit(1)
