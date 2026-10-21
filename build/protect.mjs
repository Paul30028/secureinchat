// Mission page and the "protection layers" hubs. Status labels must stay honest:
// 'live' = usable today on this site, 'planned' = not built or not tested yet.

export const MISSION_SHORT = 'Protect your privacy layer by layer, from the device in your hand to the messages you send, with tools that run on your own device and guides where every step was actually tested.';

export const MISSION = `    <h1>Our mission</h1>
    <p class="meta">Last updated: 2026-10-21</p>
    <p class="lead">${MISSION_SHORT}</p>

    <h2>What we believe</h2>
    <ul>
      <li><strong>Privacy is a basic right, not a premium feature.</strong> What you say, where you go and who you talk to belong to you.</li>
      <li><strong>Protection works in layers.</strong> A strong password does not help if your camera is uncovered, and an encrypted app does not help if your phone shares your location. We cover the whole stack: physical, device, accounts, communication, offline and AI.</li>
      <li><strong>Trust should be checkable.</strong> Tools run in your browser where possible, every tool lists what it sends, and every guide says what was tested and what was not.</li>
      <li><strong>Privacy must work for ordinary people.</strong> One clear action at a time, explained without jargon or fear.</li>
    </ul>

    <h2>Our vision</h2>
    <p>A world where anyone can live and communicate privately: free from tracking by advertisers and data brokers, from scammers and stalkers, and from surveillance by any government that acts without lawful process, and able to keep talking securely even when the network goes down.</p>

    <h2>Who we build for</h2>
    <p>Everyone who wants more control over their personal information, and especially people for whom privacy is a matter of safety: journalists, human rights workers, people leaving abusive relationships and anyone whose threat model includes more than advertisers.</p>

    <h2>What we will never do</h2>
    <ul>
      <li>Sell, share or rent data about our visitors or customers, or track them across sites.</li>
      <li>Recommend a product that collects more data than it needs, however much it pays.</li>
      <li>Let a sponsor or affiliate change a test result or a verdict. Every paid or affiliate placement is labelled.</li>
      <li>Claim something we have not tested. Untested steps are marked as untested.</li>
      <li>Sell security hardware whose firmware you cannot verify under our own brand.</li>
      <li>Help anyone commit a crime or harm another person. Our guides are about protecting yourself.</li>
    </ul>

    <h2>How we keep the lights on</h2>
    <p>We publish this so you can judge our incentives.</p>
    <ul>
      <li><strong>Today:</strong> nothing is sold yet. The tools and articles are free.</li>
      <li><strong>Planned:</strong> labelled sponsors and affiliate partners that meet our privacy rules; paid tested guides; simple physical privacy products (camera covers, privacy screens, signal-blocking bags) that need no trust in firmware; and guided setup help. Each will be listed on the <a href="/principles/">principles page</a> before it starts.</li>
    </ul>

    <h2>Hold us to it</h2>
    <p>If anything on this site falls short of this page, email us at <a href="mailto:x@secureinchat.com">x@secureinchat.com</a>. We will fix it or explain why in public.</p>
`;

