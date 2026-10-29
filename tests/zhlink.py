# W12: Chinese link checker (/zh/tools/link-checker/), served with the CSP from _headers for that path.
# Checks that every link.js label has Chinese wording, findings / statuses / summaries / errors in Chinese,
# the three English detail sentences rewritten, clean link identical to link.js, no requests at all while
# checking, no affiliate / VPN / IP-test links, mobile table labels, and that the English page is unchanged.
import http.server, threading, socketserver, os, re, sys, json, subprocess
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/zhlink'
os.makedirs(OUT, exist_ok=True)
hdr = open(os.path.join(ROOT, '_headers')).read()
csp_zh = re.search(r'/zh/tools/link-checker/\n\s*Content-Security-Policy: (.*)', hdr).group(1)
csp_tools = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', hdr).group(1)
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
ok(csp_zh == csp_tools, 'zh page uses the tools CSP')

LK = os.path.abspath(os.path.join(ROOT, 'tools/assets/link.js'))
ids = json.loads(subprocess.check_output(['node', '-e', "console.log(JSON.stringify(Object.keys(require(process.argv[1]).LABELS)))", LK]))
app = open(os.path.join(ROOT, 'tools/assets/link-app.js'), encoding='utf-8').read()
ok(len(ids) == 11, f'link.js has 11 labels {ids}')
ok(all(re.search(r'\b' + i + r": \['[^']*[一-鿿][^']*', '[^']*[一-鿿]", app) for i in ids), 'every link.js label has Chinese name and explanation')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp_zh); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}'

