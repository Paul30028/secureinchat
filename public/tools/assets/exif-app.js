/* Photo metadata remover. Everything runs in this page: the file is read and re-encoded locally and never uploaded. */
(function () {
  'use strict';
  var E = window.EXIFR;
  var C = window.CLEANDIFF;
  var input = document.getElementById('file');
  var tbody = document.getElementById('rows');
  var summary = document.getElementById('summary');
  var clean = document.getElementById('clean');
  var current = null;
  var before = null; // metadata items read from the chosen JPEG, kept to compare with the cleaned copy
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
    other: '其他', otherDesc: '文件里的其他字段。',
    removed: '已删除', stillThere: '仍然存在',
    cleanedCopy: '清理后的副本：',
    second: '再次检查', secondDesc: '清理后的副本。', checked: '已检查', notAvailable: '无法检查',
    secondRead: '已在浏览器里重新读取清理后的副本。',
    secondNA: '再次检查：本页无法读取 PNG 和 WebP 的元数据。文件已重新编码，元数据块不会被带上。',
    removedAll: function (n) { return '已删除 ' + n + ' 项。再次检查清理后的副本，没有剩余。已保存到下载文件夹，原文件没有改动。'; },
    leftCount: function (n) { return '清理后的副本仍然带着 ' + n + ' 项元数据。不要分享它。'; },
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
    other: 'Other', otherDesc: 'Other fields in the file.',
    removed: 'Removed', stillThere: 'Still there',
    cleanedCopy: 'Cleaned copy: ',
    second: 'Second check', secondDesc: 'The cleaned copy.', checked: 'Checked', notAvailable: 'Not available',
    secondRead: 'The cleaned copy was read again in your browser.',
    secondNA: 'Second check: not available for PNG and WebP on this page. The file was re-encoded, which drops metadata blocks.',
    removedAll: function (n) { return 'Removed ' + n + ' item' + (n === 1 ? '' : 's') + '. A second check of the cleaned copy found none left. Saved to your downloads; your original is unchanged.'; },
    leftCount: function (n) { return 'The cleaned copy still shows ' + n + ' metadata item' + (n === 1 ? '' : 's') + '. Do not share it.'; },
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
    current = null; before = null; clean.hidden = true;
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
        before = C.fromExif(r);
        summary.textContent = r.found ? T.carries : T.noMeta;
        summary.setAttribute('data-tone', r.found ? 'fail' : 'ok');
      } else {
        rows.push(row(T.metadata, T.metadataDesc, 'warn', T.notRead, [T.jpegOnly], T.otherFormat));
        summary.textContent = T.notReadHere;
        summary.setAttribute('data-tone', 'warn');
      }
      show(rows);
      current = { file: file, before: before }; clean.hidden = false; clean.disabled = false; clean.textContent = T.cleanBtn;
    }).catch(function () { summary.textContent = T.cantRead; summary.setAttribute('data-tone', 'fail'); });
  }

  var CAT = { location: 'location', device: 'device', dates: 'dates' };
  function catName(c) { var k = CAT[String(c).toLowerCase()]; return k ? T[k] : T.other; }
  function catDesc(c) { var k = CAT[String(c).toLowerCase()]; return k ? T[k + 'Desc'] : T.otherDesc; }
  function line(it) { return it.name + ': ' + (it.category === 'Location' && it.value === 'present' ? T.gpsBlock : it.value); }

  // One row per category that had items before cleaning: "Removed" when every item is gone, otherwise
  // "Still there" with only the items that are left. Then the second-check row.
  function resultRows(beforeItems, diff) {
    var rows = [];
    var leftGroups = C.byCategory(diff.left.concat(diff.added));
    function leftOf(name) {
      for (var i = 0; i < leftGroups.length; i++) if (leftGroups[i].name.toLowerCase() === name.toLowerCase()) return leftGroups[i].items;
      return [];
    }
    var seen = {};
    C.byCategory(beforeItems).forEach(function (g) {
      seen[g.name.toLowerCase()] = true;
      var left = leftOf(g.name);
      rows.push(left.length ? row(catName(g.name), catDesc(g.name), 'fail', T.stillThere, left.map(line))
                            : row(catName(g.name), catDesc(g.name), 'pass', T.removed, g.items.map(line)));
    });
    leftGroups.forEach(function (g) {
      if (!seen[g.name.toLowerCase()]) rows.push(row(catName(g.name), catDesc(g.name), 'fail', T.stillThere, g.items.map(line)));
    });
    if (!beforeItems.length) rows.push(row(T.metadata, T.metadataDesc, 'pass', T.none, [T.noGps, T.noDevice, T.noDates]));
    rows.push(row(T.second, T.secondDesc, diff.left.length + diff.added.length ? 'fail' : 'pass', T.checked, [T.secondRead]));
    return rows;
  }

  function outType(t) { return t === 'image/png' ? 'image/png' : t === 'image/webp' ? 'image/webp' : 'image/jpeg'; }
  function ext(t) { return t === 'image/png' ? 'png' : t === 'image/webp' ? 'webp' : 'jpg'; }

  function cleanFile() {
    if (!current) return;
    var job = current, file = job.file;
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
          var outName = a.download;
          if (job !== current) return; // another file was chosen meanwhile; its table is on screen now
          var fileRow = row(T.file, T.fileDesc, 'info', T.info, [file.name, file.type + ', ' + fmtSize(file.size), T.cleanedCopy + outName + ', ' + fmtSize(blob.size)]);
          if (type !== 'image/jpeg' || !job.before) {
            // PNG and WebP metadata is not read on this page, so no per-item claim is made for them.
            show([fileRow, row(T.second, T.secondDesc, 'info', T.notAvailable, [T.secondNA])]);
            summary.textContent = T.done;
            summary.setAttribute('data-tone', 'ok');
          } else {
            var diff = C.compare(job.before, C.fromExif(again));
            show([fileRow].concat(resultRows(job.before, diff)));
            var bad = diff.left.length + diff.added.length;
            summary.textContent = bad ? T.leftCount(bad) : job.before.length ? T.removedAll(job.before.length) : T.done;
            summary.setAttribute('data-tone', bad ? 'fail' : 'ok');
          }
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
