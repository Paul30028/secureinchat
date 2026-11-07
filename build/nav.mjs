// Global site shell: one source of truth for the header, footer and primary navigation.
//
// The site has four locales, but only some sections exist per language. Each nav item points at the
// real page for that locale; when a localized page does not exist yet it points at the English page
// and carries hreflang="en" so the destination is not a surprise. /workspace/ is English-only today,
// so every locale links there.
//
// build.mjs runs applyPrimaryNav() inside write(), which means pages produced by any of the current
// generators (kit shell, GPT home/checkup pages, legacy shell, workspace) get the same header,
// footer, four items, language links and aria-current. The language menu is a native <details>
// element, so it still opens without JavaScript; assets/js/shell.js only adds Escape and outside-click.

const SITE_ORIGIN = 'https://secureinchat.com';
const SITE_HOST = 'secureinchat.com';

const NAV = {
  en: {
    label: 'Main navigation',
    mobileLabel: 'Mobile navigation',
    openLabel: 'Navigation menu',
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
    openLabel: '导航菜单',
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
    openLabel: 'ナビゲーション',
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
    openLabel: 'Menú de navegación',
    items: [
      { key: 'workspace', href: '/workspace/', label: 'Espacio de trabajo', hreflang: 'en' },
      { key: 'tools', href: '/tools/', label: 'Herramientas', hreflang: 'en' },
      { key: 'learn', href: '/blog/', label: 'Aprender', hreflang: 'en' },
      { key: 'about', href: '/about/', label: 'Acerca de', hreflang: 'en' },
    ],
  },
};

// Locale names are written in their own language. /es/ has no home page, so it is not offered as
// a fallback destination; it is offered only when a page has a real Spanish translation alternate.
const LOCALES = [
  { key: 'en', label: 'English', hreflang: 'en', htmlLang: 'en' },
  { key: 'zh', label: '中文', hreflang: 'zh-CN', htmlLang: 'zh-CN' },
  { key: 'ja', label: '日本語', hreflang: 'ja', htmlLang: 'ja' },
  { key: 'es', label: 'Español', hreflang: 'es', htmlLang: 'es' },
];
const LOCALE_HOME = { en: '/', zh: '/zh/', ja: '/ja/' };

