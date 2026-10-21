// Node tests for the link checker logic. Run: node tests/link.test.js
const assert = require('assert');
const L = require('../public/tools/assets/link.js');
let n = 0;
function t(name, fn) { fn(); n++; }
const ids = (r) => r.findings.map((f) => f.id).sort();

t('removes utm and fbclid, keeps real params', () => {
  const r = L.check('https://shop.example.com/item?id=42&utm_source=mail&utm_medium=email&fbclid=abc');
  assert.deepStrictEqual(r.removed.sort(), ['fbclid', 'utm_medium', 'utm_source']);
  assert.strictEqual(r.clean, 'https://shop.example.com/item?id=42');
  assert.deepStrictEqual(ids(r), ['tracking']);
});
t('clean link has no findings', () => {
  const r = L.check('https://www.wikipedia.org/');
  assert.strictEqual(r.findings.length, 0);
  assert.strictEqual(r.clean, 'https://www.wikipedia.org/');
});
t('adds https when missing', () => { assert.strictEqual(L.check('example.com/a').clean, 'https://example.com/a'); });
t('userinfo trick', () => { assert.ok(ids(L.check('https://paypal.com@evil.example/login')).includes('userinfo')); });
t('raw IP', () => { assert.ok(ids(L.check('http://192.0.2.10/verify')).includes('ip')); });
t('punycode lookalike decoded', () => {
  const r = L.check('https://xn--pple-43d.com/');
  assert.ok(ids(r).includes('punycode'));
  assert.strictEqual(r.unicodeHost, 'аpple.com');
  assert.strictEqual(r.findings.find((f) => f.id === 'punycode').level, 'fail');
});
t('punycode decoder known value', () => { assert.strictEqual(L.punyDecode('mnchen-3ya'), 'münchen'); });
t('brand on other site', () => {
  assert.ok(ids(L.check('https://secure-paypal-login.example.net/')).includes('brand'));
  assert.ok(ids(L.check('https://paypal.account-verify.com/')).includes('brand'));
  assert.ok(ids(L.check('https://example.org/paypal/login')).includes('brand'));
});
t('real brand domain not flagged', () => {
  assert.ok(!ids(L.check('https://www.paypal.com/signin')).includes('brand'));
  assert.ok(!ids(L.check('https://accounts.google.com/')).includes('brand'));
  assert.ok(!ids(L.check('https://www.amazon.co.uk/')).includes('brand'));
});
t('no false brand match inside words', () => {
  assert.ok(!ids(L.check('https://groups.example.com/')).includes('brand'));
  assert.ok(!ids(L.check('https://pineapple.example.com/')).includes('brand'));
});
t('shortener', () => { assert.ok(ids(L.check('https://bit.ly/3abc')).includes('shortener')); });
t('redirect parameter', () => { assert.ok(ids(L.check('https://example.com/out?url=https%3A%2F%2Fevil.example')).includes('redirect')); });
t('http and port', () => { const r = ids(L.check('http://example.com:8080/')); assert.ok(r.includes('http') && r.includes('port')); });
t('javascript scheme rejected', () => { assert.strictEqual(L.check('javascript:alert(1)').error, 'script'); });
t('invalid input', () => { assert.strictEqual(L.check('').error, 'empty'); });
t('registrable domain', () => {
  assert.strictEqual(L.registrable('a.b.example.co.uk'), 'example.co.uk');
  assert.strictEqual(L.registrable('www.example.com'), 'example.com');
});
console.log(n + ' link tests passed');
