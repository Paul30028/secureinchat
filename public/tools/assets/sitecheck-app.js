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
  // The English page keeps the strings below unchanged. The Chinese page (lang="zh-CN") also loads
  // sitecheck-zh.js, which turns the endpoint's English rows and errors into Chinese.
  var ZH = /^zh/i.test(document.documentElement.lang || '') && typeof window.SCZH === 'object';
  var tr8 = ZH ? window.SCZH : { row: function (c) { return c; }, error: function (s) { return s; } };
  var S = ZH ? {
    LABEL: { pass: '正常', warn: '可改进', fail: '有问题', info: '提示' },
    check: '检查', result: '结果', status: '状态',
    head: function (r) { return ['网站健康检查：' + r.target, '检查时间：' + r.checkedAt, '结果：' + r.summary.pass + ' 项正常，' + r.summary.warn + ' 项可改进，' + r.summary.fail + ' 项有问题', '']; },
    foot: '由 https://secureinchat.com/zh/tools/site-health-check/ 生成。响应时间只在一个地点测量。不检查证书到期时间，也不检查首页以外的页面。',
    sum: function (r, s) { return r.target + '：' + s.pass + ' 项正常，' + s.warn + ' 项可改进，' + s.fail + ' 项有问题。'; },
    empty: '请先输入网站地址。', checking: function (v) { return '正在检查 ' + v + ' ……'; },
    failed: '检查失败。', cannot: '检查无法运行，请稍后再试。', copied: '已复制', copy: '复制文字报告'
  } : {
    LABEL: { pass: 'OK', warn: 'Improve', fail: 'Problem', info: 'Note' },
    check: 'Check', result: 'Result', status: 'Status',
    head: function (r) { return ['Website health check: ' + r.target, 'Checked: ' + r.checkedAt, 'Result: ' + r.summary.pass + ' OK, ' + r.summary.warn + ' to improve, ' + r.summary.fail + ' problems', '']; },
    foot: 'Made with https://secureinchat.com/tools/site-health-check/ . Response time is measured from one location. Certificate expiry and page content beyond the home page are not checked.',
    sum: function (r, s) { return r.target + ': ' + s.pass + ' OK, ' + s.warn + ' to improve, ' + s.fail + ' problem' + (s.fail === 1 ? '' : 's') + '.'; },
    empty: 'Enter a website address first.', checking: function (v) { return 'Checking ' + v + ' ...'; },
    failed: 'The check failed.', cannot: 'The check could not run. Try again in a moment.', copied: 'Copied', copy: 'Copy report as text'
  };
  var LABEL = S.LABEL;

  function tone(t, msg) { summary.textContent = msg; summary.setAttribute('data-tone', t); }

  function row(c) {
    var tr = document.createElement('tr'); tr.setAttribute('data-status', c.status);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', S.check);
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = c.label; th.appendChild(n);
    var td = document.createElement('td'); td.setAttribute('data-label', S.result);
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = c.value; td.appendChild(v);
    if (c.detail) { var d = document.createElement('div'); d.className = 'why'; d.textContent = c.detail; td.appendChild(d); }
    var ts = document.createElement('td'); ts.setAttribute('data-label', S.status);
    var p = document.createElement('span'); p.className = 'pill'; p.textContent = LABEL[c.status] || c.status; ts.appendChild(p);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function buildReport(r) {
    var lines = S.head(r);
    r.checks.forEach(function (c) { lines.push('[' + (LABEL[c.status] || c.status) + '] ' + c.label + (ZH ? '：' : ': ') + c.value + (c.status === 'pass' ? '' : '\n    ' + c.detail)); });
    lines.push('', S.foot);
    return lines.join('\n');
  }

  function show(r) {
    if (ZH) r.checks = r.checks.map(tr8.row);
    tbody.textContent = '';
    r.checks.forEach(function (c) { tbody.appendChild(row(c)); });
    var s = r.summary;
    var t = s.fail ? 'fail' : s.warn ? 'warn' : 'ok';
    tone(t, S.sum(r, s));
    report = buildReport(r);
    copyBtn.disabled = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value.trim();
    if (!v) { tone('warn', S.empty); input.focus(); return; }
    go.disabled = true; copyBtn.disabled = true; tone('idle', S.checking(v));
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 40000);
    fetch('/tools/api/site-check?url=' + encodeURIComponent(v), { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (x) { if (!x.ok) { tone('fail', x.j && x.j.error ? tr8.error(x.j.error) : S.failed); return; } show(x.j); })
      .catch(function () { tone('fail', S.cannot); })
      .then(function () { clearTimeout(timer); go.disabled = false; });
  });

  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = S.copied; setTimeout(function () { copyBtn.textContent = S.copy; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(report).then(done, function () {});
  });
})();
