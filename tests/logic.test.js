const assert = require('node:assert/strict');
const L = require('../public/tools/assets/logic.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }

const base = () => ({
  vpn: true,
  who: {
    ip: '185.65.134.10', asn: 9009, asOrganization: 'M247 Europe SRL', city: 'Bucharest', country: 'RO',
    timezone: 'Europe/Bucharest',
    headers: { 'accept-language': 'en-US,en;q=0.9', 'x-forwarded-for': '185.65.134.10' },
  },
  v4: '185.65.134.10', v6: null, lookup: {},
  webrtc: { status: 'ok', candidates: [
    { type: 'host', address: 'a1b2c3.local', mdns: true, protocol: 'udp' },
    { type: 'srflx', address: '185.65.134.10', mdns: false, protocol: 'udp' } ] },
  tz: { browser: 'Europe/Bucharest', browserOffsetMin: 180, ipOffsetMin: 180 },
});
const by = (r, id) => r.checks.find(c => c.id === id);

t('clean VPN setup: no fails, summary says no leaks', () => {
  const r = L.analyze(base());
  assert.equal(by(r, 'ip').status, 'pass');
  assert.equal(by(r, 'webrtc').status, 'pass');
  assert.equal(by(r, 'ipv6').status, 'pass');
  assert.equal(by(r, 'dns').status, 'na');
  assert.equal(by(r, 'tz').status, 'pass');
  assert.equal(by(r, 'headers').status, 'info'); // en-US vs RO is only a weak signal
  assert.equal(r.count.fail, 0);
  assert.equal(r.headline, 'No leaks found in 5 checks');
});

t('WebRTC address that differs from public IP fails and appears in diagram', () => {
  const d = base();
  d.webrtc.candidates.push({ type: 'srflx', address: '203.0.113.9', mdns: false, protocol: 'udp' });
  const r = L.analyze(d);
  assert.equal(by(r, 'webrtc').status, 'fail');
  assert.deepEqual(r.diagram.leaks, [{ kind: 'WebRTC', value: '203.0.113.9' }]);
  assert.equal(r.headline, '1 leak found');
});

t('WebRTC differing address is only info when no VPN is declared', () => {
  const d = base(); d.vpn = false;
  d.webrtc.candidates.push({ type: 'srflx', address: '203.0.113.9', mdns: false, protocol: 'udp' });
  assert.equal(by(L.analyze(d), 'webrtc').status, 'info');
});

t('raw private host candidate is a warning', () => {
  const d = base();
  d.webrtc.candidates = [{ type: 'host', address: '192.168.1.23', mdns: false, protocol: 'udp' }];
  assert.equal(by(L.analyze(d), 'webrtc').status, 'warn');
});

t('public candidate with no reference address of that family is "could not compare"', () => {
  const d = base();
  d.who.ip = '2001:db8::5'; d.v4 = null; d.v6 = '2001:db8::5';
  d.webrtc.candidates = [{ type: 'srflx', address: '198.51.100.7', mdns: false, protocol: 'udp' }];
  const c = by(L.analyze(d), 'webrtc');
  assert.equal(c.status, 'warn');
  assert.match(c.lines.join(' '), /could not compare/);
});

t('WebRTC unsupported or empty passes', () => {
  const d = base(); d.webrtc = { status: 'unsupported', candidates: [] };
  assert.equal(by(L.analyze(d), 'webrtc').status, 'pass');
  d.webrtc = { status: 'timeout', candidates: [] };
  assert.equal(by(L.analyze(d), 'webrtc').status, 'pass');
});

t('IPv6 on a different network than IPv4 fails', () => {
  const d = base(); d.v6 = '2001:db8::1';
  d.lookup[L.normalizeIP('2001:db8::1')] = { asn: 7922, org: 'Comcast Cable', country: 'US' };
  const r = L.analyze(d);
  assert.equal(by(r, 'ipv6').status, 'fail');
  assert.deepEqual(r.diagram.leaks, [{ kind: 'IPv6', value: '2001:db8::1' }]);
});

t('IPv6 on same network passes; failed lookup warns', () => {
  const d = base(); d.v6 = '2001:db8::1';
  d.lookup[L.normalizeIP('2001:db8::1')] = { asn: 9009, org: 'M247 Europe SRL' };
  assert.equal(by(L.analyze(d), 'ipv6').status, 'pass');
  d.lookup = {};
  assert.equal(by(L.analyze(d), 'ipv6').status, 'warn');
});

t('IPv6 when the page itself was fetched over IPv6 compares against looked-up IPv4', () => {
  const d = base();
  d.who.ip = '2001:db8::1'; d.who.asn = 7922; d.who.asOrganization = 'Comcast Cable';
  d.v6 = '2001:db8::1'; d.v4 = '185.65.134.10';
  d.lookup[L.normalizeIP('185.65.134.10')] = { asn: 9009, org: 'M247 Europe SRL' };
  assert.equal(by(L.analyze(d), 'ipv6').status, 'fail');
});

t('lookupTarget picks the other family only', () => {
  assert.equal(L.lookupTarget({ ip: '1.2.3.4' }, '1.2.3.4', '2001:db8::1'), '2001:db8::1');
  assert.equal(L.lookupTarget({ ip: '2001:db8::1' }, '1.2.3.4', '2001:db8::1'), '1.2.3.4');
  assert.equal(L.lookupTarget({ ip: '1.2.3.4' }, '1.2.3.4', null), null);
  assert.equal(L.lookupTarget(null, '1.2.3.4', '2001:db8::1'), null);
});

t('consumer ISP with VPN on warns, with VPN off is info', () => {
  const d = base(); d.who.asOrganization = 'Comcast Cable Communications'; d.who.asn = 7922;
  assert.equal(by(L.analyze(d), 'ip').status, 'warn');
  d.vpn = false;
  assert.equal(by(L.analyze(d), 'ip').status, 'info');
  assert.equal(L.analyze(d).headline, 'Here is what websites see');
});

t('time zone mismatch warns with VPN, info without', () => {
  const d = base(); d.tz = { browser: 'Asia/Shanghai', browserOffsetMin: 480, ipOffsetMin: 180 };
  const c = by(L.analyze(d), 'tz');
  assert.equal(c.status, 'warn');
  assert.match(c.lines[0], /UTC\+8/);
  d.vpn = false;
  assert.equal(by(L.analyze(d), 'tz').status, 'info');
});

t('proxy headers warn; a single X-Forwarded-For entry does not', () => {
  const d = base();
  assert.notEqual(by(L.analyze(d), 'headers').status, 'warn');
  d.who.headers.via = '1.1 squid';
  assert.equal(by(L.analyze(d), 'headers').status, 'warn');
  delete d.who.headers.via;
  d.who.headers['x-forwarded-for'] = '10.0.0.5, 185.65.134.10';
  assert.equal(by(L.analyze(d), 'headers').status, 'warn');
});

t('missing whoami data degrades to not tested instead of throwing', () => {
  const d = base(); d.who = null; d.v4 = null; d.v6 = null;
  const r = L.analyze(d);
  assert.equal(by(r, 'ip').status, 'na');
  assert.equal(by(r, 'tz').status, 'na');
  assert.equal(by(r, 'headers').status, 'na');
  assert.equal(r.headline, 'The test could not read your connection');
});

t('IPv6 normalisation and candidate parsing', () => {
  assert.equal(L.normalizeIP('2001:db8::1'), L.normalizeIP('2001:0DB8:0:0:0:0:0:1'));
  assert.equal(L.normalizeIP('::1'), '0:0:0:0:0:0:0:1');
  const c = L.parseCandidate('candidate:842163049 1 udp 1677729535 203.0.113.5 46154 typ srflx raddr 0.0.0.0 rport 0 generation 0');
  assert.deepEqual(c, { protocol: 'udp', address: '203.0.113.5', type: 'srflx', mdns: false });
  assert.equal(L.parseCandidate('candidate:1 1 udp 2113937151 abc-def.local 5000 typ host').mdns, true);
  assert.equal(L.parseCandidate('garbage'), null);
});

t('private address detection', () => {
  ['10.1.2.3', '192.168.0.9', '172.20.1.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', 'fd00::1', 'fe80::1', '::1']
    .forEach(a => assert.equal(L.isPrivateAddress(a), true, a));
  ['8.8.8.8', '172.32.0.1', '2001:db8::1'].forEach(a => assert.equal(L.isPrivateAddress(a), false, a));
});

t('time zone offsets', () => {
  assert.equal(L.tzOffsetMinutes('Asia/Shanghai', new Date('2026-10-20T00:00:00Z')), 480);
  assert.equal(L.tzOffsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z')), -300);
  assert.equal(L.tzOffsetMinutes('America/New_York', new Date('2026-07-15T12:00:00Z')), -240);
  assert.equal(L.tzOffsetMinutes('Not/AZone', new Date()), null);
  assert.equal(L.formatOffset(330), 'UTC+5:30');
  assert.equal(L.formatOffset(-300), 'UTC-5');
});

t('hosting heuristic', () => {
  assert.equal(L.looksLikeHosting('M247 Europe SRL'), true);
  assert.equal(L.looksLikeHosting('DigitalOcean, LLC'), true);
  assert.equal(L.looksLikeHosting('Comcast Cable Communications, LLC'), false);
  assert.equal(L.looksLikeHosting('China Telecom'), false);
  assert.equal(L.looksLikeHosting(''), false);
});

console.log('\n' + n + ' tests passed');
