// Site health check. GET /tools/api/site-check?url=example.com
// Fetches the home page, robots.txt and the sitemap of a public website and returns a list of checks.
// Nothing is stored or logged by this code. Only public hostnames on ports 80/443 are accepted.

const UA = 'SecureInChatSiteCheck/1.0 (+https://secureinchat.com/tools/site-health-check/)';
const TIMEOUT_MS = 6000;
const MAX_HOPS = 4;
const HTML_BYTES = 200000;
const XML_BYTES = 500000;

const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.intranet', '.arpa', '.test', '.invalid', '.example'];

// Returns { ok: true, host, origin } or { ok: false, error }.
export function parseTarget(input) {
  let s = String(input == null ? '' : input).trim();
  if (!s) return { ok: false, error: 'Enter a website address.' };
  if (s.length > 300) return { ok: false, error: 'That address is too long.' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch (e) { return { ok: false, error: 'That does not look like a web address.' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'Only http and https addresses can be checked.' };
  if (u.username || u.password) return { ok: false, error: 'Addresses with a username or password are not accepted.' };
  if (u.port && u.port !== '80' && u.port !== '443') return { ok: false, error: 'Only the standard web ports (80 and 443) can be checked.' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host.indexOf('.') === -1) return { ok: false, error: 'Enter a full domain name such as example.com.' };
  if (host.indexOf(':') !== -1 || /^\d+(\.\d+){0,3}$/.test(host) || /^0x/i.test(host)) return { ok: false, error: 'Enter a domain name, not an IP address.' };
  if (!/^[a-z0-9.-]+$/.test(host) && !host.startsWith('xn--') && !/^[a-z0-9.-]*xn--[a-z0-9.-]*$/.test(host)) return { ok: false, error: 'That domain name has characters that are not allowed.' };
  if (host.length > 253 || host.split('.').some((l) => !l || l.length > 63 || l.startsWith('-') || l.endsWith('-'))) return { ok: false, error: 'That is not a valid domain name.' };
  if (BLOCKED_SUFFIXES.some((x) => host.endsWith(x))) return { ok: false, error: 'Only public websites can be checked.' };
  return { ok: true, host, origin: 'https://' + host };
}

async function fetchOnce(url, method, maxBytes, signalExtra) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      signal: ctl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5', 'accept-encoding': 'identity' },
    });
    const ms = Date.now() - t0;
    let body = '';
    if (method === 'GET' && maxBytes && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder('utf-8', { fatal: false });
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        got += value.byteLength;
        body += dec.decode(value, { stream: true });
        if (got >= maxBytes) { try { await reader.cancel(); } catch (e) {} break; }
      }
    } else if (res.body) {
      try { await res.body.cancel(); } catch (e) {}
    }
    return { ok: true, status: res.status, headers: res.headers, body, ms, url };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'unreachable', url };
  } finally {
    clearTimeout(timer);
  }
}

