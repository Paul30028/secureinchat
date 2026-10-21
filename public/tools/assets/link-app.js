/* Link checker page. Everything runs in this page; the link is never opened, sent or stored. */
(function () {
  'use strict';
  var L = window.LK;
  var input = document.getElementById('lk-in');
  var out = document.getElementById('lk-out');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');
  var site = document.getElementById('lk-site');
  var copyBtn = document.getElementById('lk-copy');
  var clearBtn = document.getElementById('lk-clear');
  var STATUS = { fail: 'Warning sign', warn: 'Check this', info: 'Note' };

  function row(f) {
    var lab = L.LABELS[f.id];
    var tr = document.createElement('tr'); tr.setAttribute('data-status', f.level);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = lab[0]; th.appendChild(n);
    var td = document.createElement('td'); td.setAttribute('data-label', 'Result');
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = f.detail; td.appendChild(v);
    var m = document.createElement('p'); m.className = 'why'; m.textContent = lab[1]; td.appendChild(m);
    var ts = document.createElement('td'); ts.setAttribute('data-label', 'Status');
    var p = document.createElement('span'); p.className = 'pill'; p.textContent = STATUS[f.level]; ts.appendChild(p);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function run() {
    var r = L.check(input.value);
    tbody.textContent = '';
    out.value = r.clean || '';
    copyBtn.disabled = !r.clean;
    site.textContent = r.site ? r.unicodeHost + (r.unicodeHost !== r.host ? '  (' + r.host + ')' : '') : '—';
    if (r.error) {
      var msg = { empty: 'Paste a link to check it.', invalid: 'This does not look like a web address.', script: 'This is a script link (' + r.scheme + ':), not a web page. Do not open it.', scheme: 'This is a ' + r.scheme + ' link, not a web page. The checks below only cover http and https links.' }[r.error];
      summary.textContent = msg; summary.setAttribute('data-tone', r.error === 'empty' ? 'idle' : (r.error === 'script' ? 'fail' : 'warn'));
      return;
    }
    r.findings.forEach(function (f) { tbody.appendChild(row(f)); });
    var fails = r.findings.filter(function (f) { return f.level === 'fail'; }).length;
    var warns = r.findings.filter(function (f) { return f.level === 'warn' && f.id !== 'tracking'; }).length;
    var tracking = r.removed.length;
    var parts = [];
    if (fails) parts.push(fails + ' warning sign' + (fails > 1 ? 's' : ''));
    if (warns) parts.push(warns + ' thing' + (warns > 1 ? 's' : '') + ' to check');
    if (tracking) parts.push(tracking + ' tracking parameter' + (tracking > 1 ? 's' : '') + ' removed');
    if (!parts.length) { summary.textContent = 'No warning signs found. That is not proof the link is safe; check that the site name is the one you expect.'; summary.setAttribute('data-tone', 'ok'); }
    else { summary.textContent = parts.join(', ') + '.'; summary.setAttribute('data-tone', fails ? 'fail' : 'warn'); }
  }

  input.addEventListener('input', run);
  clearBtn.addEventListener('click', function () { input.value = ''; run(); input.focus(); });
  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy clean link'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(done, function () { out.select(); });
    else out.select();
  });
  run();
})();
