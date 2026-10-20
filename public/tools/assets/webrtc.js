/* WebRTC leak test: gathers ICE candidates and compares them with the address websites see. Stores nothing. */
(function () {
  'use strict';
  var L = window.IPLT;
  var btn = document.getElementById('run');
  var vpnBox = document.getElementById('vpn');
  var tr = document.querySelector('tr[data-check="webrtc"]');
  var summary = document.getElementById('summary');
  var state = { last: null, running: false };

  function fetchJSON(url, ms) {
    var ac = new AbortController();
    var timer = setTimeout(function () { ac.abort(); }, ms);
    return fetch(url, { signal: ac.signal, cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(timer); return j; }, function (e) { clearTimeout(timer); throw e; });
  }

  function gather(timeoutMs) {
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
      try { pc = new RPC({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] }); }
      catch (e) { return resolve({ status: 'blocked', candidates: [] }); }
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

  function cleanIP(v) { return typeof v === 'string' && /^[0-9a-f:.]{3,45}$/i.test(v.trim()) ? v.trim() : null; }

  function render() {
    var d = state.last;
    if (!d) return;
    d.vpn = vpnBox.checked;
    var c = L.analyze(d).checks[1];
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
    summary.textContent = 'Websites see ' + ip + '. ' + (c.status === 'fail' ? 'WebRTC leaks a different address.' : c.status === 'pass' ? 'No WebRTC leak found.' : 'Read the note below.');
    summary.setAttribute('data-tone', c.status === 'fail' ? 'fail' : c.status === 'pass' ? 'ok' : 'warn');
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
    Promise.all([who, v4, v6, gather(4500)]).then(function (r) {
      state.last = { who: r[0], v4: r[1], v6: r[2], webrtc: r[3], lookup: {}, tz: null };
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
