/* IP leak test: browser side. Collects data, hands it to IPLT.analyze, renders the result. */
(function () {
  'use strict';
  var L = window.IPLT;
  if (!L || !window.NETC) return;

  var runBtn = document.getElementById('run');
  var vpnBox = document.getElementById('vpn');
  var copyBtn = document.getElementById('copy');
  var summary = document.getElementById('summary');
  var bypass = document.getElementById('bypass');
  var bypassList = document.getElementById('bypass-list');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var rows = {};
  Array.prototype.forEach.call(document.querySelectorAll('tr[data-check]'), function (tr) {
    rows[tr.getAttribute('data-check')] = tr;
  });
  var slot = function (name) { return document.querySelector('[data-slot="' + name + '"]'); };

  var state = { running: false, last: null, lastResult: null };

  // Network probes live in netcore.js (window.NETC).

  // ---- rendering ---------------------------------------------------------------------------------------------------

  function setRowRunning(tr) {
    tr.setAttribute('data-status', 'running');
    tr.querySelector('[data-pill]').textContent = 'Running';
  }

  function fillRow(check) {
    var tr = rows[check.id];
    if (!tr) return;
    tr.setAttribute('data-status', check.status);
    tr.querySelector('[data-pill]').textContent = check.label;
    var vals = tr.querySelector('.vals');
    vals.textContent = '';
    check.lines.forEach(function (line) {
      var d = document.createElement('div');
      d.className = 'val mono';
      d.textContent = line;
      vals.appendChild(d);
    });
    tr.querySelector('.why').textContent = check.text;
  }

  function fillDiagram(res) {
    var dg = res.diagram;
    slot('exit-ip').textContent = dg.exit.ip || 'Unavailable';
    slot('exit-place').textContent = dg.exit.place || '';
    slot('exit-net').textContent = dg.exit.network || '';
    slot('browser-tz').textContent = dg.browser.tz ? 'Time zone ' + dg.browser.tz : 'Time zone unavailable';
    slot('browser-lang').textContent = dg.browser.lang ? 'Language ' + dg.browser.lang : '';
    bypassList.textContent = '';
    dg.leaks.forEach(function (lk) {
      var li = document.createElement('li');
      var b = document.createElement('b');
      b.textContent = lk.kind;
      li.appendChild(b);
      li.appendChild(document.createTextNode(lk.value || ''));
      bypassList.appendChild(li);
    });
    var show = dg.leaks.length > 0;
    bypass.hidden = !show;
    bypass.classList.remove('is-drawn');
    if (show && !reduceMotion) { void bypass.offsetWidth; bypass.classList.add('is-drawn'); }
  }

  function countText(c) {
    var parts = [];
    if (c.pass) parts.push(c.pass + ' passed');
    if (c.warn) parts.push(c.warn + (c.warn === 1 ? ' warning' : ' warnings'));
    if (c.fail) parts.push(c.fail + ' failed');
    if (c.info) parts.push(c.info + ' info');
    if (c.na) parts.push(c.na + ' not tested');
    return parts.join(', ');
  }

  function fillSummary(res) {
    var tone = res.count.fail ? 'fail' : res.count.warn ? 'warn' : vpnBox.checked ? 'ok' : 'idle';
    summary.setAttribute('data-tone', tone);
    summary.textContent = res.headline + '. ' + countText(res.count) + '.';
  }

  function analyzeNow() {
    var d = {};
    for (var k in state.last) d[k] = state.last[k];
    d.vpn = vpnBox.checked;
    return L.analyze(d);
  }

  function render(animate) {
    if (!state.last) return;
    var res = analyzeNow();
    state.lastResult = res;
    var delay = animate && !reduceMotion ? 130 : 0;
    res.checks.forEach(function (c, i) {
      if (delay) setTimeout(function () { fillRow(c); }, i * delay);
      else fillRow(c);
    });
    var finish = function () { fillDiagram(res); fillSummary(res); copyBtn.hidden = false; };
    if (delay) setTimeout(finish, res.checks.length * delay); else finish();
  }

  // ---- run ---------------------------------------------------------------------------------------------------------

  function run() {
    if (state.running) return;
    state.running = true;
    runBtn.disabled = true;
    runBtn.textContent = 'Running test';
    summary.setAttribute('data-tone', 'idle');
    summary.textContent = 'Running checks. This takes a few seconds.';
    copyBtn.hidden = true;
    bypass.hidden = true;
    Object.keys(rows).forEach(function (id) { setRowRunning(rows[id]); });

    window.NETC.collect().then(function (data) {
      // Kept in this tab's memory only: resolvers seen without a VPN, to compare with a later run that has one.
      if (!vpnBox.checked && data.dns.status === 'ok') state.baseline = data.dns.resolvers;
      else if (vpnBox.checked) data.baseline = state.baseline;
      return data;
    }).then(function (data) {
      state.last = data;
      render(true);
    }).catch(function () {
      summary.setAttribute('data-tone', 'warn');
      summary.textContent = 'The test could not finish. Reload the page and try again.';
    }).then(function () {
      var settle = reduceMotion ? 0 : 6 * 130 + 100;
      setTimeout(function () {
        state.running = false;
        runBtn.disabled = false;
        runBtn.textContent = 'Run test again';
      }, settle);
    });
  }

  function copyResults() {
    var res = state.lastResult;
    if (!res) return;
    var out = ['IP leak test, ' + new Date().toISOString().slice(0, 10), vpnBox.checked ? 'VPN or proxy: yes' : 'VPN or proxy: no', ''];
    res.checks.forEach(function (c) {
      out.push(c.name + ': ' + c.label);
      c.lines.forEach(function (l) { out.push('  ' + l); });
    });
    var text = out.join('\n');
    var done = function () {
      copyBtn.textContent = 'Copied';
      setTimeout(function () { copyBtn.textContent = 'Copy results'; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
  }

  runBtn.addEventListener('click', run);
  copyBtn.addEventListener('click', copyResults);
  vpnBox.addEventListener('change', function () { if (state.last && !state.running) render(false); });
})();
