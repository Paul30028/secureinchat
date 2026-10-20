/* IP leak test: pure analysis logic. No DOM, no network. Works in the browser (window.IPLT) and in Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IPLT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Rough list of network-name fragments that usually mean "hosting provider or VPN", not a home/business ISP.
  // This is a heuristic. The UI says so.
  var HOSTING_RE = new RegExp(
    [
      'hosting', 'vps', 'server', 'data ?cent', 'colo', 'cloud', 'vpn', 'proxy', 'privacy', 'anonym',
      'amazon', 'aws', 'google', 'microsoft', 'azure', 'oracle', 'alibaba', 'tencent', 'digitalocean',
      'ovh', 'hetzner', 'linode', 'akamai', 'vultr', 'choopa', 'constant', 'm247', 'datacamp', 'cdn77',
      'leaseweb', 'quadranet', 'zenlayer', 'tefincom', 'packethub', 'clouvider', 'contabo', 'scaleway',
      'netcup', 'kamatera', 'upcloud', 'worldstream', 'frantech', 'psychz', 'sharktech', 'xtom',
      'nord', 'proton', 'mullvad', 'express', 'surfshark', 'cyberghost', 'windscribe', 'ivpn', 'ipvanish',
      'private internet', 'perfect privacy', 'tunnelbear', 'hide\\.me', 'datapacket', 'hostroyale',
    ].join('|'),
    'i'
  );

  function looksLikeHosting(org) {
    return !!org && HOSTING_RE.test(org);
  }

  function isIPv6(ip) {
    return typeof ip === 'string' && ip.indexOf(':') !== -1;
  }

  // Expand an IPv6 address to 8 groups so two spellings of the same address compare equal.
  function normalizeIP(ip) {
    if (typeof ip !== 'string') return '';
    ip = ip.trim().toLowerCase().replace(/%.*$/, '');
    if (!isIPv6(ip)) return ip;
    var parts = ip.split('::');
    var head = parts[0] ? parts[0].split(':') : [];
    var tail = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
    var fill = 8 - head.length - tail.length;
    var groups = head.slice();
    if (parts.length > 1) for (var i = 0; i < fill; i++) groups.push('0');
    groups = groups.concat(tail);
    return groups.map(function (g) { return parseInt(g || '0', 16).toString(16); }).join(':');
  }

  function isPrivateAddress(ip) {
    if (!ip) return false;
    if (!isIPv6(ip)) {
      var m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
      if (!m) return false;
      var a = +m[1], b = +m[2];
      return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a === 0;
    }
    var n = normalizeIP(ip);
    return n === '0:0:0:0:0:0:0:1' || /^f[cd]/.test(n) || /^fe[89ab]/.test(n);
  }

  // "candidate:842163049 1 udp 1677729535 203.0.113.5 46154 typ srflx raddr ..." -> {type, address, protocol, mdns}
  function parseCandidate(line) {
    if (typeof line !== 'string') return null;
    var f = line.replace(/^a=/, '').split(/\s+/);
    if (f.length < 8 || f[6] !== 'typ') return null;
    var address = f[4];
    return {
      protocol: f[2].toLowerCase(),
      address: address,
      type: f[7],
      mdns: /\.local$/i.test(address),
    };
  }

  // Offset of an IANA time zone from UTC, in minutes, at a given moment.
  function tzOffsetMinutes(timeZone, date) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
      }).formatToParts(date);
      var v = {};
      parts.forEach(function (p) { v[p.type] = +p.value; });
      var asUTC = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
      return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
    } catch (e) {
      return null;
    }
  }

  function formatOffset(min) {
    if (min === null || min === undefined) return 'UTC?';
    var sign = min < 0 ? '-' : '+';
    var abs = Math.abs(min);
    var h = Math.floor(abs / 60), m = abs % 60;
    return 'UTC' + sign + h + (m ? ':' + (m < 10 ? '0' : '') + m : '');
  }

  function place(who) {
    if (!who) return '';
    return [who.city, who.country].filter(Boolean).join(', ');
  }

  function networkName(who) {
    if (!who || !who.asn) return who && who.asOrganization ? who.asOrganization : '';
    return 'AS' + who.asn + (who.asOrganization ? ' ' + who.asOrganization : '');
  }

  var LABELS = { pass: 'Pass', warn: 'Warning', fail: 'Fail', info: 'Info', na: 'Not tested' };

  function result(id, name, status, lines, text, extra) {
    var r = { id: id, name: name, status: status, label: LABELS[status], lines: lines || [], text: text };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }

  // ---- individual checks -------------------------------------------------------------------------------------------

  function checkPublicIP(d) {
    var who = d.who;
    var ip = (who && who.ip) || d.v4 || d.v6;
    if (!ip) {
      return result('ip', 'Public IP', 'na', ['No address returned'],
        'The lookups failed, so the test could not read your public address. Check that no blocker is stopping requests to this site, then run the test again.');
    }
    var lines = [ip];
    if (place(who)) lines.push(place(who));
    if (networkName(who)) lines.push(networkName(who));
    var hosting = looksLikeHosting(who && who.asOrganization);
    if (!d.vpn) {
      return result('ip', 'Public IP', 'info', lines,
        'This is the address websites see. It points to your internet provider and a rough location.');
    }
    if (hosting) {
      return result('ip', 'Public IP', 'pass', lines,
        'This looks like a hosting or VPN network, which is what you would expect with a VPN on.');
    }
    return result('ip', 'Public IP', 'warn', lines,
      'This looks like a regular internet provider. If your VPN is on, your traffic may be bypassing it through split tunneling, a disconnected app or a browser-only extension. Residential VPN exits can also look like this.');
  }

  function knownAddresses(d) {
    var v4 = [], v6 = [];
    [d.who && d.who.ip, d.v4, d.v6].forEach(function (ip) {
      if (!ip) return;
      (isIPv6(ip) ? v6 : v4).push(normalizeIP(ip));
    });
    return { v4: v4, v6: v6 };
  }

  function checkWebRTC(d) {
    var w = d.webrtc || { status: 'unsupported', candidates: [] };
    if (w.status === 'unsupported') {
      return result('webrtc', 'WebRTC', 'pass', ['WebRTC unavailable'],
        'This browser does not offer WebRTC, so it cannot expose an address this way.');
    }
    var known = knownAddresses(d);
    var seen = {};
    var matching = [], leaking = [], unverified = [], localRaw = [], localHidden = 0;

    (w.candidates || []).forEach(function (c) {
      if (c.mdns) { localHidden++; return; }
      var n = normalizeIP(c.address);
      var key = c.type + '|' + n;
      if (seen[key]) return;
      seen[key] = true;
      if (isPrivateAddress(c.address)) { if (c.type === 'host') localRaw.push(c.address); return; }
      var family = isIPv6(c.address) ? known.v6 : known.v4;
      if (!family.length) unverified.push(c.address);
      else if (family.indexOf(n) !== -1) matching.push(c.address);
      else leaking.push(c.address);
    });

    var lines = [];
    leaking.forEach(function (a) { lines.push(a + ' (differs from your public IP)'); });
    unverified.forEach(function (a) { lines.push(a + ' (could not compare)'); });
    matching.forEach(function (a) { lines.push(a + ' (matches your public IP)'); });
    localRaw.forEach(function (a) { lines.push(a + ' (local network address)'); });
    if (localHidden) lines.push(localHidden + ' local address' + (localHidden > 1 ? 'es' : '') + ' hidden by your browser');
    if (!lines.length) lines.push('No addresses exposed');

    if (leaking.length && d.vpn) {
      return result('webrtc', 'WebRTC', 'fail', lines,
        'A web page can read this address without asking you. It is not the address websites see on normal connections, so WebRTC is going around your VPN or proxy.',
        { leaks: leaking });
    }
    if (leaking.length) {
      return result('webrtc', 'WebRTC', 'info', lines,
        'WebRTC reports an address that differs from the one the lookup returned. Without a VPN this is usually a second network interface or an IPv4 and IPv6 pair.', { leaks: [] });
    }
    if (unverified.length) {
      return result('webrtc', 'WebRTC', 'warn', lines,
        'WebRTC exposed a public address that this test could not compare, because the matching lookup failed. Compare it with your public IP by hand.', { leaks: [] });
    }
    if (localRaw.length) {
      return result('webrtc', 'WebRTC', 'warn', lines,
        'Your local network address is visible to web pages. It is not a route to you from the internet, but it is a fingerprinting detail. Most current browsers hide it behind a random .local name.', { leaks: [] });
    }
    return result('webrtc', 'WebRTC', 'pass', lines,
      'Nothing here goes beyond what websites already see.', { leaks: [] });
  }

  function normOrg(o) {
    return (o || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // true: same network, false: different networks, null: cannot tell
  function compareNetworks(a, b) {
    if (!a || !b) return null;
    if (a.asn && b.asn) return String(a.asn) === String(b.asn);
    var oa = normOrg(a.org), ob = normOrg(b.org);
    if (oa && ob) return oa === ob;
    return null;
  }

  // The address in the "other" IP family that still needs an ASN lookup, or null.
  function lookupTarget(who, v4, v6) {
    var wip = who && who.ip;
    if (!wip) return null;
    var cand = isIPv6(wip) ? v4 : v6;
    return cand && normalizeIP(cand) !== normalizeIP(wip) ? cand : null;
  }

  function checkIPv6(d) {
    var who = d.who;
    var v6 = d.v6 || (who && isIPv6(who.ip) ? who.ip : null);
    if (!v6) {
      return result('ipv6', 'IPv6', 'pass', ['No IPv6 connection detected'],
        'Your device did not reach the internet over IPv6, so there is no second route to leak through.');
    }
    var v4 = d.v4 || (who && who.ip && !isIPv6(who.ip) ? who.ip : null);
    var infoOf = function (ip) {
      if (!ip) return null;
      if (who && who.ip && normalizeIP(who.ip) === normalizeIP(ip)) return { asn: who.asn, org: who.asOrganization };
      return (d.lookup && d.lookup[normalizeIP(ip)]) || null;
    };
    var v6info = infoOf(v6);
    var lines = [v6];
    if (v6info && (v6info.org || v6info.asn)) lines.push((v6info.asn ? 'AS' + v6info.asn + ' ' : '') + (v6info.org || ''));

    if (!d.vpn) {
      return result('ipv6', 'IPv6', 'info', lines,
        'Your device has a working IPv6 address. Sites that support IPv6 can reach you on it.');
    }
    if (!v4) {
      return result('ipv6', 'IPv6', 'pass', lines,
        'IPv6 is the only address this test could see, so there is nothing to compare it with. The Public IP row covers it.');
    }
    var same = compareNetworks(v6info, infoOf(v4));
    if (same === true) {
      return result('ipv6', 'IPv6', 'pass', lines,
        'Your IPv6 address is on the same network as your IPv4 address, so it is not going around your VPN.');
    }
    if (same === false) {
      return result('ipv6', 'IPv6', 'fail', lines,
        'Your IPv6 address belongs to a different network than your IPv4 address. IPv6 traffic is leaving outside your VPN tunnel.');
    }
    return result('ipv6', 'IPv6', 'warn', lines,
      'Your device has an IPv6 address, but the lookup that says whose network it is failed. Compare it with the network under Public IP.');
  }

  // Resolver networks that anyone can choose. Seeing one of these does not show whose choice it was.
  var PUBLIC_DNS_ASN = { 15169: 'Google', 13335: 'Cloudflare', 19281: 'Quad9', 36692: 'Cisco OpenDNS' };

  function dnsLine(r) {
    var net = (r.asn ? 'AS' + r.asn + ' ' : '') + (r.org || '');
    return r.ip + (net.trim() ? ' (' + net.trim() + ')' : '');
  }

  /* d.dns = { status: 'ok' | 'none' | 'unavailable', resolvers: [{ ip, asn, org }] }
     d.baseline = resolvers seen earlier in this tab with the VPN box unticked, or null. */
  function checkDNS(d) {
    var x = d.dns;
    if (!x || x.status === 'unavailable') {
      return result('dns', 'DNS', 'na', ['Not tested'],
        'The DNS test service did not respond, so this check did not run. The other checks are not affected.');
    }
    var list = x.resolvers || [];
    if (!list.length) {
      return result('dns', 'DNS', 'warn', ['No DNS lookups reached our server'],
        'Your lookups may have been blocked, cached or sent through a path that did not finish in time. Run the test again. If it repeats, this check could not tell you anything.');
    }
    var lines = list.map(dnsLine);
    if (!d.vpn) {
      return result('dns', 'DNS', 'info', lines,
        'These resolvers answered for this browser. Run the test again with a VPN on and the box ticked to compare. The test keeps this result in this tab only.', { resolvers: list });
    }
    var who = d.who || {};
    var exit = { asn: who.asn, org: who.asOrganization };
    var seen = {};
    (d.baseline || []).forEach(function (b) { if (!PUBLIC_DNS_ASN[b.asn]) { seen['ip:' + normalizeIP(b.ip)] = 1; if (b.asn) seen['as:' + b.asn] = 1; } });

    var sameAsBefore = list.filter(function (r) { return !PUBLIC_DNS_ASN[r.asn] && (seen['ip:' + normalizeIP(r.ip)] || (r.asn && seen['as:' + r.asn])); });
    if (sameAsBefore.length) {
      return result('dns', 'DNS', 'fail', lines,
        'A resolver that answered without your VPN is answering with it on. Your DNS lookups still go to that network, which tells it every site you visit.', { resolvers: list });
    }
    var unknown = list.filter(function (r) { return !r.asn && !r.org; });
    if (unknown.length) {
      return result('dns', 'DNS', 'warn', lines,
        'The lookup that names the resolver networks failed for at least one resolver, so this test cannot say whose they are. Run it again, or compare with a run without the VPN.', { resolvers: list });
    }
    var inExit = function (r) { return compareNetworks(r, exit) === true; };
    if (list.every(inExit)) {
      return result('dns', 'DNS', 'pass', lines,
        'Every resolver is on the same network as your exit address, so lookups are answered inside your VPN or proxy network.', { resolvers: list });
    }
    if (list.every(function (r) { return inExit(r) || PUBLIC_DNS_ASN[r.asn]; })) {
      return result('dns', 'DNS', 'info', lines,
        'A public resolver answered. That is fine if your VPN or you chose it. This test cannot tell whether your VPN or your device made that choice.', { resolvers: list });
    }
    return result('dns', 'DNS', 'warn', lines,
      'A resolver on a different network than your exit answered. That is normal if it belongs to your VPN provider and a leak if it is your internet provider. Run the test once with the box unticked and once with it ticked to compare.', { resolvers: list });
  }

  function checkTimezone(d) {
    var who = d.who;
    var tz = d.tz || {};
    if (!who || !who.timezone || !tz.browser) {
      return result('tz', 'Time zone', 'na', ['No time zone for your IP'],
        'The lookup did not return a time zone for your IP address.');
    }
    var lines = [
      'Browser: ' + tz.browser + ' (' + formatOffset(tz.browserOffsetMin) + ')',
      'Your IP: ' + who.timezone + ' (' + formatOffset(tz.ipOffsetMin) + ')',
    ];
    var same = tz.browserOffsetMin === tz.ipOffsetMin;
    if (same) {
      return result('tz', 'Time zone', 'pass', lines,
        'Your browser clock and your IP address point to the same time zone.');
    }
    if (!d.vpn) {
      return result('tz', 'Time zone', 'info', lines,
        'Your browser clock and your IP address point to different time zones.');
    }
    return result('tz', 'Time zone', 'warn', lines,
      'Your browser reports a different time zone than your IP address. Fraud checks read that mismatch as a sign you are hiding your location. It is a signal, not proof of a leak.');
  }

  function parseAcceptLanguageRegion(value) {
    if (!value) return null;
    var first = value.split(',')[0].trim();
    var m = first.match(/^[a-zA-Z]{2,3}[-_]([a-zA-Z]{2})\b/);
    return m ? m[1].toUpperCase() : null;
  }

  function checkHeaders(d) {
    var who = d.who;
    if (!who || !who.headers) {
      return result('headers', 'Request headers', 'na', ['No headers returned'],
        'The lookup that echoes your request headers failed.');
    }
    var h = who.headers;
    var lines = [];
    var proxyHints = [];
    if (h.via) proxyHints.push('Via: ' + h.via);
    if (h.forwarded) proxyHints.push('Forwarded: ' + h.forwarded);
    if (h['x-forwarded-for'] && h['x-forwarded-for'].split(',').map(function (s) { return s.trim(); }).filter(Boolean).length > 1) {
      proxyHints.push('X-Forwarded-For: ' + h['x-forwarded-for']);
    }
    proxyHints.forEach(function (p) { lines.push(p); });
    var region = parseAcceptLanguageRegion(h['accept-language']);
    var langLine = h['accept-language'] ? 'Accept-Language: ' + h['accept-language'].split(',')[0].trim() : null;
    var langMismatch = !!(region && who.country && region !== who.country.toUpperCase());
    if (langLine) lines.push(langLine);
    if (h['sec-ch-ua-platform']) lines.push('Platform: ' + h['sec-ch-ua-platform'].replace(/"/g, ''));
    if (!lines.length) lines.push('No identifying headers');

    if (proxyHints.length) {
      return result('headers', 'Request headers', 'warn', lines,
        'Your request carried headers that proxies add. They tell the site a proxy is in the path, and sometimes your original address. Your host or network may also add them.');
    }
    if (langMismatch && d.vpn) {
      return result('headers', 'Request headers', 'info', lines,
        'Your language preference (' + region + ') differs from your IP country (' + who.country + '). It is a weak signal some fraud systems use. No proxy headers were found.');
    }
    return result('headers', 'Request headers', 'pass', lines,
      'No proxy headers reached the server.');
  }

  // ---- whole run ---------------------------------------------------------------------------------------------------

  function analyze(d) {
    var checks = [checkPublicIP(d), checkWebRTC(d), checkIPv6(d), checkDNS(d), checkTimezone(d), checkHeaders(d)];
    var count = { pass: 0, warn: 0, fail: 0, info: 0, na: 0 };
    checks.forEach(function (c) { count[c.status]++; });

    var headline;
    if (count.fail) headline = count.fail + (count.fail === 1 ? ' leak found' : ' leaks found');
    else if (count.warn) headline = 'No leak confirmed, ' + count.warn + (count.warn === 1 ? ' thing' : ' things') + ' to check';
    else if (!d.vpn) headline = 'Here is what websites see';
    else headline = 'No leaks found in ' + (count.pass + count.info) + ' checks';
    if (checks[0].status === 'na') headline = 'The test could not read your connection';

    var web = checks[0];
    var diagram = {
      exit: {
        ip: (d.who && d.who.ip) || d.v4 || d.v6 || null,
        place: place(d.who),
        network: networkName(d.who),
      },
      browser: {
        tz: d.tz && d.tz.browser || null,
        lang: d.who && d.who.headers && d.who.headers['accept-language']
          ? d.who.headers['accept-language'].split(',')[0].trim() : null,
      },
      leaks: [],
    };
    var wr = checks[1];
    if (wr.status === 'fail') (wr.leaks || []).forEach(function (a) { diagram.leaks.push({ kind: 'WebRTC', value: a }); });
    var v6r = checks[2];
    if (v6r.status === 'fail') diagram.leaks.push({ kind: 'IPv6', value: d.v6 || (d.who && d.who.ip) });
    var dnsr = checks[3];
    if (dnsr.status === 'fail') (dnsr.resolvers || []).forEach(function (r) { diagram.leaks.push({ kind: 'DNS', value: r.ip }); });
    void web;

    return { checks: checks, count: count, headline: headline, diagram: diagram };
  }

  return {
    analyze: analyze,
    parseCandidate: parseCandidate,
    normalizeIP: normalizeIP,
    isPrivateAddress: isPrivateAddress,
    looksLikeHosting: looksLikeHosting,
    tzOffsetMinutes: tzOffsetMinutes,
    formatOffset: formatOffset,
    isIPv6: isIPv6,
    lookupTarget: lookupTarget,
    compareNetworks: compareNetworks,
  };
});
