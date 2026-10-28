/* File metadata remover. Everything runs in this page: the file is read, cleaned and scanned again locally and never uploaded. */
import init, { analyze_file, process_file, detect_file_type } from './mr/metadata_remover.js';

var input = document.getElementById('file');
var tbody = document.getElementById('rows');
var summary = document.getElementById('summary');
var cleanBtn = document.getElementById('clean');

var MAX_BYTES = 200 * 1024 * 1024;
var MAX_VALUE = 200;

// Interface strings. The script is shared by /tools/file-metadata-remover/ and its Chinese page, so the
// wording follows document.documentElement.lang (as exif-app.js and redact-app.js do). The English page
// keeps its exact old strings. Category and field names come from the WebAssembly engine and stay as it
// returns them (English) on both pages; the Chinese page says so.
var ZH = /^zh/i.test(document.documentElement.lang || '');
var T = ZH ? {
  button: '删除元数据并下载',
  supported: 'JPEG、PNG、WebP、AVIF、GIF、HEIC、HEIF、TIFF、SVG、MP4、MOV、MP3、FLAC、WAV、OGG、PDF、DOCX、XLSX、PPTX、ODT、ODS、ODP 和 EPUB',
  labelCheck: '检查', labelResult: '结果', labelStatus: '状态',
  unknownErr: '未知错误。',
  tooBig: '这个文件超过 200 MB。本页一次处理一个文件，最大 200 MB。',
  cantReadThat: '读不了这个文件。',
  noEngine: '这个浏览器加载不了清理引擎。请换用最新版的 Chrome、Edge、Firefox 或 Safari，然后刷新页面。',
  cantRead: '读不了这个文件。',
  unsupported: function (list) { return '不支持这种文件类型。支持的格式：' + list + '。'; },
  legacy: '不支持旧版 Office 文件（.doc、.xls、.ppt）。请打开文件，另存为 .docx、.xlsx 或 .pptx，再清理新文件。',
  file: '文件', fileDesc: '你选的文件。', info: '信息',
  other: '其他', value: '值',
  found: '已找到', foundWhy: '这是隐藏数据。清理后下载的副本里不会再有它。',
  foundSummary: function (n, type) { return '在这个 ' + type + ' 文件里找到 ' + n + ' 项元数据。分享前先清理。'; },
  metadata: '元数据', metadataDesc: '文件里的隐藏数据。', none: '未发现', noMeta: '没有可读的元数据',
  noneSummary: function (type) { return '在这个 ' + type + ' 文件里没有找到可读的元数据。你仍然可以清理它。'; },
  working: '处理中…',
  cantClean: '清理不了这个文件。',
  noData: '清理不了这个文件。清理引擎没有返回数据。',
  cantSave: '保存不了清理后的文件。',
  clean: '已清理。再次扫描没有发现剩余的元数据。清理后的副本已保存到下载文件夹，原文件没有改动。',
  left: function (n, names) { return '清理后的副本已保存，但再次扫描仍找到 ' + n + ' 项：' + names + '。它们属于文件结构的一部分；如果这对你很重要，就不要分享这个文件。'; },
  listSep: '、',
  mark: '你选择了一个文件'
} : {
  button: 'Remove metadata and download',
  supported: 'JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, TIFF, SVG, MP4, MOV, MP3, FLAC, WAV, OGG, PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP and EPUB',
  labelCheck: 'Check', labelResult: 'Result', labelStatus: 'Status',
  unknownErr: 'Unknown error.',
  tooBig: 'That file is over 200 MB. This page handles one file at a time, up to 200 MB.',
  cantReadThat: 'Could not read that file. ',
  noEngine: 'This browser could not load the cleaning engine. Use a current version of Chrome, Edge, Firefox or Safari, then reload the page.',
  cantRead: 'Could not read this file. ',
  unsupported: function (list) { return 'This file type is not supported. Supported formats: ' + list + '.'; },
  legacy: 'Old Office files (.doc, .xls, .ppt) are not supported. Open the file, save it as .docx, .xlsx or .pptx, then clean the new file.',
  file: 'File', fileDesc: 'What you chose.', info: 'Info',
  other: 'Other', value: 'Value',
  found: 'Found', foundWhy: 'This is hidden data. Cleaning removes it from the copy you download.',
  foundSummary: function (n, type) { return n + ' metadata item' + (n === 1 ? '' : 's') + ' found in this ' + type + ' file. Clean it before you share it.'; },
  metadata: 'Metadata', metadataDesc: 'Hidden data inside the file.', none: 'None found', noMeta: 'No readable metadata',
  noneSummary: function (type) { return 'No readable metadata found in this ' + type + ' file. You can still clean it.'; },
  working: 'Working…',
  cantClean: 'Could not clean this file. ',
  noData: 'Could not clean this file. The engine returned no data.',
  cantSave: 'Could not save the cleaned file. ',
  clean: 'Cleaned. A second scan found no metadata left. The cleaned copy was saved to your downloads; your original file is unchanged.',
  left: function (n, names) { return 'The cleaned copy was saved, but a second scan still found ' + n + ' item' + (n === 1 ? '' : 's') + ': ' + names + '. These are part of the file structure; do not share the file if that matters to you.'; },
  listSep: ', ',
  mark: 'You picked a file'
};
var BUTTON = T.button;
var SUPPORTED = T.supported;
var MIME = {
  jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif',
  heic: 'image/heic', heif: 'image/heif', tiff: 'image/tiff', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  epub: 'application/epub+zip'
};

