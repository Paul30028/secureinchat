/* Network data collection shared by the IP leak test and the privacy report.
   Contacts only the services listed on /principles/: our whoami endpoint, ipify (v4/v6), ipwho.is,
   Cloudflare STUN and our DNS probe zone. Results stay in the page. Requires logic.js (window.IPLT). */
(function (root) {
  'use strict';
  var L = root.IPLT;

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
      var RPC = root.RTCPeerConnection || root.webkitRTCPeerConnection;
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

  // DNS leak probe: the browser looks up unique names under our zone. The authoritative server records which
  // resolver asked, and the result API returns those resolver addresses for this test id only.
  var DNS_ZONE = 'lk.secureinchat.com';
  var DNS_API = 'https://dnsapi.secureinchat.com/r?id=';

  function randomHex(n) {
    var a = new Uint8Array(n / 2);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function runDNS() {
    if (!root.crypto || !crypto.getRandomValues) return Promise.resolve({ status: 'unavailable', resolvers: [] });
    var id = randomHex(12);
    for (var i = 1; i <= 6; i++) {
      var ac = new AbortController();
      fetch('https://' + id + '-' + i + '.' + DNS_ZONE + '/', { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ac.signal }).catch(function () {});
      setTimeout(ac.abort.bind(ac), 2500);
    }
    var read = function () {
      return fetchJSON(DNS_API + id, 4000, true).then(function (j) {
        return Array.isArray(j && j.resolvers) ? j.resolvers.filter(function (ip) { return typeof ip === 'string' && /^[0-9a-f:.]{3,45}$/i.test(ip); }) : null;
      }).catch(function () { return null; });
    };
    return wait(2200).then(read).then(function (first) {
      if (first === null) return null;
      if (first.length) return first;
      return wait(1800).then(read);
    }).then(function (ips) {
      if (ips === null) return { status: 'unavailable', resolvers: [] };
      if (!ips.length) return { status: 'none', resolvers: [] };
      return Promise.all(ips.slice(0, 4).map(function (ip) {
        return lookupNetwork(ip).then(function (n) { return { ip: ip, asn: n && n.asn || null, org: n && n.org || '' }; });
      })).then(function (list) { return { status: 'ok', resolvers: list }; });
    });
  }

  /* Runs every network probe in parallel and resolves to the data object IPLT.analyze expects
     (without vpn/baseline, which the caller sets). */
  function collect() {
    var who = fetchJSON('/tools/api/whoami', 6000, false).catch(function () { return null; });
    var v4 = fetchJSON('https://api4.ipify.org?format=json', 5000, true).then(function (j) { return cleanIP(j && j.ip, 4); }).catch(function () { return null; });
    var v6 = fetchJSON('https://api6.ipify.org?format=json', 5000, true).then(function (j) { return cleanIP(j && j.ip, 6); }).catch(function () { return null; });
    return Promise.all([who, v4, v6, gatherWebRTC(4500), runDNS()]).then(function (r) {
      var data = { who: r[0], v4: r[1], v6: r[2], webrtc: r[3], dns: r[4], baseline: null, lookup: {}, tz: tzInfo(r[0]) };
      var target = L.lookupTarget(data.who, data.v4, data.v6);
      if (!target) return data;
      return lookupNetwork(target).then(function (info) {
        if (info) data.lookup[L.normalizeIP(target)] = info;
        return data;
      });
    });
  }

  root.NETC = { collect: collect };
})(window);
