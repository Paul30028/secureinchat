# W17: Chinese website health check (/zh/tools/site-health-check/), served with the tools CSP from _headers.
# The endpoint is mocked with real English output from worker/sitecheck.mjs buildChecks, so the test sees exactly
# what the live endpoint sends. Checks Chinese rows, errors, copied report, batch report file, raw site data kept,
# only same-origin requests, no outside links, no VPN / IP-test links, no CSP errors, no overflow at 390px,
# and that the English page still shows English.
import http.server, threading, socketserver, os, re, sys, json, subprocess
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/zhsitecheck'
os.makedirs(OUT, exist_ok=True)
hdr = open(os.path.join(ROOT, '_headers')).read()
csp_zh = re.search(r'/zh/tools/site-health-check/\n\s*Content-Security-Policy: (.*)', hdr).group(1)
csp_tools = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', hdr).group(1)
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
ok(csp_zh == csp_tools, 'zh page uses the tools CSP')

JS = r"""
import { buildChecks, summarize } from './worker/sitecheck.mjs';
const H = (o) => ({ get: (k) => o[k.toLowerCase()] || null });
const f = { home: { ok: true, status: 200, url: 'https://example.com/', ms: 1500, headers: H({ 'content-type': 'text/html', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' }) },
  chain: [1, 2, 3, 4], html: { title: 'Example Domain', description: null, canonical: null, viewport: false, lang: 'en', h1: 1, noindex: false },
  httpProbe: { ok: true, status: 301, location: 'https://example.com/' }, robots: { ok: true, status: 404 }, sitemap: { ok: true, status: 404, where: '/sitemap.xml' } };
const rows = buildChecks(f);
console.log(JSON.stringify({ target: 'example.com', finalUrl: 'https://example.com/', checkedAt: '2026-10-31T00:00:00Z', summary: summarize(rows), checks: rows }));
"""
RESP = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', JS], cwd=os.path.join(HERE, '..')))
S = RESP['summary']

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp_zh); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}'
HAN = re.compile(r'[一-鿿]')
ENG3 = re.compile(r'[A-Za-z]{2,}[ ,.]+[A-Za-z]{2,}[ ,.]+[A-Za-z]{2,}')

def handle(route):
    u = route.request.url
    if 'url=bad' in u: route.fulfill(status=400, content_type='application/json', body=json.dumps({'error': 'Enter a domain name, not an IP address.'}))
    elif 'url=busy' in u: route.fulfill(status=429, content_type='application/json', body=json.dumps({'error': 'Too many checks from your network. Wait a minute and try again.'}))
    elif 'url=new' in u: route.fulfill(status=400, content_type='application/json', body=json.dumps({'error': 'A message the page does not know.'}))
    else: route.fulfill(status=200, content_type='application/json', body=json.dumps(RESP))

