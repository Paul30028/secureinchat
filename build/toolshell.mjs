// Tool detail pages in ChatGPT's Subpages Design Kit v2 layout (tool-detail template).
// Integration only: each tool's live markup (ids, data-* hooks, scripts) is moved unchanged into the kit's
// workspace slot, as the kit README asks. Widget styling inside the slot comes from the previous tool
// stylesheet, scoped to .legacy-tool, until ChatGPT restyles the widgets.
import { shell, mapTags } from './subshell.mjs';

const topBlocks = (main) => {
  // Top-level <section>/<aside> blocks start at column 0 in the tool sources.
  const out = []; const re = /^[ \t]*<(section|aside)([^>]*)>([\s\S]*?)^[ \t]*<\/\1>/gm; let m;
  while ((m = re.exec(main))) out.push({ tag: m[1], attrs: m[2], inner: m[3] });
  return out;
};
const cleanAttrs = (a) => a.replace(/\s*class="([^"]*)"/, (x, c) => { const k = c.split(/\s+/).filter((w) => !['wrap', 'prose', 'hero'].includes(w)).join(' '); return k ? ` class="${k}"` : ''; });

// Shell chrome strings. English is the default, so pages that do not pass lang keep their exact output.
// Chinese tool pages reuse the English tools index until a Chinese one exists; only the page paths move.
const CHROME = {
  'en': {
    lang: 'en',
    crumbLabel: 'Breadcrumb',
    crumbHome: 'Home',
    crumbTools: 'Tools',
    handling: 'How your data is handled',
    stays: 'Stays on your device',
    sent: 'Sent to others',
    flowLink: 'See every tool\'s data flow',
    other: 'Need a different check?',
    otherText: 'Compare tools by what they do and what data they need.',
    browse: 'Browse all tools',
  },
  'zh-CN': {
    lang: 'zh-CN',
    crumbLabel: '面包屑',
    crumbHome: '首页',
    crumbTools: '工具',
    handling: '你的数据如何处理',
    stays: '留在你的设备上',
    sent: '发送给他人',
    flowLink: '查看每个工具的数据流',
    other: '需要别的检查？',
    otherText: '按用途和数据需要比较这些工具。',
    browse: '浏览所有工具',
  },
};

