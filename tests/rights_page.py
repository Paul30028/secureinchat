import sys, os, threading, http.server, socketserver, functools, json, re
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}'
fails = []
def check(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

headers = open(os.path.join(ROOT, '_headers'), encoding='utf-8').read()
rights_headers = re.search(r'^/rights/\*\n((?:  .*\n)+)', headers, re.M)
check(rights_headers is not None and "connect-src 'none'" in rights_headers.group(1), '/rights/* CSP has connect-src none')

with sync_playwright() as p:
    b = p.chromium.launch()
    for vp in [{'width': 1280, 'height': 900}, {'width': 320, 'height': 800}]:
        page = b.new_page(viewport=vp)
        console_errors = []
        page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: console_errors.append(str(e)))
        requests = []
        page.on('request', lambda r: requests.append(r.url))
        page.add_init_script("""
          window.__storageWrites = 0;
          const bump = () => { window.__storageWrites += 1; };
          for (const proto of [Storage.prototype]) {
            for (const name of ['setItem', 'removeItem', 'clear']) {
              const original = proto[name];
              proto[name] = function (...args) { bump(); return original.apply(this, args); };
            }
          }
          const open = indexedDB.open.bind(indexedDB);
          indexedDB.open = function (...args) { bump(); return open(...args); };
        """)
        page.goto(BASE + '/rights/')
        page.wait_for_load_state('networkidle')
        n0 = len(requests)

        check('not legal advice' in page.inner_text('body').lower(), f'not legal advice shown {vp["width"]}')
        check(page.locator('#rights-draft-note').is_hidden(), 'verified GDPR has no draft banner')
        jurisdiction_text = page.locator('#rights-jurisdiction').text_content()
        check('Verified: European Union / EEA (GDPR)' in jurisdiction_text, 'GDPR marked verified')
        check('Draft, rules not verified' in jurisdiction_text, 'unverified options labelled draft')

        page.fill('#rights-company', 'Acme Ltd')
        page.fill('#rights-email', 'privacy@acme.example')
        page.select_option('#rights-right', 'erasure')
        page.check('#rights-use-fullname')
        page.fill('#rights-fullname', 'Alex Example')
        page.fill('#rights-identity-email', 'alex@example.test')
        page.fill('#rights-city', 'Austin')
        page.click('#rights-generate')

        letter = page.locator('#rights-letter').text_content()
        check('Alex Example' in letter and 'Acme Ltd' in letter, 'selected field and company in letter')
        check('Article 17 of the GDPR' in letter, 'GDPR erasure article cited')
        check('Article 12(3)' in letter, 'GDPR deadline article cited')
        check('Article 19' in letter, 'GDPR recipient notification article cited')
        check('SecureInChat' not in letter, 'letter does not expose the tool')
        check('alex@example.test' not in letter and 'Austin' not in letter, 'unticked identity fields are absent')
        check('This is not legal advice' not in letter, 'letter itself does not need the page disclaimer')
        mailto = page.get_attribute('#rights-mailto', 'href')
        check(mailto.startswith('mailto:privacy@acme.example?'), f'mailto recipient correct ({mailto[:40]})')
        q = parse_qs(urlparse(mailto).query)
        check(q['subject'][0] == 'Data rights request (Regulation (EU) 2016/679 (GDPR)) - Acme Ltd', 'mailto subject')
        check(q['body'][0] == letter, 'mailto body matches generated letter')

        page.fill('#rights-sent-date', '2026-11-08')
        page.fill('#rights-today', '2026-11-08')
        page.click('#rights-mark-sent')
        tracked = page.inner_text('#rights-list')
        check('2026-12-08' in tracked, 'GDPR deadline is 30 days after sending')
        check('30 days left' in tracked, 'countdown starts at 30 days')
        check('Reminder date 2026-12-05' in tracked, 'reminder date shown from deadlines engine')

        page.fill('#rights-today', '2026-12-10')
        page.dispatch_event('#rights-today', 'change')
        tracked = page.inner_text('#rights-list')
        check('Generate follow-up letter' in tracked, 'follow-up button appears after deadline')
        check('Generate regulator complaint draft' not in tracked, 'complaint is not offered at first overdue')

        page.fill('#rights-today', '2027-02-10')
        page.dispatch_event('#rights-today', 'change')
        tracked = page.inner_text('#rights-list')
        check('Generate regulator complaint draft' in tracked, 'complaint draft appears after the extension window')
        check('edpb.europa.eu' in page.get_attribute('#rights-list a.rights-regulator', 'href'), 'regulator link present')

        page.click('#rights-clear')
        check(page.locator('#rights-letter-section').is_hidden(), 'clear hides the letter')
        check('No requests recorded' in page.inner_text('#rights-list'), 'clear removes records')

        page.select_option('#rights-jurisdiction', 'us-ca')
        check(page.locator('#rights-draft-note').is_visible(), 'unverified jurisdiction shows draft banner')
        page.fill('#rights-company', 'Draft Co')
        page.fill('#rights-email', 'privacy@draft.example')
        page.check('#rights-use-fullname')
        page.fill('#rights-fullname', 'Sam Draft')
        page.click('#rights-generate')
        draft_letter = page.locator('#rights-letter').text_content()
        check(draft_letter.startswith('DRAFT:'), 'draft notice is at the top of the letter')
        check('not been verified' in draft_letter, 'draft letter says rules are unverified')
        check('Article' not in draft_letter, 'unverified letter has no article numbers')

        check(len(requests) == n0, f'no network requests after load ({len(requests) - n0}) {requests[n0:]}')
        check(all(urlparse(u).netloc == f'127.0.0.1:{srv.server_address[1]}' for u in requests), 'all requests stayed on the local test origin')
        check(page.evaluate('window.__storageWrites') == 0, 'zero storage writes')
        check(page.evaluate('localStorage.length + sessionStorage.length') == 0, 'local and session storage empty')
        check(page.evaluate('document.cookie') == '', 'no cookies')
        check(not console_errors, f'no console errors {console_errors}')
        check(page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth') <= 0, f'no horizontal overflow at {vp["width"]}px')
        page.close()
    b.close()

print('\nRIGHT PAGE PASSED' if not fails else '\nRIGHT PAGE FAILED', *fails, sep='\n')
sys.exit(1 if fails else 0)
