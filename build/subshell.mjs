// Subpage shell: header, footer and page layouts from ChatGPT's Subpages Design Kit v2 (src/subpages/).
// Design and markup belong to ChatGPT (design owner); this file only fills the kit's layouts with production copy.
import fs from 'node:fs';
import path from 'node:path';

const KIT = path.resolve(import.meta.dirname, '../src/subpages/templates');
const read = (f) => fs.readFileSync(path.join(KIT, f), 'utf8');
const between = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); return s.slice(i, j + b.length); };

const T = { en: read('info-page.en.html'), zh: read('info-page.zh.html') };
const HEADER = { en: between(T.en, '<header class="site-header">', '</header>'), zh: between(T.zh, '<header class="site-header">', '</header>') };
const FOOTER = { en: between(T.en, '<footer class="site-footer">', '</footer>'), zh: between(T.zh, '<footer class="site-footer">', '</footer>') };

function header(lang, current) {
  let h = HEADER[lang].replace(/ aria-current="page"/g, '');
  if (current) h = h.replace(`<a href="${current}">`, `<a aria-current="page" href="${current}">`);
  return h;
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const slugify = (s) => strip(s).toLowerCase().replace(/&[a-z]+;/g, '').replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';

// Old status tags -> kit state labels (same words, same meaning; the label never upgrades a claim).
export function mapTags(html) {
  return html
    .replace(/<span class="tag tag--tested">/g, '<span class="state-label">')
    .replace(/<span class="tag tag--doc">/g, '<span class="state-label state-label--info">')
    .replace(/<span class="tag tag--lim">/g, '<span class="state-label state-label--network">')
    .replace(/<span class="tag tag--untested">/g, '<span class="state-label state-label--neutral">')
    .replace(/<span class="tag tag--aff">/g, '<span class="state-label state-label--neutral">')
    .replace(/<span class="tag tag--[a-z]+">/g, '<span class="state-label state-label--neutral">');
}

// Give every h2 an id and return [html, toc].
function anchorH2(html) {
  const seen = new Set(); const toc = [];
  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (m, attrs = '', inner) => {
    const idm = /\sid="([^"]+)"/.exec(attrs);
    let id = idm ? idm[1] : slugify(inner);
    while (!idm && seen.has(id)) id += '-2';
    seen.add(id); toc.push([id, strip(inner)]);
    return idm ? m : `<h2 id="${id}"${attrs}>${inner}</h2>`;
  });
  return [out, toc];
}

// Split a production body into intro parts (title, byline, lead) and the rest.
export function splitBody(body) {
  let b = body.trim();
  let crumbMeta = '';
  const pre = /^<p class="meta">(<a [\s\S]*?)<\/p>\s*/.exec(b);
  if (pre) { crumbMeta = pre[1]; b = b.slice(pre[0].length); }
  const h1 = /^<h1[^>]*>([\s\S]*?)<\/h1>\s*/.exec(b);
  const title = h1 ? h1[1].trim() : '';
  if (h1) b = b.slice(h1[0].length);
  let byline = '';
  const meta = /^<p class="meta">([\s\S]*?)<\/p>\s*/.exec(b);
  if (meta) { byline = meta[1].trim(); b = b.slice(meta[0].length); }
  let lead = '';
  const ld = /^<p class="lead">([\s\S]*?)<\/p>\s*/.exec(b) || /^<p>([\s\S]*?)<\/p>\s*/.exec(b);
  if (ld) { lead = ld[1].trim(); b = b.slice(ld[0].length); }
  return { title, byline, lead, rest: b, crumbMeta };
}

const crumbsHtml = (lang, crumbs) => `<nav aria-label="${lang === 'zh' ? '面包屑导航' : 'Breadcrumb'}" class="breadcrumbs">
       ${crumbs.map(([href, t], i) => (i === crumbs.length - 1
    ? `<span aria-current="page">${t}</span>`
    : `<a href="${href}">${t}</a>\n       <span aria-hidden="true" class="breadcrumb-separator">/</span>`)).join('\n       ')}
      </nav>`;

const figureHtml = (fig, cls = 'editorial-figure') => fig ? `<figure class="${cls}">
       <img alt="${esc(fig.alt)}" height="${fig.h || 360}" src="/assets/illustrations/${fig.src}" width="${fig.w || 760}"/>
       ${fig.caption ? `<figcaption>${fig.caption}</figcaption>` : ''}
      </figure>` : '';