export const LAYERS = [
  {
    slug: 'physical', icon: 'eye-off', name: 'Physical', tagline: 'What people and devices near you can see and pick up.',
    threat: 'Shoulder-surfing on trains and in cafes, cameras you forgot were on, contactless cards read through a bag, and phones that keep talking to the network when you want them silent.',
    live: [],
    planned: ['Buying guide: camera covers, privacy screens, signal-blocking (Faraday) bags, RFID card sleeves and USB data blockers, with how to test each one yourself',
      'How to check that a signal-blocking bag actually blocks: a two-minute test with your own phone'],
    rule: 'We will only sell physical products whose protection you can check yourself. We will not sell security electronics with closed firmware under our own brand.',
  },
  {
    slug: 'devices', icon: 'smartphone', name: 'Devices and network', tagline: 'What your phone, computer and browser give away.',
    threat: 'Your IP address, location, browser fingerprint and app permissions reveal more than most people expect, even behind a VPN.',
    live: [['Browser privacy report: leaks and fingerprint in one run', '/tools/privacy-report/', 'net'], ['IP leak test', '/tools/ip-leak-test/', 'net'], ['WebRTC leak test', '/tools/webrtc-leak-test/', 'net'], ['IPv6 leak test', '/tools/ipv6-leak-test/', 'net'], ['Browser fingerprint test', '/tools/browser-fingerprint-test/', 'local'], ['Link checker: remove tracking, spot phishing signs', '/tools/link-checker/', 'local'], ['How to test a VPN yourself', '/blog/how-to-test-a-vpn-yourself/', 'guide'], ['Check what your phone apps can access (Android and iPhone)', '/blog/check-app-permissions-android-iphone/', 'guide']],
    planned: ['Privacy reset checklists for iPhone, Android, Windows and macOS: each setting, what it protects, what it costs you and how to undo it'],
  },
  {
    slug: 'accounts', icon: 'key-round', name: 'Accounts and email', tagline: 'Who can get into your accounts, and what your inbox reveals.',
    threat: 'Reused passwords, SMS codes and an email provider that can read every message are the usual way accounts and identities are taken over.',
    live: [['Password breach checker', '/tools/password-checker/', 'local'], ['How password breach checks work', '/blog/how-password-breach-checks-work/', 'guide'], ['What data brokers know about you', '/blog/what-data-brokers-know-about-you/', 'guide']],
    planned: ['Moving to encrypted email, step by step', 'An account recovery plan you keep offline: recovery codes, security keys and trusted devices'],
  },
  {
    slug: 'communication', icon: 'messages-square', name: 'Communication', tagline: 'Messages only the people in the conversation can read.',
    threat: 'Many messaging services can read message content or keep detailed records of who talks to whom and when.',
    live: [['SecureInChat messenger: design, status and live relay test', '/messaging/', 'dev'], ['What a blind relay can and cannot know', '/blog/what-a-blind-relay-can-and-cannot-know/', 'guide']],
    planned: ['SecureInChat clients (in development): end-to-end encryption with keys that never leave your device', 'An offline mode for SecureInChat that works over Wi-Fi Direct or Bluetooth without a network (research stage)'],
  },
  {
    slug: 'offline', icon: 'radio', name: 'Offline and emergency', tagline: 'Staying in touch securely when mobile networks fail.',
    threat: 'Power cuts, network faults and disasters can take mobile networks down for hours, exactly when people most need to reach each other.',
    live: [['When mobile networks go down: encrypted messaging without a network', '/blog/encrypted-messaging-when-networks-fail/', 'documented']],
    planned: ['Field tests of Briar and Meshtastic: real range, delay and failure cases', 'A family emergency communication card'],
  },
  {
    slug: 'ai', icon: 'bot', name: 'AI privacy', tagline: 'What you hand to AI assistants, and how to hand over less.',
    threat: 'Documents and chats pasted into AI tools can include names, account numbers and other people’s data you never meant to share.',
    live: [['AI apps: permissions and the settings that keep chats out of training', '/blog/ai-apps-permissions-and-data/', 'guide'], ['Text redactor', '/tools/text-redactor/', 'local'], ['Photo metadata remover', '/tools/photo-metadata-remover/', 'local'], ['Before you paste into AI: checklist', '/blog/before-you-paste-into-ai-checklist/', 'guide'], ['Bank statements and AI', '/blog/bank-statement-before-ai-upload/', 'tested'], ['Photos and AI', '/blog/photo-before-ai-upload/', 'guide'], ['CVs and AI', '/blog/cv-before-ai-upload/', 'guide']],
    planned: ['A one-step local checker that flags sensitive text before you paste it into an AI assistant'],
  },
];

export const KIND = {
  local: ['tested', 'Tool · runs on your device'],
  net: ['lim', 'Tool · contacts outside lookup services'],
  guide: ['doc', 'Guide'],
  tested: ['tested', 'Guide · we ran the test'],
  documented: ['doc', 'Documented · field test pending'],
  dev: ['lim', 'In development'],
};
export const tag = (k, text) => `<span class="tag tag--${k}">${text}</span>`;

export function layerTags(L) {
  if (!L.live.length) return tag('untested', 'Planned');
  const tools = L.live.filter((x) => ['local', 'net'].includes(x[2])).length;
  const guides = L.live.filter((x) => ['guide', 'tested'].includes(x[2])).length;
  const out = [];
  if (tools) out.push(tag('tested', `${tools} tool${tools > 1 ? 's' : ''}`));
  if (guides) out.push(tag('doc', `${guides} guide${guides > 1 ? 's' : ''}`));
  if (L.live.some((x) => x[2] === 'documented')) out.push(tag('doc', 'Documented'), tag('untested', 'Field test pending'));
  if (L.live.some((x) => x[2] === 'dev')) out.push(tag('lim', 'Messenger in development'));
  return out.join('');
}

export function layerBody(L, esc, n) {
  const live = L.live.length
    ? `<ul class="items">\n${L.live.map(([t, h, k]) => `      <li><a href="${h}">${esc(t)}</a> ${tag(KIND[k][0], KIND[k][1])}</li>`).join('\n')}\n    </ul>`
    : '<p>Nothing on this layer is live yet.</p>';
  return `    <p class="meta"><a href="/protect/">Protect</a> · Layer ${String(n).padStart(2, '0')} of 06</p>
    <h1>${esc(L.name)}</h1>
    <p class="lead">${esc(L.tagline)}</p>
    <h2>The risk</h2>
    <p>${esc(L.threat)}</p>
    <h2>Use it today</h2>
    ${live}
    <h2>Coming next</h2>
    <ul class="items">
${L.planned.map((p) => `      <li>${esc(p)} ${tag('untested', 'Not built or not tested yet')}</li>`).join('\n')}
    </ul>
${L.rule ? `    <h2>Our rule for this layer</h2>\n    <p>${esc(L.rule)}</p>\n` : ''}    <p>Every page on this site follows our <a href="/mission/">mission and commitments</a>. What the labels mean: <a href="/principles/#labels">status labels</a>.</p>
`;
}

