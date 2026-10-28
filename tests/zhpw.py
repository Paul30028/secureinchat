# W10: Chinese password checker (/zh/tools/password-checker/), served with the CSP from _headers for that path.
# Checks the Chinese interface (every note pw.js can produce has a Chinese string), that typing sends nothing,
# that the breach check sends only the 5-character SHA-1 prefix (service mocked), the failure path, the
# generator, no affiliate / VPN / IP-test links, and that the English page still reads in English.
import http.server, threading, socketserver, os, re, sys, hashlib, subprocess, json
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/zhpw'
os.makedirs(OUT, exist_ok=True)
hdr = open(os.path.join(ROOT, '_headers')).read()
csp_zh = re.search(r'/zh/tools/password-checker/\n\s*Content-Security-Policy: (.*)', hdr).group(1)
csp_tools = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', hdr).group(1)
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
ok(csp_zh == csp_tools, 'zh page uses the tools CSP')

# Every English note and label pw.js can return must have a Chinese mapping in pw-app.js.
pwjs = open(os.path.join(ROOT, 'tools/assets/pw.js'), encoding='utf-8').read()
app = open(os.path.join(ROOT, 'tools/assets/pw-app.js'), encoding='utf-8').read()
notes = set(re.findall(r"notes\.push\('([^']+)'\)", pwjs)) | set(re.findall(r"notes: \['([^']+)'\]", pwjs))
ok(len(notes) == 9, f'found {len(notes)} notes in pw.js')
missing = [n for n in notes if f"'{n}': '" not in app]
ok(not missing, f'every pw.js note has a Chinese string {missing}')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp_tools); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}'
sha = hashlib.sha1(b'password').hexdigest().upper(); pre, suf = sha[:5], sha[5:]

