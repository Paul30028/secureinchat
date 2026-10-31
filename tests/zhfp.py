# W16: Chinese browser fingerprint test (/zh/tools/browser-fingerprint-test/), served with the tools CSP
# from _headers. Checks the Chinese wording for every fpcore.js check, zero requests while running, no
# outside links except the GitHub source in the net-log footer, no affiliate / VPN / IP-test links, no
# console or CSP errors, no horizontal overflow at 390px, and that the English page is unchanged.
import http.server, threading, socketserver, os, re, sys, json
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/zhfp'
os.makedirs(OUT, exist_ok=True)
hdr = open(os.path.join(ROOT, '_headers')).read()
csp_zh = (re.search(r'/zh/tools/\*\n\s*Content-Security-Policy: (.*)', hdr)
          or re.search(r'/zh/tools/browser-fingerprint-test/\n\s*Content-Security-Policy: (.*)', hdr)).group(1)
csp_tools = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', hdr).group(1)
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
ok(csp_zh == csp_tools, 'zh page uses the tools CSP')

# Every fpcore.js check id must appear in fp.js, and fp.js must carry a Chinese name for each.
app = open(os.path.join(ROOT, 'tools/assets/fp.js'), encoding='utf-8').read()
ids = ['canvas', 'webgl', 'gpc', 'dnt', 'cookies', 'signals']
ok(all(f"'{i}'" in app or f'"{i}"' in app for i in ids), 'fp.js mentions every fpcore check id')
zh_names = ['画布', '显卡', '全局隐私控制', '不跟踪', 'Cookie 开关', '浏览器和设备']
ok(all(v in app for v in zh_names), 'fp.js has Chinese names for every check')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp_zh); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}'

HAN = re.compile(r'[一-鿿]')
GITHUB = 'https://github.com/Paul30028/secureinchat'

