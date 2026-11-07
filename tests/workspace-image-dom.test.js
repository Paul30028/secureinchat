// Drives the real workspace.js image flow in a tiny fake DOM. No browser, no canvas and no
// network are involved: createImageBitmap, canvas.toBlob and URL are fakes, so this checks the
// page's control flow, cleanup and download trigger rather than image rendering.
const assert = require('assert');
const { test } = require('node:test');
const I = require('../public/workspace/assets/image-review.js');

function put16be(b, i, v) { b[i] = (v >> 8) & 0xFF; b[i + 1] = v & 0xFF; }
function put32be(b, i, v) {
  b[i] = (v >>> 24) & 0xFF; b[i + 1] = (v >>> 16) & 0xFF; b[i + 2] = (v >>> 8) & 0xFF; b[i + 3] = v & 0xFF;
}
function png(w, h) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
  put32be(b, 8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  put32be(b, 16, w);
  put32be(b, 20, h);
  b[24] = 8; b[25] = 6;
  return b;
}

class ClassList {
  constructor(el) { this.el = el; }
  set() { return new Set(this.el.className.split(/\s+/).filter(Boolean)); }
  write(s) { this.el.className = Array.from(s).join(' '); }
  add(c) { const s = this.set(); s.add(c); this.write(s); }
  remove(c) { const s = this.set(); s.delete(c); this.write(s); }
  toggle(c, on) { const s = this.set(); if (on === undefined ? !s.has(c) : on) s.add(c); else s.delete(c); this.write(s); }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.id = '';
    this.className = '';
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.children = [];
    this.parentNode = null;
    this.firstChild = null;
    this.listeners = Object.create(null);
    this.attrs = Object.create(null);
    this.classList = new ClassList(this);
    this.files = null;
    this.tabIndex = 0;
    this.type = '';
    this.disabled = false;
    this.checked = false;
    this.href = '';
    this.download = '';
  }
  sync() { this.firstChild = this.children[0] || null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); this.sync(); return c; }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parentNode = null;
    this.sync();
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  addEventListener(type, fn) { (this.listeners[type] || (this.listeners[type] = [])).push(fn); }
  focus() {}
  click() {
    if (this.tagName === 'A') downloads.push({ href: this.href, download: this.download });
    this.dispatch('click', {});
  }
  dispatch(type, extra) {
    const event = Object.assign({ type: type, target: this, currentTarget: this, preventDefault() {}, stopPropagation() {} }, extra || {});
    for (const fn of this.listeners[type] || []) fn.call(this, event);
  }
}

function textOf(node) {
  let out = node.textContent || '';
  for (const child of node.children) out += textOf(child);
  return out;
}

const downloads = [];
const urls = [];
const revoked = [];
const winListeners = Object.create(null);
let bitmapsClosed = 0;

function buildDom() {
  const byId = new Map();
  const created = [];
  function get(id) {
    if (!byId.has(id)) {
      const found = created.find((el) => el.id === id);
      byId.set(id, found || new El('div'));
      if (!found) byId.get(id).id = id;
    }
    return byId.get(id);
  }
  const tabs = new El('div');
  const body = new El('body');
  const documentFake = {
    readyState: 'complete',
    body: body,
    getElementById: get,
    querySelector: (sel) => (sel === '.tabs' ? tabs : null),
    addEventListener() {},
    createElement(tag) {
      const el = new El(tag);
      created.push(el);
      if (tag === 'canvas') {
        el.width = 0;
        el.height = 0;
        el.getContext = () => ({ drawImage() {} });
        el.toBlob = (cb, type) => {
          const out = new Blob([Uint8Array.from([0x89, 0x50, 0x4E, 0x47])], { type: type || 'image/png' });
          setTimeout(() => cb(out), 0);
        };
      }
      return el;
    }
  };
  const windowFake = {
    location: { search: '?mode=image' },
    confirm: () => true,
    setTimeout: setTimeout,
    addEventListener(type, fn) { winListeners[type] = fn; },
    WSImage: I,
    createImageBitmap: async () => ({ width: 64, height: 32, close() { bitmapsClosed++; } })
  };
  const fakeURL = {
    createObjectURL(blob) { const u = 'blob:test-' + urls.length; urls.push({ url: u, blob: blob }); return u; },
    revokeObjectURL(u) { revoked.push(u); }
  };
  return { get, tabs, body, documentFake, windowFake, fakeURL };
}

async function settle() {
  for (let i = 0; i < 25; i++) await new Promise((r) => setTimeout(r, 0));
}

