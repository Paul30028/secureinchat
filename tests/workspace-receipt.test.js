// Node tests for the private workspace local processing receipt.
// Run with: node --test tests/*.test.js (after node build/build.mjs).
const assert = require('assert');
const R = require('../public/workspace/assets/receipt.js');
let n = 0;
function t(name, fn) { fn(); n++; }
const keys = (o) => Object.keys(o).sort();

const SOURCE = 'Please email bob@example.com about the private draft.';
const EMAIL = 'bob@example.com';
const LINK = 'https://example.com/private?token=SECRETVALUE&utm_source=news';
const FILENAME = 'holiday-photo.jpg';
const NOW = new Date('2026-01-02T03:04:05.000Z');

t('text receipt has only the allowed fields and category counts', () => {
  const r = R.build({
    checkType: 'text',
    recipient: 'ai',
    now: NOW,
    summary: { counts: { email: 2, phone: 1, unknown: 9 } }
  });
  assert.deepStrictEqual(keys(r), ['checkType', 'createdAt', 'method', 'notice', 'recipient', 'schemaVersion', 'summary', 'unsigned'].sort());
  assert.strictEqual(r.schemaVersion, 1);
  assert.strictEqual(r.createdAt, '2026-01-02T03:04:05.000Z');
  assert.strictEqual(r.checkType, 'text');
  assert.deepStrictEqual(keys(r.summary), ['counts']);
  assert.deepStrictEqual(keys(r.summary.counts), ['card', 'email', 'id', 'ipv4', 'key', 'phone'].sort());
  assert.strictEqual(r.summary.counts.email, 2);
  assert.strictEqual(r.summary.counts.phone, 1);
  assert.strictEqual(r.summary.counts.key, 0);
  assert.strictEqual(r.summary.counts.unknown, undefined);
  assert.strictEqual(r.unsigned, true);
});

t('source text, URL and file name passed as extra input never reach the JSON', () => {
  const r = R.build({
    checkType: 'text',
    now: NOW,
    summary: { counts: { email: 1, note: SOURCE }, source: SOURCE, matches: [SOURCE] },
    source: SOURCE,
    text: SOURCE,
    url: LINK,
    filename: FILENAME,
    name: FILENAME
  });
  const json = R.toJSON(r);
  for (const marker of [SOURCE, EMAIL, LINK, 'SECRETVALUE', 'utm_source', FILENAME, 'holiday']) {
    assert.strictEqual(json.includes(marker), false, 'receipt leaked: ' + marker);
  }
  assert.strictEqual(json.includes('bob'), false);
  assert.strictEqual(json.includes('example.com'), false);
});

t('link receipt keeps counts only, not URL values or parameter names', () => {
  const r = R.build({
    checkType: 'link',
    recipient: 'work',
    now: NOW,
    summary: { queryParameters: 3, trackingParameters: 1, reviewParameters: 2, fragmentReview: 1, input: LINK, query: [{ key: 'token', value: 'SECRETVALUE' }] },
    url: LINK,
    filename: FILENAME
  });
  assert.deepStrictEqual(keys(r.summary), ['fragmentReview', 'queryParameters', 'reviewParameters', 'trackingParameters']);
  assert.strictEqual(r.summary.queryParameters, 3);
  assert.strictEqual(r.summary.trackingParameters, 1);
  assert.strictEqual(r.summary.reviewParameters, 2);
  assert.strictEqual(r.summary.fragmentReview, 1);
  const json = R.toJSON(r);
  for (const marker of [LINK, 'SECRETVALUE', 'utm_source', 'token', FILENAME]) {
    assert.strictEqual(json.includes(marker), false, 'receipt leaked: ' + marker);
  }
});

