// Node tests for the private workspace link parser. It must never open or contact a link.
const assert = require('assert');
const L = require('../public/workspace/assets/link-review.js');
let n = 0;
function t(name, fn) { fn(); n++; }

t('splits scheme, host, path and query', () => {
  const r = L.analyze('https://shop.example.com:8443/a/b?x=1&y=two#frag');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.scheme, 'https');
  assert.strictEqual(r.host, 'shop.example.com:8443');
  assert.strictEqual(r.path, '/a/b');
  assert.strictEqual(r.queryCount, 2);
  assert.strictEqual(r.query[0].key, 'x');
  assert.strictEqual(r.query[0].value, '1');
  assert.strictEqual(r.fragment, 'frag');
  assert.strictEqual(r.flags.some((f) => f.id === 'port'), true);
});

t('bare host gets https for parsing', () => {
  const r = L.analyze('example.com/a');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.addedScheme, true);
  assert.strictEqual(r.scheme, 'https');
  assert.strictEqual(r.host, 'example.com');
  assert.strictEqual(r.path, '/a');
});

t('common tracking keys are removed, real parameters are kept', () => {
  const r = L.analyze('https://shop.example.com/item?id=42&utm_source=mail&utm_medium=email&fbclid=abc');
  assert.deepStrictEqual(r.trackingKeys.sort(), ['fbclid', 'utm_medium', 'utm_source']);
  assert.strictEqual(r.cleanUrl, 'https://shop.example.com/item?id=42');
  assert.strictEqual(r.copyAllowed, true);
});

t('session and identity-like keys block quick copy', () => {
  for (const key of ['token', 'access_token', 'session', 'sessionid', 'auth', 'api_key', 'password', 'email', 'user_id', 'uid', 'csrf', 'code', 'key', 'state']) {
    const r = L.analyze('https://example.com/?utm_source=x&' + key + '=value');
    assert.strictEqual(r.ok, true, key);
    assert.strictEqual(r.sensitiveKeys.indexOf(key) >= 0, true, key);
    assert.strictEqual(r.copyAllowed, false, key);
  }
});

t('ordinary parameter names do not block copy', () => {
  const r = L.analyze('https://example.com/?id=42&utm_source=x&page=2');
  assert.strictEqual(r.sensitiveKeys.length, 0);
  assert.strictEqual(r.copyAllowed, true);
  assert.strictEqual(r.cleanUrl, 'https://example.com/?id=42&page=2');
});

t('no tracking keys means nothing to copy', () => {
  const r = L.analyze('https://example.com/a?x=1');
  assert.strictEqual(r.trackingKeys.length, 0);
  assert.strictEqual(r.copyAllowed, false);
  assert.strictEqual(r.changed, false);
});

t('http, raw IP and userinfo are reported', () => {
  const h = L.analyze('http://192.0.2.10/x');
  assert.strictEqual(h.flags.some((f) => f.id === 'http'), true);
  assert.strictEqual(h.flags.some((f) => f.id === 'ip'), true);
  const u = L.analyze('https://paypal.com@evil.example/login');
  assert.strictEqual(u.host, 'evil.example');
  assert.strictEqual(u.flags.some((f) => f.id === 'userinfo'), true);
  assert.strictEqual(u.copyAllowed, false);
});

t('punycode host is flagged, not decoded into a safety claim', () => {
  const r = L.analyze('https://xn--pple-43d.com/');
  assert.strictEqual(r.flags.some((f) => f.id === 'punycode'), true);
  assert.strictEqual(r.copyAllowed, false);
});

t('duplicate query keys are preserved', () => {
  const r = L.analyze('https://example.com/?tag=a&tag=b');
  assert.deepStrictEqual(r.query.map((q) => [q.key, q.value]), [['tag', 'a'], ['tag', 'b']]);
  assert.strictEqual(r.queryCount, 2);
});

t('percent-encoded values are decoded for review without throwing', () => {
  const r = L.analyze('https://example.com/?q=%E0%A4%A&next=a%20b');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.query[0].key, 'q');
  assert.strictEqual(r.query[1].value, 'a b');
});

t('malformed input is handled without throwing', () => {
  for (const raw of ['', '   ', 'not a url', 'https://', 'https://exa mple.com', 'http://[::1', '://example.com', 'https://example.com:99999/']) {
    const r = L.analyze(raw);
    assert.strictEqual(r.ok, false, raw);
    assert.strictEqual(typeof r.message, 'string', raw);
    assert.strictEqual(r.copyAllowed, false, raw);
  }
});

t('script, data, mailto, tel and ftp are refused as non-web links', () => {
  for (const [raw, scheme] of [
    ['javascript:alert(1)', 'javascript'],
    ['data:text/html,hi', 'data'],
    ['mailto:bob@example.com', 'mailto'],
    ['tel:+15555550100', 'tel'],
    ['ftp://example.com/x', 'ftp']
  ]) {
    const r = L.analyze(raw);
    assert.strictEqual(r.ok, false, raw);
    assert.strictEqual(r.scheme, scheme, raw);
    assert.strictEqual(r.flags.length, 0, raw);
  }
});

t('host:port without a scheme is treated as a host, not a scheme', () => {
  assert.strictEqual(L.analyze('localhost:3000/a').host, 'localhost:3000');
  assert.strictEqual(L.analyze('example.com:8080/').host, 'example.com:8080');
});

t('userinfo without a scheme is still inspected', () => {
  const r = L.analyze('user:pw@evil.example/login');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.host, 'evil.example');
  assert.strictEqual(r.flags.some((f) => f.id === 'userinfo'), true);
});

t('control characters and very long input are refused', () => {
  assert.strictEqual(L.analyze('https://example.com/\nnext').error, 'control');
  assert.strictEqual(L.analyze('https://example.com/' + 'a'.repeat(L.LIMIT)).error, 'too-long');
});

t('an empty query value is kept and displayed as empty', () => {
  const r = L.analyze('https://example.com/?utm_source=&x=');
  assert.strictEqual(r.queryCount, 2);
  assert.strictEqual(r.query[0].value, '');
  assert.strictEqual(r.query[1].value, '');
});

t('a session-like fragment blocks quick copy and is not treated as a query key', () => {
  const r = L.analyze('https://example.com/?utm_source=x#access_token=abc');
  assert.strictEqual(r.fragment, 'access_token=abc');
  assert.strictEqual(r.flags.some((f) => f.id === 'fragment'), true);
  assert.strictEqual(r.flags.some((f) => f.id === 'fragment-sensitive'), true);
  assert.strictEqual(r.sensitiveKeys.length, 0);
  assert.strictEqual(r.fragmentSensitive, true);
  assert.strictEqual(r.copyAllowed, false);
});

t('a plain fragment does not block copy', () => {
  const r = L.analyze('https://example.com/?utm_source=x#section-2');
  assert.strictEqual(r.fragment, 'section-2');
  assert.strictEqual(r.fragmentSensitive, false);
  assert.strictEqual(r.copyAllowed, true);
});

t('clean copy preserves non-tracking query order', () => {
  const r = L.analyze('https://example.com/?b=2&utm_source=x&a=1');
  assert.strictEqual(r.cleanUrl, 'https://example.com/?b=2&a=1');
});

t('isTracking and isSensitive are case-insensitive', () => {
  assert.strictEqual(L.isTracking('UTM_Source'), true);
  assert.strictEqual(L.isTracking('FBClid'), true);
  assert.strictEqual(L.isSensitive('Access_Token'), true);
  assert.strictEqual(L.isSensitive('item'), false);
});

console.log(n + ' workspace link tests passed');
