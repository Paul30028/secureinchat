# SPDX-License-Identifier: GPL-3.0-or-later
# Independent IPv6 check of the DNS core (G4): builds IPv6/UDP DNS queries with dnspython and struct,
# runs them through guardian/tests/oracle/Cli.kt, and checks the answers with dnspython and a separate
# IPv6 pseudo-header checksum (RFC 8200 section 8.1).
# Usage: python3 guardian/tests/dns_oracle6.py path/to/cli.jar
import struct, subprocess, random, sys, ipaddress, dns.message, dns.rdatatype, dns.rcode, dns.rrset
def csum(b):
    if len(b) % 2: b += b'\0'
    s = sum(struct.unpack('!%dH' % (len(b) // 2), b))
    while s >> 16: s = (s & 0xffff) + (s >> 16)
    return (~s) & 0xffff
S = ipaddress.IPv6Address('fd00:6a72:6764::1').packed
D = ipaddress.IPv6Address('fd00:6a72:6764::2').packed
def ip6_udp(src, dst, sport, dport, payload, nh=17, plen_delta=0):
    udp = struct.pack('!HHHH', sport, dport, 8 + len(payload), 0) + payload
    ph = src + dst + struct.pack('!IxxxB', len(udp), 17)
    c = csum(ph + udp) or 0xffff
    udp = udp[:6] + struct.pack('!H', c) + udp[8:]
    h = struct.pack('!IHBB', 0x60000000, len(udp) + plen_delta, nh, 64) + src + dst
    return h + udp
def verify6(p):
    if p[0] >> 4 != 6: return 'version'
    plen, nh = struct.unpack('!HB', p[4:7])
    if nh != 17: return 'next header'
    if plen != len(p) - 40: return 'payload length'
    udp = p[40:]
    if struct.unpack('!H', udp[6:8])[0] == 0: return 'zero udp checksum (forbidden over IPv6)'
    ph = p[8:24] + p[24:40] + struct.pack('!IxxxB', len(udp), 17)
    if csum(ph + udp) != 0: return 'udp checksum'
    return None
cases = []
for name, qt in [('graph.facebook.com', 'A'), ('Ads.Example.COM', 'AAAA'), ('t.co', 'TXT'), ('x' * 63 + '.com', 'A')]:
    m = dns.message.make_query(name, qt)
    for mode in ('NXDOMAIN', 'NULL_IP'):
        cases.append((mode, ip6_udp(S, D, random.randint(1024, 65535), 53, m.to_wire()), (name.lower(), qt, m.id)))
m = dns.message.make_query('ext.example.com', 'A')
rej = [ip6_udp(S, D, 5555, 54, m.to_wire()),                    # not port 53
       ip6_udp(S, D, 5555, 53, m.to_wire(), nh=0),               # hop-by-hop extension header
       ip6_udp(S, D, 5555, 53, m.to_wire(), nh=44),              # fragment header
       ip6_udp(S, D, 5555, 53, m.to_wire(), nh=6),               # TCP
       ip6_udp(S, D, 5555, 53, m.to_wire(), plen_delta=4),       # payload length lies
       ip6_udp(S, D, 5555, 53, dns.message.make_response(m).to_wire())]  # an answer, not a query
ups = []
for name, qt in [('example.com', 'A'), ('v6.example.org', 'AAAA')]:
    m = dns.message.make_query(name, qt)
    pkt = ip6_udp(S, D, 6000, 53, m.to_wire())
    r = dns.message.make_response(m)
    r.answer.append(dns.rrset.from_text(name + '.', 300, 'IN', qt, '93.184.216.34' if qt == 'A' else '2001:db8::1'))
    ups.append((pkt, r.to_wire(), True))
    bad = dns.message.from_wire(r.to_wire()); bad.id = (m.id + 1) % 65536
    ups.append((pkt, bad.to_wire(), False))
run = lambda inp: subprocess.run(['java', '-cp', sys.argv[1], 'CliKt'], input=inp, capture_output=True, text=True).stdout.split('\n')
bad = 0
out = run('\n'.join(f'{c[0]} {c[1].hex()}' for c in cases) + '\n' + '\n'.join(f'NXDOMAIN {p.hex()}' for p in rej) + '\n')
for (mode, pkt, (name, qt, qid)), line in zip(cases, out):
    if line == 'null': print('NULL for', name, qt, mode); bad += 1; continue
    resp = bytes.fromhex(line.split(' ')[1])
    e = verify6(resp)
    if e: print('IPv6', e, name); bad += 1
    if resp[8:24] != pkt[24:40] or resp[24:40] != pkt[8:24]: print('address swap', name); bad += 1
    if resp[40:42] != pkt[42:44] or resp[42:44] != pkt[40:42]: print('port swap', name); bad += 1
    msg = dns.message.from_wire(resp[48:])
    ok = msg.id == qid and str(msg.question[0].name).rstrip('.').lower() == name and dns.rdatatype.to_text(msg.question[0].rdtype) == qt
    if mode == 'NXDOMAIN': ok = ok and msg.rcode() == dns.rcode.NXDOMAIN and not msg.answer
    elif qt in ('A', 'AAAA'): ok = ok and msg.rcode() == 0 and len(msg.answer) == 1 and str(msg.answer[0][0]) in ('0.0.0.0', '::')
    else: ok = ok and msg.rcode() == 0 and not msg.answer
    if not ok: print('DNS mismatch', name, qt, mode); bad += 1
for p, line in zip(rej, out[len(cases):]):
    if line != 'null': print('should reject', p.hex()[:100]); bad += 1
uout = run('\n'.join(f'UP {p.hex()} {u.hex()}' for p, u, _ in ups) + '\n')
for (pkt, u, ok), line in zip(ups, uout):
    if not ok:
        if line != 'null': print('UP should reject'); bad += 1
        continue
    if line == 'null': print('UP rejected a valid answer'); bad += 1; continue
    resp = bytes.fromhex(line)
    if verify6(resp) or resp[48:] != u or resp[8:24] != pkt[24:40]: print('UP wrap wrong', verify6(resp)); bad += 1
print(len(cases), 'IPv6 cases,', len(rej), 'rejects,', len(ups), 'upstream cases, bad =', bad)
sys.exit(1 if bad else 0)