const SHELL = {
  en: {
    homeLabel: 'SecureInChat home',
    languageLabel: 'Language',
    languageSummary: 'English',
    languageSummaryLabel: 'Language: English',
    cta: 'Open workspace',
    footerNote: 'Practical privacy tools. Clear about limits.',
    explore: 'Explore',
    aboutPolicy: 'About &amp; policy',
    footerBottom: 'No tracking. No accounts.',
    links: {
      explore: [
        { href: '/workspace/', label: 'Workspace' },
        { href: '/tools/', label: 'Tools &amp; diagnostics' },
        { href: '/checkup/', label: 'Privacy checkup' },
        { href: '/blog/', label: 'Guides' },
        { href: '/messaging/', label: 'Messaging' },
      ],
      about: [
        { href: '/mission/', label: 'Mission' },
        { href: '/principles/', label: 'Principles' },
        { href: '/principles/#labels', label: 'Status labels' },
        // /terms/ was removed on 2026-10-22; the privacy policy is the site's legal disclosure.
        { href: '/privacy/', label: 'Privacy &amp; legal' },
        { href: '/contact/', label: 'Contact' },
        { href: '/sponsor/', label: 'Sponsorship &amp; affiliate disclosure' },
      ],
    },
  },
  zh: {
    homeLabel: 'SecureInChat 首页',
    languageLabel: '语言',
    languageSummary: '中文',
    languageSummaryLabel: '语言：中文',
    cta: '打开工作台',
    footerNote: '实用的隐私工具，清楚说明边界。',
    explore: '探索',
    aboutPolicy: '关于与政策',
    footerBottom: '不追踪，不需要账户。',
    links: {
      explore: [
        { href: '/workspace/', label: '工作台', hreflang: 'en' },
        { href: '/zh/tools/', label: '工具与诊断' },
        { href: '/zh/checkup/', label: '隐私体检' },
        { href: '/blog/', label: '指南', hreflang: 'en' },
        { href: '/messaging/', label: '加密聊天', hreflang: 'en' },
      ],
      about: [
        { href: '/mission/', label: '使命', hreflang: 'en' },
        { href: '/principles/', label: '原则', hreflang: 'en' },
        { href: '/principles/#labels', label: '状态标签', hreflang: 'en' },
        { href: '/privacy/', label: '隐私与法律', hreflang: 'en' },
        { href: '/contact/', label: '联系', hreflang: 'en' },
        { href: '/sponsor/', label: '赞助与联盟披露', hreflang: 'en' },
      ],
    },
  },
  ja: {
    homeLabel: 'SecureInChat ホーム',
    languageLabel: '言語',
    languageSummary: '日本語',
    languageSummaryLabel: '言語：日本語',
    cta: 'ワークスペースを開く',
    footerNote: '実用的なプライバシーツール。限界も明記します。',
    explore: '探索',
    aboutPolicy: '概要とポリシー',
    footerBottom: '追跡なし、アカウント不要。',
    links: {
      explore: [
        { href: '/workspace/', label: 'ワークスペース', hreflang: 'en' },
        { href: '/tools/', label: 'ツールと診断', hreflang: 'en' },
        { href: '/checkup/', label: 'プライバシーチェック', hreflang: 'en' },
        { href: '/blog/', label: 'ガイド', hreflang: 'en' },
        { href: '/messaging/', label: 'メッセンジャー', hreflang: 'en' },
      ],
      about: [
        { href: '/mission/', label: '使命', hreflang: 'en' },
        { href: '/principles/', label: '原則', hreflang: 'en' },
        { href: '/principles/#labels', label: 'ステータス表記', hreflang: 'en' },
        { href: '/privacy/', label: 'プライバシーと法的情報', hreflang: 'en' },
        { href: '/contact/', label: 'お問い合わせ', hreflang: 'en' },
        { href: '/sponsor/', label: 'スポンサーとアフィリエイトの開示', hreflang: 'en' },
      ],
    },
  },
  es: {
    homeLabel: 'Inicio de SecureInChat',
    languageLabel: 'Idioma',
    languageSummary: 'Español',
    languageSummaryLabel: 'Idioma: Español',
    cta: 'Abrir espacio de trabajo',
    footerNote: 'Herramientas de privacidad prácticas. Claras sobre sus límites.',
    explore: 'Explorar',
    aboutPolicy: 'Acerca de y políticas',
    footerBottom: 'Sin rastreo. Sin cuentas.',
    links: {
      explore: [
        { href: '/workspace/', label: 'Espacio de trabajo', hreflang: 'en' },
        { href: '/tools/', label: 'Herramientas y diagnósticos', hreflang: 'en' },
        { href: '/checkup/', label: 'Revisión de privacidad', hreflang: 'en' },
        { href: '/blog/', label: 'Guías', hreflang: 'en' },
        { href: '/messaging/', label: 'Mensajería', hreflang: 'en' },
      ],
      about: [
        { href: '/mission/', label: 'Misión', hreflang: 'en' },
        { href: '/principles/', label: 'Principios', hreflang: 'en' },
        { href: '/principles/#labels', label: 'Etiquetas de estado', hreflang: 'en' },
        { href: '/privacy/', label: 'Privacidad y legal', hreflang: 'en' },
        { href: '/contact/', label: 'Contacto', hreflang: 'en' },
        { href: '/sponsor/', label: 'Patrocinio y enlaces de afiliado', hreflang: 'en' },
      ],
    },
  },
};

