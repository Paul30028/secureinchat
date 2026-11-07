/* Local image checks for the private workspace.
   Pure functions: no DOM, no network, no storage. Loaded by the page and by the Node tests.
   It recognises JPEG, PNG and WebP by MIME and by the first bytes, reads the declared pixel
   dimensions when the header allows it, and enforces the byte and pixel limits. It does not
   decode the image; the page still has to check the result after createImageBitmap. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.WSImage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMIT_BYTES = 25 * 1024 * 1024;
  var LIMIT_PIXELS = 40000000;

  var FORMATS = {
    jpeg: { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
    png: { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png' },
    webp: { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp' }
  };

  var MIME_TO_FORMAT = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  function fail(error, message) {
    return { ok: false, error: error, message: message };
  }

  function bytesOf(input) {
    if (!input) return new Uint8Array(0);
    if (typeof Uint8Array !== 'undefined' && input instanceof Uint8Array) return input;
    if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) return new Uint8Array(input);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    if (Object.prototype.toString.call(input) === '[object Array]') return Uint8Array.from(input);
    return new Uint8Array(0);
  }

  function ascii(bytes, start, end) {
    var out = '';
    for (var i = start; i < end && i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  function u16be(bytes, i) {
    return (bytes[i] * 256) + bytes[i + 1];
  }

  function u32be(bytes, i) {
    return (bytes[i] * 16777216) + (bytes[i + 1] * 65536) + (bytes[i + 2] * 256) + bytes[i + 3];
  }

  function normalizeMime(value) {
    return String(value === undefined || value === null ? '' : value).split(';')[0].trim().toLowerCase();
  }

  // The magic numbers required by the workspace: JPEG FF D8 FF, PNG 89 50 4E 47,
  // WebP RIFF....WEBP. A short or empty buffer is reported, never guessed from a name.
  function sniff(input) {
    var b = bytesOf(input);
    if (!b.length) return fail('empty', 'The file is empty. Choose a JPEG, PNG or WebP image.');
    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) {
      return { ok: true, format: 'jpeg', label: FORMATS.jpeg.label, mime: FORMATS.jpeg.mime, ext: FORMATS.jpeg.ext };
    }
    if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) {
      return { ok: true, format: 'png', label: FORMATS.png.label, mime: FORMATS.png.mime, ext: FORMATS.png.ext };
    }
    if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') {
      return { ok: true, format: 'webp', label: FORMATS.webp.label, mime: FORMATS.webp.mime, ext: FORMATS.webp.ext };
    }
    return fail('magic', 'The first bytes are not a JPEG, PNG or WebP signature. It was not processed.');
  }

  function pngSize(b) {
    if (b.length < 24) return null;
    if (ascii(b, 12, 16) !== 'IHDR') return null;
    var w = u32be(b, 16), h = u32be(b, 20);
    if (!w || !h) return null;
    return { width: w, height: h };
  }

  function isSof(marker) {
    return (marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
      (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF);
  }

  function jpegSize(b) {
    var i = 2;
    while (i + 1 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      var marker = b[i + 1];
      if (marker === 0xFF) { i++; continue; }
      if (marker === 0x00) { i += 2; continue; }
      // Standalone markers: SOI, EOI, RSTn and TEM have no length field.
      if (marker === 0xD8 || marker === 0xD9 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
        i += 2;
        continue;
      }
      if (i + 4 > b.length) return null;
      var len = u16be(b, i + 2);
      if (len < 2) return null;
      if (isSof(marker)) {
        if (i + 9 > b.length) return null;
        var h = u16be(b, i + 5), w = u16be(b, i + 7);
        if (!w || !h) return null;
        return { width: w, height: h };
      }
      if (marker === 0xDA) return null; // Start of scan before a frame header.
      i += 2 + len;
    }
    return null;
  }

  function webpSize(b) {
    if (b.length < 16) return null;
    var chunk = ascii(b, 12, 16);
    if (chunk === 'VP8X') {
      if (b.length < 30) return null;
      var vw = 1 + b[24] + (b[25] * 256) + (b[26] * 65536);
      var vh = 1 + b[27] + (b[28] * 256) + (b[29] * 65536);
      if (!vw || !vh) return null;
      return { width: vw, height: vh };
    }
    if (chunk === 'VP8L') {
      if (b.length < 25 || b[20] !== 0x2F) return null;
      var bits = b[21] + (b[22] * 256) + (b[23] * 65536) + (b[24] * 16777216);
      var lw = (bits & 0x3FFF) + 1;
      var lh = ((bits >>> 14) & 0x3FFF) + 1;
      if (!lw || !lh) return null;
      return { width: lw, height: lh };
    }
    if (chunk === 'VP8 ') {
      if (b.length < 30) return null;
      if (!(b[23] === 0x9D && b[24] === 0x01 && b[25] === 0x2A)) return null;
      var sw = ((b[26] + (b[27] * 256)) & 0x3FFF);
      var sh = ((b[28] + (b[29] * 256)) & 0x3FFF);
      if (!sw || !sh) return null;
      return { width: sw, height: sh };
    }
    return null;
  }

  // Reads the dimensions declared in the header. Returns null rather than guessing when the
  // header is truncated or uses a variant this parser does not know; the page then checks the
  // real size after decoding.
  function readDimensions(input, format) {
    var b = bytesOf(input);
    var size = null;
    if (format === 'png') size = pngSize(b);
    else if (format === 'jpeg') size = jpegSize(b);
    else if (format === 'webp') size = webpSize(b);
    if (!size) return { ok: false, error: 'dimensions' };
    return { ok: true, width: size.width, height: size.height };
  }

  function outputName(format) {
    var info = FORMATS[format];
    return info ? 'image-cleaned.' + info.ext : '';
  }

  function outputMime(format) {
    return FORMATS[format] ? FORMATS[format].mime : '';
  }

  // PNG has no quality setting. JPEG and WebP are re-encoded at 0.92 as specified.
  function encodeOptions(format) {
    if (!FORMATS[format]) return null;
    return { type: FORMATS[format].mime, quality: format === 'png' ? null : 0.92 };
  }

  function formatBytes(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return '0 B';
    if (n < 1024) return Math.round(n) + ' B';
    var kb = n / 1024;
    if (kb < 1024) return (kb < 10 ? kb.toFixed(1) : String(Math.round(kb))) + ' KB';
    var mb = kb / 1024;
    if (Math.abs(mb - Math.round(mb)) < 1e-9) return Math.round(mb) + ' MB';
    return mb.toFixed(1) + ' MB';
  }

  function tooManyPixels(width, height) {
    return width * height > LIMIT_PIXELS;
  }

  // Validates a File-like object: { type, size, bytes }. `bytes` only needs the first part of
  // the file. Error codes are stable so the page and the tests can tell the cases apart.
  function inspect(file) {
    file = file || {};
    var type = normalizeMime(file.type);
    if (!type) {
      return fail('mime-missing', 'The browser did not report a file type. Choose a JPEG, PNG or WebP image; this page does not process other formats.');
    }
    var format = MIME_TO_FORMAT[type];
    if (!format) {
      return fail('mime-unsupported', 'This page re-encodes JPEG, PNG and WebP images only. This file is reported as "' + type + '" and was not processed.');
    }

    var size = Number(file.size);
    if (!isFinite(size) || size < 0) size = 0;
    if (size > LIMIT_BYTES) {
      return fail('too-large', 'This file is ' + size.toLocaleString('en-US') + ' bytes (' + formatBytes(size) + '). The limit is 25 MB (26,214,400 bytes). It was not processed.');
    }

    var magic = sniff(file.bytes);
    if (!magic.ok) return magic;
    if (magic.format !== format) {
      return fail('mismatch', 'The file reports ' + type + ', but its first bytes are ' + magic.label + '. Nothing was processed. Choose the matching file or export it again.');
    }

    var info = FORMATS[format];
    var dims = readDimensions(file.bytes, format);
    var width = dims.ok ? dims.width : 0;
    var height = dims.ok ? dims.height : 0;
    if (dims.ok && tooManyPixels(width, height)) {
      return fail('too-many-pixels', 'This image is ' + width.toLocaleString('en-US') + ' × ' + height.toLocaleString('en-US') + ' pixels (' + (width * height).toLocaleString('en-US') + ' total). The limit is 40,000,000 pixels. It was not processed.');
    }

    return {
      ok: true,
      format: format,
      label: info.label,
      mime: info.mime,
      ext: info.ext,
      size: size,
      width: width,
      height: height,
      pixels: dims.ok ? width * height : 0,
      dimensionsKnown: dims.ok,
      quality: format === 'png' ? null : 0.92,
      outputName: outputName(format)
    };
  }

  return {
    LIMIT_BYTES: LIMIT_BYTES,
    LIMIT_PIXELS: LIMIT_PIXELS,
    FORMATS: FORMATS,
    sniff: sniff,
    readDimensions: readDimensions,
    inspect: inspect,
    outputName: outputName,
    outputMime: outputMime,
    encodeOptions: encodeOptions,
    formatBytes: formatBytes,
    tooManyPixels: tooManyPixels
  };
});