with sync_playwright() as p:
    b = p.chromium.launch()
    for width in (1280, 390):
        tag = f'[{width}] '
        ctx = b.new_context(viewport={'width': width, 'height': 900})
        pg = ctx.new_page()
        errs, reqs = [], []
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('request', lambda r: reqs.append(r.url))
        pg.goto(base + '/zh/tools/browser-fingerprint-test/'); pg.wait_for_load_state('networkidle')
        if width == 1280:
            ok(pg.evaluate('document.documentElement.lang') == 'zh-CN', 'lang is zh-CN')
            ok(pg.locator('h1').inner_text().strip() == '浏览器特征检查', 'h1')
            ok(pg.locator('link[rel="alternate"][hreflang="en"]').get_attribute('href').endswith('/tools/browser-fingerprint-test/'), 'hreflang en')
            ok(pg.locator('link[rel="alternate"][hreflang="zh-CN"]').get_attribute('href').endswith('/zh/tools/browser-fingerprint-test/'), 'hreflang zh-CN')
            ok(pg.locator('link[rel="canonical"]').get_attribute('href') == 'https://secureinchat.com/zh/tools/browser-fingerprint-test/', 'canonical')
            crumbs = pg.locator('nav.breadcrumbs a')
            ok(crumbs.nth(0).inner_text() == '首页' and crumbs.nth(0).get_attribute('href') == '/zh/', 'breadcrumb home -> /zh/')
            side = pg.locator('.tool-sidebar').inner_text()
            ok(all(k in side for k in ['你的数据如何处理', '本地处理', '无']), 'sidebar data flow in Chinese')
            links = pg.eval_on_selector_all('a[href]', 'as => as.map(a => a.getAttribute("href"))')
            ok(not [h for h in links if 'nordvpn' in h or 'nordpass' in h or 'ip-leak' in h or 'vpn' in h.lower()], 'no affiliate, VPN or IP-test links (rule)')
            ok(pg.locator('#partner-slot').count() == 0, 'no partner block')
            outside = [h for h in links if h.startswith('http') and 'secureinchat.com' not in h]
            ok(set(outside).issubset({GITHUB}), f'only the GitHub source link is outside {outside}')
            zh_tool_links = [h for h in links if h.startswith('/zh/tools/') and h != '/zh/tools/browser-fingerprint-test/']
            ok(bool(zh_tool_links), f'links at least one Chinese tool {zh_tool_links}')
            ld = pg.eval_on_selector_all('script[type="application/ld+json"]', 'els => els.map(e => e.textContent).join("\\n")')
            ok('"inLanguage": "zh-CN"' in ld and '浏览器特征检查' in ld, 'JSON-LD in Chinese')
            json.loads(re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', open(os.path.join(ROOT, 'zh/tools/browser-fingerprint-test/index.html'), encoding='utf-8').read()).group(1))
            ok(True, 'JSON-LD parses')
        ok(pg.locator('#summary').inner_text().strip() == '运行测试，看看你的结果。', tag + 'idle summary in Chinese')
        ok(pg.inner_text('#run') == '运行测试', tag + 'run button in Chinese')
        pg.click('#run')
        pg.wait_for_function("() => document.querySelectorAll('#rows tr').length === 6", timeout=10000)
        names = pg.locator('#rows .c-name').all_inner_texts()
        ok(names == ['画布', '显卡', '全局隐私控制', '不跟踪', 'Cookie 开关', '浏览器和设备'], tag + f'check names in Chinese: {names}')
        descs = pg.locator('#rows .c-desc').all_inner_texts()
        ok(all(HAN.search(d) for d in descs), tag + 'descriptions in Chinese')
        whys = pg.locator('#rows .why').all_inner_texts()
        ok(all(HAN.search(w) for w in whys), tag + 'explanations in Chinese')
        pills = pg.locator('#rows .pill').all_inner_texts()
        ok(all(HAN.search(p) for p in pills), tag + f'status labels in Chinese {pills}')
        vals = pg.locator('#rows .val').all_inner_texts()
        english_prefix = [v for v in vals if re.search(r'^(User agent|Platform|Languages|Time zone|Screen|CPU threads|Device memory|Touch points):', v)]
        ok(not english_prefix, tag + f'no English prefixes in the signal values {english_prefix}')
        summary = pg.locator('#summary').inner_text().strip()
        ok(HAN.search(summary) and ('项' in summary or '没有' in summary), tag + 'summary in Chinese: ' + summary)
        dl = pg.eval_on_selector_all('#rows th, #rows td', 'els => els.map(e => e.dataset.label)')
        ok(set(dl) == {'检查', '结果', '状态'}, tag + f'mobile table labels in Chinese {set(dl)}')
        ok(pg.inner_text('#run') == '再运行一次', tag + 'run again button in Chinese')
        ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), tag + 'no horizontal scroll')
        ext = [u for u in reqs if not (u.startswith(base) or u.startswith('data:'))]
        ok(not ext, tag + f'no outside requests {ext}')
        ok(not errs, tag + f'no console or CSP errors {errs}')
        pg.screenshot(path=os.path.join(OUT, f'zhfp-{width}.png'), full_page=True)
        ctx.close()

    # Requests strictly while the test runs: zero.
    pg = b.new_page(); pg.goto(base + '/zh/tools/browser-fingerprint-test/'); pg.wait_for_load_state('networkidle')
    r2 = []; pg.on('request', lambda r: r2.append(r.url))
    pg.click('#run')
    pg.wait_for_function("() => document.querySelectorAll('#rows tr').length === 6", timeout=10000)
    pg.wait_for_timeout(300)
    ok(not r2, f'zero requests while running the test {r2}')
    pg.close()

    # English page: same core, same fp.js, old strings.
    pg = b.new_page()
    pg.goto(base + '/tools/browser-fingerprint-test/'); pg.wait_for_load_state('networkidle')
    ok('zh-CN' in pg.eval_on_selector_all('link[rel=alternate][hreflang]', 'els => els.map(e => e.hreflang)'), 'English page links its Chinese version')
    ok(pg.locator('#summary').inner_text().strip() == 'Run the test to see your result.', 'English idle summary unchanged')
    ok(pg.inner_text('#run') == 'Run test', 'English run button unchanged')
    pg.click('#run')
    pg.wait_for_function("() => document.querySelectorAll('#rows tr').length === 6", timeout=10000)
    names_en = pg.locator('#rows .c-name').all_inner_texts()
    ok(names_en == ['Canvas', 'Graphics card', 'Global Privacy Control', 'Do Not Track', 'Cookies', 'Browser and device'], 'English names unchanged: ' + str(names_en))
    ok(pg.inner_text('#run') == 'Run again', 'English run again button unchanged')
    ok(set(pg.eval_on_selector_all('#rows th, #rows td', 'els => els.map(e => e.dataset.label)')) == {'Check', 'Result', 'Status'}, 'English table labels unchanged')
    b.close()

idx = open(os.path.join(ROOT, 'zh/tools/index.html'), encoding='utf-8').read()
ok('href="/zh/tools/browser-fingerprint-test/"' in idx and 'href="/tools/browser-fingerprint-test/"' not in idx, '/zh/tools/ links the Chinese page')
ok('/zh/tools/browser-fingerprint-test/</loc>' in open(os.path.join(ROOT, 'sitemap.xml')).read(), 'in sitemap')
srv.shutdown()
print('FAILED: %d' % len(fails) if fails else 'all passed')
raise SystemExit(1 if fails else 0)
