// Global shell checks over the committed build output.
// Every page the current generator writes must have the same four primary destinations, with
// localized labels, working target files, one Workspace item, a distinct "Open workspace" action,
// real language links and aria-current on the page's own section.
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
    cta: 'Open workspace',
  },
  zh: {
    labels: ['工作台', '工具', '学习', '关于'],
    hrefs: ['/workspace/', '/zh/tools/', '/blog/', '/about/'],
    fallback: [0, 2, 3],
    cta: '打开工作台',
  },
  ja: {
    labels: ['ワークスペース', 'ツール', '学ぶ', '概要'],
    hrefs: ['/workspace/', '/tools/', '/blog/', '/about/'],
    fallback: [0, 1, 2, 3],
    cta: 'ワークスペースを開く',
  },
  es: {
    labels: ['Espacio de trabajo', 'Herramientas', 'Aprender', 'Acerca de'],
    hrefs: ['/workspace/', '/tools/', '/blog/', '/about/'],
    fallback: [0, 1, 2, 3],
    cta: 'Abrir espacio de trabajo',
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

function shellHeader(html) {
  const m = /<header\b[^>]*class="sc-header"[\s\S]*?<\/header>/.exec(html);
  assert.ok(m, 'no sc-header');
  return m[0];
}

function primaryNav(html) {
  const m = /<nav\b[^>]*class="sc-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
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

function cta(html) {
  const m = /<a\b[^>]*class="sc-cta"[^>]*>([\s\S]*?)<\/a>/.exec(html);
  assert.ok(m, 'no Open workspace action');
  return {
    href: (/<a\b[^>]*\bhref="([^"]+)"/.exec(m[0]) || [])[1],
    label: decode(m[1]),
  };
}

function languageLinks(html) {
  const out = [];
  for (const block of [
    /<div class="sc-lang__menu"[\s\S]*?<\/div>/.exec(html),
    /<div class="sc-footer__lang"[\s\S]*?<\/div>/.exec(html),
    /<div class="sc-menu__locale"[\s\S]*?<\/div>/.exec(html),
  ]) {
    if (!block) continue;
    for (const tag of block[0].match(/<a\b[^>]*>[\s\S]*?<\/a>/g) || []) {
      out.push({
        href: (/<a\b[^>]*\bhref="([^"]+)"/.exec(tag) || [])[1],
        hreflang: (/<a\b[^>]*\bhreflang="([^"]+)"/.exec(tag) || [])[1] || null,
        lang: (/<a\b[^>]*\blang="([^"]+)"/.exec(tag) || [])[1] || null,
        label: decode(tag.replace(/^<a\b[^>]*>/, '').replace(/<\/a>$/, '')),
      });
    }
  }
  return out;
}

const targetFile = (href) => {
  assert.ok(href && href.startsWith('/') && !href.startsWith('//'), `unsafe target: ${href}`);
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
    const header = shellHeader(html);
    const items = primaryNav(header);

    assert.ok(html.includes('/assets/css/shell.css'), `${rel}: does not load the shared shell stylesheet`);
    assert.ok(html.includes('/assets/js/shell.js'), `${rel}: does not load the shell enhancement script`);
    // Both menus are native <details>/<summary>, so they still open when shell.js does not run.
    assert.match(header, /<details class="sc-lang">[\s\S]*?<summary[\s\S]*?<\/summary>/, `${rel}: language menu is not a native disclosure`);
    assert.match(header, /<details class="sc-menu">[\s\S]*?<summary[\s\S]*?<\/summary>[\s\S]*?<nav\b/, `${rel}: mobile menu is not a native disclosure`);

    assert.equal(items.length, 4, `${rel} (${lang}): primary nav must have exactly 4 items, got ${items.length}`);
    assert.deepEqual(items.map((i) => i.label), expected.labels, `${rel} (${lang}): localized labels`);
    assert.deepEqual(items.map((i) => i.href), expected.hrefs, `${rel} (${lang}): localized targets`);
    assert.equal(items.filter((i) => i.href === '/workspace/').length, 1, `${rel}: Workspace must appear once in the nav`);

    for (const [i, item] of items.entries()) {
      const target = targetFile(item.href);
      assert.ok(fs.existsSync(target), `${rel}: nav target ${item.href} has no file (${target})`);
      if (expected.fallback.includes(i)) {
        assert.equal(item.hreflang, 'en', `${rel}: ${item.href} is English-only and must say hreflang="en"`);
      } else {
        assert.equal(item.hreflang, null, `${rel}: ${item.href} has a localized page and needs no hreflang`);
      }
    }

    // The action is a distinct call to action, not a second title-style "Workspace" button.
    const action = cta(header);
    assert.equal(action.href, '/workspace/', `${rel}: the header action must open /workspace/`);
    assert.equal(action.label, expected.cta, `${rel}: header action label`);
    assert.notEqual(action.label, expected.labels[0], `${rel}: the action duplicates the Workspace nav label`);

    const section = expectedSection(pathOf(file));
    const current = items.filter((item) => item.aria);
    if (!section) {
      assert.equal(current.length, 0, `${rel}: no primary nav item is current, found ${current.length}`);
    } else {
      assert.equal(current.length, 1, `${rel}: exactly one current nav item, found ${current.length}`);
      const index = expected.hrefs.findIndex((href) => href === current[0].href);
      assert.notEqual(index, -1, `${rel}: aria-current on an unknown link ${current[0].href}`);
      const exact = items[index].href === pathOf(file);
      assert.equal(current[0].aria, exact ? 'page' : 'true', `${rel}: aria-current value`);
    }

    // Every language option is a real page, names its destination language and never links to
    // itself. In the header and footer the same list is rendered from the page's hreflang group (or
    // from the locale home pages when no same-content translation exists).
    const languages = languageLinks(html);
    assert.ok(languages.length > 0, `${rel}: no language options`);
    for (const language of languages) {
      assert.ok(language.hreflang && language.lang, `${rel}: language link ${language.label} lacks hreflang/lang`);
      assert.ok(fs.existsSync(targetFile(language.href)), `${rel}: language target ${language.href} has no file`);
      assert.notEqual(language.href, pathOf(file), `${rel}: language list links to the current page`);
    }
  }
});

