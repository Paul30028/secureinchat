/* Intake classification for the private workspace.
   Pure functions: no DOM, no network, no storage. Loaded by the page and by the Node tests.
   Decides which mode a dropped file or pasted text belongs to. It never reads file bytes or
   contacts anything; the caller still checks the file itself before processing. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WSIntake = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IMAGE = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  var IMAGE_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  var DOC = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  var DOC_MIME = {};
  Object.keys(DOC).forEach(function (ext) { DOC_MIME[DOC[ext]] = ext; });
  var LEGACY = { doc: 'docx', xls: 'xlsx', ppt: 'pptx' };
  var OTHER_IMAGE = { gif: 1, avif: 1, heic: 1, heif: 1, tif: 1, tiff: 1, svg: 1, bmp: 1, ico: 1 };

  var URL_SCHEME = /^https?:\/\/[^\s]+$/i;
  var URL_WWW = /^www\.[^\s]+$/i;
  var URL_BARE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[\/?#][^\s]*)?$/i;
  // A bare token such as report.docx looks like a host name to the pattern above, but it is a
  // file name, not a link. Bare addresses with these last labels are treated as text.
  var FILE_EXT = {
    pdf: 1, docx: 1, xlsx: 1, pptx: 1, doc: 1, xls: 1, ppt: 1, txt: 1, md: 1, csv: 1,
    jpg: 1, jpeg: 1, png: 1, webp: 1, gif: 1, heic: 1, zip: 1, rar: 1, '7z': 1,
    mp3: 1, mp4: 1, mov: 1, wav: 1, json: 1, html: 1, htm: 1, xml: 1
  };

  function clean(value) {
    return String(value === undefined || value === null ? '' : value);
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(clean(name));
    return m ? m[1].toLowerCase() : '';
  }

  function fileList(files) {
    var out = [];
    if (!files) return out;
    for (var i = 0; i < files.length; i++) {
      if (files[i]) out.push(files[i]);
    }
    return out;
  }

  // One trimmed token with no internal whitespace, and it must look like a web address.
  // A message such as "see https://example.com" is text, not a link; so is a link on its own
  // line inside a longer message.
  function looksLikeUrl(value) {
    var text = clean(value).trim();
    if (!text || /\s/.test(text)) return false;
    if (URL_SCHEME.test(text) || URL_WWW.test(text)) return true;
    if (!URL_BARE.test(text)) return false;
    var host = text.split(/[\/?#]/)[0].replace(/:\d+$/, '');
    var last = host.split('.').pop().toLowerCase();
    return !Object.prototype.hasOwnProperty.call(FILE_EXT, last);
  }

  function fileKind(file) {
    var ext = extOf(file.name);
    var mime = clean(file.type).split(';')[0].trim().toLowerCase();
    if (IMAGE[ext]) return { kind: 'image', mode: 'image', ext: ext, label: IMAGE[ext], file: file };
    if (DOC[ext]) return { kind: 'file', mode: 'file', ext: ext, label: DOC[ext], file: file };
    if (IMAGE_MIME[mime]) return { kind: 'image', mode: 'image', ext: IMAGE_MIME[mime], label: mime, file: file };
    if (DOC_MIME[mime]) return { kind: 'file', mode: 'file', ext: DOC_MIME[mime], label: mime, file: file };
    if (LEGACY[ext]) {
      return { kind: 'unknown', mode: null, reason: 'legacy-office', ext: ext, file: file };
    }
    if (OTHER_IMAGE[ext] || /^image\//.test(mime)) {
      return { kind: 'unknown', mode: null, reason: 'unsupported-image', ext: ext, file: file };
    }
    return { kind: 'unknown', mode: null, reason: 'unknown-type', ext: ext, file: file };
  }

  // Accepts either a string (pasted text) or { text, files }. Files win over text, because a
  // pasted file usually also carries a text/plain fallback of its name.
  function classify(input) {
    if (typeof input === 'string') return classifyText(input);
    var value = input && typeof input === 'object' ? input : {};
    var files = fileList(value.files);
    if (files.length > 1) return { kind: 'multiple', mode: null, reason: 'multiple-files', files: files };
    if (files.length === 1) return fileKind(files[0]);
    if (typeof value.text === 'string') return classifyText(value.text);
    return { kind: 'empty', mode: null, reason: 'empty' };
  }

  function classifyText(value) {
    var raw = clean(value);
    if (!raw.trim()) return { kind: 'empty', mode: null, reason: 'empty' };
    if (looksLikeUrl(raw)) return { kind: 'url', mode: 'link', url: raw.trim() };
    return { kind: 'text', mode: 'text', text: raw };
  }

  return {
    classify: classify,
    classifyText: classifyText,
    looksLikeUrl: looksLikeUrl
  };
});
