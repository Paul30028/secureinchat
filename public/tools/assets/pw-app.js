/* Password checker page. The password stays in this page: strength is computed locally. The breach check runs only on
   request and sends the first five characters of the password's SHA-1 hash, never the password or the full hash. */
(function () {
  'use strict';
  var P = window.PW;
  var input = document.getElementById('pw');
  var showBox = document.getElementById('show');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');
  var breachBtn = document.getElementById('breach');
  var seq = 0;
  // Interface strings follow the document language (as in exif-app.js and redact-app.js): the English page
  // keeps its old strings, the Chinese page (lang="zh-CN") gets Chinese ones. pw.js is shared and unchanged;
  // its English labels and notes are mapped here.
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  var T = ZH ? {
    check: '检查', result: '结果', status: '状态',
    idle: '输入密码查看估算。',
    strength: '强度', strengthDesc: '根据长度、字符种类和简单规律估算。',
    bits: function (b) { return '约 ' + b + ' 位强度'; },
    noNotes: '没有发现明显的弱点。只在一个网站上使用它。',
    summary: function (label) { return label + '。这只是估算，也请做泄露检查。'; },
    levels: ['非常弱', '弱', '一般', '强', '非常强'],
    notes: {
      'This is one of the most common passwords. Attackers try it first.': '这是最常见的密码之一，攻击者会最先尝试。',
      'A year is easy to guess.': '年份很容易被猜到。',
      'A capital word followed by digits is a very common pattern.': '大写开头的单词加数字是非常常见的写法。',
      'Repeated characters add little.': '重复的字符几乎不增加强度。',
      'Runs like abc or 123 add little.': 'abc、123 这类连续字符几乎不增加强度。',
      'Keyboard patterns like qwerty add little.': 'qwerty 这类键盘顺序几乎不增加强度。',
      'It contains a common word.': '里面有常见单词。',
      'Longer is the easiest way to make a password stronger.': '加长是让密码变强最简单的办法。',
      'Mixing in digits, capitals or symbols helps, but length helps more.': '混入数字、大写字母或符号有帮助，但加长帮助更大。',
    },
    breach: '已知泄露', breachDesc: '这个密码是否原样出现在公开的泄露列表里。',
    found: '已找到', seen: function (n) { return '在泄露数据中出现 ' + n.toLocaleString('zh-CN') + ' 次'; },
    foundWhy: '拿常见泄露密码去试的人一定会试这个。不要用它，用过它的地方都要改掉。',
    notFound: '未找到', notInList: '不在泄露列表里',
    notFoundWhy: '这不代表它安全。列表里只有已公开的泄露事件中的密码。每个网站用不同的长密码更重要。',
    notChecked: '未检查', noReply: '泄露查询服务没有响应',
    noReplyWhy: '没有得出任何结论。请稍后再试。',
    mark: '你检查了一个密码', checking: '检查中…', checkBtn: '检查已知泄露',
    copied: '已复制', copy: '复制',
  } : {
    check: 'Check', result: 'Result', status: 'Status',
    idle: 'Type a password to see an estimate.',
    strength: 'Strength', strengthDesc: 'An estimate from length, variety and simple patterns.',
    bits: function (b) { return 'About ' + b + ' bits of strength'; },
    noNotes: 'Nothing obvious weakens it. Use it on one site only.',
    summary: function (label) { return label + '. This is an estimate. Use the breach check too.'; },
    levels: null, notes: null,
    breach: 'Known breaches', breachDesc: 'Whether this exact password is in a public breach list.',
    found: 'Found', seen: function (n) { return 'Seen ' + n.toLocaleString('en-US') + ' times in breach data'; },
    foundWhy: 'Anyone trying common leaked passwords will try this one. Do not use it, and change it anywhere you have.',
    notFound: 'Not found', notInList: 'Not in the breach list',
    notFoundWhy: 'That does not mean it is safe. The list only holds passwords from breaches that were published. A unique, long password matters more.',
    notChecked: 'Not checked', noReply: 'The breach service did not respond',
    noReplyWhy: 'Nothing was concluded. Try again later.',
    mark: 'You checked a password', checking: 'Checking...', checkBtn: 'Check known breaches',
    copied: 'Copied', copy: 'Copy',
  };
  function note(n) { return T.notes && T.notes[n] ? T.notes[n] : n; }

  function row(name, desc, status, label, lines, why) {
    var tr = document.createElement('tr'); tr.setAttribute('data-status', status);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', T.check);
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = name;
    var d = document.createElement('span'); d.className = 'c-desc'; d.textContent = desc;
    th.appendChild(n); th.appendChild(d);
    var td = document.createElement('td'); td.setAttribute('data-label', T.result);
    var vals = document.createElement('div'); vals.className = 'vals';
    lines.forEach(function (l) { var v = document.createElement('div'); v.className = 'val mono'; v.textContent = l; vals.appendChild(v); });
    td.appendChild(vals);
    var p = document.createElement('p'); p.className = 'why'; p.textContent = why || ''; td.appendChild(p);
    var ts = document.createElement('td'); ts.setAttribute('data-label', T.status);
    var pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = label; ts.appendChild(pill);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  var strengthRow = null, breachRow = null;
  function paint() { tbody.textContent = ''; if (strengthRow) tbody.appendChild(strengthRow); if (breachRow) tbody.appendChild(breachRow); }

  function onInput() {
    seq++; breachRow = null;
    var e = P.estimate(input.value);
    breachBtn.disabled = !input.value;
    if (!e) { strengthRow = null; paint(); summary.textContent = T.idle; summary.setAttribute('data-tone', 'idle'); return; }
    var status = ['fail', 'fail', 'warn', 'pass', 'pass'][e.level];
    var label = T.levels ? T.levels[e.level] : e.label;
    strengthRow = row(T.strength, T.strengthDesc, status, label,
      [T.bits(e.bits)], e.notes.map(note).join(ZH ? '' : ' ') || T.noNotes);
    paint();
    summary.textContent = T.summary(label);
    summary.setAttribute('data-tone', status === 'pass' ? 'ok' : status === 'warn' ? 'warn' : 'fail');
  }

  function sha1hex(str) {
    return crypto.subtle.digest('SHA-1', new TextEncoder().encode(str)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase();
    });
  }

  function getRange(prefix, padded) {
    var ac = new AbortController(); var timer = setTimeout(function () { ac.abort(); }, 8000);
    var opts = { signal: ac.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' };
    if (padded) opts.headers = { 'Add-Padding': 'true' };
    return fetch('https://api.pwnedpasswords.com/range/' + prefix, opts).then(function (r) {
      clearTimeout(timer); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text();
    }, function (e) { clearTimeout(timer); throw e; });
  }

  function checkBreach() {
    var pw = input.value; if (!pw) return;
    var mine = ++seq;
    document.dispatchEvent(new CustomEvent('netlog:mark', { detail: { label: T.mark } })); breachBtn.disabled = true; breachBtn.textContent = T.checking;
    sha1hex(pw).then(function (h) {
      return getRange(h.slice(0, 5), true).catch(function () { return getRange(h.slice(0, 5), false); }).then(function (text) { return P.parseRange(text, h.slice(5)); });
    }).then(function (count) {
      if (mine !== seq) return;
      breachRow = count > 0
        ? row(T.breach, T.breachDesc, 'fail', T.found, [T.seen(count)], T.foundWhy)
        : row(T.breach, T.breachDesc, 'pass', T.notFound, [T.notInList], T.notFoundWhy);
      paint();
    }).catch(function () {
      if (mine !== seq) return;
      breachRow = row(T.breach, T.breachDesc, 'na', T.notChecked, [T.noReply], T.noReplyWhy);
      paint();
    }).then(function () { breachBtn.textContent = T.checkBtn; breachBtn.disabled = !input.value; });
  }

  input.addEventListener('input', onInput);
  showBox.addEventListener('change', function () { input.type = showBox.checked ? 'text' : 'password'; });
  breachBtn.addEventListener('click', checkBreach);

  // generator
  var out = document.getElementById('gen-out'), len = document.getElementById('gen-len'), lenVal = document.getElementById('gen-len-val');
  function gen() {
    out.textContent = P.generate(+len.value, { lower: document.getElementById('g-lower').checked, upper: document.getElementById('g-upper').checked, digits: document.getElementById('g-digits').checked, symbols: document.getElementById('g-symbols').checked });
    lenVal.textContent = len.value;
  }
  document.getElementById('gen-new').addEventListener('click', gen);
  len.addEventListener('input', gen);
  ['g-lower', 'g-upper', 'g-digits', 'g-symbols'].forEach(function (id) { document.getElementById(id).addEventListener('change', gen); });
  document.getElementById('gen-copy').addEventListener('click', function () {
    var b = this;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.textContent).then(function () { b.textContent = T.copied; setTimeout(function () { b.textContent = T.copy; }, 1500); }, function () {});
  });
  breachBtn.disabled = true;
  gen();
})();
