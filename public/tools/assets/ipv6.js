/* IPv6 leak test: compares your IPv6 and IPv4 networks. Stores nothing. */
(function () {
  'use strict';
  var L = window.IPLT;
  var btn = document.getElementById('run');
  var vpnBox = document.getElementById('vpn');
  var tr = document.querySelector('tr[data-check="ipv6"]');
  var summary = document.getElementById('summary');
  var state = { last: null, running: false };

  function fetchJSON(url, ms) {
    var ac = new AbortController();
    var timer = setTimeout(function () { ac.abort(); }, ms);
    return fetch(url, { signal: ac.signal, cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(timer); return j; }, function (e) { clearTimeout(timer); throw e; });
  }

  function lookupNetwork(ip) {
    return fetchJSON('https://ipwho.is/' + encodeURIComponent(ip), 5000).then(function (j) {
      if (!j || j.success === false || !j.connection) return null;
      return { asn: j.connection.asn || null, org: j.connection.org || j.connection.isp || '', country: j.country_code || '' };
    }).catch(function () { return null; });
  }

  function cleanIP(v) { return typeof v === 'string' && /^[0-9a-f:.]{3,45}$/i.test(v.trim()) ? v.trim() : null; }

  function render() {
    var d = state.last;
    if (!d) return;
    d.vpn = vpnBox.checked;
    var c = L.analyze(d).checks[2];
    tr.setAttribute('data-status', c.status);
    tr.querySelector('[data-pill]').textContent = c.label;
    var vals = tr.querySelector('.vals');
    vals.textContent = '';
    c.lines.forEach(function (line) {
      var el = document.createElement('div');
      el.className = 'val mono';
      el.textContent = line;
      vals.appendChild(el);
    });
    tr.querySelector('.why').textContent = c.text;
    var ip = d.who && d.who.ip ? d.who.ip : (d.v4 || 'unknown');
    summary.textContent = 'Websites see ' + ip + '. ' + (c.status === 'fail' ? 'IPv6 leaves outside your VPN.' : c.status === 'pass' ? 'No IPv6 leak found.' : 'Read the note below.');
    summary.setAttribute('data-tone', c.status === 'fail' ? 'bad' : c.status === 'pass' ? 'good' : 'mid');
  }

  function run() {
    if (state.running) return;
    state.running = true;
    btn.disabled = true;
    btn.textContent = 'Testing...';
    tr.setAttribute('data-status', 'running');
    tr.querySelector('[data-pill]').textContent = 'Running';
    var who = fetchJSON('/tools/api/whoami', 6000).catch(function () { return null; });
    var v4 = fetchJSON('https://api4.ipify.org?format=json', 5000).then(function (j) { return cleanIP(j && j.ip); }).catch(function () { return null; });
    var v6 = fetchJSON('https://api6.ipify.org?format=json', 5000).then(function (j) { return cleanIP(j && j.ip); }).catch(function () { return null; });
    Promise.all([who, v4, v6]).then(function (r) {
      var data = { who: r[0], v4: r[1], v6: r[2], webrtc: { status: 'unsupported', candidates: [] }, lookup: {}, tz: null };
      var target = L.lookupTarget(data.who, data.v4, data.v6);
      if (!target) return data;
      return lookupNetwork(target).then(function (info) {
        if (info) data.lookup[L.normalizeIP(target)] = info;
        return data;
      });
    }).then(function (data) {
      state.last = data;
      render();
    }).catch(function () {
      summary.textContent = 'The test could not finish. Check your connection and try again.';
    }).then(function () {
      state.running = false;
      btn.disabled = false;
      btn.textContent = 'Run again';
    });
  }

  btn.addEventListener('click', run);
  vpnBox.addEventListener('change', function () { if (state.last && !state.running) render(); });
})();
