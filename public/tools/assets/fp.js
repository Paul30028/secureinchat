/* Browser fingerprint test: renders the checks from fpcore.js. Nothing is sent anywhere or stored. */
(function () {
  'use strict';
  var btn = document.getElementById('run');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');

  // Interface strings follow the document language (same pattern as exif-app.js and link-app.js):
  // the English page keeps the strings below unchanged; the Chinese page (lang="zh-CN") gets Chinese
  // ones. fpcore.js decides which checks run and what values they read; only the words are swapped here.
  var ZH = /^zh/i.test(document.documentElement.lang || '');

  var T = ZH ? {
    testing: '检查中…',
    runAgain: '再运行一次',
    summary1: function (n, total) { return total + ' 项里有 ' + n + ' 项会让网站多一个识别你的依据。'; },
    summary2: '这里没有让你比平时更容易被认出来的项目。',
    fail: '测试没能完成。',
    check: '检查', result: '结果', status: '状态',
    mark: '你运行了特征检查'
  } : {
    testing: 'Testing...',
    runAgain: 'Run again',
    summary1: function (n, total) { return n + ' of ' + total + ' checks give sites something to recognise you by.'; },
    summary2: 'Nothing here makes you easier to recognise than usual.',
    fail: 'The test could not finish.',
    check: 'Check', result: 'Result', status: 'Status',
    mark: 'You ran the fingerprint test'
  };

  // Rewrite one fpcore check into Chinese. Values that are proper nouns or protocol strings (GPU model,
  // user agent, hashes) are kept as they are; only the labels, descriptions, explanations and the
  // "signals" prefixes are translated.
  function zhify(c) {
    var m;
    var out = { id: c.id, name: c.name, desc: c.desc, status: c.status, label: c.label, lines: c.lines.slice(), why: c.why };
    if (c.id === 'canvas') {
      out.name = '画布';
      out.desc = '你的浏览器如何绘制文字和图形。';
      if (c.label === 'Blocked') {
        out.label = '已阻止';
        out.lines = ['画布没有返回图像'];
        out.why = '浏览器或扩展阻止了画布读取，所以这个特征被隐藏了。';
      } else if (c.label === 'Varies') {
        out.label = '每次不同';
        out.lines = ['两次相同的绘制给出了不同的结果'];
        out.why = '你的浏览器或扩展似乎在给画布输出加噪，这会让画布无法成为稳定的标识。这个测试看到了差异，但无法确认它是怎么做到的。';
      } else {
        out.label = '稳定';
        if ((m = /^Hash (\S+) \(same on every draw\)$/.exec(c.lines[0]))) out.lines = ['哈希 ' + m[1] + '（每次绘制都相同）'];
        out.why = '网站可以把这和其他特征结合起来区分你。换一个浏览器比对一下哈希值：不同就说明它能认出你这套配置。';
      }
    } else if (c.id === 'webgl') {
      out.name = '显卡';
      out.desc = 'WebGL 能报告的 GPU 名称。';
      if (c.label === 'Hidden') {
        out.label = '已隐藏';
        out.lines = ['没有暴露 GPU 名称'];
        out.why = '你的浏览器不会告诉页面你用的是什么 GPU。';
      } else {
        out.label = '已暴露';
        out.why = '和其他特征结合时，确切的 GPU 型号是一个很强的信号。';
      }
    } else if (c.id === 'gpc') {
      out.name = '全局隐私控制';
      out.desc = '一个告诉网站不要出售或分享你数据的信号。';
      if (c.label === 'Sent') {
        out.label = '已发送';
        out.lines = ['你的浏览器发送了 GPC'];
        out.why = '在法律承认 GPC 的地区，网站必须把它当作退出请求来处理。';
      } else {
        out.label = '未发送';
        out.lines = ['你的浏览器没有发送 GPC'];
        out.why = 'Firefox、Brave 和 DuckDuckGo 浏览器可以发送它。有些浏览器需要装扩展。';
      }
    } else if (c.id === 'dnt') {
      out.name = '不跟踪';
      out.desc = '一个较早的选择退出请求头。';
      if (c.label === 'On') {
        out.label = '已开启';
        out.lines = ['DNT 已设为 1'];
      } else {
        out.label = '已关闭';
        out.lines = ['DNT 未设置'];
      }
      out.why = '大多数网站会忽略它。打开它反而可能让你更容易被区分出来，因为这么做的人很少。';
    } else if (c.id === 'cookies') {
      out.name = 'Cookie 开关';
      out.desc = '这个浏览器是否接受它们。';
      if (c.label === 'Enabled') {
        out.label = '已启用';
        out.lines = ['Cookie 已启用'];
      } else {
        out.label = '已禁用';
        out.lines = ['Cookie 已禁用'];
      }
      out.why = '本页不设置任何 Cookie。';
    } else if (c.id === 'signals') {
      out.name = '浏览器和设备';
      out.desc = '每个页面不问就能读到的信息。';
      out.label = '可见';
      out.lines = c.lines.map(function (l) {
        var x;
        if ((x = /^User agent: (.*)$/.exec(l))) return '浏览器标识：' + x[1];
        if ((x = /^Platform: (.*)$/.exec(l))) return '平台：' + x[1];
        if ((x = /^Languages: (.*)$/.exec(l))) return '语言：' + x[1];
        if ((x = /^Time zone: (.*)$/.exec(l))) return '时区：' + x[1];
        if ((x = /^Screen: (\d+x\d+), (\d+)-bit, ratio ([\d.]+)$/.exec(l))) return '屏幕：' + x[1] + '，' + x[2] + ' 位色，像素比 ' + x[3];
        if ((x = /^CPU threads: (.*)$/.exec(l))) return 'CPU 线程数：' + x[1];
        if ((x = /^Device memory: (.*)$/.exec(l))) return '设备内存：' + x[1];
        if ((x = /^Touch points: (.*)$/.exec(l))) return '触点数量：' + x[1];
        return l;
      });
      out.why = '单独一项都无法识别你。组合起来会缩小范围，而你的浏览器上少见的值会让范围缩得最小。';
    }
    return out;
  }

  function row(c) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-status', c.status);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', T.check);
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = c.name;
    var d = document.createElement('span'); d.className = 'c-desc'; d.textContent = c.desc;
    th.appendChild(n); th.appendChild(d);
    var td = document.createElement('td'); td.setAttribute('data-label', T.result);
    var vals = document.createElement('div'); vals.className = 'vals';
    c.lines.forEach(function (l) { var v = document.createElement('div'); v.className = 'val mono'; v.textContent = l; vals.appendChild(v); });
    td.appendChild(vals);
    var p = document.createElement('p'); p.className = 'why'; p.textContent = c.why; td.appendChild(p);
    var ts = document.createElement('td'); ts.setAttribute('data-label', T.status);
    var pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = c.label; ts.appendChild(pill);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function run() {
    document.dispatchEvent(new CustomEvent('netlog:mark', { detail: { label: T.mark } }));
    btn.disabled = true; btn.textContent = T.testing;
    window.FPC.collect().then(function (checks) {
      if (ZH) checks = checks.map(zhify);
      tbody.textContent = '';
      var warn = 0;
      checks.forEach(function (c) { if (c.status === 'warn') warn++; tbody.appendChild(row(c)); });
      summary.textContent = warn ? T.summary1(warn, checks.length) : T.summary2;
      summary.setAttribute('data-tone', warn ? 'warn' : 'ok');
    }).catch(function () {
      summary.textContent = T.fail; summary.setAttribute('data-tone', 'fail');
    }).then(function () { btn.disabled = false; btn.textContent = T.runAgain; });
  }
  btn.addEventListener('click', run);
})();
