import assert from 'assert';
import { parseTarget, readHtml, readRobots, countLocs, buildChecks, summarize } from '../worker/sitecheck.mjs';
let n = 0; const t = (name, fn) => { fn(); n++; };
t('accepts domains', () => { assert.strictEqual(parseTarget('Example.com').host, 'example.com'); assert.strictEqual(parseTarget('https://www.example.com/a/b?x=1').origin, 'https://www.example.com'); assert.ok(parseTarget('http://example.com:443').ok); });
for (const bad of ['', 'localhost', '127.0.0.1', '10.0.0.5', '192.168.1.1', '[::1]', 'http://[2001:db8::1]/', '2130706433', '0x7f000001', 'a.local', 'x.internal', 'user:pw@example.com', 'ftp://example.com', 'example.com:8080', 'foo', 'exa mple.com', 'http://169.254.169.254/latest', '-a.example.org', 'x'.repeat(300) + '.com'])
  t('rejects ' + bad.slice(0, 30), () => { assert.strictEqual(parseTarget(bad).ok, false); });
t('html facts', () => {
  const d = readHtml('<!doctype html><html lang="en"><head><title>Hello &amp; welcome</title><meta name="description" content="A page."><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex, follow"><link rel="canonical" href="https://x.com/"></head><body><h1>A</h1><h1>B</h1>');
  assert.deepStrictEqual(d, { title: 'Hello & welcome', description: 'A page.', canonical: 'https://x.com/', viewport: true, lang: 'en', h1: 2, noindex: true });
});
t('robots', () => { const r = readRobots('User-agent: *\nDisallow: /\nSitemap: https://x.com/s.xml # c\n'); assert.ok(r.blocksAll); assert.deepStrictEqual(r.sitemaps, ['https://x.com/s.xml']); assert.ok(!readRobots('User-agent: bot\nDisallow: /\nUser-agent: *\nDisallow: /admin').blocksAll); });
t('locs', () => { assert.strictEqual(countLocs('<urlset><url><loc>a</loc></url><url><loc>b</loc></url></urlset>'), 2); });
const H = (o) => ({ get: (k) => o[k.toLowerCase()] || null });
const base = (hdr, html) => ({ home: { ok: true, status: 200, url: 'https://x.com/', ms: 300, headers: H(hdr) }, chain: [{ url: 'https://x.com/', status: 200 }], html, httpProbe: { ok: true, status: 301, location: 'https://x.com/' }, robots: { ok: true, status: 200, sitemaps: [], blocksAll: false }, sitemap: { ok: true, status: 200, locs: 5 } });
t('good site', () => {
  const rows = buildChecks(base({ 'content-type': 'text/html', 'strict-transport-security': 'max-age=31536000', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=()' }, { title: 'A good title here', description: 'd'.repeat(100), canonical: 'https://x.com/', viewport: true, lang: 'en', h1: 1, noindex: false }));
  const s = summarize(rows); assert.strictEqual(s.fail, 0); assert.strictEqual(s.warn, 0);
});
t('bad site', () => {
  const f = base({ 'content-type': 'text/html' }, { title: null, description: null, canonical: null, viewport: false, lang: null, h1: 0, noindex: true });
  f.httpProbe = { ok: true, status: 200, location: '' }; f.robots = { ok: true, status: 404 }; f.sitemap = { ok: true, status: 404, where: '/sitemap.xml' };
  const rows = buildChecks(f); const by = Object.fromEntries(rows.map((r) => [r.id, r.status]));
  assert.strictEqual(by['http-redirect'], 'fail'); assert.strictEqual(by.noindex, 'fail'); assert.strictEqual(by.viewport, 'fail'); assert.strictEqual(by['hdr-strict-transport-security'], 'warn'); assert.strictEqual(by.robots, 'warn'); assert.strictEqual(by.sitemap, 'warn'); assert.strictEqual(by.title, 'fail');
});
t('unreachable', () => { const rows = buildChecks({ home: { ok: false }, homeError: 'Timed out' }); assert.strictEqual(rows.length, 1); assert.strictEqual(rows[0].status, 'fail'); });
t('slow and redirect chain', () => { const f = base({ 'content-type': 'text/html' }, null); f.home.ms = 2500; f.chain = [1, 2, 3, 4]; const by = Object.fromEntries(buildChecks(f).map((r) => [r.id, r.status])); assert.strictEqual(by.speed, 'fail'); assert.strictEqual(by.status, 'warn'); });
console.log('SITECHECK LOGIC PASSED (' + n + ')');

// End-to-end through runCheck with a stubbed fetch (no network).
import { runCheck } from '../worker/sitecheck.mjs';
const pages = {
  'http://ex.com/': { status: 301, headers: { location: 'https://ex.com/' } },
  'https://ex.com/': { status: 200, headers: { 'content-type': 'text/html' }, body: '<html lang="en"><head><title>Example site title</title><meta name="viewport" content="x"></head><body><h1>x</h1></body></html>' },
  'https://ex.com/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nSitemap: https://ex.com/map.xml\n' },
  'https://ex.com/map.xml': { status: 200, headers: {}, body: '<urlset><url><loc>https://ex.com/</loc></url></urlset>' },
  'https://www.redir.com/': { status: 302, headers: { location: 'http://169.254.169.254/' } },
};
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push(url);
  const p = pages[url];
  if (!p) throw new Error('unreachable');
  return new Response(p.body || '', { status: p.status, headers: p.headers });
};
const r = await runCheck('ex.com');
assert.strictEqual(r.status, 200);
const ids = r.body.checks.map((c) => c.id);
assert.ok(ids.includes('sitemap') && ids.includes('robots') && ids.includes('http-redirect'));
assert.strictEqual(r.body.checks.find((c) => c.id === 'sitemap').value, '1 address');
assert.ok(calls.includes('https://ex.com/map.xml'), 'uses sitemap from robots.txt');
const bad = await runCheck('127.0.0.1');
assert.strictEqual(bad.status, 400);
calls.length = 0;
const redir = await runCheck('www.redir.com');
assert.strictEqual(redir.body.checks[0].status, 'fail');
assert.ok(!calls.some((u) => u.includes('169.254')), 'does not follow redirects to private addresses');
console.log('SITECHECK END-TO-END PASSED');

assert.strictEqual((await runCheck('www.secureinchat.com')).status, 400);
console.log('SELF-CHECK REFUSED');
