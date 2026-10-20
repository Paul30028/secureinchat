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

  function row(name, desc, status, label, lines, why) {
    var tr = document.createElement('tr'); tr.setAttribute('data-status', status);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = name;
    var d = document.createElement('span'); d.className = 'c-desc'; d.textContent = desc;
    th.appendChild(n); th.appendChild(d);
    var td = document.createElement('td'); td.setAttribute('data-label', 'Result');
    var vals = document.createElement('div'); vals.className = 'vals';
    lines.forEach(function (l) { var v = document.createElement('div'); v.className = 'val mono'; v.textContent = l; vals.appendChild(v); });
    td.appendChild(vals);
    var p = document.createElement('p'); p.className = 'why'; p.textContent = why || ''; td.appendChild(p);
    var ts = document.createElement('td'); ts.setAttribute('data-label', 'Status');
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
    if (!e) { strengthRow = null; paint(); summary.textContent = 'Type a password to see an estimate.'; summary.setAttribute('data-tone', 'idle'); return; }
    var status = ['fail', 'fail', 'warn', 'pass', 'pass'][e.level];
    strengthRow = row('Strength', 'An estimate from length, variety and simple patterns.', status, e.label,
      ['About ' + e.bits + ' bits of strength'], e.notes.join(' ') || 'Nothing obvious weakens it. Use it on one site only.');
    paint();
    summary.textContent = e.label + '. This is an estimate. Use the breach check too.';
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
    breachBtn.disabled = true; breachBtn.textContent = 'Checking...';
    sha1hex(pw).then(function (h) {
      return getRange(h.slice(0, 5), true).catch(function () { return getRange(h.slice(0, 5), false); }).then(function (text) { return P.parseRange(text, h.slice(5)); });
    }).then(function (count) {
      if (mine !== seq) return;
      breachRow = count > 0
        ? row('Known breaches', 'Whether this exact password is in a public breach list.', 'fail', 'Found', ['Seen ' + count.toLocaleString('en-US') + ' times in breach data'], 'Anyone trying common leaked passwords will try this one. Do not use it, and change it anywhere you have.')
        : row('Known breaches', 'Whether this exact password is in a public breach list.', 'pass', 'Not found', ['Not in the breach list'], 'That does not mean it is safe. The list only holds passwords from breaches that were published. A unique, long password matters more.');
      paint();
    }).catch(function () {
      if (mine !== seq) return;
      breachRow = row('Known breaches', 'Whether this exact password is in a public breach list.', 'na', 'Not checked', ['The breach service did not respond'], 'Nothing was concluded. Try again later.');
      paint();
    }).then(function () { breachBtn.textContent = 'Check known breaches'; breachBtn.disabled = !input.value; });
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
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.textContent).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }, function () {});
  });
  breachBtn.disabled = true;
  gen();
})();