test('workspace image flow in a fake DOM', async () => {
  const saved = {
    document: global.document, window: global.window, URL: global.URL,
    createImageBitmap: global.createImageBitmap
  };
  const dom = buildDom();
  global.document = dom.documentFake;
  global.window = dom.windowFake;
  global.URL = dom.fakeURL;
  global.createImageBitmap = dom.windowFake.createImageBitmap;
  dom.get('tab-text').setAttribute('data-mode', 'text');
  dom.get('tab-link').setAttribute('data-mode', 'link');
  dom.get('tab-image').setAttribute('data-mode', 'image');
  dom.get('panel-text').hidden = true;
  dom.get('panel-link').hidden = true;
  dom.get('panel-image').hidden = true;
  try {
    require('../public/workspace/assets/workspace.js');

    const imageFile = dom.get('image-file');
    imageFile.type = 'file';
    const imageDrop = dom.get('image-drop');

    // init() activates ?mode=image with the attributes and hidden panels set above.
    assert.strictEqual(dom.get('panel-image').hidden, false, 'image mode starts from ?mode=image');
    assert.strictEqual(dom.get('panel-text').hidden, true, 'text panel is hidden');
    assert.strictEqual(dom.get('tab-image').getAttribute('aria-selected'), 'true');

    const bytes = png(64, 32);
    const file = {
      name: 'photo.png', type: 'image/png', size: bytes.length,
      arrayBuffer: async () => bytes.buffer
    };
    imageFile.files = [file];
    imageFile.dispatch('change', { target: imageFile });
    await settle();

    assert.match(textOf(dom.get('status')), /Re-encoded locally/, 'status announces the re-encode');
    const result = dom.get('image-result');
    assert.strictEqual(result.hidden, false, 'result is shown');
    assert.match(textOf(result), /Before/);
    assert.match(textOf(result), /After/);
    assert.match(textOf(result), /64 × 32/);
    assert.match(textOf(result), /PNG/);
    assert.strictEqual(urls.length, 1, 'one object URL is created');
    assert.strictEqual(revoked.length, 0, 'the URL is kept while the result is usable');
    assert.strictEqual(bitmapsClosed, 1, 'the decoded bitmap is closed');

    const button = dom.get('download-image');
    assert.ok(button, 'a download button appears');
    button.click();
    assert.strictEqual(downloads.length, 1, 'download starts only after the click');
    assert.strictEqual(downloads[0].download, 'image-cleaned.png');
    assert.strictEqual(downloads[0].href, urls[0].url);

    // A cancelled mode switch must keep the image and its URL.
    dom.windowFake.confirm = () => false;
    dom.get('tab-link').dispatch('click');
    assert.strictEqual(dom.get('panel-image').hidden, false, 'cancelled switch stays in image mode');
    assert.strictEqual(revoked.length, 0, 'cancelled switch does not revoke');

    dom.windowFake.confirm = () => true;
    dom.get('tab-link').dispatch('click');
    assert.strictEqual(dom.get('panel-image').hidden, true, 'accepted switch leaves image mode');
    assert.strictEqual(revoked.length, 1, 'mode switch revokes the object URL');
    assert.strictEqual(revoked[0], urls[0].url);

    // Leave the page with a live output: pagehide must revoke it.
    dom.get('tab-image').dispatch('click');
    imageFile.files = [file];
    imageFile.dispatch('change', { target: imageFile });
    await settle();
    assert.strictEqual(urls.length, 2);
    winListeners.pagehide();
    assert.strictEqual(revoked.length, 2, 'pagehide revokes the object URL');
    assert.strictEqual(dom.get('image-result').hidden, true, 'pagehide clears the result');

    // Unsupported MIME is refused without reading the file.
    let read = false;
    imageFile.files = [{ name: 'x.gif', type: 'image/gif', size: 20, arrayBuffer: async () => { read = true; return new ArrayBuffer(20); } }];
    imageFile.dispatch('change', { target: imageFile });
    await settle();
    assert.strictEqual(read, false, 'unsupported MIME is refused before reading');
    assert.match(textOf(dom.get('status')), /JPEG, PNG and WebP/);
    assert.match(textOf(dom.get('image-result')), /Image not processed/);
    assert.strictEqual(dom.get('status').getAttribute('data-tone'), 'alert');
    assert.strictEqual(imageFile.value, '', 'a failed file is released from the input');

    // MIME and magic mismatch is refused after reading.
    imageFile.files = [{ name: 'fake.jpg', type: 'image/jpeg', size: bytes.length, arrayBuffer: async () => bytes.buffer }];
    imageFile.dispatch('change', { target: imageFile });
    await settle();
    assert.match(textOf(dom.get('status')), /first bytes are PNG/);
    assert.strictEqual(urls.length, 2, 'a mismatch creates no object URL');

    // Drop is an optional route, not the only route.
    imageDrop.dispatch('drop', { dataTransfer: { files: [file] } });
    await settle();
    assert.strictEqual(urls.length, 3, 'drop processes one file');
    assert.ok(dom.get('download-image'), 'drop produces a download button');

    // Choosing another image releases the previous output URL before the new one is made.
    const droppedUrl = urls[2].url;
    imageFile.files = [file];
    imageFile.dispatch('change', { target: imageFile });
    await settle();
    assert.strictEqual(revoked.length, 3, 'a replacement revokes the previous object URL');
    assert.strictEqual(revoked[2], droppedUrl);
    assert.strictEqual(urls.length, 4, 'the replacement gets a new object URL');

    dom.get('clear-session-image').dispatch('click');
    assert.strictEqual(revoked.length, 4, 'Clear session revokes the object URL');
    assert.strictEqual(dom.get('image-result').hidden, true);

    // Multiple drops are refused instead of silently picking one.
    const before = urls.length;
    imageDrop.dispatch('drop', { dataTransfer: { files: [file, file] } });
    await settle();
    assert.strictEqual(urls.length, before, 'multiple files create no URL');
    assert.match(textOf(dom.get('status')), /one image at a time/);

    console.log('workspace image DOM flow test passed');
  } finally {
    if (saved.document === undefined) delete global.document; else global.document = saved.document;
    if (saved.window === undefined) delete global.window; else global.window = saved.window;
    if (saved.URL === undefined) delete global.URL; else global.URL = saved.URL;
    if (saved.createImageBitmap === undefined) delete global.createImageBitmap; else global.createImageBitmap = saved.createImageBitmap;
  }
});
