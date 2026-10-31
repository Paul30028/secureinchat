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
  // Interface strings follow the document language (as account-app.js, pw-app.js): the English page keeps the
  // strings below and link.js LABELS unchanged; the Chinese page (lang="zh-CN") gets Chinese ones. link.js is
  // shared and unchanged; the checks and their levels come from it, only the words are swapped here.
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  var STATUS = ZH ? { fail: '危险迹象', warn: '需要核对', info: '提示' } : { fail: 'Warning sign', warn: 'Check this', info: 'Note' };
  var COL = ZH ? ['检查项', '结果', '状态'] : ['Check', 'Result', 'Status'];
  var COPY = ZH ? ['复制干净链接', '已复制'] : ['Copy clean link', 'Copied'];
  var ZH_LABELS = {
    tracking: ['追踪参数', '它们告诉发送者或广告网络你点了这个链接。去掉它们不会改变链接打开的地方。'],
    userinfo: ['网址里 @ 前面有文字', '浏览器会忽略 @ 前面的所有内容。像 paypal.com@example.net 这样的链接，实际打开的是 example.net。这是一种老套路。'],
    ip: ['用 IP 地址代替网站名', '正规服务很少发送直接指向 IP 地址的链接。'],
    punycode: ['网站名里有其他文字的字符', '其他字母表里的字母可以冒充熟悉的名字。请和真实网址逐个字符对照。'],
    http: ['未加密（http）', '你在这个网页上发送的内容可能在传输途中被读取或修改。'],
    port: ['不常见的端口', '普通网站使用默认端口。公开网站很少在网址里写明端口。'],
    shortener: ['短链接', '真实的目标网址被隐藏了。请向发送者要完整链接，或者只在你信任对方时才打开。'],
    brand: ['知名品牌名出现在别人的网站上', '链接里出现了一家知名公司的名字，但实际打开的是别人的网站。'],
    subdomains: ['子域名很多', '一长串名字可能把真正的网站名挤出手机屏幕。'],
    redirect: ['藏着第二个目标网址', '链接里带着另一个网址，可能会把你转到那里。'],
    long: ['链接很长', '很长的链接可能藏住真正的网站名。单凭这一点不算危险迹象。'],
  };
  function label(id) { return ZH ? ZH_LABELS[id] : L.LABELS[id]; }
  // link.js writes three details as English sentences; the Chinese page rewrites only those three.
  function detail(f) {
    if (!ZH) return f.detail;
    var m;
    if (f.id === 'brand' && (m = /^(.*) appears, but the site is (.*)$/.exec(f.detail))) return '出现了 ' + m[1] + '，但打开的网站是 ' + m[2];
    if (f.id === 'subdomains' && (m = /^(\d+) parts: (.*)$/.exec(f.detail))) return m[1] + ' 段：' + m[2];
    if (f.id === 'long' && (m = /^(\d+) characters$/.exec(f.detail))) return m[1] + ' 个字符';
    return f.detail;
  }
  function errorText(r) {
    if (ZH) return { empty: '粘贴一个链接来检查。', invalid: '这看起来不像网址。', script: '这是一个脚本链接（' + r.scheme + ':），不是网页。不要打开它。', scheme: '这是一个 ' + r.scheme + ' 链接，不是网页。下面的检查只适用于 http 和 https 链接。' }[r.error];
    return { empty: 'Paste a link to check it.', invalid: 'This does not look like a web address.', script: 'This is a script link (' + r.scheme + ':), not a web page. Do not open it.', scheme: 'This is a ' + r.scheme + ' link, not a web page. The checks below only cover http and https links.' }[r.error];
  }
  function summaryText(fails, warns, tracking) {
    var parts = [];
    if (ZH) {
      if (fails) parts.push(fails + ' 个危险迹象');
      if (warns) parts.push(warns + ' 处需要核对');
      if (tracking) parts.push('已去掉 ' + tracking + ' 个追踪参数');
      return parts.length ? parts.join('，') + '。' : '';
    }
    if (fails) parts.push(fails + ' warning sign' + (fails > 1 ? 's' : ''));
    if (warns) parts.push(warns + ' thing' + (warns > 1 ? 's' : '') + ' to check');
    if (tracking) parts.push(tracking + ' tracking parameter' + (tracking > 1 ? 's' : '') + ' removed');
    return parts.length ? parts.join(', ') + '.' : '';
  }
  var NONE = ZH ? '没有发现危险迹象。这不能证明链接安全；请核对网站名是否正是你预期的那个。' : 'No warning signs found. That is not proof the link is safe; check that the site name is the one you expect.';

  function row(f) {
    var lab = label(f.id);
    var tr = document.createElement('tr'); tr.setAttribute('data-status', f.level);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', COL[0]);
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = lab[0]; th.appendChild(n);
    var td = document.createElement('td'); td.setAttribute('data-label', COL[1]);
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = detail(f); td.appendChild(v);
    var m = document.createElement('p'); m.className = 'why'; m.textContent = lab[1]; td.appendChild(m);
    var ts = document.createElement('td'); ts.setAttribute('data-label', COL[2]);
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
      var msg = errorText(r);
      summary.textContent = msg; summary.setAttribute('data-tone', r.error === 'empty' ? 'idle' : (r.error === 'script' ? 'fail' : 'warn'));
      return;
    }
    r.findings.forEach(function (f) { tbody.appendChild(row(f)); });
    var fails = r.findings.filter(function (f) { return f.level === 'fail'; }).length;
    var warns = r.findings.filter(function (f) { return f.level === 'warn' && f.id !== 'tracking'; }).length;
    var tracking = r.removed.length;
    var text = summaryText(fails, warns, tracking);
    if (!text) { summary.textContent = NONE; summary.setAttribute('data-tone', 'ok'); }
    else { summary.textContent = text; summary.setAttribute('data-tone', fails ? 'fail' : 'warn'); }
  }

  input.addEventListener('input', run);
  clearBtn.addEventListener('click', function () { input.value = ''; run(); input.focus(); });
  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = COPY[1]; setTimeout(function () { copyBtn.textContent = COPY[0]; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(done, function () { out.select(); });
    else out.select();
  });
  run();
  window.LINK_CHECKER = { run: run, detail: detail, label: label };
})();
