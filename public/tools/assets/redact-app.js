/* Text redactor page. All work happens in this page; nothing is sent anywhere or stored. */
(function () {
  'use strict';
  var R = window.RD;
  // Interface strings follow the document language (as in exif-app.js): the English page keeps its
  // old strings, the Chinese page (lang="zh-CN") gets Chinese ones. The rules themselves are shared.
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  var T = ZH ? {
    check: '检查', result: '结果', status: '状态',
    replaced: function (n, tag) { return n + ' 处已换成 [' + tag + '_n]'; },
    none: '未找到', redacted: '已替换', noneShort: '无',
    putBack: function (n) { return '已换回 ' + n + ' 个占位符。'; },
    unknown: function (list) { return '本次会话里没有这些占位符：' + list + '。它们可能来自另一次脱敏，或者页面刷新过。'; },
    idle: '粘贴文本开始脱敏。',
    nothing: '所选规则没有匹配到任何内容。这不代表文本里没有个人信息。',
    done: function (n) { return '已替换 ' + n + ' 处。分享前自己再读一遍：姓名和地址不会被自动识别，规则也会漏掉不常见的写法。'; },
    copied: '已复制', copy: '复制结果', copyRestored: '复制还原后的回复', mark: '你运行了脱敏',
    labels: { privkey: '私钥', jwt: 'JSON Web Token', apikey: 'API 密钥或令牌', url_cred: '网址里的密码', email: '邮箱地址', cn_id: '身份证号', cn_mobile: '手机号（中国大陆）', iban: 'IBAN', card: '银行卡号', ipv6: 'IPv6 地址', ipv4: 'IPv4 地址', mac: 'MAC 地址', phone: '电话号码', term: '你自己的词' },
  } : {
    check: 'Check', result: 'Result', status: 'Status',
    replaced: function (n, tag) { return n + ' replaced with [' + tag + '_n]'; },
    none: 'None found', redacted: 'Redacted', noneShort: 'None',
    putBack: function (n) { return n + ' placeholder' + (n === 1 ? '' : 's') + ' put back.'; },
    unknown: function (list) { return 'Not found in this session: ' + list + '. They may come from a different redaction or the page was reloaded.'; },
    idle: 'Paste text to redact it.',
    nothing: 'Nothing matched the selected rules. This does not mean the text is free of personal data.',
    done: function (n) { return n + ' item' + (n === 1 ? '' : 's') + ' replaced. Read the output before you share it: names and addresses are not detected automatically.'; },
    copied: 'Copied', copy: 'Copy result', copyRestored: 'Copy restored reply', mark: 'You ran the redactor',
    labels: {},
  };
  var TERM_RULE = { id: 'term', label: 'Your words', tag: 'NAME' };
  var ALL_RULES = R.RULES.concat([TERM_RULE]);
  var src = document.getElementById('rd-in');
  var out = document.getElementById('rd-out');
  var terms = document.getElementById('rd-terms');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');
  var copyBtn = document.getElementById('rd-copy');
  var clearBtn = document.getElementById('rd-clear');
  var reply = document.getElementById('rd-reply');
  var restored = document.getElementById('rd-restored');
  var restoreCopy = document.getElementById('rd-restore-copy');
  var restoreStatus = document.getElementById('rd-restore-status');
  var boxes = {};
  var lastMapping = {};
  ALL_RULES.forEach(function (r) { boxes[r.id] = document.getElementById('rule-' + r.id); });

  function enabled() { var o = {}; ALL_RULES.forEach(function (r) { if (boxes[r.id]) o[r.id] = boxes[r.id].checked; }); return o; }

  function row(rule, count) {
    var tr = document.createElement('tr'); tr.setAttribute('data-status', count ? 'warn' : 'info');
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', T.check);
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = T.labels[rule.id] || rule.label; th.appendChild(n);
    var td = document.createElement('td'); td.setAttribute('data-label', T.result);
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = count ? T.replaced(count, rule.tag) : T.none; td.appendChild(v);
    var ts = document.createElement('td'); ts.setAttribute('data-label', T.status);
    var p = document.createElement('span'); p.className = 'pill'; p.textContent = count ? T.redacted : T.noneShort; ts.appendChild(p);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function updateRestore() {
    if (!reply.value) { restored.value = ''; restoreCopy.disabled = true; restoreStatus.textContent = ''; return; }
    var res = R.restore(reply.value, lastMapping);
    restored.value = res.text;
    restoreCopy.disabled = !restored.value;
    var msg = T.putBack(res.restored);
    if (res.unknown && res.unknown.length) {
      msg += ' ' + T.unknown(res.unknown.join(', '));
    }
    restoreStatus.textContent = msg;
  }

  function run() {
    var res = R.redact(src.value, enabled(), { terms: R.parseTerms(terms.value) });
    lastMapping = res.mapping || {};
    out.value = res.text;
    tbody.textContent = '';
    ALL_RULES.forEach(function (r) { if (!boxes[r.id] || !boxes[r.id].checked) return; if (res.counts[r.id]) tbody.appendChild(row(r, res.counts[r.id])); });
    if (!src.value) {
      summary.textContent = T.idle; summary.setAttribute('data-tone', 'idle');
    } else if (!res.total) {
      summary.textContent = T.nothing; summary.setAttribute('data-tone', 'warn');
    } else {
      summary.textContent = T.done(res.total); summary.setAttribute('data-tone', 'ok');
    }
    copyBtn.disabled = !out.value;
    updateRestore();
  }

  function copyText(value, btn, label, fallbackEl) {
    var done = function () { btn.textContent = T.copied; setTimeout(function () { btn.textContent = label; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done, function () { fallbackEl.select(); });
    else fallbackEl.select();
  }

  src.addEventListener('input', function () { if (src.value) document.dispatchEvent(new CustomEvent('netlog:mark', { detail: { label: T.mark } })); run(); });
  terms.addEventListener('input', run);
  ALL_RULES.forEach(function (r) { if (boxes[r.id]) boxes[r.id].addEventListener('change', run); });
  reply.addEventListener('input', updateRestore);
  clearBtn.addEventListener('click', function () {
    src.value = ''; terms.value = ''; reply.value = ''; restored.value = ''; lastMapping = {};
    run(); src.focus();
  });
  copyBtn.addEventListener('click', function () { copyText(out.value, copyBtn, T.copy, out); });
  restoreCopy.addEventListener('click', function () { copyText(restored.value, restoreCopy, T.copyRestored, restored); });
  run();
})();
