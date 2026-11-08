import json, os, sys, threading, http.server, socketserver, re, math
from urllib.parse import urlparse
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

socketserver.ThreadingTCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer.daemon_threads = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'

# Layout and keyboard state settle after webfonts swap in and after native <details> toggles.
# Wait for those explicit states rather than sleeping: a fallback font can be wider than the
# loaded font, and a toggle event is queued after the element's open state changes.
def settle_layout(page):
    page.evaluate("() => (document.fonts && document.fonts.ready) ? document.fonts.ready.then(() => true) : true")

def wait_state(page, expression, timeout=3000):
    try:
        page.wait_for_function(expression, timeout=timeout)
        return True
    except Exception:
        return False

def overflow_report(page):
    return page.evaluate("""() => {
      const w = document.documentElement.clientWidth;
      return [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.right > w + 0.5 && s.position !== 'fixed' && s.visibility !== 'hidden';
      }).slice(0, 6).map((el) => el.tagName.toLowerCase()
        + (el.id ? '#' + el.id : '')
        + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/[ ]+/).join('.') : '')
        + ' right=' + Math.round(el.getBoundingClientRect().right));
    }""")

WS_OK = """(()=>{class W{constructor(u){this.u=u;setTimeout(()=>{this.onopen&&this.onopen();setTimeout(()=>{this.onmessage&&this.onmessage({data:JSON.stringify({type:'auth_challenge',challenge:'abcdef0123456789abcdef'})})},40)},60)}close(){}}window.WebSocket=W})();"""
WS_BAD = """(()=>{class W{constructor(u){setTimeout(()=>{this.onerror&&this.onerror();this.onclose&&this.onclose({code:1006})},60)}close(){}}window.WebSocket=W})();"""

PAGES = ['/', '/workspace/', '/zh/', '/ja/', '/messaging/', '/start/', '/start/being-tracked/', '/start/account-hacked/', '/start/less-tracking/', '/start/network-down/', '/privacy/', '/about/', '/contact/', '/sponsor/', '/principles/', '/blog/', '/blog/how-the-ip-leak-test-works/', '/blog/what-a-blind-relay-can-and-cannot-know/', '/blog/webrtc-leak-explained/', '/blog/ipv6-leaks-explained/', '/blog/how-to-test-a-vpn-yourself/', '/blog/dns-leaks-explained/', '/blog/how-password-breach-checks-work/', '/blog/what-data-brokers-know-about-you/', '/blog/leak-test-sites-compared/', '/blog/redact-text-before-you-share-it/', '/tools/', '/tools/privacy-report/', '/tools/account-checkup/', '/tools/ip-leak-test/', '/tools/webrtc-leak-test/', '/tools/ipv6-leak-test/', '/tools/photo-metadata-remover/', '/tools/browser-fingerprint-test/', '/tools/password-checker/', '/tools/text-redactor/', '/tools/link-checker/', '/tools/site-health-check/', '/blog/bank-statement-before-ai-upload/', '/blog/photo-before-ai-upload/', '/blog/cv-before-ai-upload/', '/blog/before-you-paste-into-ai-checklist/', '/mission/', '/protect/', '/protect/physical/', '/protect/devices/', '/protect/accounts/', '/protect/communication/', '/protect/offline/', '/protect/ai/', '/checkup/', '/zh/checkup/', '/tools/phone-checkup/', '/zh/tools/phone-checkup/', '/zh/tools/text-redactor/', '/zh/tools/file-metadata-remover/', '/zh/tools/password-checker/', '/zh/tools/account-checkup/', '/zh/tools/link-checker/', '/zh/tools/browser-fingerprint-test/', '/zh/tools/site-health-check/', '/blog/encrypted-messaging-when-networks-fail/', '/blog/check-app-permissions-android-iphone/', '/blog/ai-apps-permissions-and-data/', '/blog/move-to-encrypted-email/', '/blog/email-aliases-hide-your-address/', '/blog/protect-your-phone-number-sim-swap/', '/blog/privacy-reset-checklist-iphone-android/', '/blog/data-broker-opt-out-guide/', '/shop/', '/messaging/threat-model/', '/zh/messaging/threat-model/', '/es/messaging/threat-model/', '/scan/']
fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