const LOGO = `<svg viewBox="16 16 76 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><rect x="16" y="16" width="76" height="76" rx="18" fill="#D8F361"/><g transform="translate(54 54) scale(0.86) translate(-54 -58.5)"><path d="M54 24c9 6 18 8 28 8v20c0 17-12 28-28 33l-12 8v-11C32 77 26 66 26 52V32c10 0 19-2 28-8z" fill="#11130E"/><circle cx="43" cy="53" r="4.6" fill="#D8F361"/><circle cx="54" cy="53" r="4.6" fill="#D8F361"/><circle cx="65" cy="53" r="4.6" fill="#D8F361"/></g></svg>`;
const MENU_ICON = `<svg class="sc-menu__icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const CHEVRON = `<svg class="sc-chevron" viewBox="0 0 12 8" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

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

function localeKey(hreflang) {
  const value = String(hreflang || '').toLowerCase();
  if (!value || value === 'x-default') return null;
  if (value.startsWith('zh')) return 'zh';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('es')) return 'es';
  if (value.startsWith('en')) return 'en';
  return null;
}

function normalizeHref(href) {
  try {
    const url = new URL(href, SITE_ORIGIN);
    if (url.hostname !== SITE_HOST && url.hostname !== 'www.' + SITE_HOST) return null;
    return (url.pathname || '/') + url.search + url.hash;
  } catch {
    return null;
  }
}

// Read the page's hreflang group. Only real same-content translations end up here. A page with no
// group falls back to the locale home pages, which are real pages too; no slug is ever guessed.
export function parseAlternates(html) {
  const out = new Map();
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = (/\brel="([^"]*)"/i.exec(tag) || [])[1] || '';
    if (!/\balternate\b/i.test(rel)) continue;
    const key = localeKey((/\bhreflang="([^"]*)"/i.exec(tag) || [])[1]);
    if (!key) continue;
    const href = normalizeHref((/\bhref="([^"]*)"/i.exec(tag) || [])[1] || '');
    if (href) out.set(key, href);
  }
  return out;
}

function languageLinks(lang, alternates) {
  const found = alternates instanceof Map ? alternates : new Map();
  const hasGroup = found.size >= 2 && [...found.keys()].some((key) => key !== lang);
  const list = hasGroup
    ? LOCALES.filter((locale) => locale.key !== lang && found.has(locale.key))
      .map((locale) => ({ ...locale, href: found.get(locale.key) }))
    : LOCALES.filter((locale) => locale.key !== lang && LOCALE_HOME[locale.key])
      .map((locale) => ({ ...locale, href: LOCALE_HOME[locale.key] }));
  const seen = new Set();
  return list.filter((locale) => {
    if (seen.has(locale.href)) return false;
    seen.add(locale.href);
    return true;
  });
}

function languageAnchors(lang, alternates, indent) {
  return languageLinks(lang, alternates)
    .map((locale) => `<a href="${locale.href}" hreflang="${locale.hreflang}" lang="${locale.htmlLang}">${locale.label}</a>`)
    .join(`\n${indent}`);
}

function footerLinks(links) {
  return links.map((link) => `<li><a${link.hreflang ? ` hreflang="${link.hreflang}"` : ''} href="${link.href}">${link.label}</a></li>`).join('\n          ');
}

