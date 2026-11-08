// Node tests for the exposure-scan report and default redaction. Run after node build/build.mjs.
const assert = require('assert');
const R = require('../public/scan/assets/report.js');

let n = 0;
function t(name, fn) { fn(); n++; }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36';
const GPU = 'Google Inc. (NVIDIA) / ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0 ps_5_0, D3D11)';
const RESOLUTION = '1920\u00D71080 (available 1920\u00D71040), window 1280\u00D7720, pixel ratio 1.25';
const CANVAS = 'Stable drawing (short local hash a1b2c3d4e5f6); same on every draw';
const TIMEZONE = 'Europe/Berlin (UTC+01:00)';

function result(id, title, value, risk) {
  return {
    id,
    group: 'local',
    title,
    value,
    whoCanRead: 'Scripts on any website you visit.',
    risk: risk || 'medium',
    howToReduce: 'Use a browser that resists fingerprinting.',
    source: 'Test API'
  };
}

const RESULTS = [
  result('webgl', 'WebGL renderer', GPU),
  result('platform', 'Platform and user agent', 'User agent: ' + UA + ' \u00B7 Platform: Win32'),
  result('screen', 'Screen, window and pixel ratio', RESOLUTION),
  result('canvas', 'Canvas drawing', CANVAS),
  result('timezone', 'Time zone', TIMEZONE),
  result('languages', 'Language preferences', 'en-US, en'),
  result('cookies', 'Cookie support', 'Enabled', 'low')
];
const AT = new Date('2026-11-08T12:00:00.000Z');
const CHANGES = [{ id: 'timezone', title: 'Time zone', value: TIMEZONE, before: 'Europe/Paris (UTC+01:00)' }];

function defaults(extra) {
  return Object.assign({ generatedAt: AT, changes: CHANGES }, extra || {});
}

t('default report replaces raw identifiable values with category descriptions', () => {
  const report = R.buildReport(RESULTS, defaults());
  const byId = Object.fromEntries(report.items.map((item) => [item.id, item]));
  assert.strictEqual(byId.webgl.value, R.CATEGORY_VALUE.webgl);
  assert.strictEqual(byId.platform.value, R.CATEGORY_VALUE.platform);
  assert.strictEqual(byId.screen.value, R.CATEGORY_VALUE.screen);
  assert.strictEqual(byId.timezone.value, R.CATEGORY_VALUE.timezone);
  assert.strictEqual(byId.canvas.value, R.CATEGORY_VALUE.canvas);
  assert.strictEqual(byId.webgl.redacted, true);
  assert.strictEqual(byId.webgl.rawIncluded, false);
  assert.strictEqual(byId.cookies.value, 'Enabled');
  assert.strictEqual(report.redaction.includeRaw, false);
});

t('default JSON and text contain none of the raw values', () => {
  const json = R.buildJson(RESULTS, defaults());
  const text = R.buildText(RESULTS, defaults());
  for (const raw of [GPU, UA, RESOLUTION, TIMEZONE, 'a1b2c3d4e5f6']) {
    assert.strictEqual(json.includes(raw), false, 'JSON leaked ' + raw);
    assert.strictEqual(text.includes(raw), false, 'text leaked ' + raw);
  }
});

t('raw values appear in both formats only after the user opts in', () => {
  const json = R.buildJson(RESULTS, defaults({ includeRaw: true }));
  const text = R.buildText(RESULTS, defaults({ includeRaw: true }));
  for (const raw of [GPU, UA, RESOLUTION, TIMEZONE]) {
    assert.strictEqual(json.includes(raw), true, 'JSON missed ' + raw);
    assert.strictEqual(text.includes(raw), true, 'text missed ' + raw);
  }
  const parsed = JSON.parse(json);
  assert.strictEqual(parsed.redaction.includeRaw, true);
  assert.strictEqual(parsed.redaction.defaultPolicy, 'raw-at-user-request');
  assert.ok(parsed.redaction.note.includes('may identify your device'));
});

t('the canvas hash is withheld even with raw values enabled', () => {
  const json = R.buildJson(RESULTS, defaults({ includeRaw: true }));
  const text = R.buildText(RESULTS, defaults({ includeRaw: true }));
  const canvas = JSON.parse(json).items.find((item) => item.id === 'canvas');
  assert.strictEqual(canvas.rawIncluded, false);
  assert.strictEqual(canvas.withheld, true);
  assert.strictEqual(json.includes('a1b2c3d4e5f6'), false);
  assert.strictEqual(text.includes('a1b2c3d4e5f6'), false);
  assert.strictEqual(JSON.parse(json).redaction.canvasHashExported, false);
});

t('text and JSON describe the same items, values and summary', () => {
  const json = R.buildJson(RESULTS, defaults());
  const text = R.buildText(RESULTS, defaults());
  const report = JSON.parse(json);
  assert.ok(text.includes(report.summary.line));
  assert.strictEqual(report.summary.total, RESULTS.length);
  assert.strictEqual(report.summary.high, 0);
  for (const item of report.items) {
    assert.ok(text.includes('- ' + item.title), 'missing title ' + item.title);
    assert.ok(text.includes('  Value: ' + item.value), 'missing value for ' + item.id);
    assert.ok(text.includes('  Who can read it: ' + item.whoCanRead));
    assert.ok(text.includes('  Source: ' + item.source));
  }
  assert.ok(text.includes('CHANGES SINCE THE LAST SAVED SCAN'));
  assert.ok(text.includes('- Time zone: value changed'));
  assert.deepStrictEqual(report.changes, [{ id: 'timezone', title: 'Time zone', changed: true }]);
  assert.strictEqual(report.schema, R.SCHEMA);
  assert.strictEqual(report.generatedAt, AT.toISOString());
});

t('summary counts risk groups and never returns a uniqueness or safety score', () => {
  const line = R.summaryLine(RESULTS);
  assert.strictEqual(line, 'A normal website can read 7 items from you without your permission, 0 of them higher risk.');
  assert.strictEqual(R.summarize(RESULTS).medium, 6);
  assert.strictEqual(R.summarize(RESULTS).low, 1);
  assert.ok(!/unique|safe|score/i.test(line));
});

t('generated time is deterministic when supplied and valid when omitted', () => {
  assert.strictEqual(JSON.parse(R.buildJson(RESULTS, defaults())).generatedAt, '2026-11-08T12:00:00.000Z');
  assert.ok(!Number.isNaN(Date.parse(JSON.parse(R.buildJson(RESULTS)).generatedAt)));
});

t('empty and malformed result lists are safe', () => {
  const report = R.buildReport(null, { generatedAt: AT });
  assert.deepStrictEqual(report.items, []);
  assert.strictEqual(report.summary.total, 0);
  assert.ok(R.buildText(null, { generatedAt: AT }).includes('A normal website can read 0 items'));
});

console.log('scan-report: ' + n + ' tests passed');