def target_exists(href):
    path = os.path.join(ROOT, href.lstrip('/'))
    return os.path.isfile(path) or os.path.isfile(os.path.join(path, 'index.html'))

# --- Step 4 first batch: migration-before/after semantic checks (static HTML) ----------------
def text(rel):
    return open(os.path.join(ROOT, rel), encoding='utf-8').read()

def count_tag(html, tag):
    return len(re.findall(r'<' + tag + r'\b', html))

# Hard-coded from the tools page before the template change. Ids and script hooks are runtime contracts.
REDACTOR_IDS = [
    'rd-in', 'rd-out', 'rd-terms', 'rd-reply', 'rd-restored', 'rd-copy', 'rd-clear', 'rd-restore-copy',
    'rd-restore-status', 'rule-term', 'rule-email', 'rule-phone', 'rule-cn_mobile', 'rule-cn_id',
    'rule-ipv4', 'rule-ipv6', 'rule-mac', 'rule-card', 'rule-iban', 'rule-apikey', 'rule-jwt',
    'rule-url_cred', 'rule-privkey', 'restore-h', 'results', 'results-h', 'summary', 'rows', 'netlog',
    'what-h', 'faq-h',
]
REDACTOR_SCRIPTS = [
    '/assets/js/shell.js', '/tools/assets/redact.js', '/tools/assets/redact-app.js', '/tools/assets/net-log.js',
]
for rel in ('tools/text-redactor/index.html', 'zh/tools/text-redactor/index.html'):
    html = text(rel)
    missing = [i for i in REDACTOR_IDS if f'id="{i}"' not in html]
    check(not missing, f'{rel} keeps redactor ids {missing}')
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    check(scripts == REDACTOR_SCRIPTS, f'{rel} keeps script references in order {scripts}')
    check(count_tag(html, 'script') == 5, f'{rel} keeps 5 script tags (4 src + JSON-LD)')
    check(html.count('data-tone="idle"') == 1, f'{rel} keeps the result summary data-tone hook')
    check(len(re.findall(r'<input\b[^>]*id="rule-', html)) == 14, f'{rel} keeps 14 rule checkboxes')
    check(len(re.findall(r'<textarea\b[^>]*id="rd-', html)) == 5, f'{rel} keeps 5 textareas')
    check('class="tool-page-v4"' in html and '/assets/css/tools-v4.css' in html, f'{rel} uses the v4 tools template')
    check('tool-v4-flow' in html and 'tool-v4-section' in html, f'{rel} has pre-run data flow and method sections')

# Every catalogue card link must resolve, and only the migrated tools load the new stylesheet.
index = text('tools/index.html')
cards = re.findall(r'<a class="tool-catalogue-action" href="([^"]+)"', index)
check(len(cards) == 13, f'/tools/ has 13 catalogue cards ({len(cards)})')
check(all(target_exists(h) for h in cards), f'/tools/ card links resolve {[h for h in cards if not target_exists(h)]}')
check('class="tools-v4"' in index and '/assets/css/tools-v4.css' in index, '/tools/ uses the v4 index template')
old_tool = text('tools/photo-metadata-remover/index.html')
check('tools-v4.css' not in old_tool and 'tool-page-v4' not in old_tool, 'unmigrated tool keeps the old template')

# Contrast spot-check on the real token values: normal text must stay at or above 4.5:1.
tokens = text('assets/css/tokens.css')
def token_block(pattern):
    m = re.search(pattern + r'\s*\{([^}]*)\}', tokens)
    return {k: v.lower() for k, v in re.findall(r'(--sc-[a-z-]+):\s*(#[0-9a-fA-F]{6})', m.group(1))}
