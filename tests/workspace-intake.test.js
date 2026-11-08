// Node tests for the private workspace intake classifier. No DOM, no network, no file reads.
// Run with: node --test tests/*.test.js tests/*.test.mjs (after node build/build.mjs).
const assert = require('assert');
const I = require('../public/workspace/assets/intake.js');

let n = 0;
function t(name, fn) {
  try { fn(); n++; } catch (e) { console.error('FAIL ' + name); throw e; }
}

const file = (name, type = '', size = 1200) => ({ name, type, size });

t('plain text goes to text mode', () => {
  const r = I.classify('Hello, my number is 555-0100.');
  assert.strictEqual(r.kind, 'text');
  assert.strictEqual(r.mode, 'text');
  assert.strictEqual(r.text, 'Hello, my number is 555-0100.');
});

t('single http URL goes to link mode', () => {
  const r = I.classify('https://example.com/page?utm_source=newsletter');
  assert.strictEqual(r.kind, 'url');
  assert.strictEqual(r.mode, 'link');
  assert.strictEqual(r.url, 'https://example.com/page?utm_source=newsletter');
});

t('URL with surrounding spaces is still a single link', () => {
  const r = I.classify('  https://example.com/a  \n');
  assert.strictEqual(r.kind, 'url');
  assert.strictEqual(r.url, 'https://example.com/a');
});

t('URL with an internal space is text, not a link', () => {
  const r = I.classify('https://example.com/a b');
  assert.strictEqual(r.kind, 'text');
  assert.strictEqual(r.mode, 'text');
});

t('www and bare domains are links', () => {
  assert.strictEqual(I.classify('www.example.com/x').mode, 'link');
  assert.strictEqual(I.classify('example.com/x?q=1').mode, 'link');
  assert.strictEqual(I.classify('sub.example.co.uk:8443/x').mode, 'link');
});

t('a multi-line text with a link stays text', () => {
  const r = I.classify('Look at this:\nhttps://example.com\nand tell me.');
  assert.strictEqual(r.kind, 'text');
  assert.strictEqual(r.mode, 'text');
});

t('a link on its own line inside a longer message stays text', () => {
  const r = I.classify('Please check https://example.com before Friday.');
  assert.strictEqual(r.kind, 'text');
});

t('email-looking text is not a URL', () => {
  assert.strictEqual(I.classify('bob@example.com').kind, 'text');
});

t('a bare file name is text, not a link', () => {
  assert.strictEqual(I.classify('report.docx').kind, 'text');
  assert.strictEqual(I.classify('photo.jpg').kind, 'text');
});

t('empty and whitespace-only input is empty', () => {
  assert.strictEqual(I.classify('').kind, 'empty');
  assert.strictEqual(I.classify('   \n\t ').kind, 'empty');
  assert.strictEqual(I.classify({}).kind, 'empty');
  assert.strictEqual(I.classify({ text: '' }).kind, 'empty');
  assert.strictEqual(I.classify(null).kind, 'empty');
});

t('PDF, DOCX, XLSX and PPTX go to file mode', () => {
  for (const name of ['report.pdf', 'letter.docx', 'budget.xlsx', 'slides.pptx']) {
    const r = I.classify({ files: [file(name)] });
    assert.strictEqual(r.kind, 'file', name);
    assert.strictEqual(r.mode, 'file', name);
    assert.strictEqual(r.ext, name.split('.').pop(), name);
  }
});

t('extension matching is case-insensitive and MIME is a fallback', () => {
  assert.strictEqual(I.classify({ files: [file('A.DOCX')] }).ext, 'docx');
  const r = I.classify({ files: [{ name: 'no-extension', type: 'application/pdf', size: 10 }] });
  assert.strictEqual(r.mode, 'file');
  assert.strictEqual(r.ext, 'pdf');
});

t('JPEG, PNG and WebP go to image mode', () => {
  for (const name of ['a.jpg', 'b.jpeg', 'c.png', 'd.webp']) {
    assert.strictEqual(I.classify({ files: [file(name)] }).mode, 'image', name);
  }
  assert.strictEqual(I.classify({ files: [{ name: 'x', type: 'image/png' }] }).mode, 'image');
});

t('an unknown extension is reported, not guessed', () => {
  const r = I.classify({ files: [file('archive.zip')] });
  assert.strictEqual(r.kind, 'unknown');
  assert.strictEqual(r.mode, null);
  assert.strictEqual(r.reason, 'unknown-type');
});

t('unsupported image formats are reported as unsupported-image', () => {
  const r = I.classify({ files: [file('photo.gif')] });
  assert.strictEqual(r.kind, 'unknown');
  assert.strictEqual(r.reason, 'unsupported-image');
});

t('old Office formats point at the newer extension', () => {
  const r = I.classify({ files: [file('old.doc')] });
  assert.strictEqual(r.kind, 'unknown');
  assert.strictEqual(r.reason, 'legacy-office');
});

t('multiple files are not auto-classified', () => {
  const r = I.classify({ files: [file('a.pdf'), file('b.pdf')] });
  assert.strictEqual(r.kind, 'multiple');
  assert.strictEqual(r.mode, null);
  assert.strictEqual(r.files.length, 2);
});

t('files win over a text fallback', () => {
  const f = file('report.pdf');
  const r = I.classify({ text: 'https://example.com', files: [f] });
  assert.strictEqual(r.mode, 'file');
  assert.strictEqual(r.file, f);
});

t('classification does not modify the input file', () => {
  const f = file('report.pdf');
  const before = JSON.stringify(f);
  I.classify({ files: [f] });
  assert.strictEqual(JSON.stringify(f), before);
});

console.log(`workspace-intake: ${n} groups passed`);
