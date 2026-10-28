# W6: Chinese photo metadata remover page (/zh/tools/photo-metadata-remover/), served with the CSP
# from _headers for that path. Also checks the English page still reads in English.
import http.server, threading, socketserver, os, re, tempfile
from playwright.sync_api import sync_playwright
from PIL import Image
import piexif

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
hdr = open(os.path.join(ROOT, '_headers')).read()
csp_zh = re.search(r'/zh/tools/photo-metadata-remover/\n\s*Content-Security-Policy: (.*)', hdr).group(1)
csp_tools = re.search(r'/tools/\*\n\s*Content-Security-Policy: (.*)', hdr).group(1)
assert csp_zh == csp_tools, 'zh tool page must use the tools CSP'

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s): s.send_header('Content-Security-Policy', csp_tools); super().end_headers()
    def log_message(s, *a): pass

srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}'
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)

tmp = tempfile.mkdtemp(prefix='zhphoto-')
jpg = os.path.join(tmp, 'gps.jpg')
Image.new('RGB', (64, 48), (120, 30, 200)).save(jpg, 'JPEG')
exif = {'0th': {piexif.ImageIFD.Make: b'TestCam'}, 'Exif': {piexif.ExifIFD.DateTimeOriginal: b'2026:10:20 10:00:00'},
        'GPS': {piexif.GPSIFD.GPSLatitudeRef: b'N', piexif.GPSIFD.GPSLatitude: ((37, 1), (46, 1), (3000, 100)),
                piexif.GPSIFD.GPSLongitudeRef: b'W', piexif.GPSIFD.GPSLongitude: ((122, 1), (25, 1), (0, 1))}}
piexif.insert(piexif.dump(exif), jpg)
txt = os.path.join(tmp, 'a.txt'); open(txt, 'w').write('hello')

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 800}, accept_downloads=True)
    errs, reqs = [], []
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('request', lambda r: reqs.append(r.url))
    pg.goto(base + '/zh/tools/photo-metadata-remover/'); pg.wait_for_load_state('networkidle')
    ok(pg.evaluate('document.documentElement.lang') == 'zh-CN', 'lang is zh-CN')
    ok(pg.locator('h1').inner_text().strip() == '照片元数据清理', 'h1')
    crumbs = pg.locator('nav.breadcrumbs a')
    ok(crumbs.nth(0).get_attribute('href') == '/zh/' and crumbs.nth(0).inner_text() == '首页', 'breadcrumb home -> /zh/')
    side = pg.locator('.tool-sidebar').inner_text()
    ok(all(k in side for k in ['你的数据如何处理', '留在本机：照片和读出的元数据', '无', '本地处理']), 'sidebar data flow in Chinese')
    ok('本页发出的网络请求' in pg.locator('#netlog summary').inner_text(), 'network panel title in Chinese')
    heads = pg.locator('#netlog thead th').all_text_contents()
    ok(heads == ['时间', '类型', '地址', '大小'], f'network table headers {heads}')
    n0 = pg.evaluate("performance.getEntriesByType('resource').length")
    ok(int(pg.locator('#netlog .netlog-count').inner_text()) == n0, 'panel count matches Resource Timing')
    ok(pg.locator('#clean').is_hidden(), 'clean button hidden before a photo')
    pg.set_input_files('#file', jpg)
    pg.wait_for_function("() => document.getElementById('summary').textContent.indexOf('元数据') !== -1")
    ok(pg.locator('#summary').inner_text().strip() == '这张照片带有元数据。分享前先删掉。', 'summary in Chinese')
    body = pg.locator('#rows').inner_text()
    ok('位置' in body and '已找到' in body and '37.7' in body, 'location row with coordinates')
    ok(pg.locator('#clean').inner_text().strip() == '删除元数据并下载', 'clean button label')
    ok(pg.locator('#netlog .netlog-marker').text_content().strip() == '你选择了一张照片', 'marker row in Chinese')
    ok(pg.evaluate("performance.getEntriesByType('resource').length") == n0, 'no requests after picking a photo')
    with pg.expect_download() as d:
        pg.click('#clean')
    path = str(d.value.path()); name = d.value.suggested_filename
    ok(name.endswith('-clean.jpg'), f'download name {name}')
    ok(not piexif.load(path)['GPS'], 'downloaded copy has no GPS')
    pg.wait_for_function("() => document.getElementById('summary').textContent.indexOf('完成') === 0")
    ok(pg.locator('#summary').inner_text().strip() == '完成。清理后的副本已保存到下载文件夹，原文件没有改动。', 'done message')
    pg.set_input_files('#file', txt)
    pg.wait_for_function("() => document.getElementById('summary').textContent.indexOf('JPEG') !== -1")
    ok('这里只支持 JPEG、PNG 和 WebP 照片。' in pg.locator('#summary').inner_text(), 'unsupported file message')
    ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no horizontal scroll at 390 px')
    ext = [u for u in reqs if not (u.startswith(base) or u.startswith('blob:') or u.startswith('data:'))]
    ok(not ext, f'no outside requests {ext}')
    ok(not errs, f'no console errors {errs}')
    pg.screenshot(path=os.path.join(tmp, 'zh.png'), full_page=True)
    pg.close()

    pg = b.new_page()
    pg.goto(base + '/tools/photo-metadata-remover/'); pg.wait_for_load_state('networkidle')
    ok(pg.evaluate('document.documentElement.lang') == 'en', 'English page lang en')
    ok(pg.locator('#netlog thead th').all_text_contents() == ['Time', 'Type', 'Address', 'Size'], 'English panel headers')
    pg.set_input_files('#file', jpg)
    pg.wait_for_function("() => document.getElementById('summary').textContent.length > 0")
    ok(pg.locator('#summary').inner_text().strip() == 'This photo carries metadata. Remove it before you share it.', 'English summary unchanged')
    ok(pg.locator('#netlog .netlog-marker').text_content().strip() == 'You picked a photo', 'English marker unchanged')
    b.close()
srv.shutdown()
print('screenshot:', os.path.join(tmp, 'zh.png'))
print('FAILED: %d' % len(fails) if fails else 'all passed')
raise SystemExit(1 if fails else 0)