var enginePromise = null;
var current = null;
var seq = 0;

// The WASM module is fetched the first time a file is chosen, then reused for the rest of the visit.
function engine() {
  if (!enginePromise) enginePromise = init({ module_or_path: new URL('./mr/metadata_remover_bg.wasm', import.meta.url) });
  return enginePromise;
}

function setStatus(text, tone) {
  summary.textContent = text;
  summary.setAttribute('data-tone', tone);
}

function errText(err) {
  if (err == null) return T.unknownErr;
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  try { return String(err); } catch (e) { return T.unknownErr; }
}

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try { return String(v); } catch (e) { return ''; }
}

function truncate(v) {
  var s = asText(v);
  return s.length > MAX_VALUE ? s.slice(0, MAX_VALUE) + '…' : s;
}

function fmtSize(b) {
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' KB';
}

function row(name, desc, status, label, lines, why) {
  var tr = document.createElement('tr');
  tr.setAttribute('data-status', status);
  var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', T.labelCheck);
  var n = document.createElement('span'); n.className = 'c-name'; n.textContent = name;
  th.appendChild(n);
  if (desc) { var d = document.createElement('span'); d.className = 'c-desc'; d.textContent = desc; th.appendChild(d); }
  var td = document.createElement('td'); td.setAttribute('data-label', T.labelResult);
  var vals = document.createElement('div'); vals.className = 'vals';
  lines.forEach(function (l) {
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = l; vals.appendChild(v);
  });
  td.appendChild(vals);
  var p = document.createElement('p'); p.className = 'why'; p.textContent = why || ''; td.appendChild(p);
  var ts = document.createElement('td'); ts.setAttribute('data-label', T.labelStatus);
  var pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = label; ts.appendChild(pill);
  tr.appendChild(th); tr.appendChild(td); tr.appendChild(ts);
  return tr;
}

function show(rows) { tbody.textContent = ''; rows.forEach(function (r) { tbody.appendChild(r); }); }

function reset() {
  current = null;
  cleanBtn.hidden = true;
  cleanBtn.disabled = false;
  cleanBtn.textContent = BUTTON;
}

function cleanName(name) {
  name = asText(name);
  var m = /^(.*)(\.[^.\/\\]+)$/.exec(name);
  if (m && m[1]) return m[1] + '-clean' + m[2];
  return (name || 'file') + '-clean';
}

