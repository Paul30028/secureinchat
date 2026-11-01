// W17: Chinese wording for the site health check. Runs every row the worker can build, and every error string
// the worker and endpoint can send, through public/tools/assets/sitecheck-zh.js and checks nothing English is left
// (apart from header names, technical tokens and raw data from the checked site, which must stay unchanged).
import assert from 'assert';
import fs from 'fs';
import { createRequire } from 'module';
import { buildChecks } from '../worker/sitecheck.mjs';
const require = createRequire(import.meta.url);
const Z = require('../public/tools/assets/sitecheck-zh.js');
let n = 0; const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL ' + name); throw e; } };

const H = (o) => ({ get: (k) => o[k.toLowerCase()] || null });
const GOOD_H = { 'content-type': 'text/html', 'strict-transport-security': 'max-age=31536000', 'content-security-policy': "default-src 'self'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'permissions-policy': 'camera=()' };
const base = (hdr, html) => ({ home: { ok: true, status: 200, url: 'https://x.com/', ms: 300, headers: H(hdr) }, chain: [{}], html, httpProbe: { ok: true, status: 301, location: 'https://x.com/' }, robots: { ok: true, status: 200, sitemaps: [], blocksAll: false }, sitemap: { ok: true, status: 200, locs: 5 } });
const GOOD_HTML = { title: 'A good title here', description: 'd'.repeat(100), canonical: 'https://x.com/', viewport: true, lang: 'en', h1: 1, noindex: false };

// Fixtures that reach every branch of buildChecks.
const F = [];
F.push(base(GOOD_H, GOOD_HTML));
F.push(Object.assign(base({ 'content-type': 'text/html' }, { title: null, description: null, canonical: null, viewport: false, lang: null, h1: 0, noindex: true }), { httpProbe: { ok: true, status: 200, location: '' }, robots: { ok: true, status: 404 }, sitemap: { ok: true, status: 404, where: '/sitemap.xml' } }));
F.push(Object.assign(base({ 'content-type': 'text/html', 'x-frame-options': 'DENY' }, { title: 'short', description: 'tiny', canonical: null, viewport: true, lang: 'zh', h1: 3, noindex: false }), { httpProbe: { ok: false }, robots: { ok: false }, sitemap: { ok: false, where: '/map.xml' } }));
F.push(Object.assign(base({ 'content-type': 'text/html' }, Object.assign({}, GOOD_HTML, { title: 'x'.repeat(80), description: 'd'.repeat(200) })), { httpProbe: { ok: true, status: 302, location: 'http://x.com/elsewhere' }, robots: { ok: true, status: 200, sitemaps: ['a', 'b'], blocksAll: true }, sitemap: { ok: true, status: 200, locs: 0 } }));
F.push(Object.assign(base({ 'content-type': 'text/html' }, GOOD_HTML), { robots: { ok: true, status: 200, sitemaps: ['a'], blocksAll: false }, sitemap: { ok: true, status: 200, locs: 1, truncated: true } }));
F.push(Object.assign(base({ 'content-type': 'text/html' }, GOOD_HTML), { sitemap: { ok: true, status: 200, locs: 50000, truncated: true } }));
F.push(Object.assign(base({ 'content-type': 'application/json' }, null), { robots: null, sitemap: null }));
F.push(Object.assign(base({}, null), {}));
{ const f = base({ 'content-type': 'text/html' }, GOOD_HTML); f.home.ms = 1500; f.chain = [1, 2]; F.push(f); }
{ const f = base({ 'content-type': 'text/html' }, GOOD_HTML); f.home.ms = 2500; f.chain = [1, 2, 3, 4]; F.push(f); }
{ const f = base({ 'content-type': 'text/html' }, GOOD_HTML); f.home.status = 503; F.push(f); }
{ const f = base({ 'content-type': 'text/html' }, GOOD_HTML); f.home.url = 'http://x.com/'; F.push(f); }
for (const e of ['Timed out', 'Could not connect', 'Redirected to an address that cannot be checked', 'Too many redirects', 'Invalid redirect', null]) F.push({ home: { ok: false }, homeError: e });

// English left over = a run of three or more Latin words. Technical tokens that legitimately stay are removed first.
const TOKENS = /strict-origin-when-cross-origin|Strict-Transport-Security|X-Frame-Options|Content-Security-Policy|X-Content-Type-Options|Referrer-Policy|Permissions-Policy|frame-ancestors|max-age|nosniff|noindex|robots\.txt|Disallow: \/|viewport|meta description|canonical|https?:\/\/|HTTPS|HTTP|Cloudflare|CSP|title|html|lang|h1|meta|sitemap|example\.com/g;
const english = (s) => /[A-Za-z]{2,}[ ,.]+[A-Za-z]{2,}[ ,.]+[A-Za-z]{2,}/.test(String(s).replace(TOKENS, ''));
const CJK = /[一-鿿]/;
const RAW = new Set(['canonical', 'lang', 'html']);
let rows = 0; const ids = new Set();
for (const f of F) {
  for (const r of buildChecks(f)) {
    const z = Z.row(r); rows++; ids.add(r.id);
    t('label ' + r.id, () => { assert.ok(CJK.test(z.label) || /^(HTTPS|HSTS|robots\.txt|Content-Security-Policy|X-Content-Type-Options|Referrer-Policy|Permissions-Policy)$/.test(z.label), 'untranslated label: ' + z.label); });
    t('detail ' + r.id + ' ' + r.detail, () => { assert.ok(!r.detail || CJK.test(z.detail), 'untranslated detail: ' + r.detail); assert.ok(!english(z.detail), 'English left in detail: ' + z.detail); });
    const rawValue = RAW.has(r.id) || (/^hdr-/.test(r.id) && r.value !== 'Missing');
    if (rawValue && !['Missing', 'Not set', 'Unknown type'].includes(r.value)) t('raw value kept ' + r.id, () => { assert.strictEqual(z.value, r.value); });
    else if (r.id === 'title' && r.value !== 'Missing') t('title text kept', () => { assert.ok(z.value.startsWith(f.html.title.slice(0, 90)) && /个字符）$/.test(z.value), z.value); });
    else t('value ' + r.id + ' ' + r.value, () => { assert.ok(!english(z.value) && (CJK.test(z.value) || /^\d+( ms)?$/.test(z.value)), 'untranslated value: ' + r.value + ' -> ' + z.value); });
    t('status and id unchanged', () => { assert.strictEqual(z.status, r.status); assert.strictEqual(z.id, r.id); });
  }
}
t('every row id was reached', () => { for (const id of ['reach', 'https', 'http-redirect', 'status', 'speed', 'hdr-frame', 'noindex', 'title', 'description', 'canonical', 'viewport', 'lang', 'h1', 'html', 'robots', 'sitemap', 'hdr-strict-transport-security']) assert.ok(ids.has(id), id); });
t('input row is not modified', () => { const r = buildChecks(F[1])[0]; const copy = JSON.stringify(r); Z.row(r); assert.strictEqual(JSON.stringify(r), copy); });

// Every literal error string the worker files can send.
const src = fs.readFileSync(new URL('../worker/sitecheck.mjs', import.meta.url), 'utf8') + fs.readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
const errs = [...src.matchAll(/error: '([^']+)'/g)].map((m) => m[1]).filter((s) => / /.test(s));
t('found the endpoint error strings', () => { assert.ok(errs.length >= 13, 'only ' + errs.length); });
for (const e of errs) t('error ' + e, () => { const z = Z.error(e); assert.ok(CJK.test(z) && !english(z), e + ' -> ' + z); });
t('unknown text is shown unchanged', () => { assert.strictEqual(Z.text('Some new message from the server.'), 'Some new message from the server.'); assert.strictEqual(Z.error('Brand new error.'), 'Brand new error.'); });
t('a site title that looks like an English phrase is not translated', () => { const z = Z.row({ id: 'title', label: 'Page title', status: 'pass', value: 'Missing (7 characters)', detail: 'Length is fine.' }); assert.strictEqual(z.value, 'Missing（7 个字符）'); });
t('header value that looks like a phrase is kept', () => { const z = Z.row({ id: 'hdr-referrer-policy', label: 'Referrer-Policy', status: 'pass', value: 'Found', detail: 'Present.' }); assert.strictEqual(z.value, 'Found'); });
console.log('SITECHECK ZH PASSED (' + n + ' checks over ' + rows + ' rows, ' + errs.length + ' error strings)');