test('tokens.css is local, token-only and shared with the workspace', () => {
  const cssDir = path.join(PUB, 'assets/css');
  const tokensFile = path.join(cssDir, 'tokens.css');
  assert.ok(fs.existsSync(tokensFile), 'public/assets/css/tokens.css is missing');
  const tokens = fs.readFileSync(tokensFile, 'utf8');
  const shell = fs.readFileSync(path.join(cssDir, 'shell.css'), 'utf8');
  const base = fs.readFileSync(path.join(cssDir, 'base.css'), 'utf8');
  const workspace = fs.readFileSync(path.join(PUB, 'workspace/assets/workspace.css'), 'utf8');

  for (const token of [
    '--sc-canvas', '--sc-surface', '--sc-ink', '--sc-accent', '--sc-link', '--sc-focus',
    '--sc-danger', '--sc-success', '--sc-font-sans', '--sc-font-mono', '--sc-text-display',
    '--sc-space-1', '--sc-space-9', '--sc-radius-pill', '--sc-motion-fast',
  ]) {
    assert.ok(tokens.includes(token), `tokens.css is missing ${token}`);
  }
  assert.match(tokens, /--sc-canvas:\s*#11130e/i, 'dark canvas token missing');
  assert.match(tokens, /--sc-canvas:\s*#f0efe7/i, 'light canvas token missing');
  assert.match(tokens, /--sc-accent:\s*#d8f361/i, 'dark accent token missing');
  assert.match(tokens, /--sc-accent:\s*#52651a/i, 'light accent token missing');

  for (const [name, css] of [['tokens.css', tokens], ['base.css', base], ['shell.css', shell], ['workspace.css', workspace]]) {
    for (const match of css.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'"\s);]+)/g)) {
      assert.ok(match[1].startsWith('/') && !match[1].startsWith('//'), `${name}: remote @import ${match[1]}`);
    }
    for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
      assert.ok(!/^https?:/i.test(match[1]), `${name}: remote url() ${match[1]}`);
    }
  }

  assert.ok(shell.includes("@import url('/assets/css/tokens.css')"), 'shell.css must import the shared tokens');
  assert.ok(shell.includes('.sc-header') && shell.includes('.sc-footer'), 'shell.css has no header/footer styles');
  assert.ok(shell.includes('.sc-lang') && shell.includes('.sc-menu'), 'shell.css has no language/mobile menu styles');
  assert.ok(workspace.includes("@import url('/assets/css/tokens.css')"), 'workspace.css must import the shared tokens');
  assert.ok(workspace.includes("@import url('/assets/css/base.css')"), 'workspace.css must import the shared base layer');
  assert.ok(!/(^|\n)\s*--sc-[a-z0-9-]+\s*:/i.test(workspace), 'workspace.css redefines shared --sc-* tokens');
  assert.ok(!/@font-face/i.test(workspace), 'workspace.css still has its own @font-face copy');
  assert.ok(!/desktop-navigation|mobile-navigation|site-header|site-footer/.test(workspace), 'workspace.css still styles the old shell');
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
