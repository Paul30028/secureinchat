/* Text redactor page. All work happens in this page; nothing is sent anywhere or stored. */
(function () {
  'use strict';
  var R = window.RD;
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
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = rule.label; th.appendChild(n);
    var td = document.createElement('td'); td.setAttribute('data-label', 'Result');
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = count ? count + ' replaced with [' + rule.tag + '_n]' : 'None found'; td.appendChild(v);
    var ts = document.createElement('td'); ts.setAttribute('data-label', 'Status');
    var p = document.createElement('span'); p.className = 'pill'; p.textContent = count ? 'Redacted' : 'None'; ts.appendChild(p);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function updateRestore() {
    if (!reply.value) { restored.value = ''; restoreCopy.disabled = true; restoreStatus.textContent = ''; return; }
    var res = R.restore(reply.value, lastMapping);
    restored.value = res.text;
    restoreCopy.disabled = !restored.value;
    var n = res.restored;
    var msg = n + ' placeholder' + (n === 1 ? '' : 's') + ' put back.';
    if (res.unknown && res.unknown.length) {
      msg += ' Not found in this session: ' + res.unknown.join(', ') + '. They may come from a different redaction or the page was reloaded.';
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
      summary.textContent = 'Paste text to redact it.'; summary.setAttribute('data-tone', 'idle');
    } else if (!res.total) {
      summary.textContent = 'Nothing matched the selected rules. This does not mean the text is free of personal data.'; summary.setAttribute('data-tone', 'warn');
    } else {
      summary.textContent = res.total + ' item' + (res.total === 1 ? '' : 's') + ' replaced. Read the output before you share it: names and addresses are not detected automatically.'; summary.setAttribute('data-tone', 'ok');
    }
    copyBtn.disabled = !out.value;
    updateRestore();
  }

  function copyText(value, btn, label, fallbackEl) {
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = label; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done, function () { fallbackEl.select(); });
    else fallbackEl.select();
  }

  src.addEventListener('input', function () { if (src.value) document.dispatchEvent(new CustomEvent('netlog:mark', { detail: { label: 'You ran the redactor' } })); run(); });
  terms.addEventListener('input', run);
  ALL_RULES.forEach(function (r) { if (boxes[r.id]) boxes[r.id].addEventListener('change', run); });
  reply.addEventListener('input', updateRestore);
  clearBtn.addEventListener('click', function () {
    src.value = ''; terms.value = ''; reply.value = ''; restored.value = ''; lastMapping = {};
    run(); src.focus();
  });
  copyBtn.addEventListener('click', function () { copyText(out.value, copyBtn, 'Copy result', out); });
  restoreCopy.addEventListener('click', function () { copyText(restored.value, restoreCopy, 'Copy restored reply', restored); });
  run();
})();
