// Node tests for the /shop/ structure (T10). Run: node tests/shop.test.mjs
// The sample product below is test data only. It is never added to PRODUCTS or published.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS, FIELDS, validateProduct, productBody, shopIndexBody } from '../build/shop.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PUB = path.resolve(import.meta.dirname, '..', 'public');
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error('FAIL', name); throw e; } };

const sample = () => ({
  slug: 'sample-item', name: 'Sample item',
  protects: 'Stops the sample risk described here in plain words.',
  forWho: 'People who face the sample risk; others do not need it.',
  checkYourself: 'Follow these sample steps at home to see that it works.',
  evidence: { status: 'tested', date: '2026-10-22', method: 'Sample method described in enough detail to repeat.' },
  limits: 'Does not stop other risks and can fail in sample cases.',
  type: 'hardware',
  terms: { amount: 10, currency: 'USD', billing: 'one-time', refund: '30 days, unopened.' },
  data: { product: 'The sample item processes nothing and has no network connection.', commerce: 'Payment and delivery address are handled by the sample checkout provider.', retention: 'Order records are kept as long as tax law requires and then deleted.' },
  supplier: { name: 'Sample maker', ships: 'Sample countries.', returns: '30 days, unopened.' },
  commission: { earns: false },
});

t('no products are published yet', () => assert.strictEqual(PRODUCTS.length, 0));
t('nine fields in the agreed order', () => assert.deepStrictEqual(FIELDS.map((f) => f.key), ['protects', 'forWho', 'checkYourself', 'evidence', 'limits', 'terms', 'data', 'supplier', 'commission']));
t('complete sample is valid', () => assert.deepStrictEqual(validateProduct(sample()), []));
t('missing check-yourself is rejected', () => { const p = sample(); delete p.checkYourself; assert.ok(validateProduct(p).some((e) => e.startsWith('checkYourself'))); });
t('tested without date or method is rejected', () => {
  const p = sample(); p.evidence = { status: 'tested' };
  const e = validateProduct(p);
  assert.ok(e.some((x) => x.includes('date')) && e.some((x) => x.includes('method')));
});
t('documented needs an https source', () => {
  const p = sample(); p.evidence = { status: 'documented', source: 'http://x' };
  assert.ok(validateProduct(p).some((x) => x.includes('source')));
  p.evidence.source = 'https://example.org/spec'; assert.deepStrictEqual(validateProduct(p), []);
});
t('untested is allowed but labelled', () => {
  const p = sample(); p.evidence = { status: 'untested' };
  assert.deepStrictEqual(validateProduct(p), []);
  const h = productBody(p, esc);
  assert.ok(h.includes('tag--untested') && h.includes('We have not tested this yet'));
});
t('commission must be explicit and name the payer', () => {
  const p = sample(); delete p.commission; assert.ok(validateProduct(p).some((x) => x.startsWith('commission')));
  p.commission = { earns: true }; assert.ok(validateProduct(p).some((x) => x.includes('commission.from')));
});
t('affiliate label sits next to the buy link', () => {
  const p = sample(); p.commission = { earns: true, from: 'Sample maker' }; p.buyUrl = 'https://shop.example/buy';
  assert.deepStrictEqual(validateProduct(p), []);
  const h = productBody(p, esc);
  assert.ok(/Buy for \$10<\/a> <span class="tag tag--aff">Affiliate<\/span>/.test(h));
});
t('buy link needs https', () => { const p = sample(); p.buyUrl = 'http://x'; assert.ok(validateProduct(p).some((x) => x.includes('https'))); });
t('terms, type and data handling are required', () => {
  const p = sample(); delete p.terms; delete p.type; p.data = { product: 'short' };
  const e = validateProduct(p);
  assert.ok(e.some((x) => x.startsWith('terms')) && e.some((x) => x.startsWith('type')) && e.some((x) => x.startsWith('data.product')) && e.some((x) => x.startsWith('data.commerce')));
});
t('recurring billing is spelled out next to the price', () => {
  const p = sample(); p.terms = { amount: 4.5, currency: 'EUR', billing: 'monthly', refund: 'Cancel any time; no refund for the current month.' };
  assert.ok(productBody(p, esc).includes('EUR 4.50, renews every month until you cancel'));
});
t('audited needs auditor, date and report link', () => {
  const p = sample(); p.evidence = { status: 'audited' }; assert.ok(validateProduct(p).some((x) => x.startsWith('audited')));
  p.evidence = { status: 'audited', auditor: 'Sample Lab', date: '2026-10-01', report: 'https://example.org/audit.pdf' }; assert.deepStrictEqual(validateProduct(p), []);
  assert.ok(productBody(p, esc).includes('Independently audited'));
});
t('open source label links to the code', () => {
  const p = sample(); p.openSource = 'ftp://x'; assert.ok(validateProduct(p).some((x) => x.startsWith('openSource')));
  p.openSource = 'https://example.org/src'; assert.ok(productBody(p, esc).includes('href="https://example.org/src"'));
});
t('banned claims are rejected', () => {
  for (const w of ['100% secure', 'unbreakable', 'military-grade', '100 % anonymous']) {
    const p = sample(); p.protects = `This sample is ${w} against every risk.`;
    assert.ok(validateProduct(p).some((x) => x.startsWith('banned')), w);
  }
});
t('bad slug rejected', () => { const p = sample(); p.slug = 'Bad Slug'; assert.ok(validateProduct(p).some((x) => x.startsWith('slug'))); });
t('product page shows every field heading in order', () => {
  const h = productBody(sample(), esc);
  let at = -1; for (const f of FIELDS) { const i = h.indexOf(`<h2>${f.label}</h2>`); assert.ok(i > at, f.label); at = i; }
  assert.ok(h.includes('Tested on 2026-10-22') && h.includes('Not on sale yet'));
});
t('copy is escaped', () => { const p = sample(); p.name = '<script>x</script>'; assert.ok(!productBody(p, esc).includes('<script>')); });
t('empty index says there are no products', () => assert.ok(shopIndexBody([], esc, '2026-10-22').includes('There are no products yet')));

// Built output
const shop = fs.readFileSync(path.join(PUB, 'shop/index.html'), 'utf8');
const home = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(PUB, 'sitemap.xml'), 'utf8');
const headers = fs.readFileSync(path.join(PUB, '_headers'), 'utf8');
t('built /shop/ is noindex while empty', () => assert.ok(shop.includes('<meta name="robots" content="noindex" />')));
t('/shop/ is not in the navigation or linked from home', () => {
  assert.ok(!/<nav class="nav"[\s\S]*?\/shop\/[\s\S]*?<\/nav>/.test(home));
  assert.ok(!home.includes('href="/shop/"'));
});
t('/shop/ is not in the sitemap while empty', () => assert.ok(!sitemap.includes('/shop/')));
t('/shop/ has a CSP header', () => assert.ok(/\n\/shop\/\n  Content-Security-Policy: /.test(headers)));
t('no other page is noindex', () => assert.ok(!home.includes('noindex')));
console.log(`shop tests: ${n} passed`);
