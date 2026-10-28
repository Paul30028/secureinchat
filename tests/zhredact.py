# W8: Chinese text redactor page (/zh/tools/text-redactor/), served with the CSP from _headers for
# that path. Checks the Chinese interface, the new cn_mobile / cn_id rules in the page, the round trip,
# that redacting makes no request, and that the English page still reads in English.
import http.server, threading, socketserver, os, re, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/zhredact'
os.makedirs(OUT, exist_ok=True)
hdr = open(os.path.join(ROOT, '_headers')).read()
csp_zh = re.search(r'/zh/tools/text-redactor/\n\s*Content-Security-Policy: (.*)', hdr).group(1)
csp_tools = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', hdr).group(1)
assert csp_zh == csp_tools, 'zh tool page must use the tools CSP'
sm = open(os.path.join(ROOT, 'sitemap.xml')).read()

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp_tools); super().end_headers()
    def log_message(s, *a): pass

srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}'
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

ok('/zh/tools/text-redactor/</loc>' in sm, 'sitemap lists the page')
SAMPLE = '张三 手机 13812345678，身份证 11010519491231002X，邮箱 zhang@example.com，座机 010-12345678'
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 800})
    errs, reqs, csp = [], [], []
    pg.on('console', lambda m: (m.type == 'error' and errs.append(m.text)) or ('Content Security Policy' in m.text and csp.append(m.text)))
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('request', lambda r: reqs.append(r.url))
    pg.goto(base + '/zh/tools/text-redactor/'); pg.wait_for_load_state('networkidle')
    ok(pg.evaluate('document.documentElement.lang') == 'zh-CN', 'lang is zh-CN')
    ok(pg.locator('h1').inner_text().strip() == '文本脱敏', 'h1')
    ok(pg.locator('link[rel="alternate"][hreflang="en"]').get_attribute('href').endswith('/tools/text-redactor/'), 'hreflang en')
    crumbs = pg.locator('nav.breadcrumbs a')
    ok(crumbs.nth(0).get_attribute('href') == '/zh/' and crumbs.nth(0).inner_text() == '首页', 'breadcrumb home -> /zh/')
    side = pg.locator('.tool-sidebar').inner_text()
    ok(all(k in side for k in ['你的数据如何处理', '你粘贴的文本', '本地处理']), 'sidebar data flow in Chinese')
    ok('本页发出的网络请求' in pg.locator('#netlog summary').inner_text(), 'network panel title in Chinese')
    ok(pg.locator('#summary').inner_text().strip() == '粘贴文本开始脱敏。', 'idle summary')
    body = pg.locator('main').inner_text()
    ok('规则匹配会漏掉不常见的写法' in body and '完全安全' not in body, 'honest wording, no "完全安全"')
    links = pg.eval_on_selector_all('main a[href]', 'as => as.map(a => a.getAttribute("href"))')
    ok(not [h for h in links if 'ip-leak' in h or 'vpn' in h.lower()], 'no IP leak / VPN links on a Chinese page (rule)')
    n0 = pg.evaluate("performance.getEntriesByType('resource').length")
    pg.fill('#rd-terms', '张三')
    pg.fill('#rd-in', SAMPLE)
    out = pg.input_value('#rd-out')
    ok(out == '[NAME_1] 手机 [PHONE_1]，身份证 [ID_NUMBER_1]，邮箱 [EMAIL_1]，座机 010-12345678', f'redacted output {out}')
    rows = pg.locator('#rows').inner_text()
    ok(all(k in rows for k in ['手机号（中国大陆）', '身份证号', '邮箱地址', '你自己的词', '已替换']), 'result rows in Chinese')
    ok(pg.locator('#summary').inner_text().startswith('已替换 4 处。'), 'summary count')
    ok(pg.locator('#netlog .netlog-marker').text_content().strip() == '你运行了脱敏', 'marker row in Chinese')
    pg.fill('#rd-reply', '请回电 [PHONE_1]，并核对 【ID_NUMBER_1】。')
    ok(pg.input_value('#rd-restored') == '请回电 13812345678，并核对 11010519491231002X。', 'restore with full-width brackets')
    ok(pg.locator('#rd-restore-status').inner_text().strip() == '已换回 2 个占位符。', 'restore status in Chinese')
    pg.uncheck('#rule-cn_id')
    ok('11010519491231002X' in pg.input_value('#rd-out'), 'ID rule can be switched off')
    pg.check('#rule-cn_id')
    pg.fill('#rd-in', '身份证 110105194912310021')
    ok(pg.input_value('#rd-out') == '身份证 110105194912310021', 'wrong check digit left alone')
    ok(pg.evaluate("performance.getEntriesByType('resource').length") == n0, 'no requests while redacting')
    pg.click('#rd-clear')
    ok(pg.input_value('#rd-in') == '' and pg.input_value('#rd-reply') == '', 'clear empties the boxes')
    ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no horizontal scroll at 390 px')
    ext = [u for u in reqs if not (u.startswith(base) or u.startswith('data:'))]
    ok(not ext, f'no outside requests {ext}')
    ok(not csp, f'no CSP violations {csp}')
    ok(not errs, f'no console errors {errs}')
    pg.fill('#rd-terms', '张三'); pg.fill('#rd-in', SAMPLE)
    pg.screenshot(path=os.path.join(OUT, 'zh-redactor-390.png'), full_page=True)
    pg.set_viewport_size({'width': 1280, 'height': 900})
    pg.screenshot(path=os.path.join(OUT, 'zh-redactor-1280.png'), full_page=True)
    pg.close()

    pg = b.new_page()
    pg.goto(base + '/tools/text-redactor/'); pg.wait_for_load_state('networkidle')
    ok(pg.evaluate('document.documentElement.lang') == 'en', 'English page lang en')
    ok(pg.locator('#summary').inner_text().strip() == 'Paste text to redact it.', 'English idle summary unchanged')
    pg.fill('#rd-in', 'mail bob@example.com')
    ok(pg.locator('#summary').inner_text().strip() == '1 item replaced. Read the output before you share it: names and addresses are not detected automatically.', 'English summary unchanged')
    ok(pg.locator('#netlog .netlog-marker').text_content().strip() == 'You ran the redactor', 'English marker unchanged')
    ok(pg.locator('#rule-cn_mobile').count() == 1 and pg.locator('#rule-cn_id').count() == 1, 'English page has switches for the new rules')
    pg.goto(base + '/zh/tools/'); pg.wait_for_load_state('networkidle')
    ok(pg.locator('a.tool-catalogue-action[href="/zh/tools/text-redactor/"]').count() == 1, '/zh/tools/ links to the Chinese redactor')
    pg.goto(base + '/zh/tools/photo-metadata-remover/')
    ok(pg.locator('main a[href="/tools/ip-leak-test/"]').count() == 0, 'Chinese photo page no longer links the IP leak test')
    b.close()
srv.shutdown()
print('screenshots:', OUT)
print('FAILED: %d' % len(fails) if fails else 'all passed')
raise SystemExit(1 if fails else 0)
