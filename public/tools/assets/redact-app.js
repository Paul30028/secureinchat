/* Text redactor page. All work happens in this page; nothing is sent anywhere or stored. */
(function () {
  'use strict';
  var R = window.RD;
  var src = document.getElementById('rd-in');
  var out = document.getElementById('rd-out');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');
  var copyBtn = document.getElementById('rd-copy');
  var clearBtn = document.getElementById('rd-clear');
  var boxes = {};
  R.RULES.forEach(function (r) { boxes[r.id] = document.getElementById('rule-' + r.id); });

  function enabled() { var o = {}; R.RULES.forEach(function (r) { o[r.id] = boxes[r.id].checked; }); return o; }

  function row(rule, count) {
    var tr = document.createElement('tr'); tr.setAttribute('data-status', count ? 'warn' : 'info');
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = rule.label; th.appendChild(n);
    var td = document.createElement('td'); td.setAttribute('data-label', 'Result');
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = count ? count + ' replaced with [' + rule.tag + '_n]' : 'None found'; td.appendChild(v);
    var ts = document.createElement('td'); ts.setAttribute('data-label', 'Status');
    var p = document.createElement('span'); p.className = 'pill'; p.textContent = count ? 'Redacted' : 'None'; ts.appendChild(p);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function run() {
    var res = R.redact(src.value, enabled());
    out.value = res.text;
    tbody.textContent = '';
    R.RULES.forEach(function (r) { if (!boxes[r.id].checked) return; if (res.counts[r.id]) tbody.appendChild(row(r, res.counts[r.id])); });
    if (!src.value) {
      summary.textContent = 'Paste text to redact it.'; summary.setAttribute('data-tone', 'idle');
    } else if (!res.total) {
      summary.textContent = 'Nothing matched the selected rules. This does not mean the text is free of personal data.'; summary.setAttribute('data-tone', 'warn');
    } else {
      summary.textContent = res.total + ' item' + (res.total === 1 ? '' : 's') + ' replaced. Read the output before you share it: names and addresses are not detected.'; summary.setAttribute('data-tone', 'ok');
    }
    copyBtn.disabled = !out.value;
  }

  src.addEventListener('input', run);
  R.RULES.forEach(function (r) { boxes[r.id].addEventListener('change', run); });
  clearBtn.addEventListener('click', function () { src.value = ''; run(); src.focus(); });
  copyBtn.addEventListener('click', function () {
    var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy result'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(done, function () { out.select(); });
    else { out.select(); }
  });
  run();
})();
