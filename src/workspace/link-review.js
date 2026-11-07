/* Local link structure review for the private workspace.
   Pure functions: no DOM, no network, no storage, and it never opens or contacts the URL.
   It reports what the text looks like. It cannot tell whether a destination is safe. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WSLink = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMIT = 8192;

  var TRACK_EXACT = [
    'fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'gclsrc', 'msclkid', 'mc_eid', 'mc_cid',
    'igshid', 'igsh', 'twclid', 'ttclid', 'yclid', 'li_fat_id', '_hsenc', '_hsmi', '__hstc',
    '__hssc', '__hsfp', 'hsctatracking', 'mkt_tok', 'oly_enc_id', 'oly_anon_id', 'vero_id',
    'vero_conv', 'rb_clickid', 's_cid', 'srsltid', 'epik', 'piwik_campaign', 'piwik_kwd',
    'wickedid', 'sc_cid', 'ncid', 'cmpid', 'spm', 'scm', 'ref_src', 'ref_url', '_ga', '_gl'
  ];
  var TRACK_PREFIX = ['utm_', 'ga_', 'hsa_', 'pk_', 'mtm_'];

  var NON_WEB = [
    'mailto', 'tel', 'sms', 'smsto', 'mms', 'callto', 'facetime', 'facetime-audio', 'sip',
    'sips', 'xmpp', 'geo', 'magnet', 'bitcoin', 'ethereum', 'news', 'urn', 'about', 'blob',
    'intent', 'market', 'itms-services', 'skype', 'whatsapp', 'tg', 'webcal'
  ];

  var SENSITIVE_RE = /token|session|auth|secret|passw|credential|signature|jwt|bearer|otp|mfa|sso|ticket|csrf|xsrf|login|email|phone|userid|user_id|user_name|username|account|uid|sid|nonce|remember/i;

  function isTracking(key) {
    var k = String(key).toLowerCase();
    if (TRACK_EXACT.indexOf(k) >= 0) return true;
    for (var i = 0; i < TRACK_PREFIX.length; i++) if (k.indexOf(TRACK_PREFIX[i]) === 0) return true;
    return false;
  }

  function isSensitive(key) {
    var k = String(key);
    if (SENSITIVE_RE.test(k)) return true;
    if (/^(?:key|code|state|sig|user)$/i.test(k)) return true;
    if (/[-_](?:key|code|state)$/i.test(k)) return true;
    return false;
  }

  function isIp(host) {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || /^\[[0-9a-f:.]+\]$/i.test(host);
  }

  function unique(list) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      var k = list[i].toLowerCase();
      if (Object.prototype.hasOwnProperty.call(seen, k)) continue;
      seen[k] = true;
      out.push(list[i]);
    }
    return out;
  }

  function parse(raw) {
    var s = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!s) return { error: 'empty' };
    if (s.length > LIMIT) return { error: 'too-long' };
    if (/[\u0000-\u001F\u007F]/.test(s)) return { error: 'control' };
    if (/^(?:javascript|data|vbscript|file):/i.test(s)) {
      return { error: 'scheme', scheme: s.split(':')[0].toLowerCase() };
    }

    var candidate = s, addedScheme = false;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      var schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(s);
      if (schemeMatch) {
        var name = schemeMatch[1].toLowerCase();
        if (NON_WEB.indexOf(name) >= 0) return { error: 'scheme', scheme: name };
        // host:port and user:password@host look like a scheme only because of the colon.
        if (!/^[a-z][a-z0-9+.-]*:\d+(?:[/?#]|$)/i.test(s) && !/^[^/]+:[^/]*@/.test(s)) {
          return { error: 'scheme', scheme: name };
        }
      }
      candidate = /^\/\//.test(s) ? 'https:' + s : 'https://' + s;
      addedScheme = true;
    }

    var u;
    try { u = new URL(candidate); } catch (e) { return { error: 'invalid' }; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { error: 'scheme', scheme: u.protocol.replace(':', '') };
    }
    if (!u.hostname) return { error: 'host' };
    return { url: u, input: s, addedScheme: addedScheme };
  }

  function messageFor(error, scheme) {
    if (error === 'empty') return 'Paste a link first.';
    if (error === 'too-long') return 'That input is too long to inspect here. The limit is ' + LIMIT.toLocaleString('en-US') + ' characters.';
    if (error === 'control') return 'The input contains control characters. Paste a single web address.';
    if (error === 'scheme') return 'This page inspects http and https links only. It does not open or inspect ' + (scheme ? scheme + ':' : 'other') + ' links.';
    if (error === 'host') return 'The link has no host name.';
    return 'That does not parse as a web link. Check for spaces, a missing host, or a broken address.';
  }

  function analyze(raw) {
    var p = parse(raw);
    if (p.error) return { ok: false, error: p.error, scheme: p.scheme || '', message: messageFor(p.error, p.scheme), flags: [], query: [], trackingKeys: [], sensitiveKeys: [], copyAllowed: false };
    try {
      var u = p.url;
      var scheme = u.protocol.replace(':', '');
      var hostname = u.hostname.toLowerCase();
      var host = u.host;
      var path = u.pathname || '/';
      var hasUserinfo = !!(u.username || u.password);
      var query = [];
      u.searchParams.forEach(function (value, key) {
        query.push({ key: key, value: value, tracking: isTracking(key), sensitive: isSensitive(key) });
      });

      var trackingKeys = unique(query.filter(function (q) { return q.tracking; }).map(function (q) { return q.key; }));
      var sensitiveKeys = unique(query.filter(function (q) { return q.sensitive; }).map(function (q) { return q.key; }));
      var fragmentSensitive = !!u.hash && /(?:access[_-]?token|token|session[_-]?id|session|auth|secret|password|passwd|pwd|api[_-]?key|key|jwt|bearer|otp|mfa|sso|ticket|csrf|xsrf|email|phone|user[_-]?id|uid|sid)=/i.test(u.hash.slice(1));

      var clean = new URL(u.href);
      clean.search = '';
      for (var i = 0; i < query.length; i++) {
        if (!query[i].tracking) clean.searchParams.append(query[i].key, query[i].value);
      }
      var cleanUrl = clean.href;
      var changed = cleanUrl !== u.href;

      var flags = [];
      if (trackingKeys.length) flags.push({ id: 'tracking', level: 'warn', label: 'Common tracking parameters', detail: trackingKeys.join(', ') });
      if (sensitiveKeys.length) flags.push({ id: 'sensitive', level: 'alert', label: 'Keys that often carry session or identity data', detail: sensitiveKeys.join(', ') });
      if (hasUserinfo) flags.push({ id: 'userinfo', level: 'alert', label: 'Text before an @ in the address', detail: 'Text before @ is sent to the site. The host is ' + hostname + '.' });
      if (scheme === 'http') flags.push({ id: 'http', level: 'warn', label: 'Not encrypted in transit (http)', detail: 'The connection is not encrypted. This page cannot tell whether the destination is trustworthy.' });
      if (isIp(hostname)) flags.push({ id: 'ip', level: 'warn', label: 'Raw IP address instead of a name', detail: hostname });
      if (hostname.indexOf('xn--') >= 0) flags.push({ id: 'punycode', level: 'warn', label: 'Internationalized host name', detail: 'The host uses xn-- encoding. Compare it character by character with the name you expect.' });
      if (u.port && u.port !== '80' && u.port !== '443') flags.push({ id: 'port', level: 'warn', label: 'Non-default port', detail: ':' + u.port });
      if (u.hash) flags.push({ id: 'fragment', level: 'info', label: 'Fragment present', detail: 'Text after # is usually not sent to the server, but it can still contain data.' });
      if (fragmentSensitive) flags.push({ id: 'fragment-sensitive', level: 'alert', label: 'Fragment has a session-like name', detail: 'The part after # is not shown here. It may carry session or identity data.' });
      if (u.href.length > 500) flags.push({ id: 'long', level: 'info', label: 'Very long link', detail: u.href.length + ' characters' });

      var copyAllowed = trackingKeys.length > 0 && sensitiveKeys.length === 0 && !fragmentSensitive && !hasUserinfo && changed;
      return {
        ok: true,
        input: p.input,
        addedScheme: p.addedScheme,
        scheme: scheme,
        host: host,
        hostname: hostname,
        port: u.port,
        path: path,
        query: query,
        queryCount: query.length,
        trackingKeys: trackingKeys,
        sensitiveKeys: sensitiveKeys,
        fragmentSensitive: fragmentSensitive,
        fragment: u.hash ? u.hash.slice(1) : '',
        hasUserinfo: hasUserinfo,
        cleanUrl: cleanUrl,
        changed: changed,
        copyAllowed: copyAllowed,
        flags: flags
      };
    } catch (e) {
      return { ok: false, error: 'invalid', message: messageFor('invalid'), flags: [], query: [], trackingKeys: [], sensitiveKeys: [], copyAllowed: false };
    }
  }

  return {
    LIMIT: LIMIT,
    analyze: analyze,
    isTracking: isTracking,
    isSensitive: isSensitive
  };
});
