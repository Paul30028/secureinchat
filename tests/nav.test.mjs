// Global navigation checks over the committed build output.
// Every page the current generator writes must have the same four primary destinations, with
// localized labels, working target files and aria-current on the page's own section.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'public');

const EXPECTED = {
  en: {
    labels: ['Workspace', 'Tools', 'Learn', 'About'],
    hrefs: ['/workspace/', '/tools/', '/blog/', '/about/'],
    fallback: [],
  },
  zh: {
    labels: ['工作台', '工具', '学习', '关于'],
    hrefs: ['/workspace/', '/zh/tools/', '/blog/', '/about/'],
    fallback: [0, 2, 3],
  },
  ja: {
    labels: ['ワークスペース', 'ツール', '学ぶ', '概要'],
    hrefs: ['/workspace/', '/tools/', '/blog/', '/about/'],
    fallback: [0, 1, 2, 3],
  },
  es: {
    labels: ['Espacio de trabajo', 'Herramientas', 'Aprender', 'Acerca de'],
    hrefs: ['/workspace/', '/tools/', '/blog/', '/about/'],
    fallback: [0, 1, 2, 3],
  },
};

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

// The old /guides/, /refund/ and /terms/ files stay on disk so those URLs keep working, but the
// current build no longer writes them. They are covered by _redirects and excluded here.
const LEGACY = /^(?:guides|refund|terms)(?:\/|$)/;

function htmlFiles(dir = PUB, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const relOf = (file) => path.relative(PUB, file).replace(/\\/g, '/');
const pathOf = (file) => {
  const rel = relOf(file);
  return rel === 'index.html' ? '/' : '/' + rel.replace(/index\.html$/, '');
};
const langOf = (html) => {
  const lang = (/<html\b[^>]*\blang="([^"]+)"/i.exec(html) || [])[1] || 'en';
  if (lang.toLowerCase().startsWith('zh')) return 'zh';
  if (lang.toLowerCase().startsWith('ja')) return 'ja';
  if (lang.toLowerCase().startsWith('es')) return 'es';
  return 'en';
};

function primaryNav(html) {
  const m = /<nav\b[^>]*class="(?:desktop-navigation|site-nav|nav)"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  assert.ok(m, 'no primary navigation');
  const items = [];
  for (const tag of m[1].match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || []) {
    const href = (/<a\b[^>]*\bhref="([^"]+)"/.exec(tag) || [])[1];
    const aria = (/<a\b[^>]*\baria-current="([^"]+)"/.exec(tag) || [])[1] || null;
    const hreflang = (/<a\b[^>]*\bhreflang="([^"]+)"/.exec(tag) || [])[1] || null;
    const label = decode(tag.replace(/^<a\b[^>]*>/, '').replace(/<\/a>$/, ''));
    items.push({ href, aria, hreflang, label });
  }
  return items;
}

const targetFile = (href) => {
  assert.ok(href && href.startsWith('/') && !href.startsWith('//'), `unsafe nav href: ${href}`);
  const clean = href.split('#')[0].split('?')[0];
  return clean === '/' ? path.join(PUB, 'index.html') : path.join(PUB, clean.slice(1), 'index.html');
};

function expectedSection(pathname) {
  if (pathname.startsWith('/workspace/')) return 'workspace';
  if (pathname.startsWith('/tools/') || pathname.startsWith('/zh/tools/')) return 'tools';
  if (pathname.startsWith('/blog/')) return 'learn';
  if (/^\/(?:about|mission|privacy|principles|sponsor|contact|security|testing)\//.test(pathname)) return 'about';
  return null;
}

test('every generated page has the four-item primary navigation with real targets', () => {
  const files = htmlFiles().filter((file) => !LEGACY.test(relOf(file)));
  assert.ok(files.length > 60, `expected the generated site, found only ${files.length} pages`);

  for (const file of files) {
    const rel = relOf(file);
    const html = fs.readFileSync(file, 'utf8');
    const lang = langOf(html);
    const expected = EXPECTED[lang];
    const items = primaryNav(html);

    assert.equal(items.length, 4, `${rel} (${lang}): primary nav must have exactly 4 items, got ${items.length}`);
    assert.deepEqual(items.map((i) => i.label), expected.labels, `${rel} (${lang}): localized labels`);
    assert.deepEqual(items.map((i) => i.href), expected.hrefs, `${rel} (${lang}): localized targets`);

    for (const [i, item] of items.entries()) {
      const target = targetFile(item.href);
      assert.ok(fs.existsSync(target), `${rel}: nav target ${item.href} has no file (${target})`);
      if (expected.fallback.includes(i)) {
        assert.equal(item.hreflang, 'en', `${rel}: ${item.href} is English-only and must say hreflang="en"`);
      } else {
        assert.equal(item.hreflang, null, `${rel}: ${item.href} has a localized page and needs no hreflang`);
      }
    }

    const section = expectedSection(pathOf(file));
    const current = items.filter((item) => item.aria);
    if (!section) {
      assert.equal(current.length, 0, `${rel}: no primary nav item is current, found ${current.length}`);
      continue;
    }
    assert.equal(current.length, 1, `${rel}: exactly one current nav item, found ${current.length}`);
    const index = expected.hrefs.findIndex((href) => href === current[0].href);
    assert.notEqual(index, -1, `${rel}: aria-current on an unknown link ${current[0].href}`);
    const exact = items[index].href === pathOf(file);
    assert.equal(current[0].aria, exact ? 'page' : 'true', `${rel}: aria-current value`);
  }
});

test('the three home pages lead with the workspace', () => {
  const cases = [
    ['index.html', /<div class="v4-hero-actions">([\s\S]*?)<\/div>/],
    ['zh/index.html', /<div class="v4-hero-actions">([\s\S]*?)<\/div>/],
    ['ja/index.html', /<div class="hero__cta">([\s\S]*?)<\/div>/],
  ];
  for (const [rel, blockRe] of cases) {
    const html = fs.readFileSync(path.join(PUB, rel), 'utf8');
    const block = blockRe.exec(html);
    assert.ok(block, `${rel}: no primary action block`);
    const first = /<a\b[^>]*>/.exec(block[1]);
    assert.ok(first, `${rel}: primary action block has no link`);
    const href = (/\bhref="([^"]+)"/.exec(first[0]) || [])[1];
    assert.equal(href, '/workspace/', `${rel}: first main action must open /workspace/, got ${href}`);
  }
});
