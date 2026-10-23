import json, os, sys, threading, http.server, socketserver
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/site-shots'
os.makedirs(OUT, exist_ok=True)

# parse _headers: path-pattern -> {header: value}
rules, cur = [], None
for line in open(os.path.join(ROOT, '_headers')).read().splitlines():
    if not line.strip() or line.startswith('#'): continue
    if not line.startswith(' '): cur = (line.strip(), {}); rules.append(cur); continue
    k, v = line.strip().split(':', 1); cur[1][k.strip()] = v.strip()

def headers_for(p):
    out = {}
    for pat, h in rules:
        if (pat.endswith('*') and p.startswith(pat[:-1])) or pat == p: out.update(h)
    return out

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        for k, v in headers_for(self.path.split('?')[0]).items(): self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'

WS_OK = """(()=>{class W{constructor(u){this.u=u;setTimeout(()=>{this.onopen&&this.onopen();setTimeout(()=>{this.onmessage&&this.onmessage({data:JSON.stringify({type:'auth_challenge',challenge:'abcdef0123456789abcdef'})})},40)},60)}close(){}}window.WebSocket=W})();"""
WS_BAD = """(()=>{class W{constructor(u){setTimeout(()=>{this.onerror&&this.onerror();this.onclose&&this.onclose({code:1006})},60)}close(){}}window.WebSocket=W})();"""

