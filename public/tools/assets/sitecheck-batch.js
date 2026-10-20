/* Multi-site report for the site health check. Runs the single-site endpoint one address at a time, in this page. The report file is built in your browser. */
(function () {
  'use strict';
  var area = document.getElementById('sb-list');
  var go = document.getElementById('sb-go');
  var dl = document.getElementById('sb-dl');
  var tbody = document.getElementById('sb-rows');
  var status = document.getElementById('sb-status');
  var MAX = 10;
  var results = [];
  var LABEL = { pass: 'OK', warn: 'Improve', fail: 'Problem', info: 'Note' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cell(tr, text, cls) { var td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td); return td; }

  function render() {
    tbody.textContent = '';
    results.forEach(function (r) {
      var tr = document.createElement('tr');
      var th = document.createElement('th'); th.scope = 'row'; th.className = 'mono'; th.textContent = r.input; tr.appendChild(th);
      if (r.error) { cell(tr, r.error); cell(tr, '-'); cell(tr, '-'); }
      else {
        var worst = r.data.checks.filter(function (c) { return c.status === 'fail'; }).concat(r.data.checks.filter(function (c) { return c.status === 'warn'; })).slice(0, 3).map(function (c) { return c.label; }).join(', ');
        cell(tr, r.data.summary.fail + ' problem' + (r.data.summary.fail === 1 ? '' : 's') + ', ' + r.data.summary.warn + ' to improve');
        cell(tr, String(r.data.summary.pass) + ' OK'); cell(tr, worst || 'Nothing flagged');
      }
      tbody.appendChild(tr);
    });
  }

  function reportHtml() {
    var when = new Date().toISOString();
    var out = ['<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Website health report</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.5rem}h2{font-size:1.15rem;margin-top:2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top}.fail{background:#fde8e8}.warn{background:#fff4d6}.pass{background:#e6f5ea}.info{background:#e8f0fb}small{color:#555}</style></head><body>'];
    out.push('<h1>Website health report</h1><p><small>Generated ' + esc(when) + ' with secureinchat.com/tools/site-health-check/. Home page only, observed from one location. This is not a security audit.</small></p>');
    out.push('<table><thead><tr><th>Site</th><th>Problems</th><th>To improve</th><th>OK</th></tr></thead><tbody>');
    results.forEach(function (r) { out.push('<tr><td>' + esc(r.input) + '</td>' + (r.error ? '<td colspan="3">' + esc(r.error) + '</td>' : '<td>' + r.data.summary.fail + '</td><td>' + r.data.summary.warn + '</td><td>' + r.data.summary.pass + '</td>') + '</tr>'); });
    out.push('</tbody></table>');
    results.forEach(function (r) {
      if (r.error) return;
      out.push('<h2>' + esc(r.data.target) + '</h2><table><thead><tr><th>Check</th><th>Result</th><th>Status</th></tr></thead><tbody>');
      r.data.checks.forEach(function (c) { out.push('<tr class="' + esc(c.status) + '"><td>' + esc(c.label) + '</td><td>' + esc(c.value) + (c.status !== 'pass' && c.detail ? '<br><small>' + esc(c.detail) + '</small>' : '') + '</td><td>' + esc(LABEL[c.status] || c.status) + '</td></tr>'); });
      out.push('</tbody></table>');
    });
    out.push('</body></html>');
    return out.join('');
  }

  function one(input) {
    return fetch('/tools/api/site-check?url=' + encodeURIComponent(input), { cache: 'no-store' })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j, status: res.status }; }); })
      .then(function (x) { return x.ok ? { input: input, data: x.j } : { input: input, error: (x.j && x.j.error) || 'The check failed.', limited: x.status === 429 }; })
      .catch(function () { return { input: input, error: 'The check could not run.' }; });
  }

  go.addEventListener('click', function () {
    var seen = {}; var items = area.value.split(/[\s,;]+/).map(function (s) { return s.trim(); }).filter(function (s) { if (!s || seen[s.toLowerCase()]) return false; seen[s.toLowerCase()] = 1; return true; });
    if (!items.length) { status.textContent = 'Enter up to ' + MAX + ' website addresses, one per line.'; return; }
    var extra = items.length > MAX ? items.length - MAX : 0; items = items.slice(0, MAX);
    results = []; render(); go.disabled = true; dl.disabled = true;
    var i = 0;
    (function next() {
      if (i >= items.length) {
        status.textContent = 'Done: ' + results.length + ' site' + (results.length === 1 ? '' : 's') + ' checked.' + (extra ? ' ' + extra + ' more were ignored; the limit is ' + MAX + ' per run.' : '');
        go.disabled = false; dl.disabled = !results.some(function (r) { return !r.error; }); return;
      }
      status.textContent = 'Checking ' + (i + 1) + ' of ' + items.length + ' ...';
      one(items[i]).then(function (r) { results.push(r); render(); i++; setTimeout(next, 300); });
    })();
  });

  dl.addEventListener('click', function () {
    var blob = new Blob([reportHtml()], { type: 'text/html' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'website-health-report.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
})();
