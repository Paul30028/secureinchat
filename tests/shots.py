import json, os, sys, threading, http.server, socketserver
from playwright.sync_api import sync_playwright, expect
ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
OUT = sys.argv[1]
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/tools/ip-leak-test/'
WHO = {"ip":"185.65.134.10","asn":9009,"asOrganization":"M247 Europe SRL","city":"Bucharest","country":"RO","timezone":"Europe/Bucharest",
       "headers":{"accept-language":"en-US,en;q=0.9","via":"1.1 squid","sec-ch-ua-platform":"\"Windows\""}}
C = ["candidate:1 1 udp 2113937151 192.168.1.23 51000 typ host generation 0","candidate:2 1 udp 1677729535 185.65.134.10 51000 typ srflx raddr 0.0.0.0 rport 0 generation 0","candidate:3 1 udp 1677729535 203.0.113.9 51001 typ srflx raddr 0.0.0.0 rport 0 generation 0"]
RTC = """(()=>{const c=%s;class P{constructor(){this.iceGatheringState='new'}createDataChannel(){return{}}createOffer(){return Promise.resolve({})}setLocalDescription(){setTimeout(()=>{c.forEach(x=>this.onicecandidate&&this.onicecandidate({candidate:{candidate:x}}));this.onicecandidate&&this.onicecandidate({candidate:null})},50);return Promise.resolve()}close(){}}window.RTCPeerConnection=P})();""" % json.dumps(C)
def prep(page):
    page.add_init_script(RTC)
    page.route('**/api/whoami', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(WHO)))
    page.route('https://api4.ipify.org/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body='{"ip":"185.65.134.10"}'))
    page.route('https://api6.ipify.org/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body='{"ip":"2001:db8::1"}'))
    page.route('https://ipwho.is/**', lambda r: r.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin':'*'}, body='{"success":true,"connection":{"asn":7922,"org":"Comcast Cable Communications, LLC"},"country_code":"US"}'))
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp, mobile in [('d', {'width':1280,'height':900}, False), ('m', {'width':390,'height':844}, True)]:
        ctx = b.new_context(viewport=vp, is_mobile=mobile, timezone_id='Asia/Shanghai'); page = ctx.new_page(); prep(page)
        page.goto(URL, wait_until='networkidle')
        page.screenshot(path=f'{OUT}/{name}-1-hero-before.png')
        page.click('#run'); expect(page.locator('#run')).to_have_text('Run test again', timeout=15000)
        page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
        page.screenshot(path=f'{OUT}/{name}-2-hero-after.png')
        y = page.evaluate("document.getElementById('results').getBoundingClientRect().top + window.scrollY")
        page.evaluate(f"window.scrollTo({{top:{y-10},behavior:'instant'}})")
        page.screenshot(path=f'{OUT}/{name}-3-results.png')
        if mobile:
            page.evaluate(f"window.scrollTo({{top:{y+800},behavior:'instant'}})"); page.screenshot(path=f'{OUT}/{name}-4-results2.png')
        ctx.close()
    b.close()
srv.shutdown()
