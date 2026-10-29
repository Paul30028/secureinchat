# W11: Chinese account security checkup (/zh/tools/account-checkup/), served with the CSP from _headers for that path.
# Checks the Chinese interface (every account.js item has Chinese wording), result headlines and the "do next"
# list in Chinese, the copied report (Chinese, checklist state only), that the page makes no requests at all
# beyond its own files, no affiliate / VPN / IP-test links, reload clears answers, and that the English page
# still reads in English.
import http.server, threading, socketserver, os, re, sys, json, subprocess
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/zhacct'
os.makedirs(OUT, exist_ok=True)
hdr = open(os.path.join(ROOT, '_headers')).read()
csp_zh = re.search(r'/zh/tools/account-checkup/\n\s*Content-Security-Policy: (.*)', hdr).group(1)
csp_tools = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', hdr).group(1)
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
ok(csp_zh == csp_tools, 'zh page uses the tools CSP')

ids = json.loads(subprocess.check_output(['node', '-e', "console.log(JSON.stringify(require(process.argv[1]).ITEMS.map(i => i.id)))", os.path.abspath(os.path.join(ROOT, 'tools/assets/account.js'))]))
app = open(os.path.join(ROOT, 'tools/assets/account-app.js'), encoding='utf-8').read()
ok(len(ids) == 8, f'account.js has 8 items {ids}')
ok(all(re.search(r'\b' + i + r": \{ name: '[^']*[一-鿿]", app) for i in ids), 'every account.js item has Chinese wording')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp_zh); super().end_headers()
    def log_message(s, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}'

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
        pg.goto(base + '/zh/tools/account-checkup/'); pg.wait_for_load_state('networkidle')
        if width == 1280:
            ok(pg.evaluate('document.documentElement.lang') == 'zh-CN', 'lang is zh-CN')
            ok(pg.locator('h1').inner_text().strip() == '账号安全自查', 'h1')
            ok(pg.locator('link[rel="alternate"][hreflang="en"]').get_attribute('href').endswith('/tools/account-checkup/'), 'hreflang en')
            ok(pg.locator('link[rel="canonical"]').get_attribute('href') == 'https://secureinchat.com/zh/tools/account-checkup/', 'canonical')
            crumbs = pg.locator('nav.breadcrumbs a')
            ok(crumbs.nth(0).get_attribute('href') == '/zh/' and crumbs.nth(0).inner_text() == '首页', 'breadcrumb home -> /zh/')
            side = pg.locator('.tool-sidebar').inner_text()
            ok(all(k in side for k in ['你的数据如何处理', '本地清单', '无']), 'sidebar data flow in Chinese')
            links = pg.eval_on_selector_all('a[href]', 'as => as.map(a => a.getAttribute("href"))')
            ok(not [h for h in links if 'nordvpn' in h or 'nordpass' in h or 'ip-leak' in h or 'vpn' in h.lower()], 'no affiliate, VPN or IP-test links (rule)')
            ok(pg.locator('#partner-slot').count() == 0, 'no partner block')
            ok(pg.locator('a[href="/zh/tools/password-checker/"]').count() >= 1, 'links the Chinese password checker')
            # Every outside link in the checks is an official page and is labelled as English.
            outs = pg.eval_on_selector_all('#ac-form a[href^="http"]', 'as => as.map(a => [a.href, (a.nextSibling && a.nextSibling.textContent || "").slice(0, 4)])')
            src = [o for o in outs if o[0].startswith('https://support.') or 'haveibeenpwned' in o[0]]
            ok(src and all(o[1].startswith('（英文）') for o in src), f'source links labelled （英文） ({len(src)})')
            en_links = set(re.findall(r'href="(https://[^"]+)"', open(os.path.join(ROOT, 'tools/account-checkup/index.html'), encoding='utf-8').read()))
            zh_links = set(re.findall(r'href="(https://[^"]+)"', pg.content()))
            extra = {u.replace('&amp;', '&') for u in zh_links} - {u.replace('&amp;', '&') for u in en_links} - {'https://secureinchat.com/zh/tools/account-checkup/', 'https://secureinchat.com/tools/account-checkup/'}
            ok(not extra, f'no outside link the English page does not already have {extra}')
            ld = pg.eval_on_selector_all('script[type="application/ld+json"]', 'els => els.map(e => e.textContent).join("\\n")')
            ok('"inLanguage": "zh-CN"' in ld and '账号安全自查' in ld, 'JSON-LD in Chinese')
            json.loads(re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', open(os.path.join(ROOT, 'zh/tools/account-checkup/index.html'), encoding='utf-8').read()).group(1))
            ok(True, 'JSON-LD parses')
            ok(pg.locator('.ac-item').count() == 8, 'eight checks')
        ok(pg.locator('#summary').inner_text().strip() == '回答上面的问题，看看先做什么。', tag + 'idle headline in Chinese')
        ok(pg.is_hidden('#ac-copy') and pg.is_hidden('#ac-next'), tag + 'copy and next hidden before any answer')
        pg.check('#ac-mfa input[value="no"]'); pg.check('#ac-unique input[value="unsure"]'); pg.check('#ac-recovery input[value="yes"]')
        ok(pg.locator('#summary').inner_text().strip() == '已完成 1 / 8 项，1 项待做，1 项待确认，5 项未回答。', tag + 'mixed headline: ' + pg.locator('#summary').inner_text())
        ok(pg.get_attribute('#summary', 'data-tone') == 'fail', tag + 'tone fail')
        nxt = pg.locator('#ac-next-list li').all_inner_texts()
        ok(nxt == ['开启两步验证', '给这个账号设一个不与别处共用的密码（待确认）'], tag + f'do-next list in Chinese, "no" first {nxt}')
        ok(pg.locator('#ac-next-list a').first.get_attribute('href') == '#ac-mfa', tag + 'next item links its check')
        rep = pg.evaluate('ACCOUNT_CHECKUP.report(ACCT.summarize(ACCOUNT_CHECKUP.answers()), "2026-10-29")')
        ok(rep.startswith('账号安全自查（secureinchat.com/zh/tools/account-checkup/），2026-10-29\n已完成 1 / 8 项。'), tag + 'report header in Chinese')
        ok('接下来要做：\n1. 开启两步验证\n2. 给这个账号设一个不与别处共用的密码（待确认）' in rep and '未回答：\n- 备用验证码或恢复密钥保存在离线的地方' in rep, tag + 'report body in Chinese')
        ok(not re.search(r'[A-Za-z]{4,} [a-z]{3,}', rep.replace('Have I Been Pwned', '')), tag + 'no English sentences in report')
        for i in ids: pg.check(f'#ac-{i} input[value="yes"]')
        ok(pg.locator('#summary').inner_text().strip() == '这个账号的 8 项都已完成。接着对你第二重要的账号再做一遍。', tag + 'all-done headline')
        ok(pg.get_attribute('#summary', 'data-tone') == 'ok' and pg.is_hidden('#ac-next'), tag + 'tone ok, nothing next')
        pg.click('#ac-reset')
        ok(pg.locator('#summary').inner_text().strip() == '回答上面的问题，看看先做什么。' and pg.locator('input:checked').count() == 0, tag + 'clear answers')
        pg.check('#ac-mfa input[value="no"]'); pg.reload(); pg.wait_for_load_state('networkidle')
        ok(pg.locator('input:checked').count() == 0, tag + 'reload clears answers')
        ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), tag + 'no horizontal scroll')
        ext = [u for u in reqs if not (u.startswith(base) or u.startswith('data:'))]
        ok(not ext, tag + f'no outside requests {ext}')
        ok(not errs, tag + f'no console or CSP errors {errs}')
        pg.check('#ac-mfa input[value="no"]'); pg.check('#ac-codes input[value="unsure"]')
        pg.screenshot(path=os.path.join(OUT, f'zhacct-{width}.png'), full_page=True)
        ctx.close()

    # English page: same script, old strings.
    pg = b.new_page()
    pg.goto(base + '/tools/account-checkup/'); pg.wait_for_load_state('networkidle')
    ok('zh-CN' in pg.eval_on_selector_all('link[rel=alternate][hreflang]', 'els => els.map(e => e.hreflang)'), 'English page links its Chinese version')
    ok(pg.locator('#summary').inner_text().strip() == 'Answer the questions to see what to do first.', 'English idle headline unchanged')
    pg.check('#ac-mfa input[value="no"]'); pg.check('#ac-unique input[value="unsure"]')
    ok(pg.locator('#summary').inner_text().strip() == '0 of 8 done, 1 to do, 1 to find out, 6 not answered.', 'English headline unchanged')
    ok(pg.locator('#ac-next-list li').all_inner_texts() == ['Turn on two-step verification', 'Give this account a password it does not share (find out)'], 'English list unchanged')
    rep = pg.evaluate('ACCOUNT_CHECKUP.report(ACCT.summarize(ACCOUNT_CHECKUP.answers()), "2026-10-29")')
    ok(rep == pg.evaluate('ACCT.text(ACCT.summarize(ACCOUNT_CHECKUP.answers()), "2026-10-29")'), 'English report is account.js text() unchanged')
    b.close()

idx = open(os.path.join(ROOT, 'zh/tools/index.html'), encoding='utf-8').read()
ok('href="/zh/tools/account-checkup/"' in idx and 'href="/tools/account-checkup/"' not in idx, '/zh/tools/ links the Chinese page')
ok('/zh/tools/account-checkup/</loc>' in open(os.path.join(ROOT, 'sitemap.xml')).read(), 'in sitemap')
srv.shutdown()
print('FAILED: %d' % len(fails) if fails else 'all passed')
raise SystemExit(1 if fails else 0)
