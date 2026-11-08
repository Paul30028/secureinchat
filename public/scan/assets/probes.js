/* Local probes for /scan/. No fetch, no XHR, no WebSocket, no beacon, no storage.
   Canvas drawing, WebGL renderer, GPC/DNT and cookie checks are adapted from
   public/tools/assets/fpcore.js so the site keeps one behaviour for those readings.
   Values are plain strings; a page script could read every one of them without asking. */
(function (root) {
  'use strict';
  var M = root.ScanModel;

  var FONT_LIST = [
    'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas',
    'Courier New', 'Georgia', 'Helvetica', 'Impact', 'Lucida Console', 'Menlo', 'Monaco',
    'Optima', 'Palatino', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
    'Verdana', 'Gill Sans', 'Noto Sans', 'Noto Serif'
  ];

  function sha(str) {
    if (!root.crypto || !crypto.subtle) return Promise.resolve(String(str.length));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) {
        return ('0' + x.toString(16)).slice(-2);
      }).join('').slice(0, 12);
    });
  }

  function drawCanvas() {
    var c = document.createElement('canvas');
    c.width = 240; c.height = 60;
    var x = c.getContext('2d');
    if (!x) return null;
    x.textBaseline = 'top';
    x.font = '16px Arial';
    x.fillStyle = '#f60';
    x.fillRect(110, 5, 70, 30);
    x.fillStyle = '#069';
    x.fillText('Cwm fjordbank glyphs vext quiz', 4, 8);
    x.fillStyle = 'rgba(102,204,0,0.6)';
    x.font = '18px Times';
    x.fillText('Cwm fjordbank glyphs vext quiz', 6, 30);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = 'rgb(255,0,255)';
    x.beginPath();
    x.arc(50, 25, 20, 0, Math.PI * 2, true);
    x.fill();
    return c.toDataURL();
  }

  function blankCanvas() {
    var c = document.createElement('canvas');
    c.width = 240; c.height = 60;
    try { return c.toDataURL(); } catch (e) { return null; }
  }

  function canvasProbe() {
    var a, b, blank;
    try {
      a = drawCanvas();
      b = drawCanvas();
      blank = blankCanvas();
    } catch (e) { a = null; }
    if (!a || a === blank) return Promise.resolve('Blocked: canvas returned no image (hidden by the browser or an extension)');
    if (a !== b) return Promise.resolve('Varies between two identical drawings: the browser or an extension appears to add noise');
    return sha(a).then(function (h) {
      return 'Stable drawing (short local hash ' + h + '); same on every draw';
    });
  }

  function webglProbe() {
    var r = null;
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) r = [gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)];
        if (!r) r = [gl.getParameter(gl.VENDOR), gl.getParameter(gl.RENDERER)];
      }
    } catch (e) { r = null; }
    if (!r) return 'Hidden: no WebGL renderer string exposed';
    return String(r[0]) + ' / ' + String(r[1]);
  }

  function fontCountProbe() {
    var c = document.createElement('canvas');
    var x = c.getContext('2d');
    if (!x) return M.unavailable('canvas text measurement is not available');
    var text = 'mmmmmmmmmmlli';
    function width(family) {
      x.font = '72px ' + family;
      return x.measureText(text).width;
    }
    var fallbackMono = width('monospace');
    var fallbackSerif = width('serif');
    var count = 0;
    FONT_LIST.forEach(function (name) {
      var quoted = '"' + name + '"';
      if (width(quoted + ', monospace') !== fallbackMono || width(quoted + ', serif') !== fallbackSerif) count++;
    });
    return count + ' of ' + FONT_LIST.length + ' tested font names detected';
  }

  function privacySignalsProbe() {
    var dnt = root.navigator.doNotTrack === '1' || root.doNotTrack === '1' ? 'On' : 'Off';
    var gpc = root.navigator.globalPrivacyControl === true ? 'Sent' : 'Not sent';
    return 'Do Not Track: ' + dnt + ' \u00B7 Global Privacy Control: ' + gpc;
  }

  function timezoneProbe() {
    try {
      var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
      var offset = -new Date().getTimezoneOffset();
      var sign = offset >= 0 ? '+' : '-';
      var hh = Math.floor(Math.abs(offset) / 60);
      var mm = Math.abs(offset) % 60;
      return zone + ' (UTC' + sign + ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2) + ')';
    } catch (e) {
      return M.unavailable('the browser did not return a time zone');
    }
  }

  function screenProbe() {
    var s = root.screen || {};
    return s.width + '\u00D7' + s.height + ' (available ' + s.availWidth + '\u00D7' + s.availHeight + '), window ' +
      root.innerWidth + '\u00D7' + root.innerHeight + ', pixel ratio ' + root.devicePixelRatio;
  }

  function platformProbe() {
    return 'User agent: ' + root.navigator.userAgent + ' \u00B7 Platform: ' + (root.navigator.platform || 'not reported');
  }

  function hardwareProbe() {
    var threads = root.navigator.hardwareConcurrency;
    var memory = root.navigator.deviceMemory;
    return 'CPU threads: ' + (threads ? threads : 'not reported') + ' \u00B7 Device memory: ' +
      (memory ? memory + ' GB' : 'not reported');
  }

  function languagesProbe() {
    var n = root.navigator;
    return (n.languages && n.languages.length ? n.languages.join(', ') : n.language) || 'not reported';
  }

  function touchProbe() {
    var points = root.navigator.maxTouchPoints || 0;
    return 'Max touch points: ' + points + ' \u00B7 Touch events: ' + ('ontouchstart' in root ? 'yes' : 'no');
  }

  function schemeProbe() {
    var q = root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)');
    return q && q.matches ? 'Dark' : 'Light';
  }

  function motionProbe() {
    var q = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)');
    return q && q.matches ? 'Reduce' : 'No preference';
  }

  var probes = {
    timezone: timezoneProbe,
    languages: languagesProbe,
    screen: screenProbe,
    platform: platformProbe,
    hardware: hardwareProbe,
    canvas: canvasProbe,
    webgl: webglProbe,
    fonts: fontCountProbe,
    'privacy-signals': privacySignalsProbe,
    cookies: function () { return root.navigator.cookieEnabled ? 'Enabled' : 'Disabled'; },
    touch: touchProbe,
    'color-scheme': schemeProbe,
    'reduced-motion': motionProbe
  };

  function valueFor(id) {
    var fn = probes[id];
    if (!fn) return Promise.resolve(M.unavailable('probe not implemented'));
    try {
      return Promise.resolve(fn());
    } catch (e) {
      return Promise.resolve(M.unavailable('the browser blocked this read'));
    }
  }

  root.ScanProbes = { ids: Object.keys(probes), valueFor: valueFor };
})(window);
