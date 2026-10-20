// Generates the static site into ../public. Run: node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { POSTS } from './posts.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUB = path.join(ROOT, 'public');
const SITE = 'https://secureinchat.com';
const DATE = '2026-10-20';
const REPO = 'https://github.com/Paul30028/secureinchat';

const iconDir = path.join(import.meta.dirname, 'node_modules/lucide-static/icons');
const icon = (name, cls = 'w-5 h-5') => {
  let s = fs.readFileSync(path.join(iconDir, name + '.svg'), 'utf8');
  s = s.replace(/<!--[\s\S]*?-->/, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/ class="[^"]*"/, '').replace(/ width="24"/, '').replace(/ height="24"/, '');
  return s.replace('<svg', `<svg class="${cls}" aria-hidden="true" focusable="false"`);
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------------------------
const LANGS = {
  en: {
    code: 'en', html: 'en', path: '/', label: 'EN',
    title: 'SecureInChat: Zero-Knowledge Blind Relay Messaging',
    desc: 'SecureInChat is an end-to-end encrypted messenger built on a blind relay: keys stay on your devices and the server only forwards ciphertext. Run live relay diagnostics and free privacy tools.',
    navArchitecture: 'Architecture', navSecurity: 'Security', navDiagnostics: 'Diagnostics', navTools: 'Tools', navBlog: 'Blog',
    hero1: 'Communication Without Trace.', hero2: 'Trust Without Compromise.',
    heroCopy: 'A zero-knowledge blind relay protocol where encryption keys remain on your devices and the relay only forwards unreadable ciphertext.',
    runDiag: 'Run relay diagnostics', explore: 'Explore the architecture',
    diagTitle: 'Verify the relay in real time.',
    diagCopy: 'This browser performs a real WSS connection test, measures handshake latency, and validates the relay challenge response.',
    testing: 'Testing…', retest: 'Run diagnostics',
    toolsTitle: 'Free privacy tools that run in your browser.',
    toolsCopy: 'Check what your connection gives away. Nothing you test is stored, and no cookies are set.',
    toolName: 'IP leak test', toolDesc: 'Public IP, WebRTC, IPv6, time zone and request headers, checked against your VPN or proxy.',
    toolCta: 'Run the test', toolsAll: 'All tools',
    archTitle: 'The server forwards. It never understands.',
    archCopy: 'Every sensitive operation stays at the edge. The relay receives only encrypted payloads required for delivery.',
    securityTitle: 'Modern cryptography. Minimal trust surface.',
    securityCopy: 'SecureInChat combines established primitives with client-side key custody and a relay architecture designed to minimize data exposure.',
    ctaTitle: 'Move private communication back to the edge.',
    ctaCopy: 'Choose your platform and connect through a blind relay designed to know as little as possible.',
    ctaNote: 'Clients are in development. The relay diagnostics and tools on this site are live today.',
    ctaTools: 'Try the IP leak test',
    footLine: 'Zero-Knowledge Blind Relay Architecture.', fPrivacy: 'Privacy', fAbout: 'About', fContact: 'Contact',
    skip: 'Skip to content',
  },
  zh: {
    code: 'zh', html: 'zh-CN', path: '/zh/', label: 'ZH',
    title: 'SecureInChat：零知识盲中继加密通信',
    desc: 'SecureInChat 是基于盲中继的端到端加密通信：密钥始终保留在用户设备，中继服务器只转发无法读取的密文。可在线运行中继诊断和免费隐私工具。',
    navArchitecture: '工作原理', navSecurity: '安全矩阵', navDiagnostics: '节点诊断', navTools: '工具', navBlog: '博客',
    hero1: '沟通不留痕迹。', hero2: '信任无需妥协。',
    heroCopy: '零知识盲中继通信协议：密钥始终保留在用户设备，中继服务器只转发无法读取的密文。',
    runDiag: '运行节点诊断', explore: '查看工作原理',
    diagTitle: '实时验证盲中继状态。',
    diagCopy: '浏览器会发起真实 WSS 连接，测量握手延迟，并验证中继返回的挑战消息。',
    testing: '检测中…', retest: '运行节点诊断',
    toolsTitle: '在浏览器里运行的免费隐私工具。',
    toolsCopy: '查看你的连接泄露了哪些信息。测试内容不会被保存，也不会设置 Cookie。',
    toolName: 'IP 泄漏测试', toolDesc: '检查公网 IP、WebRTC、IPv6、时区和请求头，并对照你的 VPN 或代理。',
    toolCta: '开始测试', toolsAll: '全部工具',
    archTitle: '服务器负责转发，但永远无法理解内容。',
    archCopy: '所有敏感操作都在终端本地完成，中继只接收完成投递所必需的加密载荷。',
    securityTitle: '现代密码学，更小的信任边界。',
    securityCopy: 'SecureInChat 采用成熟密码原语、客户端密钥控制和数据暴露最小化的盲中继架构。',
    ctaTitle: '让私密通信重新回到终端。',
    ctaCopy: '通过一个尽可能少知道信息的盲中继建立连接。',
    ctaNote: '客户端仍在开发中。本站的节点诊断和工具现已可用。',
    ctaTools: '试试 IP 泄漏测试',
    footLine: '零知识盲中继架构。', fPrivacy: '隐私', fAbout: '关于', fContact: '联系',
    skip: '跳到正文',
  },
  ja: {
    code: 'ja', html: 'ja', path: '/ja/', label: 'JA',
    title: 'SecureInChat：ゼロ知識ブラインドリレー通信',
    desc: 'SecureInChat は、暗号鍵を端末内に保持し、リレーは暗号文だけを転送するエンドツーエンド暗号化メッセンジャーです。リレー診断と無料のプライバシーツールをお試しください。',
    navArchitecture: '仕組み', navSecurity: 'セキュリティ', navDiagnostics: '診断', navTools: 'ツール', navBlog: 'ブログ',
    hero1: '痕跡を残さない通信。', hero2: '妥協のない信頼。',
    heroCopy: '暗号鍵は端末内に保持され、リレーは解読不能な暗号文だけを転送するゼロ知識型ブラインドリレープロトコル。',
    runDiag: '診断を実行', explore: '仕組みを見る',
    diagTitle: 'リレーをリアルタイム検証。',
    diagCopy: '実際のWSS接続、ハンドシェイク遅延、リレーチャレンジ応答をブラウザで確認します。',
    testing: '診断中…', retest: '診断を実行',
    toolsTitle: 'ブラウザで動く無料のプライバシーツール。',
    toolsCopy: '接続が何を漏らしているかを確認できます。テスト内容は保存されず、Cookie も使いません。',
    toolName: 'IP リークテスト', toolDesc: '公開 IP、WebRTC、IPv6、タイムゾーン、リクエストヘッダーを VPN やプロキシと照らして確認します。',
    toolCta: 'テストを実行', toolsAll: 'すべてのツール',
    archTitle: 'サーバーは転送するだけ。内容は理解しない。',
    archCopy: '機密処理は端末側で完結。リレーが受け取るのは配送に必要な暗号化ペイロードだけです。',
    securityTitle: '現代暗号と最小限の信頼境界。',
    securityCopy: '確立された暗号プリミティブ、端末側の鍵管理、露出を最小化するリレー設計を組み合わせています。',
    ctaTitle: 'プライベート通信を端末側へ。',
    ctaCopy: '必要な情報だけを知るブラインドリレーを通じて接続します。',
    ctaNote: 'クライアントは開発中です。このサイトのリレー診断とツールは現在ご利用いただけます。',
    ctaTools: 'IP リークテストを試す',
    footLine: 'ゼロ知識ブラインドリレー アーキテクチャ。', fPrivacy: 'プライバシー', fAbout: '概要', fContact: 'お問い合わせ',
    skip: '本文へ移動',
  },
};

const ARCH = [
  { icon: 'lock-keyhole', title: 'Sender Local Encryption', copy: 'Message content and session keys are processed locally before any network transmission.', status: 'PLAINTEXT NEVER LEAVES DEVICE' },
  { icon: 'server-off', title: 'Blind Relay Server', copy: 'The relay routes opaque cipher payloads without possessing the keys required to decrypt them.', status: 'CANNOT READ MESSAGE CONTENT' },
  { icon: 'lock-keyhole-open', title: 'Recipient Local Decryption', copy: 'Only the intended recipient device reconstructs and decrypts the authenticated message.', status: 'DECRYPTED AT THE EDGE' },
];
const SEC = [
  { icon: 'git-branch', title: 'Curve25519', tag: 'KEY AGREEMENT', copy: 'Efficient elliptic-curve key agreement for modern client devices.' },
  { icon: 'shield-check', title: 'AES-256-GCM', tag: 'AEAD', copy: 'Authenticated encryption designed to protect confidentiality and integrity.' },
  { icon: 'key-round', title: 'HKDF', tag: 'KEY DERIVATION', copy: 'Context-separated key derivation for session and message-key workflows.' },
  { icon: 'database-zap', title: 'No-Log Assurance', tag: 'DATA MINIMIZATION', copy: 'Relay operation is designed without persistent message-content storage.' },
];

// ---------------------------------------------------------------------------------------------
function head({ title, desc, canonical, alternates = [], ogLocale = 'en_US', jsonld }) {
  const alt = alternates.map((a) => `  <link rel="alternate" hreflang="${a.hreflang}" href="${SITE}${a.path}" />`).join('\n');
  return `<meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#070A11" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${SITE}${canonical}" />
${alt}
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SecureInChat" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${SITE}${canonical}" />
  <meta property="og:locale" content="${ogLocale}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <link rel="stylesheet" href="/assets/site.css" />
  <script src="/assets/main.js"></script>
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ''}`;
}

const logo = () => `<a href="/" class="flex items-center gap-3 group" aria-label="SecureInChat home">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo via-cyan to-emerald flex items-center justify-center shadow-indigo">${icon('shield-check', 'w-5 h-5 text-white')}</div>
        <div>
          <div class="font-display font-bold tracking-tight">SecureInChat</div>
          <div class="font-mono text-[9px] tracking-[.22em] text-slate-500">ZERO-KNOWLEDGE RELAY</div>
        </div>
      </a>`;

function header(t, { home, current }) {
  const pre = home ? '' : '/';
  const link = (href, text, key) => `<a href="${href}" class="hover:text-white transition${current === key ? ' text-white' : ''}"${current === key ? ' aria-current="page"' : ''}>${text}</a>`;
  const langs = home
    ? `<select id="lang" aria-label="Language" class="bg-white/[.04] hairline rounded-xl px-2.5 py-2 text-xs text-slate-300 outline-none">
          ${Object.values(LANGS).map((l) => `<option value="${l.path}"${l.code === t.code ? ' selected' : ''}>${l.label}</option>`).join('')}
        </select>` : '';
  const status = home
    ? `<div class="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[.035] hairline font-mono text-[10px]" role="status">
          <span class="relative flex w-2 h-2"><span id="net-dot-ping" class="absolute inline-flex w-full h-full rounded-full bg-amber-300 opacity-70 animate-ping"></span><span id="net-dot" class="relative inline-flex w-2 h-2 rounded-full bg-amber-300"></span></span>
          <span id="net-label" class="text-slate-300">Network: Checking</span><span class="text-slate-600">|</span><span class="text-emerald">100% Zero-Knowledge</span>
        </div>` : '';
  return `<header class="fixed top-4 inset-x-0 z-50 px-4">
    <nav class="max-w-7xl mx-auto glass rounded-2xl px-4 sm:px-6 h-16 flex items-center justify-between shadow-2xl" aria-label="Main">
      ${logo()}
      <div class="hidden lg:flex items-center gap-7 text-sm text-slate-400">
        ${link(pre + '#architecture', t.navArchitecture, 'a')}
        ${link(pre + '#security', t.navSecurity, 's')}
        ${link(pre + '#diagnostics', t.navDiagnostics, 'd')}
        ${link('/tools/', t.navTools, 'tools')}
        ${link('/blog/', t.navBlog, 'blog')}
      </div>
      <div class="flex items-center gap-3">
        ${status}
        ${langs}
      </div>
    </nav>
  </header>`;
}

function footer(t) {
  const langLinks = Object.values(LANGS).map((l) => `<a href="${l.path}" hreflang="${l.html}" lang="${l.html}" class="hover:text-white">${l.label}</a>`).join('');
  return `<footer class="relative z-10 border-t border-white/10 py-8">
    <div class="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col lg:flex-row items-center justify-between gap-5 text-xs text-slate-500">
      <div>© 2026 SecureInChat. ${t.footLine}</div>
      <nav class="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Footer">
        <a href="/tools/" class="hover:text-white">${t.navTools}</a>
        <a href="/blog/" class="hover:text-white">${t.navBlog}</a>
        <a href="/privacy/" class="hover:text-white">${t.fPrivacy}</a>
        <a href="/about/" class="hover:text-white">${t.fAbout}</a>
        <a href="/contact/" class="hover:text-white">${t.fContact}</a>
        <a href="${REPO}" class="hover:text-white" rel="noopener">GitHub</a>
      </nav>
      <div class="flex gap-4">${langLinks}</div>
    </div>
  </footer>`;
}

const backdrop = `<div class="fixed inset-0 grid-overlay pointer-events-none"></div>
  <div class="fixed -top-24 left-[8%] w-96 h-96 rounded-full bg-indigo ambient pointer-events-none"></div>
  <div class="fixed top-[30%] right-[4%] w-80 h-80 rounded-full bg-cyan ambient pointer-events-none"></div>
  <div class="fixed bottom-0 left-[35%] w-96 h-80 rounded-full bg-emerald ambient pointer-events-none"></div>`;

function home(t) {
  const alternates = [...Object.values(LANGS).map((l) => ({ hreflang: l.html, path: l.path })), { hreflang: 'x-default', path: '/' }];
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': SITE + '/#org', name: 'SecureInChat', url: SITE + '/' },
      { '@type': 'WebSite', '@id': SITE + '/#site', url: SITE + '/', name: 'SecureInChat', publisher: { '@id': SITE + '/#org' }, inLanguage: t.html },
    ],
  };
  const archCards = ARCH.map((s, i) => `<article class="group relative glass rounded-3xl p-7 hover:-translate-y-2 transition duration-500"><div class="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-indigo/10 via-transparent to-emerald/10"></div><div class="relative"><div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/[.05] hairline mb-6">${icon(s.icon, 'w-6 h-6 text-cyan')}</div><div class="font-mono text-[10px] text-slate-500 mb-2">0${i + 1} / 03</div><h3 class="font-display text-xl font-semibold">${s.title}</h3><p class="mt-3 text-sm leading-6 text-slate-400">${s.copy}</p><div class="mt-6 text-xs font-mono text-emerald">${s.status}</div></div></article>`).join('\n        ');
  const secCards = SEC.map((s) => `<article class="glass rounded-2xl p-6 hover:border-emerald/30 transition"><div class="flex items-center justify-between">${icon(s.icon, 'w-5 h-5 text-emerald')}<span class="font-mono text-[9px] text-slate-600 uppercase tracking-widest">${s.tag}</span></div><h3 class="mt-5 font-display text-xl font-semibold">${s.title}</h3><p class="mt-2 text-sm leading-6 text-slate-400">${s.copy}</p></article>`).join('\n          ');
  return `<!DOCTYPE html>
<html lang="${t.html}">
<head>
  ${head({ title: t.title, desc: t.desc, canonical: t.path, alternates, ogLocale: t.html.replace('-', '_'), jsonld })}
</head>
<body class="noise min-h-screen overflow-x-hidden bg-obsidian text-slate-100 font-sans antialiased selection:bg-emerald/30">
  <a href="#top" class="skip">${t.skip}</a>
  ${backdrop}
  ${header(t, { home: true })}

  <main id="top" class="relative z-10">
    <section class="max-w-7xl mx-auto px-5 sm:px-8 pt-36 lg:pt-44 pb-24 lg:pb-32">
      <div class="grid lg:grid-cols-[1.08fr_.92fr] gap-14 items-center">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-[11px] font-mono uppercase tracking-[.16em] text-cyan mb-7">
            ${icon('radio-tower', 'w-3.5 h-3.5')}
            <span>Blind Relay Protocol / E2EE Native</span>
          </div>
          <h1 class="font-display font-bold text-5xl sm:text-6xl xl:text-7xl leading-[1.02] tracking-[-.045em] max-w-4xl">
            <span>${t.hero1}</span><br>
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-emerald-300">${t.hero2}</span>
          </h1>
          <p class="mt-7 max-w-2xl text-lg leading-8 text-slate-400">${t.heroCopy}</p>
          <div class="mt-7 flex flex-wrap gap-2.5">
            <span class="px-3 py-1.5 rounded-lg bg-white/[.035] hairline font-mono text-xs text-slate-300">End-to-End Encrypted</span><span class="px-3 py-1.5 rounded-lg bg-white/[.035] hairline font-mono text-xs text-slate-300">Blind Relay Engine</span><span class="px-3 py-1.5 rounded-lg bg-white/[.035] hairline font-mono text-xs text-slate-300">Zero Metadata</span>
          </div>
          <div class="mt-10 flex flex-col sm:flex-row gap-3">
            <a href="#diagnostics" class="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white text-slate-950 font-semibold hover:scale-[1.02] transition shadow-xl">${icon('activity', 'w-5 h-5')}<span>${t.runDiag}</span></a>
            <a href="#architecture" class="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl glass font-semibold text-slate-200 hover:bg-white/[.08] transition">${icon('circle-play', 'w-5 h-5 text-cyan')}<span>${t.explore}</span></a>
          </div>
          <div class="mt-9 flex items-center gap-5 text-xs text-slate-500 font-mono">
            <span class="flex items-center gap-1.5">${icon('database-zap', 'w-4 h-4 text-emerald')}No message storage</span>
            <span class="flex items-center gap-1.5">${icon('user-round-x', 'w-4 h-4 text-cyan')}No identity binding</span>
          </div>
        </div>

        <div class="relative float" aria-hidden="true">
          <div class="absolute -inset-8 bg-gradient-to-br from-indigo/20 via-cyan/5 to-emerald/20 blur-3xl rounded-full"></div>
          <div class="relative glass rounded-3xl overflow-hidden shadow-2xl">
            <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/20">
              <div class="flex gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-rose-400/70"></span><span class="w-2.5 h-2.5 rounded-full bg-amber-300/70"></span><span class="w-2.5 h-2.5 rounded-full bg-emerald/80"></span></div>
              <div class="font-mono text-[10px] text-slate-500">secure-client://encryption-pipeline</div>
              ${icon('lock-keyhole', 'w-4 h-4 text-emerald')}
            </div>
            <div class="p-6 sm:p-8 font-mono text-xs sm:text-sm leading-7 min-h-[420px] bg-gradient-to-b from-slate-950/50 to-transparent">
              <div class="terminal-line text-slate-500">$ secureinchat --compose</div>
              <div class="terminal-line"><span class="text-cyan">plaintext</span> <span class="text-slate-600">→</span> <span class="text-slate-300">“Meet at 21:00.”</span></div>
              <div class="terminal-line"><span class="text-indigo-300">key_agreement</span> <span class="text-slate-600">→</span> <span class="text-slate-300">Curve25519 / HKDF</span></div>
              <div class="terminal-line"><span class="text-emerald">client_encrypt</span> <span class="text-slate-600">→</span> <span class="text-slate-300">AES-256-GCM</span></div>
              <div class="terminal-line mt-3 p-4 rounded-xl bg-emerald/5 border border-emerald/20 break-all text-emerald-200/80">7f2a9c01:e8d4...blind-cipher-payload...31f9</div>
              <div class="mt-7 grid grid-cols-3 gap-3 text-center">
                <div class="p-3 rounded-xl bg-white/[.025] hairline"><div class="text-slate-500 text-[9px] uppercase tracking-widest">Server sees</div><div class="mt-1 text-emerald">Ciphertext</div></div>
                <div class="p-3 rounded-xl bg-white/[.025] hairline"><div class="text-slate-500 text-[9px] uppercase tracking-widest">Metadata</div><div class="mt-1 text-emerald">Minimized</div></div>
                <div class="p-3 rounded-xl bg-white/[.025] hairline"><div class="text-slate-500 text-[9px] uppercase tracking-widest">Retention</div><div class="mt-1 text-emerald">None</div></div>
              </div>
              <div class="mt-7 flex items-center gap-2 text-slate-500"><span class="w-2 h-2 rounded-full bg-emerald animate-pulse"></span>WSS relay channel ready</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="diagnostics" class="max-w-7xl mx-auto px-5 sm:px-8 pb-28 fade-up">
      <div class="glass rounded-3xl p-6 sm:p-8 lg:p-10 shadow-emerald">
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div><div class="font-mono text-[11px] uppercase tracking-[.2em] text-emerald mb-3">Live Node Diagnostics</div><h2 class="font-display text-3xl sm:text-4xl font-semibold">${t.diagTitle}</h2><p class="mt-3 text-slate-400 max-w-2xl">${t.diagCopy}</p></div>
          <button id="node-btn" type="button" data-testing="${esc(t.testing)}" data-retest="${esc(t.retest)}" class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald text-slate-950 font-semibold disabled:opacity-60">${icon('activity', 'w-4 h-4')}<span id="node-btn-label">${t.retest}</span></button>
        </div>
        <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="p-5 rounded-2xl bg-black/20 hairline"><div class="text-xs text-slate-500 uppercase tracking-widest">Relay Endpoint</div><div class="mt-3 font-mono text-sm text-cyan break-all">wss://ws.secureinchat.com</div><div id="node-conn" class="mt-4 text-xs text-slate-500">Awaiting test</div></div>
          <div class="p-5 rounded-2xl bg-black/20 hairline"><div class="text-xs text-slate-500 uppercase tracking-widest">Handshake Latency</div><div class="mt-3 font-display text-3xl"><span id="node-latency">—</span><span class="text-sm text-slate-500 ml-1">ms</span></div><div class="mt-4 text-xs text-slate-500">Browser-to-relay WSS open time</div></div>
          <div class="p-5 rounded-2xl bg-black/20 hairline"><div class="text-xs text-slate-500 uppercase tracking-widest">TLS Transport</div><div class="mt-3 flex items-center gap-2 text-lg">${icon('badge-check', 'w-5 h-5 text-emerald')}<span>WSS / TLS</span></div><div class="mt-4 text-xs text-slate-500">Certificate validated by browser</div></div>
          <div class="p-5 rounded-2xl bg-black/20 hairline"><div class="text-xs text-slate-500 uppercase tracking-widest">Relay Challenge</div><div id="node-chal" class="mt-3 font-display text-xl text-slate-300">Pending</div><div id="node-chal-detail" class="mt-4 text-xs text-slate-500 truncate">Waiting for auth_challenge</div></div>
        </div>
        <div id="node-log" role="status" aria-live="polite" class="mt-5 p-4 rounded-xl font-mono text-xs border bg-white/[.02] border-white/10 text-slate-500">Ready to test the blind relay endpoint.</div>
      </div>
    </section>

    <section id="architecture" class="max-w-7xl mx-auto px-5 sm:px-8 pb-28 fade-up">
      <div class="text-center max-w-3xl mx-auto mb-12"><div class="font-mono text-[11px] uppercase tracking-[.2em] text-cyan mb-3">Zero-Knowledge Architecture</div><h2 class="font-display text-4xl sm:text-5xl font-semibold">${t.archTitle}</h2><p class="mt-4 text-slate-400">${t.archCopy}</p></div>
      <div class="relative grid lg:grid-cols-3 gap-5 items-stretch">
        <svg class="hidden lg:block absolute inset-x-[16%] top-1/2 -translate-y-1/2 w-[68%] h-16 pointer-events-none" viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40H1000" stroke="rgba(6,182,212,.4)" stroke-width="2" class="flow-line" fill="none"/></svg>
        ${archCards}
      </div>
    </section>

    <section id="security" class="max-w-7xl mx-auto px-5 sm:px-8 pb-28 fade-up">
      <div class="grid lg:grid-cols-[.8fr_1.2fr] gap-10 items-start">
        <div class="lg:sticky lg:top-28"><div class="font-mono text-[11px] uppercase tracking-[.2em] text-indigo-300 mb-3">Security Matrix</div><h2 class="font-display text-4xl font-semibold">${t.securityTitle}</h2><p class="mt-4 text-slate-400 leading-7">${t.securityCopy}</p></div>
        <div class="grid sm:grid-cols-2 gap-4">
          ${secCards}
        </div>
      </div>
      <div class="mt-8 glass rounded-2xl p-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs text-slate-400 font-mono"><span>Privacy-by-Design</span><span>Data Minimization</span><span>No-Log Architecture</span><span>Open Cryptographic Primitives</span><span>Client-Side Key Control</span></div>
      <p class="mt-3 text-center text-[11px] text-slate-600">Compatibility statements describe design alignment, not legal certification or regulatory approval.</p>
    </section>

    <section id="tools" class="max-w-7xl mx-auto px-5 sm:px-8 pb-28 fade-up">
      <div class="glass rounded-3xl p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div class="max-w-2xl"><div class="font-mono text-[11px] uppercase tracking-[.2em] text-cyan mb-3">Tools</div><h2 class="font-display text-3xl sm:text-4xl font-semibold">${t.toolsTitle}</h2><p class="mt-3 text-slate-400">${t.toolsCopy}</p></div>
        <a href="/tools/ip-leak-test/" class="group block lg:w-96 p-5 rounded-2xl bg-black/20 hairline hover:border-cyan/40 transition">
          <div class="flex items-center gap-3">${icon('globe', 'w-5 h-5 text-cyan')}<span class="font-display text-xl font-semibold">${t.toolName}</span></div>
          <p class="mt-3 text-sm leading-6 text-slate-400">${t.toolDesc}</p>
          <div class="mt-4 text-sm font-semibold text-cyan group-hover:text-white transition">${t.toolCta} →</div>
        </a>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-5 sm:px-8 pb-28 fade-up">
      <div class="relative overflow-hidden rounded-[2rem] glass p-8 sm:p-12 lg:p-16 text-center"><div class="absolute inset-0 bg-gradient-to-r from-indigo/10 via-cyan/5 to-emerald/10"></div><div class="relative"><div class="font-mono text-[11px] uppercase tracking-[.2em] text-emerald mb-4">Private by architecture</div><h2 class="font-display text-4xl sm:text-5xl font-semibold max-w-3xl mx-auto">${t.ctaTitle}</h2><p class="mt-5 max-w-2xl mx-auto text-slate-400">${t.ctaCopy}</p><p class="mt-3 max-w-2xl mx-auto text-sm text-slate-500">${t.ctaNote}</p><div class="mt-9 flex flex-wrap justify-center gap-3"><a href="#diagnostics" class="px-5 py-3 rounded-xl bg-white text-slate-950 font-semibold inline-flex items-center gap-2">${icon('activity', 'w-4 h-4')}${t.runDiag}</a><a href="/tools/ip-leak-test/" class="px-5 py-3 rounded-xl glass font-semibold inline-flex items-center gap-2">${icon('globe', 'w-4 h-4 text-cyan')}${t.ctaTools}</a></div></div></div>
    </section>
  </main>

  ${footer(t)}
</body>
</html>
`;
}

