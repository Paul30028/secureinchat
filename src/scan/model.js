/* Unified exposure-scan result model.
   Pure functions: no DOM, no network, no storage. Used by the page and by Node tests.
   One result has exactly these fields:
   { id, group: 'local'|'network', title, value, whoCanRead, risk: 'low'|'medium'|'high',
     howToReduce, source } */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScanModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GROUPS = ['local', 'network'];
  var RISKS = ['low', 'medium', 'high'];
  var FIELDS = ['id', 'group', 'title', 'value', 'whoCanRead', 'risk', 'howToReduce', 'source'];

  var RISK_LABEL = {
    high: 'Higher exposure',
    medium: 'Worth a look',
    low: 'Lower exposure'
  };
  var RISK_SYMBOL = { high: '\u25B2', medium: '\u25CF', low: '\u25CB' };
  var RISK_ORDER = ['high', 'medium', 'low'];

  // Static copy for the local probes. Values are filled in at scan time by probes.js.
  // whoCanRead deliberately says "scripts on a website you visit", not "only this page":
  // the same APIs are available to any site that runs JavaScript.
  var LOCAL_SPECS = [
    {
      id: 'timezone',
      title: 'Time zone',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'medium',
      howToReduce: 'Firefox and Brave can report a time zone other than your system one (privacy.resistFingerprinting in Firefox; Shields in Brave). A VPN does not change this value because it comes from the browser, not the connection.',
      source: 'Intl.DateTimeFormat().resolvedOptions().timeZone'
    },
    {
      id: 'languages',
      title: 'Language preferences',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'low',
      howToReduce: 'Keep one preferred language in your browser settings if you do not need several. This reduces detail but does not hide the remaining language, which sites also receive in the Accept-Language request header.',
      source: 'navigator.language, navigator.languages'
    },
    {
      id: 'screen',
      title: 'Screen, window and pixel ratio',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'medium',
      howToReduce: 'Browsers that resist fingerprinting round screen and window values (Firefox privacy.resistFingerprinting, Brave Shields). Maximising the window makes its size less distinctive, but the screen size itself is still reported.',
      source: 'screen.width, screen.height, screen.availWidth, screen.availHeight, window.innerWidth, window.innerHeight, devicePixelRatio'
    },
    {
      id: 'platform',
      title: 'Platform and user agent',
      whoCanRead: 'Scripts on any website you visit; the user agent is also sent in every HTTP request.',
      risk: 'medium',
      howToReduce: 'Use a browser that freezes or reduces the user agent (Firefox with resistFingerprinting, Brave). Avoid extensions that rewrite the user agent only for some sites: a rare value can stand out more than a common one.',
      source: 'navigator.userAgent, navigator.platform'
    },
    {
      id: 'hardware',
      title: 'CPU threads and device memory',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'low',
      howToReduce: 'These values are coarse and browsers often hide or round them. Firefox privacy.resistFingerprinting and Brave Shields can reduce or block them; there is no setting that removes the CPU count from every browser.',
      source: 'navigator.hardwareConcurrency, navigator.deviceMemory'
    },
    {
      id: 'canvas',
      title: 'Canvas drawing',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'medium',
      howToReduce: 'Brave randomises canvas output by default. Firefox with privacy.resistFingerprinting limits it, and extensions such as CanvasBlocker can add noise. A changed drawing may break some sites that use canvas for legitimate graphics.',
      source: 'Canvas 2D API: two identical drawings, compared locally; only a short hash is shown'
    },
    {
      id: 'webgl',
      title: 'WebGL renderer',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'medium',
      howToReduce: 'Brave and Firefox resistFingerprinting can hide or coarsen the renderer string. Turning off hardware acceleration changes it too, but costs performance and may not hide the software renderer name.',
      source: 'WebGL WEBGL_debug_renderer_info: UNMASKED_VENDOR_WEBGL, UNMASKED_RENDERER_WEBGL'
    },
    {
      id: 'fonts',
      title: 'Detectable fonts',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'medium',
      howToReduce: 'Keep the installed font set close to the default for your system, or use a browser that restricts font access (Firefox privacy.resistFingerprinting, Brave Shields). Uninstalling a few unusual fonts is a real reduction; the test only counts the fonts it probes.',
      source: 'Canvas measureText width comparison for a fixed list of 24 font names; only a count is shown'
    },
    {
      id: 'privacy-signals',
      title: 'Do Not Track and Global Privacy Control',
      whoCanRead: 'Scripts on any website you visit; both values can also be sent as request headers.',
      risk: 'low',
      howToReduce: 'Do Not Track is ignored by most sites and rare enough to add detail; leaving it off is a reasonable choice. Global Privacy Control is a legal opt-out signal in some places, so keep it on if you want that right exercised, and check your browser settings for it.',
      source: 'navigator.doNotTrack, window.doNotTrack, navigator.globalPrivacyControl'
    },
    {
      id: 'cookies',
      title: 'Cookie support',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'low',
      howToReduce: 'Blocking all cookies reduces tracking but breaks many sign-ins. Blocking third-party cookies in your browser settings is the narrower change; this page sets no cookie either way.',
      source: 'navigator.cookieEnabled'
    },
    {
      id: 'touch',
      title: 'Touch capability',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'low',
      howToReduce: 'This is a device-class signal and browsers do not offer a per-site switch for it. A browser that resists fingerprinting may normalise it; otherwise treat it as one more coarse detail rather than something you can hide alone.',
      source: 'navigator.maxTouchPoints, "ontouchstart" in window'
    },
    {
      id: 'color-scheme',
      title: 'Colour-scheme preference',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'low',
      howToReduce: 'This follows your operating-system light or dark setting and is usually shared by many people. Switching the OS theme changes the value; a browser setting that pins the preferred scheme also hides the change.',
      source: 'matchMedia("(prefers-color-scheme: dark)")'
    },
    {
      id: 'reduced-motion',
      title: 'Reduced-motion preference',
      whoCanRead: 'Scripts on any website you visit.',
      risk: 'low',
      howToReduce: 'This preference is set for accessibility and is shared by many users. Turning it off to avoid exposure would remove a useful accessibility setting, so it is not a change this page recommends.',
      source: 'matchMedia("(prefers-reduced-motion: reduce)")'
    }
  ];

  function isString(value) {
    return typeof value === 'string' && value.length > 0;
  }

  function makeResult(input) {
    if (!input || typeof input !== 'object') throw new TypeError('result must be an object');
    var out = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var key = FIELDS[i];
      if (!isString(input[key])) throw new TypeError('result.' + key + ' must be a non-empty string');
      out[key] = input[key];
    }
    if (GROUPS.indexOf(out.group) === -1) throw new TypeError('result.group must be local or network');
    if (RISKS.indexOf(out.risk) === -1) throw new TypeError('result.risk must be low, medium or high');
    return out;
  }

  function isResult(value) {
    try {
      makeResult(value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function riskLabel(risk) {
    return RISK_LABEL[risk] || '';
  }

  function riskSymbol(risk) {
    return RISK_SYMBOL[risk] || '';
  }

  // Groups results by risk, highest first. Empty groups are omitted.
  function groupByRisk(results) {
    var groups = [];
    for (var i = 0; i < RISK_ORDER.length; i++) {
      var risk = RISK_ORDER[i];
      var items = (results || []).filter(function (r) { return r && r.risk === risk; });
      if (items.length) groups.push({ risk: risk, label: riskLabel(risk), symbol: riskSymbol(risk), items: items });
    }
    return groups;
  }

  function summarize(results) {
    var counts = { local: 0, network: 0, low: 0, medium: 0, high: 0, total: 0 };
    (results || []).forEach(function (r) {
      if (!r) return;
      counts.total++;
      if (r.group === 'local' || r.group === 'network') counts[r.group]++;
      if (RISKS.indexOf(r.risk) !== -1) counts[r.risk]++;
    });
    return counts;
  }

  // A value the page could not read is not compared with a real value.
  function isComparable(value) {
    return typeof value === 'string' && value.length > 0 && !/^unavailable(?::|\s*$)/i.test(value);
  }

  function unavailable(reason) {
    return 'Unavailable: ' + (reason || 'not readable in this browser');
  }

  return {
    GROUPS: GROUPS,
    RISKS: RISKS,
    FIELDS: FIELDS,
    LOCAL_SPECS: LOCAL_SPECS,
    makeResult: makeResult,
    isResult: isResult,
    riskLabel: riskLabel,
    riskSymbol: riskSymbol,
    groupByRisk: groupByRisk,
    summarize: summarize,
    isComparable: isComparable,
    unavailable: unavailable
  };
});
