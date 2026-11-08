import http.server
import json
import os
import re
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
TEXT = "Hi, I'm Jane Doe, I live at 42 Maple Street, Springfield. Email jane@example.com"
MANIFEST = json.load(open(os.path.join(ROOT, 'workspace', 'ai', 'manifest.json'), encoding='utf-8'))

headers_src = open(os.path.join(ROOT, '_headers'), encoding='utf-8').read()
match = re.search(r'/workspace/\*?\n\s*Content-Security-Policy: (.*)', headers_src)
if not match:
    raise SystemExit('FAIL workspace CSP not found in public/_headers')
CSP = match.group(1).strip()


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
base = f'http://127.0.0.1:{port}'

fails = []


def check(condition, message):
    print(('ok   ' if condition else 'FAIL ') + message)
    if not condition:
        fails.append(message)


def row_for(page, text):
    return page.locator('#ai-result .ai-row', has_text=text).first


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    context = browser.new_context(accept_downloads=True)
    page = context.new_page()
    page.set_default_timeout(240000)
    page.add_init_script(
        "window.__csp = [];"
        "document.addEventListener('securitypolicyviolation', function (event) {"
        "  window.__csp.push(event.violatedDirective + ' ' + event.blockedURI);"
        "});"
    )
    requests = []
    console_errors = []
    page.on('request', lambda request: requests.append(request.url))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    page.on('dialog', lambda dialog: dialog.accept())

    page.goto(base + '/workspace/', wait_until='load')

    ai_before = [url for url in requests if '/workspace/ai/' in url]
    check(not ai_before, f'no /workspace/ai/ request before the user enables it ({ai_before[:3]})')
    check(page.is_visible('#ai-enable'), 'the local AI block starts with a download button')
    check(page.locator('#ai-progress').get_attribute('aria-valuenow') == '0', 'progress starts at 0')
    # The size shown must be everything enabling downloads (model + tokenizer + config + runtime + worker).
    _listed = MANIFEST.get('tokenizerFiles', []) + MANIFEST.get('configFiles', []) + MANIFEST.get('runtime', {}).get('files', [])
    _download = MANIFEST['totalBytes'] + sum(int(f['bytes']) for f in _listed) + os.path.getsize(os.path.join(ROOT, 'workspace', 'ai', 'ai-worker.js'))
    button_text = page.locator('#ai-enable').text_content() or ''
    expected_mb = str(round(_download / 1000000, 1))
    if expected_mb.endswith('.0'): expected_mb = expected_mb[:-2]  # the page prints 98 MB, not 98.0 MB
    check(expected_mb + ' MB' in button_text, f'button shows the full download size in MB ({expected_mb} MB) [{button_text}]')
    check(expected_mb + ' MB' in (page.locator('#ai-size').text_content() or ''), 'description shows the same full download size')
    check('Download and enable' in button_text, 'AI starts disabled and needs a click')

    page.click('#ai-enable')
    page.wait_for_selector('#ai-ready', state='visible', timeout=220000)
    ready_text = page.inner_text('#ai-ready')
    check('Ready' in ready_text, 'load ends in a ready state')
    check(re.search(r'Loaded in [\d.]+ seconds', ready_text) is not None, 'ready text reports seconds')
    check(page.locator('#ai-progress').get_attribute('aria-valuenow') == '100', 'progress reached 100%')
    check(page.is_visible('#ai-delete'), 'delete-model button is offered after enable')

    page.fill('#draft', TEXT)
    page.click('#inspect-text')
    page.wait_for_selector('#text-result', state='visible', timeout=10000)
    rule_text = page.inner_text('#text-result')
    check('Email addresses' in rule_text and 'jane@example.com' not in rule_text, 'rule group shows the email category immediately')
    check(page.locator('#text-result .rule-row', has_text='Email addresses').count() == 1, 'rule email row is present')

    page.wait_for_selector('#ai-result', state='visible', timeout=220000)
    ai_text = page.inner_text('#ai-result')
    check('AI suggestions (please confirm)' in ai_text, 'AI results are a separate confirmation group')
    check('Jane Doe' in ai_text, 'AI group has Jane Doe')
    check('42 Maple Street' in ai_text, 'AI group has 42 Maple Street')
    check(page.locator('#ai-result .ai-row').count() >= 2, 'AI group lists individual items')
    check(page.locator('#ai-result input[type=checkbox]:checked').count() == 0, 'every AI suggestion starts unchecked')
    check(page.locator('#ai-result .ai-row', has_text='Jane Doe').inner_text().count('%') == 1, 'AI rows show a confidence percentage')

    page.evaluate("document.getElementById('ai-result').scrollIntoView()")
    row_for(page, 'Jane Doe').locator('input[type=checkbox]').check()
    page.wait_for_function("document.getElementById('clean-preview') && !document.getElementById('clean-preview').value.includes('Jane Doe')")
    clean = page.input_value('#clean-preview')
    check('Jane Doe' not in clean, 'checking an AI suggestion replaces it in the preview')
    check('[EMAIL_1]' in clean, 'rule replacements still apply to the preview')
    check('42 Maple Street' in clean, 'unchecked AI suggestions stay untouched')

    check(page.is_visible('#receipt-panel'), 'receipt is offered after the text check')
    with page.expect_download() as download_info:
        page.click('#download-receipt')
    raw = open(download_info.value.path(), encoding='utf-8').read()
    receipt = json.loads(raw)
    ai_summary = receipt.get('summary', {}).get('ai', {})
    check(ai_summary.get('suggested', 0) >= 2, 'receipt records the AI suggestion count')
    check(ai_summary.get('accepted') == 1, 'receipt records the accepted AI count')
    check(ai_summary.get('modelVersion') == MANIFEST['version'], 'receipt records the model version')
    for marker in ('Jane', 'Maple', 'jane@example.com', 'Springfield', TEXT):
        check(marker not in raw, f'receipt does not contain input marker: {marker}')

    page.click('#ai-delete')
    page.wait_for_selector('#ai-enable', state='visible', timeout=10000)
    check(page.is_hidden('#ai-ready'), 'delete resets the ready state')
    check(page.locator('#ai-progress').get_attribute('aria-valuenow') == '0', 'delete resets the progress value')
    check(page.is_hidden('#ai-result'), 'delete clears the AI suggestions')
    check('deleted' in page.inner_text('#ai-status').lower(), 'delete tells the user the model was removed')
    check(page.locator('#ai-result input[type=checkbox]').count() == 0, 'no AI selections survive the delete')

    ai_requests = [url for url in requests if '/workspace/ai/' in url]
    http_requests = [url for url in requests if url.startswith('http')]
    check(len(ai_requests) > 0, 'enabling the AI downloads assets from /workspace/ai/')
    check(all(url.startswith(base + '/workspace/ai/') for url in ai_requests), 'every AI request is same-origin')
    check(all(url.startswith(base) for url in http_requests), f'every request is same-origin ({[u for u in http_requests if not u.startswith(base)][:3]})')
    leaked = [url for url in requests if 'Jane' in url or 'Maple' in url or 'jane%40' in url.lower()]
    check(not leaked, f'no request URL contains the tested text ({leaked[:3]})')
    violations = page.evaluate('window.__csp')
    check(not violations, f'no CSP violations ({violations[:3]})')
    check(not console_errors, f'no console errors ({console_errors[:3]})')

    # A browser without Worker/WebAssembly gets a message, not an exception.
    unsupported = context.new_page()
    unsupported_errors = []
    unsupported.on('console', lambda message: unsupported_errors.append(message.text) if message.type == 'error' else None)
    unsupported.add_init_script("Object.defineProperty(window, 'Worker', { get: function () { return undefined; }, configurable: true });")
    unsupported.goto(base + '/workspace/', wait_until='load')
    check(unsupported.is_visible('#ai-unsupported'), 'unsupported browser shows the local-AI message')
    check(unsupported.is_hidden('#ai-enable'), 'unsupported browser offers no download button')
    check('does not support local AI' in unsupported.inner_text('#ai-unsupported'), 'unsupported message says the browser does not support local AI')
    check(not unsupported_errors, f'unsupported browser has no console errors ({unsupported_errors[:3]})')

    browser.close()

server.shutdown()

print('WORKSPACE AI PASSED' if not fails else 'WORKSPACE AI FAILED')
raise SystemExit(1 if fails else 0)
