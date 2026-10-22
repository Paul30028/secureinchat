// /shop/ structure (T10). Not linked from the navigation and not in the sitemap until a real product exists.
// A product is only published when validateProduct() returns no errors. There are no products yet: do not
// add placeholder or example products here. Example data lives only in tests/shop.test.mjs.

export const PRODUCTS = [];

// Fields every product page shows, in this order (site-redesign-proposal-2026-10-21, section 5).
export const FIELDS = [
  { key: 'protects', label: 'What it protects against', help: 'The specific risk, in one or two sentences. No "100% secure" or "unbreakable" claims.' },
  { key: 'forWho', label: 'Who it is for', help: 'Who benefits, and who does not need it.' },
  { key: 'checkYourself', label: 'How to check it yourself', help: 'Steps a buyer can follow without trusting us, for example a test with a phone or a multimeter.' },
  { key: 'evidence', label: 'Our test evidence', help: 'What we tested, on which date and how. If we have not tested it, the page says Untested.' },
  { key: 'limits', label: 'Known limitations', help: 'What it does not do, and when it can fail.' },
  { key: 'supplier', label: 'Supplier, shipping and returns', help: 'Who makes and ships it, where it ships, and how returns work.' },
  { key: 'commission', label: 'Do we earn a commission?', help: 'Yes or no, and from whom. Shown next to the buy link as well.' },
];

// Categories we decline, with the reason. Each line repeats a rule already published on /principles/ or /mission/.
export const NOT_SOLD = [
  ['Closed-firmware security electronics under our own brand', 'You could not check what they do, so we would be asking for blind trust. See the principles page.'],
  ['Products whose business depends on tracking their users', 'They conflict with the reason this site exists. See the sponsorship rules.'],
  ['Anything that claims to make you anonymous or "100% secure"', 'No product can promise that, and we do not use those words.'],
];

