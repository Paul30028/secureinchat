// Generates the static site into ../public. Run: node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { POSTS } from './posts.mjs';
import { MISSION, MISSION_SHORT, LAYERS, layerBody, layerTags, protectIndexBody, SITUATIONS, situationBody, startIndexBody } from './protect.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'public');
const SITE = 'https://secureinchat.com';
const DATE = '2026-10-21';
const REPO = 'https://github.com/Paul30028/secureinchat';

const iconDir = path.join(import.meta.dirname, 'node_modules/lucide-static/icons');
const icon = (name, cls = 'icon') => {
  let s = fs.readFileSync(path.join(iconDir, name + '.svg'), 'utf8');
  s = s.replace(/<!--[\s\S]*?-->/, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/ class="[^"]*"/, '').replace(/ width="24"/, '').replace(/ height="24"/, '');
  return s.replace('<svg', `<svg class="${cls}" aria-hidden="true" focusable="false"`);
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------------------------
const HOME_TITLE = 'SecureInChat: Protect Your Privacy, One Layer at a Time';
const HOME_DESC = 'Practical privacy protection for your devices, accounts, conversations and AI use: free tools that run on your own device, guides with honest notes on what was tested, offline messaging and a zero-knowledge messenger.';

const ARCH = [
  { icon: 'lock-keyhole', title: 'Sender encrypts locally', copy: 'Message content and session keys are processed on the device before anything is sent.', status: 'Plaintext never leaves the device' },
  { icon: 'server-off', title: 'Blind relay forwards', copy: 'The relay routes encrypted payloads without the keys needed to decrypt them.', status: 'Cannot read message content' },
  { icon: 'lock-keyhole-open', title: 'Recipient decrypts locally', copy: 'Only the intended recipient device decrypts and checks the message.', status: 'Decrypted at the edge' },
];
const SEC = [
  { title: 'Curve25519', tag: 'Key agreement', copy: 'Elliptic-curve key agreement for modern client devices.' },
  { title: 'AES-256-GCM', tag: 'Authenticated encryption', copy: 'Protects both confidentiality and integrity of each message.' },
  { title: 'HKDF', tag: 'Key derivation', copy: 'Context-separated key derivation for session and message keys.' },
  { title: 'No message storage', tag: 'Data minimisation', copy: 'The relay is designed without persistent storage of message content.' },
];
const TOOLS_HOME = [
  { name: 'Photo metadata remover', href: '/tools/photo-metadata-remover/', copy: 'See and remove the location, device and dates hidden in a photo.', k: ['tested', 'Runs on your device'] },
  { name: 'Text redactor', href: '/tools/text-redactor/', copy: 'Replace emails, numbers and keys with placeholders before you share text or paste it into AI.', k: ['tested', 'Runs on your device'] },
  { name: 'IP leak test', href: '/tools/ip-leak-test/', copy: 'Check whether your VPN or proxy leaks your real address through WebRTC, IPv6 or DNS.', k: ['lim', 'Contacts lookup services'] },
];
const FLOW = [
  ['Photo metadata remover', 'The photo and its metadata', 'Nothing'],
  ['Text redactor', 'The text you paste', 'Nothing'],
  ['Password checker', 'The password and its full hash', 'First 5 characters of its SHA-1 hash, to Pwned Passwords'],
  ['IP leak test', 'Verdicts and comparisons', 'Your IP to the lookup services it lists'],
];

const GUIDES = [
  { slug: 'breakout-game-with-ai', title: 'Build a Breakout game with AI in one HTML file', blurb: 'A prompt set, the finished game and an automated test, re-run from scratch with every result logged, including the failures.',
    status: 'Re-run from scratch on 2026-10-20; pass rate in the test log', price: '0.99', buyUrl: '' },
];

// ---------------------------------------------------------------------------------------------
function head({ title, desc, canonical, jsonld, lang = 'en' }) {
  return `<meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#F5F4EF" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#111816" media="(prefers-color-scheme: dark)" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${SITE}${canonical}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preload" href="/assets/fonts/source-serif-4-600.woff2" as="font" type="font/woff2" crossorigin />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SecureInChat" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${SITE}${canonical}" />
  <meta property="og:locale" content="${lang === 'en' ? 'en_US' : lang.replace('-', '_')}" />
  <meta name="twitter:card" content="summary" />
  <link rel="stylesheet" href="/assets/site.css" />
  <script src="/assets/main.js"></script>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ''}`;
}

const NAV = [['/protect/', 'Protect', 'protect'], ['/tools/', 'Tools', 'tools'], ['/blog/', 'Guides', 'blog'], ['/messaging/', 'Messaging', 'messaging'], ['/about/', 'About', 'about']];
function header(current) {
  return `<header class="top">
    <div class="wrap top__in">
      <a href="/" class="brand" aria-label="SecureInChat home"><span class="brand__mark">${icon('shield-check')}</span>SecureInChat</a>
      <nav class="nav" aria-label="Main">
        ${NAV.map(([h, t, k]) => `<a href="${h}"${current === k ? ' aria-current="page"' : ''}>${t}</a>`).join('\n        ')}
      </nav>
    </div>
  </header>`;
}
function footer() {
  return `<footer class="foot">
    <div class="wrap foot__in">
      <div>© 2026 SecureInChat. Privacy, one layer at a time.</div>
      <nav aria-label="Footer">
        <a href="/mission/">Mission</a><a href="/principles/">Principles</a><a href="/privacy/">Privacy</a><a href="/principles/#labels">Status labels</a><a href="/sponsor/">Sponsorship and affiliate disclosure</a><a href="/guides/">AI build guides</a><a href="/contact/">Contact</a><a href="${REPO}" rel="noopener">GitHub</a>
      </nav>
    </div>
  </footer>`;
}
function page({ lang = 'en', title, desc, canonical, jsonld, current, main }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  ${head({ title, desc, canonical, jsonld, lang })}
</head>
<body>
  <a href="#top" class="skip">Skip to content</a>
  ${header(current)}
  <main id="top">
${main}
  </main>
  ${footer()}
</body>
</html>
`;
}
const tagHtml = (k, t) => `<span class="tag tag--${k}">${t}</span>`;

// ---------------------------------------------------------------------------------------------
function home() {
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': SITE + '/#org', name: 'SecureInChat', url: SITE + '/' },
    { '@type': 'WebSite', '@id': SITE + '/#site', url: SITE + '/', name: 'SecureInChat', publisher: { '@id': SITE + '/#org' }, inLanguage: 'en' },
  ] };
  const hero = `    <section class="wrap hero">
      <div>
        <h1>Protect your privacy, one layer at a time.</h1>
        <p class="hero__sub">Practical protection for your devices, accounts, conversations and AI use, with free tools that run on your own device and honest notes on what we have and have not tested.</p>
        <div class="hero__cta"><a class="btn btn--p" href="/start/">Find where to start</a><a class="btn btn--s" href="/tools/">Use a free tool</a></div>
        <p class="hero__trust">No cookies · No accounts · Tools run in your browser · Untested steps are labelled</p>
      </div>
      <a class="quick" href="/tools/photo-metadata-remover/">
        ${tagHtml('tested', 'Runs on your device')}
        <h2>Clean a photo before you share it</h2>
        <p>Remove the location, device and time hidden in a photo. The photo never leaves your browser.</p>
        <div class="quick__drop">Open the photo cleaner →</div>
      </a>
    </section>`;
  const sit = `    <section class="wrap sec" id="start">
      <p class="eyebrow">Start from your situation</p>
      <h2>What worries you most right now?</h2>
      <div class="grid grid--4">
        ${SITUATIONS.map((S) => `<a class="card card--sit" href="/start/${S.slug}/"><h3>${esc(S.title)}</h3><p>${esc(S.short)}</p></a>`).join('\n        ')}
      </div>
    </section>`;
  const layers = `    <section class="wrap sec" id="layers">
      <p class="eyebrow">Six layers of protection</p>
      <h2>From the hardware in your hands to the software on it.</h2>
      <p class="sec__lead">One weak layer undoes the others. Each layer page lists what works today and what is still being built or tested.</p>
      <div class="grid grid--3">
        ${LAYERS.map((L, i) => `<a class="card layer layer--${i + 1}" href="/protect/${L.slug}/"><div class="layer__num">${String(i + 1).padStart(2, '0')}</div><h3>${esc(L.name)}</h3><p>${esc(L.tagline)}</p><div class="tags">${layerTags(L)}</div></a>`).join('\n        ')}
      </div>
    </section>`;
  const tools = `    <section class="wrap sec" id="tools">
      <p class="eyebrow">Free tools</p>
      <h2>Check something in the next two minutes.</h2>
      <div class="grid grid--3">
        ${TOOLS_HOME.map((t) => `<a class="card" href="${t.href}"><h3>${t.name}</h3><p>${t.copy}</p><div class="tags">${tagHtml(t.k[0], t.k[1])}</div></a>`).join('\n        ')}
      </div>
      <p class="sec__lead"><a href="/tools/">All eight tools</a></p>
    </section>`;
  const featured = ['encrypted-messaging-when-networks-fail', 'bank-statement-before-ai-upload', 'what-data-brokers-know-about-you'].map((s) => POSTS.find((p) => p.slug === s));
  const ftag = { 'encrypted-messaging-when-networks-fail': tagHtml('doc', 'Documented') + tagHtml('untested', 'Field test pending'), 'bank-statement-before-ai-upload': tagHtml('tested', 'We ran the test'), 'what-data-brokers-know-about-you': tagHtml('doc', 'Guide') };
  const guides = `    <section class="wrap sec" id="guides">
      <p class="eyebrow">Guides</p>
      <h2>The risk, then exactly what to do about it.</h2>
      <div class="grid grid--3">
        ${featured.map((p) => `<a class="card" href="/blog/${p.slug}/"><h3>${esc(p.title)}</h3><p>Updated ${p.date}</p><div class="tags">${ftag[p.slug]}</div></a>`).join('\n        ')}
      </div>
      <p class="sec__lead"><a href="/blog/">All guides</a></p>
    </section>`;
  const trust = `    <section class="wrap sec" id="data">
      <div class="trust">
        <div><p class="eyebrow">How we handle your data</p><h2>Don't just trust us. Check us.</h2><p>Every tool lists what stays on your device and what leaves it. The code is public, and you can watch your browser's network panel while you use a tool. <a href="/principles/">Tool-by-tool details</a>.</p></div>
        <table><thead><tr><th scope="col">Tool</th><th scope="col">Stays on your device</th><th scope="col">Sent to others</th></tr></thead><tbody>
          ${FLOW.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('\n          ')}
        </tbody></table>
      </div>
    </section>`;
  const msg = `    <section class="wrap sec" id="messaging">
      <div class="band">
        <div><p class="eyebrow">Communication layer</p><h2>SecureInChat messenger: the server forwards, it never reads.</h2><p>Keys stay on your devices and a blind relay only forwards ciphertext. The apps are in development; you can test the live relay from your browser today.</p></div>
        <a class="btn btn--s" href="/messaging/">See how it works</a>
      </div>
    </section>`;
  const mission = `    <section class="wrap sec">
      <p class="eyebrow">Our mission</p>
      <h2>Privacy is a right, not a premium feature.</h2>
      <p class="sec__lead">${esc(MISSION_SHORT)} <a href="/mission/">Read our mission and what we will never do</a>.</p>
    </section>`;
  return page({ title: HOME_TITLE, desc: HOME_DESC, canonical: '/', jsonld, main: [hero, sit, layers, tools, guides, trust, msg, mission].join('\n\n') });
}

function messaging() {
  const body = `    <section class="wrap doc doc--top">
      <p class="meta"><a href="/protect/communication/">Communication layer</a></p>
      <h1>SecureInChat messenger</h1>
      <p class="lead">An end-to-end encrypted messenger built on a blind relay: keys stay on your devices and the relay only forwards ciphertext it cannot read.</p>
      <p>${tagHtml('lim', 'Apps in development')}${tagHtml('untested', 'No third-party audit yet')}</p>
      <p>The apps are not released yet. What you can check today is the production relay itself, below, from your own browser. We have not had an independent security audit and do not claim certifications.</p>
    </section>
    <section class="wrap wide" id="diagnostics">
      <div class="diag">
        <div class="diag__head">
          <div><p class="eyebrow">Live relay test</p><h2>Check the relay from your browser.</h2><p class="sec__lead">Your browser opens a real secure WebSocket to the relay, measures the handshake time and checks the relay's challenge. No message content is involved.</p></div>
          <div>
            <p class="status" id="net-status" data-state="check" role="status"><span class="status__dot" aria-hidden="true"></span><span id="net-label">Network: Checking</span></p>
            <button id="node-btn" type="button" class="btn btn--p" data-testing="Testing…" data-retest="Run the relay test"><span id="node-btn-label">Run the relay test</span></button>
          </div>
        </div>
        <div class="diag__grid">
          <div class="diag__cell"><div class="diag__label">Relay endpoint</div><div class="diag__val diag__val--sm mono">wss://ws.secureinchat.com</div><div id="node-conn" class="diag__note">Awaiting test</div></div>
          <div class="diag__cell"><div class="diag__label">Handshake time</div><div class="diag__val"><span id="node-latency">—</span> <span class="diag__unit">ms</span></div><div class="diag__note">Browser-to-relay open time</div></div>
          <div class="diag__cell"><div class="diag__label">Transport</div><div class="diag__val">WSS / TLS</div><div class="diag__note">Certificate checked by your browser</div></div>
          <div class="diag__cell"><div class="diag__label">Relay challenge</div><div id="node-chal" class="diag__val">Pending</div><div id="node-chal-detail" class="diag__note">Waiting for auth_challenge</div></div>
        </div>
        <div id="node-log" class="diag__log" role="status" aria-live="polite">Ready to test the blind relay endpoint.</div>
      </div>
    </section>
    <section class="wrap sec" id="architecture">
      <p class="eyebrow">Architecture</p>
      <h2>The server forwards. It never understands.</h2>
      <div class="grid grid--3">
        ${ARCH.map((a, i) => `<article class="card"><div class="layer__num">0${i + 1} / 03</div><h3>${icon(a.icon)} ${a.title}</h3><p>${a.copy}</p><div class="tags">${tagHtml('doc', a.status)}</div></article>`).join('\n        ')}
      </div>
    </section>
    <section class="wrap sec" id="security">
      <p class="eyebrow">Cryptography</p>
      <h2>Established primitives, minimal trust surface.</h2>
      <div class="grid grid--4">
        ${SEC.map((s) => `<article class="card"><p class="eyebrow eyebrow--sm">${s.tag}</p><h3>${s.title}</h3><p>${s.copy}</p></article>`).join('\n        ')}
      </div>
      <p class="sec__lead">These describe the design. They are not a legal certification or an independent audit. What the relay can and cannot see is explained in <a href="/blog/what-a-blind-relay-can-and-cannot-know/">what a blind relay can and cannot know</a>.</p>
    </section>`;
  return page({ title: 'SecureInChat messenger: zero-knowledge blind relay | SecureInChat', desc: 'How the SecureInChat messenger works: end-to-end encryption, a blind relay that cannot read messages, current status and a live relay test you can run in your browser.', canonical: '/messaging/', current: 'messaging', main: body });
}

const LOCAL = {
  zh: { lang: 'zh-CN', title: 'SecureInChat：零知识盲中继加密通信', h1: '沟通不留痕迹。', notice: '本页尚未更新，只介绍我们的加密聊天软件。完整的个人隐私防护内容（六层防护、免费工具和指南）目前只有英文版。',
    copy: '零知识盲中继通信协议：密钥始终保留在用户设备，中继服务器只转发无法读取的密文。客户端仍在开发中。', en: '前往英文网站', msg: '查看加密聊天的工作原理和在线中继测试（英文）' },
  ja: { lang: 'ja', title: 'SecureInChat：ゼロ知識ブラインドリレー通信', h1: '痕跡を残さない通信。', notice: 'このページはまだ更新されておらず、暗号化メッセンジャーのみを紹介しています。個人のプライバシー保護に関する全コンテンツ（6 層の保護、無料ツール、ガイド）は現在英語版のみです。',
    copy: '暗号鍵は端末内に保持され、リレーは解読不能な暗号文だけを転送します。クライアントは開発中です。', en: '英語版サイトへ', msg: 'メッセンジャーの仕組みとリレー診断（英語）' },
};
function localPage(code) {
  const t = LOCAL[code];
  const main = `    <div class="wrap doc">
      <p class="notice">${t.notice}</p>
      <h1>${t.h1}</h1>
      <p class="lead">${t.copy}</p>
      <p><a class="btn btn--p" href="/" hreflang="en" lang="en">${t.en}</a></p>
      <p><a href="/messaging/" hreflang="en">${t.msg}</a></p>
    </div>`;
  return page({ lang: t.lang, title: t.title, desc: t.copy, canonical: `/${code}/`, main });
}

function docPage({ slug, title, desc, body, current = null, article = null }) {
  return page({ title: `${title} | SecureInChat`, desc, canonical: `/${slug}/`, jsonld: article, current, main: `    <div class="wrap doc">\n${body}\n    </div>` });
}

// ---------------------------------------------------------------------------------------------
const PRIVACY = `    <h1>Privacy policy</h1>
    <p class="meta">Last updated: ${DATE}</p>
    <p>This policy covers secureinchat.com, including the tools under /tools/. It describes what the site does with your data today. If that changes, for example if we add advertising, we will update this page before the change goes live.</p>

    <p>A tool-by-tool list is on the <a href="/principles/">privacy principles</a> page.</p>
    <h2>What we do not do</h2>
    <ul>
      <li>We do not set cookies and we do not use local storage on this site.</li>
      <li>We do not ask you to create an account or give us your name or email address.</li>
      <li>We do not store the results of any tool you run.</li>
    </ul>

    <h2>Hosting and server logs</h2>
    <p>The site is served by Cloudflare. Like any web host, Cloudflare receives your IP address and request details when your browser loads a page, and processes them to deliver the site and protect it from abuse. See <a href="https://www.cloudflare.com/privacypolicy/" rel="noopener">Cloudflare's privacy policy</a>.</p>

    <h2>Guides and checkout</h2>
    <p>The guides pages under /guides/ load no analytics and set no cookies. When a guide has a purchase button, it leads to a third-party checkout provider. That provider handles payment, processes your payment details and personal data under its own privacy policy, and may set its own cookies. We do not receive your card details.</p>
    <h2>Aggregate analytics</h2>
    <p>The main pages use Cloudflare Web Analytics, which measures page views and performance without cookies and without tracking you across sites. The tools pages under /tools/ load no analytics.</p>

    <h2>Relay diagnostics</h2>
    <p>The <a href="/messaging/">messaging page</a> opens a WebSocket connection from your browser to our relay at ws.secureinchat.com when it loads to measure latency and verify the relay's challenge. No message content is involved. The relay and Cloudflare see the connection the way any server sees a visitor, including your IP address.</p>

    <h2>The IP leak test</h2>
    <p>The test runs in your browser. When you press the button, your browser contacts these services, and each of them necessarily sees your IP address:</p>
    <ul>
      <li><strong>This site</strong> (<code>/tools/api/whoami</code>) returns the address, network and approximate location Cloudflare saw, plus a few request headers. It writes nothing to disk.</li>
      <li><strong>api4.ipify.org and api6.ipify.org</strong> return your IPv4 and IPv6 addresses.</li>
      <li><strong>ipwho.is</strong> looks up the network of a second address when the test finds one, and the network of each DNS resolver.</li>
      <li><strong>Random names under lk.secureinchat.com</strong> are looked up by your system for the DNS check. The DNS server we run for that domain records the address of the resolver that asks, keeps it in memory for ten minutes and writes no log. It also keeps one count per day of how many tests reached it and how many results were read back; this is a number only and holds no address. To stop one source from inflating that count, a per-resolver counter is held in memory for up to an hour and is never written out. That address can be your internet provider's resolver, a public resolver or, if your system resolves names itself, your own address. The server's hosting provider can see network traffic to it, as any host can.</li>
      <li><strong>dnsapi.secureinchat.com</strong> returns the resolver addresses recorded for your run, and only yours. It sees your IP address when your browser asks.</li>
      <li><strong>api.pwnedpasswords.com</strong> answers the password checker's breach check, only when you press its button. Your browser sends the first five characters of the password's SHA-1 hash, never the password or the full hash. The service sees your IP address and that prefix.</li>
      <li><strong>stun.cloudflare.com</strong> answers the WebRTC check, as it does for video calls.</li>
    </ul>
    <p>Those requests are sent without cookies and without a referrer.</p>

    <h2>Advertising and affiliate links</h2>
    <p>The site does not currently show advertising. If we add ads or affiliate links, they will be labeled, this page will be updated first, and third-party ad providers may then use cookies under their own policies.</p>

    <h2>Your choices and contact</h2>
    <p>Because we do not keep personal data about visitors, there is little to access or delete. For privacy questions, open an issue on <a href="${REPO}/issues" rel="noopener">GitHub</a>. Our contact details are on the <a href="/contact/">contact page</a>.</p>
`;

const ABOUT = `    <h1>About SecureInChat</h1>
    <p class="meta">Last updated: ${DATE}</p>
    <p>SecureInChat helps people protect their personal privacy layer by layer: physical, devices, accounts, communication, offline and AI. It started as an end-to-end encrypted messenger built on a blind relay, where keys stay on your devices and the relay only forwards ciphertext; the messenger clients are still in development. Read our <a href="/mission/">mission, vision and commitments</a>.</p>

    <h2>What you can use today</h2>
    <ul>
      <li><strong>Relay diagnostics</strong> on the <a href="/messaging/">messaging page</a>: a real WebSocket test against the production relay, with measured latency.</li>
      <li><strong>Privacy tools</strong> in <a href="/tools/">/tools/</a>, starting with the <a href="/tools/ip-leak-test/">IP leak test</a>. They run in your browser and store nothing.</li>
      <li>The <a href="/blog/">blog</a>, with notes on end-to-end encryption and zero-knowledge design.</li>
    </ul>

    <h2>How we write about security</h2>
    <ul>
      <li>We explain why and how to verify, not only conclusions.</li>
      <li>We say what a test cannot see. Our DNS check, for example, compares with an earlier run to judge a leak, and the page says when it cannot tell.</li>
      <li>We separate design goals from independent audits. SecureInChat has not been through a third-party audit, and we do not claim SOC 2, ISO 27001 or similar certifications.</li>
      <li>The tools' source code is public in the <a href="${REPO}" rel="noopener">site repository</a>.</li>
    </ul>

    <h2>Who runs this</h2>
    <p>The site is built and maintained by Paul, an independent developer working on SecureInChat. Content may be drafted with AI assistance and is reviewed before it is published.</p>

    <p>Questions or corrections: see the <a href="/contact/">contact page</a>.</p>
`;

const CONTACT = `    <h1>Contact</h1>
    <p class="meta">Last updated: ${DATE}</p>
    <p>The fastest way to reach us is to open an issue in the public repository. It works for bug reports, factual corrections, tool feedback and privacy questions.</p>
    <ul>
      <li><a href="${REPO}/issues" rel="noopener">Open an issue on GitHub</a></li>
      <li>Email: <a href="mailto:x@secureinchat.com">x@secureinchat.com</a></li>
    </ul>
    <h2>Sponsorship and partnerships</h2>
    <p>Privacy-respecting products can sponsor the free tools and guides. Any sponsored or affiliate placement is labelled as such and never changes a test result. See <a href="/sponsor/">how sponsorship works</a> and our <a href="/mission/">mission</a>.</p>
    <p>Please do not post sensitive personal information in a public issue. We will never ask for passwords, keys or private messages.</p>
`;

const PRINCIPLES = `    <h1>Privacy principles for the tools</h1>
    <p class="meta">Last updated: ${DATE}</p>
    <p>This page lists, tool by tool, what runs on your device, what leaves it and who receives it. It complements the <a href="/privacy/">privacy policy</a>. Where a limit exists we say so.</p>
    <h2>Rules we follow</h2>
    <ul>
      <li>Files, photos and passwords are processed in your browser and are never uploaded.</li>
      <li>No cookies, no accounts and no advertising or analytics scripts on the tools pages.</li>
      <li>Test results are not stored on our side. The DNS test keeps resolver addresses in memory for ten minutes, plus a daily count of tests with no addresses in it.</li>
      <li>Every outside service a tool contacts is listed below. A page security policy blocks any other.</li>
    </ul>
    <h2 id="labels">Status labels</h2>
    <ul>
      <li><span class="tag tag--tested">Tested</span> We ran it ourselves and the page says when and how. For tools: it runs on your device and is covered by our automated tests.</li>
      <li><span class="tag tag--doc">Documented</span> Taken from the project's or vendor's own documentation, linked on the page. We have not tested it ourselves.</li>
      <li><span class="tag tag--untested">Untested</span> Planned, or not checked yet. Do not rely on it.</li>
      <li><span class="tag tag--lim">Limitations</span> Works, with known limits or outside services involved. The limits are listed on the page.</li>
      <li><span class="tag tag--aff">Affiliate</span> We may earn a commission. It never changes a verdict.</li>
    </ul>
    <h2>Recommendations, sponsors and products</h2>
    <ul>
      <li>We only recommend products that collect no more data than they need. Commission never changes a verdict, and every affiliate or sponsored link is labelled.</li>
      <li>Any physical product we sell will be one whose protection you can check yourself. We do not sell closed-firmware security electronics under our own brand.</li>
      <li>If we add an AI assistant for setup help or support, this page will say which service processes the conversation and how long it is kept before it goes live. It will never ask for passwords, recovery codes or keys.</li>
    </ul>
    <h2>Tool by tool</h2>
    <table>
      <thead><tr><th>Tool</th><th>Stays on your device</th><th>Sent to others</th></tr></thead>
      <tbody>
        <tr><td><a href="/tools/ip-leak-test/">IP leak test</a></td><td>Verdicts and comparisons</td><td>Your IP to ipify and ipwho.is; random DNS names to our lookup server; resolver addresses read from our API</td></tr>
        <tr><td><a href="/tools/webrtc-leak-test/">WebRTC leak test</a></td><td>Everything</td><td>A STUN request to a public server, which sees your public address</td></tr>
        <tr><td><a href="/tools/ipv6-leak-test/">IPv6 leak test</a></td><td>Verdicts</td><td>Your IPv6 address to ipify</td></tr>
        <tr><td><a href="/tools/photo-metadata-remover/">Photo metadata remover</a></td><td>The photo and its metadata</td><td>Nothing</td></tr>
        <tr><td><a href="/tools/browser-fingerprint-test/">Fingerprint test</a></td><td>All signals</td><td>Nothing</td></tr>
        <tr><td><a href="/tools/password-checker/">Password checker</a></td><td>The password and its full hash</td><td>The first five characters of its SHA-1 hash to Pwned Passwords</td></tr>
        <tr><td><a href="/tools/text-redactor/">Text redactor</a></td><td>The text you paste</td><td>Nothing</td></tr>
        <tr><td><a href="/tools/site-health-check/">Website health check</a></td><td>The report</td><td>The address you enter goes to this site, which fetches that site's public pages. Our code does not store or log it</td></tr>
      </tbody>
    </table>
    <h2>What we cannot hide</h2>
    <ul>
      <li>Our CDN, Cloudflare, sees the IP address of every request to the site, as any web host does.</li>
      <li>Outside services see your IP address when you use a tool that contacts them.</li>
      <li>Results depend on your browser and network. A pass is not proof of anonymity.</li>
    </ul>
    <h2>Checking it yourself</h2>
    <p>The tools are plain scripts without a build step on the page. Open your browser's network panel while using one and compare the requests with the table. The source is public in the <a href="https://github.com/Paul30028/secureinchat">repository</a>.</p>
`;

const SPONSOR = `    <h1>Sponsorship and partnerships</h1>
    <p class="meta">Last updated: ${DATE}</p>
    <p>SecureInChat helps people protect their privacy layer by layer, from physical gear to accounts, messaging and AI use. We accept a small number of sponsors and affiliate partners whose products respect the same principle. See our <a href="/mission/">mission</a>.</p>
    <h2>Who can sponsor</h2>
    <ul>
      <li>Products that collect no more data than they need to work, explain their data handling clearly and do not sell user data.</li>
      <li>Examples of categories we cover: encrypted email, password managers, security keys, privacy-respecting browsers and software, and physical privacy gear.</li>
      <li>We decline products whose business depends on tracking users, and we may decline any product we cannot test or describe accurately.</li>
    </ul>
    <h2>What we offer</h2>
    <ul>
      <li>A labelled sponsor placement on the tools pages, at most one per page.</li>
      <li>A mention in a blog post that explains a technical topic, marked as sponsored.</li>
      <li>Affiliate links in articles, with a visible disclosure next to each link.</li>
    </ul>
    <h2>Our rules</h2>
    <ul>
      <li>Test results are computed in the visitor's browser. A sponsor cannot change them or the wording of a verdict.</li>
      <li>Every paid or affiliate placement is labelled as such.</li>
      <li>We only list products we can describe accurately. We may ask to test a product before we mention it.</li>
      <li>We do not add trackers for sponsors. Any measurement is aggregate, such as clicks, and is described in the <a href="/privacy/">privacy policy</a> before it starts.</li>
    </ul>
    <h2>Traffic</h2>
    <p>The site is new. We will share real figures on request once there are enough to be meaningful, and we will not quote numbers we cannot show.</p>
    <h2>Get in touch</h2>
    <p>Email <a href="mailto:x@secureinchat.com">x@secureinchat.com</a> with the product, the audience you want to reach and what you would like to run.</p>
`;

// ---------------------------------------------------------------------------------------------
function write(rel, content) {
  const f = path.join(PUB, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

write('index.html', home());
for (const c of Object.keys(LOCAL)) write(`${c}/index.html`, localPage(c));
write('messaging/index.html', messaging());
write('start/index.html', docPage({ slug: 'start', title: 'Start from your situation', desc: 'Pick what worries you most and get the first privacy steps you can take today.', body: startIndexBody(esc), current: 'protect' }));
for (const S of SITUATIONS) write(`start/${S.slug}/index.html`, docPage({ slug: `start/${S.slug}`, title: S.title, desc: S.intro.slice(0, 155), body: situationBody(S, esc), current: 'protect' }));
write('privacy/index.html', docPage({ slug: 'privacy', title: 'Privacy policy', desc: 'What secureinchat.com and its tools do with your data: no cookies, no accounts, no stored test results.', body: PRIVACY, current: 'about' }));
write('about/index.html', docPage({ slug: 'about', title: 'About', desc: 'About SecureInChat: an end-to-end encrypted blind-relay messenger in development, plus free privacy tools.', body: ABOUT, current: 'about' }));
write('sponsor/index.html', docPage({ slug: 'sponsor', title: 'Sponsorship and partnerships', desc: 'How VPN, proxy and privacy-tool vendors can sponsor SecureInChat tools, and the rules that keep test results independent.', body: SPONSOR, current: 'about' }));
write('principles/index.html', docPage({ slug: 'principles', title: 'Privacy principles for the tools', desc: 'What each SecureInChat tool processes on your device, what it sends to outside services, and the limits we cannot remove.', body: PRINCIPLES, current: 'about' }));
write('mission/index.html', docPage({ slug: 'mission', title: 'Our mission', desc: 'What SecureInChat believes, what we are building toward, who we build for and what we will never do.', body: MISSION, current: 'about' }));
write('protect/index.html', docPage({ slug: 'protect', title: 'Protect your privacy, layer by layer', desc: 'Six layers of personal privacy protection: physical, devices, accounts and email, communication, offline and emergency, and AI privacy.', body: protectIndexBody(esc), current: 'protect' }));
LAYERS.forEach((L, i) => write(`protect/${L.slug}/index.html`, docPage({ slug: `protect/${L.slug}`, title: `${L.name} privacy`, desc: `${L.tagline} ${L.threat}`.slice(0, 155), body: layerBody(L, esc, i + 1), current: 'protect' })));
write('contact/index.html', docPage({ slug: 'contact', title: 'Contact', desc: 'How to contact SecureInChat.', body: CONTACT, current: 'about' }));

// guides (new section; checkout is a third-party link set by the owner)
const buyBtn = (g) => g.buyUrl
  ? `<a href="${g.buyUrl}" rel="noopener" class="inline-block px-6 py-3 rounded-xl bg-white text-slate-950 font-semibold">Get the pack: $${g.price}</a>`
  : `<span class="inline-block px-6 py-3 rounded-xl bg-white/10 text-slate-400 font-semibold" aria-disabled="true">Get the pack: $${g.price} (coming soon)</span>`;
const GUIDE_INDEX = `    <h1>Tested AI guides</h1>
    <p>Step-by-step guides for building things with AI. Each one ships with the prompts, the working result, an automated test and the real test log, including the failures. We say what was verified and what was not. All content is original.</p>
${GUIDES.map((g) => `    <h2><a href="/guides/${g.slug}/">${g.title}</a></h2>\n    <p>${g.blurb}</p>\n    <p><strong>${g.status}</strong></p>`).join('\n')}`;
write('guides/index.html', docPage({ slug: 'guides', title: 'Tested AI guides', desc: 'Step-by-step guides for building with AI, each with the prompts, a working result and the automated test that proves it.', body: GUIDE_INDEX, current: 'guides' }));
for (const g of GUIDES) {
  const body = `    <h1>${g.title}</h1>
    <p><strong>${g.status}</strong></p>
    <p><a href="/guides/${g.slug}/play/">Play the finished game</a> (this is what you build; it is a demo of the result, not proof that every step passes).</p>
    <h2>What you build</h2>
    <p>A complete Breakout game in a single HTML file: paddle, 40 bricks, three lives, scoring, keyboard, mouse and touch control. You paste prompts into an AI and check the result; you do not write the code by hand.</p>
    <h2>Free preview: Prompt 1</h2>
    <pre><code>Write a single-file HTML5 canvas Breakout game (no libraries, no external assets). 480x560 canvas; 8 columns x 5 rows of bricks; ... Expose window.__game = { get(), reset(), start() } ... Return only the file.</code></pre>
    <h2>In the pack</h2>
    <ul><li>The full prompt sequence: build, test, fix, variations</li><li>game.html, ready to open in a browser</li><li>test_game.py, an automated Playwright test</li><li>TEST_LOG.txt with every real run: 14 runs, a bug in the test itself, and the failures</li></ul>
    <h2>What was verified, and what was not</h2>
    <ul><li>Verified: on 2026-10-20 a separate AI session that had not seen the original ran the prompts from scratch. Prompt 1 produced a working game on the first try.</li><li>Verified: in 13 of 13 runs the game passed the checks for starting, launching, paddle limits, losing a life, game over, restart and console errors.</li><li>Not stable: the check that an autoplayer wins within 120 seconds passed in 9 of 14 runs. The game was always winnable; a simple autoplayer is slow to hit the last brick. The log shows every failure.</li><li>Not yet done: running the fix and variation prompts end to end. AI tools change, so steps may need small adjustments.</li></ul>
    <h2>Price and refunds</h2>
    <p>$${g.price} test price. Refund terms are on the <a href="/refund/">refunds page</a> and apply before you buy. Payment is handled by a third-party checkout provider; see the <a href="/privacy/">privacy policy</a>.</p>
    <p>${buyBtn(g)}</p>`;
  write(`guides/${g.slug}/index.html`, docPage({ slug: `guides/${g.slug}`, title: g.title, desc: g.blurb, body, current: 'guides' }));
  const play = `    <link rel="stylesheet" href="/guides/assets/breakout.css">
    <h1>Breakout (built with AI)</h1>
    <p>Arrow keys or A/D, mouse or touch. Space or tap to start. <a href="/guides/${g.slug}/">Back to the guide</a>.</p>
    <div id="hud" class="gh"><span>Score <b id="score">0</b></span> · <span>Lives <b id="lives">3</b></span> · <span id="msg">Press Space or tap to start</span></div>
    <canvas id="c" width="480" height="560"></canvas>
    <script src="/guides/assets/breakout.js" defer></script>`;
  write(`guides/${g.slug}/play/index.html`, docPage({ slug: `guides/${g.slug}/play`, title: 'Play: Breakout built with AI', desc: 'Play the finished game from the Breakout AI build guide.', body: play, current: 'guides' }));
}
write('guides/assets/breakout.js', fs.readFileSync(path.join(ROOT, 'src/guides/breakout.js')));
write('guides/assets/breakout.css', fs.readFileSync(path.join(ROOT, 'src/guides/breakout.css')));
write('refund/index.html', docPage({ slug: 'refund', title: 'Refunds', desc: 'Refund terms for tested AI guide packs.', body: `    <h1>Refunds</h1>
    <p><strong>Draft for owner review before go-live.</strong></p>
    <p>Proposed: if a pack does not run as described, ask within 14 days of purchase and it is refunded. Statutory consumer rights where you live are not affected. Contact: x@secureinchat.com.</p>` }));
write('terms/index.html', docPage({ slug: 'terms', title: 'Terms for guide packs', desc: 'Licence terms for tested AI guide packs.', body: `    <h1>Terms for guide packs</h1>
    <p><strong>Draft for owner review before go-live.</strong></p>
    <p>You may use the code in a pack for personal and commercial projects. You may not resell or redistribute the pack itself. Packs are provided as is; AI tools change and steps may need adjusting. All content is original; we do not copy or resell anyone else's courses.</p>` }));


// blog
const postJsonLd = (p) => ({
  '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.desc,
  datePublished: p.date, dateModified: p.date, inLanguage: 'en',
  author: { '@type': 'Person', name: 'Paul', url: SITE + '/about/' },
  publisher: { '@type': 'Organization', name: 'SecureInChat', url: SITE + '/' },
  mainEntityOfPage: `${SITE}/blog/${p.slug}/`,
});
for (const p of POSTS) {
  write(`blog/${p.slug}/index.html`, docPage({
    slug: `blog/${p.slug}`, title: p.title, desc: p.desc, current: 'blog', article: postJsonLd(p),
    body: `    <p class="meta"><a href="/blog/">Blog</a></p>\n    <h1>${p.title}</h1>\n    <p class="meta">By Paul · ${p.date}</p>${p.body}`,
  }));
}
write('blog/index.html', docPage({
  slug: 'blog', title: 'Blog', current: 'blog',
  desc: 'Notes on how our privacy tools work and on the design of a blind-relay encrypted messenger.',
  body: `    <h1>Blog</h1>
    <p>Notes from building SecureInChat and its privacy tools. We publish few posts and revise them when they are wrong.</p>
${POSTS.map((p) => `    <h2><a href="/blog/${p.slug}/">${p.title}</a></h2>\n    <p class="meta">${p.date}</p>\n    <p>${p.desc}</p>`).join('\n')}
`,
}));

write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#23483E"/><g transform="translate(6 6) scale(.833)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></g></svg>
`);

// fonts + script
const fonts = [
  ['inter', 'inter', [400, 600, 700]],
  ['source-serif-4', 'source-serif-4', [600, 700]],
  ['jetbrains-mono', 'jetbrains-mono', [400]],
];
for (const [pkg, name, weights] of fonts) {
  for (const w of weights) {
    const src = path.join(import.meta.dirname, `node_modules/@fontsource/${pkg}/files/${name}-latin-${w}-normal.woff2`);
    write(`assets/fonts/${name}-${w}.woff2`, fs.readFileSync(src));
  }
}
write('assets/main.js', fs.readFileSync(path.join(ROOT, 'src/main.js')));
write('assets/site.css', fs.readFileSync(path.join(ROOT, 'src/site.css')));

// sitemap, robots, headers
const urls = [
  ['/', 1], ['/start/', 0], ...SITUATIONS.map((S) => [`/start/${S.slug}/`, 0]), ['/messaging/', 0], ['/mission/', 0], ['/protect/', 0], ...LAYERS.map((L) => [`/protect/${L.slug}/`, 0]), ['/guides/', 0], ['/guides/breakout-game-with-ai/', 0], ['/guides/breakout-game-with-ai/play/', 0], ['/refund/', 0], ['/terms/', 0], ['/zh/', 0], ['/ja/', 0], ['/tools/', 0], ['/tools/ip-leak-test/', 0], ['/tools/webrtc-leak-test/', 0], ['/tools/ipv6-leak-test/', 0], ['/tools/photo-metadata-remover/', 0], ['/tools/browser-fingerprint-test/', 0], ['/tools/password-checker/', 0], ['/tools/text-redactor/', 0], ['/tools/site-health-check/', 0], ['/blog/', 0], ...POSTS.map((p) => [`/blog/${p.slug}/`, 0]), ['/about/', 0], ['/privacy/', 0], ['/contact/', 0], ['/sponsor/', 0], ['/principles/', 0],
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(([u]) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <lastmod>${DATE}</lastmod>\n  </url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /tools/api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

const MAIN_CSP = "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' wss://ws.secureinchat.com https://cloudflareinsights.com; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'";
const TOOLS_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api4.ipify.org https://api6.ipify.org https://ipwho.is https://dnsapi.secureinchat.com https://*.lk.secureinchat.com https://api.pwnedpasswords.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const common = `  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`;
const mainPaths = ['/', '/zh/', '/ja/', '/messaging/', '/start/', ...SITUATIONS.map((S) => `/start/${S.slug}/`), '/mission/', '/protect/', ...LAYERS.map((L) => `/protect/${L.slug}/`), '/privacy/', '/about/', '/contact/', '/sponsor/', '/principles/', '/blog/', ...POSTS.map((p) => `/blog/${p.slug}/`)];
write('_headers', `# Main pages: self-hosted assets only; Cloudflare Web Analytics and the relay websocket are allowed.
${mainPaths.map((p) => `${p}\n  Content-Security-Policy: ${MAIN_CSP}\n${common}`).join('\n')}

# Guides and policies: self-hosted assets only, no analytics.
/guides/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'
${common}
/refund/
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'
${common}
/terms/
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'
${common}

# Tools: no analytics, only the lookups the tests need.
/tools/*
  Content-Security-Policy: ${TOOLS_CSP}
${common}

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/tools/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=0, must-revalidate
/tools/assets/*
  Cache-Control: public, max-age=0, must-revalidate
`);

console.log('built');