with sync_playwright() as p:
    b = p.chromium.launch()
    for width in (1280, 390):
        tag = f'[{width}] '
        pg = b.new_page(viewport={'width': width, 'height': 900})
        errs, reqs, seen = [], [], []
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('request', lambda r: reqs.append(r.url))
        mode = {'v': 'found'}
        def make(mode, seen):
          def handle(route):
            req = route.request; seen.append((req.url, req.headers.get('add-padding'), req.headers.get('referer')))
            if mode['v'] == 'down': return route.abort()
            body = (f'{suf}:9545824\r\n0018A45C4D1DEF81644B54AB7F969B88D65:0\r\n' if mode['v'] == 'found' else '0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n')
            route.fulfill(status=200, content_type='text/plain', headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'}, body=body)
          return handle
        pg.route('https://api.pwnedpasswords.com/**', make(mode, seen))
        pg.goto(base + '/zh/tools/password-checker/'); pg.wait_for_load_state('networkidle')
        if width == 1280:
            ok(pg.evaluate('document.documentElement.lang') == 'zh-CN', 'lang is zh-CN')
            ok(pg.locator('h1').inner_text().strip() == '密码检查', 'h1')
            ok(pg.locator('link[rel="alternate"][hreflang="en"]').get_attribute('href').endswith('/tools/password-checker/'), 'hreflang en')
            crumbs = pg.locator('nav.breadcrumbs a')
            ok(crumbs.nth(0).get_attribute('href') == '/zh/' and crumbs.nth(0).inner_text() == '首页', 'breadcrumb home -> /zh/')
            side = pg.locator('.tool-sidebar').inner_text()
            ok(all(k in side for k in ['你的数据如何处理', '前 5 个字符', '有限查询']), 'sidebar data flow in Chinese')
            ok('本页发出的网络请求' in pg.locator('#netlog summary').inner_text(), 'network panel title in Chinese')
            links = pg.eval_on_selector_all('a[href]', 'as => as.map(a => a.getAttribute("href"))')
            ok(not [h for h in links if 'nordvpn' in h or 'nordpass' in h or 'ip-leak' in h or 'vpn' in h.lower()], 'no affiliate, VPN or IP-test links (rule)')
            ok(pg.locator('a[href="/zh/tools/text-redactor/"]').count() >= 1, 'links the Chinese redactor page')
            ld = pg.eval_on_selector_all('script[type="application/ld+json"]', 'els => els.map(e => e.textContent).join("\\n")')
            ok('"inLanguage": "zh-CN"' in ld and '密码检查' in ld, 'JSON-LD in Chinese')
            body = pg.locator('main').inner_text()
            ok('完全安全' not in body and '不代表安全' in body, 'honest wording')
        ok(pg.is_disabled('#breach'), tag + 'breach button disabled with an empty field')
        ok(pg.get_attribute('#pw', 'type') == 'password' and pg.get_attribute('#pw', 'autocomplete') == 'off', tag + 'field masked, autocomplete off')
        pg.fill('#pw', 'password')
        rows = pg.inner_text('#rows')
        ok('非常弱' in rows and '最常见的密码之一' in rows and '强度' in rows, tag + 'common password: Chinese label and note')
        ok(pg.locator('#summary').inner_text().strip() == '非常弱。这只是估算，也请做泄露检查。', tag + 'summary in Chinese')
        ok(pg.locator('#rows th').first.get_attribute('data-label') == '检查', tag + 'mobile cell labels in Chinese')
        ok(len(seen) == 0, tag + 'no network request while typing')
        pg.fill('#pw', 'Summer2024')
        rows = pg.inner_text('#rows')
        ok('年份很容易被猜到' in rows and '大写开头的单词' in rows and not re.search(r'[A-Za-z]{4,} [a-z]{3,}', pg.inner_text('#rows .why')), tag + 'pattern notes in Chinese: ' + pg.inner_text('#rows .why'))
        pg.fill('#pw', 'password')
        pg.click('#breach'); pg.wait_for_selector('#rows .pill:text-is("已找到")', timeout=5000)
        ok('9,545,824' in pg.inner_text('#rows') and '出现 9,545,824 次' in pg.inner_text('#rows'), tag + 'found count shown in Chinese')
        ok(len(seen) == 1 and seen[0][0] == f'https://api.pwnedpasswords.com/range/{pre}', tag + 'only the 5-char prefix was requested')
        ok(suf not in seen[0][0], tag + 'rest of the hash not sent')
        ok(seen[0][1] == 'true' and not seen[0][2], tag + 'padding requested, no referrer')
        ok(pg.locator('#netlog .netlog-marker').first.text_content().strip() == '你检查了一个密码', tag + 'marker row in Chinese')
        ok(pg.locator('#breach').inner_text().strip() == '检查已知泄露', tag + 'button label restored in Chinese')
        mode['v'] = 'none'; pg.fill('#pw', 'k7#Vq9!rTz2@Lm8%Xw4$')
        ok('非常强' in pg.inner_text('#rows') and '已找到' not in pg.inner_text('#rows'), tag + 'strong password rated, old breach row cleared')
        pg.click('#breach'); pg.wait_for_selector('#rows .pill:text-is("未找到")', timeout=5000)
        ok('这不代表它安全' in pg.inner_text('#rows'), tag + 'not-found caveat in Chinese')
        mode['v'] = 'down'; pg.fill('#pw', 'another one 123'); pg.click('#breach'); pg.wait_for_selector('#rows .pill:text-is("未检查")', timeout=15000)
        ok('没有得出任何结论' in pg.inner_text('#rows'), tag + 'service failure is not reported as safe')
        pg.check('#show'); ok(pg.get_attribute('#pw', 'type') == 'text', tag + 'show toggles')
        g1 = pg.inner_text('#gen-out'); pg.click('#gen-new'); g2 = pg.inner_text('#gen-out')
        ok(len(g1) == 20 and g1 != g2 and not re.search('[0OIl1]', g1), tag + 'generator works, no look-alikes')
        ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), tag + 'no horizontal scroll')
        ext = [u for u in reqs if not (u.startswith(base) or u.startswith('data:') or u.startswith('https://api.pwnedpasswords.com/range/'))]
        ok(not ext, tag + f'no other outside requests {ext}')
        real = [e for e in errs if e != 'Failed to load resource: net::ERR_FAILED']
        ok(not real and len(errs) - len(real) == 2, tag + f'no console or CSP errors apart from the two aborted mock requests {errs}')
        pg.fill('#pw', 'Summer2024'); pg.uncheck('#show')
        pg.screenshot(path=os.path.join(OUT, f'zhpw-{width}.png'), full_page=True)
        pg.close()

    # English page: same script, old strings.
    pg = b.new_page()
    pg.goto(base + '/tools/password-checker/'); pg.wait_for_load_state('networkidle')
    ok('zh-CN' in pg.eval_on_selector_all('link[rel=alternate][hreflang]', 'els => els.map(e => e.hreflang)'), 'English page links its Chinese version')
    pg.fill('#pw', 'Summer2024')
    ok(pg.locator('#summary').inner_text().strip().endswith('. This is an estimate. Use the breach check too.'), 'English summary unchanged')
    ok('A year is easy to guess. A capital word followed by digits is a very common pattern.' in pg.inner_text('#rows'), 'English notes unchanged, space-joined')
    ok(pg.locator('#rows th').first.get_attribute('data-label') == 'Check', 'English cell labels unchanged')
    ok(pg.locator('#breach').inner_text().strip() == 'Check known breaches', 'English button unchanged')
    b.close()

idx = open(os.path.join(ROOT, 'zh/tools/index.html'), encoding='utf-8').read()
ok('href="/zh/tools/password-checker/"' in idx and 'href="/tools/password-checker/"' not in idx, '/zh/tools/ links the Chinese page')
ok('/zh/tools/password-checker/</loc>' in open(os.path.join(ROOT, 'sitemap.xml')).read(), 'in sitemap')
srv.shutdown()
print('FAILED: %d' % len(fails) if fails else 'all passed')
raise SystemExit(1 if fails else 0)
