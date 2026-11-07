// Global primary navigation: one source of truth for every generated page.
//
// The site has four locales, but only some sections exist per language. Each item points at the
// real page for that locale; when a localized page does not exist yet it points at the English
// page and carries hreflang="en" so the destination is not a surprise. /workspace/ is English-only
// today, so every locale links there.
//
// build.mjs runs applyPrimaryNav() inside write(), which means pages produced by any of the
// current generators (kit shell, GPT home/checkup pages, legacy shell, workspace) get the same
// four items, the same localized labels and aria-current. Adding a page cannot silently reintroduce
// an old five-item navigation.

const NAV = {
  en: {
    label: 'Main navigation',
    mobileLabel: 'Mobile navigation',
    openLabel: 'Open navigation',
    items: [
      { key: 'workspace', href: '/workspace/', label: 'Workspace' },
      { key: 'tools', href: '/tools/', label: 'Tools' },
      { key: 'learn', href: '/blog/', label: 'Learn' },
      { key: 'about', href: '/about/', label: 'About' },
    ],
  },
  zh: {
    label: '主导航',
    mobileLabel: '移动端导航',
    openLabel: '打开导航菜单',
    items: [
      { key: 'workspace', href: '/workspace/', label: '工作台', hreflang: 'en' },
      { key: 'tools', href: '/zh/tools/', label: '工具' },
      { key: 'learn', href: '/blog/', label: '学习', hreflang: 'en' },
      { key: 'about', href: '/about/', label: '关于', hreflang: 'en' },
    ],
  },
  ja: {
    label: 'メインナビゲーション',
    mobileLabel: 'モバイルナビゲーション',
    openLabel: 'ナビゲーションを開く',
    items: [
      { key: 'workspace', href: '/workspace/', label: 'ワークスペース', hreflang: 'en' },
      { key: 'tools', href: '/tools/', label: 'ツール', hreflang: 'en' },
      { key: 'learn', href: '/blog/', label: '学ぶ', hreflang: 'en' },
      { key: 'about', href: '/about/', label: '概要', hreflang: 'en' },
    ],
  },
  es: {
    label: 'Navegación principal',
    mobileLabel: 'Navegación móvil',
    openLabel: 'Abrir navegación',
    items: [
      { key: 'workspace', href: '/workspace/', label: 'Espacio de trabajo', hreflang: 'en' },
      { key: 'tools', href: '/tools/', label: 'Herramientas', hreflang: 'en' },
      { key: 'learn', href: '/blog/', label: 'Aprender', hreflang: 'en' },
      { key: 'about', href: '/about/', label: 'Acerca de', hreflang: 'en' },
    ],
  },
};

// Language switch shown in the mobile disclosure. The desktop header keeps its own links; this
// keeps the same choices reachable when the desktop navigation is hidden at small widths.
const LOCALES = [
  { lang: 'en', label: 'English', href: '/' },
  { lang: 'zh', label: '中文', href: '/zh/' },
  { lang: 'ja', label: '日本語', href: '/ja/' },
];

export function navLocale(html) {
  const m = /<html\b[^>]*\blang="([^"]+)"/i.exec(html);
  const lang = (m ? m[1] : 'en').toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}

export function pagePath(rel) {
  const p = rel.replace(/\\/g, '/');
  if (p === 'index.html') return '/';
  return '/' + p.replace(/index\.html$/, '');
}

export function sectionFor(pathname) {
  if (pathname === '/workspace/' || pathname.startsWith('/workspace/')) return 'workspace';
  if (pathname.startsWith('/tools/') || pathname.startsWith('/zh/tools/')) return 'tools';
  if (pathname.startsWith('/blog/')) return 'learn';
  if (/^\/(?:about|mission|privacy|principles|sponsor|contact|security|testing)\//.test(pathname)) return 'about';
  return null;
}

function anchor(item, pathname) {
  const section = sectionFor(pathname);
  const current = section === item.key;
  // "page" only when the link target is this exact page; a section's other pages describe the
  // relationship without claiming the link is the current document.
  const aria = current ? ` aria-current="${pathname === item.href ? 'page' : 'true'}"` : '';
  const hreflang = item.hreflang ? ` hreflang="${item.hreflang}"` : '';
  return `<a${aria}${hreflang} href="${item.href}">${item.label}</a>`;
}

function mobileLinks(lang, pathname) {
  const cfg = NAV[lang] || NAV.en;
  const currentLang = lang === 'zh' ? 'zh' : lang === 'ja' ? 'ja' : 'en';
  const localeLinks = LOCALES.filter((l) => l.lang !== currentLang)
    .map((l) => `<a href="${l.href}" hreflang="${l.lang}" lang="${l.lang}">${l.label}</a>`)
    .join('');
  return cfg.items.map((item) => anchor(item, pathname)).join('') + localeLinks;
}

export function applyPrimaryNav(html, rel) {
  const lang = navLocale(html);
  const pathname = pagePath(rel);
  const cfg = NAV[lang] || NAV.en;
  const desktopLinks = cfg.items.map((item) => anchor(item, pathname)).join('\n        ');

  // Replace only the contents of the primary navigation; keep each page's own class and CSS
  // contract (desktop-navigation in the kit/GPT pages, site-nav in the workspace, nav in the
  // legacy shell). Footer, breadcrumb and on-this-page navs are untouched.
  let out = html.replace(/<nav\b(?=[^>]*\bclass="(?:desktop-navigation|site-nav|nav)")[^>]*>[\s\S]*?<\/nav>/g, (block) => {
    const end = block.indexOf('>') + 1;
    const open = block.slice(0, end).replace(/\baria-label="[^"]*"/, `aria-label="${cfg.label}"`);
    return `${open}\n        ${desktopLinks}\n      </nav>`;
  });

  // Mobile disclosure: four primary items first, then the same language choices the desktop
  // header offers. The native <details>/<summary> element is keyboard operable without script.
  out = out.replace(/<details\b(?=[^>]*\bclass="mobile-navigation")[^>]*>[\s\S]*?<\/details>/g, (block) => {
    const end = block.indexOf('>') + 1;
    const open = block.slice(0, end);
    const existingSummary = /<summary\b[\s\S]*?<\/summary>/.exec(block);
    const summary = (existingSummary ? existingSummary[0] : '<summary></summary>')
      .replace(/\baria-label="[^"]*"/, `aria-label="${cfg.openLabel}"`);
    return `${open}\n      ${summary}\n      <nav aria-label="${cfg.mobileLabel}">${mobileLinks(lang, pathname)}</nav>\n    </details>`;
  });

  return out;
}
