/* Photo metadata remover. Everything runs in this page: the file is read and re-encoded locally and never uploaded. */
(function () {
  'use strict';
  var E = window.EXIFR;
  var input = document.getElementById('file');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');
  var clean = document.getElementById('clean');
  var current = null;
  var MAX_BYTES = 40 * 1024 * 1024, MAX_PIXELS = 100 * 1000 * 1000;

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

  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function show(rows) { tbody.textContent = ''; rows.forEach(function (r) { tbody.appendChild(r); }); }

  function inspect(file) {
    current = null; clean.hidden = true;
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { summary.textContent = 'Only JPEG, PNG and WebP photos are supported here.'; summary.setAttribute('data-tone', 'fail'); show([]); return; }
    if (file.size > MAX_BYTES) { summary.textContent = 'That file is over 40 MB. Try a smaller one.'; summary.setAttribute('data-tone', 'fail'); show([]); return; }
    file.arrayBuffer().then(function (buf) {
      var r = E.parse(buf);
      var rows = [row('File', 'What you chose.', 'info', 'Info', [file.name, file.type + ', ' + fmtSize(file.size)])];
      if (r.kind === 'jpeg') {
        if (r.hasGPS) {
          var coords = r.gps ? r.gps.lat.toFixed(5) + ', ' + r.gps.lon.toFixed(5) : 'GPS block present';
          rows.push(row('Location', 'Where the photo was taken.', 'fail', 'Found', [coords], 'Anyone who gets this file can read these coordinates, usually accurate to a few metres.'));
        } else {
          rows.push(row('Location', 'Where the photo was taken.', 'pass', 'None found', ['No GPS data']));
        }
        var dev = r.fields.filter(function (f) { return /camera|lens|software|owner/i.test(f[0]); });
        var dates = r.fields.filter(function (f) { return /date/i.test(f[0]); });
        rows.push(dev.length ? row('Device', 'Camera, phone, software and owner.', 'warn', 'Found', dev.map(function (f) { return f[0] + ': ' + f[1]; }), 'These details can identify your device or you.')
                             : row('Device', 'Camera, phone, software and owner.', 'pass', 'None found', ['No device details']));
        rows.push(dates.length ? row('Dates', 'When the photo was taken or edited.', 'warn', 'Found', dates.map(function (f) { return f[0] + ': ' + f[1]; }), 'Dates show when you were somewhere.')
                               : row('Dates', 'When the photo was taken or edited.', 'pass', 'None found', ['No dates']));
        summary.textContent = r.found ? 'This photo carries metadata. Remove it before you share it.' : 'No readable metadata found. Cleaning is still safe.';
        summary.setAttribute('data-tone', r.found ? 'fail' : 'ok');
      } else {
        rows.push(row('Metadata', 'Hidden data inside the file.', 'warn', 'Not read', ['This page reads JPEG metadata only'], 'PNG, WebP and other formats can also hold metadata. Cleaning rewrites the file without it.'));
        summary.textContent = 'This format is not read here, but cleaning removes its metadata too.';
        summary.setAttribute('data-tone', 'warn');
      }
      show(rows);
      current = file; clean.hidden = false; clean.disabled = false; clean.textContent = 'Remove metadata and download';
    }).catch(function () { summary.textContent = 'Could not read that file.'; summary.setAttribute('data-tone', 'fail'); });
  }

  function outType(t) { return t === 'image/png' ? 'image/png' : t === 'image/webp' ? 'image/webp' : 'image/jpeg'; }
  function ext(t) { return t === 'image/png' ? 'png' : t === 'image/webp' ? 'webp' : 'jpg'; }

  function cleanFile() {
    if (!current) return;
    var file = current;
    clean.disabled = true; clean.textContent = 'Working...';
    createImageBitmap(file).then(function (bmp) {
      if (bmp.width * bmp.height > MAX_PIXELS) { bmp.close(); throw new Error('big'); }
      var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
      var type = outType(file.type);
      return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('encode')); }, type, 0.92); }).then(function (blob) {
        return blob.arrayBuffer().then(function (buf) {
          var again = E.parse(buf);
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = file.name.replace(/\.[^.]+$/, '') + '-clean.' + ext(type);
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
          var ok = type !== 'image/jpeg' || !again.found;
          summary.textContent = ok ? 'Done. The cleaned copy was saved to your downloads. Your original is unchanged.' : 'The cleaned copy still shows metadata. Do not share it.';
          summary.setAttribute('data-tone', ok ? 'ok' : 'fail');
          clean.disabled = false; clean.textContent = 'Remove metadata and download';
        });
      });
    }).catch(function () {
      summary.textContent = 'This browser could not decode that image. HEIC and animated files are not supported here.';
      summary.setAttribute('data-tone', 'fail'); clean.disabled = false; clean.textContent = 'Remove metadata and download';
    });
  }

  input.addEventListener('change', function () { inspect(input.files && input.files[0]); });
  clean.addEventListener('click', cleanFile);
})();
