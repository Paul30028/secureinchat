// Builds a tiny little-endian JPEG with EXIF (make, model, GPS) and checks the parser.
const assert = require('assert');
const E = require('../public/tools/assets/exif.js');

const le16 = (n) => [n & 255, (n >> 8) & 255];
const le32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];
const str = (s) => [...Buffer.from(s + '\0')];
const ent = (tag, type, n, val) => [...le16(tag), ...le16(type), ...le32(n), ...val];
const rat = (n, d) => [...le32(n), ...le32(d)];

function build() {
  const make = str('TestCam'), model = str('Model X');
  const entries = 3, gpsEntries = 4;
  const ifd0Len = 2 + entries * 12 + 4;
  const gpsIfdOff = 8 + ifd0Len;
  const gpsLen = 2 + gpsEntries * 12 + 4;
  let dataOff = gpsIfdOff + gpsLen;
  const makeOff = dataOff; dataOff += make.length;
  const modelOff = dataOff; dataOff += model.length;
  const latOff = dataOff; dataOff += 24;
  const lonOff = dataOff;
  const ifd0 = [...le16(entries),
    ...ent(0x010F, 2, make.length, le32(makeOff)),
    ...ent(0x0110, 2, model.length, le32(modelOff)),
    ...ent(0x8825, 4, 1, le32(gpsIfdOff)), ...le32(0)];
  const gpsIfd = [...le16(gpsEntries),
    ...ent(1, 2, 2, [78, 0, 0, 0]),
    ...ent(2, 5, 3, le32(latOff)),
    ...ent(3, 2, 2, [69, 0, 0, 0]),
    ...ent(4, 5, 3, le32(lonOff)), ...le32(0)];
  const lat = [...rat(31, 1), ...rat(14, 1), ...rat(0, 1)];
  const lon = [...rat(121, 1), ...rat(28, 1), ...rat(30, 1)];
  const tiff = [0x49, 0x49, 42, 0, ...le32(8), ...ifd0, ...gpsIfd, ...make, ...model, ...lat, ...lon];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const L = app1.length + 2;
  return Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE1, (L >> 8) & 255, L & 255, ...app1, 0xFF, 0xD9]).buffer;
}

const r = E.parse(build());
assert.strictEqual(r.kind, 'jpeg');
assert.ok(r.found && r.hasGPS);
assert.deepStrictEqual(r.fields.map((f) => f[1]), ['TestCam', 'Model X']);
assert.ok(Math.abs(r.gps.lat - 31.2333333) < 1e-5, 'lat ' + r.gps.lat);
assert.ok(Math.abs(r.gps.lon - 121.475) < 1e-5, 'lon ' + r.gps.lon);

assert.strictEqual(E.parse(Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9]).buffer).found, false);
assert.strictEqual(E.parse(new Uint8Array([1, 2, 3, 4, 5]).buffer).kind, 'other');
const full = new Uint8Array(build());
for (let n = 4; n < full.length; n += 7) E.parse(full.slice(0, n).buffer); // truncated input must not throw
console.log('exif tests passed');
