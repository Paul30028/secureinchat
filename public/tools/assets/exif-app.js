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

  // Interface strings. The page is shared by /tools/photo-metadata-remover/ and its Chinese translation,
  // so the wording is picked from the document language and the English page keeps its old strings.
  var ZH = /^zh/i.test(document.documentElement.lang || '');
  var T = ZH ? {
    labelCheck: '检查', labelResult: '结果', labelStatus: '状态',
    onlyJpeg: '这里只支持 JPEG、PNG 和 WebP 照片。',
    tooBig: '这个文件超过 40 MB，换一个小一点的。',
    file: '文件', fileDesc: '你选的文件。', info: '信息',
    location: '位置', locationDesc: '照片拍摄的地点。', found: '已找到',
    gpsBlock: '存在 GPS 数据块',
    gpsWhy: '拿到这个文件的人都能读到这些坐标，通常精确到几米。',
    none: '未发现', noGps: '没有 GPS 数据',
    device: '设备', deviceDesc: '相机、手机、软件和所有者。',
    deviceWhy: '这些细节可能指向你的设备或你本人。', noDevice: '没有设备信息',
    dates: '时间', datesDesc: '拍摄或编辑的时间。',
    datesWhy: '时间会说明你什么时候在什么地方。', noDates: '没有时间信息',
    carries: '这张照片带有元数据。分享前先删掉。',
    noMeta: '没有读到可识别的元数据。清理仍然是安全的。',
    metadata: '元数据', metadataDesc: '文件里的隐藏数据。', notRead: '未读取',
    jpegOnly: '本页只读取 JPEG 的元数据',
    otherFormat: 'PNG、WebP 和其他格式也可能带元数据。清理会重写文件，不带上它们。',
    notReadHere: '这里不读取这种格式，但清理同样会去掉它的元数据。',
    cleanBtn: '删除元数据并下载',
    cantRead: '读不了这个文件。',
    working: '处理中…',
    done: '完成。清理后的副本已保存到下载文件夹，原文件没有改动。',
    stillHas: '清理后的副本仍然带着元数据。不要分享它。',
    cantDecode: '这个浏览器无法解码这张图片。这里不支持 HEIC 和动图。',
    mark: '你选择了一张照片',
  } : {
    labelCheck: 'Check', labelResult: 'Result', labelStatus: 'Status',
    onlyJpeg: 'Only JPEG, PNG and WebP photos are supported here.',
    tooBig: 'That file is over 40 MB. Try a smaller one.',
    file: 'File', fileDesc: 'What you chose.', info: 'Info',
    location: 'Location', locationDesc: 'Where the photo was taken.', found: 'Found',
    gpsBlock: 'GPS block present',
    gpsWhy: 'Anyone who gets this file can read these coordinates, usually accurate to a few metres.',
    none: 'None found', noGps: 'No GPS data',
    device: 'Device', deviceDesc: 'Camera, phone, software and owner.',
    deviceWhy: 'These details can identify your device or you.', noDevice: 'No device details',
    dates: 'Dates', datesDesc: 'When the photo was taken or edited.',
    datesWhy: 'Dates show when you were somewhere.', noDates: 'No dates',
    carries: 'This photo carries metadata. Remove it before you share it.',
    noMeta: 'No readable metadata found. Cleaning is still safe.',
    metadata: 'Metadata', metadataDesc: 'Hidden data inside the file.', notRead: 'Not read',
    jpegOnly: 'This page reads JPEG metadata only',
    otherFormat: 'PNG, WebP and other formats can also hold metadata. Cleaning rewrites the file without it.',
    notReadHere: 'This format is not read here, but cleaning removes its metadata too.',
    cleanBtn: 'Remove metadata and download',
    cantRead: 'Could not read that file.',
    working: 'Working...',
    done: 'Done. The cleaned copy was saved to your downloads. Your original is unchanged.',
    stillHas: 'The cleaned copy still shows metadata. Do not share it.',
    cantDecode: 'This browser could not decode that image. HEIC and animated files are not supported here.',
    mark: 'You picked a photo',
  };

  function row(name, desc, status, label, lines, why) {
    var tr = document.createElement('tr');
    tr.setAttribute('data-status', status);
    var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', T.labelCheck);
    var n = document.createElement('span'); n.className = 'c-name'; n.textContent = name;
    var d = document.createElement('span'); d.className = 'c-desc'; d.textContent = desc;
    th.appendChild(n); th.appendChild(d);
    var td = document.createElement('td'); td.setAttribute('data-label', T.labelResult);
    var vals = document.createElement('div'); vals.className = 'vals';
    lines.forEach(function (l) { var v = document.createElement('div'); v.className = 'val mono'; v.textContent = l; vals.appendChild(v); });
    td.appendChild(vals);
    var p = document.createElement('p'); p.className = 'why'; p.textContent = why || ''; td.appendChild(p);
    var ts = document.createElement('td'); ts.setAttribute('data-label', T.labelStatus);
    var pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = label; ts.appendChild(pill);
    tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
    return tr;
  }

  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function show(rows) { tbody.textContent = ''; rows.forEach(function (r) { tbody.appendChild(r); }); }

  function inspect(file) {
    current = null; clean.hidden = true;
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { summary.textContent = T.onlyJpeg; summary.setAttribute('data-tone', 'fail'); show([]); return; }
    if (file.size > MAX_BYTES) { summary.textContent = T.tooBig; summary.setAttribute('data-tone', 'fail'); show([]); return; }
    file.arrayBuffer().then(function (buf) {
      var r = E.parse(buf);
      var rows = [row(T.file, T.fileDesc, 'info', T.info, [file.name, file.type + ', ' + fmtSize(file.size)])];
      if (r.kind === 'jpeg') {
        if (r.hasGPS) {
          var coords = r.gps ? r.gps.lat.toFixed(5) + ', ' + r.gps.lon.toFixed(5) : T.gpsBlock;
          rows.push(row(T.location, T.locationDesc, 'fail', T.found, [coords], T.gpsWhy));
        } else {
          rows.push(row(T.location, T.locationDesc, 'pass', T.none, [T.noGps]));
        }
        var dev = r.fields.filter(function (f) { return /camera|lens|software|owner/i.test(f[0]); });
        var dates = r.fields.filter(function (f) { return /date/i.test(f[0]); });
        rows.push(dev.length ? row(T.device, T.deviceDesc, 'warn', T.found, dev.map(function (f) { return f[0] + ': ' + f[1]; }), T.deviceWhy)
                             : row(T.device, T.deviceDesc, 'pass', T.none, [T.noDevice]));
        rows.push(dates.length ? row(T.dates, T.datesDesc, 'warn', T.found, dates.map(function (f) { return f[0] + ': ' + f[1]; }), T.datesWhy)
                               : row(T.dates, T.datesDesc, 'pass', T.none, [T.noDates]));
        summary.textContent = r.found ? T.carries : T.noMeta;
        summary.setAttribute('data-tone', r.found ? 'fail' : 'ok');
      } else {
        rows.push(row(T.metadata, T.metadataDesc, 'warn', T.notRead, [T.jpegOnly], T.otherFormat));
        summary.textContent = T.notReadHere;
        summary.setAttribute('data-tone', 'warn');
      }
      show(rows);
      current = file; clean.hidden = false; clean.disabled = false; clean.textContent = T.cleanBtn;
    }).catch(function () { summary.textContent = T.cantRead; summary.setAttribute('data-tone', 'fail'); });
  }

  function outType(t) { return t === 'image/png' ? 'image/png' : t === 'image/webp' ? 'image/webp' : 'image/jpeg'; }
  function ext(t) { return t === 'image/png' ? 'png' : t === 'image/webp' ? 'webp' : 'jpg'; }

  function cleanFile() {
    if (!current) return;
    var file = current;
    clean.disabled = true; clean.textContent = T.working;
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
          summary.textContent = ok ? T.done : T.stillHas;
          summary.setAttribute('data-tone', ok ? 'ok' : 'fail');
          clean.disabled = false; clean.textContent = T.cleanBtn;
        });
      });
    }).catch(function () {
      summary.textContent = T.cantDecode;
      summary.setAttribute('data-tone', 'fail'); clean.disabled = false; clean.textContent = T.cleanBtn;
    });
  }

  input.addEventListener('change', function () { if (input.files && input.files[0]) document.dispatchEvent(new CustomEvent('netlog:mark', { detail: { label: T.mark } })); inspect(input.files && input.files[0]); });
  clean.addEventListener('click', cleanFile);
})();
