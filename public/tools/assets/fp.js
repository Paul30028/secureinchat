/* Browser fingerprint test. Reads what this browser exposes to any page. Nothing is sent anywhere or stored. */
(function () {
  'use strict';
  var btn = document.getElementById('run');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');

  function row(name, desc, status, label, lines, why) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-status', status);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = name;
    var d = document.createElement('span'); d.className = 'c-desc'; d.textContent = desc;
    th.appendChild(n); th.appendChild(d);
    var td = document.createElement('td'); td.setAttribute('data-label', 'Result');
    var vals = document.createElement('div'); vals.className = 'vals';
    lines.forEach(function (l) { var v = document.createElement('div'); v.className = 'val mono'; v.textContent = l; vals.appendChild(v); });
    td.appendChild(vals);
    var p = document.createElement('p'); p.className = 'why'; p.textContent = why || ''; td.appendChild(p);
    var ts = document.createElement('td'); ts.setAttribute('data-label', 'Status');
    var pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = label; ts.appendChild(pill);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function sha(str) {
    if (!window.crypto || !crypto.subtle) return Promise.resolve(String(str.length));
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

  function canvasRow() {
    var a, b, blank;
    try { a = drawCanvas(); b = drawCanvas(); blank = blankCanvas(); } catch (e) { a = null; }
    if (!a || a === blank) return Promise.resolve(row('Canvas', 'How your browser draws text and shapes.', 'ok', 'Blocked', ['Canvas returned no image'], 'The browser or an extension blocked canvas reading, so this signal is hidden.'));
    if (a !== b) return Promise.resolve(row('Canvas', 'How your browser draws text and shapes.', 'ok', 'Randomized', ['Two identical drawings gave different results'], 'Your browser adds noise to canvas output, so this signal cannot be used to recognise you across sites.'));
    return sha(a).then(function (h) {
      return row('Canvas', 'How your browser draws text and shapes.', 'warn', 'Stable', ['Hash ' + h + ' (same on every draw)'], 'Sites can combine this with other signals to tell you apart. Compare the hash in another browser: different values mean it identifies your setup.');
    });
  }

  function webglRow() {
    var r = null;
    try {
      var gl = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl');
      if (gl) {
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) r = [gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)];
      }
    } catch (e) { r = null; }
    if (!r) return row('Graphics card', 'GPU name that WebGL can report.', 'ok', 'Hidden', ['No GPU name exposed'], 'Your browser does not tell pages which GPU you have.');
    return row('Graphics card', 'GPU name that WebGL can report.', 'warn', 'Exposed', [String(r[0]), String(r[1])], 'The exact GPU model is a strong signal when combined with others.');
  }

  function signalRow() {
    var n = navigator, s = window.screen || {};
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }
    var lines = [
      'User agent: ' + n.userAgent,
      'Platform: ' + (n.platform || 'unknown'),
      'Languages: ' + ((n.languages && n.languages.join(', ')) || n.language || 'unknown'),
      'Time zone: ' + (tz || 'unknown'),
      'Screen: ' + s.width + 'x' + s.height + ', ' + s.colorDepth + '-bit, ratio ' + window.devicePixelRatio,
      'CPU threads: ' + (n.hardwareConcurrency || 'hidden'),
      'Device memory: ' + (n.deviceMemory ? n.deviceMemory + ' GB' : 'hidden'),
      'Touch points: ' + (n.maxTouchPoints || 0)
    ];
    return row('Browser and device', 'Details every page can read without asking.', 'info', 'Visible', lines, 'None of these identifies you alone. Together they narrow you down, and values that are rare for your browser narrow you down most.');
  }

  function gpcRow() {
    if (navigator.globalPrivacyControl === true) return row('Global Privacy Control', 'A signal that tells sites not to sell or share your data.', 'ok', 'Sent', ['Your browser sends GPC'], 'Sites in places where GPC is legally recognised must treat it as an opt-out request.');
    return row('Global Privacy Control', 'A signal that tells sites not to sell or share your data.', 'warn', 'Not sent', ['Your browser does not send GPC'], 'Firefox, Brave and DuckDuckGo browsers can send it. Some browsers need an extension.');
  }

  function dntRow() {
    var on = navigator.doNotTrack === '1' || window.doNotTrack === '1';
    return row('Do Not Track', 'An older opt-out header.', 'info', on ? 'On' : 'Off', [on ? 'DNT is set to 1' : 'DNT is not set'], 'Most sites ignore it. Turning it on can even make you easier to tell apart, because few people do.');
  }

  function cookieRow() {
    var on = navigator.cookieEnabled;
    return row('Cookies', 'Whether this browser accepts them.', 'info', on ? 'Enabled' : 'Disabled', [on ? 'Cookies are enabled' : 'Cookies are disabled'], 'This page sets none.');
  }

  function run() {
    btn.disabled = true; btn.textContent = 'Testing...';
    canvasRow().then(function (cv) {
      var rows = [cv, webglRow(), gpcRow(), dntRow(), cookieRow(), signalRow()];
      tbody.textContent = '';
      var warn = 0;
      rows.forEach(function (r) { if (r.getAttribute('data-status') === 'warn') warn++; tbody.appendChild(r); });
      summary.textContent = warn ? warn + ' of 6 checks give sites something to recognise you by.' : 'Nothing here makes you easier to recognise than usual.';
      summary.setAttribute('data-tone', warn ? 'warn' : 'ok');
    }).catch(function () {
      summary.textContent = 'The test could not finish.'; summary.setAttribute('data-tone', 'fail');
    }).then(function () { btn.disabled = false; btn.textContent = 'Run again'; });
  }
  btn.addEventListener('click', run);
})();
