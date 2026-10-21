/* Browser signal checks shared by the fingerprint test and the privacy report.
   Reads what this browser exposes to any page. Nothing is sent anywhere or stored. */
(function (root) {
  'use strict';

  function check(id, name, desc, status, label, lines, why) {
    return { id: id, name: name, desc: desc, status: status, label: label, lines: lines, why: why || '' };
  }

  function sha(str) {
    if (!root.crypto || !crypto.subtle) return Promise.resolve(String(str.length));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').slice(0, 12);
    });
  }

  function drawCanvas() {
    var c = document.createElement('canvas'); c.width = 240; c.height = 60;
    var x = c.getContext('2d'); if (!x) return null;
    x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(110, 5, 70, 30);
    x.fillStyle = '#069'; x.fillText('Cwm fjordbank glyphs vext quiz', 4, 8);
    x.fillStyle = 'rgba(102,204,0,0.6)'; x.font = '18px Times'; x.fillText('Cwm fjordbank glyphs vext quiz', 6, 30);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgb(255,0,255)'; x.beginPath(); x.arc(50, 25, 20, 0, Math.PI * 2, true); x.fill();
    return c.toDataURL();
  }

  function blankCanvas() { var c = document.createElement('canvas'); c.width = 240; c.height = 60; try { return c.toDataURL(); } catch (e) { return null; } }

  var CANVAS = ['Canvas', 'How your browser draws text and shapes.'];

  function canvas() {
    var a, b, blank;
    try { a = drawCanvas(); b = drawCanvas(); blank = blankCanvas(); } catch (e) { a = null; }
    if (!a || a === blank) return Promise.resolve(check('canvas', CANVAS[0], CANVAS[1], 'ok', 'Blocked', ['Canvas returned no image'], 'The browser or an extension blocked canvas reading, so this signal is hidden.'));
    if (a !== b) return Promise.resolve(check('canvas', CANVAS[0], CANVAS[1], 'ok', 'Varies', ['Two identical drawings gave different results'], 'Your browser or an extension appears to add noise to canvas output. That would stop canvas from being a stable identifier. This test sees the difference but cannot confirm how it works.'));
    return sha(a).then(function (h) {
      return check('canvas', CANVAS[0], CANVAS[1], 'warn', 'Stable', ['Hash ' + h + ' (same on every draw)'], 'Sites can combine this with other signals to tell you apart. Compare the hash in another browser: different values mean it identifies your setup.');
    });
  }

  function webgl() {
    var r = null;
    try {
      var gl = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) r = [gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)];
      }
    } catch (e) { r = null; }
    if (!r) return check('webgl', 'Graphics card', 'GPU name that WebGL can report.', 'ok', 'Hidden', ['No GPU name exposed'], 'Your browser does not tell pages which GPU you have.');
    return check('webgl', 'Graphics card', 'GPU name that WebGL can report.', 'warn', 'Exposed', [String(r[0]), String(r[1])], 'The exact GPU model is a strong signal when combined with others.');
  }

  function signals() {
    var n = navigator, s = root.screen || {};
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }
    var lines = [
      'User agent: ' + n.userAgent,
      'Platform: ' + (n.platform || 'unknown'),
      'Languages: ' + ((n.languages && n.languages.join(', ')) || n.language || 'unknown'),
      'Time zone: ' + (tz || 'unknown'),
      'Screen: ' + s.width + 'x' + s.height + ', ' + s.colorDepth + '-bit, ratio ' + root.devicePixelRatio,
      'CPU threads: ' + (n.hardwareConcurrency || 'hidden'),
      'Device memory: ' + (n.deviceMemory ? n.deviceMemory + ' GB' : 'hidden'),
      'Touch points: ' + (n.maxTouchPoints || 0)
    ];
    return check('signals', 'Browser and device', 'Details every page can read without asking.', 'info', 'Visible', lines, 'None of these identifies you alone. Together they narrow you down, and values that are rare for your browser narrow you down most.');
  }

  function gpc() {
    var D = 'A signal that tells sites not to sell or share your data.';
    if (navigator.globalPrivacyControl === true) return check('gpc', 'Global Privacy Control', D, 'ok', 'Sent', ['Your browser sends GPC'], 'Sites in places where GPC is legally recognised must treat it as an opt-out request.');
    return check('gpc', 'Global Privacy Control', D, 'warn', 'Not sent', ['Your browser does not send GPC'], 'Firefox, Brave and DuckDuckGo browsers can send it. Some browsers need an extension.');
  }

  function dnt() {
    var on = navigator.doNotTrack === '1' || root.doNotTrack === '1';
    return check('dnt', 'Do Not Track', 'An older opt-out header.', 'info', on ? 'On' : 'Off', [on ? 'DNT is set to 1' : 'DNT is not set'], 'Most sites ignore it. Turning it on can even make you easier to tell apart, because few people do.');
  }

  function cookies() {
    var on = navigator.cookieEnabled;
    return check('cookies', 'Cookies', 'Whether this browser accepts them.', 'info', on ? 'Enabled' : 'Disabled', [on ? 'Cookies are enabled' : 'Cookies are disabled'], 'This page sets none.');
  }

  /* Resolves to the six checks in display order. */
  function collect() {
    return canvas().then(function (cv) { return [cv, webgl(), gpc(), dnt(), cookies(), signals()]; });
  }

  root.FPC = { collect: collect };
})(window);