t('image receipt has before and after dimensions and bytes only', () => {
  const r = R.build({
    checkType: 'image',
    now: NOW,
    summary: {
      before: { width: 640, height: 480, bytes: 123456, name: FILENAME },
      after: { width: 640, height: 480, bytes: 98765, filename: FILENAME }
    },
    filename: FILENAME
  });
  assert.deepStrictEqual(keys(r.summary), ['after', 'before']);
  assert.deepStrictEqual(keys(r.summary.before), ['bytes', 'height', 'width']);
  assert.deepStrictEqual(keys(r.summary.after), ['bytes', 'height', 'width']);
  assert.deepStrictEqual(r.summary.before, { width: 640, height: 480, bytes: 123456 });
  assert.deepStrictEqual(r.summary.after, { width: 640, height: 480, bytes: 98765 });
  const json = R.toJSON(r);
  assert.strictEqual(json.includes(FILENAME), false);
  assert.strictEqual(json.includes('holiday'), false);
});

t('recipient is omitted unless one of the four options was selected', () => {
  assert.strictEqual(R.build({ checkType: 'text', now: NOW }).recipient, undefined);
  assert.strictEqual(R.build({ checkType: 'text', recipient: '', now: NOW }).recipient, undefined);
  assert.strictEqual(R.build({ checkType: 'text', recipient: 'other', now: NOW }).recipient, undefined);
  const r = R.build({ checkType: 'text', recipient: 'public', now: NOW, summary: {} });
  assert.deepStrictEqual(r.recipient, { id: 'public', label: 'Public post' });
  assert.strictEqual(R.toJSON(r).includes('tips'), false);
});

t('recipient catalog has four options with two to four local review points', () => {
  assert.strictEqual(R.RECIPIENTS.length, 4);
  assert.deepStrictEqual(R.RECIPIENTS.map((x) => x.id), ['ai', 'work', 'public', 'known']);
  for (const item of R.RECIPIENTS) {
    assert.ok(item.label.length > 0);
    assert.ok(item.tips.length >= 2 && item.tips.length <= 4, item.id + ' has ' + item.tips.length + ' tips');
    for (const tip of item.tips) assert.ok(typeof tip === 'string' && tip.length > 0);
  }
  assert.strictEqual(R.recipientById('work').label, 'Work / email');
  assert.strictEqual(R.recipientById('missing'), null);
});

t('receipt says it is unsigned, not proof and only the user\'s own record', () => {
  const r = R.build({ checkType: 'text', now: NOW, summary: {} });
  assert.strictEqual(r.unsigned, true);
  assert.ok(/unsigned/i.test(r.notice));
  assert.ok(/not proof/i.test(r.notice));
  assert.ok(/your own record/i.test(r.notice));
  assert.ok(/limited set of common formats/i.test(r.method));
  assert.ok(/not semantic review/i.test(r.method));
});

t('link and image methods state their limits', () => {
  assert.ok(/did not open, contact or follow/i.test(R.build({ checkType: 'link', now: NOW }).method));
  assert.ok(/cannot tell whether the destination is safe/i.test(R.build({ checkType: 'link', now: NOW }).method));
  assert.ok(/does not prove every block is gone/i.test(R.build({ checkType: 'image', now: NOW }).method));
  assert.ok(/does not inspect faces/i.test(R.build({ checkType: 'image', now: NOW }).method));
});

t('counts are whole, non-negative numbers and bad values become zero', () => {
  const r = R.build({
    checkType: 'text',
    now: NOW,
    summary: { counts: { email: '3', phone: -2, key: 1.9, id: true, card: Infinity, ipv4: NaN } }
  });
  assert.deepStrictEqual(r.summary.counts, { key: 1, email: 3, id: 0, card: 0, phone: 0, ipv4: 0 });
});

t('an unknown check type produces no receipt', () => {
  assert.strictEqual(R.build({ checkType: 'video', now: NOW }), null);
  assert.strictEqual(R.build({ checkType: '', now: NOW }), null);
  assert.strictEqual(R.build({ checkType: 'TEXT', now: NOW }), null);
  assert.strictEqual(R.build(), null);
  assert.strictEqual(R.toJSON(null), '');
});

t('JSON round-trips and contains no undefined values', () => {
  const r = R.build({ checkType: 'text', recipient: 'known', now: NOW, summary: { counts: { email: 1 } } });
  const json = R.toJSON(r);
  assert.deepStrictEqual(JSON.parse(json), r);
  assert.strictEqual(json.includes('undefined'), false);
  assert.ok(json.endsWith('\n'));
});

console.log(n + ' workspace receipt tests passed');
