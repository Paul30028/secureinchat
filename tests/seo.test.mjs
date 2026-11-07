// SEO structure checks over the committed build output: sitemap, canonical, hreflang and script policy.
// Run: node --test tests/*.test.js tests/*.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'public');
const SITE = 'https://secureinchat.com';

const read = (file) => fs.readFileSync(file, 'utf8');
const attr = (tag, name) => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
};
const unescape = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const htmlFiles = (dir = PUB, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
};

function sitemapEntries() {
  const xml = read(path.join(PUB, 'sitemap.xml'));
  return (xml.match(/<url>[\s\S]*?<\/url>/g) || []).map((block) => {
    const locTag = /<loc>([\s\S]*?)<\/loc>/.exec(block);
    assert.ok(locTag, 'sitemap <url> without <loc>');
    return {
      loc: unescape(locTag[1]),
      alternates: (block.match(/<xhtml:link\b[^>]*\/>/g) || []).map((tag) => ({
        lang: attr(tag, 'hreflang'),
        href: unescape(attr(tag, 'href') || ''),
      })),
    };
  });
}

function fileFor(url) {
  assert.ok(url.startsWith(SITE + '/'), `URL outside the site: ${url}`);
  const pathname = url.slice(SITE.length);
  return {
    pathname,
    file: pathname === '/' ? path.join(PUB, 'index.html') : path.join(PUB, pathname.slice(1), 'index.html'),
  };
}