PAGES = ['/', '/zh/', '/ja/', '/messaging/', '/start/', '/start/being-tracked/', '/start/account-hacked/', '/start/less-tracking/', '/start/network-down/', '/privacy/', '/about/', '/contact/', '/sponsor/', '/principles/', '/blog/', '/blog/how-the-ip-leak-test-works/', '/blog/what-a-blind-relay-can-and-cannot-know/', '/blog/webrtc-leak-explained/', '/blog/ipv6-leaks-explained/', '/blog/how-to-test-a-vpn-yourself/', '/blog/dns-leaks-explained/', '/blog/how-password-breach-checks-work/', '/blog/what-data-brokers-know-about-you/', '/blog/leak-test-sites-compared/', '/blog/redact-text-before-you-share-it/', '/tools/', '/tools/privacy-report/', '/tools/account-checkup/', '/tools/ip-leak-test/', '/tools/webrtc-leak-test/', '/tools/ipv6-leak-test/', '/tools/photo-metadata-remover/', '/tools/browser-fingerprint-test/', '/tools/password-checker/', '/tools/text-redactor/', '/tools/link-checker/', '/tools/site-health-check/', '/blog/bank-statement-before-ai-upload/', '/blog/photo-before-ai-upload/', '/blog/cv-before-ai-upload/', '/blog/before-you-paste-into-ai-checklist/', '/mission/', '/protect/', '/protect/physical/', '/protect/devices/', '/protect/accounts/', '/protect/communication/', '/protect/offline/', '/protect/ai/', '/checkup/', '/zh/checkup/', '/tools/phone-checkup/', '/zh/tools/phone-checkup/', '/blog/encrypted-messaging-when-networks-fail/', '/blog/check-app-permissions-android-iphone/', '/blog/ai-apps-permissions-and-data/', '/blog/move-to-encrypted-email/', '/blog/email-aliases-hide-your-address/', '/blog/protect-your-phone-number-sim-swap/', '/blog/privacy-reset-checklist-iphone-android/', '/blog/data-broker-opt-out-guide/', '/shop/']
fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    for vpname, vp, mobile in [('desktop', {'width': 1280, 'height': 800}, False), ('mobile', {'width': 390, 'height': 844}, True)]:
        for path in PAGES:
            ctx = b.new_context(viewport=vp, is_mobile=mobile)
            page = ctx.new_page()
            external, viol, errs = [], [], []
            page.on('request', lambda r: external.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') else None)
            page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            missing = []
            page.on('response', lambda r: missing.append(r.url) if r.url.startswith(BASE) and r.status >= 400 and '/api/' not in r.url else None)
            page.add_init_script(WS_OK)
            page.add_init_script("document.addEventListener('securitypolicyviolation',e=>{(window.__v=window.__v||[]).push(e.violatedDirective+' '+e.blockedURI)})")
            # tools page lookups are not under test here; abort them quietly
            page.route('https://*/**', lambda r: r.abort())
            page.route('**/api/whoami', lambda r: r.fulfill(status=200, content_type='application/json', body='{"ip":"203.0.113.5","asn":64500,"asOrganization":"Example","country":"US","timezone":"America/New_York","headers":{}}'))
            resp = page.goto(BASE + path, wait_until='load')
            page.wait_for_timeout(700)
            tag = f'{path} [{vpname}]'
            check(resp.status == 200, f'{tag} status 200')
            v = page.evaluate('window.__v||[]')
            check(not v, f'{tag} no CSP violations {v}')
            check(not missing, f'{tag} no missing files {missing[:3]}')
            ov = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, f'{tag} no horizontal overflow ({ov})')
            if not path.startswith('/tools/ip-leak'):
                check(not [u for u in external if not u.startswith('wss')], f'{tag} no external requests {external[:3]}')
            if path == '/messaging/':
                page.wait_for_timeout(400)
                net = page.inner_text('#net-label')
                lat = page.inner_text('#node-latency')
                chal = page.inner_text('#node-chal')
                check(net == 'Network: Operational', f'{tag} badge operational (got {net})')
                check(lat.isdigit(), f'{tag} latency numeric ({lat})')
                check(chal == 'Verified', f'{tag} challenge verified')
                check(page.evaluate("document.fonts.check('800 20px \"Atkinson Next\"')"), f'{tag} heading font loaded')
                h1 = page.inner_text('h1').strip().replace('\n', ' ')
                check(len(h1) > 8, f'{tag} h1 rendered in static HTML: {h1}')
                if vpname == 'desktop':
                    page.screenshot(path=f"{OUT}/{path.strip('/').replace('/','_') or 'home'}-{vpname}.png")
            if path in ('/', '/zh/', '/ja/'):
                h1 = page.inner_text('h1').strip()
                check(len(h1) > 4, f'{tag} h1 rendered: {h1}')
                if vpname == 'desktop':
                    page.screenshot(path=f"{OUT}/{path.strip('/').replace('/','_') or 'home'}-{vpname}.png", full_page=True)
            if path == '/' and vpname == 'mobile':
                page.screenshot(path=f'{OUT}/home-mobile.png')
            if path in ('/privacy/', '/tools/ip-leak-test/') and vpname == 'desktop':
                page.screenshot(path=f"{OUT}/{path.strip('/').replace('/','_')}-{vpname}.png")
            ctx.close()
    # failure path
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}); page = ctx.new_page()
    page.add_init_script(WS_BAD); page.goto(BASE + '/messaging/'); page.wait_for_timeout(600)
    check(page.inner_text('#net-label') == 'Network: Unreachable', 'relay failure shows Unreachable')
    check('Unable to establish' in page.inner_text('#node-log'), 'relay failure message shown')
    # no-JS: content must be visible
    ctx2 = b.new_context(java_script_enabled=False, viewport={'width': 1280, 'height': 800}); pg2 = ctx2.new_page(); pg2.goto(BASE + '/messaging/')
    check(pg2.is_visible('#architecture h2'), 'no-JS: architecture heading visible')
    pg2.goto(BASE + '/'); check(pg2.is_visible('#hero-title') and pg2.is_visible('#privacy-tools h2'), 'no-JS: home hero and tools visible')
    # language select navigates
    ctx3 = b.new_context(viewport={'width': 1280, 'height': 800}); pg3 = ctx3.new_page(); pg3.add_init_script(WS_OK); pg3.goto(BASE + '/')
    pg3.goto(BASE + '/zh/'); check(len(pg3.inner_text('#hero-title').strip()) > 4, '/zh/ hero heading')
    zh_links = pg3.eval_on_selector_all('main a[href]', 'as => as.map(a => a.getAttribute("href"))')
    check(not [h for h in zh_links if 'ip-leak' in h], '/zh/ has no IP leak tool link (rule)')
    check(pg3.locator('a[href="/zh/checkup/"]').count() >= 1, '/zh/ links to the Chinese privacy checkup')
    check(pg3.locator('link[rel="alternate"][hreflang="ja"]').count() == 1, '/zh/ hreflang alternates present')
    pg3.goto(BASE + '/zh/checkup/')
    zc = pg3.eval_on_selector_all('main a[href]', 'as => as.map(a => a.getAttribute("href"))')
    check(not [h for h in zc if 'privacy-report' in h or 'ip-leak' in h], '/zh/checkup/ has no IP test (rule)')
    pg3.goto(BASE + '/checkup/')
    ec = pg3.eval_on_selector_all('.checkup-card a', 'as => as.map(a => a.getAttribute("href"))')
    check(ec == ['/tools/privacy-report/', '/tools/link-checker/', '/tools/phone-checkup/', '/tools/account-checkup/'], f'/checkup/ four checks in order {ec}')
    pg3.goto(BASE + '/ja/'); check('何が漏れているか' in pg3.inner_text('h1'), '/ja/ heading')
    pg3.wait_for_timeout(300)
    check(pg3.inner_text('#ro-cookies') in ('許可', 'ブロック'), '/ja/ readout localized')
    check(pg3.locator('main a[href^="/"]:not([hreflang="en"])').count() == 0, '/ja/ every internal link marked hreflang=en')
    b.close()

# Internal links: every href="/..." in every built page must resolve to a file, a page, a redirect or the tools API.
import re as _re, glob as _glob
_redir = [l.split()[0] for l in open(os.path.join(ROOT, '_redirects')).read().splitlines() if l.strip()] if os.path.exists(os.path.join(ROOT, '_redirects')) else []
_bad = set()
for _f in _glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True):
    if '/guides/' in _f or '/refund/' in _f or '/terms/' in _f: continue  # old pages kept on disk, redirected
    for _h in _re.findall(r'href="(/[^"#?]*)', open(_f, encoding='utf-8').read()):
        if _h.startswith('//') or _h.startswith('/tools/api/') or _h.startswith('/cdn-cgi/'): continue
        if any(_h == r or (r.endswith('*') and _h.startswith(r[:-1])) for r in _redir): continue
        _p = os.path.join(ROOT, _h.lstrip('/'))
        if not (os.path.isfile(_p) or os.path.isfile(os.path.join(_p, 'index.html'))): _bad.add(f'{_h} (in {os.path.relpath(_f, ROOT)})')
check(not _bad, f'internal links resolve: {sorted(_bad)[:8]}')

print('\nFAILED:' if fails else '\nSITE TESTS PASSED', *fails, sep='\n')
sys.exit(1 if fails else 0)
