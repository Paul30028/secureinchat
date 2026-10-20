/* IP leak test: browser side. Collects data, hands it to IPLT.analyze, renders the result. */
(function () {
  'use strict';
  var L = window.IPLT;
  if (!L) return;

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

  // ---- network helpers ---------------------------------------------------------------------------------------------

  function fetchJSON(url, ms, external) {
    var ac = new AbortController();
    var timer = setTimeout(function () { ac.abort(); }, ms || 5000);
    var opts = { cache: 'no-store', signal: ac.signal };
    if (external) { opts.credentials = 'omit'; opts.referrerPolicy = 'no-referrer'; }
    return fetch(url, opts)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(timer); return j; }, function (e) { clearTimeout(timer); throw e; });
  }

  function cleanIP(v, family) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    if (family === 4 && /^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return v;
    if (family === 6 && /^[0-9a-f:.]+$/i.test(v) && v.indexOf(':') !== -1) return v;
    return null;
  }

  function lookupNetwork(ip) {
    return fetchJSON('https://ipwho.is/' + encodeURIComponent(ip), 5000, true).then(function (j) {
      if (!j || j.success === false || !j.connection) return null;
      return { asn: j.connection.asn || null, org: j.connection.org || j.connection.isp || '', country: j.country_code || '' };
    }).catch(function () { return null; });
  }

  function gatherWebRTC(timeoutMs) {
    return new Promise(function (resolve) {
      var RPC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
      if (!RPC) return resolve({ status: 'unsupported', candidates: [] });
      var pc, done = false, found = [];
      function finish(status) {
        if (done) return;
        done = true;
        try { pc.close(); } catch (e) { /* ignore */ }
        resolve({ status: status, candidates: found });
      }
      try {
        pc = new RPC({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
      } catch (e) {
        return resolve({ status: 'blocked', candidates: [] });
      }
      try { pc.createDataChannel('probe'); } catch (e) { /* ignore */ }
      pc.onicecandidate = function (ev) {
        if (!ev.candidate) return finish('ok');
        var c = L.parseCandidate(ev.candidate.candidate);
        if (c) found.push(c);
      };
      pc.onicegatheringstatechange = function () { if (pc.iceGatheringState === 'complete') finish('ok'); };
      pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).catch(function () { finish('blocked'); });
      setTimeout(function () { finish(found.length ? 'ok' : 'timeout'); }, timeoutMs);
    });
  }

  function tzInfo(who) {
    var now = new Date();
    var browser = '';
    try { browser = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* ignore */ }
    return {
      browser: browser,
      browserOffsetMin: -now.getTimezoneOffset(),
      ipOffsetMin: who && who.timezone ? L.tzOffsetMinutes(who.timezone, now) : null,
    };
  }

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
    Object.keys(rows).forEach(function (id) { if (id !== 'dns') setRowRunning(rows[id]); });

    var who = fetchJSON('/tools/api/whoami', 6000, false).catch(function () { return null; });
    var v4 = fetchJSON('https://api4.ipify.org?format=json', 5000, true).then(function (j) { return cleanIP(j && j.ip, 4); }).catch(function () { return null; });
    var v6 = fetchJSON('https://api6.ipify.org?format=json', 5000, true).then(function (j) { return cleanIP(j && j.ip, 6); }).catch(function () { return null; });
    var rtc = gatherWebRTC(4500);

    Promise.all([who, v4, v6, rtc]).then(function (r) {
      var data = { who: r[0], v4: r[1], v6: r[2], webrtc: r[3], lookup: {}, tz: tzInfo(r[0]) };
      var target = L.lookupTarget(data.who, data.v4, data.v6);
      if (!target) return data;
      return lookupNetwork(target).then(function (info) {
        if (info) data.lookup[L.normalizeIP(target)] = info;
        return data;
      });
    }).then(function (data) {
      state.last = data;
      render(true);
    }).catch(function () {
      summary.setAttribute('data-tone', 'warn');
      summary.textContent = 'The test could not finish. Reload the page and try again.';
    }).then(function () {
      var wait = reduceMotion ? 0 : 6 * 130 + 100;
      setTimeout(function () {
        state.running = false;
        runBtn.disabled = false;
        runBtn.textContent = 'Run test again';
      }, wait);
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
