// Generates the static site into ../public. Run: node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { POSTS } from './posts.mjs';
import { PRODUCTS, validateProduct, productBody, shopIndexBody } from './shop.mjs';
import { infoPage, articlePage, mapTags, shell as kitShell } from './subshell.mjs';
import { toolPage, scopeLegacyCss } from './toolshell.mjs';
import { SECURITY_TXT, SECURITY, TESTING, THREAT_MODEL } from './trust.mjs';
import { MISSION, MISSION_SHORT, LAYERS, layerBody, layerTags, protectIndexBody, SITUATIONS, situationBody, startIndexBody } from './protect.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'public');
const SITE = 'https://secureinchat.com';
const DATE = '2026-10-21';

const iconDir = path.join(import.meta.dirname, 'node_modules/lucide-static/icons');
const icon = (name, cls = 'icon') => {
  let s = fs.readFileSync(path.join(iconDir, name + '.svg'), 'utf8');
  s = s.replace(/<!--[\s\S]*?-->/, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/ class="[^"]*"/, '').replace(/ width="24"/, '').replace(/ height="24"/, '');
  return s.replace('<svg', `<svg class="${cls}" aria-hidden="true" focusable="false"`);
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------------------------
const HOME_TITLE = 'SecureInChat: See What You Give Away, Then Switch It Off';
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
  { name: 'Browser privacy report', href: '/tools/privacy-report/', copy: 'One run checks your IP, WebRTC, IPv6 and DNS leaks and what your browser gives away, then lists what to look at first.', k: ['lim', 'Contacts lookup services'] },
  { name: 'Link checker', href: '/tools/link-checker/', copy: 'Remove tracking from a link and see the warning signs of phishing before you click. The link is never opened or sent.', k: ['tested', 'Runs on your device'] },
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
function head({ title, desc, canonical, jsonld, lang = 'en', robots = '' }) {
  return `<meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />${robots ? `\n  <meta name="robots" content="${robots}" />` : ''}
  <meta name="theme-color" content="#F4F6F3" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${SITE}${canonical}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preload" href="/assets/fonts/atkinson-next-800.woff2" as="font" type="font/woff2" crossorigin />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SecureInChat" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${SITE}${canonical}" />
  <meta property="og:locale" content="${lang === 'en' ? 'en_US' : lang.replace('-', '_')}" />
  <meta name="twitter:card" content="summary" />
${['/', '/zh/', '/ja/'].includes(canonical) ? `  <link rel="alternate" hreflang="en" href="${SITE}/" />
  <link rel="alternate" hreflang="zh-CN" href="${SITE}/zh/" />
  <link rel="alternate" hreflang="ja" href="${SITE}/ja/" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/" />
` : ''}  <link rel="stylesheet" href="/assets/site.css" />
  <script src="/assets/main.js"></script>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ''}`;
}

const NAV = [['/protect/', 'Protect', 'protect'], ['/tools/', 'Tools', 'tools'], ['/blog/', 'Guides', 'blog'], ['/messaging/', 'Messaging', 'messaging'], ['/about/', 'About', 'about']];
function header(current) {
  return `<header class="top">
    <div class="wrap top__in">
      <a href="/" class="brand" aria-label="SecureInChat home"><span class="brand__mark">${icon('eye-off')}</span>SecureInChat</a>
      <nav class="nav" aria-label="Main">
        ${NAV.map(([h, t, k]) => `<a href="${h}"${current === k ? ' aria-current="page"' : ''}>${t}</a>`).join('\n        ')}
      </nav>
    </div>
  </header>`;
}
function footer() {
  return `<footer class="foot">
    <div class="wrap foot__in">
      <div>© 2026 SecureInChat. See what you give away, then switch it off.</div>
      <nav aria-label="Footer">
        <a href="/mission/">Mission</a><a href="/principles/">Principles</a><a href="/privacy/">Privacy</a><a href="/principles/#labels">Status labels</a><a href="/sponsor/">Sponsorship and affiliate disclosure</a><a href="/contact/">Contact</a><a href="/zh/" hreflang="zh-CN" lang="zh-CN">中文</a><a href="/ja/" hreflang="ja" lang="ja">日本語</a>
      </nav>
    </div>
  </footer>`;
}
function page({ lang = 'en', title, desc, canonical, jsonld, current, main, robots = '' }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  ${head({ title, desc, canonical, jsonld, lang, robots })}
</head>
<body>
  <a href="#top" class="skip">${{ 'zh-CN': '跳到正文', ja: '本文へ移動' }[lang] || 'Skip to content'}</a>
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
  const READ = [['Time zone', 'tz'], ['Languages', 'lang'], ['Screen', 'screen'], ['Device', 'platform'], ['Processor cores', 'cores'], ['Touch screen', 'touch'], ['Cookies', 'cookies'], ['Do Not Track', 'dnt']];
  const hero = `    <section class="wrap hero">
      <div>
        <h1>See what you give away. Then switch it off.</h1>
        <p class="hero__sub">Run a 12-check browser privacy report, see what this page can read, and get practical next steps. Results are worked out in your browser and never uploaded.</p>
        <div class="hero__cta"><a class="btn btn--p" href="/tools/privacy-report/">Run the privacy report</a><a class="btn btn--s" href="/tools/">Explore privacy tools</a></div>
        <ul class="hero__promise"><li>Free</li><li>No cookies or accounts</li><li>No user-level tracking</li><li>Untested steps are labelled</li></ul>
      </div>
      <aside class="readout" aria-labelledby="readout-h">
        <div class="readout__head"><h2 id="readout-h">What this page can read</h2><p>Worked out in this browser. Any website can read these without asking.</p></div>
        <dl id="readout">
          ${READ.map(([k, id]) => `<div class="readout__row"><dt>${k}</dt><dd id="ro-${id}">…</dd></div>`).join('\n          ')}
        </dl>
        <p class="readout__nojs">Turn on JavaScript to see the values. With it off, a site can read less, which is one of the protections we explain.</p>
        <p class="readout__foot">Read inside this tab only. Nothing here was sent to us or anyone else.</p>
      </aside>
    </section>`;
  const sit = `    <section class="wrap sec" id="start">
      <h2>What worries you most right now?</h2>
      <ul class="situations">
        ${SITUATIONS.map((S) => `<li><a href="/start/${S.slug}/"><strong>${esc(S.title)}</strong><span>${esc(S.short)}</span></a></li>`).join('\n        ')}
      </ul>
    </section>`;
  const layers = `    <section class="wrap sec" id="layers">
      <h2>Six layers, from the things around you to the apps you use.</h2>
      <p class="sec__lead">One weak layer undoes the others. Each layer page says what works today and what is still being built or tested.</p>
      <ul class="stack">
        ${LAYERS.map((L, i) => `<li><a class="depth-${i + 1}" href="/protect/${L.slug}/"><div><h3>${esc(L.name)}</h3><p>${esc(L.tagline)}</p></div><div class="tags">${layerTags(L)}</div></a></li>`).join('\n        ')}
      </ul>
    </section>`;
  const [lead, ...quick] = TOOLS_HOME;
  const tools = `    <section class="wrap sec" id="tools">
      <h2>Check something in the next two minutes.</h2>
      <div class="tooldir">
        <a class="tool-featured" href="${lead.href}">
          <h3>${lead.name}</h3>
          <p>${lead.copy}</p>
          <span class="btn btn--p">Run the report</span>
          <p class="tool-featured__note">${tagHtml(lead.k[0], lead.k[1])} The connection checks use the same lookup services as the IP leak test; results stay in your tab.</p>
        </a>
        <div class="tool-quick">
          <h3>Other quick checks</h3>
          <ul>
            ${quick.map((t) => `<li><a href="${t.href}"><strong>${t.name}</strong><span>${t.copy}</span></a></li>`).join('\n            ')}
          </ul>
          <p class="sec__more"><a href="/tools/">All eleven tools</a></p>
        </div>
      </div>
    </section>`;
  const featured = ['encrypted-messaging-when-networks-fail', 'bank-statement-before-ai-upload', 'what-data-brokers-know-about-you'].map((s) => POSTS.find((p) => p.slug === s));
  const ftag = { 'encrypted-messaging-when-networks-fail': tagHtml('doc', 'Documented') + tagHtml('untested', 'Field test pending'), 'bank-statement-before-ai-upload': tagHtml('tested', 'We ran the test'), 'what-data-brokers-know-about-you': tagHtml('doc', 'Guide') };
  const guides = `    <section class="wrap sec" id="guides">
      <h2>The risk first, then exactly what to do.</h2>
      <div class="grid grid--3">
        ${featured.map((p) => `<a class="card" href="/blog/${p.slug}/"><p class="card__kicker">Updated ${p.date}</p><h3>${esc(p.title)}</h3><div class="tags">${ftag[p.slug]}</div></a>`).join('\n        ')}
      </div>
      <p class="sec__more"><a href="/blog/">All guides</a></p>
    </section>`;
  const trust = `    <section class="wrap sec" id="data">
      <div class="trust">
        <div><h2>Don't just trust us. Check us.</h2><p>Every tool lists what stays on your device and what leaves it. Open your browser's network panel while you use one and compare. <a href="/principles/">Tool-by-tool details</a>.</p></div>
        <table><thead><tr><th scope="col">Tool</th><th scope="col">Stays on your device</th><th scope="col">Sent to others</th></tr></thead><tbody>
          ${FLOW.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('\n          ')}
        </tbody></table>
      </div>
    </section>`;
  const msg = `    <section class="wrap sec" id="messaging">
      <div class="band">
        <div><h2>SecureInChat messenger: the server forwards, it never reads.</h2><p>Keys stay on your devices and a blind relay only forwards ciphertext. The apps are in development; you can test the live relay from your browser today.</p></div>
        <a class="btn btn--s" href="/messaging/">See how it works</a>
      </div>
    </section>`;
  const mission = `    <section class="wrap sec">
      <h2>Privacy is a right, not a premium feature.</h2>
      <p class="sec__lead">${esc(MISSION_SHORT)} <a href="/mission/">Read our mission and what we will never do</a>.</p>
    </section>`;
  return page({ title: HOME_TITLE, desc: HOME_DESC, canonical: '/', jsonld, main: [hero, tools, sit, layers, guides, trust, msg, mission].join('\n\n') });
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
          <div><h2>Check the relay from your browser.</h2><p class="sec__lead">Your browser opens a real secure WebSocket to the relay, measures the handshake time and checks the relay's challenge. No message content is involved.</p></div>
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
      <h2>The server forwards. It never understands.</h2>
      <div class="grid grid--3">
        ${ARCH.map((a, i) => `<article class="card"><p class="card__kicker">Step ${i + 1} of 3</p><h3>${icon(a.icon)} ${a.title}</h3><p>${a.copy}</p><div class="tags">${tagHtml('doc', a.status)}</div></article>`).join('\n        ')}
      </div>
    </section>
    <section class="wrap sec" id="security">
      <h2>Established primitives, minimal trust surface.</h2>
      <div class="grid grid--4">
        ${SEC.map((s) => `<article class="card"><p class="card__kicker">${s.tag}</p><h3>${s.title}</h3><p>${s.copy}</p></article>`).join('\n        ')}
      </div>
      <p class="sec__lead">These describe the design. They are not a legal certification or an independent audit. What the relay can and cannot see is set out in the <a href="/messaging/threat-model/">messenger threat model</a> and in <a href="/blog/what-a-blind-relay-can-and-cannot-know/">what a blind relay can and cannot know</a>.</p>
    </section>`;
  return page({ title: 'SecureInChat messenger: zero-knowledge blind relay | SecureInChat', desc: 'How the SecureInChat messenger works: end-to-end encryption, a blind relay that cannot read messages, current status and a live relay test you can run in your browser.', canonical: '/messaging/', current: 'messaging', main: body });
}

// Localized home pages (zh, ja). Guides and tool screens are English; every link to them says so.
const LOCAL = {
  zh: {
    lang: 'zh-CN', title: 'SecureInChat：看清你暴露了什么，然后关掉它',
    desc: '面向手机、电脑、账号和 AI 使用的实用隐私防护：在你自己设备上运行的免费工具，注明哪些步骤实测过的指南，以及正在开发中的零知识加密聊天软件。',
    notice: '这是中文概览页。下面链接的指南和工具界面目前只有英文版，链接旁标有“英文”。',
    h1: '看清你暴露了什么，然后关掉它。',
    sub: '你的手机、浏览器、账号和 AI 工具泄露的信息比你想象的多。我们告诉你具体是哪些，并带你一层一层把它关掉。',
    cta1: '从哪里开始', cta2: '免费检查一下',
    promise: ['不用 Cookie', '不用注册账号', '检查在你的设备上运行', '没实测的步骤会标出来'],
    roH: '本页能读到你的哪些信息', roP: '任何网站都能在不询问你的情况下读到这些。',
    ro: ['时区', '语言', '屏幕', '设备', '处理器核心数', '触摸屏', 'Cookie', '请勿追踪（DNT）'],
    roNojs: '开启 JavaScript 才能看到这些值。关掉它时网站能读到的更少，这也是我们讲解的防护方法之一。',
    roFoot: '只在这个标签页内读取，没有发送给我们或任何人。',
    en: '英文', sitH: '你现在最担心什么？',
    sit: { 'being-tracked': ['可能有人在追踪我', '手机、位置和账号'], 'account-hacked': ['我的账号可能被盗了', '密码、恢复方式、密钥'], 'less-tracking': ['我想日常少被追踪', '系统设置、浏览器、数据经纪商'], 'network-down': ['紧急情况下移动网络中断', '灾害或停电时如何保持联系'] },
    layH: '六层防护：从你身边的环境，到你使用的 App。', layP: '一层薄弱，其他几层也会失效。每一层的页面都写明哪些现在可用、哪些还在开发或测试。',
    lay: { physical: ['物理环境', '身边的人和设备能看到、收到什么。'], devices: ['设备与网络', '你的手机、电脑和浏览器暴露了什么。'], accounts: ['账号与邮箱', '谁能进入你的账号，你的收件箱透露了什么。'], communication: ['通信', '只有对话双方才能读到的消息。'], offline: ['离线与紧急情况', '移动网络中断时如何安全地保持联系。'], ai: ['AI 隐私', '你交给 AI 助手的信息，以及如何少交一些。'] },
    tag: { planned: '计划中', tools: (n) => `${n} 个工具`, guides: (n) => `${n} 篇指南`, documented: '已整理资料', field: '待实地测试', dev: '聊天软件开发中', local: '在你的设备上运行', net: '会联系查询服务' },
    toolH: '两分钟内就能检查一项。',
    tools: [
      ['/tools/privacy-report/', '浏览器隐私报告', '一次检查浏览器向网站暴露的信息，并列出最该先处理的几项。', 'net'],
      ['/tools/account-checkup/', '账号安全自查', '八项本地勾选清单：两步验证、密码复用、恢复方式、登录设备，附 Google、Apple、Microsoft 官方步骤。', 'local'],
      ['/tools/link-checker/', '链接检查器', '去掉链接里的追踪参数，并在点开前看出钓鱼链接的迹象。链接不会被打开或发送。', 'local'],
      ['/tools/photo-metadata-remover/', '照片元数据清除', '查看并删除照片里隐藏的位置、设备和日期。', 'local'],
      ['/tools/text-redactor/', '文本脱敏', '在分享文本或粘贴给 AI 之前，把邮箱、号码和密钥换成占位符。', 'local'],
    ],
    toolMore: '全部工具',
    flowH: '别只相信我们，自己检查。', flowP: '每个工具都列出哪些数据留在你的设备上、哪些会发出去。使用时打开浏览器的网络面板对照一下。', flowLink: '各工具详情',
    flowTh: ['工具', '留在你的设备上', '发送给他人'],
    flow: [['照片元数据清除', '照片及其元数据', '无'], ['文本脱敏', '你粘贴的文本', '无'], ['密码泄露检查', '密码及其完整哈希值', 'SHA-1 哈希值的前 5 个字符，发给 Pwned Passwords']],
    msgH: 'SecureInChat 聊天软件：服务器只转发，从不读取。', msgP: '密钥只保存在你的设备上，盲中继只转发密文。客户端仍在开发中；现在可以在浏览器里测试在线中继。', msgBtn: '了解工作原理',
    misH: '隐私是一项权利，不是付费功能。', misP: '一层一层保护你的隐私：从你手中的设备到你发出的消息，工具在你自己的设备上运行，指南里的每一步都真正测试过，没测过的会标明。', misLink: '阅读我们的使命，以及我们绝不会做的事',
  },
  ja: {
    lang: 'ja', title: 'SecureInChat：何が漏れているかを知り、それを止める',
    desc: 'スマートフォン、パソコン、アカウント、AI 利用のための実用的なプライバシー保護：自分の端末で動く無料ツール、どの手順を実際に試したかを明記したガイド、開発中のゼロ知識メッセンジャー。',
    notice: 'これは日本語の概要ページです。リンク先のガイドとツール画面は現在英語のみで、リンクの横に「英語」と表示しています。',
    h1: '何が漏れているかを知り、それを止める。',
    sub: 'スマートフォン、ブラウザ、アカウント、AI ツールは、思っている以上に情報を漏らしています。何が漏れているかを具体的に示し、一層ずつ止める手順を案内します。',
    cta1: 'どこから始めるか', cta2: '無料でチェック',
    promise: ['Cookie なし', 'アカウント不要', 'チェックは端末内で実行', '未検証の手順は明記'],
    roH: 'このページが読み取れるあなたの情報', roP: 'どのウェブサイトも、許可なくこれらを読み取れます。',
    ro: ['タイムゾーン', '言語', '画面', 'デバイス', 'CPU コア数', 'タッチスクリーン', 'Cookie', 'トラッキング拒否（DNT）'],
    roNojs: '値を表示するには JavaScript を有効にしてください。無効にするとサイトが読み取れる情報は減ります。これも私たちが解説する保護方法の一つです。',
    roFoot: 'このタブの中だけで読み取り、私たちにも誰にも送信していません。',
    en: '英語', sitH: '今いちばん心配なことは？',
    sit: { 'being-tracked': ['誰かに追跡されているかもしれない', 'スマートフォン、位置情報、アカウント'], 'account-hacked': ['アカウントが乗っ取られたかもしれない', 'パスワード、復旧方法、キー'], 'less-tracking': ['日常の追跡を減らしたい', '設定、ブラウザ、データブローカー'], 'network-down': ['緊急時にモバイル回線が止まる', '災害や停電のときの連絡手段'] },
    layH: '6 層の保護：身の回りから、使っているアプリまで。', layP: '一つの層が弱いと、ほかの層も効かなくなります。各層のページには、今使えるものと、開発中・検証中のものを書いています。',
    lay: { physical: ['物理環境', '周りの人や機器に見られるもの、拾われるもの。'], devices: ['デバイスとネットワーク', 'スマートフォン、パソコン、ブラウザが漏らしているもの。'], accounts: ['アカウントとメール', '誰があなたのアカウントに入れるか、受信箱から何が分かるか。'], communication: ['通信', '会話の参加者だけが読めるメッセージ。'], offline: ['オフラインと緊急時', 'モバイル回線が止まったときに安全に連絡を取り合う方法。'], ai: ['AI プライバシー', 'AI アシスタントに渡している情報と、それを減らす方法。'] },
    tag: { planned: '計画中', tools: (n) => `ツール ${n} 件`, guides: (n) => `ガイド ${n} 件`, documented: '資料整理済み', field: '実地テスト待ち', dev: 'メッセンジャー開発中', local: '端末内で実行', net: '照会サービスに接続' },
    toolH: '2 分でできるチェック。',
    tools: [
      ['/tools/privacy-report/', 'ブラウザ・プライバシーレポート', 'ブラウザがサイトに渡している情報を一度に調べ、先に見直すべき項目を並べます。', 'net'],
      ['/tools/account-checkup/', 'アカウント安全チェック', '端末内で使う 8 項目のチェックリスト：2 段階認証、パスワード使い回し、復旧方法、ログイン中の端末。Google、Apple、Microsoft の公式手順付き。', 'local'],
      ['/tools/link-checker/', 'リンクチェッカー', 'リンクから追跡パラメータを取り除き、開く前にフィッシングの兆候を確認します。リンクは開かれず、送信もされません。', 'local'],
      ['/tools/photo-metadata-remover/', '写真メタデータ削除', '写真に隠れた位置情報、機種、日付を確認して削除します。', 'local'],
      ['/tools/text-redactor/', 'テキスト墨消し', '文章を共有したり AI に貼り付けたりする前に、メールアドレス、番号、キーを仮の文字に置き換えます。', 'local'],
    ],
    toolMore: 'すべてのツール',
    flowH: '私たちを信じるだけでなく、確かめてください。', flowP: '各ツールは、端末に残るデータと外に出るデータを明記しています。使いながらブラウザのネットワークパネルを開いて比べてみてください。', flowLink: 'ツールごとの詳細',
    flowTh: ['ツール', '端末に残るもの', '外部に送られるもの'],
    flow: [['写真メタデータ削除', '写真とそのメタデータ', 'なし'], ['テキスト墨消し', '貼り付けた文章', 'なし'], ['パスワード漏えいチェック', 'パスワードとその完全なハッシュ', 'SHA-1 ハッシュの先頭 5 文字を Pwned Passwords へ']],
    msgH: 'SecureInChat メッセンジャー：サーバーは転送するだけで、読みません。', msgP: '鍵はあなたの端末にだけ保存され、ブラインドリレーは暗号文を転送するだけです。アプリは開発中ですが、稼働中のリレーをブラウザから今すぐテストできます。', msgBtn: '仕組みを見る',
    misH: 'プライバシーは権利であり、有料機能ではありません。', misP: '手元の端末から送るメッセージまで、一層ずつプライバシーを守ります。ツールは自分の端末で動き、ガイドの手順は実際に試したもので、試していないものはそう書いています。', misLink: '私たちの使命と、決してしないこと',
  },
};
function localTags(L, t) {
  if (!L.live.length) return tagHtml('untested', t.planned);
  const tools = L.live.filter((x) => ['local', 'net'].includes(x[2])).length;
  const guides = L.live.filter((x) => ['guide', 'tested'].includes(x[2])).length;
  const out = [];
  if (tools) out.push(tagHtml('tested', t.tools(tools)));
  if (guides) out.push(tagHtml('doc', t.guides(guides)));
  if (L.live.some((x) => x[2] === 'documented')) out.push(tagHtml('doc', t.documented), tagHtml('untested', t.field));
  if (L.live.some((x) => x[2] === 'dev')) out.push(tagHtml('lim', t.dev));
  return out.join('');
}
function localPage(code) {
  const t = LOCAL[code];
  const enMark = `<span class="tag tag--doc">${t.en}</span>`;
  const enA = (href, inner, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${href}" hreflang="en">${inner}</a>`;
  const READ = ['tz', 'lang', 'screen', 'platform', 'cores', 'touch', 'cookies', 'dnt'];
  const jsonld = { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${SITE}/${code}/`, url: `${SITE}/${code}/`, name: t.title, inLanguage: t.lang, isPartOf: { '@id': SITE + '/#site' } };
  const main = [`    <section class="wrap hero">
      <div>
        <p class="notice">${esc(t.notice)}</p>
        <h1>${esc(t.h1)}</h1>
        <p class="hero__sub">${esc(t.sub)}</p>
        <div class="hero__cta">${enA('/start/', `${esc(t.cta1)}（${t.en}）`, 'btn btn--p')}${enA('/tools/', `${esc(t.cta2)}（${t.en}）`, 'btn btn--s')}</div>
        <ul class="hero__promise">${t.promise.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
      <aside class="readout" aria-labelledby="readout-h">
        <div class="readout__head"><h2 id="readout-h">${esc(t.roH)}</h2><p>${esc(t.roP)}</p></div>
        <dl id="readout">
          ${READ.map((id, i) => `<div class="readout__row"><dt>${esc(t.ro[i])}</dt><dd id="ro-${id}">…</dd></div>`).join('\n          ')}
        </dl>
        <p class="readout__nojs">${esc(t.roNojs)}</p>
        <p class="readout__foot">${esc(t.roFoot)}</p>
      </aside>
    </section>`,
  `    <section class="wrap sec" id="start">
      <h2>${esc(t.sitH)}</h2>
      <ul class="situations">
        ${SITUATIONS.map((S) => `<li>${enA(`/start/${S.slug}/`, `<strong>${esc(t.sit[S.slug][0])}</strong><span>${esc(t.sit[S.slug][1])}（${t.en}）</span>`)}</li>`).join('\n        ')}
      </ul>
    </section>`,
  `    <section class="wrap sec" id="layers">
      <h2>${esc(t.layH)}</h2>
      <p class="sec__lead">${esc(t.layP)}</p>
      <ul class="stack">
        ${LAYERS.map((L, i) => `<li><a class="depth-${i + 1}" href="/protect/${L.slug}/" hreflang="en"><div><h3>${esc(t.lay[L.slug][0])}</h3><p>${esc(t.lay[L.slug][1])}</p></div><div class="tags">${localTags(L, t.tag)}${enMark}</div></a></li>`).join('\n        ')}
      </ul>
    </section>`,
  `    <section class="wrap sec" id="tools">
      <h2>${esc(t.toolH)}</h2>
      <ul class="rows">
        ${t.tools.map(([href, n, c, k]) => `<li>${enA(href, `<strong>${esc(n)}</strong><span>${esc(c)}</span>${tagHtml(k === 'local' ? 'tested' : 'lim', t.tag[k])}`)}</li>`).join('\n        ')}
      </ul>
      <p class="sec__more">${enA('/tools/', `${esc(t.toolMore)}（${t.en}）`)}</p>
    </section>`,
  `    <section class="wrap sec" id="data">
      <div class="trust">
        <div><h2>${esc(t.flowH)}</h2><p>${esc(t.flowP)} ${enA('/principles/', `${esc(t.flowLink)}（${t.en}）`)}</p></div>
        <table><thead><tr>${t.flowTh.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>
          ${t.flow.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('\n          ')}
        </tbody></table>
      </div>
    </section>`,
  `    <section class="wrap sec" id="messaging">
      <div class="band">
        <div><h2>${esc(t.msgH)}</h2><p>${esc(t.msgP)}</p></div>
        ${enA('/messaging/', `${esc(t.msgBtn)}（${t.en}）`, 'btn btn--s')}
      </div>
    </section>`,
  `    <section class="wrap sec">
      <h2>${esc(t.misH)}</h2>
      <p class="sec__lead">${esc(t.misP)} ${enA('/mission/', `${esc(t.misLink)}（${t.en}）`)}</p>
    </section>`].join('\n\n');
  return page({ lang: t.lang, title: t.title, desc: t.desc, canonical: `/${code}/`, jsonld, main });
}

// Subpages use ChatGPT's Subpages Design Kit v2 (src/subpages/, build/subshell.mjs) since 2026-10-22.
const FIG = {
  layers: { src: 'privacy-layers.svg', h: 360, alt: 'Six connected layers of personal privacy, from physical surroundings to information shared with AI' },
  flows: { src: 'data-flows.svg', h: 400, alt: 'Separate data flows for encrypted messaging and privacy tools that use outside lookups' },
  relay: { src: 'relay-architecture.svg', h: 340, alt: 'Sender encrypts locally, an intermediate relay forwards encrypted payloads, and recipient decrypts locally' },
  account: { src: 'account-recovery.svg', h: 360, alt: 'Account sign-in, trusted-device and recovery routes linked to an account' },
  broker: { src: 'data-broker.svg', h: 360, alt: 'Separate pieces of information being linked into a data broker profile' },
  url: { src: 'url-anatomy.svg', h: 340, alt: 'A URL separated into its host, path and potentially tracking-related query parameters' },
  sim: { src: 'sim-swap.svg', h: 360, alt: 'A phone number moved to another SIM card without the owner' },
  photo: { src: 'photo-metadata.svg', h: 360, alt: 'A photo with hidden metadata fields such as location and device' },
  redact: { src: 'text-redaction.svg', h: 360, alt: 'Text with sensitive details covered before it is shared' },
};
const LAYER_ALT = { physical: 'What nearby people and devices can see or pick up', devices: 'A phone, a computer and a browser and what each gives away', accounts: 'Accounts, email and the ways back into them', communication: 'Messages that only the people in a conversation can read', offline: 'Staying in touch when mobile networks fail', ai: 'What you hand to an AI assistant' };
const CONTEXT_ALT = { 'being-tracked': 'Signs that someone may be tracking a phone, location or accounts', 'account-hacked': 'An account that may have been taken over and the way back in', 'less-tracking': 'Fewer trackers in everyday browsing and apps', 'network-down': 'Messaging when the mobile network is down' };
function figFor(slug) {
  const lm = /^protect\/([a-z]+)$/.exec(slug); if (lm && LAYER_ALT[lm[1]]) return { src: `layer-${lm[1]}.svg`, h: 360, alt: LAYER_ALT[lm[1]] };
  const cm = /^start\/([a-z-]+)$/.exec(slug); if (cm && CONTEXT_ALT[cm[1]]) return { src: `context-${cm[1]}.svg`, h: 360, alt: CONTEXT_ALT[cm[1]] };
  const r = [[/sim-swap|phone/, 'sim'], [/broker/, 'broker'], [/photo/, 'photo'], [/redact|paste|cv-|bank-statement|ai-apps|protect\/ai/, 'redact'],
    [/relay|messaging|network-down|offline|communication/, 'relay'], [/account|password|email|alias|accounts/, 'account'],
    [/ip-leak|webrtc|ipv6|dns|vpn|leak-test|principles|privacy$|devices|app-permissions|reset-checklist|being-tracked|less-tracking/, 'flows'], [/link/, 'url']];
  for (const [re, k] of r) if (re.test(slug)) return FIG[k];
  return FIG.layers;
}
const KIT_CURRENT = { tools: '/tools/', blog: '/blog/', about: '/mission/', messaging: '/messaging/' };
function headExtra({ canonical, jsonld, robots = '', title, desc }) {
  return `${robots ? `  <meta name="robots" content="${robots}" />\n` : ''}  <link href="${SITE}${canonical}" rel="canonical"/>
  <meta content="website" property="og:type"/>
  <meta content="SecureInChat" property="og:site_name"/>
  <meta content="${esc(title)}" property="og:title"/>
  <meta content="${esc(desc)}" property="og:description"/>
  <meta content="${SITE}${canonical}" property="og:url"/>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ''}`;
}
function crumbsFor(slug, title) {
  const parts = slug.split('/');
  const names = { messaging: 'Messaging', blog: 'Guides', protect: 'Protect', start: 'Start here', tools: 'Tools', shop: 'Shop' };
  const out = [['/', 'Home']];
  if (parts.length > 1) out.push([`/${parts[0]}/`, names[parts[0]] || parts[0]]);
  out.push([`/${slug}/`, title]);
  return out;
}
const KIT_T = (f) => fs.readFileSync(path.join(ROOT, 'src/subpages/templates', f), 'utf8');
const kitMain = (f) => { const t = KIT_T(f); return t.slice(t.indexOf('<main class="subpage-main" id="main">') + 37, t.lastIndexOf('</main>')); };
function catalogPage({ slug, title, lead, desc, figure, items }) {
  const full = `${title} | SecureInChat`;
  const body = `<h1>${title}</h1>\n<p class="lead">${lead}</p>`;
  const page = infoPage({ title: full, desc, canonical: `/${slug}/`, headExtra: headExtra({ canonical: `/${slug}/`, title: full, desc }), crumbs: crumbsFor(slug, title), body: body + '\n<!--CATALOG-->', figure });
  const cat = `<div class="tool-catalogue">\n${items.map((it) => `<article class="tool-catalogue-item"><div class="tool-catalogue-head"><div class="tool-catalogue-title"><h2>${it.title}</h2>${it.labels ? `<p class="state-list">${mapTags(it.labels)}</p>` : ''}</div></div><p>${it.text}</p><a class="tool-catalogue-action" href="${it.href}">${it.action} <span aria-hidden="true">→</span></a></article>`).join('\n')}\n</div>`;
  return page.replace('<article class="info-content">\n<!--CATALOG-->\n     </article>', cat);
}
function docPage({ slug, title, desc, body, current = null, article = null, robots = '' }) {
  const full = `${title} | SecureInChat`;
  return infoPage({ title: full, desc, canonical: `/${slug}/`, current: KIT_CURRENT[current], headExtra: headExtra({ canonical: `/${slug}/`, jsonld: article, robots, title: full, desc }),
    crumbs: crumbsFor(slug, title), body, figure: figFor(slug) });
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
    <p>The site does not show advertising. Some pages carry commission links to Nord Security products (NordVPN, NordPass, NordLocker, Coveron), each marked as an affiliate link. The pages themselves load nothing from Nord Security. If you click one, your browser goes through Nord Security's tracking domain, which records the click and may set cookies under its own privacy policy. Each link has a plain alternative without a commission.</p>

    <h2>Your choices and contact</h2>
    <p>Because we do not keep personal data about visitors, there is little to access or delete. For privacy questions, email <a href="mailto:x@secureinchat.com">x@secureinchat.com</a>.</p>
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
    </ul>

    <h2>Who runs this</h2>
    <p>The site is built and maintained by Paul, an independent developer working on SecureInChat. Content may be drafted with AI assistance and is reviewed before it is published.</p>

    <p>Questions or corrections: see the <a href="/contact/">contact page</a>.</p>
`;

const CONTACT = `    <h1>Contact</h1>
    <p class="meta">Last updated: ${DATE}</p>
    <p>Email us at <a href="mailto:x@secureinchat.com">x@secureinchat.com</a> for bug reports, factual corrections, tool feedback and privacy questions.</p>
    <h2>Sponsorship and partnerships</h2>
    <p>Privacy-respecting products can sponsor the free tools. Any sponsored placement is labelled as such and never changes a test result. See <a href="/sponsor/">how SecureInChat is funded</a> and our <a href="/mission/">mission</a>.</p>
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
        <tr><td><a href="/tools/account-checkup/">Account security checkup</a></td><td>Your answers, until you reload or close the page</td><td>Nothing</td></tr>
        <tr><td><a href="/tools/privacy-report/">Browser privacy report</a></td><td>The whole report, until you close the tab</td><td>The same requests as the IP leak test; the browser checks send nothing</td></tr>
        <tr><td><a href="/tools/ip-leak-test/">IP leak test</a></td><td>Verdicts and comparisons</td><td>Your IP to ipify and ipwho.is; random DNS names to our lookup server; resolver addresses read from our API</td></tr>
        <tr><td><a href="/tools/webrtc-leak-test/">WebRTC leak test</a></td><td>Everything</td><td>A STUN request to a public server, which sees your public address</td></tr>
        <tr><td><a href="/tools/ipv6-leak-test/">IPv6 leak test</a></td><td>Verdicts</td><td>Your IPv6 address to ipify</td></tr>
        <tr><td><a href="/tools/photo-metadata-remover/">Photo metadata remover</a></td><td>The photo and its metadata</td><td>Nothing</td></tr>
        <tr><td><a href="/tools/file-metadata-remover/">File metadata remover</a></td><td>The file and its metadata</td><td>Nothing</td></tr>
        <tr><td><a href="/tools/browser-fingerprint-test/">Fingerprint test</a></td><td>All signals</td><td>Nothing</td></tr>
        <tr><td><a href="/tools/password-checker/">Password checker</a></td><td>The password and its full hash</td><td>The first five characters of its SHA-1 hash to Pwned Passwords</td></tr>
        <tr><td><a href="/tools/text-redactor/">Text redactor</a></td><td>The text you paste</td><td>Nothing</td></tr>
        <tr><td><a href="/tools/link-checker/">Link checker</a></td><td>The link you paste; it is never opened</td><td>Nothing</td></tr>
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
    <p>The tools are plain scripts without a build step on the page. Open your browser's network panel while using one and compare the requests with the table.</p>
    <p>What our automated tests check is listed on <a href="/testing/">how we test</a>. Found a problem? <a href="/security/">Report it</a>.</p>
`;

const SPONSOR = `    <h1>How SecureInChat is funded</h1>
    <p class="meta">Last updated: ${DATE}</p>
    <p>SecureInChat is free to use and does not track you. If money ever changes hands, this page says how. See our <a href="/mission/">mission</a>.</p>
    <h2>What sponsors can and cannot do</h2>
    <p>Sponsors may support the project or a clearly labelled piece of content. Sponsors:</p>
    <ul>
      <li>cannot buy a ranking, a "best" or "safest" label, or a test result;</li>
      <li>do not review, edit or approve content before it is published;</li>
      <li>cannot ask us to add any script, pixel, cookie or tracking link;</li>
      <li>receive no visitor data. At most, they get our aggregate page-view counts.</li>
    </ul>
    <h2>Who we do not accept</h2>
    <p>We do not accept money from ad networks, data brokers, surveillance vendors, or companies whose main business is behavioural tracking. We can end a sponsorship at any time if it conflicts with these rules. Past sponsorships stay listed on this page.</p>
    <h2>Commission links</h2>
    <p>Some tool pages (English, Chinese and Japanese) carry commission links to Nord Security products (NordVPN, NordPass, NordLocker, Coveron). Each one is marked "affiliate link" and sits next to a plain link to the same site. A commission never changes a test result.</p>
    <h2>Current sponsors</h2>
    <p>None.</p>
    <h2>Get in touch</h2>
    <p>Email <a href="mailto:x@secureinchat.com">x@secureinchat.com</a> with the product and what you would like to support.</p>
`;

// ---------------------------------------------------------------------------------------------
function write(rel, content) {
  const f = path.join(PUB, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

write('index.html', home());
for (const c of Object.keys(LOCAL)) write(`${c}/index.html`, localPage(c));

// Home pages: designed and coded by ChatGPT (design owner since 2026-10-22), integrated unchanged except for
// head metadata (canonical, hreflang, Open Graph) and self-hosted asset paths. Source: src/home/.
function gptHome(file, canonical, lang, title, desc, jsonld) {
  return gptPage('src/home/' + file, canonical, lang, title, desc, jsonld, { en: '/', 'zh-CN': '/zh/', ja: '/ja/' });
}
// GPT's images are delivered as large PNGs; the build serves WebP copies (same pixels, smaller files).
const GPT_IMAGES = ['secureinchat-hero', 'secureinchat-guide-lake', 'secureinchat-messaging'];
function gptPage(rel, canonical, lang, title, desc, jsonld, alternates) {
  let h = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const alt = alternates ? Object.entries(alternates).map(([l, u]) => `  <link rel="alternate" hreflang="${l}" href="${SITE}${u}">\n`).join('') + `  <link rel="alternate" hreflang="x-default" href="${SITE}${alternates.en}">\n` : '';
  const meta = `  <link rel="canonical" href="${SITE}${canonical}">
${alt}  <meta property="og:type" content="website">
  <meta property="og:site_name" content="SecureInChat">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${SITE}${canonical}">
  <meta property="og:locale" content="${lang}">
  <meta name="twitter:card" content="summary">
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ''}  <link rel="stylesheet" href="/assets/css/min-type-size.css">\n`;
  const swaps = [
    ['<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">', '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'],
    ['href="/assets/fonts/noto-serif-variable.ttf"', 'href="/assets/fonts/noto-serif-latin-var.woff2"'],
    ['type="font/ttf"', 'type="font/woff2"'],
  ];
  for (const n of GPT_IMAGES) swaps.push([`/assets/img/${n}.png`, `/assets/img/${n}.webp`]);
  for (const [a, b] of swaps) h = h.split(a).join(b);
  if (!h.includes('</head>')) throw new Error('page template without </head>: ' + rel);
  return h.replace('</head>', meta + '</head>');
}
const HOME_JSONLD = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'Organization', '@id': SITE + '/#org', name: 'SecureInChat', url: SITE + '/' },
  { '@type': 'WebSite', '@id': SITE + '/#site', url: SITE + '/', name: 'SecureInChat', publisher: { '@id': SITE + '/#org' }, inLanguage: 'en' },
] };
write('index.html', gptHome('en.html', '/', 'en_US', 'SecureInChat — Practical Privacy Tools', 'Practical privacy tools and guides. Check your browser privacy, protect sensitive information, and learn what your devices and online services can access.', HOME_JSONLD));
write('zh/index.html', gptHome('zh.html', '/zh/', 'zh_CN', 'SecureInChat — 实用隐私保护工具', 'SecureInChat：实用的隐私工具与指南。', null));
write('assets/css/home.css', fs.readFileSync(path.join(ROOT, 'src/home/home.css'), 'utf8')
  .replace('src: url("/assets/fonts/noto-serif-variable.ttf") format("truetype");', 'src: url("/assets/fonts/noto-serif-latin-var.woff2") format("woff2");'));
if (fs.existsSync(path.join(ROOT, 'src/home/home.js'))) write('assets/js/home.js', fs.readFileSync(path.join(ROOT, 'src/home/home.js')));
for (const n of GPT_IMAGES) write(`assets/img/${n}.webp`, fs.readFileSync(path.join(ROOT, 'src/img', n + '.webp')));
// Privacy checkup (designed and coded by ChatGPT, 2026-10-22; official sources filled and checked by Claude).
const CHECKUP_ALT = { en: '/checkup/', 'zh-CN': '/zh/checkup/' };
const PHONE_ALT = { en: '/tools/phone-checkup/', 'zh-CN': '/zh/tools/phone-checkup/' };
write('checkup/index.html', gptPage('src/checkup/checkup-en.html', '/checkup/', 'en_US', 'SecureInChat — Privacy Checkup', 'Choose a practical privacy check for your IP, a URL, phone-number settings or account security.', null, CHECKUP_ALT));
write('zh/checkup/index.html', gptPage('src/checkup/checkup-zh.html', '/zh/checkup/', 'zh_CN', 'SecureInChat — 隐私体检', '选择适合你的隐私检查：网址、手机号设置或账号安全。', null, CHECKUP_ALT));
write('tools/phone-checkup/index.html', gptPage('src/checkup/phone-en.html', '/tools/phone-checkup/', 'en_US', 'Phone Number Privacy Checkup', 'A six-item checklist to protect your phone number from SIM swaps and exposure. You never enter your number; nothing is saved or sent.', null, PHONE_ALT));
write('zh/tools/phone-checkup/index.html', gptPage('src/checkup/phone-zh.html', '/zh/tools/phone-checkup/', 'zh_CN', '手机号隐私自查', '六项自查，保护手机号免受换卡诈骗和泄露。无需输入号码，不保存、不发送。', null, PHONE_ALT));
write('assets/css/subpages.css', fs.readFileSync(path.join(ROOT, 'src/subpages/subpages.css')));
for (const f of fs.readdirSync(path.join(ROOT, 'src/subpages/illustrations'))) write(`assets/illustrations/${f}`, fs.readFileSync(path.join(ROOT, 'src/subpages/illustrations', f)));
write('assets/css/checkup.css', fs.readFileSync(path.join(ROOT, 'src/checkup/checkup.css')));
write('assets/js/phone-checkup.js', fs.readFileSync(path.join(ROOT, 'src/checkup/phone-checkup.js')));
for (const f of ['noto-serif-latin-var.woff2', 'OFL-noto-serif.txt']) write('assets/fonts/' + f, fs.readFileSync(path.join(ROOT, 'src/fonts', f)));
// GPT's v2 stylesheet names the same subset file noto-serif-subset.woff2.
write('assets/fonts/noto-serif-subset.woff2', fs.readFileSync(path.join(ROOT, 'src/fonts/noto-serif-latin-var.woff2')));
// Messaging: ChatGPT's messaging template (kit v2) with the live relay diagnostic (next batch, relay-diagnostic.html) in its slot.
{
  let m = kitMain('messaging.en.html').replace('aria-label="面包屑导航"', 'aria-label="Breadcrumb"');
  const a = m.indexOf('<!-- INTEGRATION SLOT'); const b = m.indexOf('</div>', m.indexOf('</div>', m.indexOf('tool-integration-note', a)) + 6) + 6;
  const diag = fs.readFileSync(path.join(ROOT, 'src/nextbatch/relay-diagnostic.html'), 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '');
  m = m.slice(0, a) + `<div id="diagnostics">\n${diag}</div>` + m.slice(b);
  // Owner-requested fix (2026-10-24): the panel carries its own heading and frame, so drop the duplicate section heading and the outer workspace frame.
  m = m.replace(/<div class="page-rule-heading">\s*<div>\s*<h2>\s*Check the production relay\s*<\/h2>[\s\S]*?<\/div>\s*<\/div>\s*/, '').replace('<div class="tool-workspace">\n       <div id="diagnostics">', '<div>\n       <div id="diagnostics">');
  m = m.replace(/(<a class="text-link" href=")\/blog\/(">\s*Read the blind-relay guide)/, '$1/blog/what-a-blind-relay-can-and-cannot-know/$2')
    .replace(/(Read the blind-relay guide →\s*<\/a>)/, '$1\n        <a class="text-link" href="/messaging/threat-model/">Read the threat model →</a>');
  const title = 'SecureInChat messenger: zero-knowledge blind relay | SecureInChat';
  const desc = 'How the SecureInChat messenger works: end-to-end encryption, a blind relay that cannot read messages, current status and a live relay test you can run in your browser.';
  const extra = headExtra({ canonical: '/messaging/', title, desc }) + '  <link href="/assets/css/relay-diagnostic.css" rel="stylesheet"/>\n  <script src="/assets/main.js"></script>\n';
  write('messaging/index.html', kitShell({ title, desc, canonical: '/messaging/', current: '/messaging/', headExtra: extra, main: m }));
}
write('assets/css/relay-diagnostic.css', fs.readFileSync(path.join(ROOT, 'src/nextbatch/relay-diagnostic.css')));
write('assets/css/tool-widgets.css', fs.readFileSync(path.join(ROOT, 'src/nextbatch/tool-widgets.css')));
write('assets/css/min-type-size.css', fs.readFileSync(path.join(ROOT, 'src/nextbatch/min-type-size.css')));
write('start/index.html', catalogPage({ slug: 'start', title: 'Start from your situation', lead: 'Pick what worries you most. Each page gives the first steps you can take today and the layers that matter for it.', desc: 'Pick what worries you most and get the first privacy steps you can take today.', figure: FIG.layers, items: SITUATIONS.map((S) => ({ href: `/start/${S.slug}/`, title: S.title, text: S.short, action: 'See the first steps' })) }));
for (const S of SITUATIONS) write(`start/${S.slug}/index.html`, docPage({ slug: `start/${S.slug}`, title: S.title, desc: S.intro.slice(0, 155), body: situationBody(S, esc), current: 'protect' }));
write('privacy/index.html', docPage({ slug: 'privacy', title: 'Privacy policy', desc: 'What secureinchat.com and its tools do with your data: no cookies, no accounts, no stored test results.', body: PRIVACY, current: 'about' }));
write('about/index.html', docPage({ slug: 'about', title: 'About', desc: 'About SecureInChat: an end-to-end encrypted blind-relay messenger in development, plus free privacy tools.', body: ABOUT, current: 'about' }));
write('sponsor/index.html', docPage({ slug: 'sponsor', title: 'How SecureInChat is funded', desc: 'How SecureInChat is funded, what sponsors can and cannot do, and how commission links are disclosed.', body: SPONSOR, current: 'about' }));
write('principles/index.html', docPage({ slug: 'principles', title: 'Privacy principles for the tools', desc: 'What each SecureInChat tool processes on your device, what it sends to outside services, and the limits we cannot remove.', body: PRINCIPLES, current: 'about' }));
write('mission/index.html', docPage({ slug: 'mission', title: 'Our mission', desc: 'What SecureInChat believes, what we are building toward, who we build for and what we will never do.', body: MISSION, current: 'about' }));
write('protect/index.html', catalogPage({ slug: 'protect', title: 'Protect your privacy, layer by layer', lead: `${esc(MISSION_SHORT)} Not sure where to begin? <a href="/start/">Start from your situation</a>.`, desc: 'Six layers of personal privacy protection: physical, devices, accounts and email, communication, offline and emergency, and AI privacy.', figure: FIG.layers, items: LAYERS.map((L, i) => ({ href: `/protect/${L.slug}/`, title: `${i + 1}. ${esc(L.name)}`, text: esc(L.tagline), labels: layerTags(L), action: 'Open this layer' })) }));
LAYERS.forEach((L, i) => write(`protect/${L.slug}/index.html`, docPage({ slug: `protect/${L.slug}`, title: `${L.name} privacy`, desc: `${L.tagline} ${L.threat}`.slice(0, 155), body: layerBody(L, esc, i + 1), current: 'protect' })));
// Shop (T10): not in the navigation; noindex and out of the sitemap until a real product passes validation.
for (const p of PRODUCTS) { const errs = validateProduct(p); if (errs.length) throw new Error(`shop product ${p.slug}: ${errs.join('; ')}`); }
const SHOP_ROBOTS = PRODUCTS.length ? '' : 'noindex';
write('shop/index.html', docPage({ slug: 'shop', title: 'Shop', desc: 'Privacy gear and software we can explain and you can check yourself. Every product page shows what it protects against, our test evidence, limits and any commission.', body: shopIndexBody(PRODUCTS, esc, DATE), robots: SHOP_ROBOTS }));
for (const p of PRODUCTS) write(`shop/${p.slug}/index.html`, docPage({ slug: `shop/${p.slug}`, title: p.name, desc: p.protects.slice(0, 155), body: productBody(p, esc) }));
write('security/index.html', docPage({ slug: 'security', title: 'Report a security problem', desc: 'How to report a security problem in SecureInChat tools, services or the Android app, what is in scope, and the rules for good-faith research.', body: SECURITY, current: 'about' }));
write('.well-known/security.txt', SECURITY_TXT);
write('testing/index.html', docPage({ slug: 'testing', title: 'How we test', desc: 'The automated tests every SecureInChat release runs before it goes live, and what they do not prove.', body: TESTING, current: 'about' }));
write('messaging/threat-model/index.html', docPage({ slug: 'messaging/threat-model', title: 'Messenger threat model', desc: 'What the SecureInChat messenger is designed to protect, from whom, what the relay can still see, and what it cannot protect against.', body: THREAT_MODEL, current: 'messaging' }));
write('contact/index.html', docPage({ slug: 'contact', title: 'Contact', desc: 'How to contact SecureInChat.', body: CONTACT, current: 'about' }));

// /guides/, /refund/ and /terms/ removed 2026-10-22 (owner decision: AI build guides do not belong on this site).
write('_redirects', ['/guides /blog/ 301', '/guides/ /blog/ 301', '/guides/* /blog/ 301', '/refund/ / 301', '/terms/ / 301', ''].join('\n'));


// blog
const postJsonLd = (p) => ({
  '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.desc,
  datePublished: p.date, dateModified: p.date, inLanguage: 'en',
  author: { '@type': 'Person', name: 'Paul', url: SITE + '/about/' },
  publisher: { '@type': 'Organization', name: 'SecureInChat', url: SITE + '/' },
  mainEntityOfPage: `${SITE}/blog/${p.slug}/`,
});
const RELATED = [['/checkup/', 'Start the privacy checkup'], ['/tools/', 'Browse the free privacy tools'], ['/principles/', 'See how SecureInChat tools handle data']];
for (const p of POSTS) {
  // Search snippets: keep the brand only when the title stays short, and cut the description at a sentence end near 160 characters.
  const full = p.title.length + 15 <= 65 ? `${p.title} | SecureInChat` : p.title; const canonical = `/blog/${p.slug}/`;
  const snip = (d) => { if (d.length <= 160) return d; const cut = d.slice(0, 160); const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? ')); return end > 80 ? cut.slice(0, end + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '…'; };
  write(`blog/${p.slug}/index.html`, articlePage({
    title: full, desc: snip(p.desc), canonical, headExtra: headExtra({ canonical, jsonld: postJsonLd(p), title: full, desc: snip(p.desc) }),
    crumbs: [['/', 'Home'], ['/blog/', 'Guides'], [canonical, p.title]], figure: figFor(p.slug),
    body: `    <h1>${p.title}</h1>\n    <p class="meta">By Paul · ${p.date}</p>\n    <p class="lead">${p.desc}</p>${p.body}`,
    related: RELATED.map(([href, title]) => ({ href, title })),
  }));
}
// Guides index: ChatGPT's guides-index template, with the real post list.
const GUIDE_CATS = [
  ['network', 'Network &amp; connection', /ip-leak|webrtc|ipv6|dns-leak|vpn|leak-test-sites/],
  ['ai', 'AI &amp; privacy', /ai-|bank-statement|photo-before|cv-before|before-you-paste|redact/],
  ['accounts', 'Accounts &amp; phones', /phone|email|alias|app-permissions|password|privacy-reset/],
  ['tracking', 'Data &amp; tracking', /broker/],
  ['offline', 'Offline communication', /networks-fail/],
  ['relay', 'Blind relay', /blind-relay/],
];
const catOf = (slug) => (GUIDE_CATS.find(([, , re]) => re.test(slug)) || GUIDE_CATS[0]);
function blogIndex() {
  let m = kitMain('guides-index.en.html');
  const posts = [...POSTS].sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : 0));
  const item = (p) => `<article class="guide-list-item"><div class="guide-list-main"><div class="guide-list-meta"><span>${catOf(p.slug)[1]}</span><span>${p.date}</span></div><h2><a href="/blog/${p.slug}/">${p.title}</a></h2><p>${p.desc}</p></div><span aria-hidden="true" class="guide-list-arrow">↗</span></article>`;
  const fa = m.indexOf('<div class="guide-feed">'); const fb = m.indexOf('<div class="tool-group">', fa);
  m = m.slice(0, fa) + `<div class="guide-feed">\n${posts.map(item).join('\n')}\n</div>\n` + m.slice(fb);
  for (const [id, name, re] of GUIDE_CATS) {
    const n = POSTS.filter((p) => catOf(p.slug)[0] === id).length;
    m = m.replace(new RegExp(`(<a class="guide-filter" href="#${id}">)[\\s\\S]*?(</a>)`), `$1${name} · ${n}$2`);
    const list = POSTS.filter((p) => catOf(p.slug)[0] === id).map((p) => `<li><a href="/blog/${p.slug}/">${p.title}</a></li>`).join('');
    m = m.replace(new RegExp(`(<section id="${id}">[\\s\\S]*?)(</section>)`), `$1<ul>${list}</ul>$2`);
  }
  m = m.replace('aria-label="面包屑导航"', 'aria-label="Breadcrumb"');
  const title = 'Privacy guides | SecureInChat'; const desc = 'Practical privacy guides with official sources: phone numbers, accounts, data brokers, AI sharing, network leaks and offline messaging.';
  return kitShell({ title, desc, canonical: '/blog/', current: '/blog/', headExtra: headExtra({ canonical: '/blog/', title, desc }), main: m });
}
write('blog/index.html', blogIndex());

// Tools index: ChatGPT's tools-index template (one link fixed: the health check lives at /tools/site-health-check/).
{
  const title = 'Privacy tools | SecureInChat'; const desc = 'Free privacy tools: see what each check does, what stays in your browser and when an outside service is involved.';
  const m = kitMain('tools-index.en.html').replace(/\/tools\/website-health-check\//g, '/tools/site-health-check/').replace('aria-label="面包屑导航"', 'aria-label="Breadcrumb"');
  write('tools/index.html', kitShell({ title, desc, canonical: '/tools/', current: '/tools/', headExtra: headExtra({ canonical: '/tools/', title, desc }), main: m }));
}

// Tool detail pages: kit tool-detail layout around each tool's unchanged live markup (src/tools/<slug>.html).
{
  const idx = KIT_T('tools-index.en.html');
  const ICONS = {};
  for (const a of idx.match(/<article class="tool-catalogue-item">[\s\S]*?<\/article>/g) || []) {
    const href = /href="\/tools\/([a-z0-9-]+)\/"/.exec(a); const svg = /<svg[\s\S]*?<\/svg>/.exec(a);
    if (href && svg) ICONS[href[1] === 'website-health-check' ? 'site-health-check' : href[1]] = svg[0];
  }
  const FLOW = {};
  for (const r of PRINCIPLES.matchAll(/<tr><td><a href="\/tools\/([a-z0-9-]+)\/">[^<]*<\/a><\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><\/tr>/g)) FLOW[r[1]] = { stays: r[2], sent: r[3] };
  FLOW['browser-fingerprint-test'] = FLOW['browser-fingerprint-test'] || FLOW['fingerprint-test'];
  // The tools index (ChatGPT's template) has no entry for the file metadata remover yet; reuse the photo tool's icon so
  // the title row keeps its two-column layout until the index gets its own icon.
  ICONS['file-metadata-remover'] = ICONS['file-metadata-remover'] || ICONS['photo-metadata-remover'];
  const L = { local: ['Local processing', 'state-label'], list: ['Local checklist', 'state-label'], net: ['Network lookup', 'state-label state-label--network'], some: ['Some network lookups', 'state-label state-label--network'], limited: ['Limited lookup', 'state-label state-label--network'], site: ['Site request', 'state-label state-label--network'] };
  const TOOLS = [
    ['link-checker', 'Link checker', L.local, FIG.url], ['photo-metadata-remover', 'Photo metadata remover', L.local, FIG.photo], ['file-metadata-remover', 'File metadata remover', L.local, FIG.photo], ['text-redactor', 'Text redactor', L.local, FIG.redact],
    ['browser-fingerprint-test', 'Browser fingerprint test', L.local, FIG.flows], ['account-checkup', 'Account security checkup', L.list, FIG.account],
    ['ip-leak-test', 'IP leak test', L.net, FIG.flows], ['webrtc-leak-test', 'WebRTC leak test', L.net, FIG.flows], ['ipv6-leak-test', 'IPv6 leak test', L.net, FIG.flows],
    ['privacy-report', 'Browser privacy report', L.some, FIG.flows], ['password-checker', 'Password checker', L.limited, FIG.account], ['site-health-check', 'Website health check', L.site, FIG.flows],
  ];
  write('assets/css/tool-legacy.css', `/* Previous tool widget styles, scoped to .legacy-tool (generated from src/tools/legacy-style.css). */\n${scopeLegacyCss(fs.readFileSync(path.join(ROOT, 'src/tools/legacy-style.css'), 'utf8'))}`);
  for (const [slug, name, label, figure] of TOOLS) {
    const src = fs.readFileSync(path.join(ROOT, 'src/tools', `${slug}.html`), 'utf8');
    if (!FLOW[slug]) throw new Error('no data-flow row for ' + slug);
    write(`tools/${slug}/index.html`, toolPage({ slug, src, icon: ICONS[slug], label, flow: FLOW[slug], figure, crumbName: name }));
  }
}


write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#23483E"/><g transform="translate(6 6) scale(.833)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></g></svg>
`);

// fonts + script
const fonts = [
];
for (const [src, dst] of [['atkinson-hyperlegible-next-latin-400-normal', 'atkinson-next-400'], ['atkinson-hyperlegible-next-latin-600-normal', 'atkinson-next-600'], ['atkinson-hyperlegible-next-latin-800-normal', 'atkinson-next-800'], ['atkinson-hyperlegible-mono-latin-400-normal', 'atkinson-mono-400']]) {
  write(`assets/fonts/${dst}.woff2`, fs.readFileSync(path.join(PUB, 'tools/fonts', src + '.woff2')));
}
for (const [pkg, name, weights] of fonts) {
  for (const w of weights) {
    const src = path.join(import.meta.dirname, `node_modules/@fontsource/${pkg}/files/${name}-latin-${w}-normal.woff2`);
    write(`assets/fonts/${name}-${w}.woff2`, fs.readFileSync(src));
  }
}
write('assets/main.js', fs.readFileSync(path.join(ROOT, 'src/main.js')));
write('assets/site.css', fs.readFileSync(path.join(ROOT, 'src/site.css')));


// Nord Security affiliate links on the Chinese and Japanese pages (owner decision 2026-10-22; Chinese pages are for readers outside mainland China).
const NORD_VPN = 'https://go.nordvpn.net/aff_c?offer_id=15&amp;aff_id=159108&amp;url_id=902';
const NORD_PASS = 'https://go.nordpass.io/aff_c?offer_id=488&amp;aff_id=159108&amp;url_id=9356';
const PARTNER_ZH = `    <section class="checkup-next-section" aria-labelledby="partner-h">
      <div class="container checkup-next-panel">
        <div><h2 id="partner-h">合作伙伴工具</h2>
        <p><a href="${NORD_VPN}" rel="sponsored noopener">NordVPN</a>（联盟链接）：付费 VPN 服务，适合在海外使用。也可以直接访问 <a href="https://nordvpn.com/" rel="noopener">nordvpn.com</a>。</p>
        <p><a href="${NORD_PASS}" rel="sponsored noopener">NordPass</a>（联盟链接）：密码管理器，有免费版。也可以直接访问 <a href="https://nordpass.com/" rel="noopener">nordpass.com</a>。</p></div>
      </div>
    </section>
`;
const PARTNER_JA = `    <section class="wrap sec" aria-labelledby="partner-h">
      <h2 id="partner-h">提携パートナーのツール</h2>
      <p><a href="${NORD_VPN}" rel="sponsored noopener">NordVPN</a>（アフィリエイトリンク）：有料の VPN サービスです。接続後、<a href="/tools/ip-leak-test/" hreflang="en">IP 漏えいテスト（英語）</a>でご自身で確認できます。<a href="https://nordvpn.com/" rel="noopener">nordvpn.com</a> に直接アクセスすることもできます。</p>
      <p><a href="${NORD_PASS}" rel="sponsored noopener">NordPass</a>（アフィリエイトリンク）：無料プランのあるパスワードマネージャーです。<a href="https://nordpass.com/" rel="noopener">nordpass.com</a> に直接アクセスすることもできます。</p>
    </section>
`;
function addPartner(rel, block) {
  const f = path.join(PUB, rel); const h = fs.readFileSync(f, 'utf8'); const i = h.lastIndexOf('</main>');
  if (i < 0 || h.includes('go.nordvpn.net')) throw new Error('partner block: ' + rel);
  fs.writeFileSync(f, h.slice(0, i) + block + h.slice(i));
}
addPartner('zh/checkup/index.html', PARTNER_ZH);
addPartner('zh/tools/phone-checkup/index.html', PARTNER_ZH);
addPartner('ja/index.html', PARTNER_JA);
addPartner('blog/data-broker-opt-out-guide/index.html', `    <aside class="wrap doc" aria-labelledby="partner-h">
      <h2 id="partner-h">Tools from our partner</h2>
      <p><a href="https://go.coveron.net/aff_c?offer_id=1025&amp;aff_id=159108" rel="sponsored noopener">Coveron</a> (affiliate link) is an identity theft protection service for people in the United States. Opting out of data brokers yourself, as described above, costs nothing.</p>
    </aside>
`);

// sitemap, robots, headers
const urls = [
  ['/', 1], ['/start/', 0], ...SITUATIONS.map((S) => [`/start/${S.slug}/`, 0]), ['/messaging/', 0], ['/mission/', 0], ['/protect/', 0], ...LAYERS.map((L) => [`/protect/${L.slug}/`, 0]), ['/zh/', 0], ['/ja/', 0], ['/checkup/', 0], ['/zh/checkup/', 0], ['/tools/phone-checkup/', 0], ['/zh/tools/phone-checkup/', 0], ['/tools/', 0], ['/tools/privacy-report/', 0], ['/tools/account-checkup/', 0], ['/tools/ip-leak-test/', 0], ['/tools/webrtc-leak-test/', 0], ['/tools/ipv6-leak-test/', 0], ['/tools/photo-metadata-remover/', 0], ['/tools/file-metadata-remover/', 0], ['/tools/browser-fingerprint-test/', 0], ['/tools/password-checker/', 0], ['/tools/text-redactor/', 0], ['/tools/link-checker/', 0], ['/tools/site-health-check/', 0], ['/blog/', 0], ...POSTS.map((p) => [`/blog/${p.slug}/`, 0]), ['/about/', 0], ['/privacy/', 0], ['/contact/', 0], ['/sponsor/', 0], ['/principles/', 0], ['/security/', 0], ['/testing/', 0], ['/messaging/threat-model/', 0],
  ...(PRODUCTS.length ? [['/shop/', 0], ...PRODUCTS.map((p) => [`/shop/${p.slug}/`, 0])] : []),
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(([u]) => { const post = POSTS.find((p) => u === `/blog/${p.slug}/`); return `  <url>\n    <loc>${SITE}${u}</loc>\n${post ? `    <lastmod>${post.date}</lastmod>\n` : ''}  </url>`; }).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /tools/api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

const MAIN_CSP = "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' wss://ws.secureinchat.com https://cloudflareinsights.com; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'";
// 'wasm-unsafe-eval' lets the file metadata remover compile its WebAssembly (same-origin file). It allows WebAssembly
// compilation only; JavaScript eval stays blocked. Cloudflare joins repeated CSP headers rather than replacing them,
// so a per-page exception under /tools/* is not possible; it is set for the whole /tools/ section.
const TOOLS_CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api4.ipify.org https://api6.ipify.org https://ipwho.is https://dnsapi.secureinchat.com https://*.lk.secureinchat.com https://api.pwnedpasswords.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const common = `  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`;
const mainPaths = ['/', '/zh/', '/ja/', '/checkup/', '/zh/checkup/', '/zh/tools/phone-checkup/', '/messaging/', '/start/', ...SITUATIONS.map((S) => `/start/${S.slug}/`), '/mission/', '/protect/', ...LAYERS.map((L) => `/protect/${L.slug}/`), '/privacy/', '/about/', '/contact/', '/sponsor/', '/principles/', '/security/', '/testing/', '/messaging/threat-model/', '/blog/', ...POSTS.map((p) => `/blog/${p.slug}/`), '/shop/', ...PRODUCTS.map((p) => `/shop/${p.slug}/`)];
write('_headers', `# Main pages: self-hosted assets only; Cloudflare Web Analytics and the relay websocket are allowed.
${mainPaths.map((p) => `${p}\n  Content-Security-Policy: ${MAIN_CSP}\n${common}`).join('\n')}

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
