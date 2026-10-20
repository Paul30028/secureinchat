import socket, struct, subprocess, sys, time, json, urllib.request, os, signal
P = subprocess.Popen([sys.executable, os.path.join(os.path.dirname(__file__), '..', 'infra', 'dnsleak', 'server.py'),
                      '--zone', 'lk.example.test', '--dns-bind', '127.0.0.1:5353', '--http-bind', '127.0.0.1:8099'])
time.sleep(1)
fails = []
def ok(c, m):
    print(('ok   ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def q(name, qtype=1, tcp=False, qid=0x1234):
    wire = b''.join(bytes([len(l)]) + l.encode() for l in name.split('.')) + b'\0'
    msg = struct.pack('!HHHHHH', qid, 0x0100, 1, 0, 0, 0) + wire + struct.pack('!HH', qtype, 1)
    if tcp:
        s = socket.create_connection(('127.0.0.1', 5353), 3); s.sendall(struct.pack('!H', len(msg)) + msg)
        n = struct.unpack('!H', s.recv(2))[0]; r = s.recv(n); s.close(); return r
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(3); s.sendto(msg, ('127.0.0.1', 5353)); r = s.recv(2000); s.close(); return r
def hdr(r):
    qid, fl, qd, an, ns, ar = struct.unpack('!HHHHHH', r[:12]); return qid, fl & 0xF, fl >> 15, (fl >> 10) & 1, an, ns
try:
    tid = 'abcdef012345'
    r = q(f'{tid}-1.lk.example.test'); qid, rc, qr, aa, an, ns = hdr(r)
    ok(qid == 0x1234 and rc == 0 and qr == 1 and aa == 1 and an == 1 and r[-4:] == bytes([127, 0, 0, 1]), 'A answer 127.0.0.1, AA set')
    r = q(f'{tid.upper()}-2.LK.Example.Test'); ok(hdr(r)[1] == 0 and hdr(r)[4] == 1, 'case-insensitive (0x20) names answered')
    r = q(f'{tid}-3.lk.example.test', qtype=28); ok(hdr(r)[1] == 0 and hdr(r)[4] == 0 and hdr(r)[5] == 1, 'AAAA gives NODATA with SOA')
    r = q(f'{tid}-4.lk.example.test', tcp=True); ok(hdr(r)[4] == 1, 'TCP works')
    r = q('www.google.com'); ok(hdr(r)[1] == 5, 'outside zone is REFUSED (not an open resolver)')
    r = q('x.lk.example.test'); ok(hdr(r)[1] == 3, 'unknown label is NXDOMAIN')
    r = q('lk.example.test', qtype=2); ok(hdr(r)[1] == 0 and hdr(r)[4] == 1, 'apex NS answered')
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(1); s.sendto(b'\x00\x01garbage', ('127.0.0.1', 5353))
    try: s.recv(100); ok(False, 'garbage should be ignored')
    except socket.timeout: ok(True, 'garbage packet ignored')
    got = json.load(urllib.request.urlopen(f'http://127.0.0.1:8099/r?id={tid}'))
    ok(got == {'resolvers': ['127.0.0.1']}, f'API returns the resolver: {got}')
    ok(json.load(urllib.request.urlopen('http://127.0.0.1:8099/r?id=000000000000')) == {'resolvers': []}, 'unknown id gives empty list')
    try: urllib.request.urlopen('http://127.0.0.1:8099/r?id=zz'); ok(False, 'bad id should 400')
    except urllib.error.HTTPError as e: ok(e.code == 400, 'bad id rejected with 400')
    req = urllib.request.Request(f'http://127.0.0.1:8099/r?id={tid}'); resp = urllib.request.urlopen(req)
    ok(resp.headers['Access-Control-Allow-Origin'] == 'https://secureinchat.com' and resp.headers['Cache-Control'] == 'no-store', 'CORS pinned to the site, no-store')
finally:
    P.send_signal(signal.SIGTERM); P.wait()
print('FAILED' if fails else 'DNS SERVER TESTS PASSED'); sys.exit(1 if fails else 0)
