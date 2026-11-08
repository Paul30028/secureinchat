/* Local text pattern review for the private workspace.
   Pure functions: no DOM, no network, no storage. Loaded by the page and by the Node tests.
   These rules match common formats only. They are not semantic review and can miss context. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WSText = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMIT = 200000;

  var CN_ID_W = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  var CN_ID_C = '10X98765432';

  function digits(value) { return String(value).replace(/\D/g, ''); }

  function luhn(value) {
    var s = digits(value);
    if (!s) return false;
    var sum = 0, alt = false;
    for (var i = s.length - 1; i >= 0; i--) {
      var n = s.charCodeAt(i) - 48;
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }

  // GB 11643-1999 resident ID: 17 digits plus an ISO 7064 MOD 11-2 check character.
  function cnIdOk(value) {
    var v = String(value).toUpperCase();
    if (!/^\d{17}[\dX]$/.test(v)) return false;
    var y = +v.slice(6, 10), mo = +v.slice(10, 12), d = +v.slice(12, 14);
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false;
    var sum = 0;
    for (var i = 0; i < 17; i++) sum += (v.charCodeAt(i) - 48) * CN_ID_W[i];
    return CN_ID_C.charAt(sum % 11) === v.charAt(17);
  }

  function ipv4Ok(value) {
    var parts = String(value).split('.');
    if (parts.length !== 4) return false;
    for (var i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return false;
      var n = +parts[i];
      if (n < 0 || n > 255) return false;
      if (parts[i].length > 1 && parts[i].charAt(0) === '0') return false;
    }
    return true;
  }

  function phoneOk(value) {
    var d = digits(value);
    if (d.length < 7 || d.length > 15) return false;
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(value)) return false; // date
    if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(value)) return false; // date
    if (/^\d{1,2}:\d{2}/.test(value)) return false; // time
    return true;
  }

  function cnMobileOk(value) {
    var d = digits(value);
    return /^(?:0086|86)?1[3-9]\d{9}$/.test(d);
  }

  function cardOk(value) {
    var d = digits(value);
    if (d.length < 13 || d.length > 19 || !luhn(d)) return false;
    // A card number is written as one run of digits or as 2-5 groups of 3-6 digits.
    // This stops a chain of unrelated numbers (for example three SSNs separated by spaces)
    // from being read as one card number.
    var groups = value.split(/[ -]+/);
    if (groups.length > 1) {
      if (groups.length > 5) return false;
      for (var i = 0; i < groups.length; i++) {
        if (!/^\d{3,6}$/.test(groups[i])) return false;
      }
      var separators = value.match(/[ -]/g) || [];
      for (var j = 1; j < separators.length; j++) {
        if (separators[j] !== separators[0]) return false;
      }
    }
    return true;
  }

  // Card numbers are written as one run of digits or 2-5 groups of 3-6 digits. The regex alone
  // cannot tell "card + a following number" from a longer number, so try the longest valid prefix.
  function findCards(text) {
    var re = /(?<!\d)\d(?:[ -]?\d){11,18}(?!\d)/g;
    var out = [], match;
    while ((match = re.exec(text))) {
      var raw = match[0];
      // If the match stopped in the middle of a longer digit run, do not read a card prefix out of it.
      if (/^[ -]\d{4}/.test(text.slice(match.index + raw.length))) continue;
      var groups = raw.split(/[ -]+/);
      if (groups.length === 1) {
        if (cardOk(raw)) out.push({ start: match.index, end: match.index + raw.length, value: raw });
        continue;
      }
      var separators = raw.match(/[ -]/g) || [];
      var mixed = false;
      for (var s = 1; s < separators.length; s++) {
        if (separators[s] !== separators[0]) { mixed = true; break; }
      }
      if (mixed) continue;
      for (var keep = groups.length; keep >= 2; keep--) {
        var dropped = groups.slice(keep);
        if (digits(dropped.join('')).length > 3) break;
        var candidate = groups.slice(0, keep).join(separators[0]);
        if (candidate.length > raw.length) continue;
        if (cardOk(candidate)) {
          out.push({ start: match.index, end: match.index + candidate.length, value: candidate });
          re.lastIndex = match.index + candidate.length;
          break;
        }
      }
    }
    return out;
  }

  var RULES = [
    {
      id: 'key',
      label: 'Access keys and tokens',
      short: 'Access keys',
      placeholder: 'KEY',
      patterns: [
        /\bsk-[A-Za-z0-9_-]{16,}\b/g,
        /\bAKIA[0-9A-Z]{16}\b/g,
        /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
        /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
        /\bAIza[0-9A-Za-z_-]{35}\b/g,
        /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
        /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
      ]
    },
    {
      id: 'email',
      label: 'Email addresses',
      short: 'Email',
      placeholder: 'EMAIL',
      patterns: [/(?<![A-Z0-9._%+-])[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi]
    },
    {
      id: 'id',
      label: 'Government ID formats',
      short: 'Government ID',
      placeholder: 'ID',
      patterns: [
        /(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g,
        /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g
      ],
      validate: function (value) {
        if (/^\d{3}-\d{2}-\d{4}$/.test(value)) {
          // Keep the SSN format check deliberately narrow: no 000/666/9xx area, no 00 group, no 0000 serial.
          var p = value.split('-');
          return p[0] !== '000' && p[0] !== '666' && p[0].charAt(0) !== '9' && p[1] !== '00' && p[2] !== '0000';
        }
        return cnIdOk(value);
      }
    },
    {
      id: 'card',
      label: 'Payment card numbers',
      short: 'Card',
      placeholder: 'CARD',
      find: findCards
    },
    {
      id: 'phone',
      label: 'Phone-like numbers',
      short: 'Phone',
      placeholder: 'PHONE',
      patterns: [
        /(?<!\d)(?:\+?86|0086)[\s-]?1[3-9]\d(?:[\s-]?\d{4}){2}(?!\d)/g,
        /(?<!\d)1[3-9]\d(?:[\s-]?\d{4}){2}(?!\d)/g,
        /\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?)(?:[\s.-]?\d{2,4}){2,4}(?!\d)/g,
        /(?<!\d)\(\d{2,4}\)[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\d)/g,
        /(?<!\d)\d{3}[-.]\d{3}[-.]\d{4}(?!\d)/g
      ],
      validate: phoneOk
    },
    {
      id: 'ipv4',
      label: 'IPv4 addresses',
      short: 'IPv4',
      placeholder: 'IP',
      patterns: [/(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g],
      validate: ipv4Ok
    }
  ];

  var BY_ID = {};
  for (var r = 0; r < RULES.length; r++) BY_ID[RULES[r].id] = RULES[r];

  // Placeholder names for items the user confirmed from the optional local AI. Labels are
  // the model's own English labels; anything unknown is replaced as a generic AI item.
  var AI_PLACEHOLDERS = {
    'person': 'PERSON',
    'street address': 'ADDRESS',
    'city': 'CITY',
    'organization': 'ORG',
    'date of birth': 'DOB',
    'bank account number': 'BANK',
    'passport number': 'PASSPORT',
    'username': 'USERNAME'
  };

  function overlaps(list, start, end) {
    for (var i = 0; i < list.length; i++) {
      if (start < list[i][1] && end > list[i][0]) return true;
    }
    return false;
  }

  function cloneRule(rule) {
    return { id: rule.id, label: rule.label, short: rule.short, placeholder: rule.placeholder };
  }

  function collect(text) {
    var claimed = [], found = [];
    for (var i = 0; i < RULES.length; i++) {
      var rule = RULES[i], seen = [];
      if (rule.find) {
        var custom = rule.find(text);
        for (var c = 0; c < custom.length; c++) {
          var cm = custom[c];
          if (overlaps(claimed, cm.start, cm.end) || overlaps(seen, cm.start, cm.end)) continue;
          seen.push([cm.start, cm.end]);
          found.push({ rule: rule.id, start: cm.start, end: cm.end, value: cm.value });
        }
        claimed = claimed.concat(seen);
        continue;
      }
      for (var p = 0; p < rule.patterns.length; p++) {
        var source = rule.patterns[p].source;
        var flags = rule.patterns[p].flags;
        var re = new RegExp(source, flags.indexOf('g') >= 0 ? flags : flags + 'g');
        var match;
        while ((match = re.exec(text))) {
          if (!match[0]) { re.lastIndex++; continue; }
          var start = match.index, end = start + match[0].length;
          if (overlaps(claimed, start, end) || overlaps(seen, start, end)) continue;
          if (rule.validate && !rule.validate(match[0])) continue;
          seen.push([start, end]);
          found.push({ rule: rule.id, start: start, end: end, value: match[0] });
        }
      }
      claimed = claimed.concat(seen);
    }
    found.sort(function (a, b) { return a.start - b.start; });
    return found;
  }

  function normalizeEnabled(enabled) {
    if (enabled === undefined || enabled === null) return new Set(RULES.map(function (x) { return x.id; }));
    if (enabled instanceof Set) return new Set(enabled);
    if (Object.prototype.toString.call(enabled) === '[object Array]') return new Set(enabled);
    if (typeof enabled === 'object') {
      return new Set(Object.keys(enabled).filter(function (k) { return !!enabled[k]; }));
    }
    return new Set();
  }

  // Accepts only confirmed AI suggestions with exact span boundaries. Anything malformed,
  // empty or overlapping a rule match is ignored, so a caller cannot inject a replacement.
  function normalizeExtra(extra, text, matches) {
    if (Object.prototype.toString.call(extra) !== '[object Array]') return [];
    var out = [], i, j;
    for (i = 0; i < extra.length; i++) {
      var item = extra[i];
      if (!item || typeof item !== 'object') continue;
      var start = Number(item.start), end = Number(item.end);
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
      if (start < 0 || end <= start || end > text.length) continue;
      var value = text.slice(start, end);
      if (!value) continue;
      var label = typeof item.label === 'string' ? item.label : '';
      var clash = false;
      for (j = 0; j < matches.length; j++) {
        if (start < matches[j].end && end > matches[j].start) { clash = true; break; }
      }
      if (!clash) {
        for (j = 0; j < out.length; j++) {
          if (start < out[j].end && end > out[j].start) { clash = true; break; }
        }
      }
      if (clash) continue;
      out.push({ ai: true, label: label, start: start, end: end, value: value });
    }
    return out;
  }

  function categoryRows(matches, selected) {
    var rows = [];
    for (var i = 0; i < RULES.length; i++) {
      var id = RULES[i].id, count = 0, replaced = 0;
      for (var j = 0; j < matches.length; j++) {
        if (matches[j].rule !== id) continue;
        count++;
        if (selected.has(id)) replaced++;
      }
      rows.push({ id: id, label: RULES[i].label, short: RULES[i].short, count: count, replaced: replaced });
    }
    return rows;
  }

  function analyze(text) {
    var s = text === undefined || text === null ? '' : String(text);
    if (s.length > LIMIT) {
      return { ok: false, error: 'too-long', limit: LIMIT, length: s.length, total: 0, categories: [] };
    }
    var matches = collect(s);
    return { ok: true, total: matches.length, length: s.length, categories: categoryRows(matches, new Set(RULES.map(function (x) { return x.id; }))) };
  }

  function redact(text, enabled, extra) {
    var s = text === undefined || text === null ? '' : String(text);
    var selected = normalizeEnabled(enabled);
    if (s.length > LIMIT) {
      return { ok: false, error: 'too-long', limit: LIMIT, length: s.length, text: s, total: 0, changed: 0, categories: [], aiReplaced: 0 };
    }
    var matches = collect(s);
    var items = matches.map(function (m) {
      return { ai: false, rule: m.rule, start: m.start, end: m.end, value: m.value };
    }).concat(normalizeExtra(extra, s, matches));
    items.sort(function (a, b) { return a.start - b.start; });
    var counters = {}, aiCounters = {}, values = {}, out = '', cursor = 0, replaced = 0, aiReplaced = 0;
    for (var i = 0; i < items.length; i++) {
      var m = items[i];
      if (m.start < cursor) continue;
      out += s.slice(cursor, m.start);
      if (m.ai) {
        var aiKey = m.label + '\u0000' + m.value;
        if (!Object.prototype.hasOwnProperty.call(values, 'ai\u0000' + aiKey)) {
          var tag = AI_PLACEHOLDERS[m.label] || 'AI';
          aiCounters[tag] = (aiCounters[tag] || 0) + 1;
          values['ai\u0000' + aiKey] = '[' + tag + '_' + aiCounters[tag] + ']';
        }
        out += values['ai\u0000' + aiKey];
        replaced++;
        aiReplaced++;
      } else if (selected.has(m.rule)) {
        var key = m.rule + '\u0000' + m.value;
        if (!Object.prototype.hasOwnProperty.call(values, key)) {
          counters[m.rule] = (counters[m.rule] || 0) + 1;
          values[key] = '[' + BY_ID[m.rule].placeholder + '_' + counters[m.rule] + ']';
        }
        out += values[key];
        replaced++;
      } else {
        out += m.value;
      }
      cursor = m.end;
    }
    out += s.slice(cursor);
    return {
      ok: true,
      text: out,
      total: replaced,
      detected: matches.length,
      changed: replaced,
      aiReplaced: aiReplaced,
      categories: categoryRows(matches, selected)
    };
  }

  // Rule match spans only. Used to keep the optional AI suggestions from repeating a rule match.
  function locate(text) {
    var s = text === undefined || text === null ? '' : String(text);
    if (s.length > LIMIT) return [];
    return collect(s).map(function (m) {
      return { start: m.start, end: m.end, value: m.value, rule: m.rule };
    });
  }

  return {
    LIMIT: LIMIT,
    RULES: RULES.map(cloneRule),
    analyze: analyze,
    redact: redact,
    locate: locate,
    luhn: luhn,
    cnIdOk: cnIdOk,
    ipv4Ok: ipv4Ok
  };
});
