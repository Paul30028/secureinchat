import http.server
import json
import os
import re
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
TEXT = "Hi, I'm Jane Doe, I live at 42 Maple Street, Springfield."
LABELS = ["person", "street address", "city", "organization", "phone number", "email"]

headers_src = open(os.path.join(ROOT, '_headers'), encoding='utf-8').read()
match = re.search(r'/workspace/\*?\n\s*Content-Security-Policy: (.*)', headers_src)
if not match:
    raise SystemExit('FAIL workspace CSP not found in public/_headers')
CSP = match.group(1).strip()
MANIFEST = json.load(open(os.path.join(ROOT, 'workspace', 'ai', 'manifest.json'), encoding='utf-8'))

SMOKE_HTML = b"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AI worker smoke</title>
<link rel="icon" href="data:,"></head><body></body></html>
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path.split('?', 1)[0] == '/smoke':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(SMOKE_HTML)))
            self.end_headers()
            self.wfile.write(SMOKE_HTML)
            return
        super().do_GET()

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


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.set_default_timeout(240000)
    requests = []
    console_errors = []
    page.on('request', lambda request: requests.append(request.url))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)

    page.goto(base + '/smoke', wait_until='load')
    result = page.evaluate(
        """async ({workerUrl, text, labels, threshold}) => {
            const violations = [];
            document.addEventListener('securitypolicyviolation', (event) => {
                violations.push(event.violatedDirective + ' ' + event.blockedURI);
            });
            return await new Promise((resolve, reject) => {
                const worker = new Worker(workerUrl, { type: 'module' });
                const progress = [];
                let loadMs = 0;
                const timer = setTimeout(() => {
                    worker.terminate();
                    reject(new Error('worker timed out'));
                }, 220000);
                worker.onerror = (event) => {
                    clearTimeout(timer);
                    reject(new Error('worker error: ' + event.message));
                };
                worker.onmessage = (event) => {
                    const message = event.data;
                    if (message.type === 'progress') {
                        progress.push({ loaded: message.loaded, total: message.total });
                        return;
                    }
                    if (message.type === 'ready') {
                        loadMs = message.ms;
                        worker.postMessage({ type: 'detect', id: 'smoke-1', text, labels, threshold });
                        return;
                    }
                    if (message.type === 'result') {
                        const entities = message.entities;
                        worker.postMessage({ type: 'clear-cache' });
                        worker.__entities = entities;
                        worker.__detectMs = message.ms;
                        return;
                    }
                    if (message.type === 'cache-cleared') {
                        clearTimeout(timer);
                        worker.terminate();
                        resolve({
                            loadMs,
                            detectMs: worker.__detectMs,
                            entities: worker.__entities,
                            progress,
                            violations,
                        });
                        return;
                    }
                    if (message.type === 'error') {
                        clearTimeout(timer);
                        worker.terminate();
                        reject(new Error(message.code + ': ' + message.message));
                    }
                };
                worker.postMessage({ type: 'load' });
            });
        }""",
        {'workerUrl': '/workspace/ai/ai-worker.js', 'text': TEXT, 'labels': LABELS, 'threshold': 0.4},
    )
    browser.close()

server.shutdown()

entities = result['entities']
print(f"loaded in {result['loadMs']:.0f} ms, detected in {result['detectMs']:.1f} ms")
for entity in entities:
    print(f"  {entity['label']:16s} {entity['score']:.3f}  {entity['start']}-{entity['end']}  {entity['text']!r}")

check(len(entities) > 0, 'worker returns entities')
check(any(e['label'] == 'person' and e['text'] == 'Jane Doe' for e in entities), 'detects Jane Doe as person')
check(any(e['label'] == 'street address' and e['text'] == '42 Maple Street' for e in entities), 'detects 42 Maple Street as street address')
check(any(e['label'] == 'city' and e['text'] == 'Springfield' for e in entities), 'detects Springfield as city')
check(all(TEXT[e['start']:e['end']] == e['text'] for e in entities), 'every span matches the original text')
check(result['loadMs'] > 0 and result['detectMs'] > 0, 'load and detect report elapsed milliseconds')

progress = result['progress']
check(len(progress) > 0, 'load reports progress')
check(all(progress[i]['loaded'] <= progress[i + 1]['loaded'] for i in range(len(progress) - 1)), 'progress is monotonic')
check(progress[-1]['loaded'] == progress[-1]['total'] == MANIFEST['totalBytes'], 'progress ends at the manifest totalBytes')

ai_requests = [url for url in requests if '/workspace/ai/' in url]
other_requests = [url for url in requests if url != base + '/smoke' and '/workspace/ai/' not in url]
check(len(ai_requests) > 0, 'worker fetches AI assets')
check(not other_requests, f'no request outside /workspace/ai/ ({other_requests[:3]})')
check(all(url.startswith(base + '/workspace/ai/') for url in ai_requests), 'every AI request is same-origin')
check(all('Jane%20Doe' not in url and 'Jane Doe' not in url for url in requests), 'no request URL contains the tested text')
check(not result['violations'], f"no CSP violations ({result['violations'][:3]})")
check(not console_errors, f"no console errors ({console_errors[:3]})")

print('SMOKE PASSED' if not fails else 'SMOKE FAILED')
raise SystemExit(1 if fails else 0)
