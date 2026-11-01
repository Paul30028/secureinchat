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
  // English strings are unchanged; the Chinese page (lang="zh-CN") uses the zh table and sitecheck-zh.js.
  var ZH = /^zh/i.test(document.documentElement.lang || '') && typeof window.SCZH === 'object';
  var S = ZH ? {
    LABEL: { pass: '正常', warn: '可改进', fail: '有问题', info: '提示' },
    counts: function (s) { return s.fail + ' 项有问题，' + s.warn + ' 项可改进'; }, ok: function (n) { return n + ' 项正常'; }, sep: '、', none: '没有发现问题',
    lang: 'zh-CN', title: '网站健康报告',
    gen: function (when) { return '生成于 ' + when + '，来自 secureinchat.com/zh/tools/site-health-check/。只检查首页，在一个地点观察。这不是安全审计。'; },
    th: ['网站', '有问题', '可改进', '正常'], th2: ['检查', '结果', '状态'],
    failed: '检查失败。', cannot: '检查无法运行。',
    needInput: '请输入网站地址，每行一个，最多 ' + MAX + ' 个。',
    done: function (n, extra) { return '完成：已检查 ' + n + ' 个网站。' + (extra ? '另有 ' + extra + ' 个被忽略；每次最多 ' + MAX + ' 个。' : ''); },
    progress: function (i, n) { return '正在检查第 ' + i + ' 个，共 ' + n + ' 个 ……'; },
    file: 'website-health-report-zh.html'
  } : {
    LABEL: { pass: 'OK', warn: 'Improve', fail: 'Problem', info: 'Note' },
    counts: function (s) { return s.fail + ' problem' + (s.fail === 1 ? '' : 's') + ', ' + s.warn + ' to improve'; }, ok: function (n) { return String(n) + ' OK'; }, sep: ', ', none: 'Nothing flagged',
    lang: 'en', title: 'Website health report',
    gen: function (when) { return 'Generated ' + when + ' with secureinchat.com/tools/site-health-check/. Home page only, observed from one location. This is not a security audit.'; },
    th: ['Site', 'Problems', 'To improve', 'OK'], th2: ['Check', 'Result', 'Status'],
    failed: 'The check failed.', cannot: 'The check could not run.',
    needInput: 'Enter up to ' + MAX + ' website addresses, one per line.',
    done: function (n, extra) { return 'Done: ' + n + ' site' + (n === 1 ? '' : 's') + ' checked.' + (extra ? ' ' + extra + ' more were ignored; the limit is ' + MAX + ' per run.' : ''); },
    progress: function (i, n) { return 'Checking ' + i + ' of ' + n + ' ...'; },
    file: 'website-health-report.html'
  };
  var tr8 = ZH ? window.SCZH : { row: function (c) { return c; }, error: function (s) { return s; } };
  var LABEL = S.LABEL;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function cell(tr, text, cls) { var td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td); return td; }

  function render() {
    tbody.textContent = '';
    results.forEach(function (r) {
      var tr = document.createElement('tr');
      var th = document.createElement('th'); th.scope = 'row'; th.className = 'mono'; th.textContent = r.input; tr.appendChild(th);
      if (r.error) { cell(tr, r.error); cell(tr, '-'); cell(tr, '-'); }
      else {
        var worst = r.data.checks.filter(function (c) { return c.status === 'fail'; }).concat(r.data.checks.filter(function (c) { return c.status === 'warn'; })).slice(0, 3).map(function (c) { return c.label; }).join(S.sep);
        cell(tr, S.counts(r.data.summary));
        cell(tr, S.ok(r.data.summary.pass)); cell(tr, worst || S.none);
      }
      tbody.appendChild(tr);
    });
  }

  function reportHtml() {
    var when = new Date().toISOString();
    var out = ['<!doctype html><html lang="' + S.lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + S.title + '</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.5rem}h2{font-size:1.15rem;margin-top:2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:6px 8px;text-align:left;vertical-align:top}.fail{background:#fde8e8}.warn{background:#fff4d6}.pass{background:#e6f5ea}.info{background:#e8f0fb}small{color:#555}</style></head><body>'];
    out.push('<h1>' + S.title + '</h1><p><small>' + esc(S.gen(when)) + '</small></p>');
    out.push('<table><thead><tr><th>' + S.th.join('</th><th>') + '</th></tr></thead><tbody>');
    results.forEach(function (r) { out.push('<tr><td>' + esc(r.input) + '</td>' + (r.error ? '<td colspan="3">' + esc(r.error) + '</td>' : '<td>' + r.data.summary.fail + '</td><td>' + r.data.summary.warn + '</td><td>' + r.data.summary.pass + '</td>') + '</tr>'); });
    out.push('</tbody></table>');
    results.forEach(function (r) {
      if (r.error) return;
      out.push('<h2>' + esc(r.data.target) + '</h2><table><thead><tr><th>' + S.th2.join('</th><th>') + '</th></tr></thead><tbody>');
      r.data.checks.forEach(function (c) { out.push('<tr class="' + esc(c.status) + '"><td>' + esc(c.label) + '</td><td>' + esc(c.value) + (c.status !== 'pass' && c.detail ? '<br><small>' + esc(c.detail) + '</small>' : '') + '</td><td>' + esc(LABEL[c.status] || c.status) + '</td></tr>'); });
      out.push('</tbody></table>');
    });
    out.push('</body></html>');
    return out.join('');
  }

  function one(input) {
    return fetch('/tools/api/site-check?url=' + encodeURIComponent(input), { cache: 'no-store' })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j, status: res.status }; }); })
      .then(function (x) {
        if (x.ok && ZH) x.j.checks = x.j.checks.map(tr8.row);
        return x.ok ? { input: input, data: x.j } : { input: input, error: (x.j && x.j.error && tr8.error(x.j.error)) || S.failed, limited: x.status === 429 };
      })
      .catch(function () { return { input: input, error: S.cannot }; });
  }

  go.addEventListener('click', function () {
    var seen = {}; var items = area.value.split(/[\s,;]+/).map(function (s) { return s.trim(); }).filter(function (s) { if (!s || seen[s.toLowerCase()]) return false; seen[s.toLowerCase()] = 1; return true; });
    if (!items.length) { status.textContent = S.needInput; return; }
    var extra = items.length > MAX ? items.length - MAX : 0; items = items.slice(0, MAX);
    results = []; render(); go.disabled = true; dl.disabled = true;
    var i = 0;
    (function next() {
      if (i >= items.length) {
        status.textContent = S.done(results.length, extra);
        go.disabled = false; dl.disabled = !results.some(function (r) { return !r.error; }); return;
      }
      status.textContent = S.progress(i + 1, items.length);
      one(items[i]).then(function (r) { results.push(r); render(); i++; setTimeout(next, 300); });
    })();
  });

  dl.addEventListener('click', function () {
    var blob = new Blob([reportHtml()], { type: 'text/html' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = S.file;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
})();
