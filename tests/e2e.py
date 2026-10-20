import json, re, sys, threading, http.server, socketserver, os, functools
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
SHOTS = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'
os.makedirs(SHOTS, exist_ok=True)

# Apply the "/*" block of _headers so CSP violations show up in the test.
hdrs = {}
cur = None
for line in open(os.path.join(os.path.dirname(__file__), '..', 'public', '_headers')).read().splitlines():
    if not line.strip() or line.startswith('#'): continue
    if not line.startswith(' '): cur = line.strip(); continue
    if cur == '/tools/*':
        k, v = line.strip().split(':', 1); hdrs[k.strip()] = v.strip()

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        for k, v in hdrs.items(): self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/tools/ip-leak-test/'

FAKE_RTC = """
(() => {
  const cands = %s;
  class FakePC {
    constructor(){ this.iceGatheringState='new'; this.onicecandidate=null; this.onicegatheringstatechange=null; }
    createDataChannel(){ return {}; }
    createOffer(){ return Promise.resolve({type:'offer', sdp:''}); }
    setLocalDescription(){
      setTimeout(() => {
        cands.forEach(c => this.onicecandidate && this.onicecandidate({candidate:{candidate:c}}));
        this.iceGatheringState='complete';
        this.onicecandidate && this.onicecandidate({candidate:null});
      }, 50);
      return Promise.resolve();
    }
    close(){}
  }
  window.RTCPeerConnection = FakePC;
})();
"""

WHO = {"ip":"185.65.134.10","asn":9009,"asOrganization":"M247 Europe SRL","city":"Bucharest","region":"Bucharest","country":"RO",
       "timezone":"Europe/Bucharest","colo":"OTP","httpProtocol":"HTTP/2","tlsVersion":"TLSv1.3",
       "headers":{"accept-language":"en-US,en;q=0.9","x-forwarded-for":"185.65.134.10","sec-ch-ua-platform":"\"Windows\""}}

SCENARIOS = {
  'clean': dict(who=WHO, v6=None, ipwho=None,
     cands=["candidate:1 1 udp 2113937151 a1b2c3d4.local 51000 typ host generation 0",
            "candidate:2 1 udp 1677729535 185.65.134.10 51000 typ srflx raddr 0.0.0.0 rport 0 generation 0"],
     tz='Europe/Bucharest',
     expect=dict(ip='pass', webrtc='pass', ipv6='pass', dns='na', tz='pass', headers='info'), leaks=0),
  'leaky': dict(who=dict(WHO, headers=dict(WHO['headers'], via='1.1 squid')), v6='2001:db8::1',
     ipwho={"success":True,"connection":{"asn":7922,"org":"Comcast Cable Communications, LLC"},"country_code":"US"},
     cands=["candidate:1 1 udp 2113937151 192.168.1.23 51000 typ host generation 0",
            "candidate:2 1 udp 1677729535 185.65.134.10 51000 typ srflx raddr 0.0.0.0 rport 0 generation 0",
            "candidate:3 1 udp 1677729535 203.0.113.9 51001 typ srflx raddr 0.0.0.0 rport 0 generation 0"],
     tz='Asia/Shanghai',
     expect=dict(ip='pass', webrtc='fail', ipv6='fail', dns='na', tz='warn', headers='warn'), leaks=2),
}