export function toolPage({ slug, src, icon, label, flow, figure, crumbName, lang = 'en', alt }) {
  const chrome = CHROME[lang] || CHROME.en;
  const zh = chrome === CHROME['zh-CN'];
  const head = src.slice(0, src.indexOf('</head>'));
  const bodyEnd = src.slice(src.indexOf('</main>'));
  const title = /<title>([\s\S]*?)<\/title>/.exec(head)[1];
  const desc = /<meta name="description" content="([^"]*)"/.exec(head)[1];
  const headScripts = head.match(/<script[\s\S]*?<\/script>/g) || [];
  const tailScripts = bodyEnd.match(/<script[\s\S]*?<\/script>/g) || [];
  const main = src.slice(src.indexOf('<main'), src.indexOf('</main>'));
  const blocks = topBlocks(main);
  const hero = blocks.find((b) => /class="[^"]*\bhero\b/.test(b.attrs));
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(hero.inner)[1];
  const ledeM = /<p class="lede">([\s\S]*?)<\/p>/.exec(hero.inner);
  const heroRest = hero.inner.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/, '').replace(/<p class="lede">[\s\S]*?<\/p>\s*/, '');
  const work = []; const prose = [];
  for (const b of blocks) {
    if (b === hero) continue;
    if (/id="ad-slot/.test(b.attrs)) continue;
    if (/\bprose\b/.test(b.attrs)) prose.push(b); else work.push(b);
  }
  const ws = `      <section class="tool-workspace" aria-label="${h1.replace(/"/g, '&quot;')}">
       <div class="legacy-tool">
${heroRest}
       </div>
${work.map((b) => `       <div class="legacy-tool"><${b.tag}${cleanAttrs(b.attrs)}>${b.inner}</${b.tag}></div>`).join('\n')}
      </section>`;
  const info = prose.length ? `      <div class="info-content tool-prose">
${prose.map((b) => `<${b.tag}${cleanAttrs(b.attrs)}>${mapTags(b.inner)}</${b.tag}>`).join('\n')}
      </div>` : '';
  const row = (mark, t, p) => `<div class="data-handling-row"><span class="data-handling-mark">${mark}</span><div><strong>${t}</strong><p>${p}</p></div></div>`;
  const sentIsNone = flow.sent === 'Nothing' || flow.sent === '无';
  const side = `     <aside class="tool-sidebar">
      <section class="content-panel">
       <h2>${chrome.handling}</h2>
       <div class="data-handling">
        ${row('✓', chrome.stays, flow.stays)}
        ${row(sentIsNone ? '✓' : '↗', chrome.sent, flow.sent)}
       </div>
       <p class="state-list"><span class="${label[1]}">${label[0]}</span></p>
       <a class="text-link" href="/principles/">${chrome.flowLink} <span aria-hidden="true">→</span></a>
      </section>
      ${figure ? `<figure class="editorial-figure"><img alt="${figure.alt}" height="${figure.h}" src="/assets/illustrations/${figure.src}" width="760"/></figure>` : ''}
      <section class="content-panel content-panel--soft">
       <h2>${chrome.other}</h2>
       <p>${chrome.otherText}</p>
       <a class="text-link" href="/tools/">${chrome.browse} <span aria-hidden="true">→</span></a>
      </section>
     </aside>`;
  const homeHref = zh ? '/zh/' : '/';
  const mainHtml = `   <section class="tool-detail-hero">
    <div class="subpage-shell">
     <nav aria-label="${chrome.crumbLabel}" class="breadcrumbs">
      <a href="${homeHref}">${chrome.crumbHome}</a>
      <span aria-hidden="true" class="breadcrumb-separator">/</span>
      <a href="/tools/">${chrome.crumbTools}</a>
      <span aria-hidden="true" class="breadcrumb-separator">/</span>
      <span aria-current="page">${crumbName}</span>
     </nav>
     <div class="tool-detail-title-row">
      ${icon ? `<span class="tool-detail-emblem">${icon.replace('tool-catalogue-icon-art', 'tool-detail-emblem-art')}</span>` : ''}
      <div>
       <h1 id="h1">${h1}</h1>
       ${ledeM ? `<p class="page-lead">${ledeM[1]}</p>` : ''}
       <ul class="state-list"><li><span class="${label[1]}">${label[0]}</span></li></ul>
      </div>
     </div>
    </div>
   </section>
   <section class="subpage-section">
    <div class="subpage-shell tool-detail-layout">
     <div class="tool-main-column">
${ws}
${info}
     </div>
${side}
    </div>
   </section>`;
  const canonical = `${zh ? '/zh' : ''}/tools/${slug}/`;
  // Alternate-language links are emitted only for pages that pass alt (a page with a translation),
  // so every other page keeps its exact output.
  const headAlt = alt ? [
    `  <link href="https://secureinchat.com${alt.en}" hreflang="en" rel="alternate"/>`,
    `  <link href="https://secureinchat.com${alt['zh-CN']}" hreflang="zh-CN" rel="alternate"/>`,
    `  <link href="https://secureinchat.com${alt.en}" hreflang="x-default" rel="alternate"/>`,
  ].join('\n') + '\n' : '';
  const keep = headScripts.filter((s) => /application\/ld\+json/.test(s));
  const scriptsHead = headScripts.filter((s) => !/application\/ld\+json/.test(s));
  const headExtra = `  <link href="https://secureinchat.com${canonical}" rel="canonical"/>
${headAlt}  <link as="font" crossorigin="" href="/tools/fonts/atkinson-hyperlegible-mono-latin-400-normal.woff2" rel="preload" type="font/woff2"/>
  <link href="/assets/css/tool-legacy.css" rel="stylesheet"/>
${[...keep, ...scriptsHead].map((s) => `  ${s}`).join('\n')}
`;
  const shellArgs = { title, desc, canonical, headExtra, current: '/tools/', main: mainHtml };
  // The shared subpage shell already carries the Chinese header and footer (lang 'zh').
  if (zh) { shellArgs.lang = 'zh'; shellArgs.htmlLang = chrome.lang; }
  let html = shell(shellArgs);
  // The Chinese header links to /zh/tools/ and /zh/blog/, which do not exist yet: point them at the
  // English index pages until they do.
  if (zh) html = html.replace(/href="\/zh\/(tools|blog)\/"/g, 'href="/$1/"');
  html = html.replace(' </body>', `${tailScripts.map((s) => `  ${s}`).join('\n')}\n </body>`);
  // the kit stylesheets load after tool-legacy.css in the shell head order; move tool-legacy last so widgets keep their look
  html = html.replace('  <link href="/assets/css/tool-legacy.css" rel="stylesheet"/>\n', '').replace('<link href="/assets/css/subpages.css" rel="stylesheet"/>', '<link href="/assets/css/subpages.css" rel="stylesheet"/>\n  <link href="/assets/css/tool-legacy.css" rel="stylesheet"/>\n  <link href="/assets/css/tool-widgets.css" rel="stylesheet"/>');
  return html;
}

// Scope the previous tool stylesheet to .legacy-tool. Page-level rules (html, body, header, hero, skip link) are dropped.
export function scopeLegacyCss(css) {
  const DROP = /^(html|body|\*|::selection|\.top\b|\.top__in|\.brand|\.skip|\.hero\b|\.lede|\.foot\b|\.foot__in|h1\b)/;
  const scopeSel = (sel) => sel.split(',').map((x) => x.trim()).filter((x) => x && !DROP.test(x))
    .map((x) => (x.startsWith(':root') ? x : `.legacy-tool ${x}`)).join(', ');
  let out = ''; let i = 0;
  const readBlock = (from) => { let d = 0; for (let j = from; j < css.length; j++) { if (css[j] === '{') d++; else if (css[j] === '}') { d--; if (d === 0) return j; } } return css.length; };
  while (i < css.length) {
    const ob = css.indexOf('{', i); if (ob < 0) break;
    const pre = css.slice(i, ob).trim(); const cb = readBlock(ob);
    const inner = css.slice(ob + 1, cb);
    const sel = pre.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (sel.startsWith('@font-face') || sel.startsWith('@keyframes')) out += `${sel} {${inner}}\n`;
    else if (sel.startsWith('@media') || sel.startsWith('@supports')) out += `${sel} {\n${scopeLegacyCss(inner)}}\n`;
    else if (sel.startsWith(':root')) out += `${sel} {${inner}}\n`;
    else { const s2 = scopeSel(sel); if (s2) out += `${s2} {${inner}}\n`; }
    i = cb + 1;
  }
  return out;
}