function docPage({ slug, title, desc, body, current = null, article = null }) {
  const t = LANGS.en;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${head({ title: `${title} | SecureInChat`, desc, canonical: `/${slug}/`, jsonld: article })}
</head>
<body class="noise min-h-screen overflow-x-hidden bg-obsidian text-slate-100 font-sans antialiased selection:bg-emerald/30">
  <a href="#top" class="skip">${t.skip}</a>
  ${backdrop}
  ${header(t, { home: false, current })}
  <main id="top" class="relative z-10 doc max-w-3xl mx-auto px-5 sm:px-8 pt-36 pb-24">
${body}
  </main>
  ${footer(t)}
</body>
</html>
`;
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
    <p>The home page opens a WebSocket connection from your browser to our relay at ws.secureinchat.com to measure latency and verify the relay's challenge. No message content is involved. The relay and Cloudflare see the connection the way any server sees a visitor, including your IP address.</p>

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
    <p>SecureInChat is an end-to-end encrypted messenger built on a blind relay. Encryption keys stay on your devices, and the relay only forwards ciphertext it cannot read. The clients are still in development.</p>

    <h2>What you can use today</h2>
    <ul>
      <li><strong>Relay diagnostics</strong> on the <a href="/">home page</a>: a real WebSocket test against the production relay, with measured latency.</li>
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
    <p>VPN, proxy and privacy-tool vendors can sponsor the free tools. Any sponsored or affiliate placement is labelled as such and never changes a test result. See <a href="/sponsor/">how sponsorship works</a>.</p>
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
    <p>SecureInChat runs free privacy tools that people use while checking a VPN, proxy or browser setup. We accept a small number of sponsors and affiliate partners whose products fit that moment: VPNs, proxies, password managers and privacy software.</p>
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

for (const t of Object.values(LANGS)) write(t.code === 'en' ? 'index.html' : `${t.code}/index.html`, home(t));
write('privacy/index.html', docPage({ slug: 'privacy', title: 'Privacy policy', desc: 'What secureinchat.com and its tools do with your data: no cookies, no accounts, no stored test results.', body: PRIVACY }));
write('about/index.html', docPage({ slug: 'about', title: 'About', desc: 'About SecureInChat: an end-to-end encrypted blind-relay messenger in development, plus free privacy tools.', body: ABOUT }));
write('sponsor/index.html', docPage({ slug: 'sponsor', title: 'Sponsorship and partnerships', desc: 'How VPN, proxy and privacy-tool vendors can sponsor SecureInChat tools, and the rules that keep test results independent.', body: SPONSOR }));
write('principles/index.html', docPage({ slug: 'principles', title: 'Privacy principles for the tools', desc: 'What each SecureInChat tool processes on your device, what it sends to outside services, and the limits we cannot remove.', body: PRINCIPLES }));
write('contact/index.html', docPage({ slug: 'contact', title: 'Contact', desc: 'How to contact SecureInChat.', body: CONTACT }));


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

write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366F1"/><stop offset=".5" stop-color="#06B6D4"/><stop offset="1" stop-color="#10B981"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><g transform="translate(6 6) scale(.833)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></g></svg>\n`);

