// Node tests for the private workspace image checks. They never decode an image, upload one or
// touch the DOM. Run with: node --test tests/*.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const I = require('../public/workspace/assets/image-review.js');
let n = 0;
function t(name, fn) { fn(); n++; }
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function put16be(b, i, v) { b[i] = (v >> 8) & 0xFF; b[i + 1] = v & 0xFF; }
function put32be(b, i, v) {
  b[i] = (v >>> 24) & 0xFF; b[i + 1] = (v >>> 16) & 0xFF; b[i + 2] = (v >>> 8) & 0xFF; b[i + 3] = v & 0xFF;
}
function put32le(b, i, v) {
  b[i] = v & 0xFF; b[i + 1] = (v >>> 8) & 0xFF; b[i + 2] = (v >>> 16) & 0xFF; b[i + 3] = (v >>> 24) & 0xFF;
}

function png(w, h) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
  put32be(b, 8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  put32be(b, 16, w);
  put32be(b, 20, h);
  b[24] = 8; b[25] = 6; b[26] = 0; b[27] = 0; b[28] = 0;
  return b;
}

function jpeg(w, h) {
  const app0 = [0xFF, 0xE0, 0x00, 0x10].concat(new Array(14).fill(0));
  const sof = [0xFF, 0xC0, 0x00, 0x11, 0x08];
  const hb = [0, 0], wb = [0, 0];
  put16be(hb, 0, h); put16be(wb, 0, w);
  return Uint8Array.from([0xFF, 0xD8].concat(app0, sof, hb, wb, [0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]));
}

function webpVp8x(w, h) {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  put32le(b, 4, 22);                  // file size minus 8
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  b.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  put32le(b, 16, 10);
  put32le(b, 24, w - 1);
  put32le(b, 27, h - 1);
  return b;
}

function webpVp8l(w, h) {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0);
  put32le(b, 4, 22);
  b.set([0x57, 0x45, 0x42, 0x50], 8);
  b.set([0x56, 0x50, 0x38, 0x4C], 12); // VP8L
  put32le(b, 16, 10);
  b[20] = 0x2F;
  const bits = (w - 1) | ((h - 1) << 14);
  put32le(b, 21, bits);
  return b;
}

t('sniff accepts the three required magic numbers', () => {
  assert.strictEqual(I.sniff(Uint8Array.from([0xFF, 0xD8, 0xFF])).format, 'jpeg');
  assert.strictEqual(I.sniff(Uint8Array.from([0x89, 0x50, 0x4E, 0x47])).format, 'png');
  assert.strictEqual(I.sniff(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])).format, 'webp');
});

t('sniff rejects empty, short and unknown signatures instead of using a name', () => {
  assert.strictEqual(I.sniff(new Uint8Array(0)).error, 'empty');
  assert.strictEqual(I.sniff(Uint8Array.from([0xFF, 0xD8])).error, 'magic');
  assert.strictEqual(I.sniff(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])).error, 'magic');
  assert.strictEqual(I.sniff(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20])).error, 'magic');
});

t('sniff accepts ArrayBuffer and Buffer-like views', () => {
  const bytes = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE0]);
  assert.strictEqual(I.sniff(bytes.buffer).format, 'jpeg');
  assert.strictEqual(I.sniff(Buffer.from(bytes)).format, 'jpeg');
});

t('readDimensions reads PNG IHDR', () => {
  const r = I.readDimensions(png(4032, 3024), 'png');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.width, 4032);
  assert.strictEqual(r.height, 3024);
});

t('readDimensions reads JPEG SOF after an APP segment', () => {
  const r = I.readDimensions(jpeg(640, 480), 'jpeg');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.width, 640);
  assert.strictEqual(r.height, 480);
});

t('readDimensions reads WebP VP8X and VP8L headers', () => {
  const x = I.readDimensions(webpVp8x(1200, 800), 'webp');
  assert.strictEqual(x.width, 1200);
  assert.strictEqual(x.height, 800);
  const l = I.readDimensions(webpVp8l(333, 222), 'webp');
  assert.strictEqual(l.width, 333);
  assert.strictEqual(l.height, 222);
});

t('readDimensions returns no guess for a truncated header', () => {
  assert.strictEqual(I.readDimensions(Uint8Array.from([0xFF, 0xD8, 0xFF]), 'jpeg').ok, false);
  assert.strictEqual(I.readDimensions(Uint8Array.from([0x89, 0x50, 0x4E, 0x47]), 'png').ok, false);
  assert.strictEqual(I.readDimensions(new Uint8Array(0), 'webp').ok, false);
});

