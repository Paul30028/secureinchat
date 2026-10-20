/* Site health check page. Sends the address you type to this site's own /tools/api/site-check endpoint. Nothing is stored. */
(function () {
  'use strict';
  var form = document.getElementById('sc-form');
  var input = document.getElementById('sc-url');
  var go = document.getElementById('sc-go');
  var copyBtn = document.getElementById('sc-copy');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');
  var report = '';
  var LABEL = { pass: 'OK', warn: 'Improve', fail: 'Problem', info: 'Note' };

  function tone(t, msg) { summary.textContent = msg; summary.setAttribute('data-tone', t); }

  function row(c) {
    var tr = document.createElement('tr'); tr.setAttribute('data-status', c.status);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = c.label; th.appendChild(n);
    var td = document.createElement('td'); td.setAttribute('data-label', 'Result');
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = c.value; td.appendChild(v);
    if (c.detail) { var d = document.createElement('div'); d.className = 'why'; d.textContent = c.detail; td.appendChild(d); }
    var ts = document.createElement('td'); ts.setAttribute('data-label', 'Status');
    var p = document.createElement('span'); p.className = 'pill'; p.textContent = LABEL[c.status] || c.status; ts.appendChild(p);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function buildReport(r) {
    var lines = ['Website health check: ' + r.target, 'Checked: ' + r.checkedAt, 'Result: ' + r.summary.pass + ' OK, ' + r.summary.warn + ' to improve, ' + r.summary.fail + ' problems', ''];
    r.checks.forEach(function (c) { lines.push('[' + (LABEL[c.status] || c.status) + '] ' + c.label + ': ' + c.value + (c.status === 'pass' ? '' : '\n    ' + c.detail)); });
    lines.push('', 'Made with https://secureinchat.com/tools/site-health-check/ . Response time is measured from one location. Certificate expiry and page content beyond the home page are not checked.');
    return lines.join('\n');
  }

  function show(r) {
    tbody.textContent = '';
    r.checks.forEach(function (c) { tbody.appendChild(row(c)); });
    var s = r.summary;
    var t = s.fail ? 'fail' : s.warn ? 'warn' : 'ok';
    tone(t, r.target + ': ' + s.pass + ' OK, ' + s.warn + ' to improve, ' + s.fail + ' problem' + (s.fail === 1 ? '' : 's') + '.');
    report = buildReport(r);
    copyBtn.disabled = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v) { tone('warn', 'Enter a website address first.'); input.focus(); return; }
    go.disabled = true; copyBtn.disabled = true; tone('idle', 'Checking ' + v + ' ...');
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 40000);
    fetch('/tools/api/site-check?url=' + encodeURIComponent(v), { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (x) { if (!x.ok) { tone('fail', x.j && x.j.error ? x.j.error : 'The check failed.'); return; } show(x.j); })
      .catch(function () { tone('fail', 'The check could not run. Try again in a moment.'); })
      .then(function () { clearTimeout(timer); go.disabled = false; });
  });

  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy report as text'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(report).then(done, function () {});
  });
})();