const BANNED = /100\s*%\s*(secure|safe|private|anonymous)|unbreakable|unhackable|military[- ]grade|nsa[- ]proof/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Returns a list of error strings; an empty list means the product may be published.
export function validateProduct(p) {
  const e = [];
  if (!p || typeof p !== 'object') return ['product must be an object'];
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug || '')) e.push('slug must be lowercase words joined by hyphens');
  if (!p.name || !p.name.trim()) e.push('name is required');
  for (const f of ['protects', 'forWho', 'checkYourself', 'limits']) {
    if (typeof p[f] !== 'string' || p[f].trim().length < 20) e.push(`${f} must be at least 20 characters`);
  }
  const ev = p.evidence;
  if (!ev || !['tested', 'documented', 'untested'].includes(ev.status)) e.push('evidence.status must be tested, documented or untested');
  else if (ev.status === 'tested') {
    if (!ISO_DATE.test(ev.date || '')) e.push('tested evidence needs a date (YYYY-MM-DD)');
    if (typeof ev.method !== 'string' || ev.method.trim().length < 20) e.push('tested evidence needs a method of at least 20 characters');
  } else if (ev.status === 'documented') {
    if (!/^https:\/\//.test(ev.source || '')) e.push('documented evidence needs an https source link to the maker\'s documentation');
  }
  const s = p.supplier;
  if (!s || !s.name || !s.ships || !s.returns) e.push('supplier needs name, ships and returns');
  const c = p.commission;
  if (!c || typeof c.earns !== 'boolean') e.push('commission.earns must be true or false');
  else if (c.earns && !(c.from && c.from.trim())) e.push('commission.from is required when we earn a commission');
  if (p.buyUrl && !/^https:\/\//.test(p.buyUrl)) e.push('buyUrl must be https');
  if (p.buyUrl && p.price == null) e.push('a product with a buy link needs a price');
  const text = [p.name, p.protects, p.forWho, p.checkYourself, p.limits].join(' ');
  if (BANNED.test(text)) e.push('banned claim in copy (100% secure, unbreakable, military-grade ...)');
  return e;
}

const statusTag = (ev) => ({
  tested: ['tested', 'Tested'], documented: ['doc', 'Documented'], untested: ['untested', 'Untested'],
}[ev.status]);

export function productBody(p, esc) {
  const [k, t] = statusTag(p.evidence);
  const ev = p.evidence;
  const evidence = ev.status === 'tested'
    ? `<p>Tested on ${esc(ev.date)}. ${esc(ev.method)}</p>`
    : ev.status === 'documented'
      ? `<p>We have not tested this ourselves. The claims above come from the <a href="${esc(ev.source)}" rel="noopener">maker's documentation</a>.</p>`
      : '<p>We have not tested this yet. Do not rely on it until this section shows a date and a method.</p>';
  const comm = p.commission.earns
    ? `<span class="tag tag--aff">Affiliate</span> Yes. We earn a commission from ${esc(p.commission.from)}. It does not change anything written on this page.`
    : 'No. We earn nothing from this beyond the sale itself.';
  const buy = p.buyUrl
    ? `<p><a class="btn btn--p" href="${esc(p.buyUrl)}" rel="noopener">Buy for ${esc(String(p.price))}</a>${p.commission.earns ? ' <span class="tag tag--aff">Affiliate</span>' : ''}</p>`
    : '<p class="meta">Not on sale yet.</p>';
  return `    <p class="meta"><a href="/shop/">Shop</a></p>
    <h1>${esc(p.name)}</h1>
    <p>${tagHtmlS(k, t)}${p.commission.earns ? tagHtmlS('aff', 'Affiliate') : ''}</p>
    <h2>${FIELDS[0].label}</h2>
    <p>${esc(p.protects)}</p>
    <h2>${FIELDS[1].label}</h2>
    <p>${esc(p.forWho)}</p>
    <h2>${FIELDS[2].label}</h2>
    <p>${esc(p.checkYourself)}</p>
    <h2>${FIELDS[3].label}</h2>
    ${evidence}
    <h2>${FIELDS[4].label}</h2>
    <p>${esc(p.limits)}</p>
    <h2>${FIELDS[5].label}</h2>
    <ul>
      <li>Made or supplied by ${esc(p.supplier.name)}.</li>
      <li>Ships: ${esc(p.supplier.ships)}</li>
      <li>Returns: ${esc(p.supplier.returns)}</li>
    </ul>
    <h2>${FIELDS[6].label}</h2>
    <p>${comm}</p>
    ${buy}
`;
}
const tagHtmlS = (k, t) => `<span class="tag tag--${k}">${t}</span>`;

export function shopIndexBody(products, esc, date) {
  const list = products.length
    ? `<ul class="items">\n${products.map((p) => `      <li><a href="/shop/${p.slug}/">${esc(p.name)}</a> ${tagHtmlS(...statusTag(p.evidence))}</li>`).join('\n')}\n    </ul>`
    : '<p><strong>There are no products yet.</strong> We will not list anything until we can fill in every section below honestly. Until then this page is not in the menu or the sitemap.</p>';
  return `    <h1>Shop</h1>
    <p class="meta">Last updated: ${date}</p>
    <p class="lead">Privacy gear and software we can explain, and that you can check yourself.</p>
    ${list}
    <h2>What every product page shows</h2>
    <table>
      <thead><tr><th>Section</th><th>What it contains</th></tr></thead>
      <tbody>
${FIELDS.map((f) => `        <tr><td>${f.label}</td><td>${esc(f.help)}</td></tr>`).join('\n')}
      </tbody>
    </table>
    <h2>Rules</h2>
    <ul>
      <li>A product without a test date and method is labelled <span class="tag tag--untested">Untested</span>. One that relies on the maker's claims is labelled <span class="tag tag--doc">Documented</span> and links to them.</li>
      <li>If we earn a commission, the <span class="tag tag--aff">Affiliate</span> label sits next to the buy link, not only at the bottom of the page.</li>
      <li>The shop pages set no cookies and add no tracking. Checkout, when there is one, is run by a third party and described in the <a href="/privacy/">privacy policy</a> before it goes live.</li>
    </ul>
    <h2>What we do not sell</h2>
    <table>
      <thead><tr><th>Category</th><th>Why</th></tr></thead>
      <tbody>
${NOT_SOLD.map(([a, b]) => `        <tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('\n')}
      </tbody>
    </table>
    <p>The full rules are on the <a href="/principles/">principles</a> and <a href="/sponsor/">sponsorship and affiliate disclosure</a> pages.</p>
`;
}
