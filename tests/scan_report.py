# Playwright test for the /scan/ report and local export.
# Asserts: the one-sentence summary appears, default JSON/text contain no raw WebGL renderer or
# full user agent, opting in includes them, exports add no network request or storage write,
# print CSS shows only the report, and there is no console error or CSP violation.
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


def download(page, button):
    with page.expect_download() as info:
        page.click(button)
    return info.value


with sync_playwright() as playwright:
    # Software WebGL keeps the renderer string available in headless Chromium.
    browser = playwright.chromium.launch(args=['--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
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

    page.click('#scan-start')
    page.wait_for_function(
        "() => /Local scan complete/.test(document.getElementById('scan-status').textContent)"
    )

    summary = page.inner_text('#results-summary')
    check(re.fullmatch(
        r'A normal website can read \d+ items from you without your permission, \d+ of them higher risk\..*',
        summary, re.S), 'report starts with the one-sentence summary: ' + summary.splitlines()[0])
    check('unique' not in summary.lower() and 'safe' not in summary.lower(), 'summary has no uniqueness or safety score')

    ua = page.evaluate('navigator.userAgent')
    webgl_raw = page.inner_text('.result-card[data-id="webgl"] .result-value').strip()
    check(len(ua) > 20, 'page exposes the full user agent for comparison')
    check(not re.match(r'^(Unavailable|Hidden)', webgl_raw), 'WebGL renderer raw value is readable: ' + webgl_raw[:60])

    json_download = download(page, '#download-json')
    check(json_download.suggested_filename == 'exposure-report.json', 'JSON filename is exposure-report.json')
    default_json = open(json_download.path(), encoding='utf-8').read()
    check(ua not in default_json, 'default JSON hides the full user agent')
    check(webgl_raw not in default_json, 'default JSON hides the raw WebGL renderer')
    parsed = json.loads(default_json)
    check(parsed['schema'] == 'secureinchat.exposure-report/1', 'JSON carries a schema version')
    check(parsed['redaction']['includeRaw'] is False, 'JSON records that raw values were excluded')
    check(any(item['id'] == 'webgl' and item['redacted'] for item in parsed['items']),
          'JSON marks the WebGL value as redacted')

    text_download = download(page, '#download-text')
    check(text_download.suggested_filename == 'exposure-report.txt', 'text filename is exposure-report.txt')
    default_text = open(text_download.path(), encoding='utf-8').read()
    check(ua not in default_text, 'default text hides the full user agent')
    check(webgl_raw not in default_text, 'default text hides the raw WebGL renderer')
    check('A graphics card vendor and model were read' in default_text, 'default text names the WebGL category')
    check(parsed['summary']['line'] in default_text, 'text carries the same summary line as JSON')

    check(page.locator('#raw-warning').is_hidden(), 'raw-value warning is hidden while the option is off')
    page.check('#include-raw')
    check(page.locator('#raw-warning').is_visible(), 'raw-value warning appears when the option is on')
    check('recognise your device' in page.inner_text('#raw-warning'), 'warning names the device-recognition risk')

    raw_download = download(page, '#download-json')
    raw_json = open(raw_download.path(), encoding='utf-8').read()
    check(ua in raw_json, 'opting in includes the full user agent')
    check(webgl_raw in raw_json, 'opting in includes the raw WebGL renderer')
    raw_parsed = json.loads(raw_json)
    check(raw_parsed['redaction']['includeRaw'] is True, 'JSON records the opt-in')
    check(all(not item['withheld'] for item in raw_parsed['items'] if item['id'] != 'canvas'),
          'no non-canvas value is withheld after opt-in')

    new_http = [u for u in requests[baseline:] if u.startswith('http')]
    check(not new_http, 'report generation and downloads made no network request: %s' % new_http[:5])
    storage = page.evaluate(
        "async () => ({local: localStorage.length, session: sessionStorage.length,"
        " cookie: document.cookie,"
        " idb: indexedDB.databases ? (await indexedDB.databases()).length : 0})"
    )
    check(storage == {'local': 0, 'session': 0, 'cookie': '', 'idb': 0},
          'exports wrote no storage: %r' % storage)

    page.emulate_media(media='print')
    styles = page.evaluate(
        "() => ({header: getComputedStyle(document.querySelector('.sc-header')).display,"
        " hero: getComputedStyle(document.querySelector('.hero')).display,"
        " scan: getComputedStyle(document.getElementById('scan-section')).display,"
        " report: getComputedStyle(document.getElementById('scan-results')).display,"
        " footer: getComputedStyle(document.querySelector('.sc-footer')).display})"
    )
    check(styles['header'] == 'none' and styles['hero'] == 'none' and styles['scan'] == 'none'
          and styles['footer'] == 'none', 'print hides navigation, hero, scan progress and footer: %r' % styles)
    check(styles['report'] != 'none', 'print shows the report')
    page.emulate_media(media='screen')

    csp = page.evaluate('window.__csp')
    check(not csp, 'no CSP violation: %s' % csp[:5])
    check(not console_errors, 'no console or page error: %s' % console_errors[:5])

    context.close()
    browser.close()

server.shutdown()
print('\n%d failure(s)' % len(fails))
if fails:
    raise SystemExit(1)