// fonts + script
const fonts = [
  ['inter', 'inter', [400, 500, 600, 700, 800]],
  ['space-grotesk', 'space-grotesk', [500, 600, 700]],
  ['jetbrains-mono', 'jetbrains-mono', [400, 500, 600]],
];
for (const [pkg, name, weights] of fonts) {
  for (const w of weights) {
    const src = path.join(import.meta.dirname, `node_modules/@fontsource/${pkg}/files/${name}-latin-${w}-normal.woff2`);
    write(`assets/fonts/${name}-${w}.woff2`, fs.readFileSync(src));
  }
}
write('assets/main.js', fs.readFileSync(path.join(ROOT, 'src/main.js')));

// sitemap, robots, headers
const urls = [
  ['/', 1], ['/zh/', 0], ['/ja/', 0], ['/tools/', 0], ['/tools/ip-leak-test/', 0], ['/tools/webrtc-leak-test/', 0], ['/tools/ipv6-leak-test/', 0], ['/tools/photo-metadata-remover/', 0], ['/tools/browser-fingerprint-test/', 0], ['/tools/password-checker/', 0], ['/tools/text-redactor/', 0], ['/tools/site-health-check/', 0], ['/blog/', 0], ...POSTS.map((p) => [`/blog/${p.slug}/`, 0]), ['/about/', 0], ['/privacy/', 0], ['/contact/', 0], ['/sponsor/', 0], ['/principles/', 0],
];
const homeAlts = Object.values(LANGS).map((l) => `    <xhtml:link rel="alternate" hreflang="${l.html}" href="${SITE}${l.path}" />`).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/" />`;
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(([u]) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <lastmod>${DATE}</lastmod>${['/', '/zh/', '/ja/'].includes(u) ? '\n' + homeAlts : ''}\n  </url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /tools/api/\n\nSitemap: ${SITE}/sitemap.xml\n`);

const MAIN_CSP = "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' wss://ws.secureinchat.com https://cloudflareinsights.com; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'";
const TOOLS_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api4.ipify.org https://api6.ipify.org https://ipwho.is https://dnsapi.secureinchat.com https://*.lk.secureinchat.com https://api.pwnedpasswords.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const common = `  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`;
const mainPaths = ['/', '/zh/', '/ja/', '/privacy/', '/about/', '/contact/', '/sponsor/', '/principles/', '/blog/', ...POSTS.map((p) => `/blog/${p.slug}/`)];
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

// compile CSS
execFileSync('npx', ['tailwindcss', '-c', 'tailwind.config.cjs', '-i', '../src/input.css', '-o', '../public/assets/site.css', '--minify'], { cwd: import.meta.dirname, stdio: 'inherit' });
console.log('built');
