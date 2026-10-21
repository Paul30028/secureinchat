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
      <li><strong>Trust should be checkable.</strong> Tools run in your browser where possible, the code is public, and every guide says what was tested and what was not.</li>
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
    <p>If anything on this site falls short of this page, tell us on <a href="https://github.com/Paul30028/secureinchat/issues" rel="noopener">GitHub</a> or by <a href="/contact/">email</a>. We will fix it or explain why in public.</p>
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
    live: [['IP leak test', '/tools/ip-leak-test/'], ['WebRTC leak test', '/tools/webrtc-leak-test/'], ['IPv6 leak test', '/tools/ipv6-leak-test/'], ['Browser fingerprint test', '/tools/browser-fingerprint-test/'], ['How to test a VPN yourself', '/blog/how-to-test-a-vpn-yourself/']],
    planned: ['Privacy reset checklists for iPhone, Android, Windows and macOS: each setting, what it protects, what it costs you and how to undo it'],
  },
  {
    slug: 'accounts', icon: 'key-round', name: 'Accounts and email', tagline: 'Who can get into your accounts, and what your inbox reveals.',
    threat: 'Reused passwords, SMS codes and an email provider that can read every message are the usual way accounts and identities are taken over.',
    live: [['Password breach checker', '/tools/password-checker/'], ['How password breach checks work', '/blog/how-password-breach-checks-work/'], ['What data brokers know about you', '/blog/what-data-brokers-know-about-you/']],
    planned: ['Moving to encrypted email, step by step', 'An account recovery plan you keep offline: recovery codes, security keys and trusted devices'],
  },
  {
    slug: 'communication', icon: 'messages-square', name: 'Communication', tagline: 'Messages only the people in the conversation can read.',
    threat: 'Many messaging services can read message content or keep detailed records of who talks to whom and when.',
    live: [['Relay diagnostics (live test of our relay)', '/#diagnostics'], ['What a blind relay can and cannot know', '/blog/what-a-blind-relay-can-and-cannot-know/']],
    planned: ['SecureInChat clients (in development): end-to-end encryption with keys that never leave your device', 'An offline mode for SecureInChat that works over Wi-Fi Direct or Bluetooth without a network (research stage)'],
  },
  {
    slug: 'offline', icon: 'radio', name: 'Offline and emergency', tagline: 'Staying in touch securely when mobile networks fail.',
    threat: 'Power cuts, network faults and disasters can take mobile networks down for hours, exactly when people most need to reach each other.',
    live: [['When mobile networks go down: encrypted messaging without a network', '/blog/encrypted-messaging-when-networks-fail/']],
    planned: ['Field tests of Briar and Meshtastic: real range, delay and failure cases', 'A family emergency communication card'],
  },
  {
    slug: 'ai', icon: 'bot', name: 'AI privacy', tagline: 'What you hand to AI assistants, and how to hand over less.',
    threat: 'Documents and chats pasted into AI tools can include names, account numbers and other people’s data you never meant to share.',
    live: [['Text redactor', '/tools/text-redactor/'], ['Photo metadata remover', '/tools/photo-metadata-remover/'], ['Before you paste into AI: checklist', '/blog/before-you-paste-into-ai-checklist/'], ['Bank statements and AI', '/blog/bank-statement-before-ai-upload/'], ['Photos and AI', '/blog/photo-before-ai-upload/'], ['CVs and AI', '/blog/cv-before-ai-upload/']],
    planned: ['A one-step local checker that flags sensitive text before you paste it into an AI assistant'],
  },
];

export function layerBody(L, esc) {
  const live = L.live.length
    ? `<ul>\n${L.live.map(([t, h]) => `      <li><a href="${h}">${esc(t)}</a></li>`).join('\n')}\n    </ul>`
    : '<p>Nothing on this layer is live yet.</p>';
  return `    <p class="meta"><a href="/protect/">Protect</a></p>
    <h1>${esc(L.name)}</h1>
    <p class="lead">${esc(L.tagline)}</p>
    <h2>The risk</h2>
    <p>${esc(L.threat)}</p>
    <h2>Use it today</h2>
    ${live}
    <h2>Coming next (not built or not tested yet)</h2>
    <ul>
${L.planned.map((p) => `      <li>${esc(p)}</li>`).join('\n')}
    </ul>
${L.rule ? `    <h2>Our rule for this layer</h2>\n    <p>${esc(L.rule)}</p>\n` : ''}    <p>Every page on this site follows our <a href="/mission/">mission and commitments</a>.</p>
`;
}

export function protectIndexBody(esc) {
  return `    <h1>Protect your privacy, layer by layer</h1>
    <p class="lead">${esc(MISSION_SHORT)}</p>
    <p>Start with the layer that worries you most. Each page says what you can use today and what is still being built or tested.</p>
${LAYERS.map((L) => `    <h2><a href="/protect/${L.slug}/">${esc(L.name)}</a></h2>\n    <p>${esc(L.tagline)} <span class="meta">${L.live.length} live, ${L.planned.length} planned</span></p>`).join('\n')}
`;
}
