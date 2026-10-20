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

PAGES = ['/', '/zh/', '/ja/', '/privacy/', '/about/', '/contact/', '/sponsor/', '/principles/', '/blog/', '/blog/how-the-ip-leak-test-works/', '/blog/what-a-blind-relay-can-and-cannot-know/', '/blog/webrtc-leak-explained/', '/blog/ipv6-leaks-explained/', '/blog/how-to-test-a-vpn-yourself/', '/blog/dns-leaks-explained/', '/blog/how-password-breach-checks-work/', '/blog/what-data-brokers-know-about-you/', '/blog/leak-test-sites-compared/', '/blog/redact-text-before-you-share-it/', '/tools/', '/tools/ip-leak-test/', '/tools/webrtc-leak-test/', '/tools/ipv6-leak-test/', '/tools/photo-metadata-remover/', '/tools/browser-fingerprint-test/', '/tools/password-checker/', '/tools/text-redactor/']
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
            ov = page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, f'{tag} no horizontal overflow ({ov})')
            if not path.startswith('/tools/ip-leak'):
                check(not [u for u in external if not u.startswith('wss')], f'{tag} no external requests {external[:3]}')
            if path in ('/', '/zh/', '/ja/'):
                page.wait_for_timeout(400)
                net = page.inner_text('#net-label')
                lat = page.inner_text('#node-latency')
                chal = page.inner_text('#node-chal')
                check(net == 'Network: Operational', f'{tag} badge operational (got {net})')
                check(lat.isdigit(), f'{tag} latency numeric ({lat})')
                check(chal == 'Verified', f'{tag} challenge verified')
                check(page.evaluate("document.fonts.check('700 20px \"Space Grotesk\"')"), f'{tag} display font loaded')
                h1 = page.inner_text('h1').strip().replace('\n', ' ')
                check(len(h1) > 8, f'{tag} h1 rendered in static HTML: {h1}')
                if vpname == 'desktop':
                    page.screenshot(path=f"{OUT}/{path.strip('/').replace('/','_') or 'home'}-{vpname}.png")
            if path == '/' and vpname == 'mobile':
                page.screenshot(path=f'{OUT}/home-mobile.png')
            if path in ('/privacy/', '/tools/ip-leak-test/') and vpname == 'desktop':
                page.screenshot(path=f"{OUT}/{path.strip('/').replace('/','_')}-{vpname}.png")
            ctx.close()
    # failure path
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}); page = ctx.new_page()
    page.add_init_script(WS_BAD); page.goto(BASE + '/'); page.wait_for_timeout(600)
    check(page.inner_text('#net-label') == 'Network: Unreachable', 'relay failure shows Unreachable')
    check('Unable to establish' in page.inner_text('#node-log'), 'relay failure message shown')
    # no-JS: content must be visible
    ctx2 = b.new_context(java_script_enabled=False, viewport={'width': 1280, 'height': 800}); pg2 = ctx2.new_page(); pg2.goto(BASE + '/')
    check(pg2.is_visible('#architecture h2'), 'no-JS: architecture heading visible')
    # language select navigates
    ctx3 = b.new_context(viewport={'width': 1280, 'height': 800}); pg3 = ctx3.new_page(); pg3.add_init_script(WS_OK); pg3.goto(BASE + '/')
    pg3.select_option('#lang', '/zh/'); pg3.wait_for_url('**/zh/'); check('沟通不留痕迹' in pg3.inner_text('h1'), 'language select goes to /zh/')
    b.close()

print('\nFAILED:' if fails else '\nSITE TESTS PASSED', *fails, sep='\n')
sys.exit(1 if fails else 0)
