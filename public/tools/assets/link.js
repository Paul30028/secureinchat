/* Link checker: tracking-parameter removal and local warning signs. Pure functions, no network.
   Loaded by the page and by the Node tests. These are heuristics: a clean result is not proof a link is safe. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.LK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TRACK_EXACT = ['fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'gclsrc', 'msclkid', 'mc_eid', 'mc_cid', 'igshid', 'igsh', 'twclid', 'ttclid', 'yclid', 'li_fat_id',
    '_hsenc', '_hsmi', '__hstc', '__hssc', '__hsfp', 'hsctatracking', 'mkt_tok', 'oly_enc_id', 'oly_anon_id', 'vero_id', 'vero_conv', 'rb_clickid', 's_cid', 'srsltid',
    'epik', 'pk_campaign', 'pk_kwd', 'pk_source', 'pk_medium', 'piwik_campaign', 'piwik_kwd', 'mtm_campaign', 'mtm_source', 'mtm_medium', 'wickedid', 'sc_cid', 'ncid', 'cmpid', 'spm', 'scm'];
  var TRACK_PREFIX = ['utm_', 'ga_', 'hsa_', 'pk_', 'mtm_'];
  var SHORTENERS = ['bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at', 'tiny.cc', 'rb.gy', 't.ly', 'lnkd.in', 'trib.al', 'bl.ink', 's.id', 'v.gd', 'qr.co', 'shorte.st', 'adf.ly'];
  var BRANDS = ['paypal', 'apple', 'icloud', 'microsoft', 'office365', 'outlook', 'google', 'gmail', 'amazon', 'netflix', 'facebook', 'instagram', 'whatsapp', 'telegram', 'dhl', 'fedex', 'ups', 'usps', 'royalmail', 'chase', 'wellsfargo', 'bankofamerica', 'hsbc', 'barclays', 'coinbase', 'binance', 'metamask', 'docusign', 'dropbox', 'linkedin', 'steam', 'roblox'];
  var REDIRECT_KEYS = ['url', 'u', 'redirect', 'redirect_uri', 'redirect_url', 'redir', 'next', 'target', 'dest', 'destination', 'continue', 'return', 'returnurl', 'goto', 'out', 'link', 'q'];
  var TWO_PART = ['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.jp', 'ne.jp', 'or.jp', 'com.br', 'com.cn', 'com.hk', 'com.sg', 'com.tw', 'co.nz', 'co.za', 'com.mx', 'co.in', 'co.kr', 'com.tr', 'com.ar'];

  function isTracking(key) {
    var k = key.toLowerCase();
    if (TRACK_EXACT.indexOf(k) >= 0) return true;
    for (var i = 0; i < TRACK_PREFIX.length; i++) if (k.indexOf(TRACK_PREFIX[i]) === 0) return true;
    return false;
  }

  // RFC 3492 punycode decoding of a single label (without the xn-- prefix).
  function punyDecode(input) {
    var base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700, n = 128, i = 0, bias = 72, out = [];
    var b = input.lastIndexOf('-');
    if (b > 0) for (var j = 0; j < b; j++) out.push(input.charCodeAt(j));
    var pos = b > 0 ? b + 1 : 0;
    function adapt(delta, num, first) {
      var k = 0; delta = first ? Math.floor(delta / damp) : delta >> 1; delta += Math.floor(delta / num);
      for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
      return Math.floor(k + (base - tMin + 1) * delta / (delta + skew));
    }
    while (pos < input.length) {
      var oldi = i, w = 1;
      for (var k = base; ; k += base) {
        if (pos >= input.length) return null;
        var c = input.charCodeAt(pos++);
        var digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
        if (digit >= base) return null;
        i += digit * w;
        var t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
        if (digit < t) break;
        w *= base - t;
      }
      bias = adapt(i - oldi, out.length + 1, oldi === 0);
      n += Math.floor(i / (out.length + 1)); i %= out.length + 1;
      out.splice(i++, 0, n);
    }
    return String.fromCodePoint.apply(null, out);
  }
  function unicodeHost(host) {
    return host.split('.').map(function (l) { return l.indexOf('xn--') === 0 ? (punyDecode(l.slice(4)) || l) : l; }).join('.');
  }
  function registrable(host) {
    var p = host.split('.');
    if (p.length <= 2) return host;
    var last2 = p.slice(-2).join('.');
    return TWO_PART.indexOf(last2) >= 0 ? p.slice(-3).join('.') : last2;
  }
  function isIp(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[[0-9a-f:.]+\]$/i.test(host) || /^0x[0-9a-f]+$/i.test(host) || /^\d{8,10}$/.test(host);
  }

  function parse(raw) {
    var s = String(raw || '').trim();
    if (!s) return { error: 'empty' };
    if (/^(javascript|data|vbscript):/i.test(s)) return { error: 'script', scheme: s.split(':')[0].toLowerCase() };
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
    var u;
    try { u = new URL(s); } catch (e) { return { error: 'invalid' }; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'scheme', scheme: u.protocol.replace(':', '') };
    return { url: u, input: s };
  }

  function check(raw) {
    var p = parse(raw);
    if (p.error) return { error: p.error, scheme: p.scheme, findings: [], removed: [], clean: '' };
    var u = p.url, findings = [], removed = [];
    var host = u.hostname.toLowerCase();
    var uhost = unicodeHost(host);
    var reg = registrable(host);
    var regLabel = reg.split('.')[0];

    // tracking parameters
    var keep = [];
    u.searchParams.forEach(function (v, k) { if (isTracking(k)) removed.push(k); else keep.push([k, v]); });
    var cleanUrl = new URL(u.href);
    cleanUrl.search = '';
    cleanUrl.username = ''; cleanUrl.password = '';
    keep.forEach(function (kv) { cleanUrl.searchParams.append(kv[0], kv[1]); });
    var clean = cleanUrl.href;
    if (removed.length) findings.push({ id: 'tracking', level: 'warn', detail: removed.join(', ') });

    if (u.username || u.password) findings.push({ id: 'userinfo', level: 'fail', detail: (u.username ? decodeURIComponent(u.username) : '') + '@' + host });
    if (isIp(host)) findings.push({ id: 'ip', level: 'warn', detail: host });
    if (uhost !== host) {
      var nonAscii = /[^\x00-\x7f]/.test(uhost);
      findings.push({ id: 'punycode', level: nonAscii ? 'fail' : 'warn', detail: host + ' → ' + uhost });
    }
    if (u.protocol === 'http:') findings.push({ id: 'http', level: 'warn', detail: 'http://' + host });
    if (u.port && u.port !== '80' && u.port !== '443') findings.push({ id: 'port', level: 'warn', detail: ':' + u.port });
    if (SHORTENERS.indexOf(host) >= 0 || SHORTENERS.indexOf(host.replace(/^www\./, '')) >= 0) findings.push({ id: 'shortener', level: 'warn', detail: host });

    var tokens = (host + u.pathname).toLowerCase().split(/[-_.\/]+/);
    var brand = null;
    for (var i = 0; i < BRANDS.length && !brand; i++) {
      if (regLabel === BRANDS[i]) continue;
      if (tokens.indexOf(BRANDS[i]) >= 0) brand = BRANDS[i];
    }
    if (brand) findings.push({ id: 'brand', level: 'fail', detail: brand + ' appears, but the site is ' + reg });

    var labels = host.split('.').length;
    if (labels >= 5) findings.push({ id: 'subdomains', level: 'warn', detail: labels + ' parts: ' + host });

    var embedded = null;
    u.searchParams.forEach(function (v, k) {
      if (embedded) return;
      if (REDIRECT_KEYS.indexOf(k.toLowerCase()) >= 0 && /^(https?:\/\/|%2f%2f|\/\/)/i.test(v)) embedded = v;
    });
    if (embedded) findings.push({ id: 'redirect', level: 'warn', detail: embedded.slice(0, 160) });
    if (u.href.length > 200) findings.push({ id: 'long', level: 'info', detail: u.href.length + ' characters' });

    return { findings: findings, removed: removed, clean: clean, host: host, unicodeHost: uhost, site: reg };
  }

  var LABELS = {
    tracking: ['Tracking parameters', 'These tell the sender or an ad network that you clicked. Removing them does not change where the link goes.'],
    userinfo: ['Text before an @ in the address', 'Everything before the @ is ignored by the browser. A link like paypal.com@example.net goes to example.net. A classic trick.'],
    ip: ['Raw IP address instead of a name', 'Legitimate services rarely send links to a bare IP address.'],
    punycode: ['International characters in the name', 'Letters from other alphabets can imitate a familiar name. Compare it with the real address character by character.'],
    http: ['Not encrypted (http)', 'What you send on this page can be read or changed on the way.'],
    port: ['Unusual port', 'Normal websites use the default port. An explicit port is uncommon for public sites.'],
    shortener: ['Link shortener', 'The real destination is hidden. Ask the sender for the full link, or open it only if you trust them.'],
    brand: ['Brand name on a different site', 'The name of a well-known company appears in the link, but the site that will open is someone else\'s.'],
    subdomains: ['Many subdomains', 'Long chains of names can push the real site out of view on a phone screen.'],
    redirect: ['Hidden second destination', 'The link carries another address and may forward you there.'],
    long: ['Very long link', 'Long links can hide the real site name. Not a warning on its own.'],
  };

  return { check: check, isTracking: isTracking, punyDecode: punyDecode, unicodeHost: unicodeHost, registrable: registrable, LABELS: LABELS };
});
