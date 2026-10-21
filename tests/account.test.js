// Node tests for the account checkup logic. Run: node tests/account.test.js
const assert = require('assert');
const A = require('../public/tools/assets/account.js');
let n = 0;
function t(name, fn) { fn(); n++; }
const ids = (xs) => xs.map((x) => x.id);

t('eight items, unique ids', () => {
  assert.ok(A.ITEMS.every((i) => i.name && i.todo));
  assert.strictEqual(A.ITEMS.length, 8);
  assert.strictEqual(new Set(ids(A.ITEMS)).size, 8);
});
t('no answers is idle', () => {
  const r = A.summarize({});
  assert.strictEqual(r.tone, 'idle'); assert.strictEqual(r.done, 0); assert.strictEqual(r.next.length, 0); assert.strictEqual(r.open.length, 8);
});
t('all yes is ok', () => {
  const a = {}; A.ITEMS.forEach((i) => { a[i.id] = 'yes'; });
  const r = A.summarize(a);
  assert.strictEqual(r.tone, 'ok'); assert.strictEqual(r.done, 8); assert.ok(r.headline.startsWith('All 8 done'));
});
t('next lists "no" before "unsure", each in priority order', () => {
  const r = A.summarize({ breach: 'no', mfa: 'unsure', codes: 'no', unique: 'yes', sessions: 'unsure' });
  assert.deepStrictEqual(ids(r.next), ['codes', 'breach', 'mfa', 'sessions']);
  assert.strictEqual(r.tone, 'fail');
  assert.strictEqual(r.headline, '1 of 8 done, 2 to do, 2 to find out, 3 not answered.');
});
t('only unsure is warn', () => {
  assert.strictEqual(A.summarize({ mfa: 'unsure' }).tone, 'warn');
});
t('unknown values and prototype keys are ignored', () => {
  const r = A.summarize({ mfa: 'maybe', toString: 'yes', __proto__: { unique: 'yes' } });
  assert.strictEqual(r.answered, 0); assert.strictEqual(r.tone, 'idle');
});
t('copy text has the state and nothing else', () => {
  const r = A.summarize({ mfa: 'no', recovery: 'unsure', unique: 'yes' });
  const s = A.text(r, '2026-10-21');
  assert.ok(s.startsWith('Account security checkup (secureinchat.com/tools/account-checkup/), 2026-10-21\n1 of 8 done.'));
  assert.ok(s.includes('Do next:\n1. Turn on two-step verification\n2. Update the recovery email and phone (find out)'));
  assert.ok(s.includes('Not answered:\n- Backup codes'));
  assert.ok(s.endsWith('Nothing was saved or sent. This list is only what you ticked.'));
  assert.ok(!/@/.test(s));
});
console.log(`account: ${n} tests passed`);