PHISH = 'https://paypal.com@secure-paypal.example.net/login?utm_source=sms&fbclid=x&id=7'
HAN = re.compile(r'[一-鿿]')

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
        pg.goto(base + '/zh/tools/link-checker/'); pg.wait_for_load_state('networkidle')
        if width == 1280:
            ok(pg.evaluate('document.documentElement.lang') == 'zh-CN', 'lang is zh-CN')
            ok(pg.locator('h1').inner_text().strip() == '链接检查器', 'h1')
            ok(pg.locator('link[rel="alternate"][hreflang="en"]').get_attribute('href').endswith('/tools/link-checker/'), 'hreflang en')
            ok(pg.locator('link[rel="canonical"]').get_attribute('href') == 'https://secureinchat.com/zh/tools/link-checker/', 'canonical')
            crumbs = pg.locator('nav.breadcrumbs a')
            ok(crumbs.nth(0).get_attribute('href') == '/zh/' and crumbs.nth(0).inner_text() == '首页', 'breadcrumb home -> /zh/')
            side = pg.locator('.tool-sidebar').inner_text()
            ok(all(k in side for k in ['你的数据如何处理', '本地处理', '无']), 'sidebar data flow in Chinese')
            links = pg.eval_on_selector_all('a[href]', 'as => as.map(a => a.getAttribute("href"))')
            ok(not [h for h in links if 'nordvpn' in h or 'nordpass' in h or 'ip-leak' in h or 'vpn' in h.lower()], 'no affiliate, VPN or IP-test links (rule)')
            ok(pg.locator('#partner-slot').count() == 0, 'no partner block')
            ok(pg.locator('a[href="/zh/tools/text-redactor/"]').count() >= 1, 'links the Chinese text redactor')
            outside = [h for h in links if h.startswith('http') and 'secureinchat.com' not in h]
            ok(not outside, f'no outside links {outside}')
            ld = pg.eval_on_selector_all('script[type="application/ld+json"]', 'els => els.map(e => e.textContent).join("\\n")')
            ok('"inLanguage": "zh-CN"' in ld and '链接检查器' in ld, 'JSON-LD in Chinese')
            json.loads(re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', open(os.path.join(ROOT, 'zh/tools/link-checker/index.html'), encoding='utf-8').read()).group(1))
            ok(True, 'JSON-LD parses')
        ok(pg.locator('#summary').inner_text().strip() == '粘贴一个链接来检查。', tag + 'idle summary in Chinese')
        ok(pg.is_disabled('#lk-copy') and pg.inner_text('#lk-copy') == '复制干净链接', tag + 'copy button disabled, Chinese')
        pg.fill('#lk-in', PHISH); pg.wait_for_timeout(150)
        expect = json.loads(subprocess.check_output(['node', '-e', "console.log(JSON.stringify(require(process.argv[1]).check(process.argv[2])))", LK, PHISH]))
        ok(pg.input_value('#lk-out') == expect['clean'] == 'https://secure-paypal.example.net/login?id=7', tag + 'clean link same as link.js')
        names = pg.locator('#rows .c-name').all_inner_texts()
        ok(names == ['追踪参数', '网址里 @ 前面有文字', '知名品牌名出现在别人的网站上'], tag + f'finding names in Chinese, link.js order {names}')
        why = pg.locator('#rows .why').all_inner_texts()
        ok(len(why) == 3 and all(HAN.search(w) for w in why), tag + 'explanations in Chinese')
        vals = pg.locator('#rows .val').all_inner_texts()
        ok(vals[2] == '出现了 paypal，但打开的网站是 example.net', tag + f'brand detail rewritten: {vals[2]}')
        ok(vals[0] == 'utm_source, fbclid' and vals[1] == 'paypal.com@secure-paypal.example.net', tag + 'raw details unchanged')
        pills = pg.locator('#rows .pill').all_inner_texts()
        ok(pills == ['需要核对', '危险迹象', '危险迹象'], tag + f'statuses in Chinese {pills}')
        ok(pg.locator('#summary').inner_text().strip() == '2 个危险迹象，已去掉 2 个追踪参数。', tag + 'summary: ' + pg.locator('#summary').inner_text())
        ok(pg.get_attribute('#summary', 'data-tone') == 'fail', tag + 'tone fail')
        ok(pg.inner_text('#lk-site').startswith('secure-paypal.example.net'), tag + 'site shown')
        dl = pg.eval_on_selector_all('#rows th, #rows td', 'els => els.map(e => e.dataset.label)')
        ok(set(dl) == {'检查项', '结果', '状态'}, tag + f'mobile table labels in Chinese {set(dl)}')
        # The other two English detail sentences in link.js.
        pg.fill('#lk-in', 'http://a.b.c.d.example.com/' + 'x' * 220); pg.wait_for_timeout(100)
        vals = pg.locator('#rows .val').all_inner_texts()
        ok('6 段：a.b.c.d.example.com' in vals and any(re.fullmatch(r'\d+ 个字符', v) for v in vals), tag + f'subdomain and length details rewritten')
        ok(pg.locator('#summary').inner_text().strip() == '2 处需要核对。', tag + 'warn-only summary: ' + pg.locator('#summary').inner_text())
        pg.fill('#lk-in', 'javascript:alert(1)'); pg.wait_for_timeout(100)
        ok(pg.locator('#summary').inner_text().strip() == '这是一个脚本链接（javascript:），不是网页。不要打开它。', tag + 'script link error')
        pg.fill('#lk-in', 'ftp://example.com/file'); pg.wait_for_timeout(100)
        ok(pg.locator('#summary').inner_text().strip().startswith('这是一个 ftp 链接，不是网页。'), tag + 'scheme error')
        pg.fill('#lk-in', 'mailto:paypal@evil.example'); pg.wait_for_timeout(100)
        ok(pg.locator('#summary').inner_text().strip().startswith('这是一个 mailto 链接，不是网页。'), tag + 'mailto scheme error (W14)')
        pg.fill('#lk-in', 'https://www.wikipedia.org/'); pg.wait_for_timeout(100)
        ok(pg.locator('#summary').inner_text().strip().startswith('没有发现危险迹象。这不能证明链接安全'), tag + 'clean summary')
        ok(pg.get_attribute('#summary', 'data-tone') == 'ok', tag + 'tone ok')
        all_text = pg.evaluate('''() => { const s = window.LINK_CHECKER; return Object.keys(LK.LABELS).map(id => s.label(id).join(' ')).join(' '); }''')
        ok(not re.search(r'\b[A-Za-z]{3,} [a-z]{3,}\b', all_text.replace('paypal.com@example.net', '').replace('example.net', '')), tag + 'no English sentences in labels')
        pg.click('#lk-clear')
        ok(pg.input_value('#lk-in') == '' and pg.input_value('#lk-out') == '' and pg.locator('#rows tr').count() == 0, tag + 'clear empties everything')
        pg.fill('#lk-in', PHISH); pg.reload(); pg.wait_for_load_state('networkidle')
        ok(pg.locator('#rows tr').count() == 0, tag + 'reload keeps nothing')
        ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), tag + 'no horizontal scroll')
        ext = [u for u in reqs if not (u.startswith(base) or u.startswith('data:'))]
        ok(not ext, tag + f'no outside requests {ext}')
        ok(not errs, tag + f'no console or CSP errors {errs}')
        pg.fill('#lk-in', PHISH); pg.wait_for_timeout(100)
        pg.screenshot(path=os.path.join(OUT, f'zhlink-{width}.png'), full_page=True)
        ctx.close()

    # Requests strictly while typing: none at all.
    pg = b.new_page(); pg.goto(base + '/zh/tools/link-checker/'); pg.wait_for_load_state('networkidle')
    r2 = []; pg.on('request', lambda r: r2.append(r.url))
    pg.fill('#lk-in', PHISH); pg.wait_for_timeout(300); pg.click('#lk-clear')
    ok(not r2, f'zero requests while checking {r2}')
    pg.close()

    # English page: same script, old strings.
    pg = b.new_page()
    pg.goto(base + '/tools/link-checker/'); pg.wait_for_load_state('networkidle')
    ok('zh-CN' in pg.eval_on_selector_all('link[rel=alternate][hreflang]', 'els => els.map(e => e.hreflang)'), 'English page links its Chinese version')
    ok(pg.locator('#summary').inner_text().strip() == 'Paste a link to check it.', 'English idle summary unchanged')
    pg.fill('#lk-in', PHISH); pg.wait_for_timeout(150)
    ok(pg.locator('#summary').inner_text().strip() == '2 warning signs, 2 tracking parameters removed.', 'English summary unchanged: ' + pg.locator('#summary').inner_text())
    ok(pg.locator('#rows .c-name').all_inner_texts() == ['Tracking parameters', 'Text before an @ in the address', 'Brand name on a different site'], 'English names unchanged')
    ok(pg.locator('#rows .val').all_inner_texts()[2] == 'paypal appears, but the site is example.net', 'English brand detail unchanged')
    ok(pg.locator('#rows .pill').all_inner_texts() == ['Check this', 'Warning sign', 'Warning sign'], 'English statuses unchanged')
    ok(set(pg.eval_on_selector_all('#rows th, #rows td', 'els => els.map(e => e.dataset.label)')) == {'Check', 'Result', 'Status'}, 'English table labels unchanged')
    b.close()

idx = open(os.path.join(ROOT, 'zh/tools/index.html'), encoding='utf-8').read()
ok('href="/zh/tools/link-checker/"' in idx and 'href="/tools/link-checker/"' not in idx, '/zh/tools/ links the Chinese page')
acct = open(os.path.join(ROOT, 'zh/tools/account-checkup/index.html'), encoding='utf-8').read()
ok('href="/zh/tools/link-checker/"' in acct, 'Chinese account checkup links the Chinese link checker')
ok('/zh/tools/link-checker/</loc>' in open(os.path.join(ROOT, 'sitemap.xml')).read(), 'in sitemap')
srv.shutdown()
print('FAILED: %d' % len(fails) if fails else 'all passed')
raise SystemExit(1 if fails else 0)