function headerMarkup(lang, pathname, alternates) {
  const cfg = NAV[lang] || NAV.en;
  const shell = SHELL[lang] || SHELL.en;
  const homeHref = LOCALE_HOME[lang] || '/';
  const navLinks = cfg.items.map((item) => anchor(item, pathname)).join('\n        ');
  const mobileLinks = cfg.items.map((item) => anchor(item, pathname)).join('\n        ');
  const headerLang = languageAnchors(lang, alternates, '          ');
  const mobileLang = languageAnchors(lang, alternates, '          ');
  const ctaHreflang = lang === 'en' ? '' : ' hreflang="en"';
  return `<header class="sc-header">
  <div class="sc-header__inner">
    <a class="sc-brand" href="${homeHref}" aria-label="${shell.homeLabel}">
      <span class="sc-brand__mark" aria-hidden="true">${LOGO}</span>
      <span class="sc-brand__name">SecureInChat</span>
    </a>
    <nav class="sc-nav" aria-label="${cfg.label}">
        ${navLinks}
    </nav>
    <div class="sc-header__actions">
      <details class="sc-lang">
        <summary aria-label="${shell.languageSummaryLabel}">
          <span>${shell.languageSummary}</span>
          ${CHEVRON}
        </summary>
        <div class="sc-lang__menu" role="group" aria-label="${shell.languageLabel}">
          ${headerLang}
        </div>
      </details>
      <a class="sc-cta" href="/workspace/"${ctaHreflang}>${shell.cta}</a>
    </div>
    <details class="sc-menu">
      <summary aria-label="${cfg.openLabel}">
        ${MENU_ICON}
      </summary>
      <nav aria-label="${cfg.mobileLabel}">
        ${mobileLinks}
        <div class="sc-menu__locale" role="group" aria-label="${shell.languageLabel}">
          ${mobileLang}
        </div>
      </nav>
    </details>
  </div>
</header>`;
}

function footerMarkup(lang, pathname, alternates) {
  const shell = SHELL[lang] || SHELL.en;
  const homeHref = LOCALE_HOME[lang] || '/';
  const footerLang = languageAnchors(lang, alternates, '        ');
  return `<footer class="sc-footer">
  <div class="sc-footer__inner">
    <div class="sc-footer__brand">
      <a class="sc-brand" href="${homeHref}" aria-label="${shell.homeLabel}">
        <span class="sc-brand__mark" aria-hidden="true">${LOGO}</span>
        <span class="sc-brand__name">SecureInChat</span>
      </a>
      <p class="sc-footer__note">${shell.footerNote}</p>
      <div class="sc-footer__lang" role="group" aria-label="${shell.languageLabel}">
        ${footerLang}
      </div>
    </div>
    <nav class="sc-footer__col" aria-label="${shell.explore}">
      <h2>${shell.explore}</h2>
      <ul>
          ${footerLinks(shell.links.explore)}
      </ul>
    </nav>
    <nav class="sc-footer__col" aria-label="${shell.aboutPolicy}">
      <h2>${shell.aboutPolicy}</h2>
      <ul>
          ${footerLinks(shell.links.about)}
      </ul>
    </nav>
  </div>
  <div class="sc-footer__bottom">
    <p>© 2026 SecureInChat</p>
    <p>${shell.footerBottom}</p>
  </div>
</footer>`;
}

export function renderHeader(html, rel) {
  return headerMarkup(navLocale(html), pagePath(rel), parseAlternates(html));
}

export function renderFooter(html, rel) {
  return footerMarkup(navLocale(html), pagePath(rel), parseAlternates(html));
}

// Used by build/subshell.mjs before the final head (and its hreflang group) exists. build.mjs
// replaces both blocks again in write(), so the final language links come from the real alternates.
export function renderShellHeader({ lang = 'en', pathname = '/', alternates = new Map() } = {}) {
  return headerMarkup(lang, pathname, alternates);
}

export function renderShellFooter({ lang = 'en', pathname = '/', alternates = new Map() } = {}) {
  return footerMarkup(lang, pathname, alternates);
}

export function applyPrimaryNav(html, rel) {
  const header = renderHeader(html, rel);
  const footer = renderFooter(html, rel);
  const headerRe = /<header\b(?=[^>]*\bclass="[^"]*(?:\bsite-header\b|\btop\b|\bsc-header\b))[^>]*>[\s\S]*?<\/header>/i;
  const footerRe = /<footer\b(?=[^>]*\bclass="[^"]*(?:\bsite-footer\b|\bfoot\b|\bsc-footer\b))[^>]*>[\s\S]*?<\/footer>/i;
  return html.replace(headerRe, header).replace(footerRe, footer);
}
