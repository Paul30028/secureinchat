// Checks the before/after metadata comparison used by the photo and file cleaners (W18).
const test = require('node:test');
const assert = require('assert');
const D = require('../public/tools/assets/cleandiff.js');

const it = (category, name, value) => ({ category, name, value: value === undefined ? 'v' : value });
const names = (list) => list.map((x) => x.category + '/' + x.name);

test('everything removed', () => {
  const r = D.compare([it('EXIF', 'Make'), it('GPS', 'Latitude')], []);
  assert.deepStrictEqual(names(r.removed), ['EXIF/Make', 'GPS/Latitude']);
  assert.strictEqual(r.left.length, 0);
  assert.strictEqual(r.added.length, 0);
});

test('some left, values ignored', () => {
  const r = D.compare([it('EXIF', 'Make', 'A'), it('PNG', 'Gamma', '2.2')], [it('PNG', 'Gamma', '0.45')]);
  assert.deepStrictEqual(names(r.removed), ['EXIF/Make']);
  assert.deepStrictEqual(names(r.left), ['PNG/Gamma']);
  assert.strictEqual(r.left[0].value, '2.2', 'left items are the "before" entries');
});

test('duplicates are counted', () => {
  const r = D.compare([it('Doc', 'Author'), it('Doc', 'Author')], [it('Doc', 'Author')]);
  assert.strictEqual(r.removed.length, 1);
  assert.strictEqual(r.left.length, 1);
  assert.strictEqual(r.added.length, 0);
});

test('items present only after cleaning are added', () => {
  const r = D.compare([it('Doc', 'Author')], [it('Doc', 'Producer'), it('Doc', 'Producer')]);
  assert.deepStrictEqual(names(r.removed), ['Doc/Author']);
  assert.deepStrictEqual(names(r.added), ['Doc/Producer', 'Doc/Producer']);
});

test('keys ignore case and surrounding spaces', () => {
  const r = D.compare([it(' EXIF ', 'make ')], [it('exif', ' MAKE')]);
  assert.strictEqual(r.left.length, 1);
  assert.strictEqual(r.removed.length, 0);
});

test('null and garbage input never throws', () => {
  for (const [b, a] of [[null, null], [undefined, 5], ['x', {}], [[null, 3, 'str', {}], [null]]]) {
    const r = D.compare(b, a);
    assert.ok(Array.isArray(r.removed) && Array.isArray(r.left) && Array.isArray(r.added));
  }
  const r = D.compare([null, { value: 1 }], [{}]);
  assert.strictEqual(r.left.length, 1, 'empty items share the empty key');
  assert.strictEqual(r.removed.length, 1);
  assert.strictEqual(r.removed[0].name, '');
});

test('fromExif with GPS and fields', () => {
  const out = D.fromExif({ kind: 'jpeg', found: true, hasGPS: true, gps: { lat: 51.5, lon: -0.12 },
    fields: [['Camera make', 'TestCam'], ['Date taken', '2024:01:01'], ['Orientation', '1'], ['Software', 'X']] });
  assert.deepStrictEqual(out[0], { category: 'Location', name: 'GPS', value: '51.50000, -0.12000' });
  assert.deepStrictEqual(out.slice(1).map((x) => x.category), ['Device', 'Dates', 'Other', 'Device']);
});

test('fromExif with GPS block but no coordinates', () => {
  const out = D.fromExif({ hasGPS: true, gps: null, fields: [] });
  assert.deepStrictEqual(out, [{ category: 'Location', name: 'GPS', value: 'present' }]);
});

test('fromExif with no metadata or bad input', () => {
  assert.deepStrictEqual(D.fromExif({ kind: 'jpeg', found: false, fields: [], gps: null, hasGPS: false }), []);
  assert.deepStrictEqual(D.fromExif(null), []);
  assert.deepStrictEqual(D.fromExif({ fields: 'nope' }), []);
});

test('byCategory keeps first-seen order', () => {
  const g = D.byCategory([it('B', 'x'), it('A', 'y'), it('b', 'z')]);
  assert.deepStrictEqual(g.map((x) => x.name), ['B', 'A']);
  assert.strictEqual(g[0].items.length, 2);
});

test('round trip with the real EXIF parser output shape', () => {
  const before = D.fromExif({ hasGPS: true, gps: { lat: 1, lon: 2 }, fields: [['Camera make', 'C']] });
  const after = D.fromExif({ hasGPS: false, gps: null, fields: [] });
  const r = D.compare(before, after);
  assert.strictEqual(r.removed.length, 2);
  assert.strictEqual(r.left.length, 0);
});