t('inspect accepts a valid JPEG and reports its size', () => {
  const r = I.inspect({ type: 'image/jpeg', size: 12345, bytes: jpeg(640, 480) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.format, 'jpeg');
  assert.strictEqual(r.mime, 'image/jpeg');
  assert.strictEqual(r.ext, 'jpg');
  assert.strictEqual(r.width, 640);
  assert.strictEqual(r.height, 480);
  assert.strictEqual(r.pixels, 307200);
  assert.strictEqual(r.dimensionsKnown, true);
  assert.strictEqual(r.quality, 0.92);
  assert.strictEqual(r.outputName, 'image-cleaned.jpg');
});

t('inspect normalises a MIME type with parameters and upper case', () => {
  const r = I.inspect({ type: 'IMAGE/PNG; charset=binary', size: 100, bytes: png(10, 10) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.format, 'png');
});

t('a missing MIME type is refused with a clear code', () => {
  const r = I.inspect({ type: '', size: 100, bytes: png(10, 10) });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, 'mime-missing');
  assert.match(r.message, /JPEG, PNG or WebP/);
});

t('an unsupported MIME type is refused even when the bytes look valid', () => {
  const r = I.inspect({ type: 'image/gif', size: 100, bytes: png(10, 10) });
  assert.strictEqual(r.error, 'mime-unsupported');
  assert.match(r.message, /image\/gif/);
});

t('MIME and magic must agree', () => {
  const r = I.inspect({ type: 'image/jpeg', size: 100, bytes: png(10, 10) });
  assert.strictEqual(r.error, 'mismatch');
  assert.match(r.message, /PNG/);
  assert.match(r.message, /image\/jpeg/);
});

t('a file over 25 MB is refused and the limit is stated', () => {
  const r = I.inspect({ type: 'image/jpeg', size: I.LIMIT_BYTES + 1, bytes: jpeg(10, 10) });
  assert.strictEqual(r.error, 'too-large');
  assert.match(r.message, /25 MB/);
  assert.match(r.message, /26,214,400/);
});

t('exactly 25 MB is allowed', () => {
  const r = I.inspect({ type: 'image/jpeg', size: I.LIMIT_BYTES, bytes: jpeg(10, 10) });
  assert.strictEqual(r.ok, true);
});

t('exactly 40,000,000 pixels is allowed and one pixel more is refused', () => {
  const ok = I.inspect({ type: 'image/png', size: 100, bytes: png(8000, 5000) });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(ok.pixels, 40000000);
  const bad = I.inspect({ type: 'image/png', size: 100, bytes: png(8000, 5001) });
  assert.strictEqual(bad.error, 'too-many-pixels');
  assert.match(bad.message, /40,000,000/);
  assert.match(bad.message, /8,000 × 5,001/);
});

t('tooManyPixels uses the same boundary', () => {
  assert.strictEqual(I.tooManyPixels(8000, 5000), false);
  assert.strictEqual(I.tooManyPixels(8000, 5001), true);
});

t('a truncated header is accepted for decoding, not guessed', () => {
  const r = I.inspect({ type: 'image/jpeg', size: 3, bytes: Uint8Array.from([0xFF, 0xD8, 0xFF]) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.dimensionsKnown, false);
  assert.strictEqual(r.pixels, 0);
});

t('empty bytes and random bytes are refused without throwing', () => {
  assert.strictEqual(I.inspect({ type: 'image/jpeg', size: 0, bytes: new Uint8Array(0) }).error, 'empty');
  const random = new Uint8Array(64);
  for (let i = 0; i < random.length; i++) random[i] = i;
  assert.strictEqual(I.inspect({ type: 'image/webp', size: 64, bytes: random }).error, 'magic');
  assert.doesNotThrow(() => I.readDimensions(random, 'jpeg'));
});

t('output names never reuse the original name', () => {
  assert.strictEqual(I.outputName('jpeg'), 'image-cleaned.jpg');
  assert.strictEqual(I.outputName('png'), 'image-cleaned.png');
  assert.strictEqual(I.outputName('webp'), 'image-cleaned.webp');
  assert.strictEqual(I.outputName('gif'), '');
  assert.strictEqual(I.outputMime('jpeg'), 'image/jpeg');
  assert.strictEqual(I.outputMime('png'), 'image/png');
  assert.strictEqual(I.outputMime('webp'), 'image/webp');
});

t('JPEG and WebP use quality 0.92; PNG has no quality setting', () => {
  assert.deepStrictEqual(I.encodeOptions('jpeg'), { type: 'image/jpeg', quality: 0.92 });
  assert.deepStrictEqual(I.encodeOptions('webp'), { type: 'image/webp', quality: 0.92 });
  assert.deepStrictEqual(I.encodeOptions('png'), { type: 'image/png', quality: null });
  assert.strictEqual(I.encodeOptions('gif'), null);
});

t('formatBytes is readable and does not round a limit down', () => {
  assert.strictEqual(I.formatBytes(0), '0 B');
  assert.strictEqual(I.formatBytes(1023), '1023 B');
  assert.strictEqual(I.formatBytes(1024), '1.0 KB');
  assert.strictEqual(I.formatBytes(I.LIMIT_BYTES), '25 MB');
  assert.strictEqual(I.formatBytes(I.LIMIT_BYTES + 1), '25.0 MB');
});

// Built-page wiring. These checks do not decode an image; they make sure the static page actually
// offers the file field, the external module, the result region and the limits the code assumes.
const html = read('public/workspace/index.html');
const js = read('public/workspace/assets/workspace.js');
const css = read('public/workspace/assets/workspace.css');
const baseCss = read('public/assets/css/base.css');
const tokenCss = read('public/assets/css/tokens.css');

t('the built page has an image tab and panel wired like text and link', () => {
  assert.match(html, /id="tab-image"[^>]*data-mode="image"/);
  assert.match(html, /id="tab-image"[^>]*aria-controls="panel-image"/);
  assert.match(html, /id="panel-image"[^>]*role="tabpanel"[^>]*hidden/);
  assert.match(html, /id="image-result"/);
});

t('the image field accepts exactly the three supported formats and is not drag-only', () => {
  assert.match(html, /id="image-file" type="file" accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(html, /id="image-file"[^>]*\bmultiple\b/);
  assert.match(html, /The file field always works with a keyboard/);
});

t('image-review.js is loaded as an external script before workspace.js', () => {
  assert.match(html, /<script src="\/workspace\/assets\/image-review\.js" defer><\/script>/);
  assert.ok(html.indexOf('image-review.js') < html.indexOf('workspace.js'), 'image-review loads first');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/i);
});

t('the page states the metadata, quality and visible-content limits next to the control', () => {
  assert.match(html, /drops most metadata chunks/);
  assert.match(html, /Quality, colour and transparency can change/);
  assert.match(html, /Animated PNG or WebP files become a single still frame/);
  assert.match(html, /faces, house numbers, screens/);
  assert.match(html, /Image mode: re-encoding, not a privacy check/);
  assert.match(html, /Image mode re-encodes a local copy/);
});

t('workspace.js uses a canvas re-encode and revokes its object URL', () => {
  assert.match(js, /createImageBitmap/);
  assert.match(js, /canvas\.toBlob/);
  assert.match(js, /URL\.createObjectURL/);
  assert.match(js, /URL\.revokeObjectURL/);
  assert.match(js, /link\.download = name/);
  assert.match(js, /an animated file becomes one still frame/);
  assert.doesNotMatch(js, /\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/);
});

t('workspace CSS has no type below 12px, 16px body copy and 44px controls', () => {
  const sizes = [];
  for (const m of (css + '\n' + baseCss).matchAll(/font-size:\s*([0-9.]+)px/g)) sizes.push(Number(m[1]));
  for (const m of (css + '\n' + baseCss).matchAll(/font:\s*[^;{}]*?([0-9.]+)px/g)) sizes.push(Number(m[1]));
  assert.ok(sizes.length > 0, 'font sizes parsed');
  assert.deepStrictEqual(sizes.filter((v) => v < 12), []);
  // Body copy moved to the shared base layer; 1rem is the 16px token it consumes.
  assert.match(tokenCss, /--sc-text-base:\s*1rem/);
  assert.match(baseCss, /font-size:\s*var\(--sc-text-base\)/);
  assert.match(css, /@import url\('\/assets\/css\/base\.css'\)/);
  assert.match(css, /\.btn\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.btn--small\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.tab\s*\{[^}]*min-height:\s*48px/);
  assert.match(css, /\.file-zone/);
  assert.match(css, /\.image-grid/);
});

t('the edited source and built files use LF endings', () => {
  for (const f of [
    'src/workspace/workspace.html', 'src/workspace/workspace.js', 'src/workspace/workspace.css',
    'src/workspace/image-review.js', 'tests/workspace-image.test.js', 'tests/workspace-image-dom.test.js', 'build/build.mjs',
    'public/workspace/index.html', 'public/workspace/assets/workspace.js',
    'public/workspace/assets/workspace.css', 'public/workspace/assets/image-review.js'
  ]) {
    assert.strictEqual(fs.readFileSync(path.join(ROOT, f)).includes(13), false, f + ' has CR bytes');
  }
});

console.log(n + ' workspace image tests passed');
