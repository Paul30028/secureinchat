const assert = require('node:assert/strict');
const P = require('../public/tools/assets/pw.js');
const crypto = require('node:crypto');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const lvl = (s) => P.estimate(s).level;

t('empty gives null', () => assert.equal(P.estimate(''), null));
t('common passwords and leetspeak variants are very weak', () => { ['password', 'PASSWORD', 'p@ssw0rd', '123456', 'qwerty', 'Letmein'].forEach(s => assert.equal(lvl(s), 0, s)); });
t('short, simple passwords are weak', () => { assert.ok(lvl('abcdefg') <= 1); assert.ok(lvl('aaaaaaaaaa') <= 1); assert.ok(lvl('12345678901') <= 1); });
t('capital word plus digits is capped at weak', () => assert.ok(lvl('Sunshine2024!') <= 1));
t('long random mixed password is very strong', () => assert.equal(lvl('k7#Vq9!rTz2@Lm8%Xw4$'), 4));
t('length beats decoration', () => assert.ok(P.estimate('x7Kp2vQm9RtLw4Zs8Nb').bits > P.estimate('P@ssw0rd!').bits));
t('repeats, runs and keyboard walks add little', () => {
  assert.ok(P.estimate('qwertyuiop1234').bits < P.estimate('xkcvbpwoiq9274').bits);
  assert.ok(P.estimate('abcabcabcabc').bits < P.estimate('zqmxvbnrkwty').bits);
});
t('notes are given', () => assert.ok(P.estimate('qwerty12345!x').notes.length > 0));
t('generator: length, classes and determinism with a fake rng', () => {
  const rng = (buf) => crypto.randomFillSync(buf);
  const g = P.generate(24, {}, rng);
  assert.equal(g.length, 24); assert.match(g, /[a-z]/); assert.match(g, /[A-Z]/); assert.match(g, /[0-9]/);
  assert.ok(!/[0Ol1I]/.test(g), 'no look-alike characters');
  const s = P.generate(20, { symbols: true }, rng); assert.match(s, /[!@#$%^&*\-_=+?]/);
  assert.equal(P.generate(1, { lower: false, upper: false, digits: false }, rng).length, 1);
  assert.equal(P.generate(500, {}, rng).length, 128);
});
t('generator output is uniform enough over a small alphabet', () => {
  const rng = (buf) => crypto.randomFillSync(buf);
  const counts = {}; for (let i = 0; i < 4000; i++) { const c = P.generate(1, { upper: false, digits: false, lower: true }, rng); counts[c] = (counts[c] || 0) + 1; }
  const vals = Object.values(counts); assert.ok(Math.min(...vals) > 90 && Math.max(...vals) < 230, JSON.stringify(counts));
});
t('parseRange finds a suffix, ignores padding and other lines', () => {
  const body = '0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:0\r\n';
  assert.equal(P.parseRange(body, '00d4f6e8fa6eecad2a3aa415eec418d38ec'), 2);
  assert.equal(P.parseRange(body, '011053FD0102E94D6AE2F8B83D76FAF94F6'), 0);
  assert.equal(P.parseRange(body, 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'), 0);
});
console.log('\n' + n + ' tests passed');
