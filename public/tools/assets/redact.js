/* Text redaction rules. Pure functions, no network. Loaded by the page and by the Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.RD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function luhn(digits) {
    var sum = 0, alt = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var n = digits.charCodeAt(i) - 48;
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }
  function ipv4ok(s) {
    var p = s.split('.');
    return p.length === 4 && p.every(function (x) { return x.length > 0 && x.length <= 3 && +x <= 255 && (x === '0' || x[0] !== '0'); });
  }

  // Order matters: earlier rules win when matches overlap.
  var RULES = [
    { id: 'privkey', label: 'Private key block', tag: 'PRIVATE_KEY', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
    { id: 'jwt', label: 'JSON Web Token', tag: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
    { id: 'apikey', label: 'API key or token', tag: 'API_KEY', re: /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})\b/g },
    { id: 'url_cred', label: 'Password inside a URL', tag: 'URL_CREDENTIALS', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s\/:@]+:[^\s\/@]+@/gi, keep: function (m) { return m.slice(0, m.indexOf('://') + 3); }, suffix: '@' },
    { id: 'email', label: 'Email address', tag: 'EMAIL', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g },
    { id: 'card', label: 'Payment card number', tag: 'CARD', re: /\b(?:\d[ -]?){12,18}\d\b/g, test: function (m) { var d = m.replace(/[ -]/g, ''); return d.length >= 13 && d.length <= 19 && luhn(d); } },
    { id: 'ipv6', label: 'IPv6 address', tag: 'IPV6', re: /\b(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}\b|\b(?:[0-9A-Fa-f]{1,4}:){1,6}(?::[0-9A-Fa-f]{1,4}){1,6}\b|\b(?:[0-9A-Fa-f]{1,4}:){1,7}:(?![0-9A-Fa-f:])/g, test: function (m) { return /[0-9A-Fa-f]{2,}|:/.test(m) && m.indexOf(':') !== -1 && m.length > 4; } },
    { id: 'ipv4', label: 'IPv4 address', tag: 'IPV4', re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, test: ipv4ok },
    { id: 'mac', label: 'MAC address', tag: 'MAC', re: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g },
    { id: 'phone', label: 'Phone number', tag: 'PHONE', re: /(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?|\d{2,4}[ .-])\d{3,4}[ .-]\d{3,4}\b|\+\d{8,15}\b/g, test: function (m) { var d = m.replace(/\D/g, ''); return d.length >= 8 && d.length <= 15; } },
  ];

  function redact(text, enabled) {
    text = String(text);
    var on = enabled || {};
    var hits = [];
    RULES.forEach(function (r) {
      if (on[r.id] === false) return;
      r.re.lastIndex = 0;
      var m;
      while ((m = r.re.exec(text)) !== null) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        if (r.test && !r.test(m[0])) continue;
        var start = m.index, end = m.index + m[0].length;
        if (r.id === 'url_cred') { start = m.index + m[0].indexOf('://') + 3; end = m.index + m[0].length - 1; }
        hits.push({ start: start, end: end, rule: r });
      }
    });
    hits.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    var picked = [], last = 0;
    hits.forEach(function (h) { if (h.start >= last) { picked.push(h); last = h.end; } });
    var counts = {}, out = '', pos = 0, seen = {};
    picked.forEach(function (h) {
      var original = text.slice(h.start, h.end);
      var key = h.rule.id + '|' + original.toLowerCase();
      var k = seen[h.rule.id] || (seen[h.rule.id] = { n: 0, map: {} });
      if (!(key in k.map)) k.map[key] = ++k.n;
      counts[h.rule.id] = (counts[h.rule.id] || 0) + 1;
      out += text.slice(pos, h.start) + '[' + h.rule.tag + '_' + k.map[key] + ']';
      pos = h.end;
    });
    out += text.slice(pos);
    return { text: out, counts: counts, total: picked.length };
  }

  return { RULES: RULES, redact: redact, luhn: luhn };
});
