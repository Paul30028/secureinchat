// Node tests for the private workspace text rules. Run with: node --test tests/*.test.js
const assert = require('assert');
const T = require('../public/workspace/assets/text-review.js');
let n = 0;
function t(name, fn) { fn(); n++; }
const ids = (r) => r.categories.filter((c) => c.count).map((c) => c.id).sort();

t('email format and count', () => {
  const r = T.analyze('Write to bob@example.com or ann.smith+tag@sub.example.co.uk.');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.categories.find((c) => c.id === 'email').count, 2);
  assert.deepStrictEqual(ids(r), ['email']);
});

t('email replacement keeps surrounding text', () => {
  assert.strictEqual(T.redact('mail bob@example.com now', ['email']).text, 'mail [EMAIL_1] now');
});

t('same email value gets the same placeholder', () => {
  assert.strictEqual(T.redact('a@b.co and a@b.co', ['email']).text, '[EMAIL_1] and [EMAIL_1]');
});

t('phone formats: international, US and Chinese mobile', () => {
  const r = T.redact('Call +44 20 7946 0958, (415) 555-0132 or 13812345678.', ['phone']);
  assert.strictEqual(r.text, 'Call [PHONE_1], [PHONE_2] or [PHONE_3].');
  assert.strictEqual(r.categories.find((c) => c.id === 'phone').count, 3);
});

t('dates and version numbers are not phones', () => {
  assert.strictEqual(T.analyze('on 2026-10-20 and version 1.2.3').total, 0);
});

t('government ID: valid Chinese resident ID', () => {
  const r = T.analyze('身份证 11010519491231002X 号');
  assert.strictEqual(r.categories.find((c) => c.id === 'id').count, 1);
  assert.strictEqual(T.redact('身份证 11010519491231002X 号', ['id']).text, '身份证 [ID_1] 号');
});

t('government ID: bad check digit, bad date and short number are rejected', () => {
  assert.strictEqual(T.analyze('110105194912310021').total, 0);
  assert.strictEqual(T.analyze('110105194902300028').total, 0);
  assert.strictEqual(T.analyze('110105194913010028').total, 0);
  assert.strictEqual(T.analyze('11010519491231002').total, 0);
});

t('government ID: US SSN-like format and obvious invalid ranges', () => {
  assert.strictEqual(T.redact('ssn 123-45-6789', ['id']).text, 'ssn [ID_1]');
  assert.strictEqual(T.analyze('000-12-3456 666-12-3456 900-12-3456').total, 0);
});

t('access keys: OpenAI, AWS, GitHub, JWT and private key block', () => {
  const text = 'k sk-' + 'a'.repeat(20) + ' AKIAIOSFODNN7EXAMPLE ghp_' + 'b'.repeat(36) + ' eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk\n-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----';
  const r = T.redact(text, ['key']);
  assert.strictEqual(r.categories.find((c) => c.id === 'key').count, 5);
  assert.strictEqual(r.text.includes('[KEY_1]'), true);
  assert.strictEqual(r.text.includes('[KEY_5]'), true);
});

t('short sk- text is not a key', () => {
  assert.strictEqual(T.analyze('sk-short').total, 0);
});

t('payment card: Luhn valid only', () => {
  assert.strictEqual(T.redact('card 4111 1111 1111 1111', ['card']).text, 'card [CARD_1]');
  assert.strictEqual(T.analyze('order 1234567890123456').total, 0);
  assert.strictEqual(T.analyze('card 4111 1111 1111 1112').total, 0);
});

t('IPv4 valid octets only', () => {
  assert.strictEqual(T.redact('from 192.168.1.10 to 8.8.8.8', ['ipv4']).text, 'from [IP_1] to [IP_2]');
  assert.strictEqual(T.analyze('v 1.2.3.999 and 256.1.1.1').total, 0);
  assert.strictEqual(T.analyze('version 1.2.3').total, 0);
});

t('CN resident ID wins over card when both checksums pass', () => {
  const r = T.analyze('x 330106199001010069 y');
  assert.strictEqual(r.categories.find((c) => c.id === 'id').count, 1);
  assert.strictEqual(r.categories.find((c) => c.id === 'card').count, 0);
  assert.strictEqual(T.redact('x 330106199001010069 y', ['id', 'card']).text, 'x [ID_1] y');
});

t('category selection leaves other formats alone', () => {
  const r = T.redact('a@b.co and +1 415-555-0132', ['email']);
  assert.strictEqual(r.text, '[EMAIL_1] and +1 415-555-0132');
  assert.strictEqual(r.categories.find((c) => c.id === 'phone').replaced, 0);
  assert.strictEqual(r.total, 1);
});

t('object selection works too', () => {
  assert.strictEqual(T.redact('a@b.co +1 415-555-0132', { email: true, phone: false }).text, '[EMAIL_1] +1 415-555-0132');
});

t('empty and plain text return a safe result', () => {
  assert.strictEqual(T.analyze('').total, 0);
  assert.strictEqual(T.redact('').text, '');
  assert.strictEqual(T.redact('nothing to match').text, 'nothing to match');
});

t('HTML punctuation is preserved around a match', () => {
  assert.strictEqual(T.redact('<b>a@b.co</b>', ['email']).text, '<b>[EMAIL_1]</b>');
});

t('over-long text is refused without being processed', () => {
  const long = 'a'.repeat(T.LIMIT + 1);
  const a = T.analyze(long);
  assert.strictEqual(a.ok, false);
  assert.strictEqual(a.error, 'too-long');
  const r = T.redact(long, ['email']);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.text, long);
});

t('placeholder names are stable', () => {
  const r = T.redact('a@b.co 13812345678 11010519491231002X 4111 1111 1111 1111 192.168.1.10', ['email', 'phone', 'id', 'card', 'ipv4']);
  assert.strictEqual(r.text, '[EMAIL_1] [PHONE_1] [ID_1] [CARD_1] [IP_1]');
});

console.log(n + ' workspace text tests passed');
