// Drives the real workspace.js intake and File-mode flow in a fake DOM. No browser, no WASM:
// WSFile is a stub, so this checks the page's automatic switch, rendering, consent checkbox,
// download trigger and cleanup. Run with: node --test tests/*.test.js
const assert = require('assert');
const { test } = require('node:test');
const I = require('../public/workspace/assets/intake.js');

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
    this.id = ''; this.className = ''; this.hidden = false; this.value = '';
    this.textContent = ''; this.children = []; this.parentNode = null; this.firstChild = null;
    this.listeners = Object.create(null); this.attrs = Object.create(null);
    this.classList = new ClassList(this); this.files = null; this.tabIndex = 0;
    this.type = ''; this.disabled = false; this.checked = false; this.href = ''; this.download = '';
  }
  sync() { this.firstChild = this.children[0] || null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); this.sync(); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; this.sync(); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  addEventListener(type, fn) { (this.listeners[type] || (this.listeners[type] = [])).push(fn); }
  focus() {}
  click() { if (this.tagName === 'A') downloads.push({ href: this.href, download: this.download }); this.dispatch('click', {}); }
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

const downloads = []; const urls = []; const revoked = []; const winListeners = Object.create(null);
const docListeners = Object.create(null);
const metadata = { name: 'report.docx', ext: 'docx', label: 'DOCX', size: 4096, outputName: 'file-cleaned.docx', total: 2,
  groups: [{ name: 'Document properties', items: [{ name: 'creator', value: 'Secret Author' }, { name: 'Company', value: 'Secret Corp' }] }] };

function buildDom() {
  const byId = new Map(); const created = [];
  function get(id) {
    if (!byId.has(id)) { const found = created.find((el) => el.id === id); byId.set(id, found || new El('div')); if (!found) byId.get(id).id = id; }
    return byId.get(id);
  }
  const tabs = new El('div'); const body = new El('body');
  const documentFake = {
    readyState: 'complete', body: body, getElementById: get,
    querySelector: (sel) => (sel === '.tabs' ? tabs : null),
    addEventListener(type, fn) { (docListeners[type] || (docListeners[type] = [])).push(fn); },
    createElement(tag) { const el = new El(tag); created.push(el); return el; }
  };
  const windowFake = {
    location: { search: '' }, confirm: () => true, setTimeout: setTimeout,
    addEventListener(type, fn) { winListeners[type] = fn; },
    WSIntake: I,
    WSFile: {
      inspect: () => ({ ok: true, ext: 'docx', label: 'DOCX', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 4096, outputName: 'file-cleaned.docx' }),
      analyze: async () => ({ ok: true, ...metadata }),
      clean: async () => ({ ok: true, bytes: Uint8Array.from([0x50, 0x4B]), outputName: 'file-cleaned.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', remaining: [], remainingGroups: [] }),
      formatBytes: () => '4.0 KB'
    }
  };
  const fakeURL = {
    createObjectURL(blob) { const u = 'blob:test-' + urls.length; urls.push({ url: u, blob: blob }); return u; },
    revokeObjectURL(u) { revoked.push(u); }
  };
  return { get, tabs, body, documentFake, windowFake, fakeURL };
}

async function settle() { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); }

test('workspace intake and file flow in a fake DOM', async () => {
  const saved = { document: global.document, window: global.window, URL: global.URL };
  const dom = buildDom();
  global.document = dom.documentFake; global.window = dom.windowFake; global.URL = dom.fakeURL;
  dom.get('tab-text').setAttribute('data-mode', 'text');
  dom.get('tab-link').setAttribute('data-mode', 'link');
  dom.get('tab-image').setAttribute('data-mode', 'image');
  dom.get('tab-file').setAttribute('data-mode', 'file');
  dom.get('panel-text').hidden = true; dom.get('panel-link').hidden = true;
  dom.get('panel-image').hidden = true; dom.get('panel-file').hidden = true;
  try {
    require('../public/workspace/assets/workspace.js');
    const intake = dom.get('intake-file');
    intake.type = 'file';
    const file = {
      name: 'report.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 4096,
      arrayBuffer: async () => new Uint8Array([0x50, 0x4B]).buffer
    };
    intake.files = [file];
    intake.dispatch('change', { target: intake });
    assert.match(textOf(dom.get('status')), /Recognised as a DOCX file/, 'status announces the automatic switch');
    await settle();

    assert.strictEqual(dom.get('panel-file').hidden, false, 'choosing a DOCX opens File mode');
    assert.strictEqual(dom.get('tab-file').getAttribute('aria-selected'), 'true');
    const result = dom.get('file-result');
    assert.match(textOf(result), /Secret Author/);
    assert.match(textOf(result), /Secret Corp/);
    assert.match(textOf(result), /Only the metadata fields listed above are cleared/);

    const box = dom.get('file-confirm');
    assert.ok(box, 'a consent checkbox is shown');
    assert.strictEqual(dom.get('file-generate').disabled, true, 'generate starts disabled');
    box.checked = true; box.dispatch('change');
    assert.strictEqual(dom.get('file-generate').disabled, false, 'ticking the box enables generate');
    assert.strictEqual(urls.length, 0, 'nothing is created before the click');

    dom.get('file-generate').dispatch('click');
    await settle();
    assert.strictEqual(urls.length, 1, 'generate creates one in-memory copy');
    const button = dom.get('download-file');
    assert.ok(button, 'a download button appears');
    button.click();
    assert.strictEqual(downloads.length, 1, 'download starts only after the click');
    assert.strictEqual(downloads[0].download, 'file-cleaned.docx');
    assert.strictEqual(downloads[0].href, urls[0].url);

    // Pasting one URL switches to Link mode and releases the file copy.
    const paste = { target: dom.body, preventDefault() {}, clipboardData: { files: [], getData: () => 'https://example.com/a?utm_source=x' } };
    for (const fn of docListeners.paste || []) fn(paste);
    assert.strictEqual(dom.get('panel-link').hidden, false, 'pasting a URL opens Link mode');
    assert.strictEqual(dom.get('link-url').value, 'https://example.com/a?utm_source=x');
    assert.match(textOf(dom.get('status')), /Recognised as a link/);
    assert.deepStrictEqual(revoked, [urls[0].url], 'switching modes revokes the file object URL');
    assert.strictEqual(dom.get('file-result').hidden, true, 'switching modes hides the file result');

    // Pasting plain text switches to Text mode and fills the draft.
    const pasteText = { target: dom.body, preventDefault() {}, clipboardData: { files: [], getData: () => 'hello 555-0100' } };
    for (const fn of docListeners.paste || []) fn(pasteText);
    assert.strictEqual(dom.get('panel-text').hidden, false, 'pasting text opens Text mode');
    assert.strictEqual(dom.get('draft').value, 'hello 555-0100');

    console.log('workspace file DOM flow test passed');
  } finally {
    if (saved.document === undefined) delete global.document; else global.document = saved.document;
    if (saved.window === undefined) delete global.window; else global.window = saved.window;
    if (saved.URL === undefined) delete global.URL; else global.URL = saved.URL;
  }
});