def run_scenario(p, name, sc, viewport, mobile=False, shot=None, vpn_toggle_check=False):
    b = p.chromium.launch()
    ctx = b.new_context(viewport=viewport, is_mobile=mobile, device_scale_factor=1, timezone_id=sc['tz'], locale='en-US')
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.add_init_script(FAKE_RTC % json.dumps(sc['cands']))
    page.route('**/api/whoami', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(sc['who'])))
    page.route('https://api4.ipify.org/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps({'ip': sc['who']['ip']})))
    if sc['v6']:
        page.route('https://api6.ipify.org/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps({'ip': sc['v6']})))
    else:
        page.route('https://api6.ipify.org/**', lambda r: r.abort())
    if sc['ipwho']:
        page.route('https://ipwho.is/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body=json.dumps(sc['ipwho'])))
    page.goto(URL, wait_until='networkidle')
    if shot: page.screenshot(path=f'{SHOTS}/{shot}-before.png', full_page=False)
    page.click('#run')
    expect(page.locator('#run')).to_have_text('Run test again', timeout=15000)
    got = {tr.get_attribute('data-check'): tr.get_attribute('data-status') for tr in page.query_selector_all('tr[data-check]')}
    assert got == sc['expect'], f'{name}: {got} != {sc["expect"]}'
    leaks = page.eval_on_selector_all('#bypass-list li', 'els => els.length')
    assert leaks == sc['leaks'], f'{name}: leaks {leaks}'
    assert page.is_hidden('#bypass') == (sc['leaks'] == 0)
    overflow = page.evaluate('document.documentElement.scrollWidth - window.innerWidth')
    assert overflow <= 0, f'{name}: horizontal overflow {overflow}px'
    assert page.evaluate("document.fonts.check('800 20px \"Atkinson Next\"')"), 'font not loaded'
    summary = page.inner_text('#summary')
    if shot:
        page.locator('#route').scroll_into_view_if_needed()
        page.screenshot(path=f'{SHOTS}/{shot}-after.png', full_page=True)
    if vpn_toggle_check:
        page.uncheck('#vpn')
        got2 = {tr.get_attribute('data-check'): tr.get_attribute('data-status') for tr in page.query_selector_all('tr[data-check]')}
        assert got2['webrtc'] == 'info' and got2['ip'] == 'info', got2
        assert page.is_hidden('#bypass'), 'leak path should disappear when VPN unticked'
        page.check('#vpn')
        got3 = {tr.get_attribute('data-check'): tr.get_attribute('data-status') for tr in page.query_selector_all('tr[data-check]')}
        assert got3 == sc['expect'], got3
    b.close()
    print(f'ok  {name} [{viewport["width"]}px]: {got} | "{summary}"')
    return errors

with sync_playwright() as p:
    errs = []
    errs += run_scenario(p, 'clean', SCENARIOS['clean'], {'width':1280,'height':900}, shot='clean-desktop')
    errs += run_scenario(p, 'leaky', SCENARIOS['leaky'], {'width':1280,'height':900}, shot='leaky-desktop', vpn_toggle_check=True)
    errs += run_scenario(p, 'leaky', SCENARIOS['leaky'], {'width':390,'height':844}, mobile=True, shot='leaky-mobile')
    errs += run_scenario(p, 'clean', SCENARIOS['clean'], {'width':390,'height':844}, mobile=True, shot='clean-mobile')

    # Real RTCPeerConnection, no mock, no network: must finish without throwing.
    b = p.chromium.launch(); page = b.new_page()
    perr = []; page.on('pageerror', lambda e: perr.append(str(e)))
    page.route('**/api/whoami', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(WHO)))
    page.route('https://api4.ipify.org/**', lambda r: r.abort()); page.route('https://api6.ipify.org/**', lambda r: r.abort())
    page.goto(URL); page.click('#run')
    expect(page.locator('#run')).to_have_text('Run test again', timeout=20000)
    st = {tr.get_attribute('data-check'): tr.get_attribute('data-status') for tr in page.query_selector_all('tr[data-check]')}
    print('ok  real RTCPeerConnection, offline lookups:', st, perr)
    assert not perr
    b.close()

    # Lookups all fail: page must degrade, not break.
    b = p.chromium.launch(); page = b.new_page()
    perr = []; page.on('pageerror', lambda e: perr.append(str(e)))
    page.route('**/api/whoami', lambda r: r.fulfill(status=500, body='x'))
    page.route('https://api4.ipify.org/**', lambda r: r.abort()); page.route('https://api6.ipify.org/**', lambda r: r.abort())
    page.goto(URL); page.click('#run')
    expect(page.locator('#run')).to_have_text('Run test again', timeout=20000)
    st = {tr.get_attribute('data-check'): tr.get_attribute('data-status') for tr in page.query_selector_all('tr[data-check]')}
    print('ok  all lookups failing:', st, '|', page.inner_text('#summary'), perr)
    assert not perr and st['ip'] == 'na'
    b.close()

    bad = [e for e in errs if 'Content Security Policy' in e or 'Refused' in e or 'violat' in e.lower()]
    print('console messages:', errs)
    assert not bad, bad
srv.shutdown()
print('\nE2E passed')
