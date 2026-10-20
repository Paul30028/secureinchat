#!/usr/bin/env python3
"""
Authoritative DNS server for the SecureInChat DNS leak test. Python 3.8+, standard library only.

What it does
  * Answers A queries for  <12 hex>-<n>.<ZONE>  with 127.0.0.1 (TTL 1), remembers which resolver asked,
    and serves the list of resolvers for one test id over a small HTTP API on localhost.
  * Answers nothing else: every name outside ZONE gets REFUSED, so it cannot be used as an open resolver.
  * Keeps resolver addresses in memory for TTL_SECONDS and writes no logs. The only thing it can store on disk is an
    aggregate count per day (--stats-file): how many tests reached it and how many results were read back.

Run:  python3 server.py --zone lk.secureinchat.com --dns-bind 0.0.0.0:53 --http-bind 127.0.0.1:8081
"""
import argparse, asyncio, json, os, re, socket, struct, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

TTL_SECONDS = 600
MAX_IDS = 20000
MAX_RESOLVERS_PER_ID = 20
RATE_LIMIT = 100          # queries per source address per 10 s
LABEL_RE = re.compile(r'^([0-9a-f]{12})-(\d{1,2})$')
ID_RE = re.compile(r'^[0-9a-f]{12}$')

store = {}                # id -> {"t": first_seen, "ips": {ip: count}, "done": bool}
lock = threading.Lock()
stats = {}                # "YYYY-MM-DD" (UTC) -> {"confirmed": n, "completed": n}; aggregate counts only, no addresses
stats_dirty = False
STATS_DAYS = 60
COUNT_CAP_PER_HOUR = 30     # new tests counted per resolver address per hour, so one script cannot inflate the numbers
count_window = {}         # resolver ip -> (hour, n); in memory only, never written out
rate = {}                 # ip -> (window_start, count)


def now():
    return time.monotonic()


def today():
    return time.strftime('%Y-%m-%d', time.gmtime())


def bump(field):
    """Count one event for today. Call with the lock held."""
    global stats_dirty
    d = stats.setdefault(today(), {"confirmed": 0, "completed": 0})
    d[field] += 1
    stats_dirty = True
    for k in sorted(stats)[:-STATS_DAYS]:
        del stats[k]


