// Node tests for the exposure-scan result model. Run after node build/build.mjs.
const assert = require('assert');
const M = require('../public/scan/assets/model.js');

let n = 0;
function t(name, fn) { fn(); n++; }

const SAMPLE = {
  id: 'timezone',
  group: 'local',
  title: 'Time zone',
  value: 'Europe/Berlin (UTC+01:00)',
  whoCanRead: 'Scripts on any website you visit.',
  risk: 'medium',
  howToReduce: 'Change the browser setting.',
  source: 'Intl.DateTimeFormat().resolvedOptions().timeZone'
};

t('makeResult returns exactly the eight schema fields in order', () => {
  const r = M.makeResult(SAMPLE);
  assert.deepStrictEqual(Object.keys(r), M.FIELDS);
  assert.deepStrictEqual(r, SAMPLE);
  assert.notStrictEqual(r, SAMPLE, 'returns a copy');
});

t('every local spec maps to a valid local result', () => {
  assert.ok(M.LOCAL_SPECS.length >= 12, 'at least twelve local items');
  const ids = new Set();
  M.LOCAL_SPECS.forEach((spec) => {
    const r = M.makeResult({ ...spec, group: 'local', value: 'a value' });
    assert.strictEqual(r.group, 'local');
    assert.ok(M.RISKS.includes(r.risk));
    assert.ok(!ids.has(r.id), 'ids are unique: ' + r.id);
    ids.add(r.id);
    assert.ok(r.whoCanRead.length > 0 && r.howToReduce.length > 0 && r.source.length > 0);
  });
  ['timezone', 'languages', 'screen', 'platform', 'hardware', 'canvas', 'webgl', 'fonts',
    'privacy-signals', 'cookies', 'touch', 'color-scheme', 'reduced-motion'].forEach((id) => {
    assert.ok(ids.has(id), 'covers ' + id);
  });
});

t('required fields, group and risk are enforced', () => {
  M.FIELDS.forEach((key) => {
    const bad = { ...SAMPLE };
    delete bad[key];
    assert.throws(() => M.makeResult(bad), TypeError, 'missing ' + key);
    const empty = { ...SAMPLE, [key]: '' };
    assert.throws(() => M.makeResult(empty), TypeError, 'empty ' + key);
  });
  assert.throws(() => M.makeResult({ ...SAMPLE, group: 'third-party' }), TypeError);
  assert.throws(() => M.makeResult({ ...SAMPLE, risk: 'unknown' }), TypeError);
  assert.throws(() => M.makeResult(null), TypeError);
});

t('isResult mirrors makeResult without throwing', () => {
  assert.strictEqual(M.isResult(SAMPLE), true);
  assert.strictEqual(M.isResult({ ...SAMPLE, risk: 'critical' }), false);
  assert.strictEqual(M.isResult(null), false);
});

t('risk grouping is high, medium, low with no empty group', () => {
  const results = [
    { ...SAMPLE, id: 'a', risk: 'low' },
    { ...SAMPLE, id: 'b', risk: 'high' },
    { ...SAMPLE, id: 'c', risk: 'medium' },
    { ...SAMPLE, id: 'd', risk: 'high' }
  ];
  const groups = M.groupByRisk(results);
  assert.deepStrictEqual(groups.map((g) => g.risk), ['high', 'medium', 'low']);
  assert.deepStrictEqual(groups.map((g) => g.items.length), [2, 1, 1]);
  assert.ok(groups.every((g) => g.label && g.symbol));
  assert.deepStrictEqual(M.groupByRisk([]), []);
});

t('summary counts total, groups and risks', () => {
  const results = [
    { ...SAMPLE, id: 'a', risk: 'low' },
    { ...SAMPLE, id: 'b', risk: 'high' },
    { ...SAMPLE, id: 'c', group: 'network', risk: 'medium' }
  ];
  assert.deepStrictEqual(M.summarize(results), {
    local: 2, network: 1, low: 1, medium: 1, high: 1, total: 3
  });
  assert.strictEqual(M.summarize([]).total, 0);
});

t('unavailable values are labelled and not comparable', () => {
  const value = M.unavailable('the browser blocked this read');
  assert.ok(/^Unavailable: /.test(value));
  assert.strictEqual(M.isComparable(value), false);
  assert.strictEqual(M.isComparable('Europe/Berlin'), true);
  assert.strictEqual(M.isComparable(''), false);
  assert.strictEqual(M.isComparable(null), false);
});

t('no code path claims uniqueness or a percentage', () => {
  const text = JSON.stringify(M.LOCAL_SPECS) + String(M.makeResult);
  assert.ok(!/unique|uniqueness|%|one in [0-9]/i.test(text), 'no uniqueness or percentage wording');
});

console.log('scan-model: ' + n + ' tests passed');