with sync_playwright() as p:
    b = p.chromium.launch()
    for width in (1280, 390):
        tag = f'[{width}] '
        ctx = b.new_context(viewport={'width': width, 'height': 900}, permissions=['clipboard-read', 'clipboard-write'])
        pg = ctx.new_page(); errs, reqs = [], []
        pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource: the server responded with a status of 4' not in m.text and errs.append(m.text))  # the mocked 400/429 answers are expected
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('request', lambda r: reqs.append(r.url))
        pg.route('**/tools/api/site-check*', handle)
        pg.goto(base + '/zh/tools/site-health-check/'); pg.wait_for_load_state('networkidle')
        if width == 1280:
            ok(pg.evaluate('document.documentElement.lang') == 'zh-CN', 'lang is zh-CN')
            ok(pg.locator('h1').inner_text().strip() == '网站健康检查', 'h1')
            ok(pg.locator('link[rel="alternate"][hreflang="en"]').get_attribute('href').endswith('/tools/site-health-check/'), 'hreflang en')
            ok(pg.locator('link[rel="alternate"][hreflang="zh-CN"]').get_attribute('href').endswith('/zh/tools/site-health-check/'), 'hreflang zh-CN')
            ok(pg.locator('link[rel="canonical"]').get_attribute('href') == 'https://secureinchat.com/zh/tools/site-health-check/', 'canonical')
            crumbs = pg.locator('nav.breadcrumbs a')
            ok(crumbs.nth(0).inner_text() == '首页' and crumbs.nth(0).get_attribute('href') == '/zh/', 'breadcrumb home -> /zh/')
            side = pg.locator('.tool-sidebar, [aria-labelledby="tool-v4-flow-h"]').first.inner_text()
            ok(all(k in side for k in ['你的数据如何处理', '会请求目标网站', '不保存也不记录']), 'sidebar data flow in Chinese')
            links = pg.eval_on_selector_all('a[href]', 'as => as.map(a => a.getAttribute("href"))')
            ok(not [h for h in links if 'nordvpn' in h or 'nordpass' in h or 'ip-leak' in h or 'vpn' in h.lower()], 'no affiliate, VPN or IP-test links (rule)')
            ok(pg.locator('#partner-slot').count() == 0, 'no partner block')
            outside = [h for h in links if h.startswith('http') and 'secureinchat.com' not in h and 'github.com/Paul30028/secureinchat' not in h]
            ok(not outside, f'no outside links {outside}')
            ok('/zh/tools/' in links, 'links the Chinese tools index')
            ld = open(os.path.join(ROOT, 'zh/tools/site-health-check/index.html'), encoding='utf-8').read()
            json.loads(re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', ld).group(1)); ok('"inLanguage": "zh-CN"' in ld, 'JSON-LD parses, in Chinese')
            scripts = pg.eval_on_selector_all('script[src]', 'els => els.map(e => e.getAttribute("src"))')
            ok(scripts.index('/tools/assets/sitecheck-zh.js') < scripts.index('/tools/assets/sitecheck-app.js'), 'translator loads before the app')
        ok(pg.inner_text('#summary').strip() == '输入地址后开始检查。', tag + 'idle summary in Chinese')
        api_before = [u for u in reqs if '/tools/api/' in u]
        pg.click('#sc-go')
        ok(pg.inner_text('#summary') == '请先输入网站地址。' and not [u for u in reqs if '/tools/api/' in u], tag + 'empty input refused in Chinese, no request')
        pg.fill('#sc-url', 'bad'); pg.click('#sc-go'); pg.wait_for_selector('#summary[data-tone="fail"]')
        ok(pg.inner_text('#summary') == '请输入域名，不要输入 IP 地址。', tag + 'endpoint error in Chinese: ' + pg.inner_text('#summary'))
        pg.fill('#sc-url', 'busy'); pg.click('#sc-go'); pg.wait_for_function("() => document.getElementById('summary').textContent.indexOf('一分钟') > -1")
        ok(True, tag + 'rate-limit message in Chinese')
        pg.fill('#sc-url', 'new'); pg.click('#sc-go'); pg.wait_for_function("() => document.getElementById('summary').textContent === 'A message the page does not know.'")
        ok(True, tag + 'unknown endpoint message shown unchanged')
        pg.fill('#sc-url', 'example.com'); pg.keyboard.press('Enter')
        pg.wait_for_selector(f'#rows tr:nth-child({len(RESP["checks"])})')
        names = pg.locator('#rows .c-name').all_inner_texts()
        ok(all(HAN.search(n) or n in ('HTTPS', 'HSTS', 'robots.txt', 'Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy') for n in names), tag + f'check names in Chinese {names}')
        whys = pg.locator('#rows .why').all_inner_texts()
        ok(len(whys) == len(RESP['checks']) and all(HAN.search(w) for w in whys), tag + 'every explanation in Chinese')
        vals = pg.locator('#rows .val').all_inner_texts()
        ok('Example Domain（14 个字符）' in vals and 'no-referrer' in vals and 'X-Frame-Options: DENY' in vals and 'en' in vals, tag + f'site data kept as sent {vals}')
        left = [v for v in vals + whys if ENG3.search(re.sub(r'strict-origin-when-cross-origin|Strict-Transport-Security|X-Frame-Options|Example Domain', '', v))]
        ok(not left, tag + f'no English sentences left {left}')
        pills = pg.locator('#rows .pill').all_inner_texts()
        ok(all(x in ('正常', '可改进', '有问题', '提示') for x in pills), tag + f'status labels in Chinese {pills}')
        ok(pg.inner_text('#summary') == f'example.com：{S["pass"]} 项正常，{S["warn"]} 项可改进，{S["fail"]} 项有问题。', tag + 'summary: ' + pg.inner_text('#summary'))
        ok(set(pg.eval_on_selector_all('#rows th, #rows td', 'els => els.map(e => e.dataset.label)')) == {'检查', '结果', '状态'}, tag + 'mobile table labels in Chinese')
        pg.click('#sc-copy'); pg.wait_for_function("() => document.getElementById('sc-copy').textContent === '已复制'")
        txt = pg.evaluate('navigator.clipboard.readText()')
        ok(txt.startswith('网站健康检查：example.com') and '[有问题] 移动端视口（viewport）：缺失' in txt and '/zh/tools/site-health-check/' in txt, tag + 'copied report in Chinese')
        pg.fill('#sb-list', 'a.com\nbad\nb.com\na.com')
        pg.click('#sb-go'); pg.wait_for_selector('#sb-rows tr:nth-child(3)'); pg.wait_for_selector('#sb-dl:not([disabled])')
        ok(pg.locator('#sb-rows tr').count() == 3, tag + 'batch: duplicates removed')
        ok('不要输入 IP 地址' in pg.locator('#sb-rows tr').nth(1).inner_text(), tag + 'batch per-site error in Chinese')
        ok(pg.inner_text('#sb-status') == '完成：已检查 3 个网站。', tag + 'batch status: ' + pg.inner_text('#sb-status'))
        first = pg.locator('#sb-rows tr').nth(0).inner_text()
        ok('项有问题' in first and '项正常' in first and '移动端视口' in first, tag + 'batch row in Chinese: ' + first.replace('\n', ' | '))
        with pg.expect_download() as d: pg.click('#sb-dl')
        html = open(d.value.path(), encoding='utf-8').read()
        ok(d.value.suggested_filename == 'website-health-report-zh.html' and '<html lang="zh-CN">' in html and '网站健康报告' in html and '移动端视口' in html and '<script' not in html, tag + 'report file in Chinese, no script')
        pg.fill('#sb-list', ' '.join(f'h{i}.com' for i in range(12))); pg.click('#sb-go'); pg.wait_for_selector('#sb-dl:not([disabled])')
        ok(pg.locator('#sb-rows tr').count() == 10 and '另有 2 个被忽略' in pg.inner_text('#sb-status'), tag + 'limit of 10 per run')
        ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), tag + 'no horizontal scroll')
        ext = [u for u in reqs if not (u.startswith(base) or u.startswith('data:') or u.startswith('blob:'))]
        ok(not ext, tag + f'only same-origin requests {ext}')
        ok(not errs, tag + f'no console or CSP errors {errs}')
        pg.screenshot(path=os.path.join(OUT, f'zhsitecheck-{width}.png'), full_page=True)
        ctx.close()

    # English page: same scripts, English wording unchanged, Chinese translator not loaded.
    ctx = b.new_context(permissions=['clipboard-read', 'clipboard-write']); pg = ctx.new_page(); pg.route('**/tools/api/site-check*', handle)
    pg.goto(base + '/tools/site-health-check/'); pg.wait_for_load_state('networkidle')
    ok('zh-CN' in pg.eval_on_selector_all('link[rel=alternate][hreflang]', 'els => els.map(e => e.hreflang)'), 'English page links its Chinese version')
    ok(pg.evaluate('typeof window.SCZH') == 'undefined', 'English page does not load the translator')
    pg.fill('#sc-url', 'example.com'); pg.keyboard.press('Enter'); pg.wait_for_selector(f'#rows tr:nth-child({len(RESP["checks"])})')
    names_en = pg.locator('#rows .c-name').all_inner_texts()
    ok(names_en == [c['label'] for c in RESP['checks']], 'English names unchanged')
    ok(pg.inner_text('#summary') == f'example.com: {S["pass"]} OK, {S["warn"]} to improve, {S["fail"]} problem{"" if S["fail"] == 1 else "s"}.', 'English summary unchanged')
    pg.fill('#sb-list', 'a.com'); pg.click('#sb-go'); pg.wait_for_selector('#sb-dl:not([disabled])')
    ok(pg.inner_text('#sb-status') == 'Done: 1 site checked.', 'English batch status unchanged')
    b.close()

idx = open(os.path.join(ROOT, 'zh/tools/index.html'), encoding='utf-8').read()
ok('href="/zh/tools/site-health-check/"' in idx and 'href="/tools/site-health-check/"' not in idx, '/zh/tools/ links the Chinese page')
ok('/zh/tools/site-health-check/</loc>' in open(os.path.join(ROOT, 'sitemap.xml')).read(), 'in sitemap')
srv.shutdown()
print('FAILED: %d' % len(fails) if fails else 'all passed')
raise SystemExit(1 if fails else 0)
