/* Password strength estimate and generator. Pure logic: no DOM, no network, nothing stored. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PW = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // A short list of the most common passwords and words. The real lists are millions long, which is why the
  // online breach check below is more reliable than this estimate for any password that has been used before.
  var COMMON = ('123456 password 12345678 qwerty 123456789 12345 1234 111111 1234567 dragon 123123 baseball abc123 football ' +
    'monkey letmein shadow master 666666 qwertyuiop 123321 mustang 1234567890 michael 654321 superman 1qaz2wsx 7777777 ' +
    'welcome admin login princess solo passw0rd starwars iloveyou sunshine hello freedom whatever trustno1 batman zaq1zaq1 ' +
    'qazwsx password1 qwerty123 000000 1q2w3e4r summer winter spring autumn secret computer internet test guest root user ' +
    'love angel cookie flower purple ginger hunter soccer jordan harley ranger killer pepper cheese thunder tigger buster').split(' ');
  var COMMON_SET = {};
  COMMON.forEach(function (w) { COMMON_SET[w] = 1; });
  var WALKS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1qaz2wsx', 'qazwsx', '1q2w3e4r', 'qweasd', 'asdf', 'zxcv', 'qwer', 'poiuy', 'mnbv'];
  var LEET = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

  function unleet(s) { return s.replace(/[0134578@$!]/g, function (c) { return LEET[c] || c; }); }

  function classes(pw) {
    var c = { lower: /[a-z]/.test(pw), upper: /[A-Z]/.test(pw), digit: /[0-9]/.test(pw), symbol: /[^A-Za-z0-9\s\u0080-￿]/.test(pw), other: /[\u0080-￿\s]/.test(pw) };
    c.count = (c.lower ? 1 : 0) + (c.upper ? 1 : 0) + (c.digit ? 1 : 0) + (c.symbol ? 1 : 0) + (c.other ? 1 : 0);
    return c;
  }

  function charsetSize(c) { return (c.lower ? 26 : 0) + (c.upper ? 26 : 0) + (c.digit ? 10 : 0) + (c.symbol ? 33 : 0) + (c.other ? 60 : 0); }

  /* Returns null for an empty password, otherwise { bits, level, label, notes[] }.
     level: 0 very weak .. 4 very strong. This is an estimate from length, variety and simple patterns. */
  function estimate(pw) {
    if (!pw) return null;
    var notes = [];
    var low = pw.toLowerCase();
    if (COMMON_SET[low] || COMMON_SET[unleet(low)]) {
      return { bits: 3, level: 0, label: 'Very weak', notes: ['This is one of the most common passwords. Attackers try it first.'] };
    }
    var c = classes(pw);
    var perChar = c.count >= 3 ? Math.min(Math.log2(charsetSize(c)), 6) * 0.8
      : c.count === 2 ? Math.log2(charsetSize(c)) * 0.62
      : (c.digit ? 2.3 : 3.0);

    // Count characters that add little: repeats, runs like abc or 123, keyboard walks.
    var skip = new Array(pw.length).fill(false);
    var i;
    for (i = 1; i < pw.length; i++) { if (low[i] === low[i - 1]) skip[i] = true; }
    var repeats = skip.filter(Boolean).length;
    var run = 1, seqChars = 0;
    for (i = 1; i < pw.length; i++) {
      var d = low.charCodeAt(i) - low.charCodeAt(i - 1);
      if ((d === 1 || d === -1) && (run === 1 || d === (low.charCodeAt(i - 1) - low.charCodeAt(i - 2)))) {
        run++;
        if (run >= 3) { if (!skip[i]) seqChars++; skip[i] = true; }
      } else run = 1;
    }
    var walkChars = 0;
    WALKS.forEach(function (w) {
      var at = low.indexOf(w);
      while (at !== -1) { for (var k = 1; k < w.length; k++) { if (!skip[at + k]) { skip[at + k] = true; walkChars++; } } at = low.indexOf(w, at + w.length); }
    });
    var kept = skip.filter(function (s) { return !s; }).length;
    var bits = kept * perChar;

    // Common words inside the password count as a small choice, not as a string of letters.
    var words = 0;
    var base = unleet(low);
    COMMON.forEach(function (w) {
      if (w.length >= 4 && base.indexOf(w) !== -1) { words++; bits -= Math.max(0, (w.length - 1) * perChar - 12); }
    });
    var year = /(19|20)\d\d(?!\d)/.exec(pw);
    if (year) { bits -= Math.max(0, 4 * 2.3 - 6.6); notes.push('A year is easy to guess.'); }
    if (/^[A-Z][a-z]+[0-9]{1,4}[!@#$%^&*?]?$/.test(pw)) { bits = Math.min(bits, 34); notes.push('A capital word followed by digits is a very common pattern.'); }
    if (repeats) notes.push('Repeated characters add little.');
    if (seqChars) notes.push('Runs like abc or 123 add little.');
    if (walkChars) notes.push('Keyboard patterns like qwerty add little.');
    if (words) notes.push('It contains a common word.');
    if (pw.length < 12) notes.push('Longer is the easiest way to make a password stronger.');
    if (c.count === 1 && !c.digit) notes.push('Mixing in digits, capitals or symbols helps, but length helps more.');
    bits = Math.max(1, Math.round(bits));
    var level = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
    return { bits: bits, level: level, label: ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][level], notes: notes };
  }

  /* ---- generator ---- */
  function randomInt(max, rng) {
    // Rejection sampling so every value is equally likely.
    var limit = Math.floor(4294967296 / max) * max, v;
    var buf = new Uint32Array(1);
    do { rng(buf); v = buf[0]; } while (v >= limit);
    return v % max;
  }
  function defaultRng(buf) { return (self.crypto || root.crypto).getRandomValues(buf); }

  function generate(len, opts, rng) {
    rng = rng || defaultRng;
    opts = opts || {};
    var sets = [];
    if (opts.lower !== false) sets.push('abcdefghijkmnopqrstuvwxyz');
    if (opts.upper !== false) sets.push('ABCDEFGHJKLMNPQRSTUVWXYZ');
    if (opts.digits !== false) sets.push('23456789');
    if (opts.symbols) sets.push('!@#$%^&*-_=+?');
    if (!sets.length) sets.push('abcdefghijkmnopqrstuvwxyz');
    len = Math.max(sets.length, Math.min(128, len | 0));
    var all = sets.join('');
    var out = sets.map(function (s) { return s[randomInt(s.length, rng)]; });   // at least one of each chosen type
    while (out.length < len) out.push(all[randomInt(all.length, rng)]);
    for (var i = out.length - 1; i > 0; i--) { var j = randomInt(i + 1, rng); var t = out[i]; out[i] = out[j]; out[j] = t; }
    return out.join('');
  }

  /* ---- breach check helpers ---- */
  function parseRange(text, suffix) {
    // Each line is "SUFFIX:COUNT". Padded lines have a count of 0 and are ignored.
    var lines = String(text).split(/\r?\n/), want = suffix.toUpperCase();
    for (var i = 0; i < lines.length; i++) {
      var p = lines[i].trim().split(':');
      if (p.length === 2 && p[0].toUpperCase() === want) return parseInt(p[1], 10) || 0;
    }
    return 0;
  }

  return { estimate: estimate, generate: generate, parseRange: parseRange };
});