// Follows up to MAX_HOPS redirects, re-validating every hop. Returns { final, chain } where chain lists each hop.
async function fetchFollow(startUrl, method, maxBytes) {
  const chain = [];
  let url = startUrl;
  for (let i = 0; i <= MAX_HOPS; i++) {
    const r = await fetchOnce(url, method, maxBytes);
    if (!r.ok) { chain.push({ url, error: r.error }); return { final: r, chain }; }
    chain.push({ url, status: r.status });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      let next;
      try { next = new URL(loc, url); } catch (e) { return { final: { ok: false, error: 'bad-redirect', url }, chain }; }
      const t = parseTarget(next.href);
      if (!t.ok || (next.protocol !== 'https:' && next.protocol !== 'http:')) return { final: { ok: false, error: 'blocked-redirect', url }, chain };
      url = next.href;
      continue;
    }
    return { final: r, chain };
  }
  return { final: { ok: false, error: 'too-many-redirects', url }, chain };
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// Reads the facts we report from the start of an HTML document.
export function readHtml(html) {
  const head = html.slice(0, HTML_BYTES);
  const out = { title: null, description: null, canonical: null, viewport: false, lang: null, h1: 0, noindex: false };
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  if (t) out.title = decodeEntities(t[1]);
  const lang = /<html[^>]*\slang=["']?([A-Za-z-]+)/i.exec(head);
  if (lang) out.lang = lang[1];
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  for (const m of metas) {
    const name = /\b(?:name|property)=["']?([^"'\s>]+)/i.exec(m);
    const content = /\bcontent=(?:"([^"]*)"|'([^']*)')/i.exec(m);
    if (!name || !content) continue;
    const n = name[1].toLowerCase(); const c = decodeEntities(content[1] != null ? content[1] : content[2]);
    if (n === 'description') out.description = c;
    if (n === 'viewport') out.viewport = true;
    if ((n === 'robots' || n === 'googlebot') && /noindex/i.test(c)) out.noindex = true;
  }
  const links = head.match(/<link\b[^>]*>/gi) || [];
  for (const l of links) {
    if (/\brel=["']?canonical\b/i.test(l)) {
      const h = /\bhref=(?:"([^"]*)"|'([^']*)')/i.exec(l);
      if (h) out.canonical = h[1] != null ? h[1] : h[2];
    }
  }
  out.h1 = (head.match(/<h1\b/gi) || []).length;
  return out;
}

export function readRobots(text) {
  const sitemaps = [];
  let blocksAll = false;
  let inStar = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase(); const v = m[2].trim();
    if (k === 'user-agent') inStar = v === '*';
    else if (k === 'disallow' && inStar && v === '/') blocksAll = true;
    else if (k === 'sitemap' && /^https?:\/\//i.test(v)) sitemaps.push(v);
  }
  return { sitemaps, blocksAll };
}

export function countLocs(xml) {
  return (xml.match(/<loc>/gi) || []).length;
}

const row = (id, label, status, value, detail) => ({ id, label, status, value, detail });

const SECURITY_HEADERS = [
  ['strict-transport-security', 'HSTS', 'Tells browsers to use HTTPS only. Add Strict-Transport-Security with a max-age of at least 6 months.'],
  ['content-security-policy', 'Content-Security-Policy', 'Limits where scripts and other resources can load from. It reduces the damage of injected scripts.'],
  ['x-content-type-options', 'X-Content-Type-Options', 'Set it to nosniff so browsers do not guess file types.'],
  ['referrer-policy', 'Referrer-Policy', 'Controls how much of the page address is sent to other sites. strict-origin-when-cross-origin is a common choice.'],
  ['permissions-policy', 'Permissions-Policy', 'Turns off browser features the site does not use, such as camera or location.'],
];

// Pure: turns collected facts into rows. Used by the handler and by the tests.
export function buildChecks(f) {
  const rows = [];
  if (!f.home || !f.home.ok) {
    rows.push(row('reach', 'Site reachable', 'fail', f.homeError || 'No response', 'The site did not answer over HTTPS within 6 seconds, so the other checks could not run.'));
    return rows;
  }
  const h = f.home;
  const finalHttps = /^https:/i.test(h.url);
  rows.push(row('https', 'HTTPS', finalHttps ? 'pass' : 'fail', finalHttps ? 'Served over HTTPS' : 'Final page is plain HTTP', finalHttps ? 'The page loads over an encrypted connection.' : 'The page ends on http://. Redirect all traffic to HTTPS.'));

  if (f.httpProbe) {
    const p = f.httpProbe;
    if (!p.ok) rows.push(row('http-redirect', 'HTTP redirects to HTTPS', 'info', 'Port 80 did not answer', 'Visitors who type the address without https may not reach the site. This can be fine if the site is HTTPS-only by design.'));
    else if (p.status >= 300 && p.status < 400 && /^https:/i.test(p.location || '')) rows.push(row('http-redirect', 'HTTP redirects to HTTPS', 'pass', p.status + ' to HTTPS', 'Plain http:// requests are sent to the secure address.'));
    else rows.push(row('http-redirect', 'HTTP redirects to HTTPS', 'fail', 'Status ' + p.status + (p.location ? ', to ' + p.location.slice(0, 80) : ''), 'http:// requests are not redirected to https://. Add a permanent redirect.'));
  }

  const hops = f.chain ? f.chain.length - 1 : 0;
  const okStatus = h.status >= 200 && h.status < 300;
  rows.push(row('status', 'Home page status', okStatus ? (hops > 2 ? 'warn' : 'pass') : 'fail', h.status + (hops ? ', ' + hops + ' redirect' + (hops === 1 ? '' : 's') : ''), okStatus ? (hops > 2 ? 'The page answers, but visitors pass through ' + hops + ' redirects first. Each one adds delay.' : 'The page answers normally.') : 'The home page returned ' + h.status + '. Search engines and visitors see an error.'));

  rows.push(row('speed', 'Response time', h.ms <= 800 ? 'pass' : h.ms <= 2000 ? 'warn' : 'fail', h.ms + ' ms', 'Time until the server began to answer, measured from one Cloudflare location. Your visitors in other regions will see different numbers.'));

  for (const [key, label, why] of SECURITY_HEADERS) {
    const v = h.headers.get(key);
    rows.push(row('hdr-' + key, label, v ? 'pass' : 'warn', v ? v.slice(0, 120) : 'Missing', v ? 'Present.' : why));
  }
  const xfo = h.headers.get('x-frame-options'); const csp = h.headers.get('content-security-policy') || '';
  const framed = xfo || /frame-ancestors/i.test(csp);
  rows.push(row('hdr-frame', 'Clickjacking protection', framed ? 'pass' : 'warn', framed ? (xfo ? 'X-Frame-Options: ' + xfo : 'CSP frame-ancestors') : 'Missing', framed ? 'Other sites cannot embed this page in a frame.' : 'Set X-Frame-Options or a CSP frame-ancestors rule so other sites cannot embed the page.'));

  const ct = h.headers.get('content-type') || '';
  if (/html/i.test(ct) && f.html) {
    const d = f.html;
    const xrobots = h.headers.get('x-robots-tag') || '';
    const noindex = d.noindex || /noindex/i.test(xrobots);
    rows.push(row('noindex', 'Search indexing allowed', noindex ? 'fail' : 'pass', noindex ? 'noindex found' : 'No noindex', noindex ? 'The page tells search engines not to index it. Remove noindex unless that is intended.' : 'Nothing blocks search engines from indexing the home page.'));
    const tl = d.title ? d.title.length : 0;
    rows.push(row('title', 'Page title', !tl ? 'fail' : tl < 10 || tl > 70 ? 'warn' : 'pass', d.title ? d.title.slice(0, 90) + ' (' + tl + ' characters)' : 'Missing', !tl ? 'Add a title element. It is the headline in search results.' : tl < 10 || tl > 70 ? 'Aim for roughly 10 to 70 characters so it is not cut off.' : 'Length is fine.'));
    const dl = d.description ? d.description.length : 0;
    rows.push(row('description', 'Meta description', !dl ? 'warn' : dl < 50 || dl > 170 ? 'warn' : 'pass', d.description ? dl + ' characters' : 'Missing', !dl ? 'Add a short description. Search engines often show it under the title.' : dl < 50 || dl > 170 ? 'Aim for about 50 to 170 characters.' : 'Length is fine.'));
    rows.push(row('canonical', 'Canonical link', d.canonical ? 'pass' : 'info', d.canonical ? d.canonical.slice(0, 100) : 'Not set', d.canonical ? 'Present.' : 'A canonical link tells search engines which address is the main one. It matters most when the same page loads at several addresses.'));
    rows.push(row('viewport', 'Mobile viewport', d.viewport ? 'pass' : 'fail', d.viewport ? 'Set' : 'Missing', d.viewport ? 'The page declares a mobile viewport.' : 'Without a viewport meta tag, phones show a zoomed-out desktop layout.'));
    rows.push(row('lang', 'Language attribute', d.lang ? 'pass' : 'warn', d.lang || 'Missing', d.lang ? 'Present.' : 'Add lang to the html element for screen readers and search engines.'));
    rows.push(row('h1', 'Main heading', d.h1 === 1 ? 'pass' : 'warn', d.h1 + ' h1 element' + (d.h1 === 1 ? '' : 's'), d.h1 === 1 ? 'One main heading.' : d.h1 === 0 ? 'Add one h1 that says what the page is about.' : 'Several h1 elements. One is the usual choice.'));
  } else {
    rows.push(row('html', 'Page content', 'info', ct ? ct.slice(0, 60) : 'Unknown type', 'The home page did not return HTML, so page-level checks were skipped.'));
  }

  const r = f.robots;
  if (!r) rows.push(row('robots', 'robots.txt', 'info', 'Not checked', ''));
  else if (!r.ok || r.status !== 200) rows.push(row('robots', 'robots.txt', 'warn', r.ok ? 'Status ' + r.status : 'No response', 'No robots.txt found. It is optional, but it is the standard place to point to your sitemap.'));
  else if (r.blocksAll) rows.push(row('robots', 'robots.txt', 'fail', 'Disallow: / for all crawlers', 'The file blocks every crawler from the whole site.'));
  else rows.push(row('robots', 'robots.txt', 'pass', 'Found' + (r.sitemaps.length ? ', lists ' + r.sitemaps.length + ' sitemap' + (r.sitemaps.length === 1 ? '' : 's') : ''), 'The file is readable and does not block the whole site.'));

  const s = f.sitemap;
  if (!s) rows.push(row('sitemap', 'Sitemap', 'info', 'Not checked', ''));
  else if (!s.ok || s.status !== 200) rows.push(row('sitemap', 'Sitemap', 'warn', s.ok ? 'Status ' + s.status : 'No response', 'No sitemap found at ' + (s.where || '/sitemap.xml') + '. A sitemap helps search engines find every page.'));
  else if (!s.locs) rows.push(row('sitemap', 'Sitemap', 'warn', 'Found, but no URLs', 'The file loaded but it lists no addresses. If it is a sitemap index, open it to check the child sitemaps.'));
  else rows.push(row('sitemap', 'Sitemap', 'pass', s.locs + ' address' + (s.locs === 1 ? '' : 'es') + (s.truncated ? ' or more' : ''), 'The sitemap loads and lists addresses.'));
  return rows;
}

export function summarize(rows) {
  const c = { pass: 0, warn: 0, fail: 0, info: 0 };
  for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
  return c;
}

export async function runCheck(input) {
  const t = parseTarget(input);
  if (!t.ok) return { status: 400, body: { error: t.error } };
  const home = await fetchFollow(t.origin + '/', 'GET', HTML_BYTES);
  const facts = { home: home.final, chain: home.chain, homeError: home.final && home.final.error ? ({ timeout: 'Timed out', unreachable: 'Could not connect', 'blocked-redirect': 'Redirected to an address that cannot be checked', 'too-many-redirects': 'Too many redirects', 'bad-redirect': 'Invalid redirect' }[home.final.error] || 'No response') : null };
  if (home.final && home.final.ok) {
    if (/html/i.test(home.final.headers.get('content-type') || '')) facts.html = readHtml(home.final.body);
    const finalOrigin = new URL(home.final.url).origin;
    const host = new URL(home.final.url).hostname;
    const probe = await fetchOnce('http://' + t.host + '/', 'HEAD', 0);
    facts.httpProbe = probe.ok ? { ok: true, status: probe.status, location: probe.headers.get('location') || '' } : { ok: false };
    const rb = await fetchOnce(finalOrigin + '/robots.txt', 'GET', 100000);
    facts.robots = rb.ok ? Object.assign({ ok: true, status: rb.status }, rb.status === 200 ? readRobots(rb.body) : { sitemaps: [], blocksAll: false }) : { ok: false };
    let smUrl = finalOrigin + '/sitemap.xml';
    if (facts.robots.ok && facts.robots.sitemaps.length) {
      try { const u = new URL(facts.robots.sitemaps[0]); if (parseTarget(u.href).ok) smUrl = u.href; } catch (e) {}
    }
    const sm = await fetchOnce(smUrl, 'GET', XML_BYTES);
    facts.sitemap = sm.ok ? { ok: true, status: sm.status, where: new URL(smUrl).pathname, locs: sm.status === 200 ? countLocs(sm.body) : 0, truncated: sm.body.length >= XML_BYTES } : { ok: false, where: new URL(smUrl).pathname };
    facts.host = host;
  }
  const rows = buildChecks(facts);
  return { status: 200, body: { target: t.host, finalUrl: facts.home && facts.home.ok ? facts.home.url : null, checkedAt: new Date().toISOString(), summary: summarize(rows), checks: rows } };
}

export async function siteCheck(request) {
  const url = new URL(request.url);
  const out = await runCheck(url.searchParams.get('url'));
  return new Response(JSON.stringify(out.body), {
    status: out.status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}