function shell({ lang = 'en', htmlLang, title, desc, canonical, headExtra = '', current, main }) {
  const L = lang === 'zh' ? 'zh' : 'en';
  return `<!DOCTYPE html>
<html lang="${htmlLang || (L === 'zh' ? 'zh-CN' : 'en')}">
 <head>
  <meta charset="utf-8"/>
  <meta content="width=device-width, initial-scale=1" name="viewport"/>
  <meta content="light" name="color-scheme"/>
  <meta content="#F7F5EF" name="theme-color"/>
  <title>${esc(title)}</title>
  <meta content="${esc(desc)}" name="description"/>
${headExtra}  <link href="/favicon.svg" rel="icon" type="image/svg+xml"/>
  <link as="font" crossorigin="" href="/assets/fonts/noto-serif-subset.woff2" rel="preload" type="font/woff2"/>
  <link href="/assets/css/home.css" rel="stylesheet"/>
  <link href="/assets/css/subpages.css" rel="stylesheet"/>
 </head>
 <body>
  <a class="skip-link" href="#main">${L === 'zh' ? '跳到正文' : 'Skip to content'}</a>
  ${header(L, current)}
  <main class="subpage-main" id="main">
${main}
  </main>
  ${FOOTER[L]}
 </body>
</html>
`;
}

// Info layout (mission, privacy, about, contact, sponsor, principles, protect, start, shop, blog index).
export function infoPage({ lang = 'en', title, desc, canonical, headExtra, current, crumbs, body, figure, tocLabel }) {
  const { title: h1, byline, lead, rest } = splitBody(mapTags(body));
  const [content, toc] = anchorH2(rest);
  const L = lang === 'zh' ? 'zh' : 'en';
  const nav = toc.length >= 2 ? `<nav aria-label="${L === 'zh' ? '本页内容' : 'On this page'}" class="info-nav">
      <h2>${tocLabel || (L === 'zh' ? '本页内容' : 'On this page')}</h2>
      <ul>
${toc.map(([id, t]) => `       <li><a href="#${id}">${t}</a></li>`).join('\n')}
      </ul>
     </nav>` : '';
  const main = `   <section class="page-intro">
    <div class="subpage-shell">
     ${crumbsHtml(L, crumbs)}
     <div class="page-intro-grid">
      <div class="page-intro-copy">
       <h1 class="page-title">${h1}</h1>
       ${lead ? `<p class="page-lead">${lead}</p>` : ''}
       ${byline ? `<div class="article-byline">${byline.split(' · ').map((x) => `<span>${x}</span>`).join('')}</div>` : ''}
      </div>
      ${figureHtml(figure)}
     </div>
    </div>
   </section>
   <section class="subpage-section">
    <div class="subpage-shell${nav ? ' info-layout' : ''}">
     ${nav}
     <article class="info-content">
${content}
     </article>
    </div>
   </section>`;
  return shell({ lang, title, desc, canonical, headExtra, current, main });
}

// Article layout (blog posts).
export function articlePage({ title, desc, canonical, headExtra, crumbs, body, figure, labels = [], related = [] }) {
  const { title: h1, byline, lead, rest } = splitBody(mapTags(body));
  const [content, toc] = anchorH2(rest);
  const main = `   <section class="article-hero">
    <div class="subpage-shell">
     ${crumbsHtml('en', crumbs)}
     <div class="article-hero-grid">
      <header class="article-heading">
       <h1 class="page-title">${h1}</h1>
       ${lead ? `<p class="article-deck">${lead}</p>` : ''}
       <div class="article-byline">${byline.split(' · ').map((x) => `<span>${x}</span>`).join('')}</div>
       ${labels.length ? `<ul class="state-list">${labels.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}
      </header>
      ${figureHtml(figure, 'article-cover')}
     </div>
    </div>
   </section>
   <div class="subpage-shell article-layout">
    <article class="article-main">
     <div class="article-body">
${content}
     </div>
${related.length ? `     <section class="related-content" aria-labelledby="related-h">
      <h2 id="related-h">Keep going</h2>
      <ul class="related-content-list">
${related.map((r) => `       <li><a href="${r.href}">${r.title}</a></li>`).join('\n')}
      </ul>
     </section>` : ''}
    </article>
    ${toc.length >= 3 ? `<aside aria-label="On this page" class="article-toc">
     <h2>On this page</h2>
     <ol>
${toc.map(([id, t]) => `      <li><a href="#${id}">${t.replace(/^\d+\.\s*/, '')}</a></li>`).join('\n')}
     </ol>
    </aside>` : ''}
   </div>`;
  return shell({ title, desc, canonical, headExtra, current: '/blog/', main });
}

export { shell };