def remember(test_id, ip):
    with lock:
        t = now()
        if len(store) > MAX_IDS:                       # drop expired, then oldest, to stay bounded
            for k in [k for k, v in store.items() if t - v["t"] > TTL_SECONDS]:
                del store[k]
            while len(store) > MAX_IDS:
                del store[min(store, key=lambda k: store[k]["t"])]
        counted = False
        if test_id not in store:
            hour = int(time.time() // 3600)
            h, n = count_window.get(ip, (hour, 0))
            if h != hour:
                h, n = hour, 0
            if len(count_window) > 50000:
                count_window.clear()
            count_window[ip] = (h, n + 1)
            if n < COUNT_CAP_PER_HOUR:
                counted = True
                bump("confirmed")                        # the authoritative server saw a query for a new test
        e = store.setdefault(test_id, {"t": t, "ips": {}, "done": not counted})
        if ip in e["ips"] or len(e["ips"]) < MAX_RESOLVERS_PER_ID:
            e["ips"][ip] = e["ips"].get(ip, 0) + 1


def lookup(test_id):
    with lock:
        e = store.get(test_id)
        if not e or now() - e["t"] > TTL_SECONDS:
            return []
        if not e["done"]:
            e["done"] = True
            bump("completed")                            # the page read the result back for a confirmed test
        return sorted(e["ips"])


def load_stats(path):
    global stats
    try:
        with open(path) as f:
            data = json.load(f)
        stats = {k: {"confirmed": int(v.get("confirmed", 0)), "completed": int(v.get("completed", 0))}
                 for k, v in data.items() if re.match(r'^\d{4}-\d{2}-\d{2}$', k)}
    except Exception:
        stats = {}


def save_stats_loop(path):
    global stats_dirty
    while True:
        time.sleep(30)
        with lock:
            if not stats_dirty:
                continue
            snap = json.dumps(stats)
            stats_dirty = False
        try:
            tmp = path + '.tmp'
            with open(tmp, 'w') as f:
                f.write(snap)
            os.replace(tmp, path)
        except Exception:
            pass


def stats_snapshot():
    with lock:
        return json.dumps({"days": {k: dict(v) for k, v in sorted(stats.items())}, "note": "Aggregate counts per UTC day. confirmed = tests whose DNS query reached this server; completed = confirmed tests whose result was read back. Not a count of people."})


def limited(ip):
    t = now()
    w, c = rate.get(ip, (t, 0))
    if t - w > 10:
        w, c = t, 0
    rate[ip] = (w, c + 1)
    if len(rate) > 50000:
        rate.clear()
    return c + 1 > RATE_LIMIT


# ---- DNS wire format -------------------------------------------------------------------------------------------------

def parse_question(data):
    """Returns (id, flags, qname_labels, qtype, qclass, question_bytes) or None."""
    if len(data) < 12:
        return None
    qid, flags, qd, an, ns, ar = struct.unpack('!HHHHHH', data[:12])
    if flags & 0x8000 or qd != 1 or (flags >> 11) & 0xF != 0:   # responses and non-QUERY opcodes are ignored
        return None
    i, labels = 12, []
    while True:
        if i >= len(data):
            return None
        n = data[i]
        if n == 0:
            i += 1
            break
        if n & 0xC0 or n > 63 or i + 1 + n > len(data):
            return None
        labels.append(data[i + 1:i + 1 + n].decode('ascii', 'replace'))
        i += 1 + n
    if i + 4 > len(data):
        return None
    qtype, qclass = struct.unpack('!HH', data[i:i + 4])
    return qid, flags, labels, qtype, qclass, data[12:i + 4]


def build(qid, flags_in, question, rcode, answers=b'', an_count=0, authority=b'', ns_count=0):
    rd = flags_in & 0x0100
    flags = 0x8000 | 0x0400 | rd | rcode            # QR, AA, RD echoed
    return struct.pack('!HHHHHH', qid, flags, 1, an_count, ns_count, 0) + question + answers + authority


def encode_name(name):
    return b''.join(bytes([len(p)]) + p.encode() for p in name.split('.') if p) + b'\0'


def rr(name_ptr, rtype, ttl, rdata):
    return name_ptr + struct.pack('!HHIH', rtype, 1, ttl, len(rdata)) + rdata


class Zone:
    def __init__(self, zone, ns_name, ns_ip):
        self.zone = zone.lower().strip('.')
        self.parts = self.zone.split('.')
        self.ns_name, self.ns_ip = ns_name, ns_ip

    def soa(self):
        rdata = (encode_name(self.ns_name) + encode_name('hostmaster.' + self.zone)
                 + struct.pack('!IIIII', 2026102001, 3600, 600, 86400, 1))
        return rr(b'\xc0\x0c', 6, 1, rdata)

    def answer(self, data, src_ip):
        q = parse_question(data)
        if not q:
            return None
        qid, flags, labels, qtype, qclass, question = q
        low = [l.lower() for l in labels]
        n = len(self.parts)
        if len(low) < n or low[-n:] != self.parts or qclass not in (1, 255):
            return build(qid, flags, question, 5)                                   # REFUSED
        sub = low[:-n]
        apex = ptr_apex = b'\xc0\x0c'
        if not sub:                                                                 # the zone apex
            if qtype in (2, 255):
                return build(qid, flags, question, 0, rr(apex, 2, 300, encode_name(self.ns_name)), 1)
            if qtype == 6:
                return build(qid, flags, question, 0, self.soa(), 1)
            return build(qid, flags, question, 0, b'', 0, self.soa(), 1)            # NODATA
        m = LABEL_RE.match(sub[0]) if len(sub) == 1 else None
        if not m:
            return build(qid, flags, question, 3, b'', 0, self.soa(), 1)            # NXDOMAIN
        if not limited(src_ip):
            remember(m.group(1), src_ip)
        if qtype in (1, 255):
            return build(qid, flags, question, 0, rr(ptr_apex, 1, 1, socket.inet_aton('127.0.0.1')), 1)
        return build(qid, flags, question, 0, b'', 0, self.soa(), 1)                # NODATA for AAAA etc.


# ---- transports ------------------------------------------------------------------------------------------------------

class UDP(asyncio.DatagramProtocol):
    def __init__(self, zone):
        self.zone = zone

    def connection_made(self, transport):
        self.t = transport

    def datagram_received(self, data, addr):
        try:
            resp = self.zone.answer(data, addr[0])
        except Exception:
            resp = None
        if resp:
            self.t.sendto(resp[:1232], addr)       # answers are tiny; the cap only guards against surprises


async def tcp_client(zone, reader, writer):
    try:
        peer = writer.get_extra_info('peername')[0]
        for _ in range(8):
            hdr = await asyncio.wait_for(reader.readexactly(2), 5)
            data = await asyncio.wait_for(reader.readexactly(struct.unpack('!H', hdr)[0]), 5)
            resp = zone.answer(data, peer)
            if not resp:
                break
            writer.write(struct.pack('!H', len(resp)) + resp)
            await writer.drain()
    except Exception:
        pass
    finally:
        writer.close()


class API(BaseHTTPRequestHandler):
    origin = 'https://secureinchat.com'

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype='application/json'):
        b = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', self.origin)
        self.send_header('Vary', 'Origin')
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', self.origin)
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.send_header('Access-Control-Max-Age', '600')
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/h':
            return self._send(200, 'ok', 'text/plain')
        if u.path == '/s':
            return self._send(200, stats_snapshot())
        if u.path == '/r':
            tid = (parse_qs(u.query).get('id') or [''])[0].lower()
            if not ID_RE.match(tid):
                return self._send(400, '{"error":"bad id"}')
            return self._send(200, json.dumps({"resolvers": lookup(tid)}))
        self._send(404, '{"error":"not found"}')


def hostport(s):
    h, p = s.rsplit(':', 1)
    return h, int(p)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zone', required=True)
    ap.add_argument('--ns-name', help='hostname of this server, used in NS/SOA (default ns.<zone>)')
    ap.add_argument('--ns-ip', default='0.0.0.0')
    ap.add_argument('--dns-bind', default='0.0.0.0:53')
    ap.add_argument('--http-bind', default='127.0.0.1:8081')
    ap.add_argument('--origin', default='https://secureinchat.com')
    ap.add_argument('--stats-file', help='optional JSON file for the aggregate daily counts (no addresses are stored)')
    a = ap.parse_args()
    if a.stats_file:
        load_stats(a.stats_file)
        threading.Thread(target=save_stats_loop, args=(a.stats_file,), daemon=True).start()
    API.origin = a.origin
    zone = Zone(a.zone, a.ns_name or 'ns.' + a.zone, a.ns_ip)
    loop = asyncio.get_running_loop()
    host, port = hostport(a.dns_bind)
    await loop.create_datagram_endpoint(lambda: UDP(zone), local_addr=(host, port))
    await asyncio.start_server(lambda r, w: tcp_client(zone, r, w), host, port)
    srv = ThreadingHTTPServer(hostport(a.http_bind), API)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    await asyncio.Event().wait()


if __name__ == '__main__':
    asyncio.run(main())
