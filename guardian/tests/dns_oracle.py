# SPDX-License-Identifier: GPL-3.0-or-later
# Independent check of the DNS core: builds queries with dnspython, runs them through guardian/tests/oracle/Cli.kt,
# and checks the responses with dnspython and a separate checksum implementation.
# Usage: python3 guardian/tests/dns_oracle.py path/to/cli.jar
import struct, subprocess, random, sys, dns.message, dns.rdatatype, dns.rcode
def csum(b):
    if len(b)%2: b+=b'\0'
    s=sum(struct.unpack('!%dH'%(len(b)//2),b)); 
    while s>>16: s=(s&0xffff)+(s>>16)
    return (~s)&0xffff
def ip_udp(src,dst,sport,dport,payload,ihl_opts=b'',frag=0x4000,proto=17):
    udp=struct.pack('!HHHH',sport,dport,8+len(payload),0)+payload
    ph=bytes(src)+bytes(dst)+struct.pack('!BBH',0,17,len(udp))
    c=csum(ph+udp) or 0xffff; udp=udp[:6]+struct.pack('!H',c)+udp[8:]
    ihl=5+len(ihl_opts)//4
    h=struct.pack('!BBHHHBBH4s4s',0x40|ihl,0,ihl*4+len(udp),0x1234,frag,64,proto,0,bytes(src),bytes(dst))+ihl_opts
    h=h[:10]+struct.pack('!H',csum(h))+h[12:]
    return h+udp
def verify(p):
    ihl=(p[0]&15)*4
    if csum(p[:ihl])!=0: return 'ipck'
    udp=p[ihl:]; ph=p[12:20]+struct.pack('!BBH',0,17,len(udp))
    if struct.unpack('!H',udp[6:8])[0]==0: return 'zero udp ck'
    if csum(ph+udp)!=0: return 'udpck'
    return None
cases=[]; S=[10,0,0,2]; D=[10,0,0,1]
def add(mode,pkt,expect): cases.append((mode,pkt,expect))
for name,qt in [('graph.facebook.com','A'),('Ads.Example.COM','AAAA'),('t.co','TXT'),('a.b.c.d.e.f.g.example.org','HTTPS'),('x'*63+'.com','A')]:
    m=dns.message.make_query(name,qt); 
    for edns in (False,True):
        if edns: m.use_edns(0,0,1232)
        else: m.use_edns(False)
        for mode in ('NXDOMAIN','NULL_IP'):
            add(mode, ip_udp(S,D,random.randint(1024,65535),53,m.to_wire()), (name.lower(),qt,mode,m.id,bool(m.flags & 0x100)))
# with IP options
m=dns.message.make_query('opt.example.com','A'); add('NXDOMAIN', ip_udp(S,D,5555,53,m.to_wire(),ihl_opts=b'\x01\x01\x01\x00'), ('opt.example.com','A','NXDOMAIN',m.id,True))
# rejects
rej=[ip_udp(S,D,5555,54,m.to_wire()), ip_udp(S,D,5555,53,m.to_wire(),frag=0x2000), ip_udp(S,D,5555,53,m.to_wire(),proto=6), ip_udp(S,D,5555,53,m.to_wire(),frag=0x0001)]
r=dns.message.make_response(m); rej.append(ip_udp(S,D,5555,53,r.to_wire()))
inp='\n'.join(f'{c[0]} {c[1].hex()}' for c in cases)+'\n'+'\n'.join(f'NXDOMAIN {p.hex()}' for p in rej)+'\n'
out=subprocess.run(['java','-cp',sys.argv[1],'CliKt'],input=inp,capture_output=True,text=True).stdout.split('\n')
bad=0
for (mode,pkt,(name,qt,_,qid,rd)),line in zip(cases,out):
    if line=='null': print('NULL for',name,qt,mode); bad+=1; continue
    qn,hx=line.split(' '); resp=bytes.fromhex(hx)
    e=verify(resp)
    if e: print('CKSUM',e,name); bad+=1
    if resp[12:16]!=pkt[16:20] or resp[16:20]!=pkt[12:16]: print('ip swap',name); bad+=1
    ihl=(pkt[0]&15)*4
    if resp[20:22]!=pkt[ihl+2:ihl+4] or resp[22:24]!=pkt[ihl:ihl+2]: print('port swap',name); bad+=1
    msg=dns.message.from_wire(resp[28:])
    ok = msg.id==qid and str(msg.question[0].name).rstrip('.').lower()==name and dns.rdatatype.to_text(msg.question[0].rdtype)==qt and bool(msg.flags&0x100)==rd and bool(msg.flags&0x80)
    if mode=='NXDOMAIN': ok = ok and msg.rcode()==dns.rcode.NXDOMAIN and not msg.answer
    else:
        if qt in('A','AAAA'): ok = ok and msg.rcode()==0 and len(msg.answer)==1 and msg.answer[0].ttl==60 and str(msg.answer[0][0]) in ('0.0.0.0','::')
        else: ok = ok and msg.rcode()==0 and not msg.answer
    if not ok: print('DNS mismatch',name,qt,mode,msg); bad+=1
for p,line in zip(rej,out[len(cases):]):
    if line!='null': print('should reject',p.hex()[:60]); bad+=1
print(len(cases),"cases",len(rej),"rejects, bad=",bad); sys.exit(1 if bad else 0)
