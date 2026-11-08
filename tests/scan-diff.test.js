// Node tests for the exposure-scan two-run comparison. Run after node build/build.mjs.
const assert = require('assert');
const D = require('../public/scan/assets/diff.js');

let n = 0;
function t(name, fn) { fn(); n++; }

const r = (id, value, title) => ({ id, title: title || id, value });

t('identical scans are unchanged and report no changes', () => {
  const a = [r('timezone', 'Europe/Berlin'), r('screen', '1920x1080')];
  const b = [r('timezone', 'Europe/Berlin'), r('screen', '1920x1080')];
  const d = D.diff(a, b);
  assert.deepStrictEqual(d.changed, []);
  assert.deepStrictEqual(d.incomparable, []);
  assert.deepStrictEqual(d.unchanged.map((x) => x.id), ['timezone', 'screen']);
  assert.strictEqual(d.hasChanges, false);
});

t('a changed value is reported with both values', () => {
  const d = D.diff([r('screen', '1920x1080')], [r('screen', '1280x720')]);
  assert.deepStrictEqual(d.changed, [{ id: 'screen', title: 'screen', value: '1280x720', before: '1920x1080' }]);
  assert.strictEqual(d.hasChanges, true);
  assert.deepStrictEqual(d.unchanged, []);
});

t('matching uses id, not the display title', () => {
  const d = D.diff([r('a', 'one', 'Old title')], [r('a', 'one', 'New title')]);
  assert.deepStrictEqual(d.unchanged, [{ id: 'a', title: 'New title', value: 'one' }]);
  assert.deepStrictEqual(d.changed, []);
});

t('missing results and unavailable values cannot be compared', () => {
  const d = D.diff(
    [r('a', 'one'), r('b', 'two'), r('c', 'three')],
    [r('a', 'one'), r('b', 'Unavailable: blocked'), r('d', 'four')]
  );
  assert.deepStrictEqual(d.unchanged.map((x) => x.id), ['a']);
  assert.deepStrictEqual(d.incomparable.map((x) => x.id).sort(), ['b', 'c', 'd']);
  assert.ok(d.incomparable.every((x) => x.reason));
  assert.deepStrictEqual(d.changed, []);
});

t('empty and non-array inputs are safe', () => {
  const d = D.diff(null, undefined);
  assert.deepStrictEqual(d, { changed: [], unchanged: [], incomparable: [], hasChanges: false });
  const one = D.diff([r('a', 'one')], []);
  assert.deepStrictEqual(one.incomparable.map((x) => x.id), ['a']);
});

t('malformed entries are skipped instead of throwing', () => {
  const d = D.diff([null, { value: 'no id' }, r('a', 'one')], [r('a', 'one'), 42]);
  assert.deepStrictEqual(d.unchanged.map((x) => x.id), ['a']);
  assert.strictEqual(d.incomparable.length, 0);
});

t('a value starting with Unavailable (any case) is not comparable', () => {
  assert.strictEqual(D.comparable('unavailable: nope'), false);
  assert.strictEqual(D.comparable('Unavailable'), false);
  assert.strictEqual(D.comparable('Unavailable-ish but real'), true);
  const d = D.diff([r('a', 'unavailable: blocked')], [r('a', 'unavailable: blocked')]);
  assert.strictEqual(d.unchanged.length, 0);
  assert.strictEqual(d.incomparable.length, 1);
});

t('only ids present in both scans can be unchanged', () => {
  const d = D.diff([r('a', 'one')], [r('a', 'one'), r('b', 'two')]);
  assert.deepStrictEqual(d.unchanged.map((x) => x.id), ['a']);
  assert.deepStrictEqual(d.incomparable.map((x) => x.id), ['b']);
});

console.log('scan-diff: ' + n + ' tests passed');