function headFacts(file) {
  const html = read(file);
  const end = html.indexOf('</head>');
  assert.ok(end >= 0, `no </head> in ${file}`);
  const head = html.slice(0, end);
  const canonical = [];
  const alternates = [];
  for (const tag of head.match(/<link\b[^>]*>/g) || []) {
    const rel = (attr(tag, 'rel') || '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) canonical.push(unescape(attr(tag, 'href') || ''));
    if (rel.includes('alternate') && attr(tag, 'hreflang')) {
      alternates.push({ lang: attr(tag, 'hreflang'), href: unescape(attr(tag, 'href') || '') });
    }
  }
  return { canonical, alternates };
}

const linkSet = (links) => links.map((l) => `${l.lang} ${l.href}`).sort();

test('sitemap has no duplicate URLs; every URL is canonical and has a real page', () => {
  const entries = sitemapEntries();
  const locs = entries.map((e) => e.loc);
  assert.equal(new Set(locs).size, locs.length, 'duplicate sitemap URLs');
  for (const loc of locs) {
    const { pathname, file } = fileFor(loc);
    assert.ok(pathname === '/' || pathname.endsWith('/'), `sitemap URL lacks a trailing slash: ${loc}`);
    assert.ok(!pathname.includes('//'), `sitemap URL has an empty path segment: ${loc}`);
    assert.ok(!/[?#]/.test(pathname), `sitemap URL is not a clean canonical path: ${loc}`);
    assert.ok(fs.existsSync(file), `sitemap URL has no page: ${loc} (${file})`);
    const head = headFacts(file);
    assert.deepEqual(head.canonical, [loc], `${loc} must declare exactly one self-referencing canonical`);
  }
});

test('head and sitemap hreflang agree, are bidirectional, and only cover real translations', () => {
  const entries = sitemapEntries();
  const byLoc = new Map(entries.map((e) => [e.loc, e]));

  // No page outside the sitemap may claim a translation either.
  for (const file of htmlFiles()) {
    const head = headFacts(file);
    if (!head.alternates.length) continue;
    assert.equal(head.canonical.length, 1, `${path.relative(PUB, file)}: alternates on a page without one canonical`);
    const entry = byLoc.get(head.canonical[0]);
    assert.ok(entry, `${path.relative(PUB, file)}: alternates on a page outside the sitemap`);
    assert.deepEqual(linkSet(head.alternates), linkSet(entry.alternates), `${path.relative(PUB, file)}: head and sitemap alternates differ`);
  }

  for (const entry of entries) {
    const head = headFacts(fileFor(entry.loc).file);
    assert.deepEqual(linkSet(head.alternates), linkSet(entry.alternates), `${entry.loc}: head and sitemap alternates differ`);

    if (!entry.alternates.length) continue;
    const byLang = new Map(entry.alternates.map((l) => [l.lang, l.href]));
    assert.equal(byLang.size, entry.alternates.length, `${entry.loc}: duplicate hreflang language`);
    assert.ok(byLang.has('en'), `${entry.loc}: group has no English version`);
    assert.ok(byLang.has('x-default'), `${entry.loc}: group has no x-default`);
    assert.equal(byLang.get('x-default'), byLang.get('en'), `${entry.loc}: x-default must point at English`);
    assert.ok(entry.alternates.some((l) => l.href === entry.loc), `${entry.loc}: group does not include itself`);

    for (const link of entry.alternates) {
      const target = byLoc.get(link.href);
      assert.ok(target, `${entry.loc}: alternate target is not in the sitemap: ${link.href}`);
      assert.ok(fs.existsSync(fileFor(link.href).file), `${entry.loc}: alternate target has no page: ${link.href}`);
      assert.deepEqual(linkSet(target.alternates), linkSet(entry.alternates), `${entry.loc} -> ${link.href}: group is not reciprocal`);
      const targetHead = headFacts(fileFor(link.href).file);
      assert.deepEqual(linkSet(targetHead.alternates), linkSet(entry.alternates), `${entry.loc} -> ${link.href}: target head group differs`);
    }
  }

  const grouped = new Set(entries.filter((e) => e.alternates.length).flatMap((e) => e.alternates.map((l) => l.href)));
  for (const entry of entries) {
    if (grouped.has(entry.loc)) continue;
    assert.equal(entry.alternates.length, 0, `${entry.loc}: page without a translation has sitemap alternates`);
    assert.equal(headFacts(fileFor(entry.loc).file).alternates.length, 0, `${entry.loc}: page without a translation has head alternates`);
  }
});

test('no generated page or CSP allows a third-party script or cloudflareinsights', () => {
  for (const file of htmlFiles()) {
    const rel = path.relative(PUB, file).replace(/\\/g, '/');
    const html = read(file);
    assert.ok(!/cloudflareinsights/i.test(html), `${rel}: mentions cloudflareinsights`);
    for (const tag of html.match(/<script\b[^>]*>/g) || []) {
      const src = attr(tag, 'src');
      if (!src) continue;
      const resolved = new URL(src, SITE + '/');
      assert.equal(resolved.origin, SITE, `${rel}: external script source ${src}`);
    }
  }

  const headers = read(path.join(PUB, '_headers'));
  assert.ok(!/cloudflareinsights/i.test(headers), '_headers mentions cloudflareinsights');
  for (const csp of headers.match(/Content-Security-Policy:\s*([^\n]+)/g) || []) {
    const scriptSrc = /(?:^|;)\s*script-src\s+([^;]*)/.exec(csp);
    assert.ok(scriptSrc, `CSP without script-src: ${csp}`);
    for (const source of scriptSrc[1].trim().split(/\s+/)) {
      assert.ok(["'self'", "'wasm-unsafe-eval'", "'none'"].includes(source), `external script-src source: ${source}`);
    }
  }

  const rules = [];
  let current = null;
  for (const line of headers.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      current = { pattern: line.trim(), headers: {} };
      rules.push(current);
    } else {
      const i = line.indexOf(':');
      current.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const cspFor = (pathname) => rules
    .filter((r) => (r.pattern.endsWith('*') && pathname.startsWith(r.pattern.slice(0, -1))) || r.pattern === pathname)
    .map((r) => r.headers['Content-Security-Policy'])
    .filter(Boolean);
  for (const entry of sitemapEntries()) {
    const { pathname } = fileFor(entry.loc);
    const csps = cspFor(pathname);
    assert.equal(csps.length, 1, `${pathname}: expected one matching CSP header rule, found ${csps.length}`);
    assert.ok(!/cloudflareinsights/i.test(csps[0]), `${pathname}: CSP mentions cloudflareinsights`);
  }
});
