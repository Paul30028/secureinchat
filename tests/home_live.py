import http.server, threading, socketserver, os, re
from playwright.sync_api import sync_playwright
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
headers = open(os.path.join(ROOT, '_headers')).read()
csp = re.search(r'(?:^|\n)/\n\s*Content-Security-Policy: (.*)', headers).group(1)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{port}'
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    outside, errors, requests = [], [], []
    pg.on('request', lambda r: (requests.append(r.url),
        outside.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') else None))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(BASE + '/', wait_until='load')
    pg.evaluate("() => document.fonts ? document.fonts.ready.then(() => true) : true")
    ok(pg.inner_text('#hero-title').strip() == "Before you share, see what you're sending.", 'hero title is the approved English line')
    ok(pg.is_visible('#home-text'), 'live text field is visible')
    fixture = 'Mail bob@example.com, call +1 415-555-0132.'
    pg.fill('#home-text', fixture)
    pg.wait_for_selector('#home-categories [data-category="email"]', timeout=5000)
    pg.wait_for_selector('#home-categories [data-category="phone"]', timeout=5000)
    ok(pg.locator('#home-categories [data-category="email"]').count() == 1, 'email category is found')
    ok(pg.locator('#home-categories [data-category="phone"]').count() == 1, 'phone category is found')
    ok(pg.locator('#home-categories .home-category__count').first.inner_text().isdigit(), 'categories show a real count')
    pg.wait_for_timeout(700)
    count = pg.get_attribute('#request-count', 'data-count')
    ok(count == '0', f'requests since typing starts at 0 (got {count})')
    ok('Requests since you started typing: 0' in pg.inner_text('#request-count'), 'request count sentence is exact')
    hrefs = pg.eval_on_selector_all('a[href]', 'as => as.map(a => a.href)')
    ok(not [h for h in hrefs if 'bob@example.com' in h or '415-555-0132' in h], 'input text never appears in a link URL')
    ok('bob@example.com' not in pg.evaluate('location.href') and '415-555-0132' not in pg.evaluate('location.href'), 'input text never appears in the page URL')
    ok(not [u for u in requests if 'bob@example.com' in u or '415-555-0132' in u or 'bob%40' in u], 'input text never appears in a request URL')
    ok(not outside, f'no request left the local server {outside[:3]}')
    ok(not errors, f'no console errors {errors[:3]}')

    # The counter is measured, not printed: a real local fetch after typing must increment it.
    pg.evaluate("fetch('/assets/js/home.js?measured=1').then(r => r.text())")
    pg.wait_for_function("() => Number(document.getElementById('request-count').dataset.count) >= 1", timeout=5000)
    ok(True, 'a later local request increments the measured count')

    # 320 px: no horizontal overflow, and the live field is still usable.
    pg.set_viewport_size({'width': 320, 'height': 800})
    pg.goto(BASE + '/', wait_until='load')
    pg.evaluate("() => document.fonts ? document.fonts.ready.then(() => true) : true")
    ov = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    ok(ov <= 0, f'320px home has no horizontal overflow ({ov})')
    ok(pg.is_visible('#home-text'), '320px live text field visible')

    # No JavaScript: a plain explanation and a workspace link replace the live field.
    ctx = b.new_context(java_script_enabled=False, viewport={'width': 1280, 'height': 800})
    nj = ctx.new_page(); nj.goto(BASE + '/', wait_until='load')
    ok(nj.is_visible('#home-noscript'), 'no-JS explanation is visible')
    ok(not nj.is_visible('#home-text'), 'no-JS live field is not shown')
    ok(nj.locator('.home-nojs a[href="/workspace/"]').count() >= 1, 'no-JS explanation links /workspace/')
    ctx.close()

    # No Resource Timing API: say it cannot be counted, never print a fake zero.
    ctx2 = b.new_context(viewport={'width': 1280, 'height': 800})
    un = ctx2.new_page()
    un.add_init_script("delete window.PerformanceObserver; try { window.performance.getEntriesByType = undefined; } catch (e) {}")
    un.goto(BASE + '/', wait_until='load')
    un.fill('#home-text', 'bob@example.com')
    ok('unable to count' in un.inner_text('#request-count').lower(), 'missing Resource Timing API reports unable to count')
    ok(un.get_attribute('#request-count', 'data-count') is None, 'unsupported API does not display 0')
    ctx2.close()
    b.close()
srv.shutdown()
raise SystemExit(1 if fails else 0)
