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
  function ibanOk(s) {
    var v = s.replace(/\s/g, '').toUpperCase();
    if (v.length < 15 || v.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(v)) return false;
    var r = v.slice(4) + v.slice(0, 4), rem = 0;
    for (var i = 0; i < r.length; i++) {
      var c = r.charCodeAt(i), d = c >= 65 ? String(c - 55) : r[i];
      for (var j = 0; j < d.length; j++) rem = (rem * 10 + (d.charCodeAt(j) - 48)) % 97;
    }
    return rem === 1;
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
    { id: 'iban', label: 'IBAN', tag: 'IBAN', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b/g, test: ibanOk },
    { id: 'card', label: 'Payment card number', tag: 'CARD', re: /\b(?:\d[ -]?){12,18}\d\b/g, test: function (m) { var d = m.replace(/[ -]/g, ''); return d.length >= 13 && d.length <= 19 && luhn(d); } },
    { id: 'ipv6', label: 'IPv6 address', tag: 'IPV6', re: /\b(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}\b|\b(?:[0-9A-Fa-f]{1,4}:){1,6}(?::[0-9A-Fa-f]{1,4}){1,6}\b|\b(?:[0-9A-Fa-f]{1,4}:){1,7}:(?![0-9A-Fa-f:])/g, test: function (m) { return /[0-9A-Fa-f]{2,}|:/.test(m) && m.indexOf(':') !== -1 && m.length > 4; } },
    { id: 'ipv4', label: 'IPv4 address', tag: 'IPV4', re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, test: ipv4ok },
    { id: 'mac', label: 'MAC address', tag: 'MAC', re: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g },
    { id: 'phone', label: 'Phone number', tag: 'PHONE', re: /(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?|\d{2,4}[ .-])\d{3,4}[ .-]\d{3,4}\b|\+\d{8,15}\b/g, test: function (m) { var d = m.replace(/\D/g, ''); return d.length >= 8 && d.length <= 15; } },
  ];

  var TERM_RULE = { id: 'term', label: 'Your words', tag: 'NAME' };
  var WORD_RE;
  try { WORD_RE = new RegExp('[\\p{L}\\p{N}_]', 'u'); } catch (e) { WORD_RE = /[A-Za-z0-9_]/; }
  var RESTORE_RE = /(?:\\\[|\[|【)\s*([A-Za-z][A-Za-z0-9_]*?)\s*\\?_\s*(\d+)\s*(?:\\\]|\]|】)/g;

  function isWordChar(ch) { return !!ch && WORD_RE.test(ch); }
  function overlaps(a, b) { return a.start < b.end && b.start < a.end; }

  function parseTerms(str) {
    if (str == null) return [];
    return String(str).split(/[\n\r,，;；]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  }

  function normalizeTerms(terms) {
    if (!terms) return [];
    if (typeof terms === 'string') terms = parseTerms(terms);
    if (!terms.length) return [];
    var out = [], seen = {};
    for (var i = 0; i < terms.length; i++) {
      var s = String(terms[i] == null ? '' : terms[i]).trim();
      if (s.length < 2) continue;
      var key = s.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ text: s, lower: key, word: /[A-Za-z0-9]/.test(s), order: out.length });
    }
    out.sort(function (a, b) { return b.text.length - a.text.length || a.order - b.order; });
    return out;
  }

  function findTermHits(text, terms) {
    if (!terms.length) return [];
    // Search the original text with a case-insensitive RegExp. Offsets taken from
    // text.toLowerCase() are wrong when lowercasing changes length (for example 'İ'),
    // which made a term silently stay visible.
    var all = [];
    terms.forEach(function (term) {
      var src = term.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), re;
      try { re = new RegExp(src, 'giu'); } catch (e) { re = new RegExp(src, 'gi'); }
      var m;
      while ((m = re.exec(text)) !== null) {
        if (!m[0].length) { re.lastIndex++; continue; }
        var idx = m.index, end = idx + m[0].length;
        var before = idx > 0 ? text.charAt(idx - 1) : '';
        var after = end < text.length ? text.charAt(end) : '';
        if (!term.word || (!isWordChar(before) && !isWordChar(after))) {
          all.push({ start: idx, end: end, rule: TERM_RULE, len: m[0].length, order: all.length });
        }
        re.lastIndex = idx + 1;
      }
    });
    all.sort(function (a, b) { return b.len - a.len || a.start - b.start || a.order - b.order; });
    var picked = [];
    all.forEach(function (h) {
      for (var i = 0; i < picked.length; i++) if (overlaps(h, picked[i])) return;
      picked.push(h);
    });
    picked.sort(function (a, b) { return a.start - b.start; });
    return picked;
  }

  function normalizePlaceholderKey(s) {
    s = String(s).replace(/\\/g, '').replace(/\s+/g, '');
    s = s.replace(/^【/, '[').replace(/】$/, ']');
    return s.toUpperCase();
  }

  function redact(text, enabled, opts) {
    text = String(text);
    var on = enabled || {};
    opts = opts || {};
    var termHits = (on.term === false) ? [] : findTermHits(text, normalizeTerms(opts.terms));
    var ruleHits = [];
    RULES.forEach(function (r) {
      if (on[r.id] === false) return;
      r.re.lastIndex = 0;
      var m;
      while ((m = r.re.exec(text)) !== null) {
        if (m[0].length === 0) { r.re.lastIndex++; continue; }
        if (r.test && !r.test(m[0])) continue;
        var start = m.index, end = m.index + m[0].length;
        if (r.id === 'url_cred') { start = m.index + m[0].indexOf('://') + 3; end = m.index + m[0].length - 1; }
        ruleHits.push({ start: start, end: end, rule: r });
      }
    });

    // A term wins over a rule only when it fully covers the rule match. A term that is only
    // part of an email or URL credential is ignored, so the rule can hide the whole value.
    var keptTerms = [];
    termHits.forEach(function (t) {
      var keep = true;
      for (var i = 0; i < ruleHits.length; i++) {
        var h = ruleHits[i];
        if (overlaps(t, h) && !(t.start <= h.start && t.end >= h.end)) { keep = false; break; }
      }
      if (keep) keptTerms.push(t);
    });
    if (keptTerms.length) {
      ruleHits = ruleHits.filter(function (h) {
        for (var i = 0; i < keptTerms.length; i++) {
          var t = keptTerms[i];
          if (t.start <= h.start && t.end >= h.end) return false;
        }
        return true;
      });
    }

    var all = keptTerms.concat(ruleHits);
    all.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    var picked = [], last = 0;
    all.forEach(function (h) { if (h.start >= last) { picked.push(h); last = h.end; } });

    var counts = {}, out = '', pos = 0, seen = {}, mapping = {};
    picked.forEach(function (h) {
      var original = text.slice(h.start, h.end);
      var key = h.rule.id + '|' + original.toLowerCase();
      var k = seen[h.rule.id] || (seen[h.rule.id] = { n: 0, map: {} });
      if (!(key in k.map)) k.map[key] = ++k.n;
      var ph = '[' + h.rule.tag + '_' + k.map[key] + ']';
      counts[h.rule.id] = (counts[h.rule.id] || 0) + 1;
      if (!Object.prototype.hasOwnProperty.call(mapping, ph)) mapping[ph] = original;
      out += text.slice(pos, h.start) + ph;
      pos = h.end;
    });
    out += text.slice(pos);
    return { text: out, counts: counts, total: picked.length, mapping: mapping };
  }

  function restore(text, mapping) {
    text = String(text);
    var result = { text: text, restored: 0, unknown: [] };
    if (!mapping || typeof mapping !== 'object' || (Array.isArray && Array.isArray(mapping))) return result;
    // An empty mapping means no redaction happened in this session: leave the text alone and report nothing.
    var any = false;
    for (var k0 in mapping) { if (Object.prototype.hasOwnProperty.call(mapping, k0)) { any = true; break; } }
    if (!any) return result;

    var lookup = {};
    for (var k in mapping) {
      if (!Object.prototype.hasOwnProperty.call(mapping, k)) continue;
      var nk = normalizePlaceholderKey(k);
      if (nk && !Object.prototype.hasOwnProperty.call(lookup, nk)) lookup[nk] = mapping[k];
    }

    var unknownSeen = {};
    RESTORE_RE.lastIndex = 0;
    result.text = text.replace(RESTORE_RE, function (match, tag, num) {
      var ph = '[' + String(tag).toUpperCase() + '_' + num + ']';
      if (Object.prototype.hasOwnProperty.call(lookup, ph)) {
        result.restored++;
        return lookup[ph];
      }
      if (!Object.prototype.hasOwnProperty.call(unknownSeen, ph)) {
        unknownSeen[ph] = true;
        result.unknown.push(ph);
      }
      return match;
    });
    return result;
  }

  return { RULES: RULES, redact: redact, restore: restore, luhn: luhn, ibanOk: ibanOk, parseTerms: parseTerms };
});