def luminance(hex_value):
    rgb = [int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
def ratio(fg, bg):
    a, b = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (a + 0.05) / (b + 0.05)
dark = token_block(r':root')
light = token_block(r":root\[data-theme='light'\]")
for theme, values in (('dark', dark), ('light', light)):
    for fg, bg in (('--sc-ink', '--sc-canvas'), ('--sc-ink-muted', '--sc-surface'),
                   ('--sc-accent-ink', '--sc-accent'), ('--sc-link', '--sc-canvas')):
        r = ratio(values[fg], values[bg])
        check(r >= 4.5, f'{theme} tokens {fg}/{bg} contrast {r:.1f}:1 >= 4.5:1')

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
    check(pg2.is_visible('#relay-diagnostic-title') and pg2.is_visible('h1.page-title'), 'no-JS: messaging heading and relay diagnostic visible')
    pg2.goto(BASE + '/'); check(pg2.is_visible('#hero-title') and pg2.is_visible('#share-moments h2'), 'no-JS: home hero and moments visible')
    check(pg2.is_visible('#home-noscript') and pg2.locator('.home-nojs a[href="/workspace/"]').count() >= 1, 'no-JS: home check explains itself and links the workspace')
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
    # Rule 5: no Chinese page links to the IP, WebRTC, IPv6 or DNS leak tests (the privacy report runs them all).
    import glob
    LEAK = ('privacy-report', 'ip-leak-test', 'webrtc-leak-test', 'ipv6-leak-test', 'dns-leak')
    zh_bad = [f for f in glob.glob(os.path.join(ROOT, 'zh/**/*.html'), recursive=True) if any(f'href="/tools/{k}' in open(f, encoding='utf-8').read() for k in LEAK)]
    check(not zh_bad, f'no zh page links to leak tests (rule) {zh_bad[:3]}')
    pg3.goto(BASE + '/checkup/')
    ec = pg3.eval_on_selector_all('.checkup-card a', 'as => as.map(a => a.getAttribute("href"))')
    check(ec == ['/tools/privacy-report/', '/tools/link-checker/', '/tools/phone-checkup/', '/tools/account-checkup/'], f'/checkup/ four checks in order {ec}')
    pg3.goto(BASE + '/ja/'); check('共有する前に' in pg3.inner_text('h1'), '/ja/ heading')
    pg3.wait_for_timeout(300)
    check('入力' in pg3.inner_text('#home-status') and 'リクエスト' in pg3.inner_text('#request-count'), '/ja/ live check localized')
    check(pg3.locator('main a[href^="/"]:not([hreflang="en"])').count() == 0, '/ja/ every internal link marked hreflang=en')

    # Workspace: local-only text/link review, keyboard tabs, undo, blocked copy and no storage.
    ctxw = b.new_context(viewport={'width': 1280, 'height': 800})
    pw = ctxw.new_page()
    w_ext, w_viol = [], []
    pw.on('request', lambda r: w_ext.append(r.url) if not r.url.startswith(BASE) and not r.url.startswith('data:') else None)
    pw.add_init_script("document.addEventListener('securitypolicyviolation',e=>{(window.__v=window.__v||[]).push(e.violatedDirective+' '+e.blockedURI)})")
    pw.goto(BASE + '/workspace/', wait_until='load')
    check(pw.is_visible('#workspace-app'), 'workspace app visible with JS')
    pw.focus('#tab-text')
    pw.keyboard.press('ArrowRight')
    check(pw.is_visible('#panel-link'), 'workspace tabs work with arrow keys')
    pw.keyboard.press('ArrowLeft')
    check(pw.is_visible('#panel-text'), 'workspace tabs return with arrow keys')
    pw.fill('#draft', 'Mail bob@example.com, call +1 415-555-0132, key sk-' + 'a' * 20)
    pw.click('#inspect-text')
    check('3 pattern matches' in pw.inner_text('#text-result'), 'workspace text result counts three categories')
    check(pw.locator('#text-result input[type=checkbox]').count() == 3, 'workspace text result offers category checkboxes')
    check(pw.is_enabled('#copy-preview') and pw.is_enabled('#use-preview'), 'workspace preview actions enabled')
    pw.locator('#text-result input[value="phone"]').uncheck()
    check('[PHONE_1]' not in pw.input_value('#clean-preview'), 'workspace unchecked category is not replaced')
    pw.locator('#text-result input[value="phone"]').check()
    pw.click('#use-preview')
    check(pw.input_value('#draft').startswith('Mail [EMAIL_1]'), 'workspace replaces the draft only after the user chooses')
    check(pw.is_visible('#undo-bar'), 'workspace offers undo after replacement')
    pw.click('#undo-draft')
    check('bob@example.com' in pw.input_value('#draft'), 'workspace undo restores the previous draft')
    pw.once('dialog', lambda d: d.accept())
    pw.click('#tab-link')
    check(pw.is_visible('#panel-link'), 'workspace link mode opens and clears the previous input')
    pw.fill('#link-url', 'https://example.com/a?utm_source=x&token=secret&id=42')
    pw.click('#inspect-link')
    check('utm_source' in pw.inner_text('#link-result'), 'workspace link result lists tracking keys')
    check('token' in pw.inner_text('#link-result'), 'workspace link result lists session-like keys')
    check(pw.locator('#copy-clean').is_disabled(), 'workspace blocks quick copy for session-like keys')
    check('did not contact' in pw.inner_text('#link-result'), 'workspace link result says the host was not contacted')
    check(not w_ext, f'workspace no external requests {w_ext[:3]}')
    check(not pw.evaluate('window.__v||[]'), 'workspace no CSP violations')
    check(pw.evaluate("(()=>{try{return localStorage.length+sessionStorage.length+document.cookie.length}catch(e){return -1}})()") == 0, 'workspace uses no storage or cookies')
    pw.screenshot(path=f'{OUT}/workspace-desktop.png', full_page=True)
    ctxw.close()

    # 320 px is the narrowest supported phone width.
    ctxn = b.new_context(viewport={'width': 320, 'height': 800})
    pn = ctxn.new_page(); pn.goto(BASE + '/workspace/', wait_until='load')
    settle_layout(pn)
    ov = pn.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
    check(ov <= 0, f'workspace 320px no horizontal overflow ({ov}) {overflow_report(pn) if ov > 0 else ""}')
    check(pn.is_visible('#workspace-app'), 'workspace app visible at 320px')
    pn.screenshot(path=f'{OUT}/workspace-320.png', full_page=True)
    ctxn.close()

    # 320 px is the narrowest supported phone width. Check the global shell there too:
    # four items, one Workspace entry, the current section marked, real language targets, and the
    # native mobile disclosure operable from the keyboard (and without JavaScript below).
    NAV_CASES = {
        '/': ['Workspace', 'Tools', 'Learn', 'About'],
        '/zh/': ['工作台', '工具', '学习', '关于'],
        '/ja/': ['ワークスペース', 'ツール', '学ぶ', '概要'],
        '/tools/': ['Workspace', 'Tools', 'Learn', 'About'],
        '/zh/tools/': ['工作台', '工具', '学习', '关于'],
        '/blog/': ['Workspace', 'Tools', 'Learn', 'About'],
        '/about/': ['Workspace', 'Tools', 'Learn', 'About'],
        '/es/messaging/threat-model/': ['Espacio de trabajo', 'Herramientas', 'Aprender', 'Acerca de'],
        '/workspace/': ['Workspace', 'Tools', 'Learn', 'About'],
    }
    for nav_path, nav_labels in NAV_CASES.items():
        ctxn = b.new_context(viewport={'width': 320, 'height': 800})
        pn = ctxn.new_page(); pn.goto(BASE + nav_path, wait_until='load')
        settle_layout(pn)
        nav = pn.locator('header nav.sc-nav').first
        got = [t.strip() for t in nav.locator('a').all_text_contents()]
        check(got == nav_labels, f'{nav_path} [nav 320] four localized items {got}')
        check(nav.locator('a[href="/workspace/"]').count() == 1, f'{nav_path} [nav 320] Workspace appears once in the nav')
        cta = pn.locator('header .sc-cta').first
        check(cta.count() == 1, f'{nav_path} [nav 320] Open workspace action present')
        if cta.count():
            cta_text = (cta.text_content() or '').strip()
            check(cta.get_attribute('href') == '/workspace/', f'{nav_path} [nav 320] action opens /workspace/')
            check(cta_text and cta_text != nav_labels[0], f'{nav_path} [nav 320] action is not another Workspace title ({cta_text})')
            cta_colors = cta.evaluate("a => { const s = getComputedStyle(a); return [s.color, s.backgroundColor]; }")
            check(cta_colors[0] != cta_colors[1], f'{nav_path} [nav 320] action text is visible against its background {cta_colors}')
        lang_hrefs = pn.locator('header .sc-lang__menu a[href]').evaluate_all('as => as.map(a => a.getAttribute("href"))')
        check(len(lang_hrefs) > 0, f'{nav_path} [nav 320] language menu has real options')
        for href in lang_hrefs:
            check(target_exists(href), f'{nav_path} [nav 320] language target exists {href}')
            check(href != nav_path, f'{nav_path} [nav 320] language menu does not link to itself')
        footer_lang = pn.locator('footer .sc-footer__lang a[href]').evaluate_all('as => as.map(a => a.getAttribute("href"))')
        check(len(footer_lang) > 0, f'{nav_path} [nav 320] footer language menu has real options')
        for href in footer_lang:
            check(target_exists(href), f'{nav_path} [nav 320] footer language target exists {href}')
        ov = pn.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        check(ov <= 0, f'{nav_path} [nav 320] no horizontal overflow ({ov}) {overflow_report(pn) if ov > 0 else ""}')
        if nav_path in ('/tools/', '/zh/tools/', '/blog/', '/about/', '/workspace/'):
            cur = nav.locator('a[aria-current="page"]')
            check(cur.count() == 1, f'{nav_path} [nav 320] current item marked ({cur.count()})')
        details = pn.locator('details.sc-menu')
        if details.count():
            summary = details.locator('summary')
            focus_summary = "() => { const s = document.querySelector('details.sc-menu > summary'); return !!s && document.activeElement === s; }"
            menu_open = "() => { const d = document.querySelector('details.sc-menu'); if (!d || !d.open) return false; const n = d.querySelector('nav'); return !!n && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden' && n.getBoundingClientRect().width > 0; }"
            menu_closed = "() => { const d = document.querySelector('details.sc-menu'); return !!d && !d.open; }"
            summary.focus()
            check(wait_state(pn, focus_summary), f'{nav_path} [nav 320] menu summary receives keyboard focus')
            pn.keyboard.press('Enter')
            check(wait_state(pn, menu_open), f'{nav_path} [nav 320] menu opens with Enter')
            pn.keyboard.press('Escape')
            check(wait_state(pn, menu_closed), f'{nav_path} [nav 320] menu closes with Escape')
            summary.focus()
            check(wait_state(pn, focus_summary), f'{nav_path} [nav 320] menu summary regains focus')
            pn.keyboard.press('Enter')
            check(wait_state(pn, menu_open), f'{nav_path} [nav 320] menu reopens with Enter')
            mobile = [t.strip() for t in details.locator('nav a').all_inner_texts()]
            check(mobile[:4] == nav_labels, f'{nav_path} [nav 320] mobile menu starts with the four items {mobile[:6]}')
            ov = pn.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check(ov <= 0, f'{nav_path} [nav 320] open menu does not overflow ({ov}) {overflow_report(pn) if ov > 0 else ""}')
            details.locator('nav a').first.focus()
            check(pn.evaluate("document.activeElement && document.activeElement.tagName === 'A'"),
                  f'{nav_path} [nav 320] mobile menu links are keyboard reachable')
        ctxn.close()

    # No-JS fallback: the native <details> menu still opens and exposes the four items.
    ctxnj = b.new_context(java_script_enabled=False, viewport={'width': 320, 'height': 800})
    pnj = ctxnj.new_page(); pnj.goto(BASE + '/tools/', wait_until='load')
    dnj = pnj.locator('details.sc-menu')
    check(dnj.count() == 1, 'no-JS: mobile menu present')
    if dnj.count():
        dnj.locator('summary').click()
        check(pnj.locator('details.sc-menu nav a[href="/tools/"]').is_visible(), 'no-JS: mobile menu opens and exposes the current tool item')
    ctxnj.close()

    # No-JS fallback is readable and no broken controls are shown.
    ctxj = b.new_context(java_script_enabled=False, viewport={'width': 1280, 'height': 800})
    pj = ctxj.new_page(); pj.goto(BASE + '/workspace/', wait_until='load')
    check(pj.is_visible('#nojs-fallback'), 'workspace no-JS fallback visible')
    check(not pj.is_visible('#workspace-app'), 'workspace app hidden without JS')
    check('pattern matching' in pj.inner_text('#nojs-fallback').lower(), 'workspace no-JS fallback explains pattern matching')
    ctxj.close()

    # Dark mode follows the system preference without a toggle or stored choice.
    ctxd = b.new_context(viewport={'width': 1280, 'height': 800}, color_scheme='dark')
    pd = ctxd.new_page(); pd.goto(BASE + '/workspace/', wait_until='load')
    check(pd.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(17, 19, 14)', 'workspace dark mode background')
    ctxd.close()
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

# W13: Chinese pages link to the Chinese tools index and to a tool's Chinese page whenever one exists.
# Only the language switch (lang/hreflang="en") may point at the English version.
_zh_tools = {os.path.basename(os.path.dirname(p)) for p in _glob.glob(os.path.join(ROOT, 'zh', 'tools', '*', 'index.html'))}
_zh_bad = []
for _f in _glob.glob(os.path.join(ROOT, 'zh', '**', '*.html'), recursive=True):
    for _a in _re.findall(r'<a\b[^>]*>', open(_f, encoding='utf-8').read()):
        if _re.search(r'\b(?:lang|hreflang)="en"', _a): continue
        _m = _re.search(r'href="/tools/([a-z0-9-]*)/?"', _a)
        if _m and (_m.group(1) == '' or _m.group(1) in _zh_tools): _zh_bad.append(f'{os.path.relpath(_f, ROOT)}: /tools/{_m.group(1)}')
check(len(_zh_tools) >= 7 and not _zh_bad, f'zh pages use Chinese tool pages ({len(_zh_tools)} zh tools): {_zh_bad[:8]}')
_zc = open(os.path.join(ROOT, 'zh', 'checkup', 'index.html'), encoding='utf-8').read()
_zc_cards = _re.findall(r'class="button button--primary checkup-card-action" href="([^"]+)"', _zc)
check(_zc_cards == ['/zh/tools/link-checker/', '/zh/tools/phone-checkup/', '/zh/tools/account-checkup/'], f'/zh/checkup/ cards link Chinese tools {_zc_cards}')
_zh_home = open(os.path.join(ROOT, 'zh', 'index.html'), encoding='utf-8').read()
_zh_tool_links = _re.findall(r'href="(/tools/[^"]+)"', _zh_home)
# The Chinese home never sends readers to an English tool page when a Chinese one exists; its tool
# entry point is the Chinese index. This replaces the old v4-card regex without relaxing the rule.
check(not [h for h in _zh_tool_links if not h.startswith('/zh/tools/')], f'/zh/ no English tool links {_zh_tool_links}')
check('href="/zh/tools/"' in _zh_home, '/zh/ links the Chinese tools index')
check('11 个工具' not in _zh_home, '/zh/ no stale tool count')
_en_home = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
check('href="/tools/"' in _en_home, '/ links the full tools directory')
check('eleven' not in _en_home.lower() and '11 tools' not in _en_home.lower(), '/ no stale hardcoded tool count')
_ja_home = open(os.path.join(ROOT, 'ja', 'index.html'), encoding='utf-8').read()
check(_re.search(r'rel="[^"]*sponsored[^"]*"', _ja_home) is not None and 'アフィリエイトリンク' in _ja_home, '/ja/ keeps the sponsored partner disclosure')

# Heading order (WCAG 1.3.1): no built page may skip a level going down (h1 -> h3 breaks screen-reader outlines).
_skips = []
for _f in _glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True):
    _s = _re.sub(r'<(script|style|template)\b.*?</\1>', '', open(_f, encoding='utf-8').read(), flags=_re.S)
    _prev = 0
    for _l in (int(x) for x in _re.findall(r'<h([1-6])\b', _s)):
        if _prev and _l > _prev + 1: _skips.append(f'{os.path.relpath(_f, ROOT)}: h{_prev} -> h{_l}'); break
        _prev = _l
check(not _skips, f'no skipped heading levels: {_skips[:8]}')

# No third-party scripts or analytics: scan every generated page, every CSP rule and every sitemap URL.
_cf_pages, _ext_scripts, _csp_bad, _csp_missing = [], [], [], []
for _f in _glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True):
    _rel = os.path.relpath(_f, ROOT)
    _s = open(_f, encoding='utf-8').read()
    if 'cloudflareinsights' in _s.lower(): _cf_pages.append(_rel)
    for _src in _re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', _s):
        _u = urlparse(_src)
        if _u.scheme in ('http', 'https') and _u.netloc != 'secureinchat.com': _ext_scripts.append(f'{_rel}: {_src}')
        elif _src.startswith('//') and urlparse('https:' + _src).netloc != 'secureinchat.com': _ext_scripts.append(f'{_rel}: {_src}')