export function protectIndexBody(esc) {
  return `    <h1>Protect your privacy, layer by layer</h1>
    <p class="lead">${esc(MISSION_SHORT)}</p>
    <p>Not sure where to begin? <a href="/start/">Start from your situation</a> instead.</p>
${LAYERS.map((L, i) => `    <h2><a href="/protect/${L.slug}/">${String(i + 1).padStart(2, '0')} · ${esc(L.name)}</a></h2>\n    <p>${esc(L.tagline)}</p>\n    <p>${layerTags(L)}</p>`).join('\n')}
`;
}

export const SITUATIONS = [
  {
    slug: 'being-tracked', title: 'Someone may be tracking me', short: 'Phone, location and accounts',
    intro: 'If you think a person is following what you do, through your phone, your accounts or photos you share, these are the first checks we can offer today.',
    safety: 'If you are in danger, contact local emergency services or a local support organisation first. If someone has access to your phone or accounts, changing settings or passwords can alert them; consider making changes from a device they cannot reach.',
    steps: [['Remove location data from photos before you share them', '/tools/photo-metadata-remover/', 'local'], ['Check your passwords against known breaches without sending them', '/tools/password-checker/', 'local'], ['See what your browser gives away to sites that track you', '/tools/browser-fingerprint-test/', 'local'], ['What data brokers know about you, and how to ask them to delete it', '/blog/what-data-brokers-know-about-you/', 'guide']],
    layers: ['devices', 'accounts', 'physical'],
  },
  {
    slug: 'account-hacked', title: 'My account may be hacked', short: 'Passwords, recovery, keys',
    intro: 'Most account takeovers start with a reused or leaked password. Start by checking the passwords you use most.',
    steps: [['Check a password against known breaches without sending it', '/tools/password-checker/', 'local'], ['Check a login link for phishing signs before you use it', '/tools/link-checker/', 'local'], ['How password breach checks work, and what they cannot tell you', '/blog/how-password-breach-checks-work/', 'guide']],
    layers: ['accounts'],
  },
  {
    slug: 'less-tracking', title: 'I want less tracking every day', short: 'Settings, browser, data brokers',
    intro: 'Everyday tracking comes from your browser, your network connection and the data you hand to services, including AI assistants.',
    steps: [['Run a privacy report on this browser and fix the top items', '/tools/privacy-report/', 'net'], ['Remove tracking from links before you click or share them', '/tools/link-checker/', 'local'], ['Check whether your VPN or proxy leaks your real address', '/tools/ip-leak-test/', 'net'], ['Before you paste anything into an AI assistant', '/blog/before-you-paste-into-ai-checklist/', 'guide'], ['What data brokers know about you', '/blog/what-data-brokers-know-about-you/', 'guide']],
    layers: ['devices', 'ai', 'accounts'],
  },
  {
    slug: 'network-down', title: 'The network might go down', short: 'Offline, encrypted messaging',
    intro: 'Power cuts and network faults can take mobile service down for hours. What works without a network has to be set up before it happens.',
    steps: [['When mobile networks go down: how to keep messaging securely', '/blog/encrypted-messaging-when-networks-fail/', 'documented']],
    layers: ['offline', 'communication'],
  },
];

export function situationBody(S, esc) {
  return `    <p class="meta"><a href="/start/">Start from your situation</a></p>
    <h1>${esc(S.title)}</h1>
    <p class="lead">${esc(S.intro)}</p>
${S.safety ? `    <p class="notice">${esc(S.safety)}</p>\n` : ''}    <h2>Do this first</h2>
    <ol class="items">
${S.steps.map(([t, h, k]) => `      <li><a href="${h}">${esc(t)}</a> ${tag(KIND[k][0], KIND[k][1])}</li>`).join('\n')}
    </ol>
    <h2>The layers that matter here</h2>
    <ul>
${S.layers.map((s) => { const L = LAYERS.find((x) => x.slug === s); return `      <li><a href="/protect/${L.slug}/">${esc(L.name)}</a>: ${esc(L.tagline)}</li>`; }).join('\n')}
    </ul>
    <p>We only list steps we can offer today. More guides are being written and tested; see <a href="/protect/">all six layers</a>.</p>
`;
}

export function startIndexBody(esc) {
  return `    <h1>Start from your situation</h1>
    <p class="lead">Pick what worries you most. Each page gives the first steps you can take today and the layers that matter for it.</p>
${SITUATIONS.map((S) => `    <h2><a href="/start/${S.slug}/">${esc(S.title)}</a></h2>\n    <p>${esc(S.short)}</p>`).join('\n')}
`;
}
