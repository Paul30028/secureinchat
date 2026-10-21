/* Browser privacy report: runs the network checks (netcore + logic) and the browser checks (fpcore) in one go,
   ranks what to fix first, and offers a plain-text copy. Nothing is stored; the report lives in this tab only. */
(function () {
  'use strict';
  var L = window.IPLT, N = window.NETC, F = window.FPC;
  if (!L || !N || !F) return;

  var runBtn = document.getElementById('run');
  var vpnBox = document.getElementById('vpn');
  var copyBtn = document.getElementById('copy');
  var summary = document.getElementById('summary');
  var fixBox = document.getElementById('fix');
  var fixList = document.getElementById('fix-list');
  var netBody = document.getElementById('net-rows');
  var brBody = document.getElementById('browser-rows');
  var state = { running: false, net: null, browser: null, report: null };

  // What to read next for each finding. Links go to our own pages only.
  var NEXT = {
    ip: ['How to test a VPN yourself', '/blog/how-to-test-a-vpn-yourself/'],
    webrtc: ['WebRTC leaks explained, and how to stop them', '/blog/webrtc-leak-explained/'],
    ipv6: ['IPv6 leaks explained, and how to stop them', '/blog/ipv6-leaks-explained/'],
    dns: ['DNS leaks explained, and how to stop them', '/blog/dns-leaks-explained/'],
    tz: ['How the leak checks work', '/blog/how-the-ip-leak-test-works/'],
    headers: ['How the leak checks work', '/blog/how-the-ip-leak-test-works/'],
    canvas: ['Browser fingerprint test, with details', '/tools/browser-fingerprint-test/'],
    webgl: ['Browser fingerprint test, with details', '/tools/browser-fingerprint-test/'],
    gpc: ['Browser fingerprint test, with details', '/tools/browser-fingerprint-test/'],
  };

  var BROWSER_STATUS = { ok: 'pass', warn: 'warn', info: 'info' };
  var RANK = { fail: 0, warn: 1 };

  /* Pure: turns the two result sets into one report. Exposed for tests. */
  function build(netChecks, browserChecks) {
    var items = [];
    netChecks.forEach(function (c) {
      items.push({ group: 'Connection', id: c.id, name: c.name, status: c.status, label: c.label, lines: c.lines, why: c.text });
    });
    browserChecks.forEach(function (c) {
      items.push({ group: 'Browser', id: c.id, name: c.name, status: BROWSER_STATUS[c.status] || 'info', label: c.label, lines: c.lines, why: c.why });
    });
    var fix = items.filter(function (i) { return i.status in RANK; })
      .map(function (i, n) { return { item: i, n: n }; })
      .sort(function (a, b) { return RANK[a.item.status] - RANK[b.item.status] || a.n - b.n; })
      .map(function (x) { return x.item; });
    var count = { pass: 0, warn: 0, fail: 0, info: 0, na: 0 };
    items.forEach(function (i) { count[i.status] = (count[i.status] || 0) + 1; });
    var headline;
    if (count.fail) headline = count.fail + (count.fail === 1 ? ' leak found' : ' leaks found') + (count.warn ? ', and ' + count.warn + (count.warn === 1 ? ' thing' : ' things') + ' to check' : '');
    else if (count.warn) headline = 'No leaks found. ' + count.warn + (count.warn === 1 ? ' thing makes' : ' things make') + ' you easier to recognise';
    else headline = 'Nothing to look at in ' + items.length + ' checks';
    return { items: items, fix: fix, count: count, headline: headline };
  }

  function text(report, vpn, date) {
    var out = ['Browser privacy report, ' + date, 'VPN or proxy: ' + (vpn ? 'yes' : 'no'), report.headline + '.', ''];
    if (report.fix.length) {
      out.push('Look at first:');
      report.fix.forEach(function (i, n) { out.push((n + 1) + '. ' + i.name + ' (' + i.label + ')'); });
      out.push('');
    }
    ['Connection', 'Browser'].forEach(function (g) {
      out.push(g + ':');
      report.items.filter(function (i) { return i.group === g; }).forEach(function (i) {
        out.push('- ' + i.name + ': ' + i.label);
        i.lines.forEach(function (l) { out.push('    ' + l); });
      });
      out.push('');
    });
    out.push('Made in the browser at secureinchat.com/tools/privacy-report/. Nothing was saved.');
    return out.join('\n');
  }

  window.PRIVACY_REPORT = { build: build, text: text };

  // ---- rendering --------------------------------------------------------------------------------------------------

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function row(i) {
    var tr = el('tr'); tr.setAttribute('data-status', i.status); tr.setAttribute('data-check', i.id);
    var th = el('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
    th.appendChild(el('span', 'c-name', i.name));
    var td = el('td'); td.setAttribute('data-label', 'Result');
    var vals = el('div', 'vals');
    i.lines.forEach(function (l) { vals.appendChild(el('div', 'val mono', l)); });
    td.appendChild(vals); td.appendChild(el('p', 'why', i.why || ''));
    var ts = el('td'); ts.setAttribute('data-label', 'Status'); ts.appendChild(el('span', 'pill', i.label));
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function render() {
    if (!state.net || !state.browser) return;
    var d = {}; for (var k in state.net) d[k] = state.net[k];
    d.vpn = vpnBox.checked;
    var report = build(L.analyze(d).checks, state.browser);
    state.report = report;
    netBody.textContent = ''; brBody.textContent = '';
    report.items.forEach(function (i) { (i.group === 'Connection' ? netBody : brBody).appendChild(row(i)); });
    fixList.textContent = '';
    report.fix.forEach(function (i) {
      var li = el('li');
      li.appendChild(el('strong', null, i.name + ': ' + i.label + '. '));
      li.appendChild(document.createTextNode(i.why || ''));
      var nx = NEXT[i.id];
      if (nx) { li.appendChild(document.createTextNode(' ')); var a = el('a', null, nx[0]); a.href = nx[1]; li.appendChild(a); }
      fixList.appendChild(li);
    });
    fixBox.hidden = report.fix.length === 0;
    summary.setAttribute('data-tone', report.count.fail ? 'fail' : report.count.warn ? 'warn' : 'ok');
    summary.textContent = report.headline + '.';
    copyBtn.hidden = false;
  }

  function run() {
    if (state.running) return;
    state.running = true;
    runBtn.disabled = true; runBtn.textContent = 'Running checks';
    copyBtn.hidden = true; fixBox.hidden = true;
    summary.setAttribute('data-tone', 'idle');
    summary.textContent = 'Running 12 checks. This takes about ten seconds.';
    Array.prototype.forEach.call(document.querySelectorAll('#net-rows tr, #browser-rows tr'), function (tr) {
      tr.setAttribute('data-status', 'running');
      var p = tr.querySelector('.pill'); if (p) p.textContent = 'Running';
    });
    Promise.all([N.collect(), F.collect()]).then(function (r) {
      state.net = r[0]; state.browser = r[1];
      render();
    }).catch(function () {
      summary.setAttribute('data-tone', 'warn');
      summary.textContent = 'The report could not finish. Reload the page and try again.';
    }).then(function () {
      state.running = false; runBtn.disabled = false; runBtn.textContent = 'Run again';
    });
  }

  function copy() {
    if (!state.report) return;
    var t = text(state.report, vpnBox.checked, new Date().toISOString().slice(0, 10));
    var done = function () { copyBtn.textContent = 'Copied'; setTimeout(function () { copyBtn.textContent = 'Copy report'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () {});
  }

  runBtn.addEventListener('click', run);
  copyBtn.addEventListener('click', copy);
  vpnBox.addEventListener('change', function () { if (!state.running) render(); });
})();