check(not _cf_pages, f'no generated page mentions cloudflareinsights {_cf_pages[:3]}')
check(not _ext_scripts, f'no external script sources in HTML {_ext_scripts[:3]}')

_headers_src = open(os.path.join(ROOT, '_headers'), encoding='utf-8').read()
check('cloudflareinsights' not in _headers_src.lower(), 'CSP headers do not allow cloudflareinsights')
for _csp in _re.findall(r'Content-Security-Policy:\s*([^\n]+)', _headers_src):
    _ss = _re.search(r'(?:^|;)\s*script-src\s+([^;]*)', _csp)
    if _ss:
        _bad = [x for x in _ss.group(1).split() if x not in ("'self'", "'wasm-unsafe-eval'", "'none'")]
        if _bad: _csp_bad.append(_bad)
check(not _csp_bad, f'CSP script-src is self-hosted only {_csp_bad[:3]}')

_sitemap_locs = _re.findall(r'<loc>([^<]+)</loc>', open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read())
for _loc in _sitemap_locs:
    _p = _loc.replace('https://secureinchat.com', '')
    _csp = headers_for(_p).get('Content-Security-Policy')
    if not _csp or 'cloudflareinsights' in _csp.lower(): _csp_missing.append(_p)
check(len(_sitemap_locs) > 0 and not _csp_missing, f'every sitemap page has a self-hosted CSP {_csp_missing[:3]}')

print('\nFAILED:' if fails else '\nSITE TESTS PASSED', *fails, sep='\n')
sys.exit(1 if fails else 0)