function download(bytes, name, type) {
  var blob = new Blob([bytes], { type: type || 'application/octet-stream' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}

function groupsOf(meta) {
  var list = (meta && meta.metadata_found) || [];
  var groups = [], index = {};
  list.forEach(function (item) {
    var cat = asText(item && item.category) || T.other;
    var key = cat.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(index, key)) {
      index[key] = groups.length;
      groups.push({ name: cat, items: [] });
    }
    groups[index[key]].items.push(item || {});
  });
  return { groups: groups, total: list.length };
}

async function inspect(file) {
  var mine = ++seq;
  reset();
  if (!file) return;
  if (file.size > MAX_BYTES) {
    show([]);
    setStatus(T.tooBig, 'fail');
    return;
  }

  var bytes;
  try {
    var buf = await file.arrayBuffer();
    bytes = new Uint8Array(buf);
  } catch (err) {
    if (mine !== seq) return;
    show([]);
    setStatus(T.cantReadThat + errText(err), 'fail');
    return;
  }
  if (mine !== seq) return;

  try {
    await engine();
  } catch (err) {
    if (mine !== seq) return;
    show([]);
    setStatus(T.noEngine, 'fail');
    return;
  }
  if (mine !== seq) return;

  var type;
  try {
    type = detect_file_type(bytes);
  } catch (err) {
    if (mine !== seq) return;
    show([]);
    setStatus(T.cantRead + errText(err), 'fail');
    return;
  }
  if (mine !== seq) return;

  if (type === 'unknown') {
    show([]);
    setStatus(T.unsupported(SUPPORTED), 'fail');
    return;
  }
  if (type === 'office-legacy') {
    show([]);
    setStatus(T.legacy, 'fail');
    return;
  }

  var res;
  try {
    res = analyze_file(bytes);
  } catch (err) {
    if (mine !== seq) return;
    show([]);
    setStatus(T.cantRead + errText(err), 'fail');
    return;
  }
  if (mine !== seq) return;

  var found = groupsOf(res && res.metadata);
  var rows = [row(T.file, T.fileDesc, 'info', T.info, [asText(file.name), type.toUpperCase() + ', ' + fmtSize(file.size)])];
  if (found.total) {
    found.groups.forEach(function (g) {
      var lines = g.items.map(function (it) {
        return (asText(it.name) || T.value) + ': ' + truncate(it.value);
      });
      rows.push(row(g.name, '', 'warn', T.found, lines, T.foundWhy));
    });
    setStatus(T.foundSummary(found.total, type.toUpperCase()), 'warn');
  } else {
    rows.push(row(T.metadata, T.metadataDesc, 'pass', T.none, [T.noMeta]));
    setStatus(T.noneSummary(type.toUpperCase()), 'ok');
  }
  show(rows);
  current = { file: file, bytes: bytes, type: type };
  cleanBtn.hidden = false;
  cleanBtn.disabled = false;
  cleanBtn.textContent = BUTTON;
}

async function runClean() {
  if (!current) return;
  var job = current;
  cleanBtn.disabled = true;
  cleanBtn.textContent = T.working;

  var res;
  try {
    await engine();
    res = process_file(job.bytes);
  } catch (err) {
    setStatus(T.cantClean + errText(err), 'fail');
    cleanBtn.disabled = false;
    cleanBtn.textContent = BUTTON;
    return;
  }

  var cleaned = res && res.cleaned;
  if (!cleaned || typeof cleaned.length !== 'number' || !cleaned.length) {
    setStatus(T.noData, 'fail');
    cleanBtn.disabled = false;
    cleanBtn.textContent = BUTTON;
    return;
  }

  var mime = MIME[job.type] || job.file.type || 'application/octet-stream';
  try {
    download(cleaned, cleanName(job.file.name), mime);
  } catch (err) {
    setStatus(T.cantSave + errText(err), 'fail');
    cleanBtn.disabled = false;
    cleanBtn.textContent = BUTTON;
    return;
  }

  var left = (res.verification && res.verification.metadata_found) || [];
  if (!left.length) {
    setStatus(T.clean, 'ok');
  } else {
    var names = left.map(function (it) {
      var cat = asText(it && it.category);
      var nm = asText(it && it.name) || T.value.toLowerCase();
      return (cat ? cat + ' / ' : '') + nm;
    });
    setStatus(T.left(left.length, names.join(T.listSep)), 'warn');
  }
  cleanBtn.disabled = false;
  cleanBtn.textContent = BUTTON;
}

input.addEventListener('change', function () { if (input.files && input.files[0]) document.dispatchEvent(new CustomEvent('netlog:mark', { detail: { label: T.mark } })); inspect(input.files && input.files[0]); });
cleanBtn.addEventListener('click', runClean);
