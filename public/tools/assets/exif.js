/* Minimal JPEG EXIF reader. Pure: takes an ArrayBuffer, returns what it found. No DOM, no network. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EXIFR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

  function readIFD(dv, base, offset, little, out, depth) {
    if (offset + 2 > dv.byteLength) return;
    var count = dv.getUint16(offset, little);
    for (var i = 0; i < count; i++) {
      var e = offset + 2 + i * 12;
      if (e + 12 > dv.byteLength) return;
      var tag = dv.getUint16(e, little), type = dv.getUint16(e + 2, little), n = dv.getUint32(e + 4, little);
      var size = (TYPE_SIZE[type] || 1) * n;
      var vo = size <= 4 ? e + 8 : base + dv.getUint32(e + 8, little);
      if (vo + size > dv.byteLength || size > 65536) continue;
      out.raw[depth + ':' + tag] = value(dv, vo, type, n, little);
      if (depth === 0 && (tag === 0x8769 || tag === 0x8825)) {
        readIFD(dv, base, base + dv.getUint32(e + 8, little), little, out, tag === 0x8825 ? 10 : 5);
      }
    }
  }

  function value(dv, o, type, n, little) {
    var i, s, r;
    if (type === 2) {
      s = '';
      for (i = 0; i < n; i++) { var c = dv.getUint8(o + i); if (c === 0) break; s += String.fromCharCode(c); }
      return s.trim();
    }
    if (type === 3) { r = []; for (i = 0; i < n; i++) r.push(dv.getUint16(o + i * 2, little)); return r.length === 1 ? r[0] : r; }
    if (type === 4) { r = []; for (i = 0; i < n; i++) r.push(dv.getUint32(o + i * 4, little)); return r.length === 1 ? r[0] : r; }
    if (type === 5) {
      r = [];
      for (i = 0; i < n; i++) { var d = dv.getUint32(o + i * 8 + 4, little); r.push(d ? dv.getUint32(o + i * 8, little) / d : 0); }
      return r;
    }
    return null;
  }

  function gps(raw) {
    var lat = raw['10:2'], latRef = raw['10:1'], lon = raw['10:4'], lonRef = raw['10:3'];
    if (!Array.isArray(lat) || !Array.isArray(lon) || lat.length < 3 || lon.length < 3) return null;
    var f = function (a) { return a[0] + a[1] / 60 + a[2] / 3600; };
    var la = f(lat) * (latRef === 'S' ? -1 : 1), lo = f(lon) * (lonRef === 'W' ? -1 : 1);
    if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
    return { lat: la, lon: lo };
  }

  /* Returns { kind: 'jpeg'|'other', found: bool, fields: [[label, value]...], gps: {lat,lon}|null, hasGPS: bool } */
  function parse(buf) {
    var dv = new DataView(buf);
    var res = { kind: 'other', found: false, fields: [], gps: null, hasGPS: false };
    if (dv.byteLength < 4 || dv.getUint16(0) !== 0xFFD8) return res;
    res.kind = 'jpeg';
    var p = 2;
    while (p + 4 <= dv.byteLength) {
      if (dv.getUint8(p) !== 0xFF) break;
      var marker = dv.getUint8(p + 1);
      if (marker === 0xDA || marker === 0xD9) break;
      var len = dv.getUint16(p + 2);
      if (marker === 0xE1 && len >= 8 && dv.getUint32(p + 4) === 0x45786966) { // "Exif"
        var base = p + 10;
        if (base + 8 > dv.byteLength) break;
        var little = dv.getUint16(base) === 0x4949;
        var out = { raw: {} };
        try { readIFD(dv, base, base + dv.getUint32(base + 4, little), little, out, 0); } catch (e) { /* truncated */ }
        var r = out.raw;
        var add = function (label, key) { if (r[key] !== undefined && r[key] !== '' && r[key] !== null) { res.fields.push([label, String(r[key])]); } };
        add('Camera make', '0:271'); add('Camera model', '0:272'); add('Software', '0:305');
        add('Date modified', '0:306'); add('Date taken', '5:36867');
        add('Camera serial number', '5:42033'); add('Lens', '5:42036'); add('Owner or artist', '0:315');
        res.hasGPS = r['0:34853'] !== undefined || r['10:2'] !== undefined;
        res.gps = gps(r);
        res.found = res.fields.length > 0 || res.hasGPS;
        break;
      }
      p += 2 + len;
    }
    return res;
  }

  return { parse: parse };
});
