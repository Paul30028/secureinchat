/* File metadata remover. Everything runs in this page: the file is read, cleaned and scanned again locally and never uploaded. */
import init, { analyze_file, process_file, detect_file_type } from './mr/metadata_remover.js';

var input = document.getElementById('file');
var tbody = document.getElementById('rows');
var summary = document.getElementById('summary');
var cleanBtn = document.getElementById('clean');

var MAX_BYTES = 200 * 1024 * 1024;
var MAX_VALUE = 200;
var BUTTON = 'Remove metadata and download';
var SUPPORTED = 'JPEG, PNG, WebP, AVIF, GIF, HEIC, HEIF, TIFF, SVG, MP4, MOV, MP3, FLAC, WAV, OGG, PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP and EPUB';
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
  if (err == null) return 'Unknown error.';
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string' && err.message) return err.message;
  try { return String(err); } catch (e) { return 'Unknown error.'; }
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
  var th = document.createElement('th'); th.scope = 'row'; th.setAttribute('data-label', 'Check');
  var n = document.createElement('span'); n.className = 'c-name'; n.textContent = name;
  th.appendChild(n);
  if (desc) { var d = document.createElement('span'); d.className = 'c-desc'; d.textContent = desc; th.appendChild(d); }
  var td = document.createElement('td'); td.setAttribute('data-label', 'Result');
  var vals = document.createElement('div'); vals.className = 'vals';
  lines.forEach(function (l) {
    var v = document.createElement('div'); v.className = 'val mono'; v.textContent = l; vals.appendChild(v);
  });
  td.appendChild(vals);
  var p = document.createElement('p'); p.className = 'why'; p.textContent = why || ''; td.appendChild(p);
  var ts = document.createElement('td'); ts.setAttribute('data-label', 'Status');
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
    var cat = asText(item && item.category) || 'Other';
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
    setStatus('That file is over 200 MB. This page handles one file at a time, up to 200 MB.', 'fail');
    return;
  }

  var bytes;
  try {
    var buf = await file.arrayBuffer();
    bytes = new Uint8Array(buf);
  } catch (err) {
    if (mine !== seq) return;
    show([]);
    setStatus('Could not read that file. ' + errText(err), 'fail');
    return;
  }
  if (mine !== seq) return;

  try {
    await engine();
  } catch (err) {
    if (mine !== seq) return;
    show([]);
    setStatus('This browser could not load the cleaning engine. Use a current version of Chrome, Edge, Firefox or Safari, then reload the page.', 'fail');
    return;
  }
  if (mine !== seq) return;

  var type;
  try {
    type = detect_file_type(bytes);
  } catch (err) {
    if (mine !== seq) return;
    show([]);
    setStatus('Could not read this file. ' + errText(err), 'fail');
    return;
  }
  if (mine !== seq) return;

  if (type === 'unknown') {
    show([]);
    setStatus('This file type is not supported. Supported formats: ' + SUPPORTED + '.', 'fail');
    return;
  }
  if (type === 'office-legacy') {
    show([]);
    setStatus('Old Office files (.doc, .xls, .ppt) are not supported. Open the file, save it as .docx, .xlsx or .pptx, then clean the new file.', 'fail');
    return;
  }

  var res;
  try {
    res = analyze_file(bytes);
  } catch (err) {
    if (mine !== seq) return;
    show([]);
    setStatus('Could not read this file. ' + errText(err), 'fail');
    return;
  }
  if (mine !== seq) return;

  var found = groupsOf(res && res.metadata);
  var rows = [row('File', 'What you chose.', 'info', 'Info', [asText(file.name), type.toUpperCase() + ', ' + fmtSize(file.size)])];
  if (found.total) {
    found.groups.forEach(function (g) {
      var lines = g.items.map(function (it) {
        return (asText(it.name) || 'Value') + ': ' + truncate(it.value);
      });
      rows.push(row(g.name, '', 'warn', 'Found', lines, 'This is hidden data. Cleaning removes it from the copy you download.'));
    });
    setStatus(found.total + ' metadata item' + (found.total === 1 ? '' : 's') + ' found in this ' + type.toUpperCase() + ' file. Clean it before you share it.', 'warn');
  } else {
    rows.push(row('Metadata', 'Hidden data inside the file.', 'pass', 'None found', ['No readable metadata']));
    setStatus('No readable metadata found in this ' + type.toUpperCase() + ' file. You can still clean it.', 'ok');
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
  cleanBtn.textContent = 'Working…';

  var res;
  try {
    await engine();
    res = process_file(job.bytes);
  } catch (err) {
    setStatus('Could not clean this file. ' + errText(err), 'fail');
    cleanBtn.disabled = false;
    cleanBtn.textContent = BUTTON;
    return;
  }

  var cleaned = res && res.cleaned;
  if (!cleaned || typeof cleaned.length !== 'number' || !cleaned.length) {
    setStatus('Could not clean this file. The engine returned no data.', 'fail');
    cleanBtn.disabled = false;
    cleanBtn.textContent = BUTTON;
    return;
  }

  var mime = MIME[job.type] || job.file.type || 'application/octet-stream';
  try {
    download(cleaned, cleanName(job.file.name), mime);
  } catch (err) {
    setStatus('Could not save the cleaned file. ' + errText(err), 'fail');
    cleanBtn.disabled = false;
    cleanBtn.textContent = BUTTON;
    return;
  }

  var left = (res.verification && res.verification.metadata_found) || [];
  if (!left.length) {
    setStatus('Cleaned. A second scan found no metadata left. The cleaned copy was saved to your downloads; your original file is unchanged.', 'ok');
  } else {
    var names = left.map(function (it) {
      var cat = asText(it && it.category);
      var nm = asText(it && it.name) || 'value';
      return (cat ? cat + ' / ' : '') + nm;
    });
    setStatus('The cleaned copy was saved, but a second scan still found ' + left.length + ' item' + (left.length === 1 ? '' : 's') + ': ' + names.join(', ') + '. These are part of the file structure; do not share the file if that matters to you.', 'warn');
  }
  cleanBtn.disabled = false;
  cleanBtn.textContent = BUTTON;
}

input.addEventListener('change', function () { if (input.files && input.files[0]) document.dispatchEvent(new CustomEvent('netlog:mark', { detail: { label: 'You picked a file' } })); inspect(input.files && input.files[0]); });
cleanBtn.addEventListener('click', runClean);
