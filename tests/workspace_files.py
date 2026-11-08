import http.server, threading, socketserver, os, re, zipfile, shutil, tempfile
from docx import Document
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
csp = re.search(r'/workspace/\*?\n\s*Content-Security-Policy: (.*)', open(os.path.join(ROOT, '_headers')).read()).group(1)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp); super().end_headers()
    def log_message(s, *a): pass

srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

# A DOCX with a known author, last-modified-by and company in its metadata.
path = os.path.join(tempfile.gettempdir(), f'ws-secret-plan-{os.getpid()}.docx')
doc = Document()
doc.add_paragraph('Body text: the meeting is on Friday.')
doc.core_properties.author = 'Secret Author'
doc.core_properties.last_modified_by = 'Secret Author'
doc.core_properties.comments = 'Secret Comment'
doc.save(path)
tmp = path + '.tmp'
with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == 'docProps/app.xml':
            data = data.replace(b'<Company/>', b'<Company>Secret Corp</Company>')
        zout.writestr(item, data)
shutil.move(tmp, path)
with zipfile.ZipFile(path) as z:
    ok(b'Secret Author' in z.read('docProps/core.xml') and b'Secret Corp' in z.read('docProps/app.xml'),
       'fixture DOCX carries author and company metadata')

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(accept_downloads=True)
    outside, errors, violations = [], [], []
    pg.on('request', lambda r: outside.append(r.url) if not r.url.startswith(f'http://127.0.0.1:{port}') else None)
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto(f'http://127.0.0.1:{port}/workspace/')
    pg.evaluate("document.addEventListener('securitypolicyviolation',e=>{(window.__v=window.__v||[]).push(e.violatedDirective+' '+e.blockedURI)})")

    # Choosing through the unified intake area must switch to File mode by itself.
    pg.set_input_files('#intake-file', path)
    pg.wait_for_selector('#file-confirm', timeout=20000)
    ok(pg.is_visible('#panel-file'), 'choosing a DOCX in the intake area opens File mode')
    ok(pg.get_attribute('#tab-file', 'aria-selected') == 'true', 'File tab is selected automatically')
    text = pg.inner_text('#file-result')
    ok('Secret Author' in text, 'author is listed')
    ok('Secret Corp' in text, 'company is listed')

    pg.check('#file-confirm')
    pg.wait_for_selector('#file-generate:not([disabled])', timeout=5000)
    with pg.expect_download() as d:
        pg.click('#file-generate')
        pg.wait_for_selector('#download-file', timeout=15000)
        pg.click('#download-file')
    dl = d.value
    ok(dl.suggested_filename == 'file-cleaned.docx', f'download is named file-cleaned.docx ({dl.suggested_filename})')
    out = open(dl.path(), 'rb').read()
    with zipfile.ZipFile(dl.path()) as z:
        names = z.namelist()
        core = z.read('docProps/core.xml') if 'docProps/core.xml' in names else b''
        app = z.read('docProps/app.xml') if 'docProps/app.xml' in names else b''
        ok(b'Secret Author' not in core, 'author string is gone from docProps/core.xml')
        ok(b'Secret Corp' not in app, 'company string is gone from docProps/app.xml')
        all_bytes = b''.join(z.read(n) for n in names)
        ok(b'Secret Author' not in all_bytes and b'Secret Corp' not in all_bytes, 'neither secret string remains anywhere in the copy')
        ok(b'Friday' in all_bytes, 'document body is kept')
    ok(out[:2] == b'PK', 'download is a real ZIP-based DOCX')

    # Pasting one URL must switch to Link mode and fill the link field.
    # File mode still holds the processed file, so switching asks first (native confirm); accept it.
    pg.once('dialog', lambda d: d.accept())
    pg.evaluate("""() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'https://example.com/a?utm_source=x');
      const event = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: dt });
      document.body.dispatchEvent(event);
    }""")
    pg.wait_for_selector('#panel-link:not([hidden])', timeout=5000)
    ok(pg.is_visible('#panel-link'), 'pasting a URL opens Link mode')
    ok(pg.input_value('#link-url') == 'https://example.com/a?utm_source=x', 'pasted URL fills the link field')
    ok('Recognised as a link' in pg.inner_text('#status'), 'status says the paste was recognised as a link')

    ok(not outside, f'no request left the local server {outside}')
    ok(not errors, f'no console errors {errors}')
    ok(not pg.evaluate('window.__v||[]'), f'no CSP violations {pg.evaluate("window.__v||[]")}')
    b.close()
srv.shutdown()
raise SystemExit(1 if fails else 0)
