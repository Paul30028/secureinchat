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

export function toolPage({ slug, src, icon, label, flow, figure, crumbName }) {
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
  const side = `     <aside class="tool-sidebar">
      <section class="content-panel">
       <h2>How your data is handled</h2>
       <div class="data-handling">
        ${row('✓', 'Stays on your device', flow.stays)}
        ${row(flow.sent === 'Nothing' ? '✓' : '↗', 'Sent to others', flow.sent)}
       </div>
       <p class="state-list"><span class="${label[1]}">${label[0]}</span></p>
       <a class="text-link" href="/principles/">See every tool's data flow <span aria-hidden="true">→</span></a>
      </section>
      ${figure ? `<figure class="editorial-figure"><img alt="${figure.alt}" height="${figure.h}" src="/assets/illustrations/${figure.src}" width="760"/></figure>` : ''}
      <section class="content-panel content-panel--soft">
       <h2>Need a different check?</h2>
       <p>Compare tools by what they do and what data they need.</p>
       <a class="text-link" href="/tools/">Browse all tools <span aria-hidden="true">→</span></a>
      </section>
     </aside>`;
  const mainHtml = `   <section class="tool-detail-hero">
    <div class="subpage-shell">
     <nav aria-label="Breadcrumb" class="breadcrumbs">
      <a href="/">Home</a>
      <span aria-hidden="true" class="breadcrumb-separator">/</span>
      <a href="/tools/">Tools</a>
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
  const canonical = `/tools/${slug}/`;
  const keep = headScripts.filter((s) => /application\/ld\+json/.test(s));
  const scriptsHead = headScripts.filter((s) => !/application\/ld\+json/.test(s));
  const headExtra = `  <link href="https://secureinchat.com${canonical}" rel="canonical"/>
  <link href="/assets/css/tool-legacy.css" rel="stylesheet"/>
${[...keep, ...scriptsHead].map((s) => `  ${s}`).join('\n')}
`;
  let html = shell({ title, desc, canonical, headExtra, current: '/tools/', main: mainHtml });
  html = html.replace(' </body>', `${tailScripts.map((s) => `  ${s}`).join('\n')}\n </body>`);
  // the kit stylesheets load after tool-legacy.css in the shell head order; move tool-legacy last so widgets keep their look
  html = html.replace('  <link href="/assets/css/tool-legacy.css" rel="stylesheet"/>\n', '').replace('<link href="/assets/css/subpages.css" rel="stylesheet"/>', '<link href="/assets/css/subpages.css" rel="stylesheet"/>\n  <link href="/assets/css/tool-legacy.css" rel="stylesheet"/>');
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
