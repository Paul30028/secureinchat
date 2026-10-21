/* SecureInChat site script: no frameworks, no storage, no cookies. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  function ready(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // reveal sections on scroll
    var fades = document.querySelectorAll('.fade-up');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
      }, { threshold: 0.15 });
      fades.forEach(function (el) { io.observe(el); });
    } else {
      fades.forEach(function (el) { el.classList.add('visible'); });
    }

    // language switch: plain navigation to the language's own URL
    var sel = document.getElementById('lang');
    if (sel) sel.addEventListener('change', function () { window.location.href = sel.value; });

    // relay diagnostics
    var btn = document.getElementById('node-btn');
    if (!btn) return;
    var $ = function (id) { return document.getElementById(id); };
    var el = {
      label: $('node-btn-label'), conn: $('node-conn'), latency: $('node-latency'),
      chal: $('node-chal'), chalDetail: $('node-chal-detail'), log: $('node-log'),
      net: $('net-label'), status: $('net-status'),
    };
    var testing = false;

    function setNet(kind) {
      var map = { check: 'Network: Checking', ok: 'Network: Operational', bad: 'Network: Unreachable' };
      el.net.textContent = map[kind];
      if (el.status) el.status.setAttribute('data-state', kind);
    }
    function setConn(ok) {
      el.conn.textContent = ok ? 'Connected' : 'Awaiting test';
      el.conn.className = 'diag__note' + (ok ? ' ok' : '');
    }
    function fail(msg) {
      el.log.textContent = msg;
      el.log.setAttribute('data-state', 'bad');
      setNet('bad');
    }
    function done() { testing = false; btn.disabled = false; el.label.textContent = btn.getAttribute('data-retest'); }

    function check() {
      if (testing) return;
      testing = true;
      btn.disabled = true;
      el.label.textContent = btn.getAttribute('data-testing');
      el.latency.textContent = '—';
      el.chal.textContent = 'Pending'; el.chal.className = 'diag__val';
      el.chalDetail.textContent = 'Waiting for auth_challenge';
      el.log.textContent = 'Opening secure WebSocket channel…';
      el.log.removeAttribute('data-state');
      setConn(false); setNet('check');

      var started = performance.now(), connected = false, errored = false, ws, timer;
      try {
        ws = new WebSocket('wss://ws.secureinchat.com');
      } catch (e) { errored = true; fail(e.message || 'WebSocket initialization failed.'); done(); return; }
      timer = setTimeout(function () { errored = true; fail('Connection timed out after 10 seconds.'); done(); try { ws.close(); } catch (e) {} }, 10000);
      ws.onopen = function () {
        connected = true; setConn(true);
        el.latency.textContent = String(Math.round(performance.now() - started));
        el.log.textContent = 'WSS channel established. Waiting for relay challenge…';
      };
      ws.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data);
          if (data.type === 'auth_challenge') {
            el.chal.textContent = 'Verified'; el.chal.className = 'diag__val ok'; el.log.setAttribute('data-state', 'ok');
            el.chalDetail.textContent = String(data.challenge || '').slice(0, 20) + '…';
            el.log.textContent = 'Relay auth_challenge received and verified.';
          } else { el.log.textContent = 'Relay returned a valid message.'; }
        } catch (e) { el.log.textContent = 'Relay returned a non-JSON message.'; }
        clearTimeout(timer); setNet('ok'); done();
        setTimeout(function () { try { ws.close(1000, 'diagnostic complete'); } catch (e) {} }, 250);
      };
      ws.onerror = function () {
        clearTimeout(timer); errored = true;
        fail('Unable to establish the WSS relay connection. Check Tunnel hostname, DNS and origin service.'); done();
      };
      ws.onclose = function (e) {
        if (!connected && !errored) { fail('Connection closed before handshake completed (code ' + e.code + ').'); done(); }
      };
    }
    btn.addEventListener('click', check);
    check();
  });
})();
