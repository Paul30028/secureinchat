/* Account security checkup page. Answers live only in this page: nothing is sent or stored, and reloading clears them. */
(function () {
  'use strict';
  var A = window.ACCT;
  var form = document.getElementById('ac-form');
  var summary = document.getElementById('summary');
  var next = document.getElementById('ac-next');
  var list = document.getElementById('ac-next-list');
  var copyBtn = document.getElementById('ac-copy');
  var resetBtn = document.getElementById('ac-reset');
  var copied = document.getElementById('ac-copied');
  var last = null;
  // Interface strings follow the document language (as pw-app.js, exif-app.js): the English page keeps its
  // strings from account.js unchanged; the Chinese page (lang="zh-CN") gets Chinese ones. account.js is shared
  // and unchanged; scoring and order come from it, only the words are swapped here.
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  var ZH_ITEMS = {
    mfa: { name: '已开启两步验证', todo: '开启两步验证' },
    unique: { name: '这个密码没有在别处使用', todo: '给这个账号设一个不与别处共用的密码' },
    recovery: { name: '恢复邮箱和手机号是最新的，而且都是你自己的', todo: '更新恢复邮箱和手机号' },
    codes: { name: '备用验证码或恢复密钥保存在离线的地方', todo: '把备用验证码保存在离线的地方' },
    sessions: { name: '已检查登录中的设备', todo: '检查登录中的设备' },
    strong: { name: '第二步是通行密钥、安全密钥或应用提示，而不只是短信', todo: '添加通行密钥、安全密钥或应用提示' },
    apps: { name: '已检查第三方应用的访问权限', todo: '检查哪些其他应用可以访问' },
    breach: { name: '已查询这个邮箱地址是否出现在已知泄露中', todo: '在 Have I Been Pwned 上查询这个邮箱地址' },
  };
  function nm(it) { return ZH ? ZH_ITEMS[it.id].name : it.name; }
  function td(it) { return ZH ? ZH_ITEMS[it.id].todo : it.todo; }
  var FIND = ZH ? '（待确认）' : ' (find out)';
  function headline(r) {
    if (!ZH) return r.headline;
    if (!r.answered) return '回答上面的问题，看看先做什么。';
    if (r.done === r.total) return '这个账号的 ' + r.total + ' 项都已完成。接着对你第二重要的账号再做一遍。';
    var parts = ['已完成 ' + r.done + ' / ' + r.total + ' 项'];
    if (r.todo.length) parts.push(r.todo.length + ' 项待做');
    if (r.unsure.length) parts.push(r.unsure.length + ' 项待确认');
    if (r.open.length) parts.push(r.open.length + ' 项未回答');
    return parts.join('，') + '。';
  }
  // Chinese copy text: same content as account.js text() (only checklist state, never account details).
  function report(r, date) {
    if (!ZH) return A.text(r, date);
    var L = ['账号安全自查（secureinchat.com/zh/tools/account-checkup/）' + (date ? '，' + date : ''), '已完成 ' + r.done + ' / ' + r.total + ' 项。'];
    if (r.next.length) {
      L.push('', '接下来要做：');
      r.next.forEach(function (it, i) { L.push((i + 1) + '. ' + td(it) + (r.unsure.indexOf(it) >= 0 ? FIND : '')); });
    }
    if (r.open.length) { L.push('', '未回答：'); r.open.forEach(function (it) { L.push('- ' + nm(it)); }); }
    L.push('', '没有保存或发送任何内容。这份清单只包含你勾选的状态。');
    return L.join('\n');
  }

  function answers() {
    var o = {};
    A.ITEMS.forEach(function (it) {
      var c = form.querySelector('input[name="' + it.id + '"]:checked');
      if (c) o[it.id] = c.value;
    });
    return o;
  }

  function update() {
    var r = A.summarize(answers());
    last = r;
    summary.textContent = headline(r);
    summary.setAttribute('data-tone', r.tone);
    A.ITEMS.forEach(function (it) {
      var fs = document.getElementById('ac-' + it.id);
      var c = form.querySelector('input[name="' + it.id + '"]:checked');
      if (fs) fs.setAttribute('data-state', c ? c.value : 'open');
    });
    list.textContent = '';
    r.next.forEach(function (it) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#ac-' + it.id;
      a.textContent = td(it);
      li.appendChild(a);
      if (r.unsure.indexOf(it) >= 0) li.appendChild(document.createTextNode(FIND));
      list.appendChild(li);
    });
    next.hidden = !r.next.length;
    copyBtn.hidden = !r.answered;
    copied.textContent = '';
  }

  function reset() {
    form.querySelectorAll('input[type="radio"]').forEach(function (i) { i.checked = false; });
    update();
  }

  form.addEventListener('change', update);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  resetBtn.addEventListener('click', reset);
  copyBtn.addEventListener('click', function () {
    var t = report(last || A.summarize({}), new Date().toISOString().slice(0, 10));
    var done = function () { copied.textContent = ZH ? '已复制。' : 'Copied.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { copied.textContent = ZH ? '复制失败。请直接选中上面的清单。' : 'Copy failed. Select the list above instead.'; });
    else copied.textContent = ZH ? '这个浏览器不支持复制。' : 'Copy is not available in this browser.';
  });
  // Some browsers restore form fields after a reload or back navigation; clear them so nothing carries over.
  window.addEventListener('pageshow', reset);
  reset();
  window.ACCOUNT_CHECKUP = { answers: answers, update: update, report: report };
})();
